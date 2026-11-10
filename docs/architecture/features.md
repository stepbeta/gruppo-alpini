# Gruppo Alpini Portal — Feature Implementations

| Field | Value |
| --- | --- |
| Document type | Architecture overview: Feature Implementations and UI Logic |
| Repository | `gruppo-alpini` |
| Snapshot date | 10 November 2026 |

### 2.6 Query and pagination architecture

The list screens no longer download every row. `lib/pagination.ts` normalizes page numbers and sizes, converts a page into PostgREST's inclusive `range(from, to)`, calculates page counts from exact counts, and sanitizes search terms before constructing `ilike` filters.

| List | Page size | Notes |
| --- | --- | --- |
| Member directory | 8 | Search by `full_name` or `service_place`; chips for all, administrators, and regular users, plus the administrator-only pending chip |
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

Every authenticated page renders its content inside `AuthGuard`, and the interactive data screens are client components; route files are server components when they need static `metadata`. The root layout provides the HTML shell, fonts, the blocking theme script, `ThemeProvider`, `AuthProvider`, and `PostAuthRedirect`. This keeps session and theme handling in one place and avoids server-side session cookies.

`/admin/manuale` and `/admin/impostazioni` follow the same pattern but add one client-side check: `AuthProvider` exposes `isAdmin`, derived from the profile already fetched for the approval gate, and both pages render an “Accesso riservato” panel for authenticated non-administrators. The manual is static and must be updated alongside feature or schema changes; the settings page reads and updates the controller row but still treats the database policy as the real boundary. Both routes appear in the header's `Amministrazione` group and in the administrator shortcuts on the home page only when `isAdmin` is true.

`/privacy` is the exception. It is a server-rendered public page, not wrapped in `AuthGuard`, and it reads the single `organization_settings` row through the `anon` role. `getOrganizationSettings()` uses Next.js `"use cache"` with `cacheLife("hours")`, so the page is prerendered and refreshed at most hourly. If Supabase is unconfigured or the migration is missing, it falls back to neutral values rather than failing the build.

The last-modified date shown on the policy page is the later of the settings row's `updated_at` and the last modification of `app/privacy/page.tsx`. `scripts/generate-privacy-meta.mjs` runs before `dev`, `build`, and `typecheck`; it uses the git commit date for a clean file and the later of the commit date and the file mtime for a locally modified file, writing the git-ignored `lib/generated/privacy-page-meta.ts`.

The visual theme is a device-level preference, not an account attribute. Three modes are supported — `system` (the default), `light`, and `dark` — and the header toggle cycles through them in the fixed order `system → light → dark → system`. The choice is stored in `localStorage` under `gruppo-alpini:theme:v1` and is shared by every page in the browser, including the public login, password-recovery, privacy, consent, approval, and help screens. It is never written to Supabase.

Tailwind CSS 4 uses the class-based dark variant declared in `app/globals.css` (`@custom-variant dark (&:where(.dark, .dark *))`), so the `.dark` class on `<html>` drives every `dark:` utility. A minimal inline script in `app/layout.tsx` runs before hydration, reads the stored mode, resolves `system` through `matchMedia('(prefers-color-scheme: dark)')`, and sets the class and `color-scheme` before the first paint to avoid a flash of the wrong theme. `ThemeProvider` then keeps the class in sync, listens for OS appearance changes while in `system` mode, follows cross-tab storage changes, and updates the `theme-color` meta tag when present. The inline script tolerates unavailable storage by falling back to `system`; the provider keeps the toggle usable in memory for the current tab.

