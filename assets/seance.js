/* ═══════════════════════════════════════════════════════════
   Natty — Les séances : le journal d'entraînement, et ce qu'il change au bilan
   ───────────────────────────────────────────────────────────
     NattySeance.charger()               relit les séances (Promise)
     NattySeance.ouvrir({jour, apres})   le plein écran : calendrier puis saisie
     NattySeance.ajouterPour(jour, cb)   la saisie directement, sur un jour
     NattySeance.duJour(jour)            la séance d'un jour, ou null
     NattySeance.series(s) / reps(s)     ce qui a été fait, en nombres
     NattySeance.kcal(s, poids)          l'énergie dépensée, estimée
     NattySeance.stimulus(auj, hier)     ce qui module la construction musculaire
     NattySeance.utilise()               cette personne journalise-t-elle ?
     NattySeance.monterPanneau(hote)     la carte « Mes séances » d'un écran
     NattySeance.resume(s)               une ligne de texte

   CE QUE C'EST, ET POURQUOI. Demande de Pablo (2026-09-02) : « pouvoir ajouter
   sa séance avant le bilan pour voir exactement combien de grammes de muscle on
   a gagné et combien de graisse brûlée au gramme près ». Jusqu'ici le bilan du
   soir estimait les deux à partir de l'ACTIVITÉ DÉCLARÉE une fois pour toutes à
   l'onboarding (`onboarding.activite`) : la même valeur un jour de repos et un
   jour de squat. Deux chiffres qui ne pouvaient donc pas bouger avec ce que la
   personne avait réellement fait.

   ⚠️ IL N'INVENTE AUCUN CHIFFRE — même règle que `assets/bilan.js`, et c'est
   ici qu'elle est la plus facile à trahir. Ce module MESURE des séries et des
   répétitions (ça, la personne l'a saisi) et il ESTIME une dépense (ça, non).
   L'estimation est annoncée comme telle, avec son modèle en une ligne, à
   l'écran. On ne demande PAS la charge en kilos : Pablo a décrit le parcours
   « machines → séries → reps », et un champ de charge de plus ferait abandonner
   la saisie avant la fin. La conséquence est assumée et écrite : la dépense se
   déduit du VOLUME (séries × durée), pas du tonnage.

   POURQUOI UN MODULE ET PAS UNE PAGE. Même raison qu'`ajout.js`, `planning.js`
   et `bilan.js` : il s'invite PAR-DESSUS l'écran courant. Il doit surtout
   pouvoir s'ouvrir depuis le bilan, qui est lui-même un plein écran — une
   navigation aurait détruit la séquence en cours.

   Dépend d'`assets/core.js`. Rien d'autre.
   ═══════════════════════════════════════════════════════════ */
