-- ═══════════════════════════════════════════════════════════
-- CRM Natty — Étape 1 (socle) — § 2 : les notifications
-- ───────────────────────────────────────────────────────────
-- La brique partagée derrière « quand on assigne quelqu'un à une tâche,
-- un bloc ou un projet, il reçoit une pop-up dans le CRM ET un email
-- pour accepter l'événement dans son calendrier » (demande de Pablo,
-- 25/09/2026). Construite maintenant parce qu'elle est transversale —
-- missions (étape 2), réunions et sessions RH (§ 4.4 de la spec)
-- l'utiliseront toutes de la même façon.
--
-- ⚠️ `objet_id` N'A PAS DE CLÉ ÉTRANGÈRE pour l'instant : les tables
-- `missions`/`blocs`/`reunions` qu'il désignera n'existent pas encore
-- (étape 2). La contrainte sera ajoutée quand elles existeront —
-- pointer une FK vers une table absente ferait échouer ce fichier.
--
-- ⚠️ ORDRE D'EXÉCUTION : après 0001_membres.sql.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  destinataire      text not null references public.staff(user_id),
  objet_type        text not null,   -- 'mission' / 'bloc' / 'projet' / 'reunion'... (étape 2)
  objet_id          uuid,
  titre             text not null,
  message           text,
  canal             text not null default 'popup' check (canal in ('popup','email','popup+email')),
  lu                boolean not null default false,
  lu_le             timestamptz,
  email_statut      text check (email_statut is null or email_statut in ('a_envoyer','envoye','echec')),
  email_erreur      text,
  email_envoye_le   timestamptz,
  cree_par          text,
  created_at        timestamptz not null default now()
);

-- La pop-up sonde « mes notifications non lues » à intervalle régulier
-- (voir crm/crm-auth.js) : c'est la requête qui doit rester rapide.
create index if not exists notifications_destinataire_non_lues_idx
  on public.notifications(destinataire) where not lu;

alter table public.notifications enable row level security;

-- Lecture et « marquer lu » : uniquement SES PROPRES notifications.
create policy notifications_lire_soi on public.notifications
  for select to authenticated
  using (auth.uid()::text = destinataire);

create policy notifications_maj_soi on public.notifications
  for update to authenticated
  using (auth.uid()::text = destinataire)
  with check (auth.uid()::text = destinataire);

-- Création : n'importe quel membre actif peut notifier un collègue —
-- assigner une tâche à quelqu'un est un geste normal d'équipe, pas une
-- élévation de privilège (même niveau de confiance que le reste des
-- tables internes de ce dépôt, ex. natty_production.sql).
create policy notifications_creer_equipe on public.notifications
  for insert to authenticated
  with check (public.est_staff());

-- § Vérification, à lancer après exécution (à la clé anon, tout doit être
-- refusé ; avec une session d'équipe, chacun ne doit voir que les siennes) :
--   select count(*) from notifications;
