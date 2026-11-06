# Gruppo Alpini Portal — Security, RLS & GDPR

| Field | Value |
| --- | --- |
| Document type | Architecture overview: Security, Data Model, RLS, and Privacy Flows |
| Repository | `gruppo-alpini` |
| Snapshot date | 5 November 2026 |

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

The static `/faq` help page is a deliberate exception to the two UI gates. `SessionGuard` requires a session but not privacy consent or approval, because the page must remain reachable from the consent and approval holding screens and performs no Supabase data reads. It must not be extended with member, event, or request data without re-evaluating that boundary.

The helpers are `SECURITY DEFINER` for a specific reason: a policy on `profiles` that queries `profiles` would otherwise recurse. Running the small lookup as the function owner bypasses RLS for that lookup while keeping the authorization decision explicit.

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