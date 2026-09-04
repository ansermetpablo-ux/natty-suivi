/* ═══════════════════════════════════════════════════════════
   Natty — Le bilan : le récap cinématique du soir, et celui de la semaine
   ───────────────────────────────────────────────────────────
     NattyBilan.proposerSiNecessaire(delai)  le déclencheur des écrans
     NattyBilan.ouvrir({semaine:bool})       la séquence, à la demande
     NattyBilan.analyse(nbJours)             les chiffres calculés (lecture)
     NattyBilan.reponses()                   ce que la personne a répondu

   CE QUE C'EST. Un plein écran qui raconte la journée qui vient de se passer :
   ce qui a été mangé, ce que la personne en a pensé (trois questions), ce que
   les chiffres en disent (quatre critères), ce que son corps en a fait
   (muscle / graisse, estimés), et où elle en est depuis le début (une courbe).
   Le samedi soir, la même séquence porte sur les sept jours.

   POURQUOI UN MODULE ET PAS UNE PAGE. Même raison qu'`assets/journee.js`,
   `assets/planning.js` et `assets/ajout.js` : il se pose PAR-DESSUS l'écran
   courant, ne vole pas la navigation, et se ferme sans laisser d'historique.

   ⚠️ IL N'INVENTE AUCUN CHIFFRE, et c'est toute la difficulté de cet écran.
   Un bilan est l'endroit de l'app où il serait le plus facile — et le plus
   grave — d'inventer : « vous avez brûlé 400 g de graisse » est une phrase que
   personne ne peut vérifier. Deux règles, donc :
   • tout ce qui est MESURÉ vient de `meals` + `meal_ingredients` via
     `Natty.calcMac`, qui préfère les macros écrites à la table (règle 12) ;
   • tout ce qui est ESTIMÉ (muscle, graisse) est annoncé comme tel, sur
     l'écran, avec son modèle en une ligne — et jamais avec plus de précision
     que le modèle n'en porte. D'où des GRAMMES et pas des kilos : le gain de
     muscle plafonne autour de 0,5 % du poids par SEMAINE, donc quelques
     dizaines de grammes par jour. Afficher « 0,03 kg » aurait été
     techniquement juste et pratiquement illisible.

   ⚠️ IL NE SE SUPERPOSE JAMAIS À UN AUTRE PLEIN ÉCRAN — planification,
   génération, ajout d'un plat et guide du jour passent avant.

   Dépend d'`assets/core.js`. Utilise `assets/creneaux.js` s'il est chargé (pour
   savoir combien de repas la personne prévoit, donc juger la régularité) et
   `assets/seance.js` s'il est là (pour que le muscle et la graisse découlent de
   l'entraînement RÉEL du jour, et non du niveau d'activité déclaré une fois
   pour toutes) — il sait se passer des deux.
   ═══════════════════════════════════════════════════════════ */
