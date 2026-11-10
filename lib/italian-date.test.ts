import { describe, expect, it } from "vitest";
import {
  formatItalianDateInput,
  formatItalianDateTimeInput,
  maskItalianDateInput,
  maskItalianTimeInput,
  parseItalianDateParts,
  parseItalianDateTime,
  parseItalianDateTimeToLocal,
  parseItalianDateToIsoDate,
  parseItalianTimeParts,
  parseOptionalItalianDateTime,
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

describe("partial masks and pasted values", () => {
  it.each([
    ["1", "1"],
    ["12", "12"],
    ["123", "12/3"],
    ["1234", "12/34"],
    ["12345", "12/34/5"],
    ["123456", "12/34/56"],
    ["1234567", "12/34/567"],
    ["12345678", "12/34/5678"],
    ["12/3", "12/3"],
    ["12/34/5", "12/34/5"],
  ])("keeps the partial date %j in shape as %j", (input, expected) => {
    expect(maskItalianDateInput(input)).toBe(expected);
  });

  it("normalizes an ISO date even with surrounding whitespace", () => {
    expect(maskItalianDateInput(" 2026-03-14 ")).toBe("14/03/2026");
    expect(maskItalianDateInput("2026-03-14T08:07:00.000Z")).toBe(
      "14/03/2026",
    );
  });

  it("falls back to digit extraction for a non-ISO dash pattern", () => {
    expect(maskItalianDateInput("2026-3-4")).toBe("20/26/34");
  });

  it("keeps partial times and limits them to four digits", () => {
    expect(maskItalianTimeInput(" 0 9 : 3 0 ")).toBe("09:30");
    expect(maskItalianTimeInput("000000")).toBe("00:00");
    expect(maskItalianTimeInput("x")).toBe("");
  });
});

describe("parseItalianDateParts leap-year rules", () => {
  it.each([
    ["29/02/2000", true],
    ["29/02/2024", true],
    ["29/02/2400", true],
    ["29/02/1900", false],
    ["29/02/2100", false],
    ["29/02/2023", false],
  ])("parses %j as %j", (value, expected) => {
    expect(parseItalianDateParts(value) !== null).toBe(expected);
  });

  it("handles the first and last representable calendar days", () => {
    expect(parseItalianDateParts("01/01/1000")).toEqual({
      day: 1,
      month: 1,
      year: 1000,
    });
    expect(parseItalianDateParts("31/12/9999")).toEqual({
      day: 31,
      month: 12,
      year: 9999,
    });
  });

  it("rejects two-digit years and the year zero", () => {
    expect(parseItalianDateParts("01/01/0099")).toBeNull();
    expect(parseItalianDateParts("01/01/0000")).toBeNull();
  });
});

describe("parseItalianTimeParts boundaries", () => {
  it.each([
    ["00:00", { hours: 0, minutes: 0 }],
    ["23:59", { hours: 23, minutes: 59 }],
    [" 00:00 ", { hours: 0, minutes: 0 }],
  ])("accepts the boundary time %j", (value, expected) => {
    expect(parseItalianTimeParts(value)).toEqual(expected);
  });

  it.each(["24:00", "24:01", "23:60", "00:60", "99:99", "0:00", "00:0"])(
    "rejects the out-of-range time %j",
    (value) => {
      expect(parseItalianTimeParts(value)).toBeNull();
    },
  );
});

describe("parseItalianDateTimeToLocal", () => {
  it("uses local components and zeroes seconds and milliseconds", () => {
    const date = parseItalianDateTimeToLocal("14/03/2026", "08:07");

    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(14);
    expect(date?.getHours()).toBe(8);
    expect(date?.getMinutes()).toBe(7);
    expect(date?.getSeconds()).toBe(0);
    expect(date?.getMilliseconds()).toBe(0);
  });

  it("parses local midnight and a leap day", () => {
    const midnight = parseItalianDateTimeToLocal("05/01/2026", "00:00");
    const leapDay = parseItalianDateTimeToLocal("29/02/2024", "23:59");

    expect(midnight?.getHours()).toBe(0);
    expect(midnight?.getMinutes()).toBe(0);
    expect(leapDay?.getFullYear()).toBe(2024);
    expect(leapDay?.getMonth()).toBe(1);
    expect(leapDay?.getDate()).toBe(29);
  });

  it("rejects invalid dates and times", () => {
    expect(parseItalianDateTimeToLocal("31/02/2026", "08:07")).toBeNull();
    expect(parseItalianDateTimeToLocal("29/02/2023", "08:07")).toBeNull();
    expect(parseItalianDateTimeToLocal("14/03/2026", "24:00")).toBeNull();
    expect(parseItalianDateTimeToLocal("", "")).toBeNull();
  });
});

describe("parseItalianDateTime leap and midnight stability", () => {
  it("keeps an all-day leap date at UTC midnight", () => {
    const parsed = parseItalianDateTime("29/02/2024", "");

    expect(parsed).not.toBeNull();
    expect(parsed?.isAllDay).toBe(true);
    expect(parsed?.date.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("treats an explicit 00:00 as a timed event, not an all-day one", () => {
    const parsed = parseItalianDateTime("14/03/2026", "00:00");

    expect(parsed).not.toBeNull();
    expect(parsed?.isAllDay).toBe(false);
    expect(parsed?.date.getHours()).toBe(0);
    expect(parsed?.date.getMinutes()).toBe(0);
  });

  it("keeps all-day values stable regardless of the local timezone", () => {
    const parsed = parseItalianDateTime("31/12/2026", "");

    expect(parsed?.date.getTime()).toBe(
      Date.UTC(2026, 11, 31, 0, 0, 0, 0),
    );
    expect(parsed?.date.getUTCHours()).toBe(0);
  });

  it("rejects the non-leap 29 February and 24:00 boundaries", () => {
    expect(parseItalianDateTime("29/02/1900", "")).toBeNull();
    expect(parseItalianDateTime("29/02/2100", "")).toBeNull();
    expect(parseItalianDateTime("14/03/2026", "24:00")).toBeNull();
  });
});

describe("parseOptionalItalianDateTime", () => {
  it("accepts two empty fields as no limit", () => {
    expect(parseOptionalItalianDateTime("", "")).toEqual({
      date: null,
      isValid: true,
    });
    expect(parseOptionalItalianDateTime("   ", "\t")).toEqual({
      date: null,
      isValid: true,
    });
  });

  it("requires both fields when a limit is set", () => {
    expect(parseOptionalItalianDateTime("14/03/2026", "")).toEqual({
      date: null,
      isValid: false,
    });
    expect(parseOptionalItalianDateTime("", "08:07")).toEqual({
      date: null,
      isValid: false,
    });
  });

  it("parses a valid date and time window", () => {
    const result = parseOptionalItalianDateTime("14/03/2026", "08:07");

    expect(result.isValid).toBe(true);
    expect(result.date?.getFullYear()).toBe(2026);
    expect(result.date?.getMonth()).toBe(2);
    expect(result.date?.getDate()).toBe(14);
    expect(result.date?.getHours()).toBe(8);
    expect(result.date?.getMinutes()).toBe(7);
  });

  it("rejects invalid dates and times", () => {
    expect(parseOptionalItalianDateTime("31/02/2026", "08:07")).toEqual({
      date: null,
      isValid: false,
    });
    expect(parseOptionalItalianDateTime("14/03/2026", "24:00")).toEqual({
      date: null,
      isValid: false,
    });
  });
});

describe("formatItalianDateInput residual cases", () => {
  it("returns an empty string for empty values", () => {
    expect(formatItalianDateInput("")).toBe("");
    expect(formatItalianDateInput("   ")).toBe("");
  });

  it("rejects impossible ISO calendar dates", () => {
    expect(formatItalianDateInput("2026-02-31")).toBe("");
    expect(formatItalianDateInput("2026-13-01")).toBe("");
    expect(formatItalianDateInput("2026-00-10")).toBe("");
    expect(formatItalianDateInput("0000-01-01")).toBe("");
  });

  it("accepts a leap day", () => {
    expect(formatItalianDateInput("2024-02-29")).toBe("29/02/2024");
  });

  it("uses the UTC calendar date of a full timestamp", () => {
    expect(formatItalianDateInput("2026-03-14T23:30:00.000Z")).toBe(
      "14/03/2026",
    );
    expect(formatItalianDateInput("2026-03-14T01:00:00+02:00")).toBe(
      "13/03/2026",
    );
  });
});

describe("formatItalianDateTimeInput residual cases", () => {
  it("formats local midnight without dropping zeroes", () => {
    const localMidnight = new Date(2026, 0, 5, 0, 0);

    expect(formatItalianDateTimeInput(localMidnight.toISOString())).toEqual({
      date: "05/01/2026",
      time: "00:00",
    });
  });

  it("formats the last minute of the day", () => {
    const localDate = new Date(2026, 11, 31, 23, 59);

    expect(formatItalianDateTimeInput(localDate.toISOString())).toEqual({
      date: "31/12/2026",
      time: "23:59",
    });
  });

  it("returns empty fields for an empty value", () => {
    expect(formatItalianDateTimeInput("")).toEqual({ date: "", time: "" });
  });
});
