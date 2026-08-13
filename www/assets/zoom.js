/* ═══════════════════════════════════════════════════════════
   Natty — Pas de zoom, nulle part
   ───────────────────────────────────────────────────────────
   Chargé en SYNCHRONE dans le <head> de tous les écrans de l'app. N'expose
   rien, ne dépend de rien : il pose trois verrous et se tait.

   ⚠️⚠️ LE `user-scalable=no` DU <meta viewport> NE SUFFIT PAS, ET C'EST TOUT LE
   SUJET. iOS l'IGNORE délibérément depuis la version 10 — Safari comme
   WKWebView, donc l'app Capacitor aussi — au nom de l'accessibilité. Les
   `maximum-scale=1.0, user-scalable=no` étaient pourtant déjà présents sur
   presque toutes les pages : ils n'ont jamais empêché quoi que ce soit sur
   iPhone. Le commentaire d'`assets/style.css` affirmait même le contraire
   (« suffit à la pincée »), ce qui explique que le problème ait survécu à une
   première passe. Ce qui marche vraiment, c'est `touch-action`.

   LES TROIS VERROUS, et ce que chacun arrête :
   1. `touch-action:pan-x pan-y` sur <html> et <body> → la pincée ET le
      double-tap. Toute valeur autre que `auto`/`manipulation` désarme le
      double-tap ; `pan-x pan-y` retire en plus la pincée, alors que
      `manipulation` (ce qu'il y avait) la laissait passer. Le défilement, lui,
      reste intact — c'est précisément ce que `pan-x`/`pan-y` autorisent.
   2. `gesturestart` / `gesturechange` / `gestureend` → la pincée de WebKit, qui
      passe par ces événements propriétaires. Ceinture et bretelles : sur
      certaines versions, un geste commencé sur un élément qui a son propre
      `touch-action` remonte quand même jusqu'au document.
   3. `-webkit-text-size-adjust:100%` → l'autre zoom, celui que WebKit applique
      tout seul au texte quand il juge une colonne trop étroite.

   ⚠️ `!important`, ET C'EST DÉLIBÉRÉ. Ce module s'injecte depuis le <head>,
   donc AVANT les `<link rel="stylesheet">` qui suivent : sans lui, le
   `body{touch-action:manipulation}` d'`assets/style.css` (même spécificité,
   déclaré plus tard) l'emporterait et la pincée reviendrait. Il ne porte que
   sur `html` et `body` : les éléments qui ont besoin d'un `touch-action` plus
   strict pour être glissés — les cartes de `narration.html`, les jeux
   d'`assets/minijeux.js`, les jalons d'`assets/journee.js` — ont des sélecteurs
   plus spécifiques et ne sont pas touchés. Vérifié : leurs glissements
   continuent de fonctionner.

   ⚠️ CE QUI N'EST PAS BLOQUÉ, ET POURQUOI : le zoom du NAVIGATEUR (Ctrl +/−,
   Ctrl + molette) sur la version web. Ce n'est pas un geste dans la page mais un
   réglage de l'utilisateur, et le retirer casserait l'accessibilité sur ordinateur
   sans rien apporter à l'app — où il n'y a ni clavier ni molette.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 1. Le <meta viewport> ────────────────────────────────
     Il ne suffit pas (voir l'en-tête) mais il n'est pas inutile : Android le
     respecte, et le web aussi. On le normalise ICI plutôt que page par page,
     pour qu'un écran ne puisse pas diverger — c'est exactement ce qui était
     arrivé à `www/index.html`, le point d'entrée du bundle natif, qui était
     l'une des rares pages à ne PAS le porter. */
  /* ⚠️ NE JAMAIS EN CRÉER UN SECOND. Ce script tourne pendant l'analyse du
     <head> : si la balise est déclarée APRÈS lui, elle n'existe pas encore, et
     en ajouter une donnerait DEUX `meta[name=viewport]` — dont c'est la dernière
     qui gagne, soit celle qu'on voulait corriger. On corrige donc ce qui est là,
     et on repasse au chargement complet pour le reste. */
  function viewport(creer) {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      if (!creer) return;
      m = document.createElement('meta');
      m.setAttribute('name', 'viewport');
      m.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
      document.head.appendChild(m);
    }
    var c = m.getAttribute('content') || '';
    if (!/maximum-scale/.test(c)) c += ', maximum-scale=1.0';
    if (!/user-scalable/.test(c)) c += ', user-scalable=no';
    m.setAttribute('content', c);
  }

  /* ── 2. Le verrou qui compte ──────────────────────────────── */
  function css() {
    if (document.getElementById('nzoom-css')) return;
    var s = document.createElement('style');
    s.id = 'nzoom-css';
    s.textContent =
      'html,body{touch-action:pan-x pan-y !important;'
      + '-webkit-text-size-adjust:100%;text-size-adjust:100%}';
    document.head.appendChild(s);
  }

  /* ── 3. La pincée WebKit ──────────────────────────────────
     `passive:false` est obligatoire : sans lui le navigateur suppose qu'on ne
     préviendra pas, et `preventDefault()` n'a plus aucun effet. */
  function gestes() {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
      document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false });
    });
  }

  viewport(false);
  css();
  gestes();

  // Deuxième passage : la balise a pu être déclarée après ce script, et une
  // page peut ne pas en avoir du tout.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { viewport(true); });
  } else {
    viewport(true);
  }
})();
