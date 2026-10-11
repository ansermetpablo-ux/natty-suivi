/* ═══════════════════════════════════════════════════════════════
   Natty — fabrication des Custom Elements pour Wix Studio

       node scripts/gen-plats.mjs     (d'abord : produit data/plats.json)
       node scripts/build-wix.mjs     (ensuite : produit wix/natty-carte.js
                                       et wix/natty-site.js)

   Ce que fait ce script, et uniquement ça : prendre chaque modèle
   wix/*.src.js et y remplacer le marqueur `/*__CATALOGUE__* / null` par le
   contenu de data/plats.json. Les fichiers produits sont autonomes —
   aucune requête au chargement, donc la carte est là au premier rendu.

   · <natty-carte> : la carte seule, posée dans une page Wix native.
   · <natty-site>  : la page d'accueil entière (refonte du 11/10/2026),
                     carte comprise, avec tiroir de fiche et sélection.

   POURQUOI INJECTER PLUTÔT QUE FETCH. Wix sert le composant depuis notre
   domaine mais la page depuis le sien. Un fetch croise deux origines, il
   faut des en-têtes CORS, et surtout la carte apparaîtrait APRÈS le
   premier rendu — un trou blanc au milieu de la page, puis les plats.
   Le catalogue pèse une douzaine de kilo-octets : il tient dans le script.

   ⚠️ NE JAMAIS ÉDITER wix/natty-carte.js NI wix/natty-site.js À LA MAIN.
   C'est la règle qui a déjà été apprise à nos dépens avec api/_nutrition.js :
   une copie manuelle finit toujours par diverger de son original. On édite
   le .src.js ou le générateur, et on relance.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const MARQUEUR = '/*__CATALOGUE__*/ null';
const COMPOSANTS = [
  { src: 'wix/natty-carte.src.js', out: 'wix/natty-carte.js', balise: 'natty-carte',
    titre: '<natty-carte> pour Wix Studio' },
  { src: 'wix/natty-site.src.js',  out: 'wix/natty-site.js',  balise: 'natty-site',
    titre: '<natty-site>, page d\'accueil pour Wix Studio' }
];

let catalogue;
try {
  catalogue = JSON.parse(readFileSync('data/plats.json', 'utf8'));
} catch (e) {
  throw new Error("data/plats.json introuvable ou illisible. Lancez d'abord : node scripts/gen-plats.mjs");
}

const publiables = catalogue.plats.filter(p => p.coherent !== false);
if (!publiables.length) {
  throw new Error("Aucun plat cohérent dans data/plats.json : rien à publier. Corrigez les alertes de gen-plats.mjs d'abord.");
}

mkdirSync('wix', { recursive: true });

for (const c of COMPOSANTS) {
  let modele;
  try {
    modele = readFileSync(c.src, 'utf8');
  } catch (e) {
    throw new Error(`${c.src} introuvable. Lancez ce script depuis la racine du dépôt.`);
  }
  if (!modele.includes(MARQUEUR)) {
    throw new Error(`Le marqueur ${MARQUEUR} a disparu de ${c.src}. Le script ne sait plus où écrire le catalogue.`);
  }

  const entete = `/* Natty — ${c.titre}.
   FICHIER GÉNÉRÉ par scripts/build-wix.mjs le ${new Date().toISOString().slice(0, 10)}.
   Ne pas éditer à la main : modifier ${c.src} et relancer.
   Catalogue : ${publiables.length} plats publiables sur ${catalogue.plats.length}. */
`;

  const sortie = entete + modele.replace(MARQUEUR, JSON.stringify(catalogue));
  writeFileSync(c.out, sortie, 'utf8');

  const ko = Math.round(Buffer.byteLength(sortie, 'utf8') / 1024);
  console.log(`${c.out} écrit — ${ko} Ko, ${publiables.length} plats.`);
}

const caches = catalogue.plats.filter(p => p.coherent === false);
if (caches.length) {
  console.log('\nNon publiés (marqués incohérents par gen-plats.mjs) :');
  for (const p of caches) console.log('   · ' + p.nom);
}

console.log(`
À faire ensuite :
  1. déposer les fichiers wix/*.js sur le dépôt, ils seront servis par Vercel
  2. dans Wix Studio : Ajouter → Embed & Social → Custom Element
     Source : Server URL
${COMPOSANTS.map(c => `     · balise ${c.balise.padEnd(12)} URL https://natty-suivi.vercel.app/${c.out}`).join('\n')}
`);
