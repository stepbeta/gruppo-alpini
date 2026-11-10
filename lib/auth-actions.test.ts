import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  RECOVERY_LINK_ERROR,
  formatAuthError,
  getAuthRedirectErrorMessage,
  getCredentialsProvider,
  isValidEmail,
} from "./auth-actions";

// auth-actions.ts imports the browser Supabase client. The functions under test
// are pure or browser-state readers, so replace it to keep the tests hermetic.
vi.mock("./supabase", () => ({ supabase: null }));

const RATE_LIMIT_ERROR =
  "Hai fatto troppe richieste. Attendi qualche minuto e riprova.";
const SESSION_ERROR = "La sessione è scaduta. Accedi di nuovo e riprova.";
const GENERIC_LINK_ERROR =
  "Il link è scaduto o non è più valido. Richiedine uno nuovo.";

function buildUser(overrides: {
  identities?: Array<{ provider: unknown }>;
  appMetadata?: Record<string, unknown>;
}): User {
  return {
    identities: overrides.identities ?? [],
    app_metadata: overrides.appMetadata ?? {},
  } as unknown as User;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isValidEmail", () => {
  it.each([
    "segreteria@example.it",
    "mario.rossi@example.com",
    "mario+tag@example.co.uk",
    "a@b.c",
    "USER@EXAMPLE.COM",
  ])("accepts the email shape %j", (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isValidEmail("  mario@example.it  ")).toBe(true);
    expect(isValidEmail("\tmario@example.it\n")).toBe(true);
  });

  it.each([
    "",
    "   ",
    "plainaddress",
    "@example.com",
    "user@",
    "user@example",
    "user@example.",
    "user@@example.com",
    "user name@example.com",
    "user@exa mple.com",
    "user@example.com extra",
    "user@example.com\nsecond-line",
  ])("rejects the malformed value %j", (value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it("rejects a domain that starts with a dot", () => {
    expect(isValidEmail("user@.com")).toBe(false);
  });
});

describe("formatAuthError rate limiting", () => {
  it.each(["over_email_send_rate_limit", "over_request_rate_limit"])(
    "maps the code %j",
    (code) => {
      expect(formatAuthError({ message: "", code })).toBe(RATE_LIMIT_ERROR);
    },
  );

  it.each([
    "Email rate limit exceeded",
    "For security purposes, you can only request this after 60 seconds",
  ])("maps the message %j", (message) => {
    expect(formatAuthError(message)).toBe(RATE_LIMIT_ERROR);
  });
});

describe("formatAuthError sessions", () => {
  it.each([
    "session_not_found",
    "session_expired",
    "refresh_token_not_found",
    "refresh_token_already_used",
    "bad_jwt",
    "no_authorization",
  ])("maps the code %j", (code) => {
    expect(formatAuthError({ message: "", code })).toBe(SESSION_ERROR);
  });

  it.each([
    "Auth session missing!",
    "Session missing",
    "Invalid refresh token",
    "Invalid JWT",
    "JWT expired",
  ])("maps the message %j", (message) => {
    expect(formatAuthError(message)).toBe(SESSION_ERROR);
  });
});

describe("formatAuthError links and access", () => {
  it.each(["otp_expired", "flow_state_expired"])(
    "maps the recovery code %j",
    (code) => {
      expect(
        formatAuthError({ message: "", code }, "recovery"),
      ).toBe(RECOVERY_LINK_ERROR);
    },
  );

  it.each([
    "Invalid link",
    "Expired token",
    "The link is invalid",
  ])("maps the generic link message %j", (message) => {
    expect(formatAuthError(message)).toBe(GENERIC_LINK_ERROR);
  });

  it("uses the recovery-specific link message in the recovery context", () => {
    expect(formatAuthError("Invalid link", "recovery")).toBe(
      RECOVERY_LINK_ERROR,
    );
  });

  it("maps access denied to the recovery link message", () => {
    expect(
      formatAuthError({ message: "", code: "access_denied" }),
    ).toBe(RECOVERY_LINK_ERROR);
    expect(formatAuthError("access_denied")).toBe(RECOVERY_LINK_ERROR);
  });

  it("maps recovery URL errors to the recovery link message", () => {
    expect(formatAuthError("Error in URL", "recovery")).toBe(
      RECOVERY_LINK_ERROR,
    );
    expect(
      formatAuthError("No session defined in URL", "recovery"),
    ).toBe(RECOVERY_LINK_ERROR);
  });

  it("does not treat a generic URL error as a recovery notice", () => {
    expect(formatAuthError("Error in URL")).toBe("Error in URL");
  });
});

