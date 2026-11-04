# Gruppo Alpini Portal — Technical and Functional Overview

| Field | Value |
| --- | --- |
| Document type | Current-state technical and functional overview |
| Repository | `gruppo-alpini` |
| Snapshot date | 4 November 2026 |
| Evidence base | Application code, all 18 SQL migrations, and `README.md` |
| Audience | Maintainers, administrators, technical reviewers, and future contributors |
| Companion document | `README.md` for installation, deployment, migrations, and troubleshooting |

This document explains what the portal is, how it is built, what is implemented, why the current design looks the way it does, and where the highest-leverage improvements lie. It is deliberately conceptual and architectural rather than a setup guide. Statements describe the repository snapshot; whether a particular migration has been applied to a live Supabase project is an operational concern, not something the source tree can prove.

## 1. High-Level Purpose & Features

### 1.1 Purpose

The Gruppo Alpini portal is a private, Italian-language digital meeting point for an Alpine association and its members. It brings together the membership directory, the event calendar and RSVP collection, the secretariat inbox, group announcements, self-service profile management, and the privacy obligations that surround member data.

It is intentionally not a public website. The only public surfaces are authentication screens and the privacy policy. Every page that exposes member, event, request, or announcement data sits behind a Supabase session and a layered access model.

The portal is designed around four practical ideas:

- **One source of truth.** Member profiles, event attendance, and secretariat requests live in Postgres rather than in scattered spreadsheets or chat threads.
- **Closed membership.** Registration is open, but access is not: a new account starts as `pending` and must be approved by an administrator.
- **Privacy by default.** A member must accept the current privacy policy before entering the portal, and member data is additionally protected by Row Level Security (RLS) if the UI is bypassed.
- **Low operational overhead.** The application is a small Next.js deployment backed by Supabase, with no separate backend service, job queue, or custom identity provider.

The resulting product is best described as an operational MVP with a security posture that is considerably stronger than its visual footprint suggests. The user interface is intentionally simple; most of the engineering depth lives in database policies, triggers, and privacy workflows.

### 1.2 Operating model and roles

The application has five practical access levels. There is no separate role table: administrator status is the `profiles.is_admin` boolean, and registration state is `profiles.approval_status`.

| Role | How the role is reached | What the role can do | What the role cannot do |
| --- | --- | --- | --- |
| **Visitor (anonymous)** | No Supabase session | Open `/login`, `/login/forgot`, `/login/reset-password`, and the public `/privacy` page | Read any member, event, request, or announcement data |
| **Unconsented authenticated account** | Signed in, but no consent row for the current policy version | See the blocking `Consenso necessario` screen, record consent, delete their own account, and sign out | Enter the portal through the UI; read member-data tables covered by the consent-restrictive policies |
| **Pending or rejected member** | Signed in and consent accepted, but `approval_status` is not `approved` | See the `Account in attesa di approvazione` or rejection screen, export their own data, delete their own account, and sign out | Read the directory, events, responses, requests, announcements, or shop data |
| **Approved member** | `approval_status = 'approved'` | Use the home page, member directory, event calendar and RSVP, personal request form and history, announcement banner, profile, credentials, export, and self-deletion | Use administrative controls, read other members' RSVPs, or read the secretariat board |
| **Administrator** | `profiles.is_admin = true` | Everything an approved member can do, plus approve/reject accounts, edit member profiles, create/edit/delete events, see all RSVPs and attendance totals, read and resolve all requests, manage announcements, export another member's data, delete another member's account, and read the in-app administrator manual | The database still enforces privacy consent; administrator status is deliberately treated as approved, so the role is not a bypass around the consent gate |

Administrators are treated as approved by both the database helper `is_current_user_approved()` and the client. This is deliberate: an accidentally rejected administrator must not lose the ability to repair accounts. The privacy-consent requirement still applies to administrators.

There is also a machine role, `service_role`, used only by the server-side account-deletion route. It is not a human role and its key never reaches the browser.

### 1.3 Functional inventory

| Area | Implemented behavior | Main surface |
| --- | --- | --- |
| **Identity and access** | Email/password sign-up and sign-in, Google OAuth, email confirmation, password recovery, password change, email change, provider-aware credential UI, Italian error messages, safe post-login redirects | `/login`, `/login/forgot`, `/login/reset-password`, `/profile` |
| **Onboarding and consent** | First-login blocking privacy consent, versioned consent history, acceptance alternatives (sign out or delete account), administrator approval workflow | `PrivacyConsentGate`, `ApprovalGate`, `/profile` |
| **Home** | Personal greeting, quick links, administrator shortcuts (including the manual), announcement banner | `/` |
| **Member directory** | Approved-member directory, name/service-place search, server-side pagination, administrator pending filter, profile editing, approval badges, deletion | `/iscritti` |
| **Events and RSVP** | Upcoming and past event lists, search, pagination, Italian date/time input, all-day events, `Presente` / `In forse` / `Assente` responses, attendance totals and names for administrators, event CRUD, reusable event templates, shareable deep links | `/eventi` |
| **Requests** | Personal request submission and history, secretariat board for administrators, status filtering, open/resolved counts, resolve/reopen actions | `/richieste` |
| **Announcements** | Platform-wide banner, optional scheduling window, activation toggle, administrator CRUD, live refresh after changes | `/avvisi`, header banner |
| **Profile and credentials** | Editable personal data, password and email management for email/password accounts, Google-account notice, data export, account deletion | `/profile` |
| **Privacy and data rights** | Public policy page, dynamic controller details, JSON/text/HTML export, account deletion and anonymization, consent history | `/privacy`, `/profile`, `/iscritti` |
| **Administration** | Approval decisions, member maintenance, event management, request board, announcement management, cross-member export and deletion, in-app administrator manual | Admin controls embedded in the normal pages; `/admin/manuale` |

### 1.4 End-to-end journeys

**First access.** A visitor signs up with email/password or continues with Google. The `handle_new_user` trigger creates a `profiles` row with `approval_status = 'pending'`. After email confirmation or OAuth return, the member sees the blocking privacy consent screen. Acceptance appends a row to `user_consents`; only then does the client fetch the profile and discover the approval state. The member sees the holding screen until an administrator approves the account from `/iscritti`.

**Returning access.** The browser restores the Supabase session. `AuthProvider` checks the current policy version, then the profile approval state; `AuthGuard` renders the requested page only when both gates pass. A member who has accepted an older policy version is asked to accept the current one; a pending member remains on the holding screen.

**Event lifecycle.** An administrator creates or edits an event. The browser never supplies `created_by`; the database derives it from `auth.uid()` and rejects a mismatch. Approved members see upcoming and past events, choose an RSVP, and can change it while the event is upcoming. Administrators see attendance totals and explicit names per response status, plus a count of members who have not responded. A shared `/eventi?event=<id>` link survives the login round trip and highlights the event. Administrators can also save reusable event details as templates, apply a template while creating an event, and manage templates from a dedicated dialog; the event date is never part of a template.

**Request lifecycle.** A member submits a message to the secretariat. The member sees only their own requests. An administrator sees the whole board, filters by status or text, and changes a request between `In attesa` and `Risolta`. The only column an administrator can update through the API is `status`.

