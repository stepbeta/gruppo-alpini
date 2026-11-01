import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AuthErrorContext = "generic" | "recovery" | "password" | "email";

export type CredentialsProvider = "password" | "google" | "external";

type AuthErrorDetails = {
  message: string;
  code?: string | null;
};

export const RECOVERY_LINK_ERROR =
  "Il link di recupero non è valido, è scaduto o è già stato utilizzato. Richiedi un nuovo link.";

const NETWORK_ERROR =
  "Errore di rete. Controlla la connessione e riprova.";

const SESSION_ERROR =
  "La sessione è scaduta. Accedi di nuovo e riprova.";

const RATE_LIMIT_ERROR =
  "Hai fatto troppe richieste. Attendi qualche minuto e riprova.";

/**
 * Turns Supabase Auth errors into consistent Italian messages.
 *
 * The same mapper is used by the login, recovery and profile forms. Unknown
 * errors keep the original message so administrators can still diagnose them.
 */
export function formatAuthError(
  error: AuthErrorDetails | string,
  context: AuthErrorContext = "generic",
): string {
  const details = typeof error === "string" ? { message: error } : error;
  const message = details.message?.trim() ?? "";
  const normalized = message.toLowerCase();
  const code = (details.code ?? "").trim().toLowerCase();

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    normalized.includes("rate limit") ||
    normalized.includes("only request this after") ||
    normalized.includes("for security purposes")
  ) {
    return RATE_LIMIT_ERROR;
  }

  if (
    code === "session_not_found" ||
    code === "session_expired" ||
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    code === "bad_jwt" ||
    code === "no_authorization" ||
    normalized.includes("auth session missing") ||
    normalized.includes("session missing") ||
    normalized.includes("invalid refresh token") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("jwt expired")
  ) {
    return SESSION_ERROR;
  }

  if (
    code === "otp_expired" ||
    code === "flow_state_expired" ||
    ((normalized.includes("expired") || normalized.includes("invalid")) &&
      (normalized.includes("link") || normalized.includes("token")))
  ) {
    return context === "recovery"
      ? RECOVERY_LINK_ERROR
      : "Il link è scaduto o non è più valido. Richiedine uno nuovo.";
  }

  if (
    code === "access_denied" ||
    normalized === "access_denied" ||
    (context === "recovery" &&
      (normalized.includes("error in url") ||
        normalized.includes("no session defined in url")))
  ) {
    return RECOVERY_LINK_ERROR;
  }

  if (
    code === "weak_password" ||
    normalized.includes("weak password") ||
    normalized.includes("password should be at least") ||
    normalized.includes("password is too short")
  ) {
    return context === "password"
      ? "La nuova password è troppo debole. Scegline una più lunga e difficile da indovinare."
      : "La password deve contenere almeno 6 caratteri.";
  }

  if (
    code === "same_password" ||
    normalized.includes("different from the old password") ||
    normalized.includes("same password")
  ) {
    return "La nuova password deve essere diversa da quella attuale.";
  }

  if (
    code === "reauthentication_needed" ||
    code === "reauthentication_not_valid" ||
    normalized.includes("reauthentication")
  ) {
    return "Per sicurezza, accedi di nuovo prima di modificare la password.";
  }

  if (code === "insufficient_aal" || normalized.includes("aal2")) {
    return "Per modificare la password devi completare la verifica in due passaggi. Accedi di nuovo e riprova.";
  }

  if (
    code === "invalid_credentials" ||
    normalized.includes("invalid login credentials")
  ) {
    return "Email o password non validi.";
  }

  if (
    code === "email_not_confirmed" ||
    normalized.includes("email not confirmed")
  ) {
    return "Conferma la tua email prima di accedere.";
  }

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    normalized.includes("user already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("email address already registered")
  ) {
    return "Esiste già un account con questa email.";
  }

  if (
    code === "email_address_invalid" ||
    normalized.includes("unable to validate email") ||
    normalized.includes("invalid email") ||
    normalized.includes("email address is invalid")
  ) {
    return "Inserisci un indirizzo email valido.";
  }

  if (
    code === "email_address_not_authorized" ||
    normalized.includes("email address not authorized")
  ) {
    return "Questa email non è autorizzata dal servizio di invio. Contatta un amministratore.";
  }

  if (
    code === "provider_disabled" ||
    code === "oauth_provider_not_supported" ||
    normalized.includes("provider is not enabled") ||
    normalized.includes("unsupported provider")
  ) {
    return "L’accesso con Google non è abilitato. Contatta un amministratore.";
  }

  if (
    code === "signup_disabled" ||
    normalized.includes("signups not allowed")
  ) {
    return "La registrazione è momentaneamente disabilitata. Contatta un amministratore.";
  }

  if (code === "user_not_found" || normalized.includes("user not found")) {
    return context === "recovery"
      ? "Se l’indirizzo è registrato, riceverai un’email con le istruzioni per reimpostare la password."
      : "Utente non trovato.";
  }

  return message || "Si è verificato un errore. Riprova.";
}

