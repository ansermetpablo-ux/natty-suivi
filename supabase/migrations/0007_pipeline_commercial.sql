-- 0007_pipeline_commercial.sql — l'étape du pipeline commercial (kanban)
--
-- Un « deal » du pipeline commercial EST un crm_projets (activite='commercial') :
-- pas une seconde table inventée sans spécification. Cette colonne dit
-- seulement dans quelle colonne du kanban il se trouve. NULL pour tout projet
-- d'une autre activité (elle ne les concerne pas) et pour un deal commercial
-- pas encore placé — l'interface le traite alors comme 'prospection' côté
-- affichage (client), sans qu'on ait besoin d'un défaut en base qui mentirait
-- pour toutes les activités qui n'ont rien à voir avec un pipeline commercial.

alter table crm_projets
  add column if not exists etape_pipeline text
  check (etape_pipeline is null or etape_pipeline in
    ('prospection','contact','proposition','negociation','client','perdu'));

create index if not exists idx_crm_projets_etape_pipeline
  on crm_projets(etape_pipeline) where etape_pipeline is not null;
