import { MountainIcon } from "./icons";

type BrandProps = {
  subtitle?: string;
  compact?: boolean;
};

export function Brand({ subtitle, compact = false }: BrandProps) {
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm shadow-emerald-900/20 ${
          compact ? "h-9 w-9" : "h-11 w-11"
        }`}
      >
        <MountainIcon className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      <span className="min-w-0">
        <span
          className={`block font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          Gruppo Alpini
        </span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
          {subtitle ?? "Portale dei soci"}
        </span>
      </span>
    </span>
  );
}
