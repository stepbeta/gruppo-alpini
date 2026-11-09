# Gruppo Alpini Portal — Overview & Product Scope

| Field | Value |
| --- | --- |
| Document type | Architecture overview: Product Scope and Operating Model |
| Repository | `gruppo-alpini` |
| Snapshot date | 5 November 2026 |

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
| **Unconsented authenticated account** | Signed in, but no consent row for the current policy version | See the blocking `Consenso necessario` screen, record consent, open the static `/faq` help page, delete their own account, and sign out | Enter the portal through the UI; read member-data tables covered by the consent-restrictive policies |
| **Pending or rejected member** | Signed in and consent accepted, but `approval_status` is not `approved` | See the `Account in attesa di approvazione` or rejection screen, open the static `/faq` help page, export their own data, delete their own account, and sign out | Read the directory, events, responses, requests, announcements, or shop data |
| **Approved member** | `approval_status = 'approved'` | Use the home page, member directory, event calendar and RSVP, personal request form and history, announcement banner, profile, credentials, export, self-deletion, and the `/faq` help hub | Use administrative controls, read other members' RSVPs, or read the secretariat board |
| **Administrator** | `profiles.is_admin = true`, assigned in-app by an existing administrator from `/iscritti` (maximum 4; self-demotion is blocked by the database) | Everything an approved member can do, plus approve/reject accounts, edit member profiles, promote or revoke administrator roles, create/edit/delete events, see all RSVPs and attendance totals, read and resolve all requests, manage announcements, export another member's data, delete another member's account, and read the in-app administrator manual | The database still enforces privacy consent; administrator status is deliberately treated as approved, so the role is not a bypass around the consent gate. An administrator cannot revoke their own role |

Administrators are treated as approved by both the database helper `is_current_user_approved()` and the client. This is deliberate: an accidentally rejected administrator must not lose the ability to repair accounts. The privacy-consent requirement still applies to administrators.

There is also a machine role, `service_role`, used only by the server-side account-deletion route. It is not a human role and its key never reaches the browser.

### 1.3 Functional inventory

| Area | Implemented behavior | Main surface |
| --- | --- | --- |
| **Identity and access** | Email/password sign-up and sign-in, Google OAuth, email confirmation, password recovery, password change, email change, provider-aware credential UI, Italian error messages, safe post-login redirects | `/login`, `/login/forgot`, `/login/reset-password`, `/profile` |
| **Onboarding and consent** | First-login blocking privacy consent, versioned consent history, acceptance alternatives (sign out or delete account), administrator approval workflow | `PrivacyConsentGate`, `ApprovalGate`, `/profile` |
| **Home** | Personal greeting, quick links, administrator shortcuts (including the manual), administrator pending counters on the requests and directory cards, announcement banner | `/` |
| **Member help** | Static task-oriented FAQ / “Guida rapida” with deep links to events, requests, directory, profile, and privacy; reachable from the footer, header, and holding screens | `/faq` |
| **Member directory** | Approved-member directory, name/service-place search, **Tutti** / **Amministratori** / **Utenti** / **In attesa** server-side filter chips, server-side pagination, administrator pending-approvals counter, profile editing, approval badges, in-app administrator promotion/revocation with a cap of 4, deletion | `/iscritti` |
| **Events and RSVP** | Upcoming and past event lists with **Tutti** / **Prossimi** / **Passati** filter chips, search, pagination, Italian date/time input, all-day events, `Presente` / `In forse` / `Assente` responses, attendance totals and names for administrators, event CRUD, reusable event templates, shareable deep links | `/eventi` |
| **Requests** | Personal request submission and history, secretariat board for administrators, status filtering, open/resolved counts, header pending-requests counter, resolve/reopen actions | `/richieste` |
| **Announcements** | Platform-wide banner, optional scheduling window, activation toggle, administrator CRUD, live refresh after changes; the management page is linked from the header's administrator-only group | `/avvisi`, header banner |
| **Profile and credentials** | Editable personal data, password and email management for email/password accounts, Google-account notice, data export, account deletion; reachable from the header avatar menu or the mobile drawer | `/profile` |
| **Privacy and data rights** | Public policy page, dynamic controller details, JSON/text/HTML export, account deletion and anonymization, consent history | `/privacy`, `/profile`, `/iscritti` |
| **Administration** | Approval decisions, member maintenance, event management, request board, announcement management, cross-member export and deletion, in-app administrator manual; `/avvisi` and `/admin/manuale` are grouped together in the header for administrators | Admin controls embedded in the normal pages; `/avvisi`, `/admin/manuale` |

### 1.4 End-to-end journeys

**First access.** A visitor signs up with email/password or continues with Google. The `handle_new_user` trigger creates a `profiles` row with `approval_status = 'pending'`. After email confirmation or OAuth return, the member sees the blocking privacy consent screen. Acceptance appends a row to `user_consents`; only then does the client fetch the profile and discover the approval state. The member sees the holding screen until an administrator approves the account from `/iscritti`.
