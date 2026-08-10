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

### ✅ Fichier `vercel` (sans extension, racine) — supprimé, et il expliquait un vrai bug
Ce n'était pas qu'un artefact inerte. Ce fichier contenait **les headers no-cache**, que
`vercel.json` n'a **jamais** portés dans tout l'historique du dépôt — vérifié
(`git log -p`). Vercel ne lisant que `vercel.json`, les en-têtes
`Cache-Control: no-cache` sur les `.html` **n'ont donc jamais été appliqués**, ce qui explique
le « ancienne version servie malgré un nouveau déploiement » documenté en §7 et le
`?v=Date.now()` de `masterPage.js` qui compensait à la main.
**Corrigé (août 2026)** : les deux règles `headers` sont passées dans `vercel.json`, et le
fichier orphelin a été supprimé.

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

> ⚠️ **LE MODULE DOIT ÊTRE CHARGÉ PARTOUT OÙ UNE GÉNÉRATION PEUT ÊTRE LANCÉE**
> (corrigé le 2026-08-05, signalé par Pablo : « je ne vois plus l'option de
> planification en fonction du garde-manger »). `assets/generation.js` pose la
> question « On part de ton garde-manger ? » derrière un
> `if (!opts.discret && window.NattyGardeManger)` — donc **sans le module, la
> question est sautée SANS un mot**. Or `garde-manger.js` n'était chargé que par
> `repas.html`, alors que `generation.js` l'est par **12 écrans** : l'option
> n'existait que depuis l'écran Repas, et nulle part ailleurs. Elle n'avait pas
> été retirée, elle était muette. Vérifié en navigateur, dans les deux sens : avec
> le module, la feuille s'affiche avec le contenu du garde-manger et ses quatre
> façons de le remplir ; sans lui, `question affichée : false`.
> ⚠️ Pour ce contrôle inverse, écraser la variable à `undefined` — **pas
> `delete`** : le module se déclare en `var`, la propriété de `window` n'est donc
> pas configurable et `delete` échoue en silence (le premier essai montrait la
> question qu'il était censé faire disparaître).

**Rapprochement avec les recettes** : `contient(nom)` compare **mot à mot**, jamais en
sous-chaîne — sinon « ail » serait trouvé dans « volaille ». Un ingrédient de recette absent du
garde-manger s'affiche avec une pastille orange `+` et le compteur « N à acheter ».

**✅ Persistance — la table `garde_manger` EXISTE** (`natty_garde_manger.sql`, exécuté par
Pablo le 2026-08-05). Vérifié à la clé anon : elle répond `[]` et non `PGRST205`, ses trois
colonnes `user_id` / `items` / `updated_at` sont présentes (témoin : une colonne inventée répond
bien `42703`, donc le test lit vraiment le schéma), et un INSERT à la seule clé anon est
**refusé en `42501`** — la policy protège. La synchronisation est donc active, sans changement
de code : `estSynchronise()` passe à `true` de lui-même, et le panneau n'affiche plus
« Liste gardée sur cet appareil uniquement ». Le repli `localStorage` reste en place au cas où
la table disparaîtrait.
> Bon à savoir sur ce relevé : l'écriture a échoué sur la **RLS** et non sur `42P10` (« no
> unique constraint matching the ON CONFLICT specification »). La requête a donc été
> **planifiée** avant d'être refusée — ce qui prouve que la cible du `ON CONFLICT` s'est
> résolue, donc que la clé primaire sur `user_id` est bien en place (voir ci-dessous pourquoi
> elle est structurelle).
- ⚠️ **RLS ACTIVÉE, avec une policy « soi seulement ».** Les versions précédentes de ce
  document et l'en-tête du module proposaient `disable row level security` : c'était écrit
  **avant** l'activation générale des RLS (2026-08-04), et ce serait aujourd'hui exposer à la
  clé anon publique ce que chacun a chez lui.
- ⚠️ **`user_id` doit être la CLÉ PRIMAIRE**, et c'est structurel : `sauver()` écrit en
  `resolution=merge-duplicates` **sans** `?on_conflict=`, donc PostgREST résout sur la clé
  primaire. Avec un `id` uuid en clé, chaque enregistrement repartirait en **409** et le
  garde-manger ne se synchroniserait jamais — même piège que `meal_likes` / `membre_amis`.
  La table se comporte alors comme `membre_prefs` : rien à changer côté code.

**Deux endroits pour le remplir, et c'est voulu** (2026-08-05) :
- la **question plein écran** juste avant la génération de la semaine
  (`assets/generation.js`) — au moment où la réponse change quelque chose ;
- le **panneau « Mon garde-manger »**, tout en bas de l'écran **Suivi** (demande de
  Pablo). Il avait quitté `repas.html` au profit de la seule question ; il revient
  en permanent, pour qu'on puisse composer sa liste quand on veut et pas seulement
  quand l'app la réclame. Mêmes quatre entrées, plus le retrait et « Tout vider ».

⚠️ **Le bouton du panneau ne repasse PAS par la question.** Il appelle
`NattyGeneration.lancer({ forcer: true, garde: … })` : `opts.garde` court-circuite
`demanderGardeManger()`, parce que l'utilisateur vient de composer sa liste sous ses
yeux — la lui redemander serait une étape pour rien. Une chaîne vide reste une
réponse valable (« génère sans »), d'où le test sur `undefined` et non sur la
véracité.
⚠️ **L'ancien bouton appelait `NattyReco.genererSemaine()`, qui n'existe plus** : la
génération est côté serveur depuis août 2026. Ressusciter le panneau tel quel
aurait donné un bouton inerte.
⚠️ **Les deux `<input type="file">` vivent HORS du panneau** : `rendreGardeManger()`
réécrit son `innerHTML` à chaque changement, ce qui les détruirait — avec leurs
écouteurs — dès le premier ingrédient ajouté.
⚠️ **Le CSS du panneau est réécrit avec les jetons de `suivi.html`** (`--bg`,
`--text`, `--muted`, `--line`, `--so`, `--si`, `--surface-ink`, `--on-ink`) : la
version d'origine utilisait `--card`/`--ink`/`--nm-in`, qui n'existent pas sur cette
page. Vérifié dans les deux thèmes.

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

**Refonte en trois temps (2026-08-05, demande de Pablo).** L'écran unique faisait
tout — cadre, anneaux, liste, « Terminer » — et c'est ce qui étouffait le cadre photo.
Il est découpé :
1. **`naScRepas` — la prise de vue.** Le cadre est le HÉROS (3/4, centré), puis les
   anneaux en **−30 %** (92 px au lieu de 132, trait et textes réduits dans le même
   rapport), le **module noir des calories restantes** (vocabulaire `--metal-black` /
   `--sh-metal` de `suivi.html`, valeurs recopiées : ces tokens vivent dans son
   `<style>`, pas dans `assets/style.css`), et les trois sources — **Prendre la photo**,
   **Galerie**, **Écrire**. Ni liste d'ingrédients ni « Terminer » : ils n'ont aucun sens
   avant qu'un plat existe.
2. **`naScOk` — la validation.** Rond puis V vert, reprise de `.vok` d'`assets/planning.js`
   (deux tracés décalés ; un seul tracé continu ne se lit pas comme une validation).
   Enchaîne seule au bout de 1,75 s — c'est une confirmation, pas une étape.
   ⚠️ La caméra est arrêtée **avant** la transition : la laisser tourner garde l'indicateur
   allumé sur des écrans qui ne filment plus. Le minuteur est annulé par `fermer()`, sinon
   un overlay fermé pendant l'animation se rouvrirait tout seul sur un `S` déjà nul.
3. **`naScRecap` — le récap.** Nom modifiable, vignettes, anneaux à taille normale, liste
   des ingrédients **ouverte** (retirer / corriger la quantité / ajouter), puis
   **Enrichir** — qui n'apparaît qu'ici — et **Terminer et enregistrer**.
   « Écrire » y mène **sans** la transition verte : rien n'a été reconnu, il n'y a rien à
   confirmer.

Retours : depuis le récap on revient à la prise de vue (c'est là qu'on ajoute une seconde
photo au même repas) ; c'est depuis la prise de vue qu'on abandonne. Retirer la dernière
vignette ramène à la prise de vue, plutôt que d'afficher un récap vide avec « Terminer ».

⚠️ **Les anneaux existent en DEUX exemplaires**, d'où le préfixe d'identifiant
(`naArcp` / `naArcmp`) et `PREFIXES` : `majAnneaux()` peint les deux du même coup, ils ne
peuvent donc pas se contredire d'un écran à l'autre.

**Enchaînement des écrans** (maquettes d'origine, avant la refonte ci-dessus) :
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

### `assets/creneaux.js` — combien de repas, lequel maintenant, et combien de macros chacun
Chargé partout où `assets/ajout.js` l'est (les 5 écrans porteurs de la nav + `www/`).
Dépend de `assets/core.js` (`Natty.jour`, `Natty.calcMac`).

**Deux défauts qu'il corrige**, signalés par Pablo le 2026-08-09 :
- 🔴 **un plat enregistré à 12 h 03 n'était pas compté quand on rouvrait `+` à
  12 h 40.** `restant()` ne soustrayait que `totalSession()` — les plats de la
  session en cours — donc le midi repartait de sa cible PLEINE alors qu'on venait
  de manger. C'est le **créneau** qui porte le compte, pas la session : ce qui est
  déjà en base est relu (`mange(cle)`) et soustrait lui aussi ;
- **diviser la journée par le nombre de repas est faux pour presque tout le
  monde.** Quelqu'un qui saute le petit déjeuner n'a pas un tiers de ses calories
  le matin.

**Le découpage** vient de `questionnaire_alim.nb_repas` — vocabulaire réel
`1_2` / `3` / `3_collations` / `grignotage` (relevé dans `questionnaire-alim.html`,
ne pas en inventer d'autres) → 2, 3 ou 4 créneaux. ⚠️ Les bornes horaires couvrent
la journée **en continu, de 3 h à 3 h** (d'où des heures > 24) : sans continuité,
« dans quel créneau suis-je ? » n'a pas toujours de réponse et un repas de 1 h du
matin tombe dans le vide. Le créneau vient de `created_at`, **jamais** de
`meal_date` — une date sèche n'a pas d'heure (même piège que `planning.js`).

**La répartition** croise deux sources, moitié-moitié :
1. **le déclaratif** — parts de base du découpage, corrigées par `repas_sautes`
   (`petit_dej` → matin ×0,45 ; `dejeuner` → midi ×0,75 ; `souvent_repas` → les
   deux) et `snacking` (`bureau` → collation ×1,4 ; `soir` → soir ×1,12). Ce sont
   les **seuls** champs du questionnaire qui parlent de répartition dans la
   journée ; les autres parlent de goûts, ce qui ne dit rien de l'heure — les
   utiliser ici serait inventer ;
2. **le mesuré** — les repas des 28 derniers jours rangés par créneau, **macro par
   macro**. Une part unique par créneau écraserait justement l'information utile :
   on peut prendre ses glucides le midi et ses protéines le soir. En dessous de
   6 repas journalisés on s'en tient au déclaratif — trois repas ne décrivent pas
   une semaine.

> ⚠️ **Plancher à 8 % par créneau.** Sans lui, quelqu'un qui n'a jamais
> journalisé son petit déjeuner se verrait proposer une cible du matin proche de
> zéro, donc « objectif atteint » avant d'avoir mangé — l'inverse du service
> rendu. Renormalisation par macro après application du plancher.
> ⚠️ **Ne demander à `onboarding` que `poids` et `tdee`**, et prendre la première
> ligne *exploitable* (la table contient de vrais doublons). Et demander les
> quatre colonnes de macros à `meal_ingredients`, sinon `calcMac` retombe en
> silence sur la table locale (§3, `api/_nutrition.js`).

Vérifié en navigateur sur six scénarios : parts qui somment à 100 % par macro,
créneau juste à 8 h / 12 h 40 / 1 h du matin, **le plat de 12 h 03 bien soustrait
à 12 h 40 tandis que le soir reste intact**, dépassement annoncé au lieu d'un
zéro, saut du petit-déjeuner qui redistribue, habitudes qui déforment macro par
macro (protéines 62 % le soir contre 18 % le matin), et les découpages à 2 et
4 créneaux.

**Présentation — « on doit comprendre en un coup d'œil que c'est un reste ».**
- Sur le `+` : une ligne **au-dessus** des anneaux (« Il vous reste pour votre
  déjeuner ») et, en dessous, ce qui est déjà noté (« 1 plat déjà noté · 700 kcal
  comptées ») — sans quoi un reste amputé d'un plat pris une demi-heure plus tôt
  ressemble à une erreur. Au-dessus des anneaux et non dans chacun : à 92 px de
  diamètre, une quatrième ligne de texte ne se lit plus. Le module noir dit
  « kcal restantes », et « +300 kcal de trop » en ambre au-delà de la cible.
- Sur **Suivi** : le grand nombre de chaque anneau est le restant, mais le titre
  de la carte disait « Votre objectif » — on lisait donc « 25 g » comme une cible.
  Il dit maintenant « Il vous reste aujourd'hui », et chaque anneau porte le mot
  (« restant · 34 % de 176 g ») pour se lire seul.

**Cible par repas** : `chargerCibles()` lit `onboarding` (`poids`, `tdee`) et refait le calcul
de `calcMacros()`, puis divise par le nombre de repas par jour issu de
`questionnaire_alim.nb_repas` (libellé → entier via `REPAS_PAR_JOUR`). Fallback 2000 kcal /
30-50-20 si l'onboarding n'est pas exploitable. **Ne jamais demander `nb_repas` ni les macros
à `onboarding` : ces colonnes n'existent pas** (voir §4).

**Les macros sont ÉCRITES, pas redevinées** (août 2026 — c'était le défaut le plus visible :
du saucisson comptait pour **0 protéine et 0 kcal**).
- L'analyse photo ne rend plus un total de plat mais, **par ingrédient, ses valeurs pour 100 g**.
  Trois raisons : un total demandé à part peut contredire la somme de ses parties ; « pour
  100 g » est une donnée de table que le modèle connaît, alors qu'un total dépend en plus d'une
  estimation de quantité ; et surtout **corriger une quantité à la main recalcule tout**.
- `macroDe()` tranche entre trois sources, dans l'ordre : macros d'une suggestion IA →
  `pour100` **si elle est crédible** → table de `core.js`.
- ⚠️ **`credible()` a une tolérance ASYMÉTRIQUE.** La règle 4/4/9 surestime systématiquement les
  aliments riches en fibres (comptées comme glucides, mais ~2 kcal/g). Mesuré sur le vrai
  modèle : un citron rendu à 29 kcal / 1,1 p / 9 g calcule 43 kcal — juste, et pourtant rejeté
  par une tolérance symétrique. On tolère donc largement le dépassement (fibres, alcool) et on
  reste sévère dans l'autre sens, où des kcal plus hautes que ce que les macros expliquent
  signalent une invention. En dessous de 20 kcal/100 g, l'écart relatif ne veut plus rien dire.
- À l'INSERT, `meal_ingredients` reçoit `calories`, `proteins_g`, `carbs_g`, `fats_g`
  (colonnes **vérifiées présentes** en base) — repli sans elles si l'instance ne les a pas.
- Un aliment que ni l'analyse ni la table ne savent chiffrer prend un **liseré ambre et un
  « ? »** : il compte pour zéro, et un total silencieusement faux est pire qu'un manque visible.
  Renommer suffit presque toujours ; les valeurs héritées de l'ancien nom sont alors jetées,
  mais **seulement si le nom a vraiment changé** (comparé sans accent ni casse, pour qu'une
  faute de frappe ne coûte rien).

**Après « Terminer », trois temps, dans cet ordre** : « Repas enregistré » (1,1 s) → analyse
critique → suggestion du prochain repas → **et seulement ensuite** le choix de publication.
> ⚠️ Le choix s'affichait au bout de **900 ms** alors que l'analyse demande une dizaine de
> secondes : on appuyait sur « Garder pour moi », l'écran se fermait, et l'analyse — calculée
> et payée — n'était jamais vue. C'est ce que Pablo a constaté (« il n'y a pas l'analyse
> critique du plat »). Le choix arrive quand même si l'analyse échoue : une panne d'IA ne doit
> pas bloquer la publication.

⚠️ **Le cadre photo est en `object-fit:contain`, en portrait.** En `cover` dans un cadre 4/3, un
cliché de téléphone (3/4) était rogné des deux tiers : on cadrait son assiette sur une vue
tronquée, et la photo réellement analysée ne ressemblait pas à ce qu'on avait vu.

> ⚠️⚠️ **ET IL ÉTAIT DÉCLARÉ 3/4 SANS L'ÊTRE** (corrigé le 2026-08-05, sur photo de Pablo).
> Mesuré à 390×844 : **346 × 207 px, rapport 1,67**. `aspect-ratio:3/4` donnait une hauteur
> préférée de 461 px, le contenu de l'écran dépassait donc la fenêtre, et le cadre étant le
> seul élément vraiment compressible, c'est lui qui absorbait tout le manque
> (`flex-shrink` vaut 1 par défaut). **Un `aspect-ratio` ne survit pas à une compression
> flex** : la largeur restait étirée à 100 %, la hauteur tombait, le rapport partait à
> l'envers. Une photo de téléphone en `contain` s'affichait alors en bande de 152 px entre
> deux bandes noires de 95 px.
> La correction inverse la logique : un conteneur `flex:1` prend la place restante, le cadre
> s'y inscrit en `height:100%` + `aspect-ratio`, donc c'est la **largeur** qui se déduit de la
> hauteur. Mesuré après : **306 × 408 px, rapport 0,75 exact, centré, zéro bande** — quatre
> fois la surface de photo visible. Un `min-height` sert de plancher sur petit écran
> (375×667) : mieux vaut laisser l'écran défiler de quelques pixels que réduire la photo à un
> timbre-poste.
> Le titre est passé à une ligne (25 px au lieu de 38, vérifié du « premier » au « dixième »
> repas) : à deux lignes il mangeait 81 px pris directement sur le cadre.

**Suggestions** : `optionsIA()` interroge `/api/claude` (texte seul) ; `optionsLocales()` les
compose depuis la table nutritionnelle de `core.js`. Une suggestion dont les macros sont nulles
(ingrédient non reconnu) est écartée et remplacée par des options locales, sinon elle ne ferait
bouger ni les anneaux ni le suivi une fois enregistrée. `classer()` trie par adéquation au
restant, en pénalisant ce qui dépasse nettement. « Me resservir » n'appelle pas l'IA : c'est
l'assiette courante en ½ / 1 / 1½ portion.

**Après « Terminer » — le bilan, puis le choix de publier.** Le plat est enregistré, PUIS un
écran de bilan s'ouvre : coche animée, analyse critique du repas (ce qui va / à surveiller /
conseils) et **suggestion du prochain repas de la journée**, calculée sur ce qu'il reste du jour,
les conseils de la semaine et le garde-manger — un seul appel à `/api/claude`, les deux découlant
du même état.
- ⚠️ **`partage: false` à l'INSERT** : avant, tout plat enregistré partait dans le fil sans que
  personne ne l'ait demandé. Le choix se fait à la fin du bilan — « Poster dans le fil » ou
  « Garder pour moi » — et le retour depuis cet écran vaut « garder », l'état déjà écrit.
- L'analyse est rangée sous **la même clé que `suivi.html`** (`natty_analyse_plat_<id>` +
  `meals.analyse_json`) : rouvrir le plat depuis l'historique affiche ce texte-là, sans le
  régénérer ni en produire un autre.
- `natty:repas-ajoute` est émis **dès l'écriture**, pas à la fermeture : l'anneau de Suivi doit
  descendre tout de suite, pas quand l'utilisateur a fini de lire.
- Si `meals.partage` n'existe pas sur l'instance, l'INSERT entier serait refusé : un repli
  réenregistre sans la colonne et on cesse de l'envoyer.

**Enregistrement** : rien n'est écrit avant « Terminer ». Chaque plat de la session devient une
ligne `meals` + ses `meal_ingredients` (la photo Cloudinary va sur le premier). L'échec de
l'upload photo n'empêche pas l'enregistrement. À la fin, l'événement `natty:repas-ajoute` est
émis : `suivi.html` l'écoute pour rafraîchir macros et historique sans recharger la page.

### `assets/recette.js` — préparation détaillée et cinématique « Suivre la recette »
Chargé par `repas.html` (+ `www/`). Trois entrées : `fiche(recette)` (HTML des étapes),
`monter(el, recette)`, `suivre(recette)` (cinématique plein écran). Plus `galerie()`, la planche
de contrôle des 16 gestes — utile pour vérifier une animation sans dérouler une recette.

**Une animation par ACTION, l'aliment en slot** (idée de Pablo, 2026-08-04). La bibliothèque est
indexée par geste — `couper`, `saisir`, `bouillir`, `mijoter`, `enfourner`, `melanger`,
`fouetter`, `mixer`, `assaisonner`, `huiler`, `rincer`, `peser`, `refrigerer`, `reposer`,
`attendre`, `dresser` — et chaque scène réserve un emplacement où l'on dépose l'aliment de
l'étape (l'emoji de l'ingrédient, déjà présent dans les recettes). **Conséquence : une
génération de recettes n'a rien à dessiner, elle ne fait que piocher la bonne action.** L'IA ne
renvoie donc jamais de SVG, seulement une clé ; une clé inconnue retombe sur `melanger`, et
`ALIAS` rattrape les synonymes (`poele`→`saisir`, `four`→`enfourner`…).

**Le thermostat n'est jamais demandé à l'IA** : `libTemp()` le calcule (÷ 30) et écrit
« 200 °C · th. 6-7 » quand la valeur tombe entre deux crans — arrondir au plus proche donnait
« th. 7 », soit 210 °C.

**Marche sur l'ANCIEN format de recette.** `normaliser()` déduit action, durée, température, feu
et quantités d'une étape écrite en texte libre (`{em, t, tip}`), parce que les recettes en cache
dans `conseils_json` sont à l'ancien schéma et que la génération n'a lieu qu'une fois par
semaine. Trois pièges rencontrés, tous vérifiés en navigateur :
- ⚠️ **`fill="currentColor"` obligatoire sur l'aliment** : le `<svg>` parent impose
  `fill="none"`, et un glyphe sans remplissage est purement invisible — tous les ustensiles
  s'affichaient, aucun aliment.
- ⚠️ **Jamais de classe de caractères contenant des emojis** : `[🍳🍽️…]` contient des
  demi-surrogates isolés (U+D83C traîne seul) et fait correspondre **tous** les emojis de la
  plage. Le test « est-ce un ustensile ? » se fait par `indexOf` sur une liste.
- ⚠️ **Tous les plans sortent, pas seulement le premier** : avec `querySelector`, deux taps
  rapprochés laissaient un plan orphelin sous le nouveau et désynchronisaient l'étape affichée
  du compteur (4 plans empilés après 3 clics rapides) — le chevauchement déjà connu de
  `narration.html`.

L'aliment **s'hérite** d'une étape à la suivante (« Enfourne 18 min » ne nomme rien, mais c'est
ce qu'on vient de préparer qui part au four), sauf après `huiler` et `assaisonner` : sinon une
olive finissait au four à la place du poulet.

### `assets/liste.js` — liste de courses : cocher, masquer, copier
Chargé par `coaching.html` (+ `www/`). `monter(el, items, opts)` où `opts.cle` est la clé
localStorage — **fournie par l'appelant** parce que `coaching.html` avait déjà sa clé
hebdomadaire remplie de cases cochées.

Deux gestes qui manquaient : **masquer les articles déjà pris** (une liste de 20 lignes dont 15
barrées ne se lit plus) et **copier**. Les deux se tiennent : le bouton copie ce qui est
**affiché**, donc masquer puis copier donne « ce qu'il reste à acheter » sans troisième réglage —
et le libellé du bouton l'annonce (« Copier les 3 restants »).

`navigator.clipboard` exige un contexte sécurisé ; le repli `textarea` + `execCommand` couvre le
reste. ⚠️ **Un clic simulé en JS ne copie rien** (pas d'activation utilisateur) : tester la copie
avec un vrai clic souris, sinon on conclut à tort à un bug.

> **Envoi par email abandonné (2026-08-04, décision de Pablo).** Ces deux modules remplacent le
> projet d'envoyer courses et recettes par mail : ça dépendait d'une clé Resend et d'un domaine
> vérifié, pour un résultat que l'utilisateur ne contrôlait pas. Le type
> `courses_et_recettes` d'`api/send-email.js` n'est **appelé par aucun écran** — code mort à
> retirer un jour ; les autres types (récap admin, notification de message) servent toujours.

**Les aliments ajoutés à la main** (août 2026) : `extras(userId)`, `contientExtra`,
`basculerExtra` — les « aliments à privilégier » d'une macro qu'on touche pour les mettre dans
ses courses. Ils vivent **à côté** de la liste calculée, en `localStorage` et par semaine :
`liste_courses_json` est DÉRIVÉE des recettes côté serveur, donc y réinjecter des ajouts
manuels les ferait écraser à la génération suivante, et personne ne comprendrait pourquoi sa
liste a maigri.
- ⚠️ **La clé est partagée avec `suivi.html`**, au caractère près
  (`natty_courses_extra_<uid>_<lundi>`, éléments `{nom, emoji}`). C'est tout l'intérêt : on
  touche un aliment dans le détail d'une macro, on le retrouve dans sa liste de courses. Deux
  clés auraient donné deux listes, et le geste n'aurait mené nulle part.
- ⚠️ **Et les deux écrans ne calculent pas le même lundi.** `getLundiSemaine()` de `suivi.html`
  finit par `toISOString()`, donc en **UTC** : un lundi entre 00 h et 02 h à Paris, il rend le
  **dimanche** — même piège que `semaine` côté serveur. Non corrigeable là-bas (session
  parallèle), alors `liste.js` lit l'**union** des deux clés possibles et réécrit dans la locale
  en effaçant l'autre : la divergence se répare au premier geste, au lieu de faire disparaître
  un aliment ajouté la nuit du dimanche au lundi.

### `coaching.html` — les aliments à privilégier, et où ils mènent
Rangée qui défile au-dessus de la liste de courses, alimentée par
`NattyReco.alimentsSemaine()` → `conseils_json.plats_macro[].aliments` : **la même génération**
que les conseils, donc aucun appel IA de plus. Un tap l'ajoute à la liste juste en dessous
(`NattyListe.basculerExtra`), et `peindreCourses()` remonte la liste **sans requête** — recharger
la base pour un geste local ferait clignoter la liste et perdrait les cases cochées.
- Une rangée horizontale, pas une grille : ils sont 12 à 18, et empilés ils repousseraient la
  liste de courses — le seul contenu qu'on vient vraiment chercher ici — hors de vue. Vérifié à
  375 px : rangée de 66 px, 1383 px de contenu qui défile **en interne**, la page elle-même ne
  défile pas horizontalement.
- **Une seule liste, pas deux** : on fait ses courses une fois. Un ajout déjà présent dans une
  recette n'est pas répété, et un aliment servant deux macros n'apparaît qu'une fois.
- ⚠️ **Plus de sortie anticipée quand la semaine n'a pas de recettes.** `loadCourses()` affichait
  l'invitation à générer et rendait la main : les ajouts manuels n'étaient alors visibles nulle
  part et le « + » ne menait à rien. `peindreCourses()` tranche sur la liste **réelle** —
  recettes plus ajouts — et ne montre l'invitation que si les deux sont vides. Même correctif que
  dans l'overlay de `suivi.html`.
- Section entière masquée (titre compris) s'il n'y a aucun aliment : un en-tête au-dessus du vide
  laisse croire qu'un contenu n'a pas chargé.

### `assets/planning.js` — la planification de la semaine
Séquence plein écran **noire**, une fois par semaine, à la première ouverture de l'app :
« Bonjour Prénom » → « Planifions ensemble votre semaine » → deux questions → placement →
calendrier → proposition de livraison → validation. Ensuite le calendrier vit dans
« Ma semaine », en haut de `repas.html`. Chargé par `menu.html`/`www/index.html` (le
déclencheur) et par `repas.html` (le panneau). Dépend d'`assets/core.js` ; utilise
`assets/generation.js` s'il est là.

**Un module, pas une page** — la proposition arrive **cinq secondes** après l'arrivée dans
l'app, par-dessus l'écran courant. Une page aurait volé la navigation à quelqu'un qui venait
faire autre chose. Même parti pris qu'`assets/ajout.js` et `assets/generation.js`.

**Le déclencheur ne s'arme que sur l'écran d'arrivée** (`menu.html`) : c'est le seul endroit où
« à la première ouverture de la semaine » veut dire quelque chose. Il se tait tout seul si la
semaine est déjà planifiée, si elle a été ignorée (`natty_plan_vu_<uid>` = le lundi courant),
si une génération occupe déjà le plein écran, ou si un plat est en cours d'ajout — deux plein
écran l'un sur l'autre ne se discutent pas.

**Ce qui est calculé ici, et ce qui ne l'est pas.**
- Le **placement** est déterministe et local : les repas des 28 derniers jours sont rangés en
  21 cases (7 jours × 3 créneaux), chaque case comparée à la cible du créneau. Le repas
  « protéines » va là où il manque le plus de protéines. Aucune IA, donc aucune latence et un
  résultat explicable ligne à ligne.
  - ⚠️ Le créneau vient de `created_at` (horodaté), **jamais** de `meal_date` (une date sèche
    n'a pas d'heure, donc pas de créneau, et tout le calcul tombe).
  - ⚠️ Une case **jamais renseignée** n'est pas une case sans manque, c'est une case sans
    information. La compter 0 exclurait d'office les créneaux que l'utilisateur ne journalise
    pas — souvent ceux qu'il expédie. Elle vaut `0,55`.
  - Une case porte la **moyenne** par repas, pas le cumul : quatre lundis midis enregistrés ne
    doivent pas passer pour un excédent.
- **Ce module n'appelle plus l'IA du tout** (août 2026, demande de Pablo : « la génération
  doit être unique »). Les **3 plats macro** ET les **2 recettes** sortent de la génération de
  la semaine, lues dans `profil_conseils.conseils_json` (`plats_macro` et `recettes`). Un trio
  de repli local reste, pour les lignes générées avant ce changement.
  > ⚠️ Avant, la planification faisait un **second** appel à `/api/claude` : deux factures pour
  > une semaine, ~10 s d'attente de plus, et deux avis qui pouvaient se contredire — les
  > conseils disant une chose, les plats placés en illustrant une autre. Ils sont désormais
  > demandés dans le MÊME appel, ce qui est aussi la seule façon qu'un plat « protéines »
  > découle vraiment du conseil protéines écrit le même jour.

**Total : 5 repas sur 21**, et c'est ce que dit le compteur.

⚠️ **Dépendance, et ORDRE.** Sans la génération de la semaine il n'y a ni recettes ni plats à
placer. Si elle manque : on la fait faire d'abord (`NattyGeneration.lancer()`, son propre plein
écran ~85 s), on la stocke, et **seulement ensuite** l'animation de planification commence.
Avant, elle était lancée *pendant* cette animation, qu'il fallait masquer puis rallumer — deux
attentes empilées dont une qui mentait sur ce qui se passait. Si la génération n'aboutit pas, la
séquence le dit (`scEchecGeneration`) plutôt que de placer trois plats de repli en les faisant
passer pour personnalisés.

**La mise en scène de la planification dure 3,6 s**, plus les quelques centaines de
millisecondes du calcul. Elle durait 15 s quand il y avait un appel à l'IA ici : garder ce
compte à rebours maintenant serait une attente inventée, et ça se voit.

**Persistance** : table `planning_semaine` (`natty_planning.sql`, §4). Tant qu'elle n'existe
pas le plan vit dans le `localStorage` de l'appareil — et l'écran **le dit** plutôt que de
laisser croire à une synchronisation qui n'a pas lieu. Le plan est enregistré **avant**
d'afficher le calendrier : « Commander » quitte l'app, et un plan composé puis perdu dans ce
trajet serait le pire des deux mondes.

**Pièges retenus de `narration.html`, et deux trouvés ici** (tout vérifié en navigateur) :
- Bouton d'action **toujours** dans la barre fixe `#nplCta`, jamais dans le plan animé : dans
  le plan, l'animation de sortie l'emporte et il disparaît sous le doigt.
- Auto-avance sur les scènes **sans** bouton ; une scène à bouton attend le clic.
- ⚠️ **`animation` est une propriété unique.** La règle `.respire` (plus tardive) écrasait
  `.trace` au lieu de s'y ajouter : le trait restait à `stroke-dashoffset:520`, donc
  **invisible**. Le disque du soleil, le bord de l'assiette et la vapeur de la cloche n'ont
  jamais été dessinés jusqu'à ce qu'on les déclare ensemble.
- ⚠️ **Pas d'`aspect-ratio:1/1` sur une case de calendrier.** Une case carrée fait ici ~124 px
  de large : sept rangées poussaient « 5 repas planifiés sur 21 » — la phrase qui donne son
  sens à l'écran — à deux écrans de défilement. Hauteur fixe (55 px dans la séquence, 54 px
  dans le panneau clair), mesurée à l'écran.
