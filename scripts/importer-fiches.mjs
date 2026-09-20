/* Les fiches techniques Natty (scripts/fiches-natty.mjs) → SQL pour Supabase.
   Commande :  node scripts/importer-fiches.mjs [--verif] > /tmp/fiches.sql

   CE QUE ÇA PRODUIT — une fonction SQL temporaire + UN appel avec les 38 fiches
   en JSON (~40 Ko), qui :
     1. calcule les macros PAR PORTION de chaque fiche avec la table
        d'assets/core.js (celle qui compte les repas de l'app), jamais à la main
        — même raison que scripts/injecter-recettes.mjs ;
     2. écrit `recettes` (nb_portions = 6, macros, catégorie = le code de la
        fiche), `recettes_ingredients` (grammages pour 6), `recettes_etapes`
        (titre, description, durée, phase, passif, GESTE, ALIMENT) ;
     3. écrit un `plats_menu` par fiche (ce que le client voit à l'unité), relié
        par `recettes.plat_id`.
   Rejouable : une fiche déjà présente (même `nom`) est REMPLACÉE — ses
   ingrédients et étapes sont effacés et réécrits, son id et son plat_id
   restent, donc les attributions existantes ne se cassent pas.

   `--verif` n'écrit rien : il liste les ingrédients que la table ne sait pas
   chiffrer et les gestes hors vocabulaire. À lire AVANT d'importer.
   ✅ Exécuté le 2026-09-16 via l'outil MCP Supabase (4 lots de 10) : 38 fiches,
   345 ingrédients, 236 étapes. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FICHES, PORTIONS } from './fiches-natty.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
global.window = global;
global.document = { addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {} } }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild() {} }, body: { appendChild() {} } };
global.localStorage = { getItem: () => null, setItem() {} };
global.location = { search: '', href: '', pathname: '/' };
const core = fs.readFileSync(path.join(RACINE, 'assets/core.js'), 'utf8');
const Natty = new Function('window', core + '; return Natty;')(global);

const GESTES = ['couper','saisir','bouillir','mijoter','enfourner','melanger','fouetter',
  'mixer','assaisonner','huiler','rincer','peser','refrigerer','reposer','attendre','dresser'];
const CATEGORIE = { PS: 'prise_masse', PP: 'perte_poids', PM: 'PM', VG: 'vegetarien', SG: 'sans_gluten' };
// plats_menu.categorie n'a que quatre valeurs : on y range le code au plus près.
const CAT_MENU = { PS: 'proteines', PP: 'low_carb', PM: 'proteines', VG: 'legumes', SG: 'equilibre' };

const verif = process.argv.includes('--verif');
const inconnus = new Map(), gestesKo = [];
const q = s => "'" + String(s == null ? '' : s).replace(/'/g, "''") + "'";

function lireIng(s) {
  const [nom, g, qte] = s.split('|').map(x => x.trim());
  return { nom, g: Number(g) || 0, qte: qte || '' };
}
function lireEtape(s, i) {
  const [geste, aliment, min, flags, titre, desc, temp, dep] = s.split('|').map(x => (x || '').trim());
  if (GESTES.indexOf(geste) < 0) gestesKo.push(geste);
  const depend_de = dep ? dep.split(',').map(Number).filter(n => n > 0 && n <= i) : null;
  return { numero: i + 1, geste, aliment, duree_min: Number(min) || null,
    passif: (flags || '').includes('P'), phase: (flags || '').includes('A') ? 'assemblage' : 'production',
    titre, description: desc, temperature_c: Number(temp) || null, depend_de };
}
function macros(ings) {
  let c = 0, p = 0, g = 0, l = 0;
  for (const i of ings) {
    if (!i.g) continue;
    const n = Natty.getNutri(i.nom, i.g);
    if (!n) { inconnus.set(i.nom, (inconnus.get(i.nom) || 0) + 1); continue; }
    c += n.c; p += n.p; g += n.g; l += n.l;
  }
  return { kcal: Math.round(c / PORTIONS), p: Math.round(p / PORTIONS), g: Math.round(g / PORTIONS), l: Math.round(l / PORTIONS) };
}

/* ── Une FONCTION SQL, appelée une fois avec toutes les fiches en JSON ─────
   Plutôt que 38 blocs `do $$` de 5 Ko chacun : la même logique, écrite une
   fois, et les données en JSON compact (~40 Ko pour les 38). C'est ce qui
   rend l'import passable d'un coup dans l'éditeur SQL — ou par l'outil MCP —
   sans dépasser la taille d'une requête. La fonction est supprimée à la fin. */
