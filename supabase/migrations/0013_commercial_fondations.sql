-- ═══════════════════════════════════════════════════════════
-- CRM Natty — session 11 : Commercial, fondations
-- (docs/crm-sessions/11-commercial-fondations.md, docs/crm-spec.md §4.3, §5)
-- ───────────────────────────────────────────────────────────
-- Le socle Commercial existant (crm_projets.etape_pipeline, crm_contacts,
-- crm_interactions — commit 5f0f647/7a4543e) couvrait « un deal EST un
-- sous-projet existant ». Cette migration ajoute ce qui manquait pour
-- que ce socle devienne le « système d'apprentissage » de la spec §4.3 :
-- les profils types et leur playbook, le bloc de suivi par étape avec
-- verdicts d'arguments, et les champs de fiche client qui en dépendent.
--
-- Même convention que le reste du dépôt : PAS de tables `comptes`/
-- `deals` séparées (le schéma cible §5 les nomme ainsi, mais
-- crm_projets EST déjà le compte/deal — en ajouter une autre créerait
-- deux sources pour la même idée, exactement ce que 5f0f647 refusait
-- déjà pour « Base de prospection »).
--
-- ⚠️ ORDRE D'EXÉCUTION : après 0012 (logistique) — pas de dépendance
-- directe, juste la suite chronologique.
-- ⚠️ Écrite et appliquée en DEUX passes (Supabase MCP) : la première
-- a échoué à l'insertion des deux comptes de départ, faute d'avoir
-- élargi `crm_projets_etape_pipeline_check` — encore la valeur des 6
-- anciennes étapes ad hoc, pas les 8 de la spec. Comme `apply_migration`
-- est transactionnel, l'échec a tout annulé (vérifié : aucune des
-- tables ci-dessous n'existait après le premier essai). Ce fichier est
-- la version REFAITE, la seule qui ait jamais tourné en base — la
-- correction du §3 bis est intégrée directement, pas ajoutée à part.
-- ═══════════════════════════════════════════════════════════

