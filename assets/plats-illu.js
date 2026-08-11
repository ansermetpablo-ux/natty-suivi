/* ═══════════════════════════════════════════════════════════
   Natty — les illustrations de plats, pour ceux qui n'ont pas de photo
   ───────────────────────────────────────────────────────────
     NattyPlatsIllu.svg(cle, opts)   le <svg> complet, prêt à poser
     NattyPlatsIllu.a(cle)           la clé existe-t-elle ?
     NattyPlatsIllu.cles()           toutes les clés connues

   POURQUOI CE FICHIER. Le catalogue « Découvrir » a 93 plats du monde et
   leurs 93 photos, fournies par Pablo. Les plats du QUOTIDIEN qu'on ajoute
   à côté n'en ont pas, et on ne va pas en chercher sur le web (règle §9
   #24). Plutôt qu'un emoji seul — qui donne une vignette pauvre à côté
   d'une photo pleine — chaque plat sans photo reçoit une illustration au
   trait, dans la langue graphique que l'app parle déjà partout ailleurs
   (`assets/journee.js`, `social.html`, `narration.html`).

   ⚠️ INDEXÉ PAR FORME DE PLAT, PAS PAR RECETTE. C'est la leçon d'
   `assets/recette.js`, qui indexe ses animations par GESTE et dépose
   l'aliment en slot : une bibliothèque par recette serait à rallonger à
   chaque plat ajouté, et personne ne la suivrait. Ici « bol », « assiette
   garnie », « poêlée »… couvrent chacun plusieurs plats. Une illustration
   dit donc « c'est un plat en bol », pas « c'est exactement votre
   assiette » — et c'est honnête, contrairement à une photo d'un autre plat
   posée là pour faire joli (le défaut qu'on vient de corriger sur le héros
   de `repas.html`).

   ⚠️ 24×24, `fill:none`, `stroke:currentColor`. Le même dessin sert donc en
   thème clair et sombre, sans pendant à maintenir (règle §9 #33). Ne pas y
   mettre d'aplat : sur fond noir il deviendrait une tache.
   ═══════════════════════════════════════════════════════════ */
