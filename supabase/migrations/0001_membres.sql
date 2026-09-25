-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Étape 1 (socle) — § 1 : les membres
-- ───────────────────────────────────────────────────────────
-- La spec du CRM (docs/crm-spec.md, § 5) demande une table `membres`
-- (auth, rôle, domaines, téléphone, statut). Elle existe déjà : c'est
-- `staff` (natty_staff.sql), que `admin.html` interroge à plus de
-- soixante-dix endroits par ce nom précis. La renommer casserait tout
-- l'existant pour un gain nul — la règle du chantier CRM est justement
-- de ne rien casser et de ne pas dupliquer une table qui existe déjà.
-- Ce fichier ÉTEND `staff`, ne la remplace pas.
--
-- ⚠️ ORDRE D'EXÉCUTION : après natty_staff.sql (déjà fait).
-- ═══════════════════════════════════════════════════════════

-- § 1. Les trois colonnes que la spec attend d'un « membre ».
--      `domaines` est un tableau : un associé peut cumuler plusieurs
--      domaines (Danilo = finances ET financement, par exemple).
alter table public.staff add column if not exists domaines text[] not null default '{}';
alter table public.staff add column if not exists telephone text;
alter table public.staff add column if not exists statut text
  check (statut is null or statut in ('associe','salarie','prestataire'));

comment on column public.staff.domaines is
  'Domaines d''un associé — finances, financement, commercial, partenariats, production. Peut en cumuler plusieurs ; vide pour les rôles non-associé (chef, logistique...).';
comment on column public.staff.statut is
  'associe (SAS, 4 parts égales) / salarie / prestataire — sert au module RH (disponibilités, réunions, manquements).';

-- § 2. Les rôles du CRM s'ajoutent à ceux qu'admin.html utilise déjà.
--      Migration ADDITIVE : rien n'est retiré.
--      • admin / nutritionniste / chef / logistique — utilisés par admin.html,
--        on n'y touche pas.
--      • commercial / finance / partenariat / developpement — posés le
--        24/09 pour un premier essai de CRM (crm.html, resté sur `main`,
--        hors du périmètre de ce chantier). Laissés ici : les retirer
--        casserait toute ligne `staff` qui les porterait déjà, et les
--        garder ne coûte rien s'ils ne servent plus.
--      • associe / livreur — nouveaux, demandés par la spec (docs/crm-spec.md § 3.2).
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (
  role in ('admin','nutritionniste','chef','logistique',
           'commercial','finance','partenariat','developpement',
           'associe','livreur')
);

-- § 3. Vérification, à lancer après exécution :
--   select column_name from information_schema.columns
--   where table_name='staff' and column_name in ('domaines','telephone','statut');
--   -- doit rendre les trois lignes.
