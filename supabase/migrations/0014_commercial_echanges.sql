-- ═══════════════════════════════════════════════════════════
-- CRM Natty — session 12 : échanges, relances ; import de contacts
-- (docs/crm-sessions/12-commercial-echanges.md, docs/crm-spec.md §4.3, §5)
-- ───────────────────────────────────────────────────────────
-- Deux chantiers dans cette migration : la messagerie (le cœur de la
-- session 12) et deux colonnes de contact demandées par Pablo en cours
-- de session pour l'import Excel/CSV.
--
-- ⚠️ Ce que cette session NE fait PAS, et pourquoi — deux features de la
-- spec dépendent d'une décision de Pablo, pas d'un choix technique :
--   • feature 3 (email entrant) : Resend sait recevoir des emails
--     (webhook `email.received`, vérifié dans leur doc — resend.com/docs/
--     dashboard/receiving — avant d'écrire une ligne, §0 « ne pas
--     inventer »), sur un sous-domaine géré `<id>.resend.app` (zéro DNS)
--     OU sur le domaine de Natty avec un enregistrement MX. Le second
--     choix risquerait d'entrer en conflit avec la vraie boîte mail de
--     l'entreprise si elle existe déjà sur ce domaine — c'est Pablo qui
--     sait, pas nous.
--     ✅ LE CODE DU WEBHOOK EST ÉCRIT ET VÉRIFIÉ (session suivante,
--     immédiate) : fusionné dans `api/webhook.js` (déjà le webhook
--     Stripe), discriminé par le header `svix-signature` — ce n'était
--     PAS le cas quand cette phrase a été écrite la première fois, d'où
--     la correction. La vérification Svix (HMAC-SHA256 sur
--     `id.timestamp.corps`, secret `whsec_<base64>`) est testée en Node
--     contre une signature calculée indépendamment (5 cas : valide, corps
--     modifié, mauvais secret, timestamp périmé, rotation de secret).
--     🔴 IL NE REÇOIT RIEN TANT QUE, CÔTÉ PABLO : 1) un domaine/sous-domaine
--     de réception est choisi dans Resend (Dashboard → Receiving),
--     2) un webhook `email.received` y est créé, pointé sur
--     `https://natty-suivi.vercel.app/api/webhook`, 3) son « Signing
--     secret » est posé dans la variable Vercel `RESEND_WEBHOOK_SECRET`.
--     Sans cette variable, le webhook répond 500 plutôt que d'accepter
--     n'importe quel appel non signé (fail-closed, même garde que
--     `STRIPE_WEBHOOK_SECRET`).
--   • feature 6 (campagnes Hunter) : l'API Hunter expose bien des
--     endpoints Sequences/Campaigns (recipients, statuts) — vérifié —
--     mais aucune clé Hunter n'existe dans ce projet (absente de la
--     liste de secrets CLAUDE.md) : nouveau compte, coût, à la décision
--     de Pablo. Rien n'est écrit contre une API dont on n'a pas la clé —
--     TOUJOURS VRAI à ce jour, aucun changement sur ce point.
--
-- ⚠️ ORDRE D'EXÉCUTION : après 0013 (commercial fondations).
-- ═══════════════════════════════════════════════════════════

-- § 1. La messagerie — canal, sens, contenu, statut, contact, deal, fil.
--      `expediteur_email`/`destinataire_email` permettent le
--      RATTACHEMENT AUTOMATIQUE par adresse (feature 3) même AVANT que
--      contact_id soit connu — un email entrant d'une adresse inconnue
--      arrive quand même, rattachable après coup.
--      `message_id_email`/`in_reply_to` portent les en-têtes RFC 5322
--      (Message-ID / In-Reply-To) : c'est ce qui reconstitue un fil de
--      conversation, Resend transmettant ces en-têtes bruts sur un
--      email reçu — pas une clé étrangère interne, une chaîne libre.
create table if not exists public.crm_messages (
  id                 uuid primary key default gen_random_uuid(),
  contact_id         uuid references public.crm_contacts(id) on delete set null,
  projet_id          uuid references public.crm_projets(id) on delete set null,
  canal              text not null default 'email' check (canal in ('email','instagram','linkedin','autre')),
  sens               text not null check (sens in ('sortant','entrant')),
  sujet              text,
  contenu            text,
  contenu_html       text,
  statut             text not null default 'envoye' check (statut in ('brouillon','envoye','recu','echec')),
  expediteur_email   text,
  destinataire_email text,
  message_id_email   text,
  in_reply_to        text,
  auteur             text,
  lu                 boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists crm_messages_projet_idx on public.crm_messages(projet_id);
create index if not exists crm_messages_contact_idx on public.crm_messages(contact_id);
create index if not exists crm_messages_expediteur_idx on public.crm_messages(expediteur_email);
-- UNIQUE, pas un index ordinaire (ajouté à la session suivante, pour la
-- réception) : Resend, comme tout webhook, livre « au moins une fois » — un
-- même email reçu deux fois ne doit pas dupliquer la ligne. PostgREST s'appuie
-- dessus via `?on_conflict=message_id_email`. Une valeur NULL (email sans
-- Message-ID, rare) n'entre jamais en conflit avec une autre NULL — comportement
-- standard SQL, pas un cas à gérer à part.
create unique index if not exists crm_messages_message_id_idx on public.crm_messages(message_id_email);

-- § 2. Règles de relance, par profil (feature 5) — rien en dur, même
--      principe que regles_presence (module RH) : délai, nombre
--      maximum et gabarit de message se lisent ici, jamais codés.
create table if not exists public.crm_relance_regles (
  id           uuid primary key default gen_random_uuid(),
  profil_id    uuid not null references public.crm_profils_types(id) on delete cascade,
  delai_jours  int not null default 3,
  nb_max       int not null default 3,
  gabarit      text,
  actif        boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists crm_relance_regles_profil_idx on public.crm_relance_regles(profil_id);

alter table public.crm_messages       enable row level security;
alter table public.crm_relance_regles enable row level security;
create policy crm_messages_staff       on public.crm_messages       for all to authenticated using (public.est_staff()) with check (public.est_staff());
create policy crm_relance_regles_staff on public.crm_relance_regles for all to authenticated using (public.est_staff()) with check (public.est_staff());

-- § 3. Contacts — LinkedIn et Instagram en colonnes propres (demande de
--      Pablo, pour l'import par lot) plutôt que fondus dans
--      `reseaux_sociaux` (texte libre, posé en 0013) : un lien LinkedIn
--      sert à « ouvrir le profil » (§4.3 feature 3, pas d'API de
--      messagerie), un compte Instagram sert à la messagerie API Meta
--      (session 19) — les deux sont RÉUTILISÉS ailleurs, `reseaux_sociaux`
--      ne l'est pas. `reseaux_sociaux` reste pour tout autre réseau.
alter table public.crm_contacts add column if not exists linkedin_url text;
alter table public.crm_contacts add column if not exists instagram_handle text;

-- § 4. Vérification, à lancer après exécution :
--   select count(*) from crm_messages; select count(*) from crm_relance_regles; -- 0, tables neuves
--   select column_name from information_schema.columns where table_name='crm_contacts' and column_name in ('linkedin_url','instagram_handle');
--   select indexdef from pg_indexes where indexname='crm_messages_message_id_idx'; -- doit contenir UNIQUE
