/* ═══════════════════════════════════════════════════════════════
   Natty — le test de préparation (preparation.html), 25/11/2026.

   Trois parties, dans cet ordre :
     1. les DONNÉES : disciplines, compétitions, séances, exercices,
        repas types, ingrédients ;
     2. le MOTEUR des scènes : une scène = une question, le parcours se
        recalcule à chaque pas, les transitions sont faites en CSS ;
     3. l'ANALYSE : besoins, notes, temps probable, conseils.

   ⚠️ Tout ici est une ESTIMATION, et l'écran le dit. Les repas sont des
   portions types, pas une pesée. Les règles viennent de repères publiés
   (ACSM / ISSN) : glucides 3 à 10 g/kg/j selon la charge, protéines
   1,6 à 2,2 g/kg/j, environ 0,3 g/kg par repas, ≈ 1 g/kg de glucides
   autour d'une séance exigeante.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─── Icônes au trait (boîte de 24, currentColor) ─────────────── */
var I = {
  course: '<path d="M13 4.5a1.5 1.5 0 1 0 0 .01"/><path d="M7 21l3-6 3 2v4"/><path d="M6 12l3-3 4 1 3 3 3-1"/><path d="M10 15l1-5"/>',
  velo: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3 7h-7"/><path d="M14 6h2"/>',
  tri: '<path d="M3 18c2 0 2-1.5 4-1.5S9 18 11 18s2-1.5 4-1.5 2 1.5 4 1.5"/><circle cx="16" cy="6" r="1.6"/><path d="M8 13l3-4 4 2"/>',
  hyrox: '<rect x="3" y="10" width="4" height="4" rx="1"/><rect x="17" y="10" width="4" height="4" rx="1"/><path d="M7 12h10"/><path d="M12 4v4M12 16v4"/>',
  crossfit: '<path d="M8 6h8l-1.5 3h-5z"/><circle cx="12" cy="15" r="5"/>',
  combat: '<path d="M7 10V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v6a5 5 0 0 1-5 5h-1a4 4 0 0 1-4-4z"/><path d="M7 11h6"/>',
  muscu: '<path d="M2 12h20"/><rect x="4" y="8" width="3" height="8" rx="1"/><rect x="17" y="8" width="3" height="8" rx="1"/>',
  natation: '<path d="M3 17c2 0 2-1.5 4-1.5S9 17 11 17s2-1.5 4-1.5 2 1.5 4 1.5"/><path d="M6 13l5-5 3 3 3-2"/><circle cx="17" cy="6" r="1.5"/>',
  collectif: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
  aucune: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
  homme: '<circle cx="10" cy="14" r="5"/><path d="M14 10l6-6M15 4h5v5"/>',
  femme: '<circle cx="12" cy="9" r="5"/><path d="M12 14v7M9 18h6"/>',
  autre: '<circle cx="12" cy="12" r="5"/><path d="M12 3v4M12 17v4"/>',
  endurance: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  intervalles: '<path d="M3 17V7M8 17v-6M13 17V5M18 17v-8"/>',
  force: '<path d="M2 12h20"/><rect x="4" y="8" width="3" height="8" rx="1"/><rect x="17" y="8" width="3" height="8" rx="1"/>',
  hybride: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  technique: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  recup: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
  chrono: '<circle cx="12" cy="13" r="7"/><path d="M12 13V9M10 3h4"/>',
  drapeau: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
  fleche: '<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>',
  balance: '<path d="M12 4v16M5 20h14M5 8h14M7 8l-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z"/>',
  feu: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-3-2 2-3 4-3 7a6 6 0 0 0 6 6z"/>',
  graine: '<path d="M12 21V11"/><path d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>',
  coeur: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>'
};
function ico(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (I[n] || I.aucune) + '</svg>'; }

/* ─── Disciplines ───────────────────────────────────────────── */
var DISCIPLINES = [
  { id: 'course',    nom: 'Course à pied',   sous: 'Route, trail',          fam: 'cardio' },
  { id: 'velo',      nom: 'Vélo',            sous: 'Route, gravel, VTT',    fam: 'cardio' },
  { id: 'triathlon', nom: 'Triathlon',       sous: 'Nager, rouler, courir', fam: 'cardio', ico: 'tri' },
  { id: 'hyrox',     nom: 'HYROX',           sous: 'Course et ateliers',    fam: 'hybride' },
  { id: 'crossfit',  nom: 'CrossFit',        sous: 'WOD, haltéro',          fam: 'hybride' },
  { id: 'combat',    nom: 'Sports de combat', sous: 'Boxe, MMA, judo…',     fam: 'combat' },
  { id: 'muscu',     nom: 'Musculation',     sous: 'Force, physique',       fam: 'force' },
  { id: 'natation',  nom: 'Natation',        sous: 'Bassin, eau libre',     fam: 'cardio' },
  { id: 'collectif', nom: 'Sport collectif', sous: 'Foot, rugby, basket…',  fam: 'collectif' }
];

/* ─── Compétitions ──────────────────────────────────────────────
   Un badge dessiné par nous, jamais le logo officiel de l'épreuve.
   `base` : temps d'un finisseur médian, en minutes (hommes / femmes),
   ordre de grandeur public des classements — un repère, pas un record.
   `ref` : volume hebdomadaire d'entraînement qui correspond à ce temps. */
var COMPETITIONS = [
  { id: 'hyrox-paris-26', d: 'hyrox', nom: 'HYROX Paris', an: '2026', sous: 'Open · 8 × 1 km + 8 ateliers', type: 'chrono', base: [88, 100], ref: 300 },
  { id: 'hyrox-paris-27', d: 'hyrox', nom: 'HYROX Paris', an: '2027', sous: 'Open · 8 × 1 km + 8 ateliers', type: 'chrono', base: [88, 100], ref: 300 },
  { id: 'hyrox-autre',    d: 'hyrox', nom: 'Une autre course HYROX', an: '—', sous: 'Open, Pro ou Doubles', type: 'chrono', base: [88, 100], ref: 300 },
  { id: 'marathon-26',    d: 'course', nom: 'Marathon de Paris', an: '2026', sous: '42,195 km', type: 'chrono', base: [245, 275], ref: 300 },
  { id: 'marathon-27',    d: 'course', nom: 'Marathon de Paris', an: '2027', sous: '42,195 km', type: 'chrono', base: [245, 275], ref: 300 },
  { id: 'semi-26',        d: 'course', nom: 'Semi de Paris', an: '2026', sous: '21,1 km', type: 'chrono', base: [118, 132], ref: 220 },
  { id: '20km',           d: 'course', nom: '20 km de Paris', an: '2026', sous: '20 km', type: 'chrono', base: [112, 126], ref: 210 },
  { id: '10km',           d: 'course', nom: 'Un 10 km', an: '—', sous: 'Sur route', type: 'chrono', base: [54, 62], ref: 150 },
  { id: 'trail',          d: 'course', nom: 'Un trail', an: '—', sous: 'Dénivelé, nature', type: 'finir', ref: 300 },
  { id: 'etape',          d: 'velo', nom: "L'Étape du Tour", an: '2026', sous: 'Une étape du Tour, en cyclosportive', type: 'chrono', base: [540, 630], ref: 480 },
  { id: 'cyclo',          d: 'velo', nom: 'Une cyclosportive', an: '—', sous: '100 à 150 km', type: 'chrono', base: [330, 380], ref: 360 },
  { id: 'ironman',        d: 'triathlon', nom: 'IRONMAN', an: '2026', sous: '3,8 / 180 / 42,2 km', type: 'chrono', base: [765, 825], ref: 600 },
  { id: 'ironman-703',    d: 'triathlon', nom: 'IRONMAN 70.3', an: '2026', sous: '1,9 / 90 / 21,1 km', type: 'chrono', base: [370, 405], ref: 420 },
  { id: 'olympique',      d: 'triathlon', nom: 'Distance olympique', an: '—', sous: '1,5 / 40 / 10 km', type: 'chrono', base: [165, 185], ref: 300 },
  { id: 'eau-libre',      d: 'natation', nom: 'Eau libre 5 km', an: '—', sous: 'Traversée', type: 'chrono', base: [105, 115], ref: 240 },
  { id: 'bassin',         d: 'natation', nom: 'Compétition en bassin', an: '—', sous: 'Interclubs, championnats', type: 'perf' },
  { id: 'open',           d: 'crossfit', nom: 'CrossFit Open', an: '2026', sous: 'Trois semaines, trois WOD', type: 'perf' },
  { id: 'equipe',         d: 'crossfit', nom: 'Compétition par équipe', an: '—', sous: 'Fitness, functional', type: 'perf' },
  { id: 'france',         d: 'combat', nom: 'Championnat de France', an: '2026', sous: 'Fédéral', type: 'combat' },
  { id: 'gala',           d: 'combat', nom: 'Un combat, un gala', an: '—', sous: 'Amateur ou pro', type: 'combat' },
  { id: 'regional',       d: 'combat', nom: 'Compétition régionale', an: '—', sous: 'Tournoi, open', type: 'combat' },
  { id: 'force',          d: 'muscu', nom: 'Force athlétique', an: '—', sous: 'Squat, développé couché, soulevé de terre', type: 'force' },
  { id: 'physique',       d: 'muscu', nom: 'Compétition de physique', an: '—', sous: 'Bodybuilding, men’s physique', type: 'physique' },
  { id: 'saison',         d: 'collectif', nom: 'Ma saison', an: '2026', sous: 'Championnat, matchs chaque semaine', type: 'perf' },
  { id: 'tournoi',        d: 'collectif', nom: 'Un tournoi, des phases finales', an: '—', sous: 'Plusieurs matchs rapprochés', type: 'perf' }
];

