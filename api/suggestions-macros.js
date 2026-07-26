const https = require('https');

function callClaude(prompt) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const bodyStr = JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: 1200,
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

  const { profil, repas_du_jour, questionnaire_alim } = req.body || {};

  const prompt = `Tu es un coach nutritionnel. Voici le profil d'un client :
${JSON.stringify(profil || {}, null, 2)}

Repas déjà pris aujourd'hui :
${JSON.stringify(repas_du_jour || [], null, 2)}

Préférences alimentaires :
${JSON.stringify(questionnaire_alim || {}, null, 2)}

En te basant sur ce qu'il lui reste à manger aujourd'hui pour atteindre ses objectifs de macros, propose exactement 3 suggestions concrètes : une "Aliment simple" (1 ingrédient, prêt en quelques minutes), un "Combo express" (2-3 ingrédients), et un "Plat complet" (repas structuré). Respecte ses préférences/allergies si connues.

Réponds UNIQUEMENT avec du JSON valide (pas de texte autour), au format exact :
{"suggestions":[{"emoji":"🥚","name":"...","description":"...","proteines":18,"lipides":12,"glucides":2,"calories":210,"preparation":10,"pourquoi":"..."}]}
Le champ "preparation" est en minutes (0 = immédiat, sans cuisson).`;

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
