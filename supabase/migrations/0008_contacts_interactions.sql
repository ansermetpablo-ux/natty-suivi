-- 0008_contacts_interactions.sql — Comptes & contacts, Emailing & phoning (Commercial)
--
-- Deux tables minimales, pas un CRM contact complet réinventé : un contact
-- se rattache optionnellement à un deal existant (crm_projets, activite=
-- 'commercial'), et une interaction (email envoyé, appel passé) se rattache
-- à un contact. Même posture RLS que crm_taches/crm_projets : une seule
-- policy `est_staff()`, tout ou rien pour l'équipe connectée — ce sont des
-- données commerciales internes, pas des données de membre soumises à RLS
-- "soi seulement".

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid references crm_projets(id) on delete set null,
  nom text not null,
  entreprise text,
  email text,
  telephone text,
  notes text,
  cree_par text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table crm_contacts enable row level security;
drop policy if exists crm_contacts_staff on crm_contacts;
create policy crm_contacts_staff on crm_contacts for all using (est_staff()) with check (est_staff());
create index if not exists idx_crm_contacts_projet on crm_contacts(projet_id);

create table if not exists crm_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references crm_contacts(id) on delete cascade,
  projet_id uuid references crm_projets(id) on delete set null,
  type text not null check (type in ('email','appel','autre')),
  resultat text,
  note text,
  auteur text,
  created_at timestamptz not null default now()
);
alter table crm_interactions enable row level security;
drop policy if exists crm_interactions_staff on crm_interactions;
create policy crm_interactions_staff on crm_interactions for all using (est_staff()) with check (est_staff());
create index if not exists idx_crm_interactions_contact on crm_interactions(contact_id);
