// ═══════════════════════════════════════════════════════════
// Natty — Envoi de notifications push à APNs
// ───────────────────────────────────────────────────────────
// Module partagé, PAS une route : Vercel ignore les fichiers d'`api/` dont le
// nom commence par `_`. Les endpoints (push-test, rappel-macros, push-amis)
// passent tous par ici.
//
// POURQUOI `http2` ET NON `fetch` : l'API provider d'Apple n'accepte que
// HTTP/2. `fetch` (undici) parle HTTP/1.1 par défaut et se ferait fermer la
// connexion. On utilise donc le module `http2` de Node — d'où un handler en
// runtime Node, jamais edge.
//
// AUTHENTIFICATION : jeton JWT signé ES256 avec la clé .p8 (Apple Developer →
// Keys → Apple Push Notifications service). Apple refuse un jeton régénéré
// trop souvent (moins de 20 min) et un jeton de plus d'une heure : on le garde
// donc en cache module ~50 min. Une instance serverless survivant à plusieurs
// requêtes, ce cache sert réellement.
//
// VARIABLES D'ENVIRONNEMENT REQUISES (Vercel) :
//   APNS_KEY_ID   identifiant de la clé (10 caractères, visible à sa création)
//   APNS_P8       contenu du fichier .p8, en-têtes BEGIN/END compris.
//                 Les retours à la ligne peuvent être échappés en \n.
//   APNS_TEAM_ID  défaut SAZQ9AFAMZ
//   APNS_TOPIC    défaut com.pabloansermet.nattysuivi (= bundle id iOS réel,
//                 qui n'est PAS l'appId com.natty.app de capacitor.config.json)
//   APNS_ENV      'sandbox' (défaut, builds Xcode) ou 'production'
//                 (TestFlight et App Store). Un jeton obtenu en développement
//                 est rejeté par l'hôte de production, et réciproquement :
//                 c'est la première chose à vérifier devant un 400
//                 BadDeviceToken alors que « tout est bon ».
// ═══════════════════════════════════════════════════════════

import http2 from 'http2';
import crypto from 'crypto';

const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';

export function apnsConfigure() {
  const keyId  = process.env.APNS_KEY_ID;
  const p8     = process.env.APNS_P8;
  const teamId = process.env.APNS_TEAM_ID || 'SAZQ9AFAMZ';
  const topic  = process.env.APNS_TOPIC   || 'com.pabloansermet.nattysuivi';
  const env    = process.env.APNS_ENV     || 'sandbox';
  if (!keyId || !p8) return null;
  return {
    keyId, teamId, topic,
    p8: p8.replace(/\\n/g, '\n'),
    host: env === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
  };
}

let jetonCache = null;   // { valeur, expire }

function jetonApns(cfg) {
  const maintenant = Date.now();
  if (jetonCache && jetonCache.expire > maintenant) return jetonCache.valeur;

  const entete = { alg: 'ES256', kid: cfg.keyId };
  const corps  = { iss: cfg.teamId, iat: Math.floor(maintenant / 1000) };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signable = b64(entete) + '.' + b64(corps);

  // `dsaEncoding: 'ieee-p1363'` donne la signature brute r|s attendue par JWT.
  // Par défaut Node produit du DER, qu'Apple rejette avec un laconique 403.
  const signature = crypto.sign(
    'sha256',
    Buffer.from(signable),
    { key: crypto.createPrivateKey(cfg.p8), dsaEncoding: 'ieee-p1363' }
  ).toString('base64url');

  jetonCache = { valeur: signable + '.' + signature, expire: maintenant + 50 * 60 * 1000 };
  return jetonCache.valeur;
}

/* Un envoi = une requête HTTP/2. On rouvre une session par lot plutôt que de
   la garder ouverte entre invocations : une fonction serverless peut être gelée
   à tout moment, une session APNs orpheline coûte plus qu'elle ne rapporte. */
function envoyerUn(session, cfg, token, charge) {
  return new Promise((resolve) => {
    const corps = Buffer.from(JSON.stringify(charge));
    const req = session.request({
      ':method': 'POST',
      ':path': '/3/device/' + token,
      'authorization': 'bearer ' + jetonApns(cfg),
      'apns-topic': cfg.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': corps.length
    });

    let statut = 0, texte = '';
    req.setEncoding('utf8');
    req.on('response', (h) => { statut = h[':status']; });
    req.on('data', (c) => { texte += c; });
    req.on('end', () => {
      let raison = '';
      try { raison = (JSON.parse(texte || '{}').reason) || ''; } catch (e) {}
      resolve({ token, statut, raison });
    });
    req.on('error', (e) => resolve({ token, statut: 0, raison: e.message }));
    req.end(corps);
  });
}

