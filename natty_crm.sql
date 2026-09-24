-- ═══════════════════════════════════════════════════════════
-- Natty CRM — projets, tâches, schémas et drive par activité
-- ───────────────────────────────────────────────────────────
-- POURQUOI. `crm.html` est le tableau de bord interne (Finance, Partenariat,
-- Commercial, Développement, Logistique) : accueil avec les échéances les
-- plus urgentes, une page par activité (tâches de routine à valider, tâches
-- triées par priorité/échéance, sous-projets, drive de documents/liens, un
-- schéma de blocs éditable et reliable), et un schéma global des échéances
-- sur l'accueil.
--
-- Rien ici ne concerne les clients de l'app Natty : c'est un outil d'équipe,
-- au même titre que `admin.html`. Même schéma d'authentification (Supabase
-- Auth + table `staff`, voir natty_staff.sql), même garde `est_staff()`.
--
-- ⚠️ ORDRE D'EXÉCUTION : après natty_staff.sql (la fonction est_staff() et la
-- table staff doivent déjà exister).
-- ═══════════════════════════════════════════════════════════


-- § 1. Les rôles du CRM s'ajoutent à ceux d'admin.html sur la MÊME table
--      `staff` — une personne peut très bien être chef ET commercial, mais un
--      compte = un rôle, comme pour le reste de l'équipe. Migration additive :
--      on ne retire aucun rôle existant.
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (
  role in ('admin','nutritionniste','chef','logistique',
           'commercial','finance','partenariat','developpement')
);

-- § 1 bis. Pour assigner une tâche à un collègue, il faut pouvoir lire LA
--      LISTE de l'équipe — pas seulement sa propre ligne. `staff_lire_soi`
--      (natty_staff.sql) ne suffit pas : c'est la policy qui empêchait de
--      remplir un menu « porteur ». Elle reste ; celle-ci s'ajoute (les
--      policies SELECT se cumulent en OR, aucune des deux ne remplace
--      l'autre). Aucune donnée sensible dans staff (pas de mot de passe,
--      pas d'email) : l'ouvrir à toute l'équipe active ne coûte rien.
drop policy if exists staff_lire_equipe on public.staff;
create policy staff_lire_equipe on public.staff
  for select to authenticated
  using (public.est_staff());


-- § 2. Les activités — les tuiles de l'accueil. Clé texte stable (utilisée
--      partout en clé étrangère), pas d'uuid : elle vit dans les URLs et le
--      code du client, une clé lisible évite un aller-retour de plus.
create table if not exists public.crm_activites (
  cle     text primary key,
  nom     text not null,
  icone   text not null,   -- clé dans l'objet ICON{} côté client (pas de SVG en base)
  couleur text,            -- teinte de la tuile ('ink'/'blue'/'violet'/'green'/'amber')
  ordre   int not null default 0
);

insert into public.crm_activites (cle, nom, icone, couleur, ordre) values
  ('commercial',     'Commercial',     'pipe',        'blue',   1),
  ('finance',        'Finance',        'tresorerie',  'green',  2),
  ('partenariat',    'Partenariat',    'comptes',     'violet', 3),
  ('developpement',  'Développement',  'roadmap',     'ink',    4),
  ('logistique',     'Logistique',     'commandes',   'amber',  5)
on conflict (cle) do nothing;


