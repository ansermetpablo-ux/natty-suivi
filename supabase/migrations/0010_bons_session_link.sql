-- ═══════════════════════════════════════════════════════════
-- CRM Natty — session 06 (suite) : planifier une session sans bloc
-- ───────────────────────────────────────────────────────────
-- Signalé par Pablo en cours de session : la vue Production ne montrait
-- QUE les sessions nées d'un bloc « Test produit » — aucun moyen d'y
-- sélectionner les commandes attribuées de la semaine (le flux normal,
-- récurrent, que gère `admin.html` au quotidien) pour lancer une
-- session dessus.
--
-- `bons_commande.session_id` porte ce lien pour le flux « normal » —
-- distinct de `bloc_id` (le flux « Test produit »), les deux mènent à la
-- même table `crm_session_etapes` : genererMapping() lit `bloc_id=eq.…`
-- si la session en a un, `session_id=eq.…` sinon.
--
-- ⚠️ ORDRE D'EXÉCUTION : après 0009 (crm_session_etapes doit exister).
-- ═══════════════════════════════════════════════════════════
alter table public.bons_commande add column if not exists session_id uuid references public.crm_sessions(id) on delete set null;
create index if not exists bons_commande_session_idx on public.bons_commande(session_id);

-- § Vérification :
--   select column_name from information_schema.columns
--    where table_name='bons_commande' and column_name='session_id';
