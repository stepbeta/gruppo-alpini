import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_LIMIT,
  ADMIN_LIMIT_MESSAGE,
  MEMBER_FILTERS,
  SELF_DEMOTION_MESSAGE,
  composeMembersQuery,
  deleteAccount,
  demoteFromAdmin,
  fetchMemberCount,
  fetchMembers,
  fetchMembersByIds,
  fetchProfile,
  formatAdminRoleError,
  formatProfileError,
  getMembersFilterCriteria,
  getVisibleMemberFilters,
  promoteToAdmin,
  saveProfile,
  updateMemberApproval,
  updateMemberProfile,
  validateEnlistmentYear,
} from "./profile";

// profile.ts imports the browser Supabase client. The pure functions are tested
// with no client; the query-shape tests below swap in a chainable test double.
const supabaseState = vi.hoisted(() => ({
  client: null as unknown,
}));

vi.mock("./supabase", () => ({
  get supabase() {
    return supabaseState.client;
  },
}));

type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

type QueryCall = { method: string; args: unknown[] };

function createFakeSupabase(results: QueryResult[]) {
  const calls: QueryCall[] = [];
  let resultIndex = 0;

  function createBuilder(): Record<string, unknown> {
    const result = results[resultIndex] ?? {
      data: null,
      error: null,
      count: null,
    };
    resultIndex += 1;

    const builder: Record<string, unknown> = {};

    for (const method of [
      "select",
      "or",
      "order",
      "range",
      "eq",
      "ilike",
      "in",
      "upsert",
      "insert",
      "update",
      "delete",
      "maybeSingle",
      "single",
    ]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }

    builder.then = (
      onFulfilled?: ((value: QueryResult) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);

    return builder;
  }

  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return createBuilder();
    },
  };

  return { calls, client };
}

afterEach(() => {
  supabaseState.client = null;
  vi.useRealTimers();
});

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

  it("recognizes the escalation trigger by name and by message", () => {
    expect(
      formatAdminRoleError("profiles_prevent_admin_escalation"),
    ).toBe("Solo un amministratore può modificare il ruolo di amministratore.");
    expect(
      formatAdminRoleError("only administrators can change the admin flag"),
    ).toBe("Solo un amministratore può modificare il ruolo di amministratore.");
  });

  it("maps a missing migration to the administrator-role context", () => {
    expect(
      formatAdminRoleError('relation "public.profiles" does not exist'),
    ).toContain("gestione degli amministratori non è ancora disponibile");
  });
});

describe("formatProfileError", () => {
  it.each([
    "only administrators can change the approval status",
    "profiles_protect_approval_status",
  ])("maps the approval-status guard %j", (message) => {
    expect(formatProfileError(message)).toBe(
      "Solo un amministratore può approvare o rifiutare un account.",
    );
  });

  it("maps permission failures to the profile context", () => {
    const message = formatProfileError(
      'permission denied for table "profiles" (SQLSTATE 42501)',
    );

    expect(message).toContain("Non hai i permessi");
    expect(message).toContain("migrazioni Supabase");
  });

  it("maps a missing table or column to the profile migration hint", () => {
    expect(formatProfileError('relation "public.profiles" does not exist')).toBe(
      "La struttura del profilo non è aggiornata. Applica le migrazioni Supabase con npm run db:push.",
    );
    expect(formatProfileError('column "enlistment_year" does not exist')).toBe(
      "La struttura del profilo non è aggiornata. Applica le migrazioni Supabase con npm run db:push.",
    );
  });

  it("maps duplicate profiles and constraint failures", () => {
    expect(
      formatProfileError("duplicate key value violates unique constraint"),
    ).toBe("Esiste già una scheda collegata a questo account.");
    expect(
      formatProfileError(
        'new row violates check constraint "profiles_enlistment_year_check"',
      ),
    ).toBe(
      "I dati della scheda non rispettano i vincoli previsti. Controlla i campi e riprova.",
    );
  });

  it("maps invalid birth dates and enlistment years", () => {
    expect(
      formatProfileError('invalid input syntax for type date: "31/02/2026"'),
    ).toBe(
      "Uno dei valori inseriti non è valido. Controlla la data di nascita e l’anno di leva, poi riprova.",
    );
  });

  it("translates session failures and keeps friendly messages", () => {
    expect(formatProfileError("JWT expired")).toBe(
      "La sessione è scaduta. Accedi di nuovo e riprova.",
    );
    expect(formatProfileError("Inserisci il tuo nome completo.")).toBe(
      "Inserisci il tuo nome completo.",
    );
  });

  it("hides unknown technical details behind the profile fallback", () => {
    expect(formatProfileError("SQLSTATE XX000 internal error")).toBe(
      "Non è stato possibile completare l’operazione sulla scheda. Riprova tra poco; se il problema continua, contatta un amministratore.",
    );
  });
});

