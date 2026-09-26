-- ═══════════════════════════════════════════════════════════
-- CRM Natty — session 06 : mapping minuté, chrono, stocks
-- (docs/crm-sessions/06-en-cuisine.md, docs/crm-spec.md § 4.1/§5)
-- ───────────────────────────────────────────────────────────
-- Choix de profondeur, tranché avec Pablo (25/09/2026) : un mapping
-- SIMPLE, natif au CRM — pas un portage de assets/admin-production.js
-- (PERT, ateliers partagés, répartition optimale entre cuisiniers). Ce
-- module-là reste dans admin.html, documenté à part dans CLAUDE.md §3 ;
-- le reconstruire ici recréerait deux systèmes qui divergeraient au
-- premier ajustement, exactement le défaut qu'a payé api/_nutrition.js.
--
-- Une seule nouvelle table plutôt que les trois du schéma cible de la
-- spec (`session_recettes`, `session_postes`, `session_taches`) :
--   • session_recettes — inutile en plus, les volumes se lisent déjà
--     depuis bons_attributions du bloc de la session (comme
--     actionListeCourses/listeCoursesJours le font déjà) ;
--   • session_postes — fusionné : chaque étape porte directement son
--     `assigne` (une personne), pas de table de jointure à part pour
--     « qui tient quel poste » dans ce modèle volontairement simple.
--
-- ⚠️ ORDRE D'EXÉCUTION : après 0008 (contacts_interactions) — lit
-- `crm_sessions`, `recettes`, `recettes_etapes`, `bons_commande`, `staff`.
-- ═══════════════════════════════════════════════════════════

-- § 1. Chrono de session — début/fin réels, pour « temps restant sur le
--      créneau réservé » et le calcul des durées réelles moyennes.
alter table public.crm_sessions add column if not exists demarree_le timestamptz;
alter table public.crm_sessions add column if not exists terminee_le timestamptz;

-- § 2. Les étapes d'une session — le mapping minuté lui-même.
--      Générées depuis `recettes_etapes` (phase='production', déjà en
--      base avec geste/aliment/poste/depend_de — CLAUDE.md §3) pour la
--      partie « par recette », et une ligne par (bon, recette) pour la
--      partie « par bon de commande à l'assemblage ». `depend_de`
--      référence d'autres lignes de CETTE session (traduit depuis les
--      `numero` de la fiche au moment de la génération), jamais
--      `recettes_etapes.id` directement — la même fiche sert à plusieurs
--      sessions, chacune avec son propre état d'avancement.
create table if not exists public.crm_session_etapes (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.crm_sessions(id) on delete cascade,
  recette_id        uuid references public.recettes(id) on delete set null,
  bon_id            uuid references public.bons_commande(id) on delete cascade,
  etape_source_id   uuid references public.recettes_etapes(id) on delete set null,
  phase             text not null default 'production' check (phase in ('production','assemblage')),
  titre             text not null,
  poste             text,
  ordre             int not null default 0,
  duree_prevue_min  int,
  duree_reelle_min  int,
  debut_reel        timestamptz,
  assigne           text references public.staff(user_id),
  statut            text not null default 'a_faire' check (statut in ('a_faire','en_cours','fait')),
  depend_de         uuid[] not null default '{}',
  created_at        timestamptz not null default now()
);
create index if not exists crm_session_etapes_session_idx on public.crm_session_etapes(session_id);
create index if not exists crm_session_etapes_recette_idx on public.crm_session_etapes(recette_id, titre)
  where statut = 'fait'; -- sert la moyenne des durées réelles à la génération suivante (§4.1 « améliore les estimations »)

alter table public.crm_session_etapes enable row level security;
create policy crm_session_etapes_staff on public.crm_session_etapes
  for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 3. Vérification, à lancer après exécution :
--   select column_name from information_schema.columns
--    where table_name='crm_sessions' and column_name in ('demarree_le','terminee_le');
--   -- doit rendre les deux lignes
--   select count(*) from crm_session_etapes; -- doit rendre 0 (table neuve)
