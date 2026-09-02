-- Natty — le journal des séances (assets/seance.js)
-- À exécuter dans Supabase → SQL Editor, une requête à la fois,
-- SANS les commentaires (l'éditeur renvoie 42601 sinon).
--
-- Tant que cette table n'existe pas, TOUT FONCTIONNE : les séances sont gardées
-- dans le localStorage de l'appareil, le bilan du soir les compte, et les deux
-- écrans qui les montrent le DISENT (« gardées sur cet appareil uniquement »)
-- plutôt que de laisser croire à une synchronisation qui n'a pas lieu — même
-- parti pris que `planning_semaine`, `garde_manger` et `materiel`.
--
-- Ce que la créer débloque : la séance notée à la salle sur le téléphone est
-- comptée par le bilan ouvert le soir sur un autre appareil. Sans elle, le même
-- soir donnerait deux estimations différentes de muscle et de graisse selon
-- l'appareil — et c'est le genre d'écart qui fait douter des deux.

create table public.seances (
  user_id    text not null,
  jour       date not null,
  exos       jsonb not null default '[]'::jsonb,
  duree_min  integer,
  libre      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, jour)
);

-- ⚠️ LA CLÉ PRIMAIRE `(user_id, jour)` EST STRUCTURELLE, pas cosmétique.
-- `enregistrer()` écrit avec `Prefer: resolution=merge-duplicates` mais SANS
-- `?on_conflict=` : PostgREST résout alors le conflit sur la CLÉ PRIMAIRE. Avec
-- un `id` uuid en clé, corriger une séance repartirait en 409 et la deuxième
-- saisie du même jour ne serait jamais enregistrée — piège déjà payé sur
-- meal_likes, membre_amis et notes_nutritionniste (§3 de CLAUDE.md).
--
-- ⚠️ UNE LIGNE PAR JOUR, et c'est un choix de produit, pas une contrainte
-- technique : le calendrier montre un JOUR, pas une liste de séances. Deux
-- entraînements dans la même journée sont deux blocs d'exercices dans le même
-- `exos` — ce que le parcours de saisie permet (« Ajouter une autre machine »).
--
-- ⚠️ `exos` porte les séries TELLES QU'ELLES ONT ÉTÉ SAISIES, et rien de
-- calculé : ni le nombre de séries, ni les répétitions totales, ni les kcal.
-- Ces trois-là se déduisent (`series()`, `reps()`, `kcal()`), et les stocker en
-- ferait une seconde vérité qui dériverait au premier ajustement du modèle —
-- c'est exactement ce qui est arrivé entre `api/_nutrition.js` et
-- `assets/core.js`, et cette divergence s'était payée en macros fausses
-- envoyées par notification.
-- Forme d'un élément : {cle, g, nom, ic, unite, met, series:[10,10,8]}.
--
-- ⚠️ `libre` est le texte brut de la saisie à la main, CONSERVÉ même quand
-- l'analyse a réussi à en tirer des exercices. L'analyse peut se tromper ;
-- jeter ce que la personne a écrit rendrait l'erreur irréparable.

alter table public.seances enable row level security;

-- Ce que quelqu'un soulève, à quelle fréquence et quels jours il ne vient pas :
-- c'est un relevé de sa forme physique et de ses habitudes. Ça ne sort pas de
-- son compte. Aucune policy pour anon — donc rien ne répond à la clé publique.
create policy seances_soi on public.seances
  for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Vérification, à coller ensuite dans le SQL Editor : doit rendre une ligne.
-- select tablename, rowsecurity from pg_tables where tablename = 'seances';
--
-- Et depuis l'app : le panneau « Mes séances » de l'écran Coaching ne doit plus
-- afficher « Gardées sur cet appareil uniquement ».
--
-- La suppression de compte (`api/supprimer-compte.js`) efface cette table :
-- `seances` figure dans sa liste TABLES_USER.
