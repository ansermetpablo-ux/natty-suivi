/* ═══════════════════════════════════════════════════════════
   Natty — Le matériel de cuisine (ce avec quoi il peut cuisiner)
   ───────────────────────────────────────────────────────────
   LE PROBLÈME. La génération de la semaine sait tout de ce qu'il MANGE — ses
   allergies, son régime, ses goûts, son garde-manger — et rien de ce avec quoi
   il CUISINE. Elle proposait donc « enfourne 18 min à 200 °C » à quelqu'un qui
   n'a pas de four, et la recette n'était pas seulement inadaptée : elle était
   infaisable. Une recette infaisable ne se rattrape pas à l'écran, elle se
   saute — et la semaine générée perd un repas sur deux sans que rien ne le dise.

   LA RÉPONSE. Une question posée UNE FOIS, à la première génération, avant
   celle du garde-manger : « qu'est-ce que tu as dans ta cuisine ? ». Ensuite
   elle ne revient plus (un four ne change pas toutes les semaines), mais elle
   reste modifiable depuis le panneau « Mon matériel » de l'écran Repas — sinon
   une réponse donnée une fois serait un verrou à vie, et quelqu'un qui
   déménage ou s'achète un mixeur n'aurait aucun moyen de le dire.

   ⚠️ LES CASES SONT PRÉ-COCHÉES, ET C'EST DÉLIBÉRÉ. Presque tout le monde a
   une poêle, une casserole et des feux ; on décoche ce qu'on n'a pas. Partir
   de zéro aurait produit le pire résultat possible : une question à moitié
   remplie devient un profil « il n'a rien », donc des recettes crues, alors
   qu'une question à moitié remplie devrait ne rien changer du tout.

   ⚠️ CE SONT LES ABSENCES QUI COMPTENT. `pourPrompt()` écrit les deux listes,
   mais c'est la seconde qui contraint — un modèle à qui l'on dit seulement
   « il a une poêle » n'en déduit pas qu'il n'a pas de four.

   PERSISTANCE — table `materiel` (`natty_materiel.sql`), repli `localStorage`
   tant qu'elle n'existe pas, exactement comme `assets/garde-manger.js`. Le
   panneau le DIT plutôt que de laisser croire à une synchronisation qui n'a
   pas lieu.

   ⚠️ `user_id` doit être la CLÉ PRIMAIRE : `sauver()` écrit en
   `resolution=merge-duplicates` sans `?on_conflict=`, et PostgREST résout
   alors sur la clé primaire. Avec un `id` uuid en clé, chaque enregistrement
   repartirait en 409 — piège déjà payé sur `meal_likes` et `membre_amis`.

   ⚠️ LA LIGNE PORTE AUSSI SON `resume`, LA PHRASE PRÊTE POUR LE PROMPT. Le
   catalogue ci-dessous vit ici et nulle part ailleurs : le serveur ne peut pas
   l'importer (IIFE navigateur), et en recopier une version côté Node, c'est
   très exactement ce qui a fait diverger `api/_nutrition.js` de `core.js`
   pendant des semaines. On stocke donc la phrase avec la réponse, et le
   serveur — cron du lundi compris — n'a plus qu'à la lire. Contrepartie
   assumée : un matériel ajouté au catalogue ne réécrit pas les `resume` déjà
   en base, il faudra que la personne repasse par le panneau.

   Couleurs : jetons `--nt-*` d'`assets/theme.js`, le seul fichier que TOUTES
   les pages chargent. `suivi.html` n'a ni `--card` ni `--ink` (son jeu de
   variables est plus ancien), donc les jetons de `assets/style.css` seraient
   ici un pari perdu sur au moins un écran.

   Dépend d'`assets/core.js` (USER_ID, sbFetch, sbPost).
   ═══════════════════════════════════════════════════════════ */
