/* ═══════════════════════════════════════════════════════════
   Natty — Mini-jeux « Découvrir »
   ───────────────────────────────────────────────────────────
   3 jeux plein écran qui déterminent une CONTRAINTE de tirage,
   puis laissent NattyReco choisir les recettes qui respectent
   à la fois cette contrainte et le profil de l'utilisateur.

     1. Recettes du Monde — fléchette lancée sur le globe -> pays
     2. Ingrédients       — potager, on tire le légume -> ingrédient
     3. Aléatoire         — défilement rapide + STOP -> plat au hasard

   Usage :  NattyMiniJeux.ouvrir('monde'|'potager'|'aleatoire')

   Choix d'implémentation : le prototype s'appuie sur GSAP +
   Draggable (2 dépendances CDN). Ici tout est en pointer events
   natifs et transitions CSS. Deux raisons : le projet part vers
   Capacitor (où les chargements CDN sont une fragilité), et le
   drag maison écoute sur `document` plutôt que sur l'élément —
   c'est précisément le correctif appliqué au jeu Tier list, où
   setPointerCapture laissait des gestes inachevés (CLAUDE.md §7).
   ═══════════════════════════════════════════════════════════ */
var NattyMiniJeux = (function () {

  /* ── Tirages ─────────────────────────────────────────────── */

  var PAYS = [
    { f:'🇮🇹', n:'Italie' },   { f:'🇯🇵', n:'Japon' },    { f:'🇲🇽', n:'Mexique' },
    { f:'🇲🇦', n:'Maroc' },    { f:'🇮🇳', n:'Inde' },     { f:'🇬🇷', n:'Grèce' },
    { f:'🇹🇭', n:'Thaïlande' },{ f:'🇦🇱', n:'Albanie' },  { f:'🇵🇪', n:'Pérou' },
    { f:'🇱🇧', n:'Liban' },    { f:'🇻🇳', n:'Vietnam' },  { f:'🇪🇸', n:'Espagne' }
  ];

  var LEGUMES = [
    { e:'🥕', n:'Carotte' }, { e:'🥦', n:'Brocoli' },   { e:'🍅', n:'Tomate' },
    { e:'🌽', n:'Maïs' },    { e:'🍆', n:'Aubergine' }, { e:'🫑', n:'Poivron' },
    { e:'🎃', n:'Courge' },  { e:'🧅', n:'Oignon' },    { e:'🥬', n:'Chou kale' }
  ];

  var DEFILE = [
    { e:'🍜', n:'Ramen maison' },   { e:'🥑', n:'Toast avocat' },   { e:'🍣', n:'Plateau sushi' },
    { e:'🥗', n:'Bowl quinoa' },    { e:'🍲', n:'Chili' },          { e:'🧆', n:'Falafel' },
    { e:'🍝', n:'Pâtes' },          { e:'🍛', n:'Curry' },          { e:'🥘', n:'Paella' },
    { e:'🌯', n:'Wrap' },           { e:'🍤', n:'Crevettes sautées'},{ e:'🥙', n:'Pita garni' },
    { e:'🍚', n:'Riz cantonais' },  { e:'🫓', n:'Naan et dhal' },   { e:'🥟', n:'Dumplings' }
  ];

  function auHasard(a){ return a[Math.floor(Math.random()*a.length)]; }

  /* ── Styles ──────────────────────────────────────────────── */

  var CSS = ''
  + '#mjOverlay{position:fixed;inset:0;background:var(--bg,#fff);z-index:900;display:none;'
  +   'flex-direction:column;align-items:center;padding:24px 20px 40px;overflow-y:auto}'
  + '#mjOverlay.on{display:flex}'
  + '#mjOverlay .mj-close{position:absolute;top:18px;right:18px;width:36px;height:36px;'
  +   'border-radius:50%;background:var(--card,#ececef);border:none;font-size:16px;font-weight:700;cursor:pointer}'
  + '#mjOverlay .mj-title{font-size:20px;font-weight:900;text-align:center;margin:34px 0 6px;text-transform:uppercase}'
  + '#mjOverlay .mj-sub{font-size:13px;color:var(--muted,#9d9da8);text-align:center;max-width:290px;'
  +   'margin-bottom:20px;line-height:1.5}'
  + '#mjOverlay .mj-stage{width:100%;max-width:320px;display:flex;align-items:center;'
  +   'justify-content:center;position:relative;min-height:250px}'
  + '#mjOverlay .mj-cta{margin-top:20px;background:var(--ink,#101014);color:var(--on-ink,#fff);font-weight:800;'
  +   'font-size:14px;border:none;border-radius:22px;padding:14px 28px;cursor:pointer;font-family:inherit}'

  /* globe */
  + '.mj-globe-wrap{position:relative;width:210px;height:210px}'
  + '.mj-globe{width:210px;height:210px;border-radius:50%;'
  +   'background:radial-gradient(circle at 30% 30%,#7fc9a0,transparent 45%),'
  +   'radial-gradient(circle at 65% 60%,#6fb890,transparent 40%),linear-gradient(160deg,#3b7dd8,#1f4fa0);'
  +   'box-shadow:inset -14px -14px 30px rgba(0,0,0,.25),0 8px 24px rgba(16,16,18,.15);'
  +   'animation:mjSpin 14s linear infinite}'
  + '.mj-globe.fast{animation:mjSpin 1.1s linear infinite}'
  + '@keyframes mjSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'
  + '.mj-dart{position:absolute;font-size:30px;left:50%;top:50%;transform:translate(-50%,-50%);'
  +   'cursor:grab;touch-action:none;user-select:none;transition:transform .5s cubic-bezier(.2,.8,.3,1.2);z-index:3}'

  /* potager */
  + '.mj-garden{width:100%;max-width:300px;height:240px;position:relative;background:var(--card,#fbfbf9);'
  +   'border-radius:20px;overflow:hidden}'
  + '.mj-soil-back{position:absolute;left:0;right:0;bottom:0;height:52%;background:linear-gradient(180deg,#7a4f30,#5c3a20)}'
  // La fane est en haut (elle dépasse de la terre), le légume dessous et
  // enterré : c'est lui qui remonte quand on tire.
  + '.mj-plant{position:absolute;left:50%;bottom:-42px;width:70px;margin-left:-35px;display:flex;'
  +   'flex-direction:column;align-items:center;z-index:3;cursor:grab;touch-action:none;user-select:none}'
  + '.mj-plant .sprout{height:46px;display:flex;align-items:flex-end;justify-content:center;font-size:30px;line-height:1}'
  + '.mj-plant .body{height:150px;display:flex;align-items:flex-start;justify-content:center;font-size:54px;line-height:1;opacity:0}'
  + '.mj-soil-front{position:absolute;left:0;right:0;bottom:0;height:46%;z-index:5;'
  +   'background:linear-gradient(180deg,#8a5a37,#603c22);border-top:3px solid #6b4326}'
  + '.mj-hint{position:absolute;bottom:10px;left:0;right:0;text-align:center;font-size:11px;'
  +   'font-weight:700;color:#fff;opacity:.85;z-index:8;pointer-events:none}'
  + '.mj-dirt{position:absolute;width:7px;height:7px;border-radius:50%;background:#6b4326;z-index:7;pointer-events:none}'

  /* défilement */
  + '.mj-reel{width:260px;height:120px;border-radius:20px;background:var(--card,#ececef);display:flex;'
  +   'align-items:center;justify-content:center;overflow:hidden;position:relative}'
  + '.mj-reel-item{font-size:20px;font-weight:800;text-align:center;padding:0 10px}'
  + '.mj-stop{margin-top:22px;background:#e63e30;color:#fff;font-weight:900;font-size:16px;border:none;'
  +   'border-radius:50%;width:84px;height:84px;cursor:pointer;box-shadow:0 6px 18px rgba(230,62,48,.35);font-family:inherit}'
  + '.mj-stop:active{transform:scale(.94)}'

  /* résultat */
  + '.mj-result{width:100%;max-width:340px;margin-top:14px;display:none}'
  + '.mj-result.on{display:block}'
  + '.mj-head{display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:16px}'
  + '.mj-head .em{font-size:36px}'
  + '.mj-head .nm{font-size:18px;font-weight:900;text-transform:uppercase}'
  + '.mj-reco{background:var(--card,#ececef);border-radius:18px;padding:14px 16px;margin-bottom:10px;cursor:pointer}'
  + '.mj-reco .t{font-size:14px;font-weight:800}'
  + '.mj-reco .w{font-size:12px;color:var(--muted,#9d9da8);line-height:1.45;margin-top:4px}'
  + '.mj-reco .m{font-size:11px;font-weight:700;color:var(--muted,#9d9da8);margin-top:6px}'
  + '.mj-follow{width:100%;margin-top:8px;background:var(--ink,#101014);color:var(--on-ink,#fff);font-weight:800;'
  +   'border:none;border-radius:20px;padding:14px;font-size:14px;cursor:pointer;font-family:inherit}'
  + '.mj-retry{display:block;text-align:center;margin-top:14px;font-size:12.5px;'
  +   'color:var(--muted,#9d9da8);font-weight:700;text-decoration:underline;cursor:pointer}'
  + '.mj-load{text-align:center;color:var(--muted,#9d9da8);font-size:13px;padding:18px 0}';

  /* ── Squelette ───────────────────────────────────────────── */

  var el = null, jeuCourant = null, nettoyer = null;

  function monter(){
    if (el) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div');
    el.id = 'mjOverlay';
    el.innerHTML = ''
      + '<button class="mj-close" aria-label="Fermer">✕</button>'
      + '<div class="mj-title" id="mjTitle"></div>'
      + '<div class="mj-sub" id="mjSub"></div>'
      + '<div class="mj-stage" id="mjStage"></div>'
      + '<div id="mjAction"></div>'
      + '<div class="mj-result" id="mjResult"></div>';
    document.body.appendChild(el);
    el.querySelector('.mj-close').addEventListener('click', fermer);
  }

  function fermer(){
    if (nettoyer) { try { nettoyer(); } catch(e){} nettoyer = null; }
    if (el) el.classList.remove('on');
    var nav = document.getElementById('nattyNav');
    if (nav) nav.style.display = '';
    jeuCourant = null;
  }

  function ouvrir(jeu){
    monter();
    jeuCourant = jeu;
    // La nav basse est masquée pendant le jeu (plein écran).
    var nav = document.getElementById('nattyNav');
    if (nav) nav.style.display = 'none';
    document.getElementById('mjResult').className = 'mj-result';
    document.getElementById('mjResult').innerHTML = '';
    document.getElementById('mjAction').innerHTML = '';
    el.classList.add('on');
    el.scrollTop = 0;
    if (jeu === 'monde')    jeuGlobe();
    if (jeu === 'potager')  jeuPotager();
    if (jeu === 'aleatoire')jeuDefile();
  }

  function setTexte(titre, sous){
    document.getElementById('mjTitle').textContent = titre;
    document.getElementById('mjSub').textContent = sous;
  }

  /* ── Jeu 1 : globe + fléchette ───────────────────────────── */

  function jeuGlobe(){
    setTexte('Recettes du Monde',
      'La Terre va se mettre à tourner très vite. Glisse puis relâche pour lancer ta fléchette.');
    var stage = document.getElementById('mjStage');
    stage.innerHTML = '<div class="mj-globe-wrap"><div class="mj-globe" id="mjGlobe"></div>'
                    + '<div class="mj-dart" id="mjDart">🎯</div></div>';
    var act = document.getElementById('mjAction');
    act.innerHTML = '<button class="mj-cta" id="mjSpin">Faire tourner la Terre</button>';

    var globe = document.getElementById('mjGlobe'),
        dart  = document.getElementById('mjDart'),
        spin  = document.getElementById('mjSpin');
    var pret = false, lance = false, id = null, x0 = 0, y0 = 0;

    spin.addEventListener('click', function(){
      globe.classList.add('fast');
      spin.style.display = 'none';
      pret = true;
      document.getElementById('mjSub').textContent =
        'La Terre tourne à pleine vitesse. Glisse la fléchette puis lâche-la sur le globe.';
    });

    // Les listeners de suivi sont sur document (et non sur la fléchette) :
    // le geste se termine même si le doigt sort de l'élément.
    function onDown(e){
      if (!pret || lance) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY;
      dart.style.transition = 'none';
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    function onMove(e){
      if (e.pointerId !== id) return;
      dart.style.transform = 'translate(calc(-50% + '+(e.clientX-x0)+'px), calc(-50% + '+(e.clientY-y0)+'px))';
    }
    function onUp(e){
      if (e.pointerId !== id) return;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      dart.style.transition = '';
      lancer();
    }
    function lancer(){
      if (lance) return;
      lance = true; pret = false;
      var a = Math.random()*2*Math.PI, r = 55 + Math.random()*30;
      dart.style.transform = 'translate(calc(-50% + '+Math.cos(a)*r+'px), calc(-50% + '+Math.sin(a)*r+'px)) scale(.8)';
      setTimeout(function(){
        globe.classList.remove('fast');
        var pays = auHasard(PAYS);
        document.getElementById('mjSub').textContent = 'Ta destination culinaire :';
        proposer(pays.f, pays.n,
          'Cuisine ' + pays.n + ' : la recette doit clairement appartenir à la cuisine de ce pays.',
          function(){ ouvrir('monde'); });
      }, 550);
    }
    dart.addEventListener('pointerdown', onDown);

    nettoyer = function(){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }

  /* ── Jeu 2 : potager ─────────────────────────────────────── */

  // Course calée sur la géométrie du potager (jardin 240px, terre à 46%) :
  // au bout du tirage le légume est entièrement au-dessus de la terre sans
  // sortir du cadre, qui est en overflow:hidden.
  var TIRAGE = 104;    // course totale pour sortir le légume
  var SEUIL  = 0.88;   // au-delà, le légume est considéré comme récolté

  function jeuPotager(){
    setTexte('Ingrédients',
      "Tire vers le haut jusqu'à sortir le légume de terre — tu ne sauras ce que c'est qu'à la toute fin.");
    var stage = document.getElementById('mjStage');
    stage.innerHTML = '<div class="mj-garden" id="mjGarden">'
      + '<div class="mj-soil-back"></div>'
      + '<div class="mj-plant" id="mjPlant"><div class="sprout">🌿</div><div class="body" id="mjBody"></div></div>'
      + '<div class="mj-soil-front"></div>'
      + '<div class="mj-hint" id="mjHint">Tire ↑</div>'
      + '</div>';

    var garden = document.getElementById('mjGarden'),
        plant  = document.getElementById('mjPlant'),
        body   = document.getElementById('mjBody'),
        hint   = document.getElementById('mjHint');

    // Le légume est tiré au sort tout de suite mais n'est jamais affiché
    // avant le dernier tiers du geste : l'identité reste cachée.
    var legume = auHasard(LEGUMES);
    var id = null, y0 = 0, y = 0, recolte = false;

    function onDown(e){
      if (recolte) return;
      id = e.pointerId; y0 = e.clientY;
      plant.style.transition = 'none';
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    function onMove(e){
      if (e.pointerId !== id) return;
      y = Math.max(-TIRAGE, Math.min(0, e.clientY - y0));
      plant.style.transform = 'translateY('+y+'px)';
      var p = Math.min(1, -y / TIRAGE);
      if (p > 0.6){ body.textContent = legume.e; body.style.opacity = String((p-0.6)/0.4); }
      else { body.style.opacity = '0'; }
      hint.style.opacity = String(0.85 * (1-p));
    }
    function onUp(e){
      if (e.pointerId !== id) return;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      var p = Math.min(1, -y / TIRAGE);
      if (p >= SEUIL) recolter();
      else {
        // Retombe avec un rebond si on lâche trop tôt.
        plant.style.transition = 'transform .5s cubic-bezier(.34,1.56,.64,1)';
        plant.style.transform = 'translateY(0)';
        body.style.opacity = '0';
        hint.style.opacity = '.85';
        y = 0;
      }
    }
    function recolter(){
      recolte = true;
      hint.style.opacity = '0';
      body.textContent = legume.e; body.style.opacity = '1';
      plant.style.transition = 'transform .35s cubic-bezier(.34,1.8,.64,1)';
      // Pas de dépassement supplémentaire : le cadre est en overflow:hidden,
      // le légume serait rogné. L'effet de sortie passe par le scale.
      plant.style.transform = 'translateY('+(-TIRAGE)+'px) scale(1.06)';
      eclatsTerre(garden);
      setTimeout(function(){
        document.getElementById('mjSub').textContent = 'Tu as sorti :';
        proposer(legume.e, legume.n,
          'La recette doit mettre en valeur cet ingrédient : ' + legume.n + '.',
          function(){ ouvrir('potager'); });
      }, 420);
    }
    plant.addEventListener('pointerdown', onDown);

    nettoyer = function(){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }

  function eclatsTerre(garden){
    for (var i=0;i<10;i++){
      (function(){
        var b = document.createElement('div');
        b.className = 'mj-dirt';
        b.style.left = '50%'; b.style.bottom = '46%';
        garden.appendChild(b);
        var a = Math.random()*Math.PI + Math.PI, d = 30 + Math.random()*50;
        requestAnimationFrame(function(){
          b.style.transition = 'transform .7s cubic-bezier(.2,.7,.4,1), opacity .7s linear';
          b.style.transform = 'translate('+Math.cos(a)*d+'px,'+Math.sin(a)*d+'px)';
          b.style.opacity = '0';
        });
        setTimeout(function(){ if (b.parentNode) b.parentNode.removeChild(b); }, 800);
      })();
    }
  }

  /* ── Jeu 3 : défilement ──────────────────────────────────── */

  function jeuDefile(){
    setTexte('Aléatoire', 'Des plats défilent à toute vitesse. Appuie sur STOP pour figer ta prochaine recette.');
    var stage = document.getElementById('mjStage');
    stage.innerHTML = '<div class="mj-reel"><div class="mj-reel-item" id="mjReel">🍜</div></div>';
    document.getElementById('mjAction').innerHTML = '<button class="mj-stop" id="mjStop">STOP</button>';

    var item = document.getElementById('mjReel'), stop = document.getElementById('mjStop');
    var courant = auHasard(DEFILE);
    var timer = setInterval(function(){
      courant = auHasard(DEFILE);
      item.textContent = courant.e + ' ' + courant.n;
    }, 90);

    stop.addEventListener('click', function(){
      clearInterval(timer); timer = null;
      stop.style.display = 'none';
      document.getElementById('mjSub').textContent = 'Le sort a choisi :';
      proposer(courant.e, courant.n,
        'Pars de cette idée de plat : ' + courant.n + '.',
        function(){ ouvrir('aleatoire'); });
    });

    nettoyer = function(){ if (timer) clearInterval(timer); };
  }

  /* ── Résultat : le tirage devient une contrainte pour l'algo ─ */

  function proposer(emoji, nom, contrainte, rejouer){
    var res = document.getElementById('mjResult');
    res.className = 'mj-result on';
    res.innerHTML = '<div class="mj-head"><span class="em">'+emoji+'</span><span class="nm">'+nom+'</span></div>'
                  + '<div class="mj-load">Je cherche des recettes qui te correspondent…</div>';
    document.getElementById('mjAction').innerHTML = '';

    NattyReco.recommander(3, contrainte).then(function(recettes){
      var corps;
      if (recettes && recettes.length){
        corps = recettes.map(function(r, i){
          var m = r.macros || {};
          return '<div class="mj-reco" data-i="'+i+'">'
            + '<div class="t">'+txt(r.nom)+'</div>'
            + (r.pourquoi ? '<div class="w">'+txt(r.pourquoi)+'</div>' : '')
            + '<div class="m">'+(m.kcal||'–')+' kcal · '+(m.p||'–')+'g prot'
            +   (r.temps_min ? ' · '+r.temps_min+' min' : '')+'</div>'
            + '</div>';
        }).join('');
      } else {
        // L'IA peut être indisponible : on ne laisse pas l'écran vide.
        corps = '<div class="mj-load">Impossible de générer des recettes pour le moment.<br>'
              + 'Ton tirage : <b>'+txt(nom)+'</b> — retente dans un instant.</div>';
      }
      res.innerHTML = '<div class="mj-head"><span class="em">'+emoji+'</span><span class="nm">'+txt(nom)+'</span></div>'
                    + corps
                    + (recettes && recettes.length ? '<button class="mj-follow" id="mjFollow">Suivre cette recette</button>' : '')
                    + '<span class="mj-retry" id="mjRetry">Rejouer</span>';

      var choisi = 0;
      res.querySelectorAll('.mj-reco').forEach(function(c){
        c.addEventListener('click', function(){
          choisi = +c.dataset.i;
          res.querySelectorAll('.mj-reco').forEach(function(o){ o.style.outline = ''; });
          c.style.outline = '2px solid var(--ink,#101014)';
        });
      });
      var f = document.getElementById('mjFollow');
      if (f) f.addEventListener('click', function(){
        var r = recettes[choisi];
        fermer();
        if (typeof window.NattyOnRecetteSuivie === 'function') window.NattyOnRecetteSuivie(r);
      });
      document.getElementById('mjRetry').addEventListener('click', rejouer);
    });
  }

  function txt(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { ouvrir: ouvrir, fermer: fermer };
})();
