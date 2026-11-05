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

describe("formatFriendlyError", () => {
  it("translates common network failures", () => {
    expect(formatFriendlyError("Failed to fetch", options)).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it("translates expired sessions", () => {
    expect(formatFriendlyError("JWT expired", options)).toBe(
      SESSION_ERROR_MESSAGE,
    );
  });

  it("maps missing tables and columns to the context message", () => {
    expect(
      formatFriendlyError('column "approval_status" does not exist', options),
    ).toBe(options.missingTable);
  });

  it("maps permission and constraint failures", () => {
    expect(
      formatFriendlyError(
        'new row violates row-level security policy for table "events"',
        options,
      ),
    ).toBe(options.permission);

    expect(
      formatFriendlyError(
        'new row violates check constraint "events_title_not_blank"',
        options,
      ),
    ).toBe(options.checkConstraint);
  });

  it("keeps already-friendly application messages", () => {
    expect(
      formatFriendlyError("Inserisci il titolo dell’evento.", options),
    ).toBe("Inserisci il titolo dell’evento.");
  });

  it("hides unknown technical details behind the fallback", () => {
    expect(
      formatFriendlyError('relation "public.events" is unavailable', options),
    ).toBe(options.fallback);
  });
});
