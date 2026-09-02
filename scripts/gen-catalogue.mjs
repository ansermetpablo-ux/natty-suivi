/* Régénère `api/_catalogue.js` depuis `assets/decouverte.js`.
   Commande :  node scripts/gen-catalogue.mjs

   POURQUOI UN SCRIPT ET PAS UNE COPIE À LA MAIN. `api/_nutrition.js` est une
   copie manuelle de la table de `assets/core.js` — elle a divergé en silence
   et « pomme de terre » a compté pour une pomme pendant des mois, dans les
   notifications push, pendant que l'écran disait autre chose (CLAUDE.md §3).
   Une copie mécanique ne se signale jamais elle-même quand la source bouge.
   Ici la copie est REGÉNÉRÉE, jamais éditée : le seul geste correct après
   avoir touché au catalogue est de relancer cette commande. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RACINE, 'assets/decouverte.js');
const OUT = path.join(RACINE, 'api/_catalogue.js');

/* On évalue le module dans une doublure de `window` : c'est la source de
   vérité elle-même qu'on lit, pas une réécriture de son contenu. */
const src = fs.readFileSync(SRC, 'utf8');
/* ⚠️ Une doublure de `document` est nécessaire depuis que le module pose
   lui-même sa délégation de clic (passe « Découvrir partagé », 2026-09-02) :
   sans elle, ce script meurt sur `document is not defined` — et c'est le seul
   endroit d'où `api/_catalogue.js` peut être régénéré. */
const nul = () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {} } });
globalThis.document = { addEventListener() {}, createElement: nul, getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], head: nul(), body: nul() };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const sandbox = { window: globalThis };
const D = new Function('window', src + '; return NattyDecouverte;')(sandbox.window);

/* ⚠️ `D.cuisines()` NE REND QUE LES PLATS PHOTOGRAPHIÉS, et c'est voulu : la
   génération de la semaine place ses plats dans un calendrier de vignettes, un
   plat sans image y arriverait sous un dessin au trait au milieu d'assiettes
   (demande de Pablo, 2026-08-31). Les plats illustrés restent au catalogue du
   navigateur — `platParCle()` doit continuer de les résoudre pour les semaines
   déjà planifiées — mais ils ne sont plus proposés au modèle. */
const cuisines = D.cuisines();
const plats = [];
cuisines.forEach(c => {
  c.plats.forEach(p => {
    plats.push({
      cle: p.cle,
      n: p.n,
      pays: c.nom,
      // Les ingrédients SANS leur emoji : le serveur s'en sert pour décrire le
      // plat au modèle, et les emojis ne feraient que gonfler le prompt.
      i: p.i.split('|').map(s => s.slice(s.indexOf(' ') + 1)).join(', '),
      t: p.t.join(', ')
    });
  });
});

const entete = `/* ═══════════════════════════════════════════════════════════
   Natty — le catalogue des plats, côté SERVEUR
   ───────────────────────────────────────────────────────────
   ⚠️ FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
       node scripts/gen-catalogue.mjs

   Pourquoi il existe : \`assets/decouverte.js\` est une IIFE de navigateur,
   le serveur ne peut pas l'importer. Et le cron du lundi
   (\`api/conseils-hebdo\`) n'a aucun client sous la main pour la lui passer
   dans le corps de la requête, contrairement au garde-manger.

   ⚠️ CE MONTAGE A DÉJÀ COÛTÉ CHER UNE FOIS. \`api/_nutrition.js\` est la même
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

`;

const corps = 'export const CATALOGUE = '
  + JSON.stringify(plats, null, 0).replace(/\},\{/g, '},\n  {').replace(/^\[/, '[\n  ').replace(/\]$/, '\n]')
  + ';\n\n'
  + '/** Le plat du catalogue portant cette clé, ou null. */\n'
  + 'export function platParCle(cle) {\n'
  + '  return CATALOGUE.filter(p => p.cle === cle)[0] || null;\n'
  + '}\n\n'
  + '/** La liste compacte donnée au modèle pour qu\'il choisisse. */\n'
  + 'export function listePourPrompt() {\n'
  + '  return CATALOGUE.map(p => `${p.cle} | ${p.n} (${p.pays}) | ${p.i}`).join(\'\\n\');\n'
  + '}\n';

fs.writeFileSync(OUT, entete + corps);

console.log(`api/_catalogue.js régénéré — ${plats.length} plats, ${cuisines.length} cuisines`);
console.log(`  taille du fichier      : ${fs.statSync(OUT).size} octets`);
