# Session 15 — Finances : répartition, marges, écarts

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Transformer les flux en compréhension : où est la marge, où sont les écarts. Clés de répartition, imputations, marges et écarts s'enchaînent : on répartit les charges, on en déduit les marges réelles, on les compare au théorique.

## Features

1. **Clés de répartition** paramétrables : au plat, au temps de session, au poids de matière brute, au client, à la recette, et combinaisons.
2. **Imputations** : chaque charge est stockée une fois et répartie selon **toutes** les clés applicables, calculées en parallèle, pour comparer les résultats d'une clé à l'autre (section 3.4 de la spec). Recalcul automatique quand une charge ou une clé change.
3. **Coût réel** par session, par recette, par plat, par client, par période : matière (achats rattachés), cuisine (heures facturées), emballage, livraison, main-d'œuvre si saisie, frais Stripe.
4. **Marges** par client, session, recette, période, type de client, avec la marge théorique issue des fiches techniques en regard.
5. **Écarts théorique / réel** par poste (matière, perte, emballage, cuisine, livraison, main-d'œuvre), avec seuils d'alerte paramétrables qui créent une mission pour le responsable finances.
6. **Cibles** de marge par plat et par type de client ; écart à la cible.
7. **Prestations en nature** (session 14) : traitement au choix en coût marketing ou en vente à marge nulle, paramétrable, visible séparément.
8. **Tableaux de suivi** filtrables et exportables (CSV, Excel) : choix de la clé, de la dimension, de la période.

## Critères de réception

- Pour une session réelle, le coût total réparti selon deux clés différentes donne deux résultats cohérents, dont la somme égale bien la charge totale.
- Une dérive volontaire du coût matière déclenche l'alerte et la mission.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
