/**
 * Shared translations for technical Supabase/PostgREST failures.
 *
 * The UI should never show raw database wording to members. Each feature can
 * pass its own context-specific messages, while this helper covers the common
 * network, session, permission, migration and constraint cases.
 */

export const NETWORK_ERROR_MESSAGE =
  "Errore di rete. Controlla la connessione e riprova.";

export const SESSION_ERROR_MESSAGE =
  "La sessione è scaduta. Accedi di nuovo e riprova.";

type FriendlyErrorOptions = {
  /** Message used when the failure cannot be classified safely. */
  fallback: string;
  permission?: string;
  missingTable?: string;
  duplicate?: string;
  checkConstraint?: string;
  invalidInput?: string;
};

function isTechnicalMessage(message: string): boolean {
  return (
    message.includes("pgrst") ||
    message.includes("postgrest") ||
    message.includes("sqlstate") ||
    message.includes("violates") ||
    message.includes("constraint") ||
    message.includes("column") ||
    message.includes("relation") ||
    message.includes("schema") ||
    message.includes("jwt") ||
    message.includes("supabase") ||
    /\b\d{5}\b/.test(message)
  );
}

/**
 * Converts common Supabase/PostgREST errors into polite Italian guidance.
 *
 * Already-friendly application messages are returned unchanged, so form
 * validation and feature-specific notices keep their original wording.
 */
export function formatFriendlyError(
  message: string,
  options: FriendlyErrorOptions,
): string {
  const trimmed = message.trim();
  const normalized = trimmed.toLowerCase();

  if (!normalized) return options.fallback;

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("network error") ||
    normalized.includes("load failed") ||
    normalized.includes("offline")
  ) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (
    normalized.includes("jwt expired") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("auth session missing") ||
    normalized.includes("session missing") ||
    normalized.includes("refresh token") ||
    normalized.includes("sessione scaduta")
  ) {
    return SESSION_ERROR_MESSAGE;
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("service unavailable") ||
    normalized.includes("bad gateway") ||
    normalized.includes("gateway timeout")
  ) {
    return "Il servizio non risponde in questo momento. Attendi qualche istante e riprova.";
  }

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("row-level security") ||
    normalized.includes("rls policy")
  ) {
    return (
      options.permission ??
      "Non hai i permessi per questa operazione. Se il problema continua, contatta un amministratore."
    );
  }

  if (
    (normalized.includes("relation") && normalized.includes("does not exist")) ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache") ||
    normalized.includes("pgrst205") ||
    normalized.includes("pgrst204") ||
    normalized.includes("42703")
  ) {
    return (
      options.missingTable ??
      "La funzione non è ancora disponibile. Contatta un amministratore."
    );
  }

  if (
    normalized.includes("duplicate key") ||
    normalized.includes("unique constraint") ||
    normalized.includes("23505")
  ) {
    return (
      options.duplicate ??
      "Esiste già un elemento con questi dati. Ricarica la pagina e riprova."
    );
  }

  if (
    normalized.includes("violates check constraint") ||
    normalized.includes("23514")
  ) {
    return (
      options.checkConstraint ??
      "Uno o più valori non sono validi. Controlla i campi e riprova."
    );
  }

  if (
    normalized.includes("null value in column") ||
    normalized.includes("not-null constraint") ||
    normalized.includes("23502")
  ) {
    return "Manca un dato obbligatorio. Compila tutti i campi richiesti e riprova.";
  }

  if (
    normalized.includes("value too long") ||
    normalized.includes("22001")
  ) {
    return "Uno dei testi inseriti è troppo lungo. Accorcialo e riprova.";
  }

  if (
    normalized.includes("foreign key") ||
    normalized.includes("23503")
  ) {
    return "Il dato collegato non è più disponibile. Ricarica la pagina e riprova.";
  }

  if (
    normalized.includes("invalid input syntax") ||
    normalized.includes("22p02") ||
    normalized.includes("22007")
  ) {
    return (
      options.invalidInput ??
      "Uno dei valori inseriti non è valido. Controlla i campi e riprova."
    );
  }

  if (normalized.includes("supabase non configurato")) {
    return "Il collegamento al database non è configurato. Contatta un amministratore.";
  }

  if (isTechnicalMessage(normalized)) return options.fallback;

  return trimmed;
}
