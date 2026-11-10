import { afterEach, describe, expect, it, vi } from "vitest";
import { NETWORK_ERROR_MESSAGE, SESSION_ERROR_MESSAGE } from "./error-messages";
import {
  REQUEST_STATUS_LABELS,
  createGenericRequest,
  fetchGenericRequests,
  fetchRequestCounts,
  formatRequestDate,
  formatRequestError,
  updateGenericRequestStatus,
} from "./requests";

// requests.ts imports the browser Supabase client. The pure functions are
// tested with no client; the query-shape tests below swap in a chainable test
// double.
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
});

describe("REQUEST_STATUS_LABELS", () => {
  it("labels both request states in Italian", () => {
    expect(REQUEST_STATUS_LABELS).toEqual({
      open: "In attesa",
      resolved: "Risolta",
    });
  });
});

describe("formatRequestDate", () => {
  it("formats a timestamp in local time with zero padding", () => {
    const date = new Date(2026, 0, 5, 8, 7);

    expect(formatRequestDate(date.toISOString())).toBe("05/01/2026 08:07");
  });

  it("formats midnight without dropping the time", () => {
    const date = new Date(2026, 11, 31, 0, 0);

    expect(formatRequestDate(date.toISOString())).toBe("31/12/2026 00:00");
  });

  it("returns a readable message for invalid timestamps", () => {
    expect(formatRequestDate("not-a-date")).toBe("Data non valida");
    expect(formatRequestDate("")).toBe("Data non valida");
  });
});

describe("formatRequestError", () => {
  it("maps network and expired-session failures", () => {
    expect(formatRequestError("Failed to fetch")).toBe(NETWORK_ERROR_MESSAGE);
    expect(formatRequestError("Invalid JWT")).toBe(SESSION_ERROR_MESSAGE);
  });

  it("maps permission failures to the request context", () => {
    const message = formatRequestError(
      'permission denied for table "generic_requests" (SQLSTATE 42501)',
    );

    expect(message).toContain("Non hai i permessi");
    expect(message).toContain("migrazioni Supabase");
  });

  it("maps a missing table to the request context", () => {
    expect(
      formatRequestError('relation "public.generic_requests" does not exist'),
    ).toBe(
      "La tabella delle richieste non è ancora disponibile. Verifica le migrazioni Supabase.",
    );
  });

  it("maps duplicate submissions to the request context", () => {
    expect(
      formatRequestError("duplicate key value violates unique constraint"),
    ).toBe(
      "La richiesta risulta già inviata. Ricarica la pagina per controllare lo stato.",
    );
  });

  it("maps status constraint failures to the request context", () => {
    expect(
      formatRequestError(
        'new row violates check constraint "generic_requests_status_check"',
      ),
    ).toBe("Lo stato della richiesta non è valido. Ricarica la pagina e riprova.");
  });

  it("maps invalid input to the message hint", () => {
    expect(formatRequestError("invalid input syntax for type uuid")).toBe(
      "Uno dei valori inseriti non è valido. Controlla il messaggio e riprova.",
    );
  });

  it("keeps friendly validation messages", () => {
    expect(formatRequestError("Scrivi il testo della richiesta.")).toBe(
      "Scrivi il testo della richiesta.",
    );
  });

  it("hides unknown technical details behind the fallback", () => {
    expect(formatRequestError("SQLSTATE XX000 internal error")).toBe(
      "Non è stato possibile completare l’operazione sulle richieste. Riprova tra poco; se il problema continua, contatta la segreteria.",
    );
  });
});

describe("request data access without a configured client", () => {
  it("returns a normalized empty page", async () => {
    await expect(
      fetchGenericRequests({
        scope: "all",
        page: 0,
        pageSize: 1_000,
        search: "certificato",
      }),
    ).resolves.toEqual({
      requests: [],
      page: 1,
      pageSize: 100,
      total: 0,
      pageCount: 0,
      error: "Supabase non configurato.",
    });
  });

  it("keeps an explicit valid page and page size", async () => {
    await expect(
      fetchGenericRequests({
        scope: "mine",
        userId: "member-1",
        status: "open",
        page: 2,
        pageSize: 8,
      }),
    ).resolves.toEqual({
      requests: [],
      page: 2,
      pageSize: 8,
      total: 0,
      pageCount: 0,
      error: "Supabase non configurato.",
    });
  });

  it("returns zero counts and a configuration error", async () => {
    await expect(fetchRequestCounts()).resolves.toEqual({
      total: 0,
      open: 0,
      resolved: 0,
      error: "Supabase non configurato.",
    });
  });

  it("returns configuration errors for submissions and status updates", async () => {
    await expect(
      createGenericRequest("member-1", "Richiesta di certificato"),
    ).resolves.toEqual({
      request: null,
      error: "Supabase non configurato.",
    });

    await expect(
      updateGenericRequestStatus("request-1", "resolved"),
    ).resolves.toEqual({
      request: null,
      error: "Supabase non configurato.",
    });
  });
});

const REQUEST_COLUMNS = "id, user_id, message, status, created_at";

