import { describe, expect, it, vi } from "vitest";
import {
  formatAnnouncementDate,
  formatAnnouncementWindow,
  getAnnouncementState,
  getAnnouncementWindowState,
  isAnnouncementVisible,
  matchesAnnouncementFilter,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
  type Announcement,
} from "./announcements";

// announcements.ts imports the browser Supabase client. The functions under
// test are pure, so replace it to keep the unit tests hermetic and free of env
// vars.
vi.mock("./supabase", () => ({ supabase: null }));

const NOW = Date.parse("2026-11-05T12:00:00.000Z");

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: "announcement-1",
    message: "Avviso di prova",
    start_date: null,
    end_date: null,
    is_active: true,
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isAnnouncementVisible", () => {
  it("requires the activation flag", () => {
    expect(isAnnouncementVisible(announcement({ is_active: false }), NOW)).toBe(
      false,
    );
  });

  it("shows an active banner without a window", () => {
    expect(isAnnouncementVisible(announcement(), NOW)).toBe(true);
  });

  it("uses an inclusive start and end window", () => {
    const banner = announcement({
      start_date: "2026-11-05T10:00:00.000Z",
      end_date: "2026-11-05T14:00:00.000Z",
    });

    expect(isAnnouncementVisible(banner, Date.parse(banner.start_date!))).toBe(
      true,
    );
    expect(isAnnouncementVisible(banner, Date.parse(banner.end_date!))).toBe(
      true,
    );
    expect(isAnnouncementVisible(banner, NOW)).toBe(true);
  });

  it("hides banners outside their window", () => {
    const future = announcement({
      start_date: "2026-11-06T10:00:00.000Z",
    });
    const expired = announcement({
      end_date: "2026-11-04T14:00:00.000Z",
    });

    expect(isAnnouncementVisible(future, NOW)).toBe(false);
    expect(isAnnouncementVisible(expired, NOW)).toBe(false);
  });

  it("ignores malformed dates instead of hiding the banner", () => {
    const banner = announcement({
      start_date: "not-a-date",
      end_date: "also-not-a-date",
    });

    expect(isAnnouncementVisible(banner, NOW)).toBe(true);
  });
});

describe("getAnnouncementWindowState", () => {
  it("classifies the window independently from the activation flag", () => {
    const scheduled = announcement({
      is_active: false,
      start_date: "2026-11-06T10:00:00.000Z",
    });
    const open = announcement({
      is_active: false,
      end_date: "2026-11-06T10:00:00.000Z",
    });
    const expired = announcement({
      is_active: true,
      end_date: "2026-11-04T10:00:00.000Z",
    });

    expect(getAnnouncementWindowState(scheduled, NOW)).toBe("scheduled");
    expect(getAnnouncementWindowState(open, NOW)).toBe("open");
    expect(getAnnouncementWindowState(expired, NOW)).toBe("expired");
  });

  it("treats malformed dates as an open window", () => {
    expect(
      getAnnouncementWindowState(
        announcement({ start_date: "bad", end_date: "bad" }),
        NOW,
      ),
    ).toBe("open");
  });
});

describe("getAnnouncementState", () => {
  it("keeps the manual deactivation as the primary state", () => {
    expect(
      getAnnouncementState(
        announcement({
          is_active: false,
          end_date: "2026-11-04T10:00:00.000Z",
        }),
        NOW,
      ),
    ).toBe("inactive");
  });

  it("distinguishes active, scheduled and expired banners", () => {
    expect(getAnnouncementState(announcement(), NOW)).toBe("active");
    expect(
      getAnnouncementState(
        announcement({ start_date: "2026-11-06T10:00:00.000Z" }),
        NOW,
      ),
    ).toBe("scheduled");
    expect(
      getAnnouncementState(
        announcement({ end_date: "2026-11-04T10:00:00.000Z" }),
        NOW,
      ),
    ).toBe("expired");
  });
});

