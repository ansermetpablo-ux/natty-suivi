/* api/_commande.js — la confirmation d'une commande par le client.
   Partagé (préfixe `_`, Vercel n'en fait pas une route) entre :
     - api/webhook.js  (edge)  : l'email part tout seul, au paiement ;
     - api/checkout.js (node)  : la page publique commande.html (lire, valider,
       modifier) et le CRM (envoyer à la main, notifier après une modification).
   ⚠️ Donc RIEN ici qui ne tourne pas en edge : fetch, Intl, et c'est tout —
   ni Buffer, ni crypto de Node.

   Pourquoi pas une route à part : `api/` est à 12 fonctions, le plafond du plan
   Hobby (CLAUDE.md, fusion de push-test et reserver-cuisine). checkout.js est
   déjà la route publique des commandes — la confirmation en est la suite.

   ⚠️ LE JETON. Le lien de l'email porte `bons_commande.confirmation_token`
   (32 hex, ~122 bits, posé par la base). Il donne accès à UNE commande : ce
   qu'elle contient, sa date, son adresse. Jamais à un compte. La page ne voit
   la base qu'au travers de ces fonctions, qui lisent avec la clé service.

   ⚠️ LA RÈGLE J+7. Une commande client n'est jamais livrée moins de 7 jours
   après avoir été passée (commandée un mardi → le mardi suivant au plus tôt).
   Elle est refaite à TROIS endroits, chacun pour une raison : l'écran (pour
   ne rien proposer d'impossible), l'API (un POST bricolé ne passe pas par
   l'écran), la base (trigger `bons_commande_j7`, migration 0023 : rien ne
   passe à côté, pas même le CRM). Une modification ultérieure ne peut pas non
   plus ramener une livraison à moins de 2 jours : la cuisine produit à J-2.

   ⚠️ LA ZONE. Natty ne livre qu'en Île-de-France (75, 77, 78, 91, 92, 93, 94,
   95). Une adresse hors zone donnée dans le questionnaire ANNULE la commande,
   prévient l'équipe dans le CRM (pop-up) et le client par email. Le paiement
   n'est PAS remboursé automatiquement ni l'abonnement Stripe résilié : c'est
   de l'argent, ça se fait à la main — la notification le dit. */

const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
const ORIGIN = 'https://natty-suivi.vercel.app';
const CONTACT = 'contact@natty-nutrition.com';
export const CRENEAUX = ['11h30 – 13h30', '12h – 14h', '18h – 20h', '19h – 21h'];
export const DELAI_JOURS = 7;           // commande → livraison, au plus tôt
const DELAI_MODIF = 2;                  // aujourd'hui → livraison modifiée, au plus tôt
const FENETRE = 60;                     // une date au-delà de 60 jours est une faute de frappe
const FIGES = ['en_production', 'en_livraison', 'livre', 'annule'];

const cle = () => process.env.SUPABASE_SERVICE_KEY || '';
async function sb(path, o) {
  o = o || {};
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: o.method || 'GET',
    headers: {
      apikey: cle(), Authorization: 'Bearer ' + cle(), 'Content-Type': 'application/json',
      Prefer: o.prefer || 'return=representation'
    },
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
  if (!r.ok) { const err = new Error((d && d.message) || t || ('HTTP ' + r.status)); err.status = r.status; throw err; }
  return d;
}

/* ── Les dates, à l'heure de Paris ───────────────────────────────────────── */
export function aujourdhuiParis() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}
export function dateParis(ts) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(ts ? new Date(ts) : new Date());
}
export function ajouterJours(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function ecartJours(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}
export function lundiDe(ymd) {
  if (!ymd) return null;
  const d = new Date(ymd + 'T12:00:00Z'), j = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (j === 0 ? 6 : j - 1));
  return d.toISOString().slice(0, 10);
}
/* La première date possible pour une commande passée à `creeLe` (ou
   maintenant), et — si on modifie après coup — jamais à moins de 2 jours. */
export function dateMinPour(creeLe, modification) {
  const parCommande = ajouterJours(dateParis(creeLe), DELAI_JOURS);
  if (!modification) return parCommande;
  const parCuisine = ajouterJours(aujourdhuiParis(), DELAI_MODIF);
  return parCommande > parCuisine ? parCommande : parCuisine;
}

