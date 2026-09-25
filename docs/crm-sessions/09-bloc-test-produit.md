# Session 09 — Le bloc Test produit de bout en bout

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Assembler tout ce qui a été construit (moteur, menus, commandes, sessions, cuisine, logistique, disponibilités) dans le premier bloc métier réel, celui du test Fnac. C'est la session d'intégration : elle révèle ce qui manque entre les briques.

## Features

1. **Modèle de bloc « Test produit »** saisi en base avec les tâches, décalages, rôles et dépendances de la section 6 de la spec, et ses paramètres : date de livraison, lieu et contact, nombre de bénéficiaires, plats par personne, mode d'attribution, type de portion.
2. **Déploiement réel** : la validation du bloc crée le menu à composer, le lien de commande, les sessions, les missions de réservation, de courses, d'étiquettes et de tournée, les missions commerciales, et une ligne de coût prévisionnel (matière, cuisine, livraison) stockée pour comparaison future.
3. **Contrôles de capacité** branchés sur le point d'extension de la session 03 : plafond de 350 plats par semaine (commandes existantes incluses), disponibilité des rôles requis aux dates des sessions (session 08), conflit de créneau cuisine avec une autre session. Les conflits s'affichent dans l'aperçu avec une suggestion (décaler, réaffecter).
4. **Enchaînements** : le verrouillage du menu débloque le lien de commande ; la clôture génère volumes et liste ; la confirmation cuisine débloque les courses ; la livraison déclenche les missions de retour et de bilan.
5. **Vue du bloc** : frise du J-14 au J+7 avec l'état de chaque mission, et les objets générés accessibles d'un clic.

## Critères de réception

Scénario complet sur un test fictif de 40 repas :
- création avec aperçu et un conflit volontaire détecté ;
- verrouillage du menu, 40 bons passés, clôture, sessions, liste, réservation, étiquettes, tournée : tout s'enchaîne ;
- décalage de deux jours : tout se recale, la réservation déjà envoyée passe « à modifier » ;
- annulation : tout disparaît proprement.
Écris ce scénario sous forme de test automatisé quand c'est possible.

## Hors périmètre

Aucune nouvelle brique : si une fonction manque, note-la dans le journal plutôt que de l'improviser.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
