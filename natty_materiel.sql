-- Natty — matériel de cuisine (assets/materiel.js)
-- À exécuter dans Supabase → SQL Editor, une requête à la fois,
-- SANS les commentaires (l'éditeur renvoie 42601 sinon).
--
-- Tant que cette table n'existe pas, la question fonctionne : la réponse est
-- gardée dans le localStorage de l'appareil, transmise au serveur dans le corps
-- de la requête de génération, et le panneau « Mon matériel » de l'écran Repas
-- le DIT (« Gardé sur cet appareil uniquement ») plutôt que de laisser croire à
-- une synchronisation qui n'a pas lieu.
--
-- Ce que la créer débloque VRAIMENT, et c'est la raison d'être de ce fichier :
-- le CRON DU LUNDI. Il génère pour tout le monde, sans navigateur, donc sans
-- localStorage à interroger — sans cette table, la génération automatique
-- continuerait de proposer un gratin au four à quelqu'un qui n'en a pas, alors
-- que la même génération lancée à la main, elle, en tiendrait compte. Deux
-- comportements pour la même semaine, selon qui a appuyé.

create table public.materiel (
  user_id    text primary key,
  items      jsonb not null default '[]'::jsonb,
  resume     text,
  updated_at timestamptz not null default now()
);

-- ⚠️ `user_id` DOIT être la clé primaire, et c'est structurel, pas cosmétique.
-- `sauver()` écrit avec `Prefer: resolution=merge-duplicates` mais SANS
-- `?on_conflict=` : PostgREST résout alors le conflit sur la CLÉ PRIMAIRE. Si la
-- clé primaire était un `id` uuid neuf, chaque enregistrement repartirait en 409
-- et le matériel ne se synchroniserait jamais — piège déjà payé sur meal_likes,
-- membre_amis et notes_nutritionniste (voir §3 de CLAUDE.md).

-- ⚠️ `items` porte les CLÉS du catalogue (["four","poele",…]) et `resume` la
-- PHRASE prête pour le prompt (« Dispose de : … NE DISPOSE PAS de : … »).
-- Stocker les deux n'est pas une redondance de confort : le catalogue vit dans
-- `assets/materiel.js`, que le serveur ne peut pas importer (IIFE navigateur).
-- En recopier une version côté Node, c'est exactement ce qui a fait diverger
-- `api/_nutrition.js` de `assets/core.js` pendant des semaines — et cette
-- divergence-là s'était payée en macros fausses envoyées par notification.
-- Ici le navigateur compose la phrase, le serveur la lit, et il n'existe qu'un
-- seul catalogue.
--
-- Contrepartie assumée : un appareil ajouté au catalogue ne réécrit pas les
-- `resume` déjà en base. Ils resteront justes (ils ne mentent sur rien), mais
-- muets sur le nouvel appareil jusqu'à ce que la personne repasse par le
-- panneau « Mon matériel ».

alter table public.materiel enable row level security;

-- Ce que quelqu'un a dans sa cuisine ne dit pas seulement comment il cuisine :
-- ça dit son équipement, donc son logement et ses moyens. Ça ne sort pas de son
-- compte. Aucune policy pour anon — donc rien ne répond à la clé publique.
create policy materiel_soi on public.materiel
  for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Vérification, à coller ensuite dans le SQL Editor : doit rendre une ligne.
-- select tablename, rowsecurity from pg_tables where tablename = 'materiel';
--
-- Et depuis l'app : le panneau « Mon matériel », en bas de l'écran Repas, ne
-- doit plus afficher « Gardé sur cet appareil uniquement ».
--
-- La suppression de compte (`api/supprimer-compte.js`) efface cette table :
-- `materiel` figure dans sa liste TABLES_USER.
