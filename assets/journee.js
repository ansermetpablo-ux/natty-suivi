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

  /* Le bilan du soir a-t-il été fait aujourd'hui ? On relit la MÊME clé que
     celle qu'écrit `assets/bilan.js` — pas une copie du nom : deux clés
     voisines donneraient une étape qui ne se coche jamais, ou qui se coche
     sans raison. Le module ne l'expose pas, la clé est le contrat. */
  function bilanFait() {
    try {
      var u = (window.Natty && Natty.USER_ID) || 'anon';
      return localStorage.getItem('natty_bilan_vu_' + u) === jourCourant();
    } catch (e) { return false; }
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
   * quand la planification en a une, SON illustration au trait sinon, et
   * seulement en dernier recours le pictogramme du créneau.
   *
   * Un plat reconnaissable vaut mieux qu'un pictogramme de repas : c'est la
   * différence entre « il y a un dîner » et « il y a CE dîner ».
   *
   * ⚠️ LE DEUXIÈME ÉTAGE MANQUAIT, et c'est ce qui rendait le premier presque
   * invisible. `planning.js` range DEUX visuels par repas — `photo` pour ce qui
   * est photographié, `illu` (le dessin de la forme du plat, `plats-illu.js`)
   * pour le reste — et le calendrier de `repas.html` s'en sert déjà. Ici on
   * jetait `illu` : un « Buddha bowl » prévu ce midi tombait sur l'icône du
   * créneau, exactement celle qu'affiche un midi où RIEN n'est prévu. Les deux
   * cas se ressemblaient donc trait pour trait — alors que le commentaire du
   * CSS de `.hero` annonçait déjà l'illustration comme repli.
   * Relevé sur la semaine réelle de Pablo (2026-08-15) : 3 des 6 repas sans
   * photo portaient une illustration qui n'était jamais dessinée.
   *
   * ⚠️ `illu` est injecté tel quel, comme dans `vignette()` de `planning.js` et
   * dans le hero de `repas.html` : c'est notre propre `<svg>`, produit par
   * `plats-illu.js` au moment de la planification. Sa taille et son trait
   * viennent du CSS (`.njsk .jal svg`, `.njsk .hero svg`), qui l'emporte sur le
   * `stroke-width` inline — sinon le trait de 1,2 se peindrait en 7,8 px dans
   * le hero de 156 px.
   */
  /* ⚠️ TROISIÈME ÉTAGE : LA CLÉ DU CATALOGUE.
     `photo` et `illu` sont un INSTANTANÉ pris au moment de la planification —
     ils valent ce que `visuelRecette()` savait rendre ce jour-là. Deux cas très
     ordinaires les laissent vides alors que le plat a bel et bien une image :
     une semaine planifiée avant que la génération n'ancre ses recettes au
     catalogue, et un repas posé autrement que par `placer()` (à la main, par
     l'admin, par SQL). Le guide retombait alors sur l'icône du créneau — celle
     qu'il affiche quand RIEN n'est prévu : « il y a un dîner » à la place de
     « il y a CE dîner », le défaut même que `figure()` était censé corriger.
     La `cle`, elle, ne périme pas. Toutes les pages qui montrent le guide
     chargent déjà `assets/decouverte.js` (vérifié : menu, suivi, repas et
     `www/index`), donc la résolution est toujours possible — et si le module
     manquait, on retombe simplement sur le comportement d'avant.
     La VIGNETTE (400 px) et non l'image pleine : la bulle fait 62 px, le plat
     du titre 156 px. C'est aussi ce que range `planning.js`. */
  function visuelPrevu(p) {
    if (!p) return null;
    if (p.photo) return { photo: p.photo };
    if (p.illu) return { illu: p.illu };
    if (!p.cle || !window.NattyDecouverte) return null;
    try {
      var plat = window.NattyDecouverte.platParCle(p.cle);
      if (!plat) return null;
      var ph = window.NattyDecouverte.vignette(plat);
      if (ph) return { photo: ph };
      var il = window.NattyDecouverte.illu(plat, { trait: 1.2 });
      if (il) return { illu: il };
    } catch (e) {}
    return null;
  }

  function figure(e) {
    var v = visuelPrevu((e && e.prevu) || null);
    if (v && v.photo) {
      return '<img src="' + esc(v.photo) + '" alt="" data-repli="' + esc(e.icone || 'midi') + '">';
    }
    if (v && v.illu) return v.illu;
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
         un cas de bord.

         ⚠️ MAIS SEULEMENT S'IL Y A QUELQUE CHOSE À SUIVRE. Le plan range deux
         sortes de repas : les recettes, qui portent leurs étapes dans `src`, et
         les plats macro, qui n'en ont pas (relevé sur la semaine réelle : les
         3 plats macro ont `src.steps` absent). Proposer « Suivre la recette »
         sur un skyr-banane, c'est promettre une préparation qui n'existe nulle
         part. Ces plats-là gardent « Ajouter mon plat » — on les note, on ne
         les cuisine pas — tout en affichant leur nom, qui reste utile. */
      var aPreparer = !!(prevu && prevu.src && (prevu.src.steps || []).length);
      if (prevu && deja === 0) {
        e.titre2 = prevu.nom;
      }
      if (aPreparer && deja === 0) {
        e.cta = 'Suivre la recette';
        e.sync = false;
        /* ⚠️ ON DIT LEQUEL, ET QU'ON VIENT CUISINER. Sans `?plat=` on
           atterrissait sur la PREMIÈRE recette de la semaine — celle du lundi,
           alors que le bouton venait d'annoncer le dîner du samedi. Le nom
           suffit à la désigner : c'est déjà la clé de rapprochement du
           calendrier de `repas.html`.
           `preparer=1` enchaîne sur la préparation elle-même (demande de
           Pablo, 2026-08-15). Sans lui, « Suivre la recette » s'arrêtait sur la
           FICHE du plat, et il fallait encore trouver « Démarrer » : le bouton
           annonçait un geste et en demandait un second.
           ⚠️ Le déclenchement se fait dans `repas.html` et non ici : c'est la
           SEULE page qui charge `assets/recette.js` (vérifié — ni `menu.html`,
           ni `suivi.html`, ni les trois autres écrans porteurs du guide).
           Appeler `NattyRecette` depuis le guide marcherait donc depuis Repas
           et nulle part ailleurs, c'est-à-dire presque jamais. */
        e.action = function () {
          marquerEtape(e.cle);
          Natty.goto('repas.html?plat=' + encodeURIComponent(prevu.nom || '') + '&preparer=1');
        };
      }

      /* ── Revenir sur un repas déjà noté ───────────────────
         Une étape cochée n'était plus qu'un point vert : on pouvait la revoir,
         pas la corriger. Or c'est précisément là qu'on s'aperçoit d'une erreur
         de quantité. Le repas est identifié par `NattyCreneaux.repas()` et
         l'édition s'ouvre dans `suivi.html?repas=<id>` — le même écran que
         l'historique, pas un second éditeur à tenir à jour.
         S'il y a plusieurs plats sur le créneau, c'est le plus récent : c'est
         celui qu'on vient d'ajouter, donc celui qu'on corrige. */
      var notes = (window.NattyCreneaux && NattyCreneaux.repas) ? NattyCreneaux.repas(c.cle) : [];
      if (notes.length) {
        e.notes = notes;
        e.revoir = {
          txt: notes.length > 1 ? 'Corriger un plat de ce repas' : 'Modifier ce repas',
          on: function () { Natty.goto('suivi.html?repas=' + encodeURIComponent(notes[0].id)); }
        };
        // Le nom de ce qui a été mangé, à la place de la recette prévue : sur
        // une étape faite, « Suivre la recette » n'a plus de sens.
        if (!e.titre2) e.titre2 = notes.map(function (r) { return r.nom; }).join(' + ');
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

    /* ── Le point du soir ─────────────────────────────────
       Il OUVRE le bilan (`assets/bilan.js`) plutôt que de renvoyer sur l'écran
       Suivi. L'étape s'appelle « le point du soir » : y répondre par « va
       regarder tes chiffres » laissait à l'utilisateur le travail de faire le
       point lui-même. Le bilan le fait — récap, trois questions, analyse,
       corps, progression.
       ⚠️ Repli sur `suivi.html` si le module n'est pas chargé : une étape dont
       le bouton ne mène nulle part est pire que l'ancienne destination. Et
       `fait` regarde ce que le bilan a enregistré (`natty_bilan_vu_<uid>`), pas
       l'onglet Suivi — ouvrir Suivi ne fait pas le point du soir. */
    var bilanDispo = !!(window.NattyBilan && NattyBilan.ouvrirJour);
    var etBilan = {
      cle: 'bilan', nom: 'Le point du soir', icone: 'bilan', h: H_BILAN,
      fait: bilanDispo ? bilanFait() : ongletVu('suivi'),
      cta: bilanDispo ? 'Faire mon bilan' : 'Voir mon suivi',
      action: function () {
        marquerEtape('bilan');
        if (bilanDispo) NattyBilan.ouvrirJour();
        else Natty.goto('suivi.html');
      }
    };
    /* Le récap se REVOIT. Le bilan du soir ne s'invite qu'une fois par jour
       (`natty_bilan_vu_<uid>`), et il n'y avait ensuite plus aucun chemin pour
       y revenir — le récap de la journée, les trois anneaux et l'analyse
       étaient perdus jusqu'au lendemain. `NattyBilan.ouvrirJour()` ne porte
       aucune garde de son côté : le rejouer est sans effet de bord. */
    if (bilanDispo) {
      etBilan.revoir = { txt: 'Revoir le récap', on: function () { NattyBilan.ouvrirJour(); } };
    }
    out.push(etBilan);

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
      /* ⚠️ UN PLEIN ÉCRAN QUI S'EFFACE EN OPACITÉ AVALE ENCORE LES TAPS.
         `fermer()` retire `.on` puis ne détache le nœud qu'à la fin du fondu : il
         reste plein écran, invisible et cliquable pendant 0,2 à 0,5 s. C'est la
         demi-seconde où « j'appuie et il ne se passe rien » (2026-08-25). */
      '#njour:not(.on){pointer-events:none}',
      '#njour *,.njb *{box-sizing:border-box}',
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
      '.njsk{--j-bg:#000;--j-ink:#fff;--j-mut:#8b8b95;--j-mut2:#6e6e78;',
      '--j-lueur1:rgba(255,255,255,.30);--j-lueur2:rgba(255,255,255,.13);',
      '--j-lueur3:rgba(255,255,255,.035);--j-halo:rgba(222,225,236,.16);',
      '--j-halo2:rgba(222,225,236,.05);--j-trait:rgba(255,255,255,.13);',
      '--j-trait2:rgba(255,255,255,.055);--j-creux:#0a0a0c;--j-relief:#17181c;',
      '--j-vif:#fff;--j-sur-vif:#0a0a0c;--j-anneau:rgba(255,255,255,.16);',
      '--j-ombre:rgba(0,0,0,.7);--j-reflet:rgba(255,255,255,.055);',
      '--j-contour:rgba(255,255,255,.07);--j-fermer:rgba(255,255,255,.07)}',
      /* Clair — le noir devient blanc, la lueur devient une ombre douce, et la
         pastille du moment s'inverse : encre pleine sur fond clair. */
      ':root[data-theme="light"] .njsk{--j-bg:#fff;--j-ink:#101014;--j-mut:#8a8a95;',
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
         ⚠️⚠️ `justify-content:flex-start`, ET C'EST LA CORRECTION DU FAUX
         RACCORD PRINCIPAL. En `center`, le groupe arc + texte se centrait dans
         la place disponible — donc l'arc se déplaçait à CHAQUE scène, puisque
         le bloc de texte sous lui n'a pas la même hauteur d'une scène à
         l'autre : rien au « bonjour », rien du tout sur la scène de l'arc,
         puis ~260 px avec le jour, l'étape et le plat. Mesuré à 375 × 812 :
         **105 px d'écart entre la première scène et la dernière**. L'arc est
         le fil de la séquence, c'est précisément l'élément qui ne doit jamais
         bouger. Il est donc posé à une hauteur fixe, et c'est le VIDE qui
         descend en bas quand la scène est courte.
         (Le défaut d'origine — « arc collé au bord haut, moitié d'écran vide
         en dessous » — est réglé par la marge haute de `.arc`, pas par un
         centrage qui dépend du contenu.) */
      '#njour .col{position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:flex-start;',
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
      /* ⚠️ POSER LES JALONS SANS TRANSITION AU MONTAGE. Ils naissent sans
         position inline, donc empilés au coin haut-gauche du cadre ; la
         première `peindreArc()` les faisait alors VOLER depuis ce coin, en
         même temps que l'arc apparaissait en fondu. On voyait six pastilles
         partir d'un point et se déployer — un mouvement que rien dans la
         séquence ne raconte. `.pose` coupe les transitions le temps de les
         placer ; seuls les déplacements VOULUS s'animent ensuite. */
      '.njsk .arc.pose .jal{transition:none}',

      /* ── L'arc ──────────────────────────────────────────────
         Les jalons sont des éléments HTML posés sur le cercle, pas des formes
         SVG : c'est la seule façon d'avoir un vrai neumorphisme (reliefs et
         creux) et un texte net sous chacun. Le trait du cercle, lui, reste en
         SVG derrière. */
      /* La marge haute remplace l'ancien centrage : elle pose l'arc à une
         hauteur FIXE, la même sur les quatre scènes. C'est elle qu'on règle si
         la composition paraît trop haute ou trop basse — jamais le centrage,
         qui dépendrait du contenu et ferait bouger l'arc d'une scène à l'autre. */
      '.njsk .arc{position:relative;width:360px;height:224px;flex-shrink:0;',
      'margin:64px 0 0}',
      // Dans le bandeau, la marge n'a pas lieu d'être : il est déjà cadré.
      '.njb .arc{margin-top:6px}',
      /* ⚠️ LE TRAIT DE L'ORBITE DOIT S'ÉTEINDRE, PAS ÊTRE COUPÉ. Le cercle qui
         porte les jalons a un rayon de 230 px : ses extrémités descendent bien
         en dessous du cadre de l'arc et venaient barrer le grand titre (mesuré
         à 375 px — la courbe traversait « Petit déjeuner »). Un `overflow:hidden`
         l'aurait tranché net, ce qui se voit encore plus. Le masque le fait
         disparaître en s'éloignant du sommet ; là où il n'est pas géré, on
         retrouve simplement le trait entier, ce qui reste lisible. */
      '.njsk .arc svg.orbite{position:absolute;inset:0;width:100%;height:100%;',
      'overflow:visible;fill:none;stroke-linecap:round;',
      '-webkit-mask-image:radial-gradient(62% 78% at 41% 48%,#000 38%,rgba(0,0,0,.35) 72%,transparent 100%);',
      'mask-image:radial-gradient(62% 78% at 41% 48%,#000 38%,rgba(0,0,0,.35) 72%,transparent 100%)}',
      /* ⚠️ LE TRACÉ NE PART QU'UNE FOIS L'ARC VISIBLE. Déclenché au montage, il
         se jouait entièrement pendant la scène « bonjour », où l'arc est encore
         à `opacity:0` : on payait une animation de 1,6 s que personne ne voyait,
         et l'arc apparaissait ensuite déjà tracé. D'où deux règles — le
         plein écran attend `.arcvu`, le bandeau trace dès qu'il est posé. */
      '.njsk .arc svg.orbite path{stroke:var(--j-trait);stroke-width:1;',
      'stroke-dasharray:900;stroke-dashoffset:900}',
      '#njour.arcvu .arc svg.orbite path,.njb .arc svg.orbite path{',
      'animation:njTrace 1.6s cubic-bezier(.22,1,.36,1) forwards}',
      '.njsk .arc svg.orbite path.b{stroke:var(--j-trait2);animation-delay:.16s}',
      '.njsk .arc svg.orbite path.c{stroke:var(--j-trait2);animation-delay:.3s;opacity:.6}',
      '@keyframes njTrace{to{stroke-dashoffset:0}}',

      '.njsk .jal{position:absolute;border-radius:50%;display:flex;align-items:center;',
      'justify-content:center;transform:translate(-50%,-50%);',
      'transition:left .95s cubic-bezier(.22,1,.36,1),top .95s cubic-bezier(.22,1,.36,1),',
      'width .95s cubic-bezier(.22,1,.36,1),height .95s cubic-bezier(.22,1,.36,1),',
      'opacity .7s ease,background .5s ease,box-shadow .7s ease}',
      '.njsk .jal svg{width:46%;height:46%;fill:none;stroke:currentColor;stroke-width:1.9;',
      'stroke-linecap:round;stroke-linejoin:round}',
      /* Les jalons du PLEIN ÉCRAN se touchent pour y aller (§7 bis) : d'où le
         curseur, et un enfoncement qui répond au doigt. Le bandeau, lui, garde
         ses `pointer-events:none` internes — il n'a qu'une zone de tap, la
         sienne. `touch-action:pan-y` laisse passer le défilement vertical de la
         colonne tout en gardant le glissement horizontal pour nous. */
      '#njour .jal{cursor:pointer;touch-action:pan-y}',
      '#njour .jal:active{filter:brightness(1.08)}',

      /* ── Le barillet ────────────────────────────────────────
         Le jalon du moment ne se contente pas de s'allumer : son icône ARRIVE,
         comme le cran d'un sélecteur iOS qui se cale. Deux icônes empilées dans
         une fenêtre qui les rogne — celle d'avant, puis la sienne — et la
         courbe d'accélération dépasse légèrement avant de revenir : c'est ce
         petit dépassement qui fait « cran », un simple fondu ne le donne pas.
         ⚠️ La fenêtre est un élément INTERNE (`.ic`) : rogner sur `.jal` même
         emporterait l'anneau de pulsation, qui déborde volontairement. */
      '.njsk .jal .ic{position:absolute;inset:0;border-radius:50%;overflow:hidden;',
      'display:flex;align-items:center;justify-content:center}',
      '.njsk .jal .rou{position:absolute;left:0;right:0;top:0;height:200%;',
      'display:flex;flex-direction:column}',
      '.njsk .jal .rou > *{height:50%;display:flex;align-items:center;justify-content:center}',
      /* ⚠️ LE SENS. `.rou` fait 200 % de haut, ses deux cases 50 % chacune : à
         `translateY(0)` c'est la case du HAUT — l'étape précédente — qu'on voit
         dans la fenêtre. Le barillet part donc de 0 et roule vers −50 %.
         L'inverse avait été écrit, et le résultat était visible sur la capture
         de Pablo : la bulle du dîner affichait la coche du déjeuner, c'est-à-
         dire qu'elle finissait sur l'étape d'avant. */
      '.njsk .jal.actif .rou{animation:njBarillet .82s cubic-bezier(.2,1.24,.32,1) both}',
      '@keyframes njBarillet{from{transform:translateY(0)}to{transform:translateY(-50%)}}',

      /* ── La validation ──────────────────────────────────────
         Le V vert d'Apple : l'anneau se dessine, puis la coche. Deux tracés
         décalés — un seul trait continu ne se lit pas comme une validation.
         Même recette que `.vok` d'`assets/planning.js`, en petit. */
      '.njsk .jal .vok{width:100%;height:100%;stroke-width:2.4}',
      '.njsk .jal .vok .rd{stroke:#34c759;stroke-dasharray:64;stroke-dashoffset:64;',
      'animation:njTrace .52s cubic-bezier(.22,1,.36,1) forwards}',
      '.njsk .jal .vok .ck{stroke:#34c759;stroke-dasharray:20;stroke-dashoffset:20;',
      'animation:njTrace .34s cubic-bezier(.22,1,.36,1) .34s forwards}',

      /* À venir — un creux neumorphique, qui porte DÉJÀ l'illustration de son
         étape. Le « + » de la maquette d'origine ne disait rien de ce qui
         vient ; l'icône, si — on voit sa journée, pas une file d'attente. */
      '.njsk .jal.futur{background:var(--j-creux);color:var(--j-mut);',
      'box-shadow:inset 1.5px 1.5px 4px var(--j-ombre),',
      'inset -1px -1px 3px var(--j-reflet),0 0 0 1px var(--j-contour)}',
      /* Fait — relief plein, mais discret : c'est derrière soi. */
      '.njsk .jal.passe{background:var(--j-relief);color:var(--j-mut);',
      'box-shadow:inset 0 1px 0 var(--j-reflet),0 3px 10px var(--j-ombre)}',
      /* Manqué — ni creux ni relief : un contour seul. Le montrer sans le
         cocher est plus honnête que de l'effacer. */
      '.njsk .jal.manque{background:var(--j-creux);color:var(--j-mut2);',
      'box-shadow:0 0 0 1px var(--j-trait)}',
      /* ⚠️ La PHOTO d'un repas manqué doit s'éteindre elle aussi. Les jetons de
         couleur ne l'atteignent pas : le jalon passait en contour gris pendant
         que le plat gardait ses couleurs pleines, donc le repas le plus
         appétissant de l'arc était justement celui qu'on n'avait pas noté. */
      '.njsk .jal.manque img{filter:grayscale(1) brightness(.72);opacity:.75}',
      /* Maintenant — la pastille pleine de la maquette, sa lueur comprise. */
      '.njsk .jal.actif{background:var(--j-vif);color:var(--j-sur-vif);',
      'box-shadow:0 0 44px var(--j-lueur1),0 0 0 1px var(--j-vif),',
      'inset 0 -2px 4px rgba(140,142,152,.28),inset 0 2px 3px var(--j-reflet)}',
      '.njsk .jal.actif::after{content:"";position:absolute;inset:-14px;border-radius:50%;',
      'border:1px solid var(--j-anneau);animation:njPulse 3.4s ease-in-out infinite}',
      '@keyframes njPulse{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.13);opacity:0}}',

      /* La photo du plat prévu, quand il y en a une : le sujet est détouré sur
         fond transparent, donc `contain` et jamais `cover` — un plat rogné aux
         bords dans une pastille de 62 px ne se reconnaît plus. */
      '.njsk .jal img{width:74%;height:74%;object-fit:contain;display:block}',

      '.njsk .jal .h{position:absolute;top:calc(100% + 7px);left:50%;transform:translateX(-50%);',
      'font-size:9.5px;font-weight:700;letter-spacing:.4px;white-space:nowrap;',
      'color:var(--j-mut2)}',
      '.njsk .jal.actif .h{font-size:10.5px;color:var(--j-ink);top:calc(100% + 10px)}',

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
      /* ⚠️ 12 px et non 22 : depuis que le PLAT s'affiche sous le titre, c'est
         lui qui occupe le bas de la scène. Le titre remonte donc vers l'arc,
         dont il est le commentaire — « Dîner » sous la bulle du dîner. */
      '.njsk .zone{flex:1 1 auto;width:100%;max-width:420px;margin-top:12px;',
      'position:relative;display:flex;flex-direction:column;justify-content:flex-start}',
      '#njour .bloc{width:100%}',
      /* ⚠️ LE BLOC SORTANT NE DOIT PAS BOUGER EN SORTANT. Il passait en
         `bottom:0` + `justify-content:center` : à l'instant précis où la
         sortie commençait, son contenu SAUTAIT au milieu de la zone avant de
         s'effacer — un faux raccord à chaque changement de scène, et le plus
         visible de tous puisqu'il se produit quatre fois. Épinglé en haut, il
         reste exactement là où il était et se contente de partir. */
      '#njour .bloc.sort{position:absolute;left:0;right:0;top:0;pointer-events:none}',
      /* ⚠️ QUATRE ÉLÉMENTS DE TEXTE EN TOUT, ET PAS UN DE PLUS. La première
         version empilait libellé d'heure, titre, « étape 2 sur 5 », une phrase
         explicative, trois pastilles de macros, un filet, une devise et le
         récapitulatif écrit de la journée : neuf blocs pour une décision qui en
         demande une. Ne restent que le jour, la date, l'étape et le bouton —
         les macros et le détail se lisent sur l'écran Suivi, qui est fait pour
         ça. Les règles `.kick` / `.sous` servent encore, en tout petit. */
      '.njsk .kick{font-size:12.5px;font-weight:600;color:var(--j-mut);letter-spacing:.2px}',
      '.njsk .kick b{color:var(--j-ink);font-weight:700}',
      '.njsk h1{font-size:44px;font-weight:900;letter-spacing:-1.8px;line-height:1.04;',
      'margin:12px 0 0}',
      '.njsk h1 span{display:inline-block;opacity:0;',
      'animation:njGlide .68s cubic-bezier(.22,1,.36,1) forwards}',
      '.njsk h1.p{font-size:34px;letter-spacing:-1.2px}',
      '.njsk .sous{font-size:14px;color:var(--j-mut);line-height:1.5;margin-top:12px;',
      'max-width:320px;margin-left:auto;margin-right:auto}',

      /* ── Le plat, en grand, sous le titre ───────────────────
         La photo détourée du repas prévu, ou son illustration au trait quand
         il n'y en a pas. C'est la même figure que dans la bulle de l'arc, mais
         lisible : dans une pastille de 62 px on devine un plat, ici on le
         reconnaît. Demande de Pablo, 9 août 2026.
         ⚠️ `contain`, jamais `cover` : le sujet est détouré, un plat rogné aux
         bords ne se reconnaît plus (même règle que `.jal img`). */
      '.njsk .hero{width:156px;height:156px;margin:18px auto 0;display:flex;',
      'align-items:center;justify-content:center;color:var(--j-ink);position:relative}',
      /* ⚠️ Le trait s'affine à mesure que l'illustration grandit : la boîte fait
         24 unités, donc à 156 px un `stroke-width:1` se peint en 6,5 px — un
         gros feutre, là où l'arc trace des filets de 2 px. 0,5 rend ~3 px. */
      '.njsk .hero svg{width:100%;height:100%;fill:none;stroke:currentColor;',
      'stroke-width:.5;stroke-linecap:round;stroke-linejoin:round;opacity:.9}',
      // Journée bouclée : la coche reprend le vert des validations de l'arc,
      // sinon c'est un grand V noir qui ne dit pas qu'il valide quelque chose.
      '.njsk .hero.ok{color:#34c759}',
      '.njsk .hero img{width:100%;height:100%;object-fit:contain;display:block;',
      'filter:drop-shadow(0 18px 40px var(--j-ombre))}',
      /* Une lueur derrière, comme celle qui tient l'arc : sans elle, un plat
         détouré posé sur du noir a l'air découpé et collé.
         ⚠️ Elle est le FOND de `.hero`, pas un `::before` : un pseudo-élément
         positionné se peint AU-DESSUS du contenu non positionné (donc par-dessus
         la photo), et le renvoyer derrière par `z-index:-1` le ferait passer
         sous le fond de l'écran, où il ne se verrait plus du tout. */
      '.njsk .hero{background:radial-gradient(50% 50% at 50% 50%,',
      'var(--j-lueur2) 0%,var(--j-lueur3) 48%,transparent 72%)}',

      /* ── Entrées ────────────────────────────────────────────
         Jamais de flou sur du texte : la règle vient de `narration.html` et
         vaut pour toutes les cinématiques de l'app. */
      '@keyframes njGlide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
      '.njsk [data-in]{opacity:0;animation-duration:.72s;',
      'animation-timing-function:cubic-bezier(.22,1,.36,1);animation-fill-mode:forwards}',
      '.njsk [data-in="glide"]{animation-name:njGlide}',
      '#njour .bloc.sort{animation:njSort .34s cubic-bezier(.4,0,1,1) forwards}',
      '@keyframes njSort{to{opacity:0;transform:translateY(-12px)}}',

      /* ── La barre d'action ──────────────────────────────────
         Fixe, hors du bloc animé. Leçon de `narration.html` : un bouton posé
         dans la scène part avec son animation de sortie et disparaît sous le
         doigt. */
      /* ⚠️ `min-height` CONSTANTE, et les boutons calés en bas. Sans elle, la
         barre ne mesurait que ses marges tant qu'elle était vide (scènes 1 et
         2) puis passait d'un coup à ~140 px : le voile qui referme le bas de
         l'écran grandissait brutalement à l'arrivée des boutons. La hauteur
         réservée est la même que celle du bas de `.col` — les deux décrivent
         la même chose. */
      '#njCta{position:absolute;left:0;right:0;bottom:0;z-index:6;',
      'min-height:calc(146px + env(safe-area-inset-bottom,0px));',
      'padding:14px 22px calc(20px + env(safe-area-inset-bottom,0px));display:flex;',
      'flex-direction:column;justify-content:flex-end;gap:9px;align-items:stretch;',
      'pointer-events:none;background:linear-gradient(to top,var(--j-bg) 60%,transparent)}',
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
    // ⚠️ `njsk` porte les jetons ET tout ce qui fait le style de cet écran
    // (l'arc, les jalons, la typographie, le plat). Le bandeau de `menu.html`
    // porte la MÊME classe : c'est ce qui garantit qu'il n'y a pas deux
    // présentations à tenir à jour, donc pas de divergence possible.
    racine.className = 'njsk';
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
    // ⚠️ Le listener clavier vit sur `document`, pas sur la racine : il ne part
    // donc PAS avec elle. Sans ce retrait, les flèches continueraient d'appeler
    // `allerEtape` sur un écran fermé — et chaque ouverture en empilerait un.
    document.removeEventListener('keydown', touche);
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

  /** Le HTML de l'arc — le même pour le plein écran et pour le bandeau. */
  function htmlArc(etapes, id) {
    // Trois orbites concentriques plutôt qu'une : c'est ce qui donne à
    // l'inspiration sa profondeur — un fil porteur, et deux échos autour.
    var h = '<div class="arc"' + (id ? ' id="' + id + '"' : '')
      + '><svg class="orbite" viewBox="0 0 360 224" preserveAspectRatio="none">'
      + '<path d="' + cheminOrbite(R) + '"/>'
      + '<path class="b" d="' + cheminOrbite(R - 16) + '"/>'
      + '<path class="c" d="' + cheminOrbite(R + 22) + '"/></svg>';
    etapes.forEach(function (e, i) {
      h += '<div class="jal" data-i="' + i + '"><span class="ic"></span>'
        + '<span class="h">' + esc(e.libelle || libHeure(e.h)) + '</span></div>';
    });
    return h + '</div>';
  }

  /**
   * Pose l'arc, jalons DÉJÀ placés autour de `cur`, sans animation.
   *
   * ⚠️ Le placement initial ne doit pas s'animer. Sans position inline, les
   * jalons naissent empilés au coin haut-gauche du cadre ; la première
   * `peindreArc()` les faisait donc voler depuis ce coin. `.pose` coupe les
   * transitions, on force le calcul du style, puis on les rend — à partir de
   * là, seul un vrai changement d'étape déplace quelque chose.
   */
  function monterArc(hote, cur) {
    hote.insertAdjacentHTML('beforeend', htmlArc(etat.etapes, 'njArc'));
    arcEl = hote.querySelector('#njArc');
    arcEl.classList.add('pose');
    peindreArc(cur || 0);
    void arcEl.offsetHeight;   // fige l'état posé avant de rendre les transitions
    arcEl.classList.remove('pose');
    brancherParcours();        // l'arc devient parcourable (§7 bis)
  }

  /**
   * Repositionne les jalons autour de l'indice `cur`.
   * Les transitions CSS font le reste : appeler cette fonction deux fois, une
   * au début de la journée puis une sur l'étape du moment, DONNE l'animation
   * de défilement — c'est le seul endroit où la journée « se déroule ».
   */
  function peindreArc(cur) { peindreArcDans(arcEl, etat && etat.etapes, cur); }

  function peindreArcDans(arcEl, etapes, cur, sansActif) {
    if (!arcEl || !etapes) return;
    var h = hMaintenant();
    arcEl.querySelectorAll('.jal').forEach(function (el) {
      var i = +el.getAttribute('data-i'), e = etapes[i], d = i - cur;
      if (Math.abs(d) > VISIBLES) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
      var p = pos(d), ad = Math.min(Math.abs(d), VISIBLES);
      var taille = [62, 42, 33, 26][ad];
      var opac = [1, .62, .42, .24][ad];

      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.style.width = taille + 'px';
      el.style.height = taille + 'px';
      el.style.opacity = Math.abs(d) > VISIBLES ? 0 : opac;

      var role = (i === cur && !sansActif) ? 'actif'
        : (e.fait ? 'passe' : (e.h < h - FENETRE_H ? 'manque' : 'futur'));
      el.className = 'jal ' + role;

      /* ⚠️ LE CONTENU N'EST RÉÉCRIT QUE SI LE RÔLE A CHANGÉ. `peindreArc` est
         appelée à chaque scène ; réécrire à chaque fois relançait le tracé du
         V vert et le cran du barillet — donc une validation qui se rejoue
         indéfiniment, ce qui la vide de son sens. Une animation ne doit se
         jouer qu'au moment où la chose qu'elle raconte arrive.
         L'état `fait` entre dans la signature depuis qu'un jalon sélectionné
         peut être déjà coché : deux contenus différents pour un même rôle, donc
         le rôle seul ne suffit plus à décider s'il faut repeindre. */
      var signature = role + (e.fait ? '+ok' : '');
      if (el.getAttribute('data-role') !== signature) {
        el.setAttribute('data-role', signature);
        var ic = el.querySelector('.ic');
        if (role === 'actif' && e.fait) {
          /* ⚠️ SÉLECTIONNÉ N'EST PAS « À FAIRE ». Depuis qu'on peut parcourir
             l'arc (§7 bis), le jalon mis en avant peut être une étape DÉJÀ
             faite : le barillet lui aurait retiré sa coche verte pour la
             remplacer par son illustration, c'est-à-dire annoncer « c'est
             maintenant » sur quelque chose de terminé. La pastille pleine dit
             la sélection, la coche dit l'état — les deux tiennent ensemble. */
          ic.innerHTML = '<svg class="vok" viewBox="0 0 24 24">'
            + '<circle class="rd" cx="12" cy="12" r="10.2"/>'
            + '<path class="ck" d="M7.4 12.3 10.6 15.6 16.8 8.8"/></svg>';
        } else if (role === 'actif') {
          // Le barillet : l'illustration précédente, puis la sienne, dans une
          // fenêtre qui les rogne. C'est ce cran qui montre « on y est ».
          var avant = etapes[i - 1];
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
      if (hh) hh.style.display = (i === cur && !sansActif) ? '' : 'none';
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

    /* ⚠️ LA PLACE RÉSERVÉE EN BAS NE REDESCEND JAMAIS. Elle est mesurée parce
       qu'une barre à trois boutons monte à ~200 px et mangerait la dernière
       ligne du texte. Mais l'écrire à chaque scène la faisait aussi RÉDUIRE
       sur les scènes sans bouton (14 px au lieu de 146) : combinée à l'ancien
       centrage, c'est ce qui faisait remonter puis redescendre toute la
       composition entre deux plans. On ne l'augmente donc que si le contenu
       réel l'exige, et jamais dans l'autre sens. */
    var col = racine.querySelector('#njCol');
    requestAnimationFrame(function () {
      if (!col || !cta) return;
      // Ce qu'il faut dégager, c'est le PREMIER BOUTON, pas la barre entière :
      // son tiers supérieur est un dégradé transparent, et réserver aussi
      // cette hauteur-là coûtait 18 px de texte pour rien.
      var b1 = cta.firstElementChild;
      if (!b1) return;
      var voulu = (cta.offsetHeight - b1.offsetTop) + 14;
      var actuel = parseFloat(getComputedStyle(col).paddingBottom) || 0;
      if (voulu > actuel) col.style.paddingBottom = Math.round(voulu) + 'px';
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
    if (etat.vue == null) etat.vue = etat.cur;
    peindreArc(etat.vue);
    // Journée bouclée : on l'annonce, mais on laisse l'arc parcourable — c'est
    // justement le moment où l'on veut revoir ce qu'on a fait.
    if (toutFait(etat.etapes) && etat.vue === etat.cur) return scBoucle();

    var e = etat.etapes[etat.vue];
    var ailleurs = etat.vue !== etat.cur;

    /* Le fil de contexte. Sur l'étape du moment, c'est le jour et la date,
       comme avant. Sur une étape qu'on est allé chercher, c'est SON heure et son
       état : sans ça, rien à l'écran ne distinguait « voici ton dîner » de
       « voici ton petit déjeuner de ce matin, déjà noté ». */
    var contexte = ailleurs
      ? '<b>' + esc(libHeure(e.h)) + '</b> · ' + (e.fait ? 'déjà fait' : 'à faire')
      : jourEtDate();

    var html = '<div class="kick" data-in="glide">' + contexte + '</div>'
      // Au-delà d'une douzaine de caractères, le grand corps touche les deux
      // bords à 375 px : « Petit déjeuner » y passe en corps intermédiaire.
      + titre(e.nom, e.nom.length > 11 ? 'p' : '', 0.1)
      // Le nom de la recette est la seule ligne conservée : sans elle,
      // « Déjeuner » + « Suivre la recette » ne dit pas LAQUELLE.
      + (e.titre2 ? '<div class="sous" data-in="glide" style="animation-delay:.5s">'
          + esc(e.titre2) + '</div>' : '')
      // Le plat, en grand. La bulle de l'arc dit QUAND, celle-ci dit QUOI.
      + '<div class="hero' + (e.fait && !e.notes ? ' ok' : '') + '" data-in="glide" '
      + 'style="animation-delay:' + (e.titre2 ? '.62' : '.5') + 's">'
      + (e.fait && !e.notes ? icone('coche') : figure(e)) + '</div>';

    /* ── Les boutons ─────────────────────────────────────────
       Une étape FAITE ne doit pas proposer de la refaire en premier : on ne
       note pas deux fois le même déjeuner. C'est `revoir` qui prend la tête —
       corriger le repas, ou rouvrir le récap du soir — et l'action d'origine
       reste dessous, parce qu'un second plat au même créneau est légitime. */
    var boutons = [];
    if (e.fait && e.revoir) {
      boutons.push({ txt: e.revoir.txt, cls: 'b1',
        on: function () { marquerLong(); envol(e.revoir.on); } });
      boutons.push({ txt: e.cta, cls: 'b2',
        on: function () { marquerLong(); envol(e.action, e.sync); } });
    } else {
      boutons.push({ txt: e.cta, cls: 'b1',
        on: function () { marquerLong(); envol(e.action, e.sync); } });
      if (e.revoir) {
        boutons.push({ txt: e.revoir.txt, cls: 'b2',
          on: function () { marquerLong(); envol(e.revoir.on); } });
      }
    }
    boutons.push(ailleurs
      // Revenir au présent plutôt que fermer : on est parti explorer son arc,
      // la sortie naturelle est de rentrer, pas de quitter l'écran.
      ? { txt: '↩ Revenir à maintenant', cls: 'b3', on: function () { allerEtape(etat.cur); } }
      : { txt: 'Plus tard', cls: 'b3', on: function () { marquerLong(); fermer(); } });

    bloc({ html: html, pret: function (d) { brancherPhoto(d, e); }, boutons: boutons });
  }

  /* ═══ 7 bis. Parcourir sa journée ════════════════════════
     LE GESTE QUI MANQUAIT (demande de Pablo, 13 août 2026 : « pouvoir roll les
     étapes pour y revenir et les modifier »). L'arc racontait la journée mais
     ne s'explorait pas : seule l'étape du moment était atteignable, et une
     étape passée n'était plus qu'un point vert.

     Trois façons d'y aller, parce qu'aucune ne se devine seule : toucher un
     jalon, faire glisser l'arc, ou les flèches du clavier (le guide s'ouvre
     aussi sur ordinateur). Le sens du glissement suit celui de l'arc — la
     journée avance vers la gauche, donc glisser vers la gauche avance. */

  function allerEtape(i) {
    if (!etat || !racine) return;
    var n = etat.etapes.length;
    if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    if (i === etat.vue) return;
    etat.vue = i;
    // La scène est reconstruite, l'arc se déplace : les transitions CSS des
    // jalons font le mouvement, il n'y a rien à animer à la main.
    scEtape();
  }

  function brancherParcours() {
    if (!arcEl) return;

    // Un jalon = un point d'entrée. Ceux qui sont hors de la fenêtre visible
    // ont déjà `pointer-events:none` (voir `peindreArcDans`).
    arcEl.addEventListener('click', function (ev) {
      var j = ev.target.closest ? ev.target.closest('.jal') : null;
      if (!j || !arcEl.contains(j)) return;
      var i = +j.getAttribute('data-i');
      if (!isNaN(i)) allerEtape(i);
    });

    /* Le glissement. Un seuil de 28 px, et l'axe le plus marqué gagne : sans
       ça, un défilement vertical de la colonne (le contenu peut déborder sur
       petit écran) déclencherait un changement d'étape en travers. */
    var x0 = null, y0 = null;
    arcEl.addEventListener('pointerdown', function (ev) { x0 = ev.clientX; y0 = ev.clientY; });
    arcEl.addEventListener('pointerup', function (ev) {
      if (x0 == null) return;
      var dx = ev.clientX - x0, dy = ev.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(dy)) return;
      allerEtape(etat.vue + (dx < 0 ? 1 : -1));
    });
    arcEl.addEventListener('pointercancel', function () { x0 = null; });

    document.addEventListener('keydown', touche);
  }

  function touche(ev) {
    if (!racine || !etat) return;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); allerEtape(etat.vue - 1); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); allerEtape(etat.vue + 1); }
    else if (ev.key === 'Escape') { marquerLong(); fermer(); }
  }

  /* Scène 3 bis — tout est fait. Ce n'est pas un cas particulier à bâcler :
     c'est le seul moment où l'app peut dire « il n'y a rien à faire », et le
     dire clairement vaut mieux que de resservir une étape déjà cochée. */
  function scBoucle() {
    /* Le récap du soir depuis la journée bouclée : c'est là qu'on le cherche.
       Il vit sur l'étape « point du soir », on va donc lire SON action plutôt
       que d'en écrire une seconde — deux chemins vers le même bilan finiraient
       par ne plus ouvrir la même chose. */
    var bil = etat.etapes.filter(function (x) { return x.cle === 'bilan' && x.revoir; })[0];
    var boutons = [];
    if (bil) {
      boutons.push({ txt: bil.revoir.txt, cls: 'b1',
        on: function () { marquerLong(); envol(bil.revoir.on); } });
      boutons.push({ txt: 'Voir mon suivi', cls: 'b2',
        on: function () { marquerLong(); envol(function () { Natty.goto('suivi.html'); }); } });
    } else {
      boutons.push({ txt: 'Voir mon suivi', cls: 'b1',
        on: function () { marquerLong(); envol(function () { Natty.goto('suivi.html'); }); } });
    }
    boutons.push({ txt: 'Fermer', cls: 'b3', on: function () { marquerLong(); fermer(); } });

    bloc({
      html: '<div class="kick" data-in="glide">' + jourEtDate() + '</div>'
        + titre('Journée complète', 'p', 0.1)
        + '<div class="hero ok" data-in="glide" style="animation-delay:.5s">'
        + icone('coche') + '</div>'
        // Le geste ne se devine pas : on le dit une fois, en petit.
        + '<div class="sous" data-in="glide" style="animation-delay:.7s">'
        + 'Touchez une étape de l’arc pour la revoir ou la corriger.</div>',
      boutons: boutons
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
    // `cur` est l'étape du MOMENT et ne bouge plus ; `vue` est celle qu'on
    // regarde, et c'est elle que le parcours déplace (§7 bis). Les confondre
    // ferait perdre le chemin du retour vers « maintenant ».
    etat.vue = etat.cur;

    monter();
    // L'arc est posé d'emblée à l'endroit d'où il PART : sur l'étape du moment
    // pour la version courte, sur la première pour la longue — que la scène 2
    // fera ensuite défiler jusqu'au moment présent.
    monterArc(racine.querySelector('#njCol'), etat.court ? etat.cur : 0);
    monterZone();

    if (etat.court) {
      // Version courte : l'arc est là dès la première image, déjà calé sur le
      // moment. Pas de bonjour, pas de déroulé — on vient noter un repas.
      racine.classList.add('arcvu');
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
      /* ⚠️ UN SEUL TEST, ET IL VIT DANS `assets/core.js`. Cette garde énumérait
         `#nplan`, `#nattyAjout` et `#nrCine` à la main — elle ignorait donc la
         question du matériel et celle du garde-manger, toutes deux posées AVANT
         que la génération ne pose son marqueur : le guide s'ouvrait par-dessus,
         le tap partait dans le mauvais écran, et il fallait recommencer.
         Elle testait aussi `#nattyAjout` par sa présence, alors que le module le
         construit une fois et le réutilise : dès le premier plat ajouté, le
         guide ne se proposait plus de la journée. */
      if (Natty.ecranOccupe()) return;
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
     LE MÊME ÉCRAN, EN PLUS PETIT. Pas une variante, pas une « ligne de statut »
     dessinée à part : exactement la composition du guide — l'arc et ses jalons,
     le jour et la date, le nom de l'étape, le plat en dessous — réduite d'un
     coup par une seule mise à l'échelle. (Demande de Pablo, 9 août 2026 :
     « garder exactement la même présentation, il ne doit pas y avoir de
     différence de style ».)

     ⚠️ ET C'EST POUR ÇA QUE C'EST UNE ÉCHELLE, ET NON DES TAILLES REFAITES.
     La version précédente redessinait tout en petit — arc plat de 78 px, points
     de 19 à 34 px, date à gauche et compteur à droite, titre en 15,5 px : deux
     présentations à tenir à jour, donc deux qui divergent. Ici le bandeau porte
     la classe `njsk`, celle qui définit le style du guide, et `--njb-k` est le
     SEUL réglage. Toucher au guide retouche le bandeau, forcément.

     Il vit dans le thème courant sans rien faire de particulier : les jetons
     `--j-*` ont déjà leur pendant clair (`:root[data-theme="light"] .njsk`). */

  /* L'échelle du bandeau. `K_MAX` est la taille de confort — celle qu'il garde
     dès que l'écran a la place. `K_MIN` est le plancher en dessous duquel le
     texte cesse d'être lisible.

     ⚠️ L'ÉCHELLE S'ADAPTE À LA PLACE QUI RESTE, elle n'est plus fixe. Demande
     de Pablo : « pour le menu, tous les éléments doivent être accessibles sans
     scroll ». À 0,58 le bandeau faisait 284 px et l'accueil débordait de 63 px
     sous la barre d'onglets (mesuré à 375 × 812 — et d'une centaine de plus sur
     un iPhone à encoche, dont les zones sûres mangent le haut ET le bas). Une
     valeur fixe ne pouvait pas tenir sur tous les gabarits : c'est la seule
     raison pour laquelle elle est calculée. */
  var K_MAX = 0.58, K_MIN = 0.26;

  /* ⚠️ L'AGRANDISSEMENT DE 30 % A ÉTÉ ESSAYÉ PUIS RETIRÉ (13 août 2026, dans la
     journée : « agrandis de 30 % » puis « oublie le grossissement »). La note
     reste, parce qu'elle explique pourquoi la demande n'était pas tenable et
     évitera de la reprendre à l'identique.

     Ce qui a été mesuré. Monter `K_MAX` ne suffit pas : l'échelle réelle vaut
     `min(K_MAX, place disponible / hauteur du contenu)`, et sur un téléphone
     c'est la PLACE qui commande. À 375 × 812, la composition mesure ~489 px pour
     ~208 px disponibles, donc k = 0,43 — très en dessous du plafond. Le facteur
     devait donc s'appliquer à la place mesurée, ce qui donnait bien +30 %
     (282 px contre 217) mais faisait passer le bas des deux cartes de l'accueil
     SOUS la barre d'onglets : 27 à 90 px de défilement selon le gabarit.

     C'était incompatible avec la règle du 9 août — « tous les éléments
     accessibles sans scroll » — et c'est cette règle qui est conservée. Le
     bandeau reprend donc sa taille de confort. */
  /* En dessous de ce seuil, on cesse de tout rapetisser et on RETIRE le plat en
     grand : à 156 px de haut, c'est le tiers de la composition, et sous 0,34
     d'échelle il ne fait plus que 50 px — c'est-à-dire à peine plus que la
     bulle du moment dans l'arc, qui le montre déjà. Mieux vaut un arc et un
     titre lisibles sans le plat, que les trois illisibles. */
  var K_SANS_HERO = 0.34;
  var K_BANDEAU = K_MAX;

  function cssBandeau() {
    if (document.getElementById('njband-css')) return;
    var s = document.createElement('style');
    s.id = 'njband-css';
    s.textContent = [
      /* La hauteur est posée en dur comme plancher, puis MESURÉE : le contenu
         change avec le nombre d'étapes et la longueur du titre, et une hauteur
         devinée laisserait soit un trou, soit un arc coupé. */
      '.njb{--njb-k:' + K_BANDEAU + ';position:relative;display:block;width:100%;',
      'height:290px;border:none;background:none;padding:0;margin:0 0 4px;',
      'font-family:inherit;cursor:pointer;overflow:hidden;text-align:center;',
      '-webkit-tap-highlight-color:transparent;color:var(--j-ink)}',
      '.njb:active{opacity:.72}',
      /* ⚠️ `position:absolute` : mis en flux, le bloc occuperait sa hauteur
         PLEINE (une mise à l'échelle ne libère pas de place, cf. l'arc du guide
         sur petit écran), et l'accueil commencerait 200 px trop bas. */
      '.njb .njb-in{position:absolute;left:0;right:0;top:0;display:flex;',
      'flex-direction:column;align-items:center;pointer-events:none;',
      'transform:scale(var(--njb-k));transform-origin:top center}',
      /* Le bouton entier est la zone de tap ; rien à l'intérieur ne la découpe. */
      '.njb .njb-in *{pointer-events:none}',
      // Écran trop court : le plat en grand disparaît (voir K_SANS_HERO).
      '.njb.njb-sec .hero{display:none}'
    ].join('');
    document.head.appendChild(s);
  }

  /**
   * Règle l'échelle du bandeau sur la place qui reste, puis fixe sa hauteur.
   *
   * La hauteur réelle = celle du contenu × l'échelle. `offsetHeight` ignore les
   * transformations, c'est justement ce qu'on veut mesurer.
   *
   * ⚠️ On mesure la place, on ne la devine pas. Les trois inconnues — la zone
   * sûre du haut, la hauteur de la barre d'onglets, et la taille des cartes de
   * l'accueil (qui dépendent de la largeur) — changent d'un téléphone à
   * l'autre. Aucune constante ne pouvait tenir sur tous.
   *
   * ⚠️ La rAF seule ne se déclenche pas si la page ne peint pas (onglet caché) :
   * le minuteur la double, sinon l'en-tête resterait à sa hauteur de plancher.
   */
  function ajusterBandeau(b) {
    var dedans = b.querySelector('.njb-in');
    function maj() {
      if (!dedans || !b.parentNode) return;
      /* ⚠️ ON REPART TOUJOURS DE LA COMPOSITION COMPLÈTE. Mesurer sans remettre
         le plat, c'est mesurer l'état de la fois d'avant : au passage d'un
         petit écran à un grand, `H` valait encore la hauteur RÉDUITE (316 px)
         alors que le plat venait d'être rendu, et le bandeau se retrouvait
         coupé d'une centaine de pixels. Attrapé en redimensionnant, pas en
         lisant le code. */
      b.classList.remove('njb-sec');
      var H = dedans.offsetHeight;          // hauteur naturelle, avant l'échelle
      if (H < 60) return;

      /* Ce qui vient APRÈS le bandeau dans la page. Leurs hauteurs ne dépendent
         pas de la sienne (ce sont des blocs à ratio fixe, réglés sur la
         largeur) : on peut donc les mesurer avant de décider de l'échelle,
         sans boucler. */
      /* ⚠️ LES MARGES COMPTENT. `getBoundingClientRect().height` ne les inclut
         pas : les 8 px au-dessus de la bannière des plats et les 16 px
         au-dessus des deux cartes manquaient à l'appel, et l'accueil dépassait
         encore de 14 px sous la barre d'onglets — mesuré, pas supposé. */
      var apres = 0, n = b.nextElementSibling;
      while (n) {
        var st = getComputedStyle(n);
        apres += n.getBoundingClientRect().height
               + (parseFloat(st.marginTop) || 0) + (parseFloat(st.marginBottom) || 0);
        n = n.nextElementSibling;
      }
      var mb = getComputedStyle(b).marginBottom;
      apres += parseFloat(mb) || 0;

      // La barre d'onglets est en `position:fixed` : elle ne compte pas dans le
      // flux, mais elle recouvre le bas de l'écran. Mesurée si elle est là.
      var nav = document.getElementById('nattyNav');
      var basNav = nav ? nav.getBoundingClientRect().height + 10 : 104;

      var haut = b.getBoundingClientRect().top + (window.pageYOffset || 0);
      var dispo = window.innerHeight - haut - apres - basNav;

      var k = dispo / H;
      /* Trop serré : on retire le plat plutôt que de tout réduire, puis on
         remesure — sans lui la composition est plus courte, donc l'échelle
         remonte, et l'arc comme le titre restent lisibles. */
      if (k < K_SANS_HERO) {
        b.classList.add('njb-sec');
        H = dedans.offsetHeight;
        k = dispo / H;
      }

      k = Math.max(K_MIN, Math.min(K_MAX, k));
      b.style.setProperty('--njb-k', k.toFixed(3));
      b.style.height = Math.round(H * k) + 'px';
    }
    requestAnimationFrame(maj);
    setTimeout(maj, 90);
    // Les images de l'accueil changent la hauteur de leurs cartes en arrivant.
    setTimeout(maj, 600);
    window.addEventListener('resize', maj);
  }

  /**
   * Monte l'en-tête dans `hote`, en première position.
   *
   * Sans étape à montrer, il ne monte RIEN : une ligne vide en tête de page se
   * lit comme un chargement qui a échoué.
   * @param {Element} hote
   */
  async function monterBandeau(hote) {
    if (!hote || !window.Natty || !Natty.USER_ID) return null;
    var d;
    try { d = await construire(); } catch (e) { return null; }
    if (!d.etapes.length) return null;

    // ⚠️ LES DEUX FEUILLES. Tout le style vient de celle du guide (`css()`) ;
    // `cssBandeau()` ne fait que le cadre et l'échelle. Oublier la première,
    // c'est un en-tête sans arc, sans jalons et sans typographie.
    css(); cssBandeau();

    var etapes = d.etapes;
    // ⚠️ Journée bouclée : AUCUN jalon « en cours ». `courante()` rend la
    // dernière étape faute de mieux, et l'en-tête posait donc une pastille
    // pleine « c'est maintenant » sur une étape déjà cochée.
    var fini = toutFait(etapes);
    var cur = fini ? etapes.length - 1 : courante(etapes);
    var e0 = fini ? null : etapes[cur];
    var nom = fini ? 'Journée complète' : e0.nom;

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'njb njsk';
    b.setAttribute('aria-label', 'Ma journée');
    b.innerHTML = '<div class="njb-in">'
      + htmlArc(etapes)
      + '<div class="zone">'
      + '<div class="kick">' + jourEtDate() + '</div>'
      + titre(nom, nom.length > 11 ? 'p' : '', 0)
      + '<div class="hero' + (fini ? ' ok' : '') + '">'
      + (fini ? icone('coche') : figure(e0)) + '</div>'
      + '</div></div>';

    peindreArcDans(b.querySelector('.arc'), etapes, cur, fini);
    brancherPhoto(b, null);
    b.addEventListener('click', function () { ouvrir({ court: true }); });
    hote.insertBefore(b, hote.firstChild);
    ajusterBandeau(b);
    return b;
  }

  return {
    ouvrir: ouvrir,
    fermer: fermer,
    monterBandeau: monterBandeau,
    proposerSiNecessaire: proposerSiNecessaire,
    /** Le déroulé calculé — pour vérifier, sans ouvrir quoi que ce soit. */
    etapes: async function () { return (await construire()).etapes; },
    /** Le visuel d'une étape — exposé pour pouvoir le vérifier sans jouer la
        séquence entière : c'est la seule façon de contrôler les trois étages
        (photo figée, clé du catalogue, repli) d'un banc. */
    figure: figure,
    courante: courante,
    libHeure: libHeure
  };
})();