**Account deletion.** A member or an administrator starts the typed `ELIMINA` confirmation. The browser calls `POST /api/account/delete` with the member's access token. The route validates the session (and, for another member, the caller's administrator profile) and calls the Supabase Auth admin API. The auth user and profile disappear; historical RSVPs, requests, and event authorship are retained with a `NULL` member reference.

**Policy update.** An administrator changes the policy text and bumps `PRIVACY_POLICY_VERSION` in `lib/privacy.ts`. On the next visit, members whose latest consent refers to the previous version see the consent gate again. The database records each accepted version separately; consent history is append-only.

### 1.5 Scope boundaries

The current product deliberately stops short of several capabilities:

- There is no purchase or shop UI. `purchase_items` and `purchase_orders` exist in the initial schema, with RLS policies and deletion handling, but no table grants currently expose them to the API and no application code uses them.
- There is no email-notification system beyond Supabase authentication emails. Approval, rejection, event changes, and announcements are not pushed to members.
- There is no separate administrator console or self-service promotion UI. Promoting a member is an operational SQL action using the service role.
- There is no audit log for administrative actions. Consent history is auditable; approvals, deletions, exports, event edits, and template edits are not.
- There is no multi-group or multi-tenant model. The database describes one association.
- There is no MFA, no passwordless login, and no custom identity provider beyond Supabase Auth and Google.
- There is no public member directory, public event page, or public RSVP surface.
- There is no offline mode, background sync, or native application.

## 2. Tech Stack & Architecture

### 2.1 Stack

| Layer | Technology | Role in this application |
| --- | --- | --- |
| Framework | Next.js 16.4.2, App Router, Turbopack | Routing, layouts, the cached public privacy page, and one server route handler |
| UI runtime | React 19.3 | Client components for the authenticated portal |
| Language | TypeScript 5, strict mode | Shared types and compile-time checks across UI and data helpers |
| Styling | Tailwind CSS 4 via `@tailwindcss/turbopack` | Utility-first styling, responsive layouts, dark-mode classes |
| Data and identity | Supabase: PostgreSQL, Auth, PostgREST, `@supabase/supabase-js` 2.118 | Session management, direct table access, and RPC calls |
| Schema management | Supabase CLI and SQL migrations in `supabase/migrations/` | Version-controlled grants, RLS policies, triggers, constraints, indexes, and functions |
| Testing | Vitest 4.1.12 with V8 coverage | Unit tests for pure event helpers |
| Linting | ESLint 9 with `eslint-config-next` | Static analysis, including React and Next.js rules |
| CI | GitHub Actions, Node.js 24 | Type generation, typecheck, lint, tests, and coverage artifact upload |
| Hosting | Vercel | Next.js deployment and CDN |
| Fonts | Geist and Geist Mono via `next/font` | Brand typography |

There is no ORM. The browser uses the Supabase query builder against PostgREST, and the SQL migrations are the authoritative description of the data model and its authorization rules.

### 2.2 Runtime topology

```text
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│                                                              │
│  React client components                                     │
│    ├─ AuthProvider (session, consent, approval state)        │
│    ├─ AuthGuard (UX routing gate)                            │
│    └─ Domain helpers in lib/                                 │
│                                                              │
│  Supabase JS client (publishable key + user access token)     │
│    ├─ Auth: email/password, Google, recovery, email change   │
│    ├─ PostgREST: tables, filters, exact counts, ranges       │
│    └─ RPC: export_user_data(uuid)                            │
│                                                              │
│  POST /api/account/delete (Bearer access token)              │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│ Next.js server on Vercel                                     │
│                                                              │
│  /privacy          Server-rendered, cached public policy     │
│  /api/account/delete  Service-role Auth admin API            │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│ Supabase                                                     │
│                                                              │
│  Auth: users, sessions, OAuth, email delivery                │
│  PostgreSQL: tables, grants, RLS, triggers, constraints, RPC │
│  PostgREST: the API surface used by the browser              │
└──────────────────────────────────────────────────────────────┘
```

The important architectural fact is that **the Next.js server is not the primary API**. Almost every read and write goes directly from the browser to Supabase. The server exists for two jobs: rendering the public privacy policy and performing the one operation that genuinely requires the service-role key, namely deleting an auth user.

### 2.3 Code organization and responsibilities

| Path | Responsibility |
| --- | --- |
| `app/` | App Router route segments. Most authenticated pages are thin server wrappers around client components; `/privacy` is a server component; `/api/account/delete` is the only route handler. |
| `components/` | Shared UI and access gates: `AuthProvider`, `AuthGuard`, `PrivacyConsentGate`, `ApprovalGate`, header/footer, dialogs, forms, pagination, banner, configuration notice. |
| `lib/` | Domain and data-access helpers: profiles, events, event templates, requests, announcements, consent, exports, auth actions, redirects, privacy metadata, pagination, display helpers, and the browser Supabase singleton. |
| `lib/events.ts` | Event/RSVP types, date parsing/formatting, pagination filters, and CRUD helpers. |
| `lib/event-templates.ts` | Event-template types, validation, time normalization, CRUD helpers, and conversion of an existing event into template input. |
| `lib/events.test.ts` | The current Vitest suite for event date parsing, masking, formatting, and event deep-link helpers. |
| `lib/event-templates.test.ts` | Vitest coverage for template time normalization, event-to-template conversion, validation, and error messages. |
| `lib/supabase-admin.ts` | Server-only factory for a service-role Supabase client. It is imported only by the account-deletion route. |
| `supabase/migrations/` | Ordered SQL migrations. These define the real security boundary. |
| `scripts/generate-privacy-meta.mjs` | Generates the last-modified timestamp used by the public privacy page before `dev`, `build`, and `typecheck`. |

`AuthProvider` is the client-side session authority. It subscribes to `onAuthStateChange`, restores the current session, checks the current consent version, and fetches the profile only after consent is accepted. It exposes consent and approval status to `AuthGuard`, which decides between the loading screen, configuration notice, consent gate, approval gate, and the requested page.

The client Supabase singleton is created with `persistSession`, `autoRefreshToken`, and `detectSessionInUrl`. When the environment variables are missing or still placeholders, it is `null` and the UI shows a configuration notice instead of crashing.

### 2.4 Data model

