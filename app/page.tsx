import { Suspense, type ReactNode } from "react";
import { supabase, type TestRow } from "@/lib/supabase";

/**
 * Fetches rows from the `tests` table at request time.
 *
 * Because `cacheComponents` is enabled in `next.config.ts`, this uncached
 * database read must live inside a `<Suspense>` boundary (see the page below).
 */
async function ConnectionStatus() {
  const db = supabase;

  if (!db) {
    return (
      <StatusCard
        tone="warning"
        title="Environment variables not configured"
        description="The Supabase client was not created because NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or still a placeholder."
      >
        <CodeBlock
          lines={[
            "# .env.local",
            "NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co",
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>",
          ]}
        />
      </StatusCard>
    );
  }

  let rows: TestRow[] | null = null;
  let queryError: string | null = null;

  try {
    const result = await db
      .from("tests")
      .select("id, message, created_at")
      .order("created_at", { ascending: false });
    rows = result.data;
    queryError = result.error ? result.error.message : null;
  } catch (error) {
    queryError = error instanceof Error ? error.message : String(error);
  }

  if (queryError) {
    return (
      <StatusCard
        tone="error"
        title="Query failed"
        description={`Connected, but reading the tests table failed: ${queryError}`}
      >
        <CodeBlock
          lines={[
            "# apply the local migrations, then reload",
            "npm run db:push",
          ]}
        />
      </StatusCard>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <StatusCard
        tone="warning"
        title="Connected, but the table is empty"
        description="The query succeeded but returned no rows. Run the initial migration to seed the sample record."
      >
        <CodeBlock lines={["npm run db:push"]} />
      </StatusCard>
    );
  }

  return (
    <StatusCard
      tone="success"
      title="Connected to Supabase"
      description={`${rows.length} row${rows.length === 1 ? "" : "s"} retrieved from the tests table.`}
    >
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white text-left dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <span className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {row.message}
            </span>
            <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
              #{row.id} · {new Date(row.created_at).toLocaleString("en-GB")}
            </span>
          </li>
        ))}
      </ul>
    </StatusCard>
  );
}

type StatusCardProps = {
  tone: "success" | "warning" | "error";
  title: string;
  description: string;
  children?: ReactNode;
};

const toneStyles: Record<StatusCardProps["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  error: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
};

const toneDots: Record<StatusCardProps["tone"], string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

function StatusCard({ tone, title, description, children }: StatusCardProps) {
  return (
    <div className={`rounded-2xl border p-6 text-left ${toneStyles[tone]}`}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneDots[tone]}`}
        />
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {description}
      </p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-100 p-4 text-left font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      {lines.join("\n")}
    </pre>
  );
}

function StatusSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-black/40">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            gruppo-alpini
          </span>
          <span className="rounded-full border border-zinc-200 px-3 py-1 font-mono text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Next.js + Supabase
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          Supabase connection check
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          This page is server-rendered and queries the{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-zinc-800">
            tests
          </code>{" "}
          table through the singleton client in{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-zinc-800">
            lib/supabase.ts
          </code>
          , proving that the app, the environment variables and the database
          migrations all work together.
        </p>

        <div className="mt-8">
          <Suspense fallback={<StatusSkeleton />}>
            <ConnectionStatus />
          </Suspense>
        </div>

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Quick commands
          </h2>
          <ul className="mt-3 grid gap-2 font-mono text-xs text-zinc-600 sm:grid-cols-2 dark:text-zinc-400">
            <li>
              <span className="text-zinc-400 dark:text-zinc-500">$</span> npm
              run dev
            </li>
            <li>
              <span className="text-zinc-400 dark:text-zinc-500">$</span> npm
              run db:start
            </li>
            <li>
              <span className="text-zinc-400 dark:text-zinc-500">$</span> npm
              run db:link -- --project-ref &lt;REF_ID&gt;
            </li>
            <li>
              <span className="text-zinc-400 dark:text-zinc-500">$</span> npm
              run db:push
            </li>
          </ul>
        </div>
      </main>

      <footer className="border-t border-zinc-200 py-6 dark:border-zinc-800">
        <p className="mx-auto w-full max-w-3xl px-6 text-center text-xs text-zinc-500 sm:text-left dark:text-zinc-400">
          Deploy free on Vercel — set{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          in
          your project settings.
        </p>
      </footer>
    </div>
  );
}
