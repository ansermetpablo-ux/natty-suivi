# Session 17 — Documents générés

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Produire automatiquement les documents adaptés à chaque client à partir de son profil, de sa fiche et du modèle financier. Modèles, génération, versions et validation vont ensemble : un document généré n'est utilisable que s'il est traçable et validé.

## Features

1. **Modèles de documents** par type (présentation, contrat, mode opératoire, fonctionnement logistique, business plan, plan de financement) et par profil, avec leurs variables.
2. **Règles de génération par type** :
   - **contrat** : texte figé, seules les variables changent (raison sociale, volumes, prix, durée, dates) ; l'IA ne touche jamais aux clauses ;
   - **présentation** : structure du profil, argumentaire, vocabulaire et features adaptés à la fiche par l'API Claude ;
   - **business plan et plan de financement** : chiffres issus du modèle financier (session 16), texte d'accompagnement rédigé par l'IA ;
   - **mode opératoire et fonctionnement logistique** : assemblés à partir des données réelles (semaine type, sessions, tournées, conservation).
3. **Formats de sortie** : propose-moi les formats les plus utiles (PDF, Word, PowerPoint) et la méthode de génération.
4. **Versions** : chaque génération crée une version rattachée à la fiche client, avec les données utilisées ; comparaison entre versions.
5. **Validation humaine obligatoire** avant tout envoi, avec le nom du valideur.
6. **Envoi** depuis le fil du deal (session 12), document joint, traçé dans les messages.
7. **Kit documentaire du profil** (session 11) branché : à la bonne étape du pipeline, le CRM propose de générer les documents du kit et crée la mission correspondante.
8. **Import des documents Fnac** déjà produits à la main pour le RDV du 19 octobre, transformés en premiers modèles du profil grand compte.

## Critères de réception

- Pour le compte Fnac, une présentation, un contrat et un business plan se génèrent avec les bonnes données, versionnés, et ne peuvent pas partir sans validation.
- Une clause de contrat reste strictement identique d'une génération à l'autre.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
