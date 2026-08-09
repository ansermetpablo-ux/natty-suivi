/* ═══════════════════════════════════════════════════════════
   Natty — « Découvrir » : les cuisines du monde

   Deux choses dans ce fichier :
     1. le CATALOGUE — 66 plats répartis en 12 cuisines, avec leurs
        photos (assets/img/decouverte/), leur description, leurs
        ingrédients clés et une note « côté nutrition » ;
     2. la VISIONNEUSE plein écran — on tape un plat, la photo prend
        tout l'écran et on passe au suivant d'un geste latéral.

   Le rendu des rangées, lui, vit dans social.html : même découpage
   que assets/social.js (les données ici, la page là-bas). La
   visionneuse fait exception parce qu'elle s'invite PAR-DESSUS
   l'écran courant — comme assets/ajout.js ou assets/planning.js —
   et doit donc porter son propre style, scellé sous `#ndec`.

   Dépend de assets/core.js. Utilise assets/liste.js s'il est chargé
   (bouton « ajouter à mes courses »), et s'en passe sinon.

   ⚠️ AUCUNE MACRO N'EST ANNONCÉE ICI, et c'est délibéré. Donner
   « 620 kcal » à un pad thaï supposerait une recette et des grammages
   que personne n'a pesés — ce serait un chiffre inventé, exactement
   ce que le reste de l'app refuse de faire (cf. CLAUDE.md : un manque
   visible vaut mieux qu'un total silencieusement faux). On montre donc
   les ingrédients réels, qui eux sont vrais, et une phrase factuelle
   sur ce que le plat apporte. Le jour où ces plats deviendront des
   recettes avec des grammages, `Natty.calcMac` fera le calcul.

   ⚠️ La visionneuse est NOIRE dans les deux thèmes, comme
   `assets/ajout.js` et `assets/planning.js` : c'est une photo qui
   occupe l'écran entier, le fond n'est pas une surface d'interface
   mais le bord de l'image. Ne pas « corriger » ses #fff.
   ═══════════════════════════════════════════════════════════ */
