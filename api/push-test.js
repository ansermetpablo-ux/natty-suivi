// ═══════════════════════════════════════════════════════════
// Natty — Envoi d'un push de test
// ───────────────────────────────────────────────────────────
// Le premier endroit où regarder quand « les push ne marchent pas ». Il fait
// remonter la réponse brute d'APNs (statut + `reason`), qui dit précisément ce
// qui cloche là où l'app ne montre rien du tout.
//
//   GET /api/push-test?secret=…                état de la configuration
//   GET /api/push-test?secret=…&user_id=…      envoie à tous ses appareils
//   GET /api/push-test?secret=…&token=…        envoie à un jeton précis
//
// Lecture des réponses APNs les plus fréquentes :
//   403 InvalidProviderToken  clé .p8, APNS_KEY_ID ou APNS_TEAM_ID incohérents
//   400 BadDeviceToken        jeton du mauvais environnement — un jeton obtenu
//                             depuis Xcode est un jeton *sandbox*, APNS_ENV
//                             doit valoir 'sandbox' ; TestFlight et l'App
//                             Store donnent des jetons *production*
//   400 TopicDisallowed       APNS_TOPIC n'est pas le bundle id de l'app.
//                             C'est com.nattynutrition.app — le même partout
//                             depuis le 2026-08-10 (bundle id iOS, appId
//                             Capacitor, applicationId Android, scheme des
//                             deep links). Ni com.pabloansermet.nattysuivi
//                             (l'ancien), ni com.natty.app (refusé par Apple).
//   410 Unregistered          app désinstallée : le jeton est désactivé en base
//
// ⚠️ RUNTIME NODE OBLIGATOIRE : _apns.js utilise `http2`. Pas d'edge ici.
// ═══════════════════════════════════════════════════════════

import { apnsEnvoyer, apnsConfigure, sbGet, autorise } from './_apns.js';

export default async function handler(req, res) {
  if (!autorise(req)) return res.status(401).json({ error: 'Unauthorized' });

  const cfg = apnsConfigure();
  const etat = {
    cle_apns: cfg ? 'configurée' : 'ABSENTE (APNS_KEY_ID / APNS_P8)',
    // ⚠️ L'équipe qui signe le JWT doit être celle qui a signé l'APP. Depuis
    // l'achat de la licence (2026-08-10) c'est DJLW82GU5A, l'équipe Natty, et
    // plus SAZQ9AFAMZ (le compte individuel). Une divergence ici se paie d'un
    // 403 muet — d'où le rappel affiché quand on tourne encore sur le défaut.
    equipe: process.env.APNS_TEAM_ID
      || 'DJLW82GU5A (défaut — équipe Natty ; posez APNS_TEAM_ID pour en changer)',
    topic: process.env.APNS_TOPIC || 'com.nattynutrition.app (défaut — le bundle id)',
    environnement: process.env.APNS_ENV || 'sandbox (défaut)',
    cle_supabase: process.env.SUPABASE_SERVICE_KEY ? 'configurée' : 'ABSENTE'
  };

  const token = req.query?.token || null;
  const uid   = req.query?.user_id || null;

  // Sans cible, on ne fait que rendre compte de la configuration : c'est le
  // premier appel à faire après avoir posé les variables sur Vercel.
  if (!token && !uid) {
    let appareils = 'table absente ?';
    try { appareils = (await sbGet('appareils?select=token&actif=eq.true')).length; } catch (e) {}
    return res.status(200).json({ ok: true, etat, appareils_enregistres: appareils });
  }

  if (!cfg) return res.status(500).json({ error: 'Clé APNs non configurée', etat });

  try {
    let tokens = token ? [token] : [];
    if (!tokens.length) {
      const l = await sbGet(`appareils?actif=eq.true&user_id=eq.${uid}&select=token`);
      tokens = l.map(x => x.token);
    }
    if (!tokens.length) return res.status(200).json({ ok: false, etat, error: 'aucun appareil pour cette cible' });

    const r = await apnsEnvoyer(tokens, {
      titre: 'Natty — test ✅',
      corps: 'Si tu lis ça, les notifications push fonctionnent.',
      data: { route: 'suivi.html' }
    });
    return res.status(200).json({ ok: r.envoyes > 0, etat, ...r });
  } catch (err) {
    return res.status(500).json({ error: err.message, etat });
  }
}
