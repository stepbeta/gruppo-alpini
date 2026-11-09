import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_LIMIT,
  ADMIN_LIMIT_MESSAGE,
  MEMBER_FILTERS,
  SELF_DEMOTION_MESSAGE,
  composeMembersQuery,
  formatAdminRoleError,
  getMembersFilterCriteria,
  getVisibleMemberFilters,
} from "./profile";

// profile.ts imports the browser Supabase client. The functions under test are
// pure, so replace it to keep the unit tests hermetic and free of env vars.
vi.mock("./supabase", () => ({ supabase: null }));

// This suite covers the pure chip mapping, query composition, role-based chip
// visibility, and error mapping only. The four-administrator cap, the
// self-demotion guard, and the profiles RLS policy live in PostgreSQL; they
// cannot be exercised by Vitest and must be verified manually against a linked
// project or by a future database-level test suite.

describe("MEMBER_FILTERS", () => {
  it("exposes the four directory chips in display order", () => {
    expect(MEMBER_FILTERS).toEqual([
      { value: "all", label: "Tutti" },
      { value: "admins", label: "Amministratori" },
      { value: "users", label: "Utenti" },
      { value: "pending", label: "In attesa" },
    ]);
  });
});

describe("getVisibleMemberFilters", () => {
  it("shows the pending chip to administrators", () => {
    expect(getVisibleMemberFilters(true)).toEqual(MEMBER_FILTERS);
  });

  it("omits the pending chip for regular members", () => {
    expect(getVisibleMemberFilters(false)).toEqual([
      { value: "all", label: "Tutti" },
      { value: "admins", label: "Amministratori" },
      { value: "users", label: "Utenti" },
    ]);
  });
});

describe("getMembersFilterCriteria", () => {
  it("applies no filter for Tutti", () => {
    expect(getMembersFilterCriteria("all")).toEqual({});
    expect(getMembersFilterCriteria()).toEqual({});
  });

  it("maps administrators to is_admin = true", () => {
    expect(getMembersFilterCriteria("admins")).toEqual({ isAdmin: true });
  });

  it("maps regular users to is_admin = false", () => {
    expect(getMembersFilterCriteria("users")).toEqual({ isAdmin: false });
  });

  it("maps the pending chip to approval_status = pending", () => {
    expect(getMembersFilterCriteria("pending")).toEqual({
      approvalStatus: "pending",
    });
  });
});

describe("composeMembersQuery", () => {
  it("defaults to the full directory with no search", () => {
    expect(composeMembersQuery()).toEqual({ search: "" });
  });

  it("combines a chip with a trimmed text search", () => {
    expect(
      composeMembersQuery({ filter: "admins", search: "  Belluno  " }),
    ).toEqual({ isAdmin: true, search: "Belluno" });
  });

  it("keeps the pending filter while searching by name or service place", () => {
    expect(
      composeMembersQuery({ filter: "pending", search: "Rossi" }),
    ).toEqual({ approvalStatus: "pending", search: "Rossi" });
  });

  it("keeps the regular-user filter while searching", () => {
    expect(
      composeMembersQuery({ filter: "users", search: "Caserma" }),
    ).toEqual({ isAdmin: false, search: "Caserma" });
  });

  it("does not add a role filter for Tutti", () => {
    expect(composeMembersQuery({ filter: "all", search: "Rossi" })).toEqual({
      search: "Rossi",
    });
  });
});

describe("formatAdminRoleError", () => {
  it("returns the database cap message verbatim", () => {
    expect(ADMIN_LIMIT).toBe(4);
    expect(
      formatAdminRoleError("Limite di 4 amministratori raggiunto."),
    ).toBe(ADMIN_LIMIT_MESSAGE);
  });

  it("returns the self-demotion message verbatim", () => {
    expect(
      formatAdminRoleError(
        "Non puoi revocare il tuo stesso ruolo di amministratore.",
      ),
    ).toBe(SELF_DEMOTION_MESSAGE);
  });

  it("explains that only administrators can change the role", () => {
    expect(
      formatAdminRoleError("Only administrators can change the admin flag"),
    ).toBe("Solo un amministratore può modificare il ruolo di amministratore.");
  });

  it("maps permission failures to the administrator-role context", () => {
    expect(
      formatAdminRoleError(
        'permission denied for table profiles (SQLSTATE 42501)',
      ),
    ).toContain("Non hai i permessi per gestire i ruoli");
  });

  it("hides unknown technical details behind the fallback", () => {
    expect(formatAdminRoleError("SQLSTATE XX000 internal error")).toContain(
      "Non è stato possibile aggiornare il ruolo di amministratore",
    );
  });
});
