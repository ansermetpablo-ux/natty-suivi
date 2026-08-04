-- ═══════════════════════════════════════════════════════════
-- Natty — Une identité en base pour l'équipe (option A)
-- ───────────────────────────────────────────────────────────
-- POURQUOI. `admin.html` s'authentifie aujourd'hui avec des mots de passe
-- écrits en clair dans le HTML (Natty2026! / Chef2026! / Logistique2026!) et
-- parle à Supabase avec la clé anon. Le back-office n'a donc AUCUNE identité
-- au sens de la base : `auth.uid()` y est nul. Toute policy RLS l'exclurait,
-- et le jour où l'on active la RLS l'admin ne voit plus rien.
--
-- Ce fichier crée le chaînon manquant : un compte Supabase Auth par personne,
-- et une table qui dit quel rôle chacun occupe.
--
-- ⚠️ ORDRE D'EXÉCUTION — les comptes AVANT les lignes `staff`.
--    Un compte Auth ne se crée pas en SQL : passer par
--    Supabase → Authentication → Users → « Add user » (email + mot de passe,
--    cocher « Auto Confirm User »). Récupérer l'UUID affiché, il sert au § 3.
-- ═══════════════════════════════════════════════════════════


-- § 1. Qui fait partie de l'équipe, et à quel titre.
--      `user_id` est du TEXTE, comme partout ailleurs dans ce schéma
--      (`meals.user_id`, `onboarding.user_id`…) — surtout pas un uuid, sinon
--      les comparaisons avec le reste du schéma deviennent bancales.
create table if not exists public.staff (
  user_id           text primary key,
  role              text not null check (role in ('admin','nutritionniste','chef','logistique')),
  nom               text,
  nutritionniste_id uuid,          -- lien vers public.nutritionnistes, si le rôle l'exige
  actif             boolean not null default true,
  created_at        timestamptz not null default now()
);

-- RLS activée : personne ne lit cette table avec la clé anon. Un membre de
-- l'équipe lit UNIQUEMENT sa propre ligne, pour connaître son rôle.
alter table public.staff enable row level security;

create policy staff_lire_soi on public.staff
  for select to authenticated
  using (auth.uid()::text = user_id);


-- § 2. Les deux fonctions que le reste du système utilisera.
--      SECURITY DEFINER : elles lisent `staff` en passant au-dessus de la RLS,
--      sans jamais exposer la table elle-même.

-- « La personne connectée fait-elle partie de l'équipe ? » — c'est cette
-- fonction que les policies RLS appelleront (voir natty_rls.sql).
create or replace function public.est_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where user_id = auth.uid()::text and actif
  );
$$;

grant execute on function public.est_staff() to authenticated;

-- « Y a-t-il au moins un compte d'équipe configuré ? » — appelée par
-- admin.html AVANT connexion, donc ouverte à anon. Elle ne renvoie qu'un
-- booléen : ni qui, ni combien, ni aucune adresse.
--
-- À quoi elle sert : tant qu'aucun compte n'existe, admin.html accepte encore
-- les anciens mots de passe, pour ne pas t'enfermer dehors. Dès que tu insères
-- ta première ligne au § 3, cette fonction renvoie `true` et le mode de secours
-- se ferme TOUT SEUL — sans nouveau déploiement, et sans laisser traîner une
-- porte ouverte qu'on oublierait de refermer.
create or replace function public.staff_configure()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where actif);
$$;

grant execute on function public.staff_configure() to anon, authenticated;


-- § 3. Tes comptes. À exécuter APRÈS les avoir créés dans Authentication.
--      Remplacer les UUID par ceux affichés par Supabase.
--
-- insert into public.staff (user_id, role, nom) values
--   ('UUID-DU-COMPTE-DE-PABLO', 'admin', 'Pablo');
--
-- Pour un ou une nutritionniste, relier sa ligne de `nutritionnistes` :
-- insert into public.staff (user_id, role, nom, nutritionniste_id) values
--   ('UUID-DU-COMPTE', 'nutritionniste', 'Sophie Martin',
--    (select id from public.nutritionnistes where email = 'sophie@natty.fr'));
--
-- Chef et logistique :
-- insert into public.staff (user_id, role, nom) values
--   ('UUID-DU-COMPTE', 'chef', 'Cuisine'),
--   ('UUID-DU-COMPTE', 'logistique', 'Logistique');


