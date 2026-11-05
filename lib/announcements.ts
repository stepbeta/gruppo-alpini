import { supabase } from "./supabase";

export type Announcement = {
  id: string;
  message: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type AnnouncementInput = {
  message: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

export type AnnouncementState =
  | "active"
  | "scheduled"
  | "expired"
  | "inactive";

/** Time-only classification, independent from the manual activation flag. */
export type AnnouncementWindowState = "scheduled" | "open" | "expired";

export type AnnouncementFilter = "all" | "active" | "past";

export const ANNOUNCEMENT_STATE_LABELS: Record<AnnouncementState, string> = {
  active: "Attivo",
  scheduled: "In programma",
  expired: "Scaduto",
  inactive: "Disattivato",
};

const ANNOUNCEMENT_COLUMNS =
  "id, message, start_date, end_date, is_active, created_by, created_at";

/**
 * Dispatched after a successful create/update/delete. The header banner
 * listens for it so the admin page updates the visible banner without a reload.
 */
export const ANNOUNCEMENTS_CHANGED_EVENT =
  "gruppo-alpini:announcements-changed";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

function notifyAnnouncementsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ANNOUNCEMENTS_CHANGED_EVENT));
}

/** Turns the most common Supabase/PostgREST errors into Italian messages. */
export function formatAnnouncementError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("row-level security")
  ) {
    return "Non hai i permessi per gestire gli avvisi. Solo gli amministratori possono farlo.";
  }

  if (
    (normalized.includes("relation") &&
      normalized.includes("does not exist")) ||
    normalized.includes("could not find the table") ||
    normalized.includes("pgrst205") ||
    normalized.includes("schema cache")
  ) {
    return "La tabella degli avvisi non è ancora disponibile. Applica le migrazioni Supabase.";
  }

  if (normalized.includes("violates check constraint")) {
    return "Controlla il testo e le date dell’avviso, poi riprova.";
  }

  if (normalized.includes("invalid input syntax")) {
    return "Uno dei valori inseriti non è valido. Controlla le date e riprova.";
  }

  return "Impossibile completare l’operazione sugli avvisi. Riprova o contatta un amministratore.";
}

/**
 * Classifies the optional date window without considering `is_active`.
 *
 * Keeping the window separate from the activation flag matters for recurring
 * notices: an expired banner that is still toggled on must not be presented as
 * live, while a deactivated banner with a future window is not "past" yet.
 */
export function getAnnouncementWindowState(
  announcement: Pick<Announcement, "start_date" | "end_date">,
  now = Date.now(),
): AnnouncementWindowState {
  const start = announcement.start_date
    ? Date.parse(announcement.start_date)
    : null;
  const end = announcement.end_date ? Date.parse(announcement.end_date) : null;

  if (start !== null && !Number.isNaN(start) && now < start) {
    return "scheduled";
  }

  if (end !== null && !Number.isNaN(end) && now > end) return "expired";

  return "open";
}

/**
 * Returns true when the banner is active and the current time is inside its
 * optional [start_date, end_date] window. Invalid stored dates are ignored so
 * a malformed row never breaks every authenticated page.
 */
export function isAnnouncementVisible(
  announcement: Pick<Announcement, "is_active" | "start_date" | "end_date">,
  now = Date.now(),
): boolean {
  if (!announcement.is_active) return false;

  return getAnnouncementWindowState(announcement, now) === "open";
}

/** Classifies a banner for the administration interface. */
export function getAnnouncementState(
  announcement: Pick<Announcement, "is_active" | "start_date" | "end_date">,
  now = Date.now(),
): AnnouncementState {
  if (!announcement.is_active) return "inactive";

  const windowState = getAnnouncementWindowState(announcement, now);
  if (windowState === "scheduled") return "scheduled";
  if (windowState === "expired") return "expired";

  return "active";
}

/**
 * Applies the management page filters.
 *
 * `active` means visible right now. `past` groups every banner whose
 * publication window is over, even when the activation flag is still on, so a
 * re-enabled recurring notice is not mistaken for a live one. Scheduled and
 * manually deactivated banners remain available under `all`.
 */
export function matchesAnnouncementFilter(
  announcement: Pick<Announcement, "is_active" | "start_date" | "end_date">,
  filter: AnnouncementFilter,
  now = Date.now(),
): boolean {
  if (filter === "all") return true;
  if (filter === "active") return isAnnouncementVisible(announcement, now);

  return getAnnouncementWindowState(announcement, now) === "expired";
}

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

/** Formats a banner timestamp as `dd/mm/yyyy, HH:mm` in Italian local time. */
export function formatAnnouncementDate(value: string | null): string {
  if (!value) return "Sempre";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data non valida";

  return dateFormatter.format(date);
}

