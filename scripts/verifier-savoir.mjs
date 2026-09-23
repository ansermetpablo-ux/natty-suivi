/* scripts/verifier-savoir.mjs — chaque étape de production a-t-elle un cours
   qui parle de l'aliment qu'on a dans les mains ?
   ═══════════════════════════════════════════════════════════════════════════
   node scripts/verifier-savoir.mjs
   node scripts/verifier-savoir.mjs --detail    (liste les couples en repli)

   ⚠️ POURQUOI CE FICHIER EXISTE. `assets/admin-savoir.js` donne un cours par
   GESTE × FAMILLE d'aliment, avec un repli `_` par geste quand aucune famille
   ne correspond. Ce repli ne lève rien, ne se voit pas à la lecture, et
   s'affiche exactement comme un vrai cours : le cuisinier lit « peser,
   refroidir, fermer » sans qu'on lui dise qu'une sauce de braisé fige, qu'un
   riz boit ou qu'un filet se casse. Un savoir écrit et jamais atteint est le
   défaut maison de ce dépôt (le `K_ENTERS` de narration.html, jamais appelé).
   Mesuré la première fois le 2026-09-23 : 98 des 490 tâches (20 %) étaient en
   repli, dont TOUT le dressage (63/63) et le refroidissement d'un plat chaud
   (17), c'est-à-dire la fin de journée et le seul point sanitaire de la
   production. Deux de ces trous n'étaient pas des manques mais des CÂBLAGES —
   le cours du riz rincé existait sous `rincer.graines` et n'était jamais
   montré, `riz` étant une famille à part.

   ⚠️ IL REPRODUIT L'ÉCRAN, PAS UNE IDÉE DE L'ÉCRAN : l'éclatement
   « 1 ingrédient = 1 étape » et l'ordre des candidats de `reperesGeste()` sont
   EXTRAITS d'`assets/admin-production.js`, et le module de savoir est chargé
   tel quel. Une recopie ne prouverait que la recopie.

   ⚠️ LA SOURCE DES ÉTAPES EST `scripts/fiches-natty.mjs`, pas la base : depuis
   l'activation des RLS, `recettes_etapes` ne répond plus à la clé anon. C'est
   le même contenu — ce script est ce qui a été importé —, mais une fiche
   retouchée EN BASE et pas ici passerait sous le radar. */
import fs from 'node:fs';
import { FICHES } from './fiches-natty.mjs';

const RACINE = new URL('..', import.meta.url).pathname;
const lire = (p) => fs.readFileSync(RACINE + p, 'utf8');

/* le module de savoir, chargé tel quel dans une doublure de `window` */
const win = {};
new Function('window', lire('assets/admin-savoir.js'))(win);
const SAVOIR = win.NattySavoir;
if (!SAVOIR) throw new Error('NattySavoir absent — assets/admin-savoir.js a changé de forme');

/* les helpers de l'écran Production, extraits de leur fichier */
function extraire(src, nom) {
  const i = src.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('introuvable dans admin-production.js : ' + nom);
  let p = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') p++; else if (src[k] === '}') { p--; if (!p) break; } }
  return src.slice(i, k + 1);
}
const PROD = lire('assets/admin-production.js');
const { norm, motsAliment } = new Function(
  extraire(PROD, 'norm') + extraire(PROD, 'motsAliment') + 'return { norm, motsAliment };')();

/* l'ordre des candidats de reperesGeste() — lu dans le fichier, pas supposé */
const mParTitre = /var parTitre = \[([^\]]*)\]/.exec(PROD);
if (!mParTitre) throw new Error('reperesGeste() a changé de forme : parTitre introuvable');
const PAR_TITRE = mParTitre[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);

/* l'éclatement « 1 ingrédient = 1 étape » */
function ingredientsEtape(aliment, ings) {
  const mots = motsAliment(aliment);
  if (!mots.length) return [];
  return ings.filter((i) => {
    const n = norm(i.nom).split(' ').map((m) => m.replace(/s$/, ''));
    return mots.some((m) => n.indexOf(m) >= 0) && i.g > 0;
  });
}

let total = 0, avecFamille = 0, repli = 0, sansCours = 0;
const manques = new Map(), parGeste = new Map();

for (const f of FICHES) {
  const ings = (f.ing || []).map((l) => { const p = l.split('|'); return { nom: p[0], g: parseFloat(p[1]) || 0 }; });
  for (const ligne of (f.etapes || [])) {
    const p = ligne.split('|');
    const geste = (p[0] || '').trim(), aliment = (p[1] || '').trim();
    const passif = /P/.test(p[3] || ''), titre = (p[4] || '').trim();
    const ing = ingredientsEtape(aliment, ings);
    const parts = (!passif && ing.length > 1) ? ing : [null];
    for (const x of parts) {
      total++;
      const alimentTache = x ? x.nom : aliment;
      const cands = (PAR_TITRE.indexOf(geste) >= 0
        ? [titre, aliment, alimentTache] : [alimentTache, aliment, titre]).filter(Boolean);
      const r = SAVOIR.pour(geste, cands);
      const g = parGeste.get(geste) || { n: 0, fam: 0 }; g.n++;
      if (!r) sansCours++;
      else if (r.famille) { avecFamille++; g.fam++; }
      else {
        repli++;
        const fam = cands.map((c) => SAVOIR.famille(c)).find(Boolean) || '(aucune famille)';
        const cle = geste + ' × ' + fam;
        const e = manques.get(cle) || { n: 0, ex: [] };
        e.n++;
        if (e.ex.length < 3) e.ex.push(f.nom.slice(0, 24) + ' · ' + (alimentTache || titre));
        manques.set(cle, e);
      }
      parGeste.set(geste, g);
    }
  }
}

console.log(`${FICHES.length} fiches · ${total} tâches de production (1 ingrédient = 1 étape)`);
console.log(`  cours propre à la famille : ${avecFamille} (${Math.round(avecFamille / total * 100)} %)`);
console.log(`  repli \`_\` du geste        : ${repli}`);
console.log(`  aucun cours du tout       : ${sansCours}`);
if (process.argv.includes('--detail') || repli || sansCours) {
  console.log('\nPar geste (avec famille / total) :');
  [...parGeste.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([g, v]) =>
    console.log(`  ${(g || '(vide)').padEnd(13)}${String(v.fam).padStart(3)} / ${String(v.n).padStart(3)}`
      + (v.fam < v.n ? `   ← ${v.n - v.fam} en repli` : '')));
}
if (manques.size) {
  console.log('\n🔴 Couples sans cours propre à l’aliment :');
  [...manques.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([k, e]) =>
    console.log(`  ${String(e.n).padStart(3)}  ${k.padEnd(32)} ex. ${e.ex.join(' | ')}`));
  console.log('\n  → une entrée SAVOIR[geste][famille] dans assets/admin-savoir.js,');
  console.log('    ou un alias si le cours existe déjà sous une famille voisine.');
}
process.exit(repli + sansCours ? 1 : 0);
