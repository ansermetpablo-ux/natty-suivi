/* ═══════════════════════════════════════════════════════════
   Natty — Thème clair / sombre

   CE FICHIER SE CHARGE DANS LE <head>, DE FAÇON SYNCHRONE, et c'est
   la seule chose qui compte ici : `assets/core.js` est chargé en fin
   de <body>, donc trop tard. Un thème posé après le premier rendu
   donne un éclair blanc à chaque changement d'écran — sur une app
   plein écran, l'effet est celui d'un flash, pas d'une transition.

   Trois états, pas deux :
     'auto'   suit le réglage du téléphone (défaut, tant qu'on n'a rien touché)
     'clair'
     'sombre'
   L'interrupteur des réglages n'en montre que deux — c'est voulu :
   il affiche ce qui est À L'ÉCRAN maintenant, et le premier geste
   fige le choix. Tant que personne n'y touche, l'app suit l'appareil.

   La préférence vit en localStorage, DONC par appareil, et c'est le bon
   endroit : un thème est un réglage d'affichage, pas une donnée de compte.
   Le stocker en base le ferait voyager d'un téléphone à l'autre, alors
   que l'écran, la luminosité et l'heure d'usage, eux, ne voyagent pas.

   L'attribut est posé sur <html> (`data-theme="dark"|"light"`), jamais
   sur <body> : <html> est peint avant que <body> n'existe.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CLE = 'natty_theme';
  var FONDS = { light: '#ffffff', dark: '#0e0e11' };

  function lire() {
    try { var v = localStorage.getItem(CLE); return (v === 'clair' || v === 'sombre') ? v : 'auto'; }
    catch (e) { return 'auto'; }
  }

  function mq() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')) || null;
  }

  function systemeSombre() { var m = mq(); return !!(m && m.matches); }

  /* Ce qui est réellement affiché : 'clair' ou 'sombre', jamais 'auto'. */
  function effectif(pref) {
    var p = pref || lire();
    if (p === 'auto') return systemeSombre() ? 'sombre' : 'clair';
    return p;
  }

  /* La barre d'état d'iOS et la barre système d'Android se colorent depuis
     <meta name="theme-color">. Sans cette mise à jour, l'app passe en sombre
     et garde un bandeau blanc en haut — c'est la première chose qu'on voit. */
  function majMeta(eff) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'theme-color');
      (document.head || document.documentElement).appendChild(m);
    }
    m.setAttribute('content', eff === 'sombre' ? FONDS.dark : FONDS.light);
  }

  function appliquer(silencieux) {
    var eff = effectif();
    var el = document.documentElement;
    el.setAttribute('data-theme', eff === 'sombre' ? 'dark' : 'light');
    // Fait basculer les contrôles natifs (champs, sélecteurs, barres de
    // défilement) en même temps que le reste. Sans lui, un <select> reste
    // blanc au milieu d'un écran sombre.
    el.style.colorScheme = eff === 'sombre' ? 'dark' : 'light';
    majMeta(eff);
    if (!silencieux && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('natty:theme', {
        detail: { theme: eff, preference: lire() }
      }));
    }
    return eff;
  }

  function definir(pref) {
    if (pref !== 'clair' && pref !== 'sombre') pref = 'auto';
    try {
      if (pref === 'auto') localStorage.removeItem(CLE);
      else localStorage.setItem(CLE, pref);
    } catch (e) { /* navigation privée : le thème vaut pour cette page, c'est tout */ }
    return appliquer();
  }

  /* En 'auto', on suit l'appareil EN DIRECT : bascule programmée au coucher
     du soleil, réglage changé depuis le centre de contrôle pendant que l'app
     est ouverte. Sans cet écouteur il faudrait relancer l'app pour le voir. */
  var m = mq();
  if (m) {
    var suivre = function () { if (lire() === 'auto') appliquer(); };
    if (m.addEventListener) m.addEventListener('change', suivre);
    else if (m.addListener) m.addListener(suivre);
  }

  /* ── Jetons pour les modules injectés ────────────────────────
     `assets/style.css` porte --bg / --card / --ink…, mais tous les écrans
     ne la chargent pas : `suivi.html` a son propre jeu de variables, plus
     ancien, où --bg ne vaut pas la même chose. Un module partagé (nav,
     ajout, génération, planning…) s'invite sur les deux — il lui faut donc
     des jetons à lui, définis ici, valables partout et qui n'entrent en
     collision avec rien. D'où le préfixe.

     La feuille est écrite par JS et non dans un .css : theme.js est le seul
     fichier que TOUTES les pages chargent, y compris celles qui n'ont pas
     de feuille partagée. */
  function socle() {
    if (document.getElementById('natty-theme-css')) return;
    var s = document.createElement('style');
    s.id = 'natty-theme-css';
    s.textContent =
      ':root{--nt-bg:#ffffff;--nt-card:#ececef;--nt-ink:#101014;--nt-on-ink:#ffffff;' +
        '--nt-muted:#9a9aaa;--nt-line:#e8e8ee;--nt-ombre:rgba(20,20,30,.14);' +
        '--nt-voile:rgba(20,20,30,.42)}' +
      ':root[data-theme="dark"]{--nt-bg:#0e0e11;--nt-card:#1c1c22;--nt-ink:#f4f4f7;' +
        '--nt-on-ink:#0e0e11;--nt-muted:#8e8e99;--nt-line:#2a2a32;--nt-ombre:rgba(0,0,0,.6);' +
        '--nt-voile:rgba(0,0,0,.62)}';
    (document.head || document.documentElement).appendChild(s);
  }

  if (document.head) socle();
  else document.addEventListener('DOMContentLoaded', socle);

  appliquer(true);

  window.NattyTheme = {
    /* 'auto' | 'clair' | 'sombre' — ce qui est enregistré */
    preference: lire,
    /* 'clair' | 'sombre' — ce qui est affiché */
    actuel: function () { return effectif(); },
    sombre: function () { return effectif() === 'sombre'; },
    definir: definir,
    basculer: function () { return definir(effectif() === 'sombre' ? 'clair' : 'sombre'); },
    appliquer: appliquer
  };
})();
