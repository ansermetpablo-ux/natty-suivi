/* ═══════════════════════════════════════════════════════════
   Natty — Rappels quotidiens (notifications locales)
   ───────────────────────────────────────────────────────────
   Le rappel du parcours : « ton palier du jour t'attend ». C'est ce qui
   donne son sens à la pastille rouge quotidienne d'assets/nav.js — sans
   rappel, personne ne revient voir la pastille.

   ⚠️ NOTIFICATIONS **LOCALES**, pas push. Tout est planifié sur l'appareil,
   donc : aucune clé Apple, aucun serveur, aucune table de tokens. En
   contrepartie le texte est figé au moment où on planifie — impossible d'y
   mettre « il te reste 40 g de protéines », qui exige un calcul à l'envoi.
   Ces rappels-là relèvent du push serveur, chantier séparé.

   Conséquence de conception : plutôt qu'une répétition `on:{hour,minute}`
   (un seul texte, ad vitam), on planifie **les 7 prochains jours** un par un,
   avec un texte différent chacun, et on replanifie à chaque ouverture de
   l'app. Le rappel du jour est sauté si l'onglet Défis a déjà été ouvert
   aujourd'hui — même clé que la pastille de nav.js, donc jamais de rappel
   pour quelque chose qui est déjà fait.

   Hors application native (navigateur, iframe Wix), le module se charge sans
   rien faire : `dispo()` renvoie false et toutes les actions sont des no-op.
   ═══════════════════════════════════════════════════════════ */
