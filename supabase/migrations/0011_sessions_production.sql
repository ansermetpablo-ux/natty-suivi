-- 0011_sessions_production.sql — une session de production organisée depuis le CRM
--
-- Demande de Pablo (2026-09-25) : choisir sur le calendrier les recettes à
-- produire, organiser la session (équipe liée au calendrier RH, réservation de
-- la cuisine, nombre de cuisiniers modifiable), sortir les PDF, la liste de
-- courses et l'itinéraire de livraison — assets/crm-production.js.
--
-- crm_sessions existe déjà (0004, sessions des blocs) : on l'étend.
--   recettes         les recettes produites (uuid[] en jsonb)
--   jours_livraison  les jours de livraison dont les commandes sont produites
--   equipe           les membres (staff.user_id) qui viennent
--   reunion_id       la réunion RH qui porte la session au calendrier et ses
--                    confirmations de présence (même mécanique, §4.4)
--   itineraire       l'ordre de tournée (ids de bons_commande)
--   adresse_depart   le point de départ de la tournée (la cuisine)
-- nb_personnes, creneau_debut, creneau_fin, statut_reservation existent déjà.
-- Sans ce fichier, le CRM garde ces champs sur l'appareil et le signale.
alter table public.crm_sessions add column if not exists recettes jsonb;
alter table public.crm_sessions add column if not exists jours_livraison jsonb;
alter table public.crm_sessions add column if not exists equipe jsonb;
alter table public.crm_sessions add column if not exists reunion_id uuid references public.reunions(id) on delete set null;
alter table public.crm_sessions add column if not exists itineraire jsonb;
alter table public.crm_sessions add column if not exists adresse_depart text;
