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
     4. Production (un jour) — cinq SECTIONS derrière cinq tuiles héros, une
        seule ouverte à la fois (Pablo : « pas tout en vrac ») : les postes,
        le planning (Gantt), les dépendances (PERT), le tri par geste, et
        l'ASSEMBLAGE — on quitte la masse pour la portion, et l'écran dit,
        ingrédient par ingrédient, combien de grammes poser sur la balance
        pour chaque portion de chaque client.

   LES ÉTAPES D'UNE RECETTE FORMENT UN GRAPHE, PAS UNE FILE (`dependances`).
     « Cuire les carottes » attend « Couper les carottes » ; « Cuire le riz »
     n'attend personne. La dépendance est INFÉRÉE de l'aliment (mot à mot), et
     `recettes_etapes.depend_de` (numéros) la force quand l'inférence se
     trompe. Deux recettes qui coupent des carottes le même jour partagent un
     ATELIER : un seul nœud, les grammes de chacune, la découpe de chacune —
     et « Spécifier » en rouge tant que la fiche ne dit pas comment couper.
     Les suites (cuisson pour l'une, dressage pour l'autre) redeviennent
     indépendantes. Le PERT montre ce graphe ; le Gantt, le même graphe posé
     sur les cuisiniers.

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
    bonOuvert: null, cuisiniers: 2, debut: '08:00', charge: false, tri: 'cuisinier',
    // la section ouverte sous les tuiles héros (null = aucune), et l'étape
    // dont on est en train de spécifier la découpe
    section: null, specif: null,
    // les filtres du PERT : par type, les clés EXCLUES (vide = tout) ; et les
    // groupes dépliés
    filtres: {}, filtresOuverts: {}, focus: null
  };

  /* Les gestes qui PARTENT d'un aliment brut. Sans aliment déjà vu dans la
     recette, une telle étape ouvre une nouvelle chaîne (« Cuire le riz » ne
     dépend de rien). Tout autre geste sans aliment reconnu RÉUNIT ce qui est
     en cours — mijoter, enfourner, mélanger, dresser attendent tout. */
  var GESTES_DEPART = ['couper', 'rincer', 'peser', 'saisir', 'bouillir'];
  /* Les gestes qui NE font PAS d'atelier partagé : ce qui se dresse par
     portion, ce qui attend. Tout le reste — couper, saisir, enfourner,
     mijoter… — sur le même aliment dans deux recettes se fait en une fois
     (le croquis de Pablo : « Mettre le poulet au four » à cheval sur le curry
     et le wrap). La découpe, elle, n'a de sens que pour « couper ». */
  var GESTES_SANS_ATELIER = ['dresser', 'attendre', 'reposer', 'refrigerer', ''];
  /* Les découpes qu'on sait lire dans un titre ou une consigne. La clé est
     normalisée (norm), la valeur est ce qu'on affiche. */
  var DECOUPES = ['julienne', 'brunoise', 'mirepoix', 'paysanne', 'lamelles', 'rondelles', 'dés', 'cubes', 'bâtonnets',
    'quartiers', 'tranches', 'émincé', 'haché', 'ciselé', 'râpé', 'concassé', 'effiloché', 'sifflets', 'chiffonnade',
    'tronçons', 'demi-lunes', 'morceaux', 'grossièrement', 'finement', 'entier'];

  /* Les 16 gestes d'assets/recette.js, dans l'ordre d'une cuisine : ce qui se
     taille d'abord, ce qui cuit ensuite, ce qui attend, ce qui se dresse. C'est
     l'ordre de la vue « par geste » — pas l'alphabet. */
  var GESTES = [['couper', '🔪 Couper / hacher'], ['rincer', '💧 Rincer / égoutter'], ['peser', '⚖️ Peser'],
    ['huiler', '🫒 Huiler'], ['assaisonner', '🧂 Assaisonner'], ['melanger', '🥣 Mélanger'], ['fouetter', '🥄 Fouetter'],
    ['mixer', '🌀 Mixer / écraser'], ['saisir', '🍳 Saisir / poêler'], ['bouillir', '♨️ Bouillir / vapeur'],
    ['mijoter', '🍲 Mijoter'], ['enfourner', '🔥 Enfourner'], ['refrigerer', '❄️ Réfrigérer / mariner'],
    ['reposer', '⏸ Reposer'], ['attendre', '⏳ Attendre'], ['dresser', '🍽 Dresser'], ['', '❔ Sans geste']];
  function libGeste(g) { var x = GESTES.find(function (p) { return p[0] === (g || ''); }); return x ? x[1] : '❔ ' + g; }
  function emojiGeste(g) { return libGeste(g).split(' ')[0]; }

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
      '.np-gb.blo{background:#c0392b!important;opacity:.7}',
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
      '.np-postes{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:10px}',
      '.np-poste{background:var(--bg);border-radius:14px;box-shadow:var(--so);padding:12px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}',
      '.np-poste .em{font-size:24px}.np-poste .nm{font-weight:800;color:var(--black);font-size:13px}.np-poste .qui{font-size:12px;font-weight:700;color:var(--black)}',
      '.np-poste.moi{outline:2px solid #2a9e4f}.np-poste.pris{opacity:.75}.np-poste.vide{opacity:.45}.np-poste .np-btn{margin-top:4px;font-size:11px;padding:8px 12px}',
      /* la cinématique du service : noire, plein écran, un écran par étape */
      '#npCine{position:fixed;inset:0;z-index:12000;background:#0e0e11;color:#f4f4f7;font-family:DM Sans,-apple-system,sans-serif;display:flex;flex-direction:column;opacity:0;transition:opacity .25s}',
      '#npCine.on{opacity:1}#npCine:not(.on){pointer-events:none}',
      '#npCine .top{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 16px 10px}',
      '#npCine .top button{background:#ffffff14;border:none;color:#fff;border-radius:99px;padding:8px 14px;font-family:inherit;font-weight:700;cursor:pointer}',
      '#npCine .prog{flex:1;height:6px;border-radius:3px;background:#ffffff1a;overflow:hidden}#npCine .prog i{display:block;height:100%;background:#34c759;transition:width .3s}',
      '#npCine .cnt{font-size:12px;color:#ffffff8c;font-weight:700;white-space:nowrap}',
      '#npCine .stage{flex:1;position:relative;overflow:hidden}',
      '#npCine .plan{position:absolute;inset:0;overflow-y:auto;padding:18px 22px 120px;max-width:560px;margin:0 auto;animation:npIn .32s cubic-bezier(.22,1,.36,1)}',
      '#npCine .plan.out{animation:npOut .26s forwards;pointer-events:none}',
      '@keyframes npIn{from{opacity:0;transform:translateX(34px)}to{opacity:1;transform:none}}@keyframes npOut{to{opacity:0;transform:translateX(-34px)}}',
      '#npCine .plan.ar{animation-name:npInAr}@keyframes npInAr{from{opacity:0;transform:translateX(-34px)}to{opacity:1;transform:none}}',
      '#npCine .kick{font-size:12px;letter-spacing:.8px;text-transform:uppercase;color:#ffffff8c;font-weight:700}',
      '#npCine .rec{font-size:13px;color:#ffffffb3;margin-top:6px;display:flex;align-items:center;gap:8px}#npCine .rec i{width:10px;height:10px;border-radius:50%;display:inline-block}',
      '#npCine h1{font-size:34px;line-height:1.1;margin:14px 0 6px;font-weight:800;letter-spacing:-.5px}',
      '#npCine .ali{font-size:20px;color:#fff;font-weight:600;margin-bottom:14px}',
      '#npCine .desc{font-size:15px;line-height:1.55;color:#ffffffd9;background:#ffffff0f;border-radius:16px;padding:14px 16px;margin-bottom:12px}',
      '#npCine .qte{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:12px}',
      '#npCine .qte div{background:#ffffff14;border-radius:12px;padding:10px 12px;font-size:12px;color:#ffffffb3}#npCine .qte b{display:block;font-size:20px;color:#fff}',
      '#npCine .meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#ffffff8c;margin-bottom:12px}#npCine .meta span{background:#ffffff14;border-radius:99px;padding:5px 10px}',
      '#npCine .port{background:#ffffff0f;border-radius:14px;padding:10px 12px;margin-bottom:8px}#npCine .port b{font-size:14px}#npCine .port .g{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}#npCine .port .g span{background:#ffffff14;border-radius:8px;padding:5px 8px;font-size:12px}',
      '#npCine .fait{position:absolute;top:0;right:0;background:#34c759;color:#fff;font-size:11px;font-weight:800;padding:6px 12px;border-radius:0 0 0 12px}',
      /* la scène : la carte-notification et, sur les côtés, ce qui bloque */
      '#npCine .scene{display:grid;grid-template-columns:1fr;gap:10px;align-items:center;margin-top:10px}',
      '#npCine .cote{display:flex;flex-direction:column;gap:8px}#npCine .cote:empty{display:none}',
      '#npCine .carte{display:flex;align-items:center;gap:18px;background:#ffffff12;border-radius:26px;padding:20px 18px}',
      '#npCine .carte .illu{width:124px;height:124px;border-radius:30px;background:#ffffff1c;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '#npCine .carte .illu svg{width:88px;height:88px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}',
      '#npCine .carte .txt{min-width:0;flex:1}',
      '#npCine .carte .rec{margin:0;font-size:13px;color:#ffffffb3;display:flex;gap:6px;align-items:center;flex-wrap:wrap}#npCine .carte .rec i{width:12px;height:12px}',
      '#npCine .carte .act{font-size:24px;font-weight:800;line-height:1.15;margin:6px 0 8px;letter-spacing:-.4px}',
      '#npCine .carte .qte b{display:block;font-size:34px;font-weight:800;letter-spacing:-.8px;line-height:1}#npCine .carte .qte small{display:block;font-size:12px;color:#ffffff8c;margin-top:4px}',
      '#npCine .carte .att{margin-top:10px;font-size:12px;color:#ffb347;font-weight:700}',
      '#npCine .bloq{display:flex;gap:10px;align-items:center;background:#ffffff0a;border-radius:16px;padding:10px;opacity:.5;filter:grayscale(1)}',
      '#npCine .bloq .illu{width:50px;height:50px;border-radius:14px;background:#ffffff14;flex-shrink:0;display:flex;align-items:center;justify-content:center}#npCine .bloq .illu svg{width:34px;height:34px;fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}',
      '#npCine .bloq .txt{min-width:0}#npCine .bloq .rec{margin:0;font-size:11px;color:#ffffffb3;display:flex;gap:5px;align-items:center}#npCine .bloq .rec i{width:9px;height:9px}#npCine .bloq .act{font-size:13px;font-weight:700;line-height:1.2;margin:2px 0}#npCine .bloq .pst{font-size:11px;color:#ffffff8c}',
      '#npCine .suites{margin-top:10px;display:flex;flex-direction:column;gap:6px}#npCine .suites .l{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px}#npCine .suites b{color:#ffffff8c;font-size:11px;text-transform:uppercase;letter-spacing:.6px;margin-right:2px}#npCine .suites span{background:#ffffff14;border-radius:99px;padding:5px 10px;display:inline-flex;align-items:center;gap:6px}#npCine .suites span.autre{outline:1.5px solid #ffffff40}#npCine .suites i{width:9px;height:9px;border-radius:50%;display:inline-block}#npCine .suites small{color:#ffffff8c}',
      '#npCine .detbtn{margin:14px auto 0;display:block;background:#ffffff14;border:none;color:#fff;border-radius:99px;padding:9px 18px;font-family:inherit;font-weight:700;cursor:pointer;font-size:12px}',
      '@media(min-width:900px){#npCine .plan{max-width:1040px}#npCine .scene{grid-template-columns:minmax(0,220px) minmax(0,1fr) minmax(0,220px)}#npCine .scene .cote:empty{display:flex}}',
      '@media(max-width:899px){#npCine .cote.d{order:-1}}',
      // le matériel : une ligne dans la scène, des pastilles dans le détail
      '#npCine .carte .mat{margin-top:10px;font-size:12px;font-weight:700;color:#ffffffb3;line-height:1.4}',
      '#npCine .matl{display:flex;flex-wrap:wrap;gap:6px}#npCine .matl span{background:#ffffff14;border-radius:99px;padding:6px 11px;font-size:13px;font-weight:700;color:#ffffffd9}',
      '#npCine .sec{font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:#ffffff8c;font-weight:800;margin:16px 0 8px}#npCine .sec small{text-transform:none;letter-spacing:0;font-weight:600}',
      '#npCine .rep{display:flex;flex-direction:column;gap:6px}#npCine .rep div{background:#ffffff0f;border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.45;color:#ffffffd9}#npCine .rep b{display:block;font-size:11px;color:#ffffff8c;margin-bottom:3px;text-transform:uppercase;letter-spacing:.6px}#npCine .rep i{color:#ffffff8c}',
      '#npCine .chaine{display:flex;flex-direction:column;gap:6px}#npCine .chaine>div{background:#ffffff0f;border-radius:12px;padding:10px 12px;font-size:13px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}#npCine .chaine b{flex:0 0 100%;font-size:11px;color:#ffffff8c;text-transform:uppercase;letter-spacing:.6px}#npCine .chaine span{background:#ffffff14;border-radius:8px;padding:4px 8px}#npCine .chaine span.ok{background:#34c75933}#npCine .chaine i{color:#ffffff8c}',
      '#npCine .cta{position:absolute;left:0;right:0;bottom:0;padding:14px 16px calc(16px + env(safe-area-inset-bottom));display:flex;gap:10px;background:linear-gradient(#0e0e1100,#0e0e11 40%)}',
      '#npCine .cta button{flex:1;border:none;border-radius:16px;padding:16px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;background:#ffffff1a;color:#fff}',
      '#npCine .cta button.ok{background:#fff;color:#0e0e11;flex:2}#npCine .cta button.ok.on{background:#34c759;color:#fff}#npCine .cta button:disabled{opacity:.3}',
      '#npCine .som{position:absolute;inset:0;background:#0e0e11f2;overflow-y:auto;padding:18px 22px;z-index:2}#npCine .som .l{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:#ffffff0f;margin-bottom:6px;cursor:pointer;font-size:13px}#npCine .som .l.cur{outline:2px solid #fff}#npCine .som .l.ok{opacity:.55}',
      /* les tuiles héros : une par section, une seule ouverte */
      '.np-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0 18px}',
      '.np-tile{background:var(--bg);border-radius:18px;box-shadow:var(--so);padding:16px 16px 14px;border:none;text-align:left;cursor:pointer;font-family:inherit;color:var(--black);display:flex;flex-direction:column;gap:6px;min-height:118px;position:relative;transition:transform .15s,box-shadow .15s}',
      '.np-tile:hover{transform:translateY(-2px)}',
      '.np-tile.on{box-shadow:var(--si);transform:none}',
      '.np-tile.on:after{content:"";position:absolute;left:18px;right:18px;bottom:8px;height:3px;border-radius:2px;background:var(--black)}',
      '.np-tile .em{font-size:26px;line-height:1}',
      '.np-tile .nm{font-size:13px;font-weight:800;letter-spacing:-.2px}',
      '.np-tile .kp{font-size:20px;font-weight:800;letter-spacing:-.5px;margin-top:auto}',
      '.np-tile .kp small{display:block;font-size:11px;font-weight:600;color:var(--muted);letter-spacing:0;margin-top:2px}',
      '.np-tile .al{position:absolute;top:12px;right:12px;background:#c0392b;color:#fff;font-size:10px;font-weight:800;border-radius:99px;padding:3px 8px}',
      /* le PERT : des nœuds par niveau, des arêtes en SVG dessous */
      /* où en est chaque recette */
      /* le PERT et ses filtres, côte à côte */
      '.np-pert-wrap{display:flex;gap:12px;align-items:flex-start}',
      /* la carte de production : colonnes = recettes, l'heure descend */
      '.np-map{flex:1;min-width:0;background:var(--bg);border-radius:16px;box-shadow:var(--so);padding:10px;overflow-x:auto}',
      '.np-map-in{position:relative}',
      '.np-axe-t{position:absolute;left:0;transform:translateY(-50%);font-size:10px;font-weight:700;color:var(--muted)}',
      '.np-axe-l{position:absolute;height:0;border-top:1px dashed #0000000f}',
      '.np-spine{position:absolute;width:2px;background:var(--black);transform:translateX(-1px);opacity:.85}',
      '.np-col-hd{position:absolute;top:4px;height:38px;border-radius:99px;background:var(--black);color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 12px;box-sizing:border-box;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:2}',
      '.np-col-hd i{width:10px;height:10px;border-radius:50%;flex-shrink:0}',
      '.np-col-fin{position:absolute;height:40px;border-radius:99px;background:var(--bg);border:2px solid #c0392b;color:#c0392b;font-size:13px;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;box-sizing:border-box;z-index:2}',
      '.np-col-fin small{font-size:10px;font-weight:700;opacity:.8}',
      '.np-col-fin.encours{border-color:#2a9e4f;color:#2a9e4f}.np-col-fin.fini{background:#2a9e4f;border-color:#2a9e4f;color:#fff}',
      '.np-pill{position:absolute;box-sizing:border-box;border-radius:99px;background:var(--bg);border:1.5px solid #9a9aaa;color:var(--black);font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;padding:0 10px 0 8px;cursor:pointer;z-index:3;box-shadow:var(--sm);transition:box-shadow .15s,opacity .15s}',
      '.np-pill:hover{box-shadow:var(--so)}',
      '.np-pill .g{flex-shrink:0}.np-pill .ti{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.np-pill .qui{flex-shrink:0;font-size:10px;font-weight:800;color:var(--muted);background:#00000008;border-radius:99px;padding:2px 6px}.np-pill .qui.rouge{color:#c0392b;background:#c0392b14}',
      '.np-pill .ok{flex-shrink:0;color:#2a9e4f;font-weight:800}',
      '.np-pill.pret{border-color:var(--black);border-width:2px}',
      '.np-pill.fait{border-color:#2a9e4f;opacity:.6}',
      '.np-pill.attente{color:#6b6b78}',
      '.np-pill.bloque{border-color:#c0392b}',
      '.np-pill.atelier{border-color:#1a1a2e;border-width:2px}',
      '.np-pont{position:absolute;height:6px;border-radius:3px;background:#1a1a2e;z-index:2;display:flex;justify-content:center}',
      '.np-pied{position:absolute;width:6px;background:#1a1a2e;z-index:2;border-radius:3px}',
      '.np-pont span{position:relative;top:-16px;font-size:9px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#1a1a2e;background:var(--bg);padding:0 5px;border-radius:99px}',
      '.np-pill.passif{border-style:dashed}',
      '.np-pill.courant{box-shadow:var(--sm),0 0 0 3px #c97a00}',
      '.np-pill.dim{opacity:.18;filter:grayscale(1)}',
      // l'illustration de l'ingrédient sur le pill : le premier élément, comme
      // sur l'écran d'une étape — c'est ce qui fait retrouver son aliment d'un
      // coup d'œil dans une colonne de dix pills
      '.np-pill .il{flex-shrink:0;width:18px;height:18px;display:block}',
      '.np-pill .il svg{width:18px;height:18px;display:block;fill:none;stroke:var(--black);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}',
      '.np-pill.attente .il svg{stroke:#6b6b78}.np-pill.fait .il svg{stroke:#2a9e4f}',
      '.np-pill .g{font-size:11px}',
      // le survol d'un nom de recette : ses ingrédients du jour
      '.np-col-hd:hover{z-index:9;overflow:visible}',
      '.np-col-hd .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.np-ings{display:none;position:absolute;top:calc(100% + 6px);left:0;min-width:262px;max-height:320px;overflow:auto;background:var(--bg);color:var(--text);border-radius:14px;box-shadow:var(--so);padding:8px;z-index:10;text-align:left;font-weight:600;cursor:default}',
      '.np-col-hd:hover .np-ings{display:block}',
      '.np-ings .hd{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;padding:2px 6px 6px}',
      '.np-ings .ft{font-size:10px;color:var(--muted);font-weight:600;padding:6px 6px 2px;white-space:normal;line-height:1.35}',
      '.np-ings .ing{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:9px;font-size:12px;white-space:nowrap}',
      '.np-ings .ing .i{width:18px;height:18px;flex-shrink:0}',
      '.np-ings .ing .i svg{width:18px;height:18px;display:block;fill:none;stroke:var(--muted);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}',
      '.np-ings .ing .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}',
      '.np-ings .ing b{font-weight:800;font-size:11px;flex-shrink:0}',
      '.np-ings .ing.part{background:#c97a0014;cursor:pointer}.np-ings .ing.part:hover{background:#c97a0026}',
      '.np-ings .ing.part .i svg{stroke:#c97a00}.np-ings .ing.part .n{color:#8a5500}',
      '.np-ings .pt{display:flex;gap:2px;flex-shrink:0}.np-ings .pt i{width:8px;height:8px;border-radius:50%}',
      // le matériel : sur la carte d'une recette, et dans l'écran d'une étape
      '.np-poste .mat{font-size:10.5px;color:var(--muted);font-weight:600;line-height:1.35;white-space:normal}',
      // ⚠️ `overflow:hidden` : en `visible`, « 87 g · lamelles · avec Curry de
      // poulet rôti, Soupe de légumes » courait par-dessus les deux colonnes
      // voisines et se mêlait à LEURS étiquettes (mesuré à 1250 px).
      '.np-lab{position:absolute;font-size:10.5px;color:var(--black);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:4;line-height:1.3}',
      '.np-lab b{font-weight:800}',
      '.np-spec{background:#c0392b;color:#fff;border:none;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:800;font-family:inherit;cursor:pointer;white-space:nowrap}',
      '.np-spec.ok{background:#2a9e4f1f;color:#2a9e4f;cursor:pointer;padding:2px 7px;border-radius:99px;font-weight:800;font-size:10px}',
      '.np-specform{position:absolute;left:0;top:18px;display:flex;gap:6px;align-items:center;background:var(--bg);box-shadow:var(--so);border-radius:12px;padding:8px;z-index:9}',
      '.np-specform input{width:140px}',
      '.np-focus{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0 10px}',
      '.np-focus button{padding:6px 12px;border-radius:99px;border:none;background:var(--bg);box-shadow:var(--sm);font-family:inherit;font-size:11px;font-weight:700;color:var(--muted);cursor:pointer}',
      '.np-focus button.on{background:var(--black);color:#fff}.np-focus .sep{width:1px;height:18px;background:#0002;margin:0 4px}',
      '.np-fpanel{width:196px;flex-shrink:0;display:flex;flex-direction:column;gap:8px}',
      '.np-fgrp{background:var(--bg);border-radius:14px;box-shadow:var(--so);overflow:hidden}',
      '.np-fgrp.on{box-shadow:var(--si)}',
      '.np-fhd{width:100%;display:flex;align-items:center;gap:8px;padding:11px 12px;border:none;background:none;font-family:inherit;font-size:12px;font-weight:800;color:var(--black);cursor:pointer;text-align:left}',
      '.np-fhd>span:first-child{flex:1}',
      '.np-fcnt{font-size:10px;font-weight:700;color:var(--muted);background:#00000008;border-radius:99px;padding:2px 7px}',
      '.np-fchev{color:var(--muted);font-size:11px}',
      '.np-fbody{padding:0 8px 8px}',
      '.np-ftous{font-size:10px;color:var(--muted);padding:0 4px 6px}.np-ftous a{color:var(--black);font-weight:700;text-decoration:none}',
      '.np-fitem{display:flex;align-items:center;gap:7px;padding:6px 4px;font-size:12px;color:var(--black);cursor:pointer;border-radius:8px}',
      '.np-fitem:hover{background:#00000006}',
      '.np-fitem input{width:15px;height:15px;accent-color:#1a1a2e;margin:0;flex-shrink:0}',
      '.np-fitem i{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
      '.np-fitem span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.np-fitem small{color:var(--muted);font-weight:700}',
      '@media(max-width:700px){.np-pert-wrap{flex-direction:column}.np-fpanel{width:100%;flex-direction:row;flex-wrap:wrap}.np-fpanel .np-fgrp{flex:1;min-width:140px}}',
      '@media(max-width:700px){.np-cell{min-height:70px;padding:5px;font-size:10px}.np-gl{grid-template-columns:70px 1fr}.np-axe{grid-template-columns:70px 1fr}.np-hero{grid-template-columns:repeat(2,1fr)}}'
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
    // Entrée dans le champ de découpe enregistre ; Échap referme. Pas par
    // `change` : il partirait aussi au clic sur ✕, et enregistrerait quand même.
    host.addEventListener('keydown', function (ev) {
      if (ev.target.id !== 'npSpecInput') return;
      if (ev.key === 'Enter') { ev.preventDefault(); enregistrerDecoupe(S.specif, ev.target.value); }
      if (ev.key === 'Escape') { S.specif = null; rendre(); }
    });
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
    else {
      // Les postes pris et les étapes faites vivent en base (partagés entre les
      // téléphones de la cuisine) : on les relit à chaque affichage du jour.
      var jour = S.jour || ymd(new Date());
      el.innerHTML = '<div class="np-vide">Chargement de la journée…</div>';
      chargerJourProd(jour).then(function () { el.innerHTML = vueProduction(); })
        .catch(function (e) { el.innerHTML = '<div class="np-alerte">' + h(e.message) + '<br>Si le message parle de <code>production_postes</code>, le SQL du 2026-09-16 (fin de natty_production.sql) n’a pas été exécuté.</div>'; });
    }
  }

  /* ── Qui je suis, et ce que j'ai pris ───────────────────────────────────── */
  function moi() {
    var n = (typeof currentNutri !== 'undefined' && currentNutri && currentNutri.nom) || 'Cuisinier';
    var id = (typeof STAFF_SESSION !== 'undefined' && STAFF_SESSION && STAFF_SESSION.user && STAFF_SESSION.user.id) || ('nom:' + n);
    return { id: String(id), nom: n };
  }
  function chargerJourProd(jour) {
    return Promise.all([
      sbq('production_postes?jour=eq.' + jour + '&select=*'),
      sbq('production_etapes?jour=eq.' + jour + '&fait=eq.true&select=etape_id,cuisinier_nom')
    ]).then(function (r) {
      S.postes = r[0] || []; S.faits = {};
      (r[1] || []).forEach(function (f) { S.faits[f.etape_id] = f.cuisinier_nom || true; });
      S.faitsLoc = lireLoc();   // les morceaux d'étape cochés sur CET appareil
    });
  }
  /* Les cuisiniers du jour = les personnes qui ont pris au moins une recette,
     plus autant de RENFORTS anonymes qu'il en faut pour atteindre le nombre
     saisi en haut de l'écran. Personne n'a rien pris ? On retombe sur N
     cuisiniers anonymes, toutes recettes.
     > ⚠️ LES RENFORTS SONT LA RÉPONSE À « CHANGER LE NOMBRE DE CUISINIERS
     > MÊME QUAND LA PRODUCTION A DÉMARRÉ » (Pablo, 2026-09-20). Avant, dès
     > qu'une seule personne avait pris quelque chose, le champ « Cuisiniers »
     > DISPARAISSAIT de l'écran et le plan ne comptait plus que les gens
     > inscrits : arriver à trois en renfort ne changeait rien au planning, et
     > les recettes que personne n'avait prises restaient bloquées jusqu'à ce
     > qu'on les prenne nommément. Le champ reste là, et les renforts prennent
     > ce qui est LIBRE — on voit tout de suite ce que deux bras de plus
     > changent à l'heure de fin.
     > ⚠️ Un renfort ne se voit attribuer QUE des recettes libres : lui ouvrir
     > toutes les recettes lui ferait prendre le travail de quelqu'un qui l'a
     > nommément réclamé. */
  function cuisiniersDuJour(lots) {
    var par = {};
    (S.postes || []).forEach(function (p) {
      var c = par[p.cuisinier_id] = par[p.cuisinier_id] || { id: p.cuisinier_id, nom: p.cuisinier_nom || 'Cuisinier', postes: [] };
      c.postes.push(p.poste);
    });
    /* ⚠️ Une prise de l'ancienne organisation (« feux », « legumes ») ne tient
       AUCUNE recette : la compter comme un cuisinier lui ferait manger une
       place de renfort, donc une recette resterait bloquée à cause d'une ligne
       périmée. L'écran la signale par ailleurs, et invite à la libérer. */
    var l = Object.keys(par).map(function (k) { return par[k]; })
      .filter(function (c) { c.postes = c.postes.filter(function (x) { return recette(x); }); return c.postes.length > 0; });
    if (!l.length) return S.cuisiniers;
    var prises = {}; l.forEach(function (c) { c.postes.forEach(function (x) { prises[x] = 1; }); });
    var libres = (lots || S.lots || []).map(function (x) { return x.rec.id; }).filter(function (id) { return !prises[id]; });
    var n = Math.max(0, (S.cuisiniers || 0) - l.length);
    for (var i = 0; i < n; i++) l.push({ id: 'renfort_' + i, nom: 'Renfort ' + (i + 1), postes: libres, renfort: true });
    return l;
  }
  function prendrePoste(cle, prendre) {
    var jour = S.jour || ymd(new Date()), m = moi();
    var p = prendre
      ? sbq('production_postes', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ jour: jour, poste: cle, cuisinier_id: m.id, cuisinier_nom: m.nom }) })
      : sbq('production_postes?jour=eq.' + jour + '&poste=eq.' + cle, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    p.then(function () { rendre(); }).catch(function (e) {
      // 409 = quelqu'un l'a pris entre-temps : on recharge, et l'écran le montre.
      toast(/23505|409|duplicate/.test(e.message) ? 'Ce poste vient d’être pris par quelqu’un d’autre' : 'Erreur : ' + e.message, 'err'); rendre();
    });
  }
  function marquerFait(etapeId, fait) {
    var jour = S.jour || ymd(new Date()), m = moi();
    if (fait) S.faits[etapeId] = m.nom; else delete S.faits[etapeId];
    var p = fait
      ? sbq('production_etapes', { method: 'POST', headers: { 'Prefer': 'return=minimal,resolution=merge-duplicates' }, body: JSON.stringify({ jour: jour, etape_id: etapeId, fait: true, cuisinier_nom: m.nom }) })
      : sbq('production_etapes?jour=eq.' + jour + '&etape_id=eq.' + etapeId, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    return p.catch(function (e) { toast('Non enregistré : ' + e.message, 'err'); });
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
  /* Les cinq sections, dans l'ordre du travail. Chacune a sa tuile héros, qui
     porte le chiffre qu'on vient y chercher ; une seule est ouverte à la fois. */
  var SECTIONS = [
    { cle: 'postes', em: '👥', nom: 'Recettes' },
    { cle: 'planning', em: '📊', nom: 'Planning' },
    { cle: 'pert', em: '🕸', nom: 'Dépendances' },
    { cle: 'geste', em: '🔪', nom: 'Par geste' },
    { cle: 'assemblage', em: '⚖️', nom: 'Assemblage' }
  ];

  function vueProduction() {
    var jour = S.jour || ymd(new Date()), pj = parJour()[jour];
    var html = '<div class="np-row" style="justify-content:space-between;margin-bottom:12px">'
      + '<div><div class="np-t">Production du ' + fmtJ(jour, true) + '</div><div class="np-s">' + (pj ? pj.bons.length + ' bon(s) · ' + Object.keys(pj.plats).length + ' recette(s)' : 'rien à livrer ce jour') + '</div></div>'
      + '<div class="np-row"><input type="date" class="np-in" id="npJourProd" value="' + jour + '">'
      + '<label class="np-s" title="les personnes qui ont pris une recette, plus des renforts anonymes pour atteindre ce nombre">Cuisiniers <input type="number" class="np-in n" id="npCuis" value="' + S.cuisiniers + '" min="1" max="12"></label>'
      + '<label class="np-s">Début <input type="time" class="np-in" id="npDebut" value="' + S.debut + '"></label></div></div>';
    if (!pj) return html + '<div class="np-vide">Aucune livraison ce jour. Choisir un autre jour, ou passer par le calendrier.</div>';
    if (pj.rouges.length) html += '<div class="np-alerte">🔴 ' + pj.rouges.length + ' bon(s) sans attribution ce jour : ' + h(pj.rouges.map(function (b) { return nomClient(b.user_id); }).join(', ')) + '. Ils ne sont pas dans le plan ci-dessous.</div>';

    var lots = lotsDuJour(pj);
    if (!lots.length) return html + '<div class="np-vide">Rien d’attribué ce jour.</div>';

    var manques = [], orphelins = [];
    lots.forEach(function (l) {
      if (!l.etapesProd.length) manques.push(l.rec.nom + ' n’a aucune étape de production');
      else if (l.etapesProd.some(function (e) { return !e.duree_min; })) manques.push(l.rec.nom + ' : des étapes sans durée (' + DUREE_DEFAUT + ' min par défaut)');
      /* ⚠️ QUEL INGRÉDIENT N'EST PRÉPARÉ NULLE PART. Pablo, sur le Natty wrap :
         « il faut préparer et cuire le poulet » — et de fait aucune étape de
         production de cette fiche ne le nommait. L'app ne peut pas inventer
         l'étape manquante ; elle peut dire lequel des ingrédients traverse la
         journée sans que personne n'y touche. Les étapes d'ASSEMBLAGE comptent
         (un ingrédient qu'on pose au dressage est bien manipulé) ; le sel, les
         épices et tout ce qui ne pèse rien sont hors sujet. */
      var vus = {};
      (S.etapes[l.rec.id] || []).forEach(function (e) {
        ingredientsEtape(e, l.rec.id, 1).forEach(function (x) { vus[cleIng(x.nom)] = 1; });
      });
      var seuls = (S.ings[l.rec.id] || []).filter(function (i) {
        return parseFloat(i.quantite_g) >= 20 && !vus[cleIng(i.ingredient_nom)] && !estAssaisonnement(i.ingredient_nom);
      });
      if (seuls.length) orphelins.push(l.rec.nom + ' : ' + seuls.map(function (i) { return i.ingredient_nom; }).join(', '));
    });
    if (orphelins.length) html += '<div class="np-alerte">🍗 Aucune étape ne prépare ces ingrédients — ' + h(orphelins.join(' · ')) + '. Ils sont dans la fiche mais personne ne les taille, ne les cuit ni ne les dresse : ajouter l’étape dans l’onglet Chef. <i>(huiles, sel, poivre et épices exclus : ils s’ajoutent en cours de route.)</i></div>';
    if (manques.length) html += '<div class="np-note">⚠ ' + h(manques.join(' · ')) + ' — à compléter dans l’onglet Chef pour un plan juste.</div>';

    var cuis = cuisiniersDuJour(lots);
    var plan = dispatcher(lots, cuis, minDe(S.debut));
    S.plan = plan; S.lots = lots;

    html += '<div class="np-leg">' + lots.map(function (l) { return '<span><i style="background:' + l.couleur + '"></i>' + h(l.rec.nom) + ' — ×' + l.fiches.toFixed(1) + ' de la fiche, ' + Math.round(l.gTotal / 100) / 10 + ' kg</span>'; }).join('') + '</div>';
    html += tuilesHero(plan, lots);

    var sec = S.section;
    if (!sec) return html + '<div class="np-s" style="text-align:center;padding:6px 0 14px">Toucher une tuile pour ouvrir sa section. Fin estimée <b>' + hm(plan.fin) + '</b>.</div>';
    html += '<div class="np-sec">';
    if (sec === 'postes') html += sectionPostes(plan, lots);
    else if (sec === 'planning') html += sectionPlanning(plan);
    else if (sec === 'pert') html += sectionPert(plan);
    else if (sec === 'geste') html += '<div class="np-h">Par geste, puis par aliment — ce qui se fait en une fois</div>' + parGeste(plan);
    else if (sec === 'assemblage') html += sectionAssemblage(lots, jour);
    return html + '</div>';
  }

  /* Chaque tuile dit son chiffre : autant de raisons de l'ouvrir — ou de ne
     pas l'ouvrir. Le rouge n'est posé que sur ce qui bloque vraiment. */
  function tuilesHero(plan, lots) {
    var m = moi(), ts = plan.taches;
    var faits = ts.filter(estFait).length, prets = ts.filter(function (t) { return etatTache(t) === 'pret'; }).length;
    var cles = function (e) { return ts.filter(function (t) { return t.ensemble === e; }).map(function (t) { return t.cumul; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }); };
    var ateliers = cles('atelier'), cumuls = cles('cumul');
    var aSpecifier = ts.filter(function (t) { return t.ensemble === 'atelier' && t.geste === 'couper' && !decoupeDe(t); }).length;
    var pris = (S.postes || []).length, bloquees = ts.filter(function (t) { return t.bloque; }).length;
    var mesPostes = (S.postes || []).filter(function (p) { return p.cuisinier_id === m.id; }).length;
    var portions = lots.reduce(function (n, l) { return n + l.portions; }, 0);
    var alim = {}; ts.forEach(function (t) { String(t.aliment || '').split(/[,+;]/).forEach(function (a) { if (a.trim()) alim[norm(a)] = 1; }); });
    var kp = {
      // un poste EST une recette : la tuile compte les recettes prises
      postes: '<b>' + pris + '/' + lots.length + '</b><small>' + (mesPostes ? 'vous en tenez ' + mesPostes : 'recette(s) prise(s)') + '</small>',
      planning: '<b>' + hm(plan.fin) + '</b><small>fin estimée · ' + plan.nbCuis + ' cuisinier(s)</small>',
      pert: '<b>' + faits + '/' + ts.length + '</b><small>étapes faites · ' + prets + ' prête(s)' + (ateliers.length ? ' · ' + ateliers.length + ' atelier(s)' : '') + (cumuls.length ? ' · ' + cumuls.length + ' cumul(s)' : '') + '</small>',
      geste: '<b>' + Object.keys(alim).length + '</b><small>aliment(s) · ' + ts.filter(function (t) { return !t.passif; }).length + ' geste(s)</small>',
      assemblage: '<b>' + portions + '</b><small>portion(s) · ' + lots.length + ' recette(s)</small>'
    };
    var al = { postes: bloquees ? bloquees + ' sans poste' : '', pert: aSpecifier ? aSpecifier + ' à spécifier' : '' };
    return '<div class="np-hero">' + SECTIONS.map(function (s) {
      return '<button class="np-tile ' + (S.section === s.cle ? 'on' : '') + '" data-section="' + s.cle + '">'
        + (al[s.cle] ? '<span class="al">' + h(al[s.cle]) + '</span>' : '')
        + '<div class="em">' + s.em + '</div><div class="nm">' + s.nom + '</div><div class="kp">' + kp[s.cle] + '</div></button>';
    }).join('') + '</div>';
  }

  function sectionPlanning(plan) {
    var html = '<div class="np-h">Production en masse — ' + S.lots.map(function (l) { return h(l.rec.nom) + ' × ' + l.portions; }).join(' · ') + '</div>';
    html += '<div class="np-leg"><span><i style="background:repeating-linear-gradient(45deg,#0004 0 2px,#0001 2px 4px)"></i>attente (four, repos) : cuisinier libre</span><span><i style="background:#1a1a2e"></i>atelier partagé entre recettes</span></div>';
    html += gantt(plan);
    html += '<div class="np-h">Dans l’ordre — qui fait quoi, quand</div>';
    html += plan.taches.slice().sort(function (a, b) { return a.debut - b.debut || a.cuisinier - b.cuisinier; }).map(ligneTache).join('');
    html += '<div class="np-note">Fin estimée <b>' + hm(plan.fin) + '</b> avec ' + plan.nbCuis + ' cuisinier(s). Les durées des étapes actives sont multipliées par √(nombre de fiches) — une estimation, pas une mesure : la fiche donne la durée pour une fiche, et doubler la masse ne double pas le temps de découpe.'
      + (plan.cycle ? ' <b style="color:#c0392b">Une boucle de dépendances a été coupée</b> (des « dépend de » qui se renvoient l’un à l’autre) : vérifier les fiches.' : '') + '</div>';
    return html;
  }

  function sectionAssemblage(lots, jour) {
    var html = '<div class="np-h">Assemblage — portion par portion, sur la balance</div>';
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

  /* ── Les recettes du jour : qui en tient une, et « je prends » ──────────
     Un cuisinier prend une RECETTE et la mène du début à la fin. Ce qui
     s'affiche est donc exactement ce que la carte montre en colonnes. */
  function sectionPostes(plan, lots) {
    var m = moi(), parRec = {};
    plan.taches.forEach(function (t) { if (!t.passif) (parRec[t.recId] = parRec[t.recId] || []).push(t); });
    var mesRec = (S.postes || []).filter(function (p) { return p.cuisinier_id === m.id; }).map(function (p) { return p.poste; });
    var html = '<div class="np-h">Les recettes — chacun prend la sienne et la mène du début à la fin</div><div class="np-postes">';
    lots.forEach(function (l) {
      var cle = l.rec.id, ts = parRec[cle] || [], tenu = (S.postes || []).find(function (p) { return p.poste === cle; });
      var aMoi = tenu && tenu.cuisinier_id === m.id, min = ts.reduce(function (a, t) { return a + t.duree; }, 0);
      var faits = ts.filter(estFait).length;
      html += '<div class="np-poste ' + (tenu ? (aMoi ? 'moi' : 'pris') : '') + (ts.length ? '' : ' vide') + '">'
        + '<div class="em"><i style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' + l.couleur + '"></i></div>'
        + '<div class="nm">' + h(l.rec.nom) + '</div>'
        + '<div class="np-s">' + (ts.length ? ts.length + ' étape(s) · ~' + min + ' min' + (faits ? ' · ' + faits + ' faites' : '') : 'rien aujourd’hui') + '</div>'
        + (ts.length ? '<div class="mat" title="déduit des gestes de la fiche">🧰 ' + h(materielRecette(ts).join(' · ')) + '</div>' : '')
        + '<div class="qui">' + (tenu ? (aMoi ? '✅ Vous' : '👤 ' + h(tenu.cuisinier_nom || 'quelqu’un')) : '<span style="color:#c97a00">libre</span>') + '</div>'
        + (tenu ? (aMoi ? '<button class="np-btn sec" data-poste="' + h(cle) + '" data-prendre="0">Je libère</button>' : '<button class="np-btn sec" data-poste="' + h(cle) + '" data-prendre="0" title="Libérer (chef)">Libérer</button>')
                : (ts.length ? '<button class="np-btn" data-poste="' + h(cle) + '" data-prendre="1">Je prends</button>' : ''))
        + '</div>';
    });
    html += '</div>';
    // les lignes d'un ancien poste (« feux », « legumes ») ne désignent plus
    // rien : on le DIT plutôt que de les laisser tenir une recette fantôme
    var perimes = (S.postes || []).filter(function (p) { return !recette(p.poste); });
    if (perimes.length) html += '<div class="np-alerte">⚠️ ' + perimes.length + ' prise(s) de poste de l’ancienne organisation (' + h(perimes.map(function (p) { return p.poste; }).join(', ')) + ') : elles ne tiennent aucune recette. Libérez-les.</div>';
    var renforts = (plan.cuis || []).filter(function (c) { return c.renfort; });
    if (renforts.length) html += '<div class="np-s" style="margin:6px 0 0">👥 ' + renforts.length + ' renfort(s) anonyme(s) comptés dans le plan — ils prennent les recettes que personne n’a réclamées. Changez le nombre en haut de l’écran.</div>';
    var bloquees = plan.taches.filter(function (t) { return t.bloque; });
    if (bloquees.length) {
      var recsBl = bloquees.map(function (t) { return t.rec; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      html += '<div class="np-alerte">🔴 ' + bloquees.length + ' étape(s) sur une recette que personne n’a prise : ' + h(recsBl.join(', ')) + '. Elles attendent quelqu’un.</div>';
    }
    if (mesRec.length) {
      var mes = mesTaches(plan, lots), nb = mes.filter(estFait).length;
      html += '<div class="np-row" style="justify-content:space-between;margin:10px 0 4px"><div class="np-s">Vous tenez <b>' + h(mesRec.map(function (c) { return infoPoste(c).nom; }).join(' + ')) + '</b> — ' + mes.length + ' écran(s), ' + nb + ' fait(s).</div>'
        + '<button class="np-btn" data-act="service">▶ Mon service, écran par écran</button></div>';
    } else html += '<div class="np-s" style="margin:6px 0 4px">Prenez une recette pour ouvrir votre service écran par écran.</div>';
    return html;
  }

  /* Mes écrans : mes tâches du plan, dans l'ordre prévu — plus, si je tiens
     l'assemblage, un écran par recette avec toutes ses portions à peser. */
  function mesTaches(plan, lots) {
    var m = moi(), idx = plan.cuis.findIndex(function (c) { return c.id === m.id; });
    var mes = plan.taches.filter(function (t) { return t.cuisinier === idx; }).sort(function (a, b) { return a.debut - b.debut; });
    // L'assemblage appartient à la RECETTE, donc à celui qui l'a prise — il
    // n'y a plus de poste « assemblage » que quelqu'un tiendrait pour tous.
    var miennes = (S.postes || []).filter(function (p) { return p.cuisinier_id === m.id; }).map(function (p) { return p.poste; });
    lots.filter(function (l) { return miennes.indexOf(l.rec.id) >= 0; }).forEach(function (l) {
      var etapes = (S.etapes[l.rec.id] || []).filter(function (e) { return e.phase === 'assemblage'; });
      mes.push({ id: 'ass_' + l.rec.id, etapeId: 'ass_' + l.rec.id, assemblage: true, lot: l, etapes: etapes, rec: l.rec.nom, recId: l.rec.id, couleur: l.couleur, titre: 'Assembler ' + l.portions + ' portion(s)', etiquette: 'Assembler ' + l.portions + ' portion(s)', geste: 'dresser', poste: l.rec.id, debut: plan.fin, fin: plan.fin, duree: 0, preds: [] });
    });
    return mes;
  }

  function ligneTache(t) {
    var apres = (t.preds || []).map(function (id) { var p = S.plan && S.plan.parId[id]; return p ? p.titre : null; }).filter(Boolean);
    return '<div class="np-etape"><div class="t">' + hm(t.debut) + ' → ' + hm(t.fin) + '</div><i class="c" style="background:' + t.couleur + '"></i>'
      + '<div class="b"><b' + (t.bloque ? ' style="color:#c0392b"' : '') + '>' + (t.passif ? '⏳ attente' : (t.bloque ? '🔴 ' : '') + h(t.qui)) + '</b> <span class="np-s">' + infoPoste(t.poste).em + ' ' + h(infoPoste(t.poste).nom) + '</span> · ' + h(t.rec) + ' — ' + emojiGeste(t.geste) + ' ' + h(t.etiquette || t.titre)
      + (t.aliment ? ' <span class="np-s">· ' + h(t.aliment) + '</span>' : '')
      + (t.ensemble === 'atelier' ? ' <span class="np-pill v">ensemble · ' + (t.cumulAvec.length + 1) + ' recettes</span>' : t.cumul ? ' <span class="np-pill o">⇆ en même temps</span>' : '')
      + '<small>' + h(t.desc) + (t.temperature ? ' · ' + t.temperature + ' °C' : '') + (t.defaut ? ' · <i>durée par défaut</i>' : '')
      + (apres.length ? ' · après : ' + h(apres.join(', ')) : '') + '</small></div></div>';
  }

  /* La vue « par geste » : toutes les tâches du jour rangées par geste (dans
     l'ordre d'une cuisine), puis par aliment — deux recettes qui demandent de
     hacher des oignons apparaissent côte à côte, avec leur heure et leur
     cuisinier. C'est le tri demandé par Pablo : le geste ET l'aliment. Le
     rapprochement des aliments est fait mot à mot sur le texte libre de la
     fiche (« oignon, ail » et « oignons » se retrouvent sous « oignon »).
     Un atelier est déplié en ses parts : chaque recette garde sa ligne. */
  function parGeste(plan) {
    var groupes = {};
    var taches = [];
    plan.taches.forEach(function (t) {
      taches.push(t);
    });
    taches.forEach(function (t) {
      var g = t.geste || '';
      var G = groupes[g] = groupes[g] || {};
      var parts = String(t.aliment || '').split(/[,+;]/).map(function (a) { return a.trim(); }).filter(Boolean);
      if (!parts.length) parts = [t.titre];
      parts.forEach(function (a) {
        var cle = norm(a).split(' ').map(function (m) { return m.length > 3 ? m.replace(/s$/, '') : m; }).join(' ');
        (G[cle] = G[cle] || { lib: a, t: [] }).t.push(t);
      });
    });
    return GESTES.map(function (p) {
      var G = groupes[p[0]]; if (!G) return '';
      var cles = Object.keys(G).sort(function (a, b) { return G[b].t.length - G[a].t.length || a.localeCompare(b, 'fr'); });
      return '<div class="np-h" style="margin-top:14px">' + p[1] + ' <span class="np-pill g">' + cles.length + ' aliment(s)</span></div>'
        + cles.map(function (k) {
          var ts = G[k].t.slice().sort(function (a, b) { return a.debut - b.debut; });
          var recs = {}; ts.forEach(function (t) { recs[t.rec] = 1; });
          var multi = Object.keys(recs).length > 1;
          return '<div class="np-card" style="padding:10px 14px">'
            + '<div class="np-t" style="font-size:13px"><span style="text-transform:capitalize">' + h(G[k].lib) + '</span>' + (multi ? ' <span class="np-pill v">' + Object.keys(recs).length + ' recettes — à faire en une fois</span>' : '') + '</div>'
            + ts.map(function (t) {
              var dc = t.geste === 'couper' ? decoupeDe(t) : null;
              return '<div class="np-row" style="gap:8px;font-size:12px;margin-top:6px"><i style="width:9px;height:9px;border-radius:50%;background:' + t.couleur + ';flex-shrink:0"></i>'
                + '<b style="color:var(--black)">' + h(t.rec) + '</b> <span class="np-s">' + h(t.titre) + (dc ? ' · <b>' + h(dc) + '</b>' : '') + ' · ×' + t.fiches.toFixed(1) + ' fiche · ' + t.duree + ' min</span>'
                + '<span style="margin-left:auto" class="np-s">' + hm(t.debut) + ' · ' + (t.passif ? '⏳' : h(t.qui)) + '</span></div>';
            }).join('') + '</div>';
        }).join('');
    }).join('');
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

  /* ── UN POSTE = UNE RECETTE ──────────────────────────────────────────────
     Demande de Pablo (2026-09-20) : « organiser les postes en fonction des
     recettes (1 poste = 1 recette), c'est plus simple ». Un cuisinier prend
     une RECETTE et la mène du début à la fin ; l'algorithme ne lui donne
     qu'elle. C'est aussi ce que dit déjà la carte, dont chaque colonne est une
     recette — les deux lectures se recouvrent enfin.
     > ⚠️ CE QUE ÇA REMPLACE, et pourquoi ce n'était pas tenable. Les postes
     > étaient des familles de gestes (Taille, Feux, Four, Sauces, Assemblage) :
     > une seule recette passait par quatre personnes, personne ne la suivait
     > d'un bout à l'autre, et la carte — une colonne par recette — racontait
     > donc autre chose que le plan. Ne restait de cette organisation qu'un
     > seul apport réel, la règle de cumul, et elle n'a jamais appartenu au
     > poste : elle appartient au GESTE (voir `regleCumul`).
     > ⚠️ `production_postes.poste` porte désormais un IDENTIFIANT DE RECETTE.
     > La colonne est un `text` et la clé primaire reste `(jour, poste)`, donc
     > rien à migrer — mais une ligne écrite avant ce jour porte encore
     > « feux » ou « legumes », et ne correspondra à aucune recette : elle est
     > ignorée, pas lue de travers (`infoPoste` le dit en toutes lettres). */
  /* La règle de CUMUL vit sur le geste, pas sur le poste : deux cuissons en
     même temps, c'est deux feux et la plus longue décide ; deux tailles, c'est
     deux fois le couteau et elles s'additionnent. */
  var GESTES_SIMULTANES = ['saisir', 'bouillir', 'mijoter', 'enfourner'];
  function regleCumul(geste) { return GESTES_SIMULTANES.indexOf(geste || '') >= 0 ? 'max' : 'somme'; }
  function posteDe(e, recId) { return recId; }
  function infoPoste(cle) {
    var r = recette(cle);
    if (r) return { cle: cle, nom: r.nom, em: '🍽' };
    // une ligne de l'ancien monde (« feux », « legumes ») : on le DIT
    return { cle: cle, nom: cle ? 'ancien poste « ' + cle + ' »' : '—', em: '❔', ancien: true };
  }

  /* ── LE MATÉRIEL ─────────────────────────────────────────────────────────
     Demande de Pablo (2026-09-20) : « ajoute le matériel nécessaire pour
     chaque poste et chaque étape ». Ce qu'il faut sortir AVANT de commencer —
     une mise en place qu'on ne découvre pas au moment d'allumer le feu.
     ⚠️ C'EST DÉDUIT DU GESTE, et c'est annoncé comme tel. La fiche ne porte
     aucune colonne « matériel » ; l'inventer par recette serait écrire à la
     place du chef. Un geste, lui, demande toujours les mêmes outils : couper
     veut une planche et un couteau, enfourner veut un four et une plaque. Ce
     qui est propre à un plat — un chinois, un cercle à dresser — se met dans
     la consigne de l'étape, dans l'onglet Chef.
     ⚠️ La TEMPÉRATURE de la fiche ajoute la sonde : c'est le seul cas où un
     chiffre de la fiche change l'outillage. */
  var MATERIEL = {
    couper:      ['Planche', 'Couteau de chef', 'Bacs de réception'],
    rincer:      ['Passoire', 'Bac d’eau froide', 'Torchon ou essoreuse'],
    peser:       ['Balance', 'Bacs gastro', 'Étiquettes'],
    huiler:      ['Pinceau ou burette', 'Plat ou plaque'],
    assaisonner: ['Moulin à poivre', 'Sel fin', 'Cuillère à goûter'],
    melanger:    ['Saladier', 'Maryse ou spatule'],
    fouetter:    ['Cul-de-poule', 'Fouet'],
    mixer:       ['Mixeur plongeant', 'Récipient haut', 'Chinois si la fiche le dit'],
    saisir:      ['Poêle ou sauteuse', 'Pince', 'Feu vif'],
    bouillir:    ['Marmite', 'Passoire', 'Écumoire', 'Feu vif'],
    mijoter:     ['Cocotte ou rondeau', 'Couvercle', 'Feu doux'],
    enfourner:   ['Four préchauffé', 'Plaque + papier cuisson'],
    refrigerer:  ['Bacs filmés', 'Réfrigérateur ≤ 4 °C', 'Étiquettes'],
    reposer:     ['Plat', 'Feuille d’aluminium'],
    attendre:    ['Minuteur'],
    dresser:     ['Balance', 'Barquettes + opercules', 'Étiquettes']
  };
  /* ⚠️ CE QU'ON N'ATTEND PAS DE VOIR DANS UNE ÉTAPE. L'huile, le beurre, le
     sel, le poivre et les épices ne se « préparent » pas : on les ajoute en
     cours de route, et aucune fiche ne leur consacre une étape. Sans cette
     exception, l'avertissement « aucune étape ne prépare… » sortait « huile
     olive » sur trois recettes sur quatre et noyait le seul cas qui compte —
     les haricots verts du curry, que personne ne cuit. Un avertissement qu'on
     apprend à ignorer ne sert plus à rien. */
  var ASSAISONNEMENTS = ['huile', 'beurre', 'sel', 'poivre', 'epice', 'sucre', 'vinaigre', 'graisse'];
  function estAssaisonnement(nom) {
    var m = norm(nom).split(' ');
    return ASSAISONNEMENTS.some(function (k) { return m.some(function (x) { return x.indexOf(k) === 0; }); });
  }
  function materielDe(t) {
    var l = (MATERIEL[t.geste] || []).slice();
    if (t.temperature && ['enfourner', 'mijoter', 'saisir'].indexOf(t.geste) >= 0) l.push('Sonde (' + t.temperature + ' °C)');
    return l.length ? l : ['—'];
  }
  /* Le matériel d'une RECETTE : l'union de celui de ses étapes, dans l'ordre
     où on les fait. C'est la mise en place du cuisinier qui la prend. */
  function materielRecette(ts) {
    var vus = {}, out = [];
    ts.slice().sort(function (a, b) { return (a.numero - b.numero) || ((a.sousIndex || 0) - (b.sousIndex || 0)); })
      .forEach(function (t) { materielDe(t).forEach(function (m) { if (m !== '—' && !vus[m]) { vus[m] = 1; out.push(m); } }); });
    return out;
  }

  /* ── Les dépendances d'une recette ───────────────────────────────────────
     La fiche est écrite dans l'ordre où le chef y pense, pas dans l'ordre où
     tout doit s'enchaîner : « Cuire le riz » écrit après « Couper les
     carottes » n'attend pas les carottes. Ce qu'on lit, étape par étape :
       1. `depend_de` (numéros d'étapes, colonne facultative) : le chef a
          tranché, on le suit — parmi les étapes PRÉCÉDENTES seulement, pour
          qu'aucune boucle ne soit possible.
       2. Sinon, l'ALIMENT : chaque mot de l'aliment de l'étape est cherché
          dans les étapes précédentes ; la plus proche qui le porte est une
          dépendance. « Cuire les carottes » attend « Couper les carottes ».
       3. Sinon, le GESTE : un geste de départ (couper, rincer, peser, saisir,
          bouillir) ouvre une chaîne neuve — rien à attendre. Tout autre geste
          (mijoter, enfourner, mélanger, dresser…) RÉUNIT : il attend toutes
          les étapes en cours qui n'ont pas encore de suite.
     ⚠️ C'est une lecture, pas une vérité : le PERT la montre en toutes lettres
     pour que le chef la corrige dans la fiche (aliment, ou « dépend de »). */
  function motsAliment(txt) {
    return norm(txt).split(' ').filter(function (m) { return m.length > 2; }).map(function (m) { return m.replace(/s$/, ''); });
  }
  function dependances(etapes) {
    var mots = etapes.map(function (e) { return motsAliment(e.aliment); });
    var frontiere = [], preds = {};
    etapes.forEach(function (e, i) {
      var p = [];
      if (Array.isArray(e.depend_de) && e.depend_de.length) {
        e.depend_de.forEach(function (n) {
          for (var j = 0; j < i; j++) if (etapes[j].numero === n) { p.push(etapes[j].id); break; }
        });
      } else {
        mots[i].forEach(function (m) {
          for (var j = i - 1; j >= 0; j--) if (mots[j].indexOf(m) >= 0) { if (p.indexOf(etapes[j].id) < 0) p.push(etapes[j].id); break; }
        });
        if (!p.length && i > 0 && !(mots[i].length && GESTES_DEPART.indexOf(e.geste || '') >= 0)) p = frontiere.slice();
      }
      preds[e.id] = p;
      frontiere = frontiere.filter(function (id) { return p.indexOf(id) < 0; });
      frontiere.push(e.id);
    });
    return preds;
  }

  /* ── La découpe d'une étape de taille ───────────────────────────────────
     `recettes_etapes.decoupe` si la colonne existe et est remplie ; sinon on
     la LIT dans le titre et la consigne (« émincer », « en julienne »).
     Rien de lisible → null, et l'atelier affiche « Spécifier » en rouge. */
  function decoupeDe(e) {
    if (e.decoupe) return e.decoupe;
    var txt = ' ' + norm((e.titre || '') + ' ' + (e.desc || e.description || '')) + ' ';
    var mots = txt.split(' ');
    for (var i = 0; i < DECOUPES.length; i++) {
      var k = norm(DECOUPES[i]);
      if (mots.some(function (m) { return m.indexOf(k) === 0; })) return DECOUPES[i];
    }
    return null;
  }

  /* Le graphe du jour : les étapes de production de tous les lots, avec leurs
     dépendances, puis les ATELIERS — un même geste de taille sur un même
     aliment dans deux recettes devient un seul nœud, dont dépendent les suites
     de chacune. Les parts gardent leur recette, leurs grammes, leur découpe. */
  /* ── 1 INGRÉDIENT = 1 ÉTAPE ──────────────────────────────────────────────
     Demande de Pablo (2026-09-20) : « "Tailler" regroupe 4 étapes en 1, alors
     qu'il faut détailler 1 étape par aliment, avec l'illustration de l'aliment
     pour s'y retrouver. Pareil quand on cuit plusieurs aliments ou qu'on
     assemble. »
     Une étape de fiche dont l'aliment nomme PLUSIEURS ingrédients de la
     recette devient autant de tâches : une par ingrédient, chacune avec son
     illustration, ses grammes du jour, sa coche et son écran. C'est ce que le
     cuisinier fait réellement — il taille les carottes, puis les oignons, pas
     « les légumes ».
     ⚠️ LA LISTE VIENT DES INGRÉDIENTS DE LA FICHE, jamais du texte de
     l'aliment découpé aux virgules. « oignons, ail, carottes » cherché mot à
     mot dans `recettes_ingredients` donne trois LIGNES, donc trois noms exacts
     et trois grammages ; découper la chaîne aurait donné trois libellés sans
     quantité, et « pommes de terre » en deux morceaux.
     ⚠️ UNE ÉTAPE PASSIVE NE SE DÉCOUPE PAS : un mijotage de 30 minutes ne
     devient pas trois mijotages de dix. Le temps d'attente est celui du plat,
     pas celui d'un ingrédient.
     ⚠️ LA DURÉE SE PARTAGE, elle ne se multiplie pas : tailler quatre légumes
     en 15 minutes fait quatre tâches de 4 minutes. Sans ça, une journée
     tripleraît de longueur le jour où le chef détaille mieux ses fiches. */
  function ingredientsEtape(e, recId, fiches) {
    var ings = S.ings[recId] || [], mots = motsAliment(e.aliment), out = [];
    if (!mots.length) return out;
    ings.forEach(function (i) {
      var n = norm(i.ingredient_nom).split(' ').map(function (m) { return m.replace(/s$/, ''); });
      if (mots.some(function (m) { return n.indexOf(m) >= 0; }) && parseFloat(i.quantite_g) > 0) {
        out.push({ nom: i.ingredient_nom, g: parseFloat(i.quantite_g) * fiches });
      }
    });
    return out;
  }

  function grapheDuJour(lots) {
    var taches = [], parId = {}, predsEtape = {}, tachesDe = {};
    lots.forEach(function (l) {
      var s = Math.max(1, l.fiches), deps = dependances(l.etapesProd);
      Object.keys(deps).forEach(function (k) { predsEtape[k] = deps[k]; });
      l.etapesProd.forEach(function (e, i) {
        var d = e.duree_min > 0 ? e.duree_min : DUREE_DEFAUT;
        var ing = ingredientsEtape(e, l.rec.id, l.fiches);
        // une seule tâche quand il n'y a rien à détailler : aucun ingrédient
        // reconnu, un seul, ou une étape passive
        var parts = (!e.passif && ing.length > 1) ? ing : [null];
        var base = e.passif ? d : d / parts.length;
        tachesDe[e.id] = [];
        parts.forEach(function (x, k) {
          var t = { id: parts.length > 1 ? e.id + '#' + k : e.id, etapeId: e.id, sousIndex: k, sousTotal: parts.length,
            rec: l.rec.nom, recId: l.rec.id, fiches: l.fiches, couleur: l.couleur,
            titre: e.titre || ('Étape ' + (e.numero || i + 1)), desc: e.description || '',
            // ce qu'on lit sur le pill et dans le sommaire : l'ingrédient quand
            // l'étape en nomme un, le titre de l'étape sinon
            etiquette: x ? x.nom : (e.titre || ('Étape ' + (e.numero || i + 1))),
            geste: e.geste || '', aliment: x ? x.nom : (e.aliment || ''), ingrs: x ? [x] : ing,
            poste: posteDe(e, l.rec.id), numero: e.numero || i + 1, decoupe: e.decoupe || null,
            duree: Math.max(1, Math.round(base * (e.passif ? 1 : Math.sqrt(s)))), passif: !!e.passif,
            temperature: e.temperature_c, defaut: !(e.duree_min > 0), preds: [] };
          taches.push(t); parId[t.id] = t; tachesDe[e.id].push(t.id);
        });
      });
    });
    /* Les dépendances sont lues entre ÉTAPES DE FICHE ; les tâches en sont des
       morceaux. Une tâche attend donc TOUTES les tâches des étapes dont son
       étape dépend — « revenir les oignons » attend que les quatre légumes
       soient taillés, ce qui est bien ce qu'on veut : on ne met pas la poêle à
       chauffer sur une planche à moitié faite. */
    taches.forEach(function (t) {
      t.preds = (predsEtape[t.etapeId] || []).reduce(function (a, eid) { return a.concat(tachesDe[eid] || []); }, []);
    });
    /* ⚠️ AUCUN NŒUD COMPOSÉ, NULLE PART. « 1 bloc = 1 étape » (Pablo, deux
       fois) : une étape reste une étape, dans sa recette, avec sa coche, sa
       scène, sa quantité. Ce qui se fait ENSEMBLE — même geste sur le même
       aliment dans deux recettes (l'atelier), ou deux étapes d'une même
       recette prêtes au même moment au même poste (le cumul) — est seulement
       MARQUÉ d'une même clé `cumul` : `dispatcher` les pose ensemble sur le
       même cuisinier, la carte les relie par un pont, la scène dit « ensemble
       avec ». Une première version fusionnait les ateliers en un pill à cheval
       sur les colonnes : le wrap n'avait plus son « Cuire le poulet ». */
    function marquer(parts, cle, ensemble) {
      var regle = regleCumul(parts[0].geste);
      parts.forEach(function (t) { t.cumul = cle; t.cumulRegle = regle; t.ensemble = ensemble; t.cumulAvec = parts.filter(function (x) { return x !== t; }).map(function (x) { return x.id; }); });
    }
    /* Les ateliers : même geste, même aliment, ≥ 2 recettes.
       ⚠️ DEPUIS L'ÉCLATEMENT, CE RAPPROCHEMENT EST ENFIN JUSTE. Avant, une
       étape « Tailler : oignons, ail, carottes, poulet » ne pouvait se
       rapprocher que d'une étape portant EXACTEMENT les quatre mêmes mots :
       le wrap, qui taille « poivron, carotte, concombre, poulet », ne formait
       aucun atelier avec le curry alors que les carottes et le poulet sont
       bien taillés en une fois. Ingrédient par ingrédient, les deux carottes
       se retrouvent, et les poivrons restent au wrap. */
    var groupes = {};
    taches.forEach(function (t) {
      if (GESTES_SANS_ATELIER.indexOf(t.geste) >= 0 || t.passif) return;
      var m = motsAliment(t.aliment); if (!m.length) return;
      var k = t.geste + ' ' + m.sort().join(' ');
      (groupes[k] = groupes[k] || []).push(t);
    });
    Object.keys(groupes).forEach(function (k) {
      var parts = groupes[k], recs = {}; parts.forEach(function (p) { recs[p.recId] = 1; });
      if (Object.keys(recs).length < 2) return;
      marquer(parts, 'atelier_' + k.replace(/[^a-z0-9]+/gi, '_'), 'atelier');
    });
    /* Les morceaux d'une MÊME étape de fiche que l'atelier n'a pas déjà pris :
       même cuisinier, à la suite. Tailler les oignons puis l'ail, c'est une
       seule fois qu'on sort la planche — le dispatcher les pose ensemble, et
       la carte les montre l'une sous l'autre dans leur colonne.
       ⚠️ APRÈS l'atelier, jamais avant : la carotte du curry appartient
       d'abord à l'atelier des carottes (avec le wrap), et c'est ce
       rapprochement-là qui fait gagner du temps. */
    Object.keys(tachesDe).forEach(function (eid) {
      var l = tachesDe[eid].map(function (id) { return parId[id]; }).filter(function (t) { return t && !t.cumul && !t.passif; });
      if (l.length > 1) marquer(l, 'etape_' + eid, 'etape');
    });
    // les cumuls : même recette, même poste, prêtes au même moment (même
    // début au plus tôt sur le graphe, donc aucune ne dépend de l'autre)
    var ES = {};
    function es(t) {
      if (ES[t.id] != null) return ES[t.id];
      ES[t.id] = 0; // garde contre une boucle
      ES[t.id] = t.preds.reduce(function (m, id) { var p = parId[id]; return p ? Math.max(m, es(p) + p.duree) : m; }, 0);
      return ES[t.id];
    }
    taches.forEach(es);
    var cumuls = {};
    taches.forEach(function (t) {
      if (t.cumul || t.passif) return;
      var k = t.recId + '|' + t.poste + '|' + ES[t.id];
      (cumuls[k] = cumuls[k] || []).push(t);
    });
    Object.keys(cumuls).forEach(function (k) {
      if (cumuls[k].length < 2) return;
      marquer(cumuls[k], 'cumul_' + k.replace(/[^a-z0-9]+/gi, '_'), 'cumul');
    });
    // le plus long chemin restant (durée), pour la priorité
    var memo = {};
    function reste(t) {
      if (memo[t.id] != null) return memo[t.id];
      memo[t.id] = t.duree; // garde contre une boucle : la valeur provisoire
      var succ = taches.filter(function (x) { return x.preds.indexOf(t.id) >= 0; });
      memo[t.id] = t.duree + succ.reduce(function (m, x) { return Math.max(m, reste(x)); }, 0);
      return memo[t.id];
    }
    taches.forEach(function (t) { t.reste = reste(t); });
    return { taches: taches, parId: parId };
  }

  /* Une tâche est FAITE quand son étape l'est en base. Prête : toutes ses
     dépendances sont faites. */
  /* ── Qui est FAIT, et où c'est écrit ─────────────────────────────────────
     La base ne connaît que les ÉTAPES DE FICHE : `production_etapes.etape_id`
     référence `recettes_etapes(id)`, et un morceau d'étape — les carottes
     seules — n'a pas d'identifiant là-bas. Deux étages, donc :
       · la coche d'un MORCEAU vit sur l'appareil (`natty_prod_faits_<jour>`) ;
       · l'étape de fiche passe en base dès que TOUS ses morceaux sont cochés,
         et c'est ce que les autres écrans voient.
     ⚠️ Une étape non éclatée garde `t.id === t.etapeId` : son comportement est
     EXACTEMENT celui d'avant, base comprise. L'étage local n'existe que pour
     ce que la base ne sait pas nommer.
     ⚠️ Décocher un morceau d'une étape déjà en base retire la ligne, mais
     garde les AUTRES morceaux cochés localement — sinon corriger une carotte
     effacerait les oignons, l'ail et le poulet. */
  function cleLoc() { return 'natty_prod_faits_' + (S.jour || ymd(new Date())); }
  function lireLoc() {
    try { return JSON.parse(localStorage.getItem(cleLoc()) || '{}') || {}; } catch (e) { return {}; }
  }
  function ecrireLoc() {
    try { localStorage.setItem(cleLoc(), JSON.stringify(S.faitsLoc || {})); } catch (e) {}
  }
  function estFait(t) {
    if (S.faits[t.etapeId || t.id]) return true;          // la base a le dernier mot
    return !!(S.faitsLoc && S.faitsLoc[t.id]);
  }
  function morceauxDe(etapeId) {
    var pl = S.plan; if (!pl) return [];
    return pl.taches.filter(function (x) { return x.etapeId === etapeId; });
  }
  function etatTache(t) {
    if (estFait(t)) return 'fait';
    var plan = S.plan;
    var ok = (t.preds || []).every(function (id) { var p = plan && plan.parId[id]; return !p || estFait(p); });
    return ok ? 'pret' : 'attente';
  }
  function basculerFait(t) {
    var fait = !estFait(t);
    if (t.assemblage) { if (fait) S.faits[t.id] = moi().nom; else delete S.faits[t.id]; return Promise.resolve(); } // pas d'id d'étape en base : local
    S.faitsLoc = S.faitsLoc || {};
    var freres = morceauxDe(t.etapeId);
    if (freres.length < 2) {                              // étape non éclatée : la base, comme avant
      if (fait) S.faitsLoc[t.id] = moi().nom; else delete S.faitsLoc[t.id];
      ecrireLoc();
      return marquerFait(t.etapeId, fait);
    }
    if (!fait && S.faits[t.etapeId]) {
      // l'étape était close en base : on garde les frères cochés sur l'appareil
      freres.forEach(function (x) { if (x.id !== t.id) S.faitsLoc[x.id] = S.faits[t.etapeId]; });
    }
    if (fait) S.faitsLoc[t.id] = moi().nom; else delete S.faitsLoc[t.id];
    ecrireLoc();
    var tous = freres.every(function (x) { return !!S.faitsLoc[x.id]; });
    if (tous === !!S.faits[t.etapeId]) return Promise.resolve();   // rien à changer en base
    return marquerFait(t.etapeId, tous);
  }

  /* ── L'algorithme de répartition ──────────────────────────────────────────
     Ordonnancement de liste sur le GRAPHE du jour : une tâche est prête quand
     toutes ses dépendances sont finies ; entre chaînes indépendantes tout est
     parallèle — y compris DANS une recette. À chaque instant, la tâche prête
     qui a le plus long chemin restant passe en premier (le chemin critique),
     sur le premier cuisinier libre de son poste. Une étape PASSIVE (four,
     repos) démarre dès que ses dépendances finissent et ne prend personne :
     le cuisinier enchaîne ailleurs. C'est ce qui évite le temps mort « tout
     le monde attend le four ».
     `cuisiniers` : un nombre (N cuisiniers anonymes, tous postes) ou une liste
     [{nom, id, postes:[…]}] — les vrais, avec les postes qu'ils ont pris. Une
     tâche dont le poste n'est tenu par personne est BLOQUÉE : posée à l'heure
     où elle serait prête, sans cuisinier, et signalée. Ses suites continuent
     d'être planifiées derrière elle, pour que le plan reste lisible. */
  function dispatcher(lots, cuisiniers, t0) {
    var cuis = typeof cuisiniers === 'number'
      ? Array.apply(null, Array(cuisiniers)).map(function (_, i) { return { nom: 'Cuisinier ' + (i + 1), postes: null }; })
      : cuisiniers.slice();
    var g = grapheDuJour(lots);
    var libre = cuis.map(function () { return t0; });
    // Une recette PRISE ne va qu'à celui qui l'a prise ; une recette que
    // personne n'a prise n'est éligible pour personne — elle est BLOQUÉE, et
    // la carte le dit en rouge. (Cuisiniers anonymes : `postes` vaut null,
    // tout le monde peut tout faire.)
    function eligibles(t) {
      var r = [];
      cuis.forEach(function (c, i) { if (!c.postes || c.postes.indexOf(t.poste) >= 0) r.push(i); });
      return r;
    }
    var fins = {}, restants = g.taches.slice(), taches = [], fin = t0, garde = 0, cycle = false;
    while (restants.length && garde++ < 5000) {
      var pretes = restants.filter(function (t) { return t.preds.every(function (id) { return fins[id] != null || !g.parId[id]; }); });
      if (!pretes.length) {
        // des « dépend de » qui se renvoient l'un à l'autre : on coupe la
        // boucle à la tâche la moins attendue, et le plan le dit
        cycle = true;
        pretes = [restants.slice().sort(function (a, b) { return a.preds.length - b.preds.length; })[0]];
      }
      pretes.forEach(function (t) {
        var pret = t.preds.reduce(function (m, id) { return fins[id] != null ? Math.max(m, fins[id]) : m; }, t0);
        if (t.passif) { t.possible = pret; t.ci = -1; return; }
        var el = eligibles(t);
        if (!el.length) { t.possible = pret; t.ci = -2; return; }
        var ci = el[0]; el.forEach(function (i) { if (libre[i] < libre[ci]) ci = i; });
        t.possible = Math.max(libre[ci], pret); t.ci = ci;
      });
      pretes.sort(function (a, b) { return a.possible - b.possible || b.reste - a.reste; });
      var t = pretes[0], debut = t.possible;
      if (t.ci >= 0) libre[t.ci] = debut + t.duree;
      var pose = Object.assign({}, t, { debut: debut, fin: debut + t.duree, cuisinier: t.ci, bloque: t.ci === -2,
        qui: t.ci >= 0 ? cuis[t.ci].nom : (t.ci === -2 ? 'poste non pris' : 'attente') });
      taches.push(pose); g.parId[t.id] = pose;
      fins[t.id] = debut + t.duree;
      restants = restants.filter(function (x) { return x !== t; });
      if (fins[t.id] > fin) fin = fins[t.id];
      // ses cumulables, prêtes elles aussi : même cuisinier, tout de suite.
      // `max` (feux, four) : en même temps, la plus longue tient le cuisinier ;
      // `somme` (taille, sauces) : à la suite, sans changer de poste.
      if (t.cumul && t.ci >= 0) {
        var suivant = fins[t.id];
        /* ⚠️ SEULEMENT SI CE CUISINIER A LE DROIT DE LA FAIRE. Un atelier
           enjambe deux recettes ; depuis qu'un poste EST une recette, tirer la
           part de l'autre recette sur ce cuisinier la volerait à celui qui l'a
           prise. Quand les deux recettes sont tenues par la même personne — ou
           que l'autre n'est tenue par personne — l'atelier se fait en une
           fois, ce qui est tout son intérêt ; sinon chacun fait la sienne et
           l'étiquette sous le pill dit toujours « avec … ». */
        restants.filter(function (x) { return x.cumul === t.cumul && eligibles(x).indexOf(t.ci) >= 0 && x.preds.every(function (id) { return fins[id] != null || !g.parId[id]; }); }).forEach(function (x) {
          var d0 = t.cumulRegle === 'max' ? debut : suivant;
          var px = Object.assign({}, x, { debut: d0, fin: d0 + x.duree, cuisinier: t.ci, bloque: false, qui: cuis[t.ci].nom, possible: d0, ci: t.ci });
          taches.push(px); g.parId[x.id] = px; fins[x.id] = d0 + x.duree;
          if (t.cumulRegle !== 'max') suivant = fins[x.id];
          if (fins[x.id] > libre[t.ci]) libre[t.ci] = fins[x.id];
          if (fins[x.id] > fin) fin = fins[x.id];
          restants = restants.filter(function (y) { return y !== x; });
        });
      }
    }
    return { taches: taches, fin: fin, t0: t0, nbCuis: cuis.length, cuis: cuis, parId: g.parId, cycle: cycle };
  }

  function gantt(plan) {
    var tot = Math.max(30, plan.fin - plan.t0), lignes = [];
    for (var c = 0; c < plan.nbCuis; c++) lignes.push({ nom: plan.cuis[c].nom, t: plan.taches.filter(function (x) { return x.cuisinier === c; }) });
    var bloquees = plan.taches.filter(function (x) { return x.bloque; });
    if (bloquees.length) lignes.push({ nom: '🔴 Poste non pris', t: bloquees });
    // Les attentes se chevauchent souvent (deux mijotages en même temps) :
    // autant de lignes qu'il en faut pour qu'aucune barre n'en couvre une autre.
    var voies = [];
    plan.taches.filter(function (x) { return x.passif; }).sort(function (a, b) { return a.debut - b.debut; }).forEach(function (t) {
      var v = voies.find(function (l) { return l.fin <= t.debut; });
      if (!v) { v = { fin: 0, t: [] }; voies.push(v); }
      v.t.push(t); v.fin = t.fin;
    });
    voies.forEach(function (v, i) { lignes.push({ nom: '⏳ Attente' + (voies.length > 1 ? ' ' + (i + 1) : 's'), t: v.t }); });
    var pas = tot > 240 ? 60 : 30, axe = '';
    for (var m = 0; m <= tot; m += pas) axe += '<span style="left:' + (m / tot * 100) + '%">' + hm(plan.t0 + m) + '</span>';
    return '<div class="np-gantt"><div class="np-axe"><div></div><div>' + axe + '</div></div>' + lignes.map(function (l) {
      return '<div class="np-gl"><div class="n">' + l.nom + '</div><div class="np-gt">' + l.t.map(function (t) {
        var lib = emojiGeste(t.geste) + ' ' + t.rec.split(' ')[0] + ' · ' + t.titre;
        return '<div class="np-gb ' + (t.passif ? 'pas' : '') + (t.bloque ? ' blo' : '') + '" style="left:' + ((t.debut - plan.t0) / tot * 100) + '%;width:' + Math.max(0.8, t.duree / tot * 100) + '%;background:' + t.couleur + '" title="' + h(t.rec + ' — ' + t.titre + ' (' + t.duree + ' min)') + '">' + h(lib) + '</div>';
      }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  /* ── La carte de production ──────────────────────────────────────────────
     Le croquis de Pablo : UNE COLONNE PAR RECETTE, du pill de départ (noir,
     en haut) au pill d'arrivée (l'état, en bas), une colonne vertébrale entre
     les deux, et les étapes posées dessus DANS LE TEMPS — l'heure descend.
     Une étape partagée (atelier) ENJAMBE les colonnes des recettes qu'elle
     sert, et sous chacune on lit ce que cette recette en attend : « 404 g ·
     lamelles ». C'est là qu'on voit les recettes interagir. Le cuisinier est
     écrit sur chaque pill ; les puces Postes / Cuisiniers éclairent ce que
     fait chacun sans rien déplacer. Toucher un pill ouvre sa scène.
     Les filtres qui restent : l'aliment et la recette (cacher a un sens là). */
  var FILTRES = [
    { cle: 'aliment', nom: 'Aliment', em: '🥕' },
    { cle: 'recette', nom: 'Recette', em: '🍽' }
  ];
  function clesFiltre(t, type) {
    if (type === 'recette') return t.recId ? [t.recId] : [];
    var m = motsAliment(t.aliment);
    return m.length ? m : [''];
  }
  function filtreActif(type) { return S.filtres && S.filtres[type] && Object.keys(S.filtres[type]).length > 0; }
  function visiblePert(t) {
    return FILTRES.every(function (f) {
      if (!filtreActif(f.cle)) return true;
      return clesFiltre(t, f.cle).some(function (k) { return !S.filtres[f.cle][k]; });
    });
  }

  function panneauFiltres(ts) {
    S.filtres = S.filtres || {}; S.filtresOuverts = S.filtresOuverts || {};
    return '<div class="np-fpanel">' + FILTRES.map(function (f) {
      var comptes = {}, libs = {};
      ts.forEach(function (t) { clesFiltre(t, f.cle).forEach(function (k) { comptes[k] = (comptes[k] || 0) + 1; }); });
      Object.keys(comptes).forEach(function (k) {
        libs[k] = f.cle === 'recette' ? (recette(k) || {}).nom || k : (k ? k.charAt(0).toUpperCase() + k.slice(1) : '— sans aliment —');
      });
      var cles = Object.keys(comptes).sort(function (a, b) { return libs[a].localeCompare(libs[b], 'fr'); });
      var ouvert = !!S.filtresOuverts[f.cle], exclus = S.filtres[f.cle] || {}, nbEx = Object.keys(exclus).length;
      return '<div class="np-fgrp' + (ouvert ? ' on' : '') + '">'
        + '<button class="np-fhd" data-filtre-groupe="' + f.cle + '"><span>' + f.em + ' ' + f.nom + '</span>'
        + '<span class="np-fcnt">' + (nbEx ? (cles.length - nbEx) + '/' + cles.length : cles.length) + '</span><span class="np-fchev">' + (ouvert ? '▾' : '▸') + '</span></button>'
        + (ouvert ? '<div class="np-fbody"><div class="np-ftous"><a href="#" data-filtre-tous="' + f.cle + '" data-etat="1">tout</a> · <a href="#" data-filtre-tous="' + f.cle + '" data-etat="0">rien</a></div>'
          + cles.map(function (k) {
            return '<label class="np-fitem"><input type="checkbox" data-filtre-type="' + f.cle + '" data-filtre-cle="' + h(k) + '"' + (exclus[k] ? '' : ' checked') + '>'
              + (f.cle === 'recette' ? '<i style="background:' + couleur(k) + '"></i>' : '') + '<span>' + h(libs[k]) + '</span><small>' + comptes[k] + '</small></label>';
          }).join('') + '</div>' : '')
        + '</div>';
    }).join('') + '</div>';
  }

  /* Où en est chaque recette : ses étapes de production dans l'ordre de la
     fiche, combien sont faites, et l'ÉTAPE EN COURS — la première non faite
     qui est prête (sinon la première non faite). */
  function avancementRecette(recId, ts) {
    var etapes = ts.filter(function (t) { return t.recId === recId; })
      .sort(function (a, b) { return (a.numero - b.numero) || ((a.sousIndex || 0) - (b.sousIndex || 0)); });
    var faites = etapes.filter(estFait).length;
    var enCours = etapes.find(function (t) { return !estFait(t) && etatTache(t) === 'pret'; }) || etapes.find(function (t) { return !estFait(t); }) || null;
    return { etapes: etapes, faites: faites, total: etapes.length, enCours: enCours, fini: etapes.length > 0 && faites === etapes.length };
  }

  /* La CLÉ d'un ingrédient : son nom au singulier, mot à mot. C'est elle qui
     rapproche « carotte » du curry et « carottes » du wrap — la même règle que
     partout ailleurs dans ce module (§7 : jamais de sous-chaîne, « ail » se
     trouverait dans « volaille »). */
  function cleIng(nom) {
    return norm(nom).split(' ').map(function (m) { return m.length > 3 ? m.replace(/s$/, '') : m; }).join(' ');
  }
  /* Quels ingrédients sont PARTAGÉS par au moins deux recettes du jour, et
     lesquelles. C'est ce que le survol d'un nom de recette met en couleur. */
  function partages(lots) {
    var par = {};
    lots.forEach(function (l) {
      (S.ings[l.rec.id] || []).forEach(function (i) {
        if (!(parseFloat(i.quantite_g) > 0)) return;
        var k = cleIng(i.ingredient_nom);
        (par[k] = par[k] || { nom: i.ingredient_nom, recs: [] });
        if (par[k].recs.indexOf(l.rec.id) < 0) par[k].recs.push(l.rec.id);
      });
    });
    return par;
  }

  /* Les puces d'éclairage : une recette, un cuisinier ou un ingrédient
     partagé, et tout le reste s'estompe. Ce n'est pas un filtre — rien ne
     bouge, rien ne disparaît. */
  function pucesFocus(plan) {
    var f = S.focus || null, PART = partages(S.lots);
    var puce = function (type, cle, lib) {
      var on = f && f.type === type && f.cle === cle;
      return '<button class="' + (on ? 'on' : '') + '" data-focus-type="' + type + '" data-focus-cle="' + h(cle) + '">' + lib + '</button>';
    };
    var cuis = plan.cuis.map(function (c, i) { return { i: i, nom: c.nom }; }).filter(function (c) { return plan.taches.some(function (t) { return t.cuisinier === c.i; }); });
    var ali = '';
    if (f && f.type === 'aliment') {
      var pi = PART[f.cle] || { nom: f.cle, recs: [] };
      // l'ingrédient éclairé DIT avec quelles recettes il est partagé — c'est
      // la réponse au clic sur une pastille du survol
      ali = '<span class="sep"></span><button class="on" data-focus-type="" data-focus-cle="" title="tout ré-afficher">'
        + '🔗 ' + h(pi.nom) + ' — ' + h(pi.recs.map(function (r) { return (recette(r) || {}).nom || r; }).join(' + ')) + ' ✕</button>';
    }
    return '<div class="np-focus"><span class="np-s">Éclairer :</span><button class="' + (f ? '' : 'on') + '" data-focus-type="" data-focus-cle="">Tout</button>'
      + S.lots.map(function (l) { return puce('poste', l.rec.id, '<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + l.couleur + ';margin-right:5px"></i>' + h(l.rec.nom)); }).join('')
      + (cuis.length > 1 ? '<span class="sep"></span>' + cuis.map(function (c) { return puce('cuisinier', String(c.i), '👤 ' + h(c.nom)); }).join('') : '')
      + ali + '</div>';
  }
  /* Le nom d'un cuisinier sur un pill : deux caractères quand c'est un
     anonyme (C1, R2), le prénom tronqué sinon. Un pill fait 36 px de haut et
     partage sa largeur avec une illustration, un geste et un ingrédient. */
  function courtNom(n) {
    var m = String(n || '').match(/^(Cuisinier|Renfort)\s*(\d+)$/);
    if (m) return m[1].charAt(0) + m[2];
    return String(n || '').split(' ')[0].slice(0, 7);
  }
  function estEclaire(t) {
    var f = S.focus; if (!f) return true;
    if (f.type === 'poste') return t.poste === f.cle;
    if (f.type === 'cuisinier') return String(t.cuisinier) === f.cle;
    if (f.type === 'aliment') return (t.ingrs || []).some(function (x) { return cleIng(x.nom) === f.cle; });
    return true;
  }

  function sectionPert(plan) {
    var ts = plan.taches, parId = plan.parId;
    if (!ts.length) return '<div class="np-vide">Aucune étape.</div>';
    var vis = ts.filter(visiblePert);
    // les colonnes : les recettes du jour qui ont au moins un pill visible
    var recs = S.lots.map(function (l) { return l.rec; }).filter(function (r) { return vis.some(function (t) { return t.recId === r.id || (t.parts && t.parts.some(function (p) { return p.recId === r.id; })); }); });
    if (!recs.length) return '<div class="np-pert-wrap">' + panneauFiltres(ts) + '<div class="np-map"><div class="np-vide">Rien ne passe les filtres.</div></div></div>';
    var colDe = {}; recs.forEach(function (r, i) { colDe[r.id] = i; });
    // l'ÉCHELLE : l'heure descend. Une minute = `ECH` px ; les colonnes se
    // partagent la largeur disponible, 170 px au moins, 280 au plus.
    // sous 700 px le panneau des filtres passe au-dessus : toute la largeur est à la carte
    var hote = document.getElementById('npVue'), largeurDispo = hote ? hote.clientWidth - (hote.clientWidth < 700 ? 24 : 232) : 900;
    /* ⚠️ 210 px de colonne AU MINIMUM, et la carte défile si ça déborde.
       À 170, un pill de 150 px devait loger une illustration, un geste, un
       ingrédient et un cuisinier : « Dorer le bœuf » s'affichait « Dorer l… ».
       Une carte qu'on fait défiler se lit ; une carte illisible, non. */
    var GUT = 46, COLW = Math.max(210, Math.min(300, Math.floor((largeurDispo - GUT) / recs.length))), Y0 = 64, H = 36;
    var tot = Math.max(30, plan.fin - plan.t0);
    // l'échelle se règle sur la colonne la plus dense : deux étapes qui se
    // suivent à g minutes d'écart ne doivent pas se chevaucher (H + 6 px),
    // sans dépasser 10 px/min — sinon une journée de 5 h ferait 3 m de haut
    var ECH = 3;
    recs.forEach(function (r) {
      var l = vis.filter(function (t) { return t.recId === r.id || (t.parts && t.parts.some(function (p) { return p.recId === r.id; })); }).map(function (t) { return t.debut; }).sort(function (a, b) { return a - b; });
      for (var i = 1; i < l.length; i++) { var g = l[i] - l[i - 1]; if (g > 0) ECH = Math.max(ECH, Math.min(10, (H + 6) / g)); }
    });
    var yDe = function (min) { return Y0 + (min - plan.t0) * ECH; };
    var PART = partages(S.lots);
    // avancement et étape en cours par recette (pour le halo et le pill d'arrivée)
    var av = {}, courants = {};
    recs.forEach(function (r) { av[r.id] = avancementRecette(r.id, ts); if (av[r.id].enCours) courants[av[r.id].enCours.id] = true; });

    // ── la position de chaque pill ────────────────────────────────────────
    // par colonne, dans l'ordre de l'heure ; deux pills qui se chevauchent
    // se partagent la largeur s'ils partent en même temps (cumul), sinon le
    // second descend sous le premier
    var pos = {}, occupe = {}; // occupe[col] = [{y, h, x, w, debut}]
    /* ⚠️ LA HAUTEUR RÉSERVÉE COMPREND L'ÉTIQUETTE. Un pill d'atelier porte
       sous lui une ligne de ~15 px — les grammes, la découpe, « avec … ».
       Réserver la seule hauteur du pill la laissait passer SOUS le pill
       suivant : mesuré, « 163 g · julienne · avec Curry… » se lisait par-dessus
       « poivron ». Même famille que les quatre compressions flex déjà payées
       dans ce dépôt : une hauteur demandée doit être réservée, pas espérée. */
    function poser(t, c0, c1) {
      var hb = H + (t.ensemble === 'atelier' ? 15 : 0);
      var x = GUT + c0 * COLW + 10, w = (c1 - c0 + 1) * COLW - 20, y = yDe(t.debut);
      var pris = [];
      for (var c = c0; c <= c1; c++) (occupe[c] || []).forEach(function (o) { if (pris.indexOf(o) < 0) pris.push(o); });
      /* ⚠️ ON EMPILE, ON NE MET PLUS CÔTE À CÔTE. Deux pills partant à la
         même minute se partageaient la largeur de la colonne : c'était
         lisible tant qu'un pill portait un titre d'étape, ça ne l'est plus
         depuis que chacun porte une illustration, un geste, un ingrédient et
         un cuisinier. Mesuré à 1250 px sur quatre recettes : 107 px par pill,
         et l'étiquette tombait à « oi… ». La simultanéité, elle, se lit déjà
         au pont et à la ligne d'heure — pas besoin de la payer deux fois. */
      pris.forEach(function (o) { if (y < o.y + o.h + 6 && y + hb > o.y) y = o.y + o.h + 6; });
      var p = { x: x, w: w, y: y, h: hb, hp: H, debut: t.debut, c0: c0, c1: c1 };
      pos[t.id] = p;
      for (var cc = c0; cc <= c1; cc++) (occupe[cc] = occupe[cc] || []).push(p);
    }
    vis.slice().sort(function (a, b) { return a.debut - b.debut; }).forEach(function (t) {
      if (colDe[t.recId] != null) poser(t, colDe[t.recId], colDe[t.recId]);
    });
    var yFin = Object.keys(pos).reduce(function (m, k) { return Math.max(m, pos[k].y + pos[k].h); }, yDe(plan.fin)) + 46;
    var hauteur = yFin + 60, largeur = GUT + recs.length * COLW;

    // ── le dessin ──────────────────────────────────────────────────────────
    var html = '';
    // l'axe des heures, à gauche
    var pas = tot > 240 ? 60 : 30;
    for (var m = 0; m <= tot; m += pas) html += '<div class="np-axe-t" style="top:' + yDe(plan.t0 + m) + 'px">' + hm(plan.t0 + m) + '</div><div class="np-axe-l" style="top:' + yDe(plan.t0 + m) + 'px;left:' + GUT + 'px;width:' + (recs.length * COLW) + 'px"></div>';
    // les colonnes : vertèbre, pill de départ, pill d'arrivée
    recs.forEach(function (r, i) {
      var cx = GUT + i * COLW + COLW / 2, a = av[r.id];
      var etat = a.fini ? 'fini' : a.faites ? 'encours' : 'attente';
      /* Le survol du nom d'une recette ouvre SES ingrédients du jour, avec
         leurs grammes ; ceux qu'une autre recette du jour demande aussi sont
         en couleur, et les toucher éclaire partout où cet ingrédient passe —
         c'est ainsi qu'on voit avec quelle recette il est partagé (demande de
         Pablo, 2026-09-20). Le panneau est un ENFANT de l'en-tête : `:hover`
         le garde ouvert quand la souris descend dedans. */
      var ingsR = (S.ings[r.id] || []).filter(function (x) { return parseFloat(x.quantite_g) > 0; });
      var panneau = '<div class="np-ings"><div class="hd">' + ingsR.length + ' ingrédient(s) · ×' + (S.lots.find(function (x) { return x.rec.id === r.id; }) || { fiches: 1 }).fiches.toFixed(1) + ' fiche</div>'
        + ingsR.map(function (x) {
            var k = cleIng(x.ingredient_nom), pa = PART[k], part = pa && pa.recs.length > 1;
            var autres = part ? pa.recs.filter(function (q) { return q !== r.id; }) : [];
            var g = parseFloat(x.quantite_g) * ((S.lots.find(function (y) { return y.rec.id === r.id; }) || { fiches: 1 }).fiches);
            return '<div class="ing' + (part ? ' part' : '') + '"' + (part ? ' data-ali="' + h(k) + '" title="' + h('Partagé avec ' + autres.map(function (q) { return (recette(q) || {}).nom || q; }).join(', ') + ' — toucher pour l’éclairer') + '"' : '') + '>'
              + '<span class="i">' + illustration(x.ingredient_nom) + '</span><span class="n">' + h(x.ingredient_nom) + '</span><b>' + h(libG(g)) + '</b>'
              + (part ? '<span class="pt">' + autres.map(function (q) { return '<i style="background:' + couleur(q) + '"></i>'; }).join('') + '</span>' : '')
              + '</div>';
          }).join('')
        + '<div class="ft">Les pastilles de couleur : un ingrédient qu’une autre recette demande aussi.</div></div>';
      html += '<div class="np-spine" style="left:' + cx + 'px;top:' + (Y0 - 14) + 'px;height:' + (yFin - Y0 + 14) + 'px"></div>'
        + '<div class="np-col-hd" style="left:' + (GUT + i * COLW + 8) + 'px;width:' + (COLW - 16) + 'px"><i style="background:' + couleur(r.id) + '"></i><span class="nm">' + h(r.nom) + '</span>' + panneau + '</div>'
        + '<div class="np-col-fin ' + etat + '" style="left:' + (GUT + i * COLW + 8) + 'px;width:' + (COLW - 16) + 'px;top:' + yFin + 'px" title="' + h(a.faites + ' étape(s) sur ' + a.total) + '">' + h(r.nom) + '<small>' + (a.fini ? '✓ terminée' : a.faites ? a.faites + '/' + a.total + ' · en cours' : 'à commencer') + '</small></div>';
    });
    // les PONTS : les étapes d'un même atelier posées à la même heure sont
    // reliées par une barre sombre derrière les pills — c'est là qu'on voit
    // deux recettes se servir du même geste. Décalées dans le temps (l'une
    // n'était pas prête) : pas de pont, l'étiquette dit « avec … ».
    // Le pont relie les étapes d'un atelier que le MÊME cuisinier fait en une
    // session : en même temps (feux : deux poêles) ou à la suite (taille : les
    // carottes du curry puis celles du wrap). Barre à la hauteur de la
    // première ; un pied descend vers celles qui viennent après.
    var ponts = {};
    vis.forEach(function (t) { if (t.ensemble === 'atelier' && pos[t.id] && t.cuisinier >= 0) (ponts[t.cumul] = ponts[t.cumul] || []).push(t); });
    Object.keys(ponts).forEach(function (k) {
      var l = ponts[k].sort(function (a, b) { return a.debut - b.debut; }).filter(function (t) { return t.cuisinier === ponts[k][0].cuisinier; });
      if (l.length < 2) return;
      var xs = l.map(function (t) { return pos[t.id].x + pos[t.id].w / 2; }), y = pos[l[0].id].y + (pos[l[0].id].hp || pos[l[0].id].h) / 2;
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      html += '<div class="np-pont" style="left:' + x0 + 'px;width:' + (x1 - x0) + 'px;top:' + (y - 3) + 'px" title="' + h(l.map(function (t) { return t.rec + ' : ' + t.titre; }).join(' + ')) + '"><span>ensemble</span></div>';
      l.slice(1).forEach(function (t) {
        var q = pos[t.id]; if (q.y <= y) return;
        html += '<div class="np-pied" style="left:' + (q.x + q.w / 2 - 3) + 'px;top:' + y + 'px;height:' + (q.y - y) + 'px"></div>';
      });
    });
    // les pills
    var ordrePert = [];
    vis.slice().sort(function (a, b) { return a.debut - b.debut; }).forEach(function (t) {
      var p = pos[t.id]; if (!p) return;
      ordrePert.push(t.id);
      var et = etatTache(t), P = infoPoste(t.poste);
      var cls = 'np-pill ' + et + (t.bloque ? ' bloque' : '') + (t.ensemble === 'atelier' ? ' atelier' : '') + (t.passif ? ' passif' : '') + (courants[t.id] ? ' courant' : '') + (estEclaire(t) ? '' : ' dim');
      html += '<div class="' + cls + '" data-node="' + h(t.id) + '" style="left:' + p.x + 'px;top:' + p.y + 'px;width:' + p.w + 'px;height:' + (p.hp || p.h) + 'px" title="' + h(t.rec + ' — ' + t.titre + (t.sousTotal > 1 ? ' · ' + t.aliment + ' (' + (t.sousIndex + 1) + '/' + t.sousTotal + ')' : '') + ' · ' + hm(t.debut) + '–' + hm(t.fin) + (t.cuisinier >= 0 ? ' · ' + t.qui : '') + ' · 🧰 ' + materielDe(t).join(', ')) + '">'
        + '<span class="il">' + illustration(t.aliment || t.titre) + '</span><span class="g">' + emojiGeste(t.geste) + '</span><span class="ti">' + h(t.etiquette || t.titre) + '</span>'
        + (t.cuisinier >= 0 ? '<span class="qui">' + h(courtNom(plan.cuis[t.cuisinier].nom)) + '</span>' : t.bloque ? '<span class="qui rouge">libre</span>' : '')
        + (et === 'fait' ? '<span class="ok">✓</span>' : '') + '</div>';
      // sous une étape d'atelier : ce que CETTE recette en attend — grammes,
      // découpe (Spécifier en rouge si elle manque) — et avec qui elle se fait
      if (t.ensemble === 'atelier') {
        var dc = t.geste === 'couper' ? decoupeDe(t) : null, q = quantitesEtape(t), g = q.map(function (x) { return x.lib; }).join(' + ');
        var avec = t.cumulAvec.map(function (id) { return parId[id]; }).filter(function (x) { return x && x.debut !== t.debut; }).map(function (x) { return x.rec; });
        html += '<div class="np-lab" style="left:' + (p.x + 8) + 'px;top:' + (p.y + (p.hp || p.h) + 2) + 'px;max-width:' + (p.w - 12) + 'px"><b>' + h(g || t.duree + ' min') + '</b>'
          + (t.geste !== 'couper' ? '' : dc ? ' · <span class="np-spec ok" data-spec="' + h(t.id) + '" title="modifier la découpe">' + h(dc) + '</span>' : ' · <button class="np-spec" data-spec="' + h(t.id) + '">Spécifier</button>')
          + (avec.length ? ' · <i>avec ' + h(avec.join(', ')) + '</i>' : '')
          + (S.specif === t.id ? '<div class="np-specform"><input class="np-in" list="npDecoupes" id="npSpecInput" placeholder="julienne, dés…" value="' + h(t.decoupe || dc || '') + '"><button class="np-btn" data-spec-save="' + h(t.id) + '" style="padding:7px 10px">OK</button><button class="np-btn sec" data-spec-annuler="1" style="padding:7px 10px">✕</button></div>' : '')
          + '</div>';
      }
    });
    S.pertOrdre = ordrePert;

    var faits = ts.filter(estFait).length, prets = ts.filter(function (t) { return etatTache(t) === 'pret'; }).length;
    var nbFiltres = FILTRES.filter(function (f) { return filtreActif(f.cle); }).length;
    return '<div class="np-row" style="justify-content:space-between;margin-bottom:8px"><div class="np-h" style="margin:0">Carte de production — chaque recette, du début à la fin, et où elles se croisent</div>'
      + '<div class="np-s">' + faits + ' faite(s) · <b>' + prets + ' prête(s)</b> · fin ' + hm(plan.fin) + (nbFiltres ? ' · <b>' + vis.length + '/' + ts.length + ' affichées</b> <a href="#" data-filtre-raz="1">tout afficher</a>' : '') + '</div></div>'
      + pucesFocus(plan)
      + '<div class="np-leg"><span><i style="background:#2a9e4f"></i>fait</span><span><i style="background:var(--black)"></i>prêt : ses dépendances sont faites</span><span><i style="background:#aeaec0"></i>en attente</span><span><i style="background:#c97a00"></i>l’étape en cours de la recette</span><span><i style="background:#1a1a2e;border-radius:3px;width:18px;height:5px"></i>pont : même geste, même aliment, deux recettes — fait ensemble</span><span><i style="border:1.5px dashed #888;background:none"></i>attente (four, repos)</span></div>'
      + '<datalist id="npDecoupes">' + DECOUPES.map(function (d) { return '<option value="' + h(d) + '">'; }).join('') + '</datalist>'
      + '<div class="np-pert-wrap">' + panneauFiltres(ts)
      + '<div class="np-map"><div class="np-map-in" style="width:' + largeur + 'px;height:' + hauteur + 'px">' + html + '</div></div></div>'
      + '<div class="np-note">L’heure descend. <b>Un pill = une étape de sa recette.</b> Deux pills reliés par un pont se font <b>ensemble</b> (même geste, même aliment, même cuisinier, même heure) — sous chacun, ce que sa recette en attend (grammes, découpe). Les dépendances sont <b>lues</b> dans les fiches : même aliment → l’étape attend la précédente qui le porte ; pour forcer : « dépend de » dans l’onglet Chef. Toucher un pill ouvre sa scène.'
      + (plan.cycle ? ' <b style="color:#c0392b">Une boucle de « dépend de » a été coupée.</b>' : '') + '</div>';
  }

  /* Ouvrir la fiche d'un bloc du PERT : les mêmes écrans que « Mon service »,
     dans l'ordre des vagues, ouverts sur le bloc touché. */
  function ouvrirDetail(id) {
    if (!S.plan || !S.pertOrdre) return;
    C.taches = S.pertOrdre.map(function (k) { return S.plan.parId[k]; }).filter(Boolean);
    var i = C.taches.findIndex(function (t) { return t.id === id; }); if (i < 0) return;
    C.i = i; C.depuisPert = true;
    if (!C.el) construireCine();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { C.el.classList.add('on'); });
    setTimeout(function () { C.el.classList.add('on'); }, 60);
    aller(C.i, true);
  }

  /* Spécifier la découpe d'une part d'atelier : écrit `recettes_etapes.decoupe`.
     Si la colonne n'existe pas encore (natty_production_ateliers.sql), PostgREST
     répond PGRST204 — et l'écran nomme le SQL au lieu d'un message cryptique. */
  function enregistrerDecoupe(etapeId, valeur) {
    var v = String(valeur || '').trim() || null;
    return sbq('recettes_etapes?id=eq.' + etapeId, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ decoupe: v }) })
      .then(function () {
        Object.keys(S.etapes).forEach(function (rid) { S.etapes[rid].forEach(function (e) { if (e.id === etapeId) e.decoupe = v; }); });
        S.specif = null; toast(v ? 'Découpe : ' + v : 'Découpe effacée', 'ok'); rendre();
      })
      .catch(function (e) {
        toast(/decoupe|PGRST204|column/.test(e.message) ? 'Colonne « decoupe » absente : exécuter natty_production_ateliers.sql' : 'Non enregistré : ' + e.message, 'err');
      });
  }

  /* ── Événements ─────────────────────────────────────────────────────────── */
  function clic(ev) {
    var b = ev.target.closest('[data-vue],[data-act],[data-filtre],[data-stp],[data-jour],[data-bon],[data-section],[data-poste],[data-spec],[data-spec-save],[data-spec-annuler],[data-node],[data-filtre-groupe],[data-filtre-tous],[data-filtre-raz],[data-focus-type],[data-ali]');
    if (!b) return;
    // une pastille d'ingrédient partagé, dans le survol d'un nom de recette :
    // elle éclaire cet ingrédient partout où il passe, et la puce du haut dit
    // avec quelles recettes il l'est
    if (b.dataset.ali) { S.focus = { type: 'aliment', cle: b.dataset.ali }; rendre(); return; }
    // les filtres du PERT : déplier un groupe, tout cocher / décocher, remettre à zéro
    if (b.dataset.filtreGroupe) { S.filtresOuverts = S.filtresOuverts || {}; S.filtresOuverts[b.dataset.filtreGroupe] = !S.filtresOuverts[b.dataset.filtreGroupe]; rendre(); return; }
    if (b.dataset.filtreTous) {
      ev.preventDefault(); S.filtres = S.filtres || {};
      if (b.dataset.etat === '1') S.filtres[b.dataset.filtreTous] = {};
      else { var ex = {}; S.plan.taches.forEach(function (t) { clesFiltre(t, b.dataset.filtreTous).forEach(function (k) { ex[k] = true; }); }); S.filtres[b.dataset.filtreTous] = ex; }
      rendre(); return;
    }
    if (b.dataset.filtreRaz) { ev.preventDefault(); S.filtres = {}; rendre(); return; }
    if (b.dataset.focusType !== undefined) { S.focus = b.dataset.focusType ? { type: b.dataset.focusType, cle: b.dataset.focusCle } : null; rendre(); return; }
    // une tuile héros : ouvre sa section, ou la referme si c'était elle
    if (b.dataset.section) { S.section = S.section === b.dataset.section ? null : b.dataset.section; S.specif = null; rendre(); return; }
    // la découpe d'une part d'atelier — AVANT le nœud, qui l'englobe
    if (b.dataset.spec) { S.specif = S.specif === b.dataset.spec ? null : b.dataset.spec; rendre(); return; }
    if (b.dataset.specSave) { var inp = document.getElementById('npSpecInput'); enregistrerDecoupe(b.dataset.specSave, inp ? inp.value : ''); return; }
    if (b.dataset.specAnnuler) { S.specif = null; rendre(); return; }
    // un bloc du PERT : sa fiche, écran par écran (« Fait ✓ » y est)
    if (b.dataset.node) {
      if (ev.target.closest('.np-specform')) return;
      ouvrirDetail(b.dataset.node); return;
    }
    if (b.dataset.poste) { prendrePoste(b.dataset.poste, b.dataset.prendre === '1'); return; }
    if (b.dataset.act === 'service') { ouvrirService(); return; }
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
    if (t.dataset.filtreType) {
      // décoché = exclu ; la liste des exclus vide veut dire « pas de filtre »
      S.filtres = S.filtres || {}; var f = S.filtres[t.dataset.filtreType] = S.filtres[t.dataset.filtreType] || {};
      if (t.checked) delete f[t.dataset.filtreCle]; else f[t.dataset.filtreCle] = true;
      rendre(); return;
    }
    if (t.dataset.coche) {
      try { localStorage.setItem(t.dataset.coche, t.checked ? '1' : '0'); } catch (e) {}
      t.closest('.np-port').classList.toggle('ok', t.checked); return;
    }
  }

  /* ── Le service, écran par écran ────────────────────────────────────────
     Un écran par étape de MES postes, dans l'ordre prévu par l'algorithme :
     l'heure, le poste, le geste, l'aliment, la recette, la consigne, et les
     QUANTITÉS de la journée pour cet aliment (les grammes de la fiche × le
     nombre de fiches). ‹ › naviguent librement, le sommaire saute n'importe où,
     « Fait ✓ » écrit en base — l'écran d'à côté le voit. Le bouton d'action
     est dans une barre FIXE, hors du plan animé (leçon narration.html). */
  var C = { taches: [], i: 0, el: null, sortie: null, details: false };

  function ouvrirService() {
    if (!S.plan) return;
    C.taches = mesTaches(S.plan, S.lots);
    if (!C.taches.length) { toast('Aucune étape sur vos postes aujourd’hui', 'ok'); return; }
    // on ouvre sur la première étape pas encore faite
    C.i = Math.max(0, C.taches.findIndex(function (t) { return !estFait(t); }));
    C.depuisPert = false;
    if (!C.el) construireCine();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { C.el.classList.add('on'); });
    setTimeout(function () { C.el.classList.add('on'); }, 60);
    aller(C.i, true);
  }
  function construireCine() {
    C.el = document.createElement('div'); C.el.id = 'npCine';
    C.el.innerHTML = '<div class="top"><button data-c="fermer">✕</button><div class="prog"><i></i></div><button data-c="som" class="cnt" style="background:none"></button></div>'
      + '<div class="stage"></div><div class="cta"><button data-c="prec">‹</button><button data-c="fait" class="ok"></button><button data-c="suiv">›</button></div>';
    document.body.appendChild(C.el);
    C.el.addEventListener('click', clicCine);
    document.addEventListener('keydown', function (ev) { if (!C.el.classList.contains('on')) return; if (ev.key === 'ArrowRight') aller(C.i + 1); if (ev.key === 'ArrowLeft') aller(C.i - 1); if (ev.key === 'Escape') fermerService(); });
  }
  function fermerService() {
    if (!C.el) return;
    C.el.classList.remove('on'); document.body.style.overflow = '';
    setTimeout(function () { var st = C.el.querySelector('.stage'); if (st) st.innerHTML = ''; rendre(); }, 260);
  }
  function aller(i, sansAnim) {
    if (i < 0 || i >= C.taches.length) return;
    var arriere = i < C.i; C.i = i;
    var stage = C.el.querySelector('.stage'), som = C.el.querySelector('.som'); if (som) som.remove();
    // TOUS les plans sortants partent — deux taps rapprochés laisseraient sinon un
    // plan orphelin sous le nouveau (le chevauchement connu de narration.html).
    stage.querySelectorAll('.plan').forEach(function (p) { p.classList.add('out'); setTimeout(function () { p.remove(); }, 300); });
    var p = document.createElement('div'); p.className = 'plan' + (arriere ? ' ar' : ''); if (sansAnim) p.style.animation = 'none';
    p.innerHTML = htmlEcran(C.taches[i]);
    stage.appendChild(p);
    majBarre();
  }
  function majBarre() {
    var t = C.taches[C.i], nb = C.taches.filter(estFait).length;
    C.el.querySelector('.prog i').style.width = ((C.i + 1) / C.taches.length * 100) + '%';
    C.el.querySelector('[data-c="som"]').textContent = (C.i + 1) + ' / ' + C.taches.length + ' · ' + nb + ' ✓';
    C.el.querySelector('[data-c="prec"]').disabled = C.i === 0;
    C.el.querySelector('[data-c="suiv"]').disabled = C.i === C.taches.length - 1;
    var ok = C.el.querySelector('[data-c="fait"]');
    ok.classList.toggle('on', estFait(t));
    ok.textContent = estFait(t) ? 'Fait ✓ (annuler)' : (t.assemblage ? 'Assemblage terminé ✓' : 'Fait ✓');
  }
  /* Les grammes de la journée pour l'aliment de l'étape : chaque mot de
     l'aliment cherché dans les ingrédients de la recette, mot à mot, ×fiches. */
  function libG(g) { return g >= 1000 ? (Math.round(g / 10) / 100) + ' kg' : Math.round(g) + ' g'; }
  /* ⚠️ `t.ingrs` FAIT FOI quand il existe : c'est la liste que l'éclatement a
     retenue (une ligne de `recettes_ingredients`, son nom exact, ses grammes
     du jour). Re-chercher les mots de l'aliment ramènerait ici les ingrédients
     voisins — « haricots verts » rappellerait « haricots blancs » — et un
     morceau d'étape afficherait les grammes d'un autre. Le repli mot à mot ne
     sert plus qu'à ce que l'éclatement ne couvre pas (l'assemblage). */
  function quantitesEtape(t) {
    if (t.ingrs) return t.ingrs.map(function (x) { return { nom: x.nom, g: x.g, lib: libG(x.g) }; });
    var ings = S.ings[t.recId] || [], mots = motsAliment(t.aliment);
    var out = [];
    ings.forEach(function (i) {
      var n = norm(i.ingredient_nom).split(' ').map(function (m) { return m.replace(/s$/, ''); });
      if (mots.some(function (m) { return n.indexOf(m) >= 0; }) && parseFloat(i.quantite_g) > 0) {
        var g = parseFloat(i.quantite_g) * t.fiches;
        out.push({ nom: i.ingredient_nom, g: g, lib: libG(g) });
      }
    });
    return out;
  }
  /* ── Les repères GÉNÉRAUX d'un geste ─────────────────────────────────────
     Pablo : « écrire le plus de détail possible sur l'étape : ce qu'il faut
     faire, combien de grammes, de centimètres, pendant combien de temps, la
     température, la texture, le visuel, ce qu'il faut avoir à la fin ».
     La fiche donne ce qu'elle donne — consigne, durée, température, découpe,
     grammes. Le reste vient d'ici : des repères de cuisine par geste, valables
     pour n'importe quelle recette, et ANNONCÉS comme tels (« repères du
     geste »). ⚠️ Rien de spécifique à une recette n'est écrit ici : ce que la
     fiche ne dit pas est affiché comme manquant, à compléter dans l'onglet
     Chef — jamais deviné. */
  var REPERES = {
    couper:      { feu: null, texture: 'Morceaux réguliers : même taille, même cuisson. La découpe demandée fait le calibre.', visuel: 'Tranche nette, sans écrasement ni fibres arrachées.', fin: 'Tout l’aliment taillé au calibre, réservé À PART pour chaque recette, planche nettoyée.', pieges: 'Planche stable, lame affûtée. Ne pas mélanger deux découpes du même aliment.' },
    rincer:      { feu: 'Eau froide courante.', texture: 'Égoutté À FOND : l’eau qui reste fait chuter la température de cuisson.', visuel: 'Eau claire au dernier rinçage, sans terre ni sable.', fin: 'Aliment propre, essoré, prêt à tailler ou à cuire.', pieges: 'Essorer les feuilles ; ne pas laisser tremper.' },
    peser:       { feu: null, texture: null, visuel: 'La balance à zéro avant chaque récipient (tare).', fin: 'Chaque quantité pesée et étiquetée par recette.', pieges: 'Peser le cru, pas le cuit — les grammages de la fiche sont crus.' },
    huiler:      { feu: null, texture: 'Un film fin et régulier : le surplus fume et amertume.', visuel: 'Surface brillante, sans flaque.', fin: 'Aliment enrobé, prêt à saisir ou à enfourner.', pieges: 'Huile d’olive à feu vif : elle fume vite. Huile neutre pour saisir fort.' },
    assaisonner: { feu: null, texture: 'Goûter AVANT et APRÈS. Saler en plusieurs fois.', visuel: 'Sel réparti, pas en amas.', fin: 'Assaisonnement équilibré au goût, noté si corrigé.', pieges: 'Une masse ×3 ne se sale pas ×3 : ajouter par paliers.' },
    melanger:    { feu: null, texture: 'Homogène : plus aucune trace de l’un ou de l’autre.', visuel: 'Couleur uniforme, sans grumeau.', fin: 'Mélange lié, couvert, réservé.', pieges: 'Ne pas travailler trop une farce ou une pâte : elle durcit.' },
    fouetter:    { feu: null, texture: 'Lisse et aérée, selon le but : une émulsion se tient, des blancs forment un bec.', visuel: 'Brillant pour une émulsion, mat et ferme pour des blancs.', fin: 'Texture stable une minute après l’arrêt.', pieges: 'Verser l’huile en filet ; bol et fouet propres et froids pour monter.' },
    mixer:       { feu: null, texture: 'Lisse, sans morceau ; passer au tamis si la fiche le demande.', visuel: 'Couleur homogène, sans bulle si c’est une sauce.', fin: 'Consistance voulue (nappante ou ferme), assaisonnement rectifié.', pieges: 'Mixer chaud : couvercle entrouvert, petites quantités.' },
    saisir:      { feu: 'Feu VIF, poêle ou plaque très chaude, matière grasse à peine fumante.', texture: 'Croûte en surface, cœur encore tendre et juteux.', visuel: 'Coloration dorée à brune, uniforme sur toutes les faces ; sucs au fond.', fin: 'Toutes les faces colorées, réservé à plat (pas en tas : la vapeur ramollit la croûte).', pieges: 'Ne pas surcharger — l’aliment BOUT au lieu de dorer. Ne pas remuer trop tôt : laisser accrocher puis décoller.' },
    bouillir:    { feu: 'Eau salée (10 g/l) à gros bouillons ; à la vapeur, couvercle fermé, feu régulier.', texture: 'Cuit à cœur, tenue conservée — al dente pour pâtes et riz, la pointe du couteau entre sans forcer pour un légume.', visuel: 'Légumes verts : couleur vive, plongés en eau glacée pour la fixer.', fin: 'Égoutté aussitôt, étalé à plat pour arrêter la cuisson.', pieges: 'Saler l’eau, pas après. Ne pas couvrir des pâtes. Une eau qui a cessé de bouillir n’est plus une cuisson.' },
    mijoter:     { feu: 'Feu doux, FRÉMISSEMENT (85–95 °C) — jamais à gros bouillons. Couvercle selon la fiche.', texture: 'Fondant : la viande se détache, la sauce nappe la cuillère.', visuel: 'Petites bulles espacées en surface, sauce brillante, réduite d’un tiers environ.', fin: 'Sauce à la consistance voulue, assaisonnement rectifié en fin.', pieges: 'Remuer de temps en temps pour ne pas attacher ; compléter en liquide chaud, jamais froid.' },
    enfourner:   { feu: 'Four PRÉCHAUFFÉ à la température de la fiche ; chaleur tournante sauf mention.', texture: 'Cuit à cœur (sonde si la fiche donne une température), gratiné ou croustillant dessus.', visuel: 'Coloration régulière ; tourner la plaque à mi-cuisson.', fin: 'Sorti dès la couleur atteinte ; repos si la fiche le dit.', pieges: 'Une plaque trop chargée cuit à la vapeur. Ne pas ouvrir le four les dix premières minutes.' },
    refrigerer:  { feu: '≤ 4 °C au réfrigérateur ; mariner À COUVERT.', texture: 'Une marinade doit enrober, pas noyer.', visuel: 'Film ou couvercle, étiquette avec l’heure.', fin: 'Refroidi À CŒUR avant de conditionner.', pieges: 'Jamais chaud au frigo : refroidir d’abord (bain glacé, cellule).' },
    reposer:     { feu: 'Hors du feu, à couvert lâche.', texture: 'Le repos finit la cuisson et redistribue les jus : la viande se détend.', visuel: 'Les jus ne coulent plus à la découpe.', fin: 'Temps de la fiche écoulé, chronomètre à l’appui.', pieges: 'Ne pas couvrir hermétiquement : ça ramollit une croûte.' },
    attendre:    { feu: null, texture: null, visuel: 'Un chronomètre lancé, visible.', fin: 'L’attente est une étape : elle a une fin, et on y revient.', pieges: 'Pendant ce temps, une autre tâche — le plan en donne une.' },
    dresser:     { feu: null, texture: 'Les éléments à la température de service prévue par la fiche.', visuel: 'Même présentation d’une portion à l’autre : la photo de la fiche fait foi.', fin: 'Portion pesée, fermée, étiquetée (recette, client, date).', pieges: 'Ne pas fermer une boîte chaude : condensation, texture perdue.' }
  };

  function ligneAvantApres(t) {
    var plan = S.plan; if (!plan) return '';
    var avant = (t.preds || []).map(function (id) { var p = plan.parId[id]; return p ? '<span class="' + (estFait(p) ? 'ok' : '') + '">' + (estFait(p) ? '✓ ' : '○ ') + h(p.etiquette || p.titre) + '</span>' : ''; }).filter(Boolean);
    var apres = plan.taches.filter(function (x) { return (x.preds || []).indexOf(t.id) >= 0; }).map(function (x) { return '<span>' + emojiGeste(x.geste) + ' ' + h(x.etiquette || x.titre) + (x.rec !== t.rec ? ' <i>(' + h(x.rec) + ')</i>' : '') + '</span>'; });
    if (!avant.length && !apres.length) return '';
    return '<div class="sec">Avant · après</div><div class="chaine">'
      + (avant.length ? '<div><b>Doit être fini avant</b>' + avant.join('') + '</div>' : '<div><b>Rien à attendre</b><span>peut partir dès l’ouverture</span></div>')
      + (apres.length ? '<div><b>Débloque ensuite</b>' + apres.join('') + '</div>' : '<div><b>Dernière de sa chaîne</b><span>rien n’attend derrière</span></div>') + '</div>';
  }

  function reperesGeste(t) {
    var r = REPERES[t.geste]; if (!r) return '';
    var lignes = [['🔥 Feu / température', r.feu], ['🖐 Texture', r.texture], ['👁 Visuel', r.visuel], ['🏁 À la fin', r.fin], ['⚠️ Pièges', r.pieges]].filter(function (l) { return l[1]; });
    return '<div class="sec">Repères du geste <small>— généraux, la fiche prime</small></div><div class="rep">' + lignes.map(function (l) { return '<div><b>' + l[0] + '</b>' + h(l[1]) + '</div>'; }).join('') + '</div>';
  }

  /* ── Les illustrations d'ingrédients ─────────────────────────────────────
     Pablo : « seulement l'ingrédient en illustration SVG, le geste ou action,
     l'unité et la pastille de couleur pour désigner le plat ; l'illustration
     doit être le plus gros élément, à gauche, comme une notification Apple ».
     Traits blancs sur fond sombre, viewBox 64 × 64, deux ou trois tracés par
     glyphe — assez pour être reconnu d'un coup d'œil à deux mètres de la
     plaque, pas plus. Le choix se fait sur le premier mot de l'aliment qui
     commence par une des clés (« carott » attrape carotte et carottes) ; sans
     correspondance, l'assiette. Ajouter un glyphe = une ligne dans ILLUS. */
  var ILLUS = [
    [['carott'], '<path d="M40 12l12 12-24 30-10 2 2-10z"/><path d="M38 24l10 10M32 32l8 8M26 40l6 6"/><path d="M42 10c4-6 12-6 12 0M48 16c6-4 12 0 10 6"/>'],
    [['oignon', 'echalot'], '<path d="M32 18c-12 0-20 10-20 20s8 16 20 16 20-6 20-16-8-20-20-20z"/><path d="M32 18c-6 8-8 20-6 34M32 18c6 8 8 20 6 34"/><path d="M28 18c0-6 2-10 4-12 2 2 4 6 4 12"/>'],
    [['poulet', 'volaille', 'dinde', 'canard', 'blanc de'], '<path d="M44 14a12 12 0 0 1 8 20L30 52 12 34 34 14a12 12 0 0 1 10 0z"/><path d="M14 50l-4 4M12 42l-6-2M20 56l-2 6"/>'],
    [['boeuf', 'bœuf', 'steak', 'viande', 'veau', 'agneau', 'porc', 'lardon', 'hach'], '<path d="M14 26c0-8 8-12 18-12s20 6 20 14c0 10-10 22-22 22S10 42 10 34c0-4 4-6 4-8z"/><path d="M22 30c4 0 6 4 4 8s-6 6-8 4"/>'],
    [['poisson', 'saumon', 'truite', 'thon', 'merlu', 'cabillaud', 'dorade', 'bar', 'crevette', 'fruits de mer'], '<path d="M10 32c8-12 20-16 32-14 6 2 10 8 10 14s-4 12-10 14c-12 2-24-2-32-14z"/><path d="M52 32l8-8v16zM42 28a2 2 0 1 0 0 1"/><path d="M28 24c2 6 2 10 0 16"/>'],
    [['riz', 'quinoa', 'boulgour', 'semoule', 'couscous', 'cereal', 'orge', 'epeautre'], '<path d="M8 30h48c0 14-10 24-24 24S8 44 8 30z"/><path d="M14 30c4-8 12-10 18-10s14 2 18 10"/><path d="M22 22l2-4M32 20v-4M42 22l-2-4"/>'],
    [['pate', 'pâte', 'spaghetti', 'nouille', 'tagliatelle', 'penne', 'lasagne'], '<path d="M8 32h48c0 12-10 22-24 22S8 44 8 32z"/><path d="M12 32c6-6 8-14 4-22M24 32c6-6 8-14 4-22M36 32c6-6 8-14 4-22M48 32c4-6 6-14 2-22"/>'],
    [['pomme de terre', 'patate', 'pdt'], '<path d="M16 22c6-8 26-10 32-2 6 8 2 26-8 30S10 48 10 36c0-6 2-10 6-14z"/><path d="M24 30h1M36 26h1M30 40h1M40 38h1"/>'],
    [['tomate'], '<circle cx="32" cy="36" r="18"/><path d="M32 18c-4-4-10-4-12-2 4 0 8 2 12 2 4 0 8-2 12-2-2-2-8-2-12 2zM32 18v-6"/>'],
    [['ail'], '<path d="M32 12c-4 8-16 12-16 26 0 10 8 16 16 16s16-6 16-16c0-14-12-18-16-26z"/><path d="M32 22c-4 8-6 16-4 32M32 22c4 8 6 16 4 32M32 12v-6"/>'],
    [['citron', 'orange', 'lime', 'agrume'], '<circle cx="32" cy="32" r="20"/><path d="M32 12v40M12 32h40M18 18l28 28M46 18L18 46"/>'],
    [['oeuf', 'œuf'], '<path d="M32 8c-12 0-20 18-20 32a20 16 0 0 0 40 0C52 26 44 8 32 8z"/>'],
    [['fromage', 'feta', 'parmesan', 'mozzarella', 'gruyere', 'chevre', 'cheddar', 'ricotta'], '<path d="M8 40L48 16l8 8v20H8z"/><path d="M8 40l40-24M56 24L16 48"/><circle cx="28" cy="38" r="2"/><circle cx="40" cy="30" r="2"/>'],
    [['yaourt', 'creme', 'crème', 'sauce', 'lait', 'coco', 'mayonnaise', 'vinaigrette', 'bouillon', 'fond'], '<path d="M18 16h28l-4 40H22z"/><path d="M14 16h36"/><path d="M22 28c6-4 14-4 20 0"/>'],
    [['huile', 'beurre', 'graisse'], '<path d="M26 8h12v10c6 4 8 10 8 16v22H18V34c0-6 2-12 8-16z"/><path d="M26 14h12"/><path d="M26 40c4 2 8 2 12 0"/>'],
    [['sel', 'poivre', 'epice', 'épice', 'curry', 'paprika', 'cumin', 'curcuma', 'piment', 'assaisonn'], '<path d="M22 22h20l4 34H18z"/><path d="M24 22a8 8 0 0 1 16 0"/><path d="M28 14h1M32 12h1M36 14h1"/>'],
    [['persil', 'basilic', 'coriandre', 'menthe', 'thym', 'herbe', 'salade', 'epinard', 'épinard', 'chou', 'roquette', 'laitue', 'aromate', 'ciboulette', 'kale', 'mache'], '<path d="M32 56c0-20 8-34 24-42-2 18-10 30-24 34"/><path d="M32 56c0-16-6-30-22-36 2 16 8 26 22 30"/><path d="M32 56V40"/>'],
    [['pain', 'galette', 'wrap', 'tortilla', 'pita', 'naan', 'tacos', 'burger'], '<path d="M10 34a22 12 0 1 0 44 0 22 12 0 1 0-44 0z"/><path d="M22 30c4-8 16-8 20 0"/><path d="M12 30c4 6 10 8 20 8s16-2 20-8"/>'],
    [['champignon'], '<path d="M10 30c0-12 10-20 22-20s22 8 22 20H10z"/><path d="M24 30v16a8 4 0 0 0 16 0V30"/><path d="M22 20h1M32 16h1M42 22h1"/>'],
    [['lentille', 'pois chiche', 'haricot rouge', 'haricot blanc', 'legumineuse', 'légumineuse', 'feve', 'fève', 'soja', 'edamame'], '<ellipse cx="22" cy="28" rx="9" ry="7"/><ellipse cx="42" cy="26" rx="9" ry="7"/><ellipse cx="32" cy="42" rx="9" ry="7"/>'],
    [['courgette', 'concombre', 'aubergine', 'poivron', 'haricot', 'brocoli', 'legume', 'légume', 'poireau', 'celeri', 'céleri', 'navet', 'betterave', 'fenouil', 'asperge', 'petit pois', 'mais', 'maïs', 'patate douce', 'potiron', 'courge', 'radis'], '<path d="M20 20c-8 6-10 18-4 28s16 12 24 6 10-18 4-28-16-12-24-6z"/><path d="M26 16c2-6 8-8 12-6-2 2-2 6 0 8"/><path d="M24 30c4 6 6 12 6 20"/>'],
    [['fruit', 'pomme', 'banane', 'poire', 'fraise', 'framboise', 'myrtille', 'mangue', 'ananas', 'raisin', 'kiwi', 'peche', 'pêche', 'abricot', 'cerise'], '<path d="M32 22c-6-6-18-4-20 8s6 24 20 26c14-2 22-14 20-26S38 16 32 22z"/><path d="M32 22v-8M32 14c4-4 8-4 10-2-2 4-6 6-10 2"/>'],
    [['four', 'plaque', 'poele', 'poêle', 'casserole', 'marmite', 'cocotte', 'wok'], '<rect x="8" y="14" width="48" height="40" rx="4"/><path d="M8 26h48"/><rect x="16" y="32" width="32" height="14" rx="2"/><path d="M14 20h1M20 20h1M26 20h1"/>'],
    [['eau', 'glacon', 'glaçon'], '<path d="M32 8c-10 14-16 22-16 32a16 16 0 0 0 32 0c0-10-6-18-16-32z"/><path d="M24 40c0 6 4 10 8 10"/>']
  ];
  var ILLU_DEFAUT = '<circle cx="32" cy="34" r="22"/><circle cx="32" cy="34" r="12"/><path d="M10 34h2M52 34h2"/>';
  function illustration(aliment) {
    // au singulier, mot à mot : « pommes de terre » doit trouver « pomme de
    // terre » avant que « pommes » ne trouve le fruit
    var sing = function (m) { return m.length > 3 ? m.replace(/s$/, '') : m; };
    var mots = norm(aliment || '').split(' ').map(sing), texte = ' ' + mots.join(' ') + ' ';
    var svg = ILLU_DEFAUT;
    // d'abord une clé à plusieurs mots contenue telle quelle, puis un mot qui
    // commence par une clé
    ILLUS.some(function (e) {
      if (e[0].some(function (k) { return k.indexOf(' ') >= 0 && texte.indexOf(' ' + norm(k).split(' ').map(sing).join(' ')) >= 0; })) { svg = e[1]; return true; }
      return false;
    }) || ILLUS.some(function (e) {
      if (mots.some(function (m) { return e[0].some(function (k) { return k.indexOf(' ') < 0 && m.indexOf(sing(norm(k))) === 0; }); })) { svg = e[1]; return true; }
      return false;
    });
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' + svg + '</svg>';
  }

  /* La grosse quantité de l'écran : le premier ingrédient de l'étape (les
     grammes du jour), les autres en petit. Sans ingrédient reconnu : la durée. */
  function quantitePrincipale(t) {
    var q = quantitesEtape(t);
    if (!q.length) return { grand: t.duree + ' min', petit: t.aliment ? 'quantité non reliée à la fiche' : '' };
    return { grand: q[0].lib, petit: (q.length > 1 ? q.slice(1).map(function (x) { return x.lib + ' ' + x.nom; }).join(' · ') : q[0].nom) };
  }

  /* Ce que cette étape DÉBLOQUE, et à quel moment : ses suites dans le plan,
     avec leur recette, leur poste, qui les tient, et l'heure où elles
     partent — c'est là qu'on voit avec quelle étape d'une autre recette on
     interagit. Sous la carte, en une ligne. */
  function suitesScene(t) {
    var plan = S.plan; if (!plan || t.assemblage) return '';
    var suites = plan.taches.filter(function (x) { return (x.preds || []).indexOf(t.id) >= 0; }).sort(function (a, b) { return a.debut - b.debut; });
    var autres = t.cumul ? t.cumulAvec.map(function (id) { return plan.parId[id]; }).filter(Boolean) : [];
    if (!suites.length && !autres.length) return '';
    return '<div class="suites">' + (autres.length ? '<div class="l"><b>' + (t.ensemble === 'atelier' ? 'Ensemble avec' : 'En même temps que') + '</b>' + autres.map(function (a) { var dc = a.geste === 'couper' ? decoupeDe(a) : null, q = quantitesEtape(a); return '<span' + (a.rec !== t.rec ? ' class="autre"' : '') + '><i style="background:' + a.couleur + '"></i>' + emojiGeste(a.geste) + ' ' + h(a.etiquette || a.titre) + ' <small>' + h(a.rec + (q.length ? ' · ' + q[0].lib : '') + (dc ? ' · ' + dc : '') + ' · ' + hm(a.debut)) + '</small></span>'; }).join('') + '</div>' : '')
      + (suites.length ? '<div class="l"><b>Débloque à ' + hm(t.fin) + '</b>' + suites.map(function (x) { var P = infoPoste(x.poste); return '<span' + (x.rec !== t.rec ? ' class="autre"' : '') + '><i style="background:' + x.couleur + '"></i>' + emojiGeste(x.geste) + ' ' + h(x.etiquette || x.titre) + ' <small>' + h(x.rec) + ' · ' + P.em + (x.cuisinier >= 0 ? ' ' + h(x.qui) : '') + ' · ' + hm(x.debut) + '</small></span>'; }).join('') + '</div>' : '') + '</div>';
  }

  /* Les étapes qui BLOQUENT celle-ci : ses dépendances pas encore faites, en
     gris, avec leur poste — c'est souvent un autre poste, et c'est là que le
     cuisinier voit qui il attend. */
  function bloquantes(t) {
    var plan = S.plan; if (!plan) return [];
    return (t.preds || []).map(function (id) { return plan.parId[id]; }).filter(function (p) { return p && !estFait(p); });
  }
  function carteBloquante(p) {
    var P = infoPoste(p.poste);
    return '<div class="bloq"><div class="illu">' + illustration(p.atelier ? p.aliment : (p.aliment || p.titre)) + '</div><div class="txt">'
      + '<div class="rec"><i style="background:' + p.couleur + '"></i>' + h(p.rec) + '</div>'
      + '<div class="act">' + emojiGeste(p.geste) + ' ' + h(p.etiquette || p.titre) + '</div>'
      + '<div class="pst">' + P.em + ' ' + h(P.nom) + (p.qui && p.cuisinier >= 0 ? ' · ' + h(p.qui) : '') + ' · ' + hm(p.debut) + '</div></div></div>';
  }

  /* ── L'écran d'une étape ─────────────────────────────────────────────────
     En haut, la SCÈNE : une carte façon notification — l'illustration de
     l'ingrédient à gauche, la plus grosse chose de l'écran ; à droite la
     pastille du plat, l'action, la quantité du jour avec son unité. Rien
     d'autre. Si l'étape attend des étapes pas faites, elles sont là, en gris,
     sur les côtés (au-dessus sur un téléphone) : on voit qui on attend, et à
     quel poste. Tout le reste — consigne, chiffres, repères, avant/après — est
     derrière « Détails », un écran plus bas. */
  function htmlEcran(t) {
    var P = infoPoste(t.poste), fait = S.faits[t.id];
    var bl = t.assemblage ? [] : bloquantes(t);
    var gauche = bl.filter(function (_, i) { return i % 2 === 0; }), droite = bl.filter(function (_, i) { return i % 2 === 1; });
    var q;
    if (t.assemblage) q = { grand: t.lot.portions + ' portion' + (t.lot.portions > 1 ? 's' : ''), petit: 'une par une, sur la balance' };
    else q = quantitePrincipale(t);
    var recs = '<i style="background:' + t.couleur + '"></i>' + h(t.rec);
    var html = (fait ? '<div class="fait">FAIT' + (typeof fait === 'string' ? ' · ' + h(fait) : '') + '</div>' : '')
      + '<div class="kick">' + (t.assemblage ? 'En fin de production' : hm(t.debut) + ' → ' + hm(t.fin)) + ' · ' + P.em + ' ' + h(P.nom) + (t.qui && !t.assemblage && t.cuisinier >= 0 ? ' · ' + h(t.qui) : '') + '</div>'
      + '<div class="scene' + (bl.length ? ' bloquee' : '') + '"><div class="cote g">' + gauche.map(carteBloquante).join('') + '</div>'
      + '<div class="carte"><div class="illu">' + illustration(t.assemblage ? 'assiette' : (t.aliment || t.titre)) + '</div><div class="txt">'
      + '<div class="rec">' + recs + '</div>'
      + '<div class="act">' + emojiGeste(t.geste) + ' ' + h(t.titre) + (t.sousTotal > 1 ? ' · <b>' + h(t.aliment) + '</b> <small>' + (t.sousIndex + 1) + '/' + t.sousTotal + '</small>' : '') + '</div>'
      + '<div class="qte"><b>' + h(q.grand) + '</b><small>' + h(q.petit) + '</small></div>'
      + '<div class="mat">🧰 ' + h(materielDe(t).join(' · ')) + '</div>'
      + (bl.length ? '<div class="att">⏳ attend ' + bl.length + ' étape' + (bl.length > 1 ? 's' : '') + (bl.some(function (p) { return p.poste !== t.poste; }) ? ' d’un autre poste' : '') + '</div>' : '')
      + '</div></div><div class="cote d">' + droite.map(carteBloquante).join('') + '</div></div>'
      + suitesScene(t)
      + '<button class="detbtn" data-c="details">' + (C.details ? 'Masquer les détails ▴' : 'Détails ▾') + '</button>'
      + '<div class="detail"' + (C.details ? '' : ' style="display:none"') + '>' + htmlDetail(t) + '</div>';
    return html;
  }

  /* Le détail, sous la scène : ce que la fiche dit, ce qu'elle ne dit pas,
     les repères du geste, avant / après. */
  function htmlDetail(t) {
    var P = infoPoste(t.poste), fait = S.faits[t.id];
    var html = '';
    if (t.assemblage) {
      var l = t.lot, idx = 0;
      html += '<div class="ali">' + l.portions + ' portion(s), une par une, sur la balance</div>';
      if (t.etapes.length) html += '<div class="desc">' + t.etapes.map(function (e) { return '<b>' + h(e.titre || 'Étape') + '</b> ' + h(e.description || ''); }).join('<br>') + '</div>';
      l.parClient.forEach(function (pc) {
        for (var k = 0; k < pc.n; k++) {
          idx++;
          html += '<div class="port"><b>' + idx + '/' + l.portions + ' · ' + h(nomClient(pc.bon.user_id)) + '</b> <span style="color:#ffffff8c;font-size:12px">' + (pc.p.kcal ? Math.round(pc.p.kcal) + ' kcal · ' : '') + Math.round(pc.p.gPortion) + ' g</span><div class="g">'
            + pc.p.ings.filter(function (g) { return g.g > 0; }).map(function (g) { return '<span><b>' + (g.g >= 10 ? Math.round(g.g) : Math.round(g.g * 10) / 10) + ' ' + h(g.unite) + '</b> ' + h(g.nom) + '</span>'; }).join('') + '</div></div>';
        }
      });
      html += '<div class="sec">Matériel</div><div class="matl">' + materielDe({ geste: 'dresser' }).map(function (m) { return '<span>' + h(m) + '</span>'; }).join('') + '</div>';
      return html + reperesGeste({ geste: 'dresser' });
    }
    var q = quantitesEtape(t);
    html += '<div class="ali">' + h(t.aliment || '') + '</div>';
    // 1. ce qu'il faut faire — la consigne de la fiche, ou son absence, dite
    html += '<div class="sec">À faire</div><div class="desc">' + (t.desc ? h(t.desc) : '<i>Aucune consigne écrite dans la fiche — à compléter dans l’onglet Chef.</i>') + '</div>';
    // 2. combien — les grammes du jour, par ingrédient de l'étape
    if (q.length) html += '<div class="sec">Quantités du jour <small>— fiche × ' + t.fiches.toFixed(1) + '</small></div><div class="qte">' + q.map(function (x) { return '<div><b>' + h(x.lib) + '</b>' + h(x.nom) + '</div>'; }).join('') + '</div>';
    else if (t.aliment) html += '<div class="sec">Quantités du jour</div><div class="desc"><i>Aucun ingrédient de la fiche ne porte le mot « ' + h(t.aliment) + ' » — vérifier l’aliment de l’étape dans l’onglet Chef.</i></div>';
    // 3. les chiffres de la fiche : durée, température, découpe, attente —
    //    chacun dit s'il vient de la fiche ou s'il manque
    var dc = t.geste === 'couper' ? decoupeDe(t) : null;
    var chiffres = [
      ['⏱ Durée', t.defaut ? DUREE_DEFAUT + ' min <i>par défaut, la fiche ne le dit pas</i>' : t.duree + ' min' + (t.fiches && !t.passif && Math.round(t.duree) !== Math.round(t.duree / Math.sqrt(Math.max(1, t.fiches))) ? ' <i>(' + Math.round(t.duree / Math.sqrt(Math.max(1, t.fiches))) + ' min pour une fiche, ×√' + t.fiches.toFixed(1) + ')</i>' : '')],
      ['🌡 Température', t.temperature ? t.temperature + ' °C' : (['enfourner', 'mijoter', 'saisir', 'bouillir', 'refrigerer'].indexOf(t.geste) >= 0 ? '<i>non renseignée dans la fiche</i>' : null)],
      ['🔪 Découpe', t.geste === 'couper' ? (dc ? h(dc) : '<span style="color:#ff7b6b">à spécifier</span>') : null],
      ['⏳ Attente', t.passif ? 'oui — le cuisinier est libre pendant ce temps' : null],
      ['⇆ En même temps', t.cumul ? h(t.cumulAvec.map(function (id) { return (S.plan.parId[id] || {}).titre; }).filter(Boolean).join(', ')) + (t.cumulRegle === 'max' ? ' <i>(deux feux côte à côte)</i>' : ' <i>(à la suite, même poste)</i>') : null]
    ].filter(function (c) { return c[1]; });
    html += '<div class="sec">Les chiffres</div><div class="rep">' + chiffres.map(function (c) { return '<div><b>' + c[0] + '</b>' + c[1] + '</div>'; }).join('') + '</div>';
    // 4. le matériel, les repères du geste, puis avant / après
    html += '<div class="sec">Matériel <small>— déduit du geste, la fiche prime</small></div><div class="matl">'
      + materielDe(t).map(function (m) { return '<span>' + h(m) + '</span>'; }).join('') + '</div>';
    html += reperesGeste(t) + ligneAvantApres(t);
    html += '<div class="meta"><span>' + h(t.rec) + ' · étape ' + t.numero + '</span><span>' + P.em + ' ' + h(P.nom) + '</span>' + (typeof fait === 'string' ? '<span>fait par ' + h(fait) + '</span>' : '') + '</div>';
    return html;
  }
  function sommaire() {
    var st = C.el.querySelector('.stage'), old = st.querySelector('.som'); if (old) { old.remove(); return; }
    var d = document.createElement('div'); d.className = 'som';
    d.innerHTML = '<div class="kick" style="margin-bottom:10px">Toutes mes étapes</div>' + C.taches.map(function (t, i) {
      return '<div class="l ' + (i === C.i ? 'cur' : '') + (estFait(t) ? ' ok' : '') + '" data-som="' + i + '"><span style="color:#ffffff8c;min-width:44px">' + (t.assemblage ? 'fin' : hm(t.debut)) + '</span><i style="width:8px;height:8px;border-radius:50%;background:' + t.couleur + '"></i><span style="flex:1">' + emojiGeste(t.geste) + ' ' + h(t.etiquette || t.titre) + ' <span style="color:#ffffff8c">· ' + h(t.rec) + '</span></span>' + (estFait(t) ? '✓' : '') + '</div>';
    }).join('');
    st.appendChild(d);
  }
  function clicCine(ev) {
    var s = ev.target.closest('[data-som]'); if (s) { aller(parseInt(s.dataset.som, 10)); return; }
    var b = ev.target.closest('[data-c]'); if (!b) return;
    var c = b.dataset.c;
    if (c === 'fermer') fermerService();
    else if (c === 'prec') aller(C.i - 1);
    else if (c === 'suiv') aller(C.i + 1);
    else if (c === 'som') sommaire();
    else if (c === 'details') { C.details = !C.details; var pd = C.el.querySelector('.plan:not(.out)'); if (pd) pd.innerHTML = htmlEcran(C.taches[C.i]); }
    else if (c === 'fait') {
      var t = C.taches[C.i], fait = !estFait(t);
      basculerFait(t); // un atelier coche toutes ses parts ; l'assemblage reste local
      var pl = C.el.querySelector('.plan:not(.out)'); if (pl) pl.innerHTML = htmlEcran(t);
      majBarre();
      if (fait && C.i < C.taches.length - 1) setTimeout(function () { aller(C.i + 1); }, 420);
    }
  }

  window.NattyProd = {
    monter: function (host) {
      sbq('plats_menu?select=id,nom').then(function (p) { PLATS_MENU = p; }).catch(function () {});
      monter(host);
    },
    rafraichir: function () { if (S.charge) chargerTout().then(rendre); },
    // exposés pour le banc
    _dispatcher: dispatcher, _portionPour: portionPour, _etat: S,
    _dependances: dependances, _decoupeDe: decoupeDe, _grapheDuJour: grapheDuJour, _illustration: illustration
  };
})();
