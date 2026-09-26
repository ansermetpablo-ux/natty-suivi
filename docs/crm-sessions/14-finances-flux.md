# Session 14 — Finances : ventes, achats, factures

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Faire entrer automatiquement l'argent qui rentre et qui sort. Ventes, achats et lecture des factures forment les flux de base : sans eux, aucune marge réelle n'est calculable (session 15).

## Features

1. **Ventes Stripe** : import des paiements et abonnements (webhook existant ou tâche planifiée), rattachés au client et aux commandes, avec frais Stripe.
2. **Ventes B2B facturées via Qonto** : vérifie dans la documentation actuelle de l'API Qonto ce qui est possible (lecture, création de factures clients). Si la création est possible : génération depuis le CRM après validation. Sinon : le CRM prépare les données de facture et importe ensuite la facture émise.
3. **Synchronisation des transactions Qonto** : tâche planifiée Vercel, import des transactions, catégories, justificatifs attachés, déduplication. Clé API en variable d'environnement, accès en lecture seule autant que possible.
4. **Achats** : tri par fournisseur avec règles de reconnaissance (libellé contenant « METRO » → fournisseur Metro, catégorie matière première), catégories paramétrables (matière, emballage, cuisine, livraison, marketing, logiciel…). File des transactions non catégorisées.
5. **Lecture des factures Metro** par l'API Claude : photo ou PDF (justificatif Qonto ou dépôt manuel) → lignes (article, quantité, unité, prix) → rapprochement avec les ingrédients (proposition, validation humaine, mémorisation des correspondances). Mise à jour du prix courant des ingrédients (session 04) avec historique.
6. **Rattachement** d'un achat à une ou plusieurs sessions (proposition selon la date et la liste de courses correspondante).
7. **Prestations en nature** : possibilité de marquer une livraison comme non facturée avec sa nature (sponsoring, test, dégustation), pour la traiter en session 15.

## Critères de réception

- Les transactions Qonto du dernier mois sont importées sans doublon et majoritairement catégorisées automatiquement.
- Une facture Metro réelle est lue, ses lignes rapprochées des ingrédients, et les prix mis à jour après validation.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