/** Human-readable summary of the optional display window. */
export function formatAnnouncementWindow(
  announcement: Pick<Announcement, "start_date" | "end_date">,
): string {
  if (!announcement.start_date && !announcement.end_date) {
    return "Senza limiti di tempo";
  }

  if (announcement.start_date && announcement.end_date) {
    return `Dal ${formatAnnouncementDate(
      announcement.start_date,
    )} al ${formatAnnouncementDate(announcement.end_date)}`;
  }

  if (announcement.start_date) {
    return `Dal ${formatAnnouncementDate(announcement.start_date)}`;
  }

  return `Fino al ${formatAnnouncementDate(announcement.end_date)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Converts an ISO timestamp to the value expected by `<input type="datetime-local">`. */
export function toDateTimeLocalValue(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Converts a `<input type="datetime-local">` value into an ISO timestamp.
 * An empty value is valid and means “no limit”.
 */
export function parseDateTimeLocalValue(value: string): {
  iso: string | null;
  isValid: boolean;
} {
  const trimmed = value.trim();
  if (!trimmed) return { iso: null, isValid: true };

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return { iso: null, isValid: false };
  }

  return { iso: date.toISOString(), isValid: true };
}

/** Reads every banner visible to the signed-in user (administrators see all). */
export async function fetchAnnouncements(): Promise<{
  announcements: Announcement[];
  error: string | null;
}> {
  if (!supabase) {
    return { announcements: [], error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("announcement_banners")
      .select(ANNOUNCEMENT_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      return { announcements: [], error: error.message };
    }

    return {
      announcements: (data as Announcement[] | null) ?? [],
      error: null,
    };
  } catch (error) {
    return { announcements: [], error: errorMessage(error) };
  }
}

/**
 * Returns the banner that should be shown right now.
 *
 * The database already hides inactive/out-of-window rows from regular members;
 * filtering again in the browser keeps administrators on the same rule and
 * makes the “most recent visible” choice explicit.
 */
export async function fetchCurrentAnnouncement(): Promise<{
  announcement: Announcement | null;
  error: string | null;
}> {
  if (!supabase) {
    return { announcement: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("announcement_banners")
      .select(ANNOUNCEMENT_COLUMNS)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return { announcement: null, error: error.message };
    }

    const now = Date.now();
    const announcements = (data as Announcement[] | null) ?? [];
    const current =
      announcements.find((announcement) =>
        isAnnouncementVisible(announcement, now),
      ) ?? null;

    return { announcement: current, error: null };
  } catch (error) {
    return { announcement: null, error: errorMessage(error) };
  }
}

export async function createAnnouncement(
  input: AnnouncementInput,
): Promise<{ announcement: Announcement | null; error: string | null }> {
  if (!supabase) {
    return { announcement: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("announcement_banners")
      .insert({
        message: input.message.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        is_active: input.is_active,
      })
      .select(ANNOUNCEMENT_COLUMNS)
      .single();

    if (error) {
      return { announcement: null, error: error.message };
    }

    notifyAnnouncementsChanged();
    return { announcement: data as Announcement, error: null };
  } catch (error) {
    return { announcement: null, error: errorMessage(error) };
  }
}

export async function updateAnnouncement(
  announcementId: string,
  input: AnnouncementInput,
): Promise<{ announcement: Announcement | null; error: string | null }> {
  if (!supabase) {
    return { announcement: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("announcement_banners")
      .update({
        message: input.message.trim(),
        start_date: input.start_date,
        end_date: input.end_date,
        is_active: input.is_active,
      })
      .eq("id", announcementId)
      .select(ANNOUNCEMENT_COLUMNS)
      .single();

    if (error) {
      return { announcement: null, error: error.message };
    }

    notifyAnnouncementsChanged();
    return { announcement: data as Announcement, error: null };
  } catch (error) {
    return { announcement: null, error: errorMessage(error) };
  }
}

export async function setAnnouncementActive(
  announcementId: string,
  isActive: boolean,
): Promise<{ announcement: Announcement | null; error: string | null }> {
  if (!supabase) {
    return { announcement: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("announcement_banners")
      .update({ is_active: isActive })
      .eq("id", announcementId)
      .select(ANNOUNCEMENT_COLUMNS)
      .single();

    if (error) {
      return { announcement: null, error: error.message };
    }

    notifyAnnouncementsChanged();
    return { announcement: data as Announcement, error: null };
  } catch (error) {
    return { announcement: null, error: errorMessage(error) };
  }
}

export async function deleteAnnouncement(
  announcementId: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase non configurato." };
  }

  try {
    const { error } = await supabase
      .from("announcement_banners")
      .delete()
      .eq("id", announcementId);

    if (error) {
      return { error: error.message };
    }

    notifyAnnouncementsChanged();
    return { error: null };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
