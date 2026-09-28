/* assets/crm-produits.js — ce qui sort vraiment de la cuisine
   ═══════════════════════════════════════════════════════════════════════════
   Demande de Pablo (2026-09-28) :
   1. INVENTAIRE de toutes les matières premières alimentaires après chaque
      session de production — le compté réécrit les stocks (`stocks_mp`).
   2. Dans Opérationnel (page d'une session), les PORTIONS RÉELLEMENT RÉALISÉES :
      « hier on a produit 10 L de bourguignon = 30 portions ; 5 kg de riz, 2 kg
      de poulet, 400 g de légumes, 300 ml de sauce = 10 portions complètes et
      10 à compléter ». Les complètes en haut, les à compléter en dessous, avec
      ce qui leur manque.
   3. Financement → PRODUITS : les repas faits EN PLUS des commandes,
      disponibles à la vente, et leur assignation à une commande. Un plat
      assigné reçoit un numéro et un nom (« curry266 »), affiché en pastille
      dans Commandes et dans la Production ; il retire une portion « à
      produire » de la commande cible, donc ses matières de la liste de courses.

   Règles de calcul — les mêmes que « Réorganiser » (crm.html, planProduction),
   pour que les deux écrans ne disent jamais deux choses différentes :
   - la quantité par portion d'un aliment = le prévu de la session pour la
     recette (fiche × coefficients, saisie du tableau des matières comprise)
     ÷ ses portions commandées : une MOYENNE de la session, pas le grammage de
     chaque client ;
   - portions FAISABLES = celles que permet l'aliment principal le plus
     disponible (étiquette « protéine », sinon ≥ 15 % du poids de la portion) ;
   - portions COMPLÈTES = celles que TOUS les aliments saisis permettent ;
     la différence est « à compléter », avec la quantité qui manque.
   - Un aliment laissé VIDE n'est pas compté (ni manquant, ni limitant) : on
     ne pèse pas le sel. Il est nommé sous la recette.

   Dépend de crm.html (sb, esc, fd, modal, closeAll, toast, render, go, SUB,
   FIN_*, chargerFinanceGlobal, bilanSession, editVide, qteKg, fmtQte,
   prixIngredient, PART_PRINCIPALE, motsProduit, chargerProd, STAFF_NOM,
   INGREDIENTS_CACHE, chargerIngredients, isoLocal) et de crm-production.js
   (cpNomClient, cpJ) — chargé après les deux.

   Stockage : supabase/migrations/0021_inventaire_production_reelle_produits.sql.
   Sans elle, chaque écran le dit — et n'écrit rien à moitié.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────── outils ───────────────────────── */
/* Une requête sur une table de 0021 : sans passer par sbTry, qui prendrait une
   table absente pour « natty_crm.sql pas exécuté » et le crierait en bandeau. */
async function prTry(path, opt) {
  try { return { ok: true, data: await sb(path, opt) }; }
  catch (e) { const m = String((e && e.message) || e); return { ok: false, err: m, manque: /PGRST20[45]|42P01|42703|does not exist|Could not find/i.test(m) }; }
}
const PR_SQL = '<span class="mono">supabase/migrations/0021_inventaire_production_reelle_produits.sql</span>';

/* Trois familles d'unités, chacune avec son unité de base : on additionne des
   grammes à des kilos, des ml à des litres — jamais des ml à des grammes. */
function prFamille(u) {
  const x = String(u || 'g').trim().toLowerCase();
  if (x === 'g' || x === 'kg') return 'm';
  if (x === 'ml' || x === 'cl' || x === 'l') return 'v';
  return 'p';
}
function prVersBase(q, u) {
  const x = String(u || 'g').trim().toLowerCase();
  return (+q || 0) * (x === 'kg' || x === 'l' ? 1000 : x === 'cl' ? 10 : 1);
}
const PR_UNITES = { m: ['kg', 'g'], v: ['L', 'ml'], p: ['pièce'] };
const PR_UNITE_STOCK = { m: 'kg', v: 'L', p: 'pièce' };   // l'unité de stocks_mp.unite
function prFmt(q, fam) {
  if (q == null) return '—';
  const r = x => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString('fr-FR');
  if (fam === 'm') return q >= 1000 ? (Math.round(q / 10) / 100).toLocaleString('fr-FR') + ' kg' : r(q) + ' g';
  if (fam === 'v') return q >= 1000 ? (Math.round(q / 10) / 100).toLocaleString('fr-FR') + ' L' : r(q) + ' ml';
  return r(q) + ' pièce' + (q >= 2 ? 's' : '');
}

/* ───────────── 1. La production réelle : calcul pur ─────────────
   `saisie` = crm_sessions.production_reelle (ou l'édition en cours) :
   { recId: { mode:'ingredients'|'global', ings:{aliment:{v,u}}, total:{v,u}, portion:{v,u}, portions } } */
function prBesoins(raw, calc, recId) {
  const pr = calc.parRecette.find(p => p.id === recId), n = pr ? pr.nbPortions : 0;
  const agg = {};
  (calc.detailParRecette[recId] || []).forEach(l => {
    const fam = prFamille(l.unite), cle = l.nom.toLowerCase();
    if (!agg[cle]) {
      const ing = raw.recIngredients.find(i => i.recette_id === recId && String(i.ingredient_nom || '').trim().toLowerCase() === cle);
      agg[cle] = { nom: l.nom, cle, fam, q: 0, tag: (ing && ing.tag) || null };
    }
    if (agg[cle].fam === fam) agg[cle].q += prVersBase(l.q, l.unite);
  });
  return Object.values(agg).filter(i => i.q > 0).map(i => ({ ...i, parPortion: n ? i.q / n : 0 }));
}
function productionReelle(raw, calc, saisie) {
  saisie = saisie || {};
  const recettes = calc.parRecette.map(p => {
    const s = saisie[p.id] || {}, mode = s.mode === 'global' ? 'global' : 'ingredients';
    const besoins = prBesoins(raw, calc, p.id);
    const N = p.nbPortions;
    const base = { recId: p.id, nom: p.nom, demande: N, mode, besoins, manquants: [], nonSaisis: [], decideur: null };
    // Validés à l'assemblage (Production → session → Assemblage) :
    // saisie._faits[recId] = { clients: { bonId: plats faits }, enPlus: n }.
    const fa = saisie._faits && saisie._faits[p.id];
    const faitsAssemblage = fa ? raw.attrs.filter(a => a.recette_id === p.id)
      .reduce((t, a) => t + Math.min(a.nb_portions || 0, Math.max(0, +((fa.clients || {})[a.bon_id]) || 0)), 0) : 0;
    const plusAssemblage = fa ? Math.max(0, +fa.enPlus || 0) : 0;
    // « Déjà produites dans la commande » (demande de Pablo, 28/09) : saisi à
    // la main, sinon les plats validés à l'assemblage. Les ingrédients saisis
    // sont alors le RESTE de la production, pas encore en barquette.
    const dejaSaisi = s.deja != null && s.deja !== '';
    const deja = Math.min(N, Math.max(0, Math.floor(dejaSaisi ? +s.deja : faitsAssemblage)));
    const dejaPlus = plusAssemblage;
    let C = 0, F = 0, extra = {}, saisi = deja > 0 || dejaPlus > 0;
    if (mode === 'global') {
      const portions = s.portions != null && s.portions !== '' ? Math.max(0, Math.floor(+s.portions)) : null;
      const tot = s.total && s.total.v != null && s.total.v !== '' ? { q: prVersBase(s.total.v, s.total.u), fam: prFamille(s.total.u) } : null;
      // La portion servie, saisie dans la même famille d'unités. Jamais déduite de
      // la fiche : 10 L de bourguignon ne se divisent pas par les 150 ml de vin
      // de la fiche, ni par le poids cru de ses ingrédients.
      const porSaisie = s.portion && s.portion.v != null && s.portion.v !== '' && +s.portion.v > 0 ? { q: prVersBase(s.portion.v, s.portion.u), fam: prFamille(s.portion.u) } : null;
      const por = porSaisie && tot && porSaisie.fam === tot.fam ? porSaisie.q : null;
      const calcule = tot && por ? Math.floor(tot.q / por + 1e-9) : null;
      // Un plat entier compte TOUTES ses portions : « déjà produites » ne s'y ajoute pas.
      C = F = portions != null ? portions : (calcule != null ? calcule : 0);
      saisi = portions != null || calcule != null;
      extra = { total: tot, portion: por, calcule };
      return prRepartir({ ...base, ...extra, saisi }, 0, 0, C, F);
    }
    const saisis = besoins.map(b => {
      const e = s.ings && s.ings[b.cle];
      if (!e || e.v == null || e.v === '') { base.nonSaisis.push(b.nom); return null; }
      const q = prFamille(e.u) === b.fam ? prVersBase(e.v, e.u) : null;
      if (q == null) { base.nonSaisis.push(b.nom); return null; }
      return { ...b, prod: q, possible: b.parPortion > 0 ? Math.floor(q / b.parPortion + 1e-9) : Infinity };
    }).filter(Boolean);
    if (saisis.length) {
      // L'aliment principal fixe le nombre de portions faisables : l'étiquette
      // « protéine », sinon les aliments d'au moins 15 % du poids — et parmi eux
      // le PLUS LIMITANT (même règle que « ce que le stock permet » en
      // Assemblage). « Le plus disponible » annonçait 15 poulets-moutarde avec
      // du poulet pour 4, parce que le riz en permettait 15 (capture de Pablo).
      const poids = saisis.filter(i => i.fam !== 'p').reduce((t, i) => t + i.parPortion, 0);
      let principaux = saisis.filter(i => i.tag === 'proteine');
      if (!principaux.length) principaux = saisis.filter(i => i.fam !== 'p' && i.parPortion >= PART_PRINCIPALE * poids);
      if (!principaux.length) principaux = saisis;
      let decideur = principaux[0].nom; F = Infinity;
      principaux.forEach(i => { if (i.possible < F) { F = i.possible; decideur = i.nom; } });
      if (!isFinite(F)) F = 0;
      C = Math.min(F, ...saisis.map(i => i.possible));
      base.manquants = saisis.filter(i => i.possible < F).map(i => ({ nom: i.nom, fam: i.fam, q: F * i.parPortion - i.prod }));
      base.decideur = decideur; base.saisis = saisis; saisi = true;
    } else if (!saisie[p.id] && fa) base.mode = 'assemblage';
    return prRepartir({ ...base, saisi, dejaSaisi, faitsAssemblage }, deja, dejaPlus, C, F);
  });
  const somme = k => recettes.reduce((t, r) => t + (r[k] || 0), 0);
  const sommeDe = (o, k) => recettes.reduce((t, r) => t + (r[o] ? r[o][k] || 0 : 0), 0);
  return { recettes, saisi: recettes.some(r => r.saisi), completes: somme('completes'), aCompleter: somme('aCompleter'), demande: somme('demande'), enPlus: somme('enPlus'), manque: somme('manque'),
    deja: somme('deja'), commande: { pretes: sommeDe('commande', 'pretes'), aCompleter: sommeDe('commande', 'aCompleter') }, surplus: { pretes: sommeDe('surplus', 'pretes'), aCompleter: sommeDe('surplus', 'aCompleter') } };
}
/* La répartition d'une recette entre la commande et le surplus :
   N commandées, D déjà produites pour la commande, P déjà produites en plus
   (assemblage), et, avec le reste de la production, C portions prêtes à faire
   (tous les aliments sont là) et F faisables (dont F − C à compléter).
   La commande est servie d'abord — les prêtes, puis les à compléter — et ce
   qui dépasse part au surplus. */
