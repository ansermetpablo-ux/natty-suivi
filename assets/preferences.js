/* ═══════════════════════════════════════════════════════════
   Natty — Préférences alimentaires et envies de découverte
   ───────────────────────────────────────────────────────────
   Ce que l'utilisateur a répondu au questionnaire d'onboarding
   (`questionnaire-alim.html`) était jusqu'ici LECTURE SEULE et
   invisible : une fois les sept étapes passées, plus aucun écran
   ne montrait ses allergies, ses goûts ni ce qu'il voulait
   découvrir — et rien ne permettait d'en changer sans refaire le
   questionnaire en entier, ce qui aurait ajouté une ligne de plus
   (voir « doublons » ci-dessous).

   Or ces réponses ne sont pas des archives : `assets/reco.js` les
   injecte dans le prompt de la génération hebdomadaire
   (contraintes absolues, goûts, curiosités). Les rendre modifiables,
   c'est rendre la génération pilotable.

   TABLE : `questionnaire_alim`, colonnes déjà en place (§4).

   ⚠️ ÉCRITURE EN PATCH SUR `user_id`, PAS EN UPSERT. `questionnaire_alim`
   n'a aucune contrainte d'unicité sur `user_id` — un `merge-duplicates`
   repartirait en `42P10` (« no unique constraint matching the ON CONFLICT
   specification »), exactement comme `onboarding` (§8). Et comme la table
   peut contenir des DOUBLONS pour un même membre, le PATCH est
   volontairement sans `limit` : il aligne toutes les lignes du membre.
   Sinon `reco.js`, qui lit `order=completed_at.desc&limit=1`, pourrait
   retomber sur une ligne restée à l'ancienne valeur.

   ⚠️ AUCUN REPLI `localStorage`. Une allergie enregistrée sur le seul
   appareil, c'est une allergie que la génération côté serveur ne verra
   jamais — et l'écran aurait pourtant dit « enregistré ». En cas d'échec
   on le dit, et les réponses restent à l'écran.

   Dépend de `assets/core.js` (session, sbFetch/sbPost/sbPatch) et des
   jetons de `assets/style.css`, comme `assets/liste.js` et
   `assets/recette.js`.
   ═══════════════════════════════════════════════════════════ */
