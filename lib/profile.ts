import { formatFriendlyError } from "./error-messages";
import {
  buildIlikeOr,
  getPageCount,
  getPageRange,
  normalizePage,
  normalizePageSize,
  type CountResult,
  type PaginationInfo,
  type PaginationParams,
} from "./pagination";
import { supabase } from "./supabase";

/**
 * Registration state for a member account.
 *
 * - `pending`: signed up, waiting for an administrator.
 * - `approved`: can use the portal.
 * - `rejected`: blocked; an administrator can reconsider the request.
 */
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Profile = {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  enlistment_year: number | null;
  service_place: string | null;
  is_admin: boolean;
  approval_status: ApprovalStatus;
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
  | "approval_status"
>;

export type MembersQuery = PaginationParams & {
  /** Matches the full name or the service place. */
  search?: string;
  approvalStatus?: ApprovalStatus;
};

export type MembersPage = PaginationInfo & {
  members: Member[];
  error: string | null;
};

/**
 * Label used for historical rows whose profile was deleted. The row itself is
 * kept (with a NULL user id) so statistics remain accurate.
 */
export const DELETED_MEMBER_NAME = "Socio eliminato";

export const PROFILE_COLUMNS =
  "id, full_name, birth_date, enlistment_year, service_place, is_admin, approval_status, updated_at";

export const MEMBER_COLUMNS =
  "id, full_name, birth_date, enlistment_year, service_place, is_admin, approval_status";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

/** Turns the most common Supabase/PostgREST errors into Italian messages. */
export function formatProfileError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("only administrators can change the approval status") ||
    normalized.includes("profiles_protect_approval_status")
  ) {
    return "Solo un amministratore può approvare o rifiutare un account.";
  }

  return formatFriendlyError(message, {
    fallback:
      "Non è stato possibile completare l’operazione sulla scheda. Riprova tra poco; se il problema continua, contatta un amministratore.",
    permission:
      "Non hai i permessi per modificare questo profilo. Verifica che le migrazioni Supabase siano state applicate al database.",
    missingTable:
      "La struttura del profilo non è aggiornata. Applica le migrazioni Supabase con npm run db:push.",
    duplicate: "Esiste già una scheda collegata a questo account.",
    checkConstraint:
      "I dati della scheda non rispettano i vincoli previsti. Controlla i campi e riprova.",
    invalidInput:
      "Uno dei valori inseriti non è valido. Controlla la data di nascita e l’anno di leva, poi riprova.",
  });
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
 * Reads one page of member profiles for the authenticated directory.
 *
 * Filtering, sorting and counting happen in Postgres. RLS returns only
 * approved profiles to regular members; administrators also receive pending
 * and rejected accounts so they can decide on registrations.
 */
export async function fetchMembers(
  params: MembersQuery = {},
): Promise<MembersPage> {
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const emptyPage = {
    members: [] as Member[],
    page,
    pageSize,
    total: 0,
    pageCount: 0,
  };

  if (!supabase) {
    return { ...emptyPage, error: "Supabase non configurato." };
  }

  try {
    let query = supabase
      .from("profiles")
      .select(MEMBER_COLUMNS, { count: "exact" });

    if (params.approvalStatus) {
      query = query.eq("approval_status", params.approvalStatus);
    }

    const searchFilter = buildIlikeOr(
      ["full_name", "service_place"],
      params.search,
    );

    if (searchFilter) {
      query = query.or(searchFilter);
    }

    const { from, to } = getPageRange(page, pageSize);
    const { data, error, count } = await query
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      return { ...emptyPage, error: error.message };
    }

    const total = count ?? 0;

    return {
      members: (data as Member[] | null) ?? [],
      page,
      pageSize,
      total,
      pageCount: getPageCount(total, pageSize),
      error: null,
    };
  } catch (error) {
    return { ...emptyPage, error: errorMessage(error) };
  }
}

/** Exact number of profiles visible to the caller, optionally by status. */
export async function fetchMemberCount(
  approvalStatus?: ApprovalStatus,
): Promise<CountResult> {
  if (!supabase) {
    return { count: 0, error: "Supabase non configurato." };
  }

  try {
    let query = supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (approvalStatus) {
      query = query.eq("approval_status", approvalStatus);
    }

    const { count, error } = await query;

    if (error) {
      return { count: 0, error: error.message };
    }

    return { count: count ?? 0, error: null };
  } catch (error) {
    return { count: 0, error: errorMessage(error) };
  }
}

/**
 * Loads only the member rows needed by a page of events or requests instead of
 * downloading the whole directory.
 */
export async function fetchMembersByIds(ids: string[]): Promise<{
  members: Member[];
  error: string | null;
}> {
  const uniqueIds = [...new Set(ids.filter((id) => id.length > 0))];

  if (uniqueIds.length === 0) {
    return { members: [], error: null };
  }

  if (!supabase) {
    return { members: [], error: "Supabase non configurato." };
  }

  // Long `in` filters can exceed the gateway URL limit on large groups, so the
  // ids are requested in batches.
  const batches: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += 100) {
    batches.push(uniqueIds.slice(index, index + 100));
  }

  const client = supabase;

  try {
    const results = await Promise.all(
      batches.map((batch) =>
        client
          .from("profiles")
          .select(MEMBER_COLUMNS)
          .in("id", batch),
      ),
    );

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      return { members: [], error: failed.error.message };
    }

    return {
      members: results.flatMap(
        (result) => (result.data as Member[] | null) ?? [],
      ),
      error: null,
    };
  } catch (error) {
    return { members: [], error: errorMessage(error) };
  }
}

/**
 * Updates another member's profile.
 *
 * Only administrators pass the Phase 1C RLS policy; non-admins can only update
 * their own row through `saveProfile`. The form never sends `is_admin` or the
 * approval status.
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
 * Approves or rejects a member account.
 *
 * Only administrators pass the RLS update policy. A database trigger blocks
 * regular members from self-approving even if they call the API directly.
 * `pending` is intentionally not accepted here: new accounts start pending and
 * are only moved forward by an administrator.
 */
export async function updateMemberApproval(
  memberId: string,
  approvalStatus: Exclude<ApprovalStatus, "pending">,
): Promise<{ member: Member | null; error: string | null }> {
  if (!supabase) {
    return { member: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        approval_status: approvalStatus,
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
