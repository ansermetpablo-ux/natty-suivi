/* ═══════════════════════════════════════════════════════════════
   Natty — <natty-site>, la page d'accueil complète pour Wix Studio

   ⚠️ CE FICHIER EST UN MODÈLE. Le fichier à publier est produit par
       node scripts/build-wix.mjs
   qui y injecte le catalogue depuis data/plats.json. Ne pas servir
   ce .src.js : il contient encore le marqueur de données.

   POURQUOI TOUTE LA PAGE DANS UN COMPOSANT. Les éléments natifs Wix ne
   savent ni ouvrir une fiche en tiroir, ni garder une sélection, ni
   refaire le contrôle des chiffres ; les applis Wix (commandes, menus)
   imposent leur gabarit. Le composant pose la page entière avec le
   parcours voulu : tout se passe sur place, on ne quitte le site que
   pour payer (offre.html, Stripe), l'App Store ou les CGV.

   RÉFÉRENCEMENT. Le contenu d'un Custom Element n'est pas lu par les
   moteurs. Le texte indexable est fourni à Wix par Velo, via
   `seoMarkup` (voir wix/velo-accueil.js) : promesse, carte, prix, FAQ.

   CE QUE WIX EXIGE : forfait Premium + domaine connecté, source HTTPS,
   nom de balise à tiret. Les trois sont remplis.

   ATTRIBUTS, réglables depuis l'éditeur Wix
     theme       "auto" (défaut) · "light" · "dark"
     img-base    racine des images, défaut https://natty-suivi.vercel.app/img/
     lien-offre  où mène « Commander », défaut le tunnel d'abonnement Stripe
     contact     adresse de contact, défaut contact@natty-nutrition.com
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CATALOGUE = /*__CATALOGUE__*/ null;
  if (!CATALOGUE || !CATALOGUE.plats) return;
  if (customElements.get('natty-site')) return;

  var DEFAUTS = {
    imgBase: 'https://natty-suivi.vercel.app/img/',
    offre: 'https://natty-suivi.vercel.app/offre.html',
    contact: 'contact@natty-nutrition.com',
    app: 'https://apps.apple.com/fr/app/natty-nutrition/id6805629752',
    instagram: 'https://www.instagram.com/natty__.fr/',
    linkedin: 'https://www.linkedin.com/company/natty-nutrition/',
    cgv: 'https://natty-suivi.vercel.app/cgv.html',
    cgu: 'https://natty-suivi.vercel.app/cgu.html',
    confidentialite: 'https://natty-suivi.vercel.app/confidentialite.html',
    oit: 'https://www.ilo.org/resource/news/poor-workplace-nutrition-hits-workers-health-and-productivity-says-new-ilo'
  };
  var MAX_PLATS = 10;
  var POLICES = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..700&family=Instrument+Sans:ital,wght@0,400..700&display=swap';

  /* Les polices se chargent dans le document hôte : une @import dans le
     Shadow DOM bloque le premier rendu. Pile de secours sinon. */
  function chargerPolices() {
    try {
      if (document.querySelector('link[data-natty-polices]')) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = POLICES; l.setAttribute('data-natty-polices', '');
      document.head.appendChild(l);
    } catch (e) {}
  }

  /* ── Outils ── */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nb(v) { return Number(v).toLocaleString('fr-FR'); }
  function eur(v) {
    var n = Number(v);
    return n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  }
  function memoire(k, v) {
    try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; }
  }

  /* ── Contrôle de cohérence d'un plat ───────────────────────────
     Mêmes règles que scripts/verifier-catalogue.mjs :
     - portion de référence = masse de la fiche / nombre de portions,
       arrondie à 5 g, à 1 g près ;
     - valeurs par portion = valeurs pour 100 g × portion / 100,
       à 1 unité près sur chaque macro.
     Un plat qui échoue garde sa place (photo, ingrédients) mais aucun
     chiffre n'est affiché : un chiffre faux sur une étiquette alimentaire
     coûte plus cher qu'une case vide. */
  function verifiePlat(d) {
    var f = d.fiche_technique || {}, p100 = d.pour_100g || {}, n = d.nutrition || {};
    var portion = Number(d.portion_reference_g);
    if (!(f.masse_fiche_g > 0 && f.portions_fiche > 0 && portion > 0)) return false;
    if (Math.abs(portion - Math.round(f.masse_fiche_g / f.portions_fiche / 5) * 5) > 1) return false;
    var cles = ['kcal', 'proteines', 'glucides', 'lipides'];
    for (var i = 0; i < cles.length; i++) {
      var k = cles[i];
      if (typeof p100[k] !== 'number' || typeof n[k] !== 'number') return false;
      if (Math.abs(p100[k] * portion / 100 - n[k]) > 1) return false;
    }
    return true;
  }

  // Un plat que le générateur a marqué incohérent ne sort pas du tout.
  var PUBLIES = CATALOGUE.plats.filter(function (d) { return d && d.coherent === true && d.id; });
  var PAR_ID = {};
  PUBLIES.forEach(function (d) { d._chiffresOk = verifiePlat(d); PAR_ID[d.id] = d; });
  var PRIX = CATALOGUE.prix || {};
  var LIB_ALLERG = CATALOGUE.libelles_allergenes || {};
  function prix(k) { return typeof PRIX[k] === 'number' ? PRIX[k] : null; }

  var CSS = `
:host{
  --bg:#FFFFFF; --surface:#F7F7F9; --surface-2:#ECECEF;
  --ink:#101014; --on-ink:#FFFFFF; --muted:#70707C; --line:#E8E8EE;
  --green:#2A9E4F; --amber:#B07400; --amber-bg:rgba(176,116,0,.10);
  --shadow:0 18px 44px rgba(16,16,20,.10); --logo-filter:none;
  --display:'Fraunces','Iowan Old Style',Georgia,serif;
  --text:'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  --r-xl:30px; --r-lg:24px; --r-md:18px; --r-full:999px;
  --gutter:clamp(16px,5vw,56px);
  display:block; background:var(--bg); color:var(--ink);
  font-family:var(--text); font-size:17px; line-height:1.55;
  -webkit-font-smoothing:antialiased; overflow-x:clip;
}
:host([data-theme="dark"]){
  --bg:#0E0E11; --surface:#17171B; --surface-2:#1F1F26;
  --ink:#F4F4F7; --on-ink:#0E0E11; --muted:#8E8E99; --line:#2A2A32;
  --green:#32D74B; --amber:#FFB340; --amber-bg:rgba(255,179,64,.14);
  --shadow:0 18px 44px rgba(0,0,0,.5); --logo-filter:invert(1);
}
@media (prefers-color-scheme: dark){
  :host(:not([data-theme="light"])){
    --bg:#0E0E11; --surface:#17171B; --surface-2:#1F1F26;
    --ink:#F4F4F7; --on-ink:#0E0E11; --muted:#8E8E99; --line:#2A2A32;
    --green:#32D74B; --amber:#FFB340; --amber-bg:rgba(255,179,64,.14);
    --shadow:0 18px 44px rgba(0,0,0,.5); --logo-filter:invert(1);
  }
}
*{box-sizing:border-box}
img{max-width:100%;display:block}
a{color:inherit}
button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px;border-radius:4px}
.num{font-variant-numeric:tabular-nums}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.logo-img{filter:var(--logo-filter)}
h1,h2,h3{font-family:var(--display);font-weight:600;letter-spacing:-.02em;line-height:1.06;text-wrap:balance;margin:0;font-variation-settings:'SOFT' 20,'WONK' 1}
h1{font-size:clamp(2.5rem,6.2vw,4.8rem);font-weight:500}
h2{font-size:clamp(1.9rem,4.2vw,3.1rem)}
h3{font-size:clamp(1.12rem,2vw,1.38rem);letter-spacing:-.015em}
p{margin:0}
.h-gap{margin-bottom:clamp(28px,4vw,46px)}
.wrap{width:100%;max-width:1180px;margin-inline:auto;padding-inline:var(--gutter)}
section{padding-block:clamp(60px,9vw,120px)}
.rule{border-top:1px solid var(--line)}
.surface{background:var(--surface)}
.eyebrow{font-size:.74rem;text-transform:uppercase;letter-spacing:.16em;font-weight:600;color:var(--muted);margin-bottom:20px}
.lede{font-size:clamp(1.05rem,1.5vw,1.2rem);color:var(--muted);max-width:62ch;margin-top:18px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:var(--r-full);padding:15px 28px;font-weight:600;font-size:.98rem;background:var(--surface-2);color:var(--ink);text-decoration:none;transition:transform .14s,filter .14s}
.btn:hover{transform:translateY(-1px);filter:brightness(1.08)}
.btn.primary{background:var(--ink);color:var(--on-ink)}
.btn.ghost{background:transparent;box-shadow:inset 0 0 0 1px var(--line)}
.btn.sm{padding:10px 18px;font-size:.88rem}

.nav{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
.nav-in{display:flex;align-items:center;gap:12px;min-height:68px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;margin-right:auto;background:none;border:0;padding:0}
.wordmark{font-family:var(--display);font-weight:500;font-size:1.35rem;letter-spacing:.22em}
.nav-links{display:flex;gap:2px}
.nav-links a{text-decoration:none;color:var(--muted);font-size:.9rem;font-weight:500;padding:9px 12px;border-radius:var(--r-full)}
.nav-links a:hover,.nav-links a[aria-current="true"]{color:var(--ink);background:var(--surface-2)}
.icon-btn{width:40px;height:40px;flex:none;border:0;border-radius:50%;background:var(--surface-2);display:grid;place-items:center}
.icon-btn svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.menu-btn{display:none}
.menu-mobile{display:flex;flex-direction:column;padding:6px var(--gutter) 16px;border-top:1px solid var(--line)}
.menu-mobile[hidden]{display:none}
.menu-mobile a{text-decoration:none;padding:13px 0;border-bottom:1px solid var(--line);font-weight:500}
@media (max-width:980px){.nav-links{display:none}.menu-btn{display:grid}}
@media (max-width:480px){.nav-cta{display:none}}

.hero{padding-block:clamp(40px,7vw,84px)}
.hero-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:clamp(28px,5vw,64px);align-items:center}
.hero h1 em{font-style:italic;font-weight:400;color:var(--muted)}
.hero-sub{margin-top:24px;font-size:clamp(1.05rem,1.5vw,1.2rem);color:var(--muted);max-width:48ch}
.hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px;align-items:center}
.price-inline{margin-top:22px;font-size:.92rem;color:var(--muted)}
.price-inline b{font-size:1.4rem;color:var(--ink);font-weight:700}
.hero-photo{position:relative;margin:0;border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shadow);aspect-ratio:1/1}
.hero-photo img{width:100%;height:100%;object-fit:cover}
.tag{position:absolute;left:16px;bottom:16px;background:rgba(11,10,9,.72);backdrop-filter:blur(10px);color:#F6F3ED;border-radius:var(--r-full);padding:9px 16px;font-size:.82rem;font-weight:600}
@media (max-width:880px){.hero-grid{grid-template-columns:1fr}.hero-photo{order:-1;aspect-ratio:4/3}}

.pillars{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.pillar{border:1px solid var(--line);border-radius:var(--r-xl);padding:clamp(22px,3vw,32px);background:var(--surface);display:flex;flex-direction:column;gap:12px;min-width:0}
.pillar-n{font-family:var(--display);font-size:2.2rem;font-weight:300;color:var(--muted);line-height:1}
.pillar p{color:var(--muted);font-size:.95rem}
@media (max-width:820px){.pillars{grid-template-columns:1fr}}
.compare{margin-top:28px;border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}
.compare-row{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(0,1fr));border-bottom:1px solid var(--line)}
.compare-row:last-child{border-bottom:0}
.compare-row>span{padding:13px 16px;font-size:.9rem;min-width:0}
.compare-head>span{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600;background:var(--surface)}
.compare .no{color:var(--muted)}
.compare .yes{font-weight:600}
.compare .us{background:color-mix(in srgb,var(--ink) 6%,transparent)}
.compare-head .us{color:var(--ink)}
@media (max-width:640px){
  .compare-row{grid-template-columns:repeat(3,minmax(0,1fr))}
  .compare-row>[role="rowheader"]{grid-column:1/-1;font-weight:600;padding-bottom:2px}
  .compare-head>span:first-child{display:none}
  .compare-row>span{padding:9px 12px;font-size:.84rem}
}

.menu-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:32px}
.filters{display:flex;flex-wrap:wrap;gap:7px}
.filters button{border:0;border-radius:var(--r-full);padding:10px 17px;font-size:.89rem;font-weight:600;background:var(--surface-2);color:var(--muted)}
.filters button:hover{color:var(--ink)}
.filters button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.dishes{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}
.dish{background:var(--surface);border-radius:var(--r-lg);overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--line);min-width:0}
.dish.picked{border-color:var(--green)}
.dish-photo{position:relative;aspect-ratio:1/1;background:var(--surface-2);border:0;padding:0;width:100%}
.dish-photo img{width:100%;height:100%;object-fit:cover}
.goal{position:absolute;top:11px;left:11px;background:rgba(11,10,9,.68);backdrop-filter:blur(8px);color:#F6F3ED;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:6px 11px;border-radius:var(--r-full)}
.dish-body{padding:17px 17px 15px;display:flex;flex-direction:column;gap:9px;flex:1}
.dish-open{background:none;border:0;padding:0;text-align:left}
.dish-open h3{font-size:1.12rem}
.dish-open:hover h3{text-decoration:underline;text-underline-offset:3px}
.dish-desc{font-size:.87rem;color:var(--muted);line-height:1.45;flex:1}
.macros{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;border-block:1px solid var(--line);padding-block:11px}
.macro{display:flex;flex-direction:column;min-width:0}
.macro .v{font-size:.98rem;font-weight:700}
.macro:not(.kcal) .v{color:var(--muted)}
.macro .k{font-size:.63rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600}
.macros-wait{border-block:1px solid var(--line);padding-block:11px;font-size:.8rem;color:var(--muted)}
.dish-foot{display:flex;align-items:center;gap:10px}
.dish-price{display:flex;flex-direction:column;margin-right:auto}
.dish-price b{font-size:1.12rem;font-weight:700}
.dish-price span{font-size:.74rem;color:var(--muted)}
.add{width:42px;height:42px;flex:none;border:0;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-size:1.25rem;line-height:1}
.dish.picked .add{background:var(--green);color:var(--on-ink)}
.menu-note{margin-top:24px;font-size:.84rem;color:var(--muted);max-width:80ch}
.badge{display:inline-block;font-size:.74rem;font-weight:600;color:var(--amber);background:var(--amber-bg);padding:2px 8px;border-radius:6px}
.empty{grid-column:1/-1;padding:40px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:var(--r-lg)}

.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.85fr);gap:clamp(30px,5vw,72px);align-items:center}
@media (max-width:880px){.two{grid-template-columns:1fr}}
.steps{list-style:none;margin:0;padding:0;counter-reset:s;display:flex;flex-direction:column;gap:22px}
.steps li{counter-increment:s;display:grid;grid-template-columns:44px 1fr;gap:4px 14px}
.steps li::before{content:counter(s);grid-row:span 2;font-family:var(--display);font-size:2.2rem;font-weight:300;color:var(--muted);line-height:1}
.steps p{color:var(--muted);font-size:.95rem}
.flow{display:flex;flex-direction:column;gap:12px}
.flow-card{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 18px;display:flex;align-items:center;gap:14px}
.thumb{width:52px;height:52px;flex:none;border-radius:34%;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover}
.flow-card b{display:block;font-size:.96rem}
.flow-card .t span{font-size:.81rem;color:var(--muted)}
.stamp{margin-left:auto;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;padding:6px 12px;border-radius:var(--r-full);background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)}
.flow-arrow{display:grid;place-items:center;color:var(--muted)}
.flow-arrow svg{width:20px;height:26px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round}
.rings{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px 18px}
.rings-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:16px}
.rings-head b{font-size:.95rem}
.rings-head span,.rings-note{font-size:.78rem;color:var(--muted)}
.rings-note{margin-top:12px;text-align:center}
.ring-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ring{display:flex;flex-direction:column;align-items:center;gap:7px}
.ring svg{width:100%;max-width:80px}
.r-bg{fill:none;stroke:var(--line);stroke-width:8}
.r-fg{fill:none;stroke:var(--ink);stroke-width:8;stroke-linecap:round}
.ring .lab{font-size:.75rem;color:var(--muted);font-weight:600}

.plans{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:38px}
.plan{border:1px solid var(--line);border-radius:var(--r-xl);padding:clamp(24px,3vw,36px);display:flex;flex-direction:column;gap:16px;background:var(--surface);position:relative;min-width:0}
.plan.feature{border-color:var(--ink)}
.flag{position:absolute;top:-12px;left:clamp(24px,3vw,36px);background:var(--ink);color:var(--on-ink);font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:5px 13px;border-radius:var(--r-full)}
.amount{display:flex;align-items:baseline;gap:8px}
.amount b{font-family:var(--display);font-size:3rem;font-weight:500;letter-spacing:-.03em;line-height:1}
.amount span{color:var(--muted)}
.plan ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.plan li{display:flex;gap:10px;font-size:.93rem;color:var(--muted)}
.plan li::before{content:"—";flex:none}
.plan .btn{margin-top:auto}
@media (max-width:760px){.plans{grid-template-columns:1fr}}
.simu{margin-top:24px;border:1px solid var(--line);border-radius:var(--r-lg);padding:20px 22px;display:flex;flex-direction:column;gap:12px}
.simu input{width:100%;accent-color:var(--ink)}
.simu-out{color:var(--muted)}
.simu-out b{color:var(--ink)}

.stat{margin:30px 0 0}
.stat .big{font-family:var(--display);font-size:clamp(3.6rem,10vw,6.5rem);font-weight:300;line-height:.9;letter-spacing:-.04em;display:block}
.stat figcaption{color:var(--muted);margin-top:12px;max-width:52ch;font-size:.95rem}
.stat cite{display:block;font-style:normal;font-size:.8rem;margin-top:8px}
.tabs{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-xl);padding:clamp(20px,3vw,30px)}
.tablist{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px}
.tablist button{border:0;border-radius:var(--r-full);padding:9px 16px;font-weight:600;font-size:.88rem;background:var(--surface-2);color:var(--muted)}
.tablist button[aria-selected="true"]{background:var(--ink);color:var(--bg)}
.tabpanel{display:flex;flex-direction:column;gap:10px;min-height:130px}
.tabpanel[hidden]{display:none}
.tabpanel p{color:var(--muted);font-size:.95rem}
.b2b{margin-top:18px;padding-top:18px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.b2b p{color:var(--muted);font-size:.9rem}
.mail-line{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-weight:600}

.faq{max-width:780px}
details{border-bottom:1px solid var(--line)}
summary{cursor:pointer;list-style:none;padding:20px 40px 20px 0;font-size:1.04rem;font-weight:600;position:relative}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:1.3rem;color:var(--muted);font-weight:400}
details[open] summary::after{content:"–"}
details p{padding-bottom:20px;color:var(--muted);font-size:.95rem;max-width:65ch}
.final{text-align:center}
.final .lede{margin-inline:auto}
.final .btn{margin-top:28px}

footer{border-top:1px solid var(--line);padding-block:50px 110px;font-size:.88rem}
.foot-grid{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,1fr));gap:32px}
.foot-grid h4{font-size:.7rem;text-transform:uppercase;letter-spacing:.13em;color:var(--muted);margin:0 0 14px;font-weight:600}
.foot-grid ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.foot-grid a{color:var(--muted);text-decoration:none}
.foot-grid a:hover{color:var(--ink);text-decoration:underline}
.foot-brand img{width:110px;height:auto;margin-bottom:12px}
.foot-brand p{color:var(--muted);max-width:34ch}
.foot-legal{margin-top:36px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:.8rem}
@media (max-width:860px){.foot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:480px){.foot-grid{grid-template-columns:1fr}}

.scrim{position:fixed;inset:0;z-index:2147483000;background:rgba(5,4,3,.55);opacity:0;pointer-events:none;transition:opacity .22s}
.scrim.on{opacity:1;pointer-events:auto}
.sheet{position:fixed;z-index:2147483001;top:0;right:0;height:100%;width:min(480px,100%);background:var(--bg);color:var(--ink);border-left:1px solid var(--line);transform:translateX(101%);transition:transform .28s cubic-bezier(.2,.8,.3,1);overflow-y:auto;overscroll-behavior:contain}
.sheet.on{transform:none}
.sheet[hidden]{display:none}
.sheet-photo{position:relative;aspect-ratio:4/3;background:var(--surface-2)}
.sheet-photo img{width:100%;height:100%;object-fit:cover}
.close{position:absolute;top:14px;right:14px;width:40px;height:40px;border:0;border-radius:50%;background:rgba(11,10,9,.66);color:#F6F3ED;font-size:1.4rem;line-height:1;display:grid;place-items:center}
.sheet-body{padding:22px var(--gutter) 0;display:flex;flex-direction:column;gap:18px}
.sheet-body h3{font-size:1.8rem}
.sheet-cat{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.sheet-desc,.ing-list{color:var(--muted);font-size:.94rem;line-height:1.6}
.ing-list b{color:var(--ink)}
.sheet-block h4{font-size:.7rem;text-transform:uppercase;letter-spacing:.13em;color:var(--muted);font-weight:600;margin:0 0 11px}
.sheet-macros{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.sheet-macros div{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-md);padding:12px 10px;display:flex;flex-direction:column;min-width:0}
.sheet-macros .v{font-size:1.12rem;font-weight:700}
.sheet-macros .k{font-size:.62rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:600}
.sheet-buy{position:sticky;bottom:0;margin-inline:calc(var(--gutter) * -1);padding:16px var(--gutter) calc(16px + env(safe-area-inset-bottom,0px));background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(12px);border-top:1px solid var(--line);display:flex;align-items:center;gap:14px}
.sheet-buy .p{display:flex;flex-direction:column;margin-right:auto}
.sheet-buy .p b{font-size:1.2rem}
.sheet-buy .p span{font-size:.76rem;color:var(--muted)}
@media (max-width:560px){
  .sheet{top:auto;bottom:0;left:0;width:100%;height:92%;border-left:0;border-top:1px solid var(--line);border-radius:var(--r-xl) var(--r-xl) 0 0;transform:translateY(101%)}
  .sheet-photo{border-radius:var(--r-xl) var(--r-xl) 0 0;overflow:hidden}
}
dialog.legal{width:min(720px,calc(100% - 24px));max-height:88vh;padding:0;border:1px solid var(--line);border-radius:var(--r-xl);background:var(--bg);color:var(--ink)}
dialog.legal::backdrop{background:rgba(5,4,3,.6)}
.legal-in{position:relative;padding:clamp(24px,4vw,40px)}
.legal .close{background:var(--surface-2);color:var(--ink)}
.legal h2{font-size:clamp(1.6rem,3vw,2.2rem);margin-bottom:10px}
.legal h3{font-size:1.1rem;margin-top:26px}
.legal p{color:var(--muted);margin-top:10px;font-size:.94rem}
.legal dl{display:grid;grid-template-columns:minmax(0,13rem) minmax(0,1fr);gap:8px 22px;margin:14px 0 0;font-size:.93rem}
.legal dt{color:var(--muted)}
.legal dd{margin:0;min-width:0;overflow-wrap:anywhere}
@media (max-width:560px){.legal dl{grid-template-columns:1fr;gap:2px 0}.legal dd{margin-bottom:10px}}
.basket{position:fixed;left:0;right:0;bottom:env(safe-area-inset-bottom,0px);z-index:2147482999;display:flex;justify-content:center;padding:0 12px 12px;pointer-events:none;transform:translateY(140%);transition:transform .26s cubic-bezier(.2,.8,.3,1)}
.basket.on{transform:none}
.basket-in{pointer-events:auto;width:100%;max-width:600px;background:var(--ink);color:var(--bg);border-radius:var(--r-full);padding:10px 10px 10px 22px;display:flex;align-items:center;gap:10px;box-shadow:0 14px 40px rgba(0,0,0,.42)}
.basket-txt{display:flex;flex-direction:column;line-height:1.25;min-width:0;margin-right:auto}
.basket-txt b{font-size:1rem}
.basket-txt span{font-size:.76rem;opacity:.7}
.basket .btn{background:var(--bg);color:var(--ink)}
.basket .ghost-inv{background:transparent;color:var(--bg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--bg) 35%,transparent)}
@media (max-width:420px){.basket .ghost-inv{display:none}}
@media (prefers-reduced-motion: reduce){*{transition:none !important;animation:none !important}}
`;

  /* Liens externes : nouvel onglet, sans transmettre l'origine. */
  function ext(href, texte, cls) {
    return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + texte + '<span class="sr"> (nouvel onglet)</span></a>';
  }

  function gabarit(o) {
    var I = o.imgBase;
    var navLiens = '<a href="#valeur">Pourquoi Natty</a><a href="#carte">La carte</a><a href="#marche">Comment ça marche</a>'
      + '<a href="#tarifs">Tarifs</a><a href="#entreprises">Entreprises</a><a href="#questions">Questions</a>';
    return ''
    + '<header class="nav" id="haut"><div class="wrap nav-in">'
    +   '<a class="brand" href="#haut" aria-label="Natty, retour en haut"><img class="logo-img" src="' + esc(I) + 'embleme-natty.png" alt="" width="34" height="34"><span class="wordmark">NATTY</span></a>'
    +   '<nav class="nav-links" aria-label="Sections">' + navLiens + '</nav>'
    +   '<button class="icon-btn" data-act="theme" type="button" aria-label="Changer de thème"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg></button>'
    +   '<a class="btn primary sm nav-cta" href="#carte">Choisir mes plats</a>'
    +   '<button class="icon-btn menu-btn" data-act="menu" type="button" aria-label="Ouvrir le menu" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>'
    + '</div><nav class="menu-mobile" aria-label="Sections" hidden>' + navLiens + '</nav></header>'

    + '<section class="hero"><div class="wrap hero-grid"><div>'
    +   '<p class="eyebrow">Paris · La Défense · livré au bureau</p>'
    +   '<h1>Le déjeuner de chef <em>qui se compte tout seul.</em></h1>'
    +   '<p class="hero-sub">Des plats écrits au gramme par un chef, livrés au bureau, et enregistrés automatiquement dans votre suivi nutritionnel. Vous mangez, Natty compte.</p>'
    +   '<div class="hero-cta"><a class="btn primary" href="#carte">Voir la carte</a><a class="btn ghost" href="#marche">Comment ça marche</a></div>'
    +   (prix('abonnement') != null ? '<p class="price-inline"><b class="num">' + eur(prix('abonnement')) + '</b> le plat en abonnement' + (prix('unite') != null ? ' · ' + eur(prix('unite')) + ' à l\'unité' : '') + '</p>' : '')
    + '</div><figure class="hero-photo"><img src="' + esc(I) + 'hero.webp" alt="Bol de poisson laqué, quinoa, avocat et herbes fraîches" width="1400" height="1367"><figcaption class="tag">Recettes signées par notre chef</figcaption></figure></div></section>'

    + '<section id="valeur" class="rule"><div class="wrap">'
    +   '<p class="eyebrow">Pourquoi Natty</p><h2 class="h-gap">Trois choses que vous n\'avez jamais eues ensemble.</h2>'
    +   '<div class="pillars">'
    +     '<article class="pillar"><span class="pillar-n num">01</span><h3>Un chef, pas une usine</h3><p>Chaque plat part d\'une fiche technique écrite ingrédient par ingrédient par Francis D\'Almeida, passé par le Cheval Blanc. C\'est elle qui nous donne la composition exacte de votre assiette.</p></article>'
    +     '<article class="pillar"><span class="pillar-n num">02</span><h3>Un suivi qui se remplit seul</h3><p>Le jour de la livraison, le plat entre dans votre journée avec ses calories et ses macros. Rien à peser, rien à photographier, rien à chercher dans une base.</p></article>'
    +     '<article class="pillar"><span class="pillar-n num">03</span><h3>Une portion à votre mesure</h3><p>Votre barquette est calibrée sur vos besoins, et un nutritionniste ajuste vos objectifs au fil des semaines à partir de ce que vous mangez vraiment.</p></article>'
    +   '</div>'
    +   '<div class="compare" role="table" aria-label="Comparaison">'
    +     '<div class="compare-row compare-head" role="row"><span role="columnheader"></span><span role="columnheader">Appli de suivi seule</span><span role="columnheader">Livraison de repas</span><span role="columnheader" class="us">Natty</span></div>'
    +     '<div class="compare-row" role="row"><span role="rowheader">Le repas est préparé pour vous</span><span role="cell" class="no">Non</span><span role="cell" class="yes">Oui</span><span role="cell" class="yes us">Oui</span></div>'
    +     '<div class="compare-row" role="row"><span role="rowheader">Les macros sont connues au gramme</span><span role="cell" class="no">Estimées</span><span role="cell" class="no">Rarement</span><span role="cell" class="yes us">Oui, depuis la recette</span></div>'
    +     '<div class="compare-row" role="row"><span role="rowheader">Le suivi se remplit sans saisie</span><span role="cell" class="no">Non</span><span role="cell" class="no">Non</span><span role="cell" class="yes us">Oui</span></div>'
    +   '</div></div></section>'

    + '<section id="carte" class="rule"><div class="wrap">'
    +   '<div class="menu-head"><div><p class="eyebrow">La carte</p><h2>Choisissez vos plats.</h2></div>'
    +   '<div class="filters" role="group" aria-label="Filtrer par objectif">'
    +     '<button type="button" data-f="tous" aria-pressed="true">Tous</button><button type="button" data-f="masse" aria-pressed="false">Prise de masse</button>'
    +     '<button type="button" data-f="perte" aria-pressed="false">Perte de poids</button><button type="button" data-f="bien" aria-pressed="false">Bien-être</button>'
    +   '</div></div><div class="dishes" aria-live="polite"></div><p class="menu-note"></p></div></section>'

    + '<section id="marche" class="rule surface"><div class="wrap two"><div>'
    +   '<p class="eyebrow">Comment ça marche</p><h2 class="h-gap">De la carte à votre suivi, sans rien saisir.</h2>'
    +   '<ol class="steps"><li><h3>Vous composez votre semaine</h3><p>De un à dix plats. Vous changez la sélection chaque semaine, vous mettez en pause quand vous partez.</p></li>'
    +   '<li><h3>On cuisine et on livre au bureau</h3><p>Deux minutes au micro-ondes et c\'est prêt.</p></li>'
    +   '<li><h3>Le suivi se remplit seul</h3><p>Le plat entre dans votre journée avec ses calories et ses macros. Votre nutritionniste voit la même chose que vous.</p></li></ol>'
    +   '<div class="hero-cta">' + ext(o.app, 'Application iPhone', 'btn ghost') + '</div>'
    + '</div><div class="flow" aria-label="Illustration du suivi automatique">'
    +   '<div class="flow-card"><div class="thumb"><img src="' + esc(I) + 'plats/poulet-moutarde.webp" alt="" width="52" height="52"></div><div class="t"><b>Votre plat du jour</b><span>Livré au bureau</span></div><span class="stamp">Livré</span></div>'
    +   '<div class="flow-arrow" aria-hidden="true"><svg viewBox="0 0 24 30"><path d="M12 2v24M5 19l7 7 7-7"/></svg></div>'
    +   '<div class="rings"><div class="rings-head"><b>Votre journée</b><span>mise à jour toute seule</span></div><div class="ring-row">'
    +     anneau('Protéines', 72) + anneau('Glucides', 120) + anneau('Lipides', 110)
    +   '</div><p class="rings-note">Illustration de l\'écran de suivi.</p></div>'
    + '</div></div></section>'

    + '<section id="tarifs" class="rule"><div class="wrap">'
    +   '<p class="eyebrow">Tarifs</p><h2>Un prix au plat. Rien d\'autre.</h2>'
    +   '<p class="lede">Livraison incluse. Sans engagement : pause et arrêt depuis votre compte.</p>'
    +   '<div class="plans">'
    +     '<div class="plan"><h3>À l\'unité</h3><div class="amount"><b class="num">' + (prix('unite') != null ? eur(prix('unite')) : '—') + '</b><span>le plat</span></div><ul><li>Vous commandez quand vous voulez</li><li>Aucun engagement</li><li>Livraison incluse</li></ul><a class="btn ghost" href="#carte">Choisir mes plats</a></div>'
    +     '<div class="plan feature"><span class="flag">Abonnement</span><h3>À la semaine</h3><div class="amount"><b class="num">' + (prix('abonnement') != null ? eur(prix('abonnement')) : '—') + '</b><span>le plat</span></div><ul><li>De 1 à 10 plats par semaine</li><li>Suivi nutritionniste inclus</li><li>Vos plats enregistrés dans l\'application</li><li>Pause et arrêt quand vous voulez</li></ul><a class="btn primary" href="#carte">Composer ma semaine</a></div>'
    +   '</div>'
    +   '<div class="simu"><label for="simuN">Plats par semaine : <b class="num" data-simu-val>5</b></label><input type="range" id="simuN" min="1" max="10" value="5"><p class="simu-out" aria-live="polite"></p></div>'
    + '</div></section>'

    + '<section id="entreprises" class="rule surface"><div class="wrap"><p class="eyebrow">Pour les entreprises</p><div class="two"><div>'
    +   '<h2>Le seul créneau que personne ne protège.</h2>'
    +   '<p class="lede">On bloque les salles de réunion et les points hebdomadaires. Jamais le déjeuner — et c\'est pourtant lui qui décide de l\'après-midi de vos équipes.</p>'
    +   '<figure class="stat"><span class="big num">20 %</span><figcaption>de productivité en moins possible avec une alimentation inadaptée au travail, selon l\'Organisation internationale du travail.'
    +   '<cite>C. Wanjek, <i>Food at Work</i>, OIT, 2005 — ' + ext(o.oit, 'source') + '</cite></figcaption></figure>'
    + '</div><div class="tabs"><div class="tablist" role="tablist" aria-label="Ce que ça change">'
    +   '<button role="tab" id="t-rh" aria-controls="p-rh" aria-selected="true" type="button">RH</button>'
    +   '<button role="tab" id="t-eq" aria-controls="p-eq" aria-selected="false" tabindex="-1" type="button">Équipes</button>'
    +   '<button role="tab" id="t-co" aria-controls="p-co" aria-selected="false" tabindex="-1" type="button">Comptabilité</button></div>'
    +   '<div class="tabpanel" role="tabpanel" id="p-rh" aria-labelledby="t-rh"><h3>Un avantage qu\'on voit tous les jours</h3><p>Le déjeuner revient cinq fois par semaine et tout le monde en parle. Prise en charge employeur partielle ou totale, au choix.</p></div>'
    +   '<div class="tabpanel" role="tabpanel" id="p-eq" aria-labelledby="t-eq" hidden><h3>Zéro organisation</h3><p>Les plats arrivent au bureau, un seul point de dépose. Chacun choisit dans l\'application et suit ses apports s\'il le souhaite — sans que personne d\'autre y ait accès.</p></div>'
    +   '<div class="tabpanel" role="tabpanel" id="p-co" aria-labelledby="t-co" hidden><h3>Une facture, une ligne</h3><p>Une seule facture mensuelle pour l\'ensemble du bureau.</p></div>'
    +   '<div class="b2b"><p>Dites-nous votre effectif, l\'adresse du bureau et le nombre de déjeuners par semaine : on revient vers vous avec une proposition chiffrée.</p>'
    +   '<div class="mail-line"><a class="btn primary sm" href="mailto:' + esc(o.contact) + '?subject=' + encodeURIComponent('Natty pour notre entreprise') + '">Demander une proposition</a><span>' + esc(o.contact) + '</span><button class="btn ghost sm" type="button" data-act="copier">Copier</button></div></div>'
    + '</div></div></div></section>'

    + '<section id="questions" class="rule"><div class="wrap"><p class="eyebrow">Questions</p><h2 class="h-gap">Ce qu\'on nous demande le plus.</h2><div class="faq">'
    +   FAQ.map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('')
    + '</div></div></section>'

    + '<section class="final rule surface"><div class="wrap"><h2>Commencez par trois plats.</h2>'
    +   '<p class="lede">' + (prix('abonnement') != null ? eur(3 * prix('abonnement')) + ' la semaine en abonnement. ' : '') + 'Sans engagement, arrêt quand vous voulez.</p>'
    +   '<a class="btn primary" href="#carte">Choisir mes plats</a></div></section>'

    + '<footer><div class="wrap"><div class="foot-grid">'
    +   '<div class="foot-brand"><img class="logo-img" src="' + esc(I) + 'logo-natty.png" alt="Natty" width="120" height="91"><p>Des déjeuners conçus avec un chef, livrés à Paris, et comptés pour vous.</p></div>'
    +   '<div><h4>Natty</h4><ul><li><a href="#carte">La carte</a></li><li><a href="#tarifs">Tarifs</a></li><li><a href="#entreprises">Entreprises</a></li><li>' + ext(o.app, 'Application iPhone') + '</li></ul></div>'
    +   '<div><h4>Nous suivre</h4><ul><li>' + ext(o.instagram, 'Instagram') + '</li><li>' + ext(o.linkedin, 'LinkedIn') + '</li><li><a href="mailto:' + esc(o.contact) + '">' + esc(o.contact) + '</a></li></ul></div>'
    +   '<div><h4>Légal</h4><ul><li><a href="#mentions-legales" data-act="mentions">Mentions légales</a></li><li>' + ext(o.cgv, 'Conditions de vente') + '</li><li>' + ext(o.cgu, 'Conditions d\'utilisation') + '</li><li>' + ext(o.confidentialite, 'Confidentialité') + '</li></ul></div>'
    + '</div><div class="foot-legal">© ' + new Date().getFullYear() + ' NATTY SAS · SIREN 106 073 711 · 110 rue de Belleville, 75020 Paris</div></div></footer>'

    + '<div class="scrim"></div><aside class="sheet" role="dialog" aria-modal="true" aria-label="Fiche du plat" hidden></aside>'

    /* Sources : annuaire-entreprises.data.gouv.fr (SIREN 106 073 711), vérifié
       le 11/10/2026 pour la dénomination, la forme, le SIREN et le siège. */
    + '<dialog class="legal" aria-labelledby="mentionsTitre"><div class="legal-in">'
    +   '<button class="close" type="button" data-act="fermer-mentions" aria-label="Fermer">×</button>'
    +   '<p class="eyebrow">Informations légales</p><h2 id="mentionsTitre">Mentions légales</h2>'
    +   '<h3>L\'éditeur du site</h3><dl>'
    +     '<dt>Dénomination</dt><dd>NATTY</dd><dt>Forme juridique</dt><dd>Société par actions simplifiée (SAS)</dd>'
    +     '<dt>Capital social</dt><dd>4,00 €</dd><dt>Siège social</dt><dd>110 rue de Belleville, 75020 Paris, France</dd>'
    +     '<dt>SIREN</dt><dd>106 073 711 — RCS Paris</dd><dt>Directeur de la publication</dt><dd>Pablo Ansermet, président</dd>'
    +     '<dt>Contact</dt><dd>' + esc(o.contact) + '</dd></dl>'
    // Adresse de Wix : wix.com/about/privacy, consultée le 11/10/2026.
    +   '<h3>Hébergement</h3><p>Le site est hébergé par Wix.com Ltd., 5 Yunitsman St., Tel Aviv, Israël. Les composants de la carte et l\'application sont hébergés par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Les données des comptes clients sont hébergées par Supabase.</p>'
    +   '<h3>Propriété intellectuelle</h3><p>Les textes, photographies, recettes et éléments de ce site sont la propriété de NATTY, sauf mention contraire. Toute reproduction sans autorisation écrite est interdite.</p>'
    +   '<h3>Données personnelles</h3><p>La carte ne dépose aucun cookie et ne contient aucun formulaire. Seules votre préférence de thème et votre sélection de plats en cours sont gardées dans votre navigateur. Le traitement des données de l\'application est décrit dans la politique de confidentialité.</p>'
    + '</div></dialog>'

    + '<div class="basket" aria-live="polite"><div class="basket-in"><div class="basket-txt"><b data-basket-count>0 plat</b><span data-basket-detail></span></div>'
    +   '<button class="btn sm ghost-inv" type="button" data-act="vider">Vider</button><a class="btn sm" href="' + esc(o.offre) + '">Commander</a></div></div>';
  }

  function anneau(lab, offset) {
    return '<div class="ring"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="30" class="r-bg"/><circle cx="36" cy="36" r="30" class="r-fg" stroke-dasharray="188.5" stroke-dashoffset="' + offset + '" transform="rotate(-90 36 36)"/></svg><span class="lab">' + lab + '</span></div>';
  }

  // Seulement les questions dont la réponse est confirmée.
  var FAQ = [
    ['Où livrez-vous ?', 'À Paris et à La Défense, directement au bureau.'],
    ['Puis-je changer mes plats chaque semaine ?', 'Oui, la sélection se modifie dans l\'application chaque semaine.'],
    ['Comment arrêter l\'abonnement ?', 'Depuis votre compte, sans appel ni courrier.'],
    ['En quoi consiste le suivi nutritionniste ?', 'Un nutritionniste ajuste vos objectifs caloriques et vos macros au fil des semaines, à partir de ce que vous mangez réellement. Vous échangez avec lui par messagerie dans l\'application.'],
    ['D\'où viennent les valeurs nutritionnelles ?', 'Elles sont calculées depuis la fiche technique du chef, ingrédient par ingrédient, avec la table Ciqual de l\'ANSES. Elles sont affichées pour 100 g et pour une portion de référence ; votre barquette étant calibrée sur vos besoins, vos valeurs réelles montent ou descendent d\'autant. Tant que le chef ne les a pas signées, elles portent la mention « en cours de validation ».'],
    ['Et les allergènes ?', 'La liste par plat est en cours de validation par le chef et sera publiée sur chaque fiche. D\'ici là, en cas d\'allergie, contactez-nous avant de commander.']
  ];

  class NattySite extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      chargerPolices();
      var base = this.getAttribute('img-base') || DEFAUTS.imgBase;
      if (!/^https:\/\//.test(base)) base = DEFAUTS.imgBase;
      if (base.slice(-1) !== '/') base += '/';
      var mail = this.getAttribute('contact') || DEFAUTS.contact;
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(mail)) mail = DEFAUTS.contact;
      var offre = this.getAttribute('lien-offre') || DEFAUTS.offre;
      if (!/^https:\/\//.test(offre)) offre = DEFAUTS.offre;
      this.o = Object.assign({}, DEFAUTS, { imgBase: base, contact: mail, offre: offre });

      var t = this.getAttribute('theme');
      try { var s = localStorage.getItem('natty-theme'); if (s === 'light' || s === 'dark') t = s; } catch (e) {}
      if (t === 'light' || t === 'dark') this.setAttribute('data-theme', t);

      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>' + CSS + '</style>' + gabarit(this.o);
      this.root = root;
      this.choisis = new Set((memoire('natty-selection') || '').split(',').filter(function (id) { return PAR_ID[id]; }));
      this.filtre = 'tous';
      this.lier();
      this.dessine(); this.note(); this.panier(); this.simulation();
      if (location.hash === '#mentions-legales') this.ouvreMentions();
    }

    $(s) { return this.root.querySelector(s); }

    lier() {
      var self = this, r = this.root;
      // Les ancres vivent dans le Shadow DOM : le navigateur ne les trouve
      // pas tout seul, on défile nous-mêmes, sans changer de page.
      r.addEventListener('click', function (e) {
        var a = e.target.closest('a[href^="#"]');
        if (a && !a.hasAttribute('data-act')) {
          var cible = r.getElementById(a.getAttribute('href').slice(1));
          if (cible) { e.preventDefault(); self.menu(false); self.defile(cible); }
          return;
        }
        var act = e.target.closest('[data-act]');
        if (act) { e.preventDefault(); self.action(act.getAttribute('data-act'), act); return; }
        var o = e.target.closest('[data-open]');
        if (o) { self.ouvreFiche(o.getAttribute('data-open')); return; }
        var b = e.target.closest('[data-toggle]');
        if (b) { self.bascule(b.getAttribute('data-toggle'), b.closest('.sheet') ? 'fiche' : 'carte'); return; }
        var f = e.target.closest('button[data-f]');
        if (f) {
          self.filtre = f.getAttribute('data-f');
          [].forEach.call(r.querySelectorAll('button[data-f]'), function (x) { x.setAttribute('aria-pressed', String(x === f)); });
          self.dessine();
        }
      });
      this.$('.scrim').addEventListener('click', function () { self.fermeFiche(); });
      this.$('#simuN').addEventListener('input', function () { self.simulation(); });
      var dlg = this.$('dialog.legal');
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      document.addEventListener('keydown', function (e) { self.clavier(e); });

      var tabs = [].slice.call(r.querySelectorAll('[role="tab"]'));
      function active(tab) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
          r.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { active(t); });
        t.addEventListener('keydown', function (e) {
          var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
          if (j == null) return;
          var c = tabs[(j + tabs.length) % tabs.length]; active(c); c.focus();
        });
      });

      if ('IntersectionObserver' in window) {
        var liens = r.querySelectorAll('.nav-links a');
        var io = new IntersectionObserver(function (en) {
          en.forEach(function (x) {
            if (!x.isIntersecting) return;
            liens.forEach(function (a) { a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + x.target.id)); });
          });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ['valeur', 'carte', 'marche', 'tarifs', 'entreprises', 'questions'].forEach(function (id) { io.observe(r.getElementById(id)); });
      }
    }

    defile(el) {
      var reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
      var y = el.getBoundingClientRect().top + window.pageYOffset - 76;
      window.scrollTo({ top: y, behavior: reduit ? 'auto' : 'smooth' });
    }

    action(a, el) {
      var self = this;
      if (a === 'theme') {
        var sombre = this.getAttribute('data-theme') === 'dark' ||
          (!this.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
        var next = sombre ? 'light' : 'dark';
        this.setAttribute('data-theme', next);
        try { localStorage.setItem('natty-theme', next); } catch (e) {}
      } else if (a === 'menu') {
        this.menu(this.$('.menu-mobile').hidden);
      } else if (a === 'mentions') {
        this.ouvreMentions();
      } else if (a === 'fermer-mentions') {
        this.$('dialog.legal').close();
      } else if (a === 'vider') {
        this.choisis.clear(); this.dessine(); this.panier();
      } else if (a === 'copier') {
        try {
          navigator.clipboard.writeText(this.o.contact).then(function () {
            el.textContent = 'Copié'; setTimeout(function () { el.textContent = 'Copier'; }, 1800);
          });
        } catch (e) {}
      } else if (a === 'fermer') {
        this.fermeFiche();
      }
    }

    menu(ouvert) {
      var m = this.$('.menu-mobile'), b = this.$('.menu-btn');
      m.hidden = !ouvert;
      b.setAttribute('aria-expanded', String(ouvert));
      b.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
    }

    ouvreMentions() {
      var d = this.$('dialog.legal');
      if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
    }

    /* ── Carte ── */
    macros(d) {
      if (!d._chiffresOk) return '<p class="macros-wait">Valeurs nutritionnelles en cours de recalcul.</p>';
      var n = d.nutrition;
      return '<div class="macros" aria-label="Pour une portion de référence de ' + esc(d.portion_reference_g) + ' g">'
        + '<div class="macro kcal"><span class="v num">' + nb(n.kcal) + '</span><span class="k">kcal</span></div>'
        + '<div class="macro"><span class="v num">' + nb(n.proteines) + '</span><span class="k">prot.</span></div>'
        + '<div class="macro"><span class="v num">' + nb(n.glucides) + '</span><span class="k">gluc.</span></div>'
        + '<div class="macro"><span class="v num">' + nb(n.lipides) + '</span><span class="k">lip.</span></div></div>';
    }

    photo(d) {
      var p = typeof d.photo === 'string' && /^img\/(plats\/[a-z0-9-]+\.webp)$/.exec(d.photo);
      return p ? this.o.imgBase + p[1] : '';
    }

    carte(d) {
      var pris = this.choisis.has(d.id), ph = this.photo(d);
      return '<article class="dish' + (pris ? ' picked' : '') + '">'
        + '<button class="dish-photo" type="button" data-open="' + esc(d.id) + '" aria-label="Voir la fiche : ' + esc(d.nom) + '">'
        + (ph ? '<img src="' + esc(ph) + '" alt="" width="720" height="720" loading="lazy">' : '')
        + '<span class="goal">' + esc(d.categorie_label) + '</span></button>'
        + '<div class="dish-body"><button class="dish-open" type="button" data-open="' + esc(d.id) + '"><h3>' + esc(d.nom) + '</h3></button>'
        + '<p class="dish-desc">' + esc(d.description) + '</p>' + this.macros(d)
        + '<div class="dish-foot"><span class="dish-price">' + (prix('abonnement') != null ? '<b class="num">' + eur(prix('abonnement')) + '</b><span>abonné · ' + eur(prix('unite')) + ' à l\'unité</span>' : '') + '</span>'
        + '<button class="add" type="button" data-toggle="' + esc(d.id) + '" aria-pressed="' + pris + '" aria-label="' + (pris ? 'Retirer ' : 'Ajouter ') + esc(d.nom) + '">' + (pris ? '✓' : '+') + '</button>'
        + '</div></div></article>';
    }

    dessine() {
      var self = this;
      var liste = PUBLIES.filter(function (d) { return self.filtre === 'tous' || d.categorie === self.filtre; });
      this.$('.dishes').innerHTML = liste.length ? liste.map(function (d) { return self.carte(d); }).join('')
        : '<p class="empty">' + (PUBLIES.length ? 'Aucun plat dans cette catégorie cette semaine.' : 'La carte de la semaine arrive très bientôt.') + '</p>';
    }

    note() {
      var valides = PUBLIES.length && PUBLIES.every(function (d) { return d.nutrition_validee === true; });
      this.$('.menu-note').innerHTML = 'Valeurs pour une portion de référence, calculées depuis les fiches techniques du chef (table Ciqual de l\'ANSES). '
        + 'Votre barquette est calibrée sur vos besoins : ouvrez une fiche pour le détail pour 100 g. '
        + (valides ? '' : '<span class="badge">en cours de validation</span>');
    }

    panier() {
      memoire('natty-selection', Array.from(this.choisis).join(','));
      var n = this.choisis.size;
      this.$('.basket').classList.toggle('on', n > 0);
      if (!n) return;
      var a = prix('abonnement');
      this.$('[data-basket-count]').textContent = n + (n > 1 ? ' plats' : ' plat') + (a != null ? ' · ' + eur(n * a) + ' la semaine' : '');
      this.$('[data-basket-detail]').textContent = n >= MAX_PLATS ? 'Maximum atteint : 10 plats par semaine' : 'Paiement sécurisé sur votre espace Natty';
    }

    bascule(id, ou) {
      if (!PAR_ID[id]) return;
      if (this.choisis.has(id)) this.choisis.delete(id);
      else if (this.choisis.size < MAX_PLATS) this.choisis.add(id);
      this.dessine(); this.panier();
      if (ou === 'fiche') {
        this.$('.sheet').innerHTML = this.fiche(PAR_ID[id]);
        var t = this.$('.sheet [data-toggle]'); if (t) t.focus();
      } else {
        var b = this.root.querySelector('.dishes [data-toggle="' + CSS_escape(id) + '"]'); if (b) b.focus();
      }
    }

    simulation() {
      var n = Number(this.$('#simuN').value), a = prix('abonnement'), u = prix('unite');
      this.$('[data-simu-val]').textContent = n;
      var out = this.$('.simu-out');
      if (a == null) { out.textContent = ''; return; }
      out.innerHTML = '<b class="num">' + eur(n * a) + '</b> la semaine en abonnement'
        + (u != null && u > a ? ', soit ' + eur(n * (u - a)) + ' de moins qu\'à l\'unité.' : '.');
    }

    /* ── Fiche plat (tiroir) ── */
    fiche(d) {
      var pris = this.choisis.has(d.id), ph = this.photo(d);
      var ings = (d.ingredients || []).map(function (i, k) { return k === 0 ? '<b>' + esc(i.nom) + '</b>' : esc(i.nom); }).join(', ');
      var allerg = d.allergenes_valides === true
        ? ((d.allergenes || []).length
            ? '<p class="ing-list">' + d.allergenes.map(function (a) { return esc(LIB_ALLERG[a] || a); }).join(', ') + '</p>'
            : '<p class="ing-list">Aucun des 14 allergènes à déclaration obligatoire.</p>')
        : '<p class="ing-list"><span class="badge">en cours de validation par le chef</span><br>En cas d\'allergie, écrivez-nous à ' + esc(this.o.contact) + ' avant de commander.</p>';
      var nutri;
      if (d._chiffresOk) {
        var p = d.pour_100g, n = d.nutrition;
        nutri = '<div class="sheet-macros">'
          + '<div><span class="v num">' + nb(p.kcal) + '</span><span class="k">kcal</span></div>'
          + '<div><span class="v num">' + nb(p.proteines) + ' g</span><span class="k">protéines</span></div>'
          + '<div><span class="v num">' + nb(p.glucides) + ' g</span><span class="k">glucides</span></div>'
          + '<div><span class="v num">' + nb(p.lipides) + ' g</span><span class="k">lipides</span></div></div>'
          + '<p class="ing-list">Sur une portion de référence de ' + esc(d.portion_reference_g) + ' g : ' + nb(n.kcal) + ' kcal, '
          + nb(n.proteines) + ' g de protéines, ' + nb(n.glucides) + ' g de glucides, ' + nb(n.lipides) + ' g de lipides. '
          + 'Votre barquette est calibrée sur vos besoins : vos valeurs montent ou descendent d\'autant.'
          + (d.nutrition_validee === true ? '' : ' <span class="badge">en cours de validation</span>') + '</p>';
      } else {
        nutri = '<p class="ing-list">Valeurs nutritionnelles en cours de recalcul.</p>';
      }
      return '<div class="sheet-photo">' + (ph ? '<img src="' + esc(ph) + '" alt="' + esc(d.nom) + '" width="720" height="540">' : '')
        + '<button class="close" type="button" data-act="fermer" aria-label="Fermer">×</button></div>'
        + '<div class="sheet-body"><div><p class="sheet-cat">' + esc(d.categorie_label) + '</p><h3>' + esc(d.nom) + '</h3></div>'
        + '<p class="sheet-desc">' + esc(d.description) + '</p>'
        + '<div class="sheet-block"><h4>Pour 100 g</h4>' + nutri + '</div>'
        + '<div class="sheet-block"><h4>Ingrédients</h4><p class="ing-list">' + ings + '.</p></div>'
        + '<div class="sheet-block"><h4>Allergènes</h4>' + allerg + '</div>'
        + '<div class="sheet-buy"><span class="p">' + (prix('abonnement') != null ? '<b class="num">' + eur(prix('abonnement')) + '</b><span>abonné · ' + eur(prix('unite')) + ' à l\'unité</span>' : '') + '</span>'
        + '<button class="btn ' + (pris ? '' : 'primary ') + 'sm" type="button" data-toggle="' + esc(d.id) + '">' + (pris ? 'Retirer de ma semaine' : 'Ajouter à ma semaine') + '</button></div></div>';
    }

    ouvreFiche(id) {
      var d = PAR_ID[id]; if (!d) return;
      var sheet = this.$('.sheet'), scrim = this.$('.scrim');
      this.dernierFocus = this.root.activeElement;
      sheet.innerHTML = this.fiche(d);
      sheet.setAttribute('aria-label', 'Fiche du plat : ' + d.nom);
      sheet.hidden = false;
      requestAnimationFrame(function () { sheet.classList.add('on'); scrim.classList.add('on'); });
      document.documentElement.style.overflow = 'hidden';
      var c = sheet.querySelector('.close'); if (c) c.focus();
    }

    fermeFiche() {
      var sheet = this.$('.sheet');
      sheet.classList.remove('on'); this.$('.scrim').classList.remove('on');
      document.documentElement.style.overflow = '';
      setTimeout(function () { if (!sheet.classList.contains('on')) sheet.hidden = true; }, 300);
      if (this.dernierFocus && this.dernierFocus.focus) this.dernierFocus.focus();
    }

    clavier(e) {
      var sheet = this.$('.sheet');
      if (!sheet.classList.contains('on')) return;
      if (e.key === 'Escape') { this.fermeFiche(); return; }
      if (e.key === 'Tab') {
        var f = sheet.querySelectorAll('button, a[href]');
        if (!f.length) return;
        var premier = f[0], dernier = f[f.length - 1], actif = this.root.activeElement;
        if (e.shiftKey && actif === premier) { e.preventDefault(); dernier.focus(); }
        else if (!e.shiftKey && actif === dernier) { e.preventDefault(); premier.focus(); }
      }
    }
  }

  // `CSS` désigne ici la feuille de style du composant, d'où window.CSS.
  function CSS_escape(s) { return (window.CSS && window.CSS.escape) ? window.CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }

  customElements.define('natty-site', NattySite);
})();
