import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Guards against missing *or placeholder* values (e.g. `your_actual_supabase_url`),
 * so the app can render a friendly configuration message instead of crashing
 * when `.env.local` has not been filled in yet.
 */
function isValidHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Singleton Supabase client instance.
 *
 * `null` when the environment variables are missing or still placeholders —
 * check `isSupabaseConfigured` (or `supabase === null`) before using it.
 */
export const supabase: SupabaseClient | null =
  isValidHttpUrl(supabaseUrl) && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;

export const isSupabaseConfigured: boolean = supabase !== null;

/** Row shape of the `tests` table created by the initial migration. */
export type TestRow = {
  id: number;
  message: string;
  created_at: string;
};
