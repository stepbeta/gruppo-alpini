import {
  formatFriendlyError,
  GUEST_COUNT_ERROR_MESSAGE,
} from "./error-messages";
import {
  formatItalianDateInput,
  formatItalianDateTimeInput,
  type ItalianDateTimeInput,
  type ParsedItalianDateTime,
} from "./italian-date";
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
  guest_count: number;
  updated_at: string;
};

/**
 * Minimal response shape needed to aggregate attendance.
 *
 * `user_id` is optional because deleted members keep their historical rows
 * with `user_id = NULL`; their members and guests still count in the totals.
 */
export type EventAttendanceEntry = {
  status: EventResponseStatus;
  guest_count: number;
  user_id?: string | null;
};

export type EventAttendanceSummary = {
  presentMembers: number;
  tentativeMembers: number;
  absentMembers: number;
  presentGuests: number;
  tentativeGuests: number;
  /** Members with a positive status (`present` or `tentative`). */
  positiveMembers: number;
  /** Guests of positive responses only; absent guests never contribute. */
  totalGuests: number;
  /** Positive members plus their guests. */
  totalAttendees: number;
};

export type GuestCountValidation =
  | { guestCount: number; error: null }
  | { guestCount: null; error: string };

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

export type ParsedEventDateTime = ParsedItalianDateTime;

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
const EVENT_RESPONSE_COLUMNS =
  "id, event_id, user_id, status, guest_count, updated_at";

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
  return formatFriendlyError(message, {
    fallback:
      "Non è stato possibile completare l’operazione sugli eventi. Riprova tra poco; se il problema continua, contatta un amministratore.",
    permission:
      "Non hai i permessi per questa operazione. Verifica che le migrazioni Supabase siano state applicate al database.",
    missingTable:
      "Le tabelle degli eventi non sono ancora disponibili. Verifica le migrazioni Supabase.",
    duplicate: "Esiste già una risposta per questo evento.",
    checkConstraint:
      "Controlla i dati dell’evento: uno o più valori non sono validi.",
    invalidInput:
      "Uno dei valori inseriti non è valido. Controlla la data, l’ora e gli altri campi, poi riprova.",
  });
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
  if (isAllDay) {
    return { date: formatItalianDateInput(value), time: "" };
  }

  return formatItalianDateTimeInput(value);
}

export {
  maskItalianDateInput,
  maskItalianTimeInput,
  parseItalianDateTime as parseEventDateTime,
} from "./italian-date";

export type { ItalianDateTimeInput };

/**
 * Validates a guest count entered by a member or received from the database.
 *
 * Accepted values are non-negative integers, either as numbers or as strings
 * containing only digits. Decimals, negatives, empty strings, `NaN`, and other
 * non-numeric input are rejected. There is deliberately no upper limit.
 */
export function validateGuestCount(value: unknown): GuestCountValidation {
  if (typeof value === "number") {
    if (Number.isFinite(value) && Number.isInteger(value) && value >= 0) {
      return { guestCount: value, error: null };
    }

    return { guestCount: null, error: GUEST_COUNT_ERROR_MESSAGE };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);

      if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
        return { guestCount: parsed, error: null };
      }
    }
  }

  return { guestCount: null, error: GUEST_COUNT_ERROR_MESSAGE };
}

/** Guests follow the member's status: only positive responses contribute. */
export function isPositiveResponseStatus(
  status: EventResponseStatus,
): boolean {
  return status === "present" || status === "tentative";
}

/**
 * Returns the guest count that contributes to attendance for a response.
 *
 * An absent response keeps its stored count in the database, but that count
 * is historical only and never adds to the totals.
 */
export function getContributingGuestCount(
  status: EventResponseStatus,
  guestCount: number,
): number {
  if (!isPositiveResponseStatus(status)) return 0;

  return Number.isInteger(guestCount) && guestCount > 0 ? guestCount : 0;
}

/**
 * Aggregates members and guests per status.
 *
 * Members are always counted by their own status. Guests are counted only for
 * `present` and `tentative` responses and are reported separately for each.
 * Rows whose `user_id` is `NULL` (deleted members) are included.
 */
export function summarizeEventAttendance(
  responses: ReadonlyArray<EventAttendanceEntry>,
): EventAttendanceSummary {
  let presentMembers = 0;
  let tentativeMembers = 0;
  let absentMembers = 0;
  let presentGuests = 0;
  let tentativeGuests = 0;

  for (const response of responses) {
    switch (response.status) {
      case "present":
        presentMembers += 1;
        presentGuests += getContributingGuestCount(
          response.status,
          response.guest_count,
        );
        break;
      case "tentative":
        tentativeMembers += 1;
        tentativeGuests += getContributingGuestCount(
          response.status,
          response.guest_count,
        );
        break;
      case "absent":
        absentMembers += 1;
        break;
    }
  }

  const positiveMembers = presentMembers + tentativeMembers;
  const totalGuests = presentGuests + tentativeGuests;

  return {
    presentMembers,
    tentativeMembers,
    absentMembers,
    presentGuests,
    tentativeGuests,
    positiveMembers,
    totalGuests,
    totalAttendees: positiveMembers + totalGuests,
  };
}

/** Formats the administrator total, e.g. `Totale: 20 (8 soci + 12 invitati)`. */
export function formatAttendanceTotal(
  summary: EventAttendanceSummary,
): string {
  return `Totale: ${summary.totalAttendees} (${summary.positiveMembers} soci + ${summary.totalGuests} invitati)`;
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

/**
 * Creates or updates the signed-in member's response for one event.
 *
 * `guestCount` is stored even when the status is `absent`, so switching back
 * to a positive status does not lose the declared guests. Guests only
 * contribute to attendance totals for positive statuses.
 */
export async function saveEventResponse(
  eventId: string,
  userId: string,
  status: EventResponseStatus,
  guestCount: number,
): Promise<{ response: EventResponseRecord | null; error: string | null }> {
  const validation = validateGuestCount(guestCount);

  if (validation.error !== null) {
    return { response: null, error: validation.error };
  }

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
          guest_count: validation.guestCount,
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
