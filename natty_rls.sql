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
-- ║ ÉTAPE 0 — À EXÉCUTER AVANT LA FUSION VERS main            ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Mesuré le 2026-08-04 avec un vrai compte connecté : SIX tables ont
-- déjà la RLS activée, avec des policies qui autorisent `anon` mais PAS
-- `authenticated`. Même requête, deux résultats :
--
--   onboarding      anon 31 lignes / connecté 0
--   messages        anon  3 / connecté 0
--   abonnements     anon  2 / connecté 0
--   commandes       anon  3 / connecté 0
--   plats_menu      anon  3 / connecté 0
--   nutritionnistes anon  3 / connecté 0
--
-- Personne ne l'a jamais vu parce que le front envoyait la clé anon. Depuis
-- la bascule JWT, un utilisateur CONNECTÉ ne lit plus son propre profil :
-- macros et TDEE retombent sur les valeurs par défaut, la messagerie et
-- l'abonnement paraissent vides, le menu et la liste des nutritionnistes
-- aussi. Sans cette étape, la fusion casse l'app pour tout le monde.

-- 0.1 Voir les policies en place et à qui elles s'adressent.
select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public'
order by tablename, policyname;

-- 0.2 Rendre ces six tables lisibles par leur propriétaire connecté.
create policy onboarding_soi_lecture on public.onboarding
  for select to authenticated using (auth.uid()::text = user_id);

create policy messages_soi_lecture on public.messages
  for select to authenticated using (auth.uid()::text = user_id);

create policy abonnements_soi_lecture on public.abonnements
  for select to authenticated using (auth.uid()::text = user_id);

create policy commandes_soi_lecture on public.commandes
  for select to authenticated using (auth.uid()::text = user_id);

-- Menu et nutritionnistes sont du catalogue : lisibles de tout connecté.
create policy plats_menu_lecture on public.plats_menu
  for select to authenticated using (true);

create policy nutritionnistes_lecture on public.nutritionnistes
  for select to authenticated using (actif = true);

-- 0.3 L'écriture aussi, sinon l'app ne peut plus rien enregistrer.
create policy onboarding_soi_ecriture on public.onboarding
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

create policy messages_soi_ecriture on public.messages
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

create policy commandes_soi_ecriture on public.commandes
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- 0.4 VÉRIFIER DANS L'APP que le profil, le chat et l'offre se remplissent
-- de nouveau. Ensuite seulement, retirer les policies `anon` — ce sont
-- elles, le trou : elles donnent tout à la clé publique. Lister d'abord
-- avec 0.1, puis pour chacune :
--   drop policy "<nom>" on public.<table>;
--
-- ⚠️ Les étapes 2 et 3 dupliquent certaines de ces policies. Si une
-- création échoue en « already exists », c'est normal : passer à la suivante.


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
-- ║ ÉTAPE 3 — le fil social : côté app, c'est fait            ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Le constat de départ reste le bon : la RLS filtre des LIGNES, pas des
-- COLONNES. Autoriser autrui à lire la ligne `onboarding` d'un membre pour
-- son prénom lui donnerait du même coup son email, son âge et son poids.
--
-- `assets/social.js` interroge désormais la vue `membre_public` définie
-- ci-dessous, et retombe sur les deux tables tant qu'elle n'existe pas —
-- donc ce bloc peut être exécuté sans rien casser, et l'app basculera
-- d'elle-même. (Commit « Fil social : lire les autres membres par une vue ».)

-- La vue est en security definer (le défaut) : c'est volontaire, c'est elle
-- la fenêtre contrôlée qui lit `onboarding` malgré sa RLS. Elle n'expose que
-- les colonnes nécessaires et écarte déjà les membres retirés du fil.
-- distinct on : un membre peut avoir plusieurs lignes d'onboarding (la base
-- en contient), on garde celle qui porte un tdee, sinon la plus récente.
create or replace view public.membre_public as
select distinct on (o.user_id)
       o.user_id,
       o.prenom,
       o.poids,
       o.tdee,
       (select q.nb_repas from public.questionnaire_alim q
         where q.user_id::text = o.user_id::text limit 1) as nb_repas
from public.onboarding o
left join public.membre_prefs p on p.user_id::text = o.user_id::text
where coalesce(p.fil_public, true)
order by o.user_id, (o.tdee is null), o.created_at desc;

grant select on public.membre_public to authenticated;

-- Une fois la vue en place, ces deux tables peuvent passer en RLS
-- propriétaire-seul sans vider le fil.
-- ⚠️ Mais pas avant d'avoir réglé admin.html (bloc suivant).
alter table public.onboarding enable row level security;
create policy onboarding_soi on public.onboarding
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

