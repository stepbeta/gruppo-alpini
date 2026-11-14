# Repository guidance & Context Management

Single-package Next.js 16 (App Router) app + version-controlled Supabase migrations. No workspaces. Vitest unit tests and GitHub Actions CI are configured.

## ⚠️ Strict Token & Context Minimization Rules (Crucial)
- **Targeted Reading:** Do *not* read the entire codebase or all documentation files by default. Only open the specific files required for the task.
- **Modular Reference Map:** Consult only the relevant architectural file rather than loading everything:
  - Product & Scope: `docs/architecture/overview.md`
  - Tech Stack & Topology: `docs/architecture/stack.md`
  - Security, RLS & GDPR: `docs/architecture/security.md`
  - Feature Implementations: `docs/architecture/features.md`
  - Design Decisions & Roadmap: `docs/architecture/roadmap.md`
- **Self-Update Requirement:** If a feature, schema, or core workflow changes during your implementation, update the corresponding file in `docs/architecture/` in the same change.

## Technical and functional baseline
Before changing behavior, consult the relevant module in `docs/architecture/`. Treat them as the current-state reference for the product, architecture, security model, and known gaps.

- Keep changes consistent with the documented roles, consent and approval gates, RLS composition, data-retention rules, event date semantics, and account-deletion flow.
- Supabase is the authorization boundary. Do not replace server-side grants, RLS policies, triggers, or constraints with client-only checks. New tables need matching grants, RLS enablement, and policies; new member-facing tables also need the consent and approval layers unless a deliberate exception is documented.
- Preserve the security invariants: database-owned `events.created_by`, append-only `user_consents`, `ON DELETE SET NULL` historical references, status-only request updates, and the service-role key confined to server code.
- The limitations documented in the architecture notes are known and deliberate. Do not treat them as permission to weaken other controls. When implementing a roadmap improvement, include its documented prerequisites: grants and policies, export coverage where relevant, tests, and documentation.
- If a change alters documented behavior, schema, security, or UX, update the relevant file under `docs/architecture/` in the same change.
- If code and documentation disagree, verify against the SQL migrations and current code, then correct the stale source. Migrations are authoritative for the database.
- Use `README.md` for setup, deployment, migration, and troubleshooting details.

## Commands (verified)
- Verify in this order: `npm run typecheck` → `npm run lint` → `npm test` → `npm run build` (build also runs TypeScript).
- **Fresh clone:** `npm run typecheck` fails with `Cannot find name 'LayoutProps'` until route types exist (`.next/types/`). Fix: `npx next typegen` (fast) or run `next dev`/`npm run build` once.
- Local dev server: `npm run dev` (Turbopack, port 3000).
- Tests: `npm test` (Vitest, unit + database/RLS integration when the local stack is running), `npm run test:unit`, `npm run test:integration`, and `npm run test:coverage`.
  - Integration tests live in `tests/integration/` (one spec per domain). Prerequisites: Docker, then `npm run db:start` and `npm run db:reset`. They read credentials from `supabase status` and never touch `.env.local`; they wipe local public tables and local auth users between tests.
  - `npm test` skips integration when the stack is unavailable; `npm run test:integration` fails instead and is what the separate CI job runs. `npm run test:coverage` runs unit tests only (`lib/`) and is what the main CI job uses.
  - Local `supabase/config.toml` sets `auto_expose_new_tables = false` so explicit migration grants are enforced. Run `npm run db:reset` after changing that setting.
  - There are still no component/route or Playwright E2E tests.

## Next.js 16 specifics
- `next.config.ts` enables `cacheComponents: true`. Any uncached I/O (e.g. a Supabase query) **must** be inside a `<Suspense>` boundary or the build/dev overlay reports a blocking-route error. For the cached server-read pattern, see `app/privacy/page.tsx` and `lib/organization.ts`.
- `NEXT_PUBLIC_*` values are **inlined at build time**. After editing `.env.local`: restart `next dev`, and rebuild before `next start` (a running production server keeps serving values baked into `.next`).

## Supabase
- Env names: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (current Supabase naming — not `*_ANON_KEY`).
- `lib/supabase.ts` exports `supabase: SupabaseClient | null` — `null` until env vars are set/valid. The homepage then shows an "Environment variables not configured" card by design; that's not a bug to debug.
- Migrations: ordered timestamp files in `supabase/migrations/`, applied once. Editing an already-pushed file has no effect — add a new one (`npm run db:new <name>`), then `npm run db:push`.
- CLI auth/link state lives in `supabase/.temp/` (gitignored) → each fresh clone needs: `npx supabase login` (once per machine) and `npm run db:link -- --project-ref ozdwlpnskctxzvgqrxkl`.
- Public-readable tables need **all three** grants, fresh projects have RLS enabled and do not auto-expose new tables: `GRANT SELECT ... TO anon` + `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... FOR SELECT TO anon USING (true)` (see migrations `20261020010000_*` and `20261020020000_*`; symptoms of getting this wrong: `42501 permission denied` or an empty `[]` result).
- Docker is only needed for `npm run db:start` (local stack); pushing to the cloud project does not use it.

## Housekeeping
- `.env.local` is git-ignored and uncommitted; it holds real project credentials locally.
- `.vscode/launch.json` has working debug configs (server-side, client-side, full stack).