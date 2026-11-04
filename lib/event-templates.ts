import { formatEventDateInput, type EventRecord } from "./events";
import { supabase } from "./supabase";

export type EventTemplate = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  is_all_day: boolean;
  default_time: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventTemplateInput = {
  title: string;
  description: string | null;
  location: string | null;
  is_all_day: boolean;
  default_time: string | null;
};

export type EventTemplateResult = {
  template: EventTemplate | null;
  error: string | null;
};

export type EventTemplatesResult = {
  templates: EventTemplate[];
  error: string | null;
};

const EVENT_TEMPLATE_COLUMNS =
  "id, title, description, location, is_all_day, default_time, created_by, created_at, updated_at";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Turns the most common Supabase/PostgREST errors into Italian messages. */
export function formatEventTemplateError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("row-level security")
  ) {
    return "Non hai i permessi per gestire i modelli evento. Solo gli amministratori possono farlo.";
  }

  if (
    (normalized.includes("relation") &&
      normalized.includes("does not exist")) ||
    normalized.includes("could not find the table") ||
    normalized.includes("pgrst205") ||
    normalized.includes("schema cache")
  ) {
    return "La tabella dei modelli evento non è ancora disponibile. Applica le migrazioni Supabase.";
  }

  if (normalized.includes("violates check constraint")) {
    return "Controlla il titolo e l’orario del modello, poi riprova.";
  }

  if (normalized.includes("invalid input syntax")) {
    return "Uno dei valori inseriti non è valido. Controlla i campi e riprova.";
  }

  return "Impossibile completare l’operazione sui modelli evento. Riprova o contatta un amministratore.";
}

/**
 * Normalizes a stored or typed time to `HH:mm`.
 *
 * PostgreSQL returns `HH:mm:ss`, while the form edits `HH:mm`. Invalid values,
 * including impossible times such as `24:00`, return `null`.
 */
export function normalizeEventTemplateTime(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return `${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * Converts an existing event into template input.
 *
 * The date is intentionally dropped: a template is reusable, while each event
 * still needs its own scheduled date.
 */
export function eventToTemplateInput(event: EventRecord): EventTemplateInput {
  const dateTime = formatEventDateInput(event.event_date, event.is_all_day);

  return {
    title: event.title,
    description: event.description,
    location: event.location,
    is_all_day: event.is_all_day,
    default_time: event.is_all_day
      ? null
      : normalizeEventTemplateTime(dateTime.time),
  };
}

/** Returns an Italian validation message, or null when the input is usable. */
export function validateEventTemplateInput(
  input: EventTemplateInput,
): string | null {
  if (!input.title.trim()) {
    return "Inserisci il titolo del modello.";
  }

  if (input.is_all_day && input.default_time) {
    return "Un modello di tutta la giornata non può avere un orario.";
  }

  if (!input.is_all_day && !normalizeEventTemplateTime(input.default_time)) {
    return "Inserisci un orario valido nel formato HH:mm (24 ore).";
  }

  return null;
}

function prepareTemplateInput(
  values: EventTemplateInput,
): EventTemplateInput {
  return {
    title: values.title.trim(),
    description: values.description?.trim() || null,
    location: values.location?.trim() || null,
    is_all_day: values.is_all_day,
    default_time: values.is_all_day
      ? null
      : normalizeEventTemplateTime(values.default_time),
  };
}

/** Loads every template visible to the signed-in administrator. */
export async function fetchEventTemplates(): Promise<EventTemplatesResult> {
  if (!supabase) {
    return { templates: [], error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("event_templates")
      .select(EVENT_TEMPLATE_COLUMNS)
      .order("title", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      return { templates: [], error: error.message };
    }

    return {
      templates: (data as EventTemplate[] | null) ?? [],
      error: null,
    };
  } catch (error) {
    return { templates: [], error: errorMessage(error) };
  }
}

/** Creates a reusable event template as an administrator. */
export async function createEventTemplate(
  values: EventTemplateInput,
): Promise<EventTemplateResult> {
  if (!supabase) {
    return { template: null, error: "Supabase non configurato." };
  }

  const input = prepareTemplateInput(values);
  const validationError = validateEventTemplateInput(input);

  if (validationError) {
    return { template: null, error: validationError };
  }

  try {
    const { data, error } = await supabase
      .from("event_templates")
      .insert(input)
      .select(EVENT_TEMPLATE_COLUMNS)
      .single();

    if (error) {
      return { template: null, error: error.message };
    }

    return { template: data as EventTemplate, error: null };
  } catch (error) {
    return { template: null, error: errorMessage(error) };
  }
}

/** Updates an existing template as an administrator. */
export async function updateEventTemplate(
  templateId: string,
  values: EventTemplateInput,
): Promise<EventTemplateResult> {
  if (!supabase) {
    return { template: null, error: "Supabase non configurato." };
  }

  const input = prepareTemplateInput(values);
  const validationError = validateEventTemplateInput(input);

  if (validationError) {
    return { template: null, error: validationError };
  }

  try {
    const { data, error } = await supabase
      .from("event_templates")
      .update(input)
      .eq("id", templateId)
      .select(EVENT_TEMPLATE_COLUMNS)
      .single();

    if (error) {
      return { template: null, error: error.message };
    }

    return { template: data as EventTemplate, error: null };
  } catch (error) {
    return { template: null, error: errorMessage(error) };
  }
}

/** Deletes a template as an administrator. */
export async function deleteEventTemplate(
  templateId: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase non configurato." };
  }

  try {
    const { error } = await supabase
      .from("event_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

/** Saves an existing event's reusable details as a new template. */
export async function createEventTemplateFromEvent(
  event: EventRecord,
): Promise<EventTemplateResult> {
  return createEventTemplate(eventToTemplateInput(event));
}
