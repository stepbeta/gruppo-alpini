import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Server-only key. Supabase projects can use either the legacy service_role
 * JWT (`SUPABASE_SERVICE_ROLE_KEY`) or a newer secret key
 * (`SUPABASE_SECRET_KEY`). Both are accepted by the admin API.
 */
const supabaseAdminKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

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
 * Returns a server-side Supabase client with the admin API enabled, or `null`
 * when the project URL or server-only key is missing.
 *
 * Never import this module from a Client Component: the key bypasses RLS.
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  if (!isValidHttpUrl(supabaseUrl) || !supabaseAdminKey) return null;

  return createClient(supabaseUrl, supabaseAdminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
