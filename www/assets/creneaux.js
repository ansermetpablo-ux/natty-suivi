/* ═══════════════════════════════════════════════════════════
   Natty — Créneaux de repas : combien, quand, et combien de macros chacun
   ───────────────────────────────────────────────────────────
     NattyCreneaux.charger()          → lit profil, questionnaire et habitudes
     NattyCreneaux.liste()            → les créneaux, avec leur cible
     NattyCreneaux.courant(d)         → le créneau où l'on se trouve
     NattyCreneaux.cibleJour()        → {p, l, g, c} pour la journée
     NattyCreneaux.mange(cle)         → ce qui est DÉJÀ enregistré aujourd'hui
     NattyCreneaux.restant(cle, plus) → ce qu'il reste sur ce créneau

   POURQUOI CE MODULE. Le bouton `+` divisait la cible du jour par le nombre de
   repas et soustrayait uniquement les plats de la session en cours. Deux défauts,
   signalés par Pablo :

   • un plat enregistré à 12 h 03 n'était pas compté quand on rouvrait `+` à
     12 h 40 : le midi repartait de sa cible pleine, alors qu'on venait de manger.
     C'est le créneau, et non la session, qui doit porter le compte ;
   • et diviser en parts égales est faux pour presque tout le monde. Quelqu'un qui
     saute le petit déjeuner n'a pas un tiers de ses calories le matin. La
     répartition vient donc de ce que la personne a DÉCLARÉ (questionnaire) et de
     ce qu'elle FAIT (ses repas des 28 derniers jours).

   Une seule source de vérité : `+` et l'écran Suivi lisent le même calcul, donc
   ils ne peuvent pas annoncer deux restes différents pour le même moment.

   Dépend de `assets/core.js` (`Natty.jour`, `Natty.calcMac`, `Natty.sbFetch`).
   ═══════════════════════════════════════════════════════════ */
