import { PRIVACY_POLICY_VERSION } from "./privacy";
import { supabase } from "./supabase";

export type ConsentRecord = {
  policyVersion: string;
  acceptedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Turns the most common consent/PostgREST errors into Italian messages. */
export function formatConsentError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("42p01") ||
    normalized.includes("pgrst205") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table")
  ) {
    return "La configurazione del consenso privacy non è ancora disponibile. Contatta un amministratore.";
  }

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("row-level security")
  ) {
    return "Non hai i permessi per registrare il consenso. Verifica che le migrazioni Supabase siano state applicate.";
  }

  if (
    normalized.includes("duplicate key") ||
    normalized.includes("23505") ||
    normalized.includes("user_consents_user_version_unique")
  ) {
    return "Il consenso risulta già registrato. Riprova a caricare la pagina.";
  }

  return "Impossibile completare l’operazione sul consenso. Riprova o contatta un amministratore.";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

/**
 * Checks whether the signed-in user has already accepted the current policy
 * version. The select policy on `user_consents` lets members read their own
 * rows; the unique constraint guarantees at most one row per version.
 */
export async function fetchCurrentConsent(userId: string): Promise<{
  accepted: boolean;
  acceptedAt: string | null;
  error: string | null;
}> {
  if (!supabase) {
    return {
      accepted: false,
      acceptedAt: null,
      error: "Supabase non configurato.",
    };
  }

  try {
    const { data, error } = await supabase
      .from("user_consents")
      .select("policy_version, accepted_at")
      .eq("user_id", userId)
      .eq("policy_version", PRIVACY_POLICY_VERSION)
      .maybeSingle();

    if (error) {
      return {
        accepted: false,
        acceptedAt: null,
        error: formatConsentError(error.message),
      };
    }

    if (!isRecord(data)) {
      return { accepted: false, acceptedAt: null, error: null };
    }

    const acceptedAt = readString(data, "accepted_at");
    return { accepted: acceptedAt !== null, acceptedAt, error: null };
  } catch (error) {
    return {
      accepted: false,
      acceptedAt: null,
      error: formatConsentError(errorMessage(error)),
    };
  }
}

/**
 * Appends the current policy version to the signed-in user's consent history.
 *
 * A duplicate insert means another tab already recorded the same acceptance;
 * that is treated as success rather than as an error.
 */
export async function recordConsent(userId: string): Promise<{
  consent: ConsentRecord | null;
  error: string | null;
}> {
  if (!supabase) {
    return { consent: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("user_consents")
      .insert({
        user_id: userId,
        policy_version: PRIVACY_POLICY_VERSION,
      })
      .select("policy_version, accepted_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        const current = await fetchCurrentConsent(userId);
        if (current.error) {
          return { consent: null, error: current.error };
        }
        return {
          consent:
            current.acceptedAt === null
              ? null
              : {
                  policyVersion: PRIVACY_POLICY_VERSION,
                  acceptedAt: current.acceptedAt,
                },
          error: null,
        };
      }

      return { consent: null, error: formatConsentError(error.message) };
    }

    if (!isRecord(data)) {
      return { consent: null, error: null };
    }

    return {
      consent: {
        policyVersion:
          readString(data, "policy_version") ?? PRIVACY_POLICY_VERSION,
        acceptedAt: readString(data, "accepted_at") ?? new Date().toISOString(),
      },
      error: null,
    };
  } catch (error) {
    return {
      consent: null,
      error: formatConsentError(errorMessage(error)),
    };
  }
}
