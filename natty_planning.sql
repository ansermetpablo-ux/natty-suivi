-- Natty — planification de la semaine (assets/planning.js)
-- À exécuter dans Supabase → SQL Editor, une requête à la fois,
-- SANS les commentaires (l'éditeur renvoie 42601 sinon).
--
-- Tant que cette table n'existe pas, la planification fonctionne : le plan
-- de la semaine est alors gardé dans le localStorage de l'appareil, et
-- l'écran le dit à l'utilisateur plutôt que de laisser croire à une
-- synchronisation qui n'a pas lieu. La créer suffit à activer la
-- synchronisation, sans toucher au code.
--
-- Une ligne par personne et par semaine. `plan` porte tout : les 21 cases
-- « je prépare / j'achète », les 5 repas placés (jour, créneau, macro visée,
-- nom, macros, ingrédients) et les cibles au moment du calcul. C'est du
-- jsonb parce que la forme du plan appartient au module qui le compose —
-- une colonne par champ obligerait à une migration à chaque évolution de la
-- séquence, pour une donnée que personne n'interroge par morceaux.

create table public.planning_semaine (
  user_id    text not null,
  semaine    date not null,
  plan       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, semaine)
);

-- ⚠️ La clé primaire (user_id, semaine) est CE QUE VISE le `?on_conflict=
-- user_id,semaine` de `enregistrer()`. Sans elle, PostgREST résout le conflit
-- sur autre chose et une replanification repart en 409 au lieu d'écraser —
-- même piège que meal_likes / membre_amis (voir §3 de CLAUDE.md).

alter table public.planning_semaine enable row level security;

-- Un plan de repas dit quand la personne est chez elle et ce qu'elle mange :
-- il ne sort pas de son compte. Pas de policy de lecture pour anon — donc
-- rien ne répond à la clé publique.
create policy planning_semaine_soi on public.planning_semaine
  for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Vérification (doit renvoyer 0 ligne avec la seule clé anon) :
-- select * from public.planning_semaine;
