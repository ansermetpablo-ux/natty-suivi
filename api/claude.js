const https = require('https');

const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';

/* ═══════════════════════════════════════════════════════════
   CETTE ROUTE EST FERMÉE — session obligatoire (août 2026)
   ───────────────────────────────────────────────────────────
   ⚠️ ELLE ÉTAIT OUVERTE, ET C'ÉTAIT UN TROU DE FACTURATION. Elle relaie
   l'API Anthropic PAYANTE avec la clé de Natty : n'importe qui connaissant
   l'URL faisait tourner le modèle aux frais du compte, et choisissait
   lui-même `max_tokens`. Relevé le 2026-08-12 en s'en servant pour valider
   la génération — trois appels complets, ~9 400 jetons chacun, sans la
   moindre clé.

   Le modèle d'authentification est celui d'`api/save-conseils.js` et
   d'`api/recalc-macros.js` : le jeton est vérifié auprès de GoTrue avec la
   CLÉ SERVICE, jamais avec le jeton de l'appelant — sinon c'est l'appelant
   qui décide de qui il est. On ne vérifie QUE l'existence d'une session : il
   n'y a pas de `user_id` dans le corps, donc rien à faire correspondre.

   LES APPELANTS, tous recensés avant de fermer :
   • `assets/ajout.js` (×3), `assets/garde-manger.js`, `assets/reco.js`,
     `suivi.html` (×3) → passent par `Natty.enTetesIA()`, qui rafraîchit la
     session au besoin ;
   • `narration.html` → n'a pas core.js (autonome par choix), lit la session
     en localStorage. Sa vérification de photo est fail-open : un 401 accepte
     la photo au lieu de bloquer le défi ;
   • `admin.html` → `jetonStaff()`, le JWT du compte d'équipe ;
   • ⚠️ l'ancien `index.html` (dashboard web en iframe Wix) a CINQ appels et
     aucune session : ils repartent tous en 401. C'est le même arbitrage que
     pour `save-conseils` — cette page ne LIT plus rien depuis l'activation
     de la RLS, elle affiche un tableau de bord vide, et l'app native ne
     l'embarque pas. Fermer ne casse donc rien qui fonctionnait encore.

   PLAFONDS — ce que cette route accepte de payer pour un appel
   ───────────────────────────────────────────────────────────
   Ils restent en place : une session vole, et un compte légitime peut aussi
   partir en boucle. Une porte fermée n'est pas une raison de retirer le
   compteur.

   Les valeurs viennent des appelants RÉELS, relevées, pas devinées :
   • sortie — le plus gourmand est `assets/reco.js`, qui demande
     `Math.min(16000, 3200 * nb + 1600)`, soit 11 200 pour ses 3 recettes de
     « Découvrir ». Son propre plafond est 16 000 : on prend le même, sinon
     c'est nous qui casserions la fonctionnalité en la bornant plus bas.
     ⚠️ La génération de la semaine (9 400 jetons) ne passe PAS par ici :
     `api/_generation.js` appelle `api.anthropic.com` en direct. Ce plafond
     ne la concerne pas.
   • entrée — le plus long prompt mesuré est celui de la génération, 16 626
     caractères. 80 000 laisse une marge large tout en écartant l'envoi d'un
     roman.
   • image — les photos de plat compressées font ~200 à 800 Ko en base64.
     6 Mo couvre un cliché non compressé et refuse une vidéo déguisée.
   ═══════════════════════════════════════════════════════════ */
const MAX_TOKENS_PLAFOND = 16000;
const MAX_PROMPT_CARS = 80000;
const MAX_IMAGE_CARS = 6 * 1024 * 1024;

/* Ce jeton correspond-il à une session valide ? Rend l'identifiant, ou null.
   ⚠️ Interrogé avec la clé SERVICE : demander à l'appelant de prouver son
   identité avec ses propres en-têtes reviendrait à le croire sur parole. */
async function identite(jwt) {
  if (!jwt) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY || '',
        Authorization: 'Bearer ' + jwt
      }
    });
    if (!r.ok) return null;
    const moi = await r.json();
    return (moi && moi.id) ? moi.id : null;
  } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  // ⚠️ `Authorization` DOIT être annoncé : sans lui le pré-vol CORS rejette
  //    l'en-tête, l'appel arrive sans jeton depuis un navigateur, et repart en
  //    401 alors que l'appelant l'avait bien envoyé. Piège déjà payé sur
  //    api/save-conseils.js.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  /* Sans clé service, `identite()` ne peut rien vérifier : on REFUSE, plutôt
     que de laisser passer faute de pouvoir contrôler. Vérifié le 2026-08-13 :
     la variable est bien posée sur Vercel (`api/save-conseils` répond
     « Session requise » et non « clé manquante »), donc ce garde-fou ne coupe
     pas l'IA de l'app par surprise. */
  if (!process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY manquante' });
  }
  const jeton = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!(await identite(jeton))) {
    return res.status(401).json({ error: 'Session requise' });
  }

  const { prompt, max_tokens, image, media_type } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  /* Un prompt ou une image hors normes est REFUSÉ, pas tronqué : couper un
     prompt en deux donnerait une réponse à une question amputée, et c'est
     l'appelant qui aurait l'air d'avoir tort. Le plafond de sortie, lui, se
     rabote en silence — une réponse plus courte reste une réponse. */
  if (typeof prompt !== 'string' || prompt.length > MAX_PROMPT_CARS) {
    return res.status(413).json({ error: 'prompt trop long (max ' + MAX_PROMPT_CARS + ' caractères)' });
  }
  if (image && (typeof image !== 'string' || image.length > MAX_IMAGE_CARS)) {
    return res.status(413).json({ error: 'image trop lourde (max ' + MAX_IMAGE_CARS + ' caractères base64)' });
  }

  // ⚠️ `Number()` avant de comparer : un `max_tokens` en chaîne ("999999")
  // passerait à travers un simple `Math.min`, et `NaN` ferait refuser
  // l'appel par l'API. Toute valeur inutilisable retombe sur le défaut.
  const demande = Number(max_tokens);
  const plafond = Number.isFinite(demande) && demande > 0
    ? Math.min(Math.floor(demande), MAX_TOKENS_PLAFOND)
    : 800;

  let content;
  if (image) {
    content = [
      { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image } },
      { type: 'text', text: prompt }
    ];
  } else {
    content = prompt;
  }

  const bodyStr = JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: plafond,
    messages: [{ role: 'user', content }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const reqHttp = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (resp.statusCode !== 200) {
            res.status(500).json({ error: parsed.error?.message || 'Claude error', status: resp.statusCode });
          } else {
            const text = parsed.content?.[0]?.text || '';
            res.status(200).json({ text });
          }
        } catch(e) {
          res.status(500).json({ error: 'Parse error: ' + e.message });
        }
        resolve();
      });
    });

    reqHttp.on('error', (e) => {
      res.status(500).json({ error: e.message });
      resolve();
    });

    reqHttp.write(bodyStr);
    reqHttp.end();
  });
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};
