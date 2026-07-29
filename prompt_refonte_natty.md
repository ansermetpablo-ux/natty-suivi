# Prompt pour Claude Code — Refonte complète de l'app Natty

> À utiliser directement dans Claude Code, lancé depuis la racine du repo `natty-suivi`.
> Les 5 maquettes sont dans `design/mockups/design-mockup/` : `PROFIL.png`, `COACHING.png`, `SUIVI.png`, `REPAS.png`, `MENU.png`.
>
> **Source exacte (fidélité maximale)** : ces 5 écrans sont les pages 13 à 17 du design Canva `DAHJ8Cj4yrU` ("PROFIL", pages 1080×1920 chacune) — page 13 = Menu, 14 = Suivi, 15 = Repas, 16 = Coaching, 17 = Profil. **Si Claude Code a accès au connecteur MCP Canva**, utilise `read-design`/`export-design` directement sur ce `design_id` pour lire le texte exact et exporter les pages en PNG haute résolution (pro quality) plutôt que de te fier uniquement aux PNG déjà présents dans le repo — ça élimine toute approximation de lecture d'image. Texte exact confirmé par lecture directe du design (à reproduire mot pour mot, y compris emojis et ordre) :
> - Menu (p.13) : "3 PLATS PAR SEMAINE", cartes "COACHING" / "SUIVI"
> - Suivi (p.14) : "0%", "Score nutritionnel", "À revoir", "PROTÉINES" / "GLUCIDES" / "LIPIDES", "Calories aujourd'hui", "Mes repas"
> - Repas (p.15) : "POULET MOUTARDE", "687 Kcal", "88g 🥩", "455g 🌾", "82g 🥑", "DÉCOUVRIR", "Recettes du Monde" / "Ingrédients" / "Aléatoire"
> - Coaching (p.16) : "12 JUILLET 17H", "RENDEZ-VOUS ONBOARDING", "27 jul - 2 aou 2026", "CHAT"
> - Profil (p.17) : "ANTOINE DUPONT", "19 Ans", "Joueur de foot ⚽", "Niveau 23", "NATTY SCORE", "96 Pts", "Moyennes par jour", "190g 🥩", "455g 🌾", "82g 🥑", "Posts :"
>
> Nav commune confirmée visuellement sur toutes les pages : **Suivi / Menu / (+) / Coaching / Défis** — "Suivi", "Coaching" et "Défis" confirmés mot pour mot par l'extraction de texte du design ; "Menu" est visible sur les captures mais n'est pas ressorti dans l'extraction texte brute (probablement une icône sans calque de texte séparé dans Canva) — vérifier son libellé exact à l'écran avant de coder si un doute subsiste.

---

## Contexte

