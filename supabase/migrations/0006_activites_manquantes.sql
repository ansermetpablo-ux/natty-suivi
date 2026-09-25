-- ═══════════════════════════════════════════════════════════
-- CRM Natty — les trois chantiers restés invisibles
-- ───────────────────────────────────────────────────────────
-- §4 de la spec liste neuf modules. Six avaient une activité (donc un
-- onglet de navigation) : Accueil, Production, Logistique, Commercial,
-- Finances, RH. Trois n'en avaient AUCUNE, ni côté client (ACTIVITES de
-- crm.html) ni ici : Documents (§4.5), Modèle financier (§4.7),
-- Financement (§4.8). Ils étaient listés dans §8 « spécification
-- détaillée plus tard » — mais « pas encore détaillé » ne doit pas dire
-- « invisible » : demande de Pablo, rendre tous les chantiers visibles.
--
-- Même garde-fou que 0005 : crm_taches.activite porte une FK vers cette
-- table (natty_crm.sql), donc toute création de tâche sous l'une de ces
-- trois activités échouerait en 23503 sans la ligne correspondante ici.
--
-- Ce que ça rend possible, honnêtement : le même socle générique
-- (tâches, projets, schéma de blocs, classeur de documents) que
-- Commercial/Finance/Logistique/Production ont déjà — PAS le détail
-- métier propre à chacune (§4.5 modèles de documents versionnés,
-- §4.7 hypothèses/prévisionnel/plan de financement à trois vues,
-- §4.8 dossiers/pièces/échéances). Ce détail reste à construire.
--
-- ⚠️ ORDRE D'EXÉCUTION : après 0005.
-- ═══════════════════════════════════════════════════════════
insert into public.crm_activites (cle, nom, icone, couleur, ordre) values
 ('documents', 'Documents', 'documents', 'ink', 7),
 ('modele_financier', 'Modèle financier', 'modele_financier', 'green', 8),
 ('financement', 'Financement', 'financement', 'violet', 9)
on conflict (cle) do nothing;
