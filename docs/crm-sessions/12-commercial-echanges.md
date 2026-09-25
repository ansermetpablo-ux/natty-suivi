# Session 12 — Commercial : échanges, relances, campagnes, IA

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Faire vivre les échanges avec les clients depuis le CRM. Boîte de réception, relances, campagnes et pré-remplissage IA vont ensemble : ils produisent et exploitent le même objet, le message rattaché à un contact et à un deal.

## Features

1. **Table `messages`** : canal, sens, contenu, statut, contact, deal, fil de conversation. La messagerie clients de l'app (session 02) y est rattachée pour une vue unique.
2. **Email sortant** via Resend depuis le CRM, avec signature par membre et modèles de messages par profil et par étape.
3. **Email entrant** : vérifie dans la documentation actuelle ce que Resend permet pour la réception. Sinon, propose-moi l'alternative la plus simple (adresse dédiée avec transfert, ou lecture de boîte via API Microsoft 365 ou Gmail). Rattachement automatique au contact par adresse email.
4. **Boîte unifiée** : tous les fils, filtres par canal, deal, responsable, non lus ; réponse depuis le fil.
5. **Relances** : règle par profil (délai sans réponse, nombre maximum, message type) ; la file des relances à faire crée des missions ; arrêt automatique si le contact répond.
6. **Campagnes Hunter** : vérifie ce que l'API Hunter expose sur les campagnes et leurs statistiques ; importe campagnes, destinataires et statuts (ouvert, répondu) ; un destinataire qui répond devient un contact avec un deal au premier contact.
7. **Pré-remplissage par l'API Claude** : coller des notes de RDV ou un email → proposition de bloc de suivi (verbatims, besoins, objections, arguments, prochaine action), validée ou corrigée avant enregistrement. Rédaction de brouillons de messages selon le profil et la fiche. Jamais d'envoi automatique.
8. **Détection de blocs** : dans un compte rendu, l'IA peut proposer un bloc (par exemple Test produit) avec paramètres pré-remplis, soumis à l'aperçu du moteur.

## Critères de réception

- Un email envoyé depuis le CRM et sa réponse apparaissent dans le même fil, rattachés au bon deal.
- Une relance est proposée au bon délai et disparaît si le contact répond.
- Des notes de RDV collées produisent un bloc de suivi exploitable, modifiable avant validation.

## Hors périmètre

Instagram et LinkedIn (session 19).

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