| Table | Purpose | Key relationships and invariants |
| --- | --- | --- |
| `profiles` | Member identity, directory fields, administrator flag, approval state | `id` is both primary key and a foreign key to `auth.users(id)` with `ON DELETE CASCADE`. `is_admin` defaults to false. `approval_status` is `pending`, `approved`, or `rejected`. |
| `events` | Calendar entries | `created_by` references `profiles(id)` with `ON DELETE SET NULL`; it is database-owned. `event_date` is `timestamptz`; `is_all_day` distinguishes all-day dates from midnight events. |
| `event_templates` | Reusable event details for administrators | `created_by` references `profiles(id)` with `ON DELETE SET NULL` and is database-owned. `default_time` is `NULL` for all-day templates and required for timed ones; the event date is not stored. Non-blank title check. |
| `event_responses` | One RSVP per member per event | Unique `(event_id, user_id)`. `event_id` cascades on event deletion. `user_id` becomes `NULL` on profile deletion; the status remains for historical totals. |
| `generic_requests` | Messages to the secretariat | `user_id` becomes `NULL` on profile deletion. `message` has a non-blank check. `status` is `open` or `resolved` and defaults to `open`. |
| `user_consents` | Append-only privacy acceptance history | One row per `(user_id, policy_version)`. `user_id` cascades from `auth.users`. `accepted_at` is forced server-side. No update or delete grant. |
| `organization_settings` | Public controller details for `/privacy` | Single-row table enforced by `id boolean primary key default true` and `check (id = true)`. Readable by `anon` and `authenticated`; writes are operational, not part of the app. |
| `announcement_banners` | Platform-wide messages | Optional `start_date`/`end_date`, `is_active`, `created_by` with `ON DELETE SET NULL`. Non-blank message and valid date order constraints. |
| `purchase_items`, `purchase_orders` | Dormant shop schema from the initial migration | RLS policies and deletion handling exist, but no table grants expose them to the API and no UI uses them. |

The central relationship is `auth.users → profiles`. Deleting an auth user removes the profile, but the historical tables are deliberately detached rather than cascaded. That distinction is what allows past attendance and secretariat history to survive account deletion.

### 2.5 Authorization model

Authorization is a composition of table grants, Row Level Security policies, `SECURITY DEFINER` helpers, triggers, and constraints. There are three layers to keep distinct:

1. **PostgreSQL privileges.** A role must have a table or column grant before RLS is even evaluated. This is why the migrations explicitly grant access to `authenticated`; Supabase does not expose new tables automatically.
2. **RLS policies.** Permissive policies are OR-ed together; restrictive policies are AND-ed with the permissive result. A row is visible or writable only when it satisfies at least one permissive policy and every applicable restrictive policy.
3. **Triggers and constraints.** RLS cannot compare `OLD` and `NEW`, cannot force a server timestamp, and cannot validate every cross-field invariant. Triggers fill those gaps, and check constraints enforce data quality for all writers.

The main policy matrix is:

| Table | Regular member | Administrator |
| --- | --- | --- |
| `profiles` | Read own row and approved profiles; update own row; insert own missing row | Read every row; update any row; the `is_admin` and `id` fields are trigger-protected for non-admins |
| `events` | Read all rows, subject to consent and approval gates | Insert, update, delete; inserts require `created_by = auth.uid()` and the attribution trigger |
| `event_templates` | No access | Read, insert, update, delete; inserts require `created_by = auth.uid()` and the attribution trigger |
| `event_responses` | Read and upsert only their own response | Read every response for attendance totals; still write only their own response |
| `generic_requests` | Read own rows; insert own row | Read every row; update `status` on any row. The column-level grant prevents message or owner rewrites |
| `announcement_banners` | Read only active rows inside their display window | Read every row; create, update, delete |
| `user_consents` | Read own rows; insert own rows | Read others' rows only when the administrator has accepted the policy themselves |
| `organization_settings` | Public read, including anonymous visitors | No application write path; updates are operational |
| `purchase_items`, `purchase_orders` | No API grants currently | No API grants currently |

On top of the table policies, two restrictive layers apply:

- **Privacy consent.** `has_accepted_privacy_consent()` is a `SECURITY DEFINER` helper. Restrictive policies require it on `profiles`, `events`, `event_responses`, `generic_requests`, `event_templates`, `purchase_items`, and `purchase_orders`. The helper returns true for any recorded consent version; the client is responsible for requiring the current version.
- **Account approval.** `is_current_user_approved()` requires `approval_status = 'approved'` or `is_admin = true`. Restrictive policies require it on events, responses, requests, event templates, purchase tables, and announcement banners. The profile read policy separately allows an account to read its own row so the holding screen can explain the situation.

The helpers are `SECURITY DEFINER` for a specific reason: a policy on `profiles` that queries `profiles` would otherwise recurse. Running the small lookup as the function owner bypasses RLS for that lookup while keeping the authorization decision explicit.

### 2.6 Query and pagination architecture

The list screens no longer download every row. `lib/pagination.ts` normalizes page numbers and sizes, converts a page into PostgREST's inclusive `range(from, to)`, calculates page counts from exact counts, and sanitizes search terms before constructing `ilike` filters.

| List | Page size | Notes |
| --- | --- | --- |
| Member directory | 8 | Search by `full_name` or `service_place`; administrators can restrict to `pending` |
| Upcoming events | 5 | Independent page state from past events; ordered ascending by `event_date` |
| Past events | 5 | Ordered descending by `event_date` |
| Personal requests | 5 | Scoped to the signed-in member |
| Secretariat board | 6 | Administrators only; status and text filters; exact open/resolved counts |

Search input is debounced by 350 ms through `useDebouncedValue`. The screens reset or clamp pagination when a filter reduces the result set, and use `isActive` guards so a late response cannot overwrite a newer one. Event responses are fetched only for the events currently visible, and member details for those responses are fetched in batches of at most 100 IDs to stay below URL limits.

The database has indexes for the main ordering and lookup paths: `events(event_date)`, `generic_requests(user_id, created_at desc)`, `generic_requests(status, created_at desc)`, `profiles(approval_status)`, `event_responses(user_id)` where not null, `purchase_orders(user_id)` where not null, `announcement_banners(created_at desc)` where active, and `user_consents(user_id, accepted_at desc)`. The text search itself still uses `ILIKE '%term%'` and has no trigram index; that is a known scaling limit rather than an oversight to hide.

### 2.7 Authentication, session, and redirects

Supabase Auth is the only identity system. Email/password and Google are supported. The login page handles both sign-in and sign-up; the sign-up path sends the member's full name into Supabase user metadata, which the database trigger copies into `profiles.full_name`.

Password recovery is a three-page flow:

- `/login/forgot` calls `resetPasswordForEmail` with a redirect to `/login/reset-password`. It always shows a generic confirmation, so it does not reveal whether an address is registered.
- `/login/reset-password` relies on `detectSessionInUrl` to consume the recovery hash, then calls `updateUser({ password })`.
- Expired, reused, or malformed links are translated into an Italian message with a shortcut to request another link.

The profile security section detects whether the primary provider is email/password, Google, or external. Email/password users can change their password and request an email change; Google users see a notice that credentials are managed by Google. Email changes remain pending until Supabase sends and the member opens the confirmation link.

Post-login deep links use two mechanisms. Email/password sign-in keeps the destination in a `next` query parameter; OAuth and email-confirmation round trips store it in `sessionStorage` because Supabase returns those flows to the site origin. `getSafeRedirectPath` accepts only same-origin absolute paths and rejects login routes and malformed paths. `PostAuthRedirect` waits until the session, privacy consent, and approval are all ready before consuming the stored destination. A pending account therefore keeps its destination until an administrator approves it.

### 2.8 Rendering, caching, and generated metadata

Every authenticated page renders its content inside `AuthGuard`, and the interactive data screens are client components; route files are server components when they need static `metadata`. The root layout only provides the HTML shell, fonts, `AuthProvider`, and `PostAuthRedirect`. This keeps session handling in one place and avoids server-side session cookies.

