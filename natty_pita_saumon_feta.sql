-- Natty — poser « Pita au saumon et feta » comme PROCHAIN REPAS de
-- pabloboy77te@gmail.com, dans la semaine en cours.
--
-- À exécuter dans Supabase → SQL Editor, en une fois (ce fichier est un seul
-- bloc `do $$ … $$`, contrairement aux autres natty_*.sql qui se collent
-- requête par requête).
--
-- POURQUOI DU SQL ET PAS UN ÉCRAN. `planning_semaine` est sous RLS avec une
-- policy « soi seulement » : la clé anon publique ne voit ni ne modifie le plan
-- de qui que ce soit, et l'admin n'a pas d'éditeur de planification. Écrire
-- dans la semaine de quelqu'un d'autre demande donc la clé service, qui ne vit
-- que dans les variables d'environnement Vercel.
--
-- CE QUE ÇA FAIT
--   1. retrouve l'identifiant du compte depuis son email ;
--   2. calcule le lundi de la semaine, le jour et le créneau COURANTS, à
--      l'heure de Paris et avec exactement les bornes de `creneauIndex()`
--      (3 h-11 h = matin, 11 h-16 h = midi, sinon dîner) ;
--   3. remplace ce qui occupait ce créneau par le pita, en gardant le reste de
--      la semaine intact ;
--   4. crée la ligne si la personne n'avait pas encore de plan.
--
-- ⚠️ « Maintenant » est calculé AU MOMENT OÙ LA REQUÊTE TOURNE. Lancée à 19 h,
-- elle pose le plat sur le dîner ; lancée le lendemain matin, sur le petit
-- déjeuner. C'est voulu — mais ça veut dire qu'on ne la rejoue pas « pour voir »
-- sans regarder l'heure.
--
-- ⚠️ Le plat porte `cle: 'quo-pita-saumon-feta'` : c'est son entrée au
-- catalogue (`assets/decouverte.js`, régénérée dans `api/_catalogue.js`), et
-- c'est elle qui lui donne son illustration à l'écran. Sans cette clé, le
-- calendrier retomberait sur les deux photos de démonstration — l'assiette d'un
-- AUTRE plat.

do $$
declare
  v_email    text := 'pabloboy77te@gmail.com';
  v_user     text;
  v_now      timestamp := now() at time zone 'Europe/Paris';
  v_lundi    date;
  v_jour     int;
  v_heure    int;
  v_creneau  int;
  v_repas    jsonb;
  v_liste    jsonb;
