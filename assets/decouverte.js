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
    /* ⚠️ « Le quotidien » est EN TÊTE, et hors de la suite alphabétique — à
       dessein. Ce n'est pas un pays : le ranger entre le Pérou et les
       Philippines ferait passer la cuisine de tous les jours pour une cuisine
       étrangère de plus. C'est aussi le groupe dans lequel la génération de la
       semaine puise le plus (voir `api/_catalogue.js`), donc celui qu'on veut
       voir en premier.
       ⚠️ Ses plats n'ont AUCUNE photo, et c'est assumé : personne ne les a
       photographiés et on ne va pas en chercher sur le web (règle §9 #24). Ils
       portent un `svg`, une forme de `assets/plats-illu.js`. Un plat porte donc
       soit une photo, soit une illustration, jamais les deux — c'est `img()` et
       `vignette()` qui tranchent, en rendant `null` quand `svg` est là. */
    {
      cle: 'quo', nom: 'Le quotidien', drapeau: '🍽️',
      accroche: 'Ce qu\'on cuisine vraiment en semaine, sans y passer la soirée',
      plats: [
        { cle:'quo-poulet-roti', n:'Poulet rôti et légumes racines', svg:'grillade',
          d:'Une cuisse ou un blanc au four avec ce qu\'il reste de légumes, tout sur la même plaque.',
          i:'🍗 Poulet|🥔 Pommes de terre|🥕 Carotte|🧅 Oignon|🧄 Ail|🫒 Huile d\'olive',
          t:['Protéiné','Réconfortant'],
          nu:'Une plaque unique, donc un seul plat à laver : c\'est ce qui fait qu\'on le refait.' },
        { cle:'quo-steak-haricots', n:'Steak, haricots verts et purée', svg:'assiette',
          d:'Le classique du soir : une pièce de bœuf saisie, des haricots vapeur, une purée maison.',
          i:'🥩 Steak|🫛 Haricots verts|🥔 Pommes de terre|🥛 Lait|🧈 Beurre',
          t:['Protéiné'],
          nu:'Le fer du bœuf s\'absorbe mieux avec des légumes verts dans la même assiette.' },
        { cle:'quo-omelette-champignons', n:'Omelette aux champignons', svg:'oeuf',
          d:'Trois œufs battus, des champignons poêlés à part, du persil au dernier moment.',
          i:'🥚 Œufs|🍄 Champignons|🧅 Oignon|🌿 Persil|🧈 Beurre',
          t:['Protéiné','Végétarien'],
          nu:'Des protéines complètes en dix minutes, quand il n\'y a plus rien au frigo.' },
        { cle:'quo-pates-bolognaise', n:'Pâtes à la bolognaise', svg:'pates',
          d:'Une sauce mijotée à la viande hachée et à la tomate, sur des pâtes al dente.',
          i:'🍝 Pâtes|🥩 Bœuf haché|🍅 Tomates|🧅 Oignon|🥕 Carotte|🧄 Ail',
          t:['Protéiné','Réconfortant'],
          nu:'La carotte n\'est pas décorative : elle adoucit l\'acidité de la tomate sans sucre ajouté.' },
        { cle:'quo-saumon-riz', n:'Saumon vapeur, riz et brocoli', svg:'poisson',
          d:'Un pavé cuit à la vapeur ou au four, du riz, un brocoli encore ferme.',
          i:'🐟 Saumon|🍚 Riz|🥦 Brocoli|🍋 Citron|🫒 Huile d\'olive',
          t:['Protéiné','Léger'],
          nu:'Les oméga-3 du saumon couvrent une bonne part des lipides du jour sans huile ajoutée.' },
        { cle:'quo-cesar-poulet', n:'Salade César au poulet', svg:'bol',
          d:'De la salade croquante, du poulet grillé, du parmesan et des croûtons.',
          i:'🥬 Salade romaine|🍗 Poulet|🧀 Parmesan|🍞 Croûtons|🥚 Œuf',
          t:['Protéiné'],
          nu:'C\'est la sauce qui décide : montée au yaourt, elle divise les lipides par trois.' },
        { cle:'quo-gratin-courgettes', n:'Gratin de courgettes', svg:'gratin',
          d:'Des courgettes en rondelles, un peu de crème, du fromage râpé, vingt minutes au four.',
          i:'🥒 Courgette|🧀 Fromage râpé|🥛 Crème|🥚 Œufs|🧄 Ail',
          t:['Végétarien','Réconfortant'],
          nu:'Faire dégorger les courgettes avant : sinon le gratin rend son eau et ne gratine pas.' },
        { cle:'quo-soupe-legumes', n:'Soupe de légumes du placard', svg:'soupe',
          d:'Ce qui traîne au bac à légumes, mijoté puis mixé.',
          i:'🥕 Carotte|🥔 Pomme de terre|🧅 Oignon|🥬 Poireau|🌿 Thym',
          t:['Végétarien','Léger','Riche en fibres'],
          nu:'Une soupe rassasie peu à elle seule : elle demande un vrai apport de protéines à côté.' },
        { cle:'quo-croque-monsieur', n:'Croque-monsieur maison', svg:'sandwich',
          d:'Pain de mie, jambon, béchamel légère et gruyère, passé au four.',
          i:'🍞 Pain de mie|🥓 Jambon|🧀 Gruyère|🥛 Lait|🧈 Beurre',
          t:['Réconfortant'],
          nu:'Au four plutôt qu\'à la poêle : le beurre de cuisson y est divisé par deux.' },
        { cle:'quo-quiche-lorraine', n:'Quiche lorraine', svg:'tarte',
          d:'Une pâte brisée, des lardons, un appareil aux œufs et à la crème.',
          i:'🥧 Pâte brisée|🥓 Lardons|🥚 Œufs|🥛 Crème|🧀 Gruyère',
          t:['Réconfortant'],
          nu:'Une part se marie mal seule : une salade verte à côté équilibre le repas.' },
        { cle:'quo-burger-maison', n:'Burger maison', svg:'burger',
          d:'Un steak haché saisi, du cheddar, de la salade et une sauce montée soi-même.',
          i:'🍔 Pain à burger|🥩 Steak haché|🧀 Cheddar|🥬 Salade|🍅 Tomate|🧅 Oignon',
          t:['Protéiné','Réconfortant'],
          nu:'Fait maison, il tombe autour de 600 kcal — la moitié de son équivalent en fast-food.' },
        { cle:'quo-skyr-granola', n:'Skyr, fruits et granola', svg:'laitier',
          d:'Un grand bol de skyr, des fruits frais, une poignée de granola.',
          i:'🥛 Skyr|🍓 Fruits rouges|🍌 Banane|🌾 Granola|🍯 Miel',
          t:['Protéiné'],
          nu:'11 g de protéines pour 100 g : c\'est l\'appoint le plus simple quand la cible du jour est haute.' },
        { cle:'quo-riz-cantonais', n:'Riz sauté aux légumes et œuf', svg:'poele',
          d:'Du riz de la veille, sauté à feu vif avec un œuf brouillé et des petits légumes.',
          i:'🍚 Riz|🥚 Œufs|🥕 Carotte|🫛 Petits pois|🧅 Oignon|🫙 Sauce soja',
          t:['Réconfortant'],
          nu:'Le riz de la veille tient mieux à la poêle : refroidi, son amidon ne colle plus.' },
        { cle:'quo-brochettes-poulet', n:'Brochettes de poulet mariné', svg:'brochette',
          d:'Des cubes de poulet marinés au yaourt et aux épices, passés au gril.',
          i:'🍗 Poulet|🥛 Yaourt|🌶️ Paprika|🍋 Citron|🧄 Ail|🫑 Poivron',
          t:['Protéiné','Épicé'],
          nu:'La marinade au yaourt attendrit la chair : vingt minutes suffisent à changer la texture.' },
        { cle:'quo-porridge-avoine', n:'Porridge d\'avoine', svg:'porridge',
          d:'Des flocons cuits dans du lait, garnis de fruits et d\'oléagineux.',
          i:'🌾 Flocons d\'avoine|🥛 Lait|🍌 Banane|🌰 Amandes|🍯 Miel',
          t:['Végétarien','Riche en fibres'],
          nu:'60 g de glucides pour 100 g de flocons : c\'est le petit déjeuner des grosses cibles.' },
        { cle:'quo-ratatouille', n:'Ratatouille', svg:'legumes',
          d:'Aubergine, courgette, poivron et tomate mijotés séparément puis réunis.',
          i:'🍆 Aubergine|🥒 Courgette|🫑 Poivron|🍅 Tomate|🧅 Oignon|🌿 Herbes',
          t:['Végétarien','Léger','Riche en fibres'],
          nu:'Cuire les légumes séparément avant de les réunir : ensemble, ils se noient et fondent en purée.' },
        { cle:'quo-dahl-lentilles', n:'Dahl de lentilles corail', svg:'bol',
          d:'Des lentilles corail fondues dans du lait de coco et des épices, sur du riz.',
          i:'🫘 Lentilles corail|🥥 Lait de coco|🍅 Tomate|🫚 Gingembre|🌶️ Curry|🍚 Riz',
          t:['Végétarien','Épicé','Riche en fibres'],
          nu:'Lentilles et riz ensemble donnent des protéines complètes, ce qu\'aucun des deux ne fait seul.' },
        { cle:'quo-cabillaud-poele', n:'Cabillaud poêlé et écrasé de pommes de terre', svg:'poisson',
          d:'Un dos de cabillaud saisi au beurre, un écrasé de pommes de terre à l\'huile d\'olive.',
          i:'🐟 Cabillaud|🥔 Pommes de terre|🍋 Citron|🌿 Aneth|🫒 Huile d\'olive',
          t:['Protéiné','Léger'],
          nu:'Beaucoup de protéines pour très peu de lipides : le plat qui rattrape un jour trop gras.' },
        { cle:'quo-buddha-bowl', n:'Buddha bowl', svg:'bol',
          d:'Une céréale, une légumineuse, des crudités et une sauce, montés en bol.',
          i:'🌾 Quinoa|🫘 Pois chiches|🥑 Avocat|🥕 Carotte|🥬 Épinards|🌰 Graines',
          t:['Végétarien','Riche en fibres'],
          nu:'La formule tient sans recette : une céréale, une légumineuse, deux légumes, une sauce.' },
        { cle:'quo-escalope-dinde', n:'Escalope de dinde, riz et brocoli', svg:'assiette',
          d:'Une escalope poêlée deux minutes par face, du riz, un brocoli vapeur.',
          i:'🦃 Dinde|🍚 Riz|🥦 Brocoli|🍋 Citron|🌿 Herbes',
          t:['Protéiné','Léger'],
          nu:'L\'assiette la plus sobre du lot : c\'est celle qu\'on refait sans y penser.' },
        /* ⚠️ Le seul plat de ce groupe SANS `svg` — il a été photographié
           (photo fournie par Pablo, 2026-08-16), et un plat porte soit une
           photo soit une illustration, jamais les deux : `img()` rend `null`
           dès qu'un `svg` est là, donc laisser la clé aurait masqué la photo. */
        { cle:'quo-pita-saumon-feta', n:'Pita au saumon et feta',
          d:'Un pain pita tiédi, du saumon, de la feta émiettée et des crudités en bâtonnets, avec une crème au yaourt et aux herbes.',
          i:'🐟 Saumon|🧀 Feta|🫓 Pain pita|🥒 Concombre|🥕 Carotte|🌿 Aneth|🥛 Yaourt|🍋 Citron',
          t:['Protéiné','Rapide','Léger'],
          nu:'Saumon et feta apportent les protéines, le yaourt remplace la sauce grasse : on garde le moelleux sans le poids.' }
      ]
    },
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
          nu:'Aucune cuisson, aucune matière grasse ajoutée : le plat le plus léger de cette page.',
          /* ⚠️ LE PREMIER PLAT DU CATALOGUE QUI PORTE UNE VRAIE RECETTE (2026-08-19,
             demande de Pablo : « que je puisse la réaliser dans l'application »).
             Voir l'encadré « Un plat qui se cuisine » plus bas : `rec` est
             facultatif, et les 92 autres plats se comportent exactement comme
             avant. Schéma identique à celui que rend la génération de la semaine
             (`api/_generation.js`), pour que `assets/recette.js` et
             `assets/planning.js` n'aient rien de particulier à apprendre.
             Les macros sont PAR PORTION et calculées avec la table de
             `assets/core.js` sur ces grammages-là — pas estimées à vue. */
          rec:{
            temps_min:40, portions:2,
            macros:{ p:29, g:14, l:11, kcal:258 },
            ingredients:[
              { em:'🐟', nom:'Cabillaud',   qte:'300 g (dos extra-frais)' },
              { em:'🍋', nom:'Citron vert', qte:'4 (≈ 120 ml de jus)' },
              { em:'🧅', nom:'Oignon rouge', qte:'60 g (½)' },
              { em:'🌶️', nom:'Piment',       qte:'10 g (1 petit)' },
              { em:'🌿', nom:'Coriandre',   qte:'10 g (½ bouquet)' },
              { em:'🥑', nom:'Avocat',      qte:'130 g (1)' },
              { em:'🧂', nom:'Sel',         qte:'1 c. à café' }
            ],
            steps:[
              { illu:'rincer', t:'Prépare le poisson', duree_min:3,
                detail:'Rince le cabillaud à l\'eau froide, éponge-le au papier absorbant, puis passe le doigt à contre-sens de la chair pour repérer les arêtes.',
                qte:[{ nom:'Cabillaud', qte:'300 g' }],
                tip:'Il ne sera jamais chauffé : prends-le extra-frais du jour, ou surgelé décongelé la veille au réfrigérateur. Et sèche-le bien — un poisson mouillé dilue le jus et le ceviche devient fade.' },
              { illu:'couper', t:'Détaille le poisson en dés', duree_min:7,
                detail:'Des cubes réguliers d\'environ 1 cm, coupés à contre-fibre avec un couteau bien aiguisé.',
                qte:[{ nom:'Cabillaud', qte:'300 g' }],
                tip:'La taille des dés fixe le temps de marinade : 1 cm, c\'est un quart d\'heure. Plus gros, le cœur reste cru.' },
              { illu:'couper', t:'Émince l\'oignon et le piment', duree_min:4,
                detail:'Oignon rouge en lamelles les plus fines possibles, piment épépiné et haché menu.',
                qte:[{ nom:'Oignon rouge', qte:'60 g' }, { nom:'Piment rouge', qte:'10 g' }],
                tip:'Oignon trop mordant ? Cinq minutes dans l\'eau froide lui retirent son piquant sans lui retirer son croquant.' },
              { illu:'assaisonner', t:'Presse les citrons et sale', duree_min:3,
                detail:'Presse les citrons verts pour obtenir environ 120 ml de jus, ajoute le sel et remue jusqu\'à ce qu\'il fonde.',
                qte:[{ nom:'Citron vert', qte:'4' }, { nom:'Sel', qte:'1 c. à café' }],
                tip:'Le sel n\'est pas là pour le goût : c\'est lui qui fait rendre son eau au poisson et qui raffermit la chair.' },
              { illu:'melanger', t:'Réunis tout dans un bol', duree_min:1,
                detail:'Verse le jus sur les dés de poisson, ajoute l\'oignon et le piment, mélange pour que chaque morceau soit recouvert.',
                qte:[{ nom:'Cabillaud', qte:'300 g' }, { nom:'Citron vert', qte:'120 ml' }],
                tip:'Un bol en verre ou en inox, jamais en aluminium : le jus l\'attaque et laisse un goût métallique.' },
              { illu:'refrigerer', t:'Laisse « cuire » au frais', duree_min:15,
                detail:'Couvre le bol et mets-le au réfrigérateur. La chair passe de translucide à blanc opaque : c\'est ça, la cuisson.',
                tip:'15 minutes pour un cœur encore nacré, 30 pour une chair cuite à cœur. Au-delà d\'une heure elle se dessèche et devient farineuse.' },
              { illu:'couper', t:'Coupe l\'avocat au dernier moment', duree_min:3,
                detail:'Dénoyaute l\'avocat et détaille-le en dés d\'1 cm, pendant que le poisson finit de mariner.',
                qte:[{ nom:'Avocat', qte:'130 g' }],
                tip:'Coupé trop tôt il noircit. Une cuillère du jus du bol suffit à l\'en empêcher si tu dois attendre.' },
              { illu:'dresser', t:'Dresse et sers aussitôt', duree_min:2,
                detail:'Retire une partie du jus, ajoute l\'avocat et la coriandre ciselée, mélange une dernière fois et sers bien frais.',
                qte:[{ nom:'Avocat', qte:'130 g' }, { nom:'Coriandre', qte:'10 g' }],
                tip:'Laisse deux cuillères de jus au fond de l\'assiette : c\'est la leche de tigre, et c\'est la meilleure partie.' }
            ]
          } },
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

  /* ⚠️ Un plat porte SOIT une photo, SOIT une illustration — jamais les deux,
     et jamais aucune des deux. `img()` et `vignette()` rendent donc `null` sur
     un plat illustré, plutôt qu'une URL vers un `.jpg` qui n'existe pas : sans
     ça, chaque plat du quotidien poserait l'icône cassée du navigateur au
     milieu de la rangée — le défaut déjà payé sur le calendrier
     d'`assets/planning.js` et sur l'arc d'`assets/journee.js`.
     Les appelants testent donc `illu(p)` AVANT de poser une `<img>`. */
  function img(p) { return (p && p.svg) ? null : BASE + (p.cle || p) + '.jpg'; }
  function vignette(p) { return (p && p.svg) ? null : BASE + (p.cle || p) + '-t.jpg'; }

  /**
   * L'illustration d'un plat sans photo, ou null s'il en a une.
   * @param {object} p     un plat du catalogue
   * @param {object} [o]   passé tel quel à NattyPlatsIllu.svg (ex. {trait:0.9})
   * @returns {string|null} le `<svg>` complet
   */
  function illu(p, o) {
    if (!p || !p.svg || !window.NattyPlatsIllu) return null;
    // `window.` explicite : c'est ce que le garde vient de tester, et un
    // identifiant nu dépendrait de la façon dont le module a été déclaré.
    return window.NattyPlatsIllu.svg(p.svg, o);
  }

  /* ⚠️ CE QUI SE PARCOURT N'EST PAS TOUT LE CATALOGUE (demande de Pablo,
     2026-08-25 : « dans Social il ne doit y avoir aucune recette sans photo,
     celles qui n'en ont pas doivent être masquées »).
     Les 20 plats du quotidien portent une illustration au trait faute d'avoir
     été photographiés (règle §9 #24 : on ne va pas chercher d'images sur le
     web). Ils RESTENT au catalogue — la génération de la semaine y pioche ses
     plats macro, et `api/_catalogue.js` en dépend — mais ils ne se montrent
     plus : une rangée où un plat sur cinq est un dessin ne se lit pas comme un
     catalogue de cuisine, elle se lit comme des images qui n'ont pas chargé.

     ⚠️ `platParCle()` CHERCHE TOUJOURS DANS `TOUS`, ET C'EST STRUCTUREL. Un
     plat déjà placé dans une semaine, ou choisi par la génération, doit rester
     résolvable : sans lui, `visuelRecette()` et `assets/planning.js`
     retomberaient sur les deux photos de démonstration — donc sur l'assiette
     d'un AUTRE plat (le défaut du 2026-08-16). Masquer n'est pas supprimer.

     ⚠️ Une cuisine qui n'a plus un seul plat photographié disparaît de la
     rangée du haut : un carton de pays qui s'ouvre sur rien serait pire que
     son absence. « Le quotidien » n'y garde donc qu'un plat, le pita — le seul
     du groupe qui ait été photographié. */
  var VUS = TOUS.filter(function (p) { return !p.svg; });
  var CUISINES_VUES = CUISINES.map(function (c) {
    var pl = c.plats.filter(function (p) { return !p.svg; });
    if (pl.length === c.plats.length) return c;
    return { cle: c.cle, nom: c.nom, drapeau: c.drapeau, accroche: c.accroche, plats: pl };
  }).filter(function (c) { return c.plats.length > 0; });

  function cuisines() { return CUISINES_VUES; }
  function cuisine(cle) {
    return CUISINES_VUES.filter(function (c) { return c.cle === cle; })[0] || null;
  }
  function tous() { return VUS; }
  function parCuisine(cle) { var c = cuisine(cle); return c ? c.plats : []; }
  function parTag(tag) {
    return VUS.filter(function (p) { return p.t.indexOf(tag) > -1; });
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
    var suite = VUS.map(function (p, i) {
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
     La visionneuse — déléguée à `assets/visionneuse.js`
     ══════════════════════════════════════════════════════════
     Elle vivait ici, en propre. Elle est partie dans son module le jour
     où le fil social a dû ouvrir ses plats exactement de la même façon
     (demande de Pablo, août 2026) : deux visionneuses, c'est deux
     présentations à tenir à jour, donc deux qui divergent — le dépôt
     s'est déjà fait avoir trois fois là-dessus (§5, §11).

     Ne reste ici que la TRADUCTION : un plat du catalogue devient un
     item de la visionneuse. Ce module sait ce qu'est un plat du monde ;
     l'autre sait comment on regarde un plat.

     ⚠️ Toujours pas de macros — voir l'encadré en tête de fichier. La
     visionneuse affiche « Macros non estimées » d'elle-même, ce qui est
     l'aveu recherché et non un trou dans la mise en page. */

  function uid() { return (window.Natty && Natty.USER_ID) || 'anon'; }
  function listeDispo() { return !!window.NattyListe && !!NattyListe.basculerExtra; }

  /* ── Un plat qui se cuisine ─────────────────────────────────
     Demande de Pablo (2026-08-19) : « ajoute les étapes de ce plat que je
     puisse la réaliser dans l'application ». Jusqu'ici « Découvrir » montrait
     93 plats appétissants dont pas un seul ne pouvait être cuisiné : on
     pouvait copier leurs ingrédients dans ses courses, et rien d'autre.

     ⚠️ `rec` EST FACULTATIF, ET C'EST TOUT LE MONTAGE. Un plat qui n'en porte
     pas n'annonce aucune macro et n'offre pas « Cuisiner ce plat » — il n'a
     pas d'étapes à dérouler. La règle de ce fichier (« aucune macro n'est
     annoncée ») n'est donc pas levée : elle tenait à l'absence de grammages,
     et elle continue de valoir pour les 93 plats qui n'en ont pas. Un plat qui
     porte une recette a, lui, des quantités pesées — les taire serait cacher
     une donnée vraie.
     ⚠️ « Planifier », lui, ne dépend PAS de `rec` (2026-08-31) : mettre un plat
     dans sa semaine ne demande pas de savoir le cuisiner pas à pas. C'est
     `versRepas()` qui fait le pont, avec ou sans recette.

     ⚠️ LE SCHÉMA EST CELUI DE LA GÉNÉRATION (`api/_generation.js`), au champ
     près : `{cle, nom, em, temps_min, macros:{p,g,l,kcal}, ingredients:[{em,
     nom,qte}], steps:[{illu,t,detail,qte,duree_min,tip}]}`. C'est ce qui fait
     qu'`assets/recette.js` et `assets/planning.js` n'ont RIEN eu à apprendre :
     une recette du catalogue et une recette générée sont le même objet. En
     inventer un ici aurait demandé un traducteur de plus, donc un second
     endroit où les deux formats peuvent diverger. */
  /* Le même ingrédient, écrit des deux côtés — la liste courte du catalogue
     (« Piment ») et celle de la recette (« Piment rouge »).
     ⚠️ UNE ÉGALITÉ STRICTE NE SUFFIT PAS, et c'est le premier défaut qu'a
     rendu le banc : cinq pastilles portaient leur quantité, la sixième non,
     ce qui se lit comme une donnée manquante alors que la recette l'avait.
     ⚠️ MAIS PAS UNE SOUS-CHAÎNE NON PLUS : « ail » se trouve dans « volaille »
     — le piège que `getNutri` a mis des mois à corriger (CLAUDE.md §7). On
     n'accepte qu'un préfixe terminé par une espace, donc un mot entier. */
  function memeIngredient(a, b) {
    a = String(a || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    b = String(b || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (!a || !b) return false;
    return a === b || a.indexOf(b + ' ') === 0 || b.indexOf(a + ' ') === 0;
  }

  function recette(p) {
    if (typeof p === 'string') p = platParCle(p);
    if (!p || !p.rec) return null;
    var r = p.rec;
    return {
      /* La `cle` du catalogue est l'identifiant que `NattyRecette.identifiant()`
         retiendra : c'est elle qui fait que la validation, les XP et la coche du
         calendrier désignent bien CE plat, et pas un homonyme. */
      cle: p.cle,
      nom: p.n,
      em: (p.ingr[0] && p.ingr[0].e) || '🍽️',
      photo: img(p),
      illu: illu(p),
      pourquoi: p.d,
      avantages: p.nu,
      temps_min: r.temps_min || 0,
      portions: r.portions || 1,
      macros: r.macros || null,
      ingredients: r.ingredients || [],
      steps: r.steps || []
    };
  }

  /* Ce qu'un plat du catalogue devient pour `NattyPlanning.ajouter()`.
     ⚠️ ELLE MARCHE AUSSI SANS RECETTE, et c'est tout l'objet de la passe du
     2026-08-31 : « Planifier » ne concernait qu'un plat sur 94, le seul qui
     porte des étapes. On regardait 93 plats appétissants sans pouvoir en
     mettre un seul dans sa semaine.
     ⚠️ SANS `rec`, `src` VAUT `null` — jamais un objet à moitié rempli. C'est
     ce que lit `depuisPlanRepas()` (repas.html) pour décider si le plat se
     DÉROULE (« Suivre la recette ») ou se VALIDE en photo (« Réaliser ce
     repas ») : lui donner une coquille sans `steps` ferait dire au bouton
     qu'il y a des étapes à suivre, et mènerait droit à l'écran photo — le
     défaut du 2026-08-16, dans l'autre sens.
     ⚠️ Et AUCUNE macro n'est inventée : sans grammages, elles restent à zéro,
     exactement comme la visionneuse écrit « Macros non estimées ». La fiche du
     calendrier affiche alors « – g », qui est un manque visible. */
  function versRepas(p) {
    var r = p.rec ? recette(p) : null;
    var mac = (p.rec && p.rec.macros) || null;
    return {
      nom: p.n,
      em: (p.ingr[0] && p.ingr[0].e) || '🍽️',
      photo: img(p),
      illu: illu(p),
      cle: p.cle,
      pourquoi: 'Repéré dans « Découvrir » — ' + p.paysNom + '.',
      kcal: (mac && mac.kcal) || 0,
      p: (mac && mac.p) || 0,
      g: (mac && mac.g) || 0,
      l: (mac && mac.l) || 0,
      /* Les ingrédients pesés de la recette quand il y en a ; sinon la liste
         courte du catalogue, sans quantité — le plat se lit quand même dans la
         fiche du calendrier, et une quantité inventée serait pire que rien. */
      ingredients: r ? r.ingredients : p.ingr.map(function (x) {
        return { em: x.e, nom: x.n, qte: '' };
      }),
      /* ⚠️ LA RECETTE ENTIÈRE SOUS `src`, ET C'EST LE POINT. C'est de là que
         `depuisPlanRepas()` (repas.html) récupère les étapes : sans elle, un
         plat QUI EN A arriverait au héros de la semaine sans rien à dérouler
         — exactement le défaut du 2026-08-16. */
      src: r,
      source: 'decouverte'
    };
  }

  /* Les boutons du tiroir de la visionneuse.
     ⚠️ Chacun est conditionné à la présence de SON module, et « Cuisiner »
     l'est en plus à la présence d'étapes. Un bouton qui ne peut rien faire est
     pire qu'un bouton absent — même règle que « Tout ajouter à mes courses »,
     éteint quand `NattyListe` manque. */
  function actionsPour(it) {
    var p = platParCle(it && it.cle);
    if (!p) return [];
    var actes = [];

    if (p.rec && window.NattyRecette && window.NattyRecette.suivre) {
      actes.push({
        txt: '👨‍🍳 Cuisiner ce plat',
        on: function () {
          var r = recette(p);
          /* ⚠️ ON FERME LA VISIONNEUSE D'ABORD. La cinématique est en z-index
             12000 et passerait donc par-dessus — mais `#nvue` resterait monté
             sous elle, avec son `overflow:hidden` posé sur le body et sa piste
             de photos en mémoire. Fermer rend le défilement, `suivre()` le
             reprend aussitôt : les deux sont synchrones, dans cet ordre. */
          fermer();
          window.NattyRecette.suivre(r);
        }
      });
    }

    if (window.NattyPlanning && window.NattyPlanning.ajouter) {
      actes.push({
        txt: '📅 Planifier',
        /* `el` est le bouton lui-même : l'écriture est asynchrone, c'est le
           seul moyen de le relibeller au retour — la valeur rendue par `on()`
           part avant que la base ait répondu. Même raison que dans
           `social.html`, d'où ce chemin est repris. */
        on: function (item, el) {
          window.NattyPlanning.ajouter(versRepas(p)).then(function (res) {
            if (!el) return;
            if (res && res.ok) { el.textContent = 'Planifié ✓ · ' + res.quand; el.disabled = true; return; }
            var raison = res && res.raison;
            el.textContent = raison === 'doublon' ? 'Déjà prévu · ' + res.quand
              : raison === 'sans-plan' ? 'Planifiez d\'abord votre semaine'
              : raison === 'complet' ? 'Plus un créneau libre cette semaine'
              : 'Impossible pour le moment';
          }).catch(function () {
            if (el) el.textContent = 'Impossible pour le moment';
          });
        }
      });
    }

    return actes;
  }

  function versItem(p) {
    return {
      cle: p.cle,
      nom: p.n,
      photo: img(p),
      // Trait affiné : la visionneuse dessine grand (voir `#nvue .nv-illu svg`).
      illu: illu(p, { trait: 0.9 }),
      emoji: '🍽️',
      kicker: p.drapeau + ' ' + p.paysNom,
      desc: p.d,
      /* Les macros d'un plat SANS recette restent nulles — la visionneuse
         affiche alors « Macros non estimées », ce qui est la vérité. Avec une
         recette, elles sont calculées sur des grammages réels : `c` et non
         `kcal`, c'est le vocabulaire de la visionneuse. */
      macros: (p.rec && p.rec.macros)
        ? { p: p.rec.macros.p, g: p.rec.macros.g, l: p.rec.macros.l, c: p.rec.macros.kcal }
        : null,
      tags: p.t,
      note: p.nu,
      /* Les quantités de la recette quand il y en a une : la pastille les
         affiche (`q`), et on ne fait pas ses courses sans savoir combien
         acheter. Le nom reste celui du catalogue, donc la clé de la liste de
         courses ne change pas. */
      ingredients: p.ingr.map(function (g) {
        var q = '';
        if (p.rec) {
          (p.rec.ingredients || []).forEach(function (x) {
            if (!q && memeIngredient(x.nom, g.n)) q = x.qte || '';
          });
        }
        return { nom: g.n, emoji: g.e, q: q };
      })
    };
  }

  /* ── Le pays d'après ────────────────────────────────────────
     Quand on ouvre la visionneuse SUR UNE CUISINE, finir ses plats ne doit pas
     être un cul-de-sac : un glissement de plus passe à la cuisine suivante
     (demande de Pablo, 2026-08-15). La visionneuse ne connaît rien aux pays —
     elle réclame juste « la série d'après » — et c'est ici qu'on la lui donne,
     comme `versItem` lui donne un plat.

     ⚠️ L'ordre est celui de `CUISINES`, donc « Le quotidien » puis les pays par
     ordre alphabétique — le même que la rangée du haut de `social.html`. En
     inventer un autre ici (au hasard, par proximité géographique) ferait que
     le geste ne mènerait pas là où l'œil vient de lire.
     ⚠️ Ça BOUCLE, et c'est voulu : après le Vietnam on revient au quotidien.
     S'arrêter net sur la dernière cuisine ferait du hasard de l'alphabet une
     fin de parcours, alors qu'il n'y en a pas.
     ⚠️ Et seulement si on est ENTRÉ par une cuisine : ouvert depuis une envie
     (« léger »), depuis la sélection du jour ou depuis une recherche, il n'y a
     pas de « pays suivant » qui veuille dire quelque chose. */
  function suiteDesCuisines(cleDepart) {
    // `CUISINES_VUES` et non `CUISINES` : l'enchaînement doit suivre l'ordre de
    // la rangée du haut, qui ne montre plus les cuisines sans photo. Sur
    // `CUISINES` il aurait ouvert une série vide au passage du quotidien.
    var i = -1;
    CUISINES_VUES.forEach(function (c, k) { if (c.cle === cleDepart) i = k; });
    if (i < 0) return null;
    var vue = i;
    return function (serie) {
      // `serie` est celle qu'on vient de finir : au premier appel elle est
      // nulle, et le point de départ est la cuisine ouverte.
      if (serie && serie.cle) {
        CUISINES_VUES.forEach(function (c, k) { if (c.cle === serie.cle) vue = k; });
      }
      var c = CUISINES_VUES[(vue + 1) % CUISINES_VUES.length];
      if (!c || !c.plats.length) return null;
      return {
        cle: c.cle,
        // `titre` va dans la barre du haut, où le drapeau tient sur la même
        // ligne ; `nom` et `embleme` vont sur le carton, où ils sont séparés.
        titre: c.drapeau + ' ' + c.nom,
        nom: c.nom,
        embleme: c.drapeau,
        items: c.plats.map(versItem)
      };
    };
  }

  /**
   * Ouvre la visionneuse sur une liste de plats du catalogue.
   * @param {Object} o {plats:[], index:0, titre:'', cuisine:'cle'}
   *   `cuisine` — la clé du pays d'où l'on part. Elle seule arme l'enchaînement
   *   d'un pays au suivant ; sans elle la liste s'arrête à son dernier plat.
   */
  function ouvrir(o) {
    o = o || {};
    var plats = (o.plats && o.plats.length) ? o.plats : VUS;
    if (!window.NattyVisionneuse) return;
    NattyVisionneuse.ouvrir({
      items: plats.map(versItem),
      index: o.index || 0,
      titre: o.titre || '',
      suite: o.cuisine ? suiteDesCuisines(o.cuisine) : null,
      actions: actionsPour,
      courses: listeDispo() ? {
        contient: function (nom) { return NattyListe.contientExtra(uid(), nom); },
        basculer: function (nom, em) { return NattyListe.basculerExtra(uid(), nom, em); }
      } : null
    });
  }

  function fermer() { if (window.NattyVisionneuse) NattyVisionneuse.fermer(); }


  return {
    cuisines: cuisines, cuisine: cuisine, parCuisine: parCuisine,
    tous: tous, parTag: parTag, tags: tags, selection: selection,
    platParCle: platParCle, img: img, vignette: vignette, illu: illu,
    /* La recette d'un plat au schéma de `assets/recette.js`, ou null. Exposée
       parce que c'est la seule façon de vérifier la conversion sans dérouler
       la visionneuse — et parce qu'un autre écran voudra la lancer un jour. */
    recette: recette,
    ouvrir: ouvrir, fermer: fermer,
    estOuverte: function () { return !!window.NattyVisionneuse && NattyVisionneuse.estOuverte(); }
  };
})();
