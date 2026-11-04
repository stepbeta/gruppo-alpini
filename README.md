# gruppo-alpini test project

A unified, production-ready **Next.js (App Router)** repository integrated with **Supabase** — TypeScript, Tailwind CSS, ESLint, version-controlled database migrations, VS Code debugging, and free deployment on Vercel.

## Tech stack

| Layer      | Tool                                             |
| ---------- | ------------------------------------------------ |
| Framework  | Next.js 16 (App Router, Turbopack, TypeScript)   |
| Styling    | Tailwind CSS 4                                   |
| Linting    | ESLint 9 (`eslint-config-next`)                  |
| Database   | Supabase (PostgreSQL) via `@supabase/supabase-js`|
| Migrations | Supabase CLI (local, version-controlled SQL)     |
| Hosting    | Vercel (free tier)                               |

## Project structure

```txt
gruppo-alpini/
├── app/
│   ├── layout.tsx       # Root layout: HTML shell, fonts, global styles, AuthProvider
│   ├── page.tsx         # Landing page (authenticated members)
│   ├── login/           # Login, password recovery and new-password pages
│   ├── profile/         # Member profile, credentials and account deletion
│   ├── eventi/          # Event calendar, RSVP, admin event/template management and totals
│   ├── iscritti/        # Member directory + admin profile editing/deletion
│   ├── richieste/       # Generic requests form + admin secretariat board
│   ├── avvisi/          # Admin announcement banner management
│   ├── admin/manuale/   # Admin-only in-app reference guide
│   ├── api/             # Server-side route handlers (account deletion)
│   ├── privacy/         # Public, server-rendered privacy policy
│   └── globals.css      # Tailwind & global styles
├── components/          # Shared UI: auth screens/forms, header, footer, icons, dialogs
├── lib/
│   ├── supabase.ts      # Initialized singleton browser Supabase client
│   ├── supabase-admin.ts # Server-only Supabase client for Auth admin API
│   ├── auth-actions.ts  # Password recovery, credentials and Italian auth errors
│   ├── auth-redirect.ts # Safe post-login return paths and pending OAuth deep links
│   ├── profile.ts       # Profile/approval types, read/upsert/admin/delete helpers
│   ├── events.ts        # Event/RSVP types, formatting and data helpers
│   ├── event-templates.ts # Event-template types, validation and CRUD helpers
│   ├── requests.ts      # Generic request types, formatting and data helpers
│   ├── announcements.ts # Announcement banner types, visibility and CRUD helpers
│   ├── consent.ts       # Privacy consent check and acceptance
│   ├── data-export.ts   # GDPR JSON/HTML export, formatting and download
│   ├── organization.ts  # Cached public organization settings for /privacy
│   ├── privacy.ts       # Privacy policy version and path
│   └── display.ts       # Display-name and initials helpers
├── scripts/
│   └── generate-privacy-meta.mjs # Last-modified metadata for /privacy
├── supabase/
│   ├── config.toml      # Local Supabase stack configuration (CLI)
│   └── migrations/      # Version-controlled SQL migrations
├── .vscode/
│   └── launch.json      # Run & debug configs (server, client, full stack)
├── .env.local           # Local environment variables (git-ignored)
├── package.json         # Dependencies & scripts
└── README.md            # This file
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create/fill in `.env.local` in the project root (it is git-ignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-or-secret-key>
```

Both public values are available in the Supabase dashboard under the **Connect** panel (or **Project Settings → API Keys**).
Until they are set, the homepage gracefully displays a "not configured" message instead of crashing.

`SUPABASE_SERVICE_ROLE_KEY` is **server-only** and must never be prefixed with
`NEXT_PUBLIC_`. It is used exclusively by `app/api/account/delete/route.ts` to
call the Supabase Auth admin API when a member deletes their account or an
administrator deletes another member. A newer Supabase secret key
(`sb_secret_…`) can be provided instead as `SUPABASE_SECRET_KEY`. Account
deletion is unavailable until one of these two variables is set.