`SiteHeader` is shared by every authenticated content page. The brand links to `/`; the redundant Home navigation item was removed. From 1000 px upward the flat navigation shows `Eventi`, `Iscritti`, and `Richieste`, followed for administrators by a divider-separated `Amministrazione` group with `Avvisi`, `Impostazioni`, and `Manuale`. That group is rendered only when `AuthProvider.isAdmin` is true, so it is absent from the DOM for regular members. The theme toggle and the FAQ shortcut sit beside the avatar menu, which contains `Profilo` and the only logout action; the former standalone logout icon is gone. Below 1000 px, a hamburger opens a full-width drawer with `Area soci` (`Eventi`, `Iscritti`, `Richieste`, `Profilo`) and, for administrators only, `Amministrazione` (`Avvisi`, `Impostazioni`, `Manuale`); logout is the final drawer action. The drawer closes on item selection, backdrop click, and Escape, traps focus while open, returns it to the hamburger, and exposes `aria-expanded`/`aria-controls`; the account menu closes on outside click/Escape and supports arrow, Home, and End navigation. Active links use `aria-current="page"` in both surfaces. The pending approval/request counters, when implemented, badge `Iscritti` and `Richieste`; every navigation item keeps the shared badge slot, so `Avvisi`, `Impostazioni`, and `Manuale` render no badge because they define no `badgeKey`. The 1000 px breakpoint was measured against the widest header (brand, six links, divider, theme/FAQ controls, avatar), which needs roughly 960 px; it keeps tablets on the flat navigation without overflow. The pure model and its tests live in `lib/navigation.ts` and `lib/navigation.test.ts`; drawer and menu behavior remain manual checks because the Vitest suite runs in a Node environment.

### 3.1 Identity, onboarding, and account lifecycle

Authentication is complete for the two supported providers. The login screen handles sign-in and sign-up in one place, sends a full name into user metadata on sign-up, and translates the common Supabase errors into Italian: invalid credentials, unconfirmed email, existing account, invalid email, disabled provider, disabled sign-up, rate limits, expired sessions, and network failures.

Account creation is database-owned. The `handle_new_user` trigger inserts a `profiles` row with `approval_status = 'pending'` and uses `on conflict do nothing` so a retried auth event cannot overwrite an existing profile. Profiles that existed before the approval migration were grandfathered as `approved`. The profile page can still create a missing row through `saveProfile` if the trigger was skipped for a legacy account.

The approval workflow is fully usable. Administrators see pending and rejected accounts in `/iscritti`, can approve, reject, or reconsider them, and cannot change their own approval status from the dialog. `is_current_user_approved()` treats administrators as approved. The client mirrors that rule so an administrator with a bad stored status is not locked out of the UI.

The profile and member-edit forms collect the birth date through a masked `gg/mm/aaaa` text field and keep the database value as an ISO calendar date. Forms disable native browser validation with `noValidate`; required fields, birth-date format, and email shape are checked by Italian client-side messages instead, so validation bubbles do not depend on the browser language.

The main gaps in this area are operational: administrator promotion is now handled in-app, but there is still no approval notification email and no dedicated pending-registration queue beyond the directory filter.

### 3.2 Member directory and administrative operations

`/iscritti` is protected by `AuthGuard`. Approved members see approved profiles with name, birth date, enlistment year, and service place; pending registrations are not part of their directory. The search field filters by name or service place through a server-side `ILIKE` expression, and the list is paginated at eight members per page. Birth dates are edited and displayed as masked `gg/mm/aaaa` values; the database keeps the ISO calendar date.

Above the list, approved members get three status chips mirroring the conventions already used on `/eventi` and `/avvisi`: **Tutti**, **Amministratori**, and **Utenti**. Administrators also get **In attesa**, which is absent from the DOM for regular members. The chips map to server-side PostgREST conditions (`is_admin = true`, `is_admin = false`, `approval_status = 'pending'`, or no condition) and compose with the text search instead of filtering the loaded page in React. Changing a chip resets the page to 1; the existing clamping still protects against a page that becomes empty after a mutation. The chips deliberately omit live counts so the screen does not add unpaginated count queries; the administrator-only pending badge in the header remains the at-a-glance queue (section 3.5.1).

