-- ═══════════════════════════════════════════════════════════
-- Natty — Réactivation des RLS (row level security)
-- ───────────────────────────────────────────────────────────
-- CE QUI EST MESURÉ AUJOURD'HUI, avec la seule clé anon publique (elle est
-- dans le code de chaque page, donc dans le navigateur de n'importe qui) :
--   • lecture de TOUTES les tables — 31 profils, 66 repas, les conversations
--     privées avec le nutritionniste, les allergies, les poids et les âges ;
--   • ÉCRITURE sur les données d'autrui — un PATCH sur l'onboarding d'un autre
--     membre renvoie 204. Vérifié le 2026-08-03 (preuve non destructive : la
--     valeur a été réécrite par elle-même).
--
-- Ce que la session JWT change : depuis les commits d'auth du 2026-08-03,
-- `assets/core.js` envoie `Authorization: Bearer <access_token>` quand une
-- session existe. `auth.uid()` est donc renseigné côté base — c'est ce qui
-- rend ces policies possibles. ⚠️ `user_id` est du **texte** partout, jamais
-- un uuid : toujours comparer `auth.uid()::text = user_id`.
--
-- ⚠️ EXÉCUTER PAR ÉTAPES, requête par requête, SANS les commentaires.
--    Après chaque étape : ouvrir l'app et vérifier que l'écran concerné
--    fonctionne encore. En cas de problème, `alter table X disable row level
--    security;` remet immédiatement l'état d'avant.
-- ═══════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ ÉTAPE 1 — sans aucun risque pour les écrans existants     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Ces tables ne sont lues par AUCUN écran : le serveur y accède avec
-- SUPABASE_SERVICE_KEY, qui ignore les RLS par construction.

-- push_etat : mémoire des envois push, purement serveur.
alter table public.push_etat enable row level security;

-- appareils : le jeton APNs d'un téléphone. Seul son propriétaire l'écrit,
-- personne ne le lit côté client. Sans policy de SELECT, un jeton volé ne
-- peut plus servir à savoir qui utilise l'app.
alter table public.appareils enable row level security;

create policy appareils_insert_soi on public.appareils
  for insert to authenticated
  with check (auth.uid()::text = user_id);

create policy appareils_update_soi on public.appareils
  for update to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- (push_config est déjà en RLS sans policy depuis natty_push.sql — vérifié :
--  une écriture anon repart en 42501.)


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ ÉTAPE 2 — données strictement personnelles                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- ⚠️ NE PAS EXÉCUTER avant d'avoir traité le bloqueur « admin.html » plus bas :
--    l'admin lit `messages`, `onboarding`, `nutrition_scores`,
--    `questionnaire_alim`, `commandes`, `notes_nutritionniste` avec la clé
--    anon. Dès que ces tables passent en RLS, l'admin ne voit plus RIEN.
--
-- Rien ici n'est cross-membre : ni le fil social ni aucun autre écran n'a
-- besoin de lire ces lignes pour quelqu'un d'autre.

-- messages — la conversation avec le nutritionniste. C'est la donnée la plus
-- sensible de la base, et aujourd'hui la plus exposée.
alter table public.messages enable row level security;
create policy messages_tout_soi on public.messages
  for all to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- abonnements — contient les identifiants Stripe. Lecture seule côté client :
-- seul le webhook (clé service) doit écrire, sinon n'importe qui s'offre un
-- abonnement actif.
alter table public.abonnements enable row level security;
create policy abonnements_lire_soi on public.abonnements
  for select to authenticated
  using (auth.uid()::text = user_id);

-- daily_macros / nutrition_scores / profil_conseils / challenges / commandes
alter table public.daily_macros enable row level security;
create policy daily_macros_soi on public.daily_macros
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.nutrition_scores enable row level security;
create policy nutrition_scores_soi on public.nutrition_scores
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.profil_conseils enable row level security;
create policy profil_conseils_soi on public.profil_conseils
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.commandes enable row level security;
create policy commandes_soi on public.commandes
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- notes_nutritionniste — le client LIT (l'action de la semaine, cf. suivi.html)
-- mais n'écrit jamais : la note interne du nutritionniste ne doit pas pouvoir
-- être modifiée depuis l'app.
alter table public.notes_nutritionniste enable row level security;
create policy notes_lire_soi on public.notes_nutritionniste
  for select to authenticated
  using (auth.uid()::text = client_id);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ ÉTAPE 3 — le fil social : PAS ENCORE FAISABLE             ║
-- ╚═══════════════════════════════════════════════════════════╝
-- `meals`, `onboarding` et `questionnaire_alim` sont lues POUR LES AUTRES
-- MEMBRES par assets/social.js (prénom, poids, tdee, nb_repas, plats).
--
-- Or la RLS filtre des LIGNES, pas des COLONNES : autoriser autrui à lire la
-- ligne `onboarding` d'un membre pour son prénom lui donne du même coup son
-- email, son âge et son poids. Un `grant select (colonnes)` ne suffit pas non
-- plus, PostgREST demandant `select *` sur plusieurs chemins.
--
-- La bonne forme est une **vue exposant seulement le public** :
--
--   create view public.membre_public as
--     select o.user_id, o.prenom, o.poids, o.tdee
--     from public.onboarding o
--     left join public.membre_prefs p on p.user_id = o.user_id
--     where coalesce(p.fil_public, true);
--
-- …puis faire pointer social.js sur `membre_public` au lieu d'`onboarding`.
-- C'est une modification d'application, pas de SQL : à faire AVANT de toucher
-- à la RLS de ces trois tables. Sans ça, activer la RLS vide le fil social.


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ LE BLOQUEUR TRANSVERSAL : admin.html                      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- admin.html s'authentifie avec des mots de passe EN DUR dans le HTML
-- (Natty2026! / Chef2026! / Logistique2026!) et parle à Supabase avec la clé
-- anon. Il n'a donc aucune identité au sens de la base : `auth.uid()` y est
-- nul, et toute policy `to authenticated` l'exclut.
--
-- Deux issues, à trancher avec Pablo :
--   A. Comptes Supabase Auth pour l'équipe + une colonne de rôle, et des
--      policies « ou bien je suis le propriétaire, ou bien je suis staff ».
--      C'est la bonne fin, et elle supprime les mots de passe en dur.
--   B. Faire passer l'admin par des endpoints serveur qui utilisent
--      SUPABASE_SERVICE_KEY. Plus rapide, mais déplace le problème : il faut
--      alors protéger ces endpoints, donc de toute façon une vraie auth.
--
-- Tant que ce point n'est pas réglé, l'ÉTAPE 2 casse le back-office.


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ MIGRATION DES SESSIONS — à savoir avant d'activer         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- `core.js` retombe sur la clé anon quand aucune session n'existe. Les
-- utilisateurs connectés AVANT la bascule JWT n'ont que `natty_token` /
-- `natty_user_id` en localStorage : ils passeront donc en anon, et la RLS leur
-- videra l'écran au lieu de les renvoyer se connecter.
-- À vérifier avant l'étape 2 : que l'app détecte l'absence de session et
-- redirige vers login.html plutôt que d'afficher des données vides.


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ VÉRIFICATIONS                                             ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Où en est-on, table par table :
-- select relname, relrowsecurity
--   from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
--   order by relrowsecurity desc, relname;
--
-- Les policies en place :
-- select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public';
--
-- Marche arrière immédiate sur une table :
-- alter table public.X disable row level security;
