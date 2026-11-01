import { supabase } from "./supabase";

export type Profile = {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  enlistment_year: number | null;
  service_place: string | null;
  is_admin: boolean;
  updated_at: string;
};

export type ProfileUpdate = {
  full_name: string | null;
  birth_date: string | null;
  enlistment_year: number | null;
  service_place: string | null;
};

/** Profile fields shown in the member directory. */
export type Member = Pick<
  Profile,
  | "id"
  | "full_name"
  | "birth_date"
  | "enlistment_year"
  | "service_place"
  | "is_admin"
>;

/**
 * Label used for historical rows whose profile was deleted. The row itself is
 * kept (with a NULL user id) so statistics remain accurate.
 */
export const DELETED_MEMBER_NAME = "Socio eliminato";

export const PROFILE_COLUMNS =
  "id, full_name, birth_date, enlistment_year, service_place, is_admin, updated_at";

export const MEMBER_COLUMNS =
  "id, full_name, birth_date, enlistment_year, service_place, is_admin";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

/** Turns the most common Supabase/PostgREST errors into Italian messages. */
export function formatProfileError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("row-level security")
  ) {
    return "Non hai i permessi per modificare questo profilo. Verifica che le migrazioni Supabase siano state applicate al database.";
  }
  if (normalized.includes("duplicate key")) {
    return "Esiste già una scheda collegata a questo account.";
  }
  if (normalized.includes("invalid input syntax")) {
    return "Uno dei valori inseriti non è valido. Controlla i campi e riprova.";
  }

  return message;
}

export async function fetchProfile(
  userId: string,
): Promise<{ profile: Profile | null; error: string | null }> {
  if (!supabase) {
    return { profile: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return { profile: null, error: error.message };
    }

    return { profile: (data as Profile | null) ?? null, error: null };
  } catch (error) {
    return { profile: null, error: errorMessage(error) };
  }
}

/**
 * Creates or updates the signed-in user's profile.
 *
 * RLS restricts the row to the current user, and a database trigger prevents
 * members from changing `is_admin`.
 */
export async function saveProfile(
  userId: string,
  values: ProfileUpdate,
): Promise<{ profile: Profile | null; error: string | null }> {
  if (!supabase) {
    return { profile: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          ...values,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      return { profile: null, error: error.message };
    }

    return { profile: data as Profile, error: null };
  } catch (error) {
    return { profile: null, error: errorMessage(error) };
  }
}

/**
 * Reads every member profile for the authenticated directory.
 *
 * The Phase 1B RLS policy allows any authenticated member to select all rows.
 */
export async function fetchMembers(): Promise<{
  members: Member[];
  error: string | null;
}> {
  if (!supabase) {
    return { members: [], error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(MEMBER_COLUMNS)
      .order("full_name", { ascending: true, nullsFirst: false });

    if (error) {
      return { members: [], error: error.message };
    }

    return { members: (data as Member[] | null) ?? [], error: null };
  } catch (error) {
    return { members: [], error: errorMessage(error) };
  }
}

/**
 * Updates another member's profile.
 *
 * Only administrators pass the Phase 1C RLS policy; non-admins can only update
 * their own row through `saveProfile`. The form never sends `is_admin`.
 */
export async function updateMemberProfile(
  memberId: string,
  values: ProfileUpdate,
): Promise<{ member: Member | null; error: string | null }> {
  if (!supabase) {
    return { member: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...values,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .select(MEMBER_COLUMNS)
      .single();

    if (error) {
      return { member: null, error: error.message };
    }

    return { member: data as Member, error: null };
  } catch (error) {
    return { member: null, error: errorMessage(error) };
  }
}

/**
 * Deletes an account and its profile.
 *
 * The auth user can only be removed with the Supabase admin API, so this calls
 * a server route that validates the caller’s session (and, for another member,
 * that the caller is an administrator) before using the service role.
 */
export async function deleteAccount(
  userId: string,
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: "Supabase non configurato." };
  }

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      return { error: sessionError.message };
    }

    if (!session?.access_token) {
      return { error: "Sessione scaduta. Accedi di nuovo e riprova." };
    }

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      return {
        error:
          payload?.error ??
          "Impossibile eliminare l’account. Riprova o contatta un amministratore.",
      };
    }

    return { error: null };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
