import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_COUNTER_DISPLAY_LIMIT,
  APPROVALS_CHANGED_EVENT,
  REQUESTS_CHANGED_EVENT,
  getAdminCounterBadge,
  notifyApprovalsChanged,
  notifyRequestsChanged,
} from "./admin-counters";

// The badge decision and event names are pure and covered here. The counting
// queries themselves are client-side Supabase HEAD requests, which this unit
// suite does not exercise.
vi.mock("./supabase", () => ({ supabase: null }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAdminCounterBadge", () => {
  it("hides the badge from regular members even when a count is present", () => {
    expect(getAdminCounterBadge("requests", 12, false)).toBeNull();
    expect(getAdminCounterBadge("approvals", 3, false)).toBeNull();
  });

  it("renders nothing for zero or invalid counts", () => {
    expect(getAdminCounterBadge("requests", 0, true)).toBeNull();
    expect(getAdminCounterBadge("approvals", -1, true)).toBeNull();
    expect(getAdminCounterBadge("approvals", Number.NaN, true)).toBeNull();
  });

  it("shows the exact count below the display limit", () => {
    expect(getAdminCounterBadge("requests", 1, true)).toEqual({
      display: "1",
      label: "1 richiesta in attesa",
    });
    expect(getAdminCounterBadge("requests", 12, true)).toEqual({
      display: "12",
      label: "12 richieste in attesa",
    });
    expect(getAdminCounterBadge("approvals", 3, true)).toEqual({
      display: "3",
      label: "3 approvazioni in attesa",
    });
  });

  it("caps the visible number at 99+ but keeps the real count in the label", () => {
    expect(ADMIN_COUNTER_DISPLAY_LIMIT).toBe(99);
    expect(getAdminCounterBadge("requests", 99, true)).toEqual({
      display: "99",
      label: "99 richieste in attesa",
    });
    expect(getAdminCounterBadge("requests", 120, true)).toEqual({
      display: "99+",
      label: "120 richieste in attesa",
    });
  });
});

describe("admin counter change events", () => {
  it("uses distinct, namespaced event names", () => {
    expect(REQUESTS_CHANGED_EVENT).toBe("gruppo-alpini:requests-changed");
    expect(APPROVALS_CHANGED_EVENT).toBe("gruppo-alpini:approvals-changed");
    expect(REQUESTS_CHANGED_EVENT).not.toBe(APPROVALS_CHANGED_EVENT);
  });

  it("dispatches the matching event for each mutation family", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    notifyRequestsChanged();
    notifyApprovalsChanged();

    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    expect((dispatchEvent.mock.calls[0][0] as Event).type).toBe(
      REQUESTS_CHANGED_EVENT,
    );
    expect((dispatchEvent.mock.calls[1][0] as Event).type).toBe(
      APPROVALS_CHANGED_EVENT,
    );
  });
});
