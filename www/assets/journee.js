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

  /* Le jour en gras, la date en gris — les deux seules lignes de contexte que
     garde la scène finale.
     ⚠️ La majuscule est posée ICI, et pas par `text-transform:capitalize` :
     la règle CSS majuscule CHAQUE mot, et affichait « Dimanche 9 Août ». */
  function jourEtDate(d) {
    d = d || new Date();
    var j = JOURS[d.getDay()];
    return '<b>' + esc(j.charAt(0).toUpperCase() + j.slice(1)) + '</b> '
      + esc(d.getDate() + ' ' + MOIS[d.getMonth()]);
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

  /**
   * Ce qu'on met dans une bulle : la PHOTO DÉTOURÉE du plat prévu à ce créneau
   * quand la planification en a un, l'illustration au trait sinon.
   *
   * Un plat reconnaissable vaut mieux qu'un pictogramme de repas : c'est la
   * différence entre « il y a un dîner » et « il y a CE dîner ».
   */
  function figure(e) {
    var ph = e && e.prevu && e.prevu.photo;
    if (ph) return '<img src="' + esc(ph) + '" alt="" data-repli="' + esc(e.icone || 'midi') + '">';
    return icone(e && e.icone ? e.icone : 'plus');
  }

  /* ⚠️ Une photo qui n'arrive pas laisse l'icône cassée du navigateur AU MILIEU
     de l'arc — c'est-à-dire à l'endroit exact que l'écran désigne. On repose
     l'illustration à sa place. Le test `complete && !naturalWidth` couvre
     l'échec survenu AVANT qu'on écoute l'événement, ce qui arrive avec une
     image insérée par innerHTML (même parade que `planning.js`). */
  function brancherPhoto(hote, e) {
    if (!hote) return;
    hote.querySelectorAll('img[data-repli]').forEach(function (im) {
      function replier() {
        if (!im.parentNode) return;
        var d = document.createElement('span');
        d.innerHTML = icone(im.getAttribute('data-repli'));
        im.parentNode.replaceChild(d.firstChild, im);
      }
      im.addEventListener('error', replier);
      if (im.complete && !im.naturalWidth) replier();
    });
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
        // Le titre et le bouton ne disent pas la même chose : « Planifier ma
        // semaine » aux deux endroits se lisait deux fois pour rien.
        cle: 'planifier', nom: 'Ma semaine', icone: 'planifier',
        // ⚠️ Pas d'heure affichée, et c'est voulu : elle n'en a pas. Placée à
        // 8 h comme le petit déjeuner, elle donnait DEUX jalons marqués « 8 h »
        // côte à côte dans l'arc, ce qui se lit comme un doublon. `h` ne sert
        // plus qu'à la ranger en tête ; c'est `libelle` qu'on lit.
        h: Math.min(hMaintenant(), 7.5) - 0.5, libelle: 'D’abord', fait: false,
        cta: 'Planifier ma semaine',
        // ⚠️ Les actions ne ferment PLUS elles-mêmes : c'est `envol()` qui le
        // fait, après son animation. Fermer ici retirerait la racine avant que
        // le mouvement n'ait commencé.
        action: function () {
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
        cta: 'Ajouter mon plat',
        // ⚠️ SYNCHRONE : `assets/ajout.js` ouvre la caméra, et iOS ne l'accepte
        // que si l'appel part du geste de l'utilisateur, dans la même pile.
        // C'est ce drapeau que lit `envol()` pour ne pas retarder l'action.
        sync: true,
        action: function () {
          if (window.NattyAjout && NattyAjout.start) NattyAjout.start();
          else Natty.goto('suivi.html');
        }
      };

      /* Une recette prévue prend la main sur « ajouter » : on n'a pas encore
         mangé, l'action utile est de la préparer. Un seul bouton, et pas de
         « j'ai mangé autre chose » : le `+` de la barre de navigation est
         toujours là, et un troisième bouton est un choix de plus à faire pour
         un cas de bord. */
      if (prevu && deja === 0) {
        e.titre2 = prevu.nom;
        e.cta = 'Suivre la recette';
        e.sync = false;
        e.action = function () { marquerEtape(e.cle); Natty.goto('repas.html'); };
      }
      out.push(e);
    });

    /* Le palier du parcours, puis le bilan. Dans cet ordre : on apprend
       quelque chose, puis on regarde sa journée — l'inverse ferait du bilan
       une étape de passage avant un jeu. */
    out.push({
      cle: 'defi', nom: 'Le palier du jour', icone: 'defi', h: H_DEFI,
      fait: ongletVu('defis'),
      cta: 'Ouvrir le parcours',
      action: function () { marquerEtape('defi'); Natty.goto('narration.html'); }
    });

    out.push({
      cle: 'bilan', nom: 'Le point du soir', icone: 'bilan', h: H_BILAN,
      fait: ongletVu('suivi'),
      cta: 'Voir mon suivi',
      action: function () { marquerEtape('bilan'); Natty.goto('suivi.html'); }
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
      '#njour{position:fixed;inset:0;z-index:99988;',
      'font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;opacity:0;',
      'transition:opacity .5s ease;overflow:hidden;-webkit-font-smoothing:antialiased}',
      '#njour.on{opacity:1}',
      '#njour *{box-sizing:border-box}',
      '#njour button{font-family:inherit;cursor:pointer;border:none;',
      '-webkit-tap-highlight-color:transparent;transition:transform .16s ease}',
      '#njour button:active{transform:scale(.975)}',

      /* ── Le fond, et les deux thèmes ────────────────────────
         Toutes les couleurs passent par des jetons `--j-*`, et il n'y a QU'UN
         jeu de règles : le clair ne redéfinit que les jetons. Sans ça, chaque
         retouche serait à faire deux fois, et l'un des deux thèmes finirait
         par diverger sans que personne ne s'en aperçoive — c'est exactement ce
         qui est arrivé aux ombres neumorphiques de `suivi.html` (§7).

         ⚠️ Les jetons `--nt-*` d'`assets/theme.js` ne suffisent pas ici : cet
         écran a des besoins qui n'existent nulle part ailleurs (une lueur, un
         creux sur fond noir, un relief de pastille). Il lui faut les siens.

         Trois couches de fond : une lueur haute qui tient l'arc, un halo bas
         plus large qui décolle le texte, et un voile qui referme le bas pour
         que la barre d'action reste lisible. Rien ne bouge vite : c'est une
         atmosphère, pas une animation. */
      '#njour{--j-bg:#000;--j-ink:#fff;--j-mut:#8b8b95;--j-mut2:#6e6e78;',
      '--j-lueur1:rgba(255,255,255,.30);--j-lueur2:rgba(255,255,255,.13);',
      '--j-lueur3:rgba(255,255,255,.035);--j-halo:rgba(222,225,236,.16);',
      '--j-halo2:rgba(222,225,236,.05);--j-trait:rgba(255,255,255,.13);',
      '--j-trait2:rgba(255,255,255,.055);--j-creux:#0a0a0c;--j-relief:#17181c;',
      '--j-vif:#fff;--j-sur-vif:#0a0a0c;--j-anneau:rgba(255,255,255,.16);',
      '--j-ombre:rgba(0,0,0,.7);--j-reflet:rgba(255,255,255,.055);',
      '--j-contour:rgba(255,255,255,.07);--j-fermer:rgba(255,255,255,.07)}',
      /* Clair — le noir devient blanc, la lueur devient une ombre douce, et la
         pastille du moment s'inverse : encre pleine sur fond clair. */
      ':root[data-theme="light"] #njour{--j-bg:#fff;--j-ink:#101014;--j-mut:#8a8a95;',
      '--j-mut2:#a6a6b0;--j-lueur1:rgba(126,128,145,.16);--j-lueur2:rgba(126,128,145,.07);',
      '--j-lueur3:rgba(126,128,145,.02);--j-halo:rgba(150,153,168,.10);',
      '--j-halo2:rgba(150,153,168,.03);--j-trait:rgba(20,20,30,.14);',
      '--j-trait2:rgba(20,20,30,.06);--j-creux:#eceef1;--j-relief:#f4f5f7;',
      '--j-vif:#101014;--j-sur-vif:#fff;--j-anneau:rgba(20,20,30,.14);',
      '--j-ombre:rgba(20,20,30,.16);--j-reflet:rgba(255,255,255,.9);',
      '--j-contour:rgba(20,20,30,.07);--j-fermer:rgba(20,20,30,.06)}',

      '#njour{background:var(--j-bg);color:var(--j-ink)}',
      '#njour .fade{position:absolute;inset:0;pointer-events:none}',
      '#njour .fade i{position:absolute;display:block;border-radius:50%}',
      /* La lueur est centrée sur l'ARC (≈ 37 % de la hauteur), pas sur le haut
         de l'écran : à `top:-22%` son foyer tombait à 27 %, donc au-dessus des
         jalons — on voyait une tache lumineuse et, plus bas, un arc éteint. */
      '#njour .f1{left:50%;top:-2%;width:150%;height:78%;transform:translateX(-50%);',
      'background:radial-gradient(50% 50% at 50% 52%,var(--j-lueur1) 0%,',
      'var(--j-lueur2) 34%,var(--j-lueur3) 56%,transparent 74%);',
      'animation:njSouffle 9s ease-in-out infinite}',
      '#njour .f2{left:50%;top:20%;width:200%;height:74%;transform:translateX(-50%);',
      'background:radial-gradient(50% 50% at 50% 50%,var(--j-halo) 0%,',
      'var(--j-halo2) 44%,transparent 72%);',
      'animation:njSouffle 12s ease-in-out infinite reverse}',
      '#njour .f3{position:absolute;left:0;right:0;bottom:0;height:46%;border-radius:0;',
      'background:linear-gradient(to top,var(--j-bg) 34%,transparent)}',
      '@keyframes njSouffle{0%,100%{opacity:.85;transform:translateX(-50%) scale(1)}',
      '50%{opacity:1;transform:translateX(-50%) scale(1.06)}}',

      /* ── La colonne ─────────────────────────────────────────
         Même gabarit que le reste de l'app, et la place de la barre d'action
         réservée en bas : un contenu qui passe dessous se lit mal et se tape
         encore plus mal.
         ⚠️ `justify-content:center` : le contenu est court, et top-aligné il
         laissait l'arc collé au bord haut avec la moitié de l'écran vide en
         dessous — « problème de centrage, trop haut ». Le groupe arc + texte
         se centre maintenant dans la place disponible. */
      '#njour .col{position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;',
      'padding:calc(20px + env(safe-area-inset-top,0px)) 22px ',
      'calc(146px + env(safe-area-inset-bottom,0px));overflow-y:auto;',
      '-webkit-overflow-scrolling:touch;text-align:center}',

      /* ⚠️ PLUS D'EN-TÊTE. « Ma journée » + la date en haut de chaque scène
         répétaient ce que la scène finale dit déjà, et faisaient un écran de
         plus à lire avant d'arriver à l'action. La date vit maintenant dans la
         seule scène qui en a besoin. */

      /* L'arc n'existe qu'à partir de la deuxième scène : le bonjour est le
         nom, et rien d'autre. */
      '#njour .arc{opacity:0;transition:opacity .6s ease}',
      '#njour.arcvu .arc{opacity:1}',

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
      '#njour .arc svg.orbite path{stroke:var(--j-trait);stroke-width:1;',
      'stroke-dasharray:900;stroke-dashoffset:900;animation:njTrace 1.6s cubic-bezier(.22,1,.36,1) forwards}',
      '#njour .arc svg.orbite path.b{stroke:var(--j-trait2);animation-delay:.16s}',
      '#njour .arc svg.orbite path.c{stroke:var(--j-trait2);animation-delay:.3s;opacity:.6}',
      '@keyframes njTrace{to{stroke-dashoffset:0}}',

      '#njour .jal{position:absolute;border-radius:50%;display:flex;align-items:center;',
      'justify-content:center;transform:translate(-50%,-50%);',
      'transition:left .95s cubic-bezier(.22,1,.36,1),top .95s cubic-bezier(.22,1,.36,1),',
      'width .95s cubic-bezier(.22,1,.36,1),height .95s cubic-bezier(.22,1,.36,1),',
      'opacity .7s ease,background .5s ease,box-shadow .7s ease}',
      '#njour .jal svg{width:46%;height:46%;fill:none;stroke:currentColor;stroke-width:1.9;',
      'stroke-linecap:round;stroke-linejoin:round}',

      /* ── Le barillet ────────────────────────────────────────
         Le jalon du moment ne se contente pas de s'allumer : son icône ARRIVE,
         comme le cran d'un sélecteur iOS qui se cale. Deux icônes empilées dans
         une fenêtre qui les rogne — celle d'avant, puis la sienne — et la
         courbe d'accélération dépasse légèrement avant de revenir : c'est ce
         petit dépassement qui fait « cran », un simple fondu ne le donne pas.
         ⚠️ La fenêtre est un élément INTERNE (`.ic`) : rogner sur `.jal` même
         emporterait l'anneau de pulsation, qui déborde volontairement. */
      '#njour .jal .ic{position:absolute;inset:0;border-radius:50%;overflow:hidden;',
      'display:flex;align-items:center;justify-content:center}',
      '#njour .jal .rou{position:absolute;left:0;right:0;top:0;height:200%;',
      'display:flex;flex-direction:column}',
      '#njour .jal .rou > *{height:50%;display:flex;align-items:center;justify-content:center}',
      /* ⚠️ LE SENS. `.rou` fait 200 % de haut, ses deux cases 50 % chacune : à
         `translateY(0)` c'est la case du HAUT — l'étape précédente — qu'on voit
         dans la fenêtre. Le barillet part donc de 0 et roule vers −50 %.
         L'inverse avait été écrit, et le résultat était visible sur la capture
         de Pablo : la bulle du dîner affichait la coche du déjeuner, c'est-à-
         dire qu'elle finissait sur l'étape d'avant. */
      '#njour .jal.actif .rou{animation:njBarillet .82s cubic-bezier(.2,1.24,.32,1) both}',
      '@keyframes njBarillet{from{transform:translateY(0)}to{transform:translateY(-50%)}}',

      /* ── La validation ──────────────────────────────────────
         Le V vert d'Apple : l'anneau se dessine, puis la coche. Deux tracés
         décalés — un seul trait continu ne se lit pas comme une validation.
         Même recette que `.vok` d'`assets/planning.js`, en petit. */
      '#njour .jal .vok{width:100%;height:100%;stroke-width:2.4}',
      '#njour .jal .vok .rd{stroke:#34c759;stroke-dasharray:64;stroke-dashoffset:64;',
      'animation:njTrace .52s cubic-bezier(.22,1,.36,1) forwards}',
      '#njour .jal .vok .ck{stroke:#34c759;stroke-dasharray:20;stroke-dashoffset:20;',
      'animation:njTrace .34s cubic-bezier(.22,1,.36,1) .34s forwards}',

      /* À venir — un creux neumorphique, qui porte DÉJÀ l'illustration de son
         étape. Le « + » de la maquette d'origine ne disait rien de ce qui
         vient ; l'icône, si — on voit sa journée, pas une file d'attente. */
      '#njour .jal.futur{background:var(--j-creux);color:var(--j-mut);',
      'box-shadow:inset 1.5px 1.5px 4px var(--j-ombre),',
      'inset -1px -1px 3px var(--j-reflet),0 0 0 1px var(--j-contour)}',
      /* Fait — relief plein, mais discret : c'est derrière soi. */
      '#njour .jal.passe{background:var(--j-relief);color:var(--j-mut);',
      'box-shadow:inset 0 1px 0 var(--j-reflet),0 3px 10px var(--j-ombre)}',
      /* Manqué — ni creux ni relief : un contour seul. Le montrer sans le
         cocher est plus honnête que de l'effacer. */
      '#njour .jal.manque{background:var(--j-creux);color:var(--j-mut2);',
      'box-shadow:0 0 0 1px var(--j-trait)}',
      /* Maintenant — la pastille pleine de la maquette, sa lueur comprise. */
      '#njour .jal.actif{background:var(--j-vif);color:var(--j-sur-vif);',
      'box-shadow:0 0 44px var(--j-lueur1),0 0 0 1px var(--j-vif),',
      'inset 0 -2px 4px rgba(140,142,152,.28),inset 0 2px 3px var(--j-reflet)}',
      '#njour .jal.actif::after{content:"";position:absolute;inset:-14px;border-radius:50%;',
      'border:1px solid var(--j-anneau);animation:njPulse 3.4s ease-in-out infinite}',
      '@keyframes njPulse{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.13);opacity:0}}',

      /* La photo du plat prévu, quand il y en a une : le sujet est détouré sur
         fond transparent, donc `contain` et jamais `cover` — un plat rogné aux
         bords dans une pastille de 62 px ne se reconnaît plus. */
      '#njour .jal img{width:74%;height:74%;object-fit:contain;display:block}',

      '#njour .jal .h{position:absolute;top:calc(100% + 7px);left:50%;transform:translateX(-50%);',
      'font-size:9.5px;font-weight:700;letter-spacing:.4px;white-space:nowrap;',
      'color:var(--j-mut2)}',
      '#njour .jal.actif .h{font-size:10.5px;color:var(--j-ink);top:calc(100% + 10px)}',

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
      /* ⚠️ LE TEXTE SE POSE SOUS L'ARC, il ne se centre pas dans ce qui reste.
         Avec `flex:1`, la zone absorbait toute la hauteur libre et le titre
         partait au milieu de l'écran, à 300 px de l'arc : deux blocs qui ne se
         parlaient plus. Une fois le contenu réduit à quatre lignes, c'est le
         VIDE qui doit descendre en bas, pas le texte. */
      '#njour .zone{flex:0 0 auto;width:100%;max-width:420px;margin-top:22px;',
      'position:relative;display:flex;flex-direction:column;justify-content:flex-start}',
      '#njour .bloc{width:100%}',
      '#njour .bloc.sort{position:absolute;left:0;right:0;top:0;bottom:0;',
      'display:flex;flex-direction:column;justify-content:center;pointer-events:none}',
      /* ⚠️ QUATRE ÉLÉMENTS DE TEXTE EN TOUT, ET PAS UN DE PLUS. La première
         version empilait libellé d'heure, titre, « étape 2 sur 5 », une phrase
         explicative, trois pastilles de macros, un filet, une devise et le
         récapitulatif écrit de la journée : neuf blocs pour une décision qui en
         demande une. Ne restent que le jour, la date, l'étape et le bouton —
         les macros et le détail se lisent sur l'écran Suivi, qui est fait pour
         ça. Les règles `.kick` / `.sous` servent encore, en tout petit. */
      '#njour .kick{font-size:12.5px;font-weight:600;color:var(--j-mut);letter-spacing:.2px}',
      '#njour .kick b{color:var(--j-ink);font-weight:700}',
      '#njour h1{font-size:44px;font-weight:900;letter-spacing:-1.8px;line-height:1.04;',
      'margin:12px 0 0}',
      '#njour h1 span{display:inline-block;opacity:0;',
      'animation:njGlide .68s cubic-bezier(.22,1,.36,1) forwards}',
      '#njour h1.p{font-size:34px;letter-spacing:-1.2px}',
      '#njour .sous{font-size:14px;color:var(--j-mut);line-height:1.5;margin-top:12px;',
      'max-width:320px;margin-left:auto;margin-right:auto}',

      /* ── Entrées ────────────────────────────────────────────
         Jamais de flou sur du texte : la règle vient de `narration.html` et
         vaut pour toutes les cinématiques de l'app. */
      '@keyframes njGlide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
      '#njour [data-in]{opacity:0;animation-duration:.72s;',
      'animation-timing-function:cubic-bezier(.22,1,.36,1);animation-fill-mode:forwards}',
      '#njour [data-in="glide"]{animation-name:njGlide}',
      '#njour .bloc.sort{animation:njSort .34s cubic-bezier(.4,0,1,1) forwards}',
      '@keyframes njSort{to{opacity:0;transform:translateY(-12px)}}',

      /* ── La barre d'action ──────────────────────────────────
         Fixe, hors du bloc animé. Leçon de `narration.html` : un bouton posé
         dans la scène part avec son animation de sortie et disparaît sous le
         doigt. */
      '#njCta{position:absolute;left:0;right:0;bottom:0;z-index:6;',
      'padding:14px 22px calc(20px + env(safe-area-inset-bottom,0px));display:flex;',
      'flex-direction:column;gap:9px;align-items:stretch;pointer-events:none;',
      'background:linear-gradient(to top,var(--j-bg) 60%,transparent)}',
      '#njCta > *{pointer-events:auto;max-width:436px;width:100%;margin:0 auto;',
      'animation:njGlide .42s cubic-bezier(.22,1,.36,1) .26s backwards}',
      '#njour .b1{background:var(--j-vif);color:var(--j-sur-vif);border-radius:22px;padding:18px;',
      'font-size:16.5px;font-weight:800;letter-spacing:-.2px;',
      'box-shadow:0 10px 30px var(--j-ombre)}',
      '#njour .b2{background:var(--j-relief);color:var(--j-ink);border-radius:22px;padding:15px;',
      'font-size:14.5px;font-weight:700;box-shadow:inset 0 1px 0 var(--j-reflet),',
      '0 8px 22px var(--j-ombre)}',
      '#njour .b3{background:none;color:var(--j-mut);padding:12px;font-size:14px;font-weight:600}',

      /* ── L'envol ────────────────────────────────────────────
         Au clic, la pastille blanche du moment s'ouvre et prend tout l'écran :
         on ne « quitte » pas le guide, on entre dans ce qu'il désignait. Le
         disque part exactement du centre du jalon — sinon le mouvement vient de
         nulle part et se lit comme un simple fondu.
         ⚠️ Il ne dure que 380 ms, et pour une bonne raison : c'est du temps
         volé à ce que l'utilisateur a demandé. */
      '#njour .envol{position:absolute;width:58px;height:58px;border-radius:50%;',
      'background:var(--j-vif);transform:translate(-50%,-50%) scale(1);z-index:9;',
      'animation:njEnvol .38s cubic-bezier(.5,0,.9,.6) forwards;pointer-events:none}',
      '@keyframes njEnvol{to{transform:translate(-50%,-50%) scale(26);opacity:.92}}',
      '#njour.part .col,#njour.part #njCta,#njour.part #njFerme{',
      'animation:njPart .3s ease forwards;pointer-events:none}',
      '@keyframes njPart{to{opacity:0}}',

      /* Le bouton de fermeture. Une cinématique qui s'invite doit pouvoir se
         refuser d'un geste, sans lire les boutons du bas. */
      '#njFerme{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:16px;',
      'z-index:8;width:34px;height:34px;border-radius:50%;background:var(--j-fermer);',
      'color:var(--j-mut);font-size:17px;line-height:1;display:flex;align-items:center;',
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
     sommet : ce qui vient arrive par la droite, passe au sommet quand c'est
     son heure, et sort par la gauche. C'est le mouvement de la journée, et il
     n'a pas besoin d'être expliqué. */

  /* ⚠️ LE PAS ET LE NOMBRE DE JALONS SE RÈGLENT ENSEMBLE. À 22° et quatre
     jalons de chaque côté, l'arc balayait ±88° : le trait de l'orbite
     redescendait le long des deux bords jusque DERRIÈRE le titre, et les
     jalons extrêmes sortaient du cadre par le bas. Mesuré à 375 px.

     ⚠️ ET LE SOMMET EST À −90°, PAS −98. Décalée de 8°, la pastille du moment
     tombait à 41 % de la largeur : tout l'écran — titre, date, bouton — est
     centré, elle seule ne l'était pas, et ça se voyait (« problème de
     centrage »). Au sommet exact, le passé descend à gauche et l'à-venir à
     droite, symétriquement.

     Le rayon a été resserré (230 → 186) et le pas ouvert (17 → 21) : l'arc se
     lit maintenant comme un morceau de CERCLE, et non comme une ligne à peine
     courbée — c'est ce que demande l'inspiration. */
  var CX = 180, CY = 300, R = 186, PAS = 21, SOMMET = -90;

  function pos(delta) {
    var a = (SOMMET + delta * PAS) * Math.PI / 180;
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
  }

  function cheminOrbite(r) {
    var p0 = null, d = '';
    for (var t = -160; t <= -20; t += 4) {
      var a = t * Math.PI / 180;
      var x = CX + r * Math.cos(a), y = CY + r * Math.sin(a);
      d += (p0 ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      p0 = 1;
    }
    return d;
  }

  function monterArc(hote) {
    // Trois orbites concentriques plutôt qu'une : c'est ce qui donne à
    // l'inspiration sa profondeur — un fil porteur, et deux échos autour.
    var h = '<div class="arc" id="njArc"><svg class="orbite" viewBox="0 0 360 224" preserveAspectRatio="none">'
      + '<path d="' + cheminOrbite(R) + '"/>'
      + '<path class="b" d="' + cheminOrbite(R - 16) + '"/>'
      + '<path class="c" d="' + cheminOrbite(R + 22) + '"/></svg>';
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
      var taille = [62, 42, 33, 26][ad];
      var opac = [1, .62, .42, .24][ad];

      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.style.width = taille + 'px';
      el.style.height = taille + 'px';
      el.style.opacity = Math.abs(d) > VISIBLES ? 0 : opac;

      var role = (i === cur) ? 'actif'
        : (e.fait ? 'passe' : (e.h < h - FENETRE_H ? 'manque' : 'futur'));
      el.className = 'jal ' + role;

      /* ⚠️ LE CONTENU N'EST RÉÉCRIT QUE SI LE RÔLE A CHANGÉ. `peindreArc` est
         appelée à chaque scène ; réécrire à chaque fois relançait le tracé du
         V vert et le cran du barillet — donc une validation qui se rejoue
         indéfiniment, ce qui la vide de son sens. Une animation ne doit se
         jouer qu'au moment où la chose qu'elle raconte arrive. */
      if (el.getAttribute('data-role') !== role) {
        el.setAttribute('data-role', role);
        var ic = el.querySelector('.ic');
        if (role === 'actif') {
          // Le barillet : l'illustration précédente, puis la sienne, dans une
          // fenêtre qui les rogne. C'est ce cran qui montre « on y est ».
          var avant = etat.etapes[i - 1];
          ic.innerHTML = '<span class="rou"><span>'
            + (avant ? (avant.fait ? icone('coche') : figure(avant)) : icone('plus')) + '</span>'
            + '<span>' + figure(e) + '</span></span>';
          brancherPhoto(ic, e);
        } else if (role === 'passe') {
          ic.innerHTML = '<svg class="vok" viewBox="0 0 24 24">'
            + '<circle class="rd" cx="12" cy="12" r="10.2"/>'
            + '<path class="ck" d="M7.4 12.3 10.6 15.6 16.8 8.8"/></svg>';
        } else {
          // ⚠️ Plus de « + » : chaque bulle porte l'illustration de SON étape.
          // Un « + » ne dit rien de ce qui vient — on voit sa journée, pas une
          // file d'attente. (Demande de Pablo, 9 août 2026.)
          ic.innerHTML = figure(e);
          brancherPhoto(ic, e);
        }
      }

      // L'heure ne s'affiche que sur le jalon du moment. Sur les voisins elle
      // se superposait à celle d'à côté, et surtout elle donnait cinq nombres
      // à lire là où l'écran n'en demande qu'un.
      var hh = el.querySelector('.h');
      if (hh) hh.style.display = (i === cur) ? '' : 'none';
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

  /* La zone qui accueille les blocs successifs — montée une fois, sous l'arc. */
  function monterZone() {
    racine.querySelector('#njCol').insertAdjacentHTML('beforeend',
      '<div class="zone" id="njZone"></div>');
  }

  /* ── Scène 1 — le nom, et rien d'autre ────────────────────
     Pas de date, pas d'arc, pas de compte d'étapes. Un écran qui dit bonjour
     ne dit que bonjour ; tout ce qu'on y ajoute se lit à sa place. */
  function scBonjour() {
    var p = etat.prenom;
    var heure = hMaintenant();
    var mot = heure < 5 ? 'Bonne nuit' : (heure < 18 ? 'Bonjour' : 'Bonsoir');
    bloc({
      html: titre(mot + (p ? ' ' + p : ''), '', 0.25),
      auto: 2200,
      apres: scArc
    });
  }

  /* ── Scène 2 — l'arc, seul ────────────────────────────────
     Aucun texte. Les jalons faits se cochent en vert l'un après l'autre, puis
     l'arc tourne et le barillet du moment se cale sur l'étape en cours. C'est
     le seul écran qui n'a rien à lire, et c'est pour ça qu'il se regarde. */
  function scArc() {
    racine.classList.add('arcvu');
    peindreArc(0);
    bloc({ html: '', auto: 3300, apres: scEtape });
    // L'arc se met en marche une fois les premières coches posées : tout
    // partir en même temps ferait un mouvement illisible.
    setTimeout(function () { if (ouvert) peindreArc(etat.cur); }, 1250);
  }

  /* ── Scène 3 — jour, date, étape, action ──────────────────
     Quatre choses. C'est la seule scène qui attend, et la seule qui porte une
     action : tout le reste ne fait que l'amener. */
  function scEtape() {
    peindreArc(etat.cur);
    if (toutFait(etat.etapes)) return scBoucle();

    var e = etat.etapes[etat.cur];

    var html = '<div class="kick" data-in="glide">' + jourEtDate() + '</div>'
      // Au-delà d'une douzaine de caractères, le grand corps touche les deux
      // bords à 375 px : « Petit déjeuner » y passe en corps intermédiaire.
      + titre(e.nom, e.nom.length > 11 ? 'p' : '', 0.1)
      // Le nom de la recette est la seule ligne conservée : sans elle,
      // « Déjeuner » + « Suivre la recette » ne dit pas LAQUELLE.
      + (e.titre2 ? '<div class="sous" data-in="glide" style="animation-delay:.5s">'
          + esc(e.titre2) + '</div>' : '');

    bloc({
      html: html,
      boutons: [
        { txt: e.cta, cls: 'b1', on: function () { marquerLong(); envol(e.action, e.sync); } },
        { txt: 'Plus tard', cls: 'b3', on: function () { marquerLong(); fermer(); } }
      ]
    });
  }

  /* Scène 3 bis — tout est fait. Ce n'est pas un cas particulier à bâcler :
     c'est le seul moment où l'app peut dire « il n'y a rien à faire », et le
     dire clairement vaut mieux que de resservir une étape déjà cochée. */
  function scBoucle() {
    bloc({
      html: '<div class="kick" data-in="glide">' + jourEtDate() + '</div>'
        + titre('Journée complète', 'p', 0.1),
      boutons: [
        { txt: 'Voir mon suivi', cls: 'b1',
          on: function () { marquerLong(); envol(function () { Natty.goto('suivi.html'); }); } },
        { txt: 'Fermer', cls: 'b3', on: function () { marquerLong(); fermer(); } }
      ]
    });
  }

  /* ── Scène 4 — l'envol vers la fonction ───────────────────
     La pastille blanche du moment s'ouvre et prend l'écran : on n'a pas quitté
     le guide, on est entré dans ce qu'il désignait.

     ⚠️ `sync` N'EST PAS UN DÉTAIL. `NattyAjout.start()` ouvre la caméra, et
     iOS n'accepte cette ouverture que si elle part du geste de l'utilisateur,
     dans la même pile d'appels : la retarder de 380 ms pour faire joli, c'est
     une caméra qui ne s'ouvre plus. Ces actions-là partent donc tout de suite,
     l'animation se jouant par-dessus. Les autres, qui ne font que naviguer,
     attendent la fin du mouvement.
  */
  function envol(action, sync) {
    if (!racine) { if (action) action(); return; }
    var jal = arcEl && arcEl.querySelector('.jal.actif');
    if (jal && arcEl) {
      var r = jal.getBoundingClientRect();
      var f = document.createElement('div');
      f.className = 'envol';
      f.style.left = (r.left + r.width / 2) + 'px';
      f.style.top = (r.top + r.height / 2) + 'px';
      f.style.position = 'fixed';
      racine.appendChild(f);
    }
    racine.classList.add('part');
    if (sync) { if (action) action(); fermer(); return; }
    setTimeout(function () { fermer(); if (action) action(); }, 380);
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
    monterArc(racine.querySelector('#njCol'));
    monterZone();

    if (etat.court) {
      // Version courte : l'arc est là dès la première image, déjà calé sur le
      // moment. Pas de bonjour, pas de déroulé — on vient noter un repas.
      racine.classList.add('arcvu');
      peindreArc(etat.cur);
      scEtape();
    } else {
      // Le prénom n'est pas bloquant : la scène s'ouvre tout de suite et se
      // contente de « Bonjour » si la requête traîne. Attendre le réseau pour
      // dire bonjour, c'est faire attendre pour rien.
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

  /* ═══ 10. Le bandeau de menu.html ════════════════════════
     Le même arc, en tout petit, posé AU-DESSUS des trois éléments de l'accueil.
     Il ne porte que trois choses : le jour et la date, ce qui est validé, et où
     l'on en est. Pas de titre, pas de libellé sous les jalons, pas de bouton —
     c'est une ligne de statut, pas une carte de plus dans une page qui en a
     déjà trois. Un tap ouvre le guide.

     ⚠️ Il vit dans le thème de la PAGE, pas dans le noir du guide : d'où les
     jetons `--nt-*` d'`assets/theme.js`, les seuls valables sur tous les
     écrans. Écrire du noir en dur ici donnerait une barre noire au milieu d'un
     accueil blanc, et une barre invisible en thème sombre. */

  function cssBandeau() {
    if (document.getElementById('njband-css')) return;
    var s = document.createElement('style');
    s.id = 'njband-css';
    s.textContent = [
      /* Pas d'animation d'entrée : un en-tête n'a rien à annoncer, et un fondu
         de plus est exactement ce qu'on cherche à retirer de cet écran. */
      '.njb{display:block;width:100%;border:none;background:none;padding:4px 0 14px;',
      'font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;',
      'text-align:center;position:relative}',
      '.njb:active{opacity:.65}',

      /* La lueur du guide, en sourdine — c'est ce qui donne l’impression
         qu’il tourne DERRIÈRE l’en-tête plutôt qu’à côté. Elle reste
         volontairement à peine perceptible : sur une page claire et chargée,
         un halo marqué se lirait comme une tache. */
      '.njb::before{content:"";position:absolute;left:50%;top:16px;width:230px;height:130px;',
      'transform:translateX(-50%);border-radius:50%;pointer-events:none;',
      'background:radial-gradient(50% 50% at 50% 50%,var(--nt-ombre,rgba(20,20,30,.14)) 0%,',
      'transparent 70%);opacity:.5}',

      '.njb-l{display:flex;align-items:baseline;justify-content:space-between;gap:10px;',
      'padding:0 2px 2px;position:relative}',
      '.njb-d{font-size:12.5px;font-weight:600;color:var(--nt-muted,#9a9aaa);letter-spacing:.1px}',
      '.njb-d b{color:var(--nt-ink,#101014);font-weight:700}',
      '.njb-n{font-size:11px;font-weight:700;color:var(--nt-muted,#9a9aaa);flex-shrink:0}',

      '.njb-arc{position:relative;height:78px;width:100%;margin-top:2px}',
      '.njb-arc svg{position:absolute;inset:0;width:100%;height:100%;fill:none;',
      'stroke:var(--nt-line,#e8e8ee);stroke-width:1;stroke-linecap:round}',
      '.njb-arc svg .b{opacity:.45}',
      '.njb-p{position:absolute;transform:translate(-50%,-50%);border-radius:50%;',
      'display:flex;align-items:center;justify-content:center;background:var(--nt-bg,#fff)}',
      '.njb-p svg{position:static;width:52%;height:52%;stroke-width:2;stroke:currentColor;fill:none;',
      'stroke-linecap:round;stroke-linejoin:round}',
      '.njb-p img{width:74%;height:74%;object-fit:contain}',
      /* Fait : le vert de validation, celui des calendriers de l’app. */
      '.njb-p.ok{width:19px;height:19px;background:#34c759;color:#fff;',
      'box-shadow:0 1px 5px rgba(52,199,89,.38)}',
      /* Maintenant : pleine encre, l’illustration ou la photo du plat prévu. */
      '.njb-p.now{width:34px;height:34px;background:var(--nt-ink,#101014);',
      'color:var(--nt-on-ink,#fff);',
      'box-shadow:0 0 0 4px var(--nt-bg,#fff),0 3px 12px var(--nt-ombre,rgba(20,20,30,.22))}',
      /* À venir : un creux, avec DÉJÀ son illustration. */
      '.njb-p.next,.njb-p.miss{width:22px;height:22px;color:var(--nt-muted,#9a9aaa);',
      'box-shadow:inset 0 0 0 1.5px var(--nt-line,#e8e8ee)}',
      '.njb-p.miss{opacity:.5}',

      '.njb-e{font-size:15.5px;font-weight:800;letter-spacing:-.3px;color:var(--nt-ink,#101014);',
      'margin-top:2px}',
      '.njb-e span{color:var(--nt-muted,#9a9aaa);font-weight:600}'
    ].join('');
    document.head.appendChild(s);
  }

  /**
   * Monte l'en-tête dans `hote`, en première position.
   *
   * Ce n'est pas une carte de plus : c'est le guide lui-même, posé en fond
   * d'en-tête — date, arc de cercle, et l'étape du moment sous l'arc (demande
   * de Pablo, 9 août 2026). Sans étape à montrer, il ne monte RIEN : une ligne
   * vide en tête de page se lit comme un chargement qui a échoué.
   * @param {Element} hote
   */
  async function monterBandeau(hote) {
    if (!hote || !window.Natty || !Natty.USER_ID) return null;
    var d;
    try { d = await construire(); } catch (e) { return null; }
    if (!d.etapes.length) return null;

    cssBandeau();
    // ⚠️ Journée bouclée : AUCUN jalon « en cours ». `courante()` rend la
    // dernière étape faute de mieux, et l'en-tête posait donc une pastille
    // pleine « c'est maintenant » sur une étape déjà cochée.
    var etapes = d.etapes, h = hMaintenant();
    var fini = toutFait(etapes);
    var cur = fini ? -1 : courante(etapes);
    var faits = etapes.filter(function (e) { return e.fait; }).length;

    /* L'arc. Les jalons se répartissent sur la largeur, la hauteur donne la
       courbure — assez marquée pour qu'on lise un morceau de cercle, ce que la
       première version (34 px, presque plate) ne donnait pas.

       ⚠️ LE TRAIT EST ÉCHANTILLONNÉ SUR LA MÊME PARABOLE QUE LES PASTILLES.
       Une courbe de Bézier tracée de la première à la dernière ne passe PAS
       par les points du milieu : mesurée, elle coupait 3,4 px sous la pastille
       du moment, et les jalons avaient l'air posés à côté de leur propre fil. */
    var n = etapes.length;
    function courbeY(x) { var t = (x - 50) / 50; return 27 + t * t * 52; }
    var xs = etapes.map(function (e, i) { return n === 1 ? 50 : (8 + i * (84 / (n - 1))); });
    var trait = '', trait2 = '';
    for (var t = 6; t <= 94; t += 2) {
      trait += (trait ? 'L' : 'M') + t.toFixed(1) + ' ' + courbeY(t).toFixed(1);
      trait2 += (trait2 ? 'L' : 'M') + t.toFixed(1) + ' ' + (courbeY(t) + 13).toFixed(1);
    }

    var e0 = fini ? null : etapes[cur];

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'njb';
    b.setAttribute('aria-label', 'Ma journée');
    b.innerHTML = '<div class="njb-l"><div class="njb-d">' + jourEtDate() + '</div>'
      + '<div class="njb-n">' + faits + ' sur ' + n + '</div></div>'
      + '<div class="njb-arc"><svg viewBox="0 0 100 100" preserveAspectRatio="none">'
      + '<path d="' + trait + '"/><path class="b" d="' + trait2 + '"/></svg>'
      + etapes.map(function (e, i) {
          var role = (i === cur) ? 'now'
            : (e.fait ? 'ok' : (e.h < h - FENETRE_H ? 'miss' : 'next'));
          var dedans = role === 'ok'
            ? '<svg viewBox="0 0 24 24"><path d="M6 12.4 10.2 16.6 18 7.8"/></svg>'
            : figure(e);
          return '<span class="njb-p ' + role + '" style="left:' + xs[i].toFixed(1)
            + '%;top:' + courbeY(xs[i]).toFixed(1) + '%">' + dedans + '</span>';
        }).join('')
      + '</div>'
      + '<div class="njb-e">' + (fini
          ? 'Journée complète'
          : esc(e0.nom) + ' <span>· ' + esc(e0.libelle || libHeure(e0.h)) + '</span>')
      + '</div>';

    brancherPhoto(b, null);
    b.addEventListener('click', function () { ouvrir({ court: true }); });
    hote.insertBefore(b, hote.firstChild);
    return b;
  }

  return {
    ouvrir: ouvrir,
    fermer: fermer,
    monterBandeau: monterBandeau,
    proposerSiNecessaire: proposerSiNecessaire,
    /** Le déroulé calculé — pour vérifier, sans ouvrir quoi que ce soit. */
    etapes: async function () { return (await construire()).etapes; },
    courante: courante,
    libHeure: libHeure
  };
})();
