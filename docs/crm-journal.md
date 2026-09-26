# Journal du CRM Natty

Ce journal fait le lien entre les sessions (`docs/crm-sessions/00-README.md`, méthode).
Chaque session commence par le lire, et le termine en l'à-jourant. Il n'avait encore
jamais été écrit alors que ~19 commits de CRM existaient déjà sur la branche `crm` —
cette première entrée les résume rétroactivement, puis documente le premier vrai
incident de synchronisation entre deux sessions parallèles.

## État au 25/09/2026, fin de journée

### Ce qui est fait (branche `crm`, à jour avec `origin/crm` @ `67c0b94`)

**Étape 0-1 (socle)** — `crm.html` unique (pas de framework, pas de build), Supabase Auth
par utilisateur, table `staff` (rôles + `domaines[]` + `telephone` + `statut`), RLS via
`est_staff()`. Coquille : connexion, accueil, pop-up de notifications (`api/notifications.js`,
table `notifications` avec coût/lu/canal — le socle que session 10 étendra pour le SMS).

**Étape 2 (moteur missions/blocs/règles)** — refaite une fois (`230d1d3`) avec le schéma
qui est maintenant la référence : `crm_taches` (missions), `crm_taches_dependances`,
`crm_modeles_blocs` + `crm_modeles_bloc_taches` (`depend_de_cle` en tableau directement sur
la table, pas de table de jointure séparée pour les modèles), `crm_schema_blocs` (fusionne
le canevas de dessin libre ET l'instance de bloc — `modele_id`, `parametres`,
`date_reference`, `cout_previsionnel` y vivent), `crm_regles`. Un bloc naît d'un modèle avec
aperçu avant création, décalage en cascade (`date_reference` → toutes les échéances),
tâche déjà exécutée marquée « à revoir » plutôt que redatée en silence.

**Étape 4 / session 09 (Bloc Test produit)** — le modèle des 15 tâches de la spec §6 est
semé en base et le scénario complet a été rejoué RÉELLEMENT (pas simulé) : création,
décalage de deux jours, annulation propre (cascade dans le bon ordre parce que `bloc_id`
est `ON DELETE SET NULL` sur `crm_taches`/`bons_commande`). Action « Réserver la cuisine »
en place (fusionnée dans `api/notifications.js` derrière `{action:'reserver_cuisine'}`,
voir dette technique). Contrôle de capacité 350 plats/semaine posé.
🔄 Pas encore rebranché sur les VRAIES disponibilités RH (`indisponibilites`) ni sur un
vrai conflit de créneau cuisine entre sessions — le point d'extension existe, pas le calcul.

**Session 08 (RH : disponibilités, réunions, manquements)** — `98f9d24` + `2dfe2f4`.
Cinq tables (`indisponibilites`, `reunions`, `participations`, `manquements`,
`regles_presence` — cette dernière en clé→jsonb, rien en dur, y compris le périmètre des
rôles concernés par le suivi des manquements, point ouvert §9 rendu paramétrable). Onglet
RH avec calendrier hebdomadaire réel (réunions à leur horaire, chevauchements gérés, tâches
du jour en bande). `.ics` avec vrai DTSTART/DTEND horaire et `SEQUENCE` qui s'incrémente
(`ics_sequence` sur `reunions`) pour qu'un déplacement/annulation mette à jour l'événement
déjà accepté au lieu d'en créer un second — **c'est le bug que j'ai failli réintroduire
cette session en travaillant sur une copie obsolète, voir plus bas**.
🔄 Manque : SMS (différé à dessein, §4.4 « à brancher en dernier »), écran d'édition des
règles réservé à `admin` avec historique des changements, tableau des manquements par
personne avec taux de présence (session 10 complète).

