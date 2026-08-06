/* ═══════════════════════════════════════════════════════════
   Natty — Génération de la semaine : l'attente, et sa mise en scène
   ───────────────────────────────────────────────────────────
   LE PROBLÈME. La génération demande ~56 s à l'IA (mesuré en prod le
   2026-08-04). Lancée depuis une page, elle mourait deux fois :
     • avec la page — changer d'onglet, verrouiller le téléphone, revenir en
       arrière, et tout était perdu sans le moindre message ;
     • à 60 s — délai par défaut d'URLSession, donc de la WebView iOS : la
       requête était coupée alors même que l'utilisateur regardait l'écran.
   D'où les deux symptômes : les conseils « tournaient dans le vide », et les
   repas répondaient « Échec — vérifiez votre connexion » avec une connexion
   parfaitement valide.

   LA RÉPONSE, en deux morceaux qui se tiennent :
   1. Le travail part sur le SERVEUR (`/api/generer-conseils`). Une fois l'appel
      émis, le résultat atterrit dans `profil_conseils` que l'app soit ouverte,
      fermée ou en arrière-plan. On ne dépend plus de la page — ni de sa survie,
      ni de son délai réseau.
   2. La page ne fait donc que REGARDER. Un drapeau en `localStorage` dit
      « une génération est en cours depuis telle heure » ; chaque écran qui
      charge ce module le lit et, s'il le trouve, réaffiche l'attente et reprend
      la surveillance là où elle en était. D'un écran à l'autre, l'attente
      paraît continue — parce que le travail, lui, l'est vraiment.

   ⚠️ COROLLAIRE À NE PAS OUBLIER : on n'attend PAS la réponse HTTP de
   l'endpoint, et on ne peut pas compter sur elle (la WebView l'aura souvent
   coupée avant). Tout ce qui doit revenir à l'utilisateur passe par la base.

   Ce module ne dépend que d'`assets/core.js` (session + sbFetch).
   ═══════════════════════════════════════════════════════════ */
