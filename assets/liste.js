/* ═══════════════════════════════════════════════════════════
   Natty — Liste de courses : cocher, masquer, copier
   ───────────────────────────────────────────────────────────
     NattyListe.monter(el, items, opts)   → rend la liste et la branche
     NattyListe.copier(texte)             → presse-papiers, avec repli

   `items` : [{em, nom, qte}]     `opts` : {cle, titre, sousTitre}

   POURQUOI. La liste ne servait qu'à cocher. Or on ne cuisine pas avec son
   téléphone dans un supermarché : on recopie sa liste dans les Notes, dans
   un message à quelqu'un, dans le champ de recherche d'un site de courses.
   D'où deux gestes qui manquaient :

     • MASQUER ce qui est déjà pris — une liste de 20 lignes dont 15 barrées
       ne se lit plus ;
     • COPIER, et copier exactement ce qui est AFFICHÉ. Les deux boutons se
       tiennent : masquer les pris puis copier donne « ce qu'il reste à
       acheter » sans avoir à inventer un troisième réglage.

   L'envoi par email a été abandonné au profit de ça (2026-08-04) : il
   dépendait d'une clé Resend et d'un domaine vérifié, pour un résultat que
   l'utilisateur ne contrôlait pas. Le presse-papiers ne dépend de rien.

   `cle` est fournie par l'appelant plutôt que fabriquée ici : coaching.html
   avait déjà sa clé hebdomadaire remplie de cases cochées, la changer aurait
   effacé les listes en cours.

   Aucune dépendance. CSS injecté une fois, tout préfixé `nl-`.
   ═══════════════════════════════════════════════════════════ */

