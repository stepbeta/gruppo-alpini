import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { Client as PgClient } from "pg";

/**
 * Local Supabase helpers for the Playwright suite.
 *
 * Every credential is read from `supabase status`, never from `.env.local`, and
 * non-loopback URLs are rejected so an E2E run can never touch the cloud
 * project.
 */
export type LocalSupabaseStatus = {
  apiUrl: string;
  publishableKey: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
};

export const E2E_EMAIL_DOMAIN = "e2e.gruppo-alpini.test";
export const E2E_PASSWORD = "e2e-password-123";
export const E2E_EVENT_PREFIX = "E2E · ";
export const E2E_REQUEST_PREFIX = "E2E · ";
export const E2E_BASE_URL = "http://127.0.0.1:3000";
export const E2E_AUTH_DIR = join(process.cwd(), "tests", "e2e", ".auth");

const AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

function supabaseBinary(): string {
  const local = join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "supabase.cmd" : "supabase",
  );
  return existsSync(local) ? local : "supabase";
}

const STATUS_TIMEOUT_MS = 60_000;
const STATUS_ATTEMPTS = 3;

/** Blocks without timers so the synchronous status reader can retry. */
function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function readString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`supabase status did not return ${key}`);
  }
  return value;
}

/** Reads and validates the local stack status. Throws with recovery steps. */
export function readLocalSupabaseStatus(): LocalSupabaseStatus {
  let stdout: string | null = null;
  let lastError: unknown = null;

  // `supabase db reset` restarts containers; the first status call can be slow
  // or time out while the stack comes back. Retry before giving up.
  for (let attempt = 1; attempt <= STATUS_ATTEMPTS; attempt += 1) {
    try {
      stdout = execFileSync(supabaseBinary(), ["status", "-o", "json"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: STATUS_TIMEOUT_MS,
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < STATUS_ATTEMPTS) sleepSync(2_000);
    }
  }

  if (stdout === null) {
    throw new Error(
      [
        "[e2e] Local Supabase is not running.",
        "Start Docker, then run:",
        "  npm run db:start",
        "  npm run db:reset",
        "Then run the suite with: npm run test:e2e",
      ].join("\n"),
      { cause: lastError },
    );
  }

  // The CLI occasionally prints update notices around the JSON document.
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("supabase status did not return JSON");
  }

  const raw = JSON.parse(stdout.slice(start, end + 1)) as Record<
    string,
    unknown
  >;
  const apiUrl = readString(raw, "API_URL");
  const parsed = new URL(apiUrl);
  const isLoopback =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "::1" ||
    parsed.hostname === "[::1]";

  if (!isLoopback) {
    throw new Error(
      `[e2e] Refusing to run against non-local Supabase URL ${apiUrl}`,
    );
  }

  return {
    apiUrl,
    publishableKey:
      typeof raw.PUBLISHABLE_KEY === "string"
        ? raw.PUBLISHABLE_KEY
        : readString(raw, "ANON_KEY"),
    anonKey: readString(raw, "ANON_KEY"),
    serviceRoleKey: readString(raw, "SERVICE_ROLE_KEY"),
    dbUrl: readString(raw, "DB_URL"),
  };
}

export function createServiceClient(
  status: LocalSupabaseStatus,
): SupabaseClient {
  return createClient(status.apiUrl, status.serviceRoleKey, {
    auth: AUTH_OPTIONS,
  });
}

/**
 * After `supabase db reset` the local stack does not grant table privileges to
 * `service_role` (auto_expose_new_tables = false). The role is trusted and
 * server-only in production, so fixture setup receives the same access.
 */
export async function bootstrapServiceRole(
  status: LocalSupabaseStatus,
): Promise<void> {
  const pg = new PgClient({ connectionString: status.dbUrl });
  await pg.connect();

  try {
    await pg.query("grant usage on schema public to service_role");
    await pg.query(
      "grant all privileges on all tables in schema public to service_role",
    );
    await pg.query(
      "grant all privileges on all sequences in schema public to service_role",
    );
    await pg.query(
      "grant all privileges on all functions in schema public to service_role",
    );
    await pg.query("notify pgrst, 'reload schema'");
  } finally {
    await pg.end();
  }
}

