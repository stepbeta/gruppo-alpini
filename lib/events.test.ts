import { afterEach, describe, expect, it, vi } from "vitest";
import { NETWORK_ERROR_MESSAGE, SESSION_ERROR_MESSAGE } from "./error-messages";
import {
  createEvent,
  deleteEvent,
  fetchEventById,
  fetchEventResponses,
  fetchEvents,
  formatAttendanceTotal,
  formatEventDate,
  formatEventDateInput,
  formatEventError,
  getContributingGuestCount,
  getEventIdFromSearch,
  getEventSharePath,
  isEventPast,
  isPositiveResponseStatus,
  maskItalianDateInput,
  maskItalianTimeInput,
  parseEventDateTime,
  saveEventResponse,
  summarizeEventAttendance,
  updateEvent,
  validateGuestCount,
  type EventAttendanceEntry,
  type EventInput,
  type EventRecord,
} from "./events";

// events.ts imports the browser Supabase client. The pure functions are tested
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

function eventAt(eventDate: string, isAllDay = false): EventRecord {
  return {
    id: "event-1",
    title: "Evento di prova",
    description: null,
    location: null,
    event_date: eventDate,
    is_all_day: isAllDay,
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("isEventPast", () => {
  it("keeps a timed event upcoming until its exact start time", () => {
    const eventDate = new Date(2026, 0, 5, 18, 0);
    const event = eventAt(eventDate.toISOString());

    expect(isEventPast(event, eventDate.getTime() - 1)).toBe(false);
    expect(isEventPast(event, eventDate.getTime())).toBe(false);
    expect(isEventPast(event, eventDate.getTime() + 1)).toBe(true);
  });

  it("keeps an all-day event upcoming for its whole local date", () => {
    const event = eventAt("2026-03-14T00:00:00.000Z", true);
    const sameDayNoon = new Date(2026, 2, 14, 12, 0).getTime();
    const nextDayStart = new Date(2026, 2, 15, 0, 0).getTime();

    expect(isEventPast(event, sameDayNoon)).toBe(false);
    expect(isEventPast(event, nextDayStart)).toBe(true);
  });

  it("treats a malformed event date as past", () => {
    const now = new Date(2026, 0, 5, 12, 0).getTime();

    expect(isEventPast(eventAt("not-a-date"), now)).toBe(true);
    expect(isEventPast(eventAt("not-a-date", true), now)).toBe(true);
  });
});

describe("parseEventDateTime", () => {
  it("parses a date without a time as an all-day UTC event", () => {
    const parsed = parseEventDateTime("14/03/2026", "");

    expect(parsed).not.toBeNull();
    expect(parsed?.isAllDay).toBe(true);
    expect(parsed?.date.toISOString()).toBe("2026-03-14T00:00:00.000Z");
  });

  it("treats a whitespace-only time as an all-day event", () => {
    const parsed = parseEventDateTime("14/03/2026", "   ");

    expect(parsed).not.toBeNull();
    expect(parsed?.isAllDay).toBe(true);
    expect(parsed?.date.toISOString()).toBe("2026-03-14T00:00:00.000Z");
  });

  it("parses a valid local date and time", () => {
    const parsed = parseEventDateTime("05/01/2026", "08:07");

    expect(parsed).not.toBeNull();
    expect(parsed?.isAllDay).toBe(false);
    expect(parsed?.date.getFullYear()).toBe(2026);
    expect(parsed?.date.getMonth()).toBe(0);
    expect(parsed?.date.getDate()).toBe(5);
    expect(parsed?.date.getHours()).toBe(8);
    expect(parsed?.date.getMinutes()).toBe(7);
    expect(parsed?.date.getSeconds()).toBe(0);
    expect(parsed?.date.getMilliseconds()).toBe(0);
  });

  it("trims surrounding whitespace from both fields", () => {
    const parsed = parseEventDateTime(" 05/01/2026 ", " 08:07 ");

    expect(parsed?.date.getTime()).toBe(
      new Date(2026, 0, 5, 8, 7).getTime(),
    );
  });

  it("accepts 29 February in a leap year", () => {
    const parsed = parseEventDateTime("29/02/2024", "");

    expect(parsed).not.toBeNull();
    expect(parsed?.date.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it.each([
    "",
    "2026-03-14",
    "5/1/2026",
    "14/03/26",
    "14/03/2026extra",
    "14/13/2026",
    "00/03/2026",
    "31/02/2026",
    "29/02/2025",
    "31/04/2026",
  ])("rejects the invalid date %j", (dateValue) => {
    expect(parseEventDateTime(dateValue, "")).toBeNull();
  });

  it.each(["24:00", "23:60", "9:30", "09:3", "09:30:00", "aa:bb"])(
    "rejects the invalid time %j",
    (timeValue) => {
      expect(parseEventDateTime("14/03/2026", timeValue)).toBeNull();
    },
  );

  it.each(["00:00", "23:59"])("accepts the boundary time %j", (timeValue) => {
    const parsed = parseEventDateTime("14/03/2026", timeValue);

    expect(parsed).not.toBeNull();
    expect(parsed?.isAllDay).toBe(false);
  });
});

describe("formatEventDate", () => {
  it("formats all-day events from their UTC date", () => {
    expect(formatEventDate("2026-03-05T00:00:00.000Z", true)).toBe(
      "05/03/2026",
    );
  });

  it("formats timed events in local time with zero padding", () => {
    const date = new Date(2026, 0, 5, 8, 7);

    expect(formatEventDate(date.toISOString())).toBe("05/01/2026 08:07");
  });

  it("returns a readable message for invalid dates", () => {
    expect(formatEventDate("not-a-date")).toBe("Data non valida");
  });
});

describe("formatEventDateInput", () => {
  it("prefills an all-day event without a time", () => {
    expect(formatEventDateInput("2026-03-05T00:00:00.000Z", true)).toEqual({
      date: "05/03/2026",
      time: "",
    });
  });

  it("prefills a timed event in local time", () => {
    const date = new Date(2026, 0, 5, 8, 7);

    expect(formatEventDateInput(date.toISOString())).toEqual({
      date: "05/01/2026",
      time: "08:07",
    });
  });

  it("returns empty fields for invalid dates", () => {
    expect(formatEventDateInput("not-a-date")).toEqual({
      date: "",
      time: "",
    });
  });
});

describe("maskItalianDateInput", () => {
  it.each([
    ["", ""],
    ["1", "1"],
    ["14", "14"],
    ["140", "14/0"],
    ["1403", "14/03"],
    ["14032", "14/03/2"],
    ["14032026", "14/03/2026"],
    ["14/03/2026", "14/03/2026"],
    ["14-03-2026", "14/03/2026"],
    ["140320269999", "14/03/2026"],
  ])("masks %j as %j", (input, expected) => {
    expect(maskItalianDateInput(input)).toBe(expected);
  });

  it("drops non-digit characters", () => {
    expect(maskItalianDateInput("1a4b0c3d2e0f2g6")).toBe("14/03/2026");
  });
});

describe("maskItalianTimeInput", () => {
  it.each([
    ["", ""],
    ["9", "9"],
    ["09", "09"],
    ["093", "09:3"],
    ["0930", "09:30"],
    ["09:30", "09:30"],
    ["093045", "09:30"],
  ])("masks %j as %j", (input, expected) => {
    expect(maskItalianTimeInput(input)).toBe(expected);
  });

  it("drops non-digit characters", () => {
    expect(maskItalianTimeInput("0a9b3c0")).toBe("09:30");
  });
});

describe("event deep links", () => {
  it("builds a shareable path for an event id", () => {
    expect(getEventSharePath("abc")).toBe("/eventi?event=abc");
  });

  it("encodes special characters in the event id", () => {
    expect(getEventSharePath("a b&c")).toBe("/eventi?event=a%20b%26c");
  });

  it("reads and trims a valid event id from the query string", () => {
    expect(getEventIdFromSearch("?event=abc")).toBe("abc");
    expect(getEventIdFromSearch("?foo=1&event=a%20b")).toBe("a b");
    expect(getEventIdFromSearch("?event=%20abc%20")).toBe("abc");
  });

  it("returns null when the query string has no usable event id", () => {
    expect(getEventIdFromSearch("")).toBeNull();
    expect(getEventIdFromSearch("?other=1")).toBeNull();
    expect(getEventIdFromSearch("?event=")).toBeNull();
    expect(getEventIdFromSearch("?event=%20%20")).toBeNull();
  });
});

describe("validateGuestCount", () => {
  it.each([0, 1, 12, 1_000_000, Number.MAX_SAFE_INTEGER])(
    "accepts the non-negative integer %j",
    (value) => {
      expect(validateGuestCount(value)).toEqual({
        guestCount: value,
        error: null,
      });
    },
  );

  it.each(["0", "7", " 42 "])(
    "accepts the numeric string %j",
    (value) => {
      expect(validateGuestCount(value)).toEqual({
        guestCount: Number(value.trim()),
        error: null,
      });
    },
  );

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "",
    " ",
    "-1",
    "1.5",
    "1,5",
    "abc",
    "12a",
    "1e3",
    null,
    undefined,
    {},
    [],
  ])("rejects the invalid value %j", (value) => {
    const result = validateGuestCount(value);

    expect(result.guestCount).toBeNull();
    expect(result.error).toMatch(/numero intero/i);
  });
});

describe("guest status consistency", () => {
  it("treats present and tentative as positive statuses", () => {
    expect(isPositiveResponseStatus("present")).toBe(true);
    expect(isPositiveResponseStatus("tentative")).toBe(true);
    expect(isPositiveResponseStatus("absent")).toBe(false);
  });

  it("counts guests only for positive statuses", () => {
    expect(getContributingGuestCount("present", 4)).toBe(4);
    expect(getContributingGuestCount("tentative", 3)).toBe(3);
    expect(getContributingGuestCount("absent", 5)).toBe(0);
    expect(getContributingGuestCount("present", 0)).toBe(0);
  });

  it("ignores invalid guest values defensively", () => {
    expect(getContributingGuestCount("present", -2)).toBe(0);
    expect(getContributingGuestCount("present", 1.5)).toBe(0);
    expect(getContributingGuestCount("tentative", Number.NaN)).toBe(0);
    expect(getContributingGuestCount("tentative", Number.POSITIVE_INFINITY)).toBe(
      0,
    );
  });
});

function attendanceEntry(
  status: EventAttendanceEntry["status"],
  guestCount: number,
  userId: string | null = "member-1",
): EventAttendanceEntry {
  return { user_id: userId, status, guest_count: guestCount };
}

describe("summarizeEventAttendance", () => {
  it("returns all zeroes for an event without responses", () => {
    expect(summarizeEventAttendance([])).toEqual({
      presentMembers: 0,
      tentativeMembers: 0,
      absentMembers: 0,
      presentGuests: 0,
      tentativeGuests: 0,
      positiveMembers: 0,
      totalGuests: 0,
      totalAttendees: 0,
    });
  });

  it("counts members and guests separately for present and tentative", () => {
    const summary = summarizeEventAttendance([
      attendanceEntry("present", 2, "member-a"),
      attendanceEntry("present", 1, "member-b"),
      attendanceEntry("tentative", 3, "member-c"),
    ]);

    expect(summary).toEqual({
      presentMembers: 2,
      tentativeMembers: 1,
      absentMembers: 0,
      presentGuests: 3,
      tentativeGuests: 3,
      positiveMembers: 3,
      totalGuests: 6,
      totalAttendees: 9,
    });
  });

  it("keeps absent members in their own count but drops their guests", () => {
    const summary = summarizeEventAttendance([
      attendanceEntry("present", 2),
      attendanceEntry("absent", 9),
    ]);

    expect(summary.absentMembers).toBe(1);
    expect(summary.presentGuests).toBe(2);
    expect(summary.tentativeGuests).toBe(0);
    expect(summary.totalGuests).toBe(2);
    expect(summary.totalAttendees).toBe(3);
  });

  it("includes responses of deleted members with user_id = NULL", () => {
    const summary = summarizeEventAttendance([
      attendanceEntry("present", 2, null),
      attendanceEntry("tentative", 1, null),
      attendanceEntry("absent", 4, null),
    ]);

    expect(summary.presentMembers).toBe(1);
    expect(summary.tentativeMembers).toBe(1);
    expect(summary.absentMembers).toBe(1);
    expect(summary.presentGuests).toBe(2);
    expect(summary.tentativeGuests).toBe(1);
    expect(summary.totalGuests).toBe(3);
    expect(summary.totalAttendees).toBe(5);
  });

  it("formats the administrator total in the documented shape", () => {
    const summary = summarizeEventAttendance([
      ...Array.from({ length: 4 }, (_, index) =>
        attendanceEntry("present", 2, `present-${index}`),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        attendanceEntry("tentative", 1, `tentative-${index}`),
      ),
    ]);

    expect(formatAttendanceTotal(summary)).toBe(
      "Totale: 20 (8 soci + 12 invitati)",
    );
  });
});

describe("formatEventError", () => {
  it("maps network and expired-session failures", () => {
    expect(formatEventError("Failed to fetch")).toBe(NETWORK_ERROR_MESSAGE);
    expect(formatEventError("JWT expired")).toBe(SESSION_ERROR_MESSAGE);
  });

  it("maps permission failures to the migration hint", () => {
    const message = formatEventError(
      'permission denied for table "events" (SQLSTATE 42501)',
    );

    expect(message).toContain("Non hai i permessi");
    expect(message).toContain("migrazioni Supabase");
  });

  it("maps a missing table or column to the event context", () => {
    expect(
      formatEventError('relation "public.events" does not exist'),
    ).toBe("Le tabelle degli eventi non sono ancora disponibili. Verifica le migrazioni Supabase.");

    expect(formatEventError('column "is_all_day" does not exist')).toBe(
      "Le tabelle degli eventi non sono ancora disponibili. Verifica le migrazioni Supabase.",
    );
  });

  it("maps duplicate responses and constraint failures", () => {
    expect(formatEventError("duplicate key value violates unique constraint")).toBe(
      "Esiste già una risposta per questo evento.",
    );
    expect(
      formatEventError(
        'new row violates check constraint "event_responses_guest_count_check"',
      ),
    ).toBe("Controlla i dati dell’evento: uno o più valori non sono validi.");
  });

  it("maps invalid dates and times to the event-specific hint", () => {
    expect(
      formatEventError(
        'invalid input syntax for type timestamp with time zone: "not-a-date"',
      ),
    ).toBe(
      "Uno dei valori inseriti non è valido. Controlla la data, l’ora e gli altri campi, poi riprova.",
    );
  });

  it("keeps friendly validation messages and hides unknown technical details", () => {
    expect(formatEventError("Inserisci il titolo dell’evento.")).toBe(
      "Inserisci il titolo dell’evento.",
    );
    expect(formatEventError("SQLSTATE XX000 internal error")).toBe(
      "Non è stato possibile completare l’operazione sugli eventi. Riprova tra poco; se il problema continua, contatta un amministratore.",
    );
  });
});

describe("formatEventDate edge cases", () => {
  it("uses the UTC date for all-day events even near UTC midnight", () => {
    expect(formatEventDate("2026-03-14T23:30:00.000Z", true)).toBe(
      "14/03/2026",
    );
    expect(formatEventDate("2026-03-14", true)).toBe("14/03/2026");
  });

  it("zero-pads local midnight and single-digit components", () => {
    const midnight = new Date(2026, 0, 5, 0, 0);

    expect(formatEventDate(midnight.toISOString())).toBe(
      "05/01/2026 00:00",
    );
  });

  it("reports invalid all-day values too", () => {
    expect(formatEventDate("not-a-date", true)).toBe("Data non valida");
  });

  it("returns empty fields for an invalid all-day value", () => {
    expect(formatEventDateInput("not-a-date", true)).toEqual({
      date: "",
      time: "",
    });
  });
});

describe("event data access without a configured client", () => {
  it("returns a normalized empty page for a missing client", async () => {
    await expect(
      fetchEvents({
        scope: "upcoming",
        page: 0,
        pageSize: 1_000,
        search: "pranzo",
      }),
    ).resolves.toEqual({
      events: [],
      page: 1,
      pageSize: 100,
      total: 0,
      pageCount: 0,
      error: "Supabase non configurato.",
    });
  });

  it("keeps an explicit valid page and page size", async () => {
    await expect(
      fetchEvents({ scope: "past", page: 3, pageSize: 8 }),
    ).resolves.toEqual({
      events: [],
      page: 3,
      pageSize: 8,
      total: 0,
      pageCount: 0,
      error: "Supabase non configurato.",
    });
  });

  it("returns configuration errors for single-event reads and writes", async () => {
    await expect(fetchEventById("event-1")).resolves.toEqual({
      event: null,
      error: "Supabase non configurato.",
    });

    await expect(
      createEvent({
        title: "Pranzo",
        description: null,
        location: null,
        event_date: "2026-05-10T17:00:00.000Z",
        is_all_day: false,
      }),
    ).resolves.toEqual({ event: null, error: "Supabase non configurato." });

    const values: EventInput = {
      title: "Pranzo",
      description: null,
      location: null,
      event_date: "2026-05-10T17:00:00.000Z",
      is_all_day: false,
    };

    await expect(updateEvent("event-1", values)).resolves.toEqual({
      event: null,
      error: "Supabase non configurato.",
    });
    await expect(deleteEvent("event-1")).resolves.toEqual({
      error: "Supabase non configurato.",
    });
  });

  it("skips the responses query when there are no ids", async () => {
    await expect(fetchEventResponses([])).resolves.toEqual({
      responses: [],
      error: null,
    });
    await expect(fetchEventResponses([""])).resolves.toEqual({
      responses: [],
      error: null,
    });
    await expect(fetchEventResponses(["event-1"])).resolves.toEqual({
      responses: [],
      error: "Supabase non configurato.",
    });
  });

  it("validates the guest count before contacting the client", async () => {
    await expect(
      saveEventResponse("event-1", "member-1", "present", -1),
    ).resolves.toEqual({
      response: null,
      error:
        "Il numero di invitati deve essere un numero intero pari o superiore a 0.",
    });

    await expect(
      saveEventResponse("event-1", "member-1", "present", 2),
    ).resolves.toEqual({
      response: null,
      error: "Supabase non configurato.",
    });
  });
});

const EVENT_COLUMNS =
  "id, title, description, location, event_date, is_all_day, created_by, created_at";

describe("event query composition", () => {
  it("builds the upcoming filter, search, ordering, and inclusive range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14, 12, 0, 0));

    const now = new Date();
    const startOfTodayUtc = Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const allDayCutoff = new Date(startOfTodayUtc).toISOString();
    const { calls, client } = createFakeSupabase([
      { data: [], error: null, count: 42 },
    ]);
    supabaseState.client = client;

    const page = await fetchEvents({
      scope: "upcoming",
      page: 2,
      pageSize: 8,
      search: "  Pranzo  ",
    });

    expect(calls).toEqual([
      { method: "from", args: ["events"] },
      {
        method: "select",
        args: [EVENT_COLUMNS, { count: "exact" }],
      },
      {
        method: "or",
        args: [
          `and(is_all_day.eq.true,event_date.gte.${allDayCutoff}),and(is_all_day.eq.false,event_date.gte.${now.toISOString()})`,
        ],
      },
      {
        method: "or",
        args: [
          "title.ilike.%Pranzo%,location.ilike.%Pranzo%,description.ilike.%Pranzo%",
        ],
      },
      { method: "order", args: ["event_date", { ascending: true }] },
      { method: "order", args: ["id", { ascending: true }] },
      { method: "range", args: [8, 15] },
    ]);
    expect(page.total).toBe(42);
    expect(page.pageCount).toBe(6);
  });

  it("builds the past filter without a search expression", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14, 12, 0, 0));

    const now = new Date();
    const allDayCutoff = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    ).toISOString();
    const { calls, client } = createFakeSupabase([
      { data: [], error: null, count: null },
    ]);
    supabaseState.client = client;

    const page = await fetchEvents({ scope: "past", page: 1, pageSize: 10 });

    expect(calls).toEqual([
      { method: "from", args: ["events"] },
      {
        method: "select",
        args: [EVENT_COLUMNS, { count: "exact" }],
      },
      {
        method: "or",
        args: [
          `and(is_all_day.eq.true,event_date.lt.${allDayCutoff}),and(is_all_day.eq.false,event_date.lt.${now.toISOString()})`,
        ],
      },
      { method: "order", args: ["event_date", { ascending: false }] },
      { method: "order", args: ["id", { ascending: false }] },
      { method: "range", args: [0, 9] },
    ]);
    expect(page.total).toBe(0);
    expect(page.pageCount).toBe(0);
  });

  it("returns the error without inventing rows or counts", async () => {
    const { client } = createFakeSupabase([
      { data: null, error: { message: "boom" }, count: null },
    ]);
    supabaseState.client = client;

    await expect(
      fetchEvents({ scope: "upcoming", page: 1, pageSize: 10 }),
    ).resolves.toEqual({
      events: [],
      page: 1,
      pageSize: 10,
      total: 0,
      pageCount: 0,
      error: "boom",
    });
  });

  it("reads a single event by id with maybeSingle", async () => {
    const event = eventAt("2026-05-10T17:00:00.000Z");
    const { calls, client } = createFakeSupabase([
      { data: event, error: null, count: null },
    ]);
    supabaseState.client = client;

    await expect(fetchEventById("event-1")).resolves.toEqual({
      event,
      error: null,
    });
    expect(calls).toEqual([
      { method: "from", args: ["events"] },
      { method: "select", args: [EVENT_COLUMNS] },
      { method: "eq", args: ["id", "event-1"] },
      { method: "maybeSingle", args: [] },
    ]);
  });

  it("deduplicates and drops empty event ids before the in filter", async () => {
    const { calls, client } = createFakeSupabase([
      { data: [], error: null, count: null },
    ]);
    supabaseState.client = client;

    await fetchEventResponses(["event-b", "event-a", "event-b", ""]);

    expect(calls).toEqual([
      { method: "from", args: ["event_responses"] },
      {
        method: "select",
        args: ["id, event_id, user_id, status, guest_count, updated_at"],
      },
      { method: "in", args: ["event_id", ["event-b", "event-a"]] },
    ]);
  });

  it("sends the validated guest count and conflict key on upsert", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 17, 0, 0));

    const response = {
      id: "response-1",
      event_id: "event-1",
      user_id: "member-1",
      status: "present" as const,
      guest_count: 2,
      updated_at: new Date().toISOString(),
    };
    const { calls, client } = createFakeSupabase([
      { data: response, error: null, count: null },
    ]);
    supabaseState.client = client;

    await saveEventResponse("event-1", "member-1", "present", 2);

    expect(calls[0]).toEqual({ method: "from", args: ["event_responses"] });
    expect(calls[1]).toEqual({
      method: "upsert",
      args: [
        {
          event_id: "event-1",
          user_id: "member-1",
          status: "present",
          guest_count: 2,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id,user_id" },
      ],
    });
    expect(calls.map((call) => call.method)).toEqual([
      "from",
      "upsert",
      "select",
      "single",
    ]);
  });

  it("builds create, update, and delete mutations without writing created_by", async () => {
    const values: EventInput = {
      title: "Pranzo",
      description: null,
      location: "Sede",
      event_date: "2026-05-10T17:00:00.000Z",
      is_all_day: false,
    };
    const event = eventAt(values.event_date);

    const createDouble = createFakeSupabase([
      { data: event, error: null, count: null },
    ]);
    supabaseState.client = createDouble.client;
    await createEvent(values);
    expect(createDouble.calls).toEqual([
      { method: "from", args: ["events"] },
      { method: "insert", args: [values] },
      { method: "select", args: [EVENT_COLUMNS] },
      { method: "single", args: [] },
    ]);
    expect(
      (createDouble.calls[1].args[0] as Record<string, unknown>).created_by,
    ).toBeUndefined();

    const updateDouble = createFakeSupabase([
      { data: event, error: null, count: null },
    ]);
    supabaseState.client = updateDouble.client;
    await updateEvent("event-1", values);
    expect(updateDouble.calls).toEqual([
      { method: "from", args: ["events"] },
      { method: "update", args: [values] },
      { method: "eq", args: ["id", "event-1"] },
      { method: "select", args: [EVENT_COLUMNS] },
      { method: "single", args: [] },
    ]);

    const deleteDouble = createFakeSupabase([
      { data: null, error: null, count: null },
    ]);
    supabaseState.client = deleteDouble.client;
    await deleteEvent("event-1");
    expect(deleteDouble.calls).toEqual([
      { method: "from", args: ["events"] },
      { method: "delete", args: [] },
      { method: "eq", args: ["id", "event-1"] },
    ]);
  });
});