Administrators receive pending and rejected rows as well, along with status badges. The same pending-approvals queue is summarized by an administrator-only badge in the header (section 3.5.1). The edit dialog lets an administrator correct the four profile fields, approve or reject an account, manage the administrator role, export the member's data, or delete the member's account. The form never sends `is_admin` or `approval_status` through the profile-field update path; approval has its own explicit action and trigger protection.

A clearly separated **Gestione amministratore** section in the same dialog promotes an approved member to administrator or revokes the role. Promotion calls a dedicated `is_admin`-only mutation path and surfaces the database failure verbatim when the cap is reached; the UI never pre-hides the action from a client-side count that could be stale. Revocation opens a second confirmation dialog that lists what the member will lose: approvals, editing other profiles, event and template management, full RSVP access, the secretariat board, announcements, cross-member export/deletion, and the administrator manual. The member remains an approved regular user. On the signed-in administrator's own row the revoke action is replaced by an explanatory notice, and the database independently rejects self-demotion. Promotion and revocation reuse the loading, error, notice, and reload patterns of the approve/reject actions.

The database enforces the role rules even if the client is bypassed. A `BEFORE UPDATE` trigger caps the group at four administrators and blocks self-demotion, while the existing trigger still rejects any `is_admin` change from a non-administrator. Section 2.5 documents the helper and trigger ordering.

The directory also exposes a defence-in-depth detail: the `profiles` select policy exposes pending rows only to administrators and to the pending account itself. A regular member reads only approved profiles; a pending account reads its own row but not other profiles. This is what allows the approval holding screen to work without opening the directory, and the restrictive pending guard keeps that boundary even if another permissive policy is added later.

### 3.3 Events and RSVP

The event page has two independent lists: upcoming events sorted ascending, and past events sorted descending. Each is searched and paginated separately at five events per page. The search covers title, location, and description.

Above the lists, filter chips switch the visible scope between **Tutti**, **Prossimi**, and **Passati**. **Prossimi** is selected initially so the page opens on the actionable calendar; **Tutti** reveals both lists. Search, pagination, and loaded pages remain independent for each list while hidden, so switching chips does not refetch or reset the other view. Empty scopes and empty search results show a contextual message with a shortcut to the other list. Choosing a shared deep link selects the matching scope automatically.

Event dates use the strict Italian input format `gg/mm/aaaa` with an optional 24-hour `HH:mm`. An empty time creates an all-day event stored at UTC midnight; the UI then displays only the date. Timed events are stored as local times converted to ISO timestamps and displayed in the browser's local time. Invalid dates such as `31/02/2026`, non-leap `29/02`, and invalid times such as `24:00` are rejected. The event dialog and the template editor use masked text inputs from `lib/italian-date.ts`, not native date/time widgets, and both dialogs disable native browser validation.

Approved members can set `Presente`, `In forse`, or `Assente` on upcoming events; past responses are read-only. Each response also stores `guest_count`, a non-negative integer with no upper limit. Guests follow the member’s status: they are present with a `Presente` member and “in forse” with an `In forse` member. Switching to `Assente` keeps the stored count but removes it from the totals, and the guest input is disabled. The count is editable only by the member on their own response and only while the event is upcoming. Administrators can create, edit, and delete events. Each card shows attendance totals and the names of members in each status, plus an optional count of approved members who have not responded. The administrator total is rendered as `Totale: N (M soci + K invitati)`, where `M` is the number of `Presente` and `In forse` members and `K` is their guests; a separate line splits guests between present and “in forse” members. Attendance name lists append `(+N)` to members who declared guests, omitting the suffix when `N` is zero. Deleted members appear as `Socio eliminato` and remain in historical totals because their response row survives with `user_id = NULL`; their guests count too.

Event sharing uses the Web Share API when available and falls back to copying `/eventi?event=<id>`. A shared event that is not on the current page is fetched explicitly and appended to the visible list, then scrolled into view and highlighted as `Evento condiviso`. A deleted or unknown event produces a short notice instead.

