/* ═══════════════════════════════════════════════════════════
   Natty — Fil social (couche données)
   Alimente social.html : plats publiés par les autres membres,
   tendances, meilleurs scores nutritionnels et profils proches.

   Le rendu vit dans social.html ; ici on ne fait que rassembler
   et classer les données. Dépend de assets/core.js.

   ⚠️ Plusieurs tables sont optionnelles (`meal_likes`, `meal_vues`,
   `membre_amis`, `membre_prefs`). Tant qu'elles n'existent pas, le
   module bascule seul sur localStorage : le fil reste utilisable,
   mais likes, vues et abonnements sont propres à l'appareil.
   `membre_prefs` fait exception — c'est un réglage de confidentialité,
   il n'a aucun repli local (voir estPrefsDispo()). SQL : natty_social.sql.
   ═══════════════════════════════════════════════════════════ */
var NattySocial = (function () {

  /* ── État ── */
  var PLATS = [];        // plats des autres membres, enrichis (macros, score, auteur)
  var AUTEURS = {};      // user_id → { prenom, cibles }
  var MOI = null;        // cibles quotidiennes de l'utilisateur courant
  var LIKES = {};        // meal_id → { n, moi }
  var VUES = {};         // meal_id → n
  var AMIS = {};         // ami_id → true (membres que l'on suit)
  var PREFS = {};        // user_id → false si le membre s'est retiré du fil
  var BLOQUES = {};      // user_id → true (membres masqués, guideline 1.2)
  var SIGNALES = {};     // meal_id → true (plats que J'AI signalés)
  var supportLikes = null;   // 'table' | 'local' — résolu au premier chargement
  var supportVues = null;
  var supportAmis = null;
  var supportPrefs = null;   // 'table' | 'absent'
  var supportPartage = null; // la colonne meals.partage existe-t-elle ?
  var supportBloques = null; // 'table' | 'local'
  var supportSignal = null;  // 'table' | 'email' — repli si natty_moderation.sql
                             // n'a pas été exécuté

  /* Les comptes techniques ne doivent pas apparaître dans le fil. */
  var EXCLUS = { 'PLACEHOLDER': 1, 'anonymous': 1, 'null': 1, '': 1 };

  /* ── Divers ── */

  function lsKey(suffixe) { return 'natty_social_' + suffixe + '_' + (Natty.USER_ID || 'anon'); }

  function lireLocal(cle) {
    try { return JSON.parse(localStorage.getItem(lsKey(cle)) || '[]'); } catch (e) { return []; }
  }
  function ecrireLocal(cle, arr) {
    try { localStorage.setItem(lsKey(cle), JSON.stringify(arr)); } catch (e) {}
  }

  /* PostgREST plafonne la longueur d'URL : on interroge par paquets. */
  function paquets(arr, taille) {
    var out = [];
    for (var i = 0; i < arr.length; i += taille) out.push(arr.slice(i, i + taille));
    return out;
  }

  async function enLots(table, colonne, ids, select) {
    var out = [];
    var lots = paquets(ids, 50);
    for (var i = 0; i < lots.length; i++) {
      var r = await Natty.sbFetch(table + '?' + colonne + '=in.(' + lots[i].join(',') + ')&select=' + select);
      out = out.concat(r || []);
    }
    return out;
  }

  /* Profil public des AUTRES membres — prénom et besoins, rien de plus.
     La RLS filtre des lignes, pas des colonnes : laisser un membre lire la
     ligne `onboarding` d'un autre pour son prénom lui donnerait du même coup
     son email, son âge et son poids. La vue `membre_public` (natty_rls.sql)
     n'expose que le nécessaire et écarte déjà ceux qui se sont retirés du fil.
     Tant qu'elle n'existe pas en base, on retombe sur les deux tables — ce qui
     reste le fonctionnement d'aujourd'hui, RLS désactivées. */
  var vueDispo = null;

  async function profilsPublics(users) {
    if (vueDispo !== false) {
      try {
        var v = await enLots('membre_public', 'user_id', users, 'user_id,prenom,poids,tdee,nb_repas');
        vueDispo = true;
        return { profils: v, repas: v };
      } catch (e) { vueDispo = false; }
    }
    var r = await Promise.all([
      enLots('onboarding', 'user_id', users, 'user_id,prenom,poids,tdee')
        .then(function (x) { return x; }, function () { return []; }),
      enLots('questionnaire_alim', 'user_id', users, 'user_id,nb_repas')
        .then(function (x) { return x; }, function () { return []; })
    ]);
    return { profils: r[0], repas: r[1] };
  }

  // Les en-têtes viennent de core.js : fabriquées ici, elles porteraient la
  // clé anon et non le JWT de l'utilisateur — donc un retrait de j'aime ou
  // d'abonnement serait refusé par les policies une fois les RLS actives.
  async function sbDelete(path) {
    var r = await fetch(Natty.SB_URL + '/rest/v1/' + path, {
      method: 'DELETE',
      headers: await Natty.entetes({ Prefer: 'return=minimal' })
    });
    if (!r.ok) throw new Error(await r.text());
  }

  /* ── Cibles macro ──────────────────────────────────────────
     Même dérivation que suivi.html / assets/ajout.js : la table
     `onboarding` ne stocke ni les macros ni le nombre de repas,
     seulement `poids` et `tdee`. Le nombre de repas par jour vit
     dans questionnaire_alim.nb_repas, sous forme de libellé. */
  var REPAS_PAR_JOUR = { '1_2': 2, '3': 3, '3_collations': 4, 'grignotage': 4 };

  function ciblesJour(onb) {
    var poids = parseFloat(onb && onb.poids) || 0;
    var tdee = parseFloat(onb && onb.tdee) || 0;
    if (!tdee) return null;
    return {
      p: poids ? Math.round(poids * 2) : Math.round(tdee * 0.3 / 4),
      l: Math.round(tdee * 0.25 / 9),
      g: Math.round(tdee * 0.5 / 4),
      c: Math.round(tdee)
    };
  }

  function ciblesRepas(jour, nbRepasLabel) {
    if (!jour) return null;
    var n = REPAS_PAR_JOUR[nbRepasLabel] || 3;
    return {
      p: Math.round(jour.p / n), l: Math.round(jour.l / n),
      g: Math.round(jour.g / n), c: Math.round(jour.c / n), n: n
    };
  }

  /* ── Score nutritionnel d'un plat ──────────────────────────
     « Le plat colle-t-il aux besoins de CELUI QUI L'A POSTÉ ? »
     On compare les macros du plat à sa cible par repas. Dépasser
     coûte un peu plus cher que manquer : un plat à 2× la cible
     déséquilibre davantage la journée qu'un plat léger. */
  function scoreDe(mac, cible) {
    if (!cible || !cible.c || !mac || !mac.c) return null;
    var couples = [[mac.p, cible.p], [mac.g, cible.g], [mac.l, cible.l], [mac.c, cible.c]];
    var somme = 0, n = 0;
    couples.forEach(function (co) {
      var v = co[0], t = co[1];
      if (!t) return;
      var ecart = Math.abs(v / t - 1);
      if (v > t) ecart *= 1.25;
      somme += Math.min(ecart, 1);
      n++;
    });
    if (!n) return null;
    return Math.max(0, Math.min(100, Math.round(100 - (somme / n) * 100)));
  }

  /* Proximité de profil : deux membres se ressemblent si leurs besoins
     quotidiens en énergie ET en protéines sont proches. 1 = identique. */
  function proximite(a, b) {
    if (!a || !b || !a.c || !b.c || !a.p || !b.p) return 0;
    var dc = Math.abs(a.c - b.c) / a.c;
    var dp = Math.abs(a.p - b.p) / a.p;
    return Math.max(0, 1 - (dc + dp) / 2);
  }

  /* ── Emoji de repli quand le plat n'a pas de photo ── */
  var EMOJIS_PLAT = [
    [/salade|crudite|crudité/, '🥗'], [/burger|sandwich|wrap/, '🍔'], [/pizza/, '🍕'],
    [/pate|pâte|spaghetti|lasagne|carbonara/, '🍝'], [/riz|risotto|paella/, '🍚'],
    [/sushi|maki|poke|poké/, '🍣'], [/soupe|veloute|velouté|potage/, '🥣'],
    [/poulet|volaille|dinde/, '🍗'], [/boeuf|steak|bavette|chili|burg/, '🥩'],
    [/poisson|saumon|thon|cabillaud|crevette/, '🐟'], [/oeuf|œuf|omelette/, '🍳'],
    [/curry|tajine|couscous|dahl|dhal/, '🍛'], [/tacos|fajita|burrito/, '🌮'],
    [/pancake|crepe|crêpe|gaufre/, '🥞'], [/gateau|gâteau|dessert|tarte|cookie/, '🍰'],
    [/yaourt|fromage blanc|skyr|porridge|smoothie|bowl/, '🥣'],
    [/pain|toast|tartine|bagel/, '🥪'], [/frite|patate|pomme de terre/, '🍟'],
    [/legume|légume|brocoli|courgette/, '🥦'], [/fruit|pomme|banane/, '🍎']
  ];
  function emojiPlat(nom) {
    var n = (nom || '').toLowerCase();
    for (var i = 0; i < EMOJIS_PLAT.length; i++) if (EMOJIS_PLAT[i][0].test(n)) return EMOJIS_PLAT[i][1];
    return '🍽️';
  }

  /* ── Chargement ──────────────────────────────────────────── */

  async function chargerPlats(filtre, limite) {
    // La colonne `partage` permet de retirer UN plat du fil (le réglage
    // global, lui, vit dans membre_prefs). Elle n'existe pas forcément :
    // sans elle on charge sans filtre, car une colonne absente ferait
    // échouer TOUTE la requête (cf. CLAUDE.md §7).
    var base = 'meals?' + filtre
      + '&order=created_at.desc&limit=' + limite
      + '&select=id,user_id,name,photo_url,meal_date,meal_type,created_at';
    if (supportPartage !== false) {
      try {
        var avec = await Natty.sbFetch(base + ',partage&or=(partage.is.null,partage.eq.true)');
        supportPartage = true;
        return avec || [];
      } catch (e) { supportPartage = false; }
    }
    return (await Natty.sbFetch(base)) || [];
  }

  /* ── Amis (abonnements) ──────────────────────────────────────
     Modèle « je suis quelqu'un », sans demande ni acceptation :
     pas de canal de notification dans l'app pour porter une file
     de demandes en attente, et le fil doit se remplir tout de suite. */
  async function chargerAmis() {
    AMIS = {};
    if (!Natty.USER_ID) return;
    if (supportAmis !== 'local') {
      try {
        var rows = await Natty.sbFetch('membre_amis?user_id=eq.' + Natty.USER_ID + '&select=ami_id');
        supportAmis = 'table';
        (rows || []).forEach(function (r) { AMIS[r.ami_id] = true; });
        return;
      } catch (e) { supportAmis = 'local'; }
    }
    lireLocal('amis').forEach(function (id) { AMIS[id] = true; });
  }

  /* ── Modération (App Store Review Guideline 1.2) ──────────────
     Le fil montre les photos et les prénoms d'autres personnes :
     Apple exige alors de pouvoir SIGNALER un contenu et MASQUER
     un membre. Les deux vivent ici, avec le même repli local que
     les abonnements — sauf que le repli du signalement n'est pas
     un stockage mais un email, parce qu'un signalement qui reste
     sur l'appareil de celui qui signale ne signale rien. */
  async function chargerBloques() {
    BLOQUES = {};
    if (!Natty.USER_ID) return;
    if (supportBloques !== 'local') {
      try {
        var rows = await Natty.sbFetch('membre_bloques?user_id=eq.' + Natty.USER_ID + '&select=bloque_id');
        supportBloques = 'table';
        (rows || []).forEach(function (r) { BLOQUES[r.bloque_id] = true; });
        return;
      } catch (e) { supportBloques = 'local'; }
    }
    lireLocal('bloques').forEach(function (id) { BLOQUES[id] = true; });
  }

  /* Mes propres signalements, et eux seuls : la policy ne rend que les lignes
     dont je suis l'auteur. C'est ce qui permet d'écrire « Déjà signalé » sans
     jamais révéler qui d'autre a signalé quoi. */
  async function chargerMesSignalements() {
    SIGNALES = {};
    if (!Natty.USER_ID) return;
    try {
      var rows = await Natty.sbFetch('signalements?signaleur_id=eq.' + Natty.USER_ID + '&select=meal_id');
      supportSignal = 'table';
      (rows || []).forEach(function (r) { SIGNALES[r.meal_id] = true; });
    } catch (e) {
      supportSignal = 'email';
      lireLocal('signales').forEach(function (id) { SIGNALES[id] = true; });
    }
  }

  /* ── Confidentialité ─────────────────────────────────────────
     Un membre peut retirer TOUS ses plats du fil. Volontairement
     sans repli localStorage : un réglage de confidentialité qui
     n'aurait d'effet que sur l'appareil de son auteur serait un
     mensonge. Sans la table, on l'annonce et on n'affiche pas
     l'interrupteur (voir estPrefsDispo). */
  async function chargerPrefs(users) {
    PREFS = {};
    if (supportPrefs === 'absent') return;
    try {
      var rows = await enLots('membre_prefs', 'user_id', users, 'user_id,fil_public');
      supportPrefs = 'table';
      rows.forEach(function (r) { PREFS[r.user_id] = r.fil_public !== false; });
    } catch (e) { supportPrefs = 'absent'; }
  }

  async function chargerLikes(ids) {
    if (supportLikes === 'local') return;
    try {
      var rows = await enLots('meal_likes', 'meal_id', ids, 'meal_id,user_id');
      supportLikes = 'table';
      rows.forEach(function (r) {
        if (!LIKES[r.meal_id]) LIKES[r.meal_id] = { n: 0, moi: false };
        LIKES[r.meal_id].n++;
        if (r.user_id === Natty.USER_ID) LIKES[r.meal_id].moi = true;
      });
    } catch (e) {
      supportLikes = 'local';
      lireLocal('likes').forEach(function (id) { LIKES[id] = { n: 1, moi: true }; });
    }
  }

  async function chargerVues(ids) {
    if (supportVues === 'local') return;
    try {
      var rows = await enLots('meal_vues', 'meal_id', ids, 'meal_id');
      supportVues = 'table';
      rows.forEach(function (r) { VUES[r.meal_id] = (VUES[r.meal_id] || 0) + 1; });
    } catch (e) {
      supportVues = 'local';
      lireLocal('vues').forEach(function (id) { VUES[id] = (VUES[id] || 0) + 1; });
    }
  }

  async function charger() {
    PLATS = []; AUTEURS = {}; LIKES = {}; VUES = {};

    // Les masqués sont connus AVANT le fil : c'est ce qui décide de ce qu'on
    // affiche. Les trois lectures sont indépendantes, donc en parallèle.
    await Promise.all([chargerAmis(), chargerBloques(), chargerMesSignalements()]);
    var meals = await chargerPlats('user_id=neq.' + Natty.USER_ID, 150);

    // Les 150 plats les plus récents ne contiennent pas forcément ceux des
    // membres suivis : on va les chercher explicitement, sinon la section
    // « Vos amis » resterait vide alors qu'on suit quelqu'un.
    var idsAmis = Object.keys(AMIS);
    if (idsAmis.length) {
      try {
        var lots = paquets(idsAmis, 50), sup = [];
        for (var i = 0; i < lots.length; i++) {
          sup = sup.concat(await chargerPlats('user_id=in.(' + lots[i].join(',') + ')', 60));
        }
        var connus = {};
        meals.forEach(function (m) { connus[m.id] = true; });
        sup.forEach(function (m) { if (!connus[m.id]) { connus[m.id] = true; meals.push(m); } });
      } catch (e) { /* le fil général suffit */ }
    }

    meals = meals.filter(function (m) { return m.user_id && !EXCLUS[m.user_id]; });
    if (!meals.length) return vues();

    var users = [];
    meals.forEach(function (m) { if (users.indexOf(m.user_id) < 0) users.push(m.user_id); });
    if (Natty.USER_ID && users.indexOf(Natty.USER_ID) < 0) users.push(Natty.USER_ID);

    // Les membres retirés du fil sortent avant tout le reste : inutile de
    // charger les ingrédients et les likes de plats qu'on n'affichera pas.
    await chargerPrefs(users);
    meals = meals.filter(function (m) { return PREFS[m.user_id] !== false; });
    if (!meals.length) return vues();
    users = users.filter(function (u) { return PREFS[u] !== false || u === Natty.USER_ID; });

    var ids = meals.map(function (m) { return m.id; });
    var ingrs = [], onbs = [], qals = [];
    await Promise.all([
      enLots('meal_ingredients', 'meal_id', ids, 'meal_id,name,quantity_g')
        .then(function (r) { ingrs = r; }, function () { ingrs = []; }),
      profilsPublics(users)
        .then(function (r) { onbs = r.profils; qals = r.repas; },
              function () { onbs = []; qals = []; }),
      chargerLikes(ids),
      chargerVues(ids)
    ]);

    // Un membre peut avoir plusieurs lignes d'onboarding : on garde la plus
    // complète (celle qui porte un TDEE, sinon la première).
    var parUser = {};
    onbs.forEach(function (o) {
      var p = parUser[o.user_id];
      if (!p || (!p.tdee && o.tdee)) parUser[o.user_id] = o;
    });
    var nbRepas = {};
    qals.forEach(function (q) { if (!nbRepas[q.user_id]) nbRepas[q.user_id] = q.nb_repas; });

    var nbPlats = {};
    meals.forEach(function (m) { nbPlats[m.user_id] = (nbPlats[m.user_id] || 0) + 1; });

    users.forEach(function (u) {
      var onb = parUser[u] || {};
      var jour = ciblesJour(onb);
      var prenom = (onb.prenom || '').trim();
      AUTEURS[u] = {
        user_id: u,
        // Sans prénom renseigné, un pseudo stable tiré de l'identifiant :
        // « Membre Natty » partout rendait trois personnes différentes
        // indiscernables dans une même section.
        prenom: prenom || ('Membre ' + String(u).slice(0, 4).toUpperCase()),
        anonyme: !prenom,
        jour: jour,
        repas: ciblesRepas(jour, nbRepas[u]),
        nbPlats: nbPlats[u] || 0
      };
    });
    MOI = Natty.USER_ID ? AUTEURS[Natty.USER_ID] : null;
    // La proximité de profil ne se calcule qu'une fois les cibles connues.
    Object.keys(AUTEURS).forEach(function (u) {
      AUTEURS[u].proximite = MOI ? proximite(MOI.jour, AUTEURS[u].jour) : 0;
    });

    var parRepas = {};
    ingrs.forEach(function (i) {
      (parRepas[i.meal_id] = parRepas[i.meal_id] || []).push(i);
    });

    /* Les membres masqués sortent du fil ICI, et pas plus haut : c'est le seul
       point qui couvre les cinq sections d'un coup, puisqu'elles dérivent
       toutes de PLATS. Plus haut, on perdrait aussi leur prénom — AUTEURS et
       nbPlats sont déjà calculés — et l'annuaire ne pourrait plus proposer de
       les réafficher. Un masquage irréversible serait un piège, pas une
       protection. */
    meals = meals.filter(function (m) { return !BLOQUES[m.user_id]; });

    PLATS = meals.map(function (m) {
      var ings = parRepas[m.id] || [];
      var mac = Natty.calcMac(ings);
      var auteur = AUTEURS[m.user_id];
      return {
        id: m.id,
        user_id: m.user_id,
        nom: m.name || 'Plat',
        photo: m.photo_url || '',
        emoji: emojiPlat(m.name),
        date: m.meal_date || (m.created_at || '').slice(0, 10),
        cree: m.created_at,
        type: m.meal_type || '',
        ingredients: ings,
        macros: mac,
        auteur: auteur,
        score: scoreDe(mac, auteur && auteur.repas),
        proximite: MOI ? proximite(MOI.jour, auteur && auteur.jour) : 0
      };
    });

    return vues();
  }

  /* ── Sections du fil ─────────────────────────────────────── */

  function popularite(p) {
    var l = LIKES[p.id] ? LIKES[p.id].n : 0;
    var v = VUES[p.id] || 0;
    // Un like vaut plus qu'une vue : c'est un geste, pas un passage.
    return l * 5 + v;
  }

  function vues() {
    var avecPhoto = PLATS.filter(function (p) { return !!p.photo; });
    var pool = avecPhoto.length >= 4 ? avecPhoto : PLATS;

    var tendances = pool.slice().sort(function (a, b) {
      var d = popularite(b) - popularite(a);
      if (d) return d;
      return new Date(b.cree || 0) - new Date(a.cree || 0);
    }).slice(0, 7);

    var vedette = tendances[0] || null;
    var reste = function (arr) {
      return arr.filter(function (p) { return !vedette || p.id !== vedette.id; });
    };

    // Deux plats par membre : sans ce plafond, le membre le plus assidu
    // occupe tout le fil et on ne découvre personne.
    var vusComm = {};
    var recents = reste(PLATS.slice().sort(function (a, b) {
      return new Date(b.cree || 0) - new Date(a.cree || 0);
    })).filter(function (p) {
      vusComm[p.user_id] = (vusComm[p.user_id] || 0) + 1;
      return vusComm[p.user_id] <= 2;
    }).slice(0, 12);

    var top = reste(PLATS.filter(function (p) { return p.score !== null; })
      .sort(function (a, b) { return b.score - a.score; })).slice(0, 8);

    // Profils proches : même besoin quotidien à ~15 % près. Sans onboarding
    // exploitable de notre côté, la section n'a pas de sens — on la vide.
    // Deux plats par membre au maximum : la section sert à découvrir des
    // gens, pas à dérouler le journal du plus prolifique d'entre eux.
    var similaires = [];
    if (MOI && MOI.jour) {
      var vusParAuteur = {};
      similaires = reste(PLATS.filter(function (p) {
        return p.proximite >= 0.85 && p.auteur && p.auteur.jour;
      }).sort(function (a, b) {
        if (Math.abs(b.proximite - a.proximite) > 0.01) return b.proximite - a.proximite;
        return new Date(b.cree || 0) - new Date(a.cree || 0);
      })).filter(function (p) {
        vusParAuteur[p.user_id] = (vusParAuteur[p.user_id] || 0) + 1;
        return vusParAuteur[p.user_id] <= 2;
      }).slice(0, 8);
    }

    // Vos amis : tout ce qu'ont publié les membres suivis, du plus récent au
    // plus ancien. Pas de plafond par membre ici — c'est précisément le fil
    // qu'on a choisi de suivre. La vedette n'en est pas retirée non plus.
    var amis = PLATS.filter(function (p) { return AMIS[p.user_id]; })
      .sort(function (a, b) { return new Date(b.cree || 0) - new Date(a.cree || 0); })
      .slice(0, 12);

    return {
      vedette: vedette,
      tendances: tendances.slice(1, 5),
      amis: amis,
      recents: recents,
      top: top,
      similaires: similaires,
      suggestions: membres().filter(function (m) { return !m.ami; }).slice(0, 6),
      nbAmis: Object.keys(AMIS).length,
      moi: MOI,
      total: PLATS.length
    };
  }

  /* Annuaire des membres visibles dans le fil : ceux qu'on suit d'abord,
     puis les profils les plus proches du nôtre. */
  /* Les plats d'UN membre, du plus récent au plus ancien. Sert à la page de
     profil ouverte depuis un nom ou une photo dans le fil : `PLATS` contient
     déjà tout ce qu'il faut (macros recalculées, score, auteur), inutile de
     retourner en base. */
  function platsDeMembre(userId) {
    if (!userId) return [];
    return PLATS.filter(function (p) { return p.user_id === userId; })
      .sort(function (a, b) { return new Date(b.cree || 0) - new Date(a.cree || 0); });
  }

  function membres() {
    return Object.keys(AUTEURS)
      // Un membre masqué reste listé, MÊME sans plat visible : c'est le seul
      // endroit de l'app d'où l'on peut le réafficher.
      .filter(function (u) {
        return u !== Natty.USER_ID && (AUTEURS[u].nbPlats > 0 || BLOQUES[u]);
      })
      .map(function (u) {
        var a = AUTEURS[u];
        return {
          user_id: u, prenom: a.prenom, anonyme: a.anonyme,
          nbPlats: a.nbPlats, jour: a.jour,
          proximite: a.proximite || 0, ami: !!AMIS[u], bloque: !!BLOQUES[u]
        };
      })
      .sort(function (a, b) {
        // Les masqués en dernier : on ne vient pas dans l'annuaire pour eux.
        if (a.bloque !== b.bloque) return a.bloque ? 1 : -1;
        if (a.ami !== b.ami) return a.ami ? -1 : 1;
        if (Math.abs(b.proximite - a.proximite) > 0.01) return b.proximite - a.proximite;
        return b.nbPlats - a.nbPlats;
      });
  }

  /* ── Suivre / ne plus suivre ─────────────────────────────── */

  function estAmi(userId) { return !!AMIS[userId]; }

  function basculerAmi(userId) {
    if (!userId || userId === Natty.USER_ID) return false;
    var suit = !AMIS[userId];
    if (suit) AMIS[userId] = true; else delete AMIS[userId];

    if (supportAmis === 'table' && Natty.USER_ID) {
      var p = suit
        ? Natty.sbPost('membre_amis?on_conflict=user_id,ami_id', { user_id: Natty.USER_ID, ami_id: userId },
            'return=minimal,resolution=ignore-duplicates')
        : sbDelete('membre_amis?user_id=eq.' + Natty.USER_ID + '&ami_id=eq.' + userId);
      p.catch(function () { if (suit) delete AMIS[userId]; else AMIS[userId] = true; });
    } else {
      ecrireLocal('amis', Object.keys(AMIS));
    }
    return suit;
  }

  /* ── Masquer un membre, signaler un plat ─────────────────────
     Guideline 1.2. Volontairement DEUX gestes distincts et non un
     seul : masquer est un geste de tranquillité, immédiat et sans
     conséquence pour l'autre ; signaler est une alerte adressée à
     l'équipe. Les confondre ferait hésiter à faire l'un des deux. */

  /* Les motifs sont une liste FERMÉE, reprise à l'identique par la contrainte
     `check` de natty_moderation.sql : un motif inventé côté écran ferait
     échouer l'insertion, et l'utilisateur croirait avoir signalé. */
  var MOTIFS = [
    { cle: 'inapproprie', txt: 'Contenu inapproprié ou choquant' },
    { cle: 'personne',    txt: 'Une personne identifiable sans son accord' },
    { cle: 'trompeur',    txt: 'Information nutritionnelle trompeuse' },
    { cle: 'spam',        txt: 'Publicité ou spam' },
    { cle: 'autre',       txt: 'Autre raison' }
  ];

  function estBloque(userId) { return !!BLOQUES[userId]; }
  function dejaSignale(mealId) { return !!SIGNALES[mealId]; }

  /* « La modération est-elle synchronisée ? » — l'écran s'en sert pour dire la
     vérité à l'utilisateur au lieu de laisser croire à un enregistrement en
     base qui n'a pas lieu (même parti pris qu'assets/planning.js). */
  function moderationOk() {
    return supportBloques === 'table' && supportSignal === 'table';
  }

  /* Masquer / réafficher. Optimiste comme basculerAmi : l'écran réagit tout de
     suite, l'écriture suit, et un échec réseau remet l'état d'avant plutôt que
     de laisser l'affichage mentir. */
  function basculerBloque(userId) {
    if (!userId || userId === Natty.USER_ID) return false;
    var masque = !BLOQUES[userId];
    if (masque) BLOQUES[userId] = true; else delete BLOQUES[userId];

    if (supportBloques === 'table' && Natty.USER_ID) {
      // ⚠️ `?on_conflict=user_id,bloque_id` : sans lui PostgREST résout sur la
      // clé primaire et un second masquage repartirait en 409 (piège documenté
      // en §3 de CLAUDE.md, payé sur meal_likes et membre_amis).
      var p = masque
        ? Natty.sbPost('membre_bloques?on_conflict=user_id,bloque_id',
            { user_id: Natty.USER_ID, bloque_id: userId },
            'return=minimal,resolution=ignore-duplicates')
        : sbDelete('membre_bloques?user_id=eq.' + Natty.USER_ID + '&bloque_id=eq.' + userId);
      p.catch(function () { if (masque) delete BLOQUES[userId]; else BLOQUES[userId] = true; });
    } else {
      ecrireLocal('bloques', Object.keys(BLOQUES));
    }

    /* Le fil courant est purgé sur place : recharger depuis la base pour un
       geste local ferait clignoter l'écran et perdrait la position de lecture.
       Au prochain `charger()` le filtre s'appliquera de lui-même. */
    if (masque) PLATS = PLATS.filter(function (p) { return p.user_id !== userId; });
    return masque;
  }

  /* Signaler un plat. Rend `{ mode }` : 'table' quand c'est enregistré,
     'email' avec un lien prérempli quand natty_moderation.sql n'a pas encore
     été exécuté. Le repli n'est PAS un stockage local — un signalement qui
     reste sur l'appareil de celui qui signale ne signale rien. */
  async function signaler(mealId, motif, commentaire) {
    var plat = platParId(mealId);
    if (!plat) return { mode: 'echec' };
    if (!MOTIFS.some(function (m) { return m.cle === motif; })) motif = 'autre';

    if (supportSignal !== 'email' && Natty.USER_ID) {
      try {
        await Natty.sbPost('signalements?on_conflict=meal_id,signaleur_id', {
          meal_id: mealId,
          auteur_id: plat.user_id,
          signaleur_id: Natty.USER_ID,
          motif: motif,
          commentaire: (commentaire || '').slice(0, 500) || null
        }, 'return=minimal,resolution=ignore-duplicates');
        supportSignal = 'table';
        SIGNALES[mealId] = true;
        return { mode: 'table' };
      } catch (e) { supportSignal = 'email'; }
    }

    SIGNALES[mealId] = true;
    ecrireLocal('signales', Object.keys(SIGNALES));
    var m = MOTIFS.filter(function (x) { return x.cle === motif; })[0];
    var corps = 'Plat signalé : ' + (plat.nom || '') + '\n'
      + 'Identifiant : ' + mealId + '\n'
      + 'Auteur : ' + plat.user_id + '\n'
      + 'Motif : ' + (m ? m.txt : motif) + '\n'
      + (commentaire ? 'Précision : ' + commentaire + '\n' : '');
    return {
      mode: 'email',
      lien: 'mailto:contact@natty-nutrition.com'
          + '?subject=' + encodeURIComponent('Signalement de contenu — Natty')
          + '&body=' + encodeURIComponent(corps)
    };
  }

  /* ── Réglage « mes plats dans le fil » (profil.html) ─────── */

  function estPrefsDispo() { return supportPrefs === 'table'; }

  async function lireMaPref() {
    try {
      var r = await Natty.sbFetch('membre_prefs?user_id=eq.' + Natty.USER_ID + '&select=fil_public&limit=1');
      supportPrefs = 'table';
      return (r && r.length) ? r[0].fil_public !== false : true;
    } catch (e) {
      supportPrefs = 'absent';
      return null;   // table absente : l'appelant doit le dire à l'utilisateur
    }
  }

  async function ecrireMaPref(filPublic) {
    // upsert : une seule ligne par membre (user_id est la clé primaire).
    await Natty.sbPost('membre_prefs',
      { user_id: Natty.USER_ID, fil_public: !!filPublic, updated_at: new Date().toISOString() },
      'return=minimal,resolution=merge-duplicates');
    supportPrefs = 'table';
  }

  function chercher(q) {
    var t = (q || '').trim().toLowerCase();
    if (!t) return [];
    return PLATS.filter(function (p) {
      return p.nom.toLowerCase().indexOf(t) > -1
        || (p.auteur && p.auteur.prenom.toLowerCase().indexOf(t) > -1)
        || p.ingredients.some(function (i) { return (i.name || '').toLowerCase().indexOf(t) > -1; });
    }).slice(0, 20);
  }

  function platParId(id) {
    return PLATS.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* ── Likes & vues ──────────────────────────────────────────
     ⚠️ `resolution=ignore-duplicates` ne suffit pas seul : PostgREST
     résout le conflit sur la CLÉ PRIMAIRE, qui est ici un `id` uuid
     toujours neuf — la contrainte d'unicité (meal_id, user_id) partait
     donc en 409 au lieu d'être ignorée. Il faut nommer la contrainte
     visée avec `?on_conflict=…`. Vérifié en base : sans lui 409, avec
     lui 201 et toujours une seule ligne. Même remarque pour
     membre_amis. `membre_prefs`, dont la clé primaire EST `user_id`,
     n'en a pas besoin. */

  function compteurs(id) {
    var l = LIKES[id] || { n: 0, moi: false };
    return { likes: l.n, aime: l.moi, vues: VUES[id] || 0 };
  }

  /* Retourne le nouvel état (optimiste) : l'appel réseau suit sans bloquer
     l'interface. En cas d'échec, on revient à l'état précédent. */
  function toggleLike(id) {
    var etat = LIKES[id] || (LIKES[id] = { n: 0, moi: false });
    var avant = { n: etat.n, moi: etat.moi };
    etat.moi = !etat.moi;
    etat.n = Math.max(0, etat.n + (etat.moi ? 1 : -1));

    if (supportLikes === 'table' && Natty.USER_ID) {
      var p = etat.moi
        ? Natty.sbPost('meal_likes?on_conflict=meal_id,user_id',
            { meal_id: id, user_id: Natty.USER_ID }, 'return=minimal,resolution=ignore-duplicates')
        : sbDelete('meal_likes?meal_id=eq.' + id + '&user_id=eq.' + Natty.USER_ID);
      p.catch(function () { LIKES[id] = avant; });
    } else {
      var locaux = lireLocal('likes').filter(function (x) { return x !== id; });
      if (etat.moi) locaux.push(id);
      ecrireLocal('likes', locaux);
    }
    return { likes: etat.n, aime: etat.moi };
  }

  /* Enregistré à l'ouverture du détail : c'est là que le plat est vraiment
     regardé. Une vue par membre et par plat, d'où la contrainte d'unicité. */
  function marquerVue(id) {
    var deja = lireLocal('vues');
    if (deja.indexOf(id) > -1) return;
    deja.push(id);
    ecrireLocal('vues', deja);
    VUES[id] = (VUES[id] || 0) + 1;
    if (supportVues === 'table' && Natty.USER_ID) {
      Natty.sbPost('meal_vues?on_conflict=meal_id,user_id', { meal_id: id, user_id: Natty.USER_ID },
        'return=minimal,resolution=ignore-duplicates').catch(function () {});
    }
  }

  return {
    charger: charger,
    vues: vues,
    membres: membres,
    platsDeMembre: platsDeMembre,
    chercher: chercher,
    platParId: platParId,
    auteurParId: function (u) { return AUTEURS[u] || null; },
    compteurs: compteurs,
    toggleLike: toggleLike,
    marquerVue: marquerVue,
    estAmi: estAmi,
    basculerAmi: basculerAmi,
    // Modération (guideline 1.2)
    MOTIFS: MOTIFS,
    estBloque: estBloque,
    basculerBloque: basculerBloque,
    signaler: signaler,
    dejaSignale: dejaSignale,
    moderationOk: moderationOk,
    estPrefsDispo: estPrefsDispo,
    lireMaPref: lireMaPref,
    ecrireMaPref: ecrireMaPref,
    scoreDe: scoreDe,
    emojiPlat: emojiPlat,
    estSynchronise: function () {
      return supportLikes === 'table' && supportVues === 'table' && supportAmis === 'table';
    }
  };
})();