The privacy consent flow and the GDPR data export do **not** need the service
key: consent is written to `user_consents` under RLS, and exports call the
`export_user_data` RPC with the member's own session.

### 3. Configure authentication

In the Supabase dashboard:

1. **Authentication → Providers → Email** is enabled by default. You can keep
   email confirmation on or off; the login page handles both cases.
2. **Authentication → Providers → Google**: add the OAuth Client ID and Client
   Secret from Google Cloud Console.
3. **Authentication → URL Configuration**: set the Site URL and add the app
   origins **and the recovery page** to **Redirect URLs**:
   - `http://localhost:3000`
   - `http://localhost:3000/login/reset-password`
   - `https://<your-production-domain>`
   - `https://<your-production-domain>/login/reset-password`

The app redirects OAuth and email-confirmation links back to the site origin;
the recovery email points to `/login/reset-password`. Supabase must allow both
the origin and that path or the redirect is rejected.

### Password recovery and credential management

- `/login/forgot` requests a reset email with
  `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. It always shows
  a generic confirmation so the page does not reveal whether an email is
  registered.
- The recovery link lands on `/login/reset-password`. The browser Supabase
  client has `detectSessionInUrl` enabled, so the implicit-flow hash creates a
  temporary recovery session; the page then calls
  `supabase.auth.updateUser({ password })`. Expired or reused links show an
  Italian error with a shortcut to request a new one.
- `/profile` → **Sicurezza e credenziali** lets email/password users change
  their password or request an email change. Email changes require the
  confirmation link sent by Supabase before the new address becomes active.
- Google OAuth users do not see the password/email forms: the page explains
  that credentials are managed by their Google account. The forgot-password
  page shows the same warning.
- Supabase's default email service is limited to about 2 messages per hour and
  is intended for testing; configure **Custom SMTP** before relying on password
  recovery in production.
- All auth errors (weak password, expired recovery token, email already in use,
  rate limits, expired session, etc.) are translated in
  `lib/auth-actions.ts`.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are
redirected to the login page. After signing in, the landing page shows the
member area, links to `/profile`, `/eventi` and `/iscritti`, and a footer link to
the public `/privacy` page. Administrators also see a **Manuale amministratore**
shortcut and a **Manuale** link in the header.

### Closed registration and account approval

- New accounts are created with `approval_status = 'pending'` by the
  `handle_new_user` trigger. They can sign in and accept the privacy policy, but
  `AuthGuard` shows the Italian **Account in attesa di approvazione** screen
  instead of the portal until an administrator approves them.
- Profiles that existed before
  `20261102030000_member_approval_workflow.sql` are grandfathered as `approved`,
  so current members and administrators keep working.
- An administrator opens **Iscritti → Modifica** on a member and uses **Approva
  iscritto** or **Rifiuta richiesta**. Approved accounts can be rejected later
  with **Revoca approvazione**; rejected accounts can be approved again. The
  dialog does not allow changing the administrator's own status.
- The directory shows **In attesa** and **Rifiutato** badges to administrators,
  and the pending-count pill filters the list to accounts waiting for a
  decision. Regular members only receive approved profiles.
- The client gate is UX only: restrictive RLS policies block pending and
  rejected accounts from reading events, responses, requests, shop data and
  announcements, or from writing member data, even through direct API calls.
  They can still read their own profile (needed by the holding screen), manage
  their privacy consent, export their data and delete their own account.
- `is_current_user_approved()` treats administrators as approved so an
  accidental status change cannot lock every administrator out of account
  repair.

### Administrator manual

- `/admin/manuale` is an in-app guide written for administrators, covering
  roles, closed registration and approvals, member maintenance, events and
  RSVPs, event templates, the secretariat board, announcements, and privacy
  operations.
- The route uses `AuthGuard` and then `AuthProvider.isAdmin`. Approved members
  who are not administrators see an **Accesso riservato** panel. The manual is
  linked from the header and from an administrator-only card on the home page;
  neither link is rendered for other members.
- The manual is static content. There is no migration or new Supabase policy.
- Whenever a feature is added, changed, or removed, or a migration/policy
  changes, update `app/admin/manuale/admin-manual.tsx` in the same pull request
  and refresh `MANUAL_LAST_UPDATED`. The same rule appears in the file header
  and at the bottom of the page.

### Member directory and privacy

- `/iscritti` is protected by `AuthGuard` and lists approved `profiles` rows
  with name, birth date, enlistment year, and service place. Administrators also
  receive pending and rejected accounts so they can decide on registrations.
  The search box filters by name or service place.
- Members with `is_admin = true` can edit any member's four profile fields from
  the directory. Non-admin members only see the read-only list. Supabase RLS is
  the real authorization boundary; the UI check is only for convenience.
- `/privacy` is public (no login required) so it can be linked from the login
  page and satisfies OAuth provider requirements. It is a server-rendered page:
  crawlers and visitors without JavaScript can read the full policy. Controller
  details and the policy date are described in
  [Privacy, consent and data portability](#privacy-consent-and-data-portability).

### Events and RSVP

- `/eventi` is protected by `AuthGuard` and lists upcoming events first, with
  past events in a separate section. Each card shows title, description, date,
  time, and location.
- Dates and times are displayed and entered in the Italian format
  `gg/mm/aaaa` and `HH:mm` (strict 24-hour time, no AM/PM). The time is
  optional: when omitted, the event is treated as all-day and only
  `dd/mm/yyyy` is shown.
- Signed-in members can choose **Presente**, **In forse**, or **Assente** for
  each upcoming event. The selected response is highlighted and can be changed
  at any time; responses to past events are read-only.
- Every event card has **Condividi**. On devices that support the Web Share API
  it opens the native share sheet (WhatsApp, Messages, email, and so on);
  otherwise it copies the direct link `/eventi?event=<id>` to the clipboard.
  Shared links stay behind `AuthGuard`: a logged-out visitor is sent to
  `/login?next=<event-link>` and returned to the event after signing in. The
  events page scrolls to the matching card and highlights it as **Evento
  condiviso**; a deleted or unknown event shows a short notice instead. OAuth
  and email-confirmation round trips keep the destination in `sessionStorage`
  until the session, privacy consent and account approval are ready.
- Members with `is_admin = true` also see **Nuovo evento**, **Modifica**, and
  **Elimina** controls. Deletion asks for confirmation and also removes the
  event's responses. Every event card includes attendance totals plus the
  explicit names of members in each category (present, tentative, absent) and
  optionally those who have not responded yet.
- Administrators can reuse event details through **Modelli evento**. A template
  stores title, description, location, all-day flag, and — for timed templates
  only — a default start time; the date is always chosen per event. Templates
  can be created, edited, and deleted from the dedicated dialog on `/eventi` or
  from the create-event form. Selecting a template pre-fills the form without
  changing the date, and the edit-event form offers **Salva come modello** to
  capture the current details. Templates are visible only to administrators.
- Event attribution is database-owned: `created_by` is filled from `auth.uid()`
  on insert and cannot be changed through the API, so an administrator cannot
  forge another member's identity.
- Non-admin members never see other members' responses: the Phase 1D migration
  limits `event_responses` reads to the owner, with an admin-only exception for
  totals and names.

#### Promote a member to administrator

There is no separate admin-management screen yet. To make a member an
administrator, run this in the Supabase SQL editor with the member's profile UUID:

```sql
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.profiles set is_admin = true where id = '<PROFILE_UUID>';
commit;
```

The Phase 1B trigger intentionally blocks changes to `is_admin` from a normal
SQL session; the temporary service-role claim is the database-owner escape hatch.

### Generic requests and secretariat board

- `/richieste` is protected by `AuthGuard`. Any signed-in member can send a
  request, inquiry, or note to the group secretariat; the form stores it in
  `generic_requests`.
- The page lists the member's own requests with their status (`In attesa` or
  `Risolta`) and submission time.
- Members with `is_admin = true` also see the **Bacheca della segreteria**:
  every request from every member, with the author's name, a status filter, and
  buttons to mark a request as resolved or reopen it.
- RLS lets members read only their own rows and administrators read all rows.
  Only administrators can update the status, and the Phase 1E migration grants
  `UPDATE` on the `status` column only. Blank or whitespace-only messages are
  rejected by a database check constraint, even through direct API calls.

### Account deletion and historical data

- A member can delete their own account from the **Elimina account** section at
  the bottom of `/profile`. The action opens a confirmation dialog that requires
  typing `ELIMINA`.
- Administrators can delete another member from **Modifica** → **Elimina
  account** in `/iscritti`. The same strict confirmation dialog is used.
- Browser code never holds the service role key. It calls
  `POST /api/account/delete` with the current access token; the route validates
  the session, checks `is_admin` server-side when the target is another member,
  and only then calls `supabase.auth.admin.deleteUser`.
- Historical references to `profiles(id)` use `ON DELETE SET NULL` so shared
  records survive:
  - `events.created_by`
  - `event_templates.created_by`
  - `event_responses.user_id`
  - `generic_requests.user_id`
  - `purchase_orders.user_id`
  The auth user and profile are removed, but event RSVPs, requests, and
  reusable event templates are kept with a `NULL` author. `event_responses`
  rows still carry their status, so past event attendance totals remain
  correct; the UI labels them **Socio eliminato**.
- Removing an event still deletes its responses, as before.

### Announcement banners

- `public.announcement_banners` stores platform-wide messages. The migration is
  `supabase/migrations/20261102020000_announcement_banners.sql`.
- All authenticated members can read banners that are active and inside their
  optional date window. Only administrators can create, edit, toggle and delete
  them; the policies call `is_current_user_admin()`.
- The header banner is rendered by `components/announcement-banner.tsx` inside
  `components/site-header.tsx`, so it appears on every authenticated page.
  Failures are silent: a missing migration never breaks the rest of the portal.
- When several banners are active and in their window, the portal shows the most
  recently created one. `lib/announcements.ts` implements the same rule for the
  header and the admin page, so administrators can see which banner is live.
- A banner with no dates stays visible until it is deactivated or deleted.
  `start_date`/`end_date` are optional and inclusive.
- Administrators manage banners from `/avvisi`, linked from the home page and
  from `/iscritti`. The page lets them create, edit, activate/deactivate and
  delete banners. Scheduled, expired and inactive banners stay in the admin list
  but are hidden from members by RLS.
- The first migration to apply for this feature is
  `20261102020000_announcement_banners.sql`; run `npm run db:push`.

### Privacy, consent and data portability

#### Dynamic public privacy page

- `/privacy` is not wrapped in `AuthGuard` and there is no middleware, so it is
  reachable by anonymous visitors, crawlers and browsers with JavaScript
  disabled. The route is prerendered and revalidated hourly.
- The data controller details come from the single-row
  `public.organization_settings` table. Set them once from the Supabase SQL
  editor (the service role or dashboard already has the necessary privileges):

  ```sql
  update public.organization_settings
  set organization_name = 'Gruppo Alpini — Sezione di …',
      address = 'Via …',
      contact_email = 'segreteria@example.it',
      dpo_email = 'dpo@example.it'
  where id = true;
  ```

  `updated_at` is refreshed automatically. Empty address/email fields render a
  neutral “non ancora pubblicato” fallback instead of inventing contact data.
- The “Ultimo aggiornamento” date is the **maximum** between the settings row's
  `updated_at` and the last modification of `app/privacy/page.tsx`.
  `scripts/generate-privacy-meta.mjs` runs automatically before `dev`, `build`
  and `typecheck`, uses the git commit date for a clean file and the file mtime
  for uncommitted edits, and writes the git-ignored
  `lib/generated/privacy-page-meta.ts`.
- When the policy text changes, update `PRIVACY_POLICY_VERSION` in
  `lib/privacy.ts`. Members whose latest consent refers to an older version are
  asked to accept the new one at their next visit.

#### Mandatory first-time consent

- After email/password signup, email confirmation or Google login,
  `AuthProvider` checks `user_consents` for the current policy version. If no
  matching row exists, `AuthGuard` replaces the requested page with the blocking
  **Consenso necessario** screen.
- The checkbox links directly to `/privacy` and the **Accetta e continua**
  button stays disabled until it is checked. Acceptance inserts an append-only
  row with the policy version; the database forces `accepted_at = now()`.
- Refusing does not grant access. The screen offers **Esci senza accettare** and
  **Elimina il mio account** (the same typed confirmation dialog used on the
  profile page). Signing out leaves the account blocked; an administrator can
  delete it later from `/iscritti`.
- Instead of relying only on the client gate, restrictive RLS policies call
  `has_accepted_privacy_consent()` on `profiles`, `events`, `event_responses`,
  `generic_requests`, `event_templates`, `purchase_items` and `purchase_orders`.
  An unconsented authenticated account cannot read or write member data even
  through direct PostgREST calls. Existing members are asked to accept once
  after this migration is applied — this is expected.
- To find accounts that signed up but never accepted (for example after an
  abandoned registration), run this query in the Supabase SQL editor and delete
  the relevant rows from `/iscritti`:

  ```sql
  select p.id, p.full_name
  from public.profiles p
  left join public.user_consents c on c.user_id = p.id
  where c.user_id is null
  order by p.updated_at;
  ```

#### Data export (access and portability)

- `/profile` → **Esporta i miei dati** downloads the signed-in member's data.
  The same buttons are available to administrators in **Iscritti → Modifica**
  for the selected member, so a request can be fulfilled offline.
- The export includes:
  - profile fields (name, birth date, enlistment year, service place, admin
    flag, last update);
  - auth user ID, email, creation/confirmation dates and last sign-in;
  - every event RSVP with event title, date, location and Italian status label;
  - every generic request with message, creation date and resolution status;
  - the full privacy-consent history (version and acceptance timestamp).
- Three formats are offered: **JSON** for portability, plain **text** for email
  or quick reading, and a standalone, print-ready **HTML** document for paper
  delivery. All are generated in the browser from data returned by the server.
- The export is produced by the `export_user_data(uuid)` SECURITY DEFINER RPC.
  It authorizes the caller explicitly: a member can export only their own data,
  while an administrator who has accepted the policy can export any member's
  data. The browser never needs the service role key.
- The migration that adds the settings table, consent history, restrictive
  policies and export RPC is
  `supabase/migrations/20261102000000_gdpr_privacy_consent_and_data_export.sql`;
  `20261102010000_gdpr_export_consent_guard.sql` closes the remaining
  SECURITY DEFINER admin bypasses. Apply both **before** deploying the frontend
  that expects them.

---

## Database migrations (Supabase CLI)

Migrations live in `supabase/migrations/` and are plain, version-controlled SQL files applied in filename order.

### Initialize & link a project

```bash
# One-time: creates supabase/config.toml (already committed in this repo)
npx supabase init

