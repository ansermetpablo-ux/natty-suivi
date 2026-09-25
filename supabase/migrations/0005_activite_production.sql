-- ═══════════════════════════════════════════════════════════
-- CRM Natty — la sixième activité : Production
-- ───────────────────────────────────────────────────────────
-- `crm_taches.activite` porte une clé étrangère vers `crm_activites`
-- (natty_crm.sql §2) — un garde-fou d'intégrité, pas une source pour
-- l'affichage (crm.html a son propre tableau ACTIVITES en dur, avec ses
-- propres clés d'icône ; `crm_activites.icone`/`couleur` ne sont lus par
-- aucun code JS). Sans cette ligne, toute tâche « production » du modèle
-- Test produit (menu, sessions...) échoue à l'insertion en 23503 — trouvé
-- en validant le scénario §6 en base, pas en lisant le code.
--
-- ⚠️ ORDRE D'EXÉCUTION : après natty_crm.sql et 0004.
-- ═══════════════════════════════════════════════════════════
insert into public.crm_activites (cle, nom, icone, couleur, ordre)
values ('production', 'Production', 'menu', 'orange', 6)
on conflict (cle) do nothing;
