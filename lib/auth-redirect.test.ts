import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLoginHref,
  clearPostAuthRedirect,
  consumePostAuthRedirect,
  getCurrentRedirectPath,
  getSafeRedirectPath,
  readLoginRedirect,
  rememberPostAuthRedirect,
} from "./auth-redirect";

const STORAGE_KEY = "gruppo-alpini:post-auth-redirect";

function createSessionStorage() {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    values,
  };
}

function stubWindow(
  overrides: {
    pathname?: string;
    search?: string;
    sessionStorage?: ReturnType<typeof createSessionStorage>;
  } = {},
) {
  const sessionStorage = overrides.sessionStorage ?? createSessionStorage();

  vi.stubGlobal("window", {
    location: {
      pathname: overrides.pathname ?? "/",
      search: overrides.search ?? "",
    },
    sessionStorage,
  });

  return sessionStorage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSafeRedirectPath", () => {
  it("returns null when no destination is supplied", () => {
    expect(getSafeRedirectPath(null)).toBeNull();
    expect(getSafeRedirectPath(undefined)).toBeNull();
    expect(getSafeRedirectPath("")).toBeNull();
    expect(getSafeRedirectPath("   ")).toBeNull();
  });

  it("accepts same-origin absolute paths", () => {
    expect(getSafeRedirectPath("/eventi")).toBe("/eventi");
    expect(getSafeRedirectPath("/profile")).toBe("/profile");
    expect(getSafeRedirectPath("/iscritti?filter=pending")).toBe(
      "/iscritti?filter=pending",
    );
    expect(getSafeRedirectPath("/admin/impostazioni")).toBe(
      "/admin/impostazioni",
    );
  });

  it("preserves the query string and fragment", () => {
    expect(getSafeRedirectPath("/eventi?event=abc")).toBe(
      "/eventi?event=abc",
    );
    expect(getSafeRedirectPath("/eventi?event=abc#dettagli")).toBe(
      "/eventi?event=abc#dettagli",
    );
    expect(getSafeRedirectPath("/eventi?x=1&y=2#top")).toBe(
      "/eventi?x=1&y=2#top",
    );
  });

  it("trims surrounding whitespace before validating", () => {
    expect(getSafeRedirectPath("  /eventi  ")).toBe("/eventi");
    expect(getSafeRedirectPath("\t/eventi?event=abc\n")).toBe(
      "/eventi?event=abc",
    );
  });

  it("treats the bare home path as no redirect", () => {
    expect(getSafeRedirectPath("/")).toBeNull();
  });

  it("rejects external, protocol-relative, and non-http schemes", () => {
    expect(getSafeRedirectPath("https://evil.example")).toBeNull();
    expect(getSafeRedirectPath("http://evil.example/path")).toBeNull();
    expect(getSafeRedirectPath("//evil.example")).toBeNull();
    expect(getSafeRedirectPath("///evil.example")).toBeNull();
    expect(getSafeRedirectPath("javascript:alert(1)")).toBeNull();
    expect(getSafeRedirectPath("mailto:member@example.it")).toBeNull();
    expect(getSafeRedirectPath("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(getSafeRedirectPath("/\\evil.example")).toBeNull();
  });

  it("rejects relative and fragment-only destinations", () => {
    expect(getSafeRedirectPath("eventi")).toBeNull();
    expect(getSafeRedirectPath("./eventi")).toBeNull();
    expect(getSafeRedirectPath("../eventi")).toBeNull();
    expect(getSafeRedirectPath("?event=abc")).toBeNull();
    expect(getSafeRedirectPath("#dettagli")).toBeNull();
  });

  it("rejects the login routes to avoid redirect loops", () => {
    expect(getSafeRedirectPath("/login")).toBeNull();
    expect(getSafeRedirectPath("/login?next=/eventi")).toBeNull();
    expect(getSafeRedirectPath("/login/")).toBeNull();
    expect(getSafeRedirectPath("/login/forgot")).toBeNull();
    expect(getSafeRedirectPath("/login/reset-password?code=abc")).toBeNull();
  });

  it("decodes the pathname before checking for login routes", () => {
    expect(getSafeRedirectPath("/%6cogin")).toBeNull();
    expect(getSafeRedirectPath("/%6Cogin/forgot")).toBeNull();
    expect(getSafeRedirectPath("/%2F%2Fevil.example")).toBeNull();
  });

  it("rejects encoded control characters", () => {
    expect(getSafeRedirectPath("/foo%00bar")).toBeNull();
    expect(getSafeRedirectPath("/foo%1Fbar")).toBeNull();
    expect(getSafeRedirectPath("/foo%7Fbar")).toBeNull();
  });

  it("rejects malformed percent-encoding", () => {
    expect(getSafeRedirectPath("/%E0%A4%A")).toBeNull();
    expect(getSafeRedirectPath("/eventi%ZZ")).toBeNull();
  });

  it("normalizes dot segments before deciding", () => {
    expect(getSafeRedirectPath("/login/../eventi")).toBe("/eventi");
    expect(getSafeRedirectPath("/eventi/../login")).toBeNull();
    expect(getSafeRedirectPath("/eventi/./dettagli")).toBe("/eventi/dettagli");
  });

  it("does not confuse lookalike login routes with the real ones", () => {
    expect(getSafeRedirectPath("/loginx")).toBe("/loginx");
    expect(getSafeRedirectPath("/login-help")).toBe("/login-help");
  });
});

describe("buildLoginHref", () => {
  it("encodes a safe destination into the next parameter", () => {
    expect(buildLoginHref("/eventi")).toBe("/login?next=%2Feventi");
    expect(buildLoginHref("/eventi?event=abc")).toBe(
      `/login?next=${encodeURIComponent("/eventi?event=abc")}`,
    );
    expect(buildLoginHref("/iscritti?filter=pending#top")).toBe(
      `/login?next=${encodeURIComponent("/iscritti?filter=pending#top")}`,
    );
  });

  it("falls back to the plain login page for unsafe destinations", () => {
    expect(buildLoginHref(null)).toBe("/login");
    expect(buildLoginHref("")).toBe("/login");
    expect(buildLoginHref("/")).toBe("/login");
    expect(buildLoginHref("https://evil.example")).toBe("/login");
    expect(buildLoginHref("//evil.example")).toBe("/login");
    expect(buildLoginHref("/login")).toBe("/login");
  });
});

describe("post-auth redirect storage", () => {
  it("does nothing during server rendering", () => {
    expect(getCurrentRedirectPath()).toBeNull();
    expect(consumePostAuthRedirect()).toBeNull();
    expect(readLoginRedirect("")).toBeNull();
    expect(readLoginRedirect("?next=/eventi")).toBe("/eventi");

    expect(() => rememberPostAuthRedirect("/eventi")).not.toThrow();
    expect(() => clearPostAuthRedirect()).not.toThrow();
  });

  it("remembers, reads, and clears a safe destination", () => {
    const storage = stubWindow();

    rememberPostAuthRedirect("/eventi?event=abc");

    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      "/eventi?event=abc",
    );
    expect(consumePostAuthRedirect()).toBe("/eventi?event=abc");
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(consumePostAuthRedirect()).toBeNull();
  });

  it("replaces an existing destination with the newest safe path", () => {
    stubWindow();

    rememberPostAuthRedirect("/eventi");
    rememberPostAuthRedirect("/profile");

    expect(consumePostAuthRedirect()).toBe("/profile");
  });

  it("removes a stored destination when a new unsafe path is supplied", () => {
    const storage = stubWindow();

    rememberPostAuthRedirect("/eventi");
    rememberPostAuthRedirect("https://evil.example");

    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(consumePostAuthRedirect()).toBeNull();
  });

  it("ignores an invalid stored value", () => {
    const storage = stubWindow();
    storage.values.set(STORAGE_KEY, "//evil.example");

    expect(consumePostAuthRedirect()).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("clears the stored destination on demand", () => {
    const storage = stubWindow();
    storage.values.set(STORAGE_KEY, "/eventi");

    clearPostAuthRedirect();

    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(storage.values.has(STORAGE_KEY)).toBe(false);
  });

  it("swallows unavailable or blocked storage", () => {
    const unavailable = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      removeItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };

    vi.stubGlobal("window", { sessionStorage: unavailable });

    expect(() => rememberPostAuthRedirect("/eventi")).not.toThrow();
    expect(consumePostAuthRedirect()).toBeNull();
    expect(() => clearPostAuthRedirect()).not.toThrow();
    expect(readLoginRedirect("")).toBeNull();
  });
});

describe("readLoginRedirect", () => {
  it("prefers the next query parameter", () => {
    const storage = stubWindow();
    storage.values.set(STORAGE_KEY, "/profile");

    expect(readLoginRedirect("?next=/eventi?event=abc")).toBe(
      "/eventi?event=abc",
    );
  });

  it("does not fall back to storage when next is present but unsafe", () => {
    const storage = stubWindow();
    storage.values.set(STORAGE_KEY, "/profile");

    expect(readLoginRedirect("?next=https://evil.example")).toBeNull();
    expect(readLoginRedirect("?next=")).toBeNull();
  });

  it("reuses the stored destination when next is absent", () => {
    const storage = stubWindow();
    storage.values.set(STORAGE_KEY, "/eventi?event=abc");

    expect(readLoginRedirect("")).toBe("/eventi?event=abc");
    expect(readLoginRedirect("?other=1")).toBe("/eventi?event=abc");
  });

  it("ignores a stored destination for a rejected login route", () => {
    const storage = stubWindow();
    storage.values.set(STORAGE_KEY, "/login");

    expect(readLoginRedirect("")).toBeNull();
  });
});

describe("getCurrentRedirectPath", () => {
  it("combines the current pathname and search string", () => {
    stubWindow({ pathname: "/eventi", search: "?event=abc" });

    expect(getCurrentRedirectPath()).toBe("/eventi?event=abc");
  });

  it("returns null on the home page", () => {
    stubWindow({ pathname: "/", search: "" });

    expect(getCurrentRedirectPath()).toBeNull();
  });

  it("rejects an unsafe current location", () => {
    stubWindow({ pathname: "//evil.example", search: "" });

    expect(getCurrentRedirectPath()).toBeNull();
  });
});
