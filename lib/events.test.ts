import { describe, expect, it, vi } from "vitest";
import {
  formatEventDate,
  formatEventDateInput,
  getEventIdFromSearch,
  getEventSharePath,
  isEventPast,
  maskItalianDateInput,
  maskItalianTimeInput,
  parseEventDateTime,
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
