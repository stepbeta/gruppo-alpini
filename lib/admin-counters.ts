import { supabase } from "./supabase";

export type AdminCounterKind = "requests" | "approvals";

export type AdminCounterCounts = {
  requests: number;
  approvals: number;
};

export const EMPTY_ADMIN_COUNTERS: AdminCounterCounts = {
  requests: 0,
  approvals: 0,
};

/** Visually cap large queues so the header layout stays stable. */
export const ADMIN_COUNTER_DISPLAY_LIMIT = 99;

const COUNTER_NOUNS: Record<
  AdminCounterKind,
  { singular: string; plural: string }
> = {
  requests: {
    singular: "richiesta in attesa",
    plural: "richieste in attesa",
  },
  approvals: {
    singular: "approvazione in attesa",
    plural: "approvazioni in attesa",
  },
};

export type AdminCounterBadgeData = {
  /** Short value shown inside the badge (`12` or `99+`). */
  display: string;
  /** Full Italian accessible label, including counts above the display cap. */
  label: string;
};

/**
 * Decides whether a counter badge should be rendered and what it should say.
 *
 * Counts are admin-only: regular members must not see a badge, even when a
 * stale local value is still present. Zero and invalid values render nothing;
 * values above the display limit keep the real number in the accessible label.
 */
export function getAdminCounterBadge(
  kind: AdminCounterKind,
  count: number,
  isAdmin: boolean,
): AdminCounterBadgeData | null {
  if (!isAdmin) return null;

  const safeCount = Number.isFinite(count) ? Math.floor(count) : 0;
  if (safeCount <= 0) return null;

  const nouns = COUNTER_NOUNS[kind];

  return {
    display:
      safeCount > ADMIN_COUNTER_DISPLAY_LIMIT
        ? `${ADMIN_COUNTER_DISPLAY_LIMIT}+`
        : String(safeCount),
    label: `${safeCount} ${safeCount === 1 ? nouns.singular : nouns.plural}`,
  };
}

/**
 * Dispatched after a request is resolved or reopened. The header and home
 * counters listen for it so their queues update without a page reload.
 */
export const REQUESTS_CHANGED_EVENT = "gruppo-alpini:requests-changed";

/**
 * Dispatched after an administrator approves, rejects, or revokes a member.
 * The counter listener uses it to refresh the pending-approvals queue.
 */
export const APPROVALS_CHANGED_EVENT = "gruppo-alpini:approvals-changed";

function dispatchChangeEvent(eventName: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
}

export function notifyRequestsChanged(): void {
  dispatchChangeEvent(REQUESTS_CHANGED_EVENT);
}

export function notifyApprovalsChanged(): void {
  dispatchChangeEvent(APPROVALS_CHANGED_EVENT);
}

/**
 * Exact number of open secretariat requests.
 *
 * The query asks Supabase for a HEAD count, so no rows are downloaded. Any
 * failure is swallowed and treated as zero: a counter problem must never break
 * a page, matching the announcement banner's degradation strategy.
 */
export async function fetchPendingRequestsCount(): Promise<number> {
  if (!supabase) return 0;

  try {
    const { count, error } = await supabase
      .from("generic_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    if (error) return 0;

    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Exact number of accounts waiting for approval. Only administrators can read
 * these rows, and their select policy already authorizes the HEAD count.
 */
export async function fetchPendingApprovalsCount(): Promise<number> {
  if (!supabase) return 0;

  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "pending");

    if (error) return 0;

    return count ?? 0;
  } catch {
    return 0;
  }
}
