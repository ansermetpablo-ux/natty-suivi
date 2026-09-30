/* Les bornes du nombre de repas par semaine, côté serveur — c'est la SEULE
   place qui compte : un POST bricolé ne passe pas par l'écran, qui lit d'ailleurs
   ces valeurs par le GET plutôt que d'en tenir une copie.
   Dix, et non sept : un plat par jour n'est pas le plafond réel, quelqu'un qui
   fait livrer déjeuner ET dîner sur une partie de la semaine dépasse la
   douzaine de repas. Le plafond n'est pas là pour dire ce qui est raisonnable,
   il est là pour qu'une quantité bricolée ne crée pas une session à quatre
   chiffres. */
const REPAS_MIN = 1, REPAS_MAX = 10;

/* La DURÉE de l'abonnement, en semaines (offre.html la fait choisir en héros,
   2 par défaut). Elle MULTIPLIE la quantité Stripe : on facture « repas ×
   semaines » plats d'un coup, et la souscription se renouvelle toutes les N
   semaines (`interval_count`). Facturer chaque semaine une quantité multipliée
   serait facturer N fois trop. 24 = le plafond du curseur ; Stripe accepte 52. */
const SEMAINES_MIN = 1, SEMAINES_MAX = 24, SEMAINES_DEFAUT = 2;
const CRENEAUX = ['11h30 – 13h30', '12h – 14h', '18h – 20h', '19h – 21h'];

/* La date de la PREMIÈRE livraison. Règle produit (2026-09-30) : on ne commande
   jamais du jour au lendemain, on commande pour la semaine SUIVANTE — donc du
   lundi qui suit à cinq semaines. Calculé à l'heure de Paris : le serveur est
   en UTC, et un dimanche 23 h à Paris y est encore dimanche… ou déjà lundi. */