var OBJECTIFS = {
  chrono:   [ { id: 'temps', nom: 'Faire un temps', sous: 'J’ai un chrono en tête', ico: 'chrono' },
              { id: 'finir', nom: 'La finir, et bien', sous: 'Arriver au bout sans exploser', ico: 'drapeau' },
              { id: 'progres', nom: 'Faire mieux que la dernière fois', sous: 'Progresser', ico: 'fleche' } ],
  finir:    [ { id: 'finir', nom: 'La finir, et bien', sous: 'Arriver au bout sans exploser', ico: 'drapeau' },
              { id: 'progres', nom: 'Progresser', sous: 'Être plus fort qu’avant', ico: 'fleche' } ],
  combat:   [ { id: 'gagner', nom: 'Gagner mes combats', sous: 'Être au top le jour J', ico: 'feu' },
              { id: 'descendre', nom: 'Descendre de catégorie', sous: 'Perdre du poids sans perdre de force', ico: 'balance' },
              { id: 'monter', nom: 'Monter de catégorie', sous: 'Prendre de la masse', ico: 'muscu' },
              { id: 'cardio', nom: 'Tenir tous les rounds', sous: 'Le cardio jusqu’au bout', ico: 'endurance' } ],
  force:    [ { id: 'total', nom: 'Augmenter mon total', sous: 'Plus lourd sur les trois mouvements', ico: 'force' },
              { id: 'masse', nom: 'Prendre de la masse', sous: 'Du muscle, proprement', ico: 'muscu' },
              { id: 'seche', nom: 'Sécher en gardant ma force', sous: 'Perdre du gras', ico: 'feu' } ],
  physique: [ { id: 'seche', nom: 'Sécher pour la scène', sous: 'Le plus sec possible, le muscle gardé', ico: 'feu' },
              { id: 'masse', nom: 'Prendre de la masse', sous: 'Saison de construction', ico: 'muscu' } ],
  perf:     [ { id: 'perf', nom: 'Performer le jour J', sous: 'Être au maximum quand ça compte', ico: 'feu' },
              { id: 'recup', nom: 'Mieux récupérer', sous: 'Enchaîner sans m’user', ico: 'recup' },
              { id: 'compo', nom: 'Affiner ma composition', sous: 'Moins de gras, plus de muscle', ico: 'balance' } ],
  aucune:   [ { id: 'seche', nom: 'Perdre du gras', sous: 'Sans perdre de muscle', ico: 'feu' },
              { id: 'masse', nom: 'Prendre du muscle', sous: 'Construire', ico: 'muscu' },
              { id: 'perf', nom: 'Améliorer mes performances', sous: 'Plus fort, plus endurant', ico: 'fleche' },
              { id: 'forme', nom: 'Être en forme et bien récupérer', sous: 'Durer', ico: 'coeur' } ]
};

/* ─── Séances : type, MET, part de glucides de la dépense ───────── */
var TYPES = [
  { id: 'endurance',   nom: 'Cardio, endurance',  sous: 'Footing, sortie longue',       met: 7.5,  glu: .55 },
  { id: 'intervalles', nom: 'Intervalles, seuil', sous: 'Fractionné, VMA, tempo',       met: 10.5, glu: .75 },
  { id: 'force',       nom: 'Force',              sous: 'Charges, musculation',          met: 5.0,  glu: .45 },
  { id: 'hybride',     nom: 'Hybride, HIIT',      sous: 'Ateliers, circuits, WOD',       met: 9.0,  glu: .70 },
  { id: 'technique',   nom: 'Technique, sport',   sous: 'Sparring, match, éducatifs',    met: 8.0,  glu: .60 },
  { id: 'recup',       nom: 'Récupération',       sous: 'Mobilité, yoga, marche',        met: 3.0,  glu: .30 }
];
function typeDe(id) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i]; return TYPES[0]; }

/* Exercices. `d` : disciplines pour lesquelles l'exercice est SPÉCIFIQUE.
   `g` : sollicitation du glycogène (1 faible · 2 modérée · 3 élevée). */
var EXOS = {
  endurance: [
    ['footing', 'Footing en endurance', ['course', 'triathlon', 'hyrox'], 2],
    ['sortie-longue', 'Sortie longue', ['course', 'triathlon', 'velo'], 3],
    ['velo-endurance', 'Vélo en endurance', ['velo', 'triathlon'], 2],
    ['home-trainer', 'Home trainer', ['velo', 'triathlon'], 2],
    ['nage-endurance', 'Nage en endurance', ['natation', 'triathlon'], 2],
    ['rameur-long', 'Rameur, long', ['hyrox', 'crossfit'], 2],
    ['trail', 'Trail, côtes', ['course'], 3],
    ['corde-longue', 'Corde à sauter, long', ['combat'], 2],
    ['marche-rapide', 'Marche rapide, incliné', [], 1]
  ],
  intervalles: [
    ['vma', 'VMA, fractionné court', ['course', 'triathlon'], 3],
    ['seuil', 'Seuil, fractionné long', ['course', 'velo', 'triathlon', 'natation'], 3],
    ['tempo', 'Tempo, allure course', ['course', 'triathlon', 'hyrox'], 3],
    ['cotes', 'Côtes', ['course', 'velo'], 3],
    ['ftp', 'Intervalles FTP', ['velo', 'triathlon'], 3],
    ['sprints', 'Sprints', ['velo', 'collectif', 'course'], 2],
    ['series-nage', 'Séries courtes en nage', ['natation', 'triathlon'], 3],
    ['compromised', 'Compromised running', ['hyrox'], 3],
    ['assault', 'Assault bike, intervalles', ['crossfit', 'hyrox', 'combat'], 3],
    ['rounds', 'Rounds au sac, haute intensité', ['combat'], 3]
  ],
  force: [
    ['squat', 'Squat', ['muscu', 'crossfit', 'hyrox'], 2],
    ['souleve', 'Soulevé de terre', ['muscu', 'crossfit'], 2],
    ['dc', 'Développé couché', ['muscu'], 1],
    ['militaire', 'Développé militaire', ['muscu', 'crossfit'], 1],
    ['tractions', 'Tractions', ['muscu', 'crossfit', 'combat'], 1],
    ['dips', 'Dips', ['muscu'], 1],
    ['rowing', 'Rowing barre', ['muscu', 'combat'], 1],
    ['fentes', 'Fentes', ['hyrox', 'muscu', 'course'], 2],
    ['hip-thrust', 'Hip thrust', ['muscu', 'course'], 1],
    ['presse', 'Presse à cuisses', ['muscu', 'velo'], 2],
    ['tirage', 'Tirage vertical', ['muscu'], 1],
    ['curl', 'Curl biceps', ['muscu'], 1],
    ['triceps', 'Extensions triceps', ['muscu'], 1],
    ['mollets', 'Mollets', ['course', 'muscu'], 1],
    ['gainage', 'Gainage', ['combat', 'course', 'natation', 'hyrox'], 1],
    ['epaule-jete', 'Épaulé-jeté, arraché', ['crossfit'], 2],
    ['farmer', 'Farmer carry', ['hyrox', 'crossfit'], 2]
  ],
  hybride: [
    ['skierg', 'SkiErg', ['hyrox', 'crossfit'], 3],
    ['sled-push', 'Sled push', ['hyrox'], 3],
    ['sled-pull', 'Sled pull', ['hyrox'], 3],
    ['burpee-broad', 'Burpee broad jumps', ['hyrox', 'crossfit'], 3],
    ['rameur', 'Rameur', ['hyrox', 'crossfit'], 3],
    ['farmers', 'Farmers carry', ['hyrox'], 2],
    ['sandbag', 'Sandbag lunges', ['hyrox'], 2],
    ['wall-balls', 'Wall balls', ['hyrox', 'crossfit'], 3],
    ['kb-swings', 'Kettlebell swings', ['crossfit', 'hyrox', 'combat'], 2],
    ['box-jumps', 'Box jumps', ['crossfit', 'collectif'], 2],
    ['thrusters', 'Thrusters', ['crossfit'], 3],
    ['double-unders', 'Double unders', ['crossfit', 'combat'], 2],
    ['circuit', 'Circuit au poids du corps', ['combat', 'collectif'], 2]
  ],
  technique: [
    ['sac', 'Sac de frappe', ['combat'], 2],
    ['shadow', 'Shadow boxing', ['combat'], 1],
    ['paos', 'Paos, pattes d’ours', ['combat'], 3],
    ['sparring', 'Sparring', ['combat'], 3],
    ['grappling', 'Lutte, grappling', ['combat'], 3],
    ['randori', 'Randori', ['combat'], 3],
    ['educatifs', 'Éducatifs, technique de course', ['course', 'triathlon'], 1],
    ['technique-nage', 'Technique de nage', ['natation', 'triathlon'], 1],
    ['entrainement-co', 'Entraînement collectif', ['collectif'], 2],
    ['match', 'Match', ['collectif', 'combat'], 3],
    ['gym', 'Gymnastique, mouvements', ['crossfit'], 1]
  ],
  recup: [
    ['mobilite', 'Mobilité', [], 1],
    ['etirements', 'Étirements', [], 1],
    ['yoga', 'Yoga', [], 1],
    ['marche', 'Marche', [], 1],
    ['velo-leger', 'Vélo léger', ['velo'], 1],
    ['rouleau', 'Rouleau, massage', [], 1],
    ['nage-souple', 'Nage souple', ['natation', 'triathlon'], 1]
  ]
};
var EXO = {};
Object.keys(EXOS).forEach(function (t) {
  EXOS[t] = EXOS[t].map(function (e) { var o = { id: e[0], nom: e[1], d: e[2], g: e[3], type: t }; EXO[o.id] = o; return o; });
});

/* ─── Repas types ──────────────────────────────────────────────
   Une portion courante, ses macros estimées (kcal, protéines, glucides,
   lipides) et une note de qualité sur 100 (densité, transformation, fibres,
   type de gras). Un repas « rien » est un repas sauté. */
