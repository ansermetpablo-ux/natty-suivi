-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Journal des actions (26/10/2026)
-- ───────────────────────────────────────────────────────────
-- Refonte Natty OS (maquette v3) : « qui a fait quoi, quand, dans quel
-- module. Rien ne s'efface. »
--
-- Une ligne par action d'équipe, écrite par crm.html à chaque création,
-- modification ou suppression qui passe par sb() (voir JOURNAL_TABLES).
-- Des écritures en rafale sur la même table (20 attributions d'une
-- commande) sont regroupées côté page en UNE ligne, `nb` les compte.
--
-- Rien ne s'efface : la policy n'ouvre que SELECT et INSERT. Aucune
-- policy UPDATE ni DELETE — un journal qu'on peut réécrire ne prouve rien.
-- Un INSERT ne peut porter que son propre auteur (auteur_id = auth.uid()),
-- pour qu'on ne puisse pas attribuer une action à quelqu'un d'autre.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.crm_journal (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  auteur_id    uuid not null default auth.uid(),
  auteur_nom   text,
  module       text not null,
  action       text not null,
  type         text not null default 'modification'
               check (type in ('creation','modification','suppression','enregistrement','fait','info')),
  table_cible  text,
  objet_id     text,
  nb           integer not null default 1 check (nb >= 1),
  page         text
);
create index if not exists crm_journal_created_idx on public.crm_journal(created_at desc);
create index if not exists crm_journal_module_idx on public.crm_journal(module);

alter table public.crm_journal enable row level security;

drop policy if exists crm_journal_lecture on public.crm_journal;
create policy crm_journal_lecture on public.crm_journal
  for select to authenticated using (public.est_staff());

drop policy if exists crm_journal_ecriture on public.crm_journal;
create policy crm_journal_ecriture on public.crm_journal
  for insert to authenticated
  with check (public.est_staff() and auteur_id = auth.uid());

-- Retour arrière (à la main, si besoin) :
--   drop table if exists public.crm_journal;