function prRepartir(r, D, P, C, F) {
  const N = r.demande, reste = Math.max(0, N - D), A = Math.max(0, F - C);
  const pretesCmd = Math.min(C, reste), aCompCmd = Math.min(A, reste - pretesCmd);
  const commande = { deja: D, reste, pretes: pretesCmd, aCompleter: aCompCmd, manque: reste - pretesCmd - aCompCmd };
  const surplus = { deja: P, pretes: P + (C - pretesCmd), aCompleter: A - aCompCmd };
  return { ...r, deja: D, faisable: D + P + F, completes: D + P + C, aCompleter: A, commande, surplus,
    enPlus: r.saisi ? surplus.pretes : 0, manque: r.saisi ? commande.manque : 0 };
}
/* Ce que la production réelle a consommé d'un aliment, en unité de base —
   seulement pour les recettes pesées par ingrédient (un plat entier ne dit pas
   ses ingrédients) : le reste pesé PLUS les portions déjà faites, à la portion
   moyenne de la session. Sert l'inventaire. */
function prConsommeReel(pr) {
  const m = {};
  pr.recettes.forEach(r => (r.saisis || []).forEach(i => { const k = i.cle + '|' + i.fam; m[k] = (m[k] || 0) + i.prod + (r.deja || 0) * i.parPortion; }));
  return m;
}

/* ───────────── 2. La carte d'Opérationnel ───────────── */
let PR_EDIT = null;        // la saisie en cours (copie de production_reelle), null = pas en édition
let PR_OUVERT = false;
function prSaisieCourante() { return PR_EDIT || (FIN_DONNEES && FIN_DONNEES.session.production_reelle) || {}; }
function prCalcul() {
  if (!FIN_DONNEES) return null;
  const b = bilanSession(FIN_DONNEES, FIN_EDIT);
  return { b, pr: productionReelle(FIN_DONNEES, b.calc, prSaisieCourante()) };
}
/* Une recette en une ligne de pastilles : la commande (déjà faites, prêtes à
   faire avec le reste de la production, à compléter, manquent), puis le
   surplus (prêtes, à compléter). Affichée dans le tableau des résultats ET
   sous la saisie de chaque recette, mise à jour à chaque frappe. */
