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
│   ├── login/           # Google OAuth + email/password login
│   ├── profile/         # Member profile: view and update personal data
│   ├── eventi/          # Event calendar, RSVP, admin event creation and totals
│   ├── iscritti/        # Member directory + admin profile editing
│   ├── richieste/       # Generic requests form + admin secretariat board
│   ├── privacy/         # Public privacy policy (plain Italian)
│   └── globals.css      # Tailwind & global styles
├── components/          # Shared UI: auth provider/guard, header, footer, icons, loading states
├── lib/
│   ├── supabase.ts      # Initialized singleton browser Supabase client
│   ├── profile.ts       # Profile types and read/upsert/admin-update helpers
│   ├── events.ts        # Event/RSVP types, formatting and data helpers
│   ├── requests.ts      # Generic request types, formatting and data helpers
│   └── display.ts       # Display-name and initials helpers
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
```

Both values are available in the Supabase dashboard under the **Connect** panel (or **Project Settings → API Keys**).
Until they are set, the homepage gracefully displays a "not configured" message instead of crashing.

### 3. Configure authentication

In the Supabase dashboard:

1. **Authentication → Providers → Email** is enabled by default. You can keep
   email confirmation on or off; the login page handles both cases.
2. **Authentication → Providers → Google**: add the OAuth Client ID and Client
   Secret from Google Cloud Console.
3. **Authentication → URL Configuration**: set the Site URL and add the app
   origins to **Redirect URLs**:
   - `http://localhost:3000`
   - `https://<your-production-domain>`

The app redirects OAuth and email-confirmation links back to the site origin;
Supabase must allow that origin or the redirect is rejected.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors are
redirected to the login page. After signing in, the landing page shows the
member area, links to `/profile`, `/eventi` and `/iscritti`, and a footer link to
the public `/privacy` page.

### Member directory and privacy

- `/iscritti` is protected by `AuthGuard` and lists every `profiles` row with
  name, birth date, enlistment year, and service place. The search box filters
  by name or service place.
- Members with `is_admin = true` can edit any member's four profile fields from
  the directory. Non-admin members only see the read-only list. Supabase RLS is
  the real authorization boundary; the UI check is only for convenience.
- `/privacy` is public (no login required) so it can be linked from the login
  page and satisfies OAuth provider requirements.

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
- Members with `is_admin = true` also see **Nuovo evento**, **Modifica**, and
  **Elimina** controls. Deletion asks for confirmation and also removes the
  event's responses. Every event card includes attendance totals plus the
  explicit names of members in each category (present, tentative, absent) and
  optionally those who have not responded yet.
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

4. Click **Deploy**. Every push to the main branch redeploys automatically; preview deployments are created for pull requests.
5. Make sure the cloud database has the schema: `npx supabase link --project-ref <REF_ID>` then `npx supabase db push` (Vercel does not run migrations for you).

> The publishable key is safe to expose to the browser (`NEXT_PUBLIC_*`) — Row
> Level Security (RLS) is what protects your data. Member data is readable only
> by authenticated users; admin-only writes and event response visibility are
> enforced by the policies in `supabase/migrations/`.

## Troubleshooting

- **Page shows "Configurazione Supabase mancante"** — `.env.local` is missing or still contains placeholders. Fill it in and restart `npm run dev`.
- **Google login says the provider is not enabled** — enable the Google provider in the Supabase dashboard and configure the redirect URLs (see above).
- **Profile page returns "permission denied" (42501)** — the Phase 1B grants are missing. Apply the migrations with `npm run db:push`.
- **Admin cannot edit another member's profile** — apply the Phase 1C migration with `npm run db:push`. It adds the `is_current_user_admin()` helper and the admin UPDATE policy.
- **Events page returns "permission denied" (42501) or an empty list** — apply the Phase 1D migration with `npm run db:push`. It grants API access to `events`/`event_responses` and limits non-admin response reads to the member's own rows.
- **Admin cannot edit or delete an event** — apply all pending migrations with `npm run db:push`. The Phase 1D delete migration adds the admin-only `DELETE` grant/policy, while editing relies on the existing admin `UPDATE` policy.
- **Requests page returns "permission denied" (42501) or an empty list** — apply the Phase 1E migration with `npm run db:push`. It grants API access to `generic_requests`, keeps member reads scoped to their own rows, and allows administrators to update only the request status.
- **CLI cannot link** — make sure you passed the project ref: `npx supabase link --project-ref <REF_ID>` (see the dashboard URL).