begin
  select id::text into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'Aucun compte pour %', v_email;
  end if;

  -- `date_trunc('week', …)` rend le lundi : c'est la même semaine que
  -- `NattyPlanning.lundi()`, qui compte lui aussi à partir du lundi.
  v_lundi := date_trunc('week', v_now)::date;
  v_jour  := extract(isodow from v_now)::int - 1;      -- lundi = 0
  v_heure := extract(hour from v_now)::int;
  v_creneau := case
    when v_heure >= 3  and v_heure < 11 then 0         -- petit déjeuner
    when v_heure >= 11 and v_heure < 16 then 1         -- midi
    else 2                                             -- dîner (16 h → 3 h)
  end;

  /* La recette complète vit sous `src` : c'est là que `repas.html` va chercher
     les étapes pour lancer la cinématique. Un repas placé sans `src.steps` ne
     serait que consultable — le défaut corrigé le 2026-08-16. */
  v_repas := jsonb_build_object(
    'jour', v_jour,
    'creneau', v_creneau,
    'type', 'recette',
    'macro', null,
    'nom', 'Pita au saumon et feta',
    'em', '🥙',
    'cle', 'quo-pita-saumon-feta',
    'photo', null,
    'illu', null,
    'pourquoi', 'Des protéines complètes sans lourdeur : le saumon et la feta portent le plat, le yaourt remplace la sauce.',
    'kcal', 600, 'p', 42, 'g', 43, 'l', 28,
    'manque', 0,
    'ingredients', jsonb_build_array(
      jsonb_build_object('em','🫓','nom','Pain pita','qte','2 pains'),
      jsonb_build_object('em','🐟','nom','Saumon','qte','130 g'),
      jsonb_build_object('em','🧀','nom','Feta','qte','40 g'),
      jsonb_build_object('em','🥒','nom','Concombre','qte','80 g'),
      jsonb_build_object('em','🥕','nom','Carotte','qte','80 g'),
      jsonb_build_object('em','🥛','nom','Yaourt','qte','60 g'),
      jsonb_build_object('em','🌿','nom','Aneth','qte','quelques brins'),
      jsonb_build_object('em','🍋','nom','Citron','qte','1/2')
    ),
    'src', jsonb_build_object(
      'cle', 'quo-pita-saumon-feta',
      'nom', 'Pita au saumon et feta',
      'pourquoi', 'Des protéines complètes sans lourdeur : le saumon et la feta portent le plat, le yaourt remplace la sauce.',
      'temps_min', 20,
      'macros', jsonb_build_object('p',42,'g',43,'l',28,'kcal',600),
      'ingredients', jsonb_build_array(
        jsonb_build_object('em','🫓','nom','Pain pita','qte','2 pains'),
        jsonb_build_object('em','🐟','nom','Saumon','qte','130 g'),
        jsonb_build_object('em','🧀','nom','Feta','qte','40 g'),
        jsonb_build_object('em','🥒','nom','Concombre','qte','80 g'),
        jsonb_build_object('em','🥕','nom','Carotte','qte','80 g'),
        jsonb_build_object('em','🥛','nom','Yaourt','qte','60 g'),
        jsonb_build_object('em','🌿','nom','Aneth','qte','quelques brins'),
        jsonb_build_object('em','🍋','nom','Citron','qte','1/2')
      ),
      -- `illu` nomme une action de la bibliothèque d'`assets/recette.js`. Une
      -- clé inconnue y retomberait sur `melanger` : celles-ci existent toutes.
      'steps', jsonb_build_array(
        jsonb_build_object('em','🥕','illu','couper','t','Taille le concombre et la carotte en bâtonnets','tip','Des bâtonnets plutôt que des rondelles : ça tient dans le pita au lieu de glisser.'),
        jsonb_build_object('em','🥛','illu','melanger','t','Mélange le yaourt, l''aneth ciselé et le jus d''un demi-citron','tip','Sale légèrement : la feta salera déjà le pita.'),
        jsonb_build_object('em','🐟','illu','saisir','t','Saisis le saumon 3 min par face à la poêle','tip','Peau vers le bas d''abord, sans y toucher : c''est ce qui la rend croustillante.'),
        jsonb_build_object('em','🫓','illu','enfourner','t','Tiédis les pains pita 2 min à 180 °C','tip','Tiède, ils se plient sans casser.'),
        jsonb_build_object('em','🥙','illu','dresser','t','Garnis : crème au yaourt, crudités, saumon émietté, feta','tip','La crème en premier, contre le pain : elle l''empêche de se détremper.')
      )
    )
  );

  -- Le créneau visé est vidé, le reste de la semaine reste tel quel, et
  -- l'ensemble est retrié par (jour, créneau) — c'est l'ordre dans lequel
  -- `repas.html` fait défiler les repas au doigt.
  select coalesce(jsonb_agg(x.e order by (x.e->>'jour')::int, (x.e->>'creneau')::int), '[]'::jsonb)
    into v_liste
    from (
      select el.e
        from planning_semaine ps
        cross join lateral jsonb_array_elements(coalesce(ps.plan->'repas', '[]'::jsonb)) as el(e)
       where ps.user_id = v_user
         and ps.semaine = v_lundi
         and not ((el.e->>'jour')::int = v_jour and (el.e->>'creneau')::int = v_creneau)
      union all
      select v_repas
    ) as x(e);

  insert into planning_semaine (user_id, semaine, plan, updated_at)
  values (v_user, v_lundi,
          jsonb_build_object('semaine', v_lundi::text, 'repas', v_liste),
          now())
  on conflict (user_id, semaine) do update
    set plan = coalesce(planning_semaine.plan, '{}'::jsonb)
               || jsonb_build_object('semaine', v_lundi::text, 'repas', v_liste),
        updated_at = now();

  raise notice 'Pita posé pour % — semaine du %, jour % (0=lundi), créneau % (0=matin,1=midi,2=soir)',
    v_email, v_lundi, v_jour, v_creneau;
end $$;

-- Vérification : doit lister le pita, sur le créneau courant.
-- select semaine, e->>'nom' as plat, (e->>'jour')::int as jour, (e->>'creneau')::int as creneau,
--        jsonb_array_length(e->'src'->'steps') as etapes
--   from planning_semaine ps,
--        lateral jsonb_array_elements(ps.plan->'repas') e
--  where ps.user_id = (select id::text from auth.users where lower(email) = lower('pabloboy77te@gmail.com'))
--    and ps.semaine = date_trunc('week', now() at time zone 'Europe/Paris')::date
--  order by jour, creneau;
