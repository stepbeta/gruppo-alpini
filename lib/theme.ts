export const THEME_STORAGE_KEY = "gruppo-alpini:theme:v1";

export const THEME_MODES = ["system", "light", "dark"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = Exclude<ThemeMode, "system">;

export const DEFAULT_THEME_MODE: ThemeMode = "system";

export function isThemeMode(value: unknown): value is ThemeMode {
  return (
    typeof value === "string" &&
    (THEME_MODES as readonly string[]).includes(value)
  );
}

/** Returns the next mode in the fixed `system → light → dark → system` cycle. */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  const index = THEME_MODES.indexOf(mode);
  return THEME_MODES[(index + 1) % THEME_MODES.length] ?? DEFAULT_THEME_MODE;
}

/** Resolves the mode that should actually be painted. */
export function resolveThemeMode(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (mode === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return mode;
}
