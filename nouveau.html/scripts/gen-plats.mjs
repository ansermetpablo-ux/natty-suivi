/* ═══════════════════════════════════════════════════════════════
   Natty — génération de data/plats.json (le catalogue de vente)

       node scripts/gen-plats.mjs            écrit data/plats.json + data/plats.js
       node scripts/gen-plats.mjs --verif    contrôle sans écrire

   POURQUOI CE FICHIER EXISTE. Il y avait trois catalogues qui ne se
   parlaient pas : les 12 fiches de la boutique Wix, les 93 plats
   d'assets/decouverte.js, et les 38 fiches techniques de
   scripts/fiches-natty.mjs. data/plats.json devient la source unique des
   plats VENDUS : le site le lit pour la carte, l'app pour pré-remplir le
   suivi, le back-office pour les bons de commande. Personne ne le tape à
   la main, il se régénère depuis les fiches du chef.

   ─────────────────────────────────────────────────────────────────
   COMMENT LES VALEURS NUTRITIONNELLES SONT CALCULÉES — lire avant de
   toucher à quoi que ce soit.

   La première version divisait bêtement le total de la fiche par 6. Elle
   sortait 854 kcal pour le poulet à la moutarde et 194 pour le merlu. Les
   deux chiffres étaient arithmétiquement justes et commercialement faux,
   parce que la fiche du chef ne dit pas ce que pèse une barquette : les
   « 6 portions » des fiches vont de 279 g à 711 g selon le plat.

   Le calcul se fait donc en trois temps.

   1. DENSITÉ. On somme les ingrédients et on ramène à 100 g de préparation.
      C'est la seule valeur que la fiche permet de calculer sans rien
      décider, et c'est aussi le format qu'impose la déclaration
      nutritionnelle (règlement INCO 1169/2011, annexe XV : pour 100 g).
      Les densités obtenues tiennent entre 62 et 147 kcal/100 g, ce qui est
      la bonne fourchette pour un plat cuisiné.

   2. RENDEMENT. Une fiche pèse les ingrédients tels qu'achetés. « 6 cuisses
      de poulet, 1500 g » n'est pas 1500 g de chair : l'os et la peau
      partent. Sans correction, le plat était crédité de 86 g de protéines
      par portion, ce qui n'existe pas dans une barquette. Les coefficients
      sont dans RENDEMENT ci-dessous, chacun avec sa raison.

   3. PORTION. Le poids de la barquette est une DÉCISION, pas un calcul.
      Il est écrit plat par plat dans VENTE, et les macros affichées sont
      la densité multipliée par ce poids. Changer un poids de portion met
      tout le reste à jour.

   Le script refuse de produire un plat dont les valeurs sortent des bornes
   de BORNES, et signale tout ingrédient que la table ne sait pas chiffrer.
   ═══════════════════════════════════════════════════════════════ */

import { FICHES, PORTIONS } from './fiches-natty.mjs';
import { getNutri } from '../api/_nutrition.js';
import { writeFileSync, mkdirSync } from 'node:fs';

/* ── Ce que l'équipe décide, plat par plat ──────────────────────
   `fiche` doit correspondre AU CARACTÈRE PRÈS au champ `nom` d'une entrée
   de FICHES — une faute de frappe arrête le script.
   `portion` est le poids net de la barquette, en grammes. */
