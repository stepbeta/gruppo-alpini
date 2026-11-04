"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./brand";
import { AnnouncementBanner } from "./announcement-banner";
import { getInitials, getUserDisplayName } from "@/lib/display";
import { useAuth } from "./auth-provider";
import {
  BookOpenIcon,
  CalendarIcon,
  HomeIcon,
  LogOutIcon,
  MailIcon,
  UserIcon,
  UsersIcon,
} from "./icons";

const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/eventi", label: "Eventi", icon: CalendarIcon },
  { href: "/iscritti", label: "Iscritti", icon: UsersIcon },
  { href: "/richieste", label: "Richieste", icon: MailIcon },
  { href: "/profile", label: "Profilo", icon: UserIcon },
];

const adminNavItem = {
  href: "/admin/manuale",
  label: "Manuale",
  icon: BookOpenIcon,
};

export function SiteHeader() {
  const { user, signOut, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const displayName = getUserDisplayName(user);
  const initials = getInitials(displayName);
  const visibleNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;
  const visibleMobileNavItems = visibleNavItems.filter(
    (item) => item.href !== "/",
  );

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
      <AnnouncementBanner />

      <div className="mx-auto w-full max-w-5xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            aria-label="Torna alla home"
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
            href="/"
          >
            <Brand compact />
          </Link>

          <nav
            aria-label="Navigazione principale"
            className="hidden items-center gap-1 lg:flex"
          >
            {visibleNavItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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

        <nav
          aria-label="Navigazione mobile"
          className={`mt-2 grid grid-cols-2 gap-1 lg:hidden ${
            isAdmin ? "sm:grid-cols-5" : "sm:grid-cols-4"
          }`}
        >
          {visibleMobileNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-base font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
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
