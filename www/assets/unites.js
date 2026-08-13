/* ═══════════════════════════════════════════════════════════
   Natty — Unités de saisie : grammes, millilitres, ou pièces
   ───────────────────────────────────────────────────────────
     NattyUnites.defaut(nom)            → l'unité et la quantité qui vont de soi
     NattyUnites.grammes(qte,u,nom)     → la conversion vers l'unité de la base
     NattyUnites.quantite(g,u,nom)      → l'inverse, pour réafficher une ligne
     NattyUnites.libelle(u,nom,qte)     → « g », « ml », « unité », « tranches »…
     NattyUnites.LISTE                  → les trois unités, dans l'ordre du menu

   POURQUOI CE MODULE. Toute l'app compte en GRAMMES : `meal_ingredients.
   quantity_g`, la table nutritionnelle de `core.js`, les anneaux, les cibles de
   créneau. Ça ne change pas ici — et surtout pas en base. Mais personne ne
   pense « 120 g de banane » : on pense « une banane ». La saisie et le stockage
   sont donc deux choses différentes, et c'est ce module qui fait le pont.

   ⚠️ LES GRAMMES RESTENT LA VÉRITÉ. `unite` et `qte` ne servent qu'à
   l'affichage et à la saisie ; `quantite_g` est recalculé à chaque frappe et
   c'est LUI qu'on enregistre. Une ligne dont on aurait perdu l'unité reste donc
   parfaitement juste — elle se réaffiche simplement en grammes. C'est ce qui
   permet de ne rien migrer : les 256 lignes déjà en base n'ont pas d'unité, et
   n'en ont pas besoin.

   ⚠️ CE N'EST PAS UNE TABLE DE PLUS À TENIR À JOUR EN DOUBLE. Elle ne contient
   ni calories ni macros — uniquement le POIDS d'une pièce et la densité d'un
   liquide, que `core.js` ne connaît pas et n'a pas à connaître. Aucun chiffre
   n'est dupliqué entre les deux.

   Ne dépend de rien : chargé avant `assets/ajout.js`, et utilisé aussi par
   l'éditeur de repas de `suivi.html`.
   ═══════════════════════════════════════════════════════════ */
