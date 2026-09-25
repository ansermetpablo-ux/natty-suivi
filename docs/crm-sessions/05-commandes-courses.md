# Session 05 — Des commandes aux courses

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Relier la demande à la production : les bons de commande donnent des volumes par recette, les volumes remplissent des sessions, les sessions génèrent une liste de courses. C'est une seule chaîne de calcul, elle se construit d'un bloc.

## Features

1. **Liens de commande** : menu verrouillé, date de livraison, lieu, date et heure de clôture, mode de portion (`standard` ou `questionnaire`), accès (`app` avec compte ou `page_web` sans compte : les deux doivent être possibles, voir section 9 de la spec). Les bons créés utilisent la table des commandes existante, avec le lien de commande et le bloc d'origine.
2. **Page de commande sans compte** : choix des plats dans le menu du lien, nom, et selon le mode, mini-questionnaire (objectif, gabarit) qui fixe la portion. Aucune donnée sensible exposée.
3. **Règles d'attribution** quand il n'y a pas de choix : rotation, répartition égale, recette imposée.
4. **Clôture** : à l'heure fixée ou manuellement, le lien se ferme et les bons sont agrégés par recette, abonnés et bons B2B confondus pour une même semaine de production.
5. **Sessions** : type (`mise_en_place`, `production`), date, créneau, statut, recettes et volumes affectés, personnes et postes. Proposition automatique de répartition des volumes entre sessions selon la semaine type (mise en place mardi et jeudi, production jeudi et samedi), modifiable.
6. **Liste de courses** : besoins bruts de toutes les recettes d'une ou plusieurs sessions, moins le stock disponible (le stock arrive en session 06 : prévois le branchement), arrondis aux unités d'achat, groupés par rayon ou catégorie, avec coût estimé. Version imprimable et version téléphone à cocher.
7. **Missions** : la clôture crée les missions « Générer la liste », « Faire les courses » (rôle logistique, veille de la mise en place) via le moteur de la session 03. Enregistre les actions en un clic « Générer la liste de courses » et « Envoyer la liste au responsable des courses » (email).
8. **Date de clôture paramétrable** pour les abonnés aussi (la règle des 2 jours avant livraison est incompatible avec le mode traiteur, section 9 de la spec) : paramètre global, sans modifier encore le comportement de l'app sans mon accord.

## Critères de réception

- 40 bons sur un lien de test donnent les bons volumes par recette, une répartition en sessions cohérente et une liste de courses exacte (vérifiable à la main sur deux ingrédients).
- La page de commande fonctionne sur téléphone sans compte et se ferme à la clôture.

## Hors périmètre

Mapping et réservation cuisine (session 06), tournées (session 07).

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
