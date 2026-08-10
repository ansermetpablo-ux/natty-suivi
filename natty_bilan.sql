-- Natty — le bilan du soir et celui de la semaine (assets/bilan.js)
--
-- ✅ EXÉCUTÉ PAR PABLO LE 2026-08-10, et vérifié à la clé anon : la table
-- répond [] (et non PGRST205), ses 12 colonnes sont là (témoin : une colonne
-- inventée répond bien 42703), l'INSERT anon est refusé en 42501, et un POST
-- avec ?on_conflict=user_id,jour échoue en 42501 et NON en 42P10 — donc la
-- clé primaire (user_id, jour) est bien en place. Rien à refaire.
--
-- À exécuter dans Supabase → SQL Editor, une requête à la fois,
-- SANS les commentaires (l'éditeur renvoie 42601 sinon).
--
-- Tant que cette table n'existe pas, le bilan FONCTIONNE : les réponses aux
-- trois questions du soir sont alors gardées dans le localStorage de
-- l'appareil, et le dernier écran le DIT plutôt que de laisser croire à une
-- synchronisation qui n'a pas lieu (même parti pris qu'assets/planning.js).
-- La créer suffit à activer la synchronisation, sans toucher au code.
--
-- Une ligne par personne et par jour. Les colonnes chiffrées (note, muscle_g,
-- gras_g, prot_g, cal_kcal) sont un INSTANTANÉ, pas une source : elles
-- servent à relire une série sans refaire tout le calcul, et le module les
-- recalcule toujours depuis `meals` quand il affiche l'écran. Si les deux
-- divergeaient un jour, ce sont les repas qui font foi.

create table public.bilan_jour (
  user_id    text not null,
  jour       date not null,
  portee     text not null default 'jour',
  ressenti   text,
  motivation text,
  difficulte text,
  note       integer,
  muscle_g   integer,
  gras_g     integer,
  prot_g     integer,
  cal_kcal   integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, jour)
);

-- ⚠️ La clé primaire (user_id, jour) est CE QUE VISE le
-- `?on_conflict=user_id,jour` d'`enregistrerReponses()`. Sans elle, PostgREST
-- résout le conflit sur autre chose et un second bilan le même soir repart en
-- 409 au lieu d'écraser — même piège que meal_likes / membre_amis /
-- notes_nutritionniste (voir §3 de CLAUDE.md).

alter table public.bilan_jour enable row level security;

-- Ce que quelqu'un répond le soir sur sa motivation et ses difficultés est ce
-- qu'il y a de plus personnel dans cette app. Pas de policy pour anon : rien
-- ne répond à la clé publique.
create policy bilan_jour_soi on public.bilan_jour
  for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- ✅ `bilan_jour` est DÉJÀ dans `TABLES_USER` d'api/supprimer-compte.js (ajouté
-- en même temps que ce fichier) : un compte supprimé n'y laisse pas son état
-- d'esprit soir après soir. La route ignore sans broncher une table qui
-- n'existe pas encore, donc l'ordre entre ce SQL et le déploiement est libre.
