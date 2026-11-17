# Secret inventory and rotation runbook

Living document — unlike the dated files beside it, this one is updated whenever a credential is
added, rotated or retired.

Two rules govern everything below:

1. **Rotate one credential at a time**, and verify before revoking the old one. A rotation that
   removes the old value first is an outage, not a rotation.
2. **A secret lives in exactly two places**: Vercel (production) and `.env.local` (this machine,
   gitignored). A copy anywhere else — a shell history file, a CI variable, a note, a screenshot —
   is a finding.

---

## 1. Inventory

| # | Secret | Where it lives | Blast radius if leaked | Rotation |
| --- | --- | --- | --- | --- |
| 1 | Supabase **secret key** (`sb_secret_…`) | Vercel Production (Sensitive), `.env.local` as `SUPABASE_SERVICE_ROLE_KEY` | **Total.** Bypasses every RLS policy and can delete any auth user. | Easy, no downtime |
| 2 | Supabase **publishable key** (`sb_publishable_…`) | Vercel, browser bundle | None — public by design. Rotating only invalidates cached clients. | Easy |
| 3 | Supabase **project JWT secret** | Supabase dashboard only; the app never reads it | **Total impersonation.** Can forge an access token for any user, including an administrator, without touching Auth. | Medium — signs everyone out |
| 4 | Supabase **database password** | Dashboard, cached in `supabase/.temp/pooler-url`, used by `db:push` | **Total.** Direct Postgres as the owner role; RLS does not apply. | Medium |
| 5 | **Google OAuth client secret** | Supabase Auth provider config, Google Cloud Console | Impersonate this app to Google. Needs control of a registered redirect URI to be useful. | Easy |
| 6 | **SMTP API key** (once configured) | Supabase Auth SMTP settings, provider dashboard | Send mail as the associazione's domain — phishing with perfect SPF/DKIM. | Easy |
| 7 | **SSH private key** `~/.ssh/id_ed25519` | This machine; used for git auth *and* commit signing | Push as the maintainer (branch protection still blocks `main`), and forge authorship from this machine. | Easy |
| 8 | **GitHub 2FA + recovery codes** | Recovery codes offline | Full account control: repo visibility, rulesets, secrets, collaborators. | Hard |
| 9 | **Vercel access tokens** | `~/.local/share/com.vercel.cli/auth.json`; account tokens are **account-wide and unscopable** | Deploy arbitrary code to production and read every environment variable. | Easy |
| 10 | **Supabase CLI access token** | `~/.supabase/access-token` | Manage projects, read auth config, run SQL against production. | Easy |
| 11 | **`gh` OAuth token** | `~/.config/gh/hosts.yml` | Scopes `repo`, `read:org`, `gist` — read/write the repository. | Easy |
| 12 | **Recovery email account** | `stefano.ciarcia+github@proton.me` | **Root credential.** Owns the recovery path for GitHub, Vercel and Supabase. | Hard |
| 13 | Legacy `anon` / `service_role` keys | Disabled | n/a — keep disabled. | n/a |
| 14 | Local stack keys | Printed by `supabase status` | None — published defaults. | n/a |

`VERCEL_OIDC_TOKEN` in `.env.local` is short-lived and machine-generated; it is not a rotation
target, but it must never be committed.

The app reads exactly three values: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Procedures

### 2.1 Supabase secret key — the routine one

1. Dashboard → **Project Settings → API Keys → Secret keys** → create a second key.
2. Vercel → **Settings → Environment Variables** → replace `SUPABASE_SECRET_KEY` (Production,
   Sensitive) → save.
3. **Redeploy**: environment changes only apply to new deployments. Deployments → ⋯ → Redeploy.
4. Verify on production: delete a throwaway account — that path exercises
   `auth.admin.deleteUser` with the new key.
5. Revoke the old key in Supabase.
6. Update `.env.local` if it holds the same value.

No user is signed out by this rotation.

> `.env.local` uses the name `SUPABASE_SERVICE_ROLE_KEY`. If that value is an old-format JWT, local
> runs against the **cloud** project will fail now that legacy keys are disabled; use the
> `sb_secret_…` value instead. Against the local stack it is irrelevant.

