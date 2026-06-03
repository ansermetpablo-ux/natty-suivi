export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  console.log('ANTHROPIC_API_KEY present:', !!ANTHROPIC_KEY, 'length:', ANTHROPIC_KEY ? ANTHROPIC_KEY.length : 0);
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    // Parse body
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

    const { prompt, max_tokens, image, media_type } = body;
    console.log('prompt length:', prompt ? prompt.length : 0, 'has image:', !!image);
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    // Build content
    let content;
    if (image) {
      content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: media_type || 'image/jpeg',
            data: image
          }
        },
        { type: 'text', text: prompt }
      ];
    } else {
      content = prompt;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 800,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await anthropicRes.json();
    console.log('Anthropic status:', anthropicRes.status, 'error:', data.error?.message);

    if (!anthropicRes.ok) {
      return res.status(500).json({
        error: data.error?.message || 'Claude API error',
        type: data.error?.type,
        status: anthropicRes.status
      });
    }

    const text = data.content && data.content[0] ? data.content[0].text : '';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('claude.js exception:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
