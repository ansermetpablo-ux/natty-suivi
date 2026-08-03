// ═══════════════════════════════════════════════════════════
// Natty — « Un ami a ajouté un plat »
// ───────────────────────────────────────────────────────────
// Le second besoin qui ne peut PAS être local : le déclencheur est un repas
// enregistré sur l'appareil de QUELQU'UN D'AUTRE. Aucun téléphone ne peut le
// savoir tout seul.
//
// Fonctionne par relevé, pas par déclencheur base : on regarde les repas
// apparus depuis le dernier passage (mémorisé dans `push_etat`, clé `amis`) et
// on prévient ceux qui suivent leur auteur. Un déclencheur Postgres + pg_net
// serait plus immédiat mais suppose du DDL et une extension ; le relevé se
// rejoue sans risque, ne perd rien si une exécution saute, et se teste depuis
// un navigateur.
//
//   GET /api/push-amis?secret=…            depuis le dernier passage
//   GET /api/push-amis?secret=…&dry=1      calcule et renvoie SANS envoyer
//   GET /api/push-amis?secret=…&minutes=60 fenêtre explicite (ignore la mémoire)
//
// ⚠️ CADENCE. Un relevé n'est pertinent que s'il tourne souvent (~15 min).
//    Le plan Vercel Hobby n'autorise que 2 crons/jour — à cette cadence le
//    « un ami a ajouté un plat » arriverait le lendemain, ce qui n'a aucun
//    intérêt. Voir §8 : soit le projet passe sur un plan qui autorise les
//    crons fréquents, soit ce rappel passe par un déclencheur Supabase.
//    **Rien n'est déclaré dans vercel.json pour l'instant** (règle §9 #14).
//
// ⚠️ RUNTIME NODE OBLIGATOIRE : _apns.js utilise `http2`. Pas d'edge ici.
// ═══════════════════════════════════════════════════════════

import { apnsEnvoyer, sbGet, jetonsPar, lireEtat, ecrireEtat, autorise } from './_apns.js';

export default async function handler(req, res) {
  if (!autorise(req)) return res.status(401).json({ error: 'Unauthorized' });

  const dry = req.query?.dry === '1';
  const minutes = parseInt(req.query?.minutes || '', 10);

  const maintenant = new Date();
  let depuis = await lireEtat('amis');
  if (minutes > 0 || !depuis) {
    depuis = new Date(maintenant.getTime() - (minutes > 0 ? minutes : 30) * 60000).toISOString();
  }

  try {
    // 1. Les repas apparus depuis le dernier passage.
    const repas = await sbGet(
      `meals?created_at=gt.${encodeURIComponent(depuis)}&select=id,user_id,name,partage,created_at` +
      `&order=created_at.asc&limit=200`
    );
    if (!repas.length) {
      if (!dry) await ecrireEtat('amis', maintenant.toISOString());
      return res.status(200).json({ ok: true, depuis, repas: 0 });
    }

    // 2. Vie privée, dans les deux sens. Un plat masqué (`partage=false`) ou un
    //    membre sorti du fil (`fil_public=false`) ne doit pas plus déclencher
    //    de notification qu'apparaître dans le fil — sinon le réglage mentirait.
    const auteurs = [...new Set(repas.map(r => r.user_id))];
    const prives = await membresPrives(auteurs);
    const visibles = repas.filter(r => r.partage !== false && !prives.has(r.user_id));
    if (!visibles.length) {
      if (!dry) await ecrireEtat('amis', maintenant.toISOString());
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
      if (!dry) await ecrireEtat('amis', maintenant.toISOString());
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
      const r = await apnsEnvoyer(jetons[abonne], {
        titre: msg.titre, corps: msg.corps, data: { route: 'social.html' }
      });
      envoyes += r.envoyes;
      rapport.push({ abonne, envoi: true, apercu: msg, apns: { ok: r.envoyes, ko: r.echecs } });
    }

    if (!dry) await ecrireEtat('amis', maintenant.toISOString());
    return res.status(200).json({ ok: true, depuis, repas: visibles.length, abonnes: abonnes.length, envoyes, rapport });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
