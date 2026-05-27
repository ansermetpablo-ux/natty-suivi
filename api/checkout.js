export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { priceId, userId, token } = await req.json();

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Stripe key' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const reqUrl = new URL(req.url);
    const origin = reqUrl.origin;

    const body = new URLSearchParams();
    body.append('mode', 'subscription');
    body.append('line_items[0][price]', priceId);
    body.append('line_items[0][quantity]', '1');
    body.append('success_url', origin + '/?token=' + token + '&subscribed=1');
    body.append('cancel_url', origin + '/offre.html?token=' + token + '&cancelled=1');
    body.append('metadata[user_id]', userId || '');
    body.append('subscription_data[metadata][user_id]', userId || '');

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    const session = await response.json();

    if (!session.url) {
      return new Response(JSON.stringify({ error: 'Session creation failed', details: session }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
