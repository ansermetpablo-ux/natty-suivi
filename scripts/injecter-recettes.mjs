/* Injecte les recettes du catalogue dans `assets/decouverte.js`.
   Commande :  node scripts/injecter-recettes.mjs [--verif]

   POURQUOI UN SCRIPT. Les macros d'une recette du catalogue sont annoncées PAR
   PORTION, et elles doivent sortir des grammages écrits juste au-dessus — pas
   d'une estimation à vue. Le seul moyen d'en être sûr est de les CALCULER avec
   la table de `assets/core.js`, celle-là même que l'app utilise pour compter un
   repas. Un chiffre tapé à la main dériverait de ses ingrédients à la première
   retouche, sans que rien ne le signale — c'est le défaut d'`api/_nutrition.js`
   (CLAUDE.md §7), et c'est trop facile à reproduire ici.

   ⚠️⚠️ LE CHAMP `g` EST LE POIDS QUE LA TABLE ATTEND, ET POUR LES FÉCULENTS
   C'EST LE POIDS **CUIT**. `riz`, `pates`, `lentilles`, `quinoa`, `boulgour`,
   `semoule` y valent leurs valeurs APRÈS cuisson (riz 130 kcal/100 g, pâtes
   131). Écrire `g:400` pour « 400 g de pâtes sèches » comptait donc 524 kcal
   au lieu de 1 400 — un plat pour quatre sous-compté de moitié, et personne
   pour le signaler. Le `qte` affiché dit le poids CRU (c'est ce qu'on pèse) et
   mentionne le cuit entre parenthèses ; `g` porte le cuit. Facteurs :
   riz ×2,6 · pâtes ×2,4 · lentilles et légumes secs ×2,4 · quinoa ×3 ·
   boulgour ×2,8. Les flocons d'avoine, eux, sont à sec dans la table (389).

   `--verif` ne réécrit rien : il recalcule les macros des recettes DÉJÀ dans le
   fichier et signale celles qui ont dérivé, plus les ingrédients que la table
   ne sait pas chiffrer. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CIBLE = path.join(RACINE, 'assets/decouverte.js');
const SOURCE = path.join(RACINE, 'scripts/recettes-catalogue.json');

/* La table nutritionnelle, lue depuis core.js — pas recopiée. */
global.window = global;
global.document = { addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {} } }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild() {} }, body: { appendChild() {} } };
global.localStorage = { getItem: () => null, setItem() {} };
global.location = { search: '', href: '', pathname: '/' };

const core = fs.readFileSync(path.join(RACINE, 'assets/core.js'), 'utf8');
const Natty = new Function('window', core + '; return Natty;')(global);

const inconnus = new Map();

/* Les 16 gestes que `assets/recette.js` sait dessiner. ⚠️ Une clé inconnue ne
   plante pas : elle retombe en silence sur `melanger`, donc on dessinerait un
   saladier pour une cuisson au four. C'est exactement le genre d'erreur qu'on
   ne voit qu'en déroulant les 114 recettes une par une — autant la refuser ici. */
const ILLUS = ['couper','saisir','bouillir','mijoter','enfourner','melanger','fouetter',
  'mixer','assaisonner','huiler','rincer','peser','refrigerer','reposer','attendre','dresser'];
const illusKo = [];

/** Les macros PAR PORTION, calculées sur les grammages de la recette. */
export function macrosDe(r) {
  let c = 0, p = 0, g = 0, l = 0;
  for (const i of r.ing) {
    if (!i.g) continue;                       // sel, épices, eau : rien à compter
    /* ⚠️ `getNutri(nom, grammes)` applique DÉJÀ la quantité — il ne rend pas
       des valeurs pour 100 g. Appelé sans le second argument il rend des zéros
       sans le dire (l'objet est bien là, tous ses champs à 0), et toutes les
       recettes sortaient à « 0 kcal ». Vu au banc, pas à la lecture. */
    const n = Natty.getNutri(i.nu || i.nom, i.g);
    if (!n) { inconnus.set((i.nu || i.nom).toLowerCase(), (inconnus.get((i.nu || i.nom).toLowerCase()) || 0) + 1); continue; }
    c += n.c; p += n.p; g += n.g; l += n.l;
  }
  const n = r.portions || 1;
  return { p: Math.round(p / n), g: Math.round(g / n), l: Math.round(l / n), kcal: Math.round(c / n) };
}

