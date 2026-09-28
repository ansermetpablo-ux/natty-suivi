-- ═══════════════════════════════════════════════════════════
-- CRM Natty — inventaire de fin de session, production réelle, plats en plus
-- (28/09/2026)
-- ───────────────────────────────────────────────────────────
-- Demande de Pablo :
--  1. Après chaque session de production, un INVENTAIRE de toutes les
--     matières premières alimentaires, qui met à jour les stocks.
--  2. Dans Opérationnel, la production RÉELLE d'une session : ce qui est
--     sorti de la cuisine (10 L de bourguignon = 30 portions ; 5 kg de riz,
--     2 kg de poulet… = 10 portions complètes et 10 à compléter).
--  3. Financement → Produits : les repas faits EN PLUS des commandes,
--     disponibles à la vente, qu'on assigne à une commande. Chaque plat
--     assigné reçoit un numéro et un nom (« curry266 »), affiché en
--     pastille dans les commandes et dans la production.
-- ═══════════════════════════════════════════════════════════

-- § 1. stocks_mp ne connaissait que des kilos (`quantite_kg`). L'inventaire
--      compte aussi des litres et des pièces : la colonne `unite` dit en quoi
--      `quantite_kg` est exprimée. Défaut 'kg' : toutes les lignes existantes
--      restent des kilos, rien ne change pour admin.html.
alter table public.stocks_mp add column if not exists unite text not null default 'kg';
alter table public.stocks_mp drop constraint if exists stocks_mp_unite_check;
alter table public.stocks_mp add constraint stocks_mp_unite_check check (unite in ('kg','L','pièce'));

-- § 2. L'inventaire d'une session : une ligne par aliment compté. Garde le
--      stock d'avant, l'attendu et le compté — l'écart se relit plus tard.
--      Le stock lui-même est réécrit dans stocks_mp (voir crm-produits.js).
create table if not exists public.crm_session_inventaire (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.crm_sessions(id) on delete cascade,
  ingredient_nom    text not null,
  unite             text not null default 'kg',
  stock_avant       numeric,
  achete            numeric,
  utilise           numeric,
  attendu           numeric,
  compte            numeric not null check (compte >= 0),
  par               text,
  created_at        timestamptz not null default now()
);
create index if not exists crm_session_inventaire_session_idx on public.crm_session_inventaire(session_id);
alter table public.crm_session_inventaire enable row level security;
drop policy if exists crm_session_inventaire_staff on public.crm_session_inventaire;
create policy crm_session_inventaire_staff on public.crm_session_inventaire for all to authenticated using (public.est_staff()) with check (public.est_staff());
alter table public.crm_sessions add column if not exists inventaire_le timestamptz;

-- § 3. La production réelle d'une session, saisie dans Opérationnel :
--      { recette_id: { mode: 'ingredients'|'global',
--                      ings: { aliment: {v, u} },       -- mode ingrédients
--                      total: {v, u}, portion: {v, u}, portions: n } }  -- mode global
alter table public.crm_sessions add column if not exists production_reelle jsonb;

-- § 4. Les plats en plus assignés à une commande. Un plat = une portion,
--      avec son numéro (séquence globale) et son code « curry266 ».
--      `remplace` dit ce que le plat a pris dans la commande cible, pour
--      pouvoir le rendre à l'identique quand on le retire :
--        'attribution' — une portion d'une recette attribuée (bons_attributions
--                        décrémenté ; la ligne d'avant est dans attribution_avant),
--        'libre'       — un repas pas encore attribué,
--        'en_plus'     — un repas de plus (bons_commande.nb_repas + 1).
create table if not exists public.crm_plats (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint generated always as identity,
  prefixe             text not null,
  code                text,
  session_id          uuid references public.crm_sessions(id) on delete set null,
  recette_id          uuid references public.recettes(id) on delete set null,
  recette_nom         text,
  bon_id              uuid not null references public.bons_commande(id) on delete cascade,
  remplace            text not null default 'attribution' check (remplace in ('attribution','libre','en_plus')),
  remplace_recette_id uuid,
  attribution_avant   jsonb,
  produit_le          date,
  par                 text,
  created_at          timestamptz not null default now()
);
create unique index if not exists crm_plats_numero_idx on public.crm_plats(numero);
-- Le code se pose à l'insertion, une fois le numéro tiré (trigger plutôt
-- qu'une colonne générée : le numéro vient lui-même d'une identité).
create or replace function public.crm_plats_code() returns trigger language plpgsql as $$
begin
  new.code := new.prefixe || new.numero::text;
  return new;
end $$;
drop trigger if exists crm_plats_code_trg on public.crm_plats;
create trigger crm_plats_code_trg before insert on public.crm_plats for each row execute function public.crm_plats_code();
create index if not exists crm_plats_bon_idx on public.crm_plats(bon_id);
create index if not exists crm_plats_session_idx on public.crm_plats(session_id, recette_id);
alter table public.crm_plats enable row level security;
drop policy if exists crm_plats_staff on public.crm_plats;
create policy crm_plats_staff on public.crm_plats for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 5. Vérification :
--   select column_name from information_schema.columns where table_name='stocks_mp' and column_name='unite'; -- 1
--   select column_name from information_schema.columns where table_name='crm_sessions' and column_name in ('inventaire_le','production_reelle'); -- 2
--   insert into crm_plats (prefixe, bon_id) values ('test', (select id from bons_commande limit 1)) returning code; -- test1
--   (puis supprimer la ligne de test)
