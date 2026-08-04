-- L'analyse critique d'un plat, générée UNE fois puis figée.
--
-- À quoi ça sert. Quand on ouvre un plat de l'historique (suivi.html →
-- ouvrirAnalysePlat), l'app demande à Claude une analyse critique : points
-- positifs, points à améliorer, trois conseils, substitutions. Cette analyse
-- ne doit être produite qu'UNE seule fois par plat : le plat, lui, ne change
-- plus. La regénérer à chaque ouverture, c'est payer deux fois le même texte —
-- et surtout en afficher un DIFFÉRENT à chaque fois pour un plat identique.
--
-- Sans cette colonne, tout fonctionne déjà : l'analyse est gardée dans le
-- localStorage de l'appareil (vérifié — une seule génération, affichage figé
-- ensuite). Ce que la colonne ajoute, c'est de la faire suivre d'un téléphone
-- à l'autre, et de la conserver si le cache du navigateur est vidé.
--
-- `suivi.html` détecte tout seul sa présence (`ANALYSE_EN_BASE`) : rien à
-- redéployer après l'avoir créée.
--
-- ⚠️ À exécuter dans Supabase → SQL Editor, ligne par ligne, SANS les
-- commentaires (les `--` y provoquent une erreur 42601).

alter table public.meals add column if not exists analyse_json jsonb;

-- Pas de policy à ajouter : `meals_soi` (natty_rls.sql) couvre déjà le UPDATE
-- de ses propres repas — `for all to authenticated using (auth.uid()::text =
-- user_id)`. Et la colonne n'est PAS exposée au fil social : `assets/social.js`
-- énumère les colonnes qu'il lit, il ne fait pas de `select=*`.