window.NattyListe = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── 1. Presse-papiers ────────────────────────────────────
     `navigator.clipboard` exige un contexte sécurisé. C'est vrai en https et
     dans la WebView Capacitor (capacitor:// et http://localhost le sont
     tous deux), mais faux dès qu'une page est ouverte en file:// — cas d'un
     test local. Le repli textarea+execCommand est déprécié et fonctionne
     partout : c'est exactement ce qu'on veut d'un repli. */

  function copier(texte) {
    if (!texte) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texte)
        .then(function () { return true; })
        .catch(function () { return vieilleCopie(texte); });
    }
    return Promise.resolve(vieilleCopie(texte));
  }

  function vieilleCopie(texte) {
    try {
      var ta = document.createElement('textarea');
      ta.value = texte;
      ta.setAttribute('readonly', '');
      // Hors écran mais dans le flux : un élément en display:none n'est pas
      // sélectionnable, donc rien ne serait copié.
      ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* ── 2. CSS ───────────────────────────────────────────────*/

  var CSS_POSE = false;
  function poserCss() {
    if (CSS_POSE) return;
    CSS_POSE = true;
    var st = document.createElement('style');
    st.id = 'nlCss';
    st.textContent = [
      '.nl-bar{display:flex;align-items:center;gap:7px;margin:0 0 10px;flex-wrap:wrap}',
      '.nl-count{font-size:11px;color:var(--muted,#9d9da8);margin-right:auto;font-weight:600}',
      '.nl-btn{border:0;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:800;',
      'padding:8px 13px;border-radius:var(--r-full,999px);background:var(--card,#ececef);color:var(--ink,#101014)}',
      '.nl-btn.pri{background:var(--ink,#101014);color:#fff}',
      '.nl-btn[disabled]{opacity:.4;cursor:default}',
      '.nl-wrap{background:var(--card,#ececef);border-radius:var(--r-lg,24px);overflow:hidden}',
      '.nl-item{display:flex;align-items:center;gap:11px;padding:12px 13px 12px 15px;',
      'border-bottom:1px solid rgba(0,0,0,.05)}',
      '.nl-item:last-child{border-bottom:none}',
      '.nl-item.cache{display:none}',
      '.nl-tap{display:flex;align-items:center;gap:11px;flex:1;min-width:0;cursor:pointer;background:none;',
      'border:0;padding:0;font-family:inherit;text-align:left;color:inherit}',
      '.nl-em{font-size:20px;line-height:1;flex-shrink:0}',
      '.nl-nom{flex:1;font-size:14px;font-weight:700;line-height:1.3;color:var(--ink,#101014);',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nl-qte{font-size:12px;font-weight:700;color:var(--muted,#9d9da8);flex-shrink:0}',
      '.nl-box{width:21px;height:21px;border-radius:50%;border:2px solid #d3d3d8;flex-shrink:0;',
      'display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff}',
      '.nl-item.done .nl-box{background:var(--green,#34c759);border-color:var(--green,#34c759)}',
      '.nl-item.done .nl-nom,.nl-item.done .nl-qte{text-decoration:line-through;opacity:.45}',
      '.nl-cp{width:30px;height:30px;flex-shrink:0;border:0;cursor:pointer;background:none;border-radius:50%;',
      'color:#a8a8b2;font-family:inherit;display:flex;align-items:center;justify-content:center}',
      '.nl-cp:active{background:rgba(0,0,0,.06);color:var(--ink,#101014)}',
      '.nl-cp svg{width:15px;height:15px;display:block}',
      '.nl-vide{padding:18px 15px;font-size:13px;color:var(--muted,#9d9da8);text-align:center}',
      '#nlToast{position:fixed;left:50%;transform:translateX(-50%) translateY(14px);bottom:96px;z-index:13000;',
      'background:var(--ink,#101014);color:#fff;font-size:13px;font-weight:700;padding:11px 17px;',
      'border-radius:var(--r-full,999px);opacity:0;pointer-events:none;transition:opacity .22s,transform .22s;',
      'max-width:86vw;text-align:center;font-family:inherit}',
      '#nlToast.on{opacity:1;transform:translateX(-50%) translateY(0)}'
    ].join('');
    document.head.appendChild(st);
  }

  var ICONE_COPIE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6.5A2.5 2.5 0 0 0 4 5.5v6A2.5 2.5 0 0 0 6.5 14"/></svg>';

  function toast(msg) {
    poserCss();
    var t = document.getElementById('nlToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'nlToast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    clearTimeout(t._h1); clearTimeout(t._h2);
    t._h1 = setTimeout(function () { t.classList.add('on'); }, 10);
    t._h2 = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* ── 3. Rendu ─────────────────────────────────────────────*/

  function ligneTexte(it) {
    return '• ' + it.nom + (it.qte ? ' — ' + it.qte : '');
  }

  /**
   * Rend la liste dans `el` et branche tous les gestes.
   * @param {Element} el
   * @param {Array}   items [{em, nom, qte}]
   * @param {Object}  [opts] {cle, titre, sousTitre}
   * @returns {Object} {rafraichir(), texte(), coches()}
   */
  function monter(el, items, opts) {
    if (!el) return null;
    poserCss();
    opts = opts || {};
    items = items || [];
    var cle = opts.cle || null;
    var masque = false;          // « masquer les pris » — volontairement non
                                 // persisté : c'est un geste de lecture, pas
                                 // un réglage. On rouvre toujours la liste
                                 // complète, sinon on croit avoir tout acheté.

    function lus() {
      if (!cle) return [];
      try { return JSON.parse(localStorage.getItem(cle) || '[]'); } catch (e) { return []; }
    }
    function ecrire(l) {
      if (!cle) return;
      try { localStorage.setItem(cle, JSON.stringify(l)); } catch (e) {}
    }

    if (!items.length) {
      el.innerHTML = '<div class="nl-wrap"><div class="nl-vide">'
        + esc(opts.vide || 'Rien à afficher pour le moment.') + '</div></div>';
      return null;
    }

    el.innerHTML =
      '<div class="nl-bar">'
      + '<span class="nl-count" data-nl="count"></span>'
      + '<button class="nl-btn" data-nl="masquer"></button>'
      + '<button class="nl-btn" data-nl="reset">Tout décocher</button>'
      + '<button class="nl-btn pri" data-nl="copier">Copier</button>'
      + '</div>'
      + '<div class="nl-wrap" data-nl="wrap">'
      + items.map(function (it, i) {
          return '<div class="nl-item" data-i="' + i + '">'
            + '<button class="nl-tap" type="button">'
              + '<span class="nl-em">' + esc(it.em || '🥄') + '</span>'
              + '<span class="nl-nom">' + esc(it.nom) + '</span>'
              + (it.qte ? '<span class="nl-qte">' + esc(it.qte) + '</span>' : '')
              + '<span class="nl-box">✓</span>'
            + '</button>'
            + '<button class="nl-cp" type="button" aria-label="Copier cette ligne">' + ICONE_COPIE + '</button>'
            + '</div>';
        }).join('')
      + '</div>';

    var lignes = [].slice.call(el.querySelectorAll('.nl-item'));
    var bMasquer = el.querySelector('[data-nl="masquer"]');
    var bReset = el.querySelector('[data-nl="reset"]');
    var bCopier = el.querySelector('[data-nl="copier"]');
    var elCount = el.querySelector('[data-nl="count"]');

    function estPris(i) { return lus().indexOf(items[i].nom) >= 0; }

    function visibles() {
      return lignes.filter(function (l) { return !l.classList.contains('cache'); })
        .map(function (l) { return items[+l.dataset.i]; });
    }

    function texte() {
      var v = visibles();
      var entete = (opts.titre || 'Liste de courses')
        + (opts.sousTitre ? ' — ' + opts.sousTitre : '');
      return entete + '\n' + v.map(ligneTexte).join('\n');
    }

    function peindre() {
      var pris = 0;
      lignes.forEach(function (l) {
        var i = +l.dataset.i, p = estPris(i);
        if (p) pris++;
        l.classList.toggle('done', p);
        l.classList.toggle('cache', masque && p);
      });
      var reste = items.length - pris;
      elCount.textContent = items.length + ' ingrédient' + (items.length > 1 ? 's' : '')
        + (pris ? ' · ' + pris + ' pris' : '');
      bMasquer.textContent = masque ? 'Tout afficher' : 'Masquer les pris';
      bMasquer.disabled = !pris && !masque;
      bReset.disabled = !pris;
      bReset.style.display = pris ? '' : 'none';
      // Le libellé dit ce qui sera copié, plutôt que de laisser deviner :
      // c'est ce qui rend le couple masquer/copier compréhensible sans mode
      // d'emploi.
      bCopier.textContent = masque && reste ? 'Copier les ' + reste + ' restants' : 'Copier';
    }

    lignes.forEach(function (l) {
      var i = +l.dataset.i;
      l.querySelector('.nl-tap').addEventListener('click', function () {
        var liste = lus(), pos = liste.indexOf(items[i].nom);
        if (pos >= 0) liste.splice(pos, 1); else liste.push(items[i].nom);
        ecrire(liste);
        peindre();
      });
      l.querySelector('.nl-cp').addEventListener('click', function (ev) {
        ev.stopPropagation();
        copier(ligneTexte(items[i]).replace(/^• /, '')).then(function (ok) {
          toast(ok ? '📋 ' + items[i].nom + ' copié' : 'Copie impossible sur cet appareil');
        });
      });
    });

    bMasquer.addEventListener('click', function () { masque = !masque; peindre(); });

    bReset.addEventListener('click', function () { ecrire([]); peindre(); });

    bCopier.addEventListener('click', function () {
      var n = visibles().length;
      if (!n) { toast('Rien à copier — tout est pris'); return; }
      copier(texte()).then(function (ok) {
        toast(ok ? '📋 ' + n + ' ligne' + (n > 1 ? 's' : '') + ' copiée' + (n > 1 ? 's' : '')
                 : 'Copie impossible sur cet appareil');
      });
    });

    peindre();
    return { rafraichir: peindre, texte: texte, coches: lus };
  }

  return { monter: monter, copier: copier, toast: toast };
})();
