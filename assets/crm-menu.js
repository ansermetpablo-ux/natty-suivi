/* assets/crm-menu.js — Production → Menu : le menu de la semaine, en natif
   ═══════════════════════════════════════════════════════════════════════════
   Demande de Pablo (2026-09-28) : « voir les menus dans production, ajouter et
   retirer des plats comme sur admin ». C'est l'onglet « Menu de la semaine »
   d'admin.html (table `plats_menu`, ce que voient les clients dans l'app),
   refait dans le style du CRM : cartes avec photo, catégorie, kcal/protéines,
   Actif/Inactif, modifier, supprimer ; filtre par catégorie ; formulaire avec
   photo (Cloudinary, même preset qu'admin), macros, et ingrédients dont les
   macros se calculent depuis `ingredients_base`.

   Les ingrédients d'un plat vivent, comme dans admin, dans la RECETTE de même
   nom (`recettes` + `recettes_ingredients`) — trouvée, sinon créée. Différence
   voulue avec admin : les colonnes que la production a posées sur une ligne
   (unité, étiquette, ordre…) sont GARDÉES quand l'aliment reste dans la liste.
   admin réécrit la fiche avec le nom et les grammes seuls, ce qui effaçait
   l'étiquette « protéine » et l'unité d'une fiche technique.

   Rapprochement nom → macros : le nom normalisé exact, sinon le libellé qui
   contient TOUS les mots de l'aliment (motsProduit de crm.html). Jamais une
   sous-chaîne comme admin (« ail » dans « volaille »).

   Dépend de crm.html (sb, sbTry, esc, modal, closeAll, toast, render, $,
   CLOUDINARY_CLOUD, CLOUDINARY_PRESET, motsProduit) — chargé après lui.
   ═══════════════════════════════════════════════════════════════════════════ */

const MENU_CATS = { performance: ['⚡', 'Performance'], objectif: ['🎯', 'Objectif'], bien_etre: ['🌿', 'Bien-être'] };
const MENU = { cat: 'all', plats: null, base: null, ings: [], photo: null };

async function menuBase() {
  if (MENU.base) return MENU.base;
  const r = await sbTry('ingredients_base?select=nom,nom_normalise,cal_per_100g,prot_per_100g,gluc_per_100g,lip_per_100g&limit=2000');
  MENU.base = (r.ok ? r.data : []).map(x => ({ ...x, mots: motsProduit(x.nom_normalise || x.nom), cle: String(x.nom_normalise || x.nom || '').trim().toLowerCase() }));
  return MENU.base;
}
function menuMacros(nom) {
  const base = MENU.base || [], cle = String(nom || '').trim().toLowerCase();
  if (!cle) return null;
  let x = base.find(b => b.cle === cle || String(b.nom || '').trim().toLowerCase() === cle);
  if (!x) { const m = motsProduit(nom); if (m.length) x = base.filter(b => m.every(w => b.mots.includes(w))).sort((a, b) => a.mots.length - b.mots.length)[0]; }
  return x && (x.cal_per_100g != null || x.prot_per_100g != null) ? x : null;
}
function menuTotaux() {
  const t = { cal: 0, p: 0, g: 0, l: 0, connus: 0 };
  MENU.ings.forEach(i => { const m = menuMacros(i.nom), q = +i.g || 0; if (!m) return; t.connus++;
    t.cal += (+m.cal_per_100g || 0) * q / 100; t.p += (+m.prot_per_100g || 0) * q / 100; t.g += (+m.gluc_per_100g || 0) * q / 100; t.l += (+m.lip_per_100g || 0) * q / 100; });
  return t;
}