var REPAS = [
  { id: 'rien-pdj',  c: 'pdj', e: '☕', nom: 'Rien, un café',                       k: 5,    p: 0,  g: 1,   l: 0,  q: null },
  { id: 'tartines',  c: 'pdj', e: '🍞', nom: 'Tartines beurre-confiture',          k: 420,  p: 9,  g: 62,  l: 15, q: 45 },
  { id: 'cereales',  c: 'pdj', e: '🥣', nom: 'Céréales et lait',                    k: 380,  p: 13, g: 62,  l: 8,  q: 45 },
  { id: 'porridge',  c: 'pdj', e: '🥣', nom: 'Porridge d’avoine, banane',           k: 450,  p: 15, g: 75,  l: 9,  q: 88 },
  { id: 'oeufs',     c: 'pdj', e: '🍳', nom: 'Œufs, pain complet',                  k: 430,  p: 26, g: 34,  l: 20, q: 85 },
  { id: 'skyr',      c: 'pdj', e: '🫐', nom: 'Skyr, muesli, fruits rouges',         k: 400,  p: 30, g: 52,  l: 7,  q: 90 },
  { id: 'viennois',  c: 'pdj', e: '🥐', nom: 'Viennoiserie et jus',                 k: 480,  p: 7,  g: 58,  l: 24, q: 25 },
  { id: 'smoothie',  c: 'pdj', e: '🥤', nom: 'Smoothie protéiné',                   k: 380,  p: 32, g: 50,  l: 6,  q: 75 },
  { id: 'pancakes',  c: 'pdj', e: '🥞', nom: 'Pancakes, sirop',                     k: 520,  p: 12, g: 88,  l: 13, q: 40 },
  { id: 'rien',      c: 'rep', e: '⏭️', nom: 'Rien, je saute',                      k: 0,    p: 0,  g: 0,   l: 0,  q: null },
  { id: 'riz-poulet', c: 'rep', e: '🍗', nom: 'Riz, poulet, légumes',               k: 650,  p: 45, g: 85,  l: 12, q: 90 },
  { id: 'poisson',   c: 'rep', e: '🐟', nom: 'Poisson, riz, légumes',               k: 600,  p: 40, g: 75,  l: 13, q: 92 },
  { id: 'pates',     c: 'rep', e: '🍝', nom: 'Pâtes bolognaise',                    k: 720,  p: 32, g: 95,  l: 22, q: 65 },
  { id: 'salade',    c: 'rep', e: '🥗', nom: 'Salade composée au poulet',           k: 480,  p: 38, g: 25,  l: 24, q: 80 },
  { id: 'bowl',      c: 'rep', e: '🥙', nom: 'Bowl quinoa, légumes, avocat',        k: 580,  p: 18, g: 65,  l: 27, q: 85 },
  { id: 'chili',     c: 'rep', e: '🫘', nom: 'Chili, lentilles',                    k: 600,  p: 32, g: 80,  l: 14, q: 86 },
  { id: 'omelette',  c: 'rep', e: '🍳', nom: 'Omelette, salade, pain',              k: 520,  p: 30, g: 30,  l: 30, q: 70 },
  { id: 'sushi',     c: 'rep', e: '🍣', nom: 'Sushis, makis',                       k: 620,  p: 28, g: 95,  l: 12, q: 65 },
  { id: 'steak',     c: 'rep', e: '🥩', nom: 'Steak frites',                        k: 850,  p: 45, g: 70,  l: 42, q: 45 },
  { id: 'sandwich',  c: 'rep', e: '🥪', nom: 'Sandwich jambon-beurre',              k: 520,  p: 24, g: 55,  l: 22, q: 40 },
  { id: 'soupe',     c: 'rep', e: '🍲', nom: 'Soupe, pain, fromage',                k: 450,  p: 18, g: 50,  l: 18, q: 60 },
  { id: 'prepare',   c: 'rep', e: '📦', nom: 'Plat préparé du commerce',            k: 500,  p: 20, g: 55,  l: 20, q: 35 },
  { id: 'burger',    c: 'rep', e: '🍔', nom: 'Burger frites',                       k: 1050, p: 38, g: 100, l: 55, q: 20 },
  { id: 'pizza',     c: 'rep', e: '🍕', nom: 'Pizza',                               k: 900,  p: 36, g: 105, l: 35, q: 25 },
  { id: 'kebab',     c: 'rep', e: '🌯', nom: 'Kebab frites',                        k: 1100, p: 45, g: 110, l: 50, q: 20 },
  { id: 'natty',     c: 'rep', e: '🍱', nom: 'Un plat Natty',                       k: 650,  p: 45, g: 75,  l: 16, q: 95 }
];
var REP = {}; REPAS.forEach(function (r) { REP[r.id] = r; });

/* ─── Ingrédients ─────────────────────────────────────────────── */
var INGREDIENTS = [
  ['poulet', '🍗', 'Poulet, dinde', 'ex', 'Protéines maigres, idéales en récupération'],
  ['oeufs', '🥚', 'Œufs', 'ex', 'Protéines complètes, très bon rapport qualité'],
  ['poisson', '🐟', 'Poisson blanc', 'ex', 'Protéines maigres, digestes'],
  ['saumon', '🍣', 'Saumon, poissons gras', 'ex', 'Protéines et oméga-3, utiles à la récupération'],
  ['boeuf', '🥩', 'Bœuf, viande rouge', 'b', 'Protéines et fer ; plus gras, à doser'],
  ['charcuterie', '🥓', 'Charcuterie', 'm', 'Salée et grasse : des protéines de mauvaise qualité'],
  ['skyr', '🥛', 'Skyr, fromage blanc', 'ex', 'Protéines lentes, peu de gras'],
  ['fromage', '🧀', 'Fromage', 'b', 'Calcium et protéines, mais dense en gras'],
  ['legumineuses', '🫘', 'Lentilles, pois chiches', 'ex', 'Glucides lents, fibres et protéines'],
  ['tofu', '🌱', 'Tofu, tempeh', 'tb', 'Protéines végétales complètes'],
  ['riz', '🍚', 'Riz blanc', 'tb', 'Glucides rapides : parfaits autour des séances'],
  ['riz-complet', '🍙', 'Riz complet', 'ex', 'Glucides et fibres, l’énergie qui dure'],
  ['pates', '🍝', 'Pâtes', 'tb', 'La recharge en glycogène la plus simple'],
  ['avoine', '🌾', 'Flocons d’avoine', 'ex', 'Glucides lents et fibres, le petit-déjeuner d’endurance'],
  ['pain-blanc', '🥖', 'Pain blanc', 'm', 'Rapide mais pauvre en fibres hors séance'],
  ['pain-complet', '🍞', 'Pain complet', 'tb', 'Plus de fibres, une énergie plus stable'],
  ['patate-douce', '🍠', 'Patate douce, pommes de terre', 'ex', 'Glucides, potassium, très digeste'],
  ['quinoa', '🌾', 'Quinoa', 'ex', 'Glucides et protéines complètes'],
  ['banane', '🍌', 'Banane', 'ex', 'Le glucide pratique avant ou pendant l’effort'],
  ['fruits', '🍎', 'Fruits', 'ex', 'Vitamines, antioxydants, hydratation'],
  ['legumes', '🥦', 'Légumes verts', 'ex', 'Micronutriments et fibres, la base de la récupération'],
  ['avocat', '🥑', 'Avocat', 'tb', 'Bons gras, à doser loin des séances'],
  ['oleagineux', '🥜', 'Noix, amandes', 'tb', 'Bons gras et magnésium, très caloriques'],
  ['huile-olive', '🫒', 'Huile d’olive', 'tb', 'Gras insaturés de qualité'],
  ['beurre', '🧈', 'Beurre, crème', 'm', 'Gras saturés, à limiter'],
  ['whey', '🥤', 'Whey, protéine en poudre', 'tb', 'Pratique après la séance, ne remplace pas un repas'],
  ['chocolat', '🍫', 'Chocolat', 'b', 'Noir : du magnésium ; au lait : surtout du sucre'],
  ['biscuits', '🍪', 'Biscuits, gâteaux', 'ma', 'Sucres et gras raffinés, peu de nutriments'],
  ['sodas', '🥤', 'Sodas, jus sucrés', 'ma', 'Du sucre sans rien d’autre, hors effort'],
  ['fritures', '🍟', 'Frites, fritures', 'ma', 'Gras cuits, digestion lente avant l’effort'],
  ['fast-food', '🍔', 'Fast-food', 'ma', 'Dense, salé, pauvre en micronutriments'],
  ['alcool', '🍷', 'Alcool', 'ma', 'Freine la synthèse protéique et la récupération']
].map(function (x) { return { id: x[0], e: x[1], nom: x[2], n: x[3], pourquoi: x[4] }; });
var NOTE_ING = { ex: 95, tb: 80, b: 62, m: 42, ma: 18 };

var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
var J1 = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
var CRENEAUX = [['m', 'Matin'], ['j', 'Journée'], ['s', 'Soir']];
var SLOTS = [['pdj', 'Petit-déjeuner'], ['dej', 'Déjeuner'], ['din', 'Dîner']];

/* ═══════════════════════════════════════════════════════════════
   2. LE MOTEUR
   ═══════════════════════════════════════════════════════════════ */
var CLE = 'natty_prepa_v1';
var S = lire() || neuf();
function neuf() {
  return { prenom: '', taille: 175, poids: 72, sexe: '', age: 28, discipline: '', competition: '', objectif: '',
           cible: null, poidsCible: null, creneaux: {}, seances: {}, repas: {}, ingredients: [], pas: 0 };
}
function lire() { try { var o = JSON.parse(localStorage.getItem(CLE)); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function garder() { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) {} }

function disc() { for (var i = 0; i < DISCIPLINES.length; i++) if (DISCIPLINES[i].id === S.discipline) return DISCIPLINES[i]; return null; }
function comp() { for (var i = 0; i < COMPETITIONS.length; i++) if (COMPETITIONS[i].id === S.competition) return COMPETITIONS[i]; return null; }
function typeComp() { var c = comp(); return c ? c.type : 'aucune'; }
function sessions() {
  var l = [];
  for (var d = 0; d < 7; d++) CRENEAUX.forEach(function (c) { if (S.creneaux[d + c[0]]) l.push(d + c[0]); });
  return l;
}
function nomSession(k) { var d = +k[0], c = k[1]; return JOURS[d] + ' ' + (c === 'm' ? 'matin' : c === 'j' ? 'en journée' : 'soir'); }
function seance(k) { return S.seances[k] || (S.seances[k] = { type: '', exos: [], intensite: 6, duree: 60, copie: '' }); }

/* Le parcours, recalculé à chaque pas. */
function parcours() {
  var l = ['prenom', 'taille', 'poids', 'sexe', 'age', 'discipline', 'competition', 'objectif'];
  if (S.objectif === 'temps' && comp() && comp().base) l.push('cible');
  if (S.objectif === 'descendre' || S.objectif === 'monter') l.push('poidsCible');
  l.push('semaine');
  sessions().forEach(function (k) {
    l.push('type:' + k);
    if (!seance(k).copie) { l.push('exos:' + k); l.push('intensite:' + k); }
  });
  l.push('repas', 'ingredients', 'calcul', 'resultat');
  return l;
}

var zone = document.getElementById('zone');
var cta = document.getElementById('cta'), ctaTxt = document.getElementById('ctaTxt');
var retour = document.getElementById('retour');
var etape = document.getElementById('etape'), progres = document.getElementById('progres');
var aura = document.getElementById('aura'), numero = document.getElementById('numero');
var courante = null, sceneEl = null, valide = function () { return true; };

function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
/* Le titre : chaque mot dans un masque, pour qu'il en sorte. */
function titre(t) {
  var i = 0;
  return '<h1 class="q">' + t.split(' ').map(function (m) {
    return '<span class="m"><span class="w" style="--i:' + (i++) + '">' + m + '</span></span>';
  }).join(' ') + '</h1>';
}
function aide(t, c) { return '<p class="aide" data-c style="--c:' + (c || 1) + '">' + t + '</p>'; }

function aller(pas, sens) {
  var l = parcours();
  pas = Math.max(0, Math.min(l.length - 1, pas));
  S.pas = pas; garder();
  var id = l[pas];
  var ancien = sceneEl;
  if (ancien) {
    ancien.classList.remove('entre', 'pret', 'arriere');
    ancien.classList.add('sort');
    if (sens < 0) ancien.classList.add('arriere');
    setTimeout(function () { if (ancien.parentNode) ancien.parentNode.removeChild(ancien); }, 620);
  }
  numero.classList.add('sort');
  var nouv = document.createElement('section');
  nouv.className = 'scene';
  var rendu = SCENES[id.split(':')[0]](id.split(':')[1]);
  nouv.innerHTML = '<div class="scene-in">' + rendu.html + '</div>';
  if (rendu.classe) nouv.className += ' ' + rendu.classe;
  courante = id; sceneEl = nouv;
  valide = rendu.valide || function () { return true; };
  setTimeout(function () {
    zone.appendChild(nouv);
    nouv.classList.add('entre');
    if (sens < 0) nouv.classList.add('arriere');
    if (rendu.monter) rendu.monter(nouv);
    setTimeout(function () { nouv.classList.add('pret'); }, 1700);
    numero.textContent = String(pas + 1).padStart(2, '0');
    numero.classList.remove('sort');
  }, ancien ? 260 : 0);

  /* La continuité : la barre de progression et l'aura bougent ensemble. */
  var total = l.indexOf('calcul');
  progres.style.transform = 'scaleX(' + Math.min(1, pas / Math.max(1, total)) + ')';
  etape.textContent = pas < total ? (pas + 1) + '/' + total : '';
  var a = (pas * 47) % 360;
  aura.style.setProperty('--ax', (-50 + Math.cos(a * Math.PI / 180) * 22) + '%');
  aura.style.setProperty('--ay', (-50 + Math.sin(a * Math.PI / 180) * 16) + '%');
  aura.style.setProperty('--as', (0.85 + (pas % 3) * 0.12).toFixed(2));
  retour.hidden = pas === 0 || id === 'calcul';
  cta.classList.toggle('cache', !!rendu.sansCta);
  ctaTxt.textContent = rendu.cta || 'Continuer';
  verifier();
}
function verifier() { cta.disabled = !valide(); }
/* Un verrou court : un choix qui avance tout seul et un tap sur
   « Continuer » dans la même demi-seconde ne doivent pas sauter une scène. */
var verrou = 0;
function suivant() { if (Date.now() < verrou || !valide()) return; verrou = Date.now() + 450; aller(S.pas + 1, 1); }
function precedent() { if (Date.now() < verrou) return; verrou = Date.now() + 450; aller(S.pas - 1, -1); }
cta.addEventListener('click', suivant);
retour.addEventListener('click', precedent);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !cta.disabled && !cta.classList.contains('cache')) { e.preventDefault(); suivant(); }
});

