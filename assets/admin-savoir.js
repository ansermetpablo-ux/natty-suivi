/* ── Le savoir-faire d'une étape : geste × aliment ─────────────────────────
   Module `NattySavoir`, chargé par admin.html AVANT assets/admin-production.js,
   qui l'appelle depuis l'écran d'une étape (« Détails »).

   Demande de Pablo (2026-09-20) : « détailler les étapes avec le plus de
   détails possible afin que quelqu'un qui ne connaît pas du tout la cuisine
   puisse réaliser le plat au niveau d'un grand chef. Décrire exactement
   toutes les réactions, textures, eau, température. »

   Ce qu'il y avait : cinq lignes par GESTE (« feu vif, croûte, dorer »), les
   mêmes qu'on saisisse du bœuf, du cabillaud ou un oignon. Ce qu'il y a : un
   COURS par geste × FAMILLE d'aliment — la réaction qui se joue (Maillard,
   collagène, chlorophylle, amidon, émulsion…), le pas-à-pas exact, les
   températures et l'eau, ce qu'on doit voir, entendre, sentir, toucher à
   chaque phase, à quoi on reconnaît que c'est réussi, et les erreurs avec
   leur rattrapage.

   ⚠️ C'est un savoir GÉNÉRAL, annoncé comme tel à l'écran (« la fiche
   prime »). Rien ici n'est propre à une recette : la fiche donne SES
   grammes, SA température, SA durée — et quand elle ne les donne pas,
   l'écran le dit « manquant » plutôt que de les deviner (règle du module
   Production). Ici on dit ce qui est vrai de toute carotte qu'on taille et
   de tout oignon qu'on fait suer.

   ⚠️ Les températures À CŒUR sont celles d'un plat LIVRÉ — refroidi, puis
   réchauffé par le client — pas celles d'un restaurant qui sert à l'assiette :
   volaille 74 °C, viande hachée 70 °C, poisson 63 °C, morceau de bœuf
   braisé > 90 °C (c'est la gélatine qui commande, pas la sécurité).

   Ajouter un aliment = une ligne dans FAMILLES (les mots-clés, la famille).
   Ajouter un cours = une entrée SAVOIR[geste][famille], avec ces champs,
   tous facultatifs sauf `nom` :
     nom      le titre du cours
     pourquoi la réaction — ce qui se passe dans l'aliment, et pourquoi on
              fait comme ça
     pas      le pas-à-pas, numéroté, pour quelqu'un qui n'a jamais tenu
              un couteau
     chiffres températures, eau, temps, ratios — les repères généraux
     sens     ce qu'on voit / entend / sent / touche, phase par phase
     fin      à quoi on reconnaît que c'est réussi
     erreurs  « ✗ l'erreur → le rattrapage »
   La clé `_` d'un geste est le cours de repli quand aucune famille ne
   correspond ; elle porte aussi les règles valables pour tout le geste. */
