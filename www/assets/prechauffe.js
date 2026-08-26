/* ═══════════════════════════════════════════════════════════
   Natty — « On prépare la cuisine » : l'attente entre le guide et la recette
   ───────────────────────────────────────────────────────────
     NattyPrechauffe.ouvrir(opts)   → l'écran plein, tout de suite
     NattyPrechauffe.fermer()       → le retire, après un temps minimum
     NattyPrechauffe.ouverte()      → est-il à l'écran ?

   CE QUE ÇA CORRIGE. « Suivre la recette » du guide du jour envoie sur
   `repas.html?plat=…&preparer=1`, qui ouvre la cinématique. Entre les deux, il
   y a une NAVIGATION : la cinématique du guide se termine, l'écran Repas se
   charge d'un coup avec ses recettes, ses panneaux et son calendrier, puis la
   préparation s'ouvre par-dessus. Trois images sans rapport en moins d'une
   seconde — « pas fluide, voire pas du tout » (Pablo, 2026-08-16).

   Cet écran couvre le trajet. Il s'affiche AVANT que la page ne charge quoi
   que ce soit, et ne se retire qu'une fois la première étape prête : on ne voit
   donc jamais l'écran Repas se composer, et on n'a plus rien à taper.

   ── POURQUOI DES SCÈNES QUI ALTERNENT ──
   Un rond qui tourne dit « attends » et rien d'autre. Ici l'attente raconte ce
   qu'on est en train de faire — le four préchauffe, les couteaux s'aiguisent —
   donc elle appartient à la recette au lieu de s'y ajouter. Cinq scènes de
   ~1,2 s qui tournent en boucle : au-delà, on aurait dessiné des animations que
   personne ne verra jamais.

   ⚠️ AUCUNE DONNÉE NE SE LIT ICI, et rien ne dépend d'une animation pour son
   état final : sur une page qui ne peint pas, une animation CSS reste à sa
   première image (piège §7). L'écran doit donc être lisible même figé — d'où
   des scènes dont l'image de départ est déjà complète, et une fermeture pilotée
   par un minuteur et non par la fin d'une animation.

   Le vocabulaire graphique est celui d'`assets/recette.js` : boîte de 64, trait
   `currentColor` de 2,4, bouts arrondis. Les seize gestes de ce module ne sont
   PAS réutilisés ici — ils dessinent une action sur un aliment, pas une cuisine
   qui se prépare — mais les deux doivent se ressembler, puisqu'ils se suivent.

   Aucune dépendance : ni core.js, ni réseau, ni image. Les couleurs passent par
   les jetons `--nt-*` d'`assets/theme.js`, seul fichier que toutes les pages
   chargent.
   ═══════════════════════════════════════════════════════════ */

