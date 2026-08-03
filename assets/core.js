/* ═══════════════════════════════════════════════════════════
   Natty — Core partagé (token/USER_ID, Supabase, Cloudinary)
   Utilisé par tous les nouveaux écrans (suivi/menu/repas/coaching/profil/défis).
   Ne duplique pas cette logique par page — un seul point de vérité.
   ═══════════════════════════════════════════════════════════ */
var Natty = (function () {
  var SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w';
  var CLD_CLD = 'dujji1s6g';
  var CLD_PRE = 'meal_photos';

  // Base des routes /api/*. Même règle que assets/reco.js, centralisée ici
  // pour que les pages n'aient plus à choisir entre un chemin relatif (qui ne
  // résout que sur le vrai déploiement web) et une URL absolue en dur (qui
  // faisait diverger la racine et www/). Tester le seul protocole ne suffit
  // pas : la WebView Android sert en http://localhost.
  var API = (function () {
    var h = location.hostname, pr = location.protocol;
    var web = (pr === 'http:' || pr === 'https:')
      && h && h !== 'localhost' && h !== '127.0.0.1' && h !== '[::1]';
    return web ? '' : 'https://natty-suivi.vercel.app';
  })();

  /* ── Session Supabase ────────────────────────────────────────
     L'identité vient du JWT émis par Supabase Auth, pas d'un identifiant
     passé dans l'URL : c'est lui qui permettra aux policies RLS de
     reconnaître l'utilisateur. Le jeton est court (1 h) et renouvelé à la
     demande avec le refresh_token.
     ─────────────────────────────────────────────────────────── */
  var SESSION_KEY = 'natty_session';
  var SESSION = null;
  var refreshEnCours = null;

  // Décode la charge utile d'un JWT sans la vérifier : elle ne sert qu'à
  // connaître l'identifiant et l'expiration. La vérification, elle, est faite
  // par Supabase à chaque requête — on ne lui fait pas confiance ici.
  function charge(jwt) {
    try {
      var p = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var bin = atob(p + '==='.slice((p.length + 3) % 4));
      var pct = Array.prototype.map.call(bin, function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('');
      return JSON.parse(decodeURIComponent(pct));
    } catch (e) { return null; }
  }

  function lireSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return (s && s.access_token && s.refresh_token) ? s : null;
    } catch (e) { return null; }
  }

  function ecrireSession(d) {
    if (!d || !d.access_token) return null;
    SESSION = {
      access_token: d.access_token,
      refresh_token: d.refresh_token || (SESSION && SESSION.refresh_token) || '',
      expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600))
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch (e) {}
    return SESSION;
  }

  // Marge de 60 s : un jeton qui expire pendant le vol de la requête serait
  // refusé côté serveur alors qu'il paraissait encore valide ici.
  function expireBientot(s) {
    return !s || !s.expires_at || (s.expires_at - 60) * 1000 <= Date.now();
  }

  // Un seul renouvellement à la fois : plusieurs écrans chargent leurs données
  // en parallèle, et un refresh_token consommé deux fois est invalidé.
  function rafraichirSession() {
    if (refreshEnCours) return refreshEnCours;
    if (!SESSION || !SESSION.refresh_token) return Promise.resolve(null);
    var jetonRafraichissement = SESSION.refresh_token;
    refreshEnCours = fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: jetonRafraichissement })
    }).then(function (r) {
      return r.json().then(function (d) {
        if (r.ok && d && d.access_token) return ecrireSession(d);
        // Refus explicite du serveur : la session est morte. On renvoie vers
        // la connexion plutôt que de retomber sur la clé anon — sinon, une
        // fois les RLS actives, l'utilisateur verrait des écrans vides sans
        // comprendre qu'il est déconnecté.
        deconnecter();
        return null;
      });
    }).catch(function () {
      // Panne réseau : on garde la session, elle re-servira au retour en ligne.
      return null;
    }).then(function (s) { refreshEnCours = null; return s; });
    return refreshEnCours;
  }

  async function jeton() {
    if (!SESSION) return null;
    if (!expireBientot(SESSION)) return SESSION.access_token;
    var s = await rafraichirSession();
    return s ? s.access_token : null;
  }

  function deconnecter(redirige) {
    SESSION = null;
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('natty_token');
      localStorage.removeItem('natty_user_id');
    } catch (e) {}
    // Jamais depuis la page de connexion elle-même : elle charge aussi core.js,
    // et une session périmée y déclencherait une boucle de rechargement.
    var surLogin = /login\.html$/.test(window.location.pathname);
    if (redirige !== false && !surLogin) window.location.href = 'login.html';
  }

  SESSION = lireSession();

  /* ── Identité ──────────────────────────────────────────────── */
  var params = new URLSearchParams(window.location.search);
  var TOKEN = params.get('token') || '';
  var USER_ID = null;

  var claims = SESSION ? charge(SESSION.access_token) : null;
  if (claims && claims.sub) USER_ID = claims.sub;

  // Repli transitoire : les identifiants passés par l'URL ou laissés en
  // localStorage par l'ancien fonctionnement. À supprimer une fois les RLS
  // actives — à ce moment-là ces requêtes ne renverront plus rien de toute
  // façon, faute de JWT.
  if (!USER_ID) {
    var uP = params.get('userId');
    if (uP && uP !== 'null') {
      USER_ID = uP;
    } else if (TOKEN.length > 10) {
      try {
        var d = TOKEN.match(/.{1,2}/g).map(function (b) { return String.fromCharCode(parseInt(b, 16)); }).join('');
        if (d.indexOf('-') > -1) USER_ID = d;
      } catch (e) {}
    }
    if (TOKEN && USER_ID) {
      localStorage.setItem('natty_token', TOKEN);
      localStorage.setItem('natty_user_id', USER_ID);
    } else if (!TOKEN) {
      var savedToken = localStorage.getItem('natty_token');
      var savedUserId = localStorage.getItem('natty_user_id');
      if (savedToken && savedUserId) { TOKEN = savedToken; USER_ID = savedUserId; }
    }
  }

  /* ── Accès Supabase ────────────────────────────────────────── */
  // Sans session, on retombe sur la clé anon : c'est ce qui fait tenir les
  // écrans tant que les RLS sont désactivées. Une fois les policies posées,
  // seul le JWT donnera accès aux données.
  async function entetes(sup) {
    var t = await jeton();
    var h = {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + (t || SB_KEY),
      'Content-Type': 'application/json'
    };
    if (sup) for (var k in sup) h[k] = sup[k];
    return h;
  }

  async function appel(path, init, reessai) {
    var o = init || {};
    var r = await fetch(SB_URL + '/rest/v1/' + path, {
      method: o.method || 'GET',
      headers: await entetes(o.headers),
      body: o.body
    });
    // Jeton refusé alors qu'on en avait un : il a pu être révoqué côté serveur.
    // On tente un renouvellement, une seule fois.
    if ((r.status === 401 || r.status === 403) && SESSION && !reessai) {
      if (await rafraichirSession()) return appel(path, init, true);
    }
    var t = await r.text();
    if (!r.ok) throw new Error(t);
    return t ? JSON.parse(t) : [];
  }

  function sbFetch(path) {
    return appel(path, { headers: { Accept: 'application/json' } });
  }

  function sbPost(path, body, prefer) {
    return appel(path, {
      method: 'POST',
      headers: { Prefer: prefer || 'return=representation' },
      body: JSON.stringify(body)
    });
  }

  function sbPatch(path, body) {
    return appel(path, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
  }

  // Table nutritionnelle (~100g), identique à celle d'index.html — même calcul partout.
  var NT = {
    'poulet':{c:165,p:31,l:3.6,g:0},'dinde':{c:135,p:29,l:1,g:0},'boeuf':{c:250,p:26,l:15,g:0},
    'saumon':{c:208,p:20,l:13,g:0},'thon':{c:132,p:28,l:1,g:0},'cabillaud':{c:82,p:18,l:0.7,g:0},
    'crevettes':{c:99,p:21,l:1.1,g:0},'sardines':{c:208,p:25,l:11,g:0},
    'oeuf':{c:155,p:13,l:11,g:1.1},'oeufs':{c:155,p:13,l:11,g:1.1},
    'agneau':{c:282,p:25,l:20,g:0},'porc':{c:242,p:27,l:14,g:0},'lardons':{c:337,p:18,l:29,g:0},
    'tofu':{c:76,p:8,l:4.2,g:1.9},'tempeh':{c:195,p:19,l:11,g:9.4},
    'lentilles':{c:116,p:9,l:0.4,g:20},'pois chiches':{c:164,p:9,l:2.6,g:27},'haricots':{c:127,p:9,l:0.5,g:23},
    'edamame':{c:122,p:11,l:5.2,g:9.9},
    'riz':{c:130,p:2.7,l:0.3,g:28},'pates':{c:131,p:5,l:1.1,g:25},'quinoa':{c:120,p:4.4,l:1.9,g:22},
    'pain':{c:265,p:9,l:3.2,g:49},'pomme de terre':{c:77,p:2,l:0.1,g:17},
    'patate douce':{c:86,p:1.6,l:0.1,g:20},'avoine':{c:389,p:17,l:7,g:66},
    'polenta':{c:83,p:2,l:0.5,g:18},'boulgour':{c:83,p:3,l:0.2,g:18},'sarrasin':{c:92,p:3.4,l:0.6,g:20},
    'brocoli':{c:34,p:2.8,l:0.4,g:7},'epinards':{c:23,p:2.9,l:0.4,g:3.6},'courgette':{c:17,p:1.2,l:0.3,g:3.1},
    'tomate':{c:18,p:0.9,l:0.2,g:3.9},'carotte':{c:41,p:0.9,l:0.2,g:10},'poivron':{c:31,p:1,l:0.3,g:6},
    'salade':{c:15,p:1.4,l:0.2,g:2.9},'avocat':{c:160,p:2,l:15,g:9},'champignons':{c:22,p:3.1,l:0.3,g:3.3},
    'oignon':{c:40,p:1.1,l:0.1,g:9},'ail':{c:149,p:6.4,l:0.5,g:33},'aubergine':{c:25,p:1,l:0.2,g:6},
    'pomme':{c:52,p:0.3,l:0.2,g:14},'banane':{c:89,p:1.1,l:0.3,g:23},'fraise':{c:32,p:0.7,l:0.3,g:7.7},
    'orange':{c:47,p:0.9,l:0.1,g:12},'mangue':{c:60,p:0.8,l:0.4,g:15},'kiwi':{c:61,p:1.1,l:0.5,g:15},
    'yaourt':{c:59,p:3.5,l:3.3,g:4.7},'fromage blanc':{c:79,p:8,l:4,g:3.5},'feta':{c:264,p:14,l:21,g:4},
    'mozzarella':{c:280,p:18,l:22,g:2.2},'parmesan':{c:431,p:38,l:29,g:4},'lait':{c:61,p:3.2,l:3.3,g:4.8},
    'huile olive':{c:884,p:0,l:100,g:0},'huile':{c:884,p:0,l:100,g:0},'beurre':{c:717,p:0.9,l:81,g:0.1},
    'noix':{c:654,p:15,l:65,g:14},'amandes':{c:579,p:21,l:50,g:22},'tahini':{c:595,p:17,l:54,g:21}
  };
  function getNutri(name, qty) {
    var n = (name || '').toLowerCase();
    var key = Object.keys(NT).find(function (k) { return n.indexOf(k) > -1 || k.split(' ').every(function (w) { return n.indexOf(w) > -1; }); });
    if (!key) return null;
    var f = qty / 100, b = NT[key];
    return { c: Math.round(b.c * f), p: Math.round(b.p * f * 10) / 10, l: Math.round(b.l * f * 10) / 10, g: Math.round(b.g * f * 10) / 10 };
  }
  function calcMac(ings) {
    var t = { c: 0, p: 0, l: 0, g: 0 };
    (ings || []).forEach(function (i) {
      var r = getNutri(i.name, i.quantity_g || 0);
      if (r) { t.c += r.c; t.p += r.p; t.l += r.l; t.g += r.g; }
    });
    return { c: Math.round(t.c), p: Math.round(t.p * 10) / 10, l: Math.round(t.l * 10) / 10, g: Math.round(t.g * 10) / 10 };
  }

  function goto(page) {
    var qs = window.location.search || '';
    window.location.href = page + qs;
  }

  function requireAuth() {
    if (USER_ID) return true;
    setTimeout(function () {
      if (!USER_ID) window.location.href = 'login.html';
    }, 1500);
    return false;
  }

  return {
    SB_URL: SB_URL, SB_KEY: SB_KEY, CLD_CLD: CLD_CLD, CLD_PRE: CLD_PRE, API: API,
    TOKEN: TOKEN, USER_ID: USER_ID,
    sbFetch: sbFetch, sbPost: sbPost, sbPatch: sbPatch,
    calcMac: calcMac, getNutri: getNutri, goto: goto, requireAuth: requireAuth,
    // Session : entetes() sert aux appels qui n'utilisent pas les helpers
    // ci-dessus (Cloudinary, /auth/v1, requêtes en return=minimal).
    entetes: entetes, jeton: jeton, deconnecter: deconnecter,
    estConnecte: function () { return !!SESSION; },
    ouvrirSession: ecrireSession,
    // Contenu du jeton courant (sub, email, user_metadata…). Relu à chaque
    // appel, contrairement à USER_ID qui est figé au chargement de la page —
    // après ouvrirSession, c'est ici qu'est la bonne valeur.
    profil: function () { return SESSION ? charge(SESSION.access_token) : null; }
  };
})();
