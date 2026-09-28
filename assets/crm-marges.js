/* assets/crm-marges.js — Financement → Produits → « Marges par produit »
   ═══════════════════════════════════════════════════════════════════════════
   Demande de Pablo (2026-09-28) : dans Produits, un onglet pour vérifier les
   marges par produit, sur le modèle d'Opérationnel — un héros, un tableau
   (une ligne par produit), puis la page d'un produit avec CHAQUE SORTIE
   (chaque session passée qui l'a produit). Au clic sur une sortie : le prix
   des matières payé, pondéré avec la moyenne, et le nombre de plats — croisé
   avec l'inventaire, les produits réels, les commandes et le surplus.

   Les chiffres viennent de bilanSession (crm.html, Opérationnel) : CA de la
   recette dans ses commandes et part de cuisine — réels quand les trois
   pièces de la session sont reliées, prévus sinon (écrit sur chaque ligne).
   Ce qui est propre à ce tableau :
   - la MATIÈRE CONSOMMÉE est la production réelle quand elle a été pesée par
     ingrédient (crm-produits.js), sinon le besoin prévu ; au prix payé dans la
     session, sinon au prix de référence ;
   - les PLATS EN PLUS ASSIGNÉS entrent au CA de la recette qui les a produits,
     au prix moyen d'une portion de cette session. Dans Opérationnel, ce repas
     reste au CA de la commande qui le reçoit : les deux vues ne s'additionnent
     pas ;
   - le COÛT PAR PLAT divise les coûts par les portions PRODUITES — complètes
     ET à compléter : les 5 kg de riz ont servi aux 20 portions commencées, pas
     aux 10 finies ; diviser par les complètes seules gonflerait leur coût.
     Par les commandées quand la production réelle n'est pas saisie.
   Le prix MOYEN PONDÉRÉ d'un aliment = total payé ÷ kilos achetés, sur toutes
   les pièces MP de toutes les sessions passées.

   Dépend de crm.html (bilanSession, editVide, fmtEur, signeEur, couleurRes,
   fd, esc, tabs, render, chargerFinanceGlobal, FIN_GLOBAL, isoLocal) et de
   crm-produits.js (productionReelle, prFamille, prVersBase, prFmt, prTry,
   chargerPlats, PLATS_CACHE, platPastille, prVueDisponibles) — chargé après.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Le coût de cuisine d'une session (location + équipe) et sa part par recette.
   Retour de Pablo (28/09) : « il faut inclure le coût de la cuisine imputé à
   chaque recette ». Deux choses le rendaient invisible :
   - les HEURES : sans heures saisies ni mapping généré, Opérationnel les
     estime depuis les étapes des fiches — 1 h minimum si les fiches n'ont pas
     d'étapes de production — alors que le plan de production de la session
     connaît la vraie durée. Ici : heures d'Opérationnel quand elles sont
     sûres (saisies ou mapping), sinon celles du PLAN (NattyProd.planSession,
     le même calcul que « Réservation cuisine » : durée + 30 min, arrondi à
     l'heure pleine) ; la facture de cuisine l'emporte quand elle est reliée ;
   - l'IMPUTATION : au temps de travail ACTIF de chaque recette dans le plan
     (un bourguignon qui mijote 3 h ne prend personne), sinon, sans plan ou si
     une recette n'y figure pas, au prorata des portions (portions × facteur). */
