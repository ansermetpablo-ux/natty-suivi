/* ═══════════════════════════════════════════════════════════
   Natty — Le guide d'une macro, en cinématique
   ───────────────────────────────────────────────────────────
     NattyMacroGuide.ouvrir('p'|'g'|'l')   → la séquence
     NattyMacroGuide.note(nom, macro)      → la note d'un aliment (banc)
     NattyMacroGuide.sources(macro, n)     → les n meilleures sources (banc)

   DEMANDE DE PABLO (2026-09-22). « Pour les conseils de nutrition, il faudrait
   le faire en cinétique aussi : quand on clique sur la macro → choix entre
   quatre blocs posés en quadrillage, petit déjeuner / déjeuner / collation /
   dîner, avec illustrations. Lorsqu'on clique, on voit un carrousel de
   propositions de plats correspondants, dans le style d'“enrichir”. En dessous,
   une liste des ingrédients qui détiennent le plus gros apport pour la macro
   concernée, avec une note (bon, excellent, très bien, moyen, mauvais) et un
   code couleur. Illustration de l'aliment + nom + macros + note. »

   CE QUE CE MODULE NE FAIT PAS, ET POURQUOI. Il ne remplace pas l'overlay
   `#ovMacro` de `suivi.html`, qui porte le conseil de la semaine, le plat
   généré et les aliments à privilégier — tout cela vient de la génération
   hebdomadaire et n'a pas d'équivalent ici. Le guide s'ouvre AVANT lui et y
   mène : « Voir le conseil de la semaine » est le dernier bouton de la
   séquence. Détruire l'existant pour le refaire en cinématique aurait perdu du
   contenu que personne n'a demandé de perdre.

   ⚠️ IL N'INVENTE AUCUN CHIFFRE. Les valeurs des aliments viennent de
   `Natty.getNutri` — LA table de l'app, celle qui compte les repas. Celles des
   plats viennent de `NattyDecouverte.recette()`, calculées depuis leurs
   grammages par `scripts/injecter-recettes.mjs`. Les cibles par repas viennent
   de `NattyCreneaux`. Ce module ne fait que classer, noter et mettre en scène.

   Dépend de `assets/core.js`. Utilise `assets/cine.js`, `assets/creneaux.js` et
   `assets/decouverte.js` s'ils sont là — et sait s'en passer, en le disant.
   ═══════════════════════════════════════════════════════════ */