const VENTE = [
  { id:'poulet-moutarde', fiche:"Poulet à la moutarde, riz complet, légumes rôtis",
    nom:"Poulet à la moutarde", cat:'masse', portion:450,
    desc:"Poulet rôti à la moutarde, riz complet et légumes rôtis." },
  { id:'curry-poulet', fiche:"Curry de poulet rôti, riz complet",
    nom:"Curry de poulet rôti", cat:'masse', portion:450,
    desc:"Poulet au curry, lait de coco, haricots verts et riz complet." },
  { id:'thon-mangue', fiche:"Thon grillé, salsa de mangue, riz sauvage",
    nom:"Thon grillé, salsa de mangue", cat:'masse', portion:480,
    desc:"Steak de thon grillé, salsa de mangue, riz sauvage." },
  { id:'chili-sin-carne', fiche:"Chili sin carne, haricots noirs et quinoa",
    nom:"Chili sin carne", cat:'bien', portion:400,
    desc:"Haricots noirs, quinoa et avocat. Sans viande." },

  { id:'dinde-vapeur', fiche:"Dinde à la vapeur, légumes",
    nom:"Dinde à la vapeur", cat:'perte', portion:380,
    desc:"Poitrine de dinde vapeur, carottes, haricots verts, brocolis." },
  { id:'salade-poulet', fiche:"Salade de poulet grillé",
    nom:"Salade de poulet grillé", cat:'perte', portion:380,
    desc:"Poulet grillé, laitue, tomates cerises, concombre, vinaigrette légère." },
  { id:'natty-wrap', fiche:"Natty wrap",
    nom:"Le Natty wrap", cat:'perte', portion:330,
    desc:"Poulet grillé, légumes frais, sauce signature au yaourt." },
  { id:'merlu', fiche:"Merlu poché, brocoli, kale et mangue",
    nom:"Filet de merlu", cat:'perte', portion:430,
    desc:"Merlu poché, brocoli, mangue et chou kale." },
  { id:'salade-quinoa', fiche:"Salade de quinoa",
    nom:"Salade de quinoa", cat:'perte', portion:380,
    desc:"Quinoa, légumes croquants, avocat, vinaigrette au citron." },

  { id:'boeuf-braise', fiche:"Bœuf braisé aux légumes",
    nom:"Bœuf braisé", cat:'bien', portion:400,
    desc:"Bœuf braisé, carottes, céleri, oignon, sauce au laurier." },
  { id:'truite-herbes', fiche:"Truite aux herbes",
    nom:"Truite aux herbes", cat:'bien', portion:400,
    desc:"Truite au four aux herbes fraîches, légumes vapeur." },
  { id:'quinoa-bowl', fiche:"Quinoa bowl, légumes grillés, sauce tahini",
    nom:"Quinoa bowl", cat:'bien', portion:400,
    desc:"Quinoa, légumes grillés et sauce tahini." }
];

const CATEGORIES = {
  masse: { label:"Prise de masse", promesse:"Les plus riches en protéines" },
  perte: { label:"Perte de poids", promesse:"Les plus légers en calories" },
  bien:  { label:"Bien-être",      promesse:"L'équilibre au quotidien" }
};

/* Prix — décision du 29/09/2026. */
const PRIX = { unite: 12.5, abonnement: 9 };

/* ── Rendements ────────────────────────────────────────────────
   Part réellement comestible d'un ingrédient pesé tel qu'il est écrit sur
   la fiche. La clé est cherchée dans le nom de l'ingrédient.
   ⚠️ Ce sont des ordres de grandeur de cuisine, à faire confirmer par
   Francis sur ses propres pesées. Chaque valeur porte sa raison. */
const RENDEMENT = [
  { cle:'cuisse de poulet', coef:0.70, pourquoi:"os et peau retirés après cuisson" },
  { cle:'cuisse de dinde',  coef:0.70, pourquoi:"os et peau retirés après cuisson" },
  { cle:'pilon',            coef:0.65, pourquoi:"os" },
  { cle:'gigot',            coef:0.75, pourquoi:"os" }
];

/* ── Rattachements à corriger ──────────────────────────────────
   La table d'api/_nutrition.js rattache par mots-clés. Quand elle tombe à
   côté, on redresse ici plutôt que de toucher à la table, qui sert aussi
   à l'app. Chaque entrée dit la valeur retenue pour 100 g. */
const CORRECTIONS = {
  'riz sauvage': { c:101, p:4,   l:0.3, g:21,
                   pourquoi:"la table le rattachait au riz blanc (130 kcal) ; le riz sauvage cuit en fait 101" }
};

