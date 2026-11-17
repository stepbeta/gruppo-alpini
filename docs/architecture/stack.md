# Gruppo Alpini Portal — Tech Stack & Architecture

| Field | Value |
| --- | --- |
| Document type | Architecture overview: Technology Stack & Runtime Topology |
| Repository | `gruppo-alpini` |
| Snapshot date | 10 November 2026 |

## 2. Tech Stack & Architecture

### 2.1 Stack

| Layer | Technology | Role in this application |
| --- | --- | --- |
| Framework | Next.js 16.4.2, App Router, Turbopack | Routing, layouts, the cached public privacy page, and one server route handler[cite: 9] |
| UI runtime | React 19.3 | Client components for the authenticated portal[cite: 9] |
| Language | TypeScript 5, strict mode | Shared types and compile-time checks across UI and data helpers[cite: 9] |
| Styling | Tailwind CSS 4 via `@tailwindcss/turbopack` | Utility-first styling, responsive layouts, and class-based dark-mode variants driven by the `.dark` class on `<html>`[cite: 9] |
| Data and identity | Supabase: PostgreSQL, Auth, PostgREST, `@supabase/supabase-js` 2.118 | Session management, direct table access, and RPC calls[cite: 9] |
| Schema management | Supabase CLI and SQL migrations in `supabase/migrations/` | Version-controlled grants, RLS policies, triggers, constraints, indexes, and functions[cite: 9] |
| Testing | Vitest 4.1.12 with V8 coverage, plus a local Docker Supabase stack | Unit tests for pure domain helpers and API-level database/RLS integration tests[cite: 9] |
| Linting | ESLint 9 with `eslint-config-next` | Static analysis, including React and Next.js rules[cite: 9] |
| CI | GitHub Actions, Node.js 24 | Type generation, typecheck, lint, unit coverage, and a Docker-backed database/RLS integration job[cite: 9] |
| Hosting | Vercel | Vercel deployment and CDN[cite: 9] |
| Fonts | Geist and Geist Mono via `next/font` | Brand typography[cite: 9] |

There is no ORM. The browser uses the Supabase query builder against PostgREST, and the SQL migrations are the authoritative description of the data model and its authorization rules[cite: 9].

### 2.2 Runtime topology

The runtime structure flows from the Browser to the Next.js server and Supabase:

- **Browser**: React client components (`AuthProvider`, `AuthGuard`, domain helpers in `lib/`) talk via the Supabase JS client (publishable key + user access token) to Auth, PostgREST tables/filters, and RPC functions (`export_user_data`). The browser also calls `POST /api/account/delete` with a Bearer access token[cite: 9].
- **Next.js server on Vercel**: Renders the server-rendered, cached public policy at `/privacy` and executes the `POST /api/account/delete` route using the service-role Auth admin API[cite: 9].
- **Supabase**: Handles Auth (users, sessions, OAuth, email delivery), PostgreSQL (tables, grants, RLS, triggers, constraints, RPC), and PostgREST (the API surface used by the browser)[cite: 9].

The important architectural fact is that **the Next.js server is not the primary API**. Almost every read and write goes directly from the browser to Supabase. The server exists for two jobs: rendering the public privacy policy and performing the one operation that genuinely requires the service-role key, namely deleting an auth user[cite: 9].

### 2.3 Code organization and responsibilities