function prmCuisineSession(s, b, E) {
  const c = b.calc, reelOk = b.liens.complet;
  const factureCuisine = reelOk || (b.pieces && b.pieces.cuisine && b.pieces.cuisine.nbAvecMontant > 0);
  let ctx = null;
  try { if (E && window.NattyProd && typeof cpContexte === 'function') { const sf = cpFusion(s); if (sf.recettes.length && sf.jours_livraison.length) ctx = cpContexte(sf, E); } } catch (e) { ctx = null; }
  const aPlan = !!(ctx && ctx.plan && ctx.plan.taches && ctx.plan.taches.length);
  let heures = c.heures, sourceHeures = c.sourceHeures, location = factureCuisine ? b.reel.location : c.coutLocation;
  if (!factureCuisine && aPlan && (c.sourceHeures === 'fiches' || c.sourceHeures === 'inconnu')) {
    heures = ctx.heures; sourceHeures = 'plan'; location = heures * c.tarifCuisineH;
  }
  const equipe = reelOk ? b.reel.equipe : c.coutEquipe;
  const minutes = {};
  if (aPlan) ctx.plan.taches.forEach(t => { if (!t.passif && t.recId && t.cuisinier >= 0) minutes[t.recId] = (minutes[t.recId] || 0) + Math.max(0, t.fin - t.debut); });
  const totMin = Object.values(minutes).reduce((t, v) => t + v, 0);
  const recs = Object.keys(b.parProduit);
  const auTemps = totMin > 0 && recs.every(id => minutes[id] > 0);
  const pEqTot = Object.values(c.portionsEq).reduce((t, v) => t + v, 0);
  const part = id => auTemps ? minutes[id] / totMin : (pEqTot ? (c.portionsEq[id] || 0) / pEqTot : 0);
  return { total: location + equipe, location, equipe, heures, sourceHeures, tarif: c.tarifCuisineH, facture: factureCuisine, auTemps, minutes, totMin, part };
}
/* Les achats de matières d'une session, par aliment ET par famille d'unités
   (kg/g, L/ml, pièce) — les lignes des pièces MP, la « Saisie manuelle » du
   tableau des matières remplaçant les factures pour son aliment (même règle
   que rapprochementFacture). Q = quantité achetée ; Qp et P = quantité et
   montant des seules lignes qui portent un prix (un prix absent n'est pas un
   prix nul). En unités de base : g, ml, pièces. */