window.NattyMacroGuide = (function () {
  'use strict';

  var MACROS = {
    p: { k: 'p', nom: 'Protéines', em: '🥩', coul: '#ff6b5c', rgb: '255,107,92', kcalParG: 4,
         role: 'construire', illu: 'muscle' },
    g: { k: 'g', nom: 'Glucides',  em: '🌾', coul: '#f0b429', rgb: '240,180,41', kcalParG: 4,
         role: 'tenir la journée', illu: 'eclair' },
    l: { k: 'l', nom: 'Lipides',   em: '🥑', coul: '#5ad07a', rgb: '90,208,122', kcalParG: 9,
         role: 'les hormones et l’absorption des vitamines', illu: 'coeur' }
  };

  /* ── Les aliments proposables comme SOURCE d'une macro ───────
     ⚠️ CE SONT DES NOMS, JAMAIS DES VALEURS. Toutes les valeurs sont relues
     dans `Natty.getNutri` : y recopier ne serait-ce qu'un chiffre créerait une
     seconde table qui divergerait au premier ajustement — le défaut payé entre
     `api/_nutrition.js` et `assets/core.js`, en macros fausses envoyées par
     notification.

     ⚠️ ET POURQUOI UNE LISTE PLUTÔT QUE LA TABLE ENTIÈRE. `NT` compte 326 clés,
     dont des alias et des fautes de frappe volontaires (`steack`, `amendes`,
     `pouivron`, `poids chiche`) ajoutés pour que l'analyse photo les rattrape.
     Elles sont utiles là où elles sont ; affichées dans une liste de « meilleures
     sources », elles auraient l'air d'un bug. On choisit donc quoi PROPOSER,
     sans jamais choisir combien ça vaut.

     ⚠️ Chaque nom doit être résolu par `getNutri` : un nom qui ne l'est pas
     s'afficherait à 0 g, c'est-à-dire comme une source nulle de la macro dont
     on vient dire qu'elle est riche. Le banc le vérifie un par un. */
  var SOURCES = {
    p: ['poulet', 'dinde', 'blanc oeuf', 'thon', 'cabillaud', 'crevettes', 'saumon',
        'oeuf', 'skyr', 'fromage blanc', 'cottage', 'parmesan', 'whey', 'tofu',
        'tempeh', 'lentilles', 'pois chiches', 'edamame', 'haricots rouges',
        'steak', 'jambon', 'saucisson', 'seitan', 'sardines'],
    g: ['avoine', 'flocons avoine', 'riz complet', 'quinoa', 'sarrasin', 'boulgour',
        'millet', 'patate douce', 'pomme de terre', 'lentilles', 'pois chiches',
        'haricots rouges', 'pain complet', 'pates', 'riz', 'semoule', 'banane',
        'datte', 'pomme', 'myrtille', 'pain de mie', 'sucre', 'soda', 'biscuit',
        'confiture', 'miel'],
    l: ['huile olive', 'avocat', 'noix', 'amandes', 'noisette', 'graines courge',
        'chia', 'tahini', 'saumon', 'sardines', 'maquereau', 'olive', 'cajou',
        'pistache', 'cacahuete', 'beurre cacahuete', 'oeuf', 'beurre', 'creme fraiche',
        'lardons', 'chorizo', 'mayonnaise', 'comte', 'jaune oeuf']
  };

  /* ── LA QUALITÉ QUE LA TABLE NE PEUT PAS VOIR ────────────────
     ⚠️⚠️ C'EST LA SEULE COUCHE ÉDITORIALE DE CE MODULE, ET ELLE EST NÉCESSAIRE.
     `NT` ne porte que `{c, p, l, g}` : ni fibres, ni type de gras, ni degré de
     transformation. Une note calculée sur les seuls chiffres classerait donc le
     SUCRE BLANC comme source de glucides EXCELLENTE — 100 g de glucides pour
     400 kcal, soit exactement 4 kcal par gramme, le score parfait. C'est
     arithmétiquement juste et nutritionnellement faux, et ce serait affiché en
     vert à l'écran.

     Ces listes corrigent ce que les quatre chiffres ne disent pas, et rien
     d'autre. Elles sont courtes, nommées par famille, et l'écran AFFICHE la
     raison retenue — « sucres ajoutés », « gras insaturés » — pour que la note
     se discute au lieu d'être à croire. Même parti pris que les `REPERES` par
     geste d'`assets/admin-savoir.js` : un savoir général, annoncé comme tel.

     ⚠️ Le rapprochement se fait sur le nom EXACT de la clé, pas en
     sous-chaîne : « ail » se trouve dans « volaille » (§7 de CLAUDE.md), et un
     malus posé par erreur est une note fausse. */
  var QUALITE = {
    p: {
      bonus: { mots: ['poulet', 'dinde', 'blanc oeuf', 'thon', 'cabillaud', 'crevettes',
                      'skyr', 'fromage blanc', 'cottage', 'whey', 'tofu', 'tempeh',
                      'lentilles', 'pois chiches', 'edamame'],
              txt: 'maigre et complète' },
      malus: { mots: ['saucisson', 'chorizo', 'lardons', 'bacon', 'nuggets', 'surimi',
                      'saucisse', 'merguez', 'pate', 'rillettes'],
              txt: 'charcuterie — sel et gras saturés' }
    },
    g: {
      bonus: { mots: ['avoine', 'flocons avoine', 'riz complet', 'quinoa', 'sarrasin',
                      'boulgour', 'millet', 'patate douce', 'lentilles', 'pois chiches',
                      'haricots rouges', 'pain complet', 'myrtille', 'framboise'],
              txt: 'complexe et riche en fibres' },
      malus: { mots: ['sucre', 'soda', 'confiture', 'biscuit', 'cookie', 'barre cereale',
                      'chocolat', 'glace', 'gateau', 'cereales', 'pain de mie', 'miel',
                      'jus orange', 'jus'],
              txt: 'sucres rapides, peu de fibres' }
    },
    l: {
      bonus: { mots: ['huile olive', 'avocat', 'noix', 'amandes', 'noisette', 'cajou',
                      'pistache', 'graines', 'graines courge', 'chia', 'tahini',
                      'saumon', 'sardines', 'maquereau', 'olive', 'truite'],
              txt: 'gras insaturés' },
      malus: { mots: ['beurre', 'creme fraiche', 'creme', 'lardons', 'chorizo',
                      'saucisson', 'mayonnaise', 'frites', 'chips', 'bacon', 'raclette'],
              txt: 'gras saturés' }
    }
  };

  /* Les cinq notes de Pablo, de la meilleure à la pire. Le libellé ET la
     couleur : la couleur seule ne se lit pas pour tout le monde, et un mot
     seul ne se repère pas dans une liste de quinze lignes. */
  var NOTES = [
    { r: 5, nom: 'Excellent',  coul: '#34c759' },
    { r: 4, nom: 'Très bien',  coul: '#5ad07a' },
    { r: 3, nom: 'Bien',       coul: '#f0b429' },
    { r: 2, nom: 'Moyen',      coul: '#ff9500' },
    { r: 1, nom: 'Mauvais',    coul: '#ff453a' }
  ];

  /* ── L'illustration d'un aliment ─────────────────────────────
     ⚠️ Un EMOJI, pas un SVG au trait. Les 21 illustrations de `cine.js`
     dessinent des objets et des gestes ; dessiner 70 aliments reconnaissables
     au trait de 2,4 px dans une boîte de 64 est un autre métier, et un dessin
     approximatif est moins lisible qu'un emoji juste. Le reste de l'app fait
     déjà ce choix — les ingrédients du `+`, les cartes du carrousel, le
     garde-manger. */
  var EMO = {
    poulet: '🍗', dinde: '🦃', 'blanc oeuf': '🥚', thon: '🐟', cabillaud: '🐟',
    crevettes: '🦐', saumon: '🍣', oeuf: '🥚', 'jaune oeuf': '🥚', skyr: '🥛',
    'fromage blanc': '🥛', cottage: '🥛', parmesan: '🧀', comte: '🧀', whey: '🥤',
    tofu: '🧊', tempeh: '🧊', seitan: '🌾', lentilles: '🫘', 'pois chiches': '🫘',
    edamame: '🫛', 'haricots rouges': '🫘', steak: '🥩', jambon: '🥓',
    saucisson: '🌭', sardines: '🐟', maquereau: '🐟', chorizo: '🌭', lardons: '🥓',
    avoine: '🌾', 'flocons avoine': '🌾', 'riz complet': '🍚', riz: '🍚',
    quinoa: '🌾', sarrasin: '🌾', boulgour: '🌾', millet: '🌾',
    'patate douce': '🍠', 'pomme de terre': '🥔', 'pain complet': '🍞',
    'pain de mie': '🍞', pates: '🍝', semoule: '🌾', banane: '🍌', datte: '🌴',
    pomme: '🍎', myrtille: '🫐', sucre: '🍬', soda: '🥤', biscuit: '🍪',
    confiture: '🍓', miel: '🍯', 'huile olive': '🫒', avocat: '🥑', noix: '🥜',
    amandes: '🥜', noisette: '🥜', 'graines courge': '🎃', chia: '⚫', tahini: '🥣',
    olive: '🫒', cajou: '🥜', pistache: '🥜', cacahuete: '🥜',
    'beurre cacahuete': '🥜', beurre: '🧈', 'creme fraiche': '🥛', mayonnaise: '🥣'
  };
  function emo(nom) { return EMO[nom] || '🍽️'; }

  function r0(v) { return Math.round(v) || 0; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ═══ LA NOTE D'UN ALIMENT COMME SOURCE D'UNE MACRO ═══════
     Deux mesures, plus un ajustement de qualité :

     • `densite` — grammes de la macro pour 100 g d'aliment. C'est ce qu'on
       obtient : à 31 g/100 g, 150 g de poulet donnent 46 g de protéines.
     • `cout` — combien de kcal il faut avaler pour UN gramme de la macro,
       rapporté au minimum théorique (4 kcal/g pour protéines et glucides,
       9 pour les lipides). 1,0 = l'aliment n'apporte que cette macro ; 3,0 = il
       faut manger trois fois l'énergie du gramme utile pour l'obtenir. C'est ce
       que ça coûte.
     • `qualite` — ce que les quatre chiffres ne peuvent pas voir (voir
       l'encadré de `QUALITE`).

     ⚠️ LA DENSITÉ EST UN PRÉALABLE, PAS UNE MOYENNE. Sans elle, une eau
     aromatisée à 0,2 g de protéines pour 1 kcal aurait un coût parfait de 1,0 et
     serait donc « excellente » source de protéines. On ne note donc que ce qui
     en apporte assez pour compter, et on le dit.
  */
  var DENSITE_MIN = { p: 6, g: 8, l: 4 };   // g/100 g en dessous desquels ce n'est pas une source

  function dansFamille(nom, liste) {
    // Nom EXACT, jamais en sous-chaîne : « ail » se trouve dans « volaille ».
    for (var i = 0; i < liste.length; i++) if (liste[i] === nom) return true;
    return false;
  }

  /**
   * @param {string} nom  une clé de la table de `core.js`
   * @param {string} k    'p' | 'g' | 'l'
   * @returns {null|object} null si l'aliment n'est pas chiffrable, ou si ce
   *          n'est pas une source de cette macro.
   */
  function note(nom, k) {
    var m = MACROS[k];
    if (!m || !window.Natty || !Natty.getNutri) return null;
    var n = Natty.getNutri(nom, 100);
    /* ⚠️ Un nom que la table ne connaît pas rend `null` — et on rend `null` à
       notre tour, plutôt qu'une ligne à 0 g. Une source affichée à zéro dans
       une liste des « meilleures sources » est un chiffre faux en évidence. */
    if (!n) return null;
    var densite = n[k] || 0;
    if (densite < DENSITE_MIN[k]) return null;
    var kcal = n.c || 0;
    // Coût : kcal à manger par gramme de macro, rapporté au minimum théorique.
    var cout = densite > 0 ? (kcal / densite) / m.kcalParG : 99;

    var q = QUALITE[k] || {};
    var bonus = q.bonus && dansFamille(nom, q.bonus.mots);
    var malus = q.malus && dansFamille(nom, q.malus.mots);

    /* ⚠️⚠️ LE COÛT MESURE LA PURETÉ — DONC IL RÉCOMPENSE LE RAFFINEMENT.
       C'est le défaut de fond de ce calcul, et le banc l'a mis à nu : le SUCRE
       BLANC (100 g de glucides pour 400 kcal) et la MAYONNAISE (78 g de lipides
       pour 700 kcal) atteignent le coût théorique PARFAIT de 1,0 — ce sont, du
       point de vue de la mesure, les meilleures sources possibles. Un simple
       cran de malus les laissait à « Très bien », c'est-à-dire exactement la
       phrase qu'on voulait éviter d'écrire.

       Un malus PLAFONNE donc la note à « Moyen », au lieu de la décaler : ce
       n'est pas une nuance mais un jugement. Une charcuterie n'est jamais une
       BONNE source de protéines, quelle qu'en soit la teneur.

       ⚠️ Et « Mauvais » est réservé aux calories vides, ce qui est MESURABLE :
       un aliment de la famille pénalisée qui n'apporte quasiment rien d'autre
       que la macro visée (moins de 2 g des deux autres pour 100 g). Sucre, soda,
       confiture, mayonnaise, beurre en sont ; un biscuit, qui apporte au moins
       du gras et un peu de protéines, reste « Moyen ». Sans ce second critère,
       la note la plus basse que Pablo a demandée n'aurait jamais servi. */
    var rang = cout <= 1.55 ? 5 : cout <= 2.1 ? 4 : cout <= 3.0 ? 3 : cout <= 4.5 ? 2 : 1;
    if (bonus) rang = Math.min(5, rang + 1);
    var autres = ['p', 'l', 'g'].filter(function (x) { return x !== k; });
    var vide = autres.every(function (x) { return (n[x] || 0) < 2; });
    if (malus) rang = Math.min(rang, vide ? 1 : 2);

    var nt = NOTES.filter(function (x) { return x.r === rang; })[0];
    var raisons = [];
    raisons.push(r1(densite) + ' g / 100 g');
    raisons.push(r1(cout * m.kcalParG) + ' kcal par gramme');
    if (bonus) raisons.push(q.bonus.txt);
    if (malus) raisons.push(q.malus.txt);
    if (malus && vide) raisons.push('n’apporte presque rien d’autre');

    return {
      nom: nom, em: emo(nom), k: k,
      densite: r1(densite), kcal: r0(kcal), cout: r1(cout),
      macros: { p: n.p, l: n.l, g: n.g, c: n.c },
      rang: rang, note: nt.nom, coul: nt.coul,
      pourquoi: raisons.join(' · ')
    };
  }

  /**
   * Les ingrédients qui apportent le plus de cette macro, classés PAR APPORT.
   *
   * ⚠️⚠️ PAR DENSITÉ, ET SURTOUT PAS PAR NOTE. C'est la demande au mot :
   * « les ingrédients qui détiennent le plus gros apport pour la macro
   * concernée, avec une note ». Trié par note — ce qu'a fait la première
   * version — les douze premiers étaient tous « Excellent » ou « Très bien » :
   * la note n'apprenait donc rien, elle ne faisait que confirmer un tri qu'on
   * venait d'appliquer. Vu au banc.
   *
   * Classé par apport, le saucisson (24 g/100 g) apparaît près du poulet
   * (31 g) — et c'est LÀ que sa note « Moyen » dit quelque chose. Toute
   * l'utilité d'une note est d'apparaître à côté de ce qu'elle nuance.
   * À apport égal, la meilleure note passe devant.
   */
  function sources(k, n) {
    var out = (SOURCES[k] || []).map(function (x) { return note(x, k); })
      .filter(Boolean)
      .sort(function (a, b) {
        if (Math.abs(b.densite - a.densite) > 0.05) return b.densite - a.densite;
        return b.rang - a.rang;
      });
    return n ? out.slice(0, n) : out;
  }

  /* ═══ LES PLATS PROPOSÉS ══════════════════════════════════
     Ils viennent du CATALOGUE (`assets/decouverte.js`) : 94 plats avec leur
     photo, leurs grammages et des macros CALCULÉES depuis ces grammages. Trois
     raisons de les préférer à un appel à l'IA :
       • ils sont déjà là — pas d'attente, pas de facture, et ça marche hors
         ligne comme le reste de l'écran ;
       • leurs macros sont vérifiables, alors qu'un plat inventé à la demande
         annonce des chiffres que personne ne peut recompter ;
       • ils portent une RECETTE (champ `rec`), donc le plat proposé peut se
         cuisiner — un carrousel qui ne mène à rien n'aurait servi qu'à décorer.

     ⚠️ Sans le module, la section le dit et disparaît : un carrousel vide est
     pire qu'un carrousel absent. */
  function plats(k, creneau, n) {
    if (!window.NattyDecouverte || !NattyDecouverte.tous) return [];
    var reste = resteDe(creneau);
    var out = [];
    NattyDecouverte.tous().forEach(function (p) {
      var r = NattyDecouverte.recette ? NattyDecouverte.recette(p.cle) : null;
      var mac = r && r.macros;
      if (!mac || !mac.kcal) return;
      var g = mac[k] || 0;
      if (g <= 0) return;
      /* Le score : ce que le plat apporte de la macro visée, rapporté à ses
         calories — donc « à quel point ce plat sert CETTE macro ». Puis une
         pénalité s'il dépasse nettement ce qu'il reste de place sur le créneau,
         exactement comme `classer()` du bouton `+`. */
      var s = (g * MACROS[k].kcalParG) / mac.kcal;
      if (reste && reste.c > 0 && mac.kcal > reste.c * 1.35) s -= 0.35;
      out.push({
        cle: p.cle, nom: p.n, pays: p.paysNom || '', drapeau: p.drapeau || '',
        img: NattyDecouverte.vignette ? NattyDecouverte.vignette(p) : '',
        macros: { p: mac.p || 0, g: mac.g || 0, l: mac.l || 0, c: mac.kcal || 0 },
        apport: g, pourquoi: (p.t || []).slice(0, 2).join(' · '),
        _s: s
      });
    });
    return out.sort(function (a, b) { return b._s - a._s; }).slice(0, n || 6);
  }

  /* ── Ce que les créneaux savent ──────────────────────────── */
  function blocs() {
    if (!window.NattyCreneaux || !NattyCreneaux.CANON) return null;
    return NattyCreneaux.CANON.map(function (b) {
      var c = NattyCreneaux.par ? NattyCreneaux.par(b.cle) : null;
      var mange = NattyCreneaux.mange ? NattyCreneaux.mange(b.cle) : null;
      return {
        cle: b.cle, nom: b.nom, court: b.court, em: b.em, illu: b.illu,
        cible: (c && c.cible) || null, mange: mange || { p: 0, l: 0, g: 0, c: 0 },
        horsPlan: !c
      };
    });
  }

  function resteDe(cle) {
    if (!cle || !window.NattyCreneaux || !NattyCreneaux.restant) return null;
    return NattyCreneaux.restant(cle);
  }

  return {
    MACROS: MACROS, NOTES: NOTES,
    note: note, sources: sources, plats: plats, blocs: blocs, emo: emo,
    /* Pour les bancs : la liste des noms proposés, afin de vérifier qu'ils sont
       TOUS résolus par la table — un nom qui ne l'est pas disparaîtrait en
       silence de la liste, et personne ne verrait qu'il manque. */
    _SOURCES: SOURCES, _esc: esc, _r0: r0, _r1: r1
  };
})();

/* ═══════════════════════════════════════════════════════════
   La mise en scène — ajoutée au module ci-dessus.
   ───────────────────────────────────────────────────────────
   Séparée du modèle par un second IIFE : ce qui précède se vérifie au chiffre
   près en Node, ce qui suit ne se juge qu'à l'écran. Les mélanger aurait rendu
   le premier intestable sans navigateur.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var G = window.NattyMacroGuide;
  if (!G) return;

  var ID = 'nmg';
  var racine = null, feuille = false, scene = null, ouvert = false;
  var S = null;          // { k, bloc }

  function esc(t) { return G._esc(t); }
  function r0(v) { return G._r0(v); }

  /* ⚠️ Les jetons `--nt-*` d'`assets/theme.js`, pas ceux de la page : ce module
     s'invite sur `suivi.html`, dont le jeu de variables est plus ancien. Mais
     l'écran est NOIR dans les deux thèmes, comme `assets/ajout.js` et
     `assets/planning.js` — c'est une cinématique, le noir y est une matière et
     non une surface d'interface. Ne pas « corriger » ses `#fff`. */
  var CSS = [
    '#' + ID + '{position:fixed;inset:0;z-index:11800;background:#0b0b0e;color:#f4f4f7;',
    'font-family:Inter,-apple-system,system-ui,sans-serif;display:none;opacity:0;',
    'transition:opacity .28s ease}',
    '#' + ID + '.on{display:block;opacity:1}',
    /* ⚠️ Règle 41 : le nœud survit à son fondu. Invisible et cliquable, il
       avalerait les taps une demi-seconde après la fermeture. */
    '#' + ID + ':not(.on){pointer-events:none}',
    /* ⚠️⚠️ LE PARE-FEU, ET SURTOUT LE PRÉFIXE `nmg-` SUR TOUTES LES CLASSES.
       Ce module s'invite sur `suivi.html`, qui a sa propre feuille. Avec des
       noms courts — `.hero`, `.dots`, `.col` —, les règles de la page
       s'appliquaient à mes éléments : mesuré à l'écran, `.hero{border-radius:28px;
       padding:26px 22px;background:var(--metal-black)}` de `suivi.html` (la carte
       noire des calories) posait un grand bandeau sombre derrière l'illustration
       du titre, et `.dots{font-size:16px;letter-spacing:1px}` cassait les points
       du carrousel.
       Le pare-feu de `bilan.js` (`#id *{margin:0;padding:0;border:0}`) ne suffit
       PAS ici : il ne couvre ni `background` ni `border-radius`. Seul le préfixe
       met à l'abri, et il faut donc le tenir sur toute nouvelle classe. */
    '#' + ID + ' *{margin:0;padding:0;border:0;box-sizing:border-box;',
    'font-family:inherit;-webkit-tap-highlight-color:transparent;background:none}',
    /* ⚠️⚠️ LA COLONNE N'A AUCUN REMBOURRAGE HORIZONTAL, et c'est délibéré.
       Le carrousel doit aller d'un bord à l'autre. Avec un rembourrage sur la
       colonne, il fallait le reprendre par une marge négative — et mesuré au
       banc, cela donnait 34 px de contenu HORS de la colonne, clippés en
       silence par `overflow-x:hidden` (409 px pour 375 de large). C'est
       exactement le défaut payé sur le récap d'`assets/ajout.js` le 2026-09-04 :
       une marge négative dans une boîte qui défile ne « déborde » pas
       gratuitement, elle élargit le contenu.
       Le rembourrage vit donc sur les ENFANTS, et le carrousel s'en passe. */
    '#' + ID + ' .nmg-col{height:100%;max-width:480px;margin:0 auto;display:flex;',
    'flex-direction:column;padding:calc(env(safe-area-inset-top) + 14px) 0 0;',
    'overflow-y:auto;overflow-x:hidden}',
    '#' + ID + ' .nmg-bar{display:flex;align-items:center;gap:10px;flex:0 0 auto;',
    'padding:0 20px}',
    '#' + ID + ' .nmg-bar .nmg-kick{flex:1 1 auto;font-size:11px;font-weight:700;letter-spacing:1.6px;',
    'text-transform:uppercase;color:#7a7a86}',
    '#' + ID + ' .nmg-x{flex:none;width:34px;height:34px;border-radius:50%;background:#1a1a20;',
    'color:#9a9aa4;font-size:17px;line-height:34px;text-align:center;cursor:pointer}',
    '#' + ID + ' h1{font-size:29px;font-weight:800;letter-spacing:-1px;line-height:1.1;',
    'margin:14px 20px 0;text-align:center}',
    '#' + ID + ' .nmg-sous{font-size:13.5px;color:#9a9aa4;line-height:1.5;margin:10px auto 0;',
    'text-align:center;max-width:340px;padding:0 20px}',
    '#' + ID + ' .nmg-hero{display:flex;justify-content:center;margin-top:8px}',
    /* ── La grille de quatre blocs (la demande : « quatre blocs posés en
       quadrillage ») ── */
    '#' + ID + ' .nmg-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 20px 10px}',
    '#' + ID + ' .nmg-bl{position:relative;background:linear-gradient(157deg,#16171c,#0d0e11);',
    'border-radius:22px;padding:15px 14px 13px;text-align:left;cursor:pointer;',
    'box-shadow:0 10px 28px -14px rgba(0,0,0,.8);overflow:hidden}',
    '#' + ID + ' .nmg-bl::before{content:"";position:absolute;inset:0;border-radius:inherit;',
    'padding:1px;pointer-events:none;background:linear-gradient(203deg,',
    'rgba(255,255,255,.4) 0%,rgba(255,255,255,.06) 28%,transparent 55%);',
    '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);',
    '-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);',
    'mask-composite:exclude}',
    '#' + ID + ' .nmg-bl .nmg-ic{color:#f4f4f7;opacity:.9}',
    '#' + ID + ' .nmg-bl .nmg-nm{font-size:14px;font-weight:700;margin-top:8px}',
    '#' + ID + ' .nmg-bl .nmg-vl{font-size:12px;font-weight:600;margin-top:5px}',
    '#' + ID + ' .nmg-bl .nmg-pi{height:5px;border-radius:3px;background:#22232a;margin-top:9px;overflow:hidden}',
    '#' + ID + ' .nmg-bl .nmg-pi i{display:block;height:100%;width:0;border-radius:3px;',
    'transition:width .85s cubic-bezier(.22,1,.36,1)}',
    '#' + ID + ' .nmg-bl.nmg-hp{opacity:.6}',
    /* ── Le carrousel, repris d'`assets/ajout.js` : même geste, même grammaire.
       `scroll-snap`, jamais un suivi de pointeur maison (voir §7). ── */
    '#' + ID + ' .nmg-sec{font-size:11px;font-weight:700;letter-spacing:1.6px;',
    'text-transform:uppercase;color:#7a7a86;margin:22px 20px 11px}',
    /* Plus de marge négative : la colonne n'a pas de rembourrage, le carrousel
       porte le sien et va d'un bord à l'autre sans rien élargir. */
    '#' + ID + ' .nmg-carou{display:flex;gap:13px;overflow-x:auto;scroll-snap-type:x mandatory;',
    'padding:0 20px 4px;scrollbar-width:none}',
    '#' + ID + ' .nmg-carou::-webkit-scrollbar{display:none}',
    '#' + ID + ' .nmg-cd{flex:0 0 74%;scroll-snap-align:center;background:#14151a;',
    'border-radius:22px;overflow:hidden;cursor:pointer}',
    '#' + ID + ' .nmg-cd .nmg-ph{position:relative;height:126px;background:#1c1d23}',
    '#' + ID + ' .nmg-cd .nmg-ph img{width:100%;height:100%;object-fit:cover;display:block}',
    '#' + ID + ' .nmg-cd .nmg-ap{position:absolute;right:9px;bottom:9px;font-size:11.5px;font-weight:800;',
    'padding:4px 9px;border-radius:11px;background:rgba(10,10,12,.72);',
    '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
    '#' + ID + ' .nmg-cd .nmg-bd{padding:11px 13px 13px}',
    '#' + ID + ' .nmg-cd .nmg-t{font-size:14px;font-weight:700;line-height:1.25}',
    '#' + ID + ' .nmg-cd .nmg-w{font-size:11px;color:#8a8a94;margin-top:4px}',
    '#' + ID + ' .nmg-cd .nmg-mm{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}',
    '#' + ID + ' .nmg-cd .nmg-mm span{font-size:10.5px;font-weight:600;background:#1e1f26;',
    'border-radius:8px;padding:3px 7px;color:#b8b8c2}',
    '#' + ID + ' .nmg-dots{display:flex;gap:5px;justify-content:center;margin-top:11px}',
    '#' + ID + ' .nmg-dots i{width:5px;height:5px;border-radius:50%;background:#2c2d35}',
    '#' + ID + ' .nmg-dots i.on{background:#f4f4f7;width:15px;border-radius:3px}',
    /* ── La liste des aliments notés ── */
    '#' + ID + ' .nmg-al{display:flex;align-items:center;gap:11px;padding:10px 12px;',
    'background:#13141a;border-radius:16px;margin:0 20px 8px}',
    '#' + ID + ' .nmg-al .nmg-em{flex:none;width:34px;height:34px;border-radius:11px;background:#1d1e25;',
    'font-size:17px;line-height:34px;text-align:center}',
    '#' + ID + ' .nmg-al .nmg-bd{flex:1 1 auto;min-width:0}',
    '#' + ID + ' .nmg-al .nmg-nm{font-size:13.5px;font-weight:600;text-transform:capitalize}',
    '#' + ID + ' .nmg-al .nmg-mc{font-size:10.5px;color:#8a8a94;margin-top:3px}',
    '#' + ID + ' .nmg-al .nmg-nt{flex:none;text-align:right}',
    '#' + ID + ' .nmg-al .nmg-nt b{display:block;font-size:11.5px;font-weight:800}',
    '#' + ID + ' .nmg-al .nmg-nt u{display:block;text-decoration:none;font-size:15px;font-weight:800;',
    'letter-spacing:-.4px;color:#f4f4f7;margin-top:1px}',
    '#' + ID + ' .nmg-note-b{font-size:10.5px;color:#6e6e78;line-height:1.45;margin:4px 20px 20px}',
    '#' + ID + ' .nmg-cta{position:sticky;bottom:0;',
    'padding:14px 20px calc(env(safe-area-inset-bottom) + 16px);',
    'background:linear-gradient(to top,#0b0b0e 40%,rgba(11,11,14,0));flex:0 0 auto}',
    '#' + ID + ' .nmg-cta button{display:block;width:100%;padding:15px;border-radius:17px;',
    'font-size:15px;font-weight:700;cursor:pointer;background:#f4f4f7;color:#0b0b0e}',
    '#' + ID + ' .nmg-cta button.nmg-g{background:transparent;color:#8a8a94;font-weight:600;',
    'font-size:13.5px;padding:11px}'
  ].join('');

  function css() {
    if (feuille) return;
    feuille = true;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function ill(nom, taille) {
    return window.NattyCine
      ? '<div class="nmg-hero">' + NattyCine.illu(nom, { taille: taille || 78, halo: true }) + '</div>'
      : '';
  }
  function icone(nom) {
    return window.NattyCine ? '<span class="nmg-ic">' + NattyCine.illu(nom, { taille: 30 }) + '</span>' : '';
  }

  function monter() {
    css();
    racine = document.getElementById(ID);
    if (!racine) {
      racine = document.createElement('div');
      racine.id = ID;
      racine.innerHTML = '<div class="nmg-col" id="' + ID + 'Col">'
        + '<div class="nmg-bar"><div class="nmg-kick" id="' + ID + 'Kick"></div>'
        + '<div class="nmg-x" id="' + ID + 'X" role="button" aria-label="Fermer">✕</div></div>'
        + '<div id="' + ID + 'Zone"></div>'
        + '<div class="nmg-cta" id="' + ID + 'Cta"></div></div>';
      document.body.appendChild(racine);
      racine.querySelector('#' + ID + 'X').addEventListener('click', fermer);
    }
  }

  /* Un plan. Même contrat que `bloc()` du bilan : le bouton d'action vit dans
     une barre FIXE, jamais dans le plan animé — dans le plan, l'animation de
     sortie l'emporte et il disparaît sous le doigt (leçon `narration.html`). */
  function plan(o) {
    var z = racine.querySelector('#' + ID + 'Zone');
    var cta = racine.querySelector('#' + ID + 'Cta');
    racine.querySelector('#' + ID + 'Kick').textContent = o.kick || '';
    var pas = window.NattyCine ? NattyCine.passage(o.sens || 1) : null;

    var vieux = scene;
    if (vieux) {
      if (pas) vieux.classList.add(pas.sortie);
      vieux.style.pointerEvents = 'none';
      setTimeout(function () { if (vieux.parentNode) vieux.parentNode.removeChild(vieux); }, 380);
    }
    var d = document.createElement('div');
    if (pas) d.className = pas.entree;
    d.innerHTML = o.html || '';
    z.appendChild(d);
    scene = d;

    cta.innerHTML = '';
    (o.boutons || []).forEach(function (b) {
      var el = document.createElement('button');
      el.type = 'button';
      if (b.cls) el.className = b.cls;
      el.textContent = b.txt;
      el.addEventListener('click', b.on);
      cta.appendChild(el);
    });

    if (o.pret) o.pret(d);
    /* LE FILET. Une page qui ne peint pas ne joue aucune animation : tout ce
       qui part d'`opacity:0` y resterait, et l'écran serait vide. */
    if (window.NattyCine) NattyCine.animer(d, 1000);
    racine.querySelector('#' + ID + 'Col').scrollTop = 0;
  }

  /* ── Scène 1 : les quatre blocs ─────────────────────────── */
  function scBlocs() {
    var m = G.MACROS[S.k];
    var bl = G.blocs();
    if (!bl) { fermer(); return; }

    var cj = (window.NattyCreneaux && NattyCreneaux.cibleJour) ? NattyCreneaux.cibleJour() : null;
    var mj = (window.NattyCreneaux && NattyCreneaux.mangeJour) ? NattyCreneaux.mangeJour() : null;
    var reste = (cj && mj) ? Math.max(0, r0((cj[S.k] || 0) - (mj[S.k] || 0))) : null;

    plan({
      kick: m.nom,
      html: ill(m.illu, 74)
        + '<h1>' + esc(m.nom) + '</h1>'
        + '<div class="nmg-sous">'
        + (reste === null
            ? 'Sur quel repas voulez-vous agir ?'
            : (reste > 0
                ? 'Il vous reste <b>' + reste + ' g</b> à couvrir aujourd’hui. '
                  + 'Sur quel repas voulez-vous agir ?'
                : 'Votre objectif du jour est atteint. Sur quel repas voulez-vous '
                  + 'préparer la suite ?'))
        + '</div>'
        + '<div class="nmg-grid">' + bl.map(function (b, i) { return blocHTML(b, i); }).join('') + '</div>',
      pret: function (d) {
        // Les jauges se posent APRÈS le rendu, sinon la transition n'a rien à
        // animer. Doublé d'un `setTimeout` : règle 43.
        var poser = function () {
          d.querySelectorAll('.nmg-pi i[data-pc]').forEach(function (i) {
            i.style.width = i.getAttribute('data-pc') + '%';
          });
        };
        requestAnimationFrame(function () { requestAnimationFrame(poser); });
        setTimeout(poser, 120);
        d.querySelectorAll('[data-bloc]').forEach(function (el) {
          el.addEventListener('click', function () {
            S.bloc = el.getAttribute('data-bloc');
            scDetail();
          });
        });
      },
      boutons: [{ txt: 'Voir le conseil de la semaine', cls: 'nmg-g', on: versConseil }]
    });
  }

  function blocHTML(b, i) {
    var m = G.MACROS[S.k];
    var v = b.mange[S.k] || 0, o = b.cible ? (b.cible[S.k] || 0) : 0;
    var pc = o ? Math.max(0, Math.min(100, Math.round(v / o * 100))) : 0;
    return '<div class="nmg-bl' + (b.horsPlan ? ' nmg-hp' : '') + '" data-bloc="' + b.cle + '"'
      + ' data-c="' + (i + 1) + '" role="button">'
      + icone(b.illu)
      + '<div class="nmg-nm">' + esc(b.nom) + '</div>'
      /* ⚠️ La fraction, pas le seul pourcentage : « 35 / 48 g » se recompte.
         Et rien d'inventé quand le rythme ne prévoit pas ce repas — on ne
         fabrique pas une cible pour avoir un denominateur. */
      + '<div class="nmg-vl" style="color:' + m.coul + '">'
      + (b.horsPlan ? (v ? r0(v) + ' g notés' : 'Hors de votre rythme')
                    : r0(v) + ' / ' + r0(o) + ' g')
      + '</div>'
      + '<div class="nmg-pi"><i data-pc="' + pc + '" style="background:' + m.coul + '"></i></div>'
      + '</div>';
  }

  /* ── Scène 2 : le carrousel et les aliments notés ───────── */
  function scDetail() {
    var m = G.MACROS[S.k];
    var b = (G.blocs() || []).filter(function (x) { return x.cle === S.bloc; })[0];
    if (!b) { scBlocs(); return; }

    var pl = G.plats(S.k, S.bloc, 6);
    var al = G.sources(S.k, 12);
    var v = b.mange[S.k] || 0, o = b.cible ? (b.cible[S.k] || 0) : 0;
    var manque = o ? Math.max(0, r0(o - v)) : null;

    plan({
      kick: b.nom + ' · ' + m.nom,
      html: '<h1>' + esc(b.nom) + '</h1>'
        + '<div class="nmg-sous">'
        + (manque === null
            ? 'Ce qui apporte le plus de ' + m.nom.toLowerCase() + '.'
            : (manque > 0
                ? 'Il manque <b>' + manque + ' g</b> de ' + m.nom.toLowerCase()
                  + ' sur ce repas. Voilà par quoi les prendre.'
                : 'Ce repas a sa part de ' + m.nom.toLowerCase()
                  + '. Voilà de quoi le composer la prochaine fois.'))
        + '</div>'
        + (pl.length
            ? '<div class="nmg-sec">Des plats qui en apportent</div>'
              + '<div class="nmg-carou" id="' + ID + 'Car">'
              + pl.map(function (p) { return plaqueHTML(p); }).join('')
              + '</div><div class="nmg-dots" id="' + ID + 'Dots">'
              + pl.map(function (_, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('')
              + '</div>'
            : '')
        + '<div class="nmg-sec">Les ingrédients qui en portent le plus</div>'
        + al.map(function (a, i) { return alimentHTML(a, i); }).join('')
        /* ⚠️ CETTE LIGNE EST CE QUI REND LES NOTES DISCUTABLES. Une note posée
           sans dire de quoi elle est faite est une note à croire. */
        + '<div class="nmg-note-b">Valeurs pour 100 g, prises dans la table qui compte '
        + 'vos repas. La note tient à deux choses mesurées — combien l’aliment en '
        + 'apporte, et combien de calories il faut avaler pour un gramme — puis à '
        + 'ce que ces chiffres ne peuvent pas voir : fibres, type de gras, degré '
        + 'de transformation.</div>',
      pret: function (d) {
        var car = d.querySelector('#' + ID + 'Car');
        var dots = d.querySelector('#' + ID + 'Dots');
        if (car && dots) {
          /* La position se relit dans un `scroll` amorti par rAF — le geste est
             un `scroll-snap`, c'est le navigateur qui le porte. */
          var arme = false;
          car.addEventListener('scroll', function () {
            if (arme) return;
            arme = true;
            requestAnimationFrame(function () {
              arme = false;
              var n = dots.children.length;
              var i = Math.round(car.scrollLeft / (car.scrollWidth / n));
              for (var j = 0; j < n; j++) {
                dots.children[j].className = (j === Math.min(i, n - 1)) ? 'on' : '';
              }
            });
          }, { passive: true });
        }
        d.querySelectorAll('[data-plat]').forEach(function (el) {
          el.addEventListener('click', function () { ouvrirPlat(el.getAttribute('data-plat')); });
        });
      },
      boutons: [
        { txt: 'Un autre repas', on: function () { S.bloc = null; scBlocs(); } },
        { txt: 'Voir le conseil de la semaine', cls: 'nmg-g', on: versConseil }
      ]
    });
  }

  function plaqueHTML(p) {
    var m = G.MACROS[S.k];
    return '<div class="nmg-cd" data-plat="' + esc(p.cle) + '">'
      + '<div class="nmg-ph">' + (p.img ? '<img src="' + esc(p.img) + '" alt="" loading="lazy">' : '')
      + '<span class="nmg-ap" style="color:' + m.coul + '">' + r0(p.apport) + ' g</span></div>'
      + '<div class="nmg-bd"><div class="nmg-t">' + esc(p.nom) + '</div>'
      + '<div class="nmg-w">' + esc([p.drapeau + ' ' + p.pays, p.pourquoi].filter(function (x) {
          return String(x).trim();
        }).join(' · ')) + '</div>'
      + '<div class="nmg-mm"><span>' + r0(p.macros.c) + ' kcal</span>'
      + '<span>🥩 ' + r0(p.macros.p) + ' g</span>'
      + '<span>🌾 ' + r0(p.macros.g) + ' g</span>'
      + '<span>🥑 ' + r0(p.macros.l) + ' g</span></div></div></div>';
  }

  function alimentHTML(a, i) {
    return '<div class="nmg-al" data-c="' + Math.min(8, i + 1) + '">'
      + '<div class="nmg-em">' + a.em + '</div>'
      + '<div class="nmg-bd"><div class="nmg-nm">' + esc(a.nom) + '</div>'
      + '<div class="nmg-mc">' + esc(a.pourquoi) + '</div></div>'
      + '<div class="nmg-nt"><b style="color:' + a.coul + '">' + a.note + '</b>'
      + '<u>' + a.densite + ' g</u></div></div>';
  }

  /* Un plat du carrousel ouvre sa page — celle de « Découvrir », la MÊME que
     partout ailleurs dans l'app (une seule visionneuse, §3). On se ferme
     d'abord : elle se monte par-dessus, et laisser cet écran dessous garderait
     son `overflow:hidden` sur le body. */
  function ouvrirPlat(cle) {
    if (!window.NattyDecouverte || !NattyDecouverte.ouvrir) return;
    var p = NattyDecouverte.platParCle ? NattyDecouverte.platParCle(cle) : null;
    if (!p) return;
    fermer();
    setTimeout(function () { NattyDecouverte.ouvrir({ plats: [p], index: 0 }); }, 240);
  }

  /* Le conseil de la semaine reste dans `#ovMacro` de `suivi.html` : il porte le
     texte généré, le plat de la semaine et les aliments à privilégier, que ce
     guide ne remplace pas. On lui passe la main. */
  function versConseil() {
    var k = S && S.k;
    fermer();
    var nom = { p: 'prot', g: 'gluc', l: 'lip' }[k] || 'prot';
    if (typeof window.openMacroPopup === 'function') {
      setTimeout(function () { window.openMacroPopup(nom); }, 240);
    }
  }

  function fermer() {
    if (!racine) return;
    ouvert = false;
    racine.classList.remove('on');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (ouvert || !racine) return;
      var z = racine.querySelector('#' + ID + 'Zone');
      if (z) z.innerHTML = '';
      racine.querySelector('#' + ID + 'Cta').innerHTML = '';
      scene = null;
    }, 320);
  }

  /**
   * @param {string} k  'p' | 'g' | 'l' — ou 'prot' | 'gluc' | 'lip'
   * @returns {boolean} false si le guide ne peut pas s'ouvrir (modules absents)
   */
  function ouvrir(k) {
    var clef = { prot: 'p', gluc: 'g', lip: 'l' }[k] || k;
    if (!G.MACROS[clef]) return false;
    /* ⚠️ Sans `NattyCreneaux`, il n'y a ni blocs ni cibles par repas : le guide
       rend `false` et l'appelant ouvre l'overlay habituel. Un écran de quatre
       blocs vides serait pire qu'un écran absent — c'est le défaut du bouton
       « Continuer avec Apple » (§11). */
    if (!G.blocs()) return false;
    monter();
    S = { k: clef, bloc: null };
    ouvert = true;
    racine.classList.add('on');
    document.body.style.overflow = 'hidden';   // jamais position:fixed (scroll iOS)
    scBlocs();
    return true;
  }

  G.ouvrir = ouvrir;
  G.fermer = fermer;
  G.estOuvert = function () { return !!ouvert; };
})();
