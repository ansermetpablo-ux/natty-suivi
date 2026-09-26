# Session 00 — État des lieux

Lis `docs/crm-spec.md` en entier. C'est la spécification de référence du CRM Natty. Cette session ne produit **aucun code applicatif** : uniquement de l'analyse et deux documents.

## Ce que tu fais

1. **Inventaire du dépôt** : structure, pages HTML, fonctions serverless (`api/`), dépendances, configuration Vercel, dossier `www/` de Capacitor, scripts de build.
2. **Inventaire de Supabase** : toutes les tables, colonnes, types, relations, index, fonctions, triggers, et politiques RLS actuelles. Donne-moi les requêtes SQL à exécuter dans l'éditeur Supabase si tu n'as pas d'accès direct, et je te colle les résultats.
3. **Lecture complète d'`admin.html`** : fonctions, requêtes Supabase, onglets, rôles, logique de messagerie, points fragiles.
4. **Audit de sécurité** : tables lisibles ou modifiables avec la clé publique, données sensibles exposées, clés en dur, fonctions serverless sans vérification d'identité. Classe les risques par gravité.
5. **Correspondance avec le schéma cible** (section 5 de la spec) : pour chaque table cible, dis si elle existe déjà, s'il faut l'étendre ou la créer. Repère les doublons à éviter (commandes, clients, recettes…).
6. **Choix technique** : HTML/JS modulaire ou framework léger (section 7 de la spec). Avantages, inconvénients dans notre situation, recommandation argumentée.
7. **Structure de dossiers proposée** pour le CRM dans le dépôt.

## Livrables

- `docs/crm-etat-des-lieux.md` : tout ce qui précède.
- `docs/crm-journal.md` : créé avec les sections « Fait », « Décisions », « Écarts avec la spec », « Dette technique », « Points ouverts », « Pour la session suivante ».

## Critères de réception

- Chaque table cible est classée (existe / à étendre / à créer).
- Chaque risque de sécurité est listé avec sa correction proposée.
- Une recommandation technique claire, que je valide ou non.

## Fin de session

Commit des deux documents sur une nouvelle branche `crm` créée depuis `main`, puis résumé. Ne commence pas la session 01.
