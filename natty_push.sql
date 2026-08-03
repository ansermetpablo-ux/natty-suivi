-- ═══════════════════════════════════════════════════════════
-- Natty — Notifications push : jetons d'appareil et état des envois
-- À exécuter dans Supabase → SQL Editor, requête par requête,
-- SANS les commentaires (l'éditeur renvoie 42601 dessus).
-- ═══════════════════════════════════════════════════════════

-- 1. Les appareils à qui envoyer.
--    La clé est le JETON, pas l'utilisateur : un téléphone peut changer de
--    compte, et un compte avoir plusieurs téléphones. C'est aussi ce qui rend
--    le `?on_conflict=token` d'assets/push.js efficace — sans clé primaire sur
--    le jeton, PostgREST résoudrait le conflit sur un id neuf et repartirait
--    en 409 (piège déjà rencontré sur meal_likes).
create table if not exists public.appareils (
  token       text primary key,
  user_id     text not null,
  plateforme  text not null default 'ios',
  actif       boolean not null default true,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists appareils_user_idx on public.appareils (user_id);

alter table public.appareils disable row level security;

-- 2. Mémoire des envois : à quand remonte le dernier passage, et qu'a-t-on
--    déjà notifié. Sans elle, un rappel relancé deux fois dans la journée
--    (ou un cron rejoué) renvoie la même notification.
--    `cle` = nom du travail ('rappel-macros', 'amis'), `valeur` libre.
create table if not exists public.push_etat (
  cle        text primary key,
  valeur     text,
  updated_at timestamptz not null default now()
);

alter table public.push_etat disable row level security;

-- 3. Vérification rapide après exécution :
-- select * from public.appareils;
-- select * from public.push_etat;
