/**
 * ============================================================================
 * HEADER NAVIGATION MODEL — MAINTENANCE RULE
 * ============================================================================
 *
 * Whenever navigation items or their routes change, update this model, the
 * header markup, the member FAQ hub, and the administrator manual together in
 * the same pull request.
 * ============================================================================
 */

/**
 * Width at which the flat header navigation takes over from the drawer.
 *
 * The widest state (brand, Eventi/Iscritti/Richieste, the administrator
 * divider with Avvisi/Manuale, theme and FAQ controls, and the avatar) needs
 * roughly 860 px. 900 px leaves comfortable breathing room without switching
 * tablets to the drawer earlier than necessary.
 */
export const HEADER_NAV_BREAKPOINT_PX = 900;

export type HeaderNavItemId =
  | "eventi"
  | "iscritti"
  | "richieste"
  | "profilo"
  | "avvisi"
  | "manuale";

/** Labels used by the administrator pending-counter badges. */
export type HeaderNavBadgeKey = "pending-approvals" | "pending-requests";

export type HeaderNavItem = {
  id: HeaderNavItemId;
  href: string;
  label: string;
  badgeKey?: HeaderNavBadgeKey;
};

export const HEADER_PROFILE_ITEM: HeaderNavItem = {
  id: "profilo",
  href: "/profile",
  label: "Profilo",
};

export const HEADER_MEMBER_ITEMS: readonly HeaderNavItem[] = [
  { id: "eventi", href: "/eventi", label: "Eventi" },
  {
    id: "iscritti",
    href: "/iscritti",
    label: "Iscritti",
    badgeKey: "pending-approvals",
  },
  {
    id: "richieste",
    href: "/richieste",
    label: "Richieste",
    badgeKey: "pending-requests",
  },
];

/** Mobile drawer: the member items plus the profile link. */
export const HEADER_DRAWER_MEMBER_ITEMS: readonly HeaderNavItem[] = [
  ...HEADER_MEMBER_ITEMS,
  HEADER_PROFILE_ITEM,
];

export const HEADER_ADMIN_ITEMS: readonly HeaderNavItem[] = [
  { id: "avvisi", href: "/avvisi", label: "Avvisi" },
  { id: "manuale", href: "/admin/manuale", label: "Manuale" },
];

export type HeaderNavigation = {
  /** Flat desktop navigation, without the profile link. */
  memberItems: readonly HeaderNavItem[];
  /** Drawer "Area soci" group, including the profile link. */
  drawerMemberItems: readonly HeaderNavItem[];
  /** Empty for regular members, so the admin group is not rendered at all. */
  adminItems: readonly HeaderNavItem[];
};

export function getHeaderNavigation(isAdmin: boolean): HeaderNavigation {
  return {
    memberItems: HEADER_MEMBER_ITEMS,
    drawerMemberItems: HEADER_DRAWER_MEMBER_ITEMS,
    adminItems: isAdmin ? HEADER_ADMIN_ITEMS : [],
  };
}

/**
 * Current-page matching for header links. Nested routes keep their parent
 * item active, but a shared prefix (`/iscritti-archivio`) does not.
 */
export function isHeaderNavItemActive(pathname: string, href: string): boolean {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const [hrefPath] = href.split(/[?#]/, 1);

  if (!hrefPath || hrefPath === "/") {
    return normalizedPath === "/";
  }

  return (
    normalizedPath === hrefPath || normalizedPath.startsWith(`${hrefPath}/`)
  );
}
