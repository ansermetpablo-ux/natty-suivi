-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Finance : panneau Opérationnel (prévisionnel, marge, facture)
-- (26/09/2026)
-- ───────────────────────────────────────────────────────────
-- Trois besoins distincts :
--  1. Des tarifs MODIFIABLES sans redéploiement (spec §3.3 : « tous les
--     seuils sont dans une table de règles, jamais en dur ») — prix de
--     vente au plat (9 € abonnement / 10,50 € à l'unité, spec §1) et le
--     tarif horaire de la cuisine louée (30 €/h, jusqu'ici en dur à deux
--     endroits de crm.html : actionReserverCuisine et cout_previsionnel).
--  2. Deux réglages PAR SESSION, propres au panneau Finance : le nombre
--     d'heures de cuisine (par défaut déduit du mapping minuté, mais
--     éditable) et la répartition des repas vendus entre les deux
--     tarifs. NULL = calculé automatiquement ; le bouton « Réinitialiser »
--     du panneau remet les deux à NULL, jamais un DELETE de la session.
--  3. La facture Metro réelle, pour le rapprochement prévisionnel/réel.
--     Deux tables EXISTAIENT DÉJÀ en base, créées hors de toute migration
--     versionnée (`factures_fournisseur`, `lignes_facture` — RLS staff
--     déjà active sur les deux, vérifié avant d'écrire ce fichier) : elles
--     couvrent presque exactement ce besoin. Adoptées ici plutôt que
--     recréées à côté — leur seul manque est le rattachement à une
--     session, ajouté au §3.
--
-- ⚠️ Note sur les heures de cuisine estimées, à lire avant de faire
-- confiance au défaut que le panneau propose : `recettes_etapes.poste`
-- est NULL sur les 317 lignes en base (vérifié). `dureeMappingSession()`
-- retombe alors sur `geste` (couper/mijoter/dresser…, 14 valeurs
-- distinctes) comme s'il s'agissait de postes physiques, et fait un MAX
-- dessus — donc une hypothèse de 14 personnes en parallèle, largement
-- optimiste. C'est précisément pour ça que ce chantier rend les heures
-- ÉDITABLES plutôt que de les afficher comme un fait : Pablo corrige à
-- l'œil tant que `poste` n'est pas rempli fiche par fiche (chantier à
-- part, hors du périmètre d'aujourd'hui).
-- ═══════════════════════════════════════════════════════════

-- § 1. Tarifs — clé/valeur, RLS staff, seedés aux valeurs de la spec et
--      du code existant.
create table if not exists public.crm_tarifs (
  cle         text primary key,
  valeur      numeric not null,
  libelle     text,
  updated_at  timestamptz not null default now()
);
insert into public.crm_tarifs (cle, valeur, libelle) values
  ('prix_repas_abo',   9,    'Prix de vente — repas abonnement (9 € / plat)'),
  ('prix_repas_unite', 10.5, 'Prix de vente — repas à l''unité (10,50 € / plat)'),
  ('tarif_cuisine_h',  30,   'Tarif horaire de la cuisine louée (€/h, toute heure entamée due)')
on conflict (cle) do nothing;
alter table public.crm_tarifs enable row level security;
create policy crm_tarifs_staff on public.crm_tarifs for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 2. Deux réglages éditables par session.
alter table public.crm_sessions add column if not exists heures_cuisine_override numeric;
alter table public.crm_sessions add column if not exists nb_repas_unite_override integer;

-- § 3. Facture Metro — adoption des deux tables orphelines + rattachement
--      à une session (le seul manque). Colonnes existantes conservées
--      telles quelles.
alter table public.factures_fournisseur add column if not exists session_id uuid references public.crm_sessions(id) on delete set null;
create index if not exists factures_fournisseur_session_idx on public.factures_fournisseur(session_id);

-- § 4. Vérification, à lancer après exécution :
--   select count(*) from crm_tarifs; -- 3
--   select column_name from information_schema.columns where table_name='crm_sessions' and column_name in ('heures_cuisine_override','nb_repas_unite_override');
--   select column_name from information_schema.columns where table_name='factures_fournisseur' and column_name='session_id';
