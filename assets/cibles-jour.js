/* assets/cibles-jour.js — les cibles du jour (protéines, lipides, glucides,
   calories) d'un client, pour les écrans d'équipe qui ne chargent pas core.js.
   Chargé par admin.html ET crm.html : UN fichier plutôt que deux copies, puisque
   l'une d'elles finirait par dire un autre chiffre. Vérifié contre core.js par
   node scripts/verifier-cibles-admin.mjs. */
/* LES CIBLES DU JOUR — protéines, lipides, glucides, calories.
   ⚠️ LA FORMULE VIT DANS `assets/core.js` (`Natty.macrosJour` et
   `Natty.baseObjectif`). Ceci en est une COPIE, et c'en est une parce que
   `core.js` pose au chargement un intercepteur de clics sur tout le document
   (`brancherLiens`) : l'importer dans un back-office de 4 900 lignes pour deux
   formules coûterait plus cher que la copie.
   ⚠️ Une copie est exactement ce qui a fait diverger `api/_nutrition.js` de
   `core.js` pendant des mois, et ça s'est payé en macros fausses envoyées par
   notification. D'où le garde-fou : `node scripts/verifier-cibles-admin.mjs`
   compare cette fonction à celle de `core.js` sur une grille de profils. À
   lancer après toute retouche de l'une OU de l'autre.
   ⚠️ Ce qui existait ici était l'ANCIENNE formule (poids×2, tdee×0,25/9,
   tdee×0,5/4), remplacée dans l'app le 2026-09-03 parce qu'elle ne faisait pas
   le compte : à 80 kg pour 3 200 kcal ses trois macros n'en valaient que 3 041.
   Le nutritionniste comparait donc les moyennes de son client à une cible que
   le client, lui, ne voyait nulle part. */
function ciblesJour(onb) {
  onb = onb || {};
  var poids = parseFloat(onb.poids) || 0;
  var tdee  = parseFloat(onb.tdee)  || 0;
  /* La base n'est pas la dépense : c'est la dépense CORRIGÉE par l'objectif
     déclaré. Sans ça, quelqu'un qui veut prendre 5 kg se voit fixer un objectif
     de maintien — et l'app, elle, lui en affiche un autre. */
  var kg = parseFloat(onb.objectif_valeur) || 0, sem = parseFloat(onb.objectif_semaines) || 0;
  var base = tdee;
  if (tdee && kg && sem) {
    var brut = (kg * 7700) / (sem * 7);                    // KCAL_PAR_KG
    var plafond = tdee * (kg > 0 ? 0.20 : 0.25);           // SURPLUS_MAX / DEFICIT_MAX
    base = Math.round(tdee + Math.max(-plafond, Math.min(plafond, brut)));
  }
  var out = { p: 0, l: 0, g: 0, c: Math.round(base), base: Math.round(base) };
  if (!base && !poids) return out;
  /* Les protéines d'abord, le reste ensuite — c'est ce qui fait que la somme
     tombe juste. Elles se fixent au poids de corps ; les calories qu'elles
     n'occupent pas se partagent entre lipides et glucides dans le rapport 1:2. */
  var pr = poids ? poids * 2.0 : 0;                        // PROT_BASE
  if (base && pr * 4 > base * 0.4) pr = base * 0.4 / 4;    // plafond à 40 % des kcal
  var reste = Math.max(0, base - pr * 4);
  out.p = Math.round(pr);
  out.l = Math.round(reste / 3 / 9);
  out.g = Math.round(reste * 2 / 3 / 4);
  return out;
}
