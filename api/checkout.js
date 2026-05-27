export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId, userId, token } = req.body;

    console.log('priceId:', priceId);
    console.log('userId:', userId);
    console.log('token:', token ? token.substring(0, 10) + '...' : 'null');

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    if (!STRIPE_SECRET_KEY) {
      console.log('ERROR: Missing STRIPE_SECRET_KEY');
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    console.log('Stripe key found:', STRIPE_SECRET_KEY.substring(0, 7) + '...');

    const origin = req.headers.origin || 'https://natty-suivi.vercel.app';

    const body = new URLSearchParams();
    body.append('mode', 'subscription');
    body.append('line_items[0][price]', priceId);
    body.append('line_items[0][quantity]', '1');
    body.append('success_url', origin + '/?token=' + token + '&subscribed=1');
    body.append('cancel_url', origin + '/offre.html?token=' + token + '&cancelled=1');
    body.append('metadata[user_id]', userId || '');
    body.append('subscription_data[metadata][user_id]', userId || '');

    console.log('Calling Stripe with body:', body.toString().substring(0, 100));

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    const session = await response.json();
    console.log('Stripe response status:', response.status);
    console.log('Stripe response:', JSON.stringify(session));

    if (!session.url) {
      return res.status(500).json({ error: 'Session creation failed', details: session });
    }

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.log('Caught error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
