/* ═══════════════════════════════════════════════════════════
   Natty — Fiche de préparation détaillée + cinématique « Suivre la recette »
   ───────────────────────────────────────────────────────────
     NattyRecette.fiche(recette)        → le HTML des étapes détaillées
     NattyRecette.monter(el, recette)   → l'injecte et branche le bouton
     NattyRecette.suivre(recette)       → la cinématique plein écran
     NattyRecette.realiser(repas)       → directement l'écran de validation
     NattyRecette.galerie()             → planche de contrôle des animations
     NattyRecette.progres(recette)      → où l'on en était : {i, total} ou null
     NattyRecette.estValidee(recette)   → cuisinée ET photographiée cette semaine
     NattyRecette.validees(semaine)     → la liste, pour les cartes de la semaine
     NattyRecette.identifiant(recette)  → la clé stable d'une recette

   POURQUOI CE MODULE. Les recettes produites par `assets/reco.js` tenaient
   en une ligne par étape (`{em, t, tip}`) : « Faire revenir le poulet ».
   Ni quantité à cette étape, ni durée, ni température — donc inutilisable
   pour cuisiner en tenant son téléphone.

   ── L'IDÉE CENTRALE : UNE ANIMATION PAR ACTION, L'ALIMENT EN SLOT ──
   La bibliothèque n'est pas indexée par ustensile mais par GESTE (couper,
   saisir, enfourner, mijoter…). Chaque animation dessine le geste une fois
   pour toutes et réserve un emplacement où l'on dépose l'aliment de l'étape.
   Conséquence : une recette générée la semaine prochaine, avec d'autres
   ingrédients, réutilise les mêmes animations — il n'y a rien à produire ni
   à dessiner à chaque génération, seulement à piocher la bonne action.

   L'aliment est un emoji, pris de l'ingrédient que l'étape utilise
   (`ingredients[].em`, déjà présent dans les recettes). Pas de dessin
   d'aliment à maintenir, et un aliment inconnu se rend simplement… sans
   aliment : le geste reste lisible.

   L'IA ne renvoie donc jamais de SVG, seulement une CLÉ D'ACTION. Une clé
   inconnue retombe sur `melanger`.

   ⚠️ ÇA DOIT MARCHER SUR L'ANCIEN FORMAT. Les recettes déjà en cache dans
   `profil_conseils.conseils_json` sont à l'ancien schéma, et la génération
   n'a lieu qu'une fois par semaine : attendre lundi pour voir la fonction
   n'était pas acceptable. `normaliser()` déduit donc l'action, la durée, la
   température et l'aliment d'une étape écrite en texte libre. Une recette
   fraîchement générée porte les champs explicitement et la déduction ne sert
   plus — c'est un filet, pas un doublon.

   Le thermostat n'est jamais demandé à l'IA : c'est une division par 30,
   la faire ici garantit qu'elle est juste.

   ── LA MÉMOIRE, ET POURQUOI ELLE EST INDISPENSABLE ──
   Une recette se cuisine en 25 minutes, pendant lesquelles le téléphone se
   verrouille, sonne, ou sert à autre chose. Sans mémoire, revenir voulait dire
   repartir de l'étape 1 et refaire défiler huit écrans pour retrouver le poulet
   déjà au four. `progres()` retient donc l'étape atteinte, par recette, et
   `suivre()` y reprend — le bouton ‹ restant là pour revoir ce qui précède.

   ── LA VALIDATION SE PAIE D'UNE PHOTO ──
   Le dernier écran ne dit plus « Bon appétit » : il demande le plat en photo, et
   RIEN ne valide sans elle. C'est ce qui distingue « j'ai fait défiler les
   étapes » de « j'ai cuisiné » — un compteur qu'on peut avancer sans cuisiner ne
   compte rien. La photo validée déclenche la félicitation, les XP, et coche la
   recette sur les deux cartes de la semaine (`repas.html`, `assets/planning.js`).

   ⚠️ La photo n'est PAS envoyée : elle sert de preuve à soi-même et
   d'illustration à l'écran de félicitation. Le bouton « Noter ce repas » la
   repasse à `assets/ajout.js`, qui lui sait l'analyser et l'enregistrer — sans
   redemander de photographier une assiette déjà photographiée.

   Aucune dépendance : ni core.js, ni réseau, ni image. Le CSS est injecté
   une fois, tout préfixé `nr-` et scellé sous `#nrCine` pour la cinématique
   — même discipline que le moteur `k_` de narration.html, dont ce module
   reprend le vocabulaire d'animation (entrées sobres, easing spring-like,
   JAMAIS de flou sur du texte, et bouton d'action dans une barre fixe et non
   dans le plan animé, sinon l'animation de sortie l'emporte avant le clic).
   ═══════════════════════════════════════════════════════════ */

