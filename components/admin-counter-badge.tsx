import type { AdminCounterBadgeData } from "@/lib/admin-counters";

/**
 * Small amber counter used by the header navigation and the home shortcuts.
 * The visible number is hidden from assistive technology in favour of the
 * full Italian label, which also carries counts above the `99+` display cap.
 */
export function AdminCounterBadge({
  badge,
  className = "",
}: {
  badge: AdminCounterBadgeData | null;
  className?: string;
}) {
  if (!badge) return null;

  return (
    <span
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-1.5 text-[11px] font-semibold leading-none text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ${className}`}
      title={badge.label}
    >
      <span aria-hidden="true">{badge.display}</span>
      <span className="sr-only">{badge.label}</span>
    </span>
  );
}
