/**
 * Shared helpers for the Italian date/time text inputs used across the portal.
 *
 * Native date and datetime widgets render in the browser locale, so every
 * form uses masked text fields with the same `gg/mm/aaaa` and `HH:mm` rules.
 * Keeping parsing and formatting here avoids subtle differences between the
 * event, profile and announcement forms.
 */

export type ItalianDateParts = {
  day: number;
  month: number;
  year: number;
};

export type ItalianTimeParts = {
  hours: number;
  minutes: number;
};

export type ItalianDateTimeInput = {
  date: string;
  time: string;
};

export type ParsedItalianDateTime = {
  date: Date;
  isAllDay: boolean;
};

export type OptionalItalianDateTime = {
  date: Date | null;
  isValid: boolean;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Keeps typed/pasted dates in the visible `gg/mm/aaaa` shape. */
export function maskItalianDateInput(value: string): string {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(trimmed);

  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

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

/**
 * Parses the strict Italian date format `gg/mm/aaaa`.
 *
 * Impossible dates such as 31/02/2026 and non-leap 29/02 return `null`.
 */
export function parseItalianDateParts(
  value: string,
): ItalianDateParts | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

/** Parses a strict 24-hour `HH:mm` value. */
export function parseItalianTimeParts(
  value: string,
): ItalianTimeParts | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return { hours, minutes };
}

/**
 * Parses a `gg/mm/aaaa` date plus a required `HH:mm` time as a local date.
 *
 * The local-time round trip also rejects times that do not exist because of a
 * daylight-saving transition.
 */
export function parseItalianDateTimeToLocal(
  dateValue: string,
  timeValue: string,
): Date | null {
  const dateParts = parseItalianDateParts(dateValue);
  const timeParts = parseItalianTimeParts(timeValue);

  if (!dateParts || !timeParts) return null;

  const date = new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hours,
    timeParts.minutes,
    0,
    0,
  );

  if (
    date.getFullYear() !== dateParts.year ||
    date.getMonth() !== dateParts.month - 1 ||
    date.getDate() !== dateParts.day ||
    date.getHours() !== timeParts.hours ||
    date.getMinutes() !== timeParts.minutes
  ) {
    return null;
  }

  return date;
}

/**
 * Parses the event date format: `gg/mm/aaaa` plus an optional `HH:mm`.
 *
 * An empty time produces an all-day event stored at UTC midnight. Impossible
 * dates such as 31/02/2026 and invalid 24-hour times such as 25:00 return
 * `null`.
 */
export function parseItalianDateTime(
  dateValue: string,
  timeValue: string,
): ParsedItalianDateTime | null {
  const dateParts = parseItalianDateParts(dateValue);
  if (!dateParts) return null;

  const trimmedTime = timeValue.trim();

  if (!trimmedTime) {
    const date = new Date(
      Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0, 0),
    );

    return { date, isAllDay: true };
  }

  const date = parseItalianDateTimeToLocal(dateValue, trimmedTime);
  if (!date) return null;

  return { date, isAllDay: false };
}

/**
 * Parses an optional date/time window.
 *
 * Both fields must be empty (no limit) or both must be filled with a valid
 * date and time. This matches the announcement start/end semantics.
 */
export function parseOptionalItalianDateTime(
  dateValue: string,
  timeValue: string,
): OptionalItalianDateTime {
  const trimmedDate = dateValue.trim();
  const trimmedTime = timeValue.trim();

  if (!trimmedDate && !trimmedTime) {
    return { date: null, isValid: true };
  }

  if (!trimmedDate || !trimmedTime) {
    return { date: null, isValid: false };
  }

  const date = parseItalianDateTimeToLocal(trimmedDate, trimmedTime);

  return date ? { date, isValid: true } : { date: null, isValid: false };
}

/** Converts a valid `gg/mm/aaaa` date into the stored `YYYY-MM-DD` shape. */
export function parseItalianDateToIsoDate(value: string): string | null {
  const parts = parseItalianDateParts(value);
  if (!parts) return null;

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/**
 * Converts a stored `YYYY-MM-DD` date or a UTC-midnight timestamp into the
 * visible `gg/mm/aaaa` shape.
 */
export function formatItalianDateInput(
  value: string | null | undefined,
): string {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return formatIsoDateAsItalian(value);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

/** Converts a stored `YYYY-MM-DD` date into the visible `gg/mm/aaaa` shape. */
function formatIsoDateAsItalian(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return `${pad2(day)}/${pad2(month)}/${year}`;
}

/** Prefills the masked date/time fields from a stored local timestamp. */
export function formatItalianDateTimeInput(
  value: string | null | undefined,
): ItalianDateTimeInput {
  if (!value) return { date: "", time: "" };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };

  return {
    date: `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}
