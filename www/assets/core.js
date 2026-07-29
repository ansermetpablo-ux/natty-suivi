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

  var params = new URLSearchParams(window.location.search);
  var TOKEN = params.get('token') || '';
  var USER_ID = null;
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

  async function sbFetch(path) {
    var r = await fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }
    });
    var t = await r.text();
    if (!r.ok) throw new Error(t);
    return t ? JSON.parse(t) : [];
  }

  async function sbPost(path, body, prefer) {
    var r = await fetch(SB_URL + '/rest/v1/' + path, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' },
      body: JSON.stringify(body)
    });
    var t = await r.text();
    if (!r.ok) throw new Error(t);
    return t ? JSON.parse(t) : [];
  }

  async function sbPatch(path, body) {
    var r = await fetch(SB_URL + '/rest/v1/' + path, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    var t = await r.text();
    if (!r.ok) throw new Error(t);
    return t ? JSON.parse(t) : [];
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

  // Redirige les postMessage Wix (connexion/déconnexion) vers un rechargement propre —
  // même logique que index.html, centralisée pour tous les écrans.
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'userConnected' && data.token && data.userId) {
      var url = new URL(window.location.href);
      url.searchParams.set('token', data.token);
      window.location.replace(url.toString());
    } else if (data.type === 'userLoggedOut') {
      localStorage.removeItem('natty_token');
      localStorage.removeItem('natty_user_id');
      var url3 = new URL(window.location.href);
      url3.searchParams.delete('token');
      url3.searchParams.delete('userId');
      window.location.replace(url3.toString());
    }
  });

  return {
    SB_URL: SB_URL, SB_KEY: SB_KEY, CLD_CLD: CLD_CLD, CLD_PRE: CLD_PRE,
    TOKEN: TOKEN, USER_ID: USER_ID,
    sbFetch: sbFetch, sbPost: sbPost, sbPatch: sbPatch,
    calcMac: calcMac, getNutri: getNutri, goto: goto, requireAuth: requireAuth
  };
})();
