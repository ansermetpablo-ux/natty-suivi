/* Natty — <natty-carte> pour Wix Studio.
   FICHIER GÉNÉRÉ par scripts/build-wix.mjs le 2026-10-08.
   Ne pas éditer à la main : modifier wix/natty-carte.src.js et relancer.
   Catalogue : 10 plats publiables sur 12. */
/* ═══════════════════════════════════════════════════════════════
   Natty — <natty-carte>, la carte des plats pour Wix Studio

   ⚠️ CE FICHIER EST UN MODÈLE. Le fichier à publier est produit par
       node scripts/build-wix.mjs
   qui y injecte le catalogue depuis data/plats.json. Ne pas servir
   ce .src.js : il contient encore le marqueur de données.

   POURQUOI UN WEB COMPONENT ET PAS UN EMBED HTML. Un embed Wix est un
   iframe : hauteur fixe, police qui ne suit pas, et une barre de
   défilement à l'intérieur de la page. Un Custom Element se pose dans
   la page elle-même, prend la hauteur de son contenu, et son Shadow DOM
   empêche le CSS de Wix d'entrer — donc la carte a exactement l'allure
   de l'application, pas celle d'un gabarit Wix.

   CE QUE WIX EXIGE (vérifié dans leur documentation, 06/10/2026) :
   forfait Premium + domaine connecté, source en HTTPS, et un nom de
   balise en deux mots séparés par un tiret. Les trois sont remplis.

   CE QU'IL FAUT SAVOIR
   · Le composant ne lit rien au chargement : le catalogue est écrit
     dedans à la construction. Pas de requête réseau, donc la carte est
     là au premier rendu, sans clignotement.
   · Le contenu d'un Custom Element n'est pas indexé par les moteurs
     sauf à fournir un `seoMarkup` côté Velo. Les textes qui comptent
     pour le référencement (promesse, prix, FAQ) restent donc en natif
     Wix — ce composant ne porte que la partie qu'on manipule.

   ATTRIBUTS, réglables depuis l'éditeur Wix
     theme     "auto" (défaut) · "light" · "dark"
     img-base  racine des photos, défaut https://natty-suivi.vercel.app/img/
     lien-offre où mène « Continuer », défaut le tunnel d'abonnement
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CATALOGUE = {"genere_le":"2026-10-06","genere_par":"scripts/gen-plats.mjs","avertissement":"Fichier généré. Ne pas éditer à la main : relancer le script. Les valeurs sont calculées depuis les fiches techniques et NON VALIDÉES tant que nutrition_validee et allergenes_valides sont à false. Un plat avec coherent:false ne doit pas être publié en l'état.","methode":"Densité pour 100 g calculée depuis la fiche du chef après application des rendements, puis multipliée par le poids de portion décidé dans le tableau VENTE du générateur.","prix":{"unite":12.5,"abonnement":9},"categories":{"masse":{"label":"Prise de masse","promesse":"Les plus riches en protéines"},"perte":{"label":"Perte de poids","promesse":"Les plus légers en calories"},"bien":{"label":"Bien-être","promesse":"L'équilibre au quotidien"}},"libelles_allergenes":{"gluten":"Gluten","crustaces":"Crustacés","oeufs":"Œufs","poissons":"Poissons","arachides":"Arachides","soja":"Soja","lait":"Lait","fruits_a_coque":"Fruits à coque","celeri":"Céleri","moutarde":"Moutarde","sesame":"Graines de sésame","sulfites":"Sulfites","lupin":"Lupin","mollusques":"Mollusques"},"plats":[{"id":"poulet-moutarde","nom":"Poulet à la moutarde","categorie":"masse","categorie_label":"Prise de masse","description":"Poulet rôti à la moutarde, riz complet et légumes rôtis.","photo":"img/plats/poulet-moutarde.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":450,"pour_100g":{"kcal":130,"proteines":11.2,"glucides":13.4,"lipides":3.4},"nutrition":{"kcal":585,"proteines":50,"glucides":60,"lipides":15},"coherent":false,"nutrition_validee":false,"ingredients":[{"nom":"riz complet","grammes":1560,"quantite":"600 g (cru) → cuit"},{"nom":"cuisse de poulet","grammes":1050,"quantite":"6 cuisses"},{"nom":"carotte","grammes":300,"quantite":""},{"nom":"courgette","grammes":300,"quantite":"600 g de légumes au total"},{"nom":"moutarde","grammes":90,"quantite":"6 c. à s."},{"nom":"huile olive","grammes":56,"quantite":"4 c. à s."},{"nom":"thym","grammes":1,"quantite":"1 c. à c."},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":["moutarde"],"allergenes_valides":false,"fiche_technique":{"nom":"Poulet à la moutarde, riz complet, légumes rôtis","code":"PS","portions_fiche":6,"masse_fiche_g":3357}},{"id":"curry-poulet","nom":"Curry de poulet rôti","categorie":"masse","categorie_label":"Prise de masse","description":"Poulet au curry, lait de coco, haricots verts et riz complet.","photo":"img/plats/curry-poulet.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":450,"pour_100g":{"kcal":137,"proteines":8.3,"glucides":12.4,"lipides":6.1},"nutrition":{"kcal":617,"proteines":37,"glucides":56,"lipides":27},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"riz complet","grammes":1560,"quantite":"600 g (cru) → cuit"},{"nom":"poulet","grammes":900,"quantite":"900 g rôti désossé"},{"nom":"lait de coco","grammes":800,"quantite":"2 boîtes"},{"nom":"oignon","grammes":300,"quantite":"2"},{"nom":"haricots verts","grammes":300,"quantite":"300 g"},{"nom":"carotte","grammes":300,"quantite":"300 g"},{"nom":"huile olive","grammes":56,"quantite":"4 c. à s."},{"nom":"pate de curry","grammes":30,"quantite":"2 c. à s."},{"nom":"ail","grammes":20,"quantite":"4 gousses"},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":[],"allergenes_valides":false,"fiche_technique":{"nom":"Curry de poulet rôti, riz complet","code":"PS","portions_fiche":6,"masse_fiche_g":4266}},{"id":"thon-mangue","nom":"Thon grillé, salsa de mangue","categorie":"masse","categorie_label":"Prise de masse","description":"Steak de thon grillé, salsa de mangue, riz sauvage.","photo":"img/plats/thon-mangue.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":480,"pour_100g":{"kcal":98,"proteines":10.8,"glucides":12.2,"lipides":0.5},"nutrition":{"kcal":470,"proteines":52,"glucides":59,"lipides":2},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"riz sauvage","grammes":1200,"quantite":"~460 g (cru) → cuit"},{"nom":"thon","grammes":900,"quantite":"6 steaks"},{"nom":"mangue","grammes":500,"quantite":"2"},{"nom":"oignon rouge","grammes":150,"quantite":"1"},{"nom":"jus de citron","grammes":60,"quantite":"4 c. à s."},{"nom":"coriandre","grammes":20,"quantite":"1/2 tasse"},{"nom":"piment","grammes":10,"quantite":"1 jalapeño"},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":["poissons"],"allergenes_valides":false,"fiche_technique":{"nom":"Thon grillé, salsa de mangue, riz sauvage","code":"PS","portions_fiche":6,"masse_fiche_g":2840}},{"id":"chili-sin-carne","nom":"Chili sin carne","categorie":"bien","categorie_label":"Bien-être","description":"Haricots noirs, quinoa et avocat. Sans viande.","photo":"img/plats/chili-sin-carne.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":400,"pour_100g":{"kcal":92,"proteines":3.4,"glucides":13.7,"lipides":3.2},"nutrition":{"kcal":368,"proteines":14,"glucides":55,"lipides":13},"coherent":false,"nutrition_validee":false,"ingredients":[{"nom":"quinoa","grammes":510,"quantite":"1 tasse (cru) → cuit"},{"nom":"tomates concassees","grammes":400,"quantite":"1 boîte"},{"nom":"haricots noirs","grammes":250,"quantite":"1 boîte égouttée"},{"nom":"avocat","grammes":170,"quantite":"1"},{"nom":"poivron rouge","grammes":150,"quantite":"1"},{"nom":"oignon","grammes":150,"quantite":"1"},{"nom":"huile olive","grammes":14,"quantite":"1 c. à s."},{"nom":"chili en poudre","grammes":12,"quantite":"2 c. à s."},{"nom":"ail","grammes":10,"quantite":"2 gousses"},{"nom":"cumin","grammes":6,"quantite":"1 c. à s."},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":[],"allergenes_valides":false,"fiche_technique":{"nom":"Chili sin carne, haricots noirs et quinoa","code":"PS","portions_fiche":6,"masse_fiche_g":1672}},{"id":"dinde-vapeur","nom":"Dinde à la vapeur","categorie":"perte","categorie_label":"Perte de poids","description":"Poitrine de dinde vapeur, carottes, haricots verts, brocolis.","photo":"img/plats/dinde-vapeur.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":380,"pour_100g":{"kcal":100,"proteines":19.5,"glucides":2.8,"lipides":0.7},"nutrition":{"kcal":380,"proteines":74,"glucides":11,"lipides":3},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"dinde","grammes":1500,"quantite":"1,5 kg de poitrines"},{"nom":"carotte","grammes":260,"quantite":""},{"nom":"haricots verts","grammes":260,"quantite":""},{"nom":"brocoli","grammes":260,"quantite":"6 tasses de légumes au total"},{"nom":"sauce soja","grammes":45,"quantite":"3 c. à s."},{"nom":"thym","grammes":0,"quantite":"q.s."},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":["gluten","soja"],"allergenes_valides":false,"fiche_technique":{"nom":"Dinde à la vapeur, légumes","code":"PP","portions_fiche":6,"masse_fiche_g":2325}},{"id":"salade-poulet","nom":"Salade de poulet grillé","categorie":"perte","categorie_label":"Perte de poids","description":"Poulet grillé, laitue, tomates cerises, concombre, vinaigrette légère.","photo":"img/plats/salade-poulet.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":380,"pour_100g":{"kcal":128,"proteines":16.3,"glucides":1.8,"lipides":5.9},"nutrition":{"kcal":486,"proteines":62,"glucides":7,"lipides":22},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"poulet","grammes":1080,"quantite":"6 poitrines"},{"nom":"laitue","grammes":300,"quantite":"300 g"},{"nom":"tomates cerises","grammes":300,"quantite":"300 g"},{"nom":"concombre","grammes":300,"quantite":"1"},{"nom":"huile olive","grammes":84,"quantite":"6 c. à s."},{"nom":"vinaigre balsamique","grammes":45,"quantite":"3 c. à s."},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":[],"allergenes_valides":false,"fiche_technique":{"nom":"Salade de poulet grillé","code":"PP","portions_fiche":6,"masse_fiche_g":2109}},{"id":"natty-wrap","nom":"Le Natty wrap","categorie":"perte","categorie_label":"Perte de poids","description":"Poulet grillé, légumes frais, sauce signature au yaourt.","photo":"img/plats/natty-wrap.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":330,"pour_100g":{"kcal":138,"proteines":13.3,"glucides":13.3,"lipides":3.3},"nutrition":{"kcal":455,"proteines":44,"glucides":44,"lipides":11},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"poulet","grammes":600,"quantite":"600 g grillé"},{"nom":"tortilla","grammes":360,"quantite":"6 tortillas"},{"nom":"concombre","grammes":300,"quantite":"1"},{"nom":"poivron","grammes":150,"quantite":"1"},{"nom":"carotte","grammes":120,"quantite":"1"},{"nom":"yaourt nature","grammes":120,"quantite":"1/2 tasse"},{"nom":"jus de citron","grammes":30,"quantite":"2 c. à s."},{"nom":"menthe","grammes":5,"quantite":"q.s."},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":["gluten","lait"],"allergenes_valides":false,"fiche_technique":{"nom":"Natty wrap","code":"PP","portions_fiche":6,"masse_fiche_g":1685}},{"id":"merlu","nom":"Filet de merlu","categorie":"perte","categorie_label":"Perte de poids","description":"Merlu poché, brocoli, mangue et chou kale.","photo":"img/plats/merlu.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":430,"pour_100g":{"kcal":62,"proteines":9.4,"glucides":4.3,"lipides":0.5},"nutrition":{"kcal":267,"proteines":40,"glucides":18,"lipides":2},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"merlu","grammes":900,"quantite":"6 filets"},{"nom":"brocoli","grammes":300,"quantite":"300 g"},{"nom":"chou kale","grammes":300,"quantite":"300 g"},{"nom":"mangue","grammes":250,"quantite":"1"},{"nom":"vin blanc","grammes":120,"quantite":"1/2 tasse"},{"nom":"thym","grammes":0,"quantite":"bouquet garni"}],"allergenes":["poissons","sulfites"],"allergenes_valides":false,"fiche_technique":{"nom":"Merlu poché, brocoli, kale et mangue","code":"PP","portions_fiche":6,"masse_fiche_g":1870}},{"id":"salade-quinoa","nom":"Salade de quinoa","categorie":"perte","categorie_label":"Perte de poids","description":"Quinoa, légumes croquants, avocat, vinaigrette au citron.","photo":"img/plats/salade-quinoa.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":380,"pour_100g":{"kcal":117,"proteines":2.4,"glucides":11.9,"lipides":7.4},"nutrition":{"kcal":445,"proteines":9,"glucides":45,"lipides":28},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"quinoa","grammes":765,"quantite":"1,5 tasse (cru) → cuit"},{"nom":"avocat","grammes":340,"quantite":"2"},{"nom":"concombre","grammes":300,"quantite":"1"},{"nom":"tomate","grammes":240,"quantite":"2"},{"nom":"poivron rouge","grammes":150,"quantite":"1"},{"nom":"huile olive","grammes":84,"quantite":"6 c. à s."},{"nom":"jus de citron","grammes":80,"quantite":"2 citrons"},{"nom":"oignon rouge","grammes":75,"quantite":"1/2"},{"nom":"coriandre","grammes":10,"quantite":"1/4 tasse"},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":[],"allergenes_valides":false,"fiche_technique":{"nom":"Salade de quinoa","code":"VG","portions_fiche":6,"masse_fiche_g":2044}},{"id":"boeuf-braise","nom":"Bœuf braisé","categorie":"bien","categorie_label":"Bien-être","description":"Bœuf braisé, carottes, céleri, oignon, sauce au laurier.","photo":"img/plats/boeuf-braise.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":400,"pour_100g":{"kcal":147,"proteines":13.4,"glucides":2.3,"lipides":9},"nutrition":{"kcal":588,"proteines":54,"glucides":9,"lipides":36},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"boeuf","grammes":1500,"quantite":"1,5 kg gîte ou paleron"},{"nom":"bouillon de boeuf","grammes":750,"quantite":"750 ml"},{"nom":"carotte","grammes":480,"quantite":"4"},{"nom":"oignon","grammes":150,"quantite":"1"},{"nom":"celeri","grammes":100,"quantite":"2 branches"},{"nom":"huile olive","grammes":42,"quantite":"3 c. à s."},{"nom":"laurier","grammes":0,"quantite":"2 feuilles"},{"nom":"thym","grammes":0,"quantite":"3 branches"},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":["celeri"],"allergenes_valides":false,"fiche_technique":{"nom":"Bœuf braisé aux légumes","code":"PM","portions_fiche":6,"masse_fiche_g":3022}},{"id":"truite-herbes","nom":"Truite aux herbes","categorie":"bien","categorie_label":"Bien-être","description":"Truite au four aux herbes fraîches, légumes vapeur.","photo":"img/plats/truite-herbes.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":400,"pour_100g":{"kcal":136,"proteines":11.9,"glucides":2.7,"lipides":8.8},"nutrition":{"kcal":544,"proteines":48,"glucides":11,"lipides":35},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"truite","grammes":900,"quantite":"6 filets"},{"nom":"legumes","grammes":600,"quantite":"vapeur, pour accompagner"},{"nom":"citron","grammes":100,"quantite":"1"},{"nom":"huile olive","grammes":84,"quantite":"6 c. à s."},{"nom":"ciboulette","grammes":10,"quantite":"1/4 tasse"},{"nom":"persil","grammes":10,"quantite":"1/4 tasse"},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":["poissons"],"allergenes_valides":false,"fiche_technique":{"nom":"Truite aux herbes","code":"PM","portions_fiche":6,"masse_fiche_g":1704}},{"id":"quinoa-bowl","nom":"Quinoa bowl","categorie":"bien","categorie_label":"Bien-être","description":"Quinoa, légumes grillés et sauce tahini.","photo":"img/plats/quinoa-bowl.webp","prix":{"unite":12.5,"abonnement":9},"portion_reference_g":400,"pour_100g":{"kcal":106,"proteines":2.9,"glucides":12.2,"lipides":5.5},"nutrition":{"kcal":424,"proteines":12,"glucides":49,"lipides":22},"coherent":true,"nutrition_validee":false,"ingredients":[{"nom":"quinoa","grammes":765,"quantite":"1,5 tasse (cru) → cuit"},{"nom":"courgette","grammes":400,"quantite":"2"},{"nom":"poivron","grammes":300,"quantite":"2"},{"nom":"aubergine","grammes":300,"quantite":"1"},{"nom":"tahini","grammes":60,"quantite":"1/4 tasse"},{"nom":"huile olive","grammes":56,"quantite":"1/4 tasse"},{"nom":"jus de citron","grammes":30,"quantite":"2 c. à s."},{"nom":"ail","grammes":5,"quantite":"1 gousse"},{"nom":"sel","grammes":0,"quantite":"q.s."}],"allergenes":["sesame"],"allergenes_valides":false,"fiche_technique":{"nom":"Quinoa bowl, légumes grillés, sauce tahini","code":"VG","portions_fiche":6,"masse_fiche_g":1916}}]};
  if (!CATALOGUE || !CATALOGUE.plats) return;

  var POLICES = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..700&family=Instrument+Sans:ital,wght@0,400..700&display=swap';

  /* Les polices se chargent dans le document hôte : une @import dans le
     Shadow DOM bloque le premier rendu, et Wix ne les charge pas pour nous.
     Si le composant est isolé et que document.head est hors d'atteinte, la
     pile de secours prend le relais — d'où les familles système déclarées
     partout derrière. */
  function chargerPolices() {
    try {
      var d = document;
      if (d.querySelector('link[data-natty-polices]')) return;
      var l = d.createElement('link');
      l.rel = 'stylesheet';
      l.href = POLICES;
      l.setAttribute('data-natty-polices', '');
      d.head.appendChild(l);
    } catch (e) { /* tant pis, la pile de secours suffit */ }
  }

  var CSS = `
:host{
  /* Les jetons de assets/style.css, aux mêmes valeurs. Le site et l'app
     sont la même marque. Noir et blanc ; le vert ne dit qu'un état. */
  --bg:#FFFFFF; --surface:#F7F7F9; --surface-2:#ECECEF;
  --ink:#101014; --on-ink:#FFFFFF; --muted:#70707C; --line:#E8E8EE;
  --green:#2A9E4F; --amber:#B07400; --amber-bg:rgba(176,116,0,.10);
  --r-xl:30px; --r-lg:24px; --r-md:18px; --r-full:999px;
  --display:'Fraunces','Iowan Old Style',Georgia,serif;
  --text:'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;

  display:block;
  font-family:var(--text);
  color:var(--ink);
  background:var(--bg);
  font-size:17px;
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  container-type:inline-size;
}
:host([theme="dark"]){
  --bg:#0E0E11; --surface:#17171B; --surface-2:#1F1F26;
  --ink:#F4F4F7; --on-ink:#0E0E11; --muted:#8E8E99; --line:#2A2A32;
  --green:#32D74B; --amber:#FFB340; --amber-bg:rgba(255,179,64,.14);
}
@media (prefers-color-scheme:dark){
  :host([theme="auto"]), :host(:not([theme])){
    --bg:#0E0E11; --surface:#17171B; --surface-2:#1F1F26;
    --ink:#F4F4F7; --on-ink:#0E0E11; --muted:#8E8E99; --line:#2A2A32;
    --green:#32D74B; --amber:#FFB340; --amber-bg:rgba(255,179,64,.14);
  }
}
*{box-sizing:border-box}
img{max-width:100%;display:block}
button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px;border-radius:4px}
.num{font-variant-numeric:tabular-nums}

.enveloppe{padding:clamp(20px,4vw,40px) clamp(16px,4vw,40px)}

.entete{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:28px}
.sur{font-size:.74rem;text-transform:uppercase;letter-spacing:.16em;font-weight:600;color:var(--muted);margin:0 0 14px}
h2{font-family:var(--display);font-weight:600;font-size:clamp(1.8rem,4vw,2.9rem);letter-spacing:-.02em;line-height:1.06;margin:0;text-wrap:balance}

.filtres{display:flex;flex-wrap:wrap;gap:7px}
.filtres button{border:0;border-radius:var(--r-full);padding:10px 17px;font-size:.89rem;font-weight:600;background:var(--surface-2);color:var(--muted);transition:background .14s,color .14s}
.filtres button:hover{color:var(--ink)}
.filtres button[aria-pressed="true"]{background:var(--ink);color:var(--on-ink)}

.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}
.plat{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;display:flex;flex-direction:column;min-width:0}
.plat.retenu{border-color:var(--green)}
.photo{position:relative;aspect-ratio:1/1;background:var(--surface-2)}
.photo img{width:100%;height:100%;object-fit:cover}
.objectif{position:absolute;top:11px;left:11px;background:rgba(10,10,12,.68);backdrop-filter:blur(8px);color:#F6F3ED;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:6px 11px;border-radius:var(--r-full)}
.corps{padding:16px;display:flex;flex-direction:column;gap:9px;flex:1}
.titre{background:none;border:0;padding:0;text-align:left;font-family:var(--display);font-weight:600;font-size:1.1rem;letter-spacing:-.015em;line-height:1.15}
.titre:hover{text-decoration:underline;text-underline-offset:3px}
.desc{font-size:.86rem;color:var(--muted);line-height:1.45;flex:1;margin:0}
.macros{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;border-block:1px solid var(--line);padding-block:11px}
.macro{display:flex;flex-direction:column;gap:1px;min-width:0}
.macro .v{font-size:.96rem;font-weight:700;letter-spacing:-.02em;color:var(--muted)}
.macro.kcal .v{font-weight:800;color:var(--ink)}
.macro .k{font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600}
.pied{display:flex;align-items:center;gap:10px}
.prix{display:flex;flex-direction:column;margin-right:auto}
.prix b{font-size:1.1rem;font-weight:700;letter-spacing:-.02em}
.prix span{font-size:.73rem;color:var(--muted)}
.ajout{width:40px;height:40px;flex:none;border:0;border-radius:50%;background:var(--ink);color:var(--on-ink);display:grid;place-items:center;font-size:1.25rem;line-height:1;transition:transform .12s}
.ajout:hover{transform:scale(1.07)}
.plat.retenu .ajout{background:var(--green);color:#fff}

.note{margin:22px 0 0;font-size:.8rem;color:var(--muted);display:flex;gap:9px;flex-wrap:wrap;align-items:center}
.tbd{font-size:.95em;font-weight:600;color:var(--amber);background:var(--amber-bg);padding:1px 7px;border-radius:6px}

/* La fiche s'ouvre DANS le composant : un volet fixe par-dessus une page
   Wix recouvrirait sa propre barre d'outils, et on ne maîtrise pas ce
   qu'il y a autour. */
.fiche{border:1px solid var(--line);border-radius:var(--r-xl);background:var(--surface);overflow:hidden;margin-bottom:22px;display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}
.fiche[hidden]{display:none}
.fiche .ph{position:relative;min-height:230px;background:var(--surface-2)}
.fiche .ph img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.fiche .txt{padding:clamp(20px,3vw,30px);display:flex;flex-direction:column;gap:16px;min-width:0}
.fiche h3{font-family:var(--display);font-weight:600;font-size:1.6rem;letter-spacing:-.02em;margin:0;line-height:1.1}
.fiche .cat{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 4px}
.bloc h4{font-size:.7rem;text-transform:uppercase;letter-spacing:.13em;color:var(--muted);font-weight:600;margin:0 0 10px}
.cent{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.cent div{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-md);padding:11px 9px;display:flex;flex-direction:column;gap:2px;min-width:0}
.cent .v{font-size:1.1rem;font-weight:700;letter-spacing:-.02em}
.cent .kcal .v{font-weight:800}
.cent .k{font-size:.6rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:600}
.liste{font-size:.9rem;color:var(--muted);line-height:1.6;margin:0}
.liste b{color:var(--ink);font-weight:600}
.puces{display:flex;flex-wrap:wrap;gap:7px}
.puces span{font-size:.79rem;font-weight:600;background:var(--surface-2);color:var(--ink);padding:6px 12px;border-radius:var(--r-full)}
.fermer{position:absolute;top:12px;right:12px;width:36px;height:36px;border:0;border-radius:50%;background:rgba(10,10,12,.66);backdrop-filter:blur(8px);color:#F6F3ED;font-size:1.3rem;line-height:1;display:grid;place-items:center;z-index:2}
.achat{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--line);margin-top:auto}
.btn{border:0;border-radius:var(--r-full);padding:12px 22px;font-weight:600;font-size:.93rem;background:var(--surface-2);color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;gap:8px}
.btn.pri{background:var(--ink);color:var(--on-ink)}
.btn.vert{background:var(--green);color:#fff}

.panier{position:sticky;bottom:14px;z-index:3;display:flex;justify-content:center;margin-top:22px}
.panier[hidden]{display:none}
.panier-in{width:100%;max-width:560px;background:var(--ink);color:var(--on-ink);border-radius:var(--r-full);padding:11px 11px 11px 22px;display:flex;align-items:center;gap:14px;box-shadow:0 14px 40px rgba(0,0,0,.3)}
.panier-txt{display:flex;flex-direction:column;line-height:1.25;min-width:0}
.panier-txt b{font-size:1rem;font-weight:700}
.panier-txt span{font-size:.77rem;opacity:.7}
.panier .btn{margin-left:auto;background:var(--bg);color:var(--ink)}

@container (max-width: 700px){
  .fiche{grid-template-columns:1fr}
  .fiche .ph{min-height:200px;aspect-ratio:4/3}
  .cent{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

  var ECHAPPE = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ECHAPPE[c]; }); }
  function nb(v) { return Number(v).toLocaleString('fr-FR'); }
  function eur(v) { return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

  var MAX_SEMAINE = 10;

  class NattyCarte extends HTMLElement {
    static get observedAttributes() { return ['theme', 'img-base', 'lien-offre']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._retenus = new Set();
      this._filtre = 'tous';
      this._ouvert = null;
      /* Un plat marqué incohérent par le générateur ne sort jamais : ses
         valeurs sont hors des bornes de vraisemblance, et un chiffre faux
         sur une étiquette alimentaire coûte plus cher qu'un plat en moins. */
      this._plats = CATALOGUE.plats.filter(function (p) { return p.coherent !== false; });
    }

    get base() { return this.getAttribute('img-base') || 'https://natty-suivi.vercel.app/img/'; }
    get lienOffre() { return this.getAttribute('lien-offre') || 'https://natty-suivi.vercel.app/offre.html'; }

    connectedCallback() {
      chargerPolices();
      if (!this.hasAttribute('theme')) this.setAttribute('theme', 'auto');
      this.shadowRoot.innerHTML = '<style>' + CSS + '</style>' + this._squelette();
      this._$ = this.shadowRoot.getElementById.bind(this.shadowRoot);
      this._brancher();
      this._dessiner();
    }

    attributeChangedCallback(nom) {
      if (nom === 'img-base' && this.shadowRoot.childElementCount) this._dessiner();
    }

    _squelette() {
      var cats = CATALOGUE.categories || {};
      var boutons = [['tous', 'Tous']].concat(Object.keys(cats).map(function (k) { return [k, cats[k].label]; }));
      return '<div class="enveloppe">'
        + '<div class="entete">'
        +   '<div>'
        +     '<p class="sur">La carte de la semaine</p>'
        +     '<h2>Nos plats de la semaine.</h2>'
        +   '</div>'
        +   '<div class="filtres" id="filtres" role="group" aria-label="Filtrer par objectif">'
        +     boutons.map(function (b, i) {
                return '<button type="button" data-f="' + b[0] + '" aria-pressed="' + (i === 0) + '">' + esc(b[1]) + '</button>';
              }).join('')
        +   '</div>'
        + '</div>'
        + '<section class="fiche" id="fiche" hidden aria-live="polite"></section>'
        + '<div class="grille" id="grille"></div>'
        + '<p class="note">'
        +   '<span>Valeurs par portion de référence, calculées depuis les fiches techniques du chef. '
        +   'Votre barquette est calibrée sur vos besoins : ouvrez une fiche pour le détail pour 100 g.</span>'
        +   '<span class="tbd">en cours de validation</span>'
        + '</p>'
        + '<div class="panier" id="panier" hidden>'
        +   '<div class="panier-in">'
        +     '<div class="panier-txt"><b id="pTitre"></b><span id="pDetail"></span></div>'
        +     '<a class="btn" id="pLien">Continuer</a>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }

    _brancher() {
      var self = this;
      this._$('filtres').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-f]'); if (!b) return;
        self._filtre = b.dataset.f;
        Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        self._dessiner();
      });
      this._$('grille').addEventListener('click', function (e) {
        var t = e.target.closest('[data-ouvre]');
        if (t) { self._ouvrir(t.dataset.ouvre); return; }
        var a = e.target.closest('.ajout');
        if (a) self._basculer(a.closest('.plat').dataset.id);
      });
      this._$('fiche').addEventListener('click', function (e) {
        if (e.target.closest('[data-ferme]')) { self._fermer(); return; }
        var t = e.target.closest('[data-bascule]');
        if (t) self._basculer(t.dataset.bascule);
      });
    }

    _basculer(id) {
      if (this._retenus.has(id)) this._retenus.delete(id);
      else if (this._retenus.size >= MAX_SEMAINE) return;
      else this._retenus.add(id);
      this._dessiner();
      if (this._ouvert) this._ouvrir(this._ouvert, true);
      this._panier();
      /* Velo peut écouter cet événement pour suivre la sélection. */
      this.dispatchEvent(new CustomEvent('selection', {
        detail: { plats: Array.from(this._retenus), total: this._retenus.size * CATALOGUE.prix.abonnement },
        bubbles: true, composed: true
      }));
    }

    _plat(id) { return this._plats.filter(function (p) { return p.id === id; })[0]; }

    _dessiner() {
      var self = this, f = this._filtre;
      var liste = this._plats.filter(function (p) { return f === 'tous' || p.categorie === f; });
      this._$('grille').innerHTML = liste.map(function (d) {
        var pris = self._retenus.has(d.id);
        var n = d.nutrition;
        return '<article class="plat' + (pris ? ' retenu' : '') + '" data-id="' + esc(d.id) + '">'
          + '<div class="photo">'
          +   '<img src="' + esc(self.base + 'plats/' + d.id + '.webp') + '" alt="' + esc(d.nom) + '" width="720" height="720" loading="lazy">'
          +   '<span class="objectif">' + esc(d.categorie_label) + '</span>'
          + '</div>'
          + '<div class="corps">'
          +   '<button class="titre" type="button" data-ouvre="' + esc(d.id) + '">' + esc(d.nom) + '</button>'
          +   '<p class="desc">' + esc(d.description) + '</p>'
          +   '<div class="macros">'
          +     '<div class="macro kcal"><span class="v num">' + nb(n.kcal) + '</span><span class="k">kcal</span></div>'
          +     '<div class="macro"><span class="v num">' + nb(n.proteines) + '</span><span class="k">prot.</span></div>'
          +     '<div class="macro"><span class="v num">' + nb(n.glucides) + '</span><span class="k">gluc.</span></div>'
          +     '<div class="macro"><span class="v num">' + nb(n.lipides) + '</span><span class="k">lip.</span></div>'
          +   '</div>'
          +   '<div class="pied">'
          +     '<span class="prix"><b class="num">' + eur(d.prix.abonnement) + '</b><span>abonné · ' + eur(d.prix.unite) + ' à l\'unité</span></span>'
          +     '<button class="ajout" type="button" aria-pressed="' + pris + '" aria-label="' + (pris ? 'Retirer ' : 'Ajouter ') + esc(d.nom) + '">' + (pris ? '✓' : '+') + '</button>'
          +   '</div>'
          + '</div>'
          + '</article>';
      }).join('');
    }

    _ouvrir(id, sansDefiler) {
      var d = this._plat(id); if (!d) return;
      this._ouvert = id;
      var pris = this._retenus.has(id), n = d.nutrition, c = d.pour_100g;
      var lib = CATALOGUE.libelles_allergenes || {};
      var allerg = (d.allergenes_valides && d.allergenes.length)
        ? '<div class="puces">' + d.allergenes.map(function (a) { return '<span>' + esc(lib[a] || a) + '</span>'; }).join('') + '</div>'
        : (d.allergenes_valides
            ? '<p class="liste">Aucun des 14 allergènes à déclaration obligatoire.</p>'
            : '<p class="liste"><span class="tbd">liste en cours de validation par le chef</span></p>');

      var fiche = this._$('fiche');
      fiche.innerHTML = '<div class="ph">'
        +   '<img src="' + esc(this.base + 'plats/' + d.id + '.webp') + '" alt="' + esc(d.nom) + '" width="720" height="540">'
        +   '<button class="fermer" type="button" data-ferme aria-label="Fermer la fiche">×</button>'
        + '</div>'
        + '<div class="txt">'
        +   '<div><p class="cat">' + esc(d.categorie_label) + '</p><h3>' + esc(d.nom) + '</h3></div>'
        +   '<p class="liste">' + esc(d.description) + '</p>'
        +   '<div class="bloc"><h4>Pour 100 g</h4><div class="cent">'
        +     '<div class="kcal"><span class="v num">' + nb(c.kcal) + '</span><span class="k">kcal</span></div>'
        +     '<div><span class="v num">' + nb(c.proteines) + ' g</span><span class="k">protéines</span></div>'
        +     '<div><span class="v num">' + nb(c.glucides) + ' g</span><span class="k">glucides</span></div>'
        +     '<div><span class="v num">' + nb(c.lipides) + ' g</span><span class="k">lipides</span></div>'
        +   '</div>'
        +   '<p class="liste" style="margin-top:10px">Sur une portion de référence de ' + d.portion_reference_g + ' g : '
        +     nb(n.kcal) + ' kcal, ' + nb(n.proteines) + ' g de protéines, ' + nb(n.glucides) + ' g de glucides, '
        +     nb(n.lipides) + ' g de lipides. <b>Votre barquette est calibrée sur vos besoins</b>, donc sur votre portion ces valeurs montent ou descendent d\'autant.</p>'
        +   '</div>'
        +   '<div class="bloc"><h4>Ingrédients</h4><p class="liste">'
        +     d.ingredients.map(function (i, k) { return k === 0 ? '<b>' + esc(i.nom) + '</b>' : esc(i.nom); }).join(', ')
        +   '.</p></div>'
        +   '<div class="bloc"><h4>Allergènes</h4>' + allerg + '</div>'
        +   '<div class="achat">'
        +     '<span class="prix"><b class="num">' + eur(d.prix.abonnement) + '</b><span>abonné · ' + eur(d.prix.unite) + ' à l\'unité</span></span>'
        +     '<button class="btn ' + (pris ? 'vert' : 'pri') + '" type="button" data-bascule="' + esc(d.id) + '">'
        +       (pris ? '✓ Dans ma semaine' : 'Ajouter à ma semaine') + '</button>'
        +   '</div>'
        + '</div>';
      fiche.hidden = false;
      if (!sansDefiler) {
        try { fiche.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { /* vieux navigateur */ }
        var f = fiche.querySelector('[data-ferme]'); if (f) f.focus();
      }
    }

    _fermer() {
      this._ouvert = null;
      var f = this._$('fiche');
      f.hidden = true;
      f.innerHTML = '';
    }

    _panier() {
      var n = this._retenus.size, p = this._$('panier');
      p.hidden = n === 0;
      if (!n) return;
      var prix = CATALOGUE.prix;
      this._$('pTitre').textContent = n + (n > 1 ? ' plats' : ' plat') + ' · ' + nb(n * prix.abonnement) + ' € la semaine';
      this._$('pDetail').textContent = eur(prix.abonnement) + ' le plat en abonnement, au lieu de ' + eur(prix.unite);
      this._$('pLien').setAttribute('href', this.lienOffre);
    }
  }

  if (!customElements.get('natty-carte')) customElements.define('natty-carte', NattyCarte);
})();
