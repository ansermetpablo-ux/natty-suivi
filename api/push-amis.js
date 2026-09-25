// ═══════════════════════════════════════════════════════════
// Natty — « Un ami a ajouté un plat », et le diagnostic push
// ───────────────────────────────────────────────────────────
// Le second besoin qui ne peut PAS être local : le déclencheur est un repas
// enregistré sur l'appareil de QUELQU'UN D'AUTRE. Aucun téléphone ne peut le
// savoir tout seul.
//
// DÉCLENCHÉ PAR LA BASE (choix de Pablo, 2026-08-03) : un `after insert` sur
// `meals` appelle cet endpoint via `pg_net`, avec l'id du repas. La
// notification part donc dans la foulée de l'enregistrement, sans attendre le
// passage d'un cron. Le SQL est dans natty_push.sql.
//
// Le mode « relevé » est conservé comme filet : il rattrape ce qu'un
// déclencheur en échec aurait laissé passer, et il se teste depuis un
// navigateur sans rien insérer en base.
//
//   POST /api/push-amis            {"meal_id":"…"}   ← le déclencheur
//   GET  /api/push-amis?secret=…                      depuis le dernier passage
//   GET  /api/push-amis?secret=…&dry=1                calcule SANS envoyer
//   GET  /api/push-amis?secret=…&minutes=60           fenêtre explicite
//
// FUSIONNÉ AVEC L'ANCIEN api/push-test.js (2026-09-25, sur demande de
// Pablo) : `api/` comptait 14 fonctions serverless, au-dessus de la limite
// Vercel. push-test n'était qu'un outil de diagnostic manuel — jamais
// appelé par la base ni par un cron — donc le candidat naturel à absorber
// plutôt qu'à garder comme fonction à part entière. Son comportement est
// repris à l'identique, isolé derrière `diag=1` pour ne rien changer au
// déclencheur pg_net ni au relevé ci-dessus :
//
//   GET /api/push-amis?secret=…&diag=1                état de la config
//   GET /api/push-amis?secret=…&diag=1&user_id=…      envoie à tous ses appareils
//   GET /api/push-amis?secret=…&diag=1&token=…        envoie à un jeton précis
//
// C'est le premier endroit où regarder quand « les push ne marchent pas » :
// la réponse fait remonter le statut et le `reason` bruts d'APNs, là où
// l'app ne montre rien du tout.
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
// Dans tous les cas le secret est exigé (?secret=, x-cron-secret, ou
// Authorization: Bearer — voir `autorise`).
//
// ⚠️ RUNTIME NODE OBLIGATOIRE : _apns.js utilise `http2`. Pas d'edge ici.
// ═══════════════════════════════════════════════════════════

import { apnsEnvoyer, apnsConfigure, sbGet, jetonsPar, lireEtat, ecrireEtat, autorise } from './_apns.js';