/* Une sélection unique : cartes [data-v] dans un conteneur. */
function choixUnique(el, sel, cle, apres) {
  el.querySelectorAll(sel).forEach(function (b) {
    b.addEventListener('click', function () {
      el.querySelectorAll(sel).forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      apres(b.getAttribute('data-v'));
      garder(); verifier();
    });
  });
}

/* Un défilement natif que la souris peut aussi tirer (pas seulement
   le doigt ou la molette). */
function tirer(el, axe) {
  var d = null;
  el.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return;
    d = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    el.style.scrollSnapType = 'none'; el.style.cursor = 'grabbing';
  });
  window.addEventListener('pointermove', function (e) {
    if (!d) return;
    if (axe === 'x') el.scrollLeft = d.l - (e.clientX - d.x); else el.scrollTop = d.t - (e.clientY - d.y);
  });
  window.addEventListener('pointerup', function () {
    if (!d) return; d = null; el.style.scrollSnapType = ''; el.style.cursor = '';
  });
}

/* Une règle : `pas` px par unité, la valeur se lit sur le défilement. */
function regle(el, min, max, pas, axe, val, surChange) {
  var poser = function () {
    if (axe === 'x') el.scrollLeft = (val - min) * pas; else el.scrollTop = (val - min) * pas;
  };
  requestAnimationFrame(poser); setTimeout(poser, 60);
  /* La valeur se lit tout de suite, pas dans une rAF : une page qui ne
     peint pas n'en reçoit aucune, et la valeur resterait figée. */
  el.addEventListener('scroll', function () {
    var p = axe === 'x' ? el.scrollLeft : el.scrollTop;
    var v = Math.max(min, Math.min(max, min + Math.round(p / pas)));
    if (v !== val) { val = v; surChange(v); }
  }, { passive: true });
  el.tabIndex = 0;
  el.addEventListener('keydown', function (e) {
    var k = e.key, delta = (k === 'ArrowUp' || k === 'ArrowRight') ? 1 : (k === 'ArrowDown' || k === 'ArrowLeft') ? -1 : 0;
    if (axe === 'y') delta = -delta;
    if (!delta) return;
    e.preventDefault(); val = Math.max(min, Math.min(max, val + delta)); poser(); surChange(val);
  });
  tirer(el, axe);
}

/* Une roue façon minuteur : la valeur au centre, les autres basculent. */
function roue(el, valeurs, index, surChange) {
  var H = 50;
  el.innerHTML = '<div class="bout"></div>' + valeurs.map(function (v) { return '<div class="it">' + v + '</div>'; }).join('') + '<div class="bout"></div>';
  var items = el.querySelectorAll('.it');
  function peindre() {
    var c = el.scrollTop;
    for (var i = 0; i < items.length; i++) {
      var dist = (i * H - c) / H;
      var a = Math.max(-75, Math.min(75, dist * 22));
      items[i].style.transform = 'rotateX(' + (-a) + 'deg) scale(' + (1 - Math.min(.25, Math.abs(dist) * .06)) + ')';
      items[i].style.opacity = String(Math.max(.15, 1 - Math.abs(dist) * .28));
    }
  }
  var poser = function () { el.scrollTop = index * H; peindre(); };
  requestAnimationFrame(poser); setTimeout(poser, 60);
  var cadre = 0;
  el.addEventListener('scroll', function () {
    var i = Math.max(0, Math.min(valeurs.length - 1, Math.round(el.scrollTop / H)));
    if (i !== index) { index = i; surChange(i); }
    if (!cadre) cadre = requestAnimationFrame(function () { cadre = 0; peindre(); });
  }, { passive: true });
  el.tabIndex = 0;
  el.addEventListener('keydown', function (e) {
    var d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); index = Math.max(0, Math.min(valeurs.length - 1, index + d));
    el.scrollTo({ top: index * H, behavior: 'smooth' }); surChange(index);
  });
  tirer(el, 'y');
}
function plage(a, b, f) { var l = []; for (var i = a; i <= b; i++) l.push(f ? f(i) : i); return l; }
function deux(n) { return (n < 10 ? '0' : '') + n; }

