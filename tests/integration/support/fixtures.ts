import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";
import { PRIVACY_POLICY_VERSION } from "../../../lib/privacy";
import type { IntegrationContext } from "./local-supabase";

export const TEST_PASSWORD = "integration-password-123";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type TestUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  approvalStatus: ApprovalStatus;
  isAdmin: boolean;
  client: SupabaseClient;
};

export type CreateUserOptions = {
  approval?: ApprovalStatus;
  admin?: boolean;
  /** Set to false to simulate a signed-in account that has not consented. */
  consent?: boolean;
  fullName?: string;
  policyVersion?: string;
};

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  is_all_day: boolean;
  created_by: string | null;
  created_at: string;
};

export type EventTemplateRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  is_all_day: boolean;
  default_time: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventResponseStatus = "present" | "tentative" | "absent";

export type EventResponseRow = {
  id: string;
  event_id: string;
  user_id: string | null;
  status: EventResponseStatus;
  guest_count: number;
  updated_at: string;
};

export type GenericRequestRow = {
  id: string;
  user_id: string | null;
  message: string;
  status: "open" | "resolved";
  created_at: string;
};

export type AnnouncementRow = {
  id: string;
  message: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export function futureIso(days = 1): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function pastIso(days = 1): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function insertRow<T>(
  client: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client
    .from(table)
    .insert(values)
    .select()
    .single();

  if (error) {
    throw new Error(
      `${table} fixture insert failed: ${error.code ?? "unknown"} ${error.message}`,
    );
  }

  return data as T;
}

export async function recordConsent(
  client: SupabaseClient,
  userId: string,
  policyVersion = PRIVACY_POLICY_VERSION,
): Promise<{ id: string; accepted_at: string }> {
  const { data, error } = await client
    .from("user_consents")
    .insert({ user_id: userId, policy_version: policyVersion })
    .select("id, accepted_at")
    .single();

  if (error) {
    throw new Error(
      `consent fixture insert failed: ${error.code ?? "unknown"} ${error.message}`,
    );
  }

  return data as { id: string; accepted_at: string };
}

/**
 * Creates an auth user with the admin client. The signup trigger creates the
 * profile as `pending`; the fixture then moves it to the requested approval
 * state and optional administrator/consent state.
 */
export async function createUser(
  ctx: IntegrationContext,
  options: CreateUserOptions = {},
): Promise<TestUser> {
  if (options.admin && options.approval && options.approval !== "approved") {
    throw new Error("Administrator fixtures are always approved");
  }

  const approvalStatus: ApprovalStatus = options.admin
    ? "approved"
    : (options.approval ?? "approved");
  const fullName = options.fullName ?? `Integration ${uniqueSuffix()}`;
  const email = `integration-${randomUUID()}@example.test`;

  const { data, error } = await ctx.service.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    throw new Error(
      `auth.admin.createUser failed: ${error?.message ?? "no user returned"}`,
    );
  }

  const id = data.user.id;

  if (approvalStatus !== "pending" || options.admin) {
    const { error: updateError } = await ctx.service
      .from("profiles")
      .update({
        approval_status: approvalStatus,
        ...(options.admin ? { is_admin: true } : {}),
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(
        `profile fixture update failed: ${updateError.code ?? "unknown"} ${updateError.message}`,
      );
    }
  }

  const client = ctx.clientFor(id);

  if (options.consent !== false) {
    await recordConsent(
      client,
      id,
      options.policyVersion ?? PRIVACY_POLICY_VERSION,
    );
  }

  return {
    id,
    email,
    password: TEST_PASSWORD,
    fullName,
    approvalStatus,
    isAdmin: options.admin === true,
    client,
  };
}

export function createEvent(
  client: SupabaseClient,
  overrides: Record<string, unknown> = {},
): Promise<EventRow> {
  return insertRow<EventRow>(client, "events", {
    title: `Integration event ${uniqueSuffix()}`,
    event_date: futureIso(),
    is_all_day: false,
    ...overrides,
  });
}

export function createEventTemplate(
  client: SupabaseClient,
  overrides: Record<string, unknown> = {},
): Promise<EventTemplateRow> {
  return insertRow<EventTemplateRow>(client, "event_templates", {
    title: `Integration template ${uniqueSuffix()}`,
    is_all_day: true,
    ...overrides,
  });
}

export function createEventResponse(
  client: SupabaseClient,
  values: {
    event_id: string;
    user_id: string;
    status?: EventResponseStatus;
    guest_count?: number;
  },
): Promise<EventResponseRow> {
  return insertRow<EventResponseRow>(client, "event_responses", {
    status: "present",
    guest_count: 0,
    ...values,
  });
}

export function createGenericRequest(
  client: SupabaseClient,
  values: { user_id: string; message?: string },
): Promise<GenericRequestRow> {
  return insertRow<GenericRequestRow>(client, "generic_requests", {
    message: `Integration request ${uniqueSuffix()}`,
    ...values,
  });
}

export function createAnnouncement(
  client: SupabaseClient,
  overrides: Record<string, unknown> = {},
): Promise<AnnouncementRow> {
  return insertRow<AnnouncementRow>(client, "announcement_banners", {
    message: `Integration banner ${uniqueSuffix()}`,
    is_active: true,
    ...overrides,
  });
}

export type ErrorLike = { code?: string; message?: string } | null;

/** Asserts the exact PostgREST/Postgres error code the UI relies on. */
export function expectPostgrestError(
  error: ErrorLike,
  code: string,
  messageIncludes?: string,
): void {
  expect(error, "expected a PostgREST error").not.toBeNull();
  expect(error?.code).toBe(code);

  if (messageIncludes) {
    expect(error?.message).toContain(messageIncludes);
  }
}
