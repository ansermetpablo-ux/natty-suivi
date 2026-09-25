/* assets/crm-production.js — la Production du CRM, en natif
   ═══════════════════════════════════════════════════════════════════════════
   Demande de Pablo (2026-09-25) : « pour les onglets de production tu as juste
   intégré admin, je veux que tu reprennes nativement les fonctionnalités », plus :
   sélectionner les recettes à produire depuis le calendrier, organiser la
   session de production avec le lien au calendrier RH, envoyer le message de
   réservation de la cuisine, un nombre de cuisiniers modifiable après coup,
   les PDF de production, la liste de courses et l'itinéraire de livraison.

   CE QUI EST ICI : les ÉCRANS (dans le style du CRM) et l'organisation —
   sessions, équipe, réservation, courses, tournée.
   CE QUI N'EST PAS ICI : le calcul. Les portions de chaque client (45 %, base
   de recette, grammages), le plan minuté par cuisinier, les postes et les PDF
   viennent d'assets/admin-production.js (`NattyProd.planSession`,
   `pdfSession`…). Une seconde version de ce calcul finirait par dire d'autres
   grammes que la cuisine — le défaut déjà payé entre api/_nutrition.js et
   core.js.

   Dépend de crm.html (sb, sbTry, esc, fd, modal, closeAll, toast, render, go,
   SUB, S.staff, RH_CACHE, chargerRH, estIndisponible, appelNotification,
   jetonStaff, STAFF_SESSION, isoLocal, lundiLocal, PROD, libBon, chipStatut,
   PROD_STATUTS, chargerProd, ouvrirFormBon, clientNatty) — chargé APRÈS son
   script principal, donc toutes ces déclarations globales existent.

   Stockage : `crm_sessions` + les colonnes de supabase/migrations/0011. Tant
   qu'elles manquent, ce qui ne tient pas dans le schéma d'origine (recettes,
   jours de livraison, équipe, itinéraire…) est gardé sur CET appareil, et
   l'écran le dit.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────── outils ───────────────────────── */