Tu travailles sur **Natty**, une app de coaching nutritionnel gamifiée, actuellement en ligne sur `natty-suivi.vercel.app` et `natty-nutrition.com` (Wix pour l'auth/CMS). Le front est constitué de pages HTML statiques déployées sur Vercel, avec Supabase comme backend (projet `hrsvcelmwdlcswwagxfa`).

Fichiers existants à connaître (ne pas casser leur logique data, seulement leur UI si nécessaire) :
- `index.html` — dashboard actuel (score nutritionnel, macros, historique repas) → sera remplacé par le nouvel écran **Suivi**
- `onboarding.html` / `onboarding_v3.html` — questionnaire d'inscription, calcul BMR (Mifflin-St Jeor), écriture dans la table Supabase `onboarding`
- `chat.html` — chat temps réel client/nutritionniste (Supabase Realtime + emails Resend) → à intégrer dans le nouvel écran **Coaching**
- `map.html` — carte d'apprentissage gamifiée (ceintures, XP, mini-jeux) → doit alimenter les futurs **succès/achievements** et l'onglet **Défis**
- `offre_v7.html` — tunnel d'abonnement (Formule → Objectif → Nutritionniste → Plats → Paiement)
- `admin_v5.html` — back-office nutritionniste (à ne pas toucher)

Stack à conserver tel quel : Supabase (DB + Realtime), Cloudinary (cloud `dujji1s6g`, preset `meal_photos`) pour les photos de plats, Stripe pour les paiements, Resend pour les emails, `conseils.py` pour la génération de recettes personnalisées (format `{nom, macros:{p,g,l,kcal}, steps:[{em,t,tip}]}`).

---

## Objectif de la mission

Refaire entièrement l'interface client de Natty pour qu'elle corresponde **à l'identique** aux 5 maquettes fournies (`PROFIL.png`, `COACHING.png`, `SUIVI.png`, `REPAS.png`, `MENU.png`), tout en intégrant un ensemble de fonctionnalités qui ne sont pas visibles sur les images mais qui doivent être construites en respectant strictement le même système visuel.

## Règle absolue de fidélité visuelle

**Reproduis les 5 images à l'identique : couleurs exactes, typographie (grandes majuscules bold pour les titres, style condensé/rond), rayons d'arrondi des cartes, pastilles noires arrondies pour les badges (ex. "687 Kcal", "12 JUILLET 17H", "3 PLATS PAR SEMAINE"), disposition exacte des éléments, icônes (maison, profil, éclair, fourchette, calendrier, flamme), emojis utilisés pour les macros (🥩 protéines, 🌾 glucides, 🥑 lipides).**

Ne t'inspire d'aucun autre design system, ne réinvente rien visuellement, et n'utilise pas de style "neumorphique à ombres douces" (glassmorphism, box-shadow multiples) — les maquettes sont dans un style plus flat/plein avec fond gris clair `#f0f0f3`-like, cartes blanches/grises à coins très arrondis, contrastes noirs francs pour les badges. Base-toi uniquement sur ce que montrent les captures.

Pour toute fonctionnalité listée plus bas qui n'apparaît sur aucune des 5 images : construis-la en réutilisant exactement les mêmes codes visuels déjà présents dans les maquettes (mêmes couleurs, même style de badge/pastille, même typographie, même rayon d'arrondi) — jamais un style ou une palette inventée de toutes pièces.

---

## Découpage écran par écran (ce que montrent précisément les images)

**PROFIL.png** — Header avec icône maison (retour accueil) et icône réglages en haut. Nom "ANTOINE DUPONT" en gros, "19 Ans / Joueur de foot ⚽" en dessous, "Niveau 23" avec barre de progression fine. Photo de profil circulaire cerclée de bleu marine. À droite : "NATTY SCORE" en label, "96 Pts" en gros chiffre vert, puis "Moyennes par jour" avec 3 pastilles 🥩190g 🌾455g 🥑82g. Section "Posts :" en grille 2 colonnes avec les photos des plats postés.

**SUIVI.png** — Header maison + icône profil. Grand anneau circulaire (point rouge en haut) avec "0%" et "Score nutritionnel" au centre, badge rose clair "À revoir" en dessous. Trois cartes macro côte à côte (🥩 Protéines, 🌾 Glucides, 🥑 Lipides), chacune avec valeur en g et "Obj. -g". Bandeau "⚡ Calories aujourd'hui" avec compteur "-/- kcal". Section "Mes repas" listant les repas du jour avec date, score et appréciation ("Très bon choix").

**REPAS.png** — Header avec icône "🌾". Titre du plat "POULET MOUTARDE" + badge noir "687 Kcal". Grande photo du plat. Trois pastilles macro sous la photo (🥩88g 🌾455g 🥑82g). Section "DÉCOUVRIR" avec 3 cartes : "Recettes du Monde" (icône globe), "Ingrédients" (icône panier de légumes), "Aléatoire" (icône dé).

