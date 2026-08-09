/* ═══════════════════════════════════════════════════════════
   Natty — Parcours « Ajouter un plat » (bouton + de la nav)
   Composant unique, injecté par-dessus n'importe quel écran.

   Le bouton + ouvre DIRECTEMENT la caméra : l'appel input.click()
   doit rester synchrone dans le geste utilisateur (sinon iOS/WebKit
   bloque l'ouverture). D'où un overlay et non une page séparée —
   naviguer d'abord ferait perdre le geste.

   Enchaînement des écrans (cf. maquettes) :
     photo → analyse IA → « Votre premier repas » (anneaux de macros
     restantes pour CE repas) → « Réussir votre objectif » (4 options)
     → carrousel de suggestions → retour aux anneaux, qui diminuent.

   Dépend de assets/core.js (Natty.*). Toute évolution du parcours se
   fait ici uniquement, pas dupliquée par page.
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (typeof Natty === 'undefined') {
    console.warn('[natty-ajout] assets/core.js est requis avant assets/ajout.js');
    return;
  }

  var CLAUDE_API = 'https://natty-suivi.vercel.app/api/claude';
  var CIRC = 2 * Math.PI * 52;               // circonférence des anneaux (r=52)
  var ORD = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième'];

  var COL = { p: '#ff6b5e', l: '#5ac47d', g: '#f0a94b' };
  var EM  = { p: '🥩', l: '🥑', g: '🌾' };

  /* ═══ État de la session d'ajout ═══
     S.plats : tout ce qui a été composé pendant la session. Le premier
     est le plat photographié ; « Un autre repas » / « dessert » en
     ajoutent un nouveau, « ingrédients » / « me resservir » enrichissent
     le plat courant. Rien n'est écrit en base avant « Terminer ». */
  var S = null;
  var cibleJour = null;      // objectifs quotidiens (onboarding)
  var nbRepas = 3;           // repas par jour (onboarding)
  var repasDuJour = 0;       // repas déjà enregistrés aujourd'hui
  var dom = null;            // racine de l'overlay, construite une seule fois
  var inputCam = null, inputGal = null;
  var okTimer = null;        // minuteur de la transition « rond + V vert »

  /* ═══════════════════ Styles ═══════════════════ */
  var CSS = ''
    /* ⚠️ `overflow:hidden`, et non `auto` : la page du bouton + est FIXE
       (demande de Pablo). Anneaux, nom du plat et boutons restent en place ;
       c'est la liste des ingrédients, et elle seule, qui défile — voir
       .na-detail-body plus bas. La chaîne `min-height:0` sur chaque
       conteneur flex est indispensable : sans elle, un enfant scrollable
       refuse de rétrécir sous sa hauteur de contenu et c'est la page
       entière qui repart en débordement. */
    + '#nattyAjout{position:fixed;inset:0;z-index:900;background:#000;color:#fff;display:none;'
      + 'flex-direction:column;font-family:\'Inter\',sans-serif;overflow:hidden}'
    + '#nattyAjout.on{display:flex}'
    + '#nattyAjout .na-col{width:100%;max-width:480px;margin:0 auto;padding:0 22px calc(20px + env(safe-area-inset-bottom,0px));'
      + 'flex:1;min-height:0;display:flex;flex-direction:column}'
    + '#nattyAjout .na-top{display:flex;align-items:center;justify-content:space-between;'
      + 'padding:calc(18px + env(safe-area-inset-top,0px)) 0 6px}'
    + '#nattyAjout .na-top button{background:none;border:none;padding:0;cursor:pointer;display:flex;'
      + 'align-items:center;justify-content:center;color:#8a8a92}'
    + '#nattyAjout .na-top svg{width:26px;height:26px;stroke:#8a8a92;fill:none}'
    /* ⚠️ TITRE SUR UNE LIGNE, ET REMONTÉ (demande de Pablo, 2026-08-05). À 38 px,
       « Votre sixième repas 🥗 » passait sur deux lignes et mangeait 81 px de
       haut — pris directement sur le cadre photo, qui est le sujet de l'écran. */
    + '#nattyAjout h1{font-size:25px;line-height:1.12;font-weight:900;letter-spacing:-.6px;'
      + 'text-align:center;margin:2px 0 0}'
    + '#nattyAjout .na-screen{display:none;flex:1;min-height:0;flex-direction:column;'
      + 'overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}'
    + '#nattyAjout .na-screen.on{display:flex;animation:naIn .32s cubic-bezier(.22,1,.36,1)}'
    + '@keyframes naIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'

    /* — photo du plat —
       ⚠️ `object-fit:contain`, et un cadre PORTRAIT. En `cover` dans un cadre
       4/3, un cliché de téléphone (3/4) était rogné des deux tiers : on cadrait
       son assiette sur une vue tronquée, et la photo réellement analysée ne
       ressemblait pas à ce qu'on avait vu. Le viseur montre maintenant
       exactement ce que la capture enverra.

       ⚠️⚠️ LE CADRE ÉTAIT DÉCLARÉ 3/4 ET RENDU 1,67 — mesuré à 390×844 :
       346 × 207 px. `aspect-ratio` donnait une hauteur préférée de 461 px, le
       contenu de l'écran dépassait donc la fenêtre, et le cadre étant le SEUL
       élément vraiment compressible, c'est lui qui absorbait tout le manque
       (`flex-shrink` vaut 1 par défaut). Un `aspect-ratio` ne survit pas à une
       compression flex : la largeur restait étirée à 100 %, la hauteur tombait,
       et le rapport partait à l'envers. Conséquence visible : une photo de
       téléphone en `contain` s'affichait en bande de 152 px entre deux bandes
       noires de 95 px — c'est ce que Pablo a photographié.

       La correction inverse la logique : un conteneur `flex:1` prend toute la
       place restante, et le cadre s'y inscrit en `height:100%` + `aspect-ratio`,
       donc c'est la LARGEUR qui se déduit de la hauteur disponible. Le rapport
       3/4 est tenu par construction, quelle que soit la taille de l'écran, et
       `margin:0 auto` le centre. Une photo portrait remplit alors le cadre
       exactement : plus de bandes du tout. */
    /* ⚠️ `min-height` OBLIGATOIRE, et c'est le petit écran qui l'impose. Mesuré
       à 375×667 (iPhone SE) sans lui : le contenu fixe — anneaux, restants,
       détail, boutons — mange tout, le conteneur `flex:1` ne reçoit plus que
       119 px et le cadre tombe à 89×119. Un timbre-poste. Avec le plancher,
       l'écran préfère défiler de quelques dizaines de pixels plutôt que de
       réduire la photo à rien : entre « tout voir d'un coup » et « voir son
       plat », c'est le plat qui compte sur cet écran-là. Sur un téléphone
       courant (390×844 et au-delà) rien ne défile, le plancher n'est jamais
       atteint. */
    + '#nattyAjout .na-hero-wrap{flex:1;min-height:236px;display:flex;justify-content:center;margin:10px 0 4px}'
    + '#nattyAjout .na-hero{height:100%;aspect-ratio:3/4;max-width:100%;'
      + 'border-radius:26px;border:2px solid rgba(255,255,255,.9);'
      + 'overflow:hidden;background:#0c0c0e;'
      + 'display:flex;align-items:center;justify-content:center}'
    + '#nattyAjout .na-hero img{width:100%;height:100%;object-fit:contain;display:block}'
    + '#nattyAjout .na-hero .na-hero-em{font-size:58px}'
    /* — prise de vue DANS le cadre (voir camDemarrer) — */
    + '#nattyAjout .na-hero{position:relative}'
    + '#nattyAjout .na-hero video{width:100%;height:100%;object-fit:contain;display:block}'
    + '#nattyAjout .na-shutter{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);'
      + 'width:58px;height:58px;border-radius:50%;border:4px solid rgba(255,255,255,.95);'
      + 'background:rgba(255,255,255,.3);cursor:pointer;padding:0}'
    + '#nattyAjout .na-shutter:active{background:rgba(255,255,255,.6)}'
    + '#nattyAjout .na-hero-fb{display:flex;flex-direction:column;align-items:center;gap:9px;'
      + 'background:none;border:none;font-family:inherit;font-size:13px;font-weight:700;'
      + 'color:#d8d8de;cursor:pointer;padding:18px;line-height:1.35;text-align:center;'
      + 'white-space:pre-line}'   /* les \n du message de repli font des retours */
    + '#nattyAjout .na-hero-fb .em{font-size:42px}'
    /* — les deux autres sources : galerie, saisie — discrètes sous le cadre.
       Un lien plat plutôt qu'un bouton plein : la photo reste le geste
       principal, ces deux-là ne doivent pas lui disputer l'attention. */
    + '#nattyAjout .na-src{display:flex;gap:8px;justify-content:center;margin-top:8px}'
    + '#nattyAjout .na-src-b{background:rgba(255,255,255,.07);border:none;border-radius:999px;'
      + 'color:#c9c9d1;font-family:inherit;font-size:12.5px;font-weight:700;padding:8px 14px;cursor:pointer}'
    + '#nattyAjout .na-src-b:active{background:rgba(255,255,255,.16)}'
    + '#nattyAjout .na-plat-nom{display:block;width:100%;text-align:center;font-family:inherit;font-size:15px;'
      + 'font-weight:700;color:#d8d8de;margin-top:8px;background:none;border:none;outline:none;padding:2px}'
    + '#nattyAjout .na-plat-plus{text-align:center;font-size:12.5px;color:#6e6e78;margin-top:2px}'
    + '#nattyAjout .na-vigns{display:flex;gap:8px;justify-content:center;margin-top:6px;'
      + 'flex-wrap:wrap;min-height:0}'
    + '#nattyAjout .na-vign{position:relative;width:46px;height:46px;border-radius:14px;'
      + 'overflow:hidden;border:1px solid #2b2b30;background:#111;padding:0;cursor:pointer}'
    + '#nattyAjout .na-vign img{width:100%;height:100%;object-fit:cover;display:block}'
    + '#nattyAjout .na-vign .x{position:absolute;top:0;right:0;background:rgba(0,0,0,.6);'
      + 'color:#fff;font-size:10px;line-height:1;padding:3px 4px;border-bottom-left-radius:8px}'

    /* — anneaux de macros restantes — */
    + '#nattyAjout .na-rings{display:flex;justify-content:space-between;gap:8px;margin:14px 0 0}'
    + '#nattyAjout .na-ring{position:relative;flex:1;max-width:132px;aspect-ratio:1}'
    /* Version −30 % pour l'écran de prise de vue : le cadre photo y est le sujet,
       les anneaux ne sont qu'un rappel de ce qu'il reste. Tout est réduit dans le
       même rapport — diamètre, épaisseur du trait, textes — sinon un anneau plus
       petit avec le même trait de 9 px paraît épais et sale. */
    + '#nattyAjout .na-rings.mini{gap:10px;justify-content:center;margin:12px 0 0}'
    + '#nattyAjout .na-rings.mini .na-ring{max-width:92px}'
    + '#nattyAjout .na-rings.mini .bg,#nattyAjout .na-rings.mini .arc{stroke-width:6.5}'
    + '#nattyAjout .na-rings.mini .na-ring-lbl{font-size:9px}'
    + '#nattyAjout .na-rings.mini .na-ring-em{font-size:11px}'
    + '#nattyAjout .na-rings.mini .na-ring-val{font-size:15px}'
    + '#nattyAjout .na-ring svg{width:100%;height:100%;transform:rotate(-90deg);display:block}'
    + '#nattyAjout .na-ring .bg{fill:none;stroke:#2b2b30;stroke-width:9}'
    + '#nattyAjout .na-ring .arc{fill:none;stroke-width:9;stroke-linecap:round;'
      + 'transition:stroke-dasharray .9s cubic-bezier(.22,1,.36,1)}'
    + '#nattyAjout .na-ring-in{position:absolute;inset:0;display:flex;flex-direction:column;'
      + 'align-items:center;justify-content:center;gap:1px;pointer-events:none}'
    + '#nattyAjout .na-ring-lbl{font-size:12.5px;font-weight:600;color:#f2f2f5}'
    + '#nattyAjout .na-ring-em{font-size:16px;line-height:1}'
    + '#nattyAjout .na-ring-val{font-size:21px;font-weight:800;color:#c9c9d1;letter-spacing:-.5px}'
    /* Compacté (2026-08-05) : ces pixels-là repartent au cadre photo. « Restants »
       est un intertitre, pas un chiffre — il n'a pas besoin d'être plus gros que
       les valeurs des anneaux. */
    + '#nattyAjout .na-restants{text-align:center;font-size:17px;font-weight:600;color:#8a8a92;margin:10px 0 2px}'

    /* — module « calories restantes », noir métallisé —
       Reprise du vocabulaire de `suivi.html` (`--metal-black` / `--sh-metal`,
       demande de Pablo) : mêmes deux reflets, même relief. Les VALEURS sont
       recopiées et non héritées d'une variable : ces tokens vivent dans le
       <style> de suivi.html, pas dans assets/style.css, et cet overlay s'invite
       sur cinq écrans dont quatre ne les définissent pas. */
    + '#nattyAjout .na-kmod{margin:14px 0 0;border-radius:26px;padding:17px 20px;'
      + 'display:flex;align-items:center;justify-content:space-between;gap:14px;'
      + 'background:radial-gradient(130% 65% at 12% -10%, rgba(255,255,255,.11) 0%, rgba(255,255,255,0) 42%),'
      + 'linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 28%),'
      + 'linear-gradient(165deg, #0c0d0f 0%, #050506 55%, #000 100%);'
      + 'box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.6),0 10px 24px rgba(0,0,0,.5)}'
    + '#nattyAjout .na-kmod-l{min-width:0}'
    + '#nattyAjout .na-kmod-t{font-size:15px;font-weight:800;color:#fff;letter-spacing:-.2px}'
    + '#nattyAjout .na-kmod-s{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.45);margin-top:2px}'
    + '#nattyAjout .na-kmod-v{text-align:right;flex:none}'
    + '#nattyAjout .na-kmod-n{font-size:31px;font-weight:800;color:#fff;letter-spacing:-.03em;line-height:1}'
    + '#nattyAjout .na-kmod-u{font-size:11px;font-weight:700;color:rgba(255,255,255,.42);margin-top:3px}'

    /* — transition de validation, reprise d'assets/planning.js (`.vok`) —
       Le rond se trace, puis le V. Deux animations distinctes et décalées : un
       seul tracé continu ne se lit pas comme une validation. */
    + '#nattyAjout .na-vok{width:118px;height:118px;margin:0 auto 26px}'
    + '#nattyAjout .na-vok svg{width:100%;height:100%;fill:none;stroke-width:5;'
      + 'stroke-linecap:round;stroke-linejoin:round}'
    + '#nattyAjout .na-vok .rond{stroke:#34c759;stroke-dasharray:264;stroke-dashoffset:264;'
      + 'animation:naTrace .8s cubic-bezier(.22,1,.36,1) forwards}'
    + '#nattyAjout .na-vok .coche{stroke:#34c759;stroke-dasharray:70;stroke-dashoffset:70;'
      + 'animation:naTrace .5s cubic-bezier(.22,1,.36,1) .55s forwards}'
    + '@keyframes naTrace{to{stroke-dashoffset:0}}'
    + '#nattyAjout .na-ok{flex:1;min-height:0;display:flex;flex-direction:column;'
      + 'align-items:center;justify-content:center;text-align:center}'
    + '#nattyAjout .na-ok-t{font-size:27px;font-weight:900;letter-spacing:-.6px;'
      + 'opacity:0;animation:naOkIn .5s cubic-bezier(.22,1,.36,1) .75s forwards}'
    + '#nattyAjout .na-ok-s{font-size:13.5px;color:#8a8a92;margin-top:8px;max-width:280px;'
      + 'line-height:1.45;opacity:0;animation:naOkIn .5s cubic-bezier(.22,1,.36,1) 1s forwards}'
    + '@keyframes naOkIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
    + '#nattyAjout .na-kcal-line{text-align:center;font-size:12.5px;color:#6e6e78}'

    /* — détail du repas en cours — */
    + '#nattyAjout .na-detail{margin:10px 0 0;display:flex;flex-direction:column;min-height:0}'
    + '#nattyAjout .na-detail-h{width:100%;background:none;border:none;color:#8a8a92;font-family:inherit;'
      + 'font-size:12.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 0}'
    /* ⚠️ `max-height` ajouté en même temps que le défilement de secours de
       `.na-screen`. Dès lors que l'écran PEUT défiler, un enfant en `flex:1`
       n'est plus forcé de rétrécir : la liste des ingrédients se serait
       dépliée en entier et c'est la page entière qui aurait défilé — l'inverse
       de ce qui est voulu ici (voir l'en-tête : anneaux et boutons restent en
       place, seule la liste défile). Le plafond lui rend son propre scroll. */
    + '#nattyAjout .na-detail-body{display:none;margin-top:6px}'
    + '#nattyAjout .na-detail-body.on{display:block;overflow-y:auto;-webkit-overflow-scrolling:touch;'
      + 'overscroll-behavior:contain;flex:1;min-height:0;max-height:34vh;padding-right:2px}'
    + '#nattyAjout .na-detail.ouvert{flex:1}'
    + '#nattyAjout .na-grp{font-size:11px;font-weight:800;color:#6e6e78;text-transform:uppercase;'
      + 'letter-spacing:.4px;margin:12px 0 6px}'
    + '#nattyAjout .na-item{display:flex;align-items:center;gap:10px;background:#141418;border-radius:16px;'
      + 'padding:10px 12px;margin-bottom:7px}'
    /* Aliment que ni l'analyse ni la table ne savent chiffrer : il compte pour
       zéro, et ça doit se voir. Un liseré ambre, pas une alerte — le repas est
       valable, c'est une ligne à préciser. */
    + '#nattyAjout .na-item.na-inconnu{box-shadow:inset 0 0 0 1px rgba(255,159,10,.55)}'
    + '#nattyAjout .na-item.na-inconnu .em::after{content:"?";font-size:11px;font-weight:800;'
      + 'color:#ff9f0a;vertical-align:super;margin-left:1px}'
    + '#nattyAjout .na-item .em{font-size:19px}'
    + '#nattyAjout .na-item .nm{flex:1;font-size:13.5px;font-weight:600;color:#eaeaef;min-width:0;'
      + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '#nattyAjout .na-item input{width:62px;background:#0a0a0c;border:1px solid #2b2b30;border-radius:10px;'
      + 'color:#fff;font-family:inherit;font-size:13px;font-weight:700;padding:6px 8px;text-align:right}'
    + '#nattyAjout .na-item .u{font-size:12px;color:#6e6e78}'
    + '#nattyAjout .na-item .del{background:none;border:none;color:#6e6e78;font-size:14px;cursor:pointer;padding:4px}'
    + '#nattyAjout .na-mini{width:100%;background:none;border:1px dashed #33333a;border-radius:14px;'
      + 'color:#8a8a92;font-family:inherit;font-size:12.5px;font-weight:600;padding:11px;cursor:pointer;margin-top:4px}'

    /* — boutons — */
    + '#nattyAjout .na-cta{margin-top:auto;padding-top:14px;display:flex;flex-direction:column;gap:10px}'
    + '#nattyAjout .na-btn{width:100%;border:none;border-radius:var(--r-full,999px);font-family:inherit;'
      + 'font-size:20px;font-weight:800;letter-spacing:-.3px;padding:16px;cursor:pointer;'
      + 'display:flex;align-items:center;justify-content:center;gap:12px;transition:transform .12s}'
    + '#nattyAjout .na-btn:active{transform:scale(.975)}'
    + '#nattyAjout .na-btn.primary{background:#f2f2f7;color:#0a0a0c}'
    + '#nattyAjout .na-btn.ghost{background:none;color:#8a8a92;font-size:15px;font-weight:700;padding:12px}'
    /* « Terminer et enregistrer » était un simple texte gris : personne ne
       voyait que c'était LUI qui enregistrait le repas. Bouton noir en
       relief — le fond de cet écran étant noir, le neumorphisme se fait
       avec une ombre portée sombre ET un liseré clair, sinon il n'y a
       rien à voir. Plus petit que « Enrichir », comme demandé. */
    + '#nattyAjout .na-btn.sombre{background:#16161b;color:#f2f2f7;font-size:16px;font-weight:800;'
      + 'padding:15px 22px;width:auto;min-width:64%;margin:0 auto;'
      + 'box-shadow:7px 8px 18px rgba(0,0,0,.75),-4px -5px 14px rgba(255,255,255,.07),'
      + 'inset 0 1px 0 rgba(255,255,255,.06)}'
    + '#nattyAjout .na-btn.sombre:active{box-shadow:inset 5px 6px 14px rgba(0,0,0,.8),'
      + 'inset -3px -3px 10px rgba(255,255,255,.05)}'
    + '#nattyAjout .na-btn[disabled]{opacity:.5;pointer-events:none}'
    /* ── Bilan : ce qui suit l'enregistrement ──────────────────────
       Une cinématique courte (la coche, puis l'analyse), et à la fin le seul
       choix qui reste : publier ce plat, ou le garder pour soi. */
    + '#nattyAjout .na-bilan{flex:1;min-height:0;display:flex;flex-direction:column}'
    + '#nattyAjout .na-bcheck{margin:26px auto 0;width:88px;height:88px;border-radius:50%;'
      + 'background:#14351f;border:2px solid #2fd36b;display:flex;align-items:center;'
      + 'justify-content:center;font-size:40px;animation:naPop .5s cubic-bezier(.34,1.56,.64,1)}'
    + '@keyframes naPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}'
    + '#nattyAjout .na-btitre{text-align:center;font-size:22px;font-weight:900;letter-spacing:-.5px;margin-top:18px}'
    + '#nattyAjout .na-bsub{text-align:center;font-size:13px;color:#8a8a92;margin-top:8px;line-height:1.5}'
    + '#nattyAjout .na-bcorps{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;'
      + 'overscroll-behavior:contain;margin-top:20px;opacity:0;transition:opacity .5s ease}'
    + '#nattyAjout .na-bcorps.on{opacity:1}'
    /* La suggestion du prochain repas arrive APRÈS l'analyse, et se révèle de
       la même façon — mais séparément, sinon les deux se lisent comme un bloc. */
    + '#nattyAjout .na-brev{opacity:0;transform:translateY(12px);'
      + 'transition:opacity .5s ease,transform .5s cubic-bezier(.22,1,.36,1)}'
    + '#nattyAjout .na-brev.on{opacity:1;transform:none}'
    + '#nattyAjout .na-bsec{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;'
      + 'color:#6e6e78;margin:16px 0 8px}'
    + '#nattyAjout .na-bcard{background:#141418;border-radius:16px;padding:12px 14px;margin-bottom:7px;'
      + 'font-size:13.5px;line-height:1.5;color:#eaeaef;border-left:3px solid #2b2b30}'
    + '#nattyAjout .na-bcard.plus{border-left-color:#2fd36b}'
    + '#nattyAjout .na-bcard.moins{border-left-color:#f0b429}'
    + '#nattyAjout .na-bnote{display:inline-block;background:#1d1d22;border-radius:99px;padding:6px 14px;'
      + 'font-size:12px;font-weight:800;color:#eaeaef}'
    /* La suggestion du prochain repas : une carte, pas une liste — c'est une
       proposition, on doit pouvoir la lire d'un coup d'œil. */
    + '#nattyAjout .na-next{background:#f2f2f7;color:#0a0a0c;border-radius:20px;padding:16px 16px 14px}'
    + '#nattyAjout .na-next .t{font-size:16px;font-weight:900;letter-spacing:-.3px}'
    + '#nattyAjout .na-next .w{font-size:12.5px;color:#5b5b66;margin-top:6px;line-height:1.5}'
    + '#nattyAjout .na-next .mm{display:flex;gap:6px;margin-top:12px}'
    + '#nattyAjout .na-next .mm span{flex:1;background:rgba(10,10,12,.06);border-radius:12px;'
      + 'padding:7px 0;text-align:center;font-size:11.5px;font-weight:800}'
    + '#nattyAjout .na-next .ii{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}'
    + '#nattyAjout .na-next .ii i{font-style:normal;background:rgba(10,10,12,.06);border-radius:99px;'
      + 'padding:5px 10px;font-size:11px;font-weight:700}'
    + '#nattyAjout .na-choix{display:flex;flex-direction:column;gap:9px;padding-top:16px}'
    + '#nattyAjout .na-opts{display:flex;flex-direction:column;gap:18px;margin:44px 0 0}'
    + '#nattyAjout .na-opt{width:100%;background:#ececf3;color:#0a0a0c;border:none;border-radius:26px;'
      + 'font-family:inherit;font-size:26px;font-weight:800;letter-spacing:-.6px;line-height:1.15;'
      + 'padding:26px 18px;cursor:pointer;transition:transform .12s}'
    + '#nattyAjout .na-opt:active{transform:scale(.975)}'

    /* — analyse / erreur — */
    + '#nattyAjout .na-wait{flex:1;display:flex;flex-direction:column;align-items:center;'
      + 'justify-content:center;gap:16px;text-align:center;padding:40px 0}'
    + '#nattyAjout .na-spin{width:34px;height:34px;border:3px solid #26262c;border-top-color:#fff;'
      + 'border-radius:50%;animation:naSpin .9s linear infinite}'
    + '@keyframes naSpin{to{transform:rotate(360deg)}}'
    + '#nattyAjout .na-wait-t{font-size:17px;font-weight:700}'
    + '#nattyAjout .na-wait-s{font-size:13px;color:#8a8a92;max-width:260px}'

    /* — carrousel de suggestions — */
    + '#nattyAjout .na-carou{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;'
      // Le padding latéral vaut la moitié de ce qui dépasse de la carte :
      // la première et la dernière se centrent, et les voisines dépassent
      // des deux côtés comme sur la maquette.
      + 'margin:34px -22px 0;padding:0 34px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch}'
    + '#nattyAjout .na-carou::-webkit-scrollbar{display:none}'
    + '#nattyAjout .na-card{scroll-snap-align:center;flex:0 0 100%;background:#0d0d10;'
      + 'border:1px solid #1c1c22;border-radius:30px;padding:30px 22px 22px;cursor:pointer;'
      + 'display:flex;flex-direction:column;transition:transform .12s}'
    + '#nattyAjout .na-card:active{transform:scale(.98)}'
    + '#nattyAjout .na-card-t{font-size:26px;font-weight:600;text-align:center;letter-spacing:-.4px}'
    + '#nattyAjout .na-card-vis{position:relative;flex:1;min-height:190px;display:flex;'
      + 'align-items:center;justify-content:center;margin:8px 0 18px}'
    + '#nattyAjout .na-card-em{font-size:104px;line-height:1}'
    + '#nattyAjout .na-card-kcal{position:absolute;top:16%;left:58%;background:#e9e9f2;color:#0a0a0c;'
      + 'border-radius:999px;font-size:14px;font-weight:600;padding:14px 12px;white-space:nowrap}'
    + '#nattyAjout .na-card-mac{display:flex;gap:8px}'
    + '#nattyAjout .na-card-mac span{flex:1;background:#141418;border-radius:14px;padding:10px 4px;'
      + 'text-align:center;font-size:12.5px;line-height:1.35;color:#e6e6ec}'
    + '#nattyAjout .na-card-why{font-size:12px;color:#7c7c86;text-align:center;margin-top:12px;min-height:1.2em}'
    + '#nattyAjout .na-dots{display:flex;justify-content:center;gap:6px;margin-top:16px}'
    + '#nattyAjout .na-dots i{width:6px;height:6px;border-radius:50%;background:#2f2f36;transition:background .2s}'
    + '#nattyAjout .na-dots i.on{background:#e9e9f2}'
    + '#nattyAjout .na-hint{text-align:center;font-size:12.5px;color:#6e6e78;margin-top:12px}'

    /* — confirmation d'abandon — */
    + '#nattyAjout .na-ask{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.72);'
      + 'display:none;align-items:center;justify-content:center;padding:26px}'
    + '#nattyAjout .na-ask.on{display:flex}'
    + '#nattyAjout .na-ask-box{width:100%;max-width:340px;background:#141418;border-radius:24px;padding:24px}'
    + '#nattyAjout .na-ask-t{font-size:16px;font-weight:800;margin-bottom:6px}'
    + '#nattyAjout .na-ask-s{font-size:13px;color:#8a8a92;margin-bottom:18px}'

    + '.na-toast{position:fixed;left:50%;bottom:120px;transform:translate(-50%,14px);background:#101014;'
      + 'color:#fff;border-radius:18px;padding:12px 20px;font-family:\'Inter\',sans-serif;font-size:12.5px;'
      + 'font-weight:700;opacity:0;transition:all .35s cubic-bezier(.4,0,.2,1);pointer-events:none;'
      + 'z-index:1000;white-space:nowrap}'
    + '.na-toast.show{opacity:1;transform:translate(-50%,0)}';

  /* ═══════════════════ Utilitaires ═══════════════════ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function q(sel) { return dom ? dom.querySelector(sel) : null; }
  function r1(n) { return Math.round(n * 10) / 10; }
  // Date LOCALE : `toISOString()` rend la veille entre 00 h et 02 h à Paris,
  // donc un repas ajouté à 00 h 30 était enregistré sur la journée précédente.
  function today() { return Natty.jour(); }

  var toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'na-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._tm);
    toastEl._tm = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ═══════════════════ Cibles (onboarding) ═══════════════════
     Les besoins affichés sont ceux d'UN repas : objectif quotidien
     divisé par le nombre de repas par jour.

     ⚠️ La table `onboarding` ne porte NI les macros NI `nb_repas`
     (vérifié en base — contrairement à ce qu'indique CLAUDE.md §4) :
     seulement `poids` / `tdee`, à partir desquels les macros sont
     dérivées côté client, exactement comme calcMacros() de suivi.html.
     Le nombre de repas par jour vient du questionnaire alimentaire,
     sous forme de libellé ("1_2", "3", "3_collations", "grignotage"). */
  var REPAS_PAR_JOUR = { '1_2': 2, '3': 3, '3_collations': 4, 'grignotage': 4 };

  async function chargerCibles() {
    try {
      var r = await Natty.sbFetch('onboarding?user_id=eq.' + Natty.USER_ID
        + '&completed=eq.true&select=poids,tdee&order=created_at.desc&limit=1');
      var d = (r && r[0]) || {};
      var poids = parseFloat(d.poids) || 0;
      var tdee = parseFloat(d.tdee) || 0;
      if (poids || tdee) {
        cibleJour = {
          p: poids ? Math.round(poids * 2) : 0,
          l: tdee ? Math.round(tdee * 0.25 / 9) : 0,
          g: tdee ? Math.round(tdee * 0.5 / 4) : 0,
          c: tdee ? Math.round(tdee) : 0
        };
      }
    } catch (e) { /* on retombe sur le fallback ci-dessous */ }

    if (!cibleJour || !cibleJour.c) {
      // Sans onboarding exploitable, on garde des repères plausibles
      // plutôt que des anneaux vides : 2000 kcal, répartition 30/50/20.
      cibleJour = { p: 120, l: 67, g: 250, c: 2000 };
    }
    try {
      var qa = await Natty.sbFetch('questionnaire_alim?user_id=eq.' + Natty.USER_ID + '&select=nb_repas&limit=1');
      var v = qa && qa[0] ? qa[0].nb_repas : null;
      if (v && REPAS_PAR_JOUR[v]) nbRepas = REPAS_PAR_JOUR[v];
    } catch (e) {}

    try {
      var m = await Natty.sbFetch('meals?user_id=eq.' + Natty.USER_ID + '&meal_date=eq.' + today() + '&select=id');
      repasDuJour = (m || []).length;
    } catch (e) { repasDuJour = 0; }

    majTitre();
    majAnneaux();
  }

  function cibleRepas() {
    var n = Math.max(1, nbRepas);
    return {
      p: Math.round(cibleJour.p / n), l: Math.round(cibleJour.l / n),
      g: Math.round(cibleJour.g / n), c: Math.round(cibleJour.c / n)
    };
  }

  /* ═══════════════════ Macros de la session ═══════════════════ */
  /* ── Les macros d'UN ingrédient ──────────────────────────────
     Trois sources, dans cet ordre, et c'est ce qui rend le compte fiable :
       1. `macros` — une suggestion de l'IA, déjà exprimée en absolu (portion
          figée, la quantité n'est pas modifiable) ;
       2. `pour100` — les valeurs pour 100 g renvoyées par l'analyse photo. On
          multiplie par la quantité, donc **corriger la quantité corrige les
          macros**, sans redemander quoi que ce soit ;
       3. la table locale de `core.js`, en dernier recours.

     ⚠️ `pour100` n'est retenu que s'il est CRÉDIBLE. Un aliment solide à 0 kcal
     n'existe pas, et une réponse où les kcal ne collent pas aux macros
     (4/4/9) est une réponse inventée : dans les deux cas on retombe sur la
     table plutôt que d'enregistrer un chiffre faux. C'est exactement le défaut
     signalé — du saucisson à 0 protéine et 0 kcal. */
  /** Nom réduit à son squelette : sans accent, sans casse, sans ponctuation. */
  function aplati(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* ⚠️ TOLÉRANCE ASYMÉTRIQUE, et ce n'est pas un détail. La règle 4/4/9
     SURESTIME systématiquement les aliments riches en fibres — les fibres sont
     comptées dans les glucides mais n'apportent que ~2 kcal/g. Mesuré sur le
     vrai modèle : un citron rendu à 29 kcal / 1,1 p / 9 g calcule 43 kcal, soit
     +49 % — parfaitement juste, et pourtant rejeté par une tolérance
     symétrique à 45 %.
     L'autre sens est le vrai signal d'alarme : des kcal PLUS HAUTES que ce que
     les macros expliquent, c'est de l'énergie qui sort de nulle part. On y
     reste sévère. */
  function credible(p) {
    if (!p) return false;
    var k = +p.kcal || 0, pr = +p.prot || 0, gl = +p.gluc || 0, li = +p.lip || 0;
    if (k <= 0) return false;                          // un solide à 0 kcal, jamais
    var calcule = 4 * pr + 4 * gl + 9 * li;
    if (calcule === 0) return k < 60;                  // eau, thé, bouillon
    // En dessous de 20 kcal/100 g, l'écart relatif ne veut plus rien dire :
    // un café à 2 kcal « rate » le test de 80 % pour 1,6 kcal d'écart.
    if (k < 20) return true;
    if (calcule >= k) return calcule <= k * (k < 120 ? 2.2 : 1.5);   // fibres, alcool
    return (k - calcule) / k <= 0.35;                  // énergie inexpliquée
  }

  function macroDe(i) {
    if (!i) return { p: 0, l: 0, g: 0, c: 0 };
    if (i.macros) {
      return { p: +i.macros.prot || 0, l: +i.macros.lip || 0,
               g: +i.macros.gluc || 0, c: +i.macros.cal || 0 };
    }
    var q = parseFloat(i.quantite_g) || 0;
    if (credible(i.pour100)) {
      var f = q / 100, p1 = i.pour100;
      return { p: r1((+p1.prot || 0) * f), l: r1((+p1.lip || 0) * f),
               g: r1((+p1.gluc || 0) * f), c: Math.round((+p1.kcal || 0) * f) };
    }
    var n = Natty.getNutri(i.nom, q);
    return n ? { p: n.p, l: n.l, g: n.g, c: n.c } : { p: 0, l: 0, g: 0, c: 0 };
  }

  /** Un ingrédient qu'aucune des trois sources ne sait chiffrer. */
  function inconnu(i) {
    return !!(i && (i.nom || '').trim()) && !i.macros && !credible(i.pour100)
      && !Natty.getNutri(i.nom, 100);
  }

  function macrosIngs(ings) {
    var t = { p: 0, l: 0, g: 0, c: 0 };
    (ings || []).forEach(function (i) {
      var m = macroDe(i);
      t.p += m.p; t.l += m.l; t.g += m.g; t.c += m.c;
    });
    return { p: r1(t.p), l: r1(t.l), g: r1(t.g), c: Math.round(t.c) };
  }

  function totalSession() {
    var t = { p: 0, l: 0, g: 0, c: 0 };
    S.plats.forEach(function (pl) {
      var m = macrosIngs(pl.ingredients);
      t.p += m.p; t.l += m.l; t.g += m.g; t.c += m.c;
    });
    return { p: r1(t.p), l: r1(t.l), g: r1(t.g), c: Math.round(t.c) };
  }

  function restant() {
    var c = cibleRepas(), u = totalSession();
    return {
      p: Math.max(0, Math.round(c.p - u.p)), l: Math.max(0, Math.round(c.l - u.l)),
      g: Math.max(0, Math.round(c.g - u.g)), c: Math.max(0, Math.round(c.c - u.c))
    };
  }

  /* ═══════════════════ Construction de l'overlay ═══════════════════ */
  /* Les anneaux existent en DEUX exemplaires : petits sur l'écran de prise de
     vue (le cadre photo y est le héros), à taille normale sur le récap. D'où le
     préfixe d'identifiant — deux jeux d'`id` distincts dans la même page, et
     `majAnneaux()` peint les deux. Déplacer un seul jeu d'un écran à l'autre
     aurait été plus court à écrire et impossible à animer proprement. */
  var PREFIXES = ['', 'm'];

  function ringHTML(k, label, pre) {
    return '<div class="na-ring">'
      + '<svg viewBox="0 0 120 120">'
      + '<circle class="bg" cx="60" cy="60" r="52"/>'
      + '<circle class="arc" id="naArc' + pre + k + '" cx="60" cy="60" r="52" stroke="' + COL[k] + '" '
        + 'stroke-dasharray="0 ' + CIRC.toFixed(1) + '"/></svg>'
      + '<div class="na-ring-in"><div class="na-ring-lbl">' + label + '</div>'
      + '<div class="na-ring-em">' + EM[k] + '</div>'
      + '<div class="na-ring-val" id="naVal' + pre + k + '">–</div></div></div>';
  }

  function ringsHTML(pre, cls) {
    return '<div class="na-rings' + (cls ? ' ' + cls : '') + '">'
      + ringHTML('p', 'Protéines', pre) + ringHTML('l', 'Lipides', pre) + ringHTML('g', 'Glucides', pre)
      + '</div>';
  }

  function build() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    dom = document.createElement('div');
    dom.id = 'nattyAjout';
    dom.innerHTML = ''
      + '<div class="na-col">'
      + '  <div class="na-top">'
      + '    <button id="naBack" aria-label="Retour">'
      + '      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>'
      + '    </button>'
      + '    <button id="naProfil" aria-label="Profil">'
      + '      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '        <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>'
      + '    </button>'
      + '  </div>'
      + '  <h1 id="naTitre">Votre repas 🥗</h1>'

      /* ── écran 1 : analyse de la photo ── */
      + '  <div class="na-screen" id="naScAnalyse">'
      + '    <div class="na-wait">'
      + '      <div class="na-spin" id="naSpin"></div>'
      + '      <div class="na-wait-t" id="naWaitT">Analyse de votre plat…</div>'
      + '      <div class="na-wait-s" id="naWaitS">Identification des aliments et estimation des macros</div>'
      + '      <div id="naWaitActs" style="display:none;width:100%;max-width:320px;margin-top:8px">'
      + '        <button class="na-btn primary" id="naReprendre" style="font-size:16px;padding:15px">Reprendre une photo</button>'
      + '        <button class="na-btn ghost" id="naGalerie">Choisir dans la galerie</button>'
      + '        <button class="na-btn ghost" id="naManuel">Saisir le plat à la main</button>'
      + '      </div>'
      + '    </div>'
      + '  </div>'

      /* ── écran 2 : le repas et ses macros restantes ── */
      /* ── écran 2 : la PRISE DE VUE (refonte demandée par Pablo, 2026-08-05) ──
         Le cadre photo est le héros. Sous lui : les anneaux en −30 %, le module
         noir des calories restantes, et les trois façons d'ajouter un plat —
         photo, galerie, saisie. Rien d'autre : ni liste d'ingrédients, ni
         « Terminer », qui n'ont aucun sens avant qu'un plat existe. C'est ce
         découpage qui laisse enfin au cadre la place d'être un héros. */
      + '  <div class="na-screen" id="naScRepas">'
      + '    <div class="na-hero-wrap"><div class="na-hero" id="naHero"><span class="na-hero-em">🍽️</span></div></div>'
      +      ringsHTML('m', 'mini')
      + '    <div class="na-kmod">'
      + '      <div class="na-kmod-l">'
      + '        <div class="na-kmod-t">Calories restantes</div>'
      + '        <div class="na-kmod-s" id="naKmodS">pour ce repas</div>'
      + '      </div>'
      + '      <div class="na-kmod-v">'
      + '        <div class="na-kmod-n" id="naKmodN">–</div>'
      + '        <div class="na-kmod-u" id="naKmodU">kcal</div>'
      + '      </div>'
      + '    </div>'
      + '    <div class="na-cta">'
      + '      <button class="na-btn primary" id="naPrendre">Prendre la photo 📸</button>'
      /* Galerie et saisie n'existaient QUE dans la branche d'échec de l'analyse :
         il fallait donc qu'une photo rate pour découvrir qu'on pouvait piocher
         dans ses images ou écrire son plat. */
      + '      <div class="na-src">'
      + '        <button class="na-src-b" id="naSrcGal">🖼️ Galerie</button>'
      + '        <button class="na-src-b" id="naSrcMan">✏️ Écrire</button>'
      + '      </div>'
      + '    </div>'
      + '  </div>'

      /* ── transition : le rond puis le V, en vert ──
         Reprise de la validation d'`assets/planning.js`. Elle ne dure que le
         temps de son animation et enchaîne toute seule sur le récap : c'est une
         confirmation, pas une étape où l'on attend quelque chose de
         l'utilisateur. */
      + '  <div class="na-screen" id="naScOk">'
      + '    <div class="na-ok">'
      + '      <div class="na-vok"><svg viewBox="0 0 120 120">'
      + '        <circle class="rond" cx="60" cy="60" r="42"/>'
      + '        <path class="coche" d="M41 61l13 14 26-30"/></svg></div>'
      + '      <div class="na-ok-t" id="naOkT">Plat reconnu</div>'
      + '      <div class="na-ok-s" id="naOkS"></div>'
      + '    </div>'
      + '  </div>'

      /* ── écran 3 : le RÉCAP du repas ──
         Photo en vignette, nom modifiable, anneaux à taille normale, et la liste
         des ingrédients OUVERTE — on vient ici pour retirer, corriger ou
         ajouter. « Enrichir » n'apparaît qu'ici, puisqu'il n'y a rien à enrichir
         avant qu'un plat existe. */
      + '  <div class="na-screen" id="naScRecap">'
      + '    <input class="na-plat-nom" id="naPlatNom" type="text" aria-label="Nom du plat">'
      + '    <div class="na-plat-plus" id="naPlatPlus"></div>'
      + '    <div class="na-vigns" id="naVign"></div>'
      +      ringsHTML('', '')
      + '    <div class="na-restants">Restants</div>'
      + '    <div class="na-kcal-line" id="naKcal"></div>'
      + '    <div class="na-detail ouvert">'
      + '      <button class="na-detail-h" id="naDetailH">Détail du repas <span id="naDetailC">▴</span></button>'
      + '      <div class="na-detail-body on" id="naDetailB"></div>'
      + '    </div>'
      + '    <div class="na-cta">'
      + '      <button class="na-btn primary" id="naEnrichir">Enrichir '
      + '        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
      + '          <path d="M12 2c.9 5.5 4.5 9.1 10 10-5.5.9-9.1 4.5-10 10-.9-5.5-4.5-9.1-10-10 5.5-.9 9.1-4.5 10-10z"/></svg>'
      + '      </button>'
      + '      <button class="na-btn sombre" id="naTerminer">Terminer et enregistrer</button>'
      + '    </div>'
      + '  </div>'

      /* ── écran « bilan » : après l'enregistrement ── */
      + '  <div class="na-screen" id="naScBilan">'
      + '    <div class="na-bilan">'
      + '      <div class="na-bcheck" id="naBCheck">✓</div>'
      + '      <div class="na-btitre" id="naBTitre">Repas enregistré</div>'
      + '      <div class="na-bsub" id="naBSub">Analyse de votre plat…</div>'
      + '      <div class="na-bcorps" id="naBCorps"></div>'
      + '      <div class="na-choix" id="naBChoix"></div>'
      + '    </div>'
      + '  </div>'

      /* ── écran 3 : les 4 pistes d'enrichissement ── */
      + '  <div class="na-screen" id="naScChoix">'
      + '    <div class="na-opts">'
      + '      <button class="na-opt" data-mode="resservir">Me resservir 🍽️</button>'
      + '      <button class="na-opt" data-mode="ingredients">Ajouter des ingrédients 🥕</button>'
      + '      <button class="na-opt" data-mode="plat">Un autre repas 🥗</button>'
      + '      <button class="na-opt" data-mode="dessert">Passer au dessert / snack 🍪</button>'
      + '    </div>'
      + '    <div class="na-cta"><button class="na-btn ghost" id="naChoixRetour">← Revenir au repas</button></div>'
      + '  </div>'

      /* ── écran 4 : carrousel de suggestions ── */
      + '  <div class="na-screen" id="naScCarou">'
      + '    <div id="naCarouWrap"></div>'
      + '    <div class="na-cta"><button class="na-btn ghost" id="naCarouRetour">← Autres options</button></div>'
      + '  </div>'

      + '</div>'

      + '<div class="na-ask" id="naAsk"><div class="na-ask-box">'
      + '  <div class="na-ask-t">Abandonner ce repas ?</div>'
      + '  <div class="na-ask-s">Ce qui a été composé ne sera pas enregistré.</div>'
      + '  <button class="na-btn primary" id="naAskOui" style="font-size:15px;padding:14px">Abandonner</button>'
      + '  <button class="na-btn ghost" id="naAskNon">Continuer le repas</button>'
      + '</div></div>';

    document.body.appendChild(dom);

    inputCam = mkInput(true);
    inputGal = mkInput(false);

    q('#naBack').addEventListener('click', retour);
    q('#naProfil').addEventListener('click', function () { Natty.goto('profil.html'); });
    q('#naReprendre').addEventListener('click', function () { inputCam.value = ''; inputCam.click(); });
    q('#naGalerie').addEventListener('click', function () { inputGal.value = ''; inputGal.click(); });
    q('#naManuel').addEventListener('click', saisieManuelle);
    /* Les trois sources, depuis l'écran de prise de vue. ⚠️ `input.click()` doit
       rester SYNCHRONE dans le handler : c'est la même contrainte que le bouton
       `+` de la nav (iOS/WebKit refuse d'ouvrir le sélecteur si le geste
       utilisateur est perdu). Rien d'asynchrone avant lui. */
    q('#naSrcGal').addEventListener('click', function () { inputGal.value = ''; inputGal.click(); });
    q('#naSrcMan').addEventListener('click', saisieManuelle);
    /* « Prendre la photo » déclenche l'obturateur du flux quand il tourne dans le
       cadre, et retombe sur l'appareil photo natif sinon (autorisation refusée,
       WebView sans getUserMedia). Le même bouton dans les deux cas : la source
       de la photo est un détail d'implémentation, pas une décision à prendre. */
    q('#naPrendre').addEventListener('click', function () {
      var v = q('#naHero video');
      if (flux && v && v.videoWidth) return camCapturer(v);
      inputCam.value = ''; inputCam.click();
    });
    q('#naDetailH').addEventListener('click', toggleDetail);
    q('#naPlatNom').addEventListener('input', function () {
      if (S && S.plats[0]) S.plats[0].nom = this.value;
      rendreDetail();
    });
    q('#naEnrichir').addEventListener('click', function () { montrer('naScChoix'); });
    q('#naTerminer').addEventListener('click', enregistrer);
    q('#naChoixRetour').addEventListener('click', function () { montrer('naScRecap'); });
    q('#naCarouRetour').addEventListener('click', function () { montrer('naScChoix'); });
    q('#naAskNon').addEventListener('click', function () { q('#naAsk').classList.remove('on'); });
    q('#naAskOui').addEventListener('click', fermer);
    dom.querySelectorAll('.na-opt').forEach(function (b) {
      b.addEventListener('click', function () { ouvrirCarrousel(b.dataset.mode); });
    });
  }

  function mkInput(camera) {
    var i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/*';
    if (camera) i.setAttribute('capture', 'environment');
    i.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
    i.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      ouvrir();
      analyser(f);
    });
    document.body.appendChild(i);
    return i;
  }

  /* ═══════════════════ Navigation entre écrans ═══════════════════ */
  function montrer(id) {
    dom.querySelectorAll('.na-screen').forEach(function (s) { s.classList.toggle('on', s.id === id); });
    dom.scrollTop = 0;
    majTitre();
  }
  function ecranCourant() {
    var e = dom.querySelector('.na-screen.on');
    return e ? e.id : '';
  }
  function majTitre() {
    if (!dom) return;
    var t = q('#naTitre'), e = ecranCourant();
    if (e === 'naScChoix' || e === 'naScCarou') t.innerHTML = 'Réussir votre objectif 🚀 :';
    else if (e === 'naScAnalyse') t.innerHTML = 'Votre plat 📸';
    else if (e === 'naScBilan') t.innerHTML = 'C\'est noté ✓';
    else if (e === 'naScRecap') t.innerHTML = 'Votre repas 🥗';
    else t.innerHTML = 'Votre ' + (ORD[repasDuJour] || '') + ' repas 🥗';
    /* La transition porte son propre titre animé, au centre de l'écran. Garder
       le h1 au-dessus ferait deux titres pour un seul message. */
    t.style.display = (e === 'naScOk') ? 'none' : '';
  }
  function retour() {
    var e = ecranCourant();
    /* Depuis le bilan, il n'y a rien derrière : le plat est enregistré. Le
       retour vaut donc « garder pour moi » — le choix le plus prudent, et celui
       qui est déjà écrit en base (partage=false). */
    if (e === 'naScBilan') { fermer(); return; }
    if (e === 'naScCarou') return montrer('naScChoix');
    if (e === 'naScChoix') return montrer('naScRecap');
    // Depuis le récap, revenir à la prise de vue : c'est là qu'on ajoute une
    // seconde photo au même repas. L'abandon se demande un cran plus haut.
    if (e === 'naScRecap') return rendreCapture();
    if (S && S.plats.length && S.plats[0].ingredients.length) { q('#naAsk').classList.add('on'); return; }
    fermer();
  }

  function ouvrir() {
    dom.classList.add('on');
    document.body.style.overflow = 'hidden';   // jamais position:fixed (casse le scroll iOS)
    montrer('naScAnalyse');
  }
  function fermer() {
    q('#naAsk').classList.remove('on');
    camArreter();
    // Sinon un overlay fermé pendant la transition se rouvrirait tout seul sur
    // le récap 1,7 s plus tard — et `rendreRecap()` lirait un `S` déjà nul.
    clearTimeout(okTimer);
    dom.classList.remove('on');
    document.body.style.overflow = '';
    S = null;
  }

  /* ═══════════════════ Prise de vue dans le cadre ═══════════════════
     Le + ouvre l'overlay — les anneaux de macros restantes sont visibles
     tout de suite — et la photo se prend DANS le cadre, pas dans la
     feuille native plein écran.

     getUserMedia remplace donc <input capture> ici. La contrainte
     « input.click() doit rester synchrone dans le geste utilisateur »
     tombe, mais iOS demande l'autorisation caméra au premier usage
     (d'où NSCameraUsageDescription dans Info.plist).

     Si l'autorisation est refusée ou le flux indisponible, on retombe sur
     un BOUTON et non sur un inputCam.click() direct : à ce stade on n'est
     plus dans un geste utilisateur, et iOS ignorerait le click(). */
  var flux = null;
  /* `meals.partage` peut manquer sur l'instance (la colonne est récente) :
     PostgREST refuse alors la requête entière. On le note au premier refus et
     on cesse de l'envoyer — le plat reste enregistré, simplement visible comme
     tous les autres. */
  var PARTAGE_OK = true;

  function camArreter() {
    if (!flux) return;
    flux.getTracks().forEach(function (t) { t.stop(); });
    flux = null;
  }

  /* Repli tactile : le click() part d'un vrai geste, donc iOS l'accepte. */
  function camRepli(msg) {
    camArreter();
    var h = q('#naHero');
    if (!h) return;
    h.innerHTML = '';
    var b = document.createElement('button');
    b.className = 'na-hero-fb';
    b.innerHTML = '<span class="em">📷</span>' + esc(msg || 'Prendre une photo');
    b.addEventListener('click', function () { inputCam.value = ''; inputCam.click(); });
    h.appendChild(b);
  }

  async function camDemarrer() {
    var h = q('#naHero');
    if (!h) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camRepli();

    h.innerHTML = '';
    var v = document.createElement('video');
    v.setAttribute('playsinline', '');   // sans ça iOS bascule en plein écran
    v.setAttribute('autoplay', '');
    v.muted = true;
    h.appendChild(v);

    try {
      flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false
      });
    } catch (e) {
      return camRepli('Caméra indisponible —\ntoucher pour ouvrir l\'appareil photo');
    }
    // L'écran a pu changer pendant l'attente d'autorisation.
    if (!S || ecranCourant() !== 'naScRepas') return camArreter();

    v.srcObject = flux;
    try { await v.play(); } catch (e) {}

    var b = document.createElement('button');
    b.className = 'na-shutter';
    b.setAttribute('aria-label', 'Prendre la photo');
    b.addEventListener('click', function () { camCapturer(v); });
    h.appendChild(b);
  }

  function camCapturer(v) {
    var w = v.videoWidth, ht = v.videoHeight;
    if (!w || !ht) return;                       // flux pas encore prêt
    var c = document.createElement('canvas');
    c.width = w; c.height = ht;
    c.getContext('2d').drawImage(v, 0, 0, w, ht);
    c.toBlob(function (blob) {
      if (!blob) return camRepli();
      camArreter();
      // Un File plutôt qu'un Blob : l'upload Cloudinary passe par FormData,
      // qui a besoin d'un nom de fichier.
      analyser(new File([blob], 'repas.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  }

  /* ═══════════════════ Analyse de la photo ═══════════════════ */
  function etatAttente(titre, sous, actions) {
    q('#naSpin').style.display = actions ? 'none' : 'block';
    q('#naWaitT').textContent = titre;
    q('#naWaitS').textContent = sous;
    q('#naWaitActs').style.display = actions ? 'block' : 'none';
  }

  async function analyser(file) {
    S.file = file;
    montrer('naScAnalyse');
    etatAttente('Analyse de votre plat…', 'Identification des aliments et estimation des macros', false);

    var reader = new FileReader();
    S.photoDataUrl = await new Promise(function (res) {
      reader.onload = function (e) { res(e.target.result); };
      reader.readAsDataURL(file);
    });
    var b64 = S.photoDataUrl.split(',')[1];

    /* ⚠️ Ce prompt demande les valeurs POUR 100 g, et non les macros du plat.
       Trois raisons, toutes vérifiées à l'usage :
       • un total demandé à part peut contredire la somme de ses ingrédients —
         ici c'est nous qui additionnons, donc les anneaux, ce qui est enregistré
         et ce que lit le suivi disent forcément la même chose ;
       • pour 100 g, c'est une donnée de table que le modèle connaît bien,
         alors qu'un total dépend d'une estimation de quantité, bien plus
         fragile — on ne mélange plus les deux erreurs ;
       • et surtout : corriger la quantité à la main recalcule tout, au lieu de
         laisser des macros figées sur une quantité qu'on vient de changer. */
    var prompt = 'Tu es un nutritionniste qui lit une photo de repas.\n\n'
      + '1. IDENTIFIE chaque aliment visible SÉPARÉMENT. Ne réponds jamais "assiette composée" '
      + 'ou "plat" : nomme les aliments un par un, avec leur préparation (riz cuit, poulet grillé, '
      + 'saucisson sec…).\n'
      + '2. Sers-toi de la couleur, de la texture et du grain pour trancher : poisson = chair '
      + 'feuilletée rosée ou blanche, poulet = fibres dorées, bœuf = rouge/brun, charcuterie = '
      + 'grain gras et marbré.\n'
      + '3. ESTIME la quantité de chacun en grammes, en te servant de l’assiette et des couverts '
      + 'comme repère d’échelle.\n'
      + '4. Donne pour chaque aliment ses valeurs POUR 100 g (référence Ciqual/USDA).\n\n'
      + 'RÈGLES ABSOLUES\n'
      + '- Aucun aliment solide ne peut valoir 0 kcal. Si tu n’es pas sûr, donne la valeur de '
      + 'l’aliment courant le plus proche — jamais zéro.\n'
      + '- Les kcal doivent coller aux macros : kcal ≈ 4×protéines + 4×glucides + 9×lipides.\n'
      + '- Tiens compte de la cuisson : riz cuit ≈ 130 kcal/100 g, riz cru ≈ 360. Pâtes cuites '
      + '≈ 131, crues ≈ 371.\n'
      + '- N’oublie pas ce qui ne se voit qu’à peine mais pèse : huile de cuisson, sauce, beurre, '
      + 'fromage râpé.\n\n'
      + 'Réponds UNIQUEMENT en JSON, sans backticks :\n'
      + '{"nom":"nom du plat","ingredients":[{"emoji":"🍗","nom":"Poulet grillé","quantite_g":150,'
      + '"pour100":{"kcal":165,"prot":31,"gluc":0,"lip":3.6}}]}';

    try {
      var res = await fetch(CLAUDE_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, max_tokens: 1200, image: b64, media_type: file.type })
      });
      var d = await res.json();
      if (!res.ok) throw new Error(d.error || ('Erreur ' + res.status));
      var data = JSON.parse((d.text || '{}').replace(/```[a-z]*|```/g, '').trim());
      if (!data.ingredients || !data.ingredients.length) throw new Error('Aucun aliment reconnu');

      /* ⚠️ Ceci ÉCRASAIT S.plats. Une seconde photo effaçait donc la
         première — « pas une seule photo par repas », dit la demande de
         Pablo, et c'était pourtant exactement ce que faisait le code. On
         ajoute désormais un plat par photo, chacun avec la sienne. */
      S.plats.push({
        nom: data.nom || 'Plat',
        photo: S.photoDataUrl,
        file: file,
        ingredients: data.ingredients.map(function (i) {
          var p1 = i.pour100 || null;
          return {
            emoji: i.emoji || '🍽️', nom: i.nom,
            nomIA: i.nom,                       // repère pour détecter un vrai renommage
            quantite_g: parseFloat(i.quantite_g) || 0,
            // Gardé même si peu crédible : `macroDe()` tranche, et une valeur
            // douteuse conservée se corrige en changeant la quantité, alors
            // qu'une valeur jetée ici serait perdue pour de bon.
            pour100: p1 ? { kcal: +p1.kcal || 0, prot: +p1.prot || 0,
                            gluc: +p1.gluc || 0, lip: +p1.lip || 0 } : null
          };
        })
      });
      S.cur = S.plats.length - 1;
      var nb = (data.ingredients || []).length;
      transitionOk(data.nom || 'Plat',
        nb + ' aliment' + (nb > 1 ? 's' : '') + ' reconnu' + (nb > 1 ? 's' : '')
        + ' — vérifiez et ajustez si besoin.');
      if (S.plats.length > 1) toast((data.nom || 'Plat') + ' ajouté');
    } catch (e) {
      etatAttente('Plat non reconnu', 'La photo n\'a pas pu être analysée. Reprenez-la, ou saisissez le plat à la main.', true);
    }
  }

  /* Saisie manuelle — deuxième façon d'ajouter un plat (« Écrire »), et filet
     quand l'IA n'est pas joignable (hors-ligne, backend indisponible).
     Volontairement SANS la transition verte : rien n'a été reconnu, il n'y a
     rien à confirmer — on ouvre directement le récap sur une ligne vide. */
  function saisieManuelle() {
    S.plats.push({ nom: 'Mon plat', photo: S.photoDataUrl, file: S.file, ingredients: [] });
    S.cur = S.plats.length - 1;
    camArreter();
    rendreRecap();
    ajouterLigne();
  }

  /* ═══════════════════ Écrans repas ═══════════════════ */

  /* Écran de PRISE DE VUE : le cadre en héros, le flux dedans. */
  function rendreCapture() {
    if (!flux) camDemarrer();   // remet le flux dans le cadre, sans le relancer pour rien
    majAnneaux();
    montrer('naScRepas');
  }

  /* La confirmation « rond + V vert », puis le récap. Elle s'enchaîne toute
     seule : c'est une confirmation, pas une étape.
     ⚠️ La caméra est arrêtée AVANT, pas après. Laisser le flux tourner pendant
     la transition et le récap consomme la batterie et garde l'indicateur de
     caméra allumé sur un écran qui ne filme plus rien — `rendreCapture()` le
     relancera si on revient en arrière. */
  function transitionOk(nom, sous) {
    camArreter();
    q('#naOkT').textContent = nom;
    q('#naOkS').textContent = sous || '';
    montrer('naScOk');
    clearTimeout(okTimer);
    okTimer = setTimeout(function () {
      // L'écran a pu changer pendant l'animation (retour, abandon).
      if (ecranCourant() === 'naScOk') rendreRecap();
    }, 1750);
  }

  /* Écran de RÉCAP : nom, vignettes, anneaux, et la liste des ingrédients
     ouverte — c'est ici qu'on retire, corrige ou ajoute. */
  function rendreRecap() {
    majNoms();
    rendreVignettes();
    rendreDetail();
    majAnneaux();
    montrer('naScRecap');
  }

  /* Les photos de la session, en petit, sous le nom du plat. Un appui retire la
     prise de vue ET le plat qu'elle a apporté : c'est la seule façon de défaire
     une photo de trop sans tout recommencer. */
  function rendreVignettes() {
    var z = q('#naVign');
    if (!z) return;
    z.innerHTML = '';
    S.plats.forEach(function (pl, i) {
      if (!pl.photo) return;
      var b = document.createElement('button');
      b.className = 'na-vign';
      b.setAttribute('aria-label', 'Retirer ' + (pl.nom || 'ce plat'));
      b.innerHTML = '<img src="' + esc(pl.photo) + '" alt=""><span class="x">✕</span>';
      b.addEventListener('click', function () {
        S.plats.splice(i, 1);
        if (!S.plats.length) { S.cur = -1; }
        else if (S.cur >= S.plats.length) S.cur = S.plats.length - 1;
        // Plus aucun plat : il n'y a plus de récap à montrer, on revient au
        // cadre photo plutôt que d'afficher un écran vide avec « Terminer ».
        if (!S.plats.length) rendreCapture(); else rendreRecap();
        toast('Retiré');
      });
      z.appendChild(b);
    });
  }

  /* Le nom du plat photographié reste modifiable — l'IA se trompe parfois,
     et la saisie manuelle part d'un nom générique. Les plats ajoutés
     ensuite s'affichent en dessous, et se retrouvent dans le détail. */
  function majNoms() {
    q('#naPlatNom').value = S.plats[0] ? S.plats[0].nom : '';
    q('#naPlatPlus').textContent = S.plats.length > 1
      ? '+ ' + S.plats.slice(1).map(function (p) { return p.nom; }).join(' + ')
      : '';
  }

  function majAnneaux() {
    if (!dom || !S || !cibleJour) return;
    var c = cibleRepas(), u = totalSession(), r = restant();
    // Les DEUX jeux d'anneaux (prise de vue en −30 %, récap à taille normale)
    // sont peints du même coup : ils montrent la même chose, ils ne peuvent pas
    // se contredire d'un écran à l'autre.
    PREFIXES.forEach(function (pre) {
      ['p', 'l', 'g'].forEach(function (k) {
        var frac = c[k] > 0 ? Math.max(0, Math.min(1, (c[k] - u[k]) / c[k])) : 0;
        var arc = q('#naArc' + pre + k);
        if (arc) arc.setAttribute('stroke-dasharray', (frac * CIRC).toFixed(1) + ' ' + CIRC.toFixed(1));
        var v = q('#naVal' + pre + k);
        if (v) v.textContent = r[k] + 'g';
      });
    });
    var kc = q('#naKcal');
    if (kc) {
      kc.textContent = r.c > 0
        ? r.c + ' kcal restantes sur ' + c.c + ' pour ce repas (' + nbRepas + ' repas / jour)'
        : 'Cible du repas atteinte — ' + u.c + ' kcal sur ' + c.c;
    }
    /* Le module noir de l'écran de prise de vue. Le grand chiffre est ce qu'il
       RESTE ; quand la cible est dépassée on affiche le dépassement plutôt qu'un
       zéro, qui laisserait croire à un compte juste. */
    var n = q('#naKmodN'), su = q('#naKmodS'), un = q('#naKmodU');
    if (n && su && un) {
      var depasse = r.c <= 0;
      n.textContent = depasse ? '+' + (u.c - c.c) : r.c;
      un.textContent = 'kcal';
      su.textContent = depasse
        ? 'au-delà de la cible (' + u.c + ' / ' + c.c + ')'
        : 'sur ' + c.c + ' pour ce repas · ' + nbRepas + ' repas / jour';
      n.style.color = depasse ? '#ff9500' : '#fff';
    }
    var enr = q('#naEnrichir');
    /* « Enrichir » n'a de sens que s'il reste de la marge sur ce repas — ET
       qu'un plat existe. Il vit désormais sur le seul écran de récap, donc la
       seconde condition est structurelle : c'est ce que Pablo demandait par
       « le bouton enrichir apparaît » (il apparaît AVEC le récap). */
    var marge = S.plats.length > 0 && (r.c > c.c * 0.08 || r.p > c.p * 0.12);
    enr.style.display = marge ? 'flex' : 'none';
    // Sans marge restante, terminer devient LE geste attendu : le bouton passe
    // en clair. Avec de la marge il reste noir en relief, mais visible —
    // jamais un simple texte, c'est l'enregistrement du repas.
    q('#naTerminer').className = 'na-btn ' + (marge ? 'sombre' : 'primary');
  }

  function rendreDetail() {
    var b = q('#naDetailB');
    b.innerHTML = '';
    S.plats.forEach(function (pl, pi) {
      var m = macrosIngs(pl.ingredients);
      var h = document.createElement('div');
      h.className = 'na-grp';
      h.textContent = pl.nom + ' — ' + m.c + ' kcal';
      b.appendChild(h);

      pl.ingredients.forEach(function (ing, ii) {
        var row = document.createElement('div');
        row.className = 'na-item' + (inconnu(ing) ? ' na-inconnu' : '');
        // Un ingrédient que personne ne sait chiffrer compte pour zéro. Il faut
        // que ça se VOIE : un total silencieusement faux est pire qu'un total
        // qui manque, et renommer suffit presque toujours à le résoudre.
        if (inconnu(ing)) row.title = 'Non reconnu — précisez le nom pour qu’il compte';

        var em = document.createElement('span');
        em.className = 'em';
        em.textContent = ing.emoji || '🍽️';

        var nm = document.createElement('input');
        nm.className = 'nm';
        nm.style.cssText = 'width:auto;flex:1;text-align:left;background:none;border:none;padding:0';
        nm.type = 'text';
        nm.value = ing.nom;
        nm.addEventListener('input', function () {
          ing.nom = this.value;
          /* ⚠️ On corrige un nom pour DEUX raisons opposées : une faute de
             frappe, ou un aliment mal reconnu. Dans le second cas, garder les
             valeurs de l'aliment d'avant enregistrerait sciemment un chiffre
             faux. On ne les jette donc que si le nom a réellement changé —
             comparé sans accents ni casse, pour qu'« poulet grille » →
             « poulet grillé » ne coûte rien. */
          if (ing.pour100 && !ing.macros && ing.nomIA
              && aplati(this.value) !== aplati(ing.nomIA)) {
            ing.pour100 = null;
          }
          row.classList.toggle('na-inconnu', inconnu(ing));
          majAnneaux();
        });

        var qty = document.createElement('input');
        qty.type = 'number';
        qty.min = 0;
        qty.value = ing.quantite_g;
        qty.disabled = !!ing.macros;   // macros fournies par l'IA : quantité figée
        qty.addEventListener('input', function () {
          ing.quantite_g = parseFloat(this.value) || 0;
          majAnneaux();
        });

        var u = document.createElement('span');
        u.className = 'u';
        u.textContent = 'g';

        var del = document.createElement('button');
        del.className = 'del';
        del.textContent = '✕';
        del.setAttribute('aria-label', 'Retirer');
        del.addEventListener('click', function () {
          pl.ingredients.splice(ii, 1);
          if (!pl.ingredients.length && pi > 0) S.plats.splice(pi, 1);
          if (S.cur >= S.plats.length) S.cur = S.plats.length - 1;
          rendreDetail(); majAnneaux(); majNoms();
        });

        row.appendChild(em); row.appendChild(nm); row.appendChild(qty);
        row.appendChild(u); row.appendChild(del);
        b.appendChild(row);
      });
    });

    var add = document.createElement('button');
    add.className = 'na-mini';
    add.textContent = '+ Ajouter un ingrédient';
    add.addEventListener('click', ajouterLigne);
    b.appendChild(add);
  }

  function ajouterLigne() {
    var pl = S.plats[S.cur] || S.plats[0];
    pl.ingredients.push({ emoji: '🍽️', nom: '', quantite_g: 100 });
    rendreDetail();
    majAnneaux();
    var inputs = q('#naDetailB').querySelectorAll('.nm');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function toggleDetail() {
    var b = q('#naDetailB');
    b.classList.toggle('on');
    q('#naDetailC').textContent = b.classList.contains('on') ? '▴' : '▾';
  }

  /* ═══════════════════ Suggestions & carrousel ═══════════════════ */

  /* Repli local quand /api/claude n'est pas joignable : on compose les
     suggestions depuis la table nutritionnelle de core.js, donc avec
     exactement les mêmes chiffres que le reste de l'app. */
  var FB = {
    ingredients: [
      { em: '🥚', nom: '3 œufs', base: 'oeufs', qty: 150 },
      { em: '🍗', nom: 'Blanc de poulet', base: 'poulet', qty: 120 },
      { em: '🐟', nom: 'Pavé de saumon', base: 'saumon', qty: 110 },
      { em: '🧀', nom: 'Fromage blanc', base: 'fromage blanc', qty: 200 },
      { em: '🍚', nom: 'Riz basmati', base: 'riz', qty: 150 },
      { em: '🍠', nom: 'Patate douce', base: 'patate douce', qty: 180 },
      { em: '🥑', nom: 'Avocat', base: 'avocat', qty: 100 },
      { em: '🥜', nom: 'Amandes', base: 'amandes', qty: 30 },
      { em: '🥦', nom: 'Brocoli vapeur', base: 'brocoli', qty: 200 },
      { em: '🫒', nom: 'Filet d\'huile d\'olive', base: 'huile olive', qty: 10 }
    ],
    plat: [
      { em: '🍛', nom: 'Poulet, riz, brocoli', ings: [['poulet', 130], ['riz', 150], ['brocoli', 120]] },
      { em: '🐟', nom: 'Saumon, quinoa, épinards', ings: [['saumon', 120], ['quinoa', 140], ['epinards', 120]] },
      { em: '🥗', nom: 'Bowl lentilles & feta', ings: [['lentilles', 180], ['feta', 40], ['tomate', 100]] },
      { em: '🍝', nom: 'Pâtes thon & tomate', ings: [['pates', 160], ['thon', 100], ['tomate', 120]] },
      { em: '🍳', nom: 'Omelette 3 œufs & champignons', ings: [['oeufs', 165], ['champignons', 100], ['huile olive', 8]] }
    ],
    dessert: [
      { em: '🍨', nom: 'Fromage blanc & fruits rouges', ings: [['fromage blanc', 200], ['fraise', 100]] },
      { em: '🍌', nom: 'Banane & beurre d\'amande', ings: [['banane', 120], ['amandes', 20]] },
      { em: '🥣', nom: 'Yaourt, avoine & miel', ings: [['yaourt', 150], ['avoine', 40]] },
      { em: '🍎', nom: 'Pomme & noix', ings: [['pomme', 150], ['noix', 25]] },
      { em: '🥭', nom: 'Mangue & yaourt grec', ings: [['mangue', 150], ['yaourt', 150]] }
    ]
  };

  function macrosDe(ings) {
    var t = { prot: 0, gluc: 0, lip: 0, cal: 0 };
    ings.forEach(function (pair) {
      var n = Natty.getNutri(pair[0], pair[1]);
      if (n) { t.prot += n.p; t.gluc += n.g; t.lip += n.l; t.cal += n.c; }
    });
    return { prot: r1(t.prot), gluc: r1(t.gluc), lip: r1(t.lip), cal: Math.round(t.cal) };
  }

  function optionsLocales(mode, r) {
    var out = [];
    if (mode === 'resservir') {
      var pl = S.plats[S.cur] || S.plats[0];
      [0.5, 1, 1.5].forEach(function (f) {
        var ings = pl.ingredients.map(function (i) {
          return { emoji: i.emoji, nom: i.nom, quantite_g: Math.round((i.quantite_g || 0) * f), macros: null };
        });
        var m = macrosIngs(ings);
        out.push({
          emoji: '🍽️',
          nom: f === 0.5 ? 'Demi-portion' : f === 1 ? 'Une portion de plus' : 'Portion et demie',
          macros: { prot: m.p, gluc: m.g, lip: m.l, cal: m.c },
          ings: ings,
          pourquoi: 'La même assiette : ' + pl.nom
        });
      });
      return out;
    }
    if (mode === 'ingredients') {
      return FB.ingredients.map(function (o) {
        var m = macrosDe([[o.base, o.qty]]);
        return {
          emoji: o.em, nom: o.nom, macros: m,
          ings: [{ emoji: o.em, nom: o.base, quantite_g: o.qty }],
          pourquoi: o.qty + ' g'
        };
      });
    }
    return FB[mode === 'dessert' ? 'dessert' : 'plat'].map(function (o) {
      return {
        emoji: o.em, nom: o.nom, macros: macrosDe(o.ings),
        ings: o.ings.map(function (p) { return { emoji: o.em, nom: p[0], quantite_g: p[1] }; }),
        pourquoi: o.ings.map(function (p) { return p[0]; }).join(', ')
      };
    });
  }

  /* Classe les options par adéquation au restant : on privilégie celles
     qui comblent la macro la plus manquante sans faire exploser le total. */
  function classer(opts, r) {
    var tot = (r.p + r.g + r.l) || 1;
    return opts.map(function (o) {
      var m = o.macros || {};
      var s = 0;
      s += (r.p / tot) * Math.min(m.prot || 0, r.p) / (r.p || 1);
      s += (r.g / tot) * Math.min(m.gluc || 0, r.g) / (r.g || 1);
      s += (r.l / tot) * Math.min(m.lip || 0, r.l) / (r.l || 1);
      if (r.c > 0 && (m.cal || 0) > r.c * 1.3) s -= 0.6;    // dépasse nettement le restant
      o._s = s;
      return o;
    }).sort(function (a, b) { return b._s - a._s; });
  }

  async function optionsIA(mode, r) {
    var pl = S.plats[S.cur] || S.plats[0];
    var quoi = mode === 'ingredients' ? 'ingredients a ajouter au plat'
      : mode === 'dessert' ? 'desserts ou snacks'
      : 'plats complets';
    var prompt = 'Nutritionniste. Il reste a couvrir sur CE repas : proteines ' + r.p + 'g, '
      + 'glucides ' + r.g + 'g, lipides ' + r.l + 'g, ' + r.c + ' kcal. '
      + 'Plat deja compose : ' + pl.nom + ' (' + pl.ingredients.map(function (i) {
        return i.nom + ' ' + i.quantite_g + 'g';
      }).join(', ') + '). '
      + 'Propose 5 ' + quoi + ' simples et courants qui comblent ce restant sans le depasser. '
      + 'Le champ nom doit etre court et concret (ex: "3x Oeufs", "Riz basmati 150 g"). '
      + 'Reponds UNIQUEMENT en JSON sans backticks: '
      + '{"options":[{"emoji":"🥚","nom":"3x Oeufs","pourquoi":"...","ingredients":[{"nom":"oeufs","quantite_g":150}],'
      + '"macros":{"prot":0,"gluc":0,"lip":0,"cal":0}}]}';

    var res = await fetch(CLAUDE_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, max_tokens: 900 })
    });
    var d = await res.json();
    if (!res.ok) throw new Error(d.error || 'erreur');
    var data = JSON.parse((d.text || '{}').replace(/```[a-z]*|```/g, '').trim());
    if (!data.options || !data.options.length) throw new Error('vide');
    return data.options.map(function (o) {
      var ings = (o.ingredients || []).map(function (i) {
        return { emoji: o.emoji || '🍽️', nom: i.nom, quantite_g: parseFloat(i.quantite_g) || 0 };
      });
      // La carte doit annoncer exactement ce que les anneaux vont retrancher.
      // Quand les ingrédients sont reconnus par la table de core.js, c'est
      // elle qui fait foi (même chiffres que partout ailleurs dans l'app).
      // Sinon on garde les macros de l'IA, portées par la ligne elle-même.
      var loc = macrosIngs(ings);
      if (ings.length && loc.c > 0) {
        return {
          emoji: o.emoji || '🍽️', nom: o.nom || 'Suggestion', pourquoi: o.pourquoi || '',
          ings: ings, macros: { prot: loc.p, gluc: loc.g, lip: loc.l, cal: loc.c }
        };
      }
      var m = o.macros || { prot: 0, gluc: 0, lip: 0, cal: 0 };
      return {
        emoji: o.emoji || '🍽️', nom: o.nom || 'Suggestion', pourquoi: o.pourquoi || '',
        macros: m,
        ings: [{ emoji: o.emoji || '🍽️', nom: o.nom, quantite_g: 0, macros: m }]
      };
    });
  }

  async function ouvrirCarrousel(mode) {
    montrer('naScCarou');
    var wrap = q('#naCarouWrap');
    wrap.innerHTML = '<div class="na-wait"><div class="na-spin"></div>'
      + '<div class="na-wait-t">Sélection en cours…</div>'
      + '<div class="na-wait-s">On cherche ce qui complète le mieux votre repas</div></div>';

    var r = restant();
    var opts;
    if (mode === 'resservir') {
      opts = optionsLocales(mode, r);          // pas besoin de l'IA : c'est le plat lui-même
    } else {
      try { opts = await optionsIA(mode, r); }
      catch (e) { opts = []; }
      // Une suggestion dont les macros sont nulles ne ferait pas bouger les
      // anneaux ni le suivi une fois enregistrée : on la remplace par des
      // propositions locales, dont les ingrédients sont toujours reconnus.
      opts = opts.filter(function (o) { return (o.macros && o.macros.cal) > 0; });
      if (opts.length < 3) opts = opts.concat(optionsLocales(mode, r));
    }
    if (ecranCourant() !== 'naScCarou') return;  // l'utilisateur est déjà reparti
    rendreCarrousel(classer(opts, r).slice(0, 5), mode);
  }

  function rendreCarrousel(opts, mode) {
    var wrap = q('#naCarouWrap');
    wrap.innerHTML = '<div class="na-carou" id="naCarou"></div>'
      + '<div class="na-dots" id="naDots"></div>'
      + '<div class="na-hint">Touchez une carte pour l\'ajouter à votre repas</div>';

    var carou = q('#naCarou'), dots = q('#naDots');
    opts.forEach(function (o, i) {
      var m = o.macros || {};
      var card = document.createElement('div');
      card.className = 'na-card';
      card.innerHTML = '<div class="na-card-t">' + esc(o.nom) + '</div>'
        + '<div class="na-card-vis"><span class="na-card-em">' + esc(o.emoji || '🍽️') + '</span>'
        + '<span class="na-card-kcal">' + Math.round(m.cal || 0) + ' Kcal</span></div>'
        + '<div class="na-card-mac">'
        + '<span>' + Math.round(m.prot || 0) + 'g<br>Protéines🥩</span>'
        + '<span>' + Math.round(m.gluc || 0) + 'g<br>Glucides🌾</span>'
        + '<span>' + Math.round(m.lip || 0) + 'g<br>Lipides🥑</span>'
        + '</div>'
        + '<div class="na-card-why">' + esc(o.pourquoi || '') + '</div>';
      card.addEventListener('click', function () { choisirOption(o, mode); });
      carou.appendChild(card);

      var dot = document.createElement('i');
      if (i === 0) dot.className = 'on';
      dots.appendChild(dot);
    });

    carou.addEventListener('scroll', function () {
      var i = Math.round(carou.scrollLeft / (carou.scrollWidth / opts.length));
      dots.querySelectorAll('i').forEach(function (d, j) { d.classList.toggle('on', j === Math.min(i, opts.length - 1)); });
    });
  }

  function choisirOption(o, mode) {
    if (mode === 'plat' || mode === 'dessert') {
      S.plats.push({ nom: o.nom, photo: null, ingredients: o.ings });
      S.cur = S.plats.length - 1;
    } else {
      var pl = S.plats[S.cur] || S.plats[0];
      o.ings.forEach(function (i) { pl.ingredients.push(i); });
    }
    rendreRecap();
    toast(o.nom + ' ajouté');
  }

  /* ═══════════════════ Enregistrement ═══════════════════ */
  async function enregistrer() {
    if (!S || !S.plats.length) return;
    if (!Natty.USER_ID) { toast('Connectez-vous pour enregistrer'); return; }
    var btn = q('#naTerminer');
    btn.disabled = true;
    var libelle = btn.textContent;
    btn.textContent = 'Enregistrement…';

    /* Une photo par plat, et chacune sur SON plat. Avant, une seule photo était
       envoyée (`S.file`) et collée au premier repas : depuis qu'on peut
       photographier plusieurs aliments à la suite, les suivants arrivaient sans
       image. L'échec d'un envoi ne bloque rien — le repas compte plus que sa
       photo. */
    async function televerser(file) {
      if (!file) return null;
      try {
        var fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', Natty.CLD_PRE);
        var up = await (await fetch('https://api.cloudinary.com/v1_1/' + Natty.CLD_CLD + '/image/upload',
          { method: 'POST', body: fd })).json();
        return up.secure_url || null;
      } catch (e) { return null; }
    }

    /* Les identifiants créés : le bilan en a besoin pour attacher l'analyse au
       plat, et pour écrire le choix de publication sur les bonnes lignes. */
    var ids = [];
    try {
      for (var i = 0; i < S.plats.length; i++) {
        var pl = S.plats[i];
        var ings = pl.ingredients.filter(function (g) { return (g.nom || '').trim(); });
        if (!ings.length) continue;
        var photoUrl = await televerser(pl.file);
        var saved = await Natty.sbPost('meals', {
          user_id: Natty.USER_ID, name: pl.nom || 'Repas',
          photo_url: photoUrl, meal_date: today(),
          /* ⚠️ PRIVÉ par défaut, et c'est tout le point de l'étape suivante :
             avant, tout plat enregistré partait dans le fil sans que personne
             ne l'ait demandé. Si la colonne n'existe pas sur l'instance,
             PostgREST refuse l'INSERT entier — d'où le repli plus bas. */
          partage: false
        }).catch(async function (e) {
          if (!/partage/.test(String(e && e.message || e))) throw e;
          PARTAGE_OK = false;
          return Natty.sbPost('meals', {
            user_id: Natty.USER_ID, name: pl.nom || 'Repas',
            photo_url: photoUrl, meal_date: today()
          });
        });
        var meal = saved && saved[0];
        if (!meal) continue;
        ids.push(meal.id);
        /* ⚠️ LES MACROS SONT ÉCRITES, ingrédient par ingrédient. Avant, seuls
           `name` et `quantity_g` partaient en base, et chaque écran redevinait
           les macros avec la table locale de `core.js` — d'où « saucisson =
           0 protéine, 0 kcal » : un aliment absent de la table comptait pour
           rien, en silence, dans le suivi comme dans le fil social.
           Ce qu'on enregistre ici, c'est ce que l'écran vient d'afficher :
           `macroDe()` est la même fonction que celle des anneaux. */
        await Natty.sbPost('meal_ingredients', ings.map(function (g) {
          var m = macroDe(g);
          return {
            meal_id: meal.id, name: g.nom, quantity_g: g.quantite_g || 0,
            calories: Math.round(m.c), proteins_g: m.p, carbs_g: m.g, fats_g: m.l
          };
        })).catch(function (e) {
          // Instance sans ces colonnes : on réenregistre le minimum plutôt que
          // de perdre le repas. `calcMac` retombera sur la table locale.
          if (!/calories|proteins_g|carbs_g|fats_g/.test(String(e && e.message || e))) throw e;
          return Natty.sbPost('meal_ingredients', ings.map(function (g) {
            return { meal_id: meal.id, name: g.nom, quantity_g: g.quantite_g || 0 };
          }));
        });
      }

      /* Les écrans hôtes rafraîchissent leurs macros sur cet événement, et on
         l'émet MAINTENANT : le plat est en base, l'anneau de Suivi doit
         descendre tout de suite, sans attendre que l'utilisateur ait fini de
         lire son analyse. */
      /* Marqueur local « un repas a été enregistré aujourd'hui ». Il sert au
         rappel de midi d'`assets/notifs.js` : « Ajoutez votre premier plat de la
         journée » ne doit pas partir à quelqu'un qui a déjà déjeuné. Une
         notification locale porte un texte figé à la planification, elle ne peut
         donc rien vérifier à l'envoi — c'est ici, au moment de l'écriture, que
         l'information existe. */
      try {
        // ⚠️ Même dérivation de clé que `user()` d'assets/notifs.js, repli
        // `'anon'` compris : sans lui, un USER_ID absent écrivait sous
        // `…_null` pendant que le rappel lisait `…_anon`, et le saut du
        // créneau de midi n'aurait jamais eu lieu. Attrapé au banc.
        localStorage.setItem('natty_dernier_repas_' + (Natty.USER_ID || 'anon'), today());
      } catch (e) {}
      window.dispatchEvent(new CustomEvent('natty:repas-ajoute'));

      if (!ids.length) { fermer(); toast('Repas enregistré !'); return; }
      bilan(ids);
    } catch (e) {
      toast('Enregistrement impossible');
      btn.disabled = false;
      btn.textContent = libelle;
      return;
    }
    btn.disabled = false;
    btn.textContent = libelle;
  }

  /* ═══════════════════ Bilan : analyse, puis publication ═══════════════════
     Ce que Pablo a demandé, dans cet ordre : « une fois que le client a
     enregistré son plat → cinématique et analyse critique du plat + conseil
     sur le prochain plat de la journée en fonction du garde-manger et des
     conseils », puis « poster ou enregistrer ».

     Deux principes tenus ici :
     • Le plat est DÉJÀ enregistré quand cet écran s'ouvre. Rien de ce qui suit
       ne peut le perdre : une analyse qui échoue, une connexion coupée, l'app
       fermée en route — le repas reste, et il reste privé jusqu'à ce qu'on
       choisisse de le publier.
     • L'analyse est écrite dans `meals.analyse_json` et dans le localStorage,
       avec la MÊME clé que `suivi.html` : rouvrir le plat depuis l'historique
       affichera ce texte-ci, sans le régénérer ni en produire un autre. */
  /* ⚠️ L'ORDRE EST LE SUJET. Le choix « Poster / Garder » s'affichait au bout
     de 900 ms, alors que l'analyse demande une dizaine de secondes : on
     appuyait sur « Garder pour moi », l'écran se fermait, et l'analyse critique
     — pourtant calculée et payée — n'était jamais vue. C'est exactement ce que
     Pablo a constaté (« il n'y a pas l'analyse critique du plat »).
     Désormais, trois temps : enregistré → analyse → prochain repas ; et le
     choix de publication n'arrive qu'ensuite. Il arrive quand même si
     l'analyse échoue, sinon on bloquerait la publication sur une panne d'IA. */
  async function bilan(ids) {
    montrer('naScBilan');
    var corps = q('#naBCorps'), choix = q('#naBChoix');
    corps.classList.remove('on');
    corps.innerHTML = '';
    choix.innerHTML = '';
    q('#naBTitre').textContent = 'Repas enregistré';
    q('#naBSub').textContent = '';

    // 1. La validation respire une seconde : c'est le moment où l'on comprend
    //    que c'est fait. Puis on annonce ce qui arrive, pour que l'attente
    //    suivante ait un nom.
    await pause(1100);
    q('#naBSub').textContent = 'Analyse de votre plat…';

    var data = null;
    try { data = await analyseCritique(); } catch (e) { data = null; }

    if (!data) {
      q('#naBSub').textContent = 'Analyse indisponible — votre repas est bien enregistré.';
      montrerChoix(ids);
      return;
    }

    // 2. L'analyse critique, seule. On ne peint pas la suggestion en même
    //    temps : deux blocs qui arrivent ensemble se lisent comme un seul.
    q('#naBTitre').textContent = 'Votre plat, analysé';
    q('#naBSub').textContent = data.note ? ('Verdict : ' + data.note) : '';
    corps.innerHTML = peindreAnalyse(data);
    reveler(corps);

    // Cache : même clé que suivi.html, pour que la réouverture du plat montre
    // ce texte-là et n'appelle plus rien. Écrit dès maintenant — l'utilisateur
    // peut fermer l'app pendant qu'il lit.
    try { localStorage.setItem('natty_analyse_plat_' + ids[0], JSON.stringify(data)); } catch (e) {}
    fetch(Natty.SB_URL + '/rest/v1/meals?id=eq.' + ids[0], {
      method: 'PATCH',
      headers: await Natty.entetes({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ analyse_json: data })
    }).catch(function () { /* colonne absente : le cache local suffit */ });

    // 3. Puis la suggestion du prochain repas, ajoutée en dessous.
    if (data.prochain && data.prochain.titre) {
      await pause(1600);
      var suite = document.createElement('div');
      suite.className = 'na-brev';
      suite.innerHTML = peindreProchain(data.prochain);
      corps.appendChild(suite);
      reveler(suite);
      suite.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 4. Et seulement là, le choix de publication.
    await pause(900);
    montrerChoix(ids);
  }

  function pause(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* Une classe posée par la seule rAF ne se pose pas si la page ne peint pas
     (app en arrière-plan) : le bloc resterait à `opacity:0`. Même précaution
     que `Natty.confirmer` et `assets/generation.js`. */
  function reveler(el) {
    if (!el) return;
    requestAnimationFrame(function () { el.classList.add('on'); });
    setTimeout(function () { el.classList.add('on'); }, 60);
  }

  /* Poster, ou garder pour soi. ⚠️ Rien n'est publié par défaut : c'était le
     cas avant (tout plat enregistré apparaissait dans le fil), et c'est
     précisément ce que cette étape corrige. `partage=false` d'abord, puis
     `true` seulement si on le demande. */
  function montrerChoix(ids) {
    var choix = q('#naBChoix');
    if (!choix || choix.innerHTML) return;
    choix.innerHTML =
        '<button class="na-btn primary" id="naPoster" style="font-size:17px;padding:16px">Poster dans le fil 🌍</button>'
      + '<button class="na-btn sombre" id="naGarder">Garder pour moi 🔒</button>';
    q('#naPoster').addEventListener('click', function () { publier(ids, true); });
    q('#naGarder').addEventListener('click', function () { publier(ids, false); });
  }

  async function publier(ids, dansLeFil) {
    var b1 = q('#naPoster'), b2 = q('#naGarder');
    if (b1) b1.disabled = true;
    if (b2) b2.disabled = true;
    try {
      if (!PARTAGE_OK) throw new Error('colonne partage absente');
      await fetch(Natty.SB_URL + '/rest/v1/meals?id=in.(' + ids.join(',') + ')', {
        method: 'PATCH',
        headers: await Natty.entetes({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ partage: !!dansLeFil })
      });
    } catch (e) {
      /* Colonne `partage` absente de l'instance : le plat reste visible comme
         tous les autres. On ne le dit pas ici — l'utilisateur n'y peut rien, et
         son repas est enregistré. */
    }
    fermer();
    toast(dansLeFil ? 'Publié dans le fil 🌍' : 'Gardé pour vous 🔒');
  }

  /* L'analyse et la suggestion, en un seul appel : les deux découlent du même
     état (ce plat, ce qu'il reste de la journée, les conseils de la semaine, le
     garde-manger), et deux appels séparés pourraient se contredire. */
  async function analyseCritique() {
    var mac = totalSession();
    var cible = cibleRepas();
    var plats = S.plats.map(function (pl) {
      return (pl.nom || 'Plat') + ' [' + pl.ingredients.map(function (i) {
        return i.nom + ' ' + Math.round(i.quantite_g || 0) + 'g';
      }).join(', ') + ']';
    }).join(' + ');

    // Ce qu'il reste pour la JOURNÉE, pas pour ce repas : la suggestion porte
    // sur le prochain repas, elle a besoin du reste du jour.
    var resteJour = await resteDeLaJournee(mac);

    // Les conseils de la semaine et le garde-manger : c'est ce qui rend la
    // suggestion personnelle plutôt que générique.
    var conseils = '', garde = '';
    try {
      var r = await Natty.sbFetch('profil_conseils?user_id=eq.' + Natty.USER_ID
        + '&order=generated_at.desc&limit=1&select=conseil_amelioration,conseil_prot,conseil_points_forts');
      var c = r && r[0];
      if (c) conseils = [c.conseil_amelioration, c.conseil_prot, c.conseil_points_forts]
        .filter(Boolean).join(' ');
    } catch (e) {}
    try {
      if (window.NattyGardeManger) {
        await NattyGardeManger.charger();
        garde = NattyGardeManger.pourPrompt() || '';
      }
    } catch (e) {}

    var prompt = 'Tu es le nutritionniste de cette personne. Analyse ce repas qu\'elle vient '
      + 'd\'enregistrer, puis propose-lui son PROCHAIN repas de la journée.\n'
      + 'Repas : ' + plats + '.\n'
      + 'Macros de ce repas : ' + mac.p + ' g de protéines, ' + mac.g + ' g de glucides, '
      + mac.l + ' g de lipides, ' + mac.c + ' kcal.\n'
      + 'Cible pour un repas : ' + cible.p + 'g / ' + cible.g + 'g / ' + cible.l + 'g / ' + cible.c + ' kcal.\n'
      + 'Reste pour la journée après ce repas : ' + resteJour.p + ' g de protéines, '
      + resteJour.g + ' g de glucides, ' + resteJour.l + ' g de lipides, ' + resteJour.c + ' kcal.\n'
      + (conseils ? 'Ses conseils de la semaine : ' + conseils + '\n' : '')
      + (garde ? 'Ce qu\'elle a chez elle : ' + garde + '\n' : '')
      + 'Le prochain repas doit tenir dans le reste de la journée, servir ses conseils, et '
      + (garde ? 'partir en priorité de ce qu\'elle a chez elle.\n' : 'rester simple à faire.\n')
      + 'Tutoiement, ton direct, aucune généralité. Réponds UNIQUEMENT en JSON sans backticks : '
      + '{"note":"Bon/Correct/À améliorer","points_positifs":["..."],"points_negatifs":["..."],'
      + '"conseils":["...","...","..."],'
      + '"prochain":{"titre":"...","pourquoi":"une phrase","ingredients":["..."],'
      + '"macros":{"prot":0,"gluc":0,"lip":0,"cal":0}}}';

    var res = await fetch(CLAUDE_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, max_tokens: 900 })
    });
    var d = await res.json();
    if (!res.ok) throw new Error(d.error || ('Erreur ' + res.status));
    var txt = (d.text || '{}').replace(/```[a-z]*|```/g, '').trim();
    var i = txt.indexOf('{'), j = txt.lastIndexOf('}');
    if (i === -1 || j <= i) throw new Error('réponse illisible');
    return JSON.parse(txt.slice(i, j + 1));
  }

  /* Ce qu'il reste sur la JOURNÉE : la cible quotidienne moins les repas déjà
     enregistrés aujourd'hui, moins celui qu'on vient d'ajouter. Les repas du
     jour sont relus ici plutôt que gardés en mémoire — entre l'ouverture du
     bouton + et l'enregistrement, un autre appareil a pu en ajouter un. */
  async function resteDeLaJournee(macSession) {
    var deja = { p: 0, l: 0, g: 0, c: 0 };
    try {
      var ms = await Natty.sbFetch('meals?user_id=eq.' + Natty.USER_ID
        + '&meal_date=eq.' + today() + '&select=id');
      var ids = (ms || []).map(function (m) { return m.id; });
      if (ids.length) {
        var ings = await Natty.sbFetch('meal_ingredients?meal_id=in.(' + ids.join(',') + ')'
          + '&select=name,quantity_g&limit=400');
        var t = Natty.calcMac(ings);
        deja = { p: t.p, l: t.l, g: t.g, c: t.c };
      }
    } catch (e) { /* hors ligne : on retombe sur la seule session */ }
    // `deja` inclut déjà le repas qu'on vient d'écrire : on ne le retire pas
    // deux fois. Si la relecture a échoué, on se rabat sur la session seule.
    var base = (deja.c ? deja : macSession);
    return {
      p: Math.max(0, Math.round((cibleJour.p || 0) - base.p)),
      l: Math.max(0, Math.round((cibleJour.l || 0) - base.l)),
      g: Math.max(0, Math.round((cibleJour.g || 0) - base.g)),
      c: Math.max(0, Math.round((cibleJour.c || 0) - base.c))
    };
  }

  /** L'analyse seule — la suggestion du prochain repas arrive après (voir `bilan`). */
  function peindreAnalyse(d) {
    var h = '';
    if (d.note) h += '<div class="na-bnote">' + esc(d.note) + '</div>';
    if (d.points_positifs && d.points_positifs.length) {
      h += '<div class="na-bsec">Ce qui va</div>'
        + d.points_positifs.map(function (t) {
            return '<div class="na-bcard plus">' + esc(t) + '</div>';
          }).join('');
    }
    if (d.points_negatifs && d.points_negatifs.length) {
      h += '<div class="na-bsec">À surveiller</div>'
        + d.points_negatifs.map(function (t) {
            return '<div class="na-bcard moins">' + esc(t) + '</div>';
          }).join('');
    }
    if (d.conseils && d.conseils.length) {
      h += '<div class="na-bsec">Conseils</div>'
        + d.conseils.map(function (t) {
            return '<div class="na-bcard">' + esc(t) + '</div>';
          }).join('');
    }
    return h;
  }

  function peindreProchain(n) {
    var m = n.macros || {};
    return '<div class="na-bsec">Votre prochain repas</div>'
      + '<div class="na-next"><div class="t">' + esc(n.titre) + '</div>'
      + (n.pourquoi ? '<div class="w">' + esc(n.pourquoi) + '</div>' : '')
      + '<div class="mm"><span>🥩 ' + Math.round(m.prot || 0) + 'g</span>'
      + '<span>🌾 ' + Math.round(m.gluc || 0) + 'g</span>'
      + '<span>🥑 ' + Math.round(m.lip || 0) + 'g</span>'
      + '<span>' + Math.round(m.cal || 0) + ' kcal</span></div>'
      + ((n.ingredients && n.ingredients.length)
          ? '<div class="ii">' + n.ingredients.slice(0, 10).map(function (x) {
              return '<i>' + esc(x) + '</i>';
            }).join('') + '</div>'
          : '')
      + '</div>';
  }

  /* ═══════════════════ Point d'entrée ═══════════════════ */
  function start() {
    if (!dom) build();
    S = { plats: [], cur: -1, file: null, photoDataUrl: null };
    chargerCibles();           // en tâche de fond ; rappelle majAnneaux() en fin
    // L'overlay s'ouvre sur la PRISE DE VUE : le cadre photo en héros, les
    // anneaux réduits et les calories restantes visibles avant même la photo.
    // Le récap n'arrive qu'une fois un plat reconnu ou saisi.
    dom.classList.add('on');
    document.body.style.overflow = 'hidden';   // jamais position:fixed (scroll iOS)
    majNoms();
    rendreDetail();
    rendreCapture();
  }

  window.NattyAjout = { start: start, open: start };
})();
