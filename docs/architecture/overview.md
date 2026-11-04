# Gruppo Alpini Portal — Overview & Product Scope

| Field | Value |
| --- | --- |
| Document type | Architecture overview: Product Scope and Operating Model |
| Repository | `gruppo-alpini` |
| Snapshot date | 4 November 2026 |

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
