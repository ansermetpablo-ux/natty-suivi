# Prompts Claude Code — CRM Natty

## Mode d'emploi

1. Place la spécification générale dans le dépôt : `docs/crm-spec.md` (fichier `prompt-claude-code-crm-natty.md` déjà fourni).
2. Une session Claude Code = un prompt. Ouvre une nouvelle session, colle le contenu du fichier de la session, et laisse Claude Code proposer son plan avant de coder.
3. Chaque session se termine par la mise à jour de `docs/crm-journal.md`. C'est ce journal qui fait le lien entre les sessions : la session suivante le lit en premier.
4. Ne passe à la session suivante que lorsque les critères de réception de la précédente sont validés.
5. Si une session déborde, arrête-la proprement (journal à jour, commit) et relance le même prompt en précisant « reprends là où le journal s'arrête ».

## Les sessions

| # | Session | Contenu | Prérequis |
|---|---|---|---|
| 00 | État des lieux | Inventaire du dépôt, de Supabase, de la sécurité, choix technique. Aucun code. | — |
| 01 | Socle | Connexion par utilisateur, membres et rôles, RLS, coquille du CRM | 00 |
| 02 | Admin intégré | Commandes, clients, menu, messagerie repris dans le CRM | 01 |
| 03 | Moteur missions | Missions, blocs, règles, dépendances, recalage, planning de la semaine | 01 |
| 04 | Recettes et menus | Ingrédients, fiches techniques, menus avec verrouillage | 02 |
| 05 | Des commandes aux courses | Liens de commande, attribution, clôture, volumes, sessions, liste de courses | 03, 04 |
| 06 | En cuisine | Mapping minuté, vue tablette, créneau calculé, réservation cuisine, stocks | 05 |
| 07 | Logistique | Étiquettes, tournées, plan de rangement du livreur | 05 |
| 08 | Disponibilités et réunions | Indisponibilités, réunions, invitations agenda, confirmations de présence | 03 |
| 09 | Bloc Test produit | Le bloc de bout en bout, contrôles de capacité | 06, 07, 08 |
| 10 | Notifications et présence | SMS et emails automatiques, constat de présence, manquements | 08 |
| 11 | Commercial : fondations | Comptes, contacts, profils types, pipeline, blocs de suivi | 03 |
| 12 | Commercial : échanges | Boîte unifiée email, relances, campagnes Hunter, pré-remplissage IA | 11 |
| 13 | Scénarios de deal | Jalons, messages rattachés, simulation chiffrée, lien vers les blocs | 11, 12 |
| 14 | Finances : les flux | Ventes Stripe, synchronisation Qonto, lecture des factures Metro | 04 |
| 15 | Finances : l'analytique | Clés de répartition, imputations, marges, écarts | 05, 14 |
| 16 | Modèle financier | Hypothèses, prévisionnel, plan de financement, trois vues | 15 |
| 17 | Documents | Modèles par profil, génération, versions, validation, envoi | 11, 16 |
| 18 | Financement et accueil final | Dossiers de financement, accueil personnalisé, alertes consolidées | 16 |
| 19 | Instagram et LinkedIn | Messages Instagram via Meta, assistance LinkedIn | 12 |

## Pourquoi cet ordre

La production passe en premier (sessions 02 à 09) parce que le test Fnac et l'engagement Romane Dicko en ont besoin dès novembre, et parce que les coûts et les marges dépendent des fiches techniques et des sessions. Le moteur de missions (03) arrive tôt car tous les modules s'y branchent. Le commercial (11 à 13) vient ensuite, puis les finances (14 à 16) pour que la Focale du 9 décembre puisse sortir du CRM. Les documents (17) arrivent après le modèle financier et les profils, dont ils tirent leur contenu. Les canaux sociaux (19) sont en dernier : ils dépendent de comptes et d'autorisations externes.

Si une priorité change, certaines sessions peuvent être avancées : 08 peut passer avant 07, 11 avant 10, et 14 dès que 04 est faite. Les prérequis du tableau indiquent ce qui est possible.
