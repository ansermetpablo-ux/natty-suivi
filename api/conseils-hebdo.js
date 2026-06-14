// Cron chaque lundi 8h — génère les conseils pour tous les users + envoie email
// vercel.json: { "crons": [{ "path": "/api/conseils-hebdo", "schedule": "0 7 * * 1" }] }

export default async function handler(req, res) {
  const secret = req.query?.secret || req.headers?.['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
  const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

  // Allow targeting a single user for testing
  const targetUser = req.query?.user_id;

  try {
    // 1. Get all users with completed onboarding
    let url = `${SB_URL}/rest/v1/onboarding?completed=eq.true&select=user_id,prenom,email,poids,taille,age,sexe,activite,tdee,objectif_type&limit=50`;
    if (targetUser) url += `&user_id=eq.${targetUser}`;

    const usersRes = await fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    const users = await usersRes.json();

    const validUsers = (Array.isArray(users) ? users : []).filter(u =>
      u.user_id && u.user_id !== 'anonymous' && u.user_id.includes('-')
    );

    const semaine = getLundiSemaine();
    let processed = 0;

    for (const user of validUsers) {
      try {
        await processUser(user, semaine, SB_URL, SB_KEY, CLAUDE_API, CLAUDE_KEY);
        processed++;
      } catch (e) {
        console.error(`Error for ${user.user_id}:`, e.message);
      }
    }

    return res.status(200).json({ ok: true, processed, semaine });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function processUser(user, semaine, SB_URL, SB_KEY, CLAUDE_API, CLAUDE_KEY) {
  // Check if already processed this week
  const existing = await fetch(
    `${SB_URL}/rest/v1/profil_conseils?user_id=eq.${user.user_id}&select=semaine&limit=1`,
    { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
  );
  const existingData = await existing.json();
  if (existingData && existingData.length && existingData[0].semaine === semaine) {
    console.log(`User ${user.user_id} already processed this week`);
    return;
  }

  // Get recent meals
  const mealsRes = await fetch(
    `${SB_URL}/rest/v1/meals?user_id=eq.${user.user_id}&select=name,created_at&order=created_at.desc&limit=10`,
    { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
  );
  const meals = await mealsRes.json();
  const mealsDesc = Array.isArray(meals) ? meals.map(m => m.name).join(', ') : 'aucun repas';

  // Calculate macros from profile
  const poids = parseFloat(user.poids) || 70;
  const tdee  = parseFloat(user.tdee)  || 2000;
  const macros = {
    prot: Math.round(poids * 2),
    gluc: Math.round(tdee * 0.5 / 4),
    lip:  Math.round(tdee * 0.25 / 9),
    cal:  Math.round(tdee)
  };

  const ACTIVITE = { sedentaire:'sédentaire', leger:'légèrement actif', modere:'modérément actif', actif:'très actif' };

  const prompt = `Tu es nutritionniste expert. Génère 6 conseils courts et actionnables pour ce client.
Profil: ${user.prenom||'Client'}, ${user.age||'?'} ans, ${user.sexe||'?'}, ${poids}kg, activité: ${ACTIVITE[user.activite]||'?'}, objectif: ${user.objectif_type||'?'}
Objectifs macros: prot=${macros.prot}g gluc=${macros.gluc}g lip=${macros.lip}g cal=${macros.cal}kcal
Repas récents: ${mealsDesc}
Génère exactement ce JSON (sans backticks):
{"conseil_prot":"1 phrase protéines","conseil_gluc":"1 phrase glucides","conseil_lip":"1 phrase lipides","conseil_cal":"1 phrase calories","conseil_amelioration":"1-2 phrases à améliorer cette semaine","conseil_points_forts":"1-2 phrases points forts"}`;

  // Call Claude
  const claudeRes = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const claudeData = await claudeRes.json();
  const raw = (claudeData.content?.[0]?.text || '{}').replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
  const data = JSON.parse(raw);

  if (!data.conseil_prot && !data.conseil_amelioration) throw new Error('Empty Claude response');

  // 2ème appel Claude : liste de courses + recettes
  let liste_courses_json = null;
  let recettes_json = null;
  try {
    const promptCourses = `Tu es nutritionniste et chef cuisinier. Génère une liste de courses et 3 recettes pour ${user.prenom || 'ce client'}.
Objectifs: prot=${macros.prot}g gluc=${macros.gluc}g lip=${macros.lip}g cal=${macros.cal}kcal.
Conseils de la semaine: ${data.conseil_amelioration || ''} ${data.conseil_prot || ''}
Réponds UNIQUEMENT en JSON sans backticks:
{"liste_courses":{"recettes_ingredients":[{"emoji":"...","nom":"...","quantite":"...","raison":"..."}],"aliments_bonus":[{"emoji":"...","nom":"...","quantite":"...","benefice":"..."}]},"recettes":[{"emoji":"...","nom":"...","macros":{"prot":0,"gluc":0,"lip":0,"cal":0},"ingredients":["..."],"etapes":["...","...","...","..."]}]}`;

    const coursesRes = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, messages: [{ role: 'user', content: promptCourses }] })
    });
    const coursesData = await coursesRes.json();
    const coursesRaw = (coursesData.content?.[0]?.text || '{}').replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
    const coursesJson = JSON.parse(coursesRaw);
    if (coursesJson.liste_courses) liste_courses_json = JSON.stringify(coursesJson.liste_courses);
    if (coursesJson.recettes && coursesJson.recettes.length) recettes_json = JSON.stringify(coursesJson.recettes);
    console.log(`Courses+recettes générées pour ${user.user_id}`);
  } catch(e) {
    console.warn(`Courses/recettes failed for ${user.user_id}:`, e.message);
  }

  // Upsert in Supabase (conseils + courses + recettes en une seule requête)
  const row = {
    user_id: user.user_id,
    conseil_prot: data.conseil_prot || null,
    conseil_gluc: data.conseil_gluc || null,
    conseil_lip:  data.conseil_lip  || null,
    conseil_cal:  data.conseil_cal  || null,
    conseil_amelioration: data.conseil_amelioration || null,
    conseil_points_forts: data.conseil_points_forts || null,
    liste_courses_json,
    recettes_json,
    semaine,
    generated_at: new Date().toISOString(),
    conseils_json: JSON.stringify(data)
  };

  await fetch(`${SB_URL}/rest/v1/profil_conseils`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(row)
  });

  // Send email if user has email
  if (user.email) {
    const conseils = [
      { titre: '🥩 Protéines',    texte: data.conseil_prot },
      { titre: '🌾 Glucides',     texte: data.conseil_gluc },
      { titre: '🥑 Lipides',      texte: data.conseil_lip  },
      { titre: '⚡ Calories',     texte: data.conseil_cal  },
      { titre: '📈 À améliorer',  texte: data.conseil_amelioration },
      { titre: '⭐ Points forts', texte: data.conseil_points_forts },
    ].filter(c => c.texte);

    await fetch('https://natty-suivi.vercel.app/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email: user.email,
        type: 'conseils_hebdo',
        prenom: user.prenom || '',
        conseils
      })
    });
    console.log(`Email sent to ${user.email}`);
  }
}

function getLundiSemaine() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
