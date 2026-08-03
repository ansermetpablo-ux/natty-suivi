/* ═══════════════════════════════════════════════════════════
   Natty — Barre de navigation partagée (Suivi / Menu / + / Coaching / Défis)
   Composant unique injecté sur chaque écran — ne pas dupliquer/modifier
   séparément par page. Toute évolution de la nav se fait ici uniquement.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var CSS = '' +
    '#nattyNav{position:fixed;left:0;right:0;bottom:0;z-index:500;display:flex;justify-content:center;' +
      'padding:0 14px calc(14px + env(safe-area-inset-bottom,0px));pointer-events:none}' +
    '#nattyNav .nn-bar{pointer-events:auto;width:100%;max-width:480px;background:#fff;border-radius:28px;' +
      'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;' +
      'box-shadow:0 8px 28px rgba(20,20,30,.14);}' +
    '#nattyNav .nn-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;' +
      'background:none;border:none;padding:8px 2px;cursor:pointer;color:#b7b7c0;font-family:inherit}' +
    '#nattyNav .nn-item svg{width:22px;height:22px;display:block}' +
    '#nattyNav .nn-item span{font-size:11px;font-weight:600;letter-spacing:.1px}' +
    '#nattyNav .nn-item.active{color:#101014}' +
    '#nattyNav .nn-add{flex:0 0 auto;width:54px;height:54px;border-radius:50%;background:#101014;' +
      'display:flex;align-items:center;justify-content:center;margin:0 4px;cursor:pointer;border:none;' +
      'box-shadow:0 6px 16px rgba(16,16,20,.35);transition:transform .12s}' +
    '#nattyNav .nn-add:active{transform:scale(.93)}' +
    '#nattyNav .nn-add svg{width:24px;height:24px}' +
    'body{padding-bottom:104px}';

  var ICONS = {
    suivi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v7a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V2M5 11v11M12 2v19M19 2c-1.7 0-3 2-3 5s1.3 5 3 5v9"/></svg>',
    coaching: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    social: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8"/><path d="M16.5 4.7a3.4 3.4 0 0 1 0 6.6M18 14.6c2.1.6 3.5 2.3 3.5 4.6"/></svg>',
    defis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c1.5 1.5 2 3.3 2 5a6 6 0 1 1-12 0c0-4 2-7 6-12Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  var ITEMS = [
    { key: 'suivi', label: 'Suivi', href: 'suivi.html', icon: ICONS.suivi },
    { key: 'repas', label: 'Repas', href: 'repas.html', icon: ICONS.menu },
    { key: 'add', add: true },
    // Coaching a laissé sa place au fil social ; la page reste accessible
    // depuis la carte « Coaching » de menu.html.
    { key: 'social', label: 'Social', href: 'social.html', icon: ICONS.social },
    { key: 'defis', label: 'Défis', href: 'narration.html', icon: ICONS.defis }
  ];

  function currentKey() {
    var p = location.pathname.split('/').pop().replace('.html', '') || 'suivi';
    if (p === 'index') return 'suivi';
    return p;
  }

  function qs() {
    return location.search || '';
  }

  function inject() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.id = 'nattyNav';
    var active = currentKey();

    var html = '<div class="nn-bar">';
    ITEMS.forEach(function (it) {
      if (it.add) {
        html += '<button class="nn-add" id="nnAddBtn" aria-label="Ajouter un plat">' + ICONS.plus + '</button>';
      } else {
        html += '<button class="nn-item' + (it.key === active ? ' active' : '') + '" data-href="' + it.href + '">' +
          it.icon + '<span>' + it.label + '</span></button>';
      }
    });
    html += '</div>';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);

    wrap.querySelectorAll('.nn-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var href = btn.dataset.href;
        if (href.replace('.html', '') === active) return;
        window.location.href = href + qs();
      });
    });

    document.getElementById('nnAddBtn').addEventListener('click', function () {
      // Parcours d'ajout (assets/ajout.js) : ouvre la caméra tout de suite.
      // L'appel doit rester synchrone dans ce handler, sinon iOS considère
      // que l'ouverture de la caméra n'est plus déclenchée par l'utilisateur.
      if (window.NattyAjout && typeof window.NattyAjout.start === 'function') { window.NattyAjout.start(); return; }
      if (typeof window.NattyOnAdd === 'function') { window.NattyOnAdd(); return; }
      window.location.href = 'suivi.html' + qs() + (qs() ? '&' : '?') + 'add=1';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
