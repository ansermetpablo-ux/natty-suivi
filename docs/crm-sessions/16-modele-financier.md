# Session 16 — Le modèle financier unique

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Un seul modèle, trois usages (section 3.4 de la spec) : piloter et contrôler, convaincre banques et investisseurs, et appuyer les commerciaux. Hypothèses, prévisionnel et plan de financement sont un même objet vu sous trois angles, d'où leur construction ensemble.

## Features

1. **Scénarios d'hypothèses** : prix, volumes et montée en charge, taux de conversion, coûts unitaires (repris des coûts réels de la session 15 par défaut, surchargeables), charges fixes, embauches, investissements. Import des variantes des scénarios de deal (session 13).
2. **Prévisionnel mensuel** sur 36 mois : compte de résultat, trésorerie, besoin en fonds de roulement, seuil de rentabilité. Calculé par le CRM, jamais par l'IA.
3. **Plan de financement** : besoins (investissements, BFR, trésorerie de départ) et ressources (apports, prêts, prêts d'honneur, subventions, levée), avec remboursements intégrés à la trésorerie. Branchement prévu avec les dossiers de financement (session 18).
4. **Réel contre prévu** : les mois écoulés affichent le réel (sessions 14 et 15) face au prévisionnel, avec écarts.
5. **Vue pilotage** : tableaux et graphiques internes, stress test (pic de commandes non absorbable par la trésorerie : alerte si un scénario fait passer la trésorerie sous un seuil).
6. **Vue banque et investisseurs** : tableaux normés (compte de résultat, plan de financement, trésorerie), prêts à exporter.
7. **Vue commerciale** : pour un client, ce que le programme coûte, ce qu'il apporte et comment il peut être financé, à partir de la fiche client et du scénario de deal.
8. **Supports de pilotage** : tableau des OKR, tableau Coût-Délai-Qualité, compte de résultat synthétique et trésorerie simplifiée, exportables pour les points d'étape (Focale du 9 décembre 2026).
9. **Exports** Excel et PDF pour chaque vue.

## Critères de réception

- Modifier une hypothèse met à jour les trois vues de façon cohérente.
- Les mois écoulés reprennent bien le réel.
- Les exports Excel s'ouvrent correctement et restent lisibles.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