const CP_EXTRAS = ['recettes', 'jours_livraison', 'equipe', 'reunion_id', 'itineraire', 'adresse_depart'];
let CP_SCHEMA_OK = null;       // null = pas encore su, false = colonnes 0011 absentes
const cpLocal = id => { try { return JSON.parse(localStorage.getItem('natty_session_' + id) || '{}'); } catch (e) { return {}; } };
const cpLocalEcrire = (id, o) => { try { localStorage.setItem('natty_session_' + id, JSON.stringify(Object.assign(cpLocal(id), o))); } catch (e) {} };
const cpColonneAbsente = e => /PGRST204|42703|column|Could not find/i.test(String(e && e.message || e));
const cpHm = m => { m = Math.round(m); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const cpMin = s => { const p = String(s || '08:00').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
const cpJ = s => new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const cpQ = (g, u) => { u = u || 'g'; const l = u.toLowerCase(); if ((l === 'g' || l === 'ml') && g >= 1000) return (Math.round(g / 100) / 10).toLocaleString('fr-FR') + ' ' + (l === 'g' ? 'kg' : 'L'); return (g >= 10 ? Math.round(g) : Math.round(g * 10) / 10).toLocaleString('fr-FR') + ' ' + u; };
const cpNomClient = b => clientNatty(b.user_id) || libBon(b);
function cpReglage(cle, def) { try { return localStorage.getItem('natty_' + cle) || def; } catch (e) { return def; } }
function cpReglageEcrire(cle, v) { try { localStorage.setItem('natty_' + cle, v); } catch (e) {} }

/* Une session lue : la ligne en base + ce qui a dû rester sur l'appareil. */
function cpFusion(s) {
  const loc = cpLocal(s.id), o = Object.assign({}, s);
  CP_EXTRAS.forEach(k => { if (o[k] == null && loc[k] != null) o[k] = loc[k]; });
  ['recettes', 'jours_livraison', 'equipe', 'itineraire'].forEach(k => {
    if (typeof o[k] === 'string') { try { o[k] = JSON.parse(o[k]); } catch (e) { o[k] = null; } }
    if (!Array.isArray(o[k])) o[k] = [];
  });
  return o;
}
async function cpSessions() {
  const r = await sbTry('crm_sessions?type=eq.production&select=*&order=jour.desc&limit=60');
  return r.ok ? r.data.map(cpFusion) : null;
}
/* Écrire une session : tout en base si les colonnes 0011 existent ; sinon le
   cœur en base, les colonnes nouvelles sur l'appareil. */
async function cpSauver(id, patch) {
  const coeur = {}, extras = {};
  Object.keys(patch).forEach(k => (CP_EXTRAS.indexOf(k) >= 0 ? extras : coeur)[k] = patch[k]);
  if (CP_SCHEMA_OK !== false) {
    try { await sb('crm_sessions?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(patch) }); CP_SCHEMA_OK = true; return; }
    catch (e) { if (!cpColonneAbsente(e)) throw e; CP_SCHEMA_OK = false; }
  }
  if (Object.keys(coeur).length) await sb('crm_sessions?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(coeur) });
  if (Object.keys(extras).length) cpLocalEcrire(id, extras);
}
async function cpCreer(ligne) {
  const coeur = {}, extras = {};
  Object.keys(ligne).forEach(k => (CP_EXTRAS.indexOf(k) >= 0 ? extras : coeur)[k] = ligne[k]);
  let cree;
  if (CP_SCHEMA_OK !== false) {
    try { cree = (await sb('crm_sessions', { method: 'POST', body: JSON.stringify(ligne) }))[0]; CP_SCHEMA_OK = true; return cree; }
    catch (e) { if (!cpColonneAbsente(e)) throw e; CP_SCHEMA_OK = false; }
  }
  cree = (await sb('crm_sessions', { method: 'POST', body: JSON.stringify(coeur) }))[0];
  cpLocalEcrire(cree.id, extras);
  return Object.assign(cree, extras);
}
const cpBandeauLocal = () => CP_SCHEMA_OK === false
  ? `<div class="exbar"><span class="chip warn">Sur cet appareil</span><span>Les recettes, l'équipe et l'itinéraire des sessions sont gardés sur cet appareil : exécuter <span class="mono">supabase/migrations/0011_sessions_production.sql</span> pour les partager.</span></div>` : '';

/* ─────────────── 1. Depuis le calendrier : planifier une session ─────────────── */
/* Les jours cochés au calendrier sont des jours de LIVRAISON. La session se
   place par défaut deux jours avant la première (J-2 de la spec) ; on choisit
   les recettes à produire parmi celles de ces commandes. */
async function cpPlanifierDepuisJours(jours) {
  if (!jours.length) { toast('Cochez au moins un jour de livraison'); return; }
  const E = await chargerProd(true);
  if (!E) { toast('Calcul de production indisponible'); return; }
  const bons = E.bons.filter(b => jours.indexOf(b.jour_livraison) >= 0 && b.statut !== 'annule' && b.statut !== 'livre');
  const par = {};
  bons.forEach(b => E.attribs.filter(a => a.bon_id === b.id).forEach(a => { par[a.recette_id] = (par[a.recette_id] || 0) + a.nb_portions; }));
  const recs = Object.keys(par).map(id => ({ id, nom: (E.recettes.find(r => r.id === id) || {}).nom || 'Recette', n: par[id] })).sort((a, b) => b.n - a.n);
  const sansRecette = bons.filter(b => !E.attribs.some(a => a.bon_id === b.id));
  const d = new Date(jours.slice().sort()[0] + 'T00:00:00'); d.setDate(d.getDate() - 2);
  modal(`<h2>Planifier une session de production</h2>
  <p class="muted" style="margin:-4px 0 10px;font-size:12.5px">Livraisons du ${jours.slice().sort().map(fd).join(', ')} · ${bons.length} commande(s)</p>
  ${sansRecette.length ? `<div class="exbar"><span class="chip bad">${sansRecette.length}</span><span>commande(s) sans recette attribuée — à attribuer dans Commandes, elles ne seront pas produites.</span></div>` : ''}
  <form class="form" id="cpForm">
   <label>Recettes à produire<div class="cp-recs">${recs.map(r => `<label class="cp-rec"><input type="checkbox" value="${r.id}" checked><span>${esc(r.nom)}</span><b class="num">× ${r.n}</b></label>`).join('') || '<div class="empty">Aucune recette attribuée sur ces jours.</div>'}</div></label>
   <div class="two"><label>Jour de production<input class="inp" type="date" id="cpJour" value="${isoLocal(d)}" required></label><label>Arrivée en cuisine<input class="inp" type="time" id="cpDebut" value="08:00" required></label></div>
   <label>Nombre de cuisiniers<input class="inp" type="number" id="cpNb" value="2" min="1" max="12" required></label>
   <div class="foot"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary" type="submit" ${recs.length ? '' : 'disabled'}>Créer la session</button></div>
  </form>`);
  $('#cpForm').onsubmit = async e => {
    e.preventDefault();
    const choix = [...document.querySelectorAll('#cpForm .cp-rec input:checked')].map(i => i.value);
    if (!choix.length) { toast('Choisissez au moins une recette'); return; }
    try {
      const s = await cpCreer({ type: 'production', jour: $('#cpJour').value, creneau_debut: $('#cpDebut').value, nb_personnes: Math.max(1, +$('#cpNb').value || 1),
        statut_reservation: 'a_reserver', recettes: choix, jours_livraison: jours.slice().sort(), equipe: [] });
      closeAll(); CP.id = s.id; CP.onglet = 'planning';
      SUB['vue-production'] = 'production'; toast('Session créée'); go('production');
    } catch (err) { toast('Création refusée : ' + String(err.message || err).slice(0, 140)); }
  };
}

/* ─────────────────────── 2. La vue Production ─────────────────────── */
const CP = { id: null, onglet: 'planning', ctx: null, itin: null };

async function vProdSessionsNatif() {
  const E = await chargerProd();
  const list = await cpSessions();
  if (!list) return `<div class="exbar"><span class="chip bad">Illisible</span><span>Impossible de lire <span class="mono">crm_sessions</span> — session d'équipe requise, ou table absente.</span></div>`;
  if (CP.id) { const s = list.find(x => x.id === CP.id); if (s) return await vSession(s, E); CP.id = null; }
  const auj = isoLocal(new Date());
  const avenir = list.filter(s => s.jour >= auj).sort((a, b) => a.jour.localeCompare(b.jour)), passees = list.filter(s => s.jour < auj);
  const carte = s => {
    const noms = s.recettes.map(id => ((E && E.recettes.find(r => r.id === id)) || {}).nom).filter(Boolean);
    const res = { a_reserver: ['bad', 'Cuisine à réserver'], envoyee: ['warn', 'Réservation envoyée'], confirmee: ['ok', 'Cuisine confirmée'] }[s.statut_reservation] || ['', s.statut_reservation];
    return `<button class="card click cp-sess" data-cp-ouvrir="${s.id}"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b style="font-size:15px">${esc(cpJ(s.jour))}</b><div class="muted" style="font-size:12px;margin-top:2px">${s.creneau_debut ? s.creneau_debut.slice(0, 5) : '—'}${s.creneau_fin ? '–' + s.creneau_fin.slice(0, 5) : ''} · ${s.nb_personnes || '?'} cuisinier(s)${s.jours_livraison.length ? ' · livraison ' + s.jours_livraison.map(fd).join(', ') : ''}</div></div><span class="chip ${res[0]}">${res[1]}</span></div>
      <div class="muted" style="font-size:12.5px;margin-top:8px">${noms.length ? esc(noms.join(' · ')) : (s.bloc_id ? 'session d’un bloc — recettes du menu du bloc' : 'aucune recette choisie')}</div>
      ${s.reunion_id ? '<div style="margin-top:6px"><span class="chip info">Au calendrier RH</span></div>' : ''}</button>`;
  };
  return `${cpBandeauLocal()}
  <div class="sect" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h2>Sessions de production</h2><span style="margin-left:auto"><button class="btn sm primary" data-kpi-vue="calendrier">+ Planifier depuis le calendrier</button></span></div>
  <p class="muted" style="font-size:12.5px;margin:-4px 0 10px">Une session se crée depuis le Calendrier : cochez les jours de livraison, puis « Planifier une session de production » et choisissez les recettes.</p>
  <div class="grid g2">${avenir.map(carte).join('') || '<div class="empty">Aucune session à venir.</div>'}</div>
  ${passees.length ? `<div class="sect" style="margin-top:18px"><h2>Passées</h2></div><div class="grid g2">${passees.slice(0, 10).map(carte).join('')}</div>` : ''}`;
}

/* Le contexte calculé d'une session : ses bons (jours de livraison), ses
   recettes, ses cuisiniers — et le plan que la cuisine suivra. */
function cpContexte(s, E) {
  const bons = E.bons.filter(b => s.jours_livraison.indexOf(b.jour_livraison) >= 0 && b.statut !== 'annule');
  const noms = s.equipe.map(uid => (S.staff.find(x => x.user_id === uid) || {}).nom).filter(Boolean);
  const ctx = NattyProd.planSession({ bons, recettes: s.recettes, nbCuis: s.nb_personnes || 1, debut: (s.creneau_debut || '08:00').slice(0, 5), noms });
  ctx.duree = Math.max(0, ctx.plan.fin - ctx.plan.t0);
  // §4.1 : créneau = durée du plan + marge, arrondi à l'heure pleine supérieure
  ctx.marge = 30; ctx.heures = Math.max(1, Math.ceil((ctx.duree + ctx.marge) / 60));
  ctx.finCreneau = cpHm(cpMin(s.creneau_debut) + ctx.heures * 60);
  return ctx;
}

async function vSession(s, E) {
  if (!E) return '<div class="exbar"><span class="chip bad">Calcul indisponible</span><span>assets/admin-production.js n’a pas pu charger les données.</span></div>';
  await chargerRH();
  const ctx = cpContexte(s, E); CP.ctx = ctx; CP.s = s;
  const portions = ctx.lots.reduce((t, l) => t + l.portions, 0), kg = ctx.lots.reduce((t, l) => t + l.gTotal, 0) / 1000;
  const onglets = [['planning', 'Planning'], ['postes', 'Postes & PDF'], ['assemblage', 'Assemblage'], ['equipe', 'Équipe & RH'], ['cuisine', 'Réservation cuisine'], ['courses', 'Liste de courses'], ['livraison', 'Itinéraire de livraison']];
  let corps = '';
  if (CP.onglet === 'planning') corps = cpPlanning(ctx);
  if (CP.onglet === 'postes') corps = cpPostes(ctx, s);
  if (CP.onglet === 'assemblage') corps = cpAssemblage(ctx);
  if (CP.onglet === 'equipe') corps = cpEquipe(s, ctx);
  if (CP.onglet === 'cuisine') corps = cpCuisine(s, ctx);
  if (CP.onglet === 'courses') corps = cpCourses(ctx);
  if (CP.onglet === 'livraison') corps = cpLivraison(s, ctx);
  const recsTous = [...new Set(E.attribs.filter(a => ctx.bons.some(b => b.id === a.bon_id)).map(a => a.recette_id))];
  return `${cpBandeauLocal()}
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><button class="btn sm ghost" data-cp-retour>‹ Sessions</button><h2 style="margin:0;font-size:18px">Session du ${esc(cpJ(s.jour))}</h2>
   <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-cp-pdf-tout>📄 PDF de production</button><button class="btn sm danger" data-cp-supprimer>Supprimer</button></span></div>
  <div class="cp-reglages">
   <label>Jour<input class="inp" type="date" data-cp-champ="jour" value="${s.jour}"></label>
   <label>Arrivée<input class="inp" type="time" data-cp-champ="creneau_debut" value="${(s.creneau_debut || '08:00').slice(0, 5)}"></label>
   <label>Cuisiniers<input class="inp" type="number" min="1" max="12" data-cp-champ="nb_personnes" value="${s.nb_personnes || 1}"></label>
   <div class="cp-recettes"><span class="muted" style="font-size:12px">Recettes produites</span><div>${recsTous.map(id => { const r = E.recettes.find(x => x.id === id); const on = s.recettes.indexOf(id) >= 0; return `<button class="chip ${on ? 'ink' : ''}" data-cp-recette="${id}" title="${on ? 'Retirer de la session' : 'Ajouter à la session'}">${on ? '✓ ' : '+ '}${esc(r ? r.nom : 'Recette')}</button>`; }).join('') || '<span class="muted">aucune recette sur ces jours</span>'}</div></div>
  </div>
  <div class="grid g4" style="margin:12px 0">
   <div class="card kpi"><div class="lbl">Portions</div><div class="val num">${portions}</div><div class="kpi-go">${ctx.lots.length} recette(s) · ${kg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg</div></div>
   <div class="card kpi"><div class="lbl">Fin estimée</div><div class="val num">${cpHm(ctx.plan.fin)}</div><div class="kpi-go">${Math.round(ctx.duree)} min de plan</div></div>
   <button class="card kpi click" data-cp-onglet="cuisine"><div class="lbl">Créneau cuisine</div><div class="val num">${ctx.heures} h</div><div class="kpi-go">${(s.creneau_debut || '08:00').slice(0, 5)}–${ctx.finCreneau} · ${ctx.heures * 30} €</div></button>
   <button class="card kpi click" data-cp-onglet="cuisine"><div class="lbl">Réservation</div><div class="val" style="font-size:15px">${{ a_reserver: '<span style="color:var(--red)">à envoyer</span>', envoyee: '<span style="color:var(--amber)">envoyée</span>', confirmee: '<span style="color:var(--green)">confirmée</span>' }[s.statut_reservation] || s.statut_reservation}</div><div class="kpi-go">${s.reunion_id ? 'au calendrier RH' : 'pas au calendrier RH'}</div></button>
  </div>
  <div class="tabs" role="tablist">${onglets.map(([k, l]) => `<button role="tab" data-cp-onglet="${k}" aria-selected="${CP.onglet === k}">${l}</button>`).join('')}</div>
  <div style="margin-top:12px">${ctx.lots.length ? corps : '<div class="empty">Aucune portion à produire : les recettes choisies n’apparaissent dans aucune commande de ces jours.</div>'}</div>`;
}

/* Le planning : une ligne par cuisinier, un bloc par étape, à son horaire.
   Les étapes passives (four, repos) sont sur la ligne « Attente ». */
/* Deux étapes d'un même cuisinier en même temps (le riz cuit pendant qu'il
   saisit le poulet) : chacune sa voie, sinon l'une cache l'autre. */
function cpVoies(ts) {
  const fins = [], de = {};
  ts.slice().sort((a, b) => a.debut - b.debut).forEach(t => { let v = fins.findIndex(f => f <= t.debut); if (v < 0) { v = fins.length; fins.push(t.fin); } else fins[v] = t.fin; de[t.id] = v; });
  return { n: fins.length, de };
}
function cpPlanning(ctx) {
  const p = ctx.plan, tot = Math.max(30, p.fin - p.t0), pct = m => ((m - p.t0) / tot * 100).toFixed(2) + '%';
  const lignes = p.cuis.map((c, i) => ({ nom: c.nom, t: p.taches.filter(x => x.cuisinier === i) }));
  const attente = p.taches.filter(x => x.cuisinier === -1); if (attente.length) lignes.push({ nom: 'Attente (four, repos)', t: attente, passif: true });
  const heures = []; for (let m = Math.ceil(p.t0 / 60) * 60; m <= p.fin; m += 60) heures.push(m);
  return `<div class="cp-gantt">
   <div class="cp-g-axe"><span></span><div>${heures.map(m => `<i style="left:${pct(m)}">${cpHm(m)}</i>`).join('')}</div></div>
   ${lignes.map(l => { const vo = cpVoies(l.t); return `<div class="cp-g-l"><span>${esc(l.nom)}</span><div style="height:${Math.max(1, vo.n) * 28 + 6}px">${l.t.map(t => `<b class="${t.passif ? 'pass' : ''}" style="top:${3 + vo.de[t.id] * 28}px;height:24px;left:${pct(t.debut)};width:calc(${((t.fin - t.debut) / tot * 100).toFixed(2)}% - 2px);--c:${t.couleur}" title="${esc(cpHm(t.debut) + '–' + cpHm(t.fin) + ' · ' + t.rec + ' · ' + t.titre + (t.sousTotal > 1 ? ' : ' + t.etiquette : ''))}">${esc(t.sousTotal > 1 ? t.etiquette : t.titre)}</b>`).join('')}</div></div>`; }).join('')}
  </div>
  <div class="cp-leg">${ctx.lots.map(l => `<span><i style="background:${l.couleur}"></i>${esc(l.rec.nom)} — ${l.portions} portion(s), ${cpQ(l.gTotal, 'g')}</span>`).join('')}</div>
  <div class="sect" style="margin-top:16px"><h2>Étapes dans l’ordre</h2></div>
  <div class="tbl-wrap"><table><thead><tr><th>Heure</th><th>Qui</th><th>Recette</th><th>Étape</th><th>Quantités</th></tr></thead><tbody>
   ${p.taches.slice().sort((a, b) => a.debut - b.debut).map(t => `<tr><td class="num">${cpHm(t.debut)}–${cpHm(t.fin)}</td><td>${esc(t.passif ? 'attente' : t.qui)}</td><td><span class="dot" style="background:${t.couleur};display:inline-block;margin:0 6px 0 0"></span>${esc(t.rec)}</td><td>${esc(t.titre + (t.sousTotal > 1 ? ' : ' + t.etiquette : ''))}${t.cumulAvec && t.cumulAvec.length ? ' <span class="chip warn">avec d’autres</span>' : ''}</td><td class="muted">${esc((t.ingrs || []).map(x => x.nom + ' ' + cpQ(x.g)).join(', '))}</td></tr>`).join('')}
  </tbody></table></div>
  ${p.cycle ? '<div class="exbar"><span class="chip warn">Boucle</span><span>des dépendances se renvoient l’une à l’autre dans une fiche — le plan l’a coupée, à corriger dans la fiche.</span></div>' : ''}`;
}

function cpPostes(ctx, s) {
  return `<p class="muted" style="font-size:12.5px;margin:0 0 10px">Les recettes qui partagent le plus de gestes sont regroupées sur un même poste. Chaque PDF contient la fiche technique du jour et le PERT de chaque recette, plus le document mélangé quand un poste a plusieurs recettes.</p>
  <div class="grid g2">${ctx.postes.map(p => `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>Poste ${p.i + 1}</b><button class="btn sm primary" data-cp-pdf="${p.cle}" ${p.lots.length ? '' : 'disabled'}>📄 PDF</button></div>
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">${p.lots.map(l => `<span><span class="dot" style="background:${l.couleur};display:inline-block;margin:0 6px 0 0"></span>${esc(l.rec.nom)} <span class="muted">· ${l.portions} portion(s)</span></span>`).join('') || '<span class="muted">aucune recette — plus de cuisiniers que de plats</span>'}</div>
    ${p.lots.length ? `<div class="muted" style="font-size:12px;margin-top:6px">~${p.min} min${p.eco ? ' · ~' + p.eco + ' min gagnées ensemble' : ''}</div>` : ''}</div>`).join('')}</div>`;
}

function cpAssemblage(ctx) {
  return ctx.lots.map(l => `<div class="sect" style="margin-top:6px"><h2><span class="dot" style="background:${l.couleur};display:inline-block;margin:0 6px 0 0"></span>${esc(l.rec.nom)} — ${l.portions} portion(s)</h2></div>
   <div class="grid g2">${l.parClient.map(pc => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(cpNomClient(pc.bon))}</b><span class="muted" style="font-size:12px">× ${pc.n} · ${Math.round(pc.p.gPortion)} g${pc.p.kcal ? ' · ' + Math.round(pc.p.kcal) + ' kcal' : ''}${pc.p.mac ? ' · ' + NattyProd.libMacros(pc.p.mac) : ''}</span></div>
     <div class="cp-ings">${pc.p.ings.map(i => `<span><b class="num">${cpQ(i.g, i.unite)}</b>${esc(i.nom)}</span>`).join('')}</div>
     <div class="muted" style="font-size:11.5px;margin-top:6px">Grammages à corriger dans Commandes → Modifier la commande.</div></div>`).join('')}</div>`).join('');
}

/* L'équipe : les membres de l'équipe, leur disponibilité ce jour-là (RH), et
   la mise au calendrier RH — une RÉUNION « Session de production », pour que
   la session suive la même mécanique de confirmation (§4.4). */
function cpEquipe(s, ctx) {
  const d = new Date(s.jour + 'T12:00:00'), deb = new Date(s.jour + 'T' + (s.creneau_debut || '08:00').slice(0, 5) + ':00'), fin = new Date(s.jour + 'T' + ctx.finCreneau + ':00');
  const reunions = (RH_CACHE.reunions || []).filter(r => r.statut !== 'annulee' && r.id !== s.reunion_id);
  const parts = s.reunion_id ? (RH_CACHE.participations || []).filter(p => p.evenement_id === s.reunion_id) : [];
  const lab = { invite: ['warn', 'invité'], confirme: ['ok', 'confirmé'], decline: ['bad', 'décliné'], tentative: ['', 'peut-être'] };
  return `<p class="muted" style="font-size:12.5px;margin:0 0 10px">Cochez qui vient. Les noms remplacent « Cuisinier 1, 2… » dans le planning et les PDF. Le nombre de cuisiniers du plan reste celui réglé en haut (${s.nb_personnes || 1}).</p>
  <div class="grid g2">${S.staff.filter(x => x.actif !== false).map(m => {
    const indispo = estIndisponible(m.user_id, d);
    const conflit = reunions.find(r => (RH_CACHE.participations || []).some(p => p.evenement_id === r.id && p.membre === m.user_id && p.statut !== 'decline') && new Date(r.date_debut) < fin && new Date(r.date_fin || r.date_debut) > deb);
    const part = parts.find(p => p.membre === m.user_id);
    return `<label class="card cp-membre"><input type="checkbox" data-cp-membre="${m.user_id}" ${s.equipe.indexOf(m.user_id) >= 0 ? 'checked' : ''}><div><b>${esc(m.nom || m.email || 'Membre')}</b><div class="muted" style="font-size:12px">${esc(m.role || '')}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${indispo ? '<span class="chip bad">indisponible ce jour</span>' : '<span class="chip ok">disponible</span>'}${conflit ? `<span class="chip warn">réunion ${esc(new Date(conflit.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))}</span>` : ''}${part ? `<span class="chip ${(lab[part.statut] || ['', ''])[0]}">${(lab[part.statut] || ['', part.statut])[1]}</span>` : ''}</div></div></label>`;
  }).join('')}</div>
  <div class="foot" style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
   <button class="btn sm ghost" data-cp-nb-equipe ${s.equipe.length ? '' : 'disabled'}>Cuisiniers = ${s.equipe.length} (l’équipe cochée)</button>
   <button class="btn sm primary" data-cp-rh>${s.reunion_id ? 'Mettre à jour le calendrier RH' : 'Mettre au calendrier RH et inviter'}</button></div>
  <p class="muted" style="font-size:12px">La session apparaît dans RH → Calendrier de ${deb.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à ${ctx.finCreneau}, chaque personne cochée reçoit une invitation (email + fichier calendrier) et confirme comme pour une réunion ; les absences non prévenues deviennent des manquements.</p>`;
}

/* §4.2 — le message de réservation : date, arrivée, fin (créneau arrondi),
   nombre de personnes. Email via /api/notifications (Resend), SMS par lien
   `sms:`, ou copie. */
function cpTexteReservation(s, ctx) {
  const n = Math.max(s.nb_personnes || 1, s.equipe.length || 0);
  return `Bonjour,\n\nNous souhaitons réserver la cuisine le ${cpJ(s.jour)}, de ${(s.creneau_debut || '08:00').slice(0, 5)} à ${ctx.finCreneau} (${ctx.heures} h), pour ${n} personne(s).\n\nMerci de nous confirmer la disponibilité.\n\n${STAFF_NOM || 'L’équipe Natty'}`;
}
function cpCuisine(s, ctx) {
  const tel = cpReglage('cuisine_tel', '');
  const st = s.statut_reservation;
  return `<div class="grid g2"><div class="card">
   <b>Créneau calculé</b><div class="muted" style="font-size:12.5px;margin:4px 0 10px">${Math.round(ctx.duree)} min de plan + ${ctx.marge} min de marge, arrondi à l’heure pleine : <b style="color:var(--ink)">${(s.creneau_debut || '08:00').slice(0, 5)}–${ctx.finCreneau}</b>, ${ctx.heures} h × 30 € = ${ctx.heures * 30} €.</div>
   <label class="form" style="margin:0"><span class="muted" style="font-size:12px">Message</span><textarea class="inp" id="cpMsg" rows="8">${esc(cpTexteReservation(s, ctx))}</textarea></label>
   <div class="form" style="margin-top:8px"><label>Téléphone de la cuisine (SMS)<input class="inp" id="cpTel" value="${esc(tel)}" placeholder="06…"></label></div>
   <div class="foot" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
    <button class="btn sm ghost" data-cp-copier>Copier</button><button class="btn sm ghost" data-cp-sms>SMS</button><button class="btn sm primary" data-cp-email>Envoyer par email</button></div>
  </div><div class="card">
   <b>Statut</b><div style="margin:8px 0">${{ a_reserver: '<span class="chip bad">à réserver</span>', envoyee: '<span class="chip warn">demande envoyée' + (s.message_envoye_le ? ' le ' + new Date(s.message_envoye_le).toLocaleString('fr-FR') : '') + '</span>', confirmee: '<span class="chip ok">confirmée</span>' }[st] || st}</div>
   <p class="muted" style="font-size:12.5px">Tant que la cuisine n’est pas confirmée, les courses sont à risque (§4.2).</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap">${st !== 'confirmee' ? '<button class="btn sm primary" data-cp-resa="confirmee">Marquer confirmée</button>' : ''}${st !== 'a_reserver' ? '<button class="btn sm ghost" data-cp-resa="a_reserver">Repasser à réserver</button>' : ''}</div>
  </div></div>`;
}

/* La liste de courses de la session : les totaux RÉELS de chaque lot (grammes
   de chaque client, base de recette, corrections comprises) — exactement ce
   que la cuisine pèsera. */
function cpLignesCourses(ctx) {
  const E = NattyProd.etat, m = {};
  ctx.lots.forEach(l => Object.keys(l.ingTot).forEach(nom => {
    const ing = (E.ings[l.rec.id] || []).find(i => i.ingredient_nom === nom), u = (ing && ing.unite) || 'g';
    const k = nom.trim().toLowerCase() + '|' + u;
    if (!m[k]) m[k] = { nom: nom.trim(), unite: u, q: 0, recs: new Set() };
    m[k].q += l.ingTot[nom]; m[k].recs.add(l.rec.nom);
  }));
  return Object.values(m).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
function cpCourses(ctx) {
  const lignes = cpLignesCourses(ctx);
  return `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px"><button class="btn sm ghost" data-cp-courses-copier>Copier</button><button class="btn sm primary" data-cp-courses-print>Imprimer</button></div>
  <div class="tbl-wrap"><table><thead><tr><th>Ingrédient</th><th>Quantité</th><th>Recettes</th></tr></thead><tbody>${lignes.map(l => `<tr><td>${esc(l.nom)}</td><td class="num">${cpQ(l.q, l.unite)}</td><td class="muted">${esc([...l.recs].join(', '))}</td></tr>`).join('')}</tbody></table></div>`;
}
function cpTexteCourses(ctx, s) { return 'Liste de courses — session du ' + cpJ(s.jour) + '\n' + cpLignesCourses(ctx).map(l => '- ' + l.nom + ' : ' + cpQ(l.q, l.unite)).join('\n'); }

/* ─────────────── L'itinéraire de livraison ───────────────
   Les arrêts sont les commandes des jours de livraison de la session, avec
   leur adresse. Les adresses sont géocodées par la Base Adresse Nationale
   (api-adresse.data.gouv.fr, service public, gratuit) AU CLIC seulement, puis
   ordonnées par plus proche voisin + 2-opt à vol d'oiseau depuis la cuisine.
   C'est une estimation de l'ordre, pas un calcul routier : l'ordre reste
   modifiable à la main, et Google Maps calcule le trajet réel. */
function cpArrets(s, ctx) {
  const bons = ctx.bons.filter(b => b.statut !== 'annule');
  const ordre = s.itineraire || [];
  return bons.slice().sort((a, b) => { const ia = ordre.indexOf(a.id), ib = ordre.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
}
function cpLivraison(s, ctx) {
  const arrets = cpArrets(s, ctx), depart = s.adresse_depart || cpReglage('adresse_cuisine', '');
  const sansAdr = arrets.filter(b => !b.adresse);
  const geo = CP.itin && CP.itin.sid === s.id ? CP.itin : null;
  return `<div class="form" style="margin:0 0 10px"><div class="two"><label>Départ (adresse de la cuisine)<input class="inp" id="cpDepart" value="${esc(depart)}" placeholder="Adresse de la cuisine"></label><label>Livraison<input class="inp" disabled value="${esc(s.jours_livraison.map(fd).join(', ') || '—')} · créneau 11 h–13 h"></label></div></div>
  ${sansAdr.length ? `<div class="exbar"><span class="chip bad">${sansAdr.length}</span><span>commande(s) sans adresse — à compléter dans Commandes → Modifier, elles restent hors tournée.</span></div>` : ''}
  <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-bottom:10px"><button class="btn sm ghost" data-cp-itin-calc>Calculer l’ordre de tournée</button><button class="btn sm ghost" data-cp-itin-maps ${arrets.some(b => b.adresse) ? '' : 'disabled'}>Ouvrir dans Google Maps</button><button class="btn sm primary" data-cp-itin-pdf ${arrets.length ? '' : 'disabled'}>📄 PDF de tournée</button></div>
  <div class="list">${arrets.map((b, i) => `<div class="li"><b class="num" style="width:22px">${i + 1}</b><div class="grow"><b style="font-weight:500">${esc(cpNomClient(b))} · ${b.nb_repas} repas</b><div class="meta">${esc(b.adresse || 'sans adresse')}${geo && geo.dist && geo.dist[b.id] != null ? ' · ' + geo.dist[b.id].toFixed(1).replace('.', ',') + ' km depuis l’arrêt précédent' : ''}${geo && geo.echecs && geo.echecs.indexOf(b.id) >= 0 ? ' · <span style="color:var(--red)">adresse introuvable</span>' : ''}</div></div>
    <button class="btn sm ghost" data-cp-itin-monter="${b.id}" ${i ? '' : 'disabled'} aria-label="Monter">↑</button><button class="btn sm ghost" data-cp-itin-descendre="${b.id}" ${i < arrets.length - 1 ? '' : 'disabled'} aria-label="Descendre">↓</button></div>`).join('') || '<div class="empty">Aucune commande à livrer pour ces jours.</div>'}</div>
  ${geo && geo.total ? `<p class="muted" style="font-size:12.5px;margin-top:8px">≈ ${geo.total.toFixed(1).replace('.', ',')} km à vol d’oiseau pour la boucle — Google Maps donne le trajet réel.</p>` : ''}
  <p class="muted" style="font-size:12px;margin-top:6px">« Calculer l’ordre » envoie les adresses à la Base Adresse Nationale (api-adresse.data.gouv.fr) pour les situer. Rien n’est envoyé tant que vous ne cliquez pas.</p>`;
}
async function cpGeocoder(adresse) {
  const r = await fetch('https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(adresse));
  if (!r.ok) throw new Error('géocodage ' + r.status);
  const j = await r.json(), f = j.features && j.features[0];
  return f ? { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] } : null;
}
const cpKm = (a, b) => { const R = 6371, t = x => x * Math.PI / 180, dl = t(b.lat - a.lat), dn = t(b.lon - a.lon), h = Math.sin(dl / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function cpCalculerItineraire(s, ctx) {
  const depart = ($('#cpDepart') && $('#cpDepart').value.trim()) || '';
  if (!depart) { toast('Renseignez l’adresse de la cuisine'); return; }
  cpReglageEcrire('adresse_cuisine', depart);
  const arrets = cpArrets(s, ctx).filter(b => b.adresse);
  if (!arrets.length) { toast('Aucune adresse à ordonner'); return; }
  toast('Localisation des adresses…');
  const pts = {}, echecs = [];
  const o = await cpGeocoder(depart).catch(() => null);
  if (!o) { toast('Adresse de la cuisine introuvable'); return; }
  for (const b of arrets) { const p = await cpGeocoder(b.adresse).catch(() => null); if (p) pts[b.id] = p; else echecs.push(b.id); }
  const ids = Object.keys(pts);
  // plus proche voisin depuis la cuisine, puis 2-opt sur la boucle
  let ordre = [], cur = o, reste = ids.slice();
  while (reste.length) { reste.sort((a, b) => cpKm(cur, pts[a]) - cpKm(cur, pts[b])); const n = reste.shift(); ordre.push(n); cur = pts[n]; }
  const P = i => i < 0 || i >= ordre.length ? o : pts[ordre[i]];
  let mieux = true, garde = 0;
  while (mieux && garde++ < 200) {
    mieux = false;
    for (let i = 0; i < ordre.length - 1; i++) for (let k = i + 1; k < ordre.length; k++) {
      const avant = cpKm(P(i - 1), P(i)) + cpKm(P(k), P(k + 1)), apres = cpKm(P(i - 1), P(k)) + cpKm(P(i), P(k + 1));
      if (apres + 1e-9 < avant) { ordre = ordre.slice(0, i).concat(ordre.slice(i, k + 1).reverse(), ordre.slice(k + 1)); mieux = true; }
    }
  }
  const dist = {}; let prec = o, total = 0;
  ordre.forEach(id => { dist[id] = cpKm(prec, pts[id]); total += dist[id]; prec = pts[id]; });
  total += cpKm(prec, o);
  const complet = ordre.concat(cpArrets(s, ctx).map(b => b.id).filter(id => ordre.indexOf(id) < 0));
  CP.itin = { sid: s.id, dist, total, echecs };
  await cpSauver(s.id, { itineraire: complet, adresse_depart: depart });
  toast('Tournée ordonnée' + (echecs.length ? ' — ' + echecs.length + ' adresse(s) introuvable(s)' : '')); render();
}
function cpOuvrirMaps(s, ctx) {
  const depart = ($('#cpDepart') && $('#cpDepart').value.trim()) || s.adresse_depart || cpReglage('adresse_cuisine', '');
  const adr = cpArrets(s, ctx).filter(b => b.adresse).map(b => b.adresse);
  if (!adr.length) return;
  // Google Maps accepte une dizaine d'étapes dans une URL : au-delà, on coupe en tronçons
  const troncons = []; for (let i = 0; i < adr.length; i += 9) troncons.push(adr.slice(i, i + 9));
  troncons.forEach((t, k) => {
    const origine = k === 0 ? depart : troncons[k - 1][troncons[k - 1].length - 1];
    const u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + encodeURIComponent(origine || t[0])
      + '&destination=' + encodeURIComponent(t[t.length - 1]) + (t.length > 1 ? '&waypoints=' + encodeURIComponent(t.slice(0, -1).join('|')) : '');
    window.open(u, '_blank', 'noopener');
  });
}
async function cpPdfTournee(s, ctx) {
  const d = await cpJsPDF(); if (!d) return;
  const doc = new d({ unit: 'mm', format: 'a4' }), pt = x => String(x == null ? '' : x).replace(/[’‘]/g, "'").replace(/[—–]/g, '-').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
  doc.setFillColor(16, 16, 20); doc.rect(0, 0, 210, 24, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text(pt('Tournée de livraison'), 14, 14); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(pt((s.jours_livraison.map(fd).join(', ') || '') + ' · créneau 11 h - 13 h · départ : ' + (s.adresse_depart || cpReglage('adresse_cuisine', '') || '-')), 14, 20);
  doc.setTextColor(20, 20, 26); let y = 34;
  cpArrets(s, ctx).forEach((b, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const recs = NattyProd.etat.attribs.filter(a => a.bon_id === b.id).map(a => ((NattyProd.etat.recettes.find(r => r.id === a.recette_id) || {}).nom || 'Recette') + ' × ' + a.nb_portions).join(', ');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(pt((i + 1) + '. ' + cpNomClient(b) + ' - ' + b.nb_repas + ' repas'), 14, y); y += 5.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.splitTextToSize(pt(b.adresse || 'SANS ADRESSE'), 180).forEach(l => { doc.text(l, 20, y); y += 4.6; });
    doc.setTextColor(110, 110, 120); doc.splitTextToSize(pt(recs), 180).forEach(l => { doc.text(l, 20, y); y += 4.4; }); doc.setTextColor(20, 20, 26);
    doc.rect(190, y - 9, 5, 5); y += 4;
  });
  doc.save('Tournee_' + (s.jours_livraison[0] || s.jour) + '.pdf');
}
function cpJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise(ok => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; sc.onload = () => ok(window.jspdf && window.jspdf.jsPDF); sc.onerror = () => { toast('Impossible de charger le générateur de PDF'); ok(null); }; document.head.appendChild(sc); });
}

/* L'invitation RH : une réunion « Session de production » sur le créneau,
   les membres cochés invités (popup + email + .ics), l'organisateur
   confirmé d'office. Mise à jour : horaires réécrits (ics_sequence + 1, le
   calendrier des invités se met à jour au lieu de dupliquer) et nouveaux
   membres invités. */
async function cpMettreAuRH(s, ctx) {
  await chargerRH(true);
  const E = NattyProd.etat, noms = s.recettes.map(id => (E.recettes.find(r => r.id === id) || {}).nom).filter(Boolean);
  const debut = new Date(s.jour + 'T' + (s.creneau_debut || '08:00').slice(0, 5) + ':00'), fin = new Date(s.jour + 'T' + ctx.finCreneau + ':00');
  const titre = 'Session de production', description = 'Recettes : ' + (noms.join(', ') || '—') + '\nLivraison : ' + (s.jours_livraison.map(fd).join(', ') || '—');
  const lieu = s.adresse_depart || cpReglage('adresse_cuisine', '') || 'Cuisine';
  let reunion = s.reunion_id ? RH_CACHE.reunions.find(r => r.id === s.reunion_id) : null;
  if (reunion) {
    const seq = (reunion.ics_sequence || 0) + 1;
    await sb('reunions?id=eq.' + reunion.id, { method: 'PATCH', body: JSON.stringify({ date_debut: debut.toISOString(), date_fin: fin.toISOString(), description, lieu, ics_sequence: seq, updated_at: new Date().toISOString() }) });
    Object.assign(reunion, { date_debut: debut.toISOString(), date_fin: fin.toISOString(), ics_sequence: seq });
  } else {
    reunion = (await sb('reunions', { method: 'POST', body: JSON.stringify({ titre, description, organisateur: STAFF_SESSION.user_id, date_debut: debut.toISOString(), date_fin: fin.toISOString(), lieu, statut: 'confirmee' }) }))[0];
    await sb('participations', { method: 'POST', body: JSON.stringify({ evenement_type: 'reunion', evenement_id: reunion.id, membre: reunion.organisateur, statut: s.equipe.indexOf(reunion.organisateur) >= 0 ? 'confirme' : 'confirme', confirme_le: new Date().toISOString() }) });
    await cpSauver(s.id, { reunion_id: reunion.id });
  }
  const deja = (await sbTry('participations?evenement_id=eq.' + reunion.id + '&select=membre')).data || [];
  let invites = 0;
  for (const membre of s.equipe) {
    if (deja.some(p => p.membre === membre)) continue;
    const part = (await sb('participations', { method: 'POST', body: JSON.stringify({ evenement_type: 'reunion', evenement_id: reunion.id, membre, statut: 'invite' }) }))[0];
    const r2 = await appelNotification({ destinataire: membre, objet_type: 'reunion', objet_id: reunion.id, titre: titre + ' — ' + cpJ(s.jour), message: description, canal: 'popup+email', date_debut: reunion.date_debut, date_fin: reunion.date_fin, uid: 'reunion-' + reunion.id + '-' + membre + '@natty' });
    if (r2 && r2.notification) await sb('participations?id=eq.' + part.id, { method: 'PATCH', body: JSON.stringify({ notification_id: r2.notification.id }) });
    invites++;
  }
  await chargerRH(true);
  toast(s.reunion_id ? 'Calendrier RH mis à jour' + (invites ? ', ' + invites + ' invitation(s)' : '') : 'Session au calendrier RH' + (invites ? ', ' + invites + ' invitation(s) envoyée(s)' : ''));
  render();
}

/* ─────────────────────── les gestes de la vue ─────────────────────── */
document.addEventListener('click', async e => {
  const t = e.target;
  const ouv = t.closest('[data-cp-ouvrir]'); if (ouv) { CP.id = ouv.dataset.cpOuvrir; CP.onglet = 'planning'; CP.itin = null; render(); return; }
  if (t.closest('[data-cp-retour]')) { CP.id = null; render(); return; }
  const ong = t.closest('[data-cp-onglet]'); if (ong) { CP.onglet = ong.dataset.cpOnglet; render(); return; }
  const s = CP.s, ctx = CP.ctx;
  if (!s || !ctx) return;
  const rec = t.closest('[data-cp-recette]');
  if (rec) { const id = rec.dataset.cpRecette, l = s.recettes.slice(), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); await cpSauver(s.id, { recettes: l }); render(); return; }
  const pdf = t.closest('[data-cp-pdf]'); if (pdf) { NattyProd.pdfSession(ctx, pdf.dataset.cpPdf, pdf, s.jour); return; }
  if (t.closest('[data-cp-pdf-tout]')) {
    const b = t.closest('[data-cp-pdf-tout]'); const pl = ctx.postes.filter(p => p.lots.length);
    pl.forEach((p, i) => setTimeout(() => NattyProd.pdfSession(ctx, p.cle, i === pl.length - 1 ? b : null, s.jour), i * 1600));
    if (!pl.length) toast('Rien à produire'); return;
  }
  if (t.closest('[data-cp-supprimer]')) {
    if (!confirm('Supprimer cette session ? La réunion RH éventuelle reste dans le calendrier (à annuler depuis RH).')) return;
    await sb('crm_sessions?id=eq.' + s.id, { method: 'DELETE' }); try { localStorage.removeItem('natty_session_' + s.id); } catch (er) {}
    CP.id = null; toast('Session supprimée'); render(); return;
  }
  if (t.closest('[data-cp-nb-equipe]')) { await cpSauver(s.id, { nb_personnes: s.equipe.length }); render(); return; }
  if (t.closest('[data-cp-rh]')) { const b = t.closest('[data-cp-rh]'); b.disabled = true; try { await cpMettreAuRH(s, ctx); } catch (er) { toast('Calendrier RH : ' + String(er.message || er).slice(0, 140)); b.disabled = false; } return; }
  if (t.closest('[data-cp-copier]')) { await cpCopier($('#cpMsg').value); return; }
  if (t.closest('[data-cp-sms]')) {
    const tel = $('#cpTel').value.trim(); cpReglageEcrire('cuisine_tel', tel);
    window.open('sms:' + encodeURIComponent(tel) + '?body=' + encodeURIComponent($('#cpMsg').value));
    await cpSauver(s.id, { statut_reservation: 'envoyee', message_envoye_le: new Date().toISOString(), creneau_fin: ctx.finCreneau });
    toast('SMS ouvert — réservation marquée envoyée'); render(); return;
  }
  if (t.closest('[data-cp-email]')) {
    const b = t.closest('[data-cp-email]'); b.disabled = true;
    const body = { action: 'reserver_cuisine', date: s.jour, heure_debut: (s.creneau_debut || '08:00').slice(0, 5), heure_fin: ctx.finCreneau, nb_personnes: Math.max(s.nb_personnes || 1, s.equipe.length || 0), note: $('#cpMsg').value };
    let data = {}, ok = false;
    try { const res = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jetonStaff() }, body: JSON.stringify(body) }); data = await res.json().catch(() => ({})); ok = res.ok && data.ok; } catch (er) {}
    if (ok) { await cpSauver(s.id, { statut_reservation: 'envoyee', message_envoye_le: new Date().toISOString(), creneau_fin: ctx.finCreneau }); toast('Demande envoyée par email à la cuisine'); render(); }
    else { b.disabled = false; toast(data.degrade ? 'Email non configuré (' + (data.error || '') + ') — utilisez SMS ou Copier' : 'Échec de l’envoi : ' + (data.error || 'erreur inconnue')); }
    return;
  }
  const resa = t.closest('[data-cp-resa]'); if (resa) { await cpSauver(s.id, { statut_reservation: resa.dataset.cpResa }); render(); return; }
  if (t.closest('[data-cp-courses-copier]')) { await cpCopier(cpTexteCourses(ctx, s)); return; }
  if (t.closest('[data-cp-courses-print]')) {
    const w = window.open('', '_blank'); if (!w) { toast('Fenêtre bloquée par le navigateur'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Liste de courses</title><style>body{font:14px system-ui,sans-serif;margin:28px}td{padding:5px 10px;border-bottom:1px solid #ddd}td:nth-child(2){text-align:right;white-space:nowrap}</style><h1 style="font-size:18px">Liste de courses — session du ${esc(cpJ(s.jour))}</h1><table>${cpLignesCourses(ctx).map(l => `<tr><td>☐ ${esc(l.nom)}</td><td>${esc(cpQ(l.q, l.unite))}</td><td style="color:#888">${esc([...l.recs].join(', '))}</td></tr>`).join('')}</table>`);
    w.document.close(); w.focus(); w.print(); return;
  }
  if (t.closest('[data-cp-itin-calc]')) { await cpCalculerItineraire(s, ctx); return; }
  if (t.closest('[data-cp-itin-maps]')) { cpOuvrirMaps(s, ctx); return; }
  if (t.closest('[data-cp-itin-pdf]')) { await cpPdfTournee(s, ctx); return; }
  const mo = t.closest('[data-cp-itin-monter],[data-cp-itin-descendre]');
  if (mo) {
    const ids = cpArrets(s, ctx).map(b => b.id), id = mo.dataset.cpItinMonter || mo.dataset.cpItinDescendre, i = ids.indexOf(id), j = mo.dataset.cpItinMonter ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]]; CP.itin = null; await cpSauver(s.id, { itineraire: ids }); render(); return;
  }
});
document.addEventListener('change', async e => {
  const t = e.target, s = CP.s; if (!s) return;
  const ch = t.closest('[data-cp-champ]');
  if (ch) {
    let v = ch.value; if (ch.dataset.cpChamp === 'nb_personnes') v = Math.max(1, Math.min(12, parseInt(v, 10) || 1));
    if (!v) return;
    await cpSauver(s.id, { [ch.dataset.cpChamp]: v, statut_reservation: s.statut_reservation === 'confirmee' && ch.dataset.cpChamp !== 'nb_personnes' ? 'a_reserver' : s.statut_reservation });
    if (s.statut_reservation === 'confirmee' && ch.dataset.cpChamp !== 'nb_personnes') toast('Horaire changé : la réservation de la cuisine est à refaire');
    render(); return;
  }
  const mb = t.closest('[data-cp-membre]');
  if (mb) { const l = s.equipe.slice(), id = mb.dataset.cpMembre, i = l.indexOf(id); if (mb.checked && i < 0) l.push(id); if (!mb.checked && i >= 0) l.splice(i, 1); await cpSauver(s.id, { equipe: l }); render(); return; }
  if (t.id === 'cpDepart') { cpReglageEcrire('adresse_cuisine', t.value.trim()); await cpSauver(s.id, { adresse_depart: t.value.trim() }); }
});
async function cpCopier(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Copié'); }
  catch (e) { const x = document.createElement('textarea'); x.value = txt; document.body.appendChild(x); x.select(); document.execCommand('copy'); x.remove(); toast('Copié'); }
}