**COACHING.png** — Grande bannière photo avec overlay texte "RENDEZ-VOUS ONBOARDING" + badge date "12 JUILLET 17H" en haut à droite de la bannière. En dessous, un sélecteur de semaine (ex. "27 jul - 2 aou 2026") avec les 7 jours (LU-DI) et le jour courant en rond noir plein. Section "CHAT" en dessous (aperçu des derniers messages avec le nutritionniste).

**MENU.png** — Bannière "3 PLATS PAR SEMAINE" avec 3 photos rondes de plats côte à côte. En dessous, deux grandes cartes cliquables côte à côte : "COACHING" (photo lifestyle) et "SUIVI" (photo avec overlay stats "🔥2982 Kcal / 🥩144g Prot. / 🌾418g Glu.").

## Barre de navigation commune (présente sur les 5 écrans)

Barre fixe en bas, fond blanc arrondi, 5 éléments : **Suivi** (icône éclair), **Menu** (icône fourchette/couteau), bouton **+** central (rond noir plein, plus gros que les autres, action = ajouter un plat/photo), **Coaching** (icône calendrier), **Défis** (icône flamme).

Cette barre doit être un composant unique partagé (un seul fichier JS/HTML injecté), pas dupliqué et modifié séparément dans chaque page — évite les incohérences si on doit la changer plus tard.

⚠️ Il n'y a pas de maquette pour le contenu de l'onglet **Défis**. Propose une première version cohérente avec le reste (voir section achievements plus bas) en attendant une maquette dédiée.

---

## Fonctionnalités à intégrer (absentes des images, à construire dans le même style visuel)

### Profil — XP et progression
- XP total affiché, avec détail des sources : plats ajoutés, objectifs macro atteints, recettes suivies
- Niveau/ceintures reliés au système déjà existant dans `map.html` (mêmes paliers, même logique de progression)
- Les macros "Moyennes par jour" et le "Natty Score" doivent être calculés en temps réel depuis les plats réellement enregistrés par l'utilisateur (requête Supabase), pas des valeurs statiques
- Chaque plat affiché dans "Posts" doit montrer ses propres macros (P/G/L) à la volée
- Le bouton central "+" doit ouvrir la prise de photo (input file avec `capture="environment"` sur mobile) pour ajouter un nouveau plat

### Recettes suivies + notation par IA
- Quand une recette personnalisée est recommandée à l'utilisateur (issue de `conseils.py`), il peut la "suivre"
- Après qu'il poste sa propre réalisation, un système de notation de ressemblance par IA compare sa photo/son plat à la recette originale et donne un score de similarité en %
- Plus la ressemblance est élevée, plus l'utilisateur gagne d'XP sur cette action

### Mini-jeux de découverte (cartes "DÉCOUVRIR" de l'écran Repas)
Les 3 cartes visibles sur `REPAS.png` ("Recettes du Monde", "Ingrédients", "Aléatoire") ouvrent chacune un mini-jeu plein écran (fond blanc, pas de nav visible pendant le jeu) qui détermine quelle recette l'utilisateur va découvrir. Dans les 3 cas, le résultat du jeu débouche sur une liste de propositions de recettes (plat principal + sauces + accompagnements possibles) affichée en dessous, que l'utilisateur peut ensuite "suivre" (voir section notation IA ci-dessus — le suivi d'une recette issue d'un mini-jeu fonctionne exactement pareil).

**Recettes du Monde — fléchette sur le globe**
- Plein écran blanc avec un globe terrestre illustré qui tourne lentement, titre qui explique la mécanique à venir
- Au lancement, le globe accélère et se met à tourner rapidement
- L'utilisateur effectue un geste "drag and throw" (glisser puis relâcher, comme lancer une fléchette) en direction du globe
- Quand la fléchette touche le globe, un pays est tiré aléatoirement au point d'impact (ex. "Albanie")
- Résultat : propositions de recettes issues de la cuisine de ce pays (plat, sauce, accompagnement)