/** Signs a seeded user in and returns the real Supabase session object. */
export async function signInLocal(
  status: LocalSupabaseStatus,
  email: string,
  password: string,
): Promise<Session> {
  const client = createClient(status.apiUrl, status.anonKey, {
    auth: AUTH_OPTIONS,
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(
      `Unable to sign in ${email}: ${error?.message ?? "no session returned"}`,
    );
  }

  return data.session;
}

/** Matches the storage key used by supabase-js in the browser. */
export function authStorageKey(apiUrl: string): string {
  return `sb-${new URL(apiUrl).hostname.split(".")[0]}-auth-token`;
}

export type StorageState = {
  cookies: [];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

export function buildStorageState(
  status: LocalSupabaseStatus,
  session: Session,
): StorageState {
  return {
    cookies: [],
    origins: [
      {
        origin: E2E_BASE_URL,
        localStorage: [
          {
            name: authStorageKey(status.apiUrl),
            value: JSON.stringify(session),
          },
        ],
      },
    ],
  };
}

export function writeStorageState(
  status: LocalSupabaseStatus,
  session: Session,
  filename: string,
): string {
  mkdirSync(E2E_AUTH_DIR, { recursive: true });
  const path = join(E2E_AUTH_DIR, filename);
  writeFileSync(path, JSON.stringify(buildStorageState(status, session), null, 2));
  return path;
}

/** Signs in and writes a Playwright storage state for a one-off test user. */
export async function createStorageState(
  status: LocalSupabaseStatus,
  email: string,
  password: string,
  filename: string,
): Promise<string> {
  const session = await signInLocal(status, email, password);
  return writeStorageState(status, session, filename);
}

async function listAuthUsers(service: SupabaseClient): Promise<
  Array<{ id: string; email?: string }>
> {
  const users: Array<{ id: string; email?: string }> = [];
  let page = 1;

  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const batch = data?.users ?? [];
    users.push(...batch.map((user) => ({ id: user.id, email: user.email })));
    if (batch.length < 1000) break;
    page += 1;
  }

  return users;
}

function isE2EUser(email: string | undefined): boolean {
  return email?.endsWith(`@${E2E_EMAIL_DOMAIN}`) === true;
}

/**
 * Removes only the fixtures owned by this suite. It runs before seeding (so a
 * direct `npx playwright test` is repeatable) and after the run.
 */
export async function cleanupE2EData(
  service: SupabaseClient,
): Promise<void> {
  const users = (await listAuthUsers(service)).filter((user) =>
    isE2EUser(user.email),
  );
  const userIds = users.map((user) => user.id);

  const { data: eventRows, error: eventReadError } = await service
    .from("events")
    .select("id")
    .like("title", `${E2E_EVENT_PREFIX}%`);

  if (eventReadError) {
    throw new Error(
      `Failed to read E2E events: ${eventReadError.code ?? "unknown"} ${eventReadError.message}`,
    );
  }

  const eventIds = (eventRows ?? []).map((event) => event.id as string);

  if (eventIds.length > 0) {
    await service.from("event_responses").delete().in("event_id", eventIds);
  }

  if (userIds.length > 0) {
    await service.from("event_responses").delete().in("user_id", userIds);
    await service
      .from("generic_requests")
      .delete()
      .in("user_id", userIds);
  }

  await service
    .from("generic_requests")
    .delete()
    .like("message", `${E2E_REQUEST_PREFIX}%`);

  if (eventIds.length > 0) {
    await service.from("events").delete().in("id", eventIds);
  }

  for (const user of users) {
    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error && error.status !== 404) {
      throw new Error(`Failed to delete E2E user ${user.id}: ${error.message}`);
    }
  }
}
