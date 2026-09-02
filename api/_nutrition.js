// ═══════════════════════════════════════════════════════════
// Natty — Table nutritionnelle côté serveur
// ───────────────────────────────────────────────────────────
// ⚠️ COPIE MÉCANIQUE de la table `NT` d'assets/core.js, ET de son appariement.
// Le serveur ne peut pas importer core.js (script navigateur, IIFE globale).
//
// SI core.js CHANGE, UNE SEULE COMMANDE :
//     node scripts/gen-nutrition.mjs
// Elle recopie la table ET compare les deux `getNutri` sur les pièges connus.
// L'ancienne consigne demandait de recoller le littéral à la main depuis un
// bout de Python en commentaire — c'est exactement la manœuvre qui a laissé
// les deux tables diverger (voir plus bas). `--verif` contrôle sans réécrire.
//
// ⚠️ Seule la TABLE est régénérée. `getNutri` et `normNom` restent écrits des
// deux côtés : ce sont des fonctions, elles se relisent. Le script les compare
// sur 37 cas × 2 quantités et sort en erreur au moindre écart.
//
// ⚠️ CETTE COPIE A DÉJÀ DIVERGÉ, ET C'ÉTAIT UN BUG EN PRODUCTION. Elle portait
// la table de ~60 aliments et l'ancien appariement par sous-chaîne
// premier-déclaré-gagnant, alors que core.js était passé à 230 aliments et au
// rapprochement mot à mot plus-long-libellé-gagnant : « pomme de terre »
// tombait sur « pomme » (52 kcal au lieu de 77), « ail » se trouvait dans
// « volaille », le saucisson n'existait pas. **Le rappel du soir annonçait
// d'autres grammes que l'écran** — et c'est l'app qui avait l'air d'avoir tort.
// Une copie mécanique ne se signale jamais elle-même quand la source bouge.
//
// `daily_macros` ne peut pas servir de source : suivi.html n'y écrit QUE la
// journée de la veille, au premier lancement du lendemain (`resetIfNewDay`).
// Les totaux du jour ne vivent que dans le localStorage de l'appareil.
// ═══════════════════════════════════════════════════════════

