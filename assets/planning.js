/* ═══════════════════════════════════════════════════════════
   Natty — Planification de la semaine
   ───────────────────────────────────────────────────────────
   CE QUE C'EST. Une séquence plein écran, une fois par semaine, à la première
   ouverture : « Bonjour Prénom » → « Planifions ensemble » → deux questions →
   placement des repas → calendrier → proposition de livraison → validation.
   Ensuite, le calendrier vit dans « Ma semaine » de l'écran Repas.

   POURQUOI UN MODULE ET PAS UNE PAGE. Elle s'invite par-dessus l'écran courant
   (comme `assets/ajout.js` et `assets/generation.js`) : la proposition arrive
   cinq secondes après l'arrivée dans l'app, sans qu'on ait navigué nulle part.
   Une page aurait volé la navigation à quelqu'un qui venait faire autre chose.

   CE QUI EST CALCULÉ ICI, ET CE QUI NE L'EST PAS.
   • Le PLACEMENT est déterministe et local : on relit les repas des 28 derniers
     jours, on les range par (jour de semaine × créneau), et on compare chaque
     case à la cible du créneau. Le repas « protéines » va là où il manque le
     plus de protéines. Aucune IA, donc aucune latence et un résultat qu'on peut
     expliquer ligne à ligne — c'est exactement ce que Pablo a demandé.
   • Les 3 PLATS macro, eux, sont demandés à `/api/claude` (appel court, ~10 s)
     à partir des conseils de la semaine déjà en base. Fail-open : si l'appel
     échoue, un trio de repli local prend la place et la séquence continue.
   • Les 2 RECETTES ne sont pas régénérées : ce sont celles de la semaine, lues
     dans `profil_conseils` — les mêmes que celles affichées par `repas.html`.

   ⚠️ DÉPENDANCE. La séquence a besoin de la génération de la semaine. Si elle
   n'a pas eu lieu, on la déclenche (`NattyGeneration.lancer()`) et on reprend
   après : on ne planifie pas des repas qui n'existent pas.

   Dépend de `assets/core.js`. Utilise `assets/generation.js` et
   `assets/reco.js` s'ils sont chargés, et sait s'en passer.
   ═══════════════════════════════════════════════════════════ */