- Une photo qui n'arrive pas laisse l'icône cassée du navigateur **au milieu du calendrier** :
  `vignette()`/`brancherVignettes()` reposent l'emoji à la place. Le test `complete &&
  !naturalWidth` couvre l'échec survenu **avant** qu'on écoute l'événement `error`.

**Deux chemins pour régler la semaine**, tous deux dessinés par Pablo : les trois
interrupteurs globaux (« Valider »), ou **jour par jour** (`scJours`) — chevron de retour, sept
traits de progression, carte du jour avec ses trois segments « Je prépare / J'achète », et
« Tout voir d'un coup » qui bascule sur la grille 7 × 3 (`scGrille`). Les trois vues écrivent
le même tableau `etat.prepare`.
> ⚠️ **UNE scène pour les sept jours, pas sept scènes.** Repasser par `scene()` à chaque jour
> rejouerait aussi l'entrée de la barre d'action : « Valider » clignoterait sept fois pour un
> bouton qui, lui, ne bouge pas. Seule la carte est repeinte, et la sortante passe en
> `position:absolute` le temps de croiser l'entrante — sinon la hauteur du bloc saute.

**La semaine se coche toute seule.** Un créneau planifié qui a reçu son repas passe au vert
(anneau + pastille) dans les deux calendriers, et l'en-tête du panneau dit « 3 repas sur 5 déjà
faits ». Un repas enregistré **hors** du plan laisse un point discret : il a eu lieu, mais il ne
valide rien de prévu — sans lui, une semaine bien suivie hors plan aurait l'air d'une semaine
vide.
> ⚠️ **Aucun drapeau `fait` n'est stocké.** Un drapeau se pose depuis un écran, à un instant :
> il rate ce qui est enregistré ailleurs (ancien parcours de `suivi.html`, autre appareil,
> admin) et il dérive dès qu'un repas est supprimé. `realises()` relit `meals` depuis le lundi
> et range par (jour × créneau) — la question a déjà sa réponse en base, et cette réponse ne
> ment pas. Le module écoute `natty:repas-ajoute` (émis sur **`window`**, contrairement à
> `natty:conseils-prets` / `natty:planning-pret` qui passent par `document`) et se recalcule ;
> l'écran hôte n'a rien à faire.

**La carte « Ma semaine » est NOIRE et petite** (`--metal-black`, comme le panneau qui existait
déjà dans `repas.html`). ⚠️ **Les jours sont en COLONNES, les créneaux en lignes** : la première
version faisait l'inverse, sept rangées, une carte plus haute que le repas du jour lui-même —
alors qu'on ne vient pas sur cet écran pour lire un planning. Trois lignes suffisent, la semaine
tient en ~115 px, et c'est la grammaire d'un calendrier Apple : petit, dense, muet tant qu'on ne
le touche pas. La fiche `detail()` est noire elle aussi : tout ce qui touche à la planification
l'est.

**Dans `repas.html`** : `#planWrap` vit **hors** de `#content`, que `render()` remplace en
entier — à l'intérieur, le calendrier disparaîtrait au premier tap sur une vignette. Taper une
case pleine ouvre la recette dans le hero si c'en est une, sinon la fiche `detail()` du module
(un plat macro n'existe nulle part ailleurs dans l'app, il est né de la planification). Le
panneau qui listait les recettes s'appelle désormais **« Recettes conseillées »** : deux titres
« Ma semaine » pour deux contenus différents faisaient passer l'un pour l'autre.

### `assets/journee.js` — « Ma journée », le guide cinématique des étapes du jour
Plein écran noir qui s'invite à la **première ouverture de la journée**, puis à chaque
**moment clé** (un repas qui commence, le palier du soir). Il montre la journée en **arc de
jalons** — l'heure et l'étape — qui **défile de droite à gauche** : ce qui vient arrive par la
droite, passe au sommet quand c'est son heure, sort par la gauche une fois fait. Chargé par
`menu.html`/`www/index.html` (version longue) et par `suivi.html` et `repas.html` (version
courte). Dépend d'`assets/core.js` ; utilise `creneaux.js`, `planning.js`, `ajout.js` et
`nav.js` s'ils sont là.

**Composition, reprise d'une maquette fournie par Pablo** (arc de pastilles, gros titre) et
**traduite dans la DA Natty** : le dégradé rose de la maquette devient une **lueur** derrière
l'arc — même composition, où la lumière remplace la couleur.

⚠️ **IL SUIT LE THÈME**, contrairement aux autres cinématiques de l'app (§5) — demandé
explicitement le 9 août 2026. Toutes les couleurs passent par des jetons **`--j-*`** déclarés
sur `#njour`, et le clair ne redéfinit **que les jetons** : il n'y a qu'un seul jeu de règles.
Sans ça, chaque retouche serait à faire deux fois et l'un des deux thèmes finirait par diverger
sans que personne ne s'en aperçoive — exactement ce qui est arrivé aux ombres neumorphiques de
`suivi.html` (§7). Les jetons `--nt-*` d'`assets/theme.js` ne suffisent pas ici : cet écran a
des besoins qui n'existent nulle part ailleurs (une lueur, un creux sur fond noir, un relief de
pastille).

**Ce qu'il y a DANS les bulles** (9 août 2026) — la **photo détourée du plat prévu** à ce
créneau quand la planification en a un, l'illustration au trait sinon. Chaque bulle porte celle
de SON étape, y compris celles à venir : le « + » de la maquette d'origine ne disait rien de ce
qui vient, alors qu'on regarde cet écran pour voir sa journée, pas une file d'attente.
⚠️ `object-fit:contain`, jamais `cover` : le sujet est détouré, et un plat rogné aux bords dans
une pastille de 62 px ne se reconnaît plus.
⚠️ **La photo d'un repas MANQUÉ passe en niveaux de gris.** Les jetons de couleur ne l'atteignent
pas : le jalon passait en contour éteint pendant que le plat gardait ses couleurs pleines, donc
le repas le plus appétissant de l'arc était justement celui qu'on n'avait pas noté. Une photo qui n'arrive pas repose son illustration
(`brancherPhoto`), sinon l'icône cassée du navigateur atterrit au milieu de l'arc — à l'endroit
exact que l'écran désigne.

**⚠️ QUATRE SCÈNES, ET UNE SEULE PORTE DU TEXTE** (refonte du 9 août 2026, demande de Pablo :
« beaucoup trop d'éléments et d'information »). La première version montrait tout en même
temps ; la séquence est maintenant :

| # | Scène | Ce qu'il y a dessus |
|---|---|---|
| 1 | `scBonjour` | « Bonjour Prénom ». **Rien d'autre** — pas de date, pas d'arc. 2,2 s |
| 2 | `scArc` | **L'arc seul, aucun texte.** Les jalons faits se cochent en vert, l'arc tourne, le barillet se cale sur l'étape en cours. 3,3 s |
| 3 | `scEtape` | jour + date · l'étape · **le plat en grand** · **un** bouton. C'est la seule scène qui attend |
| 4 | `envol()` | la pastille blanche s'ouvre et prend l'écran → la fonction associée |

Ce qui a été **retiré** de la scène finale et ne doit pas revenir : le libellé d'heure en
kicker, « Étape 2 sur 5 », la phrase explicative, les trois pastilles de macros, le filet, la
devise, et le récapitulatif écrit de la journée. Neuf blocs pour une décision qui en demande
une. Les macros se lisent sur l'écran **Suivi**, qui est fait pour ça.

**Le plat sous le titre** (`.hero`, ajouté le 9 août 2026 à la demande de Pablo) — la **photo
détourée** du repas prévu, ou l'illustration au trait de l'étape quand il n'y en a pas, en
156 px sous le nom du créneau. C'est la même `figure()` que dans la bulle de l'arc : la bulle
dit **quand**, celle-ci dit **quoi** — dans 62 px on devine un plat, à 156 px on le reconnaît.
Le titre remonte en conséquence (`.zone` : marge de 22 → 12 px), l'arc étant ce qu'il commente.
- ⚠️ **La lueur est le `background` de `.hero`, pas un `::before`.** Un pseudo-élément positionné
  se peint **au-dessus** du contenu non positionné, donc par-dessus la photo ; et le renvoyer
  derrière par `z-index:-1` le fait passer sous le fond de l'écran (`#njour` est en
  `position:fixed`, donc contexte d'empilement), où il ne se voit plus du tout.
- ⚠️ **Le trait s'affine quand l'illustration grandit** : la boîte SVG fait 24 unités, donc à
  156 px un `stroke-width:1` se peint en **6,5 px** — un gros feutre, là où l'arc trace des
  filets de 2 px. `0.5` rend ~3 px.

**Le barillet** (`.rou`) — deux illustrations empilées dans une fenêtre qui les rogne,
l'ancienne puis la sienne, avec un léger dépassement avant de revenir : c'est ce « cran » de
sélecteur iOS qui montre le passage à l'étape suivante. Un simple fondu ne le donne pas.
⚠️ La fenêtre est un élément **interne** (`.ic`) : rogner sur `.jal` emporterait l'anneau de
pulsation, qui déborde volontairement.
⚠️ **LE SENS EST CONTRE-INTUITIF, ET IL A ÉTÉ ÉCRIT À L'ENVERS.** `.rou` fait 200 % de haut,
ses deux cases 50 % chacune : à `translateY(0)` c'est la case du HAUT — l'étape **précédente** —
qu'on voit. Le barillet part donc de `0` et roule vers `−50 %`. L'inverse était en place, et le
résultat se voit sur la capture qu'a envoyée Pablo : la bulle du dîner affichait la **coche du
déjeuner**. Vérifié après correction : transform final `translateY(−62px)`.

**Le V vert** (`.vok`) — anneau puis coche, deux tracés décalés, `#34c759`. Même recette que
`.vok` d'`assets/planning.js`, en petit.
⚠️ **Le contenu d'un jalon n'est réécrit que si son rôle change** (`data-role`). `peindreArc()`
tourne à chaque scène ; réécrire à chaque fois relançait le tracé du V et le cran du barillet —
une validation qui se rejoue en boucle ne valide plus rien.

**L'envol, et le piège de la caméra.** ⚠️ `sync` n'est pas un détail : `NattyAjout.start()`
ouvre la caméra, et iOS ne l'accepte que si l'appel part du geste de l'utilisateur, **dans la
même pile**. Retarder de 380 ms pour faire joli, c'est une caméra qui ne s'ouvre plus. Les
étapes qui appellent `NattyAjout` portent donc `sync: true` et partent tout de suite,
l'animation se jouant par-dessus ; celles qui ne font que naviguer attendent la fin du
mouvement. Vérifié au banc : appel à **< 20 ms** pour « Ajouter mon plat », navigation
**différée** pour « Suivre la recette ».

**L'en-tête de `menu.html` — LE MÊME ÉCRAN, EN PLUS PETIT** (refonte du 9 août 2026 : « garder
exactement la même présentation, il ne doit pas y avoir de différence de style »).
`monterBandeau(hote)` pose en tête de `.wrap` la composition de la scène 3 — arc et jalons, jour
et date, nom de l'étape, plat en dessous — réduite d'un coup par **une seule mise à l'échelle**
(`--njb-k`, 0,58). Un tap ouvre le guide en version courte.
- ⚠️ **C'est une échelle, PAS des tailles refaites.** La version précédente redessinait tout en
  petit — arc plat de 78 px, points de 19 à 34 px, date à gauche et compteur à droite, titre en
  15,5 px — donc deux présentations à tenir à jour, et deux qui divergent. Le bandeau porte
  maintenant la classe **`njsk`**, celle qui définit le style du guide : toucher au guide
  retouche le bandeau, forcément. C'est aussi pourquoi `css()` (la feuille du guide) est appelée
  par `monterBandeau` — sans elle, un en-tête sans arc, sans jalons et sans typographie.
- ⚠️ **`njsk` porte aussi les jetons `--j-*`**, qui ont déjà leur pendant clair
  (`:root[data-theme="light"] .njsk`) : l'en-tête suit donc le thème de la page sans rien faire
  de particulier. Les `--nt-*` d'`assets/theme.js` ne sont plus utilisés ici.
- ⚠️ **Le bloc mis à l'échelle est en `position:absolute`, et la hauteur du bouton est MESURÉE**
  (`offsetHeight × k`, qui ignore les transformations). Une mise à l'échelle ne libère pas de
  place dans le flux — même piège que l'arc du guide sur petit écran : laissé en flux, il
  occuperait sa hauteur pleine et l'accueil commencerait ~200 px trop bas.
- ⚠️ **Journée bouclée = aucun jalon « en cours ».** `courante()` rend la dernière étape faute de
  mieux ; sans ce test, le bandeau posait une pastille pleine « c'est maintenant » sur une étape
  déjà cochée. D'où le 4ᵉ argument `sansActif` de `peindreArcDans()`.

**Il n'invente aucune donnée**, et c'est ce qui le rend utilisable :

| Ce qu'il affiche | D'où ça vient |
|---|---|
| les créneaux, leurs heures, ce qu'il RESTE à manger | `NattyCreneaux` |
| la semaine planifiée, le repas prévu aujourd'hui | `NattyPlanning.lire()` |
| défi / suivi déjà ouverts aujourd'hui | `NattyNav.vuAujourdhui()` |

⚠️ **Aucun drapeau « étape faite » n'est stocké** — même raison que `realises()` de
`planning.js` : un drapeau posé depuis un écran rate ce qui se passe ailleurs et dérive dès
qu'un repas est supprimé. La question a déjà sa réponse en base.

**Le déroulé** : `[Planifier ma semaine]` → les créneaux de repas → `Le palier du jour` (20 h 30)
→ `Le point du soir` (21 h 30). Le palier avant le bilan : on apprend quelque chose, **puis** on
regarde sa journée — l'inverse ferait du bilan une étape de passage avant un jeu.
- **L'action de chaque repas s'adapte** : une recette prévue au plan se **prépare**
  (« Suivre la recette ») ; sinon on **note** (`NattyAjout.start()`). **Un seul bouton d'action**,
  plus « Plus tard » en discret : le « J'ai mangé autre chose » de la première version faisait un
  troisième choix à trancher pour un cas de bord, alors que le `+` de la nav est toujours là.
- **Les heures annoncées ne sont pas les bornes des créneaux** (`HEURE_TYPE`) : le midi s'ouvre
  à 11 h pour *ranger* un repas, mais annoncer « 11 h · Déjeuner » ferait passer le guide pour un
  réveil mal réglé.
- ⚠️ **L'étape « Planifier » n'a pas d'heure** (`libelle: 'D'abord'`). Placée à 8 h comme le
  petit déjeuner, elle donnait **deux jalons marqués « 8 h » côte à côte** dans l'arc.
- ⚠️ **Elle n'apparaît QUE si `planning.js` est chargé.** Sans lui, `plan` vaut `null` parce
  qu'on n'a pas regardé, pas parce que la semaine n'est pas planifiée — d'où le chargement de
  `planning.js` dans `suivi.html`, **pour être lu et non pour se déclencher**.
- Une étape passée de plus de 2 h 30 n'est plus « celle du moment » (proposer de noter son petit
  déjeuner à 15 h, c'est parler d'autre chose), mais elle **reste visible, non cochée** : un
  manque montré vaut mieux qu'un manque effacé.

**Deux versions, et c'est la décision d'UX centrale.** La longue (les scènes 1 → 2 → 3) une
fois par jour ; la **courte** (l'arc déjà calé, directement la scène 3) aux moments clés —
quelqu'un qui arrive à 12 h 40 pour noter son déjeuner n'a pas à regarder trois plans avant de
pouvoir le faire.
Mémoire : `natty_journee_vu_<uid>` (le jour) et `natty_journee_etape_<uid>` (`jour|étape`).

⚠️ **Le déclencheur attend 6,5 s, contre 5 s pour `planning.js`** : si la semaine n'est pas
planifiée, c'est SA séquence qui doit s'ouvrir. Le module regarde l'écran avant de s'y poser
(`#nplan`, `#nattyAjout`, `NattyGeneration.enCours()`) — deux plein écran l'un sur l'autre ne se
discutent pas.

