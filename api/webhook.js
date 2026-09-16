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
        /* Un achat à l'unité n'est pas un abonnement, mais c'est BIEN une
           commande à préparer : elle donne un bon, avec les plats choisis. */
        await creerBon(supabase, {
          user_id: userId, type: 'unite',
          nb_repas: nombreDePlats(session),
          jour: session.metadata?.livraison, adresse: session.metadata?.adresse,
          plats: lireJson(session.metadata?.plats),
          stripe_ref: 'cs_' + session.id
        });
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

      const aboRes = await supabase('abonnements', 'POST', {
        user_id: userId,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        formule,
        statut: 'actif',
        date_debut: new Date().toISOString(),
      });
      let aboId = null;
      try { const a = await aboRes.json(); aboId = Array.isArray(a) && a[0] ? a[0].id : null; } catch (e) {}

      /* La PREMIÈRE semaine de l'abonnement : un bon, tout de suite. Les
         suivantes viennent d'`invoice.paid` (cycle), ci-dessous. La référence
         Stripe rend la création idempotente — un webhook rejoué ne double pas
         le bon (contrainte unique sur `stripe_ref`, donc 409, donc ignoré). */
      await creerBon(supabase, {
        user_id: userId, type: 'abonnement',
        nb_repas: n || (formule === '4_repas' ? 4 : 3),
        jour: session.metadata?.livraison || sub.metadata?.livraison,
        adresse: session.metadata?.adresse || sub.metadata?.adresse,
        abonnement_id: aboId,
        stripe_ref: 'cs_' + session.id
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

      /* Chaque RENOUVELLEMENT hebdomadaire est une livraison de plus, donc un
         bon de plus. La première facture (`subscription_create`) est déjà
         couverte par `checkout.session.completed` — la compter ici en ferait
         deux pour la même semaine. */
      if (invoice.billing_reason === 'subscription_cycle') {
        const meta = invoice.subscription_details?.metadata || {};
        let aboId = null;
        try {
          const r = await supabase('abonnements?stripe_subscription_id=eq.' + invoice.subscription + '&select=id&limit=1', 'GET');
          const a = await r.json(); aboId = Array.isArray(a) && a[0] ? a[0].id : null;
        } catch (e) {}
        await creerBon(supabase, {
          user_id: userId, type: 'abonnement',
          nb_repas: Number(meta.repas) || 3,
          jour: meta.livraison, adresse: meta.adresse,
          abonnement_id: aboId,
          stripe_ref: 'in_' + invoice.id
        });
      }
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


/* ── Le bon de commande ───────────────────────────────────────────────────
   Créé au paiement, jamais avant. `jour` est un nom de jour de la semaine
   (« mardi ») tel qu'offre.html le saisit : on le traduit en DATE — la
   prochaine occurrence de ce jour, à au moins deux jours d'ici, parce qu'un
   plat payé un lundi soir pour « mardi » ne se cuisine pas dans la nuit.
   Sans jour, le bon est créé SANS date : il ressort en rouge dans l'admin,
   qui la pose. Un bon sans date vaut mieux qu'un bon absent. */
const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function prochaineDate(jour) {
  const i = JOURS.indexOf(String(jour || '').toLowerCase());
  if (i < 0) return null;
  const d = new Date(); d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 2);
  while (d.getUTCDay() !== i) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function lundiDe(ymd) {
  if (!ymd) return null;
  const d = new Date(ymd + 'T12:00:00Z');
  const j = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (j === 0 ? 6 : j - 1));
  return d.toISOString().slice(0, 10);
}

function lireJson(s) {
  if (!s) return null;
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : null; } catch (e) { return null; }
}

/* Le nombre de plats d'un achat à l'unité : la quantité de la ligne n'est pas
   dans la session (il faudrait un second appel) ; les plats choisis, eux, y
   sont, et leur somme EST la quantité facturée. Repli sur `repas` puis 1. */
function nombreDePlats(session) {
  const plats = lireJson(session.metadata?.plats);
  if (plats && plats.length) {
    const n = plats.reduce((t, p) => t + (Number(p.n) || 0), 0);
    if (n > 0) return Math.min(40, n);
  }
  const r = Number(session.metadata?.repas);
  return Number.isFinite(r) && r > 0 ? Math.min(40, r) : 1;
}

async function creerBon(supabase, b) {
  const jour = prochaineDate(b.jour);
  try {
    const r = await supabase('bons_commande', 'POST', {
      user_id: b.user_id,
      type: b.type,
      nb_repas: b.nb_repas,
      jour_livraison: jour,
      semaine: lundiDe(jour),
      adresse: b.adresse || null,
      plats: b.plats || null,
      abonnement_id: b.abonnement_id || null,
      stripe_ref: b.stripe_ref || null,
      statut: 'a_attribuer'
    });
    // 409 = déjà créé pour cette référence Stripe : un webhook rejoué. Normal.
    if (!r.ok && r.status !== 409) {
      console.log('bon de commande non créé — %s', r.status);
    }
  } catch (e) {
    // Ne jamais faire échouer le webhook pour un bon : l'abonnement, lui, est
    // écrit. Stripe rejouerait sinon l'événement entier.
    console.log('bon de commande — %s', e.message);
  }
}
