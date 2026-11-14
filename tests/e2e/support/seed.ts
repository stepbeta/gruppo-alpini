import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRIVACY_POLICY_VERSION } from "../../../lib/privacy";
import {
  createStorageState,
  E2E_AUTH_DIR,
  E2E_EMAIL_DOMAIN,
  E2E_PASSWORD,
  type LocalSupabaseStatus,
} from "./local-supabase";

export type SeededUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
};

export type SeededEvent = {
  id: string;
  title: string;
  eventDate: string;
  isAllDay: boolean;
};

export type E2ESeed = {
  users: {
    admin: SeededUser;
    admin2: SeededUser;
    admin3: SeededUser;
    member: SeededUser;
    pending: SeededUser;
  };
  events: {
    nextTimed: SeededEvent;
    nextAllDay: SeededEvent;
    thirdUpcoming: SeededEvent;
    fourthUpcoming: SeededEvent;
    fifthUpcoming: SeededEvent;
    shared: SeededEvent;
    past: SeededEvent;
  };
};

export type TestUser = SeededUser;

export type CreateUserOptions = {
  approval?: "pending" | "approved" | "rejected";
  admin?: boolean;
  consent?: boolean;
  fullName?: string;
  email?: string;
};

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export function seedPath(): string {
  return join(E2E_AUTH_DIR, "seed.json");
}

export function readSeed(): E2ESeed {
  try {
    return JSON.parse(readFileSync(seedPath(), "utf8")) as E2ESeed;
  } catch (error) {
    throw new Error(
      "E2E seed data is missing. Run the suite through `npm run test:e2e` so the global setup can seed the local database.",
      { cause: error },
    );
  }
}

export function futureIso(days: number, hour = 19, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function pastIso(days: number, hour = 18): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

/** UTC midnight for an all-day event a few days ahead. */
export function allDayIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  ).toISOString();
}

/** Formats a date for the Italian `gg/mm/aaaa` inputs used by the UI. */
export function italianDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(date);
}

export async function createUser(
  service: SupabaseClient,
  options: CreateUserOptions = {},
): Promise<TestUser> {
  const approval = options.admin ? "approved" : (options.approval ?? "approved");
  const suffix = uniqueSuffix();
  const email = options.email ?? `e2e-${suffix}@${E2E_EMAIL_DOMAIN}`;
  const fullName = options.fullName ?? `E2E Utente ${suffix}`;

  const { data, error } = await service.auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    throw new Error(
      `auth.admin.createUser failed: ${error?.message ?? "no user returned"}`,
    );
  }

  const id = data.user.id;

  if (approval !== "pending" || options.admin) {
    const { error: updateError } = await service
      .from("profiles")
      .update({
        approval_status: approval,
        ...(options.admin ? { is_admin: true } : {}),
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(
        `profile fixture update failed: ${updateError.code ?? "unknown"} ${updateError.message}`,
      );
    }
  }

  if (options.consent !== false) {
    const { error: consentError } = await service
      .from("user_consents")
      .insert({ user_id: id, policy_version: PRIVACY_POLICY_VERSION });

    if (consentError) {
      throw new Error(
        `consent fixture insert failed: ${consentError.code ?? "unknown"} ${consentError.message}`,
      );
    }
  }

  return { id, email, password: E2E_PASSWORD, fullName };
}

export async function createEvent(
  service: SupabaseClient,
  values: {
    title: string;
    eventDate?: string;
    isAllDay?: boolean;
    location?: string | null;
    description?: string | null;
    createdBy?: string | null;
  },
): Promise<SeededEvent> {
  const eventDate = values.eventDate ?? futureIso(3, 19, 30);
  const isAllDay = values.isAllDay ?? false;

  const { data, error } = await service
    .from("events")
    .insert({
      title: values.title,
      event_date: eventDate,
      is_all_day: isAllDay,
      location: values.location ?? null,
      description: values.description ?? null,
      created_by: values.createdBy ?? null,
    })
    .select("id, title, event_date, is_all_day")
    .single();

  if (error) {
    throw new Error(
      `event fixture insert failed: ${error.code ?? "unknown"} ${error.message}`,
    );
  }

  return {
    id: data.id as string,
    title: data.title as string,
    eventDate: data.event_date as string,
    isAllDay: data.is_all_day as boolean,
  };
}

export async function createEventResponse(
  service: SupabaseClient,
  values: {
    eventId: string;
    userId: string;
    status?: "present" | "tentative" | "absent";
    guestCount?: number;
  },
): Promise<string> {
  const { data, error } = await service
    .from("event_responses")
    .insert({
      event_id: values.eventId,
      user_id: values.userId,
      status: values.status ?? "present",
      guest_count: values.guestCount ?? 0,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `event response fixture insert failed: ${error.code ?? "unknown"} ${error.message}`,
    );
  }

  return data.id as string;
}

export async function storageStateFor(
  status: LocalSupabaseStatus,
  user: TestUser,
  filename: string,
): Promise<string> {
  return createStorageState(status, user.email, user.password, filename);
}

export async function deleteUser(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) {
    throw new Error(`Failed to delete test user ${userId}: ${error.message}`);
  }
}
