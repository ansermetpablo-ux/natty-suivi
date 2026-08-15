/* ═══════════════════════════════════════════════════════════
   Natty — Moteur de recommandation personnalisée
   ───────────────────────────────────────────────────────────
   Croise trois sources pour proposer des recettes qui vont dans
   le sens de l'objectif de l'utilisateur ET se démarquent de ce
   qu'il a déjà mangé cette semaine :

     1. onboarding        — objectif, macros cibles, temps de cuisine
     2. questionnaire_alim — allergies, régime, goûts (contrainte dure)
     3. meals + meal_ingredients — ce qui a réellement été mangé

   ⚠️ CE MODULE NE GÉNÈRE PLUS LA SEMAINE. Depuis août 2026, les
   conseils, les recettes et la liste de courses sont produits en
   un seul appel CÔTÉ SERVEUR (`api/_generation.js`, déclenché par
   `assets/generation.js`) : la réponse complète demande ~71 s, ce
   qui ne survit ni au changement d'écran ni au délai réseau d'une
   WebView. Voir le bloc « 5 bis » plus bas.

   Il reste donc deux choses ici :
     • `recommander(nb, contrainte)` — les tirages « Découvrir »,
       à la demande, via /api/claude ;
     • `recettesDeLaSemaine()` — LECTURE du cache
       `profil_conseils.conseils_json`, sans aucun appel à l'IA.

   Le garde-manger, quand `assets/garde-manger.js` est chargé, est
   injecté dans le prompt (section « INGRÉDIENTS DISPONIBLES ») et
   les recettes marquent alors ce qu'il reste à acheter. Pour la
   génération de la semaine, c'est `generation.js` qui le transmet
   au serveur — le serveur ne peut pas lire un localStorage.
   ═══════════════════════════════════════════════════════════ */
