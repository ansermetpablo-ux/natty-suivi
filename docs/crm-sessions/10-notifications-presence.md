# Session 10 — Notifications, constat de présence, manquements

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Fermer la boucle RH : prévenir les gens, constater qui était là, et suivre les manquements selon des règles écrites. Les notifications et les manquements vont ensemble : un manquement n'est juste que si la personne a été prévenue et a eu la possibilité de signaler son absence.

## Features

1. **Service d'envoi SMS** : compare-moi deux ou trois fournisseurs adaptés à la France (prix par SMS, numéro d'expéditeur, API, réception des réponses) et attends mon choix avant de l'intégrer. Clé en variable d'environnement.
2. **Table `notifications`** : canal, destinataire, contenu, objet lié, statut d'envoi, coût. Tableau de la dépense SMS par mois.
3. **Rappels automatiques** (tâche planifiée Vercel) : à la création, la veille, et une heure avant pour ceux qui n'ont pas confirmé. Canaux et délais paramétrables par type d'événement. Préférences de chaque membre (SMS, email ou les deux).
4. **Signalement d'absence** : bouton « Je ne pourrai pas venir » avec heure enregistrée, possible jusqu'au dernier moment.
5. **Constat de présence** après chaque réunion ou session : l'organisateur coche les présents ; option « Je suis arrivé » activable par chacun sur place ; heure d'arrivée.
6. **Table `regles_presence`** : délai de prévenance, seuil de retard, liste des motifs valables, délai de justification, conséquences par seuil, périmètre (associés seulement ou aussi chef et livreur : paramètre, voir section 9 de la spec). Écran d'édition réservé à `admin`, avec historique des changements.
7. **Qualification automatique** : confirmé + absent + pas de signalement avant le délai = manquement `a_justifier` ; retard au-delà du seuil = manquement léger. Notification à la personne.
8. **Justification** dans le délai (motif de la liste + commentaire), **décision** par un membre désigné autre que l'organisateur, **contestation** possible, statut final `justifie` ou `non_justifie`.
9. **Tableau des manquements** : par personne, manquements justifiés et non justifiés, retards, taux de présence, historique. Visibilité selon les règles. Indicateur spécifique sur les sessions de production.

## Critères de réception

- Un rappel SMS de test arrive sur mon téléphone et son coût est enregistré.
- Un scénario complet (confirmation, absence sans prévenir, manquement créé, justification, décision, contestation) fonctionne.
- Changer le délai de prévenance dans les règles change la qualification sans modifier le code.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