alter table public.questionnaire_alim enable row level security;
create policy questionnaire_alim_soi on public.questionnaire_alim
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- `meals`, lui, doit rester lisible par les autres : c'est le fil lui-même.
-- Deux filtres, tous deux optionnels — une valeur NULL vaut « public ».
alter table public.meals enable row level security;

create policy meals_soi on public.meals
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

create policy meals_fil on public.meals
  for select to authenticated
  using (
    coalesce(partage, true)
    and not exists (
      select 1 from public.membre_prefs p
      where p.user_id::text = meals.user_id::text and p.fil_public = false
    )
  );

-- meal_ingredients n'a pas de user_id : on passe par le repas parent.
alter table public.meal_ingredients enable row level security;

create policy meal_ingredients_soi on public.meal_ingredients
  for all to authenticated
  using (exists (select 1 from public.meals m
                  where m.id = meal_ingredients.meal_id
                    and m.user_id = auth.uid()::text))
  with check (exists (select 1 from public.meals m
                  where m.id = meal_ingredients.meal_id
                    and m.user_id = auth.uid()::text));

create policy meal_ingredients_fil on public.meal_ingredients
  for select to authenticated
  using (exists (
    select 1 from public.meals m
    where m.id = meal_ingredients.meal_id
      and coalesce(m.partage, true)
      and not exists (
        select 1 from public.membre_prefs p
        where p.user_id::text = m.user_id::text and p.fil_public = false
      )
  ));

-- J'aime, vues, abonnements : compteurs lisibles de tous, écriture en son
-- seul nom. membre_prefs doit rester lisible — c'est la table que les
-- policies du fil interrogent.
alter table public.meal_likes enable row level security;
create policy meal_likes_lecture on public.meal_likes for select to authenticated using (true);
create policy meal_likes_ajout on public.meal_likes
  for insert to authenticated with check (auth.uid()::text = user_id);
create policy meal_likes_retrait on public.meal_likes
  for delete to authenticated using (auth.uid()::text = user_id);

alter table public.meal_vues enable row level security;
create policy meal_vues_lecture on public.meal_vues for select to authenticated using (true);
create policy meal_vues_ajout on public.meal_vues
  for insert to authenticated with check (auth.uid()::text = user_id);

alter table public.membre_amis enable row level security;
create policy membre_amis_lecture on public.membre_amis for select to authenticated using (true);
create policy membre_amis_ajout on public.membre_amis
  for insert to authenticated with check (auth.uid()::text = user_id);
create policy membre_amis_retrait on public.membre_amis
  for delete to authenticated using (auth.uid()::text = user_id);

alter table public.membre_prefs enable row level security;
create policy membre_prefs_lecture on public.membre_prefs for select to authenticated using (true);
create policy membre_prefs_sienne on public.membre_prefs
  for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ ÉTAPE 4 — catalogue et back-office                        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Le catalogue se lit, ne s'écrit pas depuis l'app.
alter table public.plats_menu enable row level security;
create policy plats_menu_lecture on public.plats_menu for select to authenticated using (true);

alter table public.recettes enable row level security;
create policy recettes_lecture on public.recettes for select to authenticated using (true);

alter table public.recettes_ingredients enable row level security;
create policy recettes_ingredients_lecture on public.recettes_ingredients for select to authenticated using (true);

alter table public.recettes_etapes enable row level security;
create policy recettes_etapes_lecture on public.recettes_etapes for select to authenticated using (true);

alter table public.ingredients_base enable row level security;
create policy ingredients_base_lecture on public.ingredients_base for select to authenticated using (true);

-- Stocks : purement interne, aucune policy donc aucun accès client.
alter table public.stocks_mp enable row level security;

-- `nutritionnistes` expose mdp_hash, qui n'est pas un hash mais du base64
-- (TnV0cmkyNg== = Nutri26), aujourd'hui lisible par n'importe qui.
-- offre.html n'a besoin que du nom, de la photo et des spécialités.
alter table public.nutritionnistes enable row level security;

create or replace view public.nutritionnistes_publics as
  select id, nom, specialites, photo_url, bio, actif
  from public.nutritionnistes where actif = true;

grant select on public.nutritionnistes_publics to authenticated;

