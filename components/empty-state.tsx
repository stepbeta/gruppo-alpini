/**
 * ============================================================================
 * CONTEXTUAL GUIDANCE — MAINTENANCE RULE
 * ============================================================================
 *
 * Whenever features, workflows, validation rules, or routes are modified in
 * the application, these contextual helpers, empty states, and error messages
 * must be reviewed and updated simultaneously in the same pull request to keep
 * user guidance fully aligned with the current code.
 *
 * In pratica: se cambi un flusso, un filtro, una regola di validazione o una
 * rotta, aggiorna nello stesso pull request i testi di questo componente e gli
 * stati vuoti che lo usano.
 * ============================================================================
 */

import type { ReactNode } from "react";

export const emptyStatePrimaryActionClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500";

export const emptyStateSecondaryActionClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300";

type EmptyStateTone = "neutral" | "emerald" | "amber";

const TONE_CLASSES: Record<EmptyStateTone, string> = {
  neutral:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
};

type EmptyStateCardProps = {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  hint?: ReactNode;
  tone?: EmptyStateTone;
  compact?: boolean;
  variant?: "card" | "inline";
  headingLevel?: "h2" | "h3";
  className?: string;
};

/**
 * Shared empty-state card for list screens, searches and filtered views.
 *
 * It always includes a title, an explanation and optional next-step actions so
 * members are never left in front of an unexplained blank area.
 */
export function EmptyStateCard({
  icon,
  title,
  description,
  actions,
  hint,
  tone = "neutral",
  compact = false,
  variant = "card",
  headingLevel = "h2",
  className = "",
}: EmptyStateCardProps) {
  const Heading = headingLevel;
  const isInline = variant === "inline";

  const containerClass = isInline
    ? "rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-6 dark:border-zinc-700 dark:bg-zinc-950/40"
    : `rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
        compact ? "p-6" : "p-8"
      }`;

  return (
    <div
      className={`${containerClass} text-center ${className}`}
      role="status"
    >
      <span
        className={`mx-auto flex items-center justify-center rounded-2xl ${
          compact ? "h-11 w-11" : "h-14 w-14"
        } ${TONE_CLASSES[tone]}`}
      >
        {icon}
      </span>

      <Heading
        className={`mt-4 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 ${
          compact ? "text-base" : "text-xl"
        }`}
      >
        {title}
      </Heading>

      <div className="mx-auto mt-1.5 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {description}
      </div>

      {hint ? (
        <div className="mx-auto mt-4 max-w-lg rounded-xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-2.5 text-left text-xs leading-5 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
          {hint}
        </div>
      ) : null}

      {actions ? (
        <div className="mt-5 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
