import { cacheLife } from "next/cache";
import { supabase } from "./supabase";

/**
 * Public controller details rendered by `/privacy`.
 *
 * The row is intentionally readable by the `anon` role: the page must work for
 * visitors who have not signed in. Values are stored without a login flow in
 * `public.organization_settings` and are edited by an administrator from the
 * Supabase dashboard (or with the service role).
 */
export type OrganizationSettings = {
  organizationName: string;
  address: string | null;
  contactEmail: string | null;
  dpoEmail: string | null;
  updatedAt: string | null;
};

const FALLBACK_ORGANIZATION_NAME = "Gruppo Alpini";

const FALLBACK_SETTINGS: OrganizationSettings = {
  organizationName: FALLBACK_ORGANIZATION_NAME,
  address: null,
  contactEmail: null,
  dpoEmail: null,
  updatedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSettings(value: unknown): OrganizationSettings | null {
  if (!isRecord(value)) return null;

  return {
    organizationName:
      cleanText(value.organization_name) ?? FALLBACK_ORGANIZATION_NAME,
    address: cleanText(value.address),
    contactEmail: cleanText(value.contact_email),
    dpoEmail: cleanText(value.dpo_email),
    updatedAt: cleanText(value.updated_at),
  };
}

/**
 * Reads the single organization-settings row with a cached server fetch.
 *
 * `cacheComponents` requires uncached I/O to be explicit. The profile is
 * refreshed at most once per hour; edits made in the dashboard therefore
 * become visible without a redeploy. If Supabase is not configured, or the
 * migration has not been applied yet, the page falls back to neutral values
 * instead of throwing during prerendering.
 */
export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  "use cache";
  cacheLife("hours");

  if (!supabase) {
    return FALLBACK_SETTINGS;
  }

  try {
    const { data, error } = await supabase
      .from("organization_settings")
      .select(
        "organization_name, address, contact_email, dpo_email, updated_at",
      )
      .eq("id", true)
      .maybeSingle();

    if (error) {
      return FALLBACK_SETTINGS;
    }

    return parseSettings(data) ?? FALLBACK_SETTINGS;
  } catch {
    return FALLBACK_SETTINGS;
  }
}
