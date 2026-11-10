# Gruppo Alpini Portal — Roadmap, Design Decisions & Gaps

| Field | Value |
| --- | --- |
| Document type | Architecture overview: Design Decisions, Implementation Status, and Roadmap |
| Repository | `gruppo-alpini` |
| Snapshot date | 10 November 2026 |

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
| Administrator lifecycle UI | Partial | In-app promotion/revocation with a cap of 4 and self-demotion guard; pending queue and notifications remain gaps |
| Notifications | Not implemented | Only Supabase Auth emails are sent |
| Administrative audit trail | Not implemented | No record of approvals, deletions, exports, or edits |
| Purchase/shop capability | Schema-only | Tables, policies, and deletion handling exist; no grants or UI |
| Automated database/RLS tests | Not implemented | Security behavior is not exercised in CI |
| Production observability | Minimal | A few `console.error` calls; no structured logging or error reporting |
| Zero-downtime schema deployment | Manual | Migrations must be applied before dependent frontend code |

### 3.9 Data integrity, legacy cleanup, and migrations

The security-hardening migration tightened several invariants that the UI cannot guarantee:

- `events.created_by` is filled by the database and cannot be forged or changed by normal API users.
- `profiles.full_name`, `events.title`, and `generic_requests.message` reject blank or whitespace-only values through check constraints. Legacy blank names were normalized to `NULL`; constraints were added `NOT VALID` and validated when existing data was clean.
- The legacy `public.tests` demo table, its public `anon` read policy, and its sample data were dropped.
- The profile triggers block non-admin changes to `is_admin`, `id`, and `approval_status`, cap administrators at four, and reject self-demotion.
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

**Consequences.** The system avoids the classic "no admin can approve anyone" failure. It also means administrator status is a powerful escape hatch: if an administrator account is compromised, the approval flag is not an additional barrier. Promotion and revocation now happen in-app from `/iscritti`, but they remain deliberately narrow: the database caps the group at four administrators and rejects self-demotion, and the existing trigger still blocks non-admin role changes. The remaining lifecycle gaps are the pending-registration queue, notifications, and the audit trail.

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

**Decision.** Render `/privacy` on the server, read the single `organization_settings` row through the `anon` role, and wrap the read in `"use cache"` with `cacheLife("hours")`. Generate the policy's last-modified date before dev/build/typecheck so the displayed date reflects both the settings and the text.

The original "writes stay out of the app" part of this decision is now deliberately reversed. Administrators update the four published controller fields from `/admin/impostazioni`. The replacement boundary is database-owned: `anon` keeps SELECT only; `authenticated` receives a column-scoped UPDATE grant on `organization_name`, `address`, `contact_email`, and `dpo_email`; the UPDATE RLS policy calls `is_current_user_admin()`; and a `BEFORE UPDATE` trigger forces `updated_at = now()` while preserving the `id = true` single-row invariant. The UI only updates the seeded row and has no INSERT or DELETE grant. The service-role and dashboard paths remain available for operational repairs.

**Consequences.** The public page is still fast and robust, and it degrades to neutral placeholders if Supabase or the migration is unavailable. The cost is up to an hour of staleness after a controller-detail update, and an operational dependency on the generated metadata script. That staleness is now the accepted, documented behavior: a saved change is immediate in the database but becomes publicly visible at most one hour later according to the cache window. The administrator form and manual state this explicitly. There is intentionally no `revalidateTag` call, no lower `cacheLife`, and no restructuring of the caching strategy; if the hourly delay ever becomes unacceptable, it needs a separate design discussion rather than a silent change to this path.

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
- trigger behavior for `created_by`, `is_admin` (including the four-administrator cap and self-demotion), `approval_status`, `accepted_at`, blank text, and `SET NULL`;
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

In-app administrator promotion and revocation are **implemented** in `/iscritti`: an administrator can promote an approved member or revoke the role, the database caps the group at four administrators, and self-demotion is rejected. The remaining work in this area is:

- ~~an administrator-management screen for promoting and demoting members~~ **Implemented in-app**; deeper confirmation already exists for revocation, and audit logging remains roadmap 5.3;
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