# Captures d'écran App Store — 1320 × 2868

Déposer les fichiers finaux **dans ce dossier**, nommés `01-suivi.png`, `02-ajout.png`, etc.
L'ordre des numéros est celui dans lequel ils apparaîtront sur la fiche App Store.

---

## ⚠️ À LIRE AVANT DE COMMENCER : ne pas les prendre sur le simulateur

Le simulateur iOS **n'a pas la police des emoji** : ils s'affichent en `?`. Or dans Natty les
emoji servent d'icônes dans presque tous les écrans — plats, macros, étapes de recette, pastilles
d'ingrédients. Des captures faites au simulateur montreraient donc des `?` un peu partout, et
c'est un motif de rejet (« captures non représentatives ») autant qu'un mauvais argument de
vente.

Vérifié par Pablo sur son iPhone le 5 août 2026 : sur un vrai appareil, les emoji s'affichent
normalement. **Les captures se prennent donc sur un iPhone réel.**

> Si vous n'avez pas le choix et devez passer par le simulateur : prenez UNE capture d'essai
> d'abord et regardez les emoji. S'ils sortent en `?`, arrêtez — il faut un téléphone.

### Quel iPhone

`1320 × 2868` est la résolution native d'un iPhone **6,9″** (16 Pro Max, 17 Pro Max). Sur ce
modèle, une capture (Volume haut + bouton latéral) est déjà au bon format, sans retouche.

Avec un iPhone plus petit — un 6,7″ rend `1290 × 2796` — Apple refusera la dimension. Deux
sorties : emprunter un 6,9″, ou agrandir les images de 2 % jusqu'à `1320 × 2868`. L'agrandissement
est visuellement indolore à ce facteur.

### Comment installer l'app sur le téléphone

L'archive est déjà faite et signée (Apple Distribution, profil Store). Le plus simple est donc de
l'envoyer sur **TestFlight** et de l'installer depuis là — c'est aussi ce qui produira le premier
jeton de notification push, qui manque encore.

---

## Se connecter d'abord

Compte de démonstration : `contact@trait-tendance.com`

⚠️ **Le compte doit être GARNI avant de photographier quoi que ce soit.** Un compte neuf donne
des écrans vides, et un écran vide ne se vend pas — il se lit comme une app cassée. Dans l'ordre :

1. **Onboarding + questionnaire alimentaire** — sans eux, pas de cibles de macros, donc des
   anneaux à zéro sur tous les écrans.
2. **Générer la semaine** (bouton depuis Suivi ou Repas, ~90 s) — c'est ce qui remplit les
   conseils, les 2 recettes, les 3 plats macro et la liste de courses.
3. **Planifier la semaine** — la séquence s'ouvre d'elle-même à la première ouverture ; sinon
   elle est atteignable depuis l'écran Repas.
4. **Enregistrer 3 ou 4 repas en photo**, dont au moins deux aujourd'hui — sinon l'historique et
   le fil social sont vides, et les anneaux du jour sont pleins.

---

## Les huit captures, dans l'ordre

L'ordre raconte une histoire : ce que l'app fait, comment on s'en sert, ce qu'elle a de
particulier, ce qu'on y gagne.

| # | Écran | Où | Ce qui doit être visible |
|---|---|---|---|
| 01 | **Suivi** | onglet Suivi | Les trois anneaux avec un reste crédible (ni pleins, ni à zéro), le module noir des calories restantes, un ou deux repas dans l'historique |
| 02 | **Ajouter un plat** | bouton `+` | Le cadre photo en héros avec une vraie assiette dedans, les anneaux réduits en dessous, les trois sources (Prendre la photo / Galerie / Écrire) |
| 03 | **Un plat en grand** | Social → taper un plat | La photo plein cadre, la bulle noire du titre et les bulles de macros **sous** la carte. C'est le plus bel écran de l'app |
| 04 | **Découvrir** | onglet Social, en haut | Les rangées de cuisines du monde — choisir un moment où les vignettes visibles sont les plus appétissantes |
| 05 | **Ma semaine** | onglet Repas | Le plat du moment en héros avec sa pastille « Aujourd'hui · Midi », et le calendrier noir en dessous avec des créneaux déjà cochés |
| 06 | **Le parcours** | onglet Défis | Une scène du parcours gamifié — de préférence une cinématique ou un mini-jeu, pas un écran de texte seul |
| 07 | **Ma journée** | s'ouvre à la première ouverture du jour | L'arc de jalons, avec au moins un jalon coché en vert et le plat du créneau en cours en dessous |
| 08 | **Le bilan** | après 21 h, ou le samedi soir | Le graphique de la semaine avec plusieurs barres — donc à prendre en fin de semaine, pas un lundi |

### Deux écrans à éviter

- **L'écran de connexion** : il ne montre rien de l'app.
- **L'offre / le paiement** : une capture qui met en avant un abonnement payé hors de l'app attire
  l'attention de l'examinateur sur la 3.1.1 sans nécessité. La justification 3.1.3(e) est dans les
  notes d'examen, c'est là qu'elle doit être et pas ailleurs.

---

## Vérifier avant de déposer

- Dimensions exactement `1320 × 2868`, portrait.
- Aucun `?` à la place d'un emoji.
- Aucun écran vide, aucun « — », aucun libellé de remplissage.
- Le prénom affiché est celui du compte de démonstration, pas « Pablo » (le défaut est corrigé
  depuis le 27 août — s'il réapparaît, c'est que le téléphone porte une version antérieure).
- Pas de notification système ni d'appel entrant en haut de l'image.
