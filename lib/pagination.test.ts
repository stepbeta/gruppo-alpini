import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  buildIlikeOr,
  getPageCount,
  getPageRange,
  normalizePage,
  normalizePageSize,
  sanitizeSearchTerm,
} from "./pagination";

describe("normalizePage", () => {
  it("defaults missing or unusable values to the first page", () => {
    expect(normalizePage()).toBe(1);
    expect(normalizePage(undefined)).toBe(1);
    expect(normalizePage(0)).toBe(1);
    expect(normalizePage(-0)).toBe(1);
    expect(normalizePage(Number.NaN)).toBe(1);
    expect(normalizePage(Number.POSITIVE_INFINITY)).toBe(1);
    expect(normalizePage(Number.NEGATIVE_INFINITY)).toBe(1);
  });

  it("keeps positive page numbers and floors decimals", () => {
    expect(normalizePage(1)).toBe(1);
    expect(normalizePage(2)).toBe(2);
    expect(normalizePage(1.9)).toBe(1);
    expect(normalizePage(7.5)).toBe(7);
    expect(normalizePage(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("clamps negative page numbers to one", () => {
    expect(normalizePage(-1)).toBe(1);
    expect(normalizePage(-99)).toBe(1);
    expect(normalizePage(-0.5)).toBe(1);
  });
});

describe("normalizePageSize", () => {
  it("uses the default page size when no value is supplied", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(10);
    expect(normalizePageSize()).toBe(10);
    expect(normalizePageSize(undefined)).toBe(10);
  });

  it("falls back for zero and non-finite values", () => {
    expect(normalizePageSize(0)).toBe(10);
    expect(normalizePageSize(-0)).toBe(10);
    expect(normalizePageSize(Number.NaN)).toBe(10);
    expect(normalizePageSize(Number.POSITIVE_INFINITY)).toBe(10);
    expect(normalizePageSize(Number.NEGATIVE_INFINITY)).toBe(10);
  });

  it("accepts an explicit fallback for callers with a different default", () => {
    expect(normalizePageSize(undefined, 25)).toBe(25);
    expect(normalizePageSize(0, 25)).toBe(25);
    expect(normalizePageSize(Number.NaN, 25)).toBe(25);
    expect(normalizePageSize(4, 25)).toBe(4);
  });

  it("clamps the page size to the 1..100 browser range", () => {
    expect(normalizePageSize(1)).toBe(1);
    expect(normalizePageSize(99)).toBe(99);
    expect(normalizePageSize(100)).toBe(100);
    expect(normalizePageSize(101)).toBe(100);
    expect(normalizePageSize(10_000)).toBe(100);
    expect(normalizePageSize(-1)).toBe(1);
    expect(normalizePageSize(-100)).toBe(1);
  });

  it("floors fractional page sizes", () => {
    expect(normalizePageSize(1.9)).toBe(1);
    expect(normalizePageSize(10.5)).toBe(10);
    expect(normalizePageSize(99.9)).toBe(99);
  });
});

describe("getPageRange", () => {
  it("returns the inclusive PostgREST range for the first page", () => {
    expect(getPageRange(1, 10)).toEqual({ from: 0, to: 9 });
  });

  it("offsets the range by page size", () => {
    expect(getPageRange(2, 10)).toEqual({ from: 10, to: 19 });
    expect(getPageRange(3, 25)).toEqual({ from: 50, to: 74 });
    expect(getPageRange(4, 8)).toEqual({ from: 24, to: 31 });
  });

  it("produces a single-row range for a page size of one", () => {
    expect(getPageRange(1, 1)).toEqual({ from: 0, to: 0 });
    expect(getPageRange(5, 1)).toEqual({ from: 4, to: 4 });
  });

  it("keeps consecutive pages contiguous without overlap", () => {
    const first = getPageRange(1, 10);
    const second = getPageRange(2, 10);

    expect(second.from).toBe(first.to + 1);
  });
});

describe("getPageCount", () => {
  it("returns zero when there are no rows", () => {
    expect(getPageCount(0, 10)).toBe(0);
    expect(getPageCount(-1, 10)).toBe(0);
  });

  it("rounds up the number of pages", () => {
    expect(getPageCount(1, 10)).toBe(1);
    expect(getPageCount(9, 10)).toBe(1);
    expect(getPageCount(10, 10)).toBe(1);
    expect(getPageCount(11, 10)).toBe(2);
    expect(getPageCount(20, 10)).toBe(2);
    expect(getPageCount(21, 10)).toBe(3);
  });

  it("supports the page sizes used by the directory and event lists", () => {
    expect(getPageCount(16, 8)).toBe(2);
    expect(getPageCount(17, 8)).toBe(3);
    expect(getPageCount(100, 25)).toBe(4);
    expect(getPageCount(101, 100)).toBe(2);
  });
});

describe("sanitizeSearchTerm", () => {
  it("returns an empty string for missing or blank terms", () => {
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm("")).toBe("");
    expect(sanitizeSearchTerm("   ")).toBe("");
    expect(sanitizeSearchTerm("\t\n\r")).toBe("");
  });

  it("removes every character that breaks the PostgREST filter grammar", () => {
    expect(sanitizeSearchTerm("100%")).toBe("100");
    expect(sanitizeSearchTerm("a_b")).toBe("a b");
    expect(sanitizeSearchTerm("a\\b")).toBe("a b");
    expect(sanitizeSearchTerm("a,b")).toBe("a b");
    expect(sanitizeSearchTerm("a*b")).toBe("a b");
    expect(sanitizeSearchTerm("a(b)c")).toBe("a b c");
    expect(sanitizeSearchTerm('a"b')).toBe("a b");
    expect(sanitizeSearchTerm("%_\\,*()\"")).toBe("");
  });

  it("collapses the gaps left by removed characters", () => {
    expect(sanitizeSearchTerm("100%_off")).toBe("100 off");
    expect(sanitizeSearchTerm("  Rossi   Mario  ")).toBe("Rossi Mario");
    expect(sanitizeSearchTerm("Rossi,\tMario\nBelluno")).toBe(
      "Rossi Mario Belluno",
    );
  });

  it("preserves case and harmless punctuation", () => {
    expect(sanitizeSearchTerm("De Rossi")).toBe("De Rossi");
    expect(sanitizeSearchTerm("d’Azeglio")).toBe("d’Azeglio");
    expect(sanitizeSearchTerm("Belluno-2026")).toBe("Belluno-2026");
    expect(sanitizeSearchTerm("Città")).toBe("Città");
    expect(sanitizeSearchTerm("ROSSI")).toBe("ROSSI");
  });
});

describe("buildIlikeOr", () => {
  it("returns null when the sanitized term is empty", () => {
    expect(buildIlikeOr(["title"], undefined)).toBeNull();
    expect(buildIlikeOr(["title"], "")).toBeNull();
    expect(buildIlikeOr(["title"], "   ")).toBeNull();
    expect(buildIlikeOr(["title"], "%_*()\"")).toBeNull();
  });

  it("builds one case-insensitive contains expression per column", () => {
    expect(buildIlikeOr(["title"], "pranzo")).toBe(
      "title.ilike.%pranzo%",
    );
    expect(buildIlikeOr(["title", "location", "description"], "pranzo")).toBe(
      "title.ilike.%pranzo%,location.ilike.%pranzo%,description.ilike.%pranzo%",
    );
  });

  it("uses the sanitized term with its internal spaces intact", () => {
    expect(buildIlikeOr(["full_name", "service_place"], "  De Rossi ")).toBe(
      "full_name.ilike.%De Rossi%,service_place.ilike.%De Rossi%",
    );
  });

  it("strips grammar characters before embedding the term", () => {
    expect(buildIlikeOr(["message"], "50%_off")).toBe(
      "message.ilike.%50 off%",
    );
    expect(buildIlikeOr(["message"], "(urgente)")).toBe(
      "message.ilike.%urgente%",
    );
  });

  it("returns an empty expression for an empty column list", () => {
    expect(buildIlikeOr([], "pranzo")).toBe("");
  });
});
