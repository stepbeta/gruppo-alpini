"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  isThemeMode,
  nextThemeMode,
  resolveThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme";

const THEME_CHANGE_EVENT = "gruppo-alpini:theme-change";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

// Lets the toggle keep working for the current tab when localStorage is
// unavailable (private browsing, blocked storage, or quota errors).
let inMemoryMode: ThemeMode | null = null;

function readModeSnapshot(): ThemeMode {
  if (inMemoryMode !== null) return inMemoryMode;

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

function subscribeToMode(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;

    // A different tab changed the stored preference: prefer its value again.
    inMemoryMode = null;
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getSystemPrefersDark(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function getServerSystemPrefersDark(): boolean {
  return false;
}

function subscribeToSystemPreference(onStoreChange: () => void) {
  const media = window.matchMedia(DARK_MEDIA_QUERY);
  media.addEventListener("change", onStoreChange);

  return () => media.removeEventListener("change", onStoreChange);
}

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(
    subscribeToMode,
    readModeSnapshot,
    () => DEFAULT_THEME_MODE,
  );
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemPreference,
    getSystemPrefersDark,
    getServerSystemPrefersDark,
  );
  const resolvedTheme = resolveThemeMode(mode, systemPrefersDark);

  const cycleTheme = useCallback(() => {
    const nextMode = nextThemeMode(readModeSnapshot());

    inMemoryMode = nextMode;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch {
      // The in-memory fallback above keeps the toggle usable for this tab.
    }

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = resolvedTheme === "dark";

    root.classList.toggle("dark", isDark);
    root.style.colorScheme = resolvedTheme;

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    themeColorMeta?.setAttribute("content", isDark ? "#0a0a0a" : "#ffffff");
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedTheme, cycleTheme }),
    [mode, resolvedTheme, cycleTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }

  return context;
}