async function vProdMenu() {
  const r = await sbTry('plats_menu?order=created_at.desc&select=*');
  if (!r.ok) return `<div class="exbar"><span class="chip bad">Illisible</span><span>Impossible de lire <span class="mono">plats_menu</span> — session d'équipe requise.</span></div>`;
  MENU.plats = r.data;
  const list = MENU.cat === 'all' ? r.data : r.data.filter(p => p.categorie === MENU.cat);
  const actifs = r.data.filter(p => p.actif).length;
  const carte = p => {
    const c = MENU_CATS[p.categorie] || ['🍽', p.categorie || '—'];
    return `<div class="card menu-carte ${p.actif ? '' : 'off'}">
      <div class="menu-photo">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="" loading="lazy">` : `<span>${c[0]}</span>`}<span class="chip">${c[0]} ${esc(c[1])}</span></div>
      <div style="padding:12px 14px 14px"><b style="font-size:14px">${esc(p.nom)}</b>
       <div class="muted" style="font-size:12px;margin-top:3px;min-height:16px">${esc(p.description || '')}</div>
       <div class="muted" style="font-size:12px;margin-top:4px">${p.calories || '–'} kcal · ${p.proteines ?? '–'} g P · ${p.glucides ?? '–'} g G · ${p.lipides ?? '–'} g L</div>
       <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn sm ${p.actif ? 'primary' : ''}" type="button" data-menu-actif="${p.id}" title="${p.actif ? 'Visible dans l’app — cliquer pour retirer du menu' : 'Retiré du menu — cliquer pour le remettre'}">${p.actif ? '✓ Au menu' : '✗ Retiré'}</button>
        <button class="btn sm ghost" type="button" data-menu-edit="${p.id}">Modifier</button><button class="btn sm ghost" type="button" data-menu-suppr="${p.id}" title="Supprimer le plat">🗑</button></div></div></div>`;
  };
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
    <div class="tabs" style="margin:0">${[['all', 'Tous', r.data.length], ...Object.entries(MENU_CATS).map(([k, v]) => [k, v[0] + ' ' + v[1], r.data.filter(p => p.categorie === k).length])].map(([k, l, n]) => `<button data-menu-cat="${k}" aria-selected="${MENU.cat === k}">${l} <span class="b">${n}</span></button>`).join('')}</div>
    <span class="muted" style="font-size:12.5px">${actifs} plat${actifs > 1 ? 's' : ''} au menu</span>
    <span style="margin-left:auto"><button class="btn sm primary" type="button" data-menu-edit="">+ Ajouter un plat</button></span></div>
   <div class="grid g3 menu-grille">${list.map(carte).join('') || '<div class="empty">Aucun plat.</div>'}</div>
   <p class="muted" style="font-size:12px;margin-top:10px">Le menu de la semaine que voient les clients dans l’app (le même qu’admin.html). « Retiré » le cache sans le supprimer. Les ingrédients d’un plat sont ceux de la recette du même nom — la fiche technique qu’utilise la production.</p>`;
}