export default async function handler(req, res) {
  if (!autorise(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.query?.diag === '1') return diagnostic(req, res);

  const dry = req.query?.dry === '1';
  const minutes = parseInt(req.query?.minutes || '', 10);
  const mealId = lireMealId(req);

  const maintenant = new Date();
  let depuis = await lireEtat('amis');
  if (minutes > 0 || !depuis) {
    depuis = new Date(maintenant.getTime() - (minutes > 0 ? minutes : 30) * 60000).toISOString();
  }

  try {
    // 1. Le repas désigné par le déclencheur, ou tous ceux apparus depuis le
    //    dernier passage. Un appel ciblé ne touche PAS la mémoire du relevé :
    //    sinon un déclencheur ferait avancer le curseur et le filet laisserait
    //    passer les repas qu'il était censé rattraper.
    const repas = mealId
      ? await sbGet(`meals?id=eq.${encodeURIComponent(mealId)}&select=id,user_id,name,partage,created_at`)
      : await sbGet(
          `meals?created_at=gt.${encodeURIComponent(depuis)}&select=id,user_id,name,partage,created_at` +
          `&order=created_at.asc&limit=200`
        );
    if (!repas.length) {
      if (!dry && !mealId) await ecrireEtat('amis', maintenant.toISOString());
      return res.status(200).json({ ok: true, depuis, repas: 0 });
    }

    // 2. Vie privée, dans les deux sens. Un plat masqué (`partage=false`) ou un
    //    membre sorti du fil (`fil_public=false`) ne doit pas plus déclencher
    //    de notification qu'apparaître dans le fil — sinon le réglage mentirait.
    const auteurs = [...new Set(repas.map(r => r.user_id))];
    const prives = await membresPrives(auteurs);
    const visibles = repas.filter(r => r.partage !== false && !prives.has(r.user_id));
    if (!visibles.length) {
      if (!dry && !mealId) await ecrireEtat('amis', maintenant.toISOString());
      return res.status(200).json({ ok: true, depuis, repas: repas.length, visibles: 0 });
    }

    // 3. Qui suit qui. `membre_amis` se lit « user_id suit ami_id » : les
    //    abonnés d'un auteur A sont donc les user_id des lignes ami_id = A.
    const parAuteur = {};
    for (const a of [...new Set(visibles.map(r => r.user_id))]) {
      const l = await sbGet(`membre_amis?ami_id=eq.${a}&select=user_id`);
      parAuteur[a] = l.map(x => x.user_id);
    }

    // 4. Un abonné = une notification, même s'il suit trois personnes qui ont
    //    toutes publié. Trois vibrations d'affilée feraient couper les
    //    notifications, pas ouvrir l'app.
    const prenoms = await prenomsDe(auteurs);
    const pourAbonne = {};
    for (const r of visibles) {
      for (const abonne of (parAuteur[r.user_id] || [])) {
        if (abonne === r.user_id) continue;
        (pourAbonne[abonne] = pourAbonne[abonne] || []).push({ auteur: r.user_id, plat: r.name });
      }
    }

    const abonnes = Object.keys(pourAbonne);
    if (!abonnes.length) {
      if (!dry && !mealId) await ecrireEtat('amis', maintenant.toISOString());
      return res.status(200).json({ ok: true, depuis, repas: visibles.length, abonnes: 0 });
    }

    const jetons = await jetonsPar(abonnes);
    const rapport = [];
    let envoyes = 0;

    for (const abonne of abonnes) {
      const items = pourAbonne[abonne];
      const msg = composer(items, prenoms);
      if (dry || !(jetons[abonne] || []).length) {
        rapport.push({ abonne, envoi: false, apercu: msg, jetons: (jetons[abonne] || []).length });
        continue;
      }
      // Un envoi qui échoue ne doit pas priver les autres abonnés du leur :
      // sans ce filet, un seul jeton fâché fait tomber toute la boucle.
      try {
        const r = await apnsEnvoyer(jetons[abonne], {
          titre: msg.titre, corps: msg.corps, data: { route: 'social.html' }
        });
        envoyes += r.envoyes;
        rapport.push({ abonne, envoi: true, apercu: msg, apns: { ok: r.envoyes, ko: r.echecs } });
      } catch (e) {
        rapport.push({ abonne, envoi: false, apercu: msg, erreur: e.message });
      }
    }

    if (!dry && !mealId) await ecrireEtat('amis', maintenant.toISOString());
    return res.status(200).json({ ok: true, depuis, repas: visibles.length, abonnes: abonnes.length, envoyes, rapport });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* Reprise à l'identique d'api/push-test.js (supprimé) — voir l'en-tête du
   fichier pour la table de lecture des réponses APNs les plus fréquentes. */
async function diagnostic(req, res) {
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

/* Le déclencheur pg_net poste {"meal_id":"…"}. Selon le Content-Type et la
   version du runtime, `req.body` arrive tantôt en objet, tantôt en chaîne —
   même prudence que dans api/checkout.js. `?meal_id=` reste accepté pour
   pouvoir rejouer un cas précis à la main. */
function lireMealId(req) {
  if (req.query?.meal_id) return req.query.meal_id;
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  const id = b && (b.meal_id || (b.record && b.record.id));
  return id ? String(id) : null;
}

function composer(items, prenoms) {
  const nom = (id) => prenoms[id] || 'Un membre';
  if (items.length === 1) {
    return {
      titre: nom(items[0].auteur) + ' a ajouté un plat 🍽️',
      corps: items[0].plat || 'Va voir ce qu\'il y a dans son assiette.'
    };
  }
  const auteurs = [...new Set(items.map(i => i.auteur))];
  if (auteurs.length === 1) {
    return {
      titre: nom(auteurs[0]) + ' a ajouté ' + items.length + ' plats 🍽️',
      corps: items.map(i => i.plat).filter(Boolean).slice(0, 3).join(' · ')
    };
  }
  return {
    titre: items.length + ' nouveaux plats dans ton fil 🍽️',
    corps: auteurs.slice(0, 3).map(nom).join(', ') + (auteurs.length > 3 ? ' et d\'autres' : '') + ' ont publié.'
  };
}

/* Membres qui se sont retirés du fil. `membre_prefs` peut ne pas exister sur
   une instance : dans ce cas on ne notifie personne pour rien — on ne peut
   pas garantir le réglage, donc on ne prend pas le risque de le trahir. */
async function membresPrives(ids) {
  try {
    const lot = ids.map(u => '"' + u + '"').join(',');
    const l = await sbGet(`membre_prefs?user_id=in.(${encodeURIComponent(lot)})&select=user_id,fil_public`);
    return new Set(l.filter(x => x.fil_public === false).map(x => x.user_id));
  } catch (e) {
    return new Set(ids);
  }
}

async function prenomsDe(ids) {
  const out = {};
  try {
    for (let i = 0; i < ids.length; i += 50) {
      const lot = ids.slice(i, i + 50).map(u => '"' + u + '"').join(',');
      const l = await sbGet(`onboarding?user_id=in.(${encodeURIComponent(lot)})&select=user_id,prenom`);
      for (const x of l) if (x.prenom) out[x.user_id] = x.prenom;
    }
  } catch (e) {}
  return out;
}