function prmAchats(raw) {
  const factures = raw.factures || [];
  const lignes = (raw.lignes || []).map(l => ({ l, f: factures.find(x => x.id === l.facture_id) })).filter(x => x.f && (x.f.categorie || 'mp') === 'mp');
  const cleL = l => (l.ingredient_match || l.designation || '').trim().toLowerCase();
  const manuels = new Set(lignes.filter(x => x.f.fournisseur === FOURNISSEUR_MANUEL).map(x => cleL(x.l)));
  const A = {};
  lignes.forEach(({ l, f }) => {
    const nom = (l.ingredient_match || l.designation || '').trim(); if (!nom) return;
    const cle = nom.toLowerCase(); if (manuels.has(cle) && f.fournisseur !== FOURNISSEUR_MANUEL) return;
    const fam = prFamille(l.unite || 'kg'), k = cle + '|' + fam, q = prVersBase(+l.quantite || 0, l.unite || 'kg');
    const a = A[k] || (A[k] = { nom, fam, Q: 0, Qp: 0, P: 0, lignes: 0 });
    const prix = l.prix_total != null ? +l.prix_total : (l.prix_unitaire != null ? +l.prix_unitaire * (+l.quantite || 0) : null);
    a.Q += q; a.lignes++;
    if (prix != null) { a.P += prix; a.Qp += q; }
  });
  return A;
}
/* Le prix unitaire affiché : au kg, au litre ou à la pièce (base g/ml → × 1000). */
const prmPrixUnite = (P, Qp, fam) => Qp > 0 ? P / Qp * (fam === 'p' ? 1 : 1000) : null;
const PRM_UNITE = { m: 'kg', v: 'L', p: 'pièce' };
function prMarges(global, plats, inventaires, auj, E) {
  const moyen = {}, bilans = [];
  global.sessions.filter(s => s.jour && s.jour <= auj).forEach(s => {
    const raw = global.rawParSession[s.id]; if (!raw) return;
    const b = bilanSession(raw, editVide()); if (!b) return;
    const achats = prmAchats(raw);
    bilans.push({ s, b, achats, pr: productionReelle(raw, b.calc, s.production_reelle) });
    // Prix moyen pondéré de chaque aliment : Σ payé ÷ Σ quantité, toutes sessions passées.
    Object.entries(achats).forEach(([k, a]) => {
      if (!(a.Qp > 0)) return;
      const m = moyen[k] || (moyen[k] = { P: 0, Qp: 0, n: 0, min: Infinity, max: 0, fam: a.fam });
      const pu = prmPrixUnite(a.P, a.Qp, a.fam);
      m.P += a.P; m.Qp += a.Qp; m.n++; m.min = Math.min(m.min, pu); m.max = Math.max(m.max, pu);
    });
  });
  Object.values(moyen).forEach(m => { m.prixUnite = prmPrixUnite(m.P, m.Qp, m.fam); });
  const produits = {};
  bilans.forEach(({ s, b, pr, achats }) => {
    const c = b.calc, reelOk = b.liens.complet;
    const cu = prmCuisineSession(s, b, E);
    const lignesSession = [];
    Object.values(b.parProduit).forEach(p => {
      const cp = c.parRecette.find(x => x.id === p.id); if (!cp) return;
      const prc = pr.recettes.find(r => r.recId === p.id) || { saisi: false };
      const commandees = cp.nbPortions, produites = prc.saisi ? prc.completes : null;
      const assignes = plats.filter(x => x.session_id === s.id && x.recette_id === p.id);
      const ca = reelOk ? p.caReel : p.ca, prixPortion = commandees ? ca / commandees : 0;
      const vus = {};
      (c.detailParRecette[p.id] || []).forEach(l => {
        const cle = l.nom.toLowerCase(), fam = prFamille(l.unite);
        const x = vus[cle] || (vus[cle] = { nom: l.nom, cle, fam, prevu: 0 });
        if (x.fam === fam) x.prevu += prVersBase(l.q, l.unite);
      });
      /* La matière d'une recette, aliment par aliment — la règle de Pablo
         (28/09) : P payé pour Q acheté, q consommé par la recette →
         coût = P × q ÷ Q ; la recette = la somme sur toutes ses matières.
         q = ce que la recette a vraiment consommé : le reste pesé + les
         portions déjà faites (à la portion moyenne) quand elle a été pesée ;
         les portions produites × la portion moyenne pour un plat entier ou
         une validation à l'assemblage ; le besoin prévu sinon.
         Sans achat relevé de l'aliment dans la session : son prix de
         référence (au kg seulement), et c'est écrit. */
      const pp = x => commandees ? x.prevu / commandees : 0;
      const mp = Object.values(vus).filter(x => x.prevu > 0).map(x => {
        const tot = c.lignesIngredients.find(l => l.nom.toLowerCase() === x.cle);
        const saisi = prc.saisis && prc.saisis.find(i => i.cle === x.cle);
        const deja = (prc.deja || 0) + ((prc.surplus && prc.surplus.deja) || 0);
        const consomme = saisi ? saisi.prod + deja * pp(x) : prc.saisi ? (prc.completes || 0) * pp(x) : x.prevu;
        const sourceQ = saisi ? 'pesé' : prc.saisi ? 'portions produites' : 'prévu';
        const k = x.cle + '|' + x.fam, a = achats[k], m = moyen[k];
        const prixRef = tot && x.fam === 'm' ? tot.prixKg : null;
        let cout = null, sourcePrix = null;
        if (a && a.Qp > 0) { cout = a.P * consomme / a.Qp; sourcePrix = 'achat'; }
        else if (prixRef != null) { cout = consomme / 1000 * prixRef; sourcePrix = 'référence'; }
        const inv = inventaires.find(v => v.session_id === s.id && String(v.ingredient_nom || '').trim().toLowerCase() === x.cle);
        const ligne = { ...x, k, produit: saisi ? saisi.prod : null, consomme, sourceQ, Q: a ? a.Q : null, Qp: a ? a.Qp : null, P: a ? a.P : null,
          part: a && a.Qp > 0 ? consomme / a.Qp : null, prixPaye: a ? prmPrixUnite(a.P, a.Qp, x.fam) : null, prixRef,
          prixMoyen: m ? m.prixUnite : null, nAchats: m ? m.n : 0, cout, sourcePrix,
          inventaire: inv ? { attendu: inv.attendu, compte: +inv.compte, unite: inv.unite } : null };
        lignesSession.push(ligne);
        return ligne;
      });
      const matiere = mp.reduce((t, x) => t + (x.cout || 0), 0);
      const part = cu.part(p.id), cuisine = cu.total * part;
      const nbProduits = produites != null ? produites + (prc.aCompleter || 0) : commandees;
      const caTot = ca + assignes.length * prixPortion, cout = matiere + cuisine;
      (produits[p.id] || (produits[p.id] = { id: p.id, nom: p.nom, sorties: [] })).sorties.push({
        session: s, commandees, produites, aCompleter: prc.saisi ? prc.aCompleter : 0, enPlus: prc.saisi ? prc.enPlus : 0,
        assignes, ca: caTot, caCommandes: ca, prixPortion, matiere, cuisine, cout, nbProduits, coutParPlat: nbProduits ? cout / nbProduits : null,
        res: caTot - cout, marge: caTot ? (caTot - cout) / caTot * 100 : null, nature: reelOk ? 'réel' : 'prévu', productionSaisie: !!prc.saisi,
        inventaire: !!s.inventaire_le, mp, sansPrix: mp.filter(x => x.cout == null).map(x => x.nom),
        cu, partCuisine: part, minutesRecette: cu.minutes[p.id] || 0 });
    });
    // Ce qui reste de chaque achat une fois TOUTES les recettes servies : du
    // stock, pas un coût — la somme des recettes vaut P × Σq ÷ Q, jamais plus que P.
    const conso = {};
    lignesSession.forEach(l => { conso[l.k] = (conso[l.k] || 0) + (l.consomme || 0); });
    lignesSession.forEach(l => { l.reste = l.Q != null ? l.Q - conso[l.k] : null; l.consoSession = conso[l.k]; });
  });
  const liste = Object.values(produits).map(q => {
    const t = k => q.sorties.reduce((a, x) => a + (x[k] || 0), 0);
    const ca = t('ca'), cout = t('cout'), nb = t('nbProduits'), cmd = t('commandees');
    q.sorties.sort((a, b) => b.session.jour.localeCompare(a.session.jour));
    return { ...q, matiere: t('matiere'), cuisine: t('cuisine'), commandees: cmd, produits: nb, enPlus: t('enPlus'), aCompleter: t('aCompleter'), assignes: q.sorties.reduce((a, x) => a + x.assignes.length, 0),
      ca, cout, res: ca - cout, marge: ca ? (ca - cout) / ca * 100 : null, coutParPlat: nb ? cout / nb : null, prixPortion: cmd ? t('caCommandes') / cmd : null,
      toutReel: q.sorties.every(x => x.nature === 'réel'), saisies: q.sorties.filter(x => x.productionSaisie).length };
  }).sort((a, b) => (b.marge ?? -1e9) - (a.marge ?? -1e9));
  const ca = liste.reduce((t, p) => t + p.ca, 0), res = liste.reduce((t, p) => t + p.res, 0);
  return { produits: liste, moyen, ca, res, marge: ca ? res / ca * 100 : null };
}

