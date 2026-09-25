# Session 11 — Commercial : comptes, profils, pipeline, suivi

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Poser le commercial et son système d'apprentissage (section 4.3 de la spec). Profil type, fiche client, pipeline et bloc de suivi sont indissociables : la fiche hérite du profil, le pipeline fait avancer la fiche, chaque bloc de suivi enrichit la fiche et remonte au profil.

## Features

1. **Comptes et contacts** : entreprise, particulier ou athlète ; contacts avec fonction, rôle dans la décision (décideur, payeur, utilisateur), coordonnées, réseaux sociaux. Lien avec les clients existants de l'app sans doublon.
2. **Profils types** : portrait, motivations, freins, langage (mots à utiliser et à éviter, tournures), objections avec réponses types, offre recommandée, preuves, séquence de pipeline par défaut, kit documentaire (liste de modèles, branché en session 17). Profils de départ : entreprise, grand compte, athlète égérie, influenceur sport, salle de sport partenaire, particulier sportif. Tables `profil_arguments` et `profil_objections`.
3. **Fiche client** : description libre et profil **obligatoires à la création** ; effectif ou nombre de bénéficiaires, décideur, budget, fréquence, lieu de livraison ; affichage du playbook hérité du profil, personnalisable.
4. **Pipeline** : étapes paramétrables par profil (par défaut : premier contact, découverte, dégustation, proposition, test, négociation, signature, client récurrent), vue en colonnes avec glisser-déposer, montant estimé, responsable, prochaine action.
5. **Bloc de suivi par étape** : date, canal, interlocuteur, verbatims, besoins, objections, arguments utilisés avec verdict (a porté, neutre, rejeté), prochaine action et échéance (qui crée une mission). Passage à l'étape suivante bloqué tant que le minimum n'est pas rempli.
6. **Remontée** : les verdicts incrémentent les compteurs de `profil_arguments` ; vue « arguments qui convertissent » par profil.
7. **Événement `deal.etape_changee`** émis vers le moteur de règles (session 03), avec la règle : passage à « Test » → proposer le bloc Test produit pré-rempli avec les données de la fiche.
8. **Saisie initiale** : crée le compte Fnac Darty (profil grand compte) et le compte Romane Dicko (athlète égérie) avec des champs vides que je remplirai.

## Critères de réception

- Impossible de créer un client sans description ni profil.
- Un bloc de suivi avec trois arguments met à jour les compteurs du profil.
- Passer le deal Fnac à l'étape « Test » propose le bloc Test produit avec le lieu et le nombre de bénéficiaires repris de la fiche.

## Hors périmètre

Envoi et réception des messages (session 12).

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
