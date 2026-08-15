// Génération hebdomadaire — le cœur, côté serveur, et UNE SEULE fois.
//
// Vercel ignore les fichiers d'api/ préfixés `_` : ce module n'est donc pas une
// route, seulement du code commun. Deux appelants :
//   • api/conseils-hebdo.js    — le cron du lundi, pour tout le monde ;
//   • api/generer-conseils.js  — la demande d'UNE personne, depuis l'app.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER A CHANGÉ DE NATURE (août 2026)
//
// Avant, il existait DEUX générations qui ne se parlaient pas :
//   1. celle-ci, côté serveur, qui écrivait 6 conseils + des recettes dans un
//      schéma d'affichage (`{emoji, nom, macros:{prot,gluc,lip,cal},
//      ingredients:["…"], etapes:["…"]}`) ;
//   2. `NattyReco.genererTout()`, côté navigateur, qui écrivait `conseils_json`
//      avec des recettes dans le schéma de l'app (`{nom, pourquoi, macros:{p,g,
//      l,kcal}, ingredients:[{em,nom,qte}], steps:[{illu,detail,duree_min…}]}`)
//      — le seul que `assets/recette.js` sache cuisiner.
// Résultat mesuré : la génération serveur remplissait `conseils_json` avec un
// objet SANS clé `recettes`, donc `NattyReco.lireCache()` renvoyait null, donc
// l'écran Repas se croyait vide et reproposait « Générer » indéfiniment.
//
// Et la génération navigateur, elle, mourait de deux morts :
//   • la page : un `fetch` lancé depuis un écran meurt avec l'écran — changer
//     d'onglet ou verrouiller le téléphone suffisait à tout perdre, en silence ;
//   • la durée : mesuré en prod le 2026-08-04, 2 recettes complètes + l'analyse
//     demandent ~56 s à l'API. On frôlait la limite de la fonction, d'où le
//     « Échec — vérifiez votre connexion » alors que la connexion allait bien.
//
// Donc : UN seul appel à Claude, ici, qui produit tout ce dont TOUS les écrans
// ont besoin, et UNE seule écriture qui remplit les quatre colonnes que ces
// écrans lisent. Les pages ne génèrent plus rien, jamais : elles relisent.
// ─────────────────────────────────────────────────────────────────────────────

/* ⚠️ UN SEUL endroit pour l'identifiant de modèle.
   Ce fichier appelait `claude-sonnet-4-6`, qui n'existe pas — alors que le
   proxy `api/claude.js`, lui, appelle `claude-sonnet-4-5` et répond 200
   (vérifié en prod). Un identifiant inconnu fait répondre une erreur à
   l'API : `claudeData.content?.[0]?.text` vaut alors `undefined`, le repli
   `'{}'` donne un objet vide, et la fonction lève « Empty Claude response ».
   Depuis la page, ça n'arrivait à l'utilisateur que sous la forme d'un
   « Échec » sans explication — et la ligne `profil_conseils` restait vide,
   ce qu'on a mesuré : conseils_json à 0 caractère. */
import { CATALOGUE, platParCle, listePourPrompt } from './_catalogue.js';

export const MODELE = 'claude-sonnet-4-5';

/* Nombre de recettes produites par la génération de la semaine.
   ⚠️ Ne pas augmenter sans mesurer : à 7 recettes complètes, la réponse frôlait
   la limite de jetons et revenait tronquée — donc inparsable, donc « échec ».
   La valeur doit rester alignée avec `NB_SEMAINE` d'assets/reco.js, qui borne
   ce que les écrans affichent. */
export const NB_RECETTES = 2;

/* Plafond de sortie. ⚠️ MESURÉ, pas estimé — et c'est LE défaut qui faisait
   répondre « Échec » à l'écran Repas. L'ancien budget (1300 jetons par recette
   + 800) donnait 3400 jetons pour deux recettes : la réponse était coupée en
   plein milieu du JSON, donc inparsable, donc « aucune recette » — sans qu'aucun
   message ne dise jamais que c'était une histoire de longueur. Vérifié le
   2026-08-04 sur le prompt réel : 3500 jetons → tronqué à la 2ᵉ recette ;
   8000 → JSON complet, en 52 s. Un plafond n'est pas une cible : ce qui n'est
   pas produit n'est pas facturé, donc large plutôt que juste. */
/* +1400 depuis que la génération produit AUSSI les trois plats macro de la
   planification (voir `plats_macro` plus bas). Ils sont bien plus courts qu'une
   recette — pas d'étapes — mais un plafond trop juste tronque le JSON entier,
   et c'est la fin de la réponse qui saute : on perdrait précisément ce qu'on
   vient d'ajouter. */
const MAX_TOKENS = 3200 * NB_RECETTES + 1600 + 1400;

/* ── Accès Supabase (clé service : ce module tourne côté serveur) ─────────── */

async function sbGet(SB_URL, SB_KEY, chemin) {
  const r = await fetch(`${SB_URL}/rest/v1/${chemin}`, {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
  });
  if (!r.ok) return [];
  try { return await r.json(); } catch (e) { return []; }
}

