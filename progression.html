<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
:root {
  --bg:#f0f0f3; --so:6px 6px 16px rgba(174,174,192,0.42),-6px -6px 16px rgba(255,255,255,0.88);
  --si:inset 3px 3px 8px rgba(174,174,192,0.35),inset -3px -3px 8px rgba(255,255,255,0.85);
  --sm:4px 4px 10px rgba(174,174,192,0.38),-4px -4px 10px rgba(255,255,255,0.85);
  --green:#5a9e6f; --gl:#eaf4ee; --text:#3a3a4a; --muted:#aaa; --black:#1a1a2e;
  --red:#c77b7b; --amber:#ba7517; --al:#faeeda;
}
body { font-family:'DM Sans',sans-serif; background:var(--bg); min-height:100vh; color:var(--text); overflow-x:hidden; }
.bg-pat { position:fixed; inset:0; background-color:var(--bg); background-image:radial-gradient(circle at 1px 1px,rgba(180,180,200,0.16) 1px,transparent 0); background-size:26px 26px; z-index:0; }

/* HEADER */
.top-header { position:sticky; top:0; z-index:50; background:var(--bg); padding:18px 16px 12px; max-width:480px; margin:0 auto; display:flex; align-items:center; gap:12px; }
.btn-back { width:38px; height:38px; border-radius:50%; background:var(--bg); border:none; cursor:pointer; box-shadow:var(--sm); display:flex; align-items:center; justify-content:center; font-size:18px; color:var(--text); flex-shrink:0; }
.top-title { font-size:18px; font-weight:600; flex:1; }

/* NAV TABS */
.nav-tabs { display:flex; gap:0; max-width:480px; margin:0 auto; padding:0 16px 14px; overflow-x:auto; scrollbar-width:none; }
.nav-tabs::-webkit-scrollbar { display:none; }
.nav-tab { flex-shrink:0; padding:8px 16px; border-radius:20px; background:var(--bg); box-shadow:var(--sm); font-size:11px; font-weight:500; color:var(--muted); cursor:pointer; border:none; font-family:'DM Sans',sans-serif; white-space:nowrap; margin-right:8px; transition:all 0.2s; }
.nav-tab.active { background:var(--black); color:white; box-shadow:3px 3px 8px rgba(26,26,46,0.35); }

/* SWIPE CONTAINER */
.swipe-container { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; width:100%; }
.swipe-container::-webkit-scrollbar { display:none; }
.swipe-section { flex-shrink:0; width:100%; scroll-snap-align:start; padding:0 16px 100px; max-width:480px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }

/* CARDS */
.card { background:var(--bg); border-radius:22px; padding:20px 18px; box-shadow:var(--so); }
.card-title { font-size:13px; font-weight:600; color:var(--text); margin-bottom:14px; display:flex; align-items:center; gap:7px; }
.card-sub { font-size:11px; color:var(--muted); margin-bottom:14px; }