/* ── L'adresse ───────────────────────────────────────────────────────────── */
export function codePostal(adresse) {
  const m = String(adresse || '').match(/(?:^|\D)(\d{5})(?!\d)/g);
  return m ? m[m.length - 1].replace(/\D/g, '') : '';
}
export function estIDF(cp) { return /^(75|77|78|91|92|93|94|95)\d{3}$/.test(String(cp || '')); }
export function composerAdresse(num, rue, cp, ville) {
  return (String(num).trim() + ' ' + String(rue).trim() + ', ' + String(cp).trim() + (ville ? ' ' + String(ville).trim() : '')).trim();
}
export function decomposerAdresse(a) {
  const s = String(a || '').trim();
  const m = s.match(/^\s*(\d+\s*(?:bis|ter|[a-d])?)\s+(.+?),?\s+(\d{5})\s*(.*)$/i);
  if (m) return { num: m[1].trim(), rue: m[2].replace(/,\s*$/, '').trim(), cp: m[3], ville: m[4].trim() };
  return { num: '', rue: s, cp: codePostal(s), ville: '' };
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const JOURS_L = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dateLongue(ymd) {
  if (!ymd) return '';
  const d = new Date(ymd + 'T12:00:00Z');
  return JOURS_L[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS_L[d.getUTCMonth()];
}

/* ── Une commande = un paiement, donc parfois PLUSIEURS bons ───────────────
   Un abonnement de N semaines crée N bons (`stripe_ref`, `#1`, `#2`…). Le
   client confirme sa commande, pas chaque semaine : la tête du groupe porte le
   jeton, et une date modifiée décale toutes les semaines d'autant. */
const COLS = 'id,user_id,type,nb_repas,jour_livraison,semaine,adresse,plats,statut,abonnement_id,stripe_ref,notes,created_at,'
  + 'contact_nom,contact_tel,instructions_acces,code_reception,creneau_livraison,confirmation_token,confirmation_statut,'
  + 'confirmation_envoyee_at,confirmation_nb_envois,confirmee_at,confirmation_reponses,modif_non_notifiee,modifiee_at,notifiee_at,annulation_motif';

async function groupeDe(bon) {
  const base = String(bon.stripe_ref || '').split('#')[0];
  let bons = [bon];
  if (base) {
    bons = await sb('bons_commande?or=(stripe_ref.eq.' + encodeURIComponent(base) + ',stripe_ref.like.'
      + encodeURIComponent(base + '#*') + ')&select=' + COLS);
    if (!Array.isArray(bons) || !bons.length) bons = [bon];
  }
  bons.sort((a, b) => (a.jour_livraison || '9999').localeCompare(b.jour_livraison || '9999') || String(a.created_at).localeCompare(String(b.created_at)));
  const tete = bons.find(b => b.stripe_ref === base) || bons[0];
  return { tete, bons };
}
async function bonParJeton(jeton) {
  if (!/^[0-9a-f]{20,64}$/i.test(String(jeton || ''))) return null;
  const r = await sb('bons_commande?confirmation_token=eq.' + encodeURIComponent(jeton) + '&select=' + COLS + '&limit=1');
  return r && r[0] ? r[0] : null;
}
async function bonParId(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return null;
  const r = await sb('bons_commande?id=eq.' + id + '&select=' + COLS + '&limit=1');
  return r && r[0] ? r[0] : null;
}

/* Le prénom et l'email : l'onboarding d'abord (le plus renseigné), puis le
   compte Auth — un client entré par Google sans questionnaire n'a que lui. */
async function client(uid) {
  let prenom = '', email = '';
  if (!uid || /^(crm|bloc):/.test(uid)) return { prenom, email };
  try {
    const rows = await sb('onboarding?user_id=eq.' + encodeURIComponent(uid) + '&select=prenom,email&order=created_at.desc&limit=5');
    (rows || []).forEach(o => { prenom = prenom || o.prenom || ''; email = email || o.email || ''; });
  } catch (e) {}
  if (!email) {
    try {
      const r = await fetch(SB_URL + '/auth/v1/admin/users/' + encodeURIComponent(uid), { headers: { apikey: cle(), Authorization: 'Bearer ' + cle() } });
      if (r.ok) { const u = await r.json(); email = (u && u.email) || ''; }
    } catch (e) {}
  }
  return { prenom, email };
}

/* Ce que contient chaque livraison : les recettes attribuées si la cuisine les
   a posées, sinon les plats choisis à l'unité, sinon le nombre de repas. */
async function contenus(bons) {
  const out = {};
  const ids = bons.map(b => b.id);
  let attrs = [], recNom = {}, platNom = {};
  try { attrs = await sb('bons_attributions?bon_id=in.(' + ids.join(',') + ')&select=bon_id,recette_id,nb_portions') || []; } catch (e) {}
  const recIds = [...new Set(attrs.map(a => a.recette_id))];
  if (recIds.length) { try { (await sb('recettes?id=in.(' + recIds.join(',') + ')&select=id,nom') || []).forEach(r => { recNom[r.id] = r.nom; }); } catch (e) {} }
  const platIds = [...new Set(bons.flatMap(b => (Array.isArray(b.plats) ? b.plats : []).map(p => p && p.id).filter(Boolean)))];
  if (platIds.length) { try { (await sb('plats_menu?id=in.(' + platIds.join(',') + ')&select=id,nom') || []).forEach(p => { platNom[p.id] = p.nom; }); } catch (e) {} }
  bons.forEach(b => {
    const a = attrs.filter(x => x.bon_id === b.id);
    if (a.length) out[b.id] = a.map(x => ({ nom: recNom[x.recette_id] || 'Recette', n: x.nb_portions }));
    else if (Array.isArray(b.plats) && b.plats.length) out[b.id] = b.plats.map(p => ({ nom: platNom[p.id] || 'Plat', n: Number(p.n) || 1 }));
    else out[b.id] = [];
  });
  return out;
}

/* Les informations de livraison sont-elles complètes ? Une date, un créneau,
   une adresse avec un code postal. Le téléphone est demandé, pas exigé. */
function manques(tete) {
  const m = [];
  if (!tete.jour_livraison) m.push('date');
  if (!tete.creneau_livraison) m.push('creneau');
  if (!tete.adresse || !codePostal(tete.adresse)) m.push('adresse');
  return m;
}
function verrou(g) {
  const tete = g.tete;
  if (tete.statut === 'annule') return 'Cette commande est annulée.';
  if (g.bons.every(b => FIGES.indexOf(b.statut) >= 0)) return 'Cette commande est déjà en préparation : contactez-nous pour toute modification.';
  if (tete.jour_livraison && tete.jour_livraison < ajouterJours(aujourdhuiParis(), DELAI_MODIF)) return 'La livraison est trop proche pour être modifiée en ligne : contactez-nous.';
  return '';
}

/* ── Ce que la page publique affiche ─────────────────────────────────────── */
async function vue(g) {
  const tete = g.tete, cl = await client(tete.user_id), C = await contenus(g.bons);
  const d = decomposerAdresse(tete.adresse);
  const min = dateMinPour(tete.created_at, true);
  return {
    prenom: cl.prenom || '',
    statut: tete.confirmation_statut, confirmee_at: tete.confirmee_at,
    annulee: tete.statut === 'annule', motif: tete.annulation_motif || '',
    verrou: verrou(g), manque: manques(tete),
    commande: {
      type: tete.type, nb_repas: tete.nb_repas, semaines: g.bons.length,
      passee_le: dateParis(tete.created_at), code: tete.code_reception || ''
    },
    livraisons: g.bons.map(b => ({ date: b.jour_livraison, creneau: b.creneau_livraison, statut: b.statut, nb_repas: b.nb_repas, contenu: C[b.id] || [] })),
    livraison: {
      date: tete.jour_livraison, creneau: tete.creneau_livraison, adresse: tete.adresse || '',
      num: d.num, rue: d.rue, cp: d.cp, ville: d.ville,
      tel: tete.contact_tel || '', instructions: tete.instructions_acces || ''
    },
    regles: { date_min: min, date_max: ajouterJours(min, FENETRE), creneaux: CRENEAUX, delai: DELAI_JOURS }
  };
}

export async function lireParJeton(jeton) {
  const bon = await bonParJeton(jeton);
  if (!bon) return null;
  return vue(await groupeDe(bon));
}

/* ── L'équipe, dans le CRM ───────────────────────────────────────────────── */
export async function notifierEquipe(titre, message, objetId) {
  try {
    let staff = await sb('staff?actif=eq.true&select=user_id,role');
    const admins = (staff || []).filter(s => s.role === 'admin');
    staff = admins.length ? admins : (staff || []);
    if (!staff.length) return;
    await sb('notifications', {
      method: 'POST', prefer: 'return=minimal',
      body: staff.map(s => ({ destinataire: s.user_id, objet_type: 'commande', objet_id: objetId || null, titre, message: message || null, canal: 'popup', cree_par: 'Natty (client)' }))
    });
  } catch (e) { console.log('notification CRM — %s', e.message); }
}

/* ── Le client valide ou modifie ─────────────────────────────────────────── */
function erreur(message, status) { const e = new Error(message); e.status = status || 400; e.public = true; return e; }

export async function repondre(jeton, r) {
  const bon = await bonParJeton(jeton);
  if (!bon) throw erreur('Lien inconnu ou expiré', 404);
  const g = await groupeDe(bon), tete = g.tete;
  if (tete.statut === 'annule' || tete.confirmation_statut === 'annulee_hors_zone') throw erreur('Cette commande est annulée.', 409);
  const cl = await client(tete.user_id);
  const mode = r && r.mode === 'modifier' ? 'modifier' : 'valider';
  const maintenant = new Date().toISOString();
  let patch = {}, changements = [], adresse = tete.adresse;

  if (mode === 'valider') {
    const m = manques(tete);
    if (m.length) throw erreur('Il manque ' + m.map(x => ({ date: 'la date', creneau: 'le créneau', adresse: 'l’adresse' }[x])).join(', ') + ' de livraison : complétez-les pour valider.', 422);
    // Valider une adresse hors zone, c'est la même chose que la saisir.
    if (!estIDF(codePostal(tete.adresse))) {
      return annulerHorsZone(g, { adresse: tete.adresse, cp: codePostal(tete.adresse), date: tete.jour_livraison, creneau: tete.creneau_livraison }, cl);
    }
  } else {
    const v = verrou(g);
    if (v) throw erreur(v, 409);
    const s = k => String((r && r[k]) || '').trim();
    const date = s('date'), creneau = s('creneau'), num = s('num'), rue = s('rue'), cp = s('cp'), ville = s('ville');
    const tel = s('tel').slice(0, 30), instructions = s('instructions').slice(0, 300);
    const min = dateMinPour(tete.created_at, true), max = ajouterJours(min, FENETRE);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw erreur('Choisissez une date de livraison.');
    /* La date déjà retenue reste acceptée telle quelle même si elle tombe
       désormais sous le minimum « modification » (2 jours) : ne pas la changer
       n'est pas la changer. Toute AUTRE date passe la règle entière. */
    if (date !== tete.jour_livraison && (date < min || date > max)) throw erreur('Livraison possible du ' + dateLongue(min) + ' au ' + dateLongue(max) + '.');
    if (CRENEAUX.indexOf(creneau) < 0) throw erreur('Choisissez un créneau de livraison.');
    if (!num || rue.length < 3 || !/^\d{5}$/.test(cp) || ville.length < 2) throw erreur('Adresse incomplète : numéro, rue, code postal et ville.');
    adresse = composerAdresse(num, rue, cp, ville).slice(0, 480);

    if (!estIDF(cp)) return annulerHorsZone(g, { adresse, cp, tel, instructions, date, creneau }, cl);

    if (date !== tete.jour_livraison) changements.push('Livraison : ' + (tete.jour_livraison ? dateLongue(tete.jour_livraison) + ' → ' : '') + dateLongue(date));
    if (creneau !== tete.creneau_livraison) changements.push('Créneau : ' + (tete.creneau_livraison ? tete.creneau_livraison + ' → ' : '') + creneau);
    if (adresse !== (tete.adresse || '')) changements.push('Adresse : ' + adresse);
    if (tel !== (tete.contact_tel || '')) changements.push('Téléphone : ' + (tel || '—'));
    if (instructions !== (tete.instructions_acces || '')) changements.push('Accès : ' + (instructions || '—'));

    /* Les semaines suivantes se décalent d'autant ; sans date d'origine, elles
       s'enchaînent de 7 en 7 à partir de la nouvelle. */
    const decal = tete.jour_livraison ? ecartJours(tete.jour_livraison, date) : null;
    let k = 0;
    for (const b of g.bons) {
      if (FIGES.indexOf(b.statut) >= 0) { k++; continue; }
      const j = decal != null && b.jour_livraison ? ajouterJours(b.jour_livraison, decal) : ajouterJours(date, 7 * k);
      await sb('bons_commande?id=eq.' + b.id, {
        method: 'PATCH', prefer: 'return=minimal',
        body: { jour_livraison: j, semaine: lundiDe(j), adresse, creneau_livraison: creneau, contact_tel: tel || null, instructions_acces: instructions || null, updated_at: maintenant }
      });
      k++;
    }
  }

  const rep = Object.assign({ mode, le: maintenant, changements }, mode === 'modifier' ? {
    date: r.date, creneau: r.creneau, adresse, tel: String(r.tel || '').trim(), instructions: String(r.instructions || '').trim()
  } : {});
  patch = { confirmation_statut: 'confirmee', confirmee_at: maintenant, confirmation_reponses: rep };
  await sb('bons_commande?id=in.(' + g.bons.map(b => b.id).join(',') + ')', { method: 'PATCH', prefer: 'return=minimal', body: patch });

  if (changements.length) {
    await notifierEquipe('✏️ ' + (cl.prenom || 'Un client') + ' a modifié sa commande', changements.join(' · '), tete.id);
  }
  return vue(await groupeDe(await bonParId(tete.id)));
}

async function annulerHorsZone(g, saisie, cl) {
  const maintenant = new Date().toISOString(), tete = g.tete;
  const rep = Object.assign({ mode: 'modifier', le: maintenant, hors_zone: true }, saisie);
  await sb('bons_commande?id=in.(' + g.bons.map(b => b.id).join(',') + ')', {
    method: 'PATCH', prefer: 'return=minimal',
    body: { statut: 'annule', annulation_motif: 'hors_zone', confirmation_statut: 'annulee_hors_zone', confirmation_reponses: rep, updated_at: maintenant }
  });
  await notifierEquipe('⛔ Commande annulée — hors Île-de-France',
    (cl.prenom || 'Client') + (cl.email ? ' (' + cl.email + ')' : '') + ' · ' + saisie.adresse + ' · '
    + g.bons.length + ' livraison' + (g.bons.length > 1 ? 's' : '') + ' annulée' + (g.bons.length > 1 ? 's' : '')
    + ' · ⚠️ paiement à rembourser' + (tete.type === 'abonnement' ? ' et abonnement Stripe à résilier' : '') + ' à la main.', tete.id);
  if (cl.email) {
    await envoyerEmail(cl.email, 'Votre commande Natty est annulée', gabarit({
      titre: 'Commande annulée', intro: (cl.prenom ? cl.prenom + ', n' : 'N') + 'ous ne livrons pour le moment qu’en Île-de-France.',
      corps: '<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#2d2d3a;">L’adresse indiquée (<b>' + esc(saisie.adresse) + '</b>) est en dehors de notre zone de livraison : votre commande a donc été annulée.</p>'
        + '<p style="margin:0;font-size:14px;line-height:1.55;color:#2d2d3a;">Notre équipe vous recontacte pour le remboursement. Une erreur dans l’adresse ? Répondez simplement à cet email.</p>'
    }));
  }
  return vue(await groupeDe(await bonParId(tete.id)));
}

/* ── L'email ─────────────────────────────────────────────────────────────── */
async function envoyerEmail(to, subject, html) {
  const RESEND = process.env.RESEND_API_KEY;
  if (!RESEND) return { ok: false, err: 'RESEND_API_KEY absente' };
  const FROM = process.env.RESEND_FROM || 'Natty <onboarding@resend.dev>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + RESEND, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: CONTACT })
  });
  if (!r.ok) { const t = await r.text(); console.log('email commande — %s', t.slice(0, 200)); return { ok: false, err: t.slice(0, 300) }; }
  return { ok: true };
}