Event attribution is database-owned. `createEvent` omits `created_by`; the `set_event_created_by` trigger fills it from `auth.uid()`, rejects a mismatched client value on insert, and blocks changes on update except for the service role or the specific profile-deletion case where the author no longer exists. The insert policy also requires `created_by = auth.uid()`, so attribution does not depend on the trigger alone.

Non-admin members see only their own responses because the original `FOR ALL` policy remains owner-scoped. Administrators get an additional select policy that exposes every response for attendance totals. This is a deliberately narrow exception rather than a broad "authenticated can read responses" rule.

Event templates are an administrator-only convenience. A template stores a title, optional description and location, an all-day flag, and — only for timed templates — a default start time. The scheduled date is deliberately excluded so the same template can be reused on different dates. Administrators can create and edit templates in the **Modelli evento** dialog, reachable from the events page and from the create-event form, or save the current form values of an existing event as a new template. While creating an event, selecting a template fills the title, location, description, and time but leaves the date untouched; the page shows guidance and an inline shortcut when no templates exist. The database enforces the same rules as the UI: non-blank titles, a time exactly when `is_all_day` is false, database-owned `created_by`, and admin-only RLS with consent and approval layers.

### 3.4 Requests and the secretariat board

Any approved member can submit a request through `/richieste`. The form trims the message, rejects an empty value, and stores it in `generic_requests`. The member sees their own requests with `In attesa` or `Risolta` status and submission time.

Administrators see the `Bacheca della segreteria`, which lists every request with the author's name. It supports status filters, text search, exact open/resolved counts, and pagination at six rows per page. The open count also appears as an administrator-only badge in the header and on the home shortcut (section 3.5.1). Administrators can resolve or reopen a request. The member-facing list is paginated at five rows per page.

The database enforces the intended mutation surface in two ways. The table grant is `UPDATE (status)` rather than `UPDATE`, so an administrator cannot rewrite the message or owner through the API. The admin update policy calls `is_current_user_admin()`, and a non-blank check constraint rejects empty messages even on direct inserts.

Deleted members leave their requests behind with `user_id = NULL`; the board labels them as `Socio eliminato`. Requests have no delete action in the current UI.

### 3.5 Announcement banners

`announcement_banners` supports platform-wide messages with an optional inclusive date window and an active flag. Regular members see a banner only when it is active and the current time is inside its window; administrators see every row for management. When several rows qualify, the most recently created visible banner is shown.

Administrators edit the window through separate masked date (`gg/mm/aaaa`) and time (`HH:mm`) fields. Both fields are required when a limit is set; leaving both empty means no limit, matching the previous date-and-time control while avoiding its browser-dependent widget. The stored values remain ISO timestamps.

Administrators manage banners from `/avvisi`: create, edit, activate/deactivate, and delete. The route is linked from the header's administrator-only `Amministrazione` group, from the home card, and from `/iscritti`. Above the list, the **Tutti**, **Attivi**, and **Passati** chips filter the rows and show live counts. **Attivi** contains only banners visible right now. **Passati** groups banners whose publication window has ended, even if the activation toggle is still on, so a re-enabled recurring notice is not presented as live. Scheduled and manually deactivated rows remain under **Tutti**. Each card shows the creation timestamp plus separate start and end date-times (or no limit) and explains when the activation flag conflicts with an expired window. The classification refreshes every minute, so a banner crossing its start or end boundary moves between chips without a page reload.

Mutations dispatch a browser event (`ANNOUNCEMENTS_CHANGED_EVENT`), and the header listens for it, so the visible banner updates without a reload. The header also reloads on window focus. A missing table or a network failure is swallowed intentionally; a banner problem must not break every authenticated page. The administrator counters reuse the same pattern through `REQUESTS_CHANGED_EVENT` and `APPROVALS_CHANGED_EVENT` (section 3.5.1).

