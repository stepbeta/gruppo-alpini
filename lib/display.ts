import type { User } from "@supabase/supabase-js";

/** Best-effort display name from Supabase auth metadata. */
export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return "Alpino";

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = metadata.full_name;
  const name = metadata.name;
  const emailName = user.email?.split("@")[0];

  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  if (emailName) return emailName;

  return "Alpino";
}

export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
