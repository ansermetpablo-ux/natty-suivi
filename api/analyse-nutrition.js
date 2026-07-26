const https = require('https');

function callClaude(prompt) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const bodyStr = JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (resp.statusCode !== 200) return reject(new Error(parsed.error?.message || 'Claude error'));
          resolve(parsed.content?.[0]?.text || '');
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function extractJson(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  return JSON.parse(match[1].trim());
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { profil, repas, questionnaire_alim } = req.body || {};

  const prompt = `Tu es un coach nutritionnel. Analyse l'alimentation de ce client sur la base de son historique de repas.

Profil / objectifs :
${JSON.stringify(profil || {}, null, 2)}

Historique de repas (jusqu'à 30 derniers, avec ingrédients) :
${JSON.stringify(repas || [], null, 2)}

Préférences alimentaires :
${JSON.stringify(questionnaire_alim || {}, null, 2)}

Produis une analyse nutritionnelle complète et bienveillante. Réponds UNIQUEMENT avec du JSON valide (pas de texte autour), au format exact :
{
  "points_forts": [{"emoji":"✅","titre":"...","explication":"..."}],
  "points_faibles": [{"emoji":"⚠️","titre":"...","explication":"...","impact":"..."}],
  "composition_reelle": {"proteines_pct":25,"lipides_pct":35,"glucides_pct":40},
  "composition_ideale": {"proteines_pct":30,"lipides_pct":25,"glucides_pct":45},
  "ingredients_remplacer": [{"emoji_ancien":"🍚","emoji_nouveau":"🌾","ancien":"...","nouveau":"...","raison":"..."}],
  "ingredients_incorporer": [{"emoji":"➕","ingredient":"...","quantite_suggeree":"..."}],
  "plats_suggeres": [{"emoji":"🍽️","nom":"...","description":"...","pourquoi":"..."}],
  "score_global": 72,
  "message_coach": "..."
}
Les 3 pourcentages de "composition_reelle" et de "composition_ideale" doivent chacun sommer à 100. "score_global" est un entier de 0 à 100. Si l'historique de repas est trop court pour une analyse fiable, renvoie des tableaux vides plutôt que d'inventer des données.`;

  try {
    const text = await callClaude(prompt);
    const json = extractJson(text);
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '2mb' } }
};
