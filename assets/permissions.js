/* ═══════════════════════════════════════════════════════════
   Natty — Les autorisations, demandées à la chaîne à la première ouverture
   ───────────────────────────────────────────────────────────
     NattyPermissions.demanderSiPremiereFois()  → le déclencheur
     NattyPermissions.ouvrir()                  → la séquence, à la demande
     NattyPermissions.etats()                   → où l'on en est

   DEMANDE DE PABLO (2026-09-22). « Il faut ajouter le fait que dès que la
   personne vient de s'inscrire ou de se connecter pour la première fois, Natty
   demande directement l'accès à la caméra et à la galerie et à activer les
   notifications, tout d'un coup à la chaîne. »

   ⚠️⚠️ POURQUOI IL A FALLU INSTALLER `@capacitor/camera`. Jusqu'ici l'app
   n'ouvrait la caméra que par `<input type="file" capture="environment">` :
   iOS ne présente alors sa demande qu'au moment où l'on ouvre vraiment
   l'appareil photo, et il n'existe AUCUNE façon de la poser à l'avance depuis
   une WebView. Le plugin n'est utilisé que pour ça — `requestPermissions()` —
   et le parcours d'ajout d'un plat continue de passer par l'`input`, qui marche
   et qu'on ne touche pas.

   ⚠️⚠️ ET CHAQUE DEMANDE EST PRÉCÉDÉE DE SON MOTIF, ÉCRAN PAR ÉCRAN. La
   guideline 5.1.1(ii) d'Apple veut qu'une app demande l'accès aux photos « au
   moment où elle en a besoin » : trois dialogues système enchaînés à
   l'inscription, sans rien dire, est un motif de refus classique en revue. La
   séquence dit donc, avant chaque dialogue, ce que Natty fera de
   l'autorisation — et un refus ne bloque RIEN. C'est aussi la seule forme sous
   laquelle la demande est honnête : on demande la caméra parce qu'on
   photographie des assiettes, et l'écran le montre.

   ⚠️ Hors application native, le module se charge et ne fait rien : `dispo()`
   rend `false`, le déclencheur rend la main. Sur le web il n'y a pas de
   permission à poser d'avance — le navigateur les demande au premier usage.

   Dépend de `assets/core.js`. Utilise `assets/cine.js` et `assets/notifs.js`
   s'ils sont là.
   ═══════════════════════════════════════════════════════════ */
