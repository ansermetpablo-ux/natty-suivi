/* ═══════════════════════════════════════════════════════════
   Natty — Moteur de recommandation personnalisée
   ───────────────────────────────────────────────────────────
   Croise trois sources pour proposer des recettes qui vont dans
   le sens de l'objectif de l'utilisateur ET se démarquent de ce
   qu'il a déjà mangé cette semaine :

     1. onboarding        — objectif, macros cibles, temps de cuisine
     2. questionnaire_alim — allergies, régime, goûts (contrainte dure)
     3. meals + meal_ingredients — ce qui a réellement été mangé

   La génération elle-même passe par /api/claude (proxy existant).
   Le résultat est mis en cache dans profil_conseils.conseils_json
   pour ne pas rappeler l'IA à chaque ouverture de page.

   ⚠️ Ne JAMAIS ajouter liste_courses_json / recettes_json à un
   SELECT sur profil_conseils : ces colonnes n'existent pas et la
   requête échoue en 400 (piège documenté dans CLAUDE.md §7).
   ═══════════════════════════════════════════════════════════ */
var NattyReco = (function () {

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
        + '&select=allergies,regime,aliments_aimes,aliments_evites,decouverte_cuisines,decouverte_styles,decouverte_ingredients,frequence_cuisine,nb_repas,defi_principal')
        .catch(function () { return []; }),
      chargerSemaine(uid).catch(function () { return []; })
    ]);

    out.onboarding   = res[0] && res[0].length ? res[0][0] : null;
    out.questionnaire= res[1] && res[1].length ? res[1][0] : null;
    out.semaine      = res[2] || [];
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

  function construirePrompt(profil, nb, contrainte) {
    var onb = profil.onboarding || {};
    var q   = profil.questionnaire || {};
    var cibles = macrosCibles(onb);
    var recurrents = ingredientsRecurrents(profil.semaine);
    var platsSemaine = (profil.semaine || []).map(function (m) { return m.name; }).slice(0, 15);

    var p = '';
    p += "Tu es le nutritionniste de cet utilisateur. Propose-lui " + nb + " recettes pour les prochains repas.\n\n";

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
    if (q.defi_principal) p += "- Défi principal : " + q.defi_principal + "\n";

    p += "\nDÉJÀ MANGÉ CETTE SEMAINE (à ne PAS reproduire)\n";
    p += platsSemaine.length ? ("- Plats : " + platsSemaine.join(' | ') + "\n") : "- Aucun repas enregistré\n";
    if (recurrents.length) p += "- Ingrédients récurrents : " + recurrents.map(function (r) { return r.nom + ' (x' + r.n + ')'; }).join(', ') + "\n";

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

    p += "\nRéponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, au format :\n";
    p += '[{"nom":"Nom du plat","pourquoi":"une phrase expliquant pourquoi ce plat pour LUI","temps_min":25,';
    p += '"macros":{"p":42,"g":60,"l":18,"kcal":600},';
    p += '"ingredients":[{"em":"🍗","nom":"Poulet","qte":"150 g"}],';
    p += '"steps":[{"em":"🔪","t":"Étape courte","tip":"astuce"}]}]';

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
    var r = await fetch('https://natty-suivi.vercel.app/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      var txt = await appelerClaude(construirePrompt(profil, nb, contrainte));
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

  async function lireCache() {
    try {
      var rows = await Natty.sbFetch('profil_conseils?user_id=eq.' + Natty.USER_ID
        + '&order=generated_at.desc&limit=1&select=conseils_json,semaine');
      if (!rows || !rows.length) return null;
      var row = rows[0];
      if (row.semaine !== lundiCourant()) return null;      // périmé
      var j = row.conseils_json;
      if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return null; } }
      return (j && j.recettes && j.recettes.length) ? j.recettes : null;
    } catch (e) { return null; }
  }

  /**
   * Écrit les recettes de la semaine dans profil_conseils.conseils_json.
   * Passe par /api/save-conseils, qui détient la service_role key et ne met à
   * jour que les champs transmis (les conseils déjà écrits ne sont pas touchés).
   */
  async function enregistrerSemaine(recettes, nb) {
    try {
      var r = await fetch('https://natty-suivi.vercel.app/api/save-conseils', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Natty.USER_ID,
          semaine: lundiCourant(),
          // conseils_json est une colonne texte : on y met du JSON sérialisé.
          // lireCache() reparse, et tolère aussi le cas jsonb.
          conseils_json: JSON.stringify({
            recettes: recettes, nb_repas: nb, genere_le: new Date().toISOString()
          })
        })
      });
      return r.ok;
    } catch (e) { return false; }
  }

  /* ── 6. Nombre de repas voulus pour la semaine ────────────
     Source de vérité : onboarding.nb_repas_semaine, donc partagée entre les
     appareils. localStorage sert de cache local, ce qui permet à nbRepas() de
     rester synchrone (les pages l'appellent au fil du rendu) et de fonctionner
     même si la requête échoue. La valeur réellement utilisée pour une
     génération reste par ailleurs consignée dans conseils_json.nb_repas. */

  var NB_DEFAUT = 4, NB_MIN = 1, NB_MAX = 7;
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

  function ecrireNbEnBase() {
    if (minuteurPatch) { clearTimeout(minuteurPatch); minuteurPatch = null; }
    if (nbCourant === null) return;
    Natty.sbPatch('onboarding?user_id=eq.' + Natty.USER_ID, { nb_repas_semaine: nbCourant })
      .catch(function () { /* la valeur locale fait foi jusqu'au prochain chargement */ });
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
   * Génère les recettes de la semaine ET les enregistre.
   * C'est le seul point qui appelle l'IA : les pages, elles, lisent le cache.
   */
  async function genererSemaine(nb) {
    nb = borner(nb || nbRepas());
    var recettes = await recommander(nb);
    if (!recettes || !recettes.length) return [];
    await enregistrerSemaine(recettes, nb);
    return recettes;
  }

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
    genererSemaine: genererSemaine,
    enregistrerSemaine: enregistrerSemaine,
    nbRepas: nbRepas,
    chargerNbRepas: chargerNbRepas,
    setNbRepas: setNbRepas,
    NB_MIN: NB_MIN,
    NB_MAX: NB_MAX,
    lundiCourant: lundiCourant
  };
})();
