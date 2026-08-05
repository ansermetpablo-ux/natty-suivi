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

  // Interrupteur de bascule, à passer à true EN MÊME TEMPS que l'activation
  // des RLS (natty_rls.sql). Tant qu'il est à false, un utilisateur sans
  // session continue d'être servi par la clé anon — c'est ce qui fait tenir
  // l'app aujourd'hui. Une fois les policies posées, ce même utilisateur ne
  // recevrait plus que des tableaux vides : mieux vaut alors le renvoyer se
  // connecter que lui afficher une app qui a l'air cassée. Les comptes créés
  // avant la bascule JWT n'ont qu'un `natty_token` en localStorage et
  // repasseront donc par login.html une fois — c'est attendu.
  // Passé à true le 2026-08-03 : la migration se fait MAINTENANT, pendant
  // qu'on la regarde, plutôt qu'au moment où les policies seront posées. Sinon
  // ce drapeau serait à basculer dans le code exactement en même temps que la
  // RLS en SQL — deux endroits, deux systèmes, et un oubli qui se paie en
  // écrans vides chez des gens qui ne comprennent pas pourquoi.
  var SESSION_OBLIGATOIRE = true;

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

  // Sans la marge : « ce jeton est-il réellement mort ? ». Sert à décider si
  // un renouvellement refusé doit déconnecter, ou seulement être ignoré.
  function perime(s) {
    return !s || !s.expires_at || s.expires_at * 1000 <= Date.now();
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
        // ⚠️ Un refus ici ne veut PAS dire que la session est morte. Un
        // refresh_token est à usage unique : deux écrans qui le dépensent en
        // même temps (ou un rechargement au mauvais moment) suffisent à ce
        // qu'Apple… pardon, que GoTrue réponde « Refresh token is not valid »
        // alors que l'access_token en poche est encore parfaitement bon.
        // Déconnecter dans ce cas renvoie à la connexion quelqu'un qui vient
        // de se connecter — c'est la boucle constatée le 2026-08-04 (cinq
        // connexions réussies en treize minutes dans les journaux GoTrue).
        // On ne coupe donc que si le jeton courant est vraiment périmé.
        if (SESSION && !perime(SESSION)) return SESSION;
        // Refus explicite du serveur ET jeton périmé : la session est morte.
        // On renvoie vers la connexion plutôt que de retomber sur la clé anon
        // — sinon, une fois les RLS actives, l'utilisateur verrait des écrans
        // vides sans comprendre qu'il est déconnecté.
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
    var t = await r.text();
    // ⚠️ Un 401/403 de PostgREST veut dire DEUX choses très différentes, et
    // les confondre déconnecte des gens parfaitement connectés :
    //   • le jeton est en cause  → `PGRST301` / « JWT expired » : renouveler ;
    //   • la POLICY refuse       → `42501` : le jeton est bon, c'est l'écriture
    //     qui n'est pas permise. Renouveler n'y changera rien, et si le
    //     refresh_token a déjà été dépensé ailleurs, on repart en boucle vers
    //     login.html. Depuis l'activation des RLS, ce second cas est devenu
    //     le cas courant — d'où le tri explicite ci-dessous.
    if ((r.status === 401 || r.status === 403) && SESSION && !reessai
        && /PGRST301|PGRST303|JWT/i.test(t) && !/42501/.test(t)) {
      if (await rafraichirSession()) return appel(path, init, true);
    }
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

  /* ── Table nutritionnelle, pour 100 g ────────────────────────
     ⚠️ CE N'EST PLUS LA SOURCE PRINCIPALE, c'est le FILET. Les macros d'un
     repas sont désormais écrites par ingrédient dans `meal_ingredients`
     (`calories`, `proteins_g`, `carbs_g`, `fats_g`) au moment de
     l'enregistrement, à partir de ce que l'analyse a reconnu — voir
     `assets/ajout.js`. `calcMac()` les préfère toujours à cette table.

     Pourquoi le filet reste : les 227 lignes déjà en base n'ont pas ces
     valeurs, et une saisie à la main n'en a pas non plus.
     Pourquoi il a triplé : un aliment absent comptait pour **zéro**. Du
     saucisson valait 0 kcal et 0 g de protéines — donc un repas entier pouvait
     ne rien peser, et les anneaux mentaient sans le dire. */
  var NT = {
    // Viandes, volailles, charcuterie
    'poulet':{c:165,p:31,l:3.6,g:0},'dinde':{c:135,p:29,l:1,g:0},'boeuf':{c:250,p:26,l:15,g:0},
    'steak':{c:250,p:26,l:15,g:0},'veau':{c:172,p:31,l:4.6,g:0},'canard':{c:337,p:19,l:28,g:0},
    'agneau':{c:282,p:25,l:20,g:0},'porc':{c:242,p:27,l:14,g:0},'lardons':{c:337,p:18,l:29,g:0},
    'jambon':{c:145,p:21,l:6,g:1},'jambon cru':{c:241,p:27,l:15,g:0.5},
    'saucisson':{c:410,p:24,l:35,g:2},'chorizo':{c:455,p:24,l:38,g:2},
    'saucisse':{c:300,p:15,l:26,g:2},'merguez':{c:310,p:16,l:27,g:1},
    'bacon':{c:541,p:37,l:42,g:1.4},'rillettes':{c:400,p:16,l:37,g:0},
    'pate':{c:320,p:14,l:28,g:2},'boudin':{c:379,p:15,l:35,g:1},
    'viande hachee':{c:250,p:26,l:15,g:0},'escalope':{c:135,p:29,l:1,g:0},
    'nuggets':{c:296,p:15,l:19,g:16},'cordon bleu':{c:250,p:16,l:14,g:15},
    // Poissons et fruits de mer
    'saumon':{c:208,p:20,l:13,g:0},'thon':{c:132,p:28,l:1,g:0},'cabillaud':{c:82,p:18,l:0.7,g:0},
    'colin':{c:82,p:18,l:0.7,g:0},'lieu':{c:82,p:18,l:0.7,g:0},'merlu':{c:82,p:18,l:0.7,g:0},
    'truite':{c:148,p:21,l:7,g:0},'maquereau':{c:205,p:19,l:14,g:0},'sardines':{c:208,p:25,l:11,g:0},
    'anchois':{c:210,p:29,l:10,g:0},'hareng':{c:158,p:18,l:9,g:0},'dorade':{c:96,p:20,l:1.5,g:0},
    'crevettes':{c:99,p:21,l:1.1,g:0},'moules':{c:86,p:12,l:2.2,g:3.7},'calamar':{c:92,p:16,l:1.4,g:3},
    'surimi':{c:99,p:8,l:1,g:14},'saumon fume':{c:180,p:23,l:9,g:0},
    // Oeufs, tofu, legumineuses
    'oeuf':{c:155,p:13,l:11,g:1.1},'oeufs':{c:155,p:13,l:11,g:1.1},'omelette':{c:154,p:11,l:12,g:1},
    'tofu':{c:76,p:8,l:4.2,g:1.9},'tempeh':{c:195,p:19,l:11,g:9.4},'seitan':{c:141,p:25,l:2,g:4},
    'lentilles':{c:116,p:9,l:0.4,g:20},'pois chiches':{c:164,p:9,l:2.6,g:27},
    'haricots':{c:127,p:9,l:0.5,g:23},'haricots rouges':{c:127,p:9,l:0.5,g:23},
    'flageolets':{c:120,p:8,l:0.5,g:21},'edamame':{c:122,p:11,l:5.2,g:9.9},
    'houmous':{c:166,p:8,l:10,g:14},'falafel':{c:333,p:13,l:18,g:32},
    // Feculents, cereales, pains
    'riz':{c:130,p:2.7,l:0.3,g:28},'riz complet':{c:123,p:2.7,l:1,g:26},
    'pates':{c:131,p:5,l:1.1,g:25},'spaghetti':{c:131,p:5,l:1.1,g:25},'lasagne':{c:135,p:6,l:5,g:16},
    'quinoa':{c:120,p:4.4,l:1.9,g:22},'semoule':{c:112,p:4,l:0.2,g:23},'couscous':{c:112,p:4,l:0.2,g:23},
    'boulgour':{c:83,p:3,l:0.2,g:18},'sarrasin':{c:92,p:3.4,l:0.6,g:20},'polenta':{c:83,p:2,l:0.5,g:18},
    'pain':{c:265,p:9,l:3.2,g:49},'pain complet':{c:247,p:10,l:3.4,g:41},
    'pain de mie':{c:265,p:8,l:4,g:48},'baguette':{c:274,p:9,l:1.3,g:56},
    'biscotte':{c:390,p:12,l:5,g:73},'tortilla':{c:310,p:8,l:8,g:51},'wrap':{c:310,p:8,l:8,g:51},
    'pomme de terre':{c:77,p:2,l:0.1,g:17},'patate douce':{c:86,p:1.6,l:0.1,g:20},
    'frites':{c:312,p:3.4,l:15,g:41},'puree':{c:83,p:2,l:2.5,g:13},'gnocchi':{c:160,p:4,l:1,g:33},
    'avoine':{c:389,p:17,l:7,g:66},'flocons avoine':{c:389,p:17,l:7,g:66},
    'muesli':{c:375,p:10,l:9,g:62},'cereales':{c:380,p:8,l:4,g:78},
    'mais':{c:96,p:3.4,l:1.5,g:21},'petits pois':{c:81,p:5,l:0.4,g:14},
    // Plats et snacks courants
    'pizza':{c:266,p:11,l:10,g:33},'burger':{c:250,p:13,l:12,g:22},'kebab':{c:215,p:16,l:11,g:14},
    'quiche':{c:270,p:9,l:18,g:18},'sandwich':{c:230,p:10,l:9,g:27},'croque':{c:280,p:15,l:16,g:20},
    'sushi':{c:150,p:6,l:2,g:28},'soupe':{c:40,p:1.5,l:1.5,g:6},'ratatouille':{c:60,p:1.3,l:3.5,g:6},
    'chips':{c:536,p:6,l:34,g:53},'biscuit':{c:450,p:6,l:18,g:66},'chocolat':{c:546,p:5,l:31,g:61},
    'barre cereale':{c:400,p:7,l:13,g:64},'cookie':{c:470,p:5,l:22,g:63},
    // Legumes
    'brocoli':{c:34,p:2.8,l:0.4,g:7},'epinards':{c:23,p:2.9,l:0.4,g:3.6},'courgette':{c:17,p:1.2,l:0.3,g:3.1},
    'tomate':{c:18,p:0.9,l:0.2,g:3.9},'carotte':{c:41,p:0.9,l:0.2,g:10},'poivron':{c:31,p:1,l:0.3,g:6},
    'salade':{c:15,p:1.4,l:0.2,g:2.9},'laitue':{c:15,p:1.4,l:0.2,g:2.9},'roquette':{c:25,p:2.6,l:0.7,g:3.7},
    'concombre':{c:15,p:0.7,l:0.1,g:3.6},'haricots verts':{c:31,p:1.8,l:0.2,g:7},
    'chou':{c:25,p:1.3,l:0.1,g:6},'chou fleur':{c:25,p:1.9,l:0.3,g:5},'poireau':{c:61,p:1.5,l:0.3,g:14},
    'aubergine':{c:25,p:1,l:0.2,g:6},'champignons':{c:22,p:3.1,l:0.3,g:3.3},
    'oignon':{c:40,p:1.1,l:0.1,g:9},'ail':{c:149,p:6.4,l:0.5,g:33},'betterave':{c:43,p:1.6,l:0.2,g:10},
    'potiron':{c:26,p:1,l:0.1,g:7},'asperge':{c:20,p:2.2,l:0.1,g:3.9},'endive':{c:17,p:0.9,l:0.1,g:3.4},
    'avocat':{c:160,p:2,l:15,g:9},'olive':{c:145,p:1,l:15,g:4},
    // Fruits
    'pomme':{c:52,p:0.3,l:0.2,g:14},'banane':{c:89,p:1.1,l:0.3,g:23},'fraise':{c:32,p:0.7,l:0.3,g:7.7},
    'orange':{c:47,p:0.9,l:0.1,g:12},'mangue':{c:60,p:0.8,l:0.4,g:15},'kiwi':{c:61,p:1.1,l:0.5,g:15},
    'raisin':{c:69,p:0.7,l:0.2,g:18},'poire':{c:57,p:0.4,l:0.1,g:15},'peche':{c:39,p:0.9,l:0.3,g:10},
    'ananas':{c:50,p:0.5,l:0.1,g:13},'myrtille':{c:57,p:0.7,l:0.3,g:14},'framboise':{c:52,p:1.2,l:0.7,g:12},
    'citron':{c:29,p:1.1,l:0.3,g:9},'pasteque':{c:30,p:0.6,l:0.2,g:8},'melon':{c:34,p:0.8,l:0.2,g:8},
    'datte':{c:282,p:2.5,l:0.4,g:75},'abricot sec':{c:241,p:3.4,l:0.5,g:63},
    // Produits laitiers
    'yaourt':{c:59,p:3.5,l:3.3,g:4.7},'skyr':{c:63,p:11,l:0.2,g:4},'fromage blanc':{c:79,p:8,l:4,g:3.5},
    'petit suisse':{c:97,p:9,l:5,g:3},'cottage':{c:98,p:11,l:4.3,g:3.4},
    'feta':{c:264,p:14,l:21,g:4},'mozzarella':{c:280,p:18,l:22,g:2.2},'parmesan':{c:431,p:38,l:29,g:4},
    'comte':{c:417,p:27,l:34,g:1.5},'emmental':{c:380,p:28,l:29,g:1},'gruyere':{c:413,p:30,l:32,g:0.4},
    'chevre':{c:364,p:22,l:30,g:2.5},'camembert':{c:300,p:20,l:24,g:0.5},'roquefort':{c:369,p:22,l:31,g:2},
    'raclette':{c:357,p:23,l:29,g:1},'creme fraiche':{c:292,p:2.4,l:30,g:3},
    'lait':{c:61,p:3.2,l:3.3,g:4.8},'lait vegetal':{c:35,p:1,l:1.5,g:3.5},
    'beurre':{c:717,p:0.9,l:81,g:0.1},'mascarpone':{c:429,p:4.8,l:44,g:4},
    // Matieres grasses, oleagineux, condiments
    'huile olive':{c:884,p:0,l:100,g:0},'huile':{c:884,p:0,l:100,g:0},
    'noix':{c:654,p:15,l:65,g:14},'amandes':{c:579,p:21,l:50,g:22},'noisette':{c:628,p:15,l:61,g:17},
    'cajou':{c:553,p:18,l:44,g:30},'pistache':{c:560,p:20,l:45,g:28},'cacahuete':{c:567,p:26,l:49,g:16},
    'graines':{c:559,p:19,l:49,g:20},'graines courge':{c:559,p:30,l:49,g:11},'chia':{c:486,p:17,l:31,g:42},
    'tahini':{c:595,p:17,l:54,g:21},'beurre cacahuete':{c:588,p:25,l:50,g:20},
    'mayonnaise':{c:680,p:1,l:75,g:1.5},'ketchup':{c:112,p:1.2,l:0.1,g:26},'moutarde':{c:66,p:4,l:3.3,g:5},
    'vinaigrette':{c:450,p:0.5,l:48,g:3},'sauce tomate':{c:32,p:1.3,l:0.4,g:6},
    'miel':{c:304,p:0.3,l:0,g:82},'sucre':{c:400,p:0,l:0,g:100},'confiture':{c:278,p:0.4,l:0.1,g:69},
    // Boissons
    'jus orange':{c:45,p:0.7,l:0.2,g:10},'soda':{c:42,p:0,l:0,g:10.6},'biere':{c:43,p:0.5,l:0,g:3.6},
    'vin':{c:83,p:0.1,l:0,g:2.6},'cafe':{c:2,p:0.1,l:0,g:0},'the':{c:1,p:0,l:0,g:0},
    'jus':{c:45,p:0.5,l:0.1,g:11},'eau':{c:0,p:0,l:0,g:0},
    'ricore':{c:60,p:2.5,l:1.5,g:9},   // tel qu'on le boit, au lait demi-écrémé
    /* ── Ajouts du relevé du 2026-08-05 ─────────────────────────────
       Les 89 lignes que la table ne savait pas chiffrer, sur 256 réelles. Ce
       bloc et les deux passes de `getNutri` viennent de là — ce ne sont pas des
       aliments choisis au hasard, ce sont ceux réellement saisis. */
    // Herbes et aromates. Presque rien au gramme, mais ils sont TOUJOURS saisis
    // en petite quantité : les compter juste vaut mieux que de ne pas les
    // compter, et surtout mieux que de rendre tout le repas non chiffrable.
    'persil':{c:36,p:3,l:0.8,g:6},'basilic':{c:23,p:3.2,l:0.6,g:2.7},
    'coriandre':{c:23,p:2.1,l:0.5,g:3.7},'ciboulette':{c:30,p:3.3,l:0.7,g:4.4},
    'aneth':{c:43,p:3.5,l:1.1,g:7},'menthe':{c:44,p:3.8,l:0.7,g:8},
    'gingembre':{c:80,p:1.8,l:0.8,g:18},'curry':{c:325,p:14,l:14,g:58},
    'epices':{c:300,p:11,l:10,g:50},'poivre':{c:251,p:10,l:3.3,g:64},
    'sel':{c:0,p:0,l:0,g:0},'assaisonnement':{c:0,p:0,l:0,g:0},
    // Légumes qui manquaient
    'patate':{c:77,p:2,l:0.1,g:17},'mange tout':{c:42,p:2.8,l:0.2,g:7.5},
    'pois gourmands':{c:42,p:2.8,l:0.2,g:7.5},'daurade':{c:96,p:20,l:1.5,g:0},
    // Sauces, plats et desserts nommés sans plus de précision
    'sauce soja':{c:53,p:8,l:0.1,g:5},'teriyaki':{c:89,p:1.5,l:0,g:20},
    'bolognaise':{c:130,p:8,l:7,g:8},'bouillon':{c:8,p:1,l:0.3,g:0.5},
    'potage':{c:40,p:1.5,l:1.5,g:6},'nouilles':{c:138,p:4.5,l:0.7,g:25},
    'ramen':{c:138,p:4.5,l:0.7,g:25},'crepe':{c:190,p:6,l:8,g:23},
    'crumble':{c:350,p:4,l:16,g:48},'gateau':{c:380,p:5,l:18,g:50},
    'creme patissiere':{c:160,p:4,l:6,g:22},'glace':{c:207,p:3.5,l:11,g:24},
    'bifteck':{c:250,p:26,l:15,g:0},
    /* Libellés VOLONTAIREMENT génériques (« Fromage », « Légumes », « Viande »,
       « Sauce », « 1 fruit »). Ce sont des moyennes, et une moyenne est
       critiquable — mais l'alternative n'est pas « mieux », c'est **zéro**, ce
       qui est faux à coup sûr. Un libellé plus précis gagne toujours, la
       correspondance prenant le plus long : « fromage blanc » (2 mots) passe
       avant « fromage », « viande blanche » avant « viande ». */
    'fromage':{c:350,p:23,l:28,g:1.5},'legumes':{c:35,p:2,l:0.4,g:6},
    'viande':{c:230,p:25,l:14,g:0},'viande blanche':{c:135,p:29,l:1,g:0},
    'poisson':{c:120,p:22,l:3,g:0},'sauce':{c:90,p:1.5,l:6,g:6},
    'fruit':{c:60,p:0.8,l:0.3,g:14},
    /* Fautes de frappe relevées en base. Ce ne sont pas des devinettes : chacune
       est phonétiquement sans ambiguïté dans un contexte alimentaire. Les noms
       vraiment indéchiffrables (« Marcos en boîte », « a ») restent NON
       reconnus — mieux vaut un manque visible qu'un chiffre inventé. */
    'steack':{c:250,p:26,l:15,g:0},'amendes':{c:579,p:21,l:50,g:22},
    'basilique':{c:23,p:3.2,l:0.6,g:2.7},'pouivron':{c:31,p:1,l:0.3,g:6},
    'teriaki':{c:89,p:1.5,l:0,g:20},
    'petits poids':{c:81,p:5,l:0.4,g:14},'poids chiche':{c:164,p:9,l:2.6,g:27}
  };

  /* ⚠️ Le plus LONG libellé qui correspond gagne, et la correspondance se fait
     MOT À MOT. Avant, `Object.keys(NT).find(...)` prenait le premier venu dans
     l'ordre de déclaration : « pomme de terre » tombait sur « pomme » (52 kcal
     au lieu de 77 et zéro féculent), « huile olive » sur « huile », et « ail »
     se trouvait dans « volaille ». C'est le même piège que le rapprochement du
     garde-manger, résolu de la même façon. */
  /* \u26a0\ufe0f LES LIGATURES \u0153 ET \u00e6 NE SONT PAS DES ACCENTS. `normalize('NFD')` ne les
     d\u00e9compose pas \u2014 ce sont des lettres \u00e0 part enti\u00e8re en Unicode \u2014 donc
     `[^a-z0-9]` les rempla\u00e7ait par une espace : \u00ab b\u0153uf \u00bb devenait \u00ab b uf \u00bb et
     \u00ab \u0152ufs \u00bb devenait \u00ab ufs \u00bb. Autrement dit **aucun \u0153uf et aucun b\u0153uf n'a
     jamais \u00e9t\u00e9 reconnu**, et c'est mesur\u00e9 : sur les 256 lignes r\u00e9elles de la
     base, 7 \u00e9chouaient pour cette seule raison (\u00ab B\u0153uf brais\u00e9 \u00bb, \u00ab \u0152uf dur \u00bb,
     \u00ab \u0152uf poch\u00e9 \u00bb, \u00ab Sauce cr\u00e9meuse (\u0153ufs, cr\u00e8me) \u00bb\u2026). \u00c0 traduire avant de
     retirer la ponctuation. */
  function normNom(s) {
    return ' ' + String(s || '').toLowerCase()
      .replace(/\u0153/g, 'oe').replace(/\u00e6/g, 'ae')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // accents
      .replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  }

  /* Singulier approch\u00e9 : on retire un `s` ou un `x` final. Appliqu\u00e9 DES DEUX
     C\u00d4T\u00c9S, donc \u00ab ananas \u00bb \u2192 \u00ab anana \u00bb de part et d'autre : le mot compte moins
     que la sym\u00e9trie. Pas en dessous de 4 lettres, pour ne pas manger \u00ab riz \u00bb,
     \u00ab jus \u00bb ou \u00ab the \u00bb. */
  function sing(m) {
    return (m.length > 3 && (m.slice(-1) === 's' || m.slice(-1) === 'x')) ? m.slice(0, -1) : m;
  }

  var NT_CLES = Object.keys(NT)
    .map(function (k) {
      var mots = normNom(k).trim().split(' ');
      return { k: k, mots: mots, motsS: mots.map(sing) };
    })
    .sort(function (a, b) { return b.mots.length - a.mots.length || b.k.length - a.k.length; });

  function tousPresents(mots, n) {
    return mots.every(function (m) { return n.indexOf(' ' + m + ' ') > -1; });
  }

  /* \u26a0\ufe0f DEUX PASSES, ET L'ORDRE EST TOUT L'INT\u00c9R\u00caT. La premi\u00e8re est l'ancienne,
     mot \u00e0 mot exact : rien de ce qui correspondait avant ne peut donc changer de
     valeur. La seconde ne s'ex\u00e9cute que si la premi\u00e8re n'a rien trouv\u00e9, et
     rattrape les singuliers/pluriels \u2014 \u00ab Courgettes \u00bb, \u00ab carottes \u00bb,
     \u00ab Pommes de terre rissol\u00e9es \u00bb, \u00ab Epinard \u00bb (la table, elle, dit
     \u00ab epinards \u00bb).

     Faire la collapse en une seule passe aurait \u00e9t\u00e9 une r\u00e9gression : \u00ab pates \u00bb
     et \u00ab pate \u00bb (le p\u00e2t\u00e9, 320 kcal) se r\u00e9duisent au m\u00eame mot, et le plus long
     libell\u00e9 gagnant, un p\u00e2t\u00e9 de campagne aurait \u00e9t\u00e9 compt\u00e9 comme des p\u00e2tes \u00e0
     131 kcal. En deuxi\u00e8me passe seulement, \u00ab Pate de campagne \u00bb est d\u00e9j\u00e0
     r\u00e9solu par la passe exacte et n'y arrive jamais. */
  function getNutri(name, qty) {
    var n = normNom(name), i, t = null;
    for (i = 0; i < NT_CLES.length && !t; i++) {
      if (tousPresents(NT_CLES[i].mots, n)) t = NT[NT_CLES[i].k];
    }
    if (!t) {
      var nS = ' ' + n.trim().split(' ').map(sing).join(' ') + ' ';
      for (i = 0; i < NT_CLES.length && !t; i++) {
        if (tousPresents(NT_CLES[i].motsS, nS)) t = NT[NT_CLES[i].k];
      }
    }
    if (!t) return null;
    var f = (parseFloat(qty) || 0) / 100;
    return { c: Math.round(t.c * f), p: r1(t.p * f), l: r1(t.l * f), g: r1(t.g * f) };
  }

  function r1(v) { return Math.round(v * 10) / 10; }

  /**
   * Macros d'une liste d'ingrédients.
   *
   * ⚠️ ORDRE DE CONFIANCE, et c'est tout le sujet : on prend d'abord les macros
   * ÉCRITES sur la ligne (`calories`, `proteins_g`, `carbs_g`, `fats_g`), que
   * `assets/ajout.js` renseigne à l'enregistrement depuis ce que l'analyse a
   * reconnu. La table locale n'est utilisée que si la ligne n'a rien — vieilles
   * lignes, saisie manuelle, import.
   *
   * Un ingrédient inconnu des deux compte pour zéro, comme avant : mais il est
   * maintenant l'exception et non la règle, et `calcMac` le signale
   * (`.inconnus`) pour que les écrans puissent le dire au lieu d'afficher un
   * total faux sans prévenir.
   */
  function calcMac(ings) {
    var t = { c: 0, p: 0, l: 0, g: 0 }, inconnus = [];
    (ings || []).forEach(function (i) {
      if (!i) return;
      var cal = parseFloat(i.calories), pr = parseFloat(i.proteins_g),
          gl = parseFloat(i.carbs_g), li = parseFloat(i.fats_g);
      // « Écrit » = au moins une valeur non nulle. Quatre zéros, c'est le défaut
      // de la base, pas une mesure : on retombe alors sur la table.
      if ((cal || pr || gl || li)) {
        t.c += cal || 0; t.p += pr || 0; t.g += gl || 0; t.l += li || 0;
        return;
      }
      var r = getNutri(i.name || i.nom, i.quantity_g || i.quantite_g || 0);
      if (r) { t.c += r.c; t.p += r.p; t.l += r.l; t.g += r.g; }
      else if (i.name || i.nom) inconnus.push(i.name || i.nom);
    });
    var out = { c: Math.round(t.c), p: r1(t.p), l: r1(t.l), g: r1(t.g) };
    out.inconnus = inconnus;
    return out;
  }

  function goto(page) {
    var qs = window.location.search || '';
    window.location.href = page + qs;
  }

  /* ── Demander, et prévenir — sans dialogue natif ────────────
     `confirm()` et `alert()` fonctionnent dans une WebView, mais s'y affichent
     avec l'origine du bundle en titre — « capacitor://localhost », ou une page
     web quand l'app est servie autrement. Sur un écran d'app, ça ressemble à
     un avertissement de sécurité, pas à une question de l'application ; et
     c'est ce que verra le testeur d'Apple. `narration.html` les avait déjà
     proscrits pour cette raison, chacun avec sa propre feuille : celle-ci est
     la version partagée.

     Deux fonctions, une seule mise en scène :
       await Natty.confirmer('Supprimer ce repas ?')       → true / false
       await Natty.alerte('Enregistrement impossible.')    → une fois lu

     Tout est préfixé `nconf` et scellé sous `#nconf`, parce que ce module
     s'invite sur des écrans qui ont chacun leur style. */
  function feuille() {
    if (document.getElementById('nconf-css')) return;
    var s = document.createElement('style');
    s.id = 'nconf-css';
    s.textContent = [
      '#nconf{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;',
      'justify-content:center;padding:24px;background:rgba(20,20,30,.42);',
      '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;',
      'transition:opacity .2s ease;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif}',
      '#nconf.on{opacity:1}',
      '#nconf .box{width:100%;max-width:320px;background:#fff;border-radius:22px;',
      'padding:24px 22px 18px;text-align:center;transform:scale(.94);',
      'transition:transform .24s cubic-bezier(.22,1,.36,1);',
      'box-shadow:0 24px 60px rgba(0,0,0,.24)}',
      '#nconf.on .box{transform:scale(1)}',
      '#nconf .q{font-size:16px;font-weight:700;color:#1a1a2e;line-height:1.45}',
      '#nconf .d{font-size:13px;color:#9a9aaa;margin-top:8px;line-height:1.5}',
      '#nconf .btns{display:flex;flex-direction:column;gap:9px;margin-top:20px}',
      '#nconf button{padding:14px;border:none;border-radius:14px;font-family:inherit;',
      'font-size:14.5px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#nconf .oui{background:#1a1a2e;color:#fff}',
      '#nconf .oui.danger{background:#ff3b30}',
      '#nconf .non{background:#f0f0f3;color:#6a6a78}'
    ].join('');
    document.head.appendChild(s);
  }

  function demander(question, opts) {
    opts = opts || {};
    feuille();
    // Une feuille déjà ouverte : on ne l'empile pas, sinon deux taps rapides
    // laissent un fond assombri que plus rien ne retire.
    var vieux = document.getElementById('nconf');
    if (vieux && vieux.parentNode) vieux.parentNode.removeChild(vieux);

    return new Promise(function (repondre) {
      var d = document.createElement('div');
      d.id = 'nconf';
      var esc = function (t) {
        return String(t == null ? '' : t)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      };
      d.innerHTML = '<div class="box" role="dialog" aria-modal="true">'
        + '<div class="q">' + esc(question) + '</div>'
        + (opts.detail ? '<div class="d">' + esc(opts.detail) + '</div>' : '')
        + '<div class="btns">'
        +   '<button class="oui' + (opts.danger ? ' danger' : '') + '" id="nconfOui">'
        +     esc(opts.ok || 'Confirmer') + '</button>'
        +   (opts.seul ? '' : '<button class="non" id="nconfNon">'
        +     esc(opts.annuler || 'Annuler') + '</button>')
        + '</div></div>';
      document.body.appendChild(d);
      // rAF seule ne suffit pas : elle ne se déclenche pas si la page ne peint
      // pas. Sans le minuteur, la feuille resterait invisible ET bloquante.
      requestAnimationFrame(function () { d.classList.add('on'); });
      setTimeout(function () { d.classList.add('on'); }, 60);

      var fini = false;
      function fermer(reponse) {
        if (fini) return; fini = true;
        d.classList.remove('on');
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 220);
        repondre(reponse);
      }
      d.querySelector('#nconfOui').addEventListener('click', function () { fermer(true); });
      var non = d.querySelector('#nconfNon');
      if (non) non.addEventListener('click', function () { fermer(false); });
      // Taper le fond, c'est annuler — jamais confirmer : un geste imprécis ne
      // doit pas pouvoir supprimer un repas.
      d.addEventListener('click', function (e) { if (e.target === d) fermer(false); });
    });
  }

  function confirmer(question, opts) {
    opts = opts || {};
    if (opts.ok === undefined) opts.ok = 'Confirmer';
    return demander(question, opts);
  }

  function alerte(message, opts) {
    opts = opts || {};
    opts.seul = true;
    if (opts.ok === undefined) opts.ok = 'J’ai compris';
    return demander(message, opts);
  }

  function requireAuth() {
    if (SESSION_OBLIGATOIRE ? !!SESSION : !!USER_ID) return true;
    setTimeout(function () {
      if (SESSION_OBLIGATOIRE ? !!SESSION : !!USER_ID) return;
      // Quelqu'un qui avait une identité héritée (natty_token / ?token=) mais
      // pas de session n'est pas un visiteur anonyme : il se croyait connecté.
      // On le lui dit, au lieu de le déposer sans explication devant un
      // formulaire de connexion. Et on efface l'identité héritée, sinon la
      // page suivante rejouerait le même aller-retour.
      var herite = !!USER_ID;
      if (herite) {
        try {
          localStorage.removeItem('natty_token');
          localStorage.removeItem('natty_user_id');
        } catch (e) {}
      }
      window.location.href = 'login.html' + (herite ? '?reconnexion=1' : '');
    }, 1500);
    return false;
  }

  return {
    SB_URL: SB_URL, SB_KEY: SB_KEY, CLD_CLD: CLD_CLD, CLD_PRE: CLD_PRE, API: API,
    TOKEN: TOKEN, USER_ID: USER_ID,
    sbFetch: sbFetch, sbPost: sbPost, sbPatch: sbPatch,
    calcMac: calcMac, getNutri: getNutri, goto: goto, requireAuth: requireAuth,
    // Questions et avertissements, sans dialogue natif (voir plus haut).
    confirmer: confirmer, alerte: alerte,
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
