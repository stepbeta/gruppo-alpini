# Contributing

This is a volunteer-built portal for a single Gruppo Alpini section. It is public so the code and
the security model can be reviewed, not because it is accepting general contributions.

**Issues and bug reports are welcome. Pull requests are by prior agreement** — open an issue first
so nobody spends effort on a change that will not be merged.

## Reporting a security problem

Do not open an issue. Follow [`SECURITY.md`](SECURITY.md) and use GitHub's private vulnerability
reporting.

## Non-negotiable rules

The database is the authorization boundary in this application, not the interface. Most of what
follows exists to protect that.

- **Never weaken RLS.** Do not remove a policy, widen a `USING` or `WITH CHECK` clause, add a broad
  `GRANT`, or drop a restrictive policy without documenting why. Every table needs its grant, its
  `ENABLE ROW LEVEL SECURITY`, and its policies; a new member-facing table also needs the consent
  and approval layers.
- **No client-only checks.** A control that exists only in a React component is not a control. If a
  rule matters, it belongs in a constraint, a trigger, or a policy.
- **Never edit an applied migration.** Migrations are ordered and applied once. Add a new file:
  ```bash
  npm run db:new <name>
  ```
  Editing an existing migration in `supabase/migrations/` has no effect on an already-migrated
  database and silently diverges from production.
- **Preserve the documented invariants.** `events.created_by` and `event_templates.created_by` are
  database-owned; `user_consents` is append-only; historical references use `ON DELETE SET NULL`;
  `generic_requests` updates are status-only. See `docs/architecture/security.md`.
- **The service-role key is server-only.** Never import `lib/supabase-admin.ts` from a client
  component, never prefix the key with `NEXT_PUBLIC_`, and never add it to CI.
- **Do not commit local notes.** `gaps.md` and `docs/audits/` are gitignored on purpose.

## Before opening a pull request

Run these in order, from a clean tree:

```bash
npm run typecheck
npm run lint
npm test          # unit + integration when the local stack is running
npm run build
```

Anything touching SQL must also pass the integration suite:

```bash
npm run db:start && npm run db:reset && npm run test:integration
```

CI requires two checks on every pull request — `Typecheck, lint and unit tests` and
`Database RLS integration tests`. `main` is protected: no direct pushes, no force pushes, no
deletions.

## Documentation

If a change alters behaviour, the database schema, the security model, or the UX, update the
matching file under `docs/architecture/` in the same pull request. Migrations are authoritative for
the database; if the docs and the SQL disagree, fix the docs.

## Style

- User-facing copy is Italian. Code, comments, commit messages, and documentation are English.
- Match the surrounding code rather than introducing new patterns.
- Conventional commits: `feat(scope): …`, `fix(scope): …`, `test(db): …`, `docs: …`.
- One logical change per pull request.

## Licensing of contributions

The project is currently published without a license; all rights are reserved (see
[`LICENSE`](LICENSE)). By submitting a pull request you agree that your contribution may be
distributed under the project's terms in effect at the time of submission, and under any license
the maintainer adopts later. If you are not able to grant that, please open an issue instead of a
pull request.