/* ── Bornes de vraisemblance ───────────────────────────────────
   Un plat hors de ces bornes n'est pas publiable en l'état : soit la
   fiche a un problème, soit le poids de portion est mal choisi, soit le
   plat est dans la mauvaise catégorie. Le script le dit et continue, mais
   le plat sort avec `coherent: false` et le site ne l'affiche pas. */
const BORNES = {
  //                        plancher et plafond de calories ; plancher de protéines
  masse: { kcal:[450, 850], prot_min:30 },
  perte: { kcal:[250, 550], prot_min:8  },
  bien:  { kcal:[320, 650], prot_min:8  }
};
/* Pas de PLAFOND de protéines, volontairement. La première version en avait
   un à 55 g et il sonnait sur la dinde vapeur et la salade de poulet, qui
   sont justement les deux meilleurs plats de la gamme « perte de poids » :
   beaucoup de protéines pour peu de calories, c'est la définition de ce
   qu'on cherche, pas un défaut. Un plancher à 8 g suffit à attraper un plat
   vide, et il laisse vivre les plats végétariens. */

/* ── Allergènes ────────────────────────────────────────────────
   Les 14 allergènes du règlement INCO. La détection lit le NOM des
   ingrédients ; elle ne voit pas ce qui se cache dans un produit composé
   (pâte de curry, bouillon, chapelure). SORTIE À VALIDER PAR LE CHEF. */
const ALLERGENES = {
  gluten:     ['blé','farine','chapelure','pates','pâtes','boulgour','couscous','semoule','tortilla','pain','wrap','orge','seigle','avoine','sauce soja'],
  crustaces:  ['crevette','crabe','langoustine','homard','ecrevisse','écrevisse'],
  oeufs:      ['oeuf','œuf','mayonnaise'],
  poissons:   ['thon','saumon','merlu','truite','cabillaud','anchois','colin','poisson','lieu','maquereau','sardine'],
  arachides:  ['arachide','cacahuete','cacahuète'],
  soja:       ['soja','tofu','edamame','tempeh'],
  lait:       ['lait','beurre','creme','crème','fromage','yaourt','parmesan','feta','mozzarella','ricotta','mascarpone'],
  fruits_a_coque: ['amande','noix','noisette','cajou','pistache','pecan','pécan','macadamia'],
  celeri:     ['celeri','céleri'],
  moutarde:   ['moutarde'],
  sesame:     ['sesame','sésame','tahini','tahine','tahiné'],
  sulfites:   ['vin blanc','vin rouge','vinaigre de vin'],
  lupin:      ['lupin'],
  mollusques: ['moule','huitre','huître','calamar','encornet','seiche','poulpe','saint-jacques']
};

const LIBELLE_ALLERGENE = {
  gluten:'Gluten', crustaces:'Crustacés', oeufs:'Œufs', poissons:'Poissons',
  arachides:'Arachides', soja:'Soja', lait:'Lait', fruits_a_coque:'Fruits à coque',
  celeri:'Céleri', moutarde:'Moutarde', sesame:'Graines de sésame', sulfites:'Sulfites',
  lupin:'Lupin', mollusques:'Mollusques'
};

function sansAccent(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }

/* Les faux positifs viennent tous du même endroit : un mot contenu dans un
   autre. « bouillon de boeuf » déclenchait « oeuf », « laitue » déclenchait
   « lait ». On compare donc des MOTS ENTIERS, avec une courte liste
   d'expressions qui annulent la détection. */
const ANNULE = {
  gluten:         ['sans gluten'],
  fruits_a_coque: ['noix de coco', 'noix de muscade', 'lait de coco'],
  lait:           ['lait de coco', 'lait de soja', "lait d'amande"]
};

function motEntier(mot){
  const m = sansAccent(mot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + m + 's?([^a-z0-9]|$)');
}