/* ── 1. Collecte du profil ───────────────────────────────────────────────────
   Mêmes sources que `NattyReco.chargerProfil()` côté navigateur : onboarding,
   questionnaire alimentaire, et les repas réellement enregistrés cette semaine.
   ⚠️ `onboarding` n'a ni `nb_repas`, ni `temps_cuisine`, ni `freins` : demander
   une colonne inexistante fait échouer TOUTE la requête (42703), pas seulement
   la colonne — et le profil retombe alors silencieusement sur ses valeurs par
   défaut. Le nombre de repas par jour vit dans `questionnaire_alim.nb_repas`. */
export async function collecterProfil(SB_URL, SB_KEY, uid, onboarding) {
  const out = { onboarding: onboarding || null, questionnaire: null, semaine: [], materiel: '' };

  /* Le matériel de cuisine (`natty_materiel.sql`). On lit `resume` et non
     `items` : la phrase est composée par `assets/materiel.js`, qui détient le
     catalogue, et la recopier ici en donnerait une seconde version à tenir à
     jour — le défaut exact d'`api/_nutrition.js`, qui a fini par annoncer
     d'autres macros que l'écran.
     ⚠️ C'est ce qui fait exister la contrainte pour le CRON DU LUNDI : il n'a
     pas de navigateur, donc pas de localStorage à interroger. Sans cette
     lecture, la génération automatique proposerait un gratin à quelqu'un sans
     four, là où la même génération lancée à la main l'éviterait.
     Table absente : `sbGet` rend [], et le prompt est celui d'avant. */
  try {
    const m = await sbGet(SB_URL, SB_KEY, `materiel?user_id=eq.${uid}&select=resume&limit=1`);
    if (Array.isArray(m) && m[0] && typeof m[0].resume === 'string') out.materiel = m[0].resume;
  } catch (e) { out.materiel = ''; }

  if (!out.onboarding) {
    const lignes = await sbGet(SB_URL, SB_KEY, `onboarding?user_id=eq.${uid}`
      + '&order=created_at.desc&limit=5'
      + '&select=prenom,email,maturite,motivation,axe_amelioration,objectif_type,objectif_valeur,'
      + 'objectif_semaines,poids,taille,age,sexe,activite,bmr,tdee,deficit,contexte_repas,'
      + 'aliments_plaisir,aliments_refuses,allergies,regime,score_rigueur');
    // ⚠️ `onboarding` contient de vrais doublons pour un même user_id, dont des
    // lignes sans poids ni tdee : un `limit=1` en attrape une au hasard et la
    // génération repart sur 70 kg / 2000 kcal. On prend la première exploitable.
    const l = Array.isArray(lignes) ? lignes : [];
    out.onboarding = l.find(x => x && x.tdee && x.poids) || l[0] || null;
  }

  const q = await sbGet(SB_URL, SB_KEY, `questionnaire_alim?user_id=eq.${uid}`
    + '&order=completed_at.desc&limit=1'
    // `decouverte_variantes` et `curiosite_libre` étaient écrites par le
    // questionnaire et demandées nulle part : deux des quatre familles d'envies
    // et la phrase que l'utilisateur a formulée lui-même n'arrivaient jamais
    // jusqu'au prompt. Elles sont modifiables depuis `assets/preferences.js`,
    // c'est ici qu'elles doivent produire un effet.
    + '&select=allergies,regime,aliments_aimes,aliments_evites,decouverte_cuisines,'
    + 'decouverte_styles,decouverte_ingredients,decouverte_variantes,curiosite_libre,'
    + 'frequence_cuisine,nb_repas,defi_principal');
  out.questionnaire = (Array.isArray(q) && q.length) ? q[0] : null;

  const d = new Date(); d.setDate(d.getDate() - 7);
  const meals = await sbGet(SB_URL, SB_KEY, `meals?user_id=eq.${uid}`
    + `&created_at=gte.${d.toISOString()}&order=created_at.desc&limit=40&select=id,name,created_at`);
  const liste = Array.isArray(meals) ? meals : [];
  if (liste.length) {
    // Un seul aller-retour pour tous les ingrédients : 40 requêtes séparées
    // coûteraient plus de temps que l'appel à Claude lui-même.
    const ids = liste.map(m => m.id).filter(Boolean);
    const ings = await sbGet(SB_URL, SB_KEY,
      `meal_ingredients?meal_id=in.(${ids.join(',')})&select=meal_id,name,quantity_g&limit=400`);
    const par = {};
    (Array.isArray(ings) ? ings : []).forEach(i => {
      (par[i.meal_id] = par[i.meal_id] || []).push(i);
    });
    liste.forEach(m => { m.ingredients = par[m.id] || []; });
  }
  out.semaine = liste;
  return out;
}

/* ── 2. Le prompt ────────────────────────────────────────────────────────────
   Copie assumée de `construirePrompt()` d'assets/reco.js : le navigateur ne
   peut pas importer un module Node, et l'inverse est vrai aussi (reco.js est
   une IIFE qui suppose `Natty`). La génération de la semaine, elle, n'existe
   plus QUE ici — reco.js ne garde son prompt que pour « Découvrir » (recettes
   à la demande, avec une contrainte de mini-jeu). Toute modification du schéma
   des recettes doit donc être répercutée dans les deux, faute de quoi
   `assets/recette.js` ne saura plus dessiner les étapes.                     */

