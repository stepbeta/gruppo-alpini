"use client";

/**
 * ============================================================================
 * HEADER NAVIGATION & CONTROLS — MAINTENANCE RULE
 * ============================================================================
 *
 * Whenever navigation items, header controls, or their routes are modified in
 * the application, keep this header, the member help hub (`/faq`), and the
 * administrator manual aligned in the same pull request.
 *
 * The navigation model lives in `lib/navigation.ts`; update it together with
 * this file. The `min-[900px]` responsive classes mirror
 * `HEADER_NAV_BREAKPOINT_PX`.
 * ============================================================================
 */

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminCounterBadge } from "./admin-counter-badge";
import { useAdminCounters } from "./admin-counters-provider";
import { Brand } from "./brand";
import { AnnouncementBanner } from "./announcement-banner";
import { getInitials, getUserDisplayName } from "@/lib/display";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-toggle";
import {
  getAdminCounterBadge,
  type AdminCounterBadgeData,
} from "@/lib/admin-counters";
import {
  HEADER_NAV_BREAKPOINT_PX,
  HEADER_PROFILE_ITEM,
  getHeaderNavigation,
  isHeaderNavItemActive,
  type HeaderNavBadgeKey,
  type HeaderNavItem,
  type HeaderNavItemId,
} from "@/lib/navigation";
import {
  BookOpenIcon,
  CalendarIcon,
  HelpCircleIcon,
  LogOutIcon,
  MailIcon,
  MegaphoneIcon,
  MenuIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "./icons";

type IconComponent = ComponentType<{ className?: string }>;

const NAV_ICONS: Record<HeaderNavItemId, IconComponent> = {
  eventi: CalendarIcon,
  iscritti: UsersIcon,
  richieste: MailIcon,
  profilo: UserIcon,
  avvisi: MegaphoneIcon,
  manuale: BookOpenIcon,
};

type HeaderNavBadges = Partial<
  Record<HeaderNavBadgeKey, AdminCounterBadgeData | null>
>;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ACTIVE_LINK_CLASSES =
  "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
const INACTIVE_LINK_CLASSES =
  "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";

function HeaderNavLink({
  badges,
  item,
  onNavigate,
  pathname,
  variant,
}: {
  badges: HeaderNavBadges;
  item: HeaderNavItem;
  onNavigate?: () => void;
  pathname: string;
  variant: "desktop" | "drawer";
}) {
  const Icon = NAV_ICONS[item.id];
  const badge = item.badgeKey ? (badges[item.badgeKey] ?? null) : null;
  const isActive = isHeaderNavItemActive(pathname, item.href);
  const layoutClasses =
    variant === "desktop"
      ? "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
      : "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium";

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`${layoutClasses} transition-colors ${
        isActive ? ACTIVE_LINK_CLASSES : INACTIVE_LINK_CLASSES
      }`}
      href={item.href}
      onClick={onNavigate}
    >
      <Icon
        className={
          variant === "desktop" ? "h-4 w-4" : "h-4.5 w-4.5 shrink-0"
        }
      />
      <span className="flex min-w-0 items-center gap-1.5">
        <span>{item.label}</span>
        <AdminCounterBadge badge={badge} />
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { user, signOut, isAdmin } = useAuth();
  const { requests: pendingRequests, approvals: pendingApprovals } =
    useAdminCounters();
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const wasDrawerOpenRef = useRef(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuItemRefs = useRef<Array<HTMLElement | null>>([]);

  const { memberItems, drawerMemberItems, adminItems } =
    getHeaderNavigation(isAdmin);
  const badges: HeaderNavBadges = {
    "pending-approvals": getAdminCounterBadge(
      "approvals",
      pendingApprovals,
      isAdmin,
    ),
    "pending-requests": getAdminCounterBadge(
      "requests",
      pendingRequests,
      isAdmin,
    ),
  };
  const displayName = getUserDisplayName(user);
  const initials = getInitials(displayName);
  const isProfileActive = isHeaderNavItemActive(
    pathname,
    HEADER_PROFILE_ITEM.href,
  );

  // Close both surfaces on navigation, including browser back/forward.
  const previousPathnameRef = useRef(pathname);
  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    setIsDrawerOpen(false);
    setIsAccountMenuOpen(false);
  }, [pathname]);

  // Move focus into the drawer on open and back to the hamburger on close.
  useEffect(() => {
    if (isDrawerOpen) {
      wasDrawerOpenRef.current = true;
      drawerCloseButtonRef.current?.focus();
      return;
    }

    if (wasDrawerOpenRef.current) {
      wasDrawerOpenRef.current = false;
      drawerTriggerRef.current?.focus();
    }
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen]);

  // A viewport that grows past the breakpoint must not leave the drawer or the
  // account menu open behind the flat navigation.
  useEffect(() => {
    const media = window.matchMedia(
      `(min-width: ${HEADER_NAV_BREAKPOINT_PX}px)`,
    );

    function handleBreakpointChange(event: MediaQueryListEvent) {
      if (!event.matches) return;
      setIsDrawerOpen(false);
      setIsAccountMenuOpen(false);
    }

    media.addEventListener("change", handleBreakpointChange);
    return () => media.removeEventListener("change", handleBreakpointChange);
  }, []);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        accountMenuRef.current?.contains(target) ||
        accountMenuButtonRef.current?.contains(target)
      ) {
        return;
      }

      setIsAccountMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isAccountMenuOpen]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      setIsAccountMenuOpen(false);
      accountMenuButtonRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAccountMenuOpen]);

  useEffect(() => {
    if (isAccountMenuOpen) {
      accountMenuItemRefs.current[0]?.focus();
    }
  }, [isAccountMenuOpen]);

  async function handleSignOut() {
    setSignOutError(null);
    setIsSigningOut(true);
    setIsDrawerOpen(false);
    setIsAccountMenuOpen(false);

    const { error } = await signOut();

    if (error) {
      setSignOutError(error);
      setIsSigningOut(false);
      return;
    }

    router.replace("/login");
  }

  function handleDrawerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsDrawerOpen(false);
      return;
    }

    if (event.key !== "Tab") return;

    const focusable =
      drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleAccountMenuButtonKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    setIsAccountMenuOpen(true);
  }

  function handleAccountMenuKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    const items = accountMenuItemRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );

    if (items.length === 0) return;

    if (event.key === "Tab") {
      setIsAccountMenuOpen(false);
      return;
    }

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <AnnouncementBanner />

        <div className="mx-auto w-full max-w-5xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              aria-label="Torna alla pagina iniziale"
              className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
              href="/"
            >
              <Brand compact />
            </Link>

            <nav
              aria-label="Navigazione principale"
              className="hidden items-center gap-1 min-[900px]:flex"
            >
              {memberItems.map((item) => (
                <HeaderNavLink
                  badges={badges}
                  item={item}
                  key={item.id}
                  pathname={pathname}
                  variant="desktop"
                />
              ))}

              {adminItems.length > 0 ? (
                <>
                  <span
                    aria-hidden="true"
                    className="mx-1.5 h-6 w-px bg-zinc-200 dark:bg-zinc-800"
                  />
                  <div
                    aria-label="Amministrazione"
                    className="flex items-center gap-1"
                    role="group"
                  >
                    {adminItems.map((item) => (
                      <HeaderNavLink
                        badges={badges}
                        item={item}
                        key={item.id}
                        pathname={pathname}
                        variant="desktop"
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                aria-current={pathname === "/faq" ? "page" : undefined}
                aria-label="Apri la guida rapida e le FAQ"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  pathname === "/faq"
                    ? ACTIVE_LINK_CLASSES
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
                href="/faq"
                title="Guida rapida e FAQ"
              >
                <HelpCircleIcon className="h-4.5 w-4.5" />
              </Link>

              <div className="relative hidden min-[900px]:block">
                <button
                  aria-controls="account-menu"
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`Menu del profilo di ${displayName}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white ring-2 ring-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:ring-zinc-950"
                  onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
                  onKeyDown={handleAccountMenuButtonKeyDown}
                  ref={accountMenuButtonRef}
                  title={displayName}
                  type="button"
                >
                  <span aria-hidden="true">{initials}</span>
                </button>

                {isAccountMenuOpen ? (
                  <div
                    aria-label="Menu del profilo"
                    className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-950/10 dark:border-zinc-800 dark:bg-zinc-900"
                    id="account-menu"
                    onKeyDown={handleAccountMenuKeyDown}
                    ref={accountMenuRef}
                    role="menu"
                  >
                    <Link
                      aria-current={isProfileActive ? "page" : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                        isProfileActive
                          ? ACTIVE_LINK_CLASSES
                          : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      }`}
                      href={HEADER_PROFILE_ITEM.href}
                      onClick={() => setIsAccountMenuOpen(false)}
                      ref={(node) => {
                        accountMenuItemRefs.current[0] = node;
                      }}
                      role="menuitem"
                    >
                      <UserIcon className="h-4 w-4" />
                      {HEADER_PROFILE_ITEM.label}
                    </Link>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      disabled={isSigningOut}
                      onClick={handleSignOut}
                      ref={(node) => {
                        accountMenuItemRefs.current[1] = node;
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      {isSigningOut ? "Uscita in corso…" : "Esci"}
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                aria-controls="site-navigation-drawer"
                aria-expanded={isDrawerOpen}
                aria-label="Apri il menu di navigazione"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 min-[900px]:hidden dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setIsDrawerOpen(true)}
                ref={drawerTriggerRef}
                type="button"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            </div>
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

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 min-[900px]:hidden">
          <button
            aria-label="Chiudi il menu di navigazione"
            className="absolute inset-0 h-full w-full cursor-default bg-zinc-950/45 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
            tabIndex={-1}
            type="button"
          />

          <div
            aria-labelledby="site-navigation-drawer-title"
            aria-modal="true"
            className="absolute inset-x-0 top-0 max-h-dvh overflow-y-auto rounded-b-3xl border-b border-zinc-200 bg-white p-4 shadow-2xl shadow-zinc-950/20 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950"
            id="site-navigation-drawer"
            onKeyDown={handleDrawerKeyDown}
            ref={drawerRef}
            role="dialog"
            tabIndex={-1}
          >
            <h2 className="sr-only" id="site-navigation-drawer-title">
              Menu di navigazione
            </h2>

            <div className="flex items-center justify-between gap-4">
              <Brand compact />
              <button
                aria-label="Chiudi il menu di navigazione"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setIsDrawerOpen(false)}
                ref={drawerCloseButtonRef}
                type="button"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <nav aria-label="Navigazione mobile" className="mt-5">
              <p
                className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400"
                id="drawer-member-heading"
              >
                Area soci
              </p>
              <ul
                aria-labelledby="drawer-member-heading"
                className="mt-2 space-y-1"
              >
                {drawerMemberItems.map((item) => (
                  <li key={item.id}>
                    <HeaderNavLink
                      badges={badges}
                      item={item}
                      onNavigate={() => setIsDrawerOpen(false)}
                      pathname={pathname}
                      variant="drawer"
                    />
                  </li>
                ))}
              </ul>

              {adminItems.length > 0 ? (
                <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <p
                    className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400"
                    id="drawer-admin-heading"
                  >
                    Amministrazione
                  </p>
                  <ul
                    aria-labelledby="drawer-admin-heading"
                    className="mt-2 space-y-1"
                  >
                    {adminItems.map((item) => (
                      <li key={item.id}>
                        <HeaderNavLink
                          badges={badges}
                          item={item}
                          onNavigate={() => setIsDrawerOpen(false)}
                          pathname={pathname}
                          variant="drawer"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </nav>

            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                <LogOutIcon className="h-4.5 w-4.5 shrink-0" />
                {isSigningOut ? "Uscita in corso…" : "Esci"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
