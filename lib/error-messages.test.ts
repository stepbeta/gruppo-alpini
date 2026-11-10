import { describe, expect, it } from "vitest";
import {
  formatFriendlyError,
  NETWORK_ERROR_MESSAGE,
  SESSION_ERROR_MESSAGE,
} from "./error-messages";

const options = {
  fallback: "Operazione non riuscita. Riprova.",
  permission: "Permesso negato.",
  missingTable: "Tabella non disponibile.",
  duplicate: "Elemento già presente.",
  checkConstraint: "Valori non validi.",
  invalidInput: "Input non valido.",
};

const fallbackOnly = { fallback: "Operazione non riuscita. Riprova." };

describe("formatFriendlyError", () => {
  it("returns the fallback for an empty or whitespace-only message", () => {
    expect(formatFriendlyError("", options)).toBe(options.fallback);
    expect(formatFriendlyError("   ", options)).toBe(options.fallback);
    expect(formatFriendlyError("\n\t", options)).toBe(options.fallback);
  });

  it.each([
    "Failed to fetch",
    "TypeError: fetch failed",
    "NetworkError when attempting to fetch resource",
    "A network error occurred",
    "Load failed",
    "You are offline",
  ])("translates the network failure %j", (message) => {
    expect(formatFriendlyError(message, options)).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it.each([
    "JWT expired",
    "Invalid JWT",
    "Auth session missing!",
    "Session missing",
    "Invalid refresh token: refresh token not found",
    "La sessione scaduta, accedi di nuovo",
  ])("translates the expired-session failure %j", (message) => {
    expect(formatFriendlyError(message, options)).toBe(
      SESSION_ERROR_MESSAGE,
    );
  });

  it.each([
    "timeout while contacting the server",
    "The request timed out",
    "temporarily unavailable",
    "Service unavailable",
    "Bad gateway",
    "Gateway timeout",
  ])("translates the transient service failure %j", (message) => {
    expect(formatFriendlyError(message, options)).toBe(
      "Il servizio non risponde in questo momento. Attendi qualche istante e riprova.",
    );
  });

  it.each([
    'permission denied for table "events"',
    "SQLSTATE 42501",
    'new row violates row-level security policy for table "events"',
    'blocked by RLS policy "events_select"',
  ])("maps the permission failure %j to the context message", (message) => {
    expect(formatFriendlyError(message, options)).toBe(options.permission);
  });

  it("uses the default permission guidance when no context message exists", () => {
    expect(formatFriendlyError("permission denied for table", fallbackOnly)).toBe(
      "Non hai i permessi per questa operazione. Se il problema continua, contatta un amministratore.",
    );
  });

  it.each([
    'relation "public.events" does not exist',
    'column "approval_status" does not exist',
    'Could not find the table "public.events" in the schema cache',
    "schema cache is stale",
    "PGRST205",
    "PGRST204",
    "SQLSTATE 42703",
  ])("maps the missing-migration failure %j to the context message", (message) => {
    expect(formatFriendlyError(message, options)).toBe(options.missingTable);
  });

  it("uses the default missing-migration guidance when no context message exists", () => {
    expect(formatFriendlyError("PGRST205", fallbackOnly)).toBe(
      "La funzione non è ancora disponibile. Contatta un amministratore.",
    );
  });

  it.each([
    "duplicate key value violates unique constraint",
    'unique constraint "profiles_pkey" violated',
    "SQLSTATE 23505",
  ])("maps the duplicate failure %j to the context message", (message) => {
    expect(formatFriendlyError(message, options)).toBe(options.duplicate);
  });

  it("uses the default duplicate guidance when no context message exists", () => {
    expect(formatFriendlyError("SQLSTATE 23505", fallbackOnly)).toBe(
      "Esiste già un elemento con questi dati. Ricarica la pagina e riprova.",
    );
  });

  it.each([
    'new row violates check constraint "events_title_not_blank"',
    "SQLSTATE 23514",
  ])("maps the check-constraint failure %j to the context message", (message) => {
    expect(formatFriendlyError(message, options)).toBe(
      options.checkConstraint,
    );
  });

  it("uses the default check-constraint guidance when no context message exists", () => {
    expect(formatFriendlyError("SQLSTATE 23514", fallbackOnly)).toBe(
      "Uno o più valori non sono validi. Controlla i campi e riprova.",
    );
  });

  it.each([
    'null value in column "full_name" violates not-null constraint',
    "not-null constraint violation",
    "SQLSTATE 23502",
  ])("maps the missing-required-value failure %j", (message) => {
    expect(formatFriendlyError(message, options)).toBe(
      "Manca un dato obbligatorio. Compila tutti i campi richiesti e riprova.",
    );
  });

  it.each([
    "value too long for type character varying(80)",
    "SQLSTATE 22001",
  ])("maps the oversized-value failure %j", (message) => {
    expect(formatFriendlyError(message, options)).toBe(
      "Uno dei testi inseriti è troppo lungo. Accorcialo e riprova.",
    );
  });

  it.each([
    'insert or update on table "event_responses" violates foreign key constraint "event_responses_event_id_fkey"',
    "SQLSTATE 23503",
  ])("maps the stale-reference failure %j", (message) => {
    expect(formatFriendlyError(message, options)).toBe(
      "Il dato collegato non è più disponibile. Ricarica la pagina e riprova.",
    );
  });

  it.each([
    'invalid input syntax for type timestamp with time zone: "abc"',
    "SQLSTATE 22P02",
    "SQLSTATE 22007",
  ])("maps the invalid-input failure %j to the context message", (message) => {
    expect(formatFriendlyError(message, options)).toBe(options.invalidInput);
  });

  it("uses the default invalid-input guidance when no context message exists", () => {
    expect(formatFriendlyError("SQLSTATE 22P02", fallbackOnly)).toBe(
      "Uno dei valori inseriti non è valido. Controlla i campi e riprova.",
    );
  });

  it("explains a missing Supabase configuration", () => {
    expect(formatFriendlyError("Supabase non configurato.", options)).toBe(
      "Il collegamento al database non è configurato. Contatta un amministratore.",
    );
  });

  it("keeps already-friendly application messages", () => {
    expect(
      formatFriendlyError("Inserisci il titolo dell’evento.", options),
    ).toBe("Inserisci il titolo dell’evento.");
  });

  it("trims an already-friendly application message", () => {
    expect(formatFriendlyError("  Inserisci il titolo.  ", options)).toBe(
      "Inserisci il titolo.",
    );
  });

  it.each([
    "unexpected pgrst response",
    "postgrest returned an unknown status",
    "SQLSTATE XX000",
    "row violates an internal rule",
    "custom constraint failed",
    "column mapping failed",
    "relation permissions changed",
    "schema mismatch",
    "jwt malformed",
    "supabase client unavailable",
    "unexpected error 12345",
  ])("hides the technical detail %j behind the fallback", (message) => {
    expect(formatFriendlyError(message, options)).toBe(options.fallback);
  });

  it("does not treat a longer digit sequence as a SQLSTATE", () => {
    expect(formatFriendlyError("unexpected error 123456", options)).toBe(
      "unexpected error 123456",
    );
  });

  it("returns unknown non-technical messages unchanged", () => {
    expect(formatFriendlyError("Operazione annullata.", options)).toBe(
      "Operazione annullata.",
    );
  });
});