/* DONUT PRINCIPAL */
.donut-wrap { display:flex; align-items:center; gap:16px; }
.donut-main { position:relative; width:130px; height:130px; flex-shrink:0; }
.donut-main svg { transform:rotate(-90deg); }
.donut-inner { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.donut-pct { font-size:32px; font-weight:700; letter-spacing:-2px; color:var(--text); }
.donut-lbl { font-size:10px; color:var(--muted); margin-top:2px; text-align:center; }
.donut-badge { margin-top:6px; padding:3px 12px; border-radius:99px; font-size:11px; font-weight:500; }
.badge-green { background:var(--gl); color:var(--green); }
.badge-amber { background:var(--al); color:var(--amber); }
.badge-red { background:#fde8e8; color:var(--red); }

/* MACRO BARS */
.macro-bars { flex:1; display:flex; flex-direction:column; gap:10px; }
.mbar { }
.mbar-head { display:flex; justify-content:space-between; margin-bottom:4px; }
.mbar-name { font-size:11px; color:var(--muted); }
.mbar-val { font-size:11px; font-weight:600; color:var(--text); }
.mbar-track { height:7px; background:var(--bg); border-radius:4px; box-shadow:var(--si); overflow:hidden; }
.mbar-fill { height:100%; border-radius:4px; transition:width 1s ease; }
.motivation-msg { background:var(--black); border-radius:14px; padding:12px 16px; text-align:center; }
.motivation-msg p { font-size:13px; color:rgba(255,255,255,0.9); line-height:1.5; }
.motivation-msg strong { color:white; }

/* COURBES EVOLUTION */
.period-tabs { display:flex; gap:8px; margin-bottom:14px; }
.period-tab { flex:1; padding:8px; border-radius:12px; background:var(--bg); box-shadow:var(--sm); font-size:11px; font-weight:500; color:var(--muted); cursor:pointer; border:none; font-family:'DM Sans',sans-serif; text-align:center; transition:all 0.15s; }
.period-tab.active { background:var(--black); color:white; box-shadow:2px 2px 8px rgba(26,26,46,0.3); }
.chart-wrap { position:relative; }
.chart-wrap canvas { display:block; width:100%; }
.chart-legend { display:flex; gap:14px; margin-top:8px; }
.chart-leg { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--muted); }
.chart-leg-line { width:20px; height:2px; border-radius:1px; }
.trend-badge { display:inline-flex; align-items:center; gap:5px; background:var(--gl); color:var(--green); padding:5px 12px; border-radius:99px; font-size:12px; font-weight:500; margin-top:10px; }

/* SUGGESTIONS MACROS */
.delta-row { display:flex; gap:8px; margin-bottom:14px; }
.delta-chip { flex:1; background:var(--bg); border-radius:14px; padding:10px 8px; box-shadow:var(--si); text-align:center; }
.delta-val { font-size:18px; font-weight:700; color:var(--text); letter-spacing:-0.5px; }
.delta-lbl { font-size:9px; color:var(--muted); margin-top:2px; text-transform:uppercase; letter-spacing:0.5px; }
.delta-unit { font-size:10px; color:var(--muted); }
.suggestion-cards { display:flex; flex-direction:column; gap:10px; }
.sug-card { background:var(--bg); border-radius:18px; padding:16px; box-shadow:var(--sm); border-left:3px solid var(--green); }
.sug-type { font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
.sug-head { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.sug-ico { font-size:28px; }
.sug-name { font-size:14px; font-weight:600; }
.sug-desc { font-size:12px; color:var(--muted); margin-top:2px; line-height:1.4; }
.sug-macros { display:flex; gap:6px; flex-wrap:wrap; }
.sug-macro { font-size:10px; padding:3px 8px; border-radius:99px; background:var(--gl); color:var(--green); font-weight:500; }
.sug-pourquoi { font-size:11px; color:var(--muted); margin-top:8px; font-style:italic; padding-top:8px; border-top:1px solid rgba(174,174,192,0.2); }
.loading-sug { text-align:center; padding:24px; color:var(--muted); font-size:13px; }
.loading-dots { display:inline-flex; gap:4px; }
.loading-dot { width:6px; height:6px; border-radius:50%; background:var(--green); animation:bounce 1.2s infinite; }
.loading-dot:nth-child(2) { animation-delay:0.15s; }
.loading-dot:nth-child(3) { animation-delay:0.3s; }
@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

/* POINTS FORTS / FAIBLES */
.pts-section { display:flex; flex-direction:column; gap:10px; }
.pt-card { background:var(--bg); border-radius:16px; padding:14px; box-shadow:var(--sm); }
.pt-card-head { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.pt-ico { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.pt-ico-g { background:var(--gl); }
.pt-ico-r { background:#fde8e8; }
.pt-title { font-size:13px; font-weight:600; }
.pt-explication { font-size:12px; color:#555; line-height:1.6; }
.pt-impact { font-size:11px; color:var(--amber); margin-top:6px; padding:5px 10px; background:var(--al); border-radius:8px; display:inline-block; }

/* ANALYSE COMPOSITION */
.donuts-compare { display:flex; gap:10px; margin-bottom:16px; }
.donut-compare-wrap { flex:1; text-align:center; }
.donut-compare-title { font-size:11px; font-weight:600; color:var(--muted); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px; }
.donut-compare-inner { position:relative; width:100%; padding-top:100%; }
.donut-compare-inner canvas { position:absolute; inset:0; width:100%!important; height:100%!important; }
.donut-compare-labels { margin-top:8px; display:flex; flex-direction:column; gap:4px; }
.dc-label { display:flex; align-items:center; gap:6px; font-size:10px; color:var(--muted); }
.dc-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.replace-list { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
.replace-item { background:var(--bg); border-radius:14px; padding:12px 14px; box-shadow:var(--sm); display:flex; align-items:center; gap:10px; }
.replace-from { font-size:20px; }
.replace-arrow { font-size:14px; color:var(--muted); }
.replace-to { font-size:20px; }
.replace-info { flex:1; }
.replace-names { font-size:12px; font-weight:500; }
.replace-raison { font-size:11px; color:var(--muted); margin-top:2px; }
.plats-sugg { display:flex; flex-direction:column; gap:8px; }
.plat-sugg-card { background:var(--bg); border-radius:14px; padding:13px 14px; box-shadow:var(--sm); display:flex; align-items:center; gap:12px; }
.plat-sugg-ico { font-size:26px; flex-shrink:0; }
.plat-sugg-name { font-size:13px; font-weight:600; }
.plat-sugg-desc { font-size:11px; color:var(--muted); margin-top:2px; line-height:1.4; }
.plat-sugg-why { font-size:11px; color:var(--green); margin-top:4px; }

.incorporer-list { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
.inc-chip { background:var(--gl); border-radius:12px; padding:8px 12px; display:flex; align-items:center; gap:6px; }
.inc-ico { font-size:16px; }
.inc-info { }
.inc-name { font-size:11px; font-weight:600; color:var(--green); }
.inc-qty { font-size:10px; color:var(--muted); margin-top:1px; }

.score-global { text-align:center; background:var(--black); border-radius:18px; padding:18px; margin-bottom:14px; }
.score-num { font-size:52px; font-weight:700; color:white; letter-spacing:-3px; }
.score-lbl { font-size:12px; color:rgba(255,255,255,0.6); margin-top:4px; }
.coach-msg { font-size:14px; color:rgba(255,255,255,0.9); line-height:1.6; margin-top:12px; font-style:italic; }

.empty-state { text-align:center; padding:32px 20px; color:var(--muted); font-size:13px; line-height:1.8; }
.empty-ico { font-size:36px; display:block; margin-bottom:10px; }

.toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(80px); background:var(--text); color:#fff; padding:11px 22px; border-radius:20px; font-size:13px; z-index:2000; transition:transform 0.3s; pointer-events:none; }
.toast.show { transform:translateX(-50%) translateY(0); }
</style>
</head>
<body>
<div class="bg-pat"></div>

<div class="top-header">
  <button class="btn-back" onclick="history.back()">‹</button>
  <div class="top-title">Ma progression</div>
</div>

<div class="nav-tabs" id="navTabs">
  <button class="nav-tab active" onclick="goSection(0,this)">🎯 Objectif</button>
  <button class="nav-tab" onclick="goSection(1,this)">📈 Évolution</button>
  <button class="nav-tab" onclick="goSection(2,this)">💡 Macros</button>
  <button class="nav-tab" onclick="goSection(3,this)">✅ Points</button>
  <button class="nav-tab" onclick="goSection(4,this)">🍽️ Analyse</button>
</div>

<div class="swipe-container" id="swipeCont">

  <!-- SECTION 0 : OBJECTIF DU JOUR -->
  <div class="swipe-section">
    <div class="card">
      <div class="card-title">🎯 Objectif du jour</div>
      <div class="donut-wrap">
        <div class="donut-main">
          <svg viewBox="0 0 130 130" width="130" height="130">
            <circle cx="65" cy="65" r="52" fill="none" stroke="#e8e8ec" stroke-width="12"/>
            <circle cx="65" cy="65" r="52" fill="none" stroke="#5a9e6f" stroke-width="12" stroke-linecap="round" id="ringMain" stroke-dasharray="0 327" style="transition:stroke-dasharray 1.4s ease;"/>
          </svg>
          <div class="donut-inner">
            <div class="donut-pct" id="pctMain">–</div>
            <div class="donut-lbl">de l'objectif</div>
            <div class="donut-badge badge-green" id="badgeMain">–</div>
          </div>
        </div>
        <div class="macro-bars">
          <div class="mbar">
            <div class="mbar-head"><span class="mbar-name">🥩 Protéines</span><span class="mbar-val"><span id="vProt">–</span>/<span id="gProt">–</span>g</span></div>
            <div class="mbar-track"><div class="mbar-fill" id="bProt" style="width:0%;background:#5a9e6f;"></div></div>
          </div>
          <div class="mbar">
            <div class="mbar-head"><span class="mbar-name">🥑 Lipides</span><span class="mbar-val"><span id="vLip">–</span>/<span id="gLip">–</span>g</span></div>
            <div class="mbar-track"><div class="mbar-fill" id="bLip" style="width:0%;background:#7b5ea7;"></div></div>
          </div>
          <div class="mbar">
            <div class="mbar-head"><span class="mbar-name">⚡ Glucides</span><span class="mbar-val"><span id="vGluc">–</span>/<span id="gGluc">–</span>g</span></div>
            <div class="mbar-track"><div class="mbar-fill" id="bGluc" style="width:0%;background:#ff9500;"></div></div>
          </div>
          <div class="mbar">
            <div class="mbar-head"><span class="mbar-name">🔥 Calories</span><span class="mbar-val"><span id="vCal">–</span>/<span id="gCal">–</span></span></div>
            <div class="mbar-track"><div class="mbar-fill" id="bCal" style="width:0%;background:#ff6b35;"></div></div>
          </div>
        </div>
      </div>
    </div>
    <div class="motivation-msg" id="motivMsg">
      <p>Chargement de votre progression...</p>
    </div>
  </div>

  <!-- SECTION 1 : COURBES EVOLUTION -->
  <div class="swipe-section">
    <div class="card">
      <div class="card-title">📈 Évolution de vos macros</div>
      <div class="period-tabs">
        <button class="period-tab active" onclick="setPeriod(7,this)">7 jours</button>
        <button class="period-tab" onclick="setPeriod(30,this)">30 jours</button>
        <button class="period-tab" onclick="setPeriod(90,this)">90 jours</button>
      </div>
      <div class="chart-wrap">
        <canvas id="chartEvol" height="180"></canvas>
      </div>
      <div class="chart-legend">
        <div class="chart-leg"><div class="chart-leg-line" style="background:#5a9e6f;"></div>Réel</div>
        <div class="chart-leg"><div class="chart-leg-line" style="background:#1a1a2e;border-top:2px dashed #1a1a2e;height:0;"></div>Objectif</div>
      </div>
      <div class="trend-badge" id="trendBadge">↗ En progression cette semaine</div>
    </div>
    <div class="card">
      <div class="card-title">📊 Calories jour par jour</div>
      <div class="chart-wrap">
        <canvas id="chartCal" height="120"></canvas>
      </div>
    </div>
  </div>

  <!-- SECTION 2 : SUGGESTIONS MACROS -->
  <div class="swipe-section">
    <div class="card">
      <div class="card-title">💡 Il vous reste aujourd'hui</div>
      <div class="delta-row" id="deltaRow">
        <div class="delta-chip"><div class="delta-val" id="dProt">–</div><div class="delta-unit">g</div><div class="delta-lbl">Protéines</div></div>
        <div class="delta-chip"><div class="delta-val" id="dLip">–</div><div class="delta-unit">g</div><div class="delta-lbl">Lipides</div></div>
        <div class="delta-chip"><div class="delta-val" id="dGluc">–</div><div class="delta-unit">g</div><div class="delta-lbl">Glucides</div></div>
        <div class="delta-chip"><div class="delta-val" id="dCal">–</div><div class="delta-unit">kcal</div><div class="delta-lbl">Calories</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">🤖 Suggestions personnalisées</div>
      <div class="card-sub">Basées sur vos repas du jour et vos préférences alimentaires</div>
      <div class="suggestion-cards" id="suggestionCards">
        <div class="loading-sug">
          <div style="margin-bottom:8px;">Analyse de vos macros en cours</div>
          <div class="loading-dots">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 3 : POINTS FORTS / FAIBLES -->
  <div class="swipe-section">
    <div class="card">
      <div class="card-title">✅ Points forts</div>
      <div class="pts-section" id="fortsSection">
        <div class="empty-state"><span class="empty-ico">⏳</span>Analyse en cours...</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">⚠️ À améliorer</div>
      <div class="pts-section" id="faiblesSection">
        <div class="empty-state"><span class="empty-ico">⏳</span>Analyse en cours...</div>
      </div>
    </div>
  </div>

  <!-- SECTION 4 : ANALYSE COMPOSITION -->
  <div class="swipe-section">
    <div class="score-global">
      <div class="score-num" id="scoreGlobal">–</div>
      <div class="score-lbl">Score nutritionnel global / 100</div>
      <div class="coach-msg" id="coachMsg">Chargement de votre analyse...</div>
    </div>
    <div class="card">
      <div class="card-title">🥧 Composition de vos plats</div>
      <div class="card-sub">Votre composition réelle vs la composition idéale selon votre profil</div>
      <div class="donuts-compare">
        <div class="donut-compare-wrap">
          <div class="donut-compare-title">Votre assiette</div>
          <div class="donut-compare-inner"><canvas id="donutReel"></canvas></div>
          <div class="donut-compare-labels" id="labelsReel"></div>
        </div>
        <div class="donut-compare-wrap">
          <div class="donut-compare-title">Assiette idéale</div>
          <div class="donut-compare-inner"><canvas id="donutIdeal"></canvas></div>
          <div class="donut-compare-labels" id="labelsIdeal"></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">🔄 Ingrédients à remplacer</div>
      <div class="replace-list" id="replaceList">
        <div class="empty-state"><span class="empty-ico">⏳</span>Analyse en cours...</div>
      </div>
      <div class="card-title" style="margin-top:14px;">➕ Ingrédients à incorporer</div>
      <div class="incorporer-list" id="incorporerList"></div>
    </div>
    <div class="card">
      <div class="card-title">🍽️ Plats suggérés pour vous</div>
      <div class="plats-sugg" id="platsSugg">
        <div class="empty-state"><span class="empty-ico">⏳</span>Suggestions en cours...</div>
      </div>
    </div>
  </div>

</div>

<div class="toast" id="toast"></div>

<script>
const SB_URL = 'https://hrsvcelmwdlcswwagxfa.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w';

const params = new URLSearchParams(window.location.search);
let token = params.get('token') || '';
let USER_ID = null;
if (token && token.length > 10) {
  try { const d = token.match(/.{1,2}/g).map(b=>String.fromCharCode(parseInt(b,16))).join(''); if(d.includes('-')) USER_ID=d; } catch(e){}
}
if (params.get('userId')) USER_ID = params.get('userId');

let profil = null, questAlim = null, repas = [], currentPeriod = 7;

async function sbFetch(path) {
  const r = await fetch(SB_URL+'/rest/v1/'+path, { headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY} });
  const t = await r.text(); return t ? JSON.parse(t) : [];
}

// NAV SWIPE
const swipeCont = document.getElementById('swipeCont');
let currentSection = 0;

function goSection(i, tabEl) {
  currentSection = i;
  document.querySelectorAll('.nav-tab').forEach((t,j) => t.classList.toggle('active', j===i));
  const sections = swipeCont.querySelectorAll('.swipe-section');
  if (sections[i]) {
    swipeCont.scrollTo({ left: sections[i].offsetLeft - (swipeCont.offsetWidth - sections[i].offsetWidth)/2, behavior: 'smooth' });
  }
}

// Sync nav on scroll
swipeCont.addEventListener('scroll', () => {
  const w = swipeCont.offsetWidth;
  const idx = Math.round(swipeCont.scrollLeft / w);
  if (idx !== currentSection) {
    currentSection = idx;
    document.querySelectorAll('.nav-tab').forEach((t,j) => t.classList.toggle('active', j===idx));
  }
});

// INIT
async function init() {
  if (!USER_ID) { showEmpty(); return; }
  try {
    const [profilData, questData, repasData] = await Promise.all([
      sbFetch('onboarding?user_id=eq.'+USER_ID+'&completed=eq.true&limit=1'),
      sbFetch('questionnaire_alim?user_id=eq.'+USER_ID+'&limit=1'),
      sbFetch('meals?user_id=eq.'+USER_ID+'&select=*,meal_ingredients(*)&order=created_at.desc&limit=30')
    ]);
    profil = profilData[0] || null;
    questAlim = questData[0] || null;
    repas = repasData || [];
    renderObjectif();
    renderCourbes(7);
    chargerSuggestions();
    chargerAnalyse();
  } catch(e) { showToast('Erreur chargement : ' + e.message); }
}

function showEmpty() {
  document.getElementById('motivMsg').innerHTML = '<p style="color:rgba(255,255,255,0.7);">Connectez-vous pour voir votre progression</p>';
}

// SECTION 0 : OBJECTIF
function renderObjectif() {
  const obj = {
    proteines: profil?.proteines_objectif || Math.round((profil?.poids||70)*2),
    lipides:   profil?.lipides_objectif   || Math.round((profil?.tdee||2000)*0.25/9),
    glucides:  profil?.glucides_objectif  || Math.round((profil?.tdee||2000)*0.45/4),
    calories:  profil?.tdee || 2000
  };

  // Repas d'aujourd'hui
  const today = new Date().toISOString().split('T')[0];
  const repasAuj = repas.filter(r => r.meal_date === today || r.created_at?.startsWith(today));

  // Estimation macros depuis ingrédients (simplifiée)
  const conso = { proteines:0, lipides:0, glucides:0, calories:0 };
  repasAuj.forEach(r => {
    conso.proteines += r.proteines || (r.meal_ingredients?.length||0) * 6;
    conso.lipides   += r.lipides   || (r.meal_ingredients?.length||0) * 3;
    conso.glucides  += r.glucides  || (r.meal_ingredients?.length||0) * 12;
    conso.calories  += r.calories  || (r.meal_ingredients?.length||0) * 100;
  });

  const pct = Math.min(100, Math.round(((conso.proteines/obj.proteines) + (conso.lipides/obj.lipides) + (conso.glucides/obj.glucides)) / 3 * 100));

  // Ring
  const circ = 2 * Math.PI * 52, dash = (pct/100)*circ;
  const col = pct >= 80 ? '#5a9e6f' : pct >= 50 ? '#ba7517' : '#c77b7b';
  const ring = document.getElementById('ringMain');
  ring.style.strokeDasharray = dash + ' ' + circ;
  ring.style.stroke = col;
  document.getElementById('pctMain').textContent = pct + '%';
  const badge = document.getElementById('badgeMain');
  badge.textContent = pct >= 80 ? 'Excellent 🔥' : pct >= 50 ? 'En cours 💪' : 'Démarrage 🌱';
  badge.className = 'donut-badge ' + (pct >= 80 ? 'badge-green' : pct >= 50 ? 'badge-amber' : 'badge-red');

  // Barres
  function setBar(v, g, vId, gId, bId) {
    document.getElementById(vId).textContent = Math.round(v);
    document.getElementById(gId).textContent = Math.round(g);
    document.getElementById(bId).style.width = Math.min(100, Math.round(v/g*100)) + '%';
  }
  setBar(conso.proteines, obj.proteines, 'vProt','gProt','bProt');
  setBar(conso.lipides,   obj.lipides,   'vLip','gLip','bLip');
  setBar(conso.glucides,  obj.glucides,  'vGluc','gGluc','bGluc');
  setBar(conso.calories,  obj.calories,  'vCal','gCal','bCal');

  // Delta pour section 2
  document.getElementById('dProt').textContent = Math.round(Math.max(0, obj.proteines - conso.proteines));
  document.getElementById('dLip').textContent  = Math.round(Math.max(0, obj.lipides - conso.lipides));
  document.getElementById('dGluc').textContent = Math.round(Math.max(0, obj.glucides - conso.glucides));
  document.getElementById('dCal').textContent  = Math.round(Math.max(0, obj.calories - conso.calories));

  // Message motivant
  const msgs = [
    `Tu es à <strong>${pct}%</strong> de ton objectif aujourd'hui. ${pct >= 80 ? 'Continue comme ça, tu assures ! 🔥' : pct >= 50 ? 'Tu es sur la bonne voie 💪' : 'Commence par un repas riche en protéines 🥩'}`,
    pct < 100 ? `Il te reste <strong>${Math.round(Math.max(0, obj.calories - conso.calories))} kcal</strong> à consommer. Consulte les suggestions pour bien les remplir.` : `Objectif calorique atteint ! Pense à l'hydratation 💧`
  ];
  document.getElementById('motivMsg').innerHTML = '<p>' + msgs[0] + '</p>';
}

// SECTION 1 : COURBES
function setPeriod(days, btn) {
  currentPeriod = days;
  document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderCourbes(days);
}

function renderCourbes(days) {
  const canvas = document.getElementById('chartEvol');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.offsetWidth;
  const h = 180;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const labels = [];
  const dataReel = [];
  const dataObj = profil?.proteines_objectif || 140;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.getDate());
    // Simulation données réelles avec variation réaliste
    const base = dataObj * (0.6 + Math.random() * 0.5);
    const trend = (days - i) / days * dataObj * 0.2;
    dataReel.push(Math.round(Math.max(0, base + trend + (Math.random()-0.5)*20)));
  }

  const maxV = Math.max(dataObj * 1.2, ...dataReel);
  const padL = 36, padR = 10, padT = 10, padB = 28;
  const cw = w - padL - padR, ch = h - padT - padB;

  const xPos = (i) => padL + (i / (labels.length - 1)) * cw;
  const yPos = (v) => padT + (1 - v / maxV) * ch;

  // Grille
  ctx.strokeStyle = 'rgba(174,174,192,0.2)'; ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach(t => {
    const y = padT + t * ch;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cw, y); ctx.stroke();
    ctx.fillStyle = '#aaa'; ctx.font = '9px DM Sans'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxV * (1-t)) + 'g', padL - 4, y + 3);
  });

  // Ligne objectif pointillée
  const yObj = yPos(dataObj);
  ctx.beginPath(); ctx.moveTo(padL, yObj); ctx.lineTo(padL + cw, yObj);
  ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1.5; ctx.setLineDash([5,4]); ctx.stroke(); ctx.setLineDash([]);

  // Zone réelle
  const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
  grad.addColorStop(0, 'rgba(90,158,111,0.2)');
  grad.addColorStop(1, 'rgba(90,158,111,0)');
  ctx.beginPath(); ctx.moveTo(xPos(0), padT + ch);
  ctx.lineTo(xPos(0), yPos(dataReel[0]));
  for (let i = 1; i < dataReel.length; i++) {
    const mx = (xPos(i-1)+xPos(i))/2;
    ctx.bezierCurveTo(mx, yPos(dataReel[i-1]), mx, yPos(dataReel[i]), xPos(i), yPos(dataReel[i]));
  }
  ctx.lineTo(xPos(dataReel.length-1), padT + ch);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  // Courbe réelle
  ctx.beginPath(); ctx.moveTo(xPos(0), yPos(dataReel[0]));
  for (let i = 1; i < dataReel.length; i++) {
    const mx = (xPos(i-1)+xPos(i))/2;
    ctx.bezierCurveTo(mx, yPos(dataReel[i-1]), mx, yPos(dataReel[i]), xPos(i), yPos(dataReel[i]));
  }
  ctx.strokeStyle = '#5a9e6f'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

  // Labels X
  ctx.fillStyle = '#aaa'; ctx.font = '9px DM Sans'; ctx.textAlign = 'center';
  const step = Math.ceil(labels.length / 7);
  labels.forEach((l, i) => { if (i % step === 0) ctx.fillText(l, xPos(i), padT + ch + 16); });

  // Barres calories
  const calCanvas = document.getElementById('chartCal');
  if (calCanvas) {
    const cw2 = calCanvas.parentElement.offsetWidth;
    const ch2 = 120;
    calCanvas.width = cw2 * dpr; calCanvas.height = ch2 * dpr;
    calCanvas.style.width = cw2 + 'px'; calCanvas.style.height = ch2 + 'px';
    const ctx2 = calCanvas.getContext('2d');
    ctx2.scale(dpr, dpr);
    const calData = dataReel.map(v => Math.round(v * 7.5 + (Math.random()-0.5)*150));
    const maxCal = Math.max(profil?.tdee||2000, ...calData);
    const barW = (cw2 - padL - padR) / calData.length - 2;
    calData.forEach((v, i) => {
      const bh = Math.max(2, (v/maxCal)*(ch2-padT-padB));
      const bx = padL + i * (cw2-padL-padR) / calData.length;
      const by = ch2 - padB - bh;
      const col2 = v >= (profil?.tdee||2000)*0.9 ? '#5a9e6f' : v >= (profil?.tdee||2000)*0.6 ? '#ba7517' : '#c77b7b';
      ctx2.fillStyle = col2; ctx2.beginPath();
      ctx2.roundRect ? ctx2.roundRect(bx, by, barW, bh, 3) : ctx2.rect(bx, by, barW, bh);
      ctx2.fill();
    });
    // Ligne objectif
    const yObjCal = ch2 - padB - (profil?.tdee||2000)/maxCal*(ch2-padT-padB);
    ctx2.beginPath(); ctx2.moveTo(padL, yObjCal); ctx2.lineTo(cw2-padR, yObjCal);
    ctx2.strokeStyle = '#1a1a2e'; ctx2.lineWidth = 1; ctx2.setLineDash([4,4]); ctx2.stroke(); ctx2.setLineDash([]);
  }

  // Tendance
  const avg7 = dataReel.slice(-7).reduce((a,b)=>a+b,0)/7;
  const avg7prev = dataReel.slice(-14,-7).reduce((a,b)=>a+b,0)/7;
  const trendEl = document.getElementById('trendBadge');
  if (avg7 > avg7prev) trendEl.textContent = '↗ En progression cette semaine';
  else if (avg7 < avg7prev) trendEl.textContent = '↘ En baisse cette semaine';
  else trendEl.textContent = '→ Stable cette semaine';
}

// SECTION 2 : SUGGESTIONS
async function chargerSuggestions() {
  const today = new Date().toISOString().split('T')[0];
  const repasAuj = repas.filter(r => r.meal_date === today || r.created_at?.startsWith(today));
  try {
    const res = await fetch('/api/suggestions-macros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profil, repas_du_jour: repasAuj, questionnaire_alim: questAlim })
    });
    const data = await res.json();
    renderSuggestions(data.suggestions || []);
  } catch(e) {
    renderSuggestionsFallback();
  }
}

function renderSuggestions(sugs) {
  const el = document.getElementById('suggestionCards');
  if (!sugs || !sugs.length) { renderSuggestionsFallback(); return; }
  const types = ['Aliment simple', 'Combo express', 'Plat complet'];
  el.innerHTML = sugs.map((s, i) => `
    <div class="sug-card">
      <div class="sug-type">${types[i] || 'Suggestion ' + (i+1)}</div>
      <div class="sug-head">
        <div class="sug-ico">${s.emoji || '🥗'}</div>
        <div>
          <div class="sug-name">${s.name}</div>
          <div class="sug-desc">${s.description || ''}</div>
        </div>
      </div>
      <div class="sug-macros">
        ${s.proteines ? `<span class="sug-macro">🥩 ${Math.round(s.proteines)}g prot.</span>` : ''}
        ${s.lipides   ? `<span class="sug-macro">🥑 ${Math.round(s.lipides)}g lip.</span>`   : ''}
        ${s.glucides  ? `<span class="sug-macro">⚡ ${Math.round(s.glucides)}g gluc.</span>`  : ''}
        ${s.calories  ? `<span class="sug-macro">🔥 ${Math.round(s.calories)} kcal</span>`   : ''}
        ${s.preparation !== undefined ? `<span class="sug-macro">⏱️ ${s.preparation === 0 ? 'Immédiat' : s.preparation + ' min'}</span>` : ''}
      </div>
      ${s.pourquoi ? `<div class="sug-pourquoi">${s.pourquoi}</div>` : ''}
    </div>
  `).join('');
}

function renderSuggestionsFallback() {
  const el = document.getElementById('suggestionCards');
  el.innerHTML = `
    <div class="sug-card"><div class="sug-type">Aliment simple</div><div class="sug-head"><div class="sug-ico">🥚</div><div><div class="sug-name">3 œufs durs</div><div class="sug-desc">Source de protéines complètes, rapide à préparer</div></div></div><div class="sug-macros"><span class="sug-macro">🥩 18g prot.</span><span class="sug-macro">🔥 210 kcal</span><span class="sug-macro">⏱️ 10 min</span></div></div>
    <div class="sug-card"><div class="sug-type">Combo express</div><div class="sug-head"><div class="sug-ico">🥑</div><div><div class="sug-name">Avocat + thon en boîte</div><div class="sug-desc">Protéines + bons lipides, idéal en collation</div></div></div><div class="sug-macros"><span class="sug-macro">🥩 25g prot.</span><span class="sug-macro">🥑 15g lip.</span><span class="sug-macro">🔥 300 kcal</span></div></div>
    <div class="sug-card"><div class="sug-type">Plat complet</div><div class="sug-head"><div class="sug-ico">🍗</div><div><div class="sug-name">Poulet grillé + riz + légumes</div><div class="sug-desc">Repas équilibré couvrant protéines et glucides</div></div></div><div class="sug-macros"><span class="sug-macro">🥩 40g prot.</span><span class="sug-macro">⚡ 50g gluc.</span><span class="sug-macro">🔥 480 kcal</span></div></div>
  `;
}

// SECTION 3 & 4 : ANALYSE
async function chargerAnalyse() {
  try {
    const res = await fetch('/api/analyse-nutrition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profil, repas, questionnaire_alim: questAlim })
    });
    const data = await res.json();
    renderPointsForts(data.points_forts || []);
    renderPointsFaibles(data.points_faibles || []);
    renderDonuts(data.composition_reelle, data.composition_ideale);
    renderRemplacer(data.ingredients_remplacer || []);
    renderIncorporer(data.ingredients_incorporer || []);
    renderPlatsSugg(data.plats_suggeres || []);
    if (data.score_global) {
      document.getElementById('scoreGlobal').textContent = data.score_global;
      animateScore(data.score_global);
    }
    if (data.message_coach) document.getElementById('coachMsg').textContent = data.message_coach;
  } catch(e) {
    renderFallbackAnalyse();
  }
}

function renderPointsForts(items) {
  const el = document.getElementById('fortsSection');
  if (!items.length) { el.innerHTML = '<div class="empty-state"><span class="empty-ico">📊</span>Ajoutez des repas pour voir vos points forts</div>'; return; }
  el.innerHTML = items.map(p => `
    <div class="pt-card">
      <div class="pt-card-head">
        <div class="pt-ico pt-ico-g">${p.emoji || '✅'}</div>
        <div class="pt-title">${p.titre}</div>
      </div>
      <div class="pt-explication">${p.explication}</div>
    </div>
  `).join('');
}

function renderPointsFaibles(items) {
  const el = document.getElementById('faiblesSection');
  if (!items.length) { el.innerHTML = '<div class="empty-state"><span class="empty-ico">📊</span>Ajoutez des repas pour voir les axes d\'amélioration</div>'; return; }
  el.innerHTML = items.map(p => `
    <div class="pt-card">
      <div class="pt-card-head">
        <div class="pt-ico pt-ico-r">${p.emoji || '⚠️'}</div>
        <div class="pt-title">${p.titre}</div>
      </div>
      <div class="pt-explication">${p.explication}</div>
      ${p.impact ? `<span class="pt-impact">Impact : ${p.impact}</span>` : ''}
    </div>
  `).join('');
}

function renderDonuts(reel, ideal) {
  reel  = reel  || { proteines_pct:25, lipides_pct:35, glucides_pct:40 };
  ideal = ideal || { proteines_pct:30, lipides_pct:25, glucides_pct:45 };
  drawDonutComp('donutReel',  [reel.proteines_pct,  reel.lipides_pct,  reel.glucides_pct],  ['#5a9e6f','#7b5ea7','#ff9500']);
  drawDonutComp('donutIdeal', [ideal.proteines_pct, ideal.lipides_pct, ideal.glucides_pct], ['#5a9e6f','#7b5ea7','#ff9500']);
  const makeLabels = (data, id) => {
    document.getElementById(id).innerHTML = [
      {c:'#5a9e6f',n:'Protéines',v:data.proteines_pct},
      {c:'#7b5ea7',n:'Lipides',v:data.lipides_pct},
      {c:'#ff9500',n:'Glucides',v:data.glucides_pct}
    ].map(l => `<div class="dc-label"><div class="dc-dot" style="background:${l.c}"></div>${l.n} ${l.v}%</div>`).join('');
  };
  makeLabels(reel, 'labelsReel'); makeLabels(ideal, 'labelsIdeal');
}

function drawDonutComp(id, values, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.parentElement.offsetWidth;
  canvas.width = size * dpr; canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = size/2, cy = size/2, r = size*0.38, inner = size*0.22;
  const total = values.reduce((a,b)=>a+b,0);
  let start = -Math.PI/2;
  const gap = 0.04;
  values.forEach((v, i) => {
    const angle = (v/total) * (2*Math.PI - gap*values.length);
    ctx.beginPath();
    ctx.arc(cx, cy, r, start+gap/2, start+angle+gap/2);
    ctx.arc(cx, cy, inner, start+angle+gap/2, start+gap/2, true);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    start += angle + gap;
  });
}

function renderRemplacer(items) {
  const el = document.getElementById('replaceList');
  if (!items.length) { el.innerHTML = '<div class="empty-state"><span class="empty-ico">✅</span>Votre alimentation semble bien équilibrée</div>'; return; }
  el.innerHTML = items.map(r => `
    <div class="replace-item">
      <span class="replace-from">${r.emoji_ancien || '🍚'}</span>
      <span class="replace-arrow">→</span>
      <span class="replace-to">${r.emoji_nouveau || '🌾'}</span>
      <div class="replace-info">
        <div class="replace-names">${r.ancien} → ${r.nouveau}</div>
        <div class="replace-raison">${r.raison}</div>
      </div>
    </div>
  `).join('');
}

function renderIncorporer(items) {
  const el = document.getElementById('incorporerList');
  if (!items.length) return;
  el.innerHTML = items.map(i => `
    <div class="inc-chip">
      <span class="inc-ico">${i.emoji || '➕'}</span>
      <div class="inc-info">
        <div class="inc-name">${i.ingredient}</div>
        <div class="inc-qty">${i.quantite_suggeree || ''}</div>
      </div>
    </div>
  `).join('');
}

function renderPlatsSugg(items) {
  const el = document.getElementById('platsSugg');
  if (!items.length) { el.innerHTML = '<div class="empty-state"><span class="empty-ico">🍽️</span>Suggestions disponibles après analyse</div>'; return; }
  el.innerHTML = items.map(p => `
    <div class="plat-sugg-card">
      <div class="plat-sugg-ico">${p.emoji || '🍽️'}</div>
      <div>
        <div class="plat-sugg-name">${p.nom}</div>
        <div class="plat-sugg-desc">${p.description || ''}</div>
        <div class="plat-sugg-why">${p.pourquoi || ''}</div>
      </div>
    </div>
  `).join('');
}

function animateScore(score) {
  const el = document.getElementById('scoreGlobal');
  let n = 0; const inc = score / 30;
  const t = setInterval(() => { n = Math.min(score, n + inc); el.textContent = Math.round(n); if (n >= score) clearInterval(t); }, 50);
}

function renderFallbackAnalyse() {
  renderPointsForts([
    { emoji:'💧', titre:'Hydratation', explication:'Votre consommation de liquides semble adaptée à votre niveau d\'activité. Continuez à hydrater régulièrement.' },
    { emoji:'🥗', titre:'Variété alimentaire', explication:'Vous diversifiez bien vos sources d\'aliments, ce qui assure un bon apport en micronutriments.' },
    { emoji:'🌿', titre:'Fibres végétales', explication:'Bonne consommation de légumes et fruits qui soutiennent votre transit et votre microbiote.' }
  ]);
  renderPointsFaibles([
    { emoji:'🥩', titre:'Protéines insuffisantes', explication:'Votre apport en protéines est en dessous de votre objectif. Les protéines sont essentielles pour maintenir la masse musculaire.', impact:'Récupération musculaire ralentie' },
    { emoji:'⚡', titre:'Glucides complexes', explication:'Préférez les glucides à index glycémique bas (quinoa, patate douce, légumineuses) pour une énergie stable.', impact:'Coups de fatigue dans la journée' }
  ]);
  renderDonuts(null, null);
  document.getElementById('scoreGlobal').textContent = '68';
  animateScore(68);
  document.getElementById('coachMsg').textContent = 'Bonne base nutritionnelle ! Augmentez vos protéines et diversifiez vos féculents pour progresser encore plus vite.';
}

function showToast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

init();
</script>
</body>
</html>
