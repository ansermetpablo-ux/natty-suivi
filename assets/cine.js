/* ═══════════════════════════════════════════════════════════
   Natty — La couche cinématique partagée
   ───────────────────────────────────────────────────────────
     NattyCine.css()                 injecte la feuille, une seule fois
     NattyCine.illu(nom, opts)       le SVG d'une illustration animée
     NattyCine.animer(hote)          arme les entrées échelonnées + le FILET
     NattyCine.compteur(el, v, opts) un nombre qui monte, avec son filet
     NattyCine.vok(opts)             la coche verte, tracée en deux temps
     NattyCine.ILLUS                 les noms disponibles

   POURQUOI UN MODULE ET PAS DEUX FOIS LE MÊME CSS. Demande de Pablo
   (2026-09-03) : « rends le bilan ainsi que la saisie des séances plus
   cinématique, avec plus de transitions d'animations et d'illustrations SVG ».
   Les deux écrans sont noirs, plein écran, et racontent une séquence — ils
   veulent exactement le même vocabulaire. Le recopier dans `assets/bilan.js` et
   `assets/seance.js`, c'est deux vocabulaires qui divergent à la première
   retouche : la leçon d'`api/_nutrition.js`, celle des ombres de `suivi.html`,
   celle du « Découvrir » de Repas (règle 44 de CLAUDE.md).

   ⚠️⚠️ LE FILET EST LA PIÈCE MAÎTRESSE, PAS UNE PRÉCAUTION. Une page qui ne
   PEINT PAS ne reçoit AUCUNE `requestAnimationFrame` et ne joue AUCUNE
   animation CSS : app en arrière-plan, onglet caché, écran verrouillé. Tout ce
   qui part d'`opacity:0` y RESTE — c'est ainsi que le compteur du bilan
   annonçait « 0 g » sur 250, et que le trait de `planning.js` n'a jamais été
   dessiné. `animer()` pose donc, au bout de 900 ms et par `setTimeout`, une
   classe qui force TOUT à son état final. On peut dès lors animer librement :
   le pire cas est un écran qui apparaît d'un coup, jamais un écran vide.

   ⚠️ `animation` EST UNE PROPRIÉTÉ UNIQUE. Une seconde règle qui redéclare
   `animation` sur le même élément ÉCRASE la première — c'est ce qui a laissé
   les illustrations de `planning.js` à `stroke-dashoffset:520`, donc
   invisibles. Ici chaque élément n'a qu'UNE déclaration, et les effets
   combinés sont écrits dans la même liste séparés par des virgules.

   ⚠️ LES ILLUSTRATIONS SONT DÉCORATIVES, ET C'EST CE QUI LES AUTORISE À PARTIR
   D'UNE OPACITÉ NULLE. Rien de ce qu'elles portent n'est une information : les
   chiffres, eux, passent par `compteur()`, qui a son propre filet.

   Vocabulaire graphique repris d'`assets/recette.js`, volontairement : boîte de
   64, trait `currentColor` de 2,4, bouts arrondis, aucun aplat. Les deux se
   suivent à l'écran, ils doivent se ressembler.

   Ne dépend de rien.
   ═══════════════════════════════════════════════════════════ */
