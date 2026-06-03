module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  const { to_email, subject, message, type, prenom, macros } = req.body || {};
  if (!to_email) return res.status(400).json({ error: 'to_email required' });

  let emailSubject, emailHtml;

  if (type === 'onboarding_recap') {
    // Email automatique après onboarding
    emailSubject = `🥗 Bienvenue ${prenom||''} — Votre profil nutritionnel Natty`;
    const m = macros || {};
    emailHtml = `
<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f5f5f7;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;">
  <div style="background:#1c1c1e;padding:32px;text-align:center;">
    <div style="font-size:40px;margin-bottom:12px;">🥗</div>
    <h1 style="color:#fff;font-size:22px;margin:0;">Bienvenue ${prenom||''}  !</h1>
    <p style="color:rgba(255,255,255,0.6);margin-top:8px;font-size:14px;">Votre profil nutritionnel est prêt</p>
  </div>
  <div style="padding:28px;">
    <h2 style="font-size:16px;margin-bottom:16px;">Vos objectifs nutritionnels</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;">
      <div style="background:#f5f5f7;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#ff6b35;">${m.proteines||'–'}g</div>
        <div style="font-size:12px;color:#8e8e93;">🥩 Protéines / jour</div>
      </div>
      <div style="background:#f5f5f7;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#ff9500;">${m.glucides||'–'}g</div>
        <div style="font-size:12px;color:#8e8e93;">🌾 Glucides / jour</div>
      </div>
      <div style="background:#f5f5f7;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#7b5ea7;">${m.lipides||'–'}g</div>
        <div style="font-size:12px;color:#8e8e93;">🥑 Lipides / jour</div>
      </div>
      <div style="background:#f5f5f7;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#34c759;">${m.calories||'–'}</div>
        <div style="font-size:12px;color:#8e8e93;">⚡ Calories / jour</div>
      </div>
    </div>
    <div style="background:#e8f9ee;border-radius:14px;padding:16px;margin-bottom:20px;">
      <p style="color:#1c1c1e;font-size:14px;margin:0;">🧑‍⚕️ <strong>Votre nutritionniste vous contactera prochainement</strong> pour planifier votre premier bilan et personnaliser votre plan.</p>
    </div>
    <a href="https://www.natty-nutrition.com/mon-suivi" style="display:block;background:#1c1c1e;color:#fff;text-align:center;padding:14px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Accéder à mon suivi →</a>
  </div>
  <div style="padding:20px;text-align:center;color:#8e8e93;font-size:12px;border-top:1px solid #f0f0f0;">
    Natty — Nutrition personnalisée<br>natty-nutrition.com
  </div>
</div>
</body></html>`;
  } else if (type === 'plan_nutritionnel') {
    // Email plan nutritionnel client premium
    emailSubject = subject || `📋 Votre plan nutritionnel personnalisé`;
    emailHtml = `
<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f5f5f7;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;">
  <div style="background:#1c1c1e;padding:32px;text-align:center;">
    <div style="font-size:40px;margin-bottom:12px;">📋</div>
    <h1 style="color:#fff;font-size:22px;margin:0;">Votre plan nutritionnel</h1>
    <p style="color:rgba(255,255,255,0.6);margin-top:8px;font-size:14px;">Préparé par votre nutritionniste</p>
  </div>
  <div style="padding:28px;">
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#1c1c1e;">${message||''}</div>
    <div style="margin-top:24px;">
      <a href="https://www.natty-nutrition.com/mon-suivi" style="display:block;background:#1c1c1e;color:#fff;text-align:center;padding:14px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Voir mon suivi →</a>
    </div>
  </div>
  <div style="padding:20px;text-align:center;color:#8e8e93;font-size:12px;border-top:1px solid #f0f0f0;">
    Natty — natty-nutrition.com
  </div>
</div>
</body></html>`;
  } else {
    // Message nutritionniste générique
    emailSubject = subject || 'Message de votre nutritionniste Natty';
    emailHtml = `
<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f5f5f7;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;">
  <div style="background:#1c1c1e;padding:24px;text-align:center;">
    <div style="font-size:32px;margin-bottom:8px;">🧑‍⚕️</div>
    <h1 style="color:#fff;font-size:18px;margin:0;">Message de votre nutritionniste</h1>
  </div>
  <div style="padding:28px;">
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#1c1c1e;">${message||''}</div>
    <div style="margin-top:24px;">
      <a href="https://www.natty-nutrition.com/mon-suivi" style="display:block;background:#1c1c1e;color:#fff;text-align:center;padding:14px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;">Répondre sur Natty →</a>
    </div>
  </div>
  <div style="padding:20px;text-align:center;color:#8e8e93;font-size:12px;border-top:1px solid #f0f0f0;">
    Natty — natty-nutrition.com
  </div>
</div>
</body></html>`;
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Natty <nutrition@natty-nutrition.com>',
        to: [to_email],
        subject: emailSubject,
        html: emailHtml
      })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(500).json({ error: data.message || 'Resend error', details: data });
    return res.status(200).json({ success: true, id: data.id });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };
