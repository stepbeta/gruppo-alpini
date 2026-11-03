"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel: string;
  disabled?: boolean;
  className?: string;
};

type PageItem = number | "ellipsis";

function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: PageItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push("ellipsis");

  for (let current = start; current <= end; current += 1) {
    items.push(current);
  }

  if (end < pageCount - 1) items.push("ellipsis");

  items.push(pageCount);
  return items;
}

/** Page-number navigation shared by the member, event and request lists. */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  itemLabel,
  disabled = false,
  className = "",
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const currentPage = Math.min(Math.max(1, page), pageCount);
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);
  const buttonClass =
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-40";
  const secondaryButtonClass = `${buttonClass} border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300`;

  return (
    <nav
      aria-label={`Paginazione ${itemLabel}`}
      className={`flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 ${className}`}
    >
      <p
        aria-live="polite"
        className="text-sm text-zinc-500 dark:text-zinc-400"
      >
        {from}–{to} di {total} {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          aria-label="Pagina precedente"
          className={secondaryButtonClass}
          disabled={disabled || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Precedente</span>
        </button>

        {pageItems(currentPage, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <span
              aria-hidden="true"
              className="px-1 text-sm text-zinc-400 dark:text-zinc-500"
              key={`ellipsis-${index}`}
            >
              …
            </span>
          ) : (
            <button
              aria-current={item === currentPage ? "page" : undefined}
              aria-label={`Pagina ${item}`}
              className={
                item === currentPage
                  ? `${buttonClass} border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-600`
                  : secondaryButtonClass
              }
              disabled={disabled}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item}
            </button>
          ),
        )}

        <button
          aria-label="Pagina successiva"
          className={secondaryButtonClass}
          disabled={disabled || currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          <span className="hidden sm:inline">Successiva</span>
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
