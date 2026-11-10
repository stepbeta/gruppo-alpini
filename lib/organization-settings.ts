import {
  ORGANIZATION_SETTINGS_CHECK_ERROR_MESSAGE,
  ORGANIZATION_SETTINGS_INVALID_INPUT_ERROR_MESSAGE,
  ORGANIZATION_SETTINGS_MISSING_TABLE_ERROR_MESSAGE,
  ORGANIZATION_SETTINGS_PERMISSION_ERROR_MESSAGE,
  ORGANIZATION_SETTINGS_SAVE_ERROR_MESSAGE,
  formatFriendlyError,
} from "./error-messages";
import { supabase } from "./supabase";

/**
 * Administrator write path for the public controller details.
 *
 * The public `/privacy` page reads the same row through the cached
 * `getOrganizationSettings()` helper. This module is deliberately client-side
 * and only ever UPDATEs the existing `id = true` row: the database grants no
 * INSERT or DELETE, so the single-row invariant cannot be bypassed here.
 *
 * A future audit table (roadmap 5.3) can observe these writes through the
 * `updated_at` trigger; the form does not send `updated_at` or `id`.
 */
export const ORGANIZATION_SETTINGS_COLUMNS =
  "id, organization_name, address, contact_email, dpo_email, updated_at";

export type OrganizationSettingsRow = {
  id: boolean;
  organization_name: string;
  address: string | null;
  contact_email: string | null;
  dpo_email: string | null;
  updated_at: string;
};

export type OrganizationSettingsInput = {
  organization_name: string;
  address: string | null;
  contact_email: string | null;
  dpo_email: string | null;
};

export type OrganizationSettingsFormValues = {
  organization_name: string;
  address: string;
  contact_email: string;
  dpo_email: string;
};

export const EMPTY_ORGANIZATION_SETTINGS_FORM: OrganizationSettingsFormValues = {
  organization_name: "",
  address: "",
  contact_email: "",
  dpo_email: "",
};

export function organizationSettingsToForm(
  settings: OrganizationSettingsRow,
): OrganizationSettingsFormValues {
  return {
    organization_name: settings.organization_name,
    address: settings.address ?? "",
    contact_email: settings.contact_email ?? "",
    dpo_email: settings.dpo_email ?? "",
  };
}

/** Trims the form and turns empty optional fields into NULL for Postgres. */
export function normalizeOrganizationSettingsInput(
  values: OrganizationSettingsFormValues,
): OrganizationSettingsInput {
  return {
    organization_name: values.organization_name.trim(),
    address: values.address.trim() || null,
    contact_email: values.contact_email.trim() || null,
    dpo_email: values.dpo_email.trim() || null,
  };
}

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Client-side validation for the administrator form.
 *
 * The database also rejects a blank name; these messages exist so the browser
 * can explain the problem before a request is made, with `noValidate` forms and
 * Italian wording independent of the browser language.
 */
export function validateOrganizationSettings(
  values: OrganizationSettingsFormValues,
): string | null {
  if (!values.organization_name.trim()) {
    return "Inserisci il nome del titolare del trattamento.";
  }

  if (
    values.contact_email.trim() &&
    !isValidEmailAddress(values.contact_email)
  ) {
    return "Inserisci un indirizzo email valido per il contatto del titolare, oppure lascia il campo vuoto.";
  }

  if (values.dpo_email.trim() && !isValidEmailAddress(values.dpo_email)) {
    return "Inserisci un indirizzo email valido per il DPO, oppure lascia il campo vuoto.";
  }

  return null;
}

const updatedAtFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

/** Formats the database-owned timestamp shown to administrators. */
export function formatOrganizationSettingsUpdatedAt(
  value: string | null,
): string {
  if (!value) return "non disponibile";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "non disponibile";

  return updatedAtFormatter.format(date);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

/**
 * Turns the Postgres failures this table can produce into Italian guidance.
 *
 * Italian messages raised by the single-row trigger are returned verbatim by
 * `formatFriendlyError`, following the same policy used for the administrator
 * cap and self-demotion triggers.
 */
export function formatOrganizationSettingsError(message: string): string {
  return formatFriendlyError(message, {
    fallback: ORGANIZATION_SETTINGS_SAVE_ERROR_MESSAGE,
    permission: ORGANIZATION_SETTINGS_PERMISSION_ERROR_MESSAGE,
    missingTable: ORGANIZATION_SETTINGS_MISSING_TABLE_ERROR_MESSAGE,
    checkConstraint: ORGANIZATION_SETTINGS_CHECK_ERROR_MESSAGE,
    invalidInput: ORGANIZATION_SETTINGS_INVALID_INPUT_ERROR_MESSAGE,
  });
}

/**
 * Reads the single row for the administrator form.
 *
 * SELECT is public by design; the administrator check is enforced by the page
 * and, for writes, by the database policy. The helper never inserts a missing
 * row, because only the seeded row may exist.
 */
export async function fetchOrganizationSettingsForAdmin(): Promise<{
  settings: OrganizationSettingsRow | null;
  error: string | null;
}> {
  if (!supabase) {
    return { settings: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("organization_settings")
      .select(ORGANIZATION_SETTINGS_COLUMNS)
      .eq("id", true)
      .maybeSingle();

    if (error) {
      return { settings: null, error: error.message };
    }

    return { settings: (data as OrganizationSettingsRow | null) ?? null, error: null };
  } catch (error) {
    return { settings: null, error: errorMessage(error) };
  }
}

/**
 * Updates the existing organization-settings row.
 *
 * `updated_at` is intentionally omitted: the BEFORE UPDATE trigger owns it, and
 * the column grant does not allow the browser to write it. `.maybeSingle()`
 * returns no row if the seed is missing; the caller shows an error instead of
 * trying an INSERT.
 */
export async function saveOrganizationSettings(
  input: OrganizationSettingsInput,
): Promise<{ settings: OrganizationSettingsRow | null; error: string | null }> {
  if (!supabase) {
    return { settings: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("organization_settings")
      .update(input)
      .eq("id", true)
      .select(ORGANIZATION_SETTINGS_COLUMNS)
      .maybeSingle();

    if (error) {
      return { settings: null, error: error.message };
    }

    if (!data) {
      return {
        settings: null,
        error:
          "La riga delle impostazioni privacy non è disponibile. Applica le migrazioni Supabase con npm run db:push.",
      };
    }

    return { settings: data as OrganizationSettingsRow, error: null };
  } catch (error) {
    return { settings: null, error: errorMessage(error) };
  }
}