var NattyNotifs = (function () {

  /* Android : le plugin déclare lui-même POST_NOTIFICATIONS, rien à ajouter au
     manifeste. On ne demande volontairement PAS SCHEDULE_EXACT_ALARM — une
     alarme exacte se justifie pour un réveil, pas pour un rappel de parcours,
     et Google la scrute en review. Sans elle le plugin retombe tout seul sur
     une alarme approchée (setAndAllowWhileIdle) : le rappel part dans la
     fenêtre de l'heure choisie plutôt qu'à la minute près. */

  var CANAL   = 'natty-rappels';
  var ID_BASE = 4100;        // ids 4101..4107, un par jour planifié
  var JOURS    = 7;          // horizon de planification
  var H_DEFAUT = 19;         // 19 h 00, avant le repas du soir

  /* ── Le rappel de MIDI (demande de Pablo, 2026-08-05) ────────
     Un second rendez-vous, indépendant du rappel du parcours : celui-ci parle du
     SUIVI, pas des défis. Il a donc ses propres ids (4201..4207) — sans quoi
     « tout annuler puis tout replanifier » effacerait l'un en posant l'autre —
     et une heure FIXE : midi est le moment où l'on a déjeuné sans forcément
     l'avoir noté, et ce n'est pas un réglage à ajouter aux réglages.
     Il mène à `suivi.html`, où vit le bouton `+`. */
  var ID_MIDI = 4200;        // ids 4201..4207
  var H_MIDI  = 12;
  var TEXTE_MIDI = {
    t: 'Vos performances',
    b: 'Ajoutez votre premier plat de la journée'
  };

  /* ── Le rappel du SOIR : le bilan (demande de Pablo, 2026-09-02) ──
     « Brancher le bilan sur les notifications, pour qu'il réclame la séance le
     soir sans qu'on ouvre l'app. » C'est le manque le plus visible du bilan :
     il ne s'ouvre QUE si l'on ouvre l'app après 21 h, or c'est justement
     l'heure où on ne l'ouvre pas.

     ⚠️ TROISIÈME SÉRIE D'IDS, ET `annuler()` DOIT LA CONNAÎTRE. Le piège est
     déjà documenté pour midi : « tout annuler puis tout replanifier » ne
     protège que ce qu'il connaît, et une série oubliée s'empile silencieusement
     à chaque ouverture de l'app.
     ⚠️ Heure FIXE, comme midi, et volontairement 21 h 15 : c'est l'heure à
     partir de laquelle `assets/bilan.js` accepte de s'ouvrir (`H_BILAN`), et un
     rappel qui arrive avant mènerait à un écran qui refuse de se montrer. */
  var ID_BILAN = 4300;       // ids 4301..4307
  var H_BILAN  = 21, M_BILAN = 15;
  var TEXTE_BILAN = {
    t: 'Votre bilan du soir',
    b: 'Deux minutes : votre journée, votre séance, et ce que votre corps en a fait.'
  };

  function user() { return (window.Natty && Natty.USER_ID) ? Natty.USER_ID : 'anon'; }
  function cle(k) { return 'natty_notif_' + k + '_' + user(); }

  function lire(k, def) {
    try { var v = localStorage.getItem(cle(k)); return v === null ? def : v; }
    catch (e) { return def; }
  }
  function ecrire(k, v) { try { localStorage.setItem(cle(k), String(v)); } catch (e) {} }

  /* ── Disponibilité ───────────────────────────────────────── */

  function estNatif() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    if (!estNatif()) return null;
    var P = window.Capacitor.Plugins;
    return (P && P.LocalNotifications) ? P.LocalNotifications : null;
  }

  function dispo() { return !!plugin(); }

  /* 'granted' | 'denied' | 'prompt' | 'indispo' — 'prompt' couvre aussi
     'prompt-with-rationale' d'Android : dans les deux cas on peut demander. */
  async function etatPermission() {
    var LN = plugin();
    if (!LN) return 'indispo';
    try {
      var r = await LN.checkPermissions();
      var d = r && r.display;
      if (d === 'granted' || d === 'denied') return d;
      return 'prompt';
    } catch (e) { return 'indispo'; }
  }

  /* ── Préférence locale ───────────────────────────────────────
     Volontairement locale : un rappel est planifié sur CET appareil, une
     synchronisation en base laisserait croire qu'il suit l'utilisateur
     d'un téléphone à l'autre — ce que des notifications locales ne font
     pas. Même raisonnement que le nombre de repas de repas.html. */

  function activee() { return lire('actif', '0') === '1'; }

  function heure() {
    var h = parseInt(lire('heure', String(H_DEFAUT)), 10);
    return (h >= 0 && h <= 23) ? h : H_DEFAUT;
  }

  /* ── Textes ──────────────────────────────────────────────────
     Un texte par jour de l'horizon, pour que sept jours d'affilée ne
     répètent pas la même phrase. L'index tourne avec le jour planifié,
     pas avec la position dans la file : replanifier ne remet pas la
     rotation à zéro le lendemain. */
  var TEXTES = [
    { t: 'Ton palier du jour t\'attend 🍳',  b: 'Cinq minutes suffisent pour avancer dans le parcours.' },
    { t: 'On continue ? 🎯',                 b: 'Le prochain chapitre est débloqué, il n\'attend que toi.' },
    { t: 'Ta série est en jeu 🔥',           b: 'Reprends le parcours avant la fin de la journée.' },
    { t: 'Deux minutes pour apprendre 🧠',   b: 'Un mini-jeu, une notion de plus. C\'est tout.' },
    { t: 'Ton parcours t\'attend 🥑',        b: 'Tu étais bien lancé — ne casse pas l\'élan.' },
    { t: 'Nouvelle épreuve du jour 🏅',      b: 'Viens décrocher l\'XP de la journée.' },
    { t: 'Encore un palier 🌟',              b: 'Chaque jour compte : ouvre Natty deux minutes.' }
  ];

  /* ── Dates ───────────────────────────────────────────────────
     jourCle() partage exactement le format de nav.js (AAAA-MM-JJ en heure
     locale) : c'est ce qui permet de savoir si l'onglet Défis a été ouvert
     aujourd'hui sans dupliquer la logique de la pastille. */

  function jourCle(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  function defisVuAujourdhui() {
    // NattyNav est exposé par assets/nav.js ; s'il n'est pas là (page sans
    // nav), on considère que rien n'a été vu — un rappel de trop vaut mieux
    // qu'un rappel manquant.
    if (window.NattyNav && typeof NattyNav.vuAujourdhui === 'function') {
      return NattyNav.vuAujourdhui('defis');
    }
    return false;
  }

  /* ⚠️ Le pendant de `defisVuAujourdhui()` pour le rappel de midi : « ajoutez
     votre premier plat » ne doit pas partir à quelqu'un qui a déjà déjeuné. Le
     marqueur est écrit par `assets/ajout.js` à l'enregistrement — c'est le seul
     instant où l'information existe, une notification locale portant un texte
     figé dès la planification.
     Il vaut `false` par défaut : un rappel de trop vaut mieux qu'un rappel
     manquant, comme pour les défis. */
  function repasAujourdhui() {
    try {
      return localStorage.getItem('natty_dernier_repas_' + user()) === jourCle(new Date());
    } catch (e) { return false; }
  }

  /* ⚠️ LA MÊME CLÉ QUE `assets/bilan.js`, au caractère près (`cle('vu')` y vaut
     `natty_bilan_vu_<uid>`). C'est ce qui relie les deux : le bilan écrit qu'il
     a été fait, le rappel ne part pas. Une clé recopiée de travers ne se
     signalerait pas — elle enverrait simplement un rappel de trop, tous les
     soirs, pour quelque chose de déjà fait. */
  function bilanFaitAujourdhui() {
    try {
      return localStorage.getItem('natty_bilan_vu_' + user()) === jourCle(new Date());
    } catch (e) { return false; }
  }

  /* Les `at` à planifier, du plus proche au plus lointain. Le créneau du jour
     n'est retenu que s'il est encore à venir ET que le parcours n'a pas déjà
     été ouvert aujourd'hui. */
  function creneaux() {
    var h = heure(), out = [], now = new Date();
    for (var i = 0; i < JOURS; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(h, 0, 0, 0);
      if (i === 0 && (d <= now || defisVuAujourdhui())) continue;
      out.push(d);
    }
    return out;
  }

  /* Mêmes règles pour le bilan du soir. */
  function creneauxBilan() {
    var out = [], now = new Date();
    for (var i = 0; i < JOURS; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(H_BILAN, M_BILAN, 0, 0);
      if (i === 0 && (d <= now || bilanFaitAujourdhui())) continue;
      out.push(d);
    }
    return out;
  }

  /* Mêmes règles pour midi, avec sa propre condition de saut. */
  function creneauxMidi() {
    var out = [], now = new Date();
    for (var i = 0; i < JOURS; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(H_MIDI, 0, 0, 0);
      if (i === 0 && (d <= now || repasAujourdhui())) continue;
      out.push(d);
    }
    return out;
  }

  /* ── Planification ───────────────────────────────────────────
     Toujours « tout annuler puis tout replanifier » : les ids sont fixes
     (4101..4107 pour le parcours, 4201..4207 pour midi), donc deux ouvertures
     d'affilée ne peuvent pas empiler deux rappels pour le même jour. */

  async function annuler() {
    var LN = plugin();
    if (!LN) return;
    var ids = [];
    // Les DEUX séries : n'annuler que la première laisserait les rappels de midi
    // de la planification précédente s'empiler avec les nouveaux.
    for (var i = 1; i <= JOURS; i++) {
      ids.push({ id: ID_BASE + i }); ids.push({ id: ID_MIDI + i }); ids.push({ id: ID_BILAN + i });
    }
    try { await LN.cancel({ notifications: ids }); } catch (e) {}
  }

  async function creerCanal() {
    var LN = plugin();
    // Canal Android uniquement ; l'appel n'existe pas côté iOS.
    if (!LN || !window.Capacitor.getPlatform || window.Capacitor.getPlatform() !== 'android') return;
    try {
      await LN.createChannel({
        id: CANAL, name: 'Rappels du parcours',
        description: 'Le rappel quotidien pour avancer dans le parcours Natty',
        importance: 4, visibility: 1
      });
    } catch (e) {}
  }

  async function replanifier() {
    var LN = plugin();
    if (!LN) return false;
    await annuler();
    if (!activee()) return false;
    if ((await etatPermission()) !== 'granted') return false;

    await creerCanal();

    var dates = creneaux(), liste = [];
    for (var i = 0; i < dates.length; i++) {
      var d = dates[i];
      // Rotation indexée sur le quantième, pas sur i : le texte d'un jour
      // donné reste le même quelle que soit l'heure de la replanification.
      var txt = TEXTES[Math.abs(Math.floor(d.getTime() / 86400000)) % TEXTES.length];
      liste.push({
        id: ID_BASE + i + 1,
        title: txt.t,
        body: txt.b,
        schedule: { at: d, allowWhileIdle: true },
        channelId: CANAL,
        extra: { route: 'narration.html', jour: jourCle(d) }
      });
    }
    var midis = creneauxMidi();
    for (var k = 0; k < midis.length; k++) {
      liste.push({
        id: ID_MIDI + k + 1,
        title: TEXTE_MIDI.t,
        body: TEXTE_MIDI.b,
        schedule: { at: midis[k], allowWhileIdle: true },
        channelId: CANAL,
        extra: { route: 'suivi.html', jour: jourCle(midis[k]) }
      });
    }

    var soirs = creneauxBilan();
    for (var b = 0; b < soirs.length; b++) {
      liste.push({
        id: ID_BILAN + b + 1,
        title: TEXTE_BILAN.t,
        body: TEXTE_BILAN.b,
        schedule: { at: soirs[b], allowWhileIdle: true },
        channelId: CANAL,
        /* `action` et non une route à rallonge : la destination reste dans la
           liste blanche, et c'est nous qui composons l'URL. Une notification est
           une entrée externe — on ne suit jamais une adresse qu'elle dicte. */
        extra: { route: 'suivi.html', action: 'bilan', jour: jourCle(soirs[b]) }
      });
    }

    if (!liste.length) return true;
    try { await LN.schedule({ notifications: liste }); return true; }
    catch (e) { return false; }
  }

  /* ── Activation / désactivation ──────────────────────────────
     `activer()` demande la permission au moment où l'utilisateur exprime son
     intention (clic sur l'interrupteur ou sur l'invitation), jamais au
     lancement : une demande à froid se solde par un refus définitif qu'on ne
     peut plus rattraper depuis l'app. */

  async function activer() {
    var LN = plugin();
    if (!LN) return { ok: false, raison: 'indispo' };

    var etat = await etatPermission();
    if (etat === 'prompt') {
      try { var r = await LN.requestPermissions(); etat = (r && r.display) || 'denied'; }
      catch (e) { etat = 'denied'; }
    }
    if (etat !== 'granted') return { ok: false, raison: etat };

    ecrire('actif', '1');
    await replanifier();

    // L'autorisation qu'on vient d'obtenir couvre AUSSI le push sur iOS.
    // On enchaîne tout de suite plutôt que d'attendre le prochain chargement
    // de page : c'est le seul moment où l'on est sûr qu'elle est fraîche.
    if (window.NattyPush && typeof NattyPush.sync === 'function') NattyPush.sync();

    return { ok: true };
  }

  async function desactiver() {
    ecrire('actif', '0');
    await annuler();
  }

  async function setHeure(h) {
    h = parseInt(h, 10);
    if (!(h >= 0 && h <= 23)) return;
    ecrire('heure', h);
    await replanifier();
  }

  /* ── Ouverture depuis une notification ───────────────────────
     Le tap ouvre l'app sur la page en cours ; on route vers le parcours.
     `extra.route` est comparé à une liste blanche : une notification est une
     entrée externe, on ne suit jamais une destination qu'elle dicterait. */
  var ROUTES = { 'narration.html': 1, 'suivi.html': 1 };
  /* Les actions autorisées, et ce qu'elles ajoutent à l'URL. Même principe que
     `ROUTES` : rien de ce que porte la notification n'est concaténé tel quel. */
  var ACTIONS = { bilan: 'bilan=1' };

  function ecouterOuverture() {
    var LN = plugin();
    if (!LN || window._nattyNotifsRoute) return;
    window._nattyNotifsRoute = true;
    try {
      LN.addListener('localNotificationActionPerformed', function (ev) {
        var x = (ev && ev.notification && ev.notification.extra) || {};
        var r = x.route;
        if (!r || !ROUTES[r]) return;
        var q = ACTIONS[x.action] || '';
        /* ⚠️ Sur la bonne page, on ne recharge pas — mais s'il y a une action à
           exécuter, il faut bien qu'elle parte : sans ça, taper le rappel du
           soir depuis Suivi ne faisait RIEN, c'est-à-dire précisément le cas où
           l'app est déjà ouverte sur le bon écran. */
        if (location.pathname.split('/').pop() === r) {
          if (q === 'bilan=1' && window.NattyBilan && NattyBilan.ouvrirJour) NattyBilan.ouvrirJour();
          return;
        }
        var sep = (location.search || '') ? (location.search + (q ? '&' + q : ''))
                                          : (q ? '?' + q : '');
        location.href = '/' + r + sep;
      });
    } catch (e) {}
  }

  /* ── Invitation à activer (une seule fois) ───────────────────
     Pas le premier jour : une demande avant que l'app ait prouvé son intérêt
     se fait refuser, et sur iOS ce refus est définitif — on ne peut plus
     jamais reposer la question depuis l'app. On attend donc le 2ᵉ **jour**
     d'utilisation (compté par date, pas par page affichée, sinon deux
     navigations dans la même minute suffiraient), et on ne redemande
     jamais ensuite. */

  var CSS = '' +
    '#nnotifInv{position:fixed;inset:0;z-index:900;display:flex;align-items:flex-end;justify-content:center;' +
      'background:rgba(16,16,20,.42);opacity:0;transition:opacity .22s}' +
    '#nnotifInv.on{opacity:1}' +
    /* ⚠️ UN PLEIN ÉCRAN QUI S'EFFACE EN OPACITÉ AVALE ENCORE LES TAPS.
       `fermer()` retire `.on` puis ne détache le nœud qu'à la fin du fondu : il
       reste plein écran, invisible et cliquable pendant 0,2 à 0,5 s. C'est la
       demi-seconde où « j'appuie et il ne se passe rien » (2026-08-25). */
    '#nnotifInv:not(.on){pointer-events:none}' +
    '#nnotifInv .ni-sheet{width:100%;max-width:480px;background:#fff;border-radius:28px 28px 0 0;' +
      'padding:26px 22px calc(26px + env(safe-area-inset-bottom,0px));text-align:center;' +
      'transform:translateY(100%);transition:transform .28s cubic-bezier(.22,1,.36,1)}' +
    '#nnotifInv.on .ni-sheet{transform:none}' +
    '#nnotifInv .ni-em{font-size:38px;line-height:1;margin-bottom:12px}' +
    '#nnotifInv h3{margin:0 0 8px;font-size:19px;font-weight:800;color:#101014;letter-spacing:-.3px}' +
    '#nnotifInv p{margin:0 0 20px;font-size:14px;line-height:1.5;color:#8b8b96}' +
    '#nnotifInv button{width:100%;border:none;font-family:inherit;font-size:15px;font-weight:700;' +
      'border-radius:16px;padding:15px;cursor:pointer}' +
    '#nnotifInv .ni-ok{background:#101014;color:#fff;margin-bottom:8px}' +
    '#nnotifInv .ni-no{background:none;color:#9d9da8;font-weight:600}';

  function fermerInvitation() {
    var el = document.getElementById('nnotifInv');
    if (!el) return;
    el.classList.remove('on');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
  }

  function afficherInvitation() {
    if (document.getElementById('nnotifInv')) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var el = document.createElement('div');
    el.id = 'nnotifInv';
    el.innerHTML =
      '<div class="ni-sheet">' +
        '<div class="ni-em">🔔</div>' +
        '<h3>Un rappel par jour ?</h3>' +
        // La feuille doit annoncer les DEUX rendez-vous : promettre « rien
        // d'autre » puis en envoyer deux serait un mensonge, et c'est la seule
        // occasion de demander la permission sur iOS.
        '<p>Trois rappels par jour, pas plus : à midi pour noter ton premier plat, ' +
          'à ' + heure() + ' h si tu n\'as pas encore fait ton palier, et à ' + H_BILAN +
          ' h 15 pour ton bilan du soir. Tu peux couper ça dans ton profil.</p>' +
        '<button class="ni-ok" id="niOk">Oui, me rappeler</button>' +
        '<button class="ni-no" id="niNo">Plus tard</button>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('on'); });

    document.getElementById('niOk').addEventListener('click', async function () {
      this.disabled = true;
      await activer();
      fermerInvitation();
    });
    document.getElementById('niNo').addEventListener('click', fermerInvitation);
    el.addEventListener('click', function (e) { if (e.target === el) fermerInvitation(); });
  }

  async function inviterSiPertinent() {
    if (!dispo()) return;
    if (lire('invite', '0') === '1') return;      // déjà proposé une fois
    if (activee()) return;

    // Un jour d'utilisation = une date distincte, comptée une seule fois.
    var auj = jourCle(new Date()), n = parseInt(lire('jours', '0'), 10);
    if (lire('dernierJour', '') !== auj){
      n += 1;
      ecrire('jours', n);
      ecrire('dernierJour', auj);
    }
    if (n < 2) return;                            // pas le jour de la découverte

    if ((await etatPermission()) !== 'prompt') return;  // déjà accordé ou refusé
    ecrire('invite', '1');
    setTimeout(afficherInvitation, 1200);         // laisser l'écran s'afficher d'abord
  }

  /* ── Démarrage ───────────────────────────────────────────────
     Replanifier à chaque ouverture est ce qui garde les textes variés et
     fait sauter le rappel du jour quand le parcours a déjà été ouvert. */
  function init() {
    if (!dispo()) return;
    ecouterOuverture();
    if (activee()) replanifier();
    inviterSiPertinent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    dispo: dispo,
    etatPermission: etatPermission,
    activee: activee,
    heure: heure,
    setHeure: setHeure,
    activer: activer,
    desactiver: desactiver,
    replanifier: replanifier,
    annuler: annuler
  };
})();
