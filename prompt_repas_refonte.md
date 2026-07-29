# Prompt Claude Code — Refonte `repas.html` + moteur de recommandation + tutoriels + harmonisation

> À lancer depuis la racine du repo `natty-suivi` (branche `refonte-nav`).
> Prototypes de référence (fichiers autonomes, ouvrables dans un navigateur) :
> - **`design/prototypes/repas-prototype.html`** — mise en page du plat (hero détouré, ingrédients, étapes)
> - **`design/prototypes/minijeux-prototype.html`** — les 3 mini-jeux "Découvrir" entièrement fonctionnels

---

## 1. Refonte de `repas.html`

Le fichier `repas.html` actuel est une version minimale (photo carrée, 3 pastilles macro, 3 cartes "Découvrir"). Il doit être **remplacé par la mise en page de `design/prototypes/repas-prototype.html`**, qui apporte :

- un **hero avec le plat "détouré" qui déborde largement au-dessus de la carte** (ombre portée, léger flottement), avec garnitures flottantes hors cadre
- titre du plat + temps de préparation + description
- pastilles macro 🥩 / 🌾 / 🥑 + total kcal + bouton d'action + bouton favori
- une **grille d'ingrédients** avec pastilles de validation vertes cliquables
- une **rangée d'étapes de préparation** numérotées avec connecteurs pointillés

### Structure de la page (important — c'est ce qui pilote le contenu)

`repas.html` devient la page des **plats conseillés à l'utilisateur** (voir §4 pour l'algorithme qui les génère) :