function allergenesDe(ingredients){
  const trouves = new Set();
  for (const ing of ingredients) {
    const n = ' ' + sansAccent(ing.nom) + ' ';
    for (const [cle, mots] of Object.entries(ALLERGENES)) {
      if ((ANNULE[cle] || []).some(x => n.includes(sansAccent(x)))) continue;
      if (mots.some(m => motEntier(m).test(n))) trouves.add(cle);
    }
  }
  return [...trouves].sort();
}

/* ── Calcul ────────────────────────────────────────────────── */
const r1 = v => Math.round(v * 10) / 10;
const parFiche = new Map(FICHES.map(f => [f.nom, f]));
const alertes = [];

function rendementDe(nom){
  const n = sansAccent(nom);
  for (const r of RENDEMENT) if (n.includes(sansAccent(r.cle))) return r;
  return null;
}

const plats = VENTE.map(v => {
  const f = parFiche.get(v.fiche);
  if (!f) {
    throw new Error(`Fiche technique introuvable : « ${v.fiche} » (plat ${v.id}).\n` +
      `Vérifiez l'orthographe exacte dans scripts/fiches-natty.mjs.`);
  }

  let c = 0, p = 0, g = 0, l = 0, masse = 0;
  const ingredients = [];
  const nonChiffres = [];

  for (const ligne of f.ing) {
    const [nom, grammes, quantite] = ligne.split('|');
    const brut = parseFloat(grammes) || 0;

    // 2. rendement : on ne compte que la part comestible
    const rdt = rendementDe(nom);
    const net = rdt ? brut * rdt.coef : brut;
    if (rdt && brut > 0) {
      alertes.push(`${v.id} : « ${nom} » ${brut} g ramenés à ${Math.round(net)} g (${rdt.pourquoi})`);
    }

    masse += net;

    const cor = CORRECTIONS[sansAccent(nom)];
    let nu;
    if (cor) {
      const f0 = net / 100;
      nu = { c: Math.round(cor.c*f0), p: r1(cor.p*f0), l: r1(cor.l*f0), g: r1(cor.g*f0) };
    } else {
      nu = getNutri(nom, net);
    }
    if (nu) { c += nu.c; p += nu.p; g += nu.g; l += nu.l; }
    if (net > 0 && (!nu || (nu.c === 0 && nu.p === 0 && nu.l === 0 && nu.g === 0))) {
      nonChiffres.push(nom);
    }

    ingredients.push({ nom, grammes: Math.round(net), quantite: quantite || '' });
  }

  // L'ordre décroissant de poids est celui qu'impose l'étiquetage.
  ingredients.sort((a, b) => b.grammes - a.grammes);

  // 1. densité, base de tout le reste
  const pour100 = {
    kcal:      masse ? Math.round(c / masse * 100) : 0,
    proteines: masse ? r1(p / masse * 100) : 0,
    glucides:  masse ? r1(g / masse * 100) : 0,
    lipides:   masse ? r1(l / masse * 100) : 0
  };

  // 3. portion = décision × densité
  const k = v.portion / 100;
  const nutrition = {
    kcal:      Math.round(pour100.kcal * k),
    proteines: Math.round(pour100.proteines * k),
    glucides:  Math.round(pour100.glucides * k),
    lipides:   Math.round(pour100.lipides * k)
  };

  // garde-fous
  const b = BORNES[v.cat];
  const hors = [];
  if (nutrition.kcal < b.kcal[0] || nutrition.kcal > b.kcal[1]) {
    hors.push(`${nutrition.kcal} kcal hors de ${b.kcal[0]}–${b.kcal[1]} pour « ${CATEGORIES[v.cat].label} »`);
  }
  if (nutrition.proteines < b.prot_min) {
    hors.push(`${nutrition.proteines} g de protéines, en dessous du plancher de ${b.prot_min} g pour « ${CATEGORIES[v.cat].label} »`);
  }
  if (nonChiffres.length) {
    hors.push(`ingrédient hors table : ${nonChiffres.join(', ')}`);
  }
  // Une portion décidée très loin de celle de la fiche mérite un regard.
  const portionFiche = Math.round(masse / PORTIONS);
  if (Math.abs(v.portion - portionFiche) / portionFiche > 0.45) {
    hors.push(`portion fixée à ${v.portion} g alors que la fiche en donne ${portionFiche} g`);
  }
  for (const h of hors) alertes.push(`${v.id} : ${h}`);

  return {
    id: v.id,
    nom: v.nom,
    categorie: v.cat,
    categorie_label: CATEGORIES[v.cat].label,
    description: v.desc,
    photo: `img/plats/${v.id}.webp`,
    prix: { unite: PRIX.unite, abonnement: PRIX.abonnement },
    portion_g: v.portion,
    pour_100g: pour100,
    nutrition,
    coherent: hors.length === 0,
    nutrition_validee: false,   // ⚠️ passe à true quand le chef a signé
    ingredients,
    allergenes: allergenesDe(ingredients),
    allergenes_valides: false,  // ⚠️ passe à true quand le chef a signé
    fiche_technique: { nom: f.nom, code: f.code || null, portions_fiche: PORTIONS, masse_fiche_g: Math.round(masse) }
  };
});