var NattyDecouverte = (function () {

  var BASE = '/assets/img/decouverte/';

  /* ── Catalogue ─────────────────────────────────────────────
     `i` : les ingrédients clés, séparés par « | », chacun préfixé de
     son emoji. Format compact voulu : 66 plats × 6 ingrédients en
     objets pèseraient trois fois plus pour la même information.
     `t` : étiquettes, puisées dans TAGS ci-dessous — ne pas en
     inventer d'autres, ce sont elles qui alimentent la rangée
     « Envie de quoi ? ». */

  var TAGS = ['Végétarien', 'Protéiné', 'Léger', 'Épicé', 'Réconfortant', 'Riche en fibres'];

  /* ⚠️ L'ordre est ALPHABÉTIQUE par nom de pays français, et la rangée du
     haut de social.html le rend tel quel. Une nouvelle cuisine se glisse à
     sa place ; l'ajouter à la fin donnerait une rangée triée « sauf les
     dernières », ce qui se lit comme un bug. */
  var CUISINES = [
    {
      cle: 'bre', nom: 'Brésil', drapeau: '🇧🇷',
      accroche: 'Le lait de coco, l\'huile de palme rouge et les fruits d\'Amazonie',
      plats: [
        { cle:'bre-feijoada', n:'Feijoada',
          d:'Le plat national : des haricots noirs mijotés des heures avec plusieurs viandes, servis avec du riz, du chou et de la farofa.',
          i:'🫘 Haricots noirs|🥩 Porc|🌭 Chorizo|🍚 Riz|🥬 Chou kale|🍊 Orange',
          t:['Protéiné','Riche en fibres','Réconfortant'],
          nu:'Le chou et l\'orange ne sont pas une garniture : la vitamine C aide à absorber le fer des haricots noirs.' },
        { cle:'bre-acai-bowl', n:'Açaí bowl',
          d:'La purée d\'açaí glacée, servie en bol et couverte de fruits frais, de banane et de granola.',
          i:'🫐 Açaí|🍌 Banane|🍓 Fraise|🫐 Myrtille|🌾 Granola|🍯 Miel',
          t:['Végétarien','Riche en fibres'],
          nu:'C\'est un dessert avant d\'être un petit déjeuner : le granola et le miel montent vite en sucres.' },
        { cle:'bre-bobo-de-camarao', n:'Bobó de camarão',
          d:'Des crevettes mijotées dans une crème de manioc au lait de coco, servie sur du riz blanc.',
          i:'🍤 Crevettes|🍠 Manioc|🥥 Lait de coco|🍅 Tomate|🧅 Oignon|🌿 Coriandre',
          t:['Protéiné','Réconfortant'],
          nu:'C\'est le manioc qui donne l\'onctuosité, pas la crème — un liant sans matière grasse.' },
        { cle:'bre-moqueca-poisson', n:'Moqueca de poisson',
          d:'Un ragoût de poisson blanc au lait de coco, poivrons et citron vert, mijoté à couvert dans son jus.',
          i:'🐟 Poisson blanc|🥥 Lait de coco|🫑 Poivron|🍅 Tomate|🍋 Citron vert|🌿 Coriandre',
          t:['Protéiné'],
          nu:'Le poisson blanc est très maigre : ici, tous les lipides du plat viennent du lait de coco.' },
        { cle:'bre-xinxim', n:'Xinxim de galinha',
          d:'Du poulet mijoté aux crevettes séchées et à la cacahuète pilée, un des grands plats de Bahia.',
          i:'🍗 Poulet|🍤 Crevettes séchées|🥜 Cacahuètes|🧅 Oignon|🫚 Gingembre|🍋 Citron',
          t:['Protéiné','Réconfortant'],
          nu:'Cacahuètes et crevettes séchées apportent le gras du plat : la volaille, elle, peut rester maigre.' }
      ]
    },
    {
      cle: 'chi', nom: 'Chine', drapeau: '🇨🇳',
      accroche: 'Le wok très chaud, le vinaigre noir, et le tofu partout',
      plats: [
        { cle:'chi-aubergine-yuxiang', n:'Aubergines yúxiāng',
          d:'Des aubergines fondantes dans une sauce aigre-douce à l\'ail, au gingembre et au vinaigre noir.',
          i:'🍆 Aubergine|🧄 Ail|🫚 Gingembre|🥢 Sauce soja|🌶️ Piment|🍚 Riz',
          t:['Végétarien','Épicé'],
          nu:'L\'aubergine boit l\'huile : la précuire à la vapeur avant le wok divise la matière grasse par trois.' },
        { cle:'chi-mapo-tofu', n:'Mápó dòufu',
          d:'Des cubes de tofu soyeux dans une sauce rouge au piment fermenté et au poivre de Sichuan.',
          i:'🧊 Tofu|🥩 Viande hachée|🌶️ Doubanjiang|🧄 Ail|🧅 Ciboule|🍚 Riz',
          t:['Protéiné','Épicé'],
          nu:'Une petite quantité de viande suffit à porter tout le plat : c\'est le tofu qui fait le volume.' },
        { cle:'chi-kung-pao', n:'Poulet kung pao',
          d:'Du poulet sauté avec des cacahuètes, des piments séchés et des poivrons, dans une sauce aigre-douce.',
          i:'🍗 Poulet|🥜 Cacahuètes|🫑 Poivron|🌶️ Piment|🥢 Sauce soja|🍚 Riz',
          t:['Protéiné','Épicé'],
          nu:'Les cacahuètes ne sont pas un décor : elles apportent l\'essentiel des lipides du plat.' },
        { cle:'chi-raviolis-vapeur', n:'Raviolis vapeur',
          d:'Des jiǎozi pliés à la main, cuits à la vapeur et trempés dans une sauce soja-vinaigre.',
          i:'🥟 Pâte à raviolis|🥩 Viande hachée|🥬 Chou|🧅 Ciboule|🫚 Gingembre|🥢 Sauce soja',
          t:['Réconfortant','Protéiné'],
          nu:'À la vapeur plutôt que poêlés, ce sont les mêmes raviolis sans l\'huile de la poêle.' }
      ]
    },
    {
      cle: 'cor', nom: 'Corée', drapeau: '🇰🇷',
      accroche: 'Le riz, les légumes assaisonnés un par un, et le piment fermenté',
      plats: [
        { cle:'cor-bibimbap-boeuf', n:'Bibimbap au bœuf',
          d:'Un bol de riz que l\'on mélange soi-même à table : bœuf mariné, légumes assaisonnés séparément, œuf et une pointe de gochujang.',
          i:'🥩 Bœuf|🍚 Riz|🥕 Carotte|🥬 Épinards|🥚 Œuf|🌶️ Gochujang',
          t:['Protéiné','Réconfortant'],
          nu:'Cinq légumes différents dans un seul bol, sans que ça ressemble à une assiette de légumes.' },
        { cle:'cor-nouilles-poulet', n:'Nouilles au poulet',
          d:'Des nouilles épaisses dans une sauce crémeuse au piment fermenté, poulet effiloché et oignon rouge mariné par-dessus.',
          i:'🍜 Nouilles|🍗 Poulet|🌶️ Gochujang|🧅 Oignon|🥛 Lait|🌿 Coriandre',
          t:['Réconfortant','Épicé'],
          nu:'Le poulet effiloché fait monter les protéines d\'un plat de nouilles qui, seul, n\'en apporterait presque pas.' },
        { cle:'cor-bulgogi', n:'Bulgogi grillé',
          d:'De fines lamelles de bœuf marinées à la sauce soja, à la poire et au sésame, saisies très vite sur le gril.',
          i:'🥩 Bœuf|🥢 Sauce soja|🍐 Poire|🧄 Ail|🌾 Graines de sésame|🍚 Riz',
          t:['Protéiné'],
          nu:'La marinade à la poire attendrit la viande — on peut donc prendre un morceau maigre sans qu\'il devienne sec.' },
        { cle:'cor-poulet-gochujang', n:'Poulet gochujang caramélisé',
          d:'Une cuisse de poulet laquée au piment fermenté et au miel, caramélisée jusqu\'à ce que la sauce colle à la peau.',
          i:'🍗 Poulet|🌶️ Gochujang|🍯 Miel|🧄 Ail|🫚 Gingembre|🍚 Riz',
          t:['Protéiné','Épicé'],
          nu:'Le gochujang porte beaucoup de goût pour peu de matière grasse : la sauce n\'a pas besoin d\'huile.' },
        { cle:'cor-japchae', n:'Japchae',
          d:'Des vermicelles de patate douce sautés avec une poêlée de légumes croquants, sauce soja et huile de sésame.',
          i:'🍠 Vermicelles de patate douce|🥕 Carotte|🥬 Épinards|🍄 Champignons|🧅 Oignon|🥢 Sauce soja',
          t:['Végétarien'],
          nu:'Les vermicelles de patate douce se digèrent plus lentement que des nouilles de blé.' },
        { cle:'cor-kimchi-jjigae', n:'Kimchi jjigae',
          d:'Le ragoût du quotidien en Corée : du kimchi bien fermenté mijoté avec du tofu, servi bouillonnant.',
          i:'🥬 Kimchi|🧊 Tofu|🧅 Oignon|🌶️ Gochujang|🧄 Ail|🍚 Riz',
          t:['Végétarien','Épicé','Réconfortant'],
          nu:'Le chou fermenté apporte des bactéries lactiques — un plat de tous les jours, pas un remède.' },
        { cle:'cor-tteokbokki', n:'Tteokbokki',
          d:'Des gnocchis de riz coréens dans une sauce rouge sucrée-piquante, à manger brûlants.',
          i:'🍥 Gâteaux de riz|🌶️ Gochujang|🧅 Oignon|🥬 Chou|🍯 Sucre|🌾 Graines de sésame',
          t:['Végétarien','Épicé'],
          nu:'C\'est un plat de féculents : on l\'accompagne volontiers d\'un œuf ou de tofu pour tenir jusqu\'au soir.' }
      ]
    },
    {
      cle: 'eth', nom: 'Éthiopie', drapeau: '🇪🇹',
      accroche: 'Une galette pour assiette, des ragoûts épicés posés dessus',
      plats: [
        { cle:'eth-doro-wat', n:'Doro wat',
          d:'Le ragoût de fête : poulet mijoté longuement dans l\'oignon et le berbéré, avec un œuf dur par convive.',
          i:'🍗 Poulet|🧅 Oignon|🌶️ Berbéré|🥚 Œuf|🧄 Ail|🫚 Gingembre',
          t:['Protéiné','Épicé'],
          nu:'L\'oignon fondu tient lieu de liant : la sauce est épaisse sans crème ni farine.' },
        { cle:'eth-injera', n:'Injera et ses ragoûts',
          d:'La grande galette de teff, spongieuse et légèrement acide, sur laquelle on dispose tous les plats à partager.',
          i:'🌾 Teff|💧 Eau|🫘 Lentilles|🥬 Chou|🥕 Carotte|🌶️ Berbéré',
          t:['Végétarien','Riche en fibres'],
          nu:'Le teff est une céréale complète : la galette apporte des fibres, ce qu\'un pain blanc ne fait pas.' },
        { cle:'eth-misir-wat', n:'Misir wat',
          d:'Des lentilles corail fondues dans l\'oignon et le berbéré, jusqu\'à devenir une purée profonde et rouge.',
          i:'🫘 Lentilles corail|🧅 Oignon|🌶️ Berbéré|🧄 Ail|🫚 Gingembre|🍅 Tomate',
          t:['Végétarien','Riche en fibres','Épicé'],
          nu:'Lentilles et galette de teff se complètent : ensemble, ils couvrent les acides aminés qui manquent à chacun.' },
        { cle:'eth-tibs-boeuf', n:'Tibs de bœuf',
          d:'Des dés de bœuf sautés vif avec oignon, piment et beurre épicé — le plat qu\'on commande quand on a faim.',
          i:'🥩 Bœuf|🧅 Oignon|🌶️ Piment|🧄 Ail|🍅 Tomate|🌿 Romarin',
          t:['Protéiné','Épicé'],
          nu:'Cuisson courte à feu vif : la viande reste tendre sans qu\'on ait besoin d\'ajouter de la sauce.' }
      ]
    },
    {
      cle: 'geo', nom: 'Géorgie', drapeau: '🇬🇪',
      accroche: 'Les noix, les herbes en quantité, et la viande au feu de bois',
      plats: [
        { cle:'geo-chakhokhbili', n:'Chakhokhbili',
          d:'Du poulet mijoté avec beaucoup de tomates et d\'herbes fraîches, sans une goutte d\'eau ajoutée.',
          i:'🍗 Poulet|🍅 Tomate|🧅 Oignon|🌿 Coriandre|🌿 Persil|🧄 Ail',
          t:['Protéiné'],
          nu:'La tomate rend assez de jus pour la cuisson entière : le plat se fait sans bouillon ni matière grasse.' },
        { cle:'geo-mtsvadi', n:'Mtsvadi',
          d:'Des morceaux d\'agneau marinés puis grillés à la braise, servis avec des légumes crus et du pain.',
          i:'🍖 Agneau|🧅 Oignon rouge|🍅 Tomate|🥒 Concombre|🌿 Coriandre|🍋 Citron',
          t:['Protéiné'],
          nu:'Grillé à la braise, le gras de l\'agneau s\'écoule : c\'est la cuisson qui allège le morceau.' }
      ]
    },
    {
      cle: 'gre', nom: 'Grèce', drapeau: '🇬🇷',
      accroche: 'L\'huile d\'olive, le citron, et des légumes qui tiennent le premier rôle',
      plats: [
        { cle:'gre-daurade', n:'Daurade grillée',
          d:'Un poisson entier grillé, arrosé d\'huile d\'olive et de citron, avec des légumes de saison à côté.',
          i:'🐟 Daurade|🫒 Huile d\'olive|🍋 Citron|🌿 Origan|🥔 Pomme de terre|🥒 Courgette',
          t:['Protéiné','Léger'],
          nu:'Un poisson blanc : beaucoup de protéines, peu de lipides, et l\'huile d\'olive s\'ajoute après cuisson.' },
        { cle:'gre-fasolada', n:'Fasolada',
          d:'La soupe de haricots blancs que les Grecs appellent leur plat national : carotte, céleri, tomate, et rien de plus.',
          i:'🫘 Haricots blancs|🥕 Carotte|🍅 Tomate|🧅 Oignon|🫒 Huile d\'olive|🌿 Persil',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Les haricots blancs apportent protéines et fibres dans la même cuillère — rare pour une soupe.' },
        { cle:'gre-gemista', n:'Gemista',
          d:'Des tomates et des poivrons vidés puis farcis de riz aux herbes, rôtis lentement jusqu\'à ce qu\'ils s\'affaissent.',
          i:'🍅 Tomate|🫑 Poivron|🍚 Riz|🧅 Oignon|🌿 Menthe|🫒 Huile d\'olive',
          t:['Végétarien'],
          nu:'Le légume sert de contenant : on mange une portion entière de tomate sans y penser.' },
        { cle:'gre-souvlaki-poulet', n:'Souvláki de poulet',
          d:'Des brochettes marinées à l\'origan et au citron, servies avec du tzatzíki et une pointe de citron.',
          i:'🍗 Poulet|🍋 Citron|🌿 Origan|🥒 Concombre|🥛 Yaourt|🧄 Ail',
          t:['Protéiné','Léger'],
          nu:'Le tzatzíki remplace une sauce grasse par du yaourt : même onctuosité, protéines en plus.' },
        { cle:'gre-mezze-dolma', n:'Mezzé et dolmas',
          d:'Feuilles de vigne farcies au riz, houmous, purée de pois chiches et pain plat, à picorer à plusieurs.',
          i:'🍇 Feuilles de vigne|🍚 Riz|🫘 Pois chiches|🍋 Citron|🫒 Huile d\'olive|🥖 Pain pita',
          t:['Végétarien','Riche en fibres'],
          nu:'Manger à plusieurs petites bouchées ralentit le repas — et la satiété a le temps d\'arriver.' }
      ]
    },
    {
      cle: 'ind', nom: 'Inde', drapeau: '🇮🇳',
      accroche: 'Les légumineuses en vedette, et des épices grillées avant tout le reste',
      plats: [
        { cle:'ind-tandoori-agneau', n:'Agneau tandoori',
          d:'Des côtes marinées au yaourt et aux épices, saisies au four très chaud jusqu\'à ce que les bords noircissent.',
          i:'🍖 Agneau|🥛 Yaourt|🌶️ Paprika|🧄 Ail|🫚 Gingembre|🍋 Citron',
          t:['Protéiné','Épicé'],
          nu:'La marinade au yaourt attendrit la viande : pas besoin d\'ajouter de matière grasse à la cuisson.' },
        { cle:'ind-chana-masala', n:'Chana masala',
          d:'Des pois chiches mijotés dans une sauce tomate au cumin et à la coriandre, relevée juste avant de servir.',
          i:'🫘 Pois chiches|🍅 Tomate|🧅 Oignon|🫚 Gingembre|🌿 Coriandre|🌶️ Épices',
          t:['Végétarien','Riche en fibres'],
          nu:'Une assiette de pois chiches, c\'est autant de fibres qu\'une grosse portion de légumes verts.' },
        { cle:'ind-dal', n:'Dal de lentilles corail',
          d:'Des lentilles corail cuites jusqu\'à se défaire, finies par un « tarka » : des épices grillées versées dessus.',
          i:'🫘 Lentilles corail|🧅 Oignon|🍅 Tomate|🌶️ Cumin|🫚 Gingembre|🌿 Coriandre',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Les lentilles corail cuisent en 15 minutes : le plat de légumineuses le plus rapide qui existe.' },
        { cle:'ind-poulet-tikka', n:'Poulet tikka masala',
          d:'Des morceaux de poulet grillés puis plongés dans une sauce tomate crémeuse aux épices douces.',
          i:'🍗 Poulet|🍅 Tomate|🥛 Crème|🧄 Ail|🫚 Gingembre|🍚 Riz',
          t:['Protéiné','Réconfortant'],
          nu:'La crème peut se remplacer par du yaourt épais : la sauce reste onctueuse, les lipides baissent nettement.' }
      ]
    },
    {
      cle: 'ira', nom: 'Iran', drapeau: '🇮🇷',
      accroche: 'L\'aigre-doux des fruits secs, les aubergines fumées, les herbes par bottes',
      plats: [
        { cle:'ira-ash-reshteh', n:'Âsh-e reshteh',
          d:'Une soupe épaisse d\'herbes, de légumineuses et de nouilles, nappée de kashk et d\'oignons frits.',
          i:'🫘 Pois chiches|🫘 Lentilles|🌿 Persil|🌿 Coriandre|🍜 Nouilles|🧅 Oignon',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Deux légumineuses, des herbes et des nouilles : une soupe qui vaut un repas entier.' },
        { cle:'ira-fesenjan-poulet', n:'Fesenjân au poulet',
          d:'Du poulet mijoté dans une sauce sombre aux noix pilées et à la mélasse de grenade, à la fois sucrée et acide.',
          i:'🍗 Poulet|🌰 Noix|🍇 Mélasse de grenade|🧅 Oignon|🍚 Riz|🌶️ Curcuma',
          t:['Protéiné','Réconfortant'],
          nu:'Ce sont les noix qui épaississent la sauce — riches en oméga-3, mais aussi le poste calorique du plat.' },
        { cle:'ira-kashk-bademjan', n:'Kashk-e bademjan',
          d:'Une purée d\'aubergines fondues, montée au kashk (lactosérum fermenté) et couverte d\'oignons frits et de menthe.',
          i:'🍆 Aubergine|🥛 Kashk|🧅 Oignon|🌿 Menthe|🧄 Ail|🌶️ Curcuma',
          t:['Végétarien','Réconfortant'],
          nu:'Le kashk est fermenté et riche en protéines : un aigre-doux laitier qui remplace la crème.' },
        { cle:'ira-mirza-ghasemi', n:'Mirza ghasemi',
          d:'Des aubergines grillées à la peau, écrasées avec de l\'ail et de la tomate, liées à l\'œuf.',
          i:'🍆 Aubergine|🍅 Tomate|🧄 Ail|🥚 Œuf|🌶️ Curcuma|🫒 Huile d\'olive',
          t:['Végétarien','Protéiné'],
          nu:'L\'œuf en fin de cuisson fait passer une purée de légumes au rang de plat complet.' }
      ]
    },
    {
      cle: 'ita', nom: 'Italie', drapeau: '🇮🇹',
      accroche: 'Peu d\'ingrédients, très bons, et des légumes qui ne sont pas une garniture',
      plats: [
        { cle:'ita-caponata-pois-chiches', n:'Caponata aux pois chiches',
          d:'La caponata sicilienne — aubergine, céleri, câpres, vinaigre — enrichie de pois chiches.',
          i:'🍆 Aubergine|🫘 Pois chiches|🍅 Tomate|🫒 Olives|🧅 Oignon|🌿 Basilic',
          t:['Végétarien','Riche en fibres'],
          nu:'Les pois chiches font passer un antipasto au rang de plat : sans eux, il n\'y a pas de protéines.' },
        { cle:'ita-minestrone', n:'Minestrone',
          d:'La soupe de légumes de saison avec des haricots et de petites pâtes, différente chaque semaine.',
          i:'🫘 Haricots|🥕 Carotte|🥬 Chou|🍅 Tomate|🍝 Pâtes|🫒 Huile d\'olive',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Haricots + pâtes : la combinaison qui rend un minestrone rassasiant au lieu d\'une soupe claire.' },
        { cle:'ita-parmigiana', n:'Parmigiana d\'aubergines',
          d:'Des tranches d\'aubergine en couches avec sauce tomate, mozzarella et basilic, gratinées au four.',
          i:'🍆 Aubergine|🍅 Sauce tomate|🧀 Mozzarella|🧀 Parmesan|🌿 Basilic|🫒 Huile d\'olive',
          t:['Végétarien','Réconfortant'],
          nu:'Aubergines grillées plutôt que frites : le plat garde son fondant et perd la moitié de ses lipides.' },
        { cle:'ita-poulet-cacciatora', n:'Poulet alla cacciatora',
          d:'Du poulet mijoté « à la chasseur » avec tomates, olives, poivrons et vin blanc.',
          i:'🍗 Poulet|🍅 Tomate|🫒 Olives|🫑 Poivron|🧅 Oignon|🌿 Romarin',
          t:['Protéiné'],
          nu:'La cuisson longue en sauce permet de prendre des morceaux avec os, plus goûteux et moins chers.' }
      ]
    },
    {
      cle: 'jap', nom: 'Japon', drapeau: '🇯🇵',
      accroche: 'Des bols composés, du poisson, et des cuissons qui ne masquent rien',
      plats: [
        { cle:'jap-bento-saumon', n:'Bento saumon et légumes croquants',
          d:'Un pavé de saumon laqué posé sur du riz, avec des légumes juste blanchis pour qu\'ils restent fermes.',
          i:'🐟 Saumon|🍚 Riz|🥦 Brocoli|🥕 Carotte|🥢 Sauce soja|🌾 Graines de sésame',
          t:['Protéiné'],
          nu:'Le saumon est l\'un des rares aliments à apporter à la fois protéines et oméga-3 en quantité.' },
        { cle:'jap-chirashi-vege', n:'Chirashi végétarien',
          d:'Un lit de riz vinaigré couvert de tofu mariné, edamame, avocat et légumes crus taillés fin.',
          i:'🧊 Tofu|🍚 Riz|🫛 Edamame|🥑 Avocat|🥒 Concombre|🥬 Chou rouge',
          t:['Végétarien','Léger'],
          nu:'Tofu et edamame : deux protéines végétales dans le même bol, ce qui est ce qui manque souvent aux bols végétariens.' },
        { cle:'jap-donburi-tofu', n:'Donburi au tofu',
          d:'Des cubes de tofu dorés puis glacés à la sauce soja, servis sur un bol de riz chaud avec de la ciboule.',
          i:'🧊 Tofu|🍚 Riz|🥢 Sauce soja|🧅 Ciboule|🫚 Gingembre|🌾 Graines de sésame',
          t:['Végétarien','Protéiné'],
          nu:'Le tofu ferme monte à une vingtaine de grammes de protéines pour 200 g — comparable à un œuf et demi.' },
        { cle:'jap-yakitori', n:'Yakitori de poulet',
          d:'Des brochettes laquées à la sauce tare, grillées vite et badigeonnées plusieurs fois pendant la cuisson.',
          i:'🍗 Poulet|🥢 Sauce soja|🍯 Mirin|🧅 Ciboule|🍚 Riz|🥒 Concombre',
          t:['Protéiné','Léger'],
          nu:'La sauce apporte du sucre : deux ou trois brochettes suffisent, on complète avec les légumes.' },
        { cle:'jap-ramen-poulet', n:'Ramen au poulet',
          d:'Un bouillon longuement mijoté, des nouilles fermes et du poulet effiloché — le tout monté au dernier moment.',
          i:'🍜 Nouilles|🍗 Poulet|🥢 Bouillon|🥚 Œuf|🧅 Ciboule|🫚 Gingembre',
          t:['Réconfortant','Protéiné'],
          nu:'Le bouillon est salé : c\'est le plat où l\'on peut se passer de resaler quoi que ce soit.' },
        { cle:'jap-saumon-teriyaki', n:'Saumon teriyaki',
          d:'Un pavé glacé à la sauce teriyaki, caramélisé sur le dessus et encore nacré au cœur.',
          i:'🐟 Saumon|🥢 Teriyaki|🍚 Riz|🥦 Brocoli|🫑 Poivron|🌾 Graines de sésame',
          t:['Protéiné'],
          nu:'Cuit à cœur, le saumon perd sa texture ; à peine nacré, il garde son moelleux sans ajout de gras.' },
        { cle:'jap-soba', n:'Soba de sarrasin',
          d:'Des nouilles de sarrasin dans un bouillon clair, avec des légumes verts et de la ciboule ciselée.',
          i:'🍜 Nouilles de sarrasin|🥢 Bouillon|🥬 Épinards|🧅 Ciboule|🍄 Champignons|🥢 Sauce soja',
          t:['Léger','Riche en fibres'],
          nu:'Le sarrasin n\'est pas un blé : ses nouilles apportent plus de fibres et de protéines que des pâtes classiques.' }
      ]
    },
    {
      cle: 'lib', nom: 'Liban', drapeau: '🇱🇧',
      accroche: 'Beaucoup d\'herbes fraîches, du citron partout, et des légumineuses',
      plats: [
        { cle:'lib-chich-taouk', n:'Chich taouk',
          d:'Des brochettes de poulet marinées au yaourt, au citron et à l\'ail, grillées jusqu\'à dorer sur les arêtes.',
          i:'🍗 Poulet|🥛 Yaourt|🍋 Citron|🧄 Ail|🌶️ Paprika|🍚 Riz',
          t:['Protéiné','Léger'],
          nu:'La marinade acide « cuit » un peu la viande avant le feu : elle reste juteuse même bien grillée.' },
        { cle:'lib-falafel-bowl', n:'Bowl de falafels',
          d:'Des falafels de pois chiches, du houmous, des crudités et une sauce au sésame, assemblés dans un bol.',
          i:'🧆 Falafel|🫘 Pois chiches|🥒 Concombre|🍅 Tomate|🥜 Tahini|🌾 Quinoa',
          t:['Végétarien','Riche en fibres'],
          nu:'Les falafels sont frits : servis avec du houmous plutôt qu\'une sauce crème, le bol reste équilibré.' },
        { cle:'lib-fattouche', n:'Fattouche',
          d:'La salade qui recycle le pain rassis : pain grillé, légumes croquants, sumac et beaucoup de citron.',
          i:'🥬 Laitue|🍅 Tomate|🥒 Concombre|🌿 Menthe|🥖 Pain pita|🍋 Citron',
          t:['Végétarien','Léger'],
          nu:'Une salade qui rassasie grâce au pain grillé — mais qui reste une entrée, pas un repas complet.' },
        { cle:'lib-mezze', n:'Mezzé libanais',
          d:'Houmous, moutabal, falafels, feta et olives : on picore à plusieurs, avec du pain plat pour tout saucer.',
          i:'🫘 Houmous|🍆 Aubergine|🧆 Falafel|🧀 Feta|🫒 Olives|🥖 Pain pita',
          t:['Végétarien','Riche en fibres'],
          nu:'Le pois chiche du houmous apporte des protéines végétales que les crudités seules n\'auraient pas.' },
        { cle:'lib-mjadara', n:'Mjadara',
          d:'Lentilles et riz cuits ensemble, couverts d\'oignons frits jusqu\'à devenir presque noirs et sucrés.',
          i:'🫘 Lentilles|🍚 Riz|🧅 Oignon|🫒 Huile d\'olive|🌿 Cumin|🥛 Yaourt',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Riz et lentilles ensemble forment une protéine complète — le plat de tous les jours, partout au Levant.' },
        { cle:'lib-taboule', n:'Taboulé libanais',
          d:'Le vrai : une salade de persil, pas de semoule. Le boulgour n\'est là que pour lier, en très petite quantité.',
          i:'🌿 Persil|🌿 Menthe|🍅 Tomate|🌾 Boulgour|🍋 Citron|🫒 Huile d\'olive',
          t:['Végétarien','Léger'],
          nu:'Du persil en quantité, donc beaucoup de vitamine C et de fer végétal — que le citron aide à absorber.' }
      ]
    },
    {
      cle: 'mar', nom: 'Maroc', drapeau: '🇲🇦',
      accroche: 'Des cuissons longues, du sucré-salé, et des soupes de légumineuses',
      plats: [
        { cle:'mar-harira', n:'Harira',
          d:'La soupe qui rompt le jeûne : lentilles, pois chiches, tomate et herbes, épaissie au dernier moment.',
          i:'🫘 Lentilles|🫘 Pois chiches|🍅 Tomate|🌿 Coriandre|🌿 Persil|🧅 Oignon',
          t:['Riche en fibres','Réconfortant'],
          nu:'Deux légumineuses dans le même bol : c\'est une soupe qui tient au corps, pas une entrée.' },
        { cle:'mar-tajine-citron', n:'Tajine au citron confit',
          d:'Du poulet mijoté des heures avec des olives et du citron confit, jusqu\'à se détacher de l\'os.',
          i:'🍗 Poulet|🍋 Citron confit|🫒 Olives|🧅 Oignon|🌿 Coriandre|🌶️ Curcuma',
          t:['Protéiné','Réconfortant'],
          nu:'La cuisson à couvert se passe de matière grasse : c\'est la vapeur qui fait le travail.' },
        { cle:'mar-zaalouk', n:'Zaalouk',
          d:'Une purée d\'aubergines et de tomates fondues à l\'huile d\'olive, à l\'ail et au cumin, servie tiède.',
          i:'🍆 Aubergine|🍅 Tomate|🧄 Ail|🌿 Cumin|🫒 Huile d\'olive|🌿 Coriandre',
          t:['Végétarien','Léger'],
          nu:'L\'aubergine boit l\'huile : la faire d\'abord rôtir au four permet d\'en mettre trois fois moins.' }
      ]
    },
    {
      cle: 'mex', nom: 'Mexique', drapeau: '🇲🇽',
      accroche: 'Le maïs, les haricots noirs, et le citron vert sur tout',
      plats: [
        { cle:'mex-ceviche-cabillaud', n:'Ceviche de cabillaud',
          d:'Du poisson cru coupé en dés, « cuit » par le jus de citron vert, avec oignon rouge, coriandre et piment.',
          i:'🐟 Cabillaud|🍋 Citron vert|🧅 Oignon rouge|🌿 Coriandre|🌶️ Piment|🥑 Avocat',
          t:['Protéiné','Léger'],
          nu:'Aucune cuisson, aucune matière grasse ajoutée : le plat le plus léger de cette page.' },
        { cle:'mex-chili', n:'Chili con carne',
          d:'Bœuf haché, haricots rouges et tomates mijotés longuement avec cumin et piment, servis avec du riz.',
          i:'🥩 Bœuf haché|🫘 Haricots rouges|🍅 Tomate|🧅 Oignon|🌶️ Piment|🍚 Riz',
          t:['Protéiné','Riche en fibres','Réconfortant'],
          nu:'Viande et haricots ensemble : autant de protéines qu\'un plat tout viande, pour moitié moins de viande.' },
        { cle:'mex-enchiladas-poulet', n:'Enchiladas de poulet',
          d:'Des tortillas de maïs roulées autour du poulet effiloché, nappées de sauce et passées au four.',
          i:'🌮 Tortilla de maïs|🍗 Poulet|🍅 Sauce tomate|🧀 Fromage|🥬 Laitue|🥑 Avocat',
          t:['Protéiné','Réconfortant'],
          nu:'La tortilla de maïs est plus dense que celle de blé : deux suffisent là où l\'on en prendrait trois.' },
        { cle:'mex-enchiladas-boeuf', n:'Enchiladas de bœuf',
          d:'La même idée, au bœuf mijoté : tortillas garnies, sauce rouge, fromage frais émietté et citron vert.',
          i:'🌮 Tortilla de maïs|🥩 Bœuf|🍅 Sauce tomate|🧀 Fromage|🧅 Oignon|🍋 Citron vert',
          t:['Protéiné','Réconfortant'],
          nu:'Un bœuf mijoté maigre (paleron, macreuse) rend le plat aussi fondant, avec beaucoup moins de lipides.' },
        { cle:'mex-burrito-bowl', n:'Burrito bowl au poulet',
          d:'Tout ce qu\'il y a dans un burrito, mais dans un bol : riz, haricots noirs, maïs, poulet grillé et avocat.',
          i:'🍚 Riz|🫘 Haricots noirs|🌽 Maïs|🍗 Poulet|🥑 Avocat|🍅 Tomate',
          t:['Protéiné','Riche en fibres'],
          nu:'Sans la galette, on retire une centaine de calories de féculent sans rien perdre du plat.' },
        { cle:'mex-tacos-boeuf', n:'Tacos de bœuf, salsa',
          d:'De petites tortillas garnies de bœuf haché épicé, salsa fraîche et coriandre, à plier à la main.',
          i:'🌮 Tortilla de maïs|🥩 Bœuf haché|🍅 Salsa|🧅 Oignon|🌿 Coriandre|🌶️ Piment',
          t:['Protéiné','Épicé'],
          nu:'La salsa fraîche remplace une sauce grasse par des tomates crues : goût en plus, lipides en moins.' }
      ]
    },
    {
      cle: 'per', nom: 'Pérou', drapeau: '🇵🇪',
      accroche: 'Le quinoa chez lui, le piment jaune, et l\'héritage japonais des sautés',
      plats: [
        { cle:'per-aji-de-gallina', n:'Ají de gallina',
          d:'Du poulet effiloché dans une sauce jaune crémeuse au piment ají amarillo, avec riz et œuf dur.',
          i:'🍗 Poulet|🌶️ Ají amarillo|🥛 Lait|🥖 Pain|🍚 Riz|🥚 Œuf',
          t:['Protéiné','Réconfortant'],
          nu:'C\'est le pain trempé qui lie la sauce, pas la crème — d\'où une onctuosité obtenue à peu de frais.' },
        { cle:'per-quinoa-bowl', n:'Bowl de quinoa',
          d:'Du quinoa avec patate douce rôtie, pois chiches, betterave et fromage frais, façon assiette composée.',
          i:'🌾 Quinoa|🍠 Patate douce|🫘 Pois chiches|🥬 Roquette|🧀 Feta|🌽 Maïs',
          t:['Végétarien','Riche en fibres'],
          nu:'Le quinoa est l\'une des rares plantes à contenir tous les acides aminés essentiels.' },
        { cle:'per-tacu-tacu', n:'Tacu tacu',
          d:'Le riz et les haricots de la veille repoêlés en galette dorée, surmontés d\'un œuf au plat.',
          i:'🍚 Riz|🫘 Haricots|🥚 Œuf|🧅 Oignon rouge|🌶️ Ají amarillo|🌿 Coriandre',
          t:['Riche en fibres','Réconfortant'],
          nu:'Un riz refroidi puis réchauffé développe de l\'amidon résistant, moins vite absorbé.' },
        { cle:'per-lomo-saltado', n:'Lomo saltado',
          d:'Des lanières de bœuf sautées au wok avec oignon, tomate et sauce soja — le Pérou croisé avec la Chine.',
          i:'🥩 Bœuf|🧅 Oignon rouge|🍅 Tomate|🥢 Sauce soja|🍟 Pomme de terre|🌿 Coriandre',
          t:['Protéiné'],
          nu:'Sauté très vite et très chaud : la viande colore sans avoir le temps de rendre son eau.' }
      ]
    },
    {
      cle: 'phi', nom: 'Philippines', drapeau: '🇵🇭',
      accroche: 'L\'aigre en fil conducteur : vinaigre, tamarin, calamansi',
      plats: [
        { cle:'phi-chicken-inasal', n:'Chicken inasal',
          d:'Du poulet mariné au calamansi, au gingembre et à la citronnelle, grillé et badigeonné d\'huile de rocou.',
          i:'🍗 Poulet|🍋 Citron vert|🫚 Gingembre|🌿 Citronnelle|🧄 Ail|🍚 Riz',
          t:['Protéiné'],
          nu:'La marinade acide fait tout le travail : la viande reste juteuse sans être panée ni sauçée.' },
        { cle:'phi-kare-kare', n:'Kare-kare',
          d:'Un ragoût à la sauce de cacahuètes avec des légumes verts, servi avec de la pâte de crevettes à part.',
          i:'🥩 Bœuf|🥜 Cacahuètes|🍆 Aubergine|🥬 Pak choï|🫘 Haricots verts|🍚 Riz',
          t:['Protéiné','Réconfortant'],
          nu:'La sauce cacahuète est très calorique : c\'est la quantité de légumes qui rééquilibre l\'assiette.' },
        { cle:'phi-lumpia-legumes', n:'Lumpia aux légumes',
          d:'De fins rouleaux garnis de légumes râpés et dorés à la poêle, à tremper dans une sauce au vinaigre.',
          i:'🥕 Carotte|🥬 Chou|🫘 Haricots verts|🧅 Oignon|🧄 Ail|🌮 Galettes de riz',
          t:['Végétarien'],
          nu:'Un rouleau, c\'est surtout des légumes — mais la friture, elle, ne se voit pas dans la garniture.' },
        { cle:'phi-pancit-legumes', n:'Pancit aux légumes',
          d:'Des vermicelles sautés avec des légumes taillés fin, sauce soja et un trait de citron au moment de servir.',
          i:'🍜 Vermicelles de riz|🥕 Carotte|🥬 Chou|🫑 Poivron|🥢 Sauce soja|🍋 Citron vert',
          t:['Végétarien','Léger'],
          nu:'Un plat de nouilles, donc de féculent : un œuf ou du tofu par-dessus en fait un repas.' },
        { cle:'phi-sinigang', n:'Sinigang',
          d:'La soupe aigre au tamarin, avec de la viande et des légumes verts — le plat de réconfort national.',
          i:'🥩 Bœuf|🍅 Tomate|🥬 Épinards|🫘 Haricots verts|🍆 Aubergine|🍋 Tamarin',
          t:['Protéiné','Léger'],
          nu:'Une soupe de viande sans matière grasse ajoutée : c\'est l\'acidité qui porte le goût, pas le gras.' }
      ]
    },
    {
      cle: 'sen', nom: 'Sénégal', drapeau: '🇸🇳',
      accroche: 'Le riz, l\'oignon confit et la cacahuète comme trame de fond',
      plats: [
        { cle:'sen-mafe', n:'Mafé',
          d:'Un ragoût de viande à la pâte d\'arachide, avec des légumes racines mijotés dedans, servi sur du riz.',
          i:'🥩 Bœuf|🥜 Beurre de cacahuète|🍅 Tomate|🥕 Carotte|🍠 Patate douce|🍚 Riz',
          t:['Protéiné','Réconfortant'],
          nu:'La pâte d\'arachide est le poste calorique du plat : deux cuillères suffisent à lier la sauce.' },
        { cle:'sen-thieboudienne', n:'Thiéboudiène',
          d:'Le plat national : du poisson farci aux herbes et des légumes mijotés, puis le riz cuit dans ce bouillon.',
          i:'🐟 Poisson|🍚 Riz|🥕 Carotte|🥬 Chou|🍆 Aubergine|🍅 Tomate',
          t:['Protéiné'],
          nu:'Le riz cuit dans le bouillon des légumes : rien de ce qui a été extrait n\'est jeté.' },
        { cle:'sen-yassa-poulet', n:'Yassa au poulet',
          d:'Du poulet mariné au citron et grillé, puis mijoté dans une masse d\'oignons confits très longuement.',
          i:'🍗 Poulet|🧅 Oignon|🍋 Citron|🌶️ Piment|🧄 Ail|🍚 Riz',
          t:['Protéiné'],
          nu:'La sauce, ce sont des oignons fondus et du citron — ni crème, ni farine, ni beurre.' }
      ]
    },
    {
      cle: 'thai', nom: 'Thaïlande', drapeau: '🇹🇭',
      accroche: 'Quatre goûts en même temps : sucré, salé, acide, piquant',
      plats: [
        { cle:'thai-tom-kha-kai', n:'Tom kha kai',
          d:'Une soupe au lait de coco parfumée à la citronnelle et au galanga, avec du poulet et des champignons.',
          i:'🥥 Lait de coco|🍗 Poulet|🍄 Champignons|🌿 Citronnelle|🍋 Citron vert|🌶️ Piment',
          t:['Réconfortant','Épicé'],
          nu:'Le lait de coco est gras : une demi-boîte allongée d\'eau ou de bouillon suffit largement.' },
        { cle:'thai-curry-vert-poulet', n:'Curry vert de poulet',
          d:'Le plus relevé des curries thaïs : pâte verte, lait de coco, poulet, aubergines et basilic thaï.',
          i:'🍗 Poulet|🥥 Lait de coco|🌶️ Pâte de curry vert|🍆 Aubergine|🌿 Basilic thaï|🍚 Riz',
          t:['Protéiné','Épicé'],
          nu:'Le piquant vient de la pâte, pas du gras : on peut réduire le lait de coco sans perdre le goût.' },
        { cle:'thai-curry-rouge-legumes', n:'Curry rouge de légumes',
          d:'Une version sans viande : tofu, courgette, aubergine et poivron mijotés dans un curry rouge au coco.',
          i:'🧊 Tofu|🥥 Lait de coco|🌶️ Pâte de curry rouge|🥒 Courgette|🍆 Aubergine|🫑 Poivron',
          t:['Végétarien','Épicé'],
          nu:'C\'est le tofu qui fait tenir le plat : sans lui, ce curry n\'apporterait presque aucune protéine.' },
        { cle:'thai-pad-thai-crevettes', n:'Pad thaï aux crevettes',
          d:'Des nouilles de riz sautées à la sauce tamarin, avec crevettes, œuf, pousses de soja et cacahuètes.',
          i:'🍜 Nouilles de riz|🍤 Crevettes|🥚 Œuf|🥜 Cacahuètes|🌱 Pousses de soja|🍋 Citron vert',
          t:['Protéiné'],
          nu:'La crevette est l\'une des protéines les plus maigres qui soient — l\'huile du wok fait le reste.' },
        { cle:'thai-pad-thai-poulet', n:'Pad thaï au poulet',
          d:'La même sauce aigre-douce au tamarin, avec du poulet émincé et beaucoup de pousses de soja croquantes.',
          i:'🍜 Nouilles de riz|🍗 Poulet|🥚 Œuf|🥜 Cacahuètes|🌱 Pousses de soja|🧅 Ciboule',
          t:['Protéiné'],
          nu:'Les pousses de soja ajoutées hors du feu gardent leur croquant et allègent la portion de nouilles.' },
        { cle:'thai-pad-thai-tofu', n:'Pad thaï au tofu',
          d:'La version végétarienne : tofu doré, légumes croquants et la même sauce tamarin sucrée-acide.',
          i:'🍜 Nouilles de riz|🧊 Tofu|🥦 Brocoli|🥕 Carotte|🥜 Cacahuètes|🍋 Citron vert',
          t:['Végétarien','Protéiné'],
          nu:'Tofu et cacahuètes se complètent : c\'est l\'association qui rend ce plat rassasiant.' },
        { cle:'thai-riz-basilic', n:'Riz sauté au basilic thaï',
          d:'Du riz sauté à feu vif avec de l\'ail, du piment et une grosse poignée de basilic thaï jetée à la fin.',
          i:'🍚 Riz|🌿 Basilic thaï|🧄 Ail|🌶️ Piment|🥚 Œuf|🥢 Sauce soja',
          t:['Épicé','Réconfortant'],
          nu:'Un œuf au plat par-dessus transforme un plat de féculent en repas complet.' },
        { cle:'thai-tigre-qui-pleure', n:'Tigre qui pleure',
          d:'Une pièce de bœuf grillée saignante, tranchée et arrosée d\'une sauce piment-citron-coriandre.',
          i:'🥩 Bœuf|🍋 Citron vert|🌶️ Piment|🌿 Coriandre|🥢 Sauce soja|🍚 Riz gluant',
          t:['Protéiné','Épicé'],
          nu:'La sauce se fait sans huile : citron, piment et sauce poisson suffisent à porter la viande.' },
        { cle:'thai-soupe-porc-caramelise', n:'Soupe thaïe au porc caramélisé',
          d:'Un bouillon au curry et au coco, nouilles moelleuses, porc caramélisé et nouilles frites par-dessus.',
          i:'🍜 Nouilles|🐖 Porc|🥥 Lait de coco|🌶️ Pâte de curry|🧅 Oignon rouge|🍋 Citron vert',
          t:['Réconfortant','Épicé'],
          nu:'Les nouilles frites du dessus sont un décor : elles ajoutent surtout du gras, elles se dosent.' }
      ]
    },
    {
      cle: 'tur', nom: 'Turquie', drapeau: '🇹🇷',
      accroche: 'Le yaourt en sauce, les légumes à l\'huile d\'olive, les soupes de lentilles',
      plats: [
        { cle:'tur-imam-bayildi', n:'İmam bayıldı',
          d:'Des aubergines fendues et confites à l\'huile d\'olive avec oignon, ail et tomate, servies tièdes.',
          i:'🍆 Aubergine|🍅 Tomate|🧅 Oignon|🧄 Ail|🫒 Huile d\'olive|🌿 Persil',
          t:['Végétarien','Léger'],
          nu:'Servi tiède ou froid, ce plat de légumes se mange seul — il n\'a pas besoin d\'accompagnement.' },
        { cle:'tur-kisir', n:'Kısır',
          d:'Une salade de boulgour fin travaillée au concentré de tomate et à la mélasse de grenade, avec des herbes.',
          i:'🌾 Boulgour|🍅 Concentré de tomate|🌿 Persil|🧅 Ciboule|🍋 Citron|🥒 Concombre',
          t:['Végétarien','Riche en fibres'],
          nu:'Le boulgour complet a un index glycémique bas : cette salade tient plus longtemps qu\'une semoule.' },
        { cle:'tur-manti', n:'Mantı',
          d:'De minuscules raviolis à la viande, noyés sous du yaourt à l\'ail et un beurre au paprika.',
          i:'🥟 Pâte à raviolis|🥩 Viande hachée|🥛 Yaourt|🧄 Ail|🌶️ Paprika|🌿 Menthe',
          t:['Réconfortant','Protéiné'],
          nu:'Le yaourt à l\'ail est ce qui distingue ce plat : de la sauce, sans crème et avec des protéines.' },
        { cle:'tur-menemen', n:'Menemen',
          d:'Des œufs brouillés dans une poêlée de tomates et de poivrons, à saucer avec du pain — matin ou soir.',
          i:'🥚 Œufs|🍅 Tomate|🫑 Poivron|🧅 Oignon|🫒 Huile d\'olive|🥖 Pain',
          t:['Végétarien','Protéiné'],
          nu:'Deux œufs, c\'est une douzaine de grammes de protéines : de quoi faire un vrai petit déjeuner salé.' },
        { cle:'tur-mercimek-corbasi', n:'Mercimek çorbası',
          d:'La soupe de lentilles corail qu\'on sert partout en Turquie, lissée au mixeur et relevée au citron.',
          i:'🫘 Lentilles corail|🥕 Carotte|🧅 Oignon|🥔 Pomme de terre|🌶️ Paprika|🍋 Citron',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Une soupe qui apporte des protéines : c\'est rare, et c\'est la lentille qui le permet.' },
        { cle:'tur-pide-legumes', n:'Pide aux légumes',
          d:'La « barque » de pâte turque garnie de légumes rôtis et de fromage, cuite jusqu\'à ce que les bords croustillent.',
          i:'🥖 Pâte à pide|🫑 Poivron|🍆 Aubergine|🍅 Tomate|🧀 Feta|🌿 Persil',
          t:['Végétarien','Réconfortant'],
          nu:'Sa pâte est plus fine qu\'une pizza : même plaisir, une bonne part de féculent en moins.' }
      ]
    },
    {
      cle: 'viet', nom: 'Vietnam', drapeau: '🇻🇳',
      accroche: 'Des bouillons transparents, des herbes crues à la poignée',
      plats: [
        { cle:'viet-banh-mi-poulet', n:'Bánh mì au poulet',
          d:'Une baguette croustillante garnie de poulet mariné, carottes marinées, concombre et coriandre.',
          i:'🥖 Baguette|🍗 Poulet|🥕 Carotte|🥒 Concombre|🌿 Coriandre|🌶️ Piment',
          t:['Protéiné'],
          nu:'Les légumes marinés remplacent la sauce : un sandwich qui n\'a besoin ni de beurre ni de mayonnaise.' },
        { cle:'viet-poisson-vapeur', n:'Poisson vapeur au gingembre',
          d:'Un filet de poisson blanc cuit à la vapeur avec du gingembre et de la ciboule, arrosé de sauce soja chaude.',
          i:'🐟 Poisson blanc|🫚 Gingembre|🧅 Ciboule|🥢 Sauce soja|🍚 Riz|🌿 Coriandre',
          t:['Protéiné','Léger'],
          nu:'La vapeur ne demande aucune matière grasse : c\'est la cuisson la plus sobre pour un poisson.' },
        { cle:'viet-pho-bo', n:'Phở bò',
          d:'Le bouillon de bœuf mijoté des heures aux épices, versé brûlant sur des nouilles de riz et du bœuf cru.',
          i:'🍜 Nouilles de riz|🥩 Bœuf|🥢 Bouillon|🌿 Coriandre|🌱 Pousses de soja|🍋 Citron vert',
          t:['Protéiné','Réconfortant'],
          nu:'Le bœuf cuit dans le bol, au contact du bouillon : rien n\'est frit, rien n\'est saisi à l\'huile.' },
        { cle:'viet-pho-chay', n:'Phở chay',
          d:'Le phở végétarien : un bouillon de champignons et d\'épices, du tofu et beaucoup d\'herbes fraîches.',
          i:'🍜 Nouilles de riz|🧊 Tofu|🍄 Champignons|🥢 Bouillon|🌱 Pousses de soja|🌿 Basilic thaï',
          t:['Végétarien','Léger'],
          nu:'Le champignon séché donne au bouillon la profondeur que la viande apporte d\'habitude.' },
        { cle:'viet-rouleaux-crevettes', n:'Rouleaux de printemps aux crevettes',
          d:'Des galettes de riz roulées à froid sur des crevettes, des vermicelles et des herbes, avec une sauce cacahuète.',
          i:'🍤 Crevettes|🥬 Salade|🌿 Menthe|🍜 Vermicelles de riz|🥕 Carotte|🥜 Sauce cacahuète',
          t:['Léger','Protéiné'],
          nu:'Tout est cru ou juste blanchi : c\'est la sauce cacahuète qui pèse, elle se dose à part.' }
      ]
    }
  ];

  /* ── Index & accès ─────────────────────────────────────────
     Les ingrédients sont dépliés une fois pour toutes : « 🥩 Bœuf »
     devient { e:'🥩', n:'Bœuf' }. Faire ce découpage à chaque rendu
     coûterait 400 `split` par ouverture de rangée, pour un résultat
     qui ne change jamais. */

  var TOUS = [];
  CUISINES.forEach(function (c) {
    c.plats.forEach(function (p) {
      p.cuisine = c.cle;
      p.paysNom = c.nom;
      p.drapeau = c.drapeau;
      p.ingr = p.i.split('|').map(function (s) {
        var i = s.indexOf(' ');
        return { e: s.slice(0, i), n: s.slice(i + 1) };
      });
      TOUS.push(p);
    });
  });

  function img(p) { return BASE + (p.cle || p) + '.jpg'; }
  function vignette(p) { return BASE + (p.cle || p) + '-t.jpg'; }

  function cuisines() { return CUISINES; }
  function cuisine(cle) {
    return CUISINES.filter(function (c) { return c.cle === cle; })[0] || null;
  }
  function tous() { return TOUS; }
  function parCuisine(cle) { var c = cuisine(cle); return c ? c.plats : []; }
  function parTag(tag) {
    return TOUS.filter(function (p) { return p.t.indexOf(tag) > -1; });
  }
  function tags() { return TAGS; }
  function platParCle(cle) {
    return TOUS.filter(function (p) { return p.cle === cle; })[0] || null;
  }

  /* Une sélection qui change chaque jour, mais qui ne bouge PAS d'un
     rendu à l'autre dans la même journée : `Math.random()` ferait
     sauter les cartes à chaque retour sur l'écran, et on ne pourrait
     jamais retrouver le plat qu'on venait de voir. La graine est la
     date locale (`Natty.jour()`, jamais toISOString — cf. CLAUDE.md).
     Un plat par cuisine au maximum : sinon le tirage sort trois currys
     thaïs et la sélection du jour n'a plus rien d'un tour du monde. */
  function graine(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  function selection(n) {
    var h = graine((window.Natty && Natty.jour) ? Natty.jour() : 'natty');
    var suite = TOUS.map(function (p, i) {
      h = (h * 1103515245 + 12345 + i) >>> 0;
      return { p: p, r: h };
    }).sort(function (a, b) { return a.r - b.r; });
    var vus = {}, out = [];
    suite.forEach(function (x) {
      if (out.length >= (n || 8)) return;
      if (vus[x.p.cuisine]) return;
      vus[x.p.cuisine] = true;
      out.push(x.p);
    });
    // Moins de cuisines que de places demandées : on complète sans la règle.
    suite.forEach(function (x) {
      if (out.length >= (n || 8)) return;
      if (out.indexOf(x.p) < 0) out.push(x.p);
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     La visionneuse plein écran
     ══════════════════════════════════════════════════════════
     Le geste latéral est un simple `scroll-snap-type:x mandatory`,
     pas un suivi de pointeur maison. C'est délibéré : le jeu « Tier
     list » de narration.html a coûté une session entière à cause de
     `setPointerCapture` qui laissait des gestes inachevés (CLAUDE.md
     §7). Ici le navigateur fait tout — inertie, rebond, accessibilité
     clavier — et il n'y a aucun état à tenir.
     ══════════════════════════════════════════════════════════ */

  var racine = null, piste = null, jauge = null;
  var LISTE = [], INDEX = 0, TITRE = '';
  var scrollBloque = '';

  var CSS = [
    '#ndec{position:fixed;inset:0;z-index:880;display:none;background:#000;color:#fff;',
      "font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}",
    '#ndec.on{display:block}',
    /* La colonne : les photos sont en portrait, les étirer sur un écran
       large les rognerait aux deux tiers. Le noir de part et d'autre est
       le bord de l'image, pas un fond d'interface. */
    '#ndec .nd-col{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);',
      'width:100%;max-width:var(--col,480px);overflow:hidden;background:#0a0a0c}',
    '#ndec .nd-track{position:absolute;inset:0;display:flex;overflow-x:auto;overflow-y:hidden;',
      'scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;',
      'overscroll-behavior-x:contain}',
    '#ndec .nd-track::-webkit-scrollbar{display:none}',
    '#ndec .nd-sl{position:relative;flex:0 0 100%;width:100%;height:100%;',
      'scroll-snap-align:center;scroll-snap-stop:always;overflow:hidden}',
    '#ndec .nd-ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;',
      'opacity:0;transition:opacity .5s ease}',
    '#ndec .nd-ph.vu{opacity:1}',
    /* Deux voiles, pas un seul : le haut porte la jauge et le retour, le bas
       porte tout le texte. Un dégradé unique sur toute la hauteur assombrirait
       le milieu de la photo, c'est-à-dire le plat. */
    '#ndec .nd-hz{position:absolute;left:0;right:0;top:0;height:220px;',
      'background:linear-gradient(180deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.25) 55%,rgba(0,0,0,0) 100%);',
      'pointer-events:none}',
    /* ⚠️ Le voile du bas s'est déjà révélé trop lourd une fois : à .82 sur
       ses 26 premiers pour cent, il éteignait le plat au lieu de porter le
       texte, et l'écran entier virait au noir. Il tombe vite, et il ne
       devient franc que sous le titre. */
    '#ndec .nd-bz{position:absolute;left:0;right:0;bottom:0;height:70%;',
      'background:linear-gradient(0deg,rgba(0,0,0,.93) 0%,rgba(0,0,0,.74) 26%,',
      'rgba(0,0,0,.30) 58%,rgba(0,0,0,0) 100%);pointer-events:none}',

    /* ── Barre du haut ── */
    '#ndec .nd-top{position:absolute;left:0;right:0;top:0;z-index:6;',
      'padding:calc(10px + env(safe-area-inset-top,0px)) 16px 0}',
    '#ndec .nd-jauge{display:flex;gap:4px}',
    '#ndec .nd-seg{flex:1;height:2.5px;border-radius:2px;background:rgba(255,255,255,.28)}',
    '#ndec .nd-seg.on{background:#fff}',
    '#ndec .nd-bar{display:flex;align-items:center;gap:12px;margin-top:14px}',
    '#ndec .nd-back{width:38px;height:38px;flex:none;border:none;border-radius:50%;padding:0;',
      'background:rgba(0,0,0,.45);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
      'color:#fff;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;',
      'justify-content:center}',
    '#ndec .nd-back:active{transform:scale(.92)}',
    '#ndec .nd-ttl{flex:1;min-width:0;font-weight:800;font-size:13px;letter-spacing:.3px;',
      'text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      'text-shadow:0 1px 8px rgba(0,0,0,.6)}',
    '#ndec .nd-num{flex:none;font-size:12px;font-weight:700;opacity:.75}',

    /* ── Contenu du bas ──
       ⚠️ `max-height` À 58 %, ET C'EST LE RÉGLAGE CENTRAL DE L'ÉCRAN. La
       fiche complète (nom, description, étiquettes, note, ingrédients,
       bouton) fait deux fois la hauteur d'un iPhone : affichée d'un bloc,
       elle recouvrait la photo entière — donc la seule raison d'être d'une
       page plein écran. Au-delà de 58 %, le bloc défile SUR LUI-MÊME : on
       voit d'emblée le plat, son nom et à quoi il ressemble, et on va
       chercher les ingrédients d'un pouce si on les veut. */
    '#ndec .nd-body{position:absolute;left:0;right:0;bottom:0;z-index:5;',
      'padding:0 20px calc(18px + env(safe-area-inset-bottom,0px));',
      'max-height:58%;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
    /* ⚠️⚠️ LE VERRE EST NOIR, PAS BLANC, ET C'EST UN DÉFAUT TROUVÉ À
       L'ÉCRAN. Ces pastilles étaient en `rgba(255,255,255,.16)` avec du
       texte blanc : sur une photo sombre elles se lisaient très bien, sur
       une photo claire elles devenaient LITTÉRALEMENT INVISIBLES — la
       pastille « 🇻🇳 Vietnam » du phở apparaissait vide, un rectangle flou
       sans texte. Un voile clair sous du texte blanc n'a de contraste que
       par accident, selon le plat photographié. Le verre sombre, lui,
       fonctionne sur les 66. */
    '#ndec .nd-pays{display:inline-flex;align-items:center;gap:7px;',
      'background:rgba(0,0,0,.45);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
      'border-radius:999px;padding:6px 13px;font-size:11.5px;font-weight:800;letter-spacing:.3px;',
      'text-transform:uppercase}',
    '#ndec .nd-nom{font-weight:900;font-size:29px;line-height:1.08;letter-spacing:-.6px;margin-top:12px;',
      'text-shadow:0 2px 14px rgba(0,0,0,.75)}',
    '#ndec .nd-desc{font-size:14px;line-height:1.5;opacity:.94;margin-top:9px;',
      'text-shadow:0 1px 10px rgba(0,0,0,.8)}',
    '#ndec .nd-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:13px}',
    '#ndec .nd-tag{border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:5px 11px;',
      'background:rgba(0,0,0,.35);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);',
      'font-size:10.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase}',
    /* La note nutrition est le seul bloc encadré : c'est l'apport de Natty
       sur une page qui, sans elle, ne serait qu'un beau catalogue. */
    '#ndec .nd-note{display:flex;gap:10px;margin-top:15px;padding:12px 14px;border-radius:16px;',
      'background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);',
      'font-size:12.5px;line-height:1.45}',
    '#ndec .nd-note .nd-em{flex:none;font-size:15px;line-height:1.2}',
    '#ndec .nd-sst{font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;',
      'opacity:.72;margin:17px 0 9px;text-shadow:0 1px 8px rgba(0,0,0,.9)}',
    '#ndec .nd-ings{display:flex;flex-wrap:wrap;gap:7px}',
    '#ndec .nd-ing{display:inline-flex;align-items:center;gap:6px;border:none;cursor:pointer;',
      'background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);',
      'color:#fff;font-family:inherit;border-radius:999px;',
      'padding:8px 13px;font-size:12px;font-weight:700;transition:background .18s,transform .12s}',
    '#ndec .nd-ing:active{transform:scale(.95)}',
    '#ndec .nd-ing.on{background:#fff;color:#101014}',
    '#ndec .nd-ing .nd-k{font-weight:900}',
    '#ndec .nd-cta{width:100%;margin-top:16px;border:none;border-radius:999px;padding:15px;',
      'background:#fff;color:#101014;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer}',
    '#ndec .nd-cta:active{transform:scale(.98)}',
    '#ndec .nd-cta[disabled]{opacity:.5}',

    /* ── L'indice de geste ──
       Il ne s'affiche que la première fois, et il s'efface au premier
       glissement : un tutoriel qui reste à l'écran alors qu'on a déjà
       compris devient du bruit. */
    /* ⚠️ Centré verticalement, l'indice tombait pile sur le nom du plat : la
       fiche occupe le bas de l'écran, le milieu de la FENÊTRE est donc le
       haut de la fiche. Il se pose dans le tiers haut, sur la photo. */
    '#ndec .nd-hint{position:absolute;right:16px;top:30%;z-index:6;transform:translateY(-50%);',
      'display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:999px;',
      'background:rgba(0,0,0,.48);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
      'font-size:11.5px;font-weight:800;pointer-events:none;',
      'animation:ndHint 2.4s ease-in-out infinite;transition:opacity .35s ease}',
    '#ndec .nd-hint.off{opacity:0}',
    '@keyframes ndHint{0%,100%{transform:translate(0,-50%)}50%{transform:translate(-8px,-50%)}}',

    '#ndec .nd-toast{position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));',
      'transform:translate(-50%,14px);z-index:10;background:#fff;color:#101014;border-radius:18px;',
      'padding:12px 20px;font-size:12.5px;font-weight:700;opacity:0;pointer-events:none;',
      'transition:all .3s cubic-bezier(.4,0,.2,1);white-space:nowrap;max-width:88vw;overflow:hidden;',
      'text-overflow:ellipsis}',
    '#ndec .nd-toast.on{opacity:1;transform:translate(-50%,0)}'
  ].join('');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function uid() { return (window.Natty && Natty.USER_ID) || 'anon'; }

  function listeDispo() { return !!window.NattyListe && !!NattyListe.basculerExtra; }
  function dansLaListe(nom) {
    return listeDispo() ? NattyListe.contientExtra(uid(), nom) : false;
  }

  function monter() {
    if (racine) return;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    racine = document.createElement('div');
    racine.id = 'ndec';
    racine.innerHTML =
        '<div class="nd-col">'
      +   '<div class="nd-track" id="ndTrack"></div>'
      +   '<div class="nd-hz"></div>'
      +   '<div class="nd-top">'
      +     '<div class="nd-jauge" id="ndJauge"></div>'
      +     '<div class="nd-bar">'
      +       '<button class="nd-back" id="ndBack" aria-label="Fermer">✕</button>'
      +       '<div class="nd-ttl" id="ndTitre"></div>'
      +       '<div class="nd-num" id="ndNum"></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="nd-hint" id="ndHint">Glissez <span>→</span></div>'
      + '</div>'
      + '<div class="nd-toast" id="ndToast"></div>';
    document.body.appendChild(racine);

    piste = racine.querySelector('#ndTrack');
    jauge = racine.querySelector('#ndJauge');
    racine.querySelector('#ndBack').addEventListener('click', fermer);

    /* ⚠️ Le voile du haut (`.nd-hz`) est posé APRÈS la piste dans le DOM :
       sans `pointer-events:none` sur lui, il avalerait le geste de
       défilement sur le tiers haut de l'écran. La règle est dans le CSS,
       ce commentaire est là pour qu'on ne la retire pas « pour tester ». */

    piste.addEventListener('scroll', function () {
      if (piste._raf) return;
      piste._raf = requestAnimationFrame(function () {
        piste._raf = 0;
        var i = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth));
        if (i !== INDEX) { INDEX = i; majJauge(); }
        if (piste.scrollLeft > 12) cacherIndice();
      });
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (!racine.classList.contains('on')) return;
      if (e.key === 'Escape') fermer();
      if (e.key === 'ArrowRight') aller(INDEX + 1);
      if (e.key === 'ArrowLeft') aller(INDEX - 1);
    });

    // Les ingrédients : un seul écouteur pour toute la visionneuse, les
    // diapositives étant réécrites à chaque ouverture.
    racine.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-ing]');
      if (b) { basculerIngredient(b); return; }
      var t = e.target.closest && e.target.closest('[data-tout]');
      if (t) toutAjouter(t.dataset.tout);
    });
  }

  function cacherIndice() {
    var h = racine.querySelector('#ndHint');
    if (h) h.classList.add('off');
    try { localStorage.setItem('natty_decouverte_geste', '1'); } catch (e) {}
  }

  var toastT;
  function toast(msg) {
    var t = racine.querySelector('#ndToast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 2000);
  }

  function diapo(p, i) {
    var achete = listeDispo();
    return '<div class="nd-sl" data-i="' + i + '">'
      + '<img class="nd-ph" alt="" src="' + img(p) + '" '
      +   (i < 2 ? '' : 'loading="lazy" ')
      +   'onload="this.classList.add(\'vu\')">'
      + '<div class="nd-bz"></div>'
      + '<div class="nd-body">'
      +   '<span class="nd-pays">' + p.drapeau + ' ' + esc(p.paysNom) + '</span>'
      +   '<div class="nd-nom">' + esc(p.n) + '</div>'
      +   '<div class="nd-desc">' + esc(p.d) + '</div>'
      +   '<div class="nd-tags">' + p.t.map(function (x) {
            return '<span class="nd-tag">' + esc(x) + '</span>';
          }).join('') + '</div>'
      +   '<div class="nd-note"><span class="nd-em">💡</span><span>' + esc(p.nu) + '</span></div>'
      +   '<div class="nd-sst">Ce qu\'il y a dedans</div>'
      +   '<div class="nd-ings">' + p.ingr.map(function (g) {
            var on = achete && dansLaListe(g.n);
            return '<button class="nd-ing' + (on ? ' on' : '') + '" data-ing="' + esc(g.n) + '"'
              + ' data-em="' + esc(g.e) + '"' + (achete ? '' : ' disabled')
              + '><span>' + g.e + '</span><span class="nd-k">' + esc(g.n) + '</span></button>';
          }).join('') + '</div>'
      +   (achete
            ? '<button class="nd-cta" data-tout="' + esc(p.cle) + '">Tout ajouter à mes courses</button>'
            : '')
      + '</div>'
      + '</div>';
  }

  function majJauge() {
    var segs = jauge.children;
    for (var i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i <= INDEX);
    var p = LISTE[INDEX];
    racine.querySelector('#ndNum').textContent = (INDEX + 1) + '/' + LISTE.length;
    racine.querySelector('#ndTitre').textContent = TITRE || (p ? p.paysNom : '');
  }

  function aller(i) {
    if (i < 0 || i >= LISTE.length) return;
    piste.scrollTo({ left: i * piste.clientWidth, behavior: 'smooth' });
  }

  function basculerIngredient(btn) {
    if (!listeDispo()) return;
    var nom = btn.dataset.ing;
    var ajoute = NattyListe.basculerExtra(uid(), nom, btn.dataset.em);
    // Le même ingrédient peut apparaître sur plusieurs plats de la liste :
    // toutes ses pastilles doivent bouger, pas seulement celle qu'on a touchée.
    racine.querySelectorAll('[data-ing="' + CSS_ESC(nom) + '"]').forEach(function (b) {
      b.classList.toggle('on', ajoute);
    });
    toast(ajoute ? nom + ' ajouté à vos courses' : nom + ' retiré de vos courses');
  }

  // Un nom d'ingrédient peut contenir une apostrophe (« Huile d'olive ») :
  // le glisser tel quel dans un sélecteur d'attribut casserait la requête.
  function CSS_ESC(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function toutAjouter(cle) {
    if (!listeDispo()) return;
    var p = platParCle(cle);
    if (!p) return;
    var n = 0;
    p.ingr.forEach(function (g) {
      if (!dansLaListe(g.n)) { NattyListe.basculerExtra(uid(), g.n, g.e); n++; }
    });
    racine.querySelectorAll('[data-ing]').forEach(function (b) {
      b.classList.toggle('on', dansLaListe(b.dataset.ing));
    });
    toast(n ? n + (n > 1 ? ' ingrédients ajoutés' : ' ingrédient ajouté') + ' à vos courses'
            : 'Tout est déjà dans vos courses');
  }

  /**
   * Ouvre la visionneuse.
   * @param {Object} o {plats:[], index:0, titre:''}
   */
  function ouvrir(o) {
    o = o || {};
    LISTE = (o.plats && o.plats.length) ? o.plats : TOUS;
    INDEX = Math.max(0, Math.min(LISTE.length - 1, o.index || 0));
    TITRE = o.titre || '';
    monter();

    piste.innerHTML = LISTE.map(diapo).join('');
    jauge.innerHTML = LISTE.map(function () { return '<div class="nd-seg"></div>'; }).join('');

    var deja = false;
    try { deja = !!localStorage.getItem('natty_decouverte_geste'); } catch (e) {}
    racine.querySelector('#ndHint').classList.toggle('off', deja || LISTE.length < 2);

    racine.classList.add('on');
    scrollBloque = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    /* ⚠️ Le positionnement se fait APRÈS l'affichage, et sans animation.
       Tant que `#ndec` est en `display:none`, `clientWidth` vaut 0 : un
       `scrollTo` calculé là-dessus ramène systématiquement à la première
       diapositive, quel que soit le plat sur lequel on a tapé. */
    piste.scrollLeft = INDEX * piste.clientWidth;
    majJauge();
  }

  function fermer() {
    if (!racine) return;
    racine.classList.remove('on');
    document.body.style.overflow = scrollBloque;
    // Les photos gardent leur place en mémoire tant que la piste existe ;
    // on la vide pour qu'un aller-retour ne cumule pas douze plein écran.
    piste.innerHTML = '';
    if (typeof window.NattyDecouverteFermee === 'function') window.NattyDecouverteFermee();
  }

  return {
    cuisines: cuisines, cuisine: cuisine, parCuisine: parCuisine,
    tous: tous, parTag: parTag, tags: tags, selection: selection,
    platParCle: platParCle, img: img, vignette: vignette,
    ouvrir: ouvrir, fermer: fermer,
    estOuverte: function () { return !!racine && racine.classList.contains('on'); }
  };
})();
