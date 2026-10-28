import Link from "next/link";

type SiteFooterProps = {
  /** Container width; pass a full Tailwind class such as `max-w-4xl`. */
  containerClassName?: string;
};

export function SiteFooter({
  containerClassName = "max-w-5xl",
}: SiteFooterProps) {
  return (
    <footer className="border-t border-zinc-200 py-6 dark:border-zinc-800">
      <div
        className={`mx-auto flex w-full flex-col items-center justify-between gap-2 px-4 text-center text-xs text-zinc-500 sm:flex-row sm:px-6 sm:text-left dark:text-zinc-400 ${containerClassName}`}
      >
        <p>Gruppo Alpini · Portale riservato ai soci</p>
        <Link
          className="rounded font-medium transition-colors hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:hover:text-emerald-400"
          href="/privacy"
        >
          Privacy
        </Link>
      </div>
    </footer>
  );
}
