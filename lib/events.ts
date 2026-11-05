import {
  buildIlikeOr,
  getPageCount,
  getPageRange,
  normalizePage,
  normalizePageSize,
  type PaginationInfo,
  type PaginationParams,
} from "./pagination";
import { supabase } from "./supabase";

export type EventResponseStatus = "present" | "tentative" | "absent";

export type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  is_all_day: boolean;
  created_by: string | null;
  created_at: string;
};

export type EventResponseRecord = {
  id: string;
  event_id: string;
  user_id: string | null;
  status: EventResponseStatus;
  updated_at: string;
};

export type EventInput = {
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  is_all_day: boolean;
};

export type EventDateInput = {
  date: string;
  time: string;
};

export type ParsedEventDateTime = {
  date: Date;
  isAllDay: boolean;
};

export type EventScope = "upcoming" | "past";

export type EventsQuery = PaginationParams & {
  scope: EventScope;
  /** Matches title, location or description. */
  search?: string;
};

export type EventsPage = PaginationInfo & {
  events: EventRecord[];
  error: string | null;
};

const EVENT_COLUMNS =
  "id, title, description, location, event_date, is_all_day, created_by, created_at";
const EVENT_RESPONSE_COLUMNS = "id, event_id, user_id, status, updated_at";

export const EVENT_DEEP_LINK_PARAM = "event";

/** Path for a shareable, authentication-protected event deep link. */
export function getEventSharePath(eventId: string): string {
  return `/eventi?${EVENT_DEEP_LINK_PARAM}=${encodeURIComponent(eventId)}`;
}

/** Reads an event id from a query string such as `?event=<id>`. */
export function getEventIdFromSearch(search: string): string | null {
  const eventId = new URLSearchParams(search)
    .get(EVENT_DEEP_LINK_PARAM)
    ?.trim();

  return eventId ? eventId : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Turns the most common Supabase/PostgREST errors into Italian messages. */
export function formatEventError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("row-level security")
  ) {
    return "Non hai i permessi per questa operazione. Verifica che le migrazioni Supabase siano state applicate al database.";
  }
  if (
    normalized.includes("relation") &&
    normalized.includes("does not exist")
  ) {
    return "Le tabelle degli eventi non sono ancora disponibili. Verifica le migrazioni Supabase.";
  }
  if (normalized.includes("duplicate key")) {
    return "Esiste già una risposta per questo evento.";
  }
  if (normalized.includes("invalid input syntax")) {
    return "Uno dei valori inseriti non è valido. Controlla i campi e riprova.";
  }

  return message;
}

/**
 * Formats event dates strictly as `dd/mm/yyyy HH:mm` in local time.
 *
 * All-day events are stored at UTC midnight and display only `dd/mm/yyyy`.
 */