var NattyCreneaux = (function () {
  'use strict';

  /* ── 1. Les découpages ────────────────────────────────────────
     Les bornes couvrent la journée en continu, de 3 h à 3 h le lendemain (d'où
     les heures > 24) : sans continuité, « dans quel créneau suis-je ? » n'aurait
     pas toujours de réponse, et un repas de 1 h du matin tomberait dans le vide.

     Le nombre de créneaux vient de `questionnaire_alim.nb_repas`, dont le
     vocabulaire réel est `1_2` / `3` / `3_collations` / `grignotage` (relevé dans
     questionnaire-alim.html — ne pas inventer d'autres valeurs).

     Les parts de base sont des fractions de la journée, pas des grammes : elles
     s'appliquent identiquement aux calories et aux trois macros, puis les
     habitudes les déforment macro par macro. */
  var DECOUPAGES = {
    2: [
      { cle: 'midi', nom: 'Déjeuner', court: 'Midi', em: '🥗', h0: 3,  h1: 16, base: 0.45 },
      { cle: 'soir', nom: 'Dîner',    court: 'Soir', em: '🍽️', h0: 16, h1: 27, base: 0.55 }
    ],
    3: [
      { cle: 'matin', nom: 'Petit déjeuner', court: 'Matin', em: '🥐', h0: 3,  h1: 11, base: 0.25 },
      { cle: 'midi',  nom: 'Déjeuner',       court: 'Midi',  em: '🥗', h0: 11, h1: 16, base: 0.40 },
      { cle: 'soir',  nom: 'Dîner',          court: 'Soir',  em: '🍽️', h0: 16, h1: 27, base: 0.35 }
    ],
    4: [
      { cle: 'matin',     nom: 'Petit déjeuner', court: 'Matin',     em: '🥐', h0: 3,  h1: 11, base: 0.22 },
      { cle: 'midi',      nom: 'Déjeuner',       court: 'Midi',      em: '🥗', h0: 11, h1: 15, base: 0.35 },
      { cle: 'collation', nom: 'Collation',      court: 'Collation', em: '🍎', h0: 15, h1: 19, base: 0.13 },
      { cle: 'soir',      nom: 'Dîner',          court: 'Soir',      em: '🍽️', h0: 19, h1: 27, base: 0.30 }
    ]
  };

  var NB_PAR_REPONSE = { '1_2': 2, '3': 3, '3_collations': 4, 'grignotage': 4 };

  /* Assez de repas journalisés pour que « ses habitudes » veuille dire quelque
     chose. En dessous, on s'en tient au déclaratif : trois repas notés ne
     décrivent pas une semaine. */
  var MIN_REPAS_HABITUDE = 6;
  var JOURS_HABITUDE = 28;
  /* Moitié-moitié entre le déclaratif et le mesuré. Tout miser sur le mesuré
     enfermerait la personne dans ses écarts (une semaine de dîners lourds
     deviendrait sa cible) ; tout miser sur le déclaratif ignorerait ce qu'elle
     fait vraiment. */
  var PART_HABITUDE = 0.5;

  var MACROS = ['p', 'l', 'g', 'c'];

  var etat = {
    charge: false,
    nb: 3,
    cibleJour: { p: 120, l: 67, g: 250, c: 2000 },
    sup: 0,                 // le supplément d'entraînement déjà dans cibleJour
    creneaux: [],           // copie de DECOUPAGES[nb] + poids + cible
    repasDuJour: [],        // [{creneau, macros}]
    nbMesures: 0,
    source: 'defaut'        // 'defaut' | 'declare' | 'declare+habitudes'
  };

  function r0(v) { return Math.round(v) || 0; }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* ── 2. Dans quel créneau tombe une heure ────────────────────
     ⚠️ L'heure vient de `created_at`, jamais de `meal_date` : une date sèche n'a
     pas d'heure, donc pas de créneau — le même piège que dans planning.js. */
  function creneauDe(d, liste) {
    liste = liste || etat.creneaux;
    if (!liste.length) return null;
    var h = d.getHours();
    for (var i = 0; i < liste.length; i++) {
      var c = liste[i];
      if (h >= c.h0 && h < c.h1) return c;
      // Les bornes au-delà de 24 h couvrent la nuit : 1 h du matin = 25 h.
      if (c.h1 > 24 && h + 24 >= c.h0 && h + 24 < c.h1) return c;
    }
    return liste[liste.length - 1];
  }

  function courant(d) { return creneauDe(d || new Date()); }

  /* ── 3. Les poids ─────────────────────────────────────────────
     On part des parts de base du découpage, on les corrige avec ce que la
     personne a déclaré, puis on mélange avec ce qu'elle fait.

     `repas_sautes` et `snacking` sont les deux seuls champs du questionnaire qui
     parlent de la RÉPARTITION dans la journée (vocabulaire relevé dans
     questionnaire-alim.html). Les autres parlent de goûts, ce qui ne dit rien de
     l'heure à laquelle on mange — les utiliser ici serait inventer. */
  function poidsDeclares(liste, q) {
    var f = {};
    liste.forEach(function (c) { f[c.cle] = c.base; });

    var sautes = q && q.repas_sautes;
    if (sautes === 'petit_dej' && f.matin !== undefined) f.matin *= 0.45;
    if (sautes === 'dejeuner' && f.midi !== undefined) f.midi *= 0.75;
    if (sautes === 'souvent_repas') {
      if (f.matin !== undefined) f.matin *= 0.7;
      if (f.midi !== undefined) f.midi *= 0.85;
    }

    // `snacking` est un tableau à choix multiples ; il peut aussi arriver en
    // chaîne selon la version du questionnaire qui a écrit la ligne.
    var sn = (q && q.snacking) || [];
    if (typeof sn === 'string') sn = [sn];
    if (sn.indexOf('bureau') > -1 && f.collation !== undefined) f.collation *= 1.4;
    if (sn.indexOf('soir') > -1 && f.soir !== undefined) f.soir *= 1.12;

    return normaliser(f);
  }

  function normaliser(f) {
    var s = 0, out = {};
    Object.keys(f).forEach(function (k) { s += f[k]; });
    if (!s) { Object.keys(f).forEach(function (k) { out[k] = 1 / Object.keys(f).length; }); return out; }
    Object.keys(f).forEach(function (k) { out[k] = f[k] / s; });
    return out;
  }

  /* Les habitudes, MACRO PAR MACRO : quelqu'un peut prendre ses glucides le midi
     et ses protéines le soir. Une part unique par créneau écraserait justement
     l'information que Pablo demande de prendre en compte. */
  function poidsMesures(liste, repas) {
    var somme = {}, total = { p: 0, l: 0, g: 0, c: 0 };
    liste.forEach(function (c) { somme[c.cle] = { p: 0, l: 0, g: 0, c: 0 }; });
    repas.forEach(function (r) {
      if (!somme[r.creneau]) return;
      MACROS.forEach(function (m) { somme[r.creneau][m] += r.macros[m] || 0; total[m] += r.macros[m] || 0; });
    });
    var out = {};
    liste.forEach(function (c) { out[c.cle] = {}; });
    MACROS.forEach(function (m) {
      if (!total[m]) {
        // Rien de mesuré pour cette macro : parts égales, le mélange s'en
        // occupera avec le déclaratif.
        liste.forEach(function (c) { out[c.cle][m] = 1 / liste.length; });
        return;
      }
      liste.forEach(function (c) { out[c.cle][m] = somme[c.cle][m] / total[m]; });
    });
    return out;
  }

  /* ⚠️ Un créneau ne descend jamais sous 8 % de la journée. Sans plancher, une
     personne qui n'a jamais journalisé son petit déjeuner se verrait proposer
     une cible du matin proche de zéro, donc « objectif atteint » avant d'avoir
     mangé — l'inverse du service rendu. */
  var PLANCHER = 0.08;

  function melanger(liste, decl, mes, assezDeMesures) {
    var out = {};
    liste.forEach(function (c) {
      out[c.cle] = {};
      MACROS.forEach(function (m) {
        var d = decl[c.cle];
        var v = assezDeMesures ? (1 - PART_HABITUDE) * d + PART_HABITUDE * mes[c.cle][m] : d;
        out[c.cle][m] = Math.max(PLANCHER, v);
      });
    });
    // Renormalisation par macro : le plancher a pu faire dépasser 100 %.
    MACROS.forEach(function (m) {
      var s = 0;
      liste.forEach(function (c) { s += out[c.cle][m]; });
      if (s) liste.forEach(function (c) { out[c.cle][m] /= s; });
    });
    return out;
  }

  /* ── 4. Chargement ───────────────────────────────────────────── */
  /* Le supplément d'entraînement du jour, en kcal. `assets/seance.js` est
     FACULTATIF : sans lui — ou sans séance notée, programmée ni habituelle —
     il vaut 0, et les cibles sont exactement celles d'avant. */
  function supplementSeance(poids, tdee) {
    if (!window.NattySeance || !NattySeance.besoin || !poids || !tdee) return 0;
    try {
      var b = NattySeance.besoin(Natty.jour(), poids, tdee);
      return Math.max(0, (b.total || tdee) - tdee);
    } catch (e) { return 0; }
  }

  async function charger(forcer) {
    if (etat.charge && !forcer) return etat;

    var onb = null, q = null, repas = [];

    try {
      // ⚠️ Ne demander à `onboarding` que `poids` et `tdee` : les colonnes de
      // macros n'existent pas, et une colonne inconnue fait échouer TOUTE la
      // requête en 42703 (voir §7 de CLAUDE.md).
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + Natty.USER_ID
        + '&select=poids,tdee&order=created_at.desc&limit=5');
      // La table contient de vrais doublons : on prend la première ligne
      // réellement exploitable, pas la première tout court.
      onb = (r || []).filter(function (x) { return x && (x.poids || x.tdee); })[0] || null;
    } catch (e) {}

    try {
      var qa = await Natty.sbFetch('questionnaire_alim?user_id=eq.' + Natty.USER_ID
        + '&select=nb_repas,snacking,repas_sautes&order=completed_at.desc&limit=1');
      q = (qa && qa[0]) || null;
    } catch (e) {}

    if (onb) {
      var poids = parseFloat(onb.poids) || 0, tdee = parseFloat(onb.tdee) || 0;
      if (poids || tdee) {
        /* ⚠️ LA FORMULE VIT DANS `assets/core.js` (`Natty.macrosJour`), et la
           recopier ici était déjà une dette : elle porte désormais un
           SUPPLÉMENT D'ENTRAÎNEMENT, et deux copies auraient annoncé deux
           objectifs pour la même journée — l'écran Suivi et le bouton `+` se
           seraient contredits sur ce qu'il reste à manger. */
        etat.sup = supplementSeance(poids, tdee);
        etat.cibleJour = (window.Natty && Natty.macrosJour)
          ? Natty.macrosJour(poids, tdee, etat.sup)
          : { p: poids ? r0(poids * 2) : 0, l: tdee ? r0(tdee * 0.25 / 9) : 0,
              g: tdee ? r0(tdee * 0.5 / 4) : 0, c: tdee ? r0(tdee) : 0 };
        etat.source = 'declare';
      }
    }

    etat.nb = (q && NB_PAR_REPONSE[q.nb_repas]) || 3;
    var liste = DECOUPAGES[etat.nb].map(function (c) {
      return { cle: c.cle, nom: c.nom, court: c.court, em: c.em, h0: c.h0, h1: c.h1, base: c.base };
    });

    // Les habitudes : les repas des 28 derniers jours, rangés par créneau.
    try {
      var depuis = new Date(); depuis.setDate(depuis.getDate() - JOURS_HABITUDE);
      var ms = await Natty.sbFetch('meals?user_id=eq.' + Natty.USER_ID
        + '&created_at=gte.' + depuis.toISOString()
        + '&order=created_at.desc&limit=200&select=id,name,created_at');
      var ids = (ms || []).map(function (m) { return m.id; });
      var parRepas = {};
      for (var i = 0; i < ids.length; i += 40) {
        var lot = ids.slice(i, i + 40).map(function (x) { return '"' + x + '"'; }).join(',');
        // ⚠️ Demander les quatre colonnes de macros : `calcMac` les préfère à la
        // table, et une colonne non demandée arrive `undefined` — donc « rien
        // d'écrit », donc on retomberait sur le filet sans le savoir.
        var ings = await Natty.sbFetch('meal_ingredients?meal_id=in.(' + encodeURIComponent(lot) + ')'
          + '&select=meal_id,name,quantity_g,calories,proteins_g,carbs_g,fats_g');
        (ings || []).forEach(function (x) {
          (parRepas[x.meal_id] = parRepas[x.meal_id] || []).push(x);
        });
      }
      repas = (ms || []).map(function (m) {
        var d = new Date(m.created_at);
        var c = creneauDe(d, liste);
        return { id: m.id, nom: m.name || 'Repas', creneau: c ? c.cle : null, quand: d,
                 macros: Natty.calcMac(parRepas[m.id] || []) };
      }).filter(function (x) { return x.creneau; });
    } catch (e) { repas = []; }

    etat.nbMesures = repas.length;
    var assez = repas.length >= MIN_REPAS_HABITUDE;
    var decl = poidsDeclares(liste, q);
    var mes = poidsMesures(liste, repas);
    var poidsFinal = melanger(liste, decl, mes, assez);
    if (assez) etat.source = 'declare+habitudes';

    liste.forEach(function (c) {
      c.poids = poidsFinal[c.cle];
      c.cible = {
        p: r0(etat.cibleJour.p * c.poids.p),
        l: r0(etat.cibleJour.l * c.poids.l),
        g: r0(etat.cibleJour.g * c.poids.g),
        c: r0(etat.cibleJour.c * c.poids.c)
      };
    });
    etat.creneaux = liste;

    // Les repas d'AUJOURD'HUI, pour savoir ce qui est déjà mangé par créneau.
    var jour = Natty.jour();
    etat.repasDuJour = repas.filter(function (x) { return Natty.jour(x.quand) === jour; });

    etat.charge = true;
    return etat;
  }

  /* ── 5. Lecture ──────────────────────────────────────────────── */
  function liste() { return etat.creneaux.slice(); }
  function cibleJour() { return { p: etat.cibleJour.p, l: etat.cibleJour.l, g: etat.cibleJour.g, c: etat.cibleJour.c }; }
  function par(cle) {
    return etat.creneaux.filter(function (c) { return c.cle === cle; })[0] || null;
  }

  /** Ce qui est DÉJÀ enregistré aujourd'hui sur ce créneau. */
  function mange(cle) {
    var t = { p: 0, l: 0, g: 0, c: 0 };
    etat.repasDuJour.forEach(function (r) {
      if (r.creneau !== cle) return;
      MACROS.forEach(function (m) { t[m] += r.macros[m] || 0; });
    });
    return { p: r1(t.p), l: r1(t.l), g: r1(t.g), c: r0(t.c) };
  }

  /** Le total du jour, tous créneaux confondus. */
  function mangeJour() {
    var t = { p: 0, l: 0, g: 0, c: 0 };
    etat.repasDuJour.forEach(function (r) {
      MACROS.forEach(function (m) { t[m] += r.macros[m] || 0; });
    });
    return { p: r1(t.p), l: r1(t.l), g: r1(t.g), c: r0(t.c) };
  }

  /**
   * Ce qu'il reste sur un créneau : sa cible, moins ce qui y est déjà
   * enregistré, moins `plus` (la session en cours, pas encore écrite).
   * @param {string} cle
   * @param {object} [plus] {p,l,g,c}
   */
  function restant(cle, plus) {
    var c = par(cle);
    if (!c) return { p: 0, l: 0, g: 0, c: 0 };
    var d = mange(cle), e = plus || {};
    var out = {};
    MACROS.forEach(function (m) {
      out[m] = Math.max(0, Math.round((c.cible[m] || 0) - (d[m] || 0) - (e[m] || 0)));
    });
    return out;
  }

  /** Le dépassement éventuel, pour pouvoir l'annoncer au lieu d'afficher 0. */
  function depasse(cle, plus) {
    var c = par(cle);
    if (!c) return 0;
    var d = mange(cle), e = plus || {};
    return Math.max(0, Math.round((d.c || 0) + (e.c || 0) - (c.cible.c || 0)));
  }

  /** Combien de repas déjà enregistrés aujourd'hui sur ce créneau. */
  function nbDeja(cle) {
    return etat.repasDuJour.filter(function (r) { return r.creneau === cle; }).length;
  }

  /**
   * Les repas du jour de ce créneau, du plus récent au plus ancien.
   *
   * Rendus avec leur `id` : c'est ce qui permet au guide du jour
   * (`assets/journee.js`) de proposer « Modifier ce repas » sur une étape déjà
   * cochée, au lieu de renvoyer chercher le plat dans l'historique. `nbDeja`
   * n'avait besoin que de les compter — d'où l'ajout ici plutôt qu'un second
   * chargement ailleurs, qui aurait redemandé les mêmes lignes.
   */
  function repasDe(cle) {
    return etat.repasDuJour
      .filter(function (r) { return r.creneau === cle; })
      .slice()
      .sort(function (a, b) { return b.quand - a.quand; });
  }

  /* Rechargement des repas du jour seulement — appelé après un enregistrement,
     sans refaire tout le calcul des poids (les habitudes ne bougent pas d'un
     repas à l'autre). */
  async function rafraichirJour() {
    if (!etat.charge) return charger();
    try {
      var d0 = new Date(); d0.setHours(0, 0, 0, 0);
      var ms = await Natty.sbFetch('meals?user_id=eq.' + Natty.USER_ID
        + '&created_at=gte.' + d0.toISOString() + '&order=created_at.desc&limit=40&select=id,name,created_at');
      var ids = (ms || []).map(function (m) { return m.id; });
      var parRepas = {};
      if (ids.length) {
        var lot = ids.map(function (x) { return '"' + x + '"'; }).join(',');
        var ings = await Natty.sbFetch('meal_ingredients?meal_id=in.(' + encodeURIComponent(lot) + ')'
          + '&select=meal_id,name,quantity_g,calories,proteins_g,carbs_g,fats_g');
        (ings || []).forEach(function (x) { (parRepas[x.meal_id] = parRepas[x.meal_id] || []).push(x); });
      }
      var jour = Natty.jour();
      etat.repasDuJour = (ms || []).map(function (m) {
        var d = new Date(m.created_at);
        var c = creneauDe(d);
        return { id: m.id, nom: m.name || 'Repas', creneau: c ? c.cle : null, quand: d,
                 macros: Natty.calcMac(parRepas[m.id] || []) };
      }).filter(function (x) { return x.creneau && Natty.jour(x.quand) === jour; });
    } catch (e) {}
    return etat;
  }

  return {
    charger: charger, rafraichirJour: rafraichirJour,
    liste: liste, courant: courant, cibleJour: cibleJour, par: par,
    // Le supplément d'entraînement déjà compté dans `cibleJour`, en kcal.
    supplement: function () { return etat.sup || 0; },
    mange: mange, mangeJour: mangeJour, restant: restant, depasse: depasse,
    nbDeja: nbDeja, repas: repasDe,
    nb: function () { return etat.nb; },
    source: function () { return etat.source; },
    nbMesures: function () { return etat.nbMesures; }
  };
})();
