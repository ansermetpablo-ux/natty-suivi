# Session 01 — Socle : identité, rôles, sécurité, coquille

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Poser ce sur quoi tout le reste repose : qui est connecté, ce qu'il a le droit de voir, et l'enveloppe du CRM. Ces trois éléments vont ensemble parce que chaque écran futur dépend des rôles, et que les rôles n'ont de valeur que s'ils sont appliqués en base.

## Features

1. **Connexion individuelle** via Supabase Auth (email et mot de passe, lien magique si simple à ajouter). Déconnexion, mot de passe oublié.
2. **Table `membres`** reliée à l'utilisateur Auth : nom, rôle (`admin`, `associe`, `chef`, `nutritionniste`, `logistique`, `livreur`), domaines (finances, financement, commercial, partenariats, production), téléphone, statut (associé, salarié, prestataire), actif ou non.
3. **Écran de gestion des membres** réservé à `admin` : créer, modifier, désactiver, attribuer rôle et domaines.
4. **Politiques RLS** : helpers SQL (`est_admin()`, `a_role()`, `a_domaine()`), application aux nouvelles tables, et correction des risques critiques relevés à la session 00 sur les tables existantes, sans casser le site client ni l'app.
5. **Coquille du CRM** : page d'entrée, menu par modules (Accueil, Production, Logistique, Commercial, Documents, Finances, Modèle financier, Financement, RH), modules masqués selon le rôle, accueil vide avec le nom de la personne connectée, design system néomorphique, responsive.

## Critères de réception

- Un utilisateur `chef` ne voit ni le module Finances ni la gestion des membres, et une requête directe vers ces tables avec son jeton est refusée par la base.
- Le site client, l'abonnement Stripe et l'app fonctionnent comme avant.
- `admin.html` reste accessible et fonctionnel.

## Hors périmètre

Aucune reprise des fonctions d'admin (session 02), aucun module métier.

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
