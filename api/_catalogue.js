/* ═══════════════════════════════════════════════════════════
   Natty — le catalogue des plats, côté SERVEUR
   ───────────────────────────────────────────────────────────
   ⚠️ FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
       node scripts/gen-catalogue.mjs

   Pourquoi il existe : `assets/decouverte.js` est une IIFE de navigateur,
   le serveur ne peut pas l'importer. Et le cron du lundi
   (`api/conseils-hebdo`) n'a aucun client sous la main pour la lui passer
   dans le corps de la requête, contrairement au garde-manger.

   ⚠️ CE MONTAGE A DÉJÀ COÛTÉ CHER UNE FOIS. `api/_nutrition.js` est la même
   idée — une copie serveur d'une table du navigateur — et elle a divergé
   sans prévenir : « pomme de terre » y valait une pomme, donc le rappel du
   soir annonçait d'autres grammes que l'écran, et c'est l'app qui avait
   l'air d'avoir tort. La parade est ici la régénération : ce fichier n'est
   jamais édité, il est REFAIT. Toute modification du catalogue se termine
   par la commande ci-dessus.

   Les plats sont réduits à ce dont la génération a besoin pour CHOISIR :
   la clé, le nom, le pays, les ingrédients et les étiquettes. Ni photo, ni
   description, ni note nutritionnelle — le prompt est déjà long.
   ═══════════════════════════════════════════════════════════ */