var NattyMateriel = (function () {
  var TABLE = 'materiel';

  /* ── Le catalogue ─────────────────────────────────────────────
     Volontairement court : on ne dresse pas l'inventaire d'une cuisine, on
     liste ce qui CHANGE une recette. Un économe ou une passoire n'ont jamais
     empêché personne de cuisiner un plat ; un four, si.

     `defaut:true` = pré-coché (voir l'avertissement en tête de fichier).
     `nom` est ce qui part dans le prompt — donc en toutes lettres, pas la clé. */
  var CATALOGUE = [
    { cle: 'feux',        em: '🔥', nom: 'plaques ou feux',              court: 'Plaques / feux',   defaut: true },
    { cle: 'poele',       em: '🍳', nom: 'poêle',                        court: 'Poêle',            defaut: true },
    { cle: 'casserole',   em: '🥘', nom: 'casserole ou faitout',         court: 'Casserole',        defaut: true },
    { cle: 'four',        em: '♨️', nom: 'four',                          court: 'Four',             defaut: true },
    { cle: 'micro_ondes', em: '⚡', nom: 'micro-ondes',                  court: 'Micro-ondes',      defaut: true },
    { cle: 'couteau',     em: '🔪', nom: 'bon couteau et planche',       court: 'Couteau, planche', defaut: true },
    { cle: 'congelateur', em: '🧊', nom: 'congélateur',                  court: 'Congélateur',      defaut: true },
    { cle: 'balance',     em: '⚖️', nom: 'balance de cuisine',            court: 'Balance',          defaut: false },
    { cle: 'mixeur',      em: '🌀', nom: 'mixeur ou blender',            court: 'Mixeur, blender',  defaut: false },
    { cle: 'robot',       em: '🤖', nom: 'robot ou hachoir',             court: 'Robot, hachoir',   defaut: false },
    { cle: 'air_fryer',   em: '🍟', nom: 'friteuse à air (air fryer)',   court: 'Air fryer',        defaut: false },
    { cle: 'autocuiseur', em: '⏲️', nom: 'autocuiseur ou cocotte-minute', court: 'Autocuiseur',      defaut: false },
    { cle: 'vapeur',      em: '🍚', nom: 'cuiseur vapeur ou rice cooker', court: 'Cuiseur vapeur',   defaut: false },
    { cle: 'wok',         em: '🥢', nom: 'wok',                          court: 'Wok',              defaut: false }
  ];

  var sel = null;         // null = JAMAIS répondu. [] est une réponse (« je n'ai rien »).
  var support = null;     // 'table' | 'local' — déterminé au premier chargement
  var charge = false;
  var hote = null;        // conteneur du panneau, quand il est monté
  var feuille = null;     // la question / l'édition, quand elle est ouverte

  function cleLocale() { return 'natty_materiel_' + (Natty && Natty.USER_ID || 'anon'); }

  function defauts() {
    return CATALOGUE.filter(function (x) { return x.defaut; }).map(function (x) { return x.cle; });
  }

  /* On ne garde que des clés connues : une clé disparue du catalogue resterait
     sinon en base indéfiniment, invisible et incomptable. */
  function nettoyer(arr) {
    var connues = {}, out = [];
    CATALOGUE.forEach(function (x) { connues[x.cle] = true; });
    (Array.isArray(arr) ? arr : []).forEach(function (c) {
      c = String(c || '');
      if (connues[c] && out.indexOf(c) < 0) out.push(c);
    });
    return out;
  }

  /* ── Persistance ──────────────────────────────────────────── */

  function lireLocal() {
    try {
      var b = localStorage.getItem(cleLocale());
      if (b === null) return null;                  // jamais répondu ≠ répondu « rien »
      return nettoyer(JSON.parse(b));
    } catch (e) { return null; }
  }
  function ecrireLocal() {
    try {
      if (sel === null) localStorage.removeItem(cleLocale());
      else localStorage.setItem(cleLocale(), JSON.stringify(sel));
    } catch (e) {}
  }

  async function charger() {
    if (charge) return sel;
    charge = true;
    if (!window.Natty || !Natty.USER_ID) { sel = lireLocal(); support = 'local'; return sel; }
    try {
      var r = await Natty.sbFetch(TABLE + '?user_id=eq.' + Natty.USER_ID + '&select=items&limit=1');
      support = 'table';
      if (r && r[0]) {
        var brut = r[0].items;
        if (typeof brut === 'string') { try { brut = JSON.parse(brut); } catch (e) { brut = []; } }
        sel = nettoyer(brut);
        ecrireLocal();                              // copie locale : lisible hors ligne
      } else {
        // Table présente mais aucune ligne : la réponse peut malgré tout
        // exister sur CET appareil (répondue avant la création de la table).
        sel = lireLocal();
      }
    } catch (e) {
      support = 'local';                            // table absente (PGRST205) ou réseau
      sel = lireLocal();
    }
    return sel;
  }

  async function sauver() {
    ecrireLocal();
    if (support !== 'table' || !Natty.USER_ID) return false;
    try {
      await Natty.sbPost(TABLE, {
        user_id: Natty.USER_ID,
        items: sel || [],
        // La phrase du prompt voyage avec la réponse : c'est ce qui permet au
        // serveur (et au cron du lundi) de s'en servir sans recopier le
        // catalogue. Voir l'avertissement en tête de fichier.
        resume: pourPrompt(),
        updated_at: new Date().toISOString()
      }, 'resolution=merge-duplicates,return=minimal');
      return true;
    } catch (e) {
      return false;   // la copie locale est déjà écrite : rien n'est perdu
    }
  }

  /* ── Lecture ──────────────────────────────────────────────── */

  function repondu() { return Array.isArray(sel); }
  function a(cle) { return Array.isArray(sel) && sel.indexOf(cle) > -1; }
  function liste() { return Array.isArray(sel) ? sel.slice() : []; }
  function fiches() {
    return CATALOGUE.filter(function (x) { return a(x.cle); });
  }

  async function definir(cles) {
    sel = nettoyer(cles);
    await sauver();
    return sel;
  }

  /* Les gestes d'`assets/recette.js` (clés `illu`) devenus impossibles.
     ⚠️ On les nomme explicitement dans le prompt plutôt que de laisser le
     modèle déduire « pas de four donc pas d'enfourner » : c'est cette clé-là
     qui pilote l'animation de la recette, et une étape `enfourner` chez
     quelqu'un sans four donne un four dessiné à l'écran, ce qui est pire
     qu'une simple consigne inadaptée. */
  function gestesInterdits() {
    var g = [];
    if (!a('four') && !a('air_fryer')) g.push('enfourner');
    if (!a('mixeur') && !a('robot')) g.push('mixer');
    if (!(a('poele') && a('feux'))) g.push('saisir');
    if (!(a('casserole') && a('feux')) && !a('autocuiseur') && !a('vapeur')) {
      g.push('bouillir'); g.push('mijoter');
    }
    return g;
  }

  /** Ligne prête à insérer dans un prompt IA. Vide tant que rien n'a été
      répondu : sans réponse, on ne contraint rien — le comportement d'avant. */
  function pourPrompt() {
    if (!Array.isArray(sel)) return '';
    var ont = [], sans = [];
    CATALOGUE.forEach(function (x) { (a(x.cle) ? ont : sans).push(x.nom); });
    var t = 'Dispose de : ' + (ont.length ? ont.join(', ') : 'rien de particulier') + '.';
    t += ' NE DISPOSE PAS de : ' + (sans.length ? sans.join(', ') : 'rien, il a tout ce qu\'il faut') + '.';
    var g = gestesInterdits();
    if (g.length) t += ' Gestes impossibles chez lui : ' + g.join(', ') + '.';
    return t;
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── La question / l'édition ──────────────────────────────────
     UN seul écran pour les deux usages, et c'est voulu : chaque fois que ce
     dépôt a laissé deux écrans raconter la même chose, ils ont divergé (les
     ombres de `suivi.html`, l'en-tête de `menu.html`, `www/menu.html`). Seuls
     changent le titre, le sous-titre et le libellé du bouton.

     @param {object} o  {premiere:true} = c'est la question d'avant-génération
     @returns {Promise<Array>} les clés retenues. Jamais de rejet : fermer,
              c'est répondre — et la réponse par défaut est celle affichée. */
  function ouvrir(o) {
    o = o || {};
    return new Promise(function (repondreP) {
      if (feuille) return repondreP(liste());
      injecterCSS();

      // Rien n'a jamais été répondu : on part des cases pré-cochées, jamais
      // d'une grille vide (voir l'avertissement en tête de fichier).
      var travail = Array.isArray(sel) ? sel.slice() : defauts();
      var rendu = false;

      feuille = document.createElement('div');
      feuille.id = 'nmat';
      document.body.appendChild(feuille);
      // Double amorçage : une classe posée par la seule rAF ne se pose pas si
      // la page ne peint pas (onglet caché, app en arrière-plan) — la feuille
      // resterait invisible tout en interceptant les taps. Même piège que
      // `Natty.confirmer` et `assets/generation.js`.
      requestAnimationFrame(function () { if (feuille) feuille.classList.add('on'); });
      setTimeout(function () { if (feuille) feuille.classList.add('on'); }, 60);

      function fermer(valide) {
        var f = feuille;
        feuille = null;
        if (f) {
          f.classList.remove('on');
          setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 300);
        }
        if (rendu) return;
        rendu = true;
        repondreP(valide ? travail.slice() : liste());
      }

      function peindre() {
        if (!feuille) return;
        var n = travail.length;
        feuille.innerHTML =
            '<div class="nmat-em">🍳</div>'
          + '<h2>' + (o.premiere ? 'Qu’as-tu dans ta cuisine ?' : 'Mon matériel') + '</h2>'
          + '<div class="nmat-sub">'
          + (o.premiere
              ? 'On ne te proposera que des recettes que tu peux vraiment faire. Décoche ce que tu n’as pas — le reste est déjà coché.'
              : 'Décoche ce que tu n’as pas. Tes prochaines recettes s’y adapteront.')
          + '</div>'
          + '<div class="nmat-grid">' + CATALOGUE.map(function (x) {
              var on = travail.indexOf(x.cle) > -1;
              return '<button type="button" class="nmat-it' + (on ? ' on' : '') + '"'
                + ' data-m="' + esc(x.cle) + '" aria-pressed="' + (on ? 'true' : 'false') + '">'
                + '<span class="nmat-e">' + x.em + '</span>'
                + '<span class="nmat-n">' + esc(x.court) + '</span></button>';
            }).join('') + '</div>'
          + '<div class="nmat-etat" id="nmatEtat">' + n + ' sur ' + CATALOGUE.length
          + (support === 'local' ? ' · gardé sur cet appareil uniquement' : '') + '</div>'
          + '<div class="nmat-btns">'
          +   '<button type="button" class="nmat-go" data-m-a="ok">'
          +     (o.premiere ? 'C’est bon, continuons' : 'Enregistrer') + '</button>'
          +   (o.premiere
                ? '<button type="button" class="nmat-no" data-m-a="skip">Je répondrai plus tard</button>'
                : '<button type="button" class="nmat-no" data-m-a="skip">Annuler</button>')
          + '</div>';
      }

      // Délégation : la grille est repeinte à chaque tap, des écouteurs posés
      // sur les boutons eux-mêmes seraient perdus au premier geste.
      feuille.addEventListener('click', async function (ev) {
        var b = ev.target.closest('[data-m],[data-m-a]');
        if (!b || !feuille || !feuille.contains(b)) return;

        if (b.hasAttribute('data-m')) {
          var c = b.getAttribute('data-m');
          var i = travail.indexOf(c);
          if (i > -1) travail.splice(i, 1); else travail.push(c);
          peindre();
          return;
        }

        var act = b.getAttribute('data-m-a');
        if (act === 'skip') { fermer(false); return; }
        if (act === 'ok') {
          b.disabled = true;
          var e = document.getElementById('nmatEtat');
          if (e) e.textContent = 'Enregistrement…';
          await definir(travail);
          peindrePanneau();
          fermer(true);
        }
      });

      peindre();
    });
  }

  /** La question posée avant la première génération. */
  function demander() { return ouvrir({ premiere: true }); }

  /* ── Le panneau (écran Repas) ─────────────────────────────────
     Ce qui rend la réponse rattrapable. Sans lui, un « je n'ai pas de four »
     donné une fois vaudrait pour toujours. */
  function peindrePanneau() {
    if (!hote) return;
    var ont = fiches();
    var sans = CATALOGUE.filter(function (x) { return !a(x.cle); });

    var corps;
    if (!repondu()) {
      corps = '<div class="nmat-vide">Pas encore renseigné. Vos recettes de la semaine'
            + ' éviteront les appareils que vous n’avez pas.</div>';
    } else {
      corps = '<div class="nmat-l"><div class="nmat-lt">Je peux utiliser</div>'
            + '<div class="nmat-tags">'
            + (ont.length
                ? ont.map(function (x) {
                    return '<span class="nmat-tag ok">' + x.em + ' ' + esc(x.court) + '</span>';
                  }).join('')
                : '<span class="nmat-tag">Rien de coché</span>')
            + '</div></div>';
      if (sans.length) {
        corps += '<div class="nmat-l"><div class="nmat-lt">À éviter dans mes recettes</div>'
              + '<div class="nmat-tags">'
              + sans.map(function (x) {
                  return '<span class="nmat-tag bad">' + esc(x.court) + '</span>';
                }).join('')
              + '</div></div>';
      }
      if (support === 'local') {
        corps += '<div class="nmat-note">Gardé sur cet appareil uniquement.</div>';
      }
    }

    hote.innerHTML = '<div class="nmat-panel">'
      + '<div class="nmat-head"><div class="nmat-title">Mon matériel'
      + (repondu() ? ' <span>(' + ont.length + '/' + CATALOGUE.length + ')</span>' : '') + '</div>'
      + '<button type="button" class="nmat-link" data-m-p="ouvrir">'
      + (repondu() ? 'Modifier' : 'Renseigner') + '</button></div>'
      + corps + '</div>';
  }

  async function monter(el) {
    if (!el) return;
    hote = el;
    injecterCSS();
    if (!charge) await charger();
    peindrePanneau();
    if (hote._nmatBranche) return;
    hote._nmatBranche = true;
    hote.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-m-p]');
      if (b && b.getAttribute('data-m-p') === 'ouvrir') ouvrir({});
    });
  }

  /* ── CSS ──────────────────────────────────────────────────────
     Tout est préfixé `nmat`, rien ne sort de `#nmat` ni de `.nmat-panel` : ce
     module s'invite sur six écrans qui ont chacun leur feuille. */
  var cssPose = false;
  function injecterCSS() {
    if (cssPose) return;
    cssPose = true;
    var s = document.createElement('style');
    s.id = 'nmat-css';
    s.textContent = [
      /* La question, plein écran — même mise en scène que celle du
         garde-manger (`#ngenQ` d'assets/generation.js), puisqu'elle la précède
         immédiatement : deux présentations différentes à 2 s d'intervalle se
         liraient comme deux applications. */
      '#nmat{position:fixed;inset:0;z-index:100001;background:var(--nt-bg,#fff);display:flex;',
      'flex-direction:column;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;',
      'padding:26px 24px calc(24px + env(safe-area-inset-bottom,0px));',
      'padding-top:calc(30px + env(safe-area-inset-top,0px));opacity:0;',
      'transition:opacity .4s ease;overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '#nmat.on{opacity:1}',
      '#nmat .nmat-em{font-size:52px;text-align:center;margin-bottom:16px}',
      '#nmat h2{font-size:25px;font-weight:900;color:var(--nt-ink,#1a1a2e);text-align:center;',
      'letter-spacing:-.6px;line-height:1.2;margin:0}',
      '#nmat .nmat-sub{font-size:13.5px;color:var(--nt-muted,#9a9aaa);text-align:center;margin:10px auto 0;',
      'line-height:1.55;max-width:320px}',
      '#nmat .nmat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:22px}',
      '#nmat .nmat-it{background:var(--nt-card,#f7f7fa);border:1.5px solid transparent;border-radius:16px;',
      'padding:13px 3px 10px;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;',
      'align-items:center;gap:6px;color:var(--nt-muted,#9a9aaa);opacity:.55;',
      '-webkit-tap-highlight-color:transparent;transition:opacity .18s ease,border-color .18s ease}',
      /* Coché = plein contraste ; décoché = éteint. L'inverse (une croix rouge
         sur ce qu'on n'a pas) faisait lire la grille comme une liste d'erreurs. */
      '#nmat .nmat-it.on{opacity:1;color:var(--nt-ink,#1a1a2e);border-color:var(--nt-ink,#1a1a2e)}',
      '#nmat .nmat-e{font-size:22px;line-height:1}',
      '#nmat .nmat-n{font-size:9.5px;font-weight:800;line-height:1.2;text-align:center}',
      '#nmat .nmat-etat{font-size:12px;color:var(--nt-muted,#9a9aaa);text-align:center;margin-top:14px;min-height:18px}',
      '#nmat .nmat-btns{margin-top:auto;padding-top:24px;display:flex;flex-direction:column;gap:10px}',
      '#nmat .nmat-go{padding:17px;border:none;border-radius:16px;background:var(--nt-ink,#1a1a2e);',
      'color:var(--nt-on-ink,#fff);font-family:inherit;font-size:16px;font-weight:800;cursor:pointer}',
      '#nmat .nmat-go:disabled{opacity:.5}',
      '#nmat .nmat-no{padding:14px;border:none;border-radius:16px;background:var(--nt-card,#f0f0f3);',
      'color:var(--nt-muted,#6a6a78);font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}',

      /* Le panneau de l'écran Repas — même grammaire que « Mes préférences »
         (`.np-panel` d'assets/preferences.js), dont il est le voisin direct. */
      '.nmat-panel{background:var(--nt-card,#f0f0f3);border-radius:22px;padding:18px;margin-top:16px}',
      '.nmat-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px}',
      '.nmat-title{font-size:15.5px;font-weight:900;color:var(--nt-ink,#1a1a2e)}',
      '.nmat-title span{font-size:11.5px;font-weight:700;color:var(--nt-muted,#9a9aaa);margin-left:4px}',
      '.nmat-link{background:none;border:none;font-family:inherit;font-size:12px;font-weight:800;',
      'color:var(--nt-ink,#1a1a2e);text-decoration:underline;cursor:pointer;padding:0}',
      '.nmat-l{margin-top:12px}',
      '.nmat-lt{font-size:10.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;',
      'color:var(--nt-muted,#9a9aaa);margin-bottom:7px}',
      '.nmat-tags{display:flex;flex-wrap:wrap;gap:6px}',
      '.nmat-tag{font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:99px;',
      'background:var(--nt-bg,#fff);color:var(--nt-ink,#1a1a2e);border:1px solid var(--nt-line,#e2e2e8)}',
      '.nmat-tag.ok{border-color:#34c759;color:#34c759}',
      '.nmat-tag.bad{border-color:var(--nt-line,#e2e2e8);color:var(--nt-muted,#9a9aaa);',
      'text-decoration:line-through}',
      '.nmat-vide,.nmat-note{font-size:12.5px;color:var(--nt-muted,#9a9aaa);line-height:1.6;margin-top:10px}'
    ].join('');
    document.head.appendChild(s);
  }

  return {
    charger: charger, repondu: repondu, a: a, liste: liste, fiches: fiches,
    definir: definir, pourPrompt: pourPrompt, gestesInterdits: gestesInterdits,
    demander: demander, ouvrir: ouvrir, monter: monter,
    CATALOGUE: CATALOGUE,
    estSynchronise: function () { return support === 'table'; }
  };
})();
