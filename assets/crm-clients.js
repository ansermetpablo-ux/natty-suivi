/* assets/crm-clients.js — l'onglet « Clients » du Commercial, et la
   confirmation de commande vue depuis le CRM (2026-11-23).
   Chargé par crm.html APRÈS son script et après assets/crm-production.js : il
   en utilise les outils (sb, sbTry, esc, toast, drawer, closeAll, render, go,
   SUB, CMD, ouvrirFormBon, chargerProd, jetonStaff, PROD_STATUTS, chipStatut,
   fd) — il n'en recopie aucun.

   Trois choses :
   1. La liste des CLIENTS : tous les inscrits (comptes Auth via
      `membres_admin()`, plus les questionnaires sans compte), ceux qui ont
      commandé, ceux qui ont une commande en cours — avec des filtres. Un clic
      ouvre la fiche : ses informations et le récap de chaque commande, sa
      confirmation (envoyée ? validée ? ses réponses), et les gestes : envoyer
      le mail de confirmation, modifier dans Production.
   2. L'ENVOI du mail de confirmation (api/checkout.js → api/_commande.js) :
      récap + « Valider / Modifier », ou « renseignez votre livraison » quand
      elle manque. Il part aussi tout seul au paiement (webhook).
   3. L'ALERTE après une modification : dès qu'une commande d'un client est
      modifiée (Production, ou depuis sa fiche), une alerte propose de le
      NOTIFIER (email « votre commande a été mise à jour », qui redemande sa
      validation) ou d'IGNORER. Tant qu'on n'a pas tranché, la commande porte
      `modif_non_notifiee` et la fiche le rappelle.

   ⚠️ Les bons `crm:` (commande libre) et `bloc:` (B2B) n'ont pas de compte
   derrière eux, donc pas d'email : ils ne sont pas des « clients » ici. */