window.NattyPlanning = (function () {

  /* ── Vocabulaire commun ──────────────────────────────────── */
  var JOURS  = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  var JOURS3 = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  /* Trois créneaux, bornés en heures pour ranger un repas déjà enregistré.
     ⚠️ On lit `created_at` (horodaté) et non `meal_date` (une date sèche) :
     sans l'heure, il n'y a pas de créneau, et tout le calcul tombe. */
  var CRENEAUX = [
    { cle: 'matin', nom: 'Petit déjeuner', court: 'Matin', em: '🥐', h0: 3,  h1: 11 },
    { cle: 'midi',  nom: 'Midi',           court: 'Midi',  em: '🥗', h0: 11, h1: 16 },
    { cle: 'soir',  nom: 'Dîner',          court: 'Soir',  em: '🍽️', h0: 16, h1: 27 }
  ];

  var MACROS = {
    p: { nom: 'Protéines', em: '🥩', cle: 'conseil_prot' },
    g: { nom: 'Glucides',  em: '🌾', cle: 'conseil_gluc' },
    l: { nom: 'Lipides',   em: '🥑', cle: 'conseil_lip'  }
  };

  /* Les recettes de la semaine n'ont pas encore de vraie photo : on réutilise
     les deux plats détourés déjà embarqués, comme le fait `repas.html`. */
  var PHOTOS = ['/assets/img/plat-demo1-week.png', '/assets/img/plat-demo2-week.png'];

  var TOTAL_CASES = 21;          // 7 jours × 3 créneaux
  var ouvert = false, planCache = null, scrollGele = null;

  /* ═══ 1. Dates et clés ═══════════════════════════════════ */

  function lundi(d) {
    d = d ? new Date(d) : new Date();
    var j = d.getDay();
    d.setDate(d.getDate() - j + (j === 0 ? -6 : 1));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* Lundi = 0, dimanche = 6. `getDay()` compte à partir du dimanche : le
     décalage est fait une seule fois, ici, plutôt que dans chaque boucle. */
  function jourIndex(date) { var j = new Date(date).getDay(); return j === 0 ? 6 : j - 1; }

  function creneauIndex(date) {
    var h = new Date(date).getHours();
    if (h >= CRENEAUX[0].h0 && h < CRENEAUX[0].h1) return 0;
    if (h >= CRENEAUX[1].h0 && h < CRENEAUX[1].h1) return 1;
    return 2;                      // avant 3 h du matin = dîner de la veille
  }

  function cle(quoi) { return 'natty_plan_' + quoi + '_' + (Natty.USER_ID || 'anon'); }
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ═══ 2. Persistance ═════════════════════════════════════
     La table `planning_semaine` peut ne pas exister (natty_planning.sql).
     Tant qu'elle manque, le plan vit sur l'appareil : ça marche, mais il ne
     suit pas l'utilisateur d'un téléphone à l'autre — et on le lui dit, plutôt
     que de laisser croire à une synchronisation qui n'a pas lieu. */
  var TABLE_OK = null;             // null = pas encore su

  async function lire(force) {
    var s = lundi();
    if (!force && planCache && planCache.semaine === s) return planCache;
    var trouve = null;
    if (Natty.USER_ID) {
      try {
        var r = await Natty.sbFetch('planning_semaine?user_id=eq.' + Natty.USER_ID
          + '&semaine=eq.' + s + '&select=plan&limit=1');
        TABLE_OK = true;
        if (r && r.length && r[0].plan) trouve = r[0].plan;
      } catch (e) { TABLE_OK = false; }
    }
    if (!trouve) {
      try {
        var l = JSON.parse(localStorage.getItem(cle('plan')) || 'null');
        if (l && l.semaine === s) trouve = l;
      } catch (e) {}
    }
    planCache = trouve;
    return trouve;
  }

  async function enregistrer(plan) {
    planCache = plan;
    // Le local d'abord : il est le repli, et il est instantané. Une écriture en
    // base qui échoue ne doit pas faire perdre le plan qu'on vient de composer.
    try { localStorage.setItem(cle('plan'), JSON.stringify(plan)); } catch (e) {}
    try {
      await Natty.sbPost('planning_semaine?on_conflict=user_id,semaine',
        { user_id: Natty.USER_ID, semaine: plan.semaine, plan: plan },
        'resolution=merge-duplicates,return=minimal');
      TABLE_OK = true;
    } catch (e) { TABLE_OK = false; }
    return plan;
  }

  /* ═══ 3. L'analyse — où manque quoi, et quand ════════════ */

  var REPAS_PAR_JOUR = { '1_2': 2, '3': 3, '3_collations': 4, 'grignotage': 4 };

  async function cibles() {
    var jour = null, n = 3;
    try {
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + Natty.USER_ID
        + '&select=poids,tdee&order=created_at.desc&limit=5');
      // ⚠️ `onboarding` contient des doublons, dont des lignes sans poids ni
      // tdee : on prend la première REELLEMENT exploitable, pas la première.
      (r || []).forEach(function (d) {
        if (jour) return;
        var poids = parseFloat(d.poids) || 0, tdee = parseFloat(d.tdee) || 0;
        if (!poids && !tdee) return;
        jour = {
          p: poids ? Math.round(poids * 2) : 0,
          l: tdee ? Math.round(tdee * 0.25 / 9) : 0,
          g: tdee ? Math.round(tdee * 0.5 / 4) : 0,
          c: tdee ? Math.round(tdee) : 0
        };
      });
    } catch (e) {}
    if (!jour || !jour.c) jour = { p: 120, l: 67, g: 250, c: 2000 };
    try {
      var qa = await Natty.sbFetch('questionnaire_alim?user_id=eq.' + Natty.USER_ID + '&select=nb_repas&limit=1');
      var v = qa && qa[0] ? qa[0].nb_repas : null;
      // ⚠️ `nb_repas` est un LIBELLÉ ('1_2', '3_collations'…). parseInt('1_2')
      // vaut 1, d'où des cibles par repas deux fois trop hautes.
      if (v && REPAS_PAR_JOUR[v]) n = REPAS_PAR_JOUR[v];
    } catch (e) {}
    return {
      jour: jour, nbRepas: n,
      repas: {
        p: Math.round(jour.p / n), g: Math.round(jour.g / n),
        l: Math.round(jour.l / n), c: Math.round(jour.c / n)
      }
    };
  }

  /* Les 28 derniers jours, rangés en 21 cases. Une case porte la MOYENNE par
     repas, pas le cumul : quatre lundis midis enregistrés ne doivent pas passer
     pour un excédent. */
  async function analyser(cbl) {
    var cases = [], i, j;
    for (i = 0; i < 7; i++) {
      cases[i] = [];
      for (j = 0; j < 3; j++) cases[i][j] = { n: 0, p: 0, g: 0, l: 0, c: 0 };
    }

    var meals = [];
    try {
      var depuis = new Date(Date.now() - 28 * 864e5).toISOString();
      meals = await Natty.sbFetch('meals?user_id=eq.' + Natty.USER_ID
        + '&created_at=gte.' + depuis + '&select=id,name,created_at&order=created_at.desc&limit=200') || [];
    } catch (e) { meals = []; }

    if (meals.length) {
      // Par lots de 50 : une URL `in.(…)` avec 200 uuid dépasse la longueur
      // acceptée et la requête entière repart en erreur.
      var parRepas = {};
      for (i = 0; i < meals.length; i += 50) {
        var lot = meals.slice(i, i + 50).map(function (m) { return m.id; });
        try {
          var ings = await Natty.sbFetch('meal_ingredients?meal_id=in.(' + lot.join(',')
            + ')&select=meal_id,name,quantity_g') || [];
          ings.forEach(function (x) {
            (parRepas[x.meal_id] = parRepas[x.meal_id] || []).push(x);
          });
        } catch (e) {}
      }
      meals.forEach(function (m) {
        // Les colonnes de macros de `meal_ingredients` sont à 0 en base : on
        // recalcule, comme le fil social et les anneaux de l'ajout de plat.
        var mac = Natty.calcMac(parRepas[m.id] || []);
        if (!mac.c && !mac.p) return;                 // ingrédients inconnus : sans valeur
        var c = cases[jourIndex(m.created_at)][creneauIndex(m.created_at)];
        c.n++; c.p += mac.p; c.g += mac.g; c.l += mac.l; c.c += mac.c;
      });
    }

    /* Le manque, case par case et macro par macro. Entre 0 (comblé) et 1
       (rien du tout).
       ⚠️ Une case JAMAIS renseignée n'est pas une case sans manque : c'est une
       case sans information. La compter 0 exclurait d'office les créneaux que
       l'utilisateur ne journalise pas — souvent ceux qu'il expédie. On la fixe
       donc à 0,55 : au-dessus d'un vrai créneau correct, en dessous d'un vrai
       creux mesuré, qui peut approcher 1. */
    var INCONNU = 0.55;
    for (i = 0; i < 7; i++) for (j = 0; j < 3; j++) {
      var c = cases[i][j];
      c.manque = {};
      ['p', 'g', 'l'].forEach(function (m) {
        if (!c.n) { c.manque[m] = INCONNU; return; }
        var moy = c[m] / c.n, cible = cbl.repas[m] || 1;
        c.manque[m] = Math.max(0, Math.min(1, (cible - moy) / cible));
      });
      c.manqueTotal = (c.manque.p + c.manque.g + c.manque.l) / 3;
      if (c.n) { c.moy = { p: c.p / c.n, g: c.g / c.n, l: c.l / c.n, c: c.c / c.n }; }
    }
    return { cases: cases, nbRepas: meals.length };
  }

  /* Le placement lui-même. Trois plats macro d'abord — ce sont eux qui portent
     l'intention —, puis les deux recettes dans les cases qui manquent le plus
     globalement. Une case ne reçoit qu'un plat. */
  function placer(analyse, prepare, platsMacro, recettes) {
    var pris = {}, sortie = [];

    function libres() {
      var l = [];
      for (var i = 0; i < 7; i++) for (var j = 0; j < 3; j++) {
        if (!prepare[i][j]) continue;                 // il achète : on ne planifie pas
        if (pris[i + '-' + j]) continue;
        l.push({ j: i, c: j, case: analyse.cases[i][j] });
      }
      return l;
    }

    ['p', 'g', 'l'].forEach(function (m, k) {
      var plat = platsMacro[k];
      if (!plat) return;
      var dispo = libres();
      if (!dispo.length) return;
      dispo.sort(function (a, b) {
        var d = b.case.manque[m] - a.case.manque[m];
        // À manque égal, le créneau le plus tôt dans la semaine : un conseil
        // placé le dimanche ne sert qu'un jour.
        return d !== 0 ? d : (a.j - b.j) || (a.c - b.c);
      });
      var v = dispo[0];
      pris[v.j + '-' + v.c] = 1;
      sortie.push({
        jour: v.j, creneau: v.c, type: 'macro', macro: m,
        nom: plat.nom, em: plat.em || MACROS[m].em, photo: null,
        pourquoi: plat.pourquoi || '', kcal: plat.kcal || 0,
        p: plat.p || 0, g: plat.g || 0, l: plat.l || 0,
        ingredients: plat.ingredients || [],
        manque: Math.round(v.case.manque[m] * 100)
      });
    });

    (recettes || []).forEach(function (r, k) {
      var dispo = libres();
      if (!dispo.length) return;
      dispo.sort(function (a, b) {
        var d = b.case.manqueTotal - a.case.manqueTotal;
        return d !== 0 ? d : (a.j - b.j) || (a.c - b.c);
      });
      var v = dispo[0];
      pris[v.j + '-' + v.c] = 1;
      var mac = r.macros || {};
      sortie.push({
        jour: v.j, creneau: v.c, type: 'recette', macro: null,
        nom: r.nom || 'Recette', em: '🍲', photo: PHOTOS[k % PHOTOS.length],
        pourquoi: r.pourquoi || '', kcal: Math.round(mac.kcal || 0),
        p: Math.round(mac.p || 0), g: Math.round(mac.g || 0), l: Math.round(mac.l || 0),
        ingredients: r.ingredients || [], src: r,
        manque: Math.round(v.case.manqueTotal * 100)
      });
    });

    sortie.sort(function (a, b) { return (a.jour - b.jour) || (a.creneau - b.creneau); });
    return sortie;
  }

  /* ═══ 4. Les trois plats macro ═══════════════════════════
     Demandés à l'IA à partir des conseils DÉJÀ écrits en base : on ne relance
     jamais la génération de la semaine pour ça. Appel court (un objet JSON de
     trois plats), donc rapide — il tient dans l'animation de planification.
     ⚠️ Fail-open : au moindre accroc, le trio de repli prend la place. Une
     planification qui échoue parce qu'une suggestion manque serait absurde. */
  var REPLI = [
    { macro: 'p', nom: 'Poulet rôti, quinoa et brocoli', em: '🍗', p: 46, g: 38, l: 11, kcal: 445,
      pourquoi: 'Une base simple qui apporte l’essentiel des protéines du créneau.',
      ingredients: [{ em: '🍗', nom: 'Poulet', qte: '150 g' }, { em: '🌾', nom: 'Quinoa', qte: '80 g' }, { em: '🥦', nom: 'Brocoli', qte: '150 g' }] },
    { macro: 'g', nom: 'Patate douce, pois chiches et feta', em: '🍠', p: 19, g: 62, l: 14, kcal: 460,
      pourquoi: 'Des glucides lents pour tenir jusqu’au repas suivant.',
      ingredients: [{ em: '🍠', nom: 'Patate douce', qte: '250 g' }, { em: '🫘', nom: 'Pois chiches', qte: '120 g' }, { em: '🧀', nom: 'Feta', qte: '40 g' }] },
    { macro: 'l', nom: 'Saumon, avocat et riz vinaigré', em: '🐟', p: 32, g: 45, l: 26, kcal: 530,
      pourquoi: 'De bons lipides, ceux qui manquent le plus souvent.',
      ingredients: [{ em: '🐟', nom: 'Saumon', qte: '130 g' }, { em: '🥑', nom: 'Avocat', qte: '80 g' }, { em: '🍚', nom: 'Riz', qte: '90 g' }] }
  ];

  function extraireJson(t) {
    if (!t) return null;
    var i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { return null; }
  }

  async function platsMacro(conseils, cbl, analyse) {
    var creux = ['p', 'g', 'l'].map(function (m) {
      var meilleur = null;
      for (var i = 0; i < 7; i++) for (var j = 0; j < 3; j++) {
        var c = analyse.cases[i][j];
        if (!meilleur || c.manque[m] > meilleur.v) meilleur = { v: c.manque[m], i: i, j: j };
      }
      return MACROS[m].nom + ' : il en manque surtout le ' + JOURS[meilleur.i].toLowerCase()
           + ' au créneau « ' + CRENEAUX[meilleur.j].nom.toLowerCase() + ' »';
    }).join('\n');

    var p = 'Tu es le nutritionniste de cette personne. Propose exactement TROIS plats,'
      + ' un par macronutriment, à intégrer dans sa semaine.\n\n'
      + 'CIBLES PAR REPAS : ' + cbl.repas.p + ' g de protéines, ' + cbl.repas.g + ' g de glucides, '
      + cbl.repas.l + ' g de lipides, ' + cbl.repas.c + ' kcal.\n\n'
      + 'CE QUI MANQUE, ET QUAND :\n' + creux + '\n\n'
      + 'CONSEILS DE LA SEMAINE, déjà écrits pour elle :\n'
      + '- Protéines : ' + ((conseils && conseils.conseil_prot) || '—') + '\n'
      + '- Glucides : ' + ((conseils && conseils.conseil_gluc) || '—') + '\n'
      + '- Lipides : ' + ((conseils && conseils.conseil_lip) || '—') + '\n\n'
      + 'Chaque plat doit corriger SA macro sans faire exploser les deux autres,'
      + ' rester réalisable en moins de 30 minutes, et être courant en France.\n\n'
      + 'Réponds UNIQUEMENT par un objet JSON, sans texte autour :\n'
      + '{"repas":[{"macro":"p","nom":"Nom du plat","em":"🍗",'
      + '"pourquoi":"une phrase, adressée à la personne","p":45,"g":40,"l":12,"kcal":450,'
      + '"ingredients":[{"em":"🍗","nom":"Poulet","qte":"150 g"}]}]}\n'
      + 'Les macros sont des nombres en grammes pour UNE portion. L\'ordre : "p", puis "g", puis "l".';

    try {
      var r = await fetch(Natty.API + '/api/claude', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, max_tokens: 1400 })
      });
      if (!r.ok) throw new Error('http');
      var d = await r.json();
      var out = extraireJson(d.text);
      var liste = out && out.repas;
      if (!liste || !liste.length) throw new Error('vide');
      // On garantit l'ordre p/g/l : le placement s'y fie.
      return ['p', 'g', 'l'].map(function (m, k) {
        var t = liste.filter(function (x) { return x && x.macro === m; })[0] || liste[k];
        if (!t || !t.nom) return REPLI[k];
        return {
          macro: m, nom: t.nom, em: t.em || MACROS[m].em, pourquoi: t.pourquoi || '',
          p: +t.p || 0, g: +t.g || 0, l: +t.l || 0, kcal: +t.kcal || 0,
          ingredients: Array.isArray(t.ingredients) ? t.ingredients : []
        };
      });
    } catch (e) {
      return REPLI.slice();
    }
  }

  /* ═══ 5. Style ═══════════════════════════════════════════
     Noir plein pour la séquence — c'est ce qu'a demandé Pablo, et c'est aussi
     ce qui isole la planification du reste de l'app le temps qu'elle dure.
     Le vocabulaire est celui d'`assets/style.css` (Inter, métallisé, ressort
     `cubic-bezier(.22,1,.36,1)`), mais TOUT est redéclaré sous `#nplan` : ce
     module s'invite sur des écrans qui ont chacun leur feuille.
     ⚠️ Aucun effet de flou sur du texte — règle posée sur `narration.html`
     après essai : ça ne rend pas « clean ». */
  function css() {
    if (document.getElementById('nplan-css')) return;
    var s = document.createElement('style');
    s.id = 'nplan-css';
    s.textContent = [
      '#nplan{position:fixed;inset:0;z-index:99990;background:#000;color:#fff;',
      'font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;opacity:0;',
      'transition:opacity .5s ease;overflow:hidden;-webkit-font-smoothing:antialiased}',
      '#nplan.on{opacity:1}',
      '#nplan *{box-sizing:border-box}',

      /* Une scène = un plan. Elle occupe tout, elle défile si elle déborde, et
         elle réserve en bas la place de la barre d'action (fixe). */
      '#nplan .sc{position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;text-align:center;',
      'padding:calc(28px + env(safe-area-inset-top,0px)) 22px ',
      'calc(150px + env(safe-area-inset-bottom,0px));overflow-y:auto;',
      '-webkit-overflow-scrolling:touch}',
      '#nplan .sc.haut{justify-content:flex-start;padding-top:calc(52px + env(safe-area-inset-top,0px))}',
      '#nplan .sc.sortie{animation:nplOut .42s cubic-bezier(.4,0,1,1) forwards;pointer-events:none}',
      '@keyframes nplOut{to{opacity:0;transform:translateY(-14px) scale(.985)}}',

      /* Entrées — jamais de flou sur du texte. */
      '@keyframes nplGlide{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}',
      '@keyframes nplPara{from{opacity:0;transform:translateY(11px) scale(.972)}to{opacity:1;transform:none}}',
      '@keyframes nplReveal{from{opacity:0;clip-path:inset(0 0 100% 0)}to{opacity:1;clip-path:inset(0 0 0 0)}}',
      '@keyframes nplPop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}',
      '#nplan [data-in]{opacity:0;animation-duration:.72s;animation-timing-function:cubic-bezier(.22,1,.36,1);',
      'animation-fill-mode:forwards}',
      '#nplan [data-in="glide"]{animation-name:nplGlide}',
      '#nplan [data-in="para"]{animation-name:nplPara}',
      '#nplan [data-in="reveal"]{animation-name:nplReveal}',
      '#nplan [data-in="pop"]{animation-name:nplPop}',

      /* Titres. Le titre principal s'écrit mot à mot — c'est ce qui fait la
         différence entre « du texte qui apparaît » et une cinématique. */
      '#nplan h1{font-size:38px;font-weight:900;letter-spacing:-1.4px;line-height:1.08;',
      'max-width:400px}',
      '#nplan h1 span{display:inline-block;opacity:0;animation:nplGlide .68s cubic-bezier(.22,1,.36,1) forwards}',
      '#nplan h1 .gris{color:#6e6e78}',
      '#nplan h2{font-size:26px;font-weight:900;letter-spacing:-.7px;line-height:1.16;max-width:380px}',
      '#nplan .sous{font-size:14.5px;color:#8b8b95;line-height:1.55;max-width:330px;margin-top:14px}',
      '#nplan .kicker{font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;',
      'color:#5c5c66;margin-bottom:16px}',

      /* Illustrations : trait blanc qui se dessine. */
      '#nplan .illu{width:132px;height:132px;margin-bottom:30px;flex-shrink:0}',
      '#nplan .illu svg{width:100%;height:100%;fill:none;stroke:#fff;stroke-width:2.1;',
      'stroke-linecap:round;stroke-linejoin:round}',
      '#nplan .illu .trace{stroke-dasharray:520;stroke-dashoffset:520;',
      'animation:nplTrace 1.5s cubic-bezier(.22,1,.36,1) forwards}',
      '@keyframes nplTrace{to{stroke-dashoffset:0}}',
      '#nplan .illu .tard{animation-delay:.34s}',
      '#nplan .illu .plus-tard{animation-delay:.62s}',
      '#nplan .illu .respire{animation:nplRespire 4.6s ease-in-out infinite;transform-origin:60px 60px}',
      '@keyframes nplRespire{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}',
      /* ⚠️ `animation` est une propriété unique : la règle `.respire`, plus
         tardive, ÉCRASAIT `.trace` au lieu de s'y ajouter. Le trait restait
         donc à `stroke-dashoffset:520`, c'est-à-dire invisible — le disque du
         soleil, le bord de l'assiette et la vapeur de la cloche n'ont jamais
         été dessinés (constaté en navigateur). Les deux animations touchent des
         propriétés différentes (dashoffset / transform) : elles se déclarent
         ensemble, et la respiration démarre quand le tracé est fini. */
      '#nplan .illu .trace.respire{animation:nplTrace 1.5s cubic-bezier(.22,1,.36,1) forwards,',
      'nplRespire 4.6s ease-in-out 1.5s infinite}',
      /* Le décalage d'entrée est porté par `.tard`/`.plus-tard`, qui ne posent
         qu'`animation-delay` : la règle ci-dessus, en raccourci, le remettrait
         à zéro. On le redonne donc aux deux animations à la fois. */
      '#nplan .illu .trace.tard.respire{animation-delay:.34s,1.84s}',
      '#nplan .illu .trace.plus-tard.respire{animation-delay:.62s,2.12s}',

      /* Barre d'action — fixe, hors du plan animé.
         ⚠️ Leçon de `narration.html` : un bouton posé DANS la scène part avec
         son animation de sortie, et disparaît sous le doigt. */
      '#nplCta{position:absolute;left:0;right:0;bottom:0;z-index:6;',
      'padding:16px 22px calc(22px + env(safe-area-inset-bottom,0px));',
      'display:flex;flex-direction:column;gap:10px;align-items:stretch;',
      'background:linear-gradient(to top,#000 62%,rgba(0,0,0,0));pointer-events:none}',
      '#nplCta > *{pointer-events:auto}',
      '#nplan button{font-family:inherit;cursor:pointer;border:none;',
      '-webkit-tap-highlight-color:transparent;transition:transform .16s ease}',
      /* Les boutons arrivent APRÈS que le plan précédent se soit effacé. Sans
         ce retard ils apparaissaient d'un coup, à t=0, par-dessus une scène
         encore pleinement lisible : le seul endroit de la séquence où quelque
         chose « sautait » au lieu de glisser. */
      '#nplCta > *{animation:nplGlide .42s cubic-bezier(.22,1,.36,1) .3s backwards}',
      '#nplan button:active{transform:scale(.975)}',
      '#nplan .b1{background:#f2f2f5;color:#101014;border-radius:22px;padding:18px;',
      'font-size:16.5px;font-weight:800;letter-spacing:-.2px;',
      'box-shadow:0 10px 30px rgba(255,255,255,.10)}',
      '#nplan .b2{background:#17181c;color:#e9e9ee;border-radius:22px;padding:16px;',
      'font-size:15px;font-weight:700;',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 -1px 0 rgba(0,0,0,.7),0 8px 22px rgba(0,0,0,.6)}',
      '#nplan .b3{background:none;color:#7c7c86;padding:13px;font-size:14.5px;font-weight:600}',
      '#nplan .b1:disabled,#nplan .b2:disabled{opacity:.4;cursor:default}',

      /* Panneau noir métallisé — même recette que --metal-black. */
      '#nplan .panneau{width:100%;max-width:400px;border-radius:26px;padding:22px 18px;',
      'background:radial-gradient(130% 65% at 12% -10%,rgba(255,255,255,.11) 0%,rgba(255,255,255,0) 42%),',
      'linear-gradient(135deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 28%),',
      'linear-gradient(165deg,#111216 0%,#08090b 55%,#000 100%);',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.6),0 14px 34px rgba(0,0,0,.7)}',

      /* Les trois interrupteurs du questionnaire. */
      '#nplan .ligne{display:flex;align-items:center;justify-content:space-between;gap:14px;',
      'padding:15px 4px}',
      '#nplan .ligne + .ligne{border-top:1px solid rgba(255,255,255,.07)}',
      '#nplan .ligne .lbl{font-size:16px;font-weight:600;text-align:left;display:flex;',
      'align-items:center;gap:10px}',
      '#nplan .sw{width:54px;height:32px;border-radius:99px;background:#1c1d22;position:relative;',
      'flex-shrink:0;box-shadow:inset 2px 2px 6px rgba(0,0,0,.9),inset -1px -1px 3px rgba(255,255,255,.05);',
      'transition:background .26s ease}',
      '#nplan .sw i{position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;',
      'background:#55565e;transition:all .26s cubic-bezier(.22,1,.36,1)}',
      '#nplan .sw.on{background:#f2f2f5}',
      '#nplan .sw.on i{left:25px;background:#101014}',

      /* La grille 7 × 3 (mise au point fine). */
      '#nplan .grille{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;width:100%;',
      'max-width:400px;margin-top:6px}',
      '#nplan .gj{font-size:9.5px;font-weight:700;color:#6e6e78;text-align:center;',
      'padding-bottom:4px;letter-spacing:.2px}',
      '#nplan .gc{aspect-ratio:3/4;border-radius:12px;background:#0b0c0e;',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.10);cursor:pointer;',
      'transition:background .2s ease,box-shadow .2s ease,transform .16s ease;',
      'display:flex;align-items:center;justify-content:center;font-size:13px}',
      '#nplan .gc.on{background:#f4f4f7;box-shadow:0 4px 14px rgba(255,255,255,.14);color:#101014}',
      '#nplan .gc:active{transform:scale(.93)}',
      '#nplan .glig{display:flex;align-items:center;gap:8px;width:100%;max-width:400px;',
      'margin:16px 0 4px;font-size:11.5px;font-weight:700;color:#8b8b95;text-align:left}',

      /* L'attente de la planification. */
      '#nplan .barre{width:100%;max-width:300px;height:6px;border-radius:99px;background:#1a1b1f;',
      'overflow:hidden;margin-top:30px}',
      '#nplan .barre i{display:block;height:100%;width:0;border-radius:99px;background:#fff;',
      'transition:width .9s cubic-bezier(.22,1,.36,1)}',
      '#nplan .etape{font-size:13.5px;color:#8b8b95;margin-top:16px;min-height:20px;',
      'transition:opacity .35s ease}',
      '#nplan .etape.fade{opacity:0}',

      /* Le calendrier de la séquence. */
      '#nplan .cal{width:100%;max-width:400px;display:flex;flex-direction:column;gap:7px;margin-top:4px}',
      '#nplan .cj{display:grid;grid-template-columns:46px 1fr 1fr 1fr;gap:6px;align-items:stretch}',
      '#nplan .cj .nom{font-size:10.5px;font-weight:800;color:#6e6e78;display:flex;align-items:center;',
      'text-transform:uppercase;letter-spacing:.5px}',
      '#nplan .cj.auj .nom{color:#fff}',
      /* ⚠️ Hauteur FIXE, pas `aspect-ratio:1/1`. Une case carrée fait ici
         ~124 px de large : sept rangées poussaient « 5 repas planifiés sur 21 »
         — la phrase qui donne son sens à l'écran — à deux écrans de scroll du
         calendrier. Mesuré en navigateur. */
      '#nplan .cc{height:55px;border-radius:13px;background:#0a0b0d;',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.07);display:flex;align-items:center;',
      'justify-content:center;position:relative;overflow:hidden}',
      '#nplan .cc.vide{opacity:.5}',
      '#nplan .cc.vide::after{content:"";width:4px;height:4px;border-radius:50%;background:#2e2f36}',
      '#nplan .cc.plein{background:#141519;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}',
      '#nplan .cc .em{font-size:22px}',
      '#nplan .cc img{width:100%;height:100%;object-fit:cover}',
      '#nplan .cc.arrive{animation:nplPop .5s cubic-bezier(.22,1,.36,1) backwards}',
      '#nplan .cpt{font-size:15px;font-weight:800;margin-top:22px}',
      '#nplan .cpt b{color:#fff}',
      '#nplan .cpt span{color:#6e6e78;font-weight:600}',
      '#nplan .liste{width:100%;max-width:400px;margin-top:18px;display:flex;flex-direction:column;gap:8px}',
      '#nplan .li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;',
      'background:#0c0d10;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07);text-align:left}',
      '#nplan .li .v{width:38px;height:38px;border-radius:12px;background:#16171b;display:flex;',
      'align-items:center;justify-content:center;font-size:19px;flex-shrink:0;overflow:hidden}',
      '#nplan .li .v img{width:100%;height:100%;object-fit:cover}',
      '#nplan .li .t{font-size:13px;font-weight:700;line-height:1.3}',
      '#nplan .li .q{font-size:10.5px;color:#7c7c86;margin-top:3px}',

      /* La validation. */
      '#nplan .vok{width:118px;height:118px;margin-bottom:28px}',
      '#nplan .vok svg{width:100%;height:100%;fill:none;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}',
      '#nplan .vok .rond{stroke:#34c759;stroke-dasharray:264;stroke-dashoffset:264;',
      'animation:nplTrace .8s cubic-bezier(.22,1,.36,1) forwards}',
      '#nplan .vok .coche{stroke:#34c759;stroke-dasharray:70;stroke-dashoffset:70;',
      'animation:nplTrace .5s cubic-bezier(.22,1,.36,1) .55s forwards}',

      /* Petit mot de service (repli local, absence de conseils…). */
      '#nplan .note{font-size:11.5px;color:#5c5c66;line-height:1.5;max-width:320px;margin-top:18px}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══ 6. Le petit moteur de scènes ═══════════════════════ */

  var racine = null, cta = null, scEnCours = null, minuteur = null;

  function monter() {
    css();
    if (racine) return racine;
    racine = document.createElement('div');
    racine.id = 'nplan';
    racine.innerHTML = '<div id="nplCta"></div>';
    document.body.appendChild(racine);
    cta = racine.querySelector('#nplCta');
    // Le fond ne doit pas défiler derrière la séquence.
    scrollGele = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // rAF seule ne se déclenche pas si la page ne peint pas (onglet caché,
    // app en arrière-plan) : sans le minuteur, un calque noir opaque à 0
    // resterait en travers de l'écran. Même précaution que Natty.confirmer.
    requestAnimationFrame(function () { racine.classList.add('on'); });
    setTimeout(function () { if (racine) racine.classList.add('on'); }, 60);
    return racine;
  }

  function fermer() {
    ouvert = false;
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    if (!racine) return;
    var r = racine; racine = null; cta = null; scEnCours = null;
    r.classList.remove('on');
    document.body.style.overflow = scrollGele || '';
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 520);
  }

  /* Un titre qui s'écrit mot à mot. Les mots gris sont marqués `~`. */
  function titre(txt, balise, delai) {
    delai = delai == null ? 0 : delai;
    var mots = String(txt).split(' ').map(function (m, i) {
      var gris = m.charAt(0) === '~';
      return '<span class="' + (gris ? 'gris' : '') + '" style="animation-delay:'
        + (delai + i * 0.085).toFixed(3) + 's">' + esc(gris ? m.slice(1) : m) + '</span>';
    }).join(' ');
    return '<' + (balise || 'h1') + '>' + mots + '</' + (balise || 'h1') + '>';
  }

  /**
   * Affiche une scène.
   * @param {object} o  {html, haut:bool, boutons:[{txt,cls,on}], auto:ms, apres:fn}
   * `auto` fait avancer seul ; un bouton attend le clic. Jamais les deux :
   * une scène qui s'en va pendant qu'on lit son bouton est une scène ratée.
   */
  function scene(o) {
    monter();
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }

    var vieux = scEnCours;
    if (vieux) {
      vieux.classList.add('sortie');
      setTimeout(function () { if (vieux.parentNode) vieux.parentNode.removeChild(vieux); }, 460);
    }

    var d = document.createElement('div');
    d.className = 'sc' + (o.haut ? ' haut' : '');
    d.innerHTML = o.html || '';
    racine.insertBefore(d, cta);
    scEnCours = d;

    cta.innerHTML = '';
    (o.boutons || []).forEach(function (b) {
      var el = document.createElement('button');
      el.className = b.cls || 'b1';
      el.textContent = b.txt;
      if (b.id) el.id = b.id;
      el.addEventListener('click', function () { if (b.on) b.on(el); });
      cta.appendChild(el);
    });

    if (o.pret) o.pret(d);
    if (o.auto) minuteur = setTimeout(function () { minuteur = null; if (o.apres) o.apres(); }, o.auto);
    return d;
  }

  /* ═══ 6 bis. La vignette d'un repas ══════════════════════
     Photo si le repas en a une, emoji sinon — et emoji AUSSI si la photo
     n'arrive pas. Sans ce repli, une image manquante laisse l'icône cassée du
     navigateur au milieu du calendrier, c'est-à-dire au moment précis où l'on
     découvre sa semaine. */
  function vignette(r) {
    return r.photo
      ? '<img src="' + esc(r.photo) + '" alt="" data-em="' + esc(r.em || '🍽️') + '">'
      : (r.em || '🍽️');
  }

  function brancherVignettes(el) {
    if (!el) return;
    el.querySelectorAll('img[data-em]').forEach(function (im) {
      function replier() {
        if (!im.parentNode) return;
        var s = document.createElement('span');
        s.className = 'em';
        s.textContent = im.getAttribute('data-em');
        im.parentNode.replaceChild(s, im);
      }
      im.addEventListener('error', replier);
      // Une image insérée par innerHTML commence à charger tout de suite :
      // l'échec a pu avoir lieu AVANT qu'on écoute. `complete` sans largeur
      // naturelle, c'est exactement ce cas.
      if (im.complete && !im.naturalWidth) replier();
    });
  }

  /* ═══ 7. Illustrations ═══════════════════════════════════ */

  var SVG = {
    aube: '<svg viewBox="0 0 120 120">'
      + '<circle class="trace respire" cx="60" cy="64" r="19"/>'
      + '<path class="trace tard" d="M60 30V20M60 108v-6M89 64h10M21 64h10M81 43l7-7M32 92l7-7M81 85l7 7M32 36l7 7"/>'
      + '<path class="trace plus-tard" d="M14 100h92"/></svg>',
    cal: '<svg viewBox="0 0 120 120">'
      + '<rect class="trace" x="16" y="26" width="88" height="80" rx="15"/>'
      + '<path class="trace tard" d="M16 50h88M42 18v16M78 18v16"/>'
      + '<path class="trace plus-tard" d="M34 68h10M55 68h10M76 68h10M34 88h10M55 88h10"/></svg>',
    assiette: '<svg viewBox="0 0 120 120">'
      + '<circle class="trace respire" cx="60" cy="60" r="33"/>'
      + '<circle class="trace tard" cx="60" cy="60" r="19"/>'
      + '<path class="trace plus-tard" d="M16 34v30a6 6 0 0 0 6 6M104 34v30a6 6 0 0 1-6 6"/></svg>',
    grille: '<svg viewBox="0 0 120 120">'
      + '<rect class="trace" x="14" y="34" width="92" height="56" rx="12"/>'
      + '<path class="trace tard" d="M40 34v56M67 34v56M94 34v-0M14 62h92"/>'
      + '<path class="trace plus-tard" d="M20 47h13M47 75h13M74 47h13"/></svg>',
    analyse: '<svg viewBox="0 0 120 120">'
      + '<path class="trace" d="M20 96h82"/>'
      + '<rect class="trace tard" x="30" y="64" width="15" height="32" rx="5"/>'
      + '<rect class="trace tard" x="53" y="44" width="15" height="52" rx="5"/>'
      + '<rect class="trace plus-tard" x="76" y="74" width="15" height="22" rx="5"/>'
      + '<path class="trace plus-tard" d="M28 30l16 12 18-16 20 10"/></svg>',
    livraison: '<svg viewBox="0 0 120 120">'
      + '<path class="trace" d="M18 90h84"/>'
      + '<path class="trace tard" d="M30 90a30 30 0 0 1 60 0"/>'
      + '<circle class="trace tard" cx="60" cy="56" r="3.4"/>'
      + '<path class="trace plus-tard respire" d="M46 36c0-7 8-7 8-14M60 32c0-7 8-7 8-14M74 36c0-7 8-7 8-14"/></svg>',
    coche: '<svg viewBox="0 0 120 120"><circle class="rond" cx="60" cy="60" r="42"/>'
      + '<path class="coche" d="M41 61l13 14 26-30"/></svg>'
  };

  function illu(nom, cls) {
    return '<div class="illu ' + (cls || '') + '">' + SVG[nom] + '</div>';
  }

  /* ═══ 8. La séquence ═════════════════════════════════════ */

  var etat = null;   // {prenom, conseils, recettes, cibles, analyse, prepare, plan}

  async function prenom() {
    try {
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + Natty.USER_ID
        + '&select=prenom&order=created_at.desc&limit=5');
      var p = (r || []).map(function (x) { return (x.prenom || '').trim(); })
                       .filter(Boolean)[0];
      if (p) return p;
    } catch (e) {}
    var c = Natty.profil && Natty.profil();
    var m = c && (c.user_metadata || {});
    return (m && (m.prenom || m.first_name)) || '';
  }

  /* Scène 1 — Bonjour. */
  function scBonjour() {
    var p = etat.prenom;
    scene({
      html: illu('aube') + titre('Bonjour' + (p ? ' ~' + p : ''), 'h1', 0.35),
      auto: 2900,
      apres: scInvitation
    });
  }

  /* Scène 2 — l'invitation, avec sa sortie. */
  function scInvitation() {
    scene({
      html: illu('cal')
        + titre('Planifions ensemble votre semaine', 'h1', 0.2)
        + '<div class="sous" data-in="glide" style="animation-delay:.9s">'
        + 'Cinq repas placés là où vos apports flanchent, à partir de vos conseils de la semaine.</div>',
      boutons: [
        { txt: 'Démarrer', cls: 'b1', on: scQuestion },
        { txt: 'Ignorer cette semaine', cls: 'b3', on: function () { marquerVu(); fermer(); } }
      ]
    });
  }

  /* Scène 3 — les trois questions. « Personnaliser » ouvre la grille. */
  function scQuestion() {
    // Par défaut : on prépare midis et dîners, pas les petits déjeuners. C'est
    // le cas le plus courant, et c'est un point de départ, pas une réponse.
    if (!etat.global) etat.global = [false, true, true];
    scene({
      haut: true,
      html: '<div class="kicker" data-in="glide">Étape 1 sur 2</div>'
        + titre('Cette semaine, vous préparez vous-même :', 'h2', 0.1)
        + '<div class="panneau" data-in="para" style="animation-delay:.5s;margin-top:26px">'
        + CRENEAUX.map(function (c, i) {
            return '<div class="ligne"><div class="lbl">' + c.em + ' ' + esc(c.nom) + '</div>'
              + '<div class="sw' + (etat.global[i] ? ' on' : '') + '" data-i="' + i
              + '" role="switch" aria-checked="' + (etat.global[i] ? 'true' : 'false')
              + '" tabindex="0"><i></i></div></div>';
          }).join('')
        + '</div>'
        + '<div class="sous" data-in="glide" style="animation-delay:.8s">'
        + 'Nous ne planifions que ce que vous cuisinez. Le reste vous appartient.</div>',
      pret: function (d) {
        d.querySelectorAll('.sw').forEach(function (s) {
          s.addEventListener('click', function () {
            var i = +s.dataset.i;
            etat.global[i] = !etat.global[i];
            s.classList.toggle('on', etat.global[i]);
            s.setAttribute('aria-checked', etat.global[i] ? 'true' : 'false');
          });
        });
      },
      boutons: [
        { txt: 'Valider', cls: 'b1', on: function () {
            etat.prepare = [];
            for (var i = 0; i < 7; i++) etat.prepare.push(etat.global.map(function (v) { return v ? 1 : 0; }));
            lancerPlanification();
          } },
        { txt: 'Personnaliser jour par jour', cls: 'b2', on: scGrille }
      ]
    });
  }

  /* Scène 4 — la grille fine, 7 jours × 3 créneaux. */
  function scGrille() {
    if (!etat.prepare) {
      etat.prepare = [];
      for (var i = 0; i < 7; i++) etat.prepare.push(etat.global.map(function (v) { return v ? 1 : 0; }));
    }
    var html = '<div class="kicker" data-in="glide">Étape 2 sur 2</div>'
      + titre('Touchez les repas que vous préparez', 'h2', 0.1)
      + '<div class="sous" data-in="glide" style="animation-delay:.55s">'
      + 'Une case allumée, c’est un repas que nous pouvons planifier.</div>'
      + '<div style="height:26px"></div>';

    CRENEAUX.forEach(function (c, ci) {
      html += '<div class="glig" data-in="glide" style="animation-delay:' + (0.6 + ci * 0.1) + 's">'
        + c.em + ' ' + esc(c.nom) + '</div>'
        + '<div class="grille" data-in="para" style="animation-delay:' + (0.65 + ci * 0.1) + 's">'
        + (ci === 0 ? JOURS3.map(function (j) { return '<div class="gj">' + j + '</div>'; }).join('') : '')
        + etat.prepare.map(function (jour, ji) {
            return '<div class="gc' + (jour[ci] ? ' on' : '') + '" data-j="' + ji + '" data-c="' + ci
              + '" role="checkbox" aria-checked="' + (jour[ci] ? 'true' : 'false')
              + '" aria-label="' + esc(JOURS[ji] + ' — ' + c.nom) + '">'
              + (jour[ci] ? '✓' : '') + '</div>';
          }).join('')
        + '</div>';
    });

    scene({
      haut: true, html: html,
      pret: function (d) {
        d.querySelectorAll('.gc').forEach(function (el) {
          el.addEventListener('click', function () {
            var j = +el.dataset.j, c = +el.dataset.c;
            etat.prepare[j][c] = etat.prepare[j][c] ? 0 : 1;
            el.classList.toggle('on', !!etat.prepare[j][c]);
            el.textContent = etat.prepare[j][c] ? '✓' : '';
            el.setAttribute('aria-checked', etat.prepare[j][c] ? 'true' : 'false');
            majBoutonGrille();
          });
        });
        majBoutonGrille();
      },
      boutons: [{ txt: 'Planifier', cls: 'b1', id: 'nplGo', on: lancerPlanification }]
    });
  }

  function majBoutonGrille() {
    var b = document.getElementById('nplGo');
    if (!b) return;
    var n = 0;
    etat.prepare.forEach(function (j) { j.forEach(function (v) { if (v) n++; }); });
    b.disabled = n === 0;
    b.textContent = n === 0 ? 'Choisissez au moins un repas' : 'Planifier';
  }

  /* Scène 5 — la planification. Le texte nomme l'étape réellement en cours ;
     la barre suit le temps, mais n'atteint 100 % que quand le plan existe. */
  var ETAPES = [
    { t: 0,    em: '🍽️', txt: 'Relecture de vos quatre dernières semaines' },
    { t: 2600, em: '📊', txt: 'Repérage de vos creux, jour par jour' },
    { t: 6000, em: '🥩', txt: 'Composition de vos trois repas macro' },
    { t: 11000, em: '📅', txt: 'Placement dans votre semaine' }
  ];

  async function lancerPlanification() {
    var debut = Date.now(), fini = false, part = 0;

    scene({
      html: '<div class="illu"><div style="font-size:54px;line-height:132px" id="nplEm">🍽️</div></div>'
        + titre('Nous composons votre semaine', 'h2', 0.1)
        + '<div class="etape" id="nplEt">Relecture de vos quatre dernières semaines</div>'
        + '<div class="barre"><i id="nplBar"></i></div>'
        + '<div class="note" data-in="glide" style="animation-delay:1s">'
        + 'Le placement se fait à partir de vos repas enregistrés — pas d’un modèle moyen.</div>'
    });

    var courant = -1;
    var tic = setInterval(function () {
      if (fini) return;
      var e = Date.now() - debut, i = 0;
      for (var k = 0; k < ETAPES.length; k++) if (e >= ETAPES[k].t) i = k;
      var v = Math.min(94, Math.round(e / 15000 * 94));
      if (v > part) {
        part = v;
        var b = document.getElementById('nplBar');
        if (b) b.style.width = part + '%';
      }
      if (i === courant) return;
      courant = i;
      var t = document.getElementById('nplEt'), em = document.getElementById('nplEm');
      if (!t) return;
      t.classList.add('fade');
      setTimeout(function () {
        t.textContent = ETAPES[i].txt;
        if (em) em.textContent = ETAPES[i].em;
        t.classList.remove('fade');
      }, 340);
    }, 240);

    function stop() { clearInterval(tic); fini = true; }

    try {
      /* Les conseils de la semaine sont la matière première : sans eux, il n'y
         a ni recettes ni axes macro à placer. On les fait générer plutôt que de
         planifier dans le vide — `NattyGeneration` a son propre écran, on
         s'efface le temps qu'il passe. */
      var ligne = etat.conseils;
      if (!ligne && window.NattyGeneration) {
        if (racine) racine.style.opacity = '0';
        ligne = await NattyGeneration.lancer();
        if (racine) racine.style.opacity = '';
        etat.conseils = ligne;
      }
      if (ligne) etat.recettes = recettesDe(ligne);

      var cbl = await cibles();
      var analyse = await analyser(cbl);
      var plats = await platsMacro(etat.conseils, cbl, analyse);
      var repas = placer(analyse, etat.prepare, plats, etat.recettes || []);

      var plan = {
        semaine: lundi(),
        prepare: etat.prepare,
        repas: repas,
        cibles: cbl.repas,
        base_repas: analyse.nbRepas,
        cree_le: new Date().toISOString()
      };
      // On enregistre AVANT de montrer le calendrier : « Commander » quitte
      // l'app, et un plan composé puis perdu dans ce trajet serait le pire des
      // deux mondes.
      await enregistrer(plan);
      etat.plan = plan;

      var reste = Math.max(0, 1500 - (Date.now() - debut));
      setTimeout(function () {
        stop();
        var b = document.getElementById('nplBar');
        if (b) b.style.width = '100%';
        setTimeout(scCalendrier, 420);
      }, reste);
    } catch (e) {
      stop();
      scEchec(e);
    }
  }

  function recettesDe(ligne) {
    if (!ligne || !ligne.conseils_json) return [];
    var j = ligne.conseils_json;
    if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return []; } }
    return (j && j.recettes) || [];
  }

  function scEchec(e) {
    scene({
      html: '<div class="illu"><div style="font-size:54px;line-height:132px">😕</div></div>'
        + titre('La planification n’a pas abouti', 'h2', 0.1)
        + '<div class="sous" data-in="glide" style="animation-delay:.5s">'
        + 'Rien n’a été perdu. Vous pouvez réessayer depuis l’écran Repas.</div>',
      boutons: [
        { txt: 'Réessayer', cls: 'b1', on: lancerPlanification },
        { txt: 'Plus tard', cls: 'b3', on: function () { fermer(); } }
      ]
    });
  }

  /* Scène 6 — le calendrier. Les cases pleines arrivent une à une. */
  function scCalendrier() {
    var plan = etat.plan, n = plan.repas.length;
    var carte = {};
    plan.repas.forEach(function (r) { carte[r.jour + '-' + r.creneau] = r; });
    var auj = jourIndex(new Date());

    var html = '<div class="kicker" data-in="glide">Votre semaine</div>'
      + titre('Cinq repas, placés où ils comptent', 'h2', 0.05)
      + '<div style="height:24px"></div>'
      + '<div class="cal">'
      + '<div class="cj"><div class="nom"></div>'
      + CRENEAUX.map(function (c) {
          return '<div style="font-size:9.5px;font-weight:700;color:#5c5c66;text-transform:uppercase;'
            + 'letter-spacing:.6px;text-align:center">' + esc(c.court) + '</div>';
        }).join('') + '</div>';

    var k = 0;
    for (var i = 0; i < 7; i++) {
      html += '<div class="cj' + (i === auj ? ' auj' : '') + '"><div class="nom">' + JOURS3[i] + '</div>';
      for (var j = 0; j < 3; j++) {
        var r = carte[i + '-' + j];
        if (r) {
          k++;
          html += '<div class="cc plein arrive" style="animation-delay:' + (0.45 + k * 0.13) + 's">'
            + vignette(r) + '</div>';
        } else {
          html += '<div class="cc vide"></div>';
        }
      }
      html += '</div>';
    }
    html += '</div>'
      + '<div class="cpt" data-in="glide" style="animation-delay:' + (0.5 + k * 0.13) + 's">'
      + '<b>' + n + ' repas planifiés</b> <span>sur ' + TOTAL_CASES + '</span></div>'
      + '<div class="liste">'
      + plan.repas.map(function (r, idx) {
          return '<div class="li" data-in="glide" style="animation-delay:' + (0.7 + idx * 0.07) + 's">'
            + '<div class="v">' + vignette(r) + '</div>'
            + '<div><div class="t">' + esc(r.nom) + '</div>'
            + '<div class="q">' + JOURS[r.jour] + ' · ' + esc(CRENEAUX[r.creneau].nom)
            + (r.type === 'macro' ? ' · ' + MACROS[r.macro].em + ' ' + MACROS[r.macro].nom : ' · Recette de la semaine')
            + '</div></div></div>';
        }).join('')
      + '</div>'
      + (TABLE_OK === false
          ? '<div class="note">Ce planning est enregistré sur cet appareil. Il ne suivra pas encore vos autres téléphones.</div>'
          : '');

    scene({
      haut: true, html: html,
      pret: brancherVignettes,
      boutons: [
        { txt: 'Enrichir ma semaine', cls: 'b1', on: scEnrichir1 },
        { txt: 'C’est parfait comme ça', cls: 'b3', on: scValide }
      ]
    });
  }

  /* Scène 7 — l'enrichissement. Trois plans qui s'enchaînent seuls, puis le
     choix. Ce n'est pas une publicité collée à la fin : c'est la réponse à la
     question que le calendrier vient de poser — et les seize autres repas ? */
  function scEnrichir1() {
    var reste = TOTAL_CASES - etat.plan.repas.length;
    scene({
      html: illu('assiette')
        + titre('Et les ~' + reste + ' ~autres ?', 'h1', 0.15),
      auto: 2700, apres: scEnrichir2
    });
  }

  function scEnrichir2() {
    scene({
      html: illu('livraison')
        + titre('Des plats prêts, pensés pour vos objectifs', 'h2', 0.1)
        + '<div class="sous" data-in="glide" style="animation-delay:.85s">'
        + 'Composés sur vos macros, cuisinés par nos chefs, livrés chez vous.'
        + ' Ceux-là, vous n’avez qu’à les ouvrir.</div>',
      auto: 3400, apres: scEnrichir3
    });
  }

  function scEnrichir3() {
    scene({
      html: '<div class="kicker" data-in="glide">9 € le plat</div>'
        + titre('Le plaisir, sans le compromis', 'h2', 0.1)
        + '<div class="panneau" data-in="para" style="animation-delay:.55s;margin-top:24px">'
        + '<div class="ligne"><div class="lbl">🥗 3 ou 4 plats par semaine</div></div>'
        + '<div class="ligne"><div class="lbl">🧑‍🍳 Kit recettes inclus</div></div>'
        + '<div class="ligne"><div class="lbl">💬 Suivi nutritionniste offert</div></div>'
        + '</div>',
      boutons: [
        { txt: 'Commander', cls: 'b1', on: function () {
            // Le plan est déjà en base : quitter l'app ne perd rien.
            marquerVu();
            Natty.goto('offre.html');
          } },
        { txt: 'Passer', cls: 'b3', on: scValide }
      ]
    });
  }

  /* Scène 8 — la validation. */
  function scValide() {
    marquerVu();
    scene({
      html: '<div class="vok">' + SVG.coche + '</div>'
        + titre('Planification validée', 'h2', 0.55)
        + '<div class="sous" data-in="glide" style="animation-delay:1.1s">'
        + 'Retrouvez votre semaine dans « Ma semaine », sur l’écran Repas.</div>',
      auto: 2900,
      apres: function () {
        document.dispatchEvent(new CustomEvent('natty:planning-pret', { detail: etat.plan }));
        fermer();
      }
    });
  }

  /* ═══ 9. Entrées publiques ═══════════════════════════════ */

  function marquerVu() {
    try { localStorage.setItem(cle('vu'), lundi()); } catch (e) {}
  }
  function dejaVu() {
    try { return localStorage.getItem(cle('vu')) === lundi(); } catch (e) { return false; }
  }

  async function ouvrir(opts) {
    opts = opts || {};
    if (ouvert) return;
    if (!window.Natty || !Natty.USER_ID) return;
    ouvert = true;
    etat = { prenom: '', conseils: null, recettes: [], global: null, prepare: null, plan: null };
    monter();
    scene({ html: illu('aube'), auto: 60000 });     // le temps de charger le prénom
    etat.prenom = await prenom();
    try { etat.conseils = window.NattyGeneration ? await NattyGeneration.dejaPrete() : null; } catch (e) {}
    if (etat.conseils) etat.recettes = recettesDe(etat.conseils);
    if (opts.depuis === 'calendrier' && await lire()) { etat.plan = await lire(); }
    scBonjour();
  }

  /**
   * Le déclencheur automatique : première ouverture de la semaine, cinq
   * secondes après l'arrivée. Ne fait rien si la semaine est déjà planifiée,
   * déjà ignorée, ou si une génération est en cours (elle a son propre écran,
   * deux plein écran l'un sur l'autre ne se discutent pas).
   */
  function proposerSiNecessaire(delai) {
    if (!window.Natty || !Natty.USER_ID) return;
    if (dejaVu()) return;
    setTimeout(async function () {
      if (ouvert || dejaVu()) return;
      if (window.NattyGeneration && NattyGeneration.enCours()) return;
      if (document.getElementById('nattyAjout')) return;   // un plat est en cours d'ajout
      var plan = await lire();
      if (plan) { marquerVu(); return; }
      ouvrir();
    }, delai == null ? 5000 : delai);
  }

  /* ═══ 10. Le calendrier dans « Ma semaine » (écran Repas) ═
     Même plan, autre lumière : ici on est dans l'app claire, donc le
     vocabulaire d'`assets/style.css` (métallisé clair, neumorphisme). */
  function cssFiche() {
    if (document.getElementById('nplc-css')) return;
    var s = document.createElement('style');
    s.id = 'nplc-css';
    s.textContent = [
      '.nplc{background:var(--metal-white,#f4f5f7);border-radius:var(--r-lg,24px);',
      'box-shadow:var(--sh-metal-light,0 6px 16px rgba(20,20,30,.1));padding:18px 16px 16px;margin-top:18px}',
      '.nplc-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}',
      '.nplc-head .t{font-size:15.5px;font-weight:900;color:var(--ink,#101014)}',
      '.nplc-head .n{font-size:10.5px;font-weight:700;color:var(--muted,#9d9da8)}',
      '.nplc-cols{display:grid;grid-template-columns:40px 1fr 1fr 1fr;gap:6px;margin-bottom:6px}',
      '.nplc-cols div{font-size:8.5px;font-weight:800;color:var(--muted,#9d9da8);text-align:center;',
      'text-transform:uppercase;letter-spacing:.5px}',
      '.nplc-j{display:grid;grid-template-columns:40px 1fr 1fr 1fr;gap:6px;margin-bottom:6px;align-items:stretch}',
      '.nplc-j .nom{font-size:10px;font-weight:800;color:var(--muted,#9d9da8);display:flex;align-items:center;',
      'text-transform:uppercase;letter-spacing:.4px}',
      '.nplc-j.auj .nom{color:var(--ink,#101014)}',
      /* Même raison que `.cc` de la séquence : la semaine entière doit se lire
         sans faire défiler l'écran Repas jusqu'en bas. */
      '.nplc-c{height:54px;border-radius:13px;background:var(--card,#ececef);',
      'box-shadow:var(--nm-in,inset 3px 3px 7px rgba(163,167,176,.35));display:flex;align-items:center;',
      'justify-content:center;overflow:hidden;font-size:19px}',
      '.nplc-c.plein{background:#fff;box-shadow:0 5px 13px rgba(20,20,30,.13);cursor:pointer}',
      '.nplc-c img{width:100%;height:100%;object-fit:cover}',
      '.nplc-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}',
      '.nplc-cpt{font-size:12.5px;font-weight:800;color:var(--ink,#101014)}',
      '.nplc-cpt span{color:var(--muted,#9d9da8);font-weight:600}',
      '.nplc-btn{background:var(--ink,#101014);color:#fff;border:none;border-radius:99px;padding:10px 16px;',
      'font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}',
      '.nplc-vide{text-align:center;padding:6px 4px 2px}',
      '.nplc-vide .d{font-size:12.5px;color:var(--muted,#9d9da8);line-height:1.5;margin-bottom:14px}',
      '.nplc-vide button{width:100%;background:var(--ink,#101014);color:#fff;border:none;border-radius:16px;',
      'padding:14px;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }

  /** HTML du panneau « Ma semaine ». `plan` peut être null : on propose alors. */
  function fiche(plan) {
    cssFiche();
    if (!plan || !plan.repas || !plan.repas.length) {
      return '<div class="nplc"><div class="nplc-head"><div class="t">Ma semaine</div></div>'
        + '<div class="nplc-vide"><div class="d">Vos repas ne sont pas encore placés dans la semaine.'
        + ' La planification les répartit là où vos apports flanchent.</div>'
        + '<button data-nplc="ouvrir">📅 Planifier ma semaine</button></div></div>';
    }
    var carte = {}, auj = jourIndex(new Date());
    plan.repas.forEach(function (r) { carte[r.jour + '-' + r.creneau] = r; });

    var h = '<div class="nplc"><div class="nplc-head"><div class="t">Ma semaine</div>'
      + '<div class="n">' + plan.repas.length + ' repas placés</div></div>'
      + '<div class="nplc-cols"><div></div>'
      + CRENEAUX.map(function (c) { return '<div>' + esc(c.court) + '</div>'; }).join('')
      + '</div>';
    for (var i = 0; i < 7; i++) {
      h += '<div class="nplc-j' + (i === auj ? ' auj' : '') + '"><div class="nom">' + JOURS3[i] + '</div>';
      for (var j = 0; j < 3; j++) {
        var r = carte[i + '-' + j];
        h += r
          ? '<div class="nplc-c plein" data-nplc="repas" data-j="' + i + '" data-c="' + j + '" title="'
            + esc(r.nom) + '">' + vignette(r) + '</div>'
          : '<div class="nplc-c"></div>';
      }
      h += '</div>';
    }
    h += '<div class="nplc-foot"><div class="nplc-cpt">' + plan.repas.length
      + ' repas planifiés <span>sur ' + TOTAL_CASES + '</span></div>'
      + '<button class="nplc-btn" data-nplc="ouvrir">Replanifier</button></div></div>';
    return h;
  }

  /**
   * Rend le panneau dans un élément et branche ses gestes.
   * @param {HTMLElement} el
   * @param {function} onRepas  reçoit le repas cliqué (facultatif)
   */
  async function monterFiche(el, onRepas) {
    if (!el) return null;
    var plan = await lire();
    el.innerHTML = fiche(plan);
    brancherVignettes(el);
    el.querySelectorAll('[data-nplc="ouvrir"]').forEach(function (b) {
      b.addEventListener('click', function () { ouvrir({ forcer: true }); });
    });
    if (onRepas && plan) {
      el.querySelectorAll('[data-nplc="repas"]').forEach(function (c) {
        c.addEventListener('click', function () {
          var r = plan.repas.filter(function (x) {
            return x.jour === +c.dataset.j && x.creneau === +c.dataset.c;
          })[0];
          if (r) onRepas(r);
        });
      });
    }
    return plan;
  }

  /* ═══ 11. La fiche d'un repas placé ══════════════════════
     Un plat macro n'existe nulle part ailleurs dans l'app : il est né de la
     planification. Sans cet écran, taper sa case ne montrerait rien — ou pire,
     une recette voisine prise pour lui.
     Feuille du bas, dans la lumière de l'app (clair, neumorphique), et non
     dans le noir de la séquence : on est ici sur l'écran Repas, pas dans la
     cinématique. */
  function cssDetail() {
    if (document.getElementById('nplf-css')) return;
    var s = document.createElement('style');
    s.id = 'nplf-css';
    s.textContent = [
      '#nplf{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;',
      'justify-content:center;background:rgba(20,20,30,.42);opacity:0;',
      '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);',
      'transition:opacity .22s ease;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif}',
      '#nplf.on{opacity:1}',
      '#nplf .sh{width:100%;max-width:var(--col,480px);background:var(--bg,#fff);',
      'border-radius:28px 28px 0 0;padding:10px 20px calc(26px + env(safe-area-inset-bottom,0px));',
      'transform:translateY(24px);transition:transform .28s cubic-bezier(.22,1,.36,1);',
      'max-height:86vh;overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '#nplf.on .sh{transform:none}',
      '#nplf .poig{width:38px;height:4px;border-radius:99px;background:var(--card,#ececef);',
      'margin:0 auto 18px}',
      '#nplf .tete{display:flex;align-items:center;gap:14px}',
      '#nplf .vig{width:64px;height:64px;border-radius:20px;background:var(--card,#ececef);',
      'box-shadow:var(--nm-in,inset 4px 4px 9px rgba(163,167,176,.4));display:flex;',
      'align-items:center;justify-content:center;font-size:31px;flex-shrink:0;overflow:hidden}',
      '#nplf .vig img{width:100%;height:100%;object-fit:cover}',
      '#nplf .nom{font-size:18px;font-weight:900;line-height:1.2;color:var(--ink,#101014)}',
      '#nplf .quand{font-size:12px;font-weight:700;color:var(--muted,#9d9da8);margin-top:5px}',
      '#nplf .pq{font-size:13.5px;color:var(--muted,#9d9da8);line-height:1.6;margin-top:16px}',
      '#nplf .mac{display:flex;gap:8px;margin-top:16px}',
      '#nplf .mac div{flex:1;background:var(--card,#ececef);border-radius:16px;padding:10px 0;',
      'text-align:center;font-weight:800;font-size:13px;color:var(--ink,#101014);',
      'box-shadow:var(--nm-in,inset 4px 4px 9px rgba(163,167,176,.4))}',
      '#nplf .kcal{font-size:12px;font-weight:700;color:var(--muted,#9d9da8);',
      'text-align:center;margin-top:10px}',
      '#nplf .ing{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px}',
      // `> div` : sans le chevron, la règle attrapait aussi `.e`/`.n`/`.q` et
      // chaque ingrédient s'affichait en trois pastilles empilées.
      '#nplf .ing > div{background:var(--card,#ececef);border-radius:15px;padding:12px 4px 9px;',
      'text-align:center;box-shadow:var(--nm-in,inset 4px 4px 9px rgba(163,167,176,.4))}',
      '#nplf .ing .e{font-size:24px;line-height:1}',
      '#nplf .ing .n{font-size:8.5px;font-weight:700;line-height:1.2;margin-top:6px;color:var(--ink,#101014)}',
      '#nplf .ing .q{font-size:8px;color:var(--muted,#9d9da8);margin-top:2px}',
      '#nplf .ok{width:100%;margin-top:22px;padding:15px;border:none;border-radius:18px;',
      'background:var(--ink,#101014);color:#fff;font-family:inherit;font-size:14.5px;',
      'font-weight:800;cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }

  /** Ouvre la fiche d'un repas placé. @param {object} r une entrée de plan.repas */
  function detail(r) {
    if (!r) return;
    cssDetail();
    var vieux = document.getElementById('nplf');
    if (vieux && vieux.parentNode) vieux.parentNode.removeChild(vieux);

    var d = document.createElement('div');
    d.id = 'nplf';
    d.innerHTML = '<div class="sh"><div class="poig"></div>'
      + '<div class="tete"><div class="vig">' + vignette(r) + '</div>'
      + '<div><div class="nom">' + esc(r.nom) + '</div>'
      + '<div class="quand">' + esc(JOURS[r.jour]) + ' · ' + esc(CRENEAUX[r.creneau].nom)
      + (r.type === 'macro' && MACROS[r.macro]
          ? ' · ' + MACROS[r.macro].em + ' ' + MACROS[r.macro].nom
          : ' · Recette de la semaine')
      + '</div></div></div>'
      + (r.pourquoi ? '<div class="pq">' + esc(r.pourquoi) + '</div>' : '')
      + '<div class="mac"><div>🥩 ' + (r.p || '–') + 'g</div>'
      + '<div>🌾 ' + (r.g || '–') + 'g</div>'
      + '<div>🥑 ' + (r.l || '–') + 'g</div></div>'
      + (r.kcal ? '<div class="kcal">' + r.kcal + ' kcal</div>' : '')
      + ((r.ingredients && r.ingredients.length)
          ? '<div class="ing">' + r.ingredients.map(function (x) {
              return '<div><div class="e">' + esc(x.em || '🥄') + '</div>'
                + '<div class="n">' + esc(x.nom || '') + '</div>'
                + (x.qte ? '<div class="q">' + esc(x.qte) + '</div>' : '') + '</div>';
            }).join('') + '</div>'
          : '')
      + '<button class="ok" type="button">Fermer</button></div>';
    document.body.appendChild(d);
    brancherVignettes(d);

    function fermerFiche() {
      d.classList.remove('on');
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 300);
    }
    // Taper le fond ferme ; taper la feuille ne doit pas remonter jusqu'au fond.
    d.addEventListener('click', function (e) { if (e.target === d) fermerFiche(); });
    d.querySelector('.ok').addEventListener('click', fermerFiche);

    // Même précaution que Natty.confirmer : une classe posée par la seule rAF
    // ne se pose pas si la page ne peint pas, et la feuille resterait invisible
    // tout en interceptant les taps.
    requestAnimationFrame(function () { d.classList.add('on'); });
    setTimeout(function () { d.classList.add('on'); }, 60);
  }

  return {
    ouvrir: ouvrir,
    detail: detail,
    proposerSiNecessaire: proposerSiNecessaire,
    lire: lire,
    fiche: fiche,
    monterFiche: monterFiche,
    lundi: lundi,
    JOURS: JOURS, CRENEAUX: CRENEAUX,
    /** Le planning est-il synchronisé en base ? null tant qu'on n'a pas essayé. */
    estSynchronise: function () { return TABLE_OK; }
  };
})();
