/* assets/crm-assigner.js — les plats en stock, et assigner une commande
   ═══════════════════════════════════════════════════════════════════════════
   Demande de Pablo (2026-09-28) :
   1. Production → Stocks : une page dédiée aux PLATS EN STOCK — le nom du plat,
      la quantité, la date de production. Rien d'autre.
   2. Les assigner directement depuis Commandes.
   3. « Assigner » devient une PAGE COMPLÈTE pour une commande : d'abord les
      plats déjà prêts, puis les recettes à attribuer, en mettant en avant
      celles dont les ingrédients sont déjà en stock (inventaire), avec leurs
      quantités et le nombre de plats qu'on peut en faire.

   Un plat en stock = un plat fait EN PLUS des commandes et pas encore assigné
   (prProduitsDisponibles, crm-produits.js) : la production réelle saisie dans
   Opérationnel ou validée à l'assemblage. Les ingrédients en stock = stocks_mp
   disponible, donc le compté du dernier inventaire.

   Ce que la page ne recalcule PAS : la portion d'un client. Les quantités par
   plat sont celles de la FICHE (quantité ÷ portions de la fiche) — un repère.
   Attribuer une recette ouvre le formulaire de commande avec la recette déjà
   ajoutée : c'est lui qui calcule la vraie portion du client (45 %, base de
   recette, NattyProd) — jamais une seconde version de ce calcul ici.

   Dépend de crm.html, crm-production.js (cpNomClient, cpJ, CMD) et
   crm-produits.js (prProduitsDisponibles, chargerPlats, platsDuBon,
   assignerPlats, prStockIndex, prPossibleStock, prFamille, prVersBase, prFmt,
   prTry, platPastille) — chargé après eux.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Les plats en stock : une ligne par recette et par session de production. */
async function prPlatsEnStock() {
  FIN_GLOBAL = await chargerFinanceGlobal();
  const plats = await chargerPlats(true);
  return prProduitsDisponibles(FIN_GLOBAL, plats).dispo.filter(d => d.dispo > 0)
    .sort((a, b) => a.session.jour.localeCompare(b.session.jour));   // les plus anciens d'abord : à écouler en premier
}
const prJPlus = j => { const n = Math.round((new Date(isoLocal(new Date()) + 'T00:00:00') - new Date(j + 'T00:00:00')) / 864e5); return n <= 0 ? 'du jour' : 'J+' + n; };