(function () {
  'use strict';

  /* ── Les données ──────────────────────────────────────────────────────── */
  const synthetique = uid => !uid || /^(crm|bloc):/.test(uid);
  const baseRef = b => String(b.stripe_ref || '').split('#')[0] || b.id;
  const FIGES = ['livre', 'annule'];
  const CONF = {
    non_envoyee: ['', 'Mail non envoyé'], envoyee: ['warn', 'En attente du client'],
    confirmee: ['ok', 'Confirmée par le client'], annulee_hors_zone: ['bad', 'Annulée — hors zone']
  };
  const chipConf = s => { const c = CONF[s] || CONF.non_envoyee; return '<span class="chip ' + c[0] + '">' + c[1] + '</span>'; };
  const fdl = ymd => ymd ? new Date(ymd + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const fdh = ts => ts ? new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const auj = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  let CL = null;                 // cache du chargement
  const ETAT = { filtre: 'tous', q: '' };

  async function charger(force) {
    if (CL && !force) return CL;
    const [comptes, onb, bons, abos] = await Promise.all([
      sbTry('rpc/membres_admin', { method: 'POST', body: '{}' }),
      sbTry('onboarding?select=user_id,prenom,nom,email,objectif_type,poids,taille,age,sexe,tdee,completed,created_at&order=created_at.desc&limit=3000'),
      sbTry('bons_commande?select=*&order=created_at.desc&limit=3000'),
      sbTry('abonnements?select=user_id,formule,statut,date_debut&order=date_debut.desc&limit=3000')
    ]);
    const M = {};
    const fiche = uid => (M[uid] = M[uid] || { uid, bons: [], onb: null, compte: null, abo: null });
    if (comptes.ok) (comptes.data || []).forEach(c => { fiche(c.user_id).compte = c; });
    if (onb.ok) (onb.data || []).forEach(o => {
      if (!o.user_id) return;
      const f = fiche(o.user_id);
      // Doublons d'onboarding (§4) : on garde la ligne la plus renseignée.
      const poids = x => x ? ['prenom', 'nom', 'email', 'poids', 'tdee', 'objectif_type'].filter(k => x[k]).length : -1;
      if (poids(o) > poids(f.onb)) f.onb = o;
    });
    if (bons.ok) (bons.data || []).forEach(b => { if (!synthetique(b.user_id)) fiche(b.user_id).bons.push(b); });
    if (abos.ok) (abos.data || []).forEach(a => { const f = M[a.user_id]; if (f && (!f.abo || a.statut === 'actif')) f.abo = f.abo && f.abo.statut === 'actif' ? f.abo : a; });
    const liste = Object.values(M).map(f => {
      const o = f.onb || {}, c = f.compte || {};
      const nom = [o.prenom, o.nom].filter(Boolean).join(' ') || c.email || o.email || ('Client ' + f.uid.slice(0, 6));
      const actifs = f.bons.filter(b => FIGES.indexOf(b.statut) < 0);
      const prochaine = actifs.map(b => b.jour_livraison).filter(Boolean).sort()[0] || null;
      return Object.assign(f, {
        nom, email: c.email || o.email || '',
        inscrit: !!(f.compte || f.onb), inscritLe: c.inscrit_le || o.created_at || null,
        aCommande: f.bons.length > 0, enCours: actifs.length > 0, prochaine,
        aConfirmer: actifs.some(b => b.confirmation_statut !== 'confirmee'),
        nonNotifiee: f.bons.some(b => b.modif_non_notifiee),
        abonne: !!(f.abo && f.abo.statut === 'actif'),
        derniere: f.bons.map(b => b.created_at).sort().pop() || null
      });
    }).sort((a, b) => (b.derniere || b.inscritLe || '').localeCompare(a.derniere || a.inscritLe || ''));
    CL = { liste, M, comptesOk: comptes.ok, bonsOk: bons.ok, err: !bons.ok ? bons.err : '' };
    return CL;
  }

  /* ── La liste ─────────────────────────────────────────────────────────── */
  const FILTRES = [
    ['tous', 'Tous', () => true],
    ['encours', 'Commande en cours', f => f.enCours],
    ['commande', 'Ont commandé', f => f.aCommande],
    ['inscrits', 'Inscrits sans commande', f => f.inscrit && !f.aCommande],
    ['confirmer', 'À confirmer', f => f.enCours && f.aConfirmer],
    ['notifier', 'Modif. à notifier', f => f.nonNotifiee],
    ['abonnes', 'Abonnés', f => f.abonne]
  ];

  async function vCommercialClients() {
    const D = await charger(true);
    if (!D.bonsOk) return '<div class="exbar"><span class="chip bad">Illisible</span><span>Impossible de lire les commandes — session d’équipe requise. ' + esc(D.err || '') + '</span></div>';
    const q = ETAT.q.trim().toLowerCase();
    const def = FILTRES.find(x => x[0] === ETAT.filtre) || FILTRES[0];
    const liste = D.liste.filter(def[2]).filter(f => !q || (f.nom + ' ' + f.email + ' ' + f.bons.map(b => b.adresse || '').join(' ')).toLowerCase().indexOf(q) >= 0);
    const ligne = f => {
      const tags = [];
      if (f.enCours) tags.push('<span class="chip info">En cours' + (f.prochaine ? ' · ' + esc(fdl(f.prochaine)) : '') + '</span>');
      else if (f.aCommande) tags.push('<span class="chip">' + f.bons.length + ' commande' + (f.bons.length > 1 ? 's' : '') + '</span>');
      else tags.push('<span class="chip">Inscrit</span>');
      if (f.enCours && f.aConfirmer) tags.push('<span class="chip warn">À confirmer</span>');
      if (f.nonNotifiee) tags.push('<span class="chip bad">Modif. non notifiée</span>');
      if (f.abonne) tags.push('<span class="chip ok">★ Abonné</span>');
      return '<div class="li c" data-ouvrir-client="' + esc(f.uid) + '" style="cursor:pointer"><div class="av">' + esc((f.nom[0] || '?').toUpperCase()) + '</div>'
        + '<div class="grow"><b style="font-weight:500">' + esc(f.nom) + '</b><div class="meta">' + esc(f.email || 'email inconnu')
        + (f.inscritLe ? ' · inscrit le ' + esc(fd(String(f.inscritLe).slice(0, 10))) : ' · sans compte') + '</div></div>'
        + '<span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' + tags.join('') + '</span></div>';
    };
    const n = k => D.liste.filter((FILTRES.find(x => x[0] === k) || FILTRES[0])[2]).length;
    return '<div class="grid g4" style="margin-bottom:14px">'
      + '<button class="card kpi click" data-cl-filtre="inscrits"><div class="lbl">Inscrits</div><div class="val num">' + D.liste.filter(f => f.inscrit).length + '</div></button>'
      + '<button class="card kpi click" data-cl-filtre="commande"><div class="lbl">Ont commandé</div><div class="val num">' + n('commande') + '</div></button>'
      + '<button class="card kpi click" data-cl-filtre="encours"><div class="lbl">Commande en cours</div><div class="val num">' + n('encours') + '</div></button>'
      + '<button class="card kpi click" data-cl-filtre="confirmer"><div class="lbl">À confirmer</div><div class="val num" style="color:var(--amber)">' + n('confirmer') + '</div></button></div>'
      + (D.comptesOk ? '' : '<div class="exbar"><span class="chip warn">Comptes illisibles</span><span>La liste des comptes (<span class="mono">membres_admin()</span>) n’a pas répondu : seuls les clients qui ont un questionnaire ou une commande apparaissent.</span></div>')
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'
      + '<div class="tabs" style="margin:0;flex-wrap:wrap">' + FILTRES.map(([k, l]) => '<button data-cl-filtre="' + k + '" aria-selected="' + (ETAT.filtre === k) + '">' + l + ' <span class="b">' + n(k) + '</span></button>').join('') + '</div>'
      + '<input class="inp" id="clQ" placeholder="Nom, email, adresse…" value="' + esc(ETAT.q) + '" style="max-width:240px;margin-left:auto"></div>'
      + '<div class="card lift"><div class="list">' + (liste.map(ligne).join('') || '<div class="empty">Aucun client ici.</div>') + '</div></div>';
  }

  /* ── La fiche ─────────────────────────────────────────────────────────── */
  function commandesDe(f) {
    const G = {};
    f.bons.forEach(b => { const k = baseRef(b); (G[k] = G[k] || []).push(b); });
    return Object.values(G).map(bs => {
      bs.sort((a, b) => (a.jour_livraison || '9999').localeCompare(b.jour_livraison || '9999'));
      const base = bs[0].stripe_ref ? String(bs[0].stripe_ref).split('#')[0] : '';
      const tete = bs.find(b => b.stripe_ref === base) || bs[0];
      return { tete, bons: bs };
    }).sort((a, b) => String(b.tete.created_at).localeCompare(String(a.tete.created_at)));
  }

  async function ouvrirClient(uid) {
    const D = await charger();
    const f = D.M[uid];
    if (!f) { toast('Client introuvable'); return; }
    const ids = f.bons.map(b => b.id);
    const E = await chargerProd();
    const attrR = ids.length ? await sbTry('bons_attributions?bon_id=in.(' + ids.join(',') + ')&select=bon_id,recette_id,nb_portions') : { ok: true, data: [] };
    const recNom = {}; (E && E.recettes || []).forEach(r => { recNom[r.id] = r.nom; });
    const platIds = [...new Set(f.bons.flatMap(b => (Array.isArray(b.plats) ? b.plats : []).map(p => p && p.id).filter(Boolean)))];
    const platR = platIds.length ? await sbTry('plats_menu?id=in.(' + platIds.join(',') + ')&select=id,nom') : { ok: true, data: [] };
    const platNom = {}; (platR.ok ? platR.data : []).forEach(p => { platNom[p.id] = p.nom; });
    const contenu = b => {
      const a = (attrR.ok ? attrR.data : []).filter(x => x.bon_id === b.id);
      if (a.length) return a.map(x => esc(recNom[x.recette_id] || 'Recette') + ' × ' + x.nb_portions).join(', ');
      if (Array.isArray(b.plats) && b.plats.length) return b.plats.map(p => esc(platNom[p.id] || 'Plat') + ' × ' + (p.n || 1)).join(', ');
      return '<span class="muted">non attribué</span>';
    };
    const o = f.onb || {}, c = f.compte || {};
    const derniere = f.bons.find(b => b.adresse) || {};
    const info = (k, v) => v ? '<div class="li"><div class="grow"><div class="meta">' + k + '</div><b style="font-weight:500">' + v + '</b></div></div>' : '';
    const OBJ = { performance: 'Performance', prise_masse: 'Prise de masse', perte_poids: 'Perte de poids', bien_etre: 'Bien-être' };

    const carteCommande = g => {
      const t = g.tete, r = t.confirmation_reponses || null;
      const livr = g.bons.map(b => '<div class="li rowc"><span class="dot ' + (b.statut === 'livre' ? 'ok' : b.statut === 'annule' ? 'bad' : 'info') + '"></span><div class="grow"><b style="font-weight:500">'
        + (b.jour_livraison ? esc(fdl(b.jour_livraison)) : '<span style="color:var(--red)">sans date</span>') + (b.creneau_livraison ? ' · ' + esc(b.creneau_livraison) : '')
        + ' · ' + b.nb_repas + ' repas</b><div class="meta">' + contenu(b) + '</div></div>' + chipStatut(b.statut) + '</div>').join('');
      const reponse = r ? '<div class="exbar" style="margin:10px 0 0"><span class="chip ' + (r.hors_zone ? 'bad' : 'ok') + '">Réponse du client</span><span>'
        + esc(r.mode === 'valider' ? 'A validé sans rien changer' : r.hors_zone ? 'Adresse hors zone : ' + (r.adresse || '') : 'A modifié sa livraison')
        + ' · ' + esc(fdh(r.le)) + (r.changements && r.changements.length ? '<br>' + r.changements.map(esc).join('<br>') : '') + '</span></div>' : '';
      const actif = t.statut !== 'annule';
      return '<div class="card" style="margin-top:12px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h3 style="margin:0">'
        + esc({ abonnement: 'Abonnement', unite: 'À l’unité', manuel: 'Manuelle' }[t.type] || t.type) + ' · ' + t.nb_repas + ' repas' + (g.bons.length > 1 ? ' × ' + g.bons.length + ' sem.' : '')
        + '</h3>' + chipConf(t.confirmation_statut) + (g.bons.some(b => b.modif_non_notifiee) ? '<span class="chip bad">Modif. non notifiée</span>' : '') + '</div>'
        + '<div class="muted" style="font-size:12px;margin-top:4px">Passée le ' + esc(fdh(t.created_at)) + (t.code_reception ? ' · code ' + esc(t.code_reception) : '')
        + (t.confirmation_envoyee_at ? ' · mail envoyé le ' + esc(fdh(t.confirmation_envoyee_at)) + (t.confirmation_nb_envois > 1 ? ' (' + t.confirmation_nb_envois + '×)' : '') : '')
        + (t.confirmee_at ? ' · confirmée le ' + esc(fdh(t.confirmee_at)) : '') + '</div>'
        + '<div style="font-size:13px;margin-top:8px">📍 ' + (t.adresse ? esc(t.adresse) : '<span style="color:var(--red)">adresse non renseignée</span>')
        + (t.contact_tel ? ' · ☎ ' + esc(t.contact_tel) : '') + (t.instructions_acces ? '<div class="muted" style="font-size:12px">' + esc(t.instructions_acces) + '</div>' : '') + '</div>'
        + '<div class="list" style="margin-top:8px">' + livr + '</div>' + reponse
        + (actif ? '<div class="foot" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">'
          + (g.bons.some(b => b.modif_non_notifiee) ? '<button class="btn sm" data-cl-notifier="' + t.id + '">Notifier la modification</button><button class="btn sm ghost" data-cl-ignorer="' + t.id + '">Ignorer</button>' : '')
          + '<button class="btn sm ghost" data-cl-envoyer="' + t.id + '">✉ ' + (t.confirmation_envoyee_at ? 'Renvoyer' : 'Envoyer') + ' le mail de confirmation</button>'
          + '<button class="btn sm primary" data-cl-modifier="' + g.bons.filter(b => FIGES.indexOf(b.statut) < 0).concat(g.bons)[0].id + '" data-cl-nom="' + esc(f.nom) + '">Modifier dans Production →</button></div>'
          : g.bons.some(b => b.modif_non_notifiee) ? '<div class="foot" style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end"><button class="btn sm" data-cl-annul="' + g.bons.find(b => b.modif_non_notifiee).id + '">Prévenir le client de l’annulation</button><button class="btn sm ghost" data-cl-ignorer="' + t.id + '">Ignorer</button></div>'
          : (t.annulation_motif === 'hors_zone' ? '<p class="muted" style="font-size:12px;margin:10px 0 0">Annulée car hors Île-de-France — paiement à rembourser' + (t.type === 'abonnement' ? ' et abonnement Stripe à résilier' : '') + ' à la main.</p>' : ''));
    };

    const cmds = commandesDe(f);
    drawer('<div class="dh"><div class="av lg dk">' + esc((f.nom[0] || '?').toUpperCase()) + '</div><div><h2>' + esc(f.nom) + '</h2><p class="muted" style="margin:2px 0 0;font-size:12.5px">'
      + esc(f.email || 'email inconnu') + '</p></div><button class="x" data-close aria-label="Fermer">×</button></div>'
      + '<div class="sect" style="margin-top:6px"><h2>Informations</h2></div><div class="card"><div class="list">'
      + info('Compte', c.inscrit_le ? 'Inscrit le ' + esc(fd(String(c.inscrit_le).slice(0, 10))) + ' · ' + esc(c.fournisseur || 'email') + (c.derniere_connexion ? ' · vu le ' + esc(fd(String(c.derniere_connexion).slice(0, 10))) : '') : 'Pas de compte (questionnaire seul)')
      + info('Abonnement', f.abo ? esc((f.abo.formule || '').replace('_', ' ')) + ' · ' + esc(f.abo.statut) : '')
      + info('Objectif', o.objectif_type ? esc(OBJ[o.objectif_type] || o.objectif_type) + (o.tdee ? ' · ' + Math.round(o.tdee) + ' kcal/j' : '') : '')
      + info('Profil', [o.sexe, o.age ? o.age + ' ans' : '', o.poids ? o.poids + ' kg' : '', o.taille ? o.taille + ' cm' : ''].filter(Boolean).map(esc).join(' · '))
      + info('Dernière adresse', derniere.adresse ? esc(derniere.adresse) : '')
      + info('Téléphone', esc((f.bons.find(b => b.contact_tel) || {}).contact_tel || ''))
      + '</div></div>'
      + '<div class="sect" style="margin-top:16px;display:flex;align-items:center"><h2>Commandes</h2><span>' + cmds.length + '</span>'
      + '<button class="btn sm ghost" style="margin-left:auto" data-cl-nouvelle="' + esc(f.uid) + '">+ Commande</button></div>'
      + (cmds.map(carteCommande).join('') || '<div class="empty">Aucune commande.</div>'));
  }

  /* ── Les envois ───────────────────────────────────────────────────────── */
  async function envoyer(bonId, raison, modifications, motif) {
    const r = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jetonStaff() },
      body: JSON.stringify({ action: 'commande_envoyer', bon_id: bonId, raison, modifications: modifications || [], motif: motif || '' })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
    return d;
  }
  async function ignorer(bonId) {
    // Tout le groupe : la fiche lit le drapeau sur chacun des bons.
    const D = await charger(); const b = Object.values(D.M).flatMap(f => f.bons).find(x => x.id === bonId);
    const ids = b ? Object.values(D.M).flatMap(f => f.bons).filter(x => baseRef(x) === baseRef(b)).map(x => x.id) : [bonId];
    await sb('bons_commande?id=in.(' + ids.join(',') + ')', { method: 'PATCH', body: JSON.stringify({ modif_non_notifiee: false }) });
  }

  /* ── L'alerte « notifier / ignorer » ──────────────────────────────────── */
  function css() {
    if (document.getElementById('clCss')) return;
    const s = document.createElement('style'); s.id = 'clCss';
    s.textContent = '#clAlerte{position:fixed;right:18px;bottom:18px;z-index:120;width:min(380px,calc(100vw - 36px));background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--nm-pop);padding:16px 16px 14px;transform:translateY(12px);opacity:0;transition:.22s}'
      + '#clAlerte.on{transform:none;opacity:1}#clAlerte:not(.on){pointer-events:none}'
      + '#clAlerte b{display:block;font-size:14px}#clAlerte ul{margin:8px 0 0;padding-left:18px;font-size:12.5px;color:var(--muted);max-height:120px;overflow:auto}'
      + '#clAlerte .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}';
    document.head.appendChild(s);
  }
  let alerteMin = null;
  function alerte(o) {
    css();
    let el = document.getElementById('clAlerte');
    if (!el) { el = document.createElement('div'); el.id = 'clAlerte'; el.setAttribute('role', 'alertdialog'); document.body.appendChild(el); }
    const nouveau = o.nouveau, annulee = o.annulee;
    el.innerHTML = '<b>' + (nouveau ? '🧾 Nouvelle commande pour ' : annulee ? '⛔ Commande annulée — ' : '✏️ Commande modifiée — ') + esc(o.nom || 'ce client') + '</b>'
      + '<div class="muted" style="font-size:12.5px;margin-top:4px">' + (nouveau ? 'Envoyer le mail de confirmation au client ?'
        : annulee ? 'Prévenir le client par email de cette annulation ?'
        : 'Notifier le client de cette modification ? Il recevra le récap à jour et devra la valider.') + '</div>'
      + (!annulee && o.changements && o.changements.length ? '<ul>' + o.changements.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')
      + (annulee ? '<textarea class="inp" id="clMotif" rows="2" maxlength="500" placeholder="Message au client (facultatif) — ex. rupture d’un ingrédient" style="width:100%;margin-top:10px"></textarea>' : '')
      + '<div class="acts"><button class="btn sm ghost" data-al="ignorer">Ignorer</button><button class="btn sm primary" data-al="notifier">' + (nouveau ? 'Envoyer' : annulee ? 'Prévenir le client' : 'Notifier') + '</button></div>';
    el.onclick = async e => {
      const b = e.target.closest('[data-al]'); if (!b) return;
      b.disabled = true;
      try {
        if (b.dataset.al === 'notifier') {
          const motif = annulee ? ((document.getElementById('clMotif') || {}).value || '') : '';
          const r = await envoyer(o.bonId, nouveau ? 'manuel' : annulee ? 'annulation' : 'modification', o.changements, motif);
          toast('✉ Envoyé à ' + r.to);
        } else if (!nouveau) { await ignorer(o.bonId); toast('Modification ignorée'); }
        fermerAlerte(); CL = null; rafraichirSiClients();
      } catch (err) { b.disabled = false; toast('Envoi impossible : ' + String(err.message || err).slice(0, 140)); }
    };
    requestAnimationFrame(() => el.classList.add('on')); setTimeout(() => el.classList.add('on'), 60);
    clearTimeout(alerteMin);
  }
  function fermerAlerte() { const el = document.getElementById('clAlerte'); if (el) el.classList.remove('on'); }
  function rafraichirSiClients() {
    if (typeof CUR !== 'undefined' && CUR === 'commercial' && SUB['vue-commercial'] === 'clients') render();
  }

  /* Appelé par crm.html après l'enregistrement d'une commande (formulaire), et
     par crm-production.js après une modification en ligne (repas, date).
     `avant` / `apres` : les champs du bon ; `recAvant` / `recApres` : les
     recettes { id: portions }. Compose la liste de ce qui a changé, marque la
     commande « modification non notifiée », et pose l'alerte. */
  async function apresModifBon(o) {
    const uid = o.uid || (o.apres && o.apres.user_id) || (o.avant && o.avant.user_id);
    if (synthetique(uid)) return;
    const ch = o.changements ? o.changements.slice() : [];
    const A = o.avant || {}, B = o.apres || {};
    if (!o.changements && !o.nouveau) {
      if ((A.jour_livraison || '') !== (B.jour_livraison || '')) ch.push('Livraison : ' + (A.jour_livraison ? fdl(A.jour_livraison) + ' → ' : '') + (B.jour_livraison ? fdl(B.jour_livraison) : 'à définir'));
      if ((A.nb_repas || 0) !== (B.nb_repas || 0)) ch.push('Nombre de repas : ' + A.nb_repas + ' → ' + B.nb_repas);
      if ((A.adresse || '') !== (B.adresse || '')) ch.push('Adresse : ' + (B.adresse || '—'));
      if ((A.contact_tel || '') !== (B.contact_tel || '')) ch.push('Téléphone : ' + (B.contact_tel || '—'));
      if ((A.instructions_acces || '') !== (B.instructions_acces || '')) ch.push('Accès : ' + (B.instructions_acces || '—'));
      if (B.statut === 'annule' && A.statut !== 'annule') ch.push('Commande annulée');
      const E = window.NattyProd && NattyProd.etat, nom = id => ((E && E.recettes || []).find(r => r.id === id) || {}).nom || 'Recette';
      const ra = o.recAvant || {}, rb = o.recApres || {};
      [...new Set(Object.keys(ra).concat(Object.keys(rb)))].forEach(id => {
        if ((ra[id] || 0) !== (rb[id] || 0)) ch.push(rb[id] ? (ra[id] ? nom(id) + ' : ' + ra[id] + ' → ' + rb[id] + ' portions' : nom(id) + ' × ' + rb[id] + ' ajouté') : nom(id) + ' retiré');
      });
      if (!ch.length) return;              // rien qui concerne le client
    }
    if (!o.nouveau) {
      try { await sb('bons_commande?id=eq.' + o.bonId, { method: 'PATCH', body: JSON.stringify({ modif_non_notifiee: true, modifiee_at: new Date().toISOString() }) }); } catch (e) {}
    }
    const D = await charger(true).catch(() => null);
    const f = D && D.M[uid];
    // Une annulation n'appelle pas une revalidation : c'est un autre email.
    const annulee = !o.nouveau && B.statut === 'annule' && A.statut !== 'annule';
    alerte({ bonId: o.bonId, nom: f ? f.nom : '', changements: ch, nouveau: !!o.nouveau, annulee });
  }

  /* ── Les gestes ───────────────────────────────────────────────────────── */
  document.addEventListener('click', async e => {
    const fl = e.target.closest('[data-cl-filtre]');
    if (fl) { ETAT.filtre = fl.dataset.clFiltre; render(); return; }
    const oc = e.target.closest('[data-ouvrir-client]');
    if (oc) { ouvrirClient(oc.dataset.ouvrirClient); return; }
    const ev = e.target.closest('[data-cl-envoyer]');
    if (ev) {
      ev.disabled = true; const lib = ev.textContent; ev.textContent = 'Envoi…';
      try { const r = await envoyer(ev.dataset.clEnvoyer, 'manuel'); toast('✉ Mail de confirmation envoyé à ' + r.to + (r.complet ? '' : ' (livraison à renseigner)')); CL = null; const uid = (Object.values((await charger()).M).find(f => f.bons.some(b => b.id === ev.dataset.clEnvoyer)) || {}).uid; if (uid) ouvrirClient(uid); rafraichirSiClients(); }
      catch (err) { ev.disabled = false; ev.textContent = lib; toast('Envoi impossible : ' + String(err.message || err).slice(0, 140)); }
      return;
    }
    const nt = e.target.closest('[data-cl-notifier]');
    if (nt) {
      nt.disabled = true;
      try { const r = await envoyer(nt.dataset.clNotifier, 'modification', []); toast('✉ Client notifié (' + r.to + ')'); CL = null; fermerAlerte(); const D = await charger(); const f = Object.values(D.M).find(x => x.bons.some(b => b.id === nt.dataset.clNotifier)); if (f) ouvrirClient(f.uid); rafraichirSiClients(); }
      catch (err) { nt.disabled = false; toast('Envoi impossible : ' + String(err.message || err).slice(0, 140)); }
      return;
    }
    const ca = e.target.closest('[data-cl-annul]');
    if (ca) {
      ca.disabled = true;
      try { const r = await envoyer(ca.dataset.clAnnul, 'annulation', []); toast('✉ Client prévenu (' + r.to + ')'); CL = null; fermerAlerte(); const D = await charger(); const f = Object.values(D.M).find(x => x.bons.some(b => b.id === ca.dataset.clAnnul)); if (f) ouvrirClient(f.uid); rafraichirSiClients(); }
      catch (err) { ca.disabled = false; toast('Envoi impossible : ' + String(err.message || err).slice(0, 140)); }
      return;
    }
    const ig = e.target.closest('[data-cl-ignorer]');
    if (ig) { await ignorer(ig.dataset.clIgnorer); CL = null; fermerAlerte(); const D = await charger(); const f = Object.values(D.M).find(x => x.bons.some(b => b.id === ig.dataset.clIgnorer)); if (f) ouvrirClient(f.uid); rafraichirSiClients(); return; }
    const md = e.target.closest('[data-cl-modifier]');
    if (md) {
      /* « Ramène à Production » : la vue Commandes, filtrée sur ce client, et
         le formulaire de la commande ouvert par-dessus. */
      closeAll();
      SUB['vue-production'] = 'commandes';
      try { CMD.q = md.dataset.clNom || ''; CMD.filtre = 'tous'; } catch (err) {}
      go('production');
      ouvrirFormBon(md.dataset.clModifier);
      return;
    }
    const nv = e.target.closest('[data-cl-nouvelle]');
    if (nv) { closeAll(); SUB['vue-production'] = 'commandes'; go('production'); ouvrirFormBon(null, null); setTimeout(() => { const s = document.getElementById('bfUid'); if (s) { s.value = nv.dataset.clNouvelle; s.dispatchEvent(new Event('change')); } }, 400); return; }
  });
  document.addEventListener('input', e => {
    if (e.target.id !== 'clQ') return;
    ETAT.q = e.target.value; clearTimeout(ETAT.t);
    ETAT.t = setTimeout(() => { const pos = e.target.selectionStart; render().then(() => { const i = document.getElementById('clQ'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }); }, 250);
  });

  window.vCommercialClients = vCommercialClients;
  window.ouvrirClientCRM = ouvrirClient;
  window.apresModifBon = apresModifBon;
  window.envoyerConfirmationCRM = envoyer;
  window.chipConfirmation = chipConf;
})();
