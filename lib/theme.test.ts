import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_MODE,
  THEME_MODES,
  THEME_STORAGE_KEY,
  isThemeMode,
  nextThemeMode,
  resolveThemeMode,
} from "./theme";

// Browser side effects (localStorage writes, matchMedia subscriptions, and
// class toggling) are covered by manual checks; this suite stays pure.

describe("theme constants", () => {
  it("uses the namespaced storage key and system default", () => {
    expect(THEME_STORAGE_KEY).toBe("gruppo-alpini:theme:v1");
    expect(DEFAULT_THEME_MODE).toBe("system");
    expect(THEME_MODES).toEqual(["system", "light", "dark"]);
  });
});

describe("isThemeMode", () => {
  it("accepts only the three supported modes", () => {
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("auto")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode("")).toBe(false);
  });
});

describe("nextThemeMode", () => {
  it("cycles system → light → dark → system", () => {
    expect(nextThemeMode("system")).toBe("light");
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("system");
  });
});

describe("resolveThemeMode", () => {
  it("resolves system from the OS preference", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
  });

  it("keeps explicit light and dark modes regardless of the OS", () => {
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("light", false)).toBe("light");
    expect(resolveThemeMode("dark", true)).toBe("dark");
    expect(resolveThemeMode("dark", false)).toBe("dark");
  });
});