-- § 4. Vérifications.
-- select role, nom, actif from public.staff order by role;
-- select public.staff_configure();     -- doit renvoyer true une fois le § 3 fait
--
-- Retirer quelqu'un sans effacer son historique :
-- update public.staff set actif = false where user_id = '…';


-- § 5. Rouvrir le back-office une fois la RLS activée.
--      `natty_rls.sql` ferme les tables au seul propriétaire des lignes. Ces
--      policies-ci rendent l'équipe capable de faire son travail — et elles ne
--      peuvent exister qu'APRÈS le § 3, sinon `est_staff()` ne reconnaît
--      personne et l'admin reste aveugle.
--
--      À exécuter en même temps que l'étape 2 de natty_rls.sql, pas avant.

-- create policy onboarding_staff on public.onboarding
--   for all to authenticated using (public.est_staff()) with check (public.est_staff());
-- create policy messages_staff on public.messages
--   for all to authenticated using (public.est_staff()) with check (public.est_staff());
-- create policy nutrition_scores_staff on public.nutrition_scores
--   for select to authenticated using (public.est_staff());
-- create policy questionnaire_alim_staff on public.questionnaire_alim
--   for select to authenticated using (public.est_staff());
-- create policy commandes_staff on public.commandes
--   for all to authenticated using (public.est_staff()) with check (public.est_staff());
-- create policy notes_staff on public.notes_nutritionniste
--   for all to authenticated using (public.est_staff()) with check (public.est_staff());
-- create policy meals_staff on public.meals
--   for select to authenticated using (public.est_staff());
-- create policy abonnements_staff on public.abonnements
--   for select to authenticated using (public.est_staff());

--      Plusieurs policies sur une même table se cumulent en OU : « je suis le
--      propriétaire de la ligne » OU « je suis de l'équipe ». Il n'y a donc
--      rien à retoucher aux policies de natty_rls.sql.


-- § 6. Où j'en suis, et comment me rouvrir la porte.
--      Le nouveau admin.html est en ligne depuis le 2026-08-04, et
--      `staff_configure()` renvoie déjà `true` : les mots de passe partagés
--      (Natty2026! / Chef2026! / Logistique2026!) sont donc REFUSÉS en prod.
--      Seuls les comptes de la table `staff` entrent.
--
-- Qui a un compte Auth, et qui a sa ligne d'équipe :
-- select u.id, u.email, u.email_confirmed_at is not null as confirme,
--        s.role, s.nom, s.actif
--   from auth.users u
--   left join public.staff s on s.user_id = u.id::text
--  order by u.created_at;
--
-- Les comptes créés dans Authentication mais oubliés au § 3 (ils ne peuvent
-- pas entrer : « Ce compte n'appartient pas à l'équipe. ») :
-- select u.email, u.id from auth.users u
--  where not exists (select 1 from public.staff s where s.user_id = u.id::text);
--
-- ⚠️ ENFERMÉ DEHORS ? Repasser toutes les lignes en inactif rouvre le mode de
--    secours (mots de passe partagés) le temps de se remettre d'aplomb —
--    `staff_configure()` retombe à false, sans redéploiement :
-- update public.staff set actif = false;
--    Puis, une fois le bon compte prêt, refermer :
-- update public.staff set actif = true where user_id = '…';


-- ═══════════════════════════════════════════════════════════
-- ⚠️ À FAIRE ENSUITE, ET C'EST LIÉ : les mots de passe des nutritionnistes
-- ───────────────────────────────────────────────────────────
-- `nutritionnistes.mdp_hash` n'est pas un hachage : c'est du **base64**, donc
-- réversible en une ligne. Or la table est lisible avec la clé anon publique —
-- n'importe qui peut donc lire les mots de passe de toute l'équipe.
--
-- Une fois chaque nutritionniste doté d'un compte Auth (§ 3), la colonne n'a
-- plus de raison d'exister :
-- alter table public.nutritionnistes drop column mdp_hash;
--
-- Ne le faire qu'APRÈS avoir vérifié que chacun se connecte avec son compte.
-- ═══════════════════════════════════════════════════════════