`/admin/manuale` follows the same pattern but adds one client-side check: `AuthProvider` now exposes `isAdmin`, derived from the profile already fetched for the approval gate, and the manual renders an “Accesso riservato” panel for authenticated non-administrators. The page has no database dependency of its own; its content is static and must be updated alongside feature or schema changes. The route appears in the header and in the administrator shortcuts on the home page only when `isAdmin` is true.

`/privacy` is the exception. It is a server-rendered public page, not wrapped in `AuthGuard`, and it reads the single `organization_settings` row through the `anon` role. `getOrganizationSettings()` uses Next.js `"use cache"` with `cacheLife("hours")`, so the page is prerendered and refreshed at most hourly. If Supabase is unconfigured or the migration is missing, it falls back to neutral values rather than failing the build.

The last-modified date shown on the policy page is the later of the settings row's `updated_at` and the last modification of `app/privacy/page.tsx`. `scripts/generate-privacy-meta.mjs` runs before `dev`, `build`, and `typecheck`; it uses the git commit date for a clean file and the later of the commit date and the file mtime for a locally modified file, writing the git-ignored `lib/generated/privacy-page-meta.ts`.

### 2.9 Delivery and quality model

The schema is delivered as 18 ordered migrations. The latest migration in this snapshot is `20261103000000_event_templates.sql`. Migrations are applied with the Supabase CLI; the Next.js deployment does not run them automatically, so a frontend release and its required database changes must be coordinated operationally.

The test suite is intentionally narrow. Vitest runs in a Node environment and currently covers pure event helpers: Italian date parsing, leap years, invalid dates and times, input masking, display formatting, and event deep-link construction, plus event-template validation and time normalization. Coverage is generated with V8 and uploaded as a CI artifact, but there is no coverage threshold. The latest recorded baseline was approximately 37.0% statements, 41.6% branches, 34.2% functions, and 35.6% lines.

CI runs `npx next typegen`, then typecheck, lint, and tests with coverage. It does not run `next build`, apply migrations, or execute database/RLS tests. Those remain local or manual checks.

## 3. Current State & Implementation Status

The repository contains a coherent, functioning portal; the status below describes what is implemented in source, not what has necessarily been deployed to a specific Supabase project.

| Area | Status | Notes |
| --- | --- | --- |
| Email/password and Google authentication | Implemented | Email confirmation handled; provider-aware credential UI |
| Password recovery and email change | Implemented | Requires correct Supabase redirect URLs and SMTP |
| First-login privacy consent | Implemented | Blocking gate, versioned history, server timestamp |
| Closed registration and approval | Implemented | Pending, approved, rejected; admin-only decisions |
| Member directory | Implemented | Server-side pagination, search, admin editing and pending filter |
| Events and RSVP | Implemented | Upcoming/past, all-day events, attendance names and totals, reusable templates, sharing |
| Requests and secretariat board | Implemented | Personal scope, admin board, status-only mutation |
| Announcement banners | Implemented | Scheduling, activation, admin CRUD, header refresh |
| Profile and credential management | Implemented | Profile fields, password, email, Google notice |
| GDPR data export | Implemented | JSON, text, HTML; self and administrator paths |
| Account deletion and anonymization | Implemented in code | Requires a server-only service-role or secret key |
| Administrator manual | Implemented | Admin-only static guide at `/admin/manuale`; must be updated with every feature or schema change |
| Public privacy policy | Implemented | Server-rendered, cached, dynamic controller details |
| Administrator lifecycle UI | Partial | Approval and member maintenance exist; admin promotion is SQL-only |
| Notifications | Not implemented | Only Supabase Auth emails are sent |
| Administrative audit trail | Not implemented | No record of approvals, deletions, exports, or edits |
| Purchase/shop capability | Schema-only | Tables, policies, and deletion handling exist; no grants or UI |
| Automated database/RLS tests | Not implemented | Security behavior is not exercised in CI |
| Production observability | Minimal | A few `console.error` calls; no structured logging or error reporting |
| Zero-downtime schema deployment | Manual | Migrations must be applied before dependent frontend code |

### 3.1 Identity, onboarding, and account lifecycle

Authentication is complete for the two supported providers. The login screen handles sign-in and sign-up in one place, sends a full name into user metadata on sign-up, and translates the common Supabase errors into Italian: invalid credentials, unconfirmed email, existing account, invalid email, disabled provider, disabled sign-up, rate limits, expired sessions, and network failures.

Account creation is database-owned. The `handle_new_user` trigger inserts a `profiles` row with `approval_status = 'pending'` and uses `on conflict do nothing` so a retried auth event cannot overwrite an existing profile. Profiles that existed before the approval migration were grandfathered as `approved`. The profile page can still create a missing row through `saveProfile` if the trigger was skipped for a legacy account.

The approval workflow is fully usable. Administrators see pending and rejected accounts in `/iscritti`, can approve, reject, or reconsider them, and cannot change their own approval status from the dialog. `is_current_user_approved()` treats administrators as approved. The client mirrors that rule so an administrator with a bad stored status is not locked out of the UI.

The main gaps in this area are operational: there is no self-service administrator promotion, no approval notification email, and no dedicated pending-registration queue beyond the directory filter.

### 3.2 Member directory and administrative operations

`/iscritti` is protected by `AuthGuard`. Approved members see approved profiles with name, birth date, enlistment year, and service place. The search field filters by name or service place through a server-side `ILIKE` expression, and the list is paginated at eight members per page.

Administrators receive pending and rejected rows as well, along with status badges and a pending-count pill that filters the directory. The edit dialog lets an administrator correct the four profile fields, approve or reject an account, export the member's data, or delete the member's account. The form never sends `is_admin` or `approval_status` through the profile-field update path; approval has its own explicit action and trigger protection.

The directory also exposes a defence-in-depth detail: the `profiles` select policy lets a pending account read its own row but not other profiles. This is what allows the approval holding screen to work without opening the directory.

### 3.3 Events and RSVP

The event page has two independent lists: upcoming events sorted ascending, and past events sorted descending. Each is searched and paginated separately at five events per page. The search covers title, location, and description.

Event dates use the strict Italian input format `gg/mm/aaaa` with an optional 24-hour `HH:mm`. An empty time creates an all-day event stored at UTC midnight; the UI then displays only the date. Timed events are stored as local times converted to ISO timestamps and displayed in the browser's local time. Invalid dates such as `31/02/2026`, non-leap `29/02`, and invalid times such as `24:00` are rejected.

Approved members can set `Presente`, `In forse`, or `Assente` on upcoming events; past responses are read-only. Administrators can create, edit, and delete events. Each card shows attendance totals and the names of members in each status, plus an optional count of approved members who have not responded. Deleted members appear as `Socio eliminato` and remain in historical totals because their response row survives with `user_id = NULL`.

Event sharing uses the Web Share API when available and falls back to copying `/eventi?event=<id>`. A shared event that is not on the current page is fetched explicitly and appended to the visible list, then scrolled into view and highlighted as `Evento condiviso`. A deleted or unknown event produces a short notice instead.

Event attribution is database-owned. `createEvent` omits `created_by`; the `set_event_created_by` trigger fills it from `auth.uid()`, rejects a mismatched client value on insert, and blocks changes on update except for the service role or the specific profile-deletion case where the author no longer exists. The insert policy also requires `created_by = auth.uid()`, so attribution does not depend on the trigger alone.

