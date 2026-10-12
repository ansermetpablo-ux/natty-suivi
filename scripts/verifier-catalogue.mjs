/* ═══════════════════════════════════════════════════════════════
   Natty — vérification du catalogue publié

       npm test        (ou : node scripts/verifier-catalogue.mjs)

   Sort avec un code non nul dès qu'une de ces conditions tombe :

   1. data/plats.json et data/plats.js sont exactement ce que
      scripts/gen-plats.mjs produit ;
   2. chaque fichier écrit par scripts/build-wix.mjs (la carte, les
      composants des pages et leur code Velo — liste dans
      scripts/wix-composants.mjs) est exactement ce que le générateur
      produit ;
   3. pour chaque plat, portion_reference_g = masse_fiche_g / portions_fiche
      arrondi à 5 g, à 1 g près ;
   4. pour chaque plat, nutrition = pour_100g × portion / 100, à 1 unité
      près sur chaque macro ;
   5. aucun plat coherent:true n'est hors des bornes de BORNES ;
   6. api/_nutrition.js n'a pas divergé d'assets/core.js
      (node scripts/gen-nutrition.mjs --verif).

   POURQUOI. Les portions du site ont été des nombres écrits à la main,
   sans rapport avec ce que les recettes produisent : jusqu'à 43 % d'écart,
   le curry annoncé à 617 kcal pour une part qui en fait 973, et en ligne.
   Ce script rend cette erreur impossible à fusionner sans le voir.

   CE QU'IL NE FAIT PAS : réécrire un fichier suivi. Les générateurs sont
   relancés dans un répertoire temporaire, sur une copie du dépôt, avec la
   date du catalogue en place (NATTY_DATE) — sinon un catalogue produit un
   autre jour différerait par sa seule date.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, mkdtempSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SOURCES, SORTIES } from './wix-composants.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const echecs = [];
const ok = m => console.log('  ✓ ' + m);
const ko = m => { echecs.push(m); console.log('  ✗ ' + m); };

function lire(rel, base = RACINE) { return readFileSync(join(base, rel)); }

function lancer(script, cwd, env = {}, args = []) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd, env: { ...process.env, ...env }, encoding: 'utf8'
  });
  return r;
}

/* Premier octet qui diffère, pour dire EN QUOI deux fichiers divergent. */
function premiereDifference(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return null;
  const ligne = a.subarray(0, i).toString('utf8').split('\n').length;
  const extrait = buf => buf.subarray(i, i + 60).toString('utf8').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  return `ligne ${ligne}, octet ${i} : suivi « ${extrait(a)} » / produit « ${extrait(b)} »`
    + (a.length !== b.length ? ` (tailles ${a.length} / ${b.length})` : '');
}

/* ── 0. Le catalogue suivi ─────────────────────────────────── */
const catalogue = JSON.parse(lire('data/plats.json').toString('utf8'));
const plats = catalogue.plats || [];
console.log(`Catalogue : ${plats.length} plats, généré le ${catalogue.genere_le}.\n`);

