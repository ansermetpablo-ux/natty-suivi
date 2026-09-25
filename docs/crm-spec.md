# PROMPT CLAUDE CODE — CRM NATTY

> Mode d'emploi : enregistre ce fichier à la racine du dépôt `natty-suivi` sous `docs/crm-spec.md`, lance Claude Code dans le dépôt, puis envoie : « Lis docs/crm-spec.md en entier et commence par l'étape 0. »

---

## 0. Ta mission et ta méthode

Tu vas construire le CRM interne de Natty dans le dépôt existant `natty-suivi`. Ce document est la spécification de référence. Tu travailles par étapes, dans l'ordre de la section 8, et tu t'arrêtes à la fin de chaque étape pour me présenter ce que tu as fait et ce que tu proposes ensuite.

Règles de travail :

1. **Explorer avant de construire.** Avant toute ligne de code, fais l'inventaire du dépôt (structure, pages, fonctions serverless dans `api/`, dépendances) et du schéma Supabase existant (tables, colonnes, relations, politiques RLS actuelles). Lis `admin.html` en entier. Rends-moi un état des lieux écrit.
2. **Proposer avant d'exécuter.** Pour chaque étape, présente un plan (fichiers créés ou modifiés, migrations SQL, choix techniques) et attends ma validation.
3. **Ne rien casser.** Le site client, l'app iOS (Capacitor, dossier `www/`), le paiement Stripe en mode live et le back-office actuel doivent continuer à fonctionner à chaque étape. Aucune suppression ni renommage de table ou de colonne existante sans mon accord explicite.
4. **Migrations versionnées.** Toute modification de base passe par un fichier SQL numéroté dans `supabase/migrations/`, réversible quand c'est possible. Jamais de modification manuelle non tracée.
5. **Secrets.** Aucune clé en dur. Les variables d'environnement existent sur Vercel (Supabase, Stripe, Cloudinary, Resend). Si une nouvelle variable est nécessaire, dis-le-moi et donne son nom.
6. **Ne pas inventer.** Si une information métier manque, pose la question. La section 9 liste les points encore ouverts : construis-les de façon paramétrable, sans trancher à ma place.
7. **Commits petits et explicites**, en français, sur une branche `crm` créée depuis `main`.
8. **Commandes copiables.** Quand j'ai une action à faire (Supabase, Vercel, terminal Windows), donne la commande exacte à copier-coller et explique ce qu'elle fait.

---

## 1. Contexte Natty

Natty est une startup parisienne de repas préparés par un chef, calibrés pour la performance sportive. SAS à quatre associés à parts égales. Équipe de six associés, tous en alternance (une semaine de cours, une semaine en entreprise), plus un chef et un livreur.

| Personne | Rôle |
|---|---|
| Pablo | Président, produit, coordination, supervision |
| Danilo | Finances, coûts, trésorerie, comptabilité |
| Ferréol | Recherche de financements (avec Danilo) |
| Vincent, Antoine | Partenariats égéries et salles de sport |
| Anatole | Vente, prospection, argumentaires, courses Metro |
| Francis D'Almeida | Chef cuisinier : menus, fiches techniques, supervision en cuisine |
| Livreur | Livraisons |

Offre : abonnement hebdomadaire à 9 € par plat (1 à 10 plats par semaine), ou 10,50 € par plat à l'unité. Paiement Stripe. Clients : athlètes (contrat Romane Dicko, 10 repas par semaine), particuliers sportifs, et grands comptes B2B (négociation en cours avec Fnac Darty).