Non-admin members see only their own responses because the original `FOR ALL` policy remains owner-scoped. Administrators get an additional select policy that exposes every response for attendance totals. This is a deliberately narrow exception rather than a broad "authenticated can read responses" rule.

Event templates are an administrator-only convenience. A template stores a title, optional description and location, an all-day flag, and — only for timed templates — a default start time. The scheduled date is deliberately excluded so the same template can be reused on different dates. Administrators can create and edit templates in the **Modelli evento** dialog, reachable from the events page and from the create-event form, or save the current form values of an existing event as a new template. While creating an event, selecting a template fills the title, location, description, and time but leaves the date untouched; the page shows guidance and an inline shortcut when no templates exist. The database enforces the same rules as the UI: non-blank titles, a time exactly when `is_all_day` is false, database-owned `created_by`, and admin-only RLS with consent and approval layers.

### 3.4 Requests and the secretariat board

Any approved member can submit a request through `/richieste`. The form trims the message, rejects an empty value, and stores it in `generic_requests`. The member sees their own requests with `In attesa` or `Risolta` status and submission time.

Administrators see the `Bacheca della segreteria`, which lists every request with the author's name. It supports status filters, text search, exact open/resolved counts, and pagination at six rows per page. Administrators can resolve or reopen a request. The member-facing list is paginated at five rows per page.

The database enforces the intended mutation surface in two ways. The table grant is `UPDATE (status)` rather than `UPDATE`, so an administrator cannot rewrite the message or owner through the API. The admin update policy calls `is_current_user_admin()`, and a non-blank check constraint rejects empty messages even on direct inserts.

Deleted members leave their requests behind with `user_id = NULL`; the board labels them as `Socio eliminato`. Requests have no delete action in the current UI.

### 3.5 Announcement banners

`announcement_banners` supports platform-wide messages with an optional inclusive date window and an active flag. Regular members see a banner only when it is active and the current time is inside its window; administrators see every row for management. When several rows qualify, the most recently created visible banner is shown.

Administrators manage banners from `/avvisi`: create, edit, activate/deactivate, and delete. Mutations dispatch a browser event (`ANNOUNCEMENTS_CHANGED_EVENT`), and the header listens for it, so the visible banner updates without a reload. The header also reloads on window focus. A missing table or a network failure is swallowed intentionally; a banner problem must not break every authenticated page.

The route is also protected by the approval-restrictive policy. It is not currently covered by the consent-restrictive policy, so the blocking consent gate is the only layer preventing an unconsented direct API client from reading a visible banner. That is low-sensitivity content, but it is an inconsistency worth closing if the policy is meant to cover every portal surface.

### 3.6 Profile, credentials, and GDPR export

`/profile` lets a member edit `full_name`, `birth_date`, `enlistment_year`, and `service_place`. The name is required; the enlistment year must be an integer between 1900 and the current year; the other fields are optional. Saving the profile also best-effort synchronizes `full_name` into Supabase user metadata so the header greeting stays consistent. Administrators use a separate dialog to edit another member's four profile fields.

The `Sicurezza e credenziali` section is provider-aware. Email/password users can update their password or request an email change; Google users see a notice that credentials are managed by Google. Password recovery and profile password changes share the same `PasswordUpdateForm` and the same Italian error mapping.

The export is a GDPR access and portability feature. `export_user_data(uuid)` is a `SECURITY DEFINER` RPC that returns a JSON document containing:

- auth user ID, email, creation and confirmation timestamps, and last sign-in;
- profile fields, including the administrator flag;
- every event RSVP with event title, date, all-day flag, location, status, Italian status label, and response timestamp;
- every generic request with message, creation date, status, and Italian status label;
- the full privacy consent history, with policy version and acceptance timestamp.

The browser validates the returned shape, then generates one of three downloadable formats: JSON for portability, plain text for email or quick reading, and a standalone, escaped, print-ready HTML document. Self-export is allowed before consent, because a person must be able to obtain their data while deciding whether to accept the policy. The consent gate itself does not expose a download control, however; the export buttons appear on the approval gate and on `/profile`. Cross-member export requires an administrator who has themselves accepted the policy; the RPC enforces this explicitly rather than relying on the UI.

The export schema does not include purchase orders today. That is consistent with the absence of a shop UI, but it would need to be extended if the dormant purchase schema is ever activated.

### 3.7 Account deletion and anonymization

A member can delete their own account from the bottom of `/profile`; an administrator can delete another member from `/iscritti → Modifica`. Both paths use the same confirmation dialog, which requires typing `ELIMINA`.

The browser never holds the service-role key. It calls `POST /api/account/delete` with its access token. The route:

1. Creates a server-side admin client from `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`.
2. Validates the bearer token with `admin.auth.getUser(token)`.
3. Accepts the target UUID only if it is a valid UUID.
4. Allows self-deletion without a profile lookup.
5. For another member, reads `profiles.is_admin` with the service role and returns `403` unless the caller is an administrator.
6. Calls `admin.auth.admin.deleteUser(targetUserId)`.

Deleting the auth user cascades to `profiles`. Historical references use `ON DELETE SET NULL` so shared records survive:

- `events.created_by`
- `event_templates.created_by`
- `event_responses.user_id`
- `generic_requests.user_id`
- `purchase_orders.user_id`

Event responses keep their status, so past attendance totals remain correct; the UI identifies the author as `Socio eliminato`. Event templates are retained as shared administrative content with a `NULL` author. Deleting an event still cascades to its responses. Consent rows cascade from `auth.users`, so the consent audit history is removed with the account, as the privacy policy states.

The migration also handles an important trigger interaction: `events.created_by` is otherwise immutable, so the `set_event_created_by` trigger was amended to permit the specific `SET NULL` case where the old profile no longer exists. Without that exception, the foreign-key action would be rejected by the attribution trigger.

### 3.8 Public privacy policy and organization settings

`/privacy` is public, server-rendered, and available to anonymous visitors, crawlers, and browsers without JavaScript. It is not wrapped in `AuthGuard` and there is no middleware. It describes the controller, data categories, legal bases, authentication model, processors (Google, Supabase, Vercel), visibility rules, security measures, retention, deletion/anonymization, rights, complaints, cookies/session storage, and policy changes.

The controller details come from the single-row `organization_settings` table. Empty address or contact fields render explicit `non ancora pubblicato` fallbacks rather than invented data. The page's last-updated date is the later of the settings row's `updated_at` and the policy file's modification date. `PRIVACY_POLICY_VERSION` is currently `2026-11-02`; changing the policy text requires bumping that value so members re-accept.

The hourly cache keeps the public page fast and avoids a database read on every request. The trade-off is that an operational update to `organization_settings` may take up to an hour to appear; the README documents this explicitly.

### 3.9 Data integrity, legacy cleanup, and migrations

The security-hardening migration tightened several invariants that the UI cannot guarantee:

- `events.created_by` is filled by the database and cannot be forged or changed by normal API users.
- `profiles.full_name`, `events.title`, and `generic_requests.message` reject blank or whitespace-only values through check constraints. Legacy blank names were normalized to `NULL`; constraints were added `NOT VALID` and validated when existing data was clean.
- The legacy `public.tests` demo table, its public `anon` read policy, and its sample data were dropped.
- The profile triggers block non-admin changes to `is_admin`, `id`, and `approval_status`.
- `generic_requests` exposes only `UPDATE (status)` to the API.
- The service role received the explicit `profiles` select grant needed by the deletion route.
- Foreign keys and indexes support `ON DELETE SET NULL` without losing historical rows.

The migration history also records an important operational lesson: Supabase does not automatically grant table access to API roles. Every new public table needs the appropriate grant, RLS enablement, and policy. Missing grants surface as `42501 permission denied`; missing policies or restrictive layers can surface as empty results or, worse, unintended visibility.

### 3.10 Quality, testing, and operational readiness

The automated test suite is small and focused on pure functions. It covers the riskiest date logic thoroughly: valid and invalid Italian dates, leap years, all-day versus timed events, 24-hour boundaries, input masking, formatting, and deep-link parsing. It does not cover React components, Supabase queries, RLS policies, triggers, the export RPC, or the deletion route.

CI verifies type generation, typecheck, lint, and tests. It does not build the application or exercise a database. Coverage is visible but not gated. The practical consequence is that a policy regression in SQL would not be caught by CI; it would require a manual test against a real Supabase project.

Operationally, the portal depends on:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` at build time;
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` on the server for account deletion;
- Supabase Auth providers, allowed redirect URLs, and ideally custom SMTP;
- all migrations applied in order;
- a populated `organization_settings` row for real controller details.

The default Supabase email service is limited to roughly two messages per hour and is not suitable for production password recovery. `gaps.md` records this as the only explicitly tracked known limit. The README documents the required URL configuration and the difference between the public publishable key and the server-only service key.

### 3.11 In-app administrator manual

`/admin/manuale` is a static, Italian-language reference guide for administrators. It is rendered inside `AuthGuard`, so the usual session, consent, and approval gates run first, and it then checks `AuthProvider.isAdmin`; authenticated members who are not administrators see an **Accesso riservato** panel instead of the guide. `isAdmin` is derived from the profile already loaded for the approval check, so the page does not issue a second profile query.

The guide covers the five access levels, closed registration and approvals, member maintenance and cross-member export/deletion, events and RSVP/attendance semantics, event templates, the secretariat board, announcement states and scheduling, versioned consent, GDPR exports, and `ON DELETE SET NULL` anonymization. It is linked from the header and from an administrator-only card on the home page.

The file carries a maintenance rule in its header comment and repeats the rule visibly at the bottom of the page: whenever a feature is added, changed, or removed, or a migration/policy changes, the manual must be updated in the same pull request and `MANUAL_LAST_UPDATED` must be refreshed. The manual requires no migration or new database object.

## 4. Key Technical Challenges & Design Decisions

### 4.1 Trusting the database instead of the browser

**Challenge.** The portal is a single-page client application that talks directly to PostgREST with a publishable key. Any check performed only in React can be bypassed by a crafted request. A traditional server-side API would centralize validation, but it would also duplicate Supabase Auth handling and add a network hop to every operation.

**Decision.** Use the browser for user experience and Supabase RLS as the real authorization boundary. The client still performs friendly validation, but every security-relevant rule is repeated in Postgres grants, policies, triggers, or constraints. The only operations that genuinely require server privilege are isolated in a route handler or a `SECURITY DEFINER` RPC.

**Consequences.** The model is strong when the migrations are correct and current, but a policy regression is a data-exposure regression. It also means the frontend and schema are tightly coupled: a new column, table, or RPC must ship with its grants and policies, and a missing migration often appears as a permission error rather than a graceful feature flag. The many Italian error-mapping functions exist partly to make that coupling tolerable for administrators.

### 4.2 Composing permissive and restrictive RLS

**Challenge.** A single policy per table is not enough for this product. Members need owner-scoped access, administrators need broader access, and both consent and approval must apply regardless of role. Writing one large policy per table would be hard to read and easy to get wrong.

**Decision.** Keep ownership and administrator access in permissive policies, then add separate restrictive policies for consent and approval. Helpers such as `is_current_user_admin()`, `is_current_user_approved()`, and `has_accepted_privacy_consent()` are `SECURITY DEFINER` to avoid recursive policy evaluation on `profiles` and `user_consents`.

**Consequences.** The policy matrix is composable and auditable in small pieces, but it is not obvious at a glance. A reader must remember that permissive policies OR together and restrictive policies AND on top. The `profiles` policy is a good example of the care required: an account must be able to read its own row while pending, regular members must see only approved profiles, and administrators must see everything. That single policy encodes three distinct cases.

### 4.3 Versioned consent and the boundary between UX and enforcement

**Challenge.** Privacy consent is both a legal record and an access gate. The policy text will change. A member who accepted last year's text should not silently keep access to a materially updated policy. At the same time, hard-coding policy versions into SQL would require a migration for every wording change.

**Decision.** Store one append-only row per `(user_id, policy_version)`, force `accepted_at` server-side, and let the client require the current `PRIVACY_POLICY_VERSION`. The database helper returns true when any consent row exists. The client gate is responsible for re-consent after a version bump.

**Consequences.** Policy updates require a coordinated code change and a new acceptance, not a database migration. The trade-off is important: RLS proves that the member consented at some point, not that they consented to the current text. A direct PostgREST client with an old consent row could still read the consent-restricted tables. That is acceptable only while the portal is the sole consumer; if the API is treated as a public contract, the current version should be stored in the database and checked by a `has_accepted_current_privacy_consent()` helper.

A second inconsistency is that `announcement_banners` is approval-gated but not consent-gated. The banner content is low-sensitivity, but the omission means the "consent before portal content" rule is not uniformly enforced at the database layer. Both points are addressed in Section 5.

### 4.4 Closed registration without administrative lockout

**Challenge.** Open registration is inappropriate for a private association, but a naive approval flag can lock out the only administrator or make account repair impossible. A rejected administrator must not lose the ability to fix the mistake, and a pending member still needs a readable explanation and a way to leave.

**Decision.** New sign-ups start as `pending`; existing profiles were grandfathered as `approved`. `is_current_user_approved()` returns true for administrators regardless of their stored status, and the client mirrors that rule. The `profiles` select policy always allows a member to read their own row, even while pending or rejected. Approval changes are protected by a trigger that blocks non-admin self-approval.

**Consequences.** The system avoids the classic "no admin can approve anyone" failure. It also means administrator status is a powerful escape hatch: if an administrator account is compromised, the approval flag is not an additional barrier. The absence of a dedicated administrator-management UI keeps the attack surface small, but it also makes promotion an operational SQL procedure rather than a product feature.

### 4.5 Database-owned authorship and text integrity

**Challenge.** The browser used to send `events.created_by`. RLS checked only `is_admin`, so an administrator could attribute an event to another member. Similarly, client-side trimming could be bypassed by a direct PostgREST call, allowing blank titles, names, or request messages.