/* ── 1 & 2. Les générateurs, relancés à côté ───────────────── */
console.log('Reproductibilité des fichiers générés');
const tmp = mkdtempSync(join(tmpdir(), 'natty-verif-'));
try {
  for (const d of SOURCES) cpSync(join(RACINE, d), join(tmp, d), { recursive: true });
  mkdirSync(join(tmp, 'data'), { recursive: true });
  // Les sorties suivies sont retirées de la copie : elles doivent renaître du générateur.
  for (const f of SORTIES) rmSync(join(tmp, f), { force: true });

  const env = { NATTY_DATE: catalogue.genere_le };
  const gen = lancer('scripts/gen-plats.mjs', tmp, env);
  if (gen.status !== 0) {
    ko('gen-plats.mjs a échoué :\n' + (gen.stderr || gen.stdout).trim().split('\n').slice(0, 6).join('\n'));
  } else {
    for (const f of ['data/plats.json', 'data/plats.js']) {
      const diff = premiereDifference(lire(f), lire(f, tmp));
      diff ? ko(`${f} diffère de ce que gen-plats.mjs produit — ${diff}`) : ok(`${f} identique à la sortie de gen-plats.mjs`);
    }
    const bw = lancer('scripts/build-wix.mjs', tmp, env);
    if (bw.status !== 0) {
      ko('build-wix.mjs a échoué :\n' + (bw.stderr || bw.stdout).trim().split('\n').slice(0, 6).join('\n'));
    } else {
      for (const rel of SORTIES) {
        if (!existsSync(join(tmp, rel))) { ko(`${rel} n'a pas été produit par build-wix.mjs`); continue; }
        if (!existsSync(join(RACINE, rel))) { ko(`${rel} est produit par build-wix.mjs mais absent du dépôt`); continue; }
        const diff = premiereDifference(lire(rel), lire(rel, tmp));
        diff ? ko(`${rel} diffère de ce que build-wix.mjs produit — ${diff}`) : ok(`${rel} identique à la sortie de build-wix.mjs`);
      }
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

/* ── 3 & 4. Les chiffres de chaque plat ───────────────────── */
console.log('\nCohérence des chiffres, plat par plat');
const MACROS = ['kcal', 'proteines', 'glucides', 'lipides'];
for (const p of plats) {
  const f = p.fiche_technique || {};
  const attendue = Math.round(f.masse_fiche_g / f.portions_fiche / 5) * 5;
  if (!(f.masse_fiche_g > 0 && f.portions_fiche > 0)) {
    ko(`${p.id} : fiche technique sans masse ni nombre de portions`);
  } else if (Math.abs(p.portion_reference_g - attendue) > 1) {
    ko(`${p.id} : portion ${p.portion_reference_g} g, la fiche donne ${f.masse_fiche_g} g / ${f.portions_fiche} = ${attendue} g`);
  }
  for (const k of MACROS) {
    const calc = p.pour_100g[k] * p.portion_reference_g / 100;
    if (typeof p.nutrition[k] !== 'number' || Math.abs(calc - p.nutrition[k]) > 1) {
      ko(`${p.id} : ${k} = ${p.nutrition[k]}, attendu ${calc.toFixed(1)} (${p.pour_100g[k]} pour 100 g × ${p.portion_reference_g} g)`);
    }
  }
}
if (!echecs.some(e => /: (portion|kcal|proteines|glucides|lipides|fiche)/.test(e))) ok(`${plats.length} plats : portions et macros cohérentes`);

/* ── 5. Les bornes, lues dans le générateur ───────────────── */
/* BORNES n'est pas exporté (gen-plats.mjs écrit ses fichiers à l'import) :
   on lit le littéral dans la source. Une copie ici serait exactement la
   seconde table qui diverge. */
console.log('\nBornes des plats publiés');
const srcGen = lire('scripts/gen-plats.mjs').toString('utf8');
const m = srcGen.match(/const BORNES\s*=\s*(\{[\s\S]*?\n\});/);
if (!m) {
  ko('BORNES introuvable dans scripts/gen-plats.mjs');
} else {
  const BORNES = new Function('return ' + m[1])();
  let n = 0;
  for (const p of plats.filter(x => x.coherent === true)) {
    const b = BORNES[p.categorie];
    if (!b) { ko(`${p.id} : catégorie « ${p.categorie} » absente de BORNES`); continue; }
    if (p.nutrition.kcal < b.kcal[0] || p.nutrition.kcal > b.kcal[1]) {
      ko(`${p.id} : publié à ${p.nutrition.kcal} kcal, hors de ${b.kcal[0]}–${b.kcal[1]} (${p.categorie})`);
    } else if (b.prot_min != null && p.nutrition.proteines < b.prot_min) {
      ko(`${p.id} : publié à ${p.nutrition.proteines} g de protéines, sous le plancher de ${b.prot_min} g`);
    } else n++;
  }
  const caches = plats.filter(x => x.coherent !== true).map(x => x.id);
  ok(`${n} plats publiés dans leurs bornes` + (caches.length ? ` (non publiés : ${caches.join(', ')})` : ''));
}

/* ── 6. La table serveur contre la table de l'app ─────────── */
console.log('\nTable nutritionnelle serveur');
const gn = lancer('scripts/gen-nutrition.mjs', RACINE, {}, ['--verif']);
const sortie = (gn.stdout || '').trim().split('\n').pop();
if (gn.status !== 0) ko('gen-nutrition.mjs --verif a échoué : ' + (sortie || (gn.stderr || '').trim()));
else ok(sortie);

/* ── Verdict ─────────────────────────────────────────────── */
console.log(echecs.length
  ? `\n✗ ${echecs.length} contrôle(s) en échec.`
  : '\n✓ Catalogue vérifié.');
process.exit(echecs.length ? 1 : 0);
