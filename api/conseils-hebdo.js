// Cron chaque lundi 8h — génère les conseils pour tous les users + envoie email
// Le cœur de la génération vit dans api/_generation.js : il est partagé avec
// api/generer-conseils.js, l'endpoint qu'appelle l'app quand quelqu'un demande
// ses conseils sans attendre lundi. Une seule copie du prompt et de l'écriture.
import { processUser, getLundiSemaine } from './_generation.js';
// vercel.json: { "crons": [{ "path": "/api/conseils-hebdo", "schedule": "0 7 * * 1" }] }

// Une génération demande ~56 s. Le défaut coupait donc la fonction en plein
// milieu du premier ou du deuxième utilisateur — sans rien écrire pour lui, et
// sans que personne ne le voie (le lundi matin, il n'y a pas de témoin).
// Mesuré sur ce déploiement : une fonction a tenu 204 s sans être coupée.
export const maxDuration = 300;

// Marge de sécurité : on n'ENTAME pas un utilisateur qu'on ne pourra pas finir.
// Un utilisateur coupé au milieu de son appel Claude est de l'API payée pour
// rien ; les 12 crons du lundi (toutes les 5 min) reprendront de toute façon là
// où celui-ci s'est arrêté, puisque processUser saute ceux qui sont déjà faits.
const BUDGET_MS = 230 * 1000;

export default async function handler(req, res) {
  const depart = Date.now();
  // ⚠️ Les entrées cron de vercel.json ne portent PAS de `?secret=` : Vercel
  // envoie `Authorization: Bearer $CRON_SECRET` de lui-même. Sans cette
  // troisième forme, chaque lundi matin repartait en 401 dès que la variable
  // était configurée — et personne ne s'en apercevait, la génération se
  // déclenchant aussi à l'ouverture de suivi.html.
  // Fail-closed : sans CRON_SECRET configurée, tout est refusé. La version
  // précédente comparait `undefined === undefined` et laissait donc l'endpoint
  // OUVERT à qui connaissait l'URL — chaque appel consommant l'API Claude.
  // Pablo a confirmé le 2026-08-03 que la variable existe sur Vercel.
  const porteur = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  const secret = req.query?.secret || req.headers?.['x-cron-secret'] || porteur;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
  const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

  // Allow targeting a single user for testing
  const targetUser = req.query?.user_id;

  try {
    // 1. Get all users with completed onboarding
    let url = `${SB_URL}/rest/v1/onboarding?completed=eq.true&select=user_id,prenom,email,poids,taille,age,sexe,activite,tdee,objectif_type&limit=50`;
    if (targetUser) url += `&user_id=eq.${targetUser}`;

    const usersRes = await fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    const users = await usersRes.json();

    const validUsers = (Array.isArray(users) ? users : []).filter(u =>
      u.user_id && u.user_id !== 'anonymous' && u.user_id.includes('-')
    );

    const semaine = getLundiSemaine();
    let processed = 0, reportes = 0;

    for (const user of validUsers) {
      if (Date.now() - depart > BUDGET_MS) { reportes++; continue; }
      try {
        // Pas de `forcer` : celui qui a déjà une ligne PLEINE pour cette semaine
        // est sauté, ce qui permet aux 12 crons de se relayer sans doublon.
        const bilan = await processUser(user, semaine, SB_URL, SB_KEY, CLAUDE_API, CLAUDE_KEY);
        if (bilan) processed++;
      } catch (e) {
        console.error(`Error for ${user.user_id}:`, e.message);
      }
    }

    return res.status(200).json({ ok: true, processed, reportes, semaine });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