# Link this repo to your cloud Supabase project (find <REF_ID> in
# the dashboard URL: https://supabase.com/dashboard/project/<REF_ID>)
npx supabase link --project-ref <REF_ID>
```

`supabase link` prompts for the database password and records the project ref in `supabase/config.toml`.

### Push local migrations to the cloud database

```bash
npx supabase db push
# equivalent: npm run db:push
```

This applies every pending file in `supabase/migrations/` to the linked cloud project.

### Local development stack (optional)

```bash
npm run db:start        # spin up local Postgres + Studio + API (Docker required)
npm run db:reset        # re-apply all migrations from scratch
npm run db:migrations   # list applied/pending migrations
npm run db:new <name>   # scaffold a new timestamped migration file
npm run db:stop         # stop the local stack
```

After `npm run db:start`, the local API URL is `http://127.0.0.1:54321` and the local publishable/anon key is printed by the CLI — point `.env.local` at those values for fully offline development.

### Creating new migrations

```bash
npm run db:new add_profiles
# → supabase/migrations/<timestamp>_add_profiles.sql
```

Write the SQL, then `npm run db:push` (cloud) or `npm run db:reset` (local).

---

## Scripts

| Script                 | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Start the dev server (Turbopack)                        |
| `npm run build`        | Production build                                        |
| `npm run start`        | Serve the production build                              |
| `npm run lint`         | Run ESLint                                              |
| `npm run typecheck`    | Type-check with `tsc --noEmit`                          |
| `npm run privacy:meta` | Regenerate the `/privacy` last-modified metadata         |
| `npm run db:*`         | Supabase CLI helpers (`start`, `link`, `push`, …)       |

