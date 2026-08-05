// Génération de la semaine à la demande, pour UNE personne — celle qui appelle.
//
// POURQUOI CET ENDPOINT EXISTE. La génération demande ~56 s à l'API (mesuré en
// prod le 2026-08-04 sur le prompt réel). Tant qu'elle vivait dans la page, elle
// mourait avec la page — et même sans quitter l'écran : une WebView iOS coupe
// une requête à 60 s (délai par défaut d'URLSession). D'où le « Échec —
// vérifiez votre connexion » alors que la connexion allait parfaitement bien,
// et les conseils qui « tournaient dans le vide ». Ici, le long appel est fait
// de serveur à serveur ; le résultat atterrit dans `profil_conseils` que l'app
// soit ouverte, fermée ou en arrière-plan. L'écran n'a plus qu'à relire la ligne
// — et c'est bien ce que fait `assets/generation.js`, qui n'attend même pas la
// réponse de cet endpoint.
//
// ⚠️ Conséquence à ne pas perdre de vue : le client ne verra probablement JAMAIS
// le corps de cette réponse. Tout ce qui doit lui parvenir doit passer par la
// base, pas par le code HTTP.
//
// AUTHENTIFICATION. Pas de CRON_SECRET : c'est un utilisateur, pas un cron. On
// vérifie son JWT auprès de Supabase et on ne génère QUE pour l'identité que ce
// jeton porte. Personne ne peut donc déclencher une génération — donc une
// dépense d'API — au nom de quelqu'un d'autre, ni en rafale sans compte.
//
// ⚠️ Runtime Node (pas edge) : appel long, et `_generation.js` n'est pas conçu
// pour edge.

import { processUser, getLundiSemaine } from './_generation.js';

// Vercel coupe la fonction à `maxDuration`, et une coupure au milieu de l'appel
// n'écrit RIEN : ni conseils, ni recettes, ni plats macro.
// ⚠️ Porté de 120 s à 180 s (août 2026). La génération produit maintenant aussi
// les trois plats macro de la planification : **mesuré 85 s** contre ~56 s quand
// 120 avait été choisi. 120 laissait 35 s de marge à un appel qui varie de
// plusieurs dizaines de secondes selon la charge d'Anthropic. Mesuré sur ce
// déploiement : une fonction a tenu 204 s sans être coupée.
export const maxDuration = 180;

const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const jeton = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jeton) return res.status(401).json({ error: 'Session requise' });

  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
  if (!SB_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY non configurée' });
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurée' });

  // Corps facultatif. Le parse manuel couvre le cas où `req.body` arrive vide
  // ou en chaîne, comme dans api/checkout.js.
  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      const brut = await new Promise((ok, ko) => {
        let d = ''; req.on('data', c => d += c); req.on('end', () => ok(d)); req.on('error', ko);
      });
      body = brut ? JSON.parse(brut) : {};
    } catch (e) { body = {}; }
  }

  // 1. Qui appelle ? On le demande à Supabase, on ne lit pas le jeton nous-mêmes :
  //    un JWT non vérifié se fabrique en trois lignes.
  let uid;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + jeton }
    });
    const u = await r.json();
    if (!r.ok || !u || !u.id) return res.status(401).json({ error: 'Session invalide ou expirée' });
    uid = u.id;
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide' });
  }

  try {
    // 2. Son profil, pour l'email de récapitulatif et le prénom. Le reste de la
    //    collecte (questionnaire, repas de la semaine) est fait par processUser.
    //    ⚠️ `onboarding` contient de vrais doublons pour un même user_id, dont
    //    des lignes sans poids ni tdee : on prend la première exploitable.
    const pr = await fetch(
      `${SB_URL}/rest/v1/onboarding?user_id=eq.${uid}&order=created_at.desc&limit=5`
      + '&select=prenom,email,maturite,motivation,axe_amelioration,objectif_type,objectif_valeur,'
      + 'objectif_semaines,poids,taille,age,sexe,activite,bmr,tdee,deficit,contexte_repas,'
      + 'aliments_plaisir,aliments_refuses,allergies,regime,score_rigueur',
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    const lignes = await pr.json();
    const liste = Array.isArray(lignes) ? lignes : [];
    const user = liste.find(l => l && l.tdee && l.poids) || liste[0];
    if (!user) return res.status(400).json({ error: 'Profil introuvable — complétez l’onboarding.' });
    user.user_id = uid;

    // 3. La semaine vient du client quand il la donne. Le serveur est en UTC :
    //    un lundi entre 00 h et 02 h à Paris, il calculerait le lundi PRÉCÉDENT
    //    et la page conclurait aussitôt « conseils périmés ».
    const semaine = /^\d{4}-\d{2}-\d{2}$/.test(String(body.semaine || ''))
      ? body.semaine : getLundiSemaine();

    // Le garde-manger vit dans le localStorage de l'appareil (la table
    // `garde_manger` n'existe pas encore) : seule la page peut nous le donner.
    const garde = typeof body.garde === 'string' ? body.garde.slice(0, 1200) : '';

    // 4. `forcer` = true : c'est une demande explicite. Sans lui, `processUser`
    //    s'arrête dès qu'une ligne pleine existe pour la semaine en cours.
    const bilan = await processUser(user, semaine, SB_URL, SB_KEY,
      'https://api.anthropic.com/v1/messages', CLAUDE_KEY, true, garde);

    return res.status(200).json({ ok: true, semaine, recettes: (bilan && bilan.recettes) || 0 });
  } catch (err) {
    console.error('generer-conseils:', err.message);
    return res.status(500).json({ error: err.message || 'Génération impossible' });
  }
}
