-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Étape 2 : le moteur missions/blocs/règles (docs/crm-spec.md §3.3, §5, §6)
-- ───────────────────────────────────────────────────────────
-- Le premier essai de CRM (natty_crm.sql / natty_crm_v2.sql, absorbés dans
-- crm.html le 25/09) donne déjà `crm_taches` (une tâche = une mission) et
-- `crm_schema_blocs` (un bloc posé à la main sur un canevas, 1 bloc = 1
-- tâche). Ce fichier ÉTEND les deux plutôt que d'en recréer une paire
-- `missions`/`blocs` séparée (règle du chantier : ne pas dupliquer une
-- table qui existe déjà) :
--   - un bloc AD HOC reste ce qu'il était (1 bloc = 1 tâche, via
--     crm_schema_blocs.tache_id, inchangé) ;
--   - un bloc INSTANCIÉ DEPUIS UN MODÈLE est le nouveau cas : UN bloc,
--     PLUSIEURS tâches (via le nouveau crm_taches.bloc_id), générées à
--     des dates dérivées d'une date de référence + décalage, avec de
--     vraies dépendances entre elles.
--
-- ⚠️ ORDRE D'EXÉCUTION : après natty_crm.sql, natty_crm_v2.sql, 0001, 0002, 0003.
-- ═══════════════════════════════════════════════════════════

-- § 1. `crm_taches` devient une vraie « mission » au sens de la spec :
--      un objet lié générique (comme notifications.objet_id, §0002 —
--      aucune FK, les tables visées n'existent pas toutes), le bloc qui
--      l'a fait naître (NULL pour une tâche libre), une action en un clic
--      identifiée par sa clé, et le drapeau qui distingue « pas encore
--      faite » de « faite puis re-questionnée par un recalage ».
alter table public.crm_taches add column if not exists objet_type text;
alter table public.crm_taches add column if not exists objet_id uuid;
alter table public.crm_taches add column if not exists bloc_id uuid references public.crm_schema_blocs(id) on delete set null;
alter table public.crm_taches add column if not exists action_cle text;
alter table public.crm_taches add column if not exists action_faite boolean not null default false;
alter table public.crm_taches add column if not exists necessite_revision boolean not null default false;
comment on column public.crm_taches.necessite_revision is
  'Posé par le recalage en cascade quand une tâche dont l''action_cle a déjà été exécutée voit son échéance bouger — §3.3 règle 3 : « une action déjà exécutée passe au statut à modifier ».';

create table if not exists public.crm_taches_dependances (
  id            uuid primary key default gen_random_uuid(),
  tache_id      uuid not null references public.crm_taches(id) on delete cascade,
  depend_de_id  uuid not null references public.crm_taches(id) on delete cascade,
  unique(tache_id, depend_de_id),
  check (tache_id <> depend_de_id)
);

-- § 2. Les modèles de blocs — la brique réutilisable de la spec (§3.3) :
--      `parametres` décrit ce qu'on demande à la création (clé, libellé,
--      type, requis, options, défaut), en jsonb — un modèle de plus
--      n'exige jamais de migration.
create table if not exists public.crm_modeles_blocs (
  id                uuid primary key default gen_random_uuid(),
  nom               text not null,
  description       text,
  activite_defaut   text,
  parametres        jsonb not null default '[]',
  created_at        timestamptz not null default now()
);

-- `cle` est stable À L'INTÉRIEUR d'un modèle (pas globalement) : c'est ce
-- qui permet à `depend_de_cle` de désigner une AUTRE tâche du MÊME modèle
-- avant que la moindre ligne réelle n'existe — l'instanciation résout les
-- clés en vraies dépendances (crm_taches_dependances) une fois les tâches
-- créées. `decalage_jours` est relatif à la date de référence du bloc
-- (négatif = avant, ex. J-14 → -14), PAS à la tâche dont il dépend :
-- décaler le bloc recale donc TOUTES ses tâches d'un coup, sans avoir à
-- remonter la chaîne de dépendances une à une.
create table if not exists public.crm_modeles_bloc_taches (
  id              uuid primary key default gen_random_uuid(),
  modele_id       uuid not null references public.crm_modeles_blocs(id) on delete cascade,
  cle             text not null,
  titre           text not null,
  activite        text not null,
  decalage_jours  int not null,
  role            text,
  depend_de_cle   text[] not null default '{}',
  action_cle      text,
  formule         text,
  ordre           int not null default 0,
  unique(modele_id, cle)
);