describe("formatAuthError passwords", () => {
  it.each([
    "Password should be at least 8 characters",
    "Password is too short",
  ])("maps the weak-password message %j", (message) => {
    expect(formatAuthError(message)).toBe(
      "La password deve contenere almeno 6 caratteri.",
    );
  });

  it("maps the weak_password code in both contexts", () => {
    expect(formatAuthError({ message: "", code: "weak_password" })).toBe(
      "La password deve contenere almeno 6 caratteri.",
    );
    expect(
      formatAuthError({ message: "", code: "weak_password" }, "password"),
    ).toBe(
      "La nuova password è troppo debole. Scegline una più lunga e difficile da indovinare.",
    );
  });

  it("uses the stronger hint in the password context", () => {
    expect(formatAuthError("Password is too short", "password")).toBe(
      "La nuova password è troppo debole. Scegline una più lunga e difficile da indovinare.",
    );
  });

  it.each([
    { message: "", code: "same_password" },
    { message: "New password should be different from the old password" },
    { message: "The same password was used" },
  ])("maps the unchanged-password failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "La nuova password deve essere diversa da quella attuale.",
    );
  });

  it.each([
    { message: "", code: "reauthentication_needed" },
    { message: "", code: "reauthentication_not_valid" },
    { message: "Reauthentication required" },
  ])("maps the reauthentication failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "Per sicurezza, accedi di nuovo prima di modificare la password.",
    );
  });

  it.each([
    { message: "", code: "insufficient_aal" },
    { message: "AAL2 is required" },
  ])("maps the two-factor failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "Per modificare la password devi completare la verifica in due passaggi. Accedi di nuovo e riprova.",
    );
  });
});

describe("formatAuthError account and email cases", () => {
  it.each([
    { message: "", code: "invalid_credentials" },
    { message: "Invalid login credentials" },
  ])("maps the invalid-credentials failure %j", (error) => {
    expect(formatAuthError(error)).toBe("Email o password non validi.");
  });

  it.each([
    { message: "", code: "email_not_confirmed" },
    { message: "Email not confirmed" },
  ])("maps the unconfirmed-email failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "Conferma la tua email prima di accedere.",
    );
  });

  it.each([
    { message: "", code: "user_already_exists" },
    { message: "", code: "email_exists" },
    { message: "User already registered" },
    { message: "Email address already registered" },
  ])("maps the existing-account failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "Esiste già un account con questa email.",
    );
  });

  it.each([
    { message: "", code: "email_address_invalid" },
    { message: "Unable to validate email address: invalid format" },
    { message: "Email address is invalid" },
  ])("maps the invalid-email failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "Inserisci un indirizzo email valido.",
    );
  });

  it.each([
    { message: "", code: "email_address_not_authorized" },
    { message: "Email address not authorized" },
  ])("maps the unauthorized-sender failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "Questa email non è autorizzata dal servizio di invio. Contatta un amministratore.",
    );
  });

  it.each([
    { message: "", code: "provider_disabled" },
    { message: "", code: "oauth_provider_not_supported" },
    { message: "Provider is not enabled" },
    { message: "Unsupported provider: google" },
  ])("maps the disabled-provider failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "L’accesso con Google non è abilitato. Contatta un amministratore.",
    );
  });

  it.each([
    { message: "", code: "signup_disabled" },
    { message: "Signups not allowed for this instance" },
  ])("maps the disabled-signup failure %j", (error) => {
    expect(formatAuthError(error)).toBe(
      "La registrazione è momentaneamente disabilitata. Contatta un amministratore.",
    );
  });

  it("maps an unknown user to the generic notice", () => {
    expect(formatAuthError({ message: "", code: "user_not_found" })).toBe(
      "Utente non trovato.",
    );
    expect(formatAuthError("User not found")).toBe("Utente non trovato.");
  });

  it("uses the privacy-preserving notice in the recovery context", () => {
    expect(formatAuthError("User not found", "recovery")).toBe(
      "Se l’indirizzo è registrato, riceverai un’email con le istruzioni per reimpostare la password.",
    );
  });
});

