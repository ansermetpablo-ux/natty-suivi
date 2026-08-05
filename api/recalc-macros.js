// ═══════════════════════════════════════════════════════════
// Natty — Recalcul unique des macros des lignes `meal_ingredients`
// ───────────────────────────────────────────────────────────
// POURQUOI. Les colonnes `calories`, `proteins_g`, `carbs_g`, `fats_g` existent
// depuis toujours et sont restées à 0 sur les ~227 premières lignes : chaque
// écran redevinait les macros avec la table locale de `assets/core.js`, qui ne
// comptait que ~60 aliments. Du saucisson valait donc 0 kcal et 0 g de
// protéines, et un repas entier pouvait ne rien peser. Depuis août 2026
// `assets/ajout.js` écrit ces colonnes à l'enregistrement — mais l'historique,
// lui, ne se corrige pas tout seul : ses totaux, ses graphiques et les scores du
// fil social continuent de sous-compter.
//
// Ce que fait cette route : elle relit chaque ligne, l'apparie à la table
// nutritionnelle élargie (185 aliments, appariement mot à mot — la MÊME que
// l'app, voir api/_nutrition.js) et écrit les quatre colonnes.
//
// TROIS GARDE-FOUS, et ce sont eux qui rendent l'opération rejouable :
//   1. Une ligne qui porte DÉJÀ une valeur non nulle n'est jamais touchée. Ce
//      sont les mesures venues de l'analyse photo, plus fiables que la table.
//   2. Une ligne que la table ne sait pas chiffrer est laissée telle quelle et
//      REMONTÉE dans la réponse. Écrire des zéros « pour finir le travail »
//      rendrait un manque indiscernable d'une mesure à zéro.
//   3. Une ligne sans quantité exploitable est comptée à part : sans grammes,
//      il n'y a rien à calculer.
// Donc : relancer la route ne double rien et ne dégrade rien.
//
// USAGE (le secret est celui d'`api/conseils-hebdo` et des routes push) :
//   GET /api/recalc-macros?secret=…&dry=1      → relevé, AUCUNE écriture
//   GET /api/recalc-macros?secret=…            → écrit
//   GET /api/recalc-macros?secret=…&user_id=…  → un seul membre, pour un essai
//
// ⚠️ FAIRE LE `dry=1` D'ABORD, et lire `non_reconnus`. C'est le seul moyen de
// connaître la couverture réelle : la clé anon ne peut plus lire
// `meal_ingredients` depuis l'activation de la RLS, donc les noms réellement
// présents en base ne sont pas connaissables autrement. Ce qui manque à la
// table se rajoute dans `assets/core.js`, on régénère `api/_nutrition.js`, et on
// relance.
// ═══════════════════════════════════════════════════════════

import { autorise, sbHeaders } from './_apns.js';
import { getNutri, cleNutri } from './_nutrition.js';

/* Runtime Node, comme les autres routes du dépôt : on ne déclare rien (c'est le
   défaut) plutôt qu'un `config.runtime` — et surtout jamais `'edge'`, qui n'a ni
   `http2` pour `_apns.js` ni ces durées d'exécution. */
export const maxDuration = 120;

const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
const PAGE = 500;        // lignes lues par requête
const PARALLELE = 6;     // écritures simultanées — assez pour aller vite,
                         // assez peu pour ne pas se faire limiter par PostgREST

const COLS = 'id,meal_id,name,quantity_g,calories,proteins_g,carbs_g,fats_g';

/** Vrai si la ligne porte déjà une macro : on n'y touche pas. */
function dejaChiffree(l) {
  return !!(parseFloat(l.calories) || parseFloat(l.proteins_g)
         || parseFloat(l.carbs_g)  || parseFloat(l.fats_g));
}

