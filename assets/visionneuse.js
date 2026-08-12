/* ═══════════════════════════════════════════════════════════
   Natty — La visionneuse d'un plat

   UNE page plein écran pour tous les plats de l'app, d'où qu'ils
   viennent : un plat du monde de « Découvrir », ou le repas qu'un
   membre a publié dans le fil. Demande de Pablo (août 2026) : les
   deux doivent se comporter exactement pareil.

   C'est pour ça qu'il y a UN module et pas deux. Chaque fois que ce
   dépôt a laissé deux écrans raconter la même chose, ils ont fini par
   diverger — les ombres de `suivi.html`, l'en-tête de `menu.html`,
   `www/menu.html`. Ici l'appelant fournit des données, pas une mise
   en page.

   Composition, de haut en bas :
     • la jauge de progression et la barre de retour ;
     • le HÉROS — la photo dans une carte neumorphique arrondie, qui
       occupe 80 % de la hauteur. Sur elle : la bulle noire du titre
       avec sa description, et les bulles sombres des macros ;
     • « Voir les détails », en texte gris, qui fait monter les
       ingrédients et les actions.

   ⚠️ LE FOND SUIT LE THÈME, contrairement à la version précédente qui
   était noire dans les deux modes. Tout passe par les jetons `--nt-*`
   d'`assets/theme.js` : c'est le seul fichier que toutes les pages
   chargent, donc le seul endroit d'où un module injecté peut tirer
   des couleurs valables partout. Les bulles, elles, restent sombres
   dans les deux thèmes : elles sont posées SUR une photo, et le
   contraste d'un voile clair sous du texte blanc ne tient que par
   accident selon l'image (leçon payée deux fois — cf. CLAUDE.md).

   Dépend de : rien. Utilise `assets/theme.js` s'il est là (jetons),
   et les rappels que l'appelant fournit pour les courses et les
   actions.
   ═══════════════════════════════════════════════════════════ */
