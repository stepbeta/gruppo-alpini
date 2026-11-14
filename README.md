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
| `npm run test:coverage`  | Vitest with V8 coverage                                 |
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