function listeOuVide(v) {
  if (v === null || v === undefined || v === '') return 'aucune';
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'aucune';
  if (typeof v === 'object') {
    let vals = [];
    Object.keys(v).forEach(k => {
      const x = v[k];
      if (Array.isArray(x)) vals = vals.concat(x);
      else if (x) vals.push(String(x));
    });
    return vals.length ? vals.join(', ') : 'aucune';
  }
  return String(v);
}

function ingredientsRecurrents(semaine) {
  const compte = {};
  (semaine || []).forEach(m => (m.ingredients || []).forEach(i => {
    const n = (i.name || '').toLowerCase().trim();
    if (n) compte[n] = (compte[n] || 0) + 1;
  }));
  return Object.keys(compte)
    .map(n => ({ nom: n, n: compte[n] }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
}

export function macrosCibles(onb) {
  const poids = parseFloat(onb && onb.poids) || 70;
  const tdee = parseFloat(onb && onb.tdee) || 2000;
  return {
    p: Math.round(poids * 2),
    l: Math.round(tdee * 0.25 / 9),
    g: Math.round(tdee * 0.5 / 4),
    kcal: Math.round(tdee)
  };
}

export function construirePrompt(profil, nb, garde) {
  const onb = profil.onboarding || {};
  const q = profil.questionnaire || {};
  const cibles = macrosCibles(onb);
  const recurrents = ingredientsRecurrents(profil.semaine);
  const platsSemaine = (profil.semaine || []).map(m => m.name).filter(Boolean).slice(0, 15);

  let p = "Tu es le nutritionniste de cet utilisateur. Produis d'un seul coup son programme de la semaine : "
        + nb + " recettes ET son analyse nutritionnelle.\n\n";

  p += 'PROFIL\n';
  if (onb.age) p += '- ' + onb.age + ' ans, ' + (onb.sexe || '') + ', ' + (onb.poids || '?') + ' kg, ' + (onb.taille || '?') + ' cm\n';
  if (onb.activite) p += '- Activité : ' + onb.activite + '\n';
  if (onb.objectif_type) {
    p += '- Objectif : ' + onb.objectif_type;
    if (onb.objectif_valeur) p += ' (' + onb.objectif_valeur + ')';
    if (onb.objectif_semaines) p += ' sur ' + onb.objectif_semaines + ' semaines';
    p += '\n';
  }
  if (onb.motivation) p += '- Motivation : ' + onb.motivation + '\n';
  if (onb.axe_amelioration) p += "- Axe d'amélioration déclaré : " + onb.axe_amelioration + '\n';
  if (onb.contexte_repas) p += '- Contexte des repas : ' + listeOuVide(onb.contexte_repas) + '\n';
  p += '- Cibles journalières : ' + cibles.kcal + ' kcal, ' + cibles.p + 'g protéines, '
     + cibles.g + 'g glucides, ' + cibles.l + 'g lipides\n';
  if (q.frequence_cuisine) p += '- Fréquence de cuisine : ' + q.frequence_cuisine + '\n';
  if (q.nb_repas) p += '- Nombre de repas par jour : ' + q.nb_repas + '\n';

  p += '\nCONTRAINTES ABSOLUES (ne jamais les enfreindre)\n';
  p += '- Allergies : ' + listeOuVide(q.allergies || onb.allergies) + '\n';
  p += '- Régime : ' + listeOuVide(q.regime || onb.regime) + '\n';
  p += '- Aliments évités : ' + listeOuVide(q.aliments_evites || onb.aliments_refuses) + '\n';

  p += '\nGOÛTS\n';
  p += '- Aime : ' + listeOuVide(q.aliments_aimes || onb.aliments_plaisir) + '\n';
  p += '- Curieux de : ' + listeOuVide(q.decouverte_cuisines) + ' / ' + listeOuVide(q.decouverte_ingredients) + '\n';
  p += '- Styles et variantes souhaités : ' + listeOuVide(q.decouverte_styles) + ' / ' + listeOuVide(q.decouverte_variantes) + '\n';
  if (q.curiosite_libre) p += '- Envie exprimée : ' + q.curiosite_libre + '\n';
  if (q.defi_principal) p += '- Défi principal : ' + q.defi_principal + '\n';

  p += '\nDÉJÀ MANGÉ CETTE SEMAINE (à ne PAS reproduire)\n';
  p += platsSemaine.length ? ('- Plats : ' + platsSemaine.join(' | ') + '\n') : '- Aucun repas enregistré\n';
  if (recurrents.length) {
    p += '- Ingrédients récurrents : '
       + recurrents.map(r => r.nom + ' (x' + r.n + ')').join(', ') + '\n';
  }

  // Le garde-manger vit dans le localStorage de l'appareil (la table
  // `garde_manger` n'existe pas encore) : le serveur ne peut pas le lire, c'est
  // donc la page qui le transmet dans le corps de la requête. Absent — cas du
  // cron du lundi — les recettes sont proposées comme avant.
  if (garde) {
    p += "\nINGRÉDIENTS DISPONIBLES (garde-manger de l'utilisateur)\n- " + garde + '\n';
  }

  /* ÉQUIPEMENT — répondu une fois, à la première génération
     (`assets/materiel.js`). La phrase arrive toute faite : elle nomme ce qu'il
     a, ce qu'il n'a PAS, et les clés `illu` devenues impossibles.
     ⚠️ Ce sont les ABSENCES qui portent l'information. Ne lister que ce qu'il
     possède laisserait le modèle libre de supposer le reste — et il suppose un
     four, parce que la plupart des recettes en ont un. Absent (jamais
     répondu), rien n'est écrit et le prompt est celui d'avant : une question
     sans réponse ne doit rien contraindre. */
  const materiel = profil.materiel || '';
  if (materiel) {
    p += '\nÉQUIPEMENT DE CUISINE\n- ' + materiel + '\n';
  }

  /* ⚠️ LES RECETTES SE CHOISISSENT DANS LE CATALOGUE, elles ne s'inventent
     plus. Raison directe : chaque plat du catalogue a une photo (ou une
     illustration), alors qu'un nom inventé n'en a aucune — `repas.html` et
     `assets/planning.js` retombaient donc sur deux photos de démo qu'ils
     faisaient tourner, et la même image revenait tous les deux plats. Le
     modèle ne rend plus un nom libre mais une CLÉ, et l'app sait quoi
     afficher.
     Ce que ça ne change pas : les grammages, les étapes et les macros restent
     produits pour LUI. Le catalogue donne l'identité du plat, la génération
     donne son exécution — c'est aussi ce qui manquait à ces plats, qui
     n'avaient « ni étapes, ni grammages, donc pas de macros » (CLAUDE.md §3). */
  p += '\nCATALOGUE DES PLATS (choisis dedans, une ligne par plat : cle | nom (pays) | ingrédients)\n';
  p += listePourPrompt() + '\n';

  p += '\nRÈGLES\n';
  p += '0. Chaque recette est un plat DU CATALOGUE ci-dessus. Recopie sa "cle" exactement. N\'invente jamais de plat ni de clé : un plat hors catalogue est rejeté.\n';
  p += "1. Les recettes doivent servir l'objectif ci-dessus (répartition macro et calories).\n";
  p += '2. Elles doivent se DÉMARQUER de la semaine écoulée : change de source de protéines, de féculent, de légumes et de cuisine par rapport aux ingrédients récurrents listés.\n';
  p += '3. Allergies, régime et aliments évités sont bloquants, sans exception.\n';
  p += "   Si la liste des goûts contredit le régime (ex. régime vegan mais viande citée dans les aliments aimés), le RÉGIME l'emporte toujours : propose l'équivalent compatible, jamais l'aliment interdit.\n";
  p += '4. Respecte le temps de cuisine disponible.\n';
  p += '5. Écris en français, ton direct et concret (tutoiement).\n';
  /* Numérotation continue : les règles qui suivent sont conditionnelles, et
     une liste qui saute de 5 à 8 se lit comme une liste amputée. */
  let nr = 6;
  if (garde) {
    p += (nr++) + ". Pars des INGRÉDIENTS DISPONIBLES : chaque recette doit en utiliser plusieurs, et l'ensemble des recettes doit écouler ce stock en priorité. N'ajoute d'ingrédient absent de la liste que si la recette ne tient pas debout sans lui, et garde ces ajouts courants et peu nombreux.\n";
    p += (nr++) + '. Sur chaque ingrédient, mets "dispo":true s\'il figure dans les INGRÉDIENTS DISPONIBLES, false s\'il faut l\'acheter.\n';
  }
  if (materiel) {
    /* Bloquant au même titre que les allergies, et pour la même raison : une
       recette qui demande un appareil absent n'est pas « moins bien adaptée »,
       elle est infaisable — donc sautée, donc un repas de moins dans la
       semaine, sans que rien à l'écran ne l'explique. */
    p += (nr++) + ". L'ÉQUIPEMENT est bloquant, comme les allergies : aucune étape ne doit demander un appareil qu'il n'a pas, et n'écris JAMAIS une étape dont \"illu\" est l'un des gestes impossibles listés.\n";
    p += (nr++) + ". Si le plat du catalogue se prépare habituellement avec un appareil qu'il n'a pas, ne le remplace pas par un autre plat : donne-en la VARIANTE réalisable chez lui (four → poêle, cocotte ou air fryer ; mixeur → écrasé à la fourchette ; etc.), et dis-le en une phrase dans le \"tip\" de l'étape concernée, pour qu'il comprenne que c'est un choix et pas une approximation.\n";
    p += (nr++) + ". Si aucune variante honnête n'existe, choisis un autre plat du catalogue plutôt que de proposer une recette qu'il ne peut pas faire.\n";
    /* Condition portée par la PHRASE et non par un `if` : le serveur ne reçoit
       que le résumé, pas les clés du catalogue — tester « a-t-il une balance »
       ici demanderait de fouiller une chaîne de texte, ce qui casserait au
       premier libellé retouché. Le modèle, lui, a le bloc ÉQUIPEMENT sous les
       yeux et résout la condition tout seul. */
    p += (nr++) + ". S'il n'a PAS de balance de cuisine, double chaque quantité d'un repère mesurable sans peser (cuillères, verre, pièce, moitié de paquet) dans le \"detail\" de l'étape.\n";
  }

  /* ÉTAPES DÉTAILLÉES — ces consignes existent parce qu'`assets/recette.js` en
     a besoin pour guider quelqu'un qui cuisine : `illu` est une clé de sa
     bibliothèque de gestes (une clé inventée retombe sur « melanger »),
     `duree_min` arme un vrai minuteur, et `temp_c` ne porte QUE les degrés —
     le thermostat est calculé côté app (division par 30), le demander à l'IA
     revenait à demander une division, avec le risque d'erreur en prime. */
  p += '\nÉTAPES\n';
  p += '- 8 à 12 étapes par recette, UNE action par étape. Pas de "préparer les ingrédients" fourre-tout.\n';
  p += '- "illu" vaut EXACTEMENT une de ces clés : couper, saisir, bouillir, mijoter, enfourner, melanger, fouetter, mixer, assaisonner, huiler, rincer, peser, refrigerer, reposer, attendre, dresser.\n';
  p += '- "detail" donne des repères concrets et vérifiables : taille de coupe en cm, couleur attendue, texture, signe que c\'est prêt.\n';
  p += '- "duree_min" est la durée de l\'étape (0 si le geste est immédiat).\n';
  p += '- "temp_c" seulement pour une cuisson au four, en degrés Celsius. N\'écris JAMAIS de thermostat, l\'app le calcule.\n';
  p += '- "feu" vaut doux, moyen ou vif pour une cuisson à la poêle ou en casserole ; omets-le sinon.\n';
  p += '- "qte" liste les ingrédients utilisés à cette étape, avec leur quantité exacte.\n';

  /* TROIS PLATS MACRO — la matière de la planification de la semaine
     (`assets/planning.js`). Ils sont demandés ICI, dans le même appel que les
     conseils, parce que ce sont les mêmes : un plat « protéines » n'a de sens
     que s'il découle du conseil protéines qu'on vient d'écrire. Les demander à
     part, c'était deux appels, deux factures, et deux avis qui pouvaient se
     contredire sur la même semaine. */
  p += '\nTROIS PLATS MACRO\n';
  p += '- En plus des recettes, propose EXACTEMENT trois plats, un par macronutriment, dans cet ordre : "p" (protéines), "g" (glucides), "l" (lipides).\n';
  p += '- Chacun corrige SA macro sans faire exploser les deux autres, se prépare en moins de 30 minutes, et reste courant en France.\n';
  if (materiel) {
    // Ils n'ont pas d'étapes détaillées, donc rien ne rattraperait un appareil
    // manquant à la lecture : c'est ici, au choix du plat, que ça se joue.
    p += "- Ils se préparent AVEC SON ÉQUIPEMENT, sans exception : un plat qui suppose un appareil qu'il n'a pas est à remplacer par un autre.\n";
  }
  p += "- Ils prolongent les conseils ci-dessus : le plat \"p\" doit répondre au conseil protéines, et ainsi de suite.\n";
  p += '- Ils seront PLACÉS dans la semaine là où ses apports flanchent. Ils sont donc plus simples que les recettes : pas d\'étapes détaillées.\n';
  p += '- Ils doivent différer des ' + nb + ' recettes ci-dessus.\n';
  /* Comme les recettes : une CLÉ du catalogue, donc une vraie image. Sans
     elle, ces trois plats étaient les seuls du calendrier à n'avoir qu'un
     emoji, au milieu de plats photographiés. */
  p += '- Chacun est lui aussi un plat DU CATALOGUE : donne sa "cle" exacte. Choisis celui qui corrige le mieux la macro concernée.\n';
  p += '- Joins à chaque plat 4 à 6 ALIMENTS À PRIVILÉGIER pour cette macro : des aliments simples, '
     + 'achetables tels quels, compatibles avec son régime et ses goûts, avec pour chacun sa teneur '
     + 'pour 100 g dans la macro concernée. Ce sont eux qu\'il ajoutera à sa liste de courses.\n';

  p += '\nLes conseils portent sur SES repas réels et SES préférences, jamais de généralité.\n';
  p += '\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :\n';
  p += '{"conseils":{"conseil_prot":"phrase courte","conseil_gluc":"phrase courte",'
     + '"conseil_lip":"phrase courte","conseil_cal":"phrase courte",'
     + '"conseil_amelioration":"1-2 phrases","conseil_points_forts":"1-2 phrases"},';
  p += '"recettes":[{"cle":"la-cle-du-catalogue","nom":"Nom du plat","pourquoi":"une phrase expliquant pourquoi ce plat pour LUI",'
     + '"avantages":"ce que ce plat apporte concrètement à SON objectif, une phrase",'
     + '"temps_min":25,"macros":{"p":42,"g":60,"l":18,"kcal":600},'
     + '"ingredients":[{"em":"🍗","nom":"Poulet","qte":"150 g","dispo":true}],'
     + '"steps":[{"illu":"couper","t":"Titre court de l\'étape","detail":"la consigne précise, avec les repères",'
     + '"qte":[{"nom":"Poulet","qte":"150 g"}],"duree_min":5,"temp_c":0,"feu":"","tip":"astuce facultative"}]}],';
  p += '"plats_macro":[{"macro":"p","cle":"la-cle-du-catalogue","nom":"Nom du plat","em":"🍗",'
     + '"pourquoi":"une phrase, adressée à lui, qui dit ce que ce plat corrige",'
     + '"p":45,"g":40,"l":12,"kcal":450,'
     + '"ingredients":[{"em":"🍗","nom":"Poulet","qte":"150 g"}],'
     + '"aliments":[{"em":"🥚","nom":"Œufs","apport":"13 g de protéines / 100 g"}]}]}';

  return p;
}

/* ── 3. Lecture de la réponse ────────────────────────────────────────────── */

export function extraireObjet(txt) {
  if (!txt) return null;
  const t = String(txt).replace(/```json/gi, '').replace(/```/g, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i === -1 || j === -1 || j < i) return null;
  try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { return null; }
}

/* ── 4. Les deux vues dérivées, pour que RIEN ne régénère ─────────────────── */

/* `profil_conseils.recettes_json` alimente l'overlay « Mes recettes » de
   suivi.html, écrit bien avant `assets/recette.js` et donc dans un autre
   schéma : emoji, macros nommées en clair, ingrédients et étapes en simples
   chaînes. On le dérive au lieu de le redemander à l'IA — sinon deux textes
   différents décriraient le même plat, et l'écran qui affiche le second
   donnerait l'impression que la génération a « changé d'avis ». */
/* Chaque recette est-elle bien un plat du catalogue ? On ne fait pas
   confiance à la clé rendue : le modèle peut en inventer une, ou renvoyer le
   bon plat sans clé du tout.
   ⚠️ UNE CLÉ INCONNUE EST EFFACÉE, PAS DEVINÉE. La tentation serait de
   rapprocher par le nom — mais « Saumon rôti » tomberait sur
   `jap-saumon-teriyaki`, un autre plat d'une autre cuisine, et l'écran
   afficherait la photo du mauvais plat. C'est exactement le mensonge que ce
   chantier corrige : sans clé, la recette garde son nom et l'app retombera
   sur l'illustration, ce qui est un manque visible et non une erreur muette.
   Le rapprochement n'est tenté que sur une correspondance EXACTE de nom, où
   il n'y a rien à deviner. */
export function ancrerAuCatalogue(recettes) {
  const parNom = {};
  CATALOGUE.forEach(p => { parNom[p.n.toLowerCase()] = p.cle; });
  return (recettes || []).map(r => {
    if (!r) return r;
    let cle = typeof r.cle === 'string' ? r.cle.trim() : '';
    if (cle && !platParCle(cle)) cle = '';                       // inventée
    if (!cle) cle = parNom[String(r.nom || '').trim().toLowerCase()] || '';
    const p = cle ? platParCle(cle) : null;
    // Le nom du catalogue fait foi quand la clé est bonne : deux libellés pour
    // le même plat le feraient passer pour deux plats différents d'un écran à
    // l'autre (le fil, la planification, la liste de courses).
    return Object.assign({}, r, { cle: cle || null, nom: p ? p.n : (r.nom || 'Recette') });
  });
}

export function versAffichage(recettes) {
  const EM = ['🍛', '🐟', '🍲', '🥗', '🍝', '🍜'];
  return (recettes || []).map((r, i) => {
    const m = r.macros || {};
    return {
      emoji: EM[i % EM.length],
      // La clé suit jusque dans le schéma d'affichage : c'est elle qui donne
      // sa photo au plat, et l'overlay « Mes recettes » de suivi.html lit
      // cette forme-là et pas `conseils_json.recettes`.
      cle: r.cle || null,
      nom: r.nom || 'Recette',
      macros: {
        prot: Math.round(m.p || 0), gluc: Math.round(m.g || 0),
        lip: Math.round(m.l || 0), cal: Math.round(m.kcal || 0)
      },
      ingredients: (r.ingredients || []).map(x => {
        const nom = x && (x.nom || x.name) || '';
        const qte = x && x.qte ? ' ' + x.qte : '';
        return (nom + qte).trim();
      }).filter(Boolean),
      etapes: (r.steps || []).map(s => {
        const t = (s && s.t) || '';
        const d = (s && s.detail) || '';
        return t && d ? (t + ' — ' + d) : (t || d);
      }).filter(Boolean)
    };
  });
}

/* Liste de courses : AGRÉGÉE depuis les recettes, jamais demandée à l'IA.
   C'est la même règle que la liste de coaching.html — dérivée, donc jamais
   désynchronisée des recettes affichées, et sans second appel à payer. */
export function listeDeCourses(recettes) {
  const par = {};
  (recettes || []).forEach(r => {
    (r.ingredients || []).forEach(x => {
      const nom = ((x && (x.nom || x.name)) || '').trim();
      if (!nom) return;
      const cle = nom.toLowerCase();
      if (!par[cle]) par[cle] = { emoji: (x && x.em) || '🛒', nom, qtes: [], plats: [] };
      if (x.qte) par[cle].qtes.push(String(x.qte));
      if (r.nom && par[cle].plats.indexOf(r.nom) === -1) par[cle].plats.push(r.nom);
    });
  });

  const items = Object.keys(par).map(cle => {
    const it = par[cle];
    // Somme quand toutes les quantités partagent la même unité ; juxtaposition
    // sinon — additionner « 2 c. à s. » et « 150 g » donnerait un total faux.
    const parsees = it.qtes.map(q => {
      const m = String(q).match(/^\s*([\d.,]+)\s*(.*)$/);
      return m ? { n: parseFloat(m[1].replace(',', '.')), u: (m[2] || '').trim() } : null;
    });
    let qte;
    const sommables = parsees.length && parsees.every(p => p && !isNaN(p.n))
      && parsees.every(p => p.u === parsees[0].u);
    if (sommables) {
      const total = parsees.reduce((s, p) => s + p.n, 0);
      const arrondi = Math.round(total * 100) / 100;
      qte = arrondi + (parsees[0].u ? ' ' + parsees[0].u : '');
    } else {
      qte = it.qtes.filter((v, i, a) => a.indexOf(v) === i).join(' + ');
    }
    return {
      emoji: it.emoji, nom: it.nom, quantite: qte,
      raison: it.plats.length ? ('Pour ' + it.plats.join(' et ')) : ''
    };
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  // `aliments_bonus` restait vide dans la moitié des générations : l'overlay
  // gère l'absence, on ne fabrique donc pas une section creuse.
  return { recettes_ingredients: items, aliments_bonus: [] };
}

/* Les trois plats macro, remis dans l'ordre p → g → l et débarrassés de ce que
   l'IA aurait pu inventer autour. `assets/planning.js` se fie à cet ordre : il
   pioche `plats[0]` pour les protéines, `plats[1]` pour les glucides, etc.
   Une réponse incomplète ne fait pas échouer la génération — la planification a
   son propre trio de repli, et perdre six conseils et deux recettes pour un
   plat manquant serait absurde. */
export function normaliserPlatsMacro(liste) {
  if (!Array.isArray(liste) || !liste.length) return [];
  const em = { p: '🥩', g: '🌾', l: '🥑' };
  return ['p', 'g', 'l'].map((m, k) => {
    const t = liste.find(x => x && x.macro === m) || liste[k];
    if (!t || !t.nom) return null;
    /* Même ancrage que les recettes : clé inconnue EFFACÉE et jamais devinée
       — le plat gardera son emoji, ce qui est un manque visible, plutôt que la
       photo d'un plat voisin, qui serait un mensonge. */
    const cle = (typeof t.cle === 'string' && platParCle(t.cle.trim())) ? t.cle.trim() : null;
    const fiche = cle ? platParCle(cle) : null;
    return {
      macro: m,
      cle: cle,
      nom: fiche ? fiche.n : String(t.nom),
      em: t.em || em[m],
      pourquoi: t.pourquoi || '',
      p: Math.round(+t.p || 0), g: Math.round(+t.g || 0),
      l: Math.round(+t.l || 0), kcal: Math.round(+t.kcal || 0),
      ingredients: Array.isArray(t.ingredients) ? t.ingredients : [],
      // Les aliments à privilégier pour CETTE macro — ce que l'écran Suivi
      // affiche sous le plat, et que l'utilisateur ajoute à sa liste de courses.
      aliments: (Array.isArray(t.aliments) ? t.aliments : [])
        .filter(x => x && (x.nom || x.name))
        .slice(0, 6)
        .map(x => ({ em: x.em || '🛒', nom: String(x.nom || x.name), apport: x.apport || '' }))
    };
  }).filter(Boolean);
}

/* ── 5. La génération, de bout en bout ───────────────────────────────────── */

/**
 * @param {object} user      ligne onboarding (au minimum {user_id})
 * @param {string} semaine   lundi de la semaine, 'YYYY-MM-DD'
 * @param {boolean} forcer   ignore le « déjà fait cette semaine »
 * @param {string} garde     garde-manger transmis par la page (facultatif)
 * @param {string} materiel  matériel de cuisine transmis par la page (facultatif ;
 *                           à défaut, il est lu dans la table `materiel`)
 * @returns {Promise<{recettes:number}|null>} null si rien n'était à faire
 */
export async function processUser(user, semaine, SB_URL, SB_KEY, CLAUDE_API, CLAUDE_KEY, forcer, garde, materiel) {
  // Déjà fait cette semaine ? Le cron passe son chemin.
  // ⚠️ `forcer` existe pour la demande explicite depuis l'app : sans lui, le
  // bouton « Générer mes conseils » ne ferait rien du tout — en silence — dès
  // lors qu'une ligne existe pour la semaine en cours, MÊME VIDE. C'est
  // précisément le cas rencontré : une ligne présente, `conseils_json` à 0
  // caractère, et un bouton qui semblait ne servir à rien.
  if (!forcer) {
    const lignes = await sbGet(SB_URL, SB_KEY,
      `profil_conseils?user_id=eq.${user.user_id}&select=semaine,conseils_json&limit=1`);
    const r = lignes && lignes[0];
    // Une ligne de la bonne semaine mais SANS contenu ne compte pas pour faite :
    // c'est l'état exact dans lequel la base se trouvait, et il bloquait le cron
    // autant que le bouton.
    if (r && r.semaine === semaine && r.conseils_json && String(r.conseils_json).length > 2) {
      console.log(`User ${user.user_id} déjà traité pour ${semaine}`);
      return null;
    }
  }

  const profil = await collecterProfil(SB_URL, SB_KEY, user.user_id, user.poids && user.tdee ? user : null);
  /* La page l'emporte sur la table quand elle en donne un : tant que
     `materiel` n'existe pas en base, elle est la SEULE à le connaître (il vit
     dans son localStorage). Une chaîne vide n'écrase rien — c'est « je n'ai
     rien à dire », pas « il n'a rien ». */
  if (typeof materiel === 'string' && materiel) profil.materiel = materiel;
  const prompt = construirePrompt(profil, NB_RECETTES, garde);

  const claudeRes = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const claudeData = await claudeRes.json();
  if (!claudeRes.ok) {
    // Le message d'Anthropic est bien plus utile que « échec » : modèle inconnu,
    // crédit épuisé, clé révoquée se distinguent ici et nulle part ailleurs.
    throw new Error('Claude ' + claudeRes.status + ' : '
      + ((claudeData && claudeData.error && claudeData.error.message) || 'réponse illisible'));
  }
  const txt = (claudeData.content && claudeData.content[0] && claudeData.content[0].text) || '';
  const out = extraireObjet(txt);
  if (!out) {
    // Cas le plus courant : réponse tronquée par la limite de jetons, le JSON
    // n'a alors pas d'accolade fermante. La longueur permet de trancher.
    throw new Error('Réponse illisible (' + txt.length + ' caractères, JSON incomplet ?)');
  }

  const recettes = ancrerAuCatalogue((out.recettes || []).slice(0, NB_RECETTES));
  const conseils = out.conseils || {};
  const platsMacro = normaliserPlatsMacro(out.plats_macro);
  if (!recettes.length && !conseils.conseil_amelioration && !conseils.conseil_prot) {
    throw new Error('Réponse sans conseil ni recette');
  }

  // UNE écriture, CINQ lectures possibles — c'est tout l'objet de l'opération :
  //   • conseil_*                    → overlay « Conseils personnalisés » de suivi.html
  //   • conseils_json.recettes       → écran Repas + liste de courses de coaching.html
  //                                    (via NattyReco.lireCache, qui cherche .recettes)
  //   • conseils_json.plats_macro    → planification de la semaine (assets/planning.js)
  //   • recettes_json                → overlay « Mes recettes » de suivi.html
  //   • liste_courses_json           → overlay « Liste de courses » de suivi.html
  const ligne = {
    user_id: user.user_id,
    conseil_prot: conseils.conseil_prot || null,
    conseil_gluc: conseils.conseil_gluc || null,
    conseil_lip: conseils.conseil_lip || null,
    conseil_cal: conseils.conseil_cal || null,
    conseil_amelioration: conseils.conseil_amelioration || null,
    conseil_points_forts: conseils.conseil_points_forts || null,
    // ⚠️ Colonne TEXTE, pas jsonb : on y met du JSON sérialisé, et les lecteurs
    // reparsent (assets/reco.js tolère les deux cas).
    conseils_json: JSON.stringify({
      recettes,
      // Les trois plats de la planification voyagent avec les recettes : même
      // génération, même colonne, même semaine. `assets/planning.js` les lit
      // ici et n'appelle plus l'IA du tout.
      plats_macro: platsMacro,
      nb_repas: NB_RECETTES,
      conseils,
      genere_le: new Date().toISOString()
    }),
    recettes_json: JSON.stringify(versAffichage(recettes)),
    liste_courses_json: JSON.stringify(listeDeCourses(recettes)),
    semaine,
    generated_at: new Date().toISOString()
  };

  const w = await fetch(`${SB_URL}/rest/v1/profil_conseils`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(ligne)
  });
  if (!w.ok) {
    // Un enregistrement raté doit se voir : sinon l'écran affiche des recettes
    // que rien ne persiste, et la semaine suivante on régénère sans le savoir.
    throw new Error('Enregistrement refusé (' + w.status + ' ' + (await w.text()).slice(0, 200) + ')');
  }

  // Email récapitulatif — jamais bloquant : les conseils sont écrits, une panne
  // de Resend ne doit pas faire croire à un échec de génération.
  if (user.email) {
    const liste = [
      { titre: '🥩 Protéines', texte: conseils.conseil_prot },
      { titre: '🌾 Glucides', texte: conseils.conseil_gluc },
      { titre: '🥑 Lipides', texte: conseils.conseil_lip },
      { titre: '⚡ Calories', texte: conseils.conseil_cal },
      { titre: '📈 À améliorer', texte: conseils.conseil_amelioration },
      { titre: '⭐ Points forts', texte: conseils.conseil_points_forts }
    ].filter(c => c.texte);
    if (liste.length) {
      try {
        await fetch('https://natty-suivi.vercel.app/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_email: user.email, type: 'conseils_hebdo',
            prenom: user.prenom || '', conseils: liste
          })
        });
      } catch (e) { console.warn('email conseils:', e.message); }
    }
  }

  return { recettes: recettes.length };
}

export function getLundiSemaine() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
