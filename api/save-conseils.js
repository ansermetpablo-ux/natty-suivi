// api/save-conseils.js
// Sauvegarde les conseils IA côté serveur avec la service_role key.
//
// ⚠️ CETTE ROUTE ÉTAIT OUVERTE, ET C'ÉTAIT GRAVE. Elle acceptait un POST
// anonyme portant n'importe quel `user_id` et écrivait avec la clé service,
// donc PAR-DESSUS la RLS. La clé primaire de `profil_conseils` étant
// `user_id`, l'upsert écrasait la ligne de la victime au lieu d'en créer une :
// n'importe qui connaissant l'URL pouvait remplacer les conseils, les recettes
// et la liste de courses de n'importe quel membre. Relevé le 2026-08-11 en
// s'en servant pour semer une génération — ça a marché du premier coup.
//
// Elle exige désormais la session de la personne dont on écrit la ligne. Le
// modèle est celui d'`api/recalc-macros.js` : le jeton est vérifié auprès de
// GoTrue avec la CLÉ SERVICE, jamais avec le jeton de l'appelant — sinon
// c'est l'appelant qui décide de qui il est.
//
// ⚠️ CE QUE ÇA COÛTE, ET POURQUOI C'EST ACCEPTÉ. Le seul appelant est
// l'ancien `index.html` (dashboard web servi en iframe Wix), qui parle à
// Supabase avec la clé anon et un token hex en URL, sans session. Il perd donc
// l'écriture ici. Mais il ne LIT déjà plus rien depuis l'activation de la RLS
// (voir §8) : il affiche un tableau de bord vide. Fermer cette route ne casse
// donc rien qui fonctionnait encore, et l'app native — celle qu'on lance —
// n'embarque pas ce fichier et écrit par `api/_generation.js`.

const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';

/* L'identifiant de la personne à qui appartient ce jeton, ou null.
   ⚠️ Vérifié auprès de GoTrue avec la clé SERVICE : demander à l'appelant de
   prouver son identité avec ses propres en-têtes reviendrait à le croire sur
   parole. */
async function identite(jwt) {
  if (!jwt) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY || '',
        Authorization: 'Bearer ' + jwt
      }
    });
    if (!r.ok) return null;
    const moi = await r.json();
    return (moi && moi.id) ? moi.id : null;
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  // ⚠️ `Authorization` DOIT être annoncé : sans lui, le pré-vol CORS rejette
  //    l'en-tête et l'appel arrive sans jeton depuis un navigateur — donc en
  //    401, alors que l'appelant l'avait bien envoyé.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (!body || typeof body === 'string') {
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      try { body = JSON.parse(raw); } catch(e) { body = {}; }
    }

    const { user_id } = body;
    if (!user_id) return res.status(400).json({ error: 'user_id requis' });

    if (!process.env.SUPABASE_SERVICE_KEY) {
      // Sans clé service, `identite()` ne peut pas vérifier le jeton : on
      // refuse, plutôt que de laisser passer faute de pouvoir contrôler.
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY manquante' });
    }

    const jeton = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    const moi = await identite(jeton);
    if (!moi) {
      return res.status(401).json({ error: 'Session requise' });
    }
    // On n'écrit que SA propre ligne. C'est la comparaison qui manquait, et
    // c'est elle qui rendait la route dangereuse : la clé service passe
    // par-dessus la RLS, donc rien d'autre ne protégeait la ligne visée.
    if (String(moi) !== String(user_id)) {
      return res.status(403).json({ error: 'Interdit : cette ligne ne vous appartient pas' });
    }

    // L'upsert fusionne sur la ligne existante : n'envoyer que les champs
    // réellement fournis, sinon un appel partiel (les recettes, par exemple)
    // écraserait avec des null les conseils écrits juste avant.
    // Colonnes réellement présentes dans profil_conseils (vérifié en base) :
    // conseils_json, recettes_json et liste_courses_json existent bien.
    // Elles étaient simplement ignorées ici, d'où des écritures perdues.
    const CHAMPS = [
      'conseil_prot', 'conseil_gluc', 'conseil_lip', 'conseil_cal',
      'conseil_amelioration', 'conseil_points_forts',
      'conseils_json', 'recettes_json', 'liste_courses_json', 'semaine'
    ];

    const ligne = { user_id, generated_at: new Date().toISOString() };
    for (const champ of CHAMPS) {
      if (body[champ] !== undefined) ligne[champ] = body[champ];
    }

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // À ajouter dans Vercel env vars

    const response = await fetch(`${SB_URL}/rest/v1/profil_conseils`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(ligne)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Supabase error:', response.status, err);
      return res.status(response.status).json({ error: err });
    }

    return res.status(200).json({ ok: true });

  } catch(err) {
    console.error('save-conseils error:', err);
    return res.status(500).json({ error: err.message });
  }
}