**Decision.** The database owns `created_by`: a default of `auth.uid()`, a `BEFORE INSERT OR UPDATE` trigger that enforces attribution and immutability, and an insert policy that repeats the `created_by = auth.uid()` check. The service role remains an explicit repair path. Blank text is rejected by check constraints on `profiles.full_name`, `events.title`, `event_templates.title`, and `generic_requests.message`. The request update grant is column-scoped to `status`; profile triggers protect `is_admin`, `id`, and `approval_status`. Event templates additionally constrain `default_time` to be present exactly when the template is timed.

**Consequences.** The rules survive direct API calls and accidental UI bugs. The cost is trigger complexity and migration care: the profile-deletion `SET NULL` action would have been rejected by the attribution trigger, so the trigger needed an explicit exception for a missing old profile. Constraints were also added `NOT VALID` first so a legacy database with dirty rows would not fail the migration outright.

### 4.6 Account deletion without losing history

**Challenge.** Supabase Auth owns the user record, and deleting an auth user cascades to `profiles`. If the historical tables also cascaded, the group would lose attendance statistics and secretariat history. If they restricted deletion, members could not exercise erasure. The deletion itself requires the Auth admin API and therefore a service-role key.

**Decision.** Keep the auth-user-to-profile cascade, but change every historical reference to `ON DELETE SET NULL`. Preserve event response status, request text, and event rows; anonymize the author. Put the service-role operation behind a server route that validates the caller's token and, for another member, checks `is_admin` server-side. Add the missing service-role profile grant.

**Consequences.** Deletion is both a privacy right and a historical integrity operation. The UI labels anonymized authors as `Socio eliminato`, and attendance totals remain correct because `NULL` rows still carry their status. The trade-off is that the application cannot delete an account at all without a server-only key; the README treats that as a configuration requirement rather than a bug. Consent rows are intentionally cascaded, which removes the consent audit trail along with the account.

### 4.7 Privileged operations with a server-only key

**Challenge.** The service-role key bypasses RLS. Shipping it to the browser would defeat the entire security model. Avoiding it entirely would make auth-user deletion impossible from the product.

**Decision.** Keep the key in a server-only module, validate the caller's JWT with the Auth admin API, check the caller's profile with the service role only when deleting another member, and never expose the key through a `NEXT_PUBLIC_*` variable. The GDPR export takes the opposite approach: it uses a `SECURITY DEFINER` RPC with explicit `auth.uid()` and administrator checks, so the browser never needs the service key for data access.

**Consequences.** There is exactly one privileged HTTP path, which is easier to review than a collection of admin endpoints. It is also a high-value path: a bug in token validation or administrator lookup would be serious. The route therefore validates the UUID, distinguishes self-deletion from cross-member deletion, and returns deliberately generic server errors while logging details server-side. Rate limiting and richer observability are still missing.

### 4.8 A public, cached privacy policy with dynamic controller data

**Challenge.** The privacy policy must be readable without JavaScript and without authentication, but its controller details should be editable without a redeploy. Next.js 16's `cacheComponents` model also requires uncached I/O to be explicit.

**Decision.** Render `/privacy` on the server, read the single `organization_settings` row through the `anon` role, and wrap the read in `"use cache"` with `cacheLife("hours")`. Keep writes out of the app; administrators update the row in the Supabase dashboard or with the service role. Generate the policy's last-modified date before dev/build/typecheck so the displayed date reflects both the settings and the text.

**Consequences.** The public page is fast and robust, and it degrades to neutral placeholders if Supabase or the migration is unavailable. The cost is up to an hour of staleness after a controller-detail update, and an operational dependency on the generated metadata script. A settings change that must be visible immediately currently requires a redeploy or cache invalidation.

### 4.9 Server-side pagination over PostgREST

**Challenge.** The first version of the list pages downloaded all rows and filtered in React. That does not scale with a growing directory, event history, or secretariat board, and it wastes bandwidth on every search keystroke.

**Decision.** Push filtering, sorting, counting, and ranges into PostgREST. Normalize page and page size in one helper, request exact counts, debounce search, and keep independent page state for upcoming and past events. Load responses and member names only for the rows currently visible.

**Consequences.** The browser receives only what it displays, and the database can use indexes for ordering and common filters. The trade-offs are more round trips per screen, exact-count cost as tables grow, and a search path that still uses leading-wildcard `ILIKE` without trigram indexes. The current page sizes (8 members, 5 events per section, 5/6 requests) are a product choice balanced for small-group usability rather than throughput.

### 4.10 Post-authentication deep links and session state

**Challenge.** A shared event link must survive email/password login, Google OAuth, email confirmation, the consent gate, and the approval gate. OAuth and email confirmation return to the site origin, so the destination cannot simply remain in the app URL. User-controlled redirect targets are also an open-redirect risk.

**Decision.** Validate every destination as a same-origin absolute path, reject login routes and malformed paths, keep the destination in `next` for password login, and store it in `sessionStorage` for OAuth/confirmation. `PostAuthRedirect` waits for session, consent, and approval before navigating. `sessionStorage` is cleared on sign-out so a different account cannot inherit a previous member's destination.

**Consequences.** Deep links behave correctly across the full onboarding sequence, including a pending account that must wait for approval. The design depends on browser storage being available; in private modes or with blocked storage, the flow falls back to the home page. There is no server-side OAuth callback route, which keeps the app small but leaves the redirect policy in Supabase configuration.

### 4.11 Italian calendar semantics

**Challenge.** The association thinks in `gg/mm/aaaa` and 24-hour time, while Postgres stores timestamps and the browser displays local time. An all-day event must not appear as the previous day because of a timezone offset, and a timed event must become past at its actual start.

**Decision.** Parse and mask Italian input explicitly, store all-day events at UTC midnight with `is_all_day = true`, store timed events as local timestamps converted to ISO, and mirror the upcoming/past rule in both the client and the PostgREST scope filter. Tests cover leap years, impossible dates, invalid times, and boundary values.

**Consequences.** The UI is natural for Italian members, and all-day events remain stable across timezone offsets. The model assumes members operate in the association's timezone; a member in another timezone may see timed events in their own local time. The explicit `is_all_day` flag is what prevents the common midnight ambiguity.

### 4.12 Testing a security model that lives in SQL

**Challenge.** The riskiest logic is not the date formatter; it is the interaction of grants, permissive policies, restrictive policies, triggers, and the service-role route. Those pieces cannot be meaningfully tested by the current pure-function suite.

**Decision.** The project currently uses a small Vitest suite for pure helpers and relies on manual verification for the database. This keeps the test setup simple and fast, but it leaves the authorization model largely unguarded by automation.

**Consequences.** A migration that accidentally drops a restrictive policy or forgets a grant can pass CI. The coverage numbers are a baseline, not a quality guarantee. Section 5 treats database/RLS testing as the highest-leverage engineering investment because it protects the property the whole architecture depends on.

## 5. High-Leverage Areas for Future Improvement

The following areas are ordered by leverage rather than by ease. The first two protect the properties the current system already claims; the later items expand the product or reduce operational friction. The section closes with a short overall assessment.

### 5.1 Close the remaining policy gaps

The most important correctness work is to make the database enforce the same consent rule the client presents.

