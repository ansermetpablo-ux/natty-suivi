-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Finance : quantités prévues saisies à la main (26/09/2026)
-- Le tableau des matières d'une session se saisit à la main. La quantité
-- prévue d'un aliment remplace, pour CETTE session, celle calculée depuis
-- les fiches : {aliment en minuscules: kg}. NULL = tout calculé.
-- (Le prix prévu s'écrit dans ingredients_base, l'achat réel dans une pièce
-- « Saisie manuelle » de factures_fournisseur : aucun autre schéma requis.)
-- ═══════════════════════════════════════════════════════════
alter table public.crm_sessions add column if not exists mp_prevu_override jsonb;
