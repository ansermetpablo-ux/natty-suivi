const https = require('https');

/* ═══════════════════════════════════════════════════════════
   PLAFONDS — ce que cette route accepte de payer pour un appel
   ───────────────────────────────────────────────────────────
   ⚠️ CETTE ROUTE N'EST PAS AUTHENTIFIÉE, et elle relaie l'API Anthropic
   PAYANTE avec la clé de Natty. Un POST anonyme est donc facturé au compte.
   Le fermer demande d'abord de recenser ses appelants — `assets/ajout.js`
   (analyse photo), `assets/garde-manger.js` (scan de ticket), `assets/reco.js`,
   `narration.html` (photos de défi), `suivi.html`, `admin.html` — dont
   certains tournent sur des écrans sans session. En attendant, on borne ce
   qu'un seul appel peut coûter : ça ne referme pas la porte, ça empêche
   qu'un appel unique vide le compte.

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

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