async function lirePage(filtre, offset) {
  const r = await fetch(`${SB_URL}/rest/v1/meal_ingredients?select=${COLS}`
    + filtre + `&order=id.asc&limit=${PAGE}&offset=${offset}`, { headers: sbHeaders() });
  const t = await r.text();
  if (!r.ok) throw new Error(`lecture ${r.status} : ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : [];
}

async function ecrireLigne(l, valeurs) {
  const r = await fetch(`${SB_URL}/rest/v1/meal_ingredients?id=eq.${encodeURIComponent(l.id)}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(valeurs)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${r.status} ${t.slice(0, 200)}`);
  }
}

/* Écrit par petits paquets simultanés. Une ligne qui échoue n'arrête pas les
   autres : elle est remontée, et un second passage la reprendra (la route est
   rejouable par construction). */
async function ecrireToutes(travaux) {
  const echecs = [];
  for (let i = 0; i < travaux.length; i += PARALLELE) {
    const lot = travaux.slice(i, i + PARALLELE);
    await Promise.all(lot.map(t =>
      ecrireLigne(t.ligne, t.valeurs).catch(e => {
        echecs.push({ id: t.ligne.id, nom: t.ligne.name, erreur: String(e.message || e) });
      })
    ));
  }
  return echecs;
}

export default async function handler(req, res) {
  if (!autorise(req)) {
    return res.status(401).json({ error: 'CRON_SECRET requis (?secret=, x-cron-secret ou Bearer)' });
  }
  if (!process.env.SUPABASE_SERVICE_KEY) {
    // La clé anon ne suffit pas : sous RLS elle ne voit aucune ligne, donc la
    // route répondrait « 0 ligne à corriger » en ayant l'air d'avoir réussi.
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY non configurée' });
  }

  const dry = req.query?.dry === '1' || req.query?.dry === 'true';
  const uid = req.query?.user_id;

  // `meal_ingredients` n'a pas de `user_id` : le filtre par membre passe donc
  // par ses repas. Sans filtre, on traite tout.
  let filtre = '';
  try {
    if (uid) {
      const r = await fetch(`${SB_URL}/rest/v1/meals?user_id=eq.${encodeURIComponent(uid)}&select=id`,
        { headers: sbHeaders() });
      const repas = await r.json();
      if (!Array.isArray(repas) || !repas.length) {
        return res.status(200).json({ ok: true, dry, message: 'Aucun repas pour ce membre', lignes: 0 });
      }
      filtre = '&meal_id=in.(' + encodeURIComponent(repas.map(x => '"' + x.id + '"').join(',')) + ')';
    }
  } catch (e) {
    return res.status(500).json({ error: 'lecture des repas : ' + String(e.message || e) });
  }

  const bilan = {
    lues: 0, deja_chiffrees: 0, sans_quantite: 0,
    a_ecrire: 0, ecrites: 0, non_reconnues: 0
  };
  const nonReconnus = {};      // nom brut → nombre d'occurrences
  const travaux = [];
  const exemples = [];

  try {
    for (let offset = 0; ; offset += PAGE) {
      const page = await lirePage(filtre, offset);
      if (!page.length) break;
      bilan.lues += page.length;

      for (const l of page) {
        if (dejaChiffree(l)) { bilan.deja_chiffrees++; continue; }

        const q = parseFloat(l.quantity_g);
        if (!q) { bilan.sans_quantite++; continue; }

        const m = getNutri(l.name, q);
        if (!m) {
          bilan.non_reconnues++;
          const n = String(l.name || '(sans nom)').trim();
          nonReconnus[n] = (nonReconnus[n] || 0) + 1;
          continue;
        }

        bilan.a_ecrire++;
        travaux.push({
          ligne: l,
          valeurs: { calories: m.c, proteins_g: m.p, carbs_g: m.g, fats_g: m.l }
        });
        if (exemples.length < 25) {
          exemples.push({
            nom: l.name, grammes: q, reconnu_comme: cleNutri(l.name),
            kcal: m.c, p: m.p, g: m.g, l: m.l
          });
        }
      }

      if (page.length < PAGE) break;
    }
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e), bilan });
  }

  let echecs = [];
  if (!dry && travaux.length) {
    echecs = await ecrireToutes(travaux);
    bilan.ecrites = travaux.length - echecs.length;
  }

  // Les noms non reconnus, du plus fréquent au moins fréquent : c'est la liste
  // de courses de la prochaine passe sur la table de core.js.
  const manquants = Object.keys(nonReconnus)
    .map(n => ({ nom: n, lignes: nonReconnus[n] }))
    .sort((a, b) => b.lignes - a.lignes);

  return res.status(200).json({
    ok: true,
    dry,
    ...(uid ? { user_id: uid } : {}),
    bilan,
    couverture: bilan.lues
      ? Math.round(100 * (bilan.deja_chiffrees + bilan.a_ecrire) / bilan.lues) + ' %'
      : '—',
    non_reconnus: manquants,
    exemples,
    ...(echecs.length ? { echecs } : {}),
    suite: dry
      ? 'Relevé seulement. Relancer sans ?dry=1 pour écrire.'
      : 'Écrit. Rejouable sans risque : les lignes déjà chiffrées sont ignorées.'
  });
}
