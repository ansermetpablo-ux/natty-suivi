-- ═══════════════════════════════════════════════════════════════════════════
-- natty_admin_clients.sql — ce qu'il manquait à l'admin pour voir TOUS les
-- inscrits, et pour lire d'un client tout ce que l'app lui montre.
--
-- À exécuter dans Supabase → SQL Editor, D'UN SEUL BLOC.
-- (Appliqué le 2026-09-16 via MCP Supabase — ce fichier est la trace.)
--
-- CE QUE ÇA CORRIGE
--   1. La liste « Clients » lisait `onboarding?completed=eq.true` : quelqu'un
--      qui s'est inscrit sans finir le questionnaire n'y figurait pas, et
--      quelqu'un entré par Google/Apple sans jamais écrire dans `onboarding`
--      n'existait nulle part. Relevé le 2026-09-16 : 68 comptes, 36 affichés —
--      dont 18 lignes orphelines de l'époque Wix, sans compte derrière.
--      `auth.users` n'est pas lisible par PostgREST : d'où `membres_admin()`,
--      SECURITY DEFINER, qui rend UNE ligne par compte — et RIEN à qui n'est
--      pas de l'équipe.
--   2. Cinq tables du suivi n'avaient qu'une policy « soi seulement » :
--      `bilan_jour`, `seances`, `planning_semaine`, `materiel`, `garde_manger`.
--      Le nutritionniste ne pouvait donc pas voir ce que son client déclare le
--      soir, ce qu'il soulève, ce qu'il a prévu de cuisiner. Lecture SEULE
--      pour l'équipe : l'écriture reste au membre, ce sont ses réponses.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.membres_admin()
returns table (
  user_id             text,
  email               text,
  inscrit_le          timestamptz,
  derniere_connexion  timestamptz,
  fournisseur         text,
  email_confirme      boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id::text,
         u.email::text,
         u.created_at,
         u.last_sign_in_at,
         coalesce(u.raw_app_meta_data->>'provider', 'email'),
         u.email_confirmed_at is not null
  from auth.users u
  where public.est_staff();
$$;

revoke all on function public.membres_admin() from public;
grant execute on function public.membres_admin() to authenticated;

-- Lecture seule pour l'équipe sur ce que l'app affiche au membre.
drop policy if exists bilan_jour_staff_lecture on public.bilan_jour;
create policy bilan_jour_staff_lecture on public.bilan_jour
  for select to authenticated using (public.est_staff());

drop policy if exists seances_staff_lecture on public.seances;
create policy seances_staff_lecture on public.seances
  for select to authenticated using (public.est_staff());

drop policy if exists planning_semaine_staff_lecture on public.planning_semaine;
create policy planning_semaine_staff_lecture on public.planning_semaine
  for select to authenticated using (public.est_staff());

drop policy if exists materiel_staff_lecture on public.materiel;
create policy materiel_staff_lecture on public.materiel
  for select to authenticated using (public.est_staff());

drop policy if exists garde_manger_staff_lecture on public.garde_manger;
create policy garde_manger_staff_lecture on public.garde_manger
  for select to authenticated using (public.est_staff());
