/* ═══════════════════════════════════════════════════════════
   Natty — Notifications push (envoyées par le serveur)
   ───────────────────────────────────────────────────────────
   Côté appareil, ce module ne fait qu'une chose : obtenir le jeton APNs et
   le déposer dans la table `appareils`. Tout le reste — quoi envoyer, à qui,
   quand — vit côté serveur (`api/_apns.js` et les endpoints qui l'appellent).

   POURQUOI DU PUSH, alors que `assets/notifs.js` existe déjà : une
   notification locale est figée au moment où on la planifie. Les deux besoins
   restants ne peuvent donc PAS être locaux —
     • « il te reste 40 g de protéines » suppose un calcul à l'instant de
       l'envoi, sur des repas saisis après la planification ;
     • « un ami a ajouté un plat » est déclenché depuis un AUTRE appareil.
   Le rappel du parcours, lui, reste local : il n'a besoin de rien du serveur,
   et fonctionne même hors-ligne (voir notifs.js).

   AUTORISATION — volontairement pas de demande propre. Sur iOS, push et
   notifications locales partagent la même autorisation système : si
   `notifs.js` l'a obtenue, `register()` passe sans redemander ; sinon on ne
   demande rien du tout, plutôt que de faire surgir une 2ᵉ boîte de dialogue
   pour la même chose (un refus iOS est définitif).

   ⚠️ ANDROID — non couvert. Le plugin passe par Firebase Cloud Messaging, qui
   exige un `google-services.json` et donc un projet Firebase ; l'app Android
   n'a par ailleurs jamais été compilée. `plateforme` est stocké en base pour
   que des jetons FCM s'y ajoutent le jour venu sans changer de schéma.
   ═══════════════════════════════════════════════════════════ */
var NattyPush = (function () {

  var TABLE = 'appareils';
  var enCours = false;

  function estNatif() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function plugin() {
    if (!estNatif()) return null;
    var P = window.Capacitor.Plugins;
    return (P && P.PushNotifications) ? P.PushNotifications : null;
  }

  function dispo() { return !!plugin(); }

  function plateforme() {
    try { return window.Capacitor.getPlatform(); } catch (e) { return 'inconnu'; }
  }

  function user() { return (window.Natty && Natty.USER_ID) ? Natty.USER_ID : null; }

  /* ── Dépôt du jeton ──────────────────────────────────────────
     La clé de la ligne est le **jeton**, pas l'utilisateur : un même
     téléphone peut changer de compte, et un même compte avoir deux appareils.
     `on_conflict=token` est obligatoire — sans lui PostgREST résout le conflit
     sur la clé primaire et repart en 409 (piège déjà rencontré sur
     `meal_likes`, voir §3 de CLAUDE.md). */
  async function enregistrerJeton(token) {
    var uid = user();
    if (!uid || !token) return false;

    var derniere = null;
    try { derniere = localStorage.getItem('natty_push_token_' + uid); } catch (e) {}
    if (derniere === token) return true;   // déjà à jour, rien à écrire

    try {
      await Natty.sbPost(
        TABLE + '?on_conflict=token',
        { user_id: uid, token: token, plateforme: plateforme(), updated_at: new Date().toISOString() },
        'resolution=merge-duplicates,return=minimal'
      );
      try { localStorage.setItem('natty_push_token_' + uid, token); } catch (e) {}
      return true;
    } catch (e) {
      // Table absente ou RLS : on n'a rien à annoncer à l'utilisateur, le push
      // est un bonus. Le jeton sera reproposé au prochain lancement.
      return false;
    }
  }

  /* ── Ouverture depuis une notification ───────────────────────
     Même règle que notifs.js : la destination vient d'une liste blanche.
     Un push est une entrée distante — la route qu'il transporte ne doit
     jamais pouvoir envoyer l'app ailleurs que sur ses propres écrans. */
  var ROUTES = { 'suivi.html': 1, 'social.html': 1, 'narration.html': 1, 'repas.html': 1 };

  function router(data) {
    var r = data && data.route;
    if (!r || !ROUTES[r]) return;
    if (location.pathname.split('/').pop() === r) return;
    location.href = '/' + r + (location.search || '');
  }

  /* ── Enregistrement ──────────────────────────────────────────
     Appelé à chaque ouverture d'écran : `register()` est idempotent côté
     système, et c'est ce qui rattrape un jeton renouvelé par iOS (réinstall,
     restauration de sauvegarde) sans rien demander à l'utilisateur. */
  async function sync() {
    var PN = plugin();
    if (!PN || enCours || !user()) return false;
    enCours = true;

    try {
      var perm = await PN.checkPermissions();
      // On ne demande jamais nous-mêmes : c'est notifs.js qui porte la
      // demande, au bon moment et une seule fois.
      if (!perm || perm.receive !== 'granted') { enCours = false; return false; }

      if (!window._nattyPushListeners) {
        window._nattyPushListeners = true;
        PN.addListener('registration', function (t) { enregistrerJeton(t && t.value); });
        PN.addListener('registrationError', function () { /* silencieux : sans jeton, pas de push, c'est tout */ });
        PN.addListener('pushNotificationActionPerformed', function (ev) {
          router(ev && ev.notification && ev.notification.data);
        });
      }

      await PN.register();
      enCours = false;
      return true;
    } catch (e) {
      enCours = false;
      return false;
    }
  }

  function init() { if (dispo()) sync(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { dispo: dispo, sync: sync };
})();
