/* ═══════════════════════════════════════════════════════════════
   Natty — <natty-app>, l'application DANS une page du site Wix

   ⚠️ CE FICHIER EST UN MODÈLE. Le fichier publié est produit par
       node scripts/build-wix.mjs
   qui y injecte la feuille css/natty.css et le menu de nouveau.html.

   POURQUOI. « Mon suivi », « Commander », l'inscription et les conditions
   vivent sur Vercel (l'app). Y envoyer le visiteur, c'était changer de
   site au milieu du parcours : autre adresse, autre menu, plus de retour.
   Ce composant garde le menu du site en haut et pose la page de l'app en
   dessous, en pleine hauteur. Le visiteur ne quitte jamais natty-nutrition.com.

   ATTRIBUTS
     page      la page de l'app à afficher : menu.html (défaut, le suivi),
               offre.html, login.html, cgv.html, cgu.html, confidentialite.html
     base      racine de l'app, défaut https://natty-suivi.vercel.app/
     lien-*    adresses des pages Wix du menu (voir scripts/wix-composants.mjs)

   CE QUI PASSE DE LA PAGE WIX À L'APP
   · la requête de l'adresse (/suivi?inscription=1&motif=quantites) : un lien
     du site qui veut l'onglet Inscription l'obtient ;
   · ?retour=<cette page> : login.html s'en sert pour Google et Apple, qui
     refusent de s'afficher dans un cadre. La page entière part chez le
     fournisseur et revient ICI avec les jetons dans le fragment ;
   · ces jetons, rendus au cadre (login.html?oauth=1#…) puis effacés de la
     barre d'adresse : la session s'ouvre dans le stockage du cadre, celui
     que l'app relira à chaque visite.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var BALISE = 'natty-app';
  if (customElements.get(BALISE)) return;

  var CSS = /*__CSS__*/ "";
  var MENU = /*__MENU__*/ "";
  var DEFAUTS = /*__DEFAUTS__*/ {};
  var ATTRIBUTS = /*__ATTRIBUTS__*/ [];
  var POLICES = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..600&display=swap';
  var PAGES = ['menu.html', 'suivi.html', 'offre.html', 'login.html', 'cgv.html', 'cgu.html', 'confidentialite.html'];

  var CSS_APP = `
:host{ display: block; }
.n-page{ min-height: 0; }
.n-page .nav{ position: relative; top: 0; }
.cadre{
  display: block; width: 100%; border: 0; background: var(--bg);
  height: calc(100vh - var(--hauteur-menu, 70px));
  height: calc(100dvh - var(--hauteur-menu, 70px));
  min-height: 560px;
}
`;

  function chargerPolices() {
    try {
      if (document.querySelector('link[data-natty-polices]')) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = POLICES;
      l.setAttribute('data-natty-polices', '');
      document.head.appendChild(l);
    } catch (e) { /* la pile de secours suffit */ }
  }

  class NattyApp extends HTMLElement {
    static get observedAttributes() { return ATTRIBUTS.concat(['page']); }
    attr(nom) { return this.getAttribute(nom) || DEFAUTS[nom]; }

    /* L'adresse de la page de l'app, avec ce que la page Wix lui transmet. */
    adresseCadre() {
      var base = this.attr('base');
      var page = this.getAttribute('page') || 'menu.html';
      if (PAGES.indexOf(page.split('?')[0]) < 0) page = 'menu.html';
      var q = new URLSearchParams(page.split('?')[1] || '');
      new URLSearchParams(location.search).forEach(function (v, k) { q.set(k, v); });
      // Venir d'un lien « Créer mon compte » : l'onglet Inscription, pas l'accueil de l'app.
      if (q.get('inscription') === '1' || q.get('motif')) page = 'login.html';
      q.set('retour', location.origin + location.pathname);

      // Retour de Google ou d'Apple : les jetons sont dans NOTRE fragment.
      var fragment = '';
      if (/(^|[#&])(access_token|error)=/.test(location.hash)) {
        page = 'login.html';
        q.set('oauth', '1');
        fragment = location.hash;
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      }
      var qs = q.toString();
      return base + page.split('?')[0] + (qs ? '?' + qs : '') + fragment;
    }

    connectedCallback() {
      if (this.shadowRoot) return;
      chargerPolices();
      var self = this, racine = this.attachShadow({ mode: 'open' });
      var menu = MENU.replace(/@@([a-z-]+)@@/g, function (m, k) { return self.attr(k) || ''; });
      racine.innerHTML = '<style>' + CSS + CSS_APP + '</style>'
        + '<div class="n-page">' + menu
        + '<iframe class="cadre" title="Natty" allow="camera; microphone; clipboard-write; payment; geolocation; fullscreen"></iframe>'
        + '</div>';
      racine.querySelector('.cadre').src = this.adresseCadre();

      // Le cadre prend toute la hauteur qui reste sous le menu.
      var nav = racine.querySelector('.nav');
      function mesurer() { if (nav) self.style.setProperty('--hauteur-menu', nav.offsetHeight + 'px'); }
      mesurer();
      if (window.ResizeObserver && nav) new ResizeObserver(mesurer).observe(nav);

      // Le bouton de thème du menu : même mémoire que le site.
      try { var s = localStorage.getItem('natty-theme'); if (s) this.setAttribute('data-theme', s); } catch (e) {}
      var b = racine.getElementById('themeBtn');
      if (b) b.addEventListener('click', function () {
        var sombre = self.getAttribute('data-theme') === 'dark'
          || (!self.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
        var suivant = sombre ? 'light' : 'dark';
        self.setAttribute('data-theme', suivant);
        try { localStorage.setItem('natty-theme', suivant); } catch (e) {}
      });
    }
  }
  customElements.define(BALISE, NattyApp);
})();
