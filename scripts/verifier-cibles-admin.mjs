/* scripts/verifier-cibles-admin.mjs — les cibles de l'admin disent-elles la
   même chose que celles de l'app ?
   ═══════════════════════════════════════════════════════════════════════════
   node scripts/verifier-cibles-admin.mjs

   ⚠️ POURQUOI CE FICHIER EXISTE. `admin.html` porte une COPIE de la formule des
   cibles (`ciblesJour`), parce qu'il ne charge pas `assets/core.js` — voir
   l'encadré au-dessus de la fonction. Une copie ne se signale jamais elle-même
   quand la source bouge : c'est ce qui a fait diverger `api/_nutrition.js` de
   `core.js` pendant des mois, et ça s'est payé en macros fausses envoyées par
   notification. Ici ça se paierait en nutritionniste qui compare les moyennes
   de son client à une cible que le client ne voit pas.

   ⚠️ DEPUIS LE 2026-09-20, IL VÉRIFIE AUSSI LE MÉTABOLISME DE BASE ET LA
   DÉPENSE. La section « Objectif, besoins et macros » de la fiche client les
   recalcule et les ÉCRIT en base (`onboarding.bmr` / `.tdee`) : ce sont eux que
   lisent ensuite l'app, le bilan du soir et la cuisine. Une divergence avec
   `suivi.html` (Mifflin-St Jeor, puis le facteur d'activité) donnerait deux
   dépenses pour la même personne selon la porte d'entrée — et celle de l'admin
   écraserait celle de l'app.

   Toutes les fonctions sont EXTRAITES de leur fichier, jamais recopiées ici :
   une copie ne prouverait que la copie. */
import fs from 'node:fs';

function extraire(src, nom, mot = 'function') {
  const i = src.indexOf(mot + ' ' + nom + '(');
  if (i < 0) throw new Error('introuvable : ' + nom);
  let p = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') p++; else if (src[k] === '}') { p--; if (!p) break; } }
  return src.slice(i, k + 1);
}

const core = fs.readFileSync('assets/core.js', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');

// Les constantes de core.js, lues à la source elles aussi.
const consts = ['KCAL_PAR_KG', 'DEFICIT_MAX', 'SURPLUS_MAX', 'PROT_BASE', 'PROT_MAX', 'SUP_G', 'SUP_P', 'SUP_L']
  .map(n => {
    const m = core.match(new RegExp('\\b' + n + '\\s*=\\s*([0-9.]+)'));
    if (!m) throw new Error('constante introuvable : ' + n);
    return `var ${n} = ${m[1]};`;
  }).join('\n');

const app = new Function(`${consts}
${extraire(core, 'ecartObjectif')}
${extraire(core, 'baseObjectif')}
${extraire(core, 'macrosJour')}
return function (o) {
  var base = baseObjectif(o.tdee, o.objectif_valeur, o.objectif_semaines) || (+o.tdee || 0);
  return macrosJour(o.poids, base);
};`)();

const adm = new Function(`${extraire(admin, 'ciblesJour')} return ciblesJour;`)();

/* ── BMR et dépense : admin.html contre suivi.html ─────────────────────────
   `ACT_TYPES` / `ACT_ADMIN` sont extraits eux aussi : c'est le COEFFICIENT
   d'activité qui diverge en premier quand quelqu'un ajoute un palier. */
const suivi = fs.readFileSync('suivi.html', 'utf8');
function tableau(src, nom) {
  const i = src.indexOf('var ' + nom + ' = [');
  if (i < 0) throw new Error('introuvable : ' + nom);
  let p = 0, k = src.indexOf('[', i);
  for (; k < src.length; k++) { if (src[k] === '[') p++; else if (src[k] === ']') { p--; if (!p) break; } }
  return src.slice(i, k + 1) + ';';
}
const appBt = new Function(`${tableau(suivi, 'ACT_TYPES')}
${extraire(suivi, 'objBmr')}
${extraire(suivi, 'objTdee')}
return function (o) { return { bmr: objBmr(o), tdee: objTdee(o) }; };`)();
const admBt = new Function(`${tableau(admin, 'ACT_ADMIN')}
${extraire(admin, 'bmrDe')}
${extraire(admin, 'tdeeDe')}
return function (o) { return { bmr: bmrDe(o), tdee: tdeeDe(o) }; };`)();

const CORPS = [];
for (const age of [0, 18, 30, 45, 70])
  for (const poids of [0, 52, 70, 88, 120])
    for (const taille of [0, 155, 172, 190])
      for (const sexe of ['', 'homme', 'femme'])
        for (const activite of ['sedentaire', 'leger', 'modere', 'actif', 'inconnu'])
          CORPS.push({ age, poids, taille, sexe, activite });

let koBt = 0;
for (const o of CORPS) {
  const a = appBt(o), b = admBt(o);
  for (const k of ['bmr', 'tdee']) {
    if (a[k] !== b[k]) {
      koBt++;
      console.log(`🔴 ${o.sexe || 'sexe ?'} ${o.age} ans · ${o.poids} kg · ${o.taille} cm · ${o.activite}`
        + ` → ${k} : suivi ${a[k]}, admin ${b[k]}`);
    }
  }
}
console.log(`${CORPS.length} profils × 2 valeurs (bmr, dépense) — ${koBt} écart(s)`);

const PROFILS = [];
for (const poids of [0, 48, 60, 70, 80, 95, 150])
  for (const tdee of [0, 1400, 1800, 2000, 2400, 3200, 4000])
    for (const obj of [[0, 0], [5, 12], [-6, 20], [-1, 2], [12, 8]])
      PROFILS.push({ poids, tdee, objectif_valeur: obj[0], objectif_semaines: obj[1] });

let ko = 0;
for (const o of PROFILS) {
  const a = app(o), b = adm(o);
  for (const k of ['p', 'l', 'g', 'c']) {
    if (a[k] !== b[k]) {
      ko++;
      console.log(`🔴 ${o.poids} kg · ${o.tdee} kcal · objectif ${o.objectif_valeur} kg/${o.objectif_semaines} sem`
        + ` → ${k} : app ${a[k]}, admin ${b[k]}`);
    }
  }
}
console.log(`${PROFILS.length} profils × 4 valeurs (macros) — ${ko} écart(s)`);
process.exit(ko + koBt ? 1 : 0);
