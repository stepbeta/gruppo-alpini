# Gruppo Alpini Portal — Feature Implementations

| Field | Value |
| --- | --- |
| Document type | Architecture overview: Feature Implementations and UI Logic |
| Repository | `gruppo-alpini` |
| Snapshot date | 5 November 2026 |

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

Above the lists, filter chips switch the visible scope between **Tutti**, **Prossimi**, and **Passati**. **Prossimi** is selected initially so the page opens on the actionable calendar; **Tutti** reveals both lists. Search, pagination, and loaded pages remain independent for each list while hidden, so switching chips does not refetch or reset the other view. Empty scopes and empty search results show a contextual message with a shortcut to the other list. Choosing a shared deep link selects the matching scope automatically.

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

Administrators manage banners from `/avvisi`: create, edit, activate/deactivate, and delete. Above the list, the **Tutti**, **Attivi**, and **Passati** chips filter the rows and show live counts. **Attivi** contains only banners visible right now. **Passati** groups banners whose publication window has ended, even if the activation toggle is still on, so a re-enabled recurring notice is not presented as live. Scheduled and manually deactivated rows remain under **Tutti**. Each card shows the creation timestamp plus separate start and end dates (or no limit) and explains when the activation flag conflicts with an expired window. The classification refreshes every minute, so a banner crossing its start or end boundary moves between chips without a page reload.

Mutations dispatch a browser event (`ANNOUNCEMENTS_CHANGED_EVENT`), and the header listens for it, so the visible banner updates without a reload. The header also reloads on window focus. A missing table or a network failure is swallowed intentionally; a banner problem must not break every authenticated page.

The route is also protected by the approval-restrictive policy. It is not currently covered by the consent-restrictive policy, so the blocking consent gate is the only layer preventing an unconsented direct API client from reading a visible banner. That is low-sensitivity content, but it is an inconsistency worth closing if the policy is meant to cover every portal surface.

### 3.8 Public privacy policy and organization settings

`/privacy` is public, server-rendered, and available to anonymous visitors, crawlers, and browsers without JavaScript. It is not wrapped in `AuthGuard` and there is no middleware. It describes the controller, data categories, legal bases, authentication model, processors (Google, Supabase, Vercel), visibility rules, security measures, retention, deletion/anonymization, rights, complaints, cookies/session storage, and policy changes.

The controller details come from the single-row `organization_settings` table. Empty address or contact fields render explicit `non ancora pubblicato` fallbacks rather than invented data. The page's last-updated date is the later of the settings row's `updated_at` and the policy file's modification date. `PRIVACY_POLICY_VERSION` is currently `2026-11-02`; changing the policy text requires bumping that value so members re-accept.

The hourly cache keeps the public page fast and avoids a database read on every request. The trade-off is that an operational update to `organization_settings` may take up to an hour to appear; the README documents this explicitly.

### 3.11 In-app administrator manual

`/admin/manuale` is a static, Italian-language reference guide for administrators. It is rendered inside `AuthGuard`, so the usual session, consent, and approval gates run first, and it then checks `AuthProvider.isAdmin`; authenticated members who are not administrators see an **Accesso riservato** panel instead of the guide. `isAdmin` is derived from the profile already loaded for the approval check, so the page does not issue a second profile query.

The guide opens one section at a time. A compact selector highlights the active section, and Previous/Next controls plus **Torna all’indice** provide navigation without returning to the page top. A smaller **Mostra tutto** option switches to the full manual; in that mode every section is visible and a floating **Torna su** chip appears after scrolling so the administrator can return to the top quickly.

The guide covers the five access levels, closed registration and approvals, member maintenance and cross-member export/deletion, events and RSVP/attendance semantics, event templates, the secretariat board, announcement states and scheduling, versioned consent, GDPR exports, and `ON DELETE SET NULL` anonymization. It is linked from the header and from an administrator-only card on the home page.

The file carries a maintenance rule in its header comment and repeats the rule visibly at the bottom of the page: whenever a feature is added, changed, or removed, or a migration/policy changes, the manual must be updated in the same pull request and `MANUAL_LAST_UPDATED` must be refreshed. The manual requires no migration or new database object.

### 3.12 Contextual guidance, empty states, and friendly errors

Member-facing screens use shared contextual UI instead of leaving blank areas or raw technical messages:

- `components/empty-state.tsx` provides the card used by `/iscritti`, `/eventi`, and `/richieste`. It pairs an icon and a plain-language explanation with optional hints and next-step actions, such as opening the request form, clearing filters, switching event scope, creating an event as an administrator, or completing the profile.
- Search fields on the directory and calendar explain what is indexed and that matching ignores letter case; empty search results repeat the query and suggest a shorter or different keyword.
- `/richieste` shows a dedicated empty state when the member has never written to the secretariat, with a button that scrolls to and focuses the submission form. The form includes guidance about useful references and a live character count.
- Approved members see a dismissible onboarding card on `/` with links to events/RSVP, the member directory, secretariat requests, and profile editing. Dismissal is stored per account in `localStorage` under `gruppo-alpini:welcome-hint-dismissed:v1:<user-id>`, so it does not affect another member using the same browser.
- Event date/time fields and profile enlistment-year fields show Italian examples (`gg/mm/aaaa`, `HH:mm`, `Es. 1985`) and describe optional fields next to the input.
- `lib/error-messages.ts` centralizes the translation of network, expired-session, permission, missing-migration, constraint, duplicate and invalid-input failures. Feature-specific formatters in `lib/events.ts`, `lib/requests.ts`, and `lib/profile.ts` supply their own context and fallback text, and the directory uses the shared helper directly. Raw PostgREST wording is not shown to members.
- The modified UI and component files carry the maintenance rule in their header comments: when features, workflows, validation rules, or routes change, the related empty states, hints, and error messages must be reviewed in the same pull request.

### 3.13 Member help hub (FAQ / “Guida rapida”)

`/faq` is a static, Italian-language help page for members. It is rendered inside the new `SessionGuard`, which requires a signed-in account but deliberately skips the privacy-consent and approval gates. That exception is safe only because the page performs no Supabase data reads and contains no member, event, or request data; it must remain reachable from the consent and approval holding screens.

The page is organized around member intent rather than route names. It opens with four shortcuts and then answers five questions using native `<details>` elements, so the accordion works with keyboard and screen readers without extra JavaScript. The answers cover:

- changing or revoking an RSVP by selecting `Presente`, `In forse`, or `Assente`;
- finding previous secretariat requests and submitting a new one;
- searching the member directory and reading the visible profile fields;
- editing personal data, password/email, and understanding approval status;
- the registration-approval workflow, versioned privacy consent, and data rights.

Each answer contains a direct link to the relevant surface: `/eventi`, `/richieste#nuova-richiesta` and `/richieste#le-mie-richieste`, `/iscritti#cerca-iscritti`, `/profile#dati-personali`, `/profile#sicurezza`, `/profile#esporta-dati`, and `/privacy`. Because the requests and directory sections mount only after their client data loads, those screens replay the URL-hash scroll through `lib/use-hash-scroll.ts` once the content is ready. The help page is linked from the site footer, the header help icon, the approval holding screen, and the consent screen.

The FAQ component file starts with a maintenance rule: whenever features, workflows, or navigation paths change, the questions, answers, and deep-link targets must be updated in the same pull request. The page adds no migration and no database object.
