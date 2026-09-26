-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Finance : taux horaire de la cuisine par session (26/09/2026)
-- Le tarif général reste dans crm_tarifs ('tarif_cuisine_h', 0016). Une
-- session peut avoir le sien — une cuisine louée ailleurs, un créneau de
-- nuit. NULL = le tarif général. « Réinitialiser » le remet à NULL.
-- ═══════════════════════════════════════════════════════════
alter table public.crm_sessions add column if not exists tarif_cuisine_h_override numeric check (tarif_cuisine_h_override >= 0);

-- Le nombre de repas à 9 € se saisit lui aussi, sur place dans « Recettes
-- prévisionnelles » : avec lui, les deux nombres deviennent indépendants
-- (NULL = repas commandés − repas à l'unité, comme avant).
alter table public.crm_sessions add column if not exists nb_repas_abo_override integer check (nb_repas_abo_override >= 0);
