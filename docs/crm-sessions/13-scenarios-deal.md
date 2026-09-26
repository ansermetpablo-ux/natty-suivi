# Session 13 — Scénarios de deal

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Modéliser à l'avance le déroulé d'un deal (le cas Fnac en premier) en carte modifiable, et chiffrer ce qu'il rapporterait. Le plan en jalons et la simulation vont ensemble : on décide d'engager un scénario en voyant à la fois son calendrier et son résultat.

## Features

1. **Scénario** rattaché à un deal : **réutilise le moteur de blocs** (session 03) plutôt qu'un mécanisme parallèle. Un scénario est un enchaînement de jalons ; un jalon peut être une simple mission ou un bloc complet (Test produit, Démarrage client…).
2. **Jalons** : nom, décalage relatif ou date fixe, dépendances, responsable, modèle de message rattaché (session 12), documents à préparer (session 17, prévoir le branchement).
3. **Carte visuelle modifiable** : frise ou graphe des jalons, glisser pour déplacer, recalage en cascade des suivants, ajout et suppression.
4. **Modèles de scénarios par profil** (issus de la séquence par défaut du profil, session 11), dupliquables.
5. **Simulation chiffrée** : nombre de bénéficiaires, taux d'adoption, plats par semaine et par personne, prix, durée de l'engagement, montée en charge. Résultat : plats par semaine, CA mensuel et total, coût matière estimé à partir des fiches techniques, marge prévisionnelle, heures cuisine, alerte si le plafond de 350 plats par semaine est dépassé.
6. **Variantes** : plusieurs jeux d'hypothèses comparés côte à côte (prudent, central, ambitieux). Le scénario retenu sera exporté vers le modèle financier (session 16) : prévois la structure.
7. **Engagement** : « lancer le scénario » crée ses missions et blocs via l'aperçu habituel.
8. **Saisie initiale** : un scénario Fnac à partir de l'état réel (deux visios faites, RDV du 19 octobre 2026 pour organiser le test et la communication interne), que je compléterai.

## Critères de réception

- Déplacer le jalon « Test » du scénario Fnac recale la suite et les blocs associés.
- Changer le taux d'adoption met à jour CA, marge et alerte de capacité instantanément.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
