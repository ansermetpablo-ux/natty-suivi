export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { to_email, type, prenom } = body;

    if (!to_email) return res.status(400).json({ error: 'Missing to_email' });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

    let subject = '';
    let html = '';

    // ══ Shared styles ══
    const STYLE = `
      body{margin:0;padding:0;background:#f0f0f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
      .wrap{max-width:520px;margin:28px auto;background:#f0f0f3;border-radius:24px;overflow:hidden;}
      .hero{background:#1a1a2e;padding:32px 28px;text-align:center;}
      .hero-em{font-size:48px;display:block;margin-bottom:12px;}
      .hero-title{font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;}
      .hero-sub{font-size:13px;color:rgba(255,255,255,0.55);line-height:1.55;}
      .body{padding:24px 28px;}
      .card{background:#fff;border-radius:18px;padding:18px 20px;margin-bottom:14px;
            box-shadow:6px 6px 16px rgba(174,174,192,0.32),-6px -6px 16px rgba(255,255,255,0.9);}
      .card-title{font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:4px;display:flex;align-items:center;gap:8px;}
      .card-val{font-size:32px;font-weight:800;color:#1a1a2e;letter-spacing:-1.5px;line-height:1;}
      .card-unit{font-size:14px;color:#9a9aaa;font-weight:400;}
      .card-expl{font-size:12px;color:#6a6a7a;margin-top:8px;line-height:1.65;border-top:1px solid #f0f0f3;padding-top:8px;}
      .macros-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
      .conseil-card{background:#fff;border-radius:16px;padding:16px;margin-bottom:10px;
                    box-shadow:4px 4px 10px rgba(174,174,192,0.28),-4px -4px 10px rgba(255,255,255,0.88);
                    border-left:4px solid #34c759;}
      .conseil-titre{font-size:12px;font-weight:700;color:#34c759;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
      .conseil-texte{font-size:13px;color:#3a3a4a;line-height:1.65;}
      .section-title{font-size:16px;font-weight:800;color:#1a1a2e;margin:20px 0 12px;}
      .profil-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f3;font-size:13px;}
      .profil-label{color:#9a9aaa;}
      .profil-val{font-weight:600;color:#1a1a2e;}
      .cta{display:block;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:14px;padding:16px;
           text-align:center;font-size:15px;font-weight:700;margin-top:20px;}
      .footer{text-align:center;font-size:11px;color:#b0b0c0;padding:16px 28px 28px;line-height:1.7;}
      .lc-item{display:flex;align-items:center;gap:12px;padding:10px;background:#f8f8f8;border-radius:12px;margin-bottom:6px;}
      .lc-em{font-size:22px;}
      .lc-name{font-size:13px;font-weight:500;color:#1a1a2e;flex:1;}
      .lc-qty{font-size:12px;color:#9a9aaa;font-weight:600;}
      .etape-row{display:flex;gap:10px;margin-bottom:8px;}
      .etape-num{width:22px;height:22px;border-radius:50%;background:#1a1a2e;color:#fff;font-size:11px;font-weight:700;
                 display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}
      .etape-txt{font-size:13px;color:#3a3a4a;line-height:1.6;}
      .recette-header{background:#1a1a2e;border-radius:14px 14px 0 0;padding:14px 16px;margin-bottom:0;}
      .recette-nom{font-size:16px;font-weight:700;color:#fff;}
      .recette-mac{font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;}
      .recette-body{background:#fff;border-radius:0 0 14px 14px;padding:14px 16px;margin-bottom:14px;}
    `;

    const footer = `
      <div class="footer">
        Vous recevez cet email car vous êtes inscrit(e) sur Natty.<br>
        Vos données ne sont jamais partagées à des fins commerciales.<br>
        <a href="https://natty-nutrition.com" style="color:#1a1a2e;">natty-nutrition.com</a>
      </div>`;

    // ════════════════════════════════════════════════
    // TYPE 1 : profil_complet — envoyé après onboarding + bouton profil
    // ════════════════════════════════════════════════
    if (type === 'profil_complet' || type === 'onboarding_recap') {
      const { macros = {}, macros_explication = [], conseils = [], profil_syntese = {} } = body;
      const prenom_str = prenom ? `, ${prenom}` : '';
      subject = `🥗 Votre profil nutritionnel Natty`;

      const ACTIVITE_LABELS = {
        sedentaire:'Sédentaire', leger:'Légèrement actif',
        modere:'Modérément actif', actif:'Très actif'
      };
      const OBJECTIF_LABELS = {
        mieux_manger:'Mieux manger', changer_corps:'Changer mon corps',
        performance:'Performance sportive', sante:'Santé'
      };

      const macrosGrid = (macros_explication.length ? macros_explication : [
        {emoji:'🥩', nom:'Protéines', val:macros.proteines||0, unit:'g/jour', explication:'Essentielles pour la construction musculaire.'},
        {emoji:'🌾', nom:'Glucides',  val:macros.glucides||0,  unit:'g/jour', explication:'Source d\'énergie principale.'},
        {emoji:'🥑', nom:'Lipides',   val:macros.lipides||0,   unit:'g/jour', explication:'Santé hormonale et absorption vitamines.'},
        {emoji:'⚡', nom:'Calories',  val:macros.calories||0,  unit:'kcal/jour', explication:'Votre dépense énergétique totale estimée (TDEE).'},
      ]).map(m => `
        <div class="card">
          <div class="card-title">${m.emoji} ${m.nom}</div>
          <div><span class="card-val">${m.val}</span> <span class="card-unit">${m.unit}</span></div>
          <div class="card-expl">${m.explication}</div>
        </div>`).join('');

      const conseilsHtml = (conseils.length ? conseils : []).filter(c => c.texte && c.texte !== 'Non disponible').map(c => `
        <div class="conseil-card">
          <div class="conseil-titre">${c.titre}</div>
          <div class="conseil-texte">${c.texte}</div>
        </div>`).join('');

      const ps = profil_syntese;
      const profilRows = [
        ps.prenom || prenom ? ['Prénom', ps.prenom || prenom] : null,
        ps.age    ? ['Âge', ps.age + ' ans'] : null,
        ps.sexe   ? ['Sexe', ps.sexe === 'homme' ? 'Homme' : 'Femme'] : null,
        ps.poids  ? ['Poids', ps.poids + ' kg'] : null,
        ps.taille ? ['Taille', ps.taille + ' cm'] : null,
        ps.activite ? ['Activité', ACTIVITE_LABELS[ps.activite] || ps.activite] : null,
        ps.objectif ? ['Objectif', OBJECTIF_LABELS[ps.objectif] || ps.objectif] : null,
        ps.tdee ? ['TDEE', ps.tdee + ' kcal/jour'] : null,
      ].filter(Boolean).map(([l, v]) => `<div class="profil-row"><span class="profil-label">${l}</span><span class="profil-val">${v}</span></div>`).join('');

      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${STYLE}</style></head><body>
        <div class="wrap">
          <div class="hero">
            <span class="hero-em">🥗</span>
            <div class="hero-title">Votre profil nutritionnel${prenom_str}</div>
            <div class="hero-sub">Voici vos besoins journaliers personnalisés et vos conseils de la semaine.</div>
          </div>
          <div class="body">
            <div class="section-title">📊 Vos besoins journaliers</div>
            <div class="macros-grid">${macrosGrid}</div>
            ${profilRows ? `<div class="section-title">👤 Votre profil</div><div class="card">${profilRows}</div>` : ''}
            ${conseilsHtml ? `<div class="section-title">💡 Vos conseils de la semaine</div>${conseilsHtml}` : ''}
            <a href="https://natty-suivi.vercel.app" class="cta">Accéder à mon suivi →</a>
          </div>
          ${footer}
        </div>
      </body></html>`;
    }

    // ════════════════════════════════════════════════
    // TYPE 2 : conseils_hebdo — envoyé chaque lundi par le cron
    // ════════════════════════════════════════════════
    else if (type === 'conseils_hebdo') {
      const { conseils = [] } = body;
      subject = `🌿 Vos conseils nutritionnels de la semaine`;
      const conseilsHtml = conseils.filter(c => c.texte).map(c => `
        <div class="conseil-card">
          <div class="conseil-titre">${c.titre}</div>
          <div class="conseil-texte">${c.texte}</div>
        </div>`).join('');

      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${STYLE}</style></head><body>
        <div class="wrap">
          <div class="hero">
            <span class="hero-em">🌿</span>
            <div class="hero-title">Bonne semaine${prenom ? ', ' + prenom : ''} !</div>
            <div class="hero-sub">Voici vos conseils nutritionnels personnalisés pour cette semaine.</div>
          </div>
          <div class="body">
            <div class="section-title">💡 Vos conseils de la semaine</div>
            ${conseilsHtml || '<p style="color:#9a9aaa;font-size:13px;">Ajoutez des repas pour recevoir des conseils personnalisés.</p>'}
            <a href="https://natty-suivi.vercel.app" class="cta">Voir mon suivi →</a>
          </div>
          ${footer}
        </div>
      </body></html>`;
    }

    // ════════════════════════════════════════════════
    // TYPE 3 : courses_et_recettes — bouton profil
    // ════════════════════════════════════════════════
    else if (type === 'courses_et_recettes') {
      const { liste_courses = [], recettes = [] } = body;
      subject = `🛒 Votre liste de courses + recettes Natty`;

      // Liste de courses HTML
      const coursesHtml = (() => {
        const recIngr = (liste_courses.recettes_ingredients || []).map(item =>
          `<div class="lc-item"><span class="lc-em">${item.emoji}</span><span class="lc-name">${item.nom}</span><span class="lc-qty">${item.quantite}</span></div>`
        ).join('');
        const bonus = (liste_courses.aliments_bonus || []).map(item =>
          `<div class="lc-item" style="border-left:3px solid #34c759;"><span class="lc-em">${item.emoji}</span><div style="flex:1;"><div class="lc-name">${item.nom}</div><div style="font-size:11px;color:#9a9aaa;">${item.benefice || ''}</div></div><span class="lc-qty">${item.quantite}</span></div>`
        ).join('');
        return (recIngr || bonus) ? `
          ${recIngr ? `<div class="section-title">🍳 Pour vos recettes</div>${recIngr}` : ''}
          ${bonus   ? `<div class="section-title" style="margin-top:20px;">⭐ Aliments conseillés en plus</div>${bonus}` : ''}
        ` : '<p style="color:#9a9aaa;font-size:13px;">Aucune donnée disponible.</p>';
      })();

      // Recettes HTML
      const recettesHtml = (recettes || []).map(r => {
        const mac = r.macros || {};
        const etapes = (r.etapes || []).map((e, i) =>
          `<div class="etape-row"><div class="etape-num">${i+1}</div><div class="etape-txt">${e}</div></div>`
        ).join('');
        const ings = (r.ingredients || []).map(ing =>
          `<span style="background:#e8f9ee;color:#1e5c30;padding:4px 10px;border-radius:99px;font-size:11px;margin:2px;display:inline-block;">${ing}</span>`
        ).join('');
        return `
          <div class="recette-header">
            <div class="recette-nom">${r.emoji || '🍽️'} ${r.nom}</div>
            <div class="recette-mac">🥩 ${mac.prot||0}g &nbsp; 🌾 ${mac.gluc||0}g &nbsp; ⚡ ${mac.cal||0} kcal</div>
          </div>
          <div class="recette-body">
            <div style="margin-bottom:12px;">${ings}</div>
            ${etapes}
          </div>`;
      }).join('');

      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${STYLE}</style></head><body>
        <div class="wrap">
          <div class="hero">
            <span class="hero-em">🛒</span>
            <div class="hero-title">Vos courses et recettes${prenom ? ', ' + prenom : ''}</div>
            <div class="hero-sub">Liste de courses et recettes avec procédés détaillés pour cette semaine.</div>
          </div>
          <div class="body">
            <div class="section-title">🛒 Liste de courses</div>
            ${coursesHtml}
            <div class="section-title" style="margin-top:24px;">🍳 Vos recettes de la semaine</div>
            ${recettesHtml || '<p style="color:#9a9aaa;font-size:13px;">Aucune recette disponible.</p>'}
            <a href="https://natty-suivi.vercel.app" class="cta">Accéder à mon suivi →</a>
          </div>
          ${footer}
        </div>
      </body></html>`;
    }

    else {
      return res.status(400).json({ error: 'Unknown email type: ' + type });
    }

    // ══ Send via Resend ══
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Natty <hello@natty-nutrition.com>',
        to: [to_email],
        subject,
        html
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({ error: 'Email send failed', details: data });
    }
    return res.status(200).json({ success: true, id: data.id, type });

  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
