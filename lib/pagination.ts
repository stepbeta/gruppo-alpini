/** Default number of rows requested from Supabase by the paginated helpers. */
export const DEFAULT_PAGE_SIZE = 10;

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export type PaginationInfo = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

/** Normalizes a 1-based page number coming from UI state or a caller. */
export function normalizePage(page?: number): number {
  if (!page || !Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

/** Keeps a page size inside a range that is sensible for a browser request. */
export function normalizePageSize(
  pageSize?: number,
  fallback = DEFAULT_PAGE_SIZE,
): number {
  if (!pageSize || !Number.isFinite(pageSize)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(pageSize)));
}

/** Converts a page number to the inclusive range expected by PostgREST. */
export function getPageRange(
  page: number,
  pageSize: number,
): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Number of pages for an exact row count; 0 when there are no rows. */
export function getPageCount(total: number, pageSize: number): number {
  return total > 0 ? Math.ceil(total / pageSize) : 0;
}

/**
 * Removes characters that would break the PostgREST `or`/`ilike` filter
 * grammar. The text itself is intentionally not lowercased: `ilike` is already
 * case-insensitive and keeps the query readable in Supabase logs.
 */
export function sanitizeSearchTerm(value: string | undefined): string {
  if (!value) return "";

  return value
    .replace(/[%_\\,*()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds the comma-separated expression used by `PostgrestFilterBuilder.or()`.
 * Returns `null` when the term becomes empty after sanitizing, so callers can
 * skip the filter entirely instead of matching every row.
 */
export function buildIlikeOr(
  columns: readonly string[],
  search: string | undefined,
): string | null {
  const term = sanitizeSearchTerm(search);
  if (!term) return null;

  return columns.map((column) => `${column}.ilike.%${term}%`).join(",");
}

/** Shared exact-count result shape used by the paginated helpers. */
export type CountResult = {
  count: number;
  error: string | null;
};