describe("request query composition", () => {
  it("builds the personal scope, status, search, ordering, and range", async () => {
    const { calls, client } = createFakeSupabase([
      { data: [], error: null, count: 12 },
    ]);
    supabaseState.client = client;

    const page = await fetchGenericRequests({
      scope: "mine",
      userId: "member-1",
      status: "open",
      search: "  certificato  ",
      page: 2,
      pageSize: 8,
    });

    expect(calls).toEqual([
      { method: "from", args: ["generic_requests"] },
      {
        method: "select",
        args: [REQUEST_COLUMNS, { count: "exact" }],
      },
      { method: "eq", args: ["user_id", "member-1"] },
      { method: "eq", args: ["status", "open"] },
      { method: "ilike", args: ["message", "%certificato%"] },
      { method: "order", args: ["created_at", { ascending: false }] },
      { method: "order", args: ["id", { ascending: false }] },
      { method: "range", args: [8, 15] },
    ]);
    expect(page.total).toBe(12);
    expect(page.pageCount).toBe(2);
  });

  it("omits the personal, status, and search filters for the full board", async () => {
    const { calls, client } = createFakeSupabase([
      { data: [], error: null, count: null },
    ]);
    supabaseState.client = client;

    const page = await fetchGenericRequests({ scope: "all" });

    expect(calls.some((call) => call.method === "eq")).toBe(false);
    expect(calls.some((call) => call.method === "ilike")).toBe(false);
    expect(calls).toContainEqual({
      method: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(calls).toContainEqual({
      method: "range",
      args: [0, 9],
    });
    expect(page.total).toBe(0);
    expect(page.pageCount).toBe(0);
  });

  it("sanitizes the search term before the ilike filter", async () => {
    const { calls, client } = createFakeSupabase([
      { data: [], error: null, count: 0 },
    ]);
    supabaseState.client = client;

    await fetchGenericRequests({ scope: "all", search: "100%_off" });

    expect(calls).toContainEqual({
      method: "ilike",
      args: ["message", "%100 off%"],
    });
  });

  it("requires a user id for the personal scope when a client exists", async () => {
    const { calls, client } = createFakeSupabase([]);
    supabaseState.client = client;

    await expect(fetchGenericRequests({ scope: "mine" })).resolves.toEqual({
      requests: [],
      page: 1,
      pageSize: 10,
      total: 0,
      pageCount: 0,
      error: "Sessione non disponibile. Accedi di nuovo.",
    });
    expect(calls).toEqual([]);
  });

  it("returns the query error without inventing rows or counts", async () => {
    const { client } = createFakeSupabase([
      { data: null, error: { message: "boom" }, count: null },
    ]);
    supabaseState.client = client;

    await expect(
      fetchGenericRequests({ scope: "all", page: 1, pageSize: 10 }),
    ).resolves.toEqual({
      requests: [],
      page: 1,
      pageSize: 10,
      total: 0,
      pageCount: 0,
      error: "boom",
    });
  });

  it("counts open and resolved rows with head requests and the same search", async () => {
    const { calls, client } = createFakeSupabase([
      { data: null, error: null, count: 3 },
      { data: null, error: null, count: 2 },
    ]);
    supabaseState.client = client;

    await expect(fetchRequestCounts(" Rossi ")).resolves.toEqual({
      total: 5,
      open: 3,
      resolved: 2,
      error: null,
    });
    expect(calls).toEqual([
      { method: "from", args: ["generic_requests"] },
      {
        method: "select",
        args: ["id", { count: "exact", head: true }],
      },
      { method: "eq", args: ["status", "open"] },
      { method: "ilike", args: ["message", "%Rossi%"] },
      { method: "from", args: ["generic_requests"] },
      {
        method: "select",
        args: ["id", { count: "exact", head: true }],
      },
      { method: "eq", args: ["status", "resolved"] },
      { method: "ilike", args: ["message", "%Rossi%"] },
    ]);
  });

  it("returns zero counts when either count query fails", async () => {
    const { client } = createFakeSupabase([
      { data: null, error: { message: "count failed" }, count: null },
    ]);
    supabaseState.client = client;

    await expect(fetchRequestCounts()).resolves.toEqual({
      total: 0,
      open: 0,
      resolved: 0,
      error: "count failed",
    });
  });

  it("trims the message before inserting a request", async () => {
    const { calls, client } = createFakeSupabase([
      {
        data: { id: "request-1" },
        error: null,
        count: null,
      },
    ]);
    supabaseState.client = client;

    await createGenericRequest("member-1", "  Richiesta di certificato  ");

    expect(calls).toEqual([
      { method: "from", args: ["generic_requests"] },
      {
        method: "insert",
        args: [
          {
            user_id: "member-1",
            message: "Richiesta di certificato",
          },
        ],
      },
      { method: "select", args: [REQUEST_COLUMNS] },
      { method: "single", args: [] },
    ]);
  });

  it("rejects a blank message before any query", async () => {
    const { calls, client } = createFakeSupabase([]);
    supabaseState.client = client;

    await expect(
      createGenericRequest("member-1", "   "),
    ).resolves.toEqual({
      request: null,
      error: "Scrivi il testo della richiesta.",
    });
    expect(calls).toEqual([]);
  });

  it("updates only the request status", async () => {
    const { calls, client } = createFakeSupabase([
      { data: { id: "request-1" }, error: null, count: null },
    ]);
    supabaseState.client = client;

    await updateGenericRequestStatus("request-1", "resolved");

    expect(calls).toEqual([
      { method: "from", args: ["generic_requests"] },
      { method: "update", args: [{ status: "resolved" }] },
      { method: "eq", args: ["id", "request-1"] },
      { method: "select", args: [REQUEST_COLUMNS] },
      { method: "single", args: [] },
    ]);
  });
});
