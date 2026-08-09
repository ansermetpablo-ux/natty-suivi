/* ═══════════════════════════════════════════════════════════
   Natty — Ma journée : le guide cinématique des étapes du jour
   ───────────────────────────────────────────────────────────
     NattyJournee.proposerSiNecessaire(delai)   le déclencheur des écrans
     NattyJournee.ouvrir({court:bool})          la séquence, à la demande
     NattyJournee.etapes()                      le déroulé calculé (lecture)

   CE QUE C'EST. Un plein écran noir qui s'invite à la PREMIÈRE ouverture de la
   journée, et ensuite à chaque MOMENT CLÉ (un repas qui commence, le palier du
   soir). Il montre la journée sous forme d'un arc de jalons — l'heure et
   l'étape — qui défile de droite à gauche : ce qui vient arrive par la droite,
   passe au sommet quand c'est le moment, et s'en va par la gauche une fois
   fait. On voit sa journée se dérouler, et on sait quoi faire MAINTENANT.

   POURQUOI UN MODULE ET PAS UNE PAGE. Même raison qu'`assets/planning.js` et
   `assets/ajout.js` : il se pose PAR-DESSUS l'écran courant, sans voler la
   navigation à quelqu'un qui venait faire autre chose, et il se ferme sans
   laisser d'historique. Une page « guide » obligerait en plus à revenir en
   arrière après chaque étape, alors que chaque étape mène ailleurs.

   ⚠️ CE MODULE N'INVENTE AUCUNE DONNÉE, et c'est ce qui le rend utilisable.
   • les créneaux, leurs heures et ce qu'il RESTE à manger  → `NattyCreneaux`
   • la semaine planifiée et le repas prévu aujourd'hui     → `NattyPlanning`
   • ce qui a déjà été ouvert aujourd'hui (défi, suivi)     → `NattyNav`
   Aucun état « étape faite » n'est stocké : un drapeau posé depuis un écran
   rate ce qui se passe ailleurs et dérive dès qu'un repas est supprimé — même
   leçon que `realises()` de planning.js. La question a déjà sa réponse.

   ⚠️ IL NE SE SUPERPOSE JAMAIS À UN AUTRE PLEIN ÉCRAN. La planification de la
   semaine passe avant (elle est le préalable : sans semaine planifiée, il n'y
   a pas de recette à préparer), la génération aussi, et l'ajout d'un plat
   également. Deux plein écran l'un sur l'autre ne se discutent pas.

   Dépend d'`assets/core.js`. Utilise `assets/creneaux.js`, `assets/planning.js`,
   `assets/ajout.js` et `assets/nav.js` s'ils sont chargés, et sait s'en passer.
   ═══════════════════════════════════════════════════════════ */
