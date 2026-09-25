/* crm/crm-auth.js — le socle partagé de toutes les pages du CRM.
   Session, requêtes Supabase, et le sondage des notifications.

   ⚠️ Même clé de session que admin.html (`natty_staff_session`) : se
   connecter sur l'un ouvre l'autre sans redemander. C'est voulu — le CRM
   et le back-office parlent au même compte d'équipe (table `staff`).
   Ne JAMAIS changer cette clé sans changer admin.html en même temps. */
(function () {
  const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w';
  const STAFF_SESSION_KEY = 'natty_staff_session';

  let STAFF_SESSION = null, STAFF_ROLE = null, MOI = null;
  function lireStaffSession() {
    try { const s = JSON.parse(localStorage.getItem(STAFF_SESSION_KEY) || 'null'); return (s && s.access_token) ? s : null; }
    catch (e) { return null; }
  }
  function ecrireStaffSession(s) {
    STAFF_SESSION = s;
    try { s ? localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(STAFF_SESSION_KEY); } catch (e) {}
  }
  STAFF_SESSION = lireStaffSession();
  function jetonStaff() { return (STAFF_SESSION && STAFF_SESSION.access_token) || SB_KEY; }

  async function sb(path, options) {
    options = options || {};
    const res = await fetch(SB_URL + '/rest/v1/' + path, {
      ...options,
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + jetonStaff(), 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) }
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text);
    return text ? JSON.parse(text) : [];
  }

  async function connexionSupabase(email, pwd) {
    const res = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pwd })
    });
    const d = await res.json().catch(() => null);
    if (!res.ok || !d || !d.access_token) return null;
    return { access_token: d.access_token, refresh_token: d.refresh_token || '', user_id: (d.user && d.user.id) || '' };
  }

  async function connecter(email, pwd) {
    const session = await connexionSupabase(email, pwd);
    if (!session) return { ok: false, err: 'Email ou mot de passe incorrect' };
    ecrireStaffSession(session);
    let ligne = null;
    try { ligne = (await sb('staff?user_id=eq.' + session.user_id + '&select=*&limit=1'))[0] || null; } catch (e) {}
    if (!ligne || !ligne.actif) { ecrireStaffSession(null); return { ok: false, err: "Ce compte n'a pas de rôle d'équipe actif." }; }
    STAFF_ROLE = ligne.role; MOI = ligne;
    return { ok: true, moi: ligne };
  }
  async function reprendreSession() {
    if (!STAFF_SESSION || !STAFF_SESSION.user_id) return { ok: false };
    try {
      const r = await sb('staff?user_id=eq.' + STAFF_SESSION.user_id + '&select=*&limit=1');
      const ligne = r && r[0];
      if (!ligne || !ligne.actif) { ecrireStaffSession(null); return { ok: false }; }
      STAFF_ROLE = ligne.role; MOI = ligne;
      return { ok: true, moi: ligne };
    } catch (e) { ecrireStaffSession(null); return { ok: false }; }
  }
  function deconnecter() { ecrireStaffSession(null); STAFF_ROLE = null; MOI = null; }

  /* ═══ Notifications — sondage léger, pas de WebSocket (voir docs/crm-spec.md,
     étape 0 : le seul précédent WS de ce dépôt, chat.html/challenges.html, est
     documenté comme fragile). 18 s tant que l'onglet est visible ; rien quand
     il ne l'est pas — sonder une page cachée ne rappelle rien à personne. */
  let sondageTimer = null, dernieresVues = new Set();
  async function nonLues() {
    if (!MOI) return [];
    return sb('notifications?destinataire=eq.' + MOI.user_id + '&lu=eq.false&select=*&order=created_at.desc');
  }
  async function marquerLue(id) {
    await sb('notifications?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ lu: true, lu_le: new Date().toISOString() }) });
  }
  function demarrerSondage(onNouvelle, onListe) {
    arreterSondage();
    const tick = async () => {
      if (document.hidden) return;
      let liste = [];
      try { liste = await nonLues(); } catch (e) { return; }
      if (onListe) onListe(liste);
      liste.forEach(n => { if (!dernieresVues.has(n.id)) { dernieresVues.add(n.id); if (onNouvelle) onNouvelle(n); } });
    };
    tick();
    sondageTimer = setInterval(tick, 18000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }
  function arreterSondage() { if (sondageTimer) clearInterval(sondageTimer); sondageTimer = null; }

  window.NattyCRM = {
    sb, connecter, reprendreSession, deconnecter,
    get moi() { return MOI; }, get role() { return STAFF_ROLE; },
    get connecte() { return !!STAFF_SESSION; },
    notifications: { nonLues, marquerLue, demarrerSondage, arreterSondage }
  };
})();
