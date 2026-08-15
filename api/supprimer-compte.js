/* ═══════════════════════════════════════════════════════════
   api/supprimer-compte.js — effacer un compte et tout ce qu'il a produit
   ───────────────────────────────────────────────────────────
   POURQUOI CET ENDPOINT EXISTE : Apple refuse toute app qui permet de créer
   un compte sans permettre de le supprimer depuis l'app (guideline 5.1.1(v)).
   Et supprimer un compte ne peut PAS se faire depuis le navigateur : effacer
   la ligne `auth.users` demande la clé service, qui ne sort jamais du serveur.

   QUI PEUT SUPPRIMER QUOI : uniquement soi-même. L'identité vient du jeton
   d'accès envoyé en `Authorization`, vérifié auprès de Supabase — jamais d'un
   `user_id` transmis dans le corps de la requête. Sans cette règle, l'URL de
   cet endpoint suffirait à effacer le compte de n'importe qui.

   ORDRE DES OPÉRATIONS, et il compte :
     1. l'abonnement Stripe est résilié AVANT tout effacement — sinon on perd
        le `stripe_subscription_id` et la personne continue d'être prélevée
        pour un compte qui n'existe plus ;
     2. les données applicatives ;
     3. le compte Auth en dernier — c'est lui qui rend l'opération visible
        côté utilisateur (il ne peut plus se connecter). S'il partait en
        premier et qu'une étape échouait derrière, il resterait des données
        orphelines que plus personne ne pourrait réclamer.

   TOLÉRANCE AUX TABLES ABSENTES : plusieurs tables sont facultatives sur
   l'instance (`garde_manger`, `appareils`, `push_etat`…). Une absence ne doit
   pas interrompre la suppression — on note l'échec et on continue. Le seul
   échec qui fait renvoyer une erreur est celui du compte Auth lui-même.
   ═══════════════════════════════════════════════════════════ */

const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w';

/* Tables effacées par `user_id`. Une table absente de l'instance est ignorée. */
const TABLES_USER = [
  'meal_ingredients_via_meals',   // traité à part : la clé est meal_id
  'meal_likes', 'meal_vues', 'membre_prefs',
  'onboarding', 'questionnaire_alim', 'messages', 'nutrition_scores',
  'daily_macros', 'profil_conseils', 'challenges', 'challenge_entreprise',
  'rdv', 'commandes', 'plans_repas', 'appareils', 'push_etat',
  // ⚠️ `planning_semaine` manquait à cette liste alors que la table existe
  // (créée depuis) : un compte supprimé laissait ses plans de repas derrière
  // lui — donc quand la personne est chez elle et ce qu'elle mange.
  'planning_semaine',
  // Le bilan du soir porte le ressenti, la motivation et les difficultés
  // déclarées jour après jour : ce qu'il y a de plus personnel dans l'app.
  // Ajouté en même temps qu'`assets/bilan.js` — la route ignore sans broncher
  // une table qui n'existe pas encore, donc l'ordre entre le SQL et ce
  // déploiement n'a pas d'importance.
  'bilan_jour',
  // Modération du fil (natty_moderation.sql). `signalements` est effacée par
  // `signaleur_id` ET par `auteur_id` plus bas : les deux colonnes désignent
  // une personne, et n'en effacer qu'une laisserait le compte supprimé nommé
  // dans une accusation — la sienne ou celle qui le visait.
  'membre_bloques',
  // Ce qu'on a dans sa cuisine (natty_materiel.sql) dit l'équipement, donc le
  // logement et les moyens — au même titre que le garde-manger juste après.
  'materiel',
  'garde_manger', 'abonnements', 'meals'
];

function entetes(cle) {
  return {
    apikey: cle,
    Authorization: 'Bearer ' + cle,
    'Content-Type': 'application/json'
  };
}

/* Identité de l'appelant, telle que Supabase la reconnaît. On ne décode pas le
   JWT nous-mêmes : un jeton falsifié se décode très bien, seul le serveur qui
   l'a émis peut dire s'il est valide. */
async function appelant(jeton) {
  const r = await fetch(SB_URL + '/auth/v1/user', {
    headers: { apikey: SB_ANON, Authorization: 'Bearer ' + jeton }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return (u && u.id) ? u : null;
}

async function effacer(table, filtre, cle) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/' + table + '?' + filtre, {
      method: 'DELETE',
      headers: Object.assign(entetes(cle), { Prefer: 'return=minimal' })
    });
    if (r.ok) return { table, ok: true };
    return { table, ok: false, code: r.status };
  } catch (e) {
    return { table, ok: false, code: 'reseau' };
  }
}

/* Résiliation Stripe — best effort, et jamais bloquante. Si la clé Stripe
   n'est pas configurée ou si l'appel échoue, la suppression continue : mieux
   vaut un abonnement à résilier à la main qu'un compte impossible à effacer.
   Le cas est signalé dans la réponse pour qu'il ne passe pas inaperçu. */
