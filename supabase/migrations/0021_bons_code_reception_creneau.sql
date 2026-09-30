-- Appliquée par MCP le 2026-09-30.
-- « Ma commande » (offre.html) : code de réception à donner au livreur,
-- créneau horaire, statut « en livraison », et deux fonctions :
--   modifier_adresse_bon  — le CLIENT change son adresse (le CRM lit la même ligne)
--   confirmer_livraison   — l'ÉQUIPE confirme une livraison avec le code du client
alter table public.bons_commande
  add column if not exists code_reception text default lpad((floor(random()*10000))::int::text, 4, '0'),
  add column if not exists creneau_livraison text,
  add column if not exists livre_at timestamptz,
  add column if not exists livre_par text;
update public.bons_commande set code_reception = lpad((floor(random()*10000))::int::text, 4, '0') where code_reception is null;
alter table public.bons_commande drop constraint if exists bons_commande_statut_check;
alter table public.bons_commande add constraint bons_commande_statut_check
  check (statut = any (array['a_attribuer','attribue','en_production','en_livraison','livre','annule']));

create or replace function public.modifier_adresse_bon(p_bon uuid, p_adresse text)
returns int language plpgsql security definer set search_path = public as $$
declare b record; n int;
begin
  if auth.uid() is null then raise exception 'Session requise'; end if;
  if p_adresse is null or length(trim(p_adresse)) < 5 then raise exception 'Adresse invalide'; end if;
  select * into b from bons_commande where id = p_bon and user_id = auth.uid()::text;
  if not found then raise exception 'Commande introuvable'; end if;
  if b.statut in ('en_livraison','livre','annule') then raise exception 'Commande déjà en route'; end if;
  -- La commande, et les semaines à venir du même abonnement.
  update bons_commande set adresse = left(trim(p_adresse), 480), updated_at = now()
   where user_id = auth.uid()::text and statut in ('a_attribuer','attribue','en_production')
     and (id = p_bon or (b.abonnement_id is not null and abonnement_id = b.abonnement_id));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.modifier_adresse_bon(uuid, text) from public, anon;
grant execute on function public.modifier_adresse_bon(uuid, text) to authenticated;

create or replace function public.confirmer_livraison(p_bon uuid, p_code text, p_par text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if not est_staff() then raise exception 'Réservé à l''équipe'; end if;
  update bons_commande set statut = 'livre', livre_at = now(), livre_par = p_par, updated_at = now()
   where id = p_bon and code_reception = trim(p_code) and statut <> 'annule'
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function public.confirmer_livraison(uuid, text, text) from public, anon;
grant execute on function public.confirmer_livraison(uuid, text, text) to authenticated;
