export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to_email, client_name, message_preview } = req.body || {};

    if (!to_email || !message_preview) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    const emailBody = {
      from: 'Natty <notifications@natty-suivi.fr>',
      to: [to_email],
      subject: '💬 Nouveau message de votre nutritionniste',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <div style="background:#1a1a2e;padding:28px 28px 24px;text-align:center;">
              <div style="font-size:36px;margin-bottom:10px;">🧑‍⚕️</div>
              <div style="color:#fff;font-size:20px;font-weight:600;">Votre nutritionniste</div>
              <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px;">vous a envoyé un message</div>
            </div>
            <div style="padding:28px;">
              <div style="background:#f2f2f7;border-radius:14px;padding:16px 18px;margin-bottom:22px;">
                <div style="font-size:12px;color:#8e8e93;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Message</div>
                <div style="font-size:15px;color:#1c1c1e;line-height:1.6;">${message_preview}</div>
              </div>
              <a href="https://natty-suivi.vercel.app/chat.html" 
                 style="display:block;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:14px;padding:16px;text-align:center;font-size:15px;font-weight:600;">
                Répondre →
              </a>
              <p style="font-size:11px;color:#aeaeb2;text-align:center;margin-top:18px;line-height:1.6;">
                Vous recevez cet email car vous êtes abonné(e) au suivi Natty.<br>
                Connectez-vous à <a href="https://natty-suivi.vercel.app" style="color:#1a1a2e;">natty-suivi.vercel.app</a> pour accéder à votre espace.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({ error: 'Email send failed', details: data });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
