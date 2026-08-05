// ═══════════════════════════════════════════════════════════
// Natty — Rappel du soir : « il te reste X g de protéines »
// ───────────────────────────────────────────────────────────
// Le premier des deux besoins qui ne peuvent PAS être une notification locale :
// le chiffre n'existe qu'au moment de l'envoi, calculé sur les repas saisis
// dans la journée — donc bien après le moment où une notification locale
// aurait dû être planifiée.
//
// Déclenchement : cron Vercel, ou appel manuel. Dans les deux cas il faut le
// secret (?secret=… ou en-tête x-cron-secret), comme api/conseils-hebdo.
//   GET /api/rappel-macros?secret=…              tous les appareils enregistrés
//   GET /api/rappel-macros?secret=…&user_id=…    un seul utilisateur (test)
//   GET /api/rappel-macros?secret=…&dry=1        calcule et renvoie SANS envoyer
//   GET /api/rappel-macros?secret=…&force=1      ignore la garde anti-doublon
//
// ⚠️ CRON À DÉCLARER DANS vercel.json (pas fait : le fichier ne se touche pas
//    sans l'accord de Pablo, règle §9 #14, et le plan Vercel limite le nombre
//    de crons — voir §8) :
//      { "path": "/api/rappel-macros", "schedule": "0 16 * * *" }
//    16 h UTC = 18 h à Paris en été, 17 h en hiver. Vercel ne connaît que
//    l'UTC ; l'heure française bouge donc d'une heure entre les saisons.
//
// ⚠️ RUNTIME NODE OBLIGATOIRE (le défaut) : _apns.js utilise le module
//    `http2`, qu'APNs impose et que le runtime edge n'a pas. Ne jamais ajouter
//    `export const config = { runtime: 'edge' }` ici.
// ═══════════════════════════════════════════════════════════

import { apnsEnvoyer, sbGet, jetonsPar, lireEtat, ecrireEtat, autorise } from './_apns.js';
import { calcMac } from './_nutrition.js';