const sortie = {
  genere_le: new Date().toISOString().slice(0, 10),
  genere_par: 'scripts/gen-plats.mjs',
  avertissement: "Fichier généré. Ne pas éditer à la main : relancer le script. " +
                 "Les valeurs sont calculées depuis les fiches techniques et NON VALIDÉES " +
                 "tant que nutrition_validee et allergenes_valides sont à false. " +
                 "Un plat avec coherent:false ne doit pas être publié en l'état.",
  methode: "Densité pour 100 g calculée depuis la fiche du chef après application des rendements, " +
           "puis multipliée par le poids de portion décidé dans le tableau VENTE du générateur.",
  prix: PRIX,
  categories: CATEGORIES,
  libelles_allergenes: LIBELLE_ALLERGENE,
  plats
};

if (process.argv.includes('--verif')) {
  console.log(`${plats.length} plats lus, ${plats.filter(p=>p.coherent).length} cohérents.`);
} else {
  mkdirSync('data', { recursive: true });
  writeFileSync('data/plats.json', JSON.stringify(sortie, null, 2) + '\n', 'utf8');

  /* Le même contenu en script synchrone. Le site en a besoin : un `fetch`
     ferait apparaître la carte APRÈS le premier rendu. L'app et le
     back-office lisent le .json. Un générateur, deux formats. */
  writeFileSync('data/plats.js',
    '/* Fichier généré par scripts/gen-plats.mjs — ne pas éditer à la main. */\n' +
    'window.NATTY_CATALOGUE = ' + JSON.stringify(sortie) + ';\n', 'utf8');

  console.log(`data/plats.json et data/plats.js écrits — ${plats.length} plats, ` +
              `${plats.filter(p=>p.coherent).length} cohérents.`);
}

console.log('\n┌─ Valeurs retenues ' + '─'.repeat(52));
console.log('│ ' + 'plat'.padEnd(24) + 'portion'.padStart(8) + 'kcal/100g'.padStart(11) + 'kcal'.padStart(7) + 'prot'.padStart(6) + 'gluc'.padStart(6) + 'lip'.padStart(5) + '   état');
for (const p of plats) {
  console.log('│ ' + p.nom.slice(0,23).padEnd(24)
    + (p.portion_g+' g').padStart(8)
    + String(p.pour_100g.kcal).padStart(11)
    + String(p.nutrition.kcal).padStart(7)
    + String(p.nutrition.proteines).padStart(6)
    + String(p.nutrition.glucides).padStart(6)
    + String(p.nutrition.lipides).padStart(5)
    + '   ' + (p.coherent ? 'ok' : '⚠'));
}
console.log('└' + '─'.repeat(70));

if (alertes.length) {
  console.log('\n⚠️  À REGARDER :');
  for (const a of alertes) console.log('   · ' + a);
}
