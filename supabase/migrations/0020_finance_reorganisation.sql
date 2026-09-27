-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Finance : « Réorganiser » appliqué à la production (27/09/2026)
-- Appliquer le plan réécrit bons_attributions (portions ramenées au faisable,
-- une recette à 0 portion est retirée : nb_portions > 0 est une contrainte).
-- L'état d'AVANT est gardé ici pour pouvoir annuler : les lignes
-- bons_attributions des commandes de la session, telles qu'elles étaient.
-- (Appliquée avec 0010_recettes_ratios_tags.sql, jusque-là jamais passée en
-- base : son `tag` désigne l'aliment principal d'une recette.)
-- ═══════════════════════════════════════════════════════════
alter table public.crm_sessions add column if not exists reorg_avant jsonb;
alter table public.crm_sessions add column if not exists reorg_le timestamptz;