window.NattyPermissions = (function () {
  'use strict';

  var ID = 'nperm';
  var racine = null, feuille = false, scene = null, ouvert = false;
  var S = null;          // { etape, resultats: {camera, photos, notifs} }

  function estNatif() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform
              && window.Capacitor.isNativePlatform());
  }
  function pluginCamera() {
    if (!estNatif()) return null;
    var P = window.Capacitor.Plugins;
    return (P && P.Camera) ? P.Camera : null;
  }
  function dispo() { return !!pluginCamera() || !!(window.NattyNotifs && NattyNotifs.dispo()); }

  function cle(k) { return 'natty_perm_' + k + '_' + ((window.Natty && Natty.USER_ID) || 'anon'); }
  function lire(k, d) { try { var v = localStorage.getItem(cle(k)); return v === null ? d : v; } catch (e) { return d; } }
  function ecrire(k, v) { try { localStorage.setItem(cle(k), String(v)); } catch (e) {} }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Où l'on en est ──────────────────────────────────────────
     'granted' | 'denied' | 'prompt' | 'limited' | 'indispo'.
     ⚠️ `limited` est l'accès partiel aux photos d'iOS 14+ : c'est un OUI, pas
     un peut-être. Le traiter comme un refus ferait redemander indéfiniment une
     autorisation déjà accordée. */
  async function etats() {
    var out = { camera: 'indispo', photos: 'indispo', notifs: 'indispo' };
    var C = pluginCamera();
    if (C) {
      try {
        var r = await C.checkPermissions();
        out.camera = (r && r.camera) || 'prompt';
        out.photos = (r && r.photos) || 'prompt';
      } catch (e) { out.camera = out.photos = 'prompt'; }
    }
    if (window.NattyNotifs && NattyNotifs.dispo()) {
      try { out.notifs = await NattyNotifs.etatPermission(); } catch (e) { out.notifs = 'prompt'; }
    }
    return out;
  }

  function aDemander(e) {
    return ['camera', 'photos', 'notifs'].filter(function (k) { return e[k] === 'prompt'; });
  }

  /* ── Les trois étapes ────────────────────────────────────────
     Chacune porte SON motif, en une phrase qui dit ce que Natty fera de
     l'autorisation — et un exemple, parce qu'une permission se comprend par ce
     qu'elle permet, pas par son nom. */
  var ETAPES = [
    {
      k: 'camera', illu: 'assiette', titre: 'Photographier vos *plats*',
      quoi: 'Natty reconnaît les aliments sur la photo et remplit votre suivi — '
        + 'vous photographiez votre déjeuner, les calories et les macros s’inscrivent.',
      bouton: 'Autoriser l’appareil photo',
      demander: async function () {
        var C = pluginCamera();
        if (!C) return 'indispo';
        try {
          var r = await C.requestPermissions({ permissions: ['camera'] });
          return (r && r.camera) || 'denied';
        } catch (e) { return 'denied'; }
      }
    },
    {
      k: 'photos', illu: 'cible', titre: 'Choisir une photo *déjà prise*',
      quoi: 'Pour ajouter le dîner d’hier soir, ou un ticket de courses que vous '
        + 'avez déjà photographié, sans le reprendre.',
      bouton: 'Autoriser mes photos',
      demander: async function () {
        var C = pluginCamera();
        if (!C) return 'indispo';
        try {
          var r = await C.requestPermissions({ permissions: ['photos'] });
          return (r && r.photos) || 'denied';
        } catch (e) { return 'denied'; }
      }
    },
    {
      k: 'notifs', illu: 'horloge', titre: 'Un *rappel* par jour',
      quoi: 'À midi si vous n’avez rien noté, et le soir pour votre bilan. '
        + 'Rien d’autre — ni publicité, ni relance.',
      bouton: 'Activer les rappels',
      demander: async function () {
        if (!window.NattyNotifs || !NattyNotifs.dispo()) return 'indispo';
        try {
          var r = await NattyNotifs.activer();
          return (r && r.ok) ? 'granted' : (r && r.raison) || 'denied';
        } catch (e) { return 'denied'; }
      }
    }
  ];

  /* ── L'écran ─────────────────────────────────────────────────
     ⚠️ TOUTES LES CLASSES SONT PRÉFIXÉES `np-`. Ce module s'invite sur des
     pages qui ont leur propre feuille : avec des noms courts, `.hero` de
     `suivi.html` (la carte noire des calories) s'appliquerait à mon titre — le
     défaut mesuré sur `assets/macro-guide.js` le même jour. Le pare-feu
     `#id *{margin:0;padding:0}` ne couvre ni `background` ni `border-radius`. */
  var CSS = [
    '#' + ID + '{position:fixed;inset:0;z-index:12200;background:#0b0b0e;color:#f4f4f7;',
    'font-family:Inter,-apple-system,system-ui,sans-serif;display:none;opacity:0;',
    'transition:opacity .28s ease}',
    '#' + ID + '.on{display:block;opacity:1}',
    // Règle 41 : le nœud survit à son fondu, invisible et cliquable.
    '#' + ID + ':not(.on){pointer-events:none}',
    '#' + ID + ' *{margin:0;padding:0;border:0;box-sizing:border-box;background:none;',
    'font-family:inherit;-webkit-tap-highlight-color:transparent}',
    '#' + ID + ' .np-col{height:100%;max-width:480px;margin:0 auto;display:flex;',
    'flex-direction:column;padding:calc(env(safe-area-inset-top) + 20px) 24px 0}',
    '#' + ID + ' .np-pts{display:flex;gap:5px;justify-content:center;flex:0 0 auto}',
    '#' + ID + ' .np-pts i{width:22px;height:3px;border-radius:2px;background:#26272e}',
    '#' + ID + ' .np-pts i.on{background:#f4f4f7}',
    '#' + ID + ' .np-zone{flex:1 1 auto;display:flex;flex-direction:column;',
    'justify-content:center;align-items:center;text-align:center;min-height:0;',
    'overflow-y:auto;overflow-x:hidden}',
    '#' + ID + ' .np-hero{display:flex;justify-content:center;margin-bottom:6px}',
    '#' + ID + ' h1{font-size:30px;font-weight:800;letter-spacing:-1.1px;line-height:1.12;',
    'margin-top:12px}',
    '#' + ID + ' .np-quoi{font-size:14.5px;color:#9a9aa4;line-height:1.55;margin-top:14px;',
    'max-width:320px}',
    /* La liste de l'écran d'ouverture : les trois autorisations annoncées
       d'avance, pour que personne ne découvre le troisième dialogue. */
    '#' + ID + ' .np-liste{margin-top:24px;width:100%;max-width:330px;text-align:left}',
    '#' + ID + ' .np-li{display:flex;align-items:flex-start;gap:12px;margin-bottom:15px}',
    '#' + ID + ' .np-li .np-ic{flex:none;width:36px;height:36px;border-radius:12px;',
    'background:#17181e;display:flex;align-items:center;justify-content:center}',
    '#' + ID + ' .np-li .np-tx{flex:1 1 auto;min-width:0}',
    '#' + ID + ' .np-li b{display:block;font-size:13.5px;font-weight:700}',
    '#' + ID + ' .np-li span{display:block;font-size:12px;color:#8a8a94;margin-top:3px;',
    'line-height:1.45}',
    '#' + ID + ' .np-li u{text-decoration:none;font-size:11px;font-weight:700;flex:none;',
    'margin-top:9px}',
    '#' + ID + ' .np-cta{flex:0 0 auto;padding:16px 0 calc(env(safe-area-inset-bottom) + 18px)}',
    '#' + ID + ' .np-cta button{display:block;width:100%;padding:16px;border-radius:18px;',
    'font-size:15.5px;font-weight:700;cursor:pointer;background:#f4f4f7;color:#0b0b0e}',
    '#' + ID + ' .np-cta button.np-g{background:transparent;color:#8a8a94;font-weight:600;',
    'font-size:13.5px;padding:12px;margin-top:4px}',
    '#' + ID + ' .np-note{font-size:11px;color:#6e6e78;line-height:1.45;margin-top:14px;',
    'max-width:320px}'
  ].join('');

  function css() {
    if (feuille) return;
    feuille = true;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function ill(nom, t) {
    return window.NattyCine
      ? '<div class="np-hero">' + NattyCine.illu(nom, { taille: t || 84, halo: true }) + '</div>'
      : '';
  }
  function icone(nom) {
    return window.NattyCine ? NattyCine.illu(nom, { taille: 20 }) : '';
  }

  /* Ce qui est entre astérisques est mis en avant.
     ⚠️⚠️ ET ÇA MARCHE SUR PLUSIEURS MOTS, contrairement au `titre()` de
     `assets/bilan.js` qui découpe sur les espaces AVANT de chercher le motif.
     Je suis tombé dans ce piège le jour même où je le documentais : « Trois
     accès, *une fois* » s'affichait avec ses astérisques, vu à l'écran. On
     découpe donc sur le MOTIF, pas sur les espaces — chaque morceau reste
     échappé, donc rien de ce qui vient des données ne peut s'injecter ici. */
  function titre(txt) {
    var out = '', reste = String(txt), m;
    var motif = /\*([^*]+)\*/;
    while ((m = motif.exec(reste))) {
      out += esc(reste.slice(0, m.index))
        + '<em style="font-style:normal;background:#f4f4f7;color:#0b0b0e;'
        + 'border-radius:7px;padding:1px 8px;display:inline-block">' + esc(m[1]) + '</em>';
      reste = reste.slice(m.index + m[0].length);
    }
    return '<h1>' + out + esc(reste) + '</h1>';
  }

  function monter() {
    css();
    if (document.getElementById(ID)) { racine = document.getElementById(ID); return; }
    racine = document.createElement('div');
    racine.id = ID;
    racine.innerHTML = '<div class="np-col">'
      + '<div class="np-pts" id="' + ID + 'Pts"></div>'
      + '<div class="np-zone" id="' + ID + 'Zone"></div>'
      + '<div class="np-cta" id="' + ID + 'Cta"></div></div>';
    document.body.appendChild(racine);
  }

  function pastilles(i, n) {
    var p = racine.querySelector('#' + ID + 'Pts');
    var h = '';
    for (var j = 0; j < n; j++) h += '<i' + (j <= i ? ' class="on"' : '') + '></i>';
    p.innerHTML = h;
  }

  function plan(o) {
    var z = racine.querySelector('#' + ID + 'Zone');
    var cta = racine.querySelector('#' + ID + 'Cta');
    var pas = window.NattyCine ? NattyCine.passage(1) : null;
    var vieux = scene;
    if (vieux) {
      if (pas) vieux.classList.add(pas.sortie);
      vieux.style.pointerEvents = 'none';
      setTimeout(function () { if (vieux.parentNode) vieux.parentNode.removeChild(vieux); }, 380);
    }
    var d = document.createElement('div');
    if (pas) d.className = pas.entree;
    d.innerHTML = o.html || '';
    z.appendChild(d);
    scene = d;

    cta.innerHTML = '';
    (o.boutons || []).forEach(function (b) {
      var el = document.createElement('button');
      el.type = 'button';
      if (b.cls) el.className = b.cls;
      el.textContent = b.txt;
      el.addEventListener('click', function () {
        /* ⚠️ L'APPEL AU PLUGIN PART DANS LE GESTE, sans `await` avant lui. iOS
           n'exige cela que pour la caméra ouverte par `input`, mais la règle est
           la même partout dans ce dépôt : un `await` glissé avant une demande
           d'autorisation fait perdre l'activation utilisateur. */
        if (b.bloque) return;
        b.bloque = true;
        el.disabled = true;
        Promise.resolve(b.on()).then(function () { b.bloque = false; });
      });
      cta.appendChild(el);
    });
    if (o.pret) o.pret(d);
    if (window.NattyCine) NattyCine.animer(d, 1000);
    z.scrollTop = 0;
  }

  /* ── Scène 0 : ce qu'on va demander, et pourquoi ──────────── */
  function scIntro(manquantes) {
    pastilles(-1, manquantes.length + 1);
    var parCle = {};
    ETAPES.forEach(function (e) { parCle[e.k] = e; });
    plan({
      html: ill('eclair', 80)
        + titre('Trois accès, *une fois*')
        + '<div class="np-quoi">Natty en a besoin pour faire son travail. '
        + 'Vous pouvez tout refuser : l’app reste utilisable, simplement moins '
        + 'automatique.</div>'
        + '<div class="np-liste">' + manquantes.map(function (k, i) {
            var e = parCle[k];
            return '<div class="np-li" data-c="' + (i + 1) + '">'
              + '<div class="np-ic">' + icone(e.illu) + '</div>'
              + '<div class="np-tx"><b>' + esc(e.titre.replace(/\*/g, '')) + '</b>'
              + '<span>' + esc(e.quoi) + '</span></div></div>';
          }).join('') + '</div>',
      boutons: [
        { txt: 'Commencer', on: function () { S.etape = 0; scEtape(); } },
        { txt: 'Plus tard', cls: 'np-g', on: fermer }
      ]
    });
  }

  /* ── Scènes 1..n : une demande par écran ─────────────────── */
  function scEtape() {
    var manquantes = S.manquantes;
    if (S.etape >= manquantes.length) { scFin(); return; }
    var k = manquantes[S.etape];
    var e = ETAPES.filter(function (x) { return x.k === k; })[0];
    pastilles(S.etape, manquantes.length + 1);

    plan({
      html: ill(e.illu, 84) + titre(e.titre)
        + '<div class="np-quoi">' + esc(e.quoi) + '</div>'
        + '<div class="np-note">La demande du téléphone s’affiche juste après. '
        + 'Un refus ne bloque rien — vous pourrez revenir dessus dans les '
        + 'réglages de votre téléphone.</div>',
      boutons: [
        { txt: e.bouton, on: async function () {
            var r = await e.demander();
            S.resultats[k] = r;
            S.etape++;
            scEtape();
          } },
        { txt: 'Passer', cls: 'np-g', on: function () {
            S.resultats[k] = 'passe';
            S.etape++;
            scEtape();
          } }
      ]
    });
  }

  /* ── Dernière scène : ce qui a été accordé ────────────────── */
  function scFin() {
    pastilles(S.manquantes.length, S.manquantes.length + 1);
    var oui = [], non = [];
    S.manquantes.forEach(function (k) {
      var e = ETAPES.filter(function (x) { return x.k === k; })[0];
      var nom = e.titre.replace(/\*/g, '').toLowerCase();
      var r = S.resultats[k];
      (r === 'granted' || r === 'limited' ? oui : non).push(nom);
    });
    /* ⚠️ On dit ce qui a été REFUSÉ, sans insister. Une séquence qui se termine
       en félicitant quand rien n'a été accordé sonne faux ; une séquence qui
       redemande fait exactement ce qu'un refus interdit. */
    plan({
      html: (oui.length ? ill('coeur', 78) : ill('question', 78))
        + titre(oui.length ? 'C’est *prêt*' : 'Très *bien*')
        + '<div class="np-quoi">'
        + (oui.length
            ? 'Vous pouvez photographier votre premier plat.'
            : 'Rien n’a été activé, et c’est votre droit. Vous pourrez toujours '
              + 'saisir vos repas à la main.')
        + '</div>'
        + (non.length
            ? '<div class="np-note">Non accordé : ' + esc(non.join(', '))
              + '. Cela se change dans les réglages de votre téléphone, à la '
              + 'rubrique Natty.</div>'
            : ''),
      boutons: [{ txt: 'Entrer dans Natty', on: fermer }]
    });
  }

  function fermer() {
    if (!racine) return;
    ouvert = false;
    ecrire('vu', '1');
    racine.classList.remove('on');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (ouvert || !racine) return;
      racine.querySelector('#' + ID + 'Zone').innerHTML = '';
      racine.querySelector('#' + ID + 'Cta').innerHTML = '';
      scene = null;
    }, 320);
  }

  /**
   * La séquence, à la demande.
   * @returns {Promise<boolean>} false si elle n'a rien à demander.
   */
  async function ouvrir() {
    if (!dispo()) return false;
    var e = await etats();
    var manquantes = aDemander(e);
    /* Rien en attente : tout est déjà accordé ou déjà refusé. Ouvrir un écran
       pour l'annoncer serait une étape de plus qui n'apporte rien — et
       redemander une autorisation refusée est précisément ce qu'iOS interdit
       (le dialogue ne s'affiche plus, donc le bouton ne ferait rien). */
    if (!manquantes.length) { ecrire('vu', '1'); return false; }
    monter();
    S = { etape: -1, manquantes: manquantes, resultats: {} };
    ouvert = true;
    racine.classList.add('on');
    document.body.style.overflow = 'hidden';   // jamais position:fixed (scroll iOS)
    scIntro(manquantes);
    return true;
  }

  /* ── Le déclencheur ──────────────────────────────────────────
     À la PREMIÈRE ouverture après inscription ou connexion.

     ⚠️ IL PASSE AVANT TOUS LES AUTRES PLEIN ÉCRAN, et c'est pour ça qu'il est
     armé à 1,2 s : la planification de la semaine attend 5 s, le guide du jour
     6,5 s, le bilan 9 s et le programme des séances 11 s. Comme `nperm` est
     dans `PLEIN_ECRAN` d'`assets/core.js`, tous les quatre le voient et se
     taisent — sans cette entrée, un guide plein écran viendrait se poser en
     plein milieu d'un dialogue système.

     ⚠️ Et il ne s'arme QUE s'il y a quelque chose à demander : `ouvrir()`
     regarde l'état réel des trois permissions avant de monter quoi que ce soit.
     Le drapeau `vu` n'est qu'un raccourci pour éviter la lecture.
  */
  function demanderSiPremiereFois() {
    if (!dispo()) return;
    if (lire('vu', '0') === '1') return;
    if (!window.Natty || !Natty.USER_ID) return;    // pas encore de session
    setTimeout(function () {
      if (window.Natty && Natty.ecranOccupe && Natty.ecranOccupe()) return;
      if (window.NattyGeneration && NattyGeneration.enCours && NattyGeneration.enCours()) return;
      ouvrir();
    }, 1200);
  }

  return {
    dispo: dispo, etats: etats, ouvrir: ouvrir, fermer: fermer,
    demanderSiPremiereFois: demanderSiPremiereFois,
    estOuvert: function () { return !!ouvert; },
    /* Pour les bancs : les étapes et leur ordre, sans l'écran. */
    _ETAPES: ETAPES, _aDemander: aDemander
  };
})();
