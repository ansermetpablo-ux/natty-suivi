const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { prompt, max_tokens, image, media_type } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  let content;
  if (image) {
    content = [
      { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image } },
      { type: 'text', text: prompt }
    ];
  } else {
    content = prompt;
  }

  const bodyStr = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: max_tokens || 800,
    messages: [{ role: 'user', content }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const reqHttp = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (resp.statusCode !== 200) {
            res.status(500).json({ error: parsed.error?.message || 'Claude error', status: resp.statusCode });
          } else {
            const text = parsed.content?.[0]?.text || '';
            res.status(200).json({ text });
          }
        } catch(e) {
          res.status(500).json({ error: 'Parse error: ' + e.message });
        }
        resolve();
      });
    });

    reqHttp.on('error', (e) => {
      res.status(500).json({ error: e.message });
      resolve();
    });

    reqHttp.write(bodyStr);
    reqHttp.end();
  });
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};