### 2.2 Project JWT secret — the disruptive one

1. Accept the consequence: **every session is invalidated** and everyone signs in again.
2. Dashboard → **Project Settings → API → JWT Settings** → generate a new secret.
3. Nothing to update in this repository — the application never reads the secret.
4. Verify with a Google sign-in and an email sign-in.
5. Legacy API keys are already disabled, so no dependent credentials need reissuing.

### 2.3 Database password

1. Dashboard → **Project Settings → Database** → reset the database password.
2. Refresh the CLI's cached connection string: `npm run db:link -- --project-ref <REF_ID>`.
3. Update any local `.env` that opens a direct Postgres connection, and any saved `psql` command.
4. Verify: `npx supabase migration list` (read) and `npm run db:push` (no-op write).

### 2.4 Google OAuth client secret

1. Google Cloud Console → **APIs & Services → Credentials** → the OAuth client → reset the secret.
2. Supabase → **Authentication → Providers → Google** → paste the new client secret.
3. Verify sign-in immediately; the old secret stops working the moment it is reset.

### 2.5 SMTP API key *(once configured)*

1. Provider dashboard → create a new key.
2. Supabase → **Authentication → Emails → SMTP** → replace the password.
3. Verify with a password reset to a real inbox.

### 2.6 SSH keypair (authentication and signing)

1. `ssh-keygen -t ed25519 -C "stefano <year>" -f ~/.ssh/id_ed25519_<year>`
2. GitHub → **Settings → SSH and GPG keys** → add the new public key **twice**: once as
   *Authentication Key*, once as *Signing Key*.
3. Point git at it:
   ```bash
   git config --global user.signingkey ~/.ssh/id_ed25519_<year>.pub
   printf '%s %s\n' "$(git config user.email)" "$(cat ~/.ssh/id_ed25519_<year>.pub)" \
     > ~/.config/git/allowed_signers
   ```
4. Verify both halves before removing the old key: push a branch, and check that a signed commit
   reports `verified: true`:
   ```bash
   gh api repos/stepbeta/gruppo-alpini/commits/$(git rev-parse HEAD) \
     --jq '.commit.verification | {verified, reason}'
   ```
5. Remove the old key from GitHub, then delete the old files locally.

Do this immediately if the laptop is lost or replaced — a copy of this key is what makes a stolen
disk equivalent to a stolen GitHub account.

### 2.7 CLI sessions

```bash
gh auth logout      && gh auth login
vercel logout       && vercel login
npx supabase logout && npx supabase login
```

Then revoke anything unused: Vercel → **Account Settings → Tokens**, GitHub → **Settings →
Developer settings → Personal access tokens**. Vercel tokens are account-wide; create none unless a
specific pipeline needs one, and prefer short expiry.

### 2.8 Account recovery (the root of everything)

- Regenerate GitHub recovery codes after any rotation and store them offline, not in the repo.
- The recovery email account is the master key to all three platforms. It needs the strongest
  second factor available, and it should never be used as an application sender address.
- Vercel and Supabase both authenticate through GitHub for this project; securing GitHub secures
  them.

---

## 3. When to rotate

| Trigger | Credentials |
| --- | --- |
| Suspected exposure (shared screen, log, screenshot, committed file) | All plausible ones, starting with #1–#4 |
| Lost or replaced device | #7, #9, #10, #11, then #8 and #12 |
| Handover to the client, or anyone with access leaves | #1, #3, #4, #9, #12 — and transfer account ownership |
| Annual hygiene | #1, #6, #7 |

Never rotate during a deploy freeze or immediately before a demo.

---

## 4. Rotation log

Record every rotation here; a credential with no date is a credential nobody has thought about.

| Date | Credential | Reason | Verified |
| --- | --- | --- | --- |
| 2026-11-17 | Removed `SUPABASE_JWT_SECRET`, `POSTGRES_*`, legacy aliases from Vercel | Unused credentials in the runtime | n/a |
| 2026-11-17 | Legacy `anon` / `service_role` API keys disabled | Migrated to publishable/secret keys | Sign-in, directory, request, account deletion |
|  |  |  |  |