window.NattyRecette = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── 1. Températures et durées ────────────────────────────
     Une recette s'écrit en degrés, un four français se règle en thermostat.
     Personne ne fait la division devant le four : on affiche les deux,
     toujours ensemble. th = °C / 30 (th 6 = 180 °C). */

  function thermostat(c) {
    return Math.min(10, Math.max(1, Math.round(c / 30)));
  }

  /* Un four n'a pas de cran entre deux thermostats : 180 °C, c'est th. 6, mais
     200 °C tombe entre th. 6 et th. 7 — et c'est ainsi que les livres de
     cuisine l'écrivent. Arrondir au plus proche donnerait « th. 7 », soit
     210 °C, dix degrés de trop sur une cuisson de poisson. */
  function libThermostat(c) {
    var t = c / 30;
    if (Math.abs(t - Math.round(t)) < 0.08) return 'th. ' + thermostat(c);
    var bas = Math.min(9, Math.max(1, Math.floor(t)));
    return 'th. ' + bas + '-' + (bas + 1);
  }

  function libTemp(c) {
    if (!c) return '';
    return c + ' °C · ' + libThermostat(c);
  }

  function libDuree(s) {
    if (!s) return '';
    if (s < 60) return s + ' s';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r : '');
  }

  var FEUX = { doux: 'feu doux', moyen: 'feu moyen', vif: 'feu vif' };

  /* Emojis d'ustensile : ils ne sont PAS des aliments. Une étape dont le seul
     emoji est 🔪 ou 🔥 doit laisser la scène sans aliment — la poêle vide se
     lit très bien, un couteau posé dans la poêle ne veut rien dire. */
  var USTENSILES = ['⏱', '⏱️', '⏲', '⏲️', '🔪', '🍳', '🥘', '🥣', '⚖', '⚖️',
    '❄', '❄️', '🌀', '🧂', '🚰', '🍽', '🍽️', '🔥', '💧', '🥄', '👉', '✨'];

  /* ── 2. Bibliothèque d'animations, indexée par ACTION ─────
     Chaque entrée : { em, libelle, slot, dessin(slotHtml) }.
     `slot` décrit où et comment l'aliment se pose dans la scène (position,
     taille, animation) — c'est ce qui rend une même animation réutilisable
     pour n'importe quel ingrédient.

     Le trait est le même partout (currentColor, 2.4) : les 16 gestes doivent
     former une famille, sinon la cinématique ressemble à un patchwork. */

  var TETE = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4"'
    + ' stroke-linecap="round" stroke-linejoin="round">';

  /* L'aliment : un simple <text>.
     Deux attributs qui ne sont PAS décoratifs :
     - `stroke="none"` — le <svg> parent impose un stroke, qui viendrait
       border le glyphe ;
     - `fill="currentColor"` — le parent impose aussi `fill="none"`, et un
       glyphe sans remplissage est purement invisible. C'est exactement ce qui
       s'est passé au premier essai : tous les ustensiles s'affichaient, aucun
       aliment. Les emojis en couleur ignorent `fill`, mais le repli
       monochrome, lui, s'en sert. */
  function aliment(em, x, y, taille, anim) {
    if (!em) return '';
    return '<text class="nr-food' + (anim ? ' ' + anim : '') + '" x="' + x + '" y="' + y + '"'
      + ' font-size="' + taille + '" text-anchor="middle" dominant-baseline="central"'
      + ' stroke="none" fill="currentColor"'
      + ' style="transform-origin:' + x + 'px ' + y + 'px">' + esc(em) + '</text>';
  }

  var ACTIONS = {
    couper: {
      libelle: 'Couper', em: '🔪',
      dessin: function (em) {
        // La rotation part de la POINTE de la lame (transform-origin de
        // .nr-chop) : c'est le geste réel du couteau de chef, qui bascule sur
        // sa pointe. Faire pivoter depuis le manche donnerait un hachoir.
        return TETE
          + '<path d="M8 52h48"/>'
          + aliment(em, 30, 45, 16, 'nr-f-squash')
          + '<g class="nr-chop"><path d="M12 38 40 16l4 5L16 43Z"/>'
          + '<path d="M45 20l7-5" stroke-width="4.5"/></g>'
          + '</svg>';
      }
    },
    saisir: {
      libelle: 'Saisir à la poêle', em: '🍳',
      dessin: function (em) {
        return TETE
          + '<path d="M8 34h34a12 12 0 0 1-12 12H20A12 12 0 0 1 8 34Z"/><path d="M42 34h14"/>'
          + aliment(em, 25, 38, 15, 'nr-f-jump')
          + '<g class="nr-steam"><path d="M16 24c3-4-3-6 0-10"/><path d="M25 22c3-5-3-7 0-12"/>'
          + '<path d="M34 24c3-4-3-6 0-10"/></g></svg>';
      }
    },
    bouillir: {
      libelle: 'Cuire à l\'eau', em: '💧',
      dessin: function (em) {
        return TETE
          + '<path d="M12 30h40v10a12 12 0 0 1-12 12H24A12 12 0 0 1 12 40Z"/><path d="M8 30h48"/>'
          + aliment(em, 32, 41, 15, 'nr-f-bob')
          + '<g class="nr-bub"><circle cx="22" cy="24" r="2.6"/><circle cx="32" cy="18" r="2"/>'
          + '<circle cx="43" cy="24" r="2.6"/></g></svg>';
      }
    },
    mijoter: {
      libelle: 'Mijoter à feu doux', em: '🥘',
      dessin: function (em) {
        return TETE
          + '<path d="M14 26h36v12a12 12 0 0 1-12 12H26A12 12 0 0 1 14 38Z"/><path d="M12 26h40"/>'
          + '<path d="M32 26v-6"/>'
          + aliment(em, 32, 38, 15, 'nr-f-bob')
          + '<g class="nr-pulse"><path d="M24 58c0-3 2-4 2-6"/><path d="M32 58c0-3 2-4 2-6"/>'
          + '<path d="M40 58c0-3 2-4 2-6"/></g></svg>';
      }
    },
    enfourner: {
      libelle: 'Enfourner', em: '🔥',
      dessin: function (em) {
        return TETE
          + '<rect x="10" y="10" width="44" height="44" rx="7"/><path d="M10 24h44"/>'
          + '<circle cx="18" cy="17" r="1.7"/>'
          + aliment(em, 32, 38, 17, 'nr-f-warm')
          + '<g class="nr-wave"><path d="M18 47c4-3 7 3 11 0s7-3 7-3"/></g></svg>';
      }
    },
    melanger: {
      libelle: 'Mélanger', em: '🥣',
      dessin: function (em) {
        return TETE
          + '<path d="M10 30h44a22 22 0 0 1-22 22A22 22 0 0 1 10 30Z"/>'
          + aliment(em, 30, 40, 15, 'nr-f-stirred')
          + '<g class="nr-stir"><path d="M42 12 32 34"/><ellipse cx="43" cy="11" rx="5" ry="3.4"/></g>'
          + '</svg>';
      }
    },
    fouetter: {
      libelle: 'Fouetter', em: '🥚',
      dessin: function (em) {
        return TETE
          + '<path d="M10 34h44a22 22 0 0 1-22 20A22 22 0 0 1 10 34Z"/>'
          + aliment(em, 30, 43, 14, 'nr-f-stirred')
          + '<g class="nr-stir"><path d="M32 6v16"/><path d="M32 22c-6 4-8 9-6 14"/>'
          + '<path d="M32 22c6 4 8 9 6 14"/><path d="M32 22v14"/></g></svg>';
      }
    },
    mixer: {
      libelle: 'Mixer', em: '🌀',
      dessin: function (em) {
        return TETE
          + '<path d="M18 8h28l-4 34H22Z"/><rect x="20" y="46" width="24" height="10" rx="4"/>'
          + aliment(em, 32, 22, 14, 'nr-f-spinfood')
          + '<g class="nr-spin" style="transform-origin:32px 34px"><path d="M25 34h14"/>'
          + '<path d="M28 29l8 10"/></g></svg>';
      }
    },
    assaisonner: {
      libelle: 'Assaisonner', em: '🧂',
      dessin: function (em) {
        return TETE
          + '<g transform="rotate(-20 40 20)"><path d="M34 12h12l3 18a3 3 0 0 1-3 3H34a3 3 0 0 1-3-3Z"/>'
          + '<path d="M35 12c0-4 2-6 5-6s5 2 5 6"/></g>'
          + '<g class="nr-fall"><circle cx="34" cy="34" r="1.5"/><circle cx="30" cy="39" r="1.5"/>'
          + '<circle cx="33" cy="44" r="1.5"/></g>'
          + '<path d="M10 54h34a0 0 0 0 1 0 0"/>'
          + aliment(em, 26, 49, 15, 'nr-f-bob')
          + '</svg>';
      }
    },
    huiler: {
      libelle: 'Huiler / beurrer', em: '🫒',
      dessin: function (em) {
        return TETE
          + '<path d="M14 8h10v7l5 7v20a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4V22l5-7Z"/><path d="M9 30h20"/>'
          + '<g class="nr-drip"><path d="M36 26c0 0-3 4-3 6a3 3 0 0 0 6 0c0-2-3-6-3-6Z"/></g>'
          + aliment(em, 42, 44, 15, 'nr-f-bob')
          + '</svg>';
      }
    },
    rincer: {
      libelle: 'Rincer / égoutter', em: '🚰',
      dessin: function (em) {
        return TETE
          + '<path d="M6 10v12"/><path d="M6 16h16a4 4 0 0 1 4 4v4"/>'
          + '<g class="nr-fall"><path d="M26 26v4"/><path d="M26 33v4"/><path d="M26 40v4"/></g>'
          + aliment(em, 34, 46, 16, 'nr-f-bob')
          + '<path d="M12 56h40"/></svg>';
      }
    },
    peser: {
      libelle: 'Peser', em: '⚖️',
      dessin: function (em) {
        return TETE
          + '<rect x="8" y="36" width="48" height="18" rx="6"/><path d="M20 36V26h24v10"/>'
          + '<g class="nr-wiggle" style="transform-origin:32px 50px"><path d="M32 50v-8"/></g>'
          + aliment(em, 32, 18, 16, 'nr-f-drop')
          + '</svg>';
      }
    },
    refrigerer: {
      libelle: 'Réserver au frais', em: '❄️',
      dessin: function (em) {
        return TETE
          + '<rect x="14" y="6" width="36" height="52" rx="6"/><path d="M14 26h36"/><path d="M20 16v6"/>'
          + aliment(em, 32, 40, 15, 'nr-f-bob')
          + '<g class="nr-pulse"><path d="M44 32v8"/><path d="M40 36h8"/><path d="M41.2 33.2 46.8 38.8"/>'
          + '<path d="M46.8 33.2 41.2 38.8"/></g></svg>';
      }
    },
    reposer: {
      libelle: 'Laisser reposer', em: '😴',
      dessin: function (em) {
        return TETE
          + '<path d="M10 40h44a10 10 0 0 1-10 10H20A10 10 0 0 1 10 40Z"/><path d="M8 40h48"/>'
          + aliment(em, 32, 45, 15, 'nr-f-breathe')
          + '<g class="nr-zzz"><path d="M24 28h8l-8 8h8"/><path d="M38 14h7l-7 7h7"/></g></svg>';
      }
    },
    attendre: {
      libelle: 'Minuter', em: '⏱️',
      dessin: function (em) {
        return TETE
          + '<circle cx="32" cy="36" r="21"/><path d="M25 8h14"/><path d="M32 15v-7"/>'
          + '<g class="nr-spin" style="transform-origin:32px 36px"><path d="M32 36V22"/></g>'
          + '<circle cx="32" cy="36" r="2.2" fill="currentColor" stroke="none"/>'
          + aliment(em, 50, 54, 14, 'nr-f-bob')
          + '</svg>';
      }
    },
    dresser: {
      libelle: 'Dresser', em: '🍽️',
      dessin: function (em) {
        return TETE
          + '<circle cx="32" cy="34" r="22"/><circle cx="32" cy="34" r="13"/>'
          + aliment(em, 32, 34, 18, 'nr-f-drop')
          + '<g class="nr-twinkle"><path d="M53 11v7"/><path d="M49.5 14.5h7"/><path d="M10 20v6"/>'
          + '<path d="M7 23h6"/></g></svg>';
      }
    }
  };

  /* Anciennes clés (nommées d'après l'ustensile) et synonymes que l'IA peut
     écrire malgré la consigne. Un alias coûte une ligne ; une illustration
     absente coûte une étape muette. */
  var ALIAS = {
    couteau: 'couper', decouper: 'couper', hacher: 'couper', emincer: 'couper',
    poele: 'saisir', revenir: 'saisir', dorer: 'saisir', griller: 'saisir', cuire: 'saisir',
    casserole: 'bouillir', bouilir: 'bouillir', pocher: 'bouillir', blanchir: 'bouillir',
    four: 'enfourner', rotir: 'enfourner', gratiner: 'enfourner', prechauffer: 'enfourner',
    bol: 'melanger', remuer: 'melanger', incorporer: 'melanger',
    fouet: 'fouetter', battre: 'fouetter', monter: 'fouetter',
    mixeur: 'mixer', ecraser: 'mixer', blender: 'mixer',
    sel: 'assaisonner', epicer: 'assaisonner', saler: 'assaisonner', poivrer: 'assaisonner',
    huile: 'huiler', beurrer: 'huiler', graisser: 'huiler',
    eau: 'rincer', laver: 'rincer', egoutter: 'rincer',
    balance: 'peser', doser: 'peser', mesurer: 'peser',
    frigo: 'refrigerer', frais: 'refrigerer', mariner: 'refrigerer', refroidir: 'refrigerer',
    repos: 'reposer', lever: 'reposer',
    minuteur: 'attendre', patienter: 'attendre',
    dressage: 'dresser', servir: 'dresser', decorer: 'dresser',
    feudoux: 'mijoter', couvert: 'mijoter', compoter: 'mijoter'
  };

  function actionValide(cle) {
    if (!cle) return '';
    var k = String(cle).toLowerCase().trim();
    if (ACTIONS[k]) return k;
    if (ALIAS[k]) return ALIAS[k];
    return '';
  }

  function dessin(cle, em) {
    var a = ACTIONS[actionValide(cle) || 'melanger'];
    return a.dessin(em || '');
  }

  /* ── 3. Déduction, pour l'ancien format ───────────────────
     Le premier motif reconnu gagne : l'ordre compte, « four » doit passer
     avant « cuire », sinon un gratin finit en casserole. */

  var MOTIFS = [
    ['enfourner',   /(four|enfourn|gratin|rôti|rotir|rôtir|préchauff|prechauff)/i],
    ['couper',      /(découp|decoup|émin|emin|tranch|hach|coupe|taille|ciseau|en dés|en cubes|en lamelles)/i],
    ['saisir',      /(poêle|poele|revenir|saisir|dor(?:e|er|ez)|snack|sauter|griller|plancha|wok|colorer)/i],
    ['mijoter',     /(mijot|à couvert|couvercle|compot|confire|feu doux pendant|cocotte)/i],
    ['bouillir',    /(bouill|ébullition|ebullition|frémi|fremi|blanchir|pocher|eau salée|cuire.*eau|al dente)/i],
    ['huiler',      /(huile|beurre|filet d|matière grasse|graisse)/i],
    ['mixer',       /(mix|blend|mouline|écras|ecras|purée|puree|robot)/i],
    ['fouetter',    /(fouett|en neige|émulsion|emulsion|batt(?:re|ez))/i],
    ['assaisonner', /(assaisonn|sale[rz]?\b|poivr|épice|epice|\bsel\b|cumin|paprika|herbes|citronn)/i],
    ['refrigerer',  /(frigo|réfrigér|refriger|au frais|mariner|marinade)/i],
    ['peser',       /(pes(?:e|er|ez)|balance|dose|mesure)/i],
    ['rincer',      /(rinc|lav(?:e|er|ez)|égoutt|egoutt|tremp)/i],
    ['dresser',     /(dress|serv(?:ir|ez)|assiette|parsem|parsèm|décor|decor|présent)/i],
    ['reposer',     /(repos|laisse.*(?:refroidir|tiédir)|lève|leve)/i],
    ['attendre',    /(minut|chrono|pendant \d)/i]
  ];

  function actionPour(txt) {
    for (var i = 0; i < MOTIFS.length; i++) {
      if (MOTIFS[i][1].test(txt)) return MOTIFS[i][0];
    }
    return 'melanger';
  }

  // « 8 min », « 1 h 30 », « 45 secondes ». La plus GRANDE durée trouvée
  // l'emporte : « remue 30 s puis laisse 20 min » doit armer 20 min.
  function dureePour(txt) {
    var best = 0, m, re = /(\d+(?:[.,]\d+)?)\s*(h(?:eures?)?|min(?:utes?)?|s(?:econdes?)?)\b/gi;
    while ((m = re.exec(txt))) {
      var n = parseFloat(m[1].replace(',', '.')), u = m[2].toLowerCase()[0];
      var s = u === 'h' ? n * 3600 : u === 'm' ? n * 60 : n;
      if (s > best) best = s;
    }
    return Math.round(best);
  }

  // « 180 °C », « 180° », « thermostat 6 » (× 30 pour revenir aux degrés).
  function tempPour(txt) {
    var m = txt.match(/(\d{2,3})\s*°\s*c?/i);
    if (m) return parseInt(m[1], 10);
    m = txt.match(/(?:thermostat|th\.?)\s*(\d{1,2})\b/i);
    if (m) return parseInt(m[1], 10) * 30;
    return 0;
  }

  function feuPour(txt) {
    if (/feu\s+(?:très\s+)?doux/i.test(txt)) return 'doux';
    if (/feu\s+(?:vif|fort)|bien chaud/i.test(txt)) return 'vif';
    if (/feu\s+moyen/i.test(txt)) return 'moyen';
    return '';
  }

  /* Quel ingrédient cette étape utilise-t-elle ? Comparaison MOT À MOT,
     jamais en sous-chaîne — même piège que `assets/garde-manger.js` :
     « ail » se trouve dans « volaille ». */

  function sansAccent(s) {
    var t = String(s || '').toLowerCase();
    try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return t;
  }

  function mots(s) {
    return sansAccent(s).split(/[^a-z0-9]+/)
      .filter(function (w) { return w.length > 2; })
      .map(function (w) { return w.replace(/s$/, ''); });
  }

  function mentionne(texte, nom) {
    var t = mots(texte), n = mots(nom);
    if (!n.length) return false;
    return n.every(function (w) { return t.indexOf(w) >= 0; });
  }

  /**
   * Étapes exploitables, quel que soit le format d'entrée.
   * @param {Object} r recette (ancien ou nouveau schéma)
   * @returns {Array} [{n, action, aliment, titre, detail, qte, duree_s, temp_c, feu, tip}]
   */
  function normaliser(r) {
    var brutes = (r && (r.steps || r.etapes)) || [];
    var ingrs = (r && r.ingredients) || [];

    var dernierAliment = '';   // voir l'héritage plus bas

    return brutes.map(function (s, i) {
      if (typeof s === 'string') s = { t: s };   // étape en texte brut
      var titre = (s.t || s.titre || '').trim();
      var detail = (s.detail || s.d || '').trim();
      var tip = (s.tip || s.astuce || '').trim();
      var texte = titre + ' ' + detail + ' ' + tip;

      var duree = s.duree_s ? +s.duree_s
        : (s.duree_min ? Math.round(s.duree_min * 60) : dureePour(texte));
      var temp = s.temp_c ? +s.temp_c
        : (s.thermostat ? +s.thermostat * 30 : tempPour(texte));
      var feu = String(s.feu || feuPour(texte) || '').toLowerCase();

      // Quantités de l'étape : celles fournies, sinon les ingrédients de la
      // recette effectivement cités dans le texte.
      var qte = [];
      var fournies = s.qte || s.quantites || s.ingredients;
      if (fournies && fournies.length) {
        qte = fournies.map(function (q) {
          if (typeof q === 'string') return { nom: q, qte: '', em: '' };
          return { nom: q.nom || q.name || '', qte: q.qte || q.quantite || '', em: q.em || '' };
        }).filter(function (q) { return q.nom; });
        // L'emoji n'est pas toujours répété dans l'étape : on va le chercher
        // dans la liste d'ingrédients de la recette.
        qte.forEach(function (q) {
          if (q.em) return;
          for (var k = 0; k < ingrs.length; k++) {
            if (ingrs[k] && ingrs[k].nom && mentionne(q.nom, ingrs[k].nom)) { q.em = ingrs[k].em || ''; return; }
          }
        });
      } else {
        ingrs.forEach(function (ing) {
          if (ing && ing.nom && mentionne(texte, ing.nom)) {
            qte.push({ nom: ing.nom, qte: ing.qte || '', em: ing.em || '' });
          }
        });
      }

      var action = actionValide(s.illu || s.action) || actionPour(texte);

      /* L'aliment posé dans l'animation : l'emoji de l'ingrédient de
         l'étape. À défaut, celui qui symbolise l'action (une poêle vide vaut
         mieux qu'un aliment inventé au hasard) — sauf pour `couper`, où un
         couteau sur une planche vide se lit très bien seul. */
      var em = '';
      for (var j = 0; j < qte.length && !em; j++) em = qte[j].em || '';
      if (!em) em = s.em || '';
      // Comparaison EXACTE, jamais une classe de caractères : un emoji hors
      // BMP (🍗, 🍚, 🍳…) s'écrit sur deux unités UTF-16, et une classe
      // `[🍳🍽️…]` contient donc des demi-surrogates isolés — U+D83C y traîne
      // seul et fait correspondre TOUS les emojis de la même plage. Bug
      // constaté : plus aucun aliment ne s'affichait dans la fiche.
      if (em && USTENSILES.indexOf(em) >= 0) em = '';

      /* Héritage : « Enfourne 18 min » ne nomme aucun ingrédient, mais c'est
         évidemment ce qu'on vient de préparer qui part au four. Sans cet
         héritage, une étape sur deux montrait un four vide. La première étape
         n'hérite de rien — un four qui préchauffe EST vide. */
      if (!em) em = dernierAliment;
      /* Ce dont on hérite, c'est le PLAT en cours, pas le dernier condiment
         croisé. Huiler et assaisonner affichent leur propre ingrédient (l'huile,
         le sel) mais ne deviennent jamais l'aliment de référence : sinon
         « arrose d'huile » puis « enfourne 18 min » mettait une olive au four
         à la place du poulet. Vérifié sur la recette de test. */
      else if (action !== 'huiler' && action !== 'assaisonner') dernierAliment = em;

      // Un titre trop long se lit mal en cinématique : on coupe à la première
      // phrase, le reste devient le détail — plutôt que de tronquer.
      if (!detail && titre.length > 64) {
        var p = titre.search(/[.;:]\s/);
        if (p > 18) { detail = titre.slice(p + 1).trim(); titre = titre.slice(0, p + 1).trim(); }
      }

      return {
        n: i + 1,
        action: action,
        aliment: em,
        titre: titre || ('Étape ' + (i + 1)),
        detail: detail,
        qte: qte,
        duree_s: duree,
        temp_c: temp,
        feu: FEUX[feu] ? feu : '',
        tip: tip
      };
    });
  }

  function dureeTotale(etapes) {
    return etapes.reduce(function (s, e) { return s + (e.duree_s || 0); }, 0);
  }

  /* ── 4. CSS, injecté une fois ─────────────────────────────
     Dans le module et pas dans style.css : les écrans qui s'en servent n'ont
     qu'un <script> à ajouter, et la cinématique reste scellée sous #nrCine
     (une règle qui fuit casse la mise en page de l'hôte). */

  var CSS_POSE = false;
  function poserCss() {
    if (CSS_POSE) return;
    CSS_POSE = true;
    var st = document.createElement('style');
    st.id = 'nrCss';
    st.textContent = [
      /* fiche */
      '.nr-prep{background:var(--card,#ececef);border-radius:var(--r-lg,24px);padding:16px 15px;margin:14px 0}',
      '.nr-prep-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}',
      '.nr-prep-t{font-size:14px;font-weight:800;color:var(--ink,#101014)}',
      '.nr-prep-t span{font-weight:600;color:var(--muted,#9d9da8)}',
      '.nr-go{border:0;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:800;color:var(--on-ink,#fff);',
      'background:var(--ink,#101014);border-radius:var(--r-full,999px);padding:9px 15px;flex-shrink:0}',
      '.nr-steps{display:flex;flex-direction:column;gap:10px}',
      '.nr-step{display:flex;gap:11px;background:var(--bg,#fff);border-radius:var(--r-md,18px);padding:12px 13px}',
      '.nr-step-n{width:22px;height:22px;border-radius:50%;background:var(--ink,#101014);color:var(--on-ink,#fff);',
      'font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.nr-illu{width:40px;height:40px;flex-shrink:0;color:var(--ink,#101014)}',
      '.nr-illu svg{width:100%;height:100%;display:block;overflow:visible}',
      '.nr-step-c{flex:1;min-width:0}',
      '.nr-step-t{font-size:13.5px;font-weight:800;line-height:1.35;color:var(--ink,#101014)}',
      '.nr-step-d{font-size:12.5px;line-height:1.55;color:var(--ink,#5c5c68);opacity:.78;margin-top:3px}',
      '.nr-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}',
      '.nr-chip{font-size:10.5px;font-weight:800;letter-spacing:.2px;padding:4px 8px;',
      'border-radius:var(--r-full,999px);background:var(--card,#f1f1f4);color:var(--ink,#3a3a45);white-space:nowrap}',
      '.nr-chip.q{background:#eaf7ee;color:#1e5c30}',
      ':root[data-theme="dark"] .nr-chip.q{background:#173b23;color:#8ee0a5}',
      '.nr-chip.hot{background:#fdeee6;color:#8a3d12}',
      ':root[data-theme="dark"] .nr-chip.hot{background:#40230f;color:#f6b487}',
      '.nr-tip{font-size:11.5px;line-height:1.5;color:var(--muted,#7a7a86);margin-top:6px;font-style:italic}',

      /* cinématique */
      '#nrCine{position:fixed;inset:0;z-index:12000;background:var(--bg,#fff);display:none;',
      'flex-direction:column;font-family:inherit;color:var(--ink,#101014)}',
      '#nrCine.on{display:flex}',
      '#nrCine .nr-c-top{display:flex;align-items:center;gap:12px;',
      'padding:calc(env(safe-area-inset-top,0px) + 14px) 18px 10px}',
      '#nrCine .nr-x{width:34px;height:34px;flex-shrink:0;border:0;cursor:pointer;background:var(--card,#ececef);',
      'border-radius:50%;font-size:15px;color:var(--ink,#101014);font-family:inherit}',
      '#nrCine .nr-c-bar{flex:1;height:5px;border-radius:99px;background:var(--card,#ececef);overflow:hidden}',
      '#nrCine .nr-c-bar i{display:block;height:100%;background:var(--ink,#101014);border-radius:99px;',
      'transition:width .5s cubic-bezier(.22,1,.36,1)}',
      '#nrCine .nr-c-num{font-size:11.5px;font-weight:800;color:var(--muted,#9d9da8);flex-shrink:0}',
      '#nrCine .nr-c-stage{flex:1;position:relative;overflow:hidden}',
      '#nrCine .nr-plan{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;',
      'justify-content:center;gap:13px;padding:8px 26px 12px;text-align:center;overflow-y:auto;',
      '-webkit-overflow-scrolling:touch}',
      '#nrCine .nr-big{width:132px;height:132px;color:var(--ink,#101014);flex-shrink:0}',
      '#nrCine .nr-big svg{width:100%;height:100%;display:block;overflow:visible}',
      '#nrCine .nr-t{font-size:25px;font-weight:800;line-height:1.2;letter-spacing:-.5px;max-width:14em}',
      '#nrCine .nr-d{font-size:15px;line-height:1.6;color:var(--ink,#54545f);opacity:.8;max-width:22em}',
      '#nrCine .nr-tip2{font-size:13px;line-height:1.55;color:var(--muted,#7a7a86);font-style:italic;max-width:22em}',
      '#nrCine .nr-chips{justify-content:center}',
      '#nrCine .nr-chip{font-size:12px;padding:6px 11px}',
      '#nrCine .nr-c-cta{display:flex;align-items:center;gap:10px;',
      'padding:10px 18px calc(env(safe-area-inset-bottom,0px) + 16px)}',
      '#nrCine .nr-prev{width:46px;height:46px;flex-shrink:0;border:0;cursor:pointer;',
      'background:var(--card,#ececef);border-radius:var(--r-full,999px);font-size:20px;',
      'color:var(--ink,#101014);font-family:inherit}',
      '#nrCine .nr-next{flex:1;border:0;cursor:pointer;background:var(--ink,#101014);color:var(--on-ink,#fff);',
      'border-radius:var(--r-full,999px);padding:15px;font-size:15px;font-weight:800;font-family:inherit}',
      '#nrCine .nr-timer{display:flex;align-items:center;gap:12px;background:var(--card,#ececef);',
      'border-radius:var(--r-full,999px);padding:8px 8px 8px 15px}',
      '#nrCine .nr-tval{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;min-width:3.4em;text-align:left}',
      '#nrCine .nr-tbtn{border:0;cursor:pointer;background:var(--ink,#101014);color:var(--on-ink,#fff);',
      'border-radius:var(--r-full,999px);padding:9px 15px;font-size:12.5px;font-weight:800;font-family:inherit}',
      '#nrCine .nr-timer.fini{background:#e6f7ea}',
      ':root[data-theme="dark"] #nrCine .nr-timer.fini{background:#16351f}',
      '#nrCine .nr-timer.fini .nr-tval{color:#1e7a3a}',
      ':root[data-theme="dark"] #nrCine .nr-timer.fini .nr-tval{color:#7fe09b}',

      /* Reprise. Sans ce mot, ouvrir une recette à l'étape 4 ressemble à un
         bug : on croit avoir raté le début. */
      '#nrCine .nr-repr{font-size:11.5px;font-weight:800;letter-spacing:.2px;padding:6px 13px;',
      'border-radius:var(--r-full,999px);background:var(--card,#ececef);color:var(--muted,#7a7a86)}',

      /* Photo du plat fini. Carrée et rognée : un cliché de téléphone est en
         portrait, le laisser entier dans un écran qui porte aussi un titre, des
         XP et deux boutons ne laisserait rien voir du plat. */
      '#nrCine .nr-shot{width:196px;height:196px;object-fit:cover;border-radius:30px;flex-shrink:0;',
      'box-shadow:0 16px 34px rgba(16,16,18,.24);display:block}',
      '#nrCine .nr-shotw{position:relative;flex-shrink:0}',
      '#nrCine .nr-shotw .nr-badge{position:absolute;right:-6px;bottom:-6px;width:46px;height:46px;',
      'border-radius:50%;background:#34c759;color:#fff;display:flex;align-items:center;',
      'justify-content:center;box-shadow:0 8px 18px rgba(52,199,89,.42);',
      'animation:nrPop .5s cubic-bezier(.22,1,.36,1) .25s both}',
      '@keyframes nrPop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}',
      '#nrCine .nr-badge svg{width:24px;height:24px;stroke:#fff;stroke-width:3.4;fill:none;',
      'stroke-linecap:round;stroke-linejoin:round}',
      /* Deux tracés décalés, jamais un seul continu : un trait unique ne se lit
         pas comme une validation (même recette que `.vok` d'assets/planning.js). */
      '#nrCine .nr-badge path{stroke-dasharray:22;stroke-dashoffset:22;',
      'animation:nrTrace .42s cubic-bezier(.22,1,.36,1) .5s forwards}',
      '@keyframes nrTrace{to{stroke-dashoffset:0}}',

      /* Bouton secondaire d'un plan (galerie, reprendre la photo, noter le
         repas). Discret : le geste principal vit dans la barre du bas. */
      '#nrCine .nr-alt{border:0;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:800;',
      'background:var(--card,#ececef);color:var(--ink,#101014);border-radius:var(--r-full,999px);',
      'padding:10px 17px}',

      '#nrCine .nr-xp{font-size:42px;font-weight:900;letter-spacing:-1.4px;color:#34c759;',
      'font-variant-numeric:tabular-nums;line-height:1}',
      '#nrCine .nr-tot{font-size:12.5px;font-weight:700;color:var(--muted,#7a7a86)}',

      /* Entrées de plan — sobres, spring-like, et AUCUN flou sur du texte
         (décision de narration.html, juillet 2026 : le flou n'était pas
         assez « clean »). */
      '#nrCine .nr-plan{animation-duration:.62s;animation-timing-function:cubic-bezier(.22,1,.36,1);',
      'animation-fill-mode:both}',
      '#nrCine .nr-plan[data-e="glide"]{animation-name:nrGlide}',
      '#nrCine .nr-plan[data-e="parallax"]{animation-name:nrParallax}',
      '#nrCine .nr-plan[data-e="reveal"]{animation-name:nrReveal}',
      '@keyframes nrGlide{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}',
      '@keyframes nrParallax{from{opacity:0;transform:translateY(10px) scale(.972)}to{opacity:1;transform:none}}',
      '@keyframes nrReveal{from{opacity:0;clip-path:inset(0 0 100% 0)}to{opacity:1;clip-path:inset(0 0 0 0)}}',
      '#nrCine .nr-plan.out{animation-name:nrOut;animation-duration:.34s}',
      '@keyframes nrOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-10px) scale(.99)}}',

      /* Gestes. Lents et discrets : le dessin signale l'action, il ne doit
         pas capter l'œil pendant qu'on lit la consigne. */
      '.nr-chop{animation:nrChop 1.9s cubic-bezier(.4,0,.3,1) infinite;transform-origin:14px 40px}',
      '@keyframes nrChop{0%,58%,100%{transform:rotate(0)}30%{transform:rotate(-27deg)}}',
      '.nr-steam path{animation:nrSteam 2.4s ease-in-out infinite}',
      '.nr-steam path:nth-child(2){animation-delay:.5s}.nr-steam path:nth-child(3){animation-delay:1s}',
      '@keyframes nrSteam{0%{opacity:0;transform:translateY(6px)}35%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}',
      '.nr-bub circle{animation:nrBub 2.1s ease-in-out infinite}',
      '.nr-bub circle:nth-child(2){animation-delay:.6s}.nr-bub circle:nth-child(3){animation-delay:1.2s}',
      '@keyframes nrBub{0%{opacity:0;transform:translateY(8px) scale(.5)}40%{opacity:1}100%{opacity:0;transform:translateY(-10px) scale(1)}}',
      '.nr-wave path{animation:nrWave 2.6s ease-in-out infinite}',
      '@keyframes nrWave{0%,100%{opacity:.2}50%{opacity:1}}',
      '.nr-stir{animation:nrStir 2.6s ease-in-out infinite;transform-origin:32px 34px}',
      '@keyframes nrStir{0%,100%{transform:rotate(-13deg)}50%{transform:rotate(13deg)}}',
      '.nr-spin{animation:nrSpin 3.2s linear infinite}',
      '@keyframes nrSpin{to{transform:rotate(360deg)}}',
      '.nr-pulse{animation:nrPulse 2.2s ease-in-out infinite}',
      '@keyframes nrPulse{0%,100%{opacity:.45}50%{opacity:1}}',
      '.nr-wiggle{animation:nrWig 2.4s ease-in-out infinite}',
      '@keyframes nrWig{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}',
      '.nr-fall circle,.nr-fall path{animation:nrFall 1.9s ease-in infinite}',
      '.nr-fall :nth-child(2){animation-delay:.45s}.nr-fall :nth-child(3){animation-delay:.9s}',
      '@keyframes nrFall{0%{opacity:0;transform:translateY(-6px)}30%{opacity:1}100%{opacity:0;transform:translateY(12px)}}',
      '.nr-drip{animation:nrDrip 2.2s ease-in infinite}',
      '@keyframes nrDrip{0%{opacity:0;transform:translateY(-4px)}25%{opacity:1}100%{opacity:0;transform:translateY(18px)}}',
      '.nr-twinkle path{animation:nrTwk 2.2s ease-in-out infinite}',
      '.nr-twinkle path:nth-child(3),.nr-twinkle path:nth-child(4){animation-delay:.9s}',
      '@keyframes nrTwk{0%,100%{opacity:.2}50%{opacity:1}}',
      '.nr-zzz path{animation:nrZzz 2.8s ease-in-out infinite}',
      '.nr-zzz path:nth-child(2){animation-delay:.8s}',
      '@keyframes nrZzz{0%{opacity:0;transform:translateY(6px)}40%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}',

      /* L'aliment déposé dans la scène. Une animation par façon d'être
         travaillé — c'est ce qui fait que la même scène « couper » raconte
         quelque chose avec un poulet comme avec une courgette. */
      '.nr-food{animation-duration:2.2s;animation-iteration-count:infinite;animation-timing-function:ease-in-out}',
      '.nr-f-squash{animation-name:nrFSquash;animation-duration:1.9s;',
      'animation-timing-function:cubic-bezier(.4,0,.3,1)}',
      '@keyframes nrFSquash{0%,58%,100%{transform:scale(1,1)}34%{transform:scale(1.12,.86)}}',
      '.nr-f-jump{animation-name:nrFJump;animation-duration:1.5s}',
      '@keyframes nrFJump{0%,100%{transform:translateY(0) rotate(0)}45%{transform:translateY(-5px) rotate(-9deg)}}',
      '.nr-f-bob{animation-name:nrFBob;animation-duration:2.6s}',
      '@keyframes nrFBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}',
      '.nr-f-warm{animation-name:nrFWarm;animation-duration:2.4s}',
      '@keyframes nrFWarm{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.09);opacity:1}}',
      '.nr-f-stirred{animation-name:nrFStir;animation-duration:2.6s}',
      '@keyframes nrFStir{0%,100%{transform:translate(0,0)}25%{transform:translate(4px,-1px)}',
      '50%{transform:translate(0,1px)}75%{transform:translate(-4px,-1px)}}',
      '.nr-f-spinfood{animation-name:nrFSpin;animation-duration:1.1s;animation-timing-function:linear}',
      '@keyframes nrFSpin{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(.9)}',
      '100%{transform:rotate(360deg) scale(1)}}',
      '.nr-f-drop{animation-name:nrFDrop;animation-duration:2.8s}',
      '@keyframes nrFDrop{0%{opacity:0;transform:translateY(-8px) scale(.85)}',
      '22%,100%{opacity:1;transform:translateY(0) scale(1)}}',
      '.nr-f-breathe{animation-name:nrFBreathe;animation-duration:3.4s}',
      '@keyframes nrFBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}',

      /* planche de contrôle (NattyRecette.galerie) */
      '.nr-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}',
      '.nr-gal-c{background:var(--bg,#fff);border-radius:var(--r-md,18px);padding:10px 6px;text-align:center}',
      '.nr-gal-c .nr-illu{width:54px;height:54px;margin:0 auto}',
      '.nr-gal-n{font-size:10.5px;font-weight:800;margin-top:5px;color:var(--ink,#101014)}',
      '.nr-gal-k{font-size:9.5px;color:var(--muted,#9d9da8)}',

      '@media (prefers-reduced-motion:reduce){#nrCine .nr-plan,.nr-food,.nr-chop,.nr-stir,.nr-spin,',
      '.nr-pulse,.nr-wiggle,.nr-drip,.nr-steam path,.nr-bub circle,.nr-wave path,.nr-fall circle,',
      '.nr-fall path,.nr-twinkle path,.nr-zzz path{animation:none!important}}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── 5. La fiche ──────────────────────────────────────────*/

  function chipsHtml(e) {
    var h = '';
    if (e.duree_s) h += '<span class="nr-chip">⏱ ' + libDuree(e.duree_s) + '</span>';
    if (e.temp_c) h += '<span class="nr-chip hot">🌡 ' + libTemp(e.temp_c) + '</span>';
    if (e.feu) h += '<span class="nr-chip hot">🔥 ' + FEUX[e.feu] + '</span>';
    e.qte.forEach(function (q) {
      h += '<span class="nr-chip q">' + (q.em ? esc(q.em) + ' ' : '') + esc(q.nom)
        + (q.qte ? ' · ' + esc(q.qte) : '') + '</span>';
    });
    return h ? '<div class="nr-chips">' + h + '</div>' : '';
  }

  /**
   * HTML de la préparation détaillée.
   * @param {Object} r recette
   * @param {Object} [opts] {bouton:false} pour masquer « Suivre les étapes »
   */
  function fiche(r, opts) {
    poserCss();
    opts = opts || {};
    var et = normaliser(r);
    if (!et.length) return '';
    var tot = dureeTotale(et);
    var sousTitre = '(' + et.length + ' étape' + (et.length > 1 ? 's' : '')
      + (tot ? ' · ' + libDuree(tot) + ' de cuisine' : '') + ')';

    return '<div class="nr-prep" data-nr-prep="1">'
      + '<div class="nr-prep-head"><div class="nr-prep-t">Préparation <span>' + sousTitre + '</span></div>'
      + (opts.bouton === false ? '' : '<button class="nr-go" data-nr-suivre="1">Suivre les étapes ▸</button>')
      + '</div><div class="nr-steps">'
      + et.map(function (e) {
          return '<div class="nr-step">'
            + '<div class="nr-step-n">' + e.n + '</div>'
            + '<div class="nr-illu">' + dessin(e.action, e.aliment) + '</div>'
            + '<div class="nr-step-c">'
              + '<div class="nr-step-t">' + esc(e.titre) + '</div>'
              + (e.detail ? '<div class="nr-step-d">' + esc(e.detail) + '</div>' : '')
              + chipsHtml(e)
              + (e.tip ? '<div class="nr-tip">💡 ' + esc(e.tip) + '</div>' : '')
            + '</div></div>';
        }).join('')
      + '</div></div>';
  }

  /** Injecte la fiche dans `el` et branche son bouton. */
  function monter(el, r, opts) {
    if (!el) return;
    el.innerHTML = fiche(r, opts);
    var b = el.querySelector('[data-nr-suivre]');
    if (b) b.addEventListener('click', function () { suivre(r); });
  }

  /** Planche de contrôle : les 16 gestes avec un aliment de test. */
  function galerie(em) {
    poserCss();
    return '<div class="nr-gal">' + Object.keys(ACTIONS).map(function (k) {
      return '<div class="nr-gal-c"><div class="nr-illu">' + dessin(k, em || '🥕') + '</div>'
        + '<div class="nr-gal-n">' + esc(ACTIONS[k].libelle) + '</div>'
        + '<div class="nr-gal-k">' + k + '</div></div>';
    }).join('') + '</div>';
  }

  /* ── 5 bis. Mémoire : l'étape en cours, les recettes validées ──
     Tout vit en `localStorage`, DONC PAR APPAREIL — et c'est assumé : ce module
     n'a aucune dépendance (ni core.js, ni réseau), il s'invite sur des pages qui
     ne parlent pas toutes à Supabase, et l'étape où l'on en est d'une cuisson
     n'a de sens que sur le téléphone posé à côté de la casserole.
     La validation, elle, gagnerait à suivre l'utilisateur : c'est noté en §8 de
     CLAUDE.md comme le seul manque de ce chantier. */

  var XP_RECETTE = 50;

  function uid() {
    try { return (window.Natty && window.Natty.USER_ID) || 'anon'; } catch (e) { return 'anon'; }
  }

  /**
   * La clé stable d'une recette. La `cle` du catalogue quand elle existe (deux
   * générations produisent alors le même identifiant), sinon le nom normalisé.
   * ⚠️ Sans accent NI ligature : « bœuf » ne se décompose pas en NFD, c'est le
   * défaut qui a fait qu'aucun œuf n'était reconnu dans toute l'app (§7).
   */
  function ident(r) {
    if (r && r.cle) return String(r.cle);
    var n = sansAccent(String((r && (r.nom || r.name || r.titre)) || ''))
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return n || 'recette';
  }

  function lireJson(k, defaut) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? defaut : v; }
    catch (e) { return defaut; }
  }
  function ecrireJson(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  /* Le lundi de la semaine, en LOCAL. `NattyPlanning.lundi()` fait foi quand il
     est chargé — deux calculs de semaine qui divergent, c'est une recette
     validée qui disparaît de la carte (le défaut déjà payé entre `suivi.html`
     et `assets/liste.js`, §3). Le repli ne sert qu'aux pages sans planning.
     ⚠️ Jamais `toISOString()` : en UTC, un lundi à 1 h du matin rend dimanche. */
  function lundiCourant() {
    if (window.NattyPlanning && window.NattyPlanning.lundi) {
      try { return window.NattyPlanning.lundi(); } catch (e) {}
    }
    var d = new Date(), j = d.getDay();
    d.setDate(d.getDate() - j + (j === 0 ? -6 : 1));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  }

  function cleEtape(r) { return 'natty_recette_etape_' + uid() + '_' + ident(r); }
  function cleFaites() { return 'natty_recettes_faites_' + uid(); }

  /**
   * Où en était-on de cette recette ?
   * @returns {?{i:number,total:number}} null si rien de repris.
   */
  function progres(r) {
    var p = lireJson(cleEtape(r), null);
    if (!p || typeof p.i !== 'number' || !p.total) return null;
    if (p.i <= 0 || p.i >= p.total) return null;     // au début ou au bout : rien à reprendre
    return { i: p.i, total: p.total };
  }
  function noterProgres(r, i, total) {
    ecrireJson(cleEtape(r), { i: i, total: total, maj: Date.now() });
  }
  function oublierProgres(r) {
    try { localStorage.removeItem(cleEtape(r)); } catch (e) {}
  }

  /**
   * Les recettes validées, les plus récentes d'abord.
   * @param {string} [semaine] filtre sur un lundi ('2026-08-10') ; tout sinon.
   */
  function validees(semaine) {
    var l = lireJson(cleFaites(), []);
    if (!Array.isArray(l)) return [];
    return semaine ? l.filter(function (v) { return v && v.semaine === semaine; }) : l;
  }
  /** Cette recette a-t-elle été cuisinée ET photographiée cette semaine ? */
  function estValidee(r) {
    var id = ident(r), s = lundiCourant();
    return validees(s).some(function (v) { return v && v.id === id; });
  }
  /** Total d'XP gagnés en cuisinant, toutes semaines confondues. */
  function xpTotal() {
    return validees().reduce(function (s, v) { return s + (+v.xp || 0); }, 0);
  }

  /* Une seule ligne par recette et par semaine : revalider la même recette le
     lendemain ne doit pas doubler les XP, mais une recette refaite la semaine
     suivante compte à nouveau — c'est une autre semaine de cuisine.

     ⚠️ REFAIRE LAISSE UNE TRACE, MÊME SANS XP. La ligne existante compte ses
     `fois` et rafraîchit sa date : sans ça, la deuxième fois ne s'inscrivait
     nulle part et l'écran de fin n'avait rien de vrai à annoncer. Et c'est
     `xp` — ce que CE geste a rapporté, 0 sur une répétition — qui lui dit de
     ne pas fêter un gain qui n'a pas eu lieu. */
  function enregistrerValidation(r) {
    var id = ident(r), s = lundiCourant(), l = validees(), ligne = null;
    l.forEach(function (v) { if (v && v.id === id && v.semaine === s) ligne = v; });
    if (ligne) {
      ligne.fois = (+ligne.fois || 1) + 1;
      ligne.le = new Date().toISOString();
    } else {
      l.unshift({ id: id, nom: (r && r.nom) || 'Recette', semaine: s,
                  le: new Date().toISOString(), xp: XP_RECETTE, fois: 1 });
    }
    // 120 lignes : deux ans de cuisine, et un localStorage qui ne gonfle pas.
    ecrireJson(cleFaites(), l.slice(0, 120));
    oublierProgres(r);
    return { xp: ligne ? 0 : XP_RECETTE, total: xpTotal(),
             nb: validees().length, fois: ligne ? ligne.fois : 1 };
  }

  /* ── 6. La cinématique ────────────────────────────────────
     Une étape = un plan. Le bouton vit dans une barre fixe (`.nr-c-cta`) et
     non dans le plan : dans narration.html, un bouton posé dans le plan
     partait avec l'animation de sortie et disparaissait sous le doigt.
     Le plan sortant est retiré après son animation, sinon les deux se
     superposent — l'autre bug appris de narration.html. */

  var ENTREES = ['glide', 'parallax', 'reveal'];
  var ov = null, etapes = [], idx = 0, recCourante = null, tid = null;

  /* La cinématique a trois temps, et `idx` seul ne suffisait plus à les dire :
     'etapes' (idx < etapes.length), 'photo' (idx === etapes.length, l'écran qui
     réclame le plat en photo) et 'bravo' (la félicitation). Le bouton du bas
     change de sens à chacun — d'où `suivant()` plutôt qu'un `aller(idx+1)` en
     dur sur le clic. */
  var phase = 'etapes';
  var photoFile = null, photoUrl = null, dejaValidee = false;
  var inpCam = null, inpGal = null;

  var CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.6 10 17.4 19.2 7.6"/></svg>';

  function stage() { return ov ? ov.querySelector('.nr-c-stage') : null; }

  /* ⚠️ `i.value = ''` avant de rendre la main : reprendre DEUX fois la même
     photo n'émettrait sinon qu'un seul `change` (même fichier, même valeur), et
     le second tap sur « Reprendre la photo » n'aurait aucun effet visible. */
  function mkPhotoInput(camera) {
    var i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/*';
    if (camera) i.setAttribute('capture', 'environment');
    i.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
    i.addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (f) poserPhoto(f);
    });
    document.body.appendChild(i);
    return i;
  }

  /* ⚠️ `majBarre()` est OBLIGATOIRE ici, et il manquait : le plan se repeignait
     avec la photo pendant que le bouton du bas continuait d'annoncer
     « 📸 Prendre la photo ». Le tap validait quand même — donc un bouton qui
     mentait sur ce qu'il allait faire, le pire des deux mondes. Attrapé au banc,
     invisible à `node --check`. */
  function poserPhoto(f) {
    if (photoUrl) { try { URL.revokeObjectURL(photoUrl); } catch (e) {} }
    photoFile = f;
    photoUrl = URL.createObjectURL(f);
    if (phase === 'photo') { repeindre(planPhoto()); majBarre(); }
    vibrer(12);
  }

  function oublierPhoto() {
    if (photoUrl) { try { URL.revokeObjectURL(photoUrl); } catch (e) {} }
    photoFile = null; photoUrl = null;
  }

  function vibrer(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  // Un oscillateur : pas de fichier audio à embarquer, et créé à la demande
  // car un contexte audio ouvert avant tout geste reste suspendu.
  function bip() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      var a = new C(), o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, a.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.5);
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.52);
      setTimeout(function () { try { a.close(); } catch (e) {} }, 900);
    } catch (e) {}
  }

  function construire() {
    if (ov) return ov;
    poserCss();
    ov = document.createElement('div');
    ov.id = 'nrCine';
    ov.innerHTML =
      '<div class="nr-c-top">'
      + '<button class="nr-x" aria-label="Fermer">✕</button>'
      + '<div class="nr-c-bar"><i style="width:0%"></i></div>'
      + '<div class="nr-c-num">–</div>'
      + '</div>'
      + '<div class="nr-c-stage"></div>'
      + '<div class="nr-c-cta">'
      + '<button class="nr-prev" aria-label="Étape précédente">‹</button>'
      + '<button class="nr-next">Commencer</button>'
      + '</div>';
    document.body.appendChild(ov);
    inpCam = mkPhotoInput(true);
    inpGal = mkPhotoInput(false);
    ov.querySelector('.nr-x').addEventListener('click', fermer);
    ov.querySelector('.nr-prev').addEventListener('click', function () { aller(idx - 1); });
    ov.querySelector('.nr-next').addEventListener('click', suivant);

    /* Les boutons secondaires vivent DANS le plan, qui est reconstruit à chaque
       changement : on délègue plutôt que de rebrancher à chaque rendu — et
       surtout, le clic reste ainsi le geste de l'utilisateur, ce dont iOS a
       besoin pour ouvrir la caméra (même règle que `sync` dans journee.js). */
    stage().addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-nr]') : null;
      if (!b) return;
      var a = b.getAttribute('data-nr');
      if (a === 'photo' || a === 'reprendre') inpCam.click();
      else if (a === 'galerie') inpGal.click();
      else if (a === 'noter') noterLeRepas();
    });

    // Flèches clavier : indispensable pour tester au navigateur, gratuit pour
    // qui utilise l'app sur ordinateur.
    document.addEventListener('keydown', function (ev) {
      if (!ov || !ov.classList.contains('on')) return;
      if (ev.key === 'ArrowRight') suivant();
      else if (ev.key === 'ArrowLeft') aller(idx - 1);
      else if (ev.key === 'Escape') fermer();
    });
    return ov;
  }

  function stopTimer() { if (tid) { clearInterval(tid); tid = null; } }

  function mmss(s) {
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function brancherTimer(box, total) {
    var val = box.querySelector('.nr-tval'), btn = box.querySelector('.nr-tbtn');
    var reste = total, encours = false;
    btn.addEventListener('click', function () {
      if (encours) { stopTimer(); encours = false; btn.textContent = 'Reprendre'; return; }
      if (reste <= 0) { reste = total; box.classList.remove('fini'); }
      encours = true; btn.textContent = 'Pause';
      stopTimer();
      tid = setInterval(function () {
        reste--;
        val.textContent = mmss(Math.max(0, reste));
        if (reste <= 0) {
          stopTimer(); encours = false;
          box.classList.add('fini');
          val.textContent = "C'est prêt";
          btn.textContent = 'Relancer';
          vibrer([120, 80, 120]); bip();
        }
      }, 1000);
    });
  }

  function planEtape(e, reprise) {
    var el = document.createElement('div');
    el.className = 'nr-plan';
    el.setAttribute('data-e', ENTREES[(e.n - 1) % ENTREES.length]);
    el.innerHTML =
      (reprise ? '<div class="nr-repr">↩ Vous vous étiez arrêté ici</div>' : '')
      + '<div class="nr-big">' + dessin(e.action, e.aliment) + '</div>'
      + '<div class="nr-t">' + esc(e.titre) + '</div>'
      + (e.detail ? '<div class="nr-d">' + esc(e.detail) + '</div>' : '')
      + chipsHtml(e)
      + (e.duree_s ? '<div class="nr-timer"><div class="nr-tval">' + mmss(e.duree_s)
          + '</div><button class="nr-tbtn">Démarrer</button></div>' : '')
      + (e.tip ? '<div class="nr-tip2">💡 ' + esc(e.tip) + '</div>' : '');
    var t = el.querySelector('.nr-timer');
    if (t) brancherTimer(t, e.duree_s);
    return el;
  }

  function nomCourant() {
    return (recCourante && recCourante.nom) ? recCourante.nom : 'Votre plat';
  }

  /* L'écran qui ferme la cuisine — et le seul qui décide si la recette compte.
     Trois états : déjà validée (on ne redemande rien), photo prise (on propose
     de valider), rien encore (on demande la photo, et on le dit franchement).
     Le bouton principal reste en bas, dans `.nr-c-cta` : posé ici, l'animation
     de sortie l'emporterait sous le doigt — la leçon de narration.html. */
  function planPhoto() {
    var el = document.createElement('div');
    el.className = 'nr-plan';
    el.setAttribute('data-e', 'parallax');

    /* ⚠️ « DÉJÀ VALIDÉE » N'EST PLUS UNE IMPASSE (2026-08-18, demande de
       Pablo : « il faut pouvoir refaire la recette même si le plat est
       validé »). Cet écran disait « vous pouvez la refaire » et n'en donnait
       aucun moyen : ni caméra, ni galerie, et le bouton du bas fermait tout.
       On pouvait donc redérouler les étapes sans jamais pouvoir dire qu'on
       avait recuisiné — et surtout « Noter ce repas dans mon suivi » devenait
       hors d'atteinte, alors que le plat, lui, se mange une seconde fois et
       compte une seconde fois dans la journée. */
    /* Un repas ouvert par `realiser()` n'a pas d'étapes : on ne vient pas de le
       suivre, on vient dire qu'on l'a fait. Le genre suit — « refait » pour un
       repas, « refaite » pour une recette. */
    var sansEtapes = !etapes.length;

    if (dejaValidee && !photoUrl) {
      el.innerHTML =
        '<div class="nr-big">' + dessin('dresser', '🍽️') + '</div>'
        + '<div class="nr-t">' + (sansEtapes ? 'Vous le refaites ✓' : 'Vous la refaites ✓') + '</div>'
        + '<div class="nr-d">' + esc(nomCourant()) + ' compte déjà pour cette semaine —'
        + ' pas de nouveaux XP. Photographiez votre plat pour le noter dans'
        + ' votre suivi.</div>'
        + '<button class="nr-alt" type="button" data-nr="galerie">Choisir dans la galerie</button>';
      return el;
    }

    /* « C'est prêt 🎉 » sonnerait faux au bout d'un écran qui n'a rien
       accompagné : sans étape, on n'a rien suivi. */
    el.innerHTML = photoUrl
      ? '<div class="nr-shotw"><img class="nr-shot" src="' + photoUrl + '" alt="">'
        + '<span class="nr-badge">' + CHECK + '</span></div>'
        + '<div class="nr-t">' + (dejaValidee ? (sansEtapes ? 'Refait 👏' : 'Refaite 👏')
                                               : 'Beau travail 👏') + '</div>'
        // Promettre des XP déjà gagnés serait un mensonge sur le seul écran
        // dont le rôle est de dire ce que le geste va produire.
        + '<div class="nr-d">' + (dejaValidee
            ? 'Déjà compté cette semaine : validez pour noter ce plat dans votre'
              + ' suivi, sans XP supplémentaires.'
            : 'Validez pour ajouter ' + XP_RECETTE + ' XP et cocher '
              + esc(nomCourant()) + ' dans votre semaine.') + '</div>'
        + '<button class="nr-alt" type="button" data-nr="reprendre">Reprendre la photo</button>'
      : '<div class="nr-big">' + dessin('dresser', '🍽️') + '</div>'
        + '<div class="nr-t">' + (sansEtapes ? 'Vous l’avez préparé ?' : 'C’est prêt 🎉') + '</div>'
        + '<div class="nr-d">Photographiez votre plat pour '
        + (sansEtapes ? 'valider ce repas' : 'valider la recette')
        + '. Sans photo, il n’est pas validé.</div>'
        + '<button class="nr-alt" type="button" data-nr="galerie">Choisir dans la galerie</button>';
    return el;
  }

  /* La félicitation. Le chiffre monte plutôt que d'apparaître : c'est ce qui
     fait qu'on le regarde. `requestAnimationFrame`, jamais un `setInterval` —
     le compteur suit alors le rythme réel de l'écran.

     ⚠️ Avec un filet, et il n'est pas théorique : une page qui ne peint pas
     (app passée en arrière-plan, onglet caché) ne reçoit AUCUNE `rAF`, et le
     compteur reste bloqué sur « +0 XP » — c'est-à-dire qu'il annonce le
     contraire de ce qui vient d'être gagné. Au bout d'une seconde on pose la
     valeur finale, quoi qu'il arrive. Même précaution que la classe `on` de
     `Natty.confirmer`, doublée d'un `setTimeout` pour la même raison. */
  function compter(el, jusqua) {
    var t0 = null, fini = false;
    function poser(v) { el.textContent = '+' + v + ' XP'; }
    function pas(ts) {
      if (fini) return;
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / 850);
      poser(Math.round(jusqua * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(pas); else fini = true;
    }
    requestAnimationFrame(pas);
    setTimeout(function () { if (!fini) { fini = true; poser(jusqua); } }, 1000);
  }

  function planBravo(bilan) {
    var repete = !bilan.xp;
    var el = document.createElement('div');
    el.className = 'nr-plan';
    el.setAttribute('data-e', 'glide');
    el.innerHTML =
      (photoUrl
        ? '<div class="nr-shotw"><img class="nr-shot" src="' + photoUrl + '" alt="">'
          + '<span class="nr-badge">' + CHECK + '</span></div>'
        : '<div class="nr-big">' + dessin('dresser', '🍽️') + '</div>')
      + '<div class="nr-t">' + (repete ? (etapes.length ? 'Refaite 🎉' : 'Refait 🎉')
                                        : 'Bravo 🎉') + '</div>'
      + '<div class="nr-d">' + esc(nomCourant())
      + (repete ? ' — ' + bilan.fois + 'ᵉ fois cette semaine.' : ' — cuisiné et validé.')
      + '</div>'
      /* ⚠️ Pas de compteur d'XP sur une répétition. Le laisser afficherait
         « +0 XP » en gros et en vert au moment de féliciter — soit exactement
         l'écran du défaut corrigé en août (un compteur bloqué à zéro), mais
         cette fois sans rien qui cloche. */
      + (repete ? '' : '<div class="nr-xp">+0 XP</div>')
      + '<div class="nr-tot">' + bilan.nb + ' recette' + (bilan.nb > 1 ? 's' : '')
      + ' cuisinée' + (bilan.nb > 1 ? 's' : '') + ' · ' + bilan.total + ' XP au total</div>'
      /* Le seul endroit de l'app où cette photo peut encore servir. Sans ce
         bouton elle est jetée à la fermeture, et la journée ne compte pas le
         repas qu'on vient pourtant de cuisiner. Proposé, jamais imposé :
         valider une recette et noter un repas sont deux gestes distincts. */
      + (window.NattyAjout
          ? '<button class="nr-alt" type="button" data-nr="noter">Noter ce repas dans mon suivi →</button>'
          : '');
    var n = el.querySelector('.nr-xp');
    if (n) compter(n, bilan.xp);
    return el;
  }

  /* Le plan sortant et le plan entrant, en un seul endroit.
     ⚠️ TOUS les plans présents sortent, pas seulement le premier. Avec
     `querySelector`, deux taps rapprochés (moins que la durée de l'animation de
     sortie) laissaient un plan orphelin sous le nouveau, et c'est ce plan-là que
     le tap suivant faisait sortir — le contenu affiché et l'étape courante se
     désynchronisaient. Mesuré : 4 plans empilés après 3 clics rapides. C'est le
     chevauchement déjà rencontré dans narration.html. */
  function repeindre(plan) {
    var st = stage();
    if (!st) return;
    [].forEach.call(st.querySelectorAll('.nr-plan'), function (p) {
      p.classList.add('out');
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 360);
    });
    st.appendChild(plan);
  }

  function majBarre() {
    if (!ov) return;
    var bar = ov.querySelector('.nr-c-bar i'), num = ov.querySelector('.nr-c-num'),
        next = ov.querySelector('.nr-next'), prev = ov.querySelector('.nr-prev');
    var n = etapes.length;

    if (phase === 'bravo') {
      bar.style.width = '100%';
      num.textContent = '★';
      next.textContent = 'Terminer';
      prev.style.visibility = 'hidden';
      return;
    }
    bar.style.width = Math.round(((idx + 1) / (n + 1)) * 100) + '%';
    if (phase === 'photo') {
      num.textContent = '✓';
      // « ma recette » sur un plat placé par la planification serait faux : il
      // n'a pas d'étapes, on ne l'a pas suivi, on l'a fait.
      next.textContent = !photoFile ? '📸 Prendre la photo'
        : (dejaValidee ? 'Valider à nouveau ✓'
                       : (n ? 'Valider ma recette ✓' : 'Valider ce repas ✓'));
    } else {
      num.textContent = (idx + 1) + '/' + n;
      next.textContent = idx === n - 1 ? 'Dernière étape ✓' : 'Étape suivante →';
    }
    /* Depuis l'écran photo, ‹ ramène à la dernière étape : on peut vouloir
       relire la cuisson avant de photographier. Mais un repas SANS étape —
       les plats placés par la planification, ouverts par `realiser()` — n'a
       rien derrière lui : le bouton serait là, visible, et inerte. */
    var peutReculer = n > 0 && (phase === 'photo' || idx > 0);
    prev.style.visibility = peutReculer ? 'visible' : 'hidden';
  }

  function aller(n, reprise) {
    if (!ov || n < 0 || n > etapes.length) return;
    stopTimer();
    idx = n;
    phase = (idx === etapes.length) ? 'photo' : 'etapes';
    repeindre(phase === 'photo' ? planPhoto() : planEtape(etapes[idx], reprise));
    // La mémoire se pose à chaque étape, pas à la fermeture : une app tuée par
    // le système ne passe par aucun `fermer()`.
    if (phase === 'etapes' && recCourante) noterProgres(recCourante, idx, etapes.length);
    majBarre();
    vibrer(10);
  }

  /** Le bouton du bas — son sens dépend du temps où l'on est. */
  function suivant() {
    if (!ov) return;
    if (phase === 'bravo') { fermer(); return; }
    if (phase === 'photo') {
      // ⚠️ Appel SYNCHRONE dans le geste : iOS n'ouvre la caméra que là. Un
      // `await` ou un `setTimeout` avant, et plus rien ne s'ouvre.
      if (!photoFile) { inpCam.click(); return; }
      valider();
      return;
    }
    aller(idx + 1);
  }

  function valider() {
    if (!photoFile || !recCourante) return;
    var bilan = enregistrerValidation(recCourante);
    dejaValidee = true;
    phase = 'bravo';
    repeindre(planBravo(bilan));
    majBarre();
    vibrer([18, 70, 18]); bip();
    try {
      document.dispatchEvent(new CustomEvent('natty:recette-validee', {
        detail: {
          recette: recCourante, id: ident(recCourante),
          xp: bilan.xp, xpTotal: bilan.total, nb: bilan.nb, photo: photoFile
        }
      }));
    } catch (e) {}
  }

  /* Le pont vers `assets/ajout.js` : la photo déjà prise part à l'analyse, donc
     personne ne rephotographie une assiette qu'il vient de photographier. */
  function noterLeRepas() {
    if (!window.NattyAjout || !photoFile) return;
    var f = photoFile;
    fermer();
    try { window.NattyAjout.start({ file: f, nom: nomCourant() }); }
    catch (e) {}
  }

  /**
   * Ouvre la cinématique. Sans étape exploitable, ne fait rien et le dit :
   * un plein écran vide serait pire que pas d'écran.
   * Reprend là où l'on s'était arrêté (voir §5 bis).
   * @returns {boolean} true si elle s'est ouverte
   */
  function suivre(r) {
    etapes = normaliser(r);
    if (!etapes.length) return false;
    recCourante = r;
    construire();
    oublierPhoto();
    dejaValidee = estValidee(r);

    /* ⚠️ `total` doit correspondre : une recette régénérée depuis n'a plus le
       même nombre d'étapes, et reprendre à l'index 6 d'une recette qui n'en a
       plus que 4 afficherait n'importe quoi. `progres()` rend alors null. */
    var p = progres(r);
    var depart = (p && p.total === etapes.length) ? p.i : 0;

    document.body.style.overflow = 'hidden';   // jamais position:fixed (casse le scroll iOS)
    ov.classList.add('on');
    stage().innerHTML = '';
    aller(depart, depart > 0);
    return true;
  }

  /**
   * Ouvre la cinématique DIRECTEMENT sur l'écran de validation.
   *
   * ⚠️ POURQUOI CETTE SECONDE ENTRÉE. La planification place 3 plats macro pour
   * 2 recettes, et un plat macro n'a **pas d'étapes** : `suivre()` rend `false`
   * et rend la main. Sans `realiser()`, trois repas de la semaine sur cinq ne
   * pouvaient donc ni se valider, ni gagner d'XP, ni se cocher dans le
   * calendrier — on pouvait les regarder, pas les faire.
   *
   * Le contrat est le MÊME que pour une recette : rien ne compte sans photo.
   * @returns {boolean} toujours true — il y a toujours quelque chose à montrer.
   */
  function realiser(r) {
    etapes = normaliser(r);
    recCourante = r;
    construire();
    oublierPhoto();
    dejaValidee = estValidee(r);
    document.body.style.overflow = 'hidden';
    ov.classList.add('on');
    stage().innerHTML = '';
    aller(etapes.length);          // = l'écran photo, quel que soit le nombre d'étapes
    return true;
  }

  function fermer() {
    stopTimer();
    if (!ov) return;
    var termine = phase !== 'etapes';
    ov.classList.remove('on');
    stage().innerHTML = '';
    document.body.style.overflow = '';
    oublierPhoto();
    phase = 'etapes';
    try {
      document.dispatchEvent(new CustomEvent('natty:recette-fermee', {
        detail: { recette: recCourante, termine: termine, etape: idx }
      }));
    } catch (e) {}
  }

  return {
    fiche: fiche,
    monter: monter,
    suivre: suivre,
    realiser: realiser,
    fermer: fermer,
    galerie: galerie,
    etapes: normaliser,
    dessin: dessin,
    /* Mémoire — lue par `repas.html` (libellé du bouton, coche de la semaine)
       et par `assets/planning.js` (cases du calendrier). */
    identifiant: ident,
    progres: progres,
    oublierProgres: oublierProgres,
    estValidee: estValidee,
    validees: validees,
    xpTotal: xpTotal,
    XP_RECETTE: XP_RECETTE,
    actions: function () { return Object.keys(ACTIONS); },
    thermostat: thermostat,
    libTemp: libTemp,
    libDuree: libDuree
  };
})();
