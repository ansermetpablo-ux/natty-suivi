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

    const { priceId, userId, token, plateforme } = body;
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    // ⚠️ Ne jamais journaliser le body : offre.html y met l'adresse de
    // livraison, l'email et le token de session. Les logs Vercel sont
    // consultables par toute personne ayant accès au projet, et conservés —
    // une adresse postale n'a rien à y faire. On ne trace que ce qui sert au
    // diagnostic, et rien qui identifie quelqu'un.
    console.log('checkout: formule=%s, natif=%s, cle=%s',
      priceId, plateforme === 'natif', !!STRIPE_SECRET_KEY);

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    // Le priceId vient du client : sans contrôle, n'importe quel prix existant
    // sur le compte Stripe pourrait être souscrit (un prix à 0, par exemple).
    // Seules les deux formules réelles sont acceptées.
    const PRIX_AUTORISES = [
      'price_1TbhMB0TTrkVKRpiPvbGHLyI', // 3 repas / semaine — 27 €
      'price_1TbhWk0TTrkVKRpiFNYOOcEJ'  // 4 repas / semaine — 36 €
    ];
    if (!PRIX_AUTORISES.includes(priceId)) {
      console.log('priceId refusé:', priceId);
      return res.status(400).json({ error: 'Formule inconnue' });
    }

    const origin = 'https://natty-suivi.vercel.app';

    // Dans l'app native, renvoyer vers le site laisserait l'utilisateur bloqué
    // hors de l'app apres son paiement. Stripe n'acceptant que des URL http(s),
    // on passe par checkout-retour.html, qui rebondit vers com.natty.app://.
    const natif = plateforme === 'natif';
    const retour = (statut) => natif
      ? origin + '/checkout-retour.html?statut=' + statut + '&token=' + encodeURIComponent(token || '')
      : (statut === 'ok'
          ? origin + '/?token=' + (token || '') + '&subscribed=1'
          : origin + '/offre.html?token=' + (token || '') + '&cancelled=1');

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', retour('ok'));
    params.append('cancel_url', retour('annule'));
    params.append('metadata[user_id]', userId || '');
    params.append('subscription_data[metadata][user_id]', userId || '');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const session = await stripeRes.json();

    // La réponse de Stripe contient l'email et l'id client : on ne la
    // journalise qu'en cas d'échec, et seulement son message d'erreur.
    if (!stripeRes.ok) {
      console.log('checkout: Stripe %s — %s', stripeRes.status,
        (session && session.error && session.error.message) || 'sans détail');
    }

    if (!session.url) {
      return res.status(500).json({ error: 'No URL in response', details: session });
    }

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.log('Error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}
