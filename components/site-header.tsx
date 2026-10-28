"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./brand";
import { getInitials, getUserDisplayName } from "@/lib/display";
import { useAuth } from "./auth-provider";
import {
  HomeIcon,
  LogOutIcon,
  UserIcon,
} from "./icons";

const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/profile", label: "Profilo", icon: UserIcon },
];

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const displayName = getUserDisplayName(user);
  const initials = getInitials(displayName);

  async function handleSignOut() {
    setSignOutError(null);
    setIsSigningOut(true);

    const { error } = await signOut();

    if (error) {
      setSignOutError(error);
      setIsSigningOut(false);
      return;
    }

    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          aria-label="Torna alla home"
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
          href="/"
        >
          <Brand compact />
        </Link>

        <nav aria-label="Navigazione principale" className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:inline-flex ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            aria-label="Apri il tuo profilo"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white ring-2 ring-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:ring-zinc-950"
            href="/profile"
            title={displayName}
          >
            {initials}
          </Link>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            disabled={isSigningOut}
            onClick={handleSignOut}
            title="Esci"
            type="button"
          >
            <LogOutIcon className="h-4.5 w-4.5" />
            <span className="sr-only">Esci</span>
          </button>
        </div>
      </div>

      {signOutError ? (
        <div
          className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          Impossibile uscire: {signOutError}
        </div>
      ) : null}
    </header>
  );
}