function aujourdhuiParis() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}
function ajouterJours(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function lundiSuivant() {
  const auj = aujourdhuiParis();
  const j = new Date(auj + 'T12:00:00Z').getUTCDay();          // 0 = dimanche
  return ajouterJours(auj, j === 0 ? 1 : 8 - j);
}
function dateValide(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const min = lundiSuivant(), max = ajouterJours(min, 34);
  return v >= min && v <= max ? v : '';
}

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
    return res.status(200).json({
      unite: !!process.env.STRIPE_PRICE_UNITE,
      /* `abo` dit si l'abonnement se vend AU PLAT — donc si un nombre
         quelconque de repas par semaine est possible. Sans ce prix, seules les
         deux formules historiques (3 et 4) existent, et l'écran ne doit
         proposer qu'elles : afficher « 5 repas » pour se faire refuser au
         paiement serait pire que ne pas l'afficher. */
      abo: !!process.env.STRIPE_PRICE_ABO,
      repas: process.env.STRIPE_PRICE_ABO ? { min: REPAS_MIN, max: REPAS_MAX }
                                          : { liste: [3, 4] }
    });
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

    const { priceId, userId, token, plateforme, mode, quantite, repas } = body;

    /* Ce que la cuisine doit savoir du bon de commande, et qui n'était écrit
       NULLE PART jusqu'en septembre 2026 : le jour et l'adresse de livraison
       partaient d'offre.html vers ici, et s'arrêtaient là. Ils voyagent
       maintenant dans les métadonnées de la session Stripe, et c'est le
       webhook — au paiement, jamais avant — qui en fait un `bons_commande`.
       ⚠️ Une valeur de métadonnée Stripe est limitée à 500 caractères : on
       tronque l'adresse plutôt que de faire échouer le paiement dessus. */
    const livraison = {
      jour:    typeof body.jourLivraison === 'string' ? body.jourLivraison.slice(0, 20) : '',
      adresse: typeof body.adresse === 'string' ? body.adresse.slice(0, 480) : '',
      date:    dateValide(body.dateLivraison),
      creneau: CRENEAUX.indexOf(body.creneau) >= 0 ? body.creneau : '',
      // Les plats choisis à l'unité : [{id, n}] — l'attribution en cuisine
      // part de là. Bornée elle aussi.
      plats:   Array.isArray(body.plats)
        ? JSON.stringify(body.plats.slice(0, 20).map(function (p) {
            return { id: String(p && p.id || '').slice(0, 40), n: Math.max(1, Math.floor(Number(p && p.n) || 1)) };
          })).slice(0, 490)
        : ''
    };
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    // ⚠️ Ne jamais journaliser le body : offre.html y met l'adresse de
    // livraison, l'email et le token de session. Les logs Vercel sont
    // consultables par toute personne ayant accès au projet, et conservés —
    // une adresse postale n'a rien à y faire. On ne trace que ce qui sert au
    // diagnostic, et rien qui identifie quelqu'un.
    console.log('checkout: mode=%s, repas=%s, quantite=%s, natif=%s, cle=%s',
      mode === 'unite' ? 'unite' : 'abonnement',
      repas, quantite, plateforme === 'natif', !!STRIPE_SECRET_KEY);

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    /* ⚠️ Une date de livraison est OBLIGATOIRE et doit tomber la semaine
       suivante au plus tôt. L'écran grise la semaine en cours ; un POST
       bricolé, lui, ne passe pas par l'écran. */
    if (!livraison.date) {
      return res.status(400).json({ error: 'Choisissez une date de livraison à partir du ' + lundiSuivant() });
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
        res, STRIPE_SECRET_KEY, token, userId, plateforme, livraison,
        priceId: PRIX_UNITE, quantite: n, stripeMode: 'payment'
      });
    }

    /* ── L'ABONNEMENT, au plat ─────────────────────────────────────────────
       Le nombre de repas par semaine est libre : Stripe facture un prix
       UNITAIRE multiplié par la quantité, exactement comme la commande à
       l'unité. C'est ce qui remplace les deux formules figées.

       ⚠️⚠️ ON NE PEUT PAS METTRE UNE QUANTITÉ SUR LES ANCIENS PRIX. Ils valent
       27 € et 36 € À PLAT — ce sont 3 et 4 repas déjà multipliés. Leur passer
       `quantity: 5` facturerait 135 €, pas 45. D'où un prix distinct,
       `STRIPE_PRICE_ABO`, qui doit valoir 9 € par semaine et par plat.

       ⚠️ TANT QUE CE PRIX N'EXISTE PAS, ON NE VEND QUE 3 ET 4, via les anciens
       identifiants. C'est une dégradation volontaire et non un repli
       silencieux : 3 × 9 = 27 et 4 × 9 = 36, donc les deux chemins facturent
       le même tarif au plat. Refuser tout net aurait fermé la boutique en
       attendant qu'une variable d'environnement soit posée. */
    const PRIX_ABO = process.env.STRIPE_PRICE_ABO;
    const LEGACY = {
      3: process.env.STRIPE_PRICE_3_REPAS || 'price_1TbhMB0TTrkVKRpiPvbGHLyI',
      4: process.env.STRIPE_PRICE_4_REPAS || 'price_1TbhWk0TTrkVKRpiFNYOOcEJ'
    };

    // Le nombre de repas prime ; `priceId` reste accepté pour une page ouverte
    // avant ce déploiement, et il est alors le seul à décider.
    let n = Math.floor(Number(repas));
    if (!Number.isFinite(n) || n <= 0) {
      const ancien = Object.keys(LEGACY).filter(function (k) { return LEGACY[k] === priceId; })[0];
      if (!ancien) {
        console.log('abonnement refusé — repas=%s priceId=%s', repas, priceId);
        return res.status(400).json({ error: 'Formule inconnue' });
      }
      n = Number(ancien);
    }
    if (n < REPAS_MIN || n > REPAS_MAX) {
      return res.status(400).json({ error: 'Entre ' + REPAS_MIN + ' et ' + REPAS_MAX + ' repas par semaine' });
    }

    if (!PRIX_ABO && !LEGACY[n]) {
      return res.status(503).json({
        error: 'Seules les formules à 3 ou 4 repas sont ouvertes pour le moment'
      });
    }

    let semaines = Math.floor(Number(body.semaines));
    if (!Number.isFinite(semaines) || semaines <= 0) semaines = SEMAINES_DEFAUT;
    if (semaines < SEMAINES_MIN || semaines > SEMAINES_MAX) {
      return res.status(400).json({ error: 'Entre ' + SEMAINES_MIN + ' et ' + SEMAINES_MAX + ' semaines' });
    }

    return await creerSession({
      res, STRIPE_SECRET_KEY, token, userId, plateforme, livraison,
      priceId: PRIX_ABO || LEGACY[n],
      /* La quantité Stripe = plats × semaines (chemin au plat), ou semaines
         (chemin historique, où le prix porte déjà les 3 ou 4 repas). */
      quantite: (PRIX_ABO ? n : 1) * semaines,
      stripeMode: 'subscription', repas: n, semaines
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
          priceId, quantite, stripeMode, repas, livraison, semaines } = o;
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
  if (!unique && semaines && semaines > 1) {
    /* ⚠️ UN PRIX RÉCURRENT PORTE SON INTERVALLE : le prix au plat est
       HEBDOMADAIRE. Pour renouveler toutes les N semaines, on recompose un prix
       à la volée (`price_data`) avec le MÊME produit et le MÊME montant unitaire
       — lus chez Stripe, jamais pris du client — et `interval_count = N`. */
    const pr = await fetch('https://api.stripe.com/v1/prices/' + encodeURIComponent(priceId), {
      headers: { 'Authorization': 'Bearer ' + STRIPE_SECRET_KEY }
    }).then(function (r) { return r.json(); });
    if (!pr || !pr.unit_amount || !pr.product) {
      return res.status(500).json({ error: 'Prix Stripe illisible' });
    }
    params.append('line_items[0][price_data][currency]', pr.currency || 'eur');
    params.append('line_items[0][price_data][product]', typeof pr.product === 'string' ? pr.product : pr.product.id);
    params.append('line_items[0][price_data][unit_amount]', String(pr.unit_amount));
    params.append('line_items[0][price_data][recurring][interval]', 'week');
    params.append('line_items[0][price_data][recurring][interval_count]', String(semaines));
  } else {
    params.append('line_items[0][price]', priceId);
  }
  params.append('line_items[0][quantity]', String(quantite));
  params.append('success_url', retour('ok'));
  params.append('cancel_url', retour('annule'));
  params.append('metadata[user_id]', userId || '');
  params.append('metadata[type]', unique ? 'unite' : 'abonnement');
  // ⚠️ `subscription_data` n'existe QUE pour un abonnement : l'envoyer sur un
  // paiement unique fait répondre Stripe en 400. C'est ce que lit le webhook
  // pour rattacher l'abonnement à son membre.
  /* ⚠️ LE NOMBRE DE REPAS PART EN MÉTADONNÉE, et pas seulement en quantité.
     Le webhook en a besoin pour écrire `abonnements.formule`, et le déduire du
     prix ne marche plus depuis qu'un seul prix sert à toutes les formules.
     Le lire dans la quantité de la ligne serait possible mais fragile : elle
     vaut 1 sur le chemin historique, où c'est le prix qui porte le nombre. */
  if (repas) params.append('metadata[repas]', String(repas));
  // Jour, adresse et plats : lus par le webhook pour créer le bon de commande.
  // Sur un abonnement ils vont AUSSI sur la souscription, parce que c'est elle
  // que `invoice.paid` porte à chaque semaine suivante — la session, elle, ne
  // sert qu'à la première.
  const liv = livraison || {};
  if (liv.jour)    params.append('metadata[livraison]', liv.jour);
  if (liv.adresse) params.append('metadata[adresse]', liv.adresse);
  if (liv.plats)   params.append('metadata[plats]', liv.plats);
  if (liv.date)    params.append('metadata[date]', liv.date);
  if (liv.creneau) params.append('metadata[creneau]', liv.creneau);
  if (semaines)    params.append('metadata[semaines]', String(semaines));
  if (!unique) {
    if (semaines)    params.append('subscription_data[metadata][semaines]', String(semaines));
    if (liv.creneau) params.append('subscription_data[metadata][creneau]', liv.creneau);
    params.append('subscription_data[metadata][user_id]', userId || '');
    if (repas) params.append('subscription_data[metadata][repas]', String(repas));
    if (liv.jour)    params.append('subscription_data[metadata][livraison]', liv.jour);
    if (liv.adresse) params.append('subscription_data[metadata][adresse]', liv.adresse);
  }

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