export default async function handler(req, res) {
  if (!autorise(req)) return res.status(401).json({ error: 'Unauthorized' });

  const cible = req.query?.user_id || null;
  const dry   = req.query?.dry === '1';
  const force = req.query?.force === '1';

  const jour = jourParis();

  // Garde anti-doublon : un cron rejoué (ou deux déclarations qui se
  // chevauchent) ne doit pas notifier deux fois le même soir.
  if (!cible && !force && !dry) {
    if ((await lireEtat('rappel-macros')) === jour) {
      return res.status(200).json({ ok: true, saute: 'déjà envoyé aujourd\'hui', jour });
    }
  }

  try {
    // 1. Qui a un appareil enregistré ? Inutile de calculer pour les autres.
    let q = 'appareils?actif=eq.true&select=user_id';
    if (cible) q += `&user_id=eq.${cible}`;
    const lignes = await sbGet(q);
    const users = [...new Set(lignes.map(l => l.user_id))];
    if (!users.length) return res.status(200).json({ ok: true, users: 0, note: 'aucun appareil enregistré' });

    const jetons = await jetonsPar(users);
    const rapport = [];
    let envoyes = 0;

    for (const uid of users) {
      try {
        const msg = await messagePour(uid, jour);
        if (!msg) { rapport.push({ user_id: uid, envoi: false, raison: 'rien à dire' }); continue; }

        if (dry) { rapport.push({ user_id: uid, envoi: false, apercu: msg }); continue; }

        const r = await apnsEnvoyer(jetons[uid] || [], {
          titre: msg.titre, corps: msg.corps, data: { route: 'suivi.html' }
        });
        envoyes += r.envoyes;
        rapport.push({ user_id: uid, envoi: true, apercu: msg, apns: { ok: r.envoyes, ko: r.echecs } });
      } catch (e) {
        rapport.push({ user_id: uid, envoi: false, erreur: e.message });
      }
    }

    if (!dry && !cible) await ecrireEtat('rappel-macros', jour);
    return res.status(200).json({ ok: true, jour, users: users.length, envoyes, rapport });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* Ce qu'on a à dire à quelqu'un ce soir — ou rien du tout.
   Ne jamais notifier pour notifier : un objectif atteint n'appelle pas de
   rappel, et un manque de 10 g non plus. */
async function messagePour(uid, jour) {
  // ⚠️ `onboarding` contient des utilisateurs en DOUBLE (constaté en base : deux
  // lignes pour le même user_id, dont une sans poids ni tdee). Un `limit=1` en
  // attrape une au hasard et le rappel saute l'utilisateur en croyant son
  // profil incomplet. On prend donc la première ligne réellement exploitable.
  const onb = await sbGet(`onboarding?user_id=eq.${uid}&select=prenom,poids,tdee&order=created_at.desc&limit=5`);
  const u = (onb || []).find(x => parseFloat(x.poids) > 0 && parseFloat(x.tdee) > 0) || (onb || [])[0];
  if (!u) return null;

  // Les macros ne sont pas stockées : elles se dérivent de poids et tdee.
  // Même formule que calcMacros() de suivi.html — voir §4 de CLAUDE.md.
  const poids = parseFloat(u.poids) || 0;
  const tdee  = parseFloat(u.tdee)  || 0;
  if (!poids || !tdee) return null;          // profil incomplet : pas de cible fiable
  const objProt = Math.round(poids * 2);
  const objCal  = Math.round(tdee);

  const repas = await sbGet(`meals?user_id=eq.${uid}&meal_date=eq.${jour}&select=id`);
  const consomme = repas.length ? await macrosDesRepas(repas.map(r => r.id)) : { c: 0, p: 0 };

  const resteProt = Math.round(objProt - consomme.p);
  const prenom = (u.prenom || '').trim();
  const salut = prenom ? prenom + ', ' : '';

  if (!repas.length) {
    return {
      titre: 'Rien d\'enregistré aujourd\'hui 📷',
      corps: salut + 'ton objectif du jour : ' + objProt + ' g de protéines. Il est encore temps.'
    };
  }
  // Sous ce seuil, l'écart tient dans l'imprécision d'une pesée à l'œil :
  // le rappel serait du bruit.
  if (resteProt < 15) return null;

  return {
    titre: 'Il te reste ' + resteProt + ' g de protéines 🥩',
    corps: salut + 'tu es à ' + Math.round(consomme.p) + ' g sur ' + objProt + ' g, et '
         + Math.round(consomme.c) + ' kcal sur ' + objCal + '. Le dîner peut rattraper ça.'
  };
}

/* ⚠️ DEMANDER LES QUATRE COLONNES DE MACROS, pas seulement le nom et les
   grammes. Depuis août 2026 `assets/ajout.js` les renseigne à l'enregistrement,
   et `calcMac` les préfère à la table — mais une colonne qu'on n'a pas demandée
   arrive `undefined`, donc « rien d'écrit », donc on retombait en silence sur le
   filet pour des lignes qui portaient la vraie mesure. Le filet reste utile pour
   les lignes anciennes et la saisie à la main. Voir api/_nutrition.js. */
async function macrosDesRepas(ids) {
  const total = { c: 0, p: 0, l: 0, g: 0 };
  for (let i = 0; i < ids.length; i += 40) {
    const lot = ids.slice(i, i + 40).map(x => '"' + x + '"').join(',');
    const ings = await sbGet(`meal_ingredients?meal_id=in.(${encodeURIComponent(lot)})`
      + '&select=name,quantity_g,calories,proteins_g,carbs_g,fats_g');
    const m = calcMac(ings);
    total.c += m.c; total.p += m.p; total.l += m.l; total.g += m.g;
  }
  return total;
}

/* La journée de l'utilisateur, pas celle du serveur : un cron Vercel tourne en
   UTC, et à 22 h à Paris on est déjà « demain » en UTC deux mois par an. */
function jourParis() {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
