/* ═══════════════════════════════════════════════════════════
   Natty — Les séances : le journal d'entraînement, et ce qu'il change au bilan
   ───────────────────────────────────────────────────────────
     NattySeance.charger()               relit les séances (Promise)
     NattySeance.ouvrir({jour, apres})   le plein écran : calendrier puis saisie
     NattySeance.ajouterPour(jour, cb)   la saisie directement, sur un jour
     NattySeance.duJour(jour)            la séance d'un jour, ou null
     NattySeance.series(s) / reps(s)     ce qui a été fait, en nombres
     NattySeance.kcal(s, poids)          l'énergie dépensée, estimée
     NattySeance.tonnage(s, poids)       charge × reps — la seule MESURE d'ici
     NattySeance.stimulus(auj, hier, p)  ce qui module la construction musculaire
     NattySeance.utilise()               cette personne journalise-t-elle ?
     NattySeance.monterPanneau(hote)     la carte « Mes séances » d'un écran
     NattySeance.resume(s, poids)        une ligne de texte

   CE QUE C'EST, ET POURQUOI. Demande de Pablo (2026-09-02) : « pouvoir ajouter
   sa séance avant le bilan pour voir exactement combien de grammes de muscle on
   a gagné et combien de graisse brûlée au gramme près ». Jusqu'ici le bilan du
   soir estimait les deux à partir de l'ACTIVITÉ DÉCLARÉE une fois pour toutes à
   l'onboarding (`onboarding.activite`) : la même valeur un jour de repos et un
   jour de squat. Deux chiffres qui ne pouvaient donc pas bouger avec ce que la
   personne avait réellement fait.

   ⚠️ IL N'INVENTE AUCUN CHIFFRE — même règle que `assets/bilan.js`, et c'est
   ici qu'elle est la plus facile à trahir. Ce module MESURE des séries et des
   répétitions (ça, la personne l'a saisi) et il ESTIME une dépense (ça, non).
   L'estimation est annoncée comme telle, avec son modèle en une ligne, à
   l'écran.

   LA CHARGE, ajoutée le 2026-09-02 (« oui », après « dis-moi si tu veux le
   suivi de charge »). Elle avait été écartée au premier passage — « un champ de
   plus par série ferait abandonner la saisie » — et ce motif tenait. Ce qui la
   rend tenable maintenant, c'est qu'elle n'est PAS un champ par série : UNE
   valeur par exercice, PRÉ-REMPLIE avec la dernière fois sur ce mouvement, et
   un dépliant par série pour ceux qui pyramident.
   ⚠️⚠️ ELLE RESTE FACULTATIVE, ET C'EST STRUCTUREL. Une charge à `null` n'est
   pas une charge à zéro : sans elle, le modèle est exactement celui d'avant, au
   gramme près (vérifié en A/B). Sans cette règle, ajouter le champ aurait cassé
   toutes les lignes déjà en base et puni ceux qui ne le remplissent pas.
   Ce qu'elle apporte : le TONNAGE (charge × reps), seule MESURE de tout ce
   module — tout le reste est estimé —, et l'intensité RELATIVE, qui compare ce
   qui a été chargé à ce que CETTE personne charge d'habitude sur CE mouvement.

   POURQUOI UN MODULE ET PAS UNE PAGE. Même raison qu'`ajout.js`, `planning.js`
   et `bilan.js` : il s'invite PAR-DESSUS l'écran courant. Il doit surtout
   pouvoir s'ouvrir depuis le bilan, qui est lui-même un plein écran — une
   navigation aurait détruit la séquence en cours.

   Dépend d'`assets/core.js`. Rien d'autre.
   ═══════════════════════════════════════════════════════════ */
