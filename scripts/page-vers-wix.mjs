/* ═══════════════════════════════════════════════════════════════
   Natty — transforme une page HTML du site en Custom Element Wix.

   La page reste la source : on ne réécrit RIEN à la main côté Wix. Ce
   module lit la page, sa feuille css/natty.css et ses scripts, et en
   fait un composant autonome à Shadow DOM :

   · le CSS passe de :root/body à :host et à une enveloppe `.n-page`,
     pour que les jetons et le thème vivent sur le composant et non sur
     la page Wix (dont le CSS n'entre pas dans le Shadow DOM) ;
   · les scripts de la page s'exécutent avec un `document` de
     substitution : getElementById, querySelector et documentElement
     visent le composant, tout le reste (body, keydown, createRange…)
     reste le vrai document ;
   · les liens entre pages deviennent des adresses Wix (réglables par
     attribut), les images pointent sur Vercel ;
   · les ancres (#plats, #tarifs…) défilent DANS le composant : le
     navigateur ne sait pas trouver un id caché dans un Shadow DOM ;
   · si la page charge data/plats.js, le catalogue est injecté dans le
     composant au lieu d'être chargé : la carte est là au premier rendu.

   Chaque page donne aussi un fichier Velo : le contenu d'un Custom
   Element n'est pas indexé par Google, `seoMarkup` lui donne le texte.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const POLICES = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..600&display=swap';
const BASE = 'https://natty-suivi.vercel.app/';

function entre(t, a, b, depuis = 0) {
  const i = t.indexOf(a, depuis);
  if (i < 0) return null;
  const j = t.indexOf(b, i + a.length);
  return j < 0 ? null : { contenu: t.slice(i + a.length, j), fin: j + b.length };
}

/* :root → :host, body → .n-page. Les sélecteurs de thème suivent :
   `:root[data-theme="light"]` devient `:host([data-theme="light"])`. */
export function cssPourHote(css) {
  return css
    .replace(/:root:not\(([^)]*)\)/g, ':host(:not($1))')
    .replace(/:root\[([^\]]*)\]/g, ':host([$1])')
    .replace(/:root\b/g, ':host')
    .replace(/(^|[\s,}>])(html|body)(?=\s*[{,.:\[>\s])/gm, '$1.n-page');
}

/* Les liens d'une page à l'autre deviennent des jetons @@attribut@@,
   remplacés à l'exécution par l'adresse Wix. Les chemins relatifs
   d'images visent Vercel. */
function reecrireLiens(html, liens) {
  for (const [page, l] of Object.entries(liens)) {
    html = html.split(`href="${page}`).join(`href="@@${l.attribut}@@`);
  }
  return html.replace(/(src|href)="(img\/[^"]*)"/g, `$1="@@base@@$2"`);
}

export function texteSeo(main, catalogue) {
  let h = main
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<button[\s\S]*?<\/button>/g, '')
    .replace(/<(figure|img)[^>]*>/g, '').replace(/<\/figure>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(\w+)(\s[^>]*)?>/g, (m, tag, attrs) => {
      const href = attrs && attrs.match(/href="([^"#@][^"]*)"/);
      return tag === 'a' && href ? `<a href="${href[1]}">` : `<${tag}>`;
    })
    .replace(/<(div|span|section|header|footer|main|nav|aside|figcaption|b|em|strong|table|thead|tbody|tr|th|td|details|summary|dl|dt|dd)>/g, '')
    .replace(/<\/(div|span|section|header|footer|main|nav|aside|figcaption|b|em|strong|table|thead|tbody|tr|th|td|details|summary|dl|dt|dd)>/g, ' ')
    .replace(/<a>([\s\S]*?)<\/a>/g, '$1')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  if (catalogue) {
    const plats = catalogue.plats.filter(p => p.coherent !== false);
    h += '\n<h2>Les plats de la semaine</h2>\n<ul>'
      + plats.map(p => `<li>${p.nom} — ${p.description}</li>`).join('') + '</ul>';
  }
  return h;
}

