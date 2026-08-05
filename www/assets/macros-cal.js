/* ═══════════════════════════════════════════════════════════
   Natty — Calendrier hebdomadaire des macros
   ───────────────────────────────────────────────────────────
   CE QUE C'EST. Deux choses, un seul module :

   1. LE PANNEAU, dans l'écran Suivi. Une carte noire qui montre la semaine
      en cours sous forme de damier : 7 colonnes (les jours) × 3 lignes (les
      trois repas de la journée). L'intensité d'une case dit à quel point la
      cible a été tenue sur ce repas-là. Quatre pages qui se font glisser :
      tout confondu (noir → blanc), puis protéines, glucides, lipides —
      chacune dans la couleur que la macro porte déjà dans les anneaux.

   2. LA VUE PLEIN ÉCRAN, au tap sur le panneau. Un graphique en barres par
      jour, avec la ligne d'objectif en travers, les semaines navigables aux
      flèches, le même glissement d'une macro à l'autre, et — sous le
      graphique — les plats du jour avec ce qu'ils ont apporté :
      « Cabillaud aux légumes · 34 g / 96 g ».

   POURQUOI L'INTENSITÉ EST PAR CASE ET NON PAR JOUR. Une couleur par jour
   aurait suffi à répondre « objectif tenu ? », mais aurait rendu les trois
   lignes décoratives. Chaque case vaut donc son repas comparé au TIERS de la
   cible du jour — les trois cases d'une colonne remplies à fond font
   exactement l'objectif. La colonne se lit toujours comme le jour, et la
   ligne dit en plus *quand* ça a flanché.

   ⚠️ CE MODULE NE VA RIEN CHERCHER EN BASE. L'écran hôte a déjà ses repas et
   ses objectifs (`allMeals`, `macObj` dans `suivi.html`) : les redemander
   aurait doublé les requêtes pour les mêmes lignes, et fait diverger deux
   affichages du même chiffre. Il reçoit, il range, il peint.

   Dépend de `assets/core.js` (`Natty.calcMac`) et sait s'en passer.
   ═══════════════════════════════════════════════════════════ */
