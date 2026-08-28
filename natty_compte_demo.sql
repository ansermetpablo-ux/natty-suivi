-- Garnit le compte de demonstration soumis a l'examen Apple.
--
-- A LANCER DANS LE SQL EDITOR DE SUPABASE (role service). La cle anon ne peut
-- rien ecrire ici : les tables sont sous RLS « soi seulement » depuis le
-- 2026-08-04, et c'est tres bien ainsi.
--
-- IDEMPOTENT. Relancable autant de fois qu'on veut : les lignes de
-- demonstration sont retirees avant d'etre reecrites. Les repas de demo se
-- reconnaissent a leur photo, servie depuis le catalogue de l'app — les vrais
-- repas, eux, vont sur Cloudinary. Aucun repas reel n'est donc touche.
--
-- Ce que ca NE fait pas, et qui reste a faire dans l'app une fois connecte :
--   1. generer la semaine (bouton depuis Suivi ou Repas, ~90 s) — les conseils,
--      les 2 recettes, les 3 plats macro et la liste de courses ;
--   2. planifier la semaine — la sequence s'ouvre d'elle-meme.
-- Ces deux-la valent mieux faits par l'app : ils produisent du contenu reel.

do $do$
declare
  uid  text;
  m_id uuid;
begin
  select id::text into uid from auth.users where lower(email) = lower('contact@trait-tendance.com');
  if uid is null then
    raise exception 'Aucun compte auth pour % — creez-le dans Authentication > Users, puis relancez.', 'contact@trait-tendance.com';
  end if;
  raise notice 'Compte trouve : %', uid;

  ----------------------------------------------------------------------------
  -- Profil
  ----------------------------------------------------------------------------
  -- On efface d'abord : onboarding.user_id n'a AUCUNE contrainte d'unicite et
  -- la table contient de vrais doublons. Sans ce delete, un second passage
  -- ajouterait une ligne, et la lecture limit=1 en attraperait une au hasard —
  -- dont peut-etre une sans poids ni tdee, donc des anneaux a zero.
  delete from onboarding where user_id = uid;
  insert into onboarding (
    user_id, prenom, email, sexe, age, poids, taille, activite,
    bmr, tdee, deficit, maturite, motivation, objectif_type, axe_amelioration,
    score_motivation, score_rigueur, score_nutrition, completed, rgpd_accepte
  ) values (
    uid, 'Camille', 'contact@trait-tendance.com', 'homme', 32, 72, 178, 'modere',
    1678, 2601, 390, 'premiers_pas', 'mieux_manger', 'mieux_manger', 'equilibre',
    8, 6, 5, true, true
  );
  -- Cibles qui en decoulent (calcMacros de suivi.html) :
  --   2601 kcal · 144 g de proteines · 325 g de glucides · 72 g de lipides

  ----------------------------------------------------------------------------
  -- Preferences alimentaires
  ----------------------------------------------------------------------------
  -- Sans une ligne ici, l'app renvoie au questionnaire des l'ouverture.
  -- nb_repas commande le decoupage en creneaux, donc les cibles par repas :
  -- c'est un LIBELLE ('3'), pas un entier — parseInt('1_2') vaudrait 1.
  delete from questionnaire_alim where user_id = uid;
  insert into questionnaire_alim (user_id, nb_repas, snacking, repas_sautes, frequence_cuisine, completed_at)
  values (uid, '3', 'jamais', 'jamais', 'souvent', now());

  ----------------------------------------------------------------------------
  -- Repas deja notes
  ----------------------------------------------------------------------------
  -- Deux aujourd'hui (petit-dejeuner et dejeuner) pour que les anneaux montrent
  -- une progression credible — ni vides, ni pleins — et deux les jours d'avant
  -- pour que l'historique et les graphiques ne soient pas nus.
  delete from meal_ingredients where meal_id in (
    select id from meals where user_id = uid and photo_url like '%/assets/img/decouverte/%');
  delete from meals where user_id = uid and photo_url like '%/assets/img/decouverte/%';

  -- Bowl açaí & fruits rouges — 485 kcal · P 17 · G 76 · L 16
  insert into meals (user_id, name, photo_url, meal_date, created_at, partage)
  values (uid, 'Bowl açaí & fruits rouges', 'https://natty-suivi.vercel.app/assets/img/decouverte/bre-acai-bowl.jpg',
          current_date - 0,
          ((current_date - 0)::text || ' 08:12:00+02')::timestamptz, true)
  returning id into m_id;
  insert into meal_ingredients (meal_id, name, quantity_g, calories, proteins_g, carbs_g, fats_g) values
    (m_id, 'Banane', 120, 107, 1.3, 27.6, 0.4),
    (m_id, 'Myrtilles', 80, 46, 0.6, 11.2, 0.2),
    (m_id, 'Flocons d’avoine', 40, 156, 6.8, 26.4, 2.8),
    (m_id, 'Yaourt grec', 150, 89, 5.3, 7.1, 4.9),
    (m_id, 'Amandes', 15, 87, 3.2, 3.3, 7.5);

  -- Pita saumon & feta — 648 kcal · P 37 · G 43 · L 35
  insert into meals (user_id, name, photo_url, meal_date, created_at, partage)
  values (uid, 'Pita saumon & feta', 'https://natty-suivi.vercel.app/assets/img/decouverte/quo-pita-saumon-feta.jpg',
          current_date - 0,
          ((current_date - 0)::text || ' 12:41:00+02')::timestamptz, true)
  returning id into m_id;
  insert into meal_ingredients (meal_id, name, quantity_g, calories, proteins_g, carbs_g, fats_g) values
    (m_id, 'Pain pita', 80, 212, 7.2, 39.2, 2.6),
    (m_id, 'Saumon', 120, 250, 24, 0, 15.6),
    (m_id, 'Feta', 40, 106, 5.6, 1.6, 8.4),
    (m_id, 'Concombre', 60, 9, 0.4, 2.2, 0.1),
    (m_id, 'Huile d’olive', 8, 71, 0, 0, 8);

  -- Souvlaki de poulet — 593 kcal · P 61 · G 45 · L 17
  insert into meals (user_id, name, photo_url, meal_date, created_at, partage)
  values (uid, 'Souvlaki de poulet', 'https://natty-suivi.vercel.app/assets/img/decouverte/gre-souvlaki-poulet.jpg',
          current_date - 1,
          ((current_date - 1)::text || ' 19:47:00+02')::timestamptz, true)
  returning id into m_id;
  insert into meal_ingredients (meal_id, name, quantity_g, calories, proteins_g, carbs_g, fats_g) values
    (m_id, 'Poulet', 180, 297, 55.8, 0, 6.5),
    (m_id, 'Riz', 140, 182, 3.8, 39.2, 0.4),
    (m_id, 'Tomate', 80, 14, 0.7, 3.1, 0.2),
    (m_id, 'Oignon', 30, 12, 0.3, 2.7, 0),
    (m_id, 'Huile d’olive', 10, 88, 0, 0, 10);

  -- Bento saumon — 559 kcal · P 37 · G 53 · L 21
  insert into meals (user_id, name, photo_url, meal_date, created_at, partage)
  values (uid, 'Bento saumon', 'https://natty-suivi.vercel.app/assets/img/decouverte/jap-bento-saumon.jpg',
          current_date - 2,
          ((current_date - 2)::text || ' 12:33:00+02')::timestamptz, true)
  returning id into m_id;
  insert into meal_ingredients (meal_id, name, quantity_g, calories, proteins_g, carbs_g, fats_g) values
    (m_id, 'Saumon', 130, 270, 26, 0, 16.9),
    (m_id, 'Riz', 150, 195, 4.1, 42, 0.5),
    (m_id, 'Edamame', 60, 73, 6.6, 5.9, 3.1),
    (m_id, 'Carotte', 50, 21, 0.5, 5, 0.1);

  raise notice 'Termine : profil, preferences et 4 repas en place.';
end $do$;

----------------------------------------------------------------------------
-- Ce que les anneaux afficheront aujourd'hui
--   consomme : 1133 kcal · P 54 · G 119 · L 51
--   restant   : 1468 kcal · P 90 · G 206 · L 22
-- Aucun anneau ni a zero ni au maximum : c'est ce qu'on veut sur une capture.
----------------------------------------------------------------------------

-- Verification
select o.prenom, o.poids, o.tdee, qa.nb_repas,
       (select count(*) from meals m where m.user_id = o.user_id) as repas_total,
       (select count(*) from meals m where m.user_id = o.user_id and m.meal_date = current_date) as repas_du_jour
from onboarding o
left join questionnaire_alim qa on qa.user_id = o.user_id
where o.user_id = (select id::text from auth.users where lower(email) = lower('contact@trait-tendance.com'));
