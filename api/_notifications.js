/* api/_notifications.js — partagé, jamais une route (préfixe `_`, Vercel
   l'ignore — même convention que _apns.js, _generation.js, _nutrition.js).

   Deux choses, toujours ensemble :
   1. écrire la ligne `notifications` qui fait apparaître la pop-up dans
      le CRM (sondée par crm/crm-auth.js) ;
   2. si un canal email est demandé et qu'il y a une date, générer un
      fichier .ics (invitation calendrier, RSVP) et l'envoyer par Resend.

   Les deux sont TOUJOURS faites par le même appel, jamais l'une sans
   l'autre : une notification « email » sans sa ligne en base ne
   s'afficherait jamais dans l'interface, et une ligne qui prétend avoir
   envoyé un email sans l'avoir fait mentirait à l'écran.

   ⚠️ Auth : session de STAFF obligatoire, vérifiée avec la clé SERVICE —
   jamais avec le jeton de l'appelant (même raisonnement qu'api/claude.js :
   sinon c'est l'appelant qui déciderait de qui il est). Voir api/notifications.js
   pour le point d'entrée HTTP qui applique cette vérification.
*/

const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';

async function identite(jwt) {
  if (!jwt) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_SERVICE_KEY || '', Authorization: 'Bearer ' + jwt }
    });
    if (!r.ok) return null;
    const moi = await r.json();
    return (moi && moi.id) ? moi.id : null;
  } catch (e) { return null; }
}

async function ligneStaff(userId) {
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  const r = await fetch(SB_URL + '/rest/v1/staff?user_id=eq.' + encodeURIComponent(userId) + '&select=*&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return (rows && rows[0] && rows[0].actif) ? rows[0] : null;
}

/* `staff` ne porte pas d'email (admin.html ne le demande pas à la
   création d'un compte) : on le lit dans auth.users, seule source qui ne
   peut pas diverger de l'email réel du compte Supabase Auth. */
async function emailDe(userId) {
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  const r = await fetch(SB_URL + '/auth/v1/admin/users/' + encodeURIComponent(userId), {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return (u && u.email) ? u.email : null;
}

function pad(n) { return String(n).padStart(2, '0'); }
function dateICS(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }

/* RFC 5545 : une ligne de plus de 75 OCTETS (pas caractères) doit être
   repliée sur la suivante avec une espace en tête, sinon certains clients
   (Outlook en tête) tronquent le champ au lieu de le lire en entier.
   ⚠️ Couper au caractère plutôt qu'à l'octet suffit en anglais, pas en
   français : chaque accent pèse 2 octets en UTF-8, donc une ligne comptée
   en `.length` peut dépasser 75 octets sans jamais le voir. Découpe par
   points de code Unicode ([...str]) pour ne jamais couper un accent en
   deux, en vérifiant le poids réel en octets à chaque ajout. */
function foldLine(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const chars = [...line];
  const morceaux = [];
  let courant = '', poids = 0, limite = 75;
  for (const c of chars) {
    const p = Buffer.byteLength(c, 'utf8');
    if (poids + p > limite) { morceaux.push(courant); courant = ''; poids = 0; limite = 74; }
    courant += c; poids += p;
  }
  if (courant) morceaux.push(courant);
  return morceaux.join('\r\n ');
}
function escapeICS(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Un événement JOURNÉE ENTIÈRE par défaut (les missions de la spec n'ont
   qu'une échéance, pas d'heure) — VALUE=DATE plutôt qu'un DTSTART/DTEND
   horaire inventé. `sequence` doit augmenter à chaque ré-envoi pour le
   MÊME `uid` : c'est ce qui fait qu'un calendrier met à jour l'événement
   déjà accepté au lieu d'en créer un second (§ 4.4 de la spec : « .ics
   mise à jour en cas de changement »). */
function construireICS({ uid, sequence, titre, description, dateDebut, dateFin, organisateurEmail, organisateurNom, inviteEmail, inviteNom, annule }) {
  const maintenant = new Date();
  const dtstamp = dateICS(maintenant) + 'T' + pad(maintenant.getUTCHours()) + pad(maintenant.getUTCMinutes()) + pad(maintenant.getUTCSeconds()) + 'Z';
  const debut = dateICS(dateDebut);
  const fin = dateICS(dateFin || dateDebut);
  const lignes = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Natty//CRM//FR',
    'METHOD:' + (annule ? 'CANCEL' : 'REQUEST'),
    'BEGIN:VEVENT',
    'UID:' + uid,
    'SEQUENCE:' + (sequence || 0),
    'DTSTAMP:' + dtstamp,
    'DTSTART;VALUE=DATE:' + debut,
    'DTEND;VALUE=DATE:' + fin,
    'SUMMARY:' + escapeICS(titre),
    description ? 'DESCRIPTION:' + escapeICS(description) : null,
    'STATUS:' + (annule ? 'CANCELLED' : 'CONFIRMED'),
    'ORGANIZER;CN=' + escapeICS(organisateurNom || 'Natty') + ':mailto:' + organisateurEmail,
    'ATTENDEE;CN=' + escapeICS(inviteNom || '') + ';RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:' + inviteEmail,
    'END:VEVENT', 'END:VCALENDAR'
  ].filter(x => x !== null).map(foldLine);
  return lignes.join('\r\n');
}

async function envoyerEmailInvitation({ inviteEmail, inviteNom, titre, description, dateDebut, dateFin, uid, sequence, annule }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return { ok: false, err: 'RESEND_API_KEY absente' };
  const FROM = process.env.RESEND_FROM || 'Natty <onboarding@resend.dev>';
  const organisateurEmail = (FROM.match(/<(.+)>/) || [])[1] || FROM;
  const ics = construireICS({ uid, sequence, titre, description, dateDebut, dateFin, organisateurEmail, organisateurNom: 'Natty', inviteEmail, inviteNom, annule });
  const html = '<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto">'
    + '<h2 style="margin:0 0 8px">' + escapeHtml(titre) + '</h2>'
    + (description ? '<p style="color:#555;white-space:pre-wrap">' + escapeHtml(description) + '</p>' : '')
    + '<p style="color:#999;font-size:13px">Le fichier joint s\'ajoute à votre calendrier — Accepter/Refuser y répond directement.</p>'
    + '</div>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [inviteEmail], subject: (annule ? 'Annulé : ' : '') + titre, html,
      attachments: [{ filename: 'evenement.ics', content: Buffer.from(ics).toString('base64') }]
    })
  });
  if (!res.ok) return { ok: false, err: await res.text() };
  return { ok: true };
}

/* Écrit la ligne `notifications` avec la clé service : c'est un appel
   serveur déjà authentifié plus haut (api/notifications.js), la RLS
   « n'importe quel membre peut notifier un collègue » existe pour les
   écritures faites en direct par le client, pas pour celle-ci. */
async function creerNotification({ destinataire, objetType, objetId, titre, message, canal, creePar, emailStatut }) {
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  const res = await fetch(SB_URL + '/rest/v1/notifications', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ destinataire, objet_type: objetType, objet_id: objetId || null, titre, message: message || null, canal: canal || 'popup', cree_par: creePar || null, email_statut: emailStatut || null })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return JSON.parse(text)[0];
}

async function majEmailStatut(id, statut, erreur) {
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  await fetch(SB_URL + '/rest/v1/notifications?id=eq.' + id, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_statut: statut, email_envoye_le: statut === 'envoye' ? new Date().toISOString() : null, email_erreur: erreur || null })
  });
}

module.exports = { identite, ligneStaff, emailDe, construireICS, envoyerEmailInvitation, creerNotification, majEmailStatut };
