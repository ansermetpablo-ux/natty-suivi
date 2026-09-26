/* api/notifications.js — assigner quelqu'un à un objet du CRM le notifie
   à la fois dans l'interface (pop-up, table `notifications`) et par email
   avec une invitation calendrier (.ics) s'il y a une échéance.

   Fermée dès le premier jour — contrairement à api/send-email.js, cette
   route n'a pas d'appelant public existant à ne pas casser : la fermer
   proprement dès la construction, plutôt que de l'ouvrir puis devoir la
   refermer plus tard (voir docs/crm-spec.md, étape 0, sur l'état
   d'api/send-email.js — laissé ouvert pour l'instant, son cas est plus
   nuancé : il sert `onboarding.html`, une page PUBLIQUE, avant tout compte).

   Corps attendu (POST), deux formes selon ce qu'on notifie :
   { destinataire, objet_type, objet_id?, titre, message?, canal: 'popup' | 'email' | 'popup+email',
     echeance? }                                    — journée entière (missions/tâches)
   { ..., date_debut?, date_fin?, uid?, sequence? }  — créneau horaire (réunions), ISO complet
   `echeance` (YYYY-MM-DD) OU `date_debut` (ISO). Sans l'une des deux, le canal 'email' est
   ignoré (il n'y a rien à mettre dans un calendrier) et la notification part en pop-up seule —
   annoncé dans la réponse, jamais en silence.
   `uid`/`sequence` : pour un événement qui peut être RE-envoyé après modification (une réunion
   déplacée) — même `uid` d'un appel à l'autre, `sequence` incrémenté, et le calendrier du
   destinataire MET À JOUR l'événement déjà accepté au lieu d'en créer un second. Omis, l'appel
   se comporte comme avant : `uid` dérivé de la notification créée, `sequence` à 0.

   FUSIONNÉ AVEC L'ANCIEN api/reserver-cuisine.js (2026-09-25) : le plan
   Vercel de ce projet est **Hobby, 12 fonctions serverless maximum** — pas
   13 comme supposé lors d'une première fusion (push-amis/push-test), le
   message d'erreur de build l'a donné en toutes lettres. reserver-cuisine
   n'avait pas de raison de rester une fonction à part : même garde (session
   de staff, clé service), même famille (« envoyer un message business »).
   Son comportement est repris à l'identique, derrière `{action:'reserver_cuisine'}`
   dans le corps — un discriminant EXPLICITE plutôt qu'une détection de forme,
   pour ne pas dépendre de l'absence accidentelle d'un champ :
     POST /api/notifications
     { action:'reserver_cuisine', date, heure_debut, heure_fin, nb_personnes, note? }
   Toujours PAS une invitation calendrier (pas de .ics — le loueur de la
   cuisine n'est pas un membre de l'équipe à suivre dans `participations`) :
   un simple email business, composé et envoyé directement via Resend, sans
   passer par `envoyerEmailInvitation`/`construireICS`. Si `CUISINE_EMAIL`
   n'est pas configurée sur Vercel, refusé proprement (503, raison
   explicite) — jamais un silence qui ferait croire à une réservation
   envoyée ; le front-end retombe alors sur un `mailto:`/`sms:` composé
   côté client (§4.2 de la spec CRM).

   TROISIÈME ACTION (session 12, §4.3 feature 2) — un email commercial,
   toujours derrière un discriminant explicite :
     POST /api/notifications
     { action:'envoyer_message_commercial', to, subject, html|text, in_reply_to? }
   Même garde (staff), même Resend direct, jamais de .ics. La ligne
   `crm_messages` correspondante N'EST PAS écrite ici : sa RLS est déjà
   `est_staff()`, donc crm.html l'écrit lui-même après un succès — ce
   endpoint n'a qu'un rôle qu'un JWT de staff ne peut pas jouer, sortir
   la clé Resend du serveur.
*/
const { identite, ligneStaff, emailDe, envoyerEmailInvitation, creerNotification, majEmailStatut } = require('./_notifications.js');

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

  const body = req.body || {};
  if (body.action === 'reserver_cuisine') return reserverCuisine(body, moi, res);
  if (body.action === 'envoyer_message_commercial') return envoyerMessageCommercial(body, moi, res);

  const { destinataire, objet_type, objet_id, titre, message, echeance, date_debut, date_fin, uid, sequence, annule, canal } = body;
  if (!destinataire || !objet_type || !titre) {
    return res.status(400).json({ error: 'destinataire, objet_type et titre sont requis' });
  }

  const dest = await ligneStaff(destinataire);
  if (!dest) return res.status(404).json({ error: 'Destinataire introuvable ou inactif' });

  const veutEmail = canal === 'email' || canal === 'popup+email';
  const emailPossible = veutEmail && !!(echeance || date_debut);
  const notif = await creerNotification({
    destinataire, objetType: objet_type, objetId: objet_id, titre, message,
    canal, creePar: moi.nom || monId, emailStatut: emailPossible ? 'a_envoyer' : null
  });

  let email = { tente: false };
  if (emailPossible) {
    email.tente = true;
    const inviteEmail = await emailDe(destinataire);
    if (!inviteEmail) {
      await majEmailStatut(notif.id, 'echec', 'Email introuvable pour ce compte');
      email = { tente: true, ok: false, err: 'Email introuvable pour ce compte' };
    } else {
      // Deux formes : `date_debut` (ISO, un créneau horaire — réunion) ou
      // `echeance` (YYYY-MM-DD, journée entière — mission/tâche). Voir
      // construireICS/_notifications.js pour ce que `heure` change au .ics.
      const heure = !!date_debut;
      const dateDebut = heure ? new Date(date_debut) : new Date(echeance + 'T00:00:00Z');
      const dateFin = date_fin ? new Date(date_fin) : dateDebut;
      const r = await envoyerEmailInvitation({
        inviteEmail, inviteNom: dest.nom, titre, description: message,
        dateDebut, dateFin, heure,
        uid: uid || (notif.id + '@natty-nutrition.com'), sequence: sequence || 0, annule
      });
      await majEmailStatut(notif.id, r.ok ? 'envoye' : 'echec', r.ok ? null : r.err);
      email = { tente: true, ok: r.ok, err: r.ok ? undefined : r.err };
    }
  }

  return res.status(200).json({ notification: notif, email });
};

