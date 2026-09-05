export const config = { runtime: 'edge' };

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return false;

  // Rejette les events trop anciens (protection contre le replay)
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + rawBody));
  const expectedSig = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (expectedSig.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response('Webhook non configuré (STRIPE_WEBHOOK_SECRET manquant)', { status: 500 });
    }

    const isValid = await verifyStripeSignature(rawBody, req.headers.get('stripe-signature'), webhookSecret);
    if (!isValid) {
      return new Response('Signature invalide', { status: 400 });
    }

    const event = JSON.parse(rawBody);

    const SUPABASE_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
    // La clé service d'abord. Ce handler écrit dans `abonnements` pour le
    // compte d'un utilisateur qui n'est pas là — c'est Stripe qui appelle, pas
    // un navigateur : aucun JWT ne peut accompagner la requête. Avec la seule
    // clé anon, l'activation des abonnements s'arrêterait net le jour où la
    // RLS est posée sur cette table (natty_rls.sql), et en silence : Stripe
    // verrait un 200, la ligne ne serait jamais écrite.
    // `SUPABASE_KEY` reste accepté pour ne rien casser si elle est déjà posée
    // quelque part ; le repli anon en dur ne sert plus que de dernier recours.
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w';

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

      /* 🔴 ⚠️ UN ACHAT À L'UNITÉ N'EST PAS UN ABONNEMENT — défaut PRÉEXISTANT,
         apparu avec la commande au plat. `checkout.session.completed` se
         déclenche AUSSI pour un paiement unique, où `session.subscription` est
         nul : on interrogeait donc `/v1/subscriptions/null`, et on insérait
         dans `abonnements` une ligne « 3_repas » sans identifiant
         d'abonnement. Conséquence visible : la pastille « ★ Abonné » de la
         liste clients — qui se fonde sur la PRÉSENCE d'une ligne active —
         s'allumait pour quelqu'un ayant acheté un seul plat.
         La session porte déjà `metadata[type]` : on s'en sert. */
      if (session.metadata?.type === 'unite' || !session.subscription) {
        return new Response('ok', { status: 200 });
      }

      // Récupérer les détails de l'abonnement
      const subRes = await fetch('https://api.stripe.com/v1/subscriptions/' + session.subscription, {
        headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
      });
      const sub = await subRes.json();
      const ligne = sub.items?.data?.[0];
      const priceId = ligne?.price?.id;

      /* ⚠️ LA FORMULE NE SE DÉDUIT PLUS DU PRIX. Depuis que l'abonnement se
         vend au plat, un SEUL prix sert à toutes les formules et c'est la
         quantité qui les distingue — comparer l'identifiant rendrait « 3_repas »
         pour tout le monde, y compris un abonnement à 6 plats.
         Trois sources, de la plus fiable à la plus ancienne : la métadonnée
         posée par `api/checkout.js`, la quantité de la ligne, puis les deux
         identifiants historiques. */
      const PRICE_3 = process.env.STRIPE_PRICE_3_REPAS || 'price_1TbhMB0TTrkVKRpiPvbGHLyI';
      const PRICE_4 = process.env.STRIPE_PRICE_4_REPAS || 'price_1TbhWk0TTrkVKRpiFNYOOcEJ';
      const parMeta = Number(sub.metadata?.repas || session.metadata?.repas);
      const parQte  = process.env.STRIPE_PRICE_ABO && priceId === process.env.STRIPE_PRICE_ABO
                        ? Number(ligne?.quantity) : NaN;
      const n = [parMeta, parQte].find(v => Number.isFinite(v) && v > 0);
      const formule = n ? n + '_repas' : (priceId === PRICE_4 ? '4_repas' : '3_repas');

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