| Path | Responsibility |
| --- | --- |
| `app/` | App Router route segments. Most authenticated pages are thin server wrappers around client components; `/privacy` is a server component; `/api/account/delete` is the only route handler[cite: 9]. |
| `components/` | Shared UI and access gates: `AuthProvider`, `AuthGuard`, `SessionGuard`, `ThemeProvider`, theme toggle, `PrivacyConsentGate`, `ApprovalGate`, header/footer, dialogs, forms, pagination, banner, configuration notice[cite: 9]. |
| `app/faq/` | Static Italian member help hub with deep links to member features; gated by session only so it remains available on consent and approval holding screens[cite: 9]. |
| `lib/` | Domain and data-access helpers: profiles, events, event templates, requests, announcements, organization settings, consent, exports, auth actions, redirects, privacy metadata, pagination, theme mode helpers, header navigation model, display helpers, and the browser Supabase singleton[cite: 9]. |
| `lib/navigation.ts` | Pure header navigation model: 1000 px breakpoint constant, member/admin groups, future badge metadata, and active-route matching; covered by `lib/navigation.test.ts`[cite: 9]. |
| `lib/organization-settings.ts` | Administrator form data access, validation, nullable normalization, timestamp formatting, and Italian error mapping; covered by `lib/organization-settings.test.ts`[cite: 9]. |
| `lib/events.ts` | Event/RSVP types, pagination filters, and CRUD helpers; re-exports shared Italian date/time helpers[cite: 9]. |
| `lib/italian-date.ts` | Shared masked Italian date/time input helpers: `gg/mm/aaaa` and `HH:mm` masking, strict parsing, ISO conversion, and Italian formatting used by events, announcements, birth-date forms, and templates[cite: 9]. |
| `lib/event-templates.ts` | Event-template types, validation, time normalization, CRUD helpers, and conversion of an existing event into template input[cite: 9]. |
| `lib/events.test.ts` | Vitest coverage for event date parsing, formatting, deep links, attendance aggregation, Italian error mapping, and the query shape built by the paginated event fetchers[cite: 9]. |
| `lib/italian-date.test.ts` | Vitest coverage for shared date/time masking, strict parsing, leap-year and 24-hour boundaries, optional windows, ISO conversion, and Italian formatting[cite: 9]. |
| `lib/event-templates.test.ts` | Vitest coverage for template time normalization, event-to-template conversion, validation, and error messages[cite: 9]. |
| `lib/pagination.test.ts` | Vitest coverage for page/page-size normalization, inclusive PostgREST ranges, page counts, search sanitization, and `ilike` expression composition[cite: 9]. |
| `lib/auth-redirect.test.ts` | Vitest coverage for safe same-origin redirect validation, login-route rejection, login URL building, and the session-storage deep-link round trip[cite: 9]. |
| `lib/profile.test.ts` | Vitest coverage for directory filters, query composition, enlistment-year validation, administrator-role and profile error mapping, and profile mutation shapes[cite: 9]. |
| `lib/requests.test.ts` | Vitest coverage for request dates, Italian error mapping, pagination, count queries, and request mutation shapes[cite: 9]. |
| `lib/supabase-admin.ts` | Server-only factory for a service-role Supabase client. It is imported only by the account-deletion route[cite: 9]. |
| `supabase/migrations/` | Ordered SQL migrations. These define the real security boundary[cite: 9]. |
| `scripts/generate-privacy-meta.mjs` | Generates the last-modified timestamp used by the public privacy page before `dev`, `build`, and `typecheck`[cite: 9]. |

`AuthProvider` is the client-side session authority. It subscribes to `onAuthStateChange`, restores the current session, checks the current consent version, and fetches the profile only after consent is accepted. It exposes consent and approval status to `AuthGuard`, which decides between the loading screen, configuration notice, consent gate, approval gate, and the requested page. `SessionGuard` is the narrower variant used by the static `/faq` guide: it redirects anonymous visitors to `/login` but intentionally allows signed-in accounts that have not yet consented or been approved[cite: 9].

`ThemeProvider` is the client-side theme authority. It reads the device mode from `localStorage`, resolves `system` through the OS media query, applies the `dark` class and `color-scheme` to `<html>`, and exposes `cycleTheme()` to the shared toggle. The root layout also contains the small blocking script that applies the stored theme before hydration; the provider takes over once React is running[cite: 9].

The client Supabase singleton is created with `persistSession`, `autoRefreshToken`, and `detectSessionInUrl`. When the environment variables are missing or still placeholders, it is `null` and the UI shows a configuration notice instead of crashing[cite: 9].

### 2.9 Delivery and quality model

The schema is delivered as 22 ordered migrations. The latest migration in this snapshot is `20261110104450_add_admin_organization_settings_write.sql`. Migrations are applied with the Supabase CLI; the Next.js deployment does not run them automatically, so a frontend release and its required database changes must be coordinated operationally[cite: 9].

### 2.10 Vercel project configuration

Deployment configuration is split by what the platform can express declaratively. Secrets are never part of the repository.

Version-controlled:

| File | Covers |
| --- | --- |
| `vercel.json` | `framework`, `regions: ["lhr1"]`, and `git.deploymentEnabled`. The function region is London because the Supabase project is `eu-west-2`; if the database region ever changes, change both together. |
| `next.config.ts` → `headers()` | `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a report-only Content Security Policy on every response. |
| `.env.example` | The complete list of environment variable names, without values. |

The CSP is **report-only** on purpose. Next.js emits inline bootstrap scripts, so an enforcing `script-src` needs nonces delivered through middleware, which forces every route to render dynamically and defeats `cacheComponents`. That trade-off is a deliberate future decision, not an oversight; until then the report-only policy surfaces violations without breaking the portal. HSTS omits `preload` for the same kind of reason: preloading is a one-way door that binds every current and future subdomain to HTTPS.

Preview deployments are **disabled**: `git.deploymentEnabled` sets `"**": false` with `"main": true`. The double star matters — these are minimatch patterns and a single `*` does not cross `/`, so `"*": false` would leave every `feature/x`-style branch deploying. When a branch matches several rules, one `true` wins, which is what keeps `main` deploying.

This is deliberate and temporary. Re-enabling previews requires a dedicated Supabase project first, plus the three public/server variable names scoped to the Preview environment. Without that separation a preview is an unauthenticated write path into production member data.

Not expressible as code — set in the Vercel dashboard and verified by hand:

| Setting | Required value | Why it matters |
| --- | --- | --- |
| Environment variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` scoped to Production and Preview, service key marked Sensitive | The absence of the `NEXT_PUBLIC_` prefix is the only mechanism keeping the service key out of client bundles; there is no per-variable "server-only" toggle. |
| Deployment Protection | Vercel Authentication, preview deployments only | Preview URLs are guessable, and production must stay readable by members. |
| Preview deployments | Disabled in `vercel.json`; re-enable only with a separate Supabase project | Otherwise every preview URL is an unauthenticated write path into member data. |
| System environment variable access | Disabled | `autoExposeSystemEnvs` is currently on. Nothing in the code reads `VERCEL_*`, so it only widens the runtime surface. |
| Production branch | `main` | Must be the branch protected by the GitHub ruleset. |
| Domains | One canonical host, HTTPS, `www` → apex | Supabase Auth callbacks and redirect allow-lists match exact hosts. |
| Firewall | Bot protection and attack challenge, if the plan allows | |

Vercel API tokens are account-wide and cannot be scoped to a project or to read-only access. They must not be committed, stored in CI, or shared for auditing purposes.

The test suite has two layers. Vitest unit tests run in a Node environment and cover Italian date/time parsing and masking (leap years, invalid dates and times, 24-hour boundaries, optional windows, all-day midnight stability), event deep links, event and attendance helpers, event-template validation, pagination normalization and PostgREST `range`/`ilike` composition, safe post-login redirects, theme and navigation helpers, profile enlistment-year validation, and Italian error mapping for authentication, events, requests, profiles, and organization settings. The Supabase data-access unit suites use a local chainable test double and assert the built request shape.

`tests/integration/` adds API-level database/RLS coverage against the local Docker Supabase stack. One spec per domain exercises anonymous, unconsented, pending, rejected, approved, administrator, and service-role clients with real local JWTs; it creates `auth.users` fixtures through the admin API, resets public tables and fixture users between tests, and asserts grants, permissive/restrictive policies, triggers, constraints, deletion anonymization, and the `42501`/`PGRST` error codes. Credentials come from `supabase status` and the helper rejects non-loopback URLs, so `.env.local` production values are never used. Local `supabase/config.toml` sets `auto_expose_new_tables = false` so migration grants are enforced; the test bootstrap grants `service_role` the table access expected in production. `tests/e2e/` adds serial Chromium journeys against the same local stack (onboarding, deep links, events/RSVP, directory roles, requests/counters, privacy/deletion, theme), launched with `npm run test:e2e`; known defects are tracked in `docs/e2e-known-issues.md`, and the suite is not wired into CI yet. Route handlers outside those journeys remain uncovered. Coverage is generated with V8 and uploaded as a CI artifact, but there is no coverage threshold.

CI runs `npx next typegen`, then typecheck, lint, and unit tests with coverage. A separate `database-integration` job starts the local Supabase stack, applies all migrations with `npm run db:reset`, and runs `npm run test:integration`. CI still does not run `next build`[cite: 9].