/* ⚠️ Guillemets simples ET antislashs : le fichier cible est écrit en quotes
   simples, et un `\` non échappé dans un texte casserait tout le module. */
const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

function blocRec(r) {
  const m = macrosDe(r);
  const ing = r.ing.map(i =>
    `              { em:${q(i.em)}, nom:${q(i.nom)}, qte:${q(i.qte)}${i.g ? `, g:${i.g}` : ''}${i.nu ? `, nu:${q(i.nu)}` : ''} }`
  ).join(',\n');
  const steps = r.steps.map(s => {
    if (ILLUS.indexOf(s.illu) < 0) illusKo.push(`${r.cle} → « ${s.illu} »`);
    const qt = s.qte && s.qte.length
      ? `\n                qte:[${s.qte.map(x => `{ nom:${q(x[0])}, qte:${q(x[1])} }`).join(', ')}],`
      : '';
    return `              { illu:${q(s.illu)}, t:${q(s.t)}, duree_min:${s.min},\n`
      + `                detail:${q(s.detail)},${qt}\n`
      + `                tip:${q(s.tip)} }`;
  }).join(',\n');
  return `          rec:{\n`
    + `            temps_min:${r.temps}, portions:${r.portions},\n`
    + `            macros:{ p:${m.p}, g:${m.g}, l:${m.l}, kcal:${m.kcal} },\n`
    + `            ingredients:[\n${ing}\n            ],\n`
    + `            steps:[\n${steps}\n            ]\n`
    + `          }`;
}

const verif = process.argv.includes('--verif');
const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
let src = fs.readFileSync(CIBLE, 'utf8');
let pose = 0, deja = 0, absents = [];

for (const r of data) {
  /* On repère le plat par sa clé, puis la fin de son champ `nu:'…'` — le
     dernier champ d'un plat sans recette. L'insertion se fait juste après. */
  const i = src.indexOf(`cle:'${r.cle}'`);
  if (i < 0) { absents.push(r.cle); continue; }
  const finPlat = src.indexOf('\n', src.indexOf(' }', i));
  const bloc = src.slice(i, i + 4000);
  if (/\n\s*rec:\{/.test(bloc.slice(0, bloc.indexOf("cle:'", 6) + 1 || bloc.length))) { deja++; continue; }
  // fin du champ `nu:'...'` : on cherche la fermeture ` }` de l'objet plat
  const mNu = /nu:'(?:[^'\\]|\\.)*'/g;
  mNu.lastIndex = i;
  const nu = mNu.exec(src);
  if (!nu) { absents.push(r.cle + ' (nu introuvable)'); continue; }
  const insert = nu.index + nu[0].length;
  const bl = blocRec(r);
  if (verif) { const m = macrosDe(r); console.log('   ' + r.cle.padEnd(26) + ' ' + String(m.kcal).padStart(4) + ' kcal · ' + String(m.p).padStart(3) + ' P · ' + String(m.g).padStart(3) + ' G · ' + String(m.l).padStart(3) + ' L  (' + r.portions + ' portions, ' + r.steps.length + ' étapes)'); }
  src = src.slice(0, insert) + ',\n' + bl + src.slice(insert);
  pose++;
}

if (!verif) fs.writeFileSync(CIBLE, src);
console.log(`${pose} recette(s) posée(s), ${deja} déjà présente(s)${absents.length ? ', ABSENTS : ' + absents.join(', ') : ''}`);
if (illusKo.length) {
  console.log('\n🔴 Gestes inconnus de `assets/recette.js` (dessineraient un saladier) :');
  illusKo.forEach(x => console.log('   ' + x));
  process.exitCode = 1;
}
if (inconnus.size) {
  console.log('\n⚠️ Ingrédients que la table ne sait pas chiffrer (comptés 0) :');
  [...inconnus.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, k]) => console.log('   ' + n + ' ×' + k));
}