-- § 1. Profils types — le portrait, le langage, le playbook.
--      `sequence_pipeline` est CONSULTATIVE : la spec demande des étapes
--      « paramétrables par profil », mais un kanban partagé par tous les
--      deals ne peut montrer qu'UN seul jeu de colonnes à la fois sans
--      se fragmenter en plusieurs tableaux qui ne se compareraient plus
--      entre eux. `crm_projets.etape_pipeline` reste donc sur UNE
--      séquence commune (§ 3 bis, les 8 étapes par défaut de la spec) ;
--      `sequence_pipeline` ici est la séquence RECOMMANDÉE pour ce
--      profil, affichée sur sa fiche playbook, pas câblée au rendu du
--      kanban. Écart documenté, pas caché.
create table if not exists public.crm_profils_types (
  id                  uuid primary key default gen_random_uuid(),
  cle                 text not null unique,
  nom                 text not null,
  portrait            text,
  motivations         text,
  freins              text,
  langage_utiliser    text,
  langage_eviter      text,
  offre_recommandee   text,
  preuves             text,
  sequence_pipeline   jsonb not null default '[]',
  kit_documentaire    jsonb not null default '[]', -- liste de libellés de modèles ; le contenu réel est branché en session 17
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- § 2. Arguments du profil — le catalogue, avec ses compteurs (§4.3
--      feature 6 : « les verdicts incrémentent les compteurs »). Les
--      compteurs vivent SUR la ligne (lecture immédiate pour la vue
--      « arguments qui convertissent ») ; le détail de CHAQUE usage,
--      avec son verdict et son contexte, vit à part (§ 4, suivi_arguments)
--      — les deux ensemble évitent de choisir entre un total rapide à
--      lire et un historique qu'on peut auditer.
create table if not exists public.crm_profil_arguments (
  id           uuid primary key default gen_random_uuid(),
  profil_id    uuid not null references public.crm_profils_types(id) on delete cascade,
  argument     text not null,
  porte        int not null default 0,
  neutre       int not null default 0,
  rejete       int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists crm_profil_arguments_profil_idx on public.crm_profil_arguments(profil_id);

create table if not exists public.crm_profil_objections (
  id           uuid primary key default gen_random_uuid(),
  profil_id    uuid not null references public.crm_profils_types(id) on delete cascade,
  objection    text not null,
  reponse      text,
  created_at   timestamptz not null default now()
);
create index if not exists crm_profil_objections_profil_idx on public.crm_profil_objections(profil_id);

-- § 3. La fiche client (crm_projets étendu) — description et profil
--      obligatoires « à la création » (§4.3 feature 3) : appliqué côté
--      formulaire pour les deals Commercial spécifiquement, PAS en
--      contrainte `not null` sur la colonne — crm_projets sert aussi
--      Production/Finance/RH/etc., qui n'ont jamais eu de profil et ne
--      doivent subir aucune régression.
alter table public.crm_projets add column if not exists profil_id uuid references public.crm_profils_types(id);
alter table public.crm_projets add column if not exists budget numeric;
alter table public.crm_projets add column if not exists effectif int;
alter table public.crm_projets add column if not exists decideur text;
alter table public.crm_projets add column if not exists frequence text;
alter table public.crm_projets add column if not exists lieu_livraison text;

-- § 3 bis. Le pipeline passe des 6 étapes ad hoc (prospection/contact/
--          proposition/negociation/client/perdu, posées avant cette
--          session) aux 8 étapes par défaut de la spec (§4.3 feature 4)
--          + perdu. Vérifié avant d'élargir : AUCUN deal existant
--          (`select count(*) from crm_projets where activite='commercial'`
--          rendait 0) — rien à remapper.
alter table public.crm_projets drop constraint if exists crm_projets_etape_pipeline_check;
alter table public.crm_projets add constraint crm_projets_etape_pipeline_check check (
  etape_pipeline is null or etape_pipeline = any (array[
    'premier_contact','decouverte','degustation','proposition','test',
    'negociation','signature','client_recurrent','perdu'
  ])
);

-- § 4. Bloc de suivi par étape (§4.3 feature 5) — une ligne par
--      interaction commerciale, rattachée au deal ET à l'étape du
--      pipeline où elle a eu lieu (`etape`, une COPIE de
--      `crm_projets.etape_pipeline` au moment de la saisie — un deal qui
--      avance ne doit pas réécrire l'historique de ses suivis passés).
create table if not exists public.crm_suivi_etapes (
  id                 uuid primary key default gen_random_uuid(),
  projet_id          uuid not null references public.crm_projets(id) on delete cascade,
  etape              text not null,
  date               date not null default current_date,
  canal              text,
  interlocuteur      text,
  verbatims          text,
  besoins             text,
  objections         text,
  prochaine_action   text,
  echeance           date,
  cree_par           text,
  created_at         timestamptz not null default now()
);
create index if not exists crm_suivi_etapes_projet_idx on public.crm_suivi_etapes(projet_id);

create table if not exists public.crm_suivi_arguments (
  id                    uuid primary key default gen_random_uuid(),
  suivi_id              uuid not null references public.crm_suivi_etapes(id) on delete cascade,
  profil_argument_id    uuid not null references public.crm_profil_arguments(id) on delete cascade,
  verdict               text not null check (verdict in ('porte','neutre','rejete')),
  created_at            timestamptz not null default now()
);
create index if not exists crm_suivi_arguments_suivi_idx on public.crm_suivi_arguments(suivi_id);

-- § 5. Contacts — fonction et rôle dans la décision (§4.3 feature 1).
alter table public.crm_contacts add column if not exists fonction text;
alter table public.crm_contacts add column if not exists role_decision text check (role_decision in ('decideur','payeur','utilisateur','autre'));
alter table public.crm_contacts add column if not exists reseaux_sociaux text;

-- § 6. RLS — même garde que le reste du CRM.
alter table public.crm_profils_types    enable row level security;
alter table public.crm_profil_arguments enable row level security;
alter table public.crm_profil_objections enable row level security;
alter table public.crm_suivi_etapes     enable row level security;
alter table public.crm_suivi_arguments  enable row level security;
create policy crm_profils_types_staff     on public.crm_profils_types     for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_profil_arguments_staff  on public.crm_profil_arguments  for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_profil_objections_staff on public.crm_profil_objections for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_suivi_etapes_staff      on public.crm_suivi_etapes      for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_suivi_arguments_staff   on public.crm_suivi_arguments   for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 7. Les six profils de départ (§4.3 feature 2), champs vides —
--      MÊME logique que la donnée initiale de la spec : « avec des
--      champs vides que je remplirai » (feature 8, appliquée ici aux
--      profils aussi, pas seulement aux deux comptes).
insert into public.crm_profils_types (cle, nom) values
  ('entreprise', 'Entreprise'),
  ('grand_compte', 'Grand compte'),
  ('athlete_egerie', 'Athlète égérie'),
  ('influenceur_sport', 'Influenceur sport'),
  ('salle_sport_partenaire', 'Salle de sport partenaire'),
  ('particulier_sportif', 'Particulier sportif')
on conflict (cle) do nothing;

-- § 8. Les deux comptes de départ (§4.3 feature 8) — Fnac Darty (grand
--      compte) et Romane Dicko (athlète égérie), champs vides, étape
--      « premier_contact ».
insert into public.crm_projets (activite, nom, profil_id, statut, etape_pipeline)
  select 'commercial', 'Fnac Darty', p.id, 'actif', 'premier_contact'
  from public.crm_profils_types p where p.cle = 'grand_compte'
  and not exists (select 1 from public.crm_projets where nom = 'Fnac Darty' and activite = 'commercial');
insert into public.crm_projets (activite, nom, profil_id, statut, etape_pipeline)
  select 'commercial', 'Romane Dicko', p.id, 'actif', 'premier_contact'
  from public.crm_profils_types p where p.cle = 'athlete_egerie'
  and not exists (select 1 from public.crm_projets where nom = 'Romane Dicko' and activite = 'commercial');

-- § 9. Vérification, à lancer après exécution :
--   select cle, nom from crm_profils_types order by cle; -- 6 lignes
--   select nom, etape_pipeline from crm_projets where nom in ('Fnac Darty','Romane Dicko');
