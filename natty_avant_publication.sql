-- ═══════════════════════════════════════════════════════════
-- Natty — ce qu'il reste à exécuter en base avant la publication
-- ───────────────────────────────────────────────────────────
-- Un seul endroit où regarder, dans l'ordre. Chaque point a été MESURÉ sur
-- l'instance le 2026-08-04, pas supposé : ce qui est déjà fait n'est pas listé.
--
-- ⚠️ Supabase → SQL Editor, une instruction à la fois, SANS les commentaires
--    (les `--` provoquent une erreur 42601 dans cet éditeur).
-- ═══════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. FERMER LA DERNIÈRE PORTE (sécurité — le seul bloquant) ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Mesuré aujourd'hui avec la SEULE clé anon publique — celle qui est écrite en
-- clair dans chaque page, donc dans le navigateur de n'importe qui :
--
--   abonnements      2 lignes  (user_id + identifiants Stripe + formule)
--   commandes        3 lignes
--   plats_menu       3 lignes  (catalogue, sans gravité)
--   nutritionnistes  3 lignes  (catalogue + emails professionnels)
--   membre_public   26 lignes  (prénom, poids, TDEE de 26 membres)
--
-- Tout le reste est déjà fermé (0 ligne). Ces cinq objets sont ce qui reste, et
-- `membre_public` est le plus gênant : c'est le poids de 26 personnes, lisible
-- sans compte.
--
-- ▸ Le SQL est déjà écrit : **natty_rls.sql, ÉTAPE 5** (le bloc `do $$ … $$`
--   puis `revoke select on public.membre_public from anon;`). Il est idempotent.
--
-- ▸ AVANT de le coller, vérifier que le § 5 de natty_staff.sql est passé, sinon
--   le back-office perd la vue sur les abonnements et les commandes :
--     select tablename from pg_policies
--      where schemaname='public' and policyname like '%\_staff' order by tablename;
--   `abonnements`, `commandes`, `plats_menu`, `nutritionnistes` doivent y être.
--
-- ▸ APRÈS, vérifier depuis un terminal (doit renvoyer [] partout) :
--     for t in abonnements commandes plats_menu nutritionnistes membre_public; do
--       curl -s "https://hrsvcelmwdlcswwagxfa.supabase.co/rest/v1/$t?select=*&limit=1" \
--         -H "apikey: <clé anon>" -H "Authorization: Bearer <clé anon>"; echo " <- $t"; done
--   Puis ouvrir l'app CONNECTÉE : le profil, l'offre et le fil social doivent
--   être inchangés. En cas de souci sur une table :
--     alter table public.<table> disable row level security;   -- retour immédiat


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. L'analyse d'un plat, d'un appareil à l'autre           ║
-- ╚═══════════════════════════════════════════════════════════╝
-- ▸ Fichier dédié : **natty_analyse_plat.sql** (une seule ligne).
--   Sans elle tout fonctionne, mais l'analyse reste sur l'appareil qui l'a
--   demandée : changer de téléphone la fait régénérer une fois.


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Le garde-manger, d'un appareil à l'autre               ║
-- ╚═══════════════════════════════════════════════════════════╝
-- `assets/garde-manger.js` détecte tout seul la présence de la table : tant
-- qu'elle manque, il bascule sur le localStorage et l'affiche à l'utilisateur
-- (« Liste gardée sur cet appareil uniquement »). Rien à redéployer après.
--
-- ⚠️ La RLS est posée ici DÈS LA CRÉATION, contrairement à l'historique du
-- projet : une table créée sans policy est ouverte à la clé anon, et celle-ci
-- contient ce que les gens ont dans leur frigo.

create table if not exists public.garde_manger (
  user_id    text primary key,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.garde_manger enable row level security;

create policy garde_manger_soi on public.garde_manger
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- Et l'accès de l'équipe, comme sur les autres tables (natty_staff.sql § 5 la
-- liste déjà : la relancer suffit, elle est idempotente).
create policy garde_manger_staff on public.garde_manger
  for all to authenticated
  using (public.est_staff()) with check (public.est_staff());


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Les doublons d'`onboarding` — À REGARDER, PAS À SUBIR  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- `onboarding.user_id` n'a aucune contrainte d'unicité, et la table contient de
-- vrais doublons — dont des lignes sans `poids` ni `tdee`. Conséquences réelles,
-- toutes contournées dans le code mais jamais corrigées à la source :
--   • un `limit=1` attrape une ligne au hasard → macros par défaut (2000 kcal)
--     au lieu du vrai TDEE ; c'est pourquoi la génération et `rappel-macros`
--     prennent « la première ligne exploitable » ;
--   • un second passage dans l'onboarding AJOUTE une ligne au lieu de corriger
--     la première (pas de `on_conflict` possible sans contrainte : PostgREST
--     répondrait 42P10).
--
-- Combien, et pour qui — commencer par regarder :
select user_id, count(*) as lignes,
       count(*) filter (where tdee is not null and poids is not null) as exploitables
  from public.onboarding group by user_id having count(*) > 1 order by lignes desc;

-- ⚠️ La suite SUPPRIME des lignes : ne la lancer qu'après avoir lu le relevé
-- ci-dessus, et seulement si les doublons sont bien des reliquats de tests.
-- Elle garde, pour chaque personne, la ligne la plus complète et la plus
-- récente. Décommenter pour l'exécuter.
--
-- delete from public.onboarding o
--  using (
--    select id from (
--      select id, row_number() over (
--               partition by user_id
--               order by (tdee is null), (poids is null), created_at desc) as rang
--        from public.onboarding) t
--     where rang > 1) doublons
--  where o.id = doublons.id;
--
-- create unique index if not exists onboarding_user_id_unique
--   on public.onboarding (user_id);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Optionnel — l'email des nutritionnistes                ║
-- ╚═══════════════════════════════════════════════════════════╝
-- `nutritionnistes` porte une colonne `email` (adresses professionnelles).
-- `offre.html` ne demande plus `select=*` mais les colonnes utiles ; la policy
-- de lecture reste cependant `to authenticated using (actif = true)`, donc un
-- membre connecté qui construit sa propre requête peut encore lire la colonne.
-- Ce sont des adresses de contact, pas des données de clients : ce n'est pas un
-- bloquant. Pour le fermer proprement le jour où on le voudra, la voie est la
-- vue `nutritionnistes_publics` (natty_rls.sql § 4) — elle N'EXISTE PAS encore
-- (vérifié : PGRST205), et il faudra alors faire passer `offre.html` dessus
-- AVANT de retirer la policy de lecture sur la table. Ordre inverse = écran
-- « choisissez votre nutritionniste » vide, donc plus aucune souscription.
