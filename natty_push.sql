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

-- 3. Le secret d'appel, RANGÉ HORS DE PORTÉE.
--    Le déclencheur doit s'authentifier auprès de /api/push-amis, donc porter
--    CRON_SECRET. L'écrire en dur dans le corps de la fonction le rendrait
--    lisible par quiconque peut inspecter le catalogue. On le range dans une
--    table dont la RLS est ACTIVÉE SANS AUCUNE POLICY : personne ne la lit
--    depuis la clé anon, et seule une fonction SECURITY DEFINER y accède.
create table if not exists public.push_config (
  cle    text primary key,
  valeur text not null
);

alter table public.push_config enable row level security;

-- ⚠️ Remplacer par la valeur réelle de CRON_SECRET (celle de Vercel).
insert into public.push_config (cle, valeur)
values ('cron_secret', 'REMPLACER_PAR_LE_CRON_SECRET')
on conflict (cle) do update set valeur = excluded.valeur;

-- 4. pg_net : les appels HTTP sortants depuis Postgres.
create extension if not exists pg_net with schema extensions;

-- 5. Le déclencheur. Un repas enregistré prévient les abonnés de son auteur
--    dans la foulée, sans attendre un cron.
--    `net.http_post` est ASYNCHRONE : il met la requête en file et rend la main
--    tout de suite. L'insertion du repas n'est donc jamais ralentie, ni
--    annulée si Vercel répond mal — ce qui est exactement ce qu'on veut : une
--    notification ratée ne doit pas faire perdre un repas à l'utilisateur.
create or replace function public.notifier_amis_nouveau_plat()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secret text;
begin
  select valeur into secret from public.push_config where cle = 'cron_secret';
  if secret is null or secret = 'REMPLACER_PAR_LE_CRON_SECRET' then
    return new;   -- pas configuré : on ne tente rien plutôt que d'échouer en boucle
  end if;

  perform net.http_post(
    url     := 'https://natty-suivi.vercel.app/api/push-amis',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', secret
               ),
    body    := jsonb_build_object('meal_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists meals_notifier_amis on public.meals;

create trigger meals_notifier_amis
after insert on public.meals
for each row
execute function public.notifier_amis_nouveau_plat();

-- 6. Vérifications après exécution :
-- select * from public.appareils;
-- select * from public.push_etat;
-- select cle from public.push_config;                       -- la valeur reste privée
-- select * from net._http_response order by created desc limit 5;   -- réponses de Vercel
--
-- Pour désactiver le déclencheur sans rien perdre :
-- alter table public.meals disable trigger meals_notifier_amis;