window.NattyUnites = (function () {
  'use strict';

  var LISTE = [
    { cle: 'g',  lib: 'g'  },
    { cle: 'ml', lib: 'ml' },
    { cle: 'u',  lib: 'u'  }    // la pièce : « unité », « tranche », « dosette »…
  ];

  /* ── 1. Ce qui se compte à la pièce ───────────────────────────
     Le poids moyen d'UNE pièce, en grammes, et le mot qui la nomme. Les valeurs
     sont des moyennes de portion courante (CIQUAL / étiquetage usuel) : un
     ordre de grandeur juste vaut infiniment mieux que « 100 g » par défaut, qui
     est faux pour presque tout ce qui se compte à l'unité.

     `lib` n'est pas cosmétique : « 2 tranches de jambon » et « 2 jambons » ne
     décrivent pas la même chose, et c'est l'écran qui doit le dire. */
  var PIECE = {
    /* Fruits */
    'banane':        { g: 120, lib: 'banane' },
    'pomme':         { g: 150, lib: 'pomme' },
    'poire':         { g: 160, lib: 'poire' },
    'orange':        { g: 130, lib: 'orange' },
    'clementine':    { g: 70,  lib: 'clémentine' },
    'mandarine':     { g: 70,  lib: 'mandarine' },
    'kiwi':          { g: 75,  lib: 'kiwi' },
    'peche':         { g: 130, lib: 'pêche' },
    'nectarine':     { g: 130, lib: 'nectarine' },
    'abricot':       { g: 45,  lib: 'abricot' },
    'prune':         { g: 60,  lib: 'prune' },
    'fraise':        { g: 12,  lib: 'fraise' },
    'framboise':     { g: 4,   lib: 'framboise' },
    'mangue':        { g: 200, lib: 'mangue' },
    'ananas':        { g: 900, lib: 'ananas' },
    'citron':        { g: 100, lib: 'citron' },
    'datte':         { g: 8,   lib: 'datte' },
    'figue':         { g: 50,  lib: 'figue' },
    // Un avocat pèse ~200 g, mais on n'en mange que la chair.
    'avocat':        { g: 140, lib: 'avocat' },
    /* Légumes */
    'tomate':        { g: 120, lib: 'tomate' },
    'tomate cerise': { g: 15,  lib: 'tomate cerise' },
    'carotte':       { g: 100, lib: 'carotte' },
    'courgette':     { g: 200, lib: 'courgette' },
    'aubergine':     { g: 250, lib: 'aubergine' },
    'poivron':       { g: 150, lib: 'poivron' },
    'oignon':        { g: 110, lib: 'oignon' },
    'echalote':      { g: 30,  lib: 'échalote' },
    'ail':           { g: 5,   lib: 'gousse' },
    'pomme de terre':{ g: 150, lib: 'pomme de terre' },
    'patate douce':  { g: 200, lib: 'patate douce' },
    'concombre':     { g: 300, lib: 'concombre' },
    'endive':        { g: 130, lib: 'endive' },
    'champignon':    { g: 20,  lib: 'champignon' },
    'olive':         { g: 4,   lib: 'olive' },
    'artichaut':     { g: 300, lib: 'artichaut' },
    /* Œufs, pains, féculents à la pièce */
    'oeuf':          { g: 55,  lib: 'œuf' },
    'tranche de pain':{ g: 35, lib: 'tranche' },
    'pain de mie':   { g: 30,  lib: 'tranche' },
    'biscotte':      { g: 8,   lib: 'biscotte' },
    'baguette':      { g: 250, lib: 'baguette' },
    'wrap':          { g: 45,  lib: 'wrap' },
    'tortilla':      { g: 45,  lib: 'tortilla' },
    'crepe':         { g: 60,  lib: 'crêpe' },
    'gaufre':        { g: 40,  lib: 'gaufre' },
    'pain au chocolat':{ g: 65, lib: 'pain au chocolat' },
    'croissant':     { g: 55,  lib: 'croissant' },
    /* Viandes, poissons, charcuterie */
    'steak':         { g: 150, lib: 'steak' },
    'escalope':      { g: 130, lib: 'escalope' },
    'blanc de poulet':{ g: 150, lib: 'blanc' },
    'cuisse de poulet':{ g: 200, lib: 'cuisse' },
    'saucisse':      { g: 70,  lib: 'saucisse' },
    'merguez':       { g: 60,  lib: 'merguez' },
    'jambon':        { g: 40,  lib: 'tranche' },
    'bacon':         { g: 15,  lib: 'tranche' },
    'sardines':      { g: 25,  lib: 'sardine' },
    'crevettes':     { g: 10,  lib: 'crevette' },
    'nuggets':       { g: 20,  lib: 'nugget' },
    'cordon bleu':   { g: 120, lib: 'cordon bleu' },
    'falafel':       { g: 25,  lib: 'falafel' },
    /* Laitiers en pot ou en portion */
    'yaourt':        { g: 125, lib: 'pot' },
    'skyr':          { g: 150, lib: 'pot' },
    'petit suisse':  { g: 60,  lib: 'petit suisse' },
    'creme dessert': { g: 100, lib: 'pot' },
    'tranche de fromage':{ g: 20, lib: 'tranche' },
    /* Oléagineux et sucreries — la pièce y est minuscule, donc utile */
    'noix':          { g: 5,   lib: 'noix' },
    'amandes':       { g: 1.2, lib: 'amande' },
    'noisette':      { g: 1.2, lib: 'noisette' },
    'cajou':         { g: 1.5, lib: 'cajou' },
    'pistache':      { g: 1,   lib: 'pistache' },
    'cacahuete':     { g: 1,   lib: 'cacahuète' },
    'carre de chocolat':{ g: 6, lib: 'carré' },
    'biscuit':       { g: 12,  lib: 'biscuit' },
    'cookie':        { g: 25,  lib: 'cookie' },
    'barre cereale': { g: 25,  lib: 'barre' },
    'madeleine':     { g: 25,  lib: 'madeleine' },
    /* Compléments : la dosette est LA façon dont ils se mesurent.
       Personne ne pèse sa whey — on compte des doses, et une dose est une
       mesure fournie avec le pot. Voir aussi le bloc « compléments » de la
       table nutritionnelle de core.js. */
    'whey':              { g: 30,  lib: 'dose' },
    'proteine en poudre':{ g: 30,  lib: 'dose' },
    'isolat':            { g: 30,  lib: 'dose' },
    // Les orthographes des pots, qui sont anglaises. Même raison que dans la
    // table nutritionnelle de core.js : c'est ce que les gens tapent.
    'isolate':           { g: 30,  lib: 'dose' },
    'protein powder':    { g: 30,  lib: 'dose' },
    'pre workout':       { g: 10,  lib: 'dose' },
    'preworkout':        { g: 10,  lib: 'dose' },
    'caseine':           { g: 30,  lib: 'dose' },
    'gainer':            { g: 100, lib: 'dose' },
    'creatine':          { g: 5,   lib: 'dose' },
    'bcaa':              { g: 10,  lib: 'dose' },
    'barre proteinee':   { g: 60,  lib: 'barre' },
    // « Barre protéine » sans le second « e » : la singularisation ne rattrape
    // que les `s`/`x` finaux, elle ne relie donc pas les deux orthographes.
    'barre proteine':    { g: 60,  lib: 'barre' },
    'gel energetique':   { g: 30,  lib: 'gel' },
    'gellule':           { g: 1,   lib: 'gélule' },
    'omega 3':           { g: 1,   lib: 'capsule' },
    // Le blanc et le jaune ne pèsent pas ce que pèse l'œuf entier (55 g) : les
    // compter comme lui, c'est se tromper d'un facteur trois sur le blanc.
    'blanc oeuf':        { g: 33,  lib: 'blanc' },
    'jaune oeuf':        { g: 18,  lib: 'jaune' }
  };

  /* ⚠️⚠️ CE QUI SE MESURE À LA DOSE, MÊME NOYÉ DANS UN LIQUIDE.
     « Shaker de whey » comptait **165 g de protéines** — mesuré au banc. Les
     deux tables répondaient, `arbitrer` donnait le volume au nom-tête
     (« shaker » ouvre le groupe), donc 200 ml → 206 g, et `core.js` appliquait
     là-dessus les macros de la POUDRE, qu'il fait dominer de son côté
     (passe 0). Chacun avait raison seul ; c'est leur produit qui était absurde.

     La règle est donc la même des deux côtés : le nom d'un complément en poudre
     l'emporte. Il ne désigne jamais le contenant, toujours ce qu'on a versé
     dedans — et c'est la poudre qui porte les macros.
     ⚠️ Ne PAS étendre cette liste aux boissons prêtes (« boisson protéinée »,
     « shaker protéine ») : celles-là se comptent bien en millilitres, et leurs
     macros dans core.js sont déjà celles du liquide. */
  var POUDRES = ['whey', 'isolat', 'isolate', 'caseine', 'gainer', 'creatine',
    'bcaa', 'proteine en poudre', 'protein powder', 'pre workout', 'preworkout'];

  /* ── 2. Ce qui se mesure en volume ────────────────────────────
     La densité, en g/ml. Presque tout ce qui se boit tourne autour de 1 — et
     c'est bien pour ça qu'il faut la table : l'huile à 0,91 et le sirop à 1,3
     sont les deux qui comptent, parce que ce sont les plus caloriques au
     millilitre. Un `1` par défaut aurait donc son seul écart là où il coûte le
     plus cher. */
  var LIQUIDE = {
    'eau': 1, 'lait': 1.03, 'lait vegetal': 1.03, 'jus': 1.04, 'jus orange': 1.04,
    'soda': 1.04, 'biere': 1.01, 'vin': 0.99, 'cafe': 1, 'the': 1, 'infusion': 1,
    'bouillon': 1, 'soupe': 1.03, 'potage': 1.03, 'smoothie': 1.05,
    'huile': 0.91, 'huile olive': 0.91, 'vinaigre': 1.01, 'sirop': 1.3,
    'creme fraiche': 1, 'yaourt a boire': 1.03, 'kefir': 1.03,
    'boisson proteinee': 1.03, 'shaker': 1.03, 'ricore': 1.02, 'chocolat chaud': 1.03
  };

  /* ── 3. Rapprochement des noms ────────────────────────────────
     Même méthode que `getNutri` de core.js, et pour les mêmes raisons : mot à
     mot (« ail » ne doit pas se trouver dans « volaille »), le libellé le plus
     LONG gagnant (« pomme de terre » avant « pomme », « barre protéinée » avant
     « barre céréale »), les ligatures traduites avant de retirer la ponctuation
     (sans quoi « œuf » devient « uf » et aucun œuf n'est jamais reconnu).

     ⚠️ Volontairement PAS d'appel à core.js : `getNutri` ne rend pas la clé
     qu'elle a trouvée, seulement des macros. Reproduire la comparaison coûte
     vingt lignes ; l'alternative aurait été de changer sa signature, donc de
     toucher au calcul que tous les écrans partagent. */
  function norm(s) {
    return ' ' + String(s == null ? '' : s).toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  }

  function sing(m) {
    return (m.length > 3 && (m.slice(-1) === 's' || m.slice(-1) === 'x')) ? m.slice(0, -1) : m;
  }

  function index(table) {
    return Object.keys(table)
      .map(function (k) {
        var mots = norm(k).trim().split(' ');
        return { k: k, mots: mots, motsS: mots.map(sing) };
      })
      .sort(function (a, b) { return b.mots.length - a.mots.length || b.k.length - a.k.length; });
  }

  var I_PIECE = index(PIECE), I_LIQUIDE = index(LIQUIDE);

  function tous(mots, n) {
    return mots.every(function (m) { return n.indexOf(' ' + m + ' ') > -1; });
  }

  /**
   * La correspondance trouvée dans `idx`, avec de quoi la comparer à une autre :
   * le nombre de mots de la clé, et l'endroit où elle apparaît dans le nom.
   * Deux passes, comme core.js — l'exacte d'abord, les pluriels ensuite.
   */
  function matchDe(idx, nom) {
    var n = norm(nom), i;
    if (n.length < 3) return null;
    for (i = 0; i < idx.length; i++) {
      if (tous(idx[i].mots, n)) return { k: idx[i].k, n: idx[i].mots.length, pos: place(idx[i].mots, n) };
    }
    var nS = ' ' + n.trim().split(' ').map(sing).join(' ') + ' ';
    for (i = 0; i < idx.length; i++) {
      if (tous(idx[i].motsS, nS)) return { k: idx[i].k, n: idx[i].motsS.length, pos: place(idx[i].motsS, nS) };
    }
    return null;
  }

  /* La position du premier mot de la clé dans le nom. Sert d'arbitre quand deux
     tables répondent — voir `arbitrer`. */
  function place(mots, n) {
    var min = Infinity;
    mots.forEach(function (m) {
      var i = n.indexOf(' ' + m + ' ');
      if (i > -1 && i < min) min = i;
    });
    return min === Infinity ? 999 : min;
  }

  function cleDe(idx, nom) {
    var m = matchDe(idx, nom);
    return m ? m.k : null;
  }

  /**
   * Départage la pièce et le liquide quand les deux tables reconnaissent le nom.
   *
   * ⚠️ CE N'EST PAS UN CAS DE BORD : « huile d'olive » était compté comme UNE
   * OLIVE de 4 g. Les deux règles, dans cet ordre :
   * 1. le libellé le plus PRÉCIS gagne — « huile olive » (2 mots) passe devant
   *    « olive » (1 mot), exactement comme dans `getNutri` ;
   * 2. à égalité, celui qui apparaît le PREMIER dans le nom — en français le
   *    nom-tête ouvre le groupe : « jus de pomme » est un jus, pas une pomme.
   *
   * @returns {'u'|'ml'} l'unité à retenir
   */
  function arbitrer(nom) {
    var p = matchDe(I_PIECE, nom), l = matchDe(I_LIQUIDE, nom);
    if (!p) return l ? 'ml' : 'g';
    if (!l) return 'u';
    // Une poudre reste une poudre, même dans un shaker — voir POUDRES.
    if (POUDRES.indexOf(p.k) > -1) return 'u';
    if (l.n !== p.n) return l.n > p.n ? 'ml' : 'u';
    if (l.pos !== p.pos) return l.pos < p.pos ? 'ml' : 'u';
    return 'u';
  }

  /** Le poids d'une pièce de cet aliment, ou null s'il ne se compte pas ainsi. */
  function poidsPiece(nom) {
    var k = cleDe(I_PIECE, nom);
    return k ? PIECE[k].g : null;
  }

  /** Le nom de la pièce (« tranche », « dose »…), « unité » à défaut. */
  function nomPiece(nom) {
    var k = cleDe(I_PIECE, nom);
    return k ? PIECE[k].lib : 'unité';
  }

  function densite(nom) {
    var k = cleDe(I_LIQUIDE, nom);
    return k ? LIQUIDE[k] : null;
  }

  function estLiquide(nom) { return densite(nom) != null; }
  function estPiece(nom) { return poidsPiece(nom) != null; }

  /* ── 4. Conversions ──────────────────────────────────────────── */

  /** Les grammes que valent `qte` de l'unité `u` pour cet aliment. */
  function grammes(qte, u, nom) {
    var q = parseFloat(qte) || 0;
    if (u === 'u')  return arrondi(q * (poidsPiece(nom) || 100));
    if (u === 'ml') return arrondi(q * (densite(nom) || 1));
    return arrondi(q);
  }

  /**
   * L'inverse : la quantité à AFFICHER pour `g` grammes dans l'unité `u`.
   * Les pièces se lisent au demi près — « 1,5 banane » se comprend,
   * « 1,37 banane » non.
   */
  function quantite(g, u, nom) {
    var v = parseFloat(g) || 0;
    if (u === 'u') {
      var p = poidsPiece(nom) || 100;
      var n = v / p;
      return n < 0.5 ? Math.round(n * 10) / 10 : Math.round(n * 2) / 2;
    }
    if (u === 'ml') return arrondi(v / (densite(nom) || 1));
    return arrondi(v);
  }

  // Un gramme n'a pas de décimale utile au-dessus de 10 ; en dessous (épices,
  // huile, créatine), la première compte.
  function arrondi(v) {
    return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  }

  /** Le libellé affiché à droite du champ, accordé en nombre. */
  function libelle(u, nom, qte) {
    if (u === 'g' || u === 'ml') return u;
    var mot = nomPiece(nom);
    var n = parseFloat(qte) || 0;
    if (n > 1 && mot.slice(-1) !== 's' && mot.slice(-1) !== 'x') mot += 's';
    return mot;
  }

  /**
   * L'unité et la quantité qui vont de soi pour cet aliment.
   *
   * C'est LA fonction du module : « banane » → 1 banane, « pâtes » → 100 g,
   * « lait » → 200 ml, « whey » → 1 dose. Sans elle, chaque ligne partait à
   * « 100 g », ce qui ne veut rien dire pour un œuf (55 g) et encore moins pour
   * une dose de créatine (5 g).
   *
   * Quand les deux tables répondent, c'est `arbitrer()` qui tranche — et non
   * l'ordre des tests, qui faisait de l'huile d'olive une olive.
   *
   * @returns {{unite:string, qte:number, g:number, lib:string}}
   */
  function defaut(nom) {
    var u = arbitrer(nom);
    if (u === 'u') {
      var p = poidsPiece(nom) || 100;
      return { unite: 'u', qte: 1, g: arrondi(p), lib: libelle('u', nom, 1) };
    }
    if (u === 'ml') {
      var ml = volumeType(nom), d = densite(nom) || 1;
      return { unite: 'ml', qte: ml, g: arrondi(ml * d), lib: 'ml' };
    }
    return { unite: 'g', qte: 100, g: 100, lib: 'g' };
  }

  /* La portion courante d'un liquide : un verre (200 ml) pour ce qui se boit,
     une tasse pour le chaud, une cuillerée pour ce qui assaisonne. Proposer
     200 ml d'huile d'olive serait absurde — et 2 000 kcal. */
  var VOLUME = { 'huile': 10, 'huile olive': 10, 'vinaigre': 10, 'sirop': 20,
                 'creme fraiche': 30, 'cafe': 100, 'the': 200, 'infusion': 200,
                 'soupe': 300, 'potage': 300, 'bouillon': 250, 'biere': 330,
                 'vin': 125, 'eau': 250 };
  // Indexée une fois : `volumeType` est appelée à chaque frappe dans le champ.
  var I_VOLUME = index(VOLUME);
  function volumeType(nom) {
    var k = cleDe(I_VOLUME, nom);
    return k ? VOLUME[k] : 200;
  }

  /**
   * Applique une unité à une ligne d'ingrédient, en place.
   *
   * Les appelants (le `+` et l'éditeur de repas) manipulent tous des objets
   * `{nom, quantite_g, unite, qte}` : centraliser la mise à jour évite que l'un
   * des deux oublie de recalculer les grammes — c'est-à-dire enregistre une
   * quantité qui ne correspond pas à ce qui est affiché.
   *
   * @param {object} ing
   * @param {string} [u] l'unité voulue ; par défaut celle de la ligne
   */
  function poser(ing, u) {
    if (!ing) return ing;
    var unite = u || ing.unite || 'g';
    if (!LISTE.some(function (x) { return x.cle === unite; })) unite = 'g';
    // Changer d'unité ne change PAS la quantité réelle : on garde les grammes
    // et on recalcule le nombre affiché. Passer de « 120 g » à la pièce doit
    // donner « 1 banane », pas « 120 bananes ».
    ing.unite = unite;
    ing.qte = quantite(ing.quantite_g || 0, unite, ing.nom);
    /* ⚠️ PUIS ON RECALE LES GRAMMES SUR CE QUI EST AFFICHÉ. Les pièces se
       lisent au demi près : 130 g de banane s'affichent « 1 banane », et sans
       cette ligne l'écran annoncerait 1 banane tout en comptant 130 g dans les
       anneaux. Deux nombres du même écran qui se contredisent — précisément le
       défaut corrigé ailleurs (le titre du plat à « 0 kcal » au-dessus
       d'anneaux à 680). Ce qui est écrit fait foi.
       Le prix est assumé : basculer en pièces arrondit à la portion entière.
       C'est ce que veut dire « une banane ». */
    ing.quantite_g = grammes(ing.qte, unite, ing.nom);
    return ing;
  }

  /** Une ligne dont on vient de saisir la quantité : les grammes suivent. */
  function saisir(ing, qte) {
    if (!ing) return ing;
    ing.qte = parseFloat(qte);
    if (isNaN(ing.qte)) ing.qte = 0;
    ing.quantite_g = grammes(ing.qte, ing.unite || 'g', ing.nom);
    return ing;
  }

  /**
   * Complète une ligne qui n'a pas encore d'unité, d'après son nom.
   *
   * @param {object} ing
   * @param {boolean} [force] rebasculer même une ligne déjà réglée — utilisé
   *   quand l'utilisateur RENOMME un ingrédient qu'il n'avait pas encore
   *   quantifié à la main.
   */
  function deviner(ing, force) {
    if (!ing) return ing;
    if (ing.unite) return force ? bascule(ing) : poser(ing, ing.unite);
    /* ⚠️ UNE QUANTITÉ QUI EXISTE DÉJÀ RESTE EN GRAMMES, sauf demande explicite.
       Les lignes qui arrivent d'une analyse photo portent une estimation en
       grammes — « 130 g de banane » — et c'est une mesure, pas un défaut à
       remplacer. La convertir en « 1 banane » reviendrait à jeter l'estimation
       du modèle pour la remplacer par une portion type. La détection
       automatique sert à ce que l'utilisateur TAPE, pas à réinterpréter ce qui a
       été mesuré ; `force` est ce qui distingue les deux. */
    if (ing.quantite_g) return poser(ing, 'g');
    return bascule(ing);
  }

  /** Repart du nom : unité ET quantité type de cet aliment. */
  function bascule(ing) {
    var d = defaut(ing.nom);
    ing.unite = d.unite;
    ing.qte = d.qte;
    ing.quantite_g = d.g;
    return ing;
  }

  return {
    LISTE: LISTE,
    defaut: defaut, grammes: grammes, quantite: quantite, libelle: libelle,
    poidsPiece: poidsPiece, nomPiece: nomPiece, densite: densite,
    estLiquide: estLiquide, estPiece: estPiece,
    poser: poser, saisir: saisir, deviner: deviner
  };
})();