/* Reprise à l'identique d'api/reserver-cuisine.js (supprimé) — voir l'en-tête
   du fichier. `moi` est déjà la ligne staff de l'appelant, vérifiée par le
   handler avant ce branchement. */
async function reserverCuisine(body, moi, res) {
  const CUISINE_EMAIL = process.env.CUISINE_EMAIL;
  if (!CUISINE_EMAIL) return res.status(503).json({ error: "CUISINE_EMAIL n'est pas configurée sur Vercel", degrade: true });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(503).json({ error: 'RESEND_API_KEY absente', degrade: true });

  const { date, heure_debut, heure_fin, nb_personnes, note } = body;
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
}

/* Session 12 (§4.3 feature 2) — un email commercial simple, sans .ics
   (ce n'est pas une invitation calendrier). L'écriture de la ligne
   crm_messages n'a PAS besoin de la clé service : la RLS de cette table
   est déjà « est_staff() », donc crm.html l'écrit lui-même directement
   après un succès ici — ce endpoint n'a qu'un rôle qu'un JWT de staff
   ne peut pas jouer, obtenir la clé Resend côté serveur.
   `in_reply_to` (optionnel) est le Message-ID du message auquel on
   répond : posé sur les en-têtes In-Reply-To/References pour que le fil
   se recompose côté client mail du destinataire, pas seulement dans le
   CRM. ⚠️ `resend_id` renvoyé n'est PAS garanti être le Message-ID RFC
   5322 qui finira dans l'email réellement livré (Resend ne le documente
   pas explicitement) — à vérifier avec un vrai envoi/réponse avant de
   compter dessus pour le rattachement automatique d'une réponse. */
async function envoyerMessageCommercial(body, moi, res) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(503).json({ error: 'RESEND_API_KEY absente', degrade: true });

  const { to, subject, html, text, in_reply_to } = body;
  if (!to || !subject || !(html || text)) {
    return res.status(400).json({ error: 'to, subject et html (ou text) sont requis' });
  }

  const FROM = process.env.RESEND_FROM || 'Natty <onboarding@resend.dev>';
  const payload = {
    from: FROM, to: [to], subject,
    html: html || ('<div style="font-family:-apple-system,sans-serif;white-space:pre-wrap">' + escapeHtml(text) + '</div>'),
    reply_to: FROM
  };
  if (in_reply_to) payload.headers = { 'In-Reply-To': in_reply_to, References: in_reply_to };

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(502).json({ error: data.message || JSON.stringify(data) });
  return res.status(200).json({ ok: true, resend_id: data.id || null });
}
