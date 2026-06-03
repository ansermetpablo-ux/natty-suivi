const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const LOGMEAL_KEY   = process.env.LOGMEAL_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!LOGMEAL_KEY)   return res.status(500).json({ error: 'LOGMEAL_API_KEY not configured' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { image, media_type } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image required' });

  try {
    // ── ÉTAPE 1 : LogMeal — reconnaissance du plat ──
    const logmealBody = JSON.stringify({
      image: `data:${media_type || 'image/jpeg'};base64,${image}`
    });

    const logmealData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.logmeal.com',
        path: '/v2/image/segmentation/complete',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOGMEAL_KEY}`,
          'Content-Length': Buffer.byteLength(logmealBody)
        }
      };
      const r = https.request(options, (resp) => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => {
          try { resolve({ status: resp.statusCode, data: JSON.parse(data) }); }
          catch(e) { reject(new Error('LogMeal parse error: ' + data)); }
        });
      });
      r.on('error', reject);
      r.write(logmealBody);
      r.end();
    });

    if (logmealData.status !== 200) {
      return res.status(500).json({ error: 'LogMeal error', details: logmealData.data });
    }

    // Extraire les aliments reconnus par LogMeal
    const segments = logmealData.data.segmentation_results || [];
    const foodItems = segments.map(s => s.recognition_results?.[0]?.name || s.food_name || '').filter(Boolean);
    const dishName  = logmealData.data.dish_name || foodItems[0] || 'Plat inconnu';

    if (!foodItems.length) {
      return res.status(200).json({
        nom: dishName,
        ingredients: [],
        macros: { prot: 0, lip: 0, gluc: 0, cal: 0 },
        message: 'Aucun aliment reconnu — essayez une photo plus nette'
      });
    }

    // ── ÉTAPE 2 : Claude — estimation des macros ──
    const claudePrompt = `Le plat reconnu est "${dishName}" composé des aliments suivants : ${foodItems.join(', ')}.
Estime les quantités typiques en grammes et calcule les macronutriments.
Réponds UNIQUEMENT en JSON sans backticks :
{"nom":"${dishName}","ingredients":[{"emoji":"...","nom":"...","quantite_g":0}],"macros":{"prot":0,"lip":0,"gluc":0,"cal":0},"description":"..."}`;

    const claudeBody = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: claudePrompt }]
    });

    const claudeData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(claudeBody)
        }
      };
      const r = https.request(options, (resp) => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => {
          try { resolve({ status: resp.statusCode, data: JSON.parse(data) }); }
          catch(e) { reject(new Error('Claude parse error')); }
        });
      });
      r.on('error', reject);
      r.write(claudeBody);
      r.end();
    });

    if (claudeData.status !== 200) {
      // LogMeal a marché, Claude a échoué — retourne quand même les ingrédients sans macros
      return res.status(200).json({
        nom: dishName,
        ingredients: foodItems.map(f => ({ emoji: '🍽️', nom: f, quantite_g: 100 })),
        macros: { prot: 0, lip: 0, gluc: 0, cal: 0 },
        logmeal_ok: true, claude_ok: false
      });
    }

    const claudeText = claudeData.data.content?.[0]?.text || '{}';
    const result = JSON.parse(claudeText.replace(/```[a-z]*|```/g, '').trim());

    return res.status(200).json({
      ...result,
      logmeal_foods: foodItems,
      logmeal_ok: true,
      claude_ok: true
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};
