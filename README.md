# gruppo-alpini test project

A unified, production-ready **Next.js (App Router)** repository integrated with **Supabase** — TypeScript, Tailwind CSS, ESLint, version-controlled database migrations, VS Code debugging, and free deployment on Vercel.

## Tech stack

| Layer      | Tool                                             |
| ---------- | ------------------------------------------------ |
| Framework  | Next.js 16 (App Router, Turbopack, TypeScript)   |
| Styling    | Tailwind CSS 4                                   |
| Linting    | ESLint 9 (`eslint-config-next`)                  |
| Database   | Supabase (PostgreSQL) via `@supabase/supabase-js`|
| Migrations | Supabase CLI (local, version-controlled SQL)     |
| Hosting    | Vercel (free tier)                               |

## Project structure

```txt
gruppo-alpini/
├── app/
│   ├── layout.tsx       # Root layout: HTML shell, fonts, global styles, metadata
│   ├── page.tsx         # Landing page — server-rendered Supabase connection test
│   └── globals.css      # Tailwind & global styles
├── lib/
│   └── supabase.ts      # Initialized singleton Supabase client
├── supabase/
│   ├── config.toml      # Local Supabase stack configuration (CLI)
│   └── migrations/
│       └── 20261020000000_create_tests_table.sql
├── .vscode/
│   └── launch.json      # Run & debug configs (server, client, full stack)
├── .env.local           # Local environment variables (git-ignored)
├── package.json         # Dependencies & scripts
└── README.md            # This file
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create/fill in `.env.local` in the project root (it is git-ignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

Both values are available in the Supabase dashboard under the **Connect** panel (or **Project Settings → API Keys**).
Until they are set, the homepage gracefully displays a "not configured" message instead of crashing.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the page queries the `tests` table and shows the message stored in the database.

---

## Database migrations (Supabase CLI)

Migrations live in `supabase/migrations/` and are plain, version-controlled SQL files applied in filename order.

### Initialize & link a project

```bash
# One-time: creates supabase/config.toml (already committed in this repo)
npx supabase init

# Link this repo to your cloud Supabase project (find <REF_ID> in
# the dashboard URL: https://supabase.com/dashboard/project/<REF_ID>)
npx supabase link --project-ref <REF_ID>
```

`supabase link` prompts for the database password and records the project ref in `supabase/config.toml`.

### Push local migrations to the cloud database

```bash
npx supabase db push
# equivalent: npm run db:push
```

This applies every pending file in `supabase/migrations/` to the linked cloud project.

### Local development stack (optional)

```bash
npm run db:start        # spin up local Postgres + Studio + API (Docker required)
npm run db:reset        # re-apply all migrations from scratch
npm run db:migrations   # list applied/pending migrations
npm run db:new <name>   # scaffold a new timestamped migration file
npm run db:stop         # stop the local stack
```

After `npm run db:start`, the local API URL is `http://127.0.0.1:54321` and the local publishable/anon key is printed by the CLI — point `.env.local` at those values for fully offline development.

### Creating new migrations

```bash
npm run db:new add_profiles
# → supabase/migrations/<timestamp>_add_profiles.sql
```

Write the SQL, then `npm run db:push` (cloud) or `npm run db:reset` (local).

---

## Scripts

| Script                 | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Start the dev server (Turbopack)                        |
| `npm run build`        | Production build                                        |
| `npm run start`        | Serve the production build                              |
| `npm run lint`         | Run ESLint                                              |
| `npm run typecheck`    | Type-check with `tsc --noEmit`                          |
| `npm run db:*`         | Supabase CLI helpers (`start`, `link`, `push`, …)       |

## Debugging (VS Code)

Open the **Run and Debug** panel (`Ctrl+Shift+D` / `⇧⌘D`), pick a configuration and press `F5`:

- **Next.js: debug server-side** — runs `npm run dev -- --inspect` so breakpoints in server components, route handlers and `lib/supabase.ts` hit.
- **Next.js: debug client-side** — launches Chrome against `http://localhost:3000` for browser-side breakpoints.
- **Next.js: debug client-side (Firefox)** — same, for Firefox (requires the Firefox Debugger extension).
- **Next.js: debug full stack** — attaches Node and opens the browser automatically once the server is ready.

## Deploying to Vercel (free)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new), import the repository — the Next.js framework preset is detected automatically. No build settings need to change.
3. Under **Environment Variables**, add:

   | Name                          | Value                              |
   | ----------------------------- | ---------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`    | `https://<project-ref>.supabase.co`|
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`| Your publishable key           |

4. Click **Deploy**. Every push to the main branch redeploys automatically; preview deployments are created for pull requests.
5. Make sure the cloud database has the schema: `npx supabase link --project-ref <REF_ID>` then `npx supabase db push` (Vercel does not run migrations for you).

> The publishable key is safe to expose to the browser (`NEXT_PUBLIC_*`) — Row Level Security (RLS) is what protects your data: the migrations here `GRANT SELECT` to the `anon` role and add an RLS policy that makes **only** the `tests` table publicly readable.

## Troubleshooting

- **Page shows "Environment variables not configured"** — `.env.local` is missing or still contains placeholders. Fill it in and restart `npm run dev`.
- **Page shows "Query failed"** — the database is reachable but the `tests` table is missing: run `npm run db:push`.
- **Page shows "table is empty"** — apply the initial migration to seed the sample row.
- **CLI cannot link** — make sure you passed the project ref: `npx supabase link --project-ref <REF_ID>` (see the dashboard URL).
