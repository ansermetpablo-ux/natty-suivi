# Session 04 — Ingrédients, fiches techniques, menus

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Créer la base dont dépendent la liste de courses, le mapping, les coûts et les marges. Ingrédient, fiche technique et menu vont ensemble : un menu est une sélection de recettes, une recette se décrit par sa fiche technique, une fiche technique se compose d'ingrédients.

## Features

1. **Ingrédients** : nom, unité d'achat, unité d'usage et conversion, fournisseur (Metro par défaut), prix courant, date du prix, catégorie, mode de conservation.
2. **Fiches techniques** reliées aux recettes existantes : ingrédients avec grammage brut par portion, rendement (brut vers net), étapes ordonnées avec durée, poste (découpe, cuisson, sauce, conditionnement…) et indication « préparable en masse / sous vide / congelable » ou « frais, 48 h maximum ».
3. **Calculs** : coût matière théorique par portion à partir des prix courants, besoin brut pour N portions, durée totale par poste pour N portions (en distinguant le temps fixe du temps proportionnel au volume).
4. **Saisie adaptée au chef** : écran simple, utilisable sur tablette, avec duplication d'une fiche existante.
5. **Menus** : ensemble de recettes pour une période ou un bloc, statut `brouillon` → `valide_chef` → `valide_nutritionniste` → `verrouille`. Un menu verrouillé n'est plus modifiable ; le déverrouiller exige un rôle `admin` et laisse une trace.
6. **Lien avec le menu de l'app** : un menu verrouillé peut alimenter les plats proposés dans l'app. Propose-moi la façon de relier les deux sans casser le menu actuel.

## Critères de réception

- Une fiche technique complète saisie par un utilisateur `chef` donne le bon coût par portion et le bon besoin brut pour 40 portions.
- Un menu verrouillé refuse toute modification, en base et dans l'interface.

## Hors périmètre

Pas de sessions ni de listes de courses (session 05), pas de coûts réels (session 14).

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
