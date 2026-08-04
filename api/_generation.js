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
const MAX_TOKENS = 3200 * NB_RECETTES + 1600;

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
  const out = { onboarding: onboarding || null, questionnaire: null, semaine: [] };

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
    + '&select=allergies,regime,aliments_aimes,aliments_evites,decouverte_cuisines,'
    + 'decouverte_styles,decouverte_ingredients,frequence_cuisine,nb_repas,defi_principal');
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

  p += '\nRÈGLES\n';
  p += "1. Les recettes doivent servir l'objectif ci-dessus (répartition macro et calories).\n";
  p += '2. Elles doivent se DÉMARQUER de la semaine écoulée : change de source de protéines, de féculent, de légumes et de cuisine par rapport aux ingrédients récurrents listés.\n';
  p += '3. Allergies, régime et aliments évités sont bloquants, sans exception.\n';
  p += "   Si la liste des goûts contredit le régime (ex. régime vegan mais viande citée dans les aliments aimés), le RÉGIME l'emporte toujours : propose l'équivalent compatible, jamais l'aliment interdit.\n";
  p += '4. Respecte le temps de cuisine disponible.\n';
  p += '5. Écris en français, ton direct et concret (tutoiement).\n';
  if (garde) {
    p += "6. Pars des INGRÉDIENTS DISPONIBLES : chaque recette doit en utiliser plusieurs, et l'ensemble des recettes doit écouler ce stock en priorité. N'ajoute d'ingrédient absent de la liste que si la recette ne tient pas debout sans lui, et garde ces ajouts courants et peu nombreux.\n";
    p += '7. Sur chaque ingrédient, mets "dispo":true s\'il figure dans les INGRÉDIENTS DISPONIBLES, false s\'il faut l\'acheter.\n';
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

  p += '\nLes conseils portent sur SES repas réels et SES préférences, jamais de généralité.\n';
  p += '\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :\n';
  p += '{"conseils":{"conseil_prot":"phrase courte","conseil_gluc":"phrase courte",'
     + '"conseil_lip":"phrase courte","conseil_cal":"phrase courte",'
     + '"conseil_amelioration":"1-2 phrases","conseil_points_forts":"1-2 phrases"},';
  p += '"recettes":[{"nom":"Nom du plat","pourquoi":"une phrase expliquant pourquoi ce plat pour LUI",'
     + '"avantages":"ce que ce plat apporte concrètement à SON objectif, une phrase",'
     + '"temps_min":25,"macros":{"p":42,"g":60,"l":18,"kcal":600},'
     + '"ingredients":[{"em":"🍗","nom":"Poulet","qte":"150 g","dispo":true}],'
     + '"steps":[{"illu":"couper","t":"Titre court de l\'étape","detail":"la consigne précise, avec les repères",'
     + '"qte":[{"nom":"Poulet","qte":"150 g"}],"duree_min":5,"temp_c":0,"feu":"","tip":"astuce facultative"}]}]}';

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
export function versAffichage(recettes) {
  const EM = ['🍛', '🐟', '🍲', '🥗', '🍝', '🍜'];
  return (recettes || []).map((r, i) => {
    const m = r.macros || {};
    return {
      emoji: EM[i % EM.length],
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

/* ── 5. La génération, de bout en bout ───────────────────────────────────── */

/**
 * @param {object} user      ligne onboarding (au minimum {user_id})
 * @param {string} semaine   lundi de la semaine, 'YYYY-MM-DD'
 * @param {boolean} forcer   ignore le « déjà fait cette semaine »
 * @param {string} garde     garde-manger transmis par la page (facultatif)
 * @returns {Promise<{recettes:number}|null>} null si rien n'était à faire
 */
export async function processUser(user, semaine, SB_URL, SB_KEY, CLAUDE_API, CLAUDE_KEY, forcer, garde) {
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

  const recettes = (out.recettes || []).slice(0, NB_RECETTES);
  const conseils = out.conseils || {};
  if (!recettes.length && !conseils.conseil_amelioration && !conseils.conseil_prot) {
    throw new Error('Réponse sans conseil ni recette');
  }

  // UNE écriture, QUATRE lectures possibles — c'est tout l'objet de l'opération :
  //   • conseil_*          → overlay « Conseils personnalisés » de suivi.html
  //   • conseils_json      → écran Repas + liste de courses de coaching.html
  //                          (via NattyReco.lireCache, qui cherche .recettes)
  //   • recettes_json      → overlay « Mes recettes » de suivi.html
  //   • liste_courses_json → overlay « Liste de courses » de suivi.html
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
