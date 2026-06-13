// api/conseils-hebdo.js
export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
  const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY;
  const CLAUDE_API = 'https://natty-suivi.vercel.app/api/claude';
  const RESEND_KEY = process.env.RESEND_API_KEY;

  try {
    // Récupérer uniquement les vrais UUIDs (exclure 'anonymous')
    const usersRes = await fetch(
      `${SB_URL}/rest/v1/onboarding?completed=eq.true&user_id=neq.anonymous&select=user_id,prenom,email,poids,taille,activite,objectif_type,tdee`,
      { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
    );
    const allUsers = await usersRes.json();

    // Filtrer les doublons de user_id (garder le dernier prenom non null)
    const seen = {};
    for (const u of allUsers) {
      if (!u.user_id || u.user_id === 'anonymous') continue;
      // Garder celui qui a un prenom si doublon
      if (!seen[u.user_id] || u.prenom) seen[u.user_id] = u;
    }
    const users = Object.values(seen);

    if (!users.length) return res.status(200).json({ ok: true, processed: 0 });

    const semaine = getLundiSemaine();
    let processed = 0;
    const errors = [];

    for (const user of users) {
      try {
        // Repas des 7 derniers jours
        const since = new Date(Date.now() - 7*24*3600*1000).toISOString();
        const mealsRes = await fetch(
          `${SB_URL}/rest/v1/meals?user_id=eq.${user.user_id}&created_at=gte.${since}&select=name,meal_ingredients(name,quantity_g,calories_per_100g,proteins_per_100g,carbs_per_100g,fats_per_100g)&limit=20`,
          { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
        );
        const meals = await mealsRes.json();
        const mealsDesc = (Array.isArray(meals) ? meals : []).map(m => {
          const ings = (m.meal_ingredients || []).map(i => i.name + ' ' + i.quantity_g + 'g').join(', ');
          return m.name + (ings ? ' (' + ings + ')' : '');
        }).join(' | ') || 'aucun repas enregistré cette semaine';

        // Calcul macros
        const tdee = user.tdee || (user.poids || 70) * 30;
        const prot = Math.round((user.poids || 70) * 2);
        const lip  = Math.round(tdee * 0.25 / 9);
        const gluc = Math.round((tdee - prot*4 - lip*9) / 4);

        const prompt = `Tu es nutritionniste expert. Analyse la semaine de ${user.prenom || 'ce client'} et génère 6 conseils courts et actionnables.
Profil: ${user.poids || '?'}kg, objectif: ${user.objectif_type || '?'}, activité: ${user.activite || '?'}
Objectifs macros: prot=${prot}g gluc=${gluc}g lip=${lip}g cal=${tdee}kcal
Repas de la semaine: ${mealsDesc}

Génère exactement ce JSON sans backticks:
{"conseil_prot":"1 phrase concrète sur les protéines","conseil_gluc":"1 phrase sur les glucides","conseil_lip":"1 phrase sur les lipides","conseil_cal":"1 phrase sur les calories","conseil_amelioration":"1-2 phrases sur ce qu il peut améliorer la semaine prochaine","conseil_points_forts":"1-2 phrases sur ses points forts cette semaine"}`;

        const claudeRes = await fetch(CLAUDE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, max_tokens: 600 })
        });
        const claudeData = await claudeRes.json();
        const raw = (claudeData.text || '{}').replace(/```[a-z]*/g,'').replace(/```/g,'').trim();
        const conseils = JSON.parse(raw);

        // Sauvegarder
        await fetch(`${SB_URL}/rest/v1/profil_conseils`, {
          method: 'POST',
          headers: {
            apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify({
            user_id: user.user_id,
            conseil_prot:         conseils.conseil_prot || null,
            conseil_gluc:         conseils.conseil_gluc || null,
            conseil_lip:          conseils.conseil_lip || null,
            conseil_cal:          conseils.conseil_cal || null,
            conseil_amelioration: conseils.conseil_amelioration || null,
            conseil_points_forts: conseils.conseil_points_forts || null,
            semaine,
            generated_at: new Date().toISOString()
          })
        });

        // Email (si dispo)
        if (user.email && RESEND_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Natty <conseils@natty-nutrition.com>',
              to: user.email,
              subject: `${user.prenom || 'Vos'} conseils nutritionnels de la semaine ✨`,
              html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f0f0f3;border-radius:24px;">
                <h1 style="font-size:22px;color:#1a1a2e;">Bonjour ${user.prenom || ''} 👋</h1>
                <p style="color:#666;">Vos conseils personnalisés pour cette semaine :</p>
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
        errors.push({ user_id: user.user_id, error: userErr.message });
      }
    }

    return res.status(200).json({ ok: true, processed, semaine, total: users.length, errors });

  } catch(err) {
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
