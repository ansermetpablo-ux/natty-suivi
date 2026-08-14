/* ═══════════════════════════════════════════════════════════
   Natty — Garde-manger (les ingrédients dont l'utilisateur dispose)
   ───────────────────────────────────────────────────────────
   Rempli de quatre façons : photo des courses, photo d'un ticket de
   caisse, photo importée de la galerie, ou saisie libre. Les photos
   passent par /api/claude (vision) ; la saisie est parsée localement.

   Sert de source aux recommandations : assets/reco.js injecte cette
   liste dans le prompt pour que les recettes partent de ce qui est
   réellement disponible (voir « INGRÉDIENTS DISPONIBLES »).

   ⚠️ PERSISTANCE — tant que la table `garde_manger` est absente, le
   module bascule tout seul sur localStorage (donc propre à
   l'appareil) et le panneau le DIT. La créer suffit à activer la
   synchronisation, sans toucher au code.

   Le SQL vit désormais dans `natty_garde_manger.sql`, avec ses
   raisons. ⚠️ Cet en-tête proposait autrefois
   `disable row level security` : c'était écrit AVANT l'activation
   générale des RLS (2026-08-04), et ce serait aujourd'hui exposer à
   la clé anon publique ce que chacun a chez lui. La table s'active
   avec une policy « soi seulement », comme `planning_semaine`.

   ⚠️ `user_id` doit être la CLÉ PRIMAIRE : `sauver()` écrit en
   `resolution=merge-duplicates` sans `?on_conflict=`, et PostgREST
   résout alors sur la clé primaire. Avec un `id` uuid en clé, chaque
   enregistrement repartirait en 409.

   ═══════════════════════════════════════════════════════════ */