(function () {
  'use strict';

  function norm(s) {
    return String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── Les familles d'aliments ─────────────────────────────────────────────
     Même règle de rapprochement que les illustrations : d'abord une clé à
     plusieurs mots contenue telle quelle (« pomme de terre » avant que
     « pomme » ne trouve le fruit), puis un mot de l'aliment qui COMMENCE par
     une clé (« carott » attrape carotte et carottes). Les plats composés
     (bourguignon, chili, curry, risotto, soupe) sont une famille à eux :
     c'est ce qu'on mijote. */
  var FAMILLES = [
    [['plat'], ['bourguignon', 'chili', 'curry', 'risotto', 'soupe', 'ragout', 'braise', 'daube', 'tajine', 'mijote', 'sauce tomate', 'bolognaise', 'garniture', 'farce', 'taboule', 'salade de', 'salade', 'ecrase', 'puree', 'papillote', 'boulette', 'galette', 'faconn', 'burger', 'burrito', 'wrap', 'tacos', 'saute', 'rectifier']],
    [['alliaces'], ['oignon', 'ail', 'echalot', 'ciboule', 'poireau']],
    [['racines'], ['carott', 'celeri', 'pomme de terre', 'patate', 'navet', 'betterave', 'panais', 'radis', 'fenouil', 'topinambour']],
    [['legumes_fruits'], ['salsa', 'poivron', 'concombre', 'tomate', 'courgette', 'aubergine', 'courge', 'potiron', 'butternut', 'pulpe']],
    [['legumes_verts'], ['brocoli', 'haricot vert', 'haricots verts', 'asperge', 'kale', 'chou', 'petit pois', 'petits pois', 'epinard', 'blette', 'bette', 'legume', 'pois gourmand', 'edamame']],
    [['herbes'], ['persil', 'coriandre', 'menthe', 'ciboulette', 'basilic', 'aneth', 'estragon', 'herbe', 'roquette', 'thym', 'laurier', 'romarin', 'origan']],
    [['aromates'], ['gingembre', 'piment', 'citronnelle', 'curcuma frais', 'galanga']],
    [['volaille'], ['poulet', 'dinde', 'volaille', 'canard', 'pintade', 'blanc de', 'cuisse', 'escalope']],
    [['viande'], ['boeuf', 'steak', 'veau', 'agneau', 'porc', 'lardon', 'hach', 'viande', 'gite', 'paleron']],
    [['poisson'], ['poisson', 'saumon', 'truite', 'thon', 'merlu', 'cabillaud', 'dorade', 'bar', 'lieu', 'colin', 'crevette', 'fruits de mer', 'court bouillon']],
    [['tofu'], ['tofu', 'tempeh', 'seitan']],
    [['riz'], ['riz']],
    [['graines'], ['quinoa', 'millet', 'boulgour', 'sarrasin', 'epeautre', 'orge', 'semoule', 'couscous', 'flocon']],
    [['pates'], ['pate', 'spaghetti', 'nouille', 'tagliatelle', 'penne', 'lasagne']],
    [['legumineuses'], ['lentille', 'pois chiche', 'haricot rouge', 'haricot blanc', 'haricot noir', 'haricots noirs', 'haricots rouges', 'haricots blancs', 'legumineuse', 'feve', 'haricot']],
    [['champignons'], ['champignon', 'cepe', 'girolle', 'shiitake', 'pleurote']],
    [['fruits'], ['avocat', 'mangue', 'orange', 'pamplemousse', 'citron', 'lime', 'agrume', 'pomme', 'poire', 'raisin', 'fruit', 'banane', 'ananas', 'grenade', 'fraise']],
    [['fruits_secs'], ['pignon', 'amande', 'noix', 'noisette', 'cajou', 'sesame', 'graines de']],
    [['emulsion'], ['vinaigrette', 'sauce yaourt', 'sauce tahini', 'sauce vierge', 'huile', 'vinaigre', 'balsamique', 'moutarde', 'tahini', 'yaourt', 'creme', 'mayonnaise', 'jus de citron']],
    [['condiments'], ['sauce soja', 'tamari', 'miel', 'sirop', 'nuoc', 'sauce poisson', 'worcestershire']],
    [['liquides'], ['mouill', 'deglac', 'bouillon', 'fond', 'vin', 'lait de coco', 'lait', 'eau', 'coulis', 'jus']],
    [['epices'], ['epice', 'cumin', 'paprika', 'curry en poudre', 'pate de curry', 'garam', 'curcuma', 'coriandre moulue', 'sel', 'poivre', 'cannelle', 'sumac']],
    [['liaison'], ['farine de riz', 'singer', 'lier', 'monter au beurre', 'farine', 'fecule', 'maizena', 'beurre', 'parmesan', 'fromage', 'feta', 'chapelure', 'oeuf']],
    [['pain'], ['tortilla', 'pain', 'galette', 'pita', 'naan', 'wrap']],
    [['four'], ['four']]
  ];
  function sing(m) { return m.length > 3 ? m.replace(/s$/, '') : m; }
  function famille(aliment) {
    var mots = norm(aliment || '').split(' ').map(sing), texte = ' ' + mots.join(' ') + ' ';
    var f = null;
    FAMILLES.some(function (e) {
      if (e[1].some(function (k) { return k.indexOf(' ') >= 0 && texte.indexOf(' ' + norm(k).split(' ').map(sing).join(' ')) >= 0; })) { f = e[0][0]; return true; }
      return false;
    }) || FAMILLES.some(function (e) {
      if (mots.some(function (m) { return e[1].some(function (k) { return k.indexOf(' ') < 0 && m.indexOf(sing(norm(k))) === 0; }); })) { f = e[0][0]; return true; }
      return false;
    });
    return f;
  }

  var SAVOIR = {};

  /* ═══════════════════════════════════════════════════════════════════════
     COUPER — la lame, la planche, et pourquoi le calibre décide de la cuisson
     ═══════════════════════════════════════════════════════════════════════ */
  SAVOIR.couper = {
    _: { nom: 'Tailler, quel que soit l’aliment',
      pourquoi: 'Un morceau cuit de l’extérieur vers le cœur : la chaleur met un temps proportionnel au CARRÉ de l’épaisseur. Un cube de 2 cm cuit quatre fois plus vite qu’un cube de 4 cm. Deux morceaux de tailles différentes dans la même poêle, c’est un morceau brûlé et un morceau cru. Le calibre n’est pas une coquetterie : c’est ce qui rend la cuisson possible.',
      pas: ['Poser un torchon humide sous la planche : elle ne doit pas bouger d’un millimètre.', 'Main qui tient l’aliment en « griffe » : bouts des doigts repliés sous les phalanges, le plat de la lame glisse contre les jointures. La lame ne peut pas atteindre les doigts.', 'La lame ne « scie » pas : elle avance en glissant vers l’avant ou l’arrière pendant qu’elle descend. Une lame qui descend tout droit écrase.', 'D’abord une face plate : couper une tranche pour poser l’aliment à plat. Un aliment qui roule est une main qui glisse.', 'Tailler tout le lot au MÊME calibre avant de passer à autre chose, et réserver chaque recette dans son bac.'],
      chiffres: ['📏 Un calibre s’annonce en millimètres : brunoise 3 mm, dés 1 cm, cubes 2–3 cm (sauté), cubes 4–5 cm (braisé). Vérifier les premiers morceaux à la règle s’il le faut.', '🔪 Une lame affûtée se reconnaît : elle mord une tomate sans la presser.'],
      sens: ['👁 Une tranche nette a une surface brillante et lisse ; une surface mate et pelucheuse dit que la lame écrase au lieu de couper.', '🖐 On sent la lame « accrocher » puis traverser sans forcer. Si on force, on s’arrête et on affûte.'],
      fin: 'Tous les morceaux se ressemblent, rangés dans un bac par recette, planche essuyée, chutes à la poubelle ou au bouillon.',
      erreurs: ['✗ Morceaux de tailles mélangées → trier : les gros dans un bac, les petits dans un autre, et les faire partir en cuisson à deux moments différents.', '✗ Planche qui glisse → torchon humide dessous, tout de suite.', '✗ Même planche pour la viande crue et les légumes → planche rouge pour les viandes, verte pour les légumes, ou laver à l’eau chaude et au détergent entre les deux.'] },

    alliaces: { nom: 'Oignon, ail, échalote : émincer et ciseler sans larmes',
      pourquoi: 'L’oignon garde ses composés soufrés dans des cellules séparées de l’enzyme qui les transforme. Chaque cellule écrasée libère l’enzyme, et un gaz irritant part vers les yeux. Une lame AFFÛTÉE tranche les cellules au lieu de les écraser : moins de gaz, moins de larmes, et un oignon qui reste ferme au lieu de rendre son jus sur la planche. L’ail marche pareil, en plus fort : plus on l’écrase, plus il pique — un ail pressé est bien plus puissant qu’un ail émincé, à poids égal.',
      pas: ['OIGNON — Couper la pointe (le côté opposé aux racines). GARDER la racine : c’est elle qui tient les couches ensemble pendant la coupe.', 'Poser sur la face coupée, fendre en deux de la pointe à la racine. Peler chaque moitié : la première pelure sèche et, si la couche dessous est parcheminée, celle-là aussi.', 'ÉMINCER (lamelles) : moitié posée à plat, racine vers la main de garde, trancher en suivant les courbes de la pointe vers la racine, 2–3 mm. Retirer la racine à la fin.', 'CISELER (petits dés) : moitié posée à plat, racine à l’opposé de la lame. 1) Deux ou trois entailles horizontales, parallèles à la planche, sans traverser la racine. 2) Des entailles verticales de la pointe vers la racine, sans la traverser. 3) Trancher en travers : les dés tombent. La racine reste en main.', 'AIL — Poser la gousse, le plat de la lame dessus, un coup sec de la paume : la peau se décolle. Fendre en deux et RETIRER LE GERME vert au centre — il est amer et se digère mal. Hacher fin, ou écraser au plat de la lame avec une pincée de sel (le sel fait abrasif).', 'OIGNON ROUGE pour du cru : émincer très fin (1–2 mm), puis 10 min dans l’eau froide et égoutter : il perd son piquant, garde sa couleur.'],
      chiffres: ['📏 Émincé 2–3 mm ; ciselé 3 mm (brunoise) ou 5 mm ; ail haché 1–2 mm.', '❄️ Un oignon sorti du frigo 30 min avant pique beaucoup moins : le froid ralentit l’enzyme.', '⏱ 1 oignon moyen (150 g) émincé en 40 s pour une main formée ; compter 2 min en apprenant. Le lot du jour se compte en minutes, pas en secondes.'],
      sens: ['👁 Un oignon bien ciselé fait des dés qui gardent leur angle ; des dés qui s’affaissent en bouillie disent que la lame écrasait.', '👃 Ça pique fort aux yeux = lame émoussée ou oignon tiède. Affûter, ou passer 10 min au froid.'],
      fin: 'Lamelles ou dés réguliers, secs sur la planche (pas de flaque de jus), racines et germes d’ail à la poubelle, bac par recette.',
      erreurs: ['✗ Racine coupée en premier → les couches se détachent et glissent : finir en tenant l’oignon par la pointe, et garder la racine sur le suivant.', '✗ Germe d’ail laissé → amertume une fois cuit : fendre et retirer, 5 secondes par gousse.', '✗ Ail haché bien avant l’heure → il s’oxyde et devient âcre : le hacher au plus tard, ou le couvrir d’un filet d’huile.'] },

    racines: { nom: 'Carotte, céleri, pomme de terre, patate douce : le calibre régulier',
      pourquoi: 'Les racines sont denses et pauvres en eau libre : elles cuisent lentement, de l’extérieur vers le cœur. C’est l’aliment où le calibre compte le plus — une rondelle de 5 mm est tendre en 8 min, une rondelle de 12 mm en 20. La pomme de terre pelée noircit à l’air (une enzyme oxyde sa chair) : on la garde sous l’eau froide.',
      pas: ['Éplucher à l’économe, DANS le sens de la longueur, en tournant l’aliment et non le bras. Bouts coupés.', 'Couper une fine tranche sur un côté pour faire une face plate, poser dessus : plus rien ne roule.', 'CAROTTE en rondelles : trancher droit, 5 mm ; en biseau (45°) pour un mijoté, 1 cm — plus de surface, plus de goût. En bâtonnets : tronçons de 5 cm, puis tranches de 5 mm, puis bâtonnets de 5 mm ; en julienne, pareil à 2–3 mm.', 'CÉLERI BRANCHE : retirer les fils avec l’économe (ils ne fondent jamais), puis 5 mm en travers.', 'POMME DE TERRE / PATATE DOUCE : cubes de 3 cm pour bouillir, 2 cm pour rôtir, et aussitôt dans un bac d’eau froide. Sécher AU TORCHON avant toute cuisson à la poêle ou au four.', 'Réserver par recette : la carotte du curry n’est pas taillée comme celle du bourguignon.'],
      chiffres: ['📏 Rondelles 5 mm (sauté) · biseau 1 cm (braisé) · bâtonnets 5 mm × 5 cm · cubes 2 cm (four) · 3 cm (eau).', '💧 Pommes de terre sous l’eau froide : pas plus d’1 h, elles perdraient leur amidon de surface (moins croustillantes).'],
      sens: ['👁 Une coupe régulière fait une pile de rondelles toutes de la même hauteur — on le voit d’un coup d’œil.', '🖐 Une carotte fraîche claque sous la lame ; molle et pliable, elle a perdu son eau : à mettre au bouillon, pas en garniture.'],
      fin: 'Morceaux au calibre demandé, pommes de terre sous l’eau, tout le reste sec, un bac par recette et par découpe.',
      erreurs: ['✗ Pommes de terre taillées qui brunissent → les couvrir d’eau froide ; une chair déjà grise se rince et redevient claire à la cuisson.', '✗ Rondelles épaisses et fines mélangées → trier en deux bacs et deux départs de cuisson, 5 min d’écart.'] },

    legumes_fruits: { nom: 'Poivron, concombre, tomate, courgette, aubergine : des légumes pleins d’eau',
      pourquoi: 'Ces légumes sont à 90–95 % d’eau, tenue par une peau. Un poivron se coupe par la CHAIR, jamais par la peau (la lame glisse dessus) ; une tomate mûre s’écrase sous une lame ordinaire : il faut une lame dentée ou très affûtée pour percer la peau sans presser. Les graines et les membranes blanches du poivron sont amères, celles de la tomate et du concombre donnent de l’eau qui noie une salade.',
      pas: ['POIVRON : couper le chapeau, puis le fond. Poser debout, fendre d’un côté, ouvrir à plat comme un livre. Retirer côtes blanches et graines d’un mouvement de lame. Poser PEAU CONTRE LA PLANCHE et tailler en lanières de 1 cm, ou en dés de 1 cm.', 'CONCOMBRE : laver ; fendre en deux dans la longueur ; si les graines sont grosses, les retirer à la petite cuillère (c’est l’eau). Demi-lunes de 3 mm pour une salade, dés de 1 cm pour une salsa.', 'TOMATE : couteau à dents (à pain) ou lame fraîchement affûtée. Retirer le pédoncule en cône. Pour une salsa ou une salade : couper en quartiers, retirer graines et jus, puis dés de 1 cm. Pour cuire : dés de 2 cm, graines gardées.', 'COURGETTE : ne pas éplucher (la peau tient le morceau). Rondelles ou demi-lunes de 1 cm ; pour creuser, fendre en deux dans la longueur et vider à la cuillère en laissant 8 mm de chair sur les bords — la pulpe se garde.', 'AUBERGINE : cubes de 2 cm. Facultatif : 20 min au sel fin dans une passoire, rincer, sécher — elle boit moins d’huile.'],
      chiffres: ['📏 Lanières 1 cm · dés 1 cm (salsa, salade) · 2 cm (cuisson).', '💧 Une tomate épépinée perd un tiers de son poids : le peser APRÈS pour une salsa dont on veut la tenue.'],
      sens: ['👁 La lame doit entrer dans la tomate sans que la tomate ne bouge : si elle se déforme avant que la lame n’entre, changer de couteau.', '🖐 Le concombre épépiné ne coule pas dans le bac ; épépiner si une flaque se forme en 5 min.'],
      fin: 'Dés ou lanières réguliers, sans peau détachée ni graines ; tomates et concombres pour le cru égouttés dans une passoire.',
      erreurs: ['✗ Poivron taillé peau dessus → la lame glisse, les lanières sont irrégulières : retourner, peau contre la planche.', '✗ Salade de tomates qui baigne → épépiner et saler 10 min dans une passoire avant d’assembler.'] },

    legumes_verts: { nom: 'Brocoli, haricots, asperges, kale, chou : préparer pour une cuisson courte',
      pourquoi: 'Les légumes verts cuisent vite et perdent leur couleur s’ils cuisent trop (voir « bouillir »). La découpe sert à ce qu’ils cuisent TOUS en même temps : des fleurettes de brocoli de 3 cm et d’autres de 6 cm ne peuvent pas être prêtes ensemble. Les parties fibreuses (tige, base d’asperge, côte de kale) se retirent ou s’épluchent : elles ne s’attendrissent jamais dans le temps qu’il faut aux feuilles.',
      pas: ['BROCOLI : retourner la tête, détacher les fleurettes en coupant à la base de chaque branche, puis refendre les grosses pour que toutes fassent 3–4 cm. La tige est bonne : l’éplucher (elle est fibreuse dehors), la couper en rondelles de 5 mm, elle cuira avec le reste.', 'HARICOTS VERTS : équeuter les deux bouts (à la main, par poignée, en alignant les bouts). Couper en deux s’ils dépassent 8 cm.', 'ASPERGES : tenir la base et le milieu, plier : elle casse d’elle-même là où elle devient fibreuse. Éplucher le tiers bas des blanches et des grosses vertes.', 'KALE : tenir la tige d’une main, arracher la feuille de l’autre en glissant vers le haut. Empiler les feuilles, rouler, trancher en rubans de 1 cm. Pour le cru : masser 1 min avec un filet d’huile et une pincée de sel — la feuille s’assouplit et fonce.', 'CHOU (râpé, salade) : retirer les feuilles abîmées, couper en quartiers, retirer le trognon en biais, émincer à 2 mm à la mandoline (garde-main obligatoire) ou au couteau bien affûté.'],
      chiffres: ['📏 Fleurettes 3–4 cm · rondelles de tige 5 mm · rubans de kale 1 cm · chou 2 mm.', '⏱ Le calibre commande la cuisson : à 3 cm, un brocoli est cuit en 3–4 min d’eau bouillante.'],
      sens: ['👁 Une fleurette bien coupée garde sa « tête » entière ; une pluie de petits grains verts sur la planche dit qu’on a coupé dans la fleur au lieu de la branche.', '🖐 Le chou émincé fin s’assouplit dès qu’on le sale ; épais, il reste coriace même assaisonné.'],
      fin: 'Morceaux de taille égale, parties fibreuses retirées, lavés et ESSORÉS (l’eau sur les feuilles fait retomber la température de la poêle).',
      erreurs: ['✗ Fleurettes de tailles très différentes → refendre les grosses, ne pas laisser passer.', '✗ Chou émincé trop épais → repasser au couteau, ou le saler 15 min pour qu’il s’assouplisse.'] },

    herbes: { nom: 'Persil, coriandre, menthe, ciboulette : hacher sans écraser',
      pourquoi: 'Le parfum d’une herbe est dans des huiles enfermées dans les cellules des feuilles. Une lame qui écrase libère tout d’un coup sur la planche — et la feuille noircit en quelques minutes (l’air oxyde ce qui a été libéré). Une lame affûtée qui tranche d’un coup garde le parfum DANS la feuille jusqu’à l’assiette. Une herbe mouillée se colle à la lame et s’écrase : on la sèche d’abord.',
      pas: ['Laver dans un bac d’eau froide (pas sous le robinet : la pression abîme), soulever pour laisser la terre au fond. Essorer à l’essoreuse, puis finir dans un torchon : les feuilles doivent être SÈCHES.', 'Effeuiller : tenir la tige, tirer les feuilles vers le bas. Pour la coriandre, les tiges fines sont bonnes et parfumées — les garder, hacher avec.', 'Rassembler en tas serré, poser la pointe du couteau sur la planche, l’autre main à plat sur le dos de la lame, et hacher en balancier — quelques passes seulement. Pas dix : plus on hache, plus on écrase.', 'MENTHE et BASILIC : empiler les feuilles, rouler serré, trancher en rubans fins (chiffonade) d’un seul geste par tranche. Ne pas repasser.', 'CIBOULETTE : aux ciseaux, directement au-dessus du plat, 2–3 mm.', 'Hacher au DERNIER MOMENT, ou au plus tôt 30 min avant, et couvrir d’un film au contact.'],
      chiffres: ['📏 Haché 2–3 mm ; chiffonade 3–5 mm ; ciboulette 2–3 mm.', '⏱ Le persil haché noircit visiblement au bout de 30–45 min à l’air ; la menthe et le basilic en 10–15 min.'],
      sens: ['👁 Un bon haché est vert vif et « sec » sur la planche. Une tache verte sombre sur la planche = les feuilles ont été écrasées, on a perdu le parfum.', '👃 Le parfum doit monter au moment où on hache, pas avant : si la planche sent fort après trois passes, c’est trop.'],
      fin: 'Herbes sèches, hachées fin sans tache sur la planche, dans un petit bac filmé au contact, ajoutées EN FIN de cuisson ou au dressage.',
      erreurs: ['✗ Herbes hachées mouillées → bouillie noire : sécher les feuilles à fond avant, toujours.', '✗ Persil ajouté en début de cuisson → il perd tout : le mettre dans les 2 dernières minutes, ou au dressage.'] },

    aromates: { nom: 'Gingembre, piment : préparer les aromates forts',
      pourquoi: 'Le gingembre est fibreux : haché grossièrement, ses fibres restent en bouche. Râpé ou haché très fin, il fond dans le plat. Le piquant du piment (la capsaïcine) n’est pas surtout dans les graines mais dans les MEMBRANES blanches qui les portent : retirer membranes et graines donne le parfum sans la brûlure. Cette même capsaïcine passe des doigts aux yeux — se laver les mains au savon avant de se toucher le visage.',
      pas: ['GINGEMBRE : éplucher avec le bord d’une petite cuillère (elle suit les bosses, l’économe gaspille). Couper en tranches de 2 mm dans le sens des fibres, puis en bâtonnets, puis en dés de 2 mm — ou râper à la râpe fine (Microplane).', 'PIMENT : gants, ou mains lavées au savon juste après. Couper le chapeau, fendre en deux, gratter graines et membranes blanches à la pointe du couteau. Émincer à 2 mm. Pour un plat plus fort, garder une partie des membranes — jamais toutes d’un coup.'],
      chiffres: ['📏 Gingembre 2 mm (haché) ; piment 2 mm.', '🌶 Un piment moyen sans graines ni membranes ≈ un quart du piquant du même piment entier.'],
      sens: ['👃 Un gingembre frais sent le citron et pique le nez ; un gingembre mou et ridé a perdu l’essentiel.', '🖐 Après le piment, ne pas se frotter les yeux tant que les mains n’ont pas été savonnées.'],
      fin: 'Gingembre en dés minuscules ou râpé, piment épépiné et émincé, mains lavées, planche lavée (le piment reste sur le bois).',
      erreurs: ['✗ Plat trop piquant → on ne peut pas retirer le piquant ; on l’adoucit : yaourt, lait de coco, un peu de sucre, plus de volume de plat. Toujours mettre la moitié du piment, goûter, ajuster.'] },

    volaille: { nom: 'Poulet, dinde : découper une volaille crue en sécurité',
      pourquoi: 'La volaille crue porte des bactéries (salmonelle, campylobacter) que seule la cuisson détruit. Tout ce qu’elle touche — planche, couteau, mains, torchon — devient un vecteur vers les légumes qu’on mangera crus. On ne la RINCE JAMAIS : l’eau projette les bactéries à 50 cm autour de l’évier. La chair a un sens de fibres : coupée EN TRAVERS des fibres, elle est tendre ; dans le sens, elle est filandreuse.',
      pas: ['Planche dédiée (rouge), couteau dédié, et rien d’autre sur la planche. Sortir la volaille du froid au dernier moment : moins de 20 min à température ambiante.', 'BLANC : poser à plat, retirer le petit filet blanc (le tendon) s’il gêne, et les parties grasses ou nacrées. Pour des lanières : trancher EN TRAVERS de la longueur, 1 cm. Pour des cubes : lanières de 3 cm, puis cubes de 3 cm.', 'CUISSE à désosser : peau dessous, inciser le long de l’os, dégager l’os à la pointe du couteau, le retirer avec le cartilage. Retirer les nerfs blancs.', 'Une fois la volaille dans son bac : couteau, planche et mains à l’eau chaude et au savon — 30 secondes de savonnage. Ensuite seulement, les légumes.'],
      chiffres: ['📏 Lanières 1 cm (sauté rapide) · cubes 3 cm (poêle, brochette) · escalope aplatie 1 cm (poché, plancha).', '🌡 Chair crue à garder ≤ 4 °C ; 20 min au plus hors du froid ; cuisson à 74 °C à cœur.'],
      sens: ['👁 Une chair fraîche est rosée, brillante, sans odeur ; une chair grise ou collante ne se cuisine pas.', '🖐 Les fibres se voient sur le blanc : des lignes qui vont de la pointe à la base. On coupe en travers.'],
      fin: 'Morceaux au calibre, sans gras ni tendon, dans un bac filmé au froid ; planche, couteau et mains lavés avant tout autre aliment.',
      erreurs: ['✗ Volaille rincée sous le robinet → nettoyer et désinfecter tout l’évier et 50 cm autour, tout de suite.', '✗ Légumes coupés après la volaille sans laver → les légumes destinés au cru sont à jeter ; ceux qui cuisent à cœur passent.'] },

    viande: { nom: 'Bœuf : tailler pour braiser, trancher contre le grain',
      pourquoi: 'Un morceau à braiser (gîte, paleron) est plein de collagène, le tissu qui tient les muscles. Ce collagène fond en gélatine seulement après des heures de chaleur douce — c’est ce qui rend le bourguignon fondant. La viande RÉTRÉCIT de 20 à 25 % en cuisant : un cube de 4–5 cm devient une bouchée de 3–4 cm ; taillé à 2 cm, il finit sec et minuscule. Et une tranche coupée dans le sens des fibres est coriace : on tranche EN TRAVERS.',
      pas: ['Planche rouge, viande sortie du froid au dernier moment.', 'Retirer les gros nerfs blancs et les membranes brillantes (elles ne fondent pas). GARDER le gras intramusculaire (les veinules blanches) : c’est le goût et le moelleux du braisé.', 'Repérer le sens des fibres (les lignes). Trancher d’abord en tranches de 4–5 cm EN TRAVERS des fibres, puis en bâtons, puis en cubes de 4–5 cm.', 'Sécher les cubes sur un papier absorbant : une surface sèche colore, une surface mouillée bout.', 'Pour de la viande hachée déjà prête : ne pas la couper, la casser à la main en morceaux de 3 cm au moment de saisir.'],
      chiffres: ['📏 Cubes à braiser 4–5 cm · à sauter rapide 2 cm · tranche 1 cm contre le grain.', '📉 Perte à la cuisson ≈ 20–25 % du poids cru.'],
      sens: ['👁 Le sens des fibres se voit comme un « grain » de bois ; la lame doit le couper perpendiculairement.', '🖐 Un cube bien séché ne brille plus.'],
      fin: 'Cubes réguliers de 4–5 cm, secs, sans nerfs, gras intramusculaire gardé, au froid jusqu’à la saisie.',
      erreurs: ['✗ Cubes trop petits pour un braisé → ils seront secs ; réduire le temps de mijotage d’un tiers et vérifier à la fourchette dès 1 h 30.', '✗ Gras entièrement retiré → le braisé sera sec : compenser par une matière grasse dans la sauce (une noix de beurre en fin).'] },

    champignons: { nom: 'Champignons : nettoyer sans les noyer, tailler en quartiers',
      pourquoi: 'Un champignon est une éponge : à 90 % d’eau, il en absorbe encore si on le lave à grande eau — et cette eau ressort dans la poêle, où il bout au lieu de dorer. On le nettoie donc à sec ou presque. Le pied est bon, sauf sa base terreuse.',
      pas: ['Couper la base du pied (la partie sale et sèche), 3 mm.', 'Nettoyer avec un pinceau, une brosse douce ou un papier humide, un par un. Si vraiment terreux : passage éclair sous l’eau, et sécher aussitôt au torchon.', 'Tailler en quartiers (gros champignons) ou en deux (petits) : ils doivent faire tous 2–3 cm. Les lamelles de 3 mm pour un sauté rapide.', 'Ne pas tailler à l’avance : ils brunissent en 30 min à l’air.'],
      chiffres: ['📏 Quartiers 2–3 cm (mijoté, poêle) · lamelles 3 mm (sauté).', '💧 Un champignon lavé à l’eau prend jusqu’à 5 % de son poids en eau.'],
      sens: ['👁 Chapeau fermé, chair blanche et sèche sous le chapeau = frais. Lamelles noires et chapeau ouvert = à cuire aujourd’hui, en sauce.', '🖐 Ferme et sec sous le doigt ; visqueux = jeter.'],
      fin: 'Champignons propres, secs, en quartiers réguliers, taillés juste avant la cuisson.',
      erreurs: ['✗ Champignons trempés → les sécher au torchon puis 10 min étalés à l’air avant la poêle.', '✗ Taillés depuis une heure et bruns → sans danger, mais moins beaux : les réserver au mijoté plutôt qu’à la poêle.'] },

    fruits: { nom: 'Avocat, mangue, agrumes : dénoyauter, peler à vif, protéger de l’air',
      pourquoi: 'L’avocat brunit dès qu’il est coupé : une enzyme oxyde sa chair à l’air. Un acide (citron, lime) bloque l’enzyme — d’où le citron AUSSITÔT. La mangue a un noyau plat au centre : on la coupe en « joues » de part et d’autre. L’agrume se pèle « à vif » (peau et membrane blanche ensemble) pour des quartiers sans amertume : la partie blanche est amère.',
      pas: ['AVOCAT : fendre tout autour dans la longueur jusqu’au noyau, tourner les deux moitiés en sens inverse. Retirer le noyau avec une CUILLÈRE (jamais en frappant le couteau dedans : c’est l’accident classique). Vider la chair à la cuillère, dés de 1,5 cm, jus de citron dessus tout de suite.', 'MANGUE : poser debout, trancher les deux joues le long du noyau plat (à 1 cm du centre). Quadriller chaque joue au couteau sans percer la peau, retourner la peau en la poussant : les cubes ressortent en hérisson, on les détache à la lame. Récupérer la chair autour du noyau.', 'AGRUMES en suprêmes : couper les deux pôles, poser à plat, peler à vif en suivant la courbe pour retirer TOUTE la partie blanche. Au-dessus d’un bol, glisser la lame le long de chaque membrane pour lever les quartiers nus. Presser ce qui reste pour le jus.', 'CITRON en rondelles : 3 mm, pépins retirés. Zeste : râpe fine, seulement la partie jaune — le blanc est amer.'],
      chiffres: ['📏 Avocat dés 1,5 cm · mangue dés 1 cm (salsa) · citron rondelles 3 mm.', '⏱ Un avocat coupé sans acide brunit en 15–20 min ; avec du citron et un film au contact, il tient 3–4 h.'],
      sens: ['🖐 Un avocat mûr cède sous une pression douce près de la queue, sans être mou partout. Une mangue mûre sent sucré au niveau de la queue et cède un peu.', '👁 Un suprême réussi n’a aucune trace blanche.'],
      fin: 'Fruits taillés, avocat citronné et filmé au contact, agrumes sans membrane, jus récupéré.',
      erreurs: ['✗ Noyau d’avocat retiré au couteau → risque de coupure grave à la paume : cuillère, toujours.', '✗ Avocat déjà brun → retirer la couche brune à la cuillère (1 mm), citronner le reste.'] },

    tofu: { nom: 'Tofu : presser, puis tailler',
      pourquoi: 'Le tofu ferme est vendu dans son eau : il en garde 20–30 % de trop, qui ressortira dans la poêle et l’empêchera de dorer (l’eau bout à 100 °C, la coloration demande 140 °C et plus à la surface). Pressé, il devient dense, tient sa forme et prend la croûte. C’est l’étape que tout le monde saute et qui change tout.',
      pas: ['Égoutter, poser le bloc entre deux torchons propres (ou du papier absorbant), une planche dessus, un poids d’1 kg (une boîte de conserve) sur la planche. 20 à 30 min.', 'Tailler en cubes de 2,5 cm (poêle) ou en tranches de 1 cm (plancha, four). Sécher encore une fois à la surface.', 'Facultatif pour une croûte plus croustillante : rouler les cubes dans une cuillère à soupe de fécule pour 400 g.'],
      chiffres: ['📏 Cubes 2,5 cm · tranches 1 cm.', '⏱ 20–30 min de pressage ; 💧 il perd 60 à 100 g d’eau pour un bloc de 400 g.'],
      sens: ['🖐 Un tofu bien pressé est ferme et mat, il ne laisse pas de trace humide sur la planche.', '👁 Les torchons sortent trempés : c’est ce qu’on voulait.'],
      fin: 'Cubes secs et réguliers, fermes en main, prêts à saisir.',
      erreurs: ['✗ Pas pressé → il colle et s’émiette dans la poêle : au minimum, le sécher fort au torchon et cuire dans plus d’huile à feu plus vif, sans y toucher 4 min.'] }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     SAISIR — la réaction de Maillard, et l'eau qui l'empêche
     ═══════════════════════════════════════════════════════════════════════ */
  SAVOIR.saisir = {
    _: { nom: 'Saisir, quel que soit l’aliment',
      pourquoi: 'Dorer, c’est la réaction de Maillard : au-dessus de 140 °C environ, les sucres et les protéines de la surface se combinent et fabriquent des centaines d’arômes — le goût de « grillé », de croûte, de rôti. Mais tant qu’il y a de l’eau à la surface, celle-ci reste à 100 °C (l’eau ne peut pas dépasser son point d’ébullition) : rien ne dore, ça BOUT. D’où les trois règles : surface SÈCHE, poêle très CHAUDE, et pas trop de morceaux à la fois (chacun apporte son eau, et la température s’effondre).',
      pas: ['Chauffer la poêle VIDE à feu vif 2 min. Ajouter la matière grasse : elle doit onduler et fumer à peine — pas fumer franchement.', 'Sécher l’aliment au papier absorbant. Saler juste avant de poser.', 'Poser les morceaux un par un, en les éloignant de soi (les projections partent vers l’avant), avec 1 cm entre eux. Une seule couche.', 'NE PAS TOUCHER pendant 2 à 4 minutes. L’aliment accroche d’abord, puis se décolle de lui-même quand la croûte est formée. Forcer avant, c’est arracher la croûte.', 'Retourner à la pince, colorer l’autre face, réserver sur une plaque À PLAT, jamais en tas (la vapeur du tas ramollit la croûte).', 'Lot suivant. Entre deux lots, laisser la poêle remonter en température 30 s.'],
      chiffres: ['🌡 Maillard : nette au-dessus de 140 °C, franche entre 150 et 180 °C ; au-delà de 200 °C on brûle (amer, noir).', '🌡 Points de fumée : huile d’olive vierge ~190 °C · huile neutre (tournesol, colza raffiné) ~220 °C · beurre ~150 °C (il brûle) · beurre clarifié ~250 °C.', '📐 Surface libre : 1 cm entre les morceaux ; la poêle ne doit jamais être couverte de plus de deux tiers.'],
      sens: ['👂 Le SON dit tout : un grésillement vif et régulier = ça dore. Un chuintement mou, comme de l’eau qui bout = trop de morceaux ou aliment mouillé — retirer la moitié.', '👁 De la vapeur blanche abondante = ça bout ; une fumée fine et grise = ça dore. Une fumée noire = trop chaud, retirer du feu 20 s.', '👃 L’odeur de grillé arrive avec la croûte ; l’odeur d’âcre, c’est déjà trop.'],
      fin: 'Chaque face dorée à brune de façon uniforme, des sucs bruns (pas noirs) au fond de la poêle, l’aliment réservé à plat.',
      erreurs: ['✗ Ça bout au lieu de dorer → retirer la moitié des morceaux, laisser l’eau s’évaporer (le son change), reprendre.', '✗ Ça accroche et se déchire → c’était trop tôt : attendre encore 1 min, la croûte se décolle seule.', '✗ Fond de poêle noir → il donnera de l’amertume à la sauce : essuyer la poêle entre deux lots plutôt que de garder ces sucs.'] },

    alliaces: { nom: 'Faire suer, puis colorer un oignon (et l’ail en 30 secondes)',
      pourquoi: 'Un oignon cru pique parce que ses composés soufrés sont intacts. La chaleur les transforme et libère ses sucres (un oignon contient 5 à 8 % de sucre). Deux résultats très différents selon le feu : à feu MOYEN, à couvert ou avec une pincée de sel, il rend son eau et devient translucide et doux sans colorer — on « fait suer ». À feu plus fort et plus longtemps, l’eau s’évapore, les sucres caramélisent (à partir de 110–160 °C) : il devient blond, puis brun et sucré. L’ail, lui, brûle en un clin d’œil : ses sucres passent à l’amer au-delà de 150 °C, en moins d’une minute.',
      pas: ['Poêle ou cocotte à feu moyen, matière grasse chaude mais pas fumante.', 'Ajouter l’oignon émincé ou ciselé, une pincée de sel (le sel tire l’eau et empêche de colorer trop vite). Remuer pour enrober.', 'SUER (base d’un plat) : 5 à 8 min, en remuant toutes les minutes. Il devient translucide, souple, sans couleur. Arrêter là si la fiche dit « revenir » ou « faire suer ».', 'COLORER : continuer 10 à 15 min de plus à feu moyen ; il blondit puis brunit par les bords. Si le fond accroche et brunit, verser 2 c. à s. d’eau et gratter : les sucs repartent dans l’oignon (« déglacer »).', 'AIL : l’ajouter quand l’oignon est déjà cuit, 30 à 60 s en remuant sans arrêt, jusqu’à l’odeur — puis mouiller ou ajouter l’aliment suivant AUSSITÔT. Jamais l’ail seul dans une poêle vide et brûlante.'],
      chiffres: ['🌡 Suer : feu moyen, poêle vers 120–140 °C. Colorer : feu moyen-vif, 150–170 °C.', '⏱ Translucide 5–8 min · blond 12–15 min · brun 30–45 min (oignons confits). Ail : 30–60 s.', '🧂 Une pincée de sel (1 g) pour 300 g d’oignon au départ.'],
      sens: ['👁 Translucide = on voit la planche à travers une lamelle ; c’est le point « sué ». Bords dorés = « blond ». Brun uniforme et volume réduit de moitié = « caramélisé ».', '👃 L’odeur passe de piquante (cru) à douce (sué) à sucrée (caramélisé). L’ail sent bon 30 s, puis sent le brûlé : c’est ce basculement qu’il faut devancer.', '👂 Un oignon qui sue fait un bruit doux et mouillé ; qui colore, un grésillement sec.'],
      fin: 'Oignon souple, translucide (ou doré si demandé), sans morceau noir ; ail parfumé, pâle, jamais brun.',
      erreurs: ['✗ Oignon qui brûle par endroits → feu trop vif ou poêle trop vide : baisser, verser 2 c. à s. d’eau, remuer.', '✗ Ail brun → il est amer et le restera : le retirer et recommencer avec de l’ail neuf. 30 secondes, pas plus.', '✗ Oignon qui ne colore pas après 20 min → trop d’oignons pour la poêle (il bout dans sa vapeur) : retirer le sel, monter le feu, ou faire en deux fois.'] },

    racines: { nom: 'Faire revenir carottes, céleri, poivron : la base aromatique',
      pourquoi: 'Faire revenir des légumes durs avant de mouiller sert à deux choses : leurs sucres commencent à caraméliser sur les bords (le goût de fond d’un bourguignon ou d’un chili), et leur structure s’assouplit (la pectine qui tient les cellules commence à céder vers 80–85 °C). Ils ne cuisent pas à cœur ici — c’est le mijotage qui le fera — mais ils prennent le goût qu’un légume simplement bouilli n’aura jamais.',
      pas: ['Dans la matière grasse chaude (ou les sucs de la viande qu’on vient de dorer), feu moyen-vif.', 'Ajouter les légumes taillés régulièrement, une pincée de sel. Étaler en une couche.', 'Laisser 2 min sans remuer, puis remuer toutes les 1 à 2 min. 6 à 10 min au total.', 'Les bords dorent, le volume baisse, la carotte s’assouplit sans plier. C’est prêt à mouiller.'],
      chiffres: ['🌡 Feu moyen-vif, 150–170 °C dans la poêle.', '⏱ Carotte en rondelles de 5 mm : 6–8 min · poivron en lanières : 5–7 min · céleri : 5–6 min.'],
      sens: ['👁 Bords légèrement bruns, centre encore cru et orange vif pour la carotte.', '👂 Grésillement régulier ; s’il devient mou, c’est que les légumes ont rendu leur eau — monter le feu 1 min.', '🖐 À la pince, la carotte cède un peu mais ne plie pas.'],
      fin: 'Légumes assouplis, dorés sur les bords, encore fermes au cœur, prêts à recevoir le liquide.',
      erreurs: ['✗ Légumes qui brûlent au fond → 3 c. à s. d’eau, gratter, baisser le feu.', '✗ Légumes qui bouillent dans leur jus → trop de volume pour la poêle : en retirer la moitié ou monter le feu et cesser de remuer 2 min.'] },
    legumes_fruits: { nom: 'Poêler poivron, courgette, tomate : vite et chaud',
      pourquoi: 'Ces légumes sont pleins d’eau. À feu doux, ils la rendent et cuisent en bouillie ; à feu vif, la surface dore avant que l’intérieur ne se défasse. La tomate, elle, ne dore pas : elle s’effondre et concentre — c’est ce qu’on veut pour une farce ou une sauce.',
      pas: ['Poêle très chaude, huile à peine fumante, feu vif.', 'Légumes en une seule couche, ne pas saler tout de suite (le sel tire l’eau).', 'Sans remuer 2 min, puis remuer par secousses. 5 à 7 min pour poivron et courgette.', 'Tomate en dés : ajouter en dernier, 3–4 min, elle rend son jus et le jus réduit. Saler à la fin.'],
      chiffres: ['🌡 Feu vif, 180 °C dans la poêle.', '⏱ Poivron 5–7 min · courgette 4–6 min · tomate 3–4 min.'],
      sens: ['👁 Taches dorées sur le poivron, tranches de courgette marquées et encore fermes, tomate défaite et brillante.', '👂 Grésillement fort ; dès qu’il faiblit, c’est l’eau qui sort — ne pas couvrir, monter le feu.'],
      fin: 'Légumes colorés et encore un peu croquants (poivron, courgette) ; tomate réduite en compotée sans eau libre.',
      erreurs: ['✗ Courgette molle et grise → cuite trop longtemps à feu doux : rien à rattraper, la mettre en soupe. Prochain lot à feu vif, 5 min.'] },

    legumes_verts: { nom: 'Sauter brocoli, épinards, haricots verts : chaud et court',
      pourquoi: 'Le vert des légumes vient de la chlorophylle, qui se dégrade avec la chaleur prolongée et l’acidité : au-delà de 6–7 minutes de cuisson, elle vire au vert olive terne. Un sauté vif de 2 à 4 minutes garde la couleur ET le croquant. L’épinard est un cas à part : 90 % d’eau, il fond à 1/10 de son volume en une minute — 500 g crus donnent une tasse cuite.',
      pas: ['Légumes ESSORÉS (de l’eau sur les feuilles = poêle qui refroidit et légumes bouillis).', 'Poêle ou wok très chaud, huile, feu vif. BROCOLI en fleurettes : 3–4 min en remuant, puis 2 c. à s. d’eau et couvercle 1 min (la vapeur finit le cœur). HARICOTS VERTS déjà blanchis : 2–3 min.', 'ÉPINARDS : par poignées, retourner à la pince dès que le dessous tombe, 1 à 2 min. Égoutter dans une passoire en pressant : ils rendent beaucoup d’eau.', 'Sel, ail ou citron À LA FIN — l’acide au début ternit le vert.'],
      chiffres: ['🌡 Feu vif, 180 °C dans la poêle.', '⏱ Brocoli 3–4 min + 1 min couvert · épinards 1–2 min · haricots 2–3 min.', '📉 Épinards : 500 g crus → ~80 g cuits égouttés.'],
      sens: ['👁 Vert VIF, brillant. Dès que la couleur ternit, c’est trop tard.', '🖐 Brocoli : la pointe du couteau entre dans la tige avec une légère résistance — pas mou.'],
      fin: 'Légumes vert vif, croquants sous la dent, sans eau au fond de la poêle ; épinards bien pressés.',
      erreurs: ['✗ Vert olive → trop cuit ; rien à rattraper, servir quand même ou mettre en soupe. Prochain lot : 2 min de moins.', '✗ Épinards qui baignent → les presser dans une passoire avec le dos d’une cuillère, puis 1 min à feu vif pour sécher.'] },

    volaille: { nom: 'Dorer le poulet, la dinde : croûte dehors, 74 °C dedans',
      pourquoi: 'Le blanc de volaille est un muscle maigre : ses protéines se resserrent en cuisant et expulsent l’eau. Dès 70 °C à cœur il est cuit et juteux ; à 80 °C il est sec et filandreux. Toute la difficulté est là : une croûte dorée (surface > 150 °C) et un cœur qui s’arrête à 74 °C. On y arrive avec des morceaux de taille égale, une poêle chaude, et une SONDE — pas en coupant pour regarder, ce qui fait perdre le jus.',
      pas: ['Sécher les morceaux au papier, saler des deux côtés.', 'Poêle chaude, huile à peine fumante, feu moyen-vif. Poser sans que les morceaux se touchent. En deux fois s’il le faut.', 'Ne pas toucher 3–4 min : la face se dore et se décolle seule. Retourner.', 'Cubes de 3 cm : 8–10 min au total, en retournant sur toutes les faces. Lanières de 1 cm : 4–5 min. Blanc entier : 5–6 min par face, puis feu doux à couvert 5 min.', 'Sonde au centre du morceau le plus gros : 74 °C. Retirer, reposer 3 min à plat.'],
      chiffres: ['🌡 À cœur : 74 °C (livré). La sonde monte encore de 2–3 °C hors du feu.', '⏱ Cubes 3 cm : 8–10 min · lanières : 4–5 min · blanc entier 150 g : 12–15 min.', '📏 Un blanc entier trop épais (> 3 cm) : l’ouvrir en deux dans l’épaisseur, ou l’aplatir à 2 cm.'],
      sens: ['👁 Dorée uniforme ; la chair sur les côtés passe du rosé translucide au blanc opaque en montant.', '🖐 Sous le doigt, une chair cuite est ferme et rebondit ; crue, elle est molle ; trop cuite, elle est dure.', '👃 Odeur de rôti, pas de brûlé.'],
      fin: 'Toutes les faces dorées, 74 °C à la sonde, jus clair à la pointe (pas rosé), morceaux réservés à plat.',
      erreurs: ['✗ Dorée dehors, rose dedans → baisser le feu, couvrir 3–4 min : la vapeur finit le cœur sans brûler la croûte.', '✗ Blanc sec → cuit au-delà de 80 °C. Le trancher fin et le napper de sauce ; prochain lot avec la sonde, retirer à 72 °C.'] },

    plat: { nom: 'Cuire des boulettes ou des galettes : toutes les faces, à cœur',
      pourquoi: 'Une boulette est de la viande (ou des légumineuses) hachée : sa surface dore par Maillard comme un steak, mais son cœur est une masse compacte que la chaleur traverse lentement. Une boulette de 4 cm demande 12 à 15 min. La viande hachée doit atteindre 70 °C à cœur (toute la surface, où vivent les bactéries, a été mélangée dedans). Une galette de légumineuses ne pose pas ce problème mais s’effrite si on la retourne trop tôt : sa croûte est ce qui la tient.',
      pas: ['Poêle chaude, huile en film (2 c. à s. pour une grande poêle), feu moyen-vif.', 'Poser les boulettes sans qu’elles se touchent. Ne pas bouger 2–3 min.', 'Quand la face du dessous est dorée et se décolle, faire rouler d’un quart de tour à la cuillère. Répéter jusqu’à ce que toutes les faces soient dorées (8–10 min).', 'Baisser à feu moyen, couvrir 3–5 min : la vapeur finit le cœur. Sonde : 70 °C (viande), tiède à cœur (galette).', 'GALETTES : 4 min sans toucher, retourner UNE fois à la spatule large, 4 min. Pas plus de deux retournements.'],
      chiffres: ['🌡 Viande hachée : 70 °C à cœur (74 °C pour la volaille hachée). Feu moyen-vif puis moyen.', '⏱ Boulettes 4 cm : 12–15 min · galettes 1,5 cm : 8 min.', '📏 Boulettes de 40–45 g (une cuillère à glace rase) : même taille, même cuisson.'],
      sens: ['👁 Brun doré sur toutes les faces ; les boulettes deviennent fermes et se raidissent en cuisant.', '🖐 Une boulette cuite est ferme et rebondit sous la pince ; molle, elle est crue au centre.', '👂 Grésillement franc ; s’il devient mouillé, elles rendent leur jus : monter le feu, retirer le couvercle.'],
      fin: 'Boulettes dorées partout, 70 °C à cœur, sans jus rose ; galettes croustillantes et entières.',
      erreurs: ['✗ Boulettes qui s’ouvrent → farce trop molle ou retournées trop tôt : finir celles-là à couvert, et serrer la farce du lot suivant (plus de chapelure, 15 min au frais).', '✗ Galettes qui s’effritent → attendre que la croûte se forme (4 min), spatule large, un seul retournement.'] },

    viande: { nom: 'Dorer les cubes de bœuf, saisir la viande hachée',
      pourquoi: 'Dorer la viande d’un braisé ne sert pas à « enfermer les jus » (c’est un mythe) : ça sert à fabriquer les arômes de Maillard qui feront le goût de la sauce — les sucs bruns au fond de la cocotte en sont la preuve. Une viande mouillée ou entassée bout et devient grise : pas de croûte, pas d’arômes, une sauce plate. La viande hachée a une surface immense pour son poids : elle rend beaucoup d’eau d’un coup, qu’il faut laisser s’évaporer AVANT que la coloration commence.',
      pas: ['CUBES : secs au papier, salés 10 min avant. Cocotte à feu vif, huile à peine fumante.', 'Poser les cubes un par un avec 1–2 cm d’espace : en 3 ou 4 lots pour 1,5 kg. Jamais tout d’un coup.', 'Ne pas toucher 2 min. Retourner à la pince, 1,5 min par face suivante, 2 ou 3 faces. Réserver dans un plat, lot suivant.', 'Si le fond devient noir entre deux lots : essuyer au papier, remettre de l’huile. Les sucs BRUNS se gardent, les sucs NOIRS s’enlèvent.', 'HACHÉ : feu vif, en couche, casser en morceaux de 3 cm. Ne pas remuer 2–3 min : l’eau sort et s’évapore (chuintement), puis ça grésille — la coloration commence. Casser plus fin, remuer, 5–6 min de plus jusqu’à brun partout. Plus de 500 g : en deux fois.'],
      chiffres: ['🌡 Feu vif, 180–200 °C dans la cocotte. Haché : 70 °C à cœur.', '⏱ Cubes : 5–6 min par lot · haché 500 g : 8–10 min.', '📉 Un lot de cubes ne doit pas couvrir plus de la moitié du fond.'],
      sens: ['👂 Le son dit tout : grésillement sec et vif = ça dore ; chuintement mouillé = ça bout, il y a trop de viande.', '👁 Croûte brune, pas grise. Des sucs bruns collés au fond, qu’une goutte d’eau ferait mousser.', '👃 Rôti et noisette. Âcre = trop chaud.'],
      fin: 'Cubes bruns sur au moins trois faces, réservés ; fond de cocotte tapissé de sucs bruns, prêts à être déglacés par les légumes ou le vin.',
      erreurs: ['✗ Viande grise qui bout → trop de cubes : les retirer, laisser le liquide s’évaporer, reprendre par petits lots.', '✗ Fond noir → essuyer avant de continuer, sinon toute la sauce sera amère.'] },

    poisson: { nom: 'Poêler un filet de poisson, saisir un steak de thon',
      pourquoi: 'La chair de poisson est faite de fibres courtes tenues par très peu de collagène : elle est cuite dès 50–55 °C, où elle devient opaque et se sépare en feuillets. À 65 °C elle est sèche. Un poisson livré doit atteindre 63 °C : c’est une fenêtre de quelques degrés. La peau, elle, adore la chaleur : posée côté peau, elle protège la chair et devient croustillante. Le thon est l’exception : très maigre et dense, il devient sec et gris au-delà de 55 °C — on le saisit très fort, très peu de temps.',
      pas: ['Sécher le filet au papier, des deux côtés — la peau surtout. Saler 5 min avant, resécher.', 'Poêle chaude, huile à peine fumante, feu moyen-vif. Poser CÔTÉ PEAU dessous (ou le côté le plus plat), en s’éloignant de soi. Appuyer 10 s avec une spatule pour que la peau ne se rétracte pas.', 'Cuire 70 % du temps sur cette face : la chair devient opaque en montant sur le côté du filet. 3–4 min pour 2 cm d’épaisseur.', 'Retourner UNE fois, 1–2 min. Sonde au plus épais : 63 °C. Retirer.', 'THON (steak 2–3 cm) : poêle brûlante, 45–60 s par face, saler après. Cœur rosé à 50–55 °C. Pour un plat livré et réchauffé, viser 60 °C — au-delà il sera sec, et le dire dans la fiche.'],
      chiffres: ['🌡 Poisson livré : 63 °C à cœur. Opaque dès 55 °C, sec à 65 °C. Thon : 50–60 °C selon la fiche.', '⏱ Filet 2 cm : 3–4 min côté peau + 1–2 min · thon : 45–60 s par face.'],
      sens: ['👁 La ligne opaque monte sur le côté du filet : on retourne quand elle a dépassé la moitié. Les feuillets se séparent sous une légère pression du doigt = cuit.', '🖐 Chair qui rebondit un peu = cuite ; qui s’écrase = crue ; qui se défait en fibres sèches = trop.', '👂 Grésillement franc côté peau ; il ne doit jamais devenir un chuintement.'],
      fin: 'Peau croustillante et dorée, chair opaque qui se sépare en feuillets, 63 °C à cœur, filet entier.',
      erreurs: ['✗ Peau qui colle → retournée trop tôt : attendre, elle se décolle seule une fois croustillante.', '✗ Filet qui se casse → trop manipulé : une seule spatule large, un seul retournement.', '✗ Chair sèche → cuite trop longtemps : napper de sauce, trancher fin. Prochain filet avec la sonde.'] },

    tofu: { nom: 'Dorer le tofu : une croûte qui tient',
      pourquoi: 'Le tofu ne contient ni sucre ni gras : sa croûte vient de la déshydratation de la surface et du peu de protéines qui brunissent — c’est plus lent qu’une viande, et ça n’arrive que si la surface est SÈCHE (voir « presser »). Un tofu qui colle, c’est un tofu humide dans une poêle pas assez chaude.',
      pas: ['Cubes pressés et secs, éventuellement roulés dans la fécule.', 'Poêle antiadhésive ou bien culottée, huile neutre en film généreux (3 c. à s. pour 400 g), feu moyen-vif.', 'Poser les cubes espacés. NE PAS TOUCHER 3–4 min : ils se décollent seuls quand la croûte est là.', 'Retourner face par face, 2–3 min chacune (4 faces suffisent). Saler ou saucer À LA FIN, hors du feu — la sauce soja brûle.'],
      chiffres: ['🌡 Feu moyen-vif, 170–180 °C.', '⏱ 10–12 min au total pour des cubes de 2,5 cm.'],
      sens: ['👁 Croûte dorée, mate, un peu fripée. Les faces non dorées restent blanches et molles.', '👂 Grésillement sec. Un chuintement = tofu mal pressé : laisser sécher sans remuer.'],
      fin: 'Cubes dorés sur quatre faces, fermes et croustillants dehors, tendres dedans.',
      erreurs: ['✗ Tofu qui colle et se déchire → ne pas insister ; attendre 1 min de plus, il se décolle. Sinon, plus d’huile et plus chaud au lot suivant.', '✗ Sauce soja versée dans la poêle brûlante → elle noircit et amertume : la mettre hors du feu, poêle retirée.'] },

    legumineuses: { nom: 'Poêler des pois chiches, des haricots : croustillants dehors',
      pourquoi: 'Une légumineuse cuite (ou en boîte) est pleine d’eau. À la poêle, sa peau sèche et devient croustillante seulement si elle est déjà sèche au départ et si le feu est vif. Le sel et les épices s’ajoutent EN FIN : les épices brûlent en quelques secondes dans une poêle très chaude.',
      pas: ['Rincer la boîte à l’eau froide (le liquide est visqueux et salé), égoutter, puis étaler sur un torchon 10 min : ils doivent être SECS.', 'Poêle chaude, huile, feu vif. Étaler en une couche.', 'Laisser 2 min sans remuer, puis secouer la poêle toutes les minutes, 8 à 10 min : ils dorent et croustillent.', 'Hors du feu : épices, sel, jus de citron.'],
      chiffres: ['🌡 Feu vif, 180 °C.', '⏱ 8–10 min pour 400 g de pois chiches égouttés.'],
      sens: ['👁 Peau dorée et un peu craquelée ; certains éclatent — normal.', '👂 Grésillement sec ; s’ils chuintent, ils étaient mouillés : continuer sans couvrir.'],
      fin: 'Pois chiches dorés, croustillants dehors, fondants dedans, épicés hors du feu.',
      erreurs: ['✗ Mous et pâles → poêle trop chargée ou pois mouillés : en deux fois, bien secs.'] },

    champignons: { nom: 'Sauter des champignons : les faire dorer, pas bouillir',
      pourquoi: 'Le champignon est une éponge d’eau. Dans une poêle chargée ou tiède, il rend son eau et cuit dedans : gris, mou, caoutchouteux. Dans une poêle très chaude et peu remplie, l’eau s’évapore aussitôt et la surface dore. Le sel ajouté au début tire l’eau : on sale À LA FIN.',
      pas: ['Poêle très chaude, huile (ou moitié huile moitié beurre), feu vif.', 'Champignons en une seule couche, avec de l’espace. En deux fois plutôt qu’en tas.', 'Ne pas remuer 2–3 min : ils dorent dessous. Puis secouer, 3–4 min de plus.', 'Sel, poivre, ail ou persil en toute fin.'],
      chiffres: ['🌡 Feu vif, 180–200 °C.', '⏱ 5–7 min par lot ; 📉 ils perdent la moitié de leur volume.'],
      sens: ['👁 Dorés, brillants, réduits. S’il y a une flaque, ils bouillent : monter le feu, ne plus remuer.', '👃 Odeur de noisette et de sous-bois quand ils dorent.'],
      fin: 'Champignons dorés, réduits, sans liquide au fond de la poêle.',
      erreurs: ['✗ Champignons qui baignent → verser le jus (le garder pour la sauce), remonter le feu, laisser dorer.'] },

    fruits_secs: { nom: 'Torréfier pignons, amandes : à feu doux, sans les quitter',
      pourquoi: 'Un fruit sec est riche en huile : il grille de l’intérieur et continue de cuire une fois hors de la poêle (l’huile chaude reste dedans). Il passe de blond à brûlé en 20 secondes. On torréfie donc à feu DOUX, en remuant sans arrêt, et on le sort AVANT la couleur voulue.',
      pas: ['Poêle SÈCHE (sans matière grasse), feu doux à moyen.', 'Fruits secs en une couche. Remuer sans arrêt en secouant la poêle, 2 à 4 min.', 'Dès qu’ils sont blond clair et qu’ils sentent le grillé, les verser AUSSITÔT dans une assiette froide. Ils finiront de dorer tout seuls.'],
      chiffres: ['🌡 Feu doux-moyen, 140–160 °C.', '⏱ Pignons 2–3 min · amandes effilées 2–3 min · amandes entières 5–6 min.'],
      sens: ['👃 Le parfum de grillé apparaît juste avant la couleur : c’est le signal de sortir.', '👁 Blond clair dans la poêle = doré dans l’assiette.'],
      fin: 'Dorés régulièrement, croquants, aucun brûlé, refroidis à plat.',
      erreurs: ['✗ Quelques-uns brûlés → les retirer un par un (ils rendraient tout amer).', '✗ Laissés dans la poêle hors du feu → ils continuent de cuire et brûlent : toujours transvaser.'] },

    pain: { nom: 'Réchauffer tortillas, pitas : poêle sèche, quelques secondes',
      pourquoi: 'Une tortilla est une galette cuite : la réchauffer sert à réhydrater l’amidon (souple) et à marquer la surface (goût). À sec, à feu vif, 20–30 s par face suffisent ; plus, elle sèche et casse au pliage. La vapeur qu’elle dégage doit rester : on les empile sous un torchon.',
      pas: ['Poêle sèche, feu vif, 1 min de préchauffage.', 'Une tortilla à la fois : 20–30 s, elle fait des cloques et des taches brunes. Retourner à la main ou à la pince, 20 s.', 'L’empiler aussitôt dans un torchon plié : la vapeur les garde souples.'],
      chiffres: ['🌡 Feu vif, poêle 200 °C.', '⏱ 20–30 s par face.'],
      sens: ['👁 Cloques, taches brunes, la tortilla se soulève.', '🖐 Souple, se plie sans casser.'],
      fin: 'Tortillas marquées, souples, chaudes, sous le torchon jusqu’au dressage.',
      erreurs: ['✗ Tortilla raide qui casse → trop cuite : 10 s au-dessus de la vapeur d’une casserole la rend souple.'] },

    graines: { nom: 'Faire revenir quinoa ou boulgour à sec : le toaster',
      pourquoi: 'Toaster une graine avant de la mouiller développe des arômes de noisette (Maillard sur l’amidon et les protéines de surface) et rend le grain moins collant. Deux minutes suffisent ; au-delà, elle brûle.',
      pas: ['Graine rincée et ÉGOUTTÉE à fond (ou sèche). Cocotte à feu moyen, un filet d’huile.', 'Remuer sans arrêt 2–3 min : ça sent la noisette, les grains crépitent et deviennent mats.', 'Mouiller aussitôt avec le liquide chaud, en respectant le ratio du grain (voir « bouillir »).'],
      chiffres: ['🌡 Feu moyen, 150 °C.', '⏱ 2–3 min.'],
      sens: ['👃 Noisette = prêt. Brûlé = trop tard.', '👂 Les grains crépitent quand l’humidité de surface est partie.'],
      fin: 'Grains mats, parfumés, mouillés dans la foulée.',
      erreurs: ['✗ Grains bruns → amers : recommencer.'] }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     BOUILLIR — l'eau, le sel, l'amidon, la chlorophylle
     ═══════════════════════════════════════════════════════════════════════ */
  SAVOIR.bouillir = {
    _: { nom: 'Cuire dans l’eau ou à la vapeur',
      pourquoi: 'L’eau ne dépasse jamais 100 °C : c’est une cuisson douce et régulière, sans coloration. Le sel dans l’eau passe DANS l’aliment pendant la cuisson ; salé après, il reste en surface. À la vapeur, l’aliment cuit à 100 °C aussi, mais sans perdre ses sels minéraux dans l’eau.',
      pas: ['Grande casserole, beaucoup d’eau : au moins 5 fois le volume de l’aliment. Peu d’eau = la température s’effondre quand on plonge l’aliment, et la cuisson repart mal.', 'Saler 10 g par litre (une cuillère à soupe rase). Porter à gros bouillons.', 'Plonger l’aliment, remuer une fois, laisser reprendre l’ébullition, puis compter le temps À PARTIR de la reprise.', 'Égoutter dès que c’est cuit ; étaler à plat pour arrêter la cuisson, ou plonger dans l’eau glacée si la fiche le demande.'],
      chiffres: ['🧂 10 g de sel par litre — l’eau doit avoir le goût d’un bouillon léger.', '💧 Au moins 5 litres pour 1 kg.', '🌡 Gros bouillons = 100 °C ; frémissement = 85–95 °C ; vapeur = 100 °C sous couvercle.'],
      sens: ['👁 Gros bouillons : grosses bulles qui crèvent en surface sans arrêt. Frémissement : quelques petites bulles qui montent, la surface bouge à peine.', '👂 Une eau qui bout fort gronde ; qui frémit, chuchote.'],
      fin: 'Aliment cuit au point demandé, égoutté aussitôt, refroidi ou dressé sans attendre.',
      erreurs: ['✗ Eau qui déborde → une cuillère en bois posée en travers, ou baisser le feu d’un cran une fois l’ébullition reprise.', '✗ Eau pas salée → saler l’aliment à chaud dès l’égouttage, il absorbe encore un peu.'] },

    riz: { nom: 'Cuire le riz : basmati, complet, sauvage, arborio — chacun sa méthode',
      pourquoi: 'Un grain de riz est de l’amidon compact. Dans l’eau chaude, à partir de 60–70 °C, cet amidon absorbe l’eau et gonfle : c’est la gélatinisation. Le riz blanc est enrobé d’amidon libre (la « poussière » du polissage) qui colle les grains entre eux : on le RINCE. Le riz complet garde son enveloppe (le son), imperméable : il faut deux fois plus d’eau et de temps. Le riz arborio, lui, a un amidon particulier qu’on veut justement libérer pour la crème du risotto : on ne le rince JAMAIS. Le repos hors du feu, couvert, est une vraie étape : la vapeur finit d’humidifier le cœur du grain.',
      pas: ['BASMATI (ou riz blanc long) : dans un bol, couvrir d’eau froide, frotter à la main, vider l’eau blanche ; 3 à 4 fois, jusqu’à ce que l’eau reste claire. Égoutter. Casserole : 1 volume de riz, 1,5 volume d’eau froide, sel (3 g par 250 g de riz). Porter à ébullition SANS couvercle, puis couvercle, feu au minimum, 10–12 min. Couper le feu, couvercle fermé, 10 min de repos. Égrener à la fourchette.', 'RIZ COMPLET : rincer une fois. 1 volume de riz, 2 volumes d’eau, sel. Ébullition, couvercle, feu minimum, 35–45 min. Repos 10 min. Autre méthode plus sûre : comme des pâtes, dans un grand volume d’eau salée, 30–35 min, égoutter.', 'RIZ SAUVAGE : 1 volume de riz, 3 volumes d’eau salée. Ébullition, couvercle entrouvert, feu doux, 45–55 min : les grains éclatent et montrent leur intérieur clair. Égoutter le surplus.', 'ARBORIO (risotto) : ne pas rincer — voir « mijoter · risotto ».', 'Pour tous : NE PAS SOULEVER LE COUVERCLE pendant la cuisson à l’absorption. La vapeur qui s’échappe est de l’eau qui manquera au riz.'],
      chiffres: ['💧 Basmati 1 : 1,5 · complet 1 : 2 · sauvage 1 : 3 · en volume.', '⏱ Basmati 10–12 min + 10 repos · complet 35–45 + 10 · sauvage 45–55.', '🌡 Gélatinisation de l’amidon : 60–75 °C. Feu au minimum une fois couvert : l’eau doit frémir, pas bouillir.', '📉 Le riz absorbe : 100 g de basmati cru donnent 250–300 g cuit.'],
      sens: ['👁 Basmati cuit : grains détachés, allongés, mats, sans eau au fond. Des cratères en surface à la fin de la cuisson = l’eau est absorbée, on peut couper le feu.', '🖐 Un grain pressé entre deux doigts s’écrase sans cœur dur.', '👂 Quand le crépitement remplace le bouillonnement sous le couvercle, l’eau est partie : couper le feu tout de suite ou ça attache.'],
      fin: 'Grains cuits à cœur, détachés (basmati, sauvage) ou tendres avec de la mâche (complet), égrenés, étalés à plat sur une plaque pour refroidir vite.',
      erreurs: ['✗ Riz collant et pâteux → pas rincé ou trop d’eau : le rincer à l’eau chaude dans une passoire, égoutter, étaler. Prochain lot, rincer jusqu’à l’eau claire.', '✗ Riz cuit dessus, dur dessous → couvercle soulevé ou feu trop fort : ajouter 3 c. à s. d’eau bouillante, couvrir, 5 min feu minimum.', '✗ Riz attaché au fond → ne pas gratter : les grains du dessus sont bons, le fond se jette. Prochain lot, feu plus bas ou repos plus tôt.'] },

    graines: { nom: 'Cuire quinoa, millet, boulgour : rincer, mouiller juste, reposer',
      pourquoi: 'Le quinoa est enrobé de saponine, une substance amère et savonneuse : sans rinçage, il est amer. Son germe se détache en spirale quand il est cuit — c’est le signe visible. Le millet cuit comme un petit riz, avec un peu plus d’eau. Le boulgour est du blé déjà précuit et concassé : le gros se cuit, le fin s’hydrate simplement dans l’eau chaude. Tous ont besoin d’un repos couvert hors du feu pour finir d’absorber.',
      pas: ['QUINOA : dans une passoire fine, rincer à l’eau froide 30 s en remuant à la main — l’eau mousse (la saponine), puis ne mousse plus. 1 volume de quinoa, 2 volumes d’eau, sel. Ébullition, couvercle, feu minimum, 12–15 min. Hors du feu, couvert, 5 min. Égrener à la fourchette.', 'MILLET : rincer. Facultatif : 2 min à sec dans la casserole pour le toaster. 1 volume, 2,5 volumes d’eau, sel. Ébullition, couvercle, feu minimum, 15–18 min. Repos 10 min. Égrener.', 'BOULGOUR GROS : 1 volume, 2 volumes d’eau bouillante salée, couvercle, feu doux 12–15 min, repos 5. BOULGOUR FIN (taboulé) : dans un saladier, 1 volume, 1 volume d’eau bouillante, couvrir, 10 min, égrener.'],
      chiffres: ['💧 Quinoa 1 : 2 · millet 1 : 2,5 · boulgour gros 1 : 2 · fin 1 : 1.', '⏱ Quinoa 12–15 + 5 · millet 15–18 + 10 · boulgour 12–15 + 5.', '📉 100 g de quinoa cru → ~300 g cuit.'],
      sens: ['👁 Quinoa cuit : chaque grain montre un petit anneau blanc décollé (le germe), il est translucide. Eau absorbée, cratères en surface.', '🖐 Le grain cède sous la dent avec un léger « pop » ; pâteux = trop cuit ou trop d’eau.', '👃 Le quinoa cru rincé ne doit plus sentir l’herbe amère.'],
      fin: 'Grains détachés, égrenés, refroidis à plat pour une salade (sinon ils continuent de cuire et s’agglutinent).',
      erreurs: ['✗ Quinoa amer → pas assez rincé ; rien à rattraper dans le lot, saucer généreusement. Prochain lot : rincer jusqu’à ce qu’il ne mousse plus.', '✗ Grains encore durs à la fin → 3 c. à s. d’eau bouillante, couvercle, 5 min de plus.'] },

    racines: { nom: 'Cuire pommes de terre, patates douces : départ eau FROIDE',
      pourquoi: 'Une pomme de terre est dense : plongée dans l’eau bouillante, l’extérieur se défait avant que le cœur ne soit cuit. On la démarre dans l’eau FROIDE salée : elle chauffe à la même vitesse dedans et dehors. Son amidon gélatinise entre 58 et 66 °C et ses cellules se séparent vers 90 °C — c’est là qu’elle devient fondante. Écrasée chaude, elle fait une purée ; passée au mixeur, ses cellules éclatent, l’amidon se libère et la purée devient une colle élastique. La patate douce contient moins d’amidon et plus de sucre : elle cuit plus vite et supporte un peu mieux le mixeur, mais l’écrase-purée reste la règle.',
      pas: ['Cubes de 3 cm (ou pommes de terre entières de même taille) dans une casserole, couvrir d’eau FROIDE de 3 cm au-dessus, sel 10 g/l.', 'Porter à ébullition, puis baisser pour un bouillon modéré (à gros bouillons, elles s’entrechoquent et s’effritent).', 'Pommes de terre : 20–25 min pour des cubes de 3 cm, 25–35 min entières. Patates douces : 15–20 min.', 'Test : la pointe d’un couteau entre au centre sans résistance et le morceau glisse de la lame. Égoutter aussitôt, laisser 1 min dans la casserole vide sur le feu éteint pour sécher.', 'Pour un écrasé : écraser CHAUD, au presse-purée ou à la fourchette, avec la matière grasse ; détendre au lait ou au bouillon chaud. Jamais au mixeur plongeant.'],
      chiffres: ['🧂 10 g de sel par litre. 💧 Eau froide, 3 cm au-dessus.', '⏱ Cubes 3 cm : 20–25 min · entières : 25–35 · patate douce cubes : 15–20.', '🌡 Amidon : 58–66 °C. Fondant : ~90 °C à cœur.'],
      sens: ['🖐 Couteau qui entre sans effort et ressort sans emporter la chair = cuit. Résistance au centre = 5 min de plus.', '👁 Pommes de terre à peau qui se fend = trop bouillonnant ou trop cuit ; baisser le feu.'],
      fin: 'Cuites à cœur, entières ou en cubes qui tiennent, séchées 1 min avant d’être dressées ou écrasées.',
      erreurs: ['✗ Purée collante et élastique → passée au mixeur : rien à rattraper, elle devient une base de soupe. Prochain lot au presse-purée.', '✗ Extérieur défait, centre dur → départ eau chaude ou gros bouillons : finir à feu doux, et démarrer froid la prochaine fois.', '✗ Purée grumeleuse → écrasée froide : réchauffer et repasser au presse-purée avec un peu de lait chaud.'] },

    legumes_verts: { nom: 'Blanchir brocoli, haricots, asperges, kale : vert vif, eau glacée',
      pourquoi: 'La chlorophylle, qui fait le vert, est fragile : la chaleur et les acides transforment son atome de magnésium et la font virer au vert olive terne. Deux parades. Beaucoup d’eau salée à GROS bouillons, SANS couvercle : les acides naturels du légume s’échappent avec la vapeur au lieu de retomber dans l’eau. Et une cuisson COURTE, arrêtée net dans l’eau glacée : au-delà de 6–7 minutes, la couleur est perdue. Le sel de l’eau fixe aussi la couleur et assaisonne à cœur.',
      pas: ['Grande marmite, beaucoup d’eau (5 l pour 1 kg), 10 g de sel par litre. Gros bouillons.', 'Préparer à côté un bac d’eau avec des glaçons (moitié glace, moitié eau).', 'Plonger les légumes, ne PAS couvrir. Compter dès la reprise de l’ébullition : brocoli 3–4 min, haricots verts 5–7 min, asperges 3–5 min selon la grosseur, kale 2–3 min.', 'Test : la pointe du couteau entre dans la tige avec une légère résistance. Égoutter à l’écumoire et plonger AUSSITÔT dans l’eau glacée, 2 min.', 'Égoutter à fond, étaler sur un torchon. Ils se réchaufferont 1 min à la poêle ou au bouillon au moment du dressage.'],
      chiffres: ['💧 5 l d’eau par kg · 🧂 10 g/l · 🧊 bain glacé moitié glace.', '⏱ Brocoli 3–4 min · haricots 5–7 · asperges 3–5 · kale 2–3 · petits pois 1–2. Jamais au-delà de 7.', '🌡 100 °C sans couvercle.'],
      sens: ['👁 La couleur passe au vert VIF dans les 30 premières secondes : c’est le maximum, on ne le garde qu’en sortant à temps. Dès que ça tourne vers l’olive, c’est trop.', '🖐 Tige qui cède au couteau mais reste ferme ; on doit sentir une résistance sous la dent.'],
      fin: 'Légumes vert vif, tendres-croquants, refroidis, égouttés et secs — la couleur tiendra jusqu’au lendemain.',
      erreurs: ['✗ Vert olive → trop cuit ou couvert ; rien à rattraper. Prochain lot : chrono et bain glacé prêt AVANT de plonger les légumes.', '✗ Pas de bain glacé → étaler sur une plaque froide en une couche et ventiler : moins bien, mais ça arrête la cuisson.', '✗ Eau qui cesse de bouillir en plongeant le lot → trop de légumes pour l’eau : en deux fois.'] },

    poisson: { nom: 'Pocher un poisson au court-bouillon, à la vapeur',
      pourquoi: 'La chair de poisson est cuite dès 55 °C et sèche à 65 °C. Dans une eau à 100 °C, l’extérieur dépasse 80 °C avant que le cœur n’atteigne 60 : la chair se déchire et durcit. On poche donc dans un liquide à 80–85 °C — il FRÉMIT à peine, il ne bout jamais. Le court-bouillon (eau, sel, citron, herbes) parfume et sale la chair pendant les quelques minutes de cuisson.',
      pas: ['Court-bouillon : eau, 10 g de sel/l, rondelles de citron, thym, laurier, quelques grains de poivre. Porter à ébullition 5 min pour l’infuser, puis BAISSER jusqu’au frémissement.', 'Poser les filets dans le liquide chaud (ils doivent être couverts), feu doux : le liquide ne doit plus faire que quelques bulles.', '8 à 10 min pour un filet de 150 g et 2 cm d’épaisseur. Sonde : 63 °C au plus épais. À la vapeur : même durée, couvercle fermé, sur une eau qui bout franchement.', 'Sortir à l’écumoire large, poser sur un torchon pour égoutter.'],
      chiffres: ['🌡 Liquide à 80–85 °C (quelques bulles, jamais gros bouillons). Cœur : 63 °C.', '⏱ Filet 150 g / 2 cm : 8–10 min. Truite entière 300 g : 12–15 min.', '🧂 10 g de sel par litre.'],
      sens: ['👁 La chair passe du translucide à l’opaque ; les feuillets se séparent sous une pression légère. Une écume blanche en surface = protéines coagulées, normal ; la chair qui se déchire = ça bout.', '🖐 Ferme et rebondie ; qui s’effrite en séchant = trop cuit.'],
      fin: 'Filets entiers, opaques, 63 °C, égouttés sans se briser.',
      erreurs: ['✗ Liquide qui bout → chair déchirée et sèche : baisser tout de suite ; ce lot passera en effeuillé dans une salade ou une sauce.', '✗ Filet cru au centre à la sonde → 2 min de plus, feu doux.'] },

    volaille: { nom: 'Pocher ou cuire à la vapeur un filet de dinde, de poulet',
      pourquoi: 'Poché ou vapeur, le filet ne dore pas — pas de Maillard — mais il reste juteux si le liquide ne bout pas : ses fibres se resserrent avec la chaleur et, à 100 °C dehors, elles expulsent leur eau avant que le cœur soit cuit. On vise un liquide à 75–85 °C et un cœur à 74 °C, sonde obligatoire.',
      pas: ['Bouillon ou eau salée (10 g/l) avec herbes ; porter à ébullition puis baisser au frémissement.', 'Poser les filets (aplatis à 2 cm pour une cuisson régulière), couverts de liquide. Feu doux.', '15 à 20 min pour un filet de 150 g. Sonde : 74 °C. À la vapeur : 20–25 min, couvercle fermé.', 'Laisser reposer 5 min dans le liquide hors du feu si on ne sert pas tout de suite : il reste moelleux.'],
      chiffres: ['🌡 Liquide 75–85 °C ; cœur 74 °C.', '⏱ 15–20 min (poché) · 20–25 min (vapeur) pour 150 g / 2 cm.'],
      sens: ['👁 Chair blanche et opaque jusqu’au centre, jus clair.', '🖐 Ferme et rebondie sous le doigt.'],
      fin: '74 °C à la sonde, chair blanche, juteuse, tranchée après 5 min de repos.',
      erreurs: ['✗ Filet filandreux → liquide bouillant : baisser le feu ; ce lot s’effeuille pour une salade ou un wrap.'] },

    liquides: { nom: 'Chauffer ou monter un bouillon',
      pourquoi: 'Un bouillon qu’on utilise pour mouiller (risotto, soupe, mijoté) doit être CHAUD : versé froid sur des aliments chauds, il stoppe la cuisson, raidit les viandes et fait retomber la température de 20 minutes. Un bouillon qu’on FABRIQUE (os, parures) part à l’eau froide et ne bout jamais : à gros bouillons, les impuretés s’émulsionnent et le troublent.',
      pas: ['Bouillon à chauffer : casserole à côté du plat, feu doux, frémissant, une louche à portée de main.', 'Bouillon à fabriquer : parures et légumes dans l’eau FROIDE, porter lentement au frémissement, écumer la mousse grise, 30 min à 2 h sans jamais bouillir, filtrer.'],
      chiffres: ['🌡 À utiliser : 85–95 °C. À fabriquer : frémissement 85–90 °C.', '🧂 Ne saler un bouillon qu’à la fin : il réduit et se concentre.'],
      sens: ['👁 Frémissement = quelques bulles paresseuses. Mousse grise en surface = à écumer.'],
      fin: 'Bouillon chaud, clair, à côté du plat qu’il va mouiller.',
      erreurs: ['✗ Bouillon trouble → il a bouilli ; filtrer au chinois avec un linge, il restera un peu opaque.'] },

    legumineuses: { nom: 'Cuire des lentilles : corail, vertes, blondes',
      pourquoi: 'La lentille corail est décortiquée : elle cuit en 10–15 min et se DÉFAIT — parfaite pour une soupe ou un dhal, jamais pour une salade. La lentille verte ou blonde garde sa peau : 20–25 min, elle reste entière. L’acide (tomate, vinaigre, citron) DURCIT la peau des légumineuses : on l’ajoute en fin de cuisson, pas au début. Pas de trempage nécessaire pour les lentilles.',
      pas: ['Rincer à l’eau froide jusqu’à ce que l’eau soit claire (poussière, amidon). Retirer les petits cailloux éventuels.', 'CORAIL : 1 volume de lentilles, 3 volumes d’eau ou de bouillon, départ à froid, ébullition puis feu doux 10–15 min en remuant : elles se défont en purée. Sel en fin.', 'VERTES : 1 volume, 3 volumes d’eau froide, thym et laurier, ébullition puis frémissement 20–25 min. Sel à mi-cuisson. Égoutter. Elles doivent être tendres et entières.', 'Tout acide (tomate, citron, vinaigre) après la cuisson.'],
      chiffres: ['💧 1 : 3 en volume. ⏱ Corail 10–15 min · vertes 20–25.', '🌡 Frémissement 90 °C, pas gros bouillons (elles éclatent).'],
      sens: ['👁 Corail : la couleur passe de l’orange au jaune, la texture devient crémeuse. Vertes : entières, brillantes, un peu ridées.', '🖐 Une lentille verte cuite s’écrase entre deux doigts sans cœur farineux.'],
      fin: 'Corail en purée lisse ; vertes entières et tendres, égouttées, prêtes pour une salade ou un mijoté.',
      erreurs: ['✗ Lentilles vertes qui restent dures après 30 min → acide ajouté trop tôt ou eau très calcaire : continuer 10–15 min, avec une pincée de bicarbonate.', '✗ Lentilles vertes en bouillie → trop cuites : en faire une soupe ou une farce.'] },

    pates: { nom: 'Cuire des pâtes : beaucoup d’eau, salée, sans couvercle',
      pourquoi: 'Les pâtes libèrent de l’amidon dans l’eau ; dans peu d’eau il se concentre et les colle. Beaucoup d’eau, salée comme la mer, à gros bouillons, et on remue les deux premières minutes — le moment où elles collent. « Al dente » : un point blanc minuscule au centre, la pâte finit de cuire dans la sauce.',
      pas: ['5 litres d’eau pour 500 g, 50 g de sel (10 g/l). Gros bouillons, pas de couvercle, pas d’huile (elle empêche la sauce d’accrocher).', 'Plonger, remuer 30 s, puis toutes les minutes pendant 2 min.', 'Goûter 1 min avant le temps du paquet. Al dente : ferme sous la dent, point blanc au centre.', 'Garder une louche d’eau de cuisson (l’amidon lie la sauce). Égoutter sans rincer, sauf pour une salade froide.'],
      chiffres: ['💧 1 l par 100 g · 🧂 10 g/l · ⏱ temps du paquet moins 1 min.'],
      sens: ['👁 Point blanc au centre d’une pâte coupée = al dente.', '🖐 Résistance nette sous la dent, sans craquer.'],
      fin: 'Pâtes al dente, égouttées, eau de cuisson gardée, liées à la sauce dans la minute.',
      erreurs: ['✗ Pâtes collées → pas assez d’eau ou pas remuées : 30 s dans l’eau chaude en séparant à la fourchette.'] }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     MIJOTER — le collagène, le frémissement, la sauce qui nappe
     ═══════════════════════════════════════════════════════════════════════ */
  SAVOIR.mijoter = {
    _: { nom: 'Mijoter : le frémissement, jamais le bouillon',
      pourquoi: 'Mijoter, c’est tenir un plat entre 85 et 95 °C pendant longtemps. À cette température, les fibres d’une viande se détendent et son collagène fond en gélatine (ce qui rend une sauce brillante et « collante » aux lèvres) ; les légumes s’attendrissent sans se défaire ; les arômes se mélangent. À 100 °C à gros bouillons, l’inverse : la viande se raidit et sèche, les légumes éclatent, la sauce réduit trop vite et attache. La différence entre les deux est un cran de feu.',
      pas: ['Une fois mouillé, porter à ébullition UNE fois pour lancer, puis baisser immédiatement jusqu’au frémissement.', 'Couvercle : fermé si la fiche dit « couvert » (le liquide se garde), entrouvert pour réduire et épaissir.', 'Toutes les 20–30 min : remuer en grattant le fond (ça attache par le fond), vérifier le niveau de liquide, compléter avec du liquide CHAUD si nécessaire.', 'Dégraisser en cours de route : le gras monte, on le prélève à la cuillère.', 'Assaisonner en FIN : la réduction concentre le sel.'],
      chiffres: ['🌡 85–95 °C dans le liquide. Sur une plaque : feu minimum ; sur induction, la position qui donne une bulle toutes les 1–2 secondes. Au four : 140–150 °C, c’est plus régulier.', '⏱ Le temps dépend du morceau : voir les familles ci-dessous.', '💧 Le liquide doit couvrir à peine (« à hauteur »), pas noyer.'],
      sens: ['👁 Frémissement : une petite bulle qui crève toutes les 1–2 secondes, la surface tremble à peine. Des bulles partout = trop fort.', '👂 Le plat doit à peine chuchoter. Un gargouillement = trop fort.', '👃 L’odeur devient ronde et profonde après une heure ; une pointe de brûlé = ça attache, gratter le fond tout de suite.'],
      fin: 'Aliment fondant, sauce qui nappe la cuillère (un trait du doigt au dos de la cuillère reste net), assaisonnement rectifié.',
      erreurs: ['✗ Ça attache au fond → ne PAS gratter le brûlé : transvaser dans une cocotte propre en laissant le fond, continuer à feu plus doux.', '✗ Sauce trop liquide en fin → retirer la garniture, réduire la sauce seule à feu vif 5–10 min, remettre.', '✗ Sauce trop épaisse ou trop salée → allonger de bouillon ou d’eau chaude.'] },

    plat: { nom: 'Bourguignon, chili, curry, risotto, soupe : chacun son mijotage',
      pourquoi: 'BOURGUIGNON (braisé) : le collagène du gîte fond en gélatine à partir de 65 °C, mais lentement — à 90 °C il faut 2 h 30 pour un cube de 4–5 cm. Avant, la viande est dure ; après, elle se défait. Les champignons vont dedans 30 min avant la fin, sinon ils deviennent spongieux. CHILI : les épices (cumin, paprika) libèrent leurs arômes dans le GRAS chaud, pas dans l’eau — on les fait revenir 30–60 s avant de mouiller. Les haricots en boîte s’ajoutent 15 min avant la fin. CURRY au lait de coco : le lait de coco « tranche » (le gras se sépare en grumeaux) s’il bout fort. La pâte de curry se frit d’abord dans la partie épaisse du lait de coco jusqu’à ce que l’huile perle. RISOTTO : c’est l’amidon du riz arborio, libéré par le remuage et le bouillon ajouté louche par louche, qui fait la crème. Sans remuer et avec tout le bouillon d’un coup, c’est un riz collant. SOUPE : les légumes suent d’abord dans le gras (goût), puis mouillés, 20–25 min, mixés.',
      pas: ['BOURGUIGNON : après avoir doré viande et légumes et singé (farine), mouiller à hauteur avec le vin et le bouillon CHAUDS, thym, laurier. Ébullition puis frémissement, couvert, 2 h 30. À 2 h, champignons. Test : la fourchette entre dans un cube sans forcer et il se sépare sous une pression légère. Dégraisser, saler.', 'CHILI : viande hachée dorée, oignons et poivron revenus, épices 30–60 s dans le gras en remuant, puis tomates et bouillon. Frémissement, entrouvert, 45–60 min. Haricots rincés à 15 min de la fin. Il doit être épais : une cuillère plantée tient debout.', 'CURRY : chauffer les 3 c. à s. de crème épaisse du dessus de la boîte de lait de coco, y frire la pâte de curry 2–3 min jusqu’à ce que l’huile rouge perle en surface et que ça sente fort. Ajouter les protéines, enrober, puis le reste du lait de coco et les légumes durs. Frémissement DOUX (jamais gros bouillons), 20–25 min ; légumes tendres 8 min avant la fin. Citron/sucre/sel en fin.', 'RISOTTO : bouillon frémissant à côté. Oignon sué dans le beurre, riz arborio NON rincé toasté 2 min (grains nacrés, bords translucides), déglacer au vin, laisser absorber. Puis une louche de bouillon à la fois, en remuant souvent, la suivante quand la précédente est absorbée. 16–18 min. Al dente. Hors du feu : beurre froid et parmesan, remuer vivement, couvrir 2 min. Il doit faire une vague quand on incline la casserole.', 'SOUPE : oignon et légumes sués 5 min dans l’huile, mouiller à hauteur avec du bouillon chaud, frémissement 20–25 min jusqu’à ce que le légume le plus dur s’écrase. Mixer (voir « mixer »).'],
      chiffres: ['🌡 Tous à 85–95 °C. Lait de coco : ne jamais dépasser le frémissement. Braisé au four : 150 °C.', '⏱ Bourguignon 2 h 30 (cubes 4–5 cm) · chili 45–60 min · curry 20–25 min · risotto 16–18 min · soupe 20–25 min.', '💧 Bouillon du risotto : 3 volumes pour 1 de riz, chaud. Braisé : liquide à hauteur.', '🧂 Chili et bourguignon : sel en fin — ils réduisent.'],
      sens: ['👁 Bourguignon prêt : la sauce est brune, brillante, nappante ; un cube se déchire à la fourchette. Chili prêt : épais, plus d’eau libre en surface. Curry : sauce onctueuse, orange-rouge, sans grumeaux de gras. Risotto : crémeux, coule lentement, grain ferme au centre.', '👃 Le chili sent le cumin grillé dès les épices ; le curry sent fort dès que l’huile perle.', '🖐 Cube de bœuf : cède à la fourchette sans résistance = prêt ; résiste = 30 min de plus, c’est le collagène qui n’a pas fini.'],
      fin: 'Le mijoté à la texture attendue par la fiche, dégraissé, assaisonné, herbes de bouquet retirées.',
      erreurs: ['✗ Bœuf encore dur à 2 h 30 → pas raté, pas fini : 30 min de plus, puis 30 encore. Le collagène a besoin de temps, pas de feu.', '✗ Lait de coco qui tranche (grumeaux, gras séparé) → feu trop fort ; baisser, fouetter, ajouter 3 c. à s. d’eau. Ça revient en partie.', '✗ Risotto collant et sans crème → tout le bouillon d’un coup et pas remué ; rattraper en fin avec beurre + parmesan et 1 louche de bouillon en fouettant vivement.', '✗ Chili qui attache → transvaser sans gratter le fond.'] },

    volaille: { nom: 'Mijoter du poulet dans une sauce',
      pourquoi: 'Le blanc de volaille n’a pas de collagène à faire fondre : mijoté longtemps, il devient sec et filandreux même dans une sauce. Il n’a besoin que d’atteindre 74 °C — 10 à 15 min dans une sauce frémissante. La cuisse, elle, aime 30–40 min : son collagène fond.',
      pas: ['Sauce (curry, tomate) déjà frémissante.', 'Morceaux de blanc dorés ou crus (cubes 3 cm) : 10–15 min à frémissement doux, couvert. Cuisses : 30–40 min.', 'Sonde : 74 °C au plus gros morceau.'],
      chiffres: ['🌡 Sauce à 85–90 °C, cœur 74 °C. ⏱ Blanc 10–15 min · cuisse 30–40.'],
      sens: ['👁 Chair opaque jusqu’au centre. 🖐 Ferme et rebondie, pas fibreuse.'],
      fin: 'Poulet à 74 °C, juteux, dans une sauce nappante.',
      erreurs: ['✗ Blanc filandreux → mijoté trop longtemps : rien à rattraper, le déchiqueter dans la sauce (il passera bien en wrap).'] },

    legumes_verts: { nom: 'Mijoter des légumes dans une sauce',
      pourquoi: 'Chaque légume a son temps : la carotte 20–25 min, le poivron 10, la courgette 6–8, les épinards 1. Tout mettre en même temps donne des carottes crues et des courgettes en purée. On les ajoute dans l’ordre du plus dur au plus tendre, à rebours de la fin.',
      pas: ['Légumes durs (carotte, pomme de terre, céleri) dès le mouillage.', 'Légumes moyens (poivron, haricots verts, brocoli, petits pois) 10 min avant la fin.', 'Légumes tendres (courgette, champignons, tomates fraîches) 6–8 min avant la fin.', 'Feuilles (épinards, kale) : 1–2 min avant de couper le feu, elles fondent.'],
      chiffres: ['⏱ À rebours de la fin : durs 20–25 · moyens 10 · tendres 6–8 · feuilles 1–2.'],
      sens: ['🖐 Pointe du couteau dans une carotte : entre sans forcer = cuite. Courgette : tient encore sa forme.'],
      fin: 'Chaque légume cuit à son point, aucun en purée, sauce nappante.',
      erreurs: ['✗ Légumes tous mis au début → les tendres sont en purée : rien à rattraper ; noter l’ordre pour le prochain lot.'] },
    racines: { nom: 'Mijoter carottes, pommes de terre dans une sauce', pourquoi: 'Les racines demandent 20–25 min de frémissement dans une sauce pour s’attendrir à cœur : leur pectine cède vers 85 °C, lentement. Elles partent dès le mouillage.', pas: ['Ajouter dès le mouillage, avec le liquide chaud.', '20–25 min à frémissement ; test à la pointe du couteau.'], chiffres: ['⏱ 20–25 min · 🌡 85–95 °C'], sens: ['🖐 Couteau qui entre sans forcer.'], fin: 'Tendres, entières, imprégnées de sauce.', erreurs: ['✗ Encore dures à la fin → 10 min de plus, c’est tout.'] },
    legumineuses: { nom: 'Mijoter des lentilles dans un bouillon (soupe, dhal)',
      pourquoi: 'La lentille corail se défait en 15 min et lie la soupe d’elle-même ; la verte reste entière 25 min. L’acide (tomate, citron) durcit leur peau : il s’ajoute à la fin. Les épices se font revenir dans le gras d’abord, comme pour un chili.',
      pas: ['Oignon et épices revenus dans l’huile (cumin 30 s).', 'Lentilles rincées, 3 volumes de bouillon chaud, frémissement.', 'Corail : 15–20 min, elles fondent ; vertes : 25 min. Sel en fin, citron en fin.', 'Épinards ou herbes dans la dernière minute.'],
      chiffres: ['💧 1 : 3 · ⏱ corail 15–20 · vertes 25 · 🌡 90 °C'],
      sens: ['👁 Corail : la soupe s’épaissit d’elle-même et devient dorée. 🖐 Verte : s’écrase entre deux doigts.'],
      fin: 'Soupe liée, lentilles fondues (corail) ou entières et tendres (vertes), acide et sel rectifiés.',
      erreurs: ['✗ Lentilles dures → acide trop tôt : 10 min de plus, pincée de bicarbonate.'] },
    graines: { nom: 'Mijoter du boulgour, du quinoa dans un bouillon (façon risotto)',
      pourquoi: 'Cuire une graine dans un bouillon parfumé plutôt qu’à l’eau, c’est la saler et l’aromatiser à cœur. Le boulgour gros absorbe 2 volumes en 12–15 min ; comme le riz, il finit dans la vapeur, couvert, hors du feu.',
      pas: ['Graine toastée 2 min dans le gras avec l’oignon.', 'Bouillon chaud, 2 volumes (boulgour) ou selon la graine, frémissement couvert 12–15 min.', 'Repos 5 min hors du feu, égrener, beurre ou huile en fin.'],
      chiffres: ['💧 Boulgour 1 : 2 · quinoa 1 : 2 · ⏱ 12–15 min + 5'],
      sens: ['👁 Liquide absorbé, grains gonflés et détachés.'],
      fin: 'Graines tendres, parfumées, détachées.',
      erreurs: ['✗ Trop liquide → 3 min à découvert feu doux.'] },
    tofu: { nom: 'Mijoter du tofu dans une sauce', pourquoi: 'Le tofu n’a rien à cuire : il absorbe la sauce, c’est tout. Doré d’abord, il tient sa forme et garde sa croûte 10 min dans la sauce ; cru, il se délite si on remue trop.', pas: ['Sauce frémissante, cubes de tofu dorés, remuer une fois délicatement.', '8–10 min à frémissement doux.'], chiffres: ['⏱ 8–10 min · 🌡 85–90 °C'], sens: ['👁 Cubes entiers, nappés.'], fin: 'Tofu nappé, cubes intacts.', erreurs: ['✗ Tofu émietté → trop remué : servir tel quel, il est bon.'] },
    liquides: { nom: 'Mijoter une sauce : lait de coco, sauce soja, bouillon',
      pourquoi: 'Le lait de coco est une émulsion de gras et d’eau : à gros bouillons elle casse, le gras se sépare en grumeaux. La sauce soja est salée et sucrée : elle brûle et caramélise trop vite à feu fort — on l’ajoute en fin. Un bouillon qu’on fait réduire concentre son sel : on ne le sale qu’à la fin.',
      pas: ['Lait de coco : ajouter après les épices frites, frémissement DOUX, jamais couvert hermétiquement (ça monte).', 'Sauce soja, miel, vinaigre : dans les 2–3 dernières minutes, feu doux.', 'Goûter et rectifier : sel, acide, sucre, dans cet ordre.'],
      chiffres: ['🌡 Lait de coco : 85–90 °C maximum.'],
      sens: ['👁 Une sauce coco lisse, brillante ; grumeaux blancs = elle tranche, baisser et fouetter.'],
      fin: 'Sauce lisse, nappante, assaisonnée.',
      erreurs: ['✗ Coco tranchée → baisser, fouetter, 3 c. à s. d’eau.', '✗ Sauce soja brûlée au fond → transvaser, ne pas gratter.'] }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     ENFOURNER — la chaleur sèche, la plaque, la sonde
     ═══════════════════════════════════════════════════════════════════════ */
  SAVOIR.enfourner = {
    _: { nom: 'Cuire au four : chaleur sèche, rien qui se touche',
      pourquoi: 'Le four cuit par air chaud, une chaleur sèche qui dore (Maillard) et évapore. Mais une plaque trop chargée fabrique de la vapeur : les aliments cuisent à 100 °C dans leur propre humidité au lieu de rôtir, et restent pâles et mous. D’où : plaque préchauffée, aliments espacés, jamais deux couches. La chaleur tournante répartit l’air ; sans elle, on tourne la plaque à mi-cuisson.',
      pas: ['Préchauffer 15 min à la température de la fiche, plaque DEDANS si on veut saisir le dessous.', 'Aliments en une seule couche, 2 cm entre chaque, sur papier cuisson.', 'Ne pas ouvrir la porte les 10 premières minutes (le four perd 30 °C à chaque ouverture).', 'À mi-cuisson : tourner la plaque, retourner les morceaux si la fiche le dit.', 'Sonde au plus épais pour les protéines ; couleur et couteau pour les légumes.'],
      chiffres: ['🌡 Légumes rôtis 200–220 °C · volailles 180–200 · poissons 180–200 · gratins et farcis 180.', '📐 2 cm entre les morceaux, une seule couche.', '⏱ Préchauffage 15 min.'],
      sens: ['👁 Dorure régulière ; pâle après 20 min = trop chargé ou four pas assez chaud. Vapeur qui s’échappe en ouvrant = ça bout.', '👂 Grésillement dans le four = ça rôtit.'],
      fin: 'Coloration uniforme, cuit à cœur (sonde), sorti dès le point atteint.',
      erreurs: ['✗ Plaque surchargée → répartir sur deux plaques, ou deux fournées.', '✗ Dessus brun, cœur cru → four trop chaud : couvrir d’aluminium, baisser de 20 °C, continuer.'] },

    volaille: { nom: 'Rôtir des cuisses, des blancs de poulet : 74 °C',
      pourquoi: 'Au four, la cuisse (riche en collagène et en gras) devient fondante et sa peau croustille à 200 °C ; le blanc (maigre) sèche dès qu’il dépasse 76 °C — il se cuit plus doux, moins longtemps, et se repose. Une peau sèche et salée croustille ; une peau humide bout dessous.',
      pas: ['Sécher les morceaux au papier. Saler généreusement, huile en film, épices. Idéalement 1 h au frais, à découvert, pour que la peau sèche.', 'CUISSES : four 200 °C, peau dessus, 35–45 min, jusqu’à 74 °C à la sonde piquée près de l’os sans le toucher. Peau dorée et croustillante.', 'BLANCS : four 180 °C, 20–25 min, sonde 74 °C. Sortir, couvrir lâchement, 5 min de repos.', 'Poulet entier 1,5 kg : 200 °C, 1 h 15–1 h 30, 74 °C à la cuisse.'],
      chiffres: ['🌡 Cuisses 200 °C · blancs 180 °C · à cœur 74 °C.', '⏱ Cuisses 35–45 min · blancs 20–25 · entier 75–90.'],
      sens: ['👁 Peau brune et tendue ; jus clair quand on pique. Jus rosé = pas cuit.', '🖐 La chair de la cuisse se détache de l’os à la fourchette.'],
      fin: '74 °C à la sonde, peau croustillante, chair juteuse, 5 min de repos avant de trancher.',
      erreurs: ['✗ Peau pâle et molle → four pas assez chaud ou peau mouillée : 5 min sous le gril, porte entrouverte, sans quitter des yeux.', '✗ Blanc sec → cuit trop loin : tranché fin et nappé de sauce ; prochain lot avec la sonde à 72 °C.'] },

    poisson: { nom: 'Saumon au four, truite entière, papillote',
      pourquoi: 'Au four, la chair du poisson cuit à cœur avant de dorer : on ne cherche pas une croûte mais une chair juste opaque. Le saumon, gras, reste moelleux jusqu’à 55–60 °C ; livré, il doit atteindre 63 °C, sans aller plus loin. En papillote, le poisson cuit dans sa propre vapeur (100 °C dans le papier), avec ses légumes et son jus : c’est la cuisson la plus sûre pour un filet maigre comme le merlu. Le papier gonfle : c’est la vapeur, et le signe que c’est presque prêt.',
      pas: ['SAUMON (pavés 150–180 g) : four 180 °C. Sécher, saler, huile. 12–15 min. Sonde : 63 °C. Sortir aussitôt.', 'TRUITE ENTIÈRE (300 g) : vidée, rincée dedans et séchée, sel et huile dans la cavité et sur la peau, citron et thym dedans. Four 200 °C, 20–25 min. Prête quand l’œil est blanc et que la chair se détache de l’arête dorsale à la fourchette.', 'PAPILLOTE : rectangle de papier cuisson de 40 cm, légumes en julienne au centre, filet dessus, sel, huile, citron, herbes. Replier en repliant les bords deux fois pour fermer hermétiquement. Four 200 °C, 12–15 min : la papillote gonfle. Ouvrir en tenant le visage à l’écart de la vapeur.'],
      chiffres: ['🌡 Saumon 180 °C, cœur 63 °C · truite 200 °C · papillote 200 °C.', '⏱ Saumon 12–15 min · truite 20–25 · papillote 12–15.'],
      sens: ['👁 Saumon : la chair passe du rouge translucide au rose opaque ; un peu de blanc (albumine) qui perle en surface = on approche de trop cuit, sortir. Truite : œil blanc et opaque. Papillote : gonflée et un peu dorée.', '🖐 Feuillets qui se séparent sous une pression légère.'],
      fin: '63 °C à cœur, chair opaque et moelleuse, feuillets qui se détachent, jus de papillote gardé pour le dressage.',
      erreurs: ['✗ Beaucoup d’albumine blanche en surface du saumon → trop chaud ou trop long : sortir, c’est cuit ; prochain lot 10 °C de moins.', '✗ Papillote qui ne gonfle pas → mal fermée : la vapeur s’échappe, prolonger de 3 min.'] },

    legumes_verts: { nom: 'Rôtir des légumes : 200–220 °C, en une couche', pourquoi: 'Au four très chaud, l’eau des légumes s’évapore vite et leurs sucres caramélisent sur les bords : c’est le goût du rôti. À 180 °C ou en tas, ils bouillent dans leur vapeur et restent mous et pâles. L’huile conduit la chaleur et empêche de dessécher ; le sel avant la cuisson tire l’eau (pas grave à 220 °C, c’est ce qu’on veut).', pas: ['Légumes taillés au même calibre (2 cm), enrobés d’huile et de sel dans un saladier (1 c. à s. d’huile pour 500 g).', 'Plaque préchauffée, papier cuisson, une seule couche, espacés.', '220 °C chaleur tournante, 20–30 min ; retourner à mi-cuisson.', 'Prêt : bords bruns, couteau qui entre sans forcer.'], chiffres: ['🌡 200–220 °C · ⏱ légumes durs (carotte, pomme de terre) 30–35 min · moyens (poivron, courgette, brocoli) 18–25 · 🫒 1 c. à s. / 500 g'], sens: ['👁 Bords bruns, caramélisés ; surface un peu fripée.', '👂 Grésillement en ouvrant le four.'], fin: 'Légumes dorés sur les bords, tendres à cœur, encore fermes.', erreurs: ['✗ Pâles et mous → trop de légumes sur la plaque : les étaler sur deux, 10 min de plus à 220 °C.'] },
    racines: { nom: 'Rôtir pommes de terre, carottes, patates douces', pourquoi: 'Les racines sont denses : elles demandent 30–40 min à 200–220 °C pour cuire à cœur ET dorer. Une pomme de terre qu’on veut vraiment croustillante se précuit 8 min à l’eau puis se secoue dans la passoire (les bords s’ébouriffent) avant d’aller au four.', pas: ['Cubes 2–3 cm, secs, huilés, salés.', 'Plaque chaude, une couche. 220 °C, 30–40 min, retourner à mi-cuisson.', 'Pointe du couteau au centre : sans résistance.'], chiffres: ['🌡 220 °C · ⏱ 30–40 min · 🫒 1,5 c. à s. / 500 g'], sens: ['👁 Croûte dorée, cœur fondant.', '🖐 Couteau qui entre sans forcer.'], fin: 'Dorées et croustillantes dehors, fondantes dedans.', erreurs: ['✗ Dorées dehors, dures dedans → four trop chaud ou cubes trop gros : couvrir d’aluminium 10 min à 180 °C.'] },
    legumes_fruits: { nom: 'Courgettes farcies, légumes-fruits au four', pourquoi: 'Une courgette farcie cuit par le four ET par la vapeur de son eau : 180 °C, 25–35 min, dans un plat avec un fond d’eau (3 mm) pour que le dessous ne brûle pas. La farce, déjà cuite (quinoa, légumes revenus), n’a qu’à chauffer et gratiner.', pas: ['Demi-courgettes creusées, salées à l’intérieur, dans un plat huilé avec 3 mm d’eau au fond.', 'Farce tassée à la cuillère, dôme léger, fromage dessus si la fiche le dit.', '180 °C, 25–35 min : la chair de la courgette cède au couteau, le dessus est doré.'], chiffres: ['🌡 180 °C · ⏱ 25–35 min · 💧 3 mm d’eau au fond'], sens: ['👁 Dessus gratiné, courgette qui s’affaisse un peu.', '🖐 Couteau qui traverse la courgette sans forcer.'], fin: 'Courgette tendre, farce chaude et gratinée.', erreurs: ['✗ Dessus brûlé, courgette crue → four trop chaud : couvrir d’aluminium, 160 °C, 10 min.'] },
    plat: { nom: 'Gratins, farcis, papillotes : finir au four', pourquoi: 'Ce qui va au four déjà assemblé n’a plus qu’à chauffer à cœur et dorer dessus. Le cœur doit atteindre 70 °C (plat livré) ; le dessus gratine à partir de 180 °C.', pas: ['180 °C préchauffé, plat au milieu.', '25–35 min ; sonde au centre : 70 °C. Gril 2–3 min en fin si le dessus est pâle, sans quitter des yeux.'], chiffres: ['🌡 180 °C, cœur 70 °C · ⏱ 25–35 min'], sens: ['👁 Dessus doré, bords qui bouillonnent.'], fin: 'Chaud à cœur, doré dessus.', erreurs: ['✗ Dessus brûlé → aluminium, baisser.'] }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     MÉLANGER, FOUETTER, MIXER — farces, salades, émulsions, purées
     ═══════════════════════════════════════════════════════════════════════ */
  SAVOIR.melanger = {
    _: { nom: 'Mélanger : homogène, sans trop travailler',
      pourquoi: 'Mélanger sert à répartir ; travailler trop change la matière. Une farce trop pétrie devient élastique (les protéines de la viande s’accrochent entre elles), une salade trop remuée s’écrase, une pâte trop travaillée durcit (le gluten). On mélange jusqu’à l’homogène, et on s’arrête.',
      pas: ['Grand récipient : deux fois le volume du mélange.', 'Ingrédients dans l’ordre de la fiche ; le sel et les liquides en dernier sauf indication.', 'Maryse ou main : soulever et retourner, plutôt que tourner en rond. Arrêter dès qu’on ne distingue plus les ingrédients.'],
      chiffres: ['⏱ Une farce se mélange en 1–2 min ; une salade en 30 s.'],
      sens: ['👁 Couleur uniforme, plus de trace d’un ingrédient seul.'],
      fin: 'Homogène, couvert, réservé au froid si le plat attend.',
      erreurs: ['✗ Farce élastique et collante → trop travaillée : 20 min au frais, ça se tasse un peu.'] },

    plat: { nom: 'Une farce de boulettes, une farce de galettes, une salade composée',
      pourquoi: 'FARCE DE VIANDE HACHÉE : la chapelure trempée dans le lait (la « panade ») retient l’eau pendant la cuisson : c’est ce qui fait une boulette juteuse. L’œuf lie. Le sel serre les protéines : 1 % du poids de viande (10 g par kg). On mélange FROID, peu, à la main ; trop pétrie, la viande devient une masse caoutchouteuse. FARCE DE LÉGUMINEUSES : les flocons d’avoine absorbent l’humidité et lient ; la farce doit reposer 15 min au frais pour qu’ils gonflent, sinon les galettes s’effritent. SALADE COMPOSÉE (quinoa, boulgour, chou, haricots) : la graine doit être FROIDE avant d’y mettre herbes et légumes crus (chaude, elle les cuit et les fane) ; la vinaigrette en dernier, ou séparée si la salade attend.',
      pas: ['BOULETTES : chapelure + lait dans le saladier, 5 min. Viande froide, oignon et ail hachés, œuf, herbes, sel (1 %), poivre. Mélanger à la main 1 min, juste homogène. Test : cuire une mini-boulette à la poêle, goûter, rectifier le sel. Mains mouillées, former à la cuillère à glace (40–45 g), rouler sans serrer. 20 min au frais avant cuisson.', 'GALETTES DE LENTILLES : lentilles mixées grossièrement, légumes revenus, flocons, épices, sel. Mélanger, 15 min au frais. Former des palets de 1,5 cm, presser fermement entre les paumes.', 'SALADE : graine cuite et REFROIDIE à plat. Légumes taillés et égouttés, herbes hachées au dernier moment. Mélanger à la main ou à la maryse en soulevant. Vinaigrette au moment de servir, ou dans un contenant à part.', 'SALADE DE CHOU : chou émincé fin, salé 15 min dans une passoire (il rend son eau et s’assouplit), pressé, puis yaourt, ail, citron.'],
      chiffres: ['🧂 Sel d’une farce : 10 g par kg de viande. 🥛 Panade : 5 % de chapelure et 5 % de lait du poids de viande.', '📏 Boulettes 40–45 g · galettes 1,5 cm.', '⏱ Repos 15–20 min au frais.'],
      sens: ['🖐 Farce de boulettes : se tient en boule, un peu collante, pas élastique. Galette : se presse sans se fendre.', '👁 Salade : les herbes restent vertes et droites — si elles fanent, la graine était chaude.'],
      fin: 'Farce homogène et reposée au frais, boulettes calibrées ; salade froide, assaisonnée au dernier moment.',
      erreurs: ['✗ Boulettes qui se défont → farce trop humide : ajouter 1 c. à s. de chapelure, 20 min au frais.', '✗ Farce fade au test → saler : la seule occasion de le savoir est la mini-boulette d’essai.', '✗ Salade qui baigne → légumes non égouttés ou vinaigrette trop tôt : égoutter, resservir sec.'] },

    liaison: { nom: 'Singer (farine), monter au beurre et au parmesan',
      pourquoi: 'SINGER : saupoudrer la viande et les légumes de farine avant de mouiller. La farine cuit 2 min dans le gras (sinon goût de farine crue), puis son amidon gonfle dans le liquide et lie la sauce. Sans ce temps de cuisson, grumeaux et goût de colle. MONTER AU BEURRE (risotto) : hors du feu, le beurre froid s’émulsionne dans le liquide chaud et rend la sauce brillante ; sur le feu, il fond en huile.',
      pas: ['SINGER : viande et légumes dorés dans la cocotte, feu moyen. Saupoudrer la farine en pluie sur tout, remuer 2 min : la farine disparaît et le fond blondit. Mouiller ensuite avec du liquide CHAUD, en remuant.', 'MONTER : casserole HORS du feu. Beurre froid en dés, parmesan râpé. Remuer vivement 30 s. Couvrir 2 min.'],
      chiffres: ['🌾 Farine : 30 g pour 1,5 kg de viande (2 % du poids). ⏱ 2 min de cuisson avant de mouiller.', '🧈 Risotto : 20 g de beurre et 30 g de parmesan pour 300 g de riz cru.'],
      sens: ['👁 Singer : plus de farine blanche visible, le fond fait une pâte blonde. Monter : la surface devient brillante et crémeuse.'],
      fin: 'Sauce liée sans grumeau ; risotto brillant qui fait une vague.',
      erreurs: ['✗ Grumeaux après le mouillage → liquide froid ou farine crue : fouetter fort, ou passer au chinois en fin.'] },

    epices: { nom: 'Incorporer une pâte de curry, du cumin, des épices',
      pourquoi: 'Les arômes des épices sont solubles dans le gras, pas dans l’eau : jetées dans une sauce liquide, elles restent plates. On les fait « fleurir » 30–60 s dans le gras chaud avant de mouiller — le parfum monte d’un coup. Une pâte de curry se frit dans la crème du lait de coco jusqu’à ce que l’huile perle.',
      pas: ['Gras chaud (huile, ou crème de coco épaisse), feu moyen.', 'Épices moulues ou pâte : remuer sans arrêt 30–60 s. Le parfum monte, la couleur fonce. Ne pas attendre la fumée.', 'Mouiller ou ajouter l’aliment suivant aussitôt.'],
      chiffres: ['⏱ 30–60 s · 🌡 feu moyen, 140–160 °C. Pâte de curry : 2–3 min jusqu’à l’huile qui perle.'],
      sens: ['👃 Le parfum arrive en 20 s : c’est le signal. Une odeur âcre = brûlé.', '👁 Pâte de curry : des perles d’huile rouge apparaissent en surface.'],
      fin: 'Épices parfumées, mouillées dans la foulée, sans amertume.',
      erreurs: ['✗ Épices brûlées (noires, âcres) → jeter et recommencer : l’amertume ne part pas.'] },
    legumes_verts: { nom: 'Mélanger des légumes cuits ou crus dans un plat', pourquoi: 'Des légumes cuits se cassent si on les remue en tournant ; on les incorpore en soulevant à la maryse, à la fin. Des légumes crus se salent 10 min avant pour rendre leur eau si la fiche les veut souples.', pas: ['Légumes égouttés et refroidis.', 'Ajouter en dernier, soulever en trois mouvements, arrêter.'], chiffres: ['⏱ 30 s'], sens: ['👁 Morceaux entiers, pas de purée.'], fin: 'Légumes répartis, entiers.', erreurs: ['✗ Écrasés → moins remuer au lot suivant.'] },
    legumes_fruits: { nom: 'Salsa de tomates, de mangue', pourquoi: 'Une salsa est un mélange cru : dés réguliers, acide (lime), sel, herbe, et 10 min de repos pour que les jus se mêlent. Sans épépiner la tomate, elle baigne ; l’acide met la mangue et l’avocat à l’abri du brunissement.', pas: ['Dés de 1 cm, égouttés.', 'Oignon rouge ciselé (trempé 10 min à l’eau froide), piment, coriandre hachée au dernier moment, lime, sel, huile.', 'Mélanger doucement, 10 min de repos, goûter, rectifier acide et sel.'], chiffres: ['📏 dés 1 cm · ⏱ 10 min de repos'], sens: ['👁 Brillante, dés entiers. 👅 Acide franc, salé juste.'], fin: 'Salsa fraîche, égouttée, dés entiers.', erreurs: ['✗ Qui baigne → passer 2 min dans une passoire avant de dresser.'] },
    legumineuses: { nom: 'Mélanger haricots, lentilles dans une salade ou un plat', pourquoi: 'Une légumineuse en boîte se rince (liquide visqueux, sel) ; cuite maison, elle se refroidit avant la salade. On l’incorpore en soulevant : elle s’écrase vite.', pas: ['Rincer et égoutter à fond.', 'Ajouter en dernier, soulever, arrêter.'], chiffres: ['💧 Rincer 30 s à l’eau froide.'], sens: ['👁 Entières, brillantes.'], fin: 'Réparties, entières.', erreurs: ['✗ Écrasées → moins remuer.'] },
    graines: { nom: 'Égrener et mélanger quinoa, boulgour, millet', pourquoi: 'Une graine cuite et chaude cuit ce qu’on lui ajoute (herbes fanées, tomates molles). On l’étale d’abord à plat pour la refroidir en 10 min, on l’égrène à la fourchette, puis on assemble.', pas: ['Étaler la graine sur une plaque, 10 min.', 'Égrener à la fourchette, ajouter légumes, herbes, vinaigrette, soulever à la maryse.'], chiffres: ['⏱ 10 min de refroidissement'], sens: ['👁 Grains détachés, herbes vertes.'], fin: 'Salade froide, grains séparés.', erreurs: ['✗ Herbes fanées → graine trop chaude : rien à rattraper, en remettre au dressage.'] },
    viande: { nom: 'Mélanger une viande hachée, singer un braisé', pourquoi: 'Voir la farce des boulettes (famille plat) et le singer (famille liaison) : c’est l’un ou l’autre selon l’étape.', pas: ['Farce : froid, 1 min, 1 % de sel, test en mini-boulette.', 'Singer : farine en pluie sur la viande dorée, 2 min, puis liquide chaud.'], chiffres: ['🧂 10 g/kg · 🌾 2 % de farine'], sens: ['🖐 Farce qui se tient sans être élastique.'], fin: 'Farce reposée ou sauce liée.', erreurs: ['✗ Farce élastique → trop travaillée.'] },
    tofu: { nom: 'Enrober le tofu de marinade ou de sauce', pourquoi: 'Le tofu pressé absorbe une marinade en 20–30 min ; non pressé, il n’absorbe rien. On enrobe à la maryse sans écraser les cubes.', pas: ['Cubes secs dans un bac, marinade dessus, retourner doucement.', '20–30 min au frais, égoutter avant de saisir (la marinade brûle).'], chiffres: ['⏱ 20–30 min'], sens: ['👁 Cubes colorés par la marinade, entiers.'], fin: 'Tofu mariné, égoutté, prêt à dorer.', erreurs: ['✗ Saisi trempé de marinade → il brûle et colle : bien égoutter, ou saucer après.'] }
  };

  SAVOIR.fouetter = {
    _: { nom: 'Fouetter : incorporer de l’air ou lier deux liquides',
      pourquoi: 'Le fouet fait deux choses : il incorpore de l’air (blancs, crème) ou il disperse un liquide dans un autre en gouttelettes minuscules (une émulsion : vinaigrette, mayonnaise). Une émulsion tient grâce à un émulsifiant (moutarde, jaune d’œuf, ail écrasé, yaourt) et à un ajout LENT de l’huile.',
      pas: ['Récipient à fond rond (cul-de-poule), stable sur un torchon.', 'Fouetter du poignet, en cercles rapides qui touchent le fond.'],
      chiffres: ['⏱ Une vinaigrette se monte en 1 min ; des blancs en neige en 3–4.'],
      sens: ['👁 Une émulsion réussie s’épaissit et pâlit.'],
      fin: 'Texture stable une minute après l’arrêt.',
      erreurs: ['✗ Émulsion qui se sépare → recommencer avec 1 c. à c. de moutarde, en versant l’émulsion ratée en filet.'] },

    emulsion: { nom: 'Monter une vinaigrette, une sauce yaourt, une sauce tahini',
      pourquoi: 'VINAIGRETTE : le sel ne se dissout pas dans l’huile, seulement dans le vinaigre ou le citron — d’où l’ordre : sel + acide + moutarde d’abord, l’huile après. La moutarde est l’émulsifiant : ses particules enrobent les gouttelettes d’huile et les empêchent de se rassembler. L’huile versée en FILET se disperse ; versée d’un coup, elle flotte. Proportion classique 1 acide : 3 huile. SAUCE YAOURT : un yaourt trop fouetté se liquéfie ; on remue à la cuillère. TAHINI : au contact du citron, la pâte de sésame se FIGE en bloc (ses protéines coagulent) — c’est normal ; on la détend ensuite à l’eau froide, cuillère par cuillère, jusqu’à une crème lisse.',
      pas: ['VINAIGRETTE : dans le cul-de-poule, sel, poivre, vinaigre ou citron, moutarde. Fouetter 20 s : le sel fond. Puis l’huile en filet mince, sans cesser de fouetter, 40 s. Goûter : acide net, salé juste.', 'SAUCE YAOURT : yaourt grec, ail écrasé en pâte avec du sel, jus de citron, filet d’huile, herbes. Remuer à la cuillère 30 s, pas plus. 15 min au frais pour que l’ail infuse.', 'TAHINI : tahini + jus de citron + ail : fouetter, ça épaissit et se fige. Eau froide, 1 c. à s. à la fois en fouettant : ça se détend, pâlit, devient crémeux. Sel en fin. Consistance nappante.', 'BALSAMIQUE / MOUTARDE : même méthode que la vinaigrette ; le balsamique étant sucré, moins d’acide (1 : 4).'],
      chiffres: ['⚖️ Vinaigrette 1 acide : 3 huile · balsamique 1 : 4. 🧂 Sel : 1 pincée (1 g) pour 4 c. à s. d’huile.', '💧 Tahini : autant d’eau que de tahini environ, ajoutée en 4–5 fois.', '⏱ 1 min de fouet.'],
      sens: ['👁 Vinaigrette : elle épaissit, devient opaque et pâle ; une nappe brillante sur la cuillère. Tahini : passe de figé et brun à crémeux et beige.', '🖐 Yaourt qui devient liquide = trop fouetté.', '👅 Goûter sur une feuille de salade, pas à la cuillère : l’acide se juge sur l’aliment.'],
      fin: 'Émulsion nappante et stable, assaisonnée, dans un contenant fermé (elle se refait d’un coup de fouet si elle se sépare).',
      erreurs: ['✗ Vinaigrette qui se sépare en deux couches → huile versée trop vite : 1 c. à c. de moutarde dans un bol propre, y verser la vinaigrette ratée en filet en fouettant.', '✗ Tahini en bloc → normal ! continuer à l’eau froide, cuillère par cuillère.', '✗ Sauce trop acide → 1 c. à c. de miel ou plus d’huile, jamais du sel.'] },
    fruits: { nom: 'Fouetter du citron dans une sauce', pourquoi: 'Le jus de citron est l’acide d’une émulsion : il va en premier avec le sel, l’huile ensuite en filet. Ajouté en dernier dans une sauce déjà montée, il peut la faire trancher — on l’incorpore goutte à goutte.', pas: ['Citron et sel d’abord, fouetter, puis l’huile en filet.'], chiffres: ['⚖️ 1 acide : 3 huile'], sens: ['👅 Acide net mais pas piquant.'], fin: 'Sauce liée, acide équilibré.', erreurs: ['✗ Trop acide → miel ou huile.'] },
    alliaces: { nom: 'Ail en pâte pour une sauce', pourquoi: 'Écrasé au plat de la lame avec du sel, l’ail devient une pâte lisse qui se disperse dans une sauce sans morceau ; le sel fait abrasif et adoucit le piquant.', pas: ['Gousse dégermée, sel fin dessus, écraser et étaler au plat de la lame, plusieurs passes, jusqu’à une pâte.', 'Incorporer à la sauce, 15 min de repos pour que le piquant s’arrondisse.'], chiffres: ['🧂 1 pincée de sel par gousse'], sens: ['👁 Pâte lisse, brillante, sans morceau.'], fin: 'Ail fondu dans la sauce.', erreurs: ['✗ Sauce trop piquante → 15 min de plus au frais, ou plus de yaourt.'] }
  };

  SAVOIR.mixer = {
    _: { nom: 'Mixer : lisse, en sécurité',
      pourquoi: 'Un mixeur plongeant dans un liquide chaud projette ; un blender fermé sur un liquide chaud fait sauter le couvercle (la vapeur pousse). On mixe par petites quantités, récipient à moitié, couvercle entrouvert et torchon dessus. La texture voulue décide du temps : 30 s pour un velouté, quelques impulsions pour garder du grain.',
      pas: ['Récipient haut et étroit (le plongeant travaille mieux), rempli à moitié.', 'Plongeant : tête au fond AVANT de démarrer, et on ne la sort jamais en marche.', 'Blender : couvercle sans le bouchon central, torchon plié dessus, démarrer doucement puis vite.'],
      chiffres: ['⏱ Velouté 30–60 s · purée grossière 5–10 impulsions.'],
      sens: ['👁 Lisse, brillant, sans morceau visible ; ou grain régulier si voulu.'],
      fin: 'Texture demandée par la fiche, assaisonnement rectifié APRÈS mixage (il change le goût).',
      erreurs: ['✗ Éclaboussures brûlantes → tête sortie en marche : arrêter, remettre au fond.'] },
    plat: { nom: 'Mixer une soupe, un velouté',
      pourquoi: 'Le mixage casse les cellules des légumes et libère leur amidon et leurs fibres : c’est ce qui lie une soupe sans crème. Trop de liquide, elle est claire ; trop peu, elle est une purée. On mixe avec une partie du bouillon et on détend ensuite au bouillon chaud jusqu’à la consistance. Un chinois donne le velouté d’un restaurant.',
      pas: ['Retirer thym et laurier. Prélever une louche de bouillon.', 'Mixer au plongeant 30–60 s, en promenant la tête au fond. Ou au blender par moitiés.', 'Détendre au bouillon chaud jusqu’à ce que la soupe nappe la cuillère.', 'Passer au chinois si la fiche le dit. Saler, poivrer, filet d’huile ou crème, goûter.'],
      chiffres: ['⏱ 30–60 s · 🌡 mixer chaud (elle épaissit en refroidissant : viser un peu plus liquide que voulu).'],
      sens: ['👁 Lisse et veloutée, couleur uniforme ; elle tombe de la cuillère en ruban.', '👅 Le sel se rectifie APRÈS : mixée, une soupe paraît moins salée.'],
      fin: 'Soupe lisse, nappante, assaisonnée, refroidie vite pour la boîte.',
      erreurs: ['✗ Trop épaisse → bouillon chaud. ✗ Trop liquide → 10 min de réduction à découvert, ou une pomme de terre cuite mixée dedans.'] },
    racines: { nom: 'Écraser patates douces, pommes de terre : jamais au mixeur',
      pourquoi: 'Mixée, la pomme de terre libère son amidon et devient une colle élastique. La patate douce résiste un peu mieux (moins d’amidon) mais l’écrase-purée reste la règle : on ÉCRASE, on ne mixe pas. Chaud, avec la matière grasse, puis détendu au lait ou au bouillon chaud.',
      pas: ['Légumes égouttés et séchés 1 min dans la casserole sur le feu éteint.', 'Presse-purée ou fourchette, CHAUD. Beurre ou huile, puis lait ou bouillon chaud cuillère par cuillère.', 'Sel, poivre, muscade si la fiche le dit. Ne pas retravailler.'],
      chiffres: ['🧈 20 g de matière grasse pour 500 g · 🥛 50–100 ml de liquide chaud.'],
      sens: ['🖐 Purée souple qui tient sur la cuillère ; élastique et collante = trop travaillée.'],
      fin: 'Écrasé souple, chaud, assaisonné.',
      erreurs: ['✗ Colle élastique → mixeur : irrécupérable en purée, réutiliser en soupe ou en galettes.'] },
    fruits: { nom: 'Écraser des avocats : guacamole', pourquoi: 'L’avocat brunit à l’air (enzyme) : la lime, ajoutée tout de suite, bloque l’oxydation et donne l’acidité. Écrasé à la fourchette il garde du grain ; mixé, il devient une mousse lisse qui brunit plus vite (plus de surface).', pas: ['Chair d’avocat, jus de lime AUSSITÔT, sel.', 'Fourchette : écraser en gardant des morceaux. Oignon, coriandre, piment.', 'Film au contact, pas d’air.'], chiffres: ['🍋 1 lime pour 2 avocats · ⏱ tient 3–4 h filmé'], sens: ['👁 Vert vif, grain visible.'], fin: 'Guacamole vert, texturé, filmé au contact.', erreurs: ['✗ Brun → retirer la couche du dessus, relimer.'] },
    legumineuses: { nom: 'Mixer lentilles, chou-fleur pour une farce : par impulsions', pourquoi: 'Une farce de galettes a besoin de GRAIN pour tenir et avoir de la mâche : mixée en purée lisse, elle devient une pâte qui s’étale et ne croustille pas. On mixe par impulsions, une seconde à la fois, jusqu’à une texture de gros sable.', pas: ['Lentilles cuites et ÉGOUTTÉES à fond (sinon la farce est liquide), chou-fleur cuit et pressé.', '5 à 10 impulsions d’une seconde. Arrêter dès que ça se tient quand on presse.', 'Flocons, épices, légumes revenus, 15 min au frais.'], chiffres: ['⏱ 5–10 impulsions'], sens: ['🖐 Se presse en boule sans couler ; grain visible.'], fin: 'Farce granuleuse qui se tient.', erreurs: ['✗ Purée lisse → ajouter 2 c. à s. de flocons, 20 min au frais.'] },
    graines: { nom: 'Mixer des flocons d’avoine en farine grossière', pourquoi: 'Les flocons mixés 10 s deviennent une farine grossière qui lie une farce ; entiers, ils restent visibles.', pas: ['10 s au mixeur sec.'], chiffres: ['⏱ 10 s'], sens: ['👁 Poudre grossière.'], fin: 'Liant prêt.', erreurs: ['✗ Réduit en poudre fine et collante → mixé trop longtemps : elle liera trop et la farce sera compacte, compenser avec un peu moins de liant au prochain lot.', '✗ Encore des flocons entiers → bol trop plein : mixer en deux fois.'] }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     ASSAISONNER, RINCER, HUILER, RÉFRIGÉRER, REPOSER, PESER, ATTENDRE, DRESSER
     ═══════════════════════════════════════════════════════════════════════ */
  SAVOIR.assaisonner = {
    _: { nom: 'Saler, poivrer, goûter',
      pourquoi: 'Le sel ne donne pas seulement du salé : il fait ressortir les autres goûts et retient l’eau dans une viande salée à l’avance. Un plat qui réduit (mijoté, sauce) concentre son sel : on sale peu au début, on rectifie à la fin. Le poivre perd son parfum à la cuisson longue : on le moud en fin. Le repère d’un cuisinier pour une masse (farce, soupe) : 1 % de sel du poids — 10 g par kg.',
      pas: ['Saler en plusieurs fois : une partie au début (viandes, eau de cuisson), le reste à la fin, en goûtant.', 'Goûter à la cuillère, à la température de service : chaud, on sent moins le sel.', 'Rectifier dans l’ordre : sel, puis acide (citron, vinaigre — il « réveille » un plat plat), puis sucre (une pincée adoucit une acidité ou une amertume).'],
      chiffres: ['🧂 1 % du poids pour une masse crue (10 g/kg). Eau de cuisson 10 g/l. Une pincée = 1 g.', '⏱ Viandes : saler 15–40 min avant la cuisson (le sel entre), ou juste avant (pas entre les deux : il tire l’eau à la surface).'],
      sens: ['👅 Bien assaisonné : on goûte l’aliment, pas le sel. Plat « plat » sans être fade = il manque d’acide, pas de sel.'],
      fin: 'Assaisonnement goûté et rectifié à la fin, noté sur la fiche si corrigé.',
      erreurs: ['✗ Trop salé → allonger (bouillon, eau, lait de coco), ajouter un féculent qui absorbe (pomme de terre), une pointe d’acide et de sucre. Ne jamais compenser par du sucre seul.'] },
    liquides: { nom: 'Mouiller : vin, bouillon — chaud, à hauteur',
      pourquoi: 'Mouiller, c’est ajouter le liquide de cuisson. CHAUD : froid, il stoppe tout net et raidit la viande. Le vin se verse d’abord, seul, à feu vif : il décolle les sucs du fond (« déglacer ») et son alcool s’évapore en 2–3 min — sinon la sauce reste âpre. Puis le bouillon, à hauteur : le liquide affleure l’aliment sans le noyer. Trop de liquide donne une sauce fade qu’il faudra réduire une heure.',
      pas: ['Feu vif, verser le vin, gratter le fond à la spatule en bois : les sucs se dissolvent, le vin mousse.', 'Laisser réduire 2–3 min : l’odeur d’alcool disparaît.', 'Bouillon CHAUD à hauteur. Thym, laurier. Ébullition, puis frémissement.'],
      chiffres: ['💧 À hauteur = le liquide affleure. 🌡 Liquide à 80 °C et plus.', '⏱ Vin : 2–3 min de réduction avant le bouillon.'],
      sens: ['👃 L’odeur piquante d’alcool part au bout de 2 min ; c’est le signal du bouillon.', '👁 Fond de cocotte propre après le déglaçage : les sucs sont dans la sauce.'],
      fin: 'Fond déglacé, alcool évaporé, liquide chaud à hauteur, plat parti au frémissement.',
      erreurs: ['✗ Sauce âpre → alcool pas évaporé : 10 min de plus à découvert.', '✗ Trop de liquide → retirer une louche maintenant plutôt que réduire une heure à la fin.'] },
    herbes: { nom: 'Thym, laurier, herbes : au début ou à la fin ?', pourquoi: 'Les herbes SÈCHES et robustes (thym, laurier, romarin) libèrent leurs arômes lentement : elles partent dès le mouillage, et se retirent avant le service. Les herbes FRAÎCHES et tendres (persil, coriandre, basilic, menthe, ciboulette) perdent tout en 5 min de chaleur : elles vont dans la dernière minute, ou au dressage.', pas: ['Thym, laurier : 3 branches et 3 feuilles pour 1,5 kg de viande, liées ensemble (bouquet garni) pour les retrouver. Retirer avant de dresser.', 'Herbes fraîches hachées : feu coupé, mélanger, ou parsemer sur la boîte.'], chiffres: ['🌿 Thym/laurier : dès le mouillage. Herbes fraîches : dernière minute.'], sens: ['👃 Le thym parfume la sauce après 30 min ; le persil parfume tout de suite et disparaît en 5.'], fin: 'Bouquet retiré, herbes fraîches vertes sur le plat.', erreurs: ['✗ Feuille de laurier oubliée dans une boîte → un client la trouvera : compter les feuilles à l’entrée, les compter à la sortie.'] },
    volaille: { nom: 'Saler et assaisonner une volaille, un poisson avant cuisson', pourquoi: 'Salée 15–40 min avant, une volaille absorbe le sel et garde ses jus ; salée 5 min avant, le sel tire l’eau en surface et l’empêche de dorer — on sèche donc au papier juste avant la poêle. Un poisson se sale 5–10 min avant et se sèche pareil ; plus longtemps, sa chair raffermit.', pas: ['Sel fin des deux côtés, épices, filet d’huile. 15–40 min au frais (volaille) ; 5–10 min (poisson).', 'Sécher au papier juste avant la cuisson.'], chiffres: ['🧂 Sel : 1 % du poids · ⏱ volaille 15–40 min · poisson 5–10 min'], sens: ['👁 Surface sèche et mate au moment de poser dans la poêle.'], fin: 'Assaisonné à cœur, sec en surface.', erreurs: ['✗ Surface mouillée → sécher : le sel a fait son travail.'] },
    viande: { nom: 'Saler un bœuf à braiser', pourquoi: 'Le braisé réduit et sa sauce concentre le sel : on sale la viande avant de la dorer (goût de la croûte), peu au mouillage, et on rectifie à la fin.', pas: ['Sel sur les cubes 10 min avant de dorer.', 'Sel léger au mouillage. Rectifier en fin.'], chiffres: ['🧂 En fin, après réduction.'], sens: ['👅 Goûter la sauce en fin.'], fin: 'Assaisonnement juste après réduction.', erreurs: ['✗ Trop salé → allonger, pomme de terre.'] },
    graines: { nom: 'Assaisonner une graine, une garniture', pourquoi: 'Une graine cuite à l’eau salée est déjà assaisonnée à cœur ; on ajuste ensuite avec acide, huile et herbes, froid.', pas: ['Goûter la graine, sel, citron, huile, herbes fraîches.'], chiffres: ['🧂 Rectifier au goût.'], sens: ['👅 Acide net, huile perceptible.'], fin: 'Garniture assaisonnée.', erreurs: ['✗ Fade → c’est l’acide qui manque.'] },
    epices: { nom: 'Épices, moutarde : les faire fleurir ou les diluer', pourquoi: 'Épices moulues : 30–60 s dans le gras chaud (voir « mélanger · épices »). Moutarde : dans une sauce froide ou en fin de cuisson (elle perd son piquant à la chaleur).', pas: ['Épices : dans le gras, 30–60 s.', 'Moutarde : hors du feu.'], chiffres: ['⏱ 30–60 s'], sens: ['👃 Parfum qui monte.'], fin: 'Épices parfumées, moutarde intacte.', erreurs: ['✗ Épices brûlées → recommencer.'] },
    plat: { nom: 'Rectifier un plat en fin de cuisson', pourquoi: 'C’est le dernier goût qui compte. Sel, puis acide, puis sucre. Un mijoté qui a réduit est plus salé qu’au départ ; une soupe mixée paraît moins salée ; un plat froid paraît moins salé que chaud.', pas: ['Goûter à la température de service.', 'Sel par pincées, goûter entre chaque. Puis citron ou vinaigre par cuillère à café. Puis une pincée de sucre si amertume ou acidité.'], chiffres: ['🧂 Une pincée à la fois.'], sens: ['👅 On doit goûter le plat, pas l’assaisonnement.'], fin: 'Rectifié, noté si corrigé.', erreurs: ['✗ Trop salé → allonger.'] }
  };

  SAVOIR.rincer = {
    _: { nom: 'Rincer et égoutter à fond',
      pourquoi: 'Rincer retire la terre, le sable, la poussière, l’amidon de surface (riz), la saponine (quinoa), le liquide visqueux d’une conserve. Égoutter À FOND est aussi important : l’eau qui reste fait retomber la température d’une poêle, dilue une sauce, mouille une salade.',
      pas: ['Bac d’eau froide, plonger, remuer à la main, laisser 30 s : la terre tombe au fond. Soulever l’aliment (ne pas vider le bac dessus).', 'Recommencer jusqu’à une eau claire. Passoire fine pour les graines.', 'Égoutter, puis sécher : essoreuse pour les feuilles, torchon pour le reste.'],
      chiffres: ['💧 Eau froide. 🔁 2 à 4 bains selon la saleté.'],
      sens: ['👁 Eau claire au dernier bain, pas de mousse (quinoa), pas de sable au fond.'],
      fin: 'Propre, égoutté, sec.',
      erreurs: ['✗ Feuilles mouillées à la poêle → elles bouillent : essorer.'] },
    legumineuses: { nom: 'Rincer lentilles corail, pois chiches en boîte', pourquoi: 'La lentille corail porte poussière et amidon (l’eau blanchit) ; rincée, elle cuit sans mousse et sans attacher. La conserve baigne dans un liquide salé et visqueux : rincé, le pois chiche est plus digeste et croustille mieux.', pas: ['Passoire fine, eau froide, remuer à la main 30 s, jusqu’à l’eau claire.', 'Conserve : rincer 30 s, égoutter 5 min, sécher au torchon si on doit les poêler.'], chiffres: ['💧 30 s à 1 min, eau claire.'], sens: ['👁 Eau claire, pas de mousse.'], fin: 'Lentilles claires et égouttées ; pois chiches secs.', erreurs: ['✗ Lentilles pas rincées → mousse abondante à la cuisson : écumer, ce n’est que ça.'] },
    graines: { nom: 'Rincer le quinoa, le riz', pourquoi: 'Quinoa : saponine amère qui mousse — rincer jusqu’à ce que ça ne mousse plus. Riz blanc : amidon de surface qui colle — rincer jusqu’à l’eau claire (3–4 bains). Riz arborio : JAMAIS.', pas: ['Passoire fine ou bol, eau froide, frotter à la main, vider, recommencer.'], chiffres: ['🔁 Quinoa jusqu’à zéro mousse · riz 3–4 bains'], sens: ['👁 Eau claire, pas de mousse.'], fin: 'Graine rincée, égouttée.', erreurs: ['✗ Arborio rincé → risotto sans crème : rien à rattraper.'] },
    herbes: { nom: 'Laver et essorer des herbes, des feuilles', pourquoi: 'Le sable se cache dans les feuilles ; un jet direct les abîme. Bain, soulever, essorer à fond — une feuille mouillée s’écrase au couteau et bout dans la poêle.', pas: ['Bain d’eau froide, soulever, 2 fois. Essoreuse puis torchon.'], chiffres: ['🔁 2 bains'], sens: ['👁 Pas de sable au fond du bac au 2ᵉ bain.'], fin: 'Feuilles propres et SÈCHES.', erreurs: ['✗ Herbes mouillées → torchon 5 min avant de hacher.'] }
  };

  SAVOIR.huiler = {
    _: { nom: 'Huiler : un film, pas une flaque',
      pourquoi: 'L’huile conduit la chaleur du four ou de la poêle à toute la surface de l’aliment et empêche le dessèchement ; en excès, elle fume, amertume et rend gras. Un film fin, régulier, sur TOUTE la surface : 1 cuillère à soupe pour 500 g de légumes suffit. L’huile d’olive vierge fume vers 190 °C : à 220 °C au four, préférer une huile neutre ou un mélange.',
      pas: ['Dans un saladier, aliment + huile + sel, mélanger à la main : chaque morceau brille.', 'Sur un poisson entier : au pinceau, peau et cavité. Sur une plaque : pinceau ou papier absorbant imbibé.'],
      chiffres: ['🫒 1 c. à s. (12 g) pour 500 g de légumes · 1 c. à c. par filet de poisson.', '🌡 Olive vierge ~190 °C · neutre ~220 °C.'],
      sens: ['👁 Surface brillante partout, aucune flaque au fond du saladier.'],
      fin: 'Aliment enrobé, prêt à rôtir ou à saisir.',
      erreurs: ['✗ Flaque d’huile → égoutter 1 min dans une passoire.'] },
    poisson: { nom: 'Huiler une truite, un filet', pourquoi: 'L’huile sur la peau la rend croustillante et l’empêche de coller ; dans la cavité d’un poisson entier, elle porte le sel et les herbes.', pas: ['Poisson séché. Pinceau : huile sur la peau des deux côtés, dans la cavité. Sel dedans et dehors, citron et thym dans la cavité.'], chiffres: ['🫒 1 c. à s. par truite'], sens: ['👁 Peau brillante, pas d’huile qui coule.'], fin: 'Prêt pour le four.', erreurs: ['✗ Peau mouillée sous l’huile → sécher d’abord, elle ne croustillera pas sinon.'] },
    legumes_verts: { nom: 'Huiler des légumes pour le four', pourquoi: 'Enrober au saladier plutôt que verser sur la plaque : chaque face doit être couverte, sinon les faces sèches brûlent.', pas: ['Saladier, huile, sel, mélanger à la main 20 s.'], chiffres: ['🫒 1 c. à s. / 500 g'], sens: ['👁 Tout brille.'], fin: 'Enrobés.', erreurs: ['✗ Faces mates → remélanger.'] }
  };

  SAVOIR.refrigerer = {
    _: { nom: 'Refroidir, mariner, conserver au froid',
      pourquoi: 'Entre 10 et 63 °C, les bactéries se multiplient vite (une population double toutes les 20 min à 37 °C). Un plat cuit doit passer de 63 °C à 10 °C en moins de 2 heures : en cellule de refroidissement, ou étalé en couche mince sur une plaque, ou le récipient dans un bain d’eau glacée. Jamais un récipient chaud et plein au réfrigérateur : il réchauffe tout ce qui l’entoure et met des heures à refroidir au centre.',
      pas: ['Étaler le plat en couche de 3–5 cm dans un bac large, ou poser le récipient dans un évier d’eau glacée en remuant.', 'Dès 10 °C (sonde) : filmer, étiqueter (nom, date, heure), au réfrigérateur ≤ 4 °C.', 'Marinades : à couvert, ≤ 4 °C, sur l’étagère du bas (rien ne coule dessus).'],
      chiffres: ['🌡 63 → 10 °C en moins de 2 h. Réfrigérateur ≤ 4 °C.', '⏱ Marinade volaille 2–12 h · viande 4–24 h · poisson avec acide 30 min maximum (l’acide « cuit » la chair).'],
      sens: ['🖐 Un bac tiède au centre n’est pas refroidi : sonder au centre.'],
      fin: 'Refroidi à cœur, filmé, étiqueté, au froid.',
      erreurs: ['✗ Plat chaud mis au frigo → le sortir, le refroidir au bain glacé, le remettre.'] },
    volaille: { nom: 'Mariner une dinde, un poulet', pourquoi: 'Une marinade parfume la surface (2 mm) et, si elle est salée ou acide, attendrit un peu. L’acide (citron, yaourt) au-delà de 12 h rend la chair farineuse. On égoutte et on sèche avant de saisir : la marinade brûle et empêche de dorer.', pas: ['Filets dans un bac, marinade dessus, retourner pour enrober, filmer.', '30 min minimum, 2–12 h idéalement, ≤ 4 °C.', 'Égoutter, sécher au papier avant cuisson.'], chiffres: ['⏱ 30 min → 12 h · 🌡 ≤ 4 °C'], sens: ['👁 Chair colorée par la marinade en surface.'], fin: 'Marinée, égouttée, sèche.', erreurs: ['✗ Saisie trempée → ça bout et brûle : sécher.'] },
    poisson: { nom: 'Mariner un poisson : court', pourquoi: 'L’acide dénature la chair du poisson comme une cuisson (ceviche) : plus de 30 min, elle devient opaque et ferme. Marinade sans acide (huile, herbes) : jusqu’à 2 h.', pas: ['15–30 min avec acide, ≤ 2 h sans.'], chiffres: ['⏱ 30 min max avec citron'], sens: ['👁 Chair qui blanchit = trop.'], fin: 'Parfumé, encore cru.', erreurs: ['✗ Chair opaque → il est « cuit » par l’acide : cuire moins.'] }
  };

  SAVOIR.reposer = {
    _: { nom: 'Reposer : la cuisson continue hors du feu',
      pourquoi: 'Hors du feu, la chaleur de la surface continue de migrer vers le cœur : la température monte encore de 3 à 5 °C (l’« inertie »). En même temps, les fibres qui s’étaient contractées se détendent et réabsorbent les jus qu’elles avaient poussés au centre. Trancher tout de suite, c’est voir les jus couler sur la planche ; trancher après 5 min, c’est les garder dans la viande. Pour un riz ou une graine, le repos couvert finit d’hydrater le cœur avec la vapeur.',
      pas: ['Poser sur une planche ou un plat chaud, couvrir LÂCHEMENT d’une feuille d’aluminium (hermétique, la croûte ramollit).', 'Chronomètre. Ne pas piquer, ne pas presser.'],
      chiffres: ['⏱ Blanc de volaille 5 min · cuisse 5–8 · rôti 15 · poisson 2 · riz et graines 5–10 couvert.', '🌡 +3 à +5 °C pendant le repos : retirer du feu 3 °C avant la cible.'],
      sens: ['👁 Après le repos, la tranche est humide et uniforme ; sans repos, une flaque sur la planche et un centre plus rouge.'],
      fin: 'Temps écoulé, tranché seulement ensuite.',
      erreurs: ['✗ Tranché trop tôt → les jus sont sur la planche : les verser sur les tranches, c’est tout.'] },
    volaille: { nom: 'Laisser tiédir un poulet avant de le trancher', pourquoi: 'Le blanc de poulet tranché brûlant perd ses jus ; à 60 °C, il les a repris. 5 à 8 min couvert, puis tranches de 1 cm en travers des fibres, pour un wrap ou une salade.', pas: ['Couvrir lâchement, 5–8 min.', 'Trancher en travers des fibres, 1 cm.'], chiffres: ['⏱ 5–8 min'], sens: ['👁 Tranche humide, jus qui ne coulent pas.'], fin: 'Tranché juteux.', erreurs: ['✗ Tranché chaud → jus perdus, verser sur les tranches.'] },
    graines: { nom: 'Reposer le quinoa, le millet, le riz', pourquoi: 'Le feu coupé, la vapeur enfermée finit d’hydrater le cœur des grains et le fond se détache. Sans repos : dessus cuit, fond attaché et grains humides.', pas: ['Feu coupé, couvercle FERMÉ, 5–10 min.', 'Égrener à la fourchette, étaler pour refroidir.'], chiffres: ['⏱ 5–10 min'], sens: ['👁 Grains détachés, secs, cratères en surface.'], fin: 'Égrené, refroidi.', erreurs: ['✗ Couvercle soulevé pendant le repos → 3 min de plus.'] },
    viande: { nom: 'Reposer une viande', pourquoi: 'Voir le repos en général : +3–5 °C, jus redistribués, 5 min pour une pièce, 15 pour un rôti.', pas: ['Couvrir lâchement, chronomètre.'], chiffres: ['⏱ 5–15 min'], sens: ['👁 Pas de flaque.'], fin: 'Reposée, tranchée.', erreurs: ['✗ Flaque de jus sur la planche après tranchage → tranchée trop tôt : les 5 min de repos ne se rattrapent pas, récupérer le jus et le verser sur les tranches.', '✗ Viande refroidie pendant le repos → couverte trop serré ou repos trop long : couvrir LÂCHEMENT d’aluminium, 5 min pour une pièce, pas 20.'] }
  };

  SAVOIR.peser = {
    _: { nom: 'Peser : la tare, le cru, l’étiquette',
      pourquoi: 'Les grammages des fiches sont CRUS : un riz triple, une viande perd un quart, des épinards perdent 80 %. Peser le cru, c’est la seule façon que la fiche et la balance parlent de la même chose. La tare (remise à zéro avec le récipient) évite d’ajouter le poids du bac.',
      pas: ['Récipient vide sur la balance, tare (zéro).', 'Verser jusqu’au poids, retirer l’excédent à la cuillère plutôt que verser à nouveau.', 'Étiquette : recette, ingrédient, poids, date.'],
      chiffres: ['⚖️ Précision : au gramme sous 100 g, à 5 g au-dessus.'],
      sens: ['👁 La balance affiche 0 avant chaque nouvel ingrédient.'],
      fin: 'Chaque ingrédient pesé, étiqueté, dans son bac.',
      erreurs: ['✗ Pesé cuit → refaire le calcul : riz ÷ 2,5–3, viande ÷ 0,75.'] }
  };
  SAVOIR.attendre = {
    _: { nom: 'Attendre : une étape avec une fin',
      pourquoi: 'Une attente (four, mijotage, marinade, repos) est du temps où l’aliment travaille seul. Ce n’est pas du temps perdu, c’est du temps à remplir : le plan de production donne une autre tâche pendant ce temps. Ce qui compte, c’est de REVENIR à l’heure — d’où le minuteur, visible, et pas de mémoire.',
      pas: ['Minuteur lancé, posé là où on le voit ou l’entend.', 'Noter l’heure de fin sur le plan.', 'Autre tâche du plan pendant ce temps.', 'Au signal : vérifier (sonde, couteau, texture) avant de conclure.'],
      chiffres: ['⏱ Le temps de la fiche ; le contrôle décide, pas le minuteur seul.'],
      sens: ['👂 Minuteur audible depuis le poste.'],
      fin: 'Attente écoulée, contrôle fait, étape suivante lancée.',
      erreurs: ['✗ Minuteur oublié → contrôler tout de suite ; un mijoté supporte 15 min de plus, un poisson non.'] }
  };

  SAVOIR.dresser = {
    _: { nom: 'Dresser une boîte : peser, refroidir, fermer, étiqueter',
      pourquoi: 'Le dressage est le dernier endroit où le plat peut se rater : une boîte fermée chaude fait de la condensation qui détrempe tout (le riz devient pâteux, la peau du poulet ramollit) et met des heures à refroidir au centre, dans la zone où les bactéries se multiplient. La règle : refroidir de 63 °C à 10 °C en moins de 2 h AVANT de fermer. La portion est pesée : c’est ce que le client a acheté, et ce que ses macros supposent. Le féculent et la sauce se posent à côté, pas mélangés, quand la boîte a des compartiments : le riz boirait la sauce et la viande sécherait.',
      pas: ['Éléments refroidis à ≤ 10 °C (sonde au centre) ou, si la fiche dit de dresser chaud, boîte laissée OUVERTE jusqu’à 10 °C en cellule.', 'Balance, tare avec la boîte vide. Féculent d’abord (il fait le fond), protéine, légumes, sauce en dernier ou à part. Peser chaque composant si la fiche donne les grammes par portion.', 'Même présentation d’une boîte à l’autre : la première boîte sert de modèle, on la garde sous les yeux.', 'Herbes fraîches, graines torréfiées, citron : au dernier moment, sur le dessus.', 'Opercule, couvercle, étiquette : recette, client, date de production, DLC, allergènes. Réfrigérateur ≤ 4 °C.'],
      chiffres: ['🌡 ≤ 10 °C avant fermeture ; 63 → 10 °C en moins de 2 h ; stockage ≤ 4 °C.', '⚖️ Portion : au gramme près sur la balance, tolérance ± 5 %.', '📅 DLC : selon la fiche ; en général 3 jours pour un plat cuisiné réfrigéré.'],
      sens: ['👁 Aucune buée sous le couvercle après fermeture = la boîte était froide. De la buée = elle était chaude, rouvrir et refroidir.', '🖐 Le fond de la boîte est froid au toucher.'],
      fin: 'Portion pesée, froide, fermée sans buée, étiquetée, identique aux autres, au froid.',
      erreurs: ['✗ Buée sous le couvercle → rouvrir, laisser 20 min en cellule ou au frais à découvert, refermer.', '✗ Poids en dessous de 5 % → compléter avec le féculent ou les légumes, pas avec la sauce.', '✗ Étiquette oubliée → une boîte sans nom ni date se jette : étiqueter avant de ranger, sans exception.'] }
  };

  /* ── Les couples que les fiches réelles produisent et qui méritent leur
     cours plutôt que le repli du geste (relevé sur les 38 fiches). ─────── */
  SAVOIR.melanger.volaille = SAVOIR.melanger.plat;          // dinde hachée → farce
  SAVOIR.melanger.riz = { nom: 'Nacrer le riz arborio',
    pourquoi: 'Avant de mouiller un risotto, le riz se « nacre » : 2 min dans le beurre et l’oignon, en remuant, chaque grain s’enrobe de gras et ses bords deviennent translucides. Ce film de gras ralentit l’absorption : le grain reste al dente au centre pendant que l’amidon de surface fait la crème. Sans nacrage, le riz boit trop vite et devient pâteux.',
    pas: ['Oignon sué dans le beurre, feu moyen.', 'Riz arborio NON rincé, remuer 2 min : les grains deviennent brillants, bords translucides, centre blanc.', 'Déglacer au vin, laisser absorber en remuant, puis le bouillon chaud louche par louche (voir « mijoter · risotto »).'],
    chiffres: ['⏱ 2 min · 🧈 15 g de beurre pour 300 g de riz'],
    sens: ['👁 Grains brillants, nacrés, un point blanc opaque au centre. 👃 Odeur de beurre noisette légère.'],
    fin: 'Riz nacré, prêt à être mouillé.',
    erreurs: ['✗ Riz qui colore → feu trop fort : mouiller tout de suite.'] };
  SAVOIR.melanger.fruits_secs = { nom: 'Incorporer amandes, pignons, raisins secs', pourquoi: 'Les fruits secs torréfiés perdent leur croquant dans l’humidité d’une salade : ils s’ajoutent au DERNIER moment, ou se posent sur la boîte au dressage. Les raisins secs, eux, gagnent à s’hydrater 10 min dans de l’eau tiède ou du jus : ils deviennent moelleux.', pas: ['Raisins : 10 min dans de l’eau tiède, égoutter.', 'Amandes, pignons torréfiés : en dernier, soulever deux fois, ou réserver pour le dressage.'], chiffres: ['⏱ Raisins 10 min · fruits secs au dernier moment'], sens: ['🖐 Amandes qui croquent encore = ajoutées assez tard.'], fin: 'Fruits secs croquants, raisins moelleux.', erreurs: ['✗ Amandes ramollies → torréfier un second lot pour le dessus des boîtes.'] };
  SAVOIR.melanger.fruits = { nom: 'Incorporer mangue, agrumes, citron dans une salade', pourquoi: 'Les fruits frais rendent leur jus dès qu’on les remue : on les ajoute en dernier, en soulevant, et le jus de citron va dans la vinaigrette plutôt que sur les fruits (il les cuit et les ramollit).', pas: ['Fruits taillés, égouttés, ajoutés en dernier, deux mouvements de maryse.'], chiffres: ['⏱ Au dernier moment'], sens: ['👁 Dés entiers, brillants.'], fin: 'Fruits entiers dans la salade.', erreurs: ['✗ Écrasés → moins remuer.'] };
  SAVOIR.melanger.condiments = { nom: 'Incorporer une sauce soja, un miel dans un plat', pourquoi: 'Une sauce salée ou sucrée (soja, miel) s’ajoute hors du feu ou en toute fin : sur le feu elle brûle et caramélise en amertume. On enrobe, on goûte, on ajuste — la sauce soja sale vite.', pas: ['Feu coupé ou très doux, verser, enrober 30 s, goûter.'], chiffres: ['🧂 Sauce soja : 1 c. à s. sale comme 2 g de sel.'], sens: ['👅 Salé net sans être piquant.'], fin: 'Plat enrobé, assaisonné.', erreurs: ['✗ Trop salé → allonger d’eau ou de bouillon.'] };
  SAVOIR.melanger.emulsion = SAVOIR.fouetter.emulsion;
  SAVOIR.melanger.liquides = SAVOIR.assaisonner.liquides;    // « Mouiller » rangé sous mélanger
  SAVOIR.mijoter.condiments = SAVOIR.mijoter.liquides;
  SAVOIR.mixer.legumes_verts = SAVOIR.mixer.legumineuses;   // chou-fleur pour une farce
  SAVOIR.mijoter.viande = { nom: 'Braiser un bœuf : 2 h 30 au frémissement',
    pourquoi: 'Le gîte et le paleron sont des muscles qui ont travaillé : pleins de collagène, durs si on les cuit vite, fondants si on les cuit longtemps et doux. Le collagène commence à fondre en gélatine vers 65 °C, mais il lui faut des heures ; à 90 °C, 2 h 30 pour un cube de 4–5 cm. La gélatine passe dans la sauce et lui donne son brillant et sa tenue. À 100 °C à gros bouillons, les fibres se contractent et expulsent leur eau avant que le collagène ait fondu : la viande est sèche ET dure.',
    pas: ['Viande dorée, légumes revenus, singée, mouillée à hauteur au vin et au bouillon chauds.', 'Ébullition une fois, puis frémissement (une bulle par seconde), couvert. 2 h 30. Au four à 150 °C, c’est plus régulier.', 'Toutes les 30 min : remuer en grattant le fond, vérifier le liquide.', 'Test à 2 h : la fourchette entre dans un cube sans forcer et il se sépare sous une pression légère. Sinon, 30 min de plus.', 'Dégraisser à la cuillère, sel et poivre en fin, retirer thym et laurier.'],
    chiffres: ['🌡 85–95 °C · four 150 °C · ⏱ 2 h 30 pour 4–5 cm · 💧 à hauteur'],
    sens: ['👁 Sauce brune et brillante qui nappe la cuillère ; les cubes ont réduit d’un quart. 🖐 Fourchette qui entre sans résistance. 👃 Odeur ronde, profonde, sans pointe de brûlé.'],
    fin: 'Viande qui se défait, sauce nappante, dégraissée, assaisonnée.',
    erreurs: ['✗ Encore dur → pas fini : 30 min, puis 30. Jamais monter le feu.', '✗ Sauce trop liquide → retirer la viande, réduire à feu vif 10 min, remettre.', '✗ Ça attache → transvaser sans gratter le fond.'] };
  SAVOIR.mijoter.epices = SAVOIR.melanger.epices;
  SAVOIR.assaisonner.emulsion = SAVOIR.assaisonner.epices;  // moutarde
  SAVOIR.assaisonner.poisson = SAVOIR.assaisonner.volaille;
  SAVOIR.saisir.fruits = { nom: 'Poêler des fruits (mangue, agrumes)', pourquoi: 'Un fruit poêlé caramélise par ses propres sucres à feu vif, 1–2 min par face, sans remuer : plus longtemps, il rend son jus et compote.', pas: ['Poêle chaude, filet d’huile, tranches de 1 cm, 1–2 min par face sans toucher.'], chiffres: ['⏱ 1–2 min par face'], sens: ['👁 Marques dorées, chair encore ferme.'], fin: 'Fruits marqués, fermes.', erreurs: ['✗ Compote → trop long : en faire une salsa.'] };


  /* ═══════════════════════════════════════════════════════════════════════
     LES COUPLES QUE LA MESURE A TROUVÉS VIDES (2026-09-23)
     ─────────────────────────────────────────────────────────────────────
     Les 38 fiches produisent 490 tâches de production (1 ingrédient = 1
     étape). Passées une par une dans `pour()`, 98 retombaient sur le repli
     `_` de leur geste — dont TOUT le dressage (63 sur 63) et le
     refroidissement d'un plat chaud (17), c'est-à-dire la fin de journée
     et le seul point sanitaire de la production. Un repli n'est pas une
     absence de cours, c'est un cours qui ne parle pas de l'aliment qu'on a
     dans les mains : il dit « peser, refroidir, fermer » sans dire qu'une
     sauce de braisé fige, qu'un riz boit, qu'un filet se casse.
     ⚠️ Deux de ces trous étaient des CÂBLAGES, pas des manques : le cours
     du riz rincé existait (`rincer.graines`) et n'était jamais montré,
     parce que `riz` est une famille à part dans FAMILLES ; celui des
     feuilles lavées (`rincer.herbes`) ne servait pas aux épinards. Deux
     alias les rendent visibles — c'est le défaut maison d'un savoir écrit
     et jamais atteint (le `K_ENTERS` de narration.html, §3).
     Mesure de couverture : scripts/verifier-savoir.mjs. */

  SAVOIR.rincer.riz = SAVOIR.rincer.graines;          // le cours du riz existait, rien n'y menait
  SAVOIR.rincer.legumes_verts = SAVOIR.rincer.herbes; // épinards, blettes : des feuilles

  SAVOIR.refrigerer.plat = { nom: 'Refroidir un plat chaud : de 63 à 10 °C en moins de 2 h',
    pourquoi: 'C’est le seul geste de la journée où une erreur ne se voit pas et ne se goûte pas. Entre 63 et 10 °C, les bactéries qui ont survécu à la cuisson redémarrent, et une population double toutes les 20 minutes vers 37 °C : un bac de 8 kg posé tel quel au réfrigérateur met cinq à six heures à refroidir au centre, donc passe quatre heures dans cette zone. Ce qui refroidit, ce n’est pas le froid autour : c’est la SURFACE. Un bac de 10 cm de haut refroidit quatre fois plus lentement qu’un bac de 5 cm — la chaleur sort par le carré de l’épaisseur, exactement comme elle entre à la cuisson. Et un couvercle posé sur un plat chaud bloque l’évaporation, qui est la moitié du refroidissement.',
    pas: ['Sortir le plat du feu et le transvaser TOUT DE SUITE dans des bacs larges, en couche de 3 à 5 cm. Un plat laissé dans sa cocotte refroidit par le haut seulement, et la fonte garde la chaleur une heure.', 'À DÉCOUVERT, en cellule de refroidissement si on en a une. Sinon : bac posé dans un évier d’eau glacée (eau + glace à mi-hauteur du bac), et on remue toutes les 10 min — remuer double la vitesse.', 'Sonder AU CENTRE du bac le plus épais, jamais sur le bord. Noter l’heure de sortie du feu : la montre décide, pas l’impression.', 'À 21 °C (environ 1 h) on peut passer au réfrigérateur, toujours à découvert. À 10 °C : filmer, étiqueter (plat, date, heure), ≤ 4 °C.', 'Ne jamais empiler les bacs tant qu’ils sont tièdes : celui du dessous ne refroidit plus.'],
    chiffres: ['🌡 63 → 21 °C en 2 h maximum, puis 21 → 4 °C en 4 h. La règle courte à tenir en cuisine : moins de 2 h pour arriver à 10 °C.', '📏 Couche de 3 à 5 cm. Au-delà de 8 cm, le centre ne suit plus.', '🧊 Bain d’eau glacée : autant de glace que d’eau, remuer toutes les 10 min.', '📅 DLC d’un plat cuisiné réfrigéré : 3 jours en général, ce que dit la fiche sinon.'],
    sens: ['🖐 Le fond du bac est froid mais le centre est tiède : ce n’est pas refroidi, c’est refroidi en surface. Seule la sonde tranche.', '👁 Une sauce qui fige en surface pendant que le dessous fume : remuer, la croûte isole.', '👃 Une odeur aigre ou piquante sur un plat refroidi trop lentement : il se jette, sans discussion.'],
    fin: '10 °C au centre, sonde à l’appui, en moins de 2 h ; filmé, étiqueté avec l’heure, au froid.',
    erreurs: ['✗ Plus de 2 h pour descendre → le plat se jette. C’est cher, et c’est la seule réponse : rien ne rattrape une multiplication bactérienne, la recuisson ne détruit pas les toxines déjà produites.', '✗ Bac couvert trop tôt → rouvrir, remuer, remettre en cellule : on perd 20 min, pas le plat.', '✗ Pas de cellule ni de glace → étaler sur des plaques à pâtisserie en couche de 2 cm : beaucoup de surface, ça descend en 40 min.'] };
  SAVOIR.refrigerer.legumes_fruits = SAVOIR.refrigerer.plat;
  SAVOIR.refrigerer.legumes_verts = SAVOIR.refrigerer.plat;

  SAVOIR.refrigerer.tofu = { nom: 'Presser et garder le tofu',
    pourquoi: 'Le tofu ferme est un caillé : il est gorgé d’eau, et cette eau est ce qui l’empêche de dorer et de prendre le goût d’une marinade. Pressé, il perd 15 à 20 % de son poids en eau, sa texture se resserre, et la place libérée se remplit de marinade. Le froid pendant la presse évite qu’il s’acidifie.',
    pas: ['Sortir le bloc de son eau, l’envelopper dans deux feuilles de papier absorbant ou un torchon propre.', 'Poser sur une assiette creuse, une seconde assiette dessus, et un poids dessus (une boîte de conserve, une casserole d’eau) — environ 1 kg pour un bloc de 400 g.', '30 min au réfrigérateur, 1 h si on a le temps. Changer le papier à mi-parcours s’il est trempé.', 'Tailler ensuite, puis mariner : un tofu taillé prend la marinade sur toutes ses faces.', 'Un bloc entamé se garde immergé dans de l’eau froide, au réfrigérateur, eau changée chaque jour, 3 jours.'],
    chiffres: ['⏱ 30 min à 1 h sous 1 kg · 💧 le bloc perd 15–20 % de son poids · 🌡 ≤ 4 °C · 📅 3 jours immergé, eau changée tous les jours'],
    sens: ['👁 Le papier est trempé et le bloc a visiblement diminué d’épaisseur.', '🖐 Le tofu pressé résiste sous le doigt au lieu de s’enfoncer ; une tranche se tient sans se briser.'],
    fin: 'Bloc ferme, sec en surface, qui ne rend plus d’eau sur la planche.',
    erreurs: ['✗ Tofu qui s’écrase sous le poids → trop lourd ou tofu soyeux : le soyeux ne se presse pas, il se mixe.', '✗ Pas pressé et mis à dorer → il grésille, colle et reste blanc : sécher au torchon, feu plus vif, et accepter qu’il dorera moins.'] };

  SAVOIR.enfourner.four = { nom: 'Préchauffer : le four ment avant d’être chaud',
    pourquoi: 'Le voyant s’éteint quand l’AIR atteint la consigne — au bout de 6 à 8 minutes. Mais ce qui cuit, ce sont aussi les parois, la sole et la plaque, qui mettent deux fois plus longtemps à monter et qui rayonnent. Enfourner sur le voyant, c’est cuire dans un four dont les parois sont 40 °C en dessous : le dessous ne saisit pas, le gratin ne prend pas de couleur, et tout dure un tiers de temps de plus. Et chaque ouverture de porte coûte 20 à 30 °C, que le four met plusieurs minutes à reprendre.',
    pas: ['Vider le four de tout ce qui n’y cuit pas : une plaque oubliée fait écran et crée une zone froide.', 'Régler la température de la fiche et la CHALEUR TOURNANTE quand elle est demandée (elle cuit plus vite et plus régulièrement, on baisse de 20 °C par rapport à la chaleur statique).', 'Laisser 15 minutes à partir du moment où le voyant s’éteint, pas à partir de l’allumage.', 'Si la fiche demande de saisir le dessous (pommes de terre, légumes rôtis) : la plaque préchauffe DANS le four, et on pose les aliments dessus au dernier moment.', 'Vérifier avec un thermomètre de four posé au milieu si on en a un : beaucoup de fours de production affichent 20 à 30 °C de plus ou de moins que la réalité.'],
    chiffres: ['⏱ 15 min après extinction du voyant ; 20–25 min pour un four plein ou une plaque dedans.', '🌡 Chaleur tournante : −20 °C par rapport à la chaleur statique de la fiche.', '🚪 Chaque ouverture : −20 à −30 °C, 3 à 4 min pour les reprendre.'],
    sens: ['🖐 La main tendue à 20 cm de la porte ouverte prend une chaleur sèche et franche, pas une tiédeur.', '👂 Le grésillement doit démarrer dans les secondes qui suivent l’enfournement d’un aliment huilé. S’il ne vient pas, le four n’était pas prêt.'],
    fin: 'Four et plaque à température, vide de tout le reste, prêt à recevoir sans attendre.',
    erreurs: ['✗ Enfourné trop tôt → ne pas monter la température pour rattraper (le dessus brûlerait) : prolonger, et sonder.', '✗ Four qui n’atteint jamais la consigne → joint de porte abîmé ou résistance faible : cuire 10 °C au-dessus de la consigne et sonder, et le signaler.'] };

  /* ⚠️ DRESSER NE PORTE PAS SUR UN INGRÉDIENT, MAIS SUR LA BOÎTE ENTIÈRE, et
     c'est pour ça qu'il a son propre aiguillage. L'aliment d'une étape de
     dressage est l'assemblage — « salade + poulet + vinaigrette », « bourguignon
     + pommes de terre » —, et la famille rend celle du PREMIER mot reconnu :
     mesuré, le bourguignon tombait sur la pomme de terre et recevait le cours du
     bol composé, pendant qu'un wrap et une soupe recevaient celui d'un plat en
     sauce. On classe donc la BOÎTE, du plus spécifique au plus général, et le
     bol composé est le défaut. Ordre : un poisson d'abord (c'est lui qui casse),
     puis ce qui s'emballe, ce qui se verse, ce qui est froid, ce qui a une
     sauce ; une émulsion en dernier, sinon « quinoa + légumes + tahini »
     deviendrait un pot de sauce. */
  SAVOIR.dresser._aiguillage = [
    ['poisson', ['poisson', 'saumon', 'truite', 'thon', 'merlu', 'cabillaud', 'dorade', 'papillote', 'crevette', 'lieu', 'colin']],
    ['wrap', ['wrap', 'burrito', 'tacos', 'tortilla', 'burger', 'pita', 'naan']],
    ['soupe', ['soupe', 'veloute', 'potage']],
    ['salade', ['salade', 'taboule']],
    ['sauce', ['bourguignon', 'braise', 'chili', 'curry', 'risotto', 'saute', 'mijote', 'ragout', 'tajine', 'bolognaise', 'daube']],
    ['emulsion', ['vinaigrette', 'sauce yaourt', 'sauce vierge']]
  ];

  SAVOIR.dresser.sauce = { nom: 'Mettre un plat en sauce en boîte : les morceaux d’abord, la sauce ensuite',
    pourquoi: 'Un plat en sauce se sépare dès qu’on le laisse reposer : le gras remonte, les morceaux tombent au fond, la sauce reste au milieu. Servi à la louche sans avoir remué, les trois premières boîtes prennent la viande et les trois dernières la sauce — deux clients paient la même chose et n’ont pas le même plat. Et la sauce change d’état en refroidissant : la gélatine d’un braisé et l’amidon d’un singé figent vers 30 °C. Une sauce qui nappe parfaitement à chaud devient une gelée en boîte, et c’est normal : elle redeviendra liquide au réchauffage. Ce qu’il ne faut pas faire, c’est l’allonger pour « corriger » ce qu’on voit à froid.',
    pas: ['Plat refroidi à ≤ 10 °C (voir « réfrigérer · plat »). Dégraisser à la louche si une couche de gras a figé en surface.', 'Remuer le bac de bas en haut avant de commencer, et re-remuer toutes les cinq boîtes.', 'Compter : nombre de morceaux ÷ nombre de boîtes. On sert les morceaux à la pince, ce nombre-là, dans chaque boîte — puis la sauce à la louche par-dessus.', 'Tare avec la boîte vide, peser chaque portion. Le féculent, s’il est dans la même boîte, se pose à côté et non dessous : sous la sauce il devient pâteux en une nuit.', 'Laisser 1 cm de vide sous le bord : le plat gonfle au réchauffage et déborde sous l’opercule.', 'Essuyer le bord de la boîte avant d’operculer — une trace de sauce empêche la soudure et la boîte fuit.'],
    chiffres: ['⚖️ Poids de la fiche, tolérance ± 5 % · 🥄 environ un tiers de sauce pour deux tiers de morceaux, sauf indication', '📏 1 cm de vide sous le bord · 🌡 ≤ 10 °C avant fermeture, stockage ≤ 4 °C'],
    sens: ['👁 Ouvrir deux boîtes au hasard : on doit y voir le même nombre de morceaux. C’est le seul contrôle qui compte.', '👁 Une flaque d’eau claire séparée au fond dit que le plat a été mis en boîte trop chaud et a rendu son eau.', '🖐 À froid, la sauce se tient et se détache du bord en bloc souple : c’est ce qu’on attend d’un braisé, pas un défaut.'],
    fin: 'Toutes les boîtes se ressemblent, même poids, même proportion de morceaux, bord propre, aucune buée sous l’opercule.',
    erreurs: ['✗ Morceaux épuisés avant la fin des boîtes → rattraper en répartissant ce qui reste et en rééquilibrant les boîtes déjà faites, avant d’operculer. Ensuite, compter d’abord.', '✗ Sauce en gelée compacte au froid → normal pour un braisé : ne pas allonger, elle redevient liquide au réchauffage.', '✗ Gras figé en plaque blanche sur le dessus → le retirer à la cuillère : il ne se remélangera pas et le client le verra.'] };

  SAVOIR.dresser.bol = { nom: 'Une boîte composée : féculent, protéine, légumes',
    pourquoi: 'Trois composants qui n’ont ni la même eau ni le même comportement au froid, et qui vont rester 72 h côte à côte. Un féculent absorbe : posé sous une sauce ou contre un légume qui rend son eau, il l’aspire et devient pâteux — le riz double presque de volume dans une boîte mal montée. Un légume vert perd sa couleur au contact d’un acide (une vinaigrette, un jus de citron) : la chlorophylle vire au kaki en quelques heures. Et la boîte se réchauffe d’un bloc : ce qui touche le fond chauffe le plus, donc le féculent, qui est aussi ce qui supporte le mieux le micro-ondes, va dessous.',
    pas: ['Tous les éléments refroidis séparément à ≤ 10 °C avant de monter la boîte. Un élément tiède contre un élément froid fait de la condensation à l’intérieur.', 'Tare avec la boîte vide. FÉCULENT d’abord, étalé en couche régulière au fond, sur son tiers de surface — il fait le lit.', 'PROTÉINE posée dessus ou à côté, entière ou tranchée régulièrement, jamais noyée. Une pièce unique (farci, gratin, pavé) se pose de la même façon, d’un seul geste, du côté le plus régulier vers le haut.', 'LÉGUMES dans leur zone, pas mélangés aux deux autres : on doit reconnaître les trois en ouvrant.', 'SAUCE et vinaigrette à part, en pot, ou en filet au tout dernier moment si la fiche le dit. Jamais sur les légumes verts la veille.', 'Herbes fraîches, graines et fruits secs torréfiés : posés SUR le dessus, jamais dessous — ils ramollissent dans l’humidité.', 'La première boîte devient le modèle : on la garde sous les yeux jusqu’à la dernière.'],
    chiffres: ['⚖️ Les grammages de la fiche, composant par composant, ± 5 % · 🌡 ≤ 10 °C à la fermeture · 📅 3 jours'],
    sens: ['👁 En ouvrant, on nomme les trois éléments sans réfléchir. Si l’œil hésite, c’est mélangé.', '👁 Légumes verts francs : un vert terne ou kaki dit qu’ils ont attendu dans un acide ou qu’ils ont été dressés chauds.', '🖐 Le riz se détache en grains sous la fourchette, il ne fait pas bloc.'],
    fin: 'Trois zones nettes, poids juste au composant, sauce à part, dessus propre, toutes les boîtes identiques à la première.',
    erreurs: ['✗ Riz détrempé le lendemain → la sauce ou les légumes le touchaient : boîte à compartiments, ou sauce en pot.', '✗ Légumes verts ternis → dressés avec l’acide : vinaigrette à part, et légumes refroidis vite après cuisson.', '✗ Graines ramollies → elles étaient sous les légumes : sur le dessus, et en petit sachet si la fiche le permet.'] };

  SAVOIR.dresser.salade = { nom: 'Une salade en boîte : elle rend son eau, et l’acide l’attaque',
    pourquoi: 'Une salade assaisonnée est une salade qui a commencé à mourir. Le sel de la vinaigrette tire l’eau des cellules par osmose : en quelques heures, les feuilles s’affaissent, le taboulé baigne, et la vinaigrette diluée ne colle plus à rien. L’acide, lui, attaque la chlorophylle et fait virer le vert au kaki. Une salade de graines (quinoa, lentilles, millet) est plus tolérante — la graine a déjà bu — mais ses herbes fraîches et ses crudités, non. La règle est donc simple et sans exception : ce qui est acide ou salé voyage à part, et la salade se monte froide.',
    pas: ['Tous les éléments à ≤ 10 °C : une salade montée tiède fait de la buée et se ramollit en une nuit.', 'Égoutter à fond ce qui a été lavé, et ce qui a dégorgé (chou salé, concombre) : presser à la main, l’eau restante finira au fond de la boîte.', 'Tare avec la boîte. Salade ou graines au fond, sur toute la surface ; la protéine posée à CÔTÉ, jamais dessus — elle écrase et son jus coule.', 'Crudités fragiles (tomate, concombre, avocat) et herbes fraîches sur le dessus, en dernier.', 'Vinaigrette et sauce en pot à part, TOUJOURS, sauf si la fiche dit explicitement le contraire pour une salade de graines qu’on veut marinée.', 'Sur l’étiquette : « verser la sauce au moment de servir ».'],
    chiffres: ['⚖️ Grammages de la fiche, ± 5 % · 🌡 ≤ 10 °C au montage, ≤ 4 °C au stockage · 📅 3 jours', '🥄 30–40 g de vinaigrette par portion, en pot, sauf indication'],
    sens: ['👁 Aucun liquide libre au fond de la boîte. S’il y en a, quelque chose n’était pas égoutté.', '👁 Le vert est franc ; un vert olive ou kaki dit que l’acide a agi.', '🖐 Les feuilles sont encore fermes et bruissent ; molles, elles ont été salées trop tôt.'],
    fin: 'Deux zones nettes, rien de mouillé au fond, herbes intactes sur le dessus, sauce en pot, étiquette qui le dit.',
    erreurs: ['✗ Flaque au fond → refaire la boîte avec de la salade égouttée ; celle-ci ne se rattrape pas, elle continuera de rendre de l’eau.', '✗ Vinaigrette déjà versée → la boîte est perdue pour 72 h de conservation : la sortir du lot et la consommer le jour même.', '✗ Herbes noircies → hachées trop tôt et mouillées : hacher au dernier moment, sur des feuilles sèches.'] };

  SAVOIR.dresser.soupe = { nom: 'Verser une soupe : le niveau, et ce qui ne va pas dedans',
    pourquoi: 'Un liquide se dilate en gelant et gonfle en chauffant : une boîte remplie à ras déborde sous l’opercule au réchauffage, et fait sauter le couvercle au congélateur. Une soupe mixée, elle, se sépare au repos — la partie légère remonte et laisse un dépôt au fond : versée sans remuer, les premières boîtes sont claires et les dernières épaisses. Et tout ce qui doit rester croquant (graines, croûtons, herbes) se ramollit en une heure dans un liquide : ça voyage à côté.',
    pas: ['Soupe refroidie à ≤ 10 °C (voir « réfrigérer · plat ») : une soupe chaude est le pire cas, c’est le plus gros volume et le moins de surface.', 'Remuer le bac à fond avant chaque série de boîtes : une soupe mixée se sépare en quelques minutes.', 'Louche calibrée ou balance, tare avec la boîte. Remplir en laissant 1,5 à 2 cm sous le bord.', 'Essuyer le bord et l’extérieur : une coulure sèche colle les boîtes entre elles et empêche l’opercule de souder.', 'Garniture (graines, herbes, crème, croûtons) en sachet ou en pot à part, jamais dedans.'],
    chiffres: ['📏 1,5 à 2 cm de vide sous le bord · ⚖️ portion de la fiche au poids, ± 5 % · 🌡 ≤ 10 °C à la fermeture, ≤ 4 °C au stockage'],
    sens: ['👁 Deux boîtes prises au hasard ont la même épaisseur et la même couleur : sinon, on n’a pas assez remué.', '👁 Aucune coulure sur le bord ni sur les côtés.'],
    fin: 'Boîtes au même niveau, même texture d’une boîte à l’autre, bords propres, garniture à part.',
    erreurs: ['✗ Boîtes qui débordent au réchauffage → remplies trop haut : 2 cm de vide.', '✗ Dernières boîtes trop épaisses → le dépôt : remuer, et rééquilibrer en reversant un peu des premières.', '✗ Opercule qui se décolle → bord gras ou mouillé : essuyer chaque boîte avant de sceller.'] };

  SAVOIR.dresser.wrap = { nom: 'Rouler et emballer un wrap, un burrito, un burger',
    pourquoi: 'Une galette de blé est une éponge : la garniture humide la traverse en quelques heures et elle se déchire à l’ouverture. On monte donc en couches, du plus sec au plus humide, avec le féculent ou la salade en barrière contre la pâte, et la sauce au centre — jamais au contact du pain. Un rouleau serré tient parce que la garniture est comprimée, pas parce qu’on a mis un pique : trop garni, il ne ferme pas ; trop lâche, il se déroule et la coupe s’effondre.',
    pas: ['Tous les éléments à ≤ 10 °C. Une garniture tiède fait de la vapeur dans le rouleau et détrempe la galette de l’intérieur.', 'Tiédir la galette 10 s à la poêle sèche ou au four : froide, elle craque en pliant. La laisser revenir à température avant de garnir.', 'Garnir sur le TIERS INFÉRIEUR, pas au centre : on laisse 4 cm libres à gauche et à droite pour les rabats, et le tiers du haut sert à fermer.', 'Ordre : élément sec (salade, riz, fromage) contre la galette → protéine → légumes → sauce AU CENTRE de la garniture.', 'Rabattre les deux côtés, puis rouler du bas vers le haut en serrant avec les pouces, la garniture repoussée vers soi à chaque tour.', 'Couper en deux EN BIAIS avec un couteau-scie, d’un seul mouvement, sans appuyer. Emballer serré dans du papier ou filmer, soudure dessous.', 'BURGER : sauce sur les deux faces internes du pain (elle l’imperméabilise), salade contre le pain du bas, steak, puis ce qui est humide ; tomate jamais au contact du pain. Le pain se transporte à part quand la fiche le permet.'],
    chiffres: ['📏 4 cm libres de chaque côté · garniture sur le tiers inférieur · ⚖️ poids de la fiche, ± 5 %', '⏱ Galette tiédie 10 s par face · 🌡 ≤ 10 °C au montage'],
    sens: ['👁 La coupe en biais montre les couches empilées, pas une bouillie : c’est le contrôle du montage.', '🖐 Le rouleau est ferme sous le doigt et ne se déroule pas quand on le lâche.', '👁 Aucune tache humide sur le papier au bout d’une heure.'],
    fin: 'Rouleau serré, coupé net en biais, couches visibles, emballage propre, soudure dessous.',
    erreurs: ['✗ Il ne ferme pas → trop garni : retirer un quart et recommencer, c’est plus rapide que de le rattraper.', '✗ Galette déchirée en roulant → elle était froide : 10 s à la poêle.', '✗ Pain détrempé le lendemain → la sauce touchait la galette : sauce au centre, élément sec contre le pain.'] };

  SAVOIR.dresser.poisson = { nom: 'Dresser un poisson : il se casse, et il ne pardonne pas la chaleur',
    pourquoi: 'La chair d’un poisson cuit tient par des feuillets très peu collés entre eux : une spatule étroite ou une pince les sépare. Et un filet chaud posé en boîte continue de cuire dans sa propre chaleur pendant plusieurs minutes — un saumon parfait à 63 °C à la sortie du four finit sec s’il est enfermé tout de suite. Il refroidit donc à découvert, à plat, avant d’être touché.',
    pas: ['Laisser le filet refroidir à découvert, à plat sur sa plaque, jusqu’à ≤ 10 °C. Ne jamais l’empiler.', 'Le soulever d’une SEULE fois, avec une spatule large qui prend tout le filet, jamais avec une pince.', 'Poser côté peau vers le bas (ou côté le plus régulier vers le haut), sur le féculent ou à côté, sans le faire glisser.', 'Le jus de cuisson ou de papillote se verse en filet dessus au dernier moment, ou se garde à part : il détrempe tout ce qu’il touche pendant 72 h.', 'Citron et herbes sur le dessus, au dressage, jamais la veille : l’acide blanchit la chair.', 'Graines, amandes ou chapelure qui recouvrent le poisson : posées en dernier, sur un filet déjà froid, jamais avant le refroidissement — elles boiraient la vapeur.'],
    chiffres: ['🌡 63 °C à cœur à la cuisson, ≤ 10 °C au dressage · ⚖️ portion de la fiche, ± 5 %'],
    sens: ['👁 Le filet est entier, ses feuillets encore serrés. Un filet qui s’ouvre en trois dit qu’on l’a pris à la pince ou qu’il était chaud.', '👁 Une chair très blanche et granuleuse sur les bords : il a été trop cuit ou enfermé chaud.'],
    fin: 'Filet entier, froid, posé d’un seul geste, jus à part, sans miettes autour.',
    erreurs: ['✗ Filet cassé en deux → le présenter en deux morceaux nets côte à côte plutôt qu’en miettes ; c’est plus honnête à l’œil.', '✗ Boîte pleine d’eau le lendemain → le jus était dedans : à part, en pot.'] };

  SAVOIR.dresser.emulsion = { nom: 'Une sauce à part : pourquoi, et combien',
    pourquoi: 'Une vinaigrette, une sauce au yaourt ou au tahini se sépare en quelques heures au froid — l’huile remonte, l’eau descend. Ce n’est pas un défaut, c’est ce que fait une émulsion qu’on laisse reposer : elle se remonte d’un coup de cuillère. Mais versée sur des légumes la veille, elle fait deux dégâts irréversibles : son acide ternit les verts, et son sel les fait rendre leur eau, ce qui dilue la sauce et noie la boîte.',
    pas: ['Sauce refroidie, remuée juste avant de doser.', 'Pot individuel, rempli à 80 % (elle prend du volume en se figeant si elle contient du yaourt).', 'Doser à la cuillère ou à la pipette, jamais à l’œil : c’est du gras, donc des calories que le client compte.', 'Pot fermé, posé DANS la boîte ou scellé à part selon le conditionnement. Étiqueter s’il contient un allergène (moutarde, sésame, lait).', 'Sur l’étiquette ou dans la boîte : « à verser au moment de servir ».'],
    chiffres: ['⚖️ Le grammage de la fiche, à la cuillère · 🥄 30 à 40 g par portion pour une vinaigrette, 50 à 60 g pour une sauce yaourt, sauf indication', '🌡 ≤ 4 °C · 📅 même DLC que le plat'],
    sens: ['👁 Une sauce séparée dans le pot est normale ; une sauce tranchée en grains (le yaourt a caillé) ne l’est pas et se refait.'],
    fin: 'Pot dosé au poids, fermé, étiqueté si allergène, jamais versé sur le plat.',
    erreurs: ['✗ Sauce déjà versée sur les légumes → la boîte se refait : les légumes ont commencé à rendre leur eau.', '✗ Pot rempli à ras → il déborde à l’ouverture : 80 %.'] };

  /* ── Choisir le cours d'une étape ────────────────────────────────────────
     La famille de l'aliment d'abord, le repli du geste sinon. Une étape
     d'assemblage (dresser) n'a pas d'aliment : le repli sert. */
  /* `aliment` peut être une LISTE de candidats, du plus parlant au moins
     parlant : le premier dont la famille a un cours pour ce geste gagne.
     ⚠️ Pour mélanger, assaisonner et mixer, c'est le TITRE de l'étape qui dit
     l'intention (« Mouiller », « Singer », « Farce », « Salade de chou ») —
     pas l'ingrédient qu'on y met. Depuis que 1 ingrédient = 1 étape, choisir
     sur l'ingrédient donnait « salsa de tomates » pour la courgette d'une
     soupe qu'on mouille. L'appelant passe donc [titre, aliment de la fiche,
     ingrédient] pour ces gestes, et [ingrédient, titre] pour les autres. */
  /* ⚠️ L'AIGUILLAGE DU GESTE PASSE AVANT LES FAMILLES, et il n'existe que
     là où le geste ne porte pas sur un ingrédient mais sur le plat entier
     (dresser). Il lit la chaîne ENTIÈRE de chaque candidat, du plus spécifique
     au plus général, et rend une clé de SAVOIR[geste] — voir l'encadré de
     `SAVOIR.dresser._aiguillage`. Sans lui, la famille du premier mot reconnu
     décidait : « bourguignon + pommes de terre » recevait le cours du bol
     composé, et un wrap celui d'un plat en sauce. */
  function aiguiller(G, cands) {
    if (!G._aiguillage) return null;
    var cle = null;
    G._aiguillage.some(function (e) {
      var ok = cands.some(function (a) {
        var t = ' ' + norm(a).split(' ').map(sing).join(' ') + ' ';
        return e[1].some(function (k) { return t.indexOf(' ' + norm(k).split(' ').map(sing).join(' ')) >= 0; });
      });
      if (ok && G[e[0]]) { cle = e[0]; return true; }
      return false;
    });
    return cle || (G[G._defaut || 'bol'] ? (G._defaut || 'bol') : null);
  }

  function pour(geste, aliment) {
    var G = SAVOIR[geste]; if (!G) return null;
    var cands = (Array.isArray(aliment) ? aliment : [aliment]).filter(Boolean), f = null;
    f = aiguiller(G, cands);
    if (!f) cands.some(function (a) { var x = famille(a); if (x && G[x]) { f = x; return true; } return false; });
    var e = (f && G[f]) || G._ || null;
    return e ? { geste: geste, famille: f, cours: e } : null;
  }

  /* ── Le HTML du cours ────────────────────────────────────────────────────
     Six blocs, dans l'ordre où on en a besoin devant la plaque : pourquoi
     (on comprend), pas à pas (on fait), les chiffres (on règle), ce qu'on
     doit percevoir (on contrôle), réussi quand (on décide), erreurs (on
     rattrape). Les classes vivent sous #npCine, dans admin-production.js. */
  function html(geste, aliment) {
    var p = pour(geste, aliment); if (!p) return '';
    var c = p.cours, out = '';
    out += '<div class="sec">Le cours de l’étape <small>— savoir général du geste' + (p.famille ? ' sur cet aliment' : '') + ', la fiche prime</small></div>';
    out += '<div class="cours"><div class="titre">' + h(c.nom) + '</div>';
    if (c.pourquoi) out += '<div class="bloc"><b>🧪 Ce qui se passe, et pourquoi on fait comme ça</b><p>' + h(c.pourquoi) + '</p></div>';
    if (c.pas && c.pas.length) out += '<div class="bloc"><b>👣 Pas à pas</b><ol>' + c.pas.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ol></div>';
    if (c.chiffres && c.chiffres.length) out += '<div class="bloc"><b>📐 Les chiffres — température, eau, temps</b><ul>' + c.chiffres.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul></div>';
    if (c.sens && c.sens.length) out += '<div class="bloc"><b>👁 Ce que vous devez voir, entendre, sentir</b><ul>' + c.sens.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul></div>';
    if (c.fin) out += '<div class="bloc ok"><b>🏁 C’est réussi quand</b><p>' + h(c.fin) + '</p></div>';
    if (c.erreurs && c.erreurs.length) out += '<div class="bloc err"><b>⚠️ Si ça tourne mal</b><ul>' + c.erreurs.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul></div>';
    return out + '</div>';
  }

  /* La feuille du cours : posée par admin-production.js dans la sienne
     (même écran, même fond noir), exposée ici pour qu'elle vive à côté du
     contenu qu'elle habille. */
  var CSS = [
    '#npCine .cours{background:#ffffff0f;border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:12px}',
    '#npCine .cours .titre{font-size:17px;font-weight:800;letter-spacing:-.2px;color:#fff}',
    '#npCine .cours .bloc{background:#ffffff0a;border-radius:12px;padding:10px 12px}',
    '#npCine .cours .bloc b{display:block;font-size:11px;color:#ffffff8c;margin-bottom:6px;text-transform:uppercase;letter-spacing:.6px}',
    '#npCine .cours p{margin:0;font-size:14px;line-height:1.55;color:#ffffffd9}',
    '#npCine .cours ol,#npCine .cours ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}',
    '#npCine .cours li{font-size:14px;line-height:1.5;color:#ffffffd9}',
    '#npCine .cours ol li::marker{color:#fff;font-weight:800}',
    '#npCine .cours .bloc.ok{background:#34c75922}#npCine .cours .bloc.ok b{color:#34c759}',
    '#npCine .cours .bloc.err{background:#ff7b6b1f}#npCine .cours .bloc.err b{color:#ff9f93}'
  ].join('');

  window.NattySavoir = { SAVOIR: SAVOIR, FAMILLES: FAMILLES, famille: famille, pour: pour, html: html, CSS: CSS };
})();