-- § 3. Sous-projets d'une activité.
create table if not exists public.crm_projets (
  id          uuid primary key default gen_random_uuid(),
  activite    text not null references public.crm_activites(cle),
  nom         text not null,
  description text,
  statut      text not null default 'actif' check (statut in ('actif','en_pause','termine','abandonne')),
  avancement  int not null default 0 check (avancement between 0 and 100),
  echeance    date,
  cree_par    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists crm_projets_activite_idx on public.crm_projets(activite);


-- § 4. Les tâches — le cœur de l'outil. `routine` distingue les tâches
--      récurrentes à valider en priorité (le « héros » de la page d'activité,
--      demandé explicitement) des tâches de projet normales.
create table if not exists public.crm_taches (
  id          uuid primary key default gen_random_uuid(),
  activite    text not null references public.crm_activites(cle),
  projet_id   uuid references public.crm_projets(id) on delete set null,
  titre       text not null,
  description text,
  porteur     text,        -- staff.nom, texte libre pour rester lisible sans jointure
  priorite    text not null default 'moyenne' check (priorite in ('haute','moyenne','basse')),
  echeance    date,
  statut      text not null default 'a_faire' check (statut in ('a_faire','en_cours','bloque','fait')),
  routine     boolean not null default false,
  ordre       int not null default 0,
  cree_par    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists crm_taches_activite_idx on public.crm_taches(activite);
create index if not exists crm_taches_projet_idx on public.crm_taches(projet_id);
create index if not exists crm_taches_echeance_idx on public.crm_taches(echeance) where statut <> 'fait';


-- § 5. L'historique d'une tâche — le fil qu'on lit en cliquant dessus.
--      `type='schema'` range un schéma (mêmes blocs/liens qu'un schéma
--      d'activité, mais figés : un JSON, pas des lignes vivantes) pour
--      illustrer un raisonnement passé sans polluer le schéma courant.
create table if not exists public.crm_taches_historique (
  id          uuid primary key default gen_random_uuid(),
  tache_id    uuid not null references public.crm_taches(id) on delete cascade,
  auteur      text,
  type        text not null default 'texte' check (type in ('texte','statut','schema')),
  contenu     text,        -- texte libre, ou JSON sérialisé si type='schema'
  created_at  timestamptz not null default now()
);
create index if not exists crm_taches_historique_tache_idx on public.crm_taches_historique(tache_id);


-- § 6. Le drive — liens et fichiers, rattachés à une activité, un projet ou
--      une tâche (les trois sont facultatifs mais au moins un devrait être
--      renseigné ; pas de contrainte stricte, ça vaut mieux qu'un document
--      refusé silencieusement lors d'un import pressé).
create table if not exists public.crm_documents (
  id          uuid primary key default gen_random_uuid(),
  activite    text references public.crm_activites(cle),
  projet_id   uuid references public.crm_projets(id) on delete cascade,
  tache_id    uuid references public.crm_taches(id) on delete cascade,
  nom         text not null,
  url         text not null,
  type        text,        -- 'lien' / 'pdf' / 'sheet' / 'doc' / 'image' / 'autre'
  dossier     text,        -- regroupement libre ("Contrats", "Juridique"…)
  ajoute_par  text,
  created_at  timestamptz not null default now()
);
create index if not exists crm_documents_activite_idx on public.crm_documents(activite);
create index if not exists crm_documents_projet_idx on public.crm_documents(projet_id);
create index if not exists crm_documents_tache_idx on public.crm_documents(tache_id);


-- § 7. Le schéma éditable d'une activité (ou d'un projet) — les blocs.
--      x/y en pourcentage du canevas (0-100), pas en pixels : un canevas
--      redimensionné (mobile vs bureau) ne doit pas éparpiller les blocs
--      hors champ.
create table if not exists public.crm_schema_blocs (
  id          uuid primary key default gen_random_uuid(),
  activite    text not null references public.crm_activites(cle),
  projet_id   uuid references public.crm_projets(id) on delete set null,
  titre       text not null,
  icone       text,
  echeance    date,
  statut      text not null default 'a_venir' check (statut in ('a_venir','en_cours','fait','bloque')),
  x           numeric not null default 10,
  y           numeric not null default 10,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists crm_schema_blocs_activite_idx on public.crm_schema_blocs(activite);

-- § 8. Les liens entre blocs (glisser pour relier). Un lien n'a pas de sens
--      dans les deux ordres à la fois pour l'affichage (flèche source→cible),
--      mais l'unicité est vérifiée dans les deux sens pour éviter un double
--      trait A→B et B→A qui se superposeraient.
create table if not exists public.crm_schema_liens (
  id          uuid primary key default gen_random_uuid(),
  bloc_source uuid not null references public.crm_schema_blocs(id) on delete cascade,
  bloc_cible  uuid not null references public.crm_schema_blocs(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint crm_schema_liens_pas_soi check (bloc_source <> bloc_cible),
  constraint crm_schema_liens_uniq unique (bloc_source, bloc_cible)
);


-- § 9. RLS — équipe seulement, comme `production_postes`/`production_etapes`
--      (natty_production.sql) : ce sont des données internes, pas de policy
--      « soi seulement » qui n'aurait aucun sens ici (une tâche assignée à
--      Anatole doit rester visible à Pablo).
alter table public.crm_activites          enable row level security;
alter table public.crm_projets            enable row level security;
alter table public.crm_taches             enable row level security;
alter table public.crm_taches_historique  enable row level security;
alter table public.crm_documents          enable row level security;
alter table public.crm_schema_blocs       enable row level security;
alter table public.crm_schema_liens       enable row level security;

create policy crm_activites_staff   on public.crm_activites   for select to authenticated using (public.est_staff());
create policy crm_projets_staff     on public.crm_projets     for all    to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_taches_staff      on public.crm_taches      for all    to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_historique_staff  on public.crm_taches_historique for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_documents_staff   on public.crm_documents   for all    to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_blocs_staff       on public.crm_schema_blocs for all   to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_liens_staff       on public.crm_schema_liens for all   to authenticated using (public.est_staff()) with check (public.est_staff());


-- § 10. Vérification, à lancer après exécution (à la clé anon, ça doit tout
--       refuser ; avec une session d'équipe, ça doit tout lire) :
--   select cle, nom from crm_activites order by ordre;
--   select count(*) from crm_taches;
