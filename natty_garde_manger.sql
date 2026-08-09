-- Natty — garde-manger (assets/garde-manger.js)
-- À exécuter dans Supabase → SQL Editor, une requête à la fois,
-- SANS les commentaires (l'éditeur renvoie 42601 sinon).
--
-- Tant que cette table n'existe pas, le garde-manger fonctionne : la liste est
-- gardée dans le localStorage de l'appareil, et le panneau le DIT
-- (« Liste gardée sur cet appareil uniquement ») plutôt que de laisser croire à
-- une synchronisation qui n'a pas lieu. La créer suffit à l'activer, sans
-- toucher au code — `estSynchronise()` passe alors à true de lui-même.
--
-- Une seule ligne par personne. `items` porte la liste entière
-- ([{em, nom, qte}, …]) : c'est du jsonb parce que sa forme appartient au module
-- qui la compose, et que personne ne l'interroge par morceaux. Le scan d'un
-- ticket de caisse peut y déposer quinze articles d'un coup ; une ligne par
-- ingrédient n'apporterait rien et multiplierait les requêtes.

create table public.garde_manger (
  user_id    text primary key,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ⚠️ `user_id` DOIT être la clé primaire, et c'est structurel, pas cosmétique.
-- `sauver()` écrit avec `Prefer: resolution=merge-duplicates` mais SANS
-- `?on_conflict=` : PostgREST résout alors le conflit sur la CLÉ PRIMAIRE. Si la
-- clé primaire était un `id` uuid neuf, chaque enregistrement repartirait en 409
-- et le garde-manger ne se synchroniserait jamais — c'est le piège déjà rencontré
-- sur meal_likes et membre_amis (voir §3 de CLAUDE.md). Avec `user_id` en clé
-- primaire, la table se comporte comme membre_prefs : rien à changer côté code.

alter table public.garde_manger enable row level security;

-- ⚠️ RLS ACTIVÉE, contrairement à ce que proposait l'en-tête du module (écrit
-- avant l'activation générale des RLS le 2026-08-04). Un garde-manger dit ce
-- qu'une personne a chez elle et ce qu'elle mange : ça ne sort pas de son
-- compte. Aucune policy pour anon — donc rien ne répond à la clé publique.
create policy garde_manger_soi on public.garde_manger
  for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Vérification, à coller ensuite dans le SQL Editor : doit rendre une ligne.
-- select tablename, rowsecurity from pg_tables where tablename = 'garde_manger';
--
-- Et depuis l'app : le panneau « Mon garde-manger », en bas de l'écran Suivi, ne
-- doit plus afficher « Liste gardée sur cet appareil uniquement ».
--
-- La suppression de compte (`api/supprimer-compte.js`) efface déjà cette table :
-- `garde_manger` figure dans sa liste TABLES_USER.