export const CATALOGUE = [
  {"cle":"quo-pita-saumon-feta","n":"Pita au saumon et feta","pays":"Le quotidien","i":"Saumon, Feta, Pain pita, Concombre, Carotte, Aneth, Yaourt, Citron","t":"Protéiné, Rapide, Léger"},
  {"cle":"bre-feijoada","n":"Feijoada","pays":"Brésil","i":"Haricots noirs, Porc, Chorizo, Riz, Chou kale, Orange","t":"Protéiné, Riche en fibres, Réconfortant"},
  {"cle":"bre-acai-bowl","n":"Açaí bowl","pays":"Brésil","i":"Açaí, Banane, Fraise, Myrtille, Granola, Miel","t":"Végétarien, Riche en fibres"},
  {"cle":"bre-bobo-de-camarao","n":"Bobó de camarão","pays":"Brésil","i":"Crevettes, Manioc, Lait de coco, Tomate, Oignon, Coriandre","t":"Protéiné, Réconfortant"},
  {"cle":"bre-moqueca-poisson","n":"Moqueca de poisson","pays":"Brésil","i":"Poisson blanc, Lait de coco, Poivron, Tomate, Citron vert, Coriandre","t":"Protéiné"},
  {"cle":"bre-xinxim","n":"Xinxim de galinha","pays":"Brésil","i":"Poulet, Crevettes séchées, Cacahuètes, Oignon, Gingembre, Citron","t":"Protéiné, Réconfortant"},
  {"cle":"chi-aubergine-yuxiang","n":"Aubergines yúxiāng","pays":"Chine","i":"Aubergine, Ail, Gingembre, Sauce soja, Piment, Riz","t":"Végétarien, Épicé"},
  {"cle":"chi-mapo-tofu","n":"Mápó dòufu","pays":"Chine","i":"Tofu, Viande hachée, Doubanjiang, Ail, Ciboule, Riz","t":"Protéiné, Épicé"},
  {"cle":"chi-kung-pao","n":"Poulet kung pao","pays":"Chine","i":"Poulet, Cacahuètes, Poivron, Piment, Sauce soja, Riz","t":"Protéiné, Épicé"},
  {"cle":"chi-raviolis-vapeur","n":"Raviolis vapeur","pays":"Chine","i":"Pâte à raviolis, Viande hachée, Chou, Ciboule, Gingembre, Sauce soja","t":"Réconfortant, Protéiné"},
  {"cle":"cor-bibimbap-boeuf","n":"Bibimbap au bœuf","pays":"Corée","i":"Bœuf, Riz, Carotte, Épinards, Œuf, Gochujang","t":"Protéiné, Réconfortant"},
  {"cle":"cor-nouilles-poulet","n":"Nouilles au poulet","pays":"Corée","i":"Nouilles, Poulet, Gochujang, Oignon, Lait, Coriandre","t":"Réconfortant, Épicé"},
  {"cle":"cor-bulgogi","n":"Bulgogi grillé","pays":"Corée","i":"Bœuf, Sauce soja, Poire, Ail, Graines de sésame, Riz","t":"Protéiné"},
  {"cle":"cor-poulet-gochujang","n":"Poulet gochujang caramélisé","pays":"Corée","i":"Poulet, Gochujang, Miel, Ail, Gingembre, Riz","t":"Protéiné, Épicé"},
  {"cle":"cor-japchae","n":"Japchae","pays":"Corée","i":"Vermicelles de patate douce, Carotte, Épinards, Champignons, Oignon, Sauce soja","t":"Végétarien"},
  {"cle":"cor-kimchi-jjigae","n":"Kimchi jjigae","pays":"Corée","i":"Kimchi, Tofu, Oignon, Gochujang, Ail, Riz","t":"Végétarien, Épicé, Réconfortant"},
  {"cle":"cor-tteokbokki","n":"Tteokbokki","pays":"Corée","i":"Gâteaux de riz, Gochujang, Oignon, Chou, Sucre, Graines de sésame","t":"Végétarien, Épicé"},
  {"cle":"eth-doro-wat","n":"Doro wat","pays":"Éthiopie","i":"Poulet, Oignon, Berbéré, Œuf, Ail, Gingembre","t":"Protéiné, Épicé"},
  {"cle":"eth-injera","n":"Injera et ses ragoûts","pays":"Éthiopie","i":"Teff, Eau, Lentilles, Chou, Carotte, Berbéré","t":"Végétarien, Riche en fibres"},
  {"cle":"eth-misir-wat","n":"Misir wat","pays":"Éthiopie","i":"Lentilles corail, Oignon, Berbéré, Ail, Gingembre, Tomate","t":"Végétarien, Riche en fibres, Épicé"},
  {"cle":"eth-tibs-boeuf","n":"Tibs de bœuf","pays":"Éthiopie","i":"Bœuf, Oignon, Piment, Ail, Tomate, Romarin","t":"Protéiné, Épicé"},
  {"cle":"geo-chakhokhbili","n":"Chakhokhbili","pays":"Géorgie","i":"Poulet, Tomate, Oignon, Coriandre, Persil, Ail","t":"Protéiné"},
  {"cle":"geo-mtsvadi","n":"Mtsvadi","pays":"Géorgie","i":"Agneau, Oignon rouge, Tomate, Concombre, Coriandre, Citron","t":"Protéiné"},
  {"cle":"gre-daurade","n":"Daurade grillée","pays":"Grèce","i":"Daurade, Huile d'olive, Citron, Origan, Pomme de terre, Courgette","t":"Protéiné, Léger"},
  {"cle":"gre-fasolada","n":"Fasolada","pays":"Grèce","i":"Haricots blancs, Carotte, Tomate, Oignon, Huile d'olive, Persil","t":"Végétarien, Riche en fibres, Réconfortant"},
  {"cle":"gre-gemista","n":"Gemista","pays":"Grèce","i":"Tomate, Poivron, Riz, Oignon, Menthe, Huile d'olive","t":"Végétarien"},
  {"cle":"gre-souvlaki-poulet","n":"Souvláki de poulet","pays":"Grèce","i":"Poulet, Citron, Origan, Concombre, Yaourt, Ail","t":"Protéiné, Léger"},
  {"cle":"gre-mezze-dolma","n":"Mezzé et dolmas","pays":"Grèce","i":"Feuilles de vigne, Riz, Pois chiches, Citron, Huile d'olive, Pain pita","t":"Végétarien, Riche en fibres"},
  {"cle":"ind-tandoori-agneau","n":"Agneau tandoori","pays":"Inde","i":"Agneau, Yaourt, Paprika, Ail, Gingembre, Citron","t":"Protéiné, Épicé"},
  {"cle":"ind-chana-masala","n":"Chana masala","pays":"Inde","i":"Pois chiches, Tomate, Oignon, Gingembre, Coriandre, Épices","t":"Végétarien, Riche en fibres"},
  {"cle":"ind-dal","n":"Dal de lentilles corail","pays":"Inde","i":"Lentilles corail, Oignon, Tomate, Cumin, Gingembre, Coriandre","t":"Végétarien, Riche en fibres, Réconfortant"},
  {"cle":"ind-poulet-tikka","n":"Poulet tikka masala","pays":"Inde","i":"Poulet, Tomate, Crème, Ail, Gingembre, Riz","t":"Protéiné, Réconfortant"},
  {"cle":"ira-ash-reshteh","n":"Âsh-e reshteh","pays":"Iran","i":"Pois chiches, Lentilles, Persil, Coriandre, Nouilles, Oignon","t":"Végétarien, Riche en fibres, Réconfortant"},
  {"cle":"ira-fesenjan-poulet","n":"Fesenjân au poulet","pays":"Iran","i":"Poulet, Noix, Mélasse de grenade, Oignon, Riz, Curcuma","t":"Protéiné, Réconfortant"},
  {"cle":"ira-kashk-bademjan","n":"Kashk-e bademjan","pays":"Iran","i":"Aubergine, Kashk, Oignon, Menthe, Ail, Curcuma","t":"Végétarien, Réconfortant"},
  {"cle":"ira-mirza-ghasemi","n":"Mirza ghasemi","pays":"Iran","i":"Aubergine, Tomate, Ail, Œuf, Curcuma, Huile d'olive","t":"Végétarien, Protéiné"},
  {"cle":"ita-caponata-pois-chiches","n":"Caponata aux pois chiches","pays":"Italie","i":"Aubergine, Pois chiches, Tomate, Olives, Oignon, Basilic","t":"Végétarien, Riche en fibres"},
  {"cle":"ita-minestrone","n":"Minestrone","pays":"Italie","i":"Haricots, Carotte, Chou, Tomate, Pâtes, Huile d'olive","t":"Végétarien, Riche en fibres, Réconfortant"},
  {"cle":"ita-parmigiana","n":"Parmigiana d'aubergines","pays":"Italie","i":"Aubergine, Sauce tomate, Mozzarella, Parmesan, Basilic, Huile d'olive","t":"Végétarien, Réconfortant"},
  {"cle":"ita-poulet-cacciatora","n":"Poulet alla cacciatora","pays":"Italie","i":"Poulet, Tomate, Olives, Poivron, Oignon, Romarin","t":"Protéiné"},
  {"cle":"jap-bento-saumon","n":"Bento saumon et légumes croquants","pays":"Japon","i":"Saumon, Riz, Brocoli, Carotte, Sauce soja, Graines de sésame","t":"Protéiné"},
  {"cle":"jap-chirashi-vege","n":"Chirashi végétarien","pays":"Japon","i":"Tofu, Riz, Edamame, Avocat, Concombre, Chou rouge","t":"Végétarien, Léger"},
  {"cle":"jap-donburi-tofu","n":"Donburi au tofu","pays":"Japon","i":"Tofu, Riz, Sauce soja, Ciboule, Gingembre, Graines de sésame","t":"Végétarien, Protéiné"},
  {"cle":"jap-yakitori","n":"Yakitori de poulet","pays":"Japon","i":"Poulet, Sauce soja, Mirin, Ciboule, Riz, Concombre","t":"Protéiné, Léger"},
  {"cle":"jap-ramen-poulet","n":"Ramen au poulet","pays":"Japon","i":"Nouilles, Poulet, Bouillon, Œuf, Ciboule, Gingembre","t":"Réconfortant, Protéiné"},
  {"cle":"jap-saumon-teriyaki","n":"Saumon teriyaki","pays":"Japon","i":"Saumon, Teriyaki, Riz, Brocoli, Poivron, Graines de sésame","t":"Protéiné"},
  {"cle":"jap-soba","n":"Soba de sarrasin","pays":"Japon","i":"Nouilles de sarrasin, Bouillon, Épinards, Ciboule, Champignons, Sauce soja","t":"Léger, Riche en fibres"},
  {"cle":"lib-chich-taouk","n":"Chich taouk","pays":"Liban","i":"Poulet, Yaourt, Citron, Ail, Paprika, Riz","t":"Protéiné, Léger"},
  {"cle":"lib-falafel-bowl","n":"Bowl de falafels","pays":"Liban","i":"Falafel, Pois chiches, Concombre, Tomate, Tahini, Quinoa","t":"Végétarien, Riche en fibres"},
  {"cle":"lib-fattouche","n":"Fattouche","pays":"Liban","i":"Laitue, Tomate, Concombre, Menthe, Pain pita, Citron","t":"Végétarien, Léger"},
  {"cle":"lib-mezze","n":"Mezzé libanais","pays":"Liban","i":"Houmous, Aubergine, Falafel, Feta, Olives, Pain pita","t":"Végétarien, Riche en fibres"},
  {"cle":"lib-mjadara","n":"Mjadara","pays":"Liban","i":"Lentilles, Riz, Oignon, Huile d'olive, Cumin, Yaourt","t":"Végétarien, Riche en fibres, Réconfortant"},
  {"cle":"lib-taboule","n":"Taboulé libanais","pays":"Liban","i":"Persil, Menthe, Tomate, Boulgour, Citron, Huile d'olive","t":"Végétarien, Léger"},
  {"cle":"mar-harira","n":"Harira","pays":"Maroc","i":"Lentilles, Pois chiches, Tomate, Coriandre, Persil, Oignon","t":"Riche en fibres, Réconfortant"},
  {"cle":"mar-tajine-citron","n":"Tajine au citron confit","pays":"Maroc","i":"Poulet, Citron confit, Olives, Oignon, Coriandre, Curcuma","t":"Protéiné, Réconfortant"},
  {"cle":"mar-zaalouk","n":"Zaalouk","pays":"Maroc","i":"Aubergine, Tomate, Ail, Cumin, Huile d'olive, Coriandre","t":"Végétarien, Léger"},
  {"cle":"mex-ceviche-cabillaud","n":"Ceviche de cabillaud","pays":"Mexique","i":"Cabillaud, Citron vert, Oignon rouge, Coriandre, Piment, Avocat","t":"Protéiné, Léger"},
  {"cle":"mex-chili","n":"Chili con carne","pays":"Mexique","i":"Bœuf haché, Haricots rouges, Tomate, Oignon, Piment, Riz","t":"Protéiné, Riche en fibres, Réconfortant"},
  {"cle":"mex-enchiladas-poulet","n":"Enchiladas de poulet","pays":"Mexique","i":"Tortilla de maïs, Poulet, Sauce tomate, Fromage, Laitue, Avocat","t":"Protéiné, Réconfortant"},
  {"cle":"mex-enchiladas-boeuf","n":"Enchiladas de bœuf","pays":"Mexique","i":"Tortilla de maïs, Bœuf, Sauce tomate, Fromage, Oignon, Citron vert","t":"Protéiné, Réconfortant"},
  {"cle":"mex-burrito-bowl","n":"Burrito bowl au poulet","pays":"Mexique","i":"Riz, Haricots noirs, Maïs, Poulet, Avocat, Tomate","t":"Protéiné, Riche en fibres"},
  {"cle":"mex-tacos-boeuf","n":"Tacos de bœuf, salsa","pays":"Mexique","i":"Tortilla de maïs, Bœuf haché, Salsa, Oignon, Coriandre, Piment","t":"Protéiné, Épicé"},
  {"cle":"per-aji-de-gallina","n":"Ají de gallina","pays":"Pérou","i":"Poulet, Ají amarillo, Lait, Pain, Riz, Œuf","t":"Protéiné, Réconfortant"},
  {"cle":"per-quinoa-bowl","n":"Bowl de quinoa","pays":"Pérou","i":"Quinoa, Patate douce, Pois chiches, Roquette, Feta, Maïs","t":"Végétarien, Riche en fibres"},
  {"cle":"per-tacu-tacu","n":"Tacu tacu","pays":"Pérou","i":"Riz, Haricots, Œuf, Oignon rouge, Ají amarillo, Coriandre","t":"Riche en fibres, Réconfortant"},
  {"cle":"per-lomo-saltado","n":"Lomo saltado","pays":"Pérou","i":"Bœuf, Oignon rouge, Tomate, Sauce soja, Pomme de terre, Coriandre","t":"Protéiné"},
  {"cle":"phi-chicken-inasal","n":"Chicken inasal","pays":"Philippines","i":"Poulet, Citron vert, Gingembre, Citronnelle, Ail, Riz","t":"Protéiné"},
  {"cle":"phi-kare-kare","n":"Kare-kare","pays":"Philippines","i":"Bœuf, Cacahuètes, Aubergine, Pak choï, Haricots verts, Riz","t":"Protéiné, Réconfortant"},
  {"cle":"phi-lumpia-legumes","n":"Lumpia aux légumes","pays":"Philippines","i":"Carotte, Chou, Haricots verts, Oignon, Ail, Galettes de riz","t":"Végétarien"},
  {"cle":"phi-pancit-legumes","n":"Pancit aux légumes","pays":"Philippines","i":"Vermicelles de riz, Carotte, Chou, Poivron, Sauce soja, Citron vert","t":"Végétarien, Léger"},
  {"cle":"phi-sinigang","n":"Sinigang","pays":"Philippines","i":"Bœuf, Tomate, Épinards, Haricots verts, Aubergine, Tamarin","t":"Protéiné, Léger"},
  {"cle":"sen-mafe","n":"Mafé","pays":"Sénégal","i":"Bœuf, Beurre de cacahuète, Tomate, Carotte, Patate douce, Riz","t":"Protéiné, Réconfortant"},
  {"cle":"sen-thieboudienne","n":"Thiéboudiène","pays":"Sénégal","i":"Poisson, Riz, Carotte, Chou, Aubergine, Tomate","t":"Protéiné"},
  {"cle":"sen-yassa-poulet","n":"Yassa au poulet","pays":"Sénégal","i":"Poulet, Oignon, Citron, Piment, Ail, Riz","t":"Protéiné"},
  {"cle":"thai-tom-kha-kai","n":"Tom kha kai","pays":"Thaïlande","i":"Lait de coco, Poulet, Champignons, Citronnelle, Citron vert, Piment","t":"Réconfortant, Épicé"},
  {"cle":"thai-curry-vert-poulet","n":"Curry vert de poulet","pays":"Thaïlande","i":"Poulet, Lait de coco, Pâte de curry vert, Aubergine, Basilic thaï, Riz","t":"Protéiné, Épicé"},
  {"cle":"thai-curry-rouge-legumes","n":"Curry rouge de légumes","pays":"Thaïlande","i":"Tofu, Lait de coco, Pâte de curry rouge, Courgette, Aubergine, Poivron","t":"Végétarien, Épicé"},
  {"cle":"thai-pad-thai-crevettes","n":"Pad thaï aux crevettes","pays":"Thaïlande","i":"Nouilles de riz, Crevettes, Œuf, Cacahuètes, Pousses de soja, Citron vert","t":"Protéiné"},
  {"cle":"thai-pad-thai-poulet","n":"Pad thaï au poulet","pays":"Thaïlande","i":"Nouilles de riz, Poulet, Œuf, Cacahuètes, Pousses de soja, Ciboule","t":"Protéiné"},
  {"cle":"thai-pad-thai-tofu","n":"Pad thaï au tofu","pays":"Thaïlande","i":"Nouilles de riz, Tofu, Brocoli, Carotte, Cacahuètes, Citron vert","t":"Végétarien, Protéiné"},
  {"cle":"thai-riz-basilic","n":"Riz sauté au basilic thaï","pays":"Thaïlande","i":"Riz, Basilic thaï, Ail, Piment, Œuf, Sauce soja","t":"Épicé, Réconfortant"},
  {"cle":"thai-tigre-qui-pleure","n":"Tigre qui pleure","pays":"Thaïlande","i":"Bœuf, Citron vert, Piment, Coriandre, Sauce soja, Riz gluant","t":"Protéiné, Épicé"},
  {"cle":"thai-soupe-porc-caramelise","n":"Soupe thaïe au porc caramélisé","pays":"Thaïlande","i":"Nouilles, Porc, Lait de coco, Pâte de curry, Oignon rouge, Citron vert","t":"Réconfortant, Épicé"},
  {"cle":"tur-imam-bayildi","n":"İmam bayıldı","pays":"Turquie","i":"Aubergine, Tomate, Oignon, Ail, Huile d'olive, Persil","t":"Végétarien, Léger"},
  {"cle":"tur-kisir","n":"Kısır","pays":"Turquie","i":"Boulgour, Concentré de tomate, Persil, Ciboule, Citron, Concombre","t":"Végétarien, Riche en fibres"},
  {"cle":"tur-manti","n":"Mantı","pays":"Turquie","i":"Pâte à raviolis, Viande hachée, Yaourt, Ail, Paprika, Menthe","t":"Réconfortant, Protéiné"},
  {"cle":"tur-menemen","n":"Menemen","pays":"Turquie","i":"Œufs, Tomate, Poivron, Oignon, Huile d'olive, Pain","t":"Végétarien, Protéiné"},
  {"cle":"tur-mercimek-corbasi","n":"Mercimek çorbası","pays":"Turquie","i":"Lentilles corail, Carotte, Oignon, Pomme de terre, Paprika, Citron","t":"Végétarien, Riche en fibres, Réconfortant"},
  {"cle":"tur-pide-legumes","n":"Pide aux légumes","pays":"Turquie","i":"Pâte à pide, Poivron, Aubergine, Tomate, Feta, Persil","t":"Végétarien, Réconfortant"},
  {"cle":"viet-banh-mi-poulet","n":"Bánh mì au poulet","pays":"Vietnam","i":"Baguette, Poulet, Carotte, Concombre, Coriandre, Piment","t":"Protéiné"},
  {"cle":"viet-poisson-vapeur","n":"Poisson vapeur au gingembre","pays":"Vietnam","i":"Poisson blanc, Gingembre, Ciboule, Sauce soja, Riz, Coriandre","t":"Protéiné, Léger"},
  {"cle":"viet-pho-bo","n":"Phở bò","pays":"Vietnam","i":"Nouilles de riz, Bœuf, Bouillon, Coriandre, Pousses de soja, Citron vert","t":"Protéiné, Réconfortant"},
  {"cle":"viet-pho-chay","n":"Phở chay","pays":"Vietnam","i":"Nouilles de riz, Tofu, Champignons, Bouillon, Pousses de soja, Basilic thaï","t":"Végétarien, Léger"},
  {"cle":"viet-rouleaux-crevettes","n":"Rouleaux de printemps aux crevettes","pays":"Vietnam","i":"Crevettes, Salade, Menthe, Vermicelles de riz, Carotte, Sauce cacahuète","t":"Léger, Protéiné"}
];

/** Le plat du catalogue portant cette clé, ou null. */
export function platParCle(cle) {
  return CATALOGUE.filter(p => p.cle === cle)[0] || null;
}

/** La liste compacte donnée au modèle pour qu'il choisisse. */
export function listePourPrompt() {
  return CATALOGUE.map(p => `${p.cle} | ${p.n} (${p.pays}) | ${p.i}`).join('\n');
}