- Add a current policy version to the database, either in `organization_settings` or a dedicated configuration table, and introduce `has_accepted_current_privacy_consent()`. Replace `has_accepted_privacy_consent()` in the restrictive policies with the current-version helper.
- Add a consent-restrictive policy to `announcement_banners` (or explicitly classify banners as public-to-approved members) so every portal surface has a deliberate rule.
- Add a migration checklist or policy-matrix test that fails when a new member-facing table is created without the expected grants, RLS, consent policy, and approval policy.
- Keep `PRIVACY_POLICY_VERSION` and the database version in a single release step, ideally generated from the same source.

Closing these gaps turns "the UI blocks it" into "the database blocks it," which is the standard the rest of the system already aims for.

### 5.2 Make authorization testable

The highest engineering return would come from running a real Postgres/Supabase instance in CI and exercising the policy matrix:

- anonymous, unconsented, pending, rejected, approved member, administrator, and service role;
- own versus other rows for profiles, events, responses, requests, consent, and announcements;
- consent-version changes and approval-status changes;
- self-export, cross-member export, self-deletion, and cross-member deletion;
- trigger behavior for `created_by`, `is_admin`, `approval_status`, `accepted_at`, blank text, and `SET NULL`;
- the exact `42501`/`PGRST` error paths the UI translates.

This can be implemented with pgTAP or SQL fixtures plus a test runner, or with an ephemeral Supabase stack and API-level tests using real JWTs. The important outcome is not a particular tool; it is that a policy regression fails CI before it reaches production.

### 5.3 Add an administrative audit trail

Approvals, rejections, deletions, cross-member exports, event edits, and announcement changes are consequential actions with no durable record beyond the resulting row. An append-only `admin_audit_log` would improve accountability and incident response:

- actor ID, target ID, action, timestamp, and a small structured detail payload;
- no sensitive content beyond what is necessary to explain the action;
- administrator-readable only, with a retention policy;
- ideally written by triggers for approvals/deletions and by the RPC/route for exports and privileged operations.

This is also a privacy safeguard: a member asking "who accessed or deleted my data?" could be answered with evidence rather than inference.

### 5.4 Complete the administrator lifecycle and member communications

The current admin model works but depends on SQL for promotion and on manual observation for pending registrations. High-value product work includes:

- an administrator-management screen for promoting and demoting members, protected by stronger confirmation and audit logging;
- a dedicated pending-registration queue with approve/reject actions and a reason field;
- email notifications for approval, rejection, event changes, and announcements, backed by custom SMTP;
- optional in-app notifications so the portal does not depend on email deliverability;
- a clear "request access" or "contact the group" path for rejected accounts.

The free-plan Supabase email limit (roughly two messages per hour) makes custom SMTP a prerequisite for any production notification feature, not an optional refinement.

### 5.5 Decide the future of the dormant shop schema

`purchase_items` and `purchase_orders` are currently schema-only. They have RLS policies and deletion handling, but no grants and no UI. This is a maintenance liability: the tables appear in the security model, the approval/consent policies, and the deletion migration, yet they cannot be used.

Either remove them in a dedicated migration or implement the shop fully. If implemented, it needs:

- table grants and a complete policy matrix;
- a checkout/order flow and admin item management;
- purchase orders included in the GDPR export;
- tests for owner/admin access and deletion anonymization;
- a decision about payment handling, which is currently out of scope.

Removing them would reduce the surface area and make the documented model match the product. Keeping them without a plan invites confusion in future security reviews.

### 5.6 Improve search and list scalability

The current `ILIKE '%term%'` search is correct but not index-friendly. For a growing directory or event history, add trigram indexes and verify the query plans:

- `pg_trgm` GIN indexes on `profiles.full_name`, `profiles.service_place`, `events.title`, `events.location`, `events.description`, and `generic_requests.message`;
- composite indexes aligned with the exact sort orders used by each list;
- a performance budget for exact counts and page loads;
- optional cursor pagination for very large lists, or an RPC that returns rows and counts in one call;
- URL-backed list state so filters and pages survive reloads and can be shared.

The current page sizes and debounce are sensible for a small association. The improvement should be driven by measured growth, not by premature complexity.

### 5.7 Strengthen privacy operations

The portal already provides access, portability, erasure, and consent history. The next privacy improvements are:

- a consent-withdrawal path that is distinct from account deletion, with a clear explanation of which features become unavailable;
- a policy-version update runbook that covers the text, `PRIVACY_POLICY_VERSION`, the database current-version value, and a member communication;
- an export schema version contract and, if the shop is activated, purchase-order data in the export;
- a server-generated export option for members who cannot use browser downloads, or for administrators handling an offline request;
- documented retention rules for audit logs and anonymized history.

Withdrawal is legally and technically delicate because the portal's core data processing may rely on contract or legitimate interest rather than consent alone. The product should distinguish "withdraw optional consent" from "delete my account" instead of forcing every refusal into deletion.

### 5.8 Harden operations and observability

The privileged deletion route and the public auth surface deserve production-grade operational safeguards:

- structured server logging and an error-reporting integration instead of `console.error`;
- rate limiting and abuse monitoring on `/api/account/delete` and authentication-adjacent endpoints;
- security headers and a Content Security Policy appropriate to Supabase and Google OAuth;
- MFA or step-up authentication for administrators;
- key-rotation and environment-validation checks at startup;
- Supabase security-advisor review and periodic dependency updates;
- a health check that reports missing environment variables or unapplied critical migrations without exposing secrets.

These measures do not change the product model, but they reduce the blast radius of a compromised administrator account or a server-side defect.

### 5.9 Improve delivery automation and maintainability

The current workflow is intentionally lightweight, but a few investments would reduce release risk:

- run migrations against an ephemeral database in CI and fail on schema/policy drift;
- generate TypeScript types from the Supabase schema instead of maintaining table shapes by hand;
- add a `next build` job to CI, not only typecheck/lint/tests;
- centralize duplicated error-message mapping and table/column constants;
- add a migration compatibility check so frontend code cannot ship before its required grants and RPCs;
- document architectural decisions as short ADRs, especially around consent, deletion, and RLS composition.

### 5.10 Improve accessibility and localization

The interface is responsive and uses accessible dialog patterns, but it has not had a formal accessibility audit. Useful next steps include keyboard and screen-reader testing of the consent gate, approval gate, dialogs, pagination, and event cards; reduced-motion support; clearer focus management after asynchronous updates; and a review of color contrast in both themes.

The application is Italian-first, which is appropriate for its users. Extracting strings into a localization layer would still make future maintenance easier and would allow the privacy policy and error messages to evolve without scattering literals across components.

### 5.11 Closing assessment

The Gruppo Alpini portal is a coherent, security-conscious MVP. Its strongest architectural choice is to treat PostgreSQL as the authorization boundary rather than trusting the React client. Its most valuable features are not visually elaborate: closed registration, versioned consent, database-owned event attribution, historical anonymization, and a working GDPR export are the parts that make the portal trustworthy for a real association.

The weakest points are equally clear. The current policy version is enforced by the client rather than the database, one portal table is outside the consent-restrictive layer, and the RLS/trigger model has no automated integration tests. Those are the right next investments: they protect the properties the system already claims before adding new features. After that, administrative auditability, notifications, search scalability, and a deliberate decision about the dormant shop schema are the most worthwhile directions.