var NattyVisionneuse = (function () {

  var racine = null, piste = null, jauge = null;
  var ITEMS = [], INDEX = 0, OPTS = {}, scrollBloque = '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Une apostrophe (« Huile d'olive ») glissée telle quelle dans un sélecteur
  // d'attribut casserait la requête.
  function attr(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  /* ── Style ────────────────────────────────────────────────
     Neumorphisme sobre : deux ombres, un grand rayon, aucun contour.
     ⚠️ LE RELIEF NE S'INVERSE PAS EN SOMBRE. Un reflet blanc à .9 sur
     fond noir n'est plus un relief, c'est un halo — la carte a l'air
     allumée par en dessous. Il tombe à .04, et c'est l'ombre portée
     qui creuse. Même règle qu'au §5 de CLAUDE.md. */
  var CSS = [
    '#nvue{position:fixed;inset:0;z-index:880;display:none;',
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;",
      '-webkit-font-smoothing:antialiased;',
      '--v-bg:var(--nt-bg,#fff);--v-ink:var(--nt-ink,#101014);--v-mut:var(--nt-muted,#9a9aaa);',
      '--v-so:14px 16px 34px rgba(174,174,192,.44),-12px -12px 30px rgba(255,255,255,.92);',
      '--v-si:inset 3px 3px 8px rgba(174,174,192,.34),inset -3px -3px 8px rgba(255,255,255,.9);',
      '--v-jauge:rgba(20,20,30,.16);--v-fond-carte:#e9e9ee;',
      'background:var(--v-bg);color:var(--v-ink)}',
    ':root[data-theme="dark"] #nvue{',
      '--v-so:16px 18px 40px rgba(0,0,0,.74),-10px -10px 26px rgba(255,255,255,.04);',
      '--v-si:inset 3px 3px 9px rgba(0,0,0,.72),inset -2px -2px 7px rgba(255,255,255,.035);',
      '--v-jauge:rgba(255,255,255,.18);--v-fond-carte:#17171c}',
    '#nvue.on{display:block}',
    '#nvue *{box-sizing:border-box}',
    '#nvue button{font-family:inherit;border:none;cursor:pointer;',
      '-webkit-tap-highlight-color:transparent}',

    /* Les photos sont en portrait : sur un écran large, la colonne reste
       bornée, sinon elles seraient rognées aux deux tiers. */
    '#nvue .nv-col{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);',
      'width:100%;max-width:var(--col,480px);overflow:hidden}',

    /* ── La piste ──
       Geste latéral = `scroll-snap`, jamais un suivi de pointeur maison :
       le navigateur fait l'inertie, l'arrêt sur une diapositive et le
       clavier, et il n'y a aucun état à tenir. */
    '#nvue .nv-track{position:absolute;inset:0;display:flex;overflow-x:auto;overflow-y:hidden;',
      'scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;',
      'overscroll-behavior-x:contain}',
    '#nvue .nv-track::-webkit-scrollbar{display:none}',
    /* ⚠️ AUCUNE MARGE VERTICALE SUR LA DIAPOSITIVE, et c'est ce qui permet
       d'annoncer 70 % honnêtement : un pourcentage se résout sur la boîte de
       contenu du parent. Avec 10 px de marge en haut et en bas, `height:70%`
       valait 70 % de 792 px, soit 68,2 % de l'écran. Les retraits vivent donc
       sur les enfants — la jauge en haut, le bouton en bas. */
    '#nvue .nv-sl{position:relative;flex:0 0 100%;width:100%;height:100%;',
      'scroll-snap-align:center;scroll-snap-stop:always;display:flex;flex-direction:column;',
      'padding:0 18px}',

    /* ── Le haut ── */
    '#nvue .nv-jauge{display:flex;gap:4px;flex:none;margin-bottom:11px;',
      'margin-top:calc(10px + env(safe-area-inset-top,0px))}',
    '#nvue .nv-seg{flex:1;height:2.5px;border-radius:2px;background:var(--v-jauge);opacity:.4}',
    '#nvue .nv-seg.on{opacity:1}',
    '#nvue .nv-bar{flex:none;display:flex;align-items:center;gap:11px;margin-bottom:11px}',
    '#nvue .nv-rd{width:42px;height:42px;flex:none;border-radius:50%;padding:0;',
      'background:var(--v-bg);color:var(--v-ink);box-shadow:var(--v-so);',
      'display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;',
      'transition:transform .14s ease,box-shadow .14s ease}',
    '#nvue .nv-rd:active{transform:scale(.94);box-shadow:var(--v-si)}',
    '#nvue .nv-rd svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;',
      'stroke-linecap:round;stroke-linejoin:round}',
    '#nvue .nv-rd.on svg{stroke:#ff453a;fill:#ff453a}',
    '#nvue .nv-ttl{flex:1;min-width:0;font-weight:800;font-size:13px;letter-spacing:.4px;',
      'text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#nvue .nv-num{flex:none;font-size:12px;font-weight:700;color:var(--v-mut)}',

    /* ── Le héros ──
       ⚠️⚠️ 70 % DE LA HAUTEUR, ET LA PHOTO EST LIBRE. Demande de Pablo :
       « le titre et les macros ne doivent pas être au même endroit, la
       photo du plat doit être parfaitement libre ». Rien ne se pose plus
       dessus — ni bulle, ni voile, ni dégradé : on voit le plat entier,
       cadré comme le photographe l'a cadré. Le prix, c'est que le titre
       et les macros descendent SOUS la carte, et que celle-ci passe donc
       de 80 à 70 % pour leur laisser la place.
       `height` fermement, pas `flex:1` : les 70 % sont une promesse, et
       une carte qui se compresserait au gré du texte ne la tiendrait pas. */
    '#nvue .nv-hero{position:relative;flex:none;height:70%;',
      'border-radius:34px;overflow:hidden;background:var(--v-fond-carte);',
      'box-shadow:var(--v-so);cursor:pointer}',
    '#nvue .nv-ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;',
      'opacity:0;transition:opacity .45s ease}',
    '#nvue .nv-ph.vu{opacity:1}',
    '#nvue .nv-fb{position:absolute;inset:0;display:flex;align-items:center;',
      'justify-content:center;font-size:96px}',
    /* L'illustration d'un plat sans photo. Elle occupe la carte sans la
       remplir : le trait a besoin de blanc autour, contrairement à une photo
       qui va bord à bord. ⚠️ `stroke-width` REDÉCLARÉ ici, et faible : la boîte
       du SVG fait 24 unités, donc dans une carte de ~300 px le trait de 1.4
       posé par `plats-illu.js` se peindrait en 17 px — un marqueur. Même piège
       que le `.hero` d'`assets/journee.js`. */
    '#nvue .nv-illu{position:absolute;inset:0;display:flex;align-items:center;',
      'justify-content:center;color:var(--nt-ink,#f4f4f7);opacity:.82}',
    '#nvue .nv-illu svg{width:56%;height:56%;stroke-width:.75}',

    /* ── Sous la photo ──
       Le bloc prend ce qui reste et se centre dedans : sur un grand écran il
       respire, sur un petit il se serre, sans jamais pousser la carte. */
    '#nvue .nv-bas{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;',
      'justify-content:center;gap:6px;padding-top:9px}',
    /* La bulle NOIRE du titre. Noire dans les DEUX thèmes : c'est une demande
       explicite, et sur fond clair elle joue le même rôle que les cartes
       noires du reste de l'app — un bloc franc, pas un aplat de plus. */
    /* ⚠️ Le liseré et le relief ne sont pas décoratifs : sur le fond sombre
       de l'app (#0e0e11), une bulle noire ne se distingue plus du tout — le
       bloc du titre se dissolvait dans la page. Ils lui rendent son bord.
       En thème clair, le noir sur blanc se suffit, mais la même ombre y
       creuse un peu la carte : elle sert dans les deux cas. */
    '#nvue .nv-plate{background:#0b0b0e;border-radius:23px;padding:11px 16px;color:#fff;',
      'border:1px solid rgba(255,255,255,.09);box-shadow:var(--v-so)}',
    '#nvue .nv-chap{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.6px;',
      'text-transform:uppercase;color:#a6a6b2;margin-bottom:4px}',
    '#nvue .nv-nom{font-weight:900;font-size:20.5px;line-height:1.12;letter-spacing:-.4px}',
    /* ⚠️ Deux lignes au plus. Une description de quatre lignes reprenait à la
       carte les pixels qu'on vient de lui rendre ; le texte entier reste
       lisible dans le tiroir. */
    '#nvue .nv-desc{font-size:11.5px;line-height:1.38;color:#b9b9c4;margin-top:4px;',
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    /* Les bulles SOMBRES des macros, avec leur emoji — sombres elles aussi
       dans les deux thèmes, pour faire bloc avec la bulle du titre. */
    '#nvue .nv-macs{display:flex;gap:6px}',
    '#nvue .nv-mac{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;',
      'gap:5px;background:#15151a;border:1px solid rgba(255,255,255,.1);border-radius:15px;',
      'padding:7px 4px;color:#fff;font-size:12.5px;font-weight:800;white-space:nowrap}',
    '#nvue .nv-mac .e{font-size:13px;line-height:1}',
    '#nvue .nv-macs.vide .nv-mac{font-size:11.5px;font-weight:700;color:#b9b9c4}',

    /* ── Le bouton du bas ──
       Texte gris, pas de pastille pleine : ce n'est pas l'action principale
       de l'écran, c'est un repli qu'on ouvre si on veut. */
    '#nvue .nv-more{flex:none;width:100%;background:none;color:var(--v-mut);',
      'padding:11px 0 calc(8px + env(safe-area-inset-bottom,0px));',
      'font-size:13.5px;font-weight:700;letter-spacing:.2px;',
      'display:flex;align-items:center;justify-content:center;gap:7px}',
    '#nvue .nv-more:active{opacity:.6}',
    '#nvue .nv-more .ch{font-size:11px;transition:transform .24s ease}',
    '#nvue .nv-sl.det .nv-more .ch{transform:rotate(180deg)}',
    /* L'indice de geste, une seule fois dans la vie de l'app. */
    '#nvue .nv-hint{position:absolute;right:26px;top:38%;z-index:4;pointer-events:none;',
      'display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:999px;',
      'background:rgba(9,9,11,.6);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
      'color:#fff;font-size:11.5px;font-weight:800;transition:opacity .35s ease;',
      'animation:nvHint 2.4s ease-in-out infinite}',
    '#nvue .nv-hint.off{opacity:0}',
    '@keyframes nvHint{0%,100%{transform:translateX(0)}50%{transform:translateX(-8px)}}',

    /* ── Le tiroir des détails ──
       Il monte par-dessus le héros. Rendu d'emblée, la photo n'aurait plus
       la place que l'écran lui promet. */
    '#nvue .nv-det{position:absolute;left:0;right:0;bottom:0;z-index:6;max-height:86%;',
      'overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;',
      'background:var(--v-bg);border-radius:30px 30px 0 0;',
      'box-shadow:0 -14px 40px var(--nt-ombre,rgba(20,20,30,.16));',
      'padding:8px 20px calc(20px + env(safe-area-inset-bottom,0px));',
      'transform:translateY(101%);transition:transform .34s cubic-bezier(.22,1,.36,1)}',
    '#nvue .nv-sl.det .nv-det{transform:none}',
    '#nvue .nv-grip{width:38px;height:4px;border-radius:2px;background:var(--v-mut);',
      'opacity:.4;margin:0 auto 14px}',
    '#nvue .nv-sst{font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;',
      'color:var(--v-mut);margin:16px 0 9px}',
    '#nvue .nv-note{font-size:12.5px;line-height:1.5;color:var(--v-mut)}',
    '#nvue .nv-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px}',
    '#nvue .nv-tag{border-radius:999px;padding:6px 12px;font-size:10.5px;font-weight:800;',
      'letter-spacing:.3px;text-transform:uppercase;color:var(--v-mut);box-shadow:var(--v-si)}',
    '#nvue .nv-ings{display:flex;flex-wrap:wrap;gap:8px}',
    '#nvue .nv-ing{display:inline-flex;align-items:center;gap:6px;color:var(--v-ink);',
      'background:var(--v-bg);border-radius:999px;padding:9px 14px;font-size:12px;font-weight:700;',
      'box-shadow:var(--v-so);transition:transform .12s ease,box-shadow .16s ease}',
    '#nvue .nv-ing:active{transform:scale(.95)}',
    '#nvue .nv-ing.on{box-shadow:var(--v-si);color:var(--v-mut)}',
    '#nvue .nv-ing .q{font-weight:600;color:var(--v-mut)}',
    '#nvue .nv-acts{display:flex;gap:9px;margin-top:18px}',
    '#nvue .nv-p{flex:1;background:var(--v-ink);color:var(--nt-on-ink,#fff);border-radius:999px;',
      'padding:16px;font-size:13.5px;font-weight:800}',
    '#nvue .nv-s{flex:none;background:var(--v-bg);color:var(--v-ink);border-radius:999px;',
      'padding:16px 20px;font-size:13.5px;font-weight:800;box-shadow:var(--v-so)}',
    '#nvue .nv-p:active,#nvue .nv-s:active{transform:scale(.98)}',
    '#nvue .nv-p[disabled]{opacity:.45}',

    '#nvue .nv-toast{position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));',
      'transform:translate(-50%,14px);z-index:10;background:var(--v-ink);',
      'color:var(--nt-on-ink,#fff);border-radius:18px;padding:12px 20px;font-size:12.5px;',
      'font-weight:700;opacity:0;pointer-events:none;transition:all .3s cubic-bezier(.4,0,.2,1);',
      'white-space:nowrap;max-width:88vw;overflow:hidden;text-overflow:ellipsis}',
    '#nvue .nv-toast.on{opacity:1;transform:translate(-50%,0)}',

    /* ⚠️ PETIT ÉCRAN : mesuré à 375 × 667, le bloc du bas n'avait que 88 px
       pour un contenu de 113 — la bulle du titre chevauchait les macros. Deux
       choses cèdent, dans cet ordre : la DESCRIPTION disparaît (elle reste en
       entier dans le tiroir, et c'est la ligne dont on peut le plus se
       passer), puis la carte lâche quatre points de hauteur. Rogner d'abord la
       photo aurait été trahir la promesse des 70 % pour du texte qu'on peut
       lire ailleurs. */
    '@media (max-height:700px){#nvue .nv-hero{height:66%}#nvue .nv-desc{display:none}}'
  ].join('');

  /* ── Montage ─────────────────────────────────────────────── */

  function monter() {
    if (racine) return;
    var st = document.createElement('style');
    st.id = 'nvue-css';
    st.textContent = CSS;
    document.head.appendChild(st);

    racine = document.createElement('div');
    racine.id = 'nvue';
    racine.innerHTML = '<div class="nv-col"><div class="nv-track" id="nvTrack"></div>'
      + '<div class="nv-hint" id="nvHint">Glissez <span>→</span></div></div>'
      + '<div class="nv-toast" id="nvToast"></div>';
    document.body.appendChild(racine);
    piste = racine.querySelector('#nvTrack');

    piste.addEventListener('scroll', function () {
      if (piste._raf) return;
      piste._raf = requestAnimationFrame(function () {
        piste._raf = 0;
        var i = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth));
        if (i !== INDEX) { INDEX = i; majBarre(); }
        if (piste.scrollLeft > 12) cacherIndice();
      });
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (!racine || !racine.classList.contains('on')) return;
      if (e.key === 'Escape') fermer();
      if (e.key === 'ArrowRight') aller(INDEX + 1);
      if (e.key === 'ArrowLeft') aller(INDEX - 1);
    });

    racine.addEventListener('click', function (e) {
      var t = e.target;
      var f = t.closest && t.closest('[data-nv]');
      if (f) { geste(f.getAttribute('data-nv'), f, e); return; }
      /* ⚠️ Le tap sur la PHOTO avance d'un plat — demandé tel quel
         (« swippable par un simple click »). Il est testé en DERNIER, après
         tous les boutons : posé avant, il aurait avalé le clic sur « Voir
         les détails », qui est posé par-dessus le héros. */
      var h = t.closest && t.closest('.nv-hero');
      if (h) {
        /* ⚠️ On relit la position RÉELLE plutôt que `INDEX` : celui-ci n'est
           mis à jour que par l'écouteur de défilement, amorti par une rAF. Un
           tap qui suit de près un glissement partirait donc de l'avant-
           dernière valeur, et sauterait au mauvais plat. */
        var i = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth));
        aller(i + 1 < ITEMS.length ? i + 1 : 0);
      }
    });
  }

  function geste(quoi, el, e) {
    e.stopPropagation();
    var it = ITEMS[INDEX];
    if (quoi === 'fermer') {
      var sl = piste.children[INDEX];
      // Le retour referme d'abord le tiroir : on remonte d'un cran.
      if (sl && sl.classList.contains('det')) { sl.classList.remove('det'); majLibelle(sl); return; }
      fermer(); return;
    }
    if (quoi === 'det') {
      var s = el.closest('.nv-sl');
      s.classList.toggle('det');
      majLibelle(s);
      return;
    }
    if (quoi === 'grip') { var s2 = el.closest('.nv-sl'); s2.classList.remove('det'); majLibelle(s2); return; }
    if (quoi === 'membre') { if (OPTS.surMembre) { fermer(); OPTS.surMembre(el.getAttribute('data-id')); } return; }
    if (quoi === 'aime') {
      if (!OPTS.aimer) return;
      el.classList.toggle('on', !!OPTS.aimer(it));
      return;
    }
    if (quoi === 'ing') { basculerIngredient(el.getAttribute('data-ing'), el.getAttribute('data-em')); return; }
    if (quoi === 'tout') { toutAjouter(it); return; }
    if (quoi === 'act') {
      var acts = OPTS.actions ? OPTS.actions(it) : [];
      var a = acts[+el.getAttribute('data-i')];
      if (a && a.on) { var r = a.on(it, el); if (typeof r === 'string') el.textContent = r; }
      return;
    }
  }

  function majLibelle(sl) {
    var b = sl.querySelector('.nv-more .lb');
    if (b) b.textContent = sl.classList.contains('det') ? 'Masquer les détails' : 'Voir les détails';
  }

  /* ── Courses ─────────────────────────────────────────────── */

  function coursesDispo() { return !!(OPTS.courses && OPTS.courses.basculer); }
  function dansLaListe(nom) {
    return coursesDispo() && OPTS.courses.contient ? !!OPTS.courses.contient(nom) : false;
  }

  function basculerIngredient(nom, em) {
    if (!coursesDispo()) return;
    var ajoute = OPTS.courses.basculer(nom, em);
    // Le même ingrédient peut apparaître sur plusieurs plats de la liste :
    // toutes ses pastilles doivent bouger, pas seulement celle qu'on a touchée.
    racine.querySelectorAll('[data-ing="' + attr(nom) + '"]').forEach(function (b) {
      b.classList.toggle('on', ajoute);
    });
    toast(ajoute ? nom + ' ajouté à vos courses' : nom + ' retiré de vos courses');
  }

  function toutAjouter(it) {
    if (!coursesDispo() || !it) return;
    var n = 0;
    (it.ingredients || []).forEach(function (g) {
      if (g.nom && !dansLaListe(g.nom)) { OPTS.courses.basculer(g.nom, g.emoji); n++; }
    });
    racine.querySelectorAll('[data-ing]').forEach(function (b) {
      b.classList.toggle('on', dansLaListe(b.getAttribute('data-ing')));
    });
    toast(n ? n + (n > 1 ? ' ingrédients ajoutés' : ' ingrédient ajouté') + ' à vos courses'
            : 'Tout est déjà dans vos courses');
  }

  var toastT;
  function toast(msg) {
    var t = racine.querySelector('#nvToast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 2000);
  }

  /* ── Rendu d'une diapositive ─────────────────────────────── */

  var MACS = [['p', '🥩', 'g'], ['g', '🌾', 'g'], ['l', '🥑', 'g'], ['c', '🔥', '']];

  function bullesMacros(m) {
    if (!m || !m.c) {
      return '<div class="nv-macs vide"><div class="nv-mac">Macros non estimées</div></div>';
    }
    return '<div class="nv-macs">' + MACS.map(function (x) {
      return '<div class="nv-mac"><span class="e">' + x[1] + '</span>'
        + Math.round(m[x[0]] || 0) + x[2] + '</div>';
    }).join('') + '</div>';
  }

  function diapo(it, i) {
    var achete = coursesDispo() && (it.ingredients || []).length > 0;
    var acts = (OPTS.actions ? OPTS.actions(it) : []) || [];

    return '<div class="nv-sl" data-i="' + i + '">'
      + '<div class="nv-jauge">' + ITEMS.map(function () {
          return '<div class="nv-seg"></div>'; }).join('') + '</div>'
      + '<div class="nv-bar">'
      +   '<button class="nv-rd" data-nv="fermer" aria-label="Retour">'
      +     '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>'
      +   '<div class="nv-ttl"' + (it.membre ? ' data-nv="membre" data-id="' + esc(it.membre) + '" style="cursor:pointer"' : '')
      +     '>' + esc(it.chapeau || OPTS.titre || '') + '</div>'
      +   (OPTS.aimer
          ? '<button class="nv-rd' + (it.aime ? ' on' : '') + '" data-nv="aime" aria-label="J\'aime">'
            + '<svg viewBox="0 0 24 24"><path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3Z"/></svg></button>'
          : '<div class="nv-num">' + (i + 1) + '/' + ITEMS.length + '</div>')
      + '</div>'

      /* La carte photo, et RIEN dessus. */
      + '<div class="nv-hero">'
      /* Trois cas, dans cet ordre : la photo, l'illustration au trait pour les
         plats que personne n'a photographiés, et l'emoji en dernier recours.
         L'illustration passe AVANT l'emoji : à 70 % de la hauteur d'écran, un
         emoji étiré est une vignette d'application, pas une image de plat. */
      +   (it.photo
          ? '<img class="nv-ph" src="' + esc(it.photo) + '" alt=""'
            + (i < 2 ? '' : ' loading="lazy"') + ' onload="this.classList.add(\'vu\')">'
          : it.illu
            ? '<div class="nv-illu">' + it.illu + '</div>'
            : '<div class="nv-fb">' + (it.emoji || '🍽️') + '</div>')
      + '</div>'

      + '<div class="nv-bas">'
      +   '<div class="nv-plate">'
      +     (it.kicker ? '<div class="nv-chap">' + esc(it.kicker) + '</div>' : '')
      +     '<div class="nv-nom">' + esc(it.nom) + '</div>'
      +     (it.desc ? '<div class="nv-desc">' + esc(it.desc) + '</div>' : '')
      +   '</div>'
      +   bullesMacros(it.macros)
      + '</div>'

      + '<button class="nv-more" data-nv="det">'
      +   '<span class="lb">Voir les détails</span><span class="ch">▼</span></button>'

      + '<div class="nv-det">'
      +   '<div class="nv-grip" data-nv="grip"></div>'
      +   (it.stats ? '<div class="nv-note" style="margin-bottom:10px">' + esc(it.stats) + '</div>' : '')
      +   ((it.tags && it.tags.length)
          ? '<div class="nv-tags">' + it.tags.map(function (t) {
              return '<span class="nv-tag">' + esc(t) + '</span>'; }).join('') + '</div>'
          : '')
      +   (it.note ? '<div class="nv-note">' + esc(it.note) + '</div>' : '')
      +   '<div class="nv-sst">Ce qu\'il y a dedans</div>'
      +   ((it.ingredients && it.ingredients.length)
          ? '<div class="nv-ings">' + it.ingredients.map(function (g) {
              var on = achete && dansLaListe(g.nom);
              return '<button class="nv-ing' + (on ? ' on' : '') + '" data-nv="ing"'
                + ' data-ing="' + esc(g.nom) + '" data-em="' + esc(g.emoji || '🛒') + '"'
                + (achete ? '' : ' disabled') + '>'
                + (g.emoji ? '<span>' + g.emoji + '</span>' : '')
                + esc(g.nom)
                + (g.q ? '<span class="q">' + esc(g.q) + '</span>' : '') + '</button>';
            }).join('') + '</div>'
          : '<div class="nv-note">Aucun ingrédient n\'a été saisi pour ce plat.</div>')
      +   '<div class="nv-acts">'
      +     '<button class="nv-p" data-nv="tout"' + (achete ? '' : ' disabled') + '>'
      +       (achete ? 'Tout ajouter à mes courses'
                     : ((it.ingredients || []).length ? 'Liste de courses indisponible' : 'Rien à ajouter'))
      +     '</button>'
      +     acts.map(function (a, k) {
              return '<button class="nv-s" data-nv="act" data-i="' + k + '">' + esc(a.txt) + '</button>';
            }).join('')
      +   '</div>'
      + '</div>'
      + '</div>';
  }

  function majBarre() {
    var it = ITEMS[INDEX];
    // La jauge et le compteur vivent DANS chaque diapositive : chacune peint
    // la sienne, il n'y a donc rien à synchroniser entre elles.
    [].forEach.call(piste.children, function (sl, i) {
      var segs = sl.querySelectorAll('.nv-seg');
      for (var k = 0; k < segs.length; k++) segs[k].classList.toggle('on', k <= INDEX);
    });
    if (it && OPTS.surVue) OPTS.surVue(it);
  }

  function aller(i) {
    if (i < 0 || i >= ITEMS.length) return;
    cacherIndice();
    piste.scrollTo({ left: i * piste.clientWidth, behavior: 'smooth' });
  }

  function cacherIndice() {
    var h = racine && racine.querySelector('#nvHint');
    if (h) h.classList.add('off');
    try { localStorage.setItem('natty_vue_geste', '1'); } catch (e) {}
  }

  /* ── Entrées publiques ───────────────────────────────────── */

  /**
   * @param {Object} o
   *   items[]     {nom, photo, illu, emoji, kicker, chapeau, desc, macros, tags,
   *                note, stats, ingredients:[{nom,emoji,q}], membre, aime}
   *   index       la diapositive de départ
   *   titre       le libellé de la barre quand l'item n'a pas de `chapeau`
   *   courses     {contient(nom), basculer(nom,emoji)} — sinon pastilles éteintes
   *   actions(it) [{txt, on(it, el)}] — boutons secondaires du tiroir
   *   aimer(it)   bascule le j'aime et renvoie le nouvel état ; sans lui, le
   *               compteur « 3/9 » prend la place du cœur
   *   surVue(it)  appelé à chaque diapositive affichée
   *   surMembre(id)
   */
  function ouvrir(o) {
    OPTS = o || {};
    ITEMS = OPTS.items || [];
    if (!ITEMS.length) return;
    INDEX = Math.max(0, Math.min(ITEMS.length - 1, OPTS.index || 0));
    monter();

    piste.innerHTML = ITEMS.map(diapo).join('');

    var deja = false;
    try { deja = !!localStorage.getItem('natty_vue_geste'); } catch (e) {}
    racine.querySelector('#nvHint').classList.toggle('off', deja || ITEMS.length < 2);

    racine.classList.add('on');
    scrollBloque = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    /* ⚠️ Le positionnement se fait APRÈS l'affichage, et sans animation. Tant
       que `#nvue` est en `display:none`, `clientWidth` vaut 0 : un `scrollTo`
       calculé là-dessus ramène à la première diapositive, quel que soit le
       plat sur lequel on a tapé. */
    piste.scrollLeft = INDEX * piste.clientWidth;
    majBarre();
  }

  function fermer() {
    if (!racine) return;
    racine.classList.remove('on');
    document.body.style.overflow = scrollBloque;
    // On vide la piste : un aller-retour ne doit pas cumuler douze plein écran
    // d'images en mémoire.
    piste.innerHTML = '';
    if (OPTS.surFermeture) OPTS.surFermeture();
  }

  return {
    ouvrir: ouvrir,
    fermer: fermer,
    estOuverte: function () { return !!racine && racine.classList.contains('on'); }
  };
})();
