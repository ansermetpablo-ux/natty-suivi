# Session 08 — Disponibilités, réunions, présence confirmée

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Savoir qui est disponible, s'en servir pour planifier réunions et sessions, et obtenir des confirmations de présence. Ces trois éléments forment la base RH : sans disponibilités, pas de planification fiable ; sans confirmation, pas de suivi de présence possible (session 10).

## Features

1. **Indisponibilités récurrentes** : rythme d'alternance (une semaine de cours, une semaine en entreprise, avec semaine de départ), horaires, créneaux fixes hebdomadaires. Projetées automatiquement sur l'année.
2. **Indisponibilités ponctuelles** : début, fin, motif facultatif et privé (visible de la personne et de l'admin seulement).
3. **Carte de disponibilité de l'équipe** par semaine.
4. **Fonction de disponibilité** réutilisable par tous les modules : « telle personne est-elle libre à tel moment ? » et « qui, parmi tel rôle, est libre ? ». Elle servira aux contrôles de capacité (session 09).
5. **Réunions** : objet, participants, durée, lieu ou lien visio. Proposition des créneaux où tout le monde est libre, sinon ceux où il manque le moins de monde, en nommant les absents.
6. **Invitations agenda** : email via Resend avec fichier `.ics` (compatible Google Agenda, Outlook, calendrier iPhone), mis à jour en cas de déplacement ou d'annulation.
7. **Confirmation de présence** : liens « Je serai présent » / « Je ne peux pas » dans l'email et dans le CRM. Table `participations` commune aux réunions et aux sessions de production : les personnes affectées à une session (session 05) reçoivent la même demande de confirmation.
8. **Missions** : une réunion crée une mission pour chaque participant ; une affectation non confirmée à la veille remonte en alerte.

## Critères de réception

- Pour deux membres dont un en semaine de cours, les créneaux proposés excluent bien ses horaires.
- L'invitation s'ajoute correctement dans Google Agenda et dans le calendrier iPhone, et se met à jour si la réunion est déplacée.

## Hors périmètre

SMS, constat de présence et manquements (session 10).

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
