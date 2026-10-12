/* ═══════════════════════════════════════════════════════════════
   Natty — LA liste des composants Wix, lue par build-wix.mjs (qui les
   fabrique) et par verifier-catalogue.mjs (qui vérifie qu'ils sont
   exactement ce que le générateur produit).

   Une seule liste pour les deux : si le générateur apprenait un
   composant que le vérificateur ignore, ce composant pourrait être
   retouché à la main sans que `npm test` le voie.

   Deux sortes de composants :
   · la CARTE, écrite à la main dans wix/natty-carte.src.js, où l'on
     injecte le catalogue ;
   · les PAGES, qui ne s'écrivent pas : build-wix.mjs transforme les
     pages HTML du site (nouveau.html, entreprises.html,
     mentions-legales.html) en composants. Le site HTML est la source,
     Wix n'en est que l'affichage.
   ═══════════════════════════════════════════════════════════════ */

export const CARTE = { balise: 'natty-carte', modele: 'wix/natty-carte.src.js', sortie: 'wix/natty-carte.js' };

export const PAGES = [
  { balise: 'natty-accueil',     page: 'nouveau.html',          sortie: 'wix/natty-accueil.js',     velo: 'wix/velo-accueil.js' },
  { balise: 'natty-entreprises', page: 'entreprises.html',      sortie: 'wix/natty-entreprises.js', velo: 'wix/velo-entreprises.js' },
  { balise: 'natty-mentions',    page: 'mentions-legales.html', sortie: 'wix/natty-mentions.js',    velo: 'wix/velo-mentions.js' },
];

/* Où mènent les liens d'une page à l'autre une fois dans Wix. Chaque
   composant accepte un attribut du même nom pour les changer depuis
   l'éditeur, sans reconstruire. */
export const LIENS = {
  'nouveau.html':          { attribut: 'lien-accueil',     defaut: '/' },
  'entreprises.html':      { attribut: 'lien-entreprises', defaut: '/entreprises' },
  'mentions-legales.html': { attribut: 'lien-mentions',    defaut: '/mentions-legales' },
};

/* Ce que le vérificateur doit copier pour pouvoir tout reconstruire. */
export const SOURCES = ['scripts', 'api', 'wix', 'css', 'package.json', ...PAGES.map(p => p.page)];

/* Tout ce que build-wix.mjs écrit. */
export const SORTIES = [CARTE.sortie, ...PAGES.flatMap(p => [p.sortie, p.velo])];