const NT = {
  // Viandes, volailles, charcuterie
  'poulet':{c:165,p:31,l:3.6,g:0},'dinde':{c:135,p:29,l:1,g:0},'boeuf':{c:250,p:26,l:15,g:0},
  'steak':{c:250,p:26,l:15,g:0},'veau':{c:172,p:31,l:4.6,g:0},'canard':{c:337,p:19,l:28,g:0},
  'agneau':{c:282,p:25,l:20,g:0},'porc':{c:242,p:27,l:14,g:0},'lardons':{c:337,p:18,l:29,g:0},
  'jambon':{c:145,p:21,l:6,g:1},'jambon cru':{c:241,p:27,l:15,g:0.5},
  'saucisson':{c:410,p:24,l:35,g:2},'chorizo':{c:455,p:24,l:38,g:2},
  'saucisse':{c:300,p:15,l:26,g:2},'merguez':{c:310,p:16,l:27,g:1},
  'bacon':{c:541,p:37,l:42,g:1.4},'rillettes':{c:400,p:16,l:37,g:0},
  'pate':{c:320,p:14,l:28,g:2},'boudin':{c:379,p:15,l:35,g:1},
  'viande hachee':{c:250,p:26,l:15,g:0},'escalope':{c:135,p:29,l:1,g:0},
  'nuggets':{c:296,p:15,l:19,g:16},'cordon bleu':{c:250,p:16,l:14,g:15},
  // Poissons et fruits de mer
  'saumon':{c:208,p:20,l:13,g:0},'thon':{c:132,p:28,l:1,g:0},'cabillaud':{c:82,p:18,l:0.7,g:0},
  'colin':{c:82,p:18,l:0.7,g:0},'lieu':{c:82,p:18,l:0.7,g:0},'merlu':{c:82,p:18,l:0.7,g:0},
  'truite':{c:148,p:21,l:7,g:0},'maquereau':{c:205,p:19,l:14,g:0},'sardines':{c:208,p:25,l:11,g:0},
  'anchois':{c:210,p:29,l:10,g:0},'hareng':{c:158,p:18,l:9,g:0},'dorade':{c:96,p:20,l:1.5,g:0},
  'crevettes':{c:99,p:21,l:1.1,g:0},'moules':{c:86,p:12,l:2.2,g:3.7},'calamar':{c:92,p:16,l:1.4,g:3},
  'surimi':{c:99,p:8,l:1,g:14},'saumon fume':{c:180,p:23,l:9,g:0},
  // Oeufs, tofu, legumineuses
  'oeuf':{c:155,p:13,l:11,g:1.1},'oeufs':{c:155,p:13,l:11,g:1.1},'omelette':{c:154,p:11,l:12,g:1},
  'tofu':{c:76,p:8,l:4.2,g:1.9},'tempeh':{c:195,p:19,l:11,g:9.4},'seitan':{c:141,p:25,l:2,g:4},
  'lentilles':{c:116,p:9,l:0.4,g:20},'pois chiches':{c:164,p:9,l:2.6,g:27},
  'haricots':{c:127,p:9,l:0.5,g:23},'haricots rouges':{c:127,p:9,l:0.5,g:23},
  'flageolets':{c:120,p:8,l:0.5,g:21},'edamame':{c:122,p:11,l:5.2,g:9.9},
  'houmous':{c:166,p:8,l:10,g:14},'falafel':{c:333,p:13,l:18,g:32},
  // Feculents, cereales, pains
  'riz':{c:130,p:2.7,l:0.3,g:28},'riz complet':{c:123,p:2.7,l:1,g:26},
  'pates':{c:131,p:5,l:1.1,g:25},'spaghetti':{c:131,p:5,l:1.1,g:25},'lasagne':{c:135,p:6,l:5,g:16},
  'quinoa':{c:120,p:4.4,l:1.9,g:22},'semoule':{c:112,p:4,l:0.2,g:23},'couscous':{c:112,p:4,l:0.2,g:23},
  'boulgour':{c:83,p:3,l:0.2,g:18},'sarrasin':{c:92,p:3.4,l:0.6,g:20},'polenta':{c:83,p:2,l:0.5,g:18},
  'pain':{c:265,p:9,l:3.2,g:49},'pain complet':{c:247,p:10,l:3.4,g:41},
  'pain de mie':{c:265,p:8,l:4,g:48},'baguette':{c:274,p:9,l:1.3,g:56},
  'biscotte':{c:390,p:12,l:5,g:73},'tortilla':{c:310,p:8,l:8,g:51},'wrap':{c:310,p:8,l:8,g:51},
  /* ⚠️ « pâte brisée » et « pâte feuilletée » DOIVENT être des clés à deux
     mots. Sans elles, elles tombaient sur `pate` — c'est-à-dire LE PÂTÉ DE
     CAMPAGNE : une quiche comptait 320 kcal et 2 g de glucides pour 100 g de
     pâte, au lieu de 350 kcal et 40 g. Même famille que « pomme de terre »
     comptée en pomme (§7), et le libellé le plus long gagne. */
  'pate brisee':{c:352,p:5,l:20,g:38},'pate feuilletee':{c:406,p:6,l:26,g:37},
  'pate a pizza':{c:270,p:8,l:3,g:51},'pate a tarte':{c:352,p:5,l:20,g:38},
  'farine':{c:364,p:10,l:1,g:76},'chapelure':{c:395,p:13,l:5,g:72},
  'pomme de terre':{c:77,p:2,l:0.1,g:17},'patate douce':{c:86,p:1.6,l:0.1,g:20},
  'frites':{c:312,p:3.4,l:15,g:41},'puree':{c:83,p:2,l:2.5,g:13},'gnocchi':{c:160,p:4,l:1,g:33},
  'avoine':{c:389,p:17,l:7,g:66},'flocons avoine':{c:389,p:17,l:7,g:66},
  'muesli':{c:375,p:10,l:9,g:62},'cereales':{c:380,p:8,l:4,g:78},
  'granola':{c:471,p:10,l:20,g:64},
  'mais':{c:96,p:3.4,l:1.5,g:21},'petits pois':{c:81,p:5,l:0.4,g:14},
  // Plats et snacks courants
  'pizza':{c:266,p:11,l:10,g:33},'burger':{c:250,p:13,l:12,g:22},'kebab':{c:215,p:16,l:11,g:14},
  'quiche':{c:270,p:9,l:18,g:18},'sandwich':{c:230,p:10,l:9,g:27},'croque':{c:280,p:15,l:16,g:20},
  'sushi':{c:150,p:6,l:2,g:28},'soupe':{c:40,p:1.5,l:1.5,g:6},'ratatouille':{c:60,p:1.3,l:3.5,g:6},
  'chips':{c:536,p:6,l:34,g:53},'biscuit':{c:450,p:6,l:18,g:66},'chocolat':{c:546,p:5,l:31,g:61},
  'barre cereale':{c:400,p:7,l:13,g:64},'cookie':{c:470,p:5,l:22,g:63},
  // Legumes
  'brocoli':{c:34,p:2.8,l:0.4,g:7},'epinards':{c:23,p:2.9,l:0.4,g:3.6},'courgette':{c:17,p:1.2,l:0.3,g:3.1},
  'tomate':{c:18,p:0.9,l:0.2,g:3.9},'carotte':{c:41,p:0.9,l:0.2,g:10},'poivron':{c:31,p:1,l:0.3,g:6},
  'salade':{c:15,p:1.4,l:0.2,g:2.9},'laitue':{c:15,p:1.4,l:0.2,g:2.9},'roquette':{c:25,p:2.6,l:0.7,g:3.7},
  'concombre':{c:15,p:0.7,l:0.1,g:3.6},'haricots verts':{c:31,p:1.8,l:0.2,g:7},
  'chou':{c:25,p:1.3,l:0.1,g:6},'chou fleur':{c:25,p:1.9,l:0.3,g:5},'poireau':{c:61,p:1.5,l:0.3,g:14},
  'aubergine':{c:25,p:1,l:0.2,g:6},'champignons':{c:22,p:3.1,l:0.3,g:3.3},
  'oignon':{c:40,p:1.1,l:0.1,g:9},'ail':{c:149,p:6.4,l:0.5,g:33},'betterave':{c:43,p:1.6,l:0.2,g:10},
  'potiron':{c:26,p:1,l:0.1,g:7},'asperge':{c:20,p:2.2,l:0.1,g:3.9},'endive':{c:17,p:0.9,l:0.1,g:3.4},
  'avocat':{c:160,p:2,l:15,g:9},'olive':{c:145,p:1,l:15,g:4},
  // Fruits
  'pomme':{c:52,p:0.3,l:0.2,g:14},'banane':{c:89,p:1.1,l:0.3,g:23},'fraise':{c:32,p:0.7,l:0.3,g:7.7},
  'orange':{c:47,p:0.9,l:0.1,g:12},'mangue':{c:60,p:0.8,l:0.4,g:15},'kiwi':{c:61,p:1.1,l:0.5,g:15},
  'raisin':{c:69,p:0.7,l:0.2,g:18},'poire':{c:57,p:0.4,l:0.1,g:15},'peche':{c:39,p:0.9,l:0.3,g:10},
  'ananas':{c:50,p:0.5,l:0.1,g:13},'myrtille':{c:57,p:0.7,l:0.3,g:14},'framboise':{c:52,p:1.2,l:0.7,g:12},
  'citron':{c:29,p:1.1,l:0.3,g:9},'pasteque':{c:30,p:0.6,l:0.2,g:8},'melon':{c:34,p:0.8,l:0.2,g:8},
  'datte':{c:282,p:2.5,l:0.4,g:75},'abricot sec':{c:241,p:3.4,l:0.5,g:63},
  // Produits laitiers
  'yaourt':{c:59,p:3.5,l:3.3,g:4.7},'skyr':{c:63,p:11,l:0.2,g:4},'fromage blanc':{c:79,p:8,l:4,g:3.5},
  'petit suisse':{c:97,p:9,l:5,g:3},'cottage':{c:98,p:11,l:4.3,g:3.4},
  'feta':{c:264,p:14,l:21,g:4},'mozzarella':{c:280,p:18,l:22,g:2.2},'parmesan':{c:431,p:38,l:29,g:4},
  'comte':{c:417,p:27,l:34,g:1.5},'emmental':{c:380,p:28,l:29,g:1},'gruyere':{c:413,p:30,l:32,g:0.4},
  'chevre':{c:364,p:22,l:30,g:2.5},'camembert':{c:300,p:20,l:24,g:0.5},'roquefort':{c:369,p:22,l:31,g:2},
  'raclette':{c:357,p:23,l:29,g:1},'creme fraiche':{c:292,p:2.4,l:30,g:3},
  /* `creme` seule vaut la crème fraîche : c'est ce que les gens écrivent, et
     la clé à deux mots continue de gagner quand elle est écrite en entier. */
  'creme':{c:292,p:2.4,l:30,g:3},'creme liquide':{c:300,p:2.4,l:31,g:3},
  'cheddar':{c:402,p:25,l:33,g:1.3},'gouda':{c:356,p:25,l:27,g:2.2},
  'lait':{c:61,p:3.2,l:3.3,g:4.8},'lait vegetal':{c:35,p:1,l:1.5,g:3.5},
  /* ⚠️ LE LAIT DE COCO DE LA BOÎTE — celui des currys, des dahls et des
     moquecas. Il n'avait aucune clé : il tombait sur `lait` et valait 61 kcal,
     le prix d'un lait de vache. Un curry pour quatre s'en trouvait sous-compté
     de plus de 400 kcal. La boisson à la coco du rayon frais, elle, a sa
     propre clé en deux mots — donc elle gagne quand on l'écrit en entier. */
  'lait de coco':{c:185,p:1.8,l:19,g:2.8},'creme de coco':{c:330,p:3.3,l:35,g:3},
  'boisson coco':{c:39,p:0.2,l:0.9,g:7.4},'coco':{c:354,p:3.3,l:33,g:15},
  'beurre':{c:717,p:0.9,l:81,g:0.1},'mascarpone':{c:429,p:4.8,l:44,g:4},
  // Matieres grasses, oleagineux, condiments
  'huile olive':{c:884,p:0,l:100,g:0},'huile':{c:884,p:0,l:100,g:0},
  'noix':{c:654,p:15,l:65,g:14},'amandes':{c:579,p:21,l:50,g:22},'noisette':{c:628,p:15,l:61,g:17},
  'cajou':{c:553,p:18,l:44,g:30},'pistache':{c:560,p:20,l:45,g:28},'cacahuete':{c:567,p:26,l:49,g:16},
  'graines':{c:559,p:19,l:49,g:20},'graines courge':{c:559,p:30,l:49,g:11},'chia':{c:486,p:17,l:31,g:42},
  'tahini':{c:595,p:17,l:54,g:21},'beurre cacahuete':{c:588,p:25,l:50,g:20},
  'mayonnaise':{c:680,p:1,l:75,g:1.5},'ketchup':{c:112,p:1.2,l:0.1,g:26},'moutarde':{c:66,p:4,l:3.3,g:5},
  'vinaigrette':{c:450,p:0.5,l:48,g:3},'sauce tomate':{c:32,p:1.3,l:0.4,g:6},
  'miel':{c:304,p:0.3,l:0,g:82},'sucre':{c:400,p:0,l:0,g:100},'confiture':{c:278,p:0.4,l:0.1,g:69},
  // Boissons
  'jus orange':{c:45,p:0.7,l:0.2,g:10},'soda':{c:42,p:0,l:0,g:10.6},'biere':{c:43,p:0.5,l:0,g:3.6},
  'vin':{c:83,p:0.1,l:0,g:2.6},'cafe':{c:2,p:0.1,l:0,g:0},'the':{c:1,p:0,l:0,g:0},
  'jus':{c:45,p:0.5,l:0.1,g:11},'eau':{c:0,p:0,l:0,g:0},
  'ricore':{c:60,p:2.5,l:1.5,g:9},   // tel qu'on le boit, au lait demi-écrémé
  /* ── Ajouts du relevé du 2026-08-05 ─────────────────────────────
     Les 89 lignes que la table ne savait pas chiffrer, sur 256 réelles. Ce
     bloc et les deux passes de `getNutri` viennent de là — ce ne sont pas des
     aliments choisis au hasard, ce sont ceux réellement saisis. */
  // Herbes et aromates. Presque rien au gramme, mais ils sont TOUJOURS saisis
  // en petite quantité : les compter juste vaut mieux que de ne pas les
  // compter, et surtout mieux que de rendre tout le repas non chiffrable.
  'persil':{c:36,p:3,l:0.8,g:6},'basilic':{c:23,p:3.2,l:0.6,g:2.7},
  'coriandre':{c:23,p:2.1,l:0.5,g:3.7},'ciboulette':{c:30,p:3.3,l:0.7,g:4.4},
  'aneth':{c:43,p:3.5,l:1.1,g:7},'menthe':{c:44,p:3.8,l:0.7,g:8},
  'gingembre':{c:80,p:1.8,l:0.8,g:18},'curry':{c:325,p:14,l:14,g:58},
  'epices':{c:300,p:11,l:10,g:50},'poivre':{c:251,p:10,l:3.3,g:64},
  'sel':{c:0,p:0,l:0,g:0},'assaisonnement':{c:0,p:0,l:0,g:0},
  // Légumes qui manquaient
  'patate':{c:77,p:2,l:0.1,g:17},'mange tout':{c:42,p:2.8,l:0.2,g:7.5},
  'pois gourmands':{c:42,p:2.8,l:0.2,g:7.5},'daurade':{c:96,p:20,l:1.5,g:0},
  // Sauces, plats et desserts nommés sans plus de précision
  'sauce soja':{c:53,p:8,l:0.1,g:5},'teriyaki':{c:89,p:1.5,l:0,g:20},
  'bolognaise':{c:130,p:8,l:7,g:8},'bouillon':{c:8,p:1,l:0.3,g:0.5},
  'potage':{c:40,p:1.5,l:1.5,g:6},'nouilles':{c:138,p:4.5,l:0.7,g:25},
  'ramen':{c:138,p:4.5,l:0.7,g:25},'crepe':{c:190,p:6,l:8,g:23},
  'crumble':{c:350,p:4,l:16,g:48},'gateau':{c:380,p:5,l:18,g:50},
  'creme patissiere':{c:160,p:4,l:6,g:22},'glace':{c:207,p:3.5,l:11,g:24},
  'bifteck':{c:250,p:26,l:15,g:0},
  /* Libellés VOLONTAIREMENT génériques (« Fromage », « Légumes », « Viande »,
     « Sauce », « 1 fruit »). Ce sont des moyennes, et une moyenne est
     critiquable — mais l'alternative n'est pas « mieux », c'est **zéro**, ce
     qui est faux à coup sûr. Un libellé plus précis gagne toujours, la
     correspondance prenant le plus long : « fromage blanc » (2 mots) passe
     avant « fromage », « viande blanche » avant « viande ». */
  'fromage':{c:350,p:23,l:28,g:1.5},'legumes':{c:35,p:2,l:0.4,g:6},
  'viande':{c:230,p:25,l:14,g:0},'viande blanche':{c:135,p:29,l:1,g:0},
  'poisson':{c:120,p:22,l:3,g:0},'sauce':{c:90,p:1.5,l:6,g:6},
  'fruit':{c:60,p:0.8,l:0.3,g:14},
  /* Fautes de frappe relevées en base. Ce ne sont pas des devinettes : chacune
     est phonétiquement sans ambiguïté dans un contexte alimentaire. Les noms
     vraiment indéchiffrables (« Marcos en boîte », « a ») restent NON
     reconnus — mieux vaut un manque visible qu'un chiffre inventé. */
  'steack':{c:250,p:26,l:15,g:0},'amendes':{c:579,p:21,l:50,g:22},
  'basilique':{c:23,p:3.2,l:0.6,g:2.7},'pouivron':{c:31,p:1,l:0.3,g:6},
  'teriaki':{c:89,p:1.5,l:0,g:20},
  'petits poids':{c:81,p:5,l:0.4,g:14},'poids chiche':{c:164,p:9,l:2.6,g:27},
  /* ── Compléments et nutrition sportive ─────────────────────────
     Ils manquaient entièrement, et c'est le pire cas possible pour cette
     table : une dose de whey, c'est ~24 g de protéines — soit un quart de la
     cible d'une journée — et elle comptait pour **zéro**. Quelqu'un qui
     prend deux shakers voyait donc ses anneaux stagner en ayant bien mangé.
     Valeurs pour 100 g de poudre (étiquetage usuel), pas par dose : la dose
     est une affaire d'unité de saisie, et elle vit dans `assets/unites.js`.

     ⚠️ AUCUNE CLÉ « proteine » TOUTE SEULE, et c'est délibéré. Le libellé le
     plus long gagnant, « Poulet riche en protéines » serait tombé sur elle et
     aurait compté 400 kcal aux 100 g. Les clés restent donc composées.
     ⚠️ Et les deux orthographes de « protéiné(e) » : la seconde passe ne
     singularise que les `s`/`x` finaux, donc « barre proteine » ne rattrape
     PAS « barre protéinée ». Vérifié — l'une sans l'autre laisse la moitié
     des saisies non reconnues. */
  'whey':{c:400,p:80,l:7,g:6},'proteine en poudre':{c:400,p:80,l:7,g:6},
  'poudre proteine':{c:400,p:80,l:7,g:6},'poudre proteinee':{c:400,p:80,l:7,g:6},
  'isolat':{c:373,p:90,l:1,g:2},'caseine':{c:370,p:80,l:2,g:8},
  'collagene':{c:360,p:90,l:0,g:0},'proteine vegetale':{c:380,p:75,l:6,g:8},
  'gainer':{c:380,p:20,l:4,g:65},'maltodextrine':{c:380,p:0,l:0,g:95},
  'creatine':{c:0,p:0,l:0,g:0},'bcaa':{c:400,p:100,l:0,g:0},
  'acides amines':{c:400,p:100,l:0,g:0},'glutamine':{c:400,p:100,l:0,g:0},
  'barre proteinee':{c:370,p:32,l:12,g:33},'barre proteine':{c:370,p:32,l:12,g:33},
  'boisson proteinee':{c:47,p:10,l:0.5,g:1},'boisson proteine':{c:47,p:10,l:0.5,g:1},
  'shaker proteine':{c:47,p:10,l:0.5,g:1},
  'gel energetique':{c:250,p:0,l:0,g:62},'boisson isotonique':{c:26,p:0,l:0,g:6.4},
  'spiruline':{c:290,p:57,l:8,g:24},'levure de biere':{c:325,p:42,l:6,g:19},
  'omega 3':{c:900,p:0,l:100,g:0},'huile de poisson':{c:900,p:0,l:100,g:0},
  /* ⚠️ LES POTS SONT ÉTIQUETÉS EN ANGLAIS, et c'est ce qui se tape. Relevé au
     banc sur des libellés réels : « Isolate vanille » et « Protein powder »
     n'étaient PAS reconnus — donc zéro protéine sur la source la plus
     concentrée qui soit. « Whey protein » passait déjà, mais par `whey`
     seulement, ce qui est un hasard heureux et non une règle.
     ⚠️ Toujours pas de clé `protein` seule, pour la raison donnée plus haut :
     elle happerait n'importe quel aliment « riche en protein(e)s ». */
  'isolate':{c:373,p:90,l:1,g:2},'protein powder':{c:400,p:80,l:7,g:6},
  /* Un pré-workout est édulcoré : sans calories, comme la créatine. Le chiffre
     n'est pas inventé, il est lu sur l'étiquette — mais il vaut mieux le dire
     ici, parce qu'un 0 ressemble toujours à un oubli. */
  'pre workout':{c:0,p:0,l:0,g:0},'preworkout':{c:0,p:0,l:0,g:0},
  /* Le blanc et le jaune, séparés. « Blanc d'œuf » tombait sur `oeuf` et
     comptait 143 kcal au lieu de 52 — presque trois fois trop — alors que
     c'est justement l'aliment qu'on prend POUR ses protéines sans le reste.
     ⚠️ Clé en deux mots : elle exige `blanc` ET `oeuf`, donc « blanc de
     poulet » ne peut pas l'attraper, et elle bat `oeuf` seul (plus de mots). */
  'blanc oeuf':{c:52,p:10.9,l:0.2,g:0.7},'jaune oeuf':{c:322,p:16,l:27,g:3.6}
}
/* ⚠️ APPARIEMENT IDENTIQUE À core.js, au caractère près. Un appariement
   différent d'un côté ou de l'autre donnerait des grammes différents de ceux
   affichés à l'écran.

   Deux points qui ont chacun coûté des lignes non chiffrées, mesurés sur les
   256 lignes réelles de la base le 2026-08-05 :
   • les ligatures `œ`/`æ` ne sont PAS des accents — `normalize('NFD')` ne les
     décompose pas — donc « bœuf » devenait « b uf » et « Œufs » « ufs » :
     aucun œuf, aucun bœuf n'avait jamais été reconnu (7 lignes) ;
   • singulier/pluriel : la table dit « courgette », la base dit
     « Courgettes ». D'où une SECONDE passe, et seulement une seconde — voir
     `getNutri`. */