function formatUnexpectedAuthError(
  error: unknown,
  context: AuthErrorContext,
): string {
  if (typeof error === "string") {
    return formatAuthError(error, context);
  }

  if (error instanceof Error) {
    return formatAuthError(error.message, context);
  }

  return NETWORK_ERROR;
}

/**
 * Reads the error Supabase appends to a recovery link after a failed redirect.
 * It must be called in the browser, before the auth client clears the URL.
 */
export function getAuthRedirectErrorMessage(): string | null {
  if (typeof window === "undefined") return null;

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  const error = hash.get("error") ?? query.get("error");
  const errorCode = hash.get("error_code") ?? query.get("error_code");
  const description =
    hash.get("error_description") ?? query.get("error_description");

  if (!error && !errorCode && !description) return null;

  return formatAuthError(
    {
      message: description ?? error ?? "Link di recupero non valido.",
      code: errorCode,
    },
    "recovery",
  );
}

/**
 * Identifies which credential management UI to show.
 *
 * `app_metadata.provider` is the provider used at sign-up. Identities are also
 * inspected because older users may not expose the metadata consistently.
 */
export function getCredentialsProvider(
  user: User | null,
): CredentialsProvider {
  if (!user) return "external";

  const providers = new Set<string>();

  for (const identity of user.identities ?? []) {
    if (typeof identity.provider === "string" && identity.provider) {
      providers.add(identity.provider.toLowerCase());
    }
  }

  const metadataProvidersValue: unknown = user.app_metadata.providers;
  const metadataProviders: readonly unknown[] = Array.isArray(
    metadataProvidersValue,
  )
    ? metadataProvidersValue
    : [];

  for (const provider of metadataProviders) {
    if (typeof provider === "string" && provider) {
      providers.add(provider.toLowerCase());
    }
  }

  const primaryProviderValue: unknown = user.app_metadata.provider;
  const primaryProvider =
    typeof primaryProviderValue === "string"
      ? primaryProviderValue.toLowerCase()
      : null;

  if (primaryProvider === "google") return "google";
  if (primaryProvider === "email") return "password";
  if (providers.has("email")) return "password";
  if (providers.has("google")) return "google";

  return "external";
}

/**
 * Sends the password recovery email. The destination page must be present in
 * the Supabase project's allowed redirect URLs.
 */
export async function requestPasswordReset(
  email: string,
  redirectTo: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase non configurato." };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      return { error: formatAuthError(error, "recovery") };
    }

    return { error: null };
  } catch (error) {
    return { error: formatUnexpectedAuthError(error, "recovery") };
  }
}

/** Updates the password of the signed-in user. */
export async function updatePassword(
  password: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase non configurato." };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: formatAuthError(error, "password") };
    }

    return { error: null };
  } catch (error) {
    return { error: formatUnexpectedAuthError(error, "password") };
  }
}

/**
 * Requests an email address change.
 *
 * When Supabase requires confirmation, the user's email is not updated until
 * the link is opened, so callers can show a different success message.
 */
export async function updateEmail(
  email: string,
  redirectTo: string,
): Promise<{ error: string | null; pendingConfirmation: boolean }> {
  if (!supabase) {
    return {
      error: "Supabase non configurato.",
      pendingConfirmation: false,
    };
  }

  try {
    const cleanEmail = email.trim();
    const { data, error } = await supabase.auth.updateUser(
      { email: cleanEmail },
      { emailRedirectTo: redirectTo },
    );

    if (error) {
      return {
        error: formatAuthError(error, "email"),
        pendingConfirmation: false,
      };
    }

    return {
      error: null,
      pendingConfirmation:
        data.user?.email?.toLowerCase() !== cleanEmail.toLowerCase(),
    };
  } catch (error) {
    return {
      error: formatUnexpectedAuthError(error, "email"),
      pendingConfirmation: false,
    };
  }
}
