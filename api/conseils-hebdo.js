// api/conseils-hebdo.js
export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
  const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY;
  const CLAUDE_API = 'https://natty-suivi.vercel.app/api/claude';
  const semaine = getLundiSemaine();
  const targetUserId = req.query.user_id;

  try {
    let users;
    if (targetUserId) {
      const r = await fetch(
        `${SB_URL}/rest/v1/onboarding?user_id=eq.${targetUserId}&select=user_id,prenom,poids,activite,objectif_type,tdee&limit=1`,
        { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
      );
      users = await r.json();
    } else {
      const r = await fetch(
        `${SB_URL}/rest/v1/onboarding?completed=eq.true&user_id=neq.anonymous&select=user_id,prenom,poids,activite,objectif_type,tdee`,
        { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
      );
      const all = await r.json();
      const seen = {};
      for (const u of (Array.isArray(all) ? all : [])) {
        if (!u.user_id || u.user_id === 'anonymous') continue;
        if (!seen[u.user_id] || u.prenom) seen[u.user_id] = u;
      }
      const allUsers = Object.values(seen);
      const dejaRes = await fetch(
        `${SB_URL}/rest/v1/profil_conseils?semaine=eq.${semaine}&select=user_id`,
        { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
      );
      const deja = await dejaRes.json();
      const traiteIds = new Set((Array.isArray(deja) ? deja : []).map(t => t.user_id));
      const restants = allUsers.filter(u => !traiteIds.has(u.user_id));
      if (!restants.length) return res.status(200).json({ ok: true, message: 'Tous traités', semaine });
      users = [restants[0]];
    }

    if (!users || !users.length) return res.status(200).json({ ok: true, processed: 0 });
    const user = users[0];

    // Repas
    const since = new Date(Date.now() - 7*24*3600*1000).toISOString();
    const mealsRes = await fetch(
      `${SB_URL}/rest/v1/meals?user_id=eq.${user.user_id}&created_at=gte.${since}&select=name,meal_ingredients(name,quantity_g)&limit=20`,
      { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
    );
    const meals = await mealsRes.json();
    const mealsDesc = (Array.isArray(meals) ? meals : []).map(m => {
      const ings = (m.meal_ingredients || []).map(i => i.name + ' ' + i.quantity_g + 'g').join(', ');
      return m.name + (ings ? ' (' + ings + ')' : '');
    }).join(' | ') || 'aucun repas enregistré';

    const tdee = user.tdee || (user.poids || 70) * 30;
    const prot = Math.round((user.poids || 70) * 2);
    const lip  = Math.round(tdee * 0.25 / 9);
    const gluc = Math.round((tdee - prot*4 - lip*9) / 4);

    const prompt = `Nutritionniste expert. Analyse la semaine de ${user.prenom || 'ce client'}.
Profil: ${user.poids||'?'}kg, objectif: ${user.objectif_type||'?'}, activité: ${user.activite||'?'}
Macros: prot=${prot}g gluc=${gluc}g lip=${lip}g cal=${tdee}kcal
Repas: ${mealsDesc}
JSON sans backticks: {"conseil_prot":"...","conseil_gluc":"...","conseil_lip":"...","conseil_cal":"...","conseil_amelioration":"...","conseil_points_forts":"..."}`;

    const claudeRes = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, max_tokens: 800 })
    });
    const claudeData = await claudeRes.json();
    let raw = (claudeData.text || '{}').replace(/```[a-z]*/g,'').replace(/```/g,'').trim();
    // Si JSON tronqué, fermer les strings/objets ouverts
    if (!raw.endsWith('}')) {
      const lastComma = raw.lastIndexOf(',"');
      if (lastComma > 0) raw = raw.substring(0, lastComma);
      raw = raw + '}';
    }
    let conseils;
    try { conseils = JSON.parse(raw); }
    catch(e) {
      // Fallback: extraire les valeurs avec regex
      conseils = {};
      const keys = ['conseil_prot','conseil_gluc','conseil_lip','conseil_cal','conseil_amelioration','conseil_points_forts'];
      for (const k of keys) {
        const m = raw.match(new RegExp('"' + k + '":\s*"([^"]*)"'));
        if (m) conseils[k] = m[1];
      }
    }

    const payload = {
      user_id:              user.user_id,
      conseils_json:        JSON.stringify(conseils), // compat colonne NOT NULL
      conseil_prot:         conseils.conseil_prot || null,
      conseil_gluc:         conseils.conseil_gluc || null,
      conseil_lip:          conseils.conseil_lip || null,
      conseil_cal:          conseils.conseil_cal || null,
      conseil_amelioration: conseils.conseil_amelioration || null,
      conseil_points_forts: conseils.conseil_points_forts || null,
      semaine,
      generated_at:         new Date().toISOString()
    };

    // Upsert : INSERT + ON CONFLICT UPDATE via merge-duplicates
    const saveRes = await fetch(`${SB_URL}/rest/v1/profil_conseils`, {
      method: 'POST',
      headers: {
        apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    });

    const saveStatus = saveRes.status;
    const saveBody = saveRes.ok ? null : await saveRes.text();

    return res.status(200).json({
      ok: saveRes.ok,
      action: 'UPSERT',
      status: saveStatus,
      error: saveBody || undefined,
      user_id: user.user_id,
      prenom: user.prenom,
      semaine,
      conseils
    });

  } catch(err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}

function getLundiSemaine() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