window.NattyPrechauffe = (function () {
  'use strict';

  var TETE = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4"'
    + ' stroke-linecap="round" stroke-linejoin="round">';

  /* Les scènes. Chacune est complète à l'arrêt : ce qui bouge s'ajoute à un
     dessin déjà lisible, jamais l'inverse. */
  var SCENES = [
    {
      texte: 'Préchauffage du four',
      svg: TETE
        + '<rect x="9" y="11" width="46" height="42" rx="7"/>'
        + '<path d="M9 24h46"/><circle cx="17" cy="17.5" r="1.8"/>'
        + '<rect x="20" y="30" width="24" height="15" rx="3"/>'
        + '<g class="npc-monte"><path d="M22 47c3-4 6 2 9-2s6-3 6-3"/>'
        + '<path d="M22 41c3-4 6 2 9-2s6-3 6-3"/></g>'
        + '<g class="npc-lueur"><circle cx="49" cy="17.5" r="3"/></g>'
        + '</svg>'
    },
    {
      texte: 'Aiguisage des couteaux',
      svg: TETE
        + '<path d="M10 50h44"/>'
        + '<g class="npc-lame"><path d="M14 40 40 18l4 5-26 22Z"/>'
        + '<path d="M45 22l7-5" stroke-width="4.5"/></g>'
        + '<g class="npc-etincelle"><path d="M30 12v5"/><path d="M38 9v5"/><path d="M46 13v5"/></g>'
        + '</svg>'
    },
    {
      texte: 'Les ingrédients sortent',
      svg: TETE
        + '<rect x="16" y="7" width="32" height="50" rx="6"/><path d="M16 26h32"/>'
        + '<path d="M22 15v6"/><path d="M22 32v6"/>'
        + '<g class="npc-sort"><circle cx="32" cy="40" r="4.5"/>'
        + '<path d="M40 46c0 3-2 5-4 5"/></g>'
        + '</svg>'
    },
    {
      texte: 'La poêle chauffe',
      svg: TETE
        + '<path d="M8 34h34a12 12 0 0 1-12 12H20A12 12 0 0 1 8 34Z"/><path d="M42 34h14"/>'
        + '<g class="npc-vapeur"><path d="M16 24c3-4-3-6 0-10"/><path d="M25 22c3-5-3-7 0-12"/>'
        + '<path d="M34 24c3-4-3-6 0-10"/></g>'
        + '</svg>'
    },
    {
      texte: 'Réglage du minuteur',
      svg: TETE
        + '<circle cx="32" cy="36" r="21"/><path d="M25 8h14"/><path d="M32 15v-7"/>'
        + '<g class="npc-aiguille" style="transform-origin:32px 36px"><path d="M32 36V22"/></g>'
        + '<circle cx="32" cy="36" r="2.2" fill="currentColor" stroke="none"/>'
        + '</svg>'
    }
  ];

  var DUREE_SCENE = 1200;      // ms par scène
  var MINIMUM = 1500;          // ms : en dessous, l'écran clignote au lieu d'informer
  var SECURITE = 9000;         // ms : jamais de plein écran éternel si rien n'aboutit

  var el = null, tic = null, garde = null, ouvertLe = 0, scene = 0;

  function css() {
    if (document.getElementById('npc-css')) return;
    var s = document.createElement('style');
    s.id = 'npc-css';
    s.textContent = [
      /* ⚠️ AU-DESSUS DE LA CINÉMATIQUE (`#nrCine`, z-index 12000), et c'est
         tout le mécanisme : la préparation se monte DESSOUS pendant que l'écran
         est encore là, puis celui-ci s'efface et découvre l'étape 1 déjà en
         place. À 11500 — la première valeur essayée — c'est l'inverse qui se
         produisait : la cinématique surgissait par-dessus l'écran de
         chargement, exactement l'à-coup qu'on venait supprimer. Mesuré au banc.
         Reste bien en dessous des plein écran de planning.js (99990) et de sa
         fiche (100000), qui ne peuvent de toute façon pas être ouverts ici. */
      '#npchauffe{position:fixed;inset:0;z-index:12500;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:26px;',
      'background:var(--nt-bg,#fff);color:var(--nt-ink,#101014);',
      'font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;',
      'opacity:0;transition:opacity .22s ease}',
      '#npchauffe.on{opacity:1}',
      /* ⚠️ UN PLEIN ÉCRAN QUI S'EFFACE EN OPACITÉ AVALE ENCORE LES TAPS.
         `fermer()` retire `.on` puis ne détache le nœud qu'à la fin du fondu : il
         reste plein écran, invisible et cliquable pendant 0,2 à 0,5 s. C'est la
         demi-seconde où « j'appuie et il ne se passe rien » (2026-08-25).
         ⚠️ Et ici la sortie se fait en AJOUTANT `.part`, pas en retirant `.on` :
         le seul `:not(.on)` ne l'aurait jamais couverte — c'est-à-dire pas le
         cas qui compte, celui où l'on découvre l'étape 1 de la recette. */
      '#npchauffe:not(.on),#npchauffe.part{pointer-events:none}',
      // La sortie fond vers la cinématique déjà montée dessous : on ne voit
      // donc jamais l'écran Repas, seulement la première étape qui apparaît.
      '#npchauffe.part{opacity:0;transition:opacity .3s ease}',

      '#npchauffe .npc-scene{width:132px;height:132px;position:relative}',
      '#npchauffe .npc-scene > div{position:absolute;inset:0;opacity:0}',
      '#npchauffe .npc-scene > div.vu{opacity:1;transition:opacity .32s ease}',
      '#npchauffe .npc-scene svg{width:100%;height:100%;display:block;overflow:visible}',

      '#npchauffe .npc-txt{font-size:16px;font-weight:800;letter-spacing:-.2px;text-align:center;',
      'min-height:1.3em;padding:0 28px;transition:opacity .3s ease}',
      '#npchauffe .npc-sous{font-size:12.5px;font-weight:600;color:var(--nt-muted,#9d9da8);',
      'text-align:center;padding:0 34px;line-height:1.5;margin-top:-14px}',

      // Barre indéterminée : elle ne promet aucune durée, elle dit « ça avance ».
      '#npchauffe .npc-bar{width:132px;height:4px;border-radius:99px;overflow:hidden;',
      'background:var(--nt-line,#e6e6ea)}',
      '#npchauffe .npc-bar i{display:block;width:42%;height:100%;border-radius:99px;',
      'background:var(--nt-ink,#101014);animation:npcVaEtVient 1.25s ease-in-out infinite}',
      '@keyframes npcVaEtVient{0%{transform:translateX(-110%)}100%{transform:translateX(345%)}}',

      /* Les mouvements de chaque scène. Discrets : c'est une attente, pas un
         spectacle — et l'écran doit rester lisible si rien ne bouge. */
      '#npchauffe .npc-monte path{animation:npcMonte 1.9s ease-in-out infinite}',
      '#npchauffe .npc-monte path:nth-child(2){animation-delay:.55s}',
      '@keyframes npcMonte{0%{opacity:.15;transform:translateY(3px)}',
      '45%{opacity:1}100%{opacity:.15;transform:translateY(-4px)}}',
      '#npchauffe .npc-lueur{animation:npcLueur 1.6s ease-in-out infinite}',
      '@keyframes npcLueur{0%,100%{opacity:.25}50%{opacity:1}}',
      '#npchauffe .npc-lame{animation:npcAiguise 1.15s ease-in-out infinite;transform-origin:16px 42px}',
      '@keyframes npcAiguise{0%,100%{transform:translate(0,0) rotate(0)}',
      '50%{transform:translate(6px,-5px) rotate(-7deg)}}',
      '#npchauffe .npc-etincelle path{animation:npcEtincelle 1.15s ease-out infinite}',
      '#npchauffe .npc-etincelle path:nth-child(2){animation-delay:.18s}',
      '#npchauffe .npc-etincelle path:nth-child(3){animation-delay:.36s}',
      '@keyframes npcEtincelle{0%{opacity:0;transform:translateY(5px) scaleY(.4)}',
      '35%{opacity:1}100%{opacity:0;transform:translateY(-4px) scaleY(1)}}',
      '#npchauffe .npc-sort{animation:npcSort 1.8s ease-in-out infinite}',
      '@keyframes npcSort{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-4px);opacity:1}}',
      '#npchauffe .npc-vapeur path{animation:npcVapeur 2.2s ease-in-out infinite}',
      '#npchauffe .npc-vapeur path:nth-child(2){animation-delay:.5s}',
      '#npchauffe .npc-vapeur path:nth-child(3){animation-delay:1s}',
      '@keyframes npcVapeur{0%{opacity:0;transform:translateY(6px)}35%{opacity:1}',
      '100%{opacity:0;transform:translateY(-8px)}}',
      '#npchauffe .npc-aiguille{animation:npcTourne 2.4s linear infinite}',
      '@keyframes npcTourne{to{transform:rotate(360deg)}}',

      '@media (prefers-reduced-motion:reduce){#npchauffe .npc-bar i,#npchauffe .npc-monte path,',
      '#npchauffe .npc-lueur,#npchauffe .npc-lame,#npchauffe .npc-etincelle path,',
      '#npchauffe .npc-sort,#npchauffe .npc-vapeur path,#npchauffe .npc-aiguille',
      '{animation:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function montrer(i) {
    if (!el) return;
    scene = i % SCENES.length;
    var vues = el.querySelectorAll('.npc-scene > div');
    for (var k = 0; k < vues.length; k++) vues[k].classList.toggle('vu', k === scene);
    el.querySelector('.npc-txt').textContent = SCENES[scene].texte;
  }

  /**
   * @param {object} [opts]
   * @param {string} [opts.sous] la ligne du bas — le nom du plat, en général.
   */
  function ouvrir(opts) {
    opts = opts || {};
    if (el) { if (opts.sous) el.querySelector('.npc-sous').textContent = opts.sous; return el; }
    css();
    el = document.createElement('div');
    el.id = 'npchauffe';
    el.innerHTML =
      '<div class="npc-scene">'
      + SCENES.map(function (s) { return '<div>' + s.svg + '</div>'; }).join('')
      + '</div>'
      + '<div class="npc-txt"></div>'
      + '<div class="npc-sous">' + esc(opts.sous || 'On prépare la cuisine…') + '</div>'
      + '<div class="npc-bar"><i></i></div>';
    document.body.appendChild(el);
    // Le défilement de la page dessous n'a plus lieu d'être — et sur iOS, jamais
    // `position:fixed` sur le body (il casse le scroll au retour).
    document.body.style.overflow = 'hidden';

    ouvertLe = Date.now();
    montrer(0);
    tic = setInterval(function () { montrer(scene + 1); }, DUREE_SCENE);

    /* ⚠️ Même précaution que `Natty.confirmer` : une classe posée par la seule
       `requestAnimationFrame` ne se pose pas si la page ne peint pas, et
       l'écran resterait à `opacity:0` TOUT EN interceptant les taps. */
    requestAnimationFrame(function () { if (el) el.classList.add('on'); });
    setTimeout(function () { if (el) el.classList.add('on'); }, 60);

    // Filet : rien ne doit pouvoir laisser un plein écran définitif.
    garde = setTimeout(function () { fermer(true); }, SECURITE);
    return el;
  }

  /**
   * Retire l'écran — jamais avant `MINIMUM`, sinon il clignote et on n'a rien
   * eu le temps de lire. @param {boolean} [tout_de_suite]
   */
  function fermer(tout_de_suite) {
    if (!el) return;
    var reste = tout_de_suite ? 0 : Math.max(0, MINIMUM - (Date.now() - ouvertLe));
    setTimeout(function () {
      if (!el) return;
      clearInterval(tic); tic = null;
      clearTimeout(garde); garde = null;
      var mort = el;
      el = null;
      mort.classList.add('part');
      document.body.style.overflow = '';
      setTimeout(function () { if (mort.parentNode) mort.parentNode.removeChild(mort); }, 340);
    }, reste);
  }

  function ouverte() { return !!el; }

  return { ouvrir: ouvrir, fermer: fermer, ouverte: ouverte, scenes: SCENES.length };
})();