window.NattyGeneration = (function () {
  var CLE = 'natty_generation_en_cours';
  var DUREE_MAX = 4 * 60 * 1000;   // au-delà, on considère que c'est perdu
  var ESTIME    = 62 * 1000;       // durée observée d'une génération complète
  var PERIODE   = 3000;            // relecture de la ligne toutes les 3 s
  var timer = null, elu = null, dernierePart = 0;

  /* ── Les phrases de l'attente ──────────────────────────────
     Elles ne sont pas décoratives : une attente d'une minute sans repère donne
     l'impression que rien ne se passe. Chacune nomme une étape réelle du
     travail en cours, dans l'ordre où elle a lieu. */
  var ETAPES = [
    { t: 0,  em: '👤', txt: 'Lecture de votre profil',     sous: 'Poids, objectif, dépense quotidienne' },
    { t: 7,  em: '🍽️', txt: 'Relecture de vos repas',      sous: 'Ce que vous avez mangé ces sept derniers jours' },
    { t: 16, em: '📊', txt: 'Analyse de vos apports',      sous: 'Protéines, glucides, lipides' },
    { t: 27, em: '✍️', txt: 'Rédaction de vos conseils',   sous: 'Six axes, adaptés à vous' },
    { t: 40, em: '👨‍🍳', txt: 'Composition de vos recettes', sous: 'Avec les étapes, minute par minute' },
    { t: 54, em: '🛒', txt: 'Liste de courses',            sous: 'Déduite de vos recettes' }
  ];

  /* ── Styles ────────────────────────────────────────────────
     Tout est préfixé `ngen`, et rien ne sort de `#ngen` : ce module s'invite
     sur six écrans qui ont chacun leur feuille de style. */
  function css() {
    if (document.getElementById('ngen-css')) return;
    var s = document.createElement('style');
    s.id = 'ngen-css';
    s.textContent = [
      /* Fond blanc plein : l'attente occupe tout l'écran, il n'y a rien d'autre
         à regarder, donc rien qui donne envie de partir. */
      '#ngen{position:fixed;inset:0;z-index:100000;background:var(--nt-bg,#fff);display:flex;',
      'flex-direction:column;align-items:center;justify-content:center;',
      'font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;opacity:0;',
      'transition:opacity .45s ease;',
      'padding-top:calc(32px + env(safe-area-inset-top,0px));',
      'padding-bottom:calc(32px + env(safe-area-inset-bottom,0px))}',
      '#ngen.on{opacity:1}',

      /* L'anneau : une seule forme, qui tourne lentement, avec l'emoji de
         l'étape en cours au centre. Signe de vie, sans agitation. */
      '#ngen .ring{width:104px;height:104px;position:relative;margin-bottom:32px}',
      '#ngen .ring svg{width:100%;height:100%;animation:ngenTurn 2.4s linear infinite}',
      '#ngen .ring circle{fill:none;stroke:var(--nt-ink,#1a1a2e);stroke-width:3;stroke-linecap:round;',
      'stroke-dasharray:64 220;opacity:.9}',
      '#ngen .ring .bg{stroke:var(--nt-line,#ececf0);stroke-dasharray:none;opacity:1}',
      '@keyframes ngenTurn{to{transform:rotate(360deg)}}',
      '#ngen .em{position:absolute;inset:0;display:flex;align-items:center;',
      'justify-content:center;font-size:34px;animation:ngenPulse 2.8s ease-in-out infinite;',
      'transition:opacity .35s ease,transform .35s ease}',
      '@keyframes ngenPulse{0%,100%{transform:scale(1);opacity:.92}50%{transform:scale(1.08);opacity:1}}',

      '#ngen .txt{font-size:20px;font-weight:800;color:var(--nt-ink,#1a1a2e);text-align:center;',
      'letter-spacing:-.3px;min-height:26px;transition:opacity .4s ease,transform .4s ease}',
      '#ngen .sub{font-size:13.5px;color:var(--nt-muted,#9a9aaa);text-align:center;margin-top:9px;',
      'min-height:34px;max-width:300px;line-height:1.5;transition:opacity .4s ease}',
      '#ngen .fade{opacity:0;transform:translateY(-6px)}',

      /* La barre. Elle avance sur le temps ÉCOULÉ, jamais en arrière, et ne
         franchit 100 % que quand la ligne est réellement en base : une barre
         qui atteint la fin sans que rien n'arrive est pire que pas de barre. */
      '#ngen .bar{width:100%;max-width:300px;height:6px;border-radius:99px;',
      'background:var(--nt-line,#ececf0);margin-top:30px;overflow:hidden}',
      '#ngen .fill{height:100%;width:0;border-radius:99px;background:var(--nt-ink,#1a1a2e);',
      'transition:width 1s cubic-bezier(.22,1,.36,1)}',
      '#ngen .pct{font-size:11.5px;font-weight:700;color:var(--nt-muted,#b5b5bd);margin-top:10px;',
      'letter-spacing:.3px}',

      /* Les points d'étape : où on en est, sans chiffre trompeur. */
      '#ngen .dots{display:flex;gap:7px;margin-top:16px}',
      '#ngen .dot{width:6px;height:6px;border-radius:50%;background:var(--nt-line,#e2e2e8);transition:all .5s ease}',
      '#ngen .dot.on{background:var(--nt-ink,#1a1a2e);transform:scale(1.35)}',

      /* Le mot qui compte le plus de tout l'écran. */
      '#ngen .libre{margin-top:34px;font-size:12.5px;color:var(--nt-muted,#b5b5bd);text-align:center;',
      'line-height:1.65;max-width:290px}',
      '#ngen .err{margin-top:22px;font-size:13px;color:#ff3b30;text-align:center;display:none;',
      'max-width:300px;line-height:1.5}',
      '#ngen .btns{margin-top:18px;display:flex;flex-direction:column;gap:10px;align-items:center}',
      '#ngen button{padding:13px 24px;border:none;border-radius:14px;font-family:inherit;',
      'font-size:14px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#ngen .fond{background:var(--nt-card,#f0f0f3);color:var(--nt-muted,#6a6a78)}',
      '#ngen .plein{background:var(--nt-ink,#1a1a2e);color:var(--nt-on-ink,#fff);display:none}',

      /* ── La question du garde-manger ────────────────────────────────
         Elle vient AVANT l'attente, et elle est le seul endroit où l'on
         renseigne ce qu'on a chez soi (le panneau de l'écran Repas s'en va).
         Même mise en scène que l'attente : plein écran, une question, deux
         réponses — parce que c'est une décision, pas un formulaire. */
      '#ngenQ{position:fixed;inset:0;z-index:100000;background:var(--nt-bg,#fff);display:flex;',
      'flex-direction:column;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;',
      'padding:26px 24px calc(24px + env(safe-area-inset-bottom,0px));opacity:0;',
      'padding-top:calc(30px + env(safe-area-inset-top,0px));transition:opacity .4s ease;',
      'overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '#ngenQ.on{opacity:1}',
      '#ngenQ .qem{font-size:52px;text-align:center;margin-bottom:16px;',
      'animation:ngenPulse 3s ease-in-out infinite}',
      '#ngenQ h2{font-size:25px;font-weight:900;color:var(--nt-ink,#1a1a2e);text-align:center;',
      'letter-spacing:-.6px;line-height:1.2}',
      '#ngenQ .qsub{font-size:13.5px;color:var(--nt-muted,#9a9aaa);text-align:center;margin-top:10px;',
      'line-height:1.55;max-width:320px;margin-left:auto;margin-right:auto}',
      '#ngenQ .qchips{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin:22px 0 4px}',
      '#ngenQ .qchip{display:inline-flex;align-items:center;gap:5px;background:var(--nt-card,#f2f2f7);',
      'border-radius:99px;padding:8px 13px;font-size:12.5px;font-weight:700;color:var(--nt-ink,#3a3a48)}',
      '#ngenQ .qchip b{font-weight:600;color:var(--nt-muted,#9a9aaa)}',
      '#ngenQ .qacts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:20px}',
      '#ngenQ .qact{background:var(--nt-card,#f7f7fa);border:none;border-radius:16px;padding:13px 2px 10px;',
      'font-family:inherit;font-size:10px;font-weight:700;color:var(--nt-ink,#3a3a48);cursor:pointer;',
      'display:flex;flex-direction:column;align-items:center;gap:6px;line-height:1.2}',
      '#ngenQ .qact .e{font-size:20px}',
      '#ngenQ .qsaisie{display:none;margin-top:12px}',
      '#ngenQ .qsaisie.on{display:block}',
      '#ngenQ textarea{width:100%;min-height:88px;border:1px solid var(--nt-line,#e2e2e8);border-radius:16px;',
      'padding:12px 14px;font-family:inherit;font-size:13.5px;color:var(--nt-ink,#1a1a2e);',
      'background:var(--nt-bg,#fff);resize:none;outline:none}',
      '#ngenQ .qetat{font-size:12px;color:var(--nt-muted,#9a9aaa);text-align:center;margin-top:12px;min-height:18px}',
      '#ngenQ .qbtns{margin-top:auto;padding-top:26px;display:flex;flex-direction:column;gap:10px}',
      '#ngenQ button.qgo{padding:17px;border:none;border-radius:16px;background:var(--nt-ink,#1a1a2e);color:var(--nt-on-ink,#fff);',
      'font-family:inherit;font-size:16px;font-weight:800;cursor:pointer}',
      '#ngenQ button.qno{padding:14px;border:none;border-radius:16px;background:var(--nt-card,#f0f0f3);color:var(--nt-muted,#6a6a78);',
      'font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}',

      /* Mode discret : l'utilisateur a demandé à continuer sans regarder. La
         pastille reste, sinon plus rien ne dirait que ça travaille — et il
         relancerait une génération par-dessus. */
      '#ngenPill{position:fixed;left:50%;transform:translateX(-50%);',
      'bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:99998;',
      'background:var(--nt-ink,#1a1a2e);color:var(--nt-on-ink,#fff);border:none;border-radius:99px;padding:11px 18px;',
      'font-family:Inter,-apple-system,sans-serif;font-size:12.5px;font-weight:700;',
      'box-shadow:0 8px 24px rgba(0,0,0,.22);cursor:pointer;opacity:0;',
      'transition:opacity .4s ease;-webkit-tap-highlight-color:transparent}',
      '#ngenPill.on{opacity:1}',
      '#ngenPill i{display:inline-block;width:7px;height:7px;border-radius:50%;',
      'background:currentColor;margin-right:8px;animation:ngenBlink 1.4s ease-in-out infinite}',
      '@keyframes ngenBlink{0%,100%{opacity:1}50%{opacity:.25}}'
    ].join('');
    document.head.appendChild(s);
  }

  function monter() {
    css();
    otterPill();
    var d = document.getElementById('ngen');
    if (d) return d;
    // Écran neuf, donc barre à zéro : `dernierePart` ne sert qu'à empêcher la
    // barre de RECULER. Sans cette remise à zéro, réouvrir l'attente depuis la
    // pastille laissait une barre bloquée à 0 % — la nouvelle barre partant de
    // zéro alors que le compteur, lui, se souvenait de 60 %.
    dernierePart = 0;
    d = document.createElement('div');
    d.id = 'ngen';
    d.innerHTML =
        '<div class="ring"><svg viewBox="0 0 100 100">'
      +   '<circle class="bg" cx="50" cy="50" r="45"/><circle cx="50" cy="50" r="45"/>'
      + '</svg><div class="em" id="ngenEm">🥗</div></div>'
      + '<div class="txt" id="ngenTxt">Préparation</div>'
      + '<div class="sub" id="ngenSub">Un instant</div>'
      + '<div class="bar"><div class="fill" id="ngenFill"></div></div>'
      + '<div class="pct" id="ngenPct">0 %</div>'
      + '<div class="dots" id="ngenDots"></div>'
      + '<div class="libre" id="ngenLibre">Une seule fois par semaine. Vous pouvez fermer'
      + ' l’application ou changer d’écran : la préparation continue sans vous, et vos'
      + ' conseils vous attendront en revenant.</div>'
      + '<div class="err" id="ngenErr"></div>'
      + '<div class="btns">'
      +   '<button class="fond" id="ngenFond">Continuer en arrière-plan</button>'
      +   '<button class="plein" id="ngenBtn">Fermer</button>'
      + '</div>';
    document.body.appendChild(d);
    var dots = d.querySelector('#ngenDots');
    for (var i = 0; i < ETAPES.length; i++) {
      var p = document.createElement('div'); p.className = 'dot'; dots.appendChild(p);
    }
    d.querySelector('#ngenBtn').addEventListener('click', function () { fermer(); });
    d.querySelector('#ngenFond').addEventListener('click', arrierePlan);
    // Même précaution que pour Natty.confirmer : rAF ne se déclenche pas quand
    // la page ne peint pas, et un écran d'attente invisible qui couvre tout est
    // pire qu'aucun écran d'attente.
    requestAnimationFrame(function () { d.classList.add('on'); });
    setTimeout(function () { d.classList.add('on'); }, 60);
    return d;
  }

  /* Le texte ET la barre suivent le temps écoulé DEPUIS LE DÉBUT RÉEL, pas
     depuis l'ouverture de l'écran : quelqu'un qui revient au bout de 40 s doit
     voir « composition de vos recettes », pas repartir de « lecture de votre
     profil ». C'est ce que porte `debut` dans le marqueur. */
  function peindre(depuisMs) {
    var s = Math.floor(depuisMs / 1000), i = 0;
    for (var k = 0; k < ETAPES.length; k++) if (s >= ETAPES[k].t) i = k;

    // La barre : progression jusqu'à 96 % seulement. Les 4 derniers pour cent
    // sont réservés à la preuve — la ligne lue en base.
    var part = Math.min(96, Math.round(depuisMs / ESTIME * 96));
    if (part > dernierePart) {           // jamais en arrière
      dernierePart = part;
      var f = document.getElementById('ngenFill'), p = document.getElementById('ngenPct');
      if (f) f.style.width = part + '%';
      if (p) p.textContent = part + ' %';
    }

    if (i === elu) return;
    elu = i;
    var t = document.getElementById('ngenTxt'), u = document.getElementById('ngenSub'),
        e = document.getElementById('ngenEm');
    if (!t) return;
    t.classList.add('fade'); u.classList.add('fade');
    if (e) e.style.opacity = '0';
    setTimeout(function () {
      t.textContent = ETAPES[i].txt; u.textContent = ETAPES[i].sous;
      if (e) { e.textContent = ETAPES[i].em; e.style.opacity = '1'; }
      t.classList.remove('fade'); u.classList.remove('fade');
    }, 350);
    var dots = document.querySelectorAll('#ngen .dot');
    for (var j = 0; j < dots.length; j++) dots[j].classList.toggle('on', j <= i);
  }

  function terminer(row) {
    var f = document.getElementById('ngenFill'), p = document.getElementById('ngenPct');
    if (f) f.style.width = '100%';
    if (p) p.textContent = '100 %';
    var t = document.getElementById('ngenTxt'), u = document.getElementById('ngenSub'),
        e = document.getElementById('ngenEm'), l = document.getElementById('ngenLibre'),
        b = document.getElementById('ngenFond');
    if (t) t.textContent = 'C’est prêt';
    if (u) u.textContent = 'Vos conseils, vos recettes et votre liste de courses vous attendent';
    if (e) e.textContent = '✨';
    if (l) l.style.display = 'none';
    if (b) b.style.display = 'none';
    var dots = document.querySelectorAll('#ngen .dot');
    for (var j = 0; j < dots.length; j++) dots[j].classList.add('on');
    document.dispatchEvent(new CustomEvent('natty:conseils-prets', { detail: row || null }));
    setTimeout(fermer, 1400);
  }

  function echec(msg) {
    arreter(); oterMarqueur(); otterPill();
    var e = document.getElementById('ngenErr'), b = document.getElementById('ngenBtn'),
        f = document.getElementById('ngenFond'), l = document.getElementById('ngenLibre');
    if (!e) return;   // l'écran d'attente n'était pas monté (mode discret)
    e.textContent = msg; e.style.display = 'block';
    if (b) b.style.display = 'block';
    if (f) f.style.display = 'none';
    if (l) l.style.display = 'none';
    var t = document.getElementById('ngenTxt'), u = document.getElementById('ngenSub'),
        em = document.getElementById('ngenEm');
    if (t) t.textContent = 'La préparation n’a pas abouti';
    if (u) u.textContent = '';
    if (em) em.textContent = '😕';
  }

  function fermer() {
    var d = document.getElementById('ngen');
    elu = null;
    if (!d) return;
    d.classList.remove('on');
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 460);
  }

  /* « Continuer en arrière-plan » — la demande explicite de Pablo : pouvoir
     quitter l'écran d'attente sans arrêter la génération. Le travail étant sur
     le serveur, il n'y a rien à interrompre ; on retire juste la mise en scène,
     on note le choix dans le marqueur (pour que l'écran suivant ne la
     réimpose pas), et on laisse une pastille qui dit que ça travaille. */
  function arrierePlan() {
    var m = marqueur();
    if (m) { m.discret = true; poserMarqueur(m); }
    fermer();
    pill();
    if (m) surveiller(m.debut, true);
  }

  function pill() {
    css();
    if (document.getElementById('ngenPill')) return;
    var b = document.createElement('button');
    b.id = 'ngenPill';
    b.innerHTML = '<i></i>Conseils en préparation…';
    b.addEventListener('click', function () {
      var m = marqueur();
      if (!m) { otterPill(); return; }
      m.discret = false; poserMarqueur(m);
      monter(); surveiller(m.debut);
    });
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('on'); });
    setTimeout(function () { b.classList.add('on'); }, 60);
  }

  function otterPill() {
    var b = document.getElementById('ngenPill');
    if (!b) return;
    b.classList.remove('on');
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 400);
  }

  function arreter() { if (timer) { clearInterval(timer); timer = null; } }

  function marqueur() {
    try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { return null; }
  }
  function poserMarqueur(m) {
    try { localStorage.setItem(CLE, JSON.stringify(m)); } catch (e) {}
  }
  function oterMarqueur() { try { localStorage.removeItem(CLE); } catch (e) {} }

  /* ── Y a-t-il quelque chose à afficher ? ───────────────────
     Une ligne peut exister et être VIDE — c'est l'état dans lequel la base se
     trouvait, et ce qui faisait dire à l'écran « conseils générés » alors qu'il
     n'y avait rien à montrer. Et une ligne peut être pleine mais PÉRIMÉE : la
     semaine compte, sinon on afficherait les recettes de la semaine dernière en
     croyant que la génération vient d'aboutir. */
  function lundi() {
    var d = new Date(), j = d.getDay();
    d.setDate(d.getDate() - j + (j === 0 ? -6 : 1));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  }

  function pleine(row) {
    if (!row) return false;
    var texte = !!(row.conseil_amelioration || row.conseil_prot);
    var recettes = false;
    if (row.conseils_json) {
      var j = row.conseils_json;
      if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { j = null; } }
      recettes = !!(j && j.recettes && j.recettes.length);
    }
    return texte || recettes;
  }

  function fraiche(row) { return pleine(row) && row && row.semaine === lundi(); }

  async function lireLigne() {
    try {
      var r = await Natty.sbFetch('profil_conseils?user_id=eq.' + Natty.USER_ID
        + '&order=generated_at.desc&limit=1'
        + '&select=conseil_prot,conseil_gluc,conseil_lip,conseil_cal,conseil_amelioration,'
        + 'conseil_points_forts,conseils_json,recettes_json,liste_courses_json,semaine,generated_at');
      return r && r[0];
    } catch (e) { return null; }
  }

  function surveiller(debut, discret) {
    arreter();
    if (!discret) peindre(Date.now() - debut);
    timer = setInterval(async function () {
      var ecoule = Date.now() - debut;
      if (!discret && document.getElementById('ngen')) peindre(ecoule);
      var row = await lireLigne();
      if (fraiche(row)) {
        arreter(); oterMarqueur(); otterPill();
        if (document.getElementById('ngen')) terminer(row);
        else document.dispatchEvent(new CustomEvent('natty:conseils-prets', { detail: row }));
        return;
      }
      if (ecoule > DUREE_MAX) {
        // L'endpoint a peut-être répondu une erreur qu'on n'a pas pu lire (la
        // WebView coupe à 60 s) : on ne peut donc que constater l'absence.
        echec('La préparation n’a pas abouti. Rien n’a été perdu — réessayez dans un moment.');
      }
    }, PERIODE);
  }

  /* ═══ La question du garde-manger ═══════════════════════════
     « Est-ce qu'on génère les plats en fonction du garde-manger ? » — et si
     oui, l'occasion de le remplir, puisque c'est maintenant le seul endroit
     où on le fait (le panneau de l'écran Repas laisse la place à « Ma
     semaine »).

     Elle ne s'affiche qu'AVANT une génération neuve : la reprise d'une
     attente en cours ne repose pas la question, et un rafraîchissement
     discret ne pose aucune question du tout — personne ne l'a demandé.

     @returns {Promise<string>} le garde-manger pour le prompt, ou '' si on
              génère sans lui. Jamais de rejet : refuser, c'est répondre. */
  function demanderGardeManger() {
    return new Promise(function (repondre) {
      // Module absent (écran qui ne le charge pas) : rien à demander.
      if (!window.NattyGardeManger) return repondre('');
      css();

      var d = document.createElement('div');
      d.id = 'ngenQ';
      document.body.appendChild(d);
      requestAnimationFrame(function () { d.classList.add('on'); });
      setTimeout(function () { d.classList.add('on'); }, 60);   // cf. Natty.confirmer

      var camIn = null, galIn = null, typeScan = 'courses';

      function fermerQ(reponse) {
        d.classList.remove('on');
        setTimeout(function () {
          if (d.parentNode) d.parentNode.removeChild(d);
          [camIn, galIn].forEach(function (i) { if (i && i.parentNode) i.parentNode.removeChild(i); });
        }, 380);
        repondre(reponse);
      }

      function etat(msg) {
        var e = d.querySelector('.qetat');
        if (e) e.textContent = msg || '';
      }

      function peindre() {
        var items = NattyGardeManger.liste();
        var n = items.length;
        d.innerHTML =
            '<div class="qem">' + (n ? '🧺' : '🛒') + '</div>'
          + '<h2>' + (n ? 'On part de ton garde-manger ?' : 'Qu’as-tu déjà chez toi ?') + '</h2>'
          + '<div class="qsub">' + (n
              ? 'Tes recettes de la semaine seront composées autour de ces ' + n
                + ' ingrédient' + (n > 1 ? 's' : '') + ', et la liste de courses ne portera que le reste.'
              : 'Scanne tes courses, ton ticket de caisse, ou saisis-les : les recettes partiront de ce que tu as, et la liste de courses sera d’autant plus courte.')
            + '</div>'
          + (n ? '<div class="qchips">' + items.slice(0, 24).map(function (it) {
                return '<span class="qchip">' + (it.em || '🥄') + ' ' + esc(it.nom)
                     + (it.qte ? ' <b>' + esc(it.qte) + '</b>' : '') + '</span>';
              }).join('') + (n > 24 ? '<span class="qchip">+ ' + (n - 24) + '</span>' : '') + '</div>' : '')
          + '<div class="qacts">'
          +   '<button class="qact" data-a="courses"><span class="e">🛒</span>Mes courses</button>'
          +   '<button class="qact" data-a="ticket"><span class="e">🧾</span>Ticket</button>'
          +   '<button class="qact" data-a="photo"><span class="e">🖼️</span>Une photo</button>'
          +   '<button class="qact" data-a="saisir"><span class="e">✏️</span>Saisir</button>'
          + '</div>'
          + '<div class="qsaisie" id="ngenQSaisie">'
          +   '<textarea id="ngenQTxt" placeholder="poulet 600 g, riz basmati 1 kg, 6 oeufs"></textarea>'
          +   '<button class="qno" id="ngenQAdd" style="margin-top:8px;width:100%">Ajouter à mon garde-manger</button>'
          + '</div>'
          + '<div class="qetat"></div>'
          + '<div class="qbtns">'
          +   '<button class="qgo">' + (n ? 'Oui, pars de ça' : 'Générer sans garde-manger') + '</button>'
          +   (n ? '<button class="qno">Non, surprends-moi</button>' : '')
          + '</div>';

        d.querySelector('.qgo').addEventListener('click', function () {
          fermerQ(n ? (NattyGardeManger.pourPrompt() || '') : '');
        });
        var no = d.querySelector('.qbtns .qno');
        if (no) no.addEventListener('click', function () { fermerQ(''); });

        d.querySelectorAll('.qact').forEach(function (b2) {
          b2.addEventListener('click', function () {
            var a2 = b2.getAttribute('data-a');
            if (a2 === 'saisir') {
              d.querySelector('#ngenQSaisie').classList.add('on');
              d.querySelector('#ngenQTxt').focus();
              return;
            }
            // ⚠️ `input.click()` doit rester SYNCHRONE dans le geste : iOS
            // refuse d'ouvrir la caméra depuis un appel différé.
            typeScan = (a2 === 'ticket') ? 'ticket' : (a2 === 'photo' ? 'auto' : 'courses');
            var inp = (a2 === 'photo') ? galIn : camIn;
            inp.value = '';
            inp.click();
          });
        });

        var add = d.querySelector('#ngenQAdd');
        if (add) add.addEventListener('click', async function () {
          var txt = d.querySelector('#ngenQTxt').value;
          var trouves = NattyGardeManger.depuisTexte(txt);
          if (!trouves.length) { etat('Rien à ajouter — sépare les aliments par une virgule.'); return; }
          await NattyGardeManger.ajouter(trouves);
          peindre();   // la liste a changé : la question aussi
          etat(trouves.length + (trouves.length > 1 ? ' ingrédients ajoutés' : ' ingrédient ajouté'));
        });
      }

      function champ(capture) {
        var i = document.createElement('input');
        i.type = 'file'; i.accept = 'image/*';
        if (capture) i.setAttribute('capture', 'environment');
        i.style.display = 'none';
        i.addEventListener('change', async function () {
          var f = this.files && this.files[0];
          if (!f) return;
          etat(typeScan === 'ticket' ? 'Lecture du ticket…' : 'Lecture de la photo…');
          try {
            var trouves = await NattyGardeManger.scanner(f, typeScan);
            if (!trouves.length) { etat('Aucun aliment reconnu. Reprends la photo, ou saisis-les.'); return; }
            await NattyGardeManger.ajouter(trouves);
            peindre();
            etat(trouves.length + (trouves.length > 1 ? ' ingrédients ajoutés' : ' ingrédient ajouté'));
          } catch (e) {
            etat('Lecture impossible. Réessaie, ou saisis les ingrédients.');
          }
        });
        document.body.appendChild(i);
        return i;
      }
      camIn = champ(true);
      galIn = champ(false);

      // La liste vit sur l'appareil (ou en base si la table existe) : on la
      // charge avant de peindre, sinon la question s'ouvre en disant « rien ».
      NattyGardeManger.charger().then(peindre, peindre);
    });
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── Lancer ────────────────────────────────────────────────
     @param {object} opts  {discret:true} = pas d'écran d'attente (rafraîchissement
                           silencieux d'une semaine périmée, par exemple).
                           {forcer:true} = régénérer MÊME si la semaine est déjà
                           faite (le seul cas légitime : « ↻ Renouveler », que
                           l'utilisateur a demandé explicitement).
     @returns {Promise<object|null>} la ligne prête, ou null si l'attente a
                           échoué / a été laissée en arrière-plan. Les écrans
                           peuvent donc `await` sans avoir à écouter l'événement.

     ⚠️ **Une semaine déjà générée ne se régénère pas.** C'est ici que ça se
     joue, et nulle part ailleurs : la fonction lançait le travail à l'aveugle,
     donc n'importe quel appelant — un bouton, l'ouverture d'un détail de macro,
     un écran qui trouve son cache vide pour une autre raison — rouvrait l'écran
     « Lecture de votre profil… » et repayait un appel à Claude pour un texte
     déjà en base. Le contrôle appartient au module, pas aux six écrans qui
     l'appellent : un garde par appelant, c'est un appelant qui l'oubliera. */
  async function lancer(opts) {
    opts = opts || {};
    var m = marqueur();
    var enCoursDeja = m && (Date.now() - m.debut) < DUREE_MAX;

    if (!enCoursDeja && !opts.forcer) {
      var deja = await dejaPrete();
      if (deja) {
        // Rien à attendre : on rend la ligne et on préviens les écrans, qui
        // repeignent comme si la génération venait d'aboutir — sans écran
        // d'attente, sans appel, sans une seconde de latence.
        document.dispatchEvent(new CustomEvent('natty:conseils-prets', { detail: deja }));
        return deja;
      }
    }

    if (!enCoursDeja) {
      /* La question du garde-manger, avant tout le reste — et seulement pour
         une génération neuve et demandée : un rafraîchissement discret ne
         doit rien demander à personne. Le garde-manger retenu est passé à
         `envoyer`, qui le transmet au serveur (il ne peut pas lire un
         localStorage). */
      var garde = '';
      if (!opts.discret && window.NattyGardeManger) garde = await demanderGardeManger();
      m = { debut: Date.now(), discret: !!opts.discret, semaine: lundi() };
      poserMarqueur(m);
      envoyer(m.semaine, garde);
    } else if (!opts.discret) {
      m.discret = false; poserMarqueur(m);   // on remonte l'attente à l'écran
    }

    dernierePart = 0;
    if (m.discret) { pill(); surveiller(m.debut, true); }
    else { monter(); surveiller(m.debut); }

    // Promesse de confort : elle se résout sur l'événement, qui est émis dans
    // TOUS les cas d'aboutissement — y compris quand la génération a été
    // terminée par un autre écran.
    return new Promise(function (ok) {
      var fini = false;
      function fin(e) {
        if (fini) return; fini = true;
        document.removeEventListener('natty:conseils-prets', fin);
        clearInterval(veille);
        ok(e && e.detail ? e.detail : null);
      }
      document.addEventListener('natty:conseils-prets', fin);
      // Le marqueur retiré sans événement = échec : on ne laisse pas l'appelant
      // attendre pour rien (repas.html rendrait son bouton inerte à vie).
      var veille = setInterval(function () {
        if (!marqueur()) fin(null);
      }, 1000);
    });
  }

  /* L'appel qui déclenche vraiment le travail. On n'attend PAS sa réponse :
     elle arrive une minute plus tard, la WebView l'aura peut-être coupée, et si
     la page a été quittée entre-temps ce `then` n'existe plus. C'est la
     surveillance qui fait foi — elle, elle repart toute seule au prochain écran. */
  async function envoyer(semaine, garde) {
    var corps = { semaine: semaine };
    // Choix explicite de l'utilisateur (voir demanderGardeManger) : il fait
    // foi, y compris quand il vaut '' — « non, surprends-moi » est une réponse.
    if (typeof garde === 'string') {
      corps.garde = garde;
    } else {
      /* Aucune réponse recueillie — c'est le cas du rafraîchissement discret,
         qui ne pose pas de question : on prend le garde-manger tel qu'il est.
         ⚠️ Ce repli NE DOIT PAS écraser un choix explicite : c'est ce qu'il
         faisait quand il tournait dans tous les cas, et « non, surprends-moi »
         repartait quand même avec la liste complète.
         Le garde-manger ne vit que sur l'appareil (la table `garde_manger`
         n'existe pas encore) : le serveur ne peut pas le lire. */
      try {
        if (window.NattyGardeManger) {
          await NattyGardeManger.charger();
          corps.garde = NattyGardeManger.pourPrompt() || '';
        }
      } catch (e) {}
    }

    var jeton = null;
    try { jeton = await Natty.jeton(); } catch (e) {}
    if (!jeton) { echec('Session expirée — reconnectez-vous, puis réessayez.'); return; }

    fetch(Natty.API + '/api/generer-conseils', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton },
      body: JSON.stringify(corps)
    }).then(function (r) {
      if (r.ok) return;
      // Erreur explicite du serveur : elle, on peut la dire précisément.
      return r.json().catch(function () { return {}; }).then(function (d) {
        echec(d.error || ('Le serveur a répondu ' + r.status + '.'));
      });
    }).catch(function () {
      /* Requête coupée (60 s de WebView) ou connexion perdue : le serveur, lui,
         continue. On ne déclare donc PAS l'échec ici — la surveillance tranche. */
    });
  }

  /** À appeler au chargement de chaque écran : reprend une attente en cours. */
  async function reprendre() {
    var m = marqueur();
    if (!m) return false;
    if ((Date.now() - m.debut) > DUREE_MAX) { oterMarqueur(); return false; }
    if (!window.Natty || !Natty.USER_ID) return false;
    // Terminé pendant qu'on changeait d'écran : inutile de remontrer l'attente.
    var row = await lireLigne();
    if (fraiche(row)) {
      oterMarqueur();
      document.dispatchEvent(new CustomEvent('natty:conseils-prets', { detail: row }));
      return false;
    }
    dernierePart = 0;
    if (m.discret) { pill(); surveiller(m.debut, true); }
    else { monter(); surveiller(m.debut); }
    return true;
  }

  function enCours() {
    var m = marqueur();
    return !!(m && (Date.now() - m.debut) < DUREE_MAX);
  }

  /** La semaine est-elle déjà générée ? (lecture seule, aucun appel IA) */
  async function dejaPrete() {
    var row = await lireLigne();
    return fraiche(row) ? row : null;
  }

  // Reprise automatique, sans que les pages aient à y penser.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(reprendre, 400); });
  } else {
    setTimeout(reprendre, 400);
  }

  return {
    lancer: lancer, reprendre: reprendre, enCours: enCours, fermer: fermer,
    pleine: pleine, fraiche: fraiche, dejaPrete: dejaPrete, lireLigne: lireLigne,
    lundi: lundi
  };
})();