The route is also protected by the approval-restrictive policy. It is not currently covered by the consent-restrictive policy, so the blocking consent gate is the only layer preventing an unconsented direct API client from reading a visible banner. That is low-sensitivity content, but it is an inconsistency worth closing if the policy is meant to cover every portal surface.

### 3.5.1 Administrator pending counters

Administrators get two at-a-glance queues: the number of `generic_requests` rows with `status = 'open'` and the number of `profiles` rows with `approval_status = 'pending'`. The counters appear as small amber badges on the header's **Richieste** and **Iscritti** items (desktop navigation and mobile drawer) and on the corresponding shortcuts on `/`. The **Richieste** badge counts the secretariat queue; the **Iscritti** badge counts accounts waiting for approval.

A shared client provider reads both counts through the browser Supabase singleton using exact `HEAD` counts (`select('*', { count: 'exact', head: true })` with the relevant filter), so rows are never downloaded. The existing administrator select policies on both tables authorize the reads; no migration, RPC, or policy change is involved.

The counters are active only when `AuthProvider.isAdmin` is true. Regular members issue no count query and see no badge or any other visual change. Failures degrade silently to zero, following the announcement banner's rule that a counter problem must never break a page. Zero counts render nothing; values above the display limit render `99+` while the accessible Italian label keeps the real number (for example “120 richieste in attesa”).

Refresh is event-driven, without polling: the provider refetches on window focus, on `REQUESTS_CHANGED_EVENT` (dispatched after resolving or reopening a request), and on `APPROVALS_CHANGED_EVENT` (dispatched after an approval, rejection, or revocation). The same provider feeds the header and home shortcuts, so one mutation updates every visible badge without a reload.

### 3.8 Public privacy policy and organization settings

`/privacy` is public, server-rendered, and available to anonymous visitors, crawlers, and browsers without JavaScript. It is not wrapped in `AuthGuard` and there is no middleware. It describes the controller, data categories, legal bases, authentication model, processors (Google, Supabase, Vercel), visibility rules, security measures, retention, deletion/anonymization, rights, complaints, cookies/session storage, and policy changes.

The controller details come from the single-row `organization_settings` table. Empty address or contact fields render explicit `non ancora pubblicato` fallbacks rather than invented data. The page's last-updated date is the later of the settings row's `updated_at` and the policy file's modification date. `PRIVACY_POLICY_VERSION` is currently `2026-11-02`; changing the policy text requires bumping that value so members re-accept.

The hourly cache keeps the public page fast and avoids a database read on every request. The accepted trade-off is that an administrator update to `organization_settings` may take up to an hour to appear; the form, the manual, and roadmap 4.8 document this explicitly. No `revalidateTag` call or cache restructuring exists, by design.

### 3.8.1 Administrator organization privacy settings

`/admin/impostazioni` is the administrator-only write path for the single `organization_settings` row. The route sits inside `AuthGuard`, so session, consent, and approval gates run first, and the client component then checks `AuthProvider.isAdmin`; authenticated non-administrators see the same “Accesso riservato” panel used by `/admin/manuale`. The client check is UX only: the database policy calling `is_current_user_admin()` is the authorization boundary.

The screen loads the current values with a direct PostgREST read and shows the database-owned `updated_at` as the last modification date. It exposes exactly the published controller fields: required `organization_name`, optional `address`, optional `contact_email`, and optional `dpo_email`. Every field is labelled as published on the public `/privacy` page, because there is no separate draft or private copy. Empty optional fields are stored as `NULL`, preserving the page's `non ancora pubblicato` fallbacks.

The form follows the project conventions: `noValidate`, Italian client-side validation for the required name and the two optional email shapes, and Italian error mapping through `lib/error-messages.ts` and `lib/organization-settings.ts`. Saving disables the fields and the button, sends only the four editable columns, and treats the returned row as authoritative for both values and `updated_at`. A successful save shows a confirmation with the database timestamp plus a persistent, dismissible notice stating that the public page may take up to an hour to reflect the change. A static hint near the save button repeats the same one-hour cache behavior. The form also explains that settings edits do not require member re-consent; only a change to the policy text and `PRIVACY_POLICY_VERSION` does.