var NattyPreferences = (function () {
  var TABLE = 'questionnaire_alim';
  var COLS = 'allergies,regime,aliments_aimes,aliments_evites,'
    + 'decouverte_cuisines,decouverte_styles,decouverte_ingredients,'
    + 'decouverte_variantes,curiosite_libre';

  var P = null;            // état courant, forme normalisée
  var charge = false;
  var existe = false;      // une ligne existe déjà en base pour ce membre
  var modifie = false;     // au moins un enregistrement dans cette session
  var hote = null;         // conteneur du panneau
  var feuille = null;      // feuille d'édition, quand elle est ouverte
  var ongletDisco = 'cuisines';
  var catOuverte = null;   // catégorie d'aliments dépliée

  /* ── Catalogues ───────────────────────────────────────────────
     Repris à l'identique de `questionnaire-alim.html` : mêmes valeurs
     `data-v`, donc une préférence posée ici et une posée là-bas sont la
     même chaîne en base. Deux vocabulaires auraient donné deux réglages
     qui ne se voient pas l'un l'autre. */
  var ALLERGIES = [
    ['gluten', 'Gluten'], ['lactose', 'Lactose'], ['noix', 'Noix'], ['oeufs', 'Œufs'],
    ['poisson', 'Poisson'], ['fruits_mer', 'Fruits de mer'], ['soja', 'Soja'],
    ['sesame', 'Sésame'], ['sulfites', 'Sulfites']
  ];
  var REGIMES = [
    ['vegetarien', 'Végétarien'], ['vegan', 'Vegan'], ['halal', 'Halal'],
    ['casher', 'Casher'], ['sans_gluten', 'Sans gluten'], ['sans_lactose', 'Sans lactose']
  ];

  /* Les quatre familles d'envies. La clé est le suffixe de la colonne
     (`decouverte_<clé>`) : pas de table de correspondance à tenir. */
  var DISCO = [
    { cle: 'cuisines', titre: 'Cuisines du monde', items: [
      ['japonaise', 'Japonaise'], ['indienne', 'Indienne'], ['marocaine', 'Marocaine'],
      ['mexicaine', 'Mexicaine'], ['grecque', 'Grecque'], ['thailandaise', 'Thaïlandaise'],
      ['coreenne', 'Coréenne'], ['libanaise', 'Libanaise'], ['ethiopienne', 'Éthiopienne'],
      ['peruvienne', 'Péruvienne'], ['vietnamienne', 'Vietnamienne'], ['turque', 'Turque']
    ]},
    { cle: 'styles', titre: 'Styles culinaires', items: [
      ['bistrot', 'Cuisine bistrot'], ['one_pot', 'One pot'], ['grill', 'Grill'],
      ['bowl', 'Bowl'], ['street_food', 'Street food'], ['marche', 'Cuisine du marché'],
      ['batch_cooking', 'Batch cooking'], ['bento', 'Bento'], ['cru', 'Cuisine crue'],
      ['vapeur', 'Vapeur']
    ]},
    { cle: 'ingredients', titre: 'Ingrédients', items: [
      ['butternut', 'Butternut'], ['pak_choi', 'Pak choï'], ['fenouil', 'Fenouil'],
      ['artichaut', 'Artichaut'], ['shiitake', 'Shiitake'], ['pleurote', 'Pleurote'],
      ['maquereau', 'Maquereau'], ['poulpe', 'Poulpe'], ['sarrasin', 'Sarrasin'],
      ['polenta', 'Polenta'], ['miso', 'Miso'], ['tahini', 'Tahini'],
      ['tempeh', 'Tempeh'], ['edamame', 'Edamame'], ['zaatar', 'Zaatar'], ['sumac', 'Sumac']
    ]},
    { cle: 'variantes', titre: 'Variantes', items: [
      ['pates_variees', 'Pâtes variées'], ['poulet_monde', 'Poulet du monde'],
      ['oeufs_autrement', 'Œufs autrement'], ['salades_repas', 'Salades-repas'],
      ['soupes_copieuses', 'Soupes copieuses'], ['burger_revisite', 'Burgers revisités'],
      ['tacos_wraps', 'Tacos et wraps'], ['riz_monde', 'Riz du monde'],
      ['pizza_revisite', 'Pizza revisitée'], ['porridge_bowl', 'Porridge et bowls']
    ]}
  ];

  var FOODS = {
    fruits: { titre: 'Fruits', em: '🍎', items: [
      ['🍎','Pomme'],['🍌','Banane'],['🍓','Fraise'],['🍇','Raisin'],['🍊','Orange'],
      ['🥭','Mangue'],['🍑','Pêche'],['🍒','Cerise'],['🥝','Kiwi'],['🍍','Ananas'],
      ['🫐','Myrtille'],['🍋','Citron'],['🍐','Poire'],['🥥','Coco'],['🍈','Melon'],
      ['🍉','Pastèque'],['🍏','Pomme verte'],['🫒','Olive']
    ]},
    legumes: { titre: 'Légumes', em: '🥦', items: [
      ['🥦','Brocoli'],['🥕','Carotte'],['🍅','Tomate'],['🥒','Concombre'],['🫑','Poivron'],
      ['🧅','Oignon'],['🧄','Ail'],['🥬','Salade'],['🌽','Maïs'],['🥑','Avocat'],
      ['🍆','Aubergine'],['🫛','Petits pois'],['🥔','Pomme de terre'],['🍠','Patate douce'],
      ['🧅','Échalote'],['🌿','Épinards'],['🥗','Roquette'],['🫚','Courgette']
    ]},
    proteines: { titre: 'Protéines', em: '🍗', items: [
      ['🥩','Bœuf'],['🍗','Poulet'],['🥓','Lardons'],['🐟','Saumon'],['🐠','Thon'],
      ['🥚','Œufs'],['🫘','Lentilles'],['🫘','Pois chiches'],['🌱','Tofu'],['🦐','Crevettes'],
      ['🐟','Cabillaud'],['🥩','Agneau'],['🍗','Dinde'],['🐖','Porc'],['🦑','Calamars'],
      ['🦞','Homard'],['🧈','Tempeh'],['🫙','Sardines']
    ]},
    feculents: { titre: 'Féculents', em: '🍚', items: [
      ['🍚','Riz blanc'],['🍝','Pâtes'],['🍞','Pain'],['🥔','Pomme de terre'],['🌽','Polenta'],
      ['🌾','Quinoa'],['🌾','Boulgour'],['🌾','Sarrasin'],['🌾','Épeautre'],['🥖','Baguette'],
      ['🫓','Pain complet'],['🍠','Patate douce'],['🌾','Riz basmati'],['🌾','Avoine']
    ]},
    laitiers: { titre: 'Produits laitiers', em: '🧀', items: [
      ['🥛','Lait'],['🧀','Fromage'],['🥛','Yaourt nature'],['🧈','Beurre'],['🍦','Crème fraîche'],
      ['🧀','Feta'],['🧀','Parmesan'],['🧀','Mozzarella'],['🥛','Kéfir'],['🧀','Gruyère'],
      ['🍮','Fromage blanc'],['🥛','Lait de coco'],['🥛',"Lait d'amande"]
    ]},
    herbes: { titre: 'Herbes et épices', em: '🌿', items: [
      ['🌿','Basilic'],['🌿','Persil'],['🌿','Coriandre'],['🌿','Thym'],['🌿','Romarin'],
      ['🌿','Menthe'],['🌿','Estragon'],['🧄','Ciboulette'],['🌶️','Piment'],['🫚','Cumin'],
      ['🟡','Curcuma'],['🟠','Paprika'],['🟤','Cannelle'],['⭐','Anis étoilé'],
      ['🌿','Zaatar'],['🔴','Sumac'],['🟡','Safran'],['🌿','Curry']
    ]},
    /* Le questionnaire ne proposait qu'une liste fermée : quelqu'un qui
       déteste un aliment absent des 100 n'avait nulle part où le dire, et
       la génération continuait de le lui proposer. Cette catégorie n'existe
       que pour les ajouts à la main. */
    autres: { titre: 'Autres', em: '✏️', items: [], libre: true }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function libelle(paires, v) {
    for (var i = 0; i < paires.length; i++) if (paires[i][0] === v) return paires[i][1];
    return String(v || '').replace(/_/g, ' ');
  }

  /* ── Normalisation ────────────────────────────────────────────
     PostgREST peut rendre ces colonnes en objet/tableau (jsonb) ou en
     chaîne (text). On ne sait pas laquelle sans regarder, et la même
     instance peut porter les deux selon l'âge de la ligne — d'où le
     parsage tolérant plutôt qu'une hypothèse sur le type. */
  function versTableau(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
    if (typeof v === 'string') {
      var s = v.trim();
      if (!s) return [];
      if (s.charAt(0) === '[' || s.charAt(0) === '{') {
        try { return versTableau(JSON.parse(s)); } catch (e) { /* texte brut */ }
      }
      return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    }
    if (typeof v === 'object') {
      var out = [];
      Object.keys(v).forEach(function (k) { out = out.concat(versTableau(v[k])); });
      return out;
    }
    return [String(v)];
  }

  /* Les goûts sont rangés PAR CATÉGORIE ({fruits:[…]}) — c'est la forme
     qu'écrit le questionnaire, et la relire à plat perdrait le rangement
     de l'écran d'édition. Une ligne écrite à plat par une autre source
     est récupérée dans « Autres » plutôt que jetée. */
  function versGouts(v) {
    var out = {};
    Object.keys(FOODS).forEach(function (c) { out[c] = []; });
    if (!v) return out;
    if (typeof v === 'string') {
      var s = v.trim();
      if (!s) return out;
      try { v = JSON.parse(s); }
      catch (e) { out.autres = versTableau(s); return out; }
    }
    if (Array.isArray(v)) { out.autres = v.filter(Boolean).map(String); return out; }
    if (typeof v === 'object') {
      Object.keys(v).forEach(function (k) {
        var cat = Object.prototype.hasOwnProperty.call(out, k) ? k : 'autres';
        out[cat] = out[cat].concat(versTableau(v[k]));
      });
    }
    return out;
  }

  function vide() {
    var p = {
      allergies: [], regime: [],
      aliments_aimes: versGouts(null), aliments_evites: versGouts(null),
      curiosite_libre: ''
    };
    DISCO.forEach(function (d) { p['decouverte_' + d.cle] = []; });
    return p;
  }

  function normaliser(row) {
    var p = vide();
    if (!row) return p;
    p.allergies = versTableau(row.allergies).filter(function (x) { return x !== 'aucun'; });
    p.regime = versTableau(row.regime).filter(function (x) { return x !== 'aucun_regime'; });
    p.aliments_aimes = versGouts(row.aliments_aimes);
    p.aliments_evites = versGouts(row.aliments_evites);
    DISCO.forEach(function (d) {
      p['decouverte_' + d.cle] = versTableau(row['decouverte_' + d.cle]);
    });
    p.curiosite_libre = row.curiosite_libre ? String(row.curiosite_libre) : '';
    return p;
  }

  /* ── Base ─────────────────────────────────────────────────────── */
  async function charger(force) {
    if (charge && !force) return P;
    var uid = Natty.USER_ID;
    if (!uid) { P = vide(); charge = true; return P; }
    try {
      var r = await Natty.sbFetch(TABLE + '?user_id=eq.' + uid
        + '&order=completed_at.desc&limit=1&select=' + COLS);
      existe = !!(r && r.length);
      P = normaliser(existe ? r[0] : null);
    } catch (e) {
      existe = false;
      P = vide();
    }
    charge = true;
    return P;
  }

  async function sauver() {
    var uid = Natty.USER_ID;
    if (!uid) throw new Error('session requise');
    var corps = {
      allergies: P.allergies,
      regime: P.regime,
      aliments_aimes: P.aliments_aimes,
      aliments_evites: P.aliments_evites,
      curiosite_libre: P.curiosite_libre
    };
    DISCO.forEach(function (d) { corps['decouverte_' + d.cle] = P['decouverte_' + d.cle]; });

    if (existe) {
      // Sans `limit` : voir l'encadré « doublons » en tête de fichier.
      await Natty.sbPatch(TABLE + '?user_id=eq.' + uid, corps);
    } else {
      corps.user_id = uid;
      corps.completed_at = new Date().toISOString();
      await Natty.sbPost(TABLE, corps, 'return=minimal');
      existe = true;
    }
    modifie = true;
    document.dispatchEvent(new CustomEvent('natty:preferences-maj', { detail: P }));
  }

  /* ── Résumé (le panneau) ──────────────────────────────────────── */
  function tousLesGouts(o) {
    var out = [];
    Object.keys(o || {}).forEach(function (k) { out = out.concat(o[k] || []); });
    return out;
  }

  function toutesLesEnvies() {
    var out = [];
    DISCO.forEach(function (d) {
      (P['decouverte_' + d.cle] || []).forEach(function (v) {
        out.push(libelle(d.items, v));
      });
    });
    return out;
  }

  function nbReglages() {
    return P.allergies.length + P.regime.length
      + tousLesGouts(P.aliments_aimes).length + tousLesGouts(P.aliments_evites).length
      + toutesLesEnvies().length + (P.curiosite_libre ? 1 : 0);
  }

  function ligne(titre, valeurs, variante) {
    if (!valeurs.length) return '';
    var max = 8;
    var vus = valeurs.slice(0, max);
    var reste = valeurs.length - vus.length;
    return '<div class="np-l"><div class="np-lt">' + esc(titre) + '</div><div class="np-tags">'
      + vus.map(function (v) {
          return '<span class="np-tag' + (variante ? ' ' + variante : '') + '">' + esc(v) + '</span>';
        }).join('')
      + (reste > 0 ? '<span class="np-tag np-more">+' + reste + '</span>' : '')
      + '</div></div>';
  }

  function peindrePanneau() {
    if (!hote) return;
    var n = nbReglages();
    var corps = '';
    corps += ligne('Allergies', P.allergies.map(function (v) { return libelle(ALLERGIES, v); }), 'bad');
    corps += ligne('Régime', P.regime.map(function (v) { return libelle(REGIMES, v); }));
    corps += ligne("J'aime", tousLesGouts(P.aliments_aimes), 'ok');
    corps += ligne("J'évite", tousLesGouts(P.aliments_evites), 'bad');
    corps += ligne('Envie de découvrir', toutesLesEnvies());
    if (P.curiosite_libre) {
      corps += '<div class="np-l"><div class="np-lt">Ma curiosité</div>'
        + '<div class="np-libre">« ' + esc(P.curiosite_libre) + ' »</div></div>';
    }
    if (!corps) {
      corps = '<div class="np-vide">Rien d’enregistré pour l’instant. Vos allergies, vos goûts et vos'
        + ' envies orientent les recettes de la semaine.</div>';
    }

    // Le bouton de regénération n'apparaît qu'après une vraie modification :
    // proposer de repayer un appel à Claude sans que rien n'ait changé
    // n'aurait servi qu'à le faire cliquer par curiosité.
    var relance = (modifie && window.NattyGeneration)
      ? '<div class="np-relance"><div class="np-note">Vos prochaines recettes en tiendront compte.</div>'
        + '<button type="button" class="np-btn-min" data-np="regen">↻ Regénérer ma semaine maintenant</button></div>'
      : '';

    hote.innerHTML = '<div class="np-panel">'
      + '<div class="np-head"><div class="np-title">Mes préférences'
      + (n ? ' <span>(' + n + ')</span>' : '') + '</div>'
      + '<button type="button" class="np-link" data-np="ouvrir">Modifier</button></div>'
      + corps + relance + '</div>';
  }

  /* ── Feuille d'édition ────────────────────────────────────────── */
  function chips(paires, choisis, groupe) {
    return '<div class="np-chips">' + paires.map(function (p) {
      var on = choisis.indexOf(p[0]) > -1;
      return '<button type="button" class="np-chip' + (on ? ' on' : '') + '"'
        + ' data-np="chip" data-groupe="' + groupe + '" data-v="' + esc(p[0]) + '">'
        + esc(p[1]) + '</button>';
    }).join('') + '</div>';
  }

  /* Un aliment a TROIS états et un seul geste : neutre → j'aime → j'évite →
     neutre. Le questionnaire d'origine demandait de choisir un mode (aimer
     / éviter) avant de toucher les aliments ; ici la liste sert à corriger
     deux ou trois choses, et repasser par un sélecteur de mode pour chaque
     correction serait deux gestes au lieu d'un. */
  function etatAliment(cat, nom) {
    if ((P.aliments_aimes[cat] || []).indexOf(nom) > -1) return 'ok';
    if ((P.aliments_evites[cat] || []).indexOf(nom) > -1) return 'bad';
    return '';
  }

  function basculerAliment(cat, nom) {
    if (!P.aliments_aimes[cat]) P.aliments_aimes[cat] = [];
    if (!P.aliments_evites[cat]) P.aliments_evites[cat] = [];
    var e = etatAliment(cat, nom);
    var iA = P.aliments_aimes[cat].indexOf(nom);
    var iE = P.aliments_evites[cat].indexOf(nom);
    if (iA > -1) P.aliments_aimes[cat].splice(iA, 1);
    if (iE > -1) P.aliments_evites[cat].splice(iE, 1);
    if (e === '') P.aliments_aimes[cat].push(nom);
    else if (e === 'ok') P.aliments_evites[cat].push(nom);
  }

  function catalogueCat(cat) {
    var def = FOODS[cat];
    var noms = def.items.map(function (x) { return x[1]; });
    var em = {};
    def.items.forEach(function (x) { em[x[1]] = x[0]; });
    // Un aliment ajouté à la main (ou hérité d'une autre source) doit
    // rester touchable : sinon on le voit dans le résumé sans jamais
    // pouvoir le retirer.
    ((P.aliments_aimes[cat] || []).concat(P.aliments_evites[cat] || [])).forEach(function (n) {
      if (noms.indexOf(n) < 0) noms.push(n);
    });
    return noms.map(function (n) { return [em[n] || (def.libre ? '✏️' : '🥄'), n]; });
  }

  function blocAliments() {
    return '<div class="np-cats">' + Object.keys(FOODS).map(function (cat) {
      var def = FOODS[cat];
      var n = (P.aliments_aimes[cat] || []).length + (P.aliments_evites[cat] || []).length;
      var ouvert = catOuverte === cat;
      var h = '<div class="np-cat' + (ouvert ? ' open' : '') + '">'
        + '<button type="button" class="np-cat-h" data-np="cat" data-cat="' + cat + '">'
        + '<span class="np-cat-em">' + def.em + '</span>'
        + '<span class="np-cat-t">' + esc(def.titre) + '</span>'
        + '<span class="np-cat-n">' + (n ? n : '') + '</span>'
        + '<span class="np-cat-c">' + (ouvert ? '▴' : '▾') + '</span>'
        + '</button>';
      if (ouvert) {
        h += '<div class="np-foods">' + catalogueCat(cat).map(function (f) {
          var e = etatAliment(cat, f[1]);
          return '<button type="button" class="np-food' + (e ? ' ' + e : '') + '"'
            + ' data-np="food" data-cat="' + cat + '" data-nom="' + esc(f[1]) + '">'
            + '<span class="np-food-em">' + f[0] + '</span>'
            + '<span class="np-food-n">' + esc(f[1]) + '</span></button>';
        }).join('') + '</div>';
        if (def.libre) {
          h += '<div class="np-add">'
            + '<input type="text" class="np-input" id="npAjout" placeholder="Ajouter un aliment…" maxlength="40">'
            + '<button type="button" class="np-btn-min" data-np="ajouter">Ajouter</button></div>';
        }
      }
      return h + '</div>';
    }).join('') + '</div>';
  }

  function blocDisco() {
    var g = null;
    DISCO.forEach(function (d) { if (d.cle === ongletDisco) g = d; });
    if (!g) g = DISCO[0];
    return '<div class="np-tabs">' + DISCO.map(function (d) {
        var n = (P['decouverte_' + d.cle] || []).length;
        return '<button type="button" class="np-tab' + (d.cle === g.cle ? ' on' : '') + '"'
          + ' data-np="tab" data-cle="' + d.cle + '">' + esc(d.titre)
          + (n ? ' <b>' + n + '</b>' : '') + '</button>';
      }).join('') + '</div>'
      + chips(g.items, P['decouverte_' + g.cle] || [], 'decouverte_' + g.cle);
  }

  function peindreFeuille() {
    if (!feuille) return;
    var corps = feuille.querySelector('.np-body');
    if (!corps) return;
    corps.innerHTML = ''
      + '<div class="np-sec">Ce que je ne peux pas manger</div>'
      + '<div class="np-sub">Une contrainte absolue : elle n’est jamais enfreinte par les recettes proposées.</div>'
      + '<div class="np-lbl">Allergies et intolérances</div>'
      + chips(ALLERGIES, P.allergies, 'allergies')
      + '<div class="np-lbl">Régime</div>'
      + chips(REGIMES, P.regime, 'regime')

      + '<div class="np-sec">Mes goûts</div>'
      + '<div class="np-sub">Touchez un aliment : une fois pour <b class="np-ok">j’aime</b>,'
      + ' deux fois pour <b class="np-bad">j’évite</b>, trois fois pour l’effacer.</div>'
      + blocAliments()

      + '<div class="np-sec">Ce que j’ai envie de découvrir</div>'
      + '<div class="np-sub">Ces envies orientent les recettes de la semaine, sans jamais passer avant vos contraintes.</div>'
      + blocDisco()
      + '<div class="np-lbl">Une envie précise ?</div>'
      + '<textarea class="np-ta" id="npCurio" maxlength="200" rows="3"'
      + ' placeholder="Ex : j’aimerais apprendre à faire des sushis…">' + esc(P.curiosite_libre) + '</textarea>'
      + '<div class="np-compte" id="npCompte">' + P.curiosite_libre.length + ' / 200</div>';
  }

  function fermer() {
    if (!feuille) return;
    var f = feuille;
    feuille = null;
    f.classList.remove('on');
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 260);
  }

  function ouvrir() {
    if (feuille) return;
    injecterCSS();
    catOuverte = null;
    feuille = document.createElement('div');
    feuille.className = 'np-sheet';
    feuille.innerHTML = ''
      + '<div class="np-top">'
      +   '<button type="button" class="np-x" data-np="fermer" aria-label="Fermer">✕</button>'
      +   '<div class="np-top-t">Mes préférences</div>'
      +   '<button type="button" class="np-save" data-np="enregistrer">Enregistrer</button>'
      + '</div>'
      + '<div class="np-body"></div>'
      + '<div class="np-etat" id="npEtat"></div>';
    document.body.appendChild(feuille);
    peindreFeuille();
    brancherFeuille();
    // Double amorçage : une classe posée par la seule rAF ne se pose pas si
    // la page ne peint pas (onglet caché, app en arrière-plan) — la feuille
    // resterait invisible tout en interceptant les taps. Même piège que
    // `Natty.confirmer` et `assets/generation.js`.
    requestAnimationFrame(function () { if (feuille) feuille.classList.add('on'); });
    setTimeout(function () { if (feuille) feuille.classList.add('on'); }, 60);
  }

  function etat(msg, err) {
    var e = document.getElementById('npEtat');
    if (!e) return;
    e.textContent = msg || '';
    e.className = 'np-etat' + (err ? ' err' : '') + (msg ? ' on' : '');
  }

  function brancherFeuille() {
    // Délégation : le corps est repeint à chaque geste, des écouteurs posés
    // sur les boutons eux-mêmes seraient perdus au premier tap.
    feuille.addEventListener('click', async function (ev) {
      var el = ev.target.closest('[data-np]');
      if (!el || !feuille.contains(el)) return;
      var a = el.dataset.np;

      if (a === 'fermer') { fermer(); return; }

      if (a === 'chip') {
        var g = el.dataset.groupe, v = el.dataset.v;
        if (!P[g]) P[g] = [];
        var i = P[g].indexOf(v);
        if (i > -1) P[g].splice(i, 1); else P[g].push(v);
        peindreFeuille();
        return;
      }

      if (a === 'tab') { ongletDisco = el.dataset.cle; peindreFeuille(); return; }
      if (a === 'cat') {
        catOuverte = (catOuverte === el.dataset.cat) ? null : el.dataset.cat;
        peindreFeuille();
        return;
      }
      if (a === 'food') { basculerAliment(el.dataset.cat, el.dataset.nom); peindreFeuille(); return; }

      if (a === 'ajouter') {
        var inp = document.getElementById('npAjout');
        var nom = inp ? inp.value.trim() : '';
        if (!nom) return;
        if (!P.aliments_aimes.autres) P.aliments_aimes.autres = [];
        if (P.aliments_aimes.autres.indexOf(nom) < 0
            && (P.aliments_evites.autres || []).indexOf(nom) < 0) {
          P.aliments_aimes.autres.push(nom);
        }
        peindreFeuille();
        return;
      }

      if (a === 'enregistrer') {
        var ta = document.getElementById('npCurio');
        if (ta) P.curiosite_libre = ta.value.slice(0, 200);
        el.disabled = true;
        etat('Enregistrement…');
        try {
          await sauver();
          peindrePanneau();
          fermer();
        } catch (e) {
          el.disabled = false;
          // Pas de repli silencieux : ce qui n'est pas parti en base ne sera
          // pas lu par la génération, et les réponses sont encore à l'écran.
          etat('Enregistrement impossible — vérifiez votre connexion, vos réponses sont conservées.', true);
        }
      }
    });

    feuille.addEventListener('input', function (ev) {
      if (ev.target && ev.target.id === 'npCurio') {
        var c = document.getElementById('npCompte');
        if (c) c.textContent = ev.target.value.length + ' / 200';
      }
    });

    // Entrée dans le champ d'ajout libre : le geste attendu est « ajouter »,
    // pas « soumettre un formulaire qui n'existe pas ».
    feuille.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target && ev.target.id === 'npAjout') {
        ev.preventDefault();
        var b = feuille.querySelector('[data-np="ajouter"]');
        if (b) b.click();
      }
    });
  }

  /* ── Montage ──────────────────────────────────────────────────── */
  async function monter(el) {
    if (!el) return;
    hote = el;
    injecterCSS();
    if (!charge) await charger();
    peindrePanneau();

    if (hote._npBranche) return;
    hote._npBranche = true;
    hote.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-np]');
      if (!b) return;
      if (b.dataset.np === 'ouvrir') ouvrir();
      else if (b.dataset.np === 'regen' && window.NattyGeneration) {
        b.disabled = true;
        NattyGeneration.lancer({ forcer: true }).catch(function () { b.disabled = false; });
      }
    });
  }

  /* ── CSS ──────────────────────────────────────────────────────
     Jetons de `assets/style.css` (comme liste.js/recette.js) : le module
     n'est chargé que par des écrans qui la portent. Tout est préfixé
     `np-` et la feuille est scellée sous `.np-sheet`. */
  var cssPose = false;
  function injecterCSS() {
    if (cssPose) return;
    cssPose = true;
    var s = document.createElement('style');
    s.textContent = [
      '.np-panel{background:var(--card);border-radius:var(--r-lg);padding:18px;margin-top:16px}',
      '.np-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px}',
      '.np-title{font-size:15.5px;font-weight:900;color:var(--ink)}',
      '.np-title span{font-size:11.5px;font-weight:700;color:var(--muted);margin-left:4px}',
      '.np-link{background:none;border:none;font-family:inherit;font-size:12px;font-weight:800;',
      '  color:var(--ink);text-decoration:underline;cursor:pointer;padding:0}',
      '.np-l{margin-top:12px}',
      '.np-lt{font-size:10.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;',
      '  color:var(--muted);margin-bottom:7px}',
      '.np-tags{display:flex;flex-wrap:wrap;gap:6px}',
      '.np-tag{font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:var(--r-full);',
      '  background:var(--bg);color:var(--ink);border:1px solid var(--line)}',
      '.np-tag.ok{border-color:var(--green);color:var(--green)}',
      '.np-tag.bad{border-color:#ff453a;color:#ff453a}',
      '.np-tag.np-more{color:var(--muted);border-style:dashed}',
      '.np-libre{font-size:12.5px;color:var(--ink);line-height:1.5;font-style:italic}',
      '.np-vide{font-size:12.5px;color:var(--muted);line-height:1.6}',
      '.np-relance{margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}',
      '.np-note{font-size:11.5px;color:var(--muted);margin-bottom:9px}',
      '.np-btn-min{background:var(--ink);color:var(--on-ink);border:none;border-radius:var(--r-full);',
      '  padding:9px 16px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}',
      '.np-btn-min:disabled{opacity:.5}',

      '.np-sheet{position:fixed;inset:0;z-index:9200;background:var(--bg);display:flex;',
      '  flex-direction:column;opacity:0;transform:translateY(16px);',
      '  transition:opacity .24s ease,transform .24s cubic-bezier(.22,1,.36,1)}',
      '.np-sheet.on{opacity:1;transform:none}',
      '.np-top{display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top) + 14px) 18px 14px;',
      '  border-bottom:1px solid var(--line);background:var(--bg);flex-shrink:0}',
      '.np-top-t{flex:1;text-align:center;font-size:15px;font-weight:900;color:var(--ink)}',
      '.np-x{width:34px;height:34px;border-radius:50%;border:none;background:var(--card);',
      '  color:var(--ink);font-size:14px;cursor:pointer;flex-shrink:0}',
      '.np-save{background:var(--ink);color:var(--on-ink);border:none;border-radius:var(--r-full);',
      '  padding:9px 15px;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;flex-shrink:0}',
      '.np-save:disabled{opacity:.5}',
      '.np-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      '  padding:4px 18px calc(env(safe-area-inset-bottom) + 28px);max-width:var(--col);',
      '  width:100%;margin:0 auto}',
      '.np-sec{font-size:16px;font-weight:900;color:var(--ink);margin:24px 0 4px}',
      '.np-sub{font-size:12px;color:var(--muted);line-height:1.55;margin-bottom:14px}',
      '.np-ok{color:var(--green)}.np-bad{color:#ff453a}',
      '.np-lbl{font-size:10.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;',
      '  color:var(--muted);margin:16px 0 8px}',
      '.np-chips{display:flex;flex-wrap:wrap;gap:7px}',
      '.np-chip{background:var(--card);border:1px solid transparent;border-radius:var(--r-full);',
      '  padding:9px 14px;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--ink);cursor:pointer}',
      '.np-chip.on{background:var(--ink);color:var(--on-ink)}',

      '.np-tabs{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;',
      '  padding-bottom:10px;margin-bottom:4px}',
      '.np-tab{flex-shrink:0;background:none;border:none;border-bottom:2px solid transparent;',
      '  font-family:inherit;font-size:12.5px;font-weight:800;color:var(--muted);cursor:pointer;padding:6px 2px}',
      '.np-tab.on{color:var(--ink);border-bottom-color:var(--ink)}',
      '.np-tab b{font-weight:800}',

      '.np-cats{display:flex;flex-direction:column;gap:8px}',
      '.np-cat{background:var(--card);border-radius:18px;overflow:hidden}',
      '.np-cat-h{width:100%;display:flex;align-items:center;gap:10px;background:none;border:none;',
      '  padding:13px 15px;font-family:inherit;cursor:pointer;color:var(--ink)}',
      '.np-cat-em{font-size:19px;line-height:1}',
      '.np-cat-t{flex:1;text-align:left;font-size:13.5px;font-weight:800}',
      '.np-cat-n{font-size:11px;font-weight:800;color:var(--muted)}',
      '.np-cat-c{font-size:12px;color:var(--muted)}',
      '.np-foods{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:0 12px 12px}',
      '.np-food{background:var(--bg);border:1.5px solid transparent;border-radius:14px;padding:10px 3px 8px;',
      '  font-family:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;color:var(--ink)}',
      '.np-food-em{font-size:21px;line-height:1}',
      '.np-food-n{font-size:8.5px;font-weight:700;line-height:1.2;text-align:center}',
      '.np-food.ok{border-color:var(--green);color:var(--green)}',
      '.np-food.bad{border-color:#ff453a;color:#ff453a}',
      '.np-add{display:flex;gap:8px;padding:0 12px 14px}',
      '.np-input{flex:1;background:var(--bg);border:1px solid var(--line);border-radius:var(--r-full);',
      '  padding:10px 14px;font-family:inherit;font-size:12.5px;color:var(--ink);outline:none;min-width:0}',

      '.np-ta{width:100%;background:var(--card);border:none;border-radius:16px;padding:13px;',
      '  font-family:inherit;font-size:13px;color:var(--ink);resize:none;outline:none;line-height:1.5}',
      '.np-compte{text-align:right;font-size:10.5px;color:var(--muted);margin-top:5px}',
      '.np-etat{max-height:0;overflow:hidden;text-align:center;font-size:12px;color:var(--muted);',
      '  transition:max-height .2s ease;background:var(--bg)}',
      '.np-etat.on{max-height:80px;padding:12px 18px calc(env(safe-area-inset-bottom) + 12px)}',
      '.np-etat.err{color:#ff453a;font-weight:700}'
    ].join('\n');
    document.head.appendChild(s);
  }

  return {
    charger: charger,
    monter: monter,
    ouvrir: ouvrir,
    donnees: function () { return P; },
    nbReglages: function () { return P ? nbReglages() : 0; }
  };
})();