const FONCTION = `
create or replace function public.natty_importer_fiches(fiches jsonb) returns integer
language plpgsql as $$
declare f jsonb; i jsonb; e jsonb; rid uuid; pid uuid; n integer := 0; k integer;
begin
  for f in select * from jsonb_array_elements(fiches) loop
    select id, plat_id into rid, pid from public.recettes where nom = f->>'nom' limit 1;
    if pid is null then select id into pid from public.plats_menu where nom = f->>'nom' limit 1; end if;
    if pid is null then
      insert into public.plats_menu (nom, description, calories, proteines, glucides, lipides, categorie, actif)
        values (f->>'nom', f->>'desc', (f->>'kcal')::int, (f->>'p')::numeric, (f->>'g')::numeric, (f->>'l')::numeric, f->>'cat_menu', true)
        returning id into pid;
    else
      update public.plats_menu set description = f->>'desc', calories = (f->>'kcal')::int, proteines = (f->>'p')::numeric,
        glucides = (f->>'g')::numeric, lipides = (f->>'l')::numeric, actif = true where id = pid;
    end if;
    if rid is null then
      insert into public.recettes (plat_id, nom, description, categorie, nb_portions, temps_prep_min, temps_cuisson_min,
        calories_portion, prot_portion, gluc_portion, lip_portion, actif)
        values (pid, f->>'nom', f->>'desc', f->>'cat', (f->>'portions')::int, (f->>'tp')::int, (f->>'tc')::int,
          (f->>'kcal')::numeric, (f->>'p')::numeric, (f->>'g')::numeric, (f->>'l')::numeric, true)
        returning id into rid;
    else
      update public.recettes set plat_id = pid, description = f->>'desc', categorie = f->>'cat', nb_portions = (f->>'portions')::int,
        temps_prep_min = (f->>'tp')::int, temps_cuisson_min = (f->>'tc')::int, calories_portion = (f->>'kcal')::numeric,
        prot_portion = (f->>'p')::numeric, gluc_portion = (f->>'g')::numeric, lip_portion = (f->>'l')::numeric,
        actif = true, updated_at = now() where id = rid;
    end if;
    delete from public.recettes_ingredients where recette_id = rid;
    delete from public.recettes_etapes where recette_id = rid;
    k := 0;
    for i in select * from jsonb_array_elements(f->'ing') loop
      k := k + 1;
      insert into public.recettes_ingredients (recette_id, ingredient_nom, quantite_g, unite, notes, ordre)
        values (rid, i->>0, (i->>1)::numeric, 'g', i->>2, k);
    end loop;
    k := 0;
    for e in select * from jsonb_array_elements(f->'etapes') loop
      k := k + 1;
      insert into public.recettes_etapes (recette_id, numero, titre, description, duree_min, phase, passif, geste, aliment, temperature_c, depend_de)
        values (rid, k, e->>4, e->>5, nullif(e->>2,'')::int, case when position('A' in coalesce(e->>3,'')) > 0 then 'assemblage' else 'production' end,
          position('P' in coalesce(e->>3,'')) > 0, e->>0, e->>1, nullif(e->>6,'')::int,
          case when coalesce(e->>7,'') = '' then null else string_to_array(e->>7, ',')::int[] end);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;`;

const donnees = [];
const noms = new Set();
for (const f of FICHES) {
  if (noms.has(f.nom)) throw new Error('nom en double : ' + f.nom);
  noms.add(f.nom);
  const ings = f.ing.map(lireIng), etapes = f.etapes.map(lireEtape), m = macros(ings);
  const tp = etapes.filter(e => e.phase === 'production').reduce((t, e) => t + (e.duree_min || 0), 0);
  const tc = etapes.filter(e => e.passif).reduce((t, e) => t + (e.duree_min || 0), 0);
  const gTotal = ings.reduce((t, i) => t + i.g, 0);
  donnees.push({ nom: f.nom, desc: f.desc, cat: CATEGORIE[f.code] || f.code, cat_menu: CAT_MENU[f.code] || 'equilibre',
    portions: PORTIONS, tp: tp - tc, tc, kcal: m.kcal, p: m.p, g: m.g, l: m.l,
    ing: ings.map(i => [i.nom, i.g, i.qte]),
    etapes: f.etapes.map(s => s.split('|').map(x => (x || '').trim())) });
  if (verif) console.error(`${f.nom.padEnd(52)} ${String(m.kcal).padStart(4)} kcal · ${m.p} p · ${m.g} g · ${m.l} l · ${Math.round(gTotal / PORTIONS)} g/portion · ${etapes.length} étapes`);
}

if (inconnus.size) console.error('\n⚠ ingrédients que la table ne sait pas chiffrer (comptés 0) :\n  ' + [...inconnus.keys()].join(', '));
if (gestesKo.length) console.error('\n⚠ gestes hors vocabulaire : ' + [...new Set(gestesKo)].join(', '));
if (!verif) {
  process.stdout.write(FONCTION + '\n');
  process.stdout.write('select public.natty_importer_fiches(' + q(JSON.stringify(donnees)) + '::jsonb) as fiches_importees;\n');
  process.stdout.write('drop function public.natty_importer_fiches(jsonb);\n');
}