async function resilierStripe(uid, cle) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { tente: false, raison: 'STRIPE_SECRET_KEY absente' };

  let abos = [];
  try {
    const r = await fetch(SB_URL + '/rest/v1/abonnements?user_id=eq.' + uid
      + '&select=stripe_subscription_id,statut', { headers: entetes(cle) });
    if (r.ok) abos = await r.json();
  } catch (e) { /* table illisible : rien à résilier de notre point de vue */ }

  const ids = abos.map(a => a.stripe_subscription_id).filter(Boolean);
  if (!ids.length) return { tente: true, resilies: [], echecs: [] };

  const resilies = [], echecs = [];
  for (const id of ids) {
    try {
      const r = await fetch('https://api.stripe.com/v1/subscriptions/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + secret }
      });
      // 404 = l'abonnement n'existe plus chez Stripe : c'est le résultat voulu.
      if (r.ok || r.status === 404) resilies.push(id);
      else echecs.push({ id, code: r.status });
    } catch (e) { echecs.push({ id, code: 'reseau' }); }
  }
  return { tente: true, resilies, echecs };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) {
    // Fail-closed explicite : sans la clé service on ne peut ni effacer le
    // compte Auth ni garantir l'effacement des données. Ne jamais répondre
    // « ok » dans ce cas — l'utilisateur croirait son compte supprimé.
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY non configurée sur le serveur' });
  }

  const brut = req.headers.authorization || '';
  const jeton = brut.replace(/^Bearer\s+/i, '').trim();
  if (!jeton) return res.status(401).json({ error: 'Connexion requise' });

  const moi = await appelant(jeton);
  if (!moi) return res.status(401).json({ error: 'Session invalide ou expirée' });

  const uid = moi.id;
  const journal = [];

  // 1. Stripe d'abord — voir l'en-tête de ce fichier.
  const stripe = await resilierStripe(uid, SERVICE_KEY);

  // 2. Les ingrédients sont rattachés aux repas, pas à l'utilisateur : il faut
  //    les identifiants des repas avant d'effacer les repas eux-mêmes.
  let mealIds = [];
  try {
    const r = await fetch(SB_URL + '/rest/v1/meals?user_id=eq.' + uid + '&select=id',
      { headers: entetes(SERVICE_KEY) });
    if (r.ok) mealIds = (await r.json()).map(m => m.id).filter(Boolean);
  } catch (e) { /* on continue : les repas seront effacés, les ingrédients notés en échec */ }

  if (mealIds.length) {
    // Par lots : une URL PostgREST avec 200 uuid dépasse les limites usuelles.
    for (let i = 0; i < mealIds.length; i += 50) {
      const lot = mealIds.slice(i, i + 50).join(',');
      journal.push(await effacer('meal_ingredients', 'meal_id=in.(' + lot + ')', SERVICE_KEY));
      // Les j'aime et les vues déposés par d'AUTRES sur mes plats : sans ça
      // il resterait des lignes pointant vers des repas disparus.
      journal.push(await effacer('meal_likes', 'meal_id=in.(' + lot + ')', SERVICE_KEY));
      journal.push(await effacer('meal_vues', 'meal_id=in.(' + lot + ')', SERVICE_KEY));
    }
  }

  // 3. Le reste, table par table.
  for (const table of TABLES_USER) {
    if (table === 'meal_ingredients_via_meals') continue;  // déjà traité ci-dessus
    journal.push(await effacer(table, 'user_id=eq.' + uid, SERVICE_KEY));
  }

  // Deux colonnes à part : une amitié a deux extrémités, et le nutritionniste
  // désigne son client par `client_id`.
  journal.push(await effacer('membre_amis', 'user_id=eq.' + uid, SERVICE_KEY));
  journal.push(await effacer('membre_amis', 'ami_id=eq.' + uid, SERVICE_KEY));
  journal.push(await effacer('notes_nutritionniste', 'client_id=eq.' + uid, SERVICE_KEY));

  // Modération : quatre colonnes pointent vers une personne. `membre_bloques`
  // est déjà traitée par `user_id` dans la boucle ; il reste le côté « je suis
  // celui qu'on a masqué », et les deux extrémités d'un signalement.
  journal.push(await effacer('membre_bloques', 'bloque_id=eq.' + uid, SERVICE_KEY));
  journal.push(await effacer('signalements', 'signaleur_id=eq.' + uid, SERVICE_KEY));
  journal.push(await effacer('signalements', 'auteur_id=eq.' + uid, SERVICE_KEY));

  // 4. Le compte Auth en dernier. C'est le seul échec qui fait échouer l'appel :
  //    sans lui la personne pourrait se reconnecter et croire que rien n'a été
  //    supprimé, alors que ses données sont bien parties.
  let authOk = false, authErr = '';
  try {
    const r = await fetch(SB_URL + '/auth/v1/admin/users/' + uid, {
      method: 'DELETE',
      headers: entetes(SERVICE_KEY)
    });
    authOk = r.ok;
    if (!r.ok) authErr = (await r.text()).slice(0, 300);
  } catch (e) { authErr = 'reseau'; }

  const echecs = journal.filter(j => !j.ok);
  if (!authOk) {
    return res.status(500).json({
      error: 'Compte non supprimé : ' + (authErr || 'erreur inconnue'),
      donnees_effacees: journal.length - echecs.length,
      stripe
    });
  }

  return res.status(200).json({ ok: true, tables: journal.length, echecs, stripe });
}
