# Session 19 — Instagram et LinkedIn

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Étendre la boîte unifiée (session 12) aux deux autres canaux utilisés. Ils sont regroupés car ils posent le même problème : des API restrictives, qui imposent de distinguer ce qui s'automatise de ce qui reste manuel mais assisté.

## Features

1. **Vérification préalable** : dans la documentation actuelle de Meta et de LinkedIn, ce qui est autorisé, les prérequis (compte professionnel, application, revue par Meta) et les limites. Présente-moi le résultat et les démarches à faire de mon côté avant de coder.
2. **Instagram** via l'API de messagerie de Meta, si les conditions sont réunies : réception des messages du compte professionnel Natty dans la boîte unifiée, réponse depuis le CRM dans les limites autorisées, rattachement au contact.
3. **Prospection Instagram assistée** : le premier message reste manuel. Le CRM rédige le message selon le profil, ouvre le profil Instagram, et enregistre l'échange quand l'utilisateur confirme l'envoi.
4. **LinkedIn assisté** : pas d'automatisation de la messagerie. Le CRM rédige le message, ouvre le profil, et propose un enregistrement rapide de l'échange (collage de la réponse, pré-remplissage du bloc de suivi par l'IA).
5. **Statistiques par canal** : messages envoyés, réponses, taux de réponse, par profil et par membre.

## Critères de réception

- Un message Instagram reçu apparaît dans la boîte unifiée et reçoit une réponse depuis le CRM (si l'accès Meta est obtenu).
- Un échange LinkedIn s'enregistre en moins de 30 secondes et alimente le deal.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
