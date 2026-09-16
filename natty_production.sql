-- ═══════════════════════════════════════════════════════════════════════════
-- natty_production.sql — les bons de commande, leur attribution en recettes,
-- et ce qu'il faut aux fiches techniques pour piloter une journée de production.
--
-- À exécuter dans Supabase → SQL Editor, D'UN SEUL BLOC (les commentaires `--`
-- passent dans un bloc collé entier ; c'est requête par requête qu'ils cassent).
--
-- CE QUE ÇA CRÉE
--   1. `bons_commande`      — UN bon = ce qu'un client a acheté pour UNE
--                             livraison : combien de repas, quel jour, où.
--                             Écrit par le webhook Stripe (abonnement et achat à
--                             l'unité), par l'admin (bon manuel, ou génération
--                             depuis les abonnements actifs).
--   2. `bons_attributions`  — quelle recette, pour combien de portions, à quelle
--                             cible calorique. C'est l'admin qui attribue.
--   3. `recettes_etapes`    — trois colonnes de plus, pour que la fiche
--                             technique dise QUAND et COMMENT chaque étape se
--                             produit : `duree_min` existait déjà ; s'ajoutent
--                             `phase` (production en masse / assemblage par
--                             personne), `passif` (attente : four, repos,
--                             marinade — le cuisinier est libre pendant ce
--                             temps) et `poste` (libre : « four », « plan 1 »).
--
-- POURQUOI UNE TABLE `bons_commande` ET PAS `commandes` / `offres_clients`
--   `commandes` porte des `plats_choisis` (uuid[]) et une `semaine`, mais ni le
--   jour de livraison, ni l'adresse, ni le nombre de repas ; `offres_clients`
--   est un reliquat de juin 2026 que plus rien n'écrit. Et surtout, jusqu'ici
--   le jour et l'adresse de livraison saisis dans offre.html N'ÉTAIENT ÉCRITS
--   NULLE PART — ils partaient à /api/checkout qui les ignorait. Le bon est la
--   première trace de ce qu'un client attend, et le webhook le crée au paiement.
--
-- RLS : l'équipe (est_staff(), natty_staff.sql) lit et écrit tout ; un membre
-- lit SES bons ; la clé service (webhook) passe au-dessus.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.bons_commande (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  type            text not null default 'manuel'
                  check (type in ('abonnement','unite','manuel')),
  nb_repas        integer not null check (nb_repas between 1 and 40),
  jour_livraison  date,
  semaine         date,
  adresse         text,
  plats           jsonb,
  statut          text not null default 'a_attribuer'
                  check (statut in ('a_attribuer','attribue','en_production','livre','annule')),
  abonnement_id   uuid,
  stripe_ref      text unique,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bons_commande_jour_idx on public.bons_commande (jour_livraison);
create index if not exists bons_commande_user_idx on public.bons_commande (user_id);

create table if not exists public.bons_attributions (
  id            uuid primary key default gen_random_uuid(),
  bon_id        uuid not null references public.bons_commande(id) on delete cascade,
  recette_id    uuid not null references public.recettes(id) on delete restrict,
  nb_portions   integer not null check (nb_portions > 0),
  kcal_portion  integer,
  facteur       numeric,
  created_at    timestamptz not null default now(),
  unique (bon_id, recette_id)
);

alter table public.recettes_etapes add column if not exists phase  text not null default 'production';
alter table public.recettes_etapes add column if not exists passif boolean not null default false;
alter table public.recettes_etapes add column if not exists poste  text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recettes_etapes_phase_check') then
    alter table public.recettes_etapes
      add constraint recettes_etapes_phase_check check (phase in ('production','assemblage'));
  end if;
end $$;

alter table public.bons_commande     enable row level security;
alter table public.bons_attributions enable row level security;

drop policy if exists bons_commande_staff on public.bons_commande;
create policy bons_commande_staff on public.bons_commande
  for all to authenticated
  using (public.est_staff()) with check (public.est_staff());

drop policy if exists bons_commande_soi on public.bons_commande;
create policy bons_commande_soi on public.bons_commande
  for select to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists bons_attributions_staff on public.bons_attributions;
create policy bons_attributions_staff on public.bons_attributions
  for all to authenticated
  using (public.est_staff()) with check (public.est_staff());

drop policy if exists bons_attributions_soi on public.bons_attributions;
create policy bons_attributions_soi on public.bons_attributions
  for select to authenticated
  using (exists (select 1 from public.bons_commande b
                  where b.id = bon_id and b.user_id = auth.uid()::text));

-- Vérification : les deux tables répondent, et les trois colonnes sont là.
-- select count(*) from public.bons_commande;
-- select column_name from information_schema.columns
--  where table_name = 'recettes_etapes' and column_name in ('phase','passif','poste');

-- ── Ajout du 2026-09-16 (déjà appliqué) : le GESTE et l'ALIMENT de chaque étape.
-- C'est ce que l'onglet Production trie : « couper » × « oignons » sur trois
-- recettes du même jour se fait en une fois. Vocabulaire des gestes = les 16
-- d'assets/recette.js ; l'aliment est un texte libre (« oignons, carottes »).
alter table public.recettes_etapes add column if not exists geste text;
alter table public.recettes_etapes add column if not exists aliment text;

-- ── Ajout du 2026-09-16 (déjà appliqué) : les POSTES pris par les cuisiniers,
-- et les étapes faites. Un poste pris un jour donné n'est plus disponible pour
-- un autre cuisinier (clé primaire jour + poste) ; l'algorithme ne donne les
-- tâches d'un poste qu'à la personne qui l'a pris. Les étapes faites sont
-- partagées entre appareils : la cinématique d'un cuisinier les coche.
create table if not exists public.production_postes (
  jour           date not null,
  poste          text not null,
  cuisinier_id   text not null,
  cuisinier_nom  text,
  pris_at        timestamptz not null default now(),
  primary key (jour, poste)
);
create table if not exists public.production_etapes (
  jour           date not null,
  etape_id       uuid not null references public.recettes_etapes(id) on delete cascade,
  fait           boolean not null default true,
  cuisinier_nom  text,
  fait_at        timestamptz not null default now(),
  primary key (jour, etape_id)
);
alter table public.production_postes enable row level security;
alter table public.production_etapes enable row level security;
create policy production_postes_staff on public.production_postes for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy production_etapes_staff on public.production_etapes for all to authenticated using (public.est_staff()) with check (public.est_staff());
