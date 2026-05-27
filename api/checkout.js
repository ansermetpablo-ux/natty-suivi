export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parser le body manuellement
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

    console.log('body received:', JSON.stringify(body));

    const { priceId, userId, token } = body;
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    console.log('priceId:', priceId);
    console.log('STRIPE_SECRET_KEY present:', !!STRIPE_SECRET_KEY);

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    const origin = 'https://natty-suivi.vercel.app';

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', origin + '/?token=' + (token || '') + '&subscribed=1');
    params.append('cancel_url', origin + '/offre.html?token=' + (token || '') + '&cancelled=1');
    params.append('metadata[user_id]', userId || '');
    params.append('subscription_data[metadata][user_id]', userId || '');

    console.log('Calling Stripe...');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const session = await stripeRes.json();
    console.log('Stripe status:', stripeRes.status);
    console.log('Stripe response:', JSON.stringify(session).substring(0, 300));

    if (!session.url) {
      return res.status(500).json({ error: 'No URL in response', details: session });
    }

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.log('Error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}