## Debugging (VS Code)

Open the **Run and Debug** panel (`Ctrl+Shift+D` / `⇧⌘D`), pick a configuration and press `F5`:

- **Next.js: debug server-side** — runs `npm run dev -- --inspect` so breakpoints in server components, route handlers and `lib/supabase.ts` hit.
- **Next.js: debug client-side** — launches Chrome against `http://localhost:3000` for browser-side breakpoints.
- **Next.js: debug client-side (Firefox)** — same, for Firefox (requires the Firefox Debugger extension).
- **Next.js: debug full stack** — attaches Node and opens the browser automatically once the server is ready.

## Deploying to Vercel (free)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new), import the repository — the Next.js framework preset is detected automatically. No build settings need to change.
3. Under **Environment Variables**, add:

   | Name                          | Value                              |
   | ----------------------------- | ---------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`    | `https://<project-ref>.supabase.co`|
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`| Your publishable key           |
   | `SUPABASE_SERVICE_ROLE_KEY`   | Server-only service role/secret key|

4. Click **Deploy**. Every push to the main branch redeploys automatically; preview deployments are created for pull requests.
5. Make sure the cloud database has the schema: `npx supabase link --project-ref <REF_ID>` then `npx supabase db push` (Vercel does not run migrations for you).

> The publishable key is safe to expose to the browser (`NEXT_PUBLIC_*`) — Row
> Level Security (RLS) is what protects your data. Member data is readable only
> by authenticated users who have accepted the privacy policy; admin-only writes
> and event response visibility are enforced by the policies in
> `supabase/migrations/`.

## Troubleshooting

- **Page shows "Configurazione Supabase mancante"** — `.env.local` is missing or still contains placeholders. Fill it in and restart `npm run dev`.
- **Google login says the provider is not enabled** — enable the Google provider in the Supabase dashboard and configure the redirect URLs (see above).
- **Profile page returns "permission denied" (42501)** — the Phase 1B grants are missing. Apply the migrations with `npm run db:push`.
- **Admin cannot edit another member's profile** — apply the Phase 1C migration with `npm run db:push`. It adds the `is_current_user_admin()` helper and the admin UPDATE policy.
- **Events page returns "permission denied" (42501) or an empty list** — apply the Phase 1D migration with `npm run db:push`. It grants API access to `events`/`event_responses` and limits non-admin response reads to the member's own rows.
- **Admin cannot edit or delete an event** — apply all pending migrations with `npm run db:push`. The Phase 1D delete migration adds the admin-only `DELETE` grant/policy, while editing relies on the existing admin `UPDATE` policy.
- **Requests page returns "permission denied" (42501) or an empty list** — apply the Phase 1E migration with `npm run db:push`. It grants API access to `generic_requests`, keeps member reads scoped to their own rows, and allows administrators to update only the request status.
- **Event templates show "tabella non disponibile" or "permission denied"** — apply `supabase/migrations/20261103000000_event_templates.sql` with `npm run db:push`. It creates the admin-only table, grants, triggers, indexes, and RLS policies.
- **Delete account fails with a server configuration message** — set `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) in `.env.local` and the hosting provider, then restart `next dev` or rebuild. The variable is server-only and must not use the `NEXT_PUBLIC_` prefix.
- **Consent screen says the privacy configuration is unavailable** — apply the GDPR migration with `npm run db:push`. It creates `organization_settings` and `user_consents` and installs the restrictive RLS policies.
- **Every existing member is asked to accept the privacy policy once** — expected after the GDPR migration. Acceptance is stored in `user_consents`; accounts that refuse remain blocked by RLS and can be deleted from `/iscritti`.
- **Data export says the function is unavailable or permission is denied** — apply `20261102000000_gdpr_privacy_consent_and_data_export.sql` with `npm run db:push`. A member can export only their own data; an administrator profile is required for another member.
- **The privacy page shows “non ancora pubblicato” contact details** — update the single row in `public.organization_settings` (see the section above), then wait for the hourly cache revalidation or run a new deployment.
- **The privacy page last-updated date looks like the deployment date** — the generated metadata falls back to the file mtime when git history is unavailable (for example in a source tarball). Deploy from a git checkout to use the commit date.
- **The announcement banner never appears or `/avvisi` says the table is unavailable** — apply `20261102020000_announcement_banners.sql` with `npm run db:push`, then confirm the row is active and, if it has dates, that the current time is inside the window. Inactive, scheduled and expired banners are hidden from members by RLS.
- **A shared event link does not return to the event after login** — email/password sign-in keeps the destination in the `next` query parameter; OAuth and email confirmation keep it in `sessionStorage`. Confirm that browser storage is available and that the app origin is listed in Supabase **Authentication → URL Configuration → Redirect URLs**.
- **A new account sees “Account in attesa di approvazione”** — expected with closed registration. Sign in as an administrator, open `/iscritti`, click **Modifica** on the pending row and choose **Approva iscritto**. The member can then press **Controlla di nuovo** or reload the page.
- **The approval screen reports a missing profile structure, or approval controls return a permission error** — apply `20261102030000_member_approval_workflow.sql` with `npm run db:push`. It adds `approval_status`, grandfathers existing profiles as approved and installs the restrictive RLS policies.
- **Approval buttons are missing for an account** — approval controls are visible only to administrators and are hidden for the administrator's own account. Confirm the signed-in profile has `is_admin = true`.
- **A pending member can still reach member data through the API** — confirm the approval migration is applied and appears in `npm run db:migrations`. The restrictive policies on `profiles`, `events`, `event_responses`, `generic_requests`, `event_templates`, `purchase_items`, `purchase_orders` and `announcement_banners` are the server-side boundary; the waiting screen is only the UI side.
- **Account deletion returns a foreign-key error** — apply the profile deletion migration with `npm run db:push`. It changes the historical references to `ON DELETE SET NULL` so RSVPs, requests, and templates survive.
- **An administrator cannot delete another member and the API reports “permission denied for table profiles”** — apply `20261102040000_service_role_profile_access.sql` with `npm run db:push`. The server-side deletion route reads `profiles.is_admin` with the service role, and that role needs an explicit table grant.
- **Password recovery email never arrives** — verify that `http://localhost:3000/login/reset-password` (and its production equivalent) is in **Authentication → URL Configuration → Redirect URLs**, that Custom SMTP is configured outside local testing, and that the default rate limit has not been reached. Check the spam folder too.
- **Recovery link says it is invalid or expired** — links are single-use and time-limited. Request a new one from `/login/forgot`; also confirm the reset page is allowed in the Supabase redirect URLs.
- **Google users cannot change their password in the portal** — expected: accounts whose primary provider is Google manage credentials in their Google account. The profile and recovery pages show a dedicated notice.
- **Email change is not active yet** — open the confirmation link Supabase sends to the new address (and, when secure email change is enabled, to the current one). The old address remains active until confirmation.
- **CLI cannot link** — make sure you passed the project ref: `npx supabase link --project-ref <REF_ID>` (see the dashboard URL).
