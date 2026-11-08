"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-provider";
import {
  APPROVALS_CHANGED_EVENT,
  EMPTY_ADMIN_COUNTERS,
  REQUESTS_CHANGED_EVENT,
  fetchPendingApprovalsCount,
  fetchPendingRequestsCount,
  type AdminCounterCounts,
} from "@/lib/admin-counters";

type AdminCounterSnapshot = {
  userId: string;
  counts: AdminCounterCounts;
};

type AdminCountersContextValue = AdminCounterCounts & {
  refreshRequests: () => Promise<void>;
  refreshApprovals: () => Promise<void>;
};

const AdminCountersContext =
  createContext<AdminCountersContextValue | null>(null);

function mergeCount(
  current: AdminCounterSnapshot | null,
  userId: string,
  key: keyof AdminCounterCounts,
  count: number,
): AdminCounterSnapshot {
  if (current?.userId === userId) {
    if (current.counts[key] === count) return current;
    return { userId, counts: { ...current.counts, [key]: count } };
  }

  return { userId, counts: { ...EMPTY_ADMIN_COUNTERS, [key]: count } };
}

/**
 * Shared administrator pending counts for the header and home shortcuts.
 *
 * The provider is intentionally inert for everyone else: `isAdmin` comes from
 * `AuthProvider`, and no count query is issued until it is true. Failures are
 * already reduced to zero by the fetch helpers, so a counter problem never
 * breaks navigation. Updates arrive from window focus and from the request or
 * approval mutations that dispatch the shared browser events.
 */
export function AdminCountersProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? null;
  const [snapshot, setSnapshot] = useState<AdminCounterSnapshot | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  const refreshRequests = useCallback(async () => {
    const ownerId = activeUserIdRef.current;
    if (!ownerId || ownerId !== userId) return;

    const count = await fetchPendingRequestsCount();

    if (activeUserIdRef.current !== ownerId) return;
    setSnapshot((current) =>
      mergeCount(current, ownerId, "requests", count),
    );
  }, [userId]);

  const refreshApprovals = useCallback(async () => {
    const ownerId = activeUserIdRef.current;
    if (!ownerId || ownerId !== userId) return;

    const count = await fetchPendingApprovalsCount();

    if (activeUserIdRef.current !== ownerId) return;
    setSnapshot((current) =>
      mergeCount(current, ownerId, "approvals", count),
    );
  }, [userId]);

  useEffect(() => {
    const ownerId = isAdmin && userId ? userId : null;
    activeUserIdRef.current = ownerId;

    if (!ownerId) return;

    function refreshAll() {
      void refreshRequests();
      void refreshApprovals();
    }

    refreshAll();

    window.addEventListener("focus", refreshAll);
    window.addEventListener(REQUESTS_CHANGED_EVENT, refreshRequests);
    window.addEventListener(APPROVALS_CHANGED_EVENT, refreshApprovals);

    return () => {
      if (activeUserIdRef.current === ownerId) {
        activeUserIdRef.current = null;
      }
      window.removeEventListener("focus", refreshAll);
      window.removeEventListener(REQUESTS_CHANGED_EVENT, refreshRequests);
      window.removeEventListener(APPROVALS_CHANGED_EVENT, refreshApprovals);
    };
  }, [isAdmin, userId, refreshRequests, refreshApprovals]);

  const counts =
    isAdmin && userId && snapshot?.userId === userId
      ? snapshot.counts
      : EMPTY_ADMIN_COUNTERS;

  const value = useMemo<AdminCountersContextValue>(
    () => ({
      requests: counts.requests,
      approvals: counts.approvals,
      refreshRequests,
      refreshApprovals,
    }),
    [counts.requests, counts.approvals, refreshRequests, refreshApprovals],
  );

  return (
    <AdminCountersContext.Provider value={value}>
      {children}
    </AdminCountersContext.Provider>
  );
}

/** Reads the shared counts. Must be used inside `AdminCountersProvider`. */
export function useAdminCounters(): AdminCountersContextValue {
  const context = useContext(AdminCountersContext);

  if (!context) {
    throw new Error(
      "useAdminCounters must be used inside an AdminCountersProvider",
    );
  }

  return context;
}
