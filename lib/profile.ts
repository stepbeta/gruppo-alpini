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

const PROFILE_COLUMNS =
  "id, full_name, birth_date, enlistment_year, service_place, is_admin, updated_at";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
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