var NattyReco = (function () {

  /* Une WebView Capacitor sert les pages depuis capacitor://localhost : un
     chemin relatif « /api/… » n'y résout pas. Sur le web on reste relatif,
     pour ne dépendre d'aucun domaine. C'est cette seule différence qui
     justifiait deux copies divergentes de ce fichier — elles sont désormais
     identiques. */
  var API_BASE = (function () {
    var h = location.hostname, pr = location.protocol;
    // Relatif UNIQUEMENT quand la page est servie par le vrai déploiement web :
    // là, /api/... résout. Partout ailleurs — capacitor://localhost (iOS),
    // http://localhost (WebView Android), file:// — il faut l'URL absolue.
    // Tester seulement le protocole ne suffisait pas : Android est en http:,
    // l'appel repartait en relatif vers un hôte sans backend.
    var web = (pr === 'http:' || pr === 'https:')
      && h && h !== 'localhost' && h !== '127.0.0.1' && h !== '[::1]';
    return web ? '' : 'https://natty-suivi.vercel.app';
  })();


  /* ── 1. Collecte du profil ───────────────────────────────── */

  async function chargerProfil() {
    var uid = Natty.USER_ID;
    var out = { onboarding: null, questionnaire: null, semaine: [] };

    var res = await Promise.all([
      // Colonnes vérifiées sur l'instance : onboarding n'a ni `freins`, ni
      // `temps_cuisine`, ni `nb_repas` (contrairement à ce qu'indique
      // CLAUDE.md §4). L'objectif vit dans objectif_type/_valeur/_semaines.
      Natty.sbFetch('onboarding?user_id=eq.' + uid + '&order=created_at.desc&limit=1'
        + '&select=maturite,motivation,axe_amelioration,objectif_type,objectif_valeur,objectif_semaines,'
        + 'poids,taille,age,sexe,activite,bmr,tdee,deficit,contexte_repas,aliments_plaisir,aliments_refuses,allergies,regime,score_rigueur')
        .catch(function () { return []; }),
      Natty.sbFetch('questionnaire_alim?user_id=eq.' + uid + '&order=completed_at.desc&limit=1'
        // `decouverte_variantes` et `curiosite_libre` étaient enregistrés par le
        // questionnaire mais n'étaient DEMANDÉS nulle part : deux des quatre
        // familles d'envies et la phrase libre ne sont donc jamais arrivées
        // jusqu'au prompt. Elles sont éditables depuis `assets/preferences.js`,
        // il faut désormais qu'elles servent.
        + '&select=allergies,regime,aliments_aimes,aliments_evites,decouverte_cuisines,decouverte_styles,decouverte_ingredients,decouverte_variantes,curiosite_libre,frequence_cuisine,nb_repas,defi_principal')
        .catch(function () { return []; }),
      chargerSemaine(uid).catch(function () { return []; })
    ]);

    out.onboarding   = res[0] && res[0].length ? res[0][0] : null;
    out.questionnaire= res[1] && res[1].length ? res[1][0] : null;
    out.semaine      = res[2] || [];

    // Garde-manger : optionnel (le module n'est pas chargé sur tous les
    // écrans). Absent, les recettes sont proposées comme avant.
    out.garde = '';
    if (typeof NattyGardeManger !== 'undefined') {
      try { await NattyGardeManger.charger(); out.garde = NattyGardeManger.pourPrompt(); }
      catch (e) { out.garde = ''; }
    }

    // Matériel de cuisine : même contrat que le garde-manger — optionnel, et
    // sans lui les recettes sont proposées comme avant. Un tirage
    // « Découvrir » qui demande un four à quelqu'un qui n'en a pas est aussi
    // infaisable qu'une recette de la semaine ; il n'y a pas de raison que la
    // contrainte s'arrête à la génération hebdomadaire.
    out.materiel = '';
    if (typeof NattyMateriel !== 'undefined') {
      try { await NattyMateriel.charger(); out.materiel = NattyMateriel.pourPrompt(); }
      catch (e) { out.materiel = ''; }
    }
    return out;
  }

  // Repas des 7 derniers jours, avec leurs ingrédients.
  async function chargerSemaine(uid) {
    var d = new Date(); d.setDate(d.getDate() - 7);
    var depuis = d.toISOString();
    var meals = await Natty.sbFetch('meals?user_id=eq.' + uid
      + '&created_at=gte.' + depuis + '&order=created_at.desc&limit=40&select=id,name,created_at');
    if (!meals || !meals.length) return [];
    var avecIngs = await Promise.all(meals.map(async function (m) {
      try { m.ingredients = await Natty.sbFetch('meal_ingredients?meal_id=eq.' + m.id + '&select=name,quantity_g'); }
      catch (e) { m.ingredients = []; }
      return m;
    }));
    return avecIngs;
  }

  /* ── 2. Analyse : ce qui revient trop souvent ────────────── */

  // On compte les ingrédients de la semaine pour pouvoir demander
  // explicitement à l'IA de s'en écarter.
  function ingredientsRecurrents(semaine) {
    var compte = {};
    (semaine || []).forEach(function (m) {
      (m.ingredients || []).forEach(function (i) {
        var n = (i.name || '').toLowerCase().trim();
        if (n) compte[n] = (compte[n] || 0) + 1;
      });
    });
    return Object.keys(compte)
      .map(function (n) { return { nom: n, n: compte[n] }; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 12);
  }

  function macrosCibles(onb) {
    if (!onb) return null;
    var poids = onb.poids, tdee = onb.tdee;
    if (!poids || !tdee) return null;
    return {
      p: Math.round(poids * 2),
      l: Math.round(tdee * 0.25 / 9),
      g: Math.round(tdee * 0.5 / 4),
      kcal: Math.round(tdee)
    };
  }

  /* ── 3. Construction du prompt ───────────────────────────── */

  // Les champs de goûts sont hétérogènes en base : tantôt un tableau
  // (["vegan"]), tantôt un objet groupé par famille
  // ({"proteines":["Lentilles",…]}), tantôt null. On aplatit tout.
  function listeOuVide(v) {
    if (v === null || v === undefined || v === '') return 'aucune';
    if (Array.isArray(v)) return v.length ? v.join(', ') : 'aucune';
    if (typeof v === 'object') {
      var vals = [];
      Object.keys(v).forEach(function (k) {
        var x = v[k];
        if (Array.isArray(x)) vals = vals.concat(x);
        else if (x) vals.push(String(x));
      });
      return vals.length ? vals.join(', ') : 'aucune';
    }
    return String(v);
  }

  /* ⚠️ Ne sert plus QUE aux tirages « Découvrir » (recettes à la demande, avec
     une contrainte de mini-jeu). Le prompt de la semaine — celui qui produit
     aussi les six conseils — vit désormais dans `api/_generation.js`, côté
     serveur. Le schéma des recettes est le même dans les deux : toute
     modification ici doit y être répercutée, sinon `assets/recette.js` ne saura
     plus dessiner les étapes. */
  function construirePrompt(profil, nb, contrainte) {
    var onb = profil.onboarding || {};
    var q   = profil.questionnaire || {};
    var cibles = macrosCibles(onb);
    var recurrents = ingredientsRecurrents(profil.semaine);
    var platsSemaine = (profil.semaine || []).map(function (m) { return m.name; }).slice(0, 15);

    var p = "Tu es le nutritionniste de cet utilisateur. Propose-lui "
          + nb + " recettes pour les prochains repas.\n\n";

    p += "PROFIL\n";
    if (onb.age)      p += "- " + onb.age + " ans, " + (onb.sexe || '') + ", " + (onb.poids || '?') + " kg, " + (onb.taille || '?') + " cm\n";
    if (onb.activite) p += "- Activité : " + onb.activite + "\n";
    if (onb.objectif_type) {
      p += "- Objectif : " + onb.objectif_type;
      if (onb.objectif_valeur)   p += " (" + onb.objectif_valeur + ")";
      if (onb.objectif_semaines) p += " sur " + onb.objectif_semaines + " semaines";
      p += "\n";
    }
    if (onb.motivation) p += "- Motivation : " + onb.motivation + "\n";
    if (onb.axe_amelioration) p += "- Axe d'amélioration déclaré : " + onb.axe_amelioration + "\n";
    if (onb.contexte_repas)   p += "- Contexte des repas : " + listeOuVide(onb.contexte_repas) + "\n";
    if (cibles) p += "- Cibles journalières : " + cibles.kcal + " kcal, " + cibles.p + "g protéines, " + cibles.g + "g glucides, " + cibles.l + "g lipides\n";
    if (q.frequence_cuisine) p += "- Fréquence de cuisine : " + q.frequence_cuisine + "\n";
    if (q.nb_repas)          p += "- Nombre de repas par jour : " + q.nb_repas + "\n";

    // Les contraintes peuvent être saisies dans l'un ou l'autre formulaire :
    // on cumule les deux sources plutôt que d'en privilégier une.
    p += "\nCONTRAINTES ABSOLUES (ne jamais les enfreindre)\n";
    p += "- Allergies : " + listeOuVide(q.allergies || onb.allergies) + "\n";
    p += "- Régime : " + listeOuVide(q.regime || onb.regime) + "\n";
    p += "- Aliments évités : " + listeOuVide(q.aliments_evites || onb.aliments_refuses) + "\n";

    p += "\nGOÛTS\n";
    p += "- Aime : " + listeOuVide(q.aliments_aimes || onb.aliments_plaisir) + "\n";
    p += "- Curieux de : " + listeOuVide(q.decouverte_cuisines) + " / " + listeOuVide(q.decouverte_ingredients) + "\n";
    p += "- Styles et variantes souhaités : " + listeOuVide(q.decouverte_styles) + " / " + listeOuVide(q.decouverte_variantes) + "\n";
    // Écrite à la main par l'utilisateur : c'est la seule ligne du prompt qu'il
    // a formulée lui-même, elle passe donc telle quelle.
    if (q.curiosite_libre) p += "- Envie exprimée : " + q.curiosite_libre + "\n";
    if (q.defi_principal) p += "- Défi principal : " + q.defi_principal + "\n";

    p += "\nDÉJÀ MANGÉ CETTE SEMAINE (à ne PAS reproduire)\n";
    p += platsSemaine.length ? ("- Plats : " + platsSemaine.join(' | ') + "\n") : "- Aucun repas enregistré\n";
    if (recurrents.length) p += "- Ingrédients récurrents : " + recurrents.map(function (r) { return r.nom + ' (x' + r.n + ')'; }).join(', ') + "\n";

    if (profil.garde) {
      p += "\nINGRÉDIENTS DISPONIBLES (garde-manger de l'utilisateur)\n";
      p += "- " + profil.garde + "\n";
    }

    // Ce sont les ABSENCES qui contraignent : sans elles, le modèle suppose un
    // four, parce que la plupart des recettes en ont un. La phrase est composée
    // par `assets/materiel.js`, qui détient le catalogue.
    if (profil.materiel) {
      p += "\nÉQUIPEMENT DE CUISINE\n- " + profil.materiel + "\n";
    }

    if (contrainte) {
      p += "\nCONTRAINTE DU TIRAGE (impérative)\n- " + contrainte + "\n";
    }

    p += "\nRÈGLES\n";
    p += "1. Les recettes doivent servir l'objectif ci-dessus (répartition macro et calories).\n";
    p += "2. Elles doivent se DÉMARQUER de la semaine écoulée : change de source de protéines, de féculent, de légumes et de cuisine par rapport aux ingrédients récurrents listés.\n";
    p += "3. Allergies, régime et aliments évités sont bloquants, sans exception.\n";
    p += "   Si la liste des goûts contredit le régime (ex. régime vegan mais viande citée dans les aliments aimés), le RÉGIME l'emporte toujours : propose l'équivalent compatible, jamais l'aliment interdit.\n";
    p += "4. Respecte le temps de cuisine disponible.\n";
    p += "5. Écris en français, ton direct et concret (tutoiement).\n";
    // Numérotation continue : ce qui suit est conditionnel, et une liste qui
    // saute de 5 à 8 se lit comme une liste amputée.
    var nr = 6;
    if (profil.garde) {
      p += (nr++) + ". Pars des INGRÉDIENTS DISPONIBLES : chaque recette doit en utiliser plusieurs, et l'ensemble des recettes doit écouler ce stock en priorité. N'ajoute d'ingrédient absent de la liste que si la recette ne tient pas debout sans lui, et garde ces ajouts courants et peu nombreux.\n";
      p += (nr++) + ". Sur chaque ingrédient, mets \"dispo\":true s'il figure dans les INGRÉDIENTS DISPONIBLES, false s'il faut l'acheter.\n";
    }
    if (profil.materiel) {
      // Bloquant au même titre que les allergies : une recette qui demande un
      // appareil absent n'est pas moins bien adaptée, elle est infaisable.
      p += (nr++) + ". L'ÉQUIPEMENT est bloquant, comme les allergies : aucune étape ne doit demander un appareil qu'il n'a pas, et n'écris JAMAIS une étape dont \"illu\" est l'un des gestes impossibles listés.\n";
      p += (nr++) + ". Si le plat se prépare habituellement avec un appareil qu'il n'a pas, donne-en la VARIANTE réalisable chez lui (four → poêle, cocotte ou air fryer ; mixeur → écrasé à la fourchette) et dis-le dans le \"tip\" de l'étape concernée.\n";
    }

    /* ÉTAPES DÉTAILLÉES — les consignes ci-dessous existent parce que
       `assets/recette.js` en a besoin pour guider quelqu'un qui cuisine :
       - `illu` est une clé de sa bibliothèque de gestes ; le module dessine
         l'animation et y dépose l'aliment de l'étape. Il ne faut donc pas
         inventer de clé, mais choisir dans la liste imposée.
       - `duree_min` arme un vrai minuteur à l'écran.
       - `temp_c` : SEULEMENT les degrés. Le thermostat est calculé côté app
         (division par 30) — le demander à l'IA revenait à demander une
         division, avec le risque d'erreur en prime.
       - `qte` répète la quantité utilisée à CETTE étape : « 150 g » se lit
         devant la balance, pas en remontant la liste d'ingrédients. */
    p += "\nÉTAPES\n";
    p += "- 8 à 12 étapes par recette, UNE action par étape. Pas de \"préparer les ingrédients\" fourre-tout.\n";
    p += "- \"illu\" vaut EXACTEMENT une de ces clés : couper, saisir, bouillir, mijoter, enfourner, melanger, fouetter, mixer, assaisonner, huiler, rincer, peser, refrigerer, reposer, attendre, dresser.\n";
    p += "- \"detail\" donne des repères concrets et vérifiables : taille de coupe en cm, couleur attendue, texture, signe que c'est prêt.\n";
    p += "- \"duree_min\" est la durée de l'étape (0 si le geste est immédiat).\n";
    p += "- \"temp_c\" seulement pour une cuisson au four, en degrés Celsius. N'écris JAMAIS de thermostat, l'app le calcule.\n";
    p += "- \"feu\" vaut doux, moyen ou vif pour une cuisson à la poêle ou en casserole ; omets-le sinon.\n";
    p += "- \"qte\" liste les ingrédients utilisés à cette étape, avec leur quantité exacte.\n";

    var recette = '{"nom":"Nom du plat","pourquoi":"une phrase expliquant pourquoi ce plat pour LUI",'
      + '"avantages":"ce que ce plat apporte concrètement à SON objectif, une phrase",'
      + '"temps_min":25,"macros":{"p":42,"g":60,"l":18,"kcal":600},'
      + '"ingredients":[{"em":"🍗","nom":"Poulet","qte":"150 g","dispo":true}],'
      + '"steps":[{"illu":"couper","t":"Titre court de l\'étape","detail":"la consigne précise, avec les repères",'
      + '"qte":[{"nom":"Poulet","qte":"150 g"}],"duree_min":5,"temp_c":0,"feu":"","tip":"astuce facultative"}]}';

    p += "\nRéponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, au format :\n";
    p += '[' + recette + ']';

    return p;
  }

  /* ── 4. Génération ───────────────────────────────────────── */

  function extraireJson(txt) {
    if (!txt) return null;
    // L'IA encadre parfois le JSON de ``` ou d'une phrase.
    var t = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
    var i = t.indexOf('['), j = t.lastIndexOf(']');
    if (i === -1 || j === -1 || j < i) return null;
    try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { return null; }
  }

  async function appelerClaude(prompt, maxTokens) {
    var r = await fetch(API_BASE + '/api/claude', {
      method: 'POST',
      // `/api/claude` exige une session depuis août 2026 : c'était un proxy
      // ouvert vers l'API Anthropic payante.
      headers: await Natty.enTetesIA(),
      body: JSON.stringify({ prompt: prompt, max_tokens: maxTokens || 3000 })
    });
    if (!r.ok) throw new Error('api/claude ' + r.status);
    var d = await r.json();
    return d.text || '';
  }

  /**
   * Recommandations personnalisées.
   * @param {number} nb          nombre de recettes voulues
   * @param {string} contrainte  contrainte issue d'un mini-jeu (pays, ingrédient…)
   * @returns {Promise<Array>}   recettes, [] si indisponible (jamais d'exception)
   */
  async function recommander(nb, contrainte) {
    nb = nb || 4;
    try {
      var profil = await chargerProfil();
      /* Le plafond suit le nombre de recettes demandées. ⚠️ Chiffre MESURÉ, pas
         estimé : le 2026-08-04, deux recettes détaillées (ingrédients + 10
         étapes avec repères, quantités, durées) plus l'analyse ont produit
         12 511 caractères de JSON. L'ancien budget — 1300 jetons par recette —
         coupait donc la réponse en pleine étape ; `extraireJson` renvoyait null,
         cette fonction renvoyait [], et l'écran concluait « Échec, vérifiez
         votre connexion ». Un plafond n'est pas une cible : ce qui n'est pas
         produit n'est pas facturé.
         ⚠️ Reste à vérifier sur téléphone : à 3 recettes (le tirage
         « Découvrir »), la réponse demande ~100 s. La génération de la semaine,
         elle, a été déplacée côté serveur pour cette raison même — voir
         assets/generation.js. */
      var txt = await appelerClaude(construirePrompt(profil, nb, contrainte),
        Math.min(16000, 3200 * nb + 1600));
      var recettes = extraireJson(txt);
      if (!recettes || !recettes.length) return [];
      return recettes.slice(0, nb);
    } catch (e) {
      return [];
    }
  }

  /* ── 5. Cache (profil_conseils.conseils_json) ────────────── */

  function lundiCourant() {
    var d = new Date(), j = d.getDay();
    d.setDate(d.getDate() - j + (j === 0 ? -6 : 1));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /**
   * Le `conseils_json` de la semaine, entier, ou null s'il manque ou est périmé.
   *
   * ⚠️ `conseils_json` est une colonne TEXTE : PostgREST la rend en `string`, il
   * faut reparser (voir CLAUDE.md §7). Une seule génération écrit tout — les
   * recettes, les trois `plats_macro` et leurs « aliments à privilégier » — donc
   * tout écran qui veut autre chose que les recettes passe par ici plutôt que de
   * refaire sa propre requête et son propre parse.
   */
  async function jsonSemaine() {
    try {
      var rows = await Natty.sbFetch('profil_conseils?user_id=eq.' + Natty.USER_ID
        + '&order=generated_at.desc&limit=1&select=conseils_json,semaine');
      if (!rows || !rows.length) return null;
      var row = rows[0];
      if (row.semaine !== lundiCourant()) return null;      // périmé
      var j = row.conseils_json;
      if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return null; } }
      return j || null;
    } catch (e) { return null; }
  }

  async function lireCache() {
    var j = await jsonSemaine();
    return (j && j.recettes && j.recettes.length) ? j.recettes : null;
  }

  /**
   * Les aliments à privilégier de la semaine, aplatis et dédoublonnés.
   * Chaque `plats_macro[]` en porte 4 à 6 (voir api/_generation.js) ; l'écran
   * Coaching les montre tous ensemble, puisqu'il s'agit de faire ses courses et
   * non de lire une macro en particulier.
   * @returns {Array} [{em, nom, apport, macro}]
   */
  async function alimentsSemaine() {
    var j = await jsonSemaine();
    var plats = (j && Array.isArray(j.plats_macro)) ? j.plats_macro : [];
    var out = [];
    plats.forEach(function (p) {
      (Array.isArray(p && p.aliments) ? p.aliments : []).forEach(function (a) {
        if (!a || !a.nom) return;
        var n = String(a.nom).toLowerCase().trim();
        // Un même aliment peut servir deux macros (les œufs, le skyr) : on le
        // montre une fois, sinon la rangée se répète sans rien dire de plus.
        if (out.some(function (x) { return x.nom.toLowerCase().trim() === n; })) return;
        out.push({ em: a.em || '🛒', nom: String(a.nom), apport: a.apport || '', macro: p.macro || '' });
      });
    });
    return out;
  }

  /* ── 5 bis. La génération de la semaine a DÉMÉNAGÉ ────────
     Elle est côté serveur : `/api/generer-conseils`, cœur dans
     `api/_generation.js`, déclenchée et surveillée par `assets/generation.js`.

     Ce qui vivait ici — `genererTout()`, `genererSemaine()`,
     `enregistrerTout()`, `enregistrerSemaine()` — a été retiré, et ce n'est pas
     un déplacement cosmétique. Deux défauts mesurés le 2026-08-04 :
     • DURÉE : la réponse complète demande ~71 s. Depuis une page, l'appel meurt
       avec la page (changement d'écran, téléphone verrouillé) et se fait couper
       par le délai réseau de la WebView. Côté serveur, il aboutit même app
       fermée — c'est exactement ce que Pablo demandait (« les conseils et repas
       se chargent même si on quitte la page »).
     • DEUX SOURCES POUR UNE MÊME LIGNE : le cron du lundi écrivait
       `conseils_json` dans un schéma d'affichage SANS clé `recettes`, tandis
       qu'ici on écrivait `{recettes:[…]}`. `lireCache()` ne trouvait donc rien
       après un passage du cron, et l'écran Repas reproposait « Générer »
       indéfiniment. Un seul écrivain, un seul schéma.

     Ce module garde ce qui n'a pas de raison de partir : `recommander()` pour
     les tirages « Découvrir » (à la demande, avec contrainte) et la LECTURE du
     cache hebdomadaire ci-dessous, qui n'appelle jamais l'IA. */

  /* ── 6. Nombre de repas voulus pour la semaine ────────────
     Source de vérité : onboarding.nb_repas_semaine, donc partagée entre les
     appareils. localStorage sert de cache local, ce qui permet à nbRepas() de
     rester synchrone (les pages l'appellent au fil du rendu) et de fonctionner
     même si la requête échoue. La valeur réellement utilisée pour une
     génération reste par ailleurs consignée dans conseils_json.nb_repas. */

  /* Une seule génération par semaine, et elle produit 2 recettes par personne.
     Le réglage 1-7 a disparu de l'interface : les bornes restent égales pour
     que tous les appels existants convergent vers la même valeur.
     À 7 recettes complètes (ingrédients + étapes + avantages) plus l'analyse,
     la réponse frôlait la limite de tokens et le JSON revenait tronqué, donc
     inparsable — d'où l'erreur de génération. */
  var NB_SEMAINE = 2, NB_DEFAUT = 2, NB_MIN = 2, NB_MAX = 2;
  var nbCourant = null;   // renseigné par chargerNbRepas()

  function borner(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) return NB_DEFAUT;
    return Math.min(NB_MAX, Math.max(NB_MIN, n));
  }

  function cleLocale() { return 'natty_nb_repas_' + Natty.USER_ID; }

  function nbRepas() {
    if (nbCourant !== null) return nbCourant;
    try { return borner(localStorage.getItem(cleLocale()) || NB_DEFAUT); }
    catch (e) { return NB_DEFAUT; }
  }

  /**
   * Récupère la préférence en base et la met en cache.
   * À appeler une fois au chargement, avant de se fier à nbRepas().
   * Repli silencieux sur la valeur locale : hors ligne, l'écran reste utilisable.
   */
  async function chargerNbRepas() {
    try {
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + Natty.USER_ID
        + '&order=created_at.desc&limit=1&select=nb_repas_semaine');
      if (r && r.length && r[0].nb_repas_semaine != null) {
        nbCourant = borner(r[0].nb_repas_semaine);
        try { localStorage.setItem(cleLocale(), String(nbCourant)); } catch (e) {}
        return nbCourant;
      }
    } catch (e) {}
    nbCourant = nbRepas();
    return nbCourant;
  }

  var minuteurPatch = null;

  /* Ne rien écrire en base. onboarding.nb_repas_semaine est la colonne de
     L'ABONNEMENT (formule 3 ou 4 plats livrés par semaine) : y consigner un
     nombre de recettes écrasait la formule du client. Le nombre étant
     désormais fixé à 7, il n'y a plus rien à persister. */
  function ecrireNbEnBase() {
    if (minuteurPatch) { clearTimeout(minuteurPatch); minuteurPatch = null; }
  }

  /**
   * Le cache et localStorage sont mis à jour immédiatement pour que l'interface
   * réagisse sans attendre le réseau ; l'écriture en base est différée.
   * Ce report n'est pas cosmétique : sur - / + enchaînés, deux PATCH concurrents
   * peuvent se terminer dans le désordre et laisser une valeur périmée en base.
   * On ne garde donc que la dernière valeur, et on la force au départ de la page.
   */
  function setNbRepas(n) {
    var v = borner(n);
    nbCourant = v;
    try { localStorage.setItem(cleLocale(), String(v)); } catch (e) {}
    if (minuteurPatch) clearTimeout(minuteurPatch);
    minuteurPatch = setTimeout(ecrireNbEnBase, 400);
    return v;
  }

  // Quitter l'écran avant la fin du report ne doit pas perdre le réglage.
  window.addEventListener('pagehide', function () { if (minuteurPatch) ecrireNbEnBase(); });

  /**
   * Recettes de la semaine, depuis le cache uniquement.
   * Ne déclenche jamais d'appel IA : une seule génération par semaine, faite
   * en même temps que les conseils. Renvoie [] s'il n'y a rien pour la semaine
   * en cours — aux pages d'afficher un état vide et de proposer la génération.
   */
  async function recettesDeLaSemaine(nb) {
    var cache = await lireCache();
    if (!cache) return [];
    return cache.slice(0, borner(nb || nbRepas()));
  }

  return {
    chargerProfil: chargerProfil,
    ingredientsRecurrents: ingredientsRecurrents,
    macrosCibles: macrosCibles,
    construirePrompt: construirePrompt,
    recommander: recommander,
    recettesDeLaSemaine: recettesDeLaSemaine,
    NB_SEMAINE: NB_SEMAINE,
    nbRepas: nbRepas,
    chargerNbRepas: chargerNbRepas,
    setNbRepas: setNbRepas,
    NB_MIN: NB_MIN,
    NB_MAX: NB_MAX,
    lundiCourant: lundiCourant,
    jsonSemaine: jsonSemaine,
    alimentsSemaine: alimentsSemaine
  };
})();
