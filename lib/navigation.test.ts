import { describe, expect, it } from "vitest";
import {
  HEADER_NAV_BREAKPOINT_PX,
  getHeaderNavigation,
  isHeaderNavItemActive,
} from "./navigation";

// Drawer focus handling, Escape/backdrop closing, and the avatar menu are
// browser behaviors and remain part of the manual check list; this suite only
// covers the pure navigation model.

describe("header navigation breakpoint", () => {
  it("switches to the flat navigation at 900px", () => {
    expect(HEADER_NAV_BREAKPOINT_PX).toBe(900);
  });
});

describe("getHeaderNavigation", () => {
  it("keeps only the flat member items for regular members", () => {
    const navigation = getHeaderNavigation(false);

    expect(navigation.memberItems.map((item) => item.href)).toEqual([
      "/eventi",
      "/iscritti",
      "/richieste",
    ]);
    expect(navigation.memberItems.map((item) => item.label)).toEqual([
      "Eventi",
      "Iscritti",
      "Richieste",
    ]);
    expect(navigation.adminItems).toEqual([]);
  });

  it("adds Avvisi and Manuale to the admin group for administrators", () => {
    const navigation = getHeaderNavigation(true);

    expect(navigation.adminItems.map((item) => item.href)).toEqual([
      "/avvisi",
      "/admin/manuale",
    ]);
    expect(navigation.adminItems.map((item) => item.label)).toEqual([
      "Avvisi",
      "Manuale",
    ]);
  });

  it("includes Profilo in the drawer member group but not the flat nav", () => {
    const navigation = getHeaderNavigation(true);

    expect(navigation.drawerMemberItems.map((item) => item.href)).toEqual([
      "/eventi",
      "/iscritti",
      "/richieste",
      "/profile",
    ]);
    expect(navigation.memberItems.map((item) => item.href)).not.toContain(
      "/profile",
    );
  });

  it("keeps badge slots on the future counter items", () => {
    const navigation = getHeaderNavigation(false);
    const badgeKeys = Object.fromEntries(
      navigation.memberItems
        .filter((item) => item.badgeKey)
        .map((item) => [item.id, item.badgeKey]),
    );

    expect(badgeKeys).toEqual({
      iscritti: "pending-approvals",
      richieste: "pending-requests",
    });
  });
});

describe("isHeaderNavItemActive", () => {
  it("matches the exact route", () => {
    expect(isHeaderNavItemActive("/eventi", "/eventi")).toBe(true);
    expect(isHeaderNavItemActive("/richieste", "/richieste")).toBe(true);
  });

  it("keeps a parent item active on nested routes", () => {
    expect(isHeaderNavItemActive("/admin/manuale", "/admin/manuale")).toBe(
      true,
    );
    expect(isHeaderNavItemActive("/eventi/123", "/eventi")).toBe(true);
  });

  it("does not treat a shared prefix as a match", () => {
    expect(isHeaderNavItemActive("/iscritti-archivio", "/iscritti")).toBe(
      false,
    );
    expect(isHeaderNavItemActive("/eventuale", "/eventi")).toBe(false);
  });

  it("normalizes trailing slashes and ignores query strings or hashes", () => {
    expect(isHeaderNavItemActive("/iscritti/", "/iscritti")).toBe(true);
    expect(isHeaderNavItemActive("/profile", "/profile#sicurezza")).toBe(true);
    expect(isHeaderNavItemActive("/profile/", "/profile#esporta-dati")).toBe(
      true,
    );
  });

  it("treats the root route exactly", () => {
    expect(isHeaderNavItemActive("/", "/")).toBe(true);
    expect(isHeaderNavItemActive("/eventi", "/")).toBe(false);
  });
});
