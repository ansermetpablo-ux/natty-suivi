/* api/reserver-cuisine.js — l'action « Réserver la cuisine » du bloc Test
   produit (docs/crm-spec.md §4.2) : compose un message avec date, heure
   d'arrivée, heure de fin et nombre de personnes, et l'envoie par email.

   Ce n'est PAS une invitation calendrier (pas de .ics — le loueur n'est
   pas un membre de l'équipe à suivre dans `participations`) : un simple
   email business, donc PAS `api/_notifications.js`. Et ce n'est pas non
   plus `api/send-email.js` — celui-ci est délibérément ouvert (§0 de la
   spec) parce qu'il sert `onboarding.html`, une page PUBLIQUE avant tout
   compte ; l'ouvrir davantage pour un usage interne serait un relais
   d'envoi anonyme. Fermée dès le premier jour, même principe que
   `api/notifications.js` : session de STAFF vérifiée avec la clé SERVICE.

   Corps attendu (POST) :
   { date, heure_debut, heure_fin, nb_personnes, note? }
   `date` au format YYYY-MM-DD, `heure_debut`/`heure_fin` en HH:MM.

   Si `CUISINE_EMAIL` n'est pas configurée sur Vercel, l'envoi est refusé
   proprement (503, raison explicite) — jamais un silence qui ferait croire
   à une réservation envoyée. Le front-end retombe alors sur un `mailto:`/
   `sms:` composé côté client (§4.2 : les deux canaux sont prévus).
*/
const { identite, ligneStaff } = require('./_notifications.js');

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const monId = await identite(jwt);
  if (!monId) return res.status(401).json({ error: 'Session requise' });
  const moi = await ligneStaff(monId);
  if (!moi) return res.status(403).json({ error: "Ce compte n'a pas de rôle d'équipe actif" });

  const CUISINE_EMAIL = process.env.CUISINE_EMAIL;
  if (!CUISINE_EMAIL) return res.status(503).json({ error: "CUISINE_EMAIL n'est pas configurée sur Vercel", degrade: true });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(503).json({ error: 'RESEND_API_KEY absente', degrade: true });

  const { date, heure_debut, heure_fin, nb_personnes, note } = req.body || {};
  if (!date || !heure_debut || !heure_fin || !nb_personnes) {
    return res.status(400).json({ error: 'date, heure_debut, heure_fin et nb_personnes sont requis' });
  }

  const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const subject = `Réservation cuisine — ${dateStr}, ${heure_debut}–${heure_fin}`;
  const texte = `Bonjour,\n\nNous souhaitons réserver la cuisine :\n\n`
    + `Date : ${dateStr}\nArrivée : ${heure_debut}\nFin : ${heure_fin}\nNombre de personnes : ${nb_personnes}\n`
    + (note ? `\n${note}\n` : '')
    + `\nMerci de confirmer.\n\n${moi.nom || 'L’équipe Natty'}`;
  const html = '<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;white-space:pre-wrap">' + escapeHtml(texte) + '</div>';

  const FROM = process.env.RESEND_FROM || 'Natty <onboarding@resend.dev>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [CUISINE_EMAIL], subject, html })
  });
  if (!r.ok) return res.status(502).json({ error: await r.text() });
  return res.status(200).json({ ok: true, texte });
};