/* ─── Les scènes ────────────────────────────────────────────── */
var SCENES = {
  prenom: function () {
    return {
      html: titre('Comment tu t’appelles ?') + aide('On commence par faire connaissance.')
        + '<div class="ctrl" data-c style="--c:2"><input class="champ" id="fPrenom" type="text" autocomplete="given-name" autocapitalize="words" placeholder="Ton prénom" maxlength="30" value="' + esc(S.prenom) + '"></div>',
      valide: function () { return S.prenom.trim().length > 0; },
      monter: function (el) {
        var f = el.querySelector('#fPrenom');
        f.addEventListener('input', function () { S.prenom = f.value; garder(); verifier(); });
        setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 700);
      }
    };
  },
  taille: function () {
    var t = plage(130, 215).map(function (v) {
      return '<div class="tick' + (v % 10 === 0 ? ' d10' : v % 5 === 0 ? ' d' : '') + '">' + (v % 10 === 0 ? '<b>' + v + '</b>' : '') + '</div>';
    }).reverse().join('');
    return {
      html: titre(esc(prenomCourt()) + ', tu mesures combien ?')
        + '<div class="ctrl regle-v" data-c style="--c:2"><div class="val"><span id="vTaille">' + S.taille + '</span><small>cm</small></div>'
        + '<div style="position:relative;height:100%"><div class="piste-v" id="pTaille"><div style="height:calc(50% - 5px)"></div>' + t + '<div style="height:calc(50% - 5px)"></div></div><div class="repere-v"></div></div></div>',
      monter: function (el) {
        /* La règle va du haut (215) vers le bas (130) : on défile à l'envers. */
        var p = el.querySelector('#pTaille'), v = el.querySelector('#vTaille');
        regle(p, 0, 85, 10, 'y', 215 - S.taille, function (x) { S.taille = 215 - x; v.textContent = S.taille; garder(); });
      }
    };
  },
  poids: function () {
    var ent = Math.floor(S.poids), dec = Math.round((S.poids - ent) * 10);
    return {
      html: titre('Et ton poids ?') + aide('Fais tourner les roues.')
        + '<div class="ctrl roues" data-c style="--c:2"><div class="roue" id="rKg"></div><span class="sep">,</span><div class="roue" id="rDec" style="width:56px"></div><span class="unite">kg</span></div>',
      monter: function (el) {
        var e = ent, d = dec;
        function maj() { S.poids = e + d / 10; garder(); }
        roue(el.querySelector('#rKg'), plage(35, 180), e - 35, function (i) { e = 35 + i; maj(); });
        roue(el.querySelector('#rDec'), plage(0, 9), d, function (i) { d = i; maj(); });
      }
    };
  },
  sexe: function () {
    var o = [['homme', 'Homme'], ['femme', 'Femme'], ['autre', 'Je préfère ne pas le dire']];
    return {
      html: titre('Tu es…') + aide('Ça change le calcul de tes besoins.')
        + '<div class="ctrl choix" data-c style="--c:2">' + o.map(function (x) {
          return '<button type="button" class="carte' + (S.sexe === x[0] ? ' on' : '') + '" data-v="' + x[0] + '">' + ico(x[0]) + '<b>' + x[1] + '</b></button>';
        }).join('') + '</div>',
      valide: function () { return !!S.sexe; },
      monter: function (el) { choixUnique(el, '.carte', 'sexe', function (v) { S.sexe = v; setTimeout(suivant, 380); }); }
    };
  },
  age: function () {
    var t = plage(14, 80).map(function (v) { return '<div class="tick' + (v % 5 === 0 ? ' d' : '') + '">' + (v % 5 === 0 ? '<b>' + v + '</b>' : '') + '</div>'; }).join('');
    return {
      html: titre('Quel âge as-tu ?')
        + '<div class="ctrl regle-h" data-c style="--c:2"><div class="val"><span id="vAge">' + S.age + '</span><small>ans</small></div>'
        + '<div class="piste-h" id="pAge"><div class="bout" style="width:calc(50% - 7px)"></div>' + t + '<div class="bout" style="width:calc(50% - 7px)"></div></div><div class="repere-h"></div></div>',
      monter: function (el) {
        var v = el.querySelector('#vAge');
        regle(el.querySelector('#pAge'), 14, 80, 14, 'x', S.age, function (x) { S.age = x; v.textContent = x; garder(); });
      }
    };
  },
  discipline: function () {
    return {
      classe: 'large',
      html: titre('Quelle est ta discipline ?')
        + '<div class="ctrl choix grille" data-c style="--c:2">' + DISCIPLINES.map(function (d) {
          return '<button type="button" class="carte grand' + (S.discipline === d.id ? ' on' : '') + '" data-v="' + d.id + '">' + ico(d.ico || d.id) + '<div><b>' + d.nom + '</b><br><span>' + d.sous + '</span></div></button>';
        }).join('') + '</div>',
      valide: function () { return !!S.discipline; },
      monter: function (el) {
        choixUnique(el, '.carte', 'discipline', function (v) {
          if (S.discipline !== v) { S.competition = ''; S.objectif = ''; S.cible = null; }
          S.discipline = v; setTimeout(suivant, 420);
        });
      }
    };
  },
  competition: function () {
    var d = disc();
    var l = COMPETITIONS.filter(function (c) { return c.d === S.discipline; });
    return {
      classe: 'large',
      html: titre('Tu prépares une compétition ?') + aide('Choisis-la : on adapte toute l’analyse à son effort.')
        + '<div class="ctrl badges" data-c style="--c:2">' + l.map(function (c) {
          return '<button type="button" class="badge' + (S.competition === c.id ? ' on' : '') + '" data-v="' + c.id + '"><span class="embleme">' + ico(d.ico || d.id) + '</span><span class="an">' + c.an + '</span><div><b>' + c.nom + '</b><br><span>' + c.sous + '</span></div></button>';
        }).join('') + '<button type="button" class="badge aucune' + (S.competition === 'aucune' ? ' on' : '') + '" data-v="aucune"><b>Pas de compétition prévue</b><span>Je m’entraîne pour un objectif physique</span></button></div>',
      valide: function () { return !!S.competition; },
      monter: function (el) {
        choixUnique(el, '.badge', 'competition', function (v) {
          if (S.competition !== v) { S.objectif = ''; S.cible = null; }
          S.competition = v; setTimeout(suivant, 420);
        });
      }
    };
  },
  objectif: function () {
    var c = comp(), l = OBJECTIFS[typeComp()] || OBJECTIFS.aucune;
    var t = c ? 'Ton objectif pour ' + (c.nom.indexOf('Un') === 0 ? 'cette épreuve' : c.nom) + ' ?' : 'Quel est ton objectif ?';
    return {
      html: titre(esc(t))
        + '<div class="ctrl choix" data-c style="--c:2">' + l.map(function (o) {
          return '<button type="button" class="carte' + (S.objectif === o.id ? ' on' : '') + '" data-v="' + o.id + '">' + ico(o.ico) + '<b>' + o.nom + '</b><span>' + o.sous + '</span></button>';
        }).join('') + '</div>',
      valide: function () { return !!S.objectif; },
      monter: function (el) { choixUnique(el, '.carte', 'objectif', function (v) { S.objectif = v; setTimeout(suivant, 420); }); }
    };
  },
  cible: function () {
    var c = comp(), base = c.base[S.sexe === 'femme' ? 1 : 0];
    if (S.cible == null) S.cible = Math.round(base * 0.92 / 5) * 5;
    var h = Math.floor(S.cible / 60), m = S.cible % 60;
    var maxH = Math.max(2, Math.ceil(base * 1.8 / 60));
    return {
      html: titre('Quel temps vises-tu ?') + aide(esc(c.nom) + ' · ' + esc(c.sous))
        + '<div class="ctrl roues" data-c style="--c:2"><div class="roue" id="rH" style="width:70px"></div><span class="unite" style="width:auto">h</span><div class="roue" id="rM"></div><span class="unite">min</span></div>',
      monter: function (el) {
        function maj() { S.cible = h * 60 + m; garder(); verifier(); }
        roue(el.querySelector('#rH'), plage(0, maxH), Math.min(h, maxH), function (i) { h = i; maj(); });
        roue(el.querySelector('#rM'), plage(0, 59, deux), m, function (i) { m = i; maj(); });
      },
      valide: function () { return S.cible > 0; }
    };
  },
  poidsCible: function () {
    if (S.poidsCible == null) S.poidsCible = Math.round(S.objectif === 'descendre' ? S.poids - 4 : S.poids + 3);
    return {
      html: titre('Quel poids vises-tu ?') + aide(S.objectif === 'descendre' ? 'La limite de la catégorie que tu vises.' : 'Le poids de ta prochaine catégorie.')
        + '<div class="ctrl roues" data-c style="--c:2"><div class="roue" id="rPc"></div><span class="unite">kg</span></div>',
      monter: function (el) {
        roue(el.querySelector('#rPc'), plage(40, 160), Math.round(S.poidsCible) - 40, function (i) { S.poidsCible = 40 + i; garder(); });
      }
    };
  },
  semaine: function () {
    var h = '<div class="semaine" data-c style="--c:2"><span></span>' + J1.map(function (j) { return '<span class="jour">' + j + '</span>'; }).join('');
    CRENEAUX.forEach(function (c) {
      h += '<span class="cren">' + c[1] + '</span>';
      for (var d = 0; d < 7; d++) h += '<button type="button" class="bloc' + (S.creneaux[d + c[0]] ? ' on' : '') + '" data-k="' + d + c[0] + '" aria-label="' + JOURS[d] + ' ' + c[1] + '" aria-pressed="' + !!S.creneaux[d + c[0]] + '"></button>';
    });
    h += '</div>';
    return {
      classe: 'large',
      html: titre('Quand t’entraînes-tu ?') + aide('Touche chaque créneau où tu as une séance, sur une semaine type.')
        + '<div class="ctrl">' + h + '<p class="compte" data-c style="--c:3" id="nbS"></p></div>',
      valide: function () { return sessions().length > 0; },
      monter: function (el) {
        var n = el.querySelector('#nbS');
        function compter() { var x = sessions().length; n.innerHTML = x ? '<b>' + x + ' séance' + (x > 1 ? 's' : '') + '</b> par semaine' : 'Aucune séance pour l’instant'; }
        el.querySelectorAll('.bloc').forEach(function (b) {
          b.addEventListener('click', function () {
            var k = b.getAttribute('data-k'); S.creneaux[k] = !S.creneaux[k];
            if (!S.creneaux[k]) delete S.creneaux[k];
            b.classList.toggle('on', !!S.creneaux[k]); b.setAttribute('aria-pressed', !!S.creneaux[k]);
            compter(); garder(); verifier();
          });
        });
        compter();
      }
    };
  },
  type: function (k) {
    var s = seance(k), ls = sessions(), avant = ls.slice(0, ls.indexOf(k)).filter(function (x) { return S.seances[x] && S.seances[x].type && !S.seances[x].copie; }).pop();
    var ordre = TYPES.slice().sort(function (a, b) { return pertinence(b.id) - pertinence(a.id); });
    return {
      html: titre(esc(nomSession(k)) + ', c’est quoi ?')
        + '<div class="ctrl choix deux" data-c style="--c:2">' + ordre.map(function (t) {
          return '<button type="button" class="carte' + (s.type === t.id && !s.copie ? ' on' : '') + '" data-v="' + t.id + '">' + ico(t.id) + '<b>' + t.nom + '</b><span>' + t.sous + '</span></button>';
        }).join('') + '</div>'
        + (avant ? '<button type="button" class="raccourci" data-c style="--c:3" id="copie">La même séance que ' + esc(nomSession(avant)) + '</button>' : ''),
      valide: function () { return !!s.type; },
      monter: function (el) {
        choixUnique(el, '.carte', 'type', function (v) {
          if (s.type !== v) s.exos = [];
          s.type = v; s.copie = ''; setTimeout(suivant, 380);
        });
        var c = el.querySelector('#copie');
        if (c) c.addEventListener('click', function () {
          var a = S.seances[avant];
          S.seances[k] = { type: a.type, exos: a.exos.slice(), intensite: a.intensite, duree: a.duree, copie: avant };
          garder(); suivant();
        });
      }
    };
  },
  exos: function (k) {
    var s = seance(k), d = S.discipline;
    var liste = EXOS[s.type] || [];
    var spec = liste.filter(function (e) { return e.d.indexOf(d) >= 0; });
    var autres = liste.filter(function (e) { return e.d.indexOf(d) < 0; });
    function puces(l) {
      return '<div class="puces">' + l.map(function (e) {
        return '<button type="button" class="puce' + (s.exos.indexOf(e.id) >= 0 ? ' on' : '') + '" data-v="' + e.id + '">' + e.nom + '</button>';
      }).join('') + '</div>';
    }
    return {
      classe: 'large haut',
      html: titre('Qu’est-ce que tu fais ' + esc(nomSession(k).toLowerCase()) + ' ?') + aide('Touche tous les exercices de la séance.')
        + '<div class="ctrl" data-c style="--c:2">'
        + (spec.length ? '<div class="groupe"><h3>Spécifique ' + esc(disc().nom) + '</h3>' + puces(spec) + '</div>' : '')
        + (autres.length ? '<div class="groupe"><h3>' + (spec.length ? 'Complémentaire' : 'Exercices') + '</h3>' + puces(autres) + '</div>' : '')
        + '</div>',
      valide: function () { return s.exos.length > 0; },
      monter: function (el) {
        el.querySelectorAll('.puce').forEach(function (b) {
          b.addEventListener('click', function () {
            var v = b.getAttribute('data-v'), i = s.exos.indexOf(v);
            if (i >= 0) s.exos.splice(i, 1); else s.exos.push(v);
            b.classList.toggle('on', i < 0); garder(); verifier();
          });
        });
      }
    };
  },
  intensite: function (k) {
    var s = seance(k);
    var MOTS = ['', 'Très facile', 'Facile', 'Facile', 'Modérée', 'Modérée', 'Soutenue', 'Difficile', 'Très difficile', 'Presque maximale', 'Maximale'];
    var DUREES = [30, 45, 60, 75, 90, 120, 150];
    return {
      html: titre('Quelle intensité ' + esc(nomSession(k).toLowerCase()) + ' ?') + aide('Ton ressenti d’effort, de 1 à 10.')
        + '<div class="ctrl intens" data-c style="--c:2"><div class="val"><span id="vI">' + s.intensite + '</span><small>/ 10</small></div><div class="mot" id="mI">' + MOTS[s.intensite] + '</div>'
        + '<input type="range" min="1" max="10" step="1" value="' + s.intensite + '" id="rI" aria-label="Intensité"><div class="bornes"><span>Facile</span><span>Maximale</span></div></div>'
        + '<p class="sous-q" data-c style="--c:3">Combien de temps ?</p><div class="puces" data-c style="--c:4" id="dur">' + DUREES.map(function (d) {
          return '<button type="button" class="puce' + (s.duree === d ? ' on' : '') + '" data-v="' + d + '">' + (d < 60 ? d + ' min' : Math.floor(d / 60) + ' h' + (d % 60 ? ' ' + d % 60 : '')) + '</button>';
        }).join('') + '</div>',
      monter: function (el) {
        var r = el.querySelector('#rI'), v = el.querySelector('#vI'), m = el.querySelector('#mI');
        function peindre() { r.style.setProperty('--p', ((s.intensite - 1) / 9 * 100) + '%'); v.textContent = s.intensite; m.textContent = MOTS[s.intensite]; }
        r.addEventListener('input', function () { s.intensite = +r.value; peindre(); garder(); });
        peindre();
        choixUnique(el.querySelector('#dur'), '.puce', 'duree', function (x) { s.duree = +x; });
      }
    };
  },
  repas: function () {
    var jour = 0;
    function pret(d) { var r = S.repas[d]; return r && r.pdj && r.dej && r.din; }
    /* Une journée complète se reporte sur les suivantes encore vides :
       on décrit SA semaine type une fois, puis on corrige les jours qui
       diffèrent. Le report est dit à l'écran (« Repris de lundi »). */
    function propager() {
      for (var d = 1; d < 7; d++) if (!pret(d) && pret(d - 1)) {
        S.repas[d] = { pdj: S.repas[d - 1].pdj, dej: S.repas[d - 1].dej, din: S.repas[d - 1].din, repris: 1 };
      }
    }
    function corps() {
      var r = S.repas[jour] || (S.repas[jour] = {});
      return '<p class="repris">' + (r.repris ? 'Repris de ' + JOURS[jour - 1].toLowerCase() + ' : touche ce qui change.' : '') + '</p>'
        + SLOTS.map(function (sl) {
          var l = REPAS.filter(function (x) { return x.c === (sl[0] === 'pdj' ? 'pdj' : 'rep'); });
          return '<div class="groupe"><h3>' + sl[1] + '</h3><div class="rangee">' + l.map(function (x) {
            return '<button type="button" class="puce' + (r[sl[0]] === x.id ? ' on' : '') + '" data-s="' + sl[0] + '" data-v="' + x.id + '"><span class="e">' + x.e + '</span>' + x.nom + '</button>';
          }).join('') + '</div></div>';
        }).join('');
    }
    return {
      classe: 'large haut',
      html: titre('Et tes repas ?') + aide('Jour par jour, touche ce que tu manges d’habitude.')
        + '<div class="ctrl" data-c style="--c:2"><div class="onglets" id="ong">' + J1.map(function (j, d) { return '<button type="button" class="onglet" data-d="' + d + '">' + j + '</button>'; }).join('') + '</div><div id="corpsR"></div></div>',
      valide: function () { for (var d = 0; d < 7; d++) if (!pret(d)) return false; return true; },
      cta: 'Continuer',
      monter: function (el) {
        var ong = el.querySelector('#ong'), c = el.querySelector('#corpsR');
        function peindre() {
          if (S.repas[jour]) S.repas[jour].vu = 1;
          ong.querySelectorAll('.onglet').forEach(function (b, d) { b.classList.toggle('on', d === jour); b.classList.toggle('fait', !!pret(d)); });
          c.innerHTML = corps();
          c.querySelectorAll('.puce').forEach(function (b) {
            b.addEventListener('click', function () {
              var r = S.repas[jour]; r[b.getAttribute('data-s')] = b.getAttribute('data-v'); delete r.repris;
              c.querySelectorAll('.puce[data-s="' + b.getAttribute('data-s') + '"]').forEach(function (x) { x.classList.toggle('on', x === b); });
              var rp = c.querySelector('.repris'); if (rp) rp.textContent = '';
              propager();
              ong.querySelectorAll('.onglet').forEach(function (o, d) { o.classList.toggle('fait', !!pret(d)); });
              garder(); verifier();
              /* Le jour est complet : on passe au suivant, de lui-même. */
              if (pret(jour) && jour < 6 && b.getAttribute('data-s') === 'din' && S.repas[jour + 1] && !S.repas[jour + 1].vu) setTimeout(function () { jour++; peindre(); verifier(); }, 450);
            });
          });
        }
        ong.addEventListener('click', function (e) { var b = e.target.closest('.onglet'); if (!b) return; jour = +b.getAttribute('data-d'); peindre(); verifier(); });
        propager(); peindre();
      }
    };
  },
  ingredients: function () {
    return {
      classe: 'large haut',
      html: titre('Ce que tu manges le plus ?') + aide('Touche les ingrédients que tu retrouves souvent dans ton assiette.')
        + '<div class="ctrl puces" data-c style="--c:2">' + INGREDIENTS.map(function (x) {
          return '<button type="button" class="puce' + (S.ingredients.indexOf(x.id) >= 0 ? ' on' : '') + '" data-v="' + x.id + '"><span class="e">' + x.e + '</span>' + x.nom + '</button>';
        }).join('') + '</div>',
      valide: function () { return S.ingredients.length > 0; },
      cta: 'Voir mon analyse',
      monter: function (el) {
        el.querySelectorAll('.puce').forEach(function (b) {
          b.addEventListener('click', function () {
            var v = b.getAttribute('data-v'), i = S.ingredients.indexOf(v);
            if (i >= 0) S.ingredients.splice(i, 1); else S.ingredients.push(v);
            b.classList.toggle('on', i < 0); garder(); verifier();
          });
        });
      }
    };
  },
  calcul: function () {
    var L = ['On additionne tes séances…', 'On calcule ta dépense, jour par jour…', 'On place tes glucides autour des efforts…', 'On regarde ta récupération…', 'On estime ton temps…'];
    return {
      sansCta: true,
      html: '<div class="calcul">' + '<svg class="anneau" viewBox="0 0 120 120" data-c style="--c:0"><circle class="fond" cx="60" cy="60" r="54"/><circle class="arc" cx="60" cy="60" r="54"/></svg>'
        + titre('Analyse de ta préparation') + '<p class="ligne" id="ligneC" data-c style="--c:2">' + L[0] + '</p></div>',
      monter: function (el) {
        var l = el.querySelector('#ligneC'), i = 0;
        var t = setInterval(function () {
          i++; if (i >= L.length) { clearInterval(t); setTimeout(suivant, 450); return; }
          l.style.opacity = 0; setTimeout(function () { l.textContent = L[i]; l.style.opacity = 1; }, 250);
        }, 700);
      }
    };
  },
  resultat: function () {
    var A = analyser();
    return { classe: 'large haut', sansCta: true, html: rendreResultat(A), monter: function (el) { brancherResultat(el); } };
  }
};

