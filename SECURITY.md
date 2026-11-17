# Security Policy

This repository holds the source of the Gruppo Alpini member portal: a Next.js application on
Supabase. The code is public; the member data it serves is not.

## Supported versions

Only the currently deployed `main` branch is supported. There are no versioned releases, no
maintenance branches, and no backports to older commits.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting:

**https://github.com/stepbeta/gruppo-alpini/security/advisories/new**

Do **not** open a public issue, pull request, or discussion for a security problem. Anything posted
publicly is immediately visible to everyone, including anyone who would exploit it.

A useful report includes:

- the component involved (a table, policy, API route, or page);
- the steps to reproduce, with the account type and state you used;
- what an attacker gains — specifically, whether another member's data becomes readable or
  writable, or whether an authorization decision can be bypassed;
- the impact you believe this has, and any suggested fix.

## What is in scope

- **The authorization boundary.** Row Level Security policies, table and column grants,
  `SECURITY DEFINER` helpers, and triggers under `supabase/migrations/`. In this application the
  database is the authorization boundary, not the interface, so a policy that permits more than
  documented is a valid and serious finding.
- **Privilege separation.** Any path by which a browser client could reach service-role capability,
  including the account-deletion route and anything that handles access tokens.
- **Authentication and session handling.** Google OAuth and email flows, redirect and callback
  validation, session refresh, sign-out.
- **Privacy and GDPR features.** The data-export RPC, the consent record, account deletion and the
  anonymization of historical rows.
- **Client-side trust.** Any control that exists only in the interface and can be bypassed by
  calling the API directly.

## What is out of scope

- Findings that require the service-role key, the database password, or direct access to the
  database. Those credentials are the trust boundary; holding them is already game over.
- The local development stack's published default keys (`supabase start` prints them by design).
- Denial of service, rate limiting, spam, and infrastructure-level issues. Report those to
  Supabase, Vercel, or GitHub.
- Missing hardening headers and Content Security Policy. This is a tracked, known gap.
- The deliberate limitations documented in `docs/architecture/security.md`: consent is recorded but
  the database helper does not enforce a specific policy version, administrator role changes are
  not written to an audit table, and the `purchase_*` tables are dormant. These are accepted
  decisions — report them only if you find a **new** way to escalate them.
- Output from an automated scanner with no demonstrated impact path.

## Rules of engagement

- Use your own account. Never read, modify, or delete another member's data.
- Do not test against the production deployment with real member data. If a production-only issue
  is suspected, describe it and let the maintainer reproduce it.
- No social engineering, no physical testing, no automated traffic that degrades the service.
- Allow a reasonable disclosure window — 90 days is the default expectation — and coordinate the
  timing of any write-up.

## What to expect

Reports are acknowledged on a best-effort basis, normally within seven days. This is a
volunteer-run project: there is no bug bounty and no payment. Good-faith research conducted within
this policy is welcome, and no action will be taken against researchers for accidental impact that
stays within it.

## Further reading

`docs/architecture/security.md` describes the authorization model, the RLS policy matrix, and the
data-retention rules in detail. `docs/architecture/stack.md` covers the deployment topology.