var NattyCine = (function () {
  'use strict';

  var pose = false;

  var CSS = ''
    /* ── Entrées échelonnées ──────────────────────────────────
       `data-c` porte le rang : 1, 2, 3… Le décalage est calculé ici plutôt
       qu'écrit dans chaque `style=` — sinon chaque appelant invente le sien. */
    + '[data-c]{opacity:0;animation:ncMonte .62s cubic-bezier(.22,1,.36,1) forwards}'
    + '[data-c="2"]{animation-delay:.07s}[data-c="3"]{animation-delay:.14s}'
    + '[data-c="4"]{animation-delay:.21s}[data-c="5"]{animation-delay:.28s}'
    + '[data-c="6"]{animation-delay:.35s}[data-c="7"]{animation-delay:.42s}'
    + '[data-c="8"]{animation-delay:.49s}'
    + '@keyframes ncMonte{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}'
    /* Une entrée plus large, pour un titre ou une illustration héroïque. */
    + '[data-c][data-ce="ample"]{animation-name:ncAmple;animation-duration:.8s}'
    + '@keyframes ncAmple{from{opacity:0;transform:translateY(22px) scale(.94)}'
      + 'to{opacity:1;transform:none}}'
    + '[data-c][data-ce="cote"]{animation-name:ncCote}'
    + '@keyframes ncCote{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}'
    /* Un dévoilement par volet, à la Keynote — pour une ligne de chiffres. */
    + '[data-c][data-ce="volet"]{animation-name:ncVolet;animation-duration:.7s}'
    + '@keyframes ncVolet{from{opacity:0;clip-path:inset(0 100% 0 0)}'
      + 'to{opacity:1;clip-path:inset(0 0 0 0)}}'

    /* ── Le passage d'une scène à l'autre ────────────────────
       Un GLISSEMENT LATÉRAL plutôt qu'un fondu vertical : le fondu dit « le
       contenu a changé », le glissement dit « on avance dans une séquence » —
       et il rend le retour lisible, puisqu'il repart dans l'autre sens.

       ⚠️ LE SENS EST PORTÉ PAR L'APPELANT, jamais deviné. Une séquence qui
       glisse toujours vers la gauche transforme un retour en avancée : on
       reculerait d'un écran en ayant l'impression d'en gagner un.
       ⚠️ Le plan SORTANT doit être en `position:absolute` chez l'hôte pendant
       qu'ils se croisent (les deux modules le font déjà) : dans le flux, la
       hauteur du bloc sauterait le temps de la transition.
       ⚠️⚠️ ET L'HÔTE DOIT COUPER LE DÉBORDEMENT HORIZONTAL. Un bloc pleine
       largeur translaté de 34 px élargit le document d'autant : la page part en
       défilement horizontal pendant un tiers de seconde, ce qui se voit et se
       mesure (`documentElement.scrollWidth`). C'est le défaut de `.hero-foot`,
       sous une autre forme. */
    + '.nc-e-av{animation:ncEavIn .44s cubic-bezier(.22,1,.36,1) both}'
    + '.nc-s-av{animation:ncEavOut .32s cubic-bezier(.4,0,1,1) forwards}'
    + '.nc-e-ar{animation:ncEarIn .44s cubic-bezier(.22,1,.36,1) both}'
    + '.nc-s-ar{animation:ncEarOut .32s cubic-bezier(.4,0,1,1) forwards}'
    + '@keyframes ncEavIn{from{opacity:0;transform:translateX(34px)}to{opacity:1;transform:none}}'
    + '@keyframes ncEavOut{to{opacity:0;transform:translateX(-26px)}}'
    + '@keyframes ncEarIn{from{opacity:0;transform:translateX(-34px)}to{opacity:1;transform:none}}'
    + '@keyframes ncEarOut{to{opacity:0;transform:translateX(26px)}}'

    /* ── L'illustration ───────────────────────────────────────
       Tout en trait, sur `currentColor` : un seul dessin sert les deux thèmes
       et les deux modules, sans pendant à maintenir (règle 33). */
    + '.nc-illu{display:block;margin:0 auto;overflow:visible}'
    + '.nc-illu path,.nc-illu circle,.nc-illu line,.nc-illu polyline,.nc-illu rect,.nc-illu ellipse{'
      + 'fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}'
    + '.nc-illu .f{fill:currentColor;stroke:none}'
    + '.nc-illu .d{opacity:.34}'
    /* Le tracé. ⚠️ `forwards` SANS `both` : avec `both`, l'état `from` (donc
       `stroke-dashoffset` plein, donc invisible) s'applique pendant le délai —
       et une page qui ne peint pas y reste. Sans délai, l'animation démarre
       tout de suite et il n'y a rien à voir avant. */
    + '.nc-illu .t{stroke-dasharray:var(--l,160);animation:ncTrace .95s cubic-bezier(.22,1,.36,1) forwards}'
    + '@keyframes ncTrace{from{stroke-dashoffset:var(--l,160)}to{stroke-dashoffset:0}}'
    /* Ce qui respire en boucle : volontairement HORS du filet, puisque son état
       final n'est pas une information et que l'arrêter le figerait au hasard. */
    + '.nc-illu .b{animation:ncBat 2.6s ease-in-out infinite;transform-origin:center}'
    + '@keyframes ncBat{0%,100%{opacity:.9;transform:scale(1)}50%{opacity:.5;transform:scale(1.06)}}'
    + '.nc-illu .m{animation:ncMonteSvg 2.4s ease-in-out infinite}'
    + '@keyframes ncMonteSvg{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}'
    + '.nc-illu .r{animation:ncTourne 9s linear infinite;transform-origin:32px 32px}'
    + '@keyframes ncTourne{to{transform:rotate(360deg)}}'
    /* La lueur derrière l'illustration : c'est ce qui donne la profondeur de
       `journee.js` sans imposer de couleur au module hôte. */
    + '.nc-halo{position:relative;display:flex;align-items:center;justify-content:center}'
    + '.nc-halo::before{content:"";position:absolute;width:130%;padding-top:130%;border-radius:50%;'
      + 'background:radial-gradient(circle,currentColor 0%,transparent 68%);opacity:.13;'
      + 'animation:ncSouffle 4.5s ease-in-out infinite}'
    + '@keyframes ncSouffle{0%,100%{transform:scale(1);opacity:.11}50%{transform:scale(1.12);opacity:.17}}'

    /* ── La coche de validation ───────────────────────────────
       Deux tracés décalés — anneau puis coche. Un seul tracé continu ne se lit
       pas comme une validation (déjà appris dans `assets/planning.js`). */
    + '.nc-vok circle{stroke:#34c759;stroke-width:2.6;fill:none;stroke-dasharray:170;'
      + 'animation:ncVokA .62s cubic-bezier(.22,1,.36,1) forwards}'
    + '.nc-vok path{stroke:#34c759;stroke-width:3.2;fill:none;stroke-linecap:round;'
      + 'stroke-linejoin:round;stroke-dasharray:40;'
      + 'animation:ncVokB .38s cubic-bezier(.22,1,.36,1) .5s forwards}'
    + '@keyframes ncVokA{from{stroke-dashoffset:170}to{stroke-dashoffset:0}}'
    + '@keyframes ncVokB{from{stroke-dashoffset:40}to{stroke-dashoffset:0}}'

    /* ── LE FILET ─────────────────────────────────────────────
       Posé par `setTimeout`, il force l'état final de tout ce qui porte une
       animation à sens unique. Les boucles (`.b`, `.m`, `.r`, le halo) en sont
       exclues : les figer les arrêterait sur une image quelconque. */
    + '.nc-pret,.nc-pret [data-c],.nc-pret [data-in],.nc-pret .nc-illu .t,'
      + '.nc-pret .nc-vok circle,.nc-pret .nc-vok path{'
      + 'opacity:1!important;transform:none!important;stroke-dashoffset:0!important;'
      + 'clip-path:none!important}'
    /* ⚠️ Le conteneur lui-même est couvert : c'est LUI qui porte l'entrée
       latérale, et une scène restée à `translateX(34px)` serait décalée pour de
       bon. `[data-in]` l'est aussi — c'est le nom qu'emploie `assets/bilan.js`
       depuis toujours, et il n'y a aucune raison de le laisser dehors. */;

  function css() {
    if (pose) return;
    pose = true;
    try {
      var st = document.createElement('style');
      st.id = 'nattyCineCss';
      st.textContent = CSS;
      document.head.appendChild(st);
    } catch (e) {}
  }

  /**
   * Arme les animations d'un hôte, et surtout POSE LE FILET.
   * @param {Element} hote  le conteneur qui vient d'être peint
   * @param {number} [ms]   quand forcer l'état final (900 ms par défaut)
   */
  function animer(hote, ms) {
    css();
    if (!hote) return;
    hote.classList.remove('nc-pret');
    /* ⚠️ La rAF ne sert QU'À RETIRER le filet d'un rendu précédent ; c'est le
       `setTimeout` qui garantit l'état final. L'inverse — compter sur la rAF —
       est précisément ce qui laisse un écran vide sur une page en veille. */
    setTimeout(function () {
      if (hote && hote.isConnected !== false) hote.classList.add('nc-pret');
    }, ms || 900);
  }

  /**
   * Un nombre qui monte. MÊME FILET, et c'est la raison d'être de la fonction :
   * `requestAnimationFrame` n'arrive jamais sur une page qui ne peint pas, et le
   * compteur reste alors sur sa valeur de départ — donc il annonce le contraire
   * de ce qu'il célèbre (le « 0 g » du bilan, le « +0 XP » des recettes).
   */
  function compteur(el, valeur, o) {
    if (!el) return;
    o = o || {};
    var duree = o.duree || 900, suffixe = o.suffixe || '', dec = o.decimales || 0;
    var fin = +valeur || 0, t0 = null;
    var fmt = function (v) {
      return (dec ? (Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec)).toFixed(dec).replace('.', ',')
                  : String(Math.round(v))) + suffixe;
    };
    function pas(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / duree);
      el.textContent = fmt(fin * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(pas);
    }
    el.textContent = fmt(0);
    requestAnimationFrame(pas);
    setTimeout(function () { if (el) el.textContent = fmt(fin); }, duree + 120);
  }

  /** La coche verte, en SVG. `taille` en pixels. */
  function vok(taille) {
    var t = taille || 64;
    return '<svg class="nc-vok" width="' + t + '" height="' + t + '" viewBox="0 0 64 64" '
      + 'fill="none" aria-hidden="true">'
      + '<circle cx="32" cy="32" r="27"/>'
      + '<path d="M20 33.5 28.5 42 44.5 24"/></svg>';
  }

  /* ═══ La bibliothèque d'illustrations ══════════════════════
     Boîte de 64, trait de 2,4, bouts arrondis — le vocabulaire d'
     `assets/recette.js`. Chaque dessin est COMPLET À L'ARRÊT : ce qui bouge
     s'ajoute à un dessin déjà lisible, il ne le construit pas.
     `--l` porte la longueur approximative du tracé : elle n'a pas besoin d'être
     exacte, seulement supérieure à la vraie longueur pour que le trait parte
     entièrement caché. */
  var D = {
    haltere:
      '<line class="t" style="--l:44" x1="14" y1="32" x2="50" y2="32"/>'
      + '<rect class="t" style="--l:60" x="6" y="22" width="8" height="20" rx="3"/>'
      + '<rect class="t" style="--l:60" x="50" y="22" width="8" height="20" rx="3"/>'
      + '<rect class="t b" style="--l:44" x="16" y="26" width="6" height="12" rx="2"/>'
      + '<rect class="t b" style="--l:44" x="42" y="26" width="6" height="12" rx="2"/>',
    muscle:
      '<path class="t" style="--l:150" d="M14 44c0-12 6-20 16-20 8 0 12 4 18 4 5 0 8-3 8-3"/>'
      + '<path class="t" style="--l:90" d="M14 44c6 6 16 8 24 4 7-4 10-12 8-18"/>'
      + '<circle class="f b" cx="47" cy="26" r="2.6"/>',
    machine:
      '<rect class="t" style="--l:130" x="10" y="12" width="44" height="40" rx="5"/>'
      + '<line class="t" style="--l:40" x1="22" y1="12" x2="22" y2="52"/>'
      + '<line class="t m" style="--l:26" x1="34" y1="22" x2="46" y2="22"/>'
      + '<line class="t m" style="--l:26" x1="34" y1="32" x2="46" y2="32"/>'
      + '<line class="t" style="--l:26" x1="34" y1="42" x2="46" y2="42"/>',
    series:
      '<line class="t" style="--l:44" x1="10" y1="52" x2="54" y2="52"/>'
      + '<rect class="t" style="--l:44" x="13" y="38" width="8" height="14" rx="2"/>'
      + '<rect class="t" style="--l:56" x="25" y="30" width="8" height="22" rx="2"/>'
      + '<rect class="t" style="--l:68" x="37" y="21" width="8" height="31" rx="2"/>'
      + '<circle class="f b" cx="41" cy="14" r="2.8"/>',
    chrono:
      '<circle class="t" style="--l:145" cx="32" cy="36" r="21"/>'
      + '<line class="t" style="--l:16" x1="26" y1="9" x2="38" y2="9"/>'
      + '<line class="t" style="--l:10" x1="32" y1="9" x2="32" y2="15"/>'
      + '<line class="t r" style="--l:20" x1="32" y1="36" x2="43" y2="28"/>',
    flamme:
      '<path class="t" style="--l:130" d="M32 54c-9 0-15-6-15-14 0-9 8-13 8-22 0 0 9 4 9 12 '
      + '2-3 3-7 3-10 5 4 10 11 10 20 0 8-6 14-15 14Z"/>'
      + '<path class="t b" style="--l:52" d="M32 50c-4 0-6-3-6-6 0-4 4-6 4-11 3 2 8 6 8 11 0 3-2 6-6 6Z"/>',
    trophee:
      '<path class="t" style="--l:110" d="M20 10h24v14a12 12 0 0 1-24 0Z"/>'
      + '<path class="t" style="--l:34" d="M20 14h-6a7 7 0 0 0 7 7"/>'
      + '<path class="t" style="--l:34" d="M44 14h6a7 7 0 0 1-7 7"/>'
      + '<line class="t" style="--l:14" x1="32" y1="36" x2="32" y2="45"/>'
      + '<line class="t" style="--l:22" x1="22" y1="52" x2="42" y2="52"/>'
      + '<path class="t" style="--l:24" d="M26 52c0-4 3-7 6-7s6 3 6 7"/>',
    calendrier:
      '<rect class="t" style="--l:150" x="9" y="14" width="46" height="42" rx="6"/>'
      + '<line class="t" style="--l:48" x1="9" y1="26" x2="55" y2="26"/>'
      + '<line class="t" style="--l:10" x1="21" y1="9" x2="21" y2="18"/>'
      + '<line class="t" style="--l:10" x1="43" y1="9" x2="43" y2="18"/>'
      + '<circle class="f d" cx="21" cy="36" r="2.4"/><circle class="f d" cx="32" cy="36" r="2.4"/>'
      + '<circle class="f b" cx="43" cy="36" r="3"/>'
      + '<circle class="f d" cx="21" cy="46" r="2.4"/><circle class="f d" cx="32" cy="46" r="2.4"/>',
    courbe:
      '<polyline class="t" style="--l:60" points="10,54 10,10"/>'
      + '<polyline class="t" style="--l:60" points="10,54 56,54"/>'
      + '<polyline class="t" style="--l:120" points="14,46 26,38 36,41 46,24 54,18"/>'
      + '<circle class="f" cx="26" cy="38" r="2.4"/><circle class="f" cx="36" cy="41" r="2.4"/>'
      + '<circle class="f b" cx="54" cy="18" r="3.4"/>',
    semaine:
      '<line class="t" style="--l:44" x1="8" y1="52" x2="56" y2="52"/>'
      + '<rect class="t" style="--l:34" x="9" y="40" width="6" height="12" rx="2"/>'
      + '<rect class="t" style="--l:46" x="20" y="30" width="6" height="22" rx="2"/>'
      + '<rect class="t d" style="--l:26" x="31" y="46" width="6" height="6" rx="2"/>'
      + '<rect class="t" style="--l:52" x="42" y="24" width="6" height="28" rx="2"/>'
      + '<circle class="f b" cx="45" cy="16" r="2.8"/>',
    assiette:
      '<circle class="t" style="--l:170" cx="32" cy="34" r="20"/>'
      + '<circle class="t d" style="--l:110" cx="32" cy="34" r="13"/>'
      + '<line class="t" style="--l:26" x1="8" y1="22" x2="8" y2="46"/>'
      + '<line class="t" style="--l:26" x1="56" y1="22" x2="56" y2="46"/>'
      + '<circle class="f b" cx="32" cy="34" r="3"/>',
    question:
      '<path class="t" style="--l:170" d="M12 18a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6'
      + 'H28l-10 10V44h-0a6 6 0 0 1-6-6Z"/>'
      + '<path class="t" style="--l:36" d="M27 23a5 5 0 0 1 9 3c0 4-4 4-4 7"/>'
      + '<circle class="f b" cx="32" cy="38" r="2.2"/>',
    cible:
      '<circle class="t" style="--l:150" cx="28" cy="36" r="19"/>'
      + '<circle class="t d" style="--l:90" cx="28" cy="36" r="11"/>'
      + '<circle class="f b" cx="28" cy="36" r="3.4"/>'
      + '<line class="t" style="--l:34" x1="28" y1="36" x2="53" y2="12"/>'
      + '<path class="t" style="--l:22" d="M44 12h9v9"/>',
    lune:
      '<path class="t" style="--l:150" d="M40 12a22 22 0 1 0 12 26 17 17 0 0 1-12-26Z"/>'
      + '<circle class="f b" cx="16" cy="16" r="2"/><circle class="f b" cx="50" cy="10" r="1.6"/>'
      + '<circle class="f b" cx="55" cy="48" r="1.8"/>',
    balance:
      '<line class="t" style="--l:26" x1="32" y1="14" x2="32" y2="50"/>'
      + '<line class="t" style="--l:46" x1="12" y1="20" x2="52" y2="20"/>'
      + '<line class="t" style="--l:22" x1="22" y1="52" x2="42" y2="52"/>'
      + '<path class="t m" style="--l:34" d="M12 20 5 36a7 7 0 0 0 14 0Z"/>'
      + '<path class="t m" style="--l:34" d="M52 20 45 36a7 7 0 0 0 14 0Z"/>',
    eclair:
      '<path class="t" style="--l:120" d="M35 6 16 36h12l-4 22 20-30H32Z"/>'
      + '<circle class="f b d" cx="32" cy="32" r="24"/>',
    poids:
      '<circle class="t" style="--l:170" cx="32" cy="34" r="20"/>'
      + '<circle class="t d" style="--l:60" cx="32" cy="34" r="7"/>'
      + '<path class="t" style="--l:26" d="M24 14h16l-3 6H27Z"/>'
      + '<line class="t b" style="--l:12" x1="32" y1="20" x2="32" y2="27"/>',
    coeur:
      '<path class="t b" style="--l:150" d="M32 52S12 40 12 26a10 10 0 0 1 20-4 10 10 0 0 1 20 4'
      + 'c0 14-20 26-20 26Z"/>'
      + '<polyline class="t" style="--l:60" points="8,32 20,32 25,24 31,40 36,30 42,32 56,32"/>',
    horloge:
      '<circle class="t" style="--l:170" cx="32" cy="32" r="23"/>'
      + '<line class="t" style="--l:14" x1="32" y1="32" x2="32" y2="19"/>'
      + '<line class="t m" style="--l:12" x1="32" y1="32" x2="42" y2="36"/>'
      + '<circle class="f" cx="32" cy="32" r="2.4"/>'
  };

  /**
   * @param {string} nom  une clé de `NattyCine.ILLUS`
   * @param {Object} [o]  {taille, cls, halo}
   */
  function illu(nom, o) {
    o = o || {};
    var t = o.taille || 64;
    var corps = D[nom] || D.eclair;
    var svg = '<svg class="nc-illu ' + (o.cls || '') + '" width="' + t + '" height="' + t
      + '" viewBox="0 0 64 64" fill="none" aria-hidden="true">' + corps + '</svg>';
    /* Le halo prend la couleur du texte courant : il ne fixe donc aucune
       teinte, et suit le module hôte sans qu'on ait à le lui dire. */
    return o.halo ? '<div class="nc-halo">' + svg + '</div>' : svg;
  }

  /**
   * Les classes d'entrée et de sortie d'une transition.
   * @param {number} sens  +1 on avance, -1 on revient en arrière
   * @returns {{entree:string, sortie:string}}
   */
  function passage(sens) {
    css();
    return (sens < 0) ? { entree: 'nc-e-ar', sortie: 'nc-s-ar' }
                      : { entree: 'nc-e-av', sortie: 'nc-s-av' };
  }

  return {
    css: css, animer: animer, compteur: compteur, vok: vok, illu: illu,
    passage: passage, ILLUS: Object.keys(D)
  };
})();
