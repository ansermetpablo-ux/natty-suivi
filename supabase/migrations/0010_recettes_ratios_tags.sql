-- 0010_recettes_ratios_tags.sql — la base d'une recette : ses ratios et les tags de ses ingrédients
--
-- Demande de Pablo (2026-09-25) : chaque recette a sa répartition de base (le %
-- de ses kcal en protéines / glucides / lipides, ex. 50 / 25 / 25), et chaque
-- ingrédient un TAG qui dit quelle macro il apporte. Les quantités d'une
-- portion se calculent à partir de cette base (assets/admin-production.js,
-- baseRecette), puis s'ajustent aux macros du client.
--
-- ratios : { "p": 50, "g": 25, "l": 25 } — null = déduits de la fiche.
-- tag    : proteine | feculent | lipide | legume | aromate — null = déduit de
--          la macro dominante de l'aliment.
alter table public.recettes add column if not exists ratios jsonb;
alter table public.recettes_ingredients add column if not exists tag text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recettes_ingredients_tag_check') then
    alter table public.recettes_ingredients
      add constraint recettes_ingredients_tag_check check (tag is null or tag in ('proteine','feculent','lipide','legume','aromate'));
  end if;
end $$;
