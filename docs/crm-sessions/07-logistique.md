# Session 07 — Logistique : étiquettes, tournées, rangement

## Avant de commencer

Lis `docs/crm-spec.md` (spécification de référence, en particulier la section 0 sur la méthode de travail) puis `docs/crm-journal.md` (état d'avancement et décisions prises). En cas de contradiction entre ce prompt et le journal, le journal l'emporte sur l'existant, ce prompt l'emporte sur le périmètre : signale-moi l'écart.

Commence par me présenter ton plan pour cette session (fichiers, migrations, choix techniques, ordre) et attends ma validation avant de coder.


## Objectif

Faire sortir les repas de la cuisine jusqu'au client. Étiquette, rangement et tournée se suivent : chaque bon devient un colis étiqueté, les colis sont rangés dans l'ordre de la tournée, la tournée les livre.

## Features

1. **Étiquettes** par bon de commande : nom, plat, date de production, date limite, consignes de conservation et de réchauffe, allergènes éventuels, ordre dans la tournée. Impression par lot, format à me proposer.
2. **Tournées** : date, créneau (11 h-13 h par défaut), livreur, arrêts générés à partir des bons à livrer (adresse, contact, instructions d'accès, nombre de colis). Un lieu B2B regroupe tous ses bons en un seul arrêt.
3. **Ordre des arrêts** : manuel au départ, avec une proposition simple par proximité. N'utilise un service de calcul d'itinéraire payant qu'avec mon accord.
4. **Plan de rangement** pour le livreur : quels colis charger, dans quel ordre, pour quel arrêt (le premier livré chargé en dernier).
5. **Vue livreur sur téléphone** : liste des arrêts, bouton itinéraire (ouvre l'application de navigation), appel du contact, « livré » avec heure, signalement d'un problème.
6. **Missions et actions** : « Confirmer la tournée » (veille), « Prévenir les clients du créneau » (email) ; la livraison marquée faite clôt les missions liées.

## Critères de réception

- Pour 40 bons dont un lieu B2B, la tournée, les étiquettes et le plan de rangement sont générés correctement.
- La vue livreur fonctionne sur iPhone et enregistre l'heure de livraison.

## Hors périmètre

Notifications SMS automatiques (session 10).

## Fin de session

1. Vérifie chaque critère de réception et dis-moi lesquels sont validés.
2. Vérifie qu'il n'y a aucune régression sur le site client, l'app, le paiement et les modules déjà construits.
3. Mets à jour `docs/crm-journal.md` : ce qui a été fait, décisions prises, écarts par rapport à la spec, dette technique, points ouverts, ce que la session suivante doit savoir.
4. Commit sur la branche `crm` et résumé de fin de session.