window.NattyJournee = (function () {
  'use strict';

  /* ═══ 1. Vocabulaire ═════════════════════════════════════ */

  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS  = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
               'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /* L'heure à laquelle on ANNONCE un créneau — pas sa borne d'ouverture.
     Le créneau du midi commence à 11 h pour ranger un repas, mais personne ne
     déjeune à 11 h : afficher « 11 h · Déjeuner » ferait passer le guide pour
     un réveil mal réglé. Les clés sont celles de `assets/creneaux.js`
     (matin / midi / collation / soir) — ne pas en inventer d'autres. */
  var HEURE_TYPE = { matin: 8, midi: 12.5, collation: 16.5, soir: 19.5 };

  /* Les deux jalons du soir. Ils viennent APRÈS le dernier repas : le palier
     du parcours est un moment d'apprentissage, le bilan ferme la journée. */
  var H_DEFI = 20.5, H_BILAN = 21.5;

  /* Combien de temps une étape passée reste « celle du moment ». Au-delà, on
     ne guide plus vers elle : proposer de noter son petit déjeuner à 15 h,
     c'est parler d'autre chose que de ce qui se passe. Elle reste visible dans
     l'arc, non cochée — un manque montré vaut mieux qu'un manque effacé. */
  var FENETRE_H = 2.5;

  var VISIBLES = 3;          // jalons montrés de part et d'autre du sommet

  /* ═══ 2. Petites fonctions ═══════════════════════════════ */

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hMaintenant(d) {
    d = d || new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  /** 12.5 → « 12 h 30 », 8 → « 8 h ». */
  function libHeure(h) {
    var e = Math.floor(h), m = Math.round((h - e) * 60);
    if (m === 60) { e++; m = 0; }
    e = ((e % 24) + 24) % 24;
    return e + ' h' + (m ? ' ' + String(m).padStart(2, '0') : '');
  }

  /* ⚠️ La majuscule est posée ICI, et pas par `text-transform:capitalize` :
     la règle CSS majuscule CHAQUE mot — elle affichait « Dimanche 9 Août ». */
  function dateLongue(d) {
    d = d || new Date();
    var s = JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()];
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function cle(quoi) {
    return 'natty_journee_' + quoi + '_' + ((window.Natty && Natty.USER_ID) || 'anon');
  }

  function jourCourant() { return (window.Natty && Natty.jour) ? Natty.jour() : ''; }

  /* Vu aujourd'hui : la version longue une fois par jour, la version courte
     une fois par étape. On relit `NattyNav` pour les onglets plutôt que de
     tenir un second compteur — deux mémoires de la même chose divergent. */
  function vuLong() {
    try { return localStorage.getItem(cle('vu')) === jourCourant(); } catch (e) { return false; }
  }
  function marquerLong() {
    try { localStorage.setItem(cle('vu'), jourCourant()); } catch (e) {}
  }
  function vuEtape(k) {
    try { return localStorage.getItem(cle('etape')) === jourCourant() + '|' + k; }
    catch (e) { return false; }
  }
  function marquerEtape(k) {
    try { localStorage.setItem(cle('etape'), jourCourant() + '|' + k); } catch (e) {}
  }

  function ongletVu(k) {
    // Sans nav.js chargé, on ne sait pas : on répond « oui » pour ne pas
    // pousser vers une étape qu'on ne peut pas vérifier. Même prudence que la
    // pastille rouge, qui ne s'affiche pas non plus quand elle n'est pas sûre.
    if (!window.NattyNav || !NattyNav.vuAujourdhui) return true;
    try { return !!NattyNav.vuAujourdhui(k); } catch (e) { return true; }
  }

  /* ═══ 3. Les illustrations ═══════════════════════════════
     Trait blanc, jamais d'emoji : la demande est un noir et blanc sérieux, et
     l'app parle déjà cette langue-là dans ses cinématiques (`.illu` de
     planning.js). Les emojis restent partout ailleurs — ils ne sont pas
     remplacés, ils ne sont simplement pas de ce registre. */
  var ICONES = {
    planifier: '<path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z"/><path d="M4 9.5h16M8.5 3v3M15.5 3v3"/>',
    matin:     '<path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0"/><path d="M12 4.5v2M4.9 7.4l1.4 1.4M19.1 7.4l-1.4 1.4"/>',
    midi:      '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.5"/>',
    collation: '<path d="M12 7.5c-3.5-3-8 0-7.2 5C5.4 16.7 9 20 12 20s6.6-3.3 7.2-7.5c.8-5-3.7-8-7.2-5Z"/><path d="M12 7.5V4.2M12 4.2c1.6 0 2.8-1 3-2.2"/>',
    soir:      '<path d="M3 18h18"/><path d="M5.5 18a6.5 6.5 0 0 1 13 0"/><path d="M12 8V5.5"/>',
    defi:      '<path d="M12 3c.9 2.7-1.8 3.6-1.8 6.3a2.7 2.7 0 0 0 5.4 0c1.4 1.4 1.8 3 1.8 4.5a5.4 5.4 0 1 1-10.8 0C6.6 10.2 8.4 7.5 12 3Z"/>',
    bilan:     '<circle cx="12" cy="12" r="8.2"/><path d="M12 12V6.6M12 12l4 2.6"/>',
    coche:     '<path d="M5.5 12.4 10 17l8.5-9.6"/>',
    plus:      '<path d="M12 7.5v9M7.5 12h9"/>'
  };

  function icone(nom, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24">' + (ICONES[nom] || ICONES.plus) + '</svg>';
  }

  /* ═══ 4. Le déroulé de la journée ════════════════════════
     Une liste d'étapes, dans l'ordre des heures. Chaque étape porte son heure,
     son nom, ce qu'elle propose de faire, et si elle est DÉJÀ faite — cette
     dernière information étant toujours relue, jamais mémorisée. */

  var etat = null;   // {prenom, etapes, cur, plan, court}

  async function prenom() {
    try {
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + Natty.USER_ID
        + '&select=prenom&order=created_at.desc&limit=5');
      var p = (r || []).map(function (x) { return (x.prenom || '').trim(); }).filter(Boolean)[0];
      if (p) return p;
    } catch (e) {}
    var c = Natty.profil && Natty.profil();
    var m = (c && c.user_metadata) || {};
    return m.prenom || m.first_name || '';
  }

  /** Le repas prévu aujourd'hui sur ce créneau, s'il y en a un au plan. */
  function prevuAujourdhui(plan, cleCreneau) {
    if (!plan || !plan.repas || !window.NattyPlanning) return null;
    var d = new Date(), ji = d.getDay(); ji = ji === 0 ? 6 : ji - 1;
    var cr = NattyPlanning.CRENEAUX || [];
    var trouve = null;
    plan.repas.forEach(function (r) {
      if (r.jour !== ji) return;
      var c = cr[r.creneau];
      // Rapprochement par CLÉ et non par indice : `planning.js` raisonne sur
      // trois créneaux fixes, `creneaux.js` sur deux à quatre selon la
      // personne. Un indice commun serait un faux ami.
      if (c && c.cle === cleCreneau) trouve = r;
    });
    return trouve;
  }

  async function construire() {
    var out = [], plan = null;

    // Les créneaux d'abord : ils portent les heures et les cibles.
    if (window.NattyCreneaux) {
      try { await NattyCreneaux.charger(); } catch (e) {}
    }
    if (window.NattyPlanning) {
      try { plan = await NattyPlanning.lire(); } catch (e) {}
    }

    /* Étape 0 — planifier la semaine, seulement si elle ne l'est pas.
       Elle est en tête parce qu'elle conditionne tout le reste : sans plan, il
       n'y a ni recette à préparer, ni repas placé à retrouver.

       ⚠️ ET SEULEMENT SI ON PEUT LE SAVOIR. Sans `assets/planning.js` chargé,
       `plan` vaut null parce qu'on n'a pas regardé — pas parce que la semaine
       n'est pas planifiée. Proposer de planifier une semaine qui l'est déjà
       serait pire que de ne rien proposer. */
    if (!plan && window.NattyPlanning) {
      out.push({
        cle: 'planifier', nom: 'Planifier ma semaine', icone: 'planifier',
        // ⚠️ Pas d'heure affichée, et c'est voulu : elle n'en a pas. Placée à
        // 8 h comme le petit déjeuner, elle donnait DEUX jalons marqués « 8 h »
        // côte à côte dans l'arc, ce qui se lit comme un doublon. `h` ne sert
        // plus qu'à la ranger en tête ; c'est `libelle` qu'on lit.
        h: Math.min(hMaintenant(), 7.5) - 0.5, libelle: 'D’abord', fait: false,
        detail: 'Cinq repas placés là où vos macros en ont le plus besoin.',
        cta: 'Planifier maintenant',
        action: function () {
          fermer();
          if (window.NattyPlanning) NattyPlanning.ouvrir();
          else Natty.goto('repas.html');
        }
      });
    }

    /* Les repas. Un créneau = un jalon, et son action dépend de ce qui existe :
       une recette prévue se prépare, sinon on note ce qu'on a mangé. */
    var creneaux = (window.NattyCreneaux && NattyCreneaux.liste()) || [];
    creneaux.forEach(function (c) {
      var deja = (window.NattyCreneaux && NattyCreneaux.nbDeja(c.cle)) || 0;
      var reste = (window.NattyCreneaux && NattyCreneaux.restant(c.cle)) || null;
      var prevu = prevuAujourdhui(plan, c.cle);
      var e = {
        cle: 'repas-' + c.cle, nom: c.nom, icone: ICONES[c.cle] ? c.cle : 'midi',
        h: HEURE_TYPE[c.cle] != null ? HEURE_TYPE[c.cle] : (c.h0 + (c.h1 - c.h0) / 3),
        fait: deja > 0,
        prevu: prevu,
        detail: '',
        cta: 'Ajouter mon plat',
        action: function () {
          fermer();
          // ⚠️ Appel SYNCHRONE depuis le clic : `assets/ajout.js` ouvre la
          // caméra tout de suite, et iOS refuse de l'ouvrir si le geste de
          // l'utilisateur n'est plus dans la pile d'appels.
          if (window.NattyAjout && NattyAjout.start) NattyAjout.start();
          else Natty.goto('suivi.html');
        }
      };

      /* ⚠️ La phrase ne redit JAMAIS les chiffres des pastilles. La première
         version annonçait « il vous reste 1120 kcal et 66 g de protéines »
         juste au-dessus de trois pastilles portant 1120, 66 et 140 : on lisait
         deux fois la même chose, et la phrase — qui est le seul endroit où
         l'app peut expliquer quelque chose — ne servait plus à rien. */
      if (deja > 0) {
        e.detail = deja > 1
          ? deja + ' plats sont déjà notés sur ce repas. Vous pouvez en ajouter un autre.'
          : 'Votre plat est noté. Vous pouvez en ajouter un autre si vous reprenez.';
      } else if (prevu) {
        e.detail = 'Ce repas était prévu à ce créneau lors de votre planification.';
      } else {
        e.detail = 'Notez ce que vous mangez : c’est ce qui fait bouger vos anneaux.';
      }

      // Une recette prévue prend la main sur « ajouter » : on n'a pas encore
      // mangé, l'action utile est de la préparer. « Ajouter » reste offert en
      // second — on peut très bien avoir mangé autre chose.
      if (prevu && deja === 0) {
        e.nom = c.nom;
        e.titre2 = prevu.nom;
        e.cta = 'Suivre la recette';
        e.cta2 = 'J’ai mangé autre chose';
        e.action = function () { marquerEtape(e.cle); fermer(); Natty.goto('repas.html'); };
        e.action2 = function () {
          fermer();
          if (window.NattyAjout && NattyAjout.start) NattyAjout.start();
          else Natty.goto('suivi.html');
        };
      }
      out.push(e);
    });

    /* Le palier du parcours, puis le bilan. Dans cet ordre : on apprend
       quelque chose, puis on regarde sa journée — l'inverse ferait du bilan
       une étape de passage avant un jeu. */
    out.push({
      cle: 'defi', nom: 'Le palier du jour', icone: 'defi', h: H_DEFI,
      fait: ongletVu('defis'),
      detail: 'Quelques minutes pour comprendre ce que vous mangez.',
      cta: 'Ouvrir le parcours',
      action: function () { marquerEtape('defi'); fermer(); Natty.goto('narration.html'); }
    });

    out.push({
      cle: 'bilan', nom: 'Le point du soir', icone: 'bilan', h: H_BILAN,
      fait: ongletVu('suivi'),
      detail: 'Vos anneaux, vos macros, et ce que la journée a donné.',
      cta: 'Voir mon suivi',
      action: function () { marquerEtape('bilan'); fermer(); Natty.goto('suivi.html'); }
    });

    out.sort(function (a, b) { return a.h - b.h; });
    return { etapes: out, plan: plan };
  }

  /**
   * L'étape du moment : la première non faite dont l'heure n'est pas trop
   * loin derrière. Si tout ce qui est passé est fait, c'est la prochaine ;
   * si tout est fait, c'est la dernière — et la journée est bouclée.
   */
  function courante(etapes) {
    var h = hMaintenant(), i;
    for (i = 0; i < etapes.length; i++) {
      if (!etapes[i].fait && etapes[i].h >= h - FENETRE_H) return i;
    }
    for (i = etapes.length - 1; i >= 0; i--) if (!etapes[i].fait) return i;
    return etapes.length - 1;
  }

  function toutFait(etapes) {
    return etapes.every(function (e) { return e.fait; });
  }

  /* ═══ 5. La feuille de style ═════════════════════════════ */

  function css() {
    if (document.getElementById('njour-css')) return;
    var s = document.createElement('style');
    s.id = 'njour-css';
    s.textContent = [
      /* Noir, comme toutes les cinématiques de l'app (planification, ajout).
         Le dégradé de la maquette n'est pas supprimé : il devient une LUEUR
         blanche derrière l'arc — la même composition, traduite en noir et
         blanc, où c'est la lumière qui remplace la couleur. */
      '#njour{position:fixed;inset:0;z-index:99988;background:#000;color:#fff;',
      'font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;opacity:0;',
      'transition:opacity .5s ease;overflow:hidden;-webkit-font-smoothing:antialiased}',
      '#njour.on{opacity:1}',
      '#njour *{box-sizing:border-box}',
      '#njour button{font-family:inherit;cursor:pointer;border:none;',
      '-webkit-tap-highlight-color:transparent;transition:transform .16s ease}',
      '#njour button:active{transform:scale(.975)}',

      /* ── Le fond ────────────────────────────────────────────
         Trois couches : une lueur haute qui tient l'arc, un halo bas plus
         large qui décolle le texte du noir, et un voile qui referme le bas
         pour que la barre d'action reste lisible. Rien ne bouge vite : c'est
         une atmosphère, pas une animation. */
      '#njour .fade{position:absolute;inset:0;pointer-events:none}',
      '#njour .fade i{position:absolute;display:block;border-radius:50%}',
      '#njour .f1{left:50%;top:-22%;width:150%;height:76%;transform:translateX(-50%);',
      'background:radial-gradient(50% 50% at 50% 52%,rgba(255,255,255,.30) 0%,',
      'rgba(255,255,255,.13) 34%,rgba(255,255,255,.035) 56%,rgba(255,255,255,0) 74%);',
      'animation:njSouffle 9s ease-in-out infinite}',
      '#njour .f2{left:50%;top:20%;width:200%;height:74%;transform:translateX(-50%);',
      'background:radial-gradient(50% 50% at 50% 50%,rgba(222,225,236,.16) 0%,',
      'rgba(222,225,236,.05) 44%,rgba(255,255,255,0) 72%);',
      'animation:njSouffle 12s ease-in-out infinite reverse}',
      '#njour .f3{position:absolute;left:0;right:0;bottom:0;height:46%;border-radius:0;',
      'background:linear-gradient(to top,#000 34%,rgba(0,0,0,0))}',
      '@keyframes njSouffle{0%,100%{opacity:.85;transform:translateX(-50%) scale(1)}',
      '50%{opacity:1;transform:translateX(-50%) scale(1.06)}}',

      /* ── La colonne ─────────────────────────────────────────
         Même gabarit que le reste de l'app (480 px), et la place de la barre
         d'action réservée en bas : un contenu qui passe dessous se lit mal
         et se tape encore plus mal. */
      '#njour .col{position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;padding:calc(20px + env(safe-area-inset-top,0px)) 22px ',
      'calc(146px + env(safe-area-inset-bottom,0px));overflow-y:auto;',
      '-webkit-overflow-scrolling:touch;text-align:center}',

      /* ── L'en-tête ──────────────────────────────────────────*/
      '#njour .tete{width:100%;max-width:420px;flex-shrink:0}',
      '#njour .tete .t{font-size:19px;font-weight:800;letter-spacing:-.4px}',
      '#njour .tete .d{font-size:12px;color:#7c7c86;margin-top:5px}',

      /* ── L'arc ──────────────────────────────────────────────
         Les jalons sont des éléments HTML posés sur le cercle, pas des formes
         SVG : c'est la seule façon d'avoir un vrai neumorphisme (reliefs et
         creux) et un texte net sous chacun. Le trait du cercle, lui, reste en
         SVG derrière. */
      '#njour .arc{position:relative;width:360px;height:224px;flex-shrink:0;',
      'margin:10px 0 0}',
      /* ⚠️ LE TRAIT DE L'ORBITE DOIT S'ÉTEINDRE, PAS ÊTRE COUPÉ. Le cercle qui
         porte les jalons a un rayon de 230 px : ses extrémités descendent bien
         en dessous du cadre de l'arc et venaient barrer le grand titre (mesuré
         à 375 px — la courbe traversait « Petit déjeuner »). Un `overflow:hidden`
         l'aurait tranché net, ce qui se voit encore plus. Le masque le fait
         disparaître en s'éloignant du sommet ; là où il n'est pas géré, on
         retrouve simplement le trait entier, ce qui reste lisible. */
      '#njour .arc svg.orbite{position:absolute;inset:0;width:100%;height:100%;',
      'overflow:visible;fill:none;stroke-linecap:round;',
      '-webkit-mask-image:radial-gradient(62% 78% at 41% 48%,#000 38%,rgba(0,0,0,.35) 72%,transparent 100%);',
      'mask-image:radial-gradient(62% 78% at 41% 48%,#000 38%,rgba(0,0,0,.35) 72%,transparent 100%)}',
      '#njour .arc svg.orbite path{stroke:rgba(255,255,255,.13);stroke-width:1;',
      'stroke-dasharray:900;stroke-dashoffset:900;animation:njTrace 1.6s cubic-bezier(.22,1,.36,1) forwards}',
      '#njour .arc svg.orbite path.b{stroke:rgba(255,255,255,.055);animation-delay:.16s}',
      '@keyframes njTrace{to{stroke-dashoffset:0}}',

      '#njour .jal{position:absolute;border-radius:50%;display:flex;align-items:center;',
      'justify-content:center;transform:translate(-50%,-50%);',
      'transition:left .95s cubic-bezier(.22,1,.36,1),top .95s cubic-bezier(.22,1,.36,1),',
      'width .95s cubic-bezier(.22,1,.36,1),height .95s cubic-bezier(.22,1,.36,1),',
      'opacity .7s ease,background .5s ease,box-shadow .7s ease}',
      '#njour .jal svg{width:46%;height:46%;fill:none;stroke:currentColor;stroke-width:1.9;',
      'stroke-linecap:round;stroke-linejoin:round}',

      /* À venir — le creux neumorphique et le « + » de la maquette : une
         place réservée, pas encore un événement. */
      '#njour .jal.futur{background:#0a0a0c;color:rgba(255,255,255,.5);',
      'box-shadow:inset 1.5px 1.5px 4px rgba(0,0,0,.9),',
      'inset -1px -1px 3px rgba(255,255,255,.055),0 0 0 1px rgba(255,255,255,.07)}',
      /* Fait — relief plein, mais discret : c'est derrière soi. */
      '#njour .jal.passe{background:#17181c;color:rgba(255,255,255,.62);',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 3px 10px rgba(0,0,0,.7)}',
      /* Manqué — ni creux ni relief : un contour interrompu. Le montrer sans
         le cocher est plus honnête que de l'effacer. */
      '#njour .jal.manque{background:#0a0a0c;color:rgba(255,255,255,.32);',
      'box-shadow:0 0 0 1px rgba(255,255,255,.14)}',
      /* Maintenant — la pastille blanche de la maquette, sa lueur comprise. */
      '#njour .jal.actif{background:#fff;color:#0a0a0c;',
      'box-shadow:0 0 44px rgba(255,255,255,.42),0 0 0 1px rgba(255,255,255,.9),',
      'inset 0 -2px 4px rgba(140,142,152,.34),inset 0 2px 3px rgba(255,255,255,.9)}',
      '#njour .jal.actif::after{content:"";position:absolute;inset:-14px;border-radius:50%;',
      'border:1px solid rgba(255,255,255,.16);animation:njPulse 3.4s ease-in-out infinite}',
      '@keyframes njPulse{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.13);opacity:0}}',

      '#njour .jal .h{position:absolute;top:calc(100% + 7px);left:50%;transform:translateX(-50%);',
      'font-size:9.5px;font-weight:700;letter-spacing:.4px;white-space:nowrap;',
      'color:rgba(255,255,255,.42)}',
      '#njour .jal.actif .h{font-size:10.5px;color:#fff;top:calc(100% + 10px)}',

      /* ── Le bloc central ────────────────────────────────────
         Il prend la place qui reste sous l'arc et se centre dedans. Sans ça,
         une scène courte (le bonjour, le déroulé) laissait un tiers d'écran
         vide sous le texte, et l'écran avait l'air de ne pas avoir fini de
         charger. Une scène longue (avec le récapitulatif) déborde et défile,
         ce qui est le comportement attendu.

         ⚠️ Le bloc SORTANT passe en `position:absolute` le temps de croiser
         l'entrant. Sans ça, les deux se suivent dans le flux pendant 360 ms et
         la page fait un bond de la hauteur du bloc — le même piège que la
         carte du jour de `assets/planning.js`. */
      '#njour .zone{flex:1 0 auto;width:100%;max-width:420px;margin-top:6px;',
      'position:relative;display:flex;flex-direction:column;justify-content:center}',
      '#njour .bloc{width:100%}',
      '#njour .bloc.sort{position:absolute;left:0;right:0;top:0;bottom:0;',
      'display:flex;flex-direction:column;justify-content:center;pointer-events:none}',
      '#njour .kick{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;',
      'color:#8b8b95}',
      '#njour h1{font-size:44px;font-weight:900;letter-spacing:-1.8px;line-height:1.04;',
      'margin:10px 0 0}',
      '#njour h1 span{display:inline-block;opacity:0;',
      'animation:njGlide .68s cubic-bezier(.22,1,.36,1) forwards}',
      '#njour h1.p{font-size:34px;letter-spacing:-1.2px}',
      '#njour .sk{font-size:10.5px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase;',
      'color:#6e6e78;margin-top:12px}',
      '#njour .quoi{font-size:17px;font-weight:800;letter-spacing:-.3px;margin-top:14px;',
      'color:#f2f2f5;line-height:1.3}',
      '#njour .sous{font-size:14px;color:#8b8b95;line-height:1.55;margin-top:12px;',
      'max-width:330px;margin-left:auto;margin-right:auto}',

      /* La rangée de vignettes de la maquette : ici, les macros qu'il reste —
         la seule chose qu'on ait vraiment envie de lire avant de manger. */
      '#njour .chips{display:flex;justify-content:center;gap:7px;margin-top:16px}',
      '#njour .chips div{display:flex;align-items:center;gap:5px;padding:8px 13px;',
      'border-radius:999px;background:#0b0b0e;font-size:11.5px;font-weight:700;color:#c9c9d2;',
      'box-shadow:inset 1.5px 1.5px 4px rgba(0,0,0,.9),inset -1px -1px 3px rgba(255,255,255,.05),',
      '0 0 0 1px rgba(255,255,255,.05)}',
      '#njour .chips b{color:#fff;font-weight:800}',
      '#njour .filet{width:180px;height:1px;background:rgba(255,255,255,.12);',
      'margin:18px auto 0}',
      '#njour .mot{font-size:13px;color:#9a9aa4;margin-top:16px;font-weight:600}',

      /* ── Le récapitulatif de la version longue ──────────────
         La journée écrite, sous l'arc : l'arc donne le rythme, la liste donne
         les faits. L'un sans l'autre laisse une impression sans information. */
      '#njour .liste{width:100%;max-width:420px;margin-top:22px;display:flex;',
      'flex-direction:column;gap:7px}',
      '#njour .li{display:flex;align-items:center;gap:13px;padding:12px 14px;border-radius:18px;',
      'background:#08090b;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);text-align:left;',
      'opacity:0;animation:njGlide .6s cubic-bezier(.22,1,.36,1) forwards}',
      '#njour .li .p{width:34px;height:34px;border-radius:50%;flex-shrink:0;display:flex;',
      'align-items:center;justify-content:center;background:#101115;color:rgba(255,255,255,.6);',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}',
      '#njour .li .p svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;',
      'stroke-linecap:round;stroke-linejoin:round}',
      '#njour .li.ok .p{background:#f2f2f5;color:#0a0a0c;box-shadow:0 3px 10px rgba(255,255,255,.14)}',
      '#njour .li.now{box-shadow:inset 0 0 0 1px rgba(255,255,255,.28)}',
      '#njour .li .n{font-size:13.5px;font-weight:700;line-height:1.3}',
      '#njour .li .q{font-size:10.5px;color:#7c7c86;margin-top:3px}',
      '#njour .li .hh{margin-left:auto;font-size:10.5px;font-weight:800;color:#5c5c66;',
      'letter-spacing:.3px;flex-shrink:0}',
      '#njour .li.now .hh{color:#fff}',

      /* ── Entrées ────────────────────────────────────────────
         Jamais de flou sur du texte : la règle vient de `narration.html` et
         vaut pour toutes les cinématiques de l'app. */
      '@keyframes njGlide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
      '@keyframes njPara{from{opacity:0;transform:translateY(10px) scale(.975)}to{opacity:1;transform:none}}',
      '#njour [data-in]{opacity:0;animation-duration:.72s;',
      'animation-timing-function:cubic-bezier(.22,1,.36,1);animation-fill-mode:forwards}',
      '#njour [data-in="glide"]{animation-name:njGlide}',
      '#njour [data-in="para"]{animation-name:njPara}',
      '#njour .bloc.sort{animation:njSort .34s cubic-bezier(.4,0,1,1) forwards}',
      '@keyframes njSort{to{opacity:0;transform:translateY(-12px)}}',

      /* ── La barre d'action ──────────────────────────────────
         Fixe, hors du bloc animé. Leçon de `narration.html` : un bouton posé
         dans la scène part avec son animation de sortie et disparaît sous le
         doigt. */
      '#njCta{position:absolute;left:0;right:0;bottom:0;z-index:6;',
      'padding:14px 22px calc(20px + env(safe-area-inset-bottom,0px));display:flex;',
      'flex-direction:column;gap:9px;align-items:stretch;pointer-events:none;',
      'background:linear-gradient(to top,#000 60%,rgba(0,0,0,0))}',
      '#njCta > *{pointer-events:auto;max-width:436px;width:100%;margin:0 auto;',
      'animation:njGlide .42s cubic-bezier(.22,1,.36,1) .26s backwards}',
      '#njour .b1{background:#f2f2f5;color:#101014;border-radius:22px;padding:18px;',
      'font-size:16.5px;font-weight:800;letter-spacing:-.2px;',
      'box-shadow:0 10px 30px rgba(255,255,255,.10)}',
      '#njour .b2{background:#17181c;color:#e9e9ee;border-radius:22px;padding:15px;',
      'font-size:14.5px;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.09),',
      '0 8px 22px rgba(0,0,0,.6)}',
      '#njour .b3{background:none;color:#7c7c86;padding:12px;font-size:14px;font-weight:600}',

      /* Le bouton de fermeture. Une cinématique qui s'invite doit pouvoir se
         refuser d'un geste, sans lire les boutons du bas. */
      '#njFerme{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:16px;',
      'z-index:8;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.07);',
      'color:#c9c9d2;font-size:17px;line-height:1;display:flex;align-items:center;',
      'justify-content:center;padding-bottom:2px}',

      /* Petit écran : l'arc rétrécit plutôt que de pousser le titre hors vue.
         ⚠️ `transform` ne change PAS la place réservée dans le flux : sans la
         marge négative qui l'accompagne, l'arc continue d'occuper ses 224 px
         alors qu'il n'en montre que 206, et ce sont ces 18 px qui poussaient la
         dernière ligne du texte sous le bouton (mesuré à 375 × 812, barre à
         trois boutons). La marge rend exactement ce que l'échelle a libéré. */
      '@media (max-height:700px){#njour .arc{transform:scale(.86);margin:4px 0 -32px}',
      '#njour h1{font-size:38px}}',
      '@media (max-width:380px){#njour .arc{transform:scale(.92);margin-bottom:-18px}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══ 6. Le montage ══════════════════════════════════════ */

  var racine = null, cta = null, blocEnCours = null, minuteur = null,
      arcEl = null, ouvert = false, scrollGele = null;

  function monter() {
    css();
    if (racine) return racine;
    racine = document.createElement('div');
    racine.id = 'njour';
    racine.innerHTML =
      '<div class="fade"><i class="f1"></i><i class="f2"></i><span class="f3"></span></div>'
      + '<button id="njFerme" type="button" aria-label="Fermer">✕</button>'
      + '<div class="col" id="njCol"></div>'
      + '<div id="njCta"></div>';
    document.body.appendChild(racine);
    cta = racine.querySelector('#njCta');
    racine.querySelector('#njFerme').addEventListener('click', function () {
      marquerLong();
      fermer();
    });
    scrollGele = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // La rAF seule ne se déclenche pas si la page ne peint pas (onglet caché,
    // app en arrière-plan) : sans le minuteur, un calque noir opaque à 0
    // resterait en travers de l'écran tout en interceptant les taps. Même
    // précaution que `Natty.confirmer` et `assets/generation.js`.
    requestAnimationFrame(function () { if (racine) racine.classList.add('on'); });
    setTimeout(function () { if (racine) racine.classList.add('on'); }, 60);
    return racine;
  }

  function fermer() {
    ouvert = false;
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    if (!racine) return;
    var r = racine;
    racine = null; cta = null; blocEnCours = null; arcEl = null;
    r.classList.remove('on');
    document.body.style.overflow = scrollGele || '';
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 520);
  }

  /* Un titre qui s'écrit mot à mot — c'est ce qui sépare « du texte qui
     apparaît » d'une cinématique. Les mots préfixés `~` restent gris. */
  function titre(txt, cls, delai) {
    delai = delai == null ? 0 : delai;
    var mots = String(txt).split(' ').map(function (m, i) {
      return '<span style="animation-delay:' + (delai + i * 0.085).toFixed(3) + 's">'
        + esc(m) + '</span>';
    }).join(' ');
    return '<h1' + (cls ? ' class="' + cls + '"' : '') + '>' + mots + '</h1>';
  }

  /* ═══ 7. L'arc ═══════════════════════════════════════════
     Géométrie : un cercle dont le sommet tombe dans le cadre, les jalons
     répartis tous les 22°. Le jalon courant est posé un peu à GAUCHE du
     sommet (−98°), comme dans la maquette : ce qui vient arrive par la
     droite, passe au sommet quand c'est son heure, et sort par la gauche.
     C'est le mouvement de la journée, et il n'a pas besoin d'être expliqué. */

  /* ⚠️ LE PAS ET LE NOMBRE DE JALONS SE RÈGLENT ENSEMBLE. À 22° et quatre
     jalons de chaque côté, l'arc balayait ±88° : le trait de l'orbite
     redescendait le long des deux bords jusque DERRIÈRE le titre, et les
     jalons extrêmes sortaient du cadre par le bas. Mesuré à 375 px. À 17° et
     trois jalons, tout tient dans la bande haute, et ce qui part à gauche sort
     par le coin — ce qui est justement le mouvement recherché. */
  var CX = 180, CY = 352, R = 230, PAS = 17, SOMMET = -98;

  function pos(delta) {
    var a = (SOMMET + delta * PAS) * Math.PI / 180;
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
  }

  function cheminOrbite(r) {
    var p0 = null, d = '';
    for (var t = -154; t <= -42; t += 4) {
      var a = t * Math.PI / 180;
      var x = CX + r * Math.cos(a), y = CY + r * Math.sin(a);
      d += (p0 ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      p0 = 1;
    }
    return d;
  }

  function monterArc(hote) {
    var h = '<div class="arc" id="njArc"><svg class="orbite" viewBox="0 0 360 224" preserveAspectRatio="none">'
      + '<path d="' + cheminOrbite(R) + '"/>'
      + '<path class="b" d="' + cheminOrbite(R - 17) + '"/></svg>';
    etat.etapes.forEach(function (e, i) {
      h += '<div class="jal" data-i="' + i + '"><span class="ic"></span>'
        + '<span class="h">' + esc(e.libelle || libHeure(e.h)) + '</span></div>';
    });
    h += '</div>';
    hote.insertAdjacentHTML('beforeend', h);
    arcEl = hote.querySelector('#njArc');
  }

  /**
   * Repositionne les jalons autour de l'indice `cur`.
   * Les transitions CSS font le reste : appeler cette fonction deux fois, une
   * au début de la journée puis une sur l'étape du moment, DONNE l'animation
   * de défilement — c'est le seul endroit où la journée « se déroule ».
   */
  function peindreArc(cur) {
    if (!arcEl) return;
    var h = hMaintenant();
    arcEl.querySelectorAll('.jal').forEach(function (el) {
      var i = +el.getAttribute('data-i'), e = etat.etapes[i], d = i - cur;
      if (Math.abs(d) > VISIBLES) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
      var p = pos(d), ad = Math.min(Math.abs(d), VISIBLES);
      var taille = [58, 40, 32, 25][ad];
      var opac = [1, .6, .4, .22][ad];

      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.style.width = taille + 'px';
      el.style.height = taille + 'px';
      el.style.opacity = Math.abs(d) > VISIBLES ? 0 : opac;

      var cls = 'jal';
      if (i === cur) cls += ' actif';
      else if (e.fait) cls += ' passe';
      else if (e.h < h - FENETRE_H) cls += ' manque';
      else cls += ' futur';
      el.className = cls;

      // Le contenu suit le rôle : le « + » d'une place réservée, la coche de
      // ce qui est fait, l'icône de l'étape quand c'est son moment.
      var ic = el.querySelector('.ic');
      ic.innerHTML = (i === cur) ? icone(e.icone)
        : (e.fait ? icone('coche') : icone('plus'));
      // L'heure ne s'affiche que sur les jalons proches : au-delà, elle se
      // superpose à sa voisine et on ne lit plus ni l'une ni l'autre.
      var hh = el.querySelector('.h');
      if (hh) hh.style.display = ad <= 2 ? '' : 'none';
    });
  }

  /* ═══ 8. Les scènes ══════════════════════════════════════
     Contrairement à `planning.js`, l'arc N'EST PAS remplacé d'une scène à
     l'autre : il est le fil de la séquence, et le voir disparaître puis
     revenir casserait justement la continuité qu'on cherche. Seul le bloc de
     texte sous lui est échangé. */

  function bloc(o) {
    var zone = racine.querySelector('#njZone');
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }

    var vieux = blocEnCours;
    if (vieux) {
      vieux.classList.add('sort');
      setTimeout(function () { if (vieux.parentNode) vieux.parentNode.removeChild(vieux); }, 360);
    }

    var d = document.createElement('div');
    d.className = 'bloc';
    d.innerHTML = o.html || '';
    zone.appendChild(d);
    blocEnCours = d;

    cta.innerHTML = '';
    (o.boutons || []).forEach(function (b) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = b.cls || 'b1';
      el.textContent = b.txt;
      el.addEventListener('click', function () { if (b.on) b.on(); });
      cta.appendChild(el);
    });

    /* ⚠️ LA PLACE RÉSERVÉE EN BAS DÉPEND DU NOMBRE DE BOUTONS. Elle était
       figée à 146 px, ce qui suffit à deux boutons ; avec trois — le cas d'un
       repas dont la recette est prévue — la barre monte à ~200 px et mangeait
       la dernière ligne du texte. On la mesure donc, une fois les boutons
       posés, au lieu de la deviner. */
    var col = racine.querySelector('#njCol');
    requestAnimationFrame(function () {
      if (!col || !cta) return;
      // Ce qu'il faut dégager, c'est le PREMIER BOUTON, pas la barre entière :
      // son tiers supérieur est un dégradé transparent, et réserver aussi
      // cette hauteur-là coûtait 18 px de texte pour rien.
      var b1 = cta.firstElementChild;
      var haut = b1 ? (cta.offsetHeight - b1.offsetTop) : cta.offsetHeight;
      col.style.paddingBottom = (haut + 14) + 'px';
    });

    if (o.pret) o.pret(d);
    if (o.auto) minuteur = setTimeout(function () { minuteur = null; if (o.apres) o.apres(); }, o.auto);
    return d;
  }

  function enTete() {
    var col = racine.querySelector('#njCol');
    col.insertAdjacentHTML('beforeend',
      '<div class="tete" data-in="glide"><div class="t">Ma journée</div>'
      + '<div class="d">' + esc(dateLongue()) + '</div></div>');
  }

  /* La zone qui accueille les blocs successifs — montée une fois, sous l'arc. */
  function monterZone() {
    racine.querySelector('#njCol').insertAdjacentHTML('beforeend',
      '<div class="zone" id="njZone"></div>');
  }

  /* Scène 1 — bonjour. Le nom, la date, rien d'autre : on n'annonce pas un
     programme avant d'avoir dit bonjour. */
  function scBonjour() {
    var p = etat.prenom;
    var heure = hMaintenant();
    var mot = heure < 5 ? 'Bonne nuit' : (heure < 18 ? 'Bonjour' : 'Bonsoir');
    bloc({
      html: '<div class="kick" data-in="glide">' + esc(dateLongue()) + '</div>'
        + titre(mot + (p ? ' ' + p : ''), '', 0.32),
      auto: 2500,
      apres: scDeroule
    });
  }

  /* Scène 2 — la journée se déroule. L'arc est peint sur la PREMIÈRE étape,
     puis, un temps après, sur celle du moment : ce sont ces deux appels qui
     font défiler les jalons de droite à gauche sous les yeux. */
  function scDeroule() {
    peindreArc(0);
    bloc({
      // Le libellé compte les moments plutôt que de répéter « votre journée »,
      // déjà écrit dans l'en-tête juste au-dessus.
      html: '<div class="kick" data-in="glide">' + etat.etapes.length + ' moments</div>'
        + titre('Voici votre journée', '', 0.15)
        + '<div class="sous" data-in="glide" style="animation-delay:.6s">'
        + 'Dans l’ordre, du matin au soir. Vous n’avez jamais qu’une seule chose à faire.'
        + '</div>',
      auto: 3000,
      apres: scMaintenant
    });
    // L'arc se met en marche pendant que la phrase se lit : la journée avance
    // sous le texte qui l'annonce, au lieu d'attendre qu'il finisse.
    setTimeout(function () { if (ouvert) peindreArc(etat.cur); }, 1150);
  }

  /* Scène 3 — maintenant. C'est la seule scène qui attend, et la seule qui
     porte une action : tout le reste ne fait que l'amener. */
  function scMaintenant() {
    peindreArc(etat.cur);
    var e = etat.etapes[etat.cur];

    if (toutFait(etat.etapes)) return scBoucle();

    var reste = null;
    if (e.cle.indexOf('repas-') === 0 && window.NattyCreneaux) {
      reste = NattyCreneaux.restant(e.cle.slice(6));
    }

    var html = '<div class="kick" data-in="glide">' + esc(e.libelle || libHeure(e.h)) + '</div>'
      // Au-delà d'une douzaine de caractères, le grand corps touche les deux
      // bords à 375 px : « Petit déjeuner » y passe en corps intermédiaire.
      + titre(e.nom, e.nom.length > 11 ? 'p' : '', 0.12)
      + '<div class="sk" data-in="glide" style="animation-delay:.55s">Étape '
      + (etat.cur + 1) + ' sur ' + etat.etapes.length + '</div>'
      + (e.titre2 ? '<div class="quoi" data-in="glide" style="animation-delay:.66s">'
          + esc(e.titre2) + '</div>' : '')
      + '<div class="sous" data-in="glide" style="animation-delay:.78s">' + esc(e.detail) + '</div>';

    if (reste && reste.c) {
      html += '<div class="chips" data-in="para" style="animation-delay:.9s">'
        + '<div><b>' + reste.c + '</b> kcal</div>'
        + '<div><b>' + reste.p + '</b> g prot.</div>'
        + '<div><b>' + reste.g + '</b> g gluc.</div></div>';
    }

    html += '<div class="filet" data-in="glide" style="animation-delay:1s"></div>'
      + '<div class="mot" data-in="glide" style="animation-delay:1.08s">'
      + 'Chaque plat noté éclaire votre journée</div>';

    if (!etat.court) html += recap(1.2);

    var boutons = [{ txt: e.cta, cls: 'b1', on: function () { marquerLong(); e.action(); } }];
    if (e.cta2) boutons.push({ txt: e.cta2, cls: 'b2', on: function () { marquerLong(); e.action2(); } });
    boutons.push({ txt: 'Plus tard', cls: 'b3', on: function () { marquerLong(); fermer(); } });

    bloc({ html: html, boutons: boutons });
  }

  /* La journée écrite, sous l'arc. L'arc donne le rythme, la liste donne les
     faits : sans elle on garde une impression, pas une information. */
  function recap(delai) {
    return '<div class="liste">' + etat.etapes.map(function (e, i) {
      var cls = 'li' + (e.fait ? ' ok' : '') + (i === etat.cur ? ' now' : '');
      var quoi = e.fait ? 'Fait' : (i === etat.cur ? 'Maintenant'
        : (e.h < hMaintenant() - FENETRE_H ? 'Non noté' : 'À venir'));
      return '<div class="' + cls + '" style="animation-delay:' + (delai + i * 0.075).toFixed(2) + 's">'
        + '<div class="p">' + icone(e.fait ? 'coche' : e.icone) + '</div>'
        + '<div><div class="n">' + esc(e.titre2 || e.nom) + '</div>'
        + '<div class="q">' + esc(e.titre2 ? e.nom + ' · ' + quoi : quoi) + '</div></div>'
        + '<div class="hh">' + esc(e.libelle || libHeure(e.h)) + '</div></div>';
    }).join('') + '</div>';
  }

  /* Scène 3 bis — tout est fait. Ce n'est pas un cas particulier à bâcler :
     c'est le seul moment où l'app peut dire « il n'y a rien à faire », et le
     dire clairement vaut mieux que de resservir une étape déjà cochée. */
  function scBoucle() {
    bloc({
      // Le libellé compte les moments plutôt que de répéter la date, déjà en
      // en-tête : c'est la seule information que cet écran peut encore ajouter.
      html: '<div class="kick" data-in="glide">' + etat.etapes.length + ' sur '
        + etat.etapes.length + '</div>'
        + titre('Votre journée est complète', 'p', 0.12)
        + '<div class="sous" data-in="glide" style="animation-delay:.7s">'
        + 'Tous vos repas sont notés, le palier du jour est passé. Il n’y a rien'
        + ' à faire de plus — c’est exactement le but.</div>'
        + recap(0.9),
      boutons: [
        { txt: 'Voir mon suivi', cls: 'b1', on: function () { marquerLong(); fermer(); Natty.goto('suivi.html'); } },
        { txt: 'Fermer', cls: 'b3', on: function () { marquerLong(); fermer(); } }
      ]
    });
  }

  /* ═══ 9. Entrées publiques ═══════════════════════════════ */

  /**
   * Ouvre la séquence.
   * @param {object} [opts] {court:bool} — la version courte saute le bonjour
   *   et le déroulé, et va droit à l'étape du moment. C'est celle des moments
   *   clés : quelqu'un qui arrive à 12 h 40 pour noter son déjeuner n'a pas à
   *   regarder une cinématique de quatre plans avant de pouvoir le faire.
   */
  async function ouvrir(opts) {
    opts = opts || {};
    if (ouvert) return;
    if (!window.Natty || !Natty.USER_ID) return;
    ouvert = true;

    var d;
    try { d = await construire(); }
    catch (e) { ouvert = false; return; }

    if (!d.etapes.length) { ouvert = false; return; }

    etat = {
      prenom: '', etapes: d.etapes, plan: d.plan,
      cur: courante(d.etapes), court: !!opts.court
    };

    monter();
    enTete();
    monterArc(racine.querySelector('#njCol'));
    monterZone();

    if (etat.court) {
      peindreArc(etat.cur);
      scMaintenant();
    } else {
      // Le prénom n'est pas bloquant : la scène s'ouvre tout de suite et se
      // contente de « Bonjour » si la requête traîne. Attendre le réseau pour
      // dire bonjour, c'est faire attendre pour rien.
      peindreArc(0);
      etat.prenom = await prenom();
      if (!ouvert) return;
      scBonjour();
    }
  }

  /**
   * Le déclencheur des écrans.
   *
   * Deux occasions, et deux seulement :
   *   • la PREMIÈRE ouverture de la journée → la version longue ;
   *   • un MOMENT CLÉ entamé dont l'étape n'est pas faite, et qu'on n'a pas
   *     déjà montré → la version courte.
   *
   * ⚠️ Le délai par défaut est plus long que celui de `planning.js` (5 s) : si
   * la semaine n'est pas planifiée, c'est SA séquence qui doit s'ouvrir, pas
   * celle-ci. On regarde donc l'écran avant de s'y inviter.
   */
  function proposerSiNecessaire(delai) {
    if (!window.Natty || !Natty.USER_ID) return;
    setTimeout(async function () {
      if (ouvert) return;
      if (document.getElementById('nplan')) return;          // la planification est ouverte
      if (document.getElementById('nattyAjout')) return;      // un plat est en cours d'ajout
      if (window.NattyGeneration && NattyGeneration.enCours()) return;

      var premiere = !vuLong();
      if (premiere) { ouvrir(); return; }

      // Ensuite : seulement si un moment clé a commencé et n'est pas fait.
      var d;
      try { d = await construire(); } catch (e) { return; }
      if (!d.etapes.length) return;
      var i = courante(d.etapes), e = d.etapes[i];
      if (e.fait) return;
      // Le moment doit avoir COMMENCÉ : annoncer le dîner à 15 h, c'est
      // interrompre quelqu'un pour quelque chose qui n'a pas lieu.
      if (e.h > hMaintenant()) return;
      if (vuEtape(e.cle)) return;
      marquerEtape(e.cle);
      ouvrir({ court: true });
    }, delai == null ? 6500 : delai);
  }

  return {
    ouvrir: ouvrir,
    fermer: fermer,
    proposerSiNecessaire: proposerSiNecessaire,
    /** Le déroulé calculé — pour vérifier, sans ouvrir quoi que ce soit. */
    etapes: async function () { return (await construire()).etapes; },
    courante: courante,
    libHeure: libHeure
  };
})();
