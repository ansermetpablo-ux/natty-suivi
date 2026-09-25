# Session 03 — Le moteur : missions, blocs, règles

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Construire le cœur du CRM (section 3.3 de la spec). Toutes les sessions suivantes créeront des missions et des modèles de blocs : le moteur doit être générique, et ne connaître aucun métier en particulier.

## Features

1. **Missions** : titre, module, type, objet lié (type + identifiant), échéance, responsable (membre ou rôle), statut (`a_faire`, `en_cours`, `en_attente`, `fait`, `a_modifier`, `annule`), bloc d'origine, action associée.
2. **Dépendances** entre missions, avec détection des cycles. Une mission dont une dépendance n'est pas faite s'affiche « bloquée ».
3. **Modèles de blocs** : paramètres attendus (nom, type, obligatoire), tâches modèles (module cible, type d'action, décalage en jours et heure éventuelle par rapport à la date de référence, rôle, dépendances, formule).
4. **Instanciation d'un bloc** en deux temps : **aperçu** de toutes les missions qui seront créées, modifiables et supprimables une à une, puis **confirmation**. Point d'extension prévu pour les contrôles de capacité (branchés en session 09) : ils renvoient une liste de conflits affichée dans l'aperçu.
5. **Recalage en cascade** : changer la date de référence d'un bloc recale ses missions ; les missions déjà exécutées passent en `a_modifier` au lieu d'être déplacées en silence.
6. **Annulation d'un bloc** : annule toutes ses missions et objets générés, avec confirmation.
7. **Règles** : déclencheur (événement nommé, par exemple `deal.etape_changee`), conditions, action (proposer un bloc, créer une mission). Un journal des événements pour tracer ce qui a été déclenché.
8. **Registre d'actions en un clic** : un mécanisme où chaque session future enregistre ses actions (nom, fonction exécutée, confirmation requise ou non). Ici, une seule action de démonstration.
9. **Planning de la semaine** sur l'accueil : toutes les missions de la personne connectée (ou de toute l'équipe pour `admin`), par jour, avec couleurs de statut et bouton d'action.
10. **Interface d'édition des modèles de blocs**, réservée à `admin`.

## Critères de réception

- Un bloc de démonstration à 5 tâches avec dépendances se crée, s'affiche dans le planning, se décale de deux jours correctement, puis s'annule entièrement.
- Tests automatisés sur le calcul des dates, les dépendances et le recalage.

## Hors périmètre

Aucun bloc métier réel (le bloc Test produit arrive en session 09).

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