async function ouvrirPlatMenu(id) {
  await menuBase();
  const p = id ? (MENU.plats || []).find(x => x.id === id) : null;
  MENU.photo = p ? p.photo_url || null : null;
  MENU.ings = []; MENU.recette = null;
  if (p) {
    const rec = await sbTry('recettes?nom=eq.' + encodeURIComponent(p.nom) + '&select=id&limit=1');
    if (rec.ok && rec.data[0]) {
      MENU.recette = rec.data[0].id;
      const ings = await sbTry('recettes_ingredients?recette_id=eq.' + MENU.recette + '&select=*&order=ordre.asc');
      MENU.ings = (ings.ok ? ings.data : []).map(i => ({ nom: i.ingredient_nom || '', g: +i.quantite_g || 0, ligne: i }));
    }
  }
  const v = k => esc(p && p[k] != null ? p[k] : '');
  modal(`<h2>${p ? 'Modifier le plat' : 'Nouveau plat'}</h2>
  <form class="form" id="menuForm">
   <label>Nom<input class="inp" id="mfNom" required value="${v('nom')}" placeholder="ex. Bowl poulet quinoa"></label>
   <label>Description<input class="inp" id="mfDesc" value="${v('description')}" placeholder="ex. Poulet grillé, quinoa, légumes rôtis"></label>
   <div class="two"><label>Catégorie<select id="mfCat">${Object.entries(MENU_CATS).map(([k, c]) => `<option value="${k}"${(p ? p.categorie : 'bien_etre') === k ? ' selected' : ''}>${c[0]} ${c[1]}</option>`).join('')}</select></label>
    <label>Photo<div style="display:flex;gap:8px;align-items:center"><span id="mfPhotoAp" class="menu-mini">${MENU.photo ? `<img src="${esc(MENU.photo)}" alt="">` : '📷'}</span><input type="file" id="mfPhoto" accept="image/*" style="font-size:12px;min-width:0"></div></label></div>
   <label>Ingrédients <span class="muted" style="font-weight:400">— macros calculées depuis la base</span><div id="mfIngs"></div><button type="button" class="btn sm ghost" id="mfIngAjout" style="justify-self:start">+ Ajouter un ingrédient</button></label>
   <div class="two"><label>Calories<input class="inp" id="mfCal" type="number" min="0" step="any" value="${v('calories')}"></label><label>Protéines (g)<input class="inp" id="mfP" type="number" min="0" step="any" value="${v('proteines')}"></label></div>
   <div class="two"><label>Glucides (g)<input class="inp" id="mfG" type="number" min="0" step="any" value="${v('glucides')}"></label><label>Lipides (g)<input class="inp" id="mfL" type="number" min="0" step="any" value="${v('lipides')}"></label></div>
   <div class="foot">${p ? `<button type="button" class="btn danger" data-menu-suppr="${p.id}" style="margin-right:auto">Supprimer</button>` : ''}<button type="button" class="btn" data-close>Annuler</button><button class="btn primary" type="submit">${p ? 'Mettre à jour' : 'Enregistrer le plat'}</button></div>
  </form>`);
  menuPeindreIngs();
  $('#mfIngAjout').onclick = () => { MENU.ings.push({ nom: '', g: 100 }); menuPeindreIngs(); };
  $('#mfPhoto').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#mfPhotoAp').textContent = '…';
    try {
      const fd = new FormData(); fd.append('file', f); fd.append('upload_preset', CLOUDINARY_PRESET);
      const d = await (await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', { method: 'POST', body: fd })).json();
      if (!d.secure_url) throw new Error('échec');
      MENU.photo = d.secure_url; $('#mfPhotoAp').innerHTML = `<img src="${esc(d.secure_url)}" alt="">`; toast('Photo envoyée');
    } catch (err) { $('#mfPhotoAp').textContent = '✗'; toast('Échec de l’envoi de la photo'); }
  };
  $('#menuForm').onsubmit = e => { e.preventDefault(); enregistrerPlatMenu(p, e.submitter); };
}
function menuPeindreIngs() {
  const z = $('#mfIngs'); if (!z) return;
  z.innerHTML = MENU.ings.length ? MENU.ings.map((i, k) => {
    const m = menuMacros(i.nom), q = +i.g || 0;
    return `<div class="menu-ing"><input class="inp" data-mi-nom="${k}" list="mfIngListe" value="${esc(i.nom)}" placeholder="Aliment"><input class="inp" data-mi-g="${k}" type="number" min="0" step="any" value="${q}"><span class="muted">g</span>
      <span class="muted" style="font-size:11.5px">${m ? Math.round((+m.cal_per_100g || 0) * q / 100) + ' kcal · ' + Math.round((+m.prot_per_100g || 0) * q / 10) / 10 + ' P' : i.nom ? '<span style="color:var(--amber)">pas dans la base</span>' : ''}</span>
      <button type="button" class="btn sm ghost" data-mi-suppr="${k}">×</button></div>`;
  }).join('') + `<datalist id="mfIngListe">${(MENU.base || []).map(b => `<option value="${esc(b.nom)}">`).join('')}</datalist>` : '<div class="muted" style="font-size:12px;padding:4px 0">Aucun ingrédient.</div>';
}
/* Les macros suivent les ingrédients — seulement quand au moins un est connu,
   pour ne pas écraser à zéro des macros saisies à la main. */
