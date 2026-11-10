import { describe, expect, it, vi } from "vitest";
import {
  formatAttendanceTotal,
  formatEventDate,
  formatEventDateInput,
  getContributingGuestCount,
  getEventIdFromSearch,
  getEventSharePath,
  isEventPast,
  isPositiveResponseStatus,
  maskItalianDateInput,
  maskItalianTimeInput,
  parseEventDateTime,
  summarizeEventAttendance,
  validateGuestCount,
  type EventAttendanceEntry,
  type EventRecord,
} from "./events";

// events.ts imports the browser Supabase client. The functions under test are
// pure, so replace it to keep the unit tests hermetic and free of env vars.
vi.mock("./supabase", () => ({ supabase: null }));

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
