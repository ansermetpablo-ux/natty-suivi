-- ═══════════════════════════════════════════════════════════════════════════
-- natty_production_ateliers.sql — deux colonnes de plus sur les étapes des
-- fiches techniques, pour l'onglet Production (assets/admin-production.js).
--
-- À exécuter dans Supabase → SQL Editor, d'un seul bloc. Idempotent.
--
-- ⚠️ L'ONGLET MARCHE SANS CE FICHIER. Les dépendances sont INFÉRÉES de
-- l'aliment et du geste, la découpe est LUE dans le titre et la consigne. Ces
-- deux colonnes servent à corriger la lecture quand elle se trompe :
--
--   `depend_de`  int[]  — les NUMÉROS des étapes (de la même recette) que
--                         celle-ci attend. Vide/null : l'inférence décide.
--                         Ex. « Mijoter » {2,4} attend l'étape 2 ET l'étape 4,
--                         quel que soit leur aliment. Seules des étapes
--                         PRÉCÉDENTES sont retenues à la lecture : une boucle
--                         est impossible par construction.
--   `decoupe`    text   — comment tailler (« julienne », « dés de 1 cm »).
--                         Portée par l'atelier partagé : quand le curry et le
--                         wrap coupent tous deux des carottes, chaque recette
--                         affiche SA découpe, et « Spécifier » en rouge tant
--                         que ni cette colonne ni la consigne ne la disent.
--                         Écrite depuis le PERT (bouton Spécifier) ou depuis
--                         l'onglet Chef.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.recettes_etapes add column if not exists depend_de int[];
alter table public.recettes_etapes add column if not exists decoupe   text;

comment on column public.recettes_etapes.depend_de is 'Numéros des étapes de la même recette que celle-ci attend. Null : inféré de l''aliment et du geste (admin-production.js, dependances()).';
comment on column public.recettes_etapes.decoupe   is 'Comment tailler (julienne, dés…). Null : lu dans titre/description, sinon « Spécifier » en rouge dans l''atelier.';

-- Vérification : les deux colonnes répondent.
-- select column_name, data_type from information_schema.columns
--  where table_name = 'recettes_etapes' and column_name in ('depend_de','decoupe');
