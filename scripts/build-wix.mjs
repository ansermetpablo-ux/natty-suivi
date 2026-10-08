/* ═══════════════════════════════════════════════════════════════
   Natty — fabrication du Custom Element pour Wix Studio

       node scripts/gen-plats.mjs     (d'abord : produit data/plats.json)
       node scripts/build-wix.mjs     (ensuite : produit wix/natty-carte.js)

   Ce que fait ce script, et uniquement ça : prendre wix/natty-carte.src.js
   et y remplacer le marqueur `/*__CATALOGUE__* / null` par le contenu de
   data/plats.json. Le fichier produit est autonome — aucune requête au
   chargement, donc la carte est là au premier rendu.

   POURQUOI INJECTER PLUTÔT QUE FETCH. Wix sert le composant depuis notre
   domaine mais la page depuis le sien. Un fetch croise deux origines, il
   faut des en-têtes CORS, et surtout la carte apparaîtrait APRÈS le
   premier rendu — un trou blanc au milieu de la page, puis les plats.
   Le catalogue pèse une douzaine de kilo-octets : il tient dans le script.

   ⚠️ NE JAMAIS ÉDITER wix/natty-carte.js À LA MAIN. C'est la règle qui
   a déjà été apprise à nos dépens avec api/_nutrition.js : une copie
   manuelle finit toujours par diverger de son original. On édite le
   .src.js ou le générateur, et on relance.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'wix/natty-carte.src.js';
const OUT = 'wix/natty-carte.js';
const MARQUEUR = '/*__CATALOGUE__*/ null';

let modele;
try {
  modele = readFileSync(SRC, 'utf8');
} catch (e) {
  throw new Error(`${SRC} introuvable. Lancez ce script depuis la racine du dépôt.`);
}

let catalogue;
try {
  catalogue = JSON.parse(readFileSync('data/plats.json', 'utf8'));
} catch (e) {
  throw new Error("data/plats.json introuvable ou illisible. Lancez d'abord : node scripts/gen-plats.mjs");
}

if (!modele.includes(MARQUEUR)) {
  throw new Error(`Le marqueur ${MARQUEUR} a disparu de ${SRC}. Le script ne sait plus où écrire le catalogue.`);
}

const publiables = catalogue.plats.filter(p => p.coherent !== false);
if (!publiables.length) {
  throw new Error("Aucun plat cohérent dans data/plats.json : rien à publier. Corrigez les alertes de gen-plats.mjs d'abord.");
}

const entete = `/* Natty — <natty-carte> pour Wix Studio.
   FICHIER GÉNÉRÉ par scripts/build-wix.mjs le ${new Date().toISOString().slice(0, 10)}.
   Ne pas éditer à la main : modifier wix/natty-carte.src.js et relancer.
   Catalogue : ${publiables.length} plats publiables sur ${catalogue.plats.length}. */
`;

const sortie = entete + modele.replace(MARQUEUR, JSON.stringify(catalogue));

mkdirSync('wix', { recursive: true });
writeFileSync(OUT, sortie, 'utf8');

const ko = Math.round(Buffer.byteLength(sortie, 'utf8') / 1024);
console.log(`${OUT} écrit — ${ko} Ko, ${publiables.length} plats.`);

const caches = catalogue.plats.filter(p => p.coherent === false);
if (caches.length) {
  console.log('\nNon publiés (marqués incohérents par gen-plats.mjs) :');
  for (const p of caches) console.log('   · ' + p.nom);
}

console.log(`
À faire ensuite :
  1. déposer ${OUT} sur le dépôt, il sera servi par Vercel
  2. dans Wix Studio : Ajouter → Embed & Social → Custom Element
     Nom de balise : natty-carte
     Source        : Server URL
     URL           : https://natty-suivi.vercel.app/wix/natty-carte.js
`);