**⚠️ LES QUATRE FAUX RACCORDS DE LA SÉQUENCE** (corrigés en août 2026, demande de Pablo :
« les animations du guide ne sont pas fluides, les éléments doivent être au même endroit lors de
l'animation et lors du visuel »). Aucun n'était visible à la lecture du code ; tous se mesurent
en comparant la position d'un élément d'une scène à l'autre.

| Ce qui sautait | Pourquoi | Ce qui le remplace |
|---|---|---|
| **L'arc, à chaque scène** — 105 px d'écart entre la 1ʳᵉ et la 3ᵉ, mesuré à 375 × 812 | `.col` était en `justify-content:center` : le groupe arc + texte se recentrait, or le bloc de texte n'a pas la même hauteur d'une scène à l'autre (rien, puis rien du tout, puis ~260 px) | `justify-content:flex-start` et une marge haute FIXE sur `.arc`. C'est le vide qui descend en bas, plus l'arc qui remonte |
| **Le bloc sortant** | Il passait en `bottom:0` + `justify-content:center` : son contenu bondissait au milieu de la zone à l'instant où la sortie commençait | Épinglé en `top:0`, il reste où il était et se contente de partir |
| **Toute la composition, encore** | `col.style.paddingBottom` était réécrit à chaque scène et RETOMBAIT à 14 px sur celles sans bouton | La réserve ne redescend jamais : on ne l'augmente que si les boutons l'exigent |
| **Les jalons, au montage** | Sans position inline, ils naissent empilés au coin haut-gauche : la première `peindreArc()` les faisait voler depuis ce coin | `monterArc(hote, cur)` les pose sous `.pose` (transitions coupées), force le calcul, puis rend les transitions |

Deux détails de la même famille : le **voile du bas** (`#njCta`) grandissait d'un coup à
l'arrivée des boutons — il a maintenant une `min-height` constante, égale à la réserve de
`.col` ; et le **tracé de l'orbite** se jouait pendant la scène « bonjour », où l'arc est encore
à `opacity:0` — il n'est armé que sous `.arcvu` (et directement dans le bandeau).

**⚠️ L'ÉCHELLE DU BANDEAU S'ADAPTE À LA PLACE QUI RESTE** (`ajusterBandeau`), au lieu d'être
figée à 0,58. Demande de Pablo : « pour le menu, tous les éléments doivent être accessibles sans
scroll ». À 0,58 le bandeau faisait 284 px et l'accueil débordait de 63 px sous la barre
d'onglets à 375 × 812 — et d'une centaine de plus sur un téléphone à encoche, dont les zones
sûres mangent le haut ET le bas. Aucune constante ne pouvait tenir sur tous les gabarits.
- On MESURE : la position du bandeau (donc l'encoche), la hauteur des blocs qui le suivent
  **marges comprises** (`getBoundingClientRect()` ne les inclut pas — il manquait 24 px, et
  l'accueil dépassait encore de 14 px), et la barre d'onglets si elle est là.
- En dessous de **0,34**, on cesse de tout rapetisser et on **retire le plat en grand** : il fait
  le tiers de la composition, et à cette échelle il ne dépasse plus la bulle du moment, qui le
  montre déjà. Sans lui, l'arc et le titre restent lisibles là où les trois ne l'étaient plus.
- ⚠️ **La mesure repart TOUJOURS de la composition complète.** Sans remettre le plat avant de
  mesurer, `H` valait encore la hauteur réduite de la fois d'avant : en passant d'un petit écran
  à un grand, le bandeau se retrouvait coupé d'une centaine de pixels. Attrapé en
  redimensionnant, pas en lisant le code.
- Mesuré : 375 × 812 → 0,448 ; 390 × 844 → 0,483 ; 430 × 932 → 0,58 (le maximum, rien à
  rogner) ; 375 × 667 → 0,26 sans le plat. Dans les quatre cas le bas de l'accueil passe
  au-dessus de la barre d'onglets.

**Pièges de mise en page, tous trouvés à l'écran et aucun par `node --check` :**
- ⚠️ **Le sommet de l'arc est à −90°, pas −98.** Décalée de 8°, la pastille du moment tombait à
  41 % de la largeur : tout l'écran — date, titre, bouton — est centré, elle seule ne l'était
  pas, et ça se voit. Rayon resserré (230 → 186) et pas ouvert (17 → 21) pour que l'arc se lise
  comme un morceau de **cercle** et non comme une ligne à peine courbée.
- ⚠️ **`justify-content:center` sur la colonne.** Le contenu tient en quatre lignes ; aligné en
  haut, il laissait l'arc collé au bord supérieur avec la moitié de l'écran vide en dessous.
- ⚠️ **La lueur est centrée sur l'ARC** (≈ 37 % de la hauteur). À `top:-22%` son foyer tombait à
  27 %, donc au-dessus des jalons : on voyait une tache lumineuse, et plus bas un arc éteint.
- ⚠️ **Le texte se pose SOUS l'arc, il ne se centre pas dans ce qui reste.** Avec `flex:1`, la
  zone absorbait toute la hauteur libre et le titre partait au milieu de l'écran, à 300 px de
  l'arc : deux blocs qui ne se parlaient plus. Une fois le contenu réduit à quatre lignes, c'est
  le **vide** qui descend en bas, pas le texte.
- ⚠️ **L'arc n'est PAS remplacé d'une scène à l'autre** — contrairement à `planning.js`, il est
  le fil de la séquence. Seul le bloc de texte sous lui est échangé, et le **bloc sortant passe
  en `position:absolute`** le temps de croiser l'entrant, sinon la page fait un bond.
- ⚠️ **`transform:scale()` ne libère pas de place dans le flux.** L'arc réduit à `.92` sur petit
  écran continuait d'occuper ses 224 px pour n'en montrer que 206 : ces 18 px poussaient la
  dernière ligne du texte **sous le bouton**. La marge négative rend exactement ce que l'échelle
  a libéré.
- ⚠️ **La place réservée en bas se MESURE**, elle ne se devine pas : figée à 146 px elle suffit à
  deux boutons, pas à trois (~195 px). Et on ne dégage que le **premier bouton**, pas la barre
  entière — son tiers haut est un dégradé transparent.
- ⚠️ **Le trait de l'orbite s'éteint par un masque**, il n'est pas coupé : le cercle qui porte
  les jalons a un rayon de 230 px, ses extrémités descendaient barrer le grand titre. Un
  `overflow:hidden` l'aurait tranché net, ce qui se voit encore plus.

### `assets/bilan.js` — le récap du soir, et celui du samedi
Plein écran qui raconte la journée qui vient de se passer : ce qui a été mangé, ce que la
personne en pense (trois questions), ce que les chiffres en disent (quatre critères), ce que
son corps en a fait, et où elle en est depuis un mois. **Le samedi soir, la même séquence
porte sur les sept jours.** Chargé par les écrans porteurs de la nav (`suivi`, `repas`,
`menu`/`www/index`) + copies `www/`. Dépend d'`assets/core.js` ; utilise `creneaux.js` s'il
est là et sait s'en passer.

**⚠️ IL N'INVENTE AUCUN CHIFFRE, et c'est ce qui a dessiné l'écran.** Un bilan est l'endroit
de l'app où il serait le plus facile — et le plus grave — d'inventer : « vous avez brûlé
400 g de graisse » est une phrase que personne ne peut vérifier. Deux règles :
- ce qui est **mesuré** vient de `meals` + `meal_ingredients` via `Natty.calcMac`, qui préfère
  les macros écrites à la table (règle 12) ;
- ce qui est **estimé** — muscle, graisse — est annoncé comme tel, à l'écran, avec son modèle
  en une ligne. D'où des **grammes et pas des kilos** : le gain de muscle plafonne vers 0,5 %
  du poids par **semaine**, donc quelques dizaines de grammes par jour. « 0,03 kg » aurait été
  techniquement juste et pratiquement illisible.
- ⚠️ **Un jour non noté n'est pas un jour à zéro.** Il casse la courbe au lieu de la faire
  plonger, et il est compté à part dans les moyennes (« moyenne sur 5 jours notés »). Le
  compter 0 ferait passer une semaine mal journalisée pour une semaine de jeûne.

**Les quatre critères** (`QUATRE`) — régularité, intensité, variété, équilibre. Chacun compare
le jour à ce qui est attendu de LUI (créneaux prévus, cible du jour, aliments distincts,
répartition des macros), jamais à une norme extérieure. `noteRatio()` pénalise un dépassement
plus qu'un manque, comme le score du fil social.

**Le déclencheur** (`proposerSiNecessaire`) attend **9 s**, contre 6,5 pour `journee.js` et 5
pour `planning.js` : quand plusieurs sont dus, le guide du jour passe devant, et le bilan
renonce en voyant son écran (`#nplan`, `#njour`, `#nattyAjout`, `#ndec`, génération en cours).
Le bilan du **jour** à partir de 21 h, une fois par jour (`natty_bilan_vu_<uid>`) ; celui de la
**semaine** le samedi, une fois par semaine (`natty_bilan_vusem_<uid>`).
> ⚠️ **Le bilan de la semaine marque AUSSI la journée comme faite.** Sans ça, le samedi soir :
> la semaine s'ouvre (elle passe avant), `vusem` est écrit, `vu` ne l'est pas — et à la
> réouverture suivante, le même soir, le bilan du JOUR s'invitait dans la foulée. Ce que ça
> coûte, et c'est assumé : les trois questions ne sont pas posées le samedi.

**⚠️ LE PARE-FEU CSS, et pourquoi il existe.** Ce module s'invite sur des pages qui ont leur
propre feuille, et ses classes internes sont volontairement courtes — `.st`, `.v`, `.n`,
`.bar`, `.d`, `.j`… soit des noms que n'importe quelle page peut avoir déjà pris. Relevé sur
les écrans porteurs : `suivi.html` a `.em`, `repas.html` `.v` et `.em`, `social.html` `.st`,
`.n`, `.v`. **Aucun ne nous atteint** — tous sont des sélecteurs de *descendance*
(`.pf-stats .st`) dont l'ancêtre n'existe pas ici. Mais ça ne tient que par chance : le jour
où quelqu'un écrit `.st{}` nu, le bilan se déforme sur cette page-là et rien ne le signale.
D'où `#nbil *{margin:0;padding:0;border:0}` — (1,0,0) bat toute classe nue (0,1,0), pendant
que les règles du module, au moins (1,1,0), le battent lui. Vérifié : le module ne pose aucune
balise à marge native (ni `p`, ni titre, ni liste), la remise à zéro ne lui coûte rien.

**Trois défauts trouvés à l'écran, aucun par `node --check` :**
- ⚠️⚠️ **Les barres de la semaine étaient COMPRIMÉES.** Élément flex dans une piste de hauteur
  fixe (`.sem{height:132px}`), elles cédaient la place aux étiquettes du haut et du bas :
  mesuré, des hauteurs calculées à **115, 116, 117 et 118 px se peignaient toutes à 96**. Six
  jours rigoureusement identiques, dans le seul écran qui sert à les comparer. Il faut les
  **deux** correctifs — `height:auto` (+ `min-height`) sur la piste et `flex:0 0 auto` sur la
  barre. Même famille que le cadre photo d'`ajout.js` : **une hauteur demandée ne survit pas à
  une compression flex.**
- ⚠️ **Le « trait de dépense » était annoncé sans être dessiné.** La phrase du bas disait
  « trait de dépense à 2800 kcal » sous un graphique où aucun trait n'existait — on cherchait
  à l'écran une référence promise par le texte. Il est maintenant tracé, **position mesurée**
  (le bas réel des barres) et non déduite : elle dépend de la hauteur de la lettre du jour,
  donc des métriques de la police et pas d'une constante. En pointillé, **derrière** les
  barres, pour qu'une journée qui le dépasse se lise comme telle.
- ⚠️ Le plan sortant porte `pointer-events:none` (`#nbil .bloc.sort`) : sans lui, un tap rapide
  pendant le fondu atteint un bouton déjà périmé — le chevauchement connu de `narration.html`.

**Persistance** : table `bilan_jour` (`natty_bilan.sql`, §4). Tant qu'elle n'existe pas les
réponses vivent dans le `localStorage` de l'appareil, et le dernier écran **le dit** plutôt que
de laisser croire à une synchronisation qui n'a pas lieu (même parti pris qu'`assets/planning.js`).

**Le guide du jour y mène** : l'étape « Le point du soir » d'`assets/journee.js` ouvre le bilan
au lieu de renvoyer sur Suivi — l'étape faisait le point en le laissant à faire. Repli sur
`suivi.html` si le module n'est pas chargé, et `fait` relit la clé qu'écrit le bilan, pas
l'onglet Suivi (ouvrir Suivi ne fait pas le point du soir).

⚠️ **Banc à horloge pilotée obligatoire.** Un lundi, la semaine en cours ne contient qu'un
jour : l'écran à sept est alors **intestable**, et on conclut à tort que le graphique est
cassé. Le banc remplace `Date` lui-même, avant tout le reste, pour que la doublure des repas,
`core.js` et `bilan.js` lisent la même heure.

### `assets/theme.js` — le thème clair / sombre
Chargé **dans le `<head>`, de façon synchrone**, par tous les écrans de l'app
(les six porteurs de la nav, plus `login`, `onboarding`, `questionnaire-alim`,
`chat`, `offre` et les trois pages légales). C'est la seule chose qui compte
ici : `assets/core.js` est en fin de `<body>`, donc trop tard — un thème posé
après le premier rendu donne un **éclair blanc à chaque changement d'écran**,
et sur une app plein écran ça se lit comme un flash, pas comme une transition.
L'attribut est posé sur `<html>` (`data-theme="dark"|"light"`), jamais sur
`<body>` : `<html>` est peint avant que `<body>` n'existe.

**Trois états, pas deux** : `auto` (défaut — suit le téléphone, et le suit
**en direct** via `matchMedia`, donc la bascule au coucher du soleil se voit
sans relancer l'app), `clair`, `sombre`. **L'interrupteur des réglages n'en
montre que deux, et c'est voulu** : il affiche ce qui est *à l'écran
maintenant*, et le premier geste fige le choix. Le sous-titre dit laquelle des
deux situations on lit — « Suit le réglage de votre téléphone (actuellement
sombre) » ou « Fond sombre sur tous les écrans ».

La préférence vit en `localStorage`, **donc par appareil**, et c'est le bon
endroit : un thème est un réglage d'affichage. Le stocker en base le ferait
voyager d'un téléphone à l'autre alors que l'écran, la luminosité de la pièce
et l'heure d'usage, eux, ne voyagent pas.

**API** — `NattyTheme.preference()` (ce qui est enregistré), `.actuel()` /
`.sombre()` (ce qui est affiché), `.definir(p)`, `.basculer()`. L'événement
`natty:theme` est émis sur `document` à chaque changement : `profil.html`
s'en sert pour que son interrupteur ne mente pas quand le téléphone bascule
pendant que la feuille est ouverte.

**Deux choses de plus, faciles à oublier :**
- `<meta name="theme-color">` est réécrit. Sans ça l'app passe en sombre et
  **garde un bandeau blanc en haut** — c'est la première chose qu'on voit.
- `documentElement.style.colorScheme` est posé, ce qui fait basculer les
  contrôles **natifs** (champs, `<select>`, barres de défilement). Sans lui,
  le sélecteur d'heure des rappels reste blanc au milieu d'un écran sombre.

**Jetons `--nt-*`** — `theme.js` injecte aussi une petite feuille définissant
`--nt-bg`, `--nt-card`, `--nt-ink`, `--nt-on-ink`, `--nt-muted`, `--nt-line`,
`--nt-ombre`, `--nt-voile`. C'est pour les **modules injectés** (`nav.js`,
`core.js`/`Natty.confirmer`, `generation.js`) : ils s'invitent aussi bien sur
`assets/style.css` que sur `suivi.html`, qui a son propre jeu de variables
plus ancien où `--bg` ne vaut pas la même chose. Il leur faut donc des jetons
à eux, valables partout, sans collision. `theme.js` est le seul fichier que
**toutes** les pages chargent — d'où la feuille écrite en JS et non en `.css`.

**Modules déjà sombres par construction** — `ajout.js`, `planning.js`,
`macros-cal.js` n'ont rien eu à changer : leurs écrans sont noirs dans les
deux thèmes, par choix de mise en scène. Ne pas « corriger » leurs `#fff`.

### ⚠️ « Quel jour sommes-nous » — `Natty.jour()`, jamais `toISOString()`
Corrigé le 2026-08-05, signalé par Pablo (« les macros de suivi doivent se
réinitialiser à 00 h »). `new Date().toISOString().split('T')[0]` convertit en
**UTC** : entre 00 h et 02 h à Paris, il rend **la veille**. Conséquences mesurées :
- les macros du jour basculaient à **02 h** (1 h en hiver), pas à minuit ;
- un repas ajouté à 00 h 30 était **compté sur la journée précédente** — son
  `meal_date` était écrit en UTC, et `estDuJour()` comparait `created_at` en
  préfixe de chaîne, donc en UTC lui aussi ;
- le lundi de la semaine partait au dimanche, d'où la divergence de clé avec
  `assets/liste.js` (qui doit encore lire l'union des deux).

Le piège vivait dans **neuf** endroits de `suivi.html` et dans `assets/ajout.js`.
D'où un point de vérité unique : **`Natty.jour(d)`** (date locale) et
**`Natty.aMinuit(fn)`** dans `assets/core.js`.

⚠️ **Un contrôle au chargement ne suffit pas** : l'app reste ouverte, et
`resetIfNewDay()` ne tournait qu'à l'`init()`. On pouvait donc lire « 1 800 kcal »
à 00 h 05 sur une journée vide. `Natty.aMinuit()` arme un minuteur sur le prochain
minuit **local**, à 00:00:02 (à la seconde pile, `jour()` peut encore rendre la
veille selon l'arrondi de l'horloge).
⚠️ **Et le minuteur seul ne suffit pas non plus** : un téléphone en veille ne
l'exécute pas à l'heure. On réarme donc aussi sur `visibilitychange` — la bascule
se voit au plus tard en rouvrant l'app. `nouvelleJournee()` est **idempotente**
(`resetIfNewDay()` compare la date enregistrée à celle du jour), donc les trois
déclencheurs — minuit, retour à l'écran, rechargement — ne peuvent pas archiver
deux fois la même journée dans `daily_macros`. Vérifié.

### `assets/notifs.js` — le rappel quotidien (notifications **locales**)
Chargé par les cinq écrans porteurs de la nav (`suivi`, `repas`, `menu`/`www/index`, `social`,
`coaching`, `profil`) juste avant `assets/nav.js`. Hors application native, le module se charge
et ne fait rien : `dispo()` renvoie `false`, toutes les actions sont des no-op.

**Locales, pas push** — tout est planifié sur l'appareil : aucune clé Apple, aucun serveur,
aucune table de tokens. La contrepartie est que le texte est figé au moment de la planification.
« Il te reste 40 g de protéines » ou « un ami a ajouté un plat » exigent un calcul à l'envoi ou
un déclencheur venu d'un autre appareil : **ceux-là relèvent du push serveur**, chantier séparé.

**DEUX rendez-vous par jour** (le second ajouté le 2026-08-05, demande de Pablo) :
- **midi**, ids 4201..4207 — « Vos performances / Ajoutez votre premier plat de la
  journée », mène à `suivi.html` où vit le bouton `+`. Heure **fixe** : midi est le
  moment où l'on a déjeuné sans forcément l'avoir noté, ce n'est pas un réglage de
  plus à ajouter aux réglages ;
- **le soir** (19 h par défaut, réglable), ids 4101..4107 — le palier du parcours.
> ⚠️ **Deux séries d'ids, et `annuler()` doit couvrir les deux.** N'annuler que la
> première laisserait les rappels de midi de la planification précédente s'empiler
> avec les nouveaux — le « tout annuler puis tout replanifier » ne protège que ce
> qu'il connaît.
> ⚠️ **Le créneau du jour saute si un repas est déjà noté**, via le marqueur
> `natty_dernier_repas_<uid>` qu'écrit `assets/ajout.js` à l'enregistrement : une
> notification locale porte un texte figé dès la planification, elle ne peut rien
> vérifier à l'envoi — c'est donc au moment de l'écriture que l'information existe.
> ⚠️ **Les deux fichiers doivent dériver la clé de la même façon**, repli `'anon'`
> compris. Attrapé au banc : `ajout.js` écrivait sous `…_null` quand `USER_ID` était
> absent, pendant que `notifs.js` lisait `…_anon` — le saut n'aurait jamais eu lieu.
> Et l'invitation à activer annonce bien **les deux** rappels : promettre « rien
> d'autre » puis en envoyer deux serait un mensonge, et c'est la seule occasion de
> demander la permission sur iOS.

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

### `assets/push.js` + `api/_apns.js` — les notifications **push** (serveur)
Ce que `assets/notifs.js` ne peut pas faire. Une notification locale est figée au moment où on
la planifie : « il te reste 40 g de protéines » suppose un calcul à l'instant de l'envoi, et
« un ami a ajouté un plat » est déclenché depuis **un autre appareil**. D'où un envoi serveur.

**Côté appareil** — `assets/push.js` (chargé partout où `notifs.js` l'est, juste après) ne fait
qu'une chose : obtenir le jeton APNs et le déposer dans `appareils`. Il **ne demande jamais
d'autorisation** : sur iOS, push et notifications locales partagent la même, donc si
`notifs.js` l'a obtenue `register()` passe sans redemander — vérifié sur simulateur
(`permission push: granted` sans 2ᵉ dialogue). Le tap suit la même liste blanche de routes que
`notifs.js` : un push est une entrée distante, sa destination ne doit jamais pouvoir sortir de
nos écrans.

**Côté serveur** — `api/_apns.js` (module partagé ; Vercel ignore les fichiers d'`api/`
préfixés `_`) :
- **`http2`, pas `fetch`** : l'API provider d'Apple n'accepte que HTTP/2, qu'undici ne parle pas
  par défaut. Donc **runtime Node obligatoire, jamais edge**, dans tous les endpoints push.
- JWT **ES256** signé avec la clé `.p8`, mis en cache ~50 min (Apple refuse un jeton régénéré
  trop souvent, et un jeton de plus d'une heure). Signature via
  `crypto.sign(…, { dsaEncoding: 'ieee-p1363' })` : **sans ce réglage** Node produit du DER et
  Apple répond un laconique **403**. Vérifié : signature de 64 octets, r|s brut.
- Un `410 Unregistered` / `400 BadDeviceToken` **désactive le jeton en base** — sinon on le
  repaie à chaque envoi.

**Trois endpoints**, tous derrière `CRON_SECRET` (même garde qu'`api/conseils-hebdo`) :
- **`api/push-test.js`** — le premier endroit où regarder. Sans paramètre il rend compte de la
  configuration ; avec `user_id` ou `token` il envoie et **remonte la réponse brute d'APNs**.
  Son en-tête liste ce que veut dire chaque `reason`.
- **`api/rappel-macros.js`** — le rappel du soir. `?dry=1` calcule sans envoyer.
- **`api/push-amis.js`** — **déclenché par la base** (choix de Pablo, 2026-08-03) : un
  `after insert` sur `meals` appelle l'endpoint via `pg_net` avec l'id du repas, donc la
  notification part dans la foulée au lieu d'attendre un cron. Le mode « relevé depuis le
  dernier passage » (`push_etat`) reste comme filet et pour les tests. Un appel ciblé
  **n'avance pas le curseur** du relevé — sinon le déclencheur ferait sauter au filet
  exactement ce qu'il est censé rattraper. **Respecte `membre_prefs.fil_public` et
  `meals.partage`** : un membre sorti du fil ne déclenche pas plus de notification qu'il
  n'apparaît dans le fil, sinon le réglage mentirait. Un abonné reçoit **une** notification par
  passage, même si trois personnes qu'il suit ont publié.

> ⚠️ **Le secret d'un cron Vercel ne voyage pas là où on croit.** Une entrée `crons` de
> `vercel.json` ne porte ni `?secret=` ni `x-cron-secret` : Vercel envoie
> `Authorization: Bearer $CRON_SECRET` tout seul. `autorise()` lit donc les **trois** formes.
> C'est ce qui manquait à `api/conseils-hebdo` (corrigé) : dès que `CRON_SECRET` est
> configurée, ses 12 crons du lundi repartaient en 401 — invisible, puisque la génération se
> déclenche aussi à l'ouverture de `suivi.html`.

**`api/_nutrition.js` — copie assumée de la table `NT` d'`assets/core.js`.** Le serveur ne peut
pas importer core.js (IIFE navigateur). `daily_macros` ne peut pas servir non plus —
`suivi.html` (`resetIfNewDay`) n'y écrit **que la veille**, au premier lancement du lendemain ;
les totaux du jour ne vivent que dans le localStorage de l'appareil. L'arrondi est fait **par
ingrédient**, comme core.js : sommer puis arrondir une fois serait plus juste mais donnerait un
gramme d'écart avec l'écran. Commande de régénération dans l'en-tête du fichier.

> ⚠️ **CETTE COPIE AVAIT DIVERGÉ, ET C'ÉTAIT UN BUG EN PRODUCTION** (corrigé août 2026). Elle
> portait encore la table de ~60 aliments **et** l'ancien appariement par sous-chaîne
> premier-déclaré-gagnant, alors que `core.js` était passé à 230 aliments et au rapprochement
> mot à mot plus-long-libellé-gagnant. Conséquence : « pomme de terre » tombait sur « pomme »
> (52 kcal au lieu de 77, zéro féculent), « huile olive » sur « huile », « ail » se trouvait
> dans « volaille », et le saucisson n'existait pas. **Le rappel du soir annonçait donc d'autres
> grammes que l'écran** — et c'est l'app qui avait l'air d'avoir tort. Réaligné et vérifié en
> A/B sur 17 cas (dont les quatre pièges ci-dessus) : **0 écart** avec `Natty.getNutri`.
> La leçon est dans l'en-tête du fichier : une copie mécanique ne se signale jamais elle-même
> quand la source bouge.

> ⚠️ **`calcMac` PRÉFÈRE LES MACROS ÉCRITES**, comme côté app, et il faut donc les **demander**.
> `rappel-macros` ne sélectionnait que `name,quantity_g` : une colonne non demandée arrive
> `undefined`, donc « rien d'écrit », donc il retombait en silence sur le filet pour des lignes
> qui portaient la vraie mesure de l'analyse photo. Tout appelant doit sélectionner
> `calories,proteins_g,carbs_g,fats_g`.

> ⚠️ **`onboarding` contient des doublons** (constaté : deux lignes pour le même `user_id`, dont
> une sans `poids` ni `tdee`). Un `limit=1` en attrape une au hasard : `rappel-macros` prend
> donc la première ligne réellement exploitable. À garder en tête partout ailleurs.

### `api/recalc-macros.js` — remplir les macros de l'historique, une fois
Les ~227 premières lignes de `meal_ingredients` ont leurs quatre colonnes de macros à **0** :
chaque écran redevinait avec la table de 60 aliments de `core.js`, d'où « saucisson = 0 kcal ».
La table est élargie et `assets/ajout.js` écrit ces colonnes depuis août 2026, mais
**l'historique ne se corrige pas tout seul** — ses totaux, ses graphiques et les scores du fil
social continuent de sous-compter. Cette route le relit, l'apparie à la table élargie et écrit.

**Côté serveur, et c'était obligé** : depuis l'activation de la RLS, la clé anon ne voit plus une
seule ligne de `meal_ingredients`. Sans `SUPABASE_SERVICE_KEY` la route répondrait « 0 ligne à
corriger » **en ayant l'air d'avoir réussi** — elle refuse donc de tourner si la clé manque.

**DEUX FAÇONS D'AUTORISER L'APPEL**, et la seconde existe parce que **Pablo n'a pas accès à
`CRON_SECRET`** (dit le 2026-08-05) :
1. le secret, via `autorise()` d'`_apns.js` — les trois formes, voir l'encadré des crons ;
2. un **JWT d'équipe de rôle `admin`** dans l'en-tête `x-staff-jwt`, celui que `admin.html`
   détient déjà après connexion Supabase Auth. C'est la voie du bouton, et la seule praticable
   sans le secret.

> ⚠️ **Le rôle est relu dans `staff` AVEC LA CLÉ SERVICE**, pas avec le jeton de l'appelant.
> GoTrue (`/auth/v1/user`) dit *qui* présente le jeton et qu'il n'est pas périmé — il ne dit
> rien du rôle. Lire `staff` avec le jeton de l'appelant laisserait la policy décider de ce
> qu'il voit de sa propre ligne, donc l'appelant décider de son rôle. Réservé à `admin` :
> le recalcul touche les repas de **tous** les membres, ni le chef ni la logistique n'y touchent.

```
GET /api/recalc-macros?secret=<CRON_SECRET>&dry=1      relevé, AUCUNE écriture
GET /api/recalc-macros?secret=<CRON_SECRET>            écrit
GET /api/recalc-macros?secret=<CRON_SECRET>&user_id=…  un seul membre, pour un essai
en-tête x-staff-jwt: <access_token d'un admin>         même chose, sans le secret
```

**Le bouton — `admin.html`, onglet Équipe → « Maintenance › Macros de l'historique ».** Deux
boutons et un rapport lisible (bilan, aliments non reconnus, exemples de ce qui serait écrit).
- **« Écrire » reste verrouillé jusqu'à ce qu'un relevé ait été lu.** La règle « dry-run
  d'abord » ne sert à rien dans un commentaire : le relevé est le seul endroit où l'on voit les
  aliments que la table ne sait pas chiffrer, donc la seule occasion de compléter la table
  **avant** d'écrire des lignes qu'on croirait ensuite traitées. Après écriture il se
  reverrouille — il n'y a plus rien à écrire.
- ⚠️ `appelRecalc()` **lève** au lieu de renvoyer `null` quand la session manque. Un `return
  null` faisait appeler `peindreRecalc(null)`, qui explosait sur `d.bilan` : l'écran affichait
  « Cannot read properties of null » là où le problème était une session expirée. Défaut
  attrapé en navigateur, pas par `node --check`.
- L'onglet Équipe est le seul réservé au rôle admin : c'est pourquoi la carte est là.

**Trois garde-fous, et ce sont eux qui la rendent rejouable** :
1. une ligne qui porte **déjà** une valeur n'est jamais touchée — les mesures venues de
   l'analyse photo valent mieux que la table ;
2. une ligne que la table ne sait pas chiffrer est laissée telle quelle et **remontée** dans
   `non_reconnus`. Écrire des zéros « pour finir le travail » rendrait un manque indiscernable
   d'une mesure à zéro ;
3. une ligne sans grammes est comptée à part : sans quantité, il n'y a rien à calculer.

⚠️ **Faire le `dry=1` d'abord et lire `non_reconnus`.** C'est le seul moyen de connaître la
couverture réelle : la clé anon ne pouvant plus lire la table, les noms réellement présents en
base ne sont **pas connaissables autrement**. Ce qui manque se rajoute dans `assets/core.js`, on
régénère `api/_nutrition.js`, on relance.

Vérifié contre une fausse base, un cas par garde-fou : le chorizo déjà mesuré reste intact, la
« tarte flambée » inconnue reste à zéro et ressort dans `non_reconnus`, la ligne sans grammes est
ignorée, et un **second passage envoie 0 PATCH**.

#### Le premier relevé réel (2026-08-05) — 256 lignes, 65 % de couverture
Pablo a lancé le relevé. **0 ligne déjà chiffrée** (donc tout l'historique sous-comptait),
167 chiffrables, **89 non reconnues** sur 77 noms distincts. Ces 77 noms ont dicté la passe
suivante sur `assets/core.js` — ce ne sont pas des aliments choisis en imaginant ce que les gens
saisissent, ce sont ceux qu'ils ont réellement saisis. Trois causes, dans cet ordre d'importance :

1. ⚠️ **LES LIGATURES `œ` / `æ` NE SONT PAS DES ACCENTS.** `normalize('NFD')` ne les décompose
   pas (ce sont des lettres à part entière en Unicode), donc `[^a-z0-9]` les remplaçait par une
   espace : « bœuf » devenait `b uf`, « Œufs » devenait `ufs`. **Aucun œuf et aucun bœuf n'avait
   donc jamais été reconnu, dans toute l'app** — 7 lignes ici, mais le défaut vivait dans
   `getNutri` depuis le début. Corrigé en traduisant `œ`→`oe` **avant** de retirer la ponctuation.
2. **Singulier / pluriel** : la table dit « courgette », la base dit « Courgettes » ; la table dit
   « epinards », la base dit « Epinard ». 43 des 77 noms.
3. **Aliments réellement absents** : herbes et aromates (persil, basilic, coriandre, ciboulette,
   aneth, gingembre, curry, épices, sel, poivre), légumes manquants, sauces et plats nommés
   (bolognaise, teriyaki, sauce soja, bouillon, potage, nouilles, crêpe, crumble, glace, crème
   pâtissière), et des libellés **volontairement génériques**.

> ⚠️ **DEUX PASSES DANS `getNutri`, ET L'ORDRE EST TOUT L'INTÉRÊT.** La première est l'ancienne,
> mot à mot exact : rien de ce qui correspondait avant ne peut changer de valeur. La seconde ne
> tourne que si la première n'a rien trouvé, et collapse les pluriels des **deux** côtés.
> Collapser en UNE passe aurait été une régression : « pates » et « pate » (le pâté, 320 kcal)
> se réduisent au même mot, et le plus long libellé gagnant, **un pâté de campagne aurait été
> compté comme des pâtes à 131 kcal**. Vérifié en navigateur : « Pate de campagne » → `pate`,
> « Pates » → `pates`.

> **Les libellés génériques sont un choix, pas une négligence.** « Fromage », « Légumes »,
> « Viande », « Sauce », « 1 fruit » reçoivent une moyenne. Une moyenne est critiquable — mais
> l'alternative n'est pas « mieux », c'est **zéro**, qui est faux à coup sûr. Un libellé plus
> précis gagne toujours, la correspondance prenant le plus long : « fromage blanc » passe avant
> « fromage », « viande blanche » avant « viande ».
> Les **fautes de frappe** relevées en base (`steack`, `amendes`, `basilique`, `pouivron`,
> `petits poids`, `poids chiche`, `teriaki`) sont ajoutées comme alias : chacune est
> phonétiquement sans ambiguïté. Les noms vraiment indéchiffrables — **« Marcos en boîte »** et
> **« a »** — restent NON reconnus, et c'est voulu : un manque visible vaut mieux qu'un chiffre
> inventé.

**Mesuré** : 230 aliments (185 avant), **74/77 noms réparés**, et surtout **0 régression** sur
les 30 cas qui fonctionnaient déjà (les 25 exemples du relevé plus les pièges connus). A/B
`core.js` vs `api/_nutrition.js` sur 83 cas × 2 quantités : **0 écart**. Vérifié aussi en
navigateur, `core.js` chargé pour de vrai.
🔄 **Le relevé est donc à relancer** : la couverture doit passer de 65 % à ~97 %.

### `social.html` + `assets/social.js` — le fil social
Onglet « Social » de la nav, **à la place de Coaching** (qui n'est pas supprimé : `coaching.html`
reste accessible par sa carte dans `menu.html`). `social.js` porte les données, `social.html`
le rendu — même découpage que `reco.js` / `repas.html`.

**En haut de l'écran, avant le fil : « Découvrir »** (août 2026) — trois rangées servies par
`assets/decouverte.js` (cuisines du monde, envies, sélection du jour). Elles vivent **hors de
`#fil`** et se rendent **avant** que la moindre requête ne parte : le catalogue est embarqué
dans l'app, le faire patienter derrière le fil c'était cinq secondes d'écran vide sur un
contenu déjà prêt — et il disparaissait complètement quand personne n'avait rien publié,
c'est-à-dire au moment où l'écran avait le plus besoin de quelque chose à montrer. La recherche
fouille les deux : chercher « tofu » et ne rien trouver alors que six plats du monde en
contiennent ferait passer la barre pour cassée.

**Le détail d'un plat — une PHOTO, pas une fiche** (août 2026, demande de Pablo). Taper un
plat n'ouvre plus une page de champs empilés : la photo prend tout l'écran, le nom est posé sur
un **rectangle arrondi noir**, les macros sur **quatre bulles de verre**, et une ligne dit ce que
la base sait du plat sans rien inventer (« Déjeuner de Hélène · 12 août · 6 ingrédients »).
Le reste — la note de score, les ingrédients, les actions — vit dans un **tiroir** qui monte à la
demande (« Voir le détail »), et les pastilles d'ingrédients s'ajoutent aux courses par la même
clé que « Découvrir » et `coaching.html`. Le retour referme d'abord le tiroir : on remonte d'un
cran, on ne saute pas de la fiche au fil d'un seul geste.
- ⚠️ **Le verre des bulles est SOMBRE**, teinté noir sous un liseré clair. Même leçon que la
  visionneuse « Découvrir » : un voile blanc sous du texte blanc n'a de contraste que par
  accident, selon la photo. Le rectangle du titre, lui, est franchement opaque — c'est ce qui
  garantit que le nom se lit sur n'importe laquelle des photos du fil.
- ⚠️ Cette page est **noire dans les deux thèmes**, comme la visionneuse et `assets/ajout.js`.
- Sans ingrédient saisi, le bouton « Tout ajouter » s'éteint et dit « Rien à ajouter » : un
  bouton cliquable qui ne fait rien est pire qu'un bouton éteint.

**Illustrations** — un jeu de tracés (`ILLU`, dans la page) posé sur les titres de section par
`poserIcones()`, plus une grande assiette-globe pour l'état vide et une assiette sous l'emoji
des plats sans photo. Du trait sur `currentColor`, jamais d'aplat : le même dessin sert dans
les deux thèmes, sans pendant à maintenir (règle 33).
> ⚠️ L'assiette de l'état vide porte un couteau et une fourchette, et ce n'est pas décoratif :
> sans eux, le cercle et ses méridiens se lisaient comme un globe surmonté d'ondes wifi
> (constaté à l'écran sur la première version).

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

### `assets/visionneuse.js` — la page plein écran d'un plat
**UNE** page pour tous les plats de l'app, d'où qu'ils viennent : un plat du monde de
« Découvrir » ou le repas qu'un membre a publié dans le fil. Demande de Pablo (août 2026) : les
deux doivent se comporter exactement pareil. Chargée par `social.html` (+ `www/`), **avant**
`decouverte.js`, qui lui délègue son affichage.

> ⚠️ **C'est pour ça qu'il y a UN module et pas deux.** Chaque fois que ce dépôt a laissé deux
> écrans raconter la même chose, ils ont divergé — les ombres de `suivi.html` (§7), l'en-tête
> de `menu.html` (§3), `www/menu.html` (§11). L'appelant fournit des **données**, jamais une
> mise en page : `{items, index, titre, courses, actions, aimer, surVue, surMembre}`.

**La composition**, de haut en bas : la jauge en segments et la barre de retour ; le **HÉROS** —
la photo dans une carte neumorphique arrondie qui occupe **70 % de la hauteur** et sur laquelle
**rien** n'est posé ; puis, SOUS la carte, la bulle **noire** du titre (nom + description) et
les bulles **sombres** des macros (emoji + valeur) ; enfin « Voir les détails », en **texte
gris**, qui fait monter les ingrédients, les étiquettes, la note et les actions.

> ⚠️ **LA PHOTO EST LIBRE, ET C'EST LA RÈGLE QUI COMMANDE TOUT LE RESTE.** Demande de Pablo :
> « le titre et les macros ne doivent pas être au même endroit, la photo du plat doit être
> parfaitement libre ». Ni bulle, ni voile, ni dégradé ne se posent dessus — on voit le plat
> entier, cadré comme le photographe l'a cadré. C'est le prix des 70 % : à 80 %, il n'y avait
> pas la place de descendre le titre et les macros sous la carte.

- ⚠️ **LE FOND SUIT LE THÈME**, contrairement à la version précédente qui était noire dans les
  deux modes. Tout passe par les jetons `--nt-*` d'`assets/theme.js` — le seul fichier que
  toutes les pages chargent, donc le seul endroit d'où un module injecté peut tirer des
  couleurs valables partout.
- ⚠️ **Les bulles, elles, restent sombres dans les deux thèmes.** Elles reposent SUR une photo,
  pas sur l'interface : le contraste d'un voile clair sous du texte blanc ne tient que par
  accident selon l'image. Leçon déjà payée deux fois (la pastille « Vietnam » du phở
  s'affichait vide).
- ⚠️ **Le relief neumorphique ne s'inverse pas en sombre** : un reflet blanc à .9 sur fond noir
  n'est plus un relief, c'est un halo. Il tombe à .04, et c'est l'ombre portée qui creuse
  (`--v-so` / `--v-si`, même règle qu'au §5).
- ⚠️ **`height:70%` fermement, pas `flex:1`.** Les 70 % sont une promesse ; une carte qui se
  compresserait au gré de la longueur du texte ne la tiendrait pas.
- ⚠️ **La diapositive n'a AUCUNE marge verticale**, et c'est ce qui permet d'annoncer 70 %
  honnêtement : un pourcentage se résout sur la boîte de contenu du parent, donc avec 10 px en
  haut et en bas, `height:70%` valait 70 % de 792 px — **68,2 % de l'écran**. Les retraits de
  zone sûre vivent sur les enfants (la jauge en haut, le bouton en bas). Mesuré après :
  **70,0 % exactement** à 375 × 812.
- ⚠️ **Le liseré de la bulle noire n'est pas décoratif** : sur le fond sombre de l'app
  (`#0e0e11`), une bulle noire ne se distingue plus du tout — le bloc du titre se dissolvait
  dans la page.
- ⚠️ **Sous 700 px de haut**, mesuré à 375 × 667, le bloc du bas n'avait que 88 px pour un
  contenu de 113 : la bulle du titre chevauchait les macros. Deux choses cèdent, dans cet
  ordre — la **description** disparaît (elle reste entière dans le tiroir, c'est la ligne dont
  on peut le plus se passer), puis la carte lâche quatre points (66 %). Rogner la photo
  d'abord aurait été trahir la promesse pour du texte lisible ailleurs.
- **Le tap sur la photo avance d'un plat** (« swippable par un simple click »), en plus du
  geste latéral. ⚠️ Il est testé **en dernier** dans le gestionnaire, après tous les boutons :
  posé avant, il avalerait le clic sur « Voir les détails ». Et il relit la position **réelle**
  de la piste plutôt que `INDEX` — celui-ci n'est mis à jour que par l'écouteur de défilement,
  amorti par une rAF, donc un tap qui suit de près un glissement partirait d'une valeur périmée.
- Le geste latéral reste un `scroll-snap-type:x mandatory`, jamais un suivi de pointeur maison
  (voir l'encadré « Tier list » de §7).

**Ce que chaque appelant traduit** — `assets/decouverte.js` transforme un plat du catalogue
(pays en kicker, étiquettes, note, ingrédients, **aucune macro**) ; `social.html` transforme un
plat du fil (auteur en chapeau, description calculée, macros de `Natty.calcMac`, note de score,
j'aime, « Suivre », lien vers le profil, et la **liste de la section d'où l'on vient** pour que
le geste latéral parcoure ce qu'on avait sous les yeux).

### `assets/decouverte.js` — « Découvrir » : 93 plats du monde
Trois rangées **en haut de `social.html`**, plus l'écran qui s'ouvre quand on tape un plat.
Chargé par `social.html` (+ `www/`), avec `assets/liste.js` juste derrière. Dépend
d'`assets/core.js`.

**Le catalogue** — 19 cuisines (Brésil, Chine, Corée, Éthiopie, Géorgie, Grèce, Inde, Iran,
Italie, Japon, Liban, Maroc, Mexique, Pérou, Philippines, Sénégal, Thaïlande, Turquie,
Vietnam), 93 plats, chacun avec sa photo, une description, ses
étiquettes, 5 à 6 **ingrédients clés** et une **note « côté nutrition »**. Les photos viennent
de `design/images menu/` (fournies par Pablo, août 2026), recompressées dans
`assets/img/decouverte/` en deux tailles : `<slug>.jpg` (860 px, q70) pour le plein écran et
`<slug>-t.jpg` (400 px) pour les vignettes — **10,3 Mo au total**, contre 18 Mo de sources.
⚠️ **L'ordre de `CUISINES` est alphabétique par nom de pays français**, et la rangée du haut
de `social.html` le rend tel quel : une cuisine ajoutée à la fin donnerait une rangée triée
« sauf les dernières », ce qui se lit comme un bug.
- ⚠️ **Trois fichiers source sont volontairement écartés**, et il ne faut pas les « rattraper » :
  `ind tandoorie agneau couleur inspi.jpg` (variante colorimétrique du tandoori),
  `thai curry rouge.jpg` (fichier **strictement identique** à `thai curry rouge legume.jpg`) et
  `peru ceviche.jpg` (capture d'une fiche recette, avec le texte incrusté dans l'image).
- ⚠️ **`bre Feijoada.html` et son dossier `bre Feijoada_files/` sont ignorés par git** : c'est
  la sauvegarde complète d'une page web (28 Mo de JS et de CSS d'un site tiers), pas une
  source de design. Seule la photo qu'elle contenait a été extraite, sous le nom
  `bre feijoada.jpg`, et c'est elle qui est versionnée.
  La liste de correspondance nom de fichier → slug vit dans le message du commit
  d'intégration ; les slugs, eux, sont dans `CUISINES`.

> ⚠️ **AUCUNE MACRO N'EST ANNONCÉE, ET C'EST UNE DÉCISION.** Écrire « 620 kcal » sous un pad
> thaï supposerait une recette et des grammages que personne n'a pesés : ce serait un chiffre
> inventé, exactement ce que le reste de l'app refuse (règle 12, et le « un manque visible vaut
> mieux qu'un total silencieusement faux » d'`assets/ajout.js`). On montre donc ce qui est vrai
> — les ingrédients — et une phrase factuelle sur ce que le plat apporte. Le jour où ces plats
> deviendront des recettes avec des grammages, `Natty.calcMac` fera le calcul, sans rien
> changer au reste.

**La visionneuse a quitté ce fichier** (août 2026) : elle vit dans `assets/visionneuse.js`,
partagée avec le fil social. `ouvrir({plats, index, titre})` ne fait plus que traduire un plat
du catalogue en item de visionneuse. Les pièges qui suivent valent toujours — ils ont juste
déménagé avec elle.
- ⚠️ **Le geste est un `scroll-snap-type:x mandatory`, pas un suivi de pointeur maison.** Le jeu
  « Tier list » de `narration.html` a coûté une session entière à `setPointerCapture` et ses
  gestes inachevés (§7) : ici le navigateur fait tout — inertie, arrêt sur une diapositive,
  clavier — et il n'y a aucun état à tenir. La position est relue dans un `scroll` amorti par
  `requestAnimationFrame`.
- ⚠️ **Le positionnement initial se fait APRÈS `classList.add('on')`**, sans animation : tant
  que `#ndec` est en `display:none`, `clientWidth` vaut 0, et un `scrollTo` calculé là-dessus
  ramène à la première diapositive quel que soit le plat sur lequel on a tapé.
- ⚠️ **`max-height:58%` sur `.nd-body`, ET C'EST LE RÉGLAGE CENTRAL.** La fiche complète fait
  deux fois la hauteur d'un iPhone : affichée d'un bloc, elle recouvrait la photo entière —
  donc la seule raison d'être d'un plein écran. Au-delà, le bloc défile sur lui-même.
- ⚠️⚠️ **LE VERRE DÉPOLI EST NOIR, PAS BLANC.** Première version en
  `rgba(255,255,255,.16)` + texte blanc : impeccable sur une photo sombre,
  **littéralement invisible** sur une photo claire — la pastille « 🇻🇳 Vietnam » du phở
  s'affichait vide, un rectangle flou sans texte (vu à l'écran, pas par `node --check`).
  Un voile clair sous du texte blanc n'a de contraste que par accident, selon le plat
  photographié. Le noir fonctionne sur les 93.
- ⚠️ **La visionneuse est NOIRE dans les deux thèmes**, comme `assets/ajout.js` et
  `assets/planning.js` : le fond n'est pas une surface d'interface, c'est le bord de l'image.
  Ne pas « corriger » ses `#fff`. Sur écran large, la colonne reste bornée à `--col` — les
  photos sont en portrait, les étirer les rognerait aux deux tiers.
- L'indice « Glissez → » n'apparaît qu'une fois (`natty_decouverte_geste`) et s'efface au
  premier glissement. Il est dans le **tiers haut** : centré, il tombait pile sur le nom du
  plat, puisque la fiche occupe le bas de l'écran.

**Le seul geste qui écrit quelque chose** : les pastilles d'ingrédients et « Tout ajouter à mes
courses » passent par `NattyListe.basculerExtra` — **la même clé localStorage** que les aliments
à privilégier de `coaching.html`, donc une seule liste de courses. Sans `assets/liste.js`, les
pastilles sont désactivées et le bouton disparaît, plutôt que de promettre un geste sans effet.

**`selection(n)`** tire les plats du jour avec une graine issue de `Natty.jour()` (jamais
`toISOString()`, §3) : la sélection change chaque jour mais **ne bouge pas** d'un rendu à
l'autre — sinon les cartes sauteraient à chaque retour sur l'écran et on ne pourrait jamais
retrouver le plat qu'on venait de voir. Un plat par cuisine au maximum, sans quoi le tirage
sort trois currys thaïs et la « sélection du monde » n'en est plus une.

### `api/claude.js`
Proxy vers l'API Claude pour les conseils nutritionnels.

### `api/save-conseils.js`
Sauvegarde les conseils dans `profil_conseils` avec la clé service. **N'est plus appelé que
par `index.html`** (l'ancien dashboard web) : depuis août 2026, l'écriture de la génération
hebdomadaire est faite directement par `api/_generation.js`.

### `api/_generation.js` + `api/generer-conseils.js` — la génération de la semaine, côté serveur
**Un seul appel à Claude produit tout ce que les écrans lisent, et une seule écriture le range.**
`_generation.js` est le cœur partagé (Vercel ignore les fichiers d'`api/` préfixés `_`) ;
`generer-conseils.js` est la route qu'appelle l'app pour UNE personne, `conseils-hebdo.js` le cron
du lundi pour tout le monde.

**Pourquoi côté serveur** — deux mesures du 2026-08-04 :
- La réponse complète (2 recettes détaillées + les six conseils) demande **~71 s**. Depuis une
  page, l'appel meurt avec la page (changement d'écran, téléphone verrouillé) et se fait couper
  par le délai réseau de la WebView. `maxDuration = 120` sur la route ; mesuré, une fonction de
  ce déploiement a tenu **204 s** sans être coupée.
- ⚠️ **Le plafond de jetons était LE défaut** qui répondait « Échec » à l'écran Repas :
  `1300 × nb + 800` donnait 3400 jetons pour deux recettes, la réponse était **coupée en plein
  JSON**, donc inparsable, donc « aucune recette ». Vérifié : 3500 → tronqué, **8000 → JSON
  complet** (`MAX_TOKENS = 3200 × NB_RECETTES + 1600`). Un plafond n'est pas une cible : ce qui
  n'est pas produit n'est pas facturé.

**Ce qu'une génération écrit, en une requête** (c'est ce qui garantit qu'aucun écran ne
régénère) :

| Colonne | Lue par |
|---|---|
| `conseil_prot` … `conseil_points_forts` | overlay « Conseils personnalisés » de `suivi.html`, cartes de `coaching.html` |
| `conseils_json` = `{recettes:[schéma app], plats_macro, nb_repas, conseils, genere_le}` | `.recettes` → `repas.html` et la liste de courses de `coaching.html` (via `NattyReco.recettesDeLaSemaine`) ; `.plats_macro` → la planification de la semaine (`assets/planning.js`) |
| `recettes_json` (schéma d'affichage : `emoji`, `macros.prot/gluc/lip/cal`, étapes en chaînes) | overlay « Mes recettes » de `suivi.html` |
| `liste_courses_json` | overlay « Liste de courses » de `suivi.html` |

> ⚠️ **Le bug qui a motivé cette fusion** : le cron écrivait `conseils_json` **sans clé
> `recettes`** (son schéma d'affichage), alors que la génération navigateur y écrivait
> `{recettes:[…]}`. Après un passage du cron, `NattyReco.lireCache()` ne trouvait donc rien et
> l'écran Repas reproposait « Générer » indéfiniment. Un seul écrivain, un seul schéma.

**`plats_macro` — les trois plats de la planification, ajoutés en août 2026.** Un par
macronutriment, dans l'ordre p → g → l, plus simples qu'une recette (pas d'étapes). Ils sont
demandés ICI et non par `assets/planning.js`, parce que ce sont les mêmes que les conseils :
un plat « protéines » n'a de sens que s'il découle du conseil protéines écrit le même jour.
- `MAX_TOKENS` porté de `3200×n + 1600` à `+1400` : un plafond trop juste tronque le JSON
  entier, et c'est la **fin** de la réponse qui saute — donc précisément ce qu'on vient
  d'ajouter.
- ⚠️ **La génération dure maintenant ~85 s** (mesuré contre l'API réelle le 2026-08-05, contre
  ~71 s avant). Deux marges ont bougé en conséquence : `maxDuration` de `generer-conseils`
  (120 → 180 s) et le `BUDGET_MS` du cron (230 → 180 s — le test regarde le temps *écoulé*, pas
  celui qui reste, donc à 230 s un utilisateur entamé à 229 s se faisait couper).

`recettes_json` et `liste_courses_json` sont **dérivées** des recettes (`versAffichage()`,
`listeDeCourses()`), jamais redemandées à l'IA : deux textes différents décriraient sinon le même
plat, et l'écran qui affiche le second donnerait l'impression que la génération a changé d'avis.

Autres points de vigilance :
- **`semaine` vient du client** quand il la fournit. Le serveur est en UTC : un lundi entre 00 h
  et 02 h à Paris, il calculerait le lundi *précédent* et la page conclurait aussitôt « périmés ».
- **Le garde-manger est transmis dans le corps de la requête**, et le reste même depuis que la
  table `garde_manger` existe : c'est le **navigateur** qui détient la session, donc lui seul
  peut lire les lignes que la policy « soi seulement » protège. Le serveur, avec sa clé service,
  pourrait techniquement les lire — mais il faudrait alors qu'il devine quel `user_id` demander
  et refaire le nettoyage du module. Passer la liste dans la requête reste plus court et plus sûr.
- **`forcer`** (vrai depuis l'app, faux depuis le cron) : sans lui, `processUser` s'arrête dès
  qu'une ligne existe pour la semaine — **même vide**, ce qui était l'état de la base et bloquait
  le bouton en silence. Une ligne sans `conseils_json` ne compte plus pour faite.
- Vérifié de bout en bout contre l'API réelle : JSON complet, 6 conseils, 2 recettes × 10 étapes,
  **aucune clé `illu` inconnue** (donc `assets/recette.js` sait toutes les dessiner), `dispo`
  renseigné quand un garde-manger est transmis.

### `assets/generation.js` — l'attente, et sa mise en scène
Écran plein blanc (`#ngen`, tout préfixé `ngen`), chargé par **suivi, repas, coaching, menu/
www/index, profil, social**. Anneau qui tourne avec l'emoji de l'étape, titre + sous-titre qui
nomment l'étape réelle en cours, **barre de progression**, points d'étape, et le mot qui compte :
« vous pouvez fermer l'application ».

- **Le drapeau est dans `localStorage`** (`natty_generation_en_cours` = `{debut, discret, semaine}`) :
  chaque écran qui charge le module le lit et **reprend l'attente là où elle en était** — le texte
  et la barre suivent le temps écoulé depuis le début RÉEL, pas depuis l'ouverture de l'écran.
- **« Continuer en arrière-plan »** ferme l'écran et laisse une pastille « Conseils en
  préparation… » (tapable pour revenir). Le travail étant sur le serveur, il n'y a rien à
  interrompre.
- **La barre ne dépasse pas 96 %** avant que la ligne ne soit lue en base, et ne revient jamais
  en arrière. Une barre qui atteint la fin sans que rien n'arrive est pire que pas de barre.
- ⚠️ **On n'attend PAS la réponse HTTP de l'endpoint** et on ne peut pas compter sur elle (la
  WebView la coupe souvent avant). La preuve d'aboutissement, c'est la relecture de
  `profil_conseils` toutes les 3 s. Un `fetch` rejeté ne déclenche donc **pas** d'échec — seul un
  `!r.ok` explicite, ou l'expiration au bout de 4 min.
- À l'aboutissement, l'événement **`natty:conseils-prets`** est émis avec la ligne : `suivi.html`
  repeint ses conseils, `repas.html` ses recettes, `coaching.html` sa liste — sans rechargement.
  `lancer()` renvoie aussi une promesse, pour les écrans qui préfèrent `await`.

### `api/conseils-hebdo.js`
Cron Vercel — déclenché 12 fois le lundi matin (toutes les 5 min de 8h à 8h55) pour couvrir tous
les utilisateurs. `maxDuration = 300`, et un **budget de 230 s** : on n'entame pas un utilisateur
qu'on ne pourra pas finir (un appel coupé au milieu est de l'API payée pour rien). Les 12 passages
se relaient, `processUser` sautant ceux qui ont déjà une ligne pleine pour la semaine.

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
| calories | numeric | ← **renseignées depuis août 2026** par `assets/ajout.js` |
| proteins_g | numeric | |
| carbs_g | numeric | |
| fats_g | numeric | ⚠️ `fats_g`, **pas** `fat_g` |

> Les quatre colonnes de macros **existent depuis toujours** et sont restées **à 0 sur les
> 227 premières lignes** : chaque écran redevinait les macros avec la table locale de
> `core.js`, d'où « saucisson = 0 protéine, 0 kcal ». Depuis août 2026 elles sont écrites à
> l'enregistrement, et `Natty.calcMac` les préfère toujours à la table.
> (Vérifié à la clé anon : un `select` sur une colonne absente répond `42703`, sur une colonne
> présente sous RLS répond `[]` — c'est comme ça que `fat_g` s'est révélé être `fats_g`.)

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

#### `planning_semaine` — ✅ **existe** (`natty_planning.sql`, exécuté)
| Colonne | Type | Notes |
|---|---|---|
| user_id | text | PK avec `semaine` |
| semaine | date | Lundi |
| plan | jsonb | tout le plan : les 21 cases « je prépare/j'achète », les 5 repas placés, les cibles |
| updated_at | timestamptz | |

> La clé primaire `(user_id, semaine)` est **ce que vise** le `?on_conflict=user_id,semaine`
> d'`assets/planning.js` : sans elle, une replanification repart en **409** au lieu d'écraser
> (même piège que `meal_likes`/`membre_amis`, §3).
> `plan` est du jsonb parce que sa forme appartient au module qui le compose — une colonne par
> champ imposerait une migration à chaque évolution de la séquence, pour une donnée que
> personne n'interroge par morceaux.
> Tant que la table manque, le plan reste dans le `localStorage` de l'appareil et l'écran le dit.

#### `bilan_jour` — ✅ **existe** (`natty_bilan.sql`, exécuté le 2026-08-10)
| Colonne | Type | Notes |
|---|---|---|
| user_id | text | PK avec `jour` |
| jour | date | PK |
| portee | text | `jour` / `semaine` |
| ressenti | text | « vous avez réussi à bien manger ? » — `oui`/`moyen`/`non` |
| motivation | text | `haute`/`stable`/`basse` |
| difficulte | text | `temps`/`envies`/`quantite`/`rien` |
| note | integer | la note du jour sur 100 |
| muscle_g / gras_g | integer | les **estimations** du jour |
| prot_g / cal_kcal | integer | ce qui a été mangé |
| updated_at | timestamptz | |

**Relevé à la clé anon le 2026-08-10**, cinq contrôles : la table répond `[]` (donc présente,
et non `PGRST205`) ; le témoin sur une colonne inventée répond `42703`, ce qui prouve que le
test lit vraiment le schéma ; les douze colonnes ci-dessus sont là ; un INSERT anon est refusé
en **`42501`**, donc la policy protège.
> ⚠️ **Et la clé primaire est confirmée par la MÊME mesure.** Un POST avec
> `?on_conflict=user_id,jour` répond `42501` et **non `42P10`** (« no unique constraint
> matching the ON CONFLICT specification ») : la requête a donc été **planifiée** avant d'être
> refusée, ce qui prouve que la cible du `ON CONFLICT` s'est résolue. Sans cette clé, un second
> bilan le même soir repartirait en **409** au lieu d'écraser — même piège que `meal_likes` /
> `membre_amis` / `notes_nutritionniste`. Même raisonnement que pour `garde_manger`.

Les colonnes chiffrées sont un **instantané, pas une source** : elles servent à relire une
série sans refaire le calcul, et le module les recalcule toujours depuis `meals` quand il
affiche l'écran. Si les deux divergeaient, ce sont les repas qui font foi.
`bilan_jour` est dans `TABLES_USER` d'`api/supprimer-compte.js` — ce qu'on répond le soir sur
sa motivation et ses difficultés est ce qu'il y a de plus personnel dans cette app.

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

### Thème sombre (août 2026) — voir `assets/theme.js` en §3
Chaque écran porte désormais **deux jeux de jetons**, le clair et son pendant
`:root[data-theme="dark"]`. Fond `#0e0e11`, carte `#1c1c22`, encre `#f4f4f7`,
filets `#2a2a32`, verts/orangés/rouges en valeurs « dark system » d'Apple
(`#32d74b`, `#ffb340`, `#ff453a`) — les couleurs vives du thème clair bavent
sur du noir.

⚠️ **Le neumorphisme ne s'inverse pas.** Un relief blanc à `.88` sur fond noir
n'est plus un relief, c'est un halo : les cartes ont l'air allumées par en
dessous. Les reliefs tombent à `~.035` et c'est **l'ombre portée** qui creuse.
Deux fois ce défaut a été trouvé **à l'écran et nulle part ailleurs** — la
carte « Historique de repas » de `suivi.html` (`--sh-out`) et toutes celles
d'`offre.html`, dont les ombres étaient écrites en dur, hors variable.

⚠️ **`--ink` / `--black` avaient DEUX rôles**, et c'est là qu'est toute la
difficulté : couleur du **texte** (134 usages dans `suivi.html`) et fond des
**surfaces sombres** (49 usages). En sombre l'un doit s'éclaircir et l'autre
rester sombre — les confondre rend forcément l'un des deux illisible. D'où la
séparation en `--surface-ink` (le fond) et le couple `--ink` / `--on-ink`
(ce qui se pose dessus). Toute nouvelle règle doit choisir son rôle.

**Ce qui reste volontairement clair en thème sombre** : les boutons
principaux (`--ink` sur fond de page) s'inversent en pastille claire à texte
sombre — c'est le contraste attendu, pas un oubli. De même le bouton *Sign in
with Apple* garde son noir et son blanc : son habillage est imposé par Apple.

### Admin (style neumorphique)
- Même variables CSS que le dashboard
- Typographie : DM Sans
- Onglets : highlight vert `#34c759` sur l'onglet actif
- ⚠️ **Pas de thème sombre** : `admin.html` et l'ancien `index.html` vivent
  dans un navigateur de bureau, pas dans l'app. Ils ne chargent pas
  `assets/theme.js` et restent clairs.

### [narration] DA du module parcours (mise à jour — N&B uniforme)
- **DA noir & blanc uniforme, neumorphisme sobre façon Apple, police Inter.** Fini les palettes colorées par univers.
- **Deux thèmes seulement** (via `applyUnivers()` → `body[data-u]`) :
  - **Clair** (`base`) : fond **blanc pur `#ffffff`**, encre `#0d0d0f` — pour l'apprentissage/lecture.
  - **Sombre** (`jeu`/`defi`) : fond `#0f1014`, encre blanche — pour les **mini-jeux, la cuisine ET les défis** (blanc sur noir). Accent or `#f0b429` réservé aux défis.
- **Aucune animation de fond** (pas d'emojis flottants) : fond uni. La fonction `floaters()` a été neutralisée.
- Surlignages de mots kinetic en **noir** (`hl`) par défaut ; jaune (`hlY`) réservé au sens fort/défis.
- Le jeu de la jauge utilise un **panneau blanc** dédié même en thème sombre, pour que le sujet détouré et la jauge restent lisibles.
- Colonne mobile **480 px** : `#klayer` est ancré à cette colonne centrée (et non à la fenêtre entière) pour un rendu correct sur ordinateur comme sur mobile.
- ⚠️ **`narration.html` NE SUIT PAS le mode sombre de l'app** (décision d'août
  2026, en même temps que `assets/theme.js`). Il ne charge pas `theme.js` et
  garde son alternance blanc/noir pilotée par le type de beat. Ce n'est pas un
  oubli : ici le blanc est une **matière**, choisie plan par plan comme dans un
  film, et le parcours alterne déjà les deux à chaque écran — un utilisateur en
  mode sombre y voit donc des écrans blancs *par construction*, pas par défaut
  de thème. Le rendre « sombre » demanderait de reprendre ses 68 blancs écrits
  en dur et sa bibliothèque `K_SVG`, au risque des bugs de rendu documentés en
  §7. À faire un jour comme un chantier à part, pas comme un correctif.

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

### Thème sombre (août 2026)
- **`assets/theme.js` dans le `<head>`, en synchrone** — pas dans `core.js`.
  Une seule raison, mais elle suffit : `core.js` est en fin de `<body>`, donc
  le thème s'appliquerait après le premier rendu et chaque changement d'écran
  ferait un éclair blanc.
- **Un interrupteur, trois états.** Pablo a demandé « un switch », et un
  segmenté Clair/Sombre/Auto aurait été plus bavard que le réglage ne le
  mérite. L'état `auto` reste donc l'état *par défaut*, invisible et non
  sélectionnable : l'interrupteur montre ce qui est à l'écran, le premier
  geste fige. Personne n'a à choisir « auto », c'est déjà le cas.
- **Préférence en `localStorage`, jamais en base** : un thème est un réglage
  d'appareil (voir §3).
- **`--surface-ink` séparé de `--ink`/`--black`** dans `suivi.html`,
  `login.html`, `onboarding.html`, `questionnaire-alim.html` et `offre.html` :
  fond sombre d'un côté, couleur de texte de l'autre. Voir §5 pour le
  pourquoi — c'est la décision structurante de tout ce chantier.
- **`narration.html` reste hors du thème** (voir §5, [narration]).
- **`admin.html` et l'ancien `index.html` restent clairs** : ils vivent dans
  un navigateur de bureau, pas dans l'app.

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

### Cache Vercel/navigateur — ✅ cause trouvée (août 2026)
**Problème** : ancienne version servie malgré un nouveau déploiement.
**Cause réelle, longtemps invisible** : les headers `no-cache` existaient bien… dans un fichier
nommé **`vercel`**, sans extension, que Vercel ne lit pas. `vercel.json` ne les a **jamais**
portés (vérifié sur tout l'historique git). La parade n° 2 ci-dessous masquait le symptôme sur
les pages Wix, d'où la persistance du bug ailleurs. Corrigé : headers rapatriés dans
`vercel.json`, fichier orphelin supprimé.
**Solution** :
1. `vercel.json` avec headers `Cache-Control: no-cache` sur les `.html` — **c'est fait**,
   et ne jamais les remettre dans un fichier au nom approchant
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

### Thème sombre : un `:root` coupé en deux, et deux halos — ✅ corrigés
Trois défauts trouvés en **regardant l'écran**, aucun détectable par lecture
ni par `node --check`. Ils sont ici parce qu'ils se reproduiront à la
prochaine page qu'on thémera.

1. ⚠️ **`suivi.html` a DEUX blocs `:root`**, séparés de 850 lignes. En
   insérant le bloc sombre au milieu du second, tout ce qui le suivait —
   `--metal-black`, `--sh-metal` — s'est retrouvé **défini uniquement en mode
   sombre**. Résultat : en mode **clair**, les cartes Calories et Objectif
   perdaient leur fond noir et affichaient du blanc sur gris perle. Le mode
   qu'on ne venait pas de toucher. Avant d'insérer un bloc de variables dans
   un fichier de 5 000 lignes : `grep -c ':root'`.
2. ⚠️ **Les ombres neumorphiques ne sont pas toutes dans des variables.**
   `--sh-out` (`suivi.html`) et une quarantaine de `rgba(255,255,255,.88)`
   écrits en dur dans `offre.html` ont continué à peindre un reflet blanc sur
   fond noir : un **halo**, comme si les cartes étaient rétroéclairées.
   Dans `offre.html` les valeurs sont conservées **une par opacité**
   (`--relief-88`, `--creux-42`…) plutôt que normalisées : normaliser les
   alphas aurait retouché un écran clair qui fonctionnait.
3. ⚠️ **Un `color:#fff` n'est pas toujours à remplacer.** Sur `var(--ink)` il
   faut `var(--on-ink)` — mais sur une photo, sur du vert, ou sur une carte
   volontairement noire dans les deux thèmes, il doit **rester**. C'est ce qui
   interdit un simple rechercher-remplacer : il faut lire le fond de chaque
   règle.

**Comment vérifier une page sans la relire** : en thème sombre, balayer le DOM
et remonter tout bloc de plus de 40×20 px dont le `backgroundColor` calculé a
une luminance > 0,8 et qui ne porte pas d'image. Ce qui passe par une variable
a déjà basculé ; ce qui ressort est écrit en dur. Sur les six écrans de la nav
il ne reste ainsi que des boutons principaux **volontairement** inversés.

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

### Boucle de connexion : un refus de POLICY pris pour une session morte — ✅ corrigé
**Problème** (constaté par Pablo le 2026-08-04, juste après l'activation des RLS) : on se
connecte, on appuie sur « Suivi », on retombe sur l'écran de connexion, indéfiniment. Les
journaux GoTrue le disaient sans ambiguïté — **cinq connexions réussies en treize minutes**
depuis la même adresse, entrecoupées de « 400: Refresh token is not valid ».
**Deux confusions en série**, toutes deux inoffensives tant que la RLS dormait :
1. `appel()` (`assets/core.js`) traitait **tout** 401/403 de PostgREST comme un jeton
   révoqué. Or PostgREST répond aussi 401/403 quand c'est la **policy** qui refuse
   (`42501`) : le jeton est bon, c'est l'écriture qui n'est pas permise, et renouveler n'y
   change rien. Depuis les RLS, ce cas est devenu le cas courant.
2. `rafraichirSession()` appelait `deconnecter()` dès qu'un renouvellement était refusé. Un
   `refresh_token` est **à usage unique** : deux écrans qui le dépensent en même temps
   suffisent à le faire refuser, alors que l'`access_token` en poche vaut encore une heure.
**Solution** : ne renouveler que sur `PGRST301`/`PGRST303`/`JWT` et jamais sur `42501` ; et
ne déconnecter que si le jeton courant est **réellement** périmé (`perime()`, sans la marge
de 60 s d'`expireBientot()`).
**Vérifié en A/B**, même session factice et même page : ancienne version → `menu.html`
finit sur `login.html` ; nouvelle → `menu.html` ouvre le suivi et la session tient. Refait
sur la prod après déploiement.
> ⚠️ Leçon transposable : **un `catch` qui déconnecte est un piège**. Tant que la RLS était
> désactivée, aucune requête ne revenait en 403, donc ce chemin n'avait jamais été
> emprunté. Toute la classe « erreur serveur → on suppose que la session est morte » est à
> relire avant d'activer une sécurité côté base.

### « Les conseils ne se génèrent jamais » — trois défauts empilés, tous mesurés — ✅ corrigés
Constaté par Pablo le 2026-08-04 : dans l'app, les conseils tournent indéfiniment
(« Chargement des conseils… » qui ne devient jamais rien) et l'écran Repas répond « Échec —
vérifiez votre connexion » avec une connexion parfaitement valide. Trois causes distinctes, dont
aucune n'était une panne de réseau :

1. **`suivi.html` exigeait `assets/reco.js`… sans jamais le charger.** La page ne chargeait que
   `core.js`, et `conseilsGenererEtSauvegarder()` commençait par
   `if (!window.NattyReco) throw new Error('assets/reco.js requis')`. La génération levait donc
   **avant le moindre appel**, depuis chaque bouton, à chaque fois. C'était structurellement
   impossible depuis le refactor qui avait déplacé le prompt dans reco.js.
   > Leçon : une dépendance vérifiée à l'exécution (`if (!window.X) throw`) ne prouve rien tant
   > que personne ne vérifie la balise `<script>`. Le message d'erreur était juste, et invisible.
2. **Plafond de jetons trop bas → JSON tronqué → « aucune recette ».** `recommander()` demandait
   `1300 × nb + 800` jetons, soit 3400 pour deux recettes détaillées. Mesuré : la réponse est
   coupée en pleine étape, `extraireJson()` renvoie null, `recommander()` renvoie `[]`, et le seul
   mot qui parvient à l'utilisateur est « Échec — vérifiez votre connexion ». Il faut **8000**
   jetons (vérifié : JSON complet, 12 511 caractères, 2 recettes de 10 étapes).
   > Leçon : une troncature par `max_tokens` ne ressemble PAS à une erreur d'API — elle ressemble
   > à une réponse vide. Toujours faire dire au message d'erreur la longueur reçue.
3. **Un garde qui sortait sans rien afficher.** `fetchProfilConseils()` faisait
   `if (sessionStorage.getItem('natty_conseils_ok_…')) return;` — sans peindre. Le
   « Chargement des conseils… » écrit **en dur dans le HTML** de l'overlay restait alors à l'écran
   pour toujours. Un garde doit empêcher un travail inutile, jamais laisser un écran à moitié peint.

**Corrigé** en déplaçant la génération côté serveur (voir §3, `api/_generation.js` et
`assets/generation.js`) : la page déclenche, regarde et affiche ; elle ne génère plus. Et parce
que la réponse complète demande **~71 s**, elle ne pouvait de toute façon pas vivre dans une page
— ni survivre au changement d'écran, ni au délai réseau d'une WebView.

### Analyse critique d'un plat : générée une fois, figée ensuite — ✅ vérifié
`ouvrirAnalysePlat()` (suivi.html) lit d'abord un cache à deux étages — `localStorage`, puis la
colonne `meals.analyse_json` si elle existe — et n'appelle Claude que s'il est vide.
`peindreAnalysePlat()` est un rendu pur, utilisé aussi bien à la première génération qu'aux
ouvertures suivantes : l'affichage est donc strictement le même dans les deux cas.
**Vérifié en navigateur** : première ouverture = 1 appel à `/api/claude` ; fermeture puis
réouverture du même plat = **toujours 1 appel**, texte identique, et ce même avec la colonne
absente (repli local).
🔄 `natty_analyse_plat.sql` (une ligne) reste à exécuter pour que l'analyse suive l'utilisateur
d'un appareil à l'autre. Sans elle, tout marche, mais en local.

### Realtime WebSocket manuel (protocole obsolète ?)
**Problème** : `chat.html`, `challenges.html` et `suivi.html` ouvrent chacun un `WebSocket` manuel vers `wss://.../realtime/v1/websocket` avec un `phx_join` minimal (`{topic:'realtime:public:<table>', payload:{}}`), sans `config.postgres_changes` — c'est le protocole Supabase Realtime **pré-`postgres_changes`**, potentiellement incompatible avec une instance Supabase récente (qui exige ce champ de config pour router les événements).
**Solution** : à tester en conditions réelles (envoyer un message/défi et vérifier la réception live) ; si cassé, migrer vers le client `supabase-js` (`.channel().on('postgres_changes', ...)`) plutôt que le protocole WebSocket brut.

### ⚠️ Un banc qui ne PEINT pas gèle les animations — et fait conclure à un bug
Trouvé en développant `assets/journee.js` (août 2026), après **deux fausses pistes**. Quand la
page du banc n'est pas rendue (onglet en arrière-plan, aucune capture depuis un moment), le
navigateur **suspend les animations CSS et les transitions**. On mesure alors, deux secondes
après l'insertion, un `opacity: 0` sur un titre parfaitement correct, et une pastille qui n'a
pas bougé alors que son `left` cible a bien été écrit.
**La lecture au banc dit donc l'état de DÉPART, pas l'état final** — et elle ressemble trait
pour trait à « l'animation ne se déclenche pas ».
**Parade** : prendre une **capture d'écran d'abord** (elle force un rendu), et mesurer ensuite.
Deux captures successives permettent en plus de voir une transition à deux instants, ce qui est
le seul moyen de vérifier qu'un mouvement a bien lieu — c'est comme ça que le défilement de
l'arc de « Ma journée » a été constaté.
> À rapprocher de la règle 31 : `node --check` valide la syntaxe, pas le comportement visuel.
> Ici, même le navigateur ment si on ne le fait pas peindre.

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
- ✅ Icônes PWA : plus aucune référence à `/icon-192.png`. `manifest.json` pointe sur
  `/natty-icon-192.png` (présent), `www/manifest.json` sur ses `.webp` (tous présents, types
  corrects). Cette entrée était **périmée** — rien à faire.
- ✅ Fichier `vercel` (sans extension) supprimé, et ses headers no-cache **rapatriés dans
  `vercel.json`** : ils n'avaient jamais été actifs (voir §2, c'est la cause du bug de cache).
- ✅ Service worker : `onboarding.html` (+ `www/`) enregistrait encore `/sw.js` alors que
  `index.html`/`suivi.html` désinscrivent tout. Aligné sur la désinscription — `sw.js`
  s'auto-désinscrivant, l'enregistrement n'avait aucun effet, seulement une incohérence.

**Abonnements & paiements**
- ✅ `api/webhook.js` sécurisé (vérification de signature Stripe, voir §3/§7). **Nécessite d'ajouter `STRIPE_WEBHOOK_SECRET` dans Vercel avant push**, sinon le webhook rejette tout en fail-closed.

**Ajout de plat (bouton +)**
- ✅ Parcours complet livré dans `assets/ajout.js` (voir §3) : caméra directe, analyse IA,
  anneaux de macros restantes **par repas**, enrichissement (resservir / ingrédients / autre
  repas / dessert) et carrousel de suggestions. Branché sur les 5 écrans porteurs de la nav.
- 🔄 À valider sur téléphone réel : ouverture de la caméra depuis la WebView Capacitor
  (le `capture="environment"` n'a pu être testé qu'en navigateur desktop).
- ✅ **Les macros sont stockées par ingrédient** depuis août 2026 (`meal_ingredients.calories`,
  `proteins_g`, `carbs_g`, `fats_g`), et `Natty.calcMac` les préfère à la table. Cette entrée
  disait le contraire : c'était vrai avant `65c8a4e`.
- 🔴 🔄 **Le recalcul est à déclencher UNE fois** pour les ~227 lignes antérieures, encore à 0,
  qui font sous-compter tout l'historique (totaux, graphiques, scores du fil). **Par le bouton**
  de `admin.html` → onglet Équipe → « Maintenance › Macros de l'historique » : « Relevé »,
  puis « Écrire ». Détail et garde-fous en §3.
  **Je ne peux pas le faire moi-même** : il faut `SUPABASE_SERVICE_KEY`, qui n'existe que sur
  Vercel — la clé anon ne voit plus rien sous RLS. Et **Pablo n'a pas accès à `CRON_SECRET`**
  (2026-08-05), d'où le bouton plutôt qu'un `curl`.
  🔄 Après le relevé : me transmettre `non_reconnus` pour compléter la table de `core.js`,
  régénérer `api/_nutrition.js`, puis relancer — c'est le seul moyen de connaître la couverture
  réelle, les noms en base n'étant plus lisibles autrement.

**Garde-manger & génération de recettes**
- ✅ Panneau « Mon garde-manger » dans `repas.html` : scan des courses, du ticket de caisse ou
  d'une photo importée, plus saisie libre ; bouton « Générer mes repas avec ces ingrédients ».
  Les recettes affichent ce qu'il reste à acheter. Voir `assets/garde-manger.js` en §3.
- ✅ **Table `garde_manger` créée** (`natty_garde_manger.sql`, exécuté par Pablo le 2026-08-05,
  vérifié en base — voir §3) : la liste suit désormais l'utilisateur d'un appareil à l'autre.
  RLS activée, policy « soi seulement », INSERT anon refusé.
- 🔄 Le garde-manger ne se décrémente pas quand une recette est suivie ou un repas enregistré :
  l'utilisateur retire les ingrédients à la main.

**Découvrir (plats du monde)**
- ✅ **Livré** (août 2026) — `assets/decouverte.js`, détail en §3. 93 plats, 19 cuisines, trois
  rangées en tête de `social.html`, et la visionneuse plein écran en geste latéral. Photos
  fournies par Pablo, recompressées dans `assets/img/decouverte/` (10,3 Mo, deux tailles).
- ✅ Vérifié en navigateur (colonne 375 × 812, thèmes clair ET sombre) : les 3 rangées, les
  **186 images qui répondent toutes** (aucun slug orphelin), l'ouverture depuis une cuisine /
  une étiquette / la grille du jour, l'ouverture **à un index non nul** (6/9 demandé, 6/9
  obtenu, au pixel de défilement près), un **vrai geste de glissement** qui avance de deux
  plats et cale la jauge, le retour qui rend le défilement à la page et vide la piste, les
  pastilles d'ingrédients dans les deux sens **jusque dans la liste de courses réelle**,
  « Tout ajouter » (6/6), un nom à apostrophe (« Huile d'olive ») qui ne casse pas le
  sélecteur, la recherche croisée fil + catalogue, et la sélection du jour stable sur deux
  appels avec 8 pays distincts.
- 🔄 **Non vérifié sur téléphone** : le rythme du défilement par à-coups, la zone sûre du bas
  et la lisibilité du texte sur les photos les plus claires n'ont pu être jugés qu'en
  navigateur.
- 🔄 **Ces plats ne sont pas des recettes** : pas d'étapes, pas de grammages, donc pas de
  macros (voir l'encadré de §3). Les brancher sur la génération de la semaine — « je veux
  celui-là jeudi » — reste à faire, et c'est la suite naturelle.
- 🔄 Les photos sont servies depuis le dépôt. Si le poids devient un sujet, elles suivront le
  même chemin que `narration.html` : Cloudinary (`CLOUD_BASE`), cloud `dujji1s6g`.

**Fil social**
- ✅ **Rien n'est publié sans qu'on l'ait demandé** (août 2026) : le bouton `+` écrit
  `partage: false`, et le choix se fait à la fin du bilan. Les plats enregistrés AVANT ce
  changement restent publics (`partage` à `null` vaut public) — les basculer tous en privé est
  une décision qui ne se reprend pas, elle appartient à Pablo.
- ✅ **Profil d'un membre** : taper un nom ou une photo, n'importe où dans le fil, ouvre sa page
  (moyennes de ce qu'il publie, score moyen, tous ses plats). Aucune requête de plus.
  ⚠️ `[data-membre]` est testé AVANT `[data-id]` : l'en-tête d'auteur est dans la carte du plat.
- ✅ **Trois points sur ses propres plats** (`profil.html`) : renommer, retirer du fil / y
  remettre, supprimer. La suppression retire les `meal_ingredients` d'abord — sans cascade en
  base, ils resteraient orphelins et continueraient de peser dans les macros que le fil
  recalcule. `prompt()` natif étant proscrit dans le bundle, le renommage passe par une boîte
  maison (`demanderTexte`).
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

**Bilan du soir et de la semaine**
- ✅ **Livré** (2026-08-10) — `assets/bilan.js`, détail en §3. Récap de ce qui a été mangé,
  trois questions, quatre critères, corps (muscle/graisse estimés), courbe sur un mois ; et
  le samedi, la même séquence sur les sept jours. Branché sur `suivi`, `repas`,
  `menu`/`www/index` (+ copies `www/`).
- ✅ **`natty_bilan.sql` exécuté le 2026-08-10** et vérifié à la clé anon (cinq contrôles,
  dont la preuve de la clé primaire par `42501` plutôt que `42P10` — voir §4). Les réponses
  suivent donc la personne d'un appareil à l'autre.
- ✅ **Les deux défauts de macros signalés par Pablo sont corrigés** : `afficherMacros()`
  prenait la **moyenne 7 jours** (`calcMoyenneMacros`) pour le consommé du jour — d'où
  « il reste 89 g » après en avoir mangé 15 sur 140. Une moyenne ne se remet pas à zéro à
  minuit. C'est `macAuj` qu'il fallait lire, et il existait déjà sans être utilisé ici. Et
  les anneaux **se remplissent** désormais (Suivi + `+`), fraction plafonnée à 1 — sans
  plafond, un dépassement enroule l'arc une seconde fois et un gros excès ressemble à un petit.
- 🔄 **Non vérifié sur téléphone**, ni avec une vraie session : tout a tourné contre des
  doublures, en navigateur (375 × 812, les deux thèmes, les deux séquences de bout en bout).
- 🔄 **La courbe couvre 30 jours, pas « depuis le début »** — choix assumé de lisibilité sur
  375 px, à retrancher avec Pablo.
- 🔄 **Le samedi ne pose pas les trois questions** (voir §3) — à décider.
- 🔄 Il ne s'ouvre que **quand l'app est ouverte**. Pour qu'il arrive de lui-même le soir, il
  faut le brancher sur `assets/notifs.js` (le rappel du soir existe, il pointe vers le
  parcours).

**Guide « Ma journée »**
- ✅ **Livré** (août 2026) — `assets/journee.js`, détail en §3. Arc de jalons qui défile de
  droite à gauche, version longue à la première ouverture du jour, version courte aux moments
  clés. Branché sur `menu.html`/`www/index.html`, `suivi.html` et `repas.html` (+ copies `www/`).
- ✅ **Refonte du 9 août 2026** (« beaucoup trop d'éléments ») : séquence en quatre temps —
  bonjour seul, arc seul, jour/date/étape/bouton, envol vers la fonction. Neuf blocs de texte
  retirés de la scène finale, V vert et barillet ajoutés, et le **bandeau très sobre** en tête
  de `menu.html`. Détail en §3.
- ✅ Vérifié en navigateur (colonne 375 × 812) sur **cinq scénarios**, avec des doublures
  complètes et une horloge pilotée : 8 h rien de fait, 12 h 40 avec recette prévue, 21 h 50 tout
  fait, 9 h semaine non planifiée, 16 h avec le midi jamais noté (jalon « manqué »). Vérifié
  aussi que l'arc **se déplace réellement** entre deux instants, que le déclencheur ouvre une
  fois par jour puis une fois par créneau (3ᵉ passage silencieux, réouverture au dîner), et que
  l'étape « Planifier » disparaît quand `planning.js` n'est pas chargé.
- 🔄 **Non vérifié avec une vraie session** : toutes les lectures (`meals`, `onboarding`,
  `questionnaire_alim`, `planning_semaine`) n'ont tourné que contre des doublures — il faut un
  mot de passe de compte, que je n'ai pas. Le calcul, lui, est celui de `NattyCreneaux` et de
  `NattyPlanning`, déjà éprouvés ailleurs.
- 🔄 **Non vérifié sur téléphone** : le rythme des scènes, le défilement de l'arc et la zone
  sûre en bas n'ont pu être jugés qu'en navigateur.
- 🔄 Les moments clés ne se déclenchent que **quand l'app est ouverte**. Pour qu'ils arrivent
  d'eux-mêmes, il faut passer par les notifications (`assets/notifs.js` envoie déjà un rappel à
  midi vers `suivi.html`, et le rappel du soir vers le parcours) — le guide prend alors le relais
  à l'ouverture. Une notification qui ouvrirait directement le guide reste à faire.

**Planification de la semaine**
- ✅ **Séquence complète livrée** (août 2026) — `assets/planning.js`, détail en §3. Bonjour →
  invitation → deux questions → placement → calendrier → livraison → validation, puis le
  calendrier dans « Ma semaine » en haut de `repas.html`. Branchée sur `menu.html`/
  `www/index.html` (déclencheur à 5 s) et `repas.html` (panneau), copies `www/` faites.
- ✅ Vérifié en navigateur (colonne mobile 375 px), avec un `Natty` factice et 28 jours de
  repas volontairement pauvres en protéines le midi : les 3 plats macro et les 2 recettes se
  placent aux bons créneaux (le plat protéines atterrit bien sur un midi), le compteur affiche
  « 5 repas planifiés sur 21 », le repli local s'annonce quand l'écriture en base échoue,
  la validation affiche bien la coche verte `#34c759`, et le panneau « Ma semaine » rend les
  7 jours sans défilement.
- ✅ **`natty_planning.sql` exécuté** — vérifié le 2026-08-05 à la clé anon : `planning_semaine`
  répond `[]` (la table existe, la RLS filtre) et non `PGRST205`. Le plan suit donc bien
  l'utilisateur d'un appareil à l'autre. Cette entrée réclamait le SQL depuis plusieurs
  sessions : il était fait.
  > ⚠️ La table manquait à la liste `TABLES_USER` d'`api/supprimer-compte.js` — un compte
  > supprimé laissait ses plans derrière lui, donc *quand la personne est chez elle et ce
  > qu'elle mange*. Ajoutée.
- 🔄 **Non vérifié avec une vraie session** : les lectures `meals`/`onboarding`/
  `questionnaire_alim` et l'appel `/api/claude` des 3 plats macro n'ont tourné que contre des
  doublures. Il faut un compte pour aller plus loin.
- ✅ **Le plan se consomme** (août 2026) : un créneau planifié qui a reçu son repas passe au
  vert dans les deux calendriers, l'en-tête dit « N repas sur 5 déjà faits », et un repas
  enregistré hors du plan laisse un point. Relu en base, jamais coché à la main — détail et
  raison en §3. Vérifié : 3 créneaux cochés sur des données de test, et un plat ajouté en
  cours de session marque son créneau **sans recharger la page**.
- ✅ **Réglage jour par jour livré** (la maquette 13 de Pablo) : chevron, sept traits, segments
  « Je prépare / J'achète », et « Tout voir d'un coup » vers la grille. Vérifié : les choix
  tiennent en revenant en arrière, une seule carte dans le DOM après sept passages (pas
  d'empilement, cf. le bug connu de `narration.html`).
- ✅ **Génération unique** (août 2026, demande de Pablo) : les 3 plats macro sortent du même
  appel que les conseils et les recettes (`conseils_json.plats_macro`). `assets/planning.js`
  n'appelle plus l'IA du tout — il lit et place. **Vérifié contre l'API réelle** : 6/6 conseils,
  2 recettes de 11 et 10 étapes, 3/3 plats macro avec leurs macros et leur « pourquoi » ancré
  dans le profil, aucune clé `illu` inconnue, JSON complet (15 730 caractères) en **85,4 s**.
- ✅ **Carte « Ma semaine » refaite** : noire, jours en colonnes, ~115 px de haut au lieu d'une
  carte plus haute que le repas du jour. La fiche d'un repas passe au noir aussi.
- 🔄 **Les 3 plats macro n'ont pas de photo** — seulement leur emoji. Les deux seules photos de
  plats du dépôt (`plat-demo1/2-week.png`) sont des plats précis : les coller sur « Poulet
  rôti » serait un mensonge à l'écran. Il faut de vraies photos, fournies par Pablo (règle §9
  #24 : on ne va pas en chercher sur le web).

**Thème sombre**
- ✅ **Livré** (août 2026) — `assets/theme.js` + un pendant `[data-theme="dark"]`
  sur chaque écran, et l'interrupteur « Mode sombre » en tête des réglages de
  `profil.html`. Détail en §3, décisions en §5/§6, pièges en §7.
- ✅ Couvre les **six écrans de la nav** (suivi, repas, menu/`www/index`,
  social, coaching, profil), les **écrans d'entrée** (login, onboarding,
  questionnaire-alim), **chat**, **offre** et les **trois pages légales** ;
  plus les modules injectés `nav.js`, `core.js` (`Natty.confirmer`),
  `generation.js`, `liste.js`, `minijeux.js`, `recette.js`.
- ✅ Vérifié en navigateur (colonne 375 px) sur chacun de ces écrans, dans les
  **deux** thèmes — le clair a été recontrôlé après coup, et c'est là qu'a été
  attrapée la régression du `:root` coupé en deux (§7). Balayage automatique
  des fonds restés clairs : plus rien d'involontaire.
- 🔄 **Non vérifié sur téléphone** : la barre d'état (`theme-color`) et les
  contrôles natifs (`color-scheme`) n'ont pu être testés qu'en navigateur.
  À regarder au prochain build iOS, en même temps que le reste.
- 🔄 **Le suivi « en direct » du réglage système n'a pas pu être vérifié.**
  L'émulation `prefers-color-scheme` des outils de développement change bien la
  requête média mais **ne déclenche pas l'événement `change`** — mesuré : un
  écouteur posé à la main juste avant la bascule reçoit 0 événement, donc c'est
  le banc de test, pas le code. La résolution, elle, est juste (`appliquer()`
  appelé à la main rend le bon thème). Au pire, en `auto`, la bascule du
  téléphone se verrait au changement d'écran suivant, chaque page rejouant
  `appliquer()` au chargement.
- 🔄 **`narration.html` volontairement hors périmètre** (§5). C'est le seul
  écran de l'app qui reste blanc quand le reste est sombre.
- 🔄 `admin.html` et l'ancien `index.html` restent clairs — écrans de bureau.

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
- ✅ **Push serveur — code écrit et testé aussi loin que possible sans la clé Apple.**
  `assets/push.js`, `api/_apns.js`, `api/_nutrition.js`, `api/push-test.js`,
  `api/rappel-macros.js`, `api/push-amis.js`, `natty_push.sql`, plugin installé,
  capability + entitlement iOS en place, `AppDelegate` complété. Détail en §3.
  **Vérifié** : signature ES256 (64 octets, r|s), calcul des macros identique à l'app sur
  10 repas réels, les deux endpoints en dry-run sur les vraies données (rappel du soir avec
  le bon reste en grammes, agrégation « Hélène a ajouté 4 plats », et le filtre de
  confidentialité qui fait tomber 11 repas à 7), payload reçu par le plugin sur simulateur
  (`xcrun simctl push`).

  🔄 **Ce qui manque, et qui n'est PAS du code :**
  1. **La clé APNs** (Apple Developer → Keys → Apple Push Notifications service, Team
     **`DJLW82GU5A`** — l'équipe **Natty**, depuis l'achat de la licence Apple Developer
     Program le 2026-08-10 ; l'ancien `SAZQ9AFAMZ` était le compte **individuel** de Pablo
     et ne sert plus).
     > ⚠️ **Une clé `.p8` appartient à UNE équipe.** Si une clé avait été créée sous le
     > compte individuel, elle ne peut pas signer pour l'app de l'équipe Natty : il en faut
     > une **nouvelle**, donc `APNS_KEY_ID` **et** `APNS_P8` changent avec `APNS_TEAM_ID`.
     > Les trois se posent ensemble, jamais l'une sans les autres — un `iss` qui ne
     > correspond pas à l'équipe signataire de l'app se paie d'un **403 sans un mot**
     > d'explication (voir l'encadré `dsaEncoding` plus haut, même symptôme, autre cause).
     Puis sur Vercel : `APNS_KEY_ID`, `APNS_P8` (contenu du .p8),
     `APNS_TEAM_ID`, `APNS_TOPIC` = **`com.pabloansermet.nattysuivi`** (le bundle id réel —
     **PAS** `com.natty.app` de `capacitor.config.json`), `APNS_ENV` = `sandbox` pour un build
     Xcode, `production` pour TestFlight/App Store. Plus `CRON_SECRET` et
     `SUPABASE_SERVICE_KEY` s'ils manquent. Vérification : `GET /api/push-test?secret=…`.
  2. **`natty_push.sql`** à exécuter — tables `appareils`, `push_etat`, `push_config`, plus
     `pg_net` et le déclencheur `meals_notifier_amis`. Sans elles aucun jeton n'est stocké et
     rien ne part. ⚠️ **Remplacer `REMPLACER_PAR_LE_CRON_SECRET`** par la vraie valeur avant
     d'exécuter : le déclencheur doit s'authentifier auprès de l'endpoint. Le secret vit dans
     `push_config`, dont la **RLS est activée sans aucune policy** — donc illisible depuis la
     clé anon, et lu uniquement par la fonction `SECURITY DEFINER`. Ne pas l'écrire en dur
     dans le corps de la fonction.
  3. **Un build signé.** ⚠️ Le `CODE_SIGNING_ALLOWED=NO` documenté en §11 empêche l'embarquement
     de l'entitlement : l'enregistrement échoue alors avec « aucune autorisation
     *aps-environment* valide » (constaté). L'entitlement lui-même est correct — le
     `App.app-Simulated.xcent` généré porte bien `aps-environment: development` et
     l'identifiant d'application préfixé de l'équipe (relevé à l'époque du compte individuel :
     `SAZQ9AFAMZ.com.pabloansermet.nattysuivi` ; c'est désormais `DJLW82GU5A.` devant le même
     bundle id). **Un simulateur ne peut de toute façon pas
     obtenir de vrai jeton APNs** : le premier jeton réel viendra d'un iPhone.
  4. ✅ **Crons : réglé.** `{ "path": "/api/rappel-macros", "schedule": "0 16 * * *" }` ajouté
     à `vercel.json` avec l'accord de Pablo (16 h UTC = 18 h à Paris en été, 17 h en hiver —
     Vercel ne connaît que l'UTC). Un cron quotidien passe sans problème : mesuré le
     2026-08-03 dans Vercel → Observability, les 12 crons hebdo déclarés se sont bien exécutés.
     **`push-amis` ne dépend plus d'un cron du tout** : Pablo a tranché pour le déclencheur
     Supabase (`pg_net`), donc la question d'une cadence courte ne se pose plus.
  5. **Android : bloqué en amont.** Le plugin passe par Firebase Cloud Messaging et exige un
     `google-services.json` (donc un projet Firebase) ; l'app Android n'a de toute façon jamais
     été compilée. `appareils.plateforme` est prévu pour accueillir des jetons FCM sans changer
     de schéma.

**Génération de la semaine (conseils + recettes + liste de courses)**
- ✅ **Une seule génération, côté serveur, pour tous les écrans** (août 2026) : `api/_generation.js`
  + `api/generer-conseils.js` + `assets/generation.js`. Un appui sur un bouton, une attente
  plein écran avec barre de progression, et ensuite **plus aucune régénération** — tous les écrans
  lisent `profil_conseils` jusqu'au lundi suivant. Détail et mesures en §3, causes du blocage
  précédent en §7.
- ✅ **Quitter l'écran ne perd plus rien** : le travail est sur le serveur, l'attente se reprend
  sur n'importe quel écran (drapeau `localStorage`), et « Continuer en arrière-plan » laisse une
  pastille. Vérifié en navigateur : passage Repas → Suivi en cours de génération, l'attente
  reprend au bon palier et au bon pourcentage ; à l'aboutissement, conseils et recettes
  s'affichent d'eux-mêmes sans que l'utilisateur touche à quoi que ce soit.
- ✅ `assets/reco.js` ne génère plus la semaine (`genererTout`, `genererSemaine`,
  `enregistrerTout`, `enregistrerSemaine` retirés) : il ne reste que `recommander()` pour
  « Découvrir » et la LECTURE du cache. Un seul écrivain pour `profil_conseils`.
- 🔄 **Non vérifié en conditions réelles** : l'endpoint n'a pas encore tourné avec une vraie
  session (il faut un mot de passe de compte, que je n'ai pas). Le contenu, lui, a été validé
  contre l'API réelle bout en bout.
- 🔄 « Découvrir » (`assets/minijeux.js` → `recommander(3, contrainte)`) reste un appel **depuis la
  page**. Son plafond de jetons est corrigé, mais 3 recettes demandent ~100 s : à vérifier sur
  téléphone, et à basculer côté serveur si ça échoue.

**Améliorations index.html**
- ✅ **Action de la semaine du nutritionniste — livrée** (août 2026). Carte noire en tête de
  `suivi.html` (`#actionSemaine`), alimentée par `notes_nutritionniste.action_semaine`.
  La colonne `note` est la note **interne** du nutritionniste : elle ne sort jamais de
  l'admin, seule `action_semaine` s'adresse au client (vérifié : la note de test n'apparaît
  nulle part dans la page). Passé 21 jours, le libellé devient « Dernière action de ton
  nutritionniste » plutôt que de faire passer une consigne d'un mois pour celle de la semaine.
  Chargée indépendamment de l'abonnement.
  > ⚠️ **Bug bloquant trouvé et corrigé au passage** : `sauvegarderNotes()` d'`admin.html`
  > postait sans `?on_conflict=client_id` — **409 dès la 2ᵉ sauvegarde** pour un même client
  > (mesuré en base : 201 puis 409). Le nutritionniste pouvait écrire son action une fois et
  > ne jamais la corriger. Même piège que `meal_likes`/`membre_amis`, voir §3.
- ~~Analyse de plat par IA (photo → macros)~~ — **déjà livré** (`analyserAvecIA()`/`saveIA()`), ce n'était pas un backend à créer mais une feature existante mal documentée. Corrigé en §3.

**Admin**
- ✅ **Calendrier commandes — corrigé** (août 2026). Ce n'était pas un « reset à 0 » :
  `getLundiSemaineAdmin()` **applique déjà** `semaineOffset` (elle appelle
  `getLundi(semaineOffset)`), et `chargerCommandesCalendrier()` le rajoutait. Un clic sur
  « semaine suivante » sautait donc **deux** semaines, et le libellé d'`updateSemaineLabel()`
  — qui ne compte l'offset qu'une fois — désignait une autre semaine que les données
  affichées. Mesuré avant/après : offset 1 interrogeait le 16 août au lieu du 10.
  Vérifié en navigateur : 3 → 10 → 17 août, libellé et requête d'accord.
- ✅ **Badge abonnement dans la liste clients — livré** (août 2026). Il n'existait pas du
  tout : « badge logic à corriger » désignait une feature absente, pas un bug. La liste
  affiche désormais « ★ Abonné » (noir plein, seule pastille pleine de la carte) ou
  « Sans abonnement ». L'info vient d'`abonnements?statut=eq.actif`, pas d'`onboarding`.
  > ⚠️ **`abonnements.formule` est nulle sur les lignes réelles** (le webhook ne la
  > renseigne que s'il retrouve le priceId). La pastille se fonde donc sur la **présence**
  > de la ligne, pas sur la formule — sinon elle affichait « Sans abonnement » à quelqu'un
  > qui paie (défaut attrapé au test : 0 abonné détecté sur 2 réels).

**Sécurité**
- 🔄 **`api/conseils-hebdo` est ouvert si `CRON_SECRET` n'est pas configurée** : la garde
  compare `secret !== process.env.CRON_SECRET`, donc `undefined === undefined` laisse passer
  n'importe qui — et chaque appel consomme l'API Claude. Volontairement **pas** rendu
  fail-closed : si la variable n'existe pas encore sur Vercel, ça couperait net la génération
  hebdomadaire. À trancher avec Pablo — une fois `CRON_SECRET` posée (elle l'est de toute
  façon pour le push), remplacer la ligne par la garde d'`_apns.js` (`autorise`).
- ✅ Signature Stripe vérifiée dans `api/webhook.js` (voir §3/§7) — reste à ajouter `STRIPE_WEBHOOK_SECRET` sur Vercel avant déploiement.
- ✅ **`api/conseils-hebdo` verrouillé** (août 2026) : garde fail-closed, et les trois formes
  du secret acceptées. Pablo a confirmé que `CRON_SECRET` existe sur Vercel.
- ✅ **[PRIORITÉ SÉCURITÉ] RLS — ACTIVÉE. Pablo a exécuté `natty_rls.sql` le 2026-08-04.**
  Le trou de départ (mesuré le 2026-08-03) : avec la seule clé anon publique, lecture de
  **toutes** les tables — 31 profils, 66 repas, les conversations privées avec le
  nutritionniste, les allergies, les poids, les âges — et **écriture sur les données
  d'autrui** (`PATCH` sur l'`onboarding` d'un autre membre → **204**).
  **Relevé après activation**, refait table par table avec la clé anon : `onboarding`,
  `meals`, `meal_ingredients`, `messages`, `nutrition_scores`, `questionnaire_alim`,
  `profil_conseils`, `notes_nutritionniste`, `daily_macros`, `challenges`, `membre_*`,
  `meal_likes`, `meal_vues`, `staff`, `appareils`, `push_etat`, `rdv`, `plans_repas`,
  `stocks_mp`, `recettes*`, `ingredients_base`, `offres_clients` → **0 ligne**.
  `staff_configure()` renvoie `true` (les mots de passe partagés sont donc refusés) et
  `nutritionnistes.mdp_hash` a bien été supprimée.
  > ✅ **REFERMÉE — étape 5 exécutée par Pablo le 2026-08-05.** Relevé refait le jour même
  > avec la seule clé anon publique : `abonnements` **0**, `commandes` **0**, `plats_menu`
  > **0**, `nutritionnistes` **0**, et `membre_public` répond `42501 permission denied for
  > view` (le `revoke` a porté). Plus rien de personnel ne sort de la base sans compte.
  > Vérifié aussi, par la même méthode : `meals.partage` et `meals.analyse_json` **existent**
  > (une colonne absente répond `42703`, une colonne présente sous RLS répond `[]` — le test
  > de contrôle sur une colonne inventée confirme la lecture). Donc « Garder pour moi » et le
  > cache d'analyse d'un plat fonctionnent réellement, sans repli silencieux.
  > ✅ **`garde_manger` existe** (`natty_garde_manger.sql`, exécuté le 2026-08-05) : RLS
  > activée, policy « soi seulement », INSERT anon refusé en `42501`. Le garde-manger suit
  > désormais l'utilisateur d'un appareil à l'autre.
  >
  > **Déployé le 2026-08-04** : `main` sert le code d'app-native (vérifié en prod —
  > `POST /api/generer-conseils` répond « Session requise », ce qui n'existe que sur cette
  > branche). Il reste **l'étape 5** à coller : mesuré le même jour, `abonnements` (2),
  > `commandes` (3), `plats_menu` (3), `nutritionnistes` (3) et la vue `membre_public` (26
  > prénoms + poids + TDEE) répondent **encore à la clé anon publique**. Le runbook est
  > `natty_avant_publication.sql` § 1, et sa seule précaution est que le § 5 de
  > `natty_staff.sql` soit passé — sinon l'admin perd la vue sur les abonnements.
  > Contexte historique de ce point (à conserver, il explique le séquencement) :
  > **la prod était éteinte.** `natty-suivi.vercel.app` est déployé depuis **`main`**, dont
  > l'`index.html` parle à Supabase avec la clé anon et **rien d'autre**
  > (`Authorization: Bearer SB_KEY`, 7 occurrences). Toutes les tables qu'il lit
  > renvoient désormais `[]` — en HTTP **200**, donc sans la moindre erreur visible :
  > tableau de bord vide, macros par défaut, historique vide, messagerie vide.
  > **Déployer `app-native` sur `main` n'est plus une option de confort, c'est la
  > réparation** : c'est cette branche qui porte `assets/core.js` (JWT) et
  > `SESSION_OBLIGATOIRE`. Voir aussi §11.
  > ⚠️ Il reste **quatre tables et une vue** ouvertes à la clé anon — `abonnements` (2
  > lignes), `commandes` (3), `plats_menu` (3), `nutritionnistes` (3), `membre_public`
  > (26 : prénom, poids, tdee ; une vue, donc un GRANT et non une policy). C'est
  > aujourd'hui **tout ce qui répond encore à la prod** : le bloc qui les referme est
  > l'**étape 5 de `natty_rls.sql`**, à ne coller **qu'après** le déploiement.
  Les trois points qui bloquaient l'activation, pour mémoire :
  1. ✅ **`admin.html` a maintenant une identité en base** (option A, tranchée par Pablo le
     2026-08-03), **et les comptes existent** : `staff_configure()` renvoie `true`, donc le
     mode de secours par mots de passe partagés est fermé, de lui-même et sans
     redéploiement. Le back-office se connecte par Supabase Auth, envoie le JWT de la
     personne connectée à PostgREST, et lit son rôle dans `staff` (`natty_staff.sql`).
     > ⚠️ **Trois restes de l'ancien monde retirés le 2026-08-04**, tous devenus faux par la
     > suppression de `nutritionnistes.mdp_hash` : l'ancienne `login()` (mot de passe maître
     > en clair + `btoa(pwd) === mdp_hash`) — déjà morte, `window.login` écrasant ce nom
     > avant la pose du listener, mais elle lisait une colonne disparue ; la reprise de
     > session `nutri_session`, qui rouvrait le back-office **sans jeton d'équipe** et donc
     > sur des tables fermées par la RLS (un écran d'apparence normale, vide de bout en
     > bout) ; et surtout `sauvegarderNutri()`, qui envoyait encore `mdp_hash` — PostgREST
     > refusant une colonne inconnue, **ajouter ou modifier un nutritionniste échouait
     > entièrement**. Le champ « Mot de passe » du formulaire d'équipe est remplacé par la
     > marche à suivre (compte Auth + ligne `staff`), affichée après l'enregistrement avec
     > l'identifiant de la fiche déjà rempli.
  2. ✅ **Fil social** : `social.js` lit désormais la vue `membre_public` au lieu
     d'`onboarding`/`questionnaire_alim` (commit `b7b6b9d`, session parallèle). La RLS
     filtrant des lignes et non des colonnes, c'est la vue qui restreint les colonnes.
  3. ✅ **Migration des sessions — faite** (août 2026). `SESSION_OBLIGATOIRE` est passé à
     `true` : un utilisateur sans session est renvoyé vers `login.html`, et s'il avait une
     identité héritée (`natty_token` / `?token=`) il arrive sur `login.html?reconnexion=1`
     avec un mot d'explication — il se croyait connecté, on ne le dépose pas devant un
     formulaire sans rien dire. L'identité héritée est effacée au passage, sinon la page
     suivante rejouait le même aller-retour. **Fait maintenant plutôt qu'au moment
     d'activer la RLS** : ce drapeau vivant dans le code et la RLS dans le SQL, les basculer
     ensemble se serait payé en écrans vides. Vérifié : hérité → message + nettoyage ;
     visiteur sans rien → `login.html` nu ; aucune boucle.
- ✅ **`nutritionnistes.mdp_hash` supprimée** (2026-08-04, fin de `natty_staff.sql`). Ce
  n'était pas un hachage mais du base64, réversible en une ligne, dans une table lisible
  avec la clé anon publique : les mots de passe de toute l'équipe étaient en clair pour qui
  savait regarder. Vérifié : la colonne n'existe plus (`42703`), et plus aucun code ne la
  demande. Les nutritionnistes entrent désormais par leur compte Auth.
- ✅ **`onboarding.html` branché sur la session** (2026-08-04). Il postait son profil avec la
  clé anon : une fois `onboarding` sous RLS, l'INSERT repartait en `42501` **à la dernière
  étape, après tout le questionnaire**. La page charge maintenant `assets/core.js`, tire son
  identité de la session (plus de `?token=` hex) et appelle `Natty.entetes()`.
  `requireAuth()` renvoie se connecter **avant** de faire remplir quoi que ce soit.
  ⚠️ Pas de `on_conflict=user_id` malgré le `merge-duplicates` : `onboarding.user_id` n'a
  aucune contrainte d'unicité (la table contient de vrais doublons), PostgREST répondrait
  `42P10`. C'est aussi pourquoi un second passage ajoute une ligne au lieu de corriger la
  première — à régler en base.
- ✅ `priceId` validé côté serveur dans `api/checkout.js` (allowlist des deux formules,
  commit `d6aafbe`).
- ✅ **Journalisation de `api/checkout.js` nettoyée** (août 2026) : le handler écrivait le
  body entier dans les logs Vercel — donc **l'adresse de livraison, l'email et le token de
  session** de chaque personne qui souscrit. Ne restent qu'un identifiant de formule et des
  booléens ; la réponse Stripe n'est tracée qu'en cas d'échec, et seulement son message.

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
12. **Les macros d'un repas ne se redevinent pas** : elles sont sur la ligne
    `meal_ingredients` (`calories`, `proteins_g`, `carbs_g`, `fats_g`). La table `NT` de
    `core.js` est le **filet**, pas la source — tout écran qui recalcule doit passer par
    `Natty.calcMac`, qui applique cet ordre et signale les ingrédients inconnus (`.inconnus`).
13. **`ingredients_base` colonnes macros** : `cal_per_100g`, `prot_per_100g`, `gluc_per_100g`, `lip_per_100g`
13. **RLS** : `recettes`, `recettes_ingredients`, `recettes_etapes`, `profil_conseils` → RLS désactivé. Ne pas réactiver sans test.
14. **Demander confirmation** avant de modifier `vercel.json` ou `masterPage.js`
15. **SQL sans commentaires** dans Supabase SQL Editor — erreur de syntaxe garantie
16. **CREATE POLICY une par une** — pas en batch
17. **Ne jamais supposer l'existence de colonnes** — vérifier avec `information_schema.columns`
18. **Activer Realtime manuellement** sur toute nouvelle table utilisant les WebSockets
19. **Après chaque push GitHub**, attendre le redéploiement Vercel (statut Ready) avant de tester
20. **`window._factureProduitsCache`** — données facture dans array global avec `data-idx`, pas en JSON dans `data-produit`
31. **Compatibilité Capacitor** : signaler à Pablo toute décision qui dépendrait d'une API navigateur non supportée en WebView (voir §10), ou d'un chemin absolu qui casserait si l'app n'est plus servie depuis la racine du domaine
33. **Une couleur écrite en dur est une couleur qui ne basculera pas.** Toute
    nouvelle règle CSS passe par un jeton (`--bg`, `--card`, `--ink`,
    `--on-ink`, `--muted`, `--line`, ou les `--nt-*` pour un module injecté).
    Et avant d'écrire `color:#fff`, se demander sur quoi il repose : sur
    `var(--ink)` c'est `var(--on-ink)` ; sur une photo ou sur du vert, `#fff`
    est juste. Voir §5 et §7.
34. **Toute page nouvelle charge `assets/theme.js` dans le `<head>`**, avant
    sa feuille de style — sinon elle clignote en blanc à chaque ouverture.

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

### ⚠️ `e01e20b` contient le travail de deux sessions — tranché : on ne réécrit pas
Le commit **`e01e20b` « Recettes : des étapes qu'on peut suivre en cuisinant… »** a emporté,
via un `git add -A`, le travail d'une session parallèle : `cgu.html`, `cgv.html`,
`confidentialite.html`, `assets/legal.css`, `api/supprimer-compte.js` et la zone
« supprimer mon compte » de `profil.html`. Son message n'en dit rien.

**Décision (2026-08-04, Pablo : « fais au mieux ») : on laisse l'historique tel quel.**
Le découpage propre exigerait un `git push --force` sur `app-native` **et** sur `main`, or :
- le commit est déjà **sur `main` et déployé** — réécrire le fait disparaître d'une branche
  qui sert la production ;
- **une autre session travaille sur ce dépôt en parallèle** : un force-push la laisse sur
  une base qui n'existe plus, à réparer à la main, sans prévenir ;
- le contenu, lui, est **intact et vérifié** (syntaxe, balises fermantes, endpoint valide).
Le seul dommage est un message de commit incomplet. Le coût de la réparation est très
supérieur au défaut. Cette note **est** la réparation : `git log` ne dit pas d'où viennent
les pages légales et la suppression de compte, ce paragraphe le dit.

> Règle qui en découle : **jamais de `git add -A` sur ce dépôt.** Plusieurs sessions y
> écrivent en même temps ; n'ajouter que les chemins qu'on a soi-même modifiés.

### ⚠️ `3d0a0ae` : la même chose, dans l'autre sens (2026-08-05)
Le commit **`3d0a0ae` « La semaine des macros se lit d'un coup d'œil »** appartient à la
session « calendrier des macros » (`assets/macros-cal.js`, et ses retouches à `suivi.html`).
Il a emporté, par le même `git add -A`, **tout le travail d'une session parallèle** —
celle-ci :

| Fichier | Ce qu'il contient, et qui ne vient pas du calendrier |
|---|---|
| `api/recalc-macros.js` | recalcul unique des macros de l'historique (§3) |
| `api/_nutrition.js` | table serveur réalignée : 185 aliments, appariement mot à mot |
| `api/rappel-macros.js` | demande enfin les quatre colonnes de macros |
| `assets/liste.js` (+ `www/`) | API des aliments ajoutés à la main (`basculerExtra`…) |
| `assets/reco.js` (+ `www/`) | `jsonSemaine()`, `alimentsSemaine()` |
| `coaching.html` (+ `www/`) | rangée « Aliments à privilégier » et sa liaison aux courses |

**Ce n'est pas un accident évitable par plus de prudence de mon côté** : mes chemins étaient
staggés nommément, et le `git commit --only` que j'allais lancer aurait épargné son index. La
séquence a été plus rapide que ça — son `add -A` a ramassé mon arbre de travail entre mon
`git add` et mon `commit`, et le commit était **poussé** avant que je puisse en faire un.

**Décision : on ne réécrit pas**, pour les trois raisons déjà données pour `e01e20b` — commit
poussé sur `main` qui sert la production, session active sur le dépôt, contenu intact. Vérifié
après coup, dans `HEAD` : 185 aliments côté serveur, `normNom` présent, `basculerExtra`
exporté, `maxDuration` sans `config.runtime` invalide, arbre de travail identique à `HEAD` —
donc c'est bien mon **état final vérifié** qui a été capturé, pas une édition à moitié faite.
Ce tableau est la réparation.

> Leçon qui s'ajoute à la règle : sur ce dépôt, **`git commit --only <chemins>` plutôt que
> `git add` puis `git commit`**. Le premier ne dépend pas de l'état de l'index au moment du
> commit — donc d'une autre session — et laisse intact ce qu'elle y avait déjà mis.

## 11. Application native (Capacitor) — branche `app-native`

> Section rédigée en juillet 2026, quand le portage est passé de « projet » à « app qui compile et tourne ». Le §10 ci-dessus reste valable comme liste de vigilance ; celle-ci décrit ce qui est **fait**.

### Structure
- **`www/`** est le bundle de l'app : copie sélective des fichiers web. `menu.html` y devient `index.html` (point d'entrée). `admin.html`, `accueil.html`, l'ancien `index.html` et `api/` en sont volontairement exclus.
- **`ios/`** et **`android/`** sont commités (28 et 77 fichiers). Capacitor 8 utilise **Swift Package Manager, pas CocoaPods** — il n'y a rien à installer côté Ruby. `Package.resolved` est figé dans le repo.
- ⚠️ **Toute modification d'un fichier web doit être répercutée dans `www/`**, puis `npx cap sync`. Les deux arborescences ne sont pas liées automatiquement.
- **En revanche `ios/App/App/public` et `android/app/src/main/assets/public` sont GITIGNORÉS**
  (`ios/.gitignore:4`, `android/.gitignore:96`) : ce sont des sorties de `cap sync`, régénérées
  à chaque fois depuis `www/`. Il n'y a donc jamais rien à committer pour ces bundles, et **un
  `git show HEAD:<un de ces chemins>` échoue** — ne pas en conclure à une divergence
  historique, c'est simplement un fichier absent de l'index (l'erreur a été faite le
  2026-08-05). Ce qui compte, c'est `www/`.

> ⚠️ **`npx cap sync` n'avait jamais tourné pour ANDROID** (constaté le 2026-08-05, en le
> lançant). `android/app/capacitor.build.gradle` et `android/capacitor.settings.gradle` ne
> connaissaient que `@capacitor/app` et `@capacitor/browser` : **`local-notifications` et
> `push-notifications` en étaient absents**, alors qu'ils sont installés depuis août 2026 et
> déclarés côté iOS. Un build Android aurait compilé sans eux — `assets/notifs.js` et
> `assets/push.js` auraient trouvé le plugin manquant et se seraient tus, silencieusement,
> exactement là où on aurait cherché un bug de notification. Corrigé : les deux fichiers gradle
> déclarent maintenant les 4 plugins.
> Bon à savoir : `cap sync` **ne demande pas de JDK** (mesuré — il ne fait que copier et
> réécrire ces fichiers). C'est le *build* Android qui en a besoin, pas le sync : lancer
> `npx cap sync` reste donc possible et utile ici même sans Android Studio.

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

### L'icône maison ramène à l'accueil de l'app
Signalé par Pablo le 2026-08-05 (« certains boutons home renvoient sur le site
internet plutôt que sur menu.html »). Trois choses, dont une bien plus grave que
les deux autres :
- `profil.html` (+ `www/`) : l'icône maison pointait sur `https://www.natty-nutrition.com`.
  Sur un écran secondaire, une maison veut dire « retour à l'accueil » — corrigé.
- `menu.html` / `www/index.html` : même lien, sur l'écran d'accueil lui-même.
  Corrigé aussi, **et le gestionnaire `lienSite` a été retiré avec lui** : laissé en
  place, il aurait ouvert `menu.html` **hors** de l'app, dans le navigateur système.
  Conséquence assumée : **il n'y a plus de lien vers le site vitrine dans l'app.**
- 🔴 ⚠️ **`www/menu.html` était un fossile, et c'est LUI que servait le bundle.**
  Tous les écrans pointent vers `menu.html` ; dans le bundle ce fichier existait
  en doublon de `www/index.html`, figé depuis `99e57f3` — **sans `theme.js`
  (donc sans mode sombre), sans `planning.js` (donc sans déclencheur de
  planification), sans `garde-manger.js`**, et avec le lien sortant vers le site.
  Autrement dit, dans l'app native, taper « Accueil » depuis n'importe quel écran
  ramenait sur une vieille version de l'accueil. Réaligné sur `www/index.html`.
  > Le piège à retenir : `www/index.html` est le point d'entrée du bundle, mais
  > **`www/menu.html` doit exister ET rester identique**, parce que c'est le nom
  > vers lequel tous les liens pointent. Sur le web, `index.html` est l'ANCIEN
  > dashboard — les liens ne peuvent donc pas être renommés. Les deux fichiers se
  > répercutent ensemble, à chaque modification de `menu.html`.

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

### Conformité App Store — fait en août 2026
Quatre choses qu'Apple vérifie à l'envoi, et qui n'existaient pas.

- **`ios/App/App/PrivacyInfo.xcprivacy`** — sans manifeste de confidentialité, App Store
  Connect renvoie **ITMS-91053 « Missing API declaration »** : Capacitor lit et écrit
  `UserDefaults`, qui fait partie des *required reason APIs*. Déclaré avec le motif
  **CA92.1** (accéder aux informations de l'app elle-même). Le fichier déclare aussi ce que
  l'app collecte — prénom, email, identifiant, santé (poids/taille/âge/repas), activité,
  photos, contenu des messages, état de l'abonnement — tout **lié à l'identité**, tout pour
  le **fonctionnement**, **rien pour le pistage**.
  > ⚠️ Le manifeste doit être **dans le bundle** : il est référencé dans `project.pbxproj`
  > (PBXFileReference + phase Resources), à la main, comme `App.entitlements` avant lui.
  > Vérifié après build : `App.app/PrivacyInfo.xcprivacy` présent. Capacitor et Cordova
  > apportent chacun le leur, ce qui couvre leurs propres API.
  > ⚠️ Les noms de catégories ne sont validés qu'à l'envoi : c'est le seul point de cette
  > liste qu'un build local ne peut pas prouver.
- **`ITSAppUsesNonExemptEncryption` = false** — l'app ne chiffre rien elle-même, elle ne
  fait que du HTTPS (exempté). Sans la clé, Apple repose la question à chaque envoi.
- **iPhone seulement** (`TARGETED_DEVICE_FAMILY = 1`, était `"1,2"`) — en universel, Apple
  **révise l'app sur iPad**, alors que toute la mise en page est une colonne mobile de
  480 px avec une barre d'onglets en bas.
- **Portrait seulement** — le plist promettait les deux paysages, que rien ne gère.

Vérifié : `xcodebuild` réussit, l'app se lance sur iPhone 17 Pro, et l'écran Repas affiche
les recettes de la semaine **depuis le cache** (aucune régénération) — la chaîne complète de
§3 fonctionne sur l'appareil.

### Dialogues natifs retirés du bundle — `Natty.confirmer` / `Natty.alerte`
`confirm()` et `alert()` **fonctionnent** dans une WebView, mais s'y affichent avec l'origine
du bundle en titre (« capacitor://localhost ») : sur un écran d'app, ça ressemble à un
avertissement de sécurité, et c'est ce que verra le testeur d'Apple. `narration.html` les
avait déjà proscrits ; `assets/core.js` porte maintenant la version partagée (feuille centrée,
promesse, taper le fond = annuler, jamais confirmer). Remplacés : la suppression d'un repas et
l'abandon d'un défi dans `suivi.html`, l'échec d'enregistrement de `questionnaire-alim.html`
(un `alert()` après sept étapes de questionnaire), l'abandon dans `challenges.html`.
`admin.html` et `index.html` gardent les leurs : ils vivent dans un navigateur, pas dans l'app.

> ⚠️ **Une classe de visibilité posée par la seule `requestAnimationFrame` ne se pose pas si
> la page ne peint pas** (onglet caché, app en arrière-plan) : la feuille resterait à
> `opacity:0` **tout en interceptant les taps**. Constaté en test — opacité encore 0 une demi-
> seconde après la création, jusqu'à ce qu'une capture force un rendu. Un `setTimeout(…, 60)`
> double la rAF, dans `core.js` **et** dans `assets/generation.js`.

### Reconnexion temps réel : palier au lieu d'acharnement (`chat.html`)
`ws.onclose` faisait `setTimeout(subscribeRealtime, 3000)`, sans condition. Hors ligne — ou
simplement app en arrière-plan — c'était une tentative toutes les trois secondes, sans fin,
batterie comprise. Désormais : palier qui double (3 s → 60 s max), **rien n'est retenté quand
l'écran est caché**, une seule socket vivante, et au retour à l'écran on repart du palier court
en rechargeant la conversation (le temps réel a pu manquer des messages). Le protocole, lui,
reste l'ancien `phx_join` — voir §7.

### Reste à faire
- **Android n'a jamais été compilé** — et ne peut pas l'être ici : **aucun JDK**
  (`java -version` → « Unable to locate a Java Runtime »), aucun SDK Android, pas de
  `ANDROID_HOME`. C'est Android Studio à installer, donc une décision de Pablo. Tant que
  ce n'est pas fait, **le Play Store est hors d'atteinte** (le push Android l'est aussi : le
  plugin exige un `google-services.json`, donc un projet Firebase).
- ✅ **Emoji en `?` : artefact du simulateur, rien à corriger.** Pablo a vérifié sur son
  iPhone le 2026-08-05 — les emoji s'affichent normalement. C'est le runtime du simulateur qui
  n'a pas la police. **Ne pas « corriger » ce qui se voit sur les captures du simulateur** :
  les emoji servent d'icônes dans presque tous les écrans, y toucher serait une régression
  gratuite.
- **`challenges.html` est orphelin dans le bundle** : plus aucun lien n'y mène (l'onglet
  « Défis » ouvre `narration.html`). Le fichier reste embarqué. À supprimer de `www/` ou à
  relier — mais pas à laisser en l'état indéfiniment.
- ✅ **Signature : l'équipe existe** (2026-08-10 — Pablo a pris la licence Apple Developer
  Program à 99 €). `DEVELOPMENT_TEAM = DJLW82GU5A`, l'équipe **Natty**, en Debug comme en
  Release, et l'entitlement `aps-environment: development` est posé. C'est ce qui débloque
  l'appareil réel, TestFlight, et le premier vrai jeton APNs.
  `CODE_SIGNING_ALLOWED=NO` reste ce qu'il faut pour le **simulateur** — mais c'est aussi ce
  qui empêche d'embarquer l'entitlement, donc à retirer dès qu'on construit pour un iPhone
  (voir §8, l'erreur « aucune autorisation *aps-environment* valide »).
  > ⚠️ **On ne travaille plus sur le compte individuel `SAZQ9AFAMZ`.** Tout ce qui est
  > rattaché à une équipe est à refaire sous la nouvelle : identifiant d'app, profils, et
  > surtout la **clé APNs** — une `.p8` n'est pas transférable d'une équipe à l'autre.
  ⚠️ **Sauf pour le push** : sans signature, l'entitlement `aps-environment` n'est pas embarqué
  et `PushNotifications.register()` échoue (« aucune autorisation *aps-environment* valide »).
  Ce n'est pas un défaut de configuration — et un simulateur ne peut de toute façon pas obtenir
  de jeton APNs utilisable. Le premier jeton réel viendra d'un iPhone. Voir §8.
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

---

*Contribution session « planification de la semaine » (Claude Opus, 5 août 2026) :*
- **Branché** `assets/planning.js`, qui existait dans l'arborescence mais **n'était chargé par
  aucune page** : ni script tag, ni copie `www/`, ni table, ni déclencheur, ni panneau. Le
  module était écrit, la fonctionnalité n'existait pas.
- `menu.html` + `www/index.html` : chargement + `NattyPlanning.proposerSiNecessaire()`
  (déclencheur à 5 s, sur l'écran d'arrivée **seulement**).
- `repas.html` + `www/repas.html` : `#planWrap` **au-dessus** du repas du jour et hors de
  `#content` (que `render()` remplace en entier), montage du calendrier, geste sur une case
  planifiée, écoute de `natty:planning-pret`. Le panneau des recettes devient
  « Recettes conseillées » pour ne plus porter le même titre que le calendrier.
- **Nouveau** `natty_planning.sql` : table `planning_semaine`, RLS activée, policy « soi
  seulement ». Un plan de repas dit quand la personne est chez elle et ce qu'elle mange.
- **Ajouté au module** : `detail()`, la fiche d'un repas placé (feuille du bas, style clair de
  l'app) — sans elle, taper un plat macro ne montrait rien, ces plats n'existant nulle part
  ailleurs dans l'app. Plus `vignette()`/`brancherVignettes()` (repli emoji quand une photo
  n'arrive pas).
- **Quatre défauts visuels trouvés en navigateur, aucun détectable par `node --check`** :
  le raccourci `animation` de `.respire` écrasait celui de `.trace` (illustrations
  partiellement **jamais dessinées**) ; `aspect-ratio:1/1` sur les cases rendait le compteur
  « 5 repas sur 21 » invisible sans défiler ; `#nplf .ing div` attrapait les enfants et
  découpait chaque ingrédient en trois pastilles ; les boutons de la barre d'action
  apparaissaient d'un coup par-dessus la scène sortante.
- **Pas touché** : `suivi.html` / `www/suivi.html`, modifiés par une session parallèle et
  laissés tels quels (règle « jamais de `git add -A` sur ce dépôt »).

*Suite de la même session (5 août 2026) — la semaine se coche, et se règle jour par jour :*
- **Consommation du plan** : `realises()` relit `meals` depuis le lundi et range par
  (jour × créneau) ; les deux calendriers passent le créneau au vert, l'en-tête compte les
  repas faits, un repas hors plan laisse un point. **Aucun drapeau stocké** — un drapeau rate
  ce qui est enregistré ailleurs et dérive dès qu'un repas est supprimé.
- **`scJours()`** : le réglage jour par jour de la maquette 13, en UNE scène pour les sept
  jours (sept scènes auraient fait clignoter le bouton d'action sept fois), avec bascule vers
  la grille par « Tout voir d'un coup ».
- Le module écoute lui-même `natty:repas-ajoute` : l'écran hôte n'a rien à brancher.

*Troisième passe de la même session (5 août 2026) — une seule génération, et une carte discrète :*
- **`api/_generation.js` produit désormais `plats_macro`** (3 plats, un par macro) dans le même
  appel que les conseils et les recettes. `assets/planning.js` les LIT : il n'appelle plus
  `/api/claude`. Un seul avis pour la semaine, une seule facture.
- Deux marges recalées sur la mesure réelle (85,4 s) : `maxDuration` de `api/generer-conseils`
  120 → 180 s, `BUDGET_MS` d'`api/conseils-hebdo` 230 → 180 s.
- **Ordre de la séquence corrigé** : générer d'abord, stocker, animer ensuite — au lieu de
  masquer/rallumer l'animation de planification autour du plein écran de génération.
- La mise en scène de la planification passe de 15 s à **3,6 s** : il n'y a plus d'appel à
  attendre, et une attente inventée se voit.
- **Carte « Ma semaine » : noire, jours en colonnes, trois lignes.** La fiche d'un repas suit.

*Quatrième passe de la même session (5 août 2026) — les macros, l'ordre du bilan, et les aliments :*
- **`assets/core.js`** : table nutritionnelle passée de ~60 à ~200 aliments (charcuterie,
  fromages, plats courants, boissons), et surtout **rapprochement mot à mot, plus long libellé
  gagnant**. Avant, `find()` prenait le premier venu : « pomme de terre » tombait sur « pomme »,
  « huile olive » sur « huile », et « ail » se trouvait dans « volaille ». `calcMac` préfère
  désormais les macros écrites sur la ligne et signale les ingrédients qu'il n'a pas su chiffrer.
- **`assets/ajout.js`** : analyse photo par ingrédient (valeurs pour 100 g), écriture des macros
  en base, contrôle de crédibilité asymétrique, liseré ambre sur un aliment non reconnu, cadre
  photo en `contain`, et le bilan remis dans l'ordre (enregistré → analyse → prochain repas →
  publier). **Vérifié sur trois vraies photos** via l'API : 6 ingrédients identifiés séparément
  par photo, valeurs pour 100 g cohérentes, totaux 497 / 782 / 456 kcal.
- **`api/_generation.js`** : chaque plat macro porte maintenant 4 à 6 **aliments à privilégier**.
  Vérifié : thon, crevettes, cabillaud, skyr, edamame pour les protéines — avec leur teneur.
- **`suivi.html`** : le détail d'une macro affiche le plat **généré** (au lieu de
  `PLATS_DEMO_MACRO`, trois plats codés en dur identiques pour tout le monde) et ses aliments à
  privilégier, chacun ajoutable à la liste de courses d'un tap. Les ajouts vivent en
  `localStorage` par semaine — `liste_courses_json` est dérivée côté serveur, y réinjecter des
  ajouts manuels les ferait écraser à la génération suivante.
  ⚠️ Ce commit emporte aussi le travail **non commité d'une session parallèle** sur `suivi.html`
  (`conseilsPresents`/`conseilsFrais`/`CONSEILS_COLS`, retrait des générations déclenchées par
  une simple consultation). Impossible de l'en séparer sans réécrire son travail ; c'est noté
  ici, comme pour `e01e20b`.

---

*Contribution session « mode sombre » (Claude Opus, 6 août 2026) :*
- **Nouveau** `assets/theme.js` (+ `www/`) : moteur de thème clair/sombre/auto,
  chargé en synchrone dans le `<head>` de tous les écrans de l'app. Détail en §3.
- **Interrupteur « Mode sombre »** en tête des réglages de `profil.html`, avec
  le sous-titre qui dit si l'on suit le téléphone ou un choix figé. Il écoute
  `natty:theme` pour ne pas mentir si le téléphone bascule pendant qu'il est
  affiché.
- Pendant `:root[data-theme="dark"]` ajouté à `assets/style.css`, `suivi.html`,
  `login.html`, `onboarding.html`, `questionnaire-alim.html`, `chat.html`,
  `offre.html` ; jetons `--nt-*` pour les modules injectés ; `assets/legal.css`
  passé aux variables.
- **`--surface-ink` séparé de `--ink`/`--black`** — la décision structurante :
  la même variable servait de couleur de texte ET de fond de carte sombre, deux
  rôles qui basculent en sens contraire (§5).
- Trois défauts trouvés **en regardant l'écran** et corrigés : un `:root` coupé
  en deux qui cassait le mode CLAIR de `suivi.html`, et deux séries d'ombres
  neumorphiques écrites hors variable qui faisaient halo sur fond noir (§7).
- Vérifié en navigateur sur les 13 écrans concernés, dans les deux thèmes, plus
  un balayage automatique des fonds restés clairs.
- **Pas touché** : `narration.html` (art direction propre, §5), `admin.html` et
  l'ancien `index.html` (écrans de bureau).

---

*Contribution session « Ma journée » (Claude Opus, 9 août 2026) :*
- **Nouveau** `assets/journee.js` (+ copie `www/`) : le guide cinématique des étapes du jour —
  arc de jalons qui défile de droite à gauche, version longue à la première ouverture, version
  courte aux moments clés. Documenté en §3, statut en §8.
- Branché sur `menu.html`, `suivi.html`, `repas.html` et les copies `www/` (`www/index.html` et
  `www/menu.html` répercutés ensemble, cf. §11 — c'est `menu.html` que visent tous les liens).
- `suivi.html` charge désormais `assets/planning.js` **pour le lire**, pas pour le déclencher :
  sans lui, le guide ne saurait pas quelle recette est prévue au créneau du moment, et
  proposerait de planifier une semaine peut-être déjà planifiée.
- **§7** : nouveau piège méthodologique — un banc qui ne peint pas gèle animations et
  transitions, et la mesure rend alors l'état de départ. Deux fausses pistes avant de le
  comprendre.
- Vérifié en navigateur sur cinq scénarios avec doublures et horloge pilotée ; banc jetable
  `_test-journee.html` (préfixe `_`, donc hors dépôt).

---

*Contribution session « Ma journée — refonte sobre » (Claude Opus, 9 août 2026) :*
- `assets/journee.js` (+ `www/`) : séquence remise en **quatre temps** à la demande de Pablo
  (« beaucoup trop d'éléments et d'information ») — bonjour seul → arc seul → jour + date +
  étape + un bouton → envol vers la fonction. Neuf blocs de texte retirés de la scène finale.
- Ajouts : **V vert type Apple** sur les étapes validées, **barillet** qui se cale sur l'étape
  en cours, **envol** de la pastille blanche au clic (avec le drapeau `sync` qui protège
  l'ouverture de la caméra sur iOS).
- **Nouveau** `NattyJournee.monterBandeau()` : le même arc en tout petit, en tête de `menu.html`
  (au-dessus des trois éléments de l'accueil) — date, étapes validées, où l'on en est.
- Code mort retiré au passage : le récapitulatif écrit, les pastilles de macros, l'en-tête
  « Ma journée », l'entrée `para` et le libellé `detail` de chaque étape.
- Vérifié au banc : les cinq scénarios inchangés côté logique, le barillet qui se cale sur la
  bonne icône (animation `finished`, transform identité), l'appel caméra à < 20 ms et la
  navigation différée, et le bandeau en thème clair.

---

*Contribution session « Ma journée — thème, arc, plats » (Claude Opus, 9 août 2026, 3ᵉ passe) :*
- 🔴 **Bug trouvé sur une capture de Pablo** : le barillet tournait **à l'envers** et la bulle du
  moment finissait sur l'illustration de l'étape **précédente** (le dîner affichait la coche du
  déjeuner). Le sens de `njBarillet` est inversé, et le pourquoi est écrit en §3 — c'est un piège
  qui se retendra à la première retouche.
- **Mode clair** : `assets/journee.js` suit désormais `assets/theme.js`. Toutes ses couleurs
  passent par des jetons `--j-*`, le clair ne redéfinit que les jetons. Vérifié dans les deux
  thèmes, styles calculés à l'appui (fond, encre, bouton, pastille active, creux).
- **Arc** : sommet ramené à −90° (centrage), rayon resserré et pas ouvert pour qu'il se lise
  comme un cercle, troisième orbite concentrique, lueur recentrée sur les jalons, colonne
  centrée verticalement — les quatre remarques de Pablo (« centrage », « trop haut », « plus se
  rapprocher de l'arc et de l'inspiration »).
- **Photos détourées** : la bulle d'un repas porte le plat prévu par la planification
  (`prevu.photo`), l'illustration au trait sinon ; repli si l'image n'arrive pas.
- **`menu.html`** : le bandeau devient un **en-tête** — date, arc de cercle, étape sous l'arc,
  avec la lueur du guide en fond.
- Banc `_test-entete.html` (préfixe `_`, hors dépôt) : monte au chargement, avec heure, thème et
  cas de figure en paramètres d'URL — c'est le seul rendu fiable dans ce navigateur (§7).

---

*Contribution session « Ma journée — le plat, et un seul style » (Claude Opus, 9 août 2026, 4ᵉ passe) :*
- **Le plat en grand sous le titre** (`.hero`) : photo détourée du repas prévu, illustration au
  trait sinon. Le titre remonte vers l'arc (`.zone` : 22 → 12 px de marge).
- **L'en-tête de `menu.html` est désormais LE MÊME écran, mis à l'échelle** — plus une seconde
  présentation dessinée à part. Le CSS du guide passe du sélecteur `#njour` à la classe **`njsk`**
  (jetons, arc, jalons, typographie, plat), que le plein écran ET le bandeau portent ; ne restent
  sous `#njour` que ses affaires à lui (fond, colonne, barre d'action, envol, fermeture).
  `htmlArc()` et `peindreArcDans()` sortent des variables globales pour servir aux deux.
- Deux réglages seulement pour tout le bandeau : `--njb-k` (0,58) et la hauteur, **mesurée**.
- Vérifié en navigateur (375 × 812 et 375 × 667, thèmes clair et sombre) : la séquence longue
  complète, la version courte, un repas prévu avec photo, un repas sans plan (illustration), la
  journée bouclée, le tap sur l'en-tête qui ouvre le guide, et l'accueil qui reprend juste sous
  l'en-tête (hauteur mesurée, pas devinée).
- Banc `_test-journee-plat.html` (préfixe `_`, hors dépôt) : heure, thème et cas de figure en
  paramètres d'URL, plein écran optionnel — la page doit peindre pour que les animations
  tournent (§7).

---

*Contribution session « Découvrir » (Claude Opus, 9 août 2026) :*
- **Nouveau** `assets/decouverte.js` (+ copie `www/`) : le catalogue des 66 plats du monde et
  la visionneuse plein écran en geste latéral. Documenté en §3, statut en §8.
- **Nouveau** `assets/img/decouverte/` (+ `www/`) : les 96 photos fournies par Pablo (69, puis
  26 de plus — Brésil, Chine, Géorgie, Iran, Italie, Philippines, Sénégal — déposées pendant
  la session, plus la feijoada extraite d'une page enregistrée), recompressées en deux tailles
  (860 px pour le plein écran, 400 px pour les vignettes) — 10,3 Mo au lieu de 18. Trois sources écartées et pourquoi : voir §3.
- `social.html` (+ `www/`) : les trois rangées « Découvrir » **en tête d'écran et hors de
  `#fil`**, le jeu d'illustrations au trait sur les titres de section, l'assiette-globe de
  l'état vide, l'assiette sous l'emoji des plats sans photo, et la recherche qui fouille
  aussi le catalogue.
- **Deux défauts trouvés à l'écran, aucun par `node --check`** : le verre dépoli **blanc** qui
  rendait les pastilles illisibles sur une photo claire (la pastille « Vietnam » du phở
  s'affichait vide), et le voile du bas trop lourd, qui éteignait le plat que la page entière
  sert à montrer. Les deux sont détaillés en §3 — ils se retendront à la prochaine retouche.
- Aucune écriture en base : ce catalogue est entièrement embarqué, il ne dépend d'aucune
  requête et fonctionne hors ligne. Le seul geste qui écrit quelque chose est l'ajout d'un
  ingrédient à la liste de courses, qui passe par `NattyListe` et sa clé existante.

---

*Contribution session « détail d'un plat, faux raccords, menu sans scroll » (Claude Opus,
9 août 2026) — trois demandes de Pablo, trois fichiers :*
- `social.html` (+ `www/`) : le détail d'un plat devient une **page-photo** — rectangle noir
  pour le titre, bulles de verre pour les macros, description courte, et un tiroir « Voir le
  détail » qui porte les ingrédients (ajoutables aux courses) et les actions. Détail en §3.
- `assets/journee.js` (+ `www/`) : **quatre faux raccords corrigés** dans la séquence du guide
  — l'arc qui se déplaçait de 105 px d'une scène à l'autre, le bloc sortant qui bondissait au
  centre, la réserve du bas qui montait et redescendait, et les jalons qui volaient depuis un
  coin au montage. Plus le voile du bas et le tracé de l'orbite, de la même famille. Tableau
  complet en §3.
- `assets/journee.js` encore : **l'échelle du bandeau se calcule sur la place disponible**, pour
  que l'accueil tienne sans défilement sur tous les gabarits. Vérifié sur quatre tailles, dans
  les deux sens (un aller-retour petit → grand a révélé un bug de mesure).
- Vérifié en navigateur avec un banc jetable `_test-journee2.html` (préfixe `_`, hors dépôt) :
  horloge, cas de figure et mode en paramètres d'URL. Positions relevées scène par scène —
  l'arc reste à 93 px sur les trois plans, et le bloc sortant à 302 px sur les deux
  transitions.
- 🔄 **Non vérifié sur téléphone** : la fluidité réelle des transitions et le rendu des zones
  sûres n'ont pu être jugés qu'en navigateur.

---

*Contribution session « une seule visionneuse » (Claude Opus, 9 août 2026) :*
- **Nouveau** `assets/visionneuse.js` (+ `www/`) : la page plein écran d'un plat, la MÊME pour
  « Découvrir » et pour le fil social. Fond qui suit le thème, héros à 70 % avec la photo
  libre de tout élément, bulle noire du titre et bulles sombres des macros SOUS la carte,
  « Voir les détails » en texte gris, geste latéral et tap-pour-avancer. Détail en §3.
- `assets/decouverte.js` (+ `www/`) : sa visionneuse est partie dans le module partagé — 283
  lignes en moins. Ne reste que la traduction d'un plat du catalogue en item de visionneuse.
- `social.html` (+ `www/`) : la page-photo maison est remplacée par le même appel ; le geste
  latéral parcourt la **section d'où vient le plat**, et non le seul plat touché.
- Vérifié en navigateur, thèmes clair ET sombre : héros à **70,0 %** mesuré, photo sans aucun
  enfant autre que l'image, tap sur la photo qui avance d'un plat et cale la jauge, tiroir,
  ingrédients (dont un à apostrophe) jusque dans la liste de courses réelle, j'aime, « Suivre »
  qui change de libellé, retour qui referme d'abord le tiroir, et 375 × 667 sans chevauchement.
- 🔄 **Non vérifié sur téléphone** : le rendu du neumorphisme sur écran OLED et la zone sûre du
  bas n'ont pu être jugés qu'en navigateur.