describe("formatAuthError fallbacks", () => {
  it("trims and keeps an unknown message", () => {
    expect(formatAuthError("  Qualcosa è andato storto.  ")).toBe(
      "Qualcosa è andato storto.",
    );
  });

  it("returns a generic Italian message when nothing is available", () => {
    expect(formatAuthError("")).toBe("Si è verificato un errore. Riprova.");
    expect(formatAuthError("   ")).toBe("Si è verificato un errore. Riprova.");
    expect(formatAuthError({ message: "" })).toBe(
      "Si è verificato un errore. Riprova.",
    );
  });

  it("normalizes the error code before matching", () => {
    expect(formatAuthError({ message: "", code: "  SESSION_EXPIRED  " })).toBe(
      SESSION_ERROR,
    );
  });
});

describe("getCredentialsProvider", () => {
  it("returns external for a missing user", () => {
    expect(getCredentialsProvider(null)).toBe("external");
  });

  it("detects an email/password identity", () => {
    expect(
      getCredentialsProvider(
        buildUser({ identities: [{ provider: "email" }] }),
      ),
    ).toBe("password");
  });

  it("detects a Google identity", () => {
    expect(
      getCredentialsProvider(
        buildUser({ identities: [{ provider: "google" }] }),
      ),
    ).toBe("google");
  });

  it("normalizes provider casing and ignores malformed identity values", () => {
    expect(
      getCredentialsProvider(
        buildUser({
          identities: [
            { provider: "GOOGLE" },
            { provider: "" },
            { provider: 42 },
          ],
        }),
      ),
    ).toBe("google");
  });

  it("falls back to the app_metadata provider list", () => {
    expect(
      getCredentialsProvider(
        buildUser({ appMetadata: { providers: ["email"] } }),
      ),
    ).toBe("password");
    expect(
      getCredentialsProvider(
        buildUser({ appMetadata: { providers: ["google"] } }),
      ),
    ).toBe("google");
    expect(
      getCredentialsProvider(
        buildUser({ appMetadata: { providers: [42, "", "EMAIL"] } }),
      ),
    ).toBe("password");
  });

  it("prefers the primary provider over the identity list", () => {
    expect(
      getCredentialsProvider(
        buildUser({
          identities: [{ provider: "email" }],
          appMetadata: { provider: "google" },
        }),
      ),
    ).toBe("google");
    expect(
      getCredentialsProvider(
        buildUser({
          identities: [{ provider: "google" }],
          appMetadata: { provider: "email" },
        }),
      ),
    ).toBe("password");
  });

  it("prefers an email provider over Google when no primary is set", () => {
    expect(
      getCredentialsProvider(
        buildUser({
          identities: [{ provider: "google" }, { provider: "email" }],
        }),
      ),
    ).toBe("password");
  });

  it("returns external for unknown providers and malformed metadata", () => {
    expect(
      getCredentialsProvider(
        buildUser({
          identities: [{ provider: "github" }],
          appMetadata: { provider: 42, providers: "email" },
        }),
      ),
    ).toBe("external");
  });
});

describe("getAuthRedirectErrorMessage", () => {
  it("returns null during server rendering and when no error is present", () => {
    expect(getAuthRedirectErrorMessage()).toBeNull();

    vi.stubGlobal("window", {
      location: { hash: "", search: "" },
    });

    expect(getAuthRedirectErrorMessage()).toBeNull();
  });

  it("reads an error from the hash", () => {
    vi.stubGlobal("window", {
      location: {
        hash: "#error=access_denied&error_code=access_denied&error_description=User+denied+access",
        search: "",
      },
    });

    expect(getAuthRedirectErrorMessage()).toBe(RECOVERY_LINK_ERROR);
  });

  it("reads an error from the query string", () => {
    vi.stubGlobal("window", {
      location: {
        hash: "",
        search: "?error_code=otp_expired",
      },
    });

    expect(getAuthRedirectErrorMessage()).toBe(RECOVERY_LINK_ERROR);
  });

  it("uses the default description when only a code is supplied", () => {
    vi.stubGlobal("window", {
      location: {
        hash: "#error_code=unknown_error",
        search: "",
      },
    });

    expect(getAuthRedirectErrorMessage()).toBe(
      "Link di recupero non valido.",
    );
  });
});