window.NattyBilan = (function () {
  'use strict';

  /* ═══ 1. Vocabulaire ═════════════════════════════════════ */

  var JOURS_COURTS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  var H_BILAN = 21;          // à partir de 21 h, le bilan du jour a du sens
  var JOURS_COURBE = 30;     // ce que la courbe de progression montre
  var VARIETE_CIBLE = 12;    // ingrédients distincts pour un « 100 » de variété

  /* L'énergie d'un kilo de tissu adipeux. ~7 700 kcal est la valeur
     conventionnelle (9 kcal/g × ~86 % de lipides) : c'est une approximation
     admise, pas une mesure, et l'écran le dit. */
  var KCAL_PAR_KG_GRAS = 7700;

  /* Le gain de muscle POSSIBLE, en fraction du poids de corps par semaine, et
     selon l'activité DÉCLARÉE à l'onboarding (`onboarding.activite`, valeurs
     relevées dans onboarding.html — ne pas en inventer d'autres).
     ⚠️ Ces bornes sont volontairement basses. La littérature situe le gain d'un
     débutant qui s'entraîne autour de 0,25 à 0,5 % du poids par semaine ; les
     prendre par le haut donnerait des chiffres flatteurs et faux. Sans séance
     déclarée, il reste une valeur non nulle mais petite : l'organisme s'adapte
     un peu à la charge du quotidien, et surtout quelqu'un qui vient de se
     mettre aux protéines n'est pas à zéro. */
  var TAUX_MUSCLE = { sedentaire: 0.0015, leger: 0.0025, modere: 0.0035, actif: 0.005 };
  var TAUX_DEFAUT = 0.0025;

  /* Ce qui reste de potentiel un jour SANS stimulus, quand la personne
     journalise ses séances. Demande de Pablo (2026-09-02) : les grammes de
     muscle et de graisse doivent découler de la séance, pas d'une case cochée
     à l'inscription.
     ⚠️ CE N'EST PAS ZÉRO, et ce n'est pas de la complaisance : la synthèse
     protéique reste élevée ~48 h après une séance (c'est déjà pris en compte
     par `NattySeance.stimulus`, qui compte la veille pour moitié), et le corps
     de quelqu'un qui vient de se mettre aux protéines s'adapte un peu à la
     charge du quotidien. Un plancher à 0 afficherait « 0 g » tous les jours de
     repos, ce qui est faux dans l'autre sens.
     ⚠️ ET IL NE S'APPLIQUE QU'À CEUX QUI JOURNALISENT (voir `corpsDuJour`) :
     appliqué à tout le monde, il ferait fondre du jour au lendemain les
     estimations de gens qui n'ont rien changé à leur vie. */
  var PLANCHER_SEANCE = 0.30;

  /* ═══ La qualité NUTRITIONNELLE, et pourquoi ce n'est plus un ratio ═══
     Demande de Pablo (2026-09-02, second passage) : « ça doit vraiment être
     personnalisé en fonction de la qualité d'entraînement ET de nutrition ».

     ⚠️⚠️ CE QUE FAISAIT L'ANCIENNE VERSION, ET POURQUOI C'ÉTAIT FAIBLE. Deux
     facteurs : `min(1, protéines / (poids × 2))` et une rampe d'énergie entre
     85 et 100 % de la dépense. Le premier comparait à une cible arbitraire —
     2 g/kg est le HAUT de la fourchette utile, donc quelqu'un à 1,8 g/kg (un
     apport excellent) était plafonné à 90 % pour rien. Et aucun des deux ne
     regardait la RÉPARTITION, alors que la base la connaît repas par repas.

     Trois termes maintenant, et chacun vient d'une mesure :
     • PROTÉINES en g/kg de poids de corps — la grandeur que la littérature
       utilise réellement. Rien en dessous de 0,8 g/kg, plein à 1,8, et au-delà
       ça ne monte plus : c'est le plateau observé, pas une opinion.
     • ÉNERGIE, rapportée à la dépense RÉELLE du jour (séance comprise). Rampe
       de 0,80 à 1,00 : en dessous de 80 % le corps ne construit plus, il
       arbitre. Le seuil de 0,85 de la version précédente était plus sévère sans
       raison mesurable.
     • RÉPARTITION : combien de repas ont porté une dose utile (≥ 0,25 g/kg).
       Elle MODULE de 0,85 à 1,00, elle ne commande pas — un apport total
       excellent mal réparti reste un bon apport.

     ⚠️ Les deux premiers se MULTIPLIENT parce qu'ils sont tous deux LIMITANTS :
     des protéines sans énergie ne construisent rien, et l'inverse non plus.
     C'est la loi du minimum, pas une moyenne — une moyenne laisserait un
     excellent apport protéique compenser un jeûne. */
  var PROT_MIN = 0.8, PROT_PLEIN = 1.8;     // g par kg de poids de corps
  var ENERGIE_MIN = 0.80, ENERGIE_PLEIN = 1.00;
  var DOSE_UTILE = 0.25;                     // g/kg dans un même repas
  var DOSES_PLEIN = 3;

  /** Une rampe linéaire bornée : 0 sous `bas`, 1 au-dessus de `haut`. */
  function rampe(v, bas, haut) {
    if (haut <= bas) return v >= haut ? 1 : 0;
    return borne((v - bas) / (haut - bas), 0, 1);
  }

  /**
   * La qualité nutritionnelle d'une journée pour la CONSTRUCTION musculaire.
   * @returns {Object} {note, fProt, fEnergie, fRepart, gParKg, ratio, doses}
   */
  function qualiteNutrition(a, profil, depense) {
    var out = { note: 0, fProt: 0, fEnergie: 0, fRepart: 0,
                gParKg: 0, ratio: 0, doses: 0 };
    if (!profil.poids || !depense || a.vide) return out;

    out.gParKg = a.mac.p / profil.poids;
    out.fProt = rampe(out.gParKg, PROT_MIN, PROT_PLEIN);

    out.ratio = a.mac.c / depense;
    out.fEnergie = rampe(out.ratio, ENERGIE_MIN, ENERGIE_PLEIN);

    var seuil = DOSE_UTILE * profil.poids;
    out.seuilDose = Math.round(seuil);
    out.nbRepas = (a.protRepas || []).length;
    out.doses = (a.protRepas || []).filter(function (p) { return p >= seuil; }).length;
    out.fRepart = rampe(out.doses, 0, DOSES_PLEIN);

    out.note = out.fProt * out.fEnergie * (0.85 + 0.15 * out.fRepart);
    return out;
  }

  /* Et ce qu'un jour de PLEIN stimulus vaut.
     ⚠️⚠️ IL DOIT ÊTRE > 1, ET C'EST UN DÉFAUT TROUVÉ AU BANC. Le facteur
     plafonnait d'abord à 1 — exactement la valeur de quelqu'un qui ne
     journalise pas. Journaliser ne pouvait donc JAMAIS augmenter l'estimation :
     au mieux elle restait égale, et la séance faisait en plus monter la dépense,
     donc baisser le facteur énergie. Mesuré : 21 g de muscle sans séance contre
     13 g avec, à alimentation identique. Autrement dit l'écran répondait « vous
     avez construit MOINS » à quelqu'un qui venait de déclarer sa séance — soit
     l'inverse exact de ce que la fonctionnalité promet.
     Le couple 0,30 / 1,60 REDISTRIBUE la semaine sans la gonfler : quatre jours
     pleins et trois de repos donnent (4 × 1,6 + 3 × 0,3) / 7 ≈ 1,04, donc le
     même total hebdomadaire qu'avant, réparti là où l'entraînement a eu lieu.
     C'est bien ce qu'on veut dire — pas « vous construisez plus qu'avant »,
     mais « voilà QUAND vous construisez ». */
  var PLAFOND_SEANCE = 1.60;

  /* ═══ 2. Petits utilitaires ══════════════════════════════ */

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function r0(n) { return Math.round(n || 0); }
  function borne(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function jourDe(d) { return (window.Natty && Natty.jour) ? Natty.jour(d) : ''; }
  function jourCourant() { return jourDe(); }

  function dateFr(d) {
    return d.getDate() + ' ' + MOIS[d.getMonth()];
  }

  /** Le lundi de la semaine de `d`, en date LOCALE (jamais `toISOString`). */
  function lundiDe(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  function uid() { return (window.Natty && Natty.USER_ID) || 'anon'; }
  function cle(quoi) { return 'natty_bilan_' + quoi + '_' + uid(); }

  function lire(k, defaut) {
    try { var v = localStorage.getItem(k); return v == null ? defaut : v; }
    catch (e) { return defaut; }
  }
  function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ═══ 3. Les données ═════════════════════════════════════
     Un seul relevé sert les deux séquences : les mêmes repas, rangés par jour.
     Le bilan de la semaine n'est pas un autre calcul, c'est le même sur sept
     jours — sans quoi les deux écrans finiraient par se contredire. */

  var cache = null;   // {profil, jours:{'2026-08-10':{...}}, chargeLe}

  /** Le profil : poids, dépense, activité, objectif. */
  async function chargerProfil() {
    var out = { poids: 0, tdee: 0, activite: '', objectif: '', prenom: '', nbCreneaux: 3 };
    try {
      /* ⚠️ Ne demander à `onboarding` que des colonnes qui EXISTENT : une
         colonne inconnue fait échouer la requête ENTIÈRE en `42703`, et on
         retomberait silencieusement sur les valeurs par défaut. La liste réelle
         est en §4 de CLAUDE.md — `nb_repas`, `proteines`, `calories` n'en font
         pas partie. */
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + uid()
        + '&select=poids,tdee,activite,objectif_type,objectif_valeur,objectif_semaines,prenom&order=created_at.desc&limit=5');
      // La table contient de vrais doublons, dont des lignes sans poids ni
      // tdee : on prend la première ligne EXPLOITABLE, pas la première.
      var d = (r || []).filter(function (x) { return x && (x.poids || x.tdee); })[0] || (r || [])[0];
      if (d) {
        out.poids = parseFloat(d.poids) || 0;
        out.tdee = parseFloat(d.tdee) || 0;
        out.objKg = parseFloat(d.objectif_valeur) || 0;
        out.objSem = parseInt(d.objectif_semaines, 10) || 0;
        out.activite = d.activite || '';
        out.objectif = d.objectif_type || '';
        out.prenom = d.prenom || '';
      }
    } catch (e) {}

    /* Les cibles ne sont pas stockées : elles se dérivent de poids et tdee,
       par `Natty.macrosJour` — LA formule de l'app depuis qu'elle porte un
       supplément d'entraînement (elle vivait en trois copies).

       ⚠️⚠️ DEUX CIBLES, ET LES CONFONDRE SERAIT UN CONTRESENS.
       • `cible` est la DÉPENSE de maintien. C'est elle que `corpsDuJour` lit
         (`c.c`) pour calculer le déficit, et une dépense ne monte pas parce
         qu'on a l'intention de s'entraîner — elle monte parce qu'on s'est
         entraîné, et ces kcal-là sont ajoutées à part (`kcalSeance`).
       • `cibleDu(jour)` est l'OBJECTIF de ce jour-là, supplément compris :
         c'est à lui qu'on compare ce qui a été mangé, sinon un jour de salle
         serait noté « trop mangé » pour avoir mangé ce qu'il fallait. */
    out.cible = macros(out.poids, out.tdee, 0);
    /* ⚠️ Et la BASE de l'objectif n'est pas la dépense : l'objectif de poids
       déclaré la déplace. `cible` reste la dépense — c'est contre elle que se
       calcule le déficit, et une dépense ne baisse pas parce qu'on a décidé de
       maigrir. `cibleDu` est ce qu'il FALLAIT manger, donc il part de la base. */
    out.base = (window.Natty && Natty.baseObjectif)
      ? Natty.baseObjectif(out.tdee, out.objKg, out.objSem) : out.tdee;
    out.cibleDu = function (j) {
      return macros(out.poids, out.base, supplement(j, out.poids, out.tdee));
    };

    // Combien de repas la personne prévoit par jour — c'est le denominateur de
    // la régularité. `NattyCreneaux` le sait déjà ; sans lui, 3 par défaut.
    if (window.NattyCreneaux) {
      try {
        await NattyCreneaux.charger();
        var l = NattyCreneaux.liste();
        if (l && l.length) out.nbCreneaux = l.length;
      } catch (e) {}
    }
    return out;
  }

  /**
   * Les repas des `nb` derniers jours, rangés par journée LOCALE.
   * ⚠️ Le jour vient de `created_at` (horodaté), jamais de `meal_date` : une
   * date sèche n'a pas d'heure, donc pas de créneau — et un repas noté à
   * 00 h 30 serait rangé la veille (même piège que `planning.js`).
   */
  async function chargerJours(nb) {
    var jours = {};
    var depuis = new Date(); depuis.setDate(depuis.getDate() - nb);
    depuis.setHours(0, 0, 0, 0);
    try {
      var ms = await Natty.sbFetch('meals?user_id=eq.' + uid()
        + '&created_at=gte.' + depuis.toISOString()
        + '&order=created_at.desc&limit=500&select=id,name,created_at');
      var ids = (ms || []).map(function (m) { return m.id; });
      var parRepas = {};
      // Par lots de 50 : PostgREST plafonne la longueur d'URL, et un `in.()` de
      // 500 identifiants la dépasse (même découpage que social.js et suivi.html).
      for (var i = 0; i < ids.length; i += 50) {
        var lot = ids.slice(i, i + 50).join(',');
        // ⚠️ Demander les quatre colonnes de macros : `calcMac` les PRÉFÈRE à la
        // table, mais une colonne non demandée arrive `undefined` — donc « rien
        // d'écrit », donc on retomberait sur le filet sans le savoir.
        var ings = await Natty.sbFetch('meal_ingredients?meal_id=in.(' + lot + ')'
          + '&select=meal_id,name,quantity_g,calories,proteins_g,carbs_g,fats_g');
        (ings || []).forEach(function (x) {
          (parRepas[x.meal_id] = parRepas[x.meal_id] || []).push(x);
        });
      }
      (ms || []).forEach(function (m) {
        var d = new Date(m.created_at), j = jourDe(d);
        var e = jours[j] || (jours[j] = {
          jour: j, date: d, nbRepas: 0, heures: [], ingredients: [],
          mac: { p: 0, l: 0, g: 0, c: 0 }, noms: [], protRepas: []
        });
        var mac = Natty.calcMac(parRepas[m.id] || []);
        e.nbRepas++;
        /* ⚠️ Les protéines sont gardées REPAS PAR REPAS, en plus du total. La
           synthèse protéique répond à des DOSES (~0,3 g/kg) et retombe entre
           deux : 160 g pris en un seul repas ne valent pas 160 g répartis sur
           quatre. Le total seul ne peut pas voir la différence, et c'est l'un
           des rares leviers nutritionnels que la base permet vraiment de
           mesurer — les repas sont horodatés et chiffrés un par un. */
        e.protRepas.push(mac.p);
        e.heures.push(d.getHours() + d.getMinutes() / 60);
        e.noms.push(m.name || '');
        (parRepas[m.id] || []).forEach(function (i) {
          if (i.name) e.ingredients.push(String(i.name).toLowerCase().trim());
        });
        e.mac.p += mac.p; e.mac.l += mac.l; e.mac.g += mac.g; e.mac.c += mac.c;
      });
    } catch (e) {}
    Object.keys(jours).forEach(function (j) {
      var e = jours[j];
      e.mac = { p: r0(e.mac.p), l: r0(e.mac.l), g: r0(e.mac.g), c: r0(e.mac.c) };
    });
    return jours;
  }

  async function charger() {
    if (cache && (Date.now() - cache.chargeLe) < 60000) return cache;
    var profil = await chargerProfil();
    var jours = await chargerJours(JOURS_COURBE + 2);
    /* Les séances, si le module est là. Le `catch` est volontairement muet :
       un journal d'entraînement indisponible ne doit pas empêcher le bilan de
       s'ouvrir — il retombe alors exactement sur le modèle d'avant, celui du
       niveau d'activité déclaré. */
    if (window.NattySeance) {
      try { await NattySeance.charger(JOURS_COURBE + 4); } catch (e) {}
    }
    cache = { profil: profil, jours: jours, chargeLe: Date.now() };
    return cache;
  }

  /* ═══ 4. L'analyse ═══════════════════════════════════════
     Quatre critères, et le choix des quatre est la décision de fond de cet
     écran. Chacun doit être (a) calculable à partir de ce que la base contient
     vraiment, et (b) explicable en une phrase à la personne. Tout critère qui
     échoue à l'un des deux est un chiffre décoratif.

     • RÉGULARITÉ — a-t-on mangé au rythme prévu ? (repas notés / créneaux)
     • INTENSITÉ  — l'apport était-il à la hauteur de la dépense ? (kcal / tdee)
     • VARIÉTÉ    — combien d'aliments différents ?
     • ÉQUILIBRE  — les trois macros dans leurs proportions ?

     Écartés volontairement : « hydratation » (rien ne la mesure — l'onboarding
     déclare un nombre de litres une fois pour toutes, ce n'est pas un suivi),
     et « qualité » (elle demanderait une classification des aliments que la
     table de `core.js` ne porte pas). Un critère qu'on ne peut pas mesurer
     n'est pas un critère, c'est une décoration. */

  /** Note d'atteinte : 100 au but, et le dépassement coûte plus que le manque. */
  function noteRatio(valeur, cible) {
    if (!cible) return null;
    var r = valeur / cible;
    var ecart = r >= 1 ? (r - 1) * 1.25 : (1 - r);
    return r0(borne(100 - ecart * 100, 0, 100));
  }

  /** La formule partagée, avec son repli si `assets/core.js` est ancien. */
  function macros(poids, tdee, sup) {
    if (window.Natty && Natty.macrosJour) return Natty.macrosJour(poids, tdee, sup);
    return { p: poids ? r0(poids * 2) : 0, l: tdee ? r0(tdee * 0.25 / 9) : 0,
             g: tdee ? r0(tdee * 0.5 / 4) : 0, c: tdee ? r0(tdee) : 0 };
  }

  /* Le supplément d'entraînement d'un jour donné. `assets/seance.js` est
     FACULTATIF : sans lui, il vaut 0 et tout redevient le modèle d'avant. */
  function supplement(j, poids, tdee) {
    if (!window.NattySeance || !NattySeance.besoin || !poids || !tdee) return 0;
    try {
      var b = NattySeance.besoin(j || jourCourant(), poids, tdee);
      return Math.max(0, (b.total || tdee) - tdee);
    } catch (e) { return 0; }
  }

  function analyserJour(e, profil, jour) {
    /* ⚠️ `jour` est passé EXPLICITEMENT : sur une journée sans repas, `e` est
       `undefined` et la date serait perdue — donc l'objectif d'un lundi de
       salle non journalisé retomberait sur celui d'un dimanche. */
    var c = profil.cibleDu ? profil.cibleDu((e && e.jour) || jour) : profil.cible;
    var vide = !e || !e.nbRepas;
    /* ⚠️ Une journée sans repas arrive ici en `undefined` (la clé n'existe pas
       dans `cache.jours`), pas en objet vide. On se donne donc des valeurs
       neutres tout de suite : les libellés des critères lisaient `e.mac.c`
       directement et faisaient tomber toute l'analyse sur un jour non noté —
       or c'est justement le cas le plus fréquent dans une série de 30 jours,
       donc celui qui cassait la courbe entière. Attrapé au banc. */
    var mac = (e && e.mac) || { p: 0, l: 0, g: 0, c: 0 };
    var nbRepas = (e && e.nbRepas) || 0;

    var regularite = vide ? 0
      : r0(borne((nbRepas / Math.max(1, profil.nbCreneaux)) * 100, 0, 100));

    var intensite = vide ? 0 : noteRatio(mac.c, c.c);

    var distincts = vide ? 0 : (function () {
      var u = {}; (e.ingredients || []).forEach(function (n) { if (n) u[n] = 1; });
      return Object.keys(u).length;
    })();
    var variete = r0(borne((distincts / VARIETE_CIBLE) * 100, 0, 100));

    /* L'équilibre compare les trois macros à LEUR cible, pas entre elles : une
       journée à 40 % de partout est équilibrée en proportions et pourtant très
       en dessous — c'est l'intensité qui doit le dire, pas l'équilibre. On
       normalise donc chaque macro par sa part atteinte, puis on regarde
       l'écart entre ces parts. */
    var equilibre = null;
    if (!vide && c.p && c.l && c.g) {
      var parts = [mac.p / c.p, mac.l / c.l, mac.g / c.g];
      var moy = (parts[0] + parts[1] + parts[2]) / 3;
      if (moy > 0) {
        var disp = parts.reduce(function (s, x) { return s + Math.abs(x / moy - 1); }, 0) / 3;
        equilibre = r0(borne(100 - disp * 100, 0, 100));
      } else equilibre = 0;
    }

    var critere = [
      { cle: 'reg', nom: 'Régularité', em: '⏱', note: regularite,
        dit: vide ? 'Aucun repas noté' : nbRepas + ' repas noté' + (nbRepas > 1 ? 's' : '')
             + ' sur ' + profil.nbCreneaux + ' prévus' },
      { cle: 'int', nom: 'Intensité', em: '⚡', note: intensite,
        dit: c.c ? mac.c + ' kcal sur ' + c.c + ' de dépense' : 'Dépense inconnue' },
      { cle: 'var', nom: 'Variété', em: '🌿', note: variete,
        dit: distincts + ' aliment' + (distincts > 1 ? 's' : '') + ' différent' + (distincts > 1 ? 's' : '') },
      { cle: 'eqi', nom: 'Équilibre', em: '⚖️', note: equilibre,
        dit: c.p ? mac.p + 'g P · ' + mac.g + 'g G · ' + mac.l + 'g L' : 'Objectifs inconnus' }
    ];

    // La note globale ne compte QUE les critères calculables : moyenner un
    // `null` à zéro punirait quelqu'un dont l'onboarding est incomplet.
    var connus = critere.filter(function (x) { return x.note !== null; });
    var globale = connus.length
      ? r0(connus.reduce(function (s, x) { return s + x.note; }, 0) / connus.length) : null;

    /* ⚠️ `protRepas` DOIT PASSER PAR ICI. `qualiteNutrition` le lit sur l'objet
       d'analyse, pas sur la ligne brute : sans ce champ il arrivait `undefined`,
       donc « 0 repas avec une dose utile » affiché juste sous « 1,7 g par kilo »
       — deux lignes du même écran qui se contredisaient. Trouvé à l'écran, pas
       à la lecture. */
    return { jour: e ? e.jour : jourCourant(), vide: vide, mac: mac,
             protRepas: (e && e.protRepas) || [],
             nbRepas: nbRepas, distincts: distincts, criteres: critere, note: globale };
  }

  /* ── Le corps : ce qui a été construit, ce qui a été brûlé ──
     C'est la partie que Pablo a demandée explicitement, et la plus délicate :
     elle ne se mesure pas, elle se modélise. Les deux modèles tiennent en une
     ligne chacun, et l'écran les affiche.

     GRAISSE — bilan d'énergie : (dépense − apport) / 7 700 kcal par kg.
       ⚠️ Plafonné à 250 g/jour. Un déficit de 3 000 kcal sur une journée ne
       retire pas 390 g de graisse : le corps puise aussi dans le glycogène et
       l'eau, et le déficit réel n'est jamais celui d'un seul jour. Sans ce
       plafond, une journée à jeun afficherait un chiffre spectaculaire et faux.

     MUSCLE — potentiel × protéines × énergie × séance :
       potentiel = poids × taux(activité) / 7
       protéines = min(1, apport / cible)         il en faut assez
       énergie   = (apport kcal / dépense − 0,85) / 0,15, borné à [0,1]
       séance    = 0,30 + 1,30 × stimulus         voir plus bas
       ⚠️ Le facteur énergie est ce qui empêche l'absurdité principale : on ne
       construit pas de muscle en déficit profond, quelle que soit la quantité
       de protéines. Il s'ouvre à partir de 85 % de la dépense et sature à
       100 % — ni un mur à 100 % (personne ne construit rien à 99 %), ni une
       porte ouverte à 60 %.

     LA SÉANCE, ajoutée le 2026-09-02 à la demande de Pablo (« pouvoir ajouter
     sa séance avant le bilan pour voir exactement combien de grammes de muscle
     on a gagné et combien de graisse brûlée »). Elle entre dans les DEUX
     chiffres, et pas de la même façon :
     • dans la GRAISSE, par la dépense — `dépense = tdee + kcal de la séance`,
       donc un déficit plus grand, donc plus de grammes. C'est la partie
       vraiment « au gramme près » : le déficit cesse d'ignorer une heure de
       salle ;
     • dans le MUSCLE, par le stimulus — `NattySeance.stimulus()` compte les
       séries du jour plus la moitié de celles de la veille (la synthèse
       protéique reste élevée ~48 h), rapporté à un volume plein.
     ⚠️ Le facteur séance rend le facteur ÉNERGIE plus sévère au passage, et
     c'est juste : diviser l'apport par une dépense plus haute, c'est
     reconnaître qu'une journée d'entraînement demande plus pour construire.

     ⚠️⚠️ RIEN DE TOUT ÇA NE S'APPLIQUE À QUI NE JOURNALISE PAS. Sans une seule
     séance notée sur les trois dernières semaines, `facteurSeance` vaut 1 et
     le calcul est celui d'avant, au gramme près. Sans ce garde-fou, la mise à
     jour aurait divisé par trois les estimations de tous les comptes existants
     du jour au lendemain — un changement de modèle qui ressemble à une
     régression de forme physique. */
  function corpsDuJour(a, profil, ctx) {
    var c = profil.cible, out = { gras: 0, muscle: 0, deficit: 0, surplus: 0,
                                  facteurProt: 0, facteurEnergie: 0, facteurSeance: 1,
                                  taux: 0, estimable: false,
                                  kcalSeance: 0, seriesSeance: 0, avecSeance: false };
    if (!c.c || !profil.poids || a.vide) return out;
    out.estimable = true;

    /* La dépense du jour : celle du profil, plus ce que la séance a coûté.
       `NattySeance.kcal` retire 1 MET précisément parce que `tdee` compte déjà
       le repos de ces minutes-là — sans quoi une heure de salle offrirait
       ~70 kcal qui n'ont pas été dépensées. */
    var sea = ctx && ctx.seance;
    if (sea && window.NattySeance) {
      out.kcalSeance = NattySeance.kcal(sea, profil.poids);
      out.seriesSeance = NattySeance.series(sea);
      out.avecSeance = true;
    }
    var depense = c.c + out.kcalSeance;
    out.depense = depense;

    var ecart = depense - a.mac.c;
    if (ecart > 0) { out.deficit = r0(ecart); out.gras = Math.min(250, Math.round(ecart / KCAL_PAR_KG_GRAS * 1000)); }
    else out.surplus = r0(-ecart);

    out.taux = TAUX_MUSCLE[profil.activite] || TAUX_DEFAUT;
    var potentielG = profil.poids * out.taux / 7 * 1000;      // en grammes/jour
    out.potentiel = Math.round(potentielG);

    /* ── La nutrition, en trois mesures ── */
    var nut = qualiteNutrition(a, profil, depense);
    out.nut = nut;
    out.facteurProt = nut.fProt;          // conservés : l'écran les nomme
    out.facteurEnergie = nut.fEnergie;

    /* ── L'entraînement, calculé sur les exercices SAISIS ──
       ⚠️ On passe par `qualiteEntrainement` et non par le seul `stimulus` :
       c'est là que le volume PONDÉRÉ (reps, type de mouvement) et la FRÉQUENCE
       hebdomadaire du groupe entrent. Le stimulus brut ignorait les deux. */
    if (ctx && ctx.journalise && window.NattySeance) {
      /* ⚠️ `ctx.jour`, pas `a.jour` : sur une journée sans repas, `analyserJour`
         retombe sur la date DU JOUR faute de ligne à lire. On n'arrive jamais
         ici dans ce cas (retour anticipé plus haut), mais faire dépendre le
         calcul d'un champ qui peut mentir est le genre de dette qui se paie à
         la première retouche. */
      /* ⚠️ LE POIDS EST OBLIGATOIRE ICI, et ce n'est pas un argument de
         confort : sans lui, une traction ou une pompe pèse zéro (leur charge
         est une fraction du poids de corps, pas un nombre saisi), et
         l'intensité relative n'a plus d'échelle. L'écran de la séance, lui,
         le passe — les deux annonceraient donc deux volumes différents pour la
         même séance, ce qui est exactement la divergence déjà payée entre
         `api/_nutrition.js` et `assets/core.js`. */
      var q = NattySeance.qualiteEntrainement
        ? NattySeance.qualiteEntrainement(ctx.jour, ctx.jourVeille, profil.poids)
        : { note: NattySeance.stimulus(sea, ctx.veille, profil.poids), volume: 0, frequence: 0 };
      out.entrainement = q;
      out.stimulus = q.note;
      out.facteurSeance = PLANCHER_SEANCE + (PLAFOND_SEANCE - PLANCHER_SEANCE) * q.note;
    }

    out.muscle = Math.round(potentielG * nut.note * out.facteurSeance);
    return out;
  }

  /**
   * Le contexte « séance » d'une journée : la sienne, celle de la veille, et
   * si cette personne journalise du tout.
   *
   * ⚠️ `journalise` est calculé UNE FOIS pour toute la série, pas jour par
   * jour. Sinon quelqu'un qui note trois séances par semaine verrait ses jours
   * de repos basculer sur l'ancien modèle et ses jours de salle sur le
   * nouveau : deux échelles dans le même graphique, donc une courbe qui monte
   * et descend pour une raison qui n'existe pas.
   */
  function ctxSeance(jour, journalise) {
    if (!window.NattySeance) return { journalise: false, seance: null, veille: null };
    var d = new Date(jour + 'T12:00:00');
    var hier = isNaN(d) ? null : (function () {
      var x = new Date(d); x.setDate(x.getDate() - 1); return jourDe(x);
    })();
    return { journalise: !!journalise, jour: jour, jourVeille: hier,
             seance: NattySeance.duJour(jour),
             veille: hier ? NattySeance.duJour(hier) : null };
  }

  /** Cette personne journalise-t-elle ses séances ? (une seule fois par série) */
  function journalise() {
    return !!(window.NattySeance && NattySeance.utilise && NattySeance.utilise(21));
  }

  /** La série des `nb` derniers jours, du plus ancien au plus récent. */
  function serie(nb) {
    var out = [], jrn = journalise();
    for (var i = nb - 1; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var j = jourDe(d), e = cache.jours[j];
      var a = analyserJour(e, cache.profil, j);
      var ctx = ctxSeance(j, jrn);
      out.push({ jour: j, date: d, a: a, corps: corpsDuJour(a, cache.profil, ctx),
                 seance: ctx.seance });
    }
    return out;
  }

  /** Le bilan de la SEMAINE en cours (du lundi à aujourd'hui). */
  function semaineEnCours() {
    var l = lundiDe(new Date()), out = [], jrn = journalise();
    var d = new Date(l);
    var fin = jourCourant();
    while (jourDe(d) <= fin && out.length < 7) {
      var j = jourDe(d), e = cache.jours[j];
      var a = analyserJour(e, cache.profil, j);
      var ctx = ctxSeance(j, jrn);
      out.push({ jour: j, date: new Date(d), a: a,
                 corps: corpsDuJour(a, cache.profil, ctx), seance: ctx.seance });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /** La lecture publique, sans ouvrir l'écran. */
  async function analyse(nbJours) {
    await charger();
    return { profil: cache.profil, serie: serie(nbJours || 7),
             aujourdhui: analyserJour(cache.jours[jourCourant()], cache.profil, jourCourant()) };
  }

  /* ═══ 5. Le questionnaire ════════════════════════════════
     Trois questions, pas plus. C'est le soir, la personne vient de manger, et
     un formulaire de sept écrans se referme au troisième. Chacune tient en un
     rang de choix qu'on tape une fois — jamais de champ libre obligatoire :
     taper au clavier à 21 h 30, personne ne le fait deux soirs de suite. */
  var QUESTIONS = [
    { cle: 'mange', titre: 'Vous avez réussi à bien manger ?',
      sous: 'Votre ressenti, pas les chiffres — ils viennent après.',
      choix: [
        { v: 'oui',     em: '💪', txt: 'Oui, content de moi' },
        { v: 'moyen',   em: '🤔', txt: 'Moyen, ça peut mieux' },
        { v: 'non',     em: '😕', txt: 'Non, journée ratée' }
      ] },
    { cle: 'motivation', titre: 'Et la motivation, ce soir ?',
      sous: 'Elle monte et descend, c\'est normal. La suivre sert à voir venir.',
      choix: [
        { v: 'haute',   em: '🔥', txt: 'À fond' },
        { v: 'stable',  em: '🙂', txt: 'Stable' },
        { v: 'basse',   em: '🪫', txt: 'En baisse' }
      ] },
    { cle: 'difficulte', titre: 'Qu\'est-ce qui a été le plus dur ?',
      sous: 'C\'est ce qui permettra de vous proposer autre chose.',
      choix: [
        { v: 'temps',    em: '⏳', txt: 'Le temps de cuisiner' },
        { v: 'envies',   em: '🍫', txt: 'Les envies de sucré' },
        { v: 'quantite', em: '🍽️', txt: 'Manger assez' },
        { v: 'rien',     em: '✨', txt: 'Rien, ça allait' }
      ] }
  ];

  /* Persistance : table `bilan_jour` si elle existe, sinon l'appareil — et
     l'écran le DIT plutôt que de laisser croire à une synchronisation qui n'a
     pas lieu (même parti pris qu'`assets/planning.js`). */
  var tableDispo = null;   // null = pas encore su

  async function enregistrerReponses(rep, a, corps, estSemaine) {
    var j = jourCourant();
    ecrire(cle('rep_' + j), JSON.stringify(rep));
    ecrire(cle('vu'), j);
    if (estSemaine) ecrire(cle('vusem'), jourDe(lundiDe(new Date())));
    try {
      /* ⚠️ `?on_conflict=user_id,jour` est OBLIGATOIRE avec `merge-duplicates` :
         sans lui, PostgREST résout le conflit sur la CLÉ PRIMAIRE, et un second
         bilan le même jour repartirait en 409 au lieu d'écraser. C'est le piège
         déjà payé sur `meal_likes` / `membre_amis` / `notes_nutritionniste`
         (§3 de CLAUDE.md) — d'où la clé primaire `(user_id, jour)` dans le SQL.
         Le 3ᵉ argument de `sbPost` est une CHAÎNE `Prefer`, pas un objet. */
      await Natty.sbPost('bilan_jour?on_conflict=user_id,jour', {
        user_id: uid(), jour: j, portee: estSemaine ? 'semaine' : 'jour',
        ressenti: rep.mange || null, motivation: rep.motivation || null,
        difficulte: rep.difficulte || null,
        note: a && a.note != null ? a.note : null,
        muscle_g: corps ? corps.muscle : null, gras_g: corps ? corps.gras : null,
        prot_g: a ? a.mac.p : null, cal_kcal: a ? a.mac.c : null
      }, 'resolution=merge-duplicates,return=minimal');
      tableDispo = true;
    } catch (e) { tableDispo = false; }
  }

  /** Ce qui a été répondu, sur les `nb` derniers jours (lecture locale). */
  function reponses(nb) {
    var out = [];
    for (var i = 0; i < (nb || 7); i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var v = lire(cle('rep_' + jourDe(d)), null);
      if (v) { try { out.push({ jour: jourDe(d), rep: JSON.parse(v) }); } catch (e) {} }
    }
    return out;
  }

  /* ═══ 6. Le style ════════════════════════════════════════
     ⚠️ IL SUIT LE THÈME, comme `assets/journee.js` et contrairement à
     `ajout.js` / `planning.js`. Toutes les couleurs passent par des jetons
     `--b-*` déclarés sur `.nbsk`, et le clair ne redéfinit QUE les jetons : il
     n'y a donc qu'un seul jeu de règles à tenir. Sans ça, chaque retouche se
     ferait deux fois et l'un des deux thèmes finirait par diverger sans que
     personne ne s'en aperçoive — exactement ce qui est arrivé aux ombres
     neumorphiques de `suivi.html` (§7 de CLAUDE.md). */
  var cssPose = false;
  function css() {
    if (cssPose) return;
    cssPose = true;
    var s = document.createElement('style');
    s.id = 'nbil-css';
    s.textContent = [
      '.nbsk{--b-bg:#000;--b-ink:#fff;--b-mut:#8b8b95;--b-mut2:#6e6e78;',
      '--b-lueur1:rgba(255,255,255,.26);--b-lueur2:rgba(255,255,255,.11);',
      '--b-lueur3:rgba(255,255,255,.03);--b-trait:rgba(255,255,255,.13);',
      '--b-c1:#16171c;--b-c2:#0c0d10;--b-rim:rgba(255,255,255,.55);',
      '--b-rim2:rgba(255,255,255,.07);--b-bulle:rgba(30,31,36,.94);',
      '--b-barre:#1b1c21;--b-ombre-c:0 20px 44px rgba(0,0,0,.5);',
      '--b-trait2:rgba(255,255,255,.06);--b-creux:#0a0a0c;--b-relief:#17181c;',
      '--b-vif:#fff;--b-sur-vif:#0a0a0c;--b-ombre:rgba(0,0,0,.7);',
      '--b-reflet:rgba(255,255,255,.055);--b-contour:rgba(255,255,255,.07);',
      '--b-fermer:rgba(255,255,255,.07)}',
      ':root[data-theme="light"] .nbsk{--b-bg:#fff;--b-ink:#101014;--b-mut:#8a8a95;',
      '--b-mut2:#a6a6b0;--b-lueur1:rgba(126,128,145,.15);--b-lueur2:rgba(126,128,145,.06);',
      '--b-lueur3:rgba(126,128,145,.02);--b-trait:rgba(20,20,30,.14);',
      /* ⚠️ EN CLAIR, LA CARTE NE PEUT PAS ÊTRE BLANCHE : le fond de l'écran
         l'est déjà, et elle disparaissait purement et simplement — vu à
         l'écran, un graphique flottant sans support. Elle est donc légèrement
         grise, avec une ombre douce ; et les barres, qui étaient à `#f4f5f7`
         sur du blanc, passent à un gris qu'on distingue. */
      '--b-c1:#fbfbfd;--b-c2:#f0f1f5;--b-rim:rgba(255,255,255,.95);',
      '--b-rim2:rgba(20,20,30,.08);--b-bulle:rgba(255,255,255,.96);',
      '--b-barre:#e0e2e9;--b-ombre-c:0 14px 32px rgba(20,20,30,.12);',
      '--b-trait2:rgba(20,20,30,.06);--b-creux:#eceef1;--b-relief:#f4f5f7;',
      '--b-vif:#101014;--b-sur-vif:#fff;--b-ombre:rgba(20,20,30,.16);',
      '--b-reflet:rgba(255,255,255,.9);--b-contour:rgba(20,20,30,.07);',
      '--b-fermer:rgba(20,20,30,.06)}',

      /* ── L'écran ─────────────────────────────────────────── */
      '#nbil{position:fixed;inset:0;z-index:640;opacity:0;pointer-events:none;',
      'transition:opacity .5s ease;font-family:Inter,-apple-system,sans-serif;',
      'background:var(--b-bg);color:var(--b-ink);overflow:hidden}',
      '#nbil.on{opacity:1;pointer-events:auto}',
      /* ⚠️ LE PARE-FEU. Ce module s'invite sur des pages qui ont leur propre
         feuille, et ses classes internes sont volontairement courtes (`.st`,
         `.v`, `.n`, `.bar`, `.d`…) — donc des noms que n'importe quelle page
         peut avoir déjà pris. Relevé sur les écrans porteurs aujourd'hui :
         `suivi.html` a `.em`, `repas.html` `.v` et `.em`, `social.html` `.st`,
         `.n`, `.v`. Aucun ne nous atteint, parce que TOUS sont des sélecteurs
         de descendance (`.pf-stats .st`) dont l'ancêtre n'existe pas ici.
         Mais ça ne tient que par chance : le jour où quelqu'un écrit `.st{}`
         nu, le bilan se déforme sur cette page-là, et le rapport ne dira rien.
         `#nbil *` vaut (1,0,0) et bat donc toute classe nue (0,1,0), pendant
         que les règles du module — au moins (1,1,0) — le battent lui.
         Vérifié : le module ne pose aucune balise à marge native (ni `p`, ni
         titre, ni liste), la remise à zéro ne lui coûte donc rien. */
      '#nbil *{margin:0;padding:0;border:0}',
      '#nbil button{font-family:inherit;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#nbil .fade{position:absolute;inset:0;pointer-events:none}',
      '#nbil .fade i{position:absolute;display:block;border-radius:50%;',
      'left:50%;top:-4%;width:150%;height:72%;transform:translateX(-50%);',
      'background:radial-gradient(50% 50% at 50% 50%,var(--b-lueur1) 0%,',
      'var(--b-lueur2) 34%,var(--b-lueur3) 56%,transparent 74%);',
      'animation:nbSouffle 9s ease-in-out infinite}',
      '@keyframes nbSouffle{0%,100%{opacity:.85;transform:translateX(-50%) scale(1)}',
      '50%{opacity:1;transform:translateX(-50%) scale(1.06)}}',

      /* ⚠️ `justify-content:flex-start`, JAMAIS `center`. Même faux raccord que
         dans `journee.js` : en `center`, le contenu se recentre à chaque scène,
         donc tout remonte et redescend entre deux plans puisque les scènes
         n'ont pas la même hauteur. C'est le VIDE qui descend en bas. */
      '#nbil .col{position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:flex-start;',
      'padding:calc(56px + env(safe-area-inset-top,0px)) 22px ',
      'calc(150px + env(safe-area-inset-bottom,0px));overflow-y:auto;',
      '-webkit-overflow-scrolling:touch;text-align:center}',
      /* ⚠️ `overflow-x:hidden` à cause du glissement latéral : un bloc pleine
         largeur translaté élargit le document, et la page part en défilement
         horizontal le temps de la transition. */
      '#nbil .col{overflow-x:hidden}',
      '#nbil .zone{width:100%;max-width:430px;position:relative;flex:1 1 auto;',
      'display:flex;flex-direction:column;justify-content:flex-start}',
      '#nbil .bloc{width:100%}',
      // Le bloc sortant reste où il était : épinglé en haut, il se contente de
      // partir. Sans `top:0`, son contenu saute à l'instant de la sortie.
      /* ⚠️⚠️ LE `:not(…)` EST INDISPENSABLE. `animation` est une propriété
         UNIQUE, et `#nbil .bloc.sort` (1,2,0) écrase `.nc-s-av` (0,1,0) quoi
         qu'il arrive dans l'ordre des feuilles : sans lui, le glissement
         latéral ne se serait jamais joué. Même piège que `.respire` écrasant
         `.trace` dans `assets/planning.js`. */
      '#nbil .bloc.sort{position:absolute;left:0;right:0;top:0;pointer-events:none}',
      '#nbil .bloc.sort:not(.nc-s-av):not(.nc-s-ar){',
      'animation:nbSort .34s cubic-bezier(.4,0,1,1) forwards}',
      '@keyframes nbSort{to{opacity:0;transform:translateY(-12px)}}',

      /* ── Typographie ─────────────────────────────────────── */
      '.nbsk .kick{font-size:12.5px;font-weight:600;color:var(--b-mut);letter-spacing:.2px}',
      '.nbsk h1{font-size:38px;font-weight:900;letter-spacing:-1.5px;line-height:1.05;margin:10px 0 0}',
      '.nbsk h1 span{display:inline-block;opacity:0;',
      'animation:nbGlide .68s cubic-bezier(.22,1,.36,1) forwards}',
      '.nbsk h1.p{font-size:27px;letter-spacing:-.8px}',
      '.nbsk .sous{font-size:14px;color:var(--b-mut);line-height:1.5;margin:12px auto 0;max-width:330px}',
      // Jamais de flou sur du texte : la règle vient de narration.html et vaut
      // pour toutes les cinématiques de l'app.
      /* L'illustration d'une scène. ⚠️ `color` posé ICI : le trait est en
         `currentColor`, donc c'est l'hôte qui décide — et cet écran est noir
         dans les deux thèmes (comme `ajout.js` et `planning.js`). */
      '.nbsk .nb-hero{display:flex;justify-content:center;margin:0 0 14px;color:#f4f4f7}',
      '.nbsk .nb-hero .nc-halo{color:#8b8b96}',
      '.nbsk .nb-hero .nc-illu{color:#f4f4f7}',
      '@keyframes nbGlide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
      '.nbsk [data-in]{opacity:0;animation:nbGlide .72s cubic-bezier(.22,1,.36,1) forwards}',

      /* ── Les trois anneaux du récap ───────────────────────── */
      '#nbil .anx{display:flex;justify-content:center;gap:12px;margin:26px 0 0}',
      '#nbil .anx .an{position:relative;width:106px;height:106px}',
      '#nbil .anx svg{width:100%;height:100%;transform:rotate(-90deg)}',
      '#nbil .anx circle{fill:none;stroke-width:8}',
      '#nbil .anx circle.f{stroke:var(--b-trait2)}',
      // L'arc part à zéro et se remplit : c'est la même grammaire que les
      // anneaux de Suivi depuis le 2026-08-10 — on montre ce qui a été mangé.
      '#nbil .anx circle.a{stroke-linecap:round;stroke-dasharray:0 302;',
      'transition:stroke-dasharray 1.5s cubic-bezier(.22,1,.36,1)}',
      '#nbil .anx .in{position:absolute;inset:0;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:1px}',
      '#nbil .anx .l{font-size:11px;font-weight:700;color:var(--b-mut);letter-spacing:.2px}',
      '#nbil .anx .v{font-size:21px;font-weight:800;letter-spacing:-.6px}',
      '#nbil .anx .o{font-size:10px;font-weight:600;color:var(--b-mut2)}',

      /* ── Le module des calories ────────────────────────────
         ⚠️ Il portait le noir métallisé recopié de `suivi.html`
         (`--metal-black` / `--sh-metal`). Il est passé au panneau commun le
         2026-09-04 : un module noir au milieu de panneaux gris se lisait comme
         un objet venu d'un autre écran — et sur le thème CLAIR c'était une
         dalle noire au milieu d'une page blanche. Ses couleurs de texte
         étaient d'ailleurs écrites en dur (`#fff`, `rgba(255,255,255,.45)`),
         donc illisibles dès que le fond a cessé d'être noir. */
      '#nbil .kmod{margin:20px auto 0;max-width:430px;border-radius:26px;padding:17px 20px;',
      'display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left}',
      '#nbil .kmod .t{font-size:15px;font-weight:800;color:var(--b-ink)}',
      '#nbil .kmod .s{font-size:11.5px;font-weight:600;color:var(--b-mut);margin-top:2px}',
      '#nbil .kmod .n{font-size:31px;font-weight:800;color:var(--b-ink);letter-spacing:-.03em;line-height:1;text-align:right}',
      '#nbil .kmod .u{font-size:11px;font-weight:700;color:var(--b-mut2);margin-top:3px;text-align:right}',

      /* ── Les critères ─────────────────────────────────────── */
      '#nbil .crs{margin:22px auto 0;max-width:430px;display:flex;flex-direction:column;gap:11px}',
      '#nbil .cr{display:flex;align-items:center;gap:12px;text-align:left;',
      'border-radius:19px;padding:13px 15px}',
      '#nbil .cr .e{width:34px;height:34px;border-radius:11px;background:var(--b-relief);',
      'display:flex;align-items:center;justify-content:center;font-size:16px;flex:none;',
      'box-shadow:inset 0 1px 0 var(--b-reflet)}',
      '#nbil .cr .b{flex:1;min-width:0}',
      '#nbil .cr .n{font-size:13.5px;font-weight:700}',
      '#nbil .cr .d{font-size:11.5px;color:var(--b-mut);margin-top:1px}',
      '#nbil .cr .j{height:6px;border-radius:4px;background:var(--b-creux);margin-top:6px;overflow:hidden}',
      '#nbil .cr .j i{display:block;height:100%;width:0;border-radius:4px;',
      'transition:width 1.1s cubic-bezier(.22,1,.36,1)}',
      '#nbil .cr .p{font-size:15px;font-weight:800;flex:none;width:44px;text-align:right}',

      /* ── La décomposition du muscle ───────────────────────
         Trois ou quatre lignes empilées : le facteur, sa jauge, et la MESURE
         d'où il sort. C'est ce qui distingue un chiffre personnalisé d'un
         chiffre qui en a l'air. */
      '#nbil .dcp{margin:20px auto 0;max-width:430px;display:flex;flex-direction:column;',
      'gap:13px;text-align:left}',
      '#nbil .dc{width:100%;border-radius:19px;padding:13px 15px}',
      '#nbil .dt{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
      '#nbil .dt span{font-size:13px;font-weight:700}',
      '#nbil .dt b{font-size:14px;font-weight:800;flex:none}',
      '#nbil .db{height:6px;border-radius:4px;background:var(--b-creux);margin-top:5px;',
      'overflow:hidden}',
      '#nbil .db i{display:block;height:100%;border-radius:4px;',
      'transition:width 1.1s cubic-bezier(.22,1,.36,1)}',
      '#nbil .dd{font-size:11px;color:var(--b-mut);margin-top:4px;line-height:1.45}',

      /* ── Le corps : muscle et graisse ─────────────────────── */
      '#nbil .cps{display:flex;gap:12px;margin:24px auto 0;max-width:430px}',
      '#nbil .cp{flex:1;border-radius:22px;padding:18px 14px}',
      '#nbil .cp .e{font-size:24px}',
      '#nbil .cp .v{font-size:30px;font-weight:900;letter-spacing:-1.2px;margin-top:4px}',
      '#nbil .cp .v small{font-size:14px;font-weight:700;letter-spacing:0}',
      '#nbil .cp .l{font-size:11.5px;font-weight:700;color:var(--b-mut);margin-top:2px}',
      // La mention « estimation » n'est pas une précaution juridique, c'est le
      // seul moyen honnête d'afficher un chiffre que personne n'a mesuré.
      '#nbil .note-est{font-size:11px;color:var(--b-mut2);margin:14px auto 0;max-width:340px;line-height:1.5}',

      /* ── Le questionnaire ─────────────────────────────────── */
      '#nbil .chx{display:flex;flex-direction:column;gap:10px;margin:24px auto 0;max-width:400px}',
      '#nbil .chx button{display:flex;align-items:center;gap:13px;text-align:left;',
      'color:var(--b-ink);border-radius:19px;padding:15px 17px;',
      'font-size:15px;font-weight:700;transition:transform .18s ease}',
      '#nbil .chx button .em{font-size:20px;flex:none}',
      '#nbil .chx button:active{transform:scale(.975)}',
      '#nbil .chx button.pris{background:var(--b-vif);color:var(--b-sur-vif)}',
      '#nbil .pts{display:flex;justify-content:center;gap:6px;margin:18px 0 0}',
      '#nbil .pts i{width:22px;height:3px;border-radius:2px;background:var(--b-trait)}',
      '#nbil .pts i.on{background:var(--b-ink)}',

      /* ── LA JAUGE DE LA NOTE ──────────────────────────────────
         Demande de Pablo (2026-09-04) : « une barre de progression unique
         avec le faded blur et l'inner bright, qui se déroule progressivement
         vers le haut, de rouge vers le vert (couleur de la barre qui change
         smooth et le % en même temps) ».

         ⚠️ LA COULEUR EST POSÉE EN JS, IMAGE PAR IMAGE, et pas par un dégradé.
         Un dégradé rouge→vert peint la barre ENTIÈRE aux trois couleurs : à
         30 %, on verrait déjà du vert en bas. Ce que la demande décrit est
         l'inverse — la barre est d'UNE couleur, et cette couleur vire pendant
         qu'elle monte. Il faut donc interpoler à chaque image.
         ⚠️ La lueur est un élément à part, HORS du rail : dans le rail elle
         serait rognée par l'`overflow:hidden` qui arrondit le remplissage, et
         un flou rogné net à son bord n'est plus un flou. */
      '#nbil .jv{position:relative;width:70px;height:168px;flex:none}',
      '#nbil .jv .rail{position:absolute;inset:0;border-radius:22px;background:var(--b-creux);',
      'overflow:hidden;box-shadow:inset 0 2px 7px rgba(0,0,0,.45),inset 0 -1px 0 rgba(255,255,255,.06)}',
      '#nbil .jv .flou{position:absolute;left:9px;right:9px;bottom:2px;height:0;border-radius:20px;',
      'filter:blur(13px);opacity:.7;pointer-events:none}',
      // « inner bright » : le liseré du haut et le halo interne. Sans eux, le
      // remplissage est un aplat de couleur, pas un volume.
      '#nbil .jv .fill{position:absolute;left:0;right:0;bottom:0;height:0;border-radius:22px;',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.6),inset 0 0 20px rgba(255,255,255,.22),',
      'inset 0 -10px 22px rgba(0,0,0,.16)}',
      '#nbil .jn{text-align:left;min-width:0}',
      '#nbil .jn .v{font-size:52px;font-weight:800;letter-spacing:-2.5px;line-height:1}',
      '#nbil .jn .v small{font-size:19px;font-weight:700;letter-spacing:-.5px;opacity:.55}',
      '#nbil .jn .l{font-size:12.5px;font-weight:700;color:var(--b-mut);margin-top:5px}',
      '#nbil .jw{display:flex;align-items:center;justify-content:center;gap:20px;margin:6px 0 2px}',

      /* ── LES DEUX TEMPS DE LA NOTE ─────────────────────────────
         Demande de Pablo (2026-09-04) : « seulement d'abord la barre de
         progression en héros avec son animation et le pourcentage, sans rien
         d'autre ; après elle se déplace pour laisser apparaître les autres
         stats ». La note est le RÉSULTAT de la journée : la poser au milieu
         d'un écran vide le temps qu'elle monte, c'est lui laisser le temps
         d'être lue. Les critères qui l'expliquent répondent à une question
         qu'on ne se pose qu'une fois le chiffre vu.

         ⚠️ UN SEUL BLOC, PAS DEUX SCÈNES. `bloc()` fait GLISSER le plan
         sortant : la jauge partirait par la gauche et reviendrait par la
         droite — elle serait REMPLACÉE, pas déplacée. Ici c'est le même
         élément qui se réduit et remonte, et c'est ce mouvement continu qui
         relie les deux temps.
         ⚠️ Le passage est piloté par un `setTimeout`, jamais par
         `transitionend` : sur une page qui ne peint pas, aucune transition ne
         se joue et l'événement n'arrive JAMAIS — l'écran resterait sur sa
         jauge, sans ses critères, et rien ne le dirait (règle 43). */
      /* ⚠️⚠️ L'AGRANDISSEMENT EST SUR `.jhero`, JAMAIS SUR `.jw` — et c'est un
         défaut trouvé au banc. `.jw` porte `data-in`, et le filet de `cine.js`
         écrit `.nc-pret [data-in]{transform:none!important}` : posé à 1,1 s, il
         ANNULAIT le `scale(1.16)` une demi-seconde avant la révélation. La
         jauge se réduisait donc en deux temps — un saut d'échelle à 1,1 s,
         puis le glissement à 2,1 s — au lieu d'un seul mouvement. Le conteneur,
         lui, ne porte aucune animation d'entrée : rien ne vient le contredire.
         Même famille que `.respire` écrasant `.trace` dans `planning.js` : une
         animation à `forwards` l'emporte sur la déclaration qu'elle recouvre. */
      '#nbil .jhero{display:flex;align-items:center;justify-content:center;width:100%;',
      'min-height:0;transform-origin:center;',
      'transition:min-height .82s cubic-bezier(.22,1,.36,1),',
      'transform .82s cubic-bezier(.22,1,.36,1)}',
      '#nbil .jhero.solo{min-height:min(50vh,400px);transform:scale(1.16)}',
      '#nbil .apres{width:100%}',

      /* ── LA CARTE, ET SON ARÊTE LUMINEUSE ─────────────────────
         Reprise de la référence envoyée par Pablo (2026-09-04) : un panneau
         sombre posé sur un fond presque noir, dont le bord haut-droit capte
         une lumière — comme un objet en verre éclairé de trois quarts.

         ⚠️ L'ARÊTE EST UN DÉGRADÉ MASQUÉ, PAS UNE BORDURE. Une bordure d'un
         pixel a la même couleur sur ses quatre côtés : elle entoure la carte
         au lieu de l'éclairer, et l'effet tombe à plat. Ici le pseudo-élément
         porte un dégradé orienté, et le masque n'en garde que l'épaisseur du
         contour — donc la lumière court sur deux côtés et s'éteint sur les
         deux autres.
         ⚠️ `#nbil *{border:0}` (le pare-feu) ne l'atteint pas : `*` ne
         sélectionne pas les pseudo-éléments. C'est aussi pourquoi l'arête ne
         peut PAS être faite avec `border`. */
      '#nbil .carte{border-radius:26px;padding:16px 14px 14px}',

      /* ══ LE PANNEAU, ET SON ARÊTE : la DA de TOUTE la séquence ══
         Demande de Pablo (2026-09-04) : « tout le bilan doit avoir exactement
         la DA de cette page de progression ». Un seul groupe de sélecteurs,
         donc : les critères, la décomposition, les deux chiffres du corps, le
         module des calories et les boutons du questionnaire portent le MÊME
         panneau que les graphiques et les tuiles. Écrire six fois la même
         recette, c'est six recettes qui divergent à la première retouche
         (règle 44).
         ⚠️ `#nbil` DANS LE SÉLECTEUR, sinon la règle ne s'applique jamais :
         `#nbil .carte::before` vaut (1,1,1) et une règle sans identifiant, si
         tardive soit-elle, perd. Le genre de correctif qui a l'air posé et
         qui ne fait rien.
         ⚠️ `#nbil *{border:0}` (le pare-feu) n'atteint pas les pseudo-éléments.
         C'est aussi pourquoi l'arête ne peut PAS être faite avec `border`. */
      '#nbil .carte,#nbil .st,#nbil .cr,#nbil .dc,#nbil .cp,#nbil .kmod,',
      '#nbil .chx button{position:relative;',
      'background:linear-gradient(157deg,var(--b-c1) 0%,var(--b-c2) 66%);',
      'box-shadow:var(--b-ombre-c)}',
      '#nbil .carte::before,#nbil .st::before,#nbil .cr::before,#nbil .dc::before,',
      '#nbil .cp::before,#nbil .kmod::before,#nbil .chx button::before{',
      'content:"";position:absolute;inset:0;border-radius:inherit;',
      'padding:1px;pointer-events:none;',
      'background:linear-gradient(203deg,var(--b-rim) 0%,var(--b-rim2) 26%,transparent 52%);',
      '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);',
      '-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);',
      'mask-composite:exclude}',
      ':root[data-theme="light"] #nbil .carte::before,',
      ':root[data-theme="light"] #nbil .st::before,',
      ':root[data-theme="light"] #nbil .cr::before,',
      ':root[data-theme="light"] #nbil .dc::before,',
      ':root[data-theme="light"] #nbil .cp::before,',
      ':root[data-theme="light"] #nbil .kmod::before,',
      ':root[data-theme="light"] #nbil .chx button::before{background:var(--b-rim2)}',
      // Un bouton retenu passe en plein : l'arête d'un panneau sombre n'a plus
      // rien à éclairer sur un aplat clair, elle y dessine un liseré sale.
      '#nbil .chx button.pris::before{opacity:0}',
      // Le halo qui déborde du coin éclairé — c'est lui qui fait « poser » la
      // carte sur le fond au lieu de l'y coller.
      '#nbil .carte::after{content:"";position:absolute;top:-18%;right:-10%;width:52%;height:64%;',
      'border-radius:50%;pointer-events:none;z-index:-1;',
      'background:radial-gradient(50% 50% at 50% 50%,var(--b-lueur2) 0%,transparent 70%)}',

      /* La bulle de valeur : le nombre en gros, la date en dessous, en sourdine.
         Même objet sur les deux graphiques — deux styles pour la même chose
         finiraient par ne plus dire la même chose. */
      '#nbil .bul{position:absolute;z-index:4;padding:7px 10px;border-radius:12px;',
      // L'ombre suit le thème : une ombre noire dense sous une bulle blanche,
      // sur un fond blanc, ne sépare rien du tout.
      'background:var(--b-bulle);box-shadow:var(--b-ombre-c),inset 0 0 0 1px var(--b-trait);',
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);',
      'white-space:nowrap;opacity:0;transform:translateY(5px);pointer-events:none}',
      '#nbil .bul.on{opacity:1;transform:none;transition:opacity .4s ease,transform .4s ease}',
      '#nbil .bul .bv{font-size:13px;font-weight:800;letter-spacing:-.2px;color:var(--b-ink)}',
      '#nbil .bul .bd{font-size:10px;font-weight:600;color:var(--b-mut);margin-top:1px}',
      '#nbil .bul .br{display:flex;gap:14px;justify-content:space-between;',
      'font-size:11.5px;font-weight:700;margin-top:3px}',
      '#nbil .bul .br i{font-style:normal;color:var(--b-mut)}',
      // Le point posé sur la courbe, à l'aplomb de la bulle.
      '#nbil .pin{position:absolute;width:9px;height:9px;border-radius:50%;background:var(--b-ink);',
      'box-shadow:0 0 0 3px var(--b-c2),0 0 14px rgba(255,255,255,.5);',
      'transform:translate(-50%,-50%);opacity:0;transition:opacity .4s ease;z-index:3}',
      '#nbil .pin.on{opacity:1}',

      /* ── La courbe de progression ─────────────────────────── */
      '#nbil .grf{margin:22px auto 0;max-width:430px;position:relative}',
      '#nbil .grf svg{width:100%;height:170px;overflow:visible}',
      '#nbil .grf .axe{stroke:var(--b-trait2);stroke-width:1}',
      '#nbil .grf .cible{stroke:var(--b-trait);stroke-width:1;stroke-dasharray:3 4}',
      // Le tracé se dessine : une courbe qui apparaît d'un coup ne raconte pas
      // une progression, elle l'affiche.
      '#nbil .grf .ligne{fill:none;stroke:var(--b-ink);stroke-width:2.5;',
      'stroke-linecap:round;stroke-linejoin:round}',
      /* ⚠️ LA LUEUR EST UN SECOND TRACÉ, PAS UNE OMBRE. `filter:drop-shadow`
         sur le trait aurait flouté aussi ses extrémités et coûté un repaint de
         tout le SVG à chaque image de l'animation ; un doublon flouté sous le
         trait net donne le « faded blur » demandé sans toucher au trait qui
         porte l'information. Il se trace EN MÊME TEMPS que lui (même durée,
         même courbe d'accélération) — décalé, on verrait la lueur courir
         derrière la ligne comme une traîne. */
      '#nbil .grf .lueur{fill:none;stroke:var(--b-ink);stroke-width:6;',
      'stroke-linecap:round;stroke-linejoin:round;opacity:.26;filter:blur(5px)}',
      /* Le PONT : les segments qui traversent un jour sans donnée. La courbe
         est continue (c'est la demande), mais ces portions-là sont un calcul,
         pas une mesure — d'où le pointillé, le trait plus fin et la couleur
         adoucie. Un lecteur doit pouvoir distinguer les deux sans lire la
         légende ; c'est la seule façon de « lier » les trous sans affirmer
         qu'on a mesuré ce qui s'y est passé.
         ⚠️ `stroke-dasharray` porte ICI le motif du pointillé, et
         `animerCourbe()` ne doit surtout pas l'écraser pour animer le tracé —
         il en ferait une ligne continue, donc un mensonge. */
      '#nbil .grf .pont{fill:none;stroke:var(--b-ink);stroke-width:1.6;',
      'stroke-dasharray:2.5 4;stroke-linecap:round;opacity:0;',
      'animation:nbFonduPont .9s ease 1.15s forwards}',
      '@keyframes nbFonduPont{to{opacity:.42}}',
      /* ⚠️⚠️ LE GRAPHIQUE SE DÉVOILE PAR UN VOLET, PAS PAR UN `stroke-dasharray`,
         ET C'EST UNE CORRECTION DE FOND. Demande de Pablo (2026-09-04) : « le
         graphique doit apparaître de droite à gauche, comme s'il se dessinait
         doucement ».

         Le tracé par `stroke-dashoffset` NE DESSINAIT RIEN — il ne pouvait
         pas. `d` n'est pas une polyligne continue : c'est une SUITE DE
         SEGMENTS `M…L…` indépendants (un par jour), parce qu'un segment qui
         traverse un jour non noté part dans le chemin du pont. Or SVG
         **réarme le motif de tirets au début de chaque sous-chemin** : les 26
         segments grandissaient donc TOUS EN MÊME TEMPS, chacun depuis son
         propre bord gauche. À l'écran, ça ne ressemble pas à une courbe qui se
         dessine, ça ressemble à une courbe qui grésille. Mesuré au banc : avec
         un offset intermédiaire, absolument rien n'est peint — chaque segment
         (~13 px) tombe entier dans l'intervalle du motif.

         Un volet règle les deux d'un coup : il dévoile la ligne, le pont ET les
         points ensemble, dans l'ordre du temps, quel que soit le nombre de
         sous-chemins. Et sur une courbe (un seul y par x) un volet vertical
         EST un tracé : le trait apparaît par son extrémité, exactement comme
         s'il se dessinait. */
      /* ⚠️ LE VOLET EST UN `clip-path:inset()` SUR UN DIV, PAS UN `<clipPath>`
         SVG. Essayé d'abord en SVG (un `<rect>` translaté dans un `<clipPath>`
         appliqué à un `<g>`) : mesuré au banc, la translation est bien
         calculée — `matrix(1,0,0,1,270,0)` — et le découpage n'en tient
         AUCUN compte, le graphique reste entièrement caché quelle que soit la
         valeur. Un découpage qui ignore sa géométrie ne se voit pas dans le
         code, seulement à l'écran.
         `inset(0 0 0 X%)` sur l'élément HTML qui porte le SVG fait la même
         chose, se laisse animer, et n'a pas besoin d'identifiant unique — donc
         plus de risque que deux plans qui se croisent se volent leur volet.
         ⚠️ ET IL LUI FAUT SON PROPRE ÉLÉMENT : `.grf` porte déjà `data-in`, et
         `animation` est une propriété UNIQUE — la seconde déclaration
         effacerait l'entrée du bloc. */
      '#nbil .grf .vol{animation:nbVolet 2.2s cubic-bezier(.32,.72,.3,1) forwards}',
      '@keyframes nbVolet{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 0)}}',
      '#nbil .grf .pt{fill:var(--b-ink)}',
      // (Il n'y a plus d'aire remplie sous la courbe — voir `courbeHTML()`.)
      '#nbil .grf .lbl{font-size:9px;font-weight:600;fill:var(--b-mut2)}',
      /* ⚠️ `flex-wrap`, ET C'EST LA RÈGLE 39 DE CLAUDE.md. La légende portait
         deux entrées, elle en porte trois depuis que les trous sont reliés
         (« ┈ 6 jours sans donnée, reliés ») : sans le retour à la ligne, la
         rangée déborde de la colonne à 375 px et la page part en défilement
         HORIZONTAL — un défaut qui ne se lit pas dans le code, seulement en
         mesurant. Même correctif que `.hero-foot` de repas.html. */
      '#nbil .lgd{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;',
      'margin:10px 0 0;font-size:11px;color:var(--b-mut);line-height:1.5}',

      /* ── Les jours de la semaine, en barres ───────────────── */
      /* ⚠️ `height:auto` sur la piste, et `flex-shrink:0` sur la barre — les
         deux, sinon la comparaison entre jours ne veut plus rien dire. La
         piste faisait 132 px de haut et la barre, simple élément flex, se
         faisait COMPRIMER pour que l'étiquette du haut et la lettre du bas
         tiennent avec elle : mesuré, des hauteurs calculées à 115, 116, 117 et
         118 px se peignaient toutes à 96. Autrement dit un graphique où les
         six jours sortaient rigoureusement identiques — la seule chose que cet
         écran sert à montrer. Même famille que le cadre photo d'`ajout.js`
         (§3) : une hauteur demandée ne survit pas à une compression flex. */
      '#nbil .sem{display:flex;align-items:flex-end;justify-content:center;gap:7px;',
      'flex:1;min-width:0;min-height:158px}',
      '#nbil .sem .d{flex:1;display:flex;flex-direction:column;align-items:center;',
      'justify-content:flex-end;gap:6px}',
      /* ⚠️ LES BARRES SONT SOMBRES, ET LA JOURNÉE MISE EN AVANT EST LA SEULE
         COLORÉE. Reprise de la référence de Pablo (2026-09-04). Avant, les
         sept barres étaient blanches : la semaine se lisait comme un bloc, et
         rien ne désignait le jour dont parle le texte juste en dessous.
         La barre accentuée porte un dégradé qui va de la couleur de sa note
         (en haut) vers le blanc (en bas) — l'accent là où l'œil arrive, et une
         base claire qui l'ancre. */
      '#nbil .sem .bar{width:100%;max-width:34px;flex:0 0 auto;border-radius:11px;',
      'background:var(--b-barre);box-shadow:inset 0 1px 0 var(--b-trait2);',
      'height:0;transition:height 1.1s cubic-bezier(.22,1,.36,1);min-height:3px}',
      /* ⚠️ LE DÉGRADÉ EST POSÉ EN JS, PAS EN CSS. La version d'origine passait
         par `color-mix()`, que Safari ne connaît qu'à partir de la 16.2 — or
         l'app cible iOS 15. Une fonction de couleur inconnue rend la
         déclaration entière invalide : la barre serait retombée au gris des
         autres, SANS RIEN SIGNALER, et la mise en avant aurait simplement
         disparu sur les vieux téléphones. Les trois arrêts sont donc calculés
         depuis la couleur de la note (voir `peindreBarres`). */
      '#nbil .sem .d.top .bar{box-shadow:0 0 26px -6px var(--b-acc)}',
      /* La poignée : le disque blanc au sommet de la barre choisie. C'est elle
         qui dit « c'est celle-là », avant même qu'on lise la bulle. */
      '#nbil .sem .d.top .bar{position:relative}',
      /* ⚠️ Le jour mis en avant PERD son étiquette de valeur : la poignée se
         pose exactement dessus, et la bulle donne déjà le chiffre — en
         plus gros et avec son écart. Deux fois la même valeur, dont une
         à moitié cachée par un disque blanc. */
      '#nbil .sem .d.top .n{visibility:hidden}',
      '#nbil .sem .d.top .bar::after{content:"";position:absolute;top:-9px;left:50%;',
      'width:18px;height:18px;margin-left:-9px;border-radius:50%;background:#fff;',
      'box-shadow:0 3px 10px rgba(0,0,0,.45)}',
      // L'échelle, à gauche : sans elle, sept hauteurs ne se rapportent à rien.
      '#nbil .semw{display:flex;align-items:stretch;gap:10px;margin:22px auto 0;max-width:430px}',
      '#nbil .semy{display:flex;flex-direction:column;justify-content:space-between;',
      'flex:none;padding-bottom:22px;text-align:right}',
      '#nbil .semy span{font-size:9.5px;font-weight:700;color:var(--b-mut2);line-height:1}',
      /* ⚠️ UN JOUR NON NOTÉ N'EST PLUS UNE BARRE ÉCRASÉE DE 3 PX (2026-09-02,
         même demande que la courbe : « il faut absolument que ce soit plein
         même quand on n'entre pas de données »). Il portait `min-height:3px`,
         donc un trait au ras du sol : dans une semaine à trois jours notés, le
         graphique se lisait comme quatre journées de jeûne.
         Il reçoit maintenant la hauteur INTERPOLÉE entre ses voisins notés,
         mais dessinée en creux et en hachures — vide à l'intérieur, contour
         discontinu. La semaine se lit d'un bout à l'autre, et ce qui n'a pas
         été mesuré ne ressemble en rien à ce qui l'a été. */
      '#nbil .sem .d.vide .bar{background:none;',
      'box-shadow:inset 0 0 0 1.4px var(--b-trait);',
      'background-image:repeating-linear-gradient(135deg,var(--b-trait2) 0 3px,',
      'transparent 3px 7px)}',
      /* Le trait de dépense : pointillé, DERRIÈRE les barres (z-index 0 contre
         le contexte d'empilement des `.d`), pour qu'une journée qui le dépasse
         se lise comme telle plutôt que de le recouvrir. */
      '#nbil .sem{position:relative}',
      '#nbil .sem .dep{position:absolute;left:0;right:0;height:1px;z-index:0;',
      'opacity:0;transition:opacity .6s ease .5s}',
      '#nbil .sem .dep.on{opacity:1}',
      '#nbil .sem .dep span{display:block;height:1px;',
      'background:repeating-linear-gradient(90deg,var(--b-trait) 0 6px,transparent 6px 12px)}',
      '#nbil .sem .d{position:relative;z-index:1}',
      '#nbil .sem .j{font-size:11px;font-weight:700;color:var(--b-mut)}',
      '#nbil .sem .n{font-size:10px;font-weight:700;color:var(--b-mut2)}',

      /* ── Les chiffres marquants de la semaine ─────────────── */
      // Mêmes carte et arête que les graphiques : c'est ce qui fait que
      // l'écran se lit comme un seul objet et non comme trois styles empilés.
      '#nbil .stats{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin:22px auto 0;max-width:430px}',
      '#nbil .st{border-radius:19px;padding:15px;text-align:left}',
      '#nbil .st .v{font-size:23px;font-weight:900;letter-spacing:-.9px}',
      '#nbil .st .l{font-size:11px;font-weight:700;color:var(--b-mut);margin-top:2px;line-height:1.35}',

      /* ── La barre d'action ────────────────────────────────── */
      // Fixe, hors du bloc animé. Un bouton posé DANS la scène part avec son
      // animation de sortie et disparaît sous le doigt (leçon narration.html).
      '#nbCta{position:absolute;left:0;right:0;bottom:0;z-index:6;',
      'min-height:calc(150px + env(safe-area-inset-bottom,0px));',
      'padding:14px 22px calc(20px + env(safe-area-inset-bottom,0px));display:flex;',
      'flex-direction:column;justify-content:flex-end;gap:9px;pointer-events:none;',
      'background:linear-gradient(to top,var(--b-bg) 60%,transparent)}',
      '#nbCta > *{pointer-events:auto;max-width:436px;width:100%;margin:0 auto;',
      'animation:nbGlide .42s cubic-bezier(.22,1,.36,1) .26s backwards}',
      '#nbil .b1{background:var(--b-vif);color:var(--b-sur-vif);border-radius:22px;padding:18px;',
      'font-size:16.5px;font-weight:800;letter-spacing:-.2px;box-shadow:0 10px 30px var(--b-ombre)}',
      '#nbil .b2{background:var(--b-relief);color:var(--b-ink);border-radius:22px;padding:15px;',
      'font-size:14.5px;font-weight:700;box-shadow:inset 0 1px 0 var(--b-reflet),0 8px 22px var(--b-ombre)}',
      '#nbil .b3{background:none;color:var(--b-mut);padding:12px;font-size:14px;font-weight:600}',

      // Une cinématique qui s'invite doit pouvoir se refuser d'un geste.
      '#nbFerme{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:16px;',
      'z-index:8;width:34px;height:34px;border-radius:50%;background:var(--b-fermer);',
      'color:var(--b-mut);font-size:17px;line-height:1;display:flex;align-items:center;',
      'justify-content:center;padding-bottom:2px}',
      '#nbEnTete{position:absolute;top:calc(16px + env(safe-area-inset-top,0px));left:0;right:0;',
      'z-index:7;text-align:center;font-size:12px;font-weight:700;color:var(--b-mut);',
      'letter-spacing:.3px;pointer-events:none}',

      '@media (max-height:700px){#nbil .anx .an{width:92px;height:92px}',
      '#nbil h1{font-size:32px}#nbil .col{padding-top:calc(48px + env(safe-area-inset-top,0px))}}',
      '@media (max-width:360px){#nbil .anx{gap:7px}#nbil .anx .an{width:96px;height:96px}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══ 7. Le moteur de scènes ═════════════════════════════
     Volontairement le même que celui d'`assets/journee.js` : un bloc qui sort,
     un bloc qui entre, la barre d'action réécrite, et la réserve du bas
     MESURÉE et jamais réduite. Réinventer un second moteur, c'est se garantir
     deux comportements d'animation différents dans la même app. */

  var racine = null, cta = null, blocEnCours = null, minuteur = null;
  /* Le minuteur du SECOND temps de l'écran de note — distinct de
     `minuteur`, qui appartient aux scènes à enchaînement automatique. Les
     confondre, c'est une révélation annulée par une scène qui s'enchaîne. */
  var minuteurNote = null;
  var ouvert = false, scrollGele = '';
  var S = null;   // l'état de la séquence en cours

  function monter() {
    css();
    if (racine) return racine;
    racine = document.createElement('div');
    racine.id = 'nbil';
    racine.className = 'nbsk';
    racine.innerHTML =
      '<div class="fade"><i></i></div>'
      + '<div id="nbEnTete"></div>'
      + '<button id="nbFerme" type="button" aria-label="Fermer">✕</button>'
      + '<div class="col" id="nbCol"><div class="zone" id="nbZone"></div></div>'
      + '<div id="nbCta"></div>';
    document.body.appendChild(racine);
    cta = racine.querySelector('#nbCta');
    racine.querySelector('#nbFerme').addEventListener('click', function () {
      // Fermer vaut « pas ce soir » : on note la visite pour ne pas rouvrir en
      // boucle, mais on n'enregistre aucune réponse qu'on n'a pas eue.
      ecrire(cle('vu'), jourCourant());
      fermer();
    });
    scrollGele = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    /* ⚠️ La rAF SEULE ne suffit pas : elle ne se déclenche pas si la page ne
       peint pas (onglet caché, app en arrière-plan), et un calque opaque resté
       à `opacity:0` intercepterait quand même les taps. Même précaution que
       `Natty.confirmer` et `assets/generation.js`. */
    requestAnimationFrame(function () { if (racine) racine.classList.add('on'); });
    setTimeout(function () { if (racine) racine.classList.add('on'); }, 60);
    ouvert = true;
    return racine;
  }

  function fermer() {
    ouvert = false;
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    if (minuteurNote) { clearTimeout(minuteurNote); minuteurNote = null; }
    if (!racine) return;
    var r = racine;
    racine = null; cta = null; blocEnCours = null; S = null;
    r.classList.remove('on');
    document.body.style.overflow = scrollGele || '';
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 520);
  }

  /** Un titre qui s'écrit mot à mot — c'est ce qui en fait une cinématique. */
  /* ── La couche cinématique ────────────────────────────────
     `assets/cine.js` est FACULTATIF : sans lui, `ill()` rend une chaîne vide et
     l'écran redevient exactement celui d'avant. Il porte les illustrations, les
     entrées échelonnées et surtout LE FILET — celui qui force l'état final
     quand la page ne peint pas, donc quand rien ne s'anime. */
  function ill(nom, taille) {
    return window.NattyCine
      ? '<div class="nb-hero" data-in>'
        + NattyCine.illu(nom, { taille: taille || 78, halo: true }) + '</div>'
      : '';
  }

  function titre(txt, cls, delai) {
    delai = delai == null ? 0 : delai;
    var mots = String(txt).split(' ').map(function (m, i) {
      return '<span style="animation-delay:' + (delai + i * 0.08).toFixed(3) + 's">'
        + esc(m) + '</span>';
    }).join(' ');
    return '<h1' + (cls ? ' class="' + cls + '"' : '') + '>' + mots + '</h1>';
  }

  function bloc(o) {
    if (!racine) return null;
    var zone = racine.querySelector('#nbZone');
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    /* ⚠️ La révélation en attente est annulée ICI. Sans ça, quitter l'écran de
       la note avant ses 2,1 s faisait paraître les critères par-dessus la
       scène suivante — le contrôle `blocEnCours !== d` les rattrape, mais
       autant ne pas armer un minuteur dont on sait déjà qu'il ne sert plus. */
    if (minuteurNote) { clearTimeout(minuteurNote); minuteurNote = null; }

    /* Le glissement latéral. Le bilan est une séquence qui ne revient jamais
       en arrière : le sens est donc toujours « on avance », et il n'y a rien à
       porter. Sans `assets/cine.js`, on retombe sur le fondu vertical. */
    var pas = window.NattyCine ? NattyCine.passage(1) : null;

    var vieux = blocEnCours;
    if (vieux) {
      vieux.classList.add('sort');
      if (pas) vieux.classList.add(pas.sortie);
      setTimeout(function () { if (vieux.parentNode) vieux.parentNode.removeChild(vieux); }, 380);
    }

    var d = document.createElement('div');
    d.className = 'bloc' + (pas ? ' ' + pas.entree : '');
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

    /* ⚠️ LA RÉSERVE DU BAS NE REDESCEND JAMAIS. Mesurée, parce qu'une barre à
       deux boutons ne fait pas la même hauteur qu'à un seul ; et jamais réduite,
       parce que la réécrire à chaque scène la faisait remonter puis redescendre
       — ce qui déplace toute la composition entre deux plans.

       ⚠️ ON RÉSERVE LA BARRE ENTIÈRE, plus seulement depuis son premier bouton.
       L'ancien calcul retirait `b1.offsetTop` au motif que le tiers haut de la
       barre est un dégradé transparent — vrai, mais un texte posé dans cette
       zone est ATTÉNUÉ, pas lisible. Mesuré sur l'écran du corps depuis qu'il
       porte la décomposition : défilé à fond, la mention « Estimations, pas des
       mesures » finissait 34 px sous le haut de la barre, à demi effacée. C'est
       précisément la ligne qui ne doit jamais être à moitié lisible — elle est
       ce qui empêche de prendre ces grammes pour une balance.

       ⚠️ `offsetHeight` inclut déjà le retrait de zone sûre de la barre : le
       recalculer ici le compterait deux fois.

       ⚠️ Et le `setTimeout` double la rAF — une page qui ne peint pas n'en
       reçoit aucune, et la réserve ne serait alors jamais posée (règle 43). */
    var col = racine.querySelector('#nbCol');
    var reserver = function () {
      if (!col || !cta || !cta.firstElementChild) return;
      var voulu = cta.offsetHeight + 14;
      var actuel = parseFloat(getComputedStyle(col).paddingBottom) || 0;
      if (voulu > actuel) col.style.paddingBottom = Math.round(voulu) + 'px';
    };
    requestAnimationFrame(reserver);
    setTimeout(reserver, 80);

    if (o.pret) o.pret(d);
    /* ⚠️ LE FILET, À CHAQUE PLAN. Chaque scène repeint des éléments qui
       repartent d'`opacity:0` (`[data-in]`, `[data-c]`) : une page en veille
       les y laisserait. C'est la généralisation du `setTimeout` qui sauvait
       déjà `compter()` — et il n'y a aucune raison qu'il ne couvre que les
       chiffres. */
    if (window.NattyCine) NattyCine.animer(d, 1100);
    if (o.auto) minuteur = setTimeout(function () { minuteur = null; if (o.apres) o.apres(); }, o.auto);
    return d;
  }

  function enTete(t) {
    var e = racine && racine.querySelector('#nbEnTete');
    if (e) e.textContent = t || '';
  }

  /* ═══ 8. Les morceaux d'écran ════════════════════════════ */

  var CIRC = 2 * Math.PI * 48;   // r=48 dans une boîte de 106
  var COUL = { p: '#ff6b5c', l: '#5ad07a', g: '#f0b429' };

  function anneauxHTML(mac, cible) {
    var defs = [
      { k: 'p', l: 'Protéines', v: mac.p, o: cible.p },
      { k: 'l', l: 'Lipides',   v: mac.l, o: cible.l },
      { k: 'g', l: 'Glucides',  v: mac.g, o: cible.g }
    ];
    return '<div class="anx">' + defs.map(function (d) {
      return '<div class="an">'
        + '<svg viewBox="0 0 106 106">'
        + '<circle class="f" cx="53" cy="53" r="48"/>'
        + '<circle class="a" id="nbAn' + d.k + '" cx="53" cy="53" r="48" stroke="' + COUL[d.k] + '"/>'
        + '</svg>'
        + '<div class="in"><div class="l">' + d.l + '</div>'
        + '<div class="v">' + r0(d.v) + 'g</div>'
        + '<div class="o">' + (d.o ? 'sur ' + d.o + 'g' : '—') + '</div></div></div>';
    }).join('') + '</div>';
  }

  /* Les anneaux se remplissent APRÈS le montage : posés directement à leur
     valeur, ils n'ont rien à animer. Plafonnés à un tour — sans plafond, un
     dépassement enroulerait l'arc une seconde fois et un gros excès
     ressemblerait à un petit.

     ⚠️⚠️ EN STYLE INLINE, PAS EN `setAttribute`. Le point de départ
     (`stroke-dasharray:0 302`) et la transition vivent dans une règle CSS, et
     **une règle CSS bat un attribut de présentation** : le `setAttribute` était
     donc écrit dans le DOM et n'avait aucun effet à l'écran. Résultat observé au
     banc — trois anneaux vides avec un simple point coloré en haut (le bout
     arrondi d'un arc de longueur nulle), sur une journée à 199 g de protéines.
     Le style inline, lui, bat la règle. */
  function remplirAnneaux(mac, cible) {
    setTimeout(function () {
      if (!racine) return;
      ['p', 'l', 'g'].forEach(function (k) {
        var el = racine.querySelector('#nbAn' + k);
        if (!el) return;
        var frac = cible[k] > 0 ? borne(mac[k] / cible[k], 0, 1) : 0;
        el.style.strokeDasharray = (frac * CIRC).toFixed(1) + ' ' + CIRC.toFixed(1);
      });
    }, 220);
  }

  function kmodHTML(titreTxt, n, unite, sous) {
    return '<div class="kmod" data-in style="animation-delay:.45s">'
      + '<div><div class="t">' + esc(titreTxt) + '</div>'
      + '<div class="s">' + esc(sous) + '</div></div>'
      + '<div><div class="n">' + esc(String(n)) + '</div>'
      + '<div class="u">' + esc(unite) + '</div></div></div>';
  }

  function couleurNote(n) {
    return n >= 75 ? '#34c759' : n >= 45 ? '#ff9500' : '#ff453a';
  }

  /* ═══ LA JAUGE DE LA NOTE ═══════════════════════════════════
     Une barre verticale qui se remplit du bas vers le haut, dont la couleur
     passe du rouge au vert pendant qu'elle monte, et le nombre avec elle. */

  /* Les trois couleurs de `couleurNote`, mais MÉLANGÉES au lieu d'être
     choisies : c'est la demande (« couleur qui change smooth »). Aux notes
     45 et 75 la valeur rendue est EXACTEMENT celle de `couleurNote`, donc la
     jauge et les pastilles des critères ne peuvent pas se contredire. */
  var PALIERS = [[0, 255, 69, 58], [45, 255, 149, 0], [75, 52, 199, 89], [100, 48, 209, 88]];
  /* Mélange vers le blanc, en dur. Un arrêt translucide aurait laissé voir la
     carte À TRAVERS la barre — donc une barre trouée, pas un dégradé. */
  function versBlanc(rgb, k) {
    var m = String(rgb).match(/\d+/g);
    if (!m) return rgb;
    return 'rgb(' + m.slice(0, 3).map(function (v) {
      return Math.round(+v + (255 - +v) * k);
    }).join(',') + ')';
  }

  function couleurFluide(n) {
    n = Math.max(0, Math.min(100, +n || 0));
    for (var i = 1; i < PALIERS.length; i++) {
      var a = PALIERS[i - 1], b = PALIERS[i];
      if (n <= b[0]) {
        var k = (n - a[0]) / (b[0] - a[0] || 1);
        return 'rgb(' + Math.round(a[1] + (b[1] - a[1]) * k) + ','
                      + Math.round(a[2] + (b[2] - a[2]) * k) + ','
                      + Math.round(a[3] + (b[3] - a[3]) * k) + ')';
      }
    }
    return 'rgb(48,209,88)';
  }

  function jaugeHTML(note, libelle) {
    var connu = note !== null && note !== undefined;
    return '<div class="jhero solo" id="nbJhero">'
      + '<div class="jw" data-in style="animation-delay:.08s">'
      + '<div class="jv" id="nbJauge"><div class="flou" id="nbJflou"></div>'
      + '<div class="rail"><div class="fill" id="nbJfill"></div></div></div>'
      + '<div class="jn"><div class="v" id="nbJval">' + (connu ? '0<small>/100</small>' : '—') + '</div>'
      + '<div class="l">' + esc(libelle || 'de votre objectif du jour') + '</div></div></div></div>';
  }

  /* ⚠️⚠️ FILET OBLIGATOIRE, et ici il vaut double : une page qui ne PEINT pas
     ne reçoit aucune `requestAnimationFrame`, donc la barre resterait à zéro
     ET le nombre aussi — l'écran annoncerait « 0 sur 100 » à quelqu'un qui a
     fait une bonne journée. C'est exactement le défaut déjà payé par
     `compter()` et par le « +0 XP » d'`assets/recette.js` (règle 40 de
     CLAUDE.md). Le `setTimeout` pose l'état final quoi qu'il arrive. */
  function animerJauge(note) {
    if (note === null || note === undefined) return;
    /* ⚠️⚠️ `fini` N'EST PAS UN DOUBLON DE `pose`, et c'est un défaut trouvé au
       banc. Le filet posait bien la valeur finale à 1,75 s — puis une image
       tardive de la boucle rAF la RÉÉCRASAIT par sa valeur intermédiaire, et
       la jauge redescendait à « 9/100 » après être passée à 64. Ce n'est pas
       un cas de banc : c'est exactement ce que fait une app remise au premier
       plan au milieu de l'animation, où les images arrivent de nouveau après
       un long silence. Le filet doit donc ARRÊTER la boucle, pas seulement la
       devancer. */
    var pose = false, fini = false;
    function poser(n) {
      if (!racine) return;
      var f = racine.querySelector('#nbJfill'), b = racine.querySelector('#nbJflou'),
          v = racine.querySelector('#nbJval');
      if (!f) return;
      var c = couleurFluide(n);
      // La lueur s'arrête un peu sous le haut du remplissage : à hauteur égale
      // elle déborde par-dessus le liseré clair et l'efface.
      f.style.height = n + '%'; f.style.background = c;
      if (b) { b.style.height = Math.max(0, n - 4) + '%'; b.style.background = c; }
      if (v) { v.innerHTML = Math.round(n) + '<small>/100</small>'; v.style.color = c; }
    }
    setTimeout(function () { if (!pose) { fini = true; poser(note); } }, 1750);

    var t0 = null, duree = 1500;
    function pas(t) {
      if (fini || !racine || !racine.querySelector('#nbJfill')) return;
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / duree);
      // Départ franc puis arrivée en douceur : une barre qui monte à vitesse
      // constante se lit comme un chargement, pas comme un résultat.
      var e = 1 - Math.pow(1 - k, 3);
      poser(note * e);
      if (k < 1) requestAnimationFrame(pas); else pose = true;
    }
    setTimeout(function () { requestAnimationFrame(pas); }, 320);
  }

  function criteresHTML(criteres) {
    return '<div class="crs">' + criteres.map(function (c, i) {
      var connu = c.note !== null;
      return '<div class="cr" data-in style="animation-delay:' + (0.2 + i * 0.11).toFixed(2) + 's">'
        + '<div class="e">' + c.em + '</div>'
        + '<div class="b"><div class="n">' + esc(c.nom) + '</div>'
        + '<div class="d">' + esc(c.dit) + '</div>'
        + '<div class="j"><i data-j="' + i + '" style="background:'
          + (connu ? couleurNote(c.note) : 'var(--b-trait)') + '"></i></div></div>'
        + '<div class="p" style="color:' + (connu ? couleurNote(c.note) : 'var(--b-mut2)') + '">'
        + (connu ? c.note : '—') + '</div></div>';
    }).join('') + '</div>';
  }

  function remplirCriteres(criteres) {
    setTimeout(function () {
      if (!racine) return;
      racine.querySelectorAll('.cr .j i').forEach(function (el) {
        var c = criteres[+el.getAttribute('data-j')];
        if (c) el.style.width = (c.note === null ? 0 : c.note) + '%';
      });
    }, 260);
  }

  /* ── L'écran de la NOTE, en deux temps ──────────────────────
     La jauge seule au milieu de l'écran pendant qu'elle monte, puis elle se
     réduit et remonte pour laisser paraître ce qui l'explique. Le pourquoi et
     les deux pièges sont dans l'encadré `.jhero` du CSS.

     Le même écran sert au bilan du JOUR et à celui de la SEMAINE : deux
     présentations de la même note finiraient par diverger, et on ne saurait
     plus si « 62 » veut dire la même chose d'un écran à l'autre. */
  function ecranNote(o) {
    var connu = o.note !== null && o.note !== undefined;
    return bloc({
      html: (connu ? jaugeHTML(o.note, o.libelle)
                   : ill('cible', 80) + titre(o.titre, 'p', 0.1))
        + '<div class="apres"></div>',
      pret: function (d) {
        animerJauge(o.note);
        /* ⚠️ Le contenu du second temps est INJECTÉ au moment où il paraît, il
           n'est pas posé puis découvert : ses `[data-in]` sont des animations à
           délai, elles se seraient jouées — donc terminées — pendant que le
           bloc était encore caché, et tout serait apparu d'un coup au lieu de
           s'échelonner. */
        var poser = function () {
          minuteurNote = null;
          if (blocEnCours !== d || !d.parentNode) return;
          var ap = d.querySelector('.apres');
          if (!ap || ap.childNodes.length) return;
          ap.innerHTML = '<div class="sous" data-in>' + esc(o.sous) + '</div>'
            + criteresHTML(o.criteres);
          var h = d.querySelector('.jhero');
          if (h) h.classList.remove('solo');
          remplirCriteres(o.criteres);
          /* ⚠️ Le filet de `cine.js` est RÉARMÉ. Il a déjà posé `nc-pret` sur
             ce bloc au bout de 1,1 s : sans ce réarmement, les `[data-in]`
             qu'on vient d'insérer naîtraient figés à leur état final, donc
             sans jamais s'animer. */
          if (window.NattyCine) NattyCine.animer(d, 1100);
        };
        // Sans note, il n'y a pas de jauge à regarder monter : on montre tout.
        if (!connu) { poser(); return; }
        minuteurNote = setTimeout(poser, 2100);
      },
      boutons: [o.bouton]
    });
  }

  /* ── La courbe ──────────────────────────────────────────────
     Les calories par jour, avec la dépense en pointillés. Pourquoi les
     calories et pas la note : c'est la seule série que la personne reconnaît
     sans explication, et celle qui rend visible « je mange trop / pas assez »
     — ce que la note globale, elle, agrège au point de le cacher. */
  /* « 16 sep. » — court, sans point sur les mois qui n'en prennent pas. Écrit
     à la main plutôt que tronqué : `'août'.slice(0,4)` rend « aou », le défaut
     déjà corrigé dans `coaching.html`. */
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.',
                'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function jourEtMois(d) { return d.getDate() + ' ' + MOIS_C[d.getMonth()]; }

  function courbeHTML(pts, cible, largeur, hauteur) {
    largeur = largeur || 386; hauteur = hauteur || 170;
    var mx = 10, my = 18;
    var vals = pts.filter(function (p) { return p.note; }).map(function (p) { return p.v; });
    /* ⚠️ L'AXE PART DE ZÉRO, et c'est un choix contre la beauté du graphique.
       Recadrer sur l'amplitude des données remplirait mieux le cadre, mais
       transformerait une variation de 8 % autour de la dépense en montagnes
       russes — le graphique trompeur par excellence. La contrepartie assumée :
       sur quelqu'un de régulier, la courbe vit dans le tiers haut et le bas du
       cadre reste vide. C'est exactement ce que ça doit dire. */
    var haut = Math.max(cible || 0, Math.max.apply(null, vals.concat([1]))) * 1.15;
    var x = function (i) { return mx + (pts.length < 2 ? 0 : i * (largeur - 2 * mx) / (pts.length - 1)); };
    var y = function (v) { return hauteur - my - (v / haut) * (hauteur - 2 * my); };

    /* ⚠️⚠️ LA COURBE EST CONTINUE, ET LES TROUS SONT EN POINTILLÉ (demande de
       Pablo, 2026-09-02 : « le graphique n'est pas continu, il y a des trous,
       il faut absolument qu'il soit plein même quand on n'entre pas de
       données → lier »).

       La version précédente coupait le tracé à chaque jour non noté. Le motif
       était bon — une courbe qui plonge à zéro AFFIRME « il n'a rien mangé »,
       alors que l'app sait seulement qu'elle n'a rien enregistré — mais le
       résultat était un graphique en miettes : sur un mois ordinaire, quatre ou
       cinq segments détachés qui se lisent comme un rendu cassé, pas comme une
       tendance.

       Les deux exigences se tiennent, et c'est ce que fait `relier()` :
       • le trait va d'un bout à l'autre, sans interruption — donc « plein » ;
       • les segments qui traversent un jour sans donnée sont TRACÉS À PART, en
         pointillé clair, et ne portent AUCUN point. Le trait passe par ces
         jours, il ne les mesure pas — et ça se voit, sans avoir à lire la
         légende.
       Zéro n'est jamais inventé : un jour non noté prend la valeur interpolée
       entre ses deux voisins notés, et les jours d'avant le premier (ou d'après
       le dernier) tiennent la valeur à plat plutôt que de tomber. */
    var lie = relier(pts);
    var d = '', dPont = '';
    if (lie) {
      for (var k = 1; k < pts.length; k++) {
        var seg = 'M' + x(k - 1).toFixed(1) + ' ' + y(lie[k - 1]).toFixed(1)
                + ' L' + x(k).toFixed(1) + ' ' + y(lie[k]).toFixed(1) + ' ';
        // Un segment est « mesuré » quand ses DEUX extrémités le sont.
        if (pts[k - 1].note && pts[k].note) d += seg; else dPont += seg;
      }
    }
    var yc = y(cible || 0);

    // Une étiquette tous les 5 jours : les 30 collées seraient illisibles.
    var lbls = pts.map(function (p, i) {
      if (pts.length > 8 && i % 5 !== 0 && i !== pts.length - 1) return '';
      return '<text class="lbl" x="' + x(i).toFixed(1) + '" y="' + (hauteur - 3) + '" text-anchor="middle">'
        + (pts.length > 8 ? p.date.getDate() : JOURS_COURTS[p.date.getDay()]) + '</text>';
    }).join('');

    /* ⚠️ Pas d'aire remplie sous la courbe. Sur des données qui varient peu
       autour de la dépense — le cas normal quand quelqu'un suit son plan — elle
       remplissait les cinq sixièmes du cadre d'un bloc gris uni, et c'est ce
       bloc qu'on voyait au lieu de la courbe. Relevé à l'écran, pas à la
       lecture. Le trait suffit ; le repère, c'est la ligne de dépense. */
    var trous = pts.filter(function (p) { return !p.note; }).length;
    /* Le point marqué : le DERNIER jour noté. C'est la journée qu'on vient de
       vivre, celle dont tout l'écran parle — et c'est là que le volet finit sa
       course, donc la bulle apparaît pile où le regard arrive. */
    var iM = -1;
    for (var m = pts.length - 1; m >= 0; m--) if (pts[m].note) { iM = m; break; }
    var bul = '';
    if (iM >= 0 && lie) {
      var px = x(iM) / largeur * 100, py = y(lie[iM]) / hauteur * 100;
      /* ⚠️ La bulle est ancrée à DROITE quand le point est près du bord droit —
         et il l'est presque toujours, puisque c'est le dernier jour. Centrée,
         elle sortirait de la carte et la page partirait en défilement
         horizontal (règle 39 de CLAUDE.md). */
      var aDroite = px > 62;
      bul = '<div class="pin" style="left:' + px.toFixed(1) + '%;top:' + py.toFixed(1) + '%"></div>'
        + '<div class="bul" style="' + (aDroite ? 'right:' + (100 - px).toFixed(1) + '%;margin-right:12px'
                                                : 'left:' + px.toFixed(1) + '%;margin-left:12px')
        + ';top:' + py.toFixed(1) + '%;transform:translateY(-118%)">'
        + '<div class="bv">' + r0(pts[iM].v) + ' kcal</div>'
        + '<div class="bd">' + esc(jourEtMois(pts[iM].date)) + '</div></div>';
    }
    return '<div class="grf carte" data-in style="animation-delay:.3s">' + bul + '<div class="vol">'
      + '<svg viewBox="0 0 ' + largeur + ' ' + hauteur + '" preserveAspectRatio="none">'
      + (cible ? '<line class="cible" x1="' + mx + '" y1="' + yc.toFixed(1) + '" x2="' + (largeur - mx) + '" y2="' + yc.toFixed(1) + '"/>' : '')
      + '<line class="axe" x1="' + mx + '" y1="' + (hauteur - my) + '" x2="' + (largeur - mx) + '" y2="' + (hauteur - my) + '"/>'
      /* Le pont est posé AVANT le trait mesuré : là où les deux se touchent,
         c'est le trait plein qui doit couvrir la jointure, pas l'inverse. */
      + '<path class="lueur" id="nbLueur" d="' + d.trim() + '"/>'
      + (dPont ? '<path class="pont" id="nbPont" d="' + dPont.trim() + '"/>' : '')
      + '<path class="ligne" id="nbLigne" d="' + d.trim() + '"/>'
      + pts.map(function (p, i) {
          if (!p.note) return '';   // rien à pointer sur un jour sans donnée
          return '<circle class="pt" cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="' + (pts.length > 12 ? 2 : 3.2) + '"/>';
        }).join('')
      + lbls
      + '</svg></div></div>'
      + '<div class="lgd"><span>— ce que vous avez mangé</span>'
      + (trous ? '<span>┈ ' + trous + ' jour' + (trous > 1 ? 's' : '') + ' sans donnée, relié'
                 + (trous > 1 ? 's' : '') + '</span>' : '')
      + (cible ? '<span>┄ votre dépense</span>' : '') + '</div>';
  }

  /**
   * Les valeurs de la courbe, un nombre par jour, TROUS COMPRIS.
   *
   * @returns {number[]|null} null s'il n'y a pas un seul jour noté — auquel cas
   *          il n'y a rien à relier, et surtout rien à extrapoler.
   *
   * ⚠️ AVANT LE PREMIER JOUR NOTÉ ET APRÈS LE DERNIER, ON TIENT LA VALEUR À
   * PLAT. Prolonger la pente aurait été plus joli et franchement faux : sur
   * quelqu'un qui commence à journaliser au milieu du mois, une extrapolation
   * de deux semaines vers l'arrière dessinerait une progression qui n'a jamais
   * été observée. Un plateau, lui, dit visiblement « rien de neuf ici » — et
   * son pointillé dit que ce n'est pas une mesure.
   */
  function relier(pts) {
    var n = pts.length, notes = [];
    for (var i = 0; i < n; i++) if (pts[i].note) notes.push(i);
    if (!notes.length) return null;

    var v = new Array(n);
    for (i = 0; i < notes[0]; i++) v[i] = pts[notes[0]].v;
    for (i = notes[notes.length - 1] + 1; i < n; i++) v[i] = pts[notes[notes.length - 1]].v;
    for (var k = 0; k < notes.length; k++) {
      var a = notes[k];
      v[a] = pts[a].v;
      var b = notes[k + 1];
      if (b == null) break;
      // Interpolation linéaire entre deux jours notés.
      for (i = a + 1; i < b; i++) {
        v[i] = pts[a].v + (pts[b].v - pts[a].v) * ((i - a) / (b - a));
      }
    }
    return v;
  }

  /* ⚠️ Le tracé s'anime par `stroke-dasharray`, et la LONGUEUR ne peut être
     connue qu'une fois le chemin dans le document (`getTotalLength()` vaut 0
     sur un noeud détaché). C'est pour ça que ça se fait ici et pas dans le
     HTML. */
  function animerCourbe() {
    setTimeout(function () {
      if (!racine) return;
      var vol = racine.querySelector('.grf .vol');
      if (!vol) return;
      vol.style.animation = 'none';
      // Forcer un recalcul avant de rearmer, sinon le navigateur regroupe les
      // deux écritures et l'animation ne repart pas.
      void vol.getBoundingClientRect();
      vol.style.animation = 'nbVolet 2.2s cubic-bezier(.32,.72,.3,1) forwards';

      /* ⚠️⚠️ LE FILET, ET IL EST PLUS CRITIQUE QU'AILLEURS. Une page qui ne
         PEINT pas ne joue AUCUNE animation : le volet resterait à sa première
         image, c'est-à-dire refermé — donc le graphique ENTIER serait
         invisible, pas seulement figé. Un écran qui annonce « Vos 30 derniers
         jours » au-dessus d'un cadre vide. On rouvre donc le volet au bout de
         la durée, quoi qu'il arrive (règle 40 de CLAUDE.md). */
      setTimeout(function () {
        if (!racine || !vol.parentNode) return;
        vol.style.animation = 'none';
        vol.style.clipPath = 'none';
      }, 2500);

      /* Le point et sa bulle n'arrivent qu'une fois le trait passé sous eux :
         posés avant, ils désigneraient un endroit encore vide. */
      setTimeout(function () {
        if (!racine) return;
        var b = racine.querySelector('.grf .bul'), pin = racine.querySelector('.grf .pin');
        if (pin) pin.classList.add('on');
        if (b) b.classList.add('on');
      }, 1500);

      /* ⚠️ LE PONT NE SE TRACE PAS, IL SE RÉVÈLE. Son `stroke-dasharray` porte
         déjà le motif du pointillé (voir le CSS) : le réécrire pour l'animer
         comme le trait plein transformerait les tirets en une ligne continue —
         donc effacerait précisément ce qui distingue un jour relié d'un jour
         mesuré. Il apparaît en opacité, et un peu après le trait, pour qu'on
         lise d'abord ce qui est vrai. */
      var pont = racine.querySelector('#nbPont');
      if (pont) {
        pont.style.animation = 'none';
        void pont.getBoundingClientRect();
        pont.style.animation = 'nbFonduPont .9s ease 1.15s forwards';
      }
    }, 120);
  }

  /* ═══ 9. La séquence du JOUR ═════════════════════════════ */

  function scOuverture() {
    var p = S.profil.prenom;
    enTete('');
    bloc({
      html: ill('lune', 92)
        + '<div class="kick" data-in>' + dateFr(new Date()) + '</div>'
        + titre('Votre journée' + (p ? ',' : ''), '', 0.2)
        + (p ? titre(p, '', 0.5) : ''),
      auto: 2300, apres: scRecap
    });
  }

  function scRecap() {
    enTete('LE RÉCAP');
    /* ⚠️ L'objectif DU JOUR, supplément d'entraînement compris : comparé au
       maintien, un jour de salle où l'on a mangé ce qu'il fallait s'afficherait
       « au-dessus de l'objectif ». */
    var a = S.a, c = S.profil.cibleDu ? S.profil.cibleDu(a.jour) : S.profil.cible;
    if (a.vide) {
      // Rien à récapituler : on le dit, et on n'invente pas une journée.
      bloc({
        html: ill('assiette', 84)
          + titre('Rien de noté aujourd’hui', 'p', 0.15)
          + '<div class="sous" data-in style="animation-delay:.5s">Pas de repas enregistré '
          + 'aujourd’hui — il n’y a donc rien à analyser. Trois questions quand même, '
          + 'elles comptent autant que les chiffres.</div>',
        boutons: [{ txt: 'Répondre', on: function () { S.q = 0; scQuestion(); } },
                  { txt: 'Plus tard', cls: 'b3', on: function () { ecrire(cle('vu'), jourCourant()); fermer(); } }]
      });
      return;
    }
    bloc({
      html: ill('assiette', 84)
        + titre('Ce que vous avez mangé', 'p', 0.1)
        + anneauxHTML(a.mac, c)
        + kmodHTML('Calories comptées', a.mac.c, 'kcal',
            c.c ? 'sur ' + c.c + ' de dépense' : 'dépense inconnue')
        + '<div class="sous" data-in style="animation-delay:.7s">'
        + a.nbRepas + ' repas · ' + a.distincts + ' aliment' + (a.distincts > 1 ? 's' : '')
        + ' différent' + (a.distincts > 1 ? 's' : '') + '</div>',
      pret: function () { remplirAnneaux(a.mac, c); },
      boutons: [{ txt: 'Continuer', on: function () { S.q = 0; scQuestion(); } }]
    });
  }

  /* Le questionnaire vient AVANT l'analyse, et c'est voulu : on demande son
     ressenti à la personne avant de lui montrer la note. Dans l'autre sens,
     une note de 82 dicterait la réponse — on ne mesurerait plus son état, on
     mesurerait sa lecture du chiffre. */
  function scQuestion() {
    var qu = QUESTIONS[S.q];
    enTete('COMMENT ÇA VA (' + (S.q + 1) + '/' + QUESTIONS.length + ')');
    var pts = '<div class="pts" data-in>' + QUESTIONS.map(function (_, i) {
      return '<i class="' + (i <= S.q ? 'on' : '') + '"></i>';
    }).join('') + '</div>';

    bloc({
      html: ill('question', 76)
        + titre(qu.titre, 'p', 0.1)
        + '<div class="sous" data-in style="animation-delay:.4s">' + esc(qu.sous) + '</div>'
        + '<div class="chx">' + qu.choix.map(function (ch, i) {
            return '<button type="button" data-v="' + esc(ch.v) + '" data-in style="animation-delay:'
              + (0.5 + i * 0.08).toFixed(2) + 's"><span class="em">' + ch.em + '</span>'
              + esc(ch.txt) + '</button>';
          }).join('') + '</div>' + pts,
      pret: function (d) {
        d.querySelectorAll('.chx button').forEach(function (b) {
          b.addEventListener('click', function () {
            S.rep[qu.cle] = b.getAttribute('data-v');
            b.classList.add('pris');
            // Un court instant pour que le choix se VOIE avant de partir :
            // enchaîner dans le même souffle donne l'impression d'un raté.
            setTimeout(function () {
              if (!ouvert) return;
              S.q++;
              if (S.q < QUESTIONS.length) scQuestion();
              else scAnalyse();
            }, 260);
          });
        });
      },
      // Pas de bouton dans la barre : les choix SONT l'action. Un « Suivant »
      // en plus laisserait croire qu'on peut passer sans répondre, alors que
      // c'est exactement ce que fait la croix en haut à droite.
      boutons: []
    });
  }

  function scAnalyse() {
    enTete('L’ANALYSE');
    var a = S.a;
    var accord = accordRessenti(S.rep.mange, a.note);
    ecranNote({
      note: a.note, titre: 'Votre journée', sous: accord, criteres: a.criteres,
      bouton: { txt: 'Et mon corps ?', on: scSeance }
    });
  }

  /* ── La séance, juste AVANT le corps ─────────────────────────
     Demande de Pablo (2026-09-02) : « il faudrait pouvoir ajouter sa séance
     avant le bilan pour voir exactement combien de grammes de muscle on a
     gagné et combien de graisse brûlée ».

     ⚠️ SA PLACE DANS LA SÉQUENCE EST TOUT L'INTÉRÊT. Posée après l'écran du
     corps, la question aurait été une formalité : on aurait déjà lu ses deux
     chiffres, et les corriger après coup revient à dire que le premier
     affichage était faux. Posée ici, la réponse ARRIVE À TEMPS — l'écran
     suivant est calculé avec elle.

     ⚠️ Elle est sautée sans un mot quand `assets/seance.js` n'est pas chargé.
     Un écran qui demande d'ajouter une séance et n'aurait rien pour la
     recevoir est pire qu'un écran absent — c'est le défaut qu'avait le bouton
     « Continuer avec Apple » (§11 de CLAUDE.md). */
  function scSeance() {
    if (!window.NattySeance) { scCorps(); return; }
    enTete('VOTRE SÉANCE');
    var sea = S.seance;

    if (sea) {
      var kc = NattySeance.kcal(sea, S.profil.poids);
      bloc({
        html: ill('haltere', 80)
        + titre('Séance notée', 'p', 0.1)
          + '<div class="sous" data-in style="animation-delay:.4s">'
          + esc(NattySeance.resume(sea, S.profil.poids)) + '</div>'
          + (kc ? kmodHTML('Ajoutées à votre dépense', kc, 'kcal',
                'soit ' + Math.round(kc / KCAL_PAR_KG_GRAS * 1000) + ' g de graisse en plus dans le déficit')
                : '')
          + '<div class="note-est" data-in style="animation-delay:.7s">C’est ce qui rend '
          + 'les deux chiffres suivants exacts : la dépense de la séance entre dans le '
          + 'déficit, et son volume dans ce que votre corps a pu construire.</div>',
        boutons: [
          { txt: 'C’est bien ça', on: scCorps },
          { txt: 'Corriger ma séance', cls: 'b3', on: ouvrirSaisieSeance }
        ]
      });
      return;
    }

    bloc({
      html: ill('haltere', 80)
        + titre('Vous avez bougé aujourd’hui ?', 'p', 0.1)
        + '<div class="sous" data-in style="animation-delay:.4s">Sans séance notée, le '
        + 'muscle et la graisse se déduisent de votre niveau d’activité déclaré à '
        + 'l’inscription — la même valeur un jour de repos et un jour de squat. '
        + 'Deux minutes de saisie, et les deux chiffres deviennent les vôtres.</div>',
      boutons: [
        { txt: '🏋️  Ajouter ma séance', on: ouvrirSaisieSeance },
        { txt: 'Pas de séance aujourd’hui', cls: 'b3', on: scCorps }
      ]
    });
  }

  /* ⚠️ AU RETOUR, ON RECALCULE — c'est la seule raison d'être de ce détour.
     Reprendre `S.corps` tel quel afficherait les chiffres d'AVANT la séance,
     donc exactement ce que la question était censée corriger : on aurait ajouté
     dix séries pour voir le même « 12 g ».
     Le module s'ouvre par-dessus le bilan (z-index 9700 contre 640) et rend la
     main par son `apres`. */
  function ouvrirSaisieSeance() {
    NattySeance.ajouterPour(jourCourant(), function () {
      if (!racine) return;   // le bilan a été fermé entre-temps
      var ctx = ctxSeance(jourCourant(), journalise());
      S.seance = ctx.seance;
      S.corps = corpsDuJour(S.a, S.profil, ctx);
      // La série et la semaine portent le même jour : les laisser en arrière
      // ferait dire à la courbe le contraire de l'écran qu'on vient de quitter.
      S.serie30 = serie(JOURS_COURBE);
      S.sem = semaineEnCours();
      scCorps();
    });
  }

  /* Confronter le ressenti à la mesure — c'est ce qui donne son sens à la
     question posée deux écrans plus tôt. Sans ce rapprochement, le
     questionnaire ne serait qu'un formulaire de plus. */
  function accordRessenti(ressenti, note) {
    if (note === null) return 'Il manque votre poids et votre dépense pour noter la journée — ils se renseignent dans votre profil.';
    if (!ressenti) return 'Régularité, intensité, variété, équilibre : quatre façons de regarder la même journée.';
    if (ressenti === 'oui' && note >= 70) return 'Vous vous sentiez bien, et les chiffres le confirment.';
    if (ressenti === 'oui' && note < 55) return 'Vous vous sentiez bien — les chiffres sont plus sévères. Regardez lequel des quatre traîne.';
    if (ressenti === 'non' && note >= 70) return 'Vous trouviez la journée ratée : elle ne l’est pas. Voyez plutôt.';
    if (ressenti === 'non') return 'Vous le sentiez, et c’est vrai. Un seul des quatre suffit à redresser demain.';
    if (note >= 70) return 'Vous la trouviez moyenne, elle est meilleure que ça.';
    return 'Une journée moyenne, et les chiffres disent la même chose.';
  }

  /**
   * Les trois facteurs du muscle, chacun avec la mesure d'où il sort.
   *
   * ⚠️ ON AFFICHE LA MESURE, PAS SEULEMENT LE POURCENTAGE. « Protéines 100 % »
   * ne dit rien de vérifiable ; « 1,9 g par kilo » se recompte. C'est la
   * différence entre un chiffre personnalisé et un chiffre qui en a l'air.
   */
  function decompositionHTML(cp) {
    var n = cp.nut || {};
    var e = cp.entrainement;
    var lignes = [];

    if (cp.facteurSeance !== 1) {
      lignes.push({
        cle: 'Entraînement', v: cp.facteurSeance,
        max: PLAFOND_SEANCE,
        dit: e && e.volume
          ? (cp.seriesSeance || 0) + ' série' + ((cp.seriesSeance || 0) > 1 ? 's' : '')
            + ' notée' + ((cp.seriesSeance || 0) > 1 ? 's' : '')
            + (e.volumePondere ? ' · ' + String(e.volumePondere).replace('.', ',')
                                 + ' pondérées' : '')
            /* Le tonnage passe devant le reste dès qu'il existe : c'est la seule
               MESURE de la ligne, tout le reste étant modélisé. */
            + (e.tonnage ? ' · ' + String(Math.round(e.tonnage / 100) / 10).replace('.', ',')
                           + '\u00a0t soulevées' : '')
            + (e.frequence >= 2 ? ' · ' + Math.round(e.frequence) + ' passages sur ce groupe cette semaine'
                                : ' · 1 seul passage sur ce groupe cette semaine')
          : 'aucune série aujourd’hui — la veille compte pour moitié'
      });
    }
    lignes.push({
      cle: 'Protéines', v: n.fProt || 0, max: 1,
      dit: (n.gParKg ? n.gParKg.toFixed(1).replace('.', ',') : '0')
        + '\u00a0g par kilo de poids de corps' + (n.fProt >= 1 ? ' — au plateau utile' : '')
    });
    lignes.push({
      cle: 'Énergie', v: n.fEnergie || 0, max: 1,
      dit: Math.round((n.ratio || 0) * 100) + '\u00a0% de votre dépense du jour'
    });
    lignes.push({
      cle: 'Répartition', v: 0.85 + 0.15 * (n.fRepart || 0), max: 1,
      dit: (n.doses || 0) === 0
        ? 'aucun de vos ' + (n.nbRepas || 0) + ' repas n’a porté une dose utile de '
          + 'protéines (≥ ' + (n.seuilDose || 0) + '\u00a0g)'
        : n.doses + ' repas sur ' + (n.nbRepas || n.doses) + ' ont porté une dose utile '
          + '(≥ ' + (n.seuilDose || 0) + '\u00a0g)'
    });

    /* ⚠️ `dcp`/`dc`, PAS `crs`/`cr` : ces deux-là appartiennent déjà aux quatre
       critères, avec des enfants `.e .b .n .d .j .p` et un `display:flex` en
       rangée. Les réutiliser aurait posé mes trois lignes côte à côte. */
    return '<div class="dcp" data-in style="animation-delay:.85s">'
      + lignes.map(function (l) {
          var pc = Math.round((l.v / l.max) * 100);
          return '<div class="dc">'
            + '<div class="dt"><span>' + esc(l.cle) + '</span>'
            + '<b>' + Math.round(l.v * 100) + '\u00a0%</b></div>'
            + '<div class="db"><i style="width:' + borne(pc, 0, 100) + '%;'
            + 'background:' + couleurNote(pc) + '"></i></div>'
            + '<div class="dd">' + esc(l.dit) + '</div>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  function scCorps() {
    enTete('VOTRE CORPS');
    var cp = S.corps, a = S.a;
    if (!cp.estimable) {
      bloc({
        html: ill('balance', 80)
        + titre('Pas encore estimable', 'p', 0.1)
          + '<div class="sous" data-in style="animation-delay:.4s">Pour estimer ce que votre '
          + 'corps a construit ou brûlé, il faut votre poids et votre dépense quotidienne — '
          + 'ils viennent de votre profil.</div>',
        boutons: [{ txt: 'Voir ma progression', on: scProgression }]
      });
      return;
    }
    /* ⚠️ LE CAS CONTRE-INTUITIF PASSE EN PREMIER, et il faut le nommer. Une
       séance fait monter la dépense : à apport égal, le facteur énergie baisse,
       donc le muscle construit baisse aussi. C'est la physiologie, mais sans
       explication ça se lit comme un bug — « j'ai déclaré ma séance et l'app
       m'annonce moins de muscle ». La phrase dit ce qui manque, et ce qui
       manque est une assiette, pas une série. */
    var phrase = (cp.avecSeance && cp.facteurEnergie < 0.5)
      ? 'Votre séance a augmenté votre dépense du jour. À cet apport, le corps puise '
        + 'plus qu’il ne construit : manger un peu plus les jours de salle fait monter '
        + 'les deux chiffres à la fois.'
      : cp.muscle > 0 && cp.gras > 0
      ? 'Assez de protéines et un léger déficit : les deux à la fois, c’est le meilleur cas.'
      : cp.muscle > 0
        ? 'De quoi construire : les protéines sont là et l’énergie suit.'
        : cp.gras > 0
          ? 'En déficit aujourd’hui. Sous 80\u00a0% de votre dépense, le corps ne construit plus — il puise.'
          : 'Au-delà de votre dépense aujourd’hui : rien de brûlé, mais de quoi construire si les protéines suivent.';

    bloc({
      /* L'illustration suit le résultat : la flamme quand le corps a puisé, le
         cœur quand il a construit. Une seule image pour les deux ferait passer
         un jour de déficit pour un jour de gain. */
      html: ill(cp.gras > cp.muscle * 3 ? 'flamme' : 'coeur', 82)
        + titre('Aujourd’hui, votre corps', 'p', 0.1)
        + '<div class="cps">'
        + '<div class="cp" data-in style="animation-delay:.35s"><div class="e">💪</div>'
        + '<div class="v" id="nbMus">0<small>g</small></div><div class="l">de muscle construit</div></div>'
        + '<div class="cp" data-in style="animation-delay:.5s"><div class="e">🔥</div>'
        + '<div class="v" id="nbGras">0<small>g</small></div><div class="l">de graisse puisée</div></div>'
        + '</div>'
        + '<div class="sous" data-in style="animation-delay:.7s">' + esc(phrase) + '</div>'
        /* ⚠️ LA DÉCOMPOSITION EST À L'ÉCRAN, et ce n'est pas de la décoration.
           Demande de Pablo : « ça ne doit pas être uniquement 48 g, ça doit
           être des vrais calculs ». Un total seul est un nombre qu'on croit ou
           pas ; posé à côté de ses trois facteurs — chacun avec la mesure dont
           il sort — il devient vérifiable, et on voit LEQUEL des trois retient
           le résultat. C'est aussi ce qui rend le conseil évident : le facteur
           le plus bas est ce qu'il y a à corriger demain. */
        + decompositionHTML(cp)
        + '<div class="note-est" data-in style="animation-delay:.95s">Estimations, pas des '
        + 'mesures. La graisse vient de votre bilan d’énergie ('
        + (cp.deficit ? '−' + cp.deficit : '+' + cp.surplus) + ' kcal sur '
        + r0(cp.depense || S.profil.cible.c) + ' de dépense'
        + (cp.kcalSeance ? ', dont ' + cp.kcalSeance + ' calculées sur vos exercices' : '')
        + ', ~7 700 kcal par kilo). Le muscle part de votre plafond biologique — '
        + cp.potentiel + '\u00a0g par jour pour ' + r0(S.profil.poids) + '\u00a0kg à votre '
        + 'niveau — que les facteurs ci-dessus réduisent, chacun calculé sur ce que vous '
        + 'avez saisi.</div>'
        /* ⚠️ Cette invitation ne s'affiche QUE quand rien n'a été noté. Sur une
           journée avec séance, elle laisserait croire que la saisie n'a pas
           été prise en compte — alors que les deux chiffres au-dessus en
           découlent. */
        + (!cp.avecSeance && window.NattySeance
            ? '<div class="note-est" data-in style="animation-delay:.95s">Aucune séance notée '
              + 'aujourd’hui : ces deux chiffres viennent donc de votre seule alimentation. '
              + 'Une séance ajoutée les rendrait exacts.</div>'
            : ''),
      pret: function () {
        compter('nbMus', cp.muscle, 'g');
        compter('nbGras', cp.gras, 'g');
      },
      boutons: [
        { txt: 'Voir ma progression', on: scProgression },
        !cp.avecSeance && window.NattySeance
          ? { txt: '🏋️  Ajouter ma séance', cls: 'b3', on: ouvrirSaisieSeance }
          : null
      ].filter(Boolean)
    });
  }

  /* Un chiffre qui monte plutôt qu'un chiffre posé : c'est la demande de Pablo
     (« faire des animations pour montrer combien … »), et c'est ce qui fait
     lire le nombre au lieu de le survoler. */
  function compter(id, vers, unite) {
    var el = racine && racine.querySelector('#' + id);
    if (!el) return;
    if (!vers) { el.innerHTML = '0<small>' + unite + '</small>'; return; }

    /* ⚠️⚠️ LE FILET N'EST PAS UNE PRÉCAUTION DE PRINCIPE. Une page qui ne PEINT
       pas ne reçoit AUCUNE `requestAnimationFrame` : le compteur reste alors sur
       sa valeur de départ, c'est-à-dire qu'il annonce « 0 g » là où il y a
       250 g de graisse puisée — l'exact contraire de ce que l'écran célèbre, et
       sur les deux seuls chiffres qu'on vient y chercher. Mesuré au banc, volet
       masqué. C'est la situation réelle de quelqu'un qui ouvre son bilan et
       verrouille son téléphone le temps que la séquence défile.
       Même famille que le compteur d'XP d'`assets/recette.js` (déjà corrigé
       pour cette raison) et que la classe `on` de `Natty.confirmer` — règle 40
       de CLAUDE.md. */
    var pose = false;
    setTimeout(function () {
      if (pose || !racine || !el.parentNode) return;
      el.innerHTML = vers + '<small>' + unite + '</small>';
    }, 1300);

    var t0 = null, duree = 1100;
    function pas(t) {
      if (!racine || !el.parentNode) return;
      if (t0 === null) t0 = t;
      var k = borne((t - t0) / duree, 0, 1);
      // Décélération : un compteur linéaire s'arrête net, celui-ci se pose.
      var v = Math.round(vers * (1 - Math.pow(1 - k, 3)));
      el.innerHTML = v + '<small>' + unite + '</small>';
      if (k < 1) requestAnimationFrame(pas); else pose = true;
    }
    requestAnimationFrame(pas);
  }

  function scProgression() {
    enTete('DEPUIS LE DÉBUT');
    var s = S.serie30;
    var pts = s.map(function (x) {
      // `note` = ce jour A une donnée. Sans ce drapeau, la courbe ne peut pas
      // distinguer « 0 kcal mangé » de « rien d'enregistré » — et elle plongeait
      // à zéro dans les deux cas.
      return { date: x.date, v: x.a.mac.c, note: !x.a.vide };
    });
    var joursNotes = s.filter(function (x) { return !x.a.vide; }).length;
    var musTot = s.reduce(function (n, x) { return n + x.corps.muscle; }, 0);
    var grasTot = s.reduce(function (n, x) { return n + x.corps.gras; }, 0);
    var notes = s.filter(function (x) { return x.a.note !== null && !x.a.vide; }).map(function (x) { return x.a.note; });
    var moyNote = notes.length ? r0(notes.reduce(function (a, b) { return a + b; }, 0) / notes.length) : null;

    bloc({
      html: ill('courbe', 80)
        + titre('Vos 30 derniers jours', 'p', 0.1)
        + courbeHTML(pts, S.profil.cible.c)
        + '<div class="stats">'
        + stat(joursNotes + '<small style="font-size:14px"> j</small>', 'jours notés sur 30', 0.5)
        + stat(moyNote === null ? '—' : moyNote, 'note moyenne sur 100', 0.58)
        + stat(kilos(musTot), 'de muscle construit, estimé', 0.66)
        + stat(kilos(grasTot), 'de graisse puisée, estimée', 0.74)
        + '</div>',
      pret: animerCourbe,
      boutons: [{ txt: 'Terminer', on: scFin }]
    });
  }

  function stat(v, l, delai) {
    return '<div class="st" data-in style="animation-delay:' + delai + 's">'
      + '<div class="v">' + v + '</div><div class="l">' + esc(l) + '</div></div>';
  }

  /* Des grammes tant qu'on est sous le kilo, des kilos au-delà. « 0,84 kg » se
     lit moins bien que « 840 g », et « 1 240 g » moins bien que « 1,2 kg ». */
  function kilos(g) {
    if (g < 1000) return r0(g) + '<small style="font-size:14px"> g</small>';
    return (g / 1000).toFixed(1).replace('.', ',') + '<small style="font-size:14px"> kg</small>';
  }

  var MENTION_LOCALE = 'Vos réponses sont gardées sur cet appareil uniquement — la table '
    + '`bilan_jour` n’existe pas encore en base.';

  function scFin() {
    enTete('');
    var demain = motDeFin();
    var quandSemaine = new Date().getDay() === 6;
    /* ⚠️ ON GARDE LA RÉFÉRENCE DU BLOC, on ne le retrouve pas par sélecteur.
       `racine.querySelector('.bloc')` renvoyait le plan SORTANT — il reste dans
       le DOM 360 ms le temps de croiser l'entrant — donc la mention « gardé sur
       cet appareil » était ajoutée à un élément sur le point d'être supprimé, et
       ne s'affichait jamais. Mesuré au banc : `aNote: false` alors que le POST
       avait bien échoué. Même piège que les plans qui s'empilent dans
       `assets/recette.js` et `narration.html`. */
    var d = bloc({
      html: ill('lune', 88)
        + titre('À demain', '', 0.15)
        + '<div class="sous" data-in style="animation-delay:.45s">' + esc(demain) + '</div>'
        + (tableDispo === false
            ? '<div class="note-est" data-in style="animation-delay:.6s">' + MENTION_LOCALE + '</div>'
            : ''),
      boutons: [
        quandSemaine && !S.semaine
          ? { txt: 'Voir la semaine', on: function () { lancer(true); } }
          : { txt: 'Fermer', on: fermer }
      ]
    });
    // On enregistre ICI et pas au dernier clic : quelqu'un qui referme l'écran
    // à ce stade a répondu, ses réponses ne doivent pas se perdre.
    enregistrerReponses(S.rep, S.a, S.corps, false).then(function () {
      // Si la table manque, on ne le sait qu'après le POST — donc après le
      // montage du bloc, d'où cet ajout tardif.
      if (tableDispo === false && d && d.parentNode && !d.querySelector('.note-est')) {
        d.insertAdjacentHTML('beforeend',
          '<div class="note-est" data-in>' + MENTION_LOCALE + '</div>');
      }
    });
  }

  /* Ce qu'on dit en partant. Tiré du critère le PLUS FAIBLE, parce qu'un
     conseil qui porte sur ce qui va déjà bien ne sert à rien — et du ressenti,
     parce qu'un soir de motivation basse n'est pas le moment d'en demander
     plus. */
  function motDeFin() {
    if (S.rep.motivation === 'basse') {
      return 'Motivation en baisse : demain, viser un seul repas noté suffira. On reprend doucement.';
    }
    var faibles = S.a.criteres.filter(function (c) { return c.note !== null; })
      .sort(function (a, b) { return a.note - b.note; });
    var f = faibles[0];
    if (!f || f.note >= 75) return 'Journée solide sur les quatre critères. Même chose demain suffira.';
    var quoi = {
      reg: 'Demain, le point à gagner est la régularité : noter chaque repas, même vite.',
      int: 'Demain, l’écart est sur les calories. Un repas de plus, ou un peu moins copieux.',
      var: 'Demain, un aliment que vous n’avez pas mangé aujourd’hui. Un seul.',
      eqi: 'Demain, l’équilibre : c’est la macro la plus basse de vos anneaux qu’il faut remonter.'
    };
    if (S.rep.difficulte === 'temps') return 'Le temps de cuisiner, c’est ce que la planification de la semaine règle. ' + (quoi[f.cle] || '');
    if (S.rep.difficulte === 'envies') return 'Les envies de sucré tombent quand les protéines sont là. ' + (quoi[f.cle] || '');
    return quoi[f.cle] || 'Un critère à la fois, c’est comme ça que ça tient.';
  }

  /* ═══ 10. La séquence de la SEMAINE ══════════════════════
     Ce n'est pas un autre calcul, c'est le même sur sept jours — et c'est
     volontaire : deux calculs finiraient par se contredire, et une note du
     samedi qui ne découle pas des notes de la semaine ne veut rien dire.
     Ce qui change, c'est ce qu'on regarde : les jours l'un contre l'autre, la
     constance, les totaux, et ce que la personne a répondu tous les soirs. */

  function scSemOuverture() {
    enTete('');
    var l = lundiDe(new Date());
    bloc({
      html: ill('semaine', 92)
        + '<div class="kick" data-in>du ' + dateFr(l) + ' au ' + dateFr(new Date()) + '</div>'
        + titre('Votre semaine', '', 0.2),
      auto: 2200, apres: scSemJours
    });
  }

  /* L'échelle de gauche : quatre repères, du haut vers le bas. Un graphique
     dont on ignore les bornes peut faire passer 3 % pour un envol. */
  function echelleHTML(max) {
    var out = [];
    for (var i = 4; i >= 0; i--) out.push('<span>' + (Math.round(max * i / 4 / 100) / 10) + 'k</span>');
    return '<div class="semy">' + out.join('') + '</div>';
  }

  function scSemJours() {
    enTete('LES SEPT JOURS');
    var sem = S.sem, c = S.profil.cible;
    var max = Math.max(c.c || 0, Math.max.apply(null, sem.map(function (x) { return x.a.mac.c; }).concat([1])));
    var notes = sem.filter(function (x) { return !x.a.vide; });
    /* Les hauteurs, trous reliés — exactement la même fonction que la courbe.
       Deux interpolations pour les deux graphiques du même écran, c'est deux
       qui finiraient par ne plus raconter la même semaine. */
    var h = relier(sem.map(function (x) {
      return { v: x.a.mac.c, note: !x.a.vide };
    })) || sem.map(function () { return 0; });

    /* LE JOUR MIS EN AVANT est le mieux noté de la semaine — pas le plus
       calorique. Le graphique montre des calories, mais ce que l'écran
       célèbre, c'est une journée réussie : accentuer la plus grosse barre
       féliciterait le jour où l'on a le plus mangé. */
    var iTop = -1, meilleureNote = -1;
    sem.forEach(function (x, i) {
      if (x.a.vide || x.a.note === null) return;
      if (x.a.note > meilleureNote) { meilleureNote = x.a.note; iTop = i; }
    });
    /* ⚠️ La bulle vit DANS `.sem`, en pourcentage de sa largeur : posée dans la
       colonne du jour, elle serait rognée par la largeur d'une barre (34 px).
       Et elle bascule du côté du centre quand le jour est près d'un bord —
       sinon elle sort de la carte et la page part en défilement horizontal. */
    var bulTop = '';
    if (iTop >= 0) {
      var t = sem[iTop], xp = ((iTop + 0.5) / sem.length) * 100, aG = xp > 55;
      var ecart = c.c ? (t.a.mac.c - c.c) : null;
      bulTop = '<div class="bul" style="' + (aG ? 'right:' + (100 - xp).toFixed(1) + '%;margin-right:16px'
                                               : 'left:' + xp.toFixed(1) + '%;margin-left:16px')
        + ';top:6px">'
        + '<div class="bd">' + esc(jourEtMois(t.date)) + '</div>'
        + '<div class="br"><i>Mangé</i><b>' + r0(t.a.mac.c) + ' kcal</b></div>'
        + (ecart === null ? '' : '<div class="br"><i>Écart</i><b>'
            + (ecart > 0 ? '+' : '−') + Math.abs(r0(ecart)) + ' kcal</b></div>')
        + '<div class="br"><i>Note</i><b>' + t.a.note + '/100</b></div></div>';
    }

    bloc({
      html: ill('calendrier', 80)
        + titre('Jour après jour', 'p', 0.1)
        + '<div class="semw carte">' + echelleHTML(max) + '<div class="sem">' + sem.map(function (x, i) {
            return '<div class="d' + (x.a.vide ? ' vide' : '') + (i === iTop ? ' top' : '') + '">'
              + '<div class="n">' + (x.a.vide ? '' : r0(x.a.mac.c / 100) / 10 + 'k') + '</div>'
              + '<div class="bar" data-h="' + Math.max(3, Math.round((h[i] / max) * 118)) + '"></div>'
              + '<div class="j">' + JOURS_COURTS[x.date.getDay()] + '</div></div>';
          }).join('') + (c.c ? '<div class="dep"><span></span></div>' : '') + bulTop + '</div></div>'
        + '<div class="sous" data-in style="animation-delay:.6s">'
        + notes.length + ' jour' + (notes.length > 1 ? 's' : '') + ' noté' + (notes.length > 1 ? 's' : '')
        + ' sur ' + sem.length
        + (notes.length < sem.length ? ' · les jours hachurés sont reliés, pas mesurés' : '')
        + (c.c ? ' · trait de dépense à ' + c.c + ' kcal' : '') + '</div>',
      pret: function (d) {
        /* ⚠️ Le trait de dépense est DESSINÉ, pas seulement annoncé. La phrase
           du bas disait « trait de dépense à 2800 kcal » alors qu'aucun trait
           n'existait : on cherchait à l'écran une référence promise par le
           texte. C'est aussi la seule chose qui donne un sens aux hauteurs —
           sans elle, six barres blanches ne disent pas si la journée est
           au-dessus ou en dessous de la dépense.
           Sa position est MESURÉE après coup (le bas réel des barres), pas
           déduite : elle dépend de la hauteur de la lettre du jour, qui tient
           aux métriques de la police et pas à une constante. */
        var trait = d.querySelector('.dep');
        if (trait && c.c) {
          var b0 = d.querySelector('.bar'), piste = d.querySelector('.sem');
          if (b0 && piste) {
            var bas = piste.getBoundingClientRect().bottom - b0.getBoundingClientRect().bottom;
            trait.style.bottom = (bas + Math.round((c.c / max) * 118)) + 'px';
          }
        }
        /* ⚠️ Le dégradé de la barre accentuée est POSÉ ICI, pas en CSS : voir
           la note sur `color-mix` dans la feuille. Les trois arrêts partent de
           la couleur de la note du jour, donc la barre dit la même chose que
           la jauge et que les pastilles des critères. */
        var top = d.querySelector('.d.top .bar');
        if (top && meilleureNote >= 0) {
          var acc = couleurFluide(meilleureNote);
          top.parentNode.style.setProperty('--b-acc', acc);
          top.style.background = 'linear-gradient(180deg,' + acc + ' 0%,'
            + versBlanc(acc, 0.55) + ' 58%,#fff 100%)';
        }
        setTimeout(function () {
          if (trait) trait.classList.add('on');
          d.querySelectorAll('.bar').forEach(function (b, i) {
            setTimeout(function () { b.style.height = b.getAttribute('data-h') + 'px'; }, i * 70);
          });
          /* La bulle arrive après la dernière barre : annoncée avant, elle
             désignerait une colonne encore vide. */
          setTimeout(function () {
            var bl = d.querySelector('.sem .bul');
            if (bl) bl.classList.add('on');
          }, sem.length * 70 + 600);
        }, 200);
      },
      boutons: [{ txt: 'Mes performances', on: scSemPerf }]
    });
  }

  function scSemPerf() {
    enTete('VOS PERFORMANCES');
    // La moyenne de la semaine, critère par critère — c'est ce qui distingue
    // le bilan hebdomadaire de sept bilans quotidiens : on voit ce qui tient.
    var moy = moyenneCriteres(S.sem);
    var meilleur = S.sem.filter(function (x) { return x.a.note !== null && !x.a.vide; })
      .sort(function (a, b) { return b.a.note - a.a.note; })[0];
    ecranNote({
      note: moy.note, titre: 'Votre semaine',
      libelle: 'de vos objectifs cette semaine',
      sous: meilleur
        ? 'Meilleur jour : ' + JOURSLONGS(meilleur.date) + ', ' + meilleur.a.note + ' sur 100.'
        : 'Aucun jour noté cette semaine.',
      criteres: moy.criteres,
      bouton: { txt: 'Ce que mon corps a fait', on: scSemCorps }
    });
  }

  function JOURSLONGS(d) {
    return ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][d.getDay()];
  }

  /** La moyenne d'un critère sur la semaine, en ignorant les jours vides. */
  function moyenneCriteres(sem) {
    var pleins = sem.filter(function (x) { return !x.a.vide; });
    var out = QUATRE.map(function (def, i) {
      var vals = pleins.map(function (x) { return x.a.criteres[i].note; })
        .filter(function (n) { return n !== null; });
      var n = vals.length ? r0(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) : null;
      return { cle: def.cle, nom: def.nom, em: def.em, note: n,
               dit: vals.length ? 'moyenne sur ' + vals.length + ' jour' + (vals.length > 1 ? 's' : '') + ' noté' + (vals.length > 1 ? 's' : '')
                                : 'aucun jour noté' };
    });
    var connus = out.filter(function (x) { return x.note !== null; });
    return { criteres: out,
             note: connus.length ? r0(connus.reduce(function (s, x) { return s + x.note; }, 0) / connus.length) : null };
  }
  var QUATRE = [
    { cle: 'reg', nom: 'Régularité', em: '⏱' }, { cle: 'int', nom: 'Intensité', em: '⚡' },
    { cle: 'var', nom: 'Variété', em: '🌿' }, { cle: 'eqi', nom: 'Équilibre', em: '⚖️' }
  ];

  function scSemCorps() {
    enTete('VOTRE CORPS, SUR 7 JOURS');
    var sem = S.sem;
    var mus = sem.reduce(function (n, x) { return n + x.corps.muscle; }, 0);
    var gras = sem.reduce(function (n, x) { return n + x.corps.gras; }, 0);
    var deficit = sem.reduce(function (n, x) { return n + x.corps.deficit - x.corps.surplus; }, 0);
    var estimable = sem.some(function (x) { return x.corps.estimable; });
    var nbSea = sem.filter(function (x) { return x.seance; }).length;
    var kcalSea = sem.reduce(function (n, x) { return n + (x.corps.kcalSeance || 0); }, 0);

    if (!estimable) {
      bloc({
        html: titre('Pas encore estimable', 'p', 0.1)
          + '<div class="sous" data-in style="animation-delay:.4s">Il faut votre poids et votre '
          + 'dépense quotidienne, qui viennent de votre profil.</div>',
        boutons: [{ txt: 'Voir la courbe', on: scSemCourbe }]
      });
      return;
    }
    bloc({
      html: ill('coeur', 82)
        + titre('Cette semaine, votre corps', 'p', 0.1)
        + '<div class="cps">'
        + '<div class="cp" data-in style="animation-delay:.35s"><div class="e">💪</div>'
        + '<div class="v" id="nbMus">0<small>g</small></div><div class="l">de muscle construit</div></div>'
        + '<div class="cp" data-in style="animation-delay:.5s"><div class="e">🔥</div>'
        + '<div class="v" id="nbGras">0<small>g</small></div><div class="l">de graisse puisée</div></div>'
        + '</div>'
        + '<div class="note-est" data-in style="animation-delay:.7s">Estimations cumulées sur les '
        + 'jours notés, pas des mesures. Bilan d’énergie de la semaine : '
        + (deficit >= 0 ? '−' + r0(deficit) : '+' + r0(-deficit)) + ' kcal'
        + (kcalSea ? ', dont ' + r0(kcalSea) + ' dépensées en ' + nbSea + ' séance'
                     + (nbSea > 1 ? 's' : '') : '')
        + '. Un jour non noté compte pour zéro — il n’invente rien, mais il ne dit rien non plus.'
        + (window.NattySeance && !nbSea
            ? ' Aucune séance notée cette semaine : le muscle vient donc de votre seul'
              + ' niveau d’activité déclaré.' : '')
        + '</div>',
      pret: function () { compter('nbMus', mus, 'g'); compter('nbGras', gras, 'g'); },
      boutons: [{ txt: 'Voir la courbe', on: scSemCourbe }]
    });
  }

  function scSemCourbe() {
    enTete('LA TENDANCE');
    var s = S.serie30;
    var pts = s.map(function (x) {
      // `note` = ce jour A une donnée. Sans ce drapeau, la courbe ne peut pas
      // distinguer « 0 kcal mangé » de « rien d'enregistré » — et elle plongeait
      // à zéro dans les deux cas.
      return { date: x.date, v: x.a.mac.c, note: !x.a.vide };
    });
    // Deux moitiés de mois comparées : c'est la seule façon de dire « ça monte »
    // sans faire une régression que personne ne pourrait relire.
    var mid = Math.floor(s.length / 2);
    var m1 = moyenneNote(s.slice(0, mid)), m2 = moyenneNote(s.slice(mid));
    var tend = (m1 === null || m2 === null) ? 'Pas encore assez de jours notés pour dégager une tendance.'
      : m2 > m1 + 3 ? 'Vos quinze derniers jours sont meilleurs que les quinze précédents (' + m1 + ' → ' + m2 + ').'
      : m2 < m1 - 3 ? 'Vos quinze derniers jours sont en retrait (' + m1 + ' → ' + m2 + '). Un seul critère à reprendre.'
      : 'Vous tenez le même niveau depuis un mois (' + m1 + ' → ' + m2 + ').';

    bloc({
      html: ill('courbe', 80)
        + titre('Sur un mois', 'p', 0.1)
        + courbeHTML(pts, S.profil.cible.c)
        + '<div class="sous" data-in style="animation-delay:.5s">' + esc(tend) + '</div>'
        + ressentiSemaineHTML(),
      pret: animerCourbe,
      boutons: [{ txt: 'Terminer', on: scSemFin }]
    });
  }

  function moyenneNote(l) {
    var v = l.filter(function (x) { return !x.a.vide && x.a.note !== null; }).map(function (x) { return x.a.note; });
    return v.length ? r0(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
  }

  /* Ce que la personne a répondu tous les soirs. C'est la seule partie du bilan
     hebdomadaire qui ne vient pas d'un calcul, et c'est celle qui a le plus de
     valeur : la difficulté qui revient est la difficulté à régler. */
  function ressentiSemaineHTML() {
    var r = reponses(7);
    if (!r.length) return '';
    var compte = function (champ) {
      var c = {};
      r.forEach(function (x) { var v = x.rep[champ]; if (v) c[v] = (c[v] || 0) + 1; });
      var k = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0];
      return k ? { v: k, n: c[k] } : null;
    };
    var mot = { temps: 'le temps de cuisiner', envies: 'les envies de sucré',
                quantite: 'manger assez', rien: 'rien de particulier',
                haute: 'à fond', stable: 'stable', basse: 'en baisse',
                oui: 'satisfait', moyen: 'mitigé', non: 'insatisfait' };
    var d = compte('difficulte'), m = compte('motivation');
    if (!d && !m) return '';
    return '<div class="note-est" data-in style="animation-delay:.7s">Vos réponses des '
      + r.length + ' derniers soirs : '
      + (m ? 'motivation le plus souvent <b>' + esc(mot[m.v] || m.v) + '</b> (' + m.n + '× sur ' + r.length + ')' : '')
      + (d && m ? ', et ' : '')
      + (d ? 'la difficulté qui revient, <b>' + esc(mot[d.v] || d.v) + '</b>' : '')
      + '.</div>';
  }

  function scSemFin() {
    enTete('');
    var moy = moyenneCriteres(S.sem);
    var faibles = moy.criteres.filter(function (c) { return c.note !== null; })
      .sort(function (a, b) { return a.note - b.note; });
    var f = faibles[0];
    var mot = f && f.note < 75
      ? 'La semaine qui vient : ' + f.nom.toLowerCase() + '. C’est le critère où vous avez le plus à gagner.'
      : 'Semaine tenue sur les quatre critères. La suivante peut viser un peu plus haut.';
    bloc({
      html: ill('trophee', 88)
        + titre('À la semaine prochaine', 'p', 0.15)
        + '<div class="sous" data-in style="animation-delay:.45s">' + esc(mot) + '</div>',
      boutons: [
        { txt: 'Planifier ma semaine', on: function () {
            fermer();
            // La suite naturelle d'un bilan de semaine, c'est la semaine
            // suivante — si le module est là. Sinon on ferme, sans promettre.
            if (window.NattyPlanning && NattyPlanning.ouvrir) setTimeout(function () { NattyPlanning.ouvrir(); }, 420);
            else if (window.Natty) Natty.goto('repas.html');
          } },
        { txt: 'Fermer', cls: 'b3', on: fermer }
      ]
    });
    /* ⚠️ Le bilan de la semaine marque AUSSI la journée comme faite. Sans ça,
       le samedi soir : la semaine s'ouvre (elle passe avant), `vusem` est
       écrit, `vu` ne l'est pas — et à la réouverture suivante de l'app, le même
       soir, le bilan du JOUR s'invitait dans la foulée. Deux plein écran de
       bilan à vingt minutes d'intervalle, dont le second redit ce que le
       premier vient de montrer.
       Ce que ça coûte, et c'est assumé : les trois questions du soir ne sont
       pas posées le samedi. Le récap de la semaine est ce qu'on vient chercher
       ce soir-là ; les greffer à une séquence déjà longue les ferait sauter
       pour de bon. Six réponses sur sept restent la matière de « ce qui
       revient » (`accordSemaine`). */
    ecrire(cle('vusem'), jourDe(lundiDe(new Date())));
    ecrire(cle('vu'), jourCourant());
  }

  /* ═══ 11. Ouverture et déclencheur ═══════════════════════ */

  var enCours = false;

  async function lancer(semaine) {
    if (enCours) return;
    enCours = true;
    try {
      if (!window.Natty || !Natty.USER_ID) return;
      await charger();
      var j = jourCourant();
      var a = analyserJour(cache.jours[j], cache.profil, j);
      var ctx = ctxSeance(j, journalise());
      S = {
        profil: cache.profil, a: a, corps: corpsDuJour(a, cache.profil, ctx),
        serie30: serie(JOURS_COURBE), sem: semaineEnCours(),
        seance: ctx.seance, rep: {}, q: 0, semaine: !!semaine
      };
      monter();
      if (semaine) scSemOuverture(); else scOuverture();
    } catch (e) {
      // Un bilan qui échoue ne doit pas laisser un calque noir en travers de
      // l'écran : on referme plutôt que d'afficher une séquence vide.
      if (racine) fermer();
    } finally { enCours = false; }
  }

  function ouvrir(opts) { return lancer(!!(opts && opts.semaine)); }

  /**
   * Le déclencheur des écrans porteurs de la nav.
   *
   * ⚠️ IL NE S'INVITE JAMAIS PAR-DESSUS UN AUTRE PLEIN ÉCRAN. La planification
   * de la semaine, la génération, l'ajout d'un plat et le guide du jour passent
   * avant : deux plein écran l'un sur l'autre ne se discutent pas. Et il attend
   * plus longtemps que `journee.js` (qui attend 6,5 s), parce que le guide du
   * jour est ce qui doit s'ouvrir en premier quand les deux sont dus.
   */
  function proposerSiNecessaire(delai) {
    if (!window.Natty || !Natty.USER_ID) return;
    var d = new Date();
    var samedi = d.getDay() === 6;
    var lundi = jourDe(lundiDe(d));

    // Le bilan de la SEMAINE, le samedi soir, une fois par semaine.
    var duSemaine = samedi && d.getHours() >= H_BILAN && lire(cle('vusem'), '') !== lundi;
    // Celui du JOUR, à partir de 21 h, une fois par jour.
    var duJour = d.getHours() >= H_BILAN && lire(cle('vu'), '') !== jourCourant();
    if (!duSemaine && !duJour) return;

    setTimeout(function () {
      // Même garde que le guide du jour et la planification, au même endroit
      // (`assets/core.js`) : trois listes tenues à la main, c'est trois listes
      // qui divergent — celle-ci ignorait les deux questions de la génération.
      if (Natty.ecranOccupe()) return;
      if (window.NattyGeneration && NattyGeneration.enCours && NattyGeneration.enCours()) return;
      lancer(duSemaine);
    }, delai == null ? 9000 : delai);
  }

  return {
    ouvrir: ouvrir, ouvrirJour: function () { return lancer(false); },
    ouvrirSemaine: function () { return lancer(true); },
    proposerSiNecessaire: proposerSiNecessaire,
    analyse: analyse, reponses: reponses,
    estOuvert: function () { return !!racine; },
    // Pour les bancs de test : la logique sans l'écran.
    _calc: { analyserJour: analyserJour, corpsDuJour: corpsDuJour, noteRatio: noteRatio }
  };
})();
