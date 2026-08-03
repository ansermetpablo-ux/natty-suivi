-- Natty — fil social (social.html / assets/social.js)
-- À exécuter dans Supabase → SQL Editor, une requête à la fois,
-- sans les commentaires (l'éditeur renvoie 42601 sinon).
--
-- Tant que ces tables n'existent pas, le fil fonctionne mais les
-- « j'aime », les vues et les abonnements restent stockés sur
-- l'appareil : rien n'est donc partagé entre les membres.
-- Seule exception : membre_prefs, qui porte un réglage de
-- confidentialité et n'a volontairement AUCUN repli local — sans
-- cette table, l'interrupteur du profil reste désactivé.

create table public.meal_likes (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meals(id) on delete cascade,
  user_id    text not null,
  created_at timestamptz not null default now(),
  unique (meal_id, user_id)
);

create table public.meal_vues (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.meals(id) on delete cascade,
  user_id    text not null,
  created_at timestamptz not null default now(),
  unique (meal_id, user_id)
);

-- Abonnements entre membres. Relation à sens unique et sans validation
-- (« je suis quelqu'un ») : l'app n'a pas de canal de notification pour
-- porter une file de demandes en attente, et le fil doit se remplir tout
-- de suite. Une amitié réciproque = deux lignes.
create table public.membre_amis (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  ami_id     text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ami_id),
  check (user_id <> ami_id)
);

-- Réglage « mes plats apparaissent dans le fil », piloté depuis profil.html.
-- Absence de ligne = fil_public true : le comportement par défaut reste
-- « visible », comme aujourd'hui.
create table public.membre_prefs (
  user_id    text primary key,
  fil_public boolean not null default true,
  updated_at timestamptz not null default now()
);

create index meal_likes_meal_idx  on public.meal_likes  (meal_id);
create index meal_vues_meal_idx   on public.meal_vues   (meal_id);
create index membre_amis_user_idx on public.membre_amis (user_id);

alter table public.meal_likes   disable row level security;
alter table public.meal_vues    disable row level security;
alter table public.membre_amis  disable row level security;
alter table public.membre_prefs disable row level security;

-- Optionnel : retirer UN plat du fil (le réglage global, lui, est dans
-- membre_prefs ci-dessus et se pilote depuis profil.html). social.js
-- détecte seul la présence de la colonne — sans elle, tous les plats d'un
-- membre au fil public apparaissent. Rien dans l'app n'écrit encore cette
-- colonne : elle se règle pour l'instant à la main ou depuis l'admin.
alter table public.meals add column partage boolean not null default true;