window.NattyMacrosCal = (function () {

  /* ── Vocabulaire commun ──────────────────────────────────── */
  var JOURS  = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  var JOURS1 = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var MOIS   = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /* Mêmes bornes que `assets/planning.js` : un repas doit tomber dans le même
     créneau des deux côtés, sinon la semaine planifiée et la semaine vécue ne
     parlent pas de la même case.
     ⚠️ On lit `created_at` (horodaté) et non `meal_date` (date sèche). */
  var CRENEAUX = [
    { nom: 'Matin', em: '🥐', h0: 3,  h1: 11 },
    { nom: 'Midi',  em: '🥗', h0: 11, h1: 16 },
    { nom: 'Soir',  em: '🍽️', h0: 16, h1: 27 }
  ];

  /* Les quatre pages. Les couleurs sont CELLES DES ANNEAUX de `suivi.html`
     (--red-*, --yellow-*, --green-*) : le même sujet ne change pas de couleur
     en changeant d'écran. « Tout confondu » se compte en calories — c'est la
     seule grandeur qui additionne les trois — et se peint en blanc, comme
     demandé : du noir jusqu'au blanc, le plus blanc étant le mieux tenu. */
  var VUES = [
    { cle: 'tout', nom: 'Tout',      court: 'Tout',     em: '🍽️', k: 'c', unite: 'kcal',
      rgb: '255,255,255', c1: '#ffffff', c2: '#b9bcc4' },
    { cle: 'p',    nom: 'Protéines', court: 'Prot.',    em: '🥩', k: 'p', unite: 'g',
      rgb: '255,122,104', c1: '#ff7a68', c2: '#e2503d' },
    { cle: 'g',    nom: 'Glucides',  court: 'Gluc.',    em: '🌾', k: 'g', unite: 'g',
      rgb: '224,178,60',  c1: '#e0b23c', c2: '#b8860b' },
    { cle: 'l',    nom: 'Lipides',   court: 'Lip.',     em: '🥑', k: 'l', unite: 'g',
      rgb: '111,207,125', c1: '#6fcf7d', c2: '#2f9e4f' }
  ];

  /* ── État ────────────────────────────────────────────────── */
  var repas = [];           // les repas fournis par l'écran hôte
  var cibles = { p: 0, g: 0, l: 0, c: 0 };
  var hote = null;          // conteneur du panneau
  var vueCourante = 0;      // index dans VUES, partagé panneau ↔ plein écran
  var offsetSemaine = 0;    // 0 = semaine en cours, -1 = la précédente…
  var plein = null;         // racine du plein écran
  var scrollGele = null;

  /* ═══ 1. Dates, cases, calculs ═══════════════════════════ */

  function lundiDe(offset) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var j = d.getDay();
    d.setDate(d.getDate() - j + (j === 0 ? -6 : 1) + (offset || 0) * 7);
    return d;
  }

  function jourIndex(date) { var j = new Date(date).getDay(); return j === 0 ? 6 : j - 1; }

  function creneauIndex(date) {
    var h = new Date(date).getHours();
    if (h >= CRENEAUX[0].h0 && h < CRENEAUX[0].h1) return 0;
    if (h >= CRENEAUX[1].h0 && h < CRENEAUX[1].h1) return 1;
    return 2;                      // avant 3 h du matin = dîner de la veille
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function macrosDe(m) {
    if (window.Natty && typeof Natty.calcMac === 'function') return Natty.calcMac(m.meal_ingredients);
    if (typeof window.calcMac === 'function') return window.calcMac(m.meal_ingredients);
    return { c: 0, p: 0, l: 0, g: 0 };
  }

  function arrondi(v) { return Math.round(v || 0); }

  /**
   * Range la semaine demandée en 7 jours × 3 créneaux.
   * @returns {object} { debut, fin, jours:[ { date, cases:[3], total:{}, repas:[] } ] }
   */
  function semaine(offset) {
    var debut = lundiDe(offset);
    var fin = new Date(debut); fin.setDate(fin.getDate() + 7);
    var jours = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(debut); d.setDate(d.getDate() + i);
      jours.push({
        date: d,
        cases: [
          { mac: { p: 0, g: 0, l: 0, c: 0 }, repas: [] },
          { mac: { p: 0, g: 0, l: 0, c: 0 }, repas: [] },
          { mac: { p: 0, g: 0, l: 0, c: 0 }, repas: [] }
        ],
        total: { p: 0, g: 0, l: 0, c: 0 },
        repas: []
      });
    }
    (repas || []).forEach(function (m) {
      if (!m || !m.created_at) return;
      var t = new Date(m.created_at);
      if (isNaN(t) || t < debut || t >= fin) return;
      var ji = jourIndex(t), ci = creneauIndex(t);
      // Un repas enregistré avant 3 h du matin appartient au dîner de la
      // VEILLE — sans ce recul d'un jour, il irait grossir un lundi qui n'a
      // pas encore commencé.
      if (t.getHours() < CRENEAUX[0].h0) { ji = ji === 0 ? 6 : ji - 1; if (jourIndex(t) === 0) return; }
      var mac = macrosDe(m);
      var j = jours[ji], c = j.cases[ci];
      ['p', 'g', 'l', 'c'].forEach(function (k) { c.mac[k] += mac[k] || 0; j.total[k] += mac[k] || 0; });
      var ligne = { meal: m, mac: mac, creneau: ci, heure: t };
      c.repas.push(ligne); j.repas.push(ligne);
    });
    jours.forEach(function (j) { j.repas.sort(function (a, b) { return a.heure - b.heure; }); });
    return { debut: debut, fin: fin, jours: jours };
  }

  function libelleSemaine(offset) {
    if (offset === 0) return 'Cette semaine';
    if (offset === -1) return 'Semaine dernière';
    var d = lundiDe(offset), f = new Date(d); f.setDate(f.getDate() + 6);
    return d.getMonth() === f.getMonth()
      ? 'Du ' + d.getDate() + ' au ' + f.getDate() + ' ' + MOIS[f.getMonth()]
      : 'Du ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' au ' + f.getDate() + ' ' + MOIS[f.getMonth()];
  }

  function cibleDe(vue) { return cibles[vue.k] || 0; }

  /* ═══ 2. Le panneau de l'écran Suivi ═════════════════════ */

  var cssPanneauFait = false;
  function cssPanneau() {
    if (cssPanneauFait) return; cssPanneauFait = true;
    var s = document.createElement('style');
    s.textContent = [
      /* La carte reprend le noir métallisé des cartes Calories/Objectif de
         Suivi : trois cartes noires à la suite, une seule matière. */
      '.nmc{--nmc-c:20px;--nmc-g:4px;',
      'position:relative;border-radius:22px;padding:13px 14px 11px;color:#fff;',
      'background:radial-gradient(130% 65% at 12% -10%,rgba(255,255,255,.11) 0%,rgba(255,255,255,0) 42%),',
      'linear-gradient(135deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 28%),',
      'linear-gradient(165deg,#0c0d0f 0%,#050506 55%,#000 100%);',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.6),0 10px 24px rgba(0,0,0,.5)}',

      '.nmc-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:9px}',
      '.nmc-head .t{font-size:13px;font-weight:800;letter-spacing:-.02em}',
      '.nmc-head .d{font-size:10px;font-weight:600;color:rgba(255,255,255,.42)}',

      /* Les quatre pages. Le glissement natif (scroll-snap) plutôt qu'un
         carrousel maison : l'inertie est celle du système, donc juste.
         ⚠️ Pas de `margin:0 -16px;padding:0 16px` pour scroller bord à bord :
         `min-width:100%` se mesure sur la boîte de CONTENU (326 px) alors que
         le cadre visible en fait 358 — les 32 px d'écart laissaient voir la
         colonne d'emojis de la page suivante, qui venait percuter « obj. 2400 »
         et se lisait comme un doublon d'icônes. */
      '.nmc-pages{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;',
      'scrollbar-width:none;-webkit-overflow-scrolling:touch}',
      '.nmc-pages::-webkit-scrollbar{display:none}',
      '.nmc-page{min-width:100%;scroll-snap-align:center;flex:0 0 100%;cursor:pointer}',

      /* Le relevé est à DROITE de la grille, pas au-dessus. Sept colonnes de
         cases fixes ne font que 180 px : posé sur sa propre ligne, il laissait
         150 px de vide à côté du damier tout en coûtant une rangée de hauteur.
         À droite, il comble ce vide et rend la carte plus courte. */
      '.nmc-body{display:flex;align-items:center;gap:12px}',
      '.nmc-side{flex:1;min-width:0;text-align:right}',
      '.nmc-side .sn{font-size:11px;font-weight:800;letter-spacing:-.01em;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.nmc-side .sv{font-size:19px;font-weight:800;letter-spacing:-.03em;margin-top:3px;line-height:1}',
      '.nmc-side .sv span{font-size:10px;font-weight:700;color:rgba(255,255,255,.45);margin-left:2px}',
      '.nmc-side .so{font-size:9.5px;font-weight:600;color:rgba(255,255,255,.38);margin-top:3px}',

      /* ⚠️ UNE seule grille pour les libellés ET les trois lignes, et des cases
         de taille FIXE — pas `1fr` avec `aspect-ratio:1/1`. Étalées sur toute
         la largeur de la carte, sept colonnes donnaient des cases de 38 px :
         le damier faisait à lui seul 114 px de haut et la carte 270, soit deux
         fois les autres modules de l'écran. La taille est ici la même quelle
         que soit la largeur, et c'est elle qui commande la hauteur du bloc.
         Même raison que le calendrier de `assets/planning.js`, qui a renoncé
         à `aspect-ratio:1/1` pour la même raison. */
      '.nmc-grid{display:inline-grid;grid-template-columns:12px repeat(7,var(--nmc-c));',
      'gap:var(--nmc-g);align-items:center;justify-items:center}',
      '.nmc-grid .dj{font-size:8.5px;font-weight:700;color:rgba(255,255,255,.32);line-height:1}',
      '.nmc-grid .dj.auj{color:#fff}',
      '.nmc-grid .cre{font-size:8.5px;opacity:.5;line-height:1}',
      /* Une case : carrée, vide par défaut. Le remplissage est posé en style
         inline (couleur + opacité), c'est la seule chose qui varie. */
      '.nmc-c{width:var(--nmc-c);height:var(--nmc-c);border-radius:4px;',
      'background:rgba(255,255,255,.055);',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);position:relative}',
      /* Au-delà de la cible, un liseré : « tenu » et « dépassé » ne doivent pas
         se ressembler, alors que l'intensité, elle, plafonne. */
      '.nmc-c.over{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.55)}',
      '.nmc-c.auj{box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)}',

      '.nmc-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}',
      '.nmc-leg{display:flex;align-items:center;gap:3px;font-size:8px;font-weight:600;color:rgba(255,255,255,.32)}',
      '.nmc-leg i{width:7px;height:7px;border-radius:2px;display:block}',
      '.nmc-dots{display:flex;gap:4px}',
      '.nmc-dots b{width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,.22);transition:all .2s}',
      '.nmc-dots b.on{background:#fff;width:12px;border-radius:99px}',
      '.nmc-tap{font-size:9px;font-weight:700;color:rgba(255,255,255,.45)}',
      '.nmc-vide{font-size:11px;color:rgba(255,255,255,.4);text-align:center;padding:6px 0 2px}'
    ].join('');
    document.head.appendChild(s);
  }

  /** Opacité d'une case : 0 si rien, sinon jamais sous .16 — un repas
      enregistré doit se voir, même s'il pèse peu, sinon la case ment. */
  function intensite(part) {
    if (part <= 0) return 0;
    return Math.min(1, 0.16 + Math.min(1, part) * 0.84);
  }

  function grille(vue, sem) {
    var cible = cibleDe(vue), parCase = cible / 3;
    var auj = jourIndex(new Date()), estSemaineCourante = offsetSemaine === 0;
    // Une grille unique de 4 rangées × 8 colonnes : les libellés de jours
    // partagent alors le même gabarit que les cases, donc ils restent alignés
    // sans qu'on ait à répéter `grid-template-columns` à trois endroits.
    var h = '<div class="nmc-grid"><div></div>'
      + JOURS1.map(function (j, i) {
          return '<div class="dj' + (estSemaineCourante && i === auj ? ' auj' : '') + '">' + j + '</div>';
        }).join('');
    for (var c = 0; c < 3; c++) {
      h += '<div class="cre">' + CRENEAUX[c].em + '</div>';
      for (var i = 0; i < 7; i++) {
        var v = sem.jours[i].cases[c].mac[vue.k] || 0;
        var part = parCase > 0 ? v / parCase : 0;
        var o = intensite(part);
        var cls = 'nmc-c'
          + (part > 1.25 ? ' over' : '')
          + (estSemaineCourante && i === auj && o === 0 ? ' auj' : '');
        var style = o > 0 ? ' style="background:rgba(' + vue.rgb + ',' + o.toFixed(2) + ')"' : '';
        h += '<div class="' + cls + '"' + style + ' title="' + esc(JOURS[i] + ' · ' + CRENEAUX[c].nom
          + ' — ' + arrondi(v) + ' ' + vue.unite) + '"></div>';
      }
    }
    return h + '</div>';
  }

  function pagePanneau(vue, sem) {
    var cible = cibleDe(vue);
    var total = 0, joursRemplis = 0;
    sem.jours.forEach(function (j) {
      total += j.total[vue.k] || 0;
      if (j.repas.length) joursRemplis++;
    });
    var moy = joursRemplis ? total / joursRemplis : 0;
    return '<div class="nmc-page" data-nmc="ouvrir"><div class="nmc-body">'
      + grille(vue, sem)
      + '<div class="nmc-side">'
      + '<div class="sn">' + vue.em + ' ' + esc(vue.nom) + '</div>'
      + (joursRemplis
          ? '<div class="sv">' + arrondi(moy) + '<span>' + vue.unite + '/j</span></div>'
          : '<div class="sv">–</div>')
      + '<div class="so">' + (cible ? 'objectif ' + arrondi(cible) + ' ' + vue.unite
                                    : 'objectif inconnu') + '</div>'
      + '</div></div></div>';
  }

  function peindrePanneau() {
    if (!hote) return;
    cssPanneau();
    var sem = semaine(offsetSemaine);
    var pages = document.getElementById('nmcPages');
    var scrollAvant = pages ? pages.scrollLeft : -1;

    hote.innerHTML = '<div class="nmc">'
      + '<div class="nmc-head"><div class="t">Ma semaine en macros</div>'
      + '<div class="d">' + esc(libelleSemaine(offsetSemaine)) + '</div></div>'
      + '<div class="nmc-pages" id="nmcPages">'
      + VUES.map(function (v) { return pagePanneau(v, sem); }).join('')
      + '</div>'
      + '<div class="nmc-foot">'
      + '<div class="nmc-leg">Moins'
      + [0.18, 0.4, 0.65, 1].map(function (o) {
          return '<i style="background:rgba(' + VUES[vueCourante].rgb + ',' + o + ')"></i>';
        }).join('')
      + 'Plus</div>'
      + '<div class="nmc-dots">'
      + VUES.map(function (v, i) { return '<b class="' + (i === vueCourante ? 'on' : '') + '"></b>'; }).join('')
      + '</div>'
      + '<div class="nmc-tap">Détail ›</div>'
      + '</div></div>';

    var el = document.getElementById('nmcPages');
    if (!el) return;
    // Repositionner sur la page courante sans animation : un repeint (ajout
    // d'un repas) ne doit pas ramener l'utilisateur à la première macro.
    // ⚠️ `vueCourante` TRANCHE quand les deux ne disent pas la même chose.
    // Reprendre aveuglément le scroll d'avant faisait mentir la fermeture du
    // plein écran : on y passait sur Lipides, on fermait, et le panneau
    // revenait sur la macro d'avant l'ouverture (mesuré : plein écran sur
    // Lipides, panneau retombé sur Protéines) alors que cet index est
    // justement l'état partagé entre les deux vues. Le scroll mémorisé ne
    // sert donc qu'à ne pas sauter quand il désigne DÉJÀ la bonne page.
    var poser = function () {
      var large = Math.max(1, el.clientWidth);
      var memePage = scrollAvant >= 0 && Math.round(scrollAvant / large) === vueCourante;
      el.scrollLeft = memePage ? scrollAvant : vueCourante * large;
    };
    poser(); requestAnimationFrame(poser); setTimeout(poser, 60);

    var minuteur = null;
    el.addEventListener('scroll', function () {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () {
        var i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        if (i !== vueCourante && VUES[i]) { vueCourante = i; majDotsEtLegende(); }
      }, 60);
    }, { passive: true });

    // Un tap ouvre le plein écran, un glissement non. On mesure le déplacement
    // plutôt que de se fier à `click` : sur iOS, un scroll horizontal se
    // termine par un `click` sur la page qu'on vient de quitter.
    var x0 = 0, y0 = 0, bouge = false;
    el.addEventListener('touchstart', function (e) {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; bouge = false;
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (Math.abs(e.touches[0].clientX - x0) > 8 || Math.abs(e.touches[0].clientY - y0) > 8) bouge = true;
    }, { passive: true });
    el.addEventListener('click', function () { if (!bouge) ouvrir(); });
  }

  function majDotsEtLegende() {
    var dots = hote && hote.querySelectorAll('.nmc-dots b');
    if (dots) for (var i = 0; i < dots.length; i++) dots[i].className = i === vueCourante ? 'on' : '';
    var leg = hote && hote.querySelectorAll('.nmc-leg i');
    if (leg) [0.18, 0.4, 0.65, 1].forEach(function (o, i) {
      if (leg[i]) leg[i].style.background = 'rgba(' + VUES[vueCourante].rgb + ',' + o + ')';
    });
  }

  /* ═══ 3. Le plein écran ══════════════════════════════════ */

  var cssPleinFait = false;
  function cssPlein() {
    if (cssPleinFait) return; cssPleinFait = true;
    var s = document.createElement('style');
    s.textContent = [
      /* Au-dessus de la barre d'onglets (#nattyNav, z-index 500) : une page
         plein écran qui laisserait dépasser la nav ne serait pas une page. */
      '#nmcf{position:fixed;inset:0;z-index:1100;background:#050506;color:#fff;',
      'font-family:Inter,-apple-system,sans-serif;display:none;flex-direction:column;',
      'opacity:0;transition:opacity .22s ease}',
      '#nmcf.on{display:flex;opacity:1}',

      '#nmcf .bar{display:flex;align-items:center;gap:10px;padding:calc(14px + env(safe-area-inset-top,0px)) 16px 10px;flex:0 0 auto}',
      '#nmcf .bar .t{font-size:19px;font-weight:800;letter-spacing:-.02em}',
      '#nmcf .bar .s{font-size:11.5px;color:rgba(255,255,255,.42);font-weight:600;margin-top:1px}',
      '#nmcf .x{margin-left:auto;width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;',
      'background:rgba(255,255,255,.09);color:#fff;font-size:16px;line-height:1;display:flex;',
      'align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}',
      '#nmcf .x:active{background:rgba(255,255,255,.18)}',

      '#nmcf .tabs{display:flex;gap:6px;padding:0 16px 12px;flex:0 0 auto}',
      '#nmcf .tabs button{flex:1;background:rgba(255,255,255,.07);border:none;border-radius:99px;',
      'padding:9px 4px;font-family:inherit;font-size:11.5px;font-weight:700;color:rgba(255,255,255,.55);',
      'cursor:pointer;transition:all .18s ease;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}',
      '#nmcf .tabs button.on{color:#0a0a0c;font-weight:800}',

      '#nmcf .body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      'padding:0 16px calc(34px + env(safe-area-inset-bottom,0px))}',
      '#nmcf .glisse{transition:transform .2s cubic-bezier(.22,1,.36,1),opacity .2s ease}',

      /* Navigation de semaine. */
      '#nmcf .wk{display:flex;align-items:center;gap:10px;margin-bottom:12px}',
      '#nmcf .wk button{width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;flex:0 0 auto;',
      'background:rgba(255,255,255,.08);color:#fff;font-size:15px;font-family:inherit;',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}',
      '#nmcf .wk button:disabled{opacity:.25;cursor:default}',
      '#nmcf .wk .lbl{flex:1;text-align:center;font-size:13px;font-weight:800;letter-spacing:-.01em}',

      /* La carte du graphique. */
      '#nmcf .card{background:linear-gradient(165deg,#101114 0%,#0a0b0d 100%);border-radius:24px;',
      'padding:18px 16px 14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 24px rgba(0,0,0,.5)}',
      '#nmcf .card .hd{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px}',
      '#nmcf .card .hd .v{font-size:26px;font-weight:800;letter-spacing:-.03em}',
      '#nmcf .card .hd .v span{font-size:13px;font-weight:700;color:rgba(255,255,255,.42);margin-left:4px}',
      '#nmcf .card .hd .o{font-size:11px;font-weight:700;color:rgba(255,255,255,.42);text-align:right}',

      '#nmcf .plot{position:relative;height:172px;margin-bottom:6px}',
      '#nmcf .plot .ln{position:absolute;left:0;right:0;height:1px;background:rgba(255,255,255,.06)}',
      '#nmcf .bars{position:absolute;inset:0;display:grid;grid-template-columns:repeat(7,1fr);gap:5px;align-items:end}',
      '#nmcf .col{position:relative;height:100%;cursor:pointer}',
      /* DEUX barres par jour : le réalisé à gauche, l'objectif à droite.
         Avant, une barre unique devait « atteindre » une ligne pointillée —
         il fallait suivre la ligne des yeux jusqu'au bord pour savoir de
         combien on était loin. Deux barres côte à côte se comparent sur place,
         sans rien à parcourir du regard. */
      '#nmcf .duo{position:absolute;inset:0;display:flex;align-items:flex-end;gap:3px}',
      '#nmcf .duo .b{flex:1;height:0;border-radius:6px 6px 2px 2px;',
      'transition:height .7s cubic-bezier(.22,1,.36,1)}',
      /* L'objectif est creux : c'est le repère, pas le résultat. Plein, les
         deux barres se seraient disputé le regard. */
      '#nmcf .duo .bo{background:rgba(255,255,255,.10);',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.11)}',
      /* Le chiffre est cadré sur la MOITIÉ GAUCHE, au-dessus de la seule barre
         du réalisé, et à SA hauteur. Centré sur la colonne et calé sur la plus
         haute des deux barres, il s'alignait avec l'objectif : les trois
         valeurs se retrouvaient à la même hauteur, en rang d'oignons, et
         « 19 » flottait très au-dessus de la petite barre qu'il décrivait. */
      '#nmcf .col .n{position:absolute;left:0;right:50%;text-align:center;font-size:9px;font-weight:800;',
      'color:rgba(255,255,255,.75);transition:bottom .7s cubic-bezier(.22,1,.36,1)}',
      '#nmcf .col .z{position:absolute;left:0;right:0;bottom:0;height:3px;border-radius:2px;',
      'background:rgba(255,255,255,.09)}',
      /* Sans légende, rien ne dit laquelle des deux barres est laquelle. */
      '#nmcf .lg{display:flex;justify-content:center;gap:14px;margin:2px 0 0}',
      '#nmcf .lg span{display:flex;align-items:center;gap:5px;font-size:9.5px;font-weight:700;',
      'color:rgba(255,255,255,.45)}',
      '#nmcf .lg i{width:9px;height:9px;border-radius:3px;display:block}',
      '#nmcf .lg i.io{background:rgba(255,255,255,.10);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}',
      '#nmcf .days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:8px}',
      '#nmcf .days div{text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,.35)}',
      '#nmcf .days div.auj{color:#fff}',
      '#nmcf .days div.sel{color:#fff;text-decoration:underline;text-underline-offset:3px}',

      '#nmcf .sum{display:flex;gap:8px;margin:12px 0 18px}',
      '#nmcf .sum div{flex:1;background:rgba(255,255,255,.05);border-radius:15px;padding:10px 12px;',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}',
      '#nmcf .sum b{display:block;font-size:16px;font-weight:800;letter-spacing:-.02em}',
      '#nmcf .sum span{font-size:10px;font-weight:600;color:rgba(255,255,255,.4)}',

      /* L'historique, jour par jour. */
      '#nmcf .titre{font-size:12px;font-weight:800;color:rgba(255,255,255,.45);',
      'text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}',
      '#nmcf .jr{background:rgba(255,255,255,.04);border-radius:18px;padding:13px 14px;margin-bottom:10px;',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);transition:box-shadow .3s ease}',
      '#nmcf .jr.vise{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.34)}',
      '#nmcf .jr .h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:9px}',
      '#nmcf .jr .h .d{font-size:13px;font-weight:800;letter-spacing:-.01em}',
      '#nmcf .jr .h .q{font-size:12px;font-weight:800}',
      '#nmcf .jr .h .q span{color:rgba(255,255,255,.38);font-weight:700}',
      '#nmcf .jr .bar2{height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;margin-bottom:11px}',
      '#nmcf .jr .bar2 i{display:block;height:100%;border-radius:2px}',
      '#nmcf .pl{display:flex;align-items:center;gap:10px;padding:6px 0}',
      '#nmcf .pl .em{width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.07);',
      'display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto}',
      '#nmcf .pl .em img{width:100%;height:100%;object-fit:cover;border-radius:9px}',
      '#nmcf .pl .n{flex:1;min-width:0;font-size:12.5px;font-weight:700;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '#nmcf .pl .n i{display:block;font-style:normal;font-size:10px;font-weight:600;color:rgba(255,255,255,.35);margin-top:1px}',
      '#nmcf .pl .q{flex:0 0 auto;font-size:12.5px;font-weight:800;text-align:right}',
      '#nmcf .pl .q span{color:rgba(255,255,255,.35);font-weight:700;font-size:11px}',
      '#nmcf .vide{font-size:11.5px;color:rgba(255,255,255,.32);padding:2px 0 4px}',
      '#nmcf .rien{text-align:center;color:rgba(255,255,255,.4);font-size:12.5px;padding:26px 10px;line-height:1.6}'
    ].join('');
    document.head.appendChild(s);
  }

  function monterPlein() {
    cssPlein();
    if (plein) return plein;
    plein = document.createElement('div');
    plein.id = 'nmcf';
    plein.innerHTML =
      '<div class="bar"><div><div class="t" id="nmcfT">Protéines</div>'
      + '<div class="s" id="nmcfS">–</div></div>'
      + '<button class="x" id="nmcfX" aria-label="Fermer">✕</button></div>'
      + '<div class="tabs" id="nmcfTabs"></div>'
      + '<div class="body" id="nmcfBody"><div class="glisse" id="nmcfGlisse"></div></div>';
    document.body.appendChild(plein);

    plein.querySelector('#nmcfX').addEventListener('click', fermer);

    // Un seul écouteur, posé une fois : la vue est relue dans l'état, pas
    // capturée dans une closure — sinon chaque repeint empilerait un geste.
    var body = plein.querySelector('#nmcfBody');
    var x0 = 0, y0 = 0, actif = false;
    body.addEventListener('touchstart', function (e) {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; actif = true;
    }, { passive: true });
    body.addEventListener('touchend', function (e) {
      if (!actif) return; actif = false;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      glisserVers(vueCourante + (dx < 0 ? 1 : -1));
    }, { passive: true });

    plein.addEventListener('click', function (e) {
      var t = e.target.closest('[data-nmcf]');
      if (!t) return;
      var a = t.getAttribute('data-nmcf');
      if (a === 'sem') { offsetSemaine = Math.min(0, offsetSemaine + (+t.getAttribute('data-d'))); peindrePlein(); peindrePanneau(); }
      else if (a === 'vue') glisserVers(+t.getAttribute('data-i'));
      else if (a === 'jour') viserJour(+t.getAttribute('data-j'));
    });
    return plein;
  }

  /** Passe d'une macro à l'autre en la faisant *glisser* : un changement qui
      clignote se lit comme un rechargement, pas comme un déplacement. */
  function glisserVers(i) {
    if (i < 0 || i >= VUES.length || i === vueCourante) return;
    var sens = i > vueCourante ? 1 : -1;
    var g = plein && plein.querySelector('#nmcfGlisse');
    if (!g) { vueCourante = i; peindrePlein(); return; }
    g.style.transform = 'translateX(' + (-sens * 34) + 'px)';
    g.style.opacity = '0.2';
    setTimeout(function () {
      vueCourante = i;
      peindrePlein();
      plein.querySelector('#nmcfBody').scrollTop = 0;
      g = plein.querySelector('#nmcfGlisse');
      g.style.transition = 'none';
      g.style.transform = 'translateX(' + (sens * 34) + 'px)';
      g.style.opacity = '0.2';
      // Doublé d'un `setTimeout`, comme l'ouverture : si la rAF ne s'exécute
      // pas (page qui ne peint pas), la vue resterait décalée et à 20 %
      // d'opacité — donc illisible, sans que rien ne signale l'anomalie.
      var poser = function () {
        g.style.transition = 'transform .22s cubic-bezier(.22,1,.36,1),opacity .22s ease';
        g.style.transform = 'translateX(0)';
        g.style.opacity = '1';
      };
      requestAnimationFrame(poser);
      setTimeout(poser, 60);
    }, 170);
    majDotsEtLegende();
  }

  function viserJour(j) {
    var el = plein && plein.querySelector('.jr[data-jour="' + j + '"]');
    var jours = plein && plein.querySelectorAll('.jr');
    if (jours) for (var i = 0; i < jours.length; i++) jours[i].classList.remove('vise');
    var lbl = plein && plein.querySelectorAll('.days div');
    if (lbl) for (var k = 0; k < lbl.length; k++) lbl[k].classList.remove('sel');
    if (lbl && lbl[j]) lbl[j].classList.add('sel');
    if (!el) return;
    el.classList.add('vise');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function vignetteRepas(l) {
    var p = l.meal && l.meal.photo_url;
    return '<div class="em">' + (p
      ? '<img src="' + esc(p) + '" alt="" onerror="this.parentNode.textContent=\'🍽️\'">'
      : CRENEAUX[l.creneau].em) + '</div>';
  }

  function peindrePlein() {
    var vue = VUES[vueCourante], sem = semaine(offsetSemaine), cible = cibleDe(vue);
    plein.querySelector('#nmcfT').textContent = vue.em + ' ' + vue.nom;
    plein.querySelector('#nmcfS').textContent = vue.cle === 'tout'
      ? 'Calories consommées face à votre objectif'
      : 'Apport quotidien face à votre objectif';

    plein.querySelector('#nmcfTabs').innerHTML = VUES.map(function (v, i) {
      return '<button data-nmcf="vue" data-i="' + i + '" class="' + (i === vueCourante ? 'on' : '') + '"'
        + (i === vueCourante ? ' style="background:' + v.c1 + ';box-shadow:none"' : '')
        + '>' + v.em + ' ' + esc(v.court) + '</button>';
    }).join('');

    var totaux = sem.jours.map(function (j) { return j.total[vue.k] || 0; });
    var joursRemplis = sem.jours.filter(function (j) { return j.repas.length; }).length;
    var somme = totaux.reduce(function (a, b) { return a + b; }, 0);
    var moy = joursRemplis ? somme / joursRemplis : 0;
    var atteints = cible ? totaux.filter(function (v) { return v >= cible * 0.9; }).length : 0;
    // L'échelle tient compte de la CIBLE autant que du réalisé : la barre
    // d'objectif est dessinée à sa hauteur pleine, donc une échelle calée sur
    // le seul réalisé la ferait sortir du cadre les semaines creuses.
    var haut = Math.max(cible, Math.max.apply(null, totaux), 1) * 1.15;
    var auj = jourIndex(new Date()), estCourante = offsetSemaine === 0;

    var h = '<div class="wk">'
      + '<button data-nmcf="sem" data-d="-1">‹</button>'
      + '<div class="lbl">' + esc(libelleSemaine(offsetSemaine)) + '</div>'
      + '<button data-nmcf="sem" data-d="1"' + (offsetSemaine >= 0 ? ' disabled' : '') + '>›</button>'
      + '</div>';

    h += '<div class="card">'
      + '<div class="hd"><div class="v">' + arrondi(moy) + '<span>' + vue.unite + ' / jour</span></div>'
      + '<div class="o">' + (cible ? 'Objectif ' + arrondi(cible) + ' ' + vue.unite : 'Objectif inconnu')
      + '<br>' + (joursRemplis ? joursRemplis + ' jour' + (joursRemplis > 1 ? 's' : '') + ' renseigné' + (joursRemplis > 1 ? 's' : '') : 'aucun repas') + '</div></div>';

    var pctCible = cible ? Math.min(100, cible / haut * 100) : 0;
    h += '<div class="plot">'
      + '<div class="ln" style="top:0"></div><div class="ln" style="top:50%"></div><div class="ln" style="bottom:0"></div>'
      + '<div class="bars">'
      + totaux.map(function (v, i) {
          var pct = Math.min(100, v / haut * 100);
          var atteint = cible && v >= cible * 0.9;
          return '<div class="col" data-nmcf="jour" data-j="' + i + '">'
            + (v > 0 || cible ? '' : '<div class="z"></div>')
            + (v > 0 ? '<div class="n" data-h="' + pct.toFixed(1) + '">' + arrondi(v) + '</div>' : '')
            + '<div class="duo">'
            + '<div class="b br" data-h="' + pct.toFixed(1) + '" style="background:linear-gradient(180deg,'
            + vue.c1 + ' 0%,' + vue.c2 + ' 62%,rgba(' + vue.rgb + ',.18) 100%);'
            + (atteint ? 'box-shadow:0 0 14px rgba(' + vue.rgb + ',.35);' : '') + '"></div>'
            + (cible ? '<div class="b bo" data-h="' + pctCible.toFixed(1) + '"></div>' : '')
            + '</div></div>';
        }).join('')
      + '</div></div>';

    h += '<div class="days">'
      + JOURS1.map(function (j, i) {
          return '<div class="' + (estCourante && i === auj ? 'auj' : '') + '">' + j + '</div>';
        }).join('')
      + '</div>';

    h += '<div class="lg">'
      + '<span><i style="background:' + vue.c1 + '"></i>Réalisé</span>'
      + (cible ? '<span><i class="io"></i>Objectif</span>' : '')
      + '</div>';

    h += '<div class="sum">'
      + '<div><b>' + arrondi(somme) + '</b><span>total ' + vue.unite + ' sur la semaine</span></div>'
      + '<div><b>' + atteints + ' / 7</b><span>jours à l\'objectif</span></div>'
      + '</div>';

    h += '</div>';   // .card

    /* L'historique. Les jours sans repas sont montrés aussi : une semaine à
       trous se lit dans les trous, pas seulement dans ce qui reste. */
    h += '<div class="titre">Les plats de la semaine</div>';
    if (!joursRemplis) {
      h += '<div class="rien">Aucun repas enregistré cette semaine.<br>'
        + 'Ajoutez un plat avec le bouton + : il apparaîtra ici, jour par jour.</div>';
    } else {
      sem.jours.forEach(function (j, i) {
        if (!j.repas.length) return;
        var t = j.total[vue.k] || 0;
        var pct = cible ? Math.min(100, t / cible * 100) : 0;
        h += '<div class="jr" data-jour="' + i + '">'
          + '<div class="h"><div class="d">' + JOURS[i] + ' ' + j.date.getDate() + ' ' + MOIS[j.date.getMonth()] + '</div>'
          + '<div class="q">' + arrondi(t) + ' ' + vue.unite
          + (cible ? ' <span>/ ' + arrondi(cible) + ' ' + vue.unite + '</span>' : '') + '</div></div>'
          + (cible ? '<div class="bar2"><i style="width:' + pct.toFixed(0) + '%;background:linear-gradient(90deg,'
              + vue.c2 + ',' + vue.c1 + ')"></i></div>' : '')
          + j.repas.map(function (l) {
              var v = l.mac[vue.k] || 0;
              return '<div class="pl">' + vignetteRepas(l)
                + '<div class="n">' + esc(l.meal.name || 'Repas')
                + '<i>' + CRENEAUX[l.creneau].nom + ' · '
                + String(l.heure.getHours()).padStart(2, '0') + 'h'
                + String(l.heure.getMinutes()).padStart(2, '0') + '</i></div>'
                + '<div class="q">' + arrondi(v) + ' ' + vue.unite
                + (cible ? ' <span>/ ' + arrondi(cible) + '</span>' : '') + '</div></div>';
            }).join('')
          + '</div>';
      });
    }

    plein.querySelector('#nmcfGlisse').innerHTML = h;

    // Les barres poussent depuis le bas : la hauteur est posée après le
    // premier rendu, sinon la transition n'a pas d'état de départ à quitter.
    // ⚠️ Doublé d'un `setTimeout` : `.b` part de `height:0`, donc une rAF qui
    // ne s'exécute pas laisse un graphique **vide** — le pire des échecs
    // possibles ici, et le plus silencieux.
    // ⚠️ `classList.contains`, pas `className === 'b'` : les barres portent
    // désormais deux classes (`b br` pour le réalisé, `b bo` pour l'objectif)
    // et l'égalité stricte ne reconnaissait plus aucune des deux — le
    // graphique serait resté vide.
    var pousser = function () {
      var bars = plein.querySelectorAll('#nmcfGlisse .b, #nmcfGlisse .n');
      for (var i = 0; i < bars.length; i++) {
        var p = bars[i].getAttribute('data-h');
        if (bars[i].classList.contains('b')) bars[i].style.height = p + '%';
        else bars[i].style.bottom = 'calc(' + p + '% + 4px)';
      }
    };
    requestAnimationFrame(pousser);
    setTimeout(pousser, 60);
  }

  /* ═══ 4. Ouverture / fermeture ═══════════════════════════ */

  function ouvrir(cle) {
    if (cle) {
      for (var i = 0; i < VUES.length; i++) if (VUES[i].cle === cle) vueCourante = i;
    }
    monterPlein();
    peindrePlein();
    // overflow:hidden seul — position:fixed sur body casse le scroll mobile
    // (règle §9 #6 de CLAUDE.md).
    scrollGele = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    plein.style.display = 'flex';
    // ⚠️ La classe de visibilité ne peut PAS reposer sur la seule
    // `requestAnimationFrame` : quand la page ne peint pas (onglet caché, app
    // en arrière-plan), elle ne s'exécute jamais et l'écran reste à
    // `opacity:0` **tout en interceptant les taps** — constaté ici, opacité
    // encore 0 après le clic. Même doublage que `core.js` et
    // `assets/generation.js`, pour la même raison.
    var montrer = function () { if (plein) plein.classList.add('on'); };
    requestAnimationFrame(montrer);
    setTimeout(montrer, 60);
  }

  function fermer() {
    if (!plein) return;
    plein.classList.remove('on');
    document.body.style.overflow = scrollGele || '';
    setTimeout(function () { if (plein) plein.style.display = 'none'; }, 220);
    peindrePanneau();
  }

  /* ═══ 5. API ═════════════════════════════════════════════ */

  /**
   * Monte le panneau dans un conteneur de l'écran hôte.
   * @param {HTMLElement} el
   * @param {Array}  meals  repas avec leurs `meal_ingredients`
   * @param {object} obj    objectifs du jour {p,g,l,c}
   */
  function monter(el, meals, obj) {
    hote = el;
    if (meals) repas = meals;
    if (obj) cibles = { p: obj.p || 0, g: obj.g || 0, l: obj.l || 0, c: obj.c || 0 };
    peindrePanneau();
  }

  function majDonnees(meals, obj) {
    if (meals) repas = meals;
    if (obj) cibles = { p: obj.p || 0, g: obj.g || 0, l: obj.l || 0, c: obj.c || 0 };
    peindrePanneau();
    if (plein && plein.classList.contains('on')) peindrePlein();
  }

  return {
    monter: monter,
    majDonnees: majDonnees,
    ouvrir: ouvrir,
    fermer: fermer,
    VUES: VUES
  };
})();
