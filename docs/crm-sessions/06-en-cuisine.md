# Session 06 — En cuisine : mapping, créneau, réservation, stocks

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Outiller la session elle-même. Le mapping donne la durée de la session, la durée donne le créneau à réserver, la réservation conditionne les courses, et la session produit du stock. Ces quatre éléments forment le déroulé d'une session.

## Features

1. **Mapping minuté** généré à partir des sessions et des fiches techniques (session 05) : tâches ordonnées, heure zéro à l'arrivée en cuisine, durée, poste, personne affectée, dépendances (une sauce avant l'assemblage). Recalculé à chaque changement de volumes ou d'équipe. Ajustable à la main.
2. **Vue tablette plein écran** : grosse typographie, fort contraste, utilisable mains occupées. Deux phases : par recette (production en masse), puis par bon de commande à l'assemblage, avec les quantités à peser selon la fiche du client ou la portion standard.
3. **Chronomètre de session** et **temps restant sur le créneau réservé**, toujours visible. Bouton « tâche terminée » qui enregistre la durée réelle.
4. **Amélioration des estimations** : les durées réelles alimentent une durée moyenne par étape et par volume, proposée pour les prochains mappings.
5. **Créneau calculé** : durée du mapping + marge de sécurité paramétrable, arrondie à l'heure pleine supérieure (toute heure entamée est due, 30 € de l'heure). Coût cuisine prévisionnel de la session.
6. **Action « Réserver la cuisine »** (section 4.2 de la spec) : message pré-rempli ; email via Resend après relecture ; SMS via lien `sms:` avec numéro et texte pré-remplis. La mission passe en `en_attente` jusqu'au clic « Confirmée ». Tant qu'elle n'est pas confirmée, les missions de courses dépendantes s'affichent en alerte.
7. **Stocks** : lots créés en fin de session (préparation, quantité, date, mode congelé ou frais, date limite). Alerte avant expiration. Le stock disponible est déduit de la liste de courses (branchement prévu en session 05).

## Critères de réception

- Pour une session de test, le mapping, la durée, le créneau et le coût sont cohérents et se recalculent si j'ajoute 20 portions.
- La vue tablette est lisible sur un écran de tablette et se pilote au doigt.
- L'email de réservation part, et le SMS s'ouvre correctement sur iPhone.

## Hors périmètre

Étiquettes et tournées (session 07).

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