**Production** — recettes/fiches techniques réutilisées telles quelles (existaient déjà
côté `admin.html`/app, pas dupliquées). Menus verrouillables, sessions, `crm_menus`/
`crm_menu_recettes`/`crm_sessions`. Commandes : formulaire complet natif (client, jour,
repas, type, statut, adresse, recettes × portions), calendrier 4 semaines navigable,
génération de liste de courses par jours cochés (agrégée, facteur client appliqué, casse
signalée plutôt qu'oubliée — commandes sans recette, recettes sans ingrédients). Stock
natif (`stocks_mp`, CRUD). Livraison (marquer un bon livré). **Plus aucun lien vers
`admin.html` nulle part dans `crm.html`** (vérifié : `grep admin.html` rend zéro résultat).
🔄 Le détail fin du mapping minuté (répartition des postes cuisiniers, minute par minute)
reste dans `admin.html`, assumé et dit à l'écran plutôt que reconstruit en façade — c'est
tout l'objet de la session 06 (En cuisine) qui n'a pas eu lieu.
🔄 Étiquettes, tournées, plan de rangement livreur (session 07) : pas commencés.

**Commercial** — fondations posées, pas la session 11 complète. `crm_contacts` +
`crm_interactions` (fil emails/appels), `crm_projets.etape_pipeline` (un deal EST un
sous-projet existant, donc garde son propre schéma de blocs plutôt qu'une table `deals`
séparée — écart assumé vs le schéma cible de la spec §5, à documenter si §12/13 en ont
besoin autrement). Pipeline en colonnes, glisser-déposer natif. Vues dédiées (Pipe des
ventes / Comptes & contacts / Emailing & phoning / Base de prospection / Gestion).
🔄 Manque (session 11) : `profils_types` + `profil_arguments` + `profil_objections`
(le playbook et son apprentissage — c'est le cœur de la section 4.3), fiche client avec
profil obligatoire à la création, bloc de suivi structuré (verbatims/objections/verdicts),
compteurs d'arguments, remontée `deal.etape_changee` vers le moteur de règles, données de
départ (comptes Fnac Darty et Romane Dicko).

**Documents / Modèle financier / Financement** — rendus visibles dans la navigation
(`ba135d8`, demande explicite de Pablo : « tous les chantiers visibles avant même que leur
détail métier soit construit »). Reçoivent le socle générique (tâches, sous-projets,
schéma de blocs, classeur) — RIEN de leur détail métier propre (modèles de documents
versionnés, hypothèses/prévisionnel à trois vues, dossiers/pièces/échéances) n'est
construit. Sessions 14-18 entières restent à faire.

**Navigation / UX** — barre latérale en accordéon, une activité avec interface dédiée
s'ouvre directement dessus (Commercial, Production), les autres gardent le système
générique à 5 vues (Aperçu/Tâches/Sous-projets/Schéma/Drive) sous l'onglet « Gestion ».
Documents ajoutés depuis n'importe où se rangent seuls dans l'activité Documents.

**Maintenance sans rapport, faite en passant** — `api/` ramené à 12 fonctions serverless
pile (limite Vercel Hobby) en deux fusions successives (`push-test`→`push-amis` derrière
`?diag=1`, puis `reserver-cuisine`→`notifications` derrière `{action:'reserver_cuisine'}`) ;
`ExportOptions.plist` ajouté pour l'export iOS.

### Décisions prises

- **Un seul fichier `crm.html`**, pas de split en modules JS séparés (contrairement à ma
  propre tentative locale ce soir, voir incident ci-dessous). Cohérent avec « un seul CRM ».
- **`crm_schema_blocs` fusionne canevas de dessin ET instance de bloc** — pas deux tables
  séparées comme une note antérieure (abandonnée) le supposait.
- **Un deal commercial est un `crm_projets`**, pas une table `deals` à part : il garde
  son propre schéma de blocs gratuitement.
- **`regles_presence` en clé→jsonb** plutôt qu'en colonnes fixes — plus flexible pour les
  futurs types d'événements et pour le périmètre paramétrable (§9).
- **Tous les modules de la spec sont visibles dans la nav dès maintenant**, même sans
  détail métier construit — demande explicite de Pablo, pas une anticipation de l'agent.
- **Aucun chemin ne doit mener vers `admin.html`** depuis le CRM — consigne explicite,
  tenue et vérifiée par grep à chaque session qui y touche.
- **`api/reserver-cuisine.js` et `api/push-test.js` n'existent plus** : fusionnés pour
  tenir sous la limite Vercel. Toute nouvelle fonction `api/*.js` doit vérifier le compte
  AVANT de l'ajouter (`ls api/*.js | grep -v '^api/_' | wc -l`, doit rester ≤ 12).

### Dette technique connue

- Mapping minuté cuisine : toujours dans `admin.html`, pas reconstruit (assumé, dit à
  l'écran).
- Contrôle de capacité du bloc Test produit : ne lit pas encore les vraies
  `indisponibilites` ni les conflits de créneau cuisine entre sessions.
- SMS : aucun fournisseur choisi (§9 de la spec, point ouvert — comparaison à faire et
  validation de Pablo avant tout code, session 10).
- Pas de tableau des manquements par personne avec taux de présence (session 10).
- Pas d'écran d'édition de `regles_presence` réservé à `admin` avec historique.

### Points ouverts (spec §9, non tranchés — rester paramétrable)

- Lien de commande salariés B2B : app avec compte ou page web sans compte — les deux à
  prévoir dans le modèle, aucun choix fait qui fermerait l'autre voie.
- Portion par défaut sans fiche nutritionnelle : standard ou mini-questionnaire.
- Date de clôture d'un lien de commande : paramètre, jamais une constante « J-2 ».
- Périmètre des manquements (associés seuls, ou aussi chef/livreur) : déjà rendu
  paramétrable via `regles_presence.valeur` (jsonb).
- Facturation Qonto : vérifier la doc officielle avant de concevoir (session 14).
- Service SMS : à choisir avec Pablo (session 10).

---

## Session du 25/09/2026 (soir) — synchronisation entre deux lignes de travail parallèles

**Ce qui s'est passé.** En reprenant « continue les chantiers CRM », ce checkout local avait
une branche `crm` qui n'avait pas été synchronisée depuis `52017b7` (fin de l'étape 2) :
7 commits locaux jamais poussés (un moteur missions/blocs redondant, sous
`crm/missions.js`/`crm/rh.js` — fichiers séparés, à rebours de la convention « un seul
fichier »), et du travail RH **non commité** en cours d'écriture (`crm/rh.js`, migrations
`0005_rh.sql`/`0006_activites_administratif_communication.sql`, un bloc entier dans
`crm.html`) qui redécouvrait quasiment fonctionnalité pour fonctionnalité ce que la session
RH (`98f9d24`) avait déjà construit sur `origin/crm`, avec un schéma incompatible
(`objet_type`/`objet_id` au lieu du `evenement_type`/`evenement_id` réellement déployé,
`regles_presence` en colonnes fixes au lieu de jsonb, pas d'`ics_sequence`…).

**Le signal qui a permis de l'attraper avant de committer du code cassé** : en écrivant
l'invitation `.ics` d'une réunion (feature §4.4, critère de réception explicite « se met à
jour si la réunion est déplacée »), j'allais reproduire exactement le défaut que `2dfe2f4`
avait déjà corrigé — un événement journée entière (`VALUE=DATE`) au lieu d'un horaire réel,
sans mécanisme de mise à jour. Plutôt que de le corriger localement, une vérification contre
Supabase (schéma réellement déployé, via `list_tables`/`execute_sql`) a montré que le
schéma vivant ne correspondait à AUCUN des deux jeux de fichiers migrations locaux — ni les
anciens (`0003_missions_blocs_regles.sql`…) ni les nouveaux non commités
(`0005_rh.sql`…). `git fetch` a alors révélé qu'`origin/crm` avait 10 commits d'avance,
strictement plus complets, correspondant exactement au schéma déployé.

**Résolu par synchronisation, pas par fusion manuelle** : les 7 commits locaux jamais
poussés sont préservés dans la branche `crm-local-abandonne-25sept` (rien n'est perdu,
juste mis de côté — ils décrivent un chemin alternatif pour le même objectif, devenu
redondant). Le travail non commité a été passé en stash
(`avant sync origin/crm (RH/missions locaux superseded, push-amis/CLAUDE.md/ios a garder)`)
puis la branche `crm` locale a été réinitialisée sur `origin/crm`. Les fichiers non liés au
CRM qui étaient dans le même stash (une fusion `api/push-amis.js`/`api/push-test.js`, une
documentation `CLAUDE.md`, un bump de build iOS) se sont révélés **déjà présents, à
l'identique ou en mieux, sur `origin/crm`** (comparaison faite avant toute réapplication :
`?diag=1` sur origin contre `?mode=test` en local pour la même fusion, build 4/1.1 déjà sur
origin) — rien n'avait donc besoin d'être réappliqué. Le stash reste en place par
prudence ; à purger si personne n'y revient.

**Ce que la session suivante doit savoir** :
1. **Toujours `git fetch` et comparer `origin/crm` avant d'écrire du code de session**,
   surtout un soir où plusieurs conversations tournent sur ce dépôt — c'est arrivé une
   fois de plus ici (cf. les épisodes `e01e20b`/`3d0a0ae`/`4887623` documentés dans
   `CLAUDE.md` pour l'app Natty elle-même : plusieurs sessions y écrivent en parallèle).
2. **Avant d'écrire une migration ou une requête, vérifier le schéma RÉELLEMENT déployé**
   (`list_tables`/`execute_sql` via le MCP Supabase) plutôt que de faire confiance aux
   fichiers `supabase/migrations/*.sql` du checkout local — ils peuvent être en retard sur
   ce qu'une autre session a appliqué directement.
3. Les prompts détaillés par session (`docs/crm-sessions/00-README.md` à `19-…md`) sont
   maintenant versionnés dans le dépôt — ils ne l'étaient pas avant ce soir, seule la
   spec générale (`docs/crm-spec.md`) l'était. Ce sont eux, pas l'ancienne section §8 de
   `docs/crm-spec.md` (« étapes suivantes, spécification détaillée plus tard »), qui font
   foi pour le détail de chaque session à partir de maintenant.
4. **Prochaine session logique** : la table de `docs/crm-sessions/00-README.md` donne
   06/07 (cuisine/logistique) ou 11 (commercial : fondations) comme suites possibles de
   l'état actuel — 09 (bloc Test produit) est déjà fait pour sa partie moteur, mais son
   contrôle de capacité et son action réserver-cuisine gagneraient à être rebranchés sur
   de vraies disponibilités RH une fois 06/07 avancés. Aucun choix n'a été fait à la
   place de Pablo — voir sa réponse en fin de conversation.

---

## Session 06 — En cuisine (25/09/2026, soir) — mapping, chrono, réservation, stocks

Pablo a choisi la session 06. Avant de coder : profondeur du mapping tranchée avec lui
(question posée explicitement) — **mapping simple natif au CRM, PAS un portage de
`assets/admin-production.js`** (PERT, ateliers partagés, répartition optimale entre
cuisiniers), qui reste l'outil de référence pour le détail fin, documenté à part dans
`CLAUDE.md` §3. Reconstruire cette sophistication ici aurait créé deux systèmes voués à
diverger — exactement le défaut déjà payé par `api/_nutrition.js` contre `assets/core.js`
(macros fausses envoyées en notification, des semaines durant, avant d'être vu).

### Ce qui a été fait

- **`supabase/migrations/0009_session_mapping_stocks.sql`** : `crm_session_etapes`
  (une ligne = une étape, `phase` production/assemblage, `poste`, `assigne`, `ordre`,
  `duree_prevue_min`/`duree_reelle_min`, `debut_reel`, `statut`, `depend_de[]`) + deux
  colonnes sur `crm_sessions` (`demarree_le`, `terminee_le`). **Une seule nouvelle table**
  plutôt que les trois du schéma cible de la spec (`session_recettes`, `session_postes`,
  `session_taches`) — `session_recettes` est inutile (les volumes se lisent déjà depuis
  `bons_attributions`), `session_postes` fusionné dans `assigne` sur chaque étape. Écart
  documenté dans le fichier de migration lui-même.
- **`genererMapping(sessionId)`** : lit les commandes de la session (`bloc_id` pour le
  flux « Test produit », `session_id` pour le flux normal — voir plus bas), agrège leurs
  attributions, et génère une ligne `crm_session_etapes` par étape de `recettes_etapes`
  (phase='production', déjà en base avec poste/geste/`depend_de` — CLAUDE.md §3) pour
  chaque recette, plus une ligne par (bon, recette) pour l'assemblage à la portion. Les
  dépendances (`numero` dans la fiche) sont traduites en uuid propres à la session. Les
  étapes déjà `fait` sont conservées à la régénération ; leur durée réelle nourrit la
  moyenne utilisée pour estimer les prochaines (§4.1 « améliore les estimations »),
  filtrée par `etape_source_id` — **un vrai bug trouvé en l'écrivant** : le titre stocké
  porte le nom de la recette en préfixe, un filtre par texte de titre n'aurait jamais
  matché. Corrigé avant de committer, plus un index de correction
  (`0011_session_etapes_index_correction.sql`, l'index posé dans 0009 restant, inoffensif
  mais inutilisé).
- **Vue tablette plein écran** (`ouvrirTablette`/`rendreTablette`) : grosse typographie,
  fort contraste, deux phases (par recette / par bon-assemblage), chrono de session,
  temps restant sur le créneau réservé, bouton Commencer/Terminer par étape qui capture
  la durée réelle.
- **Chrono de session** : `demarrerSession`/`terminerSession` posent `demarree_le`/
  `terminee_le` ; la tablette affiche le temps écoulé, ou le temps restant sur le
  créneau une fois celui-ci réservé (rouge si dépassé, ambre sous 10 min).
- **Créneau calculé depuis le VRAI mapping** : `dureeMappingSession()` prend le max par
  poste (ils travaillent en parallèle, pas de résolution PERT des dépendances — «
  ajustable à la main » pris au pied de la lettre). `actionReserverCuisine` l'utilise en
  priorité, avec repli sur l'ancien calcul (somme prep+cuisson du menu) si le mapping
  n'a pas encore été généré.
- **Email ET SMS comme deux canaux à part entière** (§4.2 : « pas de service payant à ce
  stade ») — avant, le lien `sms:` n'était qu'un repli si la config email manquait ;
  un bouton « Ouvrir un SMS » est maintenant toujours proposé à côté d'« Envoyer par
  email », les deux marquant la session `statut_reservation:'envoyee'`.
- **Confirmation de la cuisine, distincte de l'envoi de la demande**
  (`confirmerReservation`) : §4.2 « la mission passe en attente de confirmation jusqu'au
  clic Confirmée ». Les tâches qui dépendent de « Réserver la cuisine » affichent
  désormais « cuisine pas encore confirmée » (ambre) tant que la session liée n'est pas
  à `statut_reservation:'confirmee'` — distinct de la case à cocher de la dépendance
  elle-même, qui ne dit que « la demande a été envoyée ».
- **Stocks** : badge « bientôt périmé » (3 jours, disponible uniquement — un lot déjà
  marqué périmé ou épuisé n'a pas besoin d'un second badge) en plus du « périmé »
  existant ; bouton « + Lot de stock » sur une session de production ; **le stock
  disponible est déduit de la liste de courses** (`listeCoursesJours`) par nom exact
  insensible à la casse, g/kg seulement — une correspondance approximative ferait
  disparaître un ingrédient à tort, ce qui coûte plus cher qu'une redondance visible.

### Écart signalé par Pablo en cours de session, et corrigé

Pablo, en regardant la vue Production en direct : « je dois pouvoir voir les blocs des
prochaines commandes à produire — celles qui sont attribuées — et les sélectionner pour
planifier la session, exactement comme admin.html ». La vue Production ne montrait QUE
les sessions nées d'un bloc « Test produit » (`instancierBloc`) : aucun moyen d'y
sélectionner les commandes attribuées de la semaine, le flux RÉCURRENT et quotidien que
gère `admin.html`. Ce n'était pas dans le périmètre écrit de la session 06 — c'est un
manque de la session 05 (Commandes → courses) révélé seulement à l'usage.

Corrigé : **`bons_commande.session_id`** (`0010_bons_session_link.sql`), distinct de
`bloc_id` — deux flux, une seule table `crm_session_etapes` en aval. Nouvelle section
« À planifier » en tête de la vue Production (`vAPlanifier`) : les commandes attribuées
mais sans session, groupées par jour de livraison avec le récapitulatif recette × n
(même lecture que le calendrier d'`admin.html`), une case à cocher par jour, et
« Planifier la session de production → » qui crée la session, y rattache SEULEMENT les
bons réellement attribués de ce jour (pas tous les bons du jour — un bon non attribué
qui partagerait la date ne doit pas être happé en silence, il resterait sans mapping et
invisible), puis lance `genererMapping` dessus. C'est la partie « sélection » qui
rejoint `admin.html` ; la profondeur du mapping affiché reste la version simple
tranchée plus haut — la demande de Pablo portait sur ce que les deux ont en commun, pas
sur une régression de la décision de profondeur déjà actée dans la même session.

### Décisions prises

- Mapping simple natif, jamais un portage de `admin-production.js` (voir plus haut).
- Un poste travaille en parallèle des autres, en série avec lui-même — pas de chemin
  critique façon PERT. Assumé, § mapping.
- `bons_commande.session_id` et `bloc_id` sont mutuellement exclusifs en pratique (deux
  flux distincts) mais pas contraints en base à l'être — un bon Test produit *pourrait*
  en théorie porter les deux sans que rien ne le refuse. Pas de contrainte ajoutée : le
  code ne les mélange jamais, et une contrainte `check` sur deux colonnes nullables
  indépendantes coûterait plus qu'elle ne protège à ce stade.
- La session se date sur le PREMIER jour coché quand plusieurs jours sont sélectionnés
  d'un coup — « ajustable à la main » ensuite, comme le reste du module (le jour et le
  créneau d'une session restent modifiables après coup, aucune UI d'édition dédiée
  n'a été ajoutée pour l'instant : à faire si le besoin se confirme).

### Dette technique / points ouverts

- L'assemblage montre « combien de temps peser CE bon » (3 min forfaitaires) mais pas
  les grammes par ingrédient à peser pour la portion du client — cette précision-là vit
  dans `admin-production.js` (`portionPour()`), volontairement pas reconstruite ici.
- Aucune UI pour réassigner une étape à une personne différente après génération
  (`assigne` existe en base, rien ne l'écrit encore côté CRM) ni pour réordonner les
  étapes à la main malgré « ajustable à la main » promis par la spec — la table le
  permet (`ordre`, `PATCH` direct), l'écran ne l'offre pas encore.
- Le lot de stock créé en fin de session est manuel (bouton), pas automatique à la
  fermeture — la spec ne précise pas la correspondance exacte étape→lot, un
  automatisme aurait dû inventer cette correspondance.
- La déduction du stock dans la liste de courses ne gère que g/kg par nom exact ; ml et
  pièce ne sont pas couverts (stocks_mp n'a qu'une colonne `quantite_kg`).
- 🔄 **Rien vérifié avec une vraie session d'équipe** : `crm.html` exige une
  authentification Supabase que cette session n'a pas ; vérifié uniquement par lecture,
  `node --check` sur le script extrait, une relecture ligne à ligne des nouvelles
  fonctions (qui a trouvé et corrigé deux bugs avant commit : le filtre par titre déjà
  cité, et la sélection qui aurait pu happer des bons non attribués), et un chargement
  de la page dans le navigateur (écran de connexion, aucune erreur console). **À
  vérifier par Pablo en conditions réelles avant de considérer la session close** :
  générer un mapping sur une vraie session, cocher une étape dans la vue tablette,
  envoyer une vraie réservation (email et SMS), confirmer, créer un lot de stock.

---

## Session 07 — Logistique (25/09/2026, nuit) — étiquettes, tournées, rangement, vue livreur

Enchaînée directement après la session 06 (« continue les chantiers suivants »). Pas de
fork architectural à trancher cette fois — la profondeur reste la même logique que la
session précédente : natif au CRM, aucun service payant (géocodage, itinéraire) sans
l'accord de Pablo, conformément à la spec §4.3 à la lettre.

### Ce qui a été fait

- **`supabase/migrations/0012_logistique_tournees.sql`** : `crm_tournees` (jour, créneau
  11h-13h par défaut, livreur, statut) et `crm_tournee_arrets` (une ligne par ADRESSE
  distincte de la tournée — le regroupement B2B se fait par adresse identique, il
  n'existe pas de colonne « B2B » à part sur `bons_commande`). `bons_commande` étendue
  de `arret_id` + `contact_nom`/`contact_tel`/`instructions_acces` (portés PAR BON, pas
  par arrêt — un même lieu B2B peut avoir des contacts différents selon la commande).
- **`vLogistiqueTournees()` / nouvel onglet « Tournées »** de l'activité Logistique
  (`VUES.logistique`, jusque-là réduite aux cinq vues génériques) : liste des tournées,
  « + Tournée » qui propose les jours ayant des commandes prêtes et pas encore en
  tournée (même garde-fou que « À planifier » côté Production, session 06 — ne jamais
  happer une commande en silence), regroupe automatiquement par adresse à la création.
- **Réordonnancement manuel** (▲▼, échange de `ordre` avec le voisin) et **« Trier par
  proximité (simple) »** — un tri alphabétique sur l'adresse, explicitement présenté
  comme un heuristique et non un calcul d'itinéraire (§4.3 : accord de Pablo requis
  avant tout service payant, jamais demandé).
- **Étiquettes** : une par bon, imprimées par lot (même mécanique `window.print()` que
  la liste de courses de la session 05). Contact, plats attribués, numéro d'arrêt.
  ⚠️ Format proposé, pas figé — voir dette technique.
- **Plan de rangement** : l'ordre de tournée INVERSÉ, calculé à l'affichage plutôt que
  stocké séparément (déjà la même donnée que l'ordre des arrêts — la stocker deux fois
  aurait fini par diverger, la leçon d'`api/_nutrition.js` documentée dans `CLAUDE.md`).
- **Vue livreur plein écran** : réutilise le `#tablette`/`.tab-*` de la session 06 (même
  besoin — grosse typographie, fort contraste, un seul plein écran à la fois, jamais les
  deux en même temps en pratique) plutôt qu'un second jeu de règles CSS. Par arrêt :
  lien Itinéraire (Google Maps, ouvre l'app native sur iPhone), Appeler (`tel:`), Livré
  (avec heure), Signaler un problème. Marquer un arrêt livré marque aussi tous ses bons
  `statut='livre'` — la même vérité que lit déjà `vProdLivraison()` (préexistant), pas un
  second statut qui la contredirait.
- **Deux trous fermés avant de committer, trouvés en relisant plutôt que par
  `node --check`** : les champs contact/instructions d'accès étaient consommés par
  l'affichage (arrêts, étiquettes, vue livreur) mais n'avaient AUCUN moyen d'être saisis
  — ajoutés au formulaire de commande (`ouvrirFormBon`, session 05) ; et
  `ouvrirVueLivreur()`/`ouvrirTablette()` se disputaient le même `#tablette` sans
  s'exclure mutuellement — un minuteur de cuisine resté actif aurait réécrit la vue
  livreur par-dessus à son prochain battement. Les deux se ferment maintenant l'une
  l'autre à l'ouverture.

### Décisions prises

- Regroupement d'arrêt par adresse EXACTE (recadrée, insensible à la casse) — pas de
  correspondance floue, même principe que la déduction de stock de la session 06.
- Le format des étiquettes est une proposition, explicitement documentée comme telle
  dans le code (la spec elle-même invite à proposer, § feature 1).
- `bons_commande.contact_*`/`instructions_acces` vivent SUR LE BON, pas sur l'arrêt —
  un arrêt B2B qui regroupe cinq bons peut avoir cinq contacts différents.

### Dette technique / points ouverts

- **Date limite de consommation** : placeholder « 3 jours » écrit en dur sur l'étiquette,
  marqué « à confirmer ». Aucune règle métier n'existe ailleurs dans ce dépôt pour la
  calculer — **à trancher avec Francis** avant de considérer les étiquettes fiables.
- **Aucun allergène affiché** : rien dans le schéma actuel (`recettes`,
  `recettes_ingredients`) ne les porte au niveau d'une recette. Absence assumée plutôt
  qu'une case cochée à tort — mais c'est un vrai manque si Natty livre déjà des
  allergènes déclarés quelque part (à vérifier avec Francis/Anatole).
- **Proximité = alphabétique sur l'adresse**, pas un vrai calcul de trajet. Un vrai tri
  par proximité demanderait un service de géocodage payant — accord de Pablo requis
  avant de le brancher (spec §9, point ouvert).
- **Missions/actions du bloc Test produit non retouchées** : les tâches « Confirmer la
  tournée » et « Livrer » du modèle §6 n'ont toujours pas d'`action_cle` vers ce nouveau
  module (elles n'en avaient pas avant non plus). Le flux réel et quotidien (créer une
  tournée depuis les commandes prêtes, indépendamment d'un bloc) fonctionne pleinement ;
  le raccordement au bloc de démonstration reste à faire si Pablo le juge utile.
- 🔄 **Rien vérifié avec une vraie session d'équipe**, même limite que la session 06 :
  `node --check`, relecture ligne à ligne (qui a trouvé et corrigé les deux trous
  ci-dessus), aucun test interactif authentifié. **À vérifier par Pablo** : créer une
  tournée sur un vrai jour avec plusieurs adresses (dont une partagée par 2 commandes,
  pour confirmer le regroupement en un seul arrêt), réordonner, imprimer les étiquettes,
  ouvrir la vue livreur sur un iPhone et marquer un arrêt livré.

---

## Petit chantier — conflit de créneau cuisine (25/09/2026, nuit, suite immédiate)

En reprenant la dette de la session 09 (« rebranchement du contrôle de capacité sur les
vraies disponibilités »), vérification faite avant de coder : **c'était déjà fait**.
`controlerCapacite()` (aperçu d'un bloc) appelle déjà `chargerRH()`/`estIndisponible()`
et lit les vraies indisponibilités RH — construit par la session RH (`98f9d24`), pas par
moi. La note de la session 06 le donnait à tort comme encore à faire ; corrigé ici plutôt
que laissée fausse dans ce journal.

Ce qui manquait réellement (§09 feature 3) : le **conflit de créneau cuisine entre deux
sessions**. Ajouté à `actionReserverCuisine()` — avant d'ouvrir le formulaire, cherche une
AUTRE session du même jour déjà réservée (`envoyee`/`confirmee`) dont le créneau
chevauche le créneau par défaut proposé, et l'affiche en alerte rouge explicite (« la
cuisine ne peut recevoir deux sessions en même temps »). Vérifié sur le créneau par
défaut, pas recalculé à chaque frappe si l'utilisateur ajuste les heures à la main — la
personne qui réserve reste juge, cohérent avec « annoncé, pas simulé » (§7 de la spec).

Session 09 (Bloc Test produit) est donc désormais complète sur ses trois contrôles de
capacité annoncés : plafond 350 plats/semaine, disponibilité des rôles, conflit de
créneau cuisine. 🔄 Toujours non vérifié en conditions réelles.

---

## Session 11 — Commercial : profils, fiche client, pipeline, suivi (26/09/2026)

Enchaînée après la clôture de la session 09. Le socle Commercial existant (5f0f647/
7a4543e — `crm_projets.etape_pipeline`, `crm_contacts`, `crm_interactions`, un deal EST
un sous-projet) couvrait les fondations, mais aucun « système d'apprentissage » (§4.3) :
pas de profils types, pas de bloc de suivi, et un pipeline à 6 étapes ad hoc qui ne
correspondait pas au défaut de la spec — sans étape « Test », le critère de réception
n° 3 était structurellement impossible à satisfaire.

### Ce qui a été fait

- **`0013_commercial_fondations.sql`** — `crm_profils_types` (portrait, motivations,
  freins, langage à utiliser/éviter, offre recommandée, preuves, `sequence_pipeline`
  CONSULTATIVE — voir décisions), `crm_profil_arguments` (catalogue + compteurs
  porté/neutre/rejeté sur la ligne), `crm_profil_objections`, `crm_suivi_etapes` (le
  bloc de suivi, une ligne par interaction, `etape` COPIÉE au moment de la saisie —
  l'historique ne doit pas se réécrire si le deal avance ensuite), `crm_suivi_arguments`
  (le détail de chaque verdict). `crm_projets` étendu de `profil_id`/`budget`/
  `effectif`/`decideur`/`frequence`/`lieu_livraison` (nullable — la table sert aussi
  Production/Finance/RH, aucune régression). `crm_contacts` étendu de `fonction`/
  `role_decision`/`reseaux_sociaux`.
  ⚠️ **Appliquée en deux passes** : la première a échoué à l'insertion des deux comptes
  de départ, faute d'avoir élargi `crm_projets_etape_pipeline_check` (encore les 6
  anciennes valeurs). `apply_migration` étant transactionnel, l'échec a tout annulé —
  vérifié avant de recommencer (aucune des nouvelles tables n'existait). Le fichier local
  est la version REFAITE et seule appliquée, la correction intégrée directement.
- **Pipeline passé aux 8 étapes par défaut de la spec** (`premier_contact` → `decouverte`
  → `degustation` → `proposition` → `test` → `negociation` → `signature` →
  `client_recurrent`) + `perdu`. Aucun deal n'existait encore (vérifié avant d'élargir la
  contrainte) — rien à remapper.
- **Fiche client obligatoire** (critère 1) : `F.projet` (formulaire générique de création
  de projet) gagne un bloc `#wrapCommercial`, affiché seulement quand l'activité
  choisie est Commercial, qui refuse la création sans description ET profil.
- **Bloc de suivi avec verdicts d'arguments** (critère 2) : `ouvrirNouveauSuivi()` —
  étape, date, canal, interlocuteur, verbatims, besoins, objections, prochaine action +
  échéance, et un sélecteur de verdict (non utilisé/a porté/neutre/rejeté) par argument
  du profil du deal. Chaque verdict enregistré incrémente le compteur correspondant sur
  `crm_profil_arguments` (lu puis écrit — voir dette technique) et journalise la ligne
  dans `crm_suivi_arguments`.
- **Passage à l'étape suivante bloqué sans suivi minimum** : le glisser-déposer du
  pipeline vérifie qu'au moins un suivi existe pour l'étape ACTUELLE avant d'accepter une
  AVANCÉE (jamais en reculant, ni pour marquer « Perdu » — corriger une erreur ne doit
  pas exiger le suivi qu'on est justement en train de rattraper). Sinon : le déplacement
  est refusé, un toast l'explique, et le formulaire de suivi de l'étape s'ouvre direct.
- **Passage à « Test » → bloc Test produit pré-rempli** (critère 3) : `ouvrirNouveauBloc()`
  accepte désormais un `ctx.prefill` qui écrase la valeur par défaut d'un paramètre du
  modèle quand les clés correspondent (`lieu`, `nb_beneficiaires` — celles qu'attend le
  modèle « Test produit », 0004). Suggéré par confirmation, jamais enchaîné tout seul —
  même philosophie que `evaluerReglesApresBascule()` du moteur générique (§3.3 :
  « déterministe », pas « automatique sans validation »). Le bloc est créé avec
  `ctx.projet` = le deal, donc ses tâches apparaissent directement sur la fiche Fnac.
- **Nouvel onglet « Profils »** (Commercial) : liste des 6 profils, fiche éditable
  (playbook complet) + gestion des arguments (ajout, compteurs affichés, retrait) et des
  objections (avec réponse type).
- **Fiche client greffée sur la page projet générique** (`vFicheCommerciale`) plutôt que
  réécrite à part — la page projet porte déjà Schéma/Tâches/Drive pour tout deal, seule
  la partie spécifique (profil, budget, effectif, décideur, fréquence, lieu, playbook
  hérité en lecture, historique des suivis) s'ajoute par-dessus, visible seulement si
  `activite==='commercial'`.
- **Seed data** (§4.3 feature 8) : les 6 profils et les deux comptes Fnac Darty (grand
  compte) / Romane Dicko (athlète égérie), tous à l'étape « premier_contact », **champs
  vides** — Pablo remplit, même logique que le reste de ce chantier (les deux sessions
  Test-Produit démo l'ont déjà fait pour d'autres données).

### Décisions prises

- **`sequence_pipeline` du profil est CONSULTATIVE, pas câblée au rendu du kanban.** La
  spec demande des étapes « paramétrables par profil », mais un tableau kanban partagé
  ne peut montrer qu'un seul jeu de colonnes sans se fragmenter en plusieurs tableaux
  incomparables entre eux. Le pipeline reste sur UNE séquence commune (les 8 par défaut) ;
  `sequence_pipeline` est affichée sur la fiche playbook du profil comme recommandation,
  écart documenté dans la migration et dans le code plutôt que silencieux.
- Le compteur d'arguments est lu-puis-écrit, pas un `+1` SQL atomique — accepté, PostgREST
  n'a pas cette écriture sans fonction RPC dédiée, le risque de double-comptage manqué
  est jugé négligeable pour une équipe de six.
- Pas de tables `comptes`/`deals` séparées du schéma cible §5 : `crm_projets` reste le
  compte/deal, cohérent avec la décision déjà prise en 5f0f647.

### Dette technique / points ouverts

- **Lien avec les clients existants de l'app, sans doublon** (§4.3 feature 1, dernière
  clause) : PAS construit. Rapprocher un contact/compte CRM avec un `user_id` déjà
  inscrit dans l'app (via `onboarding`) demanderait une recherche croisée et une UI de
  rapprochement — non fait, à faire si Pablo le juge prioritaire.
- **Kit documentaire** (`crm_profils_types.kit_documentaire`, jsonb) : colonne posée,
  vide — son branchement réel est explicitement session 17 (Documents), pas avant.
- **Événement `deal.etape_changee` générique** : câblé en dur pour le seul cas « Test »
  (le seul que demande la spec et le critère de réception), pas remonté vers le moteur
  de règles `crm_regles` comme un événement générique que d'autres règles pourraient
  écouter. À généraliser si un second cas apparaît.
- 🔄 **Rien vérifié avec une vraie session d'équipe** : `node --check`, relecture ligne à
  ligne des fonctions nouvelles (aucun bug trouvé cette fois qui n'ait été corrigé avant
  écriture — contrairement aux sessions 06/07). **À vérifier par Pablo** : créer un deal
  sans description (doit être refusé), ajouter 3 arguments à un profil puis un suivi qui
  en utilise 3 avec des verdicts différents (les compteurs doivent bouger), faire glisser
  le deal Fnac Darty jusqu'à « Test » (doit demander confirmation puis pré-remplir lieu
  et effectif dans le bloc Test produit).

---

## Petit chantier — fiche technique de production (PDF) depuis une commande (25/09/2026)

Demande de Pablo : depuis une commande, pouvoir choisir les recettes à produire et
générer leur fiche technique ; deux recettes cochées veut dire fiche mélangée ; ajouter
un filtre par poste ; la fiche doit être aussi précise que l'écran-par-écran d'admin.html.
Puis, en cours de session : les quantités de la liste de courses en grammes ET en unités
(pièces), et à la fin de la fiche technique le détail par commande de la répartition des
matières premières, « comme dans assemblage ».

**Emplacement, tranché avec Pablo** : le bouton **« 📄 Fiche technique »** vit dans la
fiche d'édition d'une commande (`ouvrirFormBon`), à côté de « Supprimer » — visible
seulement pour une commande existante qui porte au moins une recette attribuée. Format :
une page HTML imprimable (`window.print()`), même mécanique que « Étiquettes » et
« Liste de courses » — pas de librairie PDF de plus.

**`ouvrirFicheTechnique(bonId)`** propose les recettes attribuées à CETTE commande
(cochées par défaut) et un menu **Poste** (« Tous les postes » ou un poste précis, tiré
des étapes `phase=production` de ces recettes). **`genererFicheTechnique()`** ne s'arrête
pas à la commande de départ : elle couvre TOUTES les commandes du même jour de livraison
qui demandent la ou les recettes cochées — on produit un lot une fois, pas une fois par
client, exactement le principe déjà en place dans `genererMapping()` (session 06). Sans
jour de livraison, la fiche ne couvre que la commande seule.

**Fusion de deux recettes = regroupées par poste, dans l'ordre** (tranché avec Pablo) :
mêmes clés de tri que `genererMapping()` (`poste||geste||'—'`, puis l'ordre des recettes
cochées, puis `numero`), mais **sans écrire en base** — imprimer n'a pas d'effet de bord,
inutile de créer des `crm_session_etapes` pour ça.

**Précision de chaque étape** — numéro, titre, geste, poste ; la **quantité calculée sur
le total du lot** (`quantitesEtape`, mot à mot contre `recettes_ingredients`, jamais en
sous-chaîne : vérifié que « ail » ne matche pas « volaille », voir le banc plus bas) ;
consigne complète ; durée/température/découpe quand la fiche les donne ; « attente » si
l'étape est passive ; et le **savoir général du geste** — le même contenu que « Détails »
dans l'écran-par-écran d'admin.html, via `NattySavoir.html()` (`assets/admin-savoir.js`,
933 lignes déjà écrites pour cet écran, chargées ici plutôt que récrites — règle 44 du
dépôt Natty : un rendu partagé vit dans UN module).

**Répartition par commande, à la fin** (ajout demandé en cours de session, « comme dans
assemblage ») : une section par (commande, recette) — client, portions, facteur s'il
existe, et le détail ingrédient par ingrédient EN GRAMMES pour la portion de CE client —
même calcul que la phase `assemblage` de `genererMapping()` (`quantite_g × nb_portions ×
facteur ÷ nb_portions de la fiche`), simplement rendu en HTML imprimable plutôt qu'écrit
en base.

**Liste de courses : grammes ET pièces** — `pieceCompte()`/`pieceHtml()`/`pieceTxt()`
(nouveaux, à côté de `libBon`) s'appuient sur `NattyUnites.estPiece()`/`.quantite()`
(`assets/unites.js`, déjà écrit pour le `+` de l'app cliente) pour afficher « 2,4 kg
(≈ 12 œufs) » à côté du poids — sur l'écran, dans l'impression et dans le texte copié.
Zéro table de poids-par-pièce de plus à tenir à jour : c'est la même que celle du client.

**Deux modules chargés en plus dans `crm.html`** : `<script src="/assets/unites.js">` et
`<script src="/assets/admin-savoir.js">`, avant le script unique du CRM. Aucune
dépendance, aucun effet de bord au chargement (IIFE qui ne font que poser
`window.NattyUnites`/`window.NattySavoir`) — le reste du fichier reste un script unique.

**Ce qui n'a PAS été reconstruit, volontairement** : ni le PERT, ni les ateliers partagés
entre recettes, ni la répartition optimale des postes entre cuisiniers d'admin.html — la
profondeur du mapping reste celle tranchée en session 06 (« ajustable à la main », pas une
résolution de dépendances). Ce chantier ajoute un DOCUMENT imprimable, pas un second
moteur de planification.

**Vérifié au banc** (Node, en chargeant réellement `assets/unites.js` et
`assets/admin-savoir.js`, pas des copies) : `motsCorrespondent('ail','Volaille')` → faux,
`motsCorrespondent('ail','Gousse d’ail')` → vrai ; `quantitesEtape` sur une recette à deux
ingrédients, mise à l'échelle ×3 (18 portions-équivalent pour une fiche à 6) → le bon
grammage ; `pieceCompte('oeuf',660)` → 12 œufs (accord pluriel automatique) ;
`pieceCompte('poulet',900)` → aucune pièce (le poulet nu n'est pas dans la table, donc pas
de chiffre inventé) ; `NattySavoir` sur « mijoter le chili » (le piège classique de la
famille « plat ») et « dresser bourguignon + pommes de terre » (l'aiguillage sauce/bol) →
les deux bons cours. `node --check` sur le script unique du fichier : syntaxe valide.

🔄 **Non vérifié avec une vraie session d'équipe ni contre les vraies fiches en base** :
`admin.html`/`crm.html` exigent une session staff, absente ici. Tout a tourné contre des
données fabriquées à la main.

---

## Session 12 — Commercial : échanges, relances, IA (25/09/2026)

Reprise d'un chantier déjà largement engagé, **non commité, trouvé tel quel dans l'arbre
de travail** au début de cette session : messagerie (`crm_messages`), boîte unifiée
(fusion `crm_interactions`/`crm_messages`), envoi d'email via Resend
(`api/notifications.js`, action `envoyer_message_commercial`), import de contacts
Excel/CSV, colonnes LinkedIn/Instagram, et la configuration des règles de relance sur
chaque profil (`crm_relance_regles`, formulaire dans `ouvrirProfilDetail`). Cette partie
n'est pas de moi — cette entrée la documente parce qu'aucune ne l'avait encore fait, en
même temps que ce qui suit, qui l'est.

### 🔴 Bug bloquant trouvé et corrigé : `verifierRelances` n'existait pas

`vInterfaceCommercial()` (l'écran Pipeline) appelait `await verifierRelances()` dès sa
première ligne — **la fonction n'était définie nulle part**. Ouvrir l'onglet Commercial
aurait levé une `ReferenceError` et affiché un écran vide, sans qu'aucun message
n'explique pourquoi. Le formulaire de configuration de la règle (délai, plafond,
gabarit) était donc écrit, mais rien ne la faisait vivre.

**Le moteur, maintenant écrit** (`verifierRelances()`, juste avant `PIPELINE_ETAPES`) —
fondé sur `crm_messages` (canal email) seulement, pas sur `crm_suivi_etapes` : une
« relance » attend une réponse à un EMAIL, un appel loggé n'attend pas de réponse de la
même façon.
- Le dernier email **sortant** du deal donne le point de départ ; un email **entrant**
  plus récent que lui vaut réponse — **arrêt automatique**, exactement le mot de la spec.
- Une relance déjà **en attente** (`action_cle='relance_commerciale'`, statut ≠ fait)
  n'est jamais recréée : la fonction est rappelée à CHAQUE ouverture de l'écran
  (`vInterfaceCommercial` la relance sans mémoire de si elle vient de tourner), c'est ce
  contrôle qui rend ça idempotent plutôt qu'un verrou temporel.
- Une relance en attente dont le contact a répondu ENTRE-TEMPS est **annulée
  automatiquement** (`annulerRelance`, statut → `fait`, description qui dit pourquoi) —
  ce n'était pas juste « ne pas en créer une nouvelle », c'est aussi rattraper celle
  déjà posée.
- Le plafond (`nb_max`) compte TOUTES les relances de ce deal, faites ou non — sans quoi
  une règle « 3 relances maximum » en aurait laissé passer indéfiniment une fois les
  précédentes cochées.
- `action_cle:'relance_commerciale'` réutilise le champ déjà posé par le moteur de
  missions générique (`crm_taches.action_cle`, session 03) plutôt que d'ajouter une
  colonne ou de filtrer sur le texte du titre — un filtre par titre aurait été fragile
  au moindre nom de deal contenant des caractères spéciaux.

**Vérifié au banc** (Node, les fonctions extraites du fichier, `sbTry`/`sb`/`S` doublés) :
6 deals couvrant les 6 cas — jamais contacté (rien), délai dépassé sans réponse (**créée**),
délai dépassé mais contact ayant répondu avec une relance déjà pendante (**annulée**),
plafond déjà atteint (rien), relance déjà en attente (pas de doublon), étape « perdu »
(exclu d'office). Les 6 rendent exactement ce qui était attendu.

### Feature 3 (email entrant) — le code est écrit, il ne reçoit encore rien

La migration `0014_commercial_echanges.sql` annonçait « le code du webhook est prêt » —
**c'était faux au moment où c'était écrit** : `api/webhook.js` n'avait ni Svix ni
`email.received`, vérifié par grep sur tout le dépôt avant de commencer. Corrigé, dans le
commentaire de la migration et dans le code.

**Recherché avant d'écrire une ligne** (Resend n'était pas dans mes connaissances à jour) :
la doc officielle confirme `email.received` en webhook, signé Svix, payload MÉTADONNÉES
SEULEMENT (`email_id`, `from`, `to`, `subject`, `message_id`) — le corps texte/html et
`in_reply_to` demandent un second appel, `GET /emails/receiving/{email_id}`. La
vérification Svix : en-têtes `svix-id`/`svix-timestamp`/`svix-signature`, HMAC-SHA256 sur
`{id}.{timestamp}.{corps brut}`, secret `whsec_<base64>`, signature(s) `v1,<base64>`
séparées par des espaces (rotation de secret possible).

**Fusionné dans `api/webhook.js`** (déjà le webhook Stripe) plutôt qu'une route à part :
`api/` est exactement à 12 fonctions, le plafond Vercel Hobby — même raison qui a déjà
fait fusionner `push-test`→`push-amis` et `reserver-cuisine`→`notifications` (CLAUDE.md).
Le discriminant est le header lui-même : `svix-signature` pour Resend, `stripe-signature`
pour Stripe, jamais les deux à la fois.
- Rattachement automatique par adresse : `crm_contacts.email` cherché en `ilike` (pas de
  correspondance floue), pose `contact_id`/`projet_id` s'il trouve, laisse les deux à
  `null` sinon — un expéditeur inconnu arrive quand même, rattachable à la main.
- Idempotent : `?on_conflict=message_id_email`, qui a demandé de passer l'index existant
  en **UNIQUE** dans la migration (une valeur NULL n'entre jamais en conflit avec une
  autre NULL — comportement standard, pas un cas à gérer à part).
- Fail-closed sur `RESEND_WEBHOOK_SECRET` absente (500, même garde que
  `STRIPE_WEBHOOK_SECRET`) — jamais un webhook qui accepterait un appel non signé faute
  de configuration.

**Vérifié au banc** (Node, `crypto.subtle` — le même Web Crypto que l'edge runtime) : une
signature Svix calculée indépendamment avec `node:crypto` est acceptée ; un corps modifié,
un mauvais secret, un timestamp de plus de 300 s sont tous les trois rejetés ; une liste de
deux signatures dont une seule valide (rotation) est acceptée. 5 cas, 5 corrects.

🔴 **Ne reçoit RIEN tant que Pablo n'a pas, côté Resend** : choisi un domaine de réception
(sous-domaine `<id>.resend.app` sans DNS, ou le domaine de Natty avec un enregistrement MX
— **risque de conflit avec une vraie boîte mail d'entreprise**, donc sa décision et non la
mienne), créé le webhook `email.received` pointé sur
`https://natty-suivi.vercel.app/api/webhook`, et posé son secret de signature dans la
variable Vercel `RESEND_WEBHOOK_SECRET`.

### Feature 6 (campagnes Hunter) — toujours non commencée, et ça reste juste

Vérifié à nouveau que rien n'a changé : aucune clé Hunter dans ce projet, aucune dans les
secrets connus. La spec elle-même le dit — « à la décision de Pablo » —, et rien n'est
écrit contre une API dont on n'a pas la clé. **Pas un oubli, un blocage réel** : il faut un
compte Hunter (Sequences/Campaigns), une clé API, et l'accord sur le coût, avant la
moindre ligne.

### Feature 8 (détection de bloc depuis un compte-rendu)

Ajoutée à la MÊME analyse que la feature 7 (« remplir depuis des notes ») plutôt qu'un
second appel IA : le prompt demande en plus un `bloc_propose:{proposer,raison,lieu,
nb_beneficiaires}`, et le modèle n'y répond `proposer:true` que si les notes évoquent
clairement un test produit ou une dégustation à venir — jamais pour un rendez-vous
ordinaire (consigne explicite dans le prompt).

« Soumis à l'aperçu du moteur » est tenu au pied de la lettre : le bouton qui apparaît
(« 📦 Proposer le bloc → ») n'ouvre que `ouvrirNouveauBloc({projet, prefill})`, DÉJÀ
écrit pour le passage manuel « Test » du kanban (critère 3 de la session 11) — qui passe
de toute façon par `ouvrirApercuBloc` et son propre contrôle de capacité avant la moindre
écriture. Rien n'est créé par l'IA elle-même, exactement le même principe que la feature 7
(« jamais d'envoi automatique »).
⚠️ Cliquer le bouton ferme le formulaire de suivi en cours SANS l'enregistrer — accepté :
proposer un bloc est un geste plus lourd qu'un suivi, et les deux n'ont pas à cohabiter
dans le même clic.

### Décisions prises

- **Les relances ne regardent que le canal EMAIL**, jamais les suivis loggés à la main :
  une règle qui compterait un appel comme une « réponse » confondrait deux choses
  différentes (on répond à un email, on rapporte un appel).
- **Le plafond `nb_max` compte tout l'historique**, pas seulement les relances en cours —
  sinon un plafond de 3 ne freinerait jamais rien une fois les trois premières cochées.
- **`api/webhook.js` reste le seul webhook**, Stripe et Resend confondus, discriminés par
  le header de signature — pas de 13ᵉ fonction sur le plan Hobby.
- **Aucune ligne écrite contre l'API Hunter sans clé** — cohérent avec la décision déjà
  prise dans la migration, reconduite ici après re-vérification.

### Dette technique / points ouverts

- **Feature 6 (Hunter) entièrement à faire**, bloquée sur un compte/une clé — décision de
  Pablo.
- **Feature 3 codée mais inerte** tant que le domaine de réception, le webhook Resend et
  `RESEND_WEBHOOK_SECRET` ne sont pas posés côté Pablo (voir ci-dessus, trois actions
  précises).
- **Aucun envoi d'email n'a été fait en conditions réelles** (ni sortant ni entrant) :
  `RESEND_API_KEY`/`RESEND_FROM` supposées déjà posées (elles servent déjà au récap de
  commande de `api/webhook.js`), mais le chemin `envoyer_message_commercial` n'a jamais
  été appelé pour de vrai.
- 🔄 **Rien vérifié avec une vraie session d'équipe** : `crm.html` exige un compte staff,
  absent ici. Le moteur de relances est vérifié au banc (fonctions réelles, doublures de
  Supabase), pas contre la base réelle.
- **À faire par Pablo avant que la feature 3 serve à quelque chose** : choisir le domaine
  de réception dans Resend (Dashboard → Receiving), créer le webhook `email.received` →
  `https://natty-suivi.vercel.app/api/webhook`, poser `RESEND_WEBHOOK_SECRET` sur Vercel.
- **Critères de réception de la session, à revérifier avec Pablo une fois testés en
  réel** : un email envoyé et sa réponse dans le même fil (dépend du point ci-dessus) ;
  une relance proposée au bon délai et qui disparaît si le contact répond (vérifié au
  banc, pas en réel) ; des notes de RDV qui produisent un bloc de suivi exploitable
  (feature 7, déjà en place avant cette session).

### 🔴 Bug trouvé en reprenant ce chantier : l'index de `message_id_email` n'était pas UNIQUE

En vérifiant l'état réel de la base (pas seulement le texte de la migration) avant de
continuer : `0014_commercial_echanges.sql` déclare `create unique index if not exists
crm_messages_message_id_idx …`, mais **l'index réellement posé en base, sous ce nom,
n'était PAS unique** — un simple btree (`pg_indexes` le confirme). `if not exists`
compare sur le NOM, pas sur les propriétés : une fois un index non-unique créé sous ce
nom, réexécuter la même instruction avec `unique` en plus ne change rien, Postgres voit
un objet homonyme et saute la création. Sans correction, `api/webhook.js` aurait échoué
en **`42P10`** (« no unique constraint matching the ON CONFLICT specification ») au tout
premier email reçu — exactement le piège déjà documenté pour `meal_likes`/`membre_amis`
dans CLAUDE.md, ici sur une table neuve de cette même session.

**Corrigé par `supabase/migrations/0015_crm_messages_message_id_unique.sql`** (`drop
index` + `create unique index`, appliqué — la table était vide, aucun doublon à purger).
Vérifié après coup, à la clé service : `pg_indexes` confirme `CREATE UNIQUE INDEX`, et
**deux lignes avec `message_id_email` à NULL s'insèrent sans conflit** (comportement
standard d'un index unique sur NULL, mais vérifié plutôt que supposé) — donc un email
entrant sans Message-ID connu n'empêchera jamais un second email d'être enregistré.

### La règle de relance et « réponse reçue », côté écran (session 12, suite)

Deux pièces manquaient encore pour que le critère 2 soit *vérifiable*, pas seulement
codé : le formulaire de configuration d'une règle par profil, et un moyen d'obtenir une
ligne `crm_messages` en sens `entrant` avant que le webhook Resend existe.
- **Formulaire de règle** (délai, plafond, gabarit, actif) ajouté dans
  `ouvrirProfilDetail()`, sous « Arguments »/« Objections » — une ligne par profil,
  PATCH si elle existe déjà, POST sinon (même schéma que le reste du drawer).
- **« 📥 Réponse reçue »** (`ouvrirEnregistrerReponse`), à côté de « ✉️ Envoyer un email »
  dans la fiche contact : consigne à la main une ligne `crm_messages` en `sens='entrant'`
  sur le deal du contact. Tant que le webhook Resend n'est pas branché côté Pablo (voir
  ci-dessus), c'est le SEUL chemin par lequel une réponse peut exister dans la base — donc
  le seul moyen de vérifier, avec de vraies données, que `verifierRelances()` ferme bien
  une relance quand le contact répond. Une fois branché, ce bouton reste utile (réponse
  reçue par un autre canal, appel rapportant une réponse orale).

Vérifié : `node --check` sur le script unique de `crm.html`, aucune fonction dupliquée
(`grep` sur les déclarations top-level), et `api/webhook.js`/`api/notifications.js`
passent `node --check --input-type=module` / `node --check`.
🔄 **Toujours pas de vraie session d'équipe** : les deux ajouts n'ont été vus qu'en
lisant le code, pas cliqués dans le navigateur.

---

## Finance — Opérationnel : prévisionnel de coûts/revenus par session (26/09/2026)

Demande de Pablo, en un message : un volet « Opérationnel » sous Finance, avec le
prévisionnel des coûts matière (prix Metro × quantités de la session sélectionnée) et
cuisine (heures × tarif), le prévisionnel de vente (9 €/10,50 € modifiable), un héros
gain/perte qui s'actualise en direct, des facteurs ajustables (heures, quantité moyenne
par recette, répartition des prix) qui écrivent en production une fois validés, un
bouton de réinitialisation, deux graphiques (répartition par poste, détail par matière
première), et le rapprochement avec la facture Metro réelle (écarts de prix, portions
bonus depuis un surplus d'achat).

**Ce n'est ni une session numérotée de `docs/crm-sessions/`, ni entièrement dans
`docs/crm-spec.md`** — la spec (§3.4, §4 module 6, §5) décrit un « modèle financier
unique » avec Qonto et Stripe (sessions 14/15, jamais commencées) ; ce chantier en est
une **tranche verticale, sans Qonto ni Stripe**, scopée à UNE session de production à la
fois. Documenté ici parce que rien d'autre ne le documente encore.

### Ce qui a été investigué avant d'écrire une ligne
Un audit complet du terrain (Finance actuellement une activité NUE dans `VUES`, le
concept de session de production de la session 06, où vivent les prix Metro, les
tables recettes/portions, `bons_commande`, et un mécanisme de facture) a précédé le
code — trois risques bloquants identifiés et traités explicitement plutôt qu'ignorés :
- **`recettes_etapes.poste` est NULL sur les 317 lignes** : `dureeMappingSession()`
  retombe sur `geste` (14 valeurs) et fait un MAX dessus, donc une hypothèse de 14
  cuisiniers en parallèle — largement optimiste. Plutôt que de prétendre ce chiffre
  fiable, les heures de cuisine sont **éditables** dans le panneau, avec la note
  explicite affichée à l'écran quand la source est « mapping ».
- **`recettes_ingredients.ingredient_id` est NULL sur les 345 lignes** (deux
  nomenclatures coexistent, Metro vs génériques) : le rapprochement recette → prix se
  fait donc par **nom exact insensible à la casse**, la même règle que
  `listeCoursesJours()` (§06) — jamais de correspondance approximative, un ingrédient
  sans correspondance est **annoncé « non chiffré »**, jamais compté à zéro en silence.
- **`ingredients_base.prix_kg_moyen` est vide partout** (0/40) ; seul `prix_achat_ht`
  (18/40, au COLIS) existe. Prix au kg = `prix_achat_ht ÷ poids_colis_kg` ; sans les
  deux, prix inconnu et dit comme tel.

### Schéma — `supabase/migrations/0016_finance_operationnel.sql`
- **`crm_tarifs`** (clé/valeur, RLS staff) — les trois tarifs de la spec (§1 : 9 € abo,
  10,50 € unité) et le tarif horaire de la cuisine (30 €/h), qui vivait EN DUR à deux
  endroits de `crm.html` (`actionReserverCuisine` et `cout_previsionnel`). Plus jamais
  en dur : spec §3.3, « tous les seuils dans une table de règles ».
- **`crm_sessions.heures_cuisine_override` / `.nb_repas_unite_override`** — deux
  réglages éditables par session, NULL = calcul automatique.
- **`factures_fournisseur.session_id`** — deux tables (`factures_fournisseur`,
  `lignes_facture`) existaient déjà en base, créées hors de toute migration versionnée,
  jamais référencées nulle part dans le dépôt (`grep` : 0 résultat). Elles couvrent
  presque exactement le besoin « facture Metro réelle » — **adoptées** plutôt que
  recréées à côté, avec le seul manque comblé (`session_id`).

### Refactor fait au passage — le tarif cuisine n'est plus dupliqué
`actionReserverCuisine()` (§4.2, la réservation réelle de la cuisine) calculait les
heures et le coût avec `const marge=30,heures=Math.max(1,Math.ceil((minutes+marge)/60))`
et `heures*30` **en dur**, à l'endroit exact où le panneau Finance a besoin du MÊME
calcul. Extrait en `MARGE_CUISINE_MIN`/`heuresDepuisMinutes()` (près de
`dureeMappingSession`) et `tarif('tarif_cuisine_h',30)`, réutilisés aux deux endroits —
sans ce refactor, Finance aurait recopié le calcul et les deux auraient divergé à la
première retouche (le défaut déjà payé par `api/_nutrition.js` vs `core.js` dans l'app
principale, cité en exemple dans CLAUDE.md).

### Architecture du panneau — trois temps, pour un recalcul instantané
1. **`donneesSessionFinance(sessionId)`** — LA seule requête réseau par session choisie
   (bons de la session via le même ternaire bloc_id/session_id que `genererMapping()`,
   leurs attributions, les ingrédients des recettes concernées, la table de prix, le
   mapping minuté).
2. **`calculerFinance(raw, edit)`** — fonction PURE, aucun accès réseau, rappelée à
   CHAQUE frappe dans le formulaire. Un seul `<div id="finLive">` est réécrit à chaque
   recalcul (pattern déjà en place dans le fichier, cf. `somme()` du formulaire de bon de
   commande) — les champs de saisie eux-mêmes restent hors de ce conteneur, jamais
   réécrits, donc jamais de perte de focus pendant la frappe.
3. **`rapprochementFacture(calc, lignesFacture)`** — pure aussi, ne s'active que si une
   facture a été ajoutée à la session.

**La « quantité moyenne par repas » éditable est un facteur, pas une nouvelle table** —
elle se lit et s'écrit sur `bons_attributions.facteur`, la colonne que le système utilise
déjà pour scaler les portions au client (§ production, `natty_production.sql`). Éditer
cette moyenne dans Finance et cliquer « Valider » réécrit `facteur` pour TOUTES les
attributions de cette recette dans la session — c'est très exactement « ça change la
production » demandé, sans inventer un second mécanisme de scaling.

**Portions bonus (rapprochement facture)** : goulot d'étranglement PAR RECETTE parmi ses
ingrédients — un ingrédient de la recette sans donnée d'achat suffit à annuler tout bonus
pour cette recette (`connu=false`), plutôt qu'une estimation à moitié fondée. Vérifié au
banc : une recette dont un seul ingrédient (avocat, à la pièce, prix inconnu) manque de
données reste à 0 bonus même si tous ses autres ingrédients ont un surplus large.

**« Réinitialiser » ne touche JAMAIS `bons_attributions.facteur`** — seulement les édits
locaux non validés et les deux colonnes `*_override` de `crm_sessions` (remises à NULL).
Une fois validée, une quantité de production n'a pas de « valeur d'origine » sûre à
restaurer automatiquement (elle a pu être ajustée ailleurs, avant même ce panneau) —
revenir dessus sans le demander explicitement serait la même classe d'erreur qu'un
« reset » qui écraserait une donnée client réelle.

### Vérifié
**Banc Node** (`calculerFinance`/`rapprochementFacture`/`tarif`/`heuresDepuisMinutes`
extraits du fichier — jamais une copie à la main, une copie ne prouverait que la copie) :
43 contrôles sur une fixture à 2 recettes/4 bons/2 ingrédients chiffrés — agrégation de
coût, filtrage strict g/kg, priorité édition locale > override session > mapping,
répartition du CA avec bornes (jamais négative, jamais au-delà du total), bons sans
recette attribuée signalés, moyenne pondérée des facteurs, sens de l'écart de prix, sens
de l'effet sur la marge (un coût réel plus bas AUGMENTE la marge), goulot d'étranglement
multi-ingrédients pour les portions bonus, repli du tarif si `crm_tarifs` est vide,
arrondi à l'heure pleine avec marge de 30 min. **43/43 bons du premier coup après une
seule correction — d'un chiffre attendu dans MON banc de test**, pas dans le code : le
calcul du coût matière réel utilise le besoin de la session au prix réel (pas tout
l'achat facturé), pour ne pas mélanger le coût de cette session avec un surplus qui
profite à une session future — vérifié que c'est la bonne sémantique avant de corriger
le test plutôt que le code.
**Rejoué dans le navigateur contre les VRAIES fonctions de la page** (pas ma copie
extraite) — mêmes 15 valeurs, résultat identique au chiffre près. Rendu HTML des
fonctions d'affichage (`heroHtml`, `panneauxPrevisionnelHtml`, `facteursFormHtml`,
`graphiquesHtml`, `panneauRapprochementHtml`) : aucun `undefined`/`NaN`, parse sans
erreur. `wireFinanceIfPresent()` ne plante pas hors du panneau (garde `#finRoot`).
Routage vérifié : `VUES.finance` enregistré, `vueParDefaut('finance')` = `'operationnel'`,
`ACT_BY_CLE.finance` toujours présent.
**Bug de style trouvé et corrigé avant tout ça** : le formulaire des facteurs utilisait
`.two`/`.form label`/`.form .inp`, des classes scopées `.form .xxx` en CSS — sans
wrapper `.form` autour, les champs auraient perdu leur mise en page (labels non
empilés, largeur non pleine). Corrigé en enveloppant dans `<div class="form">`.

### Dette technique / points ouverts
- 🔄 **Aucune vraie session d'équipe, aucune vraie session de production avec des
  données réelles** : la base ne compte qu'1 session de production et 0 facture à ce
  jour (CLAUDE.md). Tout a été vérifié au banc et contre les fonctions réelles de la
  page, jamais cliqué avec un compte staff sur des données de production réelles.
- **Pas d'import automatique de la facture (OCR)** : la saisie est manuelle
  (désignation + datalist des noms `ingredients_base`, quantité, unité, prix unitaire) —
  délibérément, pour garder la qualité du reste du chantier plutôt que de caser une
  extraction IA en plus (le pattern existe déjà dans `admin.html`, réutilisable plus
  tard si demandé).
- **`recettes_etapes.poste` reste NULL** — chantier à part, hors du périmètre
  d'aujourd'hui, qui rendrait les heures de cuisine fiables PAR DÉFAUT au lieu de
  dépendre de la correction manuelle dans le panneau.
- **Pas de synchronisation Qonto/Stripe** — hors périmètre, spec §3.4/§5, sessions
  14/15 jamais commencées.
- **La marge cible et les seuils d'alerte** (session 15, feature 6) ne sont pas dans ce
  chantier — celui-ci montre la marge, il ne la compare pas à un objectif.

---

## Finance — Opérationnel refondu : tableau, page de détail, équipe, pièces (26/09/2026, soir)

Demande de Pablo, suite directe du chantier précédent : en arrivant sur Opérationnel,
un **tableau** de toutes les sessions (ou de toutes les commandes, selon un filtre),
chaque ligne avec son résultat en vert ou en rouge et une **pastille vert foncé** quand
toutes les pièces sont reliées ; un **héros** avec le résultat moyen et la marge par
produit ; une **équipe de cuisine** chiffrée (postes, nombre, taux prévu × heures
prévues, puis taux et heures réellement payés) ; **plusieurs pièces** par session,
analysables ; et, au clic, une **page de détail** : prévu à gauche, réel à droite,
tableau des matières prévu/acheté avec les plats réalisables en plus, analytique des
charges par poste et du poids de chaque aliment, filtrable par recette.

### Schéma — `supabase/migrations/0017_finance_tableau_equipe_pieces.sql` (appliquée)
- `factures_fournisseur.categorie` (`mp` / `cuisine` / `vente`, défaut `mp`) et
  `fichier_nom` : la table portait déjà `fichier_url` et `montant_total` — une pièce de
  cuisine ou de vente est une ligne de plus, pas une table de plus.
- `crm_session_equipe` : une ligne par poste, RLS staff. `heures_prevues` NULL = les
  heures de cuisine de la session.

### Les règles de calcul, et ce qu'elles refusent de faire
- **Coût cuisine = location + équipe.** La facture de cuisine REMPLACE la location
  prévue (elle en est la version réelle) ; l'équipe réelle vient des taux/heures réels,
  champ par champ, le prévu comblant ce qui manque — et la ligne le dit (« réel partiel »).
- **Pastille « reliée »** : achats de matières AVEC lignes (sans lignes, le rapprochement
  est impossible, donc le « réel » matière ne serait que le prévu), facture de cuisine
  avec montant, justificatif de vente avec montant. Le tableau affiche le **réel** d'une
  ligne dès que les trois y sont, le **prévisionnel** sinon, et écrit lequel.
- **Matière réelle = matière CONSOMMÉE au prix facturé**, pas le total acheté : le
  surplus est du stock (il est affiché à part, « pour mémoire », et sert aux plats en plus).
- **Une commande porte sa part** : CA au tarif de son type, recalé sur le CA de la
  session (qui porte la répartition 9 €/10,50 € éditable) ; matière selon SES recettes ;
  cuisine au prorata des portions équivalentes. Vérifié au banc : la somme des commandes
  redonne exactement la session, et la marge par produit est identique dans les deux filtres.
- **Écart de prix = écart AU KILO.** La première version comparait des totaux (36 € pour
  2 kg contre 24 € prévus pour 1,2 kg) et affichait en rouge un bœuf payé MOINS cher au
  kilo : l'effet quantité, déjà dans la colonne voisine, était compté deux fois. Vu à
  l'écran, pas au banc.
- **Par recette, l'achat est réparti au prorata du besoin** — une facture ne dit pas à
  quelle recette un kilo était destiné. Écrit sous le tableau.
- **Plats en plus à la quantité MOYENNE produite** (grammage de fiche × facteur moyen de
  la session), chaque recette seule sur tout le surplus — non cumulables, écrit. Un
  ingrédient sans surplus relevé (ou en ml/pièce) annule le calcul et est nommé.

### Pièces et IA
Upload Cloudinary (même chemin que le Drive), une pièce par fichier. Pour une photo,
`/api/claude` en vision lit fournisseur, date, numéro, montant et, pour les achats, les
lignes — en rattachant chaque ligne à un ingrédient de la session par son nom EXACT
(liste fournie dans le prompt), faute de quoi elle reste « non rattachée » plutôt que
rattachée au hasard. Les PDF sont joints mais pas analysés (`/api/claude` n'accepte que
des images) — l'écran le dit. Ré-analyse possible depuis la pièce.

### Refactor au passage
`minutesDepuisEtapes()` extrait de `dureeMappingSession()` : le tableau calcule les
heures de TOUTES les sessions en une requête, sans recopier l'algorithme.

### Vérifié
Banc Node sur les fonctions extraites du fichier (jamais recopiées) : **47/47**, dont
quatre attendus que j'avais faux à la main (besoin en carottes, facteur qui supprime le
surplus) — corrigés dans le banc après vérification, pas dans le code. Navigateur, avec
`sbTry` doublé : tableau (2 sessions, pastille sur la complète), filtre commande
(3 lignes), page session (colonnes, équipe éditée en direct 2 × 16 € × 5 h = 160 €,
filtres par recette, surplus au prorata, plats en plus), page commande, 375 px sans
débordement. Un défaut de mise en page corrigé (montants qui passaient à la ligne).
🔄 Rien avec une vraie session d'équipe ni une vraie pièce : l'analyse IA d'une photo de
facture n'a pas été jouée.
