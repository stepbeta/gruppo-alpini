import { supabase } from "./supabase";

export type GenericRequestStatus = "open" | "resolved";

export type GenericRequestRecord = {
  id: string;
  user_id: string | null;
  message: string;
  status: GenericRequestStatus;
  created_at: string;
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
 * Reads the requests visible to the signed-in member.
 *
 * RLS returns only the member's own rows to regular users and every row to
 * administrators, so the same query powers both the personal list and the
 * secretariat board.
 */
export async function fetchGenericRequests(): Promise<{
  requests: GenericRequestRecord[];
  error: string | null;
}> {
  if (!supabase) {
    return { requests: [], error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("generic_requests")
      .select(REQUEST_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      return { requests: [], error: error.message };
    }

    return {
      requests: (data as GenericRequestRecord[] | null) ?? [],
      error: null,
    };
  } catch (error) {
    return { requests: [], error: errorMessage(error) };
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