/* La DA de Natty, en email : gris perle, carte blanche, en-tête noir, Inter —
   les clients mail ne chargent pas de police, d'où la pile système derrière. */
function gabarit(o) {
  return '<!doctype html><html lang="fr"><body style="margin:0;background:#f0f0f3;">'
    + '<div style="font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;background:#f0f0f3;padding:28px 14px;">'
    + '<div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 28px rgba(174,174,192,.35);">'
    + '<div style="background:#1a1a2e;padding:28px 28px 24px;color:#ffffff;">'
    + '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;font-weight:600;">Natty</div>'
    + '<div style="font-size:22px;font-weight:800;margin-top:8px;letter-spacing:-.01em;">' + esc(o.titre) + '</div>'
    + (o.intro ? '<div style="font-size:14px;opacity:.7;margin-top:6px;line-height:1.5;">' + esc(o.intro) + '</div>' : '')
    + '</div><div style="padding:24px 28px 28px;">' + o.corps + '</div></div>'
    + '<div style="max-width:540px;margin:14px auto 0;text-align:center;font-size:11px;color:#9a9aaa;">Natty · repas livrés et suivi nutritionnel · ' + CONTACT + '</div>'
    + '</div></body></html>';
}
function bouton(href, libelle, plein) {
  return '<a href="' + esc(href) + '" style="display:inline-block;margin:0 6px 8px 0;padding:14px 24px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;'
    + (plein ? 'background:#1a1a2e;color:#ffffff;border:2px solid #1a1a2e;' : 'background:#ffffff;color:#1a1a2e;border:2px solid #1a1a2e;') + '">' + esc(libelle) + '</a>';
}