window.NattySeance = (function () {
  'use strict';

  /* ═══ 1. Le catalogue ════════════════════════════════════
     Les groupes d'abord : Pablo a nommé « dos, pecs, bras », ils passent donc
     devant. « Détailler » n'est pas un groupe, c'est le choix de plusieurs —
     d'où son traitement à part dans la scène du groupe. */

  var GROUPES = [
    { cle: 'dos',     nom: 'Dos',       ic: 'poulie' },
    { cle: 'pecs',    nom: 'Pectoraux', ic: 'banc' },
    { cle: 'bras',    nom: 'Bras',      ic: 'haltere' },
    { cle: 'jambes',  nom: 'Jambes',    ic: 'presse' },
    { cle: 'epaules', nom: 'Épaules',   ic: 'epaule' },
    { cle: 'abdos',   nom: 'Abdos',     ic: 'abdos' },
    { cle: 'cardio',  nom: 'Cardio',    ic: 'velo' }
  ];

  /* Les « modules de machines » (le mot de Pablo). `met` est l'équivalent
     métabolique de l'exercice — c'est ce qui transforme du volume en énergie
     (voir `kcal()`). Les valeurs suivent le compendium d'activités physiques :
     ~5 pour de la musculation guidée, ~6 pour les mouvements polyarticulaires
     lourds, 3,5 pour du gainage statique, 7 à 8,5 pour du cardio.
     ⚠️ `rep` est la répétition PAR DÉFAUT proposée à la saisie, pas une
     consigne : 10 sur un curl, 12 sur du guidé léger, 30 secondes sur du
     gainage (où « reps » se lit en secondes, d'où `unite`). */
  var EXOS = [
    // ── Dos ──
    { cle: 'tirage-vertical',  nom: 'Tirage vertical',    g: 'dos', ic: 'poulie',   met: 5,   rep: 10 },
    { cle: 'rowing-machine',   nom: 'Rowing machine',     g: 'dos', ic: 'machine',  met: 5,   rep: 10 },
    { cle: 'tirage-horizontal',nom: 'Tirage horizontal',  g: 'dos', ic: 'poulie',   met: 5,   rep: 12 },
    { cle: 'traction',         nom: 'Tractions',          g: 'dos', ic: 'traction', met: 6,   rep: 8 },
    { cle: 'souleve-de-terre', nom: 'Soulevé de terre',   g: 'dos', ic: 'barre',    met: 6,   rep: 6 },
    { cle: 'pull-over',        nom: 'Pull-over',          g: 'dos', ic: 'haltere',  met: 5,   rep: 12 },
    // ── Pectoraux ──
    { cle: 'developpe-couche', nom: 'Développé couché',   g: 'pecs', ic: 'banc',    met: 6,   rep: 8 },
    { cle: 'developpe-incline',nom: 'Développé incliné',  g: 'pecs', ic: 'banc',    met: 6,   rep: 10 },
    { cle: 'presse-pectorale', nom: 'Presse pectorale',   g: 'pecs', ic: 'machine', met: 5,   rep: 12 },
    { cle: 'ecarte-poulie',    nom: 'Écartés à la poulie',g: 'pecs', ic: 'poulie',  met: 5,   rep: 12 },
    { cle: 'pompes',           nom: 'Pompes',             g: 'pecs', ic: 'corps',   met: 5.5, rep: 15 },
    { cle: 'dips',             nom: 'Dips',               g: 'pecs', ic: 'dips',    met: 6,   rep: 10 },
    // ── Bras ──
    { cle: 'curl-barre',       nom: 'Curl à la barre',    g: 'bras', ic: 'barre',   met: 5,   rep: 10 },
    { cle: 'curl-haltere',     nom: 'Curl haltères',      g: 'bras', ic: 'haltere', met: 5,   rep: 12 },
    { cle: 'curl-pupitre',     nom: 'Curl au pupitre',    g: 'bras', ic: 'machine', met: 5,   rep: 12 },
    { cle: 'extension-poulie', nom: 'Extension poulie',   g: 'bras', ic: 'poulie',  met: 5,   rep: 12 },
    { cle: 'barre-au-front',   nom: 'Barre au front',     g: 'bras', ic: 'barre',   met: 5,   rep: 10 },
    { cle: 'dips-triceps',     nom: 'Dips triceps',       g: 'bras', ic: 'dips',    met: 5.5, rep: 12 },
    // ── Jambes ──
    { cle: 'presse-cuisses',   nom: 'Presse à cuisses',   g: 'jambes', ic: 'presse',met: 5.5, rep: 12 },
    { cle: 'squat',            nom: 'Squat',              g: 'jambes', ic: 'barre', met: 6,   rep: 8 },
    { cle: 'leg-extension',    nom: 'Leg extension',      g: 'jambes', ic: 'machine',met: 5,  rep: 12 },
    { cle: 'leg-curl',         nom: 'Leg curl',           g: 'jambes', ic: 'machine',met: 5,  rep: 12 },
    { cle: 'fentes',           nom: 'Fentes',             g: 'jambes', ic: 'corps', met: 5.5, rep: 12 },
    { cle: 'mollets',          nom: 'Mollets',            g: 'jambes', ic: 'machine',met: 4.5,rep: 15 },
    // ── Épaules ──
    { cle: 'developpe-militaire', nom: 'Développé militaire', g: 'epaules', ic: 'barre',  met: 6, rep: 8 },
    { cle: 'elevations-laterales',nom: 'Élévations latérales',g: 'epaules', ic: 'haltere',met: 5, rep: 15 },
    { cle: 'oiseau',           nom: 'Oiseau',             g: 'epaules', ic: 'haltere',met: 5,  rep: 15 },
    { cle: 'presse-epaules',   nom: 'Presse épaules',     g: 'epaules', ic: 'machine',met: 5,  rep: 12 },
    // ── Abdos ──
    { cle: 'crunch',           nom: 'Crunch',             g: 'abdos', ic: 'abdos',  met: 4,   rep: 20 },
    { cle: 'gainage',          nom: 'Gainage',            g: 'abdos', ic: 'abdos',  met: 3.5, rep: 30, unite: 's' },
    { cle: 'releve-jambes',    nom: 'Relevé de jambes',   g: 'abdos', ic: 'abdos',  met: 4,   rep: 15 },
    { cle: 'roue-abdo',        nom: 'Roue abdominale',    g: 'abdos', ic: 'roue',   met: 4.5, rep: 12 },
    // ── Cardio ──
    { cle: 'tapis',            nom: 'Tapis de course',    g: 'cardio', ic: 'tapis', met: 8.5, rep: 10, unite: 'min' },
    { cle: 'velo',             nom: 'Vélo',               g: 'cardio', ic: 'velo',  met: 7,   rep: 15, unite: 'min' },
    { cle: 'rameur',           nom: 'Rameur',             g: 'cardio', ic: 'rameur',met: 7.5, rep: 10, unite: 'min' },
    { cle: 'elliptique',       nom: 'Elliptique',         g: 'cardio', ic: 'velo',  met: 6.5, rep: 15, unite: 'min' },
    { cle: 'corde',            nom: 'Corde à sauter',     g: 'cardio', ic: 'corde', met: 8,   rep: 5,  unite: 'min' }
  ];

  function exoParCle(c) {
    for (var i = 0; i < EXOS.length; i++) if (EXOS[i].cle === c) return EXOS[i];
    return null;
  }
  function groupeParCle(c) {
    for (var i = 0; i < GROUPES.length; i++) if (GROUPES[i].cle === c) return GROUPES[i];
    return null;
  }

  /* Les icônes de machines. Du TRAIT sur `currentColor`, jamais d'aplat : le
     même dessin doit tenir dans la séquence noire et dans le panneau clair
     sans pendant à maintenir (règle 33 de CLAUDE.md). Boîte de 32. */
  var IC = {
    poulie:   '<path d="M6 4h20"/><path d="M16 4v9"/><circle cx="16" cy="15.5" r="2.5"/>'
            + '<path d="M9 21h14"/><path d="M11 21v6M21 21v6"/><path d="M16 18v3"/>',
    machine:  '<rect x="5" y="6" width="9" height="20" rx="1.6"/><path d="M5 11h9M5 16h9M5 21h9"/>'
            + '<path d="M18 9h9"/><path d="M22.5 9v10"/><path d="M18 23h9"/>',
    banc:     '<path d="M5 15h22" /><path d="M8 15v9M24 15v9"/><path d="M7 9h18"/>'
            + '<path d="M9 6.5v5M23 6.5v5"/>',
    haltere:  '<path d="M11 16h10"/><path d="M8 11v10M6 13v6M24 11v10M26 13v6"/>',
    barre:    '<path d="M4 16h24"/><path d="M8 11v10M11 13v6M21 13v6M24 11v10"/>',
    presse:   '<path d="M4 25h11"/><path d="M8 25v-6h7"/><path d="M15 19 27 7"/>'
            + '<path d="M22 5h6v6"/>',
    traction: '<path d="M5 6h22"/><path d="M12 6v5M20 6v5"/><circle cx="16" cy="15" r="3"/>'
            + '<path d="M16 18v6"/><path d="M13 27l3-3 3 3"/>',
    epaule:   '<circle cx="16" cy="8" r="3"/><path d="M9 26v-6a7 7 0 0 1 14 0v6"/>'
            + '<path d="M5 17h4M23 17h4"/>',
    abdos:    '<path d="M5 24c6-10 16-10 22 0"/><path d="M11 19h10"/><path d="M13 14h6"/>',
    roue:     '<circle cx="12" cy="21" r="6"/><path d="M17 17l7-8"/><path d="M21 8h5v5"/>',
    velo:     '<circle cx="9" cy="22" r="5"/><circle cx="24" cy="22" r="5"/>'
            + '<path d="M9 22l6-11h6"/><path d="M15 11l4 11"/>',
    tapis:    '<path d="M4 25h18"/><circle cx="6" cy="25" r="2"/><circle cx="20" cy="25" r="2"/>'
            + '<path d="M22 25 26 8"/><path d="M22 10h6"/>',
    rameur:   '<path d="M4 24h22"/><path d="M9 24v-4h6"/><path d="M15 20l8-8"/>'
            + '<path d="M20 9h6v6"/><path d="M6 20h5"/>',
    corde:    '<path d="M8 8c-6 6-6 14 0 18"/><path d="M24 8c6 6 6 14 0 18"/>'
            + '<path d="M8 8h4M24 8h-4"/><circle cx="16" cy="17" r="3"/>',
    dips:     '<path d="M6 10v16M26 10v16"/><path d="M6 10h6M26 10h-6"/>'
            + '<circle cx="16" cy="13" r="3"/><path d="M16 16v7"/><path d="M13 26l3-3 3 3"/>',
    corps:    '<circle cx="16" cy="7" r="3"/><path d="M16 10v9"/><path d="M9 13h14"/>'
            + '<path d="M16 19l-5 8M16 19l5 8"/>',
    plus:     '<path d="M16 8v16M8 16h16"/>',
    crayon:   '<path d="M6 26l3-8 13-13 5 5-13 13z"/><path d="M19 8l5 5"/>',
    coche:    '<path d="M7 17l6 6 12-14"/>'
  };
  function ic(nom, cls) {
    return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 32 32" fill="none" aria-hidden="true">'
      + (IC[nom] || IC.plus) + '</svg>';
  }

  /* ═══ 2. Petits utilitaires ══════════════════════════════ */

  var JOURS_L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /* Combien de temps « coûte » une série : l'effort plus la récupération.
     ~2,2 min est la valeur qui colle à une séance ordinaire (8 à 12 séries à
     l'heure). C'est le seul endroit où ce nombre est écrit. */
  var MIN_PAR_SERIE = 2.2;

  /* Le volume qui « remplit » une journée de stimulus, sur les 48 h glissantes.
     La littérature situe le gain quasi maximal autour de 10 à 20 séries par
     muscle et par semaine ; réparti sur quatre séances hebdomadaires d'une
     quinzaine de séries, ça donne ~10 séries par jour en moyenne glissante.
     Au-delà, le facteur sature — plus de séries ne construit pas plus.
     ⚠️ C'ÉTAIT 6, ET C'ÉTAIT TROP BAS : mesuré au banc, une séance ordinaire de
     7 séries saturait déjà le facteur à 100 %. Une séance légère et une séance
     lourde donnaient donc le même stimulus, ce qui vide la mesure de son sens. */
  var SERIES_PLEIN = 10;

  var XP_SEANCE = 40;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function r0(n) { return Math.round(n || 0); }
  function borne(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /* ⚠️ `Natty.jour()`, JAMAIS `toISOString()`. Ce dernier convertit en UTC :
     entre 00 h et 02 h à Paris il rend la VEILLE, et une séance notée en
     rentrant de la salle à 23 h 30 puis relue à 00 h 30 changerait de jour.
     C'est le piège documenté en §3 de CLAUDE.md, corrigé dans neuf endroits. */
  function jourDe(d) { return (window.Natty && Natty.jour) ? Natty.jour(d) : ''; }
  function aujourdhui() { return jourDe(); }
  function dateDe(j) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  }
  function dateFr(j) {
    var d = dateDe(j);
    return d.getDate() + ' ' + MOIS[d.getMonth()];
  }
  function veille(j) {
    var d = dateDe(j); d.setDate(d.getDate() - 1); return jourDe(d);
  }
  function uid() { return (window.Natty && Natty.USER_ID) || 'anon'; }
  function cle() { return 'natty_seances_' + uid(); }

  /* Une vibration courte à chaque geste qui compte. C'est ce qui rend la
     saisie « satisfaisante » plutôt que administrative — et c'est sans effet
     là où l'API n'existe pas, donc sans garde à écrire. */
  function tic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {}
  }

  /* ═══ 3. Les données ═════════════════════════════════════
     Une LIGNE PAR JOUR, et c'est un choix : le calendrier montre un jour, pas
     une liste de séances, et deux entraînements dans la même journée sont deux
     blocs d'exercices dans la même ligne. Ça donne aussi la clé primaire
     `(user_id, jour)` — donc un `merge-duplicates` qui écrase au lieu de
     repartir en 409 (piège de `meal_likes` / `membre_amis`, §3 de CLAUDE.md). */

  var SEANCES = null;    // {'2026-09-02': {jour, exos:[…], duree_min, libre, le}}
  var tableDispo = null; // null = pas encore su

  function lireLocal() {
    try {
      var v = localStorage.getItem(cle());
      return v ? (JSON.parse(v) || {}) : {};
    } catch (e) { return {}; }
  }
  function ecrireLocal() {
    try { localStorage.setItem(cle(), JSON.stringify(SEANCES || {})); } catch (e) {}
  }

  function normaliser(l) {
    var s = {
      jour: l.jour, exos: [], duree_min: +l.duree_min || 0,
      libre: l.libre || '', le: l.le || null
    };
    var brut = l.exos;
    if (typeof brut === 'string') { try { brut = JSON.parse(brut); } catch (e) { brut = []; } }
    (brut || []).forEach(function (x) {
      if (!x) return;
      var ref = exoParCle(x.cle);
      s.exos.push({
        cle: x.cle || '', g: x.g || (ref ? ref.g : ''),
        nom: x.nom || (ref ? ref.nom : 'Exercice'),
        ic: x.ic || (ref ? ref.ic : 'haltere'),
        unite: x.unite || (ref ? ref.unite : '') || '',
        met: +x.met || (ref ? ref.met : 5),
        series: (x.series || []).map(function (r) { return Math.max(0, r0(r)); })
      });
    });
    return s;
  }

  /**
   * Relit les séances des `nb` derniers jours. Idempotent : deux écrans qui
   * l'appellent ne paient qu'une lecture.
   */
  var chargement = null;
  function charger(nb) {
    if (chargement) return chargement;
    chargement = (async function () {
      SEANCES = lireLocal();
      if (!window.Natty || !Natty.sbFetch) return SEANCES;
      var depuis = new Date();
      depuis.setDate(depuis.getDate() - (nb || 120));
      try {
        var r = await Natty.sbFetch('seances?user_id=eq.' + uid()
          + '&jour=gte.' + jourDe(depuis)
          + '&order=jour.desc&limit=200&select=jour,exos,duree_min,libre');
        tableDispo = true;
        /* La base fait foi quand elle répond : les lignes locales d'un jour
           qu'elle connaît sont écrasées, celles qu'elle ne connaît pas sont
           gardées. Sans ce dernier point, une séance saisie hors ligne
           disparaîtrait au premier chargement réussi. */
        (r || []).forEach(function (l) { SEANCES[l.jour] = normaliser(l); });
      } catch (e) { tableDispo = false; }
      return SEANCES;
    })();
    return chargement;
  }

  function toutes() { return SEANCES || (SEANCES = lireLocal()); }
  function duJour(j) {
    var s = toutes()[j || aujourdhui()];
    return (s && s.exos && s.exos.length) ? s : (s && s.libre ? s : null);
  }

  async function enregistrer(s) {
    var t = toutes();
    s.le = new Date().toISOString();
    t[s.jour] = s;
    ecrireLocal();
    try {
      /* ⚠️ `resolution=merge-duplicates` SANS `?on_conflict=` : PostgREST
         résout alors sur la clé primaire, qui est `(user_id, jour)`. C'est
         exactement le contrat de `materiel` et de `garde_manger`. Si la table
         était créée avec un `id` uuid en clé, chaque enregistrement repartirait
         en 409 et rien ne se synchroniserait jamais. */
      await Natty.sbPost('seances', {
        user_id: uid(), jour: s.jour, exos: s.exos,
        duree_min: s.duree_min || null, libre: s.libre || null
      }, 'resolution=merge-duplicates,return=minimal');
      tableDispo = true;
    } catch (e) { tableDispo = false; }
    try {
      document.dispatchEvent(new CustomEvent('natty:seance-ajoutee', { detail: { jour: s.jour } }));
    } catch (e) {}
    return s;
  }

  async function supprimer(j) {
    var t = toutes();
    delete t[j];
    ecrireLocal();
    try {
      await fetch(Natty.SB_URL + '/rest/v1/seances?user_id=eq.' + encodeURIComponent(uid())
        + '&jour=eq.' + encodeURIComponent(j),
        { method: 'DELETE', headers: Natty.entetes() });
    } catch (e) {}
    try {
      document.dispatchEvent(new CustomEvent('natty:seance-ajoutee', { detail: { jour: j } }));
    } catch (e) {}
  }

  function estSynchronise() { return tableDispo === true; }

  /* ═══ 4. Ce que la séance vaut ═══════════════════════════
     Trois lectures, trois natures différentes, et l'écran doit les distinguer :
     les SÉRIES et les REPS sont saisies (donc justes), la DURÉE est déduite du
     volume (sauf si la personne la corrige), l'ÉNERGIE est modélisée. */

  function series(s) {
    if (!s || !s.exos) return 0;
    return s.exos.reduce(function (n, e) { return n + (e.series || []).length; }, 0);
  }
  function reps(s) {
    if (!s || !s.exos) return 0;
    return s.exos.reduce(function (n, e) {
      return n + (e.series || []).reduce(function (a, b) { return a + (+b || 0); }, 0);
    }, 0);
  }
  function groupes(s) {
    var vus = {}, out = [];
    ((s && s.exos) || []).forEach(function (e) {
      if (e.g && !vus[e.g]) { vus[e.g] = 1; out.push(e.g); }
    });
    return out;
  }

  /** La durée en minutes : celle qui a été saisie, sinon celle du volume. */
  function duree(s) {
    if (s && s.duree_min) return s.duree_min;
    return Math.round(series(s) * MIN_PAR_SERIE);
  }

  /** L'équivalent métabolique moyen de la séance, pondéré par les séries. */
  function met(s) {
    var n = 0, som = 0;
    ((s && s.exos) || []).forEach(function (e) {
      var k = (e.series || []).length;
      n += k; som += k * (+e.met || 5);
    });
    return n ? som / n : 5;
  }

  /**
   * L'énergie dépensée par la séance, en kcal, EN PLUS de la dépense
   * quotidienne — et c'est tout l'intérêt du « en plus ».
   *
   * ⚠️ ON RETIRE 1 MET, ET CE N'EST PAS UN DÉTAIL. Un MET vaut le métabolisme
   * de repos : la dépense quotidienne (`onboarding.tdee`) le compte DÉJÀ pour
   * les 24 h de la journée, séance comprise. Utiliser le MET brut compterait
   * une heure de repos deux fois — soit ~70 kcal offertes par heure de salle,
   * donc ~9 g de graisse par séance qui n'ont pas été puisés. C'est le genre de
   * cadeau qui rend un bilan flatteur et faux.
   *
   * Modèle, en une ligne : (MET − 1) × poids(kg) × heures.
   */
  function kcal(s, poids) {
    if (!s || !poids) return 0;
    var h = duree(s) / 60;
    if (!h) return 0;
    return Math.max(0, r0((met(s) - 1) * poids * h));
  }

  /**
   * Le stimulus de construction musculaire, entre 0 et 1.
   *
   * ⚠️ LA VEILLE COMPTE POUR MOITIÉ, et c'est ce qui évite l'absurdité
   * principale : la synthèse protéique reste élevée environ 48 h après une
   * séance. Sans ce report, un jour de repos entre deux séances afficherait
   * « 0 g de muscle » alors que c'est précisément le jour où il se construit.
   *
   * @param {Object} auj   la séance du jour, ou null
   * @param {Object} hier  celle de la veille, ou null
   */
  function stimulus(auj, hier) {
    var eff = series(auj) + series(hier) / 2;
    return borne(eff / SERIES_PLEIN, 0, 1);
  }

  /**
   * Cette personne journalise-t-elle ses séances ?
   *
   * ⚠️ C'EST LE GARDE-FOU DE NON-RÉGRESSION, et il n'est pas décoratif. Le
   * bilan module désormais le muscle par le stimulus du jour ; appliqué à
   * quelqu'un qui n'a jamais ouvert cet écran, ce facteur vaudrait 0 tous les
   * jours et ses estimations FONDRAIENT du jour au lendemain, sans qu'il ait
   * rien changé à sa vie. Tant qu'aucune séance n'a été notée sur la période,
   * le bilan garde donc exactement le modèle d'avant.
   */
  function utilise(nbJours) {
    var t = toutes(), n = nbJours || 21, d = new Date();
    for (var i = 0; i < n; i++) {
      var j = jourDe(d);
      if (t[j] && (series(t[j]) || t[j].libre)) return true;
      d.setDate(d.getDate() - 1);
    }
    return false;
  }

  /** Une ligne de texte : « Dos · 12 séries · 124 reps · ~48 min ». */
  function resume(s) {
    if (!s) return '';
    if (!series(s) && s.libre) return s.libre;
    var g = groupes(s).map(function (c) {
      var d = groupeParCle(c); return d ? d.nom : c;
    });
    var n = series(s);
    return g.join(' · ') + ' · ' + n + ' série' + (n > 1 ? 's' : '')
      + ' · ' + reps(s) + ' reps · ~' + duree(s) + ' min';
  }

  /** Les séances des `nb` derniers jours, du plus ancien au plus récent. */
  function serie(nb) {
    var out = [], d = new Date();
    d.setDate(d.getDate() - (nb - 1));
    for (var i = 0; i < nb; i++) {
      var j = jourDe(d);
      out.push({ jour: j, seance: duJour(j) });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /* ═══ 5. La saisie libre ═════════════════════════════════
     « On peut écrire à la main » (Pablo). Le texte est analysé ICI, sans
     réseau : « développé couché 4x10, tirage 3x12 » devient la même structure
     que le parcours en trois taps. Deux entrées, une seule sortie — sinon la
     séance écrite à la main ne compterait pas dans le bilan, et personne ne
     comprendrait pourquoi.

     ⚠️ Le texte brut est CONSERVÉ dans `libre` même quand l'analyse réussit :
     elle peut se tromper, et jeter ce que la personne a écrit rendrait l'erreur
     irréparable. */
  function analyserTexte(txt) {
    var out = [];
    String(txt || '').split(/[\n,;]+/).forEach(function (ligne) {
      var t = ligne.trim();
      if (!t) return;
      // « 4x10 », « 4 x 10 », « 4*10 », « 4 séries de 10 »
      var m = /(\d{1,2})\s*(?:x|\*|séries?\s*(?:de)?)\s*(\d{1,3})/i.exec(t);
      var nom = t.replace(/(\d{1,2})\s*(?:x|\*|séries?\s*(?:de)?)\s*(\d{1,3})/i, '')
                 .replace(/\breps?\b|\brépétitions?\b/i, '')
                 .replace(/[-–:•]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!nom) return;
      var ref = trouverExo(nom);
      var nb = m ? borne(+m[1], 1, 12) : 3;
      var rp = m ? borne(+m[2], 1, 300) : (ref ? ref.rep : 10);
      var ser = [];
      for (var i = 0; i < nb; i++) ser.push(rp);
      out.push({
        cle: ref ? ref.cle : '', g: ref ? ref.g : '',
        nom: ref ? ref.nom : nom.charAt(0).toUpperCase() + nom.slice(1),
        ic: ref ? ref.ic : 'haltere', unite: (ref && ref.unite) || '',
        met: ref ? ref.met : 5, series: ser
      });
    });
    return out;
  }

  /* ⚠️ Rapprochement MOT À MOT, jamais en sous-chaîne. « curl » se trouve dans
     « curl-pupitre » aussi bien que dans « curl-barre », et une sous-chaîne
     ferait gagner le premier déclaré — le défaut qui faisait de « pomme de
     terre » une pomme dans `core.js`. Le libellé le plus long gagne. */
  function normNom(s) {
    /* ⚠️ LES LIGATURES SE TRADUISENT AVANT `normalize('NFD')`, ET PAS APRÈS.
       `œ` et `æ` sont des lettres à part entière en Unicode : NFD ne les
       décompose pas, donc `[^a-z0-9]` les remplacerait par une espace et
       « bœuf » deviendrait « b uf ». C'est le défaut qui a fait qu'aucun œuf
       n'était reconnu dans toute l'app pendant des mois (§7 de CLAUDE.md).
       Aucun exercice n'en porte aujourd'hui — mais « soulevé de terre » se
       tape aussi « souleve », et la règle vaut d'être la même partout. */
    return String(s || '').toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function trouverExo(nom) {
    var mots = normNom(nom).split(' ').filter(Boolean);
    if (!mots.length) return null;
    var best = null, bestN = 0;
    EXOS.forEach(function (e) {
      var em = normNom(e.nom).split(' ').filter(Boolean);
      var ok = em.every(function (m) { return mots.indexOf(m) > -1; });
      if (ok && em.length > bestN) { best = e; bestN = em.length; }
    });
    if (best) return best;
    // Un seul mot en commun suffit en dernier recours (« tirage », « squat »).
    EXOS.forEach(function (e) {
      var em = normNom(e.nom).split(' ').filter(Boolean);
      em.forEach(function (m) {
        if (m.length > 3 && mots.indexOf(m) > -1 && m.length > bestN) { best = e; bestN = m.length; }
      });
    });
    return best;
  }

  /* ═══ 6. Le style ════════════════════════════════════════
     NOIR dans les deux thèmes, comme `assets/planning.js` et `assets/ajout.js`
     — c'est une mise en scène, pas une surface d'interface : on est dans la
     salle, l'écran est sombre et les chiffres sont ce qui brille. Ne pas
     « corriger » ses `#fff`.
     Le PANNEAU (`monterPanneau`), lui, s'invite sur un écran clair : il passe
     par les jetons `--nt-*` d'`assets/theme.js`, le seul fichier que toutes les
     pages chargent. */
  var cssPose = false;
  function css() {
    if (cssPose) return;
    cssPose = true;
    var s = document.createElement('style');
    s.textContent = [
      '#nsea{position:fixed;inset:0;z-index:9700;background:#0b0b0e;color:#fff;',
      'font-family:Inter,-apple-system,sans-serif;opacity:0;pointer-events:none;',
      'transition:opacity .3s ease;overflow:hidden}',
      '#nsea.on{opacity:1;pointer-events:auto}',
      /* ⚠️ SANS CETTE LIGNE, L'ÉCRAN AVALE LES TAPS APRÈS SA FERMETURE. Il se
         referme en retirant `.on`, donc en fondu, et son nœud reste dans la
         page le temps de la transition : invisible, et parfaitement cliquable.
         C'est la règle 41 de CLAUDE.md, payée sur neuf écrans. */
      '#nsea:not(.on){pointer-events:none}',
      /* Pare-feu, même raison que `#nbil *` : les classes internes sont
         courtes (`.d`, `.v`, `.l`) et les pages hôtes peuvent les avoir prises. */
      '#nsea *{margin:0;padding:0;border:0;box-sizing:border-box}',
      '#nsea button{font-family:inherit;border:none;cursor:pointer;color:inherit;',
      'background:none;-webkit-tap-highlight-color:transparent}',
      '#nsea .ic{width:26px;height:26px;stroke:currentColor;fill:none;stroke-width:1.7;',
      'stroke-linecap:round;stroke-linejoin:round}',

      /* Barre du haut : retour, titre, fermer. */
      '#nsea .bar{position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:center;',
      'gap:10px;padding:calc(14px + env(safe-area-inset-top,0px)) 16px 12px;',
      'background:linear-gradient(180deg,#0b0b0e 55%,rgba(11,11,14,0))}',
      '#nsea .bar .t{flex:1;font-size:13px;font-weight:800;letter-spacing:.6px;',
      'text-transform:uppercase;color:#8b8b96;text-align:center}',
      '#nsea .bar button{width:34px;height:34px;border-radius:50%;background:#181820;',
      'display:flex;align-items:center;justify-content:center;font-size:15px;flex:none}',
      '#nsea .bar button.gh{background:none}',

      /* Colonne défilante. `flex-start`, jamais `center` : le contenu n'a pas
         la même hauteur d'une scène à l'autre, et en `center` tout remonte et
         redescend entre deux plans (le faux raccord de `journee.js`). */
      '#nsea .col{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;',
      'padding:calc(74px + env(safe-area-inset-top,0px)) 18px ',
      'calc(128px + env(safe-area-inset-bottom,0px))}',
      '#nsea .zone{width:100%;max-width:430px;position:relative}',
      '#nsea .sc{width:100%;animation:nsIn .34s cubic-bezier(.22,1,.36,1) both}',
      '#nsea .sc.sort{position:absolute;left:0;right:0;top:0;pointer-events:none;',
      'animation:nsOut .28s cubic-bezier(.4,0,1,1) forwards}',
      '@keyframes nsIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
      '@keyframes nsOut{to{opacity:0;transform:translateY(-10px)}}',

      '#nsea h1{font-size:29px;font-weight:900;letter-spacing:-1.1px;line-height:1.1}',
      '#nsea .sous{font-size:13.5px;color:#9a9aa6;line-height:1.5;margin-top:9px}',
      '#nsea .kick{font-size:11.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;',
      'color:#6f6f7b;margin-bottom:7px}',

      /* Barre d'action, FIXE en bas. Dans le plan, l'animation de sortie
         l'emporte et le bouton disparaît sous le doigt (narration.html). */
      '#nsea .cta{position:absolute;left:0;right:0;bottom:0;z-index:4;display:flex;',
      'flex-direction:column;gap:9px;align-items:center;',
      'padding:22px 18px calc(18px + env(safe-area-inset-bottom,0px));',
      'background:linear-gradient(0deg,#0b0b0e 62%,rgba(11,11,14,0))}',
      '#nsea .cta button{width:100%;max-width:430px;padding:17px;border-radius:17px;',
      'background:#fff;color:#0b0b0e;font-size:15.5px;font-weight:800;letter-spacing:-.2px}',
      '#nsea .cta button:active{transform:scale(.985)}',
      '#nsea .cta button.b2{background:#1c1c24;color:#fff}',
      '#nsea .cta button.b3{background:none;color:#8b8b96;font-size:13.5px;padding:6px;font-weight:700}',
      '#nsea .cta button[disabled]{opacity:.32}',

      /* ── Le calendrier ──────────────────────────────────── */
      '#nsea .mois{display:flex;align-items:center;justify-content:space-between;',
      'gap:10px;margin:18px 0 12px}',
      '#nsea .mois .m{font-size:15px;font-weight:800;letter-spacing:-.3px;text-transform:capitalize}',
      '#nsea .mois button{width:34px;height:34px;border-radius:50%;background:#181820;',
      'font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center}',
      '#nsea .sem7{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}',
      '#nsea .sem7 .hd{font-size:10px;font-weight:800;color:#5f5f6b;text-align:center;padding:2px 0 4px}',
      /* ⚠️ PAS d'`aspect-ratio:1/1` sur une case. À 375 px de large elle ferait
         ~48 px, donc six rangées de plus de 300 px : le résumé de la semaine et
         le bouton d'action partiraient sous la ligne de flottaison. Hauteur
         fixe, mesurée à l'écran — même arbitrage que `planning.js`. */
      '#nsea .cj{position:relative;height:52px;border-radius:13px;background:#14141b;',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;',
      'font-size:13px;font-weight:700;color:#c9c9d2;overflow:hidden}',
      '#nsea .cj.vide{background:none}',
      '#nsea .cj.futur{color:#3d3d47;background:#0f0f15}',
      '#nsea .cj.auj{box-shadow:inset 0 0 0 1.6px #fff}',
      '#nsea .cj.faite{background:#1d3a24;color:#fff}',
      '#nsea .cj.faite .n{color:#5ad07a;font-size:9.5px;font-weight:800}',
      /* Le « + » de chaque jour. ⚠️ Il était à 11 px et #4a4a55 : relevé sur
         capture, on ne le voyait pas — or c'est L'affordance de toute la
         fonctionnalité, celle que Pablo a décrite (« chaque jour il y a un
         bouton + ajouter une séance »). Un geste qu'on ne devine pas n'existe
         pas. Il reste dans le coin plutôt qu'au centre : sous le numéro du jour
         il ferait deux chiffres empilés dans 52 px de haut, illisibles. */
      '#nsea .cj .p{position:absolute;right:5px;bottom:3px;font-size:15px;color:#7b7b8a;',
      'line-height:1;font-weight:700}',
      '#nsea .cj:active{transform:scale(.94)}',
      '#nsea .rec{display:flex;gap:9px;margin-top:14px}',
      '#nsea .rec .r{flex:1;background:#14141b;border-radius:15px;padding:13px 10px;text-align:center}',
      '#nsea .rec .r .v{font-size:21px;font-weight:900;letter-spacing:-.8px}',
      '#nsea .rec .r .l{font-size:10px;color:#7d7d89;margin-top:3px;font-weight:700;line-height:1.25}',

      /* ── Tuiles : groupes, machines ──────────────────────── */
      '#nsea .tuiles{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:20px}',
      '#nsea .tu{position:relative;background:#14141b;border-radius:17px;padding:16px 13px;',
      'display:flex;flex-direction:column;align-items:flex-start;gap:11px;text-align:left;',
      'transition:transform .16s cubic-bezier(.22,1,.36,1),background .16s ease}',
      '#nsea .tu .n{font-size:14px;font-weight:800;letter-spacing:-.2px}',
      '#nsea .tu .s{font-size:10.5px;color:#7d7d89;font-weight:700}',
      '#nsea .tu:active{transform:scale(.96)}',
      '#nsea .tu.on{background:#fff;color:#0b0b0e}',
      '#nsea .tu.on .s{color:#5c5c66}',
      /* La pastille de sélection : elle grandit d'un coup de ressort. Sans ce
         mouvement, un tap sur une tuile déjà sélectionnée ne se distingue pas
         d'un tap qui n'a rien fait. */
      '#nsea .tu .k{position:absolute;top:11px;right:11px;width:22px;height:22px;',
      'border-radius:50%;background:#0b0b0e;color:#fff;display:none;',
      'align-items:center;justify-content:center;animation:nsPop .26s cubic-bezier(.34,1.56,.64,1)}',
      '#nsea .tu .k svg{width:14px;height:14px;stroke-width:2.6}',
      '#nsea .tu.on .k{display:flex}',
      '@keyframes nsPop{from{transform:scale(0)}to{transform:scale(1)}}',
      '#nsea .tu.large{grid-column:1/-1;flex-direction:row;align-items:center;gap:13px}',

      /* ── Séries : les pastilles ──────────────────────────── */
      '#nsea .exo-h{display:flex;align-items:center;gap:13px;margin-top:18px}',
      '#nsea .exo-h .b{width:52px;height:52px;border-radius:16px;background:#14141b;flex:none;',
      'display:flex;align-items:center;justify-content:center}',
      '#nsea .exo-h .b svg{width:30px;height:30px}',
      '#nsea .prog{display:flex;gap:4px;margin-top:16px}',
      '#nsea .prog i{flex:1;height:3px;border-radius:2px;background:#20202a}',
      '#nsea .prog i.on{background:#fff}',
      '#nsea .lbl{font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;',
      'color:#6f6f7b;margin:26px 0 11px}',
      '#nsea .pills{display:flex;gap:7px}',
      '#nsea .pills button{flex:1;height:52px;border-radius:14px;background:#14141b;',
      'font-size:16px;font-weight:800;transition:transform .18s cubic-bezier(.34,1.56,.64,1),',
      'background .18s ease,color .18s ease}',
      /* Toutes les pastilles JUSQU'À celle qu'on touche s'allument : on choisit
         « quatre séries », pas « la quatrième ». Une seule pastille allumée se
         lisait comme un numéro d'ordre. */
      '#nsea .pills button.on{background:#fff;color:#0b0b0e}',
      '#nsea .pills button.on.der{transform:translateY(-4px)}',
      '#nsea .pills button:active{transform:scale(.93)}',

      /* ── Reps : une ligne par série ──────────────────────── */
      '#nsea .sets{display:flex;flex-direction:column;gap:8px}',
      '#nsea .set{display:flex;align-items:center;gap:11px;background:#14141b;',
      'border-radius:15px;padding:9px 11px;animation:nsIn .3s cubic-bezier(.22,1,.36,1) both}',
      '#nsea .set .i{width:24px;font-size:11px;font-weight:800;color:#6f6f7b;flex:none}',
      '#nsea .set .j{flex:1;height:6px;border-radius:3px;background:#20202a;overflow:hidden}',
      '#nsea .set .j i{display:block;height:100%;background:#5ad07a;border-radius:3px;',
      'transition:width .28s cubic-bezier(.22,1,.36,1)}',
      '#nsea .set .v{min-width:58px;text-align:right;font-size:17px;font-weight:900;',
      'letter-spacing:-.5px;flex:none}',
      '#nsea .set .v small{font-size:10.5px;font-weight:700;color:#7d7d89;margin-left:2px}',
      '#nsea .set .pm{display:flex;gap:5px;flex:none}',
      '#nsea .set .pm button{width:34px;height:34px;border-radius:50%;background:#20202a;',
      'font-size:17px;font-weight:800;line-height:1;display:flex;align-items:center;',
      'justify-content:center}',
      '#nsea .set .pm button:active{transform:scale(.9)}',
      '#nsea .chips{display:flex;gap:7px;margin-top:11px;flex-wrap:wrap}',
      '#nsea .chips button{padding:9px 15px;border-radius:999px;background:#181820;',
      'font-size:12.5px;font-weight:800;color:#c9c9d2}',
      '#nsea .chips button:active{transform:scale(.94)}',
      '#nsea .vol{margin-top:16px;background:#14141b;border-radius:16px;padding:14px 16px;',
      'display:flex;align-items:baseline;gap:8px}',
      '#nsea .vol .v{font-size:24px;font-weight:900;letter-spacing:-1px}',
      '#nsea .vol .l{font-size:11.5px;color:#7d7d89;font-weight:700}',

      /* ── Récap et validation ────────────────────────────── */
      '#nsea .liste{display:flex;flex-direction:column;gap:7px;margin-top:18px}',
      '#nsea .li{display:flex;align-items:center;gap:11px;background:#14141b;',
      'border-radius:14px;padding:12px 13px}',
      '#nsea .li svg{width:22px;height:22px;flex:none;color:#8b8b96}',
      '#nsea .li .t{flex:1;font-size:13.5px;font-weight:700;text-align:left}',
      '#nsea .li .q{font-size:12px;font-weight:800;color:#5ad07a;flex:none}',
      '#nsea .li button.x{width:28px;height:28px;border-radius:50%;background:#20202a;',
      'font-size:12px;color:#8b8b96;flex:none}',
      '#nsea .note{font-size:11.5px;color:#6f6f7b;line-height:1.55;margin-top:16px}',
      '#nsea .vok{width:104px;height:104px;margin:26px auto 20px}',
      '#nsea .vok svg{width:100%;height:100%;fill:none;stroke-width:5;',
      'stroke-linecap:round;stroke-linejoin:round}',
      '#nsea .vok .rond{stroke:#5ad07a;stroke-dasharray:264;stroke-dashoffset:264;',
      'animation:nsTrace .8s cubic-bezier(.22,1,.36,1) forwards}',
      '#nsea .vok .co{stroke:#5ad07a;stroke-dasharray:70;stroke-dashoffset:70;',
      'animation:nsTrace .5s cubic-bezier(.22,1,.36,1) .55s forwards}',
      '@keyframes nsTrace{to{stroke-dashoffset:0}}',
      '#nsea .xp{font-size:15px;font-weight:800;color:#5ad07a;margin-top:6px}',
      '#nsea textarea{width:100%;min-height:150px;background:#14141b;border-radius:16px;',
      'padding:15px;color:#fff;font-family:inherit;font-size:14.5px;line-height:1.55;',
      'margin-top:18px;resize:none;outline:none}',
      '#nsea textarea::placeholder{color:#5f5f6b}',

      /* ── Le panneau « Mes séances » d'un écran hôte ─────── */
      '.nseaP{background:var(--nt-card,#ececef);color:var(--nt-ink,#101014);',
      'border-radius:22px;padding:17px 17px 15px;margin-top:14px}',
      '.nseaP .h{display:flex;align-items:center;gap:9px}',
      '.nseaP .h svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.7;',
      'stroke-linecap:round;stroke-linejoin:round;flex:none}',
      '.nseaP .h .t{flex:1;font-size:14.5px;font-weight:800;letter-spacing:-.2px}',
      '.nseaP .s{font-size:12px;color:var(--nt-muted,#8e8e99);line-height:1.5;margin-top:8px}',
      '.nseaP .w{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:13px}',
      '.nseaP .w .d{height:42px;border-radius:11px;background:var(--nt-bg,#f0f0f3);',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;',
      'font-size:11px;font-weight:800;color:var(--nt-muted,#8e8e99)}',
      '.nseaP .w .d.faite{background:#1d3a24;color:#fff}',
      '.nseaP .w .d.faite .k{color:#5ad07a;font-size:9px}',
      '.nseaP button.go{width:100%;margin-top:13px;padding:14px;border-radius:15px;',
      'background:var(--nt-ink,#101014);color:var(--nt-on-ink,#fff);font-family:inherit;',
      'font-size:14px;font-weight:800;border:none;cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══ 7. Le petit moteur de scènes ═══════════════════════
     Copié dans l'esprit de `planning.js` et `bilan.js` : une scène remplace la
     précédente, la sortante passe en `position:absolute` le temps de croiser
     l'entrante (sinon la hauteur du bloc saute), et le bouton d'action vit dans
     une barre FIXE. */

  var racine = null, zone = null, ctaEl = null, barreT = null;
  var scEnCours = null, scrollGele = '';
  var E = null;   // l'état du parcours en cours

  function monter() {
    css();
    if (racine) return racine;
    racine = document.createElement('div');
    racine.id = 'nsea';
    racine.innerHTML =
      '<div class="bar">'
      + '<button type="button" id="nsBack" class="gh" aria-label="Retour">‹</button>'
      + '<div class="t" id="nsTitre"></div>'
      + '<button type="button" id="nsX" aria-label="Fermer">✕</button>'
      + '</div>'
      + '<div class="col"><div class="zone" id="nsZone"></div></div>'
      + '<div class="cta" id="nsCta"></div>';
    document.body.appendChild(racine);
    zone = racine.querySelector('#nsZone');
    ctaEl = racine.querySelector('#nsCta');
    barreT = racine.querySelector('#nsTitre');
    racine.querySelector('#nsX').addEventListener('click', fermer);
    racine.querySelector('#nsBack').addEventListener('click', function () {
      if (E && E.retour) E.retour(); else fermer();
    });
    scrollGele = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    /* ⚠️ La rAF SEULE ne suffit pas : elle ne se déclenche pas si la page ne
       peint pas (app en arrière-plan, onglet caché), et un calque opaque resté
       à `opacity:0` intercepterait quand même les taps. Même précaution que
       `Natty.confirmer` et `assets/generation.js`. */
    requestAnimationFrame(function () { if (racine) racine.classList.add('on'); });
    setTimeout(function () { if (racine) racine.classList.add('on'); }, 60);
    return racine;
  }

  function fermer() {
    if (!racine) return;
    var r = racine, apres = E && E.apres;
    racine = null; zone = null; ctaEl = null; barreT = null; scEnCours = null; E = null;
    r.classList.remove('on');
    document.body.style.overflow = scrollGele || '';
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 340);
    if (apres) { try { apres(); } catch (e) {} }
  }

  function enTete(t, retour) {
    if (barreT) barreT.textContent = t || '';
    if (E) E.retour = retour || null;
    var b = racine && racine.querySelector('#nsBack');
    if (b) b.style.visibility = retour ? 'visible' : 'hidden';
  }

  function scene(o) {
    if (!racine) return null;
    var vieux = scEnCours;
    if (vieux) {
      vieux.classList.add('sort');
      setTimeout(function () { if (vieux.parentNode) vieux.parentNode.removeChild(vieux); }, 300);
    }
    var d = document.createElement('div');
    d.className = 'sc';
    d.innerHTML = o.html || '';
    zone.appendChild(d);
    scEnCours = d;

    ctaEl.innerHTML = '';
    (o.boutons || []).forEach(function (b) {
      if (!b) return;
      var el = document.createElement('button');
      el.type = 'button';
      el.className = b.cls || 'b1';
      el.textContent = b.txt;
      if (b.off) el.setAttribute('disabled', 'disabled');
      el.addEventListener('click', function () { if (b.on) b.on(el); });
      ctaEl.appendChild(el);
    });
    if (o.pret) o.pret(d);

    /* ⚠️ LA RÉSERVE DU BAS SE MESURE, ET NE REDESCEND JAMAIS. Figée à 128 px
       dans le CSS, elle suffisait à un bouton et pas à deux : mesuré, la barre
       d'action fait 130 px avec un bouton principal et un lien discret, donc la
       dernière ligne du calendrier — « gardées sur cet appareil uniquement » —
       se peignait DERRIÈRE elle et n'était plus lisible.
       Et jamais réduite : la réécrire à chaque scène la ferait remonter puis
       redescendre, ce qui déplace toute la composition entre deux plans (le
       faux raccord de `journee.js`, puis de `bilan.js`).
       ⚠️ `offsetHeight` de la barre inclut DÉJÀ son propre retrait de zone
       sûre : la recalculer à la main ici la compterait deux fois. */
    var col = racine.querySelector('.col');
    /* ⚠️⚠️ LA rAF SEULE NE SUFFIT PAS, et ce n'est pas une précaution de
       principe : une page qui ne PEINT pas n'en reçoit AUCUNE (app en
       arrière-plan, onglet caché, écran verrouillé). Mesuré au banc, volet
       masqué : la réserve restait à 128 px et la dernière ligne de l'écran
       passait sous la barre d'action. Or c'est exactement la situation réelle
       de quelqu'un qui note sa séance, verrouille son téléphone entre deux
       exercices, et le rallume. Le `setTimeout` pose la valeur quoi qu'il
       arrive — même précaution que la classe `on` de `Natty.confirmer` et que
       le compteur d'XP d'`assets/recette.js` (règle 40 de CLAUDE.md). */
    var reserver = function () {
      if (!col || !ctaEl || !ctaEl.firstElementChild) return;
      var voulu = ctaEl.offsetHeight + 18;
      var actuel = parseFloat(getComputedStyle(col).paddingBottom) || 0;
      if (voulu > actuel) col.style.paddingBottom = Math.round(voulu) + 'px';
    };
    requestAnimationFrame(reserver);
    setTimeout(reserver, 80);
    col.scrollTop = 0;
    return d;
  }

  /* ═══ 8. Le calendrier ═══════════════════════════════════
     « On clique sur un calendrier où chaque jour il y a un bouton + ajouter
     une séance » (Pablo). Le `+` est donc DANS la case, pas dans une barre à
     côté : c'est le geste qu'il a décrit.

     ⚠️ Les jours À VENIR n'ont pas de `+` et ne répondent pas au tap. Une
     séance est quelque chose qui a eu lieu ; laisser noter celle de jeudi
     prochain, c'est laisser le bilan compter du muscle construit dans le
     futur. */
  function scCalendrier() {
    enTete('MES SÉANCES', null);
    var ref = E.mois || new Date();
    E.mois = ref;
    var an = ref.getFullYear(), mo = ref.getMonth();
    var premier = new Date(an, mo, 1);
    var nbJours = new Date(an, mo + 1, 0).getDate();
    var decal = (premier.getDay() + 6) % 7;   // lundi en tête
    var auj = aujourdhui();
    var moisSuivantPossible = new Date(an, mo, 1) < new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    var cases = '';
    for (var i = 0; i < decal; i++) cases += '<div class="cj vide"></div>';
    for (var d = 1; d <= nbJours; d++) {
      var j = jourDe(new Date(an, mo, d));
      var s = duJour(j), n = series(s);
      var futur = j > auj;
      cases += '<button type="button" class="cj'
        + (s ? ' faite' : '') + (j === auj ? ' auj' : '') + (futur ? ' futur' : '')
        + '" data-jour="' + j + '"' + (futur ? ' disabled' : '') + '>'
        + '<span>' + d + '</span>'
        + (s ? '<span class="n">' + (n ? n + ' sér.' : '✓') + '</span>'
             : (futur ? '' : '<span class="p">+</span>'))
        + '</button>';
    }

    var sem = semaineCourante();
    scene({
      html: '<div class="kick">Votre journal d’entraînement</div>'
        + '<h1>Vos séances</h1>'
        + '<div class="sous">Touchez un jour pour noter ce que vous avez fait. '
        + 'C’est ce qui rend le muscle et la graisse du bilan du soir exacts, '
        + 'plutôt que déduits d’un niveau d’activité déclaré une fois.</div>'
        + '<div class="mois"><button type="button" data-mois="-1" aria-label="Mois précédent">‹</button>'
        + '<div class="m">' + MOIS[mo] + ' ' + an + '</div>'
        + '<button type="button" data-mois="1" aria-label="Mois suivant"'
        + (moisSuivantPossible ? '' : ' disabled style="opacity:.3"') + '>›</button></div>'
        + '<div class="sem7">'
        + JOURS_L.map(function (x) { return '<div class="hd">' + x + '</div>'; }).join('')
        + cases + '</div>'
        + '<div class="rec">'
        + '<div class="r"><div class="v">' + sem.nb + '</div><div class="l">séances<br>cette semaine</div></div>'
        + '<div class="r"><div class="v">' + sem.series + '</div><div class="l">séries<br>au total</div></div>'
        + '<div class="r"><div class="v">' + sem.reps + '</div><div class="l">répétitions<br>enchaînées</div></div>'
        + '</div>'
        + (estSynchronise() ? ''
            : '<div class="note">Vos séances sont gardées sur cet appareil uniquement — '
              + 'la table `seances` n’existe pas encore en base.</div>'),
      pret: function (d) {
        d.querySelectorAll('[data-mois]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.hasAttribute('disabled')) return;
            E.mois = new Date(an, mo + (+b.getAttribute('data-mois')), 1);
            scCalendrier();
          });
        });
        d.querySelectorAll('[data-jour]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.hasAttribute('disabled')) return;
            tic();
            var j = b.getAttribute('data-jour');
            if (duJour(j)) scDetail(j); else demarrer(j);
          });
        });
      },
      boutons: [
        { txt: duJour(auj) ? 'Voir la séance du jour' : 'Ajouter la séance du jour',
          on: function () { if (duJour(auj)) scDetail(auj); else demarrer(auj); } },
        { txt: 'Fermer', cls: 'b3', on: fermer }
      ]
    });
  }

  function semaineCourante() {
    var d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    var nb = 0, se = 0, rp = 0;
    for (var i = 0; i < 7; i++) {
      var s = duJour(jourDe(d));
      if (s) { nb++; se += series(s); rp += reps(s); }
      d.setDate(d.getDate() + 1);
    }
    return { nb: nb, series: se, reps: rp };
  }

  /** La séance déjà notée d'un jour : ce qu'elle contient, et deux gestes. */
  function scDetail(j) {
    enTete(dateFr(j).toUpperCase(), E.depuisCal ? scCalendrier : null);
    var s = duJour(j);
    if (!s) { demarrer(j); return; }
    var poids = E.poids || 0;
    var kc = kcal(s, poids);
    scene({
      html: '<div class="kick">' + esc(dateFr(j)) + '</div>'
        + '<h1>' + esc(groupes(s).map(function (c) {
            var g = groupeParCle(c); return g ? g.nom : c;
          }).join(' + ') || 'Séance') + '</h1>'
        + '<div class="rec">'
        + '<div class="r"><div class="v">' + series(s) + '</div><div class="l">séries</div></div>'
        + '<div class="r"><div class="v">' + reps(s) + '</div><div class="l">répétitions</div></div>'
        + '<div class="r"><div class="v">' + duree(s) + '</div><div class="l">minutes<br>estimées</div></div>'
        + '</div>'
        + '<div class="liste">' + s.exos.map(function (e) {
            return '<div class="li">' + ic(e.ic)
              + '<div class="t">' + esc(e.nom) + '</div>'
              + '<div class="q">' + e.series.length + '×' + resumeReps(e)
              + (e.unite ? ' ' + e.unite : '') + '</div></div>';
          }).join('') + '</div>'
        + (s.libre ? '<div class="note">Écrit à la main : « ' + esc(s.libre) + ' »</div>' : '')
        + (kc ? '<div class="note">Cette séance ajoute <b>' + kc + ' kcal</b> à votre dépense '
              + 'du jour — c’est une estimation : (' + met(s).toFixed(1).replace('.', ',')
              + ' − 1) MET × ' + r0(poids) + ' kg × ' + duree(s) + ' min. Le bilan du soir '
              + 'la compte dans le déficit, donc dans les grammes de graisse.</div>' : ''),
      boutons: [
        { txt: 'Modifier', on: function () { demarrer(j, s); } },
        { txt: 'Supprimer cette séance', cls: 'b3', on: async function () {
            var ok = window.Natty && Natty.confirmer
              ? await Natty.confirmer('Supprimer la séance du ' + dateFr(j) + ' ?',
                  { ok: 'Supprimer', non: 'Annuler' })
              : true;
            if (!ok) return;
            await supprimer(j);
            if (E.depuisCal) scCalendrier(); else fermer();
          } }
      ]
    });
  }

  /** « 4×10 » quand c'est régulier, « 12-10-8 » quand ça descend. */
  function resumeReps(e) {
    var r = e.series || [];
    if (!r.length) return '0';
    var tous = r.every(function (x) { return x === r[0]; });
    return tous ? String(r[0]) : r.join('-');
  }

  /* ═══ 9. La saisie, en trois temps ═══════════════════════ */

  function demarrer(j, existante) {
    E.jour = j;
    E.exos = existante ? existante.exos.map(function (e) {
      return { cle: e.cle, g: e.g, nom: e.nom, ic: e.ic, unite: e.unite, met: e.met,
               series: e.series.slice() };
    }) : [];
    E.libre = existante ? (existante.libre || '') : '';
    E.groupes = existante ? groupes(existante) : [];
    E.cur = 0;
    scGroupe();
  }

  function scGroupe() {
    enTete('QUEL GROUPE ?', E.depuisCal ? scCalendrier : null);
    var sel = E.groupes || [];
    var detail = sel.length > 1;
    scene({
      html: '<div class="kick">' + esc(dateFr(E.jour)) + '</div>'
        + '<h1>Qu’avez-vous travaillé ?</h1>'
        + '<div class="sous">Un groupe, et on vous propose ses machines. '
        + '« Détailler » sert aux séances qui en mélangent plusieurs.</div>'
        + '<div class="tuiles">'
        + GROUPES.map(function (g) {
            var n = nbExosDe(g.cle);
            return '<button type="button" class="tu' + (sel.indexOf(g.cle) > -1 ? ' on' : '')
              + '" data-g="' + g.cle + '">'
              + '<span class="k">' + ic('coche', 'k-ic') + '</span>'
              + ic(g.ic) + '<div><div class="n">' + esc(g.nom) + '</div>'
              + '<div class="s">' + n + ' machines</div></div></button>';
          }).join('')
        + '<button type="button" class="tu large" data-detail="1">'
        + ic('plus') + '<div><div class="n">' + (detail ? 'Plusieurs groupes' : 'Détailler') + '</div>'
        + '<div class="s">Touchez plusieurs groupes, ils s’ajoutent</div></div></button>'
        + '</div>',
      pret: function (d) {
        d.querySelectorAll('[data-g]').forEach(function (b) {
          b.addEventListener('click', function () {
            tic();
            var g = b.getAttribute('data-g');
            var i = E.groupes.indexOf(g);
            if (i > -1) {
              E.groupes.splice(i, 1);
              b.classList.remove('on');
            } else {
              E.groupes.push(g);
              b.classList.add('on');
            }
            majCtaGroupe();
          });
        });
        d.querySelector('[data-detail]').addEventListener('click', function () {
          if (window.Natty && Natty.alerte) {
            Natty.alerte('Touchez autant de groupes que vous voulez : leurs machines '
              + 'se retrouveront toutes dans la liste suivante.');
          }
        });
      },
      boutons: [
        { txt: 'Choisir mes machines', off: !sel.length, on: scMachines },
        { txt: '✏️  Écrire à la main', cls: 'b3', on: scLibre }
      ]
    });
    majCtaGroupe();
  }

  function nbExosDe(g) {
    return EXOS.filter(function (e) { return e.g === g; }).length;
  }

  /* Le bouton se met à jour SANS repeindre la scène : repasser par `scene()`
     rejouerait l'animation d'entrée des quatorze tuiles à chaque tap. */
  function majCtaGroupe() {
    var b = ctaEl && ctaEl.firstElementChild;
    if (!b) return;
    var n = (E.groupes || []).length;
    if (n) { b.removeAttribute('disabled'); b.textContent = 'Choisir mes machines'; }
    else { b.setAttribute('disabled', 'disabled'); b.textContent = 'Choisissez un groupe'; }
  }

  function scMachines() {
    enTete('LES MACHINES', scGroupe);
    var liste = EXOS.filter(function (e) { return E.groupes.indexOf(e.g) > -1; });
    scene({
      html: '<div class="kick">' + esc(E.groupes.map(function (c) {
              var g = groupeParCle(c); return g ? g.nom : c;
            }).join(' · ')) + '</div>'
        + '<h1>Sur quoi ?</h1>'
        + '<div class="sous">Touchez les machines et les mouvements que vous avez faits. '
        + 'L’ordre n’a pas d’importance, on réglera les séries juste après.</div>'
        + '<div class="tuiles">'
        + liste.map(function (e) {
            return '<button type="button" class="tu' + (choisi(e.cle) ? ' on' : '')
              + '" data-exo="' + e.cle + '">'
              + '<span class="k">' + ic('coche') + '</span>'
              + ic(e.ic) + '<div><div class="n">' + esc(e.nom) + '</div>'
              + '<div class="s">' + (e.unite === 'min' ? 'en minutes'
                  : e.unite === 's' ? 'en secondes' : e.rep + ' reps par défaut') + '</div></div></button>';
          }).join('')
        + '</div>',
      pret: function (d) {
        d.querySelectorAll('[data-exo]').forEach(function (b) {
          b.addEventListener('click', function () {
            tic();
            basculerExo(b.getAttribute('data-exo'));
            b.classList.toggle('on', choisi(b.getAttribute('data-exo')));
            majCtaMachines();
          });
        });
      },
      boutons: [
        { txt: 'Régler mes séries', off: !E.exos.length, on: function () { E.cur = 0; scSeries(); } },
        { txt: 'Changer de groupe', cls: 'b3', on: scGroupe }
      ]
    });
    majCtaMachines();
  }

  function choisi(c) {
    return E.exos.some(function (e) { return e.cle === c; });
  }
  function basculerExo(c) {
    var i = -1;
    E.exos.forEach(function (e, k) { if (e.cle === c) i = k; });
    if (i > -1) { E.exos.splice(i, 1); return; }
    var ref = exoParCle(c);
    if (!ref) return;
    /* Trois séries proposées d'office : c'est ce que fait presque tout le monde,
       et une liste qui arrive à zéro série obligerait à trois taps par exercice
       avant de pouvoir seulement enregistrer. La scène suivante les change. */
    E.exos.push({ cle: ref.cle, g: ref.g, nom: ref.nom, ic: ref.ic,
                  unite: ref.unite || '', met: ref.met,
                  series: [ref.rep, ref.rep, ref.rep] });
  }
  function majCtaMachines() {
    var b = ctaEl && ctaEl.firstElementChild;
    if (!b) return;
    var n = E.exos.length;
    if (n) {
      b.removeAttribute('disabled');
      b.textContent = 'Régler mes séries (' + n + ')';
    } else {
      b.setAttribute('disabled', 'disabled');
      b.textContent = 'Choisissez une machine';
    }
  }

  /* ── Séries puis reps, un exercice par écran ──────────────
     « On choisit le nombre de séries et ENFIN de reps » (Pablo) : les deux
     étapes sont dans l'ordre, mais sur le même écran — les reps apparaissent
     quand les séries sont posées. Deux écrans par exercice auraient doublé le
     nombre de plans pour une séance de six mouvements. */
  var MAX_SERIES = 8;

  function scSeries() {
    var e = E.exos[E.cur];
    if (!e) { scRecap(); return; }
    enTete((E.cur + 1) + ' / ' + E.exos.length,
      E.cur ? function () { E.cur--; scSeries(); } : scMachines);
    var u = e.unite === 'min' ? 'min' : (e.unite === 's' ? 'sec' : 'reps');

    scene({
      html: '<div class="prog">' + E.exos.map(function (_, i) {
              return '<i class="' + (i <= E.cur ? 'on' : '') + '"></i>';
            }).join('') + '</div>'
        + '<div class="exo-h"><div class="b">' + ic(e.ic) + '</div>'
        + '<div><h1 style="font-size:23px">' + esc(e.nom) + '</h1></div></div>'
        + '<div class="lbl">Combien de séries ?</div>'
        + '<div class="pills" id="nsPills">' + pillsHTML(e.series.length) + '</div>'
        + '<div id="nsReps"></div>',
      pret: function (d) {
        brancherPills(d, e);
        rendreReps(d, e, u, false);
      },
      boutons: [
        { txt: E.cur + 1 < E.exos.length ? 'Machine suivante' : 'Voir le récap',
          on: function () { E.cur++; scSeries(); } },
        { txt: 'Retirer cet exercice', cls: 'b3', on: function () {
            E.exos.splice(E.cur, 1);
            if (!E.exos.length) { scMachines(); return; }
            if (E.cur >= E.exos.length) E.cur = E.exos.length - 1;
            scSeries();
          } }
      ]
    });
  }

  function pillsHTML(n) {
    var h = '';
    for (var i = 1; i <= MAX_SERIES; i++) {
      h += '<button type="button" data-n="' + i + '" class="'
        + (i <= n ? 'on' : '') + (i === n ? ' der' : '') + '">' + i + '</button>';
    }
    return h;
  }

  function brancherPills(d, e) {
    var boite = d.querySelector('#nsPills');
    boite.querySelectorAll('[data-n]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-n');
        tic(14);
        poserNbSeries(e, n);
        boite.innerHTML = pillsHTML(e.series.length);
        brancherPills(d, e);
        rendreReps(d, e, e.unite === 'min' ? 'min' : (e.unite === 's' ? 'sec' : 'reps'), true);
      });
    });
  }

  /* ⚠️ On garde les reps déjà saisies quand on change le nombre de séries. La
     première version reconstruisait le tableau : passer de 4 à 5 séries
     effaçait les quatre valeurs réglées une par une juste avant. Les séries
     ajoutées reprennent la dernière valeur — c'est ce que fait un pratiquant
     qui enchaîne. */
  function poserNbSeries(e, n) {
    n = borne(n, 1, MAX_SERIES);
    var ref = exoParCle(e.cle);
    var defaut = e.series.length ? e.series[e.series.length - 1] : (ref ? ref.rep : 10);
    while (e.series.length > n) e.series.pop();
    while (e.series.length < n) e.series.push(defaut);
  }

  function rendreReps(d, e, u, anime) {
    var boite = d.querySelector('#nsReps');
    if (!boite) return;
    var max = Math.max(20, Math.max.apply(null, e.series.concat([12])));
    boite.innerHTML = '<div class="lbl">Et combien de ' + u + ' ?</div>'
      + '<div class="sets">' + e.series.map(function (r, i) {
          return '<div class="set"' + (anime ? ' style="animation-delay:' + (i * 0.04).toFixed(2) + 's"' : '') + '>'
            + '<div class="i">' + (i + 1) + '</div>'
            + '<div class="j"><i style="width:' + r0(borne(r / max, 0, 1) * 100) + '%"></i></div>'
            + '<div class="v" data-v="' + i + '">' + r + '<small>' + u + '</small></div>'
            + '<div class="pm"><button type="button" data-r="' + i + '" data-p="-1">−</button>'
            + '<button type="button" data-r="' + i + '" data-p="1">+</button></div>'
            + '</div>';
        }).join('') + '</div>'
      + '<div class="chips">'
      + [8, 10, 12, 15, 20].map(function (n) {
          return '<button type="button" data-tous="' + n + '">' + n + ' partout</button>';
        }).join('') + '</div>'
      + '<div class="vol"><div class="v" id="nsVol">' + reps({ exos: [e] }) + '</div>'
      + '<div class="l">' + u + ' au total sur cet exercice</div></div>';

    boite.querySelectorAll('[data-r]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-r'), p = +b.getAttribute('data-p');
        var pas = e.unite === 'min' ? 1 : (e.unite === 's' ? 5 : 1);
        e.series[i] = borne(e.series[i] + p * pas, 1, 300);
        tic(8);
        rendreReps(d, e, u, false);
      });
    });
    boite.querySelectorAll('[data-tous]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-tous');
        e.series = e.series.map(function () { return n; });
        tic(14);
        rendreReps(d, e, u, true);
      });
    });
  }

  /* ── La saisie libre ─────────────────────────────────────── */
  function scLibre() {
    enTete('À LA MAIN', scGroupe);
    scene({
      html: '<div class="kick">' + esc(dateFr(E.jour)) + '</div>'
        + '<h1>Racontez votre séance</h1>'
        + '<div class="sous">Une ligne par exercice. « Développé couché 4x10 », '
        + '« tirage vertical 3 séries de 12 » — on reconnaît les machines et les '
        + 'séries au fur et à mesure.</div>'
        + '<textarea id="nsTxt" placeholder="Développé couché 4x10&#10;Écartés à la poulie 3x12&#10;Dips 3x10"></textarea>'
        + '<div id="nsLu"></div>',
      pret: function (d) {
        var t = d.querySelector('#nsTxt');
        t.value = E.libre || '';
        var lu = d.querySelector('#nsLu');
        function relire() {
          var ex = analyserTexte(t.value);
          E.libre = t.value;
          E.exos = ex;
          lu.innerHTML = ex.length
            ? '<div class="liste">' + ex.map(function (e) {
                return '<div class="li">' + ic(e.ic) + '<div class="t">' + esc(e.nom) + '</div>'
                  + '<div class="q">' + e.series.length + '×' + resumeReps(e) + '</div></div>';
              }).join('') + '</div>'
            : (t.value.trim() ? '<div class="note">Rien de reconnu pour l’instant. Le texte '
                + 'sera gardé tel quel, mais sans séries il ne comptera pas dans les '
                + 'estimations du bilan.</div>' : '');
          var b = ctaEl && ctaEl.firstElementChild;
          if (b) {
            if (t.value.trim()) b.removeAttribute('disabled');
            else b.setAttribute('disabled', 'disabled');
          }
        }
        t.addEventListener('input', relire);
        relire();
        setTimeout(function () { try { t.focus(); } catch (e) {} }, 260);
      },
      boutons: [
        { txt: 'Continuer', off: !(E.libre || '').trim(),
          on: function () { if (E.exos.length) { E.cur = 0; scSeries(); } else scRecap(); } },
        { txt: 'Utiliser les machines à la place', cls: 'b3', on: function () { E.libre = ''; scGroupe(); } }
      ]
    });
  }

  /* ═══ 10. Récap, enregistrement, félicitation ════════════ */

  function courante() {
    return { jour: E.jour, exos: E.exos, duree_min: E.duree_min || 0, libre: E.libre || '' };
  }

  function scRecap() {
    enTete('LE RÉCAP', function () {
      if (E.exos.length) { E.cur = E.exos.length - 1; scSeries(); } else scGroupe();
    });
    var s = courante();
    var poids = E.poids || 0;
    var kc = kcal(s, poids);
    var st = stimulus(s, duJour(veille(E.jour)));

    scene({
      html: '<div class="kick">' + esc(dateFr(E.jour)) + '</div>'
        + '<h1>' + series(s) + ' séries, ' + reps(s) + ' reps</h1>'
        + '<div class="sous">' + esc(groupes(s).map(function (c) {
            var g = groupeParCle(c); return g ? g.nom : c;
          }).join(' · ') || 'Séance libre') + '</div>'
        + '<div class="rec">'
        + '<div class="r"><div class="v">' + duree(s) + '</div><div class="l">minutes<br>estimées</div></div>'
        + '<div class="r"><div class="v">' + (kc || '—') + '</div><div class="l">kcal<br>dépensées</div></div>'
        + '<div class="r"><div class="v">' + r0(st * 100) + '<small style="font-size:13px">%</small></div>'
        + '<div class="l">du stimulus<br>de croissance</div></div>'
        + '</div>'
        + '<div class="liste">' + s.exos.map(function (e, i) {
            return '<div class="li">' + ic(e.ic) + '<div class="t">' + esc(e.nom) + '</div>'
              + '<div class="q">' + e.series.length + '×' + resumeReps(e) + '</div>'
              + '<button type="button" class="x" data-del="' + i + '" aria-label="Retirer">✕</button></div>';
          }).join('') + '</div>'
        /* ⚠️ Cette mention n'est pas une précaution de style. Les séries sont
           SAISIES, la dépense est MODÉLISÉE : les afficher côte à côte sans
           dire lesquelles sont mesurées en ferait deux chiffres de même
           nature, ce qu'ils ne sont pas. Même règle que le bilan. */
        + '<div class="note">Les séries et les répétitions sont ce que vous avez noté. '
        + 'La durée et les kcal sont ESTIMÉES : ' + MIN_PAR_SERIE.toFixed(1).replace('.', ',')
        + ' min par série, puis (' + met(s).toFixed(1).replace('.', ',') + ' − 1) MET × '
        + (poids ? r0(poids) + ' kg' : 'votre poids') + ' × durée. On retire 1 MET parce que '
        + 'votre dépense quotidienne compte déjà le repos de ces minutes-là. '
        + 'La charge en kilos n’est pas demandée — le volume suffit à situer le '
        + 'stimulus, et un champ de plus par série ferait abandonner la saisie.</div>',
      pret: function (d) {
        d.querySelectorAll('[data-del]').forEach(function (b) {
          b.addEventListener('click', function () {
            E.exos.splice(+b.getAttribute('data-del'), 1);
            tic();
            scRecap();
          });
        });
      },
      boutons: [
        { txt: 'Enregistrer ma séance', off: !series(s) && !(E.libre || '').trim(),
          on: async function (btn) {
            btn.setAttribute('disabled', 'disabled');
            btn.textContent = 'Enregistrement…';
            await enregistrer(courante());
            scFait();
          } },
        { txt: 'Ajouter une autre machine', cls: 'b3', on: scGroupe }
      ]
    });
  }

  function scFait() {
    enTete('', null);
    var s = duJour(E.jour) || courante();
    var nb = Object.keys(toutes()).length;
    scene({
      html: '<div class="vok"><svg viewBox="0 0 120 120">'
        + '<circle class="rond" cx="60" cy="60" r="42"/>'
        + '<path class="co" d="M41 61l13 14 26-30"/></svg></div>'
        + '<h1 style="text-align:center">Séance notée</h1>'
        + '<div class="xp" style="text-align:center">+' + XP_SEANCE + ' XP</div>'
        + '<div class="sous" style="text-align:center">' + esc(resume(s)) + '</div>'
        + '<div class="sous" style="text-align:center">Le bilan du soir en tiendra compte : '
        + 'ce que vous avez brûlé entre dans le déficit, ce que vous avez soulevé entre '
        + 'dans le muscle construit.</div>'
        + '<div class="note" style="text-align:center">' + nb + ' séance'
        + (nb > 1 ? 's' : '') + ' notée' + (nb > 1 ? 's' : '') + ' en tout'
        + (estSynchronise() ? '' : ' · gardées sur cet appareil uniquement') + '</div>',
      pret: function () { tic(26); },
      boutons: [
        { txt: 'Voir mon calendrier', cls: 'b2', on: function () { E.depuisCal = true; scCalendrier(); } },
        { txt: 'Terminer', on: fermer }
      ]
    });
  }

  /* ═══ 11. Ouverture ══════════════════════════════════════ */

  /** Le poids, pour l'estimation des kcal. Une seule colonne, une seule fois. */
  async function chargerPoids() {
    if (E && E.poids) return E.poids;
    try {
      /* ⚠️ Ne demander que des colonnes qui EXISTENT : une colonne inconnue
         fait échouer la requête ENTIÈRE en `42703` (§7 de CLAUDE.md). Et la
         table contient de vrais doublons, dont des lignes sans poids : on prend
         la première ligne EXPLOITABLE, pas la première. */
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + uid()
        + '&select=poids&order=created_at.desc&limit=5');
      var d = (r || []).filter(function (x) { return x && x.poids; })[0];
      if (d && E) E.poids = parseFloat(d.poids) || 0;
    } catch (e) {}
    return (E && E.poids) || 0;
  }

  var ouverture = false;

  /**
   * @param {Object} [o] {jour, creer:bool, apres:fn}
   *   `jour` + `creer` ouvre la saisie directement — c'est ce que fait le
   *   bilan du soir, qui sait déjà de quel jour il parle.
   */
  async function ouvrir(o) {
    o = o || {};
    if (ouverture || racine) return;
    ouverture = true;
    try {
      if (!window.Natty || !Natty.USER_ID) return;
      monter();
      E = { jour: o.jour || aujourdhui(), exos: [], groupes: [], cur: 0,
            libre: '', poids: 0, apres: o.apres || null,
            depuisCal: !o.creer, mois: dateDe(o.jour || aujourdhui()) };
      /* La scène s'affiche AVANT que le poids soit lu : il ne sert qu'à la
         ligne des kcal du récap, trois écrans plus loin. Attendre une requête
         pour peindre un calendrier qui vit en localStorage, c'est une seconde
         de noir pour rien. */
      if (o.creer && !duJour(E.jour)) demarrer(E.jour);
      else if (o.creer) scDetail(E.jour);
      else scCalendrier();
      await charger();
      await chargerPoids();
      // Les séances viennent peut-être d'arriver de la base : on repeint le
      // calendrier, mais JAMAIS une saisie en cours — on effacerait ses taps.
      if (racine && scEnCours && !o.creer && E && E.exos.length === 0
          && barreT && barreT.textContent === 'MES SÉANCES') scCalendrier();
    } finally { ouverture = false; }
  }

  function ajouterPour(jour, apres) {
    return ouvrir({ jour: jour, creer: true, apres: apres });
  }

  /* ═══ 12. Le panneau d'un écran hôte ════════════════════
     Le calendrier complet vit dans le plein écran ; ce panneau est ce qui le
     rend TROUVABLE depuis un écran normal. Sans lui, la seule porte d'entrée
     serait le bilan du soir — donc rien avant 21 h. */
  async function monterPanneau(hote) {
    var el = typeof hote === 'string' ? document.getElementById(hote) : hote;
    if (!el) return;
    css();
    await charger();
    peindrePanneau(el);
    /* Il se repeint tout seul quand une séance est notée ailleurs (le plein
       écran, le bilan) : demander à chaque écran hôte de le faire, c'est un
       écran qui l'oubliera. */
    document.addEventListener('natty:seance-ajoutee', function () {
      if (el.parentNode) peindrePanneau(el);
    });
  }

  function peindrePanneau(el) {
    var d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    var auj = aujourdhui(), cases = '', nb = 0, se = 0;
    for (var i = 0; i < 7; i++) {
      var j = jourDe(d), s = duJour(j);
      if (s) { nb++; se += series(s); }
      cases += '<div class="d' + (s ? ' faite' : '') + '"'
        + (j === auj ? ' style="box-shadow:inset 0 0 0 1.6px var(--nt-ink,#101014)"' : '')
        + '><span>' + JOURS_L[i] + '</span>'
        + (s ? '<span class="k">' + (series(s) || '✓') + '</span>' : '') + '</div>';
      d.setDate(d.getDate() + 1);
    }
    el.className = 'nseaP';
    el.innerHTML = '<div class="h">'
      + '<svg viewBox="0 0 32 32" fill="none">' + IC.haltere + '</svg>'
      + '<div class="t">Mes séances</div></div>'
      + '<div class="s">' + (nb
          ? nb + ' séance' + (nb > 1 ? 's' : '') + ' cette semaine, ' + se + ' séries. '
            + 'C’est ce qui rend le muscle et la graisse du bilan du soir exacts.'
          : 'Aucune séance notée cette semaine. Sans elle, le bilan du soir estime '
            + 'votre muscle et votre graisse depuis votre niveau d’activité déclaré, '
            + 'pas depuis ce que vous avez vraiment fait.')
      + '</div>'
      + '<div class="w">' + cases + '</div>'
      + '<button type="button" class="go">' + (duJour(auj)
          ? 'Voir ma séance du jour' : '+  Ajouter une séance') + '</button>'
      + (estSynchronise() ? ''
          : '<div class="s">Gardées sur cet appareil uniquement — la table `seances` '
            + 'n’existe pas encore en base.</div>');
    el.querySelector('.go').addEventListener('click', function () {
      ouvrir({ jour: auj, creer: !!duJour(auj) ? false : true });
    });
  }

  return {
    charger: charger, ouvrir: ouvrir, ajouterPour: ajouterPour,
    duJour: duJour, toutes: toutes, serie: serie, supprimer: supprimer,
    series: series, reps: reps, groupes: groupes, duree: duree, met: met,
    kcal: kcal, stimulus: stimulus, utilise: utilise, resume: resume,
    estSynchronise: estSynchronise,
    monterPanneau: monterPanneau,
    estOuvert: function () { return !!racine; },
    XP_SEANCE: XP_SEANCE, SERIES_PLEIN: SERIES_PLEIN, MIN_PAR_SERIE: MIN_PAR_SERIE,
    // Pour les bancs de test : le catalogue et l'analyse, sans l'écran.
    _cat: { GROUPES: GROUPES, EXOS: EXOS, analyserTexte: analyserTexte, trouverExo: trouverExo }
  };
})();
