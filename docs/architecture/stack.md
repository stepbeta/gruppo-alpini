# Gruppo Alpini Portal — Tech Stack & Architecture

| Field | Value |
| --- | --- |
| Document type | Architecture overview: Technology Stack & Runtime Topology |
| Repository | `gruppo-alpini` |
| Snapshot date | 6 November 2026 |

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
| Testing | Vitest 4.1.12 with V8 coverage | Unit tests for pure domain and theme helpers[cite: 9] |
| Linting | ESLint 9 with `eslint-config-next` | Static analysis, including React and Next.js rules[cite: 9] |
| CI | GitHub Actions, Node.js 24 | Type generation, typecheck, lint, tests, and coverage artifact upload[cite: 9] |
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
| `lib/` | Domain and data-access helpers: profiles, events, event templates, requests, announcements, consent, exports, auth actions, redirects, privacy metadata, pagination, theme mode helpers, display helpers, and the browser Supabase singleton[cite: 9]. |
| `lib/events.ts` | Event/RSVP types, pagination filters, and CRUD helpers; re-exports shared Italian date/time helpers[cite: 9]. |
| `lib/italian-date.ts` | Shared masked Italian date/time input helpers: `gg/mm/aaaa` and `HH:mm` masking, strict parsing, ISO conversion, and Italian formatting used by events, announcements, birth-date forms, and templates[cite: 9]. |
| `lib/event-templates.ts` | Event-template types, validation, time normalization, CRUD helpers, and conversion of an existing event into template input[cite: 9]. |
| `lib/events.test.ts` | The current Vitest suite for event date parsing, formatting, and event deep-link helpers[cite: 9]. |
| `lib/italian-date.test.ts` | Vitest coverage for shared date/time masking, strict parsing, ISO conversion, and Italian formatting[cite: 9]. |
| `lib/event-templates.test.ts` | Vitest coverage for template time normalization, event-to-template conversion, validation, and error messages[cite: 9]. |
| `lib/supabase-admin.ts` | Server-only factory for a service-role Supabase client. It is imported only by the account-deletion route[cite: 9]. |
| `supabase/migrations/` | Ordered SQL migrations. These define the real security boundary[cite: 9]. |
| `scripts/generate-privacy-meta.mjs` | Generates the last-modified timestamp used by the public privacy page before `dev`, `build`, and `typecheck`[cite: 9]. |

`AuthProvider` is the client-side session authority. It subscribes to `onAuthStateChange`, restores the current session, checks the current consent version, and fetches the profile only after consent is accepted. It exposes consent and approval status to `AuthGuard`, which decides between the loading screen, configuration notice, consent gate, approval gate, and the requested page. `SessionGuard` is the narrower variant used by the static `/faq` guide: it redirects anonymous visitors to `/login` but intentionally allows signed-in accounts that have not yet consented or been approved[cite: 9].

`ThemeProvider` is the client-side theme authority. It reads the device mode from `localStorage`, resolves `system` through the OS media query, applies the `dark` class and `color-scheme` to `<html>`, and exposes `cycleTheme()` to the shared toggle. The root layout also contains the small blocking script that applies the stored theme before hydration; the provider takes over once React is running[cite: 9].

The client Supabase singleton is created with `persistSession`, `autoRefreshToken`, and `detectSessionInUrl`. When the environment variables are missing or still placeholders, it is `null` and the UI shows a configuration notice instead of crashing[cite: 9].

### 2.9 Delivery and quality model

The schema is delivered as 18 ordered migrations. The latest migration in this snapshot is `20261103000000_event_templates.sql`. Migrations are applied with the Supabase CLI; the Next.js deployment does not run them automatically, so a frontend release and its required database changes must be coordinated operationally[cite: 9].

The test suite is intentionally narrow. Vitest runs in a Node environment and currently covers pure event helpers: Italian date parsing, leap years, invalid dates and times, input masking, formatting, and event deep-link construction, plus event-template validation, time normalization, and theme-mode cycling/resolution. Coverage is generated with V8 and uploaded as a CI artifact, but there is no coverage threshold. The latest recorded baseline was approximately 45.4% statements, 57.9% branches, 45.3% functions, and 43.4% lines[cite: 9].

CI runs `npx next typegen`, then typecheck, lint, and tests with coverage. It does not run `next build`, apply migrations, or execute database/RLS tests. Those remain local or manual checks[cite: 9].