/* ─────────────── 1. Production → Stocks → Plats en stock ─────────────── */
async function vProdStocksOnglets() {
  const tb = tabs('stocks', [['mp', 'Matières premières'], ['plats', 'Plats en stock']], 'mp');
  return tb.html + '<div style="margin-top:12px">' + (tb.cur === 'plats' ? await vStocksPlats() : await vProdStocks()) + '</div>';
}
async function vStocksPlats() {
  const liste = await prPlatsEnStock();
  const total = liste.reduce((t, d) => t + d.dispo, 0);
  return `${PLATS_MANQUE ? `<div class="exbar"><span class="chip bad">SQL</span><span>Table <span class="mono">crm_plats</span> absente — exécuter ${PR_SQL}.</span></div>` : ''}
  <div class="sect"><h2>Plats en stock</h2><span>${total}</span></div>
  <div class="tbl-wrap"><table><thead><tr><th>Plat</th><th>Quantité</th><th>Produit le</th><th></th></tr></thead><tbody>
  ${liste.map(d => `<tr><td>${esc(d.rec.nom)}</td><td class="num"><b>${d.dispo}</b></td><td>${fd(d.session.jour)} <span class="muted" style="font-size:11.5px">${prJPlus(d.session.jour)}</span></td>
    <td style="text-align:right"><button class="btn sm" type="button" data-plat-assigner="${d.session.id}:${d.rec.recId}">Assigner →</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted" style="text-align:center;padding:18px">Aucun plat en stock. Les plats en stock sont ceux faits en plus des commandes : compteur « en plus » dans Production → session → Assemblage, ou production réelle dans Opérationnel.</td></tr>'}
  </tbody></table></div>`;
}

/* ─────────────── 2. La page « Assigner » d'une commande ─────────────── */
/* Ce qu'un plat peut prendre dans la commande : une portion d'une recette
   attribuée, un repas pas encore attribué, ou un repas de plus. */
function prOptionsRemplace(E, bon, recId) {
  const att = E.attribs.filter(a => a.bon_id === bon.id);
  const pa = att.reduce((t, a) => t + (a.nb_portions || 0), 0) + platsDuBon(bon.id).length;
  const o = [];
  if (pa < bon.nb_repas) o.push(['libre', `un repas pas encore attribué (${bon.nb_repas - pa} libre${bon.nb_repas - pa > 1 ? 's' : ''})`]);
  att.slice().sort((x, y) => (y.recette_id === recId) - (x.recette_id === recId)).forEach(a => o.push([`attribution:${a.recette_id}`, `une portion de ${((E.recettes.find(r => r.id === a.recette_id) || {}).nom || 'Recette')} (${a.nb_portions})`]));
  o.push(['en_plus', 'un repas de plus (' + (bon.nb_repas + 1) + ' repas)']);
  // la même recette déjà attribuée passe devant : elle n'est alors plus à cuisiner
  const meme = o.findIndex(x => x[0] === 'attribution:' + recId);
  if (meme > 0) o.unshift(o.splice(meme, 1)[0]);
  return o;
}
/* Ce que le stock permet pour une recette, à la portion de la FICHE. */
function prRecetteStock(rec, ings, idx) {
  const n = rec.nb_portions || 1;
  const par = (ings || []).filter(i => +i.quantite_g > 0).map(i => ({ nom: String(i.ingredient_nom || '').trim(), fam: prFamille(i.unite || 'g'), q: prVersBase(+i.quantite_g / n, i.unite || 'g'), tag: i.tag || null }));
  const pos = par.length ? prPossibleStock(par, idx) : null;
  const lignes = par.map(i => { const stock = idx[i.nom.toLowerCase() + '|' + i.fam] || 0; return { ...i, stock, possible: i.q > 0 ? Math.floor(stock / i.q + 1e-9) : null, petit: i.fam !== 'p' && i.q < 3 }; });
  return { rec, lignes, faisables: pos ? pos.faisables : 0, completes: pos ? pos.completes : 0, decideur: pos ? pos.decideur : null, manquants: pos ? pos.manquants : [], enStock: lignes.filter(l => !l.petit && l.stock > 0).length, pesables: lignes.filter(l => !l.petit).length };
}
async function vAssignerCommande(bonId) {
  const E = await chargerProd(true);
  const bon = E && E.bons.find(b => b.id === bonId);
  if (!bon) { CMD.assigner = null; return '<div class="empty">Commande introuvable.</div>'; }
  const [enStock, st] = await Promise.all([prPlatsEnStock(), prTry('stocks_mp?statut=eq.disponible&select=*')]);
  const idx = prStockIndex(st.ok ? st.data : []);
  const att = E.attribs.filter(a => a.bon_id === bon.id), dejaPlats = platsDuBon(bon.id);
  const pa = att.reduce((t, a) => t + (a.nb_portions || 0), 0) + dejaPlats.length, libres = Math.max(0, bon.nb_repas - pa);
  // Les plats prêts d'une session qui produit CETTE commande ne peuvent pas lui revenir (la demande baisserait, le « en plus » monterait).
  const plats = enStock.filter(d => !((FIN_GLOBAL.rawParSession[d.session.id] || { bons: [] }).bons.some(b => b.id === bon.id)));
  const recettes = (E.recettes || []).map(r => prRecetteStock(r, E.ings[r.id], idx))
    .sort((a, b) => b.completes - a.completes || b.faisables - a.faisables || b.enStock / Math.max(1, b.pesables) - a.enStock / Math.max(1, a.pesables) || a.rec.nom.localeCompare(b.rec.nom, 'fr'));
  const avec = recettes.filter(r => r.faisables > 0), sans = recettes.filter(r => !r.faisables);
  const carteRecette = r => `<div class="card" style="margin-bottom:10px${r.completes >= Math.max(1, libres) ? ';border:1px solid var(--green)' : ''}">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
     <div><b>${esc(r.rec.nom)}</b><div class="muted" style="font-size:12px;margin-top:2px">${r.faisables ? `${r.faisables} plat${r.faisables > 1 ? 's' : ''} possible${r.faisables > 1 ? 's' : ''} avec le stock, selon ${esc(r.decideur)}${r.completes < r.faisables ? ` — dont ${r.completes} complet${r.completes > 1 ? 's' : ''}` : ''}` : `${r.enStock} ingrédient${r.enStock > 1 ? 's' : ''} sur ${r.pesables} en stock`}</div></div>
     <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${r.faisables ? `<span class="chip ${r.completes ? 'ok' : 'warn'}">${r.completes} complet${r.completes > 1 ? 's' : ''}</span>` : ''}
      <button class="btn sm primary" type="button" data-asg-recette="${r.rec.id}" data-asg-n="${Math.max(1, Math.min(libres || 1, r.completes || 1))}">Attribuer →</button></div></div>
    <div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Ingrédient</th><th>Par plat (fiche)</th><th>En stock</th><th>Plats possibles</th></tr></thead><tbody>
    ${r.lignes.map(l => `<tr${l.petit ? ' class="muted"' : ''}><td>${esc(l.nom)}${l.tag === 'proteine' ? ' <span class="chip info">protéine</span>' : ''}</td><td class="num">${prFmt(l.q, l.fam)}</td>
      <td class="num" style="${!l.petit && !l.stock ? 'color:var(--red)' : ''}">${l.stock ? prFmt(l.stock, l.fam) : '—'}</td><td class="num">${l.petit ? '<span class="muted" style="font-size:11px">ne bloque pas</span>' : l.possible != null ? `<b style="color:${l.possible ? (l.possible >= r.faisables ? 'var(--green)' : 'var(--amber)') : 'var(--red)'}">${l.possible}</b>` : '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucun ingrédient dans la fiche.</td></tr>'}
    </tbody></table></div>
    ${r.manquants.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px"><span class="muted" style="font-size:12px">Pour les compléter :</span>${r.manquants.map(m => `<span class="chip warn">${esc(m.nom)} −${prFmt(m.q, m.fam)}</span>`).join('')}</div>` : ''}</div>`;
  const opts = d => prOptionsRemplace(E, bon, d.rec.recId).map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join('');
  return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><button class="btn sm ghost" type="button" data-asg-retour>‹ Commandes</button>
    <h2 style="margin:0;font-size:18px">Assigner — ${esc(cpNomClient(bon))}</h2><span class="muted" style="font-size:12.5px">${bon.jour_livraison ? 'livraison ' + esc(cpJ(bon.jour_livraison)) : 'sans date'} · ${bon.nb_repas} repas</span>
    <span style="margin-left:auto"><button class="btn sm" type="button" data-edit-bon="${bon.id}">Modifier la commande</button></span></div>
  <div class="grid g3" style="margin-bottom:14px">
   <div class="card kpi"><div class="lbl">Repas commandés</div><div class="val">${bon.nb_repas}</div></div>
   <div class="card kpi"><div class="lbl">Déjà attribués</div><div class="val">${pa}</div><div class="foot">${att.map(a => esc(((E.recettes.find(r => r.id === a.recette_id) || {}).nom || '?')) + ' × ' + a.nb_portions).join(' · ') || 'aucune recette'}${dejaPlats.length ? ' · ' + dejaPlats.length + ' plat(s) prêt(s)' : ''}</div>${dejaPlats.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${dejaPlats.map(platPastille).join('')}</div>` : ''}</div>
   <div class="card kpi"><div class="lbl">À attribuer</div><div class="val" style="color:${libres ? 'var(--red)' : 'var(--green)'}">${libres}</div><div class="foot">${libres ? 'repas sans recette ni plat' : 'commande complète'}</div></div>
  </div>
  <div class="sect"><h2>Plats déjà prêts</h2><span>${plats.reduce((t, d) => t + d.dispo, 0)}</span></div>
  ${plats.length ? `<div class="tbl-wrap" style="margin-bottom:16px"><table><thead><tr><th>Plat</th><th>En stock</th><th>Produit le</th><th>À la place de</th><th>Nombre</th><th></th></tr></thead><tbody>
   ${plats.map((d, i) => `<tr><td>${esc(d.rec.nom)}</td><td class="num">${d.dispo}</td><td>${fd(d.session.jour)} <span class="muted" style="font-size:11.5px">${prJPlus(d.session.jour)}</span></td>
    <td><select class="inp" id="asgRem${i}" style="width:auto;min-width:180px;padding:4px 6px">${opts(d)}</select></td>
    <td><input class="inp" id="asgNb${i}" type="number" min="1" max="${d.dispo}" value="1" style="width:64px;padding:4px 8px"></td>
    <td style="text-align:right"><button class="btn sm primary" type="button" data-asg-plat="${i}">Assigner</button></td></tr>`).join('')}
  </tbody></table></div>` : '<div class="empty" style="margin-bottom:16px">Aucun plat prêt en stock.</div>'}
  <div class="sect"><h2>Recettes faisables avec le stock</h2><span>${avec.length}</span></div>
  <p class="muted" style="font-size:12.5px;margin:-4px 0 10px">Le stock = le dernier inventaire. Quantités à la portion de la fiche : « Attribuer » ouvre la commande avec la recette ajoutée, et le formulaire calcule la vraie portion du client. Bordure verte : assez de plats complets pour les ${libres || 1} repas à attribuer.</p>
  ${avec.map(carteRecette).join('') || '<div class="empty" style="margin-bottom:16px">Aucune recette faisable avec le stock actuel.</div>'}
  ${sans.length ? `<details style="margin-top:6px"><summary class="muted" style="cursor:pointer;font-size:13px">Recettes sans l'ingrédient principal en stock · ${sans.length}</summary><div style="margin-top:10px">${sans.map(carteRecette).join('')}</div></details>` : ''}`;
}
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-cmd-assigner]'); if (a) { CMD.assigner = a.dataset.cmdAssigner; render(); window.scrollTo(0, 0); return; }
  if (e.target.closest('[data-asg-retour]')) { CMD.assigner = null; render(); return; }
  const r = e.target.closest('[data-asg-recette]');
  if (r) { ouvrirFormBon(CMD.assigner, null, { recette: r.dataset.asgRecette, n: +r.dataset.asgN || 1 }); return; }
  const p = e.target.closest('[data-asg-plat]');
  if (p) {
    const i = +p.dataset.asgPlat, E = await chargerProd(), bon = E.bons.find(b => b.id === CMD.assigner);
    const liste = (await prPlatsEnStock()).filter(d => !((FIN_GLOBAL.rawParSession[d.session.id] || { bons: [] }).bons.some(b => b.id === CMD.assigner)));
    const d = liste[i]; if (!d || !bon) { toast('Plat introuvable — la page va se recharger'); render(); return; }
    const n = Math.max(1, Math.min(d.dispo, Math.round(+$('#asgNb' + i).value || 1)));
    p.disabled = true;
    try { await assignerPlats({ sessionId: d.session.id, recId: d.rec.recId, recNom: d.rec.nom, jour: d.session.jour, bonId: bon.id, remplace: $('#asgRem' + i).value, n, E }); }
    catch (err) { toast('Échec : ' + String(err.message || err).slice(0, 140)); p.disabled = false; return; }
    await chargerProd(true); render();
  }
});
