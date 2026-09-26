# Session 02 — Le back-office actuel intégré au CRM

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Faire du CRM l'outil de travail quotidien dès maintenant, en y reprenant tout ce que fait `admin.html`. Ces fonctions forment un bloc logique : les commandes renvoient aux clients, les clients à leur fiche nutritionnelle et à leurs messages, les commandes au menu.

## Features

1. **Commandes** : liste, filtres (date de livraison, statut, client, formule), détail, changement de statut, même logique qu'aujourd'hui.
2. **Clients** : liste, recherche, fiche avec coordonnées, abonnement, objectif, fiche nutritionnelle, historique des commandes.
3. **Menu** : gestion des plats proposés dans l'app, telle qu'elle existe.
4. **Messagerie** : conversations avec les clients, envoi et réception. Remplace le rafraîchissement toutes les 3 secondes par les abonnements temps réel de Supabase si c'est possible sans risque.
5. **Droits** : les profils actuels (Administrateur, Nutritionniste, Chef, Logistique) retrouvent exactement leurs accès, désormais appliqués par les rôles de la session 01.
6. **Découpage** : le code est réparti en modules (un fichier ou dossier par fonction), plus aucune requête sensible sans contrôle RLS.

## Critères de réception

- Chaque action possible dans `admin.html` est possible dans le CRM, avec le même résultat en base. Fournis une liste de vérification action par action.
- Un message envoyé depuis le CRM arrive bien chez le client, et sa réponse s'affiche sans recharger la page.
- `admin.html` continue de fonctionner en parallèle (il sera retiré plus tard, sur ma décision).

## Hors périmètre

Pas de nouvelles fonctions sur les commandes (liens de commande, blocs) : session 05.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