-- § 3. Instance d'un bloc issu d'un modèle : les valeurs saisies pour SES
--      paramètres, sa date de référence (le « J » de la spec), et une
--      ligne de coût prévisionnel — la spec (§6) demande que le bloc en
--      crée une, sans lui donner de table dédiée ; le chantier Finances
--      n'existe pas encore (choisi hors périmètre aujourd'hui), donc elle
--      vit ici en jsonb plutôt que d'attendre un module entier pour un
--      champ qu'on sait déjà vouloir.
alter table public.crm_schema_blocs add column if not exists modele_id uuid references public.crm_modeles_blocs(id);
alter table public.crm_schema_blocs add column if not exists parametres jsonb;
alter table public.crm_schema_blocs add column if not exists date_reference date;
alter table public.crm_schema_blocs add column if not exists cout_previsionnel jsonb;
comment on column public.crm_schema_blocs.cout_previsionnel is
  '{matiere, cuisine, livraison, total} en euros, estimé à la création — provisoire tant que le chantier Finances n''est pas fait; à comparer au réel plus tard (§3.3, Finances).';

-- § 4. Règles — déclencheur + conditions + actions, en jsonb (§3.3).
--      Aucune source de déclenchement « deal » n'existe encore (Commercial
--      hors périmètre aujourd'hui) : la seule règle semée ici s'appuie sur
--      un événement qui existe RÉELLEMENT dans ce chantier — la table est
--      la structure, pas une promesse de règles qu'on ne peut pas honorer.
create table if not exists public.crm_regles (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  declencheur   jsonb not null,
  conditions    jsonb not null default '{}',
  actions       jsonb not null default '[]',
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- § 5. Production (§4.1) — menus verrouillables et sessions réservées.
--      `recettes`/`recettes_ingredients`/`recettes_etapes` existent déjà
--      (natty_production.sql et suivants) : on ne les recrée pas, un menu
--      s'y accroche par `crm_menu_recettes.recette_id`.
create table if not exists public.crm_menus (
  id          uuid primary key default gen_random_uuid(),
  bloc_id     uuid references public.crm_schema_blocs(id) on delete cascade,
  nom         text not null,
  statut      text not null default 'brouillon' check (statut in ('brouillon','valide_chef','valide_nutritionniste','verrouille')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.crm_menu_recettes (
  id          uuid primary key default gen_random_uuid(),
  menu_id     uuid not null references public.crm_menus(id) on delete cascade,
  recette_id  uuid not null references public.recettes(id) on delete restrict,
  ordre       int not null default 0,
  unique(menu_id, recette_id)
);

-- `jour` relie une session à `production_postes`/`production_etapes`
-- (natty_production.sql) SANS clé étrangère, exactement comme ces deux
-- tables se relient déjà entre elles — `jour` y est la clé naturelle, pas
-- un identifiant de session. Le créneau réservé (§4.1 : « durée du mapping
-- + marge, arrondie à l'heure pleine ») vit en heures ici, calculé à la
-- réservation à partir des recettes du menu du bloc — voir crm.html.
create table if not exists public.crm_sessions (
  id                  uuid primary key default gen_random_uuid(),
  bloc_id             uuid references public.crm_schema_blocs(id) on delete cascade,
  type                text not null check (type in ('mise_en_place','production')),
  jour                date not null,
  creneau_debut       time,
  creneau_fin         time,
  nb_personnes        int,
  statut_reservation  text not null default 'a_reserver' check (statut_reservation in ('a_reserver','envoyee','confirmee')),
  statut              text not null default 'a_venir' check (statut in ('a_venir','en_cours','terminee')),
  message_envoye_le   timestamptz,
  created_at          timestamptz not null default now()
);

-- § 6. `bons_commande` (natty_production.sql) trace désormais le bloc qui
--      l'a fait naître — pour qu'un bon créé depuis un Test produit
--      apparaisse déjà dans la production de admin.html (bons_commande
--      est lu tel quel par assets/admin-production.js, aucune autre
--      modification n'est nécessaire de ce côté-là) tout en restant
--      traçable jusqu'à son bloc dans le CRM.
alter table public.bons_commande add column if not exists bloc_id uuid references public.crm_schema_blocs(id) on delete set null;

-- § 7. RLS — même policy que crm_taches/crm_projets (natty_crm.sql) :
--      un seul niveau de confiance pour tout l'outil d'équipe interne.
alter table public.crm_taches_dependances enable row level security;
alter table public.crm_modeles_blocs enable row level security;
alter table public.crm_modeles_bloc_taches enable row level security;
alter table public.crm_regles enable row level security;
alter table public.crm_menus enable row level security;
alter table public.crm_menu_recettes enable row level security;
alter table public.crm_sessions enable row level security;

create policy crm_taches_dependances_staff on public.crm_taches_dependances for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_modeles_blocs_staff on public.crm_modeles_blocs for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_modeles_bloc_taches_staff on public.crm_modeles_bloc_taches for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_regles_staff on public.crm_regles for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_menus_staff on public.crm_menus for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_menu_recettes_staff on public.crm_menu_recettes for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_sessions_staff on public.crm_sessions for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 8. Le modèle « Test produit », semé tel quel depuis le tableau de la
--      spec (§6) — décalages en jours relatifs au J de livraison, rôles
--      en clés de `staff.role`/`domaines` existantes. Deux tâches
--      « Automatique » (clôture des bons, agrégation des volumes) restent
--      des missions ordinaires SANS action_cle : elles se produisent déjà
--      dans admin.html (natty_production.sql) dès que les bons existent —
--      leur donner une fausse action ici dupliquerait ce moteur-là.
insert into public.crm_modeles_blocs (id, nom, description, activite_defaut, parametres)
values (
  '00000000-0000-4000-8000-000000000001',
  'Test produit',
  'Un test payant ou gratuit d''un menu auprès d''un groupe de bénéficiaires, de la communication au bilan (§6 de la spec).',
  'commercial',
  '[
    {"cle":"lieu","label":"Lieu de livraison","type":"texte","requis":true},
    {"cle":"contact","label":"Contact sur place","type":"texte","requis":true},
    {"cle":"nb_beneficiaires","label":"Nombre de bénéficiaires","type":"nombre","requis":true},
    {"cle":"plats_par_personne","label":"Plats par personne","type":"nombre","requis":true,"defaut":1},
    {"cle":"mode_attribution","label":"Mode d''attribution","type":"choix","options":["libre","automatique"],"defaut":"automatique"},
    {"cle":"type_portion","label":"Type de portion","type":"choix","options":["standard","questionnaire"],"defaut":"standard"}
  ]'::jsonb
)
on conflict (id) do nothing;

insert into public.crm_modeles_bloc_taches (modele_id, cle, titre, activite, decalage_jours, role, depend_de_cle, action_cle, ordre) values
('00000000-0000-4000-8000-000000000001','kit_com','Envoyer le kit de communication interne','commercial',-14,'commercial','{}','envoyer_kit_com',1),
('00000000-0000-4000-8000-000000000001','menu','Composer et valider le menu du test','production',-12,'chef','{}',null,2),
('00000000-0000-4000-8000-000000000001','lien_commande','Diffuser le lien de commande','commercial',-10,'commercial','{menu}','diffuser_lien_commande',3),
('00000000-0000-4000-8000-000000000001','reserver_cuisine','Réserver la cuisine (créneau calculé)','logistique',-7,'logistique','{menu}','reserver_cuisine',4),
('00000000-0000-4000-8000-000000000001','cloturer_bons','Clôturer les bons de commande','commercial',-6,null,'{lien_commande}',null,5),
('00000000-0000-4000-8000-000000000001','generer_volumes','Générer volumes, liste de courses, mapping','production',-6,null,'{cloturer_bons}','generer_liste_courses',6),
('00000000-0000-4000-8000-000000000001','courses','Faire les courses chez Metro','logistique',-5,'logistique','{generer_volumes,reserver_cuisine}',null,7),
('00000000-0000-4000-8000-000000000001','mise_en_place','Session de mise en place','production',-4,'chef','{courses}',null,8),
('00000000-0000-4000-8000-000000000001','session_production','Session de production et assemblage','production',-2,'chef','{mise_en_place}',null,9),
('00000000-0000-4000-8000-000000000001','etiquettes','Étiquettes et rangement par bon','logistique',-2,'logistique','{session_production}',null,10),
('00000000-0000-4000-8000-000000000001','confirmer_tournee','Confirmer la tournée et le contact sur place','logistique',-1,'livreur','{etiquettes}',null,11),
('00000000-0000-4000-8000-000000000001','livrer','Livrer','logistique',0,'livreur','{confirmer_tournee}',null,12),
('00000000-0000-4000-8000-000000000001','retours','Recueillir les retours','commercial',2,'commercial','{livrer}',null,13),
('00000000-0000-4000-8000-000000000001','comparer_cout','Comparer coût prévu et réel','finance',3,'finance','{livrer}',null,14),
('00000000-0000-4000-8000-000000000001','bilan','RDV de bilan','commercial',7,'commercial','{retours,comparer_cout}',null,15)
on conflict (modele_id, cle) do nothing;

-- § 9. Une règle d'exemple, sur un événement qui existe déjà : proposer de
--      clôturer un bloc dont toutes les tâches sont faites (au lieu de le
--      laisser traîner « actif » indéfiniment). Le déclencheur `type`
--      correspond à ce que `crm.html` évalue après chaque bascule de tâche.
insert into public.crm_regles (nom, declencheur, conditions, actions) values
(
  'Proposer la clôture d''un bloc terminé',
  '{"type":"bloc_toutes_taches_faites"}'::jsonb,
  '{}'::jsonb,
  '[{"type":"suggerer_cloture_bloc"}]'::jsonb
)
on conflict do nothing;

-- § 10. Vérification, à lancer après exécution :
--   select count(*) from crm_modeles_bloc_taches where modele_id='00000000-0000-4000-8000-000000000001';
--   -- doit rendre 15.
--   select column_name from information_schema.columns where table_name='crm_taches'
--   and column_name in ('objet_type','objet_id','bloc_id','action_cle','action_faite','necessite_revision');
--   -- doit rendre les six lignes.
