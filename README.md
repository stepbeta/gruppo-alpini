# gruppo-alpini test project

A unified, production-ready **Next.js (App Router)** repository integrated with **Supabase** — TypeScript, Tailwind CSS, ESLint, version-controlled database migrations, VS Code debugging, and free deployment on Vercel.

## Tech stack & Architecture Map

For a deep dive into product requirements, security models, RLS policies, and feature workflows, refer to the modular documentation under `docs/architecture/`:
* Product Scope: `docs/architecture/overview.md`
* Tech Stack & Topology: `docs/architecture/stack.md`
* Security, RLS & GDPR: `docs/architecture/security.md`
* Feature Implementations: `docs/architecture/features.md`
* Design Decisions & Roadmap: `docs/architecture/roadmap.md`

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
├── app/                 # Next.js App Router pages and route handlers
├── components/          # Shared UI elements, auth screens/forms, header, footer
├── docs/architecture/   # Modular technical and architectural overview
├── lib/                 # Domain helpers, data-access logic, singletons
├── supabase/migrations/ # Version-controlled SQL migrations
├── scripts/             # Build scripts (e.g. privacy metadata generator)
└── .vscode/             # Run & debug configurations
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the root directory (git-ignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-or-secret-key>
```

`SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) is server-only and used exclusively by `app/api/account/delete/route.ts` for account deletion. It must never be prefixed with `NEXT_PUBLIC_`.

### 3. Configure authentication

In the Supabase dashboard:
1. **Enable Authentication → Providers → Email and Google**.
2. Under **Authentication → URL Configuration**, add your Site URL and Redirect URLs:
   - `http://localhost:3000`
   - `http://localhost:3000/login/reset-password`
   - Production equivalents.
3. Configure Custom SMTP before relying on password recovery in production (default rate limit is ~2 emails/hour).

### 4. Run the development server

```bash
npm run dev
Open http://localhost:3000.
```

---

## Database migrations (Supabase CLI)

Migrations live in `supabase/migrations/` and are applied in filename order.

```bash
npx supabase init
npx supabase link --project-ref <REF_ID>
npx supabase db push        # or: npm run db:push
```

Local development commands:

```bash
npm run db:start      # spin up local Postgres/Studio (Docker required)
npm run db:reset      # re-apply all migrations from scratch
npm run db:new <name> # scaffold a new timestamped migration
```

### Database and RLS integration tests

The authorization boundary lives in SQL grants, RLS policies, triggers, and
constraints. `tests/integration/` exercises that boundary through real
`@supabase/supabase-js` clients against the **local** Supabase stack:

```bash
npm run db:start
npm run db:reset
npm run test:integration
```

The specs read the URL and keys from `supabase status`, never from `.env.local`,
and refuse to run against a non-loopback URL. They create and delete real
`auth.users` fixtures, so **the suite clears local public tables and local auth
users between tests**. Do not point it at a stack whose local data you need.

`npm test` runs the unit and integration suites together when the local stack is
available and skips the integration files otherwise. `npm run test:integration`
turns a missing stack into a failure, which is what CI uses. The local
`supabase/config.toml` sets `auto_expose_new_tables = false` so the migrations'
explicit grants are enforced exactly as in the documented production model; run
`npm run db:reset` after changing that setting. The test bootstrap grants the
server-only `service_role` access to public tables for fixture setup and raw
assertions, matching its trusted production role.

The suites cover profiles and approval/administrator guards, the consent layer,
events and event templates, event responses, generic requests, announcement
banners, account-deletion anonymization, and the exact `42501`/`PGRST`/
constraint error codes used by the Italian error mapping. Dormant purchase
tables and component/route rendering are outside this suite.

### End-to-end browser tests (Playwright)

`tests/e2e/` exercises the real UI in Chromium against the **local** Supabase
stack. The run is serial and priority-ordered: onboarding, deep links,
events/RSVP (including creation with masked date/time fields), directory and
roles, requests/counters, privacy/deletion, and theme. The Google OAuth journey
is a documented `test.skip` because no local OAuth provider is available; the
login button itself is checked by the onboarding spec.

Known product defects found by the suite are recorded in
[`docs/e2e-known-issues.md`](docs/e2e-known-issues.md) with reproduction steps.
Open defects are marked with Playwright's `test.fail(...)`, so the suite stays
green until they are fixed; remove the marker with the fix.

Prerequisites:

```bash
# Docker must be running.
npx playwright install chromium
# On Linux, install the Chromium system libraries too (needs root):
npx playwright install-deps chromium
```

The system libraries are `libnspr4`, `libnss3`, `libasound2t64`, and the other
packages listed by `npx playwright install-deps chromium`. Without root, install
them through your package manager yourself; the suite does not download or
bundle them.

Ports `3000` (Next.js), `54321`–`54324` (Supabase API, database, Studio, mail
catcher) must be free. Migrations are applied from scratch by the command below,
so a linked cloud project is never involved.

Then use the single command that prepares the database and starts the app:

```bash
npm run test:e2e
```

`test:e2e` runs `e2e:prepare`, which starts the local Supabase stack if it is
stopped and applies `npm run db:reset`. Playwright then launches a dedicated
`next dev` server on port 3000 with the URL and keys read from `supabase
status`; `.env.local` is never used. **The reset wipes local public tables and
local auth users**, so do not point this suite at a stack whose data you need.

Specs never use cloud credentials or production SMTP. The fixture users and
events are prefixed with `E2E`, and global setup/teardown removes them. The
database is reset once per full run, not between tests; specs run serially
because they share fixtures and counters. Email confirmation is disabled in the
local config; if it is enabled later, the onboarding spec confirms the test user
through the Admin API instead of relying on production SMTP.

Artifacts are written to `playwright-report/` (HTML report) and `test-results/`
(traces and screenshots on failure); both are git-ignored. The E2E suite is not
part of the CI workflow yet.

---

## Scripts

| Script                   | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `npm run dev`            | Start the dev server (Turbopack)                        |
| `npm run build`          | Production build                                        |
| `npm run start`          | Serve the production build                              |
| `npm run lint`           | Run ESLint                                              |
| `npm run typecheck`      | Type-check with `tsc --noEmit`                          |
| `npm test`               | Unit tests plus local database integration when running |
| `npm run test:unit`      | Unit tests only                                         |
| `npm run test:integration` | Database/RLS suite; fails if the local stack is down  |
| `npm run test:coverage`  | Unit tests with V8 coverage (no database integration)   |
| `npm run test:e2e`       | Playwright E2E suite against the local Supabase stack   |
| `npm run e2e:prepare`    | Start local Supabase if needed and reset the database   |
| `npm run db:*`           | Supabase CLI helpers                                    |

---

## Deploying to Vercel

1. Push repository to GitHub.
2. Import project into vercel.com/new.
3. Add environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. Deploy. Remember to run `npx supabase db push` against your cloud project database, as Vercel does not run migrations automatically.

---

## Troubleshooting

- **Page shows "Configurazione Supabase mancante"** — `.env.local` is missing or has placeholder values.
- **Profile/Events/Requests returns "permission denied" (42501)** — apply pending database migrations via `npm run db:push`.
- **Delete account fails with server configuration message** — set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or Vercel environment settings.
- **CLI cannot link** — pass the project reference explicitly: `npx supabase link --project-ref <REF_ID>`.