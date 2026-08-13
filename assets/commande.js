/* assets/commande.js — la commande : où elle en est, et comment en passer une
   ═══════════════════════════════════════════════════════════════════════════
   Demande de Pablo (2026-08-13) : « un héro en haut de page pile au milieu
   entre profil et home pour suivre les commandes et pouvoir commander
   directement des plats à l'unité ou par semaine ».

   D'où DEUX morceaux, et un seul point d'entrée :
     • une PASTILLE posée dans la barre du haut, dans le vide entre l'icône
       maison et le profil. Elle dit l'état en un mot, et elle reste à l'écran
       pendant tout le défilement (`.top` est en `position:sticky`) ;
     • une FEUILLE qui monte au tap : le récap de la commande, son avancée, et
       les deux façons d'en passer une nouvelle.

   ⚠️ POURQUOI LA BARRE DU HAUT MARCHE POUR ÇA. `.top` est en
   `justify-content:space-between` avec [retour (masqué), maison, profil] : la
   maison est collée à gauche, le profil à droite, et il reste un grand vide au
   milieu. On insère donc la pastille AVANT le profil, et la répartition la
   centre d'elle-même — sans position absolue, donc rien à recalculer quand le
   bouton retour apparaît (l'espace se redistribue entre quatre éléments).

   ⚠️ UN SEUL TAP, PAS DEUX RÔLES SÉPARÉS. La pastille ouvre toujours la même
   feuille, qu'il y ait une commande ou non — suivre et commander sont deux
   moments du même sujet, et deux entrées différentes obligeraient à deviner
   laquelle on veut. Sans commande, la feuille n'affiche que les deux boutons.

   ⚠️ L'AVANCÉE NE COMPTE QUE CE QUE LA BASE SAIT DIRE. `commandes.statut` vaut
   `en_attente`, `confirmee`, `livree` ou `annulee` — quatre valeurs, pas une de
   plus. On affiche donc TROIS jalons (Commandée · Confirmée · Livrée), et pas
   le « en préparation » ou le « en cours de livraison » qu'on aimerait voir :
   ils n'existent nulle part, et une étape qui n'avance jamais est pire que pas
   d'étape. Même règle que partout ici — on ne peint pas un état inventé.

   Dépend d'`assets/core.js` (Natty.sbFetch, Natty.USER_ID, Natty.goto, Natty.jour)
   et des jetons `--nt-*` d'`assets/theme.js`, les seuls valables sur toutes les
   pages — ce module s'invite sur des écrans qui ont chacun leur jeu de variables.
   ═══════════════════════════════════════════════════════════════════════════ */
