// api/conseils-hebdo.js
// À appeler chaque lundi matin via un cron Vercel (vercel.json)
// Génère les conseils pour TOUS les utilisateurs actifs et envoie un email

export default async function handler(req, res) {
  // Sécuriser avec un secret
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
  const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY;
  const CLAUDE_API = 'https://natty-suivi.vercel.app/api/claude';
  const RESEND_KEY = process.env.RESEND_API_KEY;

  try {
    // 1. Récupérer tous les utilisateurs avec onboarding complété
    const usersRes = await fetch(`${SB_URL}/rest/v1/onboarding?completed=eq.true&select=user_id,prenom,email,poids,taille,activite,objectif_type,tdee`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }
    });
    const users = await usersRes.json();
    if (!users || !users.length) return res.status(200).json({ ok: true, processed: 0 });

    const semaine = getLundiSemaine();
    let processed = 0;

    for (const user of users) {
      try {
        // 2. Récupérer les repas des 7 derniers jours
        const since = new Date(Date.now() - 7*24*3600*1000).toISOString();
        const mealsRes = await fetch(`${SB_URL}/rest/v1/meals?user_id=eq.${user.user_id}&created_at=gte.${since}&select=name,meal_ingredients(name,quantity_g,calories_per_100g,proteins_per_100g,carbs_per_100g,fats_per_100g)&limit=20`, {
          headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }
        });
        const meals = await mealsRes.json();
        const mealsDesc = (meals || []).map(m => {
          const ings = (m.meal_ingredients || []).map(i => i.name + ' ' + i.quantity_g + 'g').join(', ');
          return m.name + ' (' + ings + ')';
        }).join(' | ') || 'aucun repas enregistré cette semaine';

        // 3. Appeler Claude pour générer les 6 conseils
        const tdee = user.tdee || (user.poids || 70) * 30;
        const prot = Math.round((user.poids || 70) * 2);
        const lip = Math.round(tdee * 0.25 / 9);
        const gluc = Math.round((tdee - prot*4 - lip*9) / 4);

        const prompt = `Tu es nutritionniste expert. Analyse la semaine de ${user.prenom || 'ce client'} et génère 6 conseils courts et actionnables.
Profil: ${user.poids || '?'}kg, objectif: ${user.objectif_type || '?'}, activité: ${user.activite || '?'}
Objectifs macros: prot=${prot}g gluc=${gluc}g lip=${lip}g cal=${tdee}kcal
Repas de la semaine: ${mealsDesc}

Génère exactement ce JSON (sans backticks):
{"conseil_prot":"1 phrase courte et concrète sur les protéines","conseil_gluc":"1 phrase sur les glucides","conseil_lip":"1 phrase sur les lipides","conseil_cal":"1 phrase sur les calories","conseil_amelioration":"1-2 phrases sur ce qu'il peut améliorer la semaine prochaine","conseil_points_forts":"1-2 phrases sur ses points forts cette semaine"}`;

        const claudeRes = await fetch(CLAUDE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, max_tokens: 600 })
        });
        const claudeData = await claudeRes.json();
        const raw = (claudeData.text || '{}').replace(/```[a-z]*/g,'').replace(/```/g,'').trim();
        const conseils = JSON.parse(raw);

        // 4. Sauvegarder en base
        await fetch(`${SB_URL}/rest/v1/profil_conseils`, {
          method: 'POST',
          headers: {
            apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify({
            user_id: user.user_id,
            ...conseils,
            semaine,
            generated_at: new Date().toISOString()
          })
        });

        // 5. Envoyer l'email si email disponible
        if (user.email && RESEND_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Natty <conseils@natty-nutrition.com>',
              to: user.email,
              subject: `${user.prenom || 'Vos'} conseils nutritionnels de la semaine ✨`,
              html: `
                <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f0f0f3;border-radius:24px;">
                  <h1 style="font-size:22px;color:#1a1a2e;margin-bottom:8px;">Bonjour ${user.prenom || ''} 👋</h1>
                  <p style="color:#666;margin-bottom:24px;">Voici vos conseils personnalisés pour cette semaine :</p>
                  ${conseils.conseil_points_forts ? `<div style="background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;border-left:4px solid #007aff;">
                    <div style="font-size:11px;color:#007aff;font-weight:700;margin-bottom:6px;">⭐ POINTS FORTS</div>
                    <p style="margin:0;color:#333;">${conseils.conseil_points_forts}</p>
                  </div>` : ''}
                  ${conseils.conseil_amelioration ? `<div style="background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;border-left:4px solid #ff3b30;">
                    <div style="font-size:11px;color:#ff3b30;font-weight:700;margin-bottom:6px;">📈 À AMÉLIORER</div>
                    <p style="margin:0;color:#333;">${conseils.conseil_amelioration}</p>
                  </div>` : ''}
                  <div style="background:#1a1a2e;border-radius:16px;padding:16px;text-align:center;margin-top:24px;">
                    <a href="https://natty-suivi.vercel.app" style="color:#fff;font-weight:700;text-decoration:none;">Voir tous mes conseils →</a>
                  </div>
                </div>`
            })
          });
        }

        processed++;
      } catch(userErr) {
        console.error('Error for user', user.user_id, userErr);
      }
    }

    return res.status(200).json({ ok: true, processed, semaine });

  } catch(err) {
    console.error('conseils-hebdo error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function getLundiSemaine() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
