import { supabase } from "./supabase";

export type EventResponseStatus = "present" | "tentative" | "absent";

export type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  created_by: string | null;
  created_at: string;
};

export type EventResponseRecord = {
  id: string;
  event_id: string;
  user_id: string;
  status: EventResponseStatus;
  updated_at: string;
};

export type EventInput = {
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
};

export type EventDateParts = {
  day: string;
  month: string;
  weekday: string;
  fullDate: string;
  time: string;
};

const EVENT_COLUMNS =
  "id, title, description, location, event_date, created_by, created_at";
const EVENT_RESPONSE_COLUMNS =
  "id, event_id, user_id, status, updated_at";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

/** Formats a database timestamp for the Italian event cards. */
export function formatEventDate(value: string): EventDateParts | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const day = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
  }).format(date);
  const month = new Intl.DateTimeFormat("it-IT", {
    month: "short",
  })
    .format(date)
    .replace(".", "");
  const weekday = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
  }).format(date);
  const fullDate = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return {
    day,
    month: month.toUpperCase(),
    weekday: capitalize(weekday),
    fullDate: capitalize(fullDate),
    time,
  };
}

export async function fetchEvents(): Promise<{
  events: EventRecord[];
  error: string | null;
}> {
  if (!supabase) {
    return { events: [], error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .order("event_date", { ascending: true });

    if (error) {
      return { events: [], error: error.message };
    }

    return { events: (data as EventRecord[] | null) ?? [], error: null };
  } catch (error) {
    return { events: [], error: errorMessage(error) };
  }
}

/**
 * Reads event responses allowed by RLS.
 *
 * Regular members receive only their own rows; administrators receive every
 * row so they can display attendance totals.
 */
export async function fetchEventResponses(): Promise<{
  responses: EventResponseRecord[];
  error: string | null;
}> {
  if (!supabase) {
    return { responses: [], error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("event_responses")
      .select(EVENT_RESPONSE_COLUMNS);

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

/** Creates an event as an administrator; RLS enforces the admin check. */
export async function createEvent(
  values: EventInput,
  createdBy: string,
): Promise<{ event: EventRecord | null; error: string | null }> {
  if (!supabase) {
    return { event: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .insert({
        ...values,
        created_by: createdBy,
      })
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