function menuReporterMacros() {
  const t = menuTotaux(); if (!t.connus) return;
  $('#mfCal').value = Math.round(t.cal); $('#mfP').value = Math.round(t.p * 10) / 10; $('#mfG').value = Math.round(t.g * 10) / 10; $('#mfL').value = Math.round(t.l * 10) / 10;
}
document.addEventListener('input', e => {
  const n = e.target.closest('[data-mi-nom]'), g = e.target.closest('[data-mi-g]');
  if (n) MENU.ings[+n.dataset.miNom].nom = n.value;
  if (g) { MENU.ings[+g.dataset.miG].g = +g.value || 0; menuReporterMacros(); }
});
document.addEventListener('change', e => {
  if (e.target.closest('[data-mi-nom]')) { menuPeindreIngs(); menuReporterMacros(); }
});
document.addEventListener('click', async e => {
  const c = e.target.closest('[data-menu-cat]'); if (c) { MENU.cat = c.dataset.menuCat; render(); return; }
  const ed = e.target.closest('[data-menu-edit]'); if (ed) { ouvrirPlatMenu(ed.dataset.menuEdit || null); return; }
  const s = e.target.closest('[data-mi-suppr]'); if (s) { MENU.ings.splice(+s.dataset.miSuppr, 1); menuPeindreIngs(); menuReporterMacros(); return; }
  const a = e.target.closest('[data-menu-actif]');
  if (a) {
    const p = (MENU.plats || []).find(x => x.id === a.dataset.menuActif); if (!p) return;
    try { await sb('plats_menu?id=eq.' + p.id, { method: 'PATCH', body: JSON.stringify({ actif: !p.actif }) }); toast(p.actif ? p.nom + ' retiré du menu' : p.nom + ' remis au menu'); }
    catch (err) { toast('Échec : ' + String(err.message || err).slice(0, 100)); }
    render(); return;
  }
  const d = e.target.closest('[data-menu-suppr]');
  if (d) {
    const p = (MENU.plats || []).find(x => x.id === d.dataset.menuSuppr);
    if (!confirm('Supprimer « ' + (p ? p.nom : 'ce plat') + ' » du menu ?\n\nLa recette du même nom (fiche technique) est gardée. Pour seulement le cacher aux clients, utilise « Au menu » → « Retiré ».')) return;
    try { await sb('plats_menu?id=eq.' + d.dataset.menuSuppr, { method: 'DELETE' }); toast('Plat supprimé'); closeAll(); render(); }
    catch (err) { toast('Suppression refusée : ' + String(err.message || err).slice(0, 100)); }
  }
});
async function enregistrerPlatMenu(p, btn) {
  const nom = $('#mfNom').value.trim(); if (!nom) { toast('Donne un nom au plat'); return; }
  const num = id => { const x = $(id).value; return x === '' ? null : +x; };
  const payload = { nom, description: $('#mfDesc').value.trim() || null, categorie: $('#mfCat').value, photo_url: MENU.photo || null,
    calories: num('#mfCal') != null ? Math.round(num('#mfCal')) : null, proteines: num('#mfP'), glucides: num('#mfG'), lipides: num('#mfL') };
  if (!p) payload.actif = true;
  if (btn) btn.disabled = true;
  try {
    if (p) await sb('plats_menu?id=eq.' + p.id, { method: 'PATCH', body: JSON.stringify(payload) });
    else await sb('plats_menu', { method: 'POST', body: JSON.stringify(payload) });
    await enregistrerIngredientsMenu(nom, p && p.nom !== nom ? p.nom : null);
  } catch (err) { toast('Échec : ' + String(err.message || err).slice(0, 120)); if (btn) btn.disabled = false; return; }
  toast(p ? 'Plat mis à jour' : 'Plat ajouté au menu'); closeAll(); render();
}
/* La recette du même nom, trouvée sinon créée — comme admin. Un plat renommé
   pointe vers la recette du NOUVEAU nom : on ne renomme jamais une fiche
   technique depuis le menu (des commandes et des sessions l'utilisent). Ses
   ingrédients sont réécrits en GARDANT les colonnes posées par la production
   sur un aliment resté dans la liste ; si l'écriture échoue, l'ancienne fiche
   est remise. Aucun ingrédient saisi = la fiche n'est pas touchée. */
async function enregistrerIngredientsMenu(nom, ancienNom) {
  const ings = MENU.ings.filter(i => i.nom.trim());
  if (!ings.length) return;
  let recId = ancienNom ? null : MENU.recette;
  if (!recId) {
    const r = await sb('recettes?nom=eq.' + encodeURIComponent(nom) + '&select=id&limit=1');
    recId = r[0] && r[0].id;
    if (!recId) recId = (await sb('recettes', { method: 'POST', body: JSON.stringify({ nom, actif: true, nb_portions: 1 }) }))[0].id;
  }
  const avant = MENU.ings.filter(i => i.ligne);
  const inchange = recId === MENU.recette && avant.length === ings.length && ings.every((i, k) => i.ligne && i.ligne === avant[k].ligne && String(i.ligne.ingredient_nom) === i.nom.trim() && +i.ligne.quantite_g === +i.g);
  if (inchange) return;
  const lignes = ings.map((i, k) => {
    const garde = i.ligne && String(i.ligne.ingredient_nom).trim().toLowerCase() === i.nom.trim().toLowerCase() ? (({ id, created_at, ...x }) => x)(i.ligne) : { unite: 'g' };
    return { ...garde, recette_id: recId, ingredient_nom: i.nom.trim(), quantite_g: +i.g || 0, ordre: k };
  });
  const existantes = await sb('recettes_ingredients?recette_id=eq.' + recId + '&select=*');
  await sb('recettes_ingredients?recette_id=eq.' + recId, { method: 'DELETE' });
  try { await sb('recettes_ingredients', { method: 'POST', body: JSON.stringify(lignes) }); }
  catch (err) { if (existantes.length) await sb('recettes_ingredients', { method: 'POST', body: JSON.stringify(existantes) }).catch(() => {}); throw err; }
}
