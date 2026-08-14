-- Natty — modération du fil social (social.html / assets/social.js / admin.html)
-- À exécuter dans Supabase → SQL Editor, une requête à la fois,
-- SANS les commentaires (l'éditeur renvoie 42601 sinon).
--
-- POURQUOI CE FICHIER EXISTE, ET POURQUOI IL BLOQUE LA PUBLICATION.
-- Le fil social affiche les photos et les prénoms d'autres membres. Apple
-- exige alors quatre choses (App Store Review Guideline 1.2) : un moyen de
-- SIGNALER un contenu offensant, la possibilité de BLOQUER un membre, un
-- FILTRAGE du contenu manifestement inapproprié, et un CONTACT publié.
-- L'app n'avait que le dernier (l'email des CGU) : la seule action offerte sur
-- le plat de quelqu'un d'autre était « Suivre ». C'est le motif de refus
-- classique au premier envoi d'une app à contenu généré par les utilisateurs.
--
-- Ces deux tables portent les trois qui manquaient. Tant qu'elles n'existent
-- pas, le code fonctionne en repli : le masquage vit dans le localStorage de
-- l'appareil et le signalement bascule sur un email prérempli — donc l'app
-- reste utilisable, mais le masquage ne suit pas d'un téléphone à l'autre et
-- personne ne voit les signalements dans l'admin. `NattySocial.moderationOk()`
-- dit lequel des deux régimes s'applique.


-- § 1. Les signalements.
--
-- ⚠️ `unique (meal_id, signaleur_id)` n'est pas cosmétique : `signaler()` écrit
-- avec `?on_conflict=meal_id,signaleur_id` pour qu'un second signalement du même
-- plat par la même personne soit ignoré au lieu de repartir en 409. Sans cette
-- contrainte nommée, PostgREST résoudrait le conflit sur la clé primaire — un
-- `id` uuid toujours neuf — et le doublon passerait (piège déjà payé sur
-- meal_likes, membre_amis et notes_nutritionniste, voir §3 de CLAUDE.md).
--
-- `auteur_id` est DÉNORMALISÉ (il se déduirait de meals.user_id) : c'est ce qui
-- permet à l'admin de compter les signalements par membre sans joindre `meals`,
-- donc de repérer quelqu'un qui poste dix contenus signalés une fois chacun.
create table public.signalements (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references public.meals(id) on delete cascade,
  auteur_id   text not null,
  signaleur_id text not null,
  motif       text not null,
  commentaire text,
  statut      text not null default 'nouveau',
  traite_par  text,
  traite_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (meal_id, signaleur_id),
  check (motif in ('inapproprie', 'trompeur', 'personne', 'spam', 'autre')),
  check (statut in ('nouveau', 'traite', 'rejete'))
);

-- ⚠️ `on delete cascade` est un choix, et il a un coût qu'il faut connaître :
-- un membre qui supprime son plat efface les signalements qui le visaient. On
-- l'accepte — garder la trace d'un contenu qui n'existe plus, c'est conserver
-- une accusation sans la pièce qui permettrait de la juger. Le compteur par
-- membre de l'admin se lit donc « signalements EN COURS », jamais « historique ».

create index signalements_statut_idx on public.signalements (statut, created_at desc);
create index signalements_auteur_idx on public.signalements (auteur_id);


-- § 2. Les membres masqués.
--
-- Relation à SENS UNIQUE, comme membre_amis : « je ne veux plus voir cette
-- personne ». Elle n'est pas prévenue, et elle continue de me voir — un blocage
-- réciproque annoncé transformerait un geste de tranquillité en conflit, et
-- Apple ne demande que de pouvoir ne plus voir.
--
-- ⚠️ La clé primaire EST `(user_id, bloque_id)`, ce que vise le
-- `?on_conflict=user_id,bloque_id` de `basculerBloque()`. Même raison qu'au § 1.
create table public.membre_bloques (
  user_id    text not null,
  bloque_id  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, bloque_id),
  check (user_id <> bloque_id)
);


-- § 3. RLS. Contrairement aux tables de natty_social.sql (likes, vues, amis),
--      celles-ci sont PROTÉGÉES, et ce n'est pas de la prudence de principe :
--      `signalements` contient des accusations nominatives, `membre_bloques` dit
--      qui ne supporte plus qui. Ouvertes à la clé anon publique, elles
--      seraient l'endroit le plus toxique de la base.

alter table public.signalements   enable row level security;
alter table public.membre_bloques enable row level security;

-- On signale pour soi, et on ne relit que ses propres signalements — de quoi
-- afficher « Déjà signalé » sans jamais révéler qui d'autre a signalé quoi.
create policy signalements_ecrire_soi on public.signalements
  for insert to authenticated
  with check (auth.uid()::text = signaleur_id);

create policy signalements_lire_soi on public.signalements
  for select to authenticated
  using (auth.uid()::text = signaleur_id);

-- L'équipe voit et traite tout. `est_staff()` vient de natty_staff.sql § 2 :
-- SECURITY DEFINER, donc elle lit `staff` sans exposer la table.
create policy signalements_staff on public.signalements
  for all to authenticated
  using (public.est_staff())
  with check (public.est_staff());

create policy membre_bloques_soi on public.membre_bloques
  for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);


-- § 4. Vérifications, à coller ensuite dans le SQL Editor.
--
-- Les deux tables existent et sont protégées — doit rendre 2 lignes à true :
-- select tablename, rowsecurity from pg_tables
--   where tablename in ('signalements', 'membre_bloques');
--
-- Les policies sont bien là — doit rendre 4 lignes :
-- select tablename, policyname from pg_policies
--   where tablename in ('signalements', 'membre_bloques') order by tablename;
--
-- Et depuis l'app : ouvrir un plat du fil, « Voir les détails ». Les deux
-- boutons « Signaler » et « Masquer ce membre » doivent être là, et le second
-- doit faire disparaître les plats de la personne du fil immédiatement.
-- Côté admin.html : onglet « Signalements ».
--
-- La suppression de compte (`api/supprimer-compte.js`) efface ces deux tables :
-- `signalements` et `membre_bloques` figurent dans sa liste, et les colonnes
-- « à l'envers » (`bloque_id`, `auteur_id`) sont traitées à part, comme
-- `membre_amis.ami_id`.
