/* api/notifications.js — assigner quelqu'un à un objet du CRM le notifie
   à la fois dans l'interface (pop-up, table `notifications`) et par email
   avec une invitation calendrier (.ics) s'il y a une échéance.

   Fermée dès le premier jour — contrairement à api/send-email.js, cette
   route n'a pas d'appelant public existant à ne pas casser : la fermer
   proprement dès la construction, plutôt que de l'ouvrir puis devoir la
   refermer plus tard (voir docs/crm-spec.md, étape 0, sur l'état
   d'api/send-email.js — laissé ouvert pour l'instant, son cas est plus
   nuancé : il sert `onboarding.html`, une page PUBLIQUE, avant tout compte).

   Corps attendu (POST) :
   { destinataire, objet_type, objet_id?, titre, message?, echeance?,
     canal: 'popup' | 'email' | 'popup+email' }
   `echeance` au format YYYY-MM-DD. Sans elle, le canal 'email' est ignoré
   (il n'y a rien à mettre dans un calendrier) et la notification part en
   pop-up seule — annoncé dans la réponse, jamais en silence.
*/
const { identite, ligneStaff, emailDe, envoyerEmailInvitation, creerNotification, majEmailStatut } = require('./_notifications.js');

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
  const { destinataire, objet_type, objet_id, titre, message, echeance, canal } = body;
  if (!destinataire || !objet_type || !titre) {
    return res.status(400).json({ error: 'destinataire, objet_type et titre sont requis' });
  }

  const dest = await ligneStaff(destinataire);
  if (!dest) return res.status(404).json({ error: 'Destinataire introuvable ou inactif' });

  const veutEmail = canal === 'email' || canal === 'popup+email';
  const emailPossible = veutEmail && !!echeance;
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
      const dateDebut = new Date(echeance + 'T00:00:00Z');
      const r = await envoyerEmailInvitation({
        inviteEmail, inviteNom: dest.nom, titre, description: message,
        dateDebut, dateFin: dateDebut, uid: notif.id + '@natty-nutrition.com', sequence: 0
      });
      await majEmailStatut(notif.id, r.ok ? 'envoye' : 'echec', r.ok ? null : r.err);
      email = { tente: true, ok: r.ok, err: r.ok ? undefined : r.err };
    }
  }

  return res.status(200).json({ notification: notif, email });
};