**Ingrédients — potager**
- Plein écran blanc avec une illustration de potager (légumes plantés dans la terre, seules les fanes dépassent)
- L'utilisateur glisse/tire la fane d'un légume vers le haut (geste "arracher") pour le déterrer
- Le légume révélé devient la base du repas
- Résultat : propositions de recettes/sauces/accompagnements construits autour de ce légume

**Aléatoire — défilement rapide**
- Plein écran blanc, aliments ET recettes de toutes sortes qui défilent très vite (façon machine à sous/roulette verticale)
- L'utilisateur appuie sur "Stop" pour figer le défilement
- L'ingrédient ou la recette affiché au moment de l'arrêt est celui proposé à suivre

### Plats postés — double notation + commentaires
- Chaque plat posté a une note issue de l'algorithme (calculée dans le module Suivi à partir du Nutri-Score/équilibre macro) ET une note donnée par les autres utilisateurs
- Système de commentaires sous chaque plat posté

### Notification "Repas du midi" façon BeReal
- Notification push envoyée à heure fixe (ex. 12h) invitant à poster son plat du midi dans un délai limité (ex. 2 minutes, avec timer visible)
- Le feed des plats postés par les autres utilisateurs est flouté/verrouillé tant que l'utilisateur n'a pas posté le sien (déblocage réciproque)
- Badge "en retard" pour les plats postés après le délai

### Succès / Achievements (à placer dans le profil, et à relier à l'onglet Défis)
Grille de badges avec paliers bronze/argent/or/diamant, cohérente avec les ceintures de `map.html`. Catégories :
- **Cumuls avec métaphores rigolotes** : huile utilisée (jerrican → baignoire → piscine), viande consommée (poids d'un cochon → d'une vache), sucre cumulé (hauteur d'un immeuble → de la Tour Eiffel), eau bue (baignoire → citerne)
- **Exploration/diversité** : nombre d'aliments différents enregistrés, nombre de cuisines du monde essayées, nombre de recettes suivies
- **Régularité** : streaks de jours consécutifs avec logging complet
- **Réseau** : recette personnelle suivie par d'autres utilisateurs, plat ayant reçu beaucoup de likes, top du classement communautaire du mois
- **Relation nutritionniste** : premier message envoyé, régularité des échanges, onboarding complété à 100%
- Chaque déblocage de succès déclenche un pop-up façon "Advancement" Minecraft (bannière qui glisse depuis le bord, icône + le nom du succès), dans le même style graphique que le reste de l'app (pas de style Minecraft pixelisé, juste la mécanique de l'animation)

### Graphiques comparatifs (inspiration/comparaison entre utilisateurs)
- Classement XP hebdomadaire (entre amis ou utilisateurs du même nutritionniste)
- Positionnement en percentile ("tu es dans le top 15% pour l'équilibre protéines cette semaine")
- Heatmap de régularité (façon contributions GitHub, un carré par jour)
- Courbe d'évolution du Nutri-Score dans le temps
- Classement des recettes les plus suivies de la semaine (tendances)
- Répartition des repas par type (petit-déj/déjeuner/dîner/collation) en donut chart

---

## Méthode de travail recommandée

1. Crée une branche dédiée (`git checkout -b refonte-nav`) — ne touche pas à `main` directement.
2. Construis d'abord le composant de navigation commun, puis un écran à la fois dans cet ordre : Suivi → Menu → Repas → Coaching → Profil → Défis.
3. Après chaque écran, prends une capture du rendu et compare-la toi-même à l'image source correspondante avant de passer à la suivante ; corrige les écarts visuels avant de continuer.
4. Commit après chaque écran validé.
5. Ne modifie aucune logique Supabase/Cloudinary/Stripe existante — uniquement l'UI et l'ajout des nouvelles fonctionnalités listées ci-dessus, branchées sur les tables/requêtes déjà en place quand elles existent.
6. Une fois les 6 écrans faits, push la branche pour obtenir une preview Vercel avant de merger dans `main`.
