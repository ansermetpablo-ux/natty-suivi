// ═══════════════════════════════════════════════════════════
// Natty — Table nutritionnelle côté serveur
// ───────────────────────────────────────────────────────────
// ⚠️ COPIE MÉCANIQUE de la table `NT` d'assets/core.js. Le serveur ne peut pas
// importer core.js (script navigateur, IIFE globale), et les macros d'un repas
// ne sont stockées nulle part : `meal_ingredients` n'a que `name` et
// `quantity_g` — ses colonnes `calories`/`proteins_g` sont à 0 sur toutes les
// lignes en base. Le rappel du soir doit donc refaire le calcul de l'app.
//
// `daily_macros` ne peut pas servir de source : suivi.html n'y écrit QUE la
// journée de la veille, au premier lancement du lendemain (`resetIfNewDay`).
// Les totaux du jour ne vivent que dans le localStorage de l'appareil.
//
// SI LA TABLE DE core.js CHANGE, régénérer ce fichier :
//   python3 - <<'EOF'
//   src=open('assets/core.js').read(); i=src.index('  var NT = {')
//   j=src.index('\n  };', i)+5; print(src[i:j])
//   EOF
// puis recoller le littéral ci-dessous. Une divergence ne casse rien : elle
// décale le nombre de grammes annoncé dans un rappel, pas le suivi.
// ═══════════════════════════════════════════════════════════

const NT = {
    'poulet':{c:165,p:31,l:3.6,g:0},'dinde':{c:135,p:29,l:1,g:0},'boeuf':{c:250,p:26,l:15,g:0},
    'saumon':{c:208,p:20,l:13,g:0},'thon':{c:132,p:28,l:1,g:0},'cabillaud':{c:82,p:18,l:0.7,g:0},
    'crevettes':{c:99,p:21,l:1.1,g:0},'sardines':{c:208,p:25,l:11,g:0},
    'oeuf':{c:155,p:13,l:11,g:1.1},'oeufs':{c:155,p:13,l:11,g:1.1},
    'agneau':{c:282,p:25,l:20,g:0},'porc':{c:242,p:27,l:14,g:0},'lardons':{c:337,p:18,l:29,g:0},
    'tofu':{c:76,p:8,l:4.2,g:1.9},'tempeh':{c:195,p:19,l:11,g:9.4},
    'lentilles':{c:116,p:9,l:0.4,g:20},'pois chiches':{c:164,p:9,l:2.6,g:27},'haricots':{c:127,p:9,l:0.5,g:23},
    'edamame':{c:122,p:11,l:5.2,g:9.9},
    'riz':{c:130,p:2.7,l:0.3,g:28},'pates':{c:131,p:5,l:1.1,g:25},'quinoa':{c:120,p:4.4,l:1.9,g:22},
    'pain':{c:265,p:9,l:3.2,g:49},'pomme de terre':{c:77,p:2,l:0.1,g:17},
    'patate douce':{c:86,p:1.6,l:0.1,g:20},'avoine':{c:389,p:17,l:7,g:66},
    'polenta':{c:83,p:2,l:0.5,g:18},'boulgour':{c:83,p:3,l:0.2,g:18},'sarrasin':{c:92,p:3.4,l:0.6,g:20},
    'brocoli':{c:34,p:2.8,l:0.4,g:7},'epinards':{c:23,p:2.9,l:0.4,g:3.6},'courgette':{c:17,p:1.2,l:0.3,g:3.1},
    'tomate':{c:18,p:0.9,l:0.2,g:3.9},'carotte':{c:41,p:0.9,l:0.2,g:10},'poivron':{c:31,p:1,l:0.3,g:6},
    'salade':{c:15,p:1.4,l:0.2,g:2.9},'avocat':{c:160,p:2,l:15,g:9},'champignons':{c:22,p:3.1,l:0.3,g:3.3},
    'oignon':{c:40,p:1.1,l:0.1,g:9},'ail':{c:149,p:6.4,l:0.5,g:33},'aubergine':{c:25,p:1,l:0.2,g:6},
    'pomme':{c:52,p:0.3,l:0.2,g:14},'banane':{c:89,p:1.1,l:0.3,g:23},'fraise':{c:32,p:0.7,l:0.3,g:7.7},
    'orange':{c:47,p:0.9,l:0.1,g:12},'mangue':{c:60,p:0.8,l:0.4,g:15},'kiwi':{c:61,p:1.1,l:0.5,g:15},
    'yaourt':{c:59,p:3.5,l:3.3,g:4.7},'fromage blanc':{c:79,p:8,l:4,g:3.5},'feta':{c:264,p:14,l:21,g:4},
    'mozzarella':{c:280,p:18,l:22,g:2.2},'parmesan':{c:431,p:38,l:29,g:4},'lait':{c:61,p:3.2,l:3.3,g:4.8},
    'huile olive':{c:884,p:0,l:100,g:0},'huile':{c:884,p:0,l:100,g:0},'beurre':{c:717,p:0.9,l:81,g:0.1},
    'noix':{c:654,p:15,l:65,g:14},'amandes':{c:579,p:21,l:50,g:22},'tahini':{c:595,p:17,l:54,g:21}
  };;

/* Même appariement que core.js : sous-chaîne, ou tous les mots de la clé
   présents dans le nom. Recopié tel quel — un appariement différent donnerait
   des grammes différents de ceux affichés à l'écran. */
export function getNutri(name, qty) {
  const n = (name || '').toLowerCase();
  const key = Object.keys(NT).find(k => n.indexOf(k) > -1 || k.split(' ').every(w => n.indexOf(w) > -1));
  if (!key) return null;
  const f = qty / 100, b = NT[key];
  // Arrondi PAR INGRÉDIENT, comme core.js. Sommer les valeurs brutes puis
  // arrondir une seule fois serait plus juste, mais donnerait un gramme
  // d'écart avec le chiffre affiché à l'écran (mesuré sur les repas réels) —
  // et un rappel qui contredit l'app d'un gramme, c'est l'app qui a tort.
  return { c: Math.round(b.c * f), p: Math.round(b.p * f * 10) / 10, l: Math.round(b.l * f * 10) / 10, g: Math.round(b.g * f * 10) / 10 };
}

export function calcMac(ings) {
  const t = { c: 0, p: 0, l: 0, g: 0 };
  for (const i of (ings || [])) {
    const r = getNutri(i.name, i.quantity_g || 0);
    if (r) { t.c += r.c; t.p += r.p; t.l += r.l; t.g += r.g; }
  }
  return { c: Math.round(t.c), p: Math.round(t.p * 10) / 10, l: Math.round(t.l * 10) / 10, g: Math.round(t.g * 10) / 10 };
}
