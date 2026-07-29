// api/save-conseils.js
// Sauvegarde les conseils IA côté serveur avec la service_role key
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

    const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
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