Production en **mode traiteur** : bases, glucides et sauces préparés en masse, mis sous vide et congelés ; seuls les produits frais sont préparés au dernier moment (48 h maximum à l'avance). Tout est produit en masse par recette ; la personnalisation n'intervient qu'à l'assemblage, en pesant les quantités selon la fiche de chaque client.

Semaine type :

- courses chez Metro la veille de la mise en place (Anatole, à pied, 1 h 30) ;
- mise en place mardi et jeudi (Francis + 3 commis) ;
- sessions de production jeudi et samedi (4 personnes dont Francis) ;
- livraison deux jours après la production, créneau imposé 11 h-13 h.

Cuisine louée 30 € de l'heure, sans minimum, accès 24/7, **toute heure entamée est due**. Réservation par email ou SMS. Capacité maximale : 350 plats par semaine. Objectif : 100 clients récurrents fin 2027 (un client récurrent = 3 repas par semaine).

---

## 2. Existant technique (à vérifier à l'étape 0)

- Dépôt GitHub `ansermetpablo-ux/natty-suivi`, projet Vercel dans l'équipe `natty1`.
- Application multi-pages HTML/CSS/JS, fonctions serverless Vercel, Supabase, Stripe (live), Cloudinary, Resend pour les emails.
- App iOS via Capacitor (dossier `www/`), publiée sur l'App Store.
- Back-office `admin.html` : un seul gros fichier qui interroge Supabase directement depuis le navigateur. Onglets Clients, Menu, Commandes, messagerie avec rafraîchissement toutes les 3 secondes. Profils Administrateur, Nutritionniste, Chef, Logistique.
- Parcours d'abonnement : Formule → Objectif → Plats → Paiement.
- Design system existant : néomorphisme clair (fond `#eef0f3`, doubles ombres marquées, panneaux sombres ponctuels). Le CRM reprend cette identité.

Point de vigilance : l'accès direct à Supabase depuis le navigateur impose des politiques RLS strictes. Le CRM contiendra des données financières et RH : vérifie les politiques actuelles et signale-moi toute table exposée.

---

## 3. Principes d'architecture du CRM

### 3.1 Un seul CRM, admin intégré

Le back-office actuel devient un module du CRM. Ses fonctions (commandes, clients, menu, messagerie) sont reprises à l'identique puis enrichies. Pendant la transition, `admin.html` reste accessible.

### 3.2 Accès par utilisateur

Connexion individuelle via Supabase Auth. Rôles : `admin`, `associe`, `chef`, `nutritionniste`, `logistique`, `livreur`. Chaque associé a en plus un ou plusieurs domaines (finances, financement, commercial, partenariats, production). Les règles d'accès sont appliquées **en base par RLS**, pas seulement dans l'interface. Les finances et les données RH ne sont visibles que des rôles autorisés.

### 3.3 Le moteur central : missions, blocs et règles

C'est le cœur du CRM. Tout le reste s'y branche.

- **Mission** : une tâche datée, avec un responsable, un statut, un module d'appartenance, un objet lié (session, deal, client, réunion…), des dépendances vers d'autres missions, et éventuellement une **action en un clic** (générer la liste de courses, envoyer la demande de réservation de cuisine, imprimer les étiquettes…).
- **Bloc** : une brique réutilisable posée dans un projet (Test produit, Livraison récurrente, Stand événement, Dégustation, Démarrage client). Un modèle de bloc contient des paramètres à saisir et une liste de tâches modèles, chacune avec un module cible, un décalage relatif à la date du bloc (J-12, J+2…), un rôle responsable, des dépendances et, si besoin, une formule de calcul.
- **Règle** : déclencheur + conditions + actions. Exemple : quand un deal passe à l'étape « Test validé », proposer le bloc Test produit.

Comportements obligatoires :

1. **Aperçu avant création.** Valider un bloc affiche d'abord toutes les missions, sessions, tournées et lignes financières qui vont être créées, module par module. L'utilisateur peut en retirer ou en modifier avant de confirmer.
2. **Contrôles de capacité avant validation** : plafond de 350 plats par semaine, disponibilité des personnes (module RH), créneaux cuisine, et à terme trésorerie. Les conflits s'affichent avant confirmation.
3. **Recalage en cascade.** Déplacer un bloc recale toutes ses missions selon leurs dépendances. Une action déjà exécutée (par exemple une réservation envoyée) passe au statut « à modifier ».
4. **Traçabilité.** Tout objet généré garde un lien vers son bloc d'origine, pour pouvoir tout recaler ou tout annuler d'un coup.
5. **Déterministe.** Déclenchements, dates, volumes et coûts sont calculés par des règles fixes. L'IA n'intervient qu'en amont et toujours avec validation humaine (voir 3.5).

Les décalages et tâches des blocs sont **stockés en base**, modifiables sans toucher au code.

### 3.4 Un modèle financier unique, trois sorties

Un seul modèle : hypothèses par scénario, coûts réels (Qonto), prévisionnel mensuel. Il alimente trois vues qui ne se contredisent jamais : pilotage interne (réel contre prévu), dossier banque et investisseurs, dossier commercial destiné au client.

Les charges sont stockées une fois et réparties selon **plusieurs clés en parallèle** (au plat, au temps de session, au poids de matière brute, au client, à la recette), pour comparer les résultats d'une clé à l'autre.

### 3.5 Place de l'IA (API Claude)

- Pré-remplir un bloc de suivi commercial à partir de notes de RDV ou d'un email collé.
- Détecter dans un compte rendu un besoin de bloc (par exemple « test de 40 repas le 4 novembre ») et pré-remplir ses paramètres.
- Rédiger des messages et présentations selon le profil client.
- Extraire les lignes d'une facture Metro (photo ou PDF).

Jamais : réécrire les clauses d'un contrat, calculer des chiffres financiers, envoyer quoi que ce soit sans validation.

---

## 4. Modules

1. **Accueil** : adapté à la personne connectée. Commandes à venir, planning de la semaine toutes échéances confondues (vue de la table missions), alertes, et boutons pour lancer les prochaines missions en un clic.
2. **Production** : commandes (reprise d'admin), menus, recettes et fiches techniques, sessions (mise en place, production), mapping minuté, stocks sous vide et congelés, listes de courses, étiquettes.
3. **Logistique** : courses, tournées et arrêts, plan de rangement pour le livreur (quel colis, dans quel ordre, vers où).
4. **Commercial** : comptes, contacts, profils types (playbook), pipeline, blocs de suivi par étape, campagnes (Hunter), boîte de réception unifiée, scénarios de deal.
5. **Documents** : modèles par profil et documents générés, versionnés, validés avant envoi.
6. **Finances** : ventes (Stripe, facturation Qonto), achats (synchronisation Qonto), lignes de factures, imputations, marges par client, session, recette et période, écarts théorique contre réel.
7. **Modèle financier** : hypothèses, prévisionnel, plan de financement, trois vues.
8. **Financement** : dossiers (Initiative France, Bpifrance, ADIE, ACRE, ARCE, banques…), pièces, échéances.
9. **RH** : disponibilités, réunions, confirmations de présence, notifications, suivi des manquements.

### 4.1 Détail Production

- **Fiche technique** : ingrédients, grammages bruts, rendement, étapes avec durée et poste. Rédigée par Francis.
- **Menu** : un ensemble de recettes pour une période ou un bloc, avec un statut (brouillon, validé par le chef, validé par le nutritionniste, verrouillé). Un menu verrouillé ne se modifie plus : tout ce qui suit en dépend.
- **Bons de commande** : réutilisent la table des commandes existante. Chaque bon attribue des recettes à une personne. Des règles d'attribution répartissent le menu automatiquement quand il n'y a pas de choix.
- **Clôture et agrégation** : à la clôture, les bons sont additionnés par recette pour obtenir les volumes de production, qui alimentent sessions, liste de courses et mapping.
- **Mapping de session** : liste ordonnée et minutée des tâches, heure zéro à l'arrivée en cuisine, affectée par poste (découpe, cuisson, conditionnement…), recalculée automatiquement à chaque session. Affichage plein écran pour tablette : d'abord par recette, puis par bon de commande à l'assemblage avec les quantités à peser. Chronomètre de session et temps restant sur le créneau réservé bien visible ; saisie des durées réelles pour améliorer les estimations.
- **Créneau cuisine** : durée prévue du mapping + marge de sécurité, arrondie à l'heure pleine supérieure.
- **Stocks** : lots de préparations avec date, mode (congelé, frais) et date limite ; alerte avant expiration.

### 4.2 Action « Réserver la cuisine »

Le bouton prépare un message avec date, heure d'arrivée, heure de fin et nombre de personnes.

- Email : envoi via Resend après relecture ; la réponse est rattachée à la session.
- SMS : lien `sms:` qui ouvre l'application SMS du téléphone avec numéro et texte pré-remplis (pas de service payant à ce stade).

La mission passe ensuite en « en attente de confirmation » jusqu'au clic « Confirmée ». Tant que la cuisine n'est pas confirmée, les missions dépendantes (liste de courses, courses) s'affichent en alerte.

### 4.3 Détail Commercial

- **Profils types** : portrait, motivations, freins, langage (mots à utiliser et à éviter), objections avec réponses, offre recommandée, preuves, séquence de pipeline par défaut, kit documentaire. Profils de départ : entreprise (sièges, RH, CSE), grand compte, athlète égérie, influenceur sport, salle de sport partenaire, particulier sportif.
- **Fiche client** : description libre et profil **obligatoires à la création**, plus effectif ou nombre de bénéficiaires, décideur, budget, fréquence, lieu de livraison.
- **Bloc de suivi par étape** : date, canal, interlocuteur, verbatims, besoins, objections, arguments utilisés avec verdict (a porté, neutre, rejeté), prochaine action et échéance. Il alimente la fiche client et les compteurs d'arguments du profil. Passage à l'étape suivante bloqué tant que le minimum n'est pas rempli.
- **Canaux** : email entièrement intégré (envoi, réception, fil) ; Instagram en réponse aux messages reçus via l'API Meta (le premier message de prospection reste manuel) ; LinkedIn sans API de messagerie : le CRM rédige le message, ouvre le profil, et l'utilisateur enregistre l'échange.

### 4.4 Détail RH

- Indisponibilités récurrentes (rythme d'alternance, créneaux fixes) et ponctuelles.
- Réunions : proposition des créneaux communs (ou de ceux où il manque le moins de monde), invitation email avec fichier `.ics` mise à jour en cas de changement, confirmation de présence, rappels SMS via un service d'envoi (à brancher en dernier ; prévoir une table de suivi des envois et de leur coût).
- Les sessions de production utilisent la même mécanique de confirmation que les réunions.
- Manquements : constat de présence après l'événement ; si la personne avait confirmé, est absente et n'a pas prévenu avant le délai de prévenance, un manquement « à justifier » est créé ; délai pour justifier avec un motif de la liste ; décision justifié ou non justifié par une personne autre que l'organisateur ; droit de contestation. **Tous les délais, seuils, motifs et conséquences sont stockés dans une table de règles**, jamais en dur.

---

## 5. Schéma de données cible

Adapte les noms aux conventions du schéma existant. Ne duplique pas une table qui existe déjà (commandes, clients, recettes…) : étends-la.

```
SOCLE
membres (utilisateur auth, rôle, domaines, téléphone, statut associé/salarié/prestataire)
missions (module, type, objet lié, échéance, responsable, statut, action, bloc_id, dépendances)
mission_dependances
modeles_blocs (nom, paramètres attendus)
modeles_bloc_taches (module cible, type d'action, décalage, rôle, dépendance, formule)
blocs (instance dans un projet, paramètres saisis, date de référence, statut)
regles (déclencheur, conditions, actions)

PRODUCTION
commandes, commande_lignes (existantes, + bloc_id, lien_commande_id)
recettes, fiches_techniques (ingrédient, grammage brut, rendement, étape, durée, poste)
ingredients (fournisseur, prix courant, unité)
menus (bloc_id, statut), menu_recettes
liens_commande (menu, date de livraison, lieu, date de clôture, mode de portion)
regles_attribution
sessions (type, date, créneau cuisine, statut réservation, statut, bloc_id)
session_recettes (volumes), session_postes (personne, poste)
session_taches (ordre, poste, durée prévue, durée réelle, dépendance)
stocks_lots (préparation, date, mode, date limite)
listes_courses, liste_lignes

LOGISTIQUE
tournees, tournee_arrets

COMMERCIAL
comptes, contacts
profils_types, profil_arguments (compteurs a porté / neutre / rejeté), profil_objections
deals (compte, profil, étape, montant estimé)
suivi_etapes, suivi_arguments (verdict)
campagnes, messages (canal, sens, statut, contact, deal)
scenarios, scenario_jalons (décalage, dépendance, modèle de message)

DOCUMENTS
modeles_documents (type, profil, variables), documents_generes (version, validé par)

FINANCES
ventes, achats, achat_lignes
cles_repartition, imputations (charge vers session / recette / client / plat, par clé)
cibles (marge par plat, par type de client)

MODÈLE FINANCIER
hypotheses (par scénario), previsionnel (mois x poste), plan_financement

FINANCEMENT
dossiers_financement, pieces, echeances

RH
indisponibilites (récurrence, début, fin)
reunions, participations (réunion ou session, statut, heure d'arrivée, heure de prévenance)
manquements (type, statut, motif, décision, décideur, contestation)
regles_presence (délais, seuils, motifs valables, conséquences)
notifications (canal, destinataire, envoi, coût)
```

---

## 6. Le premier bloc à implémenter : Test produit

J = jour de livraison. Ces valeurs sont les valeurs initiales du modèle en base, modifiables ensuite.

| J | Module | Tâche | Rôle | Dépend de |
|---|---|---|---|---|
| J-14 | Commercial | Envoyer le kit de communication interne | Commercial | Validation du bloc |
| J-12 | Production | Composer et valider le menu du test | Chef, nutritionniste | Validation du bloc |
| J-10 | Commercial | Diffuser le lien de commande | Contact client | Menu verrouillé |
| J-7 | Production | Réserver la cuisine (créneau calculé) | Logistique | Menu verrouillé |
| J-6 | Commercial | Clôturer les bons de commande | Automatique | Lien diffusé |
| J-6 | Production | Générer volumes, liste de courses, mapping | Automatique | Bons clôturés |
| J-5 | Logistique | Faire les courses chez Metro | Logistique | Liste générée, cuisine confirmée |
| J-4 | Production | Session de mise en place | Chef + 3 | Courses faites |
| J-2 | Production | Session de production et assemblage | Chef + 3 | Mise en place |
| J-2 | Logistique | Étiquettes et rangement par bon | Logistique | Production |
| J-1 | Logistique | Confirmer la tournée et le contact sur place | Livreur | Étiquettes |
| J | Logistique | Livrer | Livreur | Tournée confirmée |
| J+2 | Commercial | Recueillir les retours | Commercial | Livraison |
| J+3 | Finances | Comparer coût prévu et réel | Finances | Livraison, achats |
| J+7 | Commercial | RDV de bilan | Commercial | Retours, bilan financier |

Paramètres saisis à la validation : date de livraison, lieu et contact sur place, nombre de bénéficiaires, plats par personne, mode d'attribution (choix libre ou automatique), type de portion (standard ou questionnaire).

Le bloc crée aussi une ligne de coût prévisionnel (matière, cuisine, livraison) qui sera comparée au réel.

---

## 7. Interface

- Reprendre le design system néomorphique de Natty.
- Utilisable sur ordinateur et sur téléphone ; vue tablette plein écran dédiée pour le mapping en cuisine (gros caractères, contraste fort, utilisable avec les mains occupées).
- Navigation par modules, accueil personnalisé selon le rôle.
- Choix technique à me proposer à l'étape 0 : rester en HTML/JS modulaire (cohérent avec l'existant et avec ce que l'équipe maîtrise) ou passer à un framework léger. Donne les avantages et inconvénients dans notre situation, avec ta recommandation. Le CRM vit dans le même dépôt et le même projet Vercel.

---

## 8. Ordre de construction

Arrête-toi à la fin de chaque étape.

**Étape 0 — État des lieux.** Inventaire du dépôt, du schéma Supabase, des politiques RLS et d'`admin.html`. Liste des risques de sécurité. Proposition de structure de dossiers et de choix technique. Aucun code.

**Étape 1 — Socle.** Branche `crm`, authentification Supabase par utilisateur, table `membres` et rôles, politiques RLS de base, coquille du CRM (navigation, accueil vide, design system), intégration des fonctions d'admin actuelles comme module sans régression.

**Étape 2 — Moteur missions, blocs et règles.** Tables, logique de génération à partir d'un modèle de bloc, dépendances, recalage en cascade, aperçu avant création, statuts, actions en un clic. Vue planning de la semaine sur l'accueil.

**Étape 3 — Production.** Recettes et fiches techniques, menus avec verrouillage, liens de commande, règles d'attribution, clôture et agrégation des volumes, sessions, liste de courses, mapping minuté et vue tablette, créneau cuisine calculé, action « Réserver la cuisine ».

**Étape 4 — Bloc Test produit** de bout en bout (section 6), avec contrôles de capacité. Scénario de recette : un test fictif de 40 repas, créé, décalé de deux jours, puis annulé.

**Étapes suivantes (spécification détaillée plus tard)** : logistique et tournées, commercial et profils, documents, finances et synchronisation Qonto, modèle financier, financement, RH et notifications, canaux Instagram et LinkedIn.

---

## 9. Points ouverts : à rendre paramétrables, ne pas trancher

- Lien de commande des salariés d'un client B2B : via l'app Natty avec compte, ou page web simple sans compte. Prévoir les deux possibilités dans le modèle de données.
- Portion par défaut pour un bénéficiaire sans fiche nutritionnelle : standard ou mini-questionnaire.
- La règle actuelle « commande passée 2 jours avant la livraison » est incompatible avec le mode traiteur (courses vers J-5). La date de clôture doit être un paramètre, pas une constante.
- Périmètre du suivi des manquements : associés seulement, ou aussi chef et livreur.
- Facturation clients via l'API Qonto : vérifier dans la documentation officielle ce qui est ouvert avant de concevoir cette partie.
- Service SMS pour les notifications automatiques : à choisir plus tard.