/* `raison` : 'commande' (au paiement), 'manuel' (renvoyé depuis le CRM),
   'modification' (l'équipe a changé la commande et prévient le client).
   `modifications` : une liste de phrases, composée par le CRM. */
export async function envoyerConfirmation(bonId, o) {
  o = o || {};
  const bon = await bonParId(bonId);
  if (!bon) throw erreur('Commande introuvable', 404);
  const g = await groupeDe(bon), tete = g.tete;
  if (tete.statut === 'annule') throw erreur('Cette commande est annulée : rien à confirmer.', 409);
  const cl = await client(tete.user_id);
  const to = String(o.to || cl.email || '').trim();
  if (!to) throw erreur('Aucun email connu pour ce client.', 422);
  const C = await contenus(g.bons);
  const m = manques(tete), complet = !m.length;
  const lien = a => ORIGIN + '/commande.html?t=' + tete.confirmation_token + (a ? '&a=' + a : '');

  const ligne = (k, v) => '<tr><td style="padding:9px 0;color:#9a9aaa;font-size:13px;vertical-align:top;white-space:nowrap;">' + esc(k)
    + '</td><td style="padding:9px 0 9px 16px;font-weight:600;color:#1a1a2e;font-size:13.5px;line-height:1.45;">' + v + '</td></tr>';
  const manque = '<span style="color:#ff3b30;">à renseigner</span>';
  const contenuHtml = g.bons.map((b, i) => {
    const c = C[b.id] || [];
    const items = c.length ? c.map(x => esc(x.nom) + ' × ' + x.n).join('<br>') : esc(b.nb_repas + ' repas — choisis par votre nutritionniste');
    return (g.bons.length > 1 ? '<div style="color:#9a9aaa;font-weight:500;font-size:12px;margin-top:' + (i ? '8px' : '0') + ';">Semaine ' + (i + 1) + (b.jour_livraison ? ' · ' + esc(dateLongue(b.jour_livraison)) : '') + '</div>' : '') + items;
  }).join('');
  const tableau = '<table style="border-collapse:collapse;width:100%;">'
    + ligne('Commande', esc((tete.type === 'unite' ? 'À l’unité' : 'Abonnement') + ' · ' + tete.nb_repas + ' repas' + (g.bons.length > 1 ? ' × ' + g.bons.length + ' semaines' : '')))
    + ligne('Au menu', contenuHtml)
    + ligne('Livraison', tete.jour_livraison ? esc(dateLongue(tete.jour_livraison)) + (tete.creneau_livraison ? ' · ' + esc(tete.creneau_livraison) : ' · créneau ' + manque) : manque)
    + ligne('Adresse', tete.adresse ? esc(tete.adresse) : manque)
    + (tete.contact_tel ? ligne('Téléphone', esc(tete.contact_tel)) : '')
    + (tete.instructions_acces ? ligne('Accès', esc(tete.instructions_acces)) : '')
    + (tete.code_reception ? ligne('Code de réception', esc(tete.code_reception) + ' <span style="color:#9a9aaa;font-weight:400;">— à donner au livreur</span>') : '')
    + '</table>';

  const modifs = Array.isArray(o.modifications) ? o.modifications.filter(Boolean).slice(0, 20) : [];
  const blocModifs = o.raison === 'modification' && modifs.length
    ? '<div style="background:#f7f7fa;border-radius:16px;padding:14px 16px;margin:0 0 18px;"><div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:6px;">Ce qui a changé</div>'
      + modifs.map(x => '<div style="font-size:13px;color:#2d2d3a;line-height:1.5;">• ' + esc(x) + '</div>').join('') + '</div>' : '';

  const appel = complet
    ? '<p style="margin:22px 0 14px;font-size:14px;line-height:1.55;color:#2d2d3a;">Vérifiez la date et le lieu de livraison, puis validez — ou modifiez-les si besoin.</p>'
      + bouton(lien('valider'), 'Valider ma commande', true) + bouton(lien('modifier'), 'Modifier', false)
    : '<p style="margin:22px 0 14px;font-size:14px;line-height:1.55;color:#2d2d3a;"><b>Il nous manque vos informations de livraison.</b> Votre commande ne sera préparée qu’une fois ces informations renseignées et validées.</p>'
      + bouton(lien('modifier'), 'Renseigner ma livraison', true);
  const regle = '<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#9a9aaa;">Nous livrons en Île-de-France, au plus tôt ' + DELAI_JOURS + ' jours après la commande.</p>';

  const titres = {
    commande: [complet ? 'Confirmez votre commande' : 'Plus qu’une étape', (cl.prenom ? 'Merci ' + cl.prenom + ' ! ' : 'Merci ! ') + 'Voici le récapitulatif de votre commande.'],
    manuel: [complet ? 'Confirmez votre commande' : 'Vos informations de livraison', (cl.prenom ? cl.prenom + ', v' : 'V') + 'oici le récapitulatif de votre commande.'],
    modification: ['Votre commande a été mise à jour', (cl.prenom ? cl.prenom + ', n' : 'N') + 'otre équipe a modifié votre commande.']
  };
  const t = titres[o.raison] || titres.manuel;
  const sujet = o.raison === 'modification' ? '✏️ Votre commande Natty a été mise à jour'
    : complet ? '✅ Confirmez votre commande Natty' : '📍 Votre commande Natty : renseignez la livraison';
  const env = await envoyerEmail(to, sujet, gabarit({ titre: t[0], intro: t[1], corps: blocModifs + tableau + appel + regle }));
  if (!env.ok) throw erreur('Email non envoyé : ' + env.err, 502);

  const patch = {
    confirmation_envoyee_at: new Date().toISOString(),
    confirmation_nb_envois: (tete.confirmation_nb_envois || 0) + 1
  };
  // Une modification de l'équipe redemande la validation du client ; un simple
  // renvoi d'une commande déjà confirmée ne la défait pas.
  if (o.raison === 'modification' || tete.confirmation_statut !== 'confirmee') patch.confirmation_statut = 'envoyee';
  if (o.raison === 'modification') { patch.modif_non_notifiee = false; patch.notifiee_at = patch.confirmation_envoyee_at; }
  await sb('bons_commande?id=in.(' + g.bons.map(b => b.id).join(',') + ')', { method: 'PATCH', prefer: 'return=minimal', body: patch });
  return { ok: true, to, complet, lien: lien('') };
}

/* Le lien de confirmation d'une commande, sans rien envoyer — pour le message
   in-app que le webhook écrit à côté de l'email. */
export async function lienConfirmation(bonId) {
  const bon = await bonParId(bonId);
  if (!bon) return '';
  const g = await groupeDe(bon);
  return ORIGIN + '/commande.html?t=' + g.tete.confirmation_token;
}

/* ── Le CRM : qui appelle ? ──────────────────────────────────────────────── */
export async function estStaff(jwt) {
  if (!jwt) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: cle(), Authorization: 'Bearer ' + jwt } });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    const s = await sb('staff?user_id=eq.' + encodeURIComponent(u.id) + '&select=user_id,nom,role,actif&limit=1');
    return s && s[0] && s[0].actif ? s[0] : null;
  } catch (e) { return null; }
}
