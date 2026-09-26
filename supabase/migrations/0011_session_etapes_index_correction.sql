-- ═══════════════════════════════════════════════════════════
-- CRM Natty — correction d'un index posé dans 0009
-- ───────────────────────────────────────────────────────────
-- 0009 posait `crm_session_etapes_recette_idx` sur (recette_id, titre)
-- pour servir la moyenne des durées réelles à la génération suivante.
-- Le code finalement écrit (genererMapping, crm.html) filtre sur
-- `etape_source_id` — une référence exacte à la ligne de la fiche —
-- plutôt que sur le texte du titre : celui stocké sur chaque ligne
-- porte le nom de la recette en préfixe (« Bolognaise — Faire revenir
-- l'oignon »), différent du titre nu de la fiche, donc un filtre par
-- titre ne matcherait jamais.
--
-- L'ancien index reste en place (inoffensif, simplement inutilisé) —
-- le retirer n'apporterait rien et ferait une migration de plus pour
-- un index qui ne coûte rien à garder.
-- ═══════════════════════════════════════════════════════════
create index if not exists crm_session_etapes_source_idx on public.crm_session_etapes(etape_source_id)
  where statut = 'fait';
