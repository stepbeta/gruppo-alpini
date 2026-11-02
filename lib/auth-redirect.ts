/**
 * Helpers for preserving the page a visitor wanted before signing in.
 *
 * `next` values are user-controlled, so only same-origin absolute paths are
 * accepted. Login routes are rejected to avoid redirect loops.
 */

const PENDING_REDIRECT_KEY = "gruppo-alpini:post-auth-redirect";
const REDIRECT_BASE = "https://gruppo-alpini.invalid";

/** Returns a safe internal path, or null when no redirect should happen. */
export function getSafeRedirectPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  try {
    const url = new URL(trimmed, REDIRECT_BASE);

    if (url.origin !== REDIRECT_BASE) return null;

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return null;
    }

    if (
      pathname.startsWith("//") ||
      pathname.includes("\\") ||
      /[\u0000-\u001F\u007F]/.test(pathname) ||
      pathname === "/login" ||
      pathname.startsWith("/login/")
    ) {
      return null;
    }

    const path = `${url.pathname}${url.search}${url.hash}`;
    return path === "/" ? null : path;
  } catch {
    return null;
  }
}

/** Reads the current browser location as a safe post-login destination. */
export function getCurrentRedirectPath(): string | null {
  if (typeof window === "undefined") return null;

  return getSafeRedirectPath(
    `${window.location.pathname}${window.location.search}`,
  );
}

/** Builds the login URL that returns to `nextPath` after authentication. */
export function buildLoginHref(nextPath: string | null): string {
  const safePath = getSafeRedirectPath(nextPath);
  return safePath ? `/login?next=${encodeURIComponent(safePath)}` : "/login";
}

/**
 * Stores a deep link that must survive a full-page OAuth or email-confirmation
 * round trip. Supabase returns those flows to the site origin, so the intended
 * destination cannot stay in the app URL.
 */
export function rememberPostAuthRedirect(nextPath: string | null): void {
  if (typeof window === "undefined") return;

  try {
    const safePath = getSafeRedirectPath(nextPath);

    if (!safePath) {
      window.sessionStorage.removeItem(PENDING_REDIRECT_KEY);
      return;
    }

    window.sessionStorage.setItem(PENDING_REDIRECT_KEY, safePath);
  } catch {
    // Private modes or blocked storage: deep linking falls back to the home page.
  }
}

/** Reads and clears the stored deep link. */
export function consumePostAuthRedirect(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(PENDING_REDIRECT_KEY);
    window.sessionStorage.removeItem(PENDING_REDIRECT_KEY);
    return getSafeRedirectPath(stored);
  } catch {
    return null;
  }
}

/**
 * Reads the destination for the login page.
 *
 * The `next` query parameter wins when present. If it is absent (for example
 * after a cancelled OAuth round trip), a stored deep link is reused.
 */
export function readLoginRedirect(search: string): string | null {
  const params = new URLSearchParams(search);

  if (params.has("next")) {
    return getSafeRedirectPath(params.get("next"));
  }

  return getPendingPostAuthRedirect();
}

function getPendingPostAuthRedirect(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return getSafeRedirectPath(
      window.sessionStorage.getItem(PENDING_REDIRECT_KEY),
    );
  } catch {
    return null;
  }
}

/** Removes a stored destination after an aborted or unrelated auth attempt. */
export function clearPostAuthRedirect(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(PENDING_REDIRECT_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