The database grants no INSERT or DELETE on the table, and the UI only updates `id = true`; the single-row invariant is therefore preserved by both layers. The `BEFORE UPDATE` trigger keeps `updated_at` server-owned and rejects any attempt to move the row away from `id = true`. The trigger marks the future audit hook for roadmap 5.3, but no audit table is added here.

### 3.11 In-app administrator manual

`/admin/manuale` is a static, Italian-language reference guide for administrators. It is rendered inside `AuthGuard`, so the usual session, consent, and approval gates run first, and it then checks `AuthProvider.isAdmin`; authenticated members who are not administrators see an **Accesso riservato** panel instead of the guide. `isAdmin` is derived from the profile already loaded for the approval check, so the page does not issue a second profile query.

The guide opens one section at a time. A compact selector highlights the active section, and Previous/Next controls plus **Torna all’indice** provide navigation without returning to the page top. A smaller **Mostra tutto** option switches to the full manual; in that mode every section is visible and a floating **Torna su** chip appears after scrolling so the administrator can return to the top quickly.

The guide covers the five access levels, closed registration and approvals, member maintenance and cross-member export/deletion, events and RSVP/attendance semantics, event templates, the secretariat board, announcement states and scheduling, the privacy-settings form and its one-hour public cache lag, versioned consent, GDPR exports, and `ON DELETE SET NULL` anonymization. It is the last item in the header's administrator-only `Amministrazione` group, after `Avvisi` and `Impostazioni`, and it also has an administrator-only card on the home page.

The file carries a maintenance rule in its header comment and repeats the rule visibly at the bottom of the page: whenever a feature is added, changed, or removed, or a migration/policy changes, the manual must be updated in the same pull request and `MANUAL_LAST_UPDATED` must be refreshed. The manual requires no migration or new database object.

### 3.12 Contextual guidance, empty states, and friendly errors

Member-facing screens use shared contextual UI instead of leaving blank areas or raw technical messages:

- `components/empty-state.tsx` provides the card used by `/iscritti`, `/eventi`, and `/richieste`. It pairs an icon and a plain-language explanation with optional hints and next-step actions, such as opening the request form, clearing filters, switching event scope, creating an event as an administrator, or completing the profile.
- Search fields on the directory and calendar explain what is indexed and that matching ignores letter case; empty search results repeat the query and suggest a shorter or different keyword.
- `/richieste` shows a dedicated empty state when the member has never written to the secretariat, with a button that scrolls to and focuses the submission form. The form includes guidance about useful references and a live character count.
- Approved members see a dismissible onboarding card on `/` with links to events/RSVP, the member directory, secretariat requests, and profile editing. Dismissal is stored per account in `localStorage` under `gruppo-alpini:welcome-hint-dismissed:v1:<user-id>`, so it does not affect another member using the same browser.
- Event, announcement, profile birth-date, and member-edit fields use masked Italian text inputs (`gg/mm/aaaa`, `HH:mm`) from `lib/italian-date.ts` and show the expected format next to the field. Native date/time widgets are not used. Event and birth-date examples include `25/12/2026` and `14/03/1985`; announcement boundaries require both the date and the time when a limit is set.
- Every form sets `noValidate` and validates required fields, email shape, passwords, dates, and times in Italian JavaScript, so browser-language validation bubbles never appear. The member-edit, event, announcement, and template dialogs use the wider `max-w-2xl` layout on desktop so labels, hints, and masked fields stay readable.
- Displayed dates, times, and sorted lists use an explicit Italian locale (`Intl.DateTimeFormat("it-IT", …)`, `Intl.Collator("it-IT", …)`, and the shared `dd/mm/yyyy HH:mm` request formatter) instead of the browser default, so server-rendered and client-rendered output stay Italian.
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