export function formatEventDate(value: string, isAllDay = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data non valida";

  if (isAllDay) {
    const day = pad2(date.getUTCDate());
    const month = pad2(date.getUTCMonth() + 1);
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/** Prefills the masked date/time fields when editing an event. */
export function formatEventDateInput(
  value: string,
  isAllDay = false,
): EventDateInput {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };

  if (isAllDay) {
    return {
      date: `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`,
      time: "",
    };
  }

  return {
    date: `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

/**
 * Parses the strict Italian input format `gg/mm/aaaa` and optional `HH:mm`.
 *
 * An empty time produces an all-day event stored at UTC midnight. Impossible
 * dates such as 31/02/2026 and invalid 24-hour times such as 25:00 return
 * `null`.
 */
export function parseEventDateTime(
  dateValue: string,
  timeValue: string,
): ParsedEventDateTime | null {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateValue.trim());

  if (!dateMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const trimmedTime = timeValue.trim();

  if (!trimmedTime) {
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return { date, isAllDay: true };
  }

  const timeMatch = /^(\d{2}):(\d{2})$/.exec(trimmedTime);

  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (hours > 23 || minutes > 59) return null;

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }

  return { date, isAllDay: false };
}

/** Keeps typed/pasted dates in the visible `gg/mm/aaaa` shape. */
export function maskItalianDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Keeps typed/pasted times in the visible 24-hour `HH:mm` shape. */
export function maskItalianTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function eventTimestamp(event: EventRecord): number {
  const timestamp = new Date(event.event_date).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Mirrors the upcoming/past rule used by the server-side PostgREST filter.
 *
 * All-day events stay upcoming for their whole local calendar date; timed
 * events switch to past at their exact start time. Malformed dates are treated
 * as past so they cannot sit at the top of the calendar indefinitely.
 */
export function isEventPast(event: EventRecord, now: number): boolean {
  if (event.is_all_day) {
    const today = new Date(now);
    const startOfToday = Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    return eventTimestamp(event) < startOfToday;
  }

  return eventTimestamp(event) < now;
}

/**
 * Mirrors the client-side upcoming/past rules in PostgREST syntax.
 *
 * All-day events are stored at UTC midnight and stay upcoming for the whole
 * local calendar date; timed events switch to past at their exact start time.
 */
function eventScopeFilter(scope: EventScope, now: Date): string {
  const startOfTodayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const allDayCutoff = new Date(startOfTodayUtc).toISOString();
  const timedCutoff = now.toISOString();
  const comparison = scope === "upcoming" ? "gte" : "lt";

  return [
    `and(is_all_day.eq.true,event_date.${comparison}.${allDayCutoff})`,
    `and(is_all_day.eq.false,event_date.${comparison}.${timedCutoff})`,
  ].join(",");
}

/**
 * Reads one page of upcoming or past events with optional server-side search.
 * The exact count and date range are calculated by PostgREST.
 */
export async function fetchEvents(params: EventsQuery): Promise<EventsPage> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const emptyPage = {
    events: [] as EventRecord[],
    page,
    pageSize,
    total: 0,
    pageCount: 0,
  };

  if (!supabase) {
    return { ...emptyPage, error: "Supabase non configurato." };
  }

  try {
    let query = supabase
      .from("events")
      .select(EVENT_COLUMNS, { count: "exact" });

    query = query.or(eventScopeFilter(params.scope, new Date()));

    const searchFilter = buildIlikeOr(
      ["title", "location", "description"],
      params.search,
    );

    if (searchFilter) {
      query = query.or(searchFilter);
    }

    const { from, to } = getPageRange(page, pageSize);
    const ascending = params.scope === "upcoming";
    const { data, error, count } = await query
      .order("event_date", { ascending })
      .order("id", { ascending })
      .range(from, to);

    if (error) {
      return { ...emptyPage, error: error.message };
    }

    const total = count ?? 0;

    return {
      events: (data as EventRecord[] | null) ?? [],
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

/** Loads one event even when it is not on the current calendar page. */
export async function fetchEventById(
  eventId: string,
): Promise<{ event: EventRecord | null; error: string | null }> {
  if (!supabase) {
    return { event: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("id", eventId)
      .maybeSingle();

    if (error) {
      return { event: null, error: error.message };
    }

    return { event: (data as EventRecord | null) ?? null, error: null };
  } catch (error) {
    return { event: null, error: errorMessage(error) };
  }
}

/**
 * Reads the responses for the events currently visible on screen.
 *
 * Regular members receive only their own rows; administrators receive every
 * row so they can display attendance totals and the names of responders.
 * Responses whose member account was deleted keep `user_id = NULL` and still
 * count in the historical attendance totals.
 */
export async function fetchEventResponses(eventIds: string[]): Promise<{
  responses: EventResponseRecord[];
  error: string | null;
}> {
  const uniqueIds = [...new Set(eventIds.filter((id) => id.length > 0))];

  if (uniqueIds.length === 0) {
    return { responses: [], error: null };
  }

  if (!supabase) {
    return { responses: [], error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("event_responses")
      .select(EVENT_RESPONSE_COLUMNS)
      .in("event_id", uniqueIds);

    if (error) {
      return { responses: [], error: error.message };
    }

    return {
      responses: (data as EventResponseRecord[] | null) ?? [],
      error: null,
    };
  } catch (error) {
    return { responses: [], error: errorMessage(error) };
  }
}

/** Creates or updates the signed-in member's response for one event. */
export async function saveEventResponse(
  eventId: string,
  userId: string,
  status: EventResponseStatus,
): Promise<{ response: EventResponseRecord | null; error: string | null }> {
  if (!supabase) {
    return { response: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("event_responses")
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id,user_id" },
      )
      .select(EVENT_RESPONSE_COLUMNS)
      .single();

    if (error) {
      return { response: null, error: error.message };
    }

    return { response: data as EventResponseRecord, error: null };
  } catch (error) {
    return { response: null, error: errorMessage(error) };
  }
}

/**
 * Creates an event as an administrator.
 *
 * `created_by` is intentionally omitted: the database derives it from
 * `auth.uid()` and rejects a forged value. RLS enforces the admin check.
 */
export async function createEvent(
  values: EventInput,
): Promise<{ event: EventRecord | null; error: string | null }> {
  if (!supabase) {
    return { event: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .insert(values)
      .select(EVENT_COLUMNS)
      .single();

    if (error) {
      return { event: null, error: error.message };
    }

    return { event: data as EventRecord, error: null };
  } catch (error) {
    return { event: null, error: errorMessage(error) };
  }
}

/** Updates an existing event as an administrator; RLS enforces the admin check. */
export async function updateEvent(
  eventId: string,
  values: EventInput,
): Promise<{ event: EventRecord | null; error: string | null }> {
  if (!supabase) {
    return { event: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .update(values)
      .eq("id", eventId)
      .select(EVENT_COLUMNS)
      .single();

    if (error) {
      return { event: null, error: error.message };
    }

    return { event: data as EventRecord, error: null };
  } catch (error) {
    return { event: null, error: errorMessage(error) };
  }
}

/** Deletes an event and its responses; RLS enforces the admin check. */
export async function deleteEvent(
  eventId: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase non configurato." };
  }

  try {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
