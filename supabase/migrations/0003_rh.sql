-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Module RH (docs/crm-spec.md § 4.4 et § 5)
-- ───────────────────────────────────────────────────────────
-- Cinq tables. Même niveau de confiance que le reste des tables internes
-- de ce dépôt (crm_taches, crm_projets, natty_production.sql…) : une seule
-- policy `est_staff()` par table, pas de cloisonnement par rôle — l'équipe
-- est six personnes qui doivent voir les disponibilités et les réunions
-- des unes et des autres pour caler un créneau. `notifications`, elle,
-- reste personnelle (0002) : c'est une boîte de réception, pas un planning.
--
-- Rien n'est en dur : les délais, motifs et périmètre du suivi des
-- manquements vivent dans `regles_presence` (clé → valeur jsonb),
-- modifiables sans toucher au code — c'est la règle explicite de la spec.
--
-- ⚠️ ORDRE D'EXÉCUTION : après 0001_membres.sql et 0002_notifications.sql.
-- ═══════════════════════════════════════════════════════════

-- § 1. Indisponibilités — récurrentes (jour de semaine, rythme d'alternance
--      via une parité de semaine ISO) ou ponctuelles (plage de dates).
--      `jour_semaine` en 0=lundi..6=dimanche, ISO ; null = toute la semaine
--      concernée (utile pour une semaine d'école entière, alternance).
create table if not exists public.indisponibilites (
  id            uuid primary key default gen_random_uuid(),
  membre        text not null references public.staff(user_id),
  type          text not null check (type in ('recurrente','ponctuelle')),
  jour_semaine  smallint check (jour_semaine between 0 and 6),
  parite_semaine text check (parite_semaine is null or parite_semaine in ('paire','impaire')),
  heure_debut   time,
  heure_fin     time,
  date_debut    date,
  date_fin      date,
  motif         text,
  created_at    timestamptz not null default now(),
  check (type <> 'ponctuelle' or date_debut is not null)
);
comment on column public.indisponibilites.parite_semaine is
  'Pour le rythme d''alternance (une semaine de cours, une en entreprise) : impaire/paire selon le numéro de semaine ISO. Null = toutes les semaines.';

-- § 2. Réunions. `ics_sequence` augmente à chaque changement de date/lieu
--      après invitation — c'est ce qui fait qu'un calendrier déjà accepté
--      se MET À JOUR au lieu de dupliquer l'événement (RFC 5545 SEQUENCE).
create table if not exists public.reunions (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null,
  description   text,
  organisateur  text not null references public.staff(user_id),
  date_debut    timestamptz not null,
  date_fin      timestamptz,
  lieu          text,
  lien_visio    text,
  statut        text not null default 'proposee' check (statut in ('proposee','confirmee','annulee')),
  ics_sequence  int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- § 3. Participations — POLYMORPHE : une réunion et une future session de
--      production (§4.1, pas encore construite) partagent la même
--      mécanique de confirmation, comme demandé. Pas de FK sur
--      (evenement_type, evenement_id) : la table visée par 'session'
--      n'existe pas encore, même raisonnement que notifications.objet_id
--      (0002) — une FK vers une table absente ferait échouer ce fichier.
create table if not exists public.participations (
  id                uuid primary key default gen_random_uuid(),
  evenement_type    text not null check (evenement_type in ('reunion','session')),
  evenement_id      uuid not null,
  membre            text not null references public.staff(user_id),
  statut            text not null default 'invite' check (statut in ('invite','confirme','decline','tentative')),
  confirme_le       timestamptz,
  heure_arrivee     timestamptz,
  heure_prevenance  timestamptz,
  notification_id   uuid references public.notifications(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (evenement_type, evenement_id, membre)
);
comment on column public.participations.heure_prevenance is
  'Quand la personne a prévenu qu''elle serait absente (déclin), comparée au délai de regles_presence pour savoir si un manquement se crée.';

-- § 4. Manquements — un par participation manquée. `decideur` doit être
--      quelqu'un d'AUTRE que l'organisateur de l'événement (règle produit,
--      appliquée côté client : voir crm.html — la contrainte techniquement
--      la plus simple demanderait un trigger inter-tables pour un gain de
--      sûreté marginal sur un outil d'équipe déjà fermé à `est_staff()`).
create table if not exists public.manquements (
  id              uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.participations(id) on delete cascade,
  statut          text not null default 'a_justifier' check (statut in ('a_justifier','justifie','non_justifie','conteste')),
  constate_le     timestamptz not null default now(),
  motif           text,
  commentaire     text,
  decideur        text references public.staff(user_id),
  decision        text check (decision is null or decision in ('justifie','non_justifie')),
  decide_le       timestamptz,
  contestation    text,
  conteste_le     timestamptz,
  created_at      timestamptz not null default now()
);

-- § 5. Règles — délais, motifs et périmètre, en jsonb, jamais en dur.
create table if not exists public.regles_presence (
  cle          text primary key,
  valeur       jsonb not null,
  description  text,
  updated_at   timestamptz not null default now()
);
insert into public.regles_presence (cle, valeur, description) values
  ('delai_prevenance_heures', '24', 'Nombre d''heures avant l''événement en dessous duquel un déclin ou une absence compte comme "non prévenu".'),
  ('delai_justification_jours', '7', 'Nombre de jours laissés pour justifier un manquement avant qu''il ne reste "à justifier" indéfiniment.'),
  ('motifs_valables', '["maladie","urgence_familiale","panne_transport","conflit_cours","autre"]', 'Motifs proposés pour justifier un manquement.'),
  ('perimetre_manquements', '["associe"]', 'Valeurs de staff.statut concernées par le suivi des manquements — point ouvert de la spec (§9), modifiable ici sans redéploiement.')
on conflict (cle) do nothing;

-- § 6. Préparer, sans le brancher, le suivi du coût des rappels SMS
--      (§4.4 et §9 : « service SMS à choisir plus tard »). Colonne seule,
--      aucun canal 'sms' ajouté à la contrainte tant qu'aucun envoi n'existe.
alter table public.notifications add column if not exists cout numeric;
comment on column public.notifications.cout is
  'Coût de l''envoi (SMS, quand ce canal sera branché). Null pour popup/email.';

-- § 7. RLS — même policy que crm_taches/crm_projets : n'importe quel membre
--      actif de l'équipe lit et écrit. Une plage d'indisponibilité ou une
--      présence n'a rien de plus sensible que le reste des tables de ce
--      dépôt gérées par `admin.html`.
alter table public.indisponibilites enable row level security;
alter table public.reunions enable row level security;
alter table public.participations enable row level security;
alter table public.manquements enable row level security;
alter table public.regles_presence enable row level security;

create policy indisponibilites_staff on public.indisponibilites for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy reunions_staff on public.reunions for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy participations_staff on public.participations for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy manquements_staff on public.manquements for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy regles_presence_staff on public.regles_presence for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 8. Vérification, à lancer après exécution :
--   select count(*) from regles_presence;  -- doit rendre 4
--   select table_name from information_schema.tables where table_schema='public'
--   and table_name in ('indisponibilites','reunions','participations','manquements','regles_presence');
--   -- doit rendre les cinq lignes.