describe("matchesAnnouncementFilter", () => {
  it("returns every banner for the all filter", () => {
    const banners = [
      announcement(),
      announcement({ is_active: false }),
      announcement({ start_date: "2026-11-06T10:00:00.000Z" }),
      announcement({ end_date: "2026-11-04T10:00:00.000Z" }),
    ];

    for (const banner of banners) {
      expect(matchesAnnouncementFilter(banner, "all", NOW)).toBe(true);
    }
  });

  it("filters visible banners for the active chip", () => {
    expect(matchesAnnouncementFilter(announcement(), "active", NOW)).toBe(true);
    expect(
      matchesAnnouncementFilter(
        announcement({ is_active: false }),
        "active",
        NOW,
      ),
    ).toBe(false);
    expect(
      matchesAnnouncementFilter(
        announcement({ start_date: "2026-11-06T10:00:00.000Z" }),
        "active",
        NOW,
      ),
    ).toBe(false);
  });

  it("groups banners with a concluded window under past", () => {
    expect(
      matchesAnnouncementFilter(
        announcement({ end_date: "2026-11-04T10:00:00.000Z" }),
        "past",
        NOW,
      ),
    ).toBe(true);

    // A recurring notice may still be toggled on after its window ends: it is
    // historical, not currently visible.
    expect(
      matchesAnnouncementFilter(
        announcement({
          is_active: true,
          end_date: "2026-11-04T10:00:00.000Z",
        }),
        "past",
        NOW,
      ),
    ).toBe(true);

    expect(
      matchesAnnouncementFilter(
        announcement({ is_active: false }),
        "past",
        NOW,
      ),
    ).toBe(false);
    expect(
      matchesAnnouncementFilter(
        announcement({ start_date: "2026-11-06T10:00:00.000Z" }),
        "past",
        NOW,
      ),
    ).toBe(false);
  });
});

describe("formatAnnouncementDate", () => {
  it("formats timestamps in Italian local time with a four-digit year", () => {
    expect(formatAnnouncementDate("2026-11-05T12:00:00.000Z")).toBe(
      "05/11/2026, 13:00",
    );
  });

  it("returns a fallback for empty and malformed values", () => {
    expect(formatAnnouncementDate(null)).toBe("Sempre");
    expect(formatAnnouncementDate("not-a-date")).toBe("Data non valida");
  });
});

describe("formatAnnouncementWindow", () => {
  it("summarizes every window combination", () => {
    expect(formatAnnouncementWindow(announcement())).toBe(
      "Senza limiti di tempo",
    );
    expect(
      formatAnnouncementWindow(
        announcement({
          start_date: "2026-11-05T10:00:00.000Z",
          end_date: "2026-11-06T10:00:00.000Z",
        }),
      ),
    ).toBe("Dal 05/11/2026, 11:00 al 06/11/2026, 11:00");
    expect(
      formatAnnouncementWindow(
        announcement({ start_date: "2026-11-05T10:00:00.000Z" }),
      ),
    ).toBe("Dal 05/11/2026, 11:00");
    expect(
      formatAnnouncementWindow(
        announcement({ end_date: "2026-11-06T10:00:00.000Z" }),
      ),
    ).toBe("Fino al 06/11/2026, 11:00");
  });
});

describe("datetime-local conversion", () => {
  it("round-trips a valid local value", () => {
    const parsed = parseDateTimeLocalValue("2026-11-05T18:30");

    expect(parsed.isValid).toBe(true);
    expect(parsed.iso).not.toBeNull();
    expect(toDateTimeLocalValue(parsed.iso)).toBe("2026-11-05T18:30");
  });

  it("treats an empty value as no limit", () => {
    expect(parseDateTimeLocalValue("   ")).toEqual({ iso: null, isValid: true });
    expect(toDateTimeLocalValue(null)).toBe("");
  });

  it("rejects malformed values and timestamps", () => {
    expect(parseDateTimeLocalValue("not-a-date")).toEqual({
      iso: null,
      isValid: false,
    });
    expect(toDateTimeLocalValue("not-a-date")).toBe("");
  });
});
