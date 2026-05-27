export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const event = await req.json();

    const SUPABASE_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w';

    const supabase = async (path, method, body) => {
      return fetch(SUPABASE_URL + '/rest/v1/' + path, {
        method,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: body ? JSON.stringify(body) : undefined
      });
    };

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      if (!userId) return new Response('ok', { status: 200 });

      // Récupérer les détails de l'abonnement
      const subRes = await fetch('https://api.stripe.com/v1/subscriptions/' + session.subscription, {
        headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
      });
      const sub = await subRes.json();
      const priceId = sub.items?.data[0]?.price?.id;

      const PRICE_3 = process.env.STRIPE_PRICE_3_REPAS;
      const PRICE_4 = process.env.STRIPE_PRICE_4_REPAS;
      const formule = priceId === PRICE_4 ? '4_repas' : '3_repas';

      await supabase('abonnements', 'POST', {
        user_id: userId,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        formule,
        statut: 'actif',
        date_debut: new Date().toISOString(),
      });
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const userId = invoice.subscription_details?.metadata?.user_id;
      if (!userId) return new Response('ok', { status: 200 });

      await supabase(
        'abonnements?stripe_subscription_id=eq.' + invoice.subscription,
        'PATCH',
        { statut: 'actif' }
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (!userId) return new Response('ok', { status: 200 });

      await supabase(
        'abonnements?stripe_subscription_id=eq.' + sub.id,
        'PATCH',
        { statut: 'annule' }
      );
    }

    return new Response('ok', { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