function prSommaireHtml(r) {
  if (!r.saisi) return '<span class="muted" style="font-size:12px">Rien de saisi pour cette recette.</span>';
  const c = r.commande, sp = r.surplus, n = (v, t) => `${v} ${t}`;
  return `<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:12px">
    <b style="font-weight:600">Commande ${r.demande}</b>
    ${c.deja ? `<span class="chip ink">${n(c.deja, 'déjà faite' + (c.deja > 1 ? 's' : ''))}</span>` : ''}
    <span class="chip ok">${n(c.pretes, 'prête' + (c.pretes > 1 ? 's' : '') + ' à faire')}</span>
    ${c.aCompleter ? `<span class="chip warn">${n(c.aCompleter, 'à compléter')}</span>` : ''}
    ${c.manque ? `<span class="chip bad">${n(c.manque, 'manque' + (c.manque > 1 ? 'nt' : ''))}</span>` : ''}
    <b style="font-weight:600;margin-left:8px">Surplus</b>
    <span class="chip vi">${n(sp.pretes, 'prête' + (sp.pretes > 1 ? 's' : ''))}</span>
    ${sp.aCompleter ? `<span class="chip warn">${n(sp.aCompleter, 'à compléter')}</span>` : ''}
  </div>`;
}
function prResultatsHtml(pr) {
  if (!pr.saisi) return `<div class="empty">Rien de saisi : indique ce qui est déjà produit et ce qui reste en cuisine, recette par recette (par ingrédient, ou le plat entier et ses portions) — ou valide les plats dans Production → session → Assemblage.</div>`;
  const aComp = pr.recettes.filter(r => r.saisi && r.aCompleter > 0 && r.manquants.length);
  const sansSaisie = pr.recettes.filter(r => !r.saisi);
  const man = r => r.manquants.map(m => `<span class="chip warn">${esc(m.nom)} −${prFmt(m.q, m.fam)}</span>`).join(' ');
  const cell = (v, coul) => `<td class="num" style="${v && coul ? 'color:' + coul + ';font-weight:600' : ''}">${v || '<span class="muted">0</span>'}</td>`;
  const reste = pr.commande.pretes + pr.commande.aCompleter;
  return `<div class="grid g4" style="margin-bottom:12px">
   <div class="card kpi"><div class="lbl">Déjà produites</div><div class="val">${pr.deja}</div><div class="foot">sur ${pr.demande} commandées</div></div>
   <div class="card kpi"><div class="lbl">Prêtes à faire</div><div class="val" style="color:var(--green)">${pr.commande.pretes}</div><div class="foot">pour la commande, avec le reste de la production</div></div>
   <div class="card kpi"><div class="lbl">À compléter</div><div class="val" style="color:${pr.commande.aCompleter ? 'var(--amber)' : 'inherit'}">${pr.commande.aCompleter}</div><div class="foot">${pr.manque ? `<span style="color:var(--red)">${pr.manque} manque${pr.manque > 1 ? 'nt' : ''} encore</span>` : reste ? 'pour finir la commande' : 'commande couverte'}</div></div>
   <button class="card kpi click" type="button" data-pr-produits><div class="lbl">Surplus</div><div class="val" style="color:var(--violet)">${pr.surplus.pretes}<small style="font-size:14px;color:var(--amber)">${pr.surplus.aCompleter ? ' + ' + pr.surplus.aCompleter + ' à compl.' : ''}</small></div><div class="kpi-go">prêtes, à vendre → Produits</div></button>
  </div>
  <div class="tbl-wrap" style="margin-bottom:14px"><table><thead><tr><th>Recette</th><th>Commandées</th><th>Déjà faites</th><th>Prêtes à faire</th><th>À compléter</th><th>Manquent</th><th>Surplus prêtes</th><th>Surplus à compl.</th></tr></thead><tbody>
  ${pr.recettes.map(r => `<tr><td>${esc(r.nom)}<div class="muted" style="font-size:11px">${!r.saisi ? 'rien de saisi' : r.mode === 'global' ? (r.total ? 'plat entier · ' + prFmt(r.total.q, r.total.fam) + (r.portion ? ' à ' + prFmt(r.portion, r.total.fam) + ' la portion' : '') : 'plat entier · portions comptées') : [r.deja ? (r.dejaSaisi ? r.deja + ' déjà faites (saisi)' : r.deja + ' validées à l’assemblage') : '', r.saisis ? 'reste pesé' + (r.decideur ? ', selon ' + esc(r.decideur) : '') : ''].filter(Boolean).join(' · ')}</div></td>
    <td class="num">${r.demande}</td>${r.saisi ? cell(r.commande.deja, 'var(--ink)') + cell(r.commande.pretes, 'var(--green)') + cell(r.commande.aCompleter, 'var(--amber)') + cell(r.commande.manque, 'var(--red)') + cell(r.surplus.pretes, 'var(--violet)') + cell(r.surplus.aCompleter, 'var(--amber)') : '<td colspan="6" class="muted" style="text-align:center">—</td>'}</tr>`).join('')}
  </tbody></table></div>
  ${aComp.length ? `<h3 style="margin:0 0 8px;font-size:13.5px">À compléter — ce qui manque</h3><div class="list">${aComp.map(r => `<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px"><span>${esc(r.nom)} <span class="muted" style="font-size:11.5px">· ${r.faisable - r.deja} faisables avec le reste selon ${esc(r.decideur || '—')}, ${r.completes - r.deja} prêtes</span></span><span class="chip warn">${r.aCompleter} à compléter</span></div>
    <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:5px"><span class="muted" style="font-size:12px">Il manque :</span>${man(r)}</div>
    <div class="muted" style="font-size:11.5px;margin-top:4px">${r.saisis.map(i => `${esc(i.nom)} ${prFmt(i.prod, i.fam)} → ${i.possible === Infinity ? '∞' : i.possible} portions (${prFmt(i.parPortion, i.fam)} / portion)`).join(' · ')}</div></div>`).join('')}</div>` : ''}
  ${pr.recettes.filter(r => r.saisi && r.saisis && r.nonSaisis.length).map(r => `<p class="muted" style="font-size:11.5px;margin:8px 0 0">${esc(r.nom)} — non pesés, donc non comptés : ${r.nonSaisis.map(esc).join(', ')}.</p>`).join('')}
  ${sansSaisie.length ? `<p class="muted" style="font-size:11.5px;margin:8px 0 0">Sans production saisie : ${sansSaisie.map(r => esc(r.nom)).join(', ')}.</p>` : ''}
  <p class="muted" style="font-size:11.5px;margin:8px 0 0">Prêtes = tous les aliments sont là pour les assembler ; à compléter = l'aliment principal est là, il manque un accompagnement. La commande est servie d'abord (les prêtes, puis les à compléter), le reste part au surplus.</p>`;
}
function prChamp(attrs, v, placeholder, largeur) {
  return `<input class="inp pr-champ" ${attrs} type="number" min="0" step="any" value="${v == null ? '' : esc(v)}" placeholder="${esc(placeholder || '')}" style="width:${largeur || 90}px;display:inline-block;padding:4px 8px">`;
}
function prSelectUnite(attrs, fam, cur) {
  const us = fam ? PR_UNITES[fam] : ['kg', 'g', 'L', 'ml', 'pièce'];
  return `<select class="inp pr-champ" ${attrs} style="width:auto;display:inline-block;padding:4px 6px">${us.map(u => `<option${u === cur ? ' selected' : ''}>${u}</option>`).join('')}</select>`;
}
function prEditionHtml(pr) {
  const s = prSaisieCourante();
  return pr.recettes.map(r => {
    const e = s[r.recId] || {}, mode = r.mode;
    const tete = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:13.5px">${esc(r.nom)} <span class="muted" style="font-weight:400;font-size:12px">· ${r.demande} portion${r.demande > 1 ? 's' : ''} commandée${r.demande > 1 ? 's' : ''}</span></b>
      <div class="seg"><button type="button" data-pr-mode="${r.recId}:ingredients" aria-pressed="${mode !== 'global'}">Par ingrédient</button><button type="button" data-pr-mode="${r.recId}:global" aria-pressed="${mode === 'global'}">Plat entier</button></div></div>`;
    if (mode === 'global') {
      const tu = (e.total && e.total.u) || 'L', pu = (e.portion && e.portion.u) || (prFamille(tu) === 'v' ? 'ml' : prFamille(tu) === 'm' ? 'g' : 'pièce');
      return `<div class="card" style="margin-bottom:10px">${tete}
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;font-size:12.5px">
         <label>Quantité produite<br>${prChamp(`data-pr-rec="${r.recId}" data-pr-k="total.v"`, e.total && e.total.v, 'ex. 10')} ${prSelectUnite(`data-pr-rec="${r.recId}" data-pr-k="total.u"`, null, tu)}</label>
         <label>Portion servie<br>${prChamp(`data-pr-rec="${r.recId}" data-pr-k="portion.v"`, e.portion && e.portion.v, pu === 'ml' ? 'ex. 330' : pu === 'g' ? 'ex. 350' : 'ex. 1')} ${prSelectUnite(`data-pr-rec="${r.recId}" data-pr-k="portion.u"`, prFamille(tu), pu)}</label>
         <label>Portions obtenues<br>${prChamp(`data-pr-rec="${r.recId}" data-pr-k="portions"`, e.portions, r.calcule != null ? String(r.calcule) : 'ex. 30', 80)}</label>
        </div>
        <p class="muted" style="font-size:11.5px;margin:6px 0 0">Les portions obtenues, si tu les comptes, l'emportent ; sinon quantité produite ÷ portion servie. Un plat entier compte toutes ses portions comme prêtes.</p>
        <div id="prSum-${r.recId}" style="margin-top:10px">${prSommaireHtml(r)}</div></div>`;
    }
    return `<div class="card" style="margin-bottom:10px">${tete}
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:12.5px;margin-bottom:8px"><label>Déjà produites dans la commande ${prChamp(`data-pr-rec="${r.recId}" data-pr-k="deja"`, e.deja, r.faitsAssemblage ? String(r.faitsAssemblage) : '0', 70)} / ${r.demande}</label>
       <span class="muted" style="font-size:11.5px">${r.faitsAssemblage && (e.deja == null || e.deja === '') ? r.faitsAssemblage + ' validées à l’assemblage — ' : ''}les quantités ci-dessous = le reste de la production, pas encore en barquette</span></div>
      ${r.besoins.length ? `<div class="tbl-wrap"><table><thead><tr><th>Aliment</th><th>Prévu / portion</th><th>Prévu pour ${r.demande}</th><th>Produit</th></tr></thead><tbody>${r.besoins.map(b => {
        const v = e.ings && e.ings[b.cle];
        return `<tr><td>${esc(b.nom)}${b.tag === 'proteine' ? ' <span class="chip info">protéine</span>' : ''}</td><td class="num">${prFmt(b.parPortion, b.fam)}</td><td class="num">${prFmt(b.q, b.fam)}</td>
          <td class="num" style="white-space:nowrap">${prChamp(`data-pr-rec="${r.recId}" data-pr-ing="${esc(b.cle)}" data-pr-k="v"`, v && v.v, '')} ${prSelectUnite(`data-pr-rec="${r.recId}" data-pr-ing="${esc(b.cle)}" data-pr-k="u"`, b.fam, (v && v.u) || PR_UNITES[b.fam][0])}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="muted" style="font-size:12px">Aucun ingrédient chiffré dans la fiche — passe en « Plat entier ».</div>'}
      <div id="prSum-${r.recId}" style="margin-top:10px">${prSommaireHtml(r)}</div></div>`;
  }).join('') + `<p class="muted" style="font-size:11.5px;margin:4px 0 0">Enregistré à la sortie de chaque champ. Prévu par portion = la moyenne de la session (fiche × coefficients), pas le grammage de chaque client. Case vide = aliment non pesé, ni manquant ni limitant.</p>`;
}
function prCarteHtml() {
  const c = prCalcul(); if (!c) return '';
  const se = FIN_DONNEES.session, colonne = Object.prototype.hasOwnProperty.call(se, 'production_reelle');
  return `<div class="card" style="margin-bottom:16px" id="prCarte">
   <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0;font-size:14px">Portions réellement réalisées</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" type="button" data-pr-inventaire>📋 Inventaire de fin de session${se.inventaire_le ? ' ✓' : ''}</button><button class="btn sm ${PR_OUVERT ? '' : 'primary'}" type="button" data-pr-ouvrir>${PR_OUVERT ? 'Fermer la saisie' : '✎ Saisir la production réelle'}</button></div></div>
   ${colonne ? '' : `<div class="exbar"><span class="chip bad">SQL</span><span>La colonne <span class="mono">crm_sessions.production_reelle</span> n'existe pas encore — exécuter ${PR_SQL}. Rien ne sera enregistré d'ici là.</span></div>`}
   ${se.inventaire_le ? `<p class="muted" style="font-size:12px;margin:0 0 10px">Inventaire fait le ${new Date(se.inventaire_le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</p>` : ''}
   <div id="prRes">${prResultatsHtml(c.pr)}</div>
   ${PR_OUVERT ? `<div style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px" id="prEdit">${prEditionHtml(c.pr)}</div>` : ''}
  </div>`;
}
/* Réécrit les résultats seulement : les champs gardent le focus. */
function prRafraichir(tout) {
  const c = prCalcul(); if (!c) return;
  const res = document.getElementById('prRes'); if (res) res.innerHTML = prResultatsHtml(c.pr);
  c.pr.recettes.forEach(r => { const el = document.getElementById('prSum-' + r.recId); if (el) el.innerHTML = prSommaireHtml(r); });
  if (tout) { const car = document.getElementById('prCarte'); if (car) car.outerHTML = prCarteHtml(); }
}
function prLireChamp(inp) {
  if (!PR_EDIT) PR_EDIT = JSON.parse(JSON.stringify((FIN_DONNEES && FIN_DONNEES.session.production_reelle) || {}));
  const rec = inp.dataset.prRec, k = inp.dataset.prK, ing = inp.dataset.prIng;
  const e = PR_EDIT[rec] || (PR_EDIT[rec] = { mode: 'ingredients' });
  const val = inp.tagName === 'SELECT' ? inp.value : (inp.value === '' ? null : +inp.value);
  if (ing) {
    e.ings = e.ings || {};
    const x = e.ings[ing] || (e.ings[ing] = {});
    x[k] = val;
    if (k === 'v' && x.u == null) { const sel = document.querySelector(`select[data-pr-rec="${rec}"][data-pr-ing="${CSS.escape(ing)}"]`); if (sel) x.u = sel.value; }
  } else if (k === 'portions' || k === 'deja') e[k] = val;
  else { const [o, p] = k.split('.'); e[o] = e[o] || {}; e[o][p] = val;
    if (p === 'v' && e[o].u == null) { const sel = document.querySelector(`select[data-pr-rec="${rec}"][data-pr-k="${o}.u"]`); if (sel) e[o].u = sel.value; } }
}
async function prEnregistrer() {
  if (!FIN_DONNEES || !PR_EDIT) return;
  const r = await prTry('crm_sessions?id=eq.' + FIN_SESSION, { method: 'PATCH', body: JSON.stringify({ production_reelle: PR_EDIT }) });
  if (!r.ok) { toast(r.manque ? 'Colonne production_reelle absente — exécuter la migration 0021' : 'Échec de l’enregistrement'); return; }
  FIN_DONNEES.session.production_reelle = JSON.parse(JSON.stringify(PR_EDIT));
}
document.addEventListener('input', e => { if (e.target.matches('.pr-champ') && e.target.tagName !== 'SELECT') { prLireChamp(e.target); prRafraichir(); } });
document.addEventListener('change', async e => {
  if (!e.target.matches('.pr-champ')) return;
  prLireChamp(e.target);
  // Changer une unité change la famille des champs voisins (plat entier) : on redessine tout.
  if (e.target.tagName === 'SELECT' && e.target.dataset.prK === 'total.u') { const x = PR_EDIT[e.target.dataset.prRec], fam = prFamille(e.target.value); if (x.portion) x.portion.u = fam === 'v' ? 'ml' : fam === 'm' ? 'g' : 'pièce'; prRafraichir(true); }
  else prRafraichir();
  await prEnregistrer();
});
document.addEventListener('click', async e => {
  if (e.target.closest('[data-pr-ouvrir]')) { PR_OUVERT = !PR_OUVERT; prRafraichir(true); return; }
  const m = e.target.closest('[data-pr-mode]');
  if (m) {
    const [rec, mode] = m.dataset.prMode.split(':');
    if (!PR_EDIT) PR_EDIT = JSON.parse(JSON.stringify((FIN_DONNEES && FIN_DONNEES.session.production_reelle) || {}));
    (PR_EDIT[rec] || (PR_EDIT[rec] = {})).mode = mode;
    prRafraichir(true); await prEnregistrer(); return;
  }
  if (e.target.closest('[data-pr-produits]')) { SUB['vue-financement'] = 'produits'; FIN_DETAIL = null; go('financement'); return; }
  if (e.target.closest('[data-pr-inventaire]')) { ouvrirInventaire(FIN_SESSION); return; }
  const inv = e.target.closest('[data-inventaire-session]'); if (inv) { ouvrirInventaire(inv.dataset.inventaireSession || null); return; }
});

/* ───────────── 3. L'inventaire de fin de session ─────────────
   Toutes les matières alimentaires : celles en stock, celles de la session
   (fiches), celles achetées pour elle. Pour chacune : le stock d'avant, ce
   qui a été acheté, ce qui a été utilisé (le réel saisi par ingrédient,
   sinon le prévu), l'attendu — et la case « compté ». Seul le compté est
   écrit : c'est le stock, désormais. */
function prLignesInventaire(raw, stocks) {
  const b = bilanSession(raw, editVide());
  const pr = productionReelle(raw, b.calc, raw.session.production_reelle);
  const reel = prConsommeReel(pr);
  const L = {};
  const ligne = (nom, fam) => { const k = nom.trim().toLowerCase() + '|' + fam; return L[k] || (L[k] = { nom: nom.trim(), cle: nom.trim().toLowerCase(), fam, stock: 0, lignesStock: [], achete: null, prevu: 0, reel: null }); };
  stocks.forEach(s => { const u = s.unite || 'kg', fam = u === 'kg' ? 'm' : u === 'L' ? 'v' : 'p'; const l = ligne(s.ingredient_nom || '?', fam); l.stock += prVersBase(+s.quantite_kg || 0, u === 'pièce' ? 'pièce' : u); l.lignesStock.push(s); });
  b.calc.lignesIngredients.forEach(i => { if (!(i.q > 0)) return; const fam = prFamille(i.unite); ligne(i.nom, fam).prevu += prVersBase(i.q, i.unite); });
  if (b.rappro) Object.values(b.rappro.achatParIngredient).forEach(a => { if (a.qKg > 0) { const l = ligne(a.nom, 'm'); l.achete = (l.achete || 0) + a.qKg * 1000; } });
  Object.values(L).forEach(l => {
    if (reel[l.cle + '|' + l.fam] != null) l.reel = reel[l.cle + '|' + l.fam];
    l.utilise = l.reel != null ? l.reel : l.prevu;
    l.attendu = Math.max(0, l.stock + (l.achete || 0) - l.utilise);
  });
  return Object.values(L).sort((a, c) => a.nom.localeCompare(c.nom, 'fr'));
}
let INV = null;   // { sessionId, raw, lignes, stocks, uniteOk }
async function ouvrirInventaire(sessionId) {
  if (!FIN_GLOBAL || !FIN_GLOBAL.rawParSession) FIN_GLOBAL = await chargerFinanceGlobal();
  const auj = isoLocal(new Date());
  const sessions = FIN_GLOBAL.sessions || [];
  if (!sessions.length) { toast('Aucune session de production'); return; }
  // Par défaut : la dernière session déjà passée (ou du jour) — c'est après elle qu'on compte.
  if (!sessionId || !FIN_GLOBAL.rawParSession[sessionId]) sessionId = (sessions.find(s => s.jour <= auj) || sessions[0]).id;
  const raw = FIN_GLOBAL.rawParSession[sessionId];
  const st = await prTry('stocks_mp?statut=eq.disponible&select=*&order=date_peremption.asc.nullslast');
  if (!st.ok) { toast('Stocks illisibles'); return; }
  await chargerIngredients();
  const uniteOk = !st.data.length || Object.prototype.hasOwnProperty.call(st.data[0], 'unite') || null;   // null = inconnu (aucune ligne)
  INV = { sessionId, raw, stocks: st.data, lignes: prLignesInventaire(raw, st.data), uniteOk, ajouts: [] };
  $('#modal').classList.add('large');
  modal(prInventaireHtml());
}
function prInventaireHtml() {
  const { raw, lignes } = INV, se = raw.session;
  const opts = FIN_GLOBAL.sessions.map(s => `<option value="${s.id}"${s.id === INV.sessionId ? ' selected' : ''}>${fd(s.jour)}${s.inventaire_le ? ' ✓ inventaire fait' : ''}</option>`).join('');
  const u = l => PR_UNITE_STOCK[l.fam];
  const enUnite = (q, fam) => q == null ? null : fam === 'p' ? q : q / 1000;
  const num = (q, fam) => q == null ? '<span class="muted">—</span>' : prFmt(q, fam);
  return `<h2>Inventaire de fin de session</h2>
  <p class="muted" style="margin:-2px 0 10px;font-size:12.5px">Compte ce qui reste physiquement, aliment par aliment. Le compté <b>remplace</b> le stock de l'aliment (les lots les plus proches de la péremption sont consommés en premier ; un surplus devient un lot « inventaire »). Case vide = aliment non compté, stock inchangé.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><label class="muted" style="font-size:12.5px">Session <select class="inp" id="invSession" style="width:auto;display:inline-block;padding:4px 8px">${opts}</select></label>
   <span style="margin-left:auto;display:flex;gap:6px"><button class="btn sm ghost" type="button" id="invAttendu">Reporter l'attendu dans les cases vides</button></span></div>
  ${INV.uniteOk === false ? `<div class="exbar"><span class="chip warn">SQL</span><span>Sans ${PR_SQL}, seuls les aliments comptés en kg sont écrits dans le stock (la colonne <span class="mono">stocks_mp.unite</span> manque).</span></div>` : ''}
  ${se.inventaire_le ? `<div class="exbar" style="border-color:var(--blue);color:var(--blue);background:var(--blue-bg)"><span class="chip info">déjà fait</span><span>Un inventaire a été enregistré pour cette session le ${new Date(se.inventaire_le).toLocaleString('fr-FR')}. Le refaire réécrit le stock avec les nouveaux comptes.</span></div>` : ''}
  <div class="tbl-wrap" style="max-height:52vh;overflow:auto"><table><thead><tr><th>Aliment</th><th>En stock</th><th>Acheté</th><th>Utilisé</th><th>Attendu</th><th>Compté</th><th>Écart</th></tr></thead><tbody>
  ${lignes.map((l, i) => `<tr><td>${esc(l.nom)}</td><td class="num">${num(l.stock || null, l.fam)}</td><td class="num">${num(l.achete, l.fam)}</td>
    <td class="num">${num(l.utilise || null, l.fam)}${l.utilise ? `<div class="muted" style="font-size:10.5px">${l.reel != null ? 'réel saisi' : 'prévu'}</div>` : ''}</td>
    <td class="num"><b>${prFmt(l.attendu, l.fam)}</b></td>
    <td class="num" style="white-space:nowrap"><input class="inp inv-compte" data-inv="${i}" type="number" min="0" step="any" placeholder="${esc(String(Math.round(enUnite(l.attendu, l.fam) * 1000) / 1000))}" style="width:90px;display:inline-block;padding:4px 8px"> ${u(l)}</td>
    <td class="num" data-inv-ecart="${i}">—</td></tr>`).join('')}
  ${INV.ajouts.map((a, j) => `<tr><td><input class="inp inv-ajout-nom" data-inv-aj="${j}" list="invIngListe" value="${esc(a.nom)}" placeholder="Aliment" style="min-width:140px"></td><td colspan="4" class="muted" style="font-size:11.5px">aliment ajouté à la main</td>
    <td class="num" style="white-space:nowrap"><input class="inp inv-ajout-q" data-inv-aj="${j}" type="number" min="0" step="any" value="${a.q ?? ''}" style="width:90px;display:inline-block;padding:4px 8px"> <select class="inp inv-ajout-u" data-inv-aj="${j}" style="width:auto;display:inline-block;padding:4px 6px">${['kg', 'L', 'pièce'].map(x => `<option${x === a.u ? ' selected' : ''}>${x}</option>`).join('')}</select></td><td></td></tr>`).join('')}
  </tbody></table></div>
  <datalist id="invIngListe">${(INGREDIENTS_CACHE || []).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
  <div style="margin-top:8px"><button class="btn sm ghost" type="button" id="invAjout">+ Un aliment qui n'est pas dans la liste</button></div>
  <p class="muted" style="font-size:11.5px;margin:8px 0 0">Attendu = en stock + acheté pour la session (pièces MP, en kg) − utilisé (la production réelle saisie par ingrédient, sinon le prévu des fiches). C'est un repère : le compté fait foi. Écart = compté − attendu.</p>
  <div class="foot" style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" type="button" data-close>Fermer</button><button class="btn primary" type="button" id="invValider">Enregistrer l'inventaire et mettre à jour les stocks</button></div>`;
}
function prMajEcarts() {
  document.querySelectorAll('.inv-compte').forEach(inp => {
    const l = INV.lignes[+inp.dataset.inv], cell = document.querySelector(`[data-inv-ecart="${inp.dataset.inv}"]`); if (!cell) return;
    if (inp.value === '') { cell.textContent = '—'; cell.style.color = ''; return; }
    const compte = l.fam === 'p' ? +inp.value : +inp.value * 1000, d = compte - l.attendu;
    cell.textContent = (d >= 0 ? '+' : '−') + prFmt(Math.abs(d), l.fam); cell.style.color = Math.abs(d) < 1e-6 ? '' : d > 0 ? 'var(--green)' : 'var(--red)';
  });
}
document.addEventListener('input', e => {
  if (e.target.matches('.inv-compte')) prMajEcarts();
  if (e.target.matches('.inv-ajout-nom,.inv-ajout-q')) { const a = INV.ajouts[+e.target.dataset.invAj]; if (e.target.matches('.inv-ajout-nom')) a.nom = e.target.value; else a.q = e.target.value === '' ? null : +e.target.value; }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'invSession') { ouvrirInventaire(e.target.value); return; }
  if (e.target.matches('.inv-ajout-u')) INV.ajouts[+e.target.dataset.invAj].u = e.target.value;
});
document.addEventListener('click', async e => {
  if (!INV) return;
  if (e.target.id === 'invAttendu') { document.querySelectorAll('.inv-compte').forEach(inp => { if (inp.value === '') inp.value = inp.placeholder; }); prMajEcarts(); return; }
  if (e.target.id === 'invAjout') {
    const comptes = [...document.querySelectorAll('.inv-compte')].map(i => i.value);
    INV.ajouts.push({ nom: '', q: null, u: 'kg' }); $('#modal').innerHTML = prInventaireHtml();
    document.querySelectorAll('.inv-compte').forEach((i, k) => { i.value = comptes[k] || ''; }); prMajEcarts(); return;
  }
  if (e.target.id === 'invValider') { await enregistrerInventaire(e.target); return; }
});
/* Le stock d'un aliment devient le compté : on retire l'excédent des lots les
   plus proches de la péremption (un lot vidé passe « épuisé »), ou on ajoute
   la différence en un lot « inventaire ». */
async function prEcrireStock(nom, unite, compte, lignesStock, lot, uniteOk) {
  const total = lignesStock.reduce((t, s) => t + (+s.quantite_kg || 0), 0);
  if (Math.abs(compte - total) < 1e-9) return;
  if (compte < total) {
    let aRetirer = total - compte;
    for (const s of lignesStock) {
      if (aRetirer <= 1e-9) break;
      const q = +s.quantite_kg || 0, pris = Math.min(q, aRetirer);
      aRetirer -= pris;
      await sb('stocks_mp?id=eq.' + s.id, { method: 'PATCH', body: JSON.stringify(q - pris <= 1e-9 ? { quantite_kg: 0, statut: 'epuise' } : { quantite_kg: Math.round((q - pris) * 1000) / 1000 }) });
    }
  } else {
    const row = { ingredient_nom: nom, quantite_kg: Math.round((compte - total) * 1000) / 1000, statut: 'disponible', lot, temperature_stockage: (lignesStock[0] && lignesStock[0].temperature_stockage) || null };
    if (uniteOk !== false) row.unite = unite;
    await sb('stocks_mp', { method: 'POST', body: JSON.stringify(row) });
  }
}
async function enregistrerInventaire(btn) {
  const comptes = [];
  document.querySelectorAll('.inv-compte').forEach(inp => { if (inp.value !== '') comptes.push({ l: INV.lignes[+inp.dataset.inv], v: Math.max(0, +inp.value) }); });
  INV.ajouts.filter(a => a.nom.trim() && a.q != null).forEach(a => {
    const fam = a.u === 'kg' ? 'm' : a.u === 'L' ? 'v' : 'p';
    const exist = INV.lignes.find(l => l.cle === a.nom.trim().toLowerCase() && l.fam === fam);
    comptes.push({ l: exist || { nom: a.nom.trim(), cle: a.nom.trim().toLowerCase(), fam, stock: 0, lignesStock: [], achete: null, utilise: 0, attendu: 0 }, v: Math.max(0, a.q) });
  });
  if (!comptes.length) { toast('Aucun aliment compté'); return; }
  // La colonne `unite` absente : seuls les kilos peuvent s'écrire sans mentir.
  let uniteOk = INV.uniteOk;
  if (uniteOk == null) { const t = await prTry('stocks_mp?select=unite&limit=1'); uniteOk = t.ok; }
  const ecrits = uniteOk ? comptes : comptes.filter(c => c.l.fam === 'm');
  const ignores = comptes.length - ecrits.length;
  if (!confirm(`Mettre à jour le stock de ${ecrits.length} aliment(s) avec les quantités comptées ?${ignores ? `\n\n${ignores} aliment(s) en litres ou en pièces ne seront pas écrits : la colonne stocks_mp.unite manque (migration 0021).` : ''}`)) return;
  btn.disabled = true;
  const se = INV.raw.session, lot = 'inventaire-' + se.jour, par = STAFF_NOM || null;
  try {
    for (const c of ecrits) {
      const unite = PR_UNITE_STOCK[c.l.fam];
      await prEcrireStock(c.l.nom, unite, c.v, c.l.lignesStock, lot, uniteOk);
    }
    const hist = ecrits.map(c => { const k = q => q == null ? null : c.l.fam === 'p' ? q : Math.round(q) / 1000; return { session_id: se.id, ingredient_nom: c.l.nom, unite: PR_UNITE_STOCK[c.l.fam], stock_avant: k(c.l.stock), achete: k(c.l.achete), utilise: k(c.l.utilise), attendu: k(c.l.attendu), compte: c.v, par }; });
    const h = await prTry('crm_session_inventaire', { method: 'POST', body: JSON.stringify(hist) });
    const quand = new Date().toISOString();
    const s2 = await prTry('crm_sessions?id=eq.' + se.id, { method: 'PATCH', body: JSON.stringify({ inventaire_le: quand }) });
    if (s2.ok) se.inventaire_le = quand;
    toast('Stock mis à jour — ' + ecrits.length + ' aliment(s)' + (h.ok ? '' : ' (historique non gardé : migration 0021 à exécuter)'));
  } catch (err) { toast('Échec : ' + String(err.message || err).slice(0, 120)); btn.disabled = false; return; }
  INV = null; closeAll(); render();
}

/* ───────────── 4. Les plats assignés, et leur pastille ───────────── */
let PLATS_CACHE = null, PLATS_MANQUE = false;
async function chargerPlats(force) {
  if (PLATS_CACHE && !force) return PLATS_CACHE;
  const r = await prTry('crm_plats?select=*&order=numero.asc');
  PLATS_MANQUE = !r.ok && r.manque;
  PLATS_CACHE = r.ok ? r.data : [];
  return PLATS_CACHE;
}
const platsDuBon = bonId => (PLATS_CACHE || []).filter(p => p.bon_id === bonId);
function platPastille(p) {
  return `<span class="plat-pastille" title="${esc((p.recette_nom || 'Plat') + ' — déjà produit' + (p.produit_le ? ' le ' + fd(p.produit_le) : '') + ', assigné à cette commande')}"><i></i>${esc(p.code || (p.prefixe + p.numero))}</span>`;
}
function platsPastillesHtml(bonId) {
  const ps = platsDuBon(bonId); if (!ps.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:5px">${ps.map(platPastille).join('')}<span class="muted" style="font-size:11.5px">déjà produit${ps.length > 1 ? 's' : ''}, rien à cuisiner</span></div>`;
}
/* « Curry de poulet » → « curry » ; « Bœuf bourguignon » → « boeuf ». */
function prefixePlat(nom) {
  const m = motsProduit(nom);
  return (m[0] || 'plat').replace(/[^a-z]/g, '').slice(0, 12) || 'plat';
}

/* ───────────── 5. Financement → Produits ───────────── */
function prProduitsDisponibles(global, plats) {
  const dispo = [], aCompleter = [], sansSaisie = [];
  const auj = isoLocal(new Date());
  global.sessions.forEach(s => {
    const raw = global.rawParSession[s.id]; if (!raw) return;
    if (!s.production_reelle || !Object.keys(s.production_reelle).length) { if (s.jour <= auj) sansSaisie.push(s); return; }
    const b = bilanSession(raw, editVide()), pr = productionReelle(raw, b.calc, s.production_reelle);
    pr.recettes.forEach(r => {
      if (!r.saisi) return;
      const assignes = plats.filter(p => p.session_id === s.id && p.recette_id === r.recId);
      if (r.enPlus || assignes.length) dispo.push({ session: s, rec: r, enPlus: r.enPlus, assignes: assignes.length, dispo: Math.max(0, r.enPlus - assignes.length) });
      if (r.surplus && r.surplus.aCompleter) aCompleter.push({ session: s, rec: r });
    });
  });
  return { dispo, aCompleter, sansSaisie };
}
/* L'onglet « Disponibles à la vente » de Produits. FIN_GLOBAL et les plats
   sont chargés par vFinanceProduits (assets/crm-marges.js), qui porte les onglets. */
async function prVueDisponibles() {
  const plats = PLATS_CACHE || [];
  const E = await chargerProd();
  const { dispo, aCompleter, sansSaisie } = prProduitsDisponibles(FIN_GLOBAL, plats);
  const colonne = FIN_GLOBAL.sessions.length && Object.prototype.hasOwnProperty.call(FIN_GLOBAL.sessions[0], 'production_reelle');
  const bonDe = id => E && E.bons.find(b => b.id === id);
  const jPlus = j => { const n = Math.round((new Date(isoLocal(new Date()) + 'T00:00:00') - new Date(j + 'T00:00:00')) / 864e5); return n <= 0 ? 'du jour' : 'J+' + n; };
  const totDispo = dispo.reduce((t, d) => t + d.dispo, 0), totAc = aCompleter.reduce((t, d) => t + d.rec.surplus.aCompleter, 0);
  return `<div id="prodRoot">
  ${!colonne || PLATS_MANQUE ? `<div class="exbar"><span class="chip bad">SQL</span><span>Tables de la production réelle absentes — exécuter ${PR_SQL}.</span></div>` : ''}
  <div class="grid g3" style="margin-bottom:16px">
   <div class="card kpi"><div class="lbl">Disponibles à la vente</div><div class="val" style="color:var(--violet)">${totDispo}</div><div class="foot">plats complets faits en plus des commandes</div></div>
   <div class="card kpi"><div class="lbl">À compléter</div><div class="val" style="color:${totAc ? 'var(--amber)' : 'inherit'}">${totAc}</div><div class="foot">pas vendables tant qu'il manque un aliment</div></div>
   <div class="card kpi"><div class="lbl">Assignés</div><div class="val">${plats.length}</div><div class="foot">numérotés, rattachés à une commande</div></div>
  </div>
  <div class="sect"><h2>Disponibles à la vente</h2><span>${totDispo}</span></div>
  ${dispo.filter(d => d.dispo > 0).length ? `<div class="grid g2" style="margin-bottom:16px">${dispo.filter(d => d.dispo > 0).map(d => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>${esc(d.rec.nom)}</b><div class="muted" style="font-size:12px;margin-top:2px">session du ${fd(d.session.jour)} · ${jPlus(d.session.jour)} · ${d.enPlus} en plus${d.assignes ? `, ${d.assignes} déjà assigné${d.assignes > 1 ? 's' : ''}` : ''}</div></div><span class="chip vi">${d.dispo} dispo</span></div>
    <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sm ghost" type="button" data-fin-voir-session="${d.session.id}">Session →</button><button class="btn sm primary" type="button" data-plat-assigner="${d.session.id}:${d.rec.recId}">Assigner à une commande →</button></div></div>`).join('')}</div>`
    : `<div class="empty" style="margin-bottom:16px">Aucun plat en plus${sansSaisie.length ? ' pour l\'instant — la production réelle n\'est saisie pour aucune session récente' : ''}. Les plats en plus viennent de la production réelle : validés dans Production → session → Assemblage (compteur « en plus »), ou saisis dans Opérationnel (page d'une session). L'inventaire seul ne crée pas de plats : il dit ce que le stock permet encore de faire (affiché dans Assemblage).</div>`}
  ${aCompleter.length ? `<div class="sect"><h2>À compléter</h2><span>${totAc}</span></div><div class="list" style="margin-bottom:16px">${aCompleter.map(d => `<div class="li" style="display:block"><div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(d.rec.nom)} <span class="muted" style="font-size:12px">· session du ${fd(d.session.jour)}</span></span><span class="chip warn">${d.rec.surplus.aCompleter} à compléter en surplus</span></div><div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:5px">${d.rec.manquants.map(m => `<span class="chip warn">${esc(m.nom)} −${prFmt(m.q, m.fam)}</span>`).join('')}</div></div>`).join('')}</div>` : ''}
  <div class="sect"><h2>Plats assignés</h2><span>${plats.length}</span></div>
  ${plats.length ? `<div class="tbl-wrap"><table><thead><tr><th>Plat</th><th>Recette</th><th>Produit le</th><th>Commande</th><th>Livraison</th><th>À la place de</th><th></th></tr></thead><tbody>${plats.slice().reverse().map(p => { const b = bonDe(p.bon_id); const recR = p.remplace_recette_id && E ? (E.recettes.find(r => r.id === p.remplace_recette_id) || {}).nom : null; return `<tr>
    <td>${platPastille(p)}</td><td>${esc(p.recette_nom || '—')}</td><td>${p.produit_le ? fd(p.produit_le) : '—'}</td>
    <td>${b ? esc(cpNomClient(b)) : '<span class="muted">commande introuvable</span>'}${b && b.statut === 'livre' ? ' <span class="chip ok">livrée</span>' : ''}</td><td>${b && b.jour_livraison ? fd(b.jour_livraison) : '—'}</td>
    <td class="muted" style="font-size:12px">${p.remplace === 'attribution' ? 'une portion de ' + esc(recR || 'sa recette') : p.remplace === 'libre' ? 'un repas non attribué' : 'un repas en plus'}</td>
    <td>${b && b.statut === 'livre' ? '' : `<button class="btn sm ghost" type="button" data-plat-retirer="${p.id}" title="Retirer le plat de la commande (la portion redevient à produire)">×</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Aucun plat assigné.</div>'}
  <p class="muted" style="font-size:12px;margin-top:10px">Un plat en plus = une portion complète au-delà des portions commandées de sa recette, dans la session. L'assigner lui donne un numéro (« curry266 ») : la pastille apparaît sur la commande (Production → Commandes) et dans la session qui la produit, et la portion qu'il remplace n'est plus à produire — ni ses matières dans la liste de courses.</p>
  </div>`;
}
document.addEventListener('click', async e => {
  const vs = e.target.closest('[data-fin-voir-session]');
  if (vs) { SUB['vue-financement'] = 'operationnel'; FIN_DETAIL = { kind: 'session', id: vs.dataset.finVoirSession }; go('financement'); return; }
  const as = e.target.closest('[data-plat-assigner]'); if (as) { const [sid, rid] = as.dataset.platAssigner.split(':'); ouvrirAssignation(sid, rid); return; }
  const rt = e.target.closest('[data-plat-retirer]'); if (rt) { await retirerPlat(rt.dataset.platRetirer); return; }
});

/* L'assignation : une commande, un nombre de plats, et ce que chaque plat
   remplace dans la commande — une portion d'une recette attribuée (elle
   n'est plus à produire), un repas pas encore attribué, ou un repas de plus. */
async function ouvrirAssignation(sessionId, recId) {
  const plats = await chargerPlats(true);
  if (PLATS_MANQUE) { toast('Table crm_plats absente — exécuter la migration 0021'); return; }
  const E = await chargerProd(true);
  if (!E) { toast('Commandes illisibles'); return; }
  $('#modal').classList.remove('large');
  const { dispo } = prProduitsDisponibles(FIN_GLOBAL, plats);
  const d = dispo.find(x => x.session.id === sessionId && x.rec.recId === recId);
  if (!d || d.dispo <= 0) { toast('Plus aucun plat disponible pour cette recette'); render(); return; }
  const source = new Set((FIN_GLOBAL.rawParSession[sessionId] || { bons: [] }).bons.map(b => b.id));
  const cibles = E.bons.filter(b => b.statut !== 'livre' && b.statut !== 'annule' && !source.has(b.id))
    .sort((a, b) => (a.jour_livraison || '9999').localeCompare(b.jour_livraison || '9999'));
  if (!cibles.length) { toast('Aucune commande en cours à qui assigner ce plat'); return; }
  const lib = b => `${cpNomClient(b)} — ${b.jour_livraison ? 'livraison ' + fd(b.jour_livraison) : 'sans date'} · ${b.nb_repas} repas`;
  const defaut = (cibles.find(b => E.attribs.some(a => a.bon_id === b.id && a.recette_id === recId)) || cibles[0]).id;
  modal(`<h2>Assigner ${esc(d.rec.nom)}</h2>
  <p class="muted" style="margin:-2px 0 10px;font-size:12.5px">Produit le ${fd(d.session.jour)} · ${d.dispo} disponible${d.dispo > 1 ? 's' : ''}. Chaque plat reçoit un numéro (« ${esc(prefixePlat(d.rec.nom))}… »).</p>
  <form class="form" id="asForm">
   <label>Commande<select id="asBon">${cibles.map(b => `<option value="${b.id}"${b.id === defaut ? ' selected' : ''}>${esc(lib(b))}</option>`).join('')}</select></label>
   <div class="two"><label>Nombre de plats<input class="inp" id="asNb" type="number" min="1" max="${d.dispo}" value="1"></label><label>À la place de<select id="asRemplace"></select></label></div>
   <p class="muted" id="asAide" style="font-size:12px;margin:0"></p>
   <div class="foot"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary" type="submit">Assigner</button></div>
  </form>`);
  const options = () => {
    const bon = E.bons.find(b => b.id === $('#asBon').value), att = E.attribs.filter(a => a.bon_id === bon.id);
    const pa = att.reduce((t, a) => t + (a.nb_portions || 0), 0) + platsDuBon(bon.id).length;
    const o = att.map(a => [`attribution:${a.recette_id}`, `une portion de ${((E.recettes.find(r => r.id === a.recette_id) || {}).nom || 'Recette')} (${a.nb_portions} attribuée${a.nb_portions > 1 ? 's' : ''})`, a.recette_id === recId]);
    o.sort((x, y) => (y[2] ? 1 : 0) - (x[2] ? 1 : 0));
    if (pa < bon.nb_repas) o.push(['libre', `un repas pas encore attribué (${bon.nb_repas - pa} libre${bon.nb_repas - pa > 1 ? 's' : ''})`]);
    o.push(['en_plus', 'un repas de plus (la commande passe à ' + (bon.nb_repas + 1) + ' repas)']);
    $('#asRemplace').innerHTML = o.map(x => `<option value="${x[0]}">${esc(x[1])}</option>`).join('');
    aide();
  };
  const aide = () => { const v = $('#asRemplace').value; $('#asAide').textContent = v.startsWith('attribution') ? 'La portion remplacée n’est plus à produire : elle sort du planning, des fiches et de la liste de courses de la session qui produit cette commande.' : v === 'libre' ? 'Le plat occupe un repas que la commande n’avait pas encore attribué.' : 'Le repas est ajouté à la commande (et à son chiffre d’affaires).'; };
  $('#asBon').addEventListener('change', options); $('#asRemplace').addEventListener('change', aide); options();
  $('#asForm').onsubmit = async ev => {
    ev.preventDefault();
    const bonId = $('#asBon').value, rem = $('#asRemplace').value, n = Math.max(1, Math.min(d.dispo, Math.round(+$('#asNb').value || 1)));
    const btn = ev.submitter; if (btn) btn.disabled = true;
    try { await assignerPlats({ sessionId, recId, recNom: d.rec.nom, jour: d.session.jour, bonId, remplace: rem, n, E }); }
    catch (err) { toast('Échec : ' + String(err.message || err).slice(0, 140)); if (btn) btn.disabled = false; return; }
    closeAll(); await chargerProd(true); render();
  };
}
async function assignerPlats({ sessionId, recId, recNom, jour, bonId, remplace, n, E }) {
  const bon = E.bons.find(b => b.id === bonId);
  const [type, remRec] = remplace.split(':');
  let avant = null, nPris = n;
  if (type === 'attribution') {
    const r = await sb('bons_attributions?bon_id=eq.' + bonId + '&recette_id=eq.' + remRec + '&select=*');
    avant = r[0]; if (!avant) throw new Error('recette introuvable dans la commande');
    nPris = Math.min(n, avant.nb_portions);
  }
  if (type === 'libre') {
    const pa = E.attribs.filter(a => a.bon_id === bonId).reduce((t, a) => t + (a.nb_portions || 0), 0) + platsDuBon(bonId).length;
    nPris = Math.min(n, Math.max(0, bon.nb_repas - pa));
  }
  if (!nPris) throw new Error('rien à remplacer dans cette commande');
  const snap = avant ? (({ id, created_at, ...x }) => x)(avant) : null;
  const rows = Array.from({ length: nPris }, () => ({ prefixe: prefixePlat(recNom), session_id: sessionId, recette_id: recId, recette_nom: recNom, bon_id: bonId, remplace: type, remplace_recette_id: type === 'attribution' ? remRec : null, attribution_avant: snap, produit_le: jour, par: STAFF_NOM || null }));
  const cr = await sb('crm_plats', { method: 'POST', body: JSON.stringify(rows) });
  // La commande cible : une portion de moins à produire, ou un repas de plus.
  try {
    if (type === 'attribution') {
      const f = 'bons_attributions?bon_id=eq.' + bonId + '&recette_id=eq.' + remRec;
      if (avant.nb_portions - nPris > 0) await sb(f, { method: 'PATCH', body: JSON.stringify({ nb_portions: avant.nb_portions - nPris }) });
      else await sb(f, { method: 'DELETE' });
    }
    if (type === 'en_plus') await sb('bons_commande?id=eq.' + bonId, { method: 'PATCH', body: JSON.stringify({ nb_repas: bon.nb_repas + nPris, updated_at: new Date().toISOString() }) });
  } catch (err) {
    // La commande n'a pas bougé : les plats ne doivent pas rester assignés à moitié.
    await sb('crm_plats?id=in.(' + cr.map(p => p.id).join(',') + ')', { method: 'DELETE' }).catch(() => {});
    throw err;
  }
  await prMajStatutBon(bonId);
  await chargerPlats(true);
  toast(cr.map(p => p.code).join(', ') + ' → ' + cpNomClient(bon));
}
/* « À attribuer » ↔ « attribué » selon portions attribuées + plats assignés. */
async function prMajStatutBon(bonId) {
  const [b] = await sb('bons_commande?id=eq.' + bonId + '&select=id,nb_repas,statut');
  if (!b || (b.statut !== 'a_attribuer' && b.statut !== 'attribue')) return;
  const att = await sb('bons_attributions?bon_id=eq.' + bonId + '&select=nb_portions');
  const pl = await prTry('crm_plats?bon_id=eq.' + bonId + '&select=id');
  const n = att.reduce((t, a) => t + (a.nb_portions || 0), 0) + (pl.ok ? pl.data.length : 0);
  const st = n >= b.nb_repas && n > 0 ? 'attribue' : 'a_attribuer';
  if (st !== b.statut) await sb('bons_commande?id=eq.' + bonId, { method: 'PATCH', body: JSON.stringify({ statut: st, updated_at: new Date().toISOString() }) });
}
async function retirerPlat(id) {
  const [p] = await sb('crm_plats?id=eq.' + id + '&select=*');
  if (!p) { toast('Plat introuvable'); render(); return; }
  if (!confirm(`Retirer ${p.code} de sa commande ?\n\n${p.remplace === 'attribution' ? 'La portion qu’il remplaçait redevient à produire.' : p.remplace === 'en_plus' ? 'La commande perd le repas ajouté.' : 'Le repas redevient à attribuer.'} Le plat redevient disponible à la vente.`)) return;
  try {
    if (p.remplace === 'attribution' && p.remplace_recette_id) {
      const f = 'bons_attributions?bon_id=eq.' + p.bon_id + '&recette_id=eq.' + p.remplace_recette_id;
      const [a] = await sb(f + '&select=*');
      if (a) await sb(f, { method: 'PATCH', body: JSON.stringify({ nb_portions: a.nb_portions + 1 }) });
      else if (p.attribution_avant) await sb('bons_attributions', { method: 'POST', body: JSON.stringify({ ...p.attribution_avant, nb_portions: 1 }) });
    }
    if (p.remplace === 'en_plus') {
      const [b] = await sb('bons_commande?id=eq.' + p.bon_id + '&select=nb_repas');
      if (b && b.nb_repas > 1) await sb('bons_commande?id=eq.' + p.bon_id, { method: 'PATCH', body: JSON.stringify({ nb_repas: b.nb_repas - 1, updated_at: new Date().toISOString() }) });
    }
    await sb('crm_plats?id=eq.' + id, { method: 'DELETE' });
    await prMajStatutBon(p.bon_id);
  } catch (err) { toast('Échec : ' + String(err.message || err).slice(0, 140)); return; }
  toast(p.code + ' retiré — de nouveau disponible');
  await chargerPlats(true); await chargerProd(true); render();
}

/* ───────────── 7. Ce que le stock permet encore (Assemblage) ─────────────
   Demande de Pablo : « si on a fait 3 bourguignons sur 10 et que l'inventaire
   montre qu'on peut encore en faire 15 → 7 en vert et 8 en violet ».
   Le stock = stocks_mp disponible, c'est-à-dire le compté du dernier
   inventaire (plus ce qui a été saisi depuis). La portion = la moyenne du lot
   de la session (grammes réels des clients ÷ portions). Même règle que la
   production réelle : l'aliment principal fixe le nombre (faisables) ; les
   complètes demandent tous les aliments d'au moins 3 g ou ml par portion —
   le sel et les épices ne bloquent pas. Chaque recette est calculée seule
   sur tout le stock : deux recettes au bœuf ne se cumulent pas. */
function prStockIndex(stocks) {
  const m = {};
  (stocks || []).forEach(s => {
    const u = s.unite || 'kg', fam = u === 'kg' ? 'm' : u === 'L' ? 'v' : 'p';
    const k = String(s.ingredient_nom || '').trim().toLowerCase() + '|' + fam;
    m[k] = (m[k] || 0) + prVersBase(+s.quantite_kg || 0, u === 'pièce' ? 'pièce' : u);
  });
  return m;
}
function prPossibleStock(parPortion, idx) {
  const ings = parPortion.filter(i => i.q > 0 && (i.fam === 'p' || i.q >= 3))
    .map(i => { const stock = idx[i.nom.trim().toLowerCase() + '|' + i.fam] || 0; return { ...i, stock, possible: Math.floor(stock / i.q + 1e-9) }; });
  if (!ings.length) return null;
  const poids = ings.filter(i => i.fam !== 'p').reduce((t, i) => t + i.q, 0);
  let pr = ings.filter(i => i.tag === 'proteine');
  if (!pr.length) pr = ings.filter(i => i.fam !== 'p' && i.q >= PART_PRINCIPALE * poids);
  if (!pr.length) pr = ings;
  // Le principal le PLUS LIMITANT décide — pas le plus disponible comme dans
  // « Réorganiser » : sans étiquette, bœuf (180 g) et vin (150 ml) d'un
  // bourguignon sont tous deux principaux, et « le plus disponible » annonçait
  // 20 bourguignons avec du bœuf pour 15 (attrapé au banc). Pour dire ce que
  // le stock permet, tous les principaux sont nécessaires ; les secondaires
  // ne font que compléter.
  let faisables = Infinity, decideur = pr[0].nom;
  pr.forEach(i => { if (i.possible < faisables) { faisables = i.possible; decideur = i.nom; } });
  const completes = Math.min(faisables, ...ings.map(i => i.possible));
  return { faisables, completes, decideur, manquants: ings.filter(i => i.possible < faisables).map(i => ({ nom: i.nom, fam: i.fam, q: faisables * i.q - i.stock })) };
}
/* La répartition affichée : ce qui reste à faire de la commande (vert), ce
   qu'on pourra faire en plus (violet), ce qui manquera (rouge). */
function prRepartition(demande, faits, possibles) {
  const reste = Math.max(0, demande - faits);
  return { reste, vert: Math.min(reste, possibles), violet: Math.max(0, possibles - reste), manque: Math.max(0, reste - possibles) };
}