const PRM = { rec: null, ouverte: null };
const prmPct = m => m == null ? '—' : `<span style="color:${couleurRes(m)};font-weight:600">${Math.round(m)} %</span>`;
function prMargesTableauHtml(M) {
  const moy = M.produits.length ? M.produits.reduce((t, p) => t + (p.marge || 0), 0) / M.produits.length : null;
  return `<div class="card lift" style="text-align:center;padding:24px 18px;margin-bottom:16px;border:1px solid ${couleurRes(M.res)}">
   <div class="muted" style="font-size:12.5px">Marge moyenne par produit — ${M.produits.length} produit${M.produits.length > 1 ? 's' : ''}, sessions passées</div>
   <div style="font-size:40px;font-weight:700;letter-spacing:-.02em;color:${couleurRes(moy || 0)};margin:4px 0">${moy != null ? Math.round(moy) + ' %' : '—'}</div>
   <div class="muted" style="font-size:12px">Résultat ${signeEur(M.res)} sur ${fmtEur(M.ca)} de ventes${M.marge != null ? ` · marge globale ${Math.round(M.marge)} %` : ''}</div>
   ${M.produits.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:14px">${M.produits.map(p => `<span class="chip ${(p.marge || 0) >= 0 ? 'ok' : 'bad'}">${esc(p.nom)} · ${p.marge != null ? Math.round(p.marge) + ' %' : '—'}</span>`).join('')}</div>` : ''}</div>
  <div class="tbl-wrap"><table><thead><tr><th>Produit</th><th>Sorties</th><th>Commandés</th><th>Produits</th><th>En plus · assignés</th><th>CA</th><th>Matière</th><th>Cuisine</th><th>Coût / plat</th><th>Résultat</th><th>Marge</th></tr></thead><tbody>
  ${M.produits.map(p => `<tr class="rowc" data-prm-ouvrir="${p.id}"><td>${esc(p.nom)}${p.toutReel ? '' : ' <span class="muted" style="font-size:11px">prévu</span>'}</td><td class="num">${p.sorties.length}</td><td class="num">${p.commandees}</td>
    <td class="num">${p.produits}${p.saisies < p.sorties.length ? `<div class="muted" style="font-size:10.5px">${p.sorties.length - p.saisies} sans prod. réelle</div>` : ''}</td>
    <td class="num">${p.enPlus} · ${p.assignes}</td><td class="num">${fmtEur(p.ca)}</td><td class="num">${fmtEur(p.matiere)}</td><td class="num">${fmtEur(p.cuisine)}</td><td class="num">${p.coutParPlat != null ? fmtEur(p.coutParPlat) : '—'}</td>
    <td class="num" style="color:${couleurRes(p.res)};font-weight:600">${signeEur(p.res)}</td><td class="num">${prmPct(p.marge)}</td></tr>`).join('') || '<tr><td colspan="11" class="muted" style="text-align:center;padding:18px">Aucune session passée avec des commandes attribuées.</td></tr>'}
  </tbody></table></div>
  <p class="muted" style="font-size:12px;margin-top:8px">Une ligne par produit, toutes ses sorties (sessions passées) cumulées. Réel quand les trois pièces d'une session sont reliées, prévu sinon. Matière = pour chaque aliment, payé P × consommé q ÷ acheté Q dans la session (q = le pesé + les portions déjà faites, sinon les portions produites, sinon le besoin prévu), additionné sur toutes les matières de la recette. Cuisine = location (heures × tarif, ou la facture de cuisine) + équipe, imputée à chaque recette au prorata de son temps de travail dans le plan de production (des portions à défaut). Coût par plat = coûts ÷ portions produites (complètes + à compléter, qui ont consommé la même matière). Clique un produit pour chacune de ses sorties.</p>`;
}
function prMargesMpHtml(x) {
  const q = (v, fam) => v == null ? '<span class="muted">—</span>' : prFmt(v, fam);
  const pu = (v, fam) => v == null ? '<span class="muted">—</span>' : fmtEur(v) + '/' + PRM_UNITE[fam];
  return `<div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Aliment</th><th>Consommé q</th><th>Acheté Q</th><th>Payé P</th><th>q ÷ Q</th><th>Coût = P × q ÷ Q</th><th>Prix payé · moyenne</th><th>Reste de l'achat</th><th>Inventaire</th></tr></thead><tbody>
  ${x.mp.map(m => { const e = m.prixPaye != null && m.prixMoyen != null ? m.prixPaye - m.prixMoyen : null; return `<tr><td>${esc(m.nom)}</td>
   <td class="num">${prFmt(m.consomme, m.fam)}<div class="muted" style="font-size:10.5px">${m.sourceQ}${m.sourceQ !== 'prévu' ? ' · prévu ' + prFmt(m.prevu, m.fam) : ''}</div></td>
   <td class="num">${q(m.Q, m.fam)}</td><td class="num">${m.P != null && m.Qp > 0 ? fmtEur(m.P) : '<span class="muted">—</span>'}</td>
   <td class="num">${m.part != null ? Math.round(m.part * 1000) / 10 + ' %' : '<span class="muted">—</span>'}</td>
   <td class="num">${m.cout != null ? `<b>${fmtEur(m.cout)}</b>` + (m.sourcePrix === 'référence' ? `<div class="muted" style="font-size:10.5px">aucun achat : prix de réf. ${fmtEur(m.prixRef)}/kg</div>` : '') : '<span class="muted">sans prix</span>'}</td>
   <td class="num">${pu(m.prixPaye, m.fam)}${m.prixMoyen != null ? `<div class="muted" style="font-size:10.5px">moy. ${pu(m.prixMoyen, m.fam)} · ${m.nAchats} achat${m.nAchats > 1 ? 's' : ''}${e != null ? ` · <span style="color:${e > 0 ? 'var(--red)' : 'var(--green)'}">${e >= 0 ? '+' : '−'}${fmtEur(Math.abs(e))}</span>` : ''}</div>` : ''}</td>
   <td class="num">${m.reste != null ? (m.reste >= 0 ? prFmt(m.reste, m.fam) : `<span style="color:var(--red)">−${prFmt(-m.reste, m.fam)}</span><div class="muted" style="font-size:10.5px">consommé > acheté</div>`) : '<span class="muted">—</span>'}</td>
   <td class="num">${m.inventaire ? `${m.inventaire.compte.toLocaleString('fr-FR')} ${esc(m.inventaire.unite)}${m.inventaire.attendu != null ? `<div class="muted" style="font-size:10.5px">attendu ${(+m.inventaire.attendu).toLocaleString('fr-FR')}</div>` : ''}` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}
  </tbody></table></div>
  <p class="muted" style="font-size:11.5px;margin:6px 0 0">Coût d'une matière = payé P × consommé q ÷ acheté Q ; la matière de la recette = la somme. Reste de l'achat = Q moins ce que TOUTES les recettes de la session ont consommé : du stock, pas un coût.</p>`;
}
function prMargesDetailHtml(M) {
  const p = M.produits.find(x => x.id === PRM.rec);
  if (!p) { PRM.rec = null; return prMargesTableauHtml(M); }
  const alim = {};
  p.sorties.forEach(x => x.mp.forEach(m => { const a = alim[m.k] || (alim[m.k] = { nom: m.nom, fam: m.fam, consomme: 0, cout: 0 }); a.consomme += m.consomme || 0; a.cout += m.cout || 0; }));
  return `<div style="margin-bottom:12px"><button class="btn sm ghost" type="button" data-prm-retour>← Tous les produits</button></div>
  <div class="card lift" style="text-align:center;padding:24px 18px;margin-bottom:16px;border:1px solid ${couleurRes(p.res)}">
   <div class="muted" style="font-size:12.5px">${esc(p.nom)} — ${p.sorties.length} sortie${p.sorties.length > 1 ? 's' : ''}</div>
   <div style="font-size:40px;font-weight:700;color:${couleurRes(p.marge || 0)};margin:4px 0">${p.marge != null ? Math.round(p.marge) + ' %' : '—'}</div>
   <div class="muted" style="font-size:12px">Résultat ${signeEur(p.res)} · ${fmtEur(p.ca)} de ventes · coût par plat ${p.coutParPlat != null ? fmtEur(p.coutParPlat) : '—'}${p.prixPortion != null ? ` · vendu ${fmtEur(p.prixPortion)} la portion en moyenne` : ''}</div></div>
  <div class="grid g4" style="margin-bottom:16px">
   <div class="card kpi"><div class="lbl">Commandés</div><div class="val">${p.commandees}</div></div>
   <div class="card kpi"><div class="lbl">Produits</div><div class="val" style="color:var(--green)">${p.produits}</div><div class="foot">${p.aCompleter ? 'dont ' + p.aCompleter + ' à compléter' : 'plats complets'}</div></div>
   <div class="card kpi"><div class="lbl">En plus</div><div class="val" style="color:var(--violet)">${p.enPlus}</div><div class="foot">${p.assignes} assigné${p.assignes > 1 ? 's' : ''} à une commande</div></div>
   <div class="card kpi"><div class="lbl">Coût par plat</div><div class="val" style="font-size:22px">${p.coutParPlat != null ? fmtEur(p.coutParPlat) : '—'}</div></div>
  </div>
  <div class="sect"><h2>Chaque sortie</h2><span>${p.sorties.length}</span></div>
  <div class="tbl-wrap"><table><thead><tr><th>Session</th><th>Commandés</th><th>Produits</th><th>En plus · assignés</th><th>CA</th><th>Matière</th><th>Cuisine</th><th>Coût / plat</th><th>Marge</th><th></th></tr></thead><tbody>
  ${p.sorties.map(x => { const ouv = PRM.ouverte === x.session.id; return `<tr class="rowc" data-prm-sortie="${x.session.id}"><td>${fd(x.session.jour)} <span class="muted" style="font-size:11px">${x.nature}</span></td><td class="num">${x.commandees}</td>
    <td class="num">${x.produites != null ? x.produites + (x.aCompleter ? ` <span class="chip warn">+${x.aCompleter} à compl.</span>` : '') : '<span class="muted">non saisi</span>'}</td>
    <td class="num">${x.enPlus} · ${x.assignes.length}</td><td class="num">${fmtEur(x.ca)}</td><td class="num">${fmtEur(x.matiere)}</td><td class="num">${fmtEur(x.cuisine)}</td>
    <td class="num">${x.coutParPlat != null ? fmtEur(x.coutParPlat) : '—'}</td><td class="num">${prmPct(x.marge)}</td><td>${ouv ? '▴' : '▾'}</td></tr>
    ${ouv ? `<tr><td colspan="10" style="background:var(--panel);padding:12px">
     <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px">
      <span class="chip">${x.commandees} commandé${x.commandees > 1 ? 's' : ''}</span>
      <span class="chip ${x.produites != null ? 'ok' : ''}">${x.produites != null ? x.produites + ' produit' + (x.produites > 1 ? 's' : '') + ' complet' + (x.produites > 1 ? 's' : '') : 'production réelle non saisie'}</span>
      ${x.aCompleter ? `<span class="chip warn">${x.aCompleter} à compléter</span>` : ''}
      <span class="chip vi">${x.enPlus} en plus</span>
      ${x.assignes.map(platPastille).join('')}
      <span class="chip ${x.inventaire ? 'info' : ''}">${x.inventaire ? 'inventaire fait' : 'pas d’inventaire'}</span>
      <button class="btn sm ghost" type="button" data-fin-voir-session="${x.session.id}" style="margin-left:auto">Session dans Opérationnel →</button></div>
     <div class="muted" style="font-size:12px;margin-top:6px">CA ${fmtEur(x.caCommandes)} des commandes${x.assignes.length ? ` + ${x.assignes.length} × ${fmtEur(x.prixPortion)} de plats assignés` : ''} · matière ${fmtEur(x.matiere)} (${x.productionSaisie ? 'quantités produites' : 'besoin prévu'}) · cuisine ${fmtEur(x.cuisine)} = ${Math.round(x.partCuisine * 100)} % de ${fmtEur(x.cu.total)} (${x.cu.facture ? 'facture de cuisine' : (x.cu.heures != null ? x.cu.heures + ' h × ' + fmtEur(x.cu.tarif) : 'heures inconnues') + (x.cu.sourceHeures === 'plan' ? ' selon le plan de production' : x.cu.sourceHeures === 'fiches' ? ' estimées depuis les fiches' : '')}${x.cu.equipe ? ' + équipe ' + fmtEur(x.cu.equipe) : ''}), ${x.cu.auTemps ? `au temps de travail : ${Math.round(x.minutesRecette)} min sur ${Math.round(x.cu.totMin)}` : 'au prorata des portions'} · ${x.nbProduits} portion${x.nbProduits > 1 ? 's' : ''} produite${x.nbProduits > 1 ? 's' : ''}${x.aCompleter ? ' (dont ' + x.aCompleter + ' à compléter)' : ''} → ${x.coutParPlat != null ? fmtEur(x.coutParPlat) : '—'} par plat${x.sansPrix.length ? ` · sans prix : ${x.sansPrix.map(esc).join(', ')}` : ''}</div>
     ${prMargesMpHtml(x)}</td></tr>` : ''}`; }).join('')}
  </tbody></table></div>
  <div class="sect" style="margin-top:18px"><h2>Matières, toutes sorties</h2></div>
  <div class="tbl-wrap"><table><thead><tr><th>Aliment</th><th>Consommé</th><th>Coût</th><th>Prix moyen pondéré</th><th>Payé min – max</th></tr></thead><tbody>
  ${Object.entries(alim).map(([cle, a]) => { const m = M.moyen[cle]; return `<tr><td>${esc(a.nom)}</td><td class="num">${prFmt(a.consomme, a.fam)}</td><td class="num">${a.cout ? fmtEur(a.cout) : '—'}</td><td class="num">${m && m.prixUnite != null ? fmtEur(m.prixUnite) + '/' + PRM_UNITE[a.fam] : '<span class="muted">aucun achat relevé</span>'}</td><td class="num">${m && m.n ? fmtEur(m.min) + ' – ' + fmtEur(m.max) : '—'}</td></tr>`; }).join('')}
  </tbody></table></div>
  <p class="muted" style="font-size:11.5px;margin-top:8px">Prix moyen pondéré = total payé ÷ quantité achetée (au kg, au litre ou à la pièce), sur toutes les pièces MP de toutes les sessions passées (pas seulement celles de ce produit). Inventaire = le compté de fin de session pour l'aliment (tout le stock, pas la part du produit).</p>`;
}
async function prVueMarges() {
  const inv = await prTry('crm_session_inventaire?select=*&order=created_at.desc');
  const E = await chargerProd();   // le plan de production de chaque session : heures et temps par recette
  const M = prMarges(FIN_GLOBAL, PLATS_CACHE || [], inv.ok ? inv.data : [], isoLocal(new Date()), E);
  return `<div id="prodRoot">${PRM.rec ? prMargesDetailHtml(M) : prMargesTableauHtml(M)}</div>`;
}
async function vFinanceProduits() {
  FIN_GLOBAL = await chargerFinanceGlobal();
  await chargerPlats(true);
  const tb = tabs('produits', [['dispo', 'Disponibles à la vente'], ['marges', 'Marges par produit']], 'dispo');
  return tb.html + '<div style="margin-top:12px">' + (tb.cur === 'marges' ? await prVueMarges() : await prVueDisponibles()) + '</div>';
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-prm-ouvrir]'); if (o) { PRM.rec = o.dataset.prmOuvrir; PRM.ouverte = null; render(); window.scrollTo(0, 0); return; }
  if (e.target.closest('[data-prm-retour]')) { PRM.rec = null; render(); return; }
  const so = e.target.closest('[data-prm-sortie]'); if (so) { PRM.ouverte = PRM.ouverte === so.dataset.prmSortie ? null : so.dataset.prmSortie; render(); }
});
