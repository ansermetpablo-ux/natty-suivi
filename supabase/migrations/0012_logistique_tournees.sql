-- ═══════════════════════════════════════════════════════════
-- CRM Natty — session 07 : étiquettes, tournées, rangement
-- (docs/crm-sessions/07-logistique.md, docs/crm-spec.md § 5 LOGISTIQUE)
-- ───────────────────────────────────────────────────────────
-- Deux tables, comme le schéma cible de la spec (`tournees`,
-- `tournee_arrets`), préfixées `crm_` par cohérence avec le reste du
-- moteur CRM (crm_sessions, crm_taches…) plutôt que les noms nus du §5,
-- qui datent d'avant cette convention.
--
-- `bons_commande.arret_id` porte le lien bon → arrêt, sur le MÊME
-- principe que `bloc_id`/`session_id` déjà posés (0009/0010) : étendre
-- la table existante plutôt qu'inventer une jointure séparée pour « quel
-- bon est dans quel arrêt » — un arrêt B2B qui regroupe cinq bons n'a
-- besoin que d'une colonne sur chacun, pas d'une table à cinq lignes.
--
-- `bons_commande.contact_nom/contact_tel/instructions_acces` : la spec
-- demande ces informations sur l'arrêt (§4, feature 2), mais elles
-- varient en réalité PAR BON pour un même arrêt B2B (chaque commande
-- peut avoir un contact différent sur place) — portées sur le bon, un
-- arrêt les agrège à l'affichage plutôt que de forcer un contact unique
-- pour tout le lieu.
--
-- ⚠️ ORDRE D'EXÉCUTION : après 0010 (bons_commande.session_id) — pas de
-- dépendance directe, juste la suite chronologique des colonnes ajoutées
-- à bons_commande.
-- ═══════════════════════════════════════════════════════════

-- § 1. Contact et instructions, par bon (voir note ci-dessus).
alter table public.bons_commande add column if not exists contact_nom text;
alter table public.bons_commande add column if not exists contact_tel text;
alter table public.bons_commande add column if not exists instructions_acces text;

-- § 2. Tournées — une par jour de livraison (créneau par défaut 11h-13h,
--      § 1 de la spec : « créneau imposé 11 h-13 h »).
create table if not exists public.crm_tournees (
  id             uuid primary key default gen_random_uuid(),
  jour           date not null,
  creneau_debut  time not null default '11:00',
  creneau_fin    time not null default '13:00',
  livreur        text references public.staff(user_id),
  statut         text not null default 'a_preparer' check (statut in ('a_preparer','confirmee','en_cours','terminee')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists crm_tournees_jour_idx on public.crm_tournees(jour);

-- § 3. Arrêts — un par ADRESSE distincte de la tournée (§4 feature 2 :
--      « un lieu B2B regroupe tous ses bons en un seul arrêt » — le
--      regroupement se fait par adresse identique, il n'existe pas de
--      colonne « B2B » à part sur bons_commande pour distinguer
--      autrement). `ordre` porte l'ordre de tournée ; le plan de
--      rangement du livreur s'en déduit à l'affichage (chargé en ordre
--      INVERSE — le premier livré est chargé en dernier), pas stocké
--      séparément : ce serait la même donnée à tenir à jour deux fois.
create table if not exists public.crm_tournee_arrets (
  id                 uuid primary key default gen_random_uuid(),
  tournee_id         uuid not null references public.crm_tournees(id) on delete cascade,
  ordre              int not null default 0,
  adresse            text not null,
  statut             text not null default 'a_livrer' check (statut in ('a_livrer','livre','probleme')),
  livre_le           timestamptz,
  probleme_note      text,
  created_at         timestamptz not null default now()
);
create index if not exists crm_tournee_arrets_tournee_idx on public.crm_tournee_arrets(tournee_id);

alter table public.bons_commande add column if not exists arret_id uuid references public.crm_tournee_arrets(id) on delete set null;
create index if not exists bons_commande_arret_idx on public.bons_commande(arret_id);

-- § 4. RLS — même garde que le reste du CRM.
alter table public.crm_tournees        enable row level security;
alter table public.crm_tournee_arrets  enable row level security;
create policy crm_tournees_staff       on public.crm_tournees       for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_tournee_arrets_staff on public.crm_tournee_arrets for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 5. Vérification, à lancer après exécution :
--   select column_name from information_schema.columns
--    where table_name='bons_commande' and column_name in ('arret_id','contact_nom','contact_tel','instructions_acces');
--   -- doit rendre les 4 lignes
--   select count(*) from crm_tournees; select count(*) from crm_tournee_arrets; -- 0, table neuve
