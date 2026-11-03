import {
  getPageCount,
  getPageRange,
  normalizePage,
  normalizePageSize,
  sanitizeSearchTerm,
  type CountResult,
  type PaginationInfo,
  type PaginationParams,
} from "./pagination";
import { supabase } from "./supabase";

export type GenericRequestStatus = "open" | "resolved";

export type GenericRequestRecord = {
  id: string;
  user_id: string | null;
  message: string;
  status: GenericRequestStatus;
  created_at: string;
};

export type RequestsQuery = PaginationParams & {
  scope: "mine" | "all";
  /** Required for the personal list; RLS still protects the row. */
  userId?: string;
  status?: GenericRequestStatus;
  /** Matches the request message. */
  search?: string;
};

export type RequestsPage = PaginationInfo & {
  requests: GenericRequestRecord[];
  error: string | null;
};

export type RequestCounts = {
  total: number;
  open: number;
  resolved: number;
  error: string | null;
};

const REQUEST_COLUMNS = "id, user_id, message, status, created_at";

export const REQUEST_STATUS_LABELS: Record<GenericRequestStatus, string> = {
  open: "In attesa",
  resolved: "Risolta",
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Turns the most common Supabase/PostgREST errors into Italian messages. */
export function formatRequestError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("row-level security")
  ) {
    return "Non hai i permessi per questa operazione. Verifica che le migrazioni Supabase siano state applicate al database.";
  }
  if (
    (normalized.includes("relation") &&
      normalized.includes("does not exist")) ||
    normalized.includes("schema cache")
  ) {
    return "La tabella delle richieste non è ancora disponibile. Verifica le migrazioni Supabase.";
  }
  if (normalized.includes("violates check constraint")) {
    return "Lo stato della richiesta non è valido. Ricarica la pagina e riprova.";
  }
  if (normalized.includes("invalid input syntax")) {
    return "Uno dei valori inseriti non è valido. Controlla i campi e riprova.";
  }

  return message;
}

/** Formats request timestamps as `dd/mm/yyyy HH:mm` in local time. */
export function formatRequestDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data non valida";

  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Reads one page of requests visible to the signed-in member.
 *
 * RLS returns only the member's own rows to regular users and every row to
 * administrators. The personal list and the secretariat board therefore share
 * this helper but pass different scopes and filters.
 */
export async function fetchGenericRequests(
  params: RequestsQuery,
): Promise<RequestsPage> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const emptyPage = {
    requests: [] as GenericRequestRecord[],
    page,
    pageSize,
    total: 0,
    pageCount: 0,
  };

  if (!supabase) {
    return { ...emptyPage, error: "Supabase non configurato." };
  }

  if (params.scope === "mine" && !params.userId) {
    return { ...emptyPage, error: "Sessione non disponibile. Accedi di nuovo." };
  }

  try {
    let query = supabase
      .from("generic_requests")
      .select(REQUEST_COLUMNS, { count: "exact" });

    if (params.scope === "mine") {
      query = query.eq("user_id", params.userId);
    }

    if (params.status) {
      query = query.eq("status", params.status);
    }

    const searchTerm = sanitizeSearchTerm(params.search);
    if (searchTerm) {
      query = query.ilike("message", `%${searchTerm}%`);
    }

    const { from, to } = getPageRange(page, pageSize);
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      return { ...emptyPage, error: error.message };
    }

    const total = count ?? 0;

    return {
      requests: (data as GenericRequestRecord[] | null) ?? [],
      page,
      pageSize,
      total,
      pageCount: getPageCount(total, pageSize),
      error: null,
    };
  } catch (error) {
    return { ...emptyPage, error: errorMessage(error) };
  }
}

/**
 * Exact open/resolved counts for the secretariat board tabs. The search term
 * is applied so the badges stay consistent with the visible list.
 */
export async function fetchRequestCounts(
  search?: string,
): Promise<RequestCounts> {
  if (!supabase) {
    return {
      total: 0,
      open: 0,
      resolved: 0,
      error: "Supabase non configurato.",
    };
  }

  const client = supabase;

  const countStatus = async (
    status: GenericRequestStatus,
  ): Promise<CountResult> => {
    let query = client
      .from("generic_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", status);

    const searchTerm = sanitizeSearchTerm(search);
    if (searchTerm) {
      query = query.ilike("message", `%${searchTerm}%`);
    }

    const { count, error } = await query;
    return { count: count ?? 0, error: error?.message ?? null };
  };

  try {
    const [openResult, resolvedResult] = await Promise.all([
      countStatus("open"),
      countStatus("resolved"),
    ]);
    const error = openResult.error ?? resolvedResult.error;

    if (error) {
      return { total: 0, open: 0, resolved: 0, error };
    }

    return {
      total: openResult.count + resolvedResult.count,
      open: openResult.count,
      resolved: resolvedResult.count,
      error: null,
    };
  } catch (error) {
    return {
      total: 0,
      open: 0,
      resolved: 0,
      error: errorMessage(error),
    };
  }
}

/** Submits a new request to the group secretariat. */
export async function createGenericRequest(
  userId: string,
  message: string,
): Promise<{ request: GenericRequestRecord | null; error: string | null }> {
  if (!supabase) {
    return { request: null, error: "Supabase non configurato." };
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return { request: null, error: "Scrivi il testo della richiesta." };
  }

  try {
    const { data, error } = await supabase
      .from("generic_requests")
      .insert({
        user_id: userId,
        message: trimmedMessage,
      })
      .select(REQUEST_COLUMNS)
      .single();

    if (error) {
      return { request: null, error: error.message };
    }

    return { request: data as GenericRequestRecord, error: null };
  } catch (error) {
    return { request: null, error: errorMessage(error) };
  }
}

/** Updates a request status; RLS only lets administrators perform this call. */
export async function updateGenericRequestStatus(
  requestId: string,
  status: GenericRequestStatus,
): Promise<{ request: GenericRequestRecord | null; error: string | null }> {
  if (!supabase) {
    return { request: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("generic_requests")
      .update({ status })
      .eq("id", requestId)
      .select(REQUEST_COLUMNS)
      .single();

    if (error) {
      return { request: null, error: error.message };
    }

    return { request: data as GenericRequestRecord, error: null };
  } catch (error) {
    return { request: null, error: errorMessage(error) };
  }
}