function normNom(s) {
  return ' ' + String(s || '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
}

/* Singulier approché, appliqué DES DEUX CÔTÉS : « ananas » → « anana » de part
   et d'autre, le mot compte moins que la symétrie. Pas sous 4 lettres, pour ne
   pas manger « riz », « jus » ou « the ». */
function sing(m) {
  return (m.length > 3 && (m.slice(-1) === 's' || m.slice(-1) === 'x')) ? m.slice(0, -1) : m;
}

const NT_CLES = Object.keys(NT)
  .map(k => { const mots = normNom(k).trim().split(' '); return { k, mots, motsS: mots.map(sing) }; })
  .sort((a, b) => b.mots.length - a.mots.length || b.k.length - a.k.length);

/* ⚠️ Les libellés qui l'emportent sur tout le reste du nom — copie de `FORTS`
   d'assets/core.js, et pour la même raison : « Whey isolate chocolat » était
   compté comme du CHOCOLAT (546 kcal, 5 g de protéines pour une dose qui en
   apporte 90). Sans cette passe ici, le rappel du soir annoncerait d'autres
   grammes que l'écran — la divergence exacte contre laquelle l'en-tête met
   en garde. */
const FORTS = ['whey', 'isolat', 'caseine', 'collagene', 'gainer', 'maltodextrine',
  'creatine', 'bcaa', 'acides amines', 'glutamine', 'spiruline', 'levure de biere',
  'proteine en poudre', 'poudre proteine', 'poudre proteinee', 'proteine vegetale',
  'barre proteinee', 'barre proteine', 'boisson proteinee', 'boisson proteine',
  'shaker proteine', 'gel energetique', 'boisson isotonique', 'omega 3',
  'huile de poisson', 'isolate', 'protein powder', 'pre workout', 'preworkout'];
const NT_FORTS = NT_CLES.filter(x => FORTS.indexOf(x.k) > -1);

function tousPresents(mots, n) {
  return mots.every(m => n.indexOf(' ' + m + ' ') > -1);
}

function r1(v) { return Math.round(v * 10) / 10; }

/* ⚠️ DEUX PASSES, ET L'ORDRE EST TOUT L'INTÉRÊT. La première est mot à mot
   exact. La seconde, au singulier, ne sert qu'à trouver PLUS PRÉCIS : une clé
   de strictement plus de mots que celle déjà retenue.

   Collapser en UNE passe serait une régression : « pates » et « pate » (le
   pâté, 320 kcal) se réduisent au même mot, et le plus long libellé gagnant, un
   pâté de campagne serait compté comme des pâtes à 131 kcal. Le seuil « plus de
   mots » l'évite : « pate de campagne » est résolu exactement, et rien d'un
   seul mot ne repasse devant.

   ⚠️ Et la seconde ne peut plus être court-circuitée : c'est ce qui comptait
   « blancs d'œufs » (pluriel) comme des œufs entiers — la clé « oeufs » d'un
   seul mot correspondait exactement, la passe s'arrêtait là, et « blanc
   d'oeuf » (trois mots) n'était jamais essayée. 155 kcal au lieu de 52.
   Même correctif dans `assets/core.js`, dont ce fichier est la copie. */
export function getNutri(name, qty) {
  const n = normNom(name);
  let t = null;
  const nF = ' ' + n.trim().split(' ').map(sing).join(' ') + ' ';
  for (const e of NT_FORTS) {
    if (tousPresents(e.mots, n) || tousPresents(e.motsS, nF)) { t = NT[e.k]; break; }
  }
  if (t) {
    const f0 = (parseFloat(qty) || 0) / 100;
    return { c: Math.round(t.c * f0), p: r1(t.p * f0), l: r1(t.l * f0), g: r1(t.g * f0) };
  }
  let motsExacts = 0;
  for (const e of NT_CLES) { if (tousPresents(e.mots, n)) { t = NT[e.k]; motsExacts = e.mots.length; break; } }
  // NT_CLES est trié par nombre de mots décroissant : dès qu'on descend au
  // niveau de la clé déjà retenue, il n'y a plus rien de plus précis.
  const nS = ' ' + n.trim().split(' ').map(sing).join(' ') + ' ';
  for (const e of NT_CLES) {
    if (e.motsS.length <= motsExacts) break;
    if (tousPresents(e.motsS, nS)) { t = NT[e.k]; break; }
  }
  if (!t) return null;
  const f = (parseFloat(qty) || 0) / 100;
  // Arrondi PAR INGRÉDIENT, comme core.js : sommer les valeurs brutes puis
  // arrondir une seule fois serait plus juste, mais donnerait un gramme d'écart
  // avec le chiffre affiché à l'écran — et un rappel qui contredit l'app d'un
  // gramme, c'est l'app qui a tort.
  return { c: Math.round(t.c * f), p: r1(t.p * f), l: r1(t.l * f), g: r1(t.g * f) };
}

/** Le libellé de la table qui a été retenu, ou null. Sert au recalcul, qui doit
 *  pouvoir dire CE QU'IL a reconnu et non seulement combien il a compté. */
export function cleNutri(name) {
  const n = normNom(name);
  const nF = ' ' + n.trim().split(' ').map(sing).join(' ') + ' ';
  for (const e of NT_FORTS) {
    if (tousPresents(e.mots, n) || tousPresents(e.motsS, nF)) return e.k;
  }
  let cle = null, motsExacts = 0;
  for (const e of NT_CLES) { if (tousPresents(e.mots, n)) { cle = e.k; motsExacts = e.mots.length; break; } }
  const nS = ' ' + n.trim().split(' ').map(sing).join(' ') + ' ';
  for (const e of NT_CLES) {
    if (e.motsS.length <= motsExacts) break;
    if (tousPresents(e.motsS, nS)) return e.k;
  }
  return cle;
}

/**
 * ⚠️ ORDRE DE CONFIANCE, identique à `calcMac` de core.js : on prend d'abord
 * les macros ÉCRITES sur la ligne (`calories`, `proteins_g`, `carbs_g`,
 * `fats_g`), qu'`assets/ajout.js` renseigne depuis l'analyse photo. La table
 * n'est que le filet, pour les vieilles lignes et la saisie manuelle.
 *
 * Quatre zéros valent « rien d'écrit » : c'est le défaut de la base, pas une
 * mesure. Les appelants doivent donc DEMANDER ces colonnes dans leur `select`,
 * sinon elles arrivent `undefined` et on retombe en silence sur le filet.
 */
export function calcMac(ings) {
  const t = { c: 0, p: 0, l: 0, g: 0 };
  const inconnus = [];
  for (const i of (ings || [])) {
    if (!i) continue;
    const cal = parseFloat(i.calories), pr = parseFloat(i.proteins_g),
          gl = parseFloat(i.carbs_g), li = parseFloat(i.fats_g);
    if (cal || pr || gl || li) {
      t.c += cal || 0; t.p += pr || 0; t.g += gl || 0; t.l += li || 0;
      continue;
    }
    const r = getNutri(i.name, i.quantity_g || 0);
    if (r) { t.c += r.c; t.p += r.p; t.l += r.l; t.g += r.g; }
    else if (i.name) inconnus.push(i.name);
  }
  const out = { c: Math.round(t.c), p: r1(t.p), l: r1(t.l), g: r1(t.g) };
  out.inconnus = inconnus;
  return out;
}
