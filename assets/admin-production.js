/* ═══════════════════════════════════════════════════════════════════════════
   assets/admin-production.js — l'onglet « Production » d'admin.html
   (`NattyProd`, tout préfixé `np-`). Chargé par admin.html seulement.

   QUATRE VUES, dans l'ordre du travail :
     1. Bons de commande — tout ce que les clients ont acheté et qui reste à
        livrer. Un bon sans recette attribuée est EN ROUGE. Un bon sans date de
        livraison aussi : on ne peut rien produire pour lui.
     2. Attribution (depuis un bon) — quelles recettes, pour combien de
        portions, et à quelle CIBLE calorique pour CE client. La cible est
        calculée (voir `cibleClient`) et affichée avec son raisonnement ; elle
        se corrige à la main.
     3. Calendrier — chaque jour, « Plat × n » toutes commandes confondues, et
        les bons sans attribution en rouge. En dessous, la table de toutes les
        commandes détaillées, triée par recette puis par date. Un tap sur un
        jour ouvre la production de ce jour.
     4. Production (un jour) — combien de cuisiniers ; l'algorithme répartit
        les étapes de TOUTES les recettes du jour pour que chacun avance en
        même temps (`dispatcher`). Puis l'ASSEMBLAGE : on quitte la masse pour
        la portion, et l'écran dit, ingrédient par ingrédient, combien de
        grammes poser sur la balance pour chaque portion de chaque client.

   CE QUE LA FICHE TECHNIQUE DOIT DIRE, et ce qu'on déduit quand elle ne le
   dit pas (`fiche`) :
     - `recettes.nb_portions` : pour combien de portions les grammages des
       ingrédients sont écrits. Sans lui, les grammages valent pour UNE fiche
       et la portion se déduit du besoin du client (cible kcal ÷ kcal/100 g de
       la recette, kcal/100 g calculés depuis `ingredients_base`).
     - `recettes.calories_portion` : la portion de la fiche, en kcal. Sans
       elle, même calcul depuis `ingredients_base`. Sans les deux, la recette
       est signalée : on ne peut pas adapter ce qu'on ne sait pas chiffrer.
     - `recettes_etapes.duree_min`, `phase`, `passif` (natty_production.sql) :
       ce que dure l'étape, si elle se fait en masse ou par personne, et si
       le cuisinier est libre pendant qu'elle se fait (four, repos, marinade).

   ⚠️ TOUT CE QUI EST CALCULÉ EST ANNONCÉ COMME TEL. Une cible calorique est
   une estimation ; une durée de production dont la fiche ne dit rien est une
   valeur par défaut, et l'écran le dit. Un chiffre inventé sans le dire, en
   cuisine, c'est un plat livré à côté de l'objectif.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var S = {
    vue: 'bons', bons: [], attribs: [], recettes: [], ings: {}, etapes: {},
    clients: {}, ingBase: {}, mois: null, jour: null, filtre: 'tous',
    bonOuvert: null, cuisiniers: 2, debut: '08:00', charge: false
  };

  var JOURS_C = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  var MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var PALETTE = ['#2a9e4f', '#ff6b35', '#3a7bd5', '#b23a8e', '#c97a00', '#1b9aaa',
    '#7a5195', '#ef476f'];
  var DUREE_DEFAUT = 10;   // minutes, quand la fiche ne dit rien — et c'est dit
  var NB_REPAS_JOUR = { '1_2': 2, '3': 3, '3_collations': 4, 'grignotage': 3 };

  /* ── Outils ─────────────────────────────────────────────────────────────── */
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function deDate(s) { return new Date(s + 'T12:00:00'); }
  function lundiDe(s) {
    var d = deDate(s), j = d.getDay();
    d.setDate(d.getDate() - (j === 0 ? 6 : j - 1));
    return ymd(d);
  }
  function fmtJ(s, long) {
    if (!s) return '—';
    var d = deDate(s);
    return d.toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function hm(min) {
    var hh = Math.floor(min / 60), mm = Math.round(min % 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function minDe(hhmm) { var p = String(hhmm || '08:00').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function toast(m, t) { if (window.toast) window.toast(m, t); }
  function sbq(path, opt) { return window.sb(path, opt); }
  function nomClient(uid) {
    var c = S.clients[uid];
    if (!c) return 'Client ' + String(uid || '').slice(0, 6);
    return ((c.prenom || '') + ' ' + (c.nom || '')).trim() || (c.email || 'Client');
  }
  function recette(id) { return S.recettes.find(function (r) { return r.id === id; }); }
  function couleur(recId) {
    var i = S.recettes.findIndex(function (r) { return r.id === recId; });
    return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
  }
  function attribsDe(bonId) { return S.attribs.filter(function (a) { return a.bon_id === bonId; }); }
  function portionsAttribuees(bon) {
    return attribsDe(bon.id).reduce(function (t, a) { return t + (a.nb_portions || 0); }, 0);
  }
  function estAttribue(bon) { return portionsAttribuees(bon) >= bon.nb_repas; }
  function statutBon(bon) {
    if (bon.statut === 'livre' || bon.statut === 'annule' || bon.statut === 'en_production') return bon.statut;
    return estAttribue(bon) ? 'attribue' : 'a_attribuer';
  }
  var LIB_STATUT = { a_attribuer: 'À attribuer', attribue: 'Attribué', en_production: 'En production', livre: 'Livré', annule: 'Annulé' };
  var LIB_TYPE = { abonnement: 'Abonnement', unite: 'À l’unité', manuel: 'Manuel' };

  /* ── Feuille ────────────────────────────────────────────────────────────── */
  function css() {
    if (document.getElementById('npCss')) return;
    var st = document.createElement('style'); st.id = 'npCss';
    st.textContent = [
      '#npHost{font-family:DM Sans,sans-serif}',
      '.np-sub{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}',
      '.np-sub button{padding:9px 18px;border-radius:99px;background:var(--bg);box-shadow:var(--so);font-family:inherit;font-size:12px;font-weight:600;color:var(--muted);border:none;cursor:pointer}',
      '.np-sub button.on{background:var(--black);color:#fff;box-shadow:3px 3px 8px rgba(26,26,46,.35)}',
      '.np-sub .sp{flex:1}',
      '.np-btn{padding:10px 16px;background:var(--black);color:#fff;border:none;border-radius:12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}',
      '.np-btn.sec{background:var(--bg);color:var(--black);box-shadow:var(--so)}',
      '.np-btn:disabled{opacity:.45;cursor:default}',
      '.np-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.np-card{background:var(--bg);border-radius:16px;box-shadow:var(--so);padding:14px 16px;margin-bottom:10px}',
      '.np-card.rouge{border-left:5px solid #c0392b;padding-left:13px}',
      '.np-card.vert{border-left:5px solid #2a9e4f;padding-left:13px}',
      '.np-t{font-size:15px;font-weight:800;color:var(--black)}',
      '.np-s{font-size:12px;color:var(--muted)}',
      '.np-h{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin:18px 0 8px}',
      '.np-pill{font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;white-space:nowrap}',
      '.np-pill.r{background:#c0392b1f;color:#c0392b}.np-pill.v{background:#2a9e4f1f;color:#2a9e4f}.np-pill.g{background:#7777771f;color:#555}.np-pill.o{background:#c97a001f;color:#c97a00}',
      '.np-in{border:none;background:var(--bg);border-radius:10px;padding:8px 12px;font-size:12px;box-shadow:var(--si);font-family:inherit;color:var(--black)}',
      '.np-in.n{width:64px;text-align:center;font-weight:700}',
      '.np-filtres{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}',
      '.np-filtres button{padding:6px 12px;border-radius:99px;border:none;background:var(--bg);box-shadow:var(--sm);font-family:inherit;font-size:11px;font-weight:600;color:var(--muted);cursor:pointer}',
      '.np-filtres button.on{background:var(--black);color:#fff}',
      '.np-vide{text-align:center;padding:32px;color:var(--muted);font-size:13px}',
      '.np-alerte{background:#c0392b12;border:1px solid #c0392b44;border-radius:12px;padding:10px 14px;font-size:12px;color:#8e2b20;margin-bottom:12px}',
      '.np-note{background:var(--bg);box-shadow:var(--si);border-radius:12px;padding:10px 14px;font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5}',
      /* attribution */
      '.np-rec{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg);border-radius:12px;box-shadow:var(--si);margin-bottom:6px}',
      '.np-rec.on{box-shadow:var(--so);outline:2px solid var(--black)}',
      '.np-rec .nm{flex:1;font-size:13px;font-weight:700;color:var(--black)}',
      '.np-rec .sm{font-size:11px;color:var(--muted);font-weight:500}',
      '.np-stp{display:flex;align-items:center;gap:6px}',
      '.np-stp button{width:28px;height:28px;border-radius:50%;border:none;background:var(--black);color:#fff;font-weight:700;cursor:pointer;font-family:inherit}',
      '.np-stp button:disabled{opacity:.3}',
      '.np-stp span{min-width:22px;text-align:center;font-weight:800;font-size:14px;color:var(--black)}',
      '.np-cible{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px}',
      '.np-cible div{background:var(--bg);border-radius:12px;box-shadow:var(--si);padding:10px 12px}',
      '.np-cible b{display:block;font-size:18px;color:var(--black)}',
      '.np-cible small{font-size:11px;color:var(--muted)}',
      /* calendrier */
      '.np-calnav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
      '.np-calnav b{font-size:16px;color:var(--black);text-transform:capitalize}',
      '.np-calnav button{width:36px;height:36px;border-radius:50%;border:none;background:var(--bg);box-shadow:var(--so);cursor:pointer;font-size:16px;color:var(--black)}',
      '.np-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}',
      '.np-cal .hd{font-size:10px;font-weight:700;color:var(--muted);text-align:center;text-transform:uppercase;letter-spacing:.6px;padding:4px 0}',
      '.np-cell{background:var(--bg);border-radius:12px;box-shadow:var(--sm);min-height:92px;padding:8px;cursor:pointer;position:relative;font-size:11px;min-width:0;overflow:hidden;overflow-wrap:anywhere}',
      '.np-cell.hors{opacity:.35}.np-cell.auj{outline:2px solid var(--black)}',
      '.np-cell.rouge{box-shadow:var(--sm),inset 0 0 0 2px #c0392b}',
      '.np-cell .d{font-size:12px;font-weight:800;color:var(--black);margin-bottom:4px}',
      '.np-cell .p{display:flex;align-items:center;gap:4px;margin:2px 0;color:var(--black);font-weight:600;line-height:1.25}',
      '.np-cell .p i{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
      '.np-cell .x{color:#c0392b;font-weight:700;margin-top:3px}',
      '.np-tab{width:100%;border-collapse:collapse;font-size:12px;background:var(--bg);border-radius:14px;box-shadow:var(--so);overflow:hidden}',
      '.np-tab th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);padding:10px 12px;border-bottom:1px solid #0001}',
      '.np-tab td{padding:9px 12px;border-bottom:1px solid #0000000a;color:var(--black);vertical-align:top}',
      '.np-tab tr.grp td{background:#00000006;font-weight:800}',
      '.np-tab tr.rouge td{color:#c0392b;font-weight:700}',
      /* production */
      '.np-gantt{background:var(--bg);border-radius:14px;box-shadow:var(--so);padding:12px;overflow-x:auto;margin-bottom:12px}',
      '.np-gl{display:grid;grid-template-columns:110px 1fr;gap:6px;align-items:center;margin-bottom:6px}',
      '.np-gl .n{font-size:12px;font-weight:700;color:var(--black)}',
      '.np-gt{position:relative;height:34px;background:#00000008;border-radius:8px}',
      '.np-gb{position:absolute;top:3px;bottom:3px;border-radius:6px;color:#fff;font-size:10px;font-weight:700;padding:0 6px;display:flex;align-items:center;overflow:hidden;white-space:nowrap;box-sizing:border-box}',
      '.np-gb.pas{background:repeating-linear-gradient(45deg,#0002 0 4px,#0001 4px 8px)!important;color:var(--black);border:1px dashed #0004}',
      '.np-axe{display:grid;grid-template-columns:110px 1fr;margin-bottom:4px}',
      '.np-axe div:last-child{position:relative;height:14px;font-size:10px;color:var(--muted)}',
      '.np-axe span{position:absolute;transform:translateX(-50%)}',
      '.np-etape{display:flex;gap:12px;align-items:flex-start;padding:10px 14px;background:var(--bg);border-radius:12px;box-shadow:var(--si);margin-bottom:6px;font-size:12px}',
      '.np-etape .t{min-width:88px;font-weight:800;color:var(--black)}',
      '.np-etape .c{width:9px;height:9px;border-radius:50%;margin-top:4px;flex-shrink:0}',
      '.np-etape .b{flex:1;color:var(--black)}.np-etape .b small{display:block;color:var(--muted);margin-top:2px}',
      '.np-port{background:var(--bg);border-radius:14px;box-shadow:var(--so);padding:12px 14px;margin-bottom:8px}',
      '.np-port.ok{opacity:.5}',
      '.np-port .hd{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
      '.np-port .hd b{font-size:14px;color:var(--black)}',
      '.np-port .hd input{width:20px;height:20px;accent-color:#2a9e4f}',
      '.np-ing{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px}',
      '.np-ing div{background:#00000006;border-radius:10px;padding:8px 10px;font-size:12px;color:var(--black)}',
      '.np-ing b{font-size:15px;display:block}',
      '.np-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted);margin-bottom:10px}',
      '.np-leg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle}',
      '@media(max-width:700px){.np-cell{min-height:70px;padding:5px;font-size:10px}.np-gl{grid-template-columns:70px 1fr}.np-axe{grid-template-columns:70px 1fr}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ── Chargement ─────────────────────────────────────────────────────────── */
  function chargerTout() {
    return Promise.all([
      sbq('bons_commande?statut=neq.annule&select=*&order=jour_livraison.asc.nullsfirst,created_at.desc'),
      sbq('bons_attributions?select=*'),
      sbq('recettes?actif=eq.true&select=*&order=nom.asc'),
      sbq('recettes_ingredients?select=*&order=ordre.asc'),
      sbq('recettes_etapes?select=*&order=numero.asc'),
      sbq('onboarding?select=user_id,prenom,nom,email,poids,tdee,created_at&order=created_at.desc'),
      sbq('ingredients_base?select=nom,nom_normalise,cal_per_100g,prot_per_100g,gluc_per_100g,lip_per_100g')
    ]).then(function (r) {
      S.bons = r[0] || []; S.attribs = r[1] || []; S.recettes = r[2] || [];
      S.ings = {}; (r[3] || []).forEach(function (i) { (S.ings[i.recette_id] = S.ings[i.recette_id] || []).push(i); });
      S.etapes = {}; (r[4] || []).forEach(function (e) { (S.etapes[e.recette_id] = S.etapes[e.recette_id] || []).push(e); });
      // `onboarding` contient des doublons : on garde la première ligne qui
      // porte un prénom, ou à défaut la première tout court.
      S.clients = {};
      (r[5] || []).forEach(function (o) {
        var c = S.clients[o.user_id];
        if (!c || (!c.prenom && o.prenom) || (!c.tdee && o.tdee)) {
          S.clients[o.user_id] = Object.assign({}, c || {}, o, { prenom: (c && c.prenom) || o.prenom, tdee: (c && c.tdee) || o.tdee });
        }
      });
      S.ingBase = {};
      (r[6] || []).forEach(function (i) { S.ingBase[norm(i.nom_normalise || i.nom)] = i; });
      S.charge = true;
    });
  }

  /* ── La fiche technique, lue comme elle est écrite ──────────────────────── */
  function nutri100(nom) {
    var k = norm(nom);
    if (S.ingBase[k]) return S.ingBase[k];
    // plus long libellé contenu dans le nom, mot à mot (jamais en sous-chaîne)
    var mots = ' ' + k + ' ', best = null;
    Object.keys(S.ingBase).forEach(function (c) {
      if (c && mots.indexOf(' ' + c + ' ') >= 0 && (!best || c.length > best.length)) best = c;
    });
    return best ? S.ingBase[best] : null;
  }

  /* Ce qu'on sait de la fiche : pour combien de portions elle est écrite, ce
     que pèse et vaut une de ses portions. Chaque champ dit s'il est LU ou
     DÉDUIT — l'écran s'en sert pour l'annoncer. */
  function fiche(r) {
    var ings = S.ings[r.id] || [];
    var gTotal = ings.reduce(function (t, i) { return t + (parseFloat(i.quantite_g) || 0); }, 0);
    var kcalTot = 0, connus = 0, inconnus = [];
    ings.forEach(function (i) {
      var n = nutri100(i.ingredient_nom);
      var g = parseFloat(i.quantite_g) || 0;
      if (n && n.cal_per_100g != null) { kcalTot += g * (parseFloat(n.cal_per_100g) || 0) / 100; connus += g; }
      else if (g > 0) inconnus.push(i.ingredient_nom);
    });
    var kcal100 = connus > 0 ? kcalTot / connus * 100 : null;
    var nb = r.nb_portions && r.nb_portions > 0 ? r.nb_portions : null;
    var kcalPortion = parseFloat(r.calories_portion) > 0 ? parseFloat(r.calories_portion) : null;
    var src = 'fiche';
    if (!kcalPortion && kcal100 && nb) { kcalPortion = gTotal / nb * kcal100 / 100; src = 'deduit'; }
    var gPortionFiche = nb ? gTotal / nb : null;
    return { ings: ings, gTotal: gTotal, nb: nb, kcalPortion: kcalPortion, kcalSrc: src,
      kcal100: kcal100, gPortionFiche: gPortionFiche, inconnus: inconnus,
      prot: parseFloat(r.prot_portion) || 0, gluc: parseFloat(r.gluc_portion) || 0, lip: parseFloat(r.lip_portion) || 0 };
  }

  /* La portion d'UN client sur cette fiche : le facteur par rapport à la
     portion de la fiche, et les grammes par ingrédient. */
  function portionPour(r, cibleKcal) {
    var f = fiche(r), facteur = 1, gPortion, mode;
    if (f.kcalPortion && cibleKcal) {
      facteur = cibleKcal / f.kcalPortion;
      gPortion = (f.gPortionFiche || f.gTotal) * facteur;
      mode = f.kcalSrc === 'fiche' ? 'kcal de la fiche' : 'kcal déduites des ingrédients';
    } else if (f.kcal100 && cibleKcal) {
      gPortion = cibleKcal / f.kcal100 * 100;
      facteur = gPortion / (f.gPortionFiche || f.gTotal);
      mode = 'grammage ÷ kcal/100 g (fiche sans portion)';
    } else {
      gPortion = f.gPortionFiche || f.gTotal;
      mode = f.nb ? 'portion de la fiche, non adaptée (kcal inconnues)' : 'fiche entière = 1 portion (rien de chiffré)';
    }
    return { facteur: facteur, gPortion: gPortion, mode: mode, fiche: f,
      kcal: f.kcalPortion ? f.kcalPortion * facteur : (f.kcal100 ? gPortion * f.kcal100 / 100 : null),
      ings: f.ings.map(function (i) {
        return { nom: i.ingredient_nom, g: (parseFloat(i.quantite_g) || 0) / (f.nb || 1) * facteur, unite: i.unite || 'g' };
      }) };
  }

  /* ── La cible calorique d'un repas, pour CE client ──────────────────────
     tdee (onboarding) ÷ repas par jour (questionnaire) donne la base. Puis on
     regarde ce que la personne MANGE réellement aux autres repas — ses plats
     enregistrés dans l'app sur 28 jours : si ses repas font ~800 kcal et
     qu'elle en prend deux par jour pour 3 000 kcal, le plat livré doit porter
     ce qui manque, pas un tiers théorique. Bornée à [0,6 ; 1,6] × la base,
     parce qu'un seul repas ne peut pas honnêtement porter toute la journée. */
  function cibleClient(uid) {
    var c = S.clients[uid] || {};
    var tdee = parseFloat(c.tdee) || 0;
    var depuis = new Date(); depuis.setDate(depuis.getDate() - 28);
    return Promise.all([
      sbq('questionnaire_alim?user_id=eq.' + encodeURIComponent(uid) + '&select=nb_repas&order=completed_at.desc.nullslast&limit=1').catch(function () { return []; }),
      sbq('meals?user_id=eq.' + encodeURIComponent(uid) + '&created_at=gte.' + depuis.toISOString() + '&select=id,meal_ingredients(calories)').catch(function () { return []; })
    ]).then(function (r) {
      var lib = (r[0] && r[0][0] && r[0][0].nb_repas) || null;
      var n = NB_REPAS_JOUR[lib] || 3;
      var kcals = (r[1] || []).map(function (m) {
        return (m.meal_ingredients || []).reduce(function (t, i) { return t + (parseFloat(i.calories) || 0); }, 0);
      }).filter(function (k) { return k > 50; });
      var moy = kcals.length >= 5 ? kcals.reduce(function (a, b) { return a + b; }, 0) / kcals.length : null;
      var base = tdee ? tdee / n : 650;
      var cible = base, raison;
      if (!tdee) raison = 'Aucune dépense (tdee) dans l’onboarding : 650 kcal par défaut.';
      else if (moy) {
        cible = Math.max(base * 0.6, Math.min(base * 1.6, tdee - (n - 1) * moy));
        raison = Math.round(tdee) + ' kcal/jour ÷ ' + n + ' repas = ' + Math.round(base) + ' de base. Ses ' + kcals.length
          + ' plats notés font ~' + Math.round(moy) + ' kcal : le plat livré couvre ' + Math.round(tdee) + ' − ' + (n - 1) + ' × ' + Math.round(moy) + '.';
      } else raison = Math.round(tdee) + ' kcal/jour ÷ ' + n + ' repas' + (lib ? ' (questionnaire : « ' + lib + ' »)' : ' (questionnaire absent : 3)') + '. Pas assez de plats notés pour affiner.';
      return { cible: Math.round(cible / 10) * 10, base: Math.round(base), n: n, moy: moy ? Math.round(moy) : null, tdee: tdee, nbNotes: kcals.length, raison: raison };
    });
  }

  /* ── Coquille ───────────────────────────────────────────────────────────── */
  function monter(host) {
    css();
    host.innerHTML = '<div class="np-sub" id="npSub">'
      + '<button data-vue="bons">🧾 Bons de commande</button>'
      + '<button data-vue="calendrier">📅 Calendrier</button>'
      + '<button data-vue="production">👨‍🍳 Production</button>'
      + '<span class="sp"></span><button data-act="recharger" class="np-btn sec">↻</button></div>'
      + '<div id="npVue"><div class="np-vide">Chargement…</div></div>';
    host.addEventListener('click', clic);
    host.addEventListener('change', change);
    if (!S.mois) { S.mois = new Date(); S.mois.setDate(1); }
    chargerTout().then(rendre).catch(function (e) {
      document.getElementById('npVue').innerHTML = '<div class="np-alerte">Impossible de charger : ' + h(e.message)
        + '<br>Si le message parle de <code>bons_commande</code>, <b>natty_production.sql</b> n’a pas été exécuté.</div>';
    });
  }

  function rendre() {
    document.querySelectorAll('#npSub [data-vue]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.vue === (S.vue === 'attribution' ? 'bons' : S.vue));
    });
    var el = document.getElementById('npVue');
    if (S.vue === 'bons') el.innerHTML = vueBons();
    else if (S.vue === 'attribution') vueAttribution(el);
    else if (S.vue === 'calendrier') el.innerHTML = vueCalendrier();
    else el.innerHTML = vueProduction();
  }

  /* ── 1. Bons de commande ────────────────────────────────────────────────── */
  function vueBons() {
    var bons = S.bons.filter(function (b) {
      var st = statutBon(b);
      if (S.filtre === 'rouge') return st === 'a_attribuer' || !b.jour_livraison;
      if (S.filtre === 'attribue') return st === 'attribue';
      if (S.filtre === 'livre') return st === 'livre';
      return st !== 'livre';
    });
    var nbRouge = S.bons.filter(function (b) { return statutBon(b) === 'a_attribuer' && b.statut !== 'livre'; }).length;
    var html = '<div class="np-row" style="justify-content:space-between;margin-bottom:12px">'
      + '<div><div class="np-t">Bons de commande</div><div class="np-s">' + S.bons.length + ' bons · <b style="color:#c0392b">' + nbRouge + ' sans attribution</b></div></div>'
      + '<div class="np-row"><button class="np-btn sec" data-act="generer-abos">Générer depuis les abonnements actifs</button>'
      + '<button class="np-btn" data-act="nouveau-bon">+ Bon manuel</button></div></div>';
    html += '<div id="npFormBon" style="display:none" class="np-card">' + formBon() + '</div>';
    html += '<div class="np-filtres">' + [['tous', 'En cours'], ['rouge', '🔴 À traiter'], ['attribue', 'Attribués'], ['livre', 'Livrés']].map(function (f) {
      return '<button data-filtre="' + f[0] + '" class="' + (S.filtre === f[0] ? 'on' : '') + '">' + f[1] + '</button>';
    }).join('') + '</div>';
    if (!bons.length) return html + '<div class="np-vide">Aucun bon ici.<br><small>Un bon naît au paiement (webhook Stripe), ou depuis les boutons ci-dessus.</small></div>';
    html += bons.map(carteBon).join('');
    return html;
  }

  function carteBon(b) {
    var st = statutBon(b), rouge = st === 'a_attribuer' || !b.jour_livraison;
    var pa = portionsAttribuees(b);
    var att = attribsDe(b.id).map(function (a) { var r = recette(a.recette_id); return (r ? r.nom : '?') + ' × ' + a.nb_portions; }).join(' · ');
    var cls = st === 'attribue' ? 'vert' : (rouge ? 'rouge' : '');
    var pill = st === 'attribue' ? 'v' : st === 'a_attribuer' ? 'r' : st === 'en_production' ? 'o' : 'g';
    return '<div class="np-card ' + cls + '" data-bon="' + h(b.id) + '"><div class="np-row" style="justify-content:space-between">'
      + '<div style="flex:1;min-width:200px"><div class="np-t">' + h(nomClient(b.user_id)) + ' <span class="np-s">· ' + b.nb_repas + ' repas · ' + h(LIB_TYPE[b.type] || b.type) + '</span></div>'
      + '<div class="np-s">' + (b.jour_livraison ? 'Livraison ' + fmtJ(b.jour_livraison, true) : '<b style="color:#c0392b">Sans date de livraison</b>')
      + (b.adresse ? ' · ' + h(b.adresse) : ' · <i>adresse non renseignée</i>') + '</div>'
      + (att ? '<div class="np-s" style="margin-top:4px;color:var(--black)">🍽 ' + h(att) + (pa < b.nb_repas ? ' <b style="color:#c0392b">(' + pa + '/' + b.nb_repas + ')</b>' : '') + '</div>' : '')
      + (b.plats && b.plats.length ? '<div class="np-s" style="margin-top:4px">Choix du client : ' + h(b.plats.map(function (p) { return (platNom(p.id)) + ' × ' + p.n; }).join(', ')) + '</div>' : '')
      + '</div>'
      + '<div class="np-row"><input type="date" class="np-in" data-jour-bon="' + h(b.id) + '" value="' + h(b.jour_livraison || '') + '">'
      + '<span class="np-pill ' + pill + '">' + h(LIB_STATUT[st] || st) + '</span>'
      + '<button class="np-btn" data-act="attribuer" data-id="' + h(b.id) + '">' + (att ? 'Modifier' : 'Attribuer') + ' →</button>'
      + (st === 'attribue' ? '<button class="np-btn sec" data-act="livre" data-id="' + h(b.id) + '">Livré ✓</button>' : '')
      + '<button class="np-btn sec" data-act="annuler-bon" data-id="' + h(b.id) + '" title="Annuler ce bon">✕</button>'
      + '</div></div></div>';
  }

  var PLATS_MENU = null;
  function platNom(id) {
    var p = PLATS_MENU && PLATS_MENU.find(function (x) { return x.id === id; });
    return p ? p.nom : String(id || '').slice(0, 8);
  }

  function formBon() {
    var opts = Object.keys(S.clients).map(function (uid) {
      return '<option value="' + h(uid) + '">' + h(nomClient(uid)) + '</option>';
    }).sort().join('');
    return '<div class="np-t" style="margin-bottom:8px">Nouveau bon</div><div class="np-row">'
      + '<select class="np-in" id="npBonClient" style="max-width:240px"><option value="">Client…</option>' + opts + '</select>'
      + '<label class="np-s">Repas <input type="number" class="np-in n" id="npBonNb" value="3" min="1" max="40"></label>'
      + '<input type="date" class="np-in" id="npBonJour">'
      + '<input type="text" class="np-in" id="npBonAdresse" placeholder="Adresse" style="flex:1;min-width:180px">'
      + '<button class="np-btn" data-act="creer-bon">Créer</button></div>';
  }

  function creerBonManuel() {
    var uid = document.getElementById('npBonClient').value;
    var nb = parseInt(document.getElementById('npBonNb').value, 10);
    var jour = document.getElementById('npBonJour').value || null;
    if (!uid || !nb) { toast('Client et nombre de repas', 'err'); return; }
    var row = { user_id: uid, type: 'manuel', nb_repas: nb, jour_livraison: jour, semaine: jour ? lundiDe(jour) : null,
      adresse: document.getElementById('npBonAdresse').value || null, statut: 'a_attribuer' };
    sbq('bons_commande', { method: 'POST', body: JSON.stringify(row) }).then(function () {
      toast('Bon créé', 'ok'); return chargerTout();
    }).then(rendre).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
  }

  /* Un bon par abonnement actif pour la semaine PROCHAINE, s'il n'en a pas
     déjà un (le webhook en crée un à chaque facture — ce bouton rattrape les
     abonnements d'avant septembre 2026, qui n'ont pas de métadonnées). */
  function genererDepuisAbos() {
    var lundi = lundiDe(ymd(new Date())), d = deDate(lundi); d.setDate(d.getDate() + 7);
    var sem = ymd(d);
    sbq('abonnements?statut=eq.actif&select=id,user_id,formule').then(function (abos) {
      var deja = {};
      S.bons.forEach(function (b) { if (b.semaine === sem) deja[b.user_id] = true; });
      var rows = (abos || []).filter(function (a) { return !deja[a.user_id]; }).map(function (a) {
        var n = parseInt(String(a.formule || '').split('_')[0], 10) || 3;
        return { user_id: a.user_id, type: 'abonnement', nb_repas: n, semaine: sem, jour_livraison: null,
          abonnement_id: a.id, statut: 'a_attribuer', notes: 'Généré depuis l’abonnement (semaine du ' + sem + ')' };
      });
      if (!rows.length) { toast('Rien à générer : chaque abonné a déjà son bon pour la semaine du ' + fmtJ(sem), 'ok'); return null; }
      return sbq('bons_commande', { method: 'POST', body: JSON.stringify(rows) }).then(function () {
        toast(rows.length + ' bon(s) créé(s) — sans date de livraison, à poser', 'ok');
      });
    }).then(function () { return chargerTout(); }).then(rendre).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
  }

  function patchBon(id, body) {
    return sbq('bons_commande?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(Object.assign({ updated_at: new Date().toISOString() }, body)) });
  }

  /* ── 2. Attribution ─────────────────────────────────────────────────────── */
  var A = { bon: null, cible: null, sel: {} };

  function vueAttribution(el) {
    var b = S.bons.find(function (x) { return x.id === S.bonOuvert; });
    if (!b) { S.vue = 'bons'; rendre(); return; }
    A.bon = b; A.sel = {};
    attribsDe(b.id).forEach(function (a) { A.sel[a.recette_id] = a.nb_portions; });
    el.innerHTML = '<div class="np-vide">Calcul de la cible de ' + h(nomClient(b.user_id)) + '…</div>';
    cibleClient(b.user_id).then(function (c) {
      var existante = attribsDe(b.id)[0];
      A.cible = c; A.cibleRetenue = existante && existante.kcal_portion ? existante.kcal_portion : c.cible;
      el.innerHTML = htmlAttribution(b, c);
    });
  }

  function htmlAttribution(b, c) {
    var html = '<div class="np-row" style="justify-content:space-between;margin-bottom:12px">'
      + '<div><button class="np-btn sec" data-act="retour-bons">‹ Bons</button></div>'
      + '<div style="flex:1"><div class="np-t">' + h(nomClient(b.user_id)) + ' — ' + b.nb_repas + ' repas</div>'
      + '<div class="np-s">' + (b.jour_livraison ? 'Livraison ' + fmtJ(b.jour_livraison, true) : '<b style="color:#c0392b">Sans date</b>') + ' · ' + h(LIB_TYPE[b.type] || b.type) + '</div></div>'
      + '<input type="date" class="np-in" data-jour-bon="' + h(b.id) + '" value="' + h(b.jour_livraison || '') + '"></div>';
    html += '<div class="np-h">Cible calorique par repas</div><div class="np-cible">'
      + '<div><b><input type="number" class="np-in n" id="npCible" value="' + A.cibleRetenue + '" step="10" style="width:90px;font-size:18px"> kcal</b><small>retenue pour ce bon (modifiable)</small></div>'
      + '<div><b>' + c.base + '</b><small>base : ' + (c.tdee ? Math.round(c.tdee) + ' kcal ÷ ' + c.n + ' repas/jour' : 'sans tdee') + '</small></div>'
      + '<div><b>' + (c.moy ? c.moy : '—') + '</b><small>kcal moyennes de ses plats notés (' + c.nbNotes + ' sur 28 j)</small></div></div>'
      + '<div class="np-note">🧮 ' + h(c.raison) + ' <b>Estimation</b> — le client, lui, ne voit pas ce chiffre.</div>';
    if (b.plats && b.plats.length) html += '<div class="np-note">Le client a choisi à l’unité : ' + h(b.plats.map(function (p) { return platNom(p.id) + ' × ' + p.n; }).join(', ')) + '. Retrouver ces plats dans les recettes ci-dessous.</div>';
    html += '<div class="np-h">Recettes <span id="npCompte" style="text-transform:none;letter-spacing:0"></span></div>';
    if (!S.recettes.length) html += '<div class="np-alerte">Aucune recette active — à créer dans l’onglet Chef.</div>';
    html += S.recettes.map(function (r) {
      var n = A.sel[r.id] || 0, p = portionPour(r, A.cibleRetenue), f = p.fiche;
      var warn = [];
      if (!f.kcalPortion && !f.kcal100) warn.push('rien de chiffré');
      if (!f.nb) warn.push('portions non renseignées');
      if (f.inconnus.length) warn.push(f.inconnus.length + ' ingrédient(s) hors base');
      if (!(S.etapes[r.id] || []).length) warn.push('aucune étape');
      return '<div class="np-rec ' + (n ? 'on' : '') + '" data-rec="' + h(r.id) + '"><i style="width:10px;height:10px;border-radius:50%;background:' + couleur(r.id) + ';flex-shrink:0"></i>'
        + '<div class="nm">' + h(r.nom) + '<div class="sm">' + (f.kcalPortion ? Math.round(f.kcalPortion) + ' kcal / portion fiche' : (f.kcal100 ? Math.round(f.kcal100) + ' kcal/100 g' : 'non chiffrée'))
        + (f.nb ? ' · fiche pour ' + f.nb + ' portion(s)' : '') + ' · <b>' + Math.round(p.gPortion) + ' g</b> pour ce client (×' + p.facteur.toFixed(2) + ', ' + h(p.mode) + ')'
        + (warn.length ? ' · <span style="color:#c97a00">⚠ ' + h(warn.join(', ')) + '</span>' : '') + '</div></div>'
        + '<div class="np-stp"><button data-stp="-1" data-rec="' + h(r.id) + '" ' + (n ? '' : 'disabled') + '>−</button><span id="npN_' + h(r.id) + '">' + n + '</span><button data-stp="1" data-rec="' + h(r.id) + '">+</button></div></div>';
    }).join('');
    html += '<div class="np-row" style="justify-content:flex-end;margin-top:14px"><button class="np-btn" data-act="enregistrer-attrib" id="npSaveAttrib">Enregistrer l’attribution</button></div>';
    setTimeout(majCompte, 0);
    return html;
  }

  function majCompte() {
    var tot = Object.keys(A.sel).reduce(function (t, k) { return t + (A.sel[k] || 0); }, 0);
    var el = document.getElementById('npCompte'); if (!el) return;
    var ok = tot === A.bon.nb_repas;
    el.innerHTML = '<span class="np-pill ' + (ok ? 'v' : tot > A.bon.nb_repas ? 'r' : 'o') + '">' + tot + ' / ' + A.bon.nb_repas + ' portions</span>';
    var btn = document.getElementById('npSaveAttrib'); if (btn) btn.disabled = tot === 0 || tot > A.bon.nb_repas;
  }

  function enregistrerAttribution() {
    var b = A.bon, cible = parseInt(document.getElementById('npCible').value, 10) || A.cibleRetenue;
    var rows = Object.keys(A.sel).filter(function (k) { return A.sel[k] > 0; }).map(function (k) {
      var p = portionPour(recette(k), cible);
      return { bon_id: b.id, recette_id: k, nb_portions: A.sel[k], kcal_portion: cible, facteur: Math.round(p.facteur * 1000) / 1000 };
    });
    var btn = document.getElementById('npSaveAttrib'); btn.disabled = true;
    sbq('bons_attributions?bon_id=eq.' + b.id, { method: 'DELETE' })
      .then(function () { return rows.length ? sbq('bons_attributions', { method: 'POST', body: JSON.stringify(rows) }) : null; })
      .then(function () {
        var tot = rows.reduce(function (t, r) { return t + r.nb_portions; }, 0);
        return patchBon(b.id, { statut: tot >= b.nb_repas ? 'attribue' : 'a_attribuer' });
      })
      .then(function () { toast('Attribution enregistrée', 'ok'); S.vue = 'bons'; return chargerTout(); })
      .then(rendre).catch(function (e) { toast('Erreur : ' + e.message, 'err'); btn.disabled = false; });
  }

  /* ── 3. Calendrier ──────────────────────────────────────────────────────── */
  function parJour() {
    var m = {};
    S.bons.forEach(function (b) {
      if (b.statut === 'livre' || !b.jour_livraison) return;
      var d = m[b.jour_livraison] = m[b.jour_livraison] || { plats: {}, rouges: [], bons: [] };
      d.bons.push(b);
      var att = attribsDe(b.id);
      if (!estAttribue(b)) d.rouges.push(b);
      att.forEach(function (a) { d.plats[a.recette_id] = (d.plats[a.recette_id] || 0) + a.nb_portions; });
    });
    return m;
  }

  function vueCalendrier() {
    var pj = parJour(), auj = ymd(new Date());
    var m = S.mois, prem = new Date(m.getFullYear(), m.getMonth(), 1);
    var dec = (prem.getDay() + 6) % 7;
    var start = new Date(prem); start.setDate(1 - dec);
    var sansDate = S.bons.filter(function (b) { return !b.jour_livraison && b.statut !== 'livre'; });
    var html = '<div class="np-calnav"><button data-act="mois" data-d="-1">‹</button><b>' + MOIS_L[m.getMonth()] + ' ' + m.getFullYear() + '</b><button data-act="mois" data-d="1">›</button></div>';
    if (sansDate.length) html += '<div class="np-alerte">🔴 <b>' + sansDate.length + ' bon(s) sans date de livraison</b> — ils n’apparaissent sur aucun jour : '
      + h(sansDate.map(function (b) { return nomClient(b.user_id) + ' (' + b.nb_repas + ')'; }).join(', ')) + '. <a href="#" data-act="voir-bons" data-filtre="rouge" style="color:#c0392b">Poser les dates →</a></div>';
    html += '<div class="np-cal">' + JOURS_C.map(function (j) { return '<div class="hd">' + j + '</div>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i);
      var k = ymd(d), j = pj[k], hors = d.getMonth() !== m.getMonth();
      var cls = 'np-cell' + (hors ? ' hors' : '') + (k === auj ? ' auj' : '') + (j && j.rouges.length ? ' rouge' : '');
      html += '<div class="' + cls + '" data-jour="' + k + '"><div class="d">' + d.getDate() + '</div>';
      if (j) {
        html += Object.keys(j.plats).map(function (rid) {
          var r = recette(rid); return '<div class="p"><i style="background:' + couleur(rid) + '"></i>' + h(r ? r.nom : '?') + ' × ' + j.plats[rid] + '</div>';
        }).join('');
        if (j.rouges.length) html += '<div class="x">⚠ ' + j.rouges.length + ' à attribuer : ' + h(j.rouges.map(function (b) { return nomClient(b.user_id).split(' ')[0]; }).join(', ')) + '</div>';
      }
      html += '</div>';
    }
    html += '</div><div class="np-s" style="margin:8px 0 18px">Un jour = tous les plats à livrer ce jour-là, toutes commandes confondues. Toucher un jour ouvre sa production.</div>';
    html += '<div class="np-h">Commandes détaillées — par recette, puis par date</div>' + tableDetaillee();
    return html;
  }

  function tableDetaillee() {
    var lignes = [];
    S.bons.forEach(function (b) {
      if (b.statut === 'livre') return;
      var att = attribsDe(b.id);
      if (!att.length) lignes.push({ rec: null, nom: '— sans recette —', date: b.jour_livraison || '', b: b, n: b.nb_repas, kcal: null, rouge: true });
      att.forEach(function (a) { var r = recette(a.recette_id); lignes.push({ rec: a.recette_id, nom: r ? r.nom : '?', date: b.jour_livraison || '', b: b, n: a.nb_portions, kcal: a.kcal_portion, rouge: !b.jour_livraison }); });
    });
    if (!lignes.length) return '<div class="np-vide">Aucune commande en cours.</div>';
    lignes.sort(function (x, y) { return (x.nom + '|' + x.date).localeCompare(y.nom + '|' + y.date, 'fr'); });
    var html = '<table class="np-tab"><tr><th>Recette</th><th>Livraison</th><th>Client</th><th>Portions</th><th>kcal / portion</th></tr>', grp = null;
    lignes.forEach(function (l) {
      if (l.nom !== grp) { grp = l.nom; var tot = lignes.filter(function (x) { return x.nom === grp; }).reduce(function (t, x) { return t + x.n; }, 0);
        html += '<tr class="grp"><td colspan="5">' + (l.rec ? '<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + couleur(l.rec) + ';margin-right:6px"></i>' : '🔴 ') + h(grp) + ' — ' + tot + ' portion(s)</td></tr>'; }
      html += '<tr class="' + (l.rouge ? 'rouge' : '') + '"><td></td><td>' + (l.date ? fmtJ(l.date) : 'sans date') + '</td><td>' + h(nomClient(l.b.user_id)) + '</td><td>' + l.n + '</td><td>' + (l.kcal || '—') + '</td></tr>';
    });
    return html + '</table>';
  }

  /* ── 4. Production ──────────────────────────────────────────────────────── */
  function vueProduction() {
    var jour = S.jour || ymd(new Date()), pj = parJour()[jour];
    var html = '<div class="np-row" style="justify-content:space-between;margin-bottom:12px">'
      + '<div><div class="np-t">Production du ' + fmtJ(jour, true) + '</div><div class="np-s">' + (pj ? pj.bons.length + ' bon(s) · ' + Object.keys(pj.plats).length + ' recette(s)' : 'rien à livrer ce jour') + '</div></div>'
      + '<div class="np-row"><input type="date" class="np-in" id="npJourProd" value="' + jour + '">'
      + '<label class="np-s">Cuisiniers <input type="number" class="np-in n" id="npCuis" value="' + S.cuisiniers + '" min="1" max="12"></label>'
      + '<label class="np-s">Début <input type="time" class="np-in" id="npDebut" value="' + S.debut + '"></label></div></div>';
    if (!pj) return html + '<div class="np-vide">Aucune livraison ce jour. Choisir un autre jour, ou passer par le calendrier.</div>';
    if (pj.rouges.length) html += '<div class="np-alerte">🔴 ' + pj.rouges.length + ' bon(s) sans attribution ce jour : ' + h(pj.rouges.map(function (b) { return nomClient(b.user_id); }).join(', ')) + '. Ils ne sont pas dans le plan ci-dessous.</div>';

    var lots = lotsDuJour(pj);
    if (!lots.length) return html + '<div class="np-vide">Rien d’attribué ce jour.</div>';

    // ── mode MASSE : la production ────────────────────────────────────────
    html += '<div class="np-h">Production en masse — ' + lots.map(function (l) { return l.rec.nom + ' × ' + l.portions; }).join(' · ') + '</div>';
    html += '<div class="np-leg">' + lots.map(function (l) { return '<span><i style="background:' + l.couleur + '"></i>' + h(l.rec.nom) + ' — ' + l.fiches.toFixed(1) + ' fiche(s), ' + Math.round(l.gTotal / 100) / 10 + ' kg</span>'; }).join('') + '<span><i style="background:repeating-linear-gradient(45deg,#0004 0 2px,#0001 2px 4px)"></i>attente (four, repos) : cuisinier libre</span></div>';
    var manques = [];
    lots.forEach(function (l) {
      if (!l.etapesProd.length) manques.push(l.rec.nom + ' n’a aucune étape de production');
      else if (l.etapesProd.some(function (e) { return !e.duree_min; })) manques.push(l.rec.nom + ' : des étapes sans durée (' + DUREE_DEFAUT + ' min par défaut)');
    });
    if (manques.length) html += '<div class="np-note">⚠ ' + h(manques.join(' · ')) + ' — à compléter dans l’onglet Chef pour un plan juste.</div>';
    var plan = dispatcher(lots, S.cuisiniers, minDe(S.debut));
    html += gantt(plan);
    html += '<div class="np-h">Dans l’ordre — qui fait quoi, quand</div>';
    html += plan.taches.slice().sort(function (a, b) { return a.debut - b.debut || a.cuisinier - b.cuisinier; }).map(function (t) {
      return '<div class="np-etape"><div class="t">' + hm(t.debut) + ' → ' + hm(t.fin) + '</div><i class="c" style="background:' + t.couleur + '"></i>'
        + '<div class="b"><b>' + (t.passif ? '⏳ attente' : 'Cuisinier ' + (t.cuisinier + 1)) + '</b> · ' + h(t.rec) + ' — ' + h(t.titre)
        + '<small>' + h(t.desc) + (t.temperature ? ' · ' + t.temperature + ' °C' : '') + (t.poste ? ' · ' + h(t.poste) : '') + (t.defaut ? ' · <i>durée par défaut</i>' : '') + '</small></div></div>';
    }).join('');
    html += '<div class="np-note">Fin estimée <b>' + hm(plan.fin) + '</b> avec ' + S.cuisiniers + ' cuisinier(s). Les durées des étapes actives sont multipliées par √(nombre de fiches) — une estimation, pas une mesure : la fiche donne la durée pour une fiche, et doubler la masse ne double pas le temps de découpe.</div>';

    // ── mode PORTION : l'assemblage ───────────────────────────────────────
    html += '<div class="np-h">Assemblage — portion par portion, sur la balance</div>';
    html += '<div class="np-note">On quitte la masse. Pour chaque recette, toutes les portions de tous les clients, avec les grammes de <b>chaque</b> ingrédient : ils découlent de la cible calorique du client (×facteur sur la fiche). Cocher une portion quand elle est en boîte.</div>';
    lots.forEach(function (l) {
      var ass = (S.etapes[l.rec.id] || []).filter(function (e) { return e.phase === 'assemblage'; });
      html += '<div class="np-h" style="color:' + l.couleur + '">' + h(l.rec.nom) + ' — ' + l.portions + ' portion(s)</div>';
      if (ass.length) html += ass.map(function (e) { return '<div class="np-etape"><div class="t">Assemblage</div><i class="c" style="background:' + l.couleur + '"></i><div class="b">' + h(e.titre || 'Étape ' + e.numero) + '<small>' + h(e.description || '') + '</small></div></div>'; }).join('');
      var idx = 0;
      l.parClient.forEach(function (pc) {
        for (var i = 0; i < pc.n; i++) {
          idx++;
          var cle = 'np_' + jour + '_' + l.rec.id + '_' + pc.bon.id + '_' + i, fait = false;
          try { fait = localStorage.getItem(cle) === '1'; } catch (e) {}
          html += '<div class="np-port ' + (fait ? 'ok' : '') + '"><div class="hd"><input type="checkbox" data-coche="' + h(cle) + '" ' + (fait ? 'checked' : '') + '><b>' + idx + '/' + l.portions + ' · ' + h(nomClient(pc.bon.user_id)) + '</b>'
            + '<span class="np-s">' + (pc.p.kcal ? Math.round(pc.p.kcal) + ' kcal · ' : '') + Math.round(pc.p.gPortion) + ' g · ×' + pc.p.facteur.toFixed(2) + '</span></div><div class="np-ing">'
            + pc.p.ings.map(function (g) { return '<div><b>' + (g.g >= 10 ? Math.round(g.g) : Math.round(g.g * 10) / 10) + ' ' + h(g.unite) + '</b>' + h(g.nom) + '</div>'; }).join('')
            + '</div></div>';
        }
      });
    });
    return html;
  }

  /* Les lots du jour : par recette, toutes les portions de tous les bons, le
     nombre de fiches à produire (Σ portions × facteur ÷ portions de la fiche)
     et la répartition par client pour l'assemblage. */
  function lotsDuJour(pj) {
    var m = {};
    pj.bons.forEach(function (b) {
      attribsDe(b.id).forEach(function (a) {
        var r = recette(a.recette_id); if (!r) return;
        var p = portionPour(r, a.kcal_portion || 0);
        var l = m[r.id] = m[r.id] || { rec: r, portions: 0, fiches: 0, gTotal: 0, parClient: [], couleur: couleur(r.id),
          etapesProd: (S.etapes[r.id] || []).filter(function (e) { return e.phase !== 'assemblage'; }) };
        l.portions += a.nb_portions;
        l.fiches += a.nb_portions * p.facteur / (p.fiche.nb || 1);
        l.gTotal += a.nb_portions * p.gPortion;
        l.parClient.push({ bon: b, n: a.nb_portions, p: p });
      });
    });
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  /* ── L'algorithme de répartition ──────────────────────────────────────────
     Ordonnancement de liste : les étapes d'une recette sont séquentielles ;
     entre recettes tout est parallèle. À chaque instant, la tâche prête dont
     la recette a le plus long chemin restant passe en premier (le chemin
     critique), sur le premier cuisinier libre. Une étape PASSIVE (four,
     repos) démarre dès que la précédente finit et ne prend personne : le
     cuisinier enchaîne sur une autre recette. C'est ce qui évite le temps
     mort « tout le monde attend le four ». */
  function dispatcher(lots, nbCuis, t0) {
    var chaines = lots.map(function (l) {
      var s = Math.max(1, l.fiches);
      var et = l.etapesProd.map(function (e, i) {
        var d = e.duree_min > 0 ? e.duree_min : DUREE_DEFAUT;
        return { rec: l.rec.nom, couleur: l.couleur, titre: e.titre || ('Étape ' + (e.numero || i + 1)), desc: e.description || '',
          duree: e.passif ? d : Math.round(d * Math.sqrt(s)), passif: !!e.passif, temperature: e.temperature_c, poste: e.poste, defaut: !(e.duree_min > 0) };
      });
      var reste = 0; for (var i = et.length - 1; i >= 0; i--) { reste += et[i].duree; et[i].reste = reste; }
      return { et: et, i: 0, pret: t0 };
    });
    var libre = []; for (var c = 0; c < nbCuis; c++) libre.push(t0);
    var taches = [], fin = t0, garde = 0;
    while (garde++ < 5000) {
      var cand = chaines.filter(function (ch) { return ch.i < ch.et.length; });
      if (!cand.length) break;
      cand.sort(function (a, b) { return a.pret - b.pret || b.et[b.i].reste - a.et[a.i].reste; });
      // parmi les chaînes prêtes le plus tôt, la plus longue ; sinon la première prête
      var ch = null, tMin = Math.min.apply(null, libre);
      var pretes = cand.filter(function (x) { return x.pret <= tMin; });
      if (pretes.length) { pretes.sort(function (a, b) { return b.et[b.i].reste - a.et[a.i].reste; }); ch = pretes[0]; }
      else ch = cand[0];
      var t = ch.et[ch.i], debut, ci = -1;
      if (t.passif) { debut = ch.pret; }
      else {
        ci = 0; for (var k = 1; k < libre.length; k++) if (libre[k] < libre[ci]) ci = k;
        debut = Math.max(libre[ci], ch.pret);
        libre[ci] = debut + t.duree;
      }
      taches.push(Object.assign({}, t, { debut: debut, fin: debut + t.duree, cuisinier: ci }));
      ch.pret = debut + t.duree; ch.i++;
      if (ch.pret > fin) fin = ch.pret;
    }
    return { taches: taches, fin: fin, t0: t0, nbCuis: nbCuis };
  }

  function gantt(plan) {
    var tot = Math.max(30, plan.fin - plan.t0), lignes = [];
    for (var c = 0; c < plan.nbCuis; c++) lignes.push({ nom: 'Cuisinier ' + (c + 1), t: plan.taches.filter(function (x) { return x.cuisinier === c; }) });
    lignes.push({ nom: '⏳ Attentes', t: plan.taches.filter(function (x) { return x.passif; }) });
    var pas = tot > 240 ? 60 : 30, axe = '';
    for (var m = 0; m <= tot; m += pas) axe += '<span style="left:' + (m / tot * 100) + '%">' + hm(plan.t0 + m) + '</span>';
    return '<div class="np-gantt"><div class="np-axe"><div></div><div>' + axe + '</div></div>' + lignes.map(function (l) {
      return '<div class="np-gl"><div class="n">' + l.nom + '</div><div class="np-gt">' + l.t.map(function (t) {
        return '<div class="np-gb ' + (t.passif ? 'pas' : '') + '" style="left:' + ((t.debut - plan.t0) / tot * 100) + '%;width:' + Math.max(0.8, t.duree / tot * 100) + '%;background:' + t.couleur + '" title="' + h(t.rec + ' — ' + t.titre + ' (' + t.duree + ' min)') + '">' + h(t.rec.split(' ')[0] + ' · ' + t.titre) + '</div>';
      }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  /* ── Événements ─────────────────────────────────────────────────────────── */
  function clic(ev) {
    var b = ev.target.closest('[data-vue],[data-act],[data-filtre],[data-stp],[data-jour],[data-bon]');
    if (!b) return;
    if (b.dataset.vue) { S.vue = b.dataset.vue; if (S.vue === 'production' && !S.jour) S.jour = ymd(new Date()); rendre(); return; }
    if (b.dataset.stp) {
      var id = b.dataset.rec, n = (A.sel[id] || 0) + parseInt(b.dataset.stp, 10);
      A.sel[id] = Math.max(0, n);
      document.getElementById('npN_' + id).textContent = A.sel[id];
      b.closest('.np-rec').classList.toggle('on', A.sel[id] > 0);
      b.closest('.np-stp').querySelector('[data-stp="-1"]').disabled = A.sel[id] === 0;
      majCompte(); return;
    }
    if (b.dataset.act === 'recharger') { chargerTout().then(rendre); return; }
    if (b.dataset.act === 'nouveau-bon') { var f = document.getElementById('npFormBon'); f.style.display = f.style.display === 'none' ? 'block' : 'none'; return; }
    if (b.dataset.act === 'creer-bon') { creerBonManuel(); return; }
    if (b.dataset.act === 'generer-abos') { genererDepuisAbos(); return; }
    if (b.dataset.act === 'attribuer') { S.bonOuvert = b.dataset.id; S.vue = 'attribution'; rendre(); return; }
    if (b.dataset.act === 'retour-bons') { S.vue = 'bons'; rendre(); return; }
    if (b.dataset.act === 'enregistrer-attrib') { enregistrerAttribution(); return; }
    if (b.dataset.act === 'livre') { patchBon(b.dataset.id, { statut: 'livre' }).then(chargerTout).then(rendre); return; }
    if (b.dataset.act === 'annuler-bon') {
      var fn = window.Natty && window.Natty.confirmer ? window.Natty.confirmer('Annuler ce bon de commande ?') : Promise.resolve(window.confirm('Annuler ce bon de commande ?'));
      fn.then(function (ok) { if (ok) patchBon(b.dataset.id, { statut: 'annule' }).then(chargerTout).then(rendre); }); return;
    }
    if (b.dataset.act === 'mois') { S.mois.setMonth(S.mois.getMonth() + parseInt(b.dataset.d, 10)); rendre(); return; }
    if (b.dataset.act === 'voir-bons') { ev.preventDefault(); S.filtre = b.dataset.filtre || 'tous'; S.vue = 'bons'; rendre(); return; }
    if (b.dataset.filtre !== undefined && b.tagName === 'BUTTON') { S.filtre = b.dataset.filtre; rendre(); return; }
    if (b.dataset.jour) { S.jour = b.dataset.jour; S.vue = 'production'; rendre(); return; }
  }

  function change(ev) {
    var t = ev.target;
    if (t.dataset.jourBon) {
      var v = t.value || null;
      patchBon(t.dataset.jourBon, { jour_livraison: v, semaine: v ? lundiDe(v) : null }).then(function () { toast('Date de livraison enregistrée', 'ok'); return chargerTout(); })
        .then(function () { if (S.vue !== 'attribution') rendre(); }).catch(function (e) { toast('Erreur : ' + e.message, 'err'); });
      return;
    }
    if (t.id === 'npCible') {
      A.cibleRetenue = parseInt(t.value, 10) || A.cibleRetenue;
      var el = document.getElementById('npVue'); el.innerHTML = htmlAttribution(A.bon, A.cible); return;
    }
    if (t.id === 'npJourProd') { S.jour = t.value; rendre(); return; }
    if (t.id === 'npCuis') { S.cuisiniers = Math.max(1, parseInt(t.value, 10) || 1); rendre(); return; }
    if (t.id === 'npDebut') { S.debut = t.value || '08:00'; rendre(); return; }
    if (t.dataset.coche) {
      try { localStorage.setItem(t.dataset.coche, t.checked ? '1' : '0'); } catch (e) {}
      t.closest('.np-port').classList.toggle('ok', t.checked); return;
    }
  }

  window.NattyProd = {
    monter: function (host) {
      sbq('plats_menu?select=id,nom').then(function (p) { PLATS_MENU = p; }).catch(function () {});
      monter(host);
    },
    rafraichir: function () { if (S.charge) chargerTout().then(rendre); },
    // exposés pour le banc
    _dispatcher: dispatcher, _portionPour: portionPour, _etat: S
  };
})();
