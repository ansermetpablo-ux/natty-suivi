# CLAUDE.md — Natty

> Ce fichier couvre deux grands modules développés dans nos échanges :
> 1. **Module "Mon Suivi / Mon alimentation"** — dashboard client, chat, admin nutritionnistes, onboarding, offre (sections rédigées par la session chat/admin).
> 2. **Module "Parcours gamifié" (le « Duolingo de l'alimentaire »)** — `narration.html` et ses mini-jeux (sections marquées `[narration]`, rédigées par la session parcours/jeux). `map.html` et `motion_lab.html` sont référencés dans ce document comme sources/labos mais **n'existent pas dans ce repo** (ni sur `main`, ni dans l'historique git) — voir §3.
> Pour tout ce qui n'est pas documenté ici, écrire « À COMPLÉTER ».
>
> **Mise à jour narration (session parcours/animations — juillet 2026)** : la couche `[narration]` a été entièrement réécrite pour refléter le moteur cinématique « kinetic », la DA noir & blanc, et l'état réel des bugs. Les sections suivi/admin sont conservées telles quelles.
>
> **Mise à jour audit complet (session lecture/état des lieux — juillet 2026)** : renommage `CLAUDE FINAL.md` → `CLAUDE.md`. Documentation de tous les fichiers non couverts jusqu'ici (`accueil.html`, `chat.html`, `challenges.html`, `offre.html`, `questionnaire-alim.html`, `progression.html`, `api/checkout.js`, `api/scan-plat.js`, `api/supabase.js`, `api/webhook.js`). Correction de deux erreurs de statut ("à faire" alors que déjà fait). Ajout d'une section compatibilité Capacitor (§10). Aucun code fonctionnel modifié pendant cette session.
>
> **Objectif produit à moyen terme** : porter cette app web (HTML/CSS/JS vanilla, déployée sur Vercel, embarquée en iframe Wix) sur l'App Store et le Play Store via **Capacitor** (empaquetage du code web existant, PAS une réécriture native). Chantier séparé et ultérieur — voir §10 pour les points de vigilance à garder en tête dès maintenant.

---

## 1. Vue d'ensemble du projet

**Natty** est une app web de coaching nutritionnel qui connecte des clients avec des nutritionnistes.
Elle permet aux clients de :
- Suivre leur alimentation (logs de repas, photos, ingrédients)
- Voir leurs scores nutritionnels (variété, qualité, pertinence)
- Accéder à leur plan personnalisé (macros, calories, objectifs)
- Chatter en temps réel avec leur nutritionniste
- Choisir leur nutritionniste lors de la souscription
- S'abonner à une formule (3 ou 4 repas/semaine, 9€ le plat)
- Compléter un questionnaire d'onboarding intelligent (7 étapes, formats variés)

**Trois nutritionnistes de démo** sont disponibles au lancement :
- Sophie Martin (`sophie@natty.fr`) — spécialiste Performance / Prise de masse
- Lucas Bernard (`lucas@natty.fr`) — spécialiste Perte de poids / Rééquilibrage
- Emma Rousseau (`emma@natty.fr`) — spécialiste Bien-être / Alimentation intuitive
- Mot de passe commun démo : `Nutri26` (encodé base64 dans Supabase : `TnV0cmkyNg==`)
- Admin global : mdp `Natty2026!` (accès via "Accès administrateur" dans l'écran login)
- Chef : mdp `Chef2026!`
- Logistique : mdp `Logistique2026!`
- Back-office admin : `natty-suivi.vercel.app/admin.html`

### Modèle commercial
- Formule 3 repas/semaine : **27€/semaine** (3 × 9€)
- Formule 4 repas/semaine : **36€/semaine** (4 × 9€)
- Récurrence **hebdomadaire** via Stripe
- Inclus : repas livrés + kit recettes + suivi nutritionniste + 2 RDV offerts + messagerie illimitée
- Le suivi nutritionniste est **gratuit** pour les abonnés repas

### [narration] Module "Parcours gamifié" — le « Duolingo de l'alimentaire »
Parcours d'apprentissage interactif, **entièrement front** (aucun backend, aucune requête réseau), pensé pour la **démo** puis l'intégration au site. Objectif produit : à l'issue du parcours, l'utilisateur maîtrise les bases de la **cuisine ET de la nutrition** (contenu « comme un expert », UX « vidéo interactive immersive »).
- Structure = une **narration façon vidéo interactive** : ~121 « beats » (plans successifs) répartis en **10 chapitres**, sur 4 « modes » (nutrition/apprentissage, cuisine, jeu, défi).
- Alterne **écrans de savoir** (flash cards), **cinématiques animées** (mini-vidéos de texte + illustrations), **mini-jeux gestuels** et **défis**.
- Contenu **français**, orienté action (IG, satiété, timing, ordre des ingrédients, rôle de chaque aliment…). Données nutritionnelles vérifiées (ex. œuf ~13 g protéines/100 g, poulet ~31 g, saumon cru ~20 g, lentilles cuites ~8-9 g).
- **Statut** : c'est une **feature à intégrer au site Natty existant** (via déploiement Vercel embarqué en iframe Wix), PAS l'app à migrer en natif. La migration Capacitor/App Store est un chantier séparé et ultérieur.

---

## 2. Stack technique & déploiement

| Outil | Usage |
|---|---|
| **Vercel** | Hébergement de tous les fichiers HTML + proxy API |
| **GitHub** (`ansermetpablo-ux/natty-suivi`) | Repo source — push → redéploiement Vercel automatique |
| **Supabase** | Base de données PostgreSQL (meals, ingrédients, scores, messages, nutritionnistes, onboarding, abonnements, commandes, plans_repas, stocks_mp, recettes, ingredients_base) |
| **Wix Studio** | Front marketing + page "Mon Suivi" (iFrame vers Vercel) |
| **Cloudinary** | Stockage photos de repas |
| **Wix Members** | Authentification utilisateurs |
| **Stripe** | Paiements récurrents hebdomadaires (formules 3 et 4 repas) |
| **Resend** | Emails transactionnels (notifications messages nutritionniste) |
| **Claude API** | IA pour conseils nutritionnels hebdomadaires + analyse de plats |

**URL de production** : `https://natty-suivi.vercel.app`
**Repo** : `https://github.com/ansermetpablo-ux/natty-suivi`
**Login Natty (page Wix)** : `https://www.natty-nutrition.com/mon-suivi`

### Workflow de déploiement
```
Modifier fichier HTML sur GitHub → Commit → Vercel redéploie automatiquement (~1 min)
```

> ⚠️ Toujours vérifier dans Vercel → Deployments que le statut est **Ready** avant de tester.

> ⚠️ `vercel.json` contient les crons ET les headers no-cache — ne pas les séparer.

### Credentials connus
- **Supabase URL** : `https://hrsvcelmwdlcswwagxfa.supabase.co`
- **Supabase anon key** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3ZjZWxtd2RsY3N3d2FneGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDAwMjgsImV4cCI6MjA5MDI3NjAyOH0._M1B_FOhNcgfUaBQFmr-VMGWETui-R28RSUGG553R1w`
- **Cloudinary cloud** : `dujji1s6g`
- **Cloudinary preset** : `meal_photos` (unsigned)
- **Stripe price IDs** : `price_1TbhMB0TTrkVKRpiPvbGHLyI` (3 repas/sem — 27€), `price_1TbhWk0TTrkVKRpiFNYOOcEJ` (4 repas/sem — 36€)
- **Stripe public key** : `pk_test_51TK0Kp0TTrkVKRpi...` (en variable Vercel `STRIPE_PUBLIC_KEY`)
- **Stripe secret key** : en variable Vercel `STRIPE_SECRET_KEY` (ne jamais committer)
- **Resend** : clé dans variable d'environnement Vercel `RESEND_API_KEY`
- **User de test** : `user_id = 7789dd5f-74f8-4f2a-a30f-cea351afb45f`, token hex = `37373839646435662d373466382d346632612d613330662d636561333531616662343566`
- **URL test** : `https://natty-suivi.vercel.app/index.html?token=37373839646435662d373466382d346632612d613330662d636561333531616662343566`

> ⚠️ Le projet Supabase se **suspend automatiquement** après inactivité (plan gratuit).
> Si les requêtes échouent avec `ERR_NAME_NOT_RESOLVED`, aller sur supabase.com → **Resume project**.

> ⚠️ **Realtime Supabase** doit être activé manuellement sur la table `messages` :
> Database → Tables → messages → Enable Realtime

### vercel.json actuel (fusionné — crons + no-cache)
```json
{
  "crons": [
    { "path": "/api/conseils-hebdo", "schedule": "0 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "5 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "10 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "15 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "20 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "25 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "30 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "35 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "40 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "45 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "50 8 * * 1" },
    { "path": "/api/conseils-hebdo", "schedule": "55 8 * * 1" }
  ],
  "headers": [
    {
      "source": "/(.*)\\.html",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Pragma", "value": "no-cache" },
        { "key": "Expires", "value": "0" }
      ]
    },
    {
      "source": "/",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ]
}
```

### PWA : `manifest.json` / `sw.js` — état incohérent
- `manifest.json` référence `/icon-192.png` et `/icon-512.png` comme icônes. **`/icon-192.png` n'existe pas à la racine** (seul `icon-512.png` existe ; les tailles réelles disponibles sont `natty-icon-{76,120,152,180,192,512,1024}.png`) → icône PWA cassée. `suivi.html` et `onboarding.html` utilisent aussi `/icon-192.png` en `apple-touch-icon` (cassé) alors qu'`index.html` utilise correctement `/natty-icon-180.png` etc.
- `sw.js` est un service worker **auto-désactivant** : à l'install/activate, il vide tous les caches et **se désenregistre lui-même** (`self.registration.unregister()`), puis laisse passer toutes les requêtes réseau sans cache.
- `index.html` désinscrit activement tout SW existant au chargement (`getRegistrations().then(reg => reg.unregister())`) et ne réenregistre jamais `sw.js`. `suivi.html`/`onboarding.html`, eux, appellent encore `navigator.serviceWorker.register('/sw.js')` — sans effet réel puisque `sw.js` s'auto-désinscrit, mais incohérence de code à nettoyer si ces pages sont retouchées.
- ⚠️ **Pertinent pour Capacitor** : un service worker n'a pas le même comportement (ni la même utilité) dans une WebView Capacitor que dans un navigateur — cet état "désactivé partout" est en réalité une base saine pour la migration (pas de cache SW à gérer/désactiver spécifiquement pour la WebView).

### Fichier `vercel` (sans extension, racine) — artefact à nettoyer
Copie JSON partielle de `vercel.json` (mêmes crons, **sans** les headers no-cache), probablement un artefact d'un "Add files via upload" antérieur. Vercel ne lit que `vercel.json` — ce fichier n'a aucun effet, mais pollue la racine. À supprimer après confirmation de Pablo (pas fait pendant cette session, lecture seule).

### masterPage.js (Wix Studio) — état actuel
- Toutes les URLs pointent vers `natty-suivi.vercel.app` (plus Netlify)
- Cache-buster `?v=Date.now()` sur toutes les URLs → version fraîche à chaque chargement
- Guard `hasHtml3` : vérifie que `$w('#html3')` existe ET que `onMessage` est une fonction avant d'appeler — évite le crash sur les pages Wix sans iFrame
- `verifierEtCharger()` vérifie `onboarding?completed=eq.true` → redirige vers onboarding ou suivi
- `chargerSuivi()` charge les macros depuis `onboarding` et les passe en URL params

### [narration] Stack du module parcours
- **Quasi 100 % statique** : `narration.html` reste autonome — **aucun backend, aucune clé, aucun appel Supabase**. Seule dépendance externe : Google Fonts (Inter). ⚠️ **Exception ajoutée juillet 2026** : les 3 défis photo (macros/étiquette/accord) appellent désormais `/api/claude` (vision) pour vérifier que la photo correspond à la consigne — voir `k_verifyDefiPhoto()` en §3. C'est un appel **best-effort, fail-open** : si l'API échoue (pas de réseau, backend down), la photo est acceptée sans bloquer — le fichier reste utilisable hors-ligne pour tout le reste, mais n'est plus *strictement* 100 % front sur ce point précis.
- **Images embarquées en base64** dans le HTML (objet `IMGDATA` → alias `PH`, + `K_CUT` pour les sujets détourés). Conséquence : `narration.html` pèse **~2,4 Mo**. Variable `CLOUD_BASE=''` prévue pour basculer les images sur **Cloudinary** (cloud `dujji1s6g`) en prod → le fichier retomberait à ~60 Ko.
- Déploiement identique au reste : push GitHub → Vercel. Intégration prévue au site via iframe (comme `index.html`).
- ⚠️ **Contrainte agent** : pas d'accès réseau pour récupérer des images sur le web (Unsplash/Pexels → 403). Les vraies photos doivent être **fournies par Pablo**, puis détourées/compressées localement (voir `rembg` ci-dessous).
- **Détourage** : le module `rembg` (Python, installable via pip) retire le fond des photos → PNG transparents. Utilisé pour la canette et le steak (objet `K_CUT.canetteCut`, `K_CUT.steakCut`) afin qu'ils reposent « détourés » sur fond blanc dans le jeu de la jauge.

---

## 3. Structure des fichiers

### `index.html` — version courante du dashboard (voir bug navigation `suivi.html` ci-dessous)
Tableau de bord client principal. Chargé dans un iFrame Wix via `$w('#html3').src = url`.

**Rôle** : afficher score nutritionnel (ring SVG), macros du jour, historique repas, popup conseils hebdo, overlay profil, overlays commande/courses/recettes.

**Fonctions clés** :
- `resolveUserId()` / `sbFetch()` (async obligatoire) : accès Supabase
- `init()` : lance en parallèle `chargerRepas()`, `chargerScores()`
- `conseilsGenererEtSauvegarder(silentRefresh)` : appelle `/api/claude`, sauvegarde via `/api/save-conseils`
- `verifierEtMontrerPopupConseils()` : vérifie `profil_conseils` en base, affiche le popup si conseils manquants ou périmés
- `fetchProfilConseils()` : charge et affiche les conseils dans l'overlay profil
- `afficherOnboardingCTA()` : affiche le CTA "Commencer le suivi" pour les utilisateurs non connectés
- `lockScroll()` / `unlockScroll()` : gestion du scroll (overflow:hidden uniquement — PAS position:fixed qui casse le scroll mobile)
- `openProfilOverlay()` / `closeProfilOverlay()` : overlay profil (style.display flex/none — PAS classList)
- `ouvrirListeCourses()` / `ouvrirRecettes()` : N'appellent PLUS `conseilsGenererEtSauvegarder` — affichent un message si pas de données

**Token et persistance** :
- Token extrait de l'URL `?token=HEX` → décodé en user_id
- Si pas de token dans l'URL → cherche dans `localStorage('natty_token')` et `localStorage('natty_user_id')`
- Au chargement avec token valide → sauvegarde dans localStorage pour les prochains rechargements
- Déconnexion → efface localStorage

**Conseils hebdomadaires** :
- Colonnes existantes dans `profil_conseils` : `conseil_prot`, `conseil_gluc`, `conseil_lip`, `conseil_cal`, `conseil_amelioration`, `conseil_points_forts`, `conseils_json`, `semaine`, `generated_at`, `user_id`
- **Colonnes vérifiées présentes (juillet 2026)** : `liste_courses_json`, `recettes_json` et `conseils_json` **existent bien**. L'ancienne consigne « ne pas les utiliser » était fausse — voir §7.
- Guard localStorage : `natty_conseils_semaine_{userId}` stocke le lundi de la dernière génération → bloque le popup si semaine identique
- Guard sessionStorage : `natty_popup_session_{userId}` → bloque re-affichage dans la même session

**Overlays** — tous présents dans le HTML via injection avant `</body>` :
- `#profilOverlay` : overlay profil avec ring SVG (#psrArc), macros (#pmProt, #pmGluc, #pmLip, #pmCal, #pbProt, #pbGluc, #pbLip, #pbCal), conseils (#profilConseilsCont)
- `#popupConseils` : popup génération conseils (#pcStepsList, #pcActionBtn)
- `#onbPopup` : popup onboarding (#onbTrack, #onbNextBtn, #onbD0-3)
- `#conseilsPopup` : popup conseils du lundi (#conseilsPopupPreview)
- `#ovProchainRepas` : overlay commande (3 étapes : #prStep1, #prStep2, #prStep3)
- `#ovListeCourses` : overlay liste courses (#listeCoursesCont)
- `#ovRecettes` : overlay recettes (#recettesCont)

> ⚠️ Le fichier uploadé par Pablo est souvent **tronqué** (pas de `</body>` ni `</html>`). Toujours vérifier et appendre les overlays + balises fermantes si manquants.

### `accueil.html`
⚠️ **N'est PAS la vraie page d'accueil de l'app** — Pablo confirme que la page d'accueil réelle vit sur **Wix** (hors de ce repo, non inspectable/éditable depuis ici). `accueil.html` est un hub de navigation présent dans le repo mais son statut exact (ancien prototype ? page alternative encore accessible par URL directe ? complètement mort ?) reste **À COMPLÉTER** — à clarifier avec Pablo si besoin d'y retoucher un jour.

Contenu technique pour référence (au cas où) : statique, un seul appel Supabase en lecture (`nutrition_scores`, colonnes `variety_score`/`quality_score`/`relevance_score`/`calculated_at`, fallback `meals`). Fonctions : `naviguer(type,url)` (postMessage si en iframe Wix, sinon `location.href`), `chargerScore()`. Liens sortants : `onboarding.html`, `offre.html`, `challenges.html`, `index.html` (corrigé — pointait vers `suivi.html` avant juillet 2026, voir §7 pour l'historique du bug). Ligne ~285 : image inline en base64 (~350 Ko sur une seule ligne).

**Ne pas prioriser de travail sur ce fichier sans confirmation explicite de Pablo.**

### `suivi.html` — ancienne version du dashboard (legacy, encore accessible)
Prédécesseur d'`index.html` : 87 fonctions vs 142, 11 overlays vs 12. `index.html` est un sur-ensemble quasi complet (+60 fonctions) ; 5 fonctions sans équivalent nommé identique (`calcScoreLive`, `chalSubscribeRT`, `fetchAnalyseIA`, `fetchMacroSuggestions`, `subscribeRT`) probablement renommées/fusionnées dans `index.html`, pas supprimées fonctionnellement.

- **Contient son propre flux de login embarqué** : formulaire email/mot de passe → `POST /auth/v1/token?grant_type=password` (Supabase Auth), ~ligne 1799-1830. Après connexion, redirige lui-même vers `/index.html` (ligne ~1827) ou `/onboarding.html` (ligne ~1829) selon l'état — preuve que ce fichier se considère lui-même comme un point d'entrée obsolète qui bascule vers `index.html`.
- Référencé uniquement depuis `accueil.html`, qui n'est lui-même pas la vraie page d'accueil de l'app (celle-ci vit sur Wix, hors repo — voir §3). Donc `suivi.html` est probablement un **doublon mort ou très peu accédé** en pratique, pas un point d'entrée réel des utilisateurs — à confirmer avec Pablo avant toute décision (suppression, etc.).
- Tables touchées (superset de l'époque "tout-en-un") : `abonnements`, `challenge_entreprise`, `challenges`, `daily_macros`, `meal_ingredients`, `meals`, `messages`, `nutrition_scores`, `onboarding`, `rdv`.
- `manifest`/icônes : utilise `/icon-192.png` en apple-touch-icon — **fichier inexistant** à la racine (seuls `natty-icon-*.png` existent) → icône cassée. `onboarding.html` a le même souci.
- Enregistre activement le service worker (`navigator.serviceWorker.register('/sw.js')`) alors qu'`index.html` le désinscrit systématiquement (voir `sw.js` plus bas) — comportement PWA incohérent entre les deux fichiers.
- **Décision à prendre avec Pablo** : ce fichier est-il à supprimer (et corriger le lien dans `accueil.html`), ou encore nécessaire quelque part ? Ne pas le supprimer sans confirmation explicite.

### `chat.html`
Chat client/nutritionniste, autonome, terminé.

- Table Supabase unique : `messages` (`id`, `user_id`, `expediteur` = `client`/`nutritionniste`, `contenu`, `lu`, `created_at`).
- Fonctions : `resolveUserId`, `sb(path,options)` (helper REST générique), `renderMessages`, `appendMessage`, `escapeHtml`, `subscribeRealtime`, `chargerMessages`, `envoyerMessage` (UI optimiste avec `tempId`), `retourSuivi()` → `/index.html?token=...` (cohérent, pas `suivi.html`).
- `subscribeRealtime` ouvre un `WebSocket` manuel (`wss://.../realtime/v1/websocket?apikey=...&vsn=1.0.0`) avec un `phx_join` minimal (`{topic:'realtime:public:messages:user_id=eq.<id>', payload:{}}`) — **protocole Supabase Realtime pré-`postgres_changes`, probablement obsolète** sur l'instance actuelle (à vérifier en prod).
- ⚠️ Reconnexion infinie sans back-off (`setTimeout(subscribeRealtime, 3000)` sur `onclose`) — à surveiller dans une WebView mobile qui bascule souvent en arrière-plan/réseau (spam de reconnexions).

### `challenges.html`
Défis perso/duo/entreprise. Autonome, aucune dépendance avec `narration.html`.

- Tables : `challenges` (`user_id`, `type`=`personnel`/`duo`, `objectif_type`, `duree_semaines`, `date_debut`, `date_fin`, `statut`=`en_attente`/`actif`/`echoue`, `progression`, `adversaire_id`, `created_at`), `challenge_entreprise` (`user_id`, `entreprise_nom`, `prenom`, `code_groupe`, `progression`, `date_inscription`).
- Fonctions : `chargerPerso`, `startChallenge`, `abandonnerChallenge`, `chargerDuo`, `inviterDuo`/`creerDuo`/`accepterDuo`, `chargerEntreprise`, `chargerClassement`/`afficherClassementDemo` (fallback avec données factices codées en dur si la requête échoue), `subscribeRealtime` (même pattern WebSocket manuel obsolète que `chat.html`, topic `realtime:public:challenges`).
- ⚠️ Onclick inline avec quotes échappées manuellement (lignes ~391/423/514/555/556) — fragile, à migrer vers `data-*` + `addEventListener` (règle #8) si retouché. `navigator.clipboard` (ligne ~587) exige un contexte sécurisé — à tester dans la WebView Capacitor.

### `offre.html`
**Fonctionnel et complet** — contrairement au statut "à faire" indiqué historiquement dans ce document (corrigé en §8). Contient l'intégration Stripe Checkout complète.

- Prix en dur : `PRICE_3 = "price_1TbhMB0TTrkVKRpiPvbGHLyI"`, `PRICE_4 = "price_1TbhWk0TTrkVKRpiFNYOOcEJ"`.
- Flux `souscrire()` (ligne ~786) : 1) PATCH `onboarding?user_id=eq.<id>` (email, non bloquant) ; 2) `POST /api/checkout` avec `{priceId, userId, token, formule, objectif, objectifValeur, dureeSemaines, nutritionnisteId, jourLivraison, adresse, emailRecap}` ; 3) redirection vers `data.url` (`window.top.location.href` si iframe, sinon `location.href`).
- Table lue : `nutritionnistes` (`?actif=eq.true`), fallback `NUTRI_DEMO` (3 profils factices) si vide/erreur.
- Autres fonctions : `setStep`, `updateCTA`, `initSlider`/`drawSliderGraph`, `chargerNutris`, `choisirNutri`, `selectJour`, `buildRecap`, `toggleRGPD`.
- ⚠️ Lignes ~205/213 : images inline base64 volumineuses (poids fichier).

### `questionnaire-alim.html`
Étape **distincte et complémentaire** à `onboarding.html` (pas un doublon) : `onboarding.html` gère objectif/profil (table `onboarding`) ; celui-ci gère les préférences alimentaires détaillées, table **`questionnaire_alim`** (colonnes : `user_id`, `allergies`, `regime`, `aliments_aimes`, `aliments_evites`, `decouverte_cuisines/styles/ingredients/variantes`, `curiosite_libre`, `frequence_cuisine`, `nb_repas`, `snacking`, `repas_sautes`, `ressenti`, `craquage`, `satisfaction_stars`, `commentaire_libre`, `defi_principal`, `completed_at`).

- Déclenché depuis `index.html` (ligne ~3619 : vérifie `questionnaire_alim?user_id=eq...&limit=1`, redirige si absent ; aussi via popup conseils, action `'questionnaire'`).
- Soumission (`#btn7`) : POST `questionnaire_alim` → `postMessage({type:'questionnaireAlimDone'})` → redirection `/index.html?token=...&qalim=1`.
- ⚠️ `alert()` natif en cas d'erreur de sauvegarde (~ligne 680) — à remplacer avant portage Capacitor (comportement variable selon plugin webview).

### `progression.html` — ❌ supprimé (juillet 2026)
Existait comme dashboard "progression nutritionnelle" (suggestions IA, analyse complète), mais **n'était relié depuis aucune autre page de l'app** (page orpheline). Remplacé dans son usage réel par `narration.html` (voir décision Pablo du 2026-07-26, §6 et §8) : l'onglet "Progression" de `index.html` ouvre désormais `narration.html` en plein écran. Fichier supprimé, ainsi que les deux endpoints qui n'existaient que pour lui (`api/suggestions-macros.js`, `api/analyse-nutrition.js`, créés puis supprimés dans la même session).

### `admin.html`
Back-office multi-rôles — accessible à `natty-suivi.vercel.app/admin.html`.

**Authentification** : 3 rôles avec mots de passe hardcodés :
- Admin : `Natty2026!` — accès complet
- Chef : `Chef2026!` — onglets Chef et Menu
- Logistique : `Logistique2026!` — onglets Stocks et Commandes

**Onglets disponibles** :
- Clients, Repas à programmer, Messages, RDV, Menu, Commandes, Chef, Stocks, Équipe

**`switchNav(tab)`** : gère tous les onglets. Les listeners sont dans DOMContentLoaded — vérifier que `navRepasAProg`, `navChef`, `navStocks` ont bien leurs addEventListener.

**Onglet Menu — saisie des plats** :
- Formulaire avec champ ingrédients : nom → blur → recherche dans `ingredients_base` (colonnes `cal_per_100g`, `prot_per_100g`, `gluc_per_100g`, `lip_per_100g`) → macros calculées automatiquement
- Variable `_platIngredients[]` : liste des ingrédients en cours de saisie
- `renderIngredientsList()` : affiche les ingrédients avec macros readonly (calculées depuis DB)
- `chargerMacrosIngredient(nom, idx)` : recherche exacte → fuzzy → ilike dans `ingredients_base`
- `recalculerMacrosPlat()` : calcule les totaux et remplit les champs #platCal, #platProt, #platGluc, #platLip en vert
- `sauvegarderIngredientsPlat(platId, platNom)` : crée/trouve la recette dans `recettes`, supprime et recrée les `recettes_ingredients`

**Onglet Stocks** :
- `chargerStocks(view)` : charge `plans_repas` + `recettes` + `recettes_ingredients` pour calculer les vrais besoins en ingrédients (PAS par plat_nom)
- Calcul : `plans_repas → recette correspondante (match par nom) → recettes_ingredients → besoins en kg`
- `afficherStockDashboard(el, stocks, needs, nbPlans)` : `needs` est un map `{ingredient_nom_lower → {nom, qty_kg, plats[]}}`
- Alerte : ingrédient dont `qty_kg_needed > quantite_kg_stock`

**Import facture** :
- `afficherResultatsFacture()` : utilise `window._factureProduitsCache[]` + `data-idx` (PAS `data-produit=JSON` qui cassait la syntaxe)
- `importerSelectionStocks()` : lit depuis `window._factureProduitsCache[idx]`

**Règles inline onclick** : TOUS les onclick inline avec `''+var+''` sont interdits — causent `Unexpected string`. Toujours utiliser `data-*` + `addEventListener`.

### `login.html`
Page de connexion standalone — `natty-suivi.vercel.app/login.html`

**Fonctions** :
- `doLogin()` : POST sur `/auth/v1/token?grant_type=password` Supabase → user_id → encode hex → redirige vers `index.html?token=HEX`
- `doSignup()` : POST sur `/auth/v1/signup` + sauvegarde prénom dans `onboarding`
- `doReset()` : POST sur `/auth/v1/recover`
- `doGoogle()` : redirect vers `SB_URL/auth/v1/authorize?provider=google&redirect_to=https://natty-suivi.vercel.app/login.html?oauth=1`
- Callback OAuth : token dans URL hash → fetch `/auth/v1/user` → redirectToApp

**Config Supabase Auth requise** :
- Site URL : `https://natty-suivi.vercel.app`
- Redirect URLs : `https://natty-suivi.vercel.app/login.html?oauth=1`
- Google OAuth : Client ID `63216057563-o9he66er7kbsjk6crfed3t1j94m2annb.apps.googleusercontent.com` configuré dans Supabase → Providers → Google

**Flux dans index.html sans token** :
- Timeout 2000ms → si pas de USER_ID → `afficherOnboardingCTA()` → bouton "Commencer →" → redirige vers `login.html`

### `assets/garde-manger.js` — les ingrédients dont l'utilisateur dispose
Module partagé (`NattyGardeManger`), chargé par `repas.html` et `suivi.html` (+ copies `www/`).
Dépend de `assets/core.js`.

**Remplissage** — quatre entrées, toutes dans le panneau « Mon garde-manger » de `repas.html` :
`🛒 Mes courses` et `🧾 Ticket` ouvrent la caméra, `🖼️ Une photo` ouvre la galerie (prompt en
détection automatique), `✏️ Saisir` accepte une liste libre (`poulet 600 g, riz basmati 1 kg,
6 oeufs`) parsée localement. Les photos passent par `/api/claude` en vision.

**Fiabilité de l'extraction** : le prompt exclut explicitement les produits ménagers, et
`nettoyer()` repasse derrière avec un filtre local `NON_ALIMENTAIRE` — testé sur un ticket de
caisse, l'IA laissait passer « liquide vaisselle ». Un emoji est déduit du nom (`emojiPour`)
quand le scan n'en fournit pas.

**Rapprochement avec les recettes** : `contient(nom)` compare **mot à mot**, jamais en
sous-chaîne — sinon « ail » serait trouvé dans « volaille ». Un ingrédient de recette absent du
garde-manger s'affiche avec une pastille orange `+` et le compteur « N à acheter ».

**⚠️ Persistance** : la table `garde_manger` **n'existe pas encore** sur l'instance. Tant
qu'elle est absente, le module bascule seul sur `localStorage` (liste propre à l'appareil) et
l'affiche à l'utilisateur. La créer suffit à activer la synchronisation, sans toucher au code :
```sql
create table public.garde_manger (
  user_id    text primary key,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.garde_manger disable row level security;
```

**Effet sur les recettes** : `assets/reco.js` → `chargerProfil()` appelle `NattyGardeManger`
s'il est chargé et remplit `profil.garde` ; `construirePrompt()` ajoute alors la section
« INGRÉDIENTS DISPONIBLES » et deux règles (partir de ce stock, marquer `dispo` sur chaque
ingrédient). Sans le module, le prompt est strictement celui d'avant.

### `assets/ajout.js` — parcours « Ajouter un plat » (bouton + de la nav)
Module partagé, injecté par-dessus l'écran courant (overlay `#nattyAjout`, tout préfixé `na-`/`na`).
Chargé par `suivi.html`, `repas.html`, `coaching.html`, `profil.html` et `menu.html`
(+ leurs copies `www/`), juste avant `assets/nav.js`. Dépend de `assets/core.js`.

**Pourquoi un overlay et pas une page** : le bouton `+` doit ouvrir la caméra *directement*.
L'appel `input.click()` doit donc rester **synchrone dans le handler du clic** — naviguer
d'abord vers une page ferait perdre le geste utilisateur et iOS/WebKit refuserait d'ouvrir
la caméra. `assets/nav.js` appelle `window.NattyAjout.start()` en premier, et retombe sur
l'ancien `window.NattyOnAdd` puis sur `suivi.html?add=1` si le module n'est pas chargé.

**Enchaînement des écrans** (maquettes fournies par Pablo) :
1. `<input capture="environment">` → caméra native.
2. `naScAnalyse` — photo envoyée à `/api/claude` (vision), même prompt que `analyserAvecIA()`
   de `suivi.html`. En cas d'échec : « Reprendre une photo » / « Galerie » / « Saisir à la main »
   (le parcours reste utilisable hors-ligne).
3. `naScRepas` — photo dans un cadre blanc arrondi, **3 anneaux SVG** (protéines / lipides /
   glucides) affichant les **grammes restants pour CE repas**, la ligne « Restants », le détail
   dépliable du repas (ingrédients éditables, quantités, suppression) et les CTA
   « Enrichir ✦ » / « Terminer et enregistrer ». Les anneaux se recalculent à chaque
   modification (`majAnneaux()`), donc ils diminuent au fur et à mesure des ajouts.
4. `naScChoix` — « Réussir votre objectif 🚀 : » → 4 pistes : `resservir`, `ingredients`,
   `plat`, `dessert`.
5. `naScCarou` — carrousel scroll-snap de 5 cartes (titre, emoji, pastille kcal, 3 pastilles
   macro, raison). Un tap ajoute au repas et renvoie à l'écran 3.

**Cible par repas** : `chargerCibles()` lit `onboarding` (`poids`, `tdee`) et refait le calcul
de `calcMacros()`, puis divise par le nombre de repas par jour issu de
`questionnaire_alim.nb_repas` (libellé → entier via `REPAS_PAR_JOUR`). Fallback 2000 kcal /
30-50-20 si l'onboarding n'est pas exploitable. **Ne jamais demander `nb_repas` ni les macros
à `onboarding` : ces colonnes n'existent pas** (voir §4).

**Suggestions** : `optionsIA()` interroge `/api/claude` (texte seul) ; `optionsLocales()` les
compose depuis la table nutritionnelle de `core.js`. Une suggestion dont les macros sont nulles
(ingrédient non reconnu) est écartée et remplacée par des options locales, sinon elle ne ferait
bouger ni les anneaux ni le suivi une fois enregistrée. `classer()` trie par adéquation au
restant, en pénalisant ce qui dépasse nettement. « Me resservir » n'appelle pas l'IA : c'est
l'assiette courante en ½ / 1 / 1½ portion.

**Enregistrement** : rien n'est écrit avant « Terminer ». Chaque plat de la session devient une
ligne `meals` + ses `meal_ingredients` (la photo Cloudinary va sur le premier). L'échec de
l'upload photo n'empêche pas l'enregistrement. À la fin, l'événement `natty:repas-ajoute` est
émis : `suivi.html` l'écoute pour rafraîchir macros et historique sans recharger la page.

### `assets/notifs.js` — le rappel quotidien (notifications **locales**)
Chargé par les cinq écrans porteurs de la nav (`suivi`, `repas`, `menu`/`www/index`, `social`,
`coaching`, `profil`) juste avant `assets/nav.js`. Hors application native, le module se charge
et ne fait rien : `dispo()` renvoie `false`, toutes les actions sont des no-op.

**Locales, pas push** — tout est planifié sur l'appareil : aucune clé Apple, aucun serveur,
aucune table de tokens. La contrepartie est que le texte est figé au moment de la planification.
« Il te reste 40 g de protéines » ou « un ami a ajouté un plat » exigent un calcul à l'envoi ou
un déclencheur venu d'un autre appareil : **ceux-là relèvent du push serveur**, chantier séparé.

**Sept notifications, pas une répétition.** Une planification `on:{hour,minute}` ne porterait
qu'un seul texte, à vie. Le module planifie donc **les 7 prochains jours** un par un (ids fixes
4101..4107, texte différent chacun) et **replanifie à chaque chargement de page** — d'où le
« tout annuler puis tout replanifier », qui empêche d'empiler deux rappels pour le même jour.

**Le rappel du jour saute si le parcours a déjà été ouvert.** `assets/nav.js` expose désormais
`window.NattyNav.vuAujourdhui('defis')` — exactement la clé de la pastille rouge quotidienne, pas
une copie. C'est ce qui relie les deux : la pastille dit « tu n'as pas ouvert », la notification
le rappelle, et aucune des deux ne se déclenche sur quelque chose de déjà fait.

**Demande d'autorisation** : jamais au lancement. Une invitation maison (feuille « Un rappel par
jour ? ») s'affiche **une seule fois**, à partir du **2ᵉ jour d'utilisation** (compté par date
distincte, pas par page affichée), et seulement si la permission est encore en `prompt`. Sur iOS
un refus est définitif — l'app ne peut plus jamais reposer la question, d'où la prudence.

**Réglage** : interrupteur « Rappel quotidien » + heure (6 h → 22 h, 19 h par défaut) dans les
réglages de `profil.html`. Volontairement en `localStorage` : une notification locale est
planifiée sur CET appareil, la stocker en base laisserait croire qu'elle suit l'utilisateur d'un
téléphone à l'autre.

**Tap sur la notification** → `narration.html`, via `extra.route` comparé à une **liste blanche**
(`ROUTES`) : une notification est une entrée externe, on ne suit jamais une destination qu'elle
dicterait.

**Android** : le plugin déclare lui-même `POST_NOTIFICATIONS`, rien à ajouter au manifeste.
`SCHEDULE_EXACT_ALARM` n'est **volontairement pas** demandé (une alarme exacte se justifie pour
un réveil, pas pour un rappel de parcours, et Google la scrute en review) : le plugin retombe
seul sur une alarme approchée.

### `social.html` + `assets/social.js` — le fil social
Onglet « Social » de la nav, **à la place de Coaching** (qui n'est pas supprimé : `coaching.html`
reste accessible par sa carte dans `menu.html`). `social.js` porte les données, `social.html`
le rendu — même découpage que `reco.js` / `repas.html`.

**Source du fil** : la table `meals` elle-même, `user_id=neq.<moi>`, 150 dernières lignes.
Aucune table de posts : un plat enregistré depuis le bouton `+` est *déjà* un post. Les macros
sont recalculées côté client par `Natty.calcMac` (les colonnes `calories`/`proteins_g`/… de
`meal_ingredients` existent mais sont **à 0 sur les 227 lignes en base** — ne pas s'y fier).
Auteurs lus dans `onboarding` (prénom, `poids`, `tdee`) et `questionnaire_alim` (`nb_repas`),
tout par lots de 50 ids (`?col=in.(…)`) pour ne pas dépasser la longueur d'URL.

**Cinq sections** :
1. **Tendances** — tri par `likes × 5 + vues`, à égalité le plus récent. Le premier passe en
   carte vedette « Top 1 🔥 », les suivants dans un rail horizontal.
2. **Vos amis** — les plats des membres suivis, du plus récent au plus ancien, sans plafond
   par membre. Si on ne suit personne (ou si les membres suivis n'ont rien publié récemment),
   la section affiche à la place une liste de membres à suivre, triée par proximité de profil.
   Le lien « Gérer » ouvre l'annuaire complet (`NattySocial.membres()`).
3. **La communauté** — les derniers plats publiés, **2 par membre au maximum** : sans ce
   plafond, le membre le plus assidu occupe tout le fil.
4. **Dans le mille** — meilleur score nutritionnel. Le score compare les macros du plat à la
   cible **par repas de celui qui l'a posté** (donc pas aux besoins du lecteur) : `100 −
   moyenne(|ratio−1|)`, un dépassement pesant 1,25× un manque. Un plat dont les ingrédients ne
   sont pas dans la table de `core.js` a des macros nulles → pas de score, écarté d'office.
5. **Profils comme le vôtre** — membres dont le besoin quotidien (kcal **et** protéines) est à
   ~15 % du sien. Vide si l'utilisateur n'a pas d'onboarding exploitable. 2 plats par membre.

Plus une recherche (nom de plat, membre, ingrédient) et une bottom sheet de détail
(photo, macros, ingrédients, j'aime, suivre, vues).

**Amis = abonnement à sens unique**, sans demande ni acceptation : l'app n'a aucun canal de
notification pour porter une file de demandes en attente, et le fil doit se remplir tout de
suite. Une amitié réciproque, c'est deux lignes dans `membre_amis`. Les 150 plats du fil
général ne contiennent pas forcément ceux des membres suivis : `charger()` va les chercher
explicitement (`user_id=in.(…)`, 60 par lot) et fusionne, sinon « Vos amis » resterait vide.

**Persistance** : `meal_likes`, `meal_vues`, `membre_amis`, `membre_prefs` et `meals.partage`
**existent en base depuis le 2026-08-03** (`natty_social.sql` exécuté par Pablo, vérifié :
RLS désactivée, contraintes d'unicité et `check (user_id <> ami_id)` actives).
`NattySocial.estSynchronise()` renvoie `true`. Le repli `localStorage` reste en place au cas
où une table disparaîtrait, mais n'est plus le chemin normal.

> ⚠️ **Piège PostgREST — `resolution=ignore-duplicates` ne suffit pas seul.** PostgREST résout
> le conflit sur la **clé primaire**, qui vaut ici un `id` uuid toujours neuf : la contrainte
> d'unicité `(meal_id, user_id)` repartait donc en **409** au lieu d'être ignorée, et le
> `.catch()` optimiste annulait le like/abonnement à l'écran. Il faut nommer la contrainte
> visée dans l'URL : `?on_conflict=meal_id,user_id` (et `?on_conflict=user_id,ami_id` pour
> `membre_amis`). Mesuré en base : sans lui **409**, avec lui **201** et toujours une seule
> ligne. `membre_prefs` y échappe, sa clé primaire *étant* `user_id`.

**Vie privée** — deux niveaux, tous deux optionnels côté base :
- **Global** : `membre_prefs.fil_public`, piloté par l'interrupteur « Mes plats dans le fil »
  des réglages de `profil.html` (via `NattySocial.lireMaPref()` / `ecrireMaPref()`). Un membre
  à `false` disparaît entièrement du fil des autres. **Volontairement sans repli
  localStorage** : un réglage de confidentialité qui n'agirait que sur l'appareil de son auteur
  serait un mensonge. Sans la table, l'interrupteur reste désactivé et l'explique.
- **Par plat** : colonne `meals.partage`, détectée seule par `social.js`
  (`or=(partage.is.null,partage.eq.true)`, avec repli sur une requête sans le filtre si la
  colonne est absente — une colonne inexistante ferait échouer toute la requête, cf. §7).
  **Rien dans l'app n'écrit encore cette colonne** : elle se règle à la main ou depuis l'admin.

⚠️ Tant que `membre_prefs` n'existe pas, **tous** les repas enregistrés sont visibles par les
autres membres.

### `api/claude.js`
Proxy vers l'API Claude pour les conseils nutritionnels.

### `api/save-conseils.js`
Sauvegarde les conseils générés dans `profil_conseils` Supabase.

### `api/conseils-hebdo.js`
Cron Vercel — déclenché 12 fois le lundi matin (toutes les 5 min de 8h à 8h55) pour couvrir tous les utilisateurs.

### `api/send-email.js`
Notifications email via Resend.

### `onboarding.html`
Questionnaire d'onboarding client — 7 étapes.

### `api/checkout.js`
Crée une session Stripe Checkout. Handler serverless classique (`export default async function handler`, pas edge).

- Parse manuel du body (fallback si `req.body` vide/string via lecture stream), lit `{priceId, userId, token}`.
- `POST https://api.stripe.com/v1/checkout/sessions` : `mode=subscription`, `line_items[0][price]=priceId`, `success_url=https://natty-suivi.vercel.app/?token=<token>&subscribed=1`, `cancel_url=.../offre.html?token=<token>&cancelled=1`, `metadata[user_id]` + `subscription_data[metadata][user_id]`.
- Retourne `{url: session.url}`, consommé par `offre.html`.
- ⚠️ **Pas de validation serveur de `priceId`** : le client peut envoyer n'importe quel `price_...` Stripe existant sur le compte (le front n'envoie que `PRICE_3`/`PRICE_4`, mais rien ne l'impose côté serveur). À corriger : allowlist des deux price IDs légitimes.
- `console.log` verbeux (body reçu, réponse Stripe) — à nettoyer avant prod si les logs Vercel sont partagés.

### `api/scan-plat.js` — ✅ supprimé (juillet 2026)
Existait comme pipeline photo de plat → macros en 2 étapes (LogMeal + Claude), jamais appelé par aucune page. **Supprimé** après découverte que `index.html` a déjà une feature complète et fonctionnelle pour ça : `analyserAvecIA()` (ligne ~2455) + `saveIA()` (ligne ~2668), branchée aux boutons caméra/galerie IA (`btnCamIA`/`btnGalIA`). Elle envoie directement la photo à **`/api/claude`** (un seul appel Claude vision, pas de LogMeal) avec un prompt qui identifie aliments + quantités + macros, affiche une liste d'ingrédients éditable avec recalcul live des macros (`recalcAIMacros`), puis sauvegarde (upload Cloudinary + `meal_ingredients`) via `saveIA()`. **"Analyse de plat par IA (photo → macros)" n'est donc PAS une feature manquante — elle est déjà livrée**, corrigé en §8 (ce document la listait à tort comme "à faire").

### `api/supabase.js` — ✅ supprimé (juillet 2026)
Existait comme proxy REST générique vers Supabase, jamais importé par aucun autre fichier `api/*.js` ni appelé par aucune page HTML (chaque fichier réimplémente son propre `fetch(SB_URL+'/rest/v1/...')` en dur). Supprimé — code mort.

### `api/webhook.js`
Webhook Stripe — **déjà implémenté**, pas un stub (corrigé : ce document le listait à tort comme "À CRÉER" en §8, alors qu'il existe et fonctionne). `export const config = { runtime: 'edge' }`.

Events gérés :
- `checkout.session.completed` : `session.metadata.user_id` → refetch `GET /v1/subscriptions/<id>` pour connaître le `priceId` → compare à `STRIPE_PRICE_3_REPAS`/`STRIPE_PRICE_4_REPAS` (env) pour déduire `formule` → `POST abonnements` (`user_id, stripe_customer_id, stripe_subscription_id, formule, statut:'actif', date_debut`).
- `invoice.paid` : `PATCH abonnements?stripe_subscription_id=eq.<id>` → `{statut:'actif'}`.
- `customer.subscription.deleted` : `PATCH abonnements?stripe_subscription_id=eq.<id>` → `{statut:'annule'}`.

> ✅ **Signature Stripe vérifiée** (corrigé juillet 2026) : `verifyStripeSignature()` recalcule le HMAC-SHA256 (`Web Crypto`, compatible edge runtime) sur `timestamp + '.' + rawBody` et le compare au header `stripe-signature`, avec tolérance 5 min contre le replay. **Fail-closed** : si `STRIPE_WEBHOOK_SECRET` n'est pas configuré en variable d'env Vercel, le handler rejette tout (500) — **variable requise avant déploiement**, sinon l'activation des abonnements Stripe s'arrête. Récupérer le "Signing secret" (`whsec_...`) dans Stripe Dashboard → Developers → Webhooks → l'endpoint concerné.
> `SUPABASE_KEY` a un fallback en dur sur la clé anon si la variable d'env est absente — écrire dans `abonnements` suppose que la RLS autorise l'anon en INSERT/UPDATE (sinon échec silencieux, visible uniquement en HTTP 500 côté Stripe).

### `api/suggestions-macros.js` et `api/analyse-nutrition.js` — ❌ créés puis supprimés (juillet 2026)
Créés dans cette session pour combler des 404 dans `progression.html` (voir §7), puis supprimés avec `progression.html` une fois celle-ci remplacée par `narration.html` dans l'usage réel (décision Pablo du 2026-07-26). N'ont jamais été appelés en conditions réelles.

### [narration] Fichiers du module parcours

#### `narration.html` — moteur principal (~2,4 Mo, ~121 beats, 10 chapitres)
Le livrable. Contient le contenu du parcours (`STORY[]`), le moteur d'affichage classique (beats) ET le **moteur cinématique « kinetic »** porté depuis `motion_lab.html`.

**Deux systèmes de rendu cohabitent** :
1. **Rendu beat classique** (`render(b,pair)`) — pour les flash cards et les mini-jeux interactifs. Élément `.beat` dans `#stage`.
2. **Moteur kinetic** (`#klayer`, tout préfixé `k_`) — pour les explications/transitions animées « façon vidéo ». C'est le système à privilégier pour tout ce qui est texte/annonce.

**Dispatch central** : `go()` lit le beat courant, calcule son mode via `univFor()`/`k_modeOf()`, puis :
- beat `chapter` → `k_chapterSeq()` (annonce kinetic) puis enchaîne ;
- changement de mode (jeu/cuisine/défi) → `k_modeSeq()` (annonce courte) ;
- beat `say` ou beat portant un champ `cine` → `k_dispatch()` → cinématique kinetic ;
- sinon → `k_renderBeat()` → rendu beat classique (flash cards, jeux).

**Moteur kinetic — fonctions clés** (toutes préfixées `k_`, scellées dans `#klayer`) :
- `k_playSeq(seqArr,onDone)` : joue une séquence de « plans » puis appelle `onDone` (souvent `nextBeat`).
- `k_step()` : affiche le plan courant ; **auto-avance** entre plans SAUF si le plan a un `btn` (alors il attend le clic). Séquence terminée → masque `#klayer` + `onDone`.
- `k_showPlan(p)` : construit un plan (illustration + contenu). Le **bouton d'action est placé dans une barre fixe en bas** (`#k_cta`), jamais dans le plan animé — il apparaît une fois la scène « posée » (settled) et ne disparaît pas.
- `k_buildContent(p)` / `k_buildIllu(p)` : texte animé (lignes/tokens) et illustration (emoji, SVG via `p.svg`, morph, photo).
- `k_sayToSeq(b)` : convertit un beat `say` en une **scène unique** centrée (emoji + titre + sous-titre + bouton) qui reste jusqu'au clic.
- `k_resolveCine(cine)` : exécute une séquence `cine` explicite ; garantit un bouton sur la dernière frame.
- `k_modeSeq(mode,b)` / `k_chapterSeq()` : annonces de mode/chapitre (scène unique de ~3 s : illustration SVG + titre).
- `k_clearPlan(el,outKind)` : applique l'animation de **sortie** au plan sortant puis le retire.
- Sons/vibrations : `k_sEnter`, `k_sSem`, `k_sFx` (dont l'effet « cut » = son de découpe), réutilisent l'audio existant de la narration.

**Bibliothèque SVG** : `K_SVG{}` = 9 illustrations 2D animées N&B (swipe/tinder, gauge, cut/couteau, balance, flame, macros-trio, plate, tier, paint) ; `K_GAME_SVG{}` mappe un type de jeu → l'illustration montrée pendant la transition de mode.

**Beats `cine`** : un beat peut porter un tableau `cine:[...]` décrivant une mini-vidéo plan par plan (entrée, contenu, effets de mots, illustration, `cta`). Utilisé pour les intros soignées (Bonjour, macros, cuisine/découpe, métabolisme/brûle).

**Bibliothèque « motion Apple »** (ajoutée juillet 2026) — entrées/sorties sobres, easing spring-like `cubic-bezier(.22,1,.36,1)`, pas de rebond/glitch :
- Entrées : `glide` (léger rise 14px), `focus` (flou 9px + zoom 1.06 → net, façon pull-focus — **non utilisé sur du texte**, voir plus bas), `parallax` (translation+scale discret 10px/0.97), `reveal` (wipe par `clip-path`, façon transition Keynote). S'ajoutent aux entrées existantes (`unblur`, `drift`, etc. — voir `[data-enter="X"]` dans le CSS pour la liste complète, 16 au total).
- Sorties : `settle` (fade + scale-down doux), `lift` (fade + légère remontée). S'ajoutent aux sorties `.plan.out-X` existantes.
- **`K_ENTERS`/`K_OUTS`/`k_pick()`** : pool + rotateur qui existaient déjà dans le code mais n'étaient **jamais appelés** (découverte de la session) — `k_sayToSeq()` forçait `enter:'unblur'` en dur pour tous les beats `say`, et la fin de séquence kinetic forçait `'out-up'`. Corrigé : les deux utilisent maintenant `k_pick(K_ENTERS)`/`k_pick(K_OUTS)`, donc **chaque beat `say` (~24 dans le parcours actuel) varie automatiquement** sa transition (rotation sans répétition consécutive) au lieu de toujours jouer la même.
- ⚠️ **Retrait du flou sur les textes** (juillet 2026, demande Pablo) : `K_ENTERS` ne contient plus aucun effet à base de `filter:blur()` — pool final `['glide','parallax','reveal','rise','pop']`. `K_OUTS` idem, `'shrink'` (flou) remplacé par `'drop'` → `['lift','settle','drop','slide','up']`. Les entrées `unblur`/`blur`/`drift`/`focus`/`through`/`recede`/`stretch` (floutées) **restent dans le CSS** (utilisables manuellement via `cine`/`enter:'X'` explicite, ex. jeux/défis) mais ne sont plus utilisées sur aucun texte : les 5 séquences `cine` à la main (Bonjour, macros, cuisine/découpe, métabolisme, + le nouveau beat balance ci-dessous) et `k_modeSeq`/`k_chapterSeq` ont tous été réécrits pour utiliser `glide`/`parallax`/`reveal` à la place. Seules les frames **illustration-only** (`svg:'cut'/'macros'/'flame'`, pas de `lines`) gardent `through`, puisque ce n'est pas du texte.
- `glitch`/`bounce`/`tunnel`/`squash`/`spin` restent aussi hors pool auto (trop ludiques pour du contenu explicatif) mais utilisables manuellement.

**Effets sémantiques par mot** (`tok.fx` dans un token `lines`/`content`) : au-delà des surlignages `hl`/`hlY`/`hlO`, il existe une bibliothèque d'effets bespoke liés au sens du mot, appliqués via `span.className=fx+'fx'` dans `k_buildContent()` — modèle : **`cut`** (`.cutfx`, le mot "découpe" se scinde en deux avec un trait de coupe + son de lame, `k_sFx('cut')`). Effets **déjà codés en CSS/JS mais quasi jamais utilisés avant juillet 2026** : `burn` (glow orangé + flammes montantes, utilisé 2× sur "brûle"/"calories"), `flow`, `beat`, `flex`, `freeze`, `sparkle`, `energy`, `grow`, **`balance`** (`.balancefx`, bascule comme une balance qui se stabilise, keyframe `k_balanceTilt` — nouvellement appliqué sur "valent pas" dans le beat ⚖️ "Mais toutes les sources ne se valent pas", voir §6). Seuls `burn/flow/beat/flex/freeze/sparkle/energy/grow` déclenchent aussi un son/particules via `k_sSem()` (liste en dur dans `k_buildContent` ligne ~2730) — `cut` et `balance` sont hors de cette liste (sons gérés séparément pour `cut` via `k_sFx`, `balance` est purement visuel pour l'instant). **Reste un boulevard de contenu** : la plupart de ces effets n'ont qu'1-2 usages ou aucun — à décliner sur d'autres mots-clés au fil des prochaines sessions, mais uniquement dans des beats convertis en `cine` (le texte doit passer par des tokens `lines`, pas par un simple champ `desc`/`sub` de flashcard).
- ⚠️ Un bloc CSS mort a été supprimé au passage : d'anciennes règles `.plan.out-up`/`-shrink`/etc. (keyframes `k_x*`) étaient entièrement masquées par un bloc plus récent définissant les mêmes sélecteurs (`k_o*`, plus loin dans le fichier) — la cascade CSS ne jouait jamais le premier bloc.

**Jeu de la jauge (canette/steak)** — `renderCan(el,b)` :
- Sujet **détouré** (PNG transparent `K_CUT`) posé sur un **panneau blanc** (`.paint-hero`), sans support ni ombre sous l'objet.
- Deux images superposées, **exactement même taille** : base en niveaux de gris (`.paint-base`, opacité réduite) + copie couleur (`.paint-fill`) révélée du bas vers le haut par un `clip-path:inset(X% 0 0 0)` → la jauge « épouse la forme » du sujet.
- Glisser vers le haut = estimer le % ; bouton « Valider mon estimation » actif dès `frac>0`.

**Défis photo (macros/étiquette/accord)** — `renderDefi(el,b)` (les 3 beats `type:'defi'` avec `steps:[{key,em,label,hint}]`) :
- `playAnnounce(b, then)` : écran d'annonce plein cadre (`#defiAnnounce`, z-index 45) avant chaque défi, bouton "Relever le défi".
- `step()` : affiche la cible (`s.label`/`s.hint`), capture photo via `<input type="file" capture="environment">`.
- **`k_verifyDefiPhoto(file, label, hint, cb)`** (ajouté juillet 2026) : convertit la photo en base64, POST `/api/claude` avec un prompt demandant si elle correspond à `label`/`hint`, réponse JSON attendue `{"correspond":bool,"raison":str}`. Overlay "Vérification…" pendant l'appel. Si `correspond:false` → ✕ rouge + raison + bouton "Reprendre la photo" (relance `cam.click()`). **Fail-open** : toute erreur (réseau, JSON invalide, pas de réponse) → `cb(true)`, la photo est acceptée — ne bloque jamais le défi. Non testé avec un vrai appel Claude (pas de backend en local) — à valider après déploiement.
- `renderDefiCreation()` (défi "crée ta recette") a aussi une étape photo mais **volontairement non vérifiée** : la photo y est optionnelle ("validable sans photo, la description suffit"), pas de consigne fixe à matcher (recette inventée par l'utilisateur).

#### `motion_lab.html`, `map.html`, `deploy-demo/` — ⚠️ n'existent pas dans ce repo
Ces trois éléments sont décrits dans les sections `[narration]` de ce document (moteur cinématique d'origine, carte de progression, dossier de déploiement iframe) mais **vérification faite (audit juillet 2026) : aucun des trois n'existe dans l'arborescence actuelle, ni sur `main`, ni dans tout l'historique git (`git log --all --diff-filter=A`), ni sur une autre branche.** Le moteur `k_` de `narration.html` est bien présent et fonctionnel (31 fonctions `k_*`, `K_SVG` avec 9 illustrations, confirmé par lecture directe) — donc le contenu qu'ils étaient censés fournir a déjà été porté dans `narration.html`. Mais les fichiers sources eux-mêmes sont absents : soit ils ont été produits dans une session locale jamais commit/push, soit cette doc était partiellement aspirationnelle.
**Si Pablo fournit ces fichiers** : ils se déploient exactement comme n'importe quel autre fichier du repo (commit → push GitHub → Vercel redéploie automatiquement, ~1 min) — aucune configuration spéciale n'est nécessaire pour `motion_lab.html`/`map.html`. Pour `deploy-demo/` (dossier avec son propre `vercel.json` et `frame-ancestors *`), vérifier d'abord s'il doit être un projet Vercel séparé ou un sous-dossier de celui-ci (à clarifier avec Pablo avant de créer une config qui pourrait entrer en conflit avec le `vercel.json` racine).

> ✅ **Conclusion (tranchée avec Pablo, juillet 2026) : aucun de ces 3 éléments n'est nécessaire pour continuer le travail sur `narration.html`.**
> - `motion_lab.html` n'était qu'un labo de prototypage — son contenu (le moteur `k_`) est déjà entièrement porté et fonctionnel dans `narration.html`. Ce ne serait utile que pour tester une nouvelle mécanique d'animation avant de la fusionner (règle §9 #25 "Prototyper puis fusionner"), pas une dépendance manquante.
> - `map.html` n'est pas un fichier perdu à récupérer, c'est une **feature jamais construite** (carte de progression, mise de côté). Si elle est voulue un jour, elle sera à construire from scratch, pas à restaurer.
> - `deploy-demo/` reste à créer le jour de l'intégration réelle au site (copie de `narration.html` + `vercel.json` iframe-friendly) — non bloquant tant que `narration.html` est testé en accès direct.
> **`narration.html` est donc autonome et suffisant en l'état pour toute suite de travail sur le parcours gamifié.**

---

## 4. Schéma Supabase

### Tables existantes et vérifiées

#### `meals`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | text | userId Wix hex-encodé |
| name | text | Nom du plat |
| photo_url | text | URL Cloudinary |
| meal_date | date | |
| created_at | timestamptz | |

#### `meal_ingredients`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| meal_id | uuid | FK → meals |
| name | text | |
| quantity_g | numeric | |

#### `nutrition_scores`
| Colonne | Type | Notes |
|---|---|---|
| user_id | text | |
| variety_score | numeric | 0-100 |
| quality_score | numeric | 0-100 |
| relevance_score | numeric | 0-100 |
| score_date | date | |
| calculated_at | timestamptz | |

#### `onboarding`
Colonnes **relevées en base** (`select=*`, juillet 2026) :

| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | text | |
| created_at | timestamptz | |
| maturite | text | |
| motivation | text | |
| objectif_type | text | ex. `prise_masse` |
| objectif_valeur | numeric | |
| objectif_semaines | integer | |
| axe_amelioration | text | |
| contexte_repas | text | |
| hydratation_litres | numeric | |
| regime | text | |
| allergies | text | |
| aliments_refuses | text | |
| aliments_plaisir | text | |
| age | integer | |
| sexe | text | |
| poids | numeric | |
| taille | numeric | |
| activite | text | |
| bmr | numeric | |
| tdee | numeric | |
| deficit | numeric | |
| completed | boolean | |
| score_motivation | integer | 1-10 |
| score_rigueur | integer | 1-10 |
| score_nutrition | integer | 1-10 |
| email / prenom / nom | text | |
| rgpd_accepte | boolean | |
| nb_repas_semaine | integer | **repas livrés par semaine** (abonnement), PAS repas par jour |

> ⚠️ **Correction (juillet 2026)** : les versions précédentes de ce document listaient aussi
> `freins`, `repas_sautes`, `nb_repas`, `temps_cuisine`, `proteines`, `glucides`, `lipides`,
> `calories` dans cette table. **Aucune de ces colonnes n'existe** — un `select` qui les
> demande renvoie `42703 column onboarding.X does not exist` et fait échouer toute la requête
> (piège rencontré en développant `assets/ajout.js`, voir §7).
> - Les **macros quotidiennes** ne sont pas stockées : elles se dérivent de `poids` et `tdee`
>   côté client (`calcMacros()` de `suivi.html` : prot = poids×2, lip = tdee×0,25/9,
>   gluc = tdee×0,5/4, cal = tdee). Tout écran qui affiche des objectifs doit refaire ce calcul.
> - Le **nombre de repas par jour** vit dans `questionnaire_alim.nb_repas`, et c'est un
>   **libellé texte**, pas un entier : `1_2`, `3`, `3_collations`, `grignotage`.

#### `profil_conseils`
| Colonne | Type | Notes |
|---|---|---|
| user_id | uuid | |
| conseil_prot | text | |
| conseil_gluc | text | |
| conseil_lip | text | |
| conseil_cal | text | |
| conseil_amelioration | text | |
| conseil_points_forts | text | |
| conseils_json | jsonb | |
| semaine | date | Lundi de la semaine |
| generated_at | timestamptz | |

> ✅ **Correction (juillet 2026)** : `liste_courses_json`, `recettes_json` et `conseils_json` existent bien dans `profil_conseils` (testé : `select=` sur chacune renvoie 200). Les versions précédentes de ce document affirmaient le contraire. Le vrai bug était ailleurs : `api/save-conseils.js` ignorait ces champs à l'écriture, donc tout ce qui y était envoyé était silencieusement perdu.

#### `plans_repas`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | text | |
| plat_id | uuid | FK → plats_menu |
| plat_nom | text | |
| semaine_livraison | date | Lundi |
| jour_livraison | text | |
| quantite_g | integer | |
| prot_g | numeric | |
| lip_g | numeric | |
| gluc_g | numeric | |
| cal_kcal | numeric | |
| statut | text | en_attente/valide/livre |
| valide_par | text | |
| valide_at | timestamptz | |
| notes | text | |
| created_at | timestamptz | |

#### `ingredients_base`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| nom | text | |
| nom_normalise | text | lowercase pour recherche fuzzy |
| categorie | text | |
| cal_per_100g | numeric | ← colonnes macros |
| prot_per_100g | numeric | |
| lip_per_100g | numeric | |
| gluc_per_100g | numeric | |
| fibres_per_100g | numeric | |
| duree_conservation_j | integer | |
| temperature_conservation | text | |
| allergenes | text[] | |
| fournisseurs | text[] | |
| prix_kg_moyen | numeric | |
| ean | text | |
| zone_stockage | text | |
| poids_colis_kg | numeric | |
| prix_achat_ht | numeric | |

> 18 produits Metro importés via `natty_ingredients_base.sql`

#### `stocks_mp`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| ingredient_nom | text | |
| quantite_kg | numeric | |
| date_peremption | date | |
| temperature_stockage | text | frais/ambiant/surgele |
| statut | text | disponible/epuise/perime |
| lot | text | |
| created_at | timestamptz | |

#### `recettes`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| nom | text | = nom du plat dans plats_menu |
| description | text | |
| nb_portions | integer | |
| temps_prep_min | integer | |
| temps_cuisson_min | integer | |
| prot_portion | numeric | |
| gluc_portion | numeric | |
| lip_portion | numeric | |
| calories_portion | numeric | |
| actif | boolean | |

#### `recettes_ingredients`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| recette_id | uuid | FK → recettes |
| ingredient_nom | text | |
| ingredient_id | uuid | FK → ingredients_base (optionnel) |
| quantite_g | numeric | |
| unite | text | |
| ordre | integer | |

#### `recettes_etapes`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| recette_id | uuid | FK → recettes |
| numero | integer | |
| description | text | |

#### `notes_nutritionniste`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | text | |
| note | text | |
| action_semaine | text | |
| updated_at | timestamptz | |

#### `abonnements`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | text | |
| stripe_customer_id | text | |
| stripe_subscription_id | text | |
| formule | text | 3_repas / 4_repas |
| statut | text | actif/inactif/pause/annule |
| date_debut | timestamptz | |
| date_fin | timestamptz | |

#### `plats_menu`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| nom | text | |
| description | text | |
| photo_url | text | |
| calories | integer | |
| proteines | numeric | |
| glucides | numeric | |
| lipides | numeric | |
| semaine | date | |
| actif | boolean | |
| categorie | text | proteines/legumes/equilibre/low_carb |

#### `commandes`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | text | |
| abonnement_id | uuid | |
| semaine | date | |
| plats_choisis | uuid[] | |
| statut | text | en_attente/confirmee/livree/annulee |
| skip | boolean | |

### RLS — état actuel
- `recettes`, `recettes_ingredients`, `recettes_etapes` : **RLS désactivé** (`DISABLE ROW LEVEL SECURITY`)
- `profil_conseils` : **RLS désactivé**
- Autres tables : policies permissives `USING (true)` — à sécuriser en production

---

## 5. Design & DA

### Dashboard client / Login / Index (style principal)
- **Fond** : `#f0f0f3` (gris perle)
- **Variables CSS** :
  - `--bg: #f0f0f3`
  - `--so: 6px 6px 16px rgba(174,174,192,0.42), -6px -6px 16px rgba(255,255,255,0.88)` (ombre sortante)
  - `--si: inset 3px 3px 8px rgba(174,174,192,0.35), inset -3px -3px 8px rgba(255,255,255,0.85)` (ombre rentrante)
  - `--sm: 4px 4px 10px rgba(174,174,192,0.38), -4px -4px 10px rgba(255,255,255,0.85)` (ombre moyenne)
  - `--text: #2d2d3a`, `--muted: #9a9aaa`, `--black: #1a1a2e`
  - `--green: #34c759`, `--orange: #ff6b35`, `--amber: #ff9500`
- **Typographie** : Inter (Google Fonts)
- **Border-radius** : 16-28px selon les éléments
- **Overlays** : `display:none` → `display:flex` (PAS classList.add('active') pour les overlays injectés dynamiquement)
- **Sheets (bottom sheets)** : `-webkit-overflow-scrolling: touch` pour le scroll mobile

### Admin (style neumorphique)
- Même variables CSS que le dashboard
- Typographie : DM Sans
- Onglets : highlight vert `#34c759` sur l'onglet actif

### [narration] DA du module parcours (mise à jour — N&B uniforme)
- **DA noir & blanc uniforme, neumorphisme sobre façon Apple, police Inter.** Fini les palettes colorées par univers.
- **Deux thèmes seulement** (via `applyUnivers()` → `body[data-u]`) :
  - **Clair** (`base`) : fond **blanc pur `#ffffff`**, encre `#0d0d0f` — pour l'apprentissage/lecture.
  - **Sombre** (`jeu`/`defi`) : fond `#0f1014`, encre blanche — pour les **mini-jeux, la cuisine ET les défis** (blanc sur noir). Accent or `#f0b429` réservé aux défis.
- **Aucune animation de fond** (pas d'emojis flottants) : fond uni. La fonction `floaters()` a été neutralisée.
- Surlignages de mots kinetic en **noir** (`hl`) par défaut ; jaune (`hlY`) réservé au sens fort/défis.
- Le jeu de la jauge utilise un **panneau blanc** dédié même en thème sombre, pour que le sujet détouré et la jauge restent lisibles.
- Colonne mobile **480 px** : `#klayer` est ancré à cette colonne centrée (et non à la fenêtre entière) pour un rendu correct sur ordinateur comme sur mobile.

---

## 6. Décisions prises

### Architecture & données
- **postMessage Wix → index.html non fonctionnel** : solution = URL params. Décision actée, ne pas revenir en arrière.
- **Token persistence** : localStorage (`natty_token`, `natty_user_id`) pour éviter la reconnexion à chaque reload.
- **Macros** : calculées depuis `poids` et `tdee` côté client. Les colonnes existent dans `onboarding` mais ne sont pas toujours renseignées.
- **Supabase direct depuis le front** : pas de proxy pour CRUD standard.
- **`sbFetch` doit être `async`** : elle utilise `await` — la déclarer sans `async` retourne une Promise non résolue → toutes les données semblent vides.
- **Overlays injectés avant `</body>`** : le fichier `index.html` uploadé par Pablo est tronqué (pas de balises fermantes). Toujours appender les overlays + `</body></html>` à la fin du fichier source.
- **`lockScroll` = overflow:hidden uniquement** : `position:fixed` sur body casse le scroll mobile iOS/Android. Décision actée.
- **Overlays : style.display flex/none** (PAS classList.add/remove('active')) pour les overlays injectés dynamiquement — classList ne fonctionnait pas car pas de règle CSS `.active`.

### Conseils hebdomadaires
- **Colonnes `*_json`** : `liste_courses_json`, `recettes_json` et `conseils_json` existent. Le piège réel n'est pas la lecture mais l'écriture — voir la règle 9 et §7.
- **Guard localStorage** (pas sessionStorage) : `sessionStorage` se vide à chaque reload → toujours utiliser `localStorage` pour le guard "conseils frais cette semaine".
- **`ouvrirListeCourses` et `ouvrirRecettes`** n'appellent PLUS `conseilsGenererEtSauvegarder` — affichent un message simple si pas de données en cache.
- **Popup conseils ne lockScroll pas** : le popup est une bottom sheet légère, lockScroll gelait toute la page.

### Admin
- **Calcul stocks par ingrédient** : `plans_repas → recettes (match par nom) → recettes_ingredients → besoins en kg`. Ne PAS comparer `plat_nom` avec `ingredient_nom` directement (jamais identiques).
- **Macros auto dans le formulaire plat** : readonly, calculées depuis `ingredients_base` (colonnes `*_per_100g`), fond vert quand calculées auto.
- **Inline onclick interdit** : `onclick="fn(''+var+'')"`  cause `Unexpected string`. Toujours utiliser `data-*` + `addEventListener`.
- **`window._factureProduitsCache`** : les données facture sont stockées dans un array global avec `data-idx` plutôt qu'en JSON dans `data-produit` (causait `Unexpected string`).

### Login
- **login.html** : page standalone pour accès direct sans Wix. Encode user_id en hex → même format que le token Wix.
- **Google OAuth** : nécessite configuration dans Supabase (Site URL + Redirect URLs) ET dans Google Console (Authorized redirect URIs = `https://hrsvcelmwdlcswwagxfa.supabase.co/auth/v1/callback`).

---


### [narration] Décisions du module parcours
- **Un seul moteur pour les explications** : tout ce qui est texte/annonce/transition passe par le moteur kinetic (`#klayer`), pas par le rendu beat classique — évite les conflits de double rendu qui causaient des chevauchements.
- **DA N&B uniforme** : seuls les jeux/cuisine/défis passent en thème sombre ; le reste est blanc pur. Décision actée (voir §5).
- **Bouton d'action hors du plan animé** : placé dans une barre fixe en bas (`#k_cta`). Raison : quand il était dans le plan, l'animation de sortie l'emportait et il « disparaissait » avant le clic.
- **Auto-avance entre frames, pause sur la frame à bouton** : les frames intermédiaires d'une cinématique s'enchaînent seules ; seule la frame qui porte un bouton attend le clic — et **son texte/illustration reste figé net jusqu'au clic** (voir bug « settled » ci-dessous).
- **Séquence d'une scène** : entrée → **figée au point net (settled)** → apparition du bouton → au clic, sortie animée → scène suivante. Depuis juillet 2026, **aucun texte n'utilise plus d'entrée/sortie à base de flou** (voir bibliothèque « motion Apple » en §3) — demande explicite de Pablo, jugé pas assez "clean". Le flou reste disponible en CSS pour un usage manuel ponctuel (illustrations SVG uniquement, ex. `through` sur `svg:'cut'`), jamais sur du texte.
- **Transitions de mode = une seule scène de ~3 s** (illustration SVG liée au jeu + titre animé), pas d'enchaînement multi-plans.
- **Images détourées via `rembg`** pour le jeu de la jauge, posées sur panneau blanc ; jauge par `clip-path` sur une copie couleur superposée pixel-perfect à la base grise.
- **Ordre du parcours = décidé au fil de l'eau par Pablo**, pas figé par la structure initiale : ex. les 2 beats "Tier list" (protéines/glucides) ont été déplacés juste après le premier mini-jeu de tri (`gameTri`), sur sa demande, pour renforcer l'idée "toutes les sources ne se valent pas" tout de suite après le premier jeu de classification. Le thème (`univFor`) et le mode (`k_modeOf`) sont dérivés du `type` du beat, pas de sa position dans `STORY[]` — réordonner des beats de même famille (ex. plusieurs `gameXxx`) est donc sûr sans casser le thème.
- **Validation systématique** : extraire le `<script>` et lancer `node --check` avant toute livraison (le fichier est trop gros pour être relu à l'œil).

## 7. Pièges & bugs récurrents

### `sbFetch` non async
**Problème** : `function sbFetch(path){var r=await fetch...}` sans `async` → retourne une Promise non résolue → `result = []` partout.
**Solution** : `async function sbFetch(path){...}`. Vérifier avec `node --check` avant livraison.

### Double async
**Problème** : chaque session qui corrige sbFetch ajoute `async` même s'il y en a déjà un → `async async function sbFetch` → SyntaxError.
**Solution** : `re.sub(r'async\s+async\s+function', 'async function', content)` avant livraison.

### ✅ « Colonnes inexistantes dans profil_conseils » — c'était faux (corrigé juillet 2026)
Ce document a longtemps affirmé que `liste_courses_json` et `recettes_json` n'existaient pas et faisaient échouer les SELECT en 400. **Vérification faite en base : les trois colonnes `*_json` existent** (`select=` sur chacune renvoie 200).

**Le vrai problème était à l'écriture** : `api/save-conseils.js` déstructurait une liste figée de champs et ignorait tout le reste. Les recettes et la liste de courses générées par `suivi.html` étaient donc silencieusement perdues, et `conseils_json` restait `null` — ce qui rendait inopérant le cache hebdo pourtant déjà présent en lecture dans `assets/reco.js`.

**Corrigé** : `save-conseils.js` construit maintenant sa ligne à partir des seuls champs transmis. Effet de bord bénéfique — un appel partiel n'écrase plus le reste de la ligne avec des `null` (l'upsert `merge-duplicates` le faisait potentiellement, ce qui pouvait effacer les conseils juste écrits).

### `conseils_json` est une colonne **texte**, pas jsonb
PostgREST la renvoie en `string`. Toujours `JSON.stringify` à l'écriture, et reparser à la lecture — `reco.js:lireCache()` tolère les deux cas.

### Overlays manquants (fichier tronqué)
**Problème** : le fichier uploadé par Pablo n'a pas de `</body>` ni `</html>` → tous les overlays injectés précédemment disparaissent.
**Solution** : toujours travailler depuis le fichier source uploadé, vérifier `'</body>' in content`, appender les overlays + balises fermantes si absents.

### lockScroll bloque le scroll mobile
**Problème** : `position:fixed` sur body + `top: -scrollY` → page gelée sur iOS/Android.
**Solution** : `body.style.overflow = 'hidden'` uniquement, sans position:fixed.

### touch-action:none bloque les clics
**Problème** : `touch-action: none` sur les overlays interceptait tous les events touch y compris les clics sur les boutons.
**Solution** : supprimer `touch-action: none` sur le fond des overlays.

### classList.add('active') ne fonctionne pas sur overlays injectés
**Problème** : les overlays injectés dynamiquement n'ont pas de règle CSS `.active` → classList.add ne les rend pas visibles.
**Solution** : `el.style.display = 'flex'` / `el.style.display = 'none'` directement.

### forEach addEventListener avec éléments null
**Problème** : `['ovProchainRepas','ovListeCourses','ovRecettes'].forEach(id => document.getElementById(id).addEventListener(...))` → TypeError si l'élément n'existe pas encore.
**Solution** : `var el = document.getElementById(id); if (el) el.addEventListener(...)`.

### Inline onclick avec quotes
**Problème** : `onclick="fn(''+var+'')"` dans des strings JS → `Unexpected string` (quotes non échappées).
**Solution** : utiliser `data-*` + `addEventListener` systématiquement.

### masterPage.js — $w('#html3').onMessage sur toutes les pages
**Problème** : `onMessage` n'existe que sur les pages avec un élément `#html3`. Sur les autres pages → `TypeError: $w(...).onMessage is not a function` → tout le `$w.onReady` crashe → pas de token → pas de redirection.
**Solution** : `const hasHtml3 = typeof $w('#html3').onMessage === 'function'` avant d'appeler.

### Cache Vercel/navigateur
**Problème** : ancienne version servie malgré un nouveau déploiement.
**Solution** :
1. `vercel.json` avec headers `Cache-Control: no-cache` sur les `.html`
2. `masterPage.js` : `?v=Date.now()` sur toutes les URLs
3. En dernier recours : vider le cache navigateur (Cmd+Shift+Suppr sur Mac/Chrome)

### sessionStorage vs localStorage pour le guard conseils
**Problème** : `sessionStorage` se vide à chaque rechargement → popup s'affiche à chaque reload même si conseils frais.
**Solution** : utiliser `localStorage.setItem('natty_conseils_semaine_' + USER_ID, lundi)` — persiste entre rechargements jusqu'à la semaine suivante.

### postMessage Wix
**Problème** : `$w('#html3').onMessage is not a function` sur iFrames externes.
**Solution** : passer TOUTES les données en URL params. Ne plus jamais utiliser postMessage pour `#html3`.

### Supabase RLS 401
**Problème** : INSERT retourne `401 Unauthorized`.
**Solution** : `ALTER TABLE table DISABLE ROW LEVEL SECURITY` pour les tables admin/back-office.

### Supabase SQL Editor — syntaxe
**Problème** : erreur `42601` avec commentaires `--` dans les requêtes.
**Solution** : exécuter chaque requête séparément, sans commentaires.

### [narration] Fichier vidé / tronqué par script
**Problème** : un script Python qui plante peut vider ou tronquer `narration.html` ; les uploads de Pablo sont aussi souvent tronqués.
**Solution** : backup avant toute passe de script ; vérifier la présence des balises fermantes ; `node --check` après chaque édition.

### [narration] Texte/illustration qui disparaît avant le clic (bug « settled »)
**Problème** : une classe `settled` (ou une animation de « respiration ») ajoutée en fin d'entrée **écrasait l'état final** de l'animation d'entrée (`forwards`), faisant revenir l'opacité ou le flou de départ → le texte/illustration disparaissait ou restait flou pile quand le bouton apparaissait.
**Solution** : `#klayer .plan.settled{opacity:1!important;filter:none!important;letter-spacing:normal!important;transform:none!important}` et **ne pas** couper l'animation d'entrée (`animation:none` réintroduit le bug). La scène doit rester **figée nette** jusqu'au clic.

### [narration] Animations de sortie absentes → plans qui se chevauchent
**Problème** : les classes `.out-*` n'avaient jamais été portées → le plan précédent restait affiché sous le nouveau (empilement, chevauchement).
**Solution** : définir les keyframes de sortie (`k_xUp`, `k_xShrink`, `k_xThrough`, …, avec flou), les sceller sous `#klayer .plan.out-*`, et retirer le plan après ~650 ms.

### [narration] Bouton kinetic invisible / transparent
**Problème** : doublons de règles `.btn` + une animation d'entrée qui laissait `opacity:0` si interrompue.
**Solution** : bouton dans la barre fixe `#k_cta`, `opacity:1`, couleur pilotée par le thème (`color:var(--bg);background:var(--ink)` → lisible en clair comme en sombre).

### [narration] Surlignage partiel / mots collés
**Problème** : `hl/hlY/hlO` en `inline` ne couvraient qu'une partie du mot ; letter-spacing très négatif collait les mots/lignes.
**Solution** : surlignages en `inline-block` (fond pleine hauteur), letter-spacing et line-height relâchés, `unblur` finit en `letter-spacing:normal`.

### [narration] Jeu de la jauge : sujet mal calé / invisible
**Problème** : sujet en niveaux de gris quasi invisible sur fond sombre, et copie couleur débordant du panneau (deux images mal alignées).
**Solution** : panneau **blanc** dédié ; base et copie **strictement même taille** (`height` fixe, `width:auto`) ; révélation par `clip-path` sur la copie ; plus de conteneur de découpe séparé.

### [narration] Décalage vertical 84px après un beat classique (flashcard) — ✅ corrigé
**Problème** : au clic sur le bouton "Suivant" (`.cta`) d'un beat classique (flashcard, quiz...), le focus natif du bouton cliqué déclenchait un scroll interne (`document.body.scrollTop` passait à 84) — `overflow:hidden` sur `html,body` masque la scrollbar mais n'empêche pas ce scroll programmatique. Conséquence : le header (flèche retour, barre de progression) se retrouvait caché au-dessus de l'écran, et `.map-screen` (censé être entièrement hors-écran via `transform:translateY(100%)` quand fermé) laissait dépasser ~84px de son en-tête "Toutes les épreuves ✕" en bas de l'écran, sur tous les beats classiques suivants.
**Solution** : `document.body.scrollTop=0` au tout début de `go()` (dispatch central de chaque transition de beat, classique et kinetic) — neutralise le scroll parasite avant chaque rendu.
**Détection** : repéré en testant l'app directement dans un navigateur (pas visible à la simple lecture du code — nécessite d'observer `document.body.scrollTop` en conditions réelles après un clic).

### [narration] Retour/carte inaccessibles pendant les scènes kinetic — ✅ corrigé
**Problème** : `#klayer` (z-index 9999, plein écran) recouvrait `.top` (z-index 30, contient les boutons retour ← et carte 🗺️) sur **toute scène kinetic** — la majorité du parcours. Les clics sur cette zone étaient interceptés par `#klayer .k-dots` (points de progression, plein largeur) ou `.plan` (le contenu de la scène), jamais transmis aux vrais boutons. Confirmé en testant dans le navigateur (`document.elementFromPoint` sur les coordonnées du bouton retournait `k_dotsEl`/`.plan`, pas le bouton).
**Solution** : `.top` passe à `z-index:10000` (au-dessus de `#klayer`). `#klayer .k-dots` reçoit aussi `pointer-events:none` (purement décoratif, aucun handler dessus).

### [narration] Carte invisible quand ouverte pendant une scène kinetic — ✅ corrigé
**Problème** : `openMap()` fonctionnait (classe `.on` ajoutée, `mapScreen.classList.contains('on')` devenait `true`) mais `.map-screen` (z-index 50) restait **visuellement cachée derrière `#klayer`** (z-index 9999) si une scène kinetic était active au moment du clic sur 🗺️.
**Solution** : `.map-screen` passe à `z-index:10001` (au-dessus de `.top` et de `#klayer`).

### [narration] Saut vers un mini-jeu/défi depuis la carte : ancienne scène kinetic bloquée à l'écran — ✅ corrigé (le plus grave des 3)
**Problème** : le clic sur un nœud de la carte (`.mdot[data-goto]`) appelait `render(b,pair)` **directement**, sans jamais masquer `#klayer`. Si on avait ouvert la carte pendant une scène kinetic, celle-ci restait `.on` (affichée, z-index 9999) et cachait **entièrement** le beat cible fraîchement rendu en dessous — y compris les défis/mini-jeux, rendant la fonction "sauter à n'importe quelle épreuve" de la carte essentiellement inutilisable dans ce cas. Confirmé en sautant vers un beat `defi` : `idx` changeait bien, le contenu se rendait correctement dans le DOM, mais rien n'était visible à l'écran.
**Solution** : le handler de clic sur les nœuds de la carte réinitialise `#klayer` (retire `.on`, vide `k_stage`/`k_cta`, annule `k_timer`) avant de fixer `idx=target` et d'appeler **`go()`** (au lieu de `render()` direct) — `go()` gère correctement le dispatch classique/kinetic et le changement de thème (`applyUnivers`) quelle que soit la provenance du saut.

### [narration] Jeu "Tier list" : les items ne se plaçaient pas de manière fiable — ✅ corrigé
**Problème confirmé par Pablo** (une observation précédente notée "non confirmée, probable artefact de test" dans cette même section était en fait le vrai bug) : `bindDrag()` écoutait `pointermove`/`pointerup` directement sur l'item glissé (`it`), en comptant sur `it.setPointerCapture(ev.pointerId)` pour continuer à recevoir ces événements même quand le doigt quitte la zone de l'item. Si la capture échoue ou se comporte différemment selon le navigateur/appareil, `pointerup` ne se déclenche jamais sur `it` : le ghost (clone flottant qui suit le doigt) reste bloqué à l'écran et l'objet n'est jamais déposé dans un tier.
**Solution** : les listeners `pointermove`/`pointerup`/`pointercancel` sont attachés à `document` (filtrés par `pointerId`) dès le `pointerdown`, puis retirés proprement à la fin du geste — ne dépend plus de `setPointerCapture`. Testé avec de vrais `PointerEvent` simulés (down → move ×2 → up) : les 6 aliments se placent correctement, aucun ghost résiduel, écran de correction 6/6 fonctionnel.
**Piège méthodologique découvert en creusant** : `mcp__Claude_Browser__navigate` sans `force:true` peut ne pas recharger réellement la page si seule la query string change — l'état JS (y compris des closures comme `placed` dans `renderTier`) peut alors persister d'un "faux rechargement" à l'autre, produisant des résultats de test trompeurs. Toujours passer `force:true` pour un état frais garanti lors de tests répétés sur `narration.html`.

### Navigation `accueil.html` → `suivi.html` au lieu d'`index.html` — ✅ corrigé (impact réel incertain)
**Problème** : `accueil.html` redirigeait vers l'ancienne version du dashboard (`suivi.html`, avec son propre login Supabase Auth embarqué) au lieu d'`index.html`.
**Solution appliquée** : les 2 occurrences dans `naviguer()` remplacées par `index.html`.
**Nuance découverte après coup** : Pablo confirme que `accueil.html` **n'est pas la vraie page d'accueil de l'app** (celle-ci vit sur Wix, hors repo) — donc ce bug avait potentiellement un impact réel très faible ou nul en prod. Le fix reste appliqué (inoffensif, cohérent avec le reste de l'app), mais ne pas re-prioriser de travail sur `accueil.html` sans clarifier d'abord son usage réel avec Pablo.

### `api/progression.js` — doublon HTML déployé comme fonction serverless — ✅ résolu (fichier supprimé)
**Problème** : `api/progression.js` était un copier-coller intégral de `progression.html` (contenu identique, hash MD5 identique) avec l'extension `.js`. Si Vercel tentait de le construire comme fonction serverless, le fichier commençait par `<!DOCTYPE html>` et non par `export default`/`module.exports` → échec probable du build/exécution de cette route.
**Solution appliquée** : fichier supprimé. `progression.html` lui-même a ensuite été supprimé aussi (voir ci-dessous), donc ce problème est définitivement clos.

### Endpoints manquants appelés par `progression.html` — ✅ résolu (page et endpoints supprimés)
**Problème** : `chargerSuggestions()` et `chargerAnalyse()` appelaient `POST /api/suggestions-macros` et `POST /api/analyse-nutrition`, qui n'existaient nulle part dans `api/`. Échec 404 systématique, masqué silencieusement par des fallbacks statiques.
**Solution initiale** (devenue obsolète) : les deux endpoints avaient été créés sur le pattern de `api/claude.js`. **Solution finale** : `progression.html` a été remplacée par `narration.html` dans l'usage réel (décision Pablo, 2026-07-26) — la page et les deux endpoints ont été supprimés plutôt que maintenus.

### Webhook Stripe sans vérification de signature
**Problème** : `api/webhook.js` traite `await req.json()` sans jamais vérifier le header `stripe-signature` ni utiliser `STRIPE_WEBHOOK_SECRET`. N'importe qui connaissant l'URL peut POSTer un faux event `checkout.session.completed` avec un `user_id` arbitraire et activer un abonnement gratuit.
**Solution** : implémenter `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` et rejeter (400) toute requête dont la signature ne correspond pas. **Priorité sécurité avant toute mise en prod réelle** (voir aussi §8).

### Colonnes fantômes de `onboarding` (`42703`)
**Problème** : demander `nb_repas`, `proteines`, `glucides`, `lipides`, `calories`, `freins`,
`repas_sautes` ou `temps_cuisine` dans un `select` sur `onboarding` renvoie
`42703 column onboarding.X does not exist`. PostgREST rejette **toute la requête** : on ne perd
pas juste la colonne, on perd la ligne entière — donc les objectifs retombent silencieusement
sur les valeurs par défaut. Rencontré en écrivant `assets/ajout.js` (les anneaux affichaient
2000 kcal/jour au lieu du vrai TDEE de 3494).
**Solution** : ne demander à `onboarding` que `poids`/`tdee` et refaire le calcul des macros
côté client (`calcMacros()`), et lire le nombre de repas par jour dans
`questionnaire_alim.nb_repas` — qui est un **libellé** (`1_2`, `3`, `3_collations`,
`grignotage`), pas un entier : `parseInt("1_2")` vaut 1, d'où un « 1 repas / jour » faux.
Tableau des colonnes réelles en §4.

### Realtime WebSocket manuel (protocole obsolète ?)
**Problème** : `chat.html`, `challenges.html` et `suivi.html` ouvrent chacun un `WebSocket` manuel vers `wss://.../realtime/v1/websocket` avec un `phx_join` minimal (`{topic:'realtime:public:<table>', payload:{}}`), sans `config.postgres_changes` — c'est le protocole Supabase Realtime **pré-`postgres_changes`**, potentiellement incompatible avec une instance Supabase récente (qui exige ce champ de config pour router les événements).
**Solution** : à tester en conditions réelles (envoyer un message/défi et vérifier la réception live) ; si cassé, migrer vers le client `supabase-js` (`.channel().on('postgres_changes', ...)`) plutôt que le protocole WebSocket brut.

### Icône PWA cassée (`/icon-192.png` inexistant)
**Problème** : `manifest.json`, `suivi.html` et `onboarding.html` référencent `/icon-192.png`, fichier absent de la racine (seuls `icon-512.png` et les `natty-icon-*.png` existent).
**Solution** : soit ajouter un `icon-192.png` à la racine, soit faire pointer ces références vers `/natty-icon-192.png` (qui existe déjà).

---

## 8. État d'avancement

### ✅ Fait (sessions suivi client / admin / conseils — sessions 10-11)

**Page suivi client (`index.html`)**
- Score nutritionnel ring SVG animé
- Macros du jour avec barres de progression
- Historique repas avec photos et scores
- Popup ajout repas (photo + ingrédients + Cloudinary)
- Conseils hebdomadaires IA (génération + sauvegarde + affichage)
- Popup "Générer mes conseils" avec guard localStorage semaine
- Overlay profil complet (score, macros, infos, conseils, courses, recettes)
- Overlay commande repas (3 étapes : date/créneau → menu → confirmation)
- Overlay liste de courses et recettes
- Token persisté dans localStorage
- Page login.html standalone (email/password/Google OAuth)
- CTA "Commencer le suivi" pour utilisateurs non connectés
- Scroll mobile fonctionnel (overflow:hidden)
- Tous les overlays présents dans le HTML

**Admin (`admin.html`)**
- Authentification 3 rôles (Admin/Chef/Logistique)
- Onglets : Clients, Repas à programmer, Menu, Commandes, Chef, Stocks, Équipe
- Saisie plats avec ingrédients et macros auto depuis `ingredients_base`
- Calcul stocks par ingrédient réel (via recettes)
- Import facture Metro avec `window._factureProduitsCache`
- Tous les inline onclick remplacés par data-* + addEventListener
- Syntax JS validée node --check

**Infrastructure**
- `vercel.json` fusionné : crons + headers no-cache
- `masterPage.js` : Vercel URLs + cache-buster + guard hasHtml3
- 18 produits Metro dans `ingredients_base` et `stocks_mp`
- Tables `recettes`, `recettes_ingredients`, `recettes_etapes` (RLS désactivé)
- `profil_conseils` (RLS désactivé)

### ✅ Corrections de statut (audit juillet 2026)
Ce document listait par erreur les éléments suivants comme "à faire" alors qu'ils sont **déjà implémentés** dans le repo actuel :
- `api/webhook.js` — **existe et fonctionne** (checkout.session.completed / invoice.paid / subscription.deleted → table `abonnements`), mais sans vérification de signature Stripe (voir §7, priorité sécurité).
- `offre.html` — **complet et fonctionnel**, intégration Stripe Checkout déjà branchée sur `api/checkout.js`.
- Stripe Checkout integration — **fait** (`api/checkout.js` + `offre.html`).

### 🔄 À faire

**Bugs de navigation & code mort découverts (audit juillet 2026)**
- ✅ `accueil.html` redirigeait vers `suivi.html` (legacy) au lieu d'`index.html` — corrigé, mais impact réel incertain : `accueil.html` n'est pas la vraie page d'accueil (celle-ci est sur Wix) — voir §3/§7.
- ✅ `api/progression.js` (doublon HTML cassé) — supprimé.
- ✅ `progression.html` (page orpheline, jamais reliée) et ses endpoints `/api/suggestions-macros`/`/api/analyse-nutrition` — supprimés, remplacés par `narration.html` dans l'usage réel (voir ci-dessous et §3).
- ✅ `api/scan-plat.js` — supprimé, doublon d'une feature déjà livrée (`analyserAvecIA()`/`saveIA()` dans `index.html`, voir §3).
- ✅ `api/supabase.js` (proxy générique Supabase, orphelin) — supprimé.
- `manifest.json`/`suivi.html`/`onboarding.html` référencent `/icon-192.png` inexistant — voir §7. **Pas encore corrigé.**
- Fichier `vercel` (sans extension, racine) — artefact sans effet à nettoyer, confirmation Pablo requise. **Pas encore fait.**

**Abonnements & paiements**
- ✅ `api/webhook.js` sécurisé (vérification de signature Stripe, voir §3/§7). **Nécessite d'ajouter `STRIPE_WEBHOOK_SECRET` dans Vercel avant push**, sinon le webhook rejette tout en fail-closed.

**Ajout de plat (bouton +)**
- ✅ Parcours complet livré dans `assets/ajout.js` (voir §3) : caméra directe, analyse IA,
  anneaux de macros restantes **par repas**, enrichissement (resservir / ingrédients / autre
  repas / dessert) et carrousel de suggestions. Branché sur les 5 écrans porteurs de la nav.
- 🔄 À valider sur téléphone réel : ouverture de la caméra depuis la WebView Capacitor
  (le `capture="environment"` n'a pu être testé qu'en navigateur desktop).
- 🔄 Le suivi ne stocke toujours pas les macros par ingrédient : un aliment absent de la table
  de `core.js` compte pour 0. C'est la limite héritée du modèle `meal_ingredients`, pas de ce
  parcours — les suggestions non reconnues sont écartées pour ne pas l'aggraver.

**Garde-manger & génération de recettes**
- ✅ Panneau « Mon garde-manger » dans `repas.html` : scan des courses, du ticket de caisse ou
  d'une photo importée, plus saisie libre ; bouton « Générer mes repas avec ces ingrédients ».
  Les recettes affichent ce qu'il reste à acheter. Voir `assets/garde-manger.js` en §3.
- 🔄 **À faire côté Supabase** : créer la table `garde_manger` (SQL en §3) pour que la liste
  suive l'utilisateur d'un appareil à l'autre. Sans elle, tout marche mais en local.
- 🔄 Le garde-manger ne se décrémente pas quand une recette est suivie ou un repas enregistré :
  l'utilisateur retire les ingrédients à la main.

**Fil social**
- ✅ `social.html` + `assets/social.js` livrés (voir §3) : tendances, amis, communauté,
  meilleurs scores nutritionnels, profils aux besoins proches, recherche, détail en bottom
  sheet. L'onglet « Coaching » de la nav a laissé sa place à « Social » ; `coaching.html`
  reste atteignable depuis `menu.html`.
- ✅ Abonnements entre membres (`membre_amis`) : section « Vos amis », annuaire « Gérer »,
  bouton Suivre dans les listes et dans le détail d'un plat, suggestions par proximité de
  profil quand on ne suit encore personne.
- ✅ Réglage de confidentialité dans `profil.html` : interrupteur « Mes plats dans le fil »
  (`membre_prefs.fil_public`). Désactivé et explicite tant que la table n'existe pas.
- ✅ **`natty_social.sql` exécuté le 2026-08-03** : `meal_likes`, `meal_vues`, `membre_amis`,
  `membre_prefs` et `meals.partage` sont en base. Vérifié bout en bout — écriture, doublon,
  suppression, contrainte anti-auto-abonnement, et surtout : un membre passé en
  `fil_public=false` sort bien du fil des autres (57 → 42 plats sur les données réelles) et
  de l'annuaire.
- ✅ Correctif `?on_conflict=…` sur les trois POST concernés (voir l'encadré PostgREST en §3) —
  sans lui, aimer ou suivre depuis un second appareil repartait en 409 et l'interface annulait
  le geste.
- 🔄 `meals.partage` (masquer UN plat) n'est écrit par aucun écran — réglage manuel/admin
  pour l'instant.
- 🔄 Les scores plafonnent bas (~57/100 sur les données actuelles) parce que beaucoup
  d'ingrédients manquent à la table de `core.js` et que `nb_repas='1_2'` gonfle la cible par
  repas. Le classement reste juste (même biais pour tous), pas les valeurs absolues.

**Notifications**
- ✅ **Rappel quotidien livré** — `assets/notifs.js` + interrupteur dans `profil.html`
  (voir §3). `@capacitor/local-notifications` installé, `npx cap sync ios` fait.
- ✅ Vérifié sur simulateur iPhone 17 Pro (iOS 26.3) : demande d'autorisation, planification,
  et **notification réellement délivrée** avec le bon texte.
- 🔄 **Non vérifié** : le tap sur la notification → `narration.html`. Le code est en place
  (`localNotificationActionPerformed` + liste blanche de routes), mais la cellule du centre de
  notifications du simulateur n'a pas réagi aux taps synthétiques. À confirmer sur un téléphone.
- 🔄 **Android jamais compilé** (comme le reste du projet) : le canal, l'icône de statut et
  la permission `POST_NOTIFICATIONS` n'ont pas pu être testés.
- 🔄 **Push serveur — non commencé.** Les deux autres besoins ne peuvent PAS être locaux :
  « il te reste X g de macros » exige un calcul au moment de l'envoi, « un ami a ajouté un
  plat » est déclenché depuis un autre appareil. Exige une clé APNs (Team `SAZQ9AFAMZ`), FCM
  pour Android, la capability Push Notifications, une table de tokens d'appareil, un trigger
  Supabase sur `meals` et un cron. **Ne rien tester sans la clé APNs.**

**Améliorations index.html**
- Connecter l'action de la semaine du nutritionniste → affichage dans l'app — **toujours à faire**.
- ~~Analyse de plat par IA (photo → macros)~~ — **déjà livré** (`analyserAvecIA()`/`saveIA()`), ce n'était pas un backend à créer mais une feature existante mal documentée. Corrigé en §3.

**Admin**
- Calendrier commandes (semaineOffset reset à 0 bug)
- Vue client premium/standard (badge logic à corriger)

**Sécurité**
- ✅ Signature Stripe vérifiée dans `api/webhook.js` (voir §3/§7) — reste à ajouter `STRIPE_WEBHOOK_SECRET` sur Vercel avant déploiement.
- **[PRIORITÉ SÉCURITÉ] Réactiver les RLS Supabase** (actuellement désactivées sur `recettes*` et `profil_conseils`, et policies `USING(true)` ailleurs) : avec la clé anon publique, ces tables sont lisibles/modifiables par n'importe qui. À traiter avant toute distribution large. Écrire les policies une par une, tester après chaque.
- Remplacer mots de passe hardcodés par auth Supabase
- Valider côté serveur que `priceId` dans `api/checkout.js` fait bien partie de `PRICE_3`/`PRICE_4` (actuellement non vérifié).

### ✅ Fait (sessions précédentes)
- Chat temps réel Supabase Realtime
- Admin multi-nutritionniste
- Notifications email Resend
- Onboarding 7 étapes
- Module parcours gamifié `narration.html` : moteur kinetic porté et intégré, DA N&B uniforme, cinématiques (Bonjour, macros, cuisine/découpe, métabolisme), bibliothèque `K_SVG` (9 illustrations), jeu de la jauge canette/steak (sujets détourés `rembg`)

### ✅ [narration] Fait (session intégration — juillet 2026)
- Bug `.cta`/`fc-hint` (chevauchement bouton "Suivant" et indice de la flashcard) corrigé — en adoptant une version plus aboutie de `narration.html` fournie par Pablo (qui n'avait jamais eu la régression de l'animation de respiration `k_planBreathe` non plus)
- Bug de décalage vertical 84px après un beat classique (`document.body.scrollTop`) découvert en testant l'app dans le navigateur et corrigé — voir §7
- **`narration.html` intégré à `index.html`** : l'onglet "Progression" (bas de l'app) ouvre désormais `narration.html` en plein écran au lieu de l'ancien mini dashboard donuts/graphique (`#pageProg`, HTML/JS conservés mais devenus inaccessibles depuis la nav)
- `progression.html` (page orpheline concurrente) supprimée avec ses 2 endpoints
- **3 bugs de navigation trouvés et corrigés** (retour/carte inaccessibles pendant les scènes kinetic, carte invisible si ouverte pendant une scène kinetic, saut vers un mini-jeu depuis la carte qui laissait l'ancienne scène bloquée à l'écran) — voir §7 pour le détail
- **Vérification IA des photos de défi** : les 3 défis photo (macros/étiquette/accord) passent désormais par Claude vision (`k_verifyDefiPhoto`) avant de valider la photo, avec fail-open si l'API est indisponible — voir §3
- **Bibliothèque « motion Apple »** : 4 nouvelles entrées + 2 nouvelles sorties sobres ajoutées, et surtout `K_ENTERS`/`K_OUTS`/`k_pick()` (qui existaient sans jamais être appelés) branchés sur `k_sayToSeq()` et la fin de séquence kinetic — voir §3. **Chaque beat `say` (~24) varie désormais sa transition automatiquement**, ce qui répond en grande partie à "décliner le soin cinématique sur plus de notions" (avant : tous identiques sur `unblur`/`out-up`) sans avoir eu à récrire chaque beat à la main.

### 🔄 [narration] Reste à faire / à surveiller
- Valider sur **téléphone réel** le rythme des cinématiques, le figé net des scènes, et le jeu de la jauge
- Décliner un niveau de soin **cine hand-authored** (comme Bonjour/macros/cuisine) sur davantage de notions individuelles si voulu — la variété auto (ci-dessus) couvre déjà les beats `say`, mais un traitement sur-mesure reste possible notion par notion
- Basculer les images base64 → Cloudinary (`CLOUD_BASE`) pour repasser le fichier à ~60 Ko avant prod
- ~~Intégrer la feature au site~~ — **fait** : onglet Progression de `index.html` → `narration.html`. Reste éventuellement à revoir l'intégration Wix (iframe) si l'app entière y est encore embarquée.
- Fournir les vraies photos manquantes (étiquette, ustensiles, etc. — placeholders actuels)
- ⚠️ Vérifier manuellement le doublon visuel possible dans le jeu "Tier list" (voir §7) — probable artefact de test, pas confirmé
- Décider si `#pageProg` (ancien dashboard, code mort depuis le branchement vers `narration.html`) doit être nettoyé/supprimé de `index.html`, ou gardé en réserve

---

## 9. Règles pour Claude Code

1. **Lire le fichier avant de modifier** — ne jamais supposer son contenu
2. **`node --check` obligatoire** avant livraison — valide la syntaxe JS
3. **Vérifier `async async`** après toute correction de sbFetch — doublon fréquent
4. **Ne jamais utiliser postMessage Wix** pour `#html3` — URL params uniquement
5. **Vérifier `</body>` dans le fichier source** — souvent tronqué ; appender overlays + balises si manquants
6. **`lockScroll` = overflow:hidden** — jamais position:fixed (casse le scroll mobile)
7. **Overlays : style.display** (pas classList) pour les overlays injectés dynamiquement
8. **Inline onclick interdit** — `data-*` + `addEventListener` systématiquement
9. **Colonnes `profil_conseils`** : `conseils_json`, `recettes_json` et `liste_courses_json` existent et sont utilisables. En écriture, passer par `api/save-conseils.js`, qui n'écrit **que** les champs transmis (un appel partiel n'écrase plus le reste).
10. **Guard conseils = localStorage** (pas sessionStorage) pour persister entre rechargements
11. **Calcul stocks = par ingrédient** via `plans_repas → recettes → recettes_ingredients` — jamais par `plat_nom`
12. **`ingredients_base` colonnes macros** : `cal_per_100g`, `prot_per_100g`, `gluc_per_100g`, `lip_per_100g`
13. **RLS** : `recettes`, `recettes_ingredients`, `recettes_etapes`, `profil_conseils` → RLS désactivé. Ne pas réactiver sans test.
14. **Demander confirmation** avant de modifier `vercel.json` ou `masterPage.js`
15. **SQL sans commentaires** dans Supabase SQL Editor — erreur de syntaxe garantie
16. **CREATE POLICY une par une** — pas en batch
17. **Ne jamais supposer l'existence de colonnes** — vérifier avec `information_schema.columns`
18. **Activer Realtime manuellement** sur toute nouvelle table utilisant les WebSockets
19. **Après chaque push GitHub**, attendre le redéploiement Vercel (statut Ready) avant de tester
20. **`window._factureProduitsCache`** — données facture dans array global avec `data-idx`, pas en JSON dans `data-produit`
31. **Compatibilité Capacitor** : signaler à Pablo toute décision qui dépendrait d'une API navigateur non supportée en WebView (voir §10), ou d'un chemin absolu qui casserait si l'app n'est plus servie depuis la racine du domaine
32. **Push automatique autorisé** (décidé le 2026-07-26) : une fois un commit créé sur ce repo, `git push origin main` peut être fait directement, **sans redemander confirmation à chaque fois**. Authentification via clé SSH dédiée (`~/.ssh/id_ed25519_github`, clé "Claude Accès" sur GitHub, remote `origin` en SSH). Cette autorisation est spécifique à ce repo — ne pas l'étendre à un autre dépôt ou à d'autres actions destructrices (force-push, reset, etc., qui restent soumises à confirmation).

### [narration] Règles spécifiques au module parcours
21. **Backup avant grosse édition** : copier avant toute passe de script
22. **UTF-8 explicite** ; prudence avec les quotes échappées — préférer un heredoc Python à `str_replace` quand le texte contient `\'` (ex. `d'olive`)
23. **Valider le JS après CHAQUE édition** : extraire le `<script>` et lancer `node --check` (fichier trop gros pour relecture visuelle)
24. **Ne pas télécharger d'images sur le web** — demander à Pablo ; détourer via `rembg` si besoin
25. **Prototyper puis fusionner** : valider une mécanique dans un petit fichier avant intégration
26. **Éditer chirurgicalement** le moteur kinetic : tout est préfixé `k_` et scellé sous `#klayer` — ne pas casser le scoping CSS (une règle non scellée casse le layout)
27. **Ne jamais couper l'animation d'entrée d'un plan** (`animation:none` sur `.settled`) — réintroduit le bug « texte qui disparaît » ; garder le plan figé net via `!important`
28. **Bouton d'action toujours dans `#k_cta`** (barre fixe), jamais dans le plan animé
29. **Auto-avance uniquement sur les frames SANS bouton** ; une frame avec `btn` attend le clic et garde son contenu affiché
30. **Jauge canette/steak** : base et copie couleur strictement même taille ; révélation par `clip-path` ; sujet détouré sur panneau blanc, sans support
31. **Tester dans un vrai navigateur, pas juste `node --check`** : plusieurs bugs (dont le décalage `scrollTop` après clic) ne sont détectables qu'en observant l'app rendue (focus natif, scroll interne malgré `overflow:hidden`) — `node --check` valide la syntaxe, pas le comportement visuel

---

## 10. Compatibilité Capacitor / migration mobile (à garder en tête)

> Contexte : objectif produit à moyen terme = empaqueter le code web existant via **Capacitor** pour publier sur App Store / Play Store, **sans réécriture native**. Ce chantier n'a pas commencé (ne pas installer Capacitor sans demande explicite de Pablo) — cette section liste les points relevés dans le code actuel qui casseraient ou mériteraient une vérification dans une WebView native.

### Ce qui casserait tel quel
- **`window.self !== window.top` + `postMessage` vers un parent Wix** : présent dans quasi toutes les pages (`accueil.html`, `index.html`, `suivi.html`, `offre.html`, `questionnaire-alim.html`…) pour détecter si on est en iframe Wix. Dans une WebView Capacitor, il n'y a **jamais** de `window.top` différent de `window.self` (pas d'iframe) → toute la branche `postMessage` ne se déclenchera jamais. Ce n'est pas bloquant en soi (le fallback `window.location.href` prend le relais), mais il faudra vérifier que le fallback est bien complet partout et ne dépend pas silencieusement d'un message jamais reçu.
- **Chemins absolus (`/manifest.json`, `/icon-192.png`, `/sw.js`, etc.)** : fonctionnent tant que l'app est servie depuis la racine du domaine (cas actuel sur Vercel). Dans le bundle Capacitor, si `index.html` n'est pas à la racine du dossier `www/`, ces chemins casseraient. À vérifier lors de la config Capacitor (`webDir`).

### À tester en WebView avant de généraliser
- `alert()`/`confirm()` natifs (`questionnaire-alim.html`) — rendu différent voire bloquant selon la WebView/plugin.
- `navigator.clipboard` (`challenges.html`) — exige un contexte sécurisé, comportement à valider dans Capacitor.
- Les `WebSocket` manuels vers Supabase Realtime (`chat.html`, `challenges.html`, `suivi.html`) — devraient fonctionner en WebView (pas une limitation Capacitor), mais leur protocole est peut-être déjà obsolète côté serveur (voir §7) : à corriger avant de s'appuyer dessus en mobile.

### Ce qui est déjà une base saine pour la migration
- `sw.js` s'auto-désactive et `index.html` désinscrit tout service worker — pas de cache SW à gérer/désactiver spécifiquement pour la WebView (voir §2).
- `localStorage` (token, guards conseils) fonctionne nativement dans une WebView Capacitor, aucun changement attendu.
- Le module narration (`narration.html`) est déjà **100 % autonome sans réseau** — c'est la feature la plus "Capacitor-ready" du repo en l'état.

> **Règle de travail** : signaler à Pablo toute nouvelle décision technique qui introduirait une dépendance à une API navigateur non supportée en WebView, ou un chemin absolu fragile, avant de la committer.

---

*Contribution session 11 (Claude Sonnet, session admin multi-rôles / stocks / conseils / login — juillet 2026) :*
- **Section 1** : ajout mots de passe Chef et Logistique
- **Section 2** : ajout URL login, masterPage.js détaillé, vercel.json complet fusionné, user de test, tables Supabase nouvelles
- **Section 3** : documentation complète `index.html` v11 (overlays, token localStorage, conseils, scroll), `admin.html` (multi-rôles, stocks par ingrédient, import facture, macros auto), `login.html` (OAuth Google, flux)
- **Section 4** : ajout `profil_conseils` (colonnes exactes + colonnes inexistantes), `plans_repas`, `ingredients_base`, `stocks_mp`, `recettes`, `recettes_ingredients`, `recettes_etapes`, RLS état actuel
- **Section 5** : ajout variables CSS complètes, règles overlays display:flex/none
- **Section 6** : 12 nouvelles décisions (sbFetch async, overlays tronqués, lockScroll, localStorage guard, inline onclick interdit, window._factureProduitsCache, login.html, Google OAuth)
- **Section 7** : 10 nouveaux bugs documentés (double async, overlays manquants, lockScroll mobile, touch-action, classList overlays, forEach null, inline onclick, masterPage hasHtml3, cache Vercel, sessionStorage vs localStorage)
- **Section 8** : état d'avancement complet mis à jour
- **Section 9** : règles 3-20 ajoutées ou précisées

---

*Contribution session parcours/animations (Claude Opus, narration.html — juillet 2026) :*
- **Section 1** : statut de la feature (à intégrer au site, pas à migrer en natif), données nutritionnelles vérifiées
- **Section 2** : stack narration à jour (base64 + `K_CUT`, ~2,4 Mo, `CLOUD_BASE`, `rembg`)
- **Section 3** : documentation complète du **moteur kinetic** (`#klayer`, fonctions `k_`, dispatch `go()`, `K_SVG`, beats `cine`) et du **jeu de la jauge** (`renderCan`)
- **Section 5** : DA narration réécrite (N&B uniforme, thème clair/sombre, colonne 480 px, plus d'emojis de fond)
- **Section 6** : décisions du module parcours (moteur unique, bouton hors plan, séquence figé-net, transitions 3 s)
- **Section 7** : bugs narration détaillés (settled/opacité-flou, sorties manquantes, bouton transparent, surlignage, jauge)
- **Section 8** : état d'avancement narration + reste à faire
- **Section 9** : règles Claude Code 26-30 spécifiques au moteur kinetic

---

*Contribution session audit complet (Claude Sonnet, lecture intégrale du repo — juillet 2026), en préparation d'un futur portage Capacitor/App Store — lecture seule, aucun code fonctionnel modifié :*
- Renommage `CLAUDE FINAL.md` → `CLAUDE.md`
- **Section 1/Header** : clarification statut `map.html`/`motion_lab.html`/`deploy-demo` (inexistants dans ce repo), objectif Capacitor explicité
- **Section 2** : ajout PWA (`manifest.json`/`sw.js`, icône `/icon-192.png` cassée), fichier `vercel` orphelin identifié
- **Section 3** : documentation complète de `accueil.html`, `chat.html`, `challenges.html`, `offre.html`, `questionnaire-alim.html`, `progression.html`, `suivi.html` (statut legacy clarifié), `api/checkout.js`, `api/scan-plat.js`, `api/supabase.js` ; correction du statut de `api/webhook.js` (déjà fait, pas "à créer")
- **Section 7** : 6 nouveaux pièges documentés (navigation accueil→suivi.html, doublon `api/progression.js`, endpoints manquants dans `progression.html`, webhook Stripe sans signature, Realtime WebSocket protocole obsolète, icône PWA cassée)
- **Section 8** : correction de 3 statuts erronés ("à faire" → déjà fait), ajout des bugs/code mort découverts
- **Section 9** : règle 31 ajoutée (compatibilité Capacitor)
- **Section 10 (nouvelle)** : compatibilité Capacitor — ce qui casserait tel quel, ce qui est à tester, ce qui est déjà une base saine

---

*Contribution session corrections post-audit (Claude Sonnet, juillet 2026) — code fonctionnel modifié cette fois :*
- `accueil.html` : navigation `suivi.html` → `index.html` corrigée (impact réel incertain, `accueil.html` n'étant pas la vraie page d'accueil — celle-ci est sur Wix)
- `api/webhook.js` : vérification de signature Stripe ajoutée (HMAC-SHA256 via Web Crypto, tolérance replay 5 min, fail-closed si `STRIPE_WEBHOOK_SECRET` absent)
- `api/progression.js` (doublon HTML cassé) supprimé
- `api/suggestions-macros.js` et `api/analyse-nutrition.js` créés pour combler les 404 de `progression.html` (non testés en conditions réelles)
- `api/scan-plat.js` et `api/supabase.js` supprimés (code mort confirmé — `api/scan-plat.js` faisait doublon avec la feature déjà livrée `analyserAvecIA()`/`saveIA()` dans `index.html`, découverte pendant cette session)
- Toutes les modifications validées avec `node --check` avant commit

---

## 11. Application native (Capacitor) — branche `app-native`

> Section rédigée en juillet 2026, quand le portage est passé de « projet » à « app qui compile et tourne ». Le §10 ci-dessus reste valable comme liste de vigilance ; celle-ci décrit ce qui est **fait**.

### Structure
- **`www/`** est le bundle de l'app : copie sélective des fichiers web. `menu.html` y devient `index.html` (point d'entrée). `admin.html`, `accueil.html`, l'ancien `index.html` et `api/` en sont volontairement exclus.
- **`ios/`** et **`android/`** sont commités. Capacitor 8 utilise **Swift Package Manager, pas CocoaPods** — il n'y a rien à installer côté Ruby. `Package.resolved` est figé dans le repo.
- ⚠️ **Toute modification d'un fichier web doit être répercutée dans `www/`**, puis `npx cap sync`. Les deux arborescences ne sont pas liées automatiquement.

### Build iOS
```
npx cap sync ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' CODE_SIGNING_ALLOWED=NO build
```
- Xcode fournit le **SDK** iOS mais **pas la plateforme** : si aucune destination simulateur n'est éligible, lancer `xcodebuild -downloadPlatform iOS` (ne demande pas de mot de passe).
- Au tout premier lancement, la WebView peut mettre ~40 s à afficher quoi que ce soit (warm-up WebKit dans le simulateur). **Ce n'est pas un bug** — ne pas partir en chasse.

### Deep links — `com.natty.app://`
Le scheme est déclaré dans `ios/App/App/Info.plist` (`CFBundleURLTypes`) et dans `AndroidManifest.xml` (intent-filter `VIEW`/`BROWSABLE`, activité déjà en `launchMode="singleTask"`). Deux usages :
- **`com.natty.app://oauth-callback`** — connexion Google. Google **refuse** l'auth depuis une WebView embarquée (`disallowed_useragent`) : `login.html` ouvre donc le navigateur système via `@capacitor/browser`, et récupère le retour par l'écouteur `appUrlOpen` de `@capacitor/app`.
  ⚠️ **Nécessite `com.natty.app://oauth-callback` dans Supabase → Authentication → URL Configuration → Redirect URLs.** Google Console n'a rien à changer (l'auth est courtée par Supabase).
- **`com.natty.app://checkout`** — retour de paiement. Stripe n'accepte que des URL http(s), d'où la page relais **`checkout-retour.html`** (côté web, racine) qui rebondit vers le scheme. `api/checkout.js` reçoit `plateforme: 'natif'` et pointe vers cette page.

> **Règle** : tout écouteur `appUrlOpen` doit vérifier le préfixe du scheme et ignorer le reste, sinon un deep link tiers peut injecter un jeton ou simuler un paiement.

### Safe area
La WebView est rendue **bord à bord**. `assets/style.css` applique `env(safe-area-inset-top)` sur `.top` (couvre Menu, Suivi, Coaching, Repas, Profil) ; `offre.html` et `narration.html` ont leur propre header et leur propre correctif. `nav.js` gérait déjà le bas. `env()` vaut 0 sur le web : aucun impact côté navigateur.

### Ne pas piéger l'utilisateur hors du bundle
Un lien externe suivi dans la WebView sort de l'app **sans barre de navigateur pour revenir** (et c'est un motif possible de refus en review). Toute URL hors bundle doit passer par `@capacitor/browser`. Fait pour l'icône maison de `www/index.html`.

### Icônes et splash
Générés par `@capacitor/assets` depuis `resources/logo.png` (1024×1024) :
```
npx capacitor-assets generate --assetPath resources \
  --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#101014' \
  --splashBackgroundColor '#ffffff' --splashBackgroundColorDark '#101014'
```
⚠️ **Ne pas utiliser le dossier `assets/` par défaut** : à la racine, il contient déjà les assets web (`core.js`, `style.css`…). D'où `--assetPath resources`.
L'outil réécrit `www/manifest.json` — repasser derrière : il met `type: image/png` sur des `.webp`, et un `start_url` pointant vers `menu.html` qui n'existe pas dans le bundle.

### Repas de la semaine — une seule génération
`repas.html` appelait l'IA à chaque ouverture (~21 s). Désormais :
- La génération a lieu **une fois par semaine**, dans `suivi.html`, en même temps que les conseils (`NattyReco.genererSemaine`), et est stockée dans `profil_conseils.conseils_json`.
- `repas.html` et la **liste de courses de `coaching.html`** ne font que **lire** ce cache. La liste de courses est **dérivée** des recettes (agrégation des ingrédients), donc jamais désynchronisée et sans appel IA.
- Le **nombre de repas voulus** (1 à 7) est réglable dans `repas.html`. Préférence en `localStorage` (`natty_nb_repas_<userId>`) — donc **propre à l'appareil**, faute de colonne dédiée. La valeur réellement utilisée est conservée dans `conseils_json.nb_repas`.

### Reste à faire
- **Android n'a jamais été compilé** (ni JDK ni Android Studio sur la machine de dev).
- **Signature** : `CODE_SIGNING_ALLOWED=NO` suffit au simulateur ; un appareil réel ou TestFlight demande un Team Apple dans Xcode.
- `narration.html` pèse toujours ~2,4 Mo (images base64) — bascule Cloudinary prévue via `CLOUD_BASE`.

---

*Contribution session « ajouter un plat » (Claude Opus, juillet 2026) :*
- **Nouveau** `assets/ajout.js` : parcours complet du bouton `+` (caméra directe → analyse IA →
  anneaux de macros restantes par repas → enrichissement → carrousel de suggestions →
  enregistrement). Documenté en §3.
- `assets/nav.js` : le `+` appelle `NattyAjout.start()` en priorité (appel synchrone, sinon iOS
  n'ouvre pas la caméra), avec repli sur `NattyOnAdd` puis `suivi.html?add=1`.
- `suivi.html`, `repas.html`, `coaching.html`, `profil.html`, `menu.html` (+ copies `www/`) :
  chargement de `assets/ajout.js` ; `suivi.html` écoute `natty:repas-ajoute` pour rafraîchir.
- **§4 corrigé** : le tableau de `onboarding` listait 8 colonnes inexistantes (`nb_repas`,
  `proteines`, `glucides`, `lipides`, `calories`, `freins`, `repas_sautes`, `temps_cuisine`).
  Relevé réel en base + explication de où vivent vraiment les macros et le nombre de repas.
- **§7** : nouveau piège « colonnes fantômes de `onboarding` » (erreur `42703` qui fait échouer
  la requête entière, pas seulement la colonne).
- Vérifié dans le navigateur (viewport mobile) : les 4 écrans, la décroissance des anneaux à
  chaque ajout, le repli hors-ligne, et un enregistrement réel en base — lignes de test
  supprimées après vérification.

---

*Contribution session « garde-manger » (Claude Opus, juillet 2026) :*
- **Nouveau** `assets/garde-manger.js` : liste des ingrédients disponibles, remplie par scan
  (courses / ticket de caisse / photo importée) ou saisie libre. Documenté en §3.
- `assets/reco.js` (racine **et** `www/`) : `chargerProfil()` récupère le garde-manger,
  `construirePrompt()` ajoute la section « INGRÉDIENTS DISPONIBLES » + les règles 6 et 7
  (partir de ce stock, marquer `dispo`). Le commentaire d'en-tête affirmant que
  `liste_courses_json`/`recettes_json` n'existent pas a été retiré : il était faux (§7).
- `repas.html` et `www/repas.html` : panneau « Mon garde-manger » (4 actions, grille
  d'ingrédients avec retrait, bouton de génération) ; le panneau vit dans `#gmWrap`, hors du
  `#content` que `render()` remplace, pour rester visible pendant la génération. Les
  ingrédients d'une recette absents du garde-manger sont marqués « à acheter ».
- `www/suivi.html` : charge aussi le module, puisque la génération hebdomadaire part de cet écran.
- Vérifié en navigateur : saisie libre parsée (quantités avant/après le nom), scan d'un ticket
  de caisse factice via le vrai `/api/claude` (8 aliments extraits, totaux et sac écartés,
  « liquide vaisselle » filtré localement), génération réelle de 4 recettes partant du stock,
  et pastilles « 3 à acheter » sur la recette affichée.
- ⚠️ **Reste à faire** : créer la table `garde_manger` (SQL en §3). Sans elle le module
  fonctionne, mais la liste reste sur l'appareil.


---

*Contribution session « fil social » (Claude Opus, août 2026) :*
- **Nouveau** `social.html` + `assets/social.js` (+ copies `www/`) : mini réseau social sur les
  plats des membres — tendances, communauté, meilleurs scores nutritionnels, profils aux besoins
  proches, recherche, détail en bottom sheet. Documenté en §3.
- **Nouveau** `natty_social.sql` : tables `meal_likes` / `meal_vues` + colonne `meals.partage`.
  Non exécuté (pas d'accès DDL avec la clé anon) — à lancer par Pablo.
- `assets/nav.js` (racine **et** `www/`) : l'entrée « Coaching » devient « Social »
  (`social.html`), nouvelle icône. `coaching.html` n'est pas touché et reste atteignable par sa
  carte dans `menu.html`.
- Aucune table de posts créée : un repas enregistré depuis le bouton `+` est déjà un post.
  Le fil lit `meals` directement et recalcule les macros avec `Natty.calcMac` — les colonnes
  `calories`/`proteins_g`/… de `meal_ingredients` sont à 0 sur **les 227 lignes** en base.
- Vérifié en navigateur (viewport mobile, données réelles : 57 plats, 21 membres) : les quatre
  sections, la vedette « Top 1 🔥 », le rail, la recherche, la bottom sheet, le j'aime dans les
  deux sens et le comptage des vues. Aucune écriture en base pendant les tests (les tables
  n'existent pas encore, tout est passé par le repli localStorage).
- ⚠️ **Vie privée** : en l'état tous les repas sont publics dans le fil. `social.js` gère déjà
  `meals.partage`, mais le réglage côté profil reste à écrire.

---

*Contribution session « amis + confidentialité » (Claude Opus, août 2026) — suite directe de la
session « fil social » :*
- `assets/social.js` : abonnements entre membres (`membre_amis`, modèle « je suis quelqu'un »
  sans validation), annuaire `membres()`, section « Vos amis » avec repli en suggestions,
  et réglage global de confidentialité (`membre_prefs.fil_public`) via `lireMaPref()` /
  `ecrireMaPref()` / `estPrefsDispo()`. `charger()` va chercher explicitement les plats des
  membres suivis, car les 150 plus récents du fil général ne les contiennent pas forcément.
- `social.html` : section « Vos amis » + lien « Gérer » ouvrant la feuille des membres, boutons
  Suivre partout (listes, suggestions, détail d'un plat), toutes les occurrences d'un même
  membre à l'écran se mettent à jour ensemble.
- `profil.html` (+ `www/`) : interrupteur « Mes plats dans le fil » dans les réglages. Charge
  `assets/social.js` uniquement pour ce réglage. **Aucun repli localStorage volontairement** —
  un réglage de confidentialité local serait trompeur ; sans la table l'interrupteur est
  désactivé et le dit.
- `natty_social.sql` : ajout de `membre_amis` et `membre_prefs`.
- Vérifié en navigateur : suivre/ne plus suivre (persistance entre rechargements, bascule des
  sections, mise à jour de tous les boutons d'un même membre), feuille des membres (19 membres,
  tri amis d'abord puis proximité), et les trois états de l'interrupteur de confidentialité
  (table absente → désactivé ; actif on ; actif off, testés avec un double de `lireMaPref`,
  la création de table n'étant pas possible avec la clé anon).

---

*Contribution session « vérification du SQL social » (Claude Opus, 3 août 2026) :*
- `natty_social.sql` exécuté par Pablo : les 4 tables et `meals.partage` sont en base, RLS
  désactivée, contraintes correctes (unicité, `check (user_id <> ami_id)` — testé, rejeté en
  `23514`).
- **Défaut trouvé dans le code, pas dans le SQL** : `resolution=ignore-duplicates` sans
  `?on_conflict=…` fait résoudre PostgREST sur la clé primaire (`id` uuid neuf) et non sur la
  contrainte d'unicité → **409** au lieu d'un no-op. Le `.catch()` optimiste de `toggleLike` /
  `basculerAmi` annulait alors le geste à l'écran. Corrigé dans `assets/social.js` (+ `www/`)
  sur `meal_likes`, `meal_vues` et `membre_amis`. Encadré ajouté en §3.
- Vérifié après correctif, en rejouant le scénario exact du bug (ligne déjà présente en base,
  état local qui l'ignore — cas du second appareil) : le cœur et le bouton « Suivi ✓ » tiennent
  au lieu de revenir en arrière.
- Vérifié aussi : le réglage de confidentialité de bout en bout (défaut public → privé →
  relecture en base → retour public), et son effet réel sur le fil d'un AUTRE membre
  (le membre le plus prolifique passé en privé : 57 → 42 plats, zéro de ses plats dans les
  cinq sections, disparu de l'annuaire ; restauré ensuite).
- **Toutes les lignes de test ont été supprimées** : les 4 tables sont vides, les 65 `meals`
  intacts, aucun `meals.partage` à `false`.
