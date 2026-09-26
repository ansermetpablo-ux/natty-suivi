-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Finance : tableau des sessions, équipe de cuisine, pièces
-- (26/09/2026)
-- ───────────────────────────────────────────────────────────
-- Suite de 0016. Deux manques pour le tableau d'Opérationnel :
--  1. Les PIÈCES justificatives ne sont plus seulement des factures Metro :
--     une session a trois sortes de pièces (achats de matières, cuisine,
--     vente) et en a plusieurs de chaque. `factures_fournisseur` porte
--     déjà le fichier (`fichier_url`) et le montant — il lui manque la
--     catégorie et le nom du fichier d'origine. La pastille « reliée » du
--     tableau s'allume quand les trois catégories sont présentes.
--  2. L'ÉQUIPE de cuisine d'une session : postes, nombre, taux horaire et
--     heures — prévus d'un côté, réellement payés de l'autre. Le coût
--     cuisine devient location (0016) + équipe.
-- ═══════════════════════════════════════════════════════════

-- § 1. Pièces : catégorie + nom de fichier. Les lignes existantes (aucune
--      à ce jour) sont des achats de matières : défaut 'mp'.
alter table public.factures_fournisseur add column if not exists categorie text not null default 'mp';
alter table public.factures_fournisseur drop constraint if exists factures_fournisseur_categorie_check;
alter table public.factures_fournisseur add constraint factures_fournisseur_categorie_check check (categorie in ('mp','cuisine','vente'));
alter table public.factures_fournisseur add column if not exists fichier_nom text;

-- § 2. Équipe de cuisine d'une session. `heures_prevues` NULL = les
--      heures de cuisine de la session (calculées ou saisies dans Finance).
create table if not exists public.crm_session_equipe (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.crm_sessions(id) on delete cascade,
  poste               text,
  nb                  integer not null default 1 check (nb >= 0),
  taux_horaire_prevu  numeric check (taux_horaire_prevu >= 0),
  heures_prevues      numeric check (heures_prevues >= 0),
  taux_horaire_reel   numeric check (taux_horaire_reel >= 0),
  heures_reelles      numeric check (heures_reelles >= 0),
  created_at          timestamptz not null default now()
);
create index if not exists crm_session_equipe_session_idx on public.crm_session_equipe(session_id);
alter table public.crm_session_equipe enable row level security;
drop policy if exists crm_session_equipe_staff on public.crm_session_equipe;
create policy crm_session_equipe_staff on public.crm_session_equipe for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 3. Vérification :
--   select column_name from information_schema.columns where table_name='factures_fournisseur' and column_name in ('categorie','fichier_nom'); -- 2
--   select count(*) from crm_session_equipe; -- 0
