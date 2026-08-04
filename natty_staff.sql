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


-- § 5. Rouvrir le back-office. À EXÉCUTER MAINTENANT, PAS À L'ÉTAPE 2.
--      Ce paragraphe était prévu « en même temps que natty_rls.sql ». C'était
--      une erreur de séquencement, constatée le 2026-08-04 : dès que
--      `admin.html` se connecte par un compte, il parle à PostgREST en rôle
--      `authenticated` et non plus `anon`. Or plusieurs tables ont déjà la RLS
--      active avec des policies qui ne visent qu'`anon` — mesuré : `onboarding`
--      rend 31 lignes à la clé anon et **0** au JWT de l'admin, d'où une liste
--      clients vide alors que `offres_clients` (RLS inactive) affichait bien
--      ses 24 lignes. Le back-office est donc devenu aveugle AVANT l'activation
--      de la RLS, pas après.
--
--      Le bloc ci-dessous n'enlève rien et ne touche pas aux policies d'`anon` :
--      il ajoute, sur chaque table du back-office, une autorisation réservée
--      aux membres de l'équipe. Sur une table dont la RLS est encore inactive
--      il ne change rien aujourd'hui — et fait déjà le travail le jour où on
--      l'activera. Une seule instruction, sans commentaire : le SQL Editor
--      l'avale d'un bloc.

do $$
declare t text;
begin
  foreach t in array array[
    'onboarding','questionnaire_alim','messages','meals','meal_ingredients',
    'nutrition_scores','daily_macros','abonnements','commandes','offres_clients',
    'notes_nutritionniste','plans_repas','plats_menu','rdv','recettes',
    'recettes_ingredients','recettes_etapes','ingredients_base','stocks_mp',
    'profil_conseils','nutritionnistes','challenges','challenge_entreprise',
    'meal_likes','meal_vues','membre_amis','membre_prefs','garde_manger'
  ]
  loop
    if exists (select 1 from pg_class c
                where c.relnamespace = 'public'::regnamespace
                  and c.relname = t and c.relkind = 'r')
       and not exists (select 1 from pg_policies
                        where schemaname = 'public' and tablename = t
                          and policyname = t || '_staff')
    then
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.est_staff()) with check (public.est_staff())',
        t || '_staff', t);
    end if;
  end loop;
end $$;

--      Plusieurs policies sur une même table se cumulent en OU : « je suis le
--      propriétaire de la ligne » OU « je suis de l'équipe ». Il n'y a donc
--      rien à retoucher aux policies de natty_rls.sql.
--
--      Voir l'état réel, table par table — c'est cette requête qui a révélé le
--      décalage anon / authenticated :
-- select c.relname as nom_table, c.relrowsecurity as rls_active,
--        p.policyname, p.roles::text as roles, p.cmd
--   from pg_class c
--   left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
--  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
--  order by c.relname, p.policyname;


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
