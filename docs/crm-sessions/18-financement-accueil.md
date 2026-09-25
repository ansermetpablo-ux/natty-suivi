# Session 18 — Financement et accueil final

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Ajouter le dernier module métier et finir l'accueil, maintenant que tous les modules produisent des données. Les dossiers de financement alimentent le plan de financement et génèrent des échéances ; l'accueil consolide ces échéances avec celles de tous les autres modules.

## Features

1. **Dossiers de financement** : organisme (Initiative France, Bpifrance, ADIE, ACRE, ARCE, Garantie Création, subvention régionale, banques…), montant demandé, type (prêt, prêt d'honneur, subvention, garantie), statut, responsable, interlocuteur, échéances.
2. **Pièces** : liste des pièces requises par dossier, statut (à produire, prête, envoyée), lien vers les documents générés (session 17), notamment business plan et plan de financement.
3. **Échéances** transformées en missions ; un dossier accordé alimente les ressources du plan de financement (session 16).
4. **Accueil personnalisé** selon le rôle et les domaines : pour chacun, ses indicateurs clés, ses missions de la semaine, ses alertes. Au minimum pour la vue admin : commandes à venir, planning de la semaine toutes échéances confondues, alertes (cuisine non confirmée, relance en retard, écart de marge, trésorerie sous le seuil, présence non confirmée, dossier bientôt dû), boutons de lancement des prochaines missions en un clic.
5. **Centre d'alertes** unique qui regroupe les alertes de tous les modules, avec priorité et lien vers l'objet concerné.
6. **Retrait d'`admin.html`** : prépare-le (liste des vérifications) mais ne le supprime que sur ma confirmation explicite.

## Critères de réception

- L'accueil d'un utilisateur `chef`, d'un associé finances et de l'admin affichent chacun ce qui les concerne, et rien d'autre.
- Chaque type d'alerte peut être déclenché et renvoie au bon objet.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