var NattyCommande = (function () {
  'use strict';

  var PRIX = { '3_repas': 27, '4_repas': 36 };
  var LIB_FORMULE = { '3_repas': '3 repas par semaine', '4_repas': '4 repas par semaine' };

  /* Les trois jalons, dans l'ordre, et le statut qui les allume. `annulee`
     n'est pas un jalon : c'est une sortie de route, affichée à part. */
  var JALONS = [
    { titre: 'Commandée', detail: 'Nous avons bien reçu votre commande.' },
    { titre: 'Confirmée', detail: 'Vos plats sont retenus pour la semaine.' },
    { titre: 'Livrée',    detail: 'Bon appétit.' }
  ];
  var RANG = { en_attente: 0, confirmee: 1, livree: 2 };

  var etat = { abo: null, cmd: null, plats: [], charge: false, unite: false };
  var pastille = null;
  var feuille = null;

  function ech(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function css() {
    if (document.getElementById('ncmdCss')) return;
    var s = document.createElement('style');
    s.id = 'ncmdCss';
    s.textContent = [
      /* ── la pastille ──
         ⚠️ SÉLECTEUR EN DEUX CLASSES, ET C'EST OBLIGATOIRE. `assets/style.css`
         pose `.top a,.top button{background:none;border:none;padding:0;
         color:var(--icon-mut)}` pour ses icônes — soit une spécificité (0,1,1),
         qui bat un `.ncmd-chip` nu (0,1,0) quoi qu'il arrive dans l'ordre des
         feuilles. Résultat vu à l'écran : la pastille s'affichait en texte gris
         sans fond ni rembourrage, au milieu de la barre. `.top .ncmd-chip`
         monte à (0,2,0) et reprend la main.
         Le second sélecteur couvre le cas où le module serait posé ailleurs
         que dans `.top`. */
      '.top .ncmd-chip,.ncmd-chip{display:inline-flex;align-items:center;gap:7px;',
      'background:var(--nt-ink);color:var(--nt-on-ink);border:none;border-radius:999px;',
      'padding:8px 14px;font-family:inherit;font-size:12.5px;font-weight:800;',
      'letter-spacing:.2px;cursor:pointer;white-space:nowrap;max-width:52vw;',
      'overflow:hidden;text-overflow:ellipsis;line-height:1.15;flex:0 1 auto}',
      '.top .ncmd-chip:active,.ncmd-chip:active{opacity:.8}',
      /* Le point d'état : la couleur porte l'info, le texte la répète — un point
         seul serait indéchiffrable pour qui ne distingue pas les teintes. */
      '.ncmd-dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:0 0 auto}',
      '.ncmd-dot.on{background:#34c759}',
      '.ncmd-dot.att{background:#ff9500}',
      '.ncmd-dot.ko{background:#ff453a}',

      /* ── la feuille ── */
      '#ncmd{position:fixed;inset:0;z-index:9600;display:none}',
      '#ncmd.on{display:block}',
      '#ncmd *{margin:0;padding:0;border:0;box-sizing:border-box}',
      '#ncmd .voile{position:absolute;inset:0;background:var(--nt-voile);opacity:0;',
      'transition:opacity .26s ease}',
      '#ncmd.vu .voile{opacity:1}',
      '#ncmd .sheet{position:absolute;left:0;right:0;bottom:0;max-width:480px;margin:0 auto;',
      'background:var(--nt-bg);border-radius:26px 26px 0 0;',
      'padding:10px 20px calc(24px + env(safe-area-inset-bottom,0px));',
      'max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      'transform:translateY(102%);transition:transform .3s cubic-bezier(.22,1,.36,1)}',
      '#ncmd.vu .sheet{transform:translateY(0)}',
      '#ncmd .poignee{width:38px;height:4px;border-radius:99px;background:var(--nt-line);margin:0 auto 16px}',
      '#ncmd h2{font-size:19px;font-weight:900;color:var(--nt-ink);letter-spacing:-.2px;margin-bottom:3px}',
      '#ncmd .sub{font-size:12.5px;color:var(--nt-muted);margin-bottom:18px;line-height:1.45}',

      /* ── le récap ── */
      '#ncmd .recap{background:var(--nt-card);border-radius:18px;padding:15px 16px;margin-bottom:16px}',
      '#ncmd .lg{display:flex;justify-content:space-between;gap:14px;padding:7px 0;font-size:13px}',
      '#ncmd .lg+.lg{border-top:1px solid var(--nt-line)}',
      '#ncmd .lg .k{color:var(--nt-muted);flex:0 0 auto}',
      '#ncmd .lg .v{color:var(--nt-ink);font-weight:700;text-align:right}',
      '#ncmd .plats{list-style:none;margin-top:10px;border-top:1px solid var(--nt-line);padding-top:8px}',
      '#ncmd .plats li{display:flex;align-items:center;gap:9px;padding:5px 0;font-size:13px;color:var(--nt-ink)}',
      '#ncmd .pi{width:26px;height:26px;border-radius:8px;object-fit:cover;flex:0 0 auto;',
      'background:var(--nt-line);display:block}',

      /* ── l'avancée ── */
      '#ncmd .etapes{margin:2px 0 18px}',
      '#ncmd .et{display:flex;gap:13px;align-items:flex-start;position:relative;padding-bottom:16px}',
      '#ncmd .et:last-child{padding-bottom:0}',
      /* Le trait relie les pastilles et s'arrête à la dernière. */
      '#ncmd .et:not(:last-child)::before{content:"";position:absolute;left:10px;top:22px;bottom:2px;',
      'width:2px;background:var(--nt-line)}',
      '#ncmd .et.fait:not(:last-child)::before{background:#34c759}',
      '#ncmd .pt{width:22px;height:22px;border-radius:50%;flex:0 0 auto;',
      'border:2px solid var(--nt-line);display:flex;align-items:center;justify-content:center;',
      'background:var(--nt-bg);z-index:1}',
      '#ncmd .et.fait .pt{background:#34c759;border-color:#34c759}',
      '#ncmd .pt svg{display:none;width:12px;height:12px}',
      '#ncmd .et.fait .pt svg{display:block}',
      '#ncmd .et .tt{font-size:13.5px;font-weight:800;color:var(--nt-muted);line-height:1.3}',
      '#ncmd .et.fait .tt{color:var(--nt-ink)}',
      '#ncmd .et .dd{font-size:11.5px;color:var(--nt-muted);margin-top:2px;line-height:1.4}',

      '#ncmd .alerte{background:rgba(255,69,58,.1);border-radius:14px;padding:13px 15px;',
      'margin-bottom:16px;font-size:12.5px;color:#ff453a;font-weight:700;line-height:1.45}',

      /* ── les actions ── */
      '#ncmd .act{display:flex;flex-direction:column;gap:9px}',
      '#ncmd .b{width:100%;padding:15px;border-radius:15px;font-family:inherit;',
      'font-size:14.5px;font-weight:800;cursor:pointer;display:block}',
      '#ncmd .b1{background:var(--nt-ink);color:var(--nt-on-ink)}',
      '#ncmd .b2{background:var(--nt-card);color:var(--nt-ink)}',
      '#ncmd .b:active{opacity:.82}',
      '#ncmd .fermer{width:100%;padding:13px;background:none;color:var(--nt-muted);',
      'font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px}'
    ].join('');
    document.head.appendChild(s);
  }

  /* Le lundi de la semaine, en heure LOCALE. `toISOString()` convertit en UTC :
     entre 00 h et 02 h à Paris il rend la veille, donc un lundi il désignerait
     le dimanche — le piège documenté au §3 du CLAUDE.md. */
  function lundi(d) {
    var x = d ? new Date(d) : new Date();
    var j = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - j);
    return Natty.jour(x);
  }

  function dateCourte(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  /* Lecture unique : abonnement actif, dernière commande, et les plats qu'elle
     contient. Trois requêtes au plus, aucune sans session. Chaque `try` est
     séparé : une table refusée par la RLS ne doit pas emporter les deux autres. */
  async function charger() {
    etat.charge = true;
    if (!window.Natty || !Natty.USER_ID) return;
    var uid = encodeURIComponent(Natty.USER_ID);

    try {
      var a = await Natty.sbFetch('abonnements?user_id=eq.' + uid
        + '&statut=eq.actif&order=date_debut.desc&limit=1'
        + '&select=id,formule,statut,date_debut');
      etat.abo = (a && a.length) ? a[0] : null;
    } catch (e) { etat.abo = null; }

    try {
      var c = await Natty.sbFetch('commandes?user_id=eq.' + uid
        + '&order=semaine.desc&limit=1'
        + '&select=id,semaine,plats_choisis,statut,skip,created_at');
      etat.cmd = (c && c.length) ? c[0] : null;
    } catch (e) { etat.cmd = null; }

    /* L'achat à l'unité n'existe que si un prix Stripe est configuré, et cette
       information ne vit que sur le serveur (`STRIPE_PRICE_UNITE`).
       ⚠️ On DEMANDE plutôt que de supposer : afficher « Commander à l'unité »
       sans prix configuré mènerait à un écran qui refuse au moment de payer —
       le pire endroit pour apprendre qu'une option n'existe pas. La route ne
       renvoie qu'un booléen, jamais l'identifiant de prix. */
    try {
      var r = await fetch(Natty.API + '/api/checkout');
      etat.unite = r.ok ? !!(await r.json()).unite : false;
    } catch (e) { etat.unite = false; }

    // `plats_choisis` ne porte que des identifiants : les noms sont ailleurs.
    etat.plats = [];
    var ids = etat.cmd && etat.cmd.plats_choisis;
    if (ids && ids.length) {
      try {
        etat.plats = await Natty.sbFetch('plats_menu?id=in.(' + ids.join(',') + ')'
          + '&select=id,nom,photo_url') || [];
      } catch (e) { etat.plats = []; }
    }
  }

  /* Ce que dit la pastille — trois situations, parce qu'il n'y a que trois
     choses vraies à dire. */
  function libelle() {
    var c = etat.cmd;
    if (c && c.statut === 'annulee') return { txt: 'Commande annulée', pt: 'ko' };
    if (c && !c.skip && c.statut) {
      // Une commande livrée d'une semaine passée n'est plus « en cours » : la
      // montrer comme un suivi actif ferait attendre une livraison qui a eu lieu.
      var fraiche = String(c.semaine) >= lundi();
      if (c.statut === 'livree' && !fraiche) return { txt: 'Commander', pt: '' };
      if (c.statut === 'livree')    return { txt: 'Commande livrée',    pt: 'on' };
      if (c.statut === 'confirmee') return { txt: 'Commande confirmée', pt: 'on' };
      return { txt: 'Commande en cours', pt: 'att' };
    }
    if (etat.abo) return { txt: 'Ma commande', pt: 'on' };
    return { txt: 'Commander', pt: '' };
  }

  function peindrePastille() {
    if (!pastille) return;
    var l = libelle();
    pastille.textContent = '';
    if (l.pt) {
      var d = document.createElement('span');
      d.className = 'ncmd-dot ' + l.pt;
      pastille.appendChild(d);
    }
    pastille.appendChild(document.createTextNode(l.txt));
    pastille.setAttribute('aria-label', l.txt);
  }

  function htmlEtapes() {
    var c = etat.cmd;
    if (!c || c.statut === 'annulee' || c.skip) return '';
    var i = RANG[c.statut];
    if (i === undefined) i = 0;
    var coche = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" '
      + 'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    return '<div class="etapes">' + JALONS.map(function (j, n) {
      return '<div class="et' + (n <= i ? ' fait' : '') + '">'
        + '<div class="pt">' + coche + '</div><div>'
        + '<div class="tt">' + j.titre + '</div>'
        + (n <= i ? '<div class="dd">' + j.detail + '</div>' : '')
        + '</div></div>';
    }).join('') + '</div>';
  }

  function htmlRecap() {
    var c = etat.cmd, a = etat.abo, l = [];
    if (a) {
      l.push(['Formule', LIB_FORMULE[a.formule] || 'Abonnement actif']);
      if (PRIX[a.formule]) l.push(['Prix', PRIX[a.formule] + ' € par semaine']);
      if (a.date_debut) l.push(['Depuis', dateCourte(a.date_debut)]);
    }
    if (c) {
      l.push(['Semaine', 'du ' + dateCourte(c.semaine)]);
      if (c.skip) l.push(['Livraison', 'sautée cette semaine']);
    }
    if (!l.length) return '';

    var lignes = l.map(function (x) {
      return '<div class="lg"><span class="k">' + ech(x[0]) + '</span>'
           + '<span class="v">' + ech(x[1]) + '</span></div>';
    }).join('');

    var plats = '';
    if (etat.plats.length) {
      plats = '<ul class="plats">' + etat.plats.map(function (p) {
        var img = p.photo_url
          ? '<img class="pi" src="' + ech(p.photo_url) + '" alt="">'
          : '<span class="pi"></span>';
        return '<li>' + img + '<span>' + ech(p.nom || 'Plat') + '</span></li>';
      }).join('') + '</ul>';
    }
    return '<div class="recap">' + lignes + plats + '</div>';
  }

  /* Les deux façons de commander. Toutes deux mènent à `offre.html`, qui est le
     seul écran de l'app où l'on choisit et où l'on paie — le mode est passé en
     paramètre plutôt que dupliqué dans un second écran.
     ⚠️ « À l'unité » n'apparaît QUE si le parcours existe (drapeau posé par
     offre.html). Un bouton qui mène à un écran vide est pire que son absence —
     même discipline que `APPLE_ACTIF` sur l'écran de connexion. */
  function htmlActions() {
    return '<div class="act">'
      + '<button class="b b1" data-go="semaine">Commander mes repas de la semaine</button>'
      + (etat.unite
          ? '<button class="b b2" data-go="unite">Commander des plats à l\'unité</button>'
          : '')
      + '</div>'
      + '<button class="fermer" data-fermer>Fermer</button>';
  }

  function peindreFeuille() {
    var c = etat.cmd, a = etat.abo;
    var enCours = c && c.statut !== 'annulee' && !c.skip
      && !(c.statut === 'livree' && String(c.semaine) < lundi());

    var titre, sous;
    if (enCours)      { titre = 'Votre commande'; sous = 'Où elle en est, et ce qu\'elle contient.'; }
    else if (a)       { titre = 'Votre abonnement'; sous = 'Aucune commande en cours cette semaine.'; }
    else              { titre = 'Commander'; sous = 'Des repas livrés chaque semaine, ou des plats à l\'unité.'; }

    var alerte = (c && c.statut === 'annulee')
      ? '<div class="alerte">Cette commande a été annulée. Vous pouvez en passer une nouvelle.</div>'
      : (c && c.skip
        ? '<div class="alerte">Vous avez choisi de sauter la livraison de cette semaine.</div>'
        : '');

    feuille.querySelector('.sheet').innerHTML =
      '<div class="poignee"></div>'
      + '<h2>' + ech(titre) + '</h2>'
      + '<div class="sub">' + ech(sous) + '</div>'
      + alerte
      + (enCours ? htmlEtapes() : '')
      + htmlRecap()
      + htmlActions();
  }

  function monterFeuille() {
    if (feuille) return;
    css();
    feuille = document.createElement('div');
    feuille.id = 'ncmd';
    feuille.innerHTML = '<div class="voile"></div><div class="sheet"></div>';
    document.body.appendChild(feuille);

    feuille.addEventListener('click', function (ev) {
      if (ev.target.classList.contains('voile') || ev.target.closest('[data-fermer]')) {
        fermer(); return;
      }
      var b = ev.target.closest('[data-go]');
      if (!b) return;
      // Le mode voyage en paramètre : offre.html est le seul écran de paiement.
      Natty.goto(b.getAttribute('data-go') === 'unite'
        ? 'offre.html?mode=unite' : 'offre.html');
    });
  }

  function ouvrir() {
    monterFeuille();
    peindreFeuille();
    feuille.classList.add('on');
    // Double amorce : une classe posée par la seule rAF ne s'applique pas si la
    // page ne peint pas (onglet caché, app en arrière-plan) — la feuille
    // resterait transparente TOUT EN interceptant les taps. Piège déjà payé sur
    // core.js/confirmer et generation.js.
    requestAnimationFrame(function () { feuille.classList.add('vu'); });
    setTimeout(function () { feuille.classList.add('vu'); }, 60);
    document.body.style.overflow = 'hidden';
  }

  function fermer() {
    if (!feuille) return;
    feuille.classList.remove('vu');
    document.body.style.overflow = '';
    setTimeout(function () { feuille.classList.remove('on'); }, 300);
  }

  /* Pose la pastille dans la barre du haut, JUSTE AVANT le profil : c'est ce
     qui la place au milieu, la répartition `space-between` faisant le reste. */
  async function monter() {
    var top = document.querySelector('.top');
    if (!top || document.querySelector('.ncmd-chip')) return;
    css();

    pastille = document.createElement('button');
    pastille.className = 'ncmd-chip';
    pastille.type = 'button';
    pastille.addEventListener('click', ouvrir);

    var profil = top.querySelector('a[href*="profil"]');
    if (profil) top.insertBefore(pastille, profil);
    else top.appendChild(pastille);

    // Un libellé neutre le temps de la lecture : « Commander » d'emblée
    // mentirait à quelqu'un dont la commande est en cours de livraison.
    pastille.textContent = 'Ma commande';
    await charger();
    peindrePastille();
  }

  function demarrer() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', monter);
    } else { monter(); }
  }
  demarrer();

  return {
    monter: monter,
    ouvrir: ouvrir,
    fermer: fermer,
    rafraichir: async function () { await charger(); peindrePastille(); },
    etat: function () { return etat; }
  };
})();
