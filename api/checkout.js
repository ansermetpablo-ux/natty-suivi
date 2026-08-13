export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  /* GET — ce que cette route sait vendre aujourd'hui.
     L'achat à l'unité dépend d'un prix Stripe qui vit en variable
     d'environnement : le front ne peut pas le deviner, et afficher un bouton
     « À l'unité » qui échouerait au paiement serait pire que ne pas l'afficher
     (même discipline qu'`APPLE_ACTIF` sur l'écran de connexion).
     ⚠️ On ne renvoie qu'un BOOLÉEN, jamais l'identifiant de prix : cette route
     n'est pas authentifiée. */
  if (req.method === 'GET') {
    return res.status(200).json({ unite: !!process.env.STRIPE_PRICE_UNITE });
  }

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

    const { priceId, userId, token, plateforme, mode, quantite } = body;
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    // ⚠️ Ne jamais journaliser le body : offre.html y met l'adresse de
    // livraison, l'email et le token de session. Les logs Vercel sont
    // consultables par toute personne ayant accès au projet, et conservés —
    // une adresse postale n'a rien à y faire. On ne trace que ce qui sert au
    // diagnostic, et rien qui identifie quelqu'un.
    console.log('checkout: mode=%s, formule=%s, natif=%s, cle=%s',
      mode === 'unite' ? 'unite' : 'abonnement',
      priceId, plateforme === 'natif', !!STRIPE_SECRET_KEY);

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    /* ── L'achat À L'UNITÉ ─────────────────────────────────────────────────
       C'est un paiement UNIQUE, pas un abonnement : `mode=payment`, et la
       quantité est le nombre de plats commandés.

       ⚠️ LE PRIX NE VIENT PAS DU CLIENT, contrairement aux deux formules.
       Il est lu dans `STRIPE_PRICE_UNITE` côté serveur, donc l'appelant ne
       peut ni le choisir ni même le connaître. C'est plus sûr que la liste
       blanche des abonnements — et ça évite d'avoir à redéployer le jour où
       le prix du plat change.

       ⚠️ LA QUANTITÉ EST BORNÉE. Sans plafond, un POST bricolé commanderait
       10 000 plats et créerait une session de paiement à cinq chiffres ;
       sans plancher, une quantité nulle ou négative fait échouer Stripe avec
       un message que personne ne saura lire. */
    const aLUnite = mode === 'unite';
    if (aLUnite) {
      const PRIX_UNITE = process.env.STRIPE_PRICE_UNITE;
      if (!PRIX_UNITE) {
        return res.status(503).json({ error: 'La commande à l’unité n’est pas encore ouverte' });
      }
      const n = Math.floor(Number(quantite));
      if (!Number.isFinite(n) || n < 1 || n > 20) {
        return res.status(400).json({ error: 'Quantité invalide (1 à 20 plats)' });
      }
      return await creerSession({
        res, STRIPE_SECRET_KEY, token, userId, plateforme,
        priceId: PRIX_UNITE, quantite: n, stripeMode: 'payment'
      });
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

    return await creerSession({
      res, STRIPE_SECRET_KEY, token, userId, plateforme,
      priceId, quantite: 1, stripeMode: 'subscription'
    });

  } catch (err) {
    console.log('Error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}

/* Une seule fabrique de session pour les deux parcours — l'abonnement
   hebdomadaire et le plat à l'unité. Ils ne diffèrent que par trois choses :
   le prix, la quantité, et `subscription` contre `payment`.
   Les faire vivre dans deux blocs séparés, c'était garantir qu'un correctif de
   retour natif serait appliqué à l'un et oublié dans l'autre — le défaut qui a
   justement coûté le piège de la WebView (§8). */
async function creerSession(o) {
  const { res, STRIPE_SECRET_KEY, token, userId, plateforme,
          priceId, quantite, stripeMode } = o;
  const origin = 'https://natty-suivi.vercel.app';
  const unique = stripeMode === 'payment';

  // Dans l'app native, renvoyer vers le site laisserait l'utilisateur bloqué
  // hors de l'app apres son paiement. Stripe n'acceptant que des URL http(s),
  // on passe par checkout-retour.html, qui rebondit vers com.nattynutrition.app://.
  const natif = plateforme === 'natif';
  const retour = (statut) => natif
    ? origin + '/checkout-retour.html?statut=' + statut + '&token=' + encodeURIComponent(token || '')
    : (statut === 'ok'
        ? origin + '/?token=' + (token || '') + (unique ? '&commande=1' : '&subscribed=1')
        : origin + '/offre.html?token=' + (token || '') + '&cancelled=1');

  const params = new URLSearchParams();
  params.append('mode', stripeMode);
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', String(quantite));
  params.append('success_url', retour('ok'));
  params.append('cancel_url', retour('annule'));
  params.append('metadata[user_id]', userId || '');
  params.append('metadata[type]', unique ? 'unite' : 'abonnement');
  // ⚠️ `subscription_data` n'existe QUE pour un abonnement : l'envoyer sur un
  // paiement unique fait répondre Stripe en 400. C'est ce que lit le webhook
  // pour rattacher l'abonnement à son membre.
  if (!unique) params.append('subscription_data[metadata][user_id]', userId || '');

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  const session = await stripeRes.json();

  // La réponse de Stripe contient l'email et l'id client : on ne la journalise
  // qu'en cas d'échec, et seulement son message d'erreur.
  if (!stripeRes.ok) {
    console.log('checkout: Stripe %s — %s', stripeRes.status,
      (session && session.error && session.error.message) || 'sans détail');
  }

  if (!session.url) {
    return res.status(500).json({ error: 'No URL in response', details: session });
  }

  return res.status(200).json({ url: session.url });
}
