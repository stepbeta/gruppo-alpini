<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory, in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository guidance

Single-package Next.js 16 (App Router) app + version-controlled Supabase migrations. No workspaces, no test runner, no CI.

## Commands (verified)

- Verify in this order: `npm run typecheck` → `npm run lint` → `npm run build` (build also runs TypeScript).
- **Fresh clone:** `npm run typecheck` fails with `Cannot find name 'LayoutProps'` until route types exist (`.next/types/`). Fix: `npx next typegen` (fast) or run `next dev`/`npm run build` once.
- Local dev server: `npm run dev` (Turbopack, port 3000).
- There are no tests — don't look for a test command.

## Next.js 16 specifics

- `next.config.ts` enables `cacheComponents: true`. Any uncached I/O (e.g. a Supabase query) **must** be inside a `<Suspense>` boundary or the build/dev overlay reports a blocking-route error. Copy the pattern from `app/page.tsx`.
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