- **Hero = le prochain repas** conseillé (le plat suivant dans le plan de l'utilisateur)
- **Section "Ma semaine" = les autres repas conseillés** de la semaine, sous forme de vignettes ; cliquer sur l'une d'elles la charge dans le hero (comportement déjà implémenté dans le prototype)

⚠️ **Retirer du prototype** : le badge **"3 PLATS PAR SEMAINE"** (notion d'abonnement, appartient à `menu.html`) et les deux grandes cartes **COACHING / SUIVI** en bas (elles restent dans `menu.html`). La section "Ma semaine", elle, **est conservée** mais change de sens : ce ne sont plus les plats de l'abonnement, ce sont **les plats recommandés par l'algorithme**.

Le bouton d'action du hero doit être **"Suivre cette recette"** (cohérent avec le système de suivi de recette + notation de ressemblance par IA prévu dans le projet), pas "Choisir ce plat".

### Ce qu'il faut CONSERVER de `repas.html` actuel

- la section **"DÉCOUVRIR"** avec ses 3 cartes (Recettes du Monde 🌍 / Ingrédients 🌱 / Aléatoire 🎲) — point d'entrée des mini-jeux (§2)
- **toute la logique data existante** : `Natty.requireAuth()`, `Natty.sbFetch()` sur `meals` et `meal_ingredients`, `Natty.calcMac()`, le paramètre `?id=`, le fallback sur le dernier repas, les états de chargement/erreur
- les inclusions `/assets/core.js` et `/assets/nav.js`, le `manifest.json`, l'`apple-touch-icon`, le bouton retour

**On garde le moteur, on remplace l'habillage.**

### Photo détourée à la place de l'illustration

Dans le prototype, le plat du hero est un **emoji placeholder** (`🍛`, `🥩`…). En intégration, afficher une **vraie photo du plat, détourée (PNG à fond transparent)** — c'est ce détourage qui permet le débordement propre hors du cadre avec ombre portée.

- La photo doit correspondre au plat réellement affiché (`meal.photo_url`, ou l'image du plat recommandé)
- Conserver le comportement de débordement (`overflow:visible`, position absolue, `filter: drop-shadow(...)`) — remplacer simplement l'emoji par un `<img>`
- **Fallback** si aucune photo détourée n'est disponible : photo non détourée dans un cadre classique, sans casser la mise en page
- Images sources déjà présentes dans `design/images menu/` et `assets/img/` — les réutiliser. Pour de nouveaux détourages, le module Python `rembg` est déjà utilisé dans ce projet (voir `CLAUDE.md`)

---

## 2. Intégrer les 3 mini-jeux "Découvrir"

Les 3 cartes de la section DÉCOUVRIR doivent ouvrir chacune un **mini-jeu plein écran** (fond blanc, nav masquée pendant le jeu). Ces 3 jeux sont **déjà entièrement codés et fonctionnels** dans `design/prototypes/minijeux-prototype.html` — **reprendre leur logique JS telle quelle**, en adaptant uniquement l'habillage aux variables CSS partagées (§5).

**Recettes du Monde — fléchette sur le globe**
Plein écran, globe qui tourne lentement puis accélère au lancement. L'utilisateur fait un geste *drag and throw* pour lancer la fléchette ; à l'impact, un pays est tiré au sort (ex. "Albanie") et des recettes de cette cuisine sont proposées (plat + sauce + accompagnement).

**Ingrédients — potager**
Plein écran, un seul plant au centre dont **seule une fane générique dépasse de la terre** — l'identité du légume est **cachée** jusqu'au bout. L'utilisateur tire vers le haut ; le légume n'apparaît que dans le dernier tiers du geste, puis sort en "pop" élastique avec éclats de terre. Si on lâche trop tôt, il replonge avec un rebond. Utilise **GSAP + Draggable** (déjà branchés en CDN dans le prototype).

**Aléatoire — défilement rapide**
Plein écran, aliments et recettes défilant très vite ; bouton **STOP** pour figer le résultat, qui devient la recette proposée.

Dans les 3 cas, le résultat débouche sur des propositions de recettes que l'utilisateur peut **suivre** (même flux que "Suivre cette recette" du hero). **Ces propositions doivent elles aussi passer par l'algorithme de personnalisation du §4** — le tirage détermine une contrainte (pays / ingrédient / hasard), l'algorithme choisit ensuite les recettes qui respectent cette contrainte *et* le profil de l'utilisateur.

---

## 3. Cinématiques tutorielles (première visite uniquement)

Créer une **cinématique explicative animée** pour chacun des 3 onglets **Repas**, **Suivi** et **Coaching**, qui explique le fonctionnement de l'onglet.

**Déclenchement** : au **tout premier clic** sur l'icône de nav correspondante, et **jamais plus ensuite**. Persister l'état vu dans `localStorage` (une clé par onglet et par utilisateur, ex. `natty_tuto_repas_{USER_ID}`), sur le modèle des guards déjà utilisés dans le projet (`natty_conseils_semaine_{userId}`).

**Style** : réutiliser le **moteur cinématique "kinetic" de `narration.html`** (tout est préfixé `k_`, scellé dans `#klayer` : `k_playSeq`, `k_showPlan`, `k_buildContent`, `k_sayToSeq`, bibliothèque `K_SVG`, transitions `K_ENTERS`/`K_OUTS`). Ne pas réinventer un moteur d'animation : extraire/factoriser celui existant pour qu'il soit réutilisable par les autres pages.

⚠️ Contraintes du moteur kinetic déjà documentées dans `CLAUDE.md` (§9 règles 26-30) à respecter impérativement :
- bouton d'action toujours dans la barre fixe `#k_cta`, jamais dans le plan animé
- auto-avance uniquement sur les frames sans bouton ; une frame avec bouton attend le clic et **reste figée nette**
- ne jamais couper l'animation d'entrée d'un plan (réintroduit le bug "texte qui disparaît")
- **aucun effet de flou sur du texte** (décision produit actée)

Chaque tutoriel doit rester **court** (quelques plans), en français, et expliquer concrètement ce que l'utilisateur peut faire dans l'onglet. Prévoir un moyen de **rejouer** un tutoriel (ex. depuis les réglages du profil) sans avoir à vider le localStorage.

---

## 4. Algorithme de recommandation personnalisée (cœur de la mission)

**Tous** les conseils nutritionnels — plats recommandés comme ingrédients — doivent être **personnalisés**, jamais génériques ni codés en dur.

### Sources de données à croiser

1. **`onboarding`** — objectif global de l'utilisateur : `maturite`, `motivation`, `axe_amelioration`, `freins`, `poids`, `taille`, `age`, `sexe`, `activite`, `bmr`, `tdee`, `deficit`, et les macros cibles (`proteines`, `glucides`, `lipides`, `calories`)
2. **`questionnaire_alim`** — préférences et contraintes alimentaires : `allergies`, `regime`, `aliments_aimes`, `aliments_evites`, `decouverte_cuisines`, `decouverte_styles`, `decouverte_ingredients`, `frequence_cuisine`, `nb_repas`, `snacking`, `defi_principal`
3. **`meals` + `meal_ingredients`** — ce que l'utilisateur a **réellement mangé cette semaine** (plats et ingrédients enregistrés)

### Logique attendue

L'algorithme doit analyser **l'objectif global** de l'utilisateur **et** ce qu'il a déjà mangé, pour proposer des recettes qui :

- **vont dans le sens de son objectif** (déficit/surplus calorique, répartition macro cible, axe d'amélioration déclaré)
- **se démarquent de son alimentation actuelle** — c'est un critère explicite : si la semaine est déjà très riche en poulet et en riz, ne pas reproposer poulet-riz ; privilégier des sources de protéines, des féculents, des légumes et des cuisines **non encore utilisés** cette semaine
- **respectent absolument** les allergies, le régime et les aliments évités du `questionnaire_alim` (contrainte bloquante, jamais contournée)
- tiennent compte du temps de cuisine déclaré (`frequence_cuisine`, `temps_cuisine`) pour ne pas proposer des recettes irréalistes

### Sortie

Le résultat alimente directement `repas.html` : **prochain repas → hero**, **autres repas conseillés → section "Ma semaine"**. Les recommandations issues des mini-jeux (§2) passent par le même algorithme, avec la contrainte du tirage en plus.

Réutiliser l'infrastructure existante plutôt que d'en créer une nouvelle : `api/claude.js` (proxy Claude), `api/save-conseils.js`, la table `profil_conseils`, et le format de recette déjà en place (`{nom, macros:{p,g,l,kcal}, steps:[{em,t,tip}]}`).

⚠️ Ne jamais inclure `liste_courses_json` ni `recettes_json` dans un SELECT sur `profil_conseils` — **ces colonnes n'existent pas** et la requête renverra une erreur 400 silencieuse (piège déjà documenté dans `CLAUDE.md`).

---

## 5. Page Suivi — score et macros

### Score nutritionnel = moyenne réelle de l'analyse des plats

Le score affiché dans l'anneau doit refléter **la note des repas réellement enregistrés par l'utilisateur**, calculée comme la **moyenne de l'analyse de ses plats** sur trois composantes :

- **qualité** des plats
- **pertinence** par rapport à son objectif (celui de l'`onboarding`)
- **variété** de son alimentation

Ces trois dimensions correspondent exactement aux colonnes déjà présentes dans la table `nutrition_scores` (`quality_score`, `relevance_score`, `variety_score`) — les utiliser plutôt que d'inventer un nouveau schéma. Chaque plat enregistré doit être analysé et contribuer à la moyenne.

### Macros = quantités RESTANTES sur la journée

Actuellement les macros affichent les quantités **consommées**. Elles doivent afficher les quantités **restantes pour la journée en cours** : `objectif du jour − déjà consommé aujourd'hui`.

**Ce point doit être explicite dans l'UX**, pas seulement dans le chiffre — le libellé doit lever toute ambiguïté (ex. "restant aujourd'hui" plutôt qu'un simple "Protéines"), et le cas du **dépassement** doit être géré visuellement (valeur négative ou objectif atteint : traitement distinct, lisible d'un coup d'œil). La barre de progression doit rester cohérente avec cette lecture.

---

## 6. Typographie — aligner le prototype sur le projet

Les prototypes chargent `Inter` **et** `DM Sans`. Le reste du projet n'utilise que :

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap
font-family:'Inter',sans-serif
```

**Supprimer DM Sans** et n'utiliser qu'`Inter`, avec les mêmes graisses que le reste du projet (900 titres majuscules, 800 badges/pastilles, 700 libellés, 400-500 texte courant).

---

## 7. Harmonisation visuelle de toutes les pages (symbiose)

`repas.html`, `menu.html`, `coaching.html`, `index.html`, `profil.html` doivent partager **exactement le même langage visuel**. Aujourd'hui elles divergent (les prototypes utilisent `--bg:#f2f2f4` + ombres classiques, alors que `repas.html`/`menu.html` utilisent `--bg:#ffffff` + ombre neumorphique `--nm-so`).

**Source de vérité = celle déjà en place dans `repas.html`/`menu.html`** :

```css
--bg:#ffffff; --card:#ececef; --ink:#101014; --muted:#9d9da8; --icon-mut:#b5b5bd;
--r-xl:32px; --r-lg:26px;
--nm-so:6px 6px 14px rgba(0,0,0,.07), -6px -6px 14px rgba(255,255,255,.9);
```

- **Centraliser ces variables dans `assets/style.css`**, inclus par toutes les pages, plutôt que redéclarées dans chaque `<style>` — même principe que `assets/core.js` et `assets/nav.js` déjà partagés
- Adapter les prototypes à ces variables (ils ne doivent plus introduire leur propre palette)
- Uniformiser partout : header (icônes maison/profil, même taille, couleur `--icon-mut`), badges noirs (même padding, `border-radius:999px`, même graisse), pastilles macro, titres de section (`uppercase`, même taille et `letter-spacing`), colonne `max-width:480px`, padding latéral `20px`
- La barre de nav basse reste identique partout (déjà injectée par `assets/nav.js` — ne pas la dupliquer)

---

## 8. Ajustements sur `menu.html`

Trois retouches précises sur la bannière des plats de la semaine :

1. **Images nettement plus grandes** — les vignettes `.plate-circ` font `104px`. Les agrandir sensiblement pour qu'elles deviennent l'élément dominant de la bannière.
2. **Séparations beaucoup plus fines** — le `gap` de `14px` doit être fortement réduit, pour des plats presque jointifs.
3. **Arrondi légèrement réduit** — les vignettes sont des cercles parfaits (`border-radius:50%`). Réduire légèrement cet arrondi vers une forme moins circulaire (carré aux angles très arrondis / superellipse). Même esprit sur `.big-card`, sans les rendre anguleuses.

Si l'arrondi des images change, répercuter la nouvelle valeur dans `--r-xl`/`--r-lg` pour toutes les pages (cohérence avec §7).

---

## 9. Méthode de travail

1. Rester sur la branche `refonte-nav`, ne pas toucher à `main`.
2. Ordre conseillé : (a) `assets/style.css` commun branché sur toutes les pages → (b) algorithme de recommandation (§4, c'est lui qui alimente le contenu) → (c) `repas.html` + mini-jeux → (d) page Suivi (score + macros restantes) → (e) cinématiques tutorielles → (f) ajustements `menu.html` → (g) passe d'harmonisation finale.
3. Après chaque page, ouvrir le rendu, le comparer aux maquettes de `design/mockups/` et aux prototypes, corriger les écarts avant de continuer.
4. **Tester dans un vrai navigateur, pas seulement `node --check`** — plusieurs bugs de ce projet (scroll parasite, z-index de `#klayer` masquant la nav, drag qui ne se termine pas) n'étaient détectables qu'à l'exécution. Pour les gestes (fléchette, potager), tester avec de vrais `PointerEvent` simulés.
5. Vérifier la syntaxe JS (`node --check` sur le script extrait) avant chaque commit — règle déjà en vigueur.
6. Commit après chaque étape validée, message explicite.
7. Ne modifier aucune logique Supabase / Cloudinary / Stripe existante — uniquement l'UI, le CSS partagé et les nouvelles fonctionnalités décrites ici.
8. Mettre à jour `CLAUDE.md` en fin de mission avec les nouveautés (algorithme de recommandation, mini-jeux, tutoriels, `assets/style.css`).
