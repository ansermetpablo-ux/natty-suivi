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
          nu:'Une plaque unique, donc un seul plat à laver : c\'est ce qui fait qu\'on le refait.',
          rec:{
            temps_min:80, portions:4,
            macros:{ p:70, g:39, l:14, kcal:579 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'1 poulet fermier (1,4 kg, ≈ 850 g de chair)', g:850, nu:'poulet' },
              { em:'🥔', nom:'Pommes de terre', qte:'600 g', g:600, nu:'pomme de terre' },
              { em:'🥕', nom:'Carottes', qte:'300 g (4)', g:300, nu:'carotte' },
              { em:'🧅', nom:'Oignon', qte:'150 g (1 gros)', g:150, nu:'oignon' },
              { em:'🧄', nom:'Ail', qte:'1 tête', g:30, nu:'ail' },
              { em:'🫒', nom:'Huile d\'olive', qte:'2 c. à soupe', g:25, nu:'huile olive' },
              { em:'🌿', nom:'Thym', qte:'4 branches' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'attendre', t:'Sors le poulet du froid', duree_min:20,
                detail:'Pose-le sur le plan de travail, à couvert, le temps que le four chauffe.',
                tip:'Un poulet à cœur froid met vingt minutes de plus, et sa peau brunit avant que l\'intérieur soit cuit. C\'est le geste le plus rentable de toute la recette.' },
              { illu:'enfourner', t:'Préchauffe le four', duree_min:10,
                detail:'À 200 °C, chaleur tournante, avec la grille au tiers bas.',
                tip:'Enfourner dans un four pas encore chaud, c\'est cuire à la vapeur de sa propre eau : la peau ne croustille jamais.' },
              { illu:'couper', t:'Taille les légumes', duree_min:10,
                detail:'Pommes de terre en gros quartiers, carottes en tronçons de 4 cm, oignon en six. La tête d\'ail se coupe en deux en travers, sans l\'éplucher.',
                qte:[{ nom:'Pommes de terre', qte:'600 g' }, { nom:'Carottes', qte:'300 g' }, { nom:'Oignon', qte:'150 g' }],
                tip:'Gros, c\'est délibéré : ils cuisent une heure. Coupés petits, ils seraient en purée avant que le poulet soit prêt.' },
              { illu:'assaisonner', t:'Huile et sale le poulet', duree_min:4,
                detail:'Frotte toute la peau d\'huile d\'olive, sale généreusement dessus ET dans la cavité, poivre, glisse le thym à l\'intérieur.',
                qte:[{ nom:'Huile d\'olive', qte:'1 c. à soupe' }, { nom:'Sel', qte:'2 c. à café' }],
                tip:'Le sel sur la peau la déshydrate un peu : c\'est exactement ce qui la rend croustillante. Sale plus que tu ne crois — la moitié tombe dans le plat.' },
              { illu:'enfourner', t:'Enfourne poulet et légumes ensemble', duree_min:60,
                detail:'Poulet au centre, légumes autour, arrosés du reste d\'huile. Une heure à 200 °C, en arrosant du jus deux fois.',
                qte:[{ nom:'Poulet', qte:'1,4 kg' }],
                tip:'Compte 20 min par 500 g. Le jus qui coule d\'une cuisse piquée doit être clair : rosé, il reste un quart d\'heure.' },
              { illu:'reposer', t:'Laisse-le reposer', duree_min:15,
                detail:'Sors le plat, couvre le poulet d\'aluminium sans serrer, et attends un quart d\'heure avant de découper.',
                tip:'Découpé à la sortie du four, il perd son jus dans l\'assiette et la chair devient sèche. Quinze minutes suffisent à le laisser se répartir.' },
              { illu:'dresser', t:'Découpe et sers', duree_min:5,
                detail:'Cuisses d\'abord, puis les blancs le long du bréchet. Presse l\'ail rôti sur les pommes de terre.',
                tip:'L\'ail confit sous sa peau se presse comme un tube : c\'est la meilleure sauce du plat, et elle ne coûte rien.' }
            ]
          } },
        { cle:'quo-steak-haricots', n:'Steak, haricots verts et purée', svg:'assiette',
          d:'Le classique du soir : une pièce de bœuf saisie, des haricots vapeur, une purée maison.',
          i:'🥩 Steak|🫛 Haricots verts|🥔 Pommes de terre|🥛 Lait|🧈 Beurre',
          t:['Protéiné'],
          nu:'Le fer du bœuf s\'absorbe mieux avec des légumes verts dans la même assiette.',
          rec:{
            temps_min:35, portions:2,
            macros:{ p:48, g:55, l:37, kcal:752 },
            ingredients:[
              { em:'🥩', nom:'Steak', qte:'2 pièces de 150 g', g:300, nu:'steak' },
              { em:'🫛', nom:'Haricots verts', qte:'300 g', g:300, nu:'haricots verts' },
              { em:'🥔', nom:'Pommes de terre', qte:'500 g', g:500, nu:'pomme de terre' },
              { em:'🥛', nom:'Lait', qte:'100 ml', g:100, nu:'lait' },
              { em:'🧈', nom:'Beurre', qte:'30 g', g:30, nu:'beurre' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'couper', t:'Épluche et coupe les pommes de terre', duree_min:7,
                detail:'En morceaux d\'environ 4 cm, tous de la même taille.',
                qte:[{ nom:'Pommes de terre', qte:'500 g' }],
                tip:'Même taille = même cuisson. Un gros morceau encore ferme suffit à faire une purée grumeleuse.' },
              { illu:'bouillir', t:'Cuis-les à l\'eau salée', duree_min:20,
                detail:'Départ à l\'eau FROIDE salée, puis 20 min à petits bouillons dès l\'ébullition. La pointe d\'un couteau doit entrer sans résistance.',
                qte:[{ nom:'Pommes de terre', qte:'500 g' }],
                tip:'Départ à froid, c\'est ce qui fait qu\'elles cuisent de la même façon du bord au centre. Jetées dans l\'eau bouillante, l\'extérieur se délite avant que le cœur soit cuit.' },
              { illu:'bouillir', t:'Cuis les haricots à côté', duree_min:8,
                detail:'Grand volume d\'eau bouillante bien salée, 8 min à découvert. Ils doivent rester fermes sous la dent.',
                qte:[{ nom:'Haricots verts', qte:'300 g' }],
                tip:'À découvert et à gros bouillons : c\'est ce qui leur garde leur vert. Un couvercle emprisonne les acides qui les font virer au kaki.' },
              { illu:'saisir', t:'Saisis les steaks', duree_min:6,
                detail:'Poêle très chaude, à sec ou avec une goutte d\'huile. 2 min par face pour un cœur rosé, sans les bouger.',
                qte:[{ nom:'Steak', qte:'300 g' }],
                tip:'Sale APRÈS la cuisson, jamais avant : le sel fait perler l\'eau à la surface, et une viande mouillée bout au lieu de saisir.' },
              { illu:'melanger', t:'Écrase la purée', duree_min:5,
                detail:'Égoutte, écrase au presse-purée, incorpore le lait chaud puis le beurre. Sale, poivre, muscade si tu en as.',
                qte:[{ nom:'Lait', qte:'100 ml' }, { nom:'Beurre', qte:'30 g' }],
                tip:'Jamais au mixeur : il fait éclater l\'amidon et la purée devient élastique, comme de la colle. Le presse-purée ou la fourchette, rien d\'autre.' },
              { illu:'reposer', t:'Laisse reposer la viande', duree_min:4,
                detail:'Pose les steaks sur une assiette chaude pendant que tu dresses le reste.',
                tip:'Trois minutes de repos valent mieux qu\'une minute de cuisson en plus : le jus se répartit au lieu de couler dans l\'assiette.' },
              { illu:'dresser', t:'Dresse', duree_min:2,
                detail:'Purée, haricots, steak par-dessus, et le jus de la poêle versé dessus.',
                tip:'Déglace la poêle d\'une cuillère d\'eau : ce qui est collé au fond est la moitié du goût.' }
            ]
          } },
        { cle:'quo-omelette-champignons', n:'Omelette aux champignons', svg:'oeuf',
          d:'Trois œufs battus, des champignons poêlés à part, du persil au dernier moment.',
          i:'🥚 Œufs|🍄 Champignons|🧅 Oignon|🌿 Persil|🧈 Beurre',
          t:['Protéiné','Végétarien'],
          nu:'Des protéines complètes en dix minutes, quand il n\'y a plus rien au frigo.',
          rec:{
            temps_min:18, portions:2,
            macros:{ p:26, g:10, l:29, kcal:389 },
            ingredients:[
              { em:'🥚', nom:'Œufs', qte:'6', g:330, nu:'oeuf' },
              { em:'🍄', nom:'Champignons de Paris', qte:'250 g', g:250, nu:'champignon' },
              { em:'🧅', nom:'Oignon', qte:'80 g (1 petit)', g:80, nu:'oignon' },
              { em:'🌿', nom:'Persil', qte:'10 g' },
              { em:'🧈', nom:'Beurre', qte:'25 g', g:25, nu:'beurre' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'couper', t:'Émince champignons et oignon', duree_min:6,
                detail:'Champignons en lamelles de 4 mm, oignon finement.',
                qte:[{ nom:'Champignons', qte:'250 g' }, { nom:'Oignon', qte:'80 g' }],
                tip:'Ne les lave pas sous l\'eau : ils la boivent et rendront tout dans la poêle. Un coup de brosse ou de papier humide suffit.' },
              { illu:'saisir', t:'Fais-les suer à feu vif', duree_min:7,
                detail:'Poêle bien chaude, la moitié du beurre, les champignons SANS les toucher pendant deux minutes. Puis remue, ajoute l\'oignon, sale.',
                qte:[{ nom:'Champignons', qte:'250 g' }, { nom:'Beurre', qte:'12 g' }],
                tip:'Feu vif et poêle pas trop chargée : entassés, ils rendent leur eau et bouillent. Cuis-les en deux fois plutôt qu\'en une.' },
              { illu:'fouetter', t:'Bats les œufs', duree_min:2,
                detail:'À la fourchette, juste assez pour mêler blancs et jaunes. Sale, poivre.',
                tip:'Battre longtemps incorpore de l\'air : l\'omelette gonfle puis retombe en caoutchouc. Dix secondes suffisent.' },
              { illu:'saisir', t:'Cuis l\'omelette', duree_min:4,
                detail:'Reste du beurre à feu moyen, verse les œufs, ramène les bords vers le centre à la spatule et laisse le liquide couler dessous.',
                qte:[{ nom:'Œufs', qte:'6' }, { nom:'Beurre', qte:'13 g' }],
                tip:'Feu MOYEN. C\'est ici que tout se joue : à feu vif le dessous brunit et le dessus reste cru.' },
              { illu:'dresser', t:'Garnis et plie', duree_min:2,
                detail:'Quand le dessus est encore baveux, répartis les champignons et le persil sur une moitié, puis replie.',
                qte:[{ nom:'Persil', qte:'10 g' }],
                tip:'On la sort baveuse : la chaleur résiduelle finit la cuisson dans l\'assiette. Attendre qu\'elle soit sèche, c\'est déjà trop tard.' }
            ]
          } },
        { cle:'quo-pates-bolognaise', n:'Pâtes à la bolognaise', svg:'pates',
          d:'Une sauce mijotée à la viande hachée et à la tomate, sur des pâtes al dente.',
          i:'🍝 Pâtes|🥩 Bœuf haché|🍅 Tomates|🧅 Oignon|🥕 Carotte|🧄 Ail',
          t:['Protéiné','Réconfortant'],
          nu:'La carotte n\'est pas décorative : elle adoucit l\'acidité de la tomate sans sucre ajouté.',
          rec:{
            temps_min:95, portions:4,
            macros:{ p:47, g:75, l:28, kcal:750 },
            ingredients:[
              { em:'🍝', nom:'Pâtes', qte:'400 g sèches (≈ 960 g cuites)', g:960, nu:'pates' },
              { em:'🥩', nom:'Bœuf haché', qte:'500 g', g:500, nu:'boeuf hache' },
              { em:'🍅', nom:'Tomates concassées', qte:'800 g (2 boîtes)', g:800, nu:'tomate' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🥕', nom:'Carotte', qte:'120 g', g:120, nu:'carotte' },
              { em:'🧄', nom:'Ail', qte:'3 gousses', g:12, nu:'ail' },
              { em:'🫒', nom:'Huile d\'olive', qte:'2 c. à soupe', g:25, nu:'huile olive' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'couper', t:'Taille le soffritto', duree_min:8,
                detail:'Oignon, carotte et ail hachés très finement, presque en poudre.',
                qte:[{ nom:'Oignon', qte:'150 g' }, { nom:'Carotte', qte:'120 g' }, { nom:'Ail', qte:'3 gousses' }],
                tip:'Plus c\'est fin, plus ça fond dans la sauce. Des morceaux visibles resteront des morceaux même après deux heures.' },
              { illu:'saisir', t:'Fais-les fondre à l\'huile', duree_min:8,
                detail:'Feu doux, huile d\'olive, remue jusqu\'à ce que l\'oignon soit translucide et la carotte tendre.',
                qte:[{ nom:'Huile d\'olive', qte:'2 c. à soupe' }],
                tip:'Feu doux et patience : c\'est la base sucrée qui équilibrera l\'acidité de la tomate. Coloré trop vite, ça devient amer.' },
              { illu:'saisir', t:'Colore la viande', duree_min:8,
                detail:'Monte le feu, ajoute le bœuf, écrase-le à la cuillère et laisse-le BRUNIR avant de remuer.',
                qte:[{ nom:'Bœuf haché', qte:'500 g' }],
                tip:'Une viande grise n\'a pas de goût : il lui faut le contact d\'une poêle chaude. Si elle rend de l\'eau, laisse-la s\'évaporer avant de continuer.' },
              { illu:'mijoter', t:'Mijote longuement', duree_min:70,
                detail:'Ajoute les tomates, sale, baisse au minimum et laisse à couvert entrouvert au moins une heure, en remuant de temps en temps.',
                qte:[{ nom:'Tomates', qte:'800 g' }],
                tip:'Une bolognaise d\'une demi-heure est une sauce tomate à la viande. C\'est le temps qui la rend onctueuse — au-delà d\'une heure, tout est gagné.' },
              { illu:'bouillir', t:'Cuis les pâtes', duree_min:10,
                detail:'Grand volume d\'eau bouillante salée, une minute de moins que le paquet.',
                qte:[{ nom:'Pâtes', qte:'400 g' }],
                tip:'Un litre d\'eau pour 100 g, et 10 g de sel par litre. Trop peu d\'eau, l\'amidon les colle entre elles.' },
              { illu:'melanger', t:'Réunis dans la poêle', duree_min:3,
                detail:'Égoutte en gardant une louche d\'eau de cuisson, verse les pâtes dans la sauce et remue une minute à feu vif avec un peu de cette eau.',
                tip:'L\'eau de cuisson est chargée d\'amidon : c\'est elle qui fait que la sauce accroche aux pâtes au lieu de tomber au fond de l\'assiette.' }
            ]
          } },
        { cle:'quo-saumon-riz', n:'Saumon vapeur, riz et brocoli', svg:'poisson',
          d:'Un pavé cuit à la vapeur ou au four, du riz, un brocoli encore ferme.',
          i:'🐟 Saumon|🍚 Riz|🥦 Brocoli|🍋 Citron|🫒 Huile d\'olive',
          t:['Protéiné','Léger'],
          nu:'Les oméga-3 du saumon couvrent une bonne part des lipides du jour sans huile ajoutée.',
          rec:{
            temps_min:30, portions:2,
            macros:{ p:40, g:68, l:27, kcal:678 },
            ingredients:[
              { em:'🐟', nom:'Saumon', qte:'2 pavés de 150 g', g:300, nu:'saumon' },
              { em:'🍚', nom:'Riz', qte:'150 g cru (≈ 390 g cuit)', g:390, nu:'riz' },
              { em:'🥦', nom:'Brocoli', qte:'300 g', g:300, nu:'brocoli' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🫒', nom:'Huile d\'olive', qte:'1 c. à soupe', g:12, nu:'huile olive' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'rincer', t:'Rince le riz', duree_min:3,
                detail:'À l\'eau froide, jusqu\'à ce qu\'elle ressorte presque claire.',
                qte:[{ nom:'Riz', qte:'150 g' }],
                tip:'L\'amidon de surface est ce qui rend le riz collant. Trois rinçages suffisent — au-delà on rince le goût.' },
              { illu:'bouillir', t:'Cuis le riz', duree_min:12,
                detail:'Une part de riz pour une part et demie d\'eau salée, à couvert, feu très doux, 11 min sans jamais soulever le couvercle.',
                qte:[{ nom:'Riz', qte:'150 g' }],
                tip:'Le couvercle soulevé fait chuter la vapeur, et le riz du dessus reste dur. On regarde à la fin, pas avant.' },
              { illu:'couper', t:'Détaille le brocoli', duree_min:4,
                detail:'En petits bouquets réguliers ; le tronc s\'épluche et se coupe en rondelles, il est aussi bon.',
                qte:[{ nom:'Brocoli', qte:'300 g' }],
                tip:'Le tronc jeté, c\'est un tiers du brocoli à la poubelle. Épluché, il est plus doux que les fleurettes.' },
              { illu:'bouillir', t:'Cuis-le à la vapeur', duree_min:7,
                detail:'Panier vapeur ou passoire au-dessus d\'une casserole d\'eau bouillante, 6 à 7 min. Il doit rester bien vert et ferme.',
                qte:[{ nom:'Brocoli', qte:'300 g' }],
                tip:'À l\'eau, il perd la moitié de sa vitamine C dans la casserole. À la vapeur, elle reste dedans.' },
              { illu:'bouillir', t:'Cuis le saumon à la vapeur', duree_min:9,
                detail:'Pose les pavés côté peau sur le panier, sale, poivre, une rondelle de citron dessus. 8 min pour un cœur juste nacré.',
                qte:[{ nom:'Saumon', qte:'300 g' }, { nom:'Citron', qte:'1 rondelle' }],
                tip:'Le saumon est cuit quand la chair se sépare en lamelles sous la fourchette. Une minute de plus et il devient sec et blanchâtre.' },
              { illu:'dresser', t:'Dresse et assaisonne', duree_min:2,
                detail:'Riz, brocoli, saumon, un filet d\'huile d\'olive et le reste du citron pressé dessus.',
                qte:[{ nom:'Huile d\'olive', qte:'1 c. à soupe' }, { nom:'Citron', qte:'1' }],
                tip:'L\'huile se met à la fin, à froid : chauffée, une bonne huile d\'olive perd ce qu\'on lui achète.' }
            ]
          } },
        { cle:'quo-cesar-poulet', n:'Salade César au poulet', svg:'bol',
          d:'De la salade croquante, du poulet grillé, du parmesan et des croûtons.',
          i:'🥬 Salade romaine|🍗 Poulet|🧀 Parmesan|🍞 Croûtons|🥚 Œuf',
          t:['Protéiné'],
          nu:'C\'est la sauce qui décide : montée au yaourt, elle divise les lipides par trois.',
          rec:{
            temps_min:25, portions:2,
            macros:{ p:60, g:21, l:31, kcal:610 },
            ingredients:[
              { em:'🥬', nom:'Salade romaine', qte:'1 (300 g)', g:300, nu:'salade' },
              { em:'🍗', nom:'Poulet', qte:'2 filets (300 g)', g:300, nu:'poulet' },
              { em:'🧀', nom:'Parmesan', qte:'40 g', g:40, nu:'parmesan' },
              { em:'🍞', nom:'Croûtons', qte:'60 g de pain rassis', g:60, nu:'pain' },
              { em:'🥚', nom:'Œuf', qte:'1 jaune', g:20, nu:'oeuf' },
              { em:'🫒', nom:'Huile d\'olive', qte:'3 c. à soupe', g:35, nu:'huile olive' },
              { em:'🍋', nom:'Citron', qte:'½', g:30, nu:'citron' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'saisir', t:'Cuis le poulet', duree_min:12,
                detail:'Poêle chaude, un filet d\'huile, 5 à 6 min par face selon l\'épaisseur. Sale à la fin.',
                qte:[{ nom:'Poulet', qte:'300 g' }],
                tip:'Aplatis le filet au poing avant de le cuire : une épaisseur régulière, c\'est une cuisson régulière et pas de bord sec.' },
              { illu:'enfourner', t:'Fais les croûtons', duree_min:8,
                detail:'Pain en cubes, une cuillère d\'huile, 8 min à 180 °C en remuant à mi-parcours.',
                qte:[{ nom:'Pain', qte:'60 g' }],
                tip:'Du pain de la veille, jamais du frais : le frais rend son eau et devient mou en refroidissant.' },
              { illu:'fouetter', t:'Monte la sauce', duree_min:5,
                detail:'Jaune d\'œuf, jus de citron, sel, poivre, puis l\'huile en filet en fouettant. Ajoute la moitié du parmesan râpé.',
                qte:[{ nom:'Œuf', qte:'1 jaune' }, { nom:'Huile d\'olive', qte:'3 c. à soupe' }],
                tip:'L\'huile VERSÉE EN FILET, sinon ça ne prend pas. Et un jaune à température ambiante monte, un jaune froid tranche.' },
              { illu:'couper', t:'Prépare la salade et le poulet', duree_min:4,
                detail:'Romaine lavée, essorée, coupée en larges morceaux. Poulet en tranches épaisses, une fois reposé.',
                qte:[{ nom:'Salade romaine', qte:'300 g' }],
                tip:'Essorée à fond : une goutte d\'eau sur une feuille, et la sauce glisse au lieu d\'accrocher.' },
              { illu:'melanger', t:'Assemble', duree_min:2,
                detail:'Mélange la salade et la sauce à la main, ajoute le poulet, les croûtons et le reste de parmesan en copeaux.',
                tip:'À la main : c\'est le seul moyen d\'enrober chaque feuille sans les casser. Et on assemble au dernier moment.' }
            ]
          } },
        { cle:'quo-gratin-courgettes', n:'Gratin de courgettes', svg:'gratin',
          d:'Des courgettes en rondelles, un peu de crème, du fromage râpé, vingt minutes au four.',
          i:'🥒 Courgette|🧀 Fromage râpé|🥛 Crème|🥚 Œufs|🧄 Ail',
          t:['Végétarien','Réconfortant'],
          nu:'Faire dégorger les courgettes avant : sinon le gratin rend son eau et ne gratine pas.',
          rec:{
            temps_min:55, portions:4,
            macros:{ p:15, g:9, l:23, kcal:297 },
            ingredients:[
              { em:'🥒', nom:'Courgettes', qte:'900 g', g:900, nu:'courgette' },
              { em:'🧀', nom:'Fromage râpé', qte:'100 g', g:100, nu:'gruyere' },
              { em:'🥛', nom:'Crème', qte:'150 ml', g:150, nu:'creme' },
              { em:'🥚', nom:'Œufs', qte:'2', g:110, nu:'oeuf' },
              { em:'🧄', nom:'Ail', qte:'2 gousses', g:8, nu:'ail' },
              { em:'🧂', nom:'Sel, poivre, muscade', qte:'' }
            ],
            steps:[
              { illu:'couper', t:'Coupe les courgettes', duree_min:6,
                detail:'En rondelles de 5 mm, sans les éplucher.',
                qte:[{ nom:'Courgettes', qte:'900 g' }],
                tip:'La peau tient le légume à la cuisson et porte l\'essentiel des fibres. Épluchées, les rondelles finissent en bouillie.' },
              { illu:'saisir', t:'Fais-les dégorger à la poêle', duree_min:12,
                detail:'Feu vif, à sec ou avec très peu d\'huile, jusqu\'à ce qu\'elles rendent leur eau et qu\'elle s\'évapore. Ail à la fin.',
                qte:[{ nom:'Courgettes', qte:'900 g' }, { nom:'Ail', qte:'2 gousses' }],
                tip:'C\'EST L\'ÉTAPE QU\'ON SAUTE, et c\'est celle qui rate le gratin : une courgette, c\'est 95 % d\'eau. Crue au four, elle inonde le plat et le gratin ne prend jamais.' },
              { illu:'fouetter', t:'Prépare l\'appareil', duree_min:3,
                detail:'Bats les œufs avec la crème, sale, poivre, râpe un peu de muscade.',
                tip:'La muscade n\'est pas une coquetterie : elle relève un plat où tout est doux, et une pincée suffit.' },
              { illu:'melanger', t:'Assemble dans le plat', duree_min:4,
                detail:'Courgettes égouttées dans le plat, verse l\'appareil, mélange, couvre de fromage râpé.',
                qte:[{ nom:'Fromage râpé', qte:'100 g' }],
                tip:'Le fromage sur le dessus SEULEMENT : mélangé dedans, il file et l\'appareil ne prend pas.' },
              { illu:'enfourner', t:'Enfourne', duree_min:30,
                detail:'30 min à 180 °C, jusqu\'à ce que le dessus soit doré et le centre ferme au toucher.',
                tip:'Si le dessus dore trop vite, une feuille d\'aluminium par-dessus les dix dernières minutes.' },
              { illu:'reposer', t:'Laisse-le tiédir', duree_min:5,
                detail:'Cinq minutes hors du four avant de couper.',
                tip:'Sorti brûlant, il s\'affaisse dans l\'assiette. Tiède, il se tient et il a plus de goût.' }
            ]
          } },
        { cle:'quo-soupe-legumes', n:'Soupe de légumes du placard', svg:'soupe',
          d:'Ce qui traîne au bac à légumes, mijoté puis mixé.',
          i:'🥕 Carotte|🥔 Pomme de terre|🧅 Oignon|🥬 Poireau|🌿 Thym',
          t:['Végétarien','Léger','Riche en fibres'],
          nu:'Une soupe rassasie peu à elle seule : elle demande un vrai apport de protéines à côté.',
          rec:{
            temps_min:40, portions:4,
            macros:{ p:3, g:31, l:3, kcal:161 },
            ingredients:[
              { em:'🥕', nom:'Carottes', qte:'300 g', g:300, nu:'carotte' },
              { em:'🥔', nom:'Pommes de terre', qte:'300 g', g:300, nu:'pomme de terre' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🥬', nom:'Poireau', qte:'200 g', g:200, nu:'poireau' },
              { em:'🌿', nom:'Thym', qte:'2 branches' },
              { em:'🫒', nom:'Huile d\'olive', qte:'1 c. à soupe', g:12, nu:'huile olive' },
              { em:'💧', nom:'Eau', qte:'1,2 l' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'couper', t:'Émince tout', duree_min:10,
                detail:'Poireau en rondelles, oignon émincé, carottes et pommes de terre en cubes de 2 cm.',
                qte:[{ nom:'Poireau', qte:'200 g' }, { nom:'Carottes', qte:'300 g' }, { nom:'Pommes de terre', qte:'300 g' }],
                tip:'Le vert du poireau se mange : bien lavé et coupé fin, il donne plus de goût que le blanc.' },
              { illu:'saisir', t:'Fais suer oignon et poireau', duree_min:7,
                detail:'Feu doux, l\'huile, à couvert, jusqu\'à ce qu\'ils soient fondants sans avoir coloré.',
                qte:[{ nom:'Oignon', qte:'150 g' }, { nom:'Huile d\'olive', qte:'1 c. à soupe' }],
                tip:'SUER, pas rissoler : c\'est cette étape qui fait la différence entre une soupe de légumes et de l\'eau de légumes. Colorés, ils donnent un goût de brûlé au bouillon.' },
              { illu:'mijoter', t:'Ajoute le reste et couvre d\'eau', duree_min:22,
                detail:'Carottes, pommes de terre, thym, l\'eau à hauteur, sel. 20 min à petits bouillons.',
                qte:[{ nom:'Eau', qte:'1,2 l' }],
                tip:'À hauteur, pas plus : on peut toujours allonger à la fin, on ne peut pas retirer de l\'eau.' },
              { illu:'mixer', t:'Mixe', duree_min:3,
                detail:'Retire le thym, mixe jusqu\'à ce que ce soit lisse, en ajoutant de l\'eau chaude si c\'est trop épais.',
                tip:'Mixe à chaud mais pas bouillant, et ne remplis le bol qu\'aux deux tiers : la vapeur fait sauter le couvercle.' },
              { illu:'assaisonner', t:'Rectifie', duree_min:2,
                detail:'Goûte, resale, poivre. Un filet d\'huile d\'olive crue au moment de servir.',
                tip:'Une soupe se sale à la fin : l\'eau s\'est réduite pendant la cuisson, et ce qui était juste au départ est devenu trop.' }
            ]
          } },
        { cle:'quo-croque-monsieur', n:'Croque-monsieur maison', svg:'sandwich',
          d:'Pain de mie, jambon, béchamel légère et gruyère, passé au four.',
          i:'🍞 Pain de mie|🥓 Jambon|🧀 Gruyère|🥛 Lait|🧈 Beurre',
          t:['Réconfortant'],
          nu:'Au four plutôt qu\'à la poêle : le beurre de cuisson y est divisé par deux.',
          rec:{
            temps_min:25, portions:2,
            macros:{ p:32, g:42, l:32, kcal:584 },
            ingredients:[
              { em:'🍞', nom:'Pain de mie', qte:'4 tranches', g:120, nu:'pain de mie' },
              { em:'🥓', nom:'Jambon', qte:'2 tranches (100 g)', g:100, nu:'jambon' },
              { em:'🧀', nom:'Gruyère', qte:'80 g râpé', g:80, nu:'gruyere' },
              { em:'🥛', nom:'Lait', qte:'200 ml', g:200, nu:'lait' },
              { em:'🧈', nom:'Beurre', qte:'25 g', g:25, nu:'beurre' },
              { em:'🌾', nom:'Farine', qte:'20 g', g:20, nu:'farine' },
              { em:'🧂', nom:'Sel, poivre, muscade', qte:'' }
            ],
            steps:[
              { illu:'melanger', t:'Fais un roux', duree_min:4,
                detail:'Beurre fondu à feu moyen, farine d\'un coup, remue une minute jusqu\'à ce que ça mousse sans colorer.',
                qte:[{ nom:'Beurre', qte:'25 g' }, { nom:'Farine', qte:'20 g' }],
                tip:'Une minute de cuisson au moins : c\'est ce qui retire le goût de farine crue. Mais sans colorer, sinon la sauce sera beige.' },
              { illu:'fouetter', t:'Monte la béchamel', duree_min:6,
                detail:'Lait FROID en trois fois, en fouettant à chaque ajout, jusqu\'à épaississement. Sel, poivre, muscade.',
                qte:[{ nom:'Lait', qte:'200 ml' }],
                tip:'Lait froid sur roux chaud (ou l\'inverse) : c\'est le contraste qui empêche les grumeaux. Tout à la même température, ça grumelle.' },
              { illu:'melanger', t:'Monte les croques', duree_min:5,
                detail:'Une fine couche de béchamel sur chaque tranche, jambon et la moitié du gruyère au milieu, referme, le reste de béchamel et de gruyère sur le dessus.',
                qte:[{ nom:'Jambon', qte:'100 g' }, { nom:'Gruyère', qte:'80 g' }],
                tip:'De la béchamel À L\'INTÉRIEUR aussi : c\'est elle qui garde le pain moelleux là où le jambon le dessécherait.' },
              { illu:'enfourner', t:'Enfourne', duree_min:12,
                detail:'12 min à 200 °C, puis 2 min sous le gril pour la croûte.',
                tip:'Le gril à la fin, jamais depuis le début : il dorerait le dessus avant que le cœur soit chaud.' },
              { illu:'dresser', t:'Sers aussitôt', duree_min:1,
                detail:'Coupe en deux en diagonale et mange chaud.',
                tip:'Un croque qui attend ramollit : le fromage fige et le pain boit la béchamel.' }
            ]
          } },
        { cle:'quo-quiche-lorraine', n:'Quiche lorraine', svg:'tarte',
          d:'Une pâte brisée, des lardons, un appareil aux œufs et à la crème.',
          i:'🥧 Pâte brisée|🥓 Lardons|🥚 Œufs|🥛 Crème|🧀 Gruyère',
          t:['Réconfortant'],
          nu:'Une part se marie mal seule : une salade verte à côté équilibre le repas.',
          rec:{
            temps_min:60, portions:6,
            macros:{ p:18, g:18, l:37, kcal:478 },
            ingredients:[
              { em:'🥧', nom:'Pâte brisée', qte:'1 rouleau (250 g)', g:250, nu:'pate brisee' },
              { em:'🥓', nom:'Lardons', qte:'200 g', g:200, nu:'lardons' },
              { em:'🥚', nom:'Œufs', qte:'4', g:220, nu:'oeuf' },
              { em:'🥛', nom:'Crème', qte:'200 ml', g:200, nu:'creme' },
              { em:'🥛', nom:'Lait', qte:'100 ml', g:100, nu:'lait' },
              { em:'🧀', nom:'Gruyère', qte:'80 g', g:80, nu:'gruyere' },
              { em:'🧂', nom:'Sel, poivre, muscade', qte:'' }
            ],
            steps:[
              { illu:'enfourner', t:'Précuis la pâte', duree_min:15,
                detail:'Étale la pâte dans le moule, pique le fond à la fourchette, couvre de papier cuisson et de légumes secs, 12 min à 190 °C.',
                qte:[{ nom:'Pâte brisée', qte:'250 g' }],
                tip:'La cuisson à blanc est ce qui sépare une quiche d\'une quiche à fond mou. Les légumes secs empêchent la pâte de gonfler et se gardent des années pour ça.' },
              { illu:'saisir', t:'Fais rissoler les lardons', duree_min:6,
                detail:'À sec dans une poêle chaude, jusqu\'à ce qu\'ils soient dorés. Égoutte-les sur du papier.',
                qte:[{ nom:'Lardons', qte:'200 g' }],
                tip:'Sans matière grasse : ils rendent la leur. Et on jette ce gras, sinon la migaine se sépare à la cuisson.' },
              { illu:'fouetter', t:'Prépare la migaine', duree_min:4,
                detail:'Bats les œufs, ajoute crème et lait, sale peu (les lardons salent déjà), poivre, muscade.',
                qte:[{ nom:'Œufs', qte:'4' }, { nom:'Crème', qte:'200 ml' }, { nom:'Lait', qte:'100 ml' }],
                tip:'Un œuf pour 75 ml de liquide : moins, la quiche est sèche ; plus, elle ne prend pas.' },
              { illu:'melanger', t:'Garnis', duree_min:3,
                detail:'Lardons et gruyère sur le fond précuit, puis verse la migaine.',
                qte:[{ nom:'Gruyère', qte:'80 g' }],
                tip:'La garniture d\'abord, le liquide ensuite : versé sur la garniture, il la répartit tout seul.' },
              { illu:'enfourner', t:'Cuis', duree_min:32,
                detail:'30 à 35 min à 180 °C. Le centre doit être juste pris et trembler à peine.',
                tip:'Trop cuite, la migaine se rétracte et rend de l\'eau en refroidissant. On la sort quand elle tremble encore un peu.' },
              { illu:'reposer', t:'Laisse tiédir', duree_min:10,
                detail:'Au moins dix minutes avant de couper.',
                tip:'Une quiche est meilleure tiède que brûlante : les arômes du lard et de la muscade ne se sentent qu\'en dessous de 60 °C.' }
            ]
          } },
        { cle:'quo-burger-maison', n:'Burger maison', svg:'burger',
          d:'Un steak haché saisi, du cheddar, de la salade et une sauce montée soi-même.',
          i:'🍔 Pain à burger|🥩 Steak haché|🧀 Cheddar|🥬 Salade|🍅 Tomate|🧅 Oignon',
          t:['Protéiné','Réconfortant'],
          nu:'Fait maison, il tombe autour de 600 kcal — la moitié de son équivalent en fast-food.',
          rec:{
            temps_min:30, portions:2,
            macros:{ p:52, g:45, l:32, kcal:694 },
            ingredients:[
              { em:'🍔', nom:'Pains à burger', qte:'2', g:160, nu:'pain' },
              { em:'🥩', nom:'Steak haché', qte:'2 de 150 g', g:300, nu:'boeuf hache' },
              { em:'🧀', nom:'Cheddar', qte:'2 tranches (40 g)', g:40, nu:'cheddar' },
              { em:'🥬', nom:'Salade', qte:'4 feuilles', g:40, nu:'salade' },
              { em:'🍅', nom:'Tomate', qte:'1 (120 g)', g:120, nu:'tomate' },
              { em:'🧅', nom:'Oignon rouge', qte:'60 g', g:60, nu:'oignon' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'couper', t:'Prépare la garniture', duree_min:6,
                detail:'Tomate en rondelles épaisses, oignon en fines lamelles, salade lavée et essorée.',
                qte:[{ nom:'Tomate', qte:'120 g' }, { nom:'Oignon rouge', qte:'60 g' }],
                tip:'Sale les rondelles de tomate et laisse-les cinq minutes sur du papier : elles rendent leur eau AVANT le burger, pas dedans.' },
              { illu:'peser', t:'Façonne les steaks', duree_min:4,
                detail:'150 g chacun, aplatis à 1,5 cm, un creux au pouce au centre. Sale les deux faces juste avant de cuire.',
                qte:[{ nom:'Steak haché', qte:'300 g' }],
                tip:'Le creux central, c\'est ce qui empêche le steak de gonfler en ballon : la viande se rétracte vers le milieu en cuisant et le comble.' },
              { illu:'saisir', t:'Grille les pains', duree_min:3,
                detail:'Face coupée sur une poêle chaude, à sec, jusqu\'à ce qu\'ils soient dorés.',
                qte:[{ nom:'Pains à burger', qte:'2' }],
                tip:'Un pain grillé fait barrière : sans ça, le jus du steak le détrempe en deux minutes.' },
              { illu:'saisir', t:'Cuis les steaks', duree_min:7,
                detail:'Poêle très chaude, 2 à 3 min par face sans jamais appuyer dessus. Le fromage sur le dessus à la dernière minute, à couvert.',
                qte:[{ nom:'Steak haché', qte:'300 g' }, { nom:'Cheddar', qte:'40 g' }],
                tip:'APPUYER SUR LE STEAK, c\'est expulser son jus dans la poêle. Tout ce qui grésille en dehors du steak est ce qui manquera dedans.' },
              { illu:'reposer', t:'Laisse reposer', duree_min:3,
                detail:'Deux ou trois minutes hors du feu pendant que tu montes le reste.',
                tip:'Même sur un steak haché : le jus se redistribue au lieu de partir dans le pain du bas.' },
              { illu:'dresser', t:'Monte le burger', duree_min:2,
                detail:'Pain du bas, salade (elle isole du jus), steak au fromage, tomate, oignon, chapeau.',
                tip:'La salade EN BAS et pas en haut : c\'est elle qui protège le pain inférieur, celui qui prend tout.' }
            ]
          } },
        { cle:'quo-skyr-granola', n:'Skyr, fruits et granola', svg:'laitier',
          d:'Un grand bol de skyr, des fruits frais, une poignée de granola.',
          i:'🥛 Skyr|🍓 Fruits rouges|🍌 Banane|🌾 Granola|🍯 Miel',
          t:['Protéiné'],
          nu:'11 g de protéines pour 100 g : c\'est l\'appoint le plus simple quand la cible du jour est haute.',
          rec:{
            temps_min:6, portions:1,
            macros:{ p:28, g:76, l:9, kcal:477 },
            ingredients:[
              { em:'🥛', nom:'Skyr', qte:'200 g', g:200, nu:'skyr' },
              { em:'🍓', nom:'Fruits rouges', qte:'100 g', g:100, nu:'fraise' },
              { em:'🍌', nom:'Banane', qte:'1 (120 g)', g:120, nu:'banane' },
              { em:'🌾', nom:'Granola', qte:'40 g', g:40, nu:'granola' },
              { em:'🍯', nom:'Miel', qte:'1 c. à café', g:8, nu:'miel' }
            ],
            steps:[
              { illu:'couper', t:'Coupe la banane', duree_min:2,
                detail:'En rondelles d\'un demi-centimètre.',
                qte:[{ nom:'Banane', qte:'120 g' }],
                tip:'Coupée épaisse elle reste ferme, coupée fine elle se mêle au skyr. À toi de voir — mais coupe-la au dernier moment, elle noircit vite.' },
              { illu:'melanger', t:'Verse le skyr', duree_min:1,
                detail:'Dans un bol, lisse-le à la cuillère.',
                qte:[{ nom:'Skyr', qte:'200 g' }],
                tip:'Le skyr sort dense du pot : trente secondes de cuillère et il devient crémeux, sans rien y ajouter.' },
              { illu:'dresser', t:'Ajoute fruits et granola', duree_min:2,
                detail:'Fruits rouges et banane, granola par-dessus, un filet de miel.',
                qte:[{ nom:'Granola', qte:'40 g' }, { nom:'Miel', qte:'1 c. à café' }],
                tip:'LE GRANOLA EN DERNIER, et juste avant de manger : posé d\'avance sur le skyr, il est mou en cinq minutes.' }
            ]
          } },
        { cle:'quo-riz-cantonais', n:'Riz sauté aux légumes et œuf', svg:'poele',
          d:'Du riz de la veille, sauté à feu vif avec un œuf brouillé et des petits légumes.',
          i:'🍚 Riz|🥚 Œufs|🥕 Carotte|🫛 Petits pois|🧅 Oignon|🫙 Sauce soja',
          t:['Réconfortant'],
          nu:'Le riz de la veille tient mieux à la poêle : refroidi, son amidon ne colle plus.',
          rec:{
            temps_min:20, portions:2,
            macros:{ p:16, g:59, l:13, kcal:419 },
            ingredients:[
              { em:'🍚', nom:'Riz', qte:'300 g cuit (la veille)', g:300, nu:'riz' },
              { em:'🥚', nom:'Œufs', qte:'2', g:110, nu:'oeuf' },
              { em:'🥕', nom:'Carotte', qte:'100 g', g:100, nu:'carotte' },
              { em:'🫛', nom:'Petits pois', qte:'100 g', g:100, nu:'petits pois' },
              { em:'🧅', nom:'Oignon', qte:'80 g', g:80, nu:'oignon' },
              { em:'🫙', nom:'Sauce soja', qte:'2 c. à soupe', g:30, nu:'sauce soja' },
              { em:'🫒', nom:'Huile', qte:'1 c. à soupe', g:12, nu:'huile' }
            ],
            steps:[
              { illu:'refrigerer', t:'Pars de riz FROID', duree_min:1,
                detail:'Du riz de la veille, sorti du réfrigérateur. À défaut, étale du riz fraîchement cuit sur un plateau et laisse-le refroidir complètement.',
                qte:[{ nom:'Riz', qte:'300 g' }],
                tip:'C\'est LA règle du riz sauté. Un riz chaud est gorgé d\'eau : il colle, s\'écrase et devient une bouillie. Froid, ses grains se séparent.' },
              { illu:'couper', t:'Taille les légumes en petits dés', duree_min:5,
                detail:'Carotte et oignon en cubes de 5 mm, pour qu\'ils cuisent en deux minutes.',
                qte:[{ nom:'Carotte', qte:'100 g' }, { nom:'Oignon', qte:'80 g' }],
                tip:'Tout doit être coupé AVANT d\'allumer le feu : un riz sauté se fait en cinq minutes, il n\'y a pas le temps de couper en route.' },
              { illu:'saisir', t:'Brouille les œufs à part', duree_min:3,
                detail:'Feu vif, un peu d\'huile, les œufs battus, remue vite et retire-les dès qu\'ils sont pris.',
                qte:[{ nom:'Œufs', qte:'2' }],
                tip:'À part, puis remis à la fin : cuits avec le riz, ils l\'enrobent d\'une pellicule et tout devient pâteux.' },
              { illu:'saisir', t:'Fais sauter les légumes', duree_min:4,
                detail:'Même poêle très chaude, huile, carotte et oignon 2 min, puis les petits pois.',
                qte:[{ nom:'Carotte', qte:'100 g' }, { nom:'Petits pois', qte:'100 g' }],
                tip:'Feu au maximum et poêle pas trop chargée. En deux fois s\'il le faut : entassés, les légumes bouillent.' },
              { illu:'saisir', t:'Ajoute le riz', duree_min:4,
                detail:'Riz froid émietté à la main, étale-le et laisse-le une minute sans remuer avant de sauter.',
                qte:[{ nom:'Riz', qte:'300 g' }],
                tip:'Cette minute immobile est ce qui donne les grains grillés du fond. Remuer sans arrêt, c\'est réchauffer du riz, pas le sauter.' },
              { illu:'assaisonner', t:'Sauce soja et œufs', duree_min:2,
                detail:'Sauce soja versée SUR LES BORDS de la poêle, remue, remets les œufs.',
                qte:[{ nom:'Sauce soja', qte:'2 c. à soupe' }],
                tip:'Sur les bords brûlants, la sauce caramélise une seconde avant de toucher le riz : c\'est de là que vient le goût des restaurants.' }
            ]
          } },
        { cle:'quo-brochettes-poulet', n:'Brochettes de poulet mariné', svg:'brochette',
          d:'Des cubes de poulet marinés au yaourt et aux épices, passés au gril.',
          i:'🍗 Poulet|🥛 Yaourt|🌶️ Paprika|🍋 Citron|🧄 Ail|🫑 Poivron',
          t:['Protéiné','Épicé'],
          nu:'La marinade au yaourt attendrit la chair : vingt minutes suffisent à changer la texture.',
          rec:{
            temps_min:40, portions:2,
            macros:{ p:65, g:12, l:9, kcal:405 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'400 g de filets', g:400, nu:'poulet' },
              { em:'🥛', nom:'Yaourt', qte:'100 g', g:100, nu:'yaourt' },
              { em:'🌶️', nom:'Paprika', qte:'1 c. à café' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🧄', nom:'Ail', qte:'2 gousses', g:8, nu:'ail' },
              { em:'🫑', nom:'Poivron', qte:'200 g (1 rouge, 1 jaune)', g:200, nu:'poivron' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'couper', t:'Coupe le poulet et les poivrons', duree_min:8,
                detail:'Cubes de 3 cm pour le poulet, carrés de la même taille pour les poivrons.',
                qte:[{ nom:'Poulet', qte:'400 g' }, { nom:'Poivron', qte:'200 g' }],
                tip:'Même taille pour tout : c\'est ce qui fait qu\'un morceau n\'est pas cru quand le voisin est sec.' },
              { illu:'melanger', t:'Prépare la marinade', duree_min:4,
                detail:'Yaourt, paprika, ail écrasé, le jus du citron, sel et poivre. Enrobe les cubes de poulet.',
                qte:[{ nom:'Yaourt', qte:'100 g' }, { nom:'Citron', qte:'1' }, { nom:'Ail', qte:'2 gousses' }],
                tip:'Le yaourt n\'est pas là pour le goût : son acidité et ses enzymes attendrissent la chair. C\'est le principe du tandoori.' },
              { illu:'refrigerer', t:'Laisse mariner', duree_min:20,
                detail:'Au réfrigérateur, à couvert, 20 min au minimum — deux heures c\'est mieux.',
                tip:'Pas plus d\'une nuit : au-delà, l\'acide « cuit » la surface et la chair devient farineuse.' },
              { illu:'saisir', t:'Monte et grille les brochettes', duree_min:10,
                detail:'Alterne poulet et poivron sur les piques, puis 4 min par face sur une poêle-gril très chaude ou au barbecue.',
                qte:[{ nom:'Poulet', qte:'400 g' }],
                tip:'Essuie l\'excédent de marinade avant de griller : le yaourt qui reste brûle et noircit avant que la viande soit cuite.' },
              { illu:'reposer', t:'Laisse reposer', duree_min:3,
                detail:'Trois minutes sous une feuille d\'aluminium.',
                tip:'Un blanc de poulet est maigre : il n\'a pas de gras pour rattraper une découpe trop rapide.' }
            ]
          } },
        { cle:'quo-porridge-avoine', n:'Porridge d\'avoine', svg:'porridge',
          d:'Des flocons cuits dans du lait, garnis de fruits et d\'oléagineux.',
          i:'🌾 Flocons d\'avoine|🥛 Lait|🍌 Banane|🌰 Amandes|🍯 Miel',
          t:['Végétarien','Riche en fibres'],
          nu:'60 g de glucides pour 100 g de flocons : c\'est le petit déjeuner des grosses cibles.',
          rec:{
            temps_min:12, portions:1,
            macros:{ p:23, g:89, l:20, kcal:604 },
            ingredients:[
              { em:'🌾', nom:'Flocons d\'avoine', qte:'60 g', g:60, nu:'flocons avoine' },
              { em:'🥛', nom:'Lait', qte:'250 ml', g:250, nu:'lait' },
              { em:'🍌', nom:'Banane', qte:'1 (120 g)', g:120, nu:'banane' },
              { em:'🍯', nom:'Miel', qte:'1 c. à café', g:8, nu:'miel' },
              { em:'🌰', nom:'Amandes', qte:'15 g', g:15, nu:'amande' },
              { em:'🧂', nom:'Sel', qte:'1 pincée' }
            ],
            steps:[
              { illu:'bouillir', t:'Chauffe le lait avec l\'avoine', duree_min:7,
                detail:'Flocons et lait dans une casserole, une pincée de sel, feu moyen, en remuant sans arrêt.',
                qte:[{ nom:'Flocons d\'avoine', qte:'60 g' }, { nom:'Lait', qte:'250 ml' }],
                tip:'LA PINCÉE DE SEL n\'est pas facultative : sans elle, un porridge au lait est fade quelle que soit la quantité de miel qu\'on y met ensuite.' },
              { illu:'melanger', t:'Remue jusqu\'à épaississement', duree_min:4,
                detail:'Cinq minutes environ. Il doit napper la cuillère sans être compact.',
                tip:'Il épaissit ENCORE dans le bol : arrête-toi quand il te semble un peu trop liquide, sinon tu manges du ciment.' },
              { illu:'dresser', t:'Garnis', duree_min:2,
                detail:'Verse dans un bol, ajoute la banane en rondelles, les amandes concassées et le miel.',
                qte:[{ nom:'Banane', qte:'120 g' }, { nom:'Amandes', qte:'15 g' }, { nom:'Miel', qte:'1 c. à café' }],
                tip:'Le miel après la cuisson : chauffé, il perd ses arômes et ne sert plus qu\'à sucrer.' }
            ]
          } },
        { cle:'quo-ratatouille', n:'Ratatouille', svg:'legumes',
          d:'Aubergine, courgette, poivron et tomate mijotés séparément puis réunis.',
          i:'🍆 Aubergine|🥒 Courgette|🫑 Poivron|🍅 Tomate|🧅 Oignon|🌿 Herbes',
          t:['Végétarien','Léger','Riche en fibres'],
          nu:'Cuire les légumes séparément avant de les réunir : ensemble, ils se noient et fondent en purée.',
          rec:{
            temps_min:70, portions:4,
            macros:{ p:5, g:23, l:16, kcal:240 },
            ingredients:[
              { em:'🍆', nom:'Aubergine', qte:'400 g (1 grosse)', g:400, nu:'aubergine' },
              { em:'🥒', nom:'Courgettes', qte:'400 g', g:400, nu:'courgette' },
              { em:'🫑', nom:'Poivrons', qte:'300 g', g:300, nu:'poivron' },
              { em:'🍅', nom:'Tomates', qte:'500 g', g:500, nu:'tomate' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🧄', nom:'Ail', qte:'3 gousses', g:12, nu:'ail' },
              { em:'🫒', nom:'Huile d\'olive', qte:'5 c. à soupe', g:60, nu:'huile olive' },
              { em:'🌿', nom:'Thym et laurier', qte:'' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'couper', t:'Coupe tout en cubes de 2 cm', duree_min:12,
                detail:'Aubergine, courgettes, poivrons, oignon. Les tomates se pèlent (croix au couteau, 30 s dans l\'eau bouillante) et s\'épépinent.',
                qte:[{ nom:'Aubergine', qte:'400 g' }, { nom:'Courgettes', qte:'400 g' }, { nom:'Poivrons', qte:'300 g' }],
                tip:'Des cubes, pas des rondelles : on veut que chaque bouchée porte les cinq légumes.' },
              { illu:'saisir', t:'Fais revenir CHAQUE légume séparément', duree_min:25,
                detail:'Aubergine d\'abord (elle boit le plus d\'huile), puis courgette, puis poivron, puis oignon. Chacun à feu vif, doré, réservé à part.',
                qte:[{ nom:'Huile d\'olive', qte:'5 c. à soupe' }],
                tip:'C\'EST TOUTE LA RECETTE. Tout jeté ensemble, les légumes rendent leur eau et bouillent : on obtient une compote grise. Séparément, chacun garde son goût et sa tenue.' },
              { illu:'mijoter', t:'Fais la base tomate', duree_min:15,
                detail:'Dans la cocotte, l\'oignon, l\'ail, les tomates, thym et laurier. 15 min à feu moyen jusqu\'à ce que ça réduise.',
                qte:[{ nom:'Tomates', qte:'500 g' }, { nom:'Ail', qte:'3 gousses' }],
                tip:'Attends que la tomate ait perdu son eau et qu\'elle devienne pâte : c\'est ce qui liera tout le reste.' },
              { illu:'mijoter', t:'Réunis et laisse fondre', duree_min:20,
                detail:'Remets tous les légumes, sale, poivre, couvre et laisse à feu très doux 20 min.',
                tip:'À couvert et à feu minuscule : à ce stade on ne cuit plus, on laisse les goûts se rejoindre.' },
              { illu:'reposer', t:'Laisse-la reposer', duree_min:5,
                detail:'Hors du feu, à couvert. Elle est encore meilleure le lendemain.',
                tip:'Une ratatouille est un plat qui se bonifie : la faire la veille n\'est pas un pis-aller, c\'est la bonne façon de la faire.' }
            ]
          } },
        { cle:'quo-dahl-lentilles', n:'Dahl de lentilles corail', svg:'bol',
          d:'Des lentilles corail fondues dans du lait de coco et des épices, sur du riz.',
          i:'🫘 Lentilles corail|🥥 Lait de coco|🍅 Tomate|🫚 Gingembre|🌶️ Curry|🍚 Riz',
          t:['Végétarien','Épicé','Riche en fibres'],
          nu:'Lentilles et riz ensemble donnent des protéines complètes, ce qu\'aucun des deux ne fait seul.',
          rec:{
            temps_min:40, portions:4,
            macros:{ p:20, g:77, l:23, kcal:592 },
            ingredients:[
              { em:'🫘', nom:'Lentilles corail', qte:'250 g crues (≈ 600 g cuites)', g:600, nu:'lentilles' },
              { em:'🥥', nom:'Lait de coco', qte:'400 ml', g:400, nu:'lait de coco' },
              { em:'🍅', nom:'Tomates concassées', qte:'400 g', g:400, nu:'tomate' },
              { em:'🫚', nom:'Gingembre', qte:'20 g', g:20, nu:'gingembre' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🌶️', nom:'Curry', qte:'2 c. à café' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' },
              { em:'🫒', nom:'Huile', qte:'1 c. à soupe', g:12, nu:'huile' }
            ],
            steps:[
              { illu:'rincer', t:'Rince les lentilles', duree_min:3,
                detail:'À l\'eau froide, jusqu\'à ce que l\'eau soit claire.',
                qte:[{ nom:'Lentilles corail', qte:'250 g' }],
                tip:'L\'eau trouble, c\'est l\'amidon de surface : il fait mousser et déborder la casserole.' },
              { illu:'saisir', t:'Fais revenir oignon et gingembre', duree_min:6,
                detail:'Feu moyen, l\'huile, l\'oignon émincé jusqu\'à transparence, puis le gingembre râpé.',
                qte:[{ nom:'Oignon', qte:'150 g' }, { nom:'Gingembre', qte:'20 g' }],
                tip:'Le gingembre après l\'oignon : râpé, il brûle en trente secondes et devient amer.' },
              { illu:'assaisonner', t:'Fais griller les épices', duree_min:2,
                detail:'Curry dans la casserole chaude, remue 30 secondes jusqu\'à ce que ça sente.',
                qte:[{ nom:'Curry', qte:'2 c. à café' }],
                tip:'LES ÉPICES SE GRILLENT DANS LE GRAS avant tout liquide. Jetées dans la sauce, elles gardent un goût de poudre.' },
              { illu:'mijoter', t:'Ajoute lentilles, tomates et coco', duree_min:25,
                detail:'Tout dans la casserole, sale, couvre à moitié et laisse 20 à 25 min à feu doux en remuant de temps en temps.',
                qte:[{ nom:'Lentilles corail', qte:'250 g' }, { nom:'Lait de coco', qte:'400 ml' }, { nom:'Tomates', qte:'400 g' }],
                tip:'Les lentilles corail se délitent : c\'est voulu, c\'est ce qui donne sa texture au dahl. N\'essaie pas de les garder entières.' },
              { illu:'bouillir', t:'Cuis le riz à côté', duree_min:12,
                detail:'Une part de riz pour une part et demie d\'eau, à couvert, 11 min à feu doux.',
                qte:[{ nom:'Riz', qte:'200 g' }],
                tip:'Lance-le quand le dahl entame ses vingt minutes : les deux seront prêts ensemble.' },
              { illu:'assaisonner', t:'Rectifie', duree_min:2,
                detail:'Goûte, resale, ajoute de l\'eau chaude si c\'est trop épais.',
                tip:'Le dahl épaissit en refroidissant : laisse-le un peu plus liquide que ce que tu veux servir.' }
            ]
          } },
        { cle:'quo-cabillaud-poele', n:'Cabillaud poêlé et écrasé de pommes de terre', svg:'poisson',
          d:'Un dos de cabillaud saisi au beurre, un écrasé de pommes de terre à l\'huile d\'olive.',
          i:'🐟 Cabillaud|🥔 Pommes de terre|🍋 Citron|🌿 Aneth|🫒 Huile d\'olive',
          t:['Protéiné','Léger'],
          nu:'Beaucoup de protéines pour très peu de lipides : le plat qui rattrape un jour trop gras.',
          rec:{
            temps_min:35, portions:2,
            macros:{ p:32, g:45, l:25, kcal:533 },
            ingredients:[
              { em:'🐟', nom:'Cabillaud', qte:'2 dos de 150 g', g:300, nu:'cabillaud' },
              { em:'🥔', nom:'Pommes de terre', qte:'500 g', g:500, nu:'pomme de terre' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🌿', nom:'Aneth', qte:'10 g' },
              { em:'🫒', nom:'Huile d\'olive', qte:'3 c. à soupe', g:35, nu:'huile olive' },
              { em:'🧈', nom:'Beurre', qte:'15 g', g:15, nu:'beurre' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'bouillir', t:'Cuis les pommes de terre', duree_min:22,
                detail:'En morceaux, départ à l\'eau froide salée, 20 min jusqu\'à ce que le couteau entre sans effort.',
                qte:[{ nom:'Pommes de terre', qte:'500 g' }],
                tip:'En robe des champs si tu as le temps : la peau retient le goût et l\'eau ne le lave pas.' },
              { illu:'attendre', t:'Sors le poisson du froid', duree_min:15,
                detail:'Pose les dos sur du papier absorbant, à température ambiante, pendant que les pommes de terre cuisent.',
                tip:'Un poisson froid et humide colle à la poêle et se défait. Sec et tempéré, il se décolle tout seul quand il est saisi.' },
              { illu:'melanger', t:'Écrase les pommes de terre', duree_min:5,
                detail:'À la fourchette, grossièrement, avec 2 cuillères d\'huile d\'olive, du sel et la moitié de l\'aneth.',
                qte:[{ nom:'Huile d\'olive', qte:'2 c. à soupe' }],
                tip:'Un écrasé, pas une purée : on veut des morceaux. C\'est ce qui le distingue de la purée à la cuillère.' },
              { illu:'saisir', t:'Poêle le cabillaud', duree_min:7,
                detail:'Poêle bien chaude, une cuillère d\'huile, le poisson côté peau (ou côté présentation) 4 min sans y toucher, puis 2 min de l\'autre côté avec le beurre.',
                qte:[{ nom:'Cabillaud', qte:'300 g' }, { nom:'Beurre', qte:'15 g' }],
                tip:'NE LE RETOURNE QU\'UNE FOIS. Le cabillaud est fragile : chaque manipulation le casse un peu plus.' },
              { illu:'dresser', t:'Dresse', duree_min:3,
                detail:'Écrasé au fond, poisson dessus, le beurre de la poêle et le citron pressé, le reste d\'aneth.',
                qte:[{ nom:'Citron', qte:'1' }, { nom:'Aneth', qte:'10 g' }],
                tip:'Le citron À LA FIN et hors du feu : chauffé, son acidité devient amère.' }
            ]
          } },
        { cle:'quo-buddha-bowl', n:'Buddha bowl', svg:'bol',
          d:'Une céréale, une légumineuse, des crudités et une sauce, montés en bol.',
          i:'🌾 Quinoa|🫘 Pois chiches|🥑 Avocat|🥕 Carotte|🥬 Épinards|🌰 Graines',
          t:['Végétarien','Riche en fibres'],
          nu:'La formule tient sans recette : une céréale, une légumineuse, deux légumes, une sauce.',
          rec:{
            temps_min:35, portions:2,
            macros:{ p:29, g:103, l:38, kcal:825 },
            ingredients:[
              { em:'🌾', nom:'Quinoa', qte:'150 g cru (≈ 450 g cuit)', g:450, nu:'quinoa' },
              { em:'🫘', nom:'Pois chiches', qte:'250 g égouttés', g:250, nu:'pois chiches' },
              { em:'🥑', nom:'Avocat', qte:'1 (130 g)', g:130, nu:'avocat' },
              { em:'🥕', nom:'Carotte', qte:'150 g', g:150, nu:'carotte' },
              { em:'🥬', nom:'Épinards', qte:'100 g', g:100, nu:'epinards' },
              { em:'🌰', nom:'Graines de courge', qte:'30 g', g:30, nu:'graines de courge' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🫒', nom:'Huile d\'olive', qte:'2 c. à soupe', g:25, nu:'huile olive' },
              { em:'🧂', nom:'Sel, poivre, cumin', qte:'' }
            ],
            steps:[
              { illu:'rincer', t:'Rince le quinoa', duree_min:2,
                detail:'À l\'eau froide dans une passoire fine, en frottant entre les mains.',
                qte:[{ nom:'Quinoa', qte:'150 g' }],
                tip:'Le quinoa est enveloppé de saponine, amère. Non rincé, tout le bol a un arrière-goût de savon.' },
              { illu:'bouillir', t:'Cuis-le', duree_min:15,
                detail:'Deux parts d\'eau pour une de quinoa, à couvert, 13 min, puis 5 min hors du feu sans ouvrir.',
                qte:[{ nom:'Quinoa', qte:'150 g' }],
                tip:'Il est cuit quand le petit germe blanc se détache en spirale. Les cinq minutes de repos finissent le travail sans le détremper.' },
              { illu:'enfourner', t:'Rôtis les pois chiches', duree_min:20,
                detail:'Égouttés, séchés, une cuillère d\'huile, sel et cumin, 20 min à 200 °C en remuant à mi-parcours.',
                qte:[{ nom:'Pois chiches', qte:'250 g' }],
                tip:'SÉCHÉS À FOND avant le four : humides, ils cuisent à la vapeur et restent mous au lieu de croustiller.' },
              { illu:'couper', t:'Prépare les légumes crus', duree_min:6,
                detail:'Carotte râpée ou en fins bâtonnets, avocat en lamelles, épinards lavés.',
                qte:[{ nom:'Carotte', qte:'150 g' }, { nom:'Avocat', qte:'130 g' }],
                tip:'La carotte râpée au dernier moment : râpée d\'avance, elle sèche et perd son sucre.' },
              { illu:'fouetter', t:'Fais la sauce', duree_min:3,
                detail:'Jus de citron, une cuillère d\'huile, sel, poivre. Fouette pour émulsionner.',
                qte:[{ nom:'Citron', qte:'1' }, { nom:'Huile d\'olive', qte:'1 c. à soupe' }],
                tip:'Une part d\'acide pour deux d\'huile : c\'est le rapport qui tient sans se séparer dans le bol.' },
              { illu:'dresser', t:'Compose le bol', duree_min:4,
                detail:'Quinoa au fond, puis chaque ingrédient dans SON secteur plutôt que mélangé. Graines et sauce par-dessus.',
                qte:[{ nom:'Graines de courge', qte:'30 g' }],
                tip:'Par secteurs : c\'est ce qui fait qu\'on choisit sa bouchée. Tout mélangé, c\'est une salade composée — bonne, mais autre chose.' }
            ]
          } },
        { cle:'quo-escalope-dinde', n:'Escalope de dinde, riz et brocoli', svg:'assiette',
          d:'Une escalope poêlée deux minutes par face, du riz, un brocoli vapeur.',
          i:'🦃 Dinde|🍚 Riz|🥦 Brocoli|🍋 Citron|🌿 Herbes',
          t:['Protéiné','Léger'],
          nu:'L\'assiette la plus sobre du lot : c\'est celle qu\'on refait sans y penser.',
          rec:{
            temps_min:28, portions:2,
            macros:{ p:53, g:68, l:9, kcal:569 },
            ingredients:[
              { em:'🦃', nom:'Dinde', qte:'2 escalopes (300 g)', g:300, nu:'dinde' },
              { em:'🍚', nom:'Riz', qte:'150 g cru (≈ 390 g cuit)', g:390, nu:'riz' },
              { em:'🥦', nom:'Brocoli', qte:'300 g', g:300, nu:'brocoli' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🌿', nom:'Herbes de Provence', qte:'' },
              { em:'🫒', nom:'Huile d\'olive', qte:'1 c. à soupe', g:12, nu:'huile olive' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'bouillir', t:'Lance le riz', duree_min:12,
                detail:'Une part de riz, une part et demie d\'eau salée, à couvert, 11 min à feu doux.',
                qte:[{ nom:'Riz', qte:'150 g' }],
                tip:'C\'est le plus long : il part en premier, tout le reste s\'aligne dessus.' },
              { illu:'couper', t:'Prépare le brocoli', duree_min:4,
                detail:'En bouquets, tronc épluché et coupé en rondelles.',
                qte:[{ nom:'Brocoli', qte:'300 g' }],
                tip:'Des bouquets de taille égale, sinon les petits sont en bouillie quand les gros sont encore durs.' },
              { illu:'bouillir', t:'Cuis-le à la vapeur', duree_min:7,
                detail:'6 à 7 min au panier vapeur. Il doit rester bien vert.',
                qte:[{ nom:'Brocoli', qte:'300 g' }],
                tip:'Vert vif = cuit. Kaki = trop cuit, et la moitié des vitamines est partie avec la couleur.' },
              { illu:'saisir', t:'Cuis les escalopes', duree_min:6,
                detail:'Poêle chaude, l\'huile, 3 min par face. Sale, poivre, herbes à la fin.',
                qte:[{ nom:'Dinde', qte:'300 g' }],
                tip:'LA DINDE SÈCHE VITE : elle est cuite dès qu\'elle n\'est plus rosée au centre, et chaque minute de plus la durcit.' },
              { illu:'dresser', t:'Dresse', duree_min:2,
                detail:'Riz, brocoli, escalope, le jus de la poêle et un quartier de citron.',
                qte:[{ nom:'Citron', qte:'1' }],
                tip:'Déglace la poêle avec deux cuillères d\'eau et le jus du citron : ça fait une sauce en dix secondes.' }
            ]
          } },
        /* ⚠️ Le seul plat de ce groupe SANS `svg` — il a été photographié
           (photo fournie par Pablo, 2026-08-16), et un plat porte soit une
           photo soit une illustration, jamais les deux : `img()` rend `null`
           dès qu'un `svg` est là, donc laisser la clé aurait masqué la photo. */
        { cle:'quo-pita-saumon-feta', n:'Pita au saumon et feta',
          d:'Un pain pita tiédi, du saumon, de la feta émiettée et des crudités en bâtonnets, avec une crème au yaourt et aux herbes.',
          i:'🐟 Saumon|🧀 Feta|🫓 Pain pita|🥒 Concombre|🥕 Carotte|🌿 Aneth|🥛 Yaourt|🍋 Citron',
          t:['Protéiné','Rapide','Léger'],
          nu:'Saumon et feta apportent les protéines, le yaourt remplace la sauce grasse : on garde le moelleux sans le poids.',
          rec:{
            temps_min:15, portions:2,
            macros:{ p:33, g:52, l:20, kcal:519 },
            ingredients:[
              { em:'🐟', nom:'Saumon fumé', qte:'150 g', g:150, nu:'saumon fume' },
              { em:'🧀', nom:'Feta', qte:'80 g', g:80, nu:'feta' },
              { em:'🫓', nom:'Pains pita', qte:'2', g:160, nu:'pain pita' },
              { em:'🥒', nom:'Concombre', qte:'150 g', g:150, nu:'concombre' },
              { em:'🥕', nom:'Carotte', qte:'100 g', g:100, nu:'carotte' },
              { em:'🌿', nom:'Aneth', qte:'10 g' },
              { em:'🥛', nom:'Yaourt', qte:'100 g', g:100, nu:'yaourt' },
              { em:'🍋', nom:'Citron', qte:'½', g:30, nu:'citron' }
            ],
            steps:[
              { illu:'melanger', t:'Fais la sauce', duree_min:3,
                detail:'Yaourt, jus de citron, aneth ciselé, sel, poivre.',
                qte:[{ nom:'Yaourt', qte:'100 g' }, { nom:'Citron', qte:'½' }, { nom:'Aneth', qte:'10 g' }],
                tip:'Épaisse et citronnée : c\'est elle qui remplace la mayonnaise, et elle tient mieux dans un pain chaud.' },
              { illu:'couper', t:'Taille les légumes', duree_min:5,
                detail:'Concombre en demi-rondelles fines, carotte râpée.',
                qte:[{ nom:'Concombre', qte:'150 g' }, { nom:'Carotte', qte:'100 g' }],
                tip:'Sale le concombre et laisse-le cinq minutes dans une passoire : il rend son eau avant, pas dans le pain.' },
              { illu:'saisir', t:'Réchauffe les pitas', duree_min:3,
                detail:'30 secondes par face dans une poêle sèche, ou au grille-pain.',
                qte:[{ nom:'Pains pita', qte:'2' }],
                tip:'Un pita froid se déchire quand on l\'ouvre. Tiède, il s\'ouvre en poche sans casser.' },
              { illu:'dresser', t:'Garnis', duree_min:4,
                detail:'Sauce à l\'intérieur, puis légumes, saumon en lamelles et feta émiettée.',
                qte:[{ nom:'Saumon fumé', qte:'150 g' }, { nom:'Feta', qte:'80 g' }],
                tip:'La sauce D\'ABORD, contre le pain : elle fait barrière et l\'empêche de se détremper.' }
            ]
          } }
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
          nu:'Le chou et l\'orange ne sont pas une garniture : la vitamine C aide à absorber le fer des haricots noirs.',
          rec:{
            temps_min:150, portions:6,
            macros:{ p:50, g:84, l:26, kcal:767 },
            ingredients:[
              { em:'🫘', nom:'Haricots noirs', qte:'400 g secs (≈ 960 g cuits)', g:960, nu:'haricots noirs' },
              { em:'🥩', nom:'Porc', qte:'500 g (échine et travers)', g:500, nu:'porc' },
              { em:'🌭', nom:'Chorizo', qte:'200 g', g:200, nu:'chorizo' },
              { em:'🍚', nom:'Riz', qte:'300 g cru (≈ 780 g cuit)', g:780, nu:'riz' },
              { em:'🥬', nom:'Chou kale', qte:'200 g', g:200, nu:'chou kale' },
              { em:'🍊', nom:'Orange', qte:'2', g:240, nu:'orange' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' }
            ],
            steps:[
              { illu:'attendre', t:'Fais tremper les haricots', duree_min:720,
                detail:'La veille : les haricots noirs dans trois fois leur volume d\'eau froide, toute la nuit.',
                qte:[{ nom:'Haricots noirs', qte:'400 g' }],
                tip:'Le trempage n\'est pas qu\'un gain de temps : il retire une partie des sucres qui fermentent, ceux qui rendent les haricots difficiles à digérer. Jette cette eau.' },
              { illu:'saisir', t:'Colore les viandes', duree_min:12,
                detail:'Cocotte à sec, le porc en gros morceaux et le chorizo en rondelles, jusqu\'à ce que le gras rende et que tout soit doré.',
                qte:[{ nom:'Porc', qte:'500 g' }, { nom:'Chorizo', qte:'200 g' }],
                tip:'Le gras du chorizo suffit à cuire le reste : n\'ajoute pas d\'huile, tu en aurais deux fois trop.' },
              { illu:'saisir', t:'Ajoute oignon et ail', duree_min:6,
                detail:'Dans le gras rendu, jusqu\'à ce que l\'oignon soit translucide.',
                qte:[{ nom:'Oignon', qte:'150 g' }, { nom:'Ail', qte:'4 gousses' }],
                tip:'Gratte le fond pendant que tu remues : tout ce qui est collé est le goût de la viande, et l\'oignon rend son eau pour le décoller.' },
              { illu:'mijoter', t:'Mijote longuement', duree_min:110,
                detail:'Haricots égouttés, eau à hauteur de deux doigts, feu très doux, à couvert entrouvert, deux heures.',
                qte:[{ nom:'Haricots noirs', qte:'960 g' }],
                tip:'NE SALE PAS AVANT LA FIN. Le sel raffermit la peau des haricots : salés au départ, ils restent durs quelle que soit la durée.' },
              { illu:'bouillir', t:'Riz et chou', duree_min:15,
                detail:'Riz à part. Le kale émincé très fin, sauté deux minutes à l\'huile chaude avec un peu d\'ail.',
                qte:[{ nom:'Riz', qte:'300 g' }, { nom:'Chou kale', qte:'200 g' }],
                tip:'Le chou reste vif et légèrement croquant : c\'est le contrepoint du plat, il ne doit pas fondre.' },
              { illu:'dresser', t:'Sers avec l\'orange', duree_min:5,
                detail:'Haricots et viandes dans une assiette creuse, riz à côté, chou dessus, et des quartiers d\'orange à part.',
                qte:[{ nom:'Orange', qte:'2' }],
                tip:'L\'orange n\'est pas un dessert : son acidité coupe le gras du porc, et c\'est ce qui rend le plat mangeable jusqu\'au bout.' }
            ]
          } },
        { cle:'bre-acai-bowl', n:'Açaí bowl',
          d:'La purée d\'açaí glacée, servie en bol et couverte de fruits frais, de banane et de granola.',
          i:'🫐 Açaí|🍌 Banane|🍓 Fraise|🫐 Myrtille|🌾 Granola|🍯 Miel',
          t:['Végétarien','Riche en fibres'],
          nu:'C\'est un dessert avant d\'être un petit déjeuner : le granola et le miel montent vite en sucres.',
          rec:{
            temps_min:10, portions:1,
            macros:{ p:8, g:82, l:19, kcal:519 },
            ingredients:[
              { em:'🫐', nom:'Açaí', qte:'200 g de pulpe surgelée', g:200, nu:'acai' },
              { em:'🍌', nom:'Banane', qte:'1 (120 g)', g:120, nu:'banane' },
              { em:'🍓', nom:'Fraises', qte:'80 g', g:80, nu:'fraise' },
              { em:'🫐', nom:'Myrtilles', qte:'60 g', g:60, nu:'myrtille' },
              { em:'🌾', nom:'Granola', qte:'40 g', g:40, nu:'granola' },
              { em:'🍯', nom:'Miel', qte:'1 c. à café', g:8, nu:'miel' }
            ],
            steps:[
              { illu:'attendre', t:'Sors l\'açaí du congélateur', duree_min:5,
                detail:'Cinq minutes à température ambiante, pas plus.',
                qte:[{ nom:'Açaí', qte:'200 g' }],
                tip:'Complètement dur, il bloque le mixeur ; complètement décongelé, le bol est liquide. On cherche le moment où le sachet se plie sans casser.' },
              { illu:'mixer', t:'Mixe açaí et banane', duree_min:3,
                detail:'Avec la moitié de la banane et un fond d\'eau ou de jus, jusqu\'à obtenir une texture de sorbet épais.',
                qte:[{ nom:'Açaí', qte:'200 g' }, { nom:'Banane', qte:'60 g' }],
                tip:'LE MOINS DE LIQUIDE POSSIBLE. Un açaí bowl se mange à la cuillère : trop liquide, ce n\'est plus qu\'un smoothie dans un bol.' },
              { illu:'dresser', t:'Garnis', duree_min:2,
                detail:'Verse dans un bol froid, dispose fruits et reste de banane en lignes, granola et miel par-dessus.',
                qte:[{ nom:'Fraises', qte:'80 g' }, { nom:'Myrtilles', qte:'60 g' }, { nom:'Granola', qte:'40 g' }],
                tip:'Un bol sorti du congélateur tient le sorbet dix minutes de plus. C\'est le seul moyen de le finir avant qu\'il ne fonde.' }
            ]
          } },
        { cle:'bre-bobo-de-camarao', n:'Bobó de camarão',
          d:'Des crevettes mijotées dans une crème de manioc au lait de coco, servie sur du riz blanc.',
          i:'🍤 Crevettes|🍠 Manioc|🥥 Lait de coco|🍅 Tomate|🧅 Oignon|🌿 Coriandre',
          t:['Protéiné','Réconfortant'],
          nu:'C\'est le manioc qui donne l\'onctuosité, pas la crème — un liant sans matière grasse.',
          rec:{
            temps_min:55, portions:4,
            macros:{ p:31, g:67, l:27, kcal:637 },
            ingredients:[
              { em:'🍤', nom:'Crevettes', qte:'500 g décortiquées', g:500, nu:'crevettes' },
              { em:'🍠', nom:'Manioc', qte:'600 g', g:600, nu:'manioc' },
              { em:'🥥', nom:'Lait de coco', qte:'400 ml', g:400, nu:'lait de coco' },
              { em:'🍅', nom:'Tomates', qte:'300 g', g:300, nu:'tomate' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🌿', nom:'Coriandre', qte:'20 g' },
              { em:'🫒', nom:'Huile d\'olive', qte:'2 c. à soupe', g:25, nu:'huile olive' },
              { em:'🧄', nom:'Ail', qte:'3 gousses', g:12, nu:'ail' }
            ],
            steps:[
              { illu:'bouillir', t:'Cuis le manioc', duree_min:25,
                detail:'Épluché, coupé en gros morceaux, le cœur fibreux retiré, 25 min à l\'eau salée jusqu\'à ce qu\'il s\'écrase.',
                qte:[{ nom:'Manioc', qte:'600 g' }],
                tip:'LE FIL CENTRAL SE RETIRE TOUJOURS : il est dur et ne cuit jamais. Fends le morceau en deux, il s\'enlève d\'un coup.' },
              { illu:'mixer', t:'Réduis-le en crème', duree_min:4,
                detail:'Mixe le manioc avec la moitié du lait de coco et un peu de son eau de cuisson, jusqu\'à une purée fluide.',
                qte:[{ nom:'Lait de coco', qte:'200 ml' }],
                tip:'C\'est cette purée qui EST la sauce : le bobó n\'a ni farine ni crème, l\'onctuosité vient du manioc.' },
              { illu:'saisir', t:'Fais la base', duree_min:8,
                detail:'Huile, oignon, ail, puis les tomates concassées. Laisse réduire jusqu\'à ce que ce soit une pâte.',
                qte:[{ nom:'Oignon', qte:'150 g' }, { nom:'Tomates', qte:'300 g' }],
                tip:'Laisse vraiment réduire : de l\'eau de tomate dans la crème de manioc et le plat se sépare.' },
              { illu:'mijoter', t:'Réunis', duree_min:8,
                detail:'Ajoute la crème de manioc et le reste de lait de coco, sale, laisse frémir 8 min en remuant.',
                qte:[{ nom:'Lait de coco', qte:'200 ml' }],
                tip:'Ça attache très vite au fond : cuillère en bois et feu doux, sinon un goût de brûlé traverse tout le plat.' },
              { illu:'saisir', t:'Ajoute les crevettes en dernier', duree_min:4,
                detail:'Trois minutes dans la sauce frémissante, juste le temps qu\'elles rosissent.',
                qte:[{ nom:'Crevettes', qte:'500 g' }],
                tip:'Une crevette est cuite quand elle forme un C. Quand elle forme un O, elle est trop cuite et caoutchouteuse.' },
              { illu:'dresser', t:'Sers', duree_min:2,
                detail:'Coriandre ciselée par-dessus, avec du riz blanc.',
                qte:[{ nom:'Coriandre', qte:'20 g' }],
                tip:'La coriandre hors du feu : cuite, elle perd tout et ne laisse qu\'une couleur.' }
            ]
          } },
        { cle:'bre-moqueca-poisson', n:'Moqueca de poisson',
          d:'Un ragoût de poisson blanc au lait de coco, poivrons et citron vert, mijoté à couvert dans son jus.',
          i:'🐟 Poisson blanc|🥥 Lait de coco|🫑 Poivron|🍅 Tomate|🍋 Citron vert|🌿 Coriandre',
          t:['Protéiné'],
          nu:'Le poisson blanc est très maigre : ici, tous les lipides du plat viennent du lait de coco.',
          rec:{
            temps_min:45, portions:4,
            macros:{ p:35, g:16, l:27, kcal:444 },
            ingredients:[
              { em:'🐟', nom:'Poisson blanc', qte:'700 g (cabillaud, lieu)', g:700, nu:'cabillaud' },
              { em:'🥥', nom:'Lait de coco', qte:'400 ml', g:400, nu:'lait de coco' },
              { em:'🫑', nom:'Poivrons', qte:'300 g (rouge et jaune)', g:300, nu:'poivron' },
              { em:'🍅', nom:'Tomates', qte:'300 g', g:300, nu:'tomate' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🌿', nom:'Coriandre', qte:'20 g' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🫒', nom:'Huile d\'olive', qte:'2 c. à soupe', g:25, nu:'huile olive' }
            ],
            steps:[
              { illu:'assaisonner', t:'Fais mariner le poisson', duree_min:20,
                detail:'Coupe-le en gros pavés, arrose du jus d\'un citron vert, sale, poivre, laisse 20 min au frais.',
                qte:[{ nom:'Poisson blanc', qte:'700 g' }, { nom:'Citron vert', qte:'1' }],
                tip:'Vingt minutes, pas plus : au-delà, l\'acide commence à cuire la chair et elle se délitera dans la sauce.' },
              { illu:'couper', t:'Taille les légumes en rondelles', duree_min:8,
                detail:'Oignon, poivrons et tomates en rondelles régulières de 5 mm.',
                qte:[{ nom:'Poivrons', qte:'300 g' }, { nom:'Tomates', qte:'300 g' }, { nom:'Oignon', qte:'150 g' }],
                tip:'En rondelles et pas en dés : la moqueca se monte en COUCHES, et les rondelles se superposent sans s\'écraser.' },
              { illu:'melanger', t:'Monte les couches', duree_min:6,
                detail:'Dans une cocotte : un filet d\'huile, la moitié des légumes, le poisson, le reste des légumes.',
                qte:[{ nom:'Poisson blanc', qte:'700 g' }],
                tip:'On ne remue JAMAIS une moqueca. C\'est ce qui garde les pavés entiers du début à la fin.' },
              { illu:'mijoter', t:'Verse le lait de coco et laisse mijoter', duree_min:18,
                detail:'Lait de coco par-dessus, couvre, feu doux, 15 à 18 min sans toucher.',
                qte:[{ nom:'Lait de coco', qte:'400 ml' }],
                tip:'Le poisson est cuit quand la chair se sépare en lamelles à la pointe d\'un couteau. Piquer un seul pavé suffit à savoir.' },
              { illu:'dresser', t:'Finis au citron et à la coriandre', duree_min:3,
                detail:'Hors du feu, le jus du second citron et la coriandre en grande quantité.',
                qte:[{ nom:'Citron vert', qte:'1' }, { nom:'Coriandre', qte:'20 g' }],
                tip:'Le citron à la fin réveille tout : la coco est douce, elle a besoin de ce coup d\'acide au dernier moment.' }
            ]
          } },
        { cle:'bre-xinxim', n:'Xinxim de galinha',
          d:'Du poulet mijoté aux crevettes séchées et à la cacahuète pilée, un des grands plats de Bahia.',
          i:'🍗 Poulet|🍤 Crevettes séchées|🥜 Cacahuètes|🧅 Oignon|🫚 Gingembre|🍋 Citron',
          t:['Protéiné','Réconfortant'],
          nu:'Cacahuètes et crevettes séchées apportent le gras du plat : la volaille, elle, peut rester maigre.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:70, g:12, l:25, kcal:560 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'700 g de cuisses', g:700, nu:'poulet' },
              { em:'🍤', nom:'Crevettes séchées', qte:'60 g', g:60, nu:'crevettes sechees' },
              { em:'🥜', nom:'Cacahuètes', qte:'80 g', g:80, nu:'cacahuetes' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🫚', nom:'Gingembre', qte:'20 g', g:20, nu:'gingembre' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' }
            ],
            steps:[
              { illu:'assaisonner', t:'Fais mariner le poulet', duree_min:15,
                detail:'Morceaux de cuisse, jus de citron, ail écrasé, sel, poivre. Quinze minutes au frais.',
                qte:[{ nom:'Poulet', qte:'700 g' }, { nom:'Citron', qte:'1' }, { nom:'Ail', qte:'4 gousses' }],
                tip:'Le citron et l\'ail, c\'est le « tempero » brésilien : cette marinade courte est ce qui donne son fond de goût au plat.' },
              { illu:'mixer', t:'Prépare la pâte de crevettes et cacahuètes', duree_min:6,
                detail:'Mixe les crevettes séchées et les cacahuètes grillées jusqu\'à obtenir une poudre grossière.',
                qte:[{ nom:'Crevettes séchées', qte:'60 g' }, { nom:'Cacahuètes', qte:'80 g' }],
                tip:'Grossière, pas en beurre : on veut sentir les éclats sous la dent. Mixée trop fin, la sauce devient pâteuse.' },
              { illu:'saisir', t:'Dore le poulet', duree_min:12,
                detail:'Huile chaude, les morceaux égouttés, dorés sur toutes les faces, puis réserve.',
                qte:[{ nom:'Poulet', qte:'700 g' }],
                tip:'Égoutte bien la marinade : mouillé, le poulet bout au lieu de dorer et la peau reste blanche.' },
              { illu:'saisir', t:'Fais la base', duree_min:7,
                detail:'Oignon et gingembre dans la même cocotte jusqu\'à ce que ce soit tendre, puis la poudre de crevettes-cacahuètes, remue une minute.',
                qte:[{ nom:'Oignon', qte:'200 g' }, { nom:'Gingembre', qte:'20 g' }],
                tip:'La poudre grillée une minute dans le gras : c\'est là qu\'elle libère son parfum. Jetée dans le liquide, elle reste plate.' },
              { illu:'mijoter', t:'Mijote', duree_min:22,
                detail:'Remets le poulet, la marinade, de l\'eau à mi-hauteur, couvre et laisse 20 min à feu doux.',
                qte:[{ nom:'Poulet', qte:'700 g' }],
                tip:'À mi-hauteur seulement : la sauce doit napper, pas nager. On peut toujours allonger à la fin.' }
            ]
          } }
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
          nu:'L\'aubergine boit l\'huile : la précuire à la vapeur avant le wok divise la matière grasse par trois.',
          rec:{
            temps_min:35, portions:3,
            macros:{ p:9, g:68, l:13, kcal:419 },
            ingredients:[
              { em:'🍆', nom:'Aubergines', qte:'600 g', g:600, nu:'aubergine' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' },
              { em:'🫚', nom:'Gingembre', qte:'20 g', g:20, nu:'gingembre' },
              { em:'🥢', nom:'Sauce soja', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🌶️', nom:'Doubanjiang', qte:'1 c. à soupe', g:15, nu:'doubanjiang' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' },
              { em:'🍯', nom:'Sucre', qte:'1 c. à café', g:5, nu:'sucre' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' },
              { em:'🧅', nom:'Ciboule', qte:'2 tiges', g:20, nu:'ciboule' }
            ],
            steps:[
              { illu:'couper', t:'Coupe les aubergines en bâtonnets', duree_min:6,
                detail:'Des bâtonnets de la taille d\'un doigt, peau comprise.',
                qte:[{ nom:'Aubergines', qte:'600 g' }],
                tip:'En bâtonnets et pas en dés : c\'est la forme traditionnelle, et surtout ils cuisent vite tout en gardant du fondant au centre.' },
              { illu:'assaisonner', t:'Sale-les et laisse-les dégorger', duree_min:10,
                detail:'Une cuillère de sel, dix minutes dans une passoire, puis éponge-les.',
                qte:[{ nom:'Aubergines', qte:'600 g' }],
                tip:'C\'EST L\'ÉTAPE QUI FAIT ÉCONOMISER L\'HUILE. Une aubergine crue est une éponge : dégorgée, ses cellules se sont refermées et elle en boit trois fois moins.' },
              { illu:'saisir', t:'Fais-les revenir à feu vif', duree_min:8,
                detail:'Wok très chaud, l\'huile, les bâtonnets en une seule couche, jusqu\'à ce qu\'ils soient dorés et fondants. Réserve.',
                qte:[{ nom:'Aubergines', qte:'600 g' }, { nom:'Huile', qte:'3 c. à soupe' }],
                tip:'En deux fois s\'il le faut. Entassées, elles rendent leur eau et vapeur au lieu de dorer.' },
              { illu:'saisir', t:'Fais la sauce yúxiāng', duree_min:4,
                detail:'Un peu d\'huile, ail et gingembre hachés, le doubanjiang 30 s, puis soja, sucre et 100 ml d\'eau.',
                qte:[{ nom:'Ail', qte:'5 gousses' }, { nom:'Doubanjiang', qte:'1 c. à soupe' }, { nom:'Sauce soja', qte:'3 c. à soupe' }],
                tip:'Le doubanjiang doit frire un instant dans l\'huile jusqu\'à ce qu\'elle rougisse : c\'est de là que vient la couleur du plat.' },
              { illu:'melanger', t:'Réunis', duree_min:3,
                detail:'Remets les aubergines, fais réduire deux minutes jusqu\'à ce que la sauce nappe.',
                tip:'« Yúxiāng » veut dire parfum de poisson, et il n\'y a pas de poisson : c\'est l\'équilibre aigre-doux-piquant qui porte ce nom.' },
              { illu:'dresser', t:'Sers sur le riz', duree_min:2,
                detail:'Ciboule ciselée par-dessus, riz blanc à côté.',
                qte:[{ nom:'Riz', qte:'200 g' }, { nom:'Ciboule', qte:'2 tiges' }],
                tip:'Le riz nature, jamais assaisonné : la sauce est puissante, il lui faut un fond neutre.' }
            ]
          } },
        { cle:'chi-mapo-tofu', n:'Mápó dòufu',
          d:'Des cubes de tofu soyeux dans une sauce rouge au piment fermenté et au poivre de Sichuan.',
          i:'🧊 Tofu|🥩 Viande hachée|🌶️ Doubanjiang|🧄 Ail|🧅 Ciboule|🍚 Riz',
          t:['Protéiné','Épicé'],
          nu:'Une petite quantité de viande suffit à porter tout le plat : c\'est le tofu qui fait le volume.',
          rec:{
            temps_min:30, portions:3,
            macros:{ p:38, g:57, l:26, kcal:622 },
            ingredients:[
              { em:'🧊', nom:'Tofu', qte:'500 g ferme', g:500, nu:'tofu' },
              { em:'🥩', nom:'Viande hachée', qte:'200 g de porc', g:200, nu:'porc' },
              { em:'🌶️', nom:'Doubanjiang', qte:'2 c. à soupe', g:30, nu:'doubanjiang' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🧅', nom:'Ciboule', qte:'3 tiges', g:30, nu:'ciboule' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' },
              { em:'🫒', nom:'Huile', qte:'2 c. à soupe', g:25, nu:'huile' },
              { em:'🌾', nom:'Fécule', qte:'1 c. à café', g:5, nu:'farine' }
            ],
            steps:[
              { illu:'couper', t:'Coupe le tofu en cubes', duree_min:4,
                detail:'Des cubes de 2 cm, égouttés sur du papier.',
                qte:[{ nom:'Tofu', qte:'500 g' }],
                tip:'Du tofu FERME, jamais soyeux : le soyeux se désagrège au premier coup de cuillère.' },
              { illu:'bouillir', t:'Blanchis-le', duree_min:4,
                detail:'Deux minutes dans l\'eau bouillante salée, puis égoutte délicatement.',
                qte:[{ nom:'Tofu', qte:'500 g' }],
                tip:'Ce blanchiment raffermit le tofu et lui retire son goût de soja cru. C\'est cinq minutes qui changent le plat.' },
              { illu:'saisir', t:'Fais rissoler la viande', duree_min:6,
                detail:'Wok chaud, l\'huile, le porc haché écrasé à la spatule jusqu\'à ce qu\'il soit sec et croustillant.',
                qte:[{ nom:'Viande hachée', qte:'200 g' }],
                tip:'On cherche des miettes croustillantes, pas une masse grise : c\'est ce qui donne le contraste avec le tofu fondant.' },
              { illu:'saisir', t:'Ajoute le doubanjiang et l\'ail', duree_min:3,
                detail:'Baisse le feu, le doubanjiang jusqu\'à ce que l\'huile rougisse, puis l\'ail.',
                qte:[{ nom:'Doubanjiang', qte:'2 c. à soupe' }, { nom:'Ail', qte:'4 gousses' }],
                tip:'Feu MOYEN pour cette étape : le doubanjiang brûle vite et devient amer, et il n\'y a pas de retour en arrière.' },
              { illu:'mijoter', t:'Ajoute le tofu et l\'eau', duree_min:7,
                detail:'200 ml d\'eau, le tofu, et laisse frémir 5 min en poussant délicatement plutôt qu\'en remuant.',
                qte:[{ nom:'Tofu', qte:'500 g' }],
                tip:'On POUSSE le tofu avec le dos de la cuillère, on ne le remue pas : remué, il se casse en bouillie.' },
              { illu:'melanger', t:'Lie et sers', duree_min:3,
                detail:'Fécule délayée dans un peu d\'eau froide, versée en filet, remue jusqu\'à épaississement. Ciboule par-dessus.',
                qte:[{ nom:'Fécule', qte:'1 c. à café' }, { nom:'Ciboule', qte:'3 tiges' }],
                tip:'La fécule TOUJOURS délayée à l\'eau froide : jetée sèche, elle fait des grumeaux qu\'on ne rattrape pas.' }
            ]
          } },
        { cle:'chi-kung-pao', n:'Poulet kung pao',
          d:'Du poulet sauté avec des cacahuètes, des piments séchés et des poivrons, dans une sauce aigre-douce.',
          i:'🍗 Poulet|🥜 Cacahuètes|🫑 Poivron|🌶️ Piment|🥢 Sauce soja|🍚 Riz',
          t:['Protéiné','Épicé'],
          nu:'Les cacahuètes ne sont pas un décor : elles apportent l\'essentiel des lipides du plat.',
          rec:{
            temps_min:30, portions:3,
            macros:{ p:65, g:63, l:28, kcal:779 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'500 g de filets', g:500, nu:'poulet' },
              { em:'🥜', nom:'Cacahuètes', qte:'80 g', g:80, nu:'cacahuetes' },
              { em:'🫑', nom:'Poivron', qte:'200 g', g:200, nu:'poivron' },
              { em:'🌶️', nom:'Piments séchés', qte:'6' },
              { em:'🥢', nom:'Sauce soja', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' },
              { em:'🍯', nom:'Sucre', qte:'2 c. à café', g:10, nu:'sucre' },
              { em:'🫒', nom:'Huile', qte:'2 c. à soupe', g:25, nu:'huile' },
              { em:'🌾', nom:'Fécule', qte:'2 c. à café', g:10, nu:'farine' }
            ],
            steps:[
              { illu:'couper', t:'Coupe le poulet en cubes', duree_min:6,
                detail:'Des cubes de 2 cm, réguliers.',
                qte:[{ nom:'Poulet', qte:'500 g' }],
                tip:'Tous de la même taille : dans un wok, tout cuit en trois minutes, un morceau plus gros restera cru.' },
              { illu:'melanger', t:'Fais le velouting', duree_min:10,
                detail:'Mélange le poulet avec une cuillère de soja, la fécule et une cuillère d\'eau. Laisse 10 min.',
                qte:[{ nom:'Poulet', qte:'500 g' }, { nom:'Fécule', qte:'2 c. à café' }],
                tip:'LE VELOUTING EST LE SECRET DES RESTAURANTS. La fécule forme une pellicule qui retient le jus : le poulet reste tendre même à feu très vif.' },
              { illu:'melanger', t:'Prépare la sauce à l\'avance', duree_min:3,
                detail:'Reste de soja, sucre, une cuillère de vinaigre et deux d\'eau dans un bol.',
                qte:[{ nom:'Sauce soja', qte:'2 c. à soupe' }],
                tip:'Tout doit être prêt AVANT d\'allumer : un sauté au wok dure quatre minutes, il n\'y a pas le temps de doser en route.' },
              { illu:'saisir', t:'Saisis le poulet', duree_min:5,
                detail:'Wok brûlant, l\'huile, le poulet en une couche, sans bouger 1 min, puis saute jusqu\'à coloration. Réserve.',
                qte:[{ nom:'Poulet', qte:'500 g' }],
                tip:'Le wok doit fumer avant que quoi que ce soit y entre. C\'est ce « souffle du wok » qui distingue un sauté d\'un ragoût.' },
              { illu:'saisir', t:'Piments, poivron, cacahuètes', duree_min:4,
                detail:'Piments séchés quelques secondes, puis le poivron 2 min, puis les cacahuètes.',
                qte:[{ nom:'Poivron', qte:'200 g' }, { nom:'Cacahuètes', qte:'80 g' }],
                tip:'Les piments d\'abord et brièvement : ils parfument l\'huile. Noircis, ils rendent tout le plat âcre.' },
              { illu:'melanger', t:'Réunis et laque', duree_min:3,
                detail:'Remets le poulet, verse la sauce, saute une minute jusqu\'à ce qu\'elle enrobe tout.',
                tip:'La sauce doit accrocher, pas baigner : si elle reste liquide, monte le feu trente secondes de plus.' }
            ]
          } },
        { cle:'chi-raviolis-vapeur', n:'Raviolis vapeur',
          d:'Des jiǎozi pliés à la main, cuits à la vapeur et trempés dans une sauce soja-vinaigre.',
          i:'🥟 Pâte à raviolis|🥩 Viande hachée|🥬 Chou|🧅 Ciboule|🫚 Gingembre|🥢 Sauce soja',
          t:['Réconfortant','Protéiné'],
          nu:'À la vapeur plutôt que poêlés, ce sont les mêmes raviolis sans l\'huile de la poêle.',
          rec:{
            temps_min:70, portions:4,
            macros:{ p:29, g:44, l:14, kcal:424 },
            ingredients:[
              { em:'🥟', nom:'Pâte à raviolis', qte:'300 g (40 disques)', g:300, nu:'pate a pizza' },
              { em:'🥩', nom:'Viande hachée', qte:'300 g de porc', g:300, nu:'porc' },
              { em:'🥬', nom:'Chou', qte:'200 g', g:200, nu:'chou' },
              { em:'🧅', nom:'Ciboule', qte:'4 tiges', g:40, nu:'ciboule' },
              { em:'🫚', nom:'Gingembre', qte:'20 g', g:20, nu:'gingembre' },
              { em:'🥢', nom:'Sauce soja', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🌾', nom:'Sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' }
            ],
            steps:[
              { illu:'couper', t:'Hache le chou très fin', duree_min:8,
                detail:'Puis sale-le et laisse-le rendre son eau dix minutes. Presse-le à la main.',
                qte:[{ nom:'Chou', qte:'200 g' }],
                tip:'SI TU SAUTES CETTE ÉTAPE, la farce détrempe la pâte et les raviolis percent à la cuisson. Il sort une demi-tasse d\'eau d\'un chou.' },
              { illu:'melanger', t:'Prépare la farce', duree_min:8,
                detail:'Porc, chou pressé, ciboule, gingembre râpé, soja, sésame. Mélange dans un seul sens jusqu\'à ce que ce soit collant.',
                qte:[{ nom:'Viande hachée', qte:'300 g' }, { nom:'Gingembre', qte:'20 g' }],
                tip:'Toujours dans le MÊME SENS, deux ou trois minutes : c\'est ce qui fait « prendre » la farce et l\'empêche de s\'effriter à la bouchée.' },
              { illu:'melanger', t:'Farcis les raviolis', duree_min:25,
                detail:'Une cuillère à café au centre du disque, mouille le bord au doigt, plie en deux et pince en formant des plis d\'un côté.',
                qte:[{ nom:'Pâte à raviolis', qte:'40 disques' }],
                tip:'Une cuillère à café, pas plus : trop garni, le ravioli s\'ouvre à la vapeur. Et les plis d\'un seul côté font tenir la forme debout.' },
              { illu:'bouillir', t:'Cuis à la vapeur', duree_min:12,
                detail:'Panier tapissé de papier cuisson percé ou de feuilles de chou, raviolis espacés, 10 à 12 min à couvert sur l\'eau bouillante.',
                tip:'Espacés d\'un centimètre : ils gonflent et se collent entre eux, et deux raviolis collés se déchirent en les séparant.' },
              { illu:'dresser', t:'Sers avec la sauce', duree_min:3,
                detail:'Soja, un trait de vinaigre noir et un peu de gingembre râpé dans un bol à part.',
                tip:'La sauce se trempe, elle ne se verse pas : versée dessus, la pâte se détrempe en une minute.' }
            ]
          } }
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
          nu:'Cinq légumes différents dans un seul bol, sans que ça ressemble à une assiette de légumes.',
          rec:{
            temps_min:45, portions:2,
            macros:{ p:51, g:75, l:35, kcal:827 },
            ingredients:[
              { em:'🥩', nom:'Bœuf', qte:'250 g de bavette', g:250, nu:'boeuf' },
              { em:'🍚', nom:'Riz', qte:'150 g cru (≈ 390 g cuit)', g:390, nu:'riz' },
              { em:'🥕', nom:'Carotte', qte:'150 g', g:150, nu:'carotte' },
              { em:'🥬', nom:'Épinards', qte:'200 g', g:200, nu:'epinards' },
              { em:'🥚', nom:'Œufs', qte:'2', g:110, nu:'oeuf' },
              { em:'🌶️', nom:'Gochujang', qte:'2 c. à soupe', g:30, nu:'gochujang' },
              { em:'🥢', nom:'Sauce soja', qte:'2 c. à soupe', g:30, nu:'sauce soja' },
              { em:'🌾', nom:'Sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' },
              { em:'🫒', nom:'Huile de sésame', qte:'1 c. à soupe', g:12, nu:'huile' }
            ],
            steps:[
              { illu:'bouillir', t:'Lance le riz', duree_min:15,
                detail:'Riz rincé, une part et demie d\'eau, à couvert, 11 min puis 5 min de repos.',
                qte:[{ nom:'Riz', qte:'150 g' }],
                tip:'Le bibimbap se mange tiède, pas brûlant : le riz peut attendre pendant que tu prépares le reste.' },
              { illu:'assaisonner', t:'Fais mariner le bœuf', duree_min:10,
                detail:'Émincé finement, avec le soja, un peu d\'huile de sésame et de l\'ail. Dix minutes.',
                qte:[{ nom:'Bœuf', qte:'250 g' }, { nom:'Sauce soja', qte:'2 c. à soupe' }],
                tip:'Émince le bœuf À MOITIÉ CONGELÉ : c\'est le seul moyen d\'obtenir des tranches fines à la maison.' },
              { illu:'bouillir', t:'Prépare chaque légume à part', duree_min:10,
                detail:'Épinards blanchis 30 s puis pressés et assaisonnés ; carottes en julienne sautées 2 min.',
                qte:[{ nom:'Épinards', qte:'200 g' }, { nom:'Carotte', qte:'150 g' }],
                tip:'CHACUN SÉPARÉMENT, c\'est la règle du bibimbap : chaque namul a son goût, et c\'est le contraste qui fait le plat.' },
              { illu:'saisir', t:'Saisis le bœuf', duree_min:4,
                detail:'Poêle très chaude, en une couche, deux minutes à peine.',
                qte:[{ nom:'Bœuf', qte:'250 g' }],
                tip:'Coupé fin, il cuit en quelques secondes. Trop cuit, une bavette devient sèche et filandreuse.' },
              { illu:'saisir', t:'Cuis les œufs au plat', duree_min:3,
                detail:'Jaune coulant, blanc pris et croustillant sur les bords.',
                tip:'LE JAUNE COULANT EST STRUCTUREL : c\'est lui qui, mélangé, lie le riz et adoucit le gochujang.' },
              { illu:'dresser', t:'Compose et mélange', duree_min:4,
                detail:'Riz au fond, chaque garniture dans son secteur, œuf au centre, gochujang à côté. On mélange TOUT au moment de manger.',
                qte:[{ nom:'Gochujang', qte:'2 c. à soupe' }, { nom:'Sésame', qte:'1 c. à soupe' }],
                tip:'« Bibim » veut dire mélanger. Le dressage en secteurs n\'est pas une décoration : c\'est ce qui permet de doser soi-même la pâte de piment.' }
            ]
          } },
        { cle:'cor-nouilles-poulet', n:'Nouilles au poulet',
          d:'Des nouilles épaisses dans une sauce crémeuse au piment fermenté, poulet effiloché et oignon rouge mariné par-dessus.',
          i:'🍜 Nouilles|🍗 Poulet|🌶️ Gochujang|🧅 Oignon|🥛 Lait|🌿 Coriandre',
          t:['Réconfortant','Épicé'],
          nu:'Le poulet effiloché fait monter les protéines d\'un plat de nouilles qui, seul, n\'en apporterait presque pas.',
          rec:{
            temps_min:30, portions:2,
            macros:{ p:61, g:78, l:10, kcal:690 },
            ingredients:[
              { em:'🍜', nom:'Nouilles', qte:'200 g sèches (≈ 480 g cuites)', g:480, nu:'nouilles' },
              { em:'🍗', nom:'Poulet', qte:'300 g', g:300, nu:'poulet' },
              { em:'🌶️', nom:'Gochujang', qte:'2 c. à soupe', g:30, nu:'gochujang' },
              { em:'🧅', nom:'Oignon', qte:'120 g', g:120, nu:'oignon' },
              { em:'🥛', nom:'Lait', qte:'150 ml', g:150, nu:'lait' },
              { em:'🌿', nom:'Coriandre', qte:'10 g' },
              { em:'🧄', nom:'Ail', qte:'3 gousses', g:12, nu:'ail' }
            ],
            steps:[
              { illu:'couper', t:'Coupe le poulet et l\'oignon', duree_min:5,
                detail:'Poulet en lanières, oignon en demi-lunes.',
                qte:[{ nom:'Poulet', qte:'300 g' }, { nom:'Oignon', qte:'120 g' }],
                tip:'En lanières dans le sens contraire des fibres : c\'est ce qui rend le blanc tendre au lieu de filandreux.' },
              { illu:'saisir', t:'Dore le poulet', duree_min:7,
                detail:'Poêle chaude, un filet d\'huile, jusqu\'à ce qu\'il soit coloré. Ajoute l\'oignon et l\'ail.',
                qte:[{ nom:'Poulet', qte:'300 g' }, { nom:'Ail', qte:'3 gousses' }],
                tip:'Attends que le poulet accroche avant de remuer : ce qui colle au fond deviendra la sauce.' },
              { illu:'melanger', t:'Ajoute le gochujang et le lait', duree_min:6,
                detail:'Gochujang délayé dans le lait, versé sur le poulet, laisse épaissir à feu moyen.',
                qte:[{ nom:'Gochujang', qte:'2 c. à soupe' }, { nom:'Lait', qte:'150 ml' }],
                tip:'LE LAIT N\'EST PAS UN CAPRICE : la caséine se lie à la capsaïcine et arrondit le piquant sans l\'effacer. L\'eau ne fait pas ça.' },
              { illu:'bouillir', t:'Cuis les nouilles', duree_min:6,
                detail:'Dans une grande casserole d\'eau bouillante, une minute de moins que le paquet, puis rince-les à l\'eau froide.',
                qte:[{ nom:'Nouilles', qte:'200 g' }],
                tip:'Le rinçage à froid retire l\'amidon de surface : sans lui, les nouilles coréennes collent en bloc.' },
              { illu:'melanger', t:'Réunis', duree_min:3,
                detail:'Nouilles dans la sauce, saute une minute pour qu\'elles s\'enrobent. Coriandre par-dessus.',
                tip:'Si la sauce a trop réduit, une louche d\'eau de cuisson la rallonge sans la diluer en goût.' }
            ]
          } },
        { cle:'cor-bulgogi', n:'Bulgogi grillé',
          d:'De fines lamelles de bœuf marinées à la sauce soja, à la poire et au sésame, saisies très vite sur le gril.',
          i:'🥩 Bœuf|🥢 Sauce soja|🍐 Poire|🧄 Ail|🌾 Graines de sésame|🍚 Riz',
          t:['Protéiné'],
          nu:'La marinade à la poire attendrit la viande — on peut donc prendre un morceau maigre sans qu\'il devienne sec.',
          rec:{
            temps_min:40, portions:3,
            macros:{ p:51, g:64, l:31, kcal:761 },
            ingredients:[
              { em:'🥩', nom:'Bœuf', qte:'500 g de bavette ou faux-filet', g:500, nu:'boeuf' },
              { em:'🥢', nom:'Sauce soja', qte:'4 c. à soupe', g:60, nu:'sauce soja' },
              { em:'🍐', nom:'Poire', qte:'1 (150 g)', g:150, nu:'poire' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' },
              { em:'🌾', nom:'Graines de sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' },
              { em:'🍯', nom:'Sucre', qte:'1 c. à soupe', g:12, nu:'sucre' },
              { em:'🫒', nom:'Huile de sésame', qte:'1 c. à soupe', g:12, nu:'huile' }
            ],
            steps:[
              { illu:'couper', t:'Émince le bœuf très fin', duree_min:8,
                detail:'Tranches de 2-3 mm, la viande passée 30 min au congélateur avant.',
                qte:[{ nom:'Bœuf', qte:'500 g' }],
                tip:'Le congélateur raffermit la viande juste assez pour que le couteau glisse. C\'est la seule façon d\'obtenir du 2 mm sans trancheuse.' },
              { illu:'mixer', t:'Râpe la poire', duree_min:4,
                detail:'Poire râpée finement, mélangée au soja, à l\'ail écrasé, au sucre et à l\'huile de sésame.',
                qte:[{ nom:'Poire', qte:'150 g' }, { nom:'Sauce soja', qte:'4 c. à soupe' }],
                tip:'LA POIRE EST L\'ATTENDRISSEUR. Ses enzymes cassent les fibres de la viande — c\'est elle, et pas la marinade en général, qui rend le bulgogi si tendre.' },
              { illu:'refrigerer', t:'Laisse mariner', duree_min:20,
                detail:'Le bœuf dans la marinade, au frais, 20 min minimum.',
                tip:'Pas plus de deux heures avec de la poire : au-delà, la viande devient molle et pâteuse.' },
              { illu:'saisir', t:'Saisis à feu très vif', duree_min:6,
                detail:'Poêle ou plancha brûlante, la viande en une seule couche, une minute par face.',
                qte:[{ nom:'Bœuf', qte:'500 g' }],
                tip:'En plusieurs fois s\'il le faut. Entassée, la viande rend son jus et bout dans sa marinade — on veut de la caramélisation.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Sésame par-dessus, riz blanc et feuilles de salade pour envelopper.',
                qte:[{ nom:'Riz', qte:'200 g' }, { nom:'Graines de sésame', qte:'1 c. à soupe' }],
                tip:'Le bulgogi se mange en ssam : une feuille de salade, du riz, de la viande, on plie et on mange d\'une bouchée.' }
            ]
          } },
        { cle:'cor-poulet-gochujang', n:'Poulet gochujang caramélisé',
          d:'Une cuisse de poulet laquée au piment fermenté et au miel, caramélisée jusqu\'à ce que la sauce colle à la peau.',
          i:'🍗 Poulet|🌶️ Gochujang|🍯 Miel|🧄 Ail|🫚 Gingembre|🍚 Riz',
          t:['Protéiné','Épicé'],
          nu:'Le gochujang porte beaucoup de goût pour peu de matière grasse : la sauce n\'a pas besoin d\'huile.',
          rec:{
            temps_min:40, portions:3,
            macros:{ p:69, g:70, l:10, kcal:664 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'600 g de hauts de cuisse', g:600, nu:'poulet' },
              { em:'🌶️', nom:'Gochujang', qte:'3 c. à soupe', g:45, nu:'gochujang' },
              { em:'🍯', nom:'Miel', qte:'2 c. à soupe', g:40, nu:'miel' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🫚', nom:'Gingembre', qte:'15 g', g:15, nu:'gingembre' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' },
              { em:'🥢', nom:'Sauce soja', qte:'2 c. à soupe', g:30, nu:'sauce soja' },
              { em:'🌾', nom:'Sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' }
            ],
            steps:[
              { illu:'melanger', t:'Prépare la marinade', duree_min:5,
                detail:'Gochujang, miel, soja, ail et gingembre râpés, un peu d\'eau pour détendre.',
                qte:[{ nom:'Gochujang', qte:'3 c. à soupe' }, { nom:'Miel', qte:'2 c. à soupe' }],
                tip:'Le miel n\'est pas là que pour le sucre : c\'est lui qui caramélise et donne la laque brillante.' },
              { illu:'refrigerer', t:'Fais mariner le poulet', duree_min:20,
                detail:'Morceaux de hauts de cuisse enrobés, 20 min au frais.',
                qte:[{ nom:'Poulet', qte:'600 g' }],
                tip:'Des hauts de cuisse, pas des blancs : ils supportent le sucre de la marinade sans sécher.' },
              { illu:'saisir', t:'Saisis à feu moyen', duree_min:12,
                detail:'Poêle chaude, un peu d\'huile, le poulet peau vers le bas. 6 min, puis retourne.',
                qte:[{ nom:'Poulet', qte:'600 g' }],
                tip:'FEU MOYEN, PAS VIF : la marinade est sucrée, elle noircit avant que la viande soit cuite si le feu est trop fort.' },
              { illu:'mijoter', t:'Laque', duree_min:6,
                detail:'Verse le reste de marinade, couvre à moitié, laisse réduire jusqu\'à ce que ça nappe en tournant les morceaux.',
                tip:'La sauce doit devenir sirupeuse et coller au poulet. Encore liquide, deux minutes de plus à découvert.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Sésame et ciboule par-dessus, riz blanc.',
                qte:[{ nom:'Riz', qte:'200 g' }, { nom:'Sésame', qte:'1 c. à soupe' }],
                tip:'Un peu de kimchi à côté si tu en as : son acidité coupe le sucré de la laque.' }
            ]
          } },
        { cle:'cor-japchae', n:'Japchae',
          d:'Des vermicelles de patate douce sautés avec une poêlée de légumes croquants, sauce soja et huile de sésame.',
          i:'🍠 Vermicelles de patate douce|🥕 Carotte|🥬 Épinards|🍄 Champignons|🧅 Oignon|🥢 Sauce soja',
          t:['Végétarien'],
          nu:'Les vermicelles de patate douce se digèrent plus lentement que des nouilles de blé.',
          rec:{
            temps_min:40, portions:3,
            macros:{ p:8, g:58, l:11, kcal:356 },
            ingredients:[
              { em:'🍠', nom:'Vermicelles de patate douce', qte:'200 g secs (≈ 480 g cuits)', g:480, nu:'vermicelles' },
              { em:'🥕', nom:'Carotte', qte:'150 g', g:150, nu:'carotte' },
              { em:'🥬', nom:'Épinards', qte:'200 g', g:200, nu:'epinards' },
              { em:'🍄', nom:'Champignons', qte:'150 g', g:150, nu:'champignon' },
              { em:'🧅', nom:'Oignon', qte:'120 g', g:120, nu:'oignon' },
              { em:'🥢', nom:'Sauce soja', qte:'4 c. à soupe', g:60, nu:'sauce soja' },
              { em:'🌾', nom:'Sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' },
              { em:'🫒', nom:'Huile de sésame', qte:'2 c. à soupe', g:25, nu:'huile' },
              { em:'🍯', nom:'Sucre', qte:'1 c. à soupe', g:12, nu:'sucre' }
            ],
            steps:[
              { illu:'bouillir', t:'Cuis les vermicelles', duree_min:8,
                detail:'6 à 7 min dans l\'eau bouillante, puis rince à l\'eau froide et coupe-les grossièrement aux ciseaux.',
                qte:[{ nom:'Vermicelles', qte:'200 g' }],
                tip:'Les couper aux ciseaux n\'est pas de la coquetterie : non coupés, ils font un mètre de long et sont impossibles à manger.' },
              { illu:'saisir', t:'Fais sauter chaque légume à part', duree_min:14,
                detail:'Oignon, puis carotte, puis champignons, chacun 2 min à feu vif avec un peu d\'huile et une pincée de sel. Réserve séparément.',
                qte:[{ nom:'Carotte', qte:'150 g' }, { nom:'Champignons', qte:'150 g' }, { nom:'Oignon', qte:'120 g' }],
                tip:'Séparément, encore : c\'est la logique coréenne. Ensemble, l\'eau des champignons cuirait la carotte à la vapeur.' },
              { illu:'bouillir', t:'Blanchis les épinards', duree_min:4,
                detail:'30 secondes dans l\'eau bouillante, refroidis-les, presse-les à la main et assaisonne d\'un peu d\'huile de sésame.',
                qte:[{ nom:'Épinards', qte:'200 g' }],
                tip:'Presse VRAIMENT : un épinard blanchi retient trois fois son poids d\'eau, et cette eau finit dans le plat.' },
              { illu:'melanger', t:'Réunis tout', duree_min:6,
                detail:'Dans un grand saladier, les vermicelles, tous les légumes, le soja, le sucre et l\'huile de sésame. Mélange à la main.',
                tip:'À LA MAIN, tiède : c\'est le seul moyen de répartir la sauce sans casser les vermicelles.' },
              { illu:'dresser', t:'Sers tiède', duree_min:2,
                detail:'Sésame par-dessus. Le japchae se mange tiède ou à température ambiante.',
                qte:[{ nom:'Sésame', qte:'1 c. à soupe' }],
                tip:'C\'est un plat de fête qu\'on prépare à l\'avance : il est meilleur une heure après, quand les vermicelles ont bu la sauce.' }
            ]
          } },
        { cle:'cor-kimchi-jjigae', n:'Kimchi jjigae',
          d:'Le ragoût du quotidien en Corée : du kimchi bien fermenté mijoté avec du tofu, servi bouillonnant.',
          i:'🥬 Kimchi|🧊 Tofu|🧅 Oignon|🌶️ Gochujang|🧄 Ail|🍚 Riz',
          t:['Végétarien','Épicé','Réconfortant'],
          nu:'Le chou fermenté apporte des bactéries lactiques — un plat de tous les jours, pas un remède.',
          rec:{
            temps_min:40, portions:3,
            macros:{ p:34, g:63, l:15, kcal:526 },
            ingredients:[
              { em:'🥬', nom:'Kimchi', qte:'400 g bien mûr', g:400, nu:'kimchi' },
              { em:'🧊', nom:'Tofu', qte:'300 g', g:300, nu:'tofu' },
              { em:'🥩', nom:'Porc', qte:'200 g de poitrine', g:200, nu:'porc' },
              { em:'🧅', nom:'Oignon', qte:'120 g', g:120, nu:'oignon' },
              { em:'🌶️', nom:'Gochujang', qte:'1 c. à soupe', g:15, nu:'gochujang' },
              { em:'🧄', nom:'Ail', qte:'3 gousses', g:12, nu:'ail' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' }
            ],
            steps:[
              { illu:'saisir', t:'Fais rissoler le porc', duree_min:6,
                detail:'Poitrine en lanières, à sec dans la casserole, jusqu\'à ce que le gras rende et que la viande dore.',
                qte:[{ nom:'Porc', qte:'200 g' }],
                tip:'Le gras de porc rendu est la base du bouillon. C\'est pour ça qu\'on prend de la poitrine et pas du filet.' },
              { illu:'saisir', t:'Ajoute le kimchi', duree_min:7,
                detail:'Kimchi égoutté (garde son jus) et coupé, dans le gras, 5 min à feu moyen.',
                qte:[{ nom:'Kimchi', qte:'400 g' }],
                tip:'FAIRE REVENIR LE KIMCHI est ce qui distingue un vrai jjigae d\'une soupe au kimchi. La chaleur adoucit son acidité et concentre son goût.' },
              { illu:'mijoter', t:'Mouille et laisse bouillir', duree_min:15,
                detail:'Le jus du kimchi, 600 ml d\'eau, l\'oignon, l\'ail, le gochujang. 15 min à gros bouillons.',
                qte:[{ nom:'Gochujang', qte:'1 c. à soupe' }],
                tip:'Un jjigae bout franchement, contrairement à un bouillon clair : c\'est ce qui émulsionne le gras et rend le liquide trouble et savoureux.' },
              { illu:'melanger', t:'Ajoute le tofu', duree_min:6,
                detail:'En gros cubes, posés dessus, 5 min de plus sans remuer.',
                qte:[{ nom:'Tofu', qte:'300 g' }],
                tip:'Posé et pas mélangé : le tofu se réchauffe dans le bouillon sans se casser.' },
              { illu:'dresser', t:'Sers bouillant', duree_min:2,
                detail:'Directement dans la casserole, avec un bol de riz blanc par personne.',
                qte:[{ nom:'Riz', qte:'200 g' }],
                tip:'Un kimchi TROP VIEUX est exactement ce qu\'il faut ici : plus il est acide, meilleur est le jjigae.' }
            ]
          } },
        { cle:'cor-tteokbokki', n:'Tteokbokki',
          d:'Des gnocchis de riz coréens dans une sauce rouge sucrée-piquante, à manger brûlants.',
          i:'🍥 Gâteaux de riz|🌶️ Gochujang|🧅 Oignon|🥬 Chou|🍯 Sucre|🌾 Graines de sésame',
          t:['Végétarien','Épicé'],
          nu:'C\'est un plat de féculents : on l\'accompagne volontiers d\'un œuf ou de tofu pour tenir jusqu\'au soir.',
          rec:{
            temps_min:25, portions:2,
            macros:{ p:12, g:123, l:4, kcal:587 },
            ingredients:[
              { em:'🍥', nom:'Gâteaux de riz', qte:'400 g', g:400, nu:'gateaux de riz' },
              { em:'🌶️', nom:'Gochujang', qte:'3 c. à soupe', g:45, nu:'gochujang' },
              { em:'🧅', nom:'Oignon', qte:'120 g', g:120, nu:'oignon' },
              { em:'🥬', nom:'Chou', qte:'150 g', g:150, nu:'chou' },
              { em:'🍯', nom:'Sucre', qte:'1 c. à soupe', g:12, nu:'sucre' },
              { em:'🌾', nom:'Graines de sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' },
              { em:'🥢', nom:'Sauce soja', qte:'1 c. à soupe', g:15, nu:'sauce soja' }
            ],
            steps:[
              { illu:'attendre', t:'Fais tremper les tteok', duree_min:10,
                detail:'Dix minutes dans l\'eau tiède s\'ils sont durs ou sortis du réfrigérateur.',
                qte:[{ nom:'Gâteaux de riz', qte:'400 g' }],
                tip:'Des tteok secs restent durs au cœur même après quinze minutes de sauce. Le trempage les réhydrate avant.' },
              { illu:'bouillir', t:'Prépare la sauce', duree_min:4,
                detail:'400 ml d\'eau, gochujang, soja et sucre dans une poêle large, portés à ébullition.',
                qte:[{ nom:'Gochujang', qte:'3 c. à soupe' }],
                tip:'Une poêle LARGE : les tteok doivent être en une seule couche, sinon ceux du dessous collent au fond.' },
              { illu:'mijoter', t:'Cuis les tteok', duree_min:10,
                detail:'Tteok, oignon et chou dans la sauce, 8 à 10 min à feu moyen en remuant souvent.',
                qte:[{ nom:'Gâteaux de riz', qte:'400 g' }, { nom:'Chou', qte:'150 g' }],
                tip:'REMUE SOUVENT : l\'amidon des gâteaux de riz s\'attache très vite, et un fond brûlé se sent dans toute la poêle.' },
              { illu:'melanger', t:'Laisse épaissir', duree_min:4,
                detail:'La sauce doit napper les tteok et devenir brillante.',
                tip:'C\'est l\'amidon des tteok qui épaissit la sauce, pas de la fécule ajoutée. Si c\'est trop liquide, laisse réduire deux minutes de plus.' },
              { illu:'dresser', t:'Sers', duree_min:2,
                detail:'Sésame par-dessus, très chaud.',
                qte:[{ nom:'Graines de sésame', qte:'1 c. à soupe' }],
                tip:'Les tteok durcissent en refroidissant : c\'est un plat qui se mange tout de suite, jamais réchauffé.' }
            ]
          } }
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
          nu:'L\'oignon fondu tient lieu de liant : la sauce est épaisse sans crème ni farine.',
          rec:{
            temps_min:100, portions:4,
            macros:{ p:72, g:22, l:22, kcal:585 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'800 g de cuisses', g:800, nu:'poulet' },
              { em:'🧅', nom:'Oignons', qte:'600 g', g:600, nu:'oignon' },
              { em:'🌶️', nom:'Berbéré', qte:'3 c. à soupe', g:30, nu:'berbere' },
              { em:'🥚', nom:'Œufs', qte:'4 durs', g:220, nu:'oeuf' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' },
              { em:'🫚', nom:'Gingembre', qte:'25 g', g:25, nu:'gingembre' },
              { em:'🧈', nom:'Beurre', qte:'40 g', g:40, nu:'beurre' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' }
            ],
            steps:[
              { illu:'couper', t:'Émince les oignons', duree_min:10,
                detail:'600 g d\'oignons, hachés le plus finement possible. Oui, c\'est beaucoup.',
                qte:[{ nom:'Oignons', qte:'600 g' }],
                tip:'LA QUANTITÉ D\'OIGNONS N\'EST PAS UNE ERREUR : c\'est eux qui font la sauce. Il n\'y a ni tomate ni bouillon dans un doro wat.' },
              { illu:'saisir', t:'Fais-les fondre À SEC', duree_min:30,
                detail:'Casserole à fond épais, sans matière grasse, feu doux, 25 à 30 min en remuant. Ils doivent s\'effondrer et brunir.',
                qte:[{ nom:'Oignons', qte:'600 g' }],
                tip:'À SEC, c\'est la technique éthiopienne : sans gras, les oignons rendent leur eau puis caramélisent dans leur propre sucre. Le beurre viendra après.' },
              { illu:'assaisonner', t:'Ajoute le beurre et le berbéré', duree_min:6,
                detail:'Beurre, ail et gingembre râpés, puis le berbéré. Remue 5 min à feu doux.',
                qte:[{ nom:'Berbéré', qte:'3 c. à soupe' }, { nom:'Beurre', qte:'40 g' }],
                tip:'Le berbéré doit frire dans le gras pour s\'ouvrir. Ajouté à l\'eau, il reste poudreux et râpe la gorge.' },
              { illu:'mijoter', t:'Ajoute le poulet', duree_min:45,
                detail:'Les morceaux, un peu d\'eau chaude, couvre et laisse 45 min à feu très doux.',
                qte:[{ nom:'Poulet', qte:'800 g' }],
                tip:'Presque pas d\'eau : le poulet en rend beaucoup, et un doro wat doit rester une sauce épaisse, pas un bouillon.' },
              { illu:'melanger', t:'Ajoute les œufs durs', duree_min:8,
                detail:'Écalés, entaillés de quelques coups de couteau, glissés dans la sauce pour les 8 dernières minutes.',
                qte:[{ nom:'Œufs', qte:'4' }],
                tip:'Les entailles laissent la sauce entrer : sans elles, l\'œuf reste blanc et fade au milieu du plat.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Un trait de citron, avec de l\'injera ou du riz.',
                qte:[{ nom:'Citron', qte:'1' }],
                tip:'Le citron équilibre : le berbéré est puissant et le beurre est riche, il faut quelque chose d\'acide pour tenir jusqu\'au bout.' }
            ]
          } },
        { cle:'eth-injera', n:'Injera et ses ragoûts',
          d:'La grande galette de teff, spongieuse et légèrement acide, sur laquelle on dispose tous les plats à partager.',
          i:'🌾 Teff|💧 Eau|🫘 Lentilles|🥬 Chou|🥕 Carotte|🌶️ Berbéré',
          t:['Végétarien','Riche en fibres'],
          nu:'Le teff est une céréale complète : la galette apporte des fibres, ce qu\'un pain blanc ne fait pas.',
          rec:{
            temps_min:75, portions:4,
            macros:{ p:23, g:95, l:12, kcal:564 },
            ingredients:[
              { em:'🌾', nom:'Farine de teff', qte:'300 g', g:300, nu:'teff' },
              { em:'💧', nom:'Eau', qte:'500 ml' },
              { em:'🫘', nom:'Lentilles', qte:'200 g crues (≈ 480 g cuites)', g:480, nu:'lentilles' },
              { em:'🥬', nom:'Chou', qte:'300 g', g:300, nu:'chou' },
              { em:'🥕', nom:'Carottes', qte:'200 g', g:200, nu:'carotte' },
              { em:'🌶️', nom:'Berbéré', qte:'2 c. à soupe', g:20, nu:'berbere' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' }
            ],
            steps:[
              { illu:'melanger', t:'Prépare la pâte, la veille', duree_min:10,
                detail:'Farine de teff et eau, fouettées jusqu\'à obtenir une pâte lisse et fluide. Couvre d\'un linge.',
                qte:[{ nom:'Farine de teff', qte:'300 g' }, { nom:'Eau', qte:'500 ml' }],
                tip:'PLANIFIE À L\'AVANCE : l\'injera n\'est pas une crêpe, c\'est une pâte fermentée. Sans ces heures d\'attente, elle n\'a ni son acidité ni ses alvéoles.' },
              { illu:'reposer', t:'Laisse fermenter', duree_min:1440,
                detail:'24 à 48 heures à température ambiante. Des bulles se forment et l\'odeur devient acidulée.',
                tip:'Une odeur aigre et des bulles = c\'est prêt. Une odeur de moisi = recommence, la pâte a tourné.' },
              { illu:'mijoter', t:'Prépare le misir wat de lentilles', duree_min:30,
                detail:'Oignon fondu à l\'huile, berbéré une minute, lentilles, eau à hauteur, 25 min à feu doux.',
                qte:[{ nom:'Lentilles', qte:'200 g' }, { nom:'Berbéré', qte:'2 c. à soupe' }],
                tip:'Lentilles corail si tu veux qu\'elles se délitent, lentilles vertes si tu les veux entières. Les deux sont justes.' },
              { illu:'saisir', t:'Prépare le tikil gomen de chou', duree_min:20,
                detail:'Chou et carottes en lanières, sautés à l\'huile avec un peu de curcuma, puis à couvert 15 min.',
                qte:[{ nom:'Chou', qte:'300 g' }, { nom:'Carottes', qte:'200 g' }],
                tip:'Sans berbéré ici : sur une assiette éthiopienne, il faut un plat doux à côté des plats épicés.' },
              { illu:'saisir', t:'Cuis les injera', duree_min:15,
                detail:'Poêle antiadhésive chaude, à sec, une louche versée en spirale du bord vers le centre. Couvre, 2 min : la surface se couvre d\'yeux et sèche.',
                qte:[{ nom:'Farine de teff', qte:'300 g' }],
                tip:'ON NE LA RETOURNE JAMAIS. L\'injera cuit d\'un seul côté, à couvert : c\'est la vapeur qui cuit le dessus.' },
              { illu:'dresser', t:'Dresse', duree_min:5,
                detail:'Une injera à plat comme une nappe, les ragoûts posés dessus en tas, d\'autres injera roulées à côté.',
                tip:'L\'injera est à la fois l\'assiette et la fourchette : on déchire un morceau et on pince la nourriture avec.' }
            ]
          } },
        { cle:'eth-misir-wat', n:'Misir wat',
          d:'Des lentilles corail fondues dans l\'oignon et le berbéré, jusqu\'à devenir une purée profonde et rouge.',
          i:'🫘 Lentilles corail|🧅 Oignon|🌶️ Berbéré|🧄 Ail|🫚 Gingembre|🍅 Tomate',
          t:['Végétarien','Riche en fibres','Épicé'],
          nu:'Lentilles et galette de teff se complètent : ensemble, ils couvrent les acides aminés qui manquent à chacun.',
          rec:{
            temps_min:45, portions:4,
            macros:{ p:19, g:52, l:10, kcal:359 },
            ingredients:[
              { em:'🫘', nom:'Lentilles corail', qte:'300 g crues (≈ 720 g cuites)', g:720, nu:'lentilles' },
              { em:'🧅', nom:'Oignons', qte:'400 g', g:400, nu:'oignon' },
              { em:'🌶️', nom:'Berbéré', qte:'2 c. à soupe', g:20, nu:'berbere' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🫚', nom:'Gingembre', qte:'20 g', g:20, nu:'gingembre' },
              { em:'🍅', nom:'Tomate', qte:'200 g', g:200, nu:'tomate' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' }
            ],
            steps:[
              { illu:'saisir', t:'Fais fondre les oignons', duree_min:20,
                detail:'Hachés fin, à sec puis avec l\'huile, feu doux, 20 min jusqu\'à ce qu\'ils s\'effondrent et brunissent.',
                qte:[{ nom:'Oignons', qte:'400 g' }],
                tip:'Encore une fois : c\'est le temps passé sur les oignons qui fait la profondeur du plat. Vingt minutes n\'est pas négociable.' },
              { illu:'assaisonner', t:'Ajoute berbéré, ail et gingembre', duree_min:4,
                detail:'Dans l\'huile chaude, remue 2 min jusqu\'à ce que le mélange embaume et fonce.',
                qte:[{ nom:'Berbéré', qte:'2 c. à soupe' }, { nom:'Ail', qte:'4 gousses' }],
                tip:'Si ça accroche, une cuillère d\'eau : il ne faut surtout pas que le berbéré brûle.' },
              { illu:'mijoter', t:'Ajoute lentilles et tomate', duree_min:22,
                detail:'Lentilles rincées, tomate concassée, 700 ml d\'eau. 20 min à feu doux, en remuant de temps en temps.',
                qte:[{ nom:'Lentilles corail', qte:'300 g' }, { nom:'Tomate', qte:'200 g' }],
                tip:'Les lentilles corail doivent se défaire : le misir wat est une purée épaisse, pas une soupe de lentilles.' },
              { illu:'assaisonner', t:'Sale et ajuste', duree_min:3,
                detail:'Sale seulement maintenant, et allonge à l\'eau chaude si c\'est trop épais.',
                tip:'Le sel en fin de cuisson pour les légumineuses : salées trop tôt, elles restent fermes.' },
              { illu:'dresser', t:'Sers', duree_min:2,
                detail:'Avec de l\'injera, du riz ou du pain plat.',
                tip:'Il est meilleur le lendemain, comme tous les wat : les épices continuent de se diffuser à froid.' }
            ]
          } },
        { cle:'eth-tibs-boeuf', n:'Tibs de bœuf',
          d:'Des dés de bœuf sautés vif avec oignon, piment et beurre épicé — le plat qu\'on commande quand on a faim.',
          i:'🥩 Bœuf|🧅 Oignon|🌶️ Piment|🧄 Ail|🍅 Tomate|🌿 Romarin',
          t:['Protéiné','Épicé'],
          nu:'Cuisson courte à feu vif : la viande reste tendre sans qu\'on ait besoin d\'ajouter de la sauce.',
          rec:{
            temps_min:30, portions:3,
            macros:{ p:54, g:10, l:38, kcal:618 },
            ingredients:[
              { em:'🥩', nom:'Bœuf', qte:'600 g de rumsteck', g:600, nu:'boeuf' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🌶️', nom:'Piment vert', qte:'2' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🍅', nom:'Tomate', qte:'200 g', g:200, nu:'tomate' },
              { em:'🌿', nom:'Romarin', qte:'2 branches' },
              { em:'🧈', nom:'Beurre', qte:'30 g', g:30, nu:'beurre' }
            ],
            steps:[
              { illu:'couper', t:'Coupe le bœuf en cubes', duree_min:6,
                detail:'Des cubes de 2,5 cm, dans une pièce tendre.',
                qte:[{ nom:'Bœuf', qte:'600 g' }],
                tip:'Les tibs se cuisent vite et fort : il faut un morceau qui n\'a pas besoin de mijoter, sinon il sera dur.' },
              { illu:'saisir', t:'Saisis-le à feu très vif', duree_min:8,
                detail:'Poêle en fonte brûlante, le beurre, la viande en une couche, sans remuer 2 min, puis saute jusqu\'à coloration.',
                qte:[{ nom:'Bœuf', qte:'600 g' }, { nom:'Beurre', qte:'30 g' }],
                tip:'C\'est un plat de POÊLE BRÛLANTE. En Éthiopie il arrive encore grésillant sur son réchaud — c\'est dire le niveau de chaleur.' },
              { illu:'saisir', t:'Ajoute oignon, ail et romarin', duree_min:6,
                detail:'Oignon en quartiers, ail écrasé, romarin entier. Trois minutes à feu vif.',
                qte:[{ nom:'Oignon', qte:'200 g' }, { nom:'Ail', qte:'4 gousses' }],
                tip:'Le romarin en branche entière, retirée à la fin : haché, il domine tout et pique la langue.' },
              { illu:'saisir', t:'Tomate et piment', duree_min:5,
                detail:'Tomate en quartiers et piments fendus, deux minutes de plus. Sale.',
                qte:[{ nom:'Tomate', qte:'200 g' }],
                tip:'La tomate en quartiers doit rester en morceaux : ce n\'est pas une sauce, c\'est un sauté.' },
              { illu:'dresser', t:'Sers immédiatement', duree_min:2,
                detail:'Directement dans la poêle, avec de l\'injera.',
                tip:'Les tibs n\'attendent pas : dix minutes de repos et la viande continue de cuire dans la fonte chaude.' }
            ]
          } }
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
          nu:'La tomate rend assez de jus pour la cuisson entière : le plat se fait sans bouillon ni matière grasse.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:73, g:17, l:9, kcal:450 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'900 g de cuisses', g:900, nu:'poulet' },
              { em:'🍅', nom:'Tomates', qte:'700 g', g:700, nu:'tomate' },
              { em:'🧅', nom:'Oignons', qte:'400 g', g:400, nu:'oignon' },
              { em:'🌿', nom:'Coriandre', qte:'30 g' },
              { em:'🌿', nom:'Persil', qte:'20 g' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' }
            ],
            steps:[
              { illu:'saisir', t:'Fais colorer le poulet À SEC', duree_min:10,
                detail:'Cocotte à fond épais, très chaude, les morceaux sans matière grasse, jusqu\'à ce que la peau soit dorée.',
                qte:[{ nom:'Poulet', qte:'900 g' }],
                tip:'SANS HUILE : la peau du poulet rend assez de gras pour tout le plat. C\'est ce qui rend le chakhokhbili moins lourd qu\'il n\'en a l\'air.' },
              { illu:'saisir', t:'Ajoute les oignons', duree_min:12,
                detail:'En demi-lunes, dans le gras rendu, 10 min jusqu\'à ce qu\'ils soient tendres et dorés.',
                qte:[{ nom:'Oignons', qte:'400 g' }],
                tip:'Beaucoup d\'oignons encore : avec la tomate, ce sont les deux seuls légumes du plat.' },
              { illu:'mijoter', t:'Ajoute les tomates', duree_min:30,
                detail:'Pelées et concassées, sans une goutte d\'eau. Couvre et laisse 30 min à feu doux.',
                qte:[{ nom:'Tomates', qte:'700 g' }],
                tip:'AUCUN LIQUIDE AJOUTÉ. Tomates et poulet rendent tout ce qu\'il faut — de l\'eau en plus donnerait une sauce délavée.' },
              { illu:'assaisonner', t:'Ail et herbes en fin de cuisson', duree_min:5,
                detail:'Ail écrasé, coriandre et persil hachés très grossièrement, dans les 3 dernières minutes.',
                qte:[{ nom:'Coriandre', qte:'30 g' }, { nom:'Ail', qte:'5 gousses' }],
                tip:'LES HERBES À LA TOUTE FIN, et en quantité. En Géorgie, elles se comptent en poignées : c\'est ce qui donne au plat son parfum vert.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Dans un plat creux, avec du pain pour saucer.',
                tip:'Pas de riz ni de pommes de terre : en Géorgie, c\'est le pain qui accompagne, et il n\'y a rien d\'autre à côté.' }
            ]
          } },
        { cle:'geo-mtsvadi', n:'Mtsvadi',
          d:'Des morceaux d\'agneau marinés puis grillés à la braise, servis avec des légumes crus et du pain.',
          i:'🍖 Agneau|🧅 Oignon rouge|🍅 Tomate|🥒 Concombre|🌿 Coriandre|🍋 Citron',
          t:['Protéiné'],
          nu:'Grillé à la braise, le gras de l\'agneau s\'écoule : c\'est la cuisson qui allège le morceau.',
          rec:{
            temps_min:50, portions:4,
            macros:{ p:52, g:13, l:40, kcal:619 },
            ingredients:[
              { em:'🍖', nom:'Agneau', qte:'800 g d\'épaule', g:800, nu:'agneau' },
              { em:'🧅', nom:'Oignon rouge', qte:'300 g', g:300, nu:'oignon' },
              { em:'🍅', nom:'Tomates', qte:'300 g', g:300, nu:'tomate' },
              { em:'🥒', nom:'Concombre', qte:'200 g', g:200, nu:'concombre' },
              { em:'🌿', nom:'Coriandre', qte:'20 g' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' }
            ],
            steps:[
              { illu:'couper', t:'Coupe la viande en gros cubes', duree_min:8,
                detail:'Des cubes de 4 cm, avec un peu de gras conservé.',
                qte:[{ nom:'Agneau', qte:'800 g' }],
                tip:'GROS, c\'est la règle du mtsvadi : de petits cubes sèchent avant d\'avoir pris la fumée. Et le gras fond et arrose la viande en cuisant.' },
              { illu:'melanger', t:'Fais mariner à l\'oignon', duree_min:30,
                detail:'Moitié des oignons en lamelles, malaxés à la main avec la viande, du sel et du poivre. Trente minutes.',
                qte:[{ nom:'Oignon rouge', qte:'150 g' }, { nom:'Agneau', qte:'800 g' }],
                tip:'PAS DE VINAIGRE NI DE CITRON DANS LA MARINADE. L\'oignon suffit : son jus attendrit sans dénaturer le goût de l\'agneau, et c\'est la tradition.' },
              { illu:'saisir', t:'Grille les brochettes', duree_min:15,
                detail:'Sur des braises ou une poêle-gril très chaude, 12 à 15 min en tournant régulièrement.',
                tip:'Sur braises, jamais sur flamme : la flamme noircit l\'extérieur et laisse le centre cru.' },
              { illu:'couper', t:'Prépare la salade', duree_min:8,
                detail:'Tomates, concombre et le reste d\'oignon en gros morceaux, coriandre, jus de citron, sel.',
                qte:[{ nom:'Tomates', qte:'300 g' }, { nom:'Concombre', qte:'200 g' }, { nom:'Citron', qte:'1' }],
                tip:'Des gros morceaux, pas une brunoise : cette salade est là pour rafraîchir entre deux bouchées de viande.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Brochettes sur un lit d\'oignon cru, salade à côté, du pain.',
                tip:'L\'oignon cru sous la viande chaude s\'attendrit à peine et boit le jus : c\'est la meilleure partie de l\'assiette.' }
            ]
          } }
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
          nu:'Un poisson blanc : beaucoup de protéines, peu de lipides, et l\'huile d\'olive s\'ajoute après cuisson.',
          rec:{
            temps_min:45, portions:2,
            macros:{ p:66, g:45, l:30, kcal:709 },
            ingredients:[
              { em:'🐟', nom:'Daurade', qte:'1 entière (600 g)', g:600, nu:'daurade' },
              { em:'🫒', nom:'Huile d\'olive', qte:'4 c. à soupe', g:50, nu:'huile olive' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🌿', nom:'Origan', qte:'1 c. à soupe', g:5, nu:'origan' },
              { em:'🥔', nom:'Pommes de terre', qte:'400 g', g:400, nu:'pomme de terre' },
              { em:'🥒', nom:'Courgette', qte:'250 g', g:250, nu:'courgette' },
              { em:'🧂', nom:'Sel et poivre', qte:'' }
            ],
            steps:[
              { illu:'rincer', t:'Prépare le poisson', duree_min:6,
                detail:'Vidé et écaillé, rincé, séché. Trois entailles en biais de chaque côté, jusqu\'à l\'arête.',
                qte:[{ nom:'Daurade', qte:'600 g' }],
                tip:'LES ENTAILLES SONT INDISPENSABLES : sans elles, la peau se rétracte, le poisson se tord et l\'épaisseur ne cuit pas.' },
              { illu:'assaisonner', t:'Fais la ladolémono', duree_min:4,
                detail:'Bats l\'huile d\'olive avec le jus d\'un citron, l\'origan, du sel et du poivre.',
                qte:[{ nom:'Huile d\'olive', qte:'4 c. à soupe' }, { nom:'Citron', qte:'1' }],
                tip:'Deux tiers d\'huile, un tiers de citron : c\'est LA sauce grecque, elle sert de marinade et de sauce finale.' },
              { illu:'couper', t:'Coupe les légumes', duree_min:8,
                detail:'Pommes de terre en quartiers, courgette en gros tronçons.',
                qte:[{ nom:'Pommes de terre', qte:'400 g' }, { nom:'Courgette', qte:'250 g' }],
                tip:'Des morceaux qui tiennent 30 minutes de four : coupés fin, ils seraient noirs avant que le poisson soit cuit.' },
              { illu:'enfourner', t:'Enfourne les légumes en avance', duree_min:15,
                detail:'Légumes huilés et salés, 15 min à 200 °C, seuls.',
                tip:'Ils partent avec un quart d\'heure d\'avance : le poisson cuit deux fois plus vite qu\'eux.' },
              { illu:'enfourner', t:'Ajoute le poisson', duree_min:22,
                detail:'Pose la daurade sur les légumes, arrose de la moitié de la ladolémono, glisse des rondelles de citron dans le ventre. 20 min à 200 °C.',
                qte:[{ nom:'Daurade', qte:'600 g' }],
                tip:'L\'œil devient blanc et opaque quand c\'est cuit, et la chair se détache de l\'arête centrale sans résister.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Arrose du reste de sauce hors du four, avec le second citron en quartiers.',
                qte:[{ nom:'Citron', qte:'1' }],
                tip:'La sauce à froid sur le poisson chaud : c\'est là que l\'origan et le citron se sentent vraiment.' }
            ]
          } },
        { cle:'gre-fasolada', n:'Fasolada',
          d:'La soupe de haricots blancs que les Grecs appellent leur plat national : carotte, céleri, tomate, et rien de plus.',
          i:'🫘 Haricots blancs|🥕 Carotte|🍅 Tomate|🧅 Oignon|🫒 Huile d\'olive|🌿 Persil',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Les haricots blancs apportent protéines et fibres dans la même cuillère — rare pour une soupe.',
          rec:{
            temps_min:90, portions:4,
            macros:{ p:18, g:57, l:20, kcal:462 },
            ingredients:[
              { em:'🫘', nom:'Haricots blancs', qte:'300 g secs (≈ 720 g cuits)', g:720, nu:'haricots blancs' },
              { em:'🥕', nom:'Carottes', qte:'250 g', g:250, nu:'carotte' },
              { em:'🍅', nom:'Tomates concassées', qte:'400 g', g:400, nu:'tomate' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🫒', nom:'Huile d\'olive', qte:'6 c. à soupe', g:75, nu:'huile olive' },
              { em:'🌿', nom:'Persil', qte:'20 g' },
              { em:'🥬', nom:'Céleri', qte:'100 g', g:100, nu:'celeri' }
            ],
            steps:[
              { illu:'attendre', t:'Fais tremper les haricots', duree_min:720,
                detail:'La veille, dans trois fois leur volume d\'eau froide.',
                qte:[{ nom:'Haricots blancs', qte:'300 g' }],
                tip:'Sans trempage, compte le double de cuisson et des peaux qui se détachent. Le trempage n\'est pas facultatif pour des haricots secs.' },
              { illu:'bouillir', t:'Première cuisson à l\'eau', duree_min:45,
                detail:'Égouttés, couverts d\'eau froide, portés à ébullition puis 40 min à petits bouillons. Sans sel.',
                qte:[{ nom:'Haricots blancs', qte:'720 g' }],
                tip:'SANS SEL, encore : il durcit la peau des légumineuses et rallonge la cuisson d\'une demi-heure.' },
              { illu:'couper', t:'Prépare les légumes', duree_min:8,
                detail:'Oignon, carottes et céleri en dés d\'un centimètre.',
                qte:[{ nom:'Carottes', qte:'250 g' }, { nom:'Oignon', qte:'200 g' }, { nom:'Céleri', qte:'100 g' }],
                tip:'Ce trio — oignon, carotte, céleri — est la base de la fasolada. Le céleri branche n\'est pas décoratif, il porte le goût.' },
              { illu:'mijoter', t:'Ajoute légumes, tomates et huile', duree_min:30,
                detail:'Tout dans la casserole avec l\'eau de cuisson, l\'huile d\'olive en entier, 30 min à feu doux. Sale à la fin.',
                qte:[{ nom:'Huile d\'olive', qte:'6 c. à soupe' }, { nom:'Tomates', qte:'400 g' }],
                tip:'SIX CUILLÈRES D\'HUILE, et c\'est normal : la fasolada est un plat « ladera », cuit à l\'huile. C\'est elle qui lie le bouillon.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Persil frais, un filet d\'huile crue, du pain et des olives.',
                qte:[{ nom:'Persil', qte:'20 g' }],
                tip:'Elle épaissit en refroidissant et se mange volontiers tiède : c\'est le plat national grec de l\'hiver.' }
            ]
          } },
        { cle:'gre-gemista', n:'Gemista',
          d:'Des tomates et des poivrons vidés puis farcis de riz aux herbes, rôtis lentement jusqu\'à ce qu\'ils s\'affaissent.',
          i:'🍅 Tomate|🫑 Poivron|🍚 Riz|🧅 Oignon|🌿 Menthe|🫒 Huile d\'olive',
          t:['Végétarien'],
          nu:'Le légume sert de contenant : on mange une portion entière de tomate sans y penser.',
          rec:{
            temps_min:100, portions:4,
            macros:{ p:11, g:90, l:20, kcal:585 },
            ingredients:[
              { em:'🍅', nom:'Tomates', qte:'8 grosses (1,2 kg)', g:1200, nu:'tomate' },
              { em:'🫑', nom:'Poivrons', qte:'4 (600 g)', g:600, nu:'poivron' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🧅', nom:'Oignons', qte:'300 g', g:300, nu:'oignon' },
              { em:'🌿', nom:'Menthe', qte:'15 g' },
              { em:'🌿', nom:'Persil', qte:'20 g' },
              { em:'🫒', nom:'Huile d\'olive', qte:'6 c. à soupe', g:75, nu:'huile olive' },
              { em:'🥔', nom:'Pommes de terre', qte:'400 g', g:400, nu:'pomme de terre' }
            ],
            steps:[
              { illu:'couper', t:'Évide les légumes', duree_min:15,
                detail:'Chapeau des tomates coupé et gardé, chair récupérée à la cuillère et mise de côté. Poivrons épépinés.',
                qte:[{ nom:'Tomates', qte:'1,2 kg' }, { nom:'Poivrons', qte:'600 g' }],
                tip:'GARDE LA CHAIR DES TOMATES : elle sera mixée et servira de liquide de cuisson au riz. Rien ne se jette.' },
              { illu:'saisir', t:'Fais la farce', duree_min:12,
                detail:'Oignons fondus à l\'huile, la chair de tomate mixée, le riz CRU, les herbes, sel et poivre. Cinq minutes à feu moyen.',
                qte:[{ nom:'Riz', qte:'250 g' }, { nom:'Oignons', qte:'300 g' }, { nom:'Menthe', qte:'15 g' }],
                tip:'LE RIZ RESTE CRU : il finira de cuire au four en buvant le jus des tomates. Précuit, il serait en bouillie.' },
              { illu:'melanger', t:'Garnis', duree_min:10,
                detail:'Remplis les légumes AUX DEUX TIERS, remets les chapeaux.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'Aux deux tiers seulement : le riz double de volume, et un légume trop rempli éclate au four.' },
              { illu:'enfourner', t:'Enfourne avec les pommes de terre', duree_min:60,
                detail:'Pommes de terre en quartiers autour, huile d\'olive sur tout, un verre d\'eau au fond. 1 h à 180 °C, couvert d\'alu les 40 premières minutes.',
                qte:[{ nom:'Pommes de terre', qte:'400 g' }],
                tip:'Les pommes de terre autour ne sont pas un accompagnement : elles boivent le jus qui déborde et sont la meilleure part du plat.' },
              { illu:'reposer', t:'Laisse tiédir', duree_min:15,
                detail:'Au moins un quart d\'heure, idéalement plus.',
                tip:'La gemista se mange TIÈDE ou froide, jamais brûlante. C\'est un plat d\'été, et le riz a besoin de se poser.' }
            ]
          } },
        { cle:'gre-souvlaki-poulet', n:'Souvláki de poulet',
          d:'Des brochettes marinées à l\'origan et au citron, servies avec du tzatzíki et une pointe de citron.',
          i:'🍗 Poulet|🍋 Citron|🌿 Origan|🥒 Concombre|🥛 Yaourt|🧄 Ail',
          t:['Protéiné','Léger'],
          nu:'Le tzatzíki remplace une sauce grasse par du yaourt : même onctuosité, protéines en plus.',
          rec:{
            temps_min:45, portions:3,
            macros:{ p:66, g:13, l:27, kcal:561 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'600 g de hauts de cuisse', g:600, nu:'poulet' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🌿', nom:'Origan', qte:'1 c. à soupe', g:5, nu:'origan' },
              { em:'🥒', nom:'Concombre', qte:'200 g', g:200, nu:'concombre' },
              { em:'🥛', nom:'Yaourt grec', qte:'250 g', g:250, nu:'yaourt grec' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🫒', nom:'Huile d\'olive', qte:'4 c. à soupe', g:50, nu:'huile olive' }
            ],
            steps:[
              { illu:'melanger', t:'Fais la marinade', duree_min:5,
                detail:'Jus d\'un citron, deux cuillères d\'huile, origan, deux gousses d\'ail écrasées, sel, poivre.',
                qte:[{ nom:'Citron', qte:'1' }, { nom:'Origan', qte:'1 c. à soupe' }],
                tip:'Citron et origan, rien de plus. Un souvláki n\'a pas besoin de vingt épices — c\'est un plat de trois ingrédients.' },
              { illu:'refrigerer', t:'Fais mariner le poulet', duree_min:30,
                detail:'Cubes de 3 cm, enrobés, 30 min au frais minimum.',
                qte:[{ nom:'Poulet', qte:'600 g' }],
                tip:'Des hauts de cuisse, jamais des blancs : sur le gril, le blanc sèche en deux minutes.' },
              { illu:'melanger', t:'Prépare le tzatziki', duree_min:10,
                detail:'Concombre râpé, SALÉ et pressé, mélangé au yaourt avec l\'ail restant, un filet d\'huile et un peu de citron.',
                qte:[{ nom:'Concombre', qte:'200 g' }, { nom:'Yaourt grec', qte:'250 g' }],
                tip:'PRESSE LE CONCOMBRE, vraiment. Il rend un demi-verre d\'eau : sans ça, le tzatziki est liquide au bout de dix minutes.' },
              { illu:'saisir', t:'Grille les brochettes', duree_min:12,
                detail:'Sur une poêle-gril brûlante ou au barbecue, 10 à 12 min en tournant, jusqu\'à ce que les arêtes soient noircies.',
                qte:[{ nom:'Poulet', qte:'600 g' }],
                tip:'Les points noirs sont recherchés : c\'est là qu\'est le goût du grillé. Une brochette uniformément dorée est sous-cuite en surface.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Avec du pain pita chaud, le tzatziki, des quartiers de citron.',
                qte:[{ nom:'Citron', qte:'1' }],
                tip:'Un dernier trait de citron sur la viande chaude, à la sortie du gril : c\'est la signature.' }
            ]
          } },
        { cle:'gre-mezze-dolma', n:'Mezzé et dolmas',
          d:'Feuilles de vigne farcies au riz, houmous, purée de pois chiches et pain plat, à picorer à plusieurs.',
          i:'🍇 Feuilles de vigne|🍚 Riz|🫘 Pois chiches|🍋 Citron|🫒 Huile d\'olive|🥖 Pain pita',
          t:['Végétarien','Riche en fibres'],
          nu:'Manger à plusieurs petites bouchées ralentit le repas — et la satiété a le temps d\'arriver.',
          rec:{
            temps_min:80, portions:4,
            macros:{ p:18, g:96, l:24, kcal:660 },
            ingredients:[
              { em:'🍇', nom:'Feuilles de vigne', qte:'40 (250 g en saumure)', g:250, nu:'feuilles de vigne' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🫘', nom:'Pois chiches', qte:'250 g', g:250, nu:'pois chiches' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🫒', nom:'Huile d\'olive', qte:'6 c. à soupe', g:75, nu:'huile olive' },
              { em:'🥖', nom:'Pain pita', qte:'2', g:160, nu:'pain pita' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🌿', nom:'Aneth', qte:'20 g', g:20, nu:'aneth' }
            ],
            steps:[
              { illu:'rincer', t:'Rince les feuilles de vigne', duree_min:6,
                detail:'À l\'eau froide, plusieurs fois, puis égoutte-les à plat.',
                qte:[{ nom:'Feuilles de vigne', qte:'250 g' }],
                tip:'En saumure, elles sont très salées : mal rincées, tout le plat est immangeable. Goûte-en une pour vérifier.' },
              { illu:'saisir', t:'Prépare la farce', duree_min:12,
                detail:'Oignon fondu à l\'huile, riz cru, aneth, jus d\'un citron, sel, poivre. Cinq minutes à feu doux.',
                qte:[{ nom:'Riz', qte:'250 g' }, { nom:'Oignon', qte:'200 g' }, { nom:'Aneth', qte:'20 g' }],
                tip:'Riz cru là aussi : il gonflera dans les feuilles en buvant le bouillon.' },
              { illu:'melanger', t:'Roule les dolmas', duree_min:25,
                detail:'Une cuillère à café au bas de la feuille nervures vers le haut, replie les côtés, roule serré mais pas trop.',
                qte:[{ nom:'Feuilles de vigne', qte:'40' }],
                tip:'SERRÉ MAIS PAS TROP : le riz double de volume. Trop serré, le dolma éclate ; trop lâche, il se défait.' },
              { illu:'mijoter', t:'Cuis-les à l\'étouffée', duree_min:45,
                detail:'Serrés en couches dans une casserole, une assiette posée dessus, eau à hauteur avec le reste d\'huile et de citron. 40 min à feu très doux.',
                qte:[{ nom:'Huile d\'olive', qte:'4 c. à soupe' }, { nom:'Citron', qte:'1' }],
                tip:'L\'ASSIETTE PAR-DESSUS est le truc : elle les empêche de flotter et de se dérouler pendant la cuisson.' },
              { illu:'dresser', t:'Compose le mezzé', duree_min:8,
                detail:'Dolmas tièdes, pois chiches assaisonnés d\'huile et de citron, pita chaud.',
                qte:[{ nom:'Pois chiches', qte:'250 g' }, { nom:'Pain pita', qte:'2' }],
                tip:'Les dolmas sont meilleurs le lendemain, sortis une heure avant : c\'est un plat qu\'on prépare la veille.' }
            ]
          } }
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
          nu:'La marinade au yaourt attendrit la viande : pas besoin d\'ajouter de matière grasse à la cuisson.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:54, g:13, l:43, kcal:649 },
            ingredients:[
              { em:'🍖', nom:'Agneau', qte:'800 g d\'épaule', g:800, nu:'agneau' },
              { em:'🥛', nom:'Yaourt', qte:'300 g', g:300, nu:'yaourt' },
              { em:'🌶️', nom:'Paprika', qte:'2 c. à soupe', g:15, nu:'paprika' },
              { em:'🧄', nom:'Ail', qte:'6 gousses', g:24, nu:'ail' },
              { em:'🫚', nom:'Gingembre', qte:'30 g', g:30, nu:'gingembre' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🌶️', nom:'Garam masala', qte:'1 c. à soupe', g:8, nu:'epices' }
            ],
            steps:[
              { illu:'couper', t:'Prépare la viande', duree_min:8,
                detail:'Cubes de 4 cm, dégraissés grossièrement, entaillés au couteau.',
                qte:[{ nom:'Agneau', qte:'800 g' }],
                tip:'Les entailles laissent la marinade entrer : sans elles, elle ne pénètre que d\'un millimètre et le cœur reste nature.' },
              { illu:'melanger', t:'Première marinade au citron', duree_min:15,
                detail:'Jus des citrons, sel, paprika, frottés sur la viande. Quinze minutes.',
                qte:[{ nom:'Citron', qte:'2' }, { nom:'Paprika', qte:'2 c. à soupe' }],
                tip:'DEUX MARINADES, c\'est la méthode tandoori. L\'acide ouvre la chair d\'abord, le yaourt agit ensuite en profondeur.' },
              { illu:'melanger', t:'Seconde marinade au yaourt', duree_min:5,
                detail:'Yaourt, ail et gingembre en pâte, garam masala. Enrobe et couvre.',
                qte:[{ nom:'Yaourt', qte:'300 g' }, { nom:'Gingembre', qte:'30 g' }],
                tip:'Du yaourt ÉGOUTTÉ si possible : trop liquide, il coule au fond du plat au lieu de rester collé à la viande.' },
              { illu:'refrigerer', t:'Laisse mariner', duree_min:240,
                detail:'Quatre heures au réfrigérateur, une nuit c\'est mieux.',
                tip:'C\'est le seul temps long de la recette, et il n\'y a pas de raccourci : les enzymes du yaourt travaillent lentement.' },
              { illu:'enfourner', t:'Cuis à très forte chaleur', duree_min:25,
                detail:'Sur une grille au-dessus d\'une plaque, 240 °C, 20 à 25 min, en retournant à mi-cuisson.',
                qte:[{ nom:'Agneau', qte:'800 g' }],
                tip:'SUR UNE GRILLE, pas dans un plat : la chaleur doit circuler dessous, sinon la viande baigne et bout.' },
              { illu:'reposer', t:'Laisse reposer', duree_min:8,
                detail:'Huit minutes sous une feuille d\'aluminium avant de servir.',
                tip:'L\'agneau a besoin de repos plus que le poulet : ses fibres sont plus serrées et retiennent moins bien le jus.' }
            ]
          } },
        { cle:'ind-chana-masala', n:'Chana masala',
          d:'Des pois chiches mijotés dans une sauce tomate au cumin et à la coriandre, relevée juste avant de servir.',
          i:'🫘 Pois chiches|🍅 Tomate|🧅 Oignon|🫚 Gingembre|🌿 Coriandre|🌶️ Épices',
          t:['Végétarien','Riche en fibres'],
          nu:'Une assiette de pois chiches, c\'est autant de fibres qu\'une grosse portion de légumes verts.',
          rec:{
            temps_min:45, portions:4,
            macros:{ p:14, g:49, l:13, kcal:353 },
            ingredients:[
              { em:'🫘', nom:'Pois chiches', qte:'500 g cuits', g:500, nu:'pois chiches' },
              { em:'🍅', nom:'Tomates', qte:'400 g', g:400, nu:'tomate' },
              { em:'🧅', nom:'Oignons', qte:'300 g', g:300, nu:'oignon' },
              { em:'🫚', nom:'Gingembre', qte:'25 g', g:25, nu:'gingembre' },
              { em:'🌿', nom:'Coriandre', qte:'25 g' },
              { em:'🌶️', nom:'Épices', qte:'2 c. à soupe (cumin, coriandre, curcuma, garam masala)', g:15, nu:'epices' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' }
            ],
            steps:[
              { illu:'saisir', t:'Fais dorer les oignons', duree_min:15,
                detail:'Hachés fin, à l\'huile, feu moyen, 15 min jusqu\'à ce qu\'ils soient bruns et fondus.',
                qte:[{ nom:'Oignons', qte:'300 g' }],
                tip:'BRUNS, pas blonds. C\'est la couleur des oignons qui donne sa couleur au curry — un chana masala pâle vient d\'oignons pas assez cuits.' },
              { illu:'assaisonner', t:'Fais griller les épices', duree_min:3,
                detail:'Ail et gingembre en pâte 1 min, puis les épices moulues 30 s dans l\'huile.',
                qte:[{ nom:'Épices', qte:'2 c. à soupe' }, { nom:'Gingembre', qte:'25 g' }],
                tip:'Trente secondes, montre en main : au-delà, le curcuma devient amer et on ne peut plus le rattraper.' },
              { illu:'mijoter', t:'Fais le masala de tomate', duree_min:12,
                detail:'Tomates concassées, sel, feu moyen, jusqu\'à ce que l\'huile se sépare et remonte sur les bords.',
                qte:[{ nom:'Tomates', qte:'400 g' }],
                tip:'L\'HUILE QUI REMONTE est LE signal : elle dit que la tomate a perdu son eau et que la base est prête. Avant ça, ne va pas plus loin.' },
              { illu:'mijoter', t:'Ajoute les pois chiches', duree_min:15,
                detail:'Avec 200 ml d\'eau, écrase-en une louche à la cuillère, laisse mijoter 15 min.',
                qte:[{ nom:'Pois chiches', qte:'500 g' }],
                tip:'Écraser une partie des pois chiches épaissit la sauce sans farine : c\'est le geste qui lie le plat.' },
              { illu:'dresser', t:'Finis à la coriandre', duree_min:3,
                detail:'Beaucoup de coriandre hachée hors du feu, et un trait de citron.',
                qte:[{ nom:'Coriandre', qte:'25 g' }],
                tip:'Le chana masala est meilleur le lendemain : les épices ont besoin d\'une nuit pour se fondre.' }
            ]
          } },
        { cle:'ind-dal', n:'Dal de lentilles corail',
          d:'Des lentilles corail cuites jusqu\'à se défaire, finies par un « tarka » : des épices grillées versées dessus.',
          i:'🫘 Lentilles corail|🧅 Oignon|🍅 Tomate|🌶️ Cumin|🫚 Gingembre|🌿 Coriandre',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Les lentilles corail cuisent en 15 minutes : le plat de légumineuses le plus rapide qui existe.',
          rec:{
            temps_min:40, portions:4,
            macros:{ p:18, g:46, l:9, kcal:323 },
            ingredients:[
              { em:'🫘', nom:'Lentilles corail', qte:'300 g crues (≈ 720 g cuites)', g:720, nu:'lentilles' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🍅', nom:'Tomates', qte:'300 g', g:300, nu:'tomate' },
              { em:'🌶️', nom:'Cumin', qte:'1 c. à soupe', g:8, nu:'cumin' },
              { em:'🫚', nom:'Gingembre', qte:'20 g', g:20, nu:'gingembre' },
              { em:'🌿', nom:'Coriandre', qte:'20 g' },
              { em:'🧈', nom:'Ghee', qte:'2 c. à soupe', g:30, nu:'ghee' },
              { em:'🌶️', nom:'Curcuma', qte:'1 c. à café', g:4, nu:'curcuma' }
            ],
            steps:[
              { illu:'rincer', t:'Rince les lentilles', duree_min:3,
                detail:'Jusqu\'à ce que l\'eau soit claire.',
                qte:[{ nom:'Lentilles corail', qte:'300 g' }],
                tip:'Non rincées, elles moussent et débordent dès l\'ébullition — et cette mousse a un goût de poussière.' },
              { illu:'bouillir', t:'Cuis-les simplement', duree_min:22,
                detail:'Avec le curcuma et 900 ml d\'eau, 20 min à petits bouillons, jusqu\'à ce qu\'elles se défassent.',
                qte:[{ nom:'Lentilles corail', qte:'720 g' }, { nom:'Curcuma', qte:'1 c. à café' }],
                tip:'Le curcuma dès le départ : c\'est le seul qui a besoin de cuire longtemps pour perdre son amertume.' },
              { illu:'saisir', t:'Prépare le tadka', duree_min:6,
                detail:'Ghee très chaud dans une petite poêle, les graines de cumin jusqu\'à ce qu\'elles crépitent, puis oignon, gingembre et tomate.',
                qte:[{ nom:'Ghee', qte:'2 c. à soupe' }, { nom:'Cumin', qte:'1 c. à soupe' }],
                tip:'LE TADKA EST TOUT LE PLAT. Les épices frites dans le gras brûlant libèrent des arômes que l\'eau ne sortira jamais. Le cumin doit CRÉPITER.' },
              { illu:'melanger', t:'Verse le tadka dans les lentilles', duree_min:3,
                detail:'En une fois, ça grésille. Remue, sale, laisse deux minutes.',
                tip:'Le grésillement au contact est normal et attendu : c\'est le bruit d\'un dal qui se termine.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Coriandre fraîche, riz basmati ou pain nature.',
                qte:[{ nom:'Coriandre', qte:'20 g' }],
                tip:'Il épaissit beaucoup en refroidissant : laisse-le plus liquide que ce que tu veux servir.' }
            ]
          } },
        { cle:'ind-poulet-tikka', n:'Poulet tikka masala',
          d:'Des morceaux de poulet grillés puis plongés dans une sauce tomate crémeuse aux épices douces.',
          i:'🍗 Poulet|🍅 Tomate|🥛 Crème|🧄 Ail|🫚 Gingembre|🍚 Riz',
          t:['Protéiné','Réconfortant'],
          nu:'La crème peut se remplacer par du yaourt épais : la sauce reste onctueuse, les lipides baissent nettement.',
          rec:{
            temps_min:70, portions:4,
            macros:{ p:71, g:59, l:27, kcal:780 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'800 g de hauts de cuisse', g:800, nu:'poulet' },
              { em:'🍅', nom:'Tomates concassées', qte:'500 g', g:500, nu:'tomate' },
              { em:'🥛', nom:'Crème', qte:'150 ml', g:150, nu:'creme' },
              { em:'🥛', nom:'Yaourt', qte:'200 g', g:200, nu:'yaourt' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' },
              { em:'🫚', nom:'Gingembre', qte:'25 g', g:25, nu:'gingembre' },
              { em:'🍚', nom:'Riz basmati', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🌶️', nom:'Épices', qte:'2 c. à soupe', g:15, nu:'epices' },
              { em:'🧈', nom:'Beurre', qte:'30 g', g:30, nu:'beurre' }
            ],
            steps:[
              { illu:'melanger', t:'Fais mariner le poulet', duree_min:30,
                detail:'Cubes de 3 cm, yaourt, la moitié de l\'ail et du gingembre, la moitié des épices, sel. 30 min minimum.',
                qte:[{ nom:'Poulet', qte:'800 g' }, { nom:'Yaourt', qte:'200 g' }],
                tip:'Des hauts de cuisse : le tikka masala passe par une cuisson forte puis une sauce — un blanc n\'y survit pas.' },
              { illu:'enfourner', t:'Grille les morceaux', duree_min:18,
                detail:'Sur une grille, 15 à 18 min à 240 °C ou sous le gril, jusqu\'à ce que les bords noircissent.',
                qte:[{ nom:'Poulet', qte:'800 g' }],
                tip:'LES BORDS NOIRCIS SONT LE PLAT. « Tikka » veut dire morceaux grillés : sans ce passage au feu vif, il ne reste qu\'un curry de poulet.' },
              { illu:'saisir', t:'Fais la base masala', duree_min:10,
                detail:'Beurre, reste d\'ail et de gingembre, les épices, puis les tomates. Laisse réduire jusqu\'à ce que l\'huile se sépare.',
                qte:[{ nom:'Tomates', qte:'500 g' }, { nom:'Épices', qte:'1 c. à soupe' }],
                tip:'Même signal que le chana masala : on attend que le gras remonte avant d\'aller plus loin.' },
              { illu:'mixer', t:'Mixe la sauce', duree_min:4,
                detail:'Mixe jusqu\'à obtenir une sauce parfaitement lisse, puis remets sur le feu.',
                tip:'Lisse, c\'est ce qui distingue un tikka masala d\'un curry maison. Passe-la au chinois si tu veux le niveau restaurant.' },
              { illu:'mijoter', t:'Réunis et crème', duree_min:10,
                detail:'Poulet grillé dans la sauce, la crème, 8 min à feu doux sans bouillir.',
                qte:[{ nom:'Crème', qte:'150 ml' }],
                tip:'SANS BOUILLIR après la crème : elle tranche, et la sauce devient granuleuse.' },
              { illu:'bouillir', t:'Riz basmati', duree_min:13,
                detail:'Rincé, une part et demie d\'eau, 11 min à couvert, 5 min de repos.',
                qte:[{ nom:'Riz basmati', qte:'250 g' }],
                tip:'Le basmati se rince jusqu\'à l\'eau claire et ne se remue jamais : c\'est ce qui garde les grains longs et séparés.' }
            ]
          } }
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
          nu:'Deux légumineuses, des herbes et des nouilles : une soupe qui vaut un repas entier.',
          rec:{
            temps_min:110, portions:5,
            macros:{ p:23, g:64, l:14, kcal:469 },
            ingredients:[
              { em:'🫘', nom:'Pois chiches', qte:'250 g cuits', g:250, nu:'pois chiches' },
              { em:'🫘', nom:'Lentilles', qte:'200 g crues (≈ 480 g cuites)', g:480, nu:'lentilles' },
              { em:'🌿', nom:'Persil', qte:'150 g', g:150, nu:'persil' },
              { em:'🌿', nom:'Coriandre', qte:'100 g', g:100, nu:'coriandre' },
              { em:'🥬', nom:'Épinards', qte:'300 g', g:300, nu:'epinards' },
              { em:'🍜', nom:'Nouilles', qte:'150 g (reshteh)', g:360, nu:'nouilles' },
              { em:'🧅', nom:'Oignons', qte:'400 g', g:400, nu:'oignon' },
              { em:'🥛', nom:'Kashk', qte:'150 g', g:150, nu:'kashk' },
              { em:'🫒', nom:'Huile', qte:'4 c. à soupe', g:50, nu:'huile' }
            ],
            steps:[
              { illu:'saisir', t:'Fais les oignons frits', duree_min:25,
                detail:'300 g d\'oignons en lamelles, à l\'huile, feu moyen, 25 min jusqu\'à ce qu\'ils soient bruns et croustillants. Réserve la moitié.',
                qte:[{ nom:'Oignons', qte:'300 g' }],
                tip:'LES OIGNONS FRITS SONT LA GARNITURE ET LA BASE. On en met dans la soupe et on en garde pour le dessus : c\'est la signature du plat.' },
              { illu:'mijoter', t:'Cuis les légumineuses', duree_min:45,
                detail:'Lentilles, pois chiches, le reste d\'oignon, du curcuma, 1,5 l d\'eau. 45 min à feu doux.',
                qte:[{ nom:'Lentilles', qte:'200 g' }, { nom:'Pois chiches', qte:'250 g' }],
                tip:'Une âsh est une soupe ÉPAISSE : elle doit tenir à la cuillère à la fin, pas couler.' },
              { illu:'couper', t:'Hache les herbes', duree_min:12,
                detail:'Persil, coriandre et épinards, hachés grossièrement. C\'est une quantité énorme, c\'est normal.',
                qte:[{ nom:'Persil', qte:'150 g' }, { nom:'Coriandre', qte:'100 g' }, { nom:'Épinards', qte:'300 g' }],
                tip:'550 g d\'herbes pour cinq personnes : l\'âsh-e reshteh est une soupe VERTE, les herbes sont un légume ici, pas un assaisonnement.' },
              { illu:'mijoter', t:'Ajoute les herbes', duree_min:25,
                detail:'Toutes les herbes dans la casserole, 25 min à feu doux. Le vert fonce et la soupe s\'épaissit.',
                tip:'Elles réduisent des trois quarts : ce qui remplissait la casserole tient dans une louche à la fin.' },
              { illu:'bouillir', t:'Ajoute les nouilles', duree_min:10,
                detail:'Cassées en morceaux de 5 cm, 8 à 10 min dans la soupe.',
                qte:[{ nom:'Nouilles', qte:'150 g' }],
                tip:'Directement dans la soupe : leur amidon est ce qui donne à l\'âsh sa consistance finale.' },
              { illu:'dresser', t:'Sers avec le kashk', duree_min:5,
                detail:'Kashk délayé versé en spirale, oignons frits par-dessus.',
                qte:[{ nom:'Kashk', qte:'150 g' }],
                tip:'Le kashk est un petit-lait fermenté, acide et salé : c\'est lui qui équilibre les herbes. Du yaourt grec très salé peut le remplacer.' }
            ]
          } },
        { cle:'ira-fesenjan-poulet', n:'Fesenjân au poulet',
          d:'Du poulet mijoté dans une sauce sombre aux noix pilées et à la mélasse de grenade, à la fois sucrée et acide.',
          i:'🍗 Poulet|🌰 Noix|🍇 Mélasse de grenade|🧅 Oignon|🍚 Riz|🌶️ Curcuma',
          t:['Protéiné','Réconfortant'],
          nu:'Ce sont les noix qui épaississent la sauce — riches en oméga-3, mais aussi le poste calorique du plat.',
          rec:{
            temps_min:130, portions:4,
            macros:{ p:75, g:88, l:40, kcal:1013 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'800 g de cuisses', g:800, nu:'poulet' },
              { em:'🌰', nom:'Noix', qte:'200 g', g:200, nu:'noix' },
              { em:'🍇', nom:'Mélasse de grenade', qte:'150 ml', g:150, nu:'melasse de grenade' },
              { em:'🧅', nom:'Oignon', qte:'250 g', g:250, nu:'oignon' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🌶️', nom:'Curcuma', qte:'1 c. à café', g:4, nu:'curcuma' },
              { em:'🍯', nom:'Sucre', qte:'1 c. à soupe', g:12, nu:'sucre' }
            ],
            steps:[
              { illu:'mixer', t:'Mouds les noix', duree_min:6,
                detail:'Mixe-les jusqu\'à obtenir une poudre fine, presque une pâte.',
                qte:[{ nom:'Noix', qte:'200 g' }],
                tip:'Fines, vraiment : ce sont elles qui épaississent la sauce. Grossières, elles restent en morceaux et la sauce reste liquide.' },
              { illu:'saisir', t:'Fais griller la poudre de noix', duree_min:8,
                detail:'À sec dans la cocotte, feu doux, 8 min en remuant, jusqu\'à ce que ça sente et fonce légèrement.',
                qte:[{ nom:'Noix', qte:'200 g' }],
                tip:'À SEC ET À FEU DOUX : les noix sont déjà grasses, elles brûlent en un instant et deviennent alors amères.' },
              { illu:'saisir', t:'Dore le poulet et l\'oignon', duree_min:10,
                detail:'Réserve les noix, fais colorer les morceaux de poulet et l\'oignon avec le curcuma.',
                qte:[{ nom:'Poulet', qte:'800 g' }, { nom:'Oignon', qte:'250 g' }],
                tip:'Le curcuma sur la viande avant le liquide : c\'est le pilier de la cuisine persane, et il a besoin de gras.' },
              { illu:'mijoter', t:'Mijote très longuement', duree_min:90,
                detail:'Noix, mélasse, sucre, 700 ml d\'eau. Feu le plus bas possible, 1 h 30, en remuant régulièrement.',
                qte:[{ nom:'Mélasse de grenade', qte:'150 ml' }, { nom:'Noix', qte:'300 g' }],
                tip:'UNE HEURE ET DEMIE, ET ON REMUE. La sauce passe du beige au brun très foncé et l\'huile des noix remonte : c\'est ça, un fesenjân réussi.' },
              { illu:'assaisonner', t:'Équilibre', duree_min:4,
                detail:'Goûte : ajoute du sucre si c\'est trop acide, de la mélasse si c\'est trop doux.',
                tip:'Le fesenjân se joue sur cet équilibre aigre-doux, et chaque mélasse est différente. C\'est le seul moment où l\'on ajuste.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Basmati rincé, une part et demie d\'eau, 11 min à couvert.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'Un riz nature est indispensable : la sauce est extrêmement concentrée, elle a besoin d\'un fond neutre.' }
            ]
          } },
        { cle:'ira-kashk-bademjan', n:'Kashk-e bademjan',
          d:'Une purée d\'aubergines fondues, montée au kashk (lactosérum fermenté) et couverte d\'oignons frits et de menthe.',
          i:'🍆 Aubergine|🥛 Kashk|🧅 Oignon|🌿 Menthe|🧄 Ail|🌶️ Curcuma',
          t:['Végétarien','Réconfortant'],
          nu:'Le kashk est fermenté et riche en protéines : un aigre-doux laitier qui remplace la crème.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:7, g:24, l:17, kcal:268 },
            ingredients:[
              { em:'🍆', nom:'Aubergines', qte:'800 g', g:800, nu:'aubergine' },
              { em:'🥛', nom:'Kashk', qte:'200 g', g:200, nu:'kashk' },
              { em:'🧅', nom:'Oignons', qte:'300 g', g:300, nu:'oignon' },
              { em:'🌿', nom:'Menthe séchée', qte:'2 c. à soupe', g:10, nu:'menthe' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🌶️', nom:'Curcuma', qte:'1 c. à café', g:4, nu:'curcuma' },
              { em:'🫒', nom:'Huile', qte:'5 c. à soupe', g:60, nu:'huile' }
            ],
            steps:[
              { illu:'couper', t:'Prépare les aubergines', duree_min:12,
                detail:'Épluchées en lanières, coupées en deux dans la longueur, salées et laissées 10 min.',
                qte:[{ nom:'Aubergines', qte:'800 g' }],
                tip:'Salées et dégorgées, elles boivent bien moins d\'huile — et l\'aubergine en boit énormément.' },
              { illu:'saisir', t:'Fais-les cuire', duree_min:18,
                detail:'Bien épongées, à la poêle avec l\'huile, feu moyen, jusqu\'à ce qu\'elles soient dorées et complètement fondantes.',
                qte:[{ nom:'Aubergines', qte:'800 g' }, { nom:'Huile', qte:'5 c. à soupe' }],
                tip:'Complètement fondantes : une aubergine à moitié cuite reste amère et spongieuse, il n\'y a pas de demi-mesure.' },
              { illu:'saisir', t:'Fais les oignons frits', duree_min:20,
                detail:'En lamelles, feu moyen, 20 min jusqu\'au brun croustillant. Garde-en la moitié pour le dessus.',
                qte:[{ nom:'Oignons', qte:'300 g' }],
                tip:'Comme pour l\'âsh : les oignons frits sont un ingrédient à part entière de la cuisine persane.' },
              { illu:'saisir', t:'Fais l\'huile à la menthe', duree_min:3,
                detail:'Dans une petite poêle, un peu d\'huile chaude, l\'ail puis la menthe séchée 20 secondes hors du feu.',
                qte:[{ nom:'Menthe séchée', qte:'2 c. à soupe' }, { nom:'Ail', qte:'4 gousses' }],
                tip:'HORS DU FEU pour la menthe : elle noircit en dix secondes sur la flamme et devient âcre.' },
              { illu:'melanger', t:'Écrase et mélange', duree_min:6,
                detail:'Écrase les aubergines à la fourchette, mélange la moitié des oignons, du curcuma et la moitié du kashk.',
                tip:'À la fourchette, jamais au mixeur : on veut de la texture, pas une purée lisse.' },
              { illu:'dresser', t:'Dresse', duree_min:4,
                detail:'Dans un plat creux, le reste de kashk en spirale, les oignons frits et l\'huile à la menthe.',
                qte:[{ nom:'Kashk', qte:'200 g' }],
                tip:'Se mange tiède, avec du pain plat, en trempant : c\'est un plat de partage, pas une assiette individuelle.' }
            ]
          } },
        { cle:'ira-mirza-ghasemi', n:'Mirza ghasemi',
          d:'Des aubergines grillées à la peau, écrasées avec de l\'ail et de la tomate, liées à l\'œuf.',
          i:'🍆 Aubergine|🍅 Tomate|🧄 Ail|🥚 Œuf|🌶️ Curcuma|🫒 Huile d\'olive',
          t:['Végétarien','Protéiné'],
          nu:'L\'œuf en fin de cuisson fait passer une purée de légumes au rang de plat complet.',
          rec:{
            temps_min:55, portions:3,
            macros:{ p:11, g:23, l:24, kcal:331 },
            ingredients:[
              { em:'🍆', nom:'Aubergines', qte:'700 g', g:700, nu:'aubergine' },
              { em:'🍅', nom:'Tomates', qte:'400 g', g:400, nu:'tomate' },
              { em:'🧄', nom:'Ail', qte:'6 gousses', g:24, nu:'ail' },
              { em:'🥚', nom:'Œufs', qte:'3', g:165, nu:'oeuf' },
              { em:'🌶️', nom:'Curcuma', qte:'1 c. à café', g:4, nu:'curcuma' },
              { em:'🫒', nom:'Huile d\'olive', qte:'4 c. à soupe', g:50, nu:'huile olive' }
            ],
            steps:[
              { illu:'enfourner', t:'Brûle les aubergines', duree_min:35,
                detail:'Entières, piquées, sous le gril du four ou directement sur la flamme, jusqu\'à ce que la peau soit noire et boursouflée.',
                qte:[{ nom:'Aubergines', qte:'700 g' }],
                tip:'LA PEAU DOIT ÊTRE NOIRE, PAS DORÉE. C\'est la fumée qui fait le mirza ghasemi : sans ce goût brûlé, c\'est une autre recette.' },
              { illu:'attendre', t:'Laisse-les tiédir', duree_min:10,
                detail:'Dans un saladier couvert : la vapeur décolle la peau toute seule.',
                tip:'Dix minutes couvertes, et la peau s\'enlève à la main. À chaud, on se brûle et on emporte la moitié de la chair.' },
              { illu:'saisir', t:'Fais l\'ail au curcuma', duree_min:4,
                detail:'Beaucoup d\'ail écrasé dans l\'huile chaude avec le curcuma, jusqu\'à ce qu\'il soit blond.',
                qte:[{ nom:'Ail', qte:'6 gousses' }, { nom:'Curcuma', qte:'1 c. à café' }],
                tip:'Six gousses pour trois personnes : ce plat est franchement aillé, c\'est son caractère.' },
              { illu:'melanger', t:'Ajoute la chair d\'aubergine', duree_min:8,
                detail:'Épluchée et écrasée à la fourchette, dans la poêle, 8 min à feu moyen pour évaporer son eau.',
                qte:[{ nom:'Aubergines', qte:'700 g' }],
                tip:'Laisse-la vraiment sécher : humide, le plat sera liquide et l\'œuf ne prendra pas.' },
              { illu:'mijoter', t:'Ajoute les tomates', duree_min:10,
                detail:'Pelées et concassées, jusqu\'à réduction complète.',
                qte:[{ nom:'Tomates', qte:'400 g' }],
                tip:'On veut une pâte, pas une sauce : quand la cuillère laisse une trace au fond, c\'est prêt.' },
              { illu:'melanger', t:'Casse les œufs dedans', duree_min:4,
                detail:'Directement dans la poêle, remue à la spatule jusqu\'à ce qu\'ils soient juste pris.',
                qte:[{ nom:'Œufs', qte:'3' }],
                tip:'Juste pris et pas plus : l\'œuf lie le plat, il ne doit pas former des morceaux d\'omelette.' }
            ]
          } }
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
          nu:'Les pois chiches font passer un antipasto au rang de plat : sans eux, il n\'y a pas de protéines.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:13, g:51, l:22, kcal:434 },
            ingredients:[
              { em:'🍆', nom:'Aubergines', qte:'700 g', g:700, nu:'aubergine' },
              { em:'🫘', nom:'Pois chiches', qte:'400 g cuits', g:400, nu:'pois chiches' },
              { em:'🍅', nom:'Tomates', qte:'400 g', g:400, nu:'tomate' },
              { em:'🫒', nom:'Olives', qte:'100 g vertes', g:100, nu:'olives' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🌿', nom:'Basilic', qte:'20 g', g:20, nu:'basilic' },
              { em:'🫒', nom:'Huile d\'olive', qte:'5 c. à soupe', g:60, nu:'huile olive' },
              { em:'🍯', nom:'Sucre', qte:'1 c. à soupe', g:12, nu:'sucre' },
              { em:'🥬', nom:'Céleri', qte:'150 g', g:150, nu:'celeri' }
            ],
            steps:[
              { illu:'couper', t:'Coupe les aubergines et sale-les', duree_min:15,
                detail:'Cubes de 2,5 cm, salés, dix minutes dans une passoire, puis épongés.',
                qte:[{ nom:'Aubergines', qte:'700 g' }],
                tip:'L\'aubergine dégorgée boit deux fois moins d\'huile — et une caponata en boit déjà beaucoup.' },
              { illu:'saisir', t:'Fais-les frire', duree_min:12,
                detail:'Huile bien chaude, en deux fois, jusqu\'à ce qu\'elles soient dorées et fondantes. Égoutte sur du papier.',
                qte:[{ nom:'Aubergines', qte:'700 g' }, { nom:'Huile d\'olive', qte:'5 c. à soupe' }],
                tip:'Bien chaude : dans une huile tiède, l\'aubergine l\'absorbe au lieu de la repousser.' },
              { illu:'saisir', t:'Fais revenir oignon et céleri', duree_min:10,
                detail:'Dans la même poêle, jusqu\'à ce qu\'ils soient tendres.',
                qte:[{ nom:'Oignon', qte:'200 g' }, { nom:'Céleri', qte:'150 g' }],
                tip:'Le céleri branche est obligatoire dans une caponata sicilienne : c\'est lui qui donne le croquant sous les aubergines fondantes.' },
              { illu:'mijoter', t:'Ajoute tomates, olives et pois chiches', duree_min:15,
                detail:'Avec le sucre et deux cuillères de vinaigre. Laisse réduire 15 min à découvert.',
                qte:[{ nom:'Tomates', qte:'400 g' }, { nom:'Olives', qte:'100 g' }, { nom:'Pois chiches', qte:'400 g' }],
                tip:'AIGRE-DOUX : sucre et vinaigre ensemble, c\'est ce qui fait une caponata et pas une ratatouille. Ajuste au goût.' },
              { illu:'melanger', t:'Remets les aubergines', duree_min:5,
                detail:'Délicatement, juste pour les enrober, deux minutes.',
                tip:'En dernier et brièvement : remises trop tôt, elles se défont complètement.' },
              { illu:'reposer', t:'Laisse reposer', duree_min:30,
                detail:'Hors du feu, au moins une demi-heure. Basilic déchiré à la main au moment de servir.',
                qte:[{ nom:'Basilic', qte:'20 g' }],
                tip:'LA CAPONATA SE MANGE À TEMPÉRATURE AMBIANTE, jamais chaude. Et elle est nettement meilleure le lendemain.' }
            ]
          } },
        { cle:'ita-minestrone', n:'Minestrone',
          d:'La soupe de légumes de saison avec des haricots et de petites pâtes, différente chaque semaine.',
          i:'🫘 Haricots|🥕 Carotte|🥬 Chou|🍅 Tomate|🍝 Pâtes|🫒 Huile d\'olive',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Haricots + pâtes : la combinaison qui rend un minestrone rassasiant au lieu d\'une soupe claire.',
          rec:{
            temps_min:70, portions:5,
            macros:{ p:14, g:45, l:14, kcal:354 },
            ingredients:[
              { em:'🫘', nom:'Haricots blancs', qte:'250 g cuits', g:250, nu:'haricots blancs' },
              { em:'🥕', nom:'Carottes', qte:'250 g', g:250, nu:'carotte' },
              { em:'🥬', nom:'Chou', qte:'250 g', g:250, nu:'chou' },
              { em:'🍅', nom:'Tomates', qte:'400 g', g:400, nu:'tomate' },
              { em:'🍝', nom:'Pâtes', qte:'150 g sèches (≈ 360 g cuites)', g:360, nu:'pates' },
              { em:'🫒', nom:'Huile d\'olive', qte:'4 c. à soupe', g:50, nu:'huile olive' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🥬', nom:'Céleri', qte:'150 g', g:150, nu:'celeri' },
              { em:'🧀', nom:'Parmesan', qte:'50 g', g:50, nu:'parmesan' }
            ],
            steps:[
              { illu:'couper', t:'Taille tout en petits dés', duree_min:15,
                detail:'Oignon, carotte, céleri, chou : des dés d\'un centimètre, réguliers.',
                qte:[{ nom:'Carottes', qte:'250 g' }, { nom:'Chou', qte:'250 g' }, { nom:'Céleri', qte:'150 g' }],
                tip:'Le minestrone se mange à la cuillère : tous les morceaux doivent tenir dedans, sans avoir à couper dans l\'assiette.' },
              { illu:'saisir', t:'Fais le soffritto', duree_min:10,
                detail:'Oignon, carotte et céleri à l\'huile d\'olive, feu doux, 10 min sans colorer.',
                qte:[{ nom:'Huile d\'olive', qte:'4 c. à soupe' }],
                tip:'Les trois ensemble et lentement : c\'est le socle de presque toute la cuisine italienne, et le raccourcir se sent.' },
              { illu:'mijoter', t:'Ajoute chou, tomates et eau', duree_min:30,
                detail:'Avec 1,2 l d\'eau ou de bouillon, sel. 30 min à petits bouillons.',
                qte:[{ nom:'Tomates', qte:'400 g' }],
                tip:'Une croûte de parmesan jetée dans la casserole si tu en as : elle fond doucement et donne au bouillon une profondeur qu\'aucun cube n\'égale.' },
              { illu:'mijoter', t:'Ajoute les haricots', duree_min:10,
                detail:'Écrases-en une louche contre la paroi pour épaissir le bouillon.',
                qte:[{ nom:'Haricots blancs', qte:'250 g' }],
                tip:'C\'est ce geste qui donne au minestrone sa texture crémeuse sans crème ni farine.' },
              { illu:'bouillir', t:'Cuis les pâtes dedans', duree_min:9,
                detail:'Directement dans la soupe, une minute de moins que le paquet.',
                qte:[{ nom:'Pâtes', qte:'150 g' }],
                tip:'Dans la soupe, pas à part : leur amidon lie le bouillon. À part, le minestrone reste aqueux.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Parmesan râpé et un filet d\'huile d\'olive crue dans chaque assiette.',
                qte:[{ nom:'Parmesan', qte:'50 g' }],
                tip:'L\'huile crue à la fin est une seconde huile, pas la même : celle de la cuisson a donné son gras, celle-ci donne son parfum.' }
            ]
          } },
        { cle:'ita-parmigiana', n:'Parmigiana d\'aubergines',
          d:'Des tranches d\'aubergine en couches avec sauce tomate, mozzarella et basilic, gratinées au four.',
          i:'🍆 Aubergine|🍅 Sauce tomate|🧀 Mozzarella|🧀 Parmesan|🌿 Basilic|🫒 Huile d\'olive',
          t:['Végétarien','Réconfortant'],
          nu:'Aubergines grillées plutôt que frites : le plat garde son fondant et perd la moitié de ses lipides.',
          rec:{
            temps_min:90, portions:5,
            macros:{ p:22, g:21, l:30, kcal:423 },
            ingredients:[
              { em:'🍆', nom:'Aubergines', qte:'1 kg', g:1000, nu:'aubergine' },
              { em:'🍅', nom:'Sauce tomate', qte:'700 g', g:700, nu:'tomate' },
              { em:'🧀', nom:'Mozzarella', qte:'300 g', g:300, nu:'mozzarella' },
              { em:'🧀', nom:'Parmesan', qte:'100 g', g:100, nu:'parmesan' },
              { em:'🌿', nom:'Basilic', qte:'25 g', g:25, nu:'basilic' },
              { em:'🫒', nom:'Huile d\'olive', qte:'4 c. à soupe', g:50, nu:'huile olive' },
              { em:'🧄', nom:'Ail', qte:'3 gousses', g:12, nu:'ail' }
            ],
            steps:[
              { illu:'couper', t:'Coupe les aubergines en tranches', duree_min:10,
                detail:'Dans la longueur, 7 à 8 mm d\'épaisseur. Sale-les et laisse-les dégorger 20 min.',
                qte:[{ nom:'Aubergines', qte:'1 kg' }],
                tip:'Sept millimètres : plus fines elles disparaissent, plus épaisses elles restent crues au centre.' },
              { illu:'enfourner', t:'Cuis-les au four', duree_min:25,
                detail:'Épongées, badigeonnées d\'huile, sur plaque, 20 à 25 min à 200 °C en les retournant.',
                qte:[{ nom:'Aubergines', qte:'1 kg' }, { nom:'Huile d\'olive', qte:'4 c. à soupe' }],
                tip:'AU FOUR PLUTÔT QU\'À LA FRITURE : c\'est moitié moins d\'huile pour un résultat tout aussi fondant, et le gratin ne dégouline pas.' },
              { illu:'mijoter', t:'Prépare la sauce', duree_min:20,
                detail:'Ail dans l\'huile, la sauce tomate, sel, 20 min à feu doux jusqu\'à ce qu\'elle épaississe. Basilic à la fin.',
                qte:[{ nom:'Sauce tomate', qte:'700 g' }, { nom:'Basilic', qte:'25 g' }],
                tip:'Une sauce trop liquide et la parmigiana s\'effondre à la découpe. Elle doit tenir sur la cuillère.' },
              { illu:'melanger', t:'Égoutte la mozzarella', duree_min:5,
                detail:'Coupée en tranches, posée sur du papier absorbant.',
                qte:[{ nom:'Mozzarella', qte:'300 g' }],
                tip:'LA MOZZARELLA REND BEAUCOUP D\'EAU. Non égouttée, elle inonde le plat et le gratin ne se tient pas.' },
              { illu:'melanger', t:'Monte les couches', duree_min:8,
                detail:'Sauce, aubergines, mozzarella, parmesan, basilic — et on recommence trois fois. Parmesan seul sur le dessus.',
                qte:[{ nom:'Parmesan', qte:'100 g' }],
                tip:'Mozzarella à l\'intérieur, parmesan au sommet : la mozzarella file, le parmesan gratine. Inverser donne un dessus caoutchouteux.' },
              { illu:'enfourner', t:'Enfourne', duree_min:35,
                detail:'35 min à 180 °C, jusqu\'à ce que ce soit doré et bouillonnant sur les bords.',
                tip:'Puis LAISSE-LA REPOSER 15 minutes. Coupée brûlante, elle glisse dans l\'assiette ; tiède, elle se tient en parts nettes.' }
            ]
          } },
        { cle:'ita-poulet-cacciatora', n:'Poulet alla cacciatora',
          d:'Du poulet mijoté « à la chasseur » avec tomates, olives, poivrons et vin blanc.',
          i:'🍗 Poulet|🍅 Tomate|🫒 Olives|🫑 Poivron|🧅 Oignon|🌿 Romarin',
          t:['Protéiné'],
          nu:'La cuisson longue en sauce permet de prendre des morceaux avec os, plus goûteux et moins chers.',
          rec:{
            temps_min:70, portions:4,
            macros:{ p:80, g:16, l:23, kcal:606 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'1 kg de cuisses', g:1000, nu:'poulet' },
              { em:'🍅', nom:'Tomates concassées', qte:'500 g', g:500, nu:'tomate' },
              { em:'🫒', nom:'Olives', qte:'120 g noires', g:120, nu:'olives' },
              { em:'🫑', nom:'Poivron', qte:'250 g', g:250, nu:'poivron' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🌿', nom:'Romarin', qte:'3 branches', g:5, nu:'romarin' },
              { em:'🫒', nom:'Huile d\'olive', qte:'3 c. à soupe', g:35, nu:'huile olive' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' }
            ],
            steps:[
              { illu:'saisir', t:'Fais dorer le poulet', duree_min:12,
                detail:'Cocotte, huile chaude, morceaux peau vers le bas, sans les bouger, jusqu\'à ce que la peau soit brune et croustillante. Réserve.',
                qte:[{ nom:'Poulet', qte:'1 kg' }],
                tip:'NE LES BOUGE PAS pendant les cinq premières minutes. La peau se décolle toute seule quand elle est saisie : forcer, c\'est l\'arracher.' },
              { illu:'saisir', t:'Fais revenir les légumes', duree_min:10,
                detail:'Oignon, poivron et ail dans le gras rendu, jusqu\'à ce qu\'ils soient tendres.',
                qte:[{ nom:'Oignon', qte:'200 g' }, { nom:'Poivron', qte:'250 g' }],
                tip:'Dans le gras du poulet et pas dans de l\'huile neuve : c\'est là qu\'est tout le goût de la peau dorée.' },
              { illu:'mijoter', t:'Déglace et mijote', duree_min:40,
                detail:'Un verre de vin blanc si tu en as, laisse évaporer, puis les tomates, le romarin, le poulet. 40 min à couvert entrouvert.',
                qte:[{ nom:'Tomates', qte:'500 g' }, { nom:'Romarin', qte:'3 branches' }],
                tip:'À couvert ENTROUVERT : couvert, la sauce reste liquide ; à découvert, elle réduit trop vite et le poulet sèche.' },
              { illu:'melanger', t:'Ajoute les olives', duree_min:8,
                detail:'Dans les huit dernières minutes seulement.',
                qte:[{ nom:'Olives', qte:'120 g' }],
                tip:'En fin de cuisson : mijotées longtemps, les olives rendent leur sel et dominent tout le plat.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Avec du pain, de la polenta ou des pommes de terre.',
                tip:'« Alla cacciatora » veut dire à la chasseuse : c\'est un plat de ce qu\'on a sous la main, il tolère les variations.' }
            ]
          } }
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
          nu:'Le saumon est l\'un des rares aliments à apporter à la fois protéines et oméga-3 en quantité.',
          rec:{
            temps_min:35, portions:2,
            macros:{ p:42, g:75, l:23, kcal:690 },
            ingredients:[
              { em:'🐟', nom:'Saumon', qte:'300 g', g:300, nu:'saumon' },
              { em:'🍚', nom:'Riz', qte:'150 g cru (≈ 390 g cuit)', g:390, nu:'riz' },
              { em:'🥦', nom:'Brocoli', qte:'200 g', g:200, nu:'brocoli' },
              { em:'🥕', nom:'Carotte', qte:'150 g', g:150, nu:'carotte' },
              { em:'🥢', nom:'Sauce soja', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🌾', nom:'Graines de sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' },
              { em:'🍯', nom:'Mirin', qte:'1 c. à soupe', g:15, nu:'mirin' }
            ],
            steps:[
              { illu:'rincer', t:'Lance le riz', duree_min:15,
                detail:'Rincé jusqu\'à l\'eau claire, une part et demie d\'eau, 11 min à couvert, 10 min de repos.',
                qte:[{ nom:'Riz', qte:'150 g' }],
                tip:'Les dix minutes de repos hors du feu comptent autant que la cuisson : c\'est là que le grain finit d\'absorber et devient brillant.' },
              { illu:'melanger', t:'Prépare la marinade', duree_min:3,
                detail:'Soja et mirin, moitié pour le poisson, moitié pour les légumes.',
                qte:[{ nom:'Sauce soja', qte:'3 c. à soupe' }, { nom:'Mirin', qte:'1 c. à soupe' }],
                tip:'Soja et mirin à parts égales : c\'est la base de presque toutes les sauces japonaises du quotidien.' },
              { illu:'saisir', t:'Cuis le saumon', duree_min:8,
                detail:'Poêle chaude, côté peau 4 min, retourne, verse la moitié de la marinade et laisse laquer 2 min.',
                qte:[{ nom:'Saumon', qte:'300 g' }],
                tip:'La peau croustillante côté poêle, sans y toucher. C\'est la meilleure partie et elle se rate en la retournant trop tôt.' },
              { illu:'bouillir', t:'Cuis les légumes', duree_min:7,
                detail:'Brocoli et carotte à la vapeur 6 min, puis mélangés au reste de marinade.',
                qte:[{ nom:'Brocoli', qte:'200 g' }, { nom:'Carotte', qte:'150 g' }],
                tip:'Croquants : dans un bento, ils seront mangés froids, et un légume trop cuit devient triste en refroidissant.' },
              { illu:'attendre', t:'Laisse tout refroidir', duree_min:10,
                detail:'Avant de remplir la boîte.',
                tip:'ON NE FERME JAMAIS UN BENTO CHAUD : la vapeur condense, détrempe le riz et fait tourner les aliments.' },
              { illu:'dresser', t:'Compose le bento', duree_min:4,
                detail:'Riz sur la moitié, saumon et légumes dans l\'autre, sésame par-dessus.',
                qte:[{ nom:'Graines de sésame', qte:'1 c. à soupe' }],
                tip:'Bien tassé, sans espace vide : un bento qui bouge en route arrive mélangé.' }
            ]
          } },
        { cle:'jap-chirashi-vege', n:'Chirashi végétarien',
          d:'Un lit de riz vinaigré couvert de tofu mariné, edamame, avocat et légumes crus taillés fin.',
          i:'🧊 Tofu|🍚 Riz|🫛 Edamame|🥑 Avocat|🥒 Concombre|🥬 Chou rouge',
          t:['Végétarien','Léger'],
          nu:'Tofu et edamame : deux protéines végétales dans le même bol, ce qui est ce qui manque souvent aux bols végétariens.',
          rec:{
            temps_min:30, portions:2,
            macros:{ p:28, g:94, l:20, kcal:667 },
            ingredients:[
              { em:'🧊', nom:'Tofu', qte:'250 g ferme', g:250, nu:'tofu' },
              { em:'🍚', nom:'Riz', qte:'180 g cru (≈ 470 g cuit)', g:470, nu:'riz' },
              { em:'🫛', nom:'Edamame', qte:'150 g', g:150, nu:'edamame' },
              { em:'🥑', nom:'Avocat', qte:'1 (130 g)', g:130, nu:'avocat' },
              { em:'🥒', nom:'Concombre', qte:'150 g', g:150, nu:'concombre' },
              { em:'🥬', nom:'Chou rouge', qte:'100 g', g:100, nu:'chou' },
              { em:'🥢', nom:'Sauce soja', qte:'2 c. à soupe', g:30, nu:'sauce soja' },
              { em:'🍯', nom:'Mirin', qte:'2 c. à soupe', g:30, nu:'mirin' }
            ],
            steps:[
              { illu:'bouillir', t:'Cuis le riz', duree_min:15,
                detail:'Riz à sushi rincé, une part et demie d\'eau, 11 min à couvert, 10 min de repos.',
                qte:[{ nom:'Riz', qte:'180 g' }],
                tip:'Du riz rond, pas du long grain : c\'est son amidon qui fait tenir les bouchées ensemble.' },
              { illu:'assaisonner', t:'Assaisonne le riz', duree_min:5,
                detail:'Trois cuillères de vinaigre de riz, une de sucre, une pincée de sel, chauffés puis versés sur le riz chaud. Mélange à la spatule EN COUPANT.',
                tip:'EN COUPANT ET PAS EN REMUANT : remué, le riz s\'écrase et devient pâteux. On tranche dedans à la spatule en éventant.' },
              { illu:'saisir', t:'Dore le tofu', duree_min:8,
                detail:'Cubes bien épongés, poêle chaude, dorés sur toutes les faces, puis laqués au soja et au mirin.',
                qte:[{ nom:'Tofu', qte:'250 g' }, { nom:'Sauce soja', qte:'2 c. à soupe' }],
                tip:'Éponge-le vraiment : le tofu humide ne dore jamais, il crépite et reste blanc.' },
              { illu:'couper', t:'Prépare les garnitures', duree_min:7,
                detail:'Concombre en fines rondelles, chou rouge en lanières, avocat en lamelles, edamame décortiqués.',
                qte:[{ nom:'Concombre', qte:'150 g' }, { nom:'Chou rouge', qte:'100 g' }, { nom:'Avocat', qte:'130 g' }],
                tip:'Coupe fin et régulier : dans un chirashi, tout se voit, et la découpe EST la présentation.' },
              { illu:'dresser', t:'Dresse', duree_min:4,
                detail:'Riz tiède au fond du bol, garnitures disposées en secteurs par-dessus.',
                qte:[{ nom:'Edamame', qte:'150 g' }],
                tip:'Riz TIÈDE, jamais chaud : chaud, il cuit l\'avocat et flétrit le concombre.' }
            ]
          } },
        { cle:'jap-donburi-tofu', n:'Donburi au tofu',
          d:'Des cubes de tofu dorés puis glacés à la sauce soja, servis sur un bol de riz chaud avec de la ciboule.',
          i:'🧊 Tofu|🍚 Riz|🥢 Sauce soja|🧅 Ciboule|🫚 Gingembre|🌾 Graines de sésame',
          t:['Végétarien','Protéiné'],
          nu:'Le tofu ferme monte à une vingtaine de grammes de protéines pour 200 g — comparable à un œuf et demi.',
          rec:{
            temps_min:25, portions:2,
            macros:{ p:21, g:73, l:10, kcal:479 },
            ingredients:[
              { em:'🧊', nom:'Tofu', qte:'300 g ferme', g:300, nu:'tofu' },
              { em:'🍚', nom:'Riz', qte:'160 g cru (≈ 420 g cuit)', g:420, nu:'riz' },
              { em:'🥢', nom:'Sauce soja', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🧅', nom:'Ciboule', qte:'3 tiges', g:30, nu:'ciboule' },
              { em:'🫚', nom:'Gingembre', qte:'20 g', g:20, nu:'gingembre' },
              { em:'🌾', nom:'Graines de sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' },
              { em:'🍯', nom:'Mirin', qte:'2 c. à soupe', g:30, nu:'mirin' }
            ],
            steps:[
              { illu:'bouillir', t:'Lance le riz', duree_min:15,
                detail:'Rincé, une part et demie d\'eau, à couvert, 11 min plus repos.',
                qte:[{ nom:'Riz', qte:'160 g' }],
                tip:'Un donburi, c\'est littéralement « le bol » : le riz occupe les deux tiers, il n\'est pas un accompagnement.' },
              { illu:'couper', t:'Presse et coupe le tofu', duree_min:6,
                detail:'Enveloppé dans un torchon sous une assiette lestée, 5 min, puis coupé en cubes.',
                qte:[{ nom:'Tofu', qte:'300 g' }],
                tip:'PRESSER LE TOFU change tout : il perd un tiers de son eau, il dore mieux et il boit la sauce au lieu de la repousser.' },
              { illu:'saisir', t:'Dore-le', duree_min:7,
                detail:'Poêle chaude, un peu d\'huile, cubes dorés sur toutes les faces sans les retourner trop souvent.',
                qte:[{ nom:'Tofu', qte:'300 g' }],
                tip:'Une face à la fois, jusqu\'à ce qu\'elle se décolle seule. Retourné trop tôt, le tofu se casse.' },
              { illu:'melanger', t:'Laque', duree_min:4,
                detail:'Soja, mirin et gingembre râpé, versés dans la poêle, remue jusqu\'à ce que ça nappe.',
                qte:[{ nom:'Sauce soja', qte:'3 c. à soupe' }, { nom:'Mirin', qte:'2 c. à soupe' }, { nom:'Gingembre', qte:'20 g' }],
                tip:'Ça réduit en une minute et ça brûle en deux : reste devant la poêle.' },
              { illu:'dresser', t:'Monte le bol', duree_min:3,
                detail:'Riz au fond, tofu et sauce dessus, ciboule et sésame.',
                qte:[{ nom:'Ciboule', qte:'3 tiges' }, { nom:'Graines de sésame', qte:'1 c. à soupe' }],
                tip:'Verse toute la sauce de la poêle sur le riz : c\'est elle qui fait le donburi, le riz nu en dessous serait triste.' }
            ]
          } },
        { cle:'jap-yakitori', n:'Yakitori de poulet',
          d:'Des brochettes laquées à la sauce tare, grillées vite et badigeonnées plusieurs fois pendant la cuisson.',
          i:'🍗 Poulet|🥢 Sauce soja|🍯 Mirin|🧅 Ciboule|🍚 Riz|🥒 Concombre',
          t:['Protéiné','Léger'],
          nu:'La sauce apporte du sucre : deux ou trois brochettes suffisent, on complète avec les légumes.',
          rec:{
            temps_min:40, portions:3,
            macros:{ p:70, g:70, l:8, kcal:670 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'600 g de hauts de cuisse', g:600, nu:'poulet' },
              { em:'🥢', nom:'Sauce soja', qte:'6 c. à soupe', g:90, nu:'sauce soja' },
              { em:'🍯', nom:'Mirin', qte:'4 c. à soupe', g:60, nu:'mirin' },
              { em:'🧅', nom:'Ciboule', qte:'6 tiges', g:60, nu:'ciboule' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' },
              { em:'🥒', nom:'Concombre', qte:'150 g', g:150, nu:'concombre' },
              { em:'🍯', nom:'Sucre', qte:'2 c. à soupe', g:25, nu:'sucre' }
            ],
            steps:[
              { illu:'mijoter', t:'Prépare la tare', duree_min:12,
                detail:'Soja, mirin, sucre et un peu d\'eau, réduits à feu doux jusqu\'à ce que ça nappe la cuillère.',
                qte:[{ nom:'Sauce soja', qte:'6 c. à soupe' }, { nom:'Mirin', qte:'4 c. à soupe' }],
                tip:'LA TARE SE PRÉPARE AVANT et se réduit vraiment : trop liquide, elle coule des brochettes au lieu de les laquer.' },
              { illu:'couper', t:'Monte les brochettes', duree_min:10,
                detail:'Poulet en cubes de 3 cm, alternés avec des tronçons de ciboule de 3 cm.',
                qte:[{ nom:'Poulet', qte:'600 g' }, { nom:'Ciboule', qte:'6 tiges' }],
                tip:'L\'alternance n\'est pas décorative : la ciboule fond et parfume la viande de l\'intérieur.' },
              { illu:'saisir', t:'Grille sans sauce d\'abord', duree_min:8,
                detail:'Poêle-gril ou barbecue très chaud, 6 à 8 min en tournant, sans rien mettre dessus.',
                qte:[{ nom:'Poulet', qte:'600 g' }],
                tip:'SANS SAUCE AU DÉBUT : le sucre de la tare brûlerait avant que la viande soit cuite.' },
              { illu:'melanger', t:'Laque en trois fois', duree_min:6,
                detail:'Badigeonne, 30 secondes sur le feu, recommence trois fois.',
                tip:'Trois couches fines valent mieux qu\'une épaisse : c\'est ce qui donne la laque brillante et collante.' },
              { illu:'dresser', t:'Sers', duree_min:4,
                detail:'Avec du riz et des bâtonnets de concombre.',
                qte:[{ nom:'Riz', qte:'200 g' }, { nom:'Concombre', qte:'150 g' }],
                tip:'Le concombre cru est là pour couper : la tare est sucrée et salée, il faut quelque chose de neutre et croquant.' }
            ]
          } },
        { cle:'jap-ramen-poulet', n:'Ramen au poulet',
          d:'Un bouillon longuement mijoté, des nouilles fermes et du poulet effiloché — le tout monté au dernier moment.',
          i:'🍜 Nouilles|🍗 Poulet|🥢 Bouillon|🥚 Œuf|🧅 Ciboule|🫚 Gingembre',
          t:['Réconfortant','Protéiné'],
          nu:'Le bouillon est salé : c\'est le plat où l\'on peut se passer de resaler quoi que ce soit.',
          rec:{
            temps_min:50, portions:2,
            macros:{ p:74, g:71, l:15, kcal:754 },
            ingredients:[
              { em:'🍜', nom:'Nouilles', qte:'200 g (ramen)', g:480, nu:'nouilles' },
              { em:'🍗', nom:'Poulet', qte:'300 g de cuisses', g:300, nu:'poulet' },
              { em:'🥢', nom:'Bouillon', qte:'1,2 l', g:1200, nu:'bouillon' },
              { em:'🥚', nom:'Œufs', qte:'2', g:110, nu:'oeuf' },
              { em:'🧅', nom:'Ciboule', qte:'4 tiges', g:40, nu:'ciboule' },
              { em:'🫚', nom:'Gingembre', qte:'25 g', g:25, nu:'gingembre' },
              { em:'🥢', nom:'Sauce soja', qte:'4 c. à soupe', g:60, nu:'sauce soja' },
              { em:'🧄', nom:'Ail', qte:'3 gousses', g:12, nu:'ail' }
            ],
            steps:[
              { illu:'bouillir', t:'Fais les œufs mollets', duree_min:8,
                detail:'6 min 30 exactement dans l\'eau bouillante, puis eau glacée. Écale-les et laisse-les mariner dans du soja.',
                qte:[{ nom:'Œufs', qte:'2' }],
                tip:'6 MIN 30 CHRONO. À 6 min le blanc est mou, à 7 le jaune fige : le mollet japonais est une question de secondes.' },
              { illu:'mijoter', t:'Parfume le bouillon', duree_min:25,
                detail:'Bouillon, gingembre en rondelles, ail écrasé, la ciboule verte, le poulet entier. 25 min à frémissement.',
                qte:[{ nom:'Bouillon', qte:'1,2 l' }, { nom:'Poulet', qte:'300 g' }, { nom:'Gingembre', qte:'25 g' }],
                tip:'FRÉMIR, jamais bouillir : un bouillon qui bout devient trouble et amer.' },
              { illu:'couper', t:'Effiloche le poulet', duree_min:5,
                detail:'Sors-le, laisse tiédir, effiloche à la main. Filtre le bouillon et assaisonne-le au soja.',
                qte:[{ nom:'Sauce soja', qte:'4 c. à soupe' }],
                tip:'À la main et pas au couteau : les fibres se séparent naturellement et boivent mieux le bouillon.' },
              { illu:'bouillir', t:'Cuis les nouilles', duree_min:4,
                detail:'Dans une AUTRE casserole d\'eau, le temps indiqué, puis égoutte bien.',
                qte:[{ nom:'Nouilles', qte:'200 g' }],
                tip:'Jamais dans le bouillon : leur farine le troublerait, et un ramen se sert dans un bouillon limpide.' },
              { illu:'dresser', t:'Monte les bols', duree_min:4,
                detail:'Nouilles au fond, bouillon brûlant, poulet, œuf coupé en deux, ciboule ciselée.',
                qte:[{ nom:'Ciboule', qte:'4 tiges' }],
                tip:'Des bols préchauffés à l\'eau bouillante : un ramen tiédit en trois minutes dans un bol froid.' }
            ]
          } },
        { cle:'jap-saumon-teriyaki', n:'Saumon teriyaki',
          d:'Un pavé glacé à la sauce teriyaki, caramélisé sur le dessus et encore nacré au cœur.',
          i:'🐟 Saumon|🥢 Teriyaki|🍚 Riz|🥦 Brocoli|🫑 Poivron|🌾 Graines de sésame',
          t:['Protéiné'],
          nu:'Cuit à cœur, le saumon perd sa texture ; à peine nacré, il garde son moelleux sans ajout de gras.',
          rec:{
            temps_min:25, portions:2,
            macros:{ p:40, g:73, l:23, kcal:678 },
            ingredients:[
              { em:'🐟', nom:'Saumon', qte:'300 g', g:300, nu:'saumon' },
              { em:'🥢', nom:'Sauce teriyaki', qte:'4 c. à soupe', g:60, nu:'teriyaki' },
              { em:'🍚', nom:'Riz', qte:'150 g cru (≈ 390 g cuit)', g:390, nu:'riz' },
              { em:'🥦', nom:'Brocoli', qte:'200 g', g:200, nu:'brocoli' },
              { em:'🫑', nom:'Poivron', qte:'150 g', g:150, nu:'poivron' },
              { em:'🌾', nom:'Graines de sésame', qte:'1 c. à soupe', g:10, nu:'graines de sesame' }
            ],
            steps:[
              { illu:'bouillir', t:'Lance le riz', duree_min:15,
                detail:'Rincé, une part et demie d\'eau, 11 min à couvert.',
                qte:[{ nom:'Riz', qte:'150 g' }],
                tip:'Il part en premier : le saumon teriyaki se fait en huit minutes.' },
              { illu:'saisir', t:'Saisis le saumon', duree_min:6,
                detail:'Poêle chaude, sans matière grasse si la peau est là, côté peau 4 min, puis 2 min de l\'autre côté.',
                qte:[{ nom:'Saumon', qte:'300 g' }],
                tip:'Le saumon a assez de gras pour se cuire seul. L\'huile ajoutée ne fait que fumer.' },
              { illu:'melanger', t:'Laque', duree_min:4,
                detail:'Baisse le feu, verse la teriyaki, arrose les pavés à la cuillère jusqu\'à ce que la sauce épaississe.',
                qte:[{ nom:'Sauce teriyaki', qte:'4 c. à soupe' }],
                tip:'FEU DOUX pour laquer : la teriyaki est sucrée, elle passe du brillant au brûlé en quelques secondes.' },
              { illu:'bouillir', t:'Cuis les légumes', duree_min:6,
                detail:'Brocoli et poivron à la vapeur, 5 à 6 min, croquants.',
                qte:[{ nom:'Brocoli', qte:'200 g' }, { nom:'Poivron', qte:'150 g' }],
                tip:'Croquants et vifs : ils sont le contrepoint d\'une sauce très sucrée.' },
              { illu:'dresser', t:'Dresse', duree_min:2,
                detail:'Riz, légumes, saumon nappé du reste de sauce, sésame.',
                qte:[{ nom:'Graines de sésame', qte:'1 c. à soupe' }],
                tip:'Racle la poêle : la sauce réduite au fond vaut mieux que celle de la bouteille.' }
            ]
          } },
        { cle:'jap-soba', n:'Soba de sarrasin',
          d:'Des nouilles de sarrasin dans un bouillon clair, avec des légumes verts et de la ciboule ciselée.',
          i:'🍜 Nouilles de sarrasin|🥢 Bouillon|🥬 Épinards|🧅 Ciboule|🍄 Champignons|🥢 Sauce soja',
          t:['Léger','Riche en fibres'],
          nu:'Le sarrasin n\'est pas un blé : ses nouilles apportent plus de fibres et de protéines que des pâtes classiques.',
          rec:{
            temps_min:25, portions:2,
            macros:{ p:18, g:63, l:3, kcal:335 },
            ingredients:[
              { em:'🍜', nom:'Nouilles de sarrasin', qte:'200 g sèches (≈ 480 g cuites)', g:480, nu:'soba' },
              { em:'🥢', nom:'Bouillon', qte:'600 ml', g:600, nu:'bouillon' },
              { em:'🥬', nom:'Épinards', qte:'150 g', g:150, nu:'epinards' },
              { em:'🧅', nom:'Ciboule', qte:'3 tiges', g:30, nu:'ciboule' },
              { em:'🍄', nom:'Champignons', qte:'150 g shiitake', g:150, nu:'champignon' },
              { em:'🥢', nom:'Sauce soja', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🍯', nom:'Mirin', qte:'2 c. à soupe', g:30, nu:'mirin' }
            ],
            steps:[
              { illu:'mijoter', t:'Prépare le bouillon', duree_min:10,
                detail:'Bouillon, soja et mirin, portés à frémissement avec les champignons émincés.',
                qte:[{ nom:'Bouillon', qte:'600 ml' }, { nom:'Champignons', qte:'150 g' }],
                tip:'Soba veut dire sarrasin : le bouillon doit rester léger, sinon il écrase le goût de la nouille.' },
              { illu:'bouillir', t:'Cuis les soba', duree_min:6,
                detail:'Dans une grande casserole d\'eau NON salée, 4 à 5 min. Remue dès qu\'elles entrent.',
                qte:[{ nom:'Nouilles de sarrasin', qte:'200 g' }],
                tip:'SANS SEL : les soba en contiennent déjà, et l\'eau salée les rend immangeables. C\'est la seule pâte dans ce cas.' },
              { illu:'rincer', t:'Rince-les à l\'eau froide', duree_min:3,
                detail:'Sous l\'eau froide, en les frottant entre les mains, jusqu\'à ce qu\'elles ne collent plus.',
                qte:[{ nom:'Nouilles de sarrasin', qte:'480 g' }],
                tip:'OBLIGATOIRE : le sarrasin libère un amidon très collant. Non rincées, les soba forment un bloc en deux minutes.' },
              { illu:'bouillir', t:'Blanchis les épinards', duree_min:3,
                detail:'30 secondes dans l\'eau des soba avant de la jeter, puis pressés.',
                qte:[{ nom:'Épinards', qte:'150 g' }],
                tip:'Dans la même eau : rien à laver de plus, et les épinards prennent un peu du goût de sarrasin.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Soba dans le bol, bouillon brûlant versé dessus, épinards, champignons et ciboule.',
                qte:[{ nom:'Ciboule', qte:'3 tiges' }],
                tip:'On peut aussi les servir FROIDES avec le bouillon à part, à tremper : c\'est ainsi qu\'on les mange l\'été.' }
            ]
          } }
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
          nu:'La marinade acide « cuit » un peu la viande avant le feu : elle reste juteuse même bien grillée.',
          rec:{
            temps_min:45, portions:3,
            macros:{ p:81, g:59, l:23, kcal:784 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'700 g de hauts de cuisse', g:700, nu:'poulet' },
              { em:'🥛', nom:'Yaourt', qte:'200 g', g:200, nu:'yaourt' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🧄', nom:'Ail', qte:'6 gousses', g:24, nu:'ail' },
              { em:'🌶️', nom:'Paprika', qte:'2 c. à café', g:8, nu:'paprika' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' },
              { em:'🫒', nom:'Huile d\'olive', qte:'3 c. à soupe', g:35, nu:'huile olive' }
            ],
            steps:[
              { illu:'melanger', t:'Fais la marinade', duree_min:6,
                detail:'Yaourt, jus d\'un citron, quatre gousses d\'ail en purée, paprika, huile, sel.',
                qte:[{ nom:'Yaourt', qte:'200 g' }, { nom:'Citron', qte:'1' }, { nom:'Ail', qte:'4 gousses' }],
                tip:'Le yaourt attendrit et le citron parfume : c\'est le duo de toute la grillade libanaise.' },
              { illu:'refrigerer', t:'Laisse mariner longtemps', duree_min:240,
                detail:'Cubes de 3 cm, au frais, 4 heures minimum — une nuit c\'est mieux.',
                qte:[{ nom:'Poulet', qte:'700 g' }],
                tip:'C\'est le seul temps long, et il n\'y a pas de raccourci : c\'est ce qui rend le chich taouk aussi tendre.' },
              { illu:'melanger', t:'Prépare la sauce à l\'ail', duree_min:5,
                detail:'Deux gousses écrasées avec du sel, montées à l\'huile d\'olive et au jus de citron en filet.',
                qte:[{ nom:'Ail', qte:'2 gousses' }, { nom:'Citron', qte:'1' }],
                tip:'Le toum monte comme une mayonnaise, sans œuf : c\'est l\'ail qui émulsionne, mais il faut verser l\'huile GOUTTE À GOUTTE au début.' },
              { illu:'saisir', t:'Grille les brochettes', duree_min:14,
                detail:'Poêle-gril brûlante ou barbecue, 12 à 14 min en tournant régulièrement.',
                qte:[{ nom:'Poulet', qte:'700 g' }],
                tip:'Essuie l\'excédent de marinade : le yaourt qui reste brûle et laisse un goût amer.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Riz nature, une part et demie d\'eau, 11 min à couvert.',
                qte:[{ nom:'Riz', qte:'200 g' }],
                tip:'Un riz aux vermicelles grillés si tu veux la version libanaise : on fait dorer une poignée de vermicelles cassés dans l\'huile avant d\'ajouter le riz.' }
            ]
          } },
        { cle:'lib-falafel-bowl', n:'Bowl de falafels',
          d:'Des falafels de pois chiches, du houmous, des crudités et une sauce au sésame, assemblés dans un bol.',
          i:'🧆 Falafel|🫘 Pois chiches|🥒 Concombre|🍅 Tomate|🥜 Tahini|🌾 Quinoa',
          t:['Végétarien','Riche en fibres'],
          nu:'Les falafels sont frits : servis avec du houmous plutôt qu\'une sauce crème, le bol reste équilibré.',
          rec:{
            temps_min:50, portions:3,
            macros:{ p:33, g:100, l:37, kcal:830 },
            ingredients:[
              { em:'🧆', nom:'Falafels', qte:'12 (350 g)', g:350, nu:'falafel' },
              { em:'🫘', nom:'Pois chiches', qte:'200 g cuits', g:200, nu:'pois chiches' },
              { em:'🥒', nom:'Concombre', qte:'200 g', g:200, nu:'concombre' },
              { em:'🍅', nom:'Tomates', qte:'250 g', g:250, nu:'tomate' },
              { em:'🥜', nom:'Tahini', qte:'4 c. à soupe', g:60, nu:'tahini' },
              { em:'🌾', nom:'Quinoa', qte:'150 g cru (≈ 450 g cuit)', g:450, nu:'quinoa' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🌿', nom:'Persil', qte:'20 g', g:20, nu:'persil' }
            ],
            steps:[
              { illu:'rincer', t:'Cuis le quinoa', duree_min:18,
                detail:'Rincé, deux parts d\'eau pour une de quinoa, 13 min à couvert puis 5 min de repos.',
                qte:[{ nom:'Quinoa', qte:'150 g' }],
                tip:'Le rinçage retire la saponine amère : sans lui, tout le bol a un arrière-goût de savon.' },
              { illu:'enfourner', t:'Cuis les falafels', duree_min:20,
                detail:'Au four à 200 °C, 18 à 20 min en les retournant, ou à la poêle dans un fond d\'huile.',
                qte:[{ nom:'Falafels', qte:'350 g' }],
                tip:'Au four ils sont moins gras mais plus secs ; à la poêle avec 1 cm d\'huile, c\'est le vrai croustillant. À toi de choisir.' },
              { illu:'fouetter', t:'Fais la sauce tahini', duree_min:5,
                detail:'Tahini, jus de citron, une gousse d\'ail, sel, puis DE L\'EAU FROIDE en filet en fouettant.',
                qte:[{ nom:'Tahini', qte:'4 c. à soupe' }, { nom:'Citron', qte:'1' }],
                tip:'LE TAHINI ÉPAISSIT AVANT DE S\'ALLÉGER : quand on ajoute l\'eau, il durcit comme du ciment, puis se détend d\'un coup. Ne t\'arrête pas au premier stade.' },
              { illu:'couper', t:'Prépare les légumes', duree_min:7,
                detail:'Concombre et tomates en dés, persil haché.',
                qte:[{ nom:'Concombre', qte:'200 g' }, { nom:'Tomates', qte:'250 g' }],
                tip:'Salez les tomates à part et laissez-les cinq minutes : leur jus, mélangé à la sauce, en fait le meilleur assaisonnement.' },
              { illu:'dresser', t:'Compose le bol', duree_min:4,
                detail:'Quinoa, pois chiches, légumes, falafels dessus, sauce tahini en filet, persil.',
                qte:[{ nom:'Pois chiches', qte:'200 g' }, { nom:'Persil', qte:'20 g' }],
                tip:'La sauce en dernier et généreusement : c\'est elle qui relie tout, un bol sec n\'a aucun intérêt.' }
            ]
          } },
        { cle:'lib-fattouche', n:'Fattouche',
          d:'La salade qui recycle le pain rassis : pain grillé, légumes croquants, sumac et beaucoup de citron.',
          i:'🥬 Laitue|🍅 Tomate|🥒 Concombre|🌿 Menthe|🥖 Pain pita|🍋 Citron',
          t:['Végétarien','Léger'],
          nu:'Une salade qui rassasie grâce au pain grillé — mais qui reste une entrée, pas un repas complet.',
          rec:{
            temps_min:25, portions:4,
            macros:{ p:7, g:31, l:17, kcal:289 },
            ingredients:[
              { em:'🥬', nom:'Laitue', qte:'300 g', g:300, nu:'salade' },
              { em:'🍅', nom:'Tomates', qte:'350 g', g:350, nu:'tomate' },
              { em:'🥒', nom:'Concombre', qte:'250 g', g:250, nu:'concombre' },
              { em:'🌿', nom:'Menthe', qte:'20 g', g:20, nu:'menthe' },
              { em:'🥖', nom:'Pain pita', qte:'2 (160 g)', g:160, nu:'pain pita' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🫒', nom:'Huile d\'olive', qte:'5 c. à soupe', g:60, nu:'huile olive' },
              { em:'🌿', nom:'Persil', qte:'30 g', g:30, nu:'persil' }
            ],
            steps:[
              { illu:'enfourner', t:'Grille le pain', duree_min:10,
                detail:'Pitas ouverts en deux, coupés en morceaux, huilés légèrement, 8 à 10 min à 180 °C jusqu\'à ce qu\'ils soient dorés et cassants.',
                qte:[{ nom:'Pain pita', qte:'2' }],
                tip:'CASSANTS, vraiment : c\'est le principe du fattouche, une salade de pain rassis. Mou, il se transforme en éponge dans la sauce.' },
              { illu:'couper', t:'Coupe les légumes', duree_min:10,
                detail:'Laitue en larges morceaux, tomates et concombre en dés généreux, herbes hachées.',
                qte:[{ nom:'Laitue', qte:'300 g' }, { nom:'Tomates', qte:'350 g' }, { nom:'Concombre', qte:'250 g' }],
                tip:'Gros morceaux : le fattouche est une salade rustique, pas une brunoise. On doit reconnaître chaque légume.' },
              { illu:'fouetter', t:'Fais la vinaigrette', duree_min:4,
                detail:'Jus des citrons, huile d\'olive, sel, poivre, et du sumac si tu en as.',
                qte:[{ nom:'Citron', qte:'2' }, { nom:'Huile d\'olive', qte:'5 c. à soupe' }],
                tip:'Le sumac est ce qui signe un fattouche : acidulé et fruité, il ne se remplace pas vraiment. À défaut, plus de citron.' },
              { illu:'melanger', t:'Assemble', duree_min:3,
                detail:'Légumes et herbes avec la sauce, mélangés à la main.',
                tip:'À la main, comme toujours : c\'est le seul moyen d\'enrober sans écraser.' },
              { illu:'dresser', t:'Ajoute le pain EN DERNIER', duree_min:2,
                detail:'Juste avant de servir, mélangé rapidement.',
                qte:[{ nom:'Pain pita', qte:'2' }],
                tip:'Ajouté d\'avance, il boit tout et devient mou. Le fattouche se monte au dernier moment, sans exception.' }
            ]
          } },
        { cle:'lib-mezze', n:'Mezzé libanais',
          d:'Houmous, moutabal, falafels, feta et olives : on picore à plusieurs, avec du pain plat pour tout saucer.',
          i:'🫘 Houmous|🍆 Aubergine|🧆 Falafel|🧀 Feta|🫒 Olives|🥖 Pain pita',
          t:['Végétarien','Riche en fibres'],
          nu:'Le pois chiche du houmous apporte des protéines végétales que les crudités seules n\'auraient pas.',
          rec:{
            temps_min:40, portions:4,
            macros:{ p:32, g:89, l:56, kcal:957 },
            ingredients:[
              { em:'🫘', nom:'Houmous', qte:'400 g', g:400, nu:'houmous' },
              { em:'🍆', nom:'Aubergine', qte:'500 g (pour le baba ganouj)', g:500, nu:'aubergine' },
              { em:'🧆', nom:'Falafels', qte:'8 (250 g)', g:250, nu:'falafel' },
              { em:'🧀', nom:'Feta', qte:'150 g', g:150, nu:'feta' },
              { em:'🫒', nom:'Olives', qte:'150 g', g:150, nu:'olives' },
              { em:'🥖', nom:'Pain pita', qte:'4 (320 g)', g:320, nu:'pain pita' },
              { em:'🥜', nom:'Tahini', qte:'3 c. à soupe', g:45, nu:'tahini' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🫒', nom:'Huile d\'olive', qte:'4 c. à soupe', g:50, nu:'huile olive' }
            ],
            steps:[
              { illu:'enfourner', t:'Brûle les aubergines', duree_min:35,
                detail:'Entières et piquées, sous le gril ou sur la flamme, jusqu\'à ce que la peau soit noire et la chair effondrée.',
                qte:[{ nom:'Aubergine', qte:'500 g' }],
                tip:'Noire, pas dorée : le baba ganouj EST un plat fumé. Sans ce goût de brûlé, c\'est une purée d\'aubergine ordinaire.' },
              { illu:'melanger', t:'Fais le baba ganouj', duree_min:8,
                detail:'Chair épluchée et égouttée, écrasée à la fourchette avec tahini, citron, ail et sel.',
                qte:[{ nom:'Tahini', qte:'3 c. à soupe' }, { nom:'Citron', qte:'1' }],
                tip:'ÉGOUTTE LA CHAIR une dizaine de minutes dans une passoire : elle rend beaucoup d\'eau amère.' },
              { illu:'enfourner', t:'Réchauffe les falafels', duree_min:15,
                detail:'15 min à 190 °C, ou à la poêle.',
                qte:[{ nom:'Falafels', qte:'250 g' }],
                tip:'Faits maison ou du commerce, ils doivent être servis chauds : froids, ils sont farineux.' },
              { illu:'dresser', t:'Dresse le houmous', duree_min:5,
                detail:'Étalé en spirale avec le dos d\'une cuillère, un creux au centre, beaucoup d\'huile d\'olive dedans.',
                qte:[{ nom:'Houmous', qte:'400 g' }, { nom:'Huile d\'olive', qte:'4 c. à soupe' }],
                tip:'Le creux à l\'huile n\'est pas un ornement : on trempe le pain dedans, et c\'est la meilleure bouchée du plat.' },
              { illu:'dresser', t:'Compose la table', duree_min:6,
                detail:'Petits plats séparés : houmous, baba ganouj, feta, olives, falafels, pitas chauds.',
                qte:[{ nom:'Feta', qte:'150 g' }, { nom:'Olives', qte:'150 g' }, { nom:'Pain pita', qte:'4' }],
                tip:'SÉPARÉS, jamais dans une grande assiette : un mezzé est une table à partager, chacun pioche.' }
            ]
          } },
        { cle:'lib-mjadara', n:'Mjadara',
          d:'Lentilles et riz cuits ensemble, couverts d\'oignons frits jusqu\'à devenir presque noirs et sucrés.',
          i:'🫘 Lentilles|🍚 Riz|🧅 Oignon|🫒 Huile d\'olive|🌿 Cumin|🥛 Yaourt',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Riz et lentilles ensemble forment une protéine complète — le plat de tous les jours, partout au Levant.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:20, g:72, l:22, kcal:557 },
            ingredients:[
              { em:'🫘', nom:'Lentilles', qte:'250 g crues (≈ 600 g cuites)', g:600, nu:'lentilles' },
              { em:'🍚', nom:'Riz', qte:'150 g cru (≈ 390 g cuit)', g:390, nu:'riz' },
              { em:'🧅', nom:'Oignons', qte:'500 g', g:500, nu:'oignon' },
              { em:'🫒', nom:'Huile d\'olive', qte:'6 c. à soupe', g:75, nu:'huile olive' },
              { em:'🌿', nom:'Cumin', qte:'1 c. à café', g:4, nu:'cumin' },
              { em:'🥛', nom:'Yaourt', qte:'250 g', g:250, nu:'yaourt' }
            ],
            steps:[
              { illu:'couper', t:'Émince les oignons', duree_min:8,
                detail:'En fines lamelles régulières. Cinq cents grammes, c\'est beaucoup et c\'est voulu.',
                qte:[{ nom:'Oignons', qte:'500 g' }],
                tip:'LES OIGNONS FRITS SONT LE PLAT, pas la garniture. C\'est d\'eux que vient tout le goût d\'un mjadara.' },
              { illu:'saisir', t:'Fais-les frire lentement', duree_min:25,
                detail:'Huile d\'olive, feu moyen, 25 min en remuant, jusqu\'au brun foncé et croustillant. Réserve la moitié.',
                qte:[{ nom:'Oignons', qte:'500 g' }, { nom:'Huile d\'olive', qte:'6 c. à soupe' }],
                tip:'Jusqu\'au BRUN FONCÉ, presque au bord du brûlé : c\'est cette limite qui donne le goût. Blonds, ils ne servent à rien.' },
              { illu:'bouillir', t:'Cuis les lentilles', duree_min:22,
                detail:'Rincées, dans trois fois leur volume d\'eau, 20 min. Elles doivent être tendres mais entières.',
                qte:[{ nom:'Lentilles', qte:'250 g' }],
                tip:'Des lentilles vertes ou brunes, pas corail : ici elles doivent tenir, pas se défaire.' },
              { illu:'mijoter', t:'Ajoute le riz', duree_min:15,
                detail:'Riz rincé, la moitié des oignons frits, le cumin, de l\'eau à deux doigts au-dessus. 13 min à couvert.',
                qte:[{ nom:'Riz', qte:'150 g' }, { nom:'Cumin', qte:'1 c. à café' }],
                tip:'Le riz cuit DANS l\'eau des lentilles : c\'est elle qui lui donne sa couleur brune et son goût.' },
              { illu:'reposer', t:'Laisse gonfler', duree_min:8,
                detail:'Hors du feu, à couvert, huit minutes.',
                tip:'Le mjadara se sert TIÈDE, jamais brûlant. Beaucoup le préfèrent même froid le lendemain.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Le reste d\'oignons frits par-dessus, du yaourt nature à côté.',
                qte:[{ nom:'Yaourt', qte:'250 g' }],
                tip:'Le yaourt n\'est pas optionnel : son acidité coupe la richesse de l\'huile et des oignons.' }
            ]
          } },
        { cle:'lib-taboule', n:'Taboulé libanais',
          d:'Le vrai : une salade de persil, pas de semoule. Le boulgour n\'est là que pour lier, en très petite quantité.',
          i:'🌿 Persil|🌿 Menthe|🍅 Tomate|🌾 Boulgour|🍋 Citron|🫒 Huile d\'olive',
          t:['Végétarien','Léger'],
          nu:'Du persil en quantité, donc beaucoup de vitamine C et de fer végétal — que le citron aide à absorber.',
          rec:{
            temps_min:35, portions:4,
            macros:{ p:5, g:22, l:20, kcal:268 },
            ingredients:[
              { em:'🌿', nom:'Persil plat', qte:'250 g (3 gros bouquets)', g:250, nu:'persil' },
              { em:'🌿', nom:'Menthe', qte:'50 g', g:50, nu:'menthe' },
              { em:'🍅', nom:'Tomates', qte:'400 g', g:400, nu:'tomate' },
              { em:'🌾', nom:'Boulgour', qte:'60 g fin (≈ 170 g gonflé)', g:170, nu:'boulgour' },
              { em:'🍋', nom:'Citron', qte:'3', g:180, nu:'citron' },
              { em:'🫒', nom:'Huile d\'olive', qte:'6 c. à soupe', g:75, nu:'huile olive' },
              { em:'🧅', nom:'Oignon', qte:'80 g', g:80, nu:'oignon' }
            ],
            steps:[
              { illu:'attendre', t:'Gonfle le boulgour', duree_min:15,
                detail:'Boulgour FIN, couvert d\'eau froide (ou du jus des tomates), 15 min. Presse-le ensuite.',
                qte:[{ nom:'Boulgour', qte:'60 g' }],
                tip:'SOIXANTE GRAMMES POUR QUATRE, et pas trois cents : le taboulé libanais est une SALADE DE PERSIL avec un peu de boulgour, l\'inverse du taboulé français.' },
              { illu:'couper', t:'Hache le persil', duree_min:15,
                detail:'Lavé, séché à fond, effeuillé, haché au couteau très aiguisé, PAS au mixeur.',
                qte:[{ nom:'Persil plat', qte:'250 g' }],
                tip:'Séché à fond et couteau aiguisé : humide ou haché au robot, le persil noircit et rend une eau verte amère.' },
              { illu:'couper', t:'Coupe tomates et oignon', duree_min:8,
                detail:'Tomates en tout petits dés, oignon très finement. Garde le jus des tomates.',
                qte:[{ nom:'Tomates', qte:'400 g' }, { nom:'Oignon', qte:'80 g' }],
                tip:'En petits dés : dans un taboulé, la tomate est un assaisonnement, pas un légume.' },
              { illu:'melanger', t:'Assemble', duree_min:4,
                detail:'Tout dans un saladier, jus des citrons, huile d\'olive, sel, poivre. Mélange délicatement.',
                qte:[{ nom:'Citron', qte:'3' }, { nom:'Huile d\'olive', qte:'6 c. à soupe' }],
                tip:'Beaucoup de citron : le taboulé doit être franchement acide, c\'est ce qui le rend rafraîchissant.' },
              { illu:'refrigerer', t:'Laisse reposer au frais', duree_min:20,
                detail:'Vingt minutes, pas plus.',
                tip:'Vingt minutes suffisent au boulgour pour finir de gonfler. Au-delà d\'une heure, le persil rend son eau et le taboulé devient flasque.' }
            ]
          } }
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
          nu:'Deux légumineuses dans le même bol : c\'est une soupe qui tient au corps, pas une entrée.',
          rec:{
            temps_min:80, portions:5,
            macros:{ p:15, g:46, l:9, kcal:313 },
            ingredients:[
              { em:'🫘', nom:'Lentilles', qte:'150 g crues (≈ 360 g cuites)', g:360, nu:'lentilles' },
              { em:'🫘', nom:'Pois chiches', qte:'300 g cuits', g:300, nu:'pois chiches' },
              { em:'🍅', nom:'Tomates', qte:'600 g', g:600, nu:'tomate' },
              { em:'🌿', nom:'Coriandre', qte:'50 g', g:50, nu:'coriandre' },
              { em:'🌿', nom:'Persil', qte:'50 g', g:50, nu:'persil' },
              { em:'🧅', nom:'Oignons', qte:'250 g', g:250, nu:'oignon' },
              { em:'🌾', nom:'Farine', qte:'2 c. à soupe', g:25, nu:'farine' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' }
            ],
            steps:[
              { illu:'saisir', t:'Fais fondre les oignons', duree_min:10,
                detail:'Hachés fin, à l\'huile, avec du gingembre moulu, du curcuma et du poivre.',
                qte:[{ nom:'Oignons', qte:'250 g' }],
                tip:'Les épices dans le gras dès le début : la harira en contient peu, mais elles doivent être bien ouvertes.' },
              { illu:'mixer', t:'Mixe les tomates et les herbes', duree_min:8,
                detail:'Tomates pelées, coriandre et persil, mixés ensemble en une purée verte.',
                qte:[{ nom:'Tomates', qte:'600 g' }, { nom:'Coriandre', qte:'50 g' }, { nom:'Persil', qte:'50 g' }],
                tip:'MIXÉES ENSEMBLE : c\'est ce qui donne à la harira sa couleur et sa texture veloutée, très différente d\'une soupe où les herbes flottent.' },
              { illu:'mijoter', t:'Ajoute lentilles et pois chiches', duree_min:45,
                detail:'La purée, les légumineuses, 1,5 l d\'eau, sel. 45 min à feu doux.',
                qte:[{ nom:'Lentilles', qte:'150 g' }, { nom:'Pois chiches', qte:'300 g' }],
                tip:'Les lentilles doivent être fondantes : la harira n\'a pas de morceaux fermes, tout doit se manger à la cuillère.' },
              { illu:'fouetter', t:'Fais la tedouira', duree_min:8,
                detail:'Farine délayée dans un grand verre d\'eau FROIDE, versée en filet dans la soupe bouillante en fouettant. Dix minutes de plus.',
                qte:[{ nom:'Farine', qte:'2 c. à soupe' }],
                tip:'LE LIANT DE LA HARIRA. Délayée à l\'eau froide et versée en filet, sinon c\'est plein de grumeaux — et une harira grumeleuse est ratée.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Un trait de citron dans chaque bol, avec des dattes à côté.',
                qte:[{ nom:'Citron', qte:'1' }],
                tip:'Le citron réveille la soupe. Et les dattes ne sont pas un dessert : c\'est ainsi qu\'on rompt le jeûne au Ramadan.' }
            ]
          } },
        { cle:'mar-tajine-citron', n:'Tajine au citron confit',
          d:'Du poulet mijoté des heures avec des olives et du citron confit, jusqu\'à se détacher de l\'os.',
          i:'🍗 Poulet|🍋 Citron confit|🫒 Olives|🧅 Oignon|🌿 Coriandre|🌶️ Curcuma',
          t:['Protéiné','Réconfortant'],
          nu:'La cuisson à couvert se passe de matière grasse : c\'est la vapeur qui fait le travail.',
          rec:{
            temps_min:90, portions:4,
            macros:{ p:80, g:15, l:24, kcal:604 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'1 kg de cuisses', g:1000, nu:'poulet' },
              { em:'🍋', nom:'Citrons confits', qte:'2', g:120, nu:'citron confit' },
              { em:'🫒', nom:'Olives', qte:'150 g vertes', g:150, nu:'olives' },
              { em:'🧅', nom:'Oignons', qte:'400 g', g:400, nu:'oignon' },
              { em:'🌿', nom:'Coriandre', qte:'30 g', g:30, nu:'coriandre' },
              { em:'🌶️', nom:'Curcuma', qte:'1 c. à café', g:4, nu:'curcuma' },
              { em:'🫒', nom:'Huile d\'olive', qte:'3 c. à soupe', g:35, nu:'huile olive' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' }
            ],
            steps:[
              { illu:'melanger', t:'Fais la chermoula', duree_min:8,
                detail:'Ail écrasé, curcuma, gingembre, coriandre hachée, huile d\'olive, sel, poivre. Enrobe le poulet.',
                qte:[{ nom:'Poulet', qte:'1 kg' }, { nom:'Coriandre', qte:'30 g' }],
                tip:'La chermoula est la marinade marocaine : elle sert aussi de base à la sauce, on ne la jette jamais.' },
              { illu:'saisir', t:'Fais colorer le poulet', duree_min:10,
                detail:'Dans le tajine ou une cocotte, à feu moyen, sur toutes les faces.',
                qte:[{ nom:'Poulet', qte:'1 kg' }],
                tip:'Un tajine en terre doit être chauffé DOUCEMENT et progressivement, sinon il fend. Une cocotte en fonte fait très bien l\'affaire.' },
              { illu:'saisir', t:'Ajoute les oignons', duree_min:10,
                detail:'En lamelles, autour et sous le poulet, jusqu\'à ce qu\'ils fondent.',
                qte:[{ nom:'Oignons', qte:'400 g' }],
                tip:'Sous le poulet : ils forment un lit qui l\'empêche d\'attacher et qui deviendra la sauce.' },
              { illu:'mijoter', t:'Mijote longuement', duree_min:50,
                detail:'Un demi-verre d\'eau seulement, couvercle en place, feu très doux, 50 min.',
                qte:[{ nom:'Poulet', qte:'1 kg' }],
                tip:'TRÈS PEU D\'EAU : le tajine cuit à la vapeur de ses propres ingrédients, c\'est le principe du couvercle conique.' },
              { illu:'melanger', t:'Ajoute citrons confits et olives', duree_min:10,
                detail:'Citrons en quartiers (chair retirée si tu les veux moins salés), olives rincées. Dix minutes.',
                qte:[{ nom:'Citrons confits', qte:'2' }, { nom:'Olives', qte:'150 g' }],
                tip:'En fin de cuisson : longuement mijotés, les citrons confits deviennent amers et les olives dominent tout.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Dans le plat, avec du pain pour saucer.',
                tip:'Du pain, pas du couscous : le tajine au citron se mange traditionnellement avec du khobz.' }
            ]
          } },
        { cle:'mar-zaalouk', n:'Zaalouk',
          d:'Une purée d\'aubergines et de tomates fondues à l\'huile d\'olive, à l\'ail et au cumin, servie tiède.',
          i:'🍆 Aubergine|🍅 Tomate|🧄 Ail|🌿 Cumin|🫒 Huile d\'olive|🌿 Coriandre',
          t:['Végétarien','Léger'],
          nu:'L\'aubergine boit l\'huile : la faire d\'abord rôtir au four permet d\'en mettre trois fois moins.',
          rec:{
            temps_min:50, portions:4,
            macros:{ p:4, g:20, l:16, kcal:224 },
            ingredients:[
              { em:'🍆', nom:'Aubergines', qte:'800 g', g:800, nu:'aubergine' },
              { em:'🍅', nom:'Tomates', qte:'500 g', g:500, nu:'tomate' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' },
              { em:'🌿', nom:'Cumin', qte:'2 c. à café', g:8, nu:'cumin' },
              { em:'🫒', nom:'Huile d\'olive', qte:'5 c. à soupe', g:60, nu:'huile olive' },
              { em:'🌿', nom:'Coriandre', qte:'25 g', g:25, nu:'coriandre' },
              { em:'🌶️', nom:'Paprika', qte:'1 c. à café', g:4, nu:'paprika' }
            ],
            steps:[
              { illu:'bouillir', t:'Cuis les aubergines', duree_min:20,
                detail:'Épluchées une bande sur deux, coupées en gros cubes, cuites 20 min à l\'eau bouillante salée ou à la vapeur.',
                qte:[{ nom:'Aubergines', qte:'800 g' }],
                tip:'À l\'eau plutôt qu\'à l\'huile : le zaalouk est une purée, pas une friture. L\'huile viendra après, et en moindre quantité.' },
              { illu:'mijoter', t:'Fais la base tomate', duree_min:15,
                detail:'Tomates pelées et concassées, ail écrasé, cumin, paprika, l\'huile d\'olive. 15 min à feu moyen.',
                qte:[{ nom:'Tomates', qte:'500 g' }, { nom:'Cumin', qte:'2 c. à café' }],
                tip:'Laisse-la vraiment réduire : de l\'eau de tomate dans un zaalouk et il ne se tient plus sur le pain.' },
              { illu:'melanger', t:'Réunis et écrase', duree_min:12,
                detail:'Aubergines égouttées dans la poêle, écrasées à la fourchette, 10 min à feu doux en remuant.',
                qte:[{ nom:'Aubergines', qte:'800 g' }],
                tip:'À LA FOURCHETTE, jamais au mixeur : le zaalouk doit garder des morceaux, sinon c\'est du caviar d\'aubergine.' },
              { illu:'assaisonner', t:'Ajuste', duree_min:3,
                detail:'Sale, ajoute la coriandre et un trait de citron. Laisse encore réduire si c\'est humide.',
                qte:[{ nom:'Coriandre', qte:'25 g' }],
                tip:'La cuillère doit laisser une trace au fond de la poêle : c\'est le test.' },
              { illu:'reposer', t:'Laisse tiédir', duree_min:10,
                detail:'Il se mange tiède ou froid, avec du pain.',
                tip:'Comme la caponata et la ratatouille : c\'est un plat qui gagne à attendre, et il est meilleur le lendemain.' }
            ]
          } }
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
          nu:'Viande et haricots ensemble : autant de protéines qu\'un plat tout viande, pour moitié moins de viande.',
          rec:{
            temps_min:95, portions:5,
            macros:{ p:47, g:75, l:20, kcal:673 },
            ingredients:[
              { em:'🥩', nom:'Bœuf haché', qte:'600 g', g:600, nu:'boeuf hache' },
              { em:'🫘', nom:'Haricots rouges', qte:'500 g cuits', g:500, nu:'haricots rouges' },
              { em:'🍅', nom:'Tomates concassées', qte:'800 g', g:800, nu:'tomate' },
              { em:'🧅', nom:'Oignons', qte:'250 g', g:250, nu:'oignon' },
              { em:'🌶️', nom:'Piment et cumin', qte:'2 c. à soupe', g:15, nu:'cumin' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🫑', nom:'Poivron', qte:'200 g', g:200, nu:'poivron' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' }
            ],
            steps:[
              { illu:'saisir', t:'Brunis la viande', duree_min:10,
                detail:'Cocotte très chaude, la viande étalée, laissée BRUNIR avant d\'être remuée.',
                qte:[{ nom:'Bœuf haché', qte:'600 g' }],
                tip:'Une viande hachée grise n\'a aucun goût. Il lui faut du contact et de la patience : cinq minutes sans y toucher.' },
              { illu:'saisir', t:'Ajoute oignon, ail et poivron', duree_min:8,
                detail:'Dans le gras rendu, jusqu\'à ce que tout soit tendre.',
                qte:[{ nom:'Oignons', qte:'250 g' }, { nom:'Poivron', qte:'200 g' }],
                tip:'Si la viande a rendu beaucoup d\'eau, laisse-la s\'évaporer d\'abord : sinon les légumes bouillent.' },
              { illu:'assaisonner', t:'Fais griller les épices', duree_min:2,
                detail:'Cumin, piment, paprika, une minute dans le gras avant tout liquide.',
                qte:[{ nom:'Épices', qte:'2 c. à soupe' }],
                tip:'Une minute dans le gras : c\'est ce qui sépare un chili parfumé d\'un chili qui a un goût de poudre.' },
              { illu:'mijoter', t:'Mijote longuement', duree_min:60,
                detail:'Tomates, un carré de chocolat noir si tu en as, sel. Une heure à feu très doux, à couvert entrouvert.',
                qte:[{ nom:'Tomates', qte:'800 g' }],
                tip:'LE CARRÉ DE CHOCOLAT n\'est pas une fantaisie : il vient du mole mexicain, et il donne de la profondeur sans se goûter.' },
              { illu:'melanger', t:'Ajoute les haricots', duree_min:15,
                detail:'Dans les quinze dernières minutes.',
                qte:[{ nom:'Haricots rouges', qte:'500 g' }],
                tip:'À la fin : mijotés une heure, ils se défont en purée et le chili perd sa texture.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Une part de riz, une part et demie d\'eau, 11 min à couvert.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'Le chili est meilleur le lendemain — mais le riz, lui, se fait au dernier moment.' }
            ]
          } },
        { cle:'mex-enchiladas-poulet', n:'Enchiladas de poulet',
          d:'Des tortillas de maïs roulées autour du poulet effiloché, nappées de sauce et passées au four.',
          i:'🌮 Tortilla de maïs|🍗 Poulet|🍅 Sauce tomate|🧀 Fromage|🥬 Laitue|🥑 Avocat',
          t:['Protéiné','Réconfortant'],
          nu:'La tortilla de maïs est plus dense que celle de blé : deux suffisent là où l\'on en prendrait trois.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:70, g:61, l:35, kcal:835 },
            ingredients:[
              { em:'🌮', nom:'Tortillas de maïs', qte:'12 (360 g)', g:360, nu:'tortilla' },
              { em:'🍗', nom:'Poulet', qte:'600 g', g:600, nu:'poulet' },
              { em:'🍅', nom:'Sauce tomate', qte:'600 g', g:600, nu:'tomate' },
              { em:'🧀', nom:'Fromage râpé', qte:'200 g', g:200, nu:'cheddar' },
              { em:'🥬', nom:'Laitue', qte:'150 g', g:150, nu:'salade' },
              { em:'🥑', nom:'Avocat', qte:'1 (130 g)', g:130, nu:'avocat' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🌶️', nom:'Piment et cumin', qte:'1 c. à soupe', g:8, nu:'cumin' }
            ],
            steps:[
              { illu:'bouillir', t:'Cuis et effiloche le poulet', duree_min:25,
                detail:'Pochez-le 20 min dans de l\'eau avec un oignon, puis effilochez-le à la fourchette.',
                qte:[{ nom:'Poulet', qte:'600 g' }],
                tip:'Poché plutôt que rôti : il reste juteux et se défait tout seul. Garde le bouillon pour allonger la sauce.' },
              { illu:'mijoter', t:'Prépare la sauce', duree_min:12,
                detail:'Oignon revenu, épices grillées, la sauce tomate, un peu du bouillon. Douze minutes de réduction.',
                qte:[{ nom:'Sauce tomate', qte:'600 g' }],
                tip:'Elle doit napper sans être épaisse : trop dense, elle ne pénètre pas les tortillas ; trop liquide, tout se délite.' },
              { illu:'melanger', t:'Garnis les tortillas', duree_min:12,
                detail:'Passe chaque tortilla 10 secondes dans la sauce chaude, garnis de poulet, roule et pose dans le plat, jointure en dessous.',
                qte:[{ nom:'Tortillas de maïs', qte:'12' }],
                tip:'LE PASSAGE DANS LA SAUCE EST OBLIGATOIRE : une tortilla de maïs sèche se fend dès qu\'on la roule. Chaude et enduite, elle plie sans casser.' },
              { illu:'enfourner', t:'Nappe et enfourne', duree_min:20,
                detail:'Reste de sauce par-dessus, fromage, 20 min à 190 °C.',
                qte:[{ nom:'Fromage râpé', qte:'200 g' }],
                tip:'Couvre bien les bords : une tortilla qui dépasse de la sauce durcit et devient immangeable.' },
              { illu:'dresser', t:'Sers', duree_min:4,
                detail:'Laitue ciselée et avocat en lamelles par-dessus, à froid.',
                qte:[{ nom:'Laitue', qte:'150 g' }, { nom:'Avocat', qte:'130 g' }],
                tip:'Le cru à la sortie du four : c\'est le contraste chaud-froid qui fait le plat.' }
            ]
          } },
        { cle:'mex-enchiladas-boeuf', n:'Enchiladas de bœuf',
          d:'La même idée, au bœuf mijoté : tortillas garnies, sauce rouge, fromage frais émietté et citron vert.',
          i:'🌮 Tortilla de maïs|🥩 Bœuf|🍅 Sauce tomate|🧀 Fromage|🧅 Oignon|🍋 Citron vert',
          t:['Protéiné','Réconfortant'],
          nu:'Un bœuf mijoté maigre (paleron, macreuse) rend le plat aussi fondant, avec beaucoup moins de lipides.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:61, g:60, l:47, kcal:918 },
            ingredients:[
              { em:'🌮', nom:'Tortillas de maïs', qte:'12 (360 g)', g:360, nu:'tortilla' },
              { em:'🥩', nom:'Bœuf haché', qte:'600 g', g:600, nu:'boeuf hache' },
              { em:'🍅', nom:'Sauce tomate', qte:'600 g', g:600, nu:'tomate' },
              { em:'🧀', nom:'Fromage râpé', qte:'200 g', g:200, nu:'cheddar' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🌶️', nom:'Épices', qte:'1 c. à soupe', g:8, nu:'cumin' }
            ],
            steps:[
              { illu:'saisir', t:'Fais brunir le bœuf', duree_min:10,
                detail:'À feu vif, étalé, sans remuer les premières minutes. Puis l\'oignon.',
                qte:[{ nom:'Bœuf haché', qte:'600 g' }, { nom:'Oignon', qte:'200 g' }],
                tip:'La croûte brune est le goût du plat : elle ne se forme qu\'au contact d\'une poêle chaude et sèche.' },
              { illu:'assaisonner', t:'Épice', duree_min:3,
                detail:'Cumin, piment, origan, une minute dans le gras. Sale.',
                qte:[{ nom:'Épices', qte:'1 c. à soupe' }],
                tip:'Goûte à ce stade : c\'est le dernier moment où l\'assaisonnement de la farce se corrige facilement.' },
              { illu:'mijoter', t:'Prépare la sauce', duree_min:12,
                detail:'Sauce tomate avec un peu d\'épices et d\'eau, réduite douze minutes.',
                qte:[{ nom:'Sauce tomate', qte:'600 g' }],
                tip:'Garde-en un tiers pour le dessus : c\'est ce qui empêche les tortillas de sécher au four.' },
              { illu:'melanger', t:'Roule les enchiladas', duree_min:12,
                detail:'Tortilla trempée 10 s dans la sauce, garnie, roulée, jointure en dessous.',
                qte:[{ nom:'Tortillas de maïs', qte:'12' }],
                tip:'Jointure DESSOUS : sinon elles s\'ouvrent à la cuisson et la garniture se répand.' },
              { illu:'enfourner', t:'Enfourne', duree_min:20,
                detail:'Sauce restante et fromage, 20 min à 190 °C.',
                qte:[{ nom:'Fromage râpé', qte:'200 g' }],
                tip:'Le fromage doit être fondu et taché de brun, pas seulement fondu : c\'est cinq minutes de plus.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Quartiers de citron vert et coriandre.',
                qte:[{ nom:'Citron vert', qte:'2' }],
                tip:'Le citron vert pressé au dernier moment tranche le gras du fromage et de la viande.' }
            ]
          } },
        { cle:'mex-burrito-bowl', n:'Burrito bowl au poulet',
          d:'Tout ce qu\'il y a dans un burrito, mais dans un bol : riz, haricots noirs, maïs, poulet grillé et avocat.',
          i:'🍚 Riz|🫘 Haricots noirs|🌽 Maïs|🍗 Poulet|🥑 Avocat|🍅 Tomate',
          t:['Protéiné','Riche en fibres'],
          nu:'Sans la galette, on retire une centaine de calories de féculent sans rien perdre du plat.',
          rec:{
            temps_min:35, portions:2,
            macros:{ p:76, g:115, l:19, kcal:916 },
            ingredients:[
              { em:'🍚', nom:'Riz', qte:'150 g cru (≈ 390 g cuit)', g:390, nu:'riz' },
              { em:'🫘', nom:'Haricots noirs', qte:'250 g cuits', g:250, nu:'haricots noirs' },
              { em:'🌽', nom:'Maïs', qte:'150 g', g:150, nu:'mais' },
              { em:'🍗', nom:'Poulet', qte:'350 g', g:350, nu:'poulet' },
              { em:'🥑', nom:'Avocat', qte:'1 (130 g)', g:130, nu:'avocat' },
              { em:'🍅', nom:'Tomates', qte:'200 g', g:200, nu:'tomate' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🌿', nom:'Coriandre', qte:'20 g', g:20, nu:'coriandre' }
            ],
            steps:[
              { illu:'bouillir', t:'Cuis le riz', duree_min:15,
                detail:'Une part et demie d\'eau, 11 min à couvert. Une fois cuit, mélange-lui de la coriandre et du jus de citron vert.',
                qte:[{ nom:'Riz', qte:'150 g' }, { nom:'Coriandre', qte:'20 g' }, { nom:'Citron vert', qte:'1' }],
                tip:'LE RIZ AU CITRON VERT ET CORIANDRE est ce qui fait un burrito bowl et pas un bol de riz : c\'est cinq secondes de plus.' },
              { illu:'assaisonner', t:'Fais mariner le poulet', duree_min:8,
                detail:'Lanières, jus de citron vert, cumin, paprika, ail, sel. Huit minutes.',
                qte:[{ nom:'Poulet', qte:'350 g' }, { nom:'Citron vert', qte:'1' }],
                tip:'Court, mais suffisant : le citron vert pénètre vite dans une lanière fine.' },
              { illu:'saisir', t:'Saisis le poulet', duree_min:8,
                detail:'Poêle très chaude, en une couche, sans le remuer trop tôt.',
                qte:[{ nom:'Poulet', qte:'350 g' }],
                tip:'En une seule couche, sinon il vapeur au lieu de saisir — c\'est le défaut de tous les sautés faits dans une poêle trop petite.' },
              { illu:'saisir', t:'Grille le maïs', duree_min:4,
                detail:'À sec dans la poêle, jusqu\'à ce que des grains noircissent.',
                qte:[{ nom:'Maïs', qte:'150 g' }],
                tip:'Les grains noircis ne sont pas brûlés : le maïs grillé est un ingrédient à part entière de la cuisine mexicaine.' },
              { illu:'dresser', t:'Compose', duree_min:4,
                detail:'Riz au fond, puis chaque garniture dans son secteur, avocat en lamelles.',
                qte:[{ nom:'Haricots noirs', qte:'250 g' }, { nom:'Avocat', qte:'130 g' }, { nom:'Tomates', qte:'200 g' }],
                tip:'Par secteurs, comme le buddha bowl : on mélange soi-même, cuillère par cuillère.' }
            ]
          } },
        { cle:'mex-tacos-boeuf', n:'Tacos de bœuf, salsa',
          d:'De petites tortillas garnies de bœuf haché épicé, salsa fraîche et coriandre, à plier à la main.',
          i:'🌮 Tortilla de maïs|🥩 Bœuf haché|🍅 Salsa|🧅 Oignon|🌿 Coriandre|🌶️ Piment',
          t:['Protéiné','Épicé'],
          nu:'La salsa fraîche remplace une sauce grasse par des tomates crues : goût en plus, lipides en moins.',
          rec:{
            temps_min:30, portions:3,
            macros:{ p:53, g:60, l:33, kcal:759 },
            ingredients:[
              { em:'🌮', nom:'Tortillas de maïs', qte:'9 (270 g)', g:270, nu:'tortilla' },
              { em:'🥩', nom:'Bœuf haché', qte:'500 g', g:500, nu:'boeuf hache' },
              { em:'🍅', nom:'Salsa', qte:'250 g', g:250, nu:'salsa' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🌿', nom:'Coriandre', qte:'25 g', g:25, nu:'coriandre' },
              { em:'🌶️', nom:'Piment', qte:'1' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' }
            ],
            steps:[
              { illu:'couper', t:'Prépare la garniture', duree_min:8,
                detail:'Oignon en tout petits dés, coriandre hachée, piment émincé. Mélange-les ensemble.',
                qte:[{ nom:'Oignon', qte:'150 g' }, { nom:'Coriandre', qte:'25 g' }],
                tip:'Oignon cru et coriandre, c\'est LA garniture du taco de rue mexicain. Ni salade, ni fromage, ni crème.' },
              { illu:'saisir', t:'Cuis le bœuf', duree_min:10,
                detail:'Poêle brûlante, la viande étalée, laissée croustiller avant de remuer. Sale, épice.',
                qte:[{ nom:'Bœuf haché', qte:'500 g' }],
                tip:'On cherche des morceaux croustillants, pas une bouillie : c\'est la texture qui fait la différence dans une tortilla molle.' },
              { illu:'saisir', t:'Chauffe les tortillas', duree_min:6,
                detail:'Une par une, à sec dans une poêle chaude, 30 secondes par face. Empile-les dans un torchon.',
                qte:[{ nom:'Tortillas de maïs', qte:'9' }],
                tip:'LE TORCHON EST IMPORTANT : empilées et couvertes, elles s\'assouplissent à la vapeur les unes des autres.' },
              { illu:'dresser', t:'Monte les tacos', duree_min:4,
                detail:'Deux tortillas superposées par taco, la viande, la garniture, la salsa, un quartier de citron vert.',
                qte:[{ nom:'Salsa', qte:'250 g' }, { nom:'Citron vert', qte:'2' }],
                tip:'DEUX TORTILLAS, c\'est la règle à Mexico : une seule se déchire sous le poids et le jus.' }
            ]
          } }
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
          nu:'C\'est le pain trempé qui lie la sauce, pas la crème — d\'où une onctuosité obtenue à peu de frais.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:72, g:70, l:24, kcal:799 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'700 g de blancs', g:700, nu:'poulet' },
              { em:'🌶️', nom:'Ají amarillo', qte:'4 c. à soupe de pâte', g:60, nu:'aji amarillo' },
              { em:'🥛', nom:'Lait', qte:'400 ml', g:400, nu:'lait' },
              { em:'🥖', nom:'Pain de mie', qte:'100 g', g:100, nu:'pain de mie' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🥚', nom:'Œufs', qte:'3 durs', g:165, nu:'oeuf' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🌰', nom:'Noix', qte:'50 g', g:50, nu:'noix' }
            ],
            steps:[
              { illu:'bouillir', t:'Poche le poulet', duree_min:25,
                detail:'20 min dans de l\'eau frémissante salée, puis effiloche-le à la main. Garde le bouillon.',
                qte:[{ nom:'Poulet', qte:'700 g' }],
                tip:'À la main, en longs filaments : l\'ají de gallina se mange effiloché, jamais en morceaux.' },
              { illu:'attendre', t:'Fais tremper le pain', duree_min:10,
                detail:'Pain de mie sans croûte, trempé dans le lait.',
                qte:[{ nom:'Pain de mie', qte:'100 g' }, { nom:'Lait', qte:'400 ml' }],
                tip:'LE PAIN EST LE LIANT — il n\'y a ni farine ni crème dans ce plat. C\'est ce qui lui donne son onctuosité.' },
              { illu:'saisir', t:'Fais la base d\'ají', duree_min:8,
                detail:'Oignon fondu, ail, puis la pâte d\'ají amarillo, cinq minutes à feu doux.',
                qte:[{ nom:'Ají amarillo', qte:'4 c. à soupe' }],
                tip:'L\'ají amarillo est fruité plus que fort : c\'est le goût du Pérou, et il se cuit dans le gras comme toutes les pâtes de piment.' },
              { illu:'mixer', t:'Mixe pain, lait et noix', duree_min:5,
                detail:'Avec la base d\'ají, jusqu\'à obtenir une crème lisse et jaune.',
                qte:[{ nom:'Noix', qte:'50 g' }],
                tip:'Les noix mixées épaississent et adoucissent : elles arrondissent le piquant sans l\'effacer.' },
              { illu:'mijoter', t:'Réunis', duree_min:12,
                detail:'La crème dans la casserole, le poulet effiloché, du bouillon si c\'est trop épais. Dix minutes à feu doux.',
                tip:'Elle doit napper la cuillère. Trop épaisse, elle devient pâteuse en refroidissant.' },
              { illu:'dresser', t:'Dresse', duree_min:5,
                detail:'Sur du riz blanc, avec des demi-œufs durs et des olives noires.',
                qte:[{ nom:'Riz', qte:'250 g' }, { nom:'Œufs', qte:'3' }],
                tip:'Les œufs durs et les olives ne sont pas décoratifs : ils font partie de la recette, et leur salinité équilibre la douceur.' }
            ]
          } },
        { cle:'per-quinoa-bowl', n:'Bowl de quinoa',
          d:'Du quinoa avec patate douce rôtie, pois chiches, betterave et fromage frais, façon assiette composée.',
          i:'🌾 Quinoa|🍠 Patate douce|🫘 Pois chiches|🥬 Roquette|🧀 Feta|🌽 Maïs',
          t:['Végétarien','Riche en fibres'],
          nu:'Le quinoa est l\'une des rares plantes à contenir tous les acides aminés essentiels.',
          rec:{
            temps_min:40, portions:2,
            macros:{ p:30, g:119, l:36, kcal:886 },
            ingredients:[
              { em:'🌾', nom:'Quinoa', qte:'120 g cru (≈ 360 g cuit)', g:360, nu:'quinoa' },
              { em:'🍠', nom:'Patate douce', qte:'300 g', g:300, nu:'patate douce' },
              { em:'🫘', nom:'Pois chiches', qte:'200 g cuits', g:200, nu:'pois chiches' },
              { em:'🥬', nom:'Roquette', qte:'80 g', g:80, nu:'roquette' },
              { em:'🧀', nom:'Feta', qte:'100 g', g:100, nu:'feta' },
              { em:'🌽', nom:'Maïs', qte:'150 g', g:150, nu:'mais' },
              { em:'🍋', nom:'Citron', qte:'1', g:60, nu:'citron' },
              { em:'🫒', nom:'Huile d\'olive', qte:'3 c. à soupe', g:35, nu:'huile olive' }
            ],
            steps:[
              { illu:'couper', t:'Coupe la patate douce', duree_min:5,
                detail:'En cubes de 2,5 cm, avec la peau si elle est bien lavée.',
                qte:[{ nom:'Patate douce', qte:'350 g' }],
                tip:'La peau tient les cubes au four et concentre les fibres : il n\'y a aucune raison de l\'enlever.' },
              { illu:'enfourner', t:'Rôtis-la avec les pois chiches', duree_min:28,
                detail:'Huile, sel, paprika, 25 à 28 min à 200 °C, en remuant à mi-parcours.',
                qte:[{ nom:'Pois chiches', qte:'250 g' }, { nom:'Huile d\'olive', qte:'2 c. à soupe' }],
                tip:'Les deux ensemble : les pois chiches croustillent pendant que la patate caramélise, et c\'est le même temps.' },
              { illu:'rincer', t:'Cuis le quinoa', duree_min:18,
                detail:'Rincé, deux parts d\'eau, 13 min à couvert, 5 min de repos.',
                qte:[{ nom:'Quinoa', qte:'150 g' }],
                tip:'Le quinoa est né sur l\'altiplano péruvien : c\'est ici l\'ingrédient principal, pas un substitut de riz.' },
              { illu:'saisir', t:'Grille le maïs', duree_min:4,
                detail:'À sec, jusqu\'à ce que des grains éclatent et noircissent.',
                qte:[{ nom:'Maïs', qte:'150 g' }],
                tip:'Du maïs géant du Pérou si tu en trouves : ses grains sont trois fois plus gros et se grillent comme des amandes.' },
              { illu:'dresser', t:'Compose', duree_min:5,
                detail:'Quinoa, patate douce, pois chiches, maïs, roquette, feta émiettée, citron et huile.',
                qte:[{ nom:'Roquette', qte:'80 g' }, { nom:'Feta', qte:'100 g' }, { nom:'Citron', qte:'1' }],
                tip:'La roquette au dernier moment, sous les éléments chauds : elle tombe juste ce qu\'il faut sans cuire.' }
            ]
          } },
        { cle:'per-tacu-tacu', n:'Tacu tacu',
          d:'Le riz et les haricots de la veille repoêlés en galette dorée, surmontés d\'un œuf au plat.',
          i:'🍚 Riz|🫘 Haricots|🥚 Œuf|🧅 Oignon rouge|🌶️ Ají amarillo|🌿 Coriandre',
          t:['Riche en fibres','Réconfortant'],
          nu:'Un riz refroidi puis réchauffé développe de l\'amidon résistant, moins vite absorbé.',
          rec:{
            temps_min:40, portions:3,
            macros:{ p:20, g:56, l:19, kcal:462 },
            ingredients:[
              { em:'🍚', nom:'Riz', qte:'250 g cuit (des restes)', g:250, nu:'riz' },
              { em:'🫘', nom:'Haricots', qte:'300 g cuits', g:300, nu:'haricots rouges' },
              { em:'🥚', nom:'Œufs', qte:'3', g:165, nu:'oeuf' },
              { em:'🧅', nom:'Oignon rouge', qte:'200 g', g:200, nu:'oignon' },
              { em:'🌶️', nom:'Ají amarillo', qte:'2 c. à soupe', g:30, nu:'aji amarillo' },
              { em:'🌿', nom:'Coriandre', qte:'20 g', g:20, nu:'coriandre' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' },
              { em:'🍋', nom:'Citron vert', qte:'1', g:60, nu:'citron vert' }
            ],
            steps:[
              { illu:'saisir', t:'Fais le sofrito', duree_min:8,
                detail:'Oignon haché fin à l\'huile, puis la pâte d\'ají amarillo, cinq minutes.',
                qte:[{ nom:'Oignon rouge', qte:'150 g' }, { nom:'Ají amarillo', qte:'2 c. à soupe' }],
                tip:'Le tacu tacu est un plat de RESTES : riz et haricots de la veille. C\'est le sofrito qui les transforme.' },
              { illu:'melanger', t:'Écrase les haricots', duree_min:6,
                detail:'Dans la poêle, écrasés à la cuillère avec le sofrito, jusqu\'à obtenir une pâte grossière.',
                qte:[{ nom:'Haricots', qte:'300 g' }],
                tip:'Grossière : on veut sentir des haricots entiers dedans, pas une purée uniforme.' },
              { illu:'melanger', t:'Ajoute le riz', duree_min:5,
                detail:'Mélange jusqu\'à obtenir une masse compacte qui se tient.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'Du riz FROID de la veille, comme pour un riz sauté : chaud, il se délite et rien ne se tient.' },
              { illu:'saisir', t:'Forme et dore les galettes', duree_min:10,
                detail:'Façonne des galettes ovales dans la poêle, laisse-les prendre 4 min par face sans y toucher.',
                tip:'LA CROÛTE EST LE PLAT. Quatre minutes sans bouger : c\'est ce qui forme le dessous doré et croustillant.' },
              { illu:'saisir', t:'Fais les œufs au plat', duree_min:4,
                detail:'Jaune coulant, blanc croustillant.',
                qte:[{ nom:'Œufs', qte:'3' }],
                tip:'Le jaune coulant coule sur la galette et sert de sauce : c\'est prévu ainsi.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Galette, œuf dessus, oignon rouge cru, coriandre et citron vert.',
                qte:[{ nom:'Oignon rouge', qte:'50 g' }, { nom:'Coriandre', qte:'20 g' }, { nom:'Citron vert', qte:'1' }],
                tip:'La salsa criolla — oignon rouge, citron, coriandre — est l\'accompagnement obligé : elle rafraîchit un plat très nourrissant.' }
            ]
          } },
        { cle:'per-lomo-saltado', n:'Lomo saltado',
          d:'Des lanières de bœuf sautées au wok avec oignon, tomate et sauce soja — le Pérou croisé avec la Chine.',
          i:'🥩 Bœuf|🧅 Oignon rouge|🍅 Tomate|🥢 Sauce soja|🍟 Pomme de terre|🌿 Coriandre',
          t:['Protéiné'],
          nu:'Sauté très vite et très chaud : la viande colore sans avoir le temps de rendre son eau.',
          rec:{
            temps_min:35, portions:3,
            macros:{ p:55, g:90, l:26, kcal:834 },
            ingredients:[
              { em:'🥩', nom:'Bœuf', qte:'500 g de rumsteck', g:500, nu:'boeuf' },
              { em:'🧅', nom:'Oignon rouge', qte:'250 g', g:250, nu:'oignon' },
              { em:'🍅', nom:'Tomates', qte:'300 g', g:300, nu:'tomate' },
              { em:'🥢', nom:'Sauce soja', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🍟', nom:'Pommes de terre', qte:'500 g', g:500, nu:'pomme de terre' },
              { em:'🌿', nom:'Coriandre', qte:'25 g', g:25, nu:'coriandre' },
              { em:'🌶️', nom:'Ají amarillo', qte:'1 c. à soupe', g:15, nu:'aji amarillo' },
              { em:'🍚', nom:'Riz', qte:'200 g cru (≈ 520 g cuit)', g:520, nu:'riz' }
            ],
            steps:[
              { illu:'couper', t:'Prépare les frites', duree_min:8,
                detail:'Pommes de terre en bâtonnets épais, séchées à fond.',
                qte:[{ nom:'Pommes de terre', qte:'500 g' }],
                tip:'Épaisses : elles seront jetées dans la sauce à la fin et doivent tenir. Des allumettes se ramolliraient aussitôt.' },
              { illu:'enfourner', t:'Cuis-les', duree_min:25,
                detail:'Au four à 220 °C avec un peu d\'huile, 25 min, ou en friture.',
                qte:[{ nom:'Pommes de terre', qte:'500 g' }],
                tip:'Elles doivent être PRÊTES avant que le sauté commence : le lomo saltado se termine en quatre minutes.' },
              { illu:'couper', t:'Coupe le bœuf en lanières', duree_min:6,
                detail:'Bandes épaisses de 1,5 cm, dans le sens contraire des fibres.',
                qte:[{ nom:'Bœuf', qte:'500 g' }],
                tip:'Épaisses : dans un wok brûlant, une lanière fine est cuite à cœur avant d\'être colorée.' },
              { illu:'saisir', t:'Saisis la viande à feu maximal', duree_min:4,
                detail:'Wok ou poêle fumante, la viande en une couche, 1 min sans bouger, puis saute. Réserve.',
                qte:[{ nom:'Bœuf', qte:'500 g' }],
                tip:'LE FEU DOIT ÊTRE VIOLENT. Le lomo saltado est un sauté chinois adopté par le Pérou : c\'est le « wok hei » qu\'on cherche.' },
              { illu:'saisir', t:'Oignon, tomate, sauce', duree_min:4,
                detail:'Oignon rouge en gros quartiers 1 min, tomates en quartiers 1 min, l\'ají, le soja et un trait de vinaigre.',
                qte:[{ nom:'Oignon rouge', qte:'250 g' }, { nom:'Tomates', qte:'300 g' }, { nom:'Sauce soja', qte:'3 c. à soupe' }],
                tip:'Les légumes restent CROQUANTS : l\'oignon doit garder son mordant, la tomate ne doit pas fondre.' },
              { illu:'melanger', t:'Réunis tout', duree_min:3,
                detail:'Viande, frites, coriandre, un tour de poêle, et sers immédiatement avec du riz.',
                qte:[{ nom:'Riz', qte:'200 g' }, { nom:'Coriandre', qte:'25 g' }],
                tip:'LES FRITES DANS LA POÊLE, c\'est la signature : elles boivent la sauce trente secondes avant d\'arriver dans l\'assiette.' }
            ]
          } }
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
          nu:'La marinade acide fait tout le travail : la viande reste juteuse sans être panée ni sauçée.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:84, g:58, l:18, kcal:744 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'1 kg de cuisses', g:1000, nu:'poulet' },
              { em:'🍋', nom:'Citron vert', qte:'4', g:240, nu:'citron vert' },
              { em:'🫚', nom:'Gingembre', qte:'40 g', g:40, nu:'gingembre' },
              { em:'🌿', nom:'Citronnelle', qte:'3 tiges', g:30, nu:'citronnelle' },
              { em:'🧄', nom:'Ail', qte:'8 gousses', g:32, nu:'ail' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🌶️', nom:'Curcuma', qte:'1 c. à café', g:4, nu:'curcuma' },
              { em:'🧈', nom:'Beurre', qte:'40 g', g:40, nu:'beurre' }
            ],
            steps:[
              { illu:'melanger', t:'Fais la marinade', duree_min:10,
                detail:'Jus des citrons verts, gingembre et ail râpés, citronnelle écrasée et hachée, un trait de vinaigre, sel, poivre.',
                qte:[{ nom:'Citron vert', qte:'4' }, { nom:'Citronnelle', qte:'3 tiges' }, { nom:'Gingembre', qte:'40 g' }],
                tip:'ÉCRASE LA CITRONNELLE au dos du couteau avant de la hacher : coupée à froid, elle ne rend presque rien.' },
              { illu:'refrigerer', t:'Laisse mariner', duree_min:240,
                detail:'Quatre heures au frais, toute une nuit c\'est mieux.',
                qte:[{ nom:'Poulet', qte:'1 kg' }],
                tip:'L\'inasal tire tout son goût de la marinade : c\'est un poulet grillé sans sauce, il n\'y a rien pour rattraper après.' },
              { illu:'melanger', t:'Prépare le beurre à l\'annatto', duree_min:5,
                detail:'Beurre fondu avec le curcuma (ou de l\'annatto si tu en as) et un peu de marinade.',
                qte:[{ nom:'Beurre', qte:'40 g' }, { nom:'Curcuma', qte:'1 c. à café' }],
                tip:'C\'EST CE BEURRE ORANGE QUI DONNE SA COULEUR à l\'inasal. L\'annatto est l\'original ; le curcuma en donne une bonne approximation.' },
              { illu:'saisir', t:'Grille en badigeonnant', duree_min:25,
                detail:'Braises ou poêle-gril à feu moyen, 20 à 25 min en retournant et en badigeonnant du beurre orange à chaque tour.',
                qte:[{ nom:'Poulet', qte:'1 kg' }],
                tip:'FEU MOYEN et badigeonnages répétés : à feu vif, le beurre brûle et la peau noircit avant que la cuisse soit cuite.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Riz blanc nature, à couvert.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'Et un petit bol de vinaigre à l\'ail à côté, pour tremper : c\'est l\'accompagnement traditionnel.' }
            ]
          } },
        { cle:'phi-kare-kare', n:'Kare-kare',
          d:'Un ragoût à la sauce de cacahuètes avec des légumes verts, servi avec de la pâte de crevettes à part.',
          i:'🥩 Bœuf|🥜 Cacahuètes|🍆 Aubergine|🥬 Pak choï|🫘 Haricots verts|🍚 Riz',
          t:['Protéiné','Réconfortant'],
          nu:'La sauce cacahuète est très calorique : c\'est la quantité de légumes qui rééquilibre l\'assiette.',
          rec:{
            temps_min:150, portions:5,
            macros:{ p:65, g:70, l:48, kcal:972 },
            ingredients:[
              { em:'🥩', nom:'Bœuf', qte:'900 g de jarret', g:900, nu:'boeuf' },
              { em:'🥜', nom:'Beurre de cacahuète', qte:'200 g', g:200, nu:'beurre de cacahuete' },
              { em:'🍆', nom:'Aubergine', qte:'300 g', g:300, nu:'aubergine' },
              { em:'🥬', nom:'Pak choï', qte:'300 g', g:300, nu:'pak choi' },
              { em:'🫘', nom:'Haricots verts', qte:'250 g', g:250, nu:'haricots verts' },
              { em:'🍚', nom:'Riz', qte:'300 g cru (≈ 780 g cuit)', g:780, nu:'riz' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🌾', nom:'Farine de riz', qte:'3 c. à soupe', g:40, nu:'farine' }
            ],
            steps:[
              { illu:'mijoter', t:'Cuis le bœuf très longtemps', duree_min:120,
                detail:'Jarret couvert d\'eau, porté à ébullition, écumé, puis 2 h à frémissement jusqu\'à ce qu\'il se défasse.',
                qte:[{ nom:'Bœuf', qte:'900 g' }],
                tip:'DEUX HEURES, et le jarret est le bon morceau : son collagène fond et donne au bouillon la texture gélatineuse du kare-kare.' },
              { illu:'saisir', t:'Fais griller la farine de riz', duree_min:5,
                detail:'À sec dans une poêle, en remuant, jusqu\'à ce qu\'elle blondisse et sente la noisette.',
                qte:[{ nom:'Farine de riz', qte:'3 c. à soupe' }],
                tip:'GRILLÉE, PAS CRUE : c\'est ce qui épaissit ET parfume. Crue, elle ne fait que coller.' },
              { illu:'melanger', t:'Monte la sauce', duree_min:8,
                detail:'Oignon fondu, beurre de cacahuète délayé dans une louche de bouillon chaud, puis la farine grillée.',
                qte:[{ nom:'Beurre de cacahuète', qte:'200 g' }],
                tip:'Délaye le beurre de cacahuète À PART, comme pour le mafé : versé directement, il se prend en blocs.' },
              { illu:'mijoter', t:'Réunis', duree_min:15,
                detail:'La sauce dans la casserole avec la viande et son bouillon, quinze minutes à feu doux en remuant.',
                qte:[{ nom:'Bœuf', qte:'900 g' }],
                tip:'Remue régulièrement : la cacahuète attache au fond en un instant.' },
              { illu:'bouillir', t:'Cuis les légumes séparément', duree_min:8,
                detail:'Haricots verts 5 min, aubergine 5 min, pak choï 2 min, à l\'eau bouillante ou dans le bouillon.',
                qte:[{ nom:'Haricots verts', qte:'250 g' }, { nom:'Aubergine', qte:'300 g' }, { nom:'Pak choï', qte:'300 g' }],
                tip:'SÉPARÉMENT et brièvement : dans un kare-kare, les légumes doivent rester distincts et fermes.' },
              { illu:'dresser', t:'Sers', duree_min:4,
                detail:'Viande et sauce au centre, légumes disposés autour, riz blanc et un peu de bagoong à part.',
                qte:[{ nom:'Riz', qte:'300 g' }],
                tip:'Le bagoong (pâte de crevettes fermentée) est l\'accompagnement obligé : la sauce n\'est PAS salée, c\'est lui qui sale chaque bouchée.' }
            ]
          } },
        { cle:'phi-lumpia-legumes', n:'Lumpia aux légumes',
          d:'De fins rouleaux garnis de légumes râpés et dorés à la poêle, à tremper dans une sauce au vinaigre.',
          i:'🥕 Carotte|🥬 Chou|🫘 Haricots verts|🧅 Oignon|🧄 Ail|🌮 Galettes de riz',
          t:['Végétarien'],
          nu:'Un rouleau, c\'est surtout des légumes — mais la friture, elle, ne se voit pas dans la garniture.',
          rec:{
            temps_min:60, portions:4,
            macros:{ p:4, g:49, l:13, kcal:316 },
            ingredients:[
              { em:'🥕', nom:'Carottes', qte:'250 g', g:250, nu:'carotte' },
              { em:'🥬', nom:'Chou', qte:'300 g', g:300, nu:'chou' },
              { em:'🫘', nom:'Haricots verts', qte:'150 g', g:150, nu:'haricots verts' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🌮', nom:'Galettes de riz', qte:'20 (150 g)', g:150, nu:'galettes de riz' },
              { em:'🥢', nom:'Sauce soja', qte:'2 c. à soupe', g:30, nu:'sauce soja' },
              { em:'🫒', nom:'Huile', qte:'4 c. à soupe', g:50, nu:'huile' }
            ],
            steps:[
              { illu:'couper', t:'Taille tout en julienne', duree_min:15,
                detail:'Carottes, chou et haricots verts en bâtonnets très fins et de la même longueur.',
                qte:[{ nom:'Carottes', qte:'250 g' }, { nom:'Chou', qte:'300 g' }, { nom:'Haricots verts', qte:'150 g' }],
                tip:'TRÈS FINE, la julienne : dans un rouleau de 2 cm de diamètre, un bâtonnet épais reste cru et perce la galette.' },
              { illu:'saisir', t:'Fais sauter la garniture', duree_min:10,
                detail:'Ail et oignon à l\'huile, puis les légumes à feu vif, 5 min. Sauce soja, sel, poivre.',
                qte:[{ nom:'Oignon', qte:'150 g' }, { nom:'Sauce soja', qte:'2 c. à soupe' }],
                tip:'Ils doivent rester CROQUANTS : ils cuiront encore à la friture, et des légumes mous font un rouleau flasque.' },
              { illu:'attendre', t:'Laisse refroidir complètement', duree_min:15,
                detail:'Étalée sur une plaque, la garniture doit être froide et bien égouttée avant d\'être roulée.',
                tip:'CHAUDE OU HUMIDE, ELLE DÉTREMPE LA GALETTE et le rouleau éclate dans l\'huile. C\'est l\'erreur numéro un.' },
              { illu:'melanger', t:'Roule les lumpia', duree_min:15,
                detail:'Deux cuillères de garniture au bas de la galette, replie les côtés, roule serré, colle le bord avec un peu d\'eau.',
                qte:[{ nom:'Galettes de riz', qte:'20' }],
                tip:'Serré et fin : un lumpia est un rouleau élancé, pas un nem trapu. Plus il est fin, plus il croustille.' },
              { illu:'saisir', t:'Fais-les frire', duree_min:10,
                detail:'Huile à 175 °C, quelques-uns à la fois, 3 à 4 min jusqu\'au doré. Égoutte sur une grille.',
                qte:[{ nom:'Huile', qte:'4 c. à soupe' }],
                tip:'SUR UNE GRILLE, pas sur du papier : posés à plat, ils ramollissent par en dessous en deux minutes.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Avec une sauce vinaigre-ail ou aigre-douce.',
                tip:'Ils se congèlent crus très bien : on les roule en grande quantité et on les frit surgelés, deux minutes de plus.' }
            ]
          } },
        { cle:'phi-pancit-legumes', n:'Pancit aux légumes',
          d:'Des vermicelles sautés avec des légumes taillés fin, sauce soja et un trait de citron au moment de servir.',
          i:'🍜 Vermicelles de riz|🥕 Carotte|🥬 Chou|🫑 Poivron|🥢 Sauce soja|🍋 Citron vert',
          t:['Végétarien','Léger'],
          nu:'Un plat de nouilles, donc de féculent : un œuf ou du tofu par-dessus en fait un repas.',
          rec:{
            temps_min:35, portions:4,
            macros:{ p:5, g:54, l:10, kcal:313 },
            ingredients:[
              { em:'🍜', nom:'Vermicelles de riz', qte:'250 g secs (≈ 600 g cuits)', g:600, nu:'vermicelles' },
              { em:'🥕', nom:'Carottes', qte:'200 g', g:200, nu:'carotte' },
              { em:'🥬', nom:'Chou', qte:'250 g', g:250, nu:'chou' },
              { em:'🫑', nom:'Poivron', qte:'150 g', g:150, nu:'poivron' },
              { em:'🥢', nom:'Sauce soja', qte:'4 c. à soupe', g:60, nu:'sauce soja' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' }
            ],
            steps:[
              { illu:'attendre', t:'Trempe les vermicelles', duree_min:15,
                detail:'Dans l\'eau tiède, 15 min, jusqu\'à ce qu\'ils soient souples. Égoutte bien.',
                qte:[{ nom:'Vermicelles de riz', qte:'250 g' }],
                tip:'Souples mais pas cuits : ils finiront dans le wok en buvant le bouillon, c\'est là qu\'ils prennent le goût.' },
              { illu:'couper', t:'Taille les légumes en julienne', duree_min:10,
                detail:'Carottes, chou et poivron en fins bâtonnets.',
                qte:[{ nom:'Carottes', qte:'200 g' }, { nom:'Chou', qte:'250 g' }, { nom:'Poivron', qte:'150 g' }],
                tip:'Tous de la même finesse : dans un pancit, les légumes et les nouilles doivent se ressembler et se mêler.' },
              { illu:'saisir', t:'Fais sauter l\'ail et les légumes', duree_min:6,
                detail:'Wok très chaud, l\'huile, l\'ail 20 secondes, puis les légumes 3 min à feu vif.',
                qte:[{ nom:'Ail', qte:'5 gousses' }],
                tip:'L\'ail en premier et brièvement : aux Philippines, c\'est l\'ail frit qui parfume tout, et il brûle en trente secondes.' },
              { illu:'mijoter', t:'Ajoute bouillon et sauce soja', duree_min:4,
                detail:'300 ml de bouillon ou d\'eau, la sauce soja, porté à frémissement.',
                qte:[{ nom:'Sauce soja', qte:'4 c. à soupe' }],
                tip:'Assez de liquide pour que les nouilles boivent, pas assez pour qu\'elles nagent : c\'est tout l\'art du pancit.' },
              { illu:'saisir', t:'Ajoute les vermicelles', duree_min:6,
                detail:'Égouttés, dans le wok, remués délicatement jusqu\'à ce que tout le liquide soit absorbé.',
                qte:[{ nom:'Vermicelles de riz', qte:'600 g' }],
                tip:'Remue avec deux spatules, en soulevant : les vermicelles de riz cassent si on les brasse comme des pâtes.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Quartiers de citron vert, à presser sur le plat.',
                qte:[{ nom:'Citron vert', qte:'2' }],
                tip:'LE CITRON VERT N\'EST PAS OPTIONNEL : c\'est lui qui réveille un plat autrement très doux. On en presse à table, généreusement.' }
            ]
          } },
        { cle:'phi-sinigang', n:'Sinigang',
          d:'La soupe aigre au tamarin, avec de la viande et des légumes verts — le plat de réconfort national.',
          i:'🥩 Bœuf|🍅 Tomate|🥬 Épinards|🫘 Haricots verts|🍆 Aubergine|🍋 Tamarin',
          t:['Protéiné','Léger'],
          nu:'Une soupe de viande sans matière grasse ajoutée : c\'est l\'acidité qui porte le goût, pas le gras.',
          rec:{
            temps_min:75, portions:5,
            macros:{ p:50, g:65, l:25, kcal:695 },
            ingredients:[
              { em:'🥩', nom:'Bœuf', qte:'800 g de jarret', g:800, nu:'boeuf' },
              { em:'🍅', nom:'Tomates', qte:'300 g', g:300, nu:'tomate' },
              { em:'🥬', nom:'Épinards', qte:'250 g', g:250, nu:'epinards' },
              { em:'🫘', nom:'Haricots verts', qte:'200 g', g:200, nu:'haricots verts' },
              { em:'🍆', nom:'Aubergine', qte:'250 g', g:250, nu:'aubergine' },
              { em:'🍋', nom:'Tamarin', qte:'60 g de pâte', g:60, nu:'tamarin' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🍚', nom:'Riz', qte:'300 g cru (≈ 780 g cuit)', g:780, nu:'riz' }
            ],
            steps:[
              { illu:'bouillir', t:'Blanchis la viande', duree_min:8,
                detail:'Couverte d\'eau froide, portée à ébullition, écumée soigneusement.',
                qte:[{ nom:'Bœuf', qte:'800 g' }],
                tip:'Écume vraiment : le sinigang est un bouillon clair, et les impuretés du début le troublent pour de bon.' },
              { illu:'mijoter', t:'Cuis le bœuf', duree_min:50,
                detail:'Avec l\'oignon en quartiers et les tomates, 50 min à frémissement, jusqu\'à ce qu\'il soit tendre.',
                qte:[{ nom:'Tomates', qte:'300 g' }, { nom:'Oignon', qte:'200 g' }],
                tip:'Les tomates fondent complètement et donnent leur acidité au bouillon : elles préparent le terrain pour le tamarin.' },
              { illu:'assaisonner', t:'Ajoute le tamarin', duree_min:5,
                detail:'Pâte de tamarin délayée dans une louche de bouillon, versée et goûtée.',
                qte:[{ nom:'Tamarin', qte:'60 g' }],
                tip:'GOÛTE ET AJUSTE : le sinigang doit être FRANCHEMENT acide, c\'est sa définition. Timide, ce n\'est plus un sinigang.' },
              { illu:'bouillir', t:'Ajoute les légumes en décalé', duree_min:12,
                detail:'Aubergine et haricots verts 8 min, puis les épinards 2 min.',
                qte:[{ nom:'Aubergine', qte:'250 g' }, { nom:'Haricots verts', qte:'200 g' }, { nom:'Épinards', qte:'250 g' }],
                tip:'En décalé, toujours : les épinards s\'effondrent en deux minutes, l\'aubergine en demande huit.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Riz blanc nature, à couvert.',
                qte:[{ nom:'Riz', qte:'300 g' }],
                tip:'Le riz se mange DANS le bouillon, cuillère par cuillère : c\'est un plat de bol, pas d\'assiette.' },
              { illu:'dresser', t:'Sers bouillant', duree_min:3,
                detail:'Dans de grands bols, avec un peu de sauce poisson à côté.',
                tip:'Chacun sale son bol au patis : le bouillon reste volontairement sous-salé pour qu\'on l\'ajuste soi-même.' }
            ]
          } }
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
          nu:'La pâte d\'arachide est le poste calorique du plat : deux cuillères suffisent à lier la sauce.',
          rec:{
            temps_min:80, portions:4,
            macros:{ p:62, g:82, l:55, kcal:1072 },
            ingredients:[
              { em:'🥩', nom:'Bœuf', qte:'700 g de macreuse', g:700, nu:'boeuf' },
              { em:'🥜', nom:'Beurre de cacahuète', qte:'150 g', g:150, nu:'beurre de cacahuete' },
              { em:'🍅', nom:'Concentré de tomate', qte:'3 c. à soupe', g:50, nu:'concentre de tomate' },
              { em:'🥕', nom:'Carottes', qte:'250 g', g:250, nu:'carotte' },
              { em:'🍠', nom:'Patate douce', qte:'300 g', g:300, nu:'patate douce' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🧅', nom:'Oignons', qte:'250 g', g:250, nu:'oignon' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' }
            ],
            steps:[
              { illu:'saisir', t:'Fais dorer la viande', duree_min:12,
                detail:'Gros cubes, huile chaude, dorés sur toutes les faces. Réserve.',
                qte:[{ nom:'Bœuf', qte:'700 g' }],
                tip:'Un morceau à mijoter (macreuse, paleron) : le mafé cuit une heure, un morceau tendre y deviendrait sec.' },
              { illu:'saisir', t:'Oignons et concentré', duree_min:8,
                detail:'Oignons fondus, puis le concentré de tomate, cuit 3 min jusqu\'à ce qu\'il fonce.',
                qte:[{ nom:'Oignons', qte:'250 g' }, { nom:'Concentré de tomate', qte:'3 c. à soupe' }],
                tip:'CUIRE LE CONCENTRÉ est indispensable : cru, il garde une acidité métallique qu\'aucune cuisson ultérieure ne retire.' },
              { illu:'melanger', t:'Délaye le beurre de cacahuète', duree_min:5,
                detail:'Dans un bol, avec deux louches d\'eau chaude, jusqu\'à obtenir une crème fluide.',
                qte:[{ nom:'Beurre de cacahuète', qte:'150 g' }],
                tip:'JAMAIS DIRECTEMENT DANS LA CASSEROLE : il se prend en blocs qui ne se défont plus. Délayé à part, il se mélange sans grumeaux.' },
              { illu:'mijoter', t:'Mijote', duree_min:45,
                detail:'Viande, sauce à la cacahuète, eau à hauteur, 45 min à feu doux à couvert, en remuant régulièrement.',
                qte:[{ nom:'Bœuf', qte:'700 g' }],
                tip:'REMUE SOUVENT : la cacahuète attache très vite, et un fond brûlé traverse tout le plat.' },
              { illu:'mijoter', t:'Ajoute les légumes', duree_min:20,
                detail:'Carottes et patate douce en gros morceaux, 20 min de plus.',
                qte:[{ nom:'Carottes', qte:'250 g' }, { nom:'Patate douce', qte:'300 g' }],
                tip:'En gros morceaux, ajoutés tard : le mafé n\'est pas une purée, on doit reconnaître chaque légume.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Riz blanc nature, à couvert.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'La sauce est très riche : le riz doit rester strictement neutre.' }
            ]
          } },
        { cle:'sen-thieboudienne', n:'Thiéboudiène',
          d:'Le plat national : du poisson farci aux herbes et des légumes mijotés, puis le riz cuit dans ce bouillon.',
          i:'🐟 Poisson|🍚 Riz|🥕 Carotte|🥬 Chou|🍆 Aubergine|🍅 Tomate',
          t:['Protéiné'],
          nu:'Le riz cuit dans le bouillon des légumes : rien de ce qui a été extrait n\'est jeté.',
          rec:{
            temps_min:90, portions:5,
            macros:{ p:44, g:80, l:18, kcal:662 },
            ingredients:[
              { em:'🐟', nom:'Poisson', qte:'800 g (mérou, thiof)', g:800, nu:'poisson' },
              { em:'🍚', nom:'Riz', qte:'400 g cru (≈ 1 040 g cuit)', g:1040, nu:'riz' },
              { em:'🥕', nom:'Carottes', qte:'300 g', g:300, nu:'carotte' },
              { em:'🥬', nom:'Chou', qte:'400 g', g:400, nu:'chou' },
              { em:'🍆', nom:'Aubergine', qte:'300 g', g:300, nu:'aubergine' },
              { em:'🍅', nom:'Concentré de tomate', qte:'4 c. à soupe', g:70, nu:'concentre de tomate' },
              { em:'🧅', nom:'Oignons', qte:'250 g', g:250, nu:'oignon' },
              { em:'🌿', nom:'Persil', qte:'40 g', g:40, nu:'persil' },
              { em:'🫒', nom:'Huile', qte:'5 c. à soupe', g:60, nu:'huile' }
            ],
            steps:[
              { illu:'melanger', t:'Prépare la farce du poisson', duree_min:10,
                detail:'Persil, ail, piment et un peu d\'oignon pilés ensemble. Fends les darnes et fourre-les.',
                qte:[{ nom:'Poisson', qte:'800 g' }, { nom:'Persil', qte:'40 g' }],
                tip:'LE ROFF, c\'est cette farce d\'herbes glissée dans le poisson. Sans elle, le thiéboudiène est une simple casserole de riz au poisson.' },
              { illu:'saisir', t:'Fais frire le poisson', duree_min:10,
                detail:'Huile chaude, les darnes dorées sur les deux faces sans être cuites à cœur. Réserve.',
                qte:[{ nom:'Poisson', qte:'800 g' }],
                tip:'Juste doré : il finira de cuire dans le bouillon. Trop cuit ici, il se désagrège ensuite.' },
              { illu:'saisir', t:'Fais la base', duree_min:10,
                detail:'Oignons dans la même huile, puis le concentré de tomate cuit 4 min jusqu\'à ce qu\'il fonce.',
                qte:[{ nom:'Oignons', qte:'250 g' }, { nom:'Concentré de tomate', qte:'4 c. à soupe' }],
                tip:'Même règle qu\'au mafé : le concentré doit cuire dans l\'huile jusqu\'à changer de couleur.' },
              { illu:'mijoter', t:'Cuis les légumes dans le bouillon', duree_min:30,
                detail:'Eau, sel, les légumes entiers ou en gros morceaux, 25 à 30 min. Retire-les au fur et à mesure qu\'ils sont cuits.',
                qte:[{ nom:'Carottes', qte:'300 g' }, { nom:'Chou', qte:'400 g' }, { nom:'Aubergine', qte:'300 g' }],
                tip:'AU FUR ET À MESURE : le chou est prêt bien avant la carotte. Tout laisser jusqu\'au bout donne une bouillie.' },
              { illu:'mijoter', t:'Cuis le poisson puis le riz', duree_min:25,
                detail:'Poisson 10 min dans le bouillon, retiré ; puis le riz dans ce même bouillon, 20 min à couvert.',
                qte:[{ nom:'Riz', qte:'400 g' }],
                tip:'LE RIZ CUIT DANS LE BOUILLON DE TOUT LE RESTE. C\'est ça, le thiéboudiène : le riz est le plat, pas l\'accompagnement.' },
              { illu:'dresser', t:'Dresse', duree_min:5,
                detail:'Riz étalé dans un grand plat, poisson et légumes disposés dessus.',
                tip:'Un seul grand plat au centre, mangé à la main ou à la cuillère : c\'est un plat de partage.' }
            ]
          } },
        { cle:'sen-yassa-poulet', n:'Yassa au poulet',
          d:'Du poulet mariné au citron et grillé, puis mijoté dans une masse d\'oignons confits très longuement.',
          i:'🍗 Poulet|🧅 Oignon|🍋 Citron|🌶️ Piment|🧄 Ail|🍚 Riz',
          t:['Protéiné'],
          nu:'La sauce, ce sont des oignons fondus et du citron — ni crème, ni farine, ni beurre.',
          rec:{
            temps_min:75, portions:4,
            macros:{ p:85, g:71, l:23, kcal:844 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'1 kg de cuisses', g:1000, nu:'poulet' },
              { em:'🧅', nom:'Oignons', qte:'800 g', g:800, nu:'oignon' },
              { em:'🍋', nom:'Citrons', qte:'4', g:240, nu:'citron' },
              { em:'🌶️', nom:'Piment', qte:'1' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🫒', nom:'Huile', qte:'4 c. à soupe', g:50, nu:'huile' },
              { em:'🫒', nom:'Moutarde', qte:'2 c. à soupe', g:30, nu:'moutarde' }
            ],
            steps:[
              { illu:'melanger', t:'Fais la marinade', duree_min:10,
                detail:'Jus des citrons, oignons émincés, ail, moutarde, huile, sel, poivre. Tout avec le poulet.',
                qte:[{ nom:'Oignons', qte:'800 g' }, { nom:'Citrons', qte:'4' }, { nom:'Poulet', qte:'1 kg' }],
                tip:'HUIT CENTS GRAMMES D\'OIGNONS pour un kilo de poulet : ce n\'est pas une erreur, le yassa EST un plat d\'oignons.' },
              { illu:'refrigerer', t:'Laisse mariner', duree_min:240,
                detail:'Quatre heures au frais, une nuit si possible.',
                tip:'Le citron attendrit et parfume en profondeur. C\'est le seul temps long, et il fait tout le plat.' },
              { illu:'saisir', t:'Grille le poulet', duree_min:15,
                detail:'Égoutté, sous le gril du four ou à la poêle, jusqu\'à ce que la peau soit bien colorée.',
                qte:[{ nom:'Poulet', qte:'1 kg' }],
                tip:'Égoutté à fond : mouillé de marinade, il ne colorera jamais et restera pâle.' },
              { illu:'saisir', t:'Fais fondre les oignons', duree_min:25,
                detail:'Les oignons de la marinade dans la cocotte, à l\'huile, 25 min jusqu\'à ce qu\'ils soient blonds et complètement fondus.',
                qte:[{ nom:'Oignons', qte:'800 g' }],
                tip:'Vingt-cinq minutes. C\'est long, et c\'est ce qui transforme un tas d\'oignons crus en une sauce onctueuse.' },
              { illu:'mijoter', t:'Réunis', duree_min:20,
                detail:'Poulet grillé, le reste de marinade, un peu d\'eau. Vingt minutes à couvert.',
                tip:'Goûte le citron à ce stade : selon les citrons, il faut parfois une pointe de sucre pour l\'équilibrer.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Riz blanc nature, à couvert.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'La sauce est acide et puissante : elle a besoin d\'un riz sans aucun assaisonnement.' }
            ]
          } }
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
          nu:'Le lait de coco est gras : une demi-boîte allongée d\'eau ou de bouillon suffit largement.',
          rec:{
            temps_min:35, portions:4,
            macros:{ p:36, g:11, l:23, kcal:389 },
            ingredients:[
              { em:'🥥', nom:'Lait de coco', qte:'400 ml', g:400, nu:'lait de coco' },
              { em:'🍗', nom:'Poulet', qte:'400 g', g:400, nu:'poulet' },
              { em:'🍄', nom:'Champignons', qte:'200 g', g:200, nu:'champignon' },
              { em:'🌿', nom:'Citronnelle', qte:'3 tiges', g:30, nu:'citronnelle' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🌶️', nom:'Piments', qte:'3' },
              { em:'🫚', nom:'Galanga ou gingembre', qte:'30 g', g:30, nu:'gingembre' },
              { em:'🥢', nom:'Sauce poisson', qte:'3 c. à soupe', g:45, nu:'sauce soja' }
            ],
            steps:[
              { illu:'couper', t:'Prépare les aromates', duree_min:8,
                detail:'Citronnelle écrasée au dos du couteau et coupée en tronçons, galanga en rondelles, piments fendus.',
                qte:[{ nom:'Citronnelle', qte:'3 tiges' }, { nom:'Galanga', qte:'30 g' }],
                tip:'ÉCRASE LA CITRONNELLE avant de la couper : ses huiles sont dans les fibres, et une tige coupée sans être meurtrie ne parfume presque rien.' },
              { illu:'mijoter', t:'Infuse le lait de coco', duree_min:12,
                detail:'Lait de coco et 200 ml d\'eau, les aromates, à frémissement 10 min.',
                qte:[{ nom:'Lait de coco', qte:'400 ml' }],
                tip:'FRÉMIR, JAMAIS BOUILLIR : le lait de coco tranche à gros bouillons et la soupe devient grasse et granuleuse.' },
              { illu:'mijoter', t:'Ajoute poulet et champignons', duree_min:8,
                detail:'Poulet en lamelles fines, champignons en quartiers, 6 à 8 min.',
                qte:[{ nom:'Poulet', qte:'400 g' }, { nom:'Champignons', qte:'200 g' }],
                tip:'Coupé fin, le poulet cuit en cinq minutes dans un liquide frémissant. Inutile de le saisir avant.' },
              { illu:'assaisonner', t:'Équilibre HORS DU FEU', duree_min:4,
                detail:'Sauce poisson, jus des citrons verts, un peu de sucre. Goûte et ajuste.',
                qte:[{ nom:'Sauce poisson', qte:'3 c. à soupe' }, { nom:'Citron vert', qte:'2' }],
                tip:'LE CITRON APRÈS LE FEU : chauffé, il devient amer. Et le tom kha se joue sur quatre goûts — salé, acide, sucré, piquant. Goûte, corrige, regoûte.' },
              { illu:'dresser', t:'Sers', duree_min:2,
                detail:'Coriandre par-dessus. Les aromates se laissent dans le bol mais ne se mangent pas.',
                tip:'Prévenir les convives : la citronnelle et le galanga sont là pour le goût, on les pousse sur le bord.' }
            ]
          } },
        { cle:'thai-curry-vert-poulet', n:'Curry vert de poulet',
          d:'Le plus relevé des curries thaïs : pâte verte, lait de coco, poulet, aubergines et basilic thaï.',
          i:'🍗 Poulet|🥥 Lait de coco|🌶️ Pâte de curry vert|🍆 Aubergine|🌿 Basilic thaï|🍚 Riz',
          t:['Protéiné','Épicé'],
          nu:'Le piquant vient de la pâte, pas du gras : on peut réduire le lait de coco sans perdre le goût.',
          rec:{
            temps_min:35, portions:4,
            macros:{ p:56, g:60, l:27, kcal:705 },
            ingredients:[
              { em:'🍗', nom:'Poulet', qte:'600 g', g:600, nu:'poulet' },
              { em:'🥥', nom:'Lait de coco', qte:'400 ml', g:400, nu:'lait de coco' },
              { em:'🌶️', nom:'Pâte de curry vert', qte:'3 c. à soupe', g:45, nu:'pate de curry' },
              { em:'🍆', nom:'Aubergines', qte:'300 g', g:300, nu:'aubergine' },
              { em:'🌿', nom:'Basilic thaï', qte:'25 g', g:25, nu:'basilic' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🥢', nom:'Sauce poisson', qte:'2 c. à soupe', g:30, nu:'sauce soja' }
            ],
            steps:[
              { illu:'saisir', t:'Fais « craquer » la crème de coco', duree_min:6,
                detail:'La partie épaisse du lait de coco (le dessus de la boîte) seule dans la casserole, à feu moyen, jusqu\'à ce que l\'huile se sépare.',
                qte:[{ nom:'Lait de coco', qte:'200 ml' }],
                tip:'C\'EST LA TECHNIQUE THAÏE, et presque personne ne la fait : on cuit d\'abord la crème jusqu\'à ce qu\'elle « craque » et libère son huile. C\'est dans cette huile que la pâte va frire.' },
              { illu:'assaisonner', t:'Fais frire la pâte de curry', duree_min:3,
                detail:'Dans l\'huile de coco séparée, 2 à 3 min, jusqu\'à ce que ça embaume fortement.',
                qte:[{ nom:'Pâte de curry vert', qte:'3 c. à soupe' }],
                tip:'Une pâte de curry jetée dans du liquide froid reste crue et plate. Frite, elle change complètement de dimension.' },
              { illu:'saisir', t:'Ajoute le poulet', duree_min:6,
                detail:'En lamelles, enrobé de la pâte, jusqu\'à ce qu\'il blanchisse.',
                qte:[{ nom:'Poulet', qte:'600 g' }],
                tip:'Enrobé avant tout liquide : chaque morceau prend le curry au lieu de flotter dedans.' },
              { illu:'mijoter', t:'Verse le reste de coco et les aubergines', duree_min:12,
                detail:'Le lait restant, les aubergines en quartiers, 10 à 12 min à frémissement.',
                qte:[{ nom:'Lait de coco', qte:'200 ml' }, { nom:'Aubergines', qte:'300 g' }],
                tip:'Des aubergines thaïes rondes si tu en trouves ; sinon des aubergines classiques en gros morceaux, elles fondent moins vite.' },
              { illu:'assaisonner', t:'Ajuste et finis au basilic', duree_min:3,
                detail:'Sauce poisson, une pincée de sucre, le basilic thaï jeté hors du feu.',
                qte:[{ nom:'Basilic thaï', qte:'25 g' }],
                tip:'Le basilic thaï à la toute fin : trente secondes de cuisson et il perd son parfum anisé, qui est la signature du curry vert.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Riz jasmin, une part et demie d\'eau, 11 min à couvert.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'Du jasmin si possible : son parfum fait partie du plat autant que le curry.' }
            ]
          } },
        { cle:'thai-curry-rouge-legumes', n:'Curry rouge de légumes',
          d:'Une version sans viande : tofu, courgette, aubergine et poivron mijotés dans un curry rouge au coco.',
          i:'🧊 Tofu|🥥 Lait de coco|🌶️ Pâte de curry rouge|🥒 Courgette|🍆 Aubergine|🫑 Poivron',
          t:['Végétarien','Épicé'],
          nu:'C\'est le tofu qui fait tenir le plat : sans lui, ce curry n\'apporterait presque aucune protéine.',
          rec:{
            temps_min:30, portions:4,
            macros:{ p:18, g:66, l:26, kcal:555 },
            ingredients:[
              { em:'🧊', nom:'Tofu', qte:'400 g ferme', g:400, nu:'tofu' },
              { em:'🥥', nom:'Lait de coco', qte:'400 ml', g:400, nu:'lait de coco' },
              { em:'🌶️', nom:'Pâte de curry rouge', qte:'3 c. à soupe', g:45, nu:'pate de curry' },
              { em:'🥒', nom:'Courgette', qte:'250 g', g:250, nu:'courgette' },
              { em:'🍆', nom:'Aubergine', qte:'250 g', g:250, nu:'aubergine' },
              { em:'🫑', nom:'Poivron', qte:'200 g', g:200, nu:'poivron' },
              { em:'🍚', nom:'Riz', qte:'250 g cru (≈ 650 g cuit)', g:650, nu:'riz' },
              { em:'🥢', nom:'Sauce soja', qte:'2 c. à soupe', g:30, nu:'sauce soja' }
            ],
            steps:[
              { illu:'couper', t:'Presse et dore le tofu', duree_min:10,
                detail:'Pressé 5 min sous un poids, coupé en cubes, doré à la poêle sur toutes les faces.',
                qte:[{ nom:'Tofu', qte:'400 g' }],
                tip:'Doré AVANT d\'entrer dans le curry : sinon il reste blanc, mou, et ne prend rien de la sauce.' },
              { illu:'saisir', t:'Fais craquer la coco et frire la pâte', duree_min:6,
                detail:'Crème de coco épaisse jusqu\'à séparation de l\'huile, puis la pâte de curry rouge 2 min.',
                qte:[{ nom:'Lait de coco', qte:'200 ml' }, { nom:'Pâte de curry rouge', qte:'3 c. à soupe' }],
                tip:'Même geste que pour le curry vert : c\'est la technique commune à tous les currys thaïs.' },
              { illu:'mijoter', t:'Ajoute les légumes', duree_min:10,
                detail:'Le reste du lait de coco, aubergine d\'abord (5 min), puis courgette et poivron.',
                qte:[{ nom:'Aubergine', qte:'250 g' }, { nom:'Courgette', qte:'250 g' }, { nom:'Poivron', qte:'200 g' }],
                tip:'En décalé : l\'aubergine met deux fois plus longtemps que la courgette, tout ensemble donne du cru et du fondu mélangés.' },
              { illu:'melanger', t:'Remets le tofu', duree_min:4,
                detail:'Avec la sauce soja et un peu de sucre, trois minutes.',
                qte:[{ nom:'Tofu', qte:'400 g' }],
                tip:'En fin de cuisson pour qu\'il garde sa croûte : mijoté longtemps, il redevient spongieux.' },
              { illu:'bouillir', t:'Riz', duree_min:13,
                detail:'Riz jasmin nature.',
                qte:[{ nom:'Riz', qte:'250 g' }],
                tip:'Un curry se sert AVEC le riz dans la même assiette, pas dessus : on prend un peu des deux à chaque cuillère.' }
            ]
          } },
        { cle:'thai-pad-thai-crevettes', n:'Pad thaï aux crevettes',
          d:'Des nouilles de riz sautées à la sauce tamarin, avec crevettes, œuf, pousses de soja et cacahuètes.',
          i:'🍜 Nouilles de riz|🍤 Crevettes|🥚 Œuf|🥜 Cacahuètes|🌱 Pousses de soja|🍋 Citron vert',
          t:['Protéiné'],
          nu:'La crevette est l\'une des protéines les plus maigres qui soient — l\'huile du wok fait le reste.',
          rec:{
            temps_min:30, portions:3,
            macros:{ p:43, g:69, l:16, kcal:588 },
            ingredients:[
              { em:'🍜', nom:'Nouilles de riz', qte:'250 g sèches (≈ 600 g cuites)', g:600, nu:'vermicelles de riz' },
              { em:'🍤', nom:'Crevettes', qte:'400 g', g:400, nu:'crevettes' },
              { em:'🥚', nom:'Œufs', qte:'2', g:110, nu:'oeuf' },
              { em:'🥜', nom:'Cacahuètes', qte:'60 g', g:60, nu:'cacahuetes' },
              { em:'🌱', nom:'Pousses de soja', qte:'150 g', g:150, nu:'pousses de soja' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🥢', nom:'Sauce poisson', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🍯', nom:'Sucre de palme', qte:'2 c. à soupe', g:25, nu:'sucre' }
            ],
            steps:[
              { illu:'attendre', t:'Trempe les nouilles', duree_min:20,
                detail:'Dans l\'eau TIÈDE, 20 min, jusqu\'à ce qu\'elles soient souples mais encore fermes.',
                qte:[{ nom:'Nouilles de riz', qte:'250 g' }],
                tip:'TIÈDE, PAS BOUILLANTE, et jamais cuites à la casserole : elles finiront dans le wok. Précuites, le pad thaï devient une bouillie.' },
              { illu:'melanger', t:'Prépare la sauce', duree_min:4,
                detail:'Sauce poisson, sucre de palme fondu, tamarin ou jus de citron vert, dans un bol.',
                qte:[{ nom:'Sauce poisson', qte:'3 c. à soupe' }, { nom:'Sucre de palme', qte:'2 c. à soupe' }],
                tip:'TOUT EST PRÊT AVANT D\'ALLUMER : un pad thaï se fait en quatre minutes à feu maximal, il n\'y a pas le temps de doser.' },
              { illu:'saisir', t:'Saisis les crevettes', duree_min:3,
                detail:'Wok brûlant, un peu d\'huile, les crevettes 90 secondes. Réserve.',
                qte:[{ nom:'Crevettes', qte:'400 g' }],
                tip:'À part et brièvement : dans le wok jusqu\'au bout, elles seraient caoutchouteuses.' },
              { illu:'saisir', t:'Brouille les œufs et ajoute les nouilles', duree_min:4,
                detail:'Œufs cassés dans le wok, brouillés grossièrement, puis les nouilles égouttées et la sauce.',
                qte:[{ nom:'Œufs', qte:'2' }, { nom:'Nouilles de riz', qte:'600 g' }],
                tip:'Pousse les œufs sur un côté et verse les nouilles à côté : mélangés trop tôt, ils enrobent tout d\'une pellicule.' },
              { illu:'saisir', t:'Termine', duree_min:3,
                detail:'Remets les crevettes, ajoute les pousses de soja, saute 45 secondes.',
                qte:[{ nom:'Pousses de soja', qte:'150 g' }],
                tip:'LES POUSSES À LA TOUTE FIN : elles doivent rester crues et croquantes, c\'est tout leur intérêt.' },
              { illu:'dresser', t:'Sers', duree_min:2,
                detail:'Cacahuètes concassées, quartiers de citron vert.',
                qte:[{ nom:'Cacahuètes', qte:'60 g' }, { nom:'Citron vert', qte:'2' }],
                tip:'Le citron se presse à table, par chacun : c\'est ce qui règle l\'acidité à son goût.' }
            ]
          } },
        { cle:'thai-pad-thai-poulet', n:'Pad thaï au poulet',
          d:'La même sauce aigre-douce au tamarin, avec du poulet émincé et beaucoup de pousses de soja croquantes.',
          i:'🍜 Nouilles de riz|🍗 Poulet|🥚 Œuf|🥜 Cacahuètes|🌱 Pousses de soja|🧅 Ciboule',
          t:['Protéiné'],
          nu:'Les pousses de soja ajoutées hors du feu gardent leur croquant et allègent la portion de nouilles.',
          rec:{
            temps_min:30, portions:3,
            macros:{ p:56, g:67, l:19, kcal:669 },
            ingredients:[
              { em:'🍜', nom:'Nouilles de riz', qte:'250 g sèches (≈ 600 g cuites)', g:600, nu:'vermicelles de riz' },
              { em:'🍗', nom:'Poulet', qte:'400 g', g:400, nu:'poulet' },
              { em:'🥚', nom:'Œufs', qte:'2', g:110, nu:'oeuf' },
              { em:'🥜', nom:'Cacahuètes', qte:'60 g', g:60, nu:'cacahuetes' },
              { em:'🌱', nom:'Pousses de soja', qte:'150 g', g:150, nu:'pousses de soja' },
              { em:'🧅', nom:'Ciboule', qte:'4 tiges', g:40, nu:'ciboule' },
              { em:'🥢', nom:'Sauce poisson', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🍯', nom:'Sucre de palme', qte:'2 c. à soupe', g:25, nu:'sucre' }
            ],
            steps:[
              { illu:'attendre', t:'Trempe les nouilles', duree_min:20,
                detail:'Eau tiède, 20 min, souples mais fermes.',
                qte:[{ nom:'Nouilles de riz', qte:'250 g' }],
                tip:'Elles doivent plier sans casser et rester un peu crayeuses au cœur : le wok finira le travail.' },
              { illu:'melanger', t:'Prépare la sauce et coupe le poulet', duree_min:6,
                detail:'Sauce poisson, sucre, tamarin ou citron. Poulet en lanières fines.',
                qte:[{ nom:'Poulet', qte:'400 g' }, { nom:'Sauce poisson', qte:'3 c. à soupe' }],
                tip:'Fines : dans un wok, une lanière épaisse est brûlée dehors et crue dedans.' },
              { illu:'saisir', t:'Saisis le poulet', duree_min:4,
                detail:'Wok fumant, en une couche, jusqu\'à coloration. Pousse-le sur le bord.',
                qte:[{ nom:'Poulet', qte:'400 g' }],
                tip:'Poussé sur le bord plutôt que réservé : il continue de tenir chaud pendant que les œufs cuisent.' },
              { illu:'saisir', t:'Œufs puis nouilles', duree_min:4,
                detail:'Œufs brouillés dans l\'espace libre, puis les nouilles et la sauce, saute 2 min.',
                qte:[{ nom:'Œufs', qte:'2' }, { nom:'Nouilles de riz', qte:'600 g' }],
                tip:'Si ça colle, une giclée d\'eau plutôt que de l\'huile : l\'eau décolle sans alourdir.' },
              { illu:'saisir', t:'Finis', duree_min:3,
                detail:'Pousses de soja et ciboule, 45 secondes.',
                qte:[{ nom:'Pousses de soja', qte:'150 g' }, { nom:'Ciboule', qte:'4 tiges' }],
                tip:'Le pad thaï se sert immédiatement : les nouilles de riz durcissent en refroidissant.' },
              { illu:'dresser', t:'Sers', duree_min:2,
                detail:'Cacahuètes concassées par-dessus.',
                qte:[{ nom:'Cacahuètes', qte:'60 g' }],
                tip:'Concassées grossièrement au couteau, pas mixées : on doit sentir les éclats.' }
            ]
          } },
        { cle:'thai-pad-thai-tofu', n:'Pad thaï au tofu',
          d:'La version végétarienne : tofu doré, légumes croquants et la même sauce tamarin sucrée-acide.',
          i:'🍜 Nouilles de riz|🧊 Tofu|🥦 Brocoli|🥕 Carotte|🥜 Cacahuètes|🍋 Citron vert',
          t:['Végétarien','Protéiné'],
          nu:'Tofu et cacahuètes se complètent : c\'est l\'association qui rend ce plat rassasiant.',
          rec:{
            temps_min:30, portions:3,
            macros:{ p:19, g:78, l:15, kcal:506 },
            ingredients:[
              { em:'🍜', nom:'Nouilles de riz', qte:'250 g sèches (≈ 600 g cuites)', g:600, nu:'vermicelles de riz' },
              { em:'🧊', nom:'Tofu', qte:'300 g ferme', g:300, nu:'tofu' },
              { em:'🥦', nom:'Brocoli', qte:'200 g', g:200, nu:'brocoli' },
              { em:'🥕', nom:'Carotte', qte:'150 g', g:150, nu:'carotte' },
              { em:'🥜', nom:'Cacahuètes', qte:'60 g', g:60, nu:'cacahuetes' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🥢', nom:'Sauce soja', qte:'4 c. à soupe', g:60, nu:'sauce soja' },
              { em:'🍯', nom:'Sucre', qte:'2 c. à soupe', g:25, nu:'sucre' }
            ],
            steps:[
              { illu:'attendre', t:'Trempe les nouilles', duree_min:20,
                detail:'Eau tiède, 20 min.',
                qte:[{ nom:'Nouilles de riz', qte:'250 g' }],
                tip:'Pendant ce temps, tout le reste se coupe : c\'est le seul moment calme de la recette.' },
              { illu:'couper', t:'Presse et dore le tofu', duree_min:10,
                detail:'Pressé, coupé en bâtonnets, doré au wok sur toutes les faces. Réserve.',
                qte:[{ nom:'Tofu', qte:'300 g' }],
                tip:'En bâtonnets plutôt qu\'en cubes : ils s\'accrochent aux nouilles au lieu de tomber au fond du plat.' },
              { illu:'saisir', t:'Fais sauter les légumes', duree_min:4,
                detail:'Carotte en julienne et brocoli en petits bouquets, 3 min à feu vif.',
                qte:[{ nom:'Brocoli', qte:'200 g' }, { nom:'Carotte', qte:'150 g' }],
                tip:'Julienne fine pour la carotte : elle doit cuire dans le même temps que le brocoli, qui est plus tendre.' },
              { illu:'saisir', t:'Ajoute nouilles et sauce', duree_min:4,
                detail:'Nouilles égouttées, soja, sucre et jus d\'un citron vert. Saute 2 min.',
                qte:[{ nom:'Nouilles de riz', qte:'600 g' }, { nom:'Sauce soja', qte:'4 c. à soupe' }],
                tip:'Sans sauce poisson, il faut compenser : un peu plus de soja et une pointe de sucre, sinon la version végétarienne est plate.' },
              { illu:'dresser', t:'Réunis et sers', duree_min:3,
                detail:'Remets le tofu, cacahuètes et citron vert.',
                qte:[{ nom:'Tofu', qte:'300 g' }, { nom:'Cacahuètes', qte:'60 g' }, { nom:'Citron vert', qte:'2' }],
                tip:'Le tofu en dernier pour qu\'il garde son croustillant jusqu\'à l\'assiette.' }
            ]
          } },
        { cle:'thai-riz-basilic', n:'Riz sauté au basilic thaï',
          d:'Du riz sauté à feu vif avec de l\'ail, du piment et une grosse poignée de basilic thaï jetée à la fin.',
          i:'🍚 Riz|🌿 Basilic thaï|🧄 Ail|🌶️ Piment|🥚 Œuf|🥢 Sauce soja',
          t:['Épicé','Réconfortant'],
          nu:'Un œuf au plat par-dessus transforme un plat de féculent en repas complet.',
          rec:{
            temps_min:20, portions:2,
            macros:{ p:14, g:47, l:19, kcal:418 },
            ingredients:[
              { em:'🍚', nom:'Riz', qte:'300 g cuit (de la veille)', g:300, nu:'riz' },
              { em:'🌿', nom:'Basilic thaï', qte:'30 g', g:30, nu:'basilic' },
              { em:'🧄', nom:'Ail', qte:'5 gousses', g:20, nu:'ail' },
              { em:'🌶️', nom:'Piments', qte:'3' },
              { em:'🥚', nom:'Œufs', qte:'2', g:110, nu:'oeuf' },
              { em:'🥢', nom:'Sauce soja', qte:'2 c. à soupe', g:30, nu:'sauce soja' },
              { em:'🫒', nom:'Huile', qte:'2 c. à soupe', g:25, nu:'huile' }
            ],
            steps:[
              { illu:'refrigerer', t:'Pars de riz froid', duree_min:1,
                detail:'Riz de la veille, sorti du réfrigérateur et émietté à la main.',
                qte:[{ nom:'Riz', qte:'300 g' }],
                tip:'Même règle absolue que pour tous les riz sautés : chaud, il colle et s\'écrase.' },
              { illu:'couper', t:'Pile ail et piments', duree_min:4,
                detail:'Au mortier ou hachés très fin, ensemble.',
                qte:[{ nom:'Ail', qte:'5 gousses' }],
                tip:'Pilés plutôt que hachés : le mortier libère les huiles et l\'ail devient crémeux au lieu de rester en morceaux.' },
              { illu:'saisir', t:'Fais frire ail et piments', duree_min:2,
                detail:'Wok très chaud, l\'huile, 30 secondes seulement.',
                qte:[{ nom:'Huile', qte:'2 c. à soupe' }],
                tip:'Trente secondes : l\'ail passe du blond au brûlé en un instant, et brûlé il rend tout le plat amer.' },
              { illu:'saisir', t:'Ajoute le riz', duree_min:4,
                detail:'Riz émietté, étalé, laissé une minute sans remuer, puis sauté avec la sauce soja.',
                qte:[{ nom:'Riz', qte:'300 g' }, { nom:'Sauce soja', qte:'2 c. à soupe' }],
                tip:'Cette minute immobile donne les grains grillés du fond, ceux qu\'on cherche dans un riz sauté.' },
              { illu:'saisir', t:'Cuis les œufs au plat', duree_min:4,
                detail:'À part, dans beaucoup d\'huile chaude, jusqu\'à ce que les bords soient dentelés et croustillants.',
                qte:[{ nom:'Œufs', qte:'2' }],
                tip:'L\'ŒUF THAÏ EST FRIT, pas poché : bords dentelés, jaune coulant. C\'est ce contraste qui fait le plat.' },
              { illu:'dresser', t:'Finis au basilic', duree_min:2,
                detail:'Basilic thaï jeté dans le wok hors du feu, riz dans l\'assiette, œuf par-dessus.',
                qte:[{ nom:'Basilic thaï', qte:'30 g' }],
                tip:'Hors du feu : le basilic thaï doit juste tomber, pas cuire.' }
            ]
          } },
        { cle:'thai-tigre-qui-pleure', n:'Tigre qui pleure',
          d:'Une pièce de bœuf grillée saignante, tranchée et arrosée d\'une sauce piment-citron-coriandre.',
          i:'🥩 Bœuf|🍋 Citron vert|🌶️ Piment|🌿 Coriandre|🥢 Sauce soja|🍚 Riz gluant',
          t:['Protéiné','Épicé'],
          nu:'La sauce se fait sans huile : citron, piment et sauce poisson suffisent à porter la viande.',
          rec:{
            temps_min:40, portions:3,
            macros:{ p:50, g:57, l:26, kcal:677 },
            ingredients:[
              { em:'🥩', nom:'Bœuf', qte:'500 g d\'onglet ou bavette', g:500, nu:'boeuf' },
              { em:'🍋', nom:'Citron vert', qte:'3', g:180, nu:'citron vert' },
              { em:'🌶️', nom:'Piments', qte:'3' },
              { em:'🌿', nom:'Coriandre', qte:'30 g', g:30, nu:'coriandre' },
              { em:'🥢', nom:'Sauce poisson', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🍚', nom:'Riz gluant', qte:'200 g cru (≈ 480 g cuit)', g:480, nu:'riz' },
              { em:'🍯', nom:'Sucre', qte:'1 c. à soupe', g:12, nu:'sucre' },
              { em:'🌾', nom:'Riz grillé', qte:'2 c. à soupe', g:20, nu:'riz' }
            ],
            steps:[
              { illu:'attendre', t:'Trempe le riz gluant', duree_min:240,
                detail:'Quatre heures minimum dans l\'eau froide, puis cuit 25 min à la vapeur dans un linge.',
                qte:[{ nom:'Riz gluant', qte:'200 g' }],
                tip:'LE RIZ GLUANT NE SE CUIT PAS À L\'EAU. Trempé puis cuit à la vapeur : c\'est la seule méthode, et elle demande de s\'y prendre à l\'avance.' },
              { illu:'saisir', t:'Grille la viande', duree_min:8,
                detail:'Poêle-gril ou barbecue brûlant, 3 min par face pour un cœur bien rosé. Sale à la fin.',
                qte:[{ nom:'Bœuf', qte:'500 g' }],
                tip:'SAIGNANTE, c\'est la règle : le nam tok se mange rosé, et une viande trop cuite ne rendra pas le jus qui fait la sauce.' },
              { illu:'reposer', t:'Laisse reposer', duree_min:8,
                detail:'Huit minutes sur une planche à rigole, pour récupérer le jus.',
                tip:'GARDE LE JUS : il entre dans la sauce. C\'est de là que vient le nom — les larmes du tigre.' },
              { illu:'melanger', t:'Fais la sauce', duree_min:4,
                detail:'Jus des citrons verts, sauce poisson, sucre, piments pilés, le jus de la viande.',
                qte:[{ nom:'Citron vert', qte:'3' }, { nom:'Sauce poisson', qte:'3 c. à soupe' }],
                tip:'Goûte : ça doit piquer, être franchement acide et à peine sucré. Un nam tok timide n\'a aucun intérêt.' },
              { illu:'saisir', t:'Prépare le riz grillé', duree_min:4,
                detail:'Riz cru grillé à sec jusqu\'à ce qu\'il brunisse, puis pilé en poudre grossière.',
                qte:[{ nom:'Riz grillé', qte:'2 c. à soupe' }],
                tip:'LE KHAO KHUA est ce qui donne au nam tok son goût de noisette et sa texture. Sans lui, il manque l\'essentiel.' },
              { illu:'dresser', t:'Dresse', duree_min:3,
                detail:'Bœuf tranché fin en travers des fibres, sauce versée dessus, coriandre et poudre de riz grillé.',
                qte:[{ nom:'Coriandre', qte:'30 g' }],
                tip:'Tranché EN TRAVERS DES FIBRES : sur un onglet, c\'est la différence entre tendre et impossible à mâcher.' }
            ]
          } },
        { cle:'thai-soupe-porc-caramelise', n:'Soupe thaïe au porc caramélisé',
          d:'Un bouillon au curry et au coco, nouilles moelleuses, porc caramélisé et nouilles frites par-dessus.',
          i:'🍜 Nouilles|🐖 Porc|🥥 Lait de coco|🌶️ Pâte de curry|🧅 Oignon rouge|🍋 Citron vert',
          t:['Réconfortant','Épicé'],
          nu:'Les nouilles frites du dessus sont un décor : elles ajoutent surtout du gras, elles se dosent.',
          rec:{
            temps_min:45, portions:4,
            macros:{ p:45, g:57, l:34, kcal:728 },
            ingredients:[
              { em:'🍜', nom:'Nouilles', qte:'250 g sèches (≈ 600 g cuites)', g:600, nu:'nouilles' },
              { em:'🐖', nom:'Porc', qte:'500 g d\'échine', g:500, nu:'porc' },
              { em:'🥥', nom:'Lait de coco', qte:'300 ml', g:300, nu:'lait de coco' },
              { em:'🌶️', nom:'Pâte de curry', qte:'2 c. à soupe', g:30, nu:'pate de curry' },
              { em:'🧅', nom:'Oignon rouge', qte:'150 g', g:150, nu:'oignon' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🍯', nom:'Sucre de palme', qte:'2 c. à soupe', g:25, nu:'sucre' },
              { em:'🥢', nom:'Sauce poisson', qte:'3 c. à soupe', g:45, nu:'sauce soja' }
            ],
            steps:[
              { illu:'couper', t:'Coupe le porc', duree_min:6,
                detail:'En lanières épaisses de 1,5 cm.',
                qte:[{ nom:'Porc', qte:'500 g' }],
                tip:'De l\'échine, pas du filet : il faut un peu de gras pour supporter la caramélisation sans sécher.' },
              { illu:'saisir', t:'Caramélise-le', duree_min:12,
                detail:'Poêle chaude, le sucre de palme fondu, le porc dedans, jusqu\'à ce qu\'il soit brun et laqué.',
                qte:[{ nom:'Porc', qte:'500 g' }, { nom:'Sucre de palme', qte:'2 c. à soupe' }],
                tip:'LAISSE LE SUCRE FONCER AVANT D\'AJOUTER LA VIANDE : un caramel blond n\'a pas de goût, il lui faut la couleur de l\'ambre.' },
              { illu:'saisir', t:'Fais frire la pâte de curry', duree_min:4,
                detail:'Oignon rouge, puis la pâte de curry deux minutes dans le gras.',
                qte:[{ nom:'Pâte de curry', qte:'2 c. à soupe' }, { nom:'Oignon rouge', qte:'150 g' }],
                tip:'Toujours la même règle : la pâte frit dans le gras avant tout liquide.' },
              { illu:'mijoter', t:'Ajoute le lait de coco et l\'eau', duree_min:15,
                detail:'Lait de coco, 600 ml d\'eau, sauce poisson. Quinze minutes à frémissement.',
                qte:[{ nom:'Lait de coco', qte:'300 ml' }, { nom:'Sauce poisson', qte:'3 c. à soupe' }],
                tip:'À frémissement : le lait de coco tranche dès qu\'il bout franchement.' },
              { illu:'bouillir', t:'Cuis les nouilles à part', duree_min:6,
                detail:'Dans une autre casserole, puis rincées.',
                qte:[{ nom:'Nouilles', qte:'250 g' }],
                tip:'À part, sinon leur amidon épaissit le bouillon et le rend pâteux.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Nouilles dans les bols, bouillon et porc dessus, citron vert et coriandre.',
                qte:[{ nom:'Citron vert', qte:'2' }],
                tip:'Le citron pressé à table : c\'est lui qui coupe le sucré du caramel et la richesse de la coco.' }
            ]
          } }
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
          nu:'Servi tiède ou froid, ce plat de légumes se mange seul — il n\'a pas besoin d\'accompagnement.',
          rec:{
            temps_min:80, portions:4,
            macros:{ p:5, g:30, l:26, kcal:352 },
            ingredients:[
              { em:'🍆', nom:'Aubergines', qte:'4 longues (900 g)', g:900, nu:'aubergine' },
              { em:'🍅', nom:'Tomates', qte:'400 g', g:400, nu:'tomate' },
              { em:'🧅', nom:'Oignons', qte:'400 g', g:400, nu:'oignon' },
              { em:'🧄', nom:'Ail', qte:'6 gousses', g:24, nu:'ail' },
              { em:'🫒', nom:'Huile d\'olive', qte:'8 c. à soupe', g:100, nu:'huile olive' },
              { em:'🌿', nom:'Persil', qte:'30 g', g:30, nu:'persil' },
              { em:'🍯', nom:'Sucre', qte:'1 c. à café', g:5, nu:'sucre' }
            ],
            steps:[
              { illu:'couper', t:'Prépare les aubergines', duree_min:12,
                detail:'Épluchées en bandes, fendues en deux dans la longueur sans séparer, salées et laissées 10 min.',
                qte:[{ nom:'Aubergines', qte:'900 g' }],
                tip:'Fendues mais pas coupées : elles s\'ouvrent comme un livre pour recevoir la farce et se referment dessus.' },
              { illu:'saisir', t:'Fais-les revenir', duree_min:12,
                detail:'Épongées, à l\'huile d\'olive, sur toutes les faces, jusqu\'à ce qu\'elles s\'assouplissent. Réserve.',
                qte:[{ nom:'Aubergines', qte:'900 g' }, { nom:'Huile d\'olive', qte:'6 c. à soupe' }],
                tip:'HUIT CUILLÈRES D\'HUILE, et c\'est le nom du plat : « l\'imam s\'évanouit », dit-on, en découvrant combien il en fallait.' },
              { illu:'saisir', t:'Fais la farce', duree_min:15,
                detail:'Oignons en lamelles fondus longuement, l\'ail, puis les tomates concassées, le sucre, le persil. Quinze minutes.',
                qte:[{ nom:'Oignons', qte:'400 g' }, { nom:'Tomates', qte:'400 g' }, { nom:'Persil', qte:'30 g' }],
                tip:'Les oignons doivent être VRAIMENT fondus et sucrés : c\'est la farce entière, il n\'y a rien d\'autre.' },
              { illu:'melanger', t:'Farcis', duree_min:8,
                detail:'Ouvre les aubergines, garnis généreusement, serre-les dans un plat.',
                qte:[{ nom:'Aubergines', qte:'900 g' }],
                tip:'Serrées les unes contre les autres : c\'est ce qui les empêche de s\'ouvrir et de perdre leur farce au four.' },
              { illu:'enfourner', t:'Cuis doucement', duree_min:40,
                detail:'Un verre d\'eau et le reste d\'huile au fond, couvert, 40 min à 170 °C.',
                tip:'À couvert et à basse température : on confit, on ne rôtit pas. L\'aubergine doit être fondante d\'un bout à l\'autre.' },
              { illu:'reposer', t:'Laisse refroidir', duree_min:30,
                detail:'L\'imam bayıldı se mange TIÈDE ou froid, jamais chaud.',
                tip:'C\'est un plat d\'huile d\'olive : froid, l\'huile se fige un peu et le plat prend toute sa texture.' }
            ]
          } },
        { cle:'tur-kisir', n:'Kısır',
          d:'Une salade de boulgour fin travaillée au concentré de tomate et à la mélasse de grenade, avec des herbes.',
          i:'🌾 Boulgour|🍅 Concentré de tomate|🌿 Persil|🧅 Ciboule|🍋 Citron|🥒 Concombre',
          t:['Végétarien','Riche en fibres'],
          nu:'Le boulgour complet a un index glycémique bas : cette salade tient plus longtemps qu\'une semoule.',
          rec:{
            temps_min:40, portions:4,
            macros:{ p:7, g:41, l:16, kcal:316 },
            ingredients:[
              { em:'🌾', nom:'Boulgour', qte:'250 g fin (≈ 700 g gonflé)', g:700, nu:'boulgour' },
              { em:'🍅', nom:'Concentré de tomate', qte:'3 c. à soupe', g:50, nu:'concentre de tomate' },
              { em:'🌿', nom:'Persil', qte:'80 g', g:80, nu:'persil' },
              { em:'🧅', nom:'Ciboule', qte:'6 tiges', g:60, nu:'ciboule' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🥒', nom:'Concombre', qte:'200 g', g:200, nu:'concombre' },
              { em:'🫒', nom:'Huile d\'olive', qte:'5 c. à soupe', g:60, nu:'huile olive' }
            ],
            steps:[
              { illu:'attendre', t:'Gonfle le boulgour', duree_min:25,
                detail:'Boulgour fin couvert d\'eau BOUILLANTE à hauteur, couvert d\'un linge, 20 à 25 min.',
                qte:[{ nom:'Boulgour', qte:'250 g' }],
                tip:'Eau bouillante et juste à hauteur : trop d\'eau et le boulgour est détrempé, pas assez et il croque.' },
              { illu:'melanger', t:'Ajoute le concentré', duree_min:5,
                detail:'Concentré de tomate et un peu de piment doux malaxés dans le boulgour tiède, à la main.',
                qte:[{ nom:'Concentré de tomate', qte:'3 c. à soupe' }],
                tip:'À LA MAIN ET TIÈDE : c\'est le seul moyen de répartir le concentré uniformément. Froid, il fait des paquets.' },
              { illu:'couper', t:'Hache les herbes et légumes', duree_min:10,
                detail:'Persil finement, ciboule en rondelles, concombre en petits dés.',
                qte:[{ nom:'Persil', qte:'80 g' }, { nom:'Ciboule', qte:'6 tiges' }, { nom:'Concombre', qte:'200 g' }],
                tip:'Beaucoup de persil : le kısır est à mi-chemin entre le taboulé et la salade de boulgour, il lui faut du vert.' },
              { illu:'melanger', t:'Assemble', duree_min:5,
                detail:'Tout ensemble avec le jus des citrons, l\'huile d\'olive, sel et poivre.',
                qte:[{ nom:'Citron', qte:'2' }, { nom:'Huile d\'olive', qte:'5 c. à soupe' }],
                tip:'Goûte et pousse le citron : le kısır doit être franchement acidulé, sinon le concentré de tomate le rend lourd.' },
              { illu:'refrigerer', t:'Laisse reposer', duree_min:20,
                detail:'Vingt minutes au frais avant de servir.',
                tip:'Se mange à la main, roulé dans des feuilles de laitue : c\'est ainsi qu\'on le sert en Turquie.' }
            ]
          } },
        { cle:'tur-manti', n:'Mantı',
          d:'De minuscules raviolis à la viande, noyés sous du yaourt à l\'ail et un beurre au paprika.',
          i:'🥟 Pâte à raviolis|🥩 Viande hachée|🥛 Yaourt|🧄 Ail|🌶️ Paprika|🌿 Menthe',
          t:['Réconfortant','Protéiné'],
          nu:'Le yaourt à l\'ail est ce qui distingue ce plat : de la sauce, sans crème et avec des protéines.',
          rec:{
            temps_min:100, portions:4,
            macros:{ p:34, g:55, l:30, kcal:631 },
            ingredients:[
              { em:'🥟', nom:'Pâte à raviolis', qte:'350 g', g:350, nu:'pate a pizza' },
              { em:'🥩', nom:'Viande hachée', qte:'350 g d\'agneau ou bœuf', g:350, nu:'boeuf hache' },
              { em:'🥛', nom:'Yaourt', qte:'400 g', g:400, nu:'yaourt' },
              { em:'🧄', nom:'Ail', qte:'4 gousses', g:16, nu:'ail' },
              { em:'🌶️', nom:'Paprika', qte:'2 c. à café', g:8, nu:'paprika' },
              { em:'🌿', nom:'Menthe séchée', qte:'1 c. à soupe', g:5, nu:'menthe' },
              { em:'🧅', nom:'Oignon', qte:'150 g', g:150, nu:'oignon' },
              { em:'🧈', nom:'Beurre', qte:'50 g', g:50, nu:'beurre' }
            ],
            steps:[
              { illu:'melanger', t:'Prépare la farce', duree_min:8,
                detail:'Viande, oignon râpé très fin, sel, poivre. Malaxe bien.',
                qte:[{ nom:'Viande hachée', qte:'350 g' }, { nom:'Oignon', qte:'150 g' }],
                tip:'Oignon RÂPÉ et non haché : son jus mouille la farce, et une farce sèche dans un manti est immangeable.' },
              { illu:'couper', t:'Découpe la pâte', duree_min:15,
                detail:'Étalée très finement, coupée en carrés de 3 cm.',
                qte:[{ nom:'Pâte à raviolis', qte:'350 g' }],
                tip:'TRÈS PETITS, c\'est la fierté du manti : traditionnellement, quarante doivent tenir dans une cuillère. Vise au moins des carrés de 3 cm.' },
              { illu:'melanger', t:'Farcis', duree_min:30,
                detail:'Une pointe de farce au centre, remonte les quatre coins et pince-les ensemble.',
                tip:'Une POINTE, pas une cuillère : trop garnis, ils s\'ouvrent à la cuisson et la farce part dans l\'eau.' },
              { illu:'melanger', t:'Prépare la sauce au yaourt', duree_min:4,
                detail:'Yaourt battu avec l\'ail écrasé et du sel, à température ambiante.',
                qte:[{ nom:'Yaourt', qte:'400 g' }, { nom:'Ail', qte:'4 gousses' }],
                tip:'À température ambiante : un yaourt sorti du frigo refroidit les manti instantanément.' },
              { illu:'saisir', t:'Fais le beurre au paprika', duree_min:3,
                detail:'Beurre fondu, paprika et menthe séchée hors du feu.',
                qte:[{ nom:'Beurre', qte:'50 g' }, { nom:'Paprika', qte:'2 c. à café' }],
                tip:'Hors du feu pour le paprika : sur la flamme il noircit en dix secondes et devient amer.' },
              { illu:'bouillir', t:'Cuis et dresse', duree_min:12,
                detail:'8 à 10 min dans l\'eau bouillante salée, égouttés, nappés de yaourt puis du beurre rouge.',
                tip:'Yaourt D\'ABORD, beurre ensuite : c\'est le contraste des deux, froid et chaud, qui fait le manti.' }
            ]
          } },
        { cle:'tur-menemen', n:'Menemen',
          d:'Des œufs brouillés dans une poêlée de tomates et de poivrons, à saucer avec du pain — matin ou soir.',
          i:'🥚 Œufs|🍅 Tomate|🫑 Poivron|🧅 Oignon|🫒 Huile d\'olive|🥖 Pain',
          t:['Végétarien','Protéiné'],
          nu:'Deux œufs, c\'est une douzaine de grammes de protéines : de quoi faire un vrai petit déjeuner salé.',
          rec:{
            temps_min:25, portions:2,
            macros:{ p:28, g:57, l:36, kcal:654 },
            ingredients:[
              { em:'🥚', nom:'Œufs', qte:'5', g:275, nu:'oeuf' },
              { em:'🍅', nom:'Tomates', qte:'400 g', g:400, nu:'tomate' },
              { em:'🫑', nom:'Poivrons', qte:'200 g (verts, doux)', g:200, nu:'poivron' },
              { em:'🧅', nom:'Oignon', qte:'100 g', g:100, nu:'oignon' },
              { em:'🫒', nom:'Huile d\'olive', qte:'3 c. à soupe', g:35, nu:'huile olive' },
              { em:'🥖', nom:'Pain', qte:'150 g', g:150, nu:'pain' }
            ],
            steps:[
              { illu:'couper', t:'Coupe les légumes', duree_min:6,
                detail:'Poivrons en lanières fines, tomates pelées et concassées, oignon émincé.',
                qte:[{ nom:'Poivrons', qte:'200 g' }, { nom:'Tomates', qte:'400 g' }],
                tip:'PÈLE LES TOMATES : leur peau se détache à la cuisson et fait des rubans désagréables dans les œufs.' },
              { illu:'saisir', t:'Fais fondre poivrons et oignon', duree_min:8,
                detail:'Huile d\'olive, feu moyen, jusqu\'à ce qu\'ils soient tendres.',
                qte:[{ nom:'Huile d\'olive', qte:'3 c. à soupe' }, { nom:'Oignon', qte:'100 g' }],
                tip:'Le poivron vert turc est doux et fin ; à défaut, un poivron classique coupé très fin fera l\'affaire.' },
              { illu:'mijoter', t:'Ajoute les tomates', duree_min:8,
                detail:'Sale et laisse réduire jusqu\'à ce que ce soit une compote épaisse.',
                qte:[{ nom:'Tomates', qte:'400 g' }],
                tip:'ÉPAISSE, vraiment : de l\'eau de tomate et les œufs ne prendront jamais, on obtient une soupe.' },
              { illu:'melanger', t:'Casse les œufs dedans', duree_min:4,
                detail:'Directement dans la poêle, remue lentement à la spatule, et retire du feu quand ils sont encore baveux.',
                qte:[{ nom:'Œufs', qte:'5' }],
                tip:'ENCORE BAVEUX : la chaleur de la poêle finit la cuisson pendant qu\'on porte le plat à table.' },
              { illu:'dresser', t:'Sers dans la poêle', duree_min:2,
                detail:'Avec beaucoup de pain pour saucer.',
                qte:[{ nom:'Pain', qte:'150 g' }],
                tip:'Le menemen se sert dans sa poêle, au centre de la table : c\'est un petit-déjeuner qu\'on partage.' }
            ]
          } },
        { cle:'tur-mercimek-corbasi', n:'Mercimek çorbası',
          d:'La soupe de lentilles corail qu\'on sert partout en Turquie, lissée au mixeur et relevée au citron.',
          i:'🫘 Lentilles corail|🥕 Carotte|🧅 Oignon|🥔 Pomme de terre|🌶️ Paprika|🍋 Citron',
          t:['Végétarien','Riche en fibres','Réconfortant'],
          nu:'Une soupe qui apporte des protéines : c\'est rare, et c\'est la lentille qui le permet.',
          rec:{
            temps_min:45, portions:4,
            macros:{ p:16, g:51, l:9, kcal:335 },
            ingredients:[
              { em:'🫘', nom:'Lentilles corail', qte:'250 g crues (≈ 600 g cuites)', g:600, nu:'lentilles' },
              { em:'🥕', nom:'Carotte', qte:'150 g', g:150, nu:'carotte' },
              { em:'🧅', nom:'Oignon', qte:'200 g', g:200, nu:'oignon' },
              { em:'🥔', nom:'Pomme de terre', qte:'200 g', g:200, nu:'pomme de terre' },
              { em:'🌶️', nom:'Paprika', qte:'2 c. à café', g:8, nu:'paprika' },
              { em:'🍋', nom:'Citron', qte:'2', g:120, nu:'citron' },
              { em:'🧈', nom:'Beurre', qte:'40 g', g:40, nu:'beurre' },
              { em:'🌿', nom:'Menthe séchée', qte:'1 c. à soupe', g:5, nu:'menthe' }
            ],
            steps:[
              { illu:'saisir', t:'Fais revenir les légumes', duree_min:8,
                detail:'Oignon, carotte et pomme de terre en dés, dans un peu de beurre, cinq minutes.',
                qte:[{ nom:'Oignon', qte:'200 g' }, { nom:'Carotte', qte:'150 g' }, { nom:'Pomme de terre', qte:'200 g' }],
                tip:'La pomme de terre remplace la crème : c\'est elle qui donne le velouté sans rien ajouter.' },
              { illu:'mijoter', t:'Ajoute les lentilles', duree_min:25,
                detail:'Rincées, avec 1,2 l d\'eau, 25 min jusqu\'à ce que tout se défasse.',
                qte:[{ nom:'Lentilles corail', qte:'250 g' }],
                tip:'Les lentilles corail se délitent complètement : c\'est le but, la soupe doit être lisse.' },
              { illu:'mixer', t:'Mixe', duree_min:4,
                detail:'Jusqu\'à obtenir un velouté parfaitement lisse. Allonge à l\'eau chaude si c\'est trop épais.',
                tip:'Vraiment lisse : la mercimek çorbası est la soupe la plus servie de Turquie, et elle est toujours veloutée.' },
              { illu:'saisir', t:'Fais le beurre au paprika', duree_min:3,
                detail:'Beurre fondu, paprika et menthe séchée hors du feu.',
                qte:[{ nom:'Beurre', qte:'40 g' }, { nom:'Paprika', qte:'2 c. à café' }],
                tip:'C\'est la garniture obligatoire : un filet de beurre rouge versé sur la soupe jaune, au moment de servir.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Beurre rouge en filet, quartiers de citron à part.',
                qte:[{ nom:'Citron', qte:'2' }],
                tip:'LE CITRON EST INDISPENSABLE, pressé par chacun dans son bol : sans lui, la soupe est plate.' }
            ]
          } },
        { cle:'tur-pide-legumes', n:'Pide aux légumes',
          d:'La « barque » de pâte turque garnie de légumes rôtis et de fromage, cuite jusqu\'à ce que les bords croustillent.',
          i:'🥖 Pâte à pide|🫑 Poivron|🍆 Aubergine|🍅 Tomate|🧀 Feta|🌿 Persil',
          t:['Végétarien','Réconfortant'],
          nu:'Sa pâte est plus fine qu\'une pizza : même plaisir, une bonne part de féculent en moins.',
          rec:{
            temps_min:75, portions:3,
            macros:{ p:25, g:85, l:32, kcal:732 },
            ingredients:[
              { em:'🥖', nom:'Pâte à pide', qte:'400 g', g:400, nu:'pate a pizza' },
              { em:'🫑', nom:'Poivrons', qte:'250 g', g:250, nu:'poivron' },
              { em:'🍆', nom:'Aubergine', qte:'250 g', g:250, nu:'aubergine' },
              { em:'🍅', nom:'Tomates', qte:'250 g', g:250, nu:'tomate' },
              { em:'🧀', nom:'Feta', qte:'200 g', g:200, nu:'feta' },
              { em:'🌿', nom:'Persil', qte:'25 g', g:25, nu:'persil' },
              { em:'🫒', nom:'Huile d\'olive', qte:'3 c. à soupe', g:35, nu:'huile olive' },
              { em:'🥚', nom:'Œuf', qte:'1 (dorure)', g:55, nu:'oeuf' }
            ],
            steps:[
              { illu:'couper', t:'Coupe les légumes en dés', duree_min:8,
                detail:'Poivrons, aubergine et tomates en dés d\'un centimètre.',
                qte:[{ nom:'Poivrons', qte:'250 g' }, { nom:'Aubergine', qte:'250 g' }, { nom:'Tomates', qte:'250 g' }],
                tip:'Petits dés : sur une pide, un gros morceau de légume roule et tombe à la première bouchée.' },
              { illu:'saisir', t:'Fais-les revenir', duree_min:12,
                detail:'Huile d\'olive, feu vif, jusqu\'à ce qu\'ils soient tendres et que leur eau soit évaporée. Sale.',
                qte:[{ nom:'Huile d\'olive', qte:'3 c. à soupe' }],
                tip:'L\'EAU DOIT PARTIR AVANT LE FOUR : des légumes crus sur une pâte, c\'est un fond détrempé garanti.' },
              { illu:'melanger', t:'Étale la pâte en barque', duree_min:10,
                detail:'Étale en ovale allongé, garnis le centre, replie les bords sur 2 cm et pince les deux pointes.',
                qte:[{ nom:'Pâte à pide', qte:'400 g' }],
                tip:'LES POINTES PINCÉES ferment la barque : sans elles, la garniture s\'échappe par les extrémités.' },
              { illu:'melanger', t:'Garnis', duree_min:5,
                detail:'Légumes au centre, feta émiettée par-dessus. Badigeonne les bords d\'œuf battu.',
                qte:[{ nom:'Feta', qte:'200 g' }, { nom:'Œuf', qte:'1' }],
                tip:'La dorure à l\'œuf n\'est pas cosmétique : c\'est elle qui donne la croûte brillante et souple des pide.' },
              { illu:'enfourner', t:'Enfourne très chaud', duree_min:15,
                detail:'240 °C, sur une plaque brûlante ou une pierre, 12 à 15 min.',
                tip:'LE PLUS CHAUD POSSIBLE : la pide cuit vite et fort, comme une pizza. À 180 °C, la pâte sèche avant de gonfler.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Persil frais, coupée en tronçons aux ciseaux.',
                qte:[{ nom:'Persil', qte:'25 g' }],
                tip:'Aux ciseaux et en travers : c\'est ainsi qu\'elle se partage en Turquie.' }
            ]
          } }
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
          nu:'Les légumes marinés remplacent la sauce : un sandwich qui n\'a besoin ni de beurre ni de mayonnaise.',
          rec:{
            temps_min:40, portions:2,
            macros:{ p:58, g:80, l:7, kcal:625 },
            ingredients:[
              { em:'🥖', nom:'Baguette', qte:'2 petites (200 g)', g:200, nu:'baguette' },
              { em:'🍗', nom:'Poulet', qte:'300 g', g:300, nu:'poulet' },
              { em:'🥕', nom:'Carotte', qte:'150 g', g:150, nu:'carotte' },
              { em:'🥒', nom:'Concombre', qte:'150 g', g:150, nu:'concombre' },
              { em:'🌿', nom:'Coriandre', qte:'25 g', g:25, nu:'coriandre' },
              { em:'🌶️', nom:'Piment', qte:'1' },
              { em:'🥢', nom:'Sauce soja', qte:'2 c. à soupe', g:30, nu:'sauce soja' },
              { em:'🍯', nom:'Sucre', qte:'2 c. à soupe', g:25, nu:'sucre' }
            ],
            steps:[
              { illu:'melanger', t:'Fais les pickles de carotte', duree_min:30,
                detail:'Carotte en julienne, deux cuillères de sucre, autant de vinaigre, une pincée de sel. Trente minutes.',
                qte:[{ nom:'Carotte', qte:'150 g' }, { nom:'Sucre', qte:'2 c. à soupe' }],
                tip:'LES PICKLES SONT LE CŒUR DU BÁNH MÌ. Sans eux, c\'est un sandwich au poulet : c\'est leur acidité qui tient tout l\'édifice.' },
              { illu:'assaisonner', t:'Fais mariner le poulet', duree_min:10,
                detail:'Lanières, sauce soja, un peu de sucre, ail, poivre. Dix minutes.',
                qte:[{ nom:'Poulet', qte:'300 g' }, { nom:'Sauce soja', qte:'2 c. à soupe' }],
                tip:'Une marinade courte suffit sur des lanières fines : elles n\'ont qu\'un demi-centimètre à traverser.' },
              { illu:'saisir', t:'Cuis le poulet', duree_min:8,
                detail:'Poêle très chaude, en une couche, jusqu\'à ce qu\'il soit doré et légèrement caramélisé.',
                qte:[{ nom:'Poulet', qte:'300 g' }],
                tip:'La caramélisation est recherchée : le sucre de la marinade doit brunir sans brûler.' },
              { illu:'saisir', t:'Réchauffe le pain', duree_min:5,
                detail:'Cinq minutes à 200 °C : la croûte doit craquer et l\'intérieur rester moelleux.',
                qte:[{ nom:'Baguette', qte:'200 g' }],
                tip:'UNE BAGUETTE FINE ET LÉGÈRE, à mie très aérée. Une baguette dense écrase la garniture et le sandwich devient lourd.' },
              { illu:'dresser', t:'Monte le bánh mì', duree_min:5,
                detail:'Fendu, mayonnaise ou pâté sur une face, poulet, pickles égouttés, concombre, coriandre, piment.',
                qte:[{ nom:'Concombre', qte:'150 g' }, { nom:'Coriandre', qte:'25 g' }],
                tip:'ÉGOUTTE LES PICKLES : leur jus détremperait le pain en deux minutes. On les presse dans la main avant de les poser.' }
            ]
          } },
        { cle:'viet-poisson-vapeur', n:'Poisson vapeur au gingembre',
          d:'Un filet de poisson blanc cuit à la vapeur avec du gingembre et de la ciboule, arrosé de sauce soja chaude.',
          i:'🐟 Poisson blanc|🫚 Gingembre|🧅 Ciboule|🥢 Sauce soja|🍚 Riz|🌿 Coriandre',
          t:['Protéiné','Léger'],
          nu:'La vapeur ne demande aucune matière grasse : c\'est la cuisson la plus sobre pour un poisson.',
          rec:{
            temps_min:30, portions:2,
            macros:{ p:40, g:61, l:20, kcal:590 },
            ingredients:[
              { em:'🐟', nom:'Poisson blanc', qte:'2 filets (350 g)', g:350, nu:'cabillaud' },
              { em:'🫚', nom:'Gingembre', qte:'40 g', g:40, nu:'gingembre' },
              { em:'🧅', nom:'Ciboule', qte:'5 tiges', g:50, nu:'ciboule' },
              { em:'🥢', nom:'Sauce soja', qte:'3 c. à soupe', g:45, nu:'sauce soja' },
              { em:'🍚', nom:'Riz', qte:'150 g cru (≈ 390 g cuit)', g:390, nu:'riz' },
              { em:'🌿', nom:'Coriandre', qte:'20 g', g:20, nu:'coriandre' },
              { em:'🫒', nom:'Huile', qte:'3 c. à soupe', g:35, nu:'huile' }
            ],
            steps:[
              { illu:'bouillir', t:'Lance le riz', duree_min:15,
                detail:'Rincé, une part et demie d\'eau, 11 min à couvert.',
                qte:[{ nom:'Riz', qte:'150 g' }],
                tip:'Le poisson cuit en huit minutes : le riz doit partir bien avant.' },
              { illu:'couper', t:'Prépare les aromates', duree_min:6,
                detail:'Gingembre en julienne très fine, ciboule séparée en blancs et verts, tous coupés en fins bâtonnets.',
                qte:[{ nom:'Gingembre', qte:'40 g' }, { nom:'Ciboule', qte:'5 tiges' }],
                tip:'En JULIENNE FINE : le gingembre en rondelles épaisses reste piquant et fibreux, en fils il fond.' },
              { illu:'bouillir', t:'Cuis le poisson à la vapeur', duree_min:9,
                detail:'Filets dans une assiette creuse, la moitié du gingembre et les blancs de ciboule dessus, 8 min au-dessus de l\'eau bouillante.',
                qte:[{ nom:'Poisson blanc', qte:'350 g' }],
                tip:'DANS UNE ASSIETTE, pas directement sur le panier : le jus qui s\'écoule est délicieux, on ne veut pas le perdre dans l\'eau.' },
              { illu:'assaisonner', t:'Verse la sauce', duree_min:2,
                detail:'Jette l\'eau rendue si elle est trouble, verse la sauce soja chaude sur le poisson.',
                qte:[{ nom:'Sauce soja', qte:'3 c. à soupe' }],
                tip:'L\'eau rendue par le poisson est parfois amère : la retirer est un geste de restaurant qui change le résultat.' },
              { illu:'saisir', t:'Fais l\'huile brûlante', duree_min:3,
                detail:'Reste de gingembre et verts de ciboule sur le poisson, puis l\'huile fumante versée dessus : ça grésille.',
                qte:[{ nom:'Huile', qte:'3 c. à soupe' }],
                tip:'L\'HUILE FUMANTE EST LE GESTE FINAL. Elle cuit les aromates en une seconde et libère tout leur parfum — sans elle, ils restent crus et âcres.' },
              { illu:'dresser', t:'Sers', duree_min:2,
                detail:'Coriandre, avec le riz.',
                qte:[{ nom:'Coriandre', qte:'20 g' }],
                tip:'Verse le jus de l\'assiette sur le riz : c\'est la meilleure sauce du repas.' }
            ]
          } },
        { cle:'viet-pho-bo', n:'Phở bò',
          d:'Le bouillon de bœuf mijoté des heures aux épices, versé brûlant sur des nouilles de riz et du bœuf cru.',
          i:'🍜 Nouilles de riz|🥩 Bœuf|🥢 Bouillon|🌿 Coriandre|🌱 Pousses de soja|🍋 Citron vert',
          t:['Protéiné','Réconfortant'],
          nu:'Le bœuf cuit dans le bol, au contact du bouillon : rien n\'est frit, rien n\'est saisi à l\'huile.',
          rec:{
            temps_min:180, portions:4,
            macros:{ p:50, g:62, l:25, kcal:684 },
            ingredients:[
              { em:'🍜', nom:'Nouilles de riz', qte:'300 g sèches (≈ 720 g cuites)', g:720, nu:'vermicelles de riz' },
              { em:'🥩', nom:'Bœuf', qte:'400 g de gîte + 200 g de filet cru', g:600, nu:'boeuf' },
              { em:'🥢', nom:'Bouillon', qte:'2,5 l', g:2500, nu:'bouillon' },
              { em:'🌿', nom:'Coriandre', qte:'30 g', g:30, nu:'coriandre' },
              { em:'🌱', nom:'Pousses de soja', qte:'200 g', g:200, nu:'pousses de soja' },
              { em:'🍋', nom:'Citron vert', qte:'2', g:120, nu:'citron vert' },
              { em:'🫚', nom:'Gingembre', qte:'60 g', g:60, nu:'gingembre' },
              { em:'🧅', nom:'Oignon', qte:'250 g', g:250, nu:'oignon' }
            ],
            steps:[
              { illu:'saisir', t:'Brûle oignon et gingembre', duree_min:10,
                detail:'Coupés en deux, posés face coupée sur une poêle sèche brûlante ou sous le gril, jusqu\'à ce qu\'ils soient noircis.',
                qte:[{ nom:'Oignon', qte:'250 g' }, { nom:'Gingembre', qte:'60 g' }],
                tip:'NOIRCIS, PAS DORÉS. C\'est ce brûlé qui donne au phở sa profondeur et sa couleur ambrée. Sans lui, le bouillon reste plat.' },
              { illu:'bouillir', t:'Blanchis les os et la viande', duree_min:10,
                detail:'Couverts d\'eau froide, portés à ébullition 5 min, puis jetés dans une passoire et rincés.',
                qte:[{ nom:'Bœuf', qte:'400 g' }],
                tip:'Ce premier bouillon est jeté : il emporte toutes les impuretés. C\'est ce qui rend le phở LIMPIDE.' },
              { illu:'mijoter', t:'Fais le bouillon', duree_min:150,
                detail:'Viande rincée, aromates brûlés, badiane, cannelle, clou de girofle, 2,5 l d\'eau. Frémissement TRÈS doux, 2 h 30, en écumant.',
                qte:[{ nom:'Bouillon', qte:'2,5 l' }],
                tip:'IL NE DOIT JAMAIS BOUILLIR. Un phở qui bout devient trouble, et un phở trouble est raté — même s\'il a bon goût.' },
              { illu:'couper', t:'Tranche le bœuf cru', duree_min:6,
                detail:'Filet passé 30 min au congélateur, tranché le plus finement possible.',
                qte:[{ nom:'Bœuf', qte:'200 g' }],
                tip:'Le plus fin possible : il cuit dans le bol au contact du bouillon brûlant, en quelques secondes.' },
              { illu:'bouillir', t:'Cuis les nouilles', duree_min:5,
                detail:'Rapidement dans l\'eau bouillante, puis rincées et réparties dans les bols.',
                qte:[{ nom:'Nouilles de riz', qte:'300 g' }],
                tip:'Juste réchauffées : elles finissent dans le bouillon, trop cuites elles se cassent.' },
              { illu:'dresser', t:'Monte les bols', duree_min:5,
                detail:'Nouilles, viande crue en tranches, bouillon BOUILLANT versé dessus, herbes et pousses à part.',
                qte:[{ nom:'Pousses de soja', qte:'200 g' }, { nom:'Coriandre', qte:'30 g' }, { nom:'Citron vert', qte:'2' }],
                tip:'Le bouillon doit être à gros bouillons AU MOMENT DE VERSER : c\'est lui qui cuit la viande crue dans le bol.' }
            ]
          } },
        { cle:'viet-pho-chay', n:'Phở chay',
          d:'Le phở végétarien : un bouillon de champignons et d\'épices, du tofu et beaucoup d\'herbes fraîches.',
          i:'🍜 Nouilles de riz|🧊 Tofu|🍄 Champignons|🥢 Bouillon|🌱 Pousses de soja|🌿 Basilic thaï',
          t:['Végétarien','Léger'],
          nu:'Le champignon séché donne au bouillon la profondeur que la viande apporte d\'habitude.',
          rec:{
            temps_min:75, portions:4,
            macros:{ p:18, g:63, l:6, kcal:369 },
            ingredients:[
              { em:'🍜', nom:'Nouilles de riz', qte:'300 g sèches (≈ 720 g cuites)', g:720, nu:'vermicelles de riz' },
              { em:'🧊', nom:'Tofu', qte:'300 g', g:300, nu:'tofu' },
              { em:'🍄', nom:'Champignons', qte:'250 g', g:250, nu:'champignon' },
              { em:'🥢', nom:'Bouillon', qte:'2,5 l de légumes', g:2500, nu:'bouillon' },
              { em:'🌱', nom:'Pousses de soja', qte:'200 g', g:200, nu:'pousses de soja' },
              { em:'🌿', nom:'Basilic thaï', qte:'25 g', g:25, nu:'basilic' },
              { em:'🫚', nom:'Gingembre', qte:'50 g', g:50, nu:'gingembre' },
              { em:'🧅', nom:'Oignon', qte:'250 g', g:250, nu:'oignon' }
            ],
            steps:[
              { illu:'saisir', t:'Brûle oignon et gingembre', duree_min:10,
                detail:'Face coupée sur une poêle sèche brûlante, jusqu\'au noir.',
                qte:[{ nom:'Oignon', qte:'250 g' }, { nom:'Gingembre', qte:'50 g' }],
                tip:'Même geste que le phở bò, et il compte encore plus ici : sans os, c\'est la seule source de profondeur du bouillon.' },
              { illu:'mijoter', t:'Fais le bouillon', duree_min:45,
                detail:'Bouillon de légumes, aromates brûlés, badiane, cannelle, les pieds de champignons. 45 min à frémissement.',
                qte:[{ nom:'Bouillon', qte:'2,5 l' }],
                tip:'LES PIEDS DE CHAMPIGNONS sont ce qui remplace les os : ils apportent l\'umami qui manque à un bouillon végétarien.' },
              { illu:'saisir', t:'Dore le tofu', duree_min:8,
                detail:'Pressé, coupé en tranches, doré à la poêle sur les deux faces.',
                qte:[{ nom:'Tofu', qte:'300 g' }],
                tip:'Doré et pas cru : un tofu blanc dans un bouillon clair a l\'air d\'un oubli.' },
              { illu:'saisir', t:'Fais sauter les champignons', duree_min:6,
                detail:'En lamelles, à feu vif, jusqu\'à ce qu\'ils soient bien colorés.',
                qte:[{ nom:'Champignons', qte:'250 g' }],
                tip:'Colorés, pas blanchis : c\'est la réaction de Maillard qui leur donne un goût de viande.' },
              { illu:'bouillir', t:'Cuis les nouilles', duree_min:5,
                detail:'Brièvement, puis rincées et réparties.',
                qte:[{ nom:'Nouilles de riz', qte:'300 g' }],
                tip:'Rincées à l\'eau chaude juste avant de servir : elles collent en refroidissant.' },
              { illu:'dresser', t:'Monte les bols', duree_min:4,
                detail:'Nouilles, tofu, champignons, bouillon brûlant filtré, pousses et basilic thaï à part.',
                qte:[{ nom:'Pousses de soja', qte:'200 g' }, { nom:'Basilic thaï', qte:'25 g' }],
                tip:'Les herbes à part, ajoutées par chacun : c\'est la règle du phở, et elle vaut aussi pour la version végétarienne.' }
            ]
          } },
        { cle:'viet-rouleaux-crevettes', n:'Rouleaux de printemps aux crevettes',
          d:'Des galettes de riz roulées à froid sur des crevettes, des vermicelles et des herbes, avec une sauce cacahuète.',
          i:'🍤 Crevettes|🥬 Salade|🌿 Menthe|🍜 Vermicelles de riz|🥕 Carotte|🥜 Sauce cacahuète',
          t:['Léger','Protéiné'],
          nu:'Tout est cru ou juste blanchi : c\'est la sauce cacahuète qui pèse, elle se dose à part.',
          rec:{
            temps_min:45, portions:3,
            macros:{ p:34, g:70, l:22, kcal:597 },
            ingredients:[
              { em:'🍤', nom:'Crevettes', qte:'300 g cuites', g:300, nu:'crevettes' },
              { em:'🥬', nom:'Salade', qte:'150 g', g:150, nu:'salade' },
              { em:'🌿', nom:'Menthe', qte:'30 g', g:30, nu:'menthe' },
              { em:'🍜', nom:'Vermicelles de riz', qte:'150 g secs (≈ 360 g cuits)', g:360, nu:'vermicelles' },
              { em:'🥕', nom:'Carotte', qte:'150 g', g:150, nu:'carotte' },
              { em:'🥜', nom:'Sauce cacahuète', qte:'120 g', g:120, nu:'beurre de cacahuete' },
              { em:'🌮', nom:'Galettes de riz', qte:'12', g:90, nu:'galettes de riz' }
            ],
            steps:[
              { illu:'bouillir', t:'Cuis les vermicelles', duree_min:6,
                detail:'3 à 4 min dans l\'eau bouillante, puis rincés à l\'eau froide et bien égouttés.',
                qte:[{ nom:'Vermicelles de riz', qte:'150 g' }],
                tip:'BIEN ÉGOUTTÉS, presque secs : de l\'eau dans le rouleau et la galette se déchire en le roulant.' },
              { illu:'couper', t:'Prépare la garniture', duree_min:10,
                detail:'Crevettes coupées en deux dans la longueur, carotte en julienne, salade et menthe effeuillées.',
                qte:[{ nom:'Crevettes', qte:'300 g' }, { nom:'Carotte', qte:'150 g' }],
                tip:'Les crevettes coupées EN DEUX et posées côté rose vers la galette : c\'est ce qui donne le rouleau translucide des restaurants.' },
              { illu:'melanger', t:'Prépare la sauce', duree_min:5,
                detail:'Beurre de cacahuète, un peu de sauce hoisin, de l\'eau chaude, un trait de citron.',
                qte:[{ nom:'Sauce cacahuète', qte:'120 g' }],
                tip:'Détends-la à l\'eau chaude jusqu\'à ce qu\'elle nappe : trop épaisse, elle arrache le rouleau au trempage.' },
              { illu:'rincer', t:'Réhydrate les galettes', duree_min:15,
                detail:'Une par une, 3 secondes dans l\'eau tiède, posée sur un linge humide.',
                qte:[{ nom:'Galettes de riz', qte:'12' }],
                tip:'TROIS SECONDES, pas plus : elle paraîtra encore rigide, mais elle continue de s\'assouplir sur le plan de travail. Trop trempée, elle devient impossible à manipuler.' },
              { illu:'melanger', t:'Roule', duree_min:12,
                detail:'Crevettes d\'abord (côté rose contre la galette), puis salade, vermicelles, carotte et menthe. Replie les côtés et roule serré.',
                qte:[{ nom:'Salade', qte:'150 g' }, { nom:'Menthe', qte:'30 g' }],
                tip:'Serré, sinon le rouleau s\'ouvre. Et ne garnis que le tiers inférieur : c\'est l\'erreur qui fait éclater les premiers essais.' },
              { illu:'dresser', t:'Sers', duree_min:3,
                detail:'Coupés en deux en biais, avec la sauce à part.',
                tip:'Ils ne se gardent pas : au réfrigérateur, la galette durcit et devient caoutchouteuse en une heure.' }
            ]
          } }
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


  /* ═══ Les trois rangées « Découvrir » ════════════════════
     LE RENDU VIT ICI, PAS DANS LA PAGE, et c'est tout l'intérêt de ce bloc
     (demande de Pablo, 2026-09-02 : « il faut que Découvrir de Social vienne
     remplacer celui de Repas »). L'écran Repas avait son propre « Découvrir » —
     trois cartes vers les mini-jeux — qui n'avait de commun avec celui du fil
     que le titre. Recopier les rangées de `social.html` dans `repas.html`
     aurait donné deux rendus du même contenu, donc deux qui divergent : c'est
     le défaut payé sur `api/_nutrition.js` (macros fausses en notification),
     sur `www/menu.html` (un accueil fossile servi par le bundle) et sur les
     ombres de `suivi.html`. La page fournit un HÔTE, le module fournit tout
     le reste.

     ⚠️ LE STYLE EST DANS LE MODULE, ET IL NE S'APPUIE QUE SUR SES PROPRES
     RÈGLES. La version d'origine héritait de `.rail` et `.dishes`, définis dans
     le `<style>` de `social.html` : importées telles quelles dans Repas, les
     rangées y auraient perdu leur défilement horizontal et leur grille sans que
     rien ne le signale. Seuls les JETONS de `assets/style.css` sont supposés
     présents (`--card`, `--ink`, `--muted`, `--r-lg`, `--r-full`, `--nm-soft`,
     `--pad`) : les deux pages qui montent ce bloc chargent cette feuille.
     `.sec-title` / `.sec-sub` en viennent aussi — les titres gardent donc
     l'allure de la page qui les accueille, ce qui est voulu.

     ⚠️ Tout est scellé sous `.ndx`, posé sur l'hôte. Les noms de classes sont
     courts (`.dish`, `.pays`, `.envie`) parce qu'ils étaient déjà ceux de
     `social.html` — donc des noms qu'une page peut avoir pris. Sans ce
     scellement, une règle `.dish{}` nue déformerait les rangées sur cette
     page-là, et personne ne saurait pourquoi.                              */

  var ENVIES_EM = {
    'Végétarien': '🥬', 'Protéiné': '🥩', 'Léger': '🍋',
    'Épicé': '🌶️', 'Réconfortant': '🍲', 'Riche en fibres': '🌾'
  };

  var cssPose = false;
  function css() {
    if (cssPose) return;
    cssPose = true;
    var s = document.createElement('style');
    s.textContent = [
      /* Rangée qui défile. `scroll-padding-left` : sans lui, le snap alignerait
         la première carte sur le bord du conteneur, donc sous la gouttière —
         elle partirait rognée. */
      '.ndx .nd-rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;',
      'margin:0 calc(var(--pad,20px) * -1);padding:2px var(--pad,20px) 6px;',
      'scroll-padding-left:var(--pad,20px);-webkit-overflow-scrolling:touch}',
      '.ndx .nd-rail::-webkit-scrollbar{display:none}',
      '.ndx .nd-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}',
      '.ndx .nd-head .sec-title{margin-bottom:6px}',
      '.ndx .nd-lnk{flex:none;background:none;border:none;font-family:inherit;font-size:12px;',
      'font-weight:800;color:var(--ink);text-decoration:underline;cursor:pointer;padding:0}',

      '.ndx .pays{flex:0 0 43%;scroll-snap-align:start;position:relative;border-radius:var(--r-lg,24px);',
      'overflow:hidden;aspect-ratio:1/1.22;cursor:pointer;background:var(--card);box-shadow:var(--nm-soft)}',
      '.ndx .pays img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;',
      'opacity:0;transition:opacity .45s ease}',
      '.ndx .pays img.vu{opacity:1}',
      '.ndx .pays .vo{position:absolute;left:0;right:0;bottom:0;padding:30px 12px 12px;color:#fff;',
      'background:linear-gradient(0deg,rgba(0,0,0,.86) 0%,rgba(0,0,0,.45) 45%,rgba(0,0,0,0) 100%)}',
      '.ndx .pays .fl{font-size:19px;line-height:1}',
      '.ndx .pays .nm{font-weight:900;font-size:15px;letter-spacing:-.2px;margin-top:3px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ndx .pays .nb{font-size:10.5px;font-weight:700;opacity:.78;margin-top:1px}',

      /* Les envies : des pastilles, pas une liste. Un tap ouvre directement la
         visionneuse sur tous les plats de l'étiquette — filtrer une grille en
         place aurait demandé un second geste pour arriver au même endroit. */
      '.ndx .envies{display:flex;gap:8px;overflow-x:auto;margin:0 calc(var(--pad,20px) * -1);',
      'padding:2px var(--pad,20px) 6px;scroll-padding-left:var(--pad,20px);',
      '-webkit-overflow-scrolling:touch}',
      '.ndx .envies::-webkit-scrollbar{display:none}',
      '.ndx .envie{flex:none;display:inline-flex;align-items:center;gap:7px;border:none;cursor:pointer;',
      'background:var(--card);color:var(--ink);font-family:inherit;border-radius:var(--r-full,999px);',
      'padding:11px 16px;font-size:12.5px;font-weight:800;white-space:nowrap}',
      '.ndx .envie:active{transform:scale(.96)}',
      '.ndx .envie .e{font-size:15px;line-height:1}',

      /* ⚠️ LES DEUX SÉLECTEURS SONT NÉCESSAIRES, et le second a été trouvé en
         MESURANT, pas en lisant. `social.html` pose `.ndx` et `.dishes` sur le
         MÊME élément pour sa grille de résultats de recherche : le sélecteur de
         descendance seul ne l'atteignait donc pas, et ses sept vignettes
         s'empilaient sur une colonne, sans cadrage — `gridTemplateColumns`
         relevé à `none`. Un appelant peut légitimement faire l'un ou l'autre. */
      '.ndx .dishes,.ndx.dishes{display:grid;grid-template-columns:1fr 1fr;gap:6px 5px}',
      '.ndx .dish{position:relative;aspect-ratio:1/1.3;border-radius:var(--r-lg,24px);overflow:hidden;',
      'background:var(--card);box-shadow:var(--nm-soft);cursor:pointer}',
      '.ndx .dish img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;',
      'transition:opacity .45s ease}',
      '.ndx .dish img.vu{opacity:1}',
      '.ndx .dish .fl{position:absolute;top:8px;left:8px;z-index:2;font-size:15px;line-height:1;',
      'background:rgba(255,255,255,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
      'border-radius:999px;padding:5px 7px}',
      '.ndx .dish .nm{position:absolute;left:6px;right:6px;bottom:6px;z-index:2;color:#fff;font-weight:800;',
      'font-size:12px;line-height:1.25;text-shadow:0 1px 8px rgba(0,0,0,.75)}',
      '.ndx .dish .sh{position:absolute;left:0;right:0;bottom:0;height:58%;',
      'background:linear-gradient(0deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,0) 100%)}'
    ].join('');
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ⚠️ AUCUN PLAT SANS PHOTO DANS CES RANGÉES (demande de Pablo, 2026-08-25).
     Le tri se fait en amont — `tous`, `cuisines`, `parTag`, `selection` ne
     rendent que les plats photographiés. Ce test est le filet du bout de la
     chaîne : une vignette `null` ne pose AUCUNE carte, plutôt qu'une
     `<img src="null">` qui afficherait l'icône cassée du navigateur au milieu
     de la rangée. `illu()` continue de servir ailleurs (le calendrier de
     `planning.js`, l'arc de `journee.js`), où il faut bien montrer QUELQUE
     CHOSE pour un plat placé sans photo. */
  function fond(p) {
    var v = vignette(p);
    if (!v) return '';
    return '<img src="' + esc(v) + '" alt="" loading="lazy" onload="this.classList.add(\'vu\')">';
  }

  /** La carte d'un plat, telle qu'elle apparaît dans une grille `.dishes`. */
  function carte(p) {
    var f = fond(p);
    if (!f) return '';
    return '<div class="dish" data-plat="' + esc(p.cle) + '">' + f
      + '<span class="fl">' + p.drapeau + '</span><div class="sh"></div>'
      + '<div class="nm">' + esc(p.n) + '</div></div>';
  }

  /**
   * Pose les trois rangées dans `hote` : les cuisines, les envies, la
   * sélection du jour. À appeler AVANT la moindre requête réseau de la page —
   * le catalogue est embarqué, le faire patienter derrière un fil ou des
   * recettes, c'est un écran vide sur un contenu déjà prêt.
   *
   * @param {Element|string} hote  l'élément (ou son id) qui reçoit les rangées
   * @param {Object} [o]  {titre, sousTitre, toutVoir:bool, nbSel}
   */
  function monter(hote, o) {
    o = o || {};
    var el = typeof hote === 'string' ? document.getElementById(hote) : hote;
    if (!el) return null;
    css();
    el.classList.add('ndx');

    var pays = cuisines(), liste = tous();
    var nbSel = o.nbSel || 8;

    /* Les ids `ttDecouv` / `ttEnvies` / `ttSel` sont conservés : `social.html`
       leur pose ses illustrations au trait après coup (`poserIcones`). Les
       changer aurait laissé cet écran sans ses trois dessins, en silence. */
    el.innerHTML =
      '<div class="nd-head">'
      + '<div class="sec-title" id="ttDecouv">' + esc(o.titre || 'Découvrir') + '</div>'
      + (o.toutVoir === false ? '' : '<button class="nd-lnk" type="button" data-nd="tout">Tout voir</button>')
      + '</div>'
      + '<div class="sec-sub">' + esc(o.sousTitre
          || (liste.length + ' plats, ' + pays.length
              + ' cuisines — de quoi ne pas remanger deux fois la même chose')) + '</div>'
      + '<div class="nd-rail">' + pays.map(function (c) {
          /* La couverture est la photo du PREMIER plat : un choix, pas un
             hasard — la liste est ordonnée, la vignette ne changera donc jamais
             d'un chargement à l'autre. Et le pluriel se décide : « Le
             quotidien » n'a qu'un seul plat photographié, et « 1 plats » se lit
             comme un bug de gabarit. */
          var n = c.plats.length;
          return '<div class="pays" data-pays="' + esc(c.cle) + '">' + fond(c.plats[0])
            + '<div class="vo"><div class="fl">' + c.drapeau + '</div>'
            + '<div class="nm">' + esc(c.nom) + '</div>'
            + '<div class="nb">' + n + (n > 1 ? ' plats' : ' plat') + '</div></div></div>';
        }).join('') + '</div>'
      + '<div class="sec-title" id="ttEnvies">Envie de quoi ?</div>'
      + '<div class="sec-sub">Une étiquette, et on fait défiler les plats qui vont avec</div>'
      + '<div class="envies">' + tags().map(function (t) {
          return '<button class="envie" type="button" data-envie="' + esc(t) + '">'
            + '<span class="e">' + (ENVIES_EM[t] || '🍽️') + '</span>' + esc(t) + '</button>';
        }).join('') + '</div>'
      + '<div class="sec-title" id="ttSel">À goûter cette semaine</div>'
      + '<div class="sec-sub">Une sélection qui change chaque jour, un plat par pays</div>'
      + '<div class="dishes" data-nd-titre="À goûter cette semaine">'
      + selection(nbSel).map(carte).join('') + '</div>';
    return el;
  }

  /* ⚠️ UN SEUL ÉCOUTEUR, POSÉ SUR `document` ET FILTRÉ PAR `.ndx`. Délégué,
     parce que les rangées sont réécrites (`monter` peut être rappelé) et que
     rebrancher à chaque rendu finit par perdre un geste. Filtré, parce que
     `[data-plat]` est un attribut court : sans le test d'ancêtre, un tap sur un
     élément homonyme d'une autre partie de la page ouvrirait la visionneuse. */
  document.addEventListener('click', function (e) {
    var cl = e.target.closest;
    if (!cl) return;
    var dans = e.target.closest('.ndx');
    if (!dans) return;

    var c = e.target.closest('[data-pays]');
    if (c) {
      var cu = cuisine(c.getAttribute('data-pays'));
      if (!cu) return;
      /* `cuisine:` est ce qui arme le passage au pays suivant en fin de série.
         Les deux autres entrées (une envie, la sélection du jour) ne le passent
         pas : « le pays d'après » n'y veut rien dire. */
      ouvrir({ plats: cu.plats, index: 0, titre: cu.drapeau + ' ' + cu.nom, cuisine: cu.cle });
      return;
    }
    var t = e.target.closest('[data-envie]');
    if (t) {
      var tag = t.getAttribute('data-envie');
      ouvrir({ plats: parTag(tag), index: 0, titre: tag });
      return;
    }
    if (e.target.closest('[data-nd="tout"]')) {
      ouvrir({ plats: tous(), titre: 'Tous les plats' });
      return;
    }
    var d = e.target.closest('[data-plat]');
    if (d) {
      /* On ouvre sur la LISTE affichée, pas sur le catalogue entier : le geste
         latéral doit parcourir ce qu'on avait sous les yeux, sinon le plat
         suivant sort de nulle part. */
      var boite = d.closest('.dishes') || dans;
      var cles = [].map.call(boite.querySelectorAll('[data-plat]'), function (x) {
        return x.getAttribute('data-plat');
      });
      ouvrir({
        plats: cles.map(platParCle).filter(Boolean),
        index: cles.indexOf(d.getAttribute('data-plat')),
        titre: boite.getAttribute('data-nd-titre') || 'Plats du monde'
      });
    }
  });


  return {
    cuisines: cuisines, cuisine: cuisine, parCuisine: parCuisine,
    tous: tous, parTag: parTag, tags: tags, selection: selection,
    platParCle: platParCle, img: img, vignette: vignette, illu: illu,
    /* La recette d'un plat au schéma de `assets/recette.js`, ou null. Exposée
       parce que c'est la seule façon de vérifier la conversion sans dérouler
       la visionneuse — et parce qu'un autre écran voudra la lancer un jour. */
    recette: recette,
    ouvrir: ouvrir, fermer: fermer,
    /* Les trois rangées « Découvrir », posées dans un hôte fourni par la page.
       `carte` est exportée avec elles : la recherche de `social.html` doit
       pouvoir rendre les MÊMES vignettes que la sélection du jour — deux
       fabriques de cartes, c'est deux qui divergent. */
    monter: monter, carte: carte,
    estOuverte: function () { return !!window.NattyVisionneuse && NattyVisionneuse.estOuverte(); }
  };
})();
