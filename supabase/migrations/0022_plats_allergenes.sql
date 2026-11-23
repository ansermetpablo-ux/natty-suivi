-- Appliquée par MCP le 2026-09-30.
-- Les allergènes d'un plat à l'unité (offre.html → « Nos plats »), DÉDUITS
-- des ingrédients de sa fiche technique (recettes.plat_id → recettes_ingredients)
-- par mots-clés, sur les 14 allergènes réglementaires (règlement INCO).
-- ⚠️ Une déduction, pas une analyse : c'est la fiche qui fait foi, et la
-- colonne reste modifiable à la main. Relancer la fonction après toute
-- retouche d'une fiche : select public.recalculer_allergenes_plats();
alter table public.plats_menu add column if not exists allergenes text[];

create or replace function public.recalculer_allergenes_plats()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with ing as (
    select r.plat_id, lower(translate(ri.ingredient_nom,
      'ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜàâäçéèêëîïôöùûüœ', 'AAACEEEEIIOOUUUaaaceeeeiioouuuo')) n
    from recettes r join recettes_ingredients ri on ri.recette_id = r.id
    where r.plat_id is not null
  ), regles(allergene, motif, sauf) as (values
    ('gluten',          '(ble|farine|boulgour|semoule|avoine|seigle|orge|epeautre|pain|chapelure|tortilla|pates|sauce soja|couscous)', '(sans gluten|farine de riz|tortilla mais|farine de mais)'),
    ('crustacés',       '(crevette|crabe|homard|langoustine|ecrevisse)', null),
    ('œufs',            '(\moeuf|mayonnaise)', null),
    ('poisson',         '(cabillaud|merlu|saumon|thon|truite|colin|sardine|maquereau|anchois|sauce poisson|nuoc)', null),
    ('arachides',       '(arachide|cacahuete)', null),
    ('soja',            '(soja|tofu|edamame|tempeh|miso)', null),
    ('lait',            '(\mlait\M|beurre|creme|fromage|parmesan|yaourt|mozzarella|feta|ricotta|skyr)', '(lait de coco|lait d.amande|lait d.avoine)'),
    ('fruits à coque',  '(amande|noisette|noix|cajou|pistache|pecan|macadamia)', '(noix de coco)'),
    ('céleri',          '(celeri|bouillon)', null),
    ('moutarde',        '(moutarde)', null),
    ('sésame',          '(sesame|tahini)', null),
    ('sulfites',        '(\mvin\M|vinaigre|raisins secs|abricots secs)', null),
    ('lupin',           '(lupin)', null),
    ('mollusques',      '(moule|calamar|poulpe|seiche|huitre|saint.jacques)', null)
  )
  update plats_menu p set allergenes = coalesce((
      select array_agg(distinct rg.allergene order by rg.allergene)
      from ing join regles rg on ing.n ~ rg.motif and (rg.sauf is null or ing.n !~ rg.sauf)
      where ing.plat_id = p.id), '{}')
  where exists (select 1 from recettes r where r.plat_id = p.id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.recalculer_allergenes_plats() from public, anon;

select public.recalculer_allergenes_plats();