var NattyGardeManger = (function () {
  var CLAUDE_API = 'https://natty-suivi.vercel.app/api/claude';
  var TABLE = 'garde_manger';

  var items = [];         // [{em, nom, qte}]
  var support = null;     // 'table' | 'local' — déterminé au premier chargement
  var charge = false;

  function cleLocale() { return 'natty_garde_manger_' + Natty.USER_ID; }

  function normaliser(nom) {
    return String(nom || '').toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/^(du|de la|des|le|la|les|un|une|d')\s+/, '')
      .replace(/s$/, '');
  }

  /* Emoji déduit du nom, pour la saisie libre (les scans en fournissent un).
     Liste volontairement courte : elle sert à rendre la grille lisible d'un
     coup d'œil, pas à couvrir tout le rayon. */
  var EMOJIS = [
    [/poulet|dinde|volaille/, '🍗'], [/boeuf|steak|viande|agneau|porc|jambon|lardon/, '🥩'],
    [/saumon|thon|poisson|cabillaud|sardine|maquereau/, '🐟'], [/crevette|gambas|moule|crustac/, '🦐'],
    [/oeuf|œuf/, '🥚'], [/lait|creme|crème/, '🥛'], [/fromage|feta|mozzar|parmesan|comte|chevre/, '🧀'],
    [/yaourt|skyr|fromage blanc/, '🍶'], [/riz/, '🍚'], [/pate|pâte|spaghetti|nouille/, '🍝'],
    [/pain|baguette|tortilla|wrap/, '🍞'], [/avoine|flocon|cereale|muesli|granola/, '🥣'],
    [/quinoa|boulgour|semoule|couscous|sarrasin/, '🌾'], [/patate|pomme de terre/, '🥔'],
    [/tomate/, '🍅'], [/salade|laitue|epinard|épinard|mache|roquette/, '🥬'], [/brocoli|chou/, '🥦'],
    [/carotte/, '🥕'], [/oignon|echalote|échalote/, '🧅'], [/ail/, '🧄'], [/poivron/, '🫑'],
    [/champignon/, '🍄'], [/courgette|aubergine|concombre/, '🥒'], [/avocat/, '🥑'],
    [/banane/, '🍌'], [/pomme/, '🍎'], [/orange|clementine|mandarine/, '🍊'], [/citron/, '🍋'],
    [/fraise|framboise|myrtille|fruits rouges/, '🍓'], [/raisin/, '🍇'], [/mangue|ananas|peche|pêche/, '🥭'],
    [/huile|olive/, '🫒'], [/beurre/, '🧈'], [/noix|amande|noisette|cajou|pistache|graine/, '🥜'],
    [/lentille|haricot|pois|chiche|feve|fève/, '🫘'], [/tofu|tempeh|seitan/, '🧊'],
    [/chocolat|cacao/, '🍫'], [/miel|sirop|sucre/, '🍯'], [/sel|poivre|epice|épice|curry|paprika/, '🧂'],
    [/basilic|persil|coriandre|herbe|menthe|thym/, '🌿']
  ];

  function emojiPour(nom) {
    var n = normaliser(nom);
    for (var i = 0; i < EMOJIS.length; i++) if (EMOJIS[i][0].test(n)) return EMOJIS[i][1];
    return '🥄';
  }

  /* Filet de sécurité sur les tickets : l'IA laisse parfois passer une ligne
     non alimentaire (« liquide vaisselle » observé en test). Le filtre local
     ne dépend pas du modèle, donc il ne régresse pas. */
  var NON_ALIMENTAIRE = /vaisselle|lessive|adoucissant|javel|nettoyant|desinfect|savon|shampo|douche|dentifrice|deodor|desodor|rasoir|mouchoir|papier toilette|essuie|sopalin|eponge|sac (cabas|plastique|course)|cabas|litiere|croquette|pile|ampoule|pansement|couche|coton|film alimentaire|alu|poubelle|balai|serpilliere/;

  function nettoyer(arr) {
    var vus = {}, out = [];
    (arr || []).forEach(function (x) {
      var nom = String(x && x.nom || '').trim();
      if (!nom) return;
      var k = normaliser(nom);
      if (NON_ALIMENTAIRE.test(k)) return;
      if (vus[k] !== undefined) {
        // Même ingrédient rescanné : la quantité la plus récente gagne.
        if (x.qte) out[vus[k]].qte = String(x.qte).trim();
        return;
      }
      vus[k] = out.length;
      var em = String(x.em || '').slice(0, 4);
      if (!em || em === '🥄') em = emojiPour(nom);
      out.push({ em: em, nom: nom, qte: String(x.qte || '').trim() });
    });
    return out;
  }

  /* ── Persistance ──────────────────────────────────────────── */

  function lireLocal() {
    try { return JSON.parse(localStorage.getItem(cleLocale()) || '[]'); }
    catch (e) { return []; }
  }
  function ecrireLocal() {
    try { localStorage.setItem(cleLocale(), JSON.stringify(items)); } catch (e) {}
  }

  async function charger() {
    if (charge) return items;
    charge = true;
    if (!Natty.USER_ID) { items = []; support = 'local'; return items; }
    try {
      var r = await Natty.sbFetch(TABLE + '?user_id=eq.' + Natty.USER_ID + '&select=items&limit=1');
      support = 'table';
      var brut = r && r[0] ? r[0].items : [];
      if (typeof brut === 'string') { try { brut = JSON.parse(brut); } catch (e) { brut = []; } }
      items = nettoyer(brut);
      // La table fait foi, mais on garde une copie locale : la page reste
      // utilisable hors ligne et nbItems() n'attend pas le réseau.
      ecrireLocal();
    } catch (e) {
      // Table absente (PGRST205) ou réseau indisponible : on continue en local.
      support = 'local';
      items = nettoyer(lireLocal());
    }
    return items;
  }

  async function sauver() {
    ecrireLocal();
    if (support !== 'table' || !Natty.USER_ID) return false;
    try {
      await Natty.sbPost(TABLE, {
        user_id: Natty.USER_ID, items: items, updated_at: new Date().toISOString()
      }, 'resolution=merge-duplicates,return=minimal');
      return true;
    } catch (e) {
      return false;   // la copie locale a déjà été écrite : rien n'est perdu
    }
  }

  /* ── Lecture / édition ────────────────────────────────────── */

  function liste() { return items.slice(); }
  function nbItems() { return items.length; }

  // Mots porteurs de sens d'un libellé : sert à rapprocher « Blanc de poulet »
  // et « poulet ». La comparaison se fait mot à mot et jamais en sous-chaîne,
  // sinon « ail » se retrouverait dans « volaille ».
  var VIDES = /^(de|du|des|la|le|les|aux|avec|bio|frais|fraiche|nature|cru|cuit|gros|petit|grand|sans|pour|par|entier|demi)$/;

  function motsDe(s) {
    return normaliser(s).split(/[^a-z0-9]+/)
      .filter(function (w) { return w.length > 2 && !VIDES.test(w); });
  }

  // Le garde-manger couvre-t-il cet ingrédient de recette ?
  function contient(nom) {
    var a = motsDe(nom);
    if (!a.length) return false;
    return items.some(function (x) {
      var b = motsDe(x.nom);
      return a.some(function (w) { return b.indexOf(w) > -1; });
    });
  }

  async function ajouter(arr) {
    items = nettoyer(items.concat(arr || []));
    await sauver();
    return items;
  }

  async function retirer(i) {
    items.splice(i, 1);
    await sauver();
    return items;
  }

  async function vider() {
    items = [];
    await sauver();
    return items;
  }

  /* ── Consommation par une recette ─────────────────────────────
     Suivre une recette doit sortir du garde-manger ce qu'elle utilise,
     sinon les recommandations continuent de partir d'ingrédients déjà
     cuisinés.

     Les quantités sont du texte libre des deux côtés (« 500 g »,
     « 1 bouquet », « 1/2 »). Quand les deux se ramènent à la même unité
     de base on soustrait ; sinon — ou si le stock tombe à zéro —
     l'ingrédient sort entièrement. Mieux vaut retirer un ingrédient
     encore un peu disponible que continuer à proposer des recettes
     basées sur un stock déjà consommé. */

  var UNITES = {
    mg: ['g', 0.001], g: ['g', 1], kg: ['g', 1000],
    ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000]
  };

  function parseQte(s) {
    var m = String(s || '').trim().toLowerCase().replace(',', '.')
      .match(/^(\d+(?:\.\d+)?)\s*(kg|mg|g|ml|cl|dl|l)\b/);
    if (!m || !UNITES[m[2]]) return null;
    var u = UNITES[m[2]];
    return { base: u[0], val: parseFloat(m[1]) * u[1] };
  }

  function formatQte(base, val) {
    var gros = base === 'g' ? 'kg' : 'l';
    if (val >= 1000) return (Math.round(val / 100) / 10) + ' ' + gros;
    return Math.round(val) + ' ' + base;
  }

  /**
   * Retire du garde-manger ce qu'une recette consomme.
   * @param {Array} ingredients  accepte {nom,qte} | {nm,qt} | "poulet"
   * @returns {Promise<Array>} libellés de ce qui a été consommé
   */
  async function consommer(ingredients) {
    var consommes = [];
    (ingredients || []).forEach(function (ing) {
      // Les pages font circuler trois formes selon leur origine
      // (recette IA, repas enregistré, saisie) : on les accepte toutes.
      var nom = typeof ing === 'string' ? ing : (ing && (ing.nom || ing.nm)) || '';
      var qte = typeof ing === 'string' ? '' : (ing && (ing.qte || ing.qt || ing.quantite)) || '';
      var mots = motsDe(nom);
      if (!mots.length) return;

      var i = -1;
      for (var k = 0; k < items.length; k++) {
        var b = motsDe(items[k].nom);
        if (mots.some(function (w) { return b.indexOf(w) > -1; })) { i = k; break; }
      }
      if (i === -1) return;

      var stock = parseQte(items[i].qte), besoin = parseQte(qte);
      if (stock && besoin && stock.base === besoin.base && stock.val > besoin.val) {
        items[i].qte = formatQte(stock.base, stock.val - besoin.val);
        consommes.push(items[i].nom);
        return;
      }
      consommes.push(items[i].nom);
      items.splice(i, 1);
    });
    if (consommes.length) await sauver();
    return consommes;
  }

  /* ── Saisie libre ─────────────────────────────────────────────
     « poulet, riz 500 g, 3 œufs » → trois entrées. La quantité est
     ce qui reste une fois le nom isolé ; on ne cherche pas à être
     exhaustif, l'IA n'a besoin que de repères. */
  function depuisTexte(txt) {
    return nettoyer(String(txt || '').split(/[,;\n]+/).map(function (bout) {
      var s = bout.trim();
      if (!s) return null;
      var m = s.match(/^(\d+[\d.,]*\s*(?:g|kg|ml|cl|l|x)?)\s+(.+)$/i);   // « 500 g riz »
      if (m) return { nom: m[2].trim(), qte: m[1].trim() };
      m = s.match(/^(.+?)\s+(\d+[\d.,]*\s*(?:g|kg|ml|cl|l)?)$/i);        // « riz 500 g »
      if (m) return { nom: m[1].trim(), qte: m[2].trim() };
      return { nom: s, qte: '' };
    }).filter(Boolean));
  }

  /* ── Scan photo ───────────────────────────────────────────── */

  var CONSIGNES = {
    courses: 'Cette photo montre des courses, un frigo ou un placard.',
    ticket: 'Cette photo est un ticket de caisse. Lis les lignes et ignore les totaux, remises, moyens de paiement et tout ce qui n\'est pas un aliment.',
    auto: 'Cette photo est soit des courses / un frigo / un placard, soit un ticket de caisse. Determine toi-meme lequel.'
  };

  /**
   * @param {File} file    photo à analyser
   * @param {string} type  'courses' | 'ticket' | 'auto'
   * @returns {Promise<Array>} items reconnus ; lève une erreur si l'IA échoue
   */
  async function scanner(file, type) {
    var b64 = await new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function (e) { res(e.target.result.split(',')[1]); };
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    var prompt = (CONSIGNES[type] || CONSIGNES.auto) + ' '
      + 'Liste UNIQUEMENT les aliments et ingredients de cuisine que tu identifies. '
      + 'Un produit menager, d hygiene ou un contenant (liquide vaisselle, lessive, savon, '
      + 'papier toilette, sac, eponge) ne doit JAMAIS apparaitre dans la liste. '
      + 'Donne un nom court et generique en francais (ex: "Blanc de poulet", "Riz basmati"), '
      + 'un emoji representatif, et la quantite si elle est lisible (sinon chaine vide). '
      + 'Si aucun aliment n est identifiable, renvoie une liste vide. '
      + 'Reponds UNIQUEMENT en JSON sans backticks: '
      + '{"items":[{"em":"🥦","nom":"Brocoli","qte":"500 g"}]}';

    var r = await fetch(CLAUDE_API, {
      method: 'POST', headers: await Natty.enTetesIA(),
      body: JSON.stringify({ prompt: prompt, max_tokens: 1200, image: b64, media_type: file.type })
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || ('api/claude ' + r.status));
    var data = JSON.parse((d.text || '{}').replace(/```[a-z]*|```/g, '').trim());
    return nettoyer(data.items || []);
  }

  /* Ligne prête à insérer dans un prompt IA (vide si rien en stock). */
  function pourPrompt() {
    if (!items.length) return '';
    return items.map(function (x) {
      return x.nom + (x.qte ? ' (' + x.qte + ')' : '');
    }).join(', ');
  }

  return {
    charger: charger, liste: liste, nbItems: nbItems, contient: contient,
    ajouter: ajouter, retirer: retirer, vider: vider, consommer: consommer,
    depuisTexte: depuisTexte, scanner: scanner, pourPrompt: pourPrompt,
    estSynchronise: function () { return support === 'table'; }
  };
})();
