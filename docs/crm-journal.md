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
