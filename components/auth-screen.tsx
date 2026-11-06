import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";

type AuthScreenProps = {
  title: string;
  description: string;
  children: ReactNode;
};

/** Shared visual shell for the public authentication pages. */
export function AuthScreen({
  title,
  description,
  children,
}: AuthScreenProps) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <ThemeToggle className="absolute right-4 top-4 z-10 bg-white/80 shadow-sm dark:bg-zinc-950/80" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-100/80 to-transparent dark:from-emerald-950/40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-900/20"
      />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Brand />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {title}
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>

        {children}

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-zinc-500 dark:text-zinc-500">
          <p>Accesso riservato ai soci del Gruppo Alpini.</p>
          <Link
            className="rounded font-medium transition-colors hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:hover:text-emerald-400"
            href="/privacy"
          >
            Privacy
          </Link>
        </footer>
      </div>
    </main>
  );
}
