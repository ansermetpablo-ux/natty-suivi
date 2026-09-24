-- ═══════════════════════════════════════════════════════════
-- Natty CRM v2 — collaborateur assignable, catégories d'événement,
-- tâche auto-créée depuis un bloc, position des projets sur le
-- mapping général
-- ───────────────────────────────────────────────────────────
-- POURQUOI. L'accueil de crm.html devient le récap de tous les projets
-- (+ un onglet « Mapping général », une carte glissable de tous les
-- projets) ; chaque projet a désormais sa PROPRE page (synthèse, drive,
-- schéma) au lieu d'un tiroir ; et créer un bloc de schéma ou un projet
-- doit permettre d'assigner un collaborateur — pour un bloc, ça crée EN
-- PLUS une tâche dans le tableau de cette personne.
--
-- Additif : ne touche à aucune ligne existante. À exécuter après
-- natty_crm.sql.
-- ═══════════════════════════════════════════════════════════

-- § 1. Le projet a un responsable, et une position sur le mapping général
--      (le canevas de l'accueil qui montre TOUS les projets, glissables,
--      indépendamment de leur activité). x/y en pourcentage comme pour
--      les blocs de schéma — voir natty_crm.sql § 7 pour le raisonnement.
alter table public.crm_projets add column if not exists responsable text;
alter table public.crm_projets add column if not exists x numeric;
alter table public.crm_projets add column if not exists y numeric;

-- § 2. Le bloc de schéma porte désormais un collaborateur, une catégorie,
--      et le lien vers la tâche qu'il a fait naître.
--      `on delete set null` : supprimer la tâche ne doit pas faire
--      disparaître le bloc qui l'a créée, seulement son lien vers elle.
alter table public.crm_schema_blocs add column if not exists porteur text;
alter table public.crm_schema_blocs add column if not exists categorie text;
alter table public.crm_schema_blocs add column if not exists tache_id uuid references public.crm_taches(id) on delete set null;

alter table public.crm_schema_blocs drop constraint if exists crm_schema_blocs_categorie_check;
alter table public.crm_schema_blocs add constraint crm_schema_blocs_categorie_check
  check (categorie is null or categorie in ('reunion','decision','livrable','jalon','risque','autre'));

-- § 3. Un bloc peut maintenant vivre SOUS un projet (schéma propre au
--      projet) plutôt que seulement sous une activité (schéma partagé de
--      toute l'activité, pour ce qui ne dépend d'aucun projet précis).
--      La colonne existe déjà (natty_crm.sql § 7) — rien à ajouter ici,
--      c'est le client qui filtre désormais par `projet_id` en plus de
--      `activite`.

-- § 4. Vérification, à lancer après exécution :
--   select column_name from information_schema.columns
--   where table_name='crm_projets' and column_name in ('responsable','x','y');
--   select column_name from information_schema.columns
--   where table_name='crm_schema_blocs' and column_name in ('porteur','categorie','tache_id');