-- ⚠️ Puis dans offre.html : "nutritionnistes?actif=eq.true&select=*"
--    devient "nutritionnistes_publics?select=*".
-- ⚠️ Et faire tourner les trois mots de passe de démo, qui ont circulé.


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ LE BLOQUEUR TRANSVERSAL : admin.html — côté app, c'est fait║
-- ╚═══════════════════════════════════════════════════════════╝
-- admin.html s'authentifiait avec des mots de passe EN DUR dans le HTML
-- (Natty2026! / Chef2026! / Logistique2026!) et parlait à Supabase avec la clé
-- anon : aucune identité au sens de la base, donc toute policy
-- `to authenticated` l'excluait.
--
-- Pablo a tranché pour l'option A (2026-08-03). C'est fait côté application :
-- le back-office se connecte par Supabase Auth, envoie le JWT de la personne
-- connectée à PostgREST, et lit son rôle dans la table `staff`.
--
-- ⚠️ IL RESTE À CRÉER LES COMPTES : voir **natty_staff.sql**, § 1 à 3. Tant
--    qu'aucun compte n'existe, admin.html accepte encore les anciens mots de
--    passe (avec un bandeau rouge qui le dit) pour ne enfermer personne
--    dehors — et ce secours se ferme TOUT SEUL dès la première ligne insérée
--    dans `staff`, sans nouveau déploiement.
--
-- Les policies qui rouvrent les tables à l'équipe sont au § 5 de
-- natty_staff.sql : à exécuter EN MÊME TEMPS que l'étape 2 ci-dessus, jamais
-- avant le § 3 — sinon `est_staff()` ne reconnaît personne et l'admin reste
-- aveugle.


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
-- ║ ÉTAPE 5 — ce qui reste ouvert à anon (mesuré le 2026-08-04)║
-- ╚═══════════════════════════════════════════════════════════╝
-- Les étapes ci-dessus sont EXÉCUTÉES. Relevé refait table par table avec la
-- seule clé anon publique, après coup : `onboarding`, `meals`,
-- `meal_ingredients`, `messages`, `nutrition_scores`, `questionnaire_alim`,
-- `profil_conseils`, `notes_nutritionniste`, `daily_macros`, `challenges`,
-- `membre_*`, `meal_likes`, `meal_vues`, `staff`, `appareils`, `push_etat`,
-- `rdv`, `plans_repas`, `stocks_mp`, `recettes*`, `ingredients_base`,
-- `offres_clients` → **0 ligne**. `nutritionnistes.mdp_hash` a disparu.
--
-- Quatre tables et une vue répondent encore à la clé anon :
--   abonnements     2 lignes   (user_id + statut d'abonnement)
--   commandes       3 lignes
--   plats_menu      3 lignes   (catalogue)
--   nutritionnistes 3 lignes   (catalogue, mdp_hash retiré)
--   membre_public  26 lignes   (prénom, poids, tdee — une VUE, donc hors RLS :
--                               c'est un GRANT, pas une policy)
--
-- 🔴 NE PAS EXÉCUTER CE BLOC AVANT QUE `main` NE SERVE LE CODE D'app-native.
--    La prod déployée depuis `main` interroge Supabase avec la clé anon et
--    RIEN d'autre (`index.html` : `Authorization: Bearer SB_KEY`, 7 fois).
--    Ces quatre tables sont donc littéralement tout ce qui lui répond encore.
--    Les fermer maintenant, c'est finir d'éteindre la prod ; les fermer après
--    le déploiement, c'est refermer la dernière porte. L'ordre est : déployer,
--    vérifier l'app connectée, puis coller ceci.
--
-- Le bloc pose d'abord la lecture `authenticated` là où elle manquerait — sans
-- ça, retirer anon rendrait l'offre et le menu vides pour tout le monde — puis
-- retire toute policy adressée à anon sur ces quatre tables. Idempotent.

do $$
declare p record;
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='abonnements' and policyname='abonnements_lire_soi') then
    execute 'create policy abonnements_lire_soi on public.abonnements for select to authenticated using (auth.uid()::text = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='commandes' and policyname='commandes_soi') then
    execute 'create policy commandes_soi on public.commandes for all to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='plats_menu' and policyname='plats_menu_lecture') then
    execute 'create policy plats_menu_lecture on public.plats_menu for select to authenticated using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                  and tablename='nutritionnistes' and policyname='nutritionnistes_lecture') then
    execute 'create policy nutritionnistes_lecture on public.nutritionnistes for select to authenticated using (actif = true)';
  end if;

  for p in select tablename, policyname from pg_policies
            where schemaname='public'
              and tablename in ('abonnements','commandes','plats_menu','nutritionnistes')
              and 'anon' = any(roles)
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- La vue `membre_public` : Supabase accorde par défaut le SELECT à `anon` sur
-- tout nouvel objet du schéma public. La vue est en security definer, donc ce
-- grant contourne la RLS d'`onboarding` — c'est bien pour ça qu'elle existe,
-- mais pour les membres CONNECTÉS, pas pour la clé publique.
revoke select on public.membre_public from anon;

-- Vérifier ensuite, avec la seule clé anon (doit renvoyer 0 ligne partout) :
--   curl -s "$SB/rest/v1/abonnements?select=user_id" -H "apikey: <anon>" -H "Authorization: Bearer <anon>"


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