window.NattySeance = (function () {
  'use strict';

  /* ═══ 1. Le catalogue ════════════════════════════════════
     Les groupes d'abord : Pablo a nommé « dos, pecs, bras », ils passent donc
     devant. « Détailler » n'est pas un groupe, c'est le choix de plusieurs —
     d'où son traitement à part dans la scène du groupe. */

  var GROUPES = [
    { cle: 'dos',     nom: 'Dos',       ic: 'poulie' },
    { cle: 'pecs',    nom: 'Pectoraux', ic: 'banc' },
    { cle: 'bras',    nom: 'Bras',      ic: 'haltere' },
    { cle: 'jambes',  nom: 'Jambes',    ic: 'presse' },
    { cle: 'epaules', nom: 'Épaules',   ic: 'epaule' },
    { cle: 'abdos',   nom: 'Abdos',     ic: 'abdos' },
    { cle: 'cardio',  nom: 'Cardio',    ic: 'velo' }
  ];

  /* Les « modules de machines » (le mot de Pablo). `met` est l'équivalent
     métabolique de l'exercice — c'est ce qui transforme du volume en énergie
     (voir `kcal()`). Les valeurs suivent le compendium d'activités physiques :
     ~5 pour de la musculation guidée, ~6 pour les mouvements polyarticulaires
     lourds, 3,5 pour du gainage statique, 7 à 8,5 pour du cardio.
     ⚠️ `rep` est la répétition PAR DÉFAUT proposée à la saisie, pas une
     consigne : 10 sur un curl, 12 sur du guidé léger, 30 secondes sur du
     gainage (où « reps » se lit en secondes, d'où `unite`). */
  var EXOS = [
    // ── Dos ──
    { cle: 'tirage-vertical',  nom: 'Tirage vertical',    g: 'dos', ic: 'poulie',   met: 5,   rep: 10, ref: 0.75 },
    { cle: 'rowing-machine',   nom: 'Rowing machine',     g: 'dos', ic: 'machine',  met: 5,   rep: 10, ref: 0.7 },
    { cle: 'tirage-horizontal',nom: 'Tirage horizontal',  g: 'dos', ic: 'poulie',   met: 5,   rep: 12, ref: 0.7 },
    { cle: 'traction',         nom: 'Tractions',          g: 'dos', ic: 'traction', met: 6,   rep: 8, t: 'poly', ref: 0.15, pdc: 1.0 },
    { cle: 'souleve-de-terre', nom: 'Soulevé de terre',   g: 'dos', ic: 'barre',    met: 6,   rep: 6, t: 'poly', ref: 1.3 },
    { cle: 'pull-over',        nom: 'Pull-over',          g: 'dos', ic: 'haltere',  met: 5,   rep: 12, ref: 0.3 },
    // ── Pectoraux ──
    { cle: 'developpe-couche', nom: 'Développé couché',   g: 'pecs', ic: 'banc',    met: 6,   rep: 8, t: 'poly', ref: 0.9 },
    { cle: 'developpe-incline',nom: 'Développé incliné',  g: 'pecs', ic: 'banc',    met: 6,   rep: 10, t: 'poly', ref: 0.75 },
    { cle: 'presse-pectorale', nom: 'Presse pectorale',   g: 'pecs', ic: 'machine', met: 5,   rep: 12, ref: 0.7 },
    { cle: 'ecarte-poulie',    nom: 'Écartés à la poulie',g: 'pecs', ic: 'poulie',  met: 5,   rep: 12, ref: 0.3 },
    { cle: 'pompes',           nom: 'Pompes',             g: 'pecs', ic: 'corps',   met: 5.5, rep: 15, t: 'poly', ref: 0.1, pdc: 0.65 },
    { cle: 'dips',             nom: 'Dips',               g: 'pecs', ic: 'dips',    met: 6,   rep: 10, t: 'poly', ref: 0.15, pdc: 1.0 },
    // ── Bras ──
    { cle: 'curl-barre',       nom: 'Curl à la barre',    g: 'bras', ic: 'barre',   met: 5,   rep: 10, ref: 0.35 },
    { cle: 'curl-haltere',     nom: 'Curl haltères',      g: 'bras', ic: 'haltere', met: 5,   rep: 12, ref: 0.15 },
    { cle: 'curl-pupitre',     nom: 'Curl au pupitre',    g: 'bras', ic: 'machine', met: 5,   rep: 12, ref: 0.3 },
    { cle: 'extension-poulie', nom: 'Extension poulie',   g: 'bras', ic: 'poulie',  met: 5,   rep: 12, ref: 0.35 },
    { cle: 'barre-au-front',   nom: 'Barre au front',     g: 'bras', ic: 'barre',   met: 5,   rep: 10, ref: 0.35 },
    { cle: 'dips-triceps',     nom: 'Dips triceps',       g: 'bras', ic: 'dips',    met: 5.5, rep: 12, t: 'poly', ref: 0.1, pdc: 1.0 },
    // ── Jambes ──
    { cle: 'presse-cuisses',   nom: 'Presse à cuisses',   g: 'jambes', ic: 'presse',met: 5.5, rep: 12, t: 'poly', ref: 1.8 },
    { cle: 'squat',            nom: 'Squat',              g: 'jambes', ic: 'barre', met: 6,   rep: 8, t: 'poly', ref: 1.0 },
    { cle: 'leg-extension',    nom: 'Leg extension',      g: 'jambes', ic: 'machine',met: 5,  rep: 12, ref: 0.7 },
    { cle: 'leg-curl',         nom: 'Leg curl',           g: 'jambes', ic: 'machine',met: 5,  rep: 12, ref: 0.55 },
    { cle: 'fentes',           nom: 'Fentes',             g: 'jambes', ic: 'corps', met: 5.5, rep: 12, t: 'poly', ref: 0.25, pdc: 0.85 },
    { cle: 'mollets',          nom: 'Mollets',            g: 'jambes', ic: 'machine',met: 4.5,rep: 15, ref: 1.0 },
    // ── Épaules ──
    { cle: 'developpe-militaire', nom: 'Développé militaire', g: 'epaules', ic: 'barre',  met: 6, rep: 8, t: 'poly', ref: 0.6 },
    { cle: 'elevations-laterales',nom: 'Élévations latérales',g: 'epaules', ic: 'haltere',met: 5, rep: 15, ref: 0.12 },
    { cle: 'oiseau',           nom: 'Oiseau',             g: 'epaules', ic: 'haltere',met: 5,  rep: 15, ref: 0.12 },
    { cle: 'presse-epaules',   nom: 'Presse épaules',     g: 'epaules', ic: 'machine',met: 5,  rep: 12, ref: 0.5 },
    // ── Abdos ──
    { cle: 'crunch',           nom: 'Crunch',             g: 'abdos', ic: 'abdos',  met: 4,   rep: 20, pdc: 0.35 },
    { cle: 'gainage',          nom: 'Gainage',            g: 'abdos', ic: 'abdos',  met: 3.5, rep: 30, unite: 's', pdc: 0.55 },
    { cle: 'releve-jambes',    nom: 'Relevé de jambes',   g: 'abdos', ic: 'abdos',  met: 4,   rep: 15, pdc: 0.45 },
    { cle: 'roue-abdo',        nom: 'Roue abdominale',    g: 'abdos', ic: 'roue',   met: 4.5, rep: 12, pdc: 0.5 },
    // ── Cardio ──
    { cle: 'tapis',            nom: 'Tapis de course',    g: 'cardio', ic: 'tapis', met: 8.5, rep: 10, unite: 'min' },
    { cle: 'velo',             nom: 'Vélo',               g: 'cardio', ic: 'velo',  met: 7,   rep: 15, unite: 'min' },
    { cle: 'rameur',           nom: 'Rameur',             g: 'cardio', ic: 'rameur',met: 7.5, rep: 10, unite: 'min' },
    { cle: 'elliptique',       nom: 'Elliptique',         g: 'cardio', ic: 'velo',  met: 6.5, rep: 15, unite: 'min' },
    { cle: 'corde',            nom: 'Corde à sauter',     g: 'cardio', ic: 'corde', met: 8,   rep: 5,  unite: 'min' }
  ];

  /**
   * Le type d'un exercice : 'poly', 'guide', 'stat' ou 'cardio'.
   * ⚠️ Déduit de `unite` quand elle est là ('min' → cardio, 's' → statique),
   * du drapeau `t` sinon. Les lignes DÉJÀ EN BASE n'ont pas de `t` : elles
   * retombent sur 'guide', donc sur le comportement le plus neutre — jamais sur
   * une exception ni sur zéro.
   */
  function typeDe(e) {
    if (!e) return 'guide';
    if (e.unite === 'min') return 'cardio';
    if (e.unite === 's') return 'stat';
    if (e.t === 'poly') return 'poly';
    var ref = exoParCle(e.cle);
    return (ref && ref.t === 'poly') ? 'poly' : 'guide';
  }

  function exoParCle(c) {
    for (var i = 0; i < EXOS.length; i++) if (EXOS[i].cle === c) return EXOS[i];
    return null;
  }
  function groupeParCle(c) {
    for (var i = 0; i < GROUPES.length; i++) if (GROUPES[i].cle === c) return GROUPES[i];
    return null;
  }

  /* Les icônes de machines. Du TRAIT sur `currentColor`, jamais d'aplat : le
     même dessin doit tenir dans la séquence noire et dans le panneau clair
     sans pendant à maintenir (règle 33 de CLAUDE.md). Boîte de 32. */
  var IC = {
    poulie:   '<path d="M6 4h20"/><path d="M16 4v9"/><circle cx="16" cy="15.5" r="2.5"/>'
            + '<path d="M9 21h14"/><path d="M11 21v6M21 21v6"/><path d="M16 18v3"/>',
    machine:  '<rect x="5" y="6" width="9" height="20" rx="1.6"/><path d="M5 11h9M5 16h9M5 21h9"/>'
            + '<path d="M18 9h9"/><path d="M22.5 9v10"/><path d="M18 23h9"/>',
    banc:     '<path d="M5 15h22" /><path d="M8 15v9M24 15v9"/><path d="M7 9h18"/>'
            + '<path d="M9 6.5v5M23 6.5v5"/>',
    haltere:  '<path d="M11 16h10"/><path d="M8 11v10M6 13v6M24 11v10M26 13v6"/>',
    barre:    '<path d="M4 16h24"/><path d="M8 11v10M11 13v6M21 13v6M24 11v10"/>',
    presse:   '<path d="M4 25h11"/><path d="M8 25v-6h7"/><path d="M15 19 27 7"/>'
            + '<path d="M22 5h6v6"/>',
    traction: '<path d="M5 6h22"/><path d="M12 6v5M20 6v5"/><circle cx="16" cy="15" r="3"/>'
            + '<path d="M16 18v6"/><path d="M13 27l3-3 3 3"/>',
    epaule:   '<circle cx="16" cy="8" r="3"/><path d="M9 26v-6a7 7 0 0 1 14 0v6"/>'
            + '<path d="M5 17h4M23 17h4"/>',
    abdos:    '<path d="M5 24c6-10 16-10 22 0"/><path d="M11 19h10"/><path d="M13 14h6"/>',
    roue:     '<circle cx="12" cy="21" r="6"/><path d="M17 17l7-8"/><path d="M21 8h5v5"/>',
    velo:     '<circle cx="9" cy="22" r="5"/><circle cx="24" cy="22" r="5"/>'
            + '<path d="M9 22l6-11h6"/><path d="M15 11l4 11"/>',
    tapis:    '<path d="M4 25h18"/><circle cx="6" cy="25" r="2"/><circle cx="20" cy="25" r="2"/>'
            + '<path d="M22 25 26 8"/><path d="M22 10h6"/>',
    rameur:   '<path d="M4 24h22"/><path d="M9 24v-4h6"/><path d="M15 20l8-8"/>'
            + '<path d="M20 9h6v6"/><path d="M6 20h5"/>',
    corde:    '<path d="M8 8c-6 6-6 14 0 18"/><path d="M24 8c6 6 6 14 0 18"/>'
            + '<path d="M8 8h4M24 8h-4"/><circle cx="16" cy="17" r="3"/>',
    dips:     '<path d="M6 10v16M26 10v16"/><path d="M6 10h6M26 10h-6"/>'
            + '<circle cx="16" cy="13" r="3"/><path d="M16 16v7"/><path d="M13 26l3-3 3 3"/>',
    corps:    '<circle cx="16" cy="7" r="3"/><path d="M16 10v9"/><path d="M9 13h14"/>'
            + '<path d="M16 19l-5 8M16 19l5 8"/>',
    plus:     '<path d="M16 8v16M8 16h16"/>',
    crayon:   '<path d="M6 26l3-8 13-13 5 5-13 13z"/><path d="M19 8l5 5"/>',
    coche:    '<path d="M7 17l6 6 12-14"/>'
  };
  function ic(nom, cls) {
    return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 32 32" fill="none" aria-hidden="true">'
      + (IC[nom] || IC.plus) + '</svg>';
  }

  /* ═══ 2. Petits utilitaires ══════════════════════════════ */

  var JOURS_L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  /* ⚠️ Les formes courtes sont ÉCRITES, pas tronquées. « septembre ».slice(0,4)
     donne « sept » sans point, « août » deviendrait « aoû », et `toLocaleString`
     rend « aou » sans accent selon l'environnement — c'est exactement ce qui a
     dû être corrigé dans `coaching.html` (fusion du 27 août). Elles servent aux
     bornes de l'axe des courbes, où la date longue déborde. */
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.',
                'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  /* ═══ Le modèle, et pourquoi il est CALCULÉ exercice par exercice ═══
     Demande de Pablo (2026-09-02, second passage) : « ça ne doit pas être
     uniquement 48 g, ça doit être des vrais calculs en fonction de ce qu'il a
     dépensé pendant sa séance grâce à la saisie de ses exercices ; ça doit
     vraiment être personnalisé en fonction de la qualité d'entraînement ET de
     nutrition ».

     ⚠️⚠️ CE QUI A CHANGÉ, ET POURQUOI L'ANCIENNE VERSION NE POUVAIT PAS TENIR.
     Elle comptait `séries × 2,2 min` et rien d'autre : deux séances de 7 séries
     coûtaient donc RIGOUREUSEMENT la même chose, qu'il s'agisse de 7 × 20 reps
     au leg extension ou de 7 × 3 reps de soulevé de terre. Le nombre affiché ne
     dépendait ni des reps saisies, ni du mouvement choisi — donc la moitié de
     ce que la personne venait de taper n'entrait dans aucun calcul. C'est ce
     qui faisait ressembler le résultat à une constante.

     Chaque exercice porte maintenant SON temps et SON coût :
     • le temps sous tension vient des REPS (`SEC_PAR_REP`) ;
     • la récupération vient du TYPE de mouvement (`REPOS_S`) — on ne souffle
       pas 90 s après des mollets et 90 s après un squat lourd ;
     • le coût énergétique vient du MET de l'exercice, appliqué à SA durée ;
     • le stimulus vient du volume PONDÉRÉ : une série ne vaut pleinement que
       dans la plage où l'hypertrophie se joue, et un polyarticulaire recrute
       plus de masse qu'une machine.                                          */

  /* Secondes par répétition — le temps sous tension. Un polyarticulaire lourd
     est plus lent (amplitude, mise en place) qu'une machine d'isolation. */
  var SEC_PAR_REP = { poly: 3.5, guide: 3.0 };

  /* Secondes de récupération APRÈS chaque série, par type de mouvement. Ce sont
     les valeurs que tout le monde applique sans y penser : ~2,5 min après un
     squat lourd, ~1,5 min sur une machine, ~45 s sur de l'abdo. */
  var REPOS_S = { poly: 150, guide: 90, stat: 45, cardio: 0 };

  /* Ce qu'une série RECRUTE, relativement à une machine d'isolation. Un
     polyarticulaire mobilise plusieurs groupes et plus de masse musculaire ; du
     gainage statique ne construit presque rien ; du cardio, encore moins.
     ⚠️ Ces coefficients ne sont PAS des multiplicateurs de résultat : ils
     pondèrent le volume avant de le comparer à `VOLUME_PLEIN`. Une séance de
     cardio seule ne peut donc pas « remplir » le stimulus de croissance — ce
     qui est le comportement voulu, et l'ancien modèle ne savait pas le dire. */
  var STIM = { poly: 1.15, guide: 1.0, stat: 0.55, cardio: 0.15 };

  /* La plage de répétitions où une série compte PLEINEMENT : 5 à 25.
     ⚠️ ELLE EST LARGE, ET C'EST DÉLIBÉRÉ. Le travail de Schoenfeld et de
     plusieurs répliques depuis montre que des charges allant de ~30 à ~85 % du
     maximum produisent une hypertrophie comparable dès lors que la série est
     menée près de l'échec — soit à peu près 5 à 30 répétitions. Une plage
     étroite (6-20, la première version) punissait donc les séries lourdes :
     mesuré au banc, sept séries de squat à 5 reps rendaient un volume pondéré
     de 2,8 contre 7,0 pour sept séries de leg extension à 20. Le modèle
     annonçait qu'une séance lourde construit deux fois moins — faux, et
     exactement à l'envers.
     En dessous de 3 reps c'est du travail de force pur : la charge est là, le
     volume mécanique moins. Au-delà de 25, l'échec vient du souffle avant le
     muscle. Le déclin est progressif de part et d'autre, jamais un mur : sinon
     deux séances quasi identiques tomberaient de chaque côté d'un seuil. */
  var REPS_MIN = 3, REPS_PLEIN_BAS = 5, REPS_PLEIN_HAUT = 25, REPS_MAX = 35;

  /* Le volume PONDÉRÉ qui remplit une journée de stimulus, sur 48 h glissantes.
     La littérature situe le gain quasi maximal autour de 10 à 20 séries par
     muscle et par semaine ; réparti sur quatre séances d'une quinzaine de
     séries, ça donne ~10 séries pondérées par jour en moyenne glissante. */
  var VOLUME_PLEIN = 10;

  /* Ce que l'intensité relative fait bouger, et dans quelles bornes.
     ⚠️ ELLE MODULE, ELLE NE COMMANDE PAS, et les bornes sont là pour ça. Le
     compendium d'activités physiques distingue lui-même la musculation « effort
     modéré » (~3,5 MET) de l'« effort vigoureux » (~6 MET) : la charge dit où
     l'on se situe sur CETTE échelle, elle ne la remplace pas. Hors de [0,80 ;
     1,20] on cesse de croire au signal — une charge saisie dix fois trop haute
     (une faute de frappe, un kg pris pour une livre) ne doit pas doubler la
     dépense de la journée.
     Côté stimulus, même logique : une série de 12 reps à 60 % de sa charge
     habituelle est probablement loin de l'échec, donc elle stimule moins — mais
     on ne descend pas sous 0,80, parce qu'une série reste une série.
     ⚠️ La borne porte sur le MET, donc l'effet sur les kcal est un peu plus
     large : on retire 1 MET (le repos, déjà compté par `tdee`), et un plafond
     de 1,20 sur 6 MET donne 1,24 en net. Mesuré, et sans conséquence — ce qu'on
     voulait empêcher, c'est qu'une charge saisie dix fois trop haute double la
     journée, pas les quatre points d'écart. */
  var INT_MET_MIN = 0.80, INT_MET_MAX = 1.20;
  var INT_STIM_MIN = 0.80, INT_STIM_MAX = 1.10;

  /* L'après-séance. L'organisme continue de dépenser au-dessus du repos pendant
     des heures (« EPOC ») : la littérature situe ce supplément autour de 6 à
     15 % du coût de la séance pour du travail en résistance, davantage quand
     les mouvements sont lourds et polyarticulaires — d'où un coefficient qui
     dépend de la COMPOSITION réelle de la séance et non une constante. */
  var EPOC_MIN = 0.05, EPOC_MAX = 0.13;

  /* Conservé pour les lignes déjà en base et l'affichage de repli : une séance
     dont les exercices ne portent aucune série n'a pas de durée calculable. */
  var MIN_PAR_SERIE = 2.2;

  var XP_SEANCE = 40;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function r0(n) { return Math.round(n || 0); }
  function borne(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /* ⚠️ `Natty.jour()`, JAMAIS `toISOString()`. Ce dernier convertit en UTC :
     entre 00 h et 02 h à Paris il rend la VEILLE, et une séance notée en
     rentrant de la salle à 23 h 30 puis relue à 00 h 30 changerait de jour.
     C'est le piège documenté en §3 de CLAUDE.md, corrigé dans neuf endroits. */
  function jourDe(d) { return (window.Natty && Natty.jour) ? Natty.jour(d) : ''; }
  function aujourdhui() { return jourDe(); }
  function dateDe(j) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  }
  function dateFr(j) {
    var d = dateDe(j);
    return d.getDate() + ' ' + MOIS[d.getMonth()];
  }
  function veille(j) {
    var d = dateDe(j); d.setDate(d.getDate() - 1); return jourDe(d);
  }
  function uid() { return (window.Natty && Natty.USER_ID) || 'anon'; }
  function cle() { return 'natty_seances_' + uid(); }

  /* Une vibration courte à chaque geste qui compte. C'est ce qui rend la
     saisie « satisfaisante » plutôt que administrative — et c'est sans effet
     là où l'API n'existe pas, donc sans garde à écrire. */
  function tic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {}
  }

  /* ═══ 3. Les données ═════════════════════════════════════
     Une LIGNE PAR JOUR, et c'est un choix : le calendrier montre un jour, pas
     une liste de séances, et deux entraînements dans la même journée sont deux
     blocs d'exercices dans la même ligne. Ça donne aussi la clé primaire
     `(user_id, jour)` — donc un `merge-duplicates` qui écrase au lieu de
     repartir en 409 (piège de `meal_likes` / `membre_amis`, §3 de CLAUDE.md). */

  var SEANCES = null;    // {'2026-09-02': {jour, exos:[…], duree_min, libre, le}}
  var tableDispo = null; // null = pas encore su

  function lireLocal() {
    try {
      var v = localStorage.getItem(cle());
      return v ? (JSON.parse(v) || {}) : {};
    } catch (e) { return {}; }
  }
  function ecrireLocal() {
    try { localStorage.setItem(cle(), JSON.stringify(SEANCES || {})); } catch (e) {}
  }

  function normaliser(l) {
    var s = {
      jour: l.jour, exos: [], duree_min: +l.duree_min || 0,
      libre: l.libre || '', le: l.le || null
    };
    var brut = l.exos;
    if (typeof brut === 'string') { try { brut = JSON.parse(brut); } catch (e) { brut = []; } }
    (brut || []).forEach(function (x) {
      if (!x) return;
      var ref = exoParCle(x.cle);
      s.exos.push({
        cle: x.cle || '', g: x.g || (ref ? ref.g : ''),
        nom: x.nom || (ref ? ref.nom : 'Exercice'),
        ic: x.ic || (ref ? ref.ic : 'haltere'),
        unite: x.unite || (ref ? ref.unite : '') || '',
        met: +x.met || (ref ? ref.met : 5),
        /* La charge, en kg. `charge` vaut pour tout l'exercice ; `charges`, si
           elle est là, la surcharge série par série (pyramides, dégressives).
           ⚠️ Les deux sont FACULTATIVES : `null` veut dire « pas renseignée »,
           et tout le modèle retombe alors sur son comportement d'avant. Une
           ligne enregistrée avant cette fonctionnalité n'en porte aucune. */
        charge: (x.charge == null || x.charge === '') ? null : Math.max(0, +x.charge || 0),
        charges: Array.isArray(x.charges)
          ? x.charges.map(function (c) { return (c == null || c === '') ? null : Math.max(0, +c || 0); })
          : null,
        series: (x.series || []).map(function (r) { return Math.max(0, r0(r)); })
      });
    });
    return s;
  }

  /**
   * Relit les séances des `nb` derniers jours. Idempotent : deux écrans qui
   * l'appellent ne paient qu'une lecture.
   */
  var chargement = null;
  function charger(nb) {
    if (chargement) return chargement;
    chargement = (async function () {
      SEANCES = lireLocal();
      if (!window.Natty || !Natty.sbFetch) return SEANCES;
      var depuis = new Date();
      depuis.setDate(depuis.getDate() - (nb || 120));
      try {
        var r = await Natty.sbFetch('seances?user_id=eq.' + uid()
          + '&jour=gte.' + jourDe(depuis)
          + '&order=jour.desc&limit=200&select=jour,exos,duree_min,libre');
        tableDispo = true;
        /* La base fait foi quand elle répond : les lignes locales d'un jour
           qu'elle connaît sont écrasées, celles qu'elle ne connaît pas sont
           gardées. Sans ce dernier point, une séance saisie hors ligne
           disparaîtrait au premier chargement réussi. */
        (r || []).forEach(function (l) { SEANCES[l.jour] = normaliser(l); });
      } catch (e) { tableDispo = false; }
      return SEANCES;
    })();
    return chargement;
  }

  function toutes() { return SEANCES || (SEANCES = lireLocal()); }
  function duJour(j) {
    var s = toutes()[j || aujourdhui()];
    return (s && s.exos && s.exos.length) ? s : (s && s.libre ? s : null);
  }

  async function enregistrer(s) {
    var t = toutes();
    s.le = new Date().toISOString();
    t[s.jour] = s;
    ecrireLocal();
    try {
      /* ⚠️ `resolution=merge-duplicates` SANS `?on_conflict=` : PostgREST
         résout alors sur la clé primaire, qui est `(user_id, jour)`. C'est
         exactement le contrat de `materiel` et de `garde_manger`. Si la table
         était créée avec un `id` uuid en clé, chaque enregistrement repartirait
         en 409 et rien ne se synchroniserait jamais. */
      await Natty.sbPost('seances', {
        user_id: uid(), jour: s.jour, exos: s.exos,
        duree_min: s.duree_min || null, libre: s.libre || null
      }, 'resolution=merge-duplicates,return=minimal');
      tableDispo = true;
    } catch (e) { tableDispo = false; }
    try {
      document.dispatchEvent(new CustomEvent('natty:seance-ajoutee', { detail: { jour: s.jour } }));
    } catch (e) {}
    return s;
  }

  async function supprimer(j) {
    var t = toutes();
    delete t[j];
    ecrireLocal();
    try {
      await fetch(Natty.SB_URL + '/rest/v1/seances?user_id=eq.' + encodeURIComponent(uid())
        + '&jour=eq.' + encodeURIComponent(j),
        { method: 'DELETE', headers: Natty.entetes() });
    } catch (e) {}
    try {
      document.dispatchEvent(new CustomEvent('natty:seance-ajoutee', { detail: { jour: j } }));
    } catch (e) {}
  }

  function estSynchronise() { return tableDispo === true; }

  /* ═══ 4. Ce que la séance vaut ═══════════════════════════
     Trois lectures, trois natures différentes, et l'écran doit les distinguer :
     les SÉRIES et les REPS sont saisies (donc justes), la DURÉE est déduite du
     volume (sauf si la personne la corrige), l'ÉNERGIE est modélisée. */

  function series(s) {
    if (!s || !s.exos) return 0;
    return s.exos.reduce(function (n, e) { return n + (e.series || []).length; }, 0);
  }
  function reps(s) {
    if (!s || !s.exos) return 0;
    return s.exos.reduce(function (n, e) {
      return n + (e.series || []).reduce(function (a, b) { return a + (+b || 0); }, 0);
    }, 0);
  }
  function groupes(s) {
    var vus = {}, out = [];
    ((s && s.exos) || []).forEach(function (e) {
      if (e.g && !vus[e.g]) { vus[e.g] = 1; out.push(e.g); }
    });
    return out;
  }

  /* ── La CHARGE ───────────────────────────────────────────
     Ajoutée le 2026-09-02 sur demande de Pablo, après qu'elle a été
     volontairement laissée de côté au premier passage (« un champ de plus par
     série ferait abandonner la saisie »). Ce qui rend son ajout tenable, c'est
     qu'elle n'est PAS un champ de plus par série : une seule valeur par
     exercice, PRÉ-REMPLIE avec la dernière fois, et un détail par série
     seulement pour ceux qui pyramident.

     ⚠️⚠️ ELLE RESTE FACULTATIVE, ET C'EST STRUCTUREL. Une charge à `null` n'est
     pas une charge à zéro : tout ce qui suit retombe alors exactement sur le
     modèle d'avant (intensité neutre, tonnage non affiché). Sans cette règle,
     ajouter le champ aurait cassé toutes les lignes déjà en base et puni ceux
     qui ne le remplissent pas — l'inverse d'un progrès. */

  /** La charge d'une série donnée, en kg, ou null si non renseignée. */
  function chargeDe(e, i) {
    if (!e) return null;
    if (e.charges && e.charges[i] != null) return e.charges[i];
    return e.charge == null ? null : e.charge;
  }

  /**
   * La charge RÉELLEMENT déplacée sur une série, poids de corps compris.
   *
   * ⚠️ Une traction n'est pas « 0 kg ». Les mouvements au poids du corps portent
   * `pdc` — la fraction du corps effectivement déplacée (1,0 pour une traction,
   * 0,65 pour une pompe) — et la charge saisie s'y AJOUTE (ceinture de lest).
   * Sans ça, le tonnage d'une séance de tractions et de dips serait nul, alors
   * que c'est souvent la séance la plus lourde de la semaine.
   */
  /* 🔴 ⚠️ `pdc` N'EST PORTÉ QUE PAR LES MOUVEMENTS OÙ LE CORPS *EST* LA CHARGE
     — traction, pompes, dips, abdos, fentes. Le squat l'a porté un moment, et
     c'était un défaut trouvé au banc : sans charge saisie, une séance de
     7 × 5 squats annonçait « 2,8 t soulevées » alors que RIEN n'avait été
     renseigné. La barre est la charge d'un squat, et une barre qu'on ne nous a
     pas dite ne se devine pas — un tonnage inventé est exactement ce que ce
     module s'interdit. Sur une traction, au contraire, le poids du corps n'est
     pas une supposition : c'est la charge, et on la connaît. */
  function chargeReelle(e, i, poids) {
    var ref = exoParCle(e && e.cle);
    var pdc = (e && e.pdc) || (ref && ref.pdc) || 0;
    var base = pdc && poids ? pdc * poids : 0;
    var saisie = chargeDe(e, i);
    if (saisie == null) return base || null;
    return base + saisie;
  }

  /**
   * Le TONNAGE : Σ (charge réelle × répétitions). C'est le volume-load des
   * pratiquants, et la seule grandeur de tout ce module qui soit une MESURE
   * plutôt qu'une estimation, dès lors que la charge est saisie. C'est aussi
   * celle qui suit la progression sans aucun modèle : +5 % de tonnage sur le
   * même exercice, c'est +5 %, point.
   * @returns {number} en kg, 0 si aucune charge n'est connue
   */
  function tonnage(s, poids) {
    if (!s || !s.exos) return 0;
    return Math.round(s.exos.reduce(function (tot, e) {
      if (typeDe(e) === 'cardio') return tot;
      return tot + (e.series || []).reduce(function (a, r, i) {
        var c = chargeReelle(e, i, poids);
        return a + (c ? c * (+r || 0) : 0);
      }, 0);
    }, 0));
  }

  /** Le tonnage d'un seul exercice — pour la comparaison à la dernière fois. */
  function tonnageExo(e, poids) {
    if (!e || typeDe(e) === 'cardio') return 0;
    return Math.round((e.series || []).reduce(function (a, r, i) {
      var c = chargeReelle(e, i, poids);
      return a + (c ? c * (+r || 0) : 0);
    }, 0));
  }

  /**
   * L'intensité RELATIVE d'un exercice, autour de 1 : ce qui a été chargé
   * rapporté à ce que cette personne charge d'habitude sur ce mouvement.
   *
   * ⚠️ L'HISTORIQUE PASSE AVANT LA TABLE, et c'est ce qui rend la mesure
   * personnelle. `ref` (une fraction du poids de corps pour un pratiquant
   * intermédiaire) ne sert que le premier jour, quand il n'y a rien à comparer.
   * Ensuite c'est la meilleure charge des huit dernières semaines sur CE
   * mouvement qui fait l'échelle — donc « lourd » veut dire lourd pour vous.
   *
   * ⚠️⚠️ `sauf` EXCLUT LE JOUR QU'ON ÉVALUE DE SA PROPRE RÉFÉRENCE, et c'est
   * indispensable : sans lui, une séance enregistrée entre dans le maximum des
   * huit semaines, donc un RECORD se compare à lui-même et rend exactement
   * 100 %. Le facteur d'intensité ne pouvait alors **jamais** dépasser 1 — une
   * séance lourde n'était pas récompensée, une séance légère était pénalisée.
   * C'est le défaut du plafond à 1 du facteur séance (règle 45 de CLAUDE.md),
   * sous un autre nom. Toutes les fonctions de séance passent donc `s.jour`.
   *
   * @returns {number|null} null quand rien ne permet de situer la charge
   */
  function intensiteRelative(e, poids, sauf) {
    var c = chargeDe(e, 0);
    if (c == null) return null;
    var reel = chargeReelle(e, 0, poids) || c;
    var hist = meilleureCharge(e.cle, poids, sauf);
    if (hist) return reel / hist;
    var ref = exoParCle(e.cle);
    var attendu = (ref && ref.ref && poids) ? ref.ref * poids : 0;
    var pdc = (ref && ref.pdc) || 0;
    if (pdc && poids) attendu += pdc * poids;
    return attendu ? reel / attendu : null;
  }

  /** La charge réelle la plus lourde vue sur ce mouvement, 8 semaines en arrière. */
  function meilleureCharge(cle, poids, sauf) {
    if (!cle) return 0;
    var t = toutes(), max = 0, d = new Date();
    for (var i = 0; i < 56; i++) {
      var sj = jourDe(d) === sauf ? null : t[jourDe(d)];
      if (sj) (sj.exos || []).forEach(function (e) {
        if (e.cle !== cle) return;
        (e.series || []).forEach(function (_, k) {
          var c = chargeReelle(e, k, poids);
          if (c && c > max) max = c;
        });
      });
      d.setDate(d.getDate() - 1);
    }
    return max;
  }

  /**
   * La dernière charge SAISIE sur ce mouvement, pour pré-remplir le champ.
   * ⚠️ C'est le détail qui fait que la charge ne coûte rien à la deuxième
   * séance : on ne la retape pas, on la corrige quand elle a bougé. Et c'est
   * aussi ce qui rend la surcharge progressive visible sans y penser.
   */
  function derniereCharge(cle, sauf) {
    if (!cle) return null;
    var t = toutes(), d = new Date();
    for (var i = 0; i < 120; i++) {
      /* ⚠️ LE JOUR QU'ON EST EN TRAIN DE SAISIR EST EXCLU. Sans ce filtre, une
         séance rouverte pour correction se comparait À ELLE-MÊME : le champ
         annonçait « Comme la dernière fois (80 kg) » en regardant les 80 kg
         qu'on avait sous les yeux. Vu au banc, et c'est le genre de phrase qui
         fait douter de tout le reste de l'écran. Même précaution que le
         `jourCourantExclu` de `progressionExo`. */
      var sj = jourDe(d) === sauf ? null : t[jourDe(d)];
      if (sj) {
        var trouve = null;
        (sj.exos || []).forEach(function (e) {
          if (e.cle === cle && e.charge != null) trouve = e.charge;
        });
        if (trouve != null) return trouve;
      }
      d.setDate(d.getDate() - 1);
    }
    return null;
  }

  /**
   * La progression sur un mouvement : le tonnage du jour contre la dernière
   * séance où il a été fait. Aucune modélisation — deux mesures, un rapport.
   * @returns {Object|null} {pc, avant, jour} ou null s'il n'y a pas de passé
   */
  function progressionExo(exo, poids, jourCourantExclu) {
    if (!exo || !exo.cle) return null;
    var maintenant = tonnageExo(exo, poids);
    if (!maintenant) return null;
    var t = toutes(), d = new Date();
    for (var i = 0; i < 120; i++) {
      var j = jourDe(d);
      if (j !== jourCourantExclu && t[j]) {
        var av = null;
        (t[j].exos || []).forEach(function (e) { if (e.cle === exo.cle) av = e; });
        if (av) {
          var avant = tonnageExo(av, poids);
          if (avant) {
            return { pc: Math.round((maintenant / avant - 1) * 100), avant: avant, jour: j };
          }
        }
      }
      d.setDate(d.getDate() - 1);
    }
    return null;
  }

  /* ── La PROGRESSION, mouvement par mouvement ─────────────
     Le tonnage se comparait déjà d'une séance à l'autre (`progressionExo`),
     mais nulle part on ne voyait la SUITE. Or c'est la seule chose qu'on vient
     chercher dans un carnet d'entraînement : est-ce que ça monte ?

     ⚠️⚠️ UN POINT = UNE SÉANCE, PAS UN JOUR, et c'est ce qui distingue ce
     graphique de celui du bilan. Là-bas, un jour non noté est un trou qu'il
     faut relier sans prétendre l'avoir mesuré (§3, `relier()`). Ici il n'y a
     aucun trou à combler : on ne trace que des séances qui ont eu lieu, donc
     chaque point est une mesure. Les jours de repos écartent les points, ils
     n'en créent pas — et l'axe étant le TEMPS, une reprise après trois semaines
     se voit comme un long segment plat plutôt que comme un pas de plus.

     ⚠️ SANS CHARGE SAISIE, ON NE TRACE PAS UN TONNAGE NUL : on trace le volume
     de répétitions (séries × reps), et l'écran le dit. Une courbe à zéro se
     lirait comme un effondrement, alors qu'elle ne dit que « on n'a pas
     renseigné les kilos ». */

  var PROG_JOURS = 84;         // douze semaines : assez pour voir une tendance

  /**
   * Toutes les séances où un mouvement a été fait, de la plus ancienne à la
   * plus récente.
   * @returns {Array<{jour, series, reps, charge, tonnage, volume}>}
   */
  function historiqueExo(cle, poids, nbJours) {
    var t = toutes(), out = [], d = new Date();
    d.setDate(d.getDate() - ((nbJours || PROG_JOURS) - 1));
    for (var i = 0; i < (nbJours || PROG_JOURS); i++) {
      var j = jourDe(d), sj = t[j];
      if (sj) (sj.exos || []).forEach(function (e) {
        if (e.cle !== cle) return;
        var ser = e.series || [];
        var ch = 0;
        ser.forEach(function (_, k) { var c = chargeDe(e, k); if (c != null && c > ch) ch = c; });
        var rp = ser.reduce(function (a, b) { return a + (+b || 0); }, 0);
        out.push({
          /* ⚠️ Les séries BRUTES sont gardées : la liste affichait « 4×9 » sur
             un 10-10-8-8, c'est-à-dire une MOYENNE arrondie présentée comme la
             valeur. `resumeReps` sait écrire les deux cas. */
          jour: j, serie: ser.slice(), series: ser.length, reps: rp,
          charge: ch || null, tonnage: tonnageExo(e, poids),
          /* Le repli quand aucune charge n'est connue : la somme des
             répétitions. Pas « séries × reps », qui compterait deux fois. */
          volume: rp
        });
      });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /**
   * Un résumé par mouvement, pour la liste : combien de séances, ce qui est
   * tracé, le record, et l'écart entre la première et la dernière séance.
   *
   * ⚠️ Un mouvement fait UNE SEULE FOIS n'a pas de progression — `pc` vaut
   * `null`, pas 0. Zéro veut dire « stable », ce qui serait faux.
   */
  function mouvements(poids, nbJours) {
    var t = toutes(), vus = {}, d = new Date(), n = nbJours || PROG_JOURS;
    d.setDate(d.getDate() - (n - 1));
    for (var i = 0; i < n; i++) {
      var sj = t[jourDe(d)];
      if (sj) (sj.exos || []).forEach(function (e) {
        if (e.cle) vus[e.cle] = e;
      });
      d.setDate(d.getDate() + 1);
    }
    var out = [];
    Object.keys(vus).forEach(function (cle) {
      var h = historiqueExo(cle, poids, n);
      if (!h.length) return;
      var ref = exoParCle(cle) || {};
      var avecCharge = h.some(function (x) { return x.tonnage > 0; });
      var vals = h.map(function (x) { return avecCharge ? x.tonnage : x.volume; });
      var premier = vals[0], dernier = vals[vals.length - 1];
      out.push({
        cle: cle, nom: vus[cle].nom || ref.nom || cle, ic: vus[cle].ic || ref.ic || 'haltere',
        g: vus[cle].g || ref.g || '', unite: vus[cle].unite || ref.unite || '',
        seances: h.length, avecCharge: avecCharge, valeurs: vals, hist: h,
        record: Math.max.apply(null, vals),
        chargeMax: h.reduce(function (m, x) { return Math.max(m, x.charge || 0); }, 0),
        pc: (h.length > 1 && premier) ? Math.round((dernier / premier - 1) * 100) : null
      });
    });
    /* Le plus pratiqué en tête : c'est celui sur lequel la courbe a le plus à
       dire. À égalité, le plus récemment fait. */
    out.sort(function (a, b) {
      return (b.seances - a.seances) || (b.hist[b.hist.length - 1].jour < a.hist[a.hist.length - 1].jour ? -1 : 1);
    });
    return out;
  }

  /* ── L'HABITUDE, LE PROGRAMME, ET LE BESOIN DU JOUR ──────
     Demande de Pablo (2026-09-02) : « que ça adapte mon objectif calorique de
     mon J+1 et du même jour de la semaine prochaine — si le lundi j'enregistre
     souvent des séances pecs et que mes besoins sont de 3200 kcal, mettre par
     défaut 3500 kcal le lundi ».

     Ce qui manquait : l'objectif calorique valait `onboarding.tdee`, une
     constante posée à l'inscription. Le même chiffre le lundi de la salle et le
     dimanche du canapé — donc, les jours d'entraînement, un objectif qu'on
     dépasse « en trop » alors qu'on a justement dépensé plus.

     ⚠️⚠️ TROIS SOURCES, DANS CET ORDRE, ET JAMAIS MÉLANGÉES :
       1. la séance **notée** ce jour-là → ses kcal RÉELLES (une mesure) ;
       2. la séance **programmée** ce jour-là → une estimation depuis les
          groupes choisis, calibrée sur SES propres séances passées ;
       3. l'**habitude** de ce jour de semaine → la moyenne de ses séances des
          huit dernières semaines ce jour-là.
     L'écran DIT laquelle des trois parle. Confondre « vous avez dépensé » et
     « vous dépenserez probablement » serait exactement l'invention que ce
     module s'interdit partout ailleurs.

     ⚠️ L'HABITUDE N'EST APPLIQUÉE QUE SI C'EN EST UNE (`SEUIL_HABITUDE`). En
     dessous, on ne met RIEN plutôt qu'une fraction : « +140 kcal parce que vous
     vous entraînez un lundi sur trois » est un chiffre que personne ne peut
     vérifier ni comprendre, et il gonfle l'objectif les jours où l'on ne va pas
     à la salle — c'est-à-dire deux fois sur trois. */

  var HAB_SEMAINES   = 8;      // la fenêtre où l'on cherche une habitude
  var SEUIL_HABITUDE = 0.6;    // 5 lundis sur 8 : c'est une habitude
  var PAS_KCAL       = 50;     // l'objectif s'arrondit : 3520 se lit 3500

  /* Le lendemain. ⚠️ CE N'EST PAS DE LA DÉPENSE, et il ne faut pas le présenter
     comme telle : l'après-séance (EPOC) est DÉJÀ dans les kcal de la veille
     (`epocCoef`). Ce qui reste le lendemain, c'est la reconstruction — la
     synthèse protéique tient ~48 h, et elle se paie en énergie et surtout en
     protéines. D'où un tiers, annoncé comme un besoin et non comme une
     dépense. Sans cette distinction, on compterait deux fois la même séance. */
  var PART_LENDEMAIN = 0.33;

  /** Le jour de la semaine, lundi = 0 — comme partout ailleurs dans ce module. */
  function jourSemaine(j) { return (dateDe(j).getDay() + 6) % 7; }

  /**
   * Ce que coûtent, en moyenne, les séances de cette personne un jour de
   * semaine donné — et à quelle fréquence elle en fait ce jour-là.
   *
   * @returns {{frequence:number, kcal:number, groupes:string[], n:number, sur:number}}
   */
  function habitude(js, poids) {
    var t = toutes(), n = 0, sur = 0, som = 0, grp = {};
    var d = new Date();
    // On remonte au même jour de semaine, puis de sept en sept.
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7 - js + 7) % 7);
    /* ⚠️ Le jour COURANT est exclu du comptage : il n'est pas fini, et une
       séance pas encore notée ferait chuter la fréquence de son propre jour. */
    if (jourDe(d) === aujourdhui()) d.setDate(d.getDate() - 7);
    for (var i = 0; i < HAB_SEMAINES; i++) {
      var j = jourDe(d), s = t[j];
      sur++;
      if (s && s.exos && s.exos.length) {
        n++; som += kcal(s, poids);
        groupes(s).forEach(function (g) { grp[g] = (grp[g] || 0) + 1; });
      }
      d.setDate(d.getDate() - 7);
    }
    var ordre = Object.keys(grp).sort(function (a, b) { return grp[b] - grp[a]; });
    return { frequence: sur ? n / sur : 0, kcal: n ? Math.round(som / n) : 0,
             groupes: ordre, n: n, sur: sur };
  }

  /**
   * Ce que coûterait une séance PROGRAMMÉE sur ces groupes.
   *
   * ⚠️ CALIBRÉ SUR SES PROPRES SÉANCES, pas sur une table. Les séances passées
   * qui portent l'un de ces groupes donnent la moyenne ; ce n'est qu'à défaut
   * qu'on retombe sur un ordre de grandeur (une séance ordinaire de 7 séries,
   * ~5,5 MET, ~50 min) — et l'écran le dit alors. Une valeur de table
   * présentée comme « votre » besoin serait un chiffre inventé.
   */
  function kcalProgramme(grps, poids) {
    if (!grps || !grps.length) return { kcal: 0, mesure: false };
    var t = toutes(), som = 0, n = 0, d = new Date();
    for (var i = 0; i < HAB_SEMAINES * 7; i++) {
      var s = t[jourDe(d)];
      if (s && s.exos && s.exos.length) {
        var g = groupes(s);
        if (g.some(function (x) { return grps.indexOf(x) > -1; })) { som += kcal(s, poids); n++; }
      }
      d.setDate(d.getDate() - 1);
    }
    if (n) return { kcal: Math.round(som / n), mesure: true, n: n };
    // Repli : (5,5 − 1) MET × poids × 50 min. Annoncé comme un ordre de grandeur.
    return { kcal: poids ? Math.round(4.5 * poids * (50 / 60)) : 0, mesure: false, n: 0 };
  }

  /* ── Le programme de la semaine ──────────────────────────
     Une carte par jour, des groupes ou « repos ». Il sert à deux choses, et la
     seconde est celle qui compte : annoncer le besoin AVANT la journée, plutôt
     que de le constater après. */

  function cleProg() { return 'natty_prog_' + uid(); }

  /** Le lundi de la semaine d'une date — la clé d'un programme. */
  function lundiDe(d) {
    var x = new Date(d || new Date());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return jourDe(x);
  }

  /** @returns {{semaine:string, jours:Object}|null} */
  function programme(semaine) {
    var sem = semaine || lundiDe();
    try {
      var v = JSON.parse(localStorage.getItem(cleProg()) || 'null');
      if (v && v.semaine === sem) return v;
    } catch (e) {}
    return null;
  }

  function poserProgramme(jours, semaine) {
    var p = { semaine: semaine || lundiDe(), jours: jours || {}, le: new Date().toISOString() };
    try { localStorage.setItem(cleProg(), JSON.stringify(p)); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('natty:programme-pret', { detail: p })); } catch (e) {}
    return p;
  }

  /** Les groupes programmés pour un jour, ou null si la semaine n'est pas programmée. */
  function prevuLe(j) {
    var p = programme(lundiDe(dateDe(j)));
    if (!p) return null;
    var g = p.jours[j];
    return g ? (g.length ? g : []) : null;   // [] = repos explicite
  }

  /**
   * LE BESOIN CALORIQUE DU JOUR — l'objectif, adapté à l'entraînement.
   *
   * @param {string} j     le jour visé
   * @param {number} poids
   * @param {number} base  la dépense de maintien (`onboarding.tdee`)
   * @returns {{base, seance, lendemain, total, source, groupes, mesure, txt}}
   */
  function besoin(j, poids, base) {
    j = j || aujourdhui();
    base = Math.round(+base || 0);
    var out = { base: base, seance: 0, lendemain: 0, total: base,
                source: 'aucune', groupes: [], mesure: false, txt: '' };
    if (!base || !poids) return out;

    // 1. Ce qui a été NOTÉ ce jour-là : une mesure, elle passe avant tout.
    var s = duJour(j);
    if (s) {
      out.seance = kcal(s, poids);
      out.source = 'notee'; out.mesure = true; out.groupes = groupes(s);
    } else {
      // 2. Ce qui est PROGRAMMÉ.
      var prev = prevuLe(j);
      if (prev && prev.length) {
        var k = kcalProgramme(prev, poids);
        out.seance = k.kcal; out.source = 'programmee'; out.mesure = k.mesure; out.groupes = prev;
      } else if (prev && !prev.length) {
        out.source = 'repos';        // repos programmé : rien à ajouter, et c'est dit
      } else {
        // 3. L'HABITUDE de ce jour de semaine, et seulement si c'en est une.
        var h = habitude(jourSemaine(j), poids);
        if (h.frequence >= SEUIL_HABITUDE && h.kcal) {
          out.seance = h.kcal; out.source = 'habitude'; out.mesure = true;
          out.groupes = h.groupes; out.freq = h;
        } else if (h.n) {
          out.source = 'irreguliere'; out.freq = h;
        }
      }
    }

    /* Le lendemain d'une séance : la reconstruction. On regarde ce qui a été
       NOTÉ la veille — pas ce qui était prévu : une séance prévue et pas faite
       ne se reconstruit pas. */
    var v = duJour(veille(j));
    if (v) out.lendemain = Math.round(kcal(v, poids) * PART_LENDEMAIN);

    var brut = base + out.seance + out.lendemain;
    out.total = Math.round(brut / PAS_KCAL) * PAS_KCAL;
    out.txt = phraseBesoin(out);
    return out;
  }

  /** La phrase qui dit d'où vient le supplément. Sans elle, l'objectif change
      tout seul d'un jour à l'autre et ça se lit comme un bug. */
  function phraseBesoin(b) {
    var sup = b.total - b.base;
    if (!sup) {
      if (b.source === 'repos') return 'Jour de repos programmé : votre objectif de base.';
      if (b.source === 'irreguliere') return 'Pas d’habitude établie ce jour-là — objectif de base.';
      return 'Votre objectif de base, sans entraînement prévu.';
    }
    var bouts = [];
    if (b.seance) {
      var nomG = b.groupes.map(function (c) {
        var g = groupeParCle(c); return g ? g.nom.toLowerCase() : c;
      }).slice(0, 2).join(' et ');
      if (b.source === 'notee') bouts.push('votre séance' + (nomG ? ' ' + nomG : '') + ' du jour (' + b.seance + ' kcal dépensées)');
      else if (b.source === 'programmee') bouts.push('la séance' + (nomG ? ' ' + nomG : '') + ' que vous avez programmée'
        + (b.mesure ? ' (~' + b.seance + ' kcal, d’après les vôtres)' : ' (~' + b.seance + ' kcal, ordre de grandeur)'));
      else bouts.push('vos séances' + (nomG ? ' ' + nomG : '') + ' habituelles ce jour-là ('
        + (b.freq ? b.freq.n + ' fois sur ' + b.freq.sur + ', ' : '') + '~' + b.seance + ' kcal)');
    }
    if (b.lendemain) bouts.push('la reconstruction du lendemain de séance (' + b.lendemain + ' kcal)');
    return '+' + sup + ' kcal aujourd’hui : ' + bouts.join(', et ') + '.';
  }

  /* ── Ce que CHAQUE exercice coûte et rapporte ─────────────
     Tout part d'ici : la durée, l'énergie et le stimulus de la séance sont des
     SOMMES sur les exercices, jamais un forfait appliqué à un total de séries.
     C'est ce qui fait que corriger une seule ligne de reps déplace les trois. */

  /**
   * La durée d'un exercice, en secondes : temps sous tension + récupération.
   * Le cardio est saisi en minutes, le gainage en secondes — dans les deux cas
   * la valeur saisie EST la durée, il n'y a rien à modéliser.
   */
  function dureeExo(e) {
    var ser = (e && e.series) || [], t = typeDe(e);
    if (!ser.length) return 0;
    var somme = ser.reduce(function (a, b) { return a + (+b || 0); }, 0);
    if (t === 'cardio') return somme * 60;
    if (t === 'stat') return somme + ser.length * REPOS_S.stat;
    return somme * (SEC_PAR_REP[t] || SEC_PAR_REP.guide) + ser.length * (REPOS_S[t] || REPOS_S.guide);
  }

  /**
   * L'énergie d'un exercice, en kcal, EN PLUS de la dépense de repos.
   *
   * ⚠️ ON RETIRE 1 MET, ET CE N'EST PAS UN DÉTAIL. Un MET vaut le métabolisme
   * de repos : la dépense quotidienne (`onboarding.tdee`) le compte DÉJÀ pour
   * les 24 h de la journée, séance comprise. Utiliser le MET brut compterait
   * une heure de repos deux fois — soit ~70 kcal offertes par heure de salle,
   * donc ~9 g de graisse par séance qui n'ont pas été puisés. C'est le genre de
   * cadeau qui rend un bilan flatteur et faux.
   */
  function kcalExo(e, poids, sauf) {
    if (!e || !poids) return 0;
    return Math.max(0, (metEffectif(e, poids, sauf) - 1) * poids * (dureeExo(e) / 3600));
  }

  /**
   * Le MET d'un exercice, corrigé par l'intensité réellement chargée.
   * Neutre — donc strictement le MET de la table — quand aucune charge n'est
   * saisie ou qu'il n'y a rien à quoi la comparer.
   */
  function metEffectif(e, poids, sauf) {
    var base = +e.met || 5;
    var i = intensiteRelative(e, poids, sauf);
    if (i == null) return base;
    return base * borne(i, INT_MET_MIN, INT_MET_MAX);
  }

  /** Le facteur d'intensité appliqué au volume, neutre sans charge saisie. */
  function facteurCharge(e, poids, sauf) {
    var i = intensiteRelative(e, poids, sauf);
    if (i == null) return 1;
    return borne(i, INT_STIM_MIN, INT_STIM_MAX);
  }

  /**
   * Ce qu'une série de `r` répétitions vaut comme volume, entre 0 et 1.
   *
   * ⚠️ CE N'EST PAS UN MUR, et c'est important : une série de 2 reps ne vaut pas
   * zéro (elle développe de la force, donc la capacité à charger plus la fois
   * suivante) et une série de 30 reps non plus. Le déclin est linéaire de part
   * et d'autre de la plage pleine — sinon deux séances quasi identiques
   * tomberaient de chaque côté d'un seuil et donneraient des résultats très
   * différents pour rien.
   */
  function poidsSerie(r) {
    r = +r || 0;
    if (r <= 0) return 0;
    if (r < REPS_MIN) return 0.45;
    if (r < REPS_PLEIN_BAS) return 0.45 + 0.55 * (r - REPS_MIN) / (REPS_PLEIN_BAS - REPS_MIN);
    if (r <= REPS_PLEIN_HAUT) return 1;
    if (r >= REPS_MAX) return 0.75;
    return 1 - 0.25 * (r - REPS_PLEIN_HAUT) / (REPS_MAX - REPS_PLEIN_HAUT);
  }

  /**
   * Le volume PONDÉRÉ d'une séance : Σ (poids de la série × recrutement du
   * mouvement). C'est l'unité dans laquelle le stimulus se mesure.
   *
   * ⚠️ Le gainage et le cardio sont comptés SÉRIE PAR SÉRIE eux aussi, mais avec
   * un recrutement faible : une heure de vélo ne remplit pas le stimulus de
   * croissance, et le modèle doit pouvoir le dire au lieu de compter des séries
   * indistinctement.
   */
  function volumePondere(s, poids) {
    if (!s || !s.exos) return 0;
    return s.exos.reduce(function (tot, e) {
      var k = (STIM[typeDe(e)] || 1) * facteurCharge(e, poids, s.jour);
      return tot + (e.series || []).reduce(function (a, r) { return a + poidsSerie(r) * k; }, 0);
    }, 0);
  }

  /** Les séries qui tombent dans la plage pleine — ce qu'on affiche. */
  function seriesEfficaces(s) {
    if (!s || !s.exos) return 0;
    return s.exos.reduce(function (n, e) {
      if (typeDe(e) === 'cardio') return n;
      return n + (e.series || []).filter(function (r) {
        return r >= REPS_PLEIN_BAS && r <= REPS_PLEIN_HAUT;
      }).length;
    }, 0);
  }

  /** La durée en minutes : celle qui a été saisie, sinon la somme des exercices. */
  function duree(s) {
    if (s && s.duree_min) return s.duree_min;
    if (!s || !s.exos || !s.exos.length) return 0;
    var sec = s.exos.reduce(function (n, e) { return n + dureeExo(e); }, 0);
    // Repli pour une ligne ancienne dont les exercices n'ont aucune série.
    return sec ? Math.round(sec / 60) : Math.round(series(s) * MIN_PAR_SERIE);
  }

  /** L'équivalent métabolique moyen, pondéré par la DURÉE de chaque exercice. */
  function met(s, poids) {
    var d = 0, som = 0;
    ((s && s.exos) || []).forEach(function (e) {
      var t = dureeExo(e);
      d += t; som += t * metEffectif(e, poids, s && s.jour);
    });
    return d ? som / d : 5;
  }

  /**
   * La part de la séance qui vient de mouvements polyarticulaires lourds, entre
   * 0 et 1 — c'est elle qui règle l'ampleur de l'après-séance (EPOC).
   */
  function partPoly(s) {
    var n = 0, p = 0;
    ((s && s.exos) || []).forEach(function (e) {
      var k = (e.series || []).length;
      n += k; if (typeDe(e) === 'poly') p += k;
    });
    return n ? p / n : 0;
  }

  /**
   * L'énergie dépensée par la séance, en kcal, EN PLUS de la dépense
   * quotidienne — et c'est tout l'intérêt du « en plus ».
   *
   * Somme exercice par exercice, plus l'après-séance. Deux séances de sept
   * séries ne donnent donc PAS le même chiffre : les reps saisies, le type de
   * mouvement et le MET de chaque exercice y entrent tous.
   */
  function kcal(s, poids) {
    if (!s || !poids) return 0;
    var base = ((s && s.exos) || []).reduce(function (n, e) { return n + kcalExo(e, poids, s.jour); }, 0);
    if (!base) return 0;
    return Math.max(0, r0(base * (1 + epocCoef(s))));
  }

  /** Le coefficient d'après-séance, réglé par la composition de la séance. */
  function epocCoef(s) {
    return EPOC_MIN + (EPOC_MAX - EPOC_MIN) * partPoly(s);
  }

  /** L'énergie de la séance SANS l'après-séance — pour la ligne de détail. */
  function kcalEffort(s, poids) {
    if (!s || !poids) return 0;
    return r0(((s && s.exos) || []).reduce(function (n, e) { return n + kcalExo(e, poids, s.jour); }, 0));
  }

  /**
   * La décomposition complète d'une séance, pour l'écran qui l'explique.
   * Rendre les morceaux plutôt qu'un total, c'est ce qui permet au bilan
   * d'écrire « 112 kcal, dont 11 d'après-séance » sans refaire le calcul.
   */
  function detail(s, poids) {
    var parExo = ((s && s.exos) || []).map(function (e) {
      var i = intensiteRelative(e, poids, s && s.jour);
      return { nom: e.nom, type: typeDe(e), series: (e.series || []).length,
               reps: (e.series || []).reduce(function (a, b) { return a + (+b || 0); }, 0),
               min: Math.round(dureeExo(e) / 60),
               charge: chargeDe(e, 0), chargeTxt: resumeCharge(e),
               tonnage: tonnageExo(e, poids),
               intensite: i == null ? null : Math.round(i * 100),
               kcal: r0(kcalExo(e, poids, s && s.jour)) };
    });
    return {
      series: series(s), reps: reps(s), efficaces: seriesEfficaces(s),
      volume: Math.round(volumePondere(s, poids) * 10) / 10,
      tonnage: tonnage(s, poids),
      minutes: duree(s), met: Math.round(met(s, poids) * 10) / 10,
      partPoly: Math.round(partPoly(s) * 100),
      kcalEffort: kcalEffort(s, poids),
      kcalEpoc: r0(kcal(s, poids) - kcalEffort(s, poids)),
      kcal: kcal(s, poids),
      exos: parExo
    };
  }

  /**
   * Le stimulus de construction musculaire, entre 0 et 1.
   *
   * ⚠️ LA VEILLE COMPTE POUR MOITIÉ, et c'est ce qui évite l'absurdité
   * principale : la synthèse protéique reste élevée environ 48 h après une
   * séance. Sans ce report, un jour de repos entre deux séances afficherait
   * « 0 g de muscle » alors que c'est précisément le jour où il se construit.
   *
   * @param {Object} auj   la séance du jour, ou null
   * @param {Object} hier  celle de la veille, ou null
   */
  function stimulus(auj, hier, poids) {
    var eff = volumePondere(auj, poids) + volumePondere(hier, poids) / 2;
    return borne(eff / VOLUME_PLEIN, 0, 1);
  }

  /**
   * Combien de JOURS DISTINCTS chaque groupe travaillé le `jour` a été sollicité
   * sur les sept jours qui précèdent (celui-là compris).
   *
   * ⚠️ POURQUOI LA FRÉQUENCE ENTRE DANS LE CALCUL. À volume hebdomadaire égal,
   * un muscle travaillé deux fois dans la semaine construit davantage qu'une
   * seule grosse séance : la synthèse protéique retombe après ~48 h, et la
   * seconde sollicitation la relance. C'est l'un des rares points sur lesquels
   * la littérature est franchement consensuelle, et il est INVISIBLE pour un
   * modèle qui ne regarde que la journée — donc invisible dans l'ancien.
   *
   * @returns {number} 1 quand chaque groupe n'a été vu qu'une fois, jusqu'à 2+
   */
  function frequenceGroupes(jour) {
    var g = groupes(duJour(jour));
    if (!g.length) return 0;
    var t = toutes(), compte = {};
    g.forEach(function (c) { compte[c] = 0; });
    var d = dateDe(jour);
    for (var i = 0; i < 7; i++) {
      var j = jourDe(d), sj = t[j];
      if (sj) groupes(sj).forEach(function (c) { if (compte[c] != null) compte[c]++; });
      d.setDate(d.getDate() - 1);
    }
    // La moyenne sur les groupes du jour : une séance qui mêle un groupe vu
    // deux fois et un groupe vu une fois est entre les deux, pas au maximum.
    var som = g.reduce(function (a, c) { return a + compte[c]; }, 0);
    return som / g.length;
  }

  /**
   * La QUALITÉ D'ENTRAÎNEMENT d'une journée, entre 0 et 1 — ce que le bilan
   * multiplie. Deux termes, et chacun vient de la saisie :
   *   • le volume pondéré sur 48 h, rapporté au volume plein ;
   *   • la fréquence hebdomadaire des groupes travaillés.
   *
   * ⚠️ La fréquence MODULE, elle ne commande pas : de 0,85 (un seul passage sur
   * le groupe cette semaine) à 1,0 (deux ou plus). Lui donner plus de poids
   * ferait dépendre le chiffre du jour de ce qui s'est passé les six jours
   * précédents plus que de la séance elle-même — et personne ne comprendrait
   * pourquoi la même séance ne vaut pas la même chose.
   */
  function qualiteEntrainement(jour, hier, poids) {
    var sAuj = duJour(jour), sHier = duJour(hier);
    var vol = stimulus(sAuj, sHier, poids);
    var pondere = Math.round(volumePondere(sAuj, poids) * 10) / 10;
    var tg = tonnage(sAuj, poids);
    if (!vol) {
      return { note: 0, volume: 0, volumePondere: pondere, tonnage: tg,
               frequence: 0, fFreq: 0 };
    }
    var f = frequenceGroupes(jour) || frequenceGroupes(hier) || 1;
    var fFreq = 0.85 + 0.15 * borne((f - 1) / 1, 0, 1);
    return { note: borne(vol * fFreq, 0, 1), volume: vol, volumePondere: pondere,
             tonnage: tg, frequence: f, fFreq: fFreq };
  }

  /**
   * Cette personne journalise-t-elle ses séances ?
   *
   * ⚠️ C'EST LE GARDE-FOU DE NON-RÉGRESSION, et il n'est pas décoratif. Le
   * bilan module désormais le muscle par le stimulus du jour ; appliqué à
   * quelqu'un qui n'a jamais ouvert cet écran, ce facteur vaudrait 0 tous les
   * jours et ses estimations FONDRAIENT du jour au lendemain, sans qu'il ait
   * rien changé à sa vie. Tant qu'aucune séance n'a été notée sur la période,
   * le bilan garde donc exactement le modèle d'avant.
   */
  function utilise(nbJours) {
    var t = toutes(), n = nbJours || 21, d = new Date();
    for (var i = 0; i < n; i++) {
      var j = jourDe(d);
      if (t[j] && (series(t[j]) || t[j].libre)) return true;
      d.setDate(d.getDate() - 1);
    }
    return false;
  }

  /** Une ligne de texte : « Dos · 12 séries · 124 reps · ~48 min ». */
  function resume(s, poids) {
    if (!s) return '';
    if (!series(s) && s.libre) return s.libre;
    var g = groupes(s).map(function (c) {
      var d = groupeParCle(c); return d ? d.nom : c;
    });
    var n = series(s);
    /* Le tonnage ne s'ajoute que si `poids` est fourni ET qu'une charge a été
       saisie : sans l'un ou l'autre, la ligne est exactement celle d'avant. Les
       mouvements au poids du corps ont besoin du poids pour peser quelque
       chose — l'omettre annoncerait « 0 t » sur une séance de tractions. */
    var tg = poids ? tonnage(s, poids) : 0;
    return g.join(' · ') + ' · ' + n + ' série' + (n > 1 ? 's' : '')
      + ' · ' + reps(s) + ' reps · ~' + duree(s) + ' min'
      + (tg ? ' · ' + fmtKg(tg / 1000) + ' t' : '');
  }

  /** Les séances des `nb` derniers jours, du plus ancien au plus récent. */
  function serie(nb) {
    var out = [], d = new Date();
    d.setDate(d.getDate() - (nb - 1));
    for (var i = 0; i < nb; i++) {
      var j = jourDe(d);
      out.push({ jour: j, seance: duJour(j) });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /* ═══ 5. La saisie libre ═════════════════════════════════
     « On peut écrire à la main » (Pablo). Le texte est analysé ICI, sans
     réseau : « développé couché 4x10, tirage 3x12 » devient la même structure
     que le parcours en trois taps. Deux entrées, une seule sortie — sinon la
     séance écrite à la main ne compterait pas dans le bilan, et personne ne
     comprendrait pourquoi.

     ⚠️ Le texte brut est CONSERVÉ dans `libre` même quand l'analyse réussit :
     elle peut se tromper, et jeter ce que la personne a écrit rendrait l'erreur
     irréparable. */
  function analyserTexte(txt) {
    var out = [];
    String(txt || '').split(/[\n,;]+/).forEach(function (ligne) {
      var t = ligne.trim();
      if (!t) return;
      /* La CHARGE se lit AVANT les séries, et l'unité est EXIGÉE — « kg », ou
         un « @ » à la mode des carnets. Sans cette exigence, « 4x10 » offrirait
         deux nombres à confondre avec un poids, et « 20 min » de vélo
         deviendrait 20 kg. On retire le morceau reconnu du nom : laissé là,
         « 80kg » resterait dans le libellé de l'exercice. */
      var mc = /(?:@\s*(\d{1,3}(?:[.,]\d)?)|(?:à\s*)?(\d{1,3}(?:[.,]\d)?)\s*kgs?\b)/i.exec(t);
      var charge = mc ? Math.min(500, Math.max(0,
        parseFloat(String(mc[1] || mc[2]).replace(',', '.')) || 0)) : null;
      if (mc) t = t.replace(mc[0], ' ');
      // « 4x10 », « 4 x 10 », « 4*10 », « 4 séries de 10 »
      var m = /(\d{1,2})\s*(?:x|\*|séries?\s*(?:de)?)\s*(\d{1,3})/i.exec(t);
      var nom = t.replace(/(\d{1,2})\s*(?:x|\*|séries?\s*(?:de)?)\s*(\d{1,3})/i, '')
                 .replace(/\breps?\b|\brépétitions?\b/i, '')
                 .replace(/[-–:•]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!nom) return;
      var ref = trouverExo(nom);
      var nb = m ? borne(+m[1], 1, 12) : 3;
      var rp = m ? borne(+m[2], 1, 300) : (ref ? ref.rep : 10);
      /* 🔴 « Vélo 20 min » VALAIT 3 × 15 MIN, soit 45 minutes de vélo pour 20
         annoncées — donc plus du double de calories. Défaut PRÉEXISTANT, trouvé
         au banc en écrivant les essais de la charge : sans motif « n × n », la
         ligne retombait sur le forfait « 3 séries de la valeur type », qui n'a
         aucun sens pour une durée. Un exercice qui se compte en minutes ou en
         secondes et qui porte un nombre suivi de son unité vaut UNE série de
         cette durée. L'unité est exigée, comme pour les kilos. */
      if (!m && ref && (ref.unite === 'min' || ref.unite === 's')) {
        var md = ref.unite === 'min'
          ? /(\d{1,3})\s*(?:min\b|minutes?\b|’|')/i.exec(t)
          : /(\d{1,3})\s*(?:s\b|sec\b|secondes?\b|")/i.exec(t);
        if (md) { nb = 1; rp = borne(+md[1], 1, 300); }
      }
      var ser = [];
      for (var i = 0; i < nb; i++) ser.push(rp);
      out.push({
        cle: ref ? ref.cle : '', g: ref ? ref.g : '',
        nom: ref ? ref.nom : nom.charAt(0).toUpperCase() + nom.slice(1),
        ic: ref ? ref.ic : 'haltere', unite: (ref && ref.unite) || '',
        met: ref ? ref.met : 5, pdc: (ref && ref.pdc) || 0,
        charge: charge, charges: null, series: ser
      });
    });
    return out;
  }

  /* ⚠️ Rapprochement MOT À MOT, jamais en sous-chaîne. « curl » se trouve dans
     « curl-pupitre » aussi bien que dans « curl-barre », et une sous-chaîne
     ferait gagner le premier déclaré — le défaut qui faisait de « pomme de
     terre » une pomme dans `core.js`. Le libellé le plus long gagne. */
  function normNom(s) {
    /* ⚠️ LES LIGATURES SE TRADUISENT AVANT `normalize('NFD')`, ET PAS APRÈS.
       `œ` et `æ` sont des lettres à part entière en Unicode : NFD ne les
       décompose pas, donc `[^a-z0-9]` les remplacerait par une espace et
       « bœuf » deviendrait « b uf ». C'est le défaut qui a fait qu'aucun œuf
       n'était reconnu dans toute l'app pendant des mois (§7 de CLAUDE.md).
       Aucun exercice n'en porte aujourd'hui — mais « soulevé de terre » se
       tape aussi « souleve », et la règle vaut d'être la même partout. */
    return String(s || '').toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function trouverExo(nom) {
    var mots = normNom(nom).split(' ').filter(Boolean);
    if (!mots.length) return null;
    var best = null, bestN = 0;
    EXOS.forEach(function (e) {
      var em = normNom(e.nom).split(' ').filter(Boolean);
      var ok = em.every(function (m) { return mots.indexOf(m) > -1; });
      if (ok && em.length > bestN) { best = e; bestN = em.length; }
    });
    if (best) return best;
    // Un seul mot en commun suffit en dernier recours (« tirage », « squat »).
    EXOS.forEach(function (e) {
      var em = normNom(e.nom).split(' ').filter(Boolean);
      em.forEach(function (m) {
        if (m.length > 3 && mots.indexOf(m) > -1 && m.length > bestN) { best = e; bestN = m.length; }
      });
    });
    return best;
  }

  /* ═══ 6. Le style ════════════════════════════════════════
     NOIR dans les deux thèmes, comme `assets/planning.js` et `assets/ajout.js`
     — c'est une mise en scène, pas une surface d'interface : on est dans la
     salle, l'écran est sombre et les chiffres sont ce qui brille. Ne pas
     « corriger » ses `#fff`.
     Le PANNEAU (`monterPanneau`), lui, s'invite sur un écran clair : il passe
     par les jetons `--nt-*` d'`assets/theme.js`, le seul fichier que toutes les
     pages chargent. */
  var cssPose = false;
  function css() {
    if (cssPose) return;
    cssPose = true;
    var s = document.createElement('style');
    s.textContent = [
      '#nsea{position:fixed;inset:0;z-index:9700;background:#0b0b0e;color:#fff;',
      'font-family:Inter,-apple-system,sans-serif;opacity:0;pointer-events:none;',
      'transition:opacity .3s ease;overflow:hidden}',
      '#nsea.on{opacity:1;pointer-events:auto}',
      /* ⚠️ SANS CETTE LIGNE, L'ÉCRAN AVALE LES TAPS APRÈS SA FERMETURE. Il se
         referme en retirant `.on`, donc en fondu, et son nœud reste dans la
         page le temps de la transition : invisible, et parfaitement cliquable.
         C'est la règle 41 de CLAUDE.md, payée sur neuf écrans. */
      '#nsea:not(.on){pointer-events:none}',
      /* Pare-feu, même raison que `#nbil *` : les classes internes sont
         courtes (`.d`, `.v`, `.l`) et les pages hôtes peuvent les avoir prises. */
      '#nsea *{margin:0;padding:0;border:0;box-sizing:border-box}',
      '#nsea button{font-family:inherit;border:none;cursor:pointer;color:inherit;',
      'background:none;-webkit-tap-highlight-color:transparent}',
      '#nsea .ic{width:26px;height:26px;stroke:currentColor;fill:none;stroke-width:1.7;',
      'stroke-linecap:round;stroke-linejoin:round}',

      /* Barre du haut : retour, titre, fermer. */
      '#nsea .bar{position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:center;',
      'gap:10px;padding:calc(14px + env(safe-area-inset-top,0px)) 16px 12px;',
      'background:linear-gradient(180deg,#0b0b0e 55%,rgba(11,11,14,0))}',
      '#nsea .bar .t{flex:1;font-size:13px;font-weight:800;letter-spacing:.6px;',
      'text-transform:uppercase;color:#8b8b96;text-align:center}',
      '#nsea .bar button{width:34px;height:34px;border-radius:50%;background:#181820;',
      'display:flex;align-items:center;justify-content:center;font-size:15px;flex:none}',
      '#nsea .bar button.gh{background:none}',

      /* Colonne défilante. `flex-start`, jamais `center` : le contenu n'a pas
         la même hauteur d'une scène à l'autre, et en `center` tout remonte et
         redescend entre deux plans (le faux raccord de `journee.js`). */
      '#nsea .col{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;',
      'padding:calc(74px + env(safe-area-inset-top,0px)) 18px ',
      'calc(128px + env(safe-area-inset-bottom,0px))}',
      '#nsea .zone{width:100%;max-width:430px;position:relative}',
      '#nsea .sc{width:100%;animation:nsIn .34s cubic-bezier(.22,1,.36,1) both}',
      '#nsea .sc.sort{position:absolute;left:0;right:0;top:0;pointer-events:none;',
      'animation:nsOut .28s cubic-bezier(.4,0,1,1) forwards}',
      '@keyframes nsIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
      '@keyframes nsOut{to{opacity:0;transform:translateY(-10px)}}',

      '#nsea h1{font-size:29px;font-weight:900;letter-spacing:-1.1px;line-height:1.1}',
      '#nsea .sous{font-size:13.5px;color:#9a9aa6;line-height:1.5;margin-top:9px}',
      '#nsea .kick{font-size:11.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;',
      'color:#6f6f7b;margin-bottom:7px}',

      /* Barre d'action, FIXE en bas. Dans le plan, l'animation de sortie
         l'emporte et le bouton disparaît sous le doigt (narration.html). */
      '#nsea .cta{position:absolute;left:0;right:0;bottom:0;z-index:4;display:flex;',
      'flex-direction:column;gap:9px;align-items:center;',
      'padding:22px 18px calc(18px + env(safe-area-inset-bottom,0px));',
      'background:linear-gradient(0deg,#0b0b0e 62%,rgba(11,11,14,0))}',
      '#nsea .cta button{width:100%;max-width:430px;padding:17px;border-radius:17px;',
      'background:#fff;color:#0b0b0e;font-size:15.5px;font-weight:800;letter-spacing:-.2px}',
      '#nsea .cta button:active{transform:scale(.985)}',
      '#nsea .cta button.b2{background:#1c1c24;color:#fff}',
      '#nsea .cta button.b3{background:none;color:#8b8b96;font-size:13.5px;padding:6px;font-weight:700}',
      '#nsea .cta button[disabled]{opacity:.32}',

      /* ── Le calendrier ──────────────────────────────────── */
      '#nsea .mois{display:flex;align-items:center;justify-content:space-between;',
      'gap:10px;margin:18px 0 12px}',
      '#nsea .mois .m{font-size:15px;font-weight:800;letter-spacing:-.3px;text-transform:capitalize}',
      '#nsea .mois button{width:34px;height:34px;border-radius:50%;background:#181820;',
      'font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center}',
      '#nsea .sem7{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}',
      '#nsea .sem7 .hd{font-size:10px;font-weight:800;color:#5f5f6b;text-align:center;padding:2px 0 4px}',
      /* ⚠️ PAS d'`aspect-ratio:1/1` sur une case. À 375 px de large elle ferait
         ~48 px, donc six rangées de plus de 300 px : le résumé de la semaine et
         le bouton d'action partiraient sous la ligne de flottaison. Hauteur
         fixe, mesurée à l'écran — même arbitrage que `planning.js`. */
      '#nsea .cj{position:relative;height:52px;border-radius:13px;background:#14141b;',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;',
      'font-size:13px;font-weight:700;color:#c9c9d2;overflow:hidden}',
      '#nsea .cj.vide{background:none}',
      '#nsea .cj.futur{color:#3d3d47;background:#0f0f15}',
      '#nsea .cj.auj{box-shadow:inset 0 0 0 1.6px #fff}',
      '#nsea .cj.faite{background:#1d3a24;color:#fff}',
      '#nsea .cj.faite .n{color:#5ad07a;font-size:9.5px;font-weight:800}',
      /* Le « + » de chaque jour. ⚠️ Il était à 11 px et #4a4a55 : relevé sur
         capture, on ne le voyait pas — or c'est L'affordance de toute la
         fonctionnalité, celle que Pablo a décrite (« chaque jour il y a un
         bouton + ajouter une séance »). Un geste qu'on ne devine pas n'existe
         pas. Il reste dans le coin plutôt qu'au centre : sous le numéro du jour
         il ferait deux chiffres empilés dans 52 px de haut, illisibles. */
      '#nsea .cj .p{position:absolute;right:5px;bottom:3px;font-size:15px;color:#7b7b8a;',
      'line-height:1;font-weight:700}',
      '#nsea .cj:active{transform:scale(.94)}',
      '#nsea .rec{display:flex;gap:9px;margin-top:14px}',
      '#nsea .rec .r{flex:1;background:#14141b;border-radius:15px;padding:13px 10px;text-align:center}',
      '#nsea .rec .r .v{font-size:21px;font-weight:900;letter-spacing:-.8px}',
      '#nsea .rec .r .l{font-size:10px;color:#7d7d89;margin-top:3px;font-weight:700;line-height:1.25}',

      /* ── Tuiles : groupes, machines ──────────────────────── */
      '#nsea .tuiles{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:20px}',
      '#nsea .tu{position:relative;background:#14141b;border-radius:17px;padding:16px 13px;',
      'display:flex;flex-direction:column;align-items:flex-start;gap:11px;text-align:left;',
      'transition:transform .16s cubic-bezier(.22,1,.36,1),background .16s ease}',
      '#nsea .tu .n{font-size:14px;font-weight:800;letter-spacing:-.2px}',
      '#nsea .tu .s{font-size:10.5px;color:#7d7d89;font-weight:700}',
      '#nsea .tu:active{transform:scale(.96)}',
      '#nsea .tu.on{background:#fff;color:#0b0b0e}',
      '#nsea .tu.on .s{color:#5c5c66}',
      /* La pastille de sélection : elle grandit d'un coup de ressort. Sans ce
         mouvement, un tap sur une tuile déjà sélectionnée ne se distingue pas
         d'un tap qui n'a rien fait. */
      '#nsea .tu .k{position:absolute;top:11px;right:11px;width:22px;height:22px;',
      'border-radius:50%;background:#0b0b0e;color:#fff;display:none;',
      'align-items:center;justify-content:center;animation:nsPop .26s cubic-bezier(.34,1.56,.64,1)}',
      '#nsea .tu .k svg{width:14px;height:14px;stroke-width:2.6}',
      '#nsea .tu.on .k{display:flex}',
      '@keyframes nsPop{from{transform:scale(0)}to{transform:scale(1)}}',
      '#nsea .tu.large{grid-column:1/-1;flex-direction:row;align-items:center;gap:13px}',

      /* ── Séries : les pastilles ──────────────────────────── */
      '#nsea .exo-h{display:flex;align-items:center;gap:13px;margin-top:18px}',
      '#nsea .exo-h .b{width:52px;height:52px;border-radius:16px;background:#14141b;flex:none;',
      'display:flex;align-items:center;justify-content:center}',
      '#nsea .exo-h .b svg{width:30px;height:30px}',
      '#nsea .prog{display:flex;gap:4px;margin-top:16px}',
      '#nsea .prog i{flex:1;height:3px;border-radius:2px;background:#20202a}',
      '#nsea .prog i.on{background:#fff}',
      '#nsea .lbl{font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;',
      'color:#6f6f7b;margin:26px 0 11px}',
      '#nsea .pills{display:flex;gap:7px}',
      '#nsea .pills button{flex:1;height:52px;border-radius:14px;background:#14141b;',
      'font-size:16px;font-weight:800;transition:transform .18s cubic-bezier(.34,1.56,.64,1),',
      'background .18s ease,color .18s ease}',
      /* Toutes les pastilles JUSQU'À celle qu'on touche s'allument : on choisit
         « quatre séries », pas « la quatrième ». Une seule pastille allumée se
         lisait comme un numéro d'ordre. */
      '#nsea .pills button.on{background:#fff;color:#0b0b0e}',
      '#nsea .pills button.on.der{transform:translateY(-4px)}',
      '#nsea .pills button:active{transform:scale(.93)}',

      /* ── Reps : une ligne par série ──────────────────────── */
      '#nsea .sets{display:flex;flex-direction:column;gap:8px}',
      '#nsea .set{display:flex;align-items:center;gap:11px;background:#14141b;',
      'border-radius:15px;padding:9px 11px;animation:nsIn .3s cubic-bezier(.22,1,.36,1) both}',
      '#nsea .set .i{width:24px;font-size:11px;font-weight:800;color:#6f6f7b;flex:none}',
      '#nsea .set .j{flex:1;height:6px;border-radius:3px;background:#20202a;overflow:hidden}',
      '#nsea .set .j i{display:block;height:100%;background:#5ad07a;border-radius:3px;',
      'transition:width .28s cubic-bezier(.22,1,.36,1)}',
      '#nsea .set .v{min-width:58px;text-align:right;font-size:17px;font-weight:900;',
      'letter-spacing:-.5px;flex:none}',
      '#nsea .set .v small{font-size:10.5px;font-weight:700;color:#7d7d89;margin-left:2px}',
      '#nsea .set .pm{display:flex;gap:5px;flex:none}',
      '#nsea .set .pm button{width:34px;height:34px;border-radius:50%;background:#20202a;',
      'font-size:17px;font-weight:800;line-height:1;display:flex;align-items:center;',
      'justify-content:center}',
      '#nsea .set .pm button:active{transform:scale(.9)}',
      /* ── La charge ────────────────────────────────────── */
      '#nsea .lbl .opt{margin-left:8px;font-size:9.5px;font-weight:700;letter-spacing:.3px;',
      'color:#5f5f6b;background:#181820;border-radius:999px;padding:3px 8px;',
      'text-transform:none}',
      '#nsea .chg{display:flex;align-items:center;gap:9px}',
      '#nsea .chg button{width:52px;height:52px;border-radius:15px;background:#14141b;',
      'font-size:22px;font-weight:800;line-height:1;flex:none;display:flex;',
      'align-items:center;justify-content:center}',
      '#nsea .chg button:active{transform:scale(.93)}',
      '#nsea .chg .cv{flex:1;height:52px;border-radius:15px;background:#14141b;',
      'display:flex;align-items:baseline;justify-content:center;gap:5px;padding:0 10px}',
      /* ⚠️ `appearance:none` ET les deux pseudo-éléments WebKit : un
         `input[type=number]` affiche sinon ses flèches natives, qui sur fond
         noir apparaissent en petit bloc blanc au bord du champ. */
      '#nsea .chg .cv input{width:100%;background:none;border:none;outline:none;color:#fff;',
      'font-family:inherit;font-size:26px;font-weight:900;letter-spacing:-1px;text-align:right;',
      'appearance:none;-webkit-appearance:none;padding:12px 0 0}',
      '#nsea .chg .cv input::-webkit-outer-spin-button,',
      '#nsea .chg .cv input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
      '#nsea .chg .cv input::placeholder{color:#4a4a55;font-weight:700}',
      '#nsea .chg .cv span{font-size:13px;font-weight:700;color:#7d7d89;padding-bottom:14px}',
      '#nsea .chgn{font-size:11px;color:#7d7d89;line-height:1.5;margin-top:8px}',
      '#nsea .det{margin-top:9px;font-size:11.5px;font-weight:700;color:#8b8b96;padding:4px 0}',
      /* La charge d'UNE série, dans la ligne — elle remplace la jauge.
         ⚠️ Le « kg » est POSÉ À CÔTÉ du champ, pas seulement en indication de
         saisie : rempli, un champ ne montre plus son indication, et la ligne se
         lisait « 3 · 75 · 8 reps » — deux nombres nus dont un sans unité. */
      '#nsea .set .ckw{flex:1;min-width:0;height:34px;border-radius:10px;background:#20202a;',
      'display:flex;align-items:center;justify-content:flex-end;gap:3px;padding-right:9px}',
      '#nsea .set .ck{flex:1;min-width:0;height:100%;background:none;',
      'border:none;outline:none;color:#fff;font-family:inherit;font-size:14px;font-weight:800;',
      'text-align:right;appearance:none;-webkit-appearance:none}',
      '#nsea .set .ck::-webkit-outer-spin-button,',
      '#nsea .set .ck::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}',
      '#nsea .set .ck::placeholder{color:#5f5f6b;font-weight:700}',
      '#nsea .set .ckw span{font-size:10.5px;font-weight:700;color:#7d7d89;flex:none}',

      /* ── Le programme de la semaine ───────────────────── */
      '#nsea .pjl{display:flex;flex-direction:column;gap:7px;margin-top:15px}',
      '#nsea .pj{background:#14141b;border-radius:16px;overflow:hidden}',
      '#nsea .pj.on{background:#181820;box-shadow:inset 0 0 0 1.6px #2c2c38}',
      '#nsea .pj .hd{display:flex;align-items:center;gap:11px;padding:12px 13px;width:100%;text-align:left}',
      '#nsea .pj .hd .j{width:42px;flex:none;font-size:12px;font-weight:900;letter-spacing:-.2px}',
      '#nsea .pj .hd .j small{display:block;font-size:9.5px;color:#6f6f7b;font-weight:700;margin-top:1px}',
      '#nsea .pj .hd .g{flex:1;min-width:0;font-size:12.5px;font-weight:800;color:#c9c9d2;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#nsea .pj .hd .g.rep{color:#6f6f7b;font-weight:700}',
      '#nsea .pj .hd .k{flex:none;font-size:11px;font-weight:800;color:#5ad07a}',
      '#nsea .pj .hd .k.z{color:#6f6f7b}',
      '#nsea .pj .ed{padding:0 11px 12px;display:flex;gap:6px;flex-wrap:wrap}',
      '#nsea .pj .ed button{padding:8px 12px;border-radius:999px;background:#20202a;',
      'font-size:11.5px;font-weight:800;color:#c9c9d2}',
      '#nsea .pj .ed button.on{background:#f4f4f7;color:#101014}',
      '#nsea .pj .ed button.rep{background:#181820;color:#8b8b96}',
      '#nsea .pj .ed button.rep.on{background:#2c2c38;color:#f4f4f7}',
      /* ── La progression ───────────────────────────────── */
      '#nsea .pgl{display:flex;flex-direction:column;gap:8px;margin-top:16px}',
      '#nsea .pgr{display:flex;align-items:center;gap:11px;background:#14141b;',
      'border-radius:16px;padding:12px 13px;width:100%;text-align:left}',
      '#nsea .pgr:active{transform:scale(.985)}',
      '#nsea .pgr .b{width:34px;height:34px;border-radius:11px;background:#20202a;flex:none;',
      'display:flex;align-items:center;justify-content:center}',
      '#nsea .pgr .b svg{width:19px;height:19px;stroke:#c9c9d2}',
      '#nsea .pgr .tx{flex:1;min-width:0}',
      '#nsea .pgr .tx .n{font-size:13.5px;font-weight:800;letter-spacing:-.2px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#nsea .pgr .tx .s{font-size:10.5px;color:#7d7d89;font-weight:700;margin-top:2px}',
      '#nsea .pgr .sp{flex:none;width:78px;height:30px}',
      '#nsea .pgr .d{flex:none;font-size:12px;font-weight:900;letter-spacing:-.3px;min-width:44px;text-align:right}',
      /* Le grand graphique du détail. Hauteur FERME : en `flex` il se ferait
         comprimer comme les barres du bilan (§3), et deux séances voisines
         se peindraient à la même hauteur. */
      '#nsea .pgc{background:#14141b;border-radius:18px;padding:16px 14px 12px;margin-top:14px}',
      '#nsea .pgc svg{width:100%;height:132px;display:block;overflow:visible}',
      '#nsea .pgc .ax{display:flex;justify-content:space-between;font-size:10px;',
      'color:#6f6f7b;font-weight:700;margin-top:8px}',
      '#nsea .pgc .lg{font-size:10.5px;color:#7d7d89;font-weight:700;margin-top:9px;line-height:1.5}',
      '#nsea .chips{display:flex;gap:7px;margin-top:11px;flex-wrap:wrap}',
      '#nsea .chips button{padding:9px 15px;border-radius:999px;background:#181820;',
      'font-size:12.5px;font-weight:800;color:#c9c9d2}',
      '#nsea .chips button:active{transform:scale(.94)}',
      '#nsea .vol{margin-top:16px;background:#14141b;border-radius:16px;padding:14px 16px;',
      'display:flex;align-items:baseline;gap:8px}',
      '#nsea .vol .v{font-size:24px;font-weight:900;letter-spacing:-1px}',
      '#nsea .vol .l{font-size:11.5px;color:#7d7d89;font-weight:700}',

      /* ── Récap et validation ────────────────────────────── */
      '#nsea .liste{display:flex;flex-direction:column;gap:7px;margin-top:18px}',
      '#nsea .li{display:flex;align-items:center;gap:11px;background:#14141b;',
      'border-radius:14px;padding:12px 13px}',
      '#nsea .li svg{width:22px;height:22px;flex:none;color:#8b8b96}',
      '#nsea .li .t{flex:1;font-size:13.5px;font-weight:700;text-align:left}',
      '#nsea .li .q{font-size:12px;font-weight:800;color:#5ad07a;flex:none}',
      '#nsea .li button.x{width:28px;height:28px;border-radius:50%;background:#20202a;',
      'font-size:12px;color:#8b8b96;flex:none}',
      '#nsea .note{font-size:11.5px;color:#6f6f7b;line-height:1.55;margin-top:16px}',
      '#nsea .vok{width:104px;height:104px;margin:26px auto 20px}',
      '#nsea .vok svg{width:100%;height:100%;fill:none;stroke-width:5;',
      'stroke-linecap:round;stroke-linejoin:round}',
      '#nsea .vok .rond{stroke:#5ad07a;stroke-dasharray:264;stroke-dashoffset:264;',
      'animation:nsTrace .8s cubic-bezier(.22,1,.36,1) forwards}',
      '#nsea .vok .co{stroke:#5ad07a;stroke-dasharray:70;stroke-dashoffset:70;',
      'animation:nsTrace .5s cubic-bezier(.22,1,.36,1) .55s forwards}',
      '@keyframes nsTrace{to{stroke-dashoffset:0}}',
      '#nsea .xp{font-size:15px;font-weight:800;color:#5ad07a;margin-top:6px}',
      '#nsea textarea{width:100%;min-height:150px;background:#14141b;border-radius:16px;',
      'padding:15px;color:#fff;font-family:inherit;font-size:14.5px;line-height:1.55;',
      'margin-top:18px;resize:none;outline:none}',
      '#nsea textarea::placeholder{color:#5f5f6b}',

      /* ── Le panneau « Mes séances » d'un écran hôte ─────── */
      '.nseaP{background:var(--nt-card,#ececef);color:var(--nt-ink,#101014);',
      'border-radius:22px;padding:17px 17px 15px;margin-top:14px}',
      '.nseaP .h{display:flex;align-items:center;gap:9px}',
      '.nseaP .h svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.7;',
      'stroke-linecap:round;stroke-linejoin:round;flex:none}',
      '.nseaP .h .t{flex:1;font-size:14.5px;font-weight:800;letter-spacing:-.2px}',
      '.nseaP .s{font-size:12px;color:var(--nt-muted,#8e8e99);line-height:1.5;margin-top:8px}',
      '.nseaP .w{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:13px}',
      '.nseaP .w .d{height:42px;border-radius:11px;background:var(--nt-bg,#f0f0f3);',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;',
      'font-size:11px;font-weight:800;color:var(--nt-muted,#8e8e99)}',
      '.nseaP .w .d.faite{background:#1d3a24;color:#fff}',
      '.nseaP .w .d.faite .k{color:#5ad07a;font-size:9px}',
      '.nseaP button.go{width:100%;margin-top:13px;padding:14px;border-radius:15px;',
      'background:var(--nt-ink,#101014);color:var(--nt-on-ink,#fff);font-family:inherit;',
      'font-size:14px;font-weight:800;border:none;cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══ 7. Le petit moteur de scènes ═══════════════════════
     Copié dans l'esprit de `planning.js` et `bilan.js` : une scène remplace la
     précédente, la sortante passe en `position:absolute` le temps de croiser
     l'entrante (sinon la hauteur du bloc saute), et le bouton d'action vit dans
     une barre FIXE. */

  var racine = null, zone = null, ctaEl = null, barreT = null;
  var scEnCours = null, scrollGele = '';
  var E = null;   // l'état du parcours en cours

  function monter() {
    css();
    if (racine) return racine;
    racine = document.createElement('div');
    racine.id = 'nsea';
    racine.innerHTML =
      '<div class="bar">'
      + '<button type="button" id="nsBack" class="gh" aria-label="Retour">‹</button>'
      + '<div class="t" id="nsTitre"></div>'
      + '<button type="button" id="nsX" aria-label="Fermer">✕</button>'
      + '</div>'
      + '<div class="col"><div class="zone" id="nsZone"></div></div>'
      + '<div class="cta" id="nsCta"></div>';
    document.body.appendChild(racine);
    zone = racine.querySelector('#nsZone');
    ctaEl = racine.querySelector('#nsCta');
    barreT = racine.querySelector('#nsTitre');
    racine.querySelector('#nsX').addEventListener('click', fermer);
    racine.querySelector('#nsBack').addEventListener('click', function () {
      if (E && E.retour) E.retour(); else fermer();
    });
    scrollGele = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    /* ⚠️ La rAF SEULE ne suffit pas : elle ne se déclenche pas si la page ne
       peint pas (app en arrière-plan, onglet caché), et un calque opaque resté
       à `opacity:0` intercepterait quand même les taps. Même précaution que
       `Natty.confirmer` et `assets/generation.js`. */
    requestAnimationFrame(function () { if (racine) racine.classList.add('on'); });
    setTimeout(function () { if (racine) racine.classList.add('on'); }, 60);
    return racine;
  }

  function fermer() {
    if (!racine) return;
    var r = racine, apres = E && E.apres;
    racine = null; zone = null; ctaEl = null; barreT = null; scEnCours = null; E = null;
    r.classList.remove('on');
    document.body.style.overflow = scrollGele || '';
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 340);
    if (apres) { try { apres(); } catch (e) {} }
  }

  function enTete(t, retour) {
    if (barreT) barreT.textContent = t || '';
    if (E) E.retour = retour || null;
    var b = racine && racine.querySelector('#nsBack');
    if (b) b.style.visibility = retour ? 'visible' : 'hidden';
  }

  function scene(o) {
    if (!racine) return null;
    var vieux = scEnCours;
    if (vieux) {
      vieux.classList.add('sort');
      setTimeout(function () { if (vieux.parentNode) vieux.parentNode.removeChild(vieux); }, 300);
    }
    var d = document.createElement('div');
    d.className = 'sc';
    d.innerHTML = o.html || '';
    zone.appendChild(d);
    scEnCours = d;

    ctaEl.innerHTML = '';
    (o.boutons || []).forEach(function (b) {
      if (!b) return;
      var el = document.createElement('button');
      el.type = 'button';
      el.className = b.cls || 'b1';
      el.textContent = b.txt;
      if (b.off) el.setAttribute('disabled', 'disabled');
      el.addEventListener('click', function () { if (b.on) b.on(el); });
      ctaEl.appendChild(el);
    });
    if (o.pret) o.pret(d);

    /* ⚠️ LA RÉSERVE DU BAS SE MESURE, ET NE REDESCEND JAMAIS. Figée à 128 px
       dans le CSS, elle suffisait à un bouton et pas à deux : mesuré, la barre
       d'action fait 130 px avec un bouton principal et un lien discret, donc la
       dernière ligne du calendrier — « gardées sur cet appareil uniquement » —
       se peignait DERRIÈRE elle et n'était plus lisible.
       Et jamais réduite : la réécrire à chaque scène la ferait remonter puis
       redescendre, ce qui déplace toute la composition entre deux plans (le
       faux raccord de `journee.js`, puis de `bilan.js`).
       ⚠️ `offsetHeight` de la barre inclut DÉJÀ son propre retrait de zone
       sûre : la recalculer à la main ici la compterait deux fois. */
    var col = racine.querySelector('.col');
    /* ⚠️⚠️ LA rAF SEULE NE SUFFIT PAS, et ce n'est pas une précaution de
       principe : une page qui ne PEINT pas n'en reçoit AUCUNE (app en
       arrière-plan, onglet caché, écran verrouillé). Mesuré au banc, volet
       masqué : la réserve restait à 128 px et la dernière ligne de l'écran
       passait sous la barre d'action. Or c'est exactement la situation réelle
       de quelqu'un qui note sa séance, verrouille son téléphone entre deux
       exercices, et le rallume. Le `setTimeout` pose la valeur quoi qu'il
       arrive — même précaution que la classe `on` de `Natty.confirmer` et que
       le compteur d'XP d'`assets/recette.js` (règle 40 de CLAUDE.md). */
    var reserver = function () {
      if (!col || !ctaEl || !ctaEl.firstElementChild) return;
      var voulu = ctaEl.offsetHeight + 18;
      var actuel = parseFloat(getComputedStyle(col).paddingBottom) || 0;
      if (voulu > actuel) col.style.paddingBottom = Math.round(voulu) + 'px';
    };
    requestAnimationFrame(reserver);
    setTimeout(reserver, 80);
    col.scrollTop = 0;
    return d;
  }

  /* ═══ 8. Le calendrier ═══════════════════════════════════
     « On clique sur un calendrier où chaque jour il y a un bouton + ajouter
     une séance » (Pablo). Le `+` est donc DANS la case, pas dans une barre à
     côté : c'est le geste qu'il a décrit.

     ⚠️ Les jours À VENIR n'ont pas de `+` et ne répondent pas au tap. Une
     séance est quelque chose qui a eu lieu ; laisser noter celle de jeudi
     prochain, c'est laisser le bilan compter du muscle construit dans le
     futur. */
  function scCalendrier() {
    enTete('MES SÉANCES', null);
    var ref = E.mois || new Date();
    E.mois = ref;
    var an = ref.getFullYear(), mo = ref.getMonth();
    var premier = new Date(an, mo, 1);
    var nbJours = new Date(an, mo + 1, 0).getDate();
    var decal = (premier.getDay() + 6) % 7;   // lundi en tête
    var auj = aujourdhui();
    var moisSuivantPossible = new Date(an, mo, 1) < new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    var cases = '';
    for (var i = 0; i < decal; i++) cases += '<div class="cj vide"></div>';
    for (var d = 1; d <= nbJours; d++) {
      var j = jourDe(new Date(an, mo, d));
      var s = duJour(j), n = series(s);
      var futur = j > auj;
      cases += '<button type="button" class="cj'
        + (s ? ' faite' : '') + (j === auj ? ' auj' : '') + (futur ? ' futur' : '')
        + '" data-jour="' + j + '"' + (futur ? ' disabled' : '') + '>'
        + '<span>' + d + '</span>'
        + (s ? '<span class="n">' + (n ? n + ' sér.' : '✓') + '</span>'
             : (futur ? '' : '<span class="p">+</span>'))
        + '</button>';
    }

    var sem = semaineCourante();
    scene({
      html: '<div class="kick">Votre journal d’entraînement</div>'
        + '<h1>Vos séances</h1>'
        + '<div class="sous">Touchez un jour pour noter ce que vous avez fait. '
        + 'C’est ce qui rend le muscle et la graisse du bilan du soir exacts, '
        + 'plutôt que déduits d’un niveau d’activité déclaré une fois.</div>'
        + '<div class="mois"><button type="button" data-mois="-1" aria-label="Mois précédent">‹</button>'
        + '<div class="m">' + MOIS[mo] + ' ' + an + '</div>'
        + '<button type="button" data-mois="1" aria-label="Mois suivant"'
        + (moisSuivantPossible ? '' : ' disabled style="opacity:.3"') + '>›</button></div>'
        + '<div class="sem7">'
        + JOURS_L.map(function (x) { return '<div class="hd">' + x + '</div>'; }).join('')
        + cases + '</div>'
        + '<div class="rec">'
        + '<div class="r"><div class="v">' + sem.nb + '</div><div class="l">séances<br>cette semaine</div></div>'
        + '<div class="r"><div class="v">' + sem.series + '</div><div class="l">séries<br>au total</div></div>'
        + '<div class="r"><div class="v">' + sem.reps + '</div><div class="l">répétitions<br>enchaînées</div></div>'
        + '</div>'
        + (estSynchronise() ? ''
            : '<div class="note">Vos séances sont gardées sur cet appareil uniquement — '
              + 'la table `seances` n’existe pas encore en base.</div>'),
      pret: function (d) {
        d.querySelectorAll('[data-mois]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.hasAttribute('disabled')) return;
            E.mois = new Date(an, mo + (+b.getAttribute('data-mois')), 1);
            scCalendrier();
          });
        });
        d.querySelectorAll('[data-jour]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.hasAttribute('disabled')) return;
            tic();
            var j = b.getAttribute('data-jour');
            if (duJour(j)) scDetail(j); else demarrer(j);
          });
        });
      },
      boutons: [
        { txt: duJour(auj) ? 'Voir la séance du jour' : 'Ajouter la séance du jour',
          on: function () { if (duJour(auj)) scDetail(auj); else demarrer(auj); } },
        /* ⚠️ L'entrée de la progression est un bouton et non un lien perdu dans
           le texte : c'est la seule porte, et une courbe qu'on ne trouve pas
           n'existe pas. Elle disparaît tant qu'il n'y a rien à tracer — un
           bouton qui mène à un écran vide est pire qu'un bouton absent. */
        (mouvements(E.poids || 0).length
          ? { txt: '📈 Ma progression', cls: 'b3', on: scProgression } : null),
        { txt: '🗓 Programmer ma semaine', cls: 'b3',
          on: function () { PE = null; scProgramme(); } },
        { txt: 'Fermer', cls: 'b3', on: fermer }
      ]
    });
  }

  /* ═══ 8 ter. Le programme de la semaine ══════════════════
     Demande de Pablo (2026-09-02) : « demander également la programmation de
     la semaine des séances le lundi ».

     ⚠️ CE N'EST PAS UN AGENDA, c'est ce qui permet d'annoncer le besoin AVANT
     la journée. Sans lui, l'objectif du lundi ne monte que si l'on s'entraîne
     déjà tous les lundis depuis deux mois ; avec lui, il monte dès la première
     semaine — et il baisse le jour où l'on programme du repos, ce qu'aucune
     habitude ne peut deviner.
     ⚠️ On ne demande QUE LES GROUPES, pas les machines : à ce moment-là on ne
     sait pas encore ce qu'on fera, et un formulaire complet une semaine à
     l'avance ne serait jamais rempli. */

  var PE = null;   // l'état de l'édition en cours : { jours, ouvert }

  function scProgramme() {
    enTete('MA SEMAINE', E.depuisCal ? scCalendrier : null);
    var poids = E.poids || 0, base = E.tdee || 0;
    var lundi = lundiDe();
    if (!PE) {
      var deja = programme(lundi);
      PE = { jours: {}, ouvert: null };
      for (var i = 0; i < 7; i++) {
        var d = dateDe(lundi); d.setDate(d.getDate() + i);
        var j = jourDe(d);
        /* ⚠️ PRÉ-REMPLI PAR L'HABITUDE, pas vide. Une grille vide se valide
           telle quelle — donc « repos toute la semaine », c'est-à-dire le pire
           résultat possible. Ce que la personne fait d'habitude ce jour-là est
           la meilleure proposition qu'on puisse faire, et elle se corrige d'un
           tap. Une séance DÉJÀ notée l'emporte : elle a eu lieu. */
        var s = duJour(j);
        if (s) PE.jours[j] = groupes(s);
        else if (deja && deja.jours[j]) PE.jours[j] = deja.jours[j].slice();
        else {
          var h = habitude(i, poids);
          PE.jours[j] = (h.frequence >= SEUIL_HABITUDE && h.groupes.length)
            ? h.groupes.slice(0, 2) : [];
        }
      }
    }
    peindreProgramme(base, poids, lundi);
  }

  function peindreProgramme(base, poids, lundi) {
    var auj = aujourdhui();
    var lignes = '';
    for (var i = 0; i < 7; i++) {
      var d = dateDe(lundi); d.setDate(d.getDate() + i);
      var j = jourDe(d), sel = PE.jours[j] || [], ouvert = PE.ouvert === j;
      var fait = !!duJour(j);
      var noms = sel.map(function (c) { var g = groupeParCle(c); return g ? g.nom : c; });
      /* Le besoin qui en découle, tout de suite : c'est la raison d'être de
         cet écran, et sans lui on remplit un agenda sans savoir pourquoi. */
      var kb = 0;
      if (base && poids) {
        var k = sel.length ? kcalProgramme(sel, poids) : { kcal: 0 };
        kb = Math.round((base + k.kcal) / PAS_KCAL) * PAS_KCAL;
      }
      lignes += '<div class="pj' + (ouvert ? ' on' : '') + '">'
        + '<button type="button" class="hd" data-pj="' + j + '">'
        + '<div class="j">' + JOURS_C[i] + '<small>' + d.getDate() + '</small></div>'
        + '<div class="g' + (sel.length ? '' : ' rep') + '">'
        + (sel.length ? esc(noms.join(' + ')) : 'Repos')
        + (fait ? ' ✓' : '') + '</div>'
        + (kb ? '<div class="k' + (sel.length ? '' : ' z') + '">' + kb + '</div>' : '')
        + '</button>';
      if (ouvert) {
        lignes += '<div class="ed">'
          + GROUPES.map(function (g) {
              return '<button type="button" data-pg="' + j + '|' + g.cle + '"'
                + (sel.indexOf(g.cle) > -1 ? ' class="on"' : '') + '>' + esc(g.nom) + '</button>';
            }).join('')
          + '<button type="button" class="rep' + (sel.length ? '' : ' on') + '" data-prep="' + j + '">Repos</button>'
          + '</div>';
      }
      lignes += '</div>';
    }

    var nb = Object.keys(PE.jours).filter(function (j) { return (PE.jours[j] || []).length; }).length;
    scene({
      html: '<div class="kick">Semaine du ' + esc(dateCourte(lundi)) + '</div>'
        + '<h1>Programmez<br>votre semaine</h1>'
        + '<div class="sous">Les groupes, pas les machines — on verra le détail le jour venu. '
        + 'C’est ce qui permet à votre objectif calorique de monter <b>le matin même</b>, '
        + 'et pas seulement une fois la séance notée.</div>'
        + '<div class="pjl">' + lignes + '</div>'
        + (base ? '<div class="note">Le nombre à droite est votre objectif de ce jour-là : '
              + base + ' kcal de base, plus ce que coûtent vos séances de ce type. '
              + 'Le lendemain d’une séance monte aussi, pour la reconstruction — mais celui-là '
              + 'ne se calcule qu’une fois la séance vraiment notée.</div>'
            : '<div class="note">Votre dépense de base n’est pas connue : renseignez votre poids '
              + 'et votre profil pour voir l’objectif de chaque jour.</div>')
        + (estSynchronise() ? ''
            : '<div class="note">Ce programme est gardé sur cet appareil uniquement.</div>'),
      pret: function (d) {
        d.querySelectorAll('[data-pj]').forEach(function (b) {
          b.addEventListener('click', function () {
            var j = b.getAttribute('data-pj');
            PE.ouvert = (PE.ouvert === j) ? null : j;
            tic();
            peindreProgramme(base, poids, lundi);
          });
        });
        d.querySelectorAll('[data-pg]').forEach(function (b) {
          b.addEventListener('click', function () {
            var p = b.getAttribute('data-pg').split('|'), j = p[0], g = p[1];
            var l = PE.jours[j] || (PE.jours[j] = []);
            var i = l.indexOf(g);
            if (i > -1) l.splice(i, 1); else l.push(g);
            tic();
            peindreProgramme(base, poids, lundi);
          });
        });
        d.querySelectorAll('[data-prep]').forEach(function (b) {
          b.addEventListener('click', function () {
            PE.jours[b.getAttribute('data-prep')] = [];
            tic();
            peindreProgramme(base, poids, lundi);
          });
        });
      },
      boutons: [
        { txt: nb ? 'Valider ma semaine (' + nb + ' séance' + (nb > 1 ? 's' : '') + ')'
                  : 'Valider — aucune séance cette semaine',
          on: function () {
            poserProgramme(PE.jours, lundi);
            marquerProgVu(lundi);
            PE = null;
            if (E.depuisCal) scCalendrier(); else fermer();
          } },
        { txt: 'Plus tard', cls: 'b3', on: function () {
            marquerProgVu(lundi);
            PE = null;
            if (E.depuisCal) scCalendrier(); else fermer();
          } }
      ]
    });
  }

  var JOURS_C = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  function marquerProgVu(lundi) {
    try { localStorage.setItem('natty_prog_vu_' + uid(), lundi || lundiDe()); } catch (e) {}
  }
  function progVu(lundi) {
    try { return localStorage.getItem('natty_prog_vu_' + uid()) === (lundi || lundiDe()); }
    catch (e) { return false; }
  }

  /**
   * La proposition du lundi. Même précautions que les autres plein écran de
   * l'app : jamais par-dessus un autre, et une seule fois par semaine.
   *
   * ⚠️ 11 s, APRÈS la planification des repas (5 s), le guide du jour (6,5 s) et
   * le bilan (9 s). Quatre écrans qui s'invitent ne se discutent pas : celui-ci
   * arrive en dernier parce que c'est le moins urgent des quatre — une semaine
   * se programme dans la journée, un repas se note maintenant.
   */
  function proposerProgrammeSiNecessaire() {
    if (!window.Natty || !Natty.USER_ID) return;
    var d = new Date();
    if (d.getDay() !== 1) return;              // le lundi, comme demandé
    var lundi = lundiDe();
    if (progVu(lundi) || programme(lundi)) return;
    setTimeout(async function () {
      if (racine || progVu(lundi) || programme(lundi)) return;
      if (window.Natty && Natty.ecranOccupe && Natty.ecranOccupe()) return;
      await ouvrir({ programme: true });
    }, 11000);
  }

  /* ═══ 8 bis. La progression ══════════════════════════════
     Demande de Pablo (2026-09-02) : « une courbe de progression par
     exercice ». Le tonnage se comparait déjà d'une séance à l'autre, il
     manquait de le VOIR. */

  /**
   * Le tracé d'une suite de séances, en SVG.
   *
   * ⚠️ L'AXE DES X EST LE TEMPS, pas le rang de la séance. Trois semaines sans
   * venir doivent se voir : à rang égal, une reprise après une pause
   * ressemblerait à une séance de plus, et la courbe raconterait une
   * régularité qui n'a pas eu lieu.
   * ⚠️ Rien ne dépend d'une animation pour son état final (règle 40) : le
   * tracé est complet à l'arrêt, l'animation ne fait que le révéler.
   */
  function courbe(hist, valeurs, o) {
    o = o || {};
    var W = o.w || 100, H = o.h || 34, pad = o.pad || 3;
    if (!hist.length) return '';
    if (hist.length === 1) {
      /* Une seule séance : un point au milieu, et surtout PAS de ligne — une
         ligne entre un point et lui-même dessinerait une tendance inventée. */
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" fill="none">'
        + '<circle cx="' + (W / 2) + '" cy="' + (H / 2) + '" r="' + (o.gros ? 4 : 2.6)
        + '" fill="' + (o.couleur || '#5ad07a') + '"/></svg>';
    }
    var t0 = dateDe(hist[0].jour).getTime();
    var t1 = dateDe(hist[hist.length - 1].jour).getTime();
    var dt = (t1 - t0) || 1;
    var min = Math.min.apply(null, valeurs), max = Math.max.apply(null, valeurs);
    /* ⚠️ Une échelle qui part de zéro écrase toute variation : entre 2,8 t et
       3,1 t la courbe serait plate alors que c'est +11 %. On cadre sur les
       valeurs, avec une marge — et l'écran affiche le min et le max, donc
       l'échelle n'est jamais implicite. */
    var etendue = (max - min) || Math.max(1, max * 0.1);
    var bas = min - etendue * 0.18, haut = max + etendue * 0.18;
    var pts = hist.map(function (x, i) {
      var px = pad + (W - 2 * pad) * ((dateDe(x.jour).getTime() - t0) / dt);
      var py = H - pad - (H - 2 * pad) * ((valeurs[i] - bas) / (haut - bas));
      return [Math.round(px * 10) / 10, Math.round(py * 10) / 10];
    });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
    var col = o.couleur || '#5ad07a';
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" fill="none">';
    if (o.gros) {
      // Le remplissage sous la courbe : il donne le sens de lecture d'un coup.
      svg += '<path d="' + d + ' L' + pts[pts.length - 1][0] + ' ' + H + ' L' + pts[0][0] + ' ' + H
        + ' Z" fill="' + col + '" opacity=".10"/>';
    }
    svg += '<path d="' + d + '" stroke="' + col + '" stroke-width="' + (o.gros ? 2.4 : 1.8)
      + '" stroke-linecap="round" stroke-linejoin="round"/>';
    pts.forEach(function (pt, i) {
      var dernier = i === pts.length - 1;
      svg += '<circle cx="' + pt[0] + '" cy="' + pt[1] + '" r="'
        + (o.gros ? (dernier ? 4.2 : 2.8) : (dernier ? 2.6 : 1.7)) + '" fill="' + col + '"/>';
    });
    return svg + '</svg>';
  }

  /** « 3,1 t » quand il y a une charge, « 96 reps » sinon. */
  function valTxt(v, avecCharge) {
    return avecCharge ? fmtKg(v / 1000) + ' t' : v + ' reps';
  }

  /** Le vert quand ça monte, l'ambre quand ça descend, le gris sans passé. */
  function deltaHTML(pc) {
    if (pc == null) return '<div class="d" style="color:#5f5f6b">1ʳᵉ</div>';
    var c = pc > 0 ? '#5ad07a' : (pc < 0 ? '#f0b429' : '#7d7d89');
    return '<div class="d" style="color:' + c + '">' + (pc > 0 ? '+' : '') + pc + ' %</div>';
  }

  function scProgression() {
    enTete('MA PROGRESSION', scCalendrier);
    var poids = E.poids || 0;
    var mvts = mouvements(poids);

    if (!mvts.length) {
      scene({
        html: '<div class="kick">Douze dernières semaines</div>'
          + '<h1>Rien à tracer<br>pour l’instant</h1>'
          + '<div class="sous">Une courbe se dessine à partir de deux séances sur le même '
          + 'mouvement. Notez-en une, puis la suivante, et elle apparaîtra ici.</div>',
        boutons: [{ txt: 'Noter une séance', on: function () { demarrer(aujourdhui()); } },
                  { txt: 'Retour au calendrier', cls: 'b3', on: scCalendrier }]
      });
      return;
    }

    var avecCharge = mvts.filter(function (m) { return m.avecCharge; }).length;
    scene({
      html: '<div class="kick">Douze dernières semaines</div>'
        + '<h1>Ce qui monte</h1>'
        + '<div class="sous">Un point par séance, placé à sa date : trois semaines sans venir '
        + 'se voient. Touchez un mouvement pour le détail.</div>'
        + '<div class="pgl">' + mvts.map(function (m) {
            return '<button type="button" class="pgr" data-mvt="' + esc(m.cle) + '">'
              + '<div class="b">' + ic(m.ic) + '</div>'
              + '<div class="tx"><div class="n">' + esc(m.nom) + '</div>'
              + '<div class="s">' + m.seances + ' séance' + (m.seances > 1 ? 's' : '')
              + ' · ' + valTxt(m.valeurs[m.valeurs.length - 1], m.avecCharge) + '</div></div>'
              + '<div class="sp">' + courbe(m.hist, m.valeurs,
                  { w: 78, h: 30, couleur: m.pc == null ? '#7d7d89' : (m.pc >= 0 ? '#5ad07a' : '#f0b429') })
              + '</div>' + deltaHTML(m.pc) + '</button>';
          }).join('') + '</div>'
        /* ⚠️ Dire CE QUI EST TRACÉ, mouvement par mouvement. Sans cette ligne,
           une courbe de répétitions et une courbe de tonnage se ressemblent
           trait pour trait, et on comparerait deux grandeurs différentes. */
        + '<div class="note">' + (avecCharge
            ? 'Les mouvements dont vous avez noté la charge sont tracés en <b>tonnage</b> '
              + '(charge × répétitions) — c’est la seule mesure de ce carnet. '
              + (avecCharge < mvts.length
                  ? 'Les autres sont tracés en <b>répétitions</b> : sans charge, il n’y a pas '
                    + 'de tonnage à calculer, et une courbe à zéro se lirait comme un '
                    + 'effondrement.' : '')
            : 'Aucune charge saisie sur ces douze semaines : les courbes tracent le nombre de '
              + '<b>répétitions</b>. Notez vos kilos et elles passeront au tonnage, qui est '
              + 'la vraie mesure d’une progression.') + '</div>',
      pret: function (d) {
        d.querySelectorAll('[data-mvt]').forEach(function (b) {
          b.addEventListener('click', function () { tic(); scMouvement(b.getAttribute('data-mvt')); });
        });
      },
      boutons: [{ txt: 'Retour au calendrier', cls: 'b3', on: scCalendrier }]
    });
  }

  function scMouvement(cle) {
    var poids = E.poids || 0;
    var m = mouvements(poids).filter(function (x) { return x.cle === cle; })[0];
    if (!m) { scProgression(); return; }
    enTete(m.nom.toUpperCase(), scProgression);

    var h = m.hist, v = m.valeurs;
    var dernier = v[v.length - 1], record = m.record;
    var col = m.pc == null ? '#7d7d89' : (m.pc >= 0 ? '#5ad07a' : '#f0b429');

    scene({
      html: '<div class="kick">' + m.seances + ' séance' + (m.seances > 1 ? 's' : '')
        + ' en douze semaines</div>'
        + '<h1>' + esc(m.nom) + '</h1>'
        + '<div class="pgc">' + courbe(h, v, { w: 300, h: 132, pad: 8, gros: true, couleur: col })
        + '<div class="ax"><span>' + esc(dateCourte(h[0].jour)) + '</span>'
        + '<span>' + esc(dateCourte(h[h.length - 1].jour)) + '</span></div>'
        /* L'échelle est écrite : elle ne part pas de zéro, et une courbe dont
           on ignore les bornes peut faire passer 3 % pour un envol. */
        + '<div class="lg">Entre <b>' + valTxt(Math.min.apply(null, v), m.avecCharge)
        + '</b> et <b>' + valTxt(record, m.avecCharge) + '</b> · '
        + (m.avecCharge ? 'tonnage (charge × répétitions)' : 'répétitions — aucune charge notée')
        + '</div></div>'
        + '<div class="rec">'
        + '<div class="r"><div class="v">' + valTxt(dernier, m.avecCharge).replace(' ', ' ')
        + '</div><div class="l">dernière<br>séance</div></div>'
        + '<div class="r"><div class="v">' + valTxt(record, m.avecCharge).replace(' ', ' ')
        + '</div><div class="l">votre<br>record</div></div>'
        + (m.chargeMax ? '<div class="r"><div class="v">' + fmtKg(m.chargeMax)
            + '<small style="font-size:13px">kg</small></div><div class="l">charge la<br>plus lourde</div></div>' : '')
        + '</div>'
        + '<div class="liste">' + h.slice().reverse().map(function (x) {
            return '<div class="li"><div class="t" style="font-size:12.5px">'
              + esc(dateFr(x.jour))
              + '<div style="font-size:10.5px;color:#7d7d89;font-weight:700">'
              + x.series + '×' + resumeReps({ series: x.serie }) + (m.unite ? ' ' + m.unite : '')
              + (x.charge ? ' · ' + fmtKg(x.charge) + ' kg' : '') + '</div></div>'
              + '<div class="q">' + valTxt(m.avecCharge ? x.tonnage : x.volume, m.avecCharge)
              + '</div></div>';
          }).join('') + '</div>'
        + (m.pc == null
            ? '<div class="note">Une seule séance sur ce mouvement : il n’y a pas encore de '
              + 'progression à mesurer. La prochaine donnera le premier écart.</div>'
            : '<div class="note">Entre la première et la dernière séance : '
              + (m.pc > 0 ? '+' : '') + m.pc + ' %. C’est un rapport entre deux mesures, '
              + 'sans aucun modèle — ' + (m.avecCharge
                  ? 'charge × répétitions des deux jours.'
                  : 'le nombre de répétitions des deux jours.') + '</div>'),
      boutons: [{ txt: 'Voir un autre mouvement', on: scProgression },
                { txt: 'Retour au calendrier', cls: 'b3', on: scCalendrier }]
    });
  }

  /** « 4 sept. » — pour les bornes de l'axe, où la date longue déborde. */
  function dateCourte(j) {
    var d = dateDe(j);
    return d.getDate() + ' ' + MOIS_C[d.getMonth()];
  }

  function semaineCourante() {
    var d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    var nb = 0, se = 0, rp = 0;
    for (var i = 0; i < 7; i++) {
      var s = duJour(jourDe(d));
      if (s) { nb++; se += series(s); rp += reps(s); }
      d.setDate(d.getDate() + 1);
    }
    return { nb: nb, series: se, reps: rp };
  }

  /** La séance déjà notée d'un jour : ce qu'elle contient, et deux gestes. */
  function scDetail(j) {
    enTete(dateFr(j).toUpperCase(), E.depuisCal ? scCalendrier : null);
    var s = duJour(j);
    if (!s) { demarrer(j); return; }
    var poids = E.poids || 0;
    var kc = kcal(s, poids);
    scene({
      html: '<div class="kick">' + esc(dateFr(j)) + '</div>'
        + '<h1>' + esc(groupes(s).map(function (c) {
            var g = groupeParCle(c); return g ? g.nom : c;
          }).join(' + ') || 'Séance') + '</h1>'
        + '<div class="rec">'
        + '<div class="r"><div class="v">' + series(s) + '</div><div class="l">séries</div></div>'
        + '<div class="r"><div class="v">' + reps(s) + '</div><div class="l">répétitions</div></div>'
        + '<div class="r"><div class="v">' + duree(s) + '</div><div class="l">minutes<br>estimées</div></div>'
        + (tonnage(s, poids) ? '<div class="r"><div class="v">'
            + fmtKg(tonnage(s, poids) / 1000) + '<small style="font-size:13px">t</small>'
            + '</div><div class="l">de tonnage<br>soulevé</div></div>' : '')
        + '</div>'
        + '<div class="liste">' + s.exos.map(function (e) {
            return '<div class="li">' + ic(e.ic)
              + '<div class="t">' + esc(e.nom) + '</div>'
              + '<div class="q">' + e.series.length + '×' + resumeReps(e)
              + (e.unite ? ' ' + e.unite : '')
              /* La charge à côté du compte de séries : sans elle, une séance
                 relue ne montrerait pas ce qu'on a justement pris la peine de
                 saisir — et on ne pourrait pas la comparer à la suivante. */
              + (resumeCharge(e) ? '<i style="font-style:normal;color:#7d7d89"> · '
                  + resumeCharge(e) + '</i>' : '')
              + '</div></div>';
          }).join('') + '</div>'
        + (s.libre ? '<div class="note">Écrit à la main : « ' + esc(s.libre) + ' »</div>' : '')
        + (kc ? '<div class="note">Cette séance ajoute <b>' + kc + ' kcal</b> à votre dépense '
              + 'du jour — c’est une estimation : (' + met(s, poids).toFixed(1).replace('.', ',')
              + ' − 1) MET × ' + r0(poids) + ' kg × ' + duree(s) + ' min. Le bilan du soir '
              + 'la compte dans le déficit, donc dans les grammes de graisse.</div>' : ''),
      boutons: [
        { txt: 'Modifier', on: function () { demarrer(j, s); } },
        { txt: 'Supprimer cette séance', cls: 'b3', on: async function () {
            var ok = window.Natty && Natty.confirmer
              ? await Natty.confirmer('Supprimer la séance du ' + dateFr(j) + ' ?',
                  { ok: 'Supprimer', non: 'Annuler' })
              : true;
            if (!ok) return;
            await supprimer(j);
            if (E.depuisCal) scCalendrier(); else fermer();
          } }
      ]
    });
  }

  /** « 80 kg » quand c'est constant, « 60-70-80 » quand ça monte. Vide sans
      charge saisie — et VIDE, pas « 0 kg » : n'avoir rien noté n'est pas avoir
      soulevé la barre à vide. */
  function resumeCharge(e) {
    if (!e) return '';
    if (e.charges) {
      var v = e.charges.filter(function (c) { return c != null; });
      if (!v.length) return '';
      var pareil = v.length === e.charges.length && v.every(function (c) { return c === v[0]; });
      return (pareil ? fmtKg(v[0]) : e.charges.map(function (c) {
        return c == null ? '?' : fmtKg(c);
      }).join('-')) + ' kg';
    }
    return e.charge == null ? '' : fmtKg(e.charge) + ' kg';
  }

  /** « 4×10 » quand c'est régulier, « 12-10-8 » quand ça descend. */
  function resumeReps(e) {
    var r = e.series || [];
    if (!r.length) return '0';
    var tous = r.every(function (x) { return x === r[0]; });
    return tous ? String(r[0]) : r.join('-');
  }

  /* ═══ 9. La saisie, en trois temps ═══════════════════════ */

  function demarrer(j, existante) {
    E.jour = j;
    /* ⚠️⚠️ LA CHARGE SE RECOPIE, ET C'EST UN DÉFAUT TROUVÉ EN RELISANT.
       Cette liste de champs est écrite à la main : la version d'origine
       s'arrêtait à `series`, donc rouvrir une séance pour corriger une seule
       répétition EFFAÇAIT toutes les charges saisies — et l'enregistrement qui
       suit les aurait perdues pour de bon. Même famille que « changer le nombre
       de séries ne jette pas les reps déjà saisies ». `pdc` suit pour que le
       tonnage d'une traction reste juste avant même que `exoParCle` s'en mêle. */
    E.exos = existante ? existante.exos.map(function (e) {
      return { cle: e.cle, g: e.g, nom: e.nom, ic: e.ic, unite: e.unite, met: e.met,
               pdc: e.pdc || 0,
               charge: e.charge == null ? null : e.charge,
               charges: e.charges ? e.charges.slice() : null,
               series: e.series.slice() };
    }) : [];
    E.libre = existante ? (existante.libre || '') : '';
    E.groupes = existante ? groupes(existante) : [];
    E.cur = 0;
    scGroupe();
  }

  function scGroupe() {
    enTete('QUEL GROUPE ?', E.depuisCal ? scCalendrier : null);
    var sel = E.groupes || [];
    var detail = sel.length > 1;
    scene({
      html: '<div class="kick">' + esc(dateFr(E.jour)) + '</div>'
        + '<h1>Qu’avez-vous travaillé ?</h1>'
        + '<div class="sous">Un groupe, et on vous propose ses machines. '
        + '« Détailler » sert aux séances qui en mélangent plusieurs.</div>'
        + '<div class="tuiles">'
        + GROUPES.map(function (g) {
            var n = nbExosDe(g.cle);
            return '<button type="button" class="tu' + (sel.indexOf(g.cle) > -1 ? ' on' : '')
              + '" data-g="' + g.cle + '">'
              + '<span class="k">' + ic('coche', 'k-ic') + '</span>'
              + ic(g.ic) + '<div><div class="n">' + esc(g.nom) + '</div>'
              + '<div class="s">' + n + ' machines</div></div></button>';
          }).join('')
        + '<button type="button" class="tu large" data-detail="1">'
        + ic('plus') + '<div><div class="n">' + (detail ? 'Plusieurs groupes' : 'Détailler') + '</div>'
        + '<div class="s">Touchez plusieurs groupes, ils s’ajoutent</div></div></button>'
        + '</div>',
      pret: function (d) {
        d.querySelectorAll('[data-g]').forEach(function (b) {
          b.addEventListener('click', function () {
            tic();
            var g = b.getAttribute('data-g');
            var i = E.groupes.indexOf(g);
            if (i > -1) {
              E.groupes.splice(i, 1);
              b.classList.remove('on');
            } else {
              E.groupes.push(g);
              b.classList.add('on');
            }
            majCtaGroupe();
          });
        });
        d.querySelector('[data-detail]').addEventListener('click', function () {
          if (window.Natty && Natty.alerte) {
            Natty.alerte('Touchez autant de groupes que vous voulez : leurs machines '
              + 'se retrouveront toutes dans la liste suivante.');
          }
        });
      },
      boutons: [
        { txt: 'Choisir mes machines', off: !sel.length, on: scMachines },
        { txt: '✏️  Écrire à la main', cls: 'b3', on: scLibre }
      ]
    });
    majCtaGroupe();
  }

  function nbExosDe(g) {
    return EXOS.filter(function (e) { return e.g === g; }).length;
  }

  /* Le bouton se met à jour SANS repeindre la scène : repasser par `scene()`
     rejouerait l'animation d'entrée des quatorze tuiles à chaque tap. */
  function majCtaGroupe() {
    var b = ctaEl && ctaEl.firstElementChild;
    if (!b) return;
    var n = (E.groupes || []).length;
    if (n) { b.removeAttribute('disabled'); b.textContent = 'Choisir mes machines'; }
    else { b.setAttribute('disabled', 'disabled'); b.textContent = 'Choisissez un groupe'; }
  }

  function scMachines() {
    enTete('LES MACHINES', scGroupe);
    var liste = EXOS.filter(function (e) { return E.groupes.indexOf(e.g) > -1; });
    scene({
      html: '<div class="kick">' + esc(E.groupes.map(function (c) {
              var g = groupeParCle(c); return g ? g.nom : c;
            }).join(' · ')) + '</div>'
        + '<h1>Sur quoi ?</h1>'
        + '<div class="sous">Touchez les machines et les mouvements que vous avez faits. '
        + 'L’ordre n’a pas d’importance, on réglera les séries juste après.</div>'
        + '<div class="tuiles">'
        + liste.map(function (e) {
            return '<button type="button" class="tu' + (choisi(e.cle) ? ' on' : '')
              + '" data-exo="' + e.cle + '">'
              + '<span class="k">' + ic('coche') + '</span>'
              + ic(e.ic) + '<div><div class="n">' + esc(e.nom) + '</div>'
              + '<div class="s">' + (e.unite === 'min' ? 'en minutes'
                  : e.unite === 's' ? 'en secondes' : e.rep + ' reps par défaut') + '</div></div></button>';
          }).join('')
        + '</div>',
      pret: function (d) {
        d.querySelectorAll('[data-exo]').forEach(function (b) {
          b.addEventListener('click', function () {
            tic();
            basculerExo(b.getAttribute('data-exo'));
            b.classList.toggle('on', choisi(b.getAttribute('data-exo')));
            majCtaMachines();
          });
        });
      },
      boutons: [
        { txt: 'Régler mes séries', off: !E.exos.length, on: function () { E.cur = 0; scSeries(); } },
        { txt: 'Changer de groupe', cls: 'b3', on: scGroupe }
      ]
    });
    majCtaMachines();
  }

  function choisi(c) {
    return E.exos.some(function (e) { return e.cle === c; });
  }
  function basculerExo(c) {
    var i = -1;
    E.exos.forEach(function (e, k) { if (e.cle === c) i = k; });
    if (i > -1) { E.exos.splice(i, 1); return; }
    var ref = exoParCle(c);
    if (!ref) return;
    /* Trois séries proposées d'office : c'est ce que fait presque tout le monde,
       et une liste qui arrive à zéro série obligerait à trois taps par exercice
       avant de pouvoir seulement enregistrer. La scène suivante les change. */
    /* ⚠️ LA CHARGE ARRIVE PRÉ-REMPLIE avec la dernière fois sur ce mouvement.
       C'est ce qui fait qu'elle ne coûte rien à partir de la deuxième séance :
       on ne la retape pas, on la corrige quand elle a bougé. Et c'est aussi ce
       qui rend la surcharge progressive visible sans y penser. `null` la
       première fois — le champ s'affiche vide, et rester vide est permis. */
    E.exos.push({ cle: ref.cle, g: ref.g, nom: ref.nom, ic: ref.ic,
                  unite: ref.unite || '', met: ref.met, pdc: ref.pdc || 0,
                  charge: derniereCharge(ref.cle, E.jour), charges: null,
                  series: [ref.rep, ref.rep, ref.rep] });
  }
  function majCtaMachines() {
    var b = ctaEl && ctaEl.firstElementChild;
    if (!b) return;
    var n = E.exos.length;
    if (n) {
      b.removeAttribute('disabled');
      b.textContent = 'Régler mes séries (' + n + ')';
    } else {
      b.setAttribute('disabled', 'disabled');
      b.textContent = 'Choisissez une machine';
    }
  }

  /* ── Séries puis reps, un exercice par écran ──────────────
     « On choisit le nombre de séries et ENFIN de reps » (Pablo) : les deux
     étapes sont dans l'ordre, mais sur le même écran — les reps apparaissent
     quand les séries sont posées. Deux écrans par exercice auraient doublé le
     nombre de plans pour une séance de six mouvements. */
  var MAX_SERIES = 8;

  function scSeries() {
    var e = E.exos[E.cur];
    if (!e) { scRecap(); return; }
    enTete((E.cur + 1) + ' / ' + E.exos.length,
      E.cur ? function () { E.cur--; scSeries(); } : scMachines);
    var u = e.unite === 'min' ? 'min' : (e.unite === 's' ? 'sec' : 'reps');

    scene({
      html: '<div class="prog">' + E.exos.map(function (_, i) {
              return '<i class="' + (i <= E.cur ? 'on' : '') + '"></i>';
            }).join('') + '</div>'
        + '<div class="exo-h"><div class="b">' + ic(e.ic) + '</div>'
        + '<div><h1 style="font-size:23px">' + esc(e.nom) + '</h1></div></div>'
        + chargeBlocHTML(e)
        + '<div class="lbl">Combien de séries ?</div>'
        + '<div class="pills" id="nsPills">' + pillsHTML(e.series.length) + '</div>'
        + '<div id="nsReps"></div>',
      pret: function (d) {
        brancherCharge(d, e, u);
        brancherPills(d, e);
        rendreReps(d, e, u, false);
      },
      boutons: [
        { txt: E.cur + 1 < E.exos.length ? 'Machine suivante' : 'Voir le récap',
          on: function () { E.cur++; scSeries(); } },
        { txt: 'Retirer cet exercice', cls: 'b3', on: function () {
            E.exos.splice(E.cur, 1);
            if (!E.exos.length) { scMachines(); return; }
            if (E.cur >= E.exos.length) E.cur = E.exos.length - 1;
            scSeries();
          } }
      ]
    });
  }

  /* ── La charge ────────────────────────────────────────────
     UNE valeur pour l'exercice, et un dépliant « par série » pour ceux qui
     pyramident. C'est le compromis qui permet de l'ajouter sans alourdir : au
     premier passage on tape un nombre, aux suivants il est déjà là. */

  /** Le pas du ± : ce dont on change vraiment sur ce type de matériel. */
  function pasCharge(e) {
    var t = typeDe(e);
    if (t === 'cardio' || t === 'stat') return 1;
    var ref = exoParCle(e.cle);
    // Haltères et poulies : 2,5 kg. Barres et machines lourdes : 5 kg.
    if (ref && ref.ref && ref.ref >= 0.6) return 5;
    return 2.5;
  }

  function chargeBlocHTML(e) {
    var t = typeDe(e);
    if (t === 'cardio') return '';       // on ne charge pas un vélo
    var ref = exoParCle(e.cle);
    var pdc = e.pdc || (ref && ref.pdc) || 0;
    var c = e.charge;
    var pas = pasCharge(e);
    var derniere = derniereCharge(e.cle, E.jour);

    return '<div class="lbl">Quelle charge ?'
      + '<span class="opt">facultatif</span></div>'
      + '<div class="chg" id="nsChg">'
      + '<button type="button" data-c="-1">−</button>'
      + '<div class="cv"><input id="nsChgV" type="number" inputmode="decimal" step="' + pas + '"'
      + ' min="0" max="500" placeholder="' + (pdc ? 'lest' : '—') + '"'
      + ' value="' + (c == null ? '' : c) + '"><span>kg</span></div>'
      + '<button type="button" data-c="1">+</button>'
      + '</div>'
      + '<div class="chgn" id="nsChgN">' + chargeNoteHTML(e, pdc, derniere) + '</div>'
      + '<button type="button" class="det" id="nsChgDet">'
      + (e.charges ? '▴ une seule charge' : '▾ charge différente par série') + '</button>';
  }

  /** Ce qu'on dit sous le champ : le poids du corps, la dernière fois, l'écart. */
  function chargeNoteHTML(e, pdc, derniere) {
    var bits = [];
    if (pdc) {
      bits.push(pdc >= 0.95 ? 'Au poids du corps — ajoutez seulement le lest'
        : 'Au poids du corps (environ ' + Math.round(pdc * 100) + ' %) — ajoutez le lest');
    }
    if (derniere != null && e.charge != null) {
      var d = e.charge - derniere;
      bits.push(d === 0 ? 'Comme la dernière fois (' + fmtKg(derniere) + ' kg)'
        : (d > 0 ? '+' : '') + fmtKg(d) + ' kg par rapport à la dernière fois');
    } else if (derniere != null) {
      bits.push('La dernière fois : ' + fmtKg(derniere) + ' kg');
    } else if (e.charge != null) {
      /* Rien à comparer, mais quelque chose de saisi : dire à quoi ça sert,
         plutôt que « laissez vide » sous un champ qu'on vient de remplir. */
      bits.push('Première fois sur ce mouvement — ce sera votre repère la prochaine fois');
    } else if (!pdc) {
      bits.push('Laissez vide si vous ne la connaissez pas — rien ne s’en trouvera faussé');
    }
    return bits.join(' · ');
  }

  function fmtKg(v) {
    return String(Math.round(v * 10) / 10).replace('.', ',');
  }

  function brancherCharge(d, e, u) {
    var boite = d.querySelector('#nsChg');
    if (!boite) return;
    var champ = d.querySelector('#nsChgV');
    var pas = pasCharge(e);

    function maj(anime) {
      var ref = exoParCle(e.cle);
      var pdc = e.pdc || (ref && ref.pdc) || 0;
      var n = d.querySelector('#nsChgN');
      if (n) n.innerHTML = chargeNoteHTML(e, pdc, derniereCharge(e.cle, E.jour));
      rendreReps(d, e, u, !!anime);
    }
    champ.addEventListener('input', function () {
      var v = champ.value.trim().replace(',', '.');
      /* ⚠️ Une chaîne vide remet à `null`, PAS à zéro. « Je ne sais pas » et
         « je n'ai rien chargé » ne sont pas la même chose : la première laisse
         le modèle neutre, la seconde annoncerait un tonnage nul. */
      e.charge = v === '' ? null : Math.max(0, Math.min(500, parseFloat(v) || 0));
      maj(false);
    });
    boite.querySelectorAll('[data-c]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = +b.getAttribute('data-c') * pas;
        var base = e.charge == null ? (derniereCharge(e.cle, E.jour) || 0) : e.charge;
        e.charge = Math.max(0, Math.min(500, Math.round((base + p) * 10) / 10));
        champ.value = e.charge;
        tic(10);
        maj(false);
      });
    });
    var det = d.querySelector('#nsChgDet');
    if (det) det.addEventListener('click', function () {
      /* Le dépliant par série : on part de la charge globale, et on n'y revient
         qu'en la repliant. Personne n'a besoin des deux à la fois. */
      if (e.charges) { e.charges = null; }
      else {
        e.charges = e.series.map(function () { return e.charge; });
      }
      tic();
      scSeries();
    });
  }

  function pillsHTML(n) {
    var h = '';
    for (var i = 1; i <= MAX_SERIES; i++) {
      h += '<button type="button" data-n="' + i + '" class="'
        + (i <= n ? 'on' : '') + (i === n ? ' der' : '') + '">' + i + '</button>';
    }
    return h;
  }

  function brancherPills(d, e) {
    var boite = d.querySelector('#nsPills');
    boite.querySelectorAll('[data-n]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-n');
        tic(14);
        poserNbSeries(e, n);
        boite.innerHTML = pillsHTML(e.series.length);
        brancherPills(d, e);
        rendreReps(d, e, e.unite === 'min' ? 'min' : (e.unite === 's' ? 'sec' : 'reps'), true);
      });
    });
  }

  /* ⚠️ On garde les reps déjà saisies quand on change le nombre de séries. La
     première version reconstruisait le tableau : passer de 4 à 5 séries
     effaçait les quatre valeurs réglées une par une juste avant. Les séries
     ajoutées reprennent la dernière valeur — c'est ce que fait un pratiquant
     qui enchaîne. */
  function poserNbSeries(e, n) {
    n = borne(n, 1, MAX_SERIES);
    var ref = exoParCle(e.cle);
    var defaut = e.series.length ? e.series[e.series.length - 1] : (ref ? ref.rep : 10);
    while (e.series.length > n) e.series.pop();
    while (e.series.length < n) e.series.push(defaut);
  }

  function rendreReps(d, e, u, anime) {
    var boite = d.querySelector('#nsReps');
    if (!boite) return;
    var max = Math.max(20, Math.max.apply(null, e.series.concat([12])));
    var poids = E.poids || 0;
    var pas = pasCharge(e);
    var tg = tonnageExo(e, poids);
    var prog = progressionExo(e, poids, E.jour);

    boite.innerHTML = '<div class="lbl">Et combien de ' + u + ' ?</div>'
      + '<div class="sets">' + e.series.map(function (r, i) {
          return '<div class="set"' + (anime ? ' style="animation-delay:' + (i * 0.04).toFixed(2) + 's"' : '') + '>'
            + '<div class="i">' + (i + 1) + '</div>'
            /* La charge par série n'apparaît QUE si on l'a dépliée : sinon la
               ligne porterait un champ vide et identique à toutes les autres,
               donc quatre invitations à saisir la même chose. */
            + (e.charges
                ? '<div class="ckw"><input class="ck" type="number" inputmode="decimal"'
                  + ' step="' + pas + '" min="0" max="500" data-ck="' + i + '" placeholder="—"'
                  + ' value="' + (e.charges[i] == null ? '' : e.charges[i]) + '"><span>kg</span></div>'
                : '<div class="j"><i style="width:' + r0(borne(r / max, 0, 1) * 100) + '%"></i></div>')
            + '<div class="v" data-v="' + i + '">' + r + '<small>' + u + '</small></div>'
            + '<div class="pm"><button type="button" data-r="' + i + '" data-p="-1">−</button>'
            + '<button type="button" data-r="' + i + '" data-p="1">+</button></div>'
            + '</div>';
        }).join('') + '</div>'
      + '<div class="chips">'
      + [8, 10, 12, 15, 20].map(function (n) {
          return '<button type="button" data-tous="' + n + '">' + n + ' partout</button>';
        }).join('') + '</div>'
      /* Le tonnage passe devant le total de reps dès qu'une charge est connue :
         c'est la grandeur que les pratiquants suivent, et la seule qui soit une
         mesure. Sans charge, on retombe sur le total de reps — la seule chose
         que l'on sache alors. */
      + '<div class="vol"><div class="v" id="nsVol">'
      + (tg ? fmtKg(tg / 1000) + '<small style="font-size:13px"> t</small>'
            : reps({ exos: [e] }))
      + '</div><div class="l">'
      + (tg ? 'de tonnage sur cet exercice (charge × reps)'
            : u + ' au total sur cet exercice')
      + (prog ? '<br><b style="color:' + (prog.pc >= 0 ? '#5ad07a' : '#f0b429') + '">'
          + (prog.pc >= 0 ? '+' : '') + prog.pc + ' %</b> par rapport au '
          + dateFr(prog.jour) : '')
      + '</div></div>';

    boite.querySelectorAll('[data-r]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-r'), p = +b.getAttribute('data-p');
        var pasR = e.unite === 'min' ? 1 : (e.unite === 's' ? 5 : 1);
        e.series[i] = borne(e.series[i] + p * pasR, 1, 300);
        tic(8);
        rendreReps(d, e, u, false);
      });
    });
    boite.querySelectorAll('[data-tous]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-tous');
        e.series = e.series.map(function () { return n; });
        tic(14);
        rendreReps(d, e, u, true);
      });
    });
    /* ⚠️ Les champs de charge par série se rebranchent à CHAQUE rendu, comme
       tout le reste de ce bloc — et on ne re-rend PAS sur leur `input`, sinon le
       champ perdrait le focus à chaque frappe. Seul le tonnage attend le `blur`
       pour se remettre à jour. */
    boite.querySelectorAll('[data-ck]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var i = +inp.getAttribute('data-ck');
        var v = inp.value.trim().replace(',', '.');
        e.charges[i] = v === '' ? null : Math.max(0, Math.min(500, parseFloat(v) || 0));
      });
      inp.addEventListener('blur', function () { rendreReps(d, e, u, false); });
    });
  }

  /* ── La saisie libre ─────────────────────────────────────── */
  function scLibre() {
    enTete('À LA MAIN', scGroupe);
    scene({
      html: '<div class="kick">' + esc(dateFr(E.jour)) + '</div>'
        + '<h1>Racontez votre séance</h1>'
        + '<div class="sous">Une ligne par exercice. « Développé couché 4x10 à 80 kg », '
        + '« tirage vertical 3 séries de 12 » — on reconnaît les machines, les '
        + 'séries et la charge au fur et à mesure. La charge est facultative, '
        + 'mais il lui faut son « kg » pour ne pas être prise pour des reps.</div>'
        + '<textarea id="nsTxt" placeholder="Développé couché 4x10 à 80 kg&#10;Écartés à la poulie 3x12 @25&#10;Dips 3x10"></textarea>'
        + '<div id="nsLu"></div>',
      pret: function (d) {
        var t = d.querySelector('#nsTxt');
        t.value = E.libre || '';
        var lu = d.querySelector('#nsLu');
        function relire() {
          var ex = analyserTexte(t.value);
          E.libre = t.value;
          E.exos = ex;
          lu.innerHTML = ex.length
            ? '<div class="liste">' + ex.map(function (e) {
                /* La charge relue est MONTRÉE : c'est la seule façon de voir
                   qu'elle a été comprise — et, quand elle ne l'est pas, que le
                   « kg » manque. */
                return '<div class="li">' + ic(e.ic) + '<div class="t">' + esc(e.nom) + '</div>'
                  + '<div class="q">' + e.series.length + '×' + resumeReps(e)
                  + (resumeCharge(e) ? '<i style="font-style:normal;color:#7d7d89"> · '
                      + resumeCharge(e) + '</i>' : '') + '</div></div>';
              }).join('') + '</div>'
            : (t.value.trim() ? '<div class="note">Rien de reconnu pour l’instant. Le texte '
                + 'sera gardé tel quel, mais sans séries il ne comptera pas dans les '
                + 'estimations du bilan.</div>' : '');
          var b = ctaEl && ctaEl.firstElementChild;
          if (b) {
            if (t.value.trim()) b.removeAttribute('disabled');
            else b.setAttribute('disabled', 'disabled');
          }
        }
        t.addEventListener('input', relire);
        relire();
        setTimeout(function () { try { t.focus(); } catch (e) {} }, 260);
      },
      boutons: [
        { txt: 'Continuer', off: !(E.libre || '').trim(),
          on: function () { if (E.exos.length) { E.cur = 0; scSeries(); } else scRecap(); } },
        { txt: 'Utiliser les machines à la place', cls: 'b3', on: function () { E.libre = ''; scGroupe(); } }
      ]
    });
  }

  /* ═══ 10. Récap, enregistrement, félicitation ════════════ */

  function courante() {
    return { jour: E.jour, exos: E.exos, duree_min: E.duree_min || 0, libre: E.libre || '' };
  }

  function scRecap() {
    enTete('LE RÉCAP', function () {
      if (E.exos.length) { E.cur = E.exos.length - 1; scSeries(); } else scGroupe();
    });
    var s = courante();
    var poids = E.poids || 0;
    var kc = kcal(s, poids);
    var st = stimulus(s, duJour(veille(E.jour)), poids);
    var d = detail(s, poids);

    scene({
      html: '<div class="kick">' + esc(dateFr(E.jour)) + '</div>'
        + '<h1>' + series(s) + ' séries, ' + reps(s) + ' reps</h1>'
        + '<div class="sous">' + esc(groupes(s).map(function (c) {
            var g = groupeParCle(c); return g ? g.nom : c;
          }).join(' · ') || 'Séance libre') + '</div>'
        + '<div class="rec">'
        + '<div class="r"><div class="v">' + duree(s) + '</div><div class="l">minutes<br>estimées</div></div>'
        + '<div class="r"><div class="v">' + (kc || '—') + '</div><div class="l">kcal<br>dépensées</div></div>'
        + '<div class="r"><div class="v">'
        + (d.tonnage ? fmtKg(d.tonnage / 1000) + '<small style="font-size:13px">t</small>'
                     : d.volume.toFixed(1).replace('.', ','))
        + '</div><div class="l">' + (d.tonnage ? 'de tonnage<br>soulevé' : 'séries<br>pondérées') + '</div></div>'
        + '</div>'
        /* Le détail par exercice : c'est ce qui rend le total vérifiable. Sans
           lui, « 112 kcal » est un nombre qu'on croit ou pas ; avec lui, on
           voit lequel des mouvements a coûté quoi. */
        + (poids ? '<div class="liste" style="margin-top:11px">' + d.exos.map(function (x) {
            return '<div class="li"><div class="t" style="font-size:12.5px">' + esc(x.nom)
              /* `chargeTxt` et non `charge` : une pyramide 20-22,5-25 affichée
                 « 20 kg » dirait le premier palier pour toute la série. */
              + (x.chargeTxt ? '<div style="font-size:10.5px;color:#7d7d89;font-weight:700">'
                  + x.chargeTxt
                  + (x.tonnage ? ' · ' + fmtKg(x.tonnage / 1000) + ' t' : '')
                  + (x.intensite != null ? ' · ' + x.intensite + ' % de votre habituel' : '')
                  + '</div>' : '')
              + '</div><div class="q" style="color:#8b8b96;font-weight:700">' + x.min + ' min</div>'
              + '<div class="q">' + x.kcal + ' kcal</div></div>';
          }).join('') + '</div>' : '')
        + '<div class="liste">' + s.exos.map(function (e, i) {
            return '<div class="li">' + ic(e.ic) + '<div class="t">' + esc(e.nom) + '</div>'
              + '<div class="q">' + e.series.length + '×' + resumeReps(e) + '</div>'
              + '<button type="button" class="x" data-del="' + i + '" aria-label="Retirer">✕</button></div>';
          }).join('') + '</div>'
        /* ⚠️ Cette mention n'est pas une précaution de style. Les séries sont
           SAISIES, la dépense est MODÉLISÉE : les afficher côte à côte sans
           dire lesquelles sont mesurées en ferait deux chiffres de même
           nature, ce qu'ils ne sont pas. Même règle que le bilan. */
        + '<div class="note">Les séries et les répétitions sont ce que vous avez noté. '
        + 'Le reste en découle, exercice par exercice : chaque série compte son temps '
        + 'sous tension (vos reps) et sa récupération (' + (d.partPoly >= 50 ? '2 min 30 '
            + 'sur les mouvements lourds' : '1 min 30 sur les machines') + '), puis son '
        + 'coût à ' + d.met.toFixed(1).replace('.', ',') + ' MET'
        + (poids ? ' pour ' + r0(poids) + ' kg' : '') + '. On retire 1 MET parce que votre '
        + 'dépense quotidienne compte déjà le repos de ces minutes-là'
        + (d.kcalEpoc ? ', et on ajoute ' + d.kcalEpoc + ' kcal d’après-séance ('
            + Math.round(epocCoef(s) * 100) + ' %, votre séance est à ' + d.partPoly
            + ' % de polyarticulaire)' : '') + '. '
        + 'Le volume pondéré (' + d.volume.toFixed(1).replace('.', ',') + ') vaut '
        + d.efficaces + ' série' + (d.efficaces > 1 ? 's' : '') + ' dans la plage où '
        + 'l’hypertrophie se joue, sur ' + d.series + ' notée' + (d.series > 1 ? 's' : '') + '. '
        + (d.tonnage
            ? 'Le tonnage (' + fmtKg(d.tonnage / 1000) + ' t) est la seule MESURE de cet '
              + 'écran : charge × répétitions, sans modèle. C’est lui qui suit votre '
              + 'progression, et vos charges situent aussi l’intensité de la séance — donc '
              + 'sa dépense.'
            : 'Aucune charge saisie : l’intensité reste neutre et le tonnage n’est pas '
              + 'calculé. Rien n’est faussé pour autant — le modèle se contente alors du '
              + 'volume et des répétitions.')
        + '</div>',
      pret: function (d) {
        d.querySelectorAll('[data-del]').forEach(function (b) {
          b.addEventListener('click', function () {
            E.exos.splice(+b.getAttribute('data-del'), 1);
            tic();
            scRecap();
          });
        });
      },
      boutons: [
        { txt: 'Enregistrer ma séance', off: !series(s) && !(E.libre || '').trim(),
          on: async function (btn) {
            btn.setAttribute('disabled', 'disabled');
            btn.textContent = 'Enregistrement…';
            await enregistrer(courante());
            scFait();
          } },
        { txt: 'Ajouter une autre machine', cls: 'b3', on: scGroupe }
      ]
    });
  }

  function scFait() {
    enTete('', null);
    var s = duJour(E.jour) || courante();
    var nb = Object.keys(toutes()).length;
    scene({
      html: '<div class="vok"><svg viewBox="0 0 120 120">'
        + '<circle class="rond" cx="60" cy="60" r="42"/>'
        + '<path class="co" d="M41 61l13 14 26-30"/></svg></div>'
        + '<h1 style="text-align:center">Séance notée</h1>'
        + '<div class="xp" style="text-align:center">+' + XP_SEANCE + ' XP</div>'
        + '<div class="sous" style="text-align:center">' + esc(resume(s, E.poids || 0)) + '</div>'
        + '<div class="sous" style="text-align:center">Le bilan du soir en tiendra compte : '
        + 'ce que vous avez brûlé entre dans le déficit, ce que vous avez soulevé entre '
        + 'dans le muscle construit.</div>'
        + '<div class="note" style="text-align:center">' + nb + ' séance'
        + (nb > 1 ? 's' : '') + ' notée' + (nb > 1 ? 's' : '') + ' en tout'
        + (estSynchronise() ? '' : ' · gardées sur cet appareil uniquement') + '</div>',
      pret: function () { tic(26); },
      boutons: [
        { txt: 'Voir mon calendrier', cls: 'b2', on: function () { E.depuisCal = true; scCalendrier(); } },
        { txt: 'Terminer', on: fermer }
      ]
    });
  }

  /* ═══ 11. Ouverture ══════════════════════════════════════ */

  /** Le poids ET la dépense de base : le premier chiffre les kcal d'une séance,
      le second permet au programme d'annoncer l'objectif de chaque jour. */
  async function chargerPoids() {
    if (E && E.poids) return E.poids;
    try {
      /* ⚠️ Ne demander que des colonnes qui EXISTENT : une colonne inconnue
         fait échouer la requête ENTIÈRE en `42703` (§7 de CLAUDE.md). Et la
         table contient de vrais doublons, dont des lignes sans poids : on prend
         la première ligne EXPLOITABLE, pas la première. */
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + uid()
        + '&select=poids,tdee&order=created_at.desc&limit=5');
      var d = (r || []).filter(function (x) { return x && x.poids; })[0];
      if (d && E) { E.poids = parseFloat(d.poids) || 0; E.tdee = parseFloat(d.tdee) || 0; }
    } catch (e) {}
    return (E && E.poids) || 0;
  }

  var ouverture = false;

  /**
   * @param {Object} [o] {jour, creer:bool, apres:fn}
   *   `jour` + `creer` ouvre la saisie directement — c'est ce que fait le
   *   bilan du soir, qui sait déjà de quel jour il parle.
   */
  async function ouvrir(o) {
    o = o || {};
    if (ouverture || racine) return;
    ouverture = true;
    try {
      if (!window.Natty || !Natty.USER_ID) return;
      monter();
      E = { jour: o.jour || aujourdhui(), exos: [], groupes: [], cur: 0,
            libre: '', poids: 0, tdee: 0, apres: o.apres || null,
            depuisCal: !o.creer && !o.programme, mois: dateDe(o.jour || aujourdhui()) };
      /* La scène s'affiche AVANT que le poids soit lu : il ne sert qu'à la
         ligne des kcal du récap, trois écrans plus loin. Attendre une requête
         pour peindre un calendrier qui vit en localStorage, c'est une seconde
         de noir pour rien. */
      if (o.programme) { PE = null; scProgramme(); }
      else if (o.creer && !duJour(E.jour)) demarrer(E.jour);
      else if (o.creer) scDetail(E.jour);
      else scCalendrier();
      await charger();
      await chargerPoids();
      /* ⚠️ Le programme se REPEINT une fois le poids et la dépense arrivés :
         il s'affiche tout de suite (le localStorage suffit à le composer), mais
         l'objectif de chaque jour ne peut être calculé qu'après. Sans ce second
         rendu, la colonne de droite resterait vide — donc l'écran perdrait la
         seule chose qui explique pourquoi on le remplit. */
      if (o.programme && racine && PE) peindreProgramme(E.tdee || 0, E.poids || 0, lundiDe());
      // Les séances viennent peut-être d'arriver de la base : on repeint le
      // calendrier, mais JAMAIS une saisie en cours — on effacerait ses taps.
      if (racine && scEnCours && !o.creer && E && E.exos.length === 0
          && barreT && barreT.textContent === 'MES SÉANCES') scCalendrier();
    } finally { ouverture = false; }
  }

  function ajouterPour(jour, apres) {
    return ouvrir({ jour: jour, creer: true, apres: apres });
  }

  /* ═══ 12. Le panneau d'un écran hôte ════════════════════
     Le calendrier complet vit dans le plein écran ; ce panneau est ce qui le
     rend TROUVABLE depuis un écran normal. Sans lui, la seule porte d'entrée
     serait le bilan du soir — donc rien avant 21 h. */
  async function monterPanneau(hote) {
    var el = typeof hote === 'string' ? document.getElementById(hote) : hote;
    if (!el) return;
    css();
    await charger();
    peindrePanneau(el);
    /* Il se repeint tout seul quand une séance est notée ailleurs (le plein
       écran, le bilan) : demander à chaque écran hôte de le faire, c'est un
       écran qui l'oubliera. */
    document.addEventListener('natty:seance-ajoutee', function () {
      if (el.parentNode) peindrePanneau(el);
    });
  }

  function peindrePanneau(el) {
    var d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    var auj = aujourdhui(), cases = '', nb = 0, se = 0;
    for (var i = 0; i < 7; i++) {
      var j = jourDe(d), s = duJour(j);
      if (s) { nb++; se += series(s); }
      cases += '<div class="d' + (s ? ' faite' : '') + '"'
        + (j === auj ? ' style="box-shadow:inset 0 0 0 1.6px var(--nt-ink,#101014)"' : '')
        + '><span>' + JOURS_L[i] + '</span>'
        + (s ? '<span class="k">' + (series(s) || '✓') + '</span>' : '') + '</div>';
      d.setDate(d.getDate() + 1);
    }
    el.className = 'nseaP';
    el.innerHTML = '<div class="h">'
      + '<svg viewBox="0 0 32 32" fill="none">' + IC.haltere + '</svg>'
      + '<div class="t">Mes séances</div></div>'
      + '<div class="s">' + (nb
          ? nb + ' séance' + (nb > 1 ? 's' : '') + ' cette semaine, ' + se + ' séries. '
            + 'C’est ce qui rend le muscle et la graisse du bilan du soir exacts.'
          : 'Aucune séance notée cette semaine. Sans elle, le bilan du soir estime '
            + 'votre muscle et votre graisse depuis votre niveau d’activité déclaré, '
            + 'pas depuis ce que vous avez vraiment fait.')
      + '</div>'
      + '<div class="w">' + cases + '</div>'
      + '<button type="button" class="go">' + (duJour(auj)
          ? 'Voir ma séance du jour' : '+  Ajouter une séance') + '</button>'
      + (estSynchronise() ? ''
          : '<div class="s">Gardées sur cet appareil uniquement — la table `seances` '
            + 'n’existe pas encore en base.</div>');
    el.querySelector('.go').addEventListener('click', function () {
      ouvrir({ jour: auj, creer: !!duJour(auj) ? false : true });
    });
  }

  return {
    charger: charger, ouvrir: ouvrir, ajouterPour: ajouterPour,
    duJour: duJour, toutes: toutes, serie: serie, supprimer: supprimer,
    series: series, reps: reps, groupes: groupes, duree: duree, met: met,
    kcal: kcal, stimulus: stimulus, utilise: utilise, resume: resume,
    /* Le modèle, en morceaux : c'est ce qui permet au bilan d'ÉCRIRE d'où
       viennent ses grammes plutôt que de les poser. */
    detail: detail, volumePondere: volumePondere, seriesEfficaces: seriesEfficaces,
    kcalEffort: kcalEffort, epocCoef: epocCoef, partPoly: partPoly,
    qualiteEntrainement: qualiteEntrainement, frequenceGroupes: frequenceGroupes,
    /* La charge — la seule MESURE du module, quand elle est saisie. */
    analyserTexte: analyserTexte,
    tonnage: tonnage, tonnageExo: tonnageExo, chargeDe: chargeDe,
    historiqueExo: historiqueExo, mouvements: mouvements,
    /* L'objectif calorique du jour, adapté à l'entraînement. */
    besoin: besoin, habitude: habitude, kcalProgramme: kcalProgramme,
    programme: programme, poserProgramme: poserProgramme, prevuLe: prevuLe,
    lundiDe: lundiDe, proposerProgrammeSiNecessaire: proposerProgrammeSiNecessaire,
    ouvrirProgramme: function () { return ouvrir({ programme: true }); },
    chargeReelle: chargeReelle, derniereCharge: derniereCharge,
    intensiteRelative: intensiteRelative, progressionExo: progressionExo,
    meilleureCharge: meilleureCharge,
    estSynchronise: estSynchronise,
    /* Vide le cache mémoire et force une relecture. Deux usages : les bancs de
       test, qui changent les données sous le module ; et un changement de
       compte, où `uid()` change et où les séances en mémoire sont celles de
       quelqu'un d'autre. */
    _reset: function () { SEANCES = null; chargement = null; tableDispo = false; },
    monterPanneau: monterPanneau,
    estOuvert: function () { return !!racine; },
    XP_SEANCE: XP_SEANCE, VOLUME_PLEIN: VOLUME_PLEIN, MIN_PAR_SERIE: MIN_PAR_SERIE,
    // Pour les bancs de test : le catalogue et l'analyse, sans l'écran.
    _cat: { GROUPES: GROUPES, EXOS: EXOS, analyserTexte: analyserTexte,
            trouverExo: trouverExo, typeDe: typeDe, poidsSerie: poidsSerie,
            dureeExo: dureeExo, kcalExo: kcalExo }
  };
})();