describe("validateEnlistmentYear", () => {
  it("treats an empty or whitespace-only field as not provided", () => {
    expect(validateEnlistmentYear("", 2026)).toEqual({
      enlistmentYear: null,
      error: null,
    });
    expect(validateEnlistmentYear("   ", 2026)).toEqual({
      enlistmentYear: null,
      error: null,
    });
    expect(validateEnlistmentYear("\t\n", 2026)).toEqual({
      enlistmentYear: null,
      error: null,
    });
  });

  it("accepts the inclusive 1900..current-year boundaries", () => {
    expect(validateEnlistmentYear("1900", 2026)).toEqual({
      enlistmentYear: 1900,
      error: null,
    });
    expect(validateEnlistmentYear("2026", 2026)).toEqual({
      enlistmentYear: 2026,
      error: null,
    });
    expect(validateEnlistmentYear("1985", 2026)).toEqual({
      enlistmentYear: 1985,
      error: null,
    });
  });

  it("trims surrounding whitespace and parses numeric text", () => {
    expect(validateEnlistmentYear(" 1985 ", 2026)).toEqual({
      enlistmentYear: 1985,
      error: null,
    });
  });

  it.each(["1899", "0", "-1", "2027", "3000"])(
    "rejects the out-of-range year %j",
    (value) => {
      const result = validateEnlistmentYear(value, 2026);

      expect(result.enlistmentYear).toBeNull();
      expect(result.error).toBe(
        "Inserisci un anno di leva a quattro cifre compreso tra 1900 e 2026. Esempio: 1985.",
      );
    },
  );

  it.each(["1985.5", "abc", "19 85", "1e309", "Infinity", "NaN"])(
    "rejects the non-integer year %j",
    (value) => {
      const result = validateEnlistmentYear(value, 2026);

      expect(result.enlistmentYear).toBeNull();
      expect(result.error).toContain("compreso tra 1900 e 2026");
    },
  );

  it("uses the injected current year as the upper bound", () => {
    expect(validateEnlistmentYear("2000", 2000)).toEqual({
      enlistmentYear: 2000,
      error: null,
    });
    expect(validateEnlistmentYear("2001", 2000).error).toContain(
      "compreso tra 1900 e 2000",
    );
  });

  it("defaults the upper bound to the current year", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date(2030, 5, 15, 12, 0, 0));

      expect(validateEnlistmentYear("2030")).toEqual({
        enlistmentYear: 2030,
        error: null,
      });
      expect(validateEnlistmentYear("2031").error).toBe(
        "Inserisci un anno di leva a quattro cifre compreso tra 1900 e 2030. Esempio: 1985.",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("profile data access without a configured client", () => {
  it("returns configuration errors for profile reads and writes", async () => {
    await expect(fetchProfile("member-1")).resolves.toEqual({
      profile: null,
      error: "Supabase non configurato.",
    });

    await expect(
      saveProfile("member-1", {
        full_name: "Mario Rossi",
        birth_date: "1985-03-14",
        enlistment_year: 1985,
        service_place: null,
      }),
    ).resolves.toEqual({
      profile: null,
      error: "Supabase non configurato.",
    });
  });

  it("returns a normalized empty member page", async () => {
    await expect(fetchMembers()).resolves.toEqual({
      members: [],
      page: 1,
      pageSize: 10,
      total: 0,
      pageCount: 0,
      error: "Supabase non configurato.",
    });

    await expect(
      fetchMembers({ page: 0, pageSize: 1_000, filter: "pending" }),
    ).resolves.toEqual({
      members: [],
      page: 1,
      pageSize: 100,
      total: 0,
      pageCount: 0,
      error: "Supabase non configurato.",
    });
  });

  it("returns zero counts and a configuration error", async () => {
    await expect(fetchMemberCount()).resolves.toEqual({
      count: 0,
      error: "Supabase non configurato.",
    });
    await expect(fetchMemberCount("pending")).resolves.toEqual({
      count: 0,
      error: "Supabase non configurato.",
    });
  });

  it("skips the ids query when no usable ids are supplied", async () => {
    await expect(fetchMembersByIds([])).resolves.toEqual({
      members: [],
      error: null,
    });
    await expect(fetchMembersByIds([""])).resolves.toEqual({
      members: [],
      error: null,
    });
    await expect(fetchMembersByIds(["member-1"])).resolves.toEqual({
      members: [],
      error: "Supabase non configurato.",
    });
  });

  it("returns configuration errors for administrative mutations", async () => {
    const values = {
      full_name: "Mario Rossi",
      birth_date: "1985-03-14",
      enlistment_year: 1985,
      service_place: null,
    };

    await expect(
      updateMemberProfile("member-1", values),
    ).resolves.toEqual({
      member: null,
      error: "Supabase non configurato.",
    });
    await expect(
      updateMemberApproval("member-1", "approved"),
    ).resolves.toEqual({
      member: null,
      error: "Supabase non configurato.",
    });
    await expect(promoteToAdmin("member-1")).resolves.toEqual({
      member: null,
      error: "Supabase non configurato.",
    });
    await expect(demoteFromAdmin("member-1")).resolves.toEqual({
      member: null,
      error: "Supabase non configurato.",
    });
  });

  it("returns a configuration error for account deletion", async () => {
    await expect(deleteAccount("member-1")).resolves.toEqual({
      error: "Supabase non configurato.",
    });
  });
});

const PROFILE_COLUMNS =
  "id, full_name, birth_date, enlistment_year, service_place, is_admin, approval_status, updated_at";
const MEMBER_COLUMNS =
  "id, full_name, birth_date, enlistment_year, service_place, is_admin, approval_status";

describe("profile query composition", () => {
  it("combines the pending chip, search, ordering, and inclusive range", async () => {
    const { calls, client } = createFakeSupabase([
      { data: [], error: null, count: 17 },
    ]);
    supabaseState.client = client;

    const page = await fetchMembers({
      page: 2,
      pageSize: 8,
      filter: "pending",
      search: "  Rossi  ",
    });

    expect(calls).toEqual([
      { method: "from", args: ["profiles"] },
      {
        method: "select",
        args: [MEMBER_COLUMNS, { count: "exact" }],
      },
      {
        method: "eq",
        args: ["approval_status", "pending"],
      },
      {
        method: "or",
        args: [
          "full_name.ilike.%Rossi%,service_place.ilike.%Rossi%",
        ],
      },
      {
        method: "order",
        args: ["full_name", { ascending: true, nullsFirst: false }],
      },
      { method: "order", args: ["id", { ascending: true }] },
      { method: "range", args: [8, 15] },
    ]);
    expect(page.total).toBe(17);
    expect(page.pageCount).toBe(3);
  });

  it("maps the administrator and regular-user chips to is_admin", async () => {
    const admins = createFakeSupabase([{ data: [], error: null, count: 2 }]);
    supabaseState.client = admins.client;
    await fetchMembers({ filter: "admins", page: 1, pageSize: 10 });

    expect(admins.calls).toContainEqual({
      method: "eq",
      args: ["is_admin", true],
    });
    expect(admins.calls.some((call) => call.method === "or")).toBe(false);
    expect(admins.calls).toContainEqual({
      method: "range",
      args: [0, 9],
    });

    const users = createFakeSupabase([{ data: [], error: null, count: 4 }]);
    supabaseState.client = users.client;
    await fetchMembers({ filter: "users", page: 1, pageSize: 10 });

    expect(users.calls).toContainEqual({
      method: "eq",
      args: ["is_admin", false],
    });
    expect(users.calls.some((call) => call.method === "or")).toBe(false);
  });

  it("omits the chip and search filters for the full directory", async () => {
    const { calls, client } = createFakeSupabase([
      { data: [], error: null, count: 0 },
    ]);
    supabaseState.client = client;

    await fetchMembers({ filter: "all", search: "   " });

    expect(calls.some((call) => call.method === "eq")).toBe(false);
    expect(calls.some((call) => call.method === "or")).toBe(false);
    expect(calls).toContainEqual({ method: "range", args: [0, 9] });
  });

  it("counts members with a head request and an optional status filter", async () => {
    const { calls, client } = createFakeSupabase([
      { data: null, error: null, count: 7 },
    ]);
    supabaseState.client = client;

    await expect(fetchMemberCount("pending")).resolves.toEqual({
      count: 7,
      error: null,
    });
    expect(calls).toEqual([
      { method: "from", args: ["profiles"] },
      {
        method: "select",
        args: ["id", { count: "exact", head: true }],
      },
      { method: "eq", args: ["approval_status", "pending"] },
    ]);
  });

  it("batches large id lists into 100-row in filters", async () => {
    const ids = Array.from({ length: 101 }, (_, index) => `member-${index}`);
    const { calls, client } = createFakeSupabase([
      { data: [{ id: "member-0" }], error: null, count: null },
      { data: [{ id: "member-100" }], error: null, count: null },
    ]);
    supabaseState.client = client;

    const result = await fetchMembersByIds(ids);

    expect(result.error).toBeNull();
    expect(result.members).toHaveLength(2);
    expect(calls).toEqual([
      { method: "from", args: ["profiles"] },
      { method: "select", args: [MEMBER_COLUMNS] },
      { method: "in", args: ["id", ids.slice(0, 100)] },
      { method: "from", args: ["profiles"] },
      { method: "select", args: [MEMBER_COLUMNS] },
      { method: "in", args: ["id", ids.slice(100)] },
    ]);
  });

  it("reports a failure from any id batch", async () => {
    const { client } = createFakeSupabase([
      { data: [], error: { message: "batch failed" }, count: null },
    ]);
    supabaseState.client = client;

    await expect(fetchMembersByIds(["member-1"])).resolves.toEqual({
      members: [],
      error: "batch failed",
    });
  });

  it("loads one profile with maybeSingle", async () => {
    const { calls, client } = createFakeSupabase([
      { data: null, error: null, count: null },
    ]);
    supabaseState.client = client;

    await fetchProfile("member-1");

    expect(calls).toEqual([
      { method: "from", args: ["profiles"] },
      { method: "select", args: [PROFILE_COLUMNS] },
      { method: "eq", args: ["id", "member-1"] },
      { method: "maybeSingle", args: [] },
    ]);
  });

  it("upserts the signed-in profile with the database-owned timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 10, 9, 30, 0));

    const { calls, client } = createFakeSupabase([
      { data: { id: "member-1" }, error: null, count: null },
    ]);
    supabaseState.client = client;

    await saveProfile("member-1", {
      full_name: "Mario Rossi",
      birth_date: "1985-03-14",
      enlistment_year: 1985,
      service_place: null,
    });

    expect(calls[0]).toEqual({ method: "from", args: ["profiles"] });
    expect(calls[1]).toEqual({
      method: "upsert",
      args: [
        {
          id: "member-1",
          full_name: "Mario Rossi",
          birth_date: "1985-03-14",
          enlistment_year: 1985,
          service_place: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      ],
    });
    expect(calls.map((call) => call.method)).toEqual([
      "from",
      "upsert",
      "select",
      "single",
    ]);
  });

  it("updates another member without writing is_admin or approval_status", async () => {
    const { calls, client } = createFakeSupabase([
      { data: { id: "member-2" }, error: null, count: null },
    ]);
    supabaseState.client = client;

    await updateMemberProfile("member-2", {
      full_name: "Luigi Bianchi",
      birth_date: null,
      enlistment_year: null,
      service_place: "Belluno",
    });

    expect(calls[1].method).toBe("update");
    const payload = calls[1].args[0] as Record<string, unknown>;

    expect(payload).toMatchObject({
      full_name: "Luigi Bianchi",
      birth_date: null,
      enlistment_year: null,
      service_place: "Belluno",
    });
    expect(payload.updated_at).toEqual(expect.any(String));
    expect(payload.is_admin).toBeUndefined();
    expect(payload.approval_status).toBeUndefined();
  });

  it("sends only the approval status on the dedicated mutation path", async () => {
    const { calls, client } = createFakeSupabase([
      { data: { id: "member-2" }, error: null, count: null },
    ]);
    supabaseState.client = client;

    await updateMemberApproval("member-2", "rejected");

    expect(calls[1]).toEqual({
      method: "update",
      args: [
        {
          approval_status: "rejected",
          updated_at: expect.any(String),
        },
      ],
    });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["id", "member-2"],
    });
  });

  it("promotes and demotes through the dedicated is_admin mutation", async () => {
    const promote = createFakeSupabase([
      { data: { id: "member-2" }, error: null, count: null },
    ]);
    supabaseState.client = promote.client;
    await promoteToAdmin("member-2");

    expect(
      (promote.calls[1].args[0] as Record<string, unknown>).is_admin,
    ).toBe(true);

    const demote = createFakeSupabase([
      { data: { id: "member-2" }, error: null, count: null },
    ]);
    supabaseState.client = demote.client;
    await demoteFromAdmin("member-2");

    expect(
      (demote.calls[1].args[0] as Record<string, unknown>).is_admin,
    ).toBe(false);
  });
});
