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

/* ── CRM session 12, §4.3 feature 3 — email entrant (Resend Receiving) ───
   Fusionné ICI plutôt que dans une route à part : `api/` est exactement à
   12 fonctions serverless, le plafond du plan Hobby (voir CLAUDE.md,
   « api/ ramené à 12 fonctions pile ») — même raison qui a déjà fait
   fusionner push-test dans push-amis et reserver-cuisine dans
   notifications. Le discriminant est le header lui-même : Stripe signe
   avec `stripe-signature`, Resend Receiving avec `svix-id`/`svix-timestamp`/
   `svix-signature` (Resend signe SES webhooks via Svix, vérifié dans leur
   doc avant d'écrire une ligne — https://docs.svix.com/receiving/verifying-payloads/how-manual).

   Décision de Pablo, non prise ici : QUEL domaine reçoit les emails —
   sous-domaine géré `<id>.resend.app` (zéro DNS) ou le domaine de Natty
   avec un enregistrement MX (risque de conflit avec une vraie boîte mail
   d'entreprise déjà en place). Ce code ne reçoit RIEN tant que ce choix
   n'est pas fait dans Resend (Dashboard → Receiving) ET le webhook
   `email.received` pointé vers cette URL. */
async function verifySvixSignature(rawBody, svixId, svixTimestamp, svixSigHeader, secret) {
  if (!svixId || !svixTimestamp || !svixSigHeader) return false;
  // Rejette les events trop anciens (protection contre le replay) — même
  // tolérance que la vérification Stripe ci-dessus.
  const age = Math.abs(Date.now() / 1000 - Number(svixTimestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  // Le secret Svix est `whsec_<base64>` : seule la partie après le préfixe
  // est la clé, encodée en base64 (jamais du texte brut comme Stripe).
  const secretB64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(secretB64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedContent = svixId + '.' + svixTimestamp + '.' + rawBody;
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  // Le header porte une liste « v1,<sig> » séparée par des espaces (une
  // signature par secret actif, en cas de rotation) : n'importe laquelle
  // qui correspond suffit.
  return svixSigHeader.split(' ').some(part => {
    const sig = part.startsWith('v1,') ? part.slice(3) : part;
    if (sig.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < sig.length; i++) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return mismatch === 0;
  });
}

/* Rattachement automatique par adresse (feature 3) : un email entrant
   d'un contact déjà connu se pose sur SA fiche et SON deal, sans qu'on
   ait rien fait — c'est tout l'intérêt d'une boîte unifiée. Un expéditeur
   inconnu arrive quand même (contact_id/projet_id null), rattachable à
   la main depuis la boîte unifiée. */
async function traiterEmailEntrant(event, supabase) {
  const data = event.data || {};
  const emailId = data.email_id;
  if (!emailId) return new Response('ok', { status: 200 });

  const RESEND = process.env.RESEND_API_KEY;
  if (!RESEND) return new Response('Réception non configurée (RESEND_API_KEY manquante)', { status: 500 });

  // Le webhook ne porte que les métadonnées (from/to/subject/message_id) —
  // le corps texte/html et in_reply_to demandent cet appel séparé
  // (https://resend.com/docs/dashboard/receiving/get-email-content).
  const contentRes = await fetch('https://api.resend.com/emails/receiving/' + emailId, {
    headers: { Authorization: 'Bearer ' + RESEND }
  });
  const content = await contentRes.json().catch(() => ({}));

  const from = (data.from || content.from || '').trim();
  const to = (Array.isArray(data.to) ? data.to[0] : data.to) || content.to || null;
  const emailNorm = from.toLowerCase().replace(/^.*<|>.*$/g, '').trim();

  let contactId = null, projetId = null;
  if (emailNorm) {
    try {
      const r = await supabase('crm_contacts?email=ilike.' + encodeURIComponent(emailNorm) + '&select=id,projet_id&limit=1', 'GET');
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]) { contactId = rows[0].id; projetId = rows[0].projet_id; }
    } catch (e) { /* un rattachement raté ne doit pas faire échouer la réception */ }
  }

  // `?on_conflict=message_id_email` + merge-duplicates : Resend peut
  // relivrer le même événement (mêmes garanties « at-least-once » que
  // tout webhook) — un second envoi ne doit pas dupliquer le message.
  // Nécessite l'index unique posé par la migration (§4bis de 0014).
  try {
    await supabase('crm_messages?on_conflict=message_id_email', 'POST', {
      contact_id: contactId, projet_id: projetId, canal: 'email', sens: 'entrant',
      sujet: data.subject || content.subject || null,
      contenu: content.text || null, contenu_html: content.html || null,
      statut: 'recu', expediteur_email: from || null, destinataire_email: to,
      message_id_email: data.message_id || content.message_id || null,
      in_reply_to: content.in_reply_to || null, lu: false
    }, { Prefer: 'return=minimal,resolution=merge-duplicates' });
  } catch (e) {
    console.log('email entrant — écriture crm_messages : %s', e.message);
  }
  return new Response('ok', { status: 200 });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // Un email entrant Resend porte svix-signature ; jamais stripe-signature.
  // Les deux n'arrivent jamais ensemble, donc l'ordre ne fait pas de choix
  // implicite entre deux payloads valides.
  if (req.headers.get('svix-signature')) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return new Response('Webhook non configuré (RESEND_WEBHOOK_SECRET manquant)', { status: 500 });
    const ok = await verifySvixSignature(rawBody, req.headers.get('svix-id'), req.headers.get('svix-timestamp'), req.headers.get('svix-signature'), secret);
    if (!ok) return new Response('Signature invalide', { status: 400 });
    let event;
    try { event = JSON.parse(rawBody); } catch (e) { return new Response('JSON invalide', { status: 400 }); }
    if (event.type !== 'email.received') return new Response('ok', { status: 200 });

    const SUPABASE_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w';
    const supabase = async (path, method, body, extraHeaders) => fetch(SUPABASE_URL + '/rest/v1/' + path, {
      method,
      headers: Object.assign({
        apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json', Prefer: 'return=representation'
      }, extraHeaders || {}),
      body: body ? JSON.stringify(body) : undefined
    });
    try {
      return await traiterEmailEntrant(event, supabase);
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  try {
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
          stripe_ref: 'cs_' + session.id,
          montant: session.amount_total, email: session.customer_details?.email
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
        stripe_ref: 'cs_' + session.id,
        montant: session.amount_total, email: session.customer_details?.email
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
          stripe_ref: 'in_' + invoice.id,
          montant: invoice.amount_paid, email: invoice.customer_email
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
    // 409 = déjà créé pour cette référence Stripe : un webhook rejoué. Normal —
    // et on ne renvoie pas le récapitulatif une seconde fois.
    if (r.status === 409) return;
    if (!r.ok) { console.log('bon de commande non créé — %s', r.status); return; }
    let bon = null;
    try { const a = await r.json(); bon = Array.isArray(a) ? a[0] : a; } catch (e) {}
    await envoyerRecap(supabase, Object.assign({}, b, { jour_livraison: jour, id: bon && bon.id }));
  } catch (e) {
    // Ne jamais faire échouer le webhook pour un bon : l'abonnement, lui, est
    // écrit. Stripe rejouerait sinon l'événement entier.
    console.log('bon de commande — %s', e.message);
  }
}


/* ── Le récapitulatif de commande, aux trois endroits demandés ────────────
   1. par EMAIL au client — l'adresse de son onboarding, sinon celle que
      Stripe a vue au paiement ;
   2. par EMAIL à contact@natty-nutrition.com — un mail par commande, c'est ce
      qui prévient l'équipe avant même d'ouvrir l'admin (où le bon est déjà) ;
   3. DANS L'APP — un message dans sa conversation (`messages`, expéditeur
      « nutritionniste ») : c'est le seul canal in-app qui existe déjà et que
      le client lit, et il déclenche la notification de message habituelle.
   Tout est best-effort : un email qui ne part pas ne doit jamais faire
   rejouer le webhook (Stripe réessaierait, et le bon existe déjà). */
const CONTACT = 'contact@natty-nutrition.com';
const JOURS_L = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MOIS_L = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function dateLongue(ymd) {
  if (!ymd) return 'à convenir';
  const d = new Date(ymd + 'T12:00:00Z');
  return JOURS_L[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS_L[d.getUTCMonth()];
}
function euros(centimes) {
  return Number.isFinite(centimes) ? (centimes / 100).toFixed(2).replace('.', ',') + ' €' : '';
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function envoyerRecap(supabase, b) {
  let prenom = '', email = '';
  try {
    const r = await supabase('onboarding?user_id=eq.' + encodeURIComponent(b.user_id) + '&select=prenom,email&order=created_at.desc&limit=3', 'GET');
    const rows = await r.json();
    (Array.isArray(rows) ? rows : []).forEach(o => { prenom = prenom || o.prenom || ''; email = email || o.email || ''; });
  } catch (e) {}
  email = email || b.email || '';

  // Les plats choisis à l'unité, par leur nom
  let plats = '';
  if (b.plats && b.plats.length) {
    try {
      const ids = b.plats.map(p => p.id).filter(Boolean);
      const r = await supabase('plats_menu?id=in.(' + ids.join(',') + ')&select=id,nom', 'GET');
      const rows = await r.json(); const nom = {};
      (Array.isArray(rows) ? rows : []).forEach(p => { nom[p.id] = p.nom; });
      plats = b.plats.map(p => (nom[p.id] || 'Plat') + ' × ' + p.n).join(', ');
    } catch (e) {}
  }

  const type = b.type === 'unite' ? 'Commande à l’unité' : 'Abonnement hebdomadaire';
  const lignes = [
    ['Formule', type + ' — ' + b.nb_repas + ' repas'],
    plats ? ['Plats', plats] : null,
    ['Livraison', dateLongue(b.jour_livraison)],
    ['Adresse', b.adresse || 'non renseignée — nous vous contactons'],
    b.montant ? ['Montant réglé', euros(b.montant)] : null
  ].filter(Boolean);

  const texte = 'Votre commande est confirmée ✅\n' + lignes.map(l => l[0] + ' : ' + l[1]).join('\n')
    + (b.type === 'abonnement' ? '\nVos recettes sont choisies par votre nutritionniste ; vous recevrez le détail avant la livraison.' : '');

  // 3. dans l'app
  try {
    await supabase('messages', 'POST', { user_id: b.user_id, expediteur: 'nutritionniste', contenu: texte, lu: false });
  } catch (e) { console.log('récap in-app — %s', e.message); }

  // 1 et 2. par email
  const RESEND = process.env.RESEND_API_KEY;
  if (!RESEND) { console.log('récap : RESEND_API_KEY absente, aucun email'); return; }
  const FROM = process.env.RESEND_FROM || 'Natty <onboarding@resend.dev>';
  const tableau = lignes.map(l => '<tr><td style="padding:8px 0;color:#9a9aaa;font-size:13px;">' + esc(l[0]) + '</td><td style="padding:8px 0 8px 16px;font-weight:600;color:#1a1a2e;font-size:13px;">' + esc(l[1]) + '</td></tr>').join('');
  const html = (titre, intro) => '<div style="font-family:-apple-system,Segoe UI,sans-serif;background:#f0f0f3;padding:28px;">'
    + '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;">'
    + '<div style="background:#1a1a2e;padding:26px 28px;color:#fff;"><div style="font-size:20px;font-weight:800;">' + esc(titre) + '</div>'
    + '<div style="font-size:13px;opacity:.6;margin-top:4px;">' + esc(intro) + '</div></div>'
    + '<div style="padding:22px 28px;"><table style="border-collapse:collapse;width:100%;">' + tableau + '</table>'
    + (b.id ? '<div style="font-size:11px;color:#b0b0c0;margin-top:14px;">Référence ' + esc(String(b.id).slice(0, 8)) + '</div>' : '')
    + '</div></div></div>';
  const envoyer = (to, subject, corps) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html: corps })
  }).then(r => { if (!r.ok) return r.text().then(t => console.log('récap email %s — %s', to === CONTACT ? 'équipe' : 'client', t.slice(0, 200))); })
    .catch(e => console.log('récap email — %s', e.message));

  const taches = [envoyer(CONTACT, '🧾 Nouvelle commande — ' + (prenom || 'client') + ' · ' + b.nb_repas + ' repas · ' + dateLongue(b.jour_livraison),
    html('Nouvelle commande', (prenom || b.user_id) + (email ? ' · ' + email : '') + ' — le bon est dans l’onglet Production de l’admin.'))];
  if (email) taches.push(envoyer(email, '✅ Votre commande Natty est confirmée',
    html('Commande confirmée' + (prenom ? ', ' + prenom : ''), 'Merci ! Voici le récapitulatif de votre commande.')));
  await Promise.all(taches);
}