/* ─────────────────────── 3. Commandes, en natif ─────────────────────── */
const CMD = { filtre: 'tous', q: '' };
async function vCommandesNatif() {
  const E = await chargerProd();
  if (!E) return '<div class="exbar"><span class="chip bad">Illisible</span><span>Impossible de lire les commandes — session d’équipe requise.</span></div>';
  const st = b => { const n = E.attribs.filter(a => a.bon_id === b.id).reduce((t, a) => t + (a.nb_portions || 0), 0); return b.statut === 'livre' || b.statut === 'en_production' || b.statut === 'annule' ? b.statut : (n >= b.nb_repas && n > 0 ? 'attribue' : 'a_attribuer'); };
  const tous = E.bons.filter(b => b.statut !== 'annule');
  const compte = { tous: tous.filter(b => st(b) !== 'livre').length, rouge: tous.filter(b => st(b) === 'a_attribuer' || !b.jour_livraison).length, attribue: tous.filter(b => st(b) === 'attribue' || st(b) === 'en_production').length, livre: tous.filter(b => st(b) === 'livre').length };
  const q = CMD.q.trim().toLowerCase();
  const list = tous.filter(b => {
    const x = st(b);
    if (CMD.filtre === 'rouge' && !(x === 'a_attribuer' || !b.jour_livraison)) return false;
    if (CMD.filtre === 'attribue' && !(x === 'attribue' || x === 'en_production')) return false;
    if (CMD.filtre === 'livre' && x !== 'livre') return false;
    if (CMD.filtre === 'tous' && x === 'livre') return false;
    return !q || (cpNomClient(b) + ' ' + (b.adresse || '') + ' ' + (b.notes || '')).toLowerCase().indexOf(q) >= 0;
  }).sort((a, b) => (a.jour_livraison || '0000').localeCompare(b.jour_livraison || '0000'));
  const carte = b => {
    const x = st(b), att = E.attribs.filter(a => a.bon_id === b.id), pa = att.reduce((t, a) => t + a.nb_portions, 0);
    const recs = att.map(a => ((E.recettes.find(r => r.id === a.recette_id) || {}).nom || 'Recette') + ' × ' + a.nb_portions).join(' · ');
    return `<div class="card cmd ${x === 'a_attribuer' || !b.jour_livraison ? 'rouge' : (x === 'attribue' ? 'vert' : '')}"><div class="cmd-g"><b>${esc(cpNomClient(b))}</b> <span class="muted">· ${esc({ abonnement: 'Abonnement', unite: 'À l’unité', manuel: 'Manuelle' }[b.type] || b.type)}</span>
      <div class="muted" style="font-size:12px">${b.jour_livraison ? 'Livraison ' + esc(cpJ(b.jour_livraison)) : '<span style="color:var(--red)">sans date de livraison</span>'} · ${esc(b.adresse || 'adresse non renseignée')}</div>
      ${recs ? `<div style="font-size:12.5px;margin-top:4px">🍽 ${esc(recs)}${pa !== b.nb_repas ? ` <b style="color:var(--red)">(${pa}/${b.nb_repas})</b>` : ''}</div>` : ''}</div>
      <div class="cmd-d"><label class="muted" style="font-size:12px">Repas <input class="inp" type="number" min="1" max="40" data-cmd-nb="${b.id}" value="${b.nb_repas}"></label><input class="inp" type="date" data-cmd-jour="${b.id}" value="${b.jour_livraison || ''}">${chipStatut(x)}
      <button class="btn sm primary" data-edit-bon="${b.id}">${att.length ? 'Modifier' : 'Attribuer'} →</button>${x === 'attribue' || x === 'en_production' ? `<button class="btn sm ghost" data-cmd-livre="${b.id}">Livré ✓</button>` : ''}<button class="btn sm ghost" data-cmd-annuler="${b.id}" title="Annuler ce bon">✕</button></div></div>`;
  };
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
   <div class="tabs" style="margin:0">${[['tous', 'En cours'], ['rouge', 'À traiter'], ['attribue', 'Attribués'], ['livre', 'Livrés']].map(([k, l]) => `<button data-cmd-filtre="${k}" aria-selected="${CMD.filtre === k}">${l} <span class="b">${compte[k]}</span></button>`).join('')}</div>
   <input class="inp" id="cmdQ" placeholder="Rechercher un client, une adresse…" value="${esc(CMD.q)}" style="max-width:260px">
   <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm ghost" data-cmd-abos>Générer depuis les abonnements actifs</button><button class="btn sm primary" data-new-bon="">+ Nouvelle commande</button></span></div>
  <div class="list-cmd">${list.map(carte).join('') || '<div class="empty">Aucune commande ici.</div>'}</div>`;
}
document.addEventListener('click', async e => {
  const f = e.target.closest('[data-cmd-filtre]'); if (f) { CMD.filtre = f.dataset.cmdFiltre; render(); return; }
  const lv = e.target.closest('[data-cmd-livre]'); if (lv) { await sb('bons_commande?id=eq.' + lv.dataset.cmdLivre, { method: 'PATCH', body: JSON.stringify({ statut: 'livre', updated_at: new Date().toISOString() }) }); toast('Marquée livrée'); await chargerProd(true); render(); return; }
  const an = e.target.closest('[data-cmd-annuler]'); if (an) { if (!confirm('Annuler cette commande ?')) return; await sb('bons_commande?id=eq.' + an.dataset.cmdAnnuler, { method: 'PATCH', body: JSON.stringify({ statut: 'annule', updated_at: new Date().toISOString() }) }); toast('Commande annulée'); await chargerProd(true); render(); return; }
  if (e.target.closest('[data-cmd-abos]')) {
    const lundi = lundiLocal(new Date()); lundi.setDate(lundi.getDate() + 7); const sem = isoLocal(lundi);
    const E = await chargerProd(true);
    const r = await sbTry('abonnements?statut=eq.actif&select=id,user_id,formule');
    if (!r.ok) { toast('Abonnements illisibles'); return; }
    const deja = {}; E.bons.forEach(b => { if (b.semaine === sem) deja[b.user_id] = 1; });
    const rows = r.data.filter(a => !deja[a.user_id]).map(a => ({ user_id: a.user_id, type: 'abonnement', nb_repas: parseInt(String(a.formule || '').split('_')[0], 10) || 3, semaine: sem, jour_livraison: null, abonnement_id: a.id, statut: 'a_attribuer', notes: 'Généré depuis l’abonnement (semaine du ' + fd(sem) + ')' }));
    if (!rows.length) { toast('Rien à générer : chaque abonné a déjà sa commande pour la semaine du ' + fd(sem)); return; }
    await sb('bons_commande', { method: 'POST', body: JSON.stringify(rows) }); toast(rows.length + ' commande(s) créée(s) — dates de livraison à poser'); await chargerProd(true); render(); return;
  }
});
document.addEventListener('change', async e => {
  const nb = e.target.closest('[data-cmd-nb]'), jr = e.target.closest('[data-cmd-jour]');
  if (!nb && !jr) return;
  const id = (nb || jr).dataset.cmdNb || (nb || jr).dataset.cmdJour, E = await chargerProd(), b = E && E.bons.find(x => x.id === id);
  const patch = { updated_at: new Date().toISOString() };
  if (nb) { const n = parseInt(nb.value, 10); if (!(n >= 1 && n <= 40)) { toast('Entre 1 et 40 repas'); nb.value = b ? b.nb_repas : 1; return; } patch.nb_repas = n;
    if (b && (b.statut === 'a_attribuer' || b.statut === 'attribue')) { const pa = E.attribs.filter(a => a.bon_id === id).reduce((t, a) => t + a.nb_portions, 0); patch.statut = pa >= n && pa > 0 ? 'attribue' : 'a_attribuer'; } }
  if (jr) { patch.jour_livraison = jr.value || null; patch.semaine = jr.value ? isoLocal(lundiLocal(new Date(jr.value + 'T00:00:00'))) : null; }
  await sb('bons_commande?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(patch) }); toast('Enregistré'); await chargerProd(true); render();
});
document.addEventListener('input', e => {
  if (e.target.id !== 'cmdQ') return;
  CMD.q = e.target.value; clearTimeout(CMD.t);
  CMD.t = setTimeout(() => { const pos = e.target.selectionStart; render().then(() => { const i = $('#cmdQ'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }); }, 250);
});

/* ─────────────── 4. La base d'une recette (ratios + tags), en natif ─────────────── */
async function ouvrirBaseRecette(recId, apres) {
  const E = await chargerProd(); if (!E) return;
  const r = E.recettes.find(x => x.id === recId); if (!r) return;
  const nb = NattyProd.fiche(r).nb || 1, R0 = NattyProd.ratiosDe(r), ings = E.ings[recId] || [];
  const TAGS = [['proteine', 'Protéine'], ['feculent', 'Féculent'], ['lipide', 'Lipide'], ['legume', 'Légume'], ['aromate', 'Aromate']];
  modal(`<h2>Base de la recette</h2><p class="muted" style="margin:-4px 0 10px;font-size:12.5px">${esc(r.nom)} — la répartition du plat (% des kcal) et le rôle de chaque ingrédient. Vaut pour tous les clients de cette recette ; leurs macros ajustent ensuite autour.</p>
  <form class="form" id="brForm"><div class="two" style="grid-template-columns:repeat(3,1fr)">${['p', 'g', 'l'].map(m => `<label>${{ p: 'Protéines', g: 'Glucides', l: 'Lipides' }[m]} %<input class="inp" type="number" min="0" max="100" data-br="${m}" value="${Math.round(R0[m])}"></label>`).join('')}</div>
   <span class="muted" id="brSomme" style="font-size:12px"></span>
   <div class="tbl-wrap"><table><thead><tr><th>Ingrédient</th><th>Tag</th><th>Pour 100 g</th></tr></thead><tbody>${ings.map((i, k) => { const t = NattyProd.tagDe(i, nb); return `<tr><td>${esc(i.ingredient_nom)}${i.tag ? '' : ' <span class="muted" style="font-size:11px">auto</span>'}</td><td><select class="inp" data-br-tag="${k}">${TAGS.map(([v, l]) => `<option value="${v}"${v === t ? ' selected' : ''}>${l}</option>`).join('')}</select></td><td class="muted" style="font-size:12px">${esc(cpNutri(i.ingredient_nom))}</td></tr>`; }).join('')}</tbody></table></div>
   <div class="foot"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary" type="submit">Enregistrer la base</button></div></form>`);
  const somme = () => { const s = ['p', 'g', 'l'].reduce((t, m) => t + (+document.querySelector('[data-br="' + m + '"]').value || 0), 0); $('#brSomme').innerHTML = s === 100 ? 'Total 100 %' : '<b style="color:var(--red)">Total ' + s + ' % — doit faire 100 %</b>'; return s; };
  document.querySelectorAll('[data-br]').forEach(i => i.addEventListener('input', somme)); somme();
  $('#brForm').onsubmit = async e => {
    e.preventDefault();
    if (somme() !== 100) { toast('La répartition doit faire 100 %'); return; }
    const ratios = {}; ['p', 'g', 'l'].forEach(m => ratios[m] = +document.querySelector('[data-br="' + m + '"]').value || 0);
    try {
      await sb('recettes?id=eq.' + recId, { method: 'PATCH', body: JSON.stringify({ ratios }) });
      for (const sel of document.querySelectorAll('[data-br-tag]')) {
        const i = ings[+sel.dataset.brTag]; if (!i || !i.id) continue;
        // un tag resté sur sa valeur automatique n'est pas écrit : il suivra l'aliment si la base change
        const auto = NattyProd.tagDe(Object.assign({}, i, { tag: null }), nb);
        if (i.tag ? sel.value === i.tag : sel.value === auto) continue;
        await sb('recettes_ingredients?id=eq.' + i.id, { method: 'PATCH', body: JSON.stringify({ tag: sel.value }) });
      }
      closeAll(); await chargerProd(true); toast('Base de « ' + r.nom + ' » enregistrée'); if (apres) apres(); else render();
    } catch (err) { toast(cpColonneAbsente(err) ? 'Impossible : exécuter supabase/migrations/0010_recettes_ratios_tags.sql' : 'Erreur : ' + String(err.message || err).slice(0, 120)); }
  };
}
function cpNutri(nom) {
  const n = NattyProd.nutri100 && NattyProd.nutri100(nom);
  return n ? Math.round(+n.cal_per_100g || 0) + ' kcal · ' + Math.round(+n.prot_per_100g || 0) + ' P · ' + Math.round(+n.gluc_per_100g || 0) + ' G · ' + Math.round(+n.lip_per_100g || 0) + ' L' : 'hors base';
}
