-- ═══════════════════════════════════════════════════════════
-- CRM Natty — correction : message_id_email n'était pas UNIQUE
-- (session 12, découvert le 25/09/2026 en vérifiant l'index en base)
-- ───────────────────────────────────────────────────────────
-- 0014_commercial_echanges.sql déclare (§1) :
--   create unique index if not exists crm_messages_message_id_idx
--     on public.crm_messages(message_id_email);
-- Mais l'index RÉELLEMENT posé quand 0014 a été appliqué n'était PAS
-- unique (vérifié via pg_indexes : un simple btree). `if not exists`
-- compare sur le NOM de l'index, pas sur ses propriétés — une fois un
-- index non-unique posé sous ce nom, relancer la même instruction ne
-- fait RIEN, même avec `unique` ajouté au texte : Postgres voit un
-- objet du même nom et saute la création.
--
-- Conséquence, si non corrigée : api/webhook.js écrit une ligne
-- crm_messages entrante avec `?on_conflict=message_id_email`
-- (idempotence sur un email Resend déjà reçu). PostgREST résout ce
-- paramètre sur une contrainte UNIQUE — sans elle, la requête répond
-- `42P10` (« no unique or exclusion constraint matching the ON
-- CONFLICT specification »), donc CHAQUE email reçu depuis Resend
-- échouerait dès le premier appel, avant même la question du domaine.
--
-- La table est vide (crm_messages, 0 ligne au moment de ce fichier) :
-- un DROP + CREATE UNIQUE est instantané et sans risque de doublon à
-- purger.
-- ═══════════════════════════════════════════════════════════

drop index if exists public.crm_messages_message_id_idx;
create unique index crm_messages_message_id_idx on public.crm_messages(message_id_email);

-- Vérification, à lancer après exécution :
--   select indexdef from pg_indexes where indexname='crm_messages_message_id_idx';
--   -- doit contenir "CREATE UNIQUE INDEX"
