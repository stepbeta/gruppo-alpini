"use client";

import { nextThemeMode, type ThemeMode } from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";
import { useTheme } from "./theme-provider";

const MODE_LABELS: Record<ThemeMode, string> = {
  system: "sistema",
  light: "chiaro",
  dark: "scuro",
};

const MODE_ICONS = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} as const;

type ThemeToggleProps = {
  className?: string;
};

/** Compact control that cycles through system, light, and dark themes. */
export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { mode, cycleTheme } = useTheme();
  const Icon = MODE_ICONS[mode];
  const nextMode = nextThemeMode(mode);
  const label = `Tema: ${MODE_LABELS[mode]} (clic per passare a ${MODE_LABELS[nextMode]})`;

  return (
    <button
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 ${className}`}
      onClick={cycleTheme}
      title={label}
      type="button"
    >
      <Icon className="h-4.5 w-4.5" />
    </button>
  );
}
