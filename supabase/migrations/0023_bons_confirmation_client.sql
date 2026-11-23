-- 0023 — La confirmation d'une commande par le client (2026-11-23).
--
-- Après chaque commande, le client reçoit un email qui récapitule ce qu'il a
-- commandé et lui demande de VALIDER (ou modifier) la date et le lieu de
-- livraison — ou de les renseigner s'ils manquent. Le lien de l'email porte un
-- jeton propre à la commande : la page publique commande.html le présente à
-- api/checkout.js, qui seul lit et écrit (clé service). Le jeton n'est jamais
-- lisible par un tiers : la RLS ne donne au client que ses propres bons.
--
-- Et la règle produit, rendue « parfaitement impossible » à contourner : une
-- commande client (abonnement, unité) n'est jamais livrée moins de 7 jours
-- après avoir été passée. Commandée un mardi, elle est livrée au plus tôt le
-- mardi suivant. L'écran, l'API et la base refont chacun ce contrôle.

alter table public.bons_commande
  add column if not exists confirmation_token     text default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists confirmation_statut    text not null default 'non_envoyee',
  add column if not exists confirmation_envoyee_at timestamptz,
  add column if not exists confirmation_nb_envois integer not null default 0,
  add column if not exists confirmee_at           timestamptz,
  add column if not exists confirmation_reponses  jsonb,
  add column if not exists modif_non_notifiee     boolean not null default false,
  add column if not exists modifiee_at            timestamptz,
  add column if not exists notifiee_at            timestamptz,
  add column if not exists annulation_motif       text;

update public.bons_commande
   set confirmation_token = replace(gen_random_uuid()::text, '-', '')
 where confirmation_token is null;

create unique index if not exists bons_commande_confirmation_token_key
  on public.bons_commande (confirmation_token);

alter table public.bons_commande drop constraint if exists bons_commande_confirmation_statut_check;
alter table public.bons_commande add constraint bons_commande_confirmation_statut_check
  check (confirmation_statut in ('non_envoyee', 'envoyee', 'confirmee', 'annulee_hors_zone'));

-- ── J+7, en base ─────────────────────────────────────────────────────────
-- Seules les commandes CLIENT sont concernées (abonnement, unité) : un bon
-- manuel du CRM — un bloc B2B, un test — reste libre, c'est l'équipe qui le
-- planifie. La date de référence est celle de la commande (`created_at`), à
-- l'heure de Paris : une commande d'un lundi 23 h 30 est une commande du lundi.
-- Le contrôle ne se déclenche que si la date de livraison CHANGE (ou à la
-- création) : un bon ancien dont on change seulement le statut ne doit pas
-- être refusé sur une règle qui n'existait pas quand il a été passé.
create or replace function public.bons_commande_j7()
returns trigger
language plpgsql
as $$
declare
  min_jour date;
begin
  if new.jour_livraison is null or new.type not in ('abonnement', 'unite') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.jour_livraison is not distinct from old.jour_livraison
     and new.type is not distinct from old.type then
    return new;
  end if;
  min_jour := (coalesce(new.created_at, now()) at time zone 'Europe/Paris')::date + 7;
  if new.jour_livraison < min_jour then
    -- À la CRÉATION, on avance de semaine en semaine (même jour) plutôt que de
    -- refuser : un webhook dont la date tombe trop tôt perdrait sinon le bon
    -- — une livraison payée qui n'existerait nulle part. Une MODIFICATION,
    -- elle, est refusée : c'est quelqu'un qui choisit la date, il doit le voir.
    if tg_op = 'INSERT' then
      while new.jour_livraison < min_jour loop
        new.jour_livraison := new.jour_livraison + 7;
      end loop;
      new.semaine := new.jour_livraison - ((extract(isodow from new.jour_livraison)::int) - 1);
      return new;
    end if;
    raise exception 'Livraison au plus tôt le % (7 jours après la commande)', to_char(min_jour, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists bons_commande_j7 on public.bons_commande;
create trigger bons_commande_j7
  before insert or update of jour_livraison, type on public.bons_commande
  for each row execute function public.bons_commande_j7();

-- ── Les comptes, pour l'onglet Clients du CRM ────────────────────────────
-- Reprise de natty_admin_clients.sql : `auth.users` n'est pas exposé par
-- PostgREST, et la fonction n'était pas en place sur l'instance.
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