/**
 * Envoie une même notification à plusieurs jetons.
 * @param {string[]} tokens
 * @param {{titre:string, corps:string, data?:object, badge?:number}} message
 * @returns {Promise<{envoyes:number, echecs:number, perimes:string[], details:Array}>}
 */
export async function apnsEnvoyer(tokens, message) {
  const cfg = apnsConfigure();
  if (!cfg) throw new Error('APNS_KEY_ID / APNS_P8 absents : clé Apple non configurée');
  if (!tokens || !tokens.length) return { envoyes: 0, echecs: 0, perimes: [], details: [] };

  const charge = {
    aps: {
      alert: { title: message.titre, body: message.corps },
      sound: 'default',
      ...(message.badge != null ? { badge: message.badge } : {})
    },
    ...(message.data || {})
  };

  const session = http2.connect('https://' + cfg.host);
  const details = [];
  try {
    for (const t of tokens) {
      details.push(await envoyerUn(session, cfg, t, charge));
    }
  } finally {
    session.close();
  }

  // 410 Unregistered / 400 BadDeviceToken : l'app a été désinstallée ou le
  // jeton appartient à l'autre environnement. Dans les deux cas il ne servira
  // plus jamais — on le désactive plutôt que de le repayer à chaque envoi.
  const perimes = details
    .filter(d => d.statut === 410 || d.raison === 'BadDeviceToken' || d.raison === 'Unregistered')
    .map(d => d.token);
  if (perimes.length) await desactiverJetons(perimes);

  return {
    envoyes: details.filter(d => d.statut === 200).length,
    echecs:  details.filter(d => d.statut !== 200).length,
    perimes,
    details
  };
}

async function desactiverJetons(tokens) {
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!KEY) return;
  const liste = tokens.map(t => '"' + t + '"').join(',');
  try {
    await fetch(`${SB_URL}/rest/v1/appareils?token=in.(${encodeURIComponent(liste)})`, {
      method: 'PATCH',
      headers: {
        apikey: KEY, Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/json', Prefer: 'return=minimal'
      },
      body: JSON.stringify({ actif: false })
    });
  } catch (e) { /* le prochain envoi retentera, sans dommage */ }
}

/* ── Accès Supabase partagé par les endpoints push ────────── */

export function sbHeaders() {
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  return { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
}

export async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return t ? JSON.parse(t) : [];
}

/** Jetons actifs des utilisateurs demandés → { user_id: [token, …] } */
export async function jetonsPar(userIds) {
  if (!userIds || !userIds.length) return {};
  const parUser = {};
  for (let i = 0; i < userIds.length; i += 50) {
    const lot = userIds.slice(i, i + 50).map(u => '"' + u + '"').join(',');
    const lignes = await sbGet(`appareils?actif=eq.true&user_id=in.(${encodeURIComponent(lot)})&select=user_id,token`);
    for (const l of lignes) (parUser[l.user_id] = parUser[l.user_id] || []).push(l.token);
  }
  return parUser;
}

/** Mémoire des envois (table push_etat) — évite les doublons entre exécutions. */
export async function lireEtat(cle) {
  try {
    const r = await sbGet(`push_etat?cle=eq.${encodeURIComponent(cle)}&select=valeur&limit=1`);
    return (r && r[0]) ? r[0].valeur : null;
  } catch (e) { return null; }
}

export async function ecrireEtat(cle, valeur) {
  try {
    await fetch(`${SB_URL}/rest/v1/push_etat?on_conflict=cle`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ cle, valeur: String(valeur), updated_at: new Date().toISOString() })
    });
  } catch (e) { /* sans mémoire, on renverra au pire un doublon */ }
}

/** Garde commune : les endpoints push ne sont jamais publics.
 *
 *  ⚠️ Trois façons de présenter le secret, et la troisième compte :
 *  un cron Vercel n'ajoute **ni** `?secret=` **ni** `x-cron-secret` — il envoie
 *  `Authorization: Bearer $CRON_SECRET` tout seul, à condition que la variable
 *  existe. Une garde qui ne lirait que les deux premières formes laisserait
 *  chaque exécution programmée repartir en 401 sans que rien ne le signale
 *  (c'est le cas d'`api/conseils-hebdo`, voir §7).
 *
 *  Fail-closed : sans `CRON_SECRET` configurée, tout est refusé. Une garde qui
 *  comparerait deux `undefined` laisserait l'endpoint ouvert à qui connaît
 *  l'URL — et ces endpoints envoient des notifications à de vraies personnes. */
export function autorise(req) {
  const attendu = process.env.CRON_SECRET;
  if (!attendu) return false;
  const entetes = req.headers || {};
  const porteur = String(entetes.authorization || '').replace(/^Bearer\s+/i, '');
  const secret = req.query?.secret || entetes['x-cron-secret'] || porteur;
  return secret === attendu;
}