function prenomCourt() { var p = (S.prenom || '').trim(); return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Toi'; }
/* Quel type de séance est le plus pertinent pour cette discipline. */
function pertinence(t) {
  var f = (disc() || {}).fam;
  var P = {
    cardio:    { endurance: 6, intervalles: 5, force: 3, technique: 2, hybride: 2, recup: 1 },
    hybride:   { hybride: 6, endurance: 5, force: 4, intervalles: 3, technique: 2, recup: 1 },
    combat:    { technique: 6, intervalles: 5, force: 4, hybride: 3, endurance: 2, recup: 1 },
    force:     { force: 6, hybride: 3, endurance: 2, intervalles: 2, technique: 1, recup: 1 },
    collectif: { technique: 6, intervalles: 5, force: 4, endurance: 3, hybride: 2, recup: 1 }
  };
  return ((P[f] || P.cardio)[t]) || 0;
}

/* ═══════════════════════════════════════════════════════════════
   3. L'ANALYSE
   ═══════════════════════════════════════════════════════════════ */
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
/* Une note qui vaut 100 dans [lo, hi] et décroît en dehors. */
function dansBornes(x, lo, hi, pente) {
  if (x >= lo && x <= hi) return 100;
  var e = x < lo ? (lo - x) / lo : (x - hi) / hi;
  return clamp(100 - e * (pente || 160), 0, 100);
}
function lettre(n) {
  if (n >= 85) return ['Excellent', 'g-ex'];
  if (n >= 72) return ['Très bien', 'g-tb'];
  if (n >= 58) return ['Bien', 'g-b'];
  if (n >= 42) return ['Moyen', 'g-m'];
  return ['Mauvais', 'g-ma'];
}
function pill(n) { var l = lettre(n); return '<span class="pill ' + l[1] + '">' + l[0] + '</span>'; }
function hm(min) { min = Math.round(min); var h = Math.floor(min / 60), m = min % 60; return h ? h + ' h ' + deux(m) : m + ' min'; }

function analyser() {
  var P = S.poids, H = S.taille, A = S.age;
  var bmrH = 10 * P + 6.25 * H - 5 * A + 5, bmrF = 10 * P + 6.25 * H - 5 * A - 161;
  var bmr = S.sexe === 'homme' ? bmrH : S.sexe === 'femme' ? bmrF : (bmrH + bmrF) / 2;
  var obj = S.objectif;
  var ajust = (obj === 'seche' || obj === 'descendre') ? 0.88 : (obj === 'masse' || obj === 'monter') ? 1.1 : 1;
  var protCible = (obj === 'seche' || obj === 'descendre') ? [2.0, 2.4] : [1.6, 2.2];

  /* Chaque séance : sa dépense, ses glucides consommés, ses repas avant/après. */
  var SEA = sessions().map(function (k) {
    var s = seance(k), t = typeDe(s.type);
    var met = t.met * (0.55 + 0.075 * s.intensite);
    var kcal = Math.max(0, (met - 1) * P * s.duree / 60);
    var glu = kcal * (t.glu + (s.intensite - 5) * 0.03) / 4;
    var d = +k[0], c = k[1];
    var avant = c === 'm' ? 'pdj' : 'dej', apres = c === 'm' ? 'dej' : 'din';
    var exig = s.duree >= 45 && s.intensite >= 6 && s.type !== 'recup' && s.type !== 'force';
    return { k: k, d: d, c: c, s: s, t: t, kcal: kcal, glu: glu, avant: avant, apres: apres, exig: exig };
  });

  var JRS = [];
  for (var d = 0; d < 7; d++) {
    var r = S.repas[d] || {};
    var ses = SEA.filter(function (x) { return x.d === d; });
    var dep = ses.reduce(function (a, x) { return a + x.kcal; }, 0);
    var heq = ses.reduce(function (a, x) { return a + x.s.duree / 60 * (x.s.intensite / 7) * (x.s.type === 'recup' ? .3 : x.s.type === 'force' ? .6 : 1); }, 0);
    var besoin = (bmr * 1.4 + dep) * ajust;
    var gluCible = clamp(3.5 + 2.6 * heq, 3, 10);
    var rp = SLOTS.map(function (sl) { return REP[r[sl[0]]] || REP[sl[0] === 'pdj' ? 'rien-pdj' : 'rien']; });
    var tot = rp.reduce(function (a, x) { return { k: a.k + x.k, p: a.p + x.p, g: a.g + x.g, l: a.l + x.l }; }, { k: 0, p: 0, g: 0, l: 0 });

    var quant = dansBornes(tot.k / besoin, .92, 1.08, 220);
    var gkg = tot.g / P, pkg = tot.p / P;
    var gJour = dansBornes(gkg, gluCible - .8, gluCible + 1.2, 140);
    /* Les phases : avant une séance exigeante ≈ 1 g/kg de glucides, après aussi. */
    var phases = [];
    ses.forEach(function (x) {
      if (!x.exig) return;
      var av = REP[r[x.avant]] || {}, ap = REP[r[x.apres]] || {};
      phases.push(clamp((av.g || 0) / P * 100, 0, 100));
      phases.push(clamp((ap.g || 0) / P * 100, 0, 100));
    });
    var gPhase = phases.length ? phases.reduce(function (a, b) { return a + b; }, 0) / phases.length : 100;
    var glucides = .6 * gJour + .4 * gPhase;

    var pJour = dansBornes(pkg, protCible[0], protCible[1] + .4, 150);
    var recs = ses.filter(function (x) { return x.s.type !== 'recup'; }).map(function (x) {
      var ap = REP[r[x.apres]] || {}; return clamp((ap.p || 0) / Math.max(20, .3 * P) * 100, 0, 100);
    });
    var pRec = recs.length ? recs.reduce(function (a, b) { return a + b; }, 0) / recs.length : pJour;
    var proteines = .5 * pJour + .5 * pRec;

    var sautes = rp.filter(function (x) { return x.k < 50; }).length;
    var doses = rp.filter(function (x) { return x.p >= Math.max(20, .3 * P) * .85; }).length;
    var maxPart = tot.k ? Math.max.apply(null, rp.map(function (x) { return x.k / tot.k; })) : 1;
    var repart = clamp(100 - sautes * 22 - Math.max(0, 3 - doses) * 12 - Math.max(0, maxPart - .5) * 120, 0, 100);

    var qk = rp.filter(function (x) { return x.q != null && x.k > 0; });
    var qual = qk.length ? qk.reduce(function (a, x) { return a + x.q * x.k; }, 0) / qk.reduce(function (a, x) { return a + x.k; }, 0) : 30;

    var note = .2 * quant + .25 * glucides + .2 * proteines + .15 * repart + .2 * qual;
    JRS.push({ d: d, ses: ses, dep: dep, besoin: besoin, tot: tot, gkg: gkg, pkg: pkg, gluCible: gluCible, rp: rp, r: r,
      quant: quant, glucides: glucides, gPhase: gPhase, proteines: proteines, pRec: pRec, repart: repart, qual: qual, note: note, sautes: sautes });
  }

  var moy = function (f) { var s = 0, w = 0; JRS.forEach(function (j) { var p = j.ses.length ? 1.3 : 1; s += f(j) * p; w += p; }); return s / w; };
  var ingQ = S.ingredients.length ? S.ingredients.reduce(function (a, id) { var x = INGREDIENTS.filter(function (i) { return i.id === id; })[0]; return a + NOTE_ING[x.n]; }, 0) / S.ingredients.length : 60;
  var C = {
    repart: moy(function (j) { return j.repart; }),
    qual: .7 * moy(function (j) { return j.qual; }) + .3 * ingQ,
    quant: moy(function (j) { return j.quant; }),
    glucides: moy(function (j) { return j.glucides; }),
    proteines: moy(function (j) { return j.proteines; })
  };
  var N = .15 * C.repart + .2 * C.qual + .2 * C.quant + .25 * C.glucides + .2 * C.proteines;

  /* L'entraînement : volume, intensité, spécificité. */
  var minEnd = SEA.filter(function (x) { return ['endurance', 'intervalles', 'hybride', 'technique'].indexOf(x.s.type) >= 0; }).reduce(function (a, x) { return a + x.s.duree; }, 0);
  var minTot = SEA.reduce(function (a, x) { return a + x.s.duree; }, 0);
  var iMoy = SEA.length ? SEA.reduce(function (a, x) { return a + x.s.intensite; }, 0) / SEA.length : 0;
  var tousExos = []; SEA.forEach(function (x) { x.s.exos.forEach(function (e) { if (EXO[e]) tousExos.push(EXO[e]); }); });
  var spec = tousExos.length ? tousExos.filter(function (e) { return e.d.indexOf(S.discipline) >= 0; }).length / tousExos.length : 0;
  var c = comp(), ref = (c && c.ref) || 300;
  var vol = clamp((disc() && disc().fam === 'force' ? minTot : minEnd) / ref, 0, 1.25);
  var F = clamp(.55 * Math.min(vol, 1.2) + .2 * (iMoy / 10) + .25 * spec, 0, 1.1);

  /* Le temps probable : un finisseur médian, corrigé par la préparation. */
  var temps = null;
  if (c && c.base) {
    var base = c.base[S.sexe === 'femme' ? 1 : S.sexe === 'homme' ? 0 : 0] * (S.sexe === 'autre' ? 1.06 : 1);
    var fAge = 1 + Math.max(0, A - 35) * .006 + Math.max(0, 20 - A) * .004;
    var imc = P / Math.pow(H / 100, 2);
    var fImc = 1 + Math.max(0, imc - 25) * .012 + Math.max(0, 19 - imc) * .01;
    var fNut = function (n) { return 1 + (.7 - n / 100) * .10; };
    var t = base * (1.22 - .40 * F) * fAge * fImc;
    temps = { val: t * fNut(N), bas: t * fNut(N) * .965, haut: t * fNut(N) * 1.035, aligne: t * fNut(92) };
  }

  /* Bilan énergétique, pour les objectifs de poids. */
  var bilan = JRS.reduce(function (a, j) { return a + (j.tot.k - j.besoin / ajust); }, 0);
  return { JRS: JRS, SEA: SEA, C: C, N: N, F: F, temps: temps, bilan: bilan, spec: spec, minTot: minTot, iMoy: iMoy, protCible: protCible };
}

/* ─── Le rendu des résultats ─────────────────────────────────── */
function rendreResultat(A) {
  var c = comp(), h = '';
  var gain = A.temps ? A.temps.val - A.temps.aligne : 0;
  h += '<div class="res-hero">';
  if (A.temps) {
    h += '<p class="label" data-c style="--c:0">' + esc(prenomCourt()) + ', ton temps probable · ' + esc(c.nom) + (c.an !== '—' ? ' ' + c.an : '') + '</p>'
      + titreRes(hm(A.temps.val))
      + '<p class="fourchette" data-c style="--c:2">entre ' + hm(A.temps.bas) + ' et ' + hm(A.temps.haut) + '</p>';
    if (S.objectif === 'temps' && S.cible) {
      var e = A.temps.val - S.cible;
      h += '<p class="ecart" data-c style="--c:3">' + (e > 0
        ? 'Il te manque environ <b>' + hm(e) + '</b> sur ton objectif de ' + hm(S.cible) + '.' + (gain >= 1 ? ' Une alimentation alignée sur tes séances t’en ferait gagner près de <b>' + hm(gain) + '</b>.' : '')
        : 'Tu es dans le temps de ton objectif de ' + hm(S.cible) + ', avec environ <b>' + hm(-e) + '</b> de marge.') + '</p>';
    } else if (gain >= 1) {
      h += '<p class="ecart" data-c style="--c:3">Une alimentation alignée sur tes séances te ferait gagner près de <b>' + hm(gain) + '</b>.</p>';
    }
  } else {
    var ind = Math.round(100 * (.6 * Math.min(1, A.F) + .4 * A.N / 100));
    h += '<p class="label" data-c style="--c:0">' + esc(prenomCourt()) + ', ta préparation' + (c ? ' · ' + esc(c.nom) : '') + '</p>'
      + titreRes(ind + '<span style="font-size:.4em;color:var(--muted)"> / 100</span>');
    var kgSem = A.bilan / 7700;
    if (S.objectif === 'descendre' || S.objectif === 'monter' || S.objectif === 'seche' || S.objectif === 'masse') {
      h += '<p class="ecart" data-c style="--c:3">À ce rythme, ton poids évolue d’environ <b>' + (kgSem >= 0 ? '+' : '−') + Math.abs(kgSem).toFixed(1).replace('.', ',') + ' kg par semaine</b>'
        + (S.poidsCible ? ' ; il te faudrait <b>' + Math.max(0, Math.ceil(Math.abs(S.poidsCible - S.poids) / Math.max(.05, Math.abs(kgSem)))) + ' semaines</b> pour atteindre ' + S.poidsCible + ' kg' + ((S.poidsCible - S.poids) * kgSem < 0 ? ', mais dans le mauvais sens' : '') : '') + '.</p>';
    } else {
      h += '<p class="ecart" data-c style="--c:3">Ton entraînement compte pour 60 % de cet indice, ton alimentation pour 40 %.</p>';
    }
  }
  h += '</div>';

  /* La note */
  var CR = [
    ['repart', 'Répartition des repas', 'Des repas réguliers, des protéines à chacun.'],
    ['qual', 'Qualité', 'Des aliments peu transformés, denses en nutriments.'],
    ['quant', 'Quantité', 'Ce que tu manges face à ce que tu dépenses, jour par jour.'],
    ['glucides', 'Glucides et phases d’effort', 'Assez de glucides, et au bon moment autour des séances.'],
    ['proteines', 'Protéines et récupération', 'La dose du jour, et le repas qui suit chaque séance.']
  ];
  h += '<section class="res-section"><h2>Ta note</h2><div class="note-globale"><b>' + Math.round(A.N) + '</b><span>/ 100 · ' + lettre(A.N)[0] + '</span></div>'
    + CR.map(function (x) { var v = Math.round(A.C[x[0]]); return '<div class="critere"><b>' + x[1] + '</b><em>' + v + '</em><div class="jauge"><i style="--v:' + v + '%"></i></div><p>' + x[2] + '</p></div>'; }).join('') + '</section>';

  /* Par jour */
  h += '<section class="res-section"><h2>Par jour</h2><div class="jours">' + A.JRS.map(function (j, i) {
    return '<div class="col"><span class="n">' + Math.round(j.note) + '</span><div class="barre-j' + (j.ses.length ? '' : ' repos') + '" style="--h:' + Math.max(8, j.note) + '%;--i:' + i + '"></div><span class="j">' + J1[i] + '</span></div>';
  }).join('') + '</div><div class="detail-jours">' + A.JRS.map(function (j) {
    return '<div class="ligne-j"><span class="nom">' + JOURS[j.d].slice(0, 3) + '.</span><span class="chiffres"><b>' + Math.round(j.tot.k) + '</b> / ' + Math.round(j.besoin) + ' kcal · glucides <b>' + j.gkg.toFixed(1).replace('.', ',') + '</b> / ' + j.gluCible.toFixed(1).replace('.', ',') + ' g/kg · protéines <b>' + Math.round(j.tot.p) + '</b> g'
      + (j.ses.length ? ' · ' + j.ses.length + ' séance' + (j.ses.length > 1 ? 's' : '') : ' · repos') + '</span>' + pill(j.note) + '</div>';
  }).join('') + '</div></section>';

  /* Par séance et par exercice */
  h += '<section class="res-section"><h2>Par séance et par exercice</h2>' + A.SEA.map(function (x) {
    var j = A.JRS[x.d], r = j.r;
    var av = REP[r[x.avant]] || {}, ap = REP[r[x.apres]] || {};
    var carbu = clamp(Math.round(j.tot.g / Math.max(1, j.gluCible * S.poids) * 100), 0, 140);
    var recup = clamp(Math.round((ap.p || 0) / Math.max(20, .3 * S.poids) * 100), 0, 140);
    var exos = x.s.exos.map(function (id) {
      var e = EXO[id]; if (!e) return '';
      var sp = e.d.indexOf(S.discipline) >= 0 ? 100 : e.d.length ? 68 : 55;
      var fuel = e.g === 3 ? Math.min(100, carbu) : e.g === 2 ? Math.min(100, (carbu + 100) / 2) : 95;
      var rc = Math.min(100, recup);
      /* Une moyenne GÉOMÉTRIQUE : un exercice très spécifique mal nourri
         n'est pas bien préparé. Une moyenne arithmétique le cachait (« Très
         bien » avec 27 % du carburant du jour, vu au banc). */
      var n = Math.pow(Math.max(5, sp), .2) * Math.pow(Math.max(5, fuel), .5) * Math.pow(Math.max(5, rc), .3);
      var dem = e.g === 3 ? 'glycogène très sollicité' : e.g === 2 ? 'glycogène sollicité' : 'peu de glycogène';
      return '<div class="exo"><b>' + e.nom + '</b>' + pill(n) + '<p>' + (sp === 100 ? 'Spécifique ' + esc(disc().nom) : 'Complémentaire') + ' · ' + dem + (e.g === 3 ? ' · carburant du jour ' + Math.min(100, carbu) + ' %' : '') + '</p></div>';
    }).join('');
    return '<div class="carte-res"><div class="tete"><b>' + nomSession(x.k) + ' · ' + x.t.nom + '</b><span>' + hm(x.s.duree) + ' · ' + x.s.intensite + '/10 · ~' + Math.round(x.kcal) + ' kcal</span></div>'
      + '<p class="info">Avant : ' + esc((av.nom || '—').toLowerCase()) + ' · après : ' + esc((ap.nom || '—').toLowerCase()) + ' (' + (ap.p || 0) + ' g de protéines)</p>' + exos + '</div>';
  }).join('') + '</section>';

  /* Par repas */
  var vus = {};
  A.JRS.forEach(function (j) { SLOTS.forEach(function (sl) { var id = j.r[sl[0]]; if (id) (vus[id] = vus[id] || { n: 0, apres: 0, avant: 0 }).n++; }); });
  A.SEA.forEach(function (x) { var r = A.JRS[x.d].r; if (vus[r[x.apres]]) vus[r[x.apres]].apres++; if (vus[r[x.avant]]) vus[r[x.avant]].avant++; });
  var dose = Math.max(20, .3 * S.poids);
  var lr = Object.keys(vus).map(function (id) {
    var m = REP[id], v = vus[id];
    if (!m || m.q == null) return { m: m, v: v, n: 20, txt: 'Repas sauté ' + v.n + ' fois : une dose de protéines et d’énergie en moins.' };
    var pA = clamp(m.p / dose * 100, 0, 100);
    var role = v.apres ? (m.p >= dose * .85 ? 100 : 55) : v.avant ? (m.g / S.poids >= .9 ? 100 : 60) : 85;
    var n = .5 * m.q + .3 * pA + .2 * role;
    var txt = m.p + ' g de protéines, ' + m.g + ' g de glucides, ~' + m.k + ' kcal';
    if (v.apres && m.p < dose * .85) txt += ' · après séance, il manque ' + Math.round(dose - m.p) + ' g de protéines';
    else if (v.avant && m.g / S.poids < .9) txt += ' · un peu léger en glucides avant l’effort';
    return { m: m, v: v, n: n, txt: txt };
  }).sort(function (a, b) { return b.v.n - a.v.n; });
  h += '<section class="res-section"><h2>Par repas</h2>' + lr.map(function (x) {
    return '<div class="elem"><span class="e">' + x.m.e + '</span><b>' + x.m.nom + ' <span style="color:var(--muted);font-weight:300">· ' + x.v.n + '×</span></b>' + pill(x.n) + '<p>' + x.txt + '</p></div>';
  }).join('') + '</section>';

  /* Par ingrédient */
  h += '<section class="res-section"><h2>Par ingrédient</h2>' + S.ingredients.map(function (id) {
    var x = INGREDIENTS.filter(function (i) { return i.id === id; })[0];
    return '<div class="elem"><span class="e">' + x.e + '</span><b>' + x.nom + '</b>' + pill(NOTE_ING[x.n]) + '<p>' + x.pourquoi + '</p></div>';
  }).join('') + '</section>';

  /* Conseils */
  h += '<section class="res-section"><h2>Nos conseils</h2><ol class="conseils">' + conseils(A).map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol></section>';

  h += '<div class="fin"><h2>Made For Me</h2><p>Natty calcule ces apports pour toi, séance par séance, et les cuisine. Tes plats arrivent dosés sur ta préparation.</p>'
    + '<div class="liens"><a class="btn-noir" href="https://www.natty-nutrition.com/#made">Découvrir Made For Me</a><button type="button" class="lien-gris" id="recommencer">Refaire le test</button></div>'
    + '<p class="mention">Estimation indicative, sans valeur médicale. Les repas sont comptés en portions types et les besoins calculés avec la formule de Mifflin-St Jeor, les dépenses de tes séances (équivalents métaboliques) et les repères de l’ACSM et de l’ISSN pour les sportifs. Le temps probable part du temps d’un finisseur médian de l’épreuve, corrigé par ton volume, ton intensité, la spécificité de tes séances, ton âge, ton gabarit et ton alimentation. Rien n’est envoyé : tes réponses restent sur cet appareil.</p></div>';
  return h;
}
function titreRes(t) { return '<div class="grand" data-c style="--c:1">' + t + '</div>'; }

function conseils(A) {
  var L = [], P = S.poids;
  var jE = A.JRS.filter(function (j) { return j.ses.some(function (x) { return x.exig; }); });
  var gMoy = jE.length ? jE.reduce(function (a, j) { return a + j.gkg; }, 0) / jE.length : 0;
  var gCib = jE.length ? jE.reduce(function (a, j) { return a + j.gluCible; }, 0) / jE.length : 0;
  if (jE.length && gMoy < gCib - .8) {
    L.push({ p: 10, t: 'Avec ton taux de glucides (' + gMoy.toFixed(1).replace('.', ',') + ' g/kg pour environ ' + gCib.toFixed(1).replace('.', ',') + ' visés les jours d’entraînement), tes phases de récupération seront moins efficaces et tes séances intenses démarreront avec des réserves basses. Ajoute une portion de féculents au repas qui précède et à celui qui suit chaque grosse séance.' });
  }
  var post = A.SEA.filter(function (x) { var ap = REP[A.JRS[x.d].r[x.apres]] || {}; return x.s.type !== 'recup' && (ap.p || 0) < Math.max(20, .3 * P) * .85; });
  if (post.length) {
    var x = post[0], ap = REP[A.JRS[x.d].r[x.apres]] || { p: 0, nom: 'rien' };
    L.push({ p: 9, t: 'Après ta séance du ' + nomSession(x.k).toLowerCase() + ', ton repas (' + ap.nom.toLowerCase() + ') apporte ' + ap.p + ' g de protéines : vise ' + Math.round(Math.max(25, .3 * P)) + ' à ' + Math.round(Math.max(35, .4 * P)) + ' g pour lancer la récupération.' + (post.length > 1 ? ' C’est le cas pour ' + post.length + ' séances dans ta semaine.' : '') });
  }
  var sansPdj = A.SEA.filter(function (x) { return x.c === 'm' && x.exig && (REP[A.JRS[x.d].r.pdj] || {}).k < 50; });
  if (sansPdj.length) L.push({ p: 8, t: 'Tu t’entraînes le matin sans petit-déjeuner. Pour une séance courte et facile, ça passe ; pour une séance intense, une banane ou un porridge 60 à 90 minutes avant fait une vraie différence.' });
  var pMoy = A.JRS.reduce(function (a, j) { return a + j.pkg; }, 0) / 7;
  if (pMoy < A.protCible[0] - .1) L.push({ p: 7, t: 'Tes protéines tournent autour de ' + pMoy.toFixed(1).replace('.', ',') + ' g/kg par jour, sous les ' + A.protCible[0].toFixed(1).replace('.', ',') + ' recommandés pour ton objectif. Répartis-les sur trois repas plutôt que de tout miser sur le dîner.' });
  var def = A.JRS.filter(function (j) { return j.tot.k < j.besoin * .85; }).length, exc = A.JRS.filter(function (j) { return j.tot.k > j.besoin * 1.15; }).length;
  if (def >= 3) L.push({ p: 6, t: def + ' jours sur 7, tu manges nettement moins que ce que tu dépenses. Sur la durée, c’est la récupération et la progression qui trinquent avant la balance.' });
  if (exc >= 3) L.push({ p: 6, t: exc + ' jours sur 7, tes apports dépassent largement ta dépense. Garde les portions copieuses pour les jours de grosses séances.' });
  var mauvais = REPAS.filter(function (m) { return m.q != null && m.q < 35; }).map(function (m) { return m.id; });
  var nbM = 0; A.JRS.forEach(function (j) { SLOTS.forEach(function (sl) { if (mauvais.indexOf(j.r[sl[0]]) >= 0) nbM++; }); });
  if (nbM >= 3) L.push({ p: 5, t: nbM + ' repas par semaine sont très transformés (fast-food, viennoiseries, plats préparés). Remplacer la moitié d’entre eux suffit à remonter ta note de qualité.' });
  var ingM = S.ingredients.map(function (id) { return INGREDIENTS.filter(function (i) { return i.id === id; })[0]; }).filter(function (x) { return x.n === 'ma'; });
  if (ingM.length) L.push({ p: 4, t: 'Côté ingrédients, ' + ingM.map(function (x) { return x.nom.toLowerCase(); }).join(', ') + ' : ' + ingM[0].pourquoi.charAt(0).toLowerCase() + ingM[0].pourquoi.slice(1) + '. Garde-les pour l’exception.' });
  var sautes = A.JRS.reduce(function (a, j) { return a + j.sautes; }, 0);
  if (sautes >= 3) L.push({ p: 5, t: 'Tu sautes ' + sautes + ' repas par semaine. Chaque repas manqué, c’est une dose de protéines en moins pour reconstruire ce que tes séances ont cassé.' });
  if (A.spec < .4 && comp() && comp().id !== 'aucune') L.push({ p: 3, t: 'Moins de ' + Math.round(A.spec * 100 + 1) + ' % de tes exercices sont spécifiques à ' + disc().nom + '. Pour ' + comp().nom + ', rapprocher tes séances des gestes de l’épreuve est le levier le plus direct.' });
  if (!L.length) L.push({ p: 1, t: 'Ta préparation est cohérente : tes apports suivent ta charge. Le prochain gain viendra de la régularité, semaine après semaine.' });
  L.push({ p: 0, t: 'Avec Made For Me, tes plats sont dosés sur ces besoins : plus de glucides les jours de grosses séances, la bonne dose de protéines après chaque effort.' });
  return L.sort(function (a, b) { return b.p - a.p; }).slice(0, 6).map(function (x) { return x.t; });
}

function brancherResultat(el) {
  var r = el.querySelector('#recommencer');
  if (r) r.addEventListener('click', function () { var p = S.prenom; S = neuf(); S.prenom = p; garder(); aller(0, -1); });
}

/* ─── Démarrage : on reprend où l'on s'était arrêté ───────────── */
var l0 = parcours();
var depart = Math.min(S.pas || 0, l0.length - 1);
if (l0[depart] === 'calcul') depart = Math.max(0, depart - 1);
aller(depart, 1);
})();