/* Le CSS et le menu d'une page, pour <natty-app> : l'app embarquée porte
   EXACTEMENT le menu du site, pris dans la page et non recopié. Les ancres du
   menu (#plats, #tarifs) visent la page d'accueil, puisqu'elles n'existent
   pas dans la page de l'app. */
export function menuPourApp(page, liens) {
  const html = readFileSync(page, 'utf8').replace(/\r\n/g, '\n');
  let css = '';
  for (const m of html.matchAll(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g)) {
    css += readFileSync(join(dirname(page), m[1]), 'utf8') + '\n';
  }
  const i = html.indexOf('<header class="nav">');
  const j = html.indexOf('</header>', i);
  if (i < 0 || j < 0) throw new Error(`${page} : <header class="nav"> introuvable`);
  const accueil = liens['nouveau.html'].attribut;
  const nav = reecrireLiens(html.slice(i, j + '</header>'.length), liens)
    .replace(/href="#/g, `href="@@${accueil}@@#`);
  const attributs = ['base', ...Object.values(liens).map(l => l.attribut)];
  const defauts = { base: BASE, ...Object.fromEntries(Object.values(liens).map(l => [l.attribut, l.defaut])) };
  return { css: `.n-page{ letter-spacing: normal; word-spacing: normal; text-transform: none; text-indent: 0;
  text-align: start; white-space: normal; font-style: normal; font-weight: 400; line-height: normal; }
` + cssPourHote(css), nav, attributs, defauts };
}

export function pageVersComposant({ balise, page }, { liens, catalogue, date }) {
  const html = readFileSync(page, 'utf8').replace(/\r\n/g, '\n');
  const racine = dirname(page);

  // ── Le CSS : les feuilles liées du dépôt, puis les <style> de la page.
  let css = '';
  for (const m of html.matchAll(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g)) {
    css += readFileSync(join(racine, m[1]), 'utf8') + '\n';
  }
  for (const m of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) css += m[1] + '\n';
  /* Les propriétés HÉRITÉES traversent le Shadow DOM : un `*{letter-spacing}`
     de la page Wix atteint l'hôte et descend dans le composant (mesuré au
     banc). On les remet à zéro sur l'enveloppe AVANT la feuille de la page,
     qui reprend la main sur ce qu'elle définit. */
  css = `.n-page{ letter-spacing: normal; word-spacing: normal; text-transform: none; text-indent: 0;
  text-align: start; white-space: normal; font-style: normal; font-weight: 400; font-variant: normal;
  line-height: normal; text-shadow: none; visibility: visible; cursor: auto; }
` + cssPourHote(css) + `
:host{ display: block; }
.n-page{ min-height: 0; }
`;

  // ── Le corps, sans ses scripts.
  const corps = entre(html, '<body>', '</body>');
  if (!corps) throw new Error(`${page} : <body> introuvable`);
  const scripts = [];
  let usesCatalogue = false;
  const bodyHtml = corps.contenu.replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g, (m, attrs, code) => {
    if (attrs && /src="data\/plats\.js"/.test(attrs)) { usesCatalogue = true; return ''; }
    if (attrs && /src=/.test(attrs)) throw new Error(`${page} : script externe non pris en charge (${attrs.trim()})`);
    scripts.push(code);
    return '';
  }).trim();
  if (/class="tbd"/.test(bodyHtml)) throw new Error(`${page} : il reste un trou .tbd — à combler avant de publier`);

  const gabarit = reecrireLiens(bodyHtml, liens);
  const code = scripts.join('\n;\n').replace(/window\.NATTY_CATALOGUE/g, 'NATTY_CATALOGUE');
  const attributs = ['base', ...Object.values(liens).map(l => l.attribut)];
  const defauts = { base: BASE, ...Object.fromEntries(Object.values(liens).map(l => [l.attribut, l.defaut])) };

  const main = entre(html, '<main', '</main>');
  const seo = texteSeo(main ? main.contenu.slice(main.contenu.indexOf('>') + 1) : bodyHtml, usesCatalogue ? catalogue : null);

  const composant = `/* Natty — <${balise}> pour Wix Studio.
   FICHIER GÉNÉRÉ par scripts/build-wix.mjs le ${date}, depuis ${page}.
   Ne pas éditer à la main : modifier ${page} (ou css/natty.css) et relancer.
   Attributs : ${attributs.join(', ')}. */
(function () {
  'use strict';
  var BALISE = ${JSON.stringify(balise)};
  if (customElements.get(BALISE)) return;
  var CSS = ${JSON.stringify(css)};
  var GABARIT = ${JSON.stringify(gabarit)};
  var DEFAUTS = ${JSON.stringify(defauts)};
  var CATALOGUE_SOURCE = ${usesCatalogue ? JSON.stringify(catalogue) : 'null'};

  function chargerPolices() {
    try {
      if (document.querySelector('link[data-natty-polices]')) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = ${JSON.stringify(POLICES)};
      l.setAttribute('data-natty-polices', '');
      document.head.appendChild(l);
    } catch (e) { /* la pile de secours suffit */ }
  }

  /* Le document que voient les scripts de la page : leurs recherches
     d'éléments visent le composant, le reste est le vrai document. */
  function documentDe(hote, racine) {
    var propre = {
      documentElement: hote,
      getElementById: function (id) { return racine.getElementById(id); },
      querySelector: function (s) { return racine.querySelector(s); },
      querySelectorAll: function (s) { return racine.querySelectorAll(s); }
    };
    return new Proxy(document, {
      get: function (cible, p) {
        if (p === 'activeElement') return racine.activeElement || document.activeElement;
        if (Object.prototype.hasOwnProperty.call(propre, p)) return propre[p];
        var v = Reflect.get(cible, p);
        return typeof v === 'function' ? v.bind(cible) : v;
      }
    });
  }

  function lancer(hote, racine, NATTY_CATALOGUE) {
    var document = documentDe(hote, racine);
    ${code}
  }

  class Composant extends HTMLElement {
    static get observedAttributes() { return ${JSON.stringify(attributs)}; }
    attr(nom) { return this.getAttribute(nom) || DEFAUTS[nom]; }

    connectedCallback() {
      if (this.shadowRoot) return;
      chargerPolices();
      var self = this, racine = this.attachShadow({ mode: 'open' });
      var html = GABARIT.replace(/@@([a-z-]+)@@/g, function (m, k) { return self.attr(k) || ''; });
      racine.innerHTML = '<style>' + CSS + '</style><div class="n-page">' + html + '</div>';

      // Les ancres défilent DANS le composant.
      racine.addEventListener('click', function (e) {
        var a = e.target.closest('a[href^="#"]'); if (!a) return;
        var id = a.getAttribute('href').slice(1);
        var cible = id === 'top' ? self : racine.getElementById(id);
        if (!cible) return;
        e.preventDefault();
        cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      var cat = null;
      if (CATALOGUE_SOURCE) {
        cat = JSON.parse(JSON.stringify(CATALOGUE_SOURCE));
        var base = this.attr('base');
        cat.plats.forEach(function (p) { if (p.photo && !/^https?:/.test(p.photo)) p.photo = base + p.photo; });
      }
      lancer(this, racine, cat);

      // Arrivée par un lien d'une autre page (/#tarifs) : on y descend.
      var h = location.hash && location.hash.slice(1);
      if (h && racine.getElementById(h)) {
        setTimeout(function () { racine.getElementById(h).scrollIntoView({ block: 'start' }); }, 60);
      }
    }
  }
  customElements.define(BALISE, Composant);
})();
`;

  const velo = `// Natty — code Velo de la page qui porte <${balise}>.
// FICHIER GÉNÉRÉ par scripts/build-wix.mjs le ${date}, depuis ${page}.
// À coller dans le code de la page Wix ; l'élément Custom Element doit
// avoir l'ID #nattyPage. seoMarkup donne à Google le texte du composant,
// qu'il ne lit pas dans le Shadow DOM.
const SEO = ${JSON.stringify(seo)};

$w.onReady(function () {
  $w('#nattyPage').seoMarkup = SEO;
});
`;
  return { composant, velo };
}