window.NattyPlatsIllu = (function () {
  'use strict';

  /* Chaque entrée est le CONTENU d'un <svg viewBox="0 0 24 24">, sans plus.
     Trait fin et rond, comme les jalons de `journee.js`. */
  var D = {
    /* Un bol vu de trois quarts, avec ce qui dépasse. Poké, buddha bowl,
       salade composée, taboulé. */
    bol: '<path d="M3.2 10.5h17.6a8.8 8.8 0 0 1-8.8 8.2 8.8 8.8 0 0 1-8.8-8.2Z"/>'
       + '<path d="M2 19.4h20"/>'
       + '<circle cx="8.6" cy="7.4" r="1.9"/><circle cx="13.4" cy="5.8" r="1.5"/>'
       + '<path d="M16.6 8.8c1.3-1.2 2.6-1.5 3.4-1.2"/>',

    /* Une assiette ENTRE SES COUVERTS. La première version la divisait en
       trois parts et se confondait avec `tarte` — deux cercles découpés,
       impossibles à distinguer en vignette (constaté à l'écran). Le couteau
       et la fourchette lèvent l'ambiguïté d'un coup : c'est le seul dessin
       qui dit « un repas » et pas « un rond ». Même correctif que
       l'assiette-globe de `social.html`, qui se lisait « wifi » sans ses
       couverts. */
    assiette: '<circle cx="12" cy="12" r="5.6"/><circle cx="12" cy="12" r="2.8"/>'
            + '<path d="M3.4 4.6v4.2a1.8 1.8 0 0 0 1.8 1.8 1.8 1.8 0 0 0 1.8-1.8V4.6"/>'
            + '<path d="M5.2 10.6v8.8"/>'
            + '<path d="M20.4 4.6c-1.5 0-2.4 1.6-2.4 3.6s.9 2.8 2.4 2.8Z"/>'
            + '<path d="M20.4 11v8.4"/>',

    /* Une poêle vue de DESSUS, manche compris. La première version, un
       cercle et un trait, se lisait comme une loupe : le manche est
       maintenant large et attaché, et le contenu déborde le bord. */
    poele: '<circle cx="9.6" cy="12" r="6.8"/>'
         + '<path d="M16.4 10.6h5.2a1.4 1.4 0 0 1 0 2.8h-5.2"/>'
         + '<circle cx="7.4" cy="10.6" r="1.3"/><circle cx="11.4" cy="9.6" r="1.1"/>'
         + '<path d="M6.2 14.6c1.8 1.2 5 1.2 6.8 0"/>',

    /* Une casserole avec sa vapeur : soupe, potage, velouté, mijoté. */
    soupe: '<path d="M4.4 11h15.2v2.6a7.6 7.6 0 0 1-7.6 7.4 7.6 7.6 0 0 1-7.6-7.4Z"/>'
         + '<path d="M19.6 12.6c1.6 0 2.6 1 2.6 2.2s-1 2.2-2.6 2.2"/>'
         + '<path d="M9 7.6c0-1.2 1.2-1.4 1.2-2.6M13 7.6c0-1.2 1.2-1.4 1.2-2.6"/>',

    /* Un plat à gratin vu de trois quarts, avec sa croûte. */
    gratin: '<path d="M3.4 9.6h17.2v6.2a2.6 2.6 0 0 1-2.6 2.6H6a2.6 2.6 0 0 1-2.6-2.6Z"/>'
          + '<path d="M2 9.6h20"/><path d="M6.6 9.6c1-1.4 2.2-1.4 3.2 0s2.2 1.4 3.2 0 2.2-1.4 3.2 0"/>'
          + '<path d="M6 18.4v1.8M18 18.4v1.8"/>',

    /* Des pâtes : le nid et la fourchette. */
    pates: '<circle cx="12" cy="13" r="7.4"/>'
         + '<path d="M6.6 11.4c2.2 1.6 8.6 1.6 10.8 0M6.2 14.2c2.6 1.8 9 1.8 11.6 0"/>'
         + '<path d="M15.4 4.6v5.2M13.6 4.6v3M17.2 4.6v3"/>',

    /* Un poisson entier, au trait. */
    poisson: '<path d="M2.6 12c3-3.6 6.6-5.4 9.8-5.4S18.6 8.4 21.4 12c-2.8 3.6-5.8 5.4-9 5.4S5.6 15.6 2.6 12Z"/>'
           + '<circle cx="8" cy="11.2" r=".9"/><path d="M21.4 12c-.2-2-.2-4 0-6-1.8 1-3.2 2.2-4.2 3.4"/>'
           + '<path d="M21.4 12c-.2 2-.2 4 0 6-1.8-1-3.2-2.2-4.2-3.4"/>',

    /* Un œuf au plat vu de dessus — omelette, brouillés, œufs. */
    oeuf: '<path d="M4.4 13.6c0-4 2.8-7.4 6.4-7.4 2.6 0 3.6 1.8 5.4 1.8 2 0 3.4 1.4 3.4 3.4 0 3.4-3.4 6.4-7.6 6.4-4.4 0-7.6-1.8-7.6-4.2Z"/>'
        + '<circle cx="11.6" cy="11.8" r="2.6"/>',

    /* Un sandwich / wrap coupé en biais. */
    sandwich: '<path d="M3.4 15.4 12 6.2l8.6 9.2Z"/><path d="M2.4 15.4h19.2"/>'
            + '<path d="M2.4 18.2h19.2"/><path d="M8.2 12.6c1-.8 2-.8 3 0s2 .8 3 0"/>',

    /* Une tarte DONT UNE PART EST SORTIE — c'est le vide, et la part posée à
       côté, qui la rendent lisible. Entière et seulement découpée, elle se
       confondait avec l'assiette (constaté à l'écran). */
    tarte: '<path d="M12 12V3.4A8.6 8.6 0 1 0 18.1 6"/>'
         + '<path d="M12 12 5.9 18.1"/>'
         + '<path d="m20.6 8.4 2.4 6.6-6.9-.6Z"/>'
         + '<circle cx="9.4" cy="14.4" r=".9"/>',

    /* Un burger, ou tout plat empilé. */
    burger: '<path d="M4 9.6c0-2.8 3.6-4.6 8-4.6s8 1.8 8 4.6Z"/>'
          + '<path d="M4 12.4h16"/><path d="M4.6 15.4h14.8c0 2.2-1.6 3.6-4 3.6H8.6c-2.4 0-4-1.4-4-3.6Z"/>'
          + '<circle cx="9" cy="7.6" r=".7"/><circle cx="13.4" cy="7" r=".7"/>',

    /* Un yaourt / bol de skyr avec sa cuillère : collation, petit déjeuner. */
    laitier: '<path d="M6.6 8.4h10.8l-1.2 10.2a2 2 0 0 1-2 1.8h-4.4a2 2 0 0 1-2-1.8Z"/>'
           + '<path d="M5.4 8.4h13.2"/><path d="M14.4 4.6c0 1.6-1.2 2.6-2.6 2.6"/>'
           + '<circle cx="10.4" cy="12.6" r=".9"/><circle cx="13.4" cy="15" r=".9"/>',

    /* Une grillade : la pièce de viande et les marques du gril. */
    grillade: '<path d="M4.8 8.6c2.6-2 11.8-2 14.4 0 2 1.6 1.4 5.6-1 7.4-2.8 2-9.6 2-12.4 0-2.4-1.8-3-5.8-1-7.4Z"/>'
            + '<path d="M8.4 9.4 6.6 14M12 9 10.2 14.6M15.6 9.4 13.8 14"/>',

    /* Un brocoli et une carotte, côte à côte. La première version — un
       bouquet abstrait sur une tige — se lisait comme un ballon ou un arbre
       (constaté à l'écran) : deux légumes RECONNAISSABLES valent mieux
       qu'une idée de légume. */
    legumes: '<path d="M6.2 11.4c-1.5 0-2.6-1-2.6-2.3 0-1.1.7-1.9 1.7-2.2 0-1.5 1.2-2.5 2.7-2.5.8 0 1.5.3 2 .9.4-.3.9-.5 1.5-.5 1.4 0 2.5 1 2.5 2.4 0 1.7-1.4 2.9-3.2 2.9Z"/>'
           + '<path d="M8.4 11.4v8.2"/><path d="M8.4 15.2 6 13.4M8.4 16.6l2.4-1.8"/>'
           + '<path d="M17.6 8.6c1.6.6 2.6 2.2 2.6 4 0 3.6-2 7-3.4 7s-3.4-3.4-3.4-7c0-1.8 1-3.4 2.6-4"/>'
           + '<path d="M16.8 8.6V5M16.8 6.4l2.2-1.6M16.8 7.2l-2.2-1.6"/>',

    /* Un bol de céréales chaudes : porridge, riz au lait, semoule. */
    porridge: '<path d="M4 11.6h16v1.6a8 8 0 0 1-8 7.6 8 8 0 0 1-8-7.6Z"/>'
            + '<path d="M2.8 11.6h18.4"/>'
            + '<path d="M8.6 8.2c0-1.2 1.2-1.4 1.2-2.6M12 8.2c0-1.2 1.2-1.4 1.2-2.6M15.4 8.2c0-1.2 1.2-1.4 1.2-2.6"/>',

    /* Une brochette : tout ce qui est enfilé et grillé. */
    brochette: '<path d="M3.6 20.4 20.4 3.6"/><path d="M18.4 3.2 21 5.8"/>'
             + '<circle cx="8.4" cy="15.6" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="15.6" cy="8.4" r="2.1"/>'
  };

  /* Un plat peut nommer une forme qui n'existe pas — on ne casse pas
     l'écran pour autant, on rend l'assiette. Même parti pris que la clé
     `illu` inconnue d'`assets/recette.js`, qui retombe sur « melanger ». */
  var DEFAUT = 'assiette';

  function a(cle) { return !!(cle && D[cle]); }
  function cles() { return Object.keys(D); }

  /**
   * @param {string} cle    une forme de D
   * @param {object} [opts] {trait} épaisseur du trait (défaut 1.4)
   * @returns {string} un <svg> complet
   */
  function svg(cle, opts) {
    opts = opts || {};
    var d = D[cle] || D[DEFAUT];
    /* ⚠️ Le trait s'affine quand l'illustration grandit — la boîte fait 24
       unités, donc à 160 px un `stroke-width:1.4` se peint en 9 px, soit un
       gros feutre. Même piège que le `.hero` d'`assets/journee.js`. Les
       appelants qui dessinent grand passent donc un trait plus fin. */
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="' + (opts.trait || 1.4) + '" '
      + 'stroke-linecap="round" stroke-linejoin="round" '
      + 'preserveAspectRatio="xMidYMid meet">' + d + '</svg>';
  }

  return { svg: svg, a: a, cles: cles, DEFAUT: DEFAUT };
})();
