/* Régénère la table `NT` d'`api/_nutrition.js` depuis `assets/core.js`.
   Commande :  node scripts/gen-nutrition.mjs [--verif]

   POURQUOI CE SCRIPT EXISTE. L'en-tête d'`api/_nutrition.js` demandait de
   recoller la table À LA MAIN, avec un bout de Python à copier depuis un
   commentaire. C'est précisément la manœuvre qui a laissé les deux tables
   diverger pendant des mois : « pomme de terre » comptait pour une pomme côté
   serveur, donc le rappel du soir annonçait d'autres grammes que l'écran, et
   c'est l'app qui avait l'air d'avoir tort (CLAUDE.md §7). Une copie qu'on
   refait d'une commande ne dérive pas ; une copie qu'on recolle à la main, si.

   ⚠️ Seule la table est régénérée. `getNutri` et `normNom` restent écrits des
   deux côtés : ce sont des FONCTIONS, elles se relisent, et les recopier
   automatiquement demanderait de deviner où elles commencent et finissent.
   `--verif` les compare sur une batterie de cas et signale tout écart. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RACINE, 'assets/core.js');
const OUT = path.join(RACINE, 'api/_nutrition.js');
const verif = process.argv.includes('--verif');

const core = fs.readFileSync(SRC, 'utf8');
const i = core.indexOf('  var NT = {');
const j = core.indexOf('\n  };', i);
if (i < 0 || j < 0) { console.error('Table NT introuvable dans assets/core.js'); process.exit(1); }
/* Le corps de la table, dédenté d'un niveau : `core.js` l'écrit dans une IIFE,
   `_nutrition.js` au premier niveau du module. */
const corps = core.slice(i + '  var NT = {'.length, j)
  .split('\n').map(l => (l.startsWith('  ') ? l.slice(2) : l)).join('\n');

let out = fs.readFileSync(OUT, 'utf8');
const k = out.indexOf('const NT = {');
if (k < 0) { console.error('Table NT introuvable dans api/_nutrition.js'); process.exit(1); }
const deb = k + 'const NT = {'.length;
let off = deb, fin = -1;
for (const l of out.slice(deb).split('\n')) {
  if (l.trim() === '}') { fin = off; break; }
  off += l.length + 1;
}
if (fin < 0) { console.error('Fermeture de NT introuvable'); process.exit(1); }

const avant = out.slice(deb, fin);
if (!verif) {
  fs.writeFileSync(OUT, out.slice(0, deb) + corps + '\n' + out.slice(fin));
  out = fs.readFileSync(OUT, 'utf8');
}

/* ── Le contrôle : les deux `getNutri` doivent rendre la même chose ── */
globalThis.window = globalThis;
const nul = () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {} } });
globalThis.document = { addEventListener() {}, createElement: nul, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: nul(), body: nul() };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.location = { search: '', href: '', pathname: '/' };
const N = new Function('window', core + '; return Natty;')(globalThis);
const S = new Function(out.replace(/^export /gm, '') + '; return { getNutri };')();

/* Les pièges documentés en §7, plus tout ce qui a déjà cassé une fois. */
const CAS = ['pomme de terre', 'pomme', 'huile olive', 'huile', 'ail', 'volaille', 'oeufs',
  'blanc d oeuf', 'boeuf', 'saucisson', 'whey isolate chocolat', 'salade de poulet',
  'pate de campagne', 'pates', 'pate brisee', 'pate a pizza', 'creme', 'creme fraiche',
  'farine', 'cheddar', 'granola', 'lait de coco', 'boisson coco', 'coco', 'riz', 'citron',
  'banane', 'courgette', 'epinard', 'epinards', 'basilique', 'steack', 'petits poids',
  'jus de pomme', 'the', 'jus', 'marcos en boite'];
let ko = 0;
for (const n of CAS) {
  for (const q of [100, 137]) {
    const a = JSON.stringify(N.getNutri(n, q)), b = JSON.stringify(S.getNutri(n, q));
    if (a !== b) { ko++; console.log(`ÉCART « ${n} » à ${q} g : ${a} vs ${b}`); }
  }
}
const cles = s => (s.match(/'[^']+':\{/g) || []).length;
console.log(`${verif ? 'Vérification' : 'Table régénérée'} — ${cles(corps)} aliments `
  + `(${avant.trimEnd() === corps.trimEnd() ? 'identique' : 'MISE À JOUR'}), A/B sur ${CAS.length * 2} appels : `
  + (ko ? `❌ ${ko} écart(s)` : '✅ 0 écart'));
if (ko) process.exitCode = 1;
