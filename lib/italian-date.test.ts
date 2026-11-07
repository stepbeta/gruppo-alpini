import { describe, expect, it } from "vitest";
import {
  formatItalianDateInput,
  formatItalianDateTimeInput,
  maskItalianDateInput,
  maskItalianTimeInput,
  parseItalianDateParts,
  parseItalianDateTime,
  parseItalianDateToIsoDate,
  parseItalianTimeParts,
} from "./italian-date";

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

  it("converts a pasted ISO date", () => {
    expect(maskItalianDateInput("2026-03-14")).toBe("14/03/2026");
    expect(maskItalianDateInput("2026-03-14T08:07:00.000Z")).toBe(
      "14/03/2026",
    );
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

describe("parseItalianDateParts", () => {
  it("parses a strict Italian date", () => {
    expect(parseItalianDateParts("14/03/2026")).toEqual({
      day: 14,
      month: 3,
      year: 2026,
    });
    expect(parseItalianDateParts(" 05/01/2026 ")).toEqual({
      day: 5,
      month: 1,
      year: 2026,
    });
  });

  it("accepts 29 February in a leap year", () => {
    expect(parseItalianDateParts("29/02/2024")).not.toBeNull();
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
  ])("rejects %j", (value) => {
    expect(parseItalianDateParts(value)).toBeNull();
  });
});

describe("parseItalianTimeParts", () => {
  it.each([
    ["00:00", { hours: 0, minutes: 0 }],
    ["08:07", { hours: 8, minutes: 7 }],
    ["23:59", { hours: 23, minutes: 59 }],
    [" 09:30 ", { hours: 9, minutes: 30 }],
  ])("parses %j", (value, expected) => {
    expect(parseItalianTimeParts(value)).toEqual(expected);
  });

  it.each(["", "9:30", "09:3", "24:00", "23:60", "09:30:00", "aa:bb"])(
    "rejects %j",
    (value) => {
      expect(parseItalianTimeParts(value)).toBeNull();
    },
  );
});

describe("parseItalianDateTime", () => {
  it("parses a date without a time as an all-day UTC value", () => {
    const parsed = parseItalianDateTime("14/03/2026", "");

    expect(parsed).not.toBeNull();
    expect(parsed?.isAllDay).toBe(true);
    expect(parsed?.date.toISOString()).toBe("2026-03-14T00:00:00.000Z");
  });

  it("treats a whitespace-only time as all-day", () => {
    const parsed = parseItalianDateTime("14/03/2026", "   ");

    expect(parsed?.isAllDay).toBe(true);
    expect(parsed?.date.toISOString()).toBe("2026-03-14T00:00:00.000Z");
  });

  it("parses a timed value in local time with zero seconds", () => {
    const parsed = parseItalianDateTime("05/01/2026", "08:07");

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

  it("rejects invalid dates and times", () => {
    expect(parseItalianDateTime("31/02/2026", "")).toBeNull();
    expect(parseItalianDateTime("14/03/2026", "24:00")).toBeNull();
  });
});

describe("formatItalianDateInput", () => {
  it("formats the stored calendar date portion", () => {
    expect(formatItalianDateInput("2026-03-14")).toBe("14/03/2026");
    expect(formatItalianDateInput("2026-03-14T00:00:00.000Z")).toBe(
      "14/03/2026",
    );
  });

  it("returns an empty string for empty or malformed values", () => {
    expect(formatItalianDateInput(null)).toBe("");
    expect(formatItalianDateInput(undefined)).toBe("");
    expect(formatItalianDateInput("not-a-date")).toBe("");
  });
});

describe("formatItalianDateTimeInput", () => {
  it("formats a timestamp as masked local date and time", () => {
    const iso = new Date(2026, 2, 14, 18, 30).toISOString();

    expect(formatItalianDateTimeInput(iso)).toEqual({
      date: "14/03/2026",
      time: "18:30",
    });
  });

  it("returns empty fields for empty or malformed values", () => {
    expect(formatItalianDateTimeInput(null)).toEqual({ date: "", time: "" });
    expect(formatItalianDateTimeInput("not-a-date")).toEqual({
      date: "",
      time: "",
    });
  });
});

describe("parseItalianDateToIsoDate", () => {
  it("converts a masked date to an ISO calendar date", () => {
    expect(parseItalianDateToIsoDate("14/03/2026")).toBe("2026-03-14");
    expect(parseItalianDateToIsoDate("05/01/2026")).toBe("2026-01-05");
  });

  it("returns null for invalid dates", () => {
    expect(parseItalianDateToIsoDate("31/02/2026")).toBeNull();
    expect(parseItalianDateToIsoDate("")).toBeNull();
  });
});
