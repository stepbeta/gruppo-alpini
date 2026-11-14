import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import { describe, it } from "vitest";

/**
 * Reads the local Supabase credentials from `supabase status`.
 *
 * The suite never reads `.env.local` and refuses any API URL that is not a
 * loopback address, so a developer cannot accidentally point these tests at
 * the linked cloud project.
 */
export type LocalSupabaseStatus = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
  dbUrl: string;
};

const START_INSTRUCTIONS = [
  "[integration] Local Supabase stack is not running.",
  "Start Docker, then run:",
  "  npm run db:start",
  "  npm run db:reset",
  "Database integration tests are skipped. `npm run test:integration` fails instead of skipping.",
].join("\n");

function readString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`supabase status did not return ${key}`);
  }
  return value;
}

function readLocalSupabaseStatus(): LocalSupabaseStatus {
  const localBinary = join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "supabase.cmd" : "supabase",
  );
  const command = existsSync(localBinary) ? localBinary : "supabase";
  const stdout = execFileSync(command, ["status", "-o", "json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  });

  // The CLI can print update notices around the JSON document; take the object.
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("supabase status did not return JSON");
  }

  const raw = JSON.parse(stdout.slice(start, end + 1)) as Record<
    string,
    unknown
  >;
  const apiUrl = readString(raw, "API_URL");
  const parsedUrl = new URL(apiUrl);
  const isLoopback =
    parsedUrl.hostname === "127.0.0.1" ||
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "::1" ||
    parsedUrl.hostname === "[::1]";

  if (!isLoopback) {
    throw new Error(
      `Refusing to run integration tests against non-local Supabase URL ${apiUrl}`,
    );
  }

  return {
    apiUrl,
    anonKey: readString(raw, "ANON_KEY"),
    serviceRoleKey: readString(raw, "SERVICE_ROLE_KEY"),
    jwtSecret: readString(raw, "JWT_SECRET"),
    dbUrl: readString(raw, "DB_URL"),
  };
}

let cachedStatus: LocalSupabaseStatus | null | undefined;

export function getLocalSupabase(): LocalSupabaseStatus | null {
  if (cachedStatus !== undefined) return cachedStatus;

  try {
    cachedStatus = readLocalSupabaseStatus();
    return cachedStatus;
  } catch (error) {
    cachedStatus = null;

    if (process.env.SUPABASE_INTEGRATION_REQUIRED === "1") {
      throw new Error(START_INSTRUCTIONS, { cause: error });
    }

    console.warn(START_INSTRUCTIONS);
    return null;
  }
}

export type IntegrationContext = {
  status: LocalSupabaseStatus;
  service: SupabaseClient;
  anon: SupabaseClient;
  clientFor: (
    userId: string,
    options?: { expiresInSeconds?: number },
  ) => SupabaseClient;
  signIn: (email: string, password: string) => Promise<SupabaseClient>;
};

const AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

/** Creates an HS256 JWT with the same secret the local stack uses. */
export function mintLocalJwt(
  jwtSecret: string,
  userId: string,
  options: { role?: string; expiresInSeconds?: number } = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "supabase-demo",
      role: options.role ?? "authenticated",
      aud: "authenticated",
      sub: userId,
      iat: now,
      exp: now + (options.expiresInSeconds ?? 3600),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export function createIntegrationContext(
  status: LocalSupabaseStatus,
): IntegrationContext {
  const service = createClient(status.apiUrl, status.serviceRoleKey, {
    auth: AUTH_OPTIONS,
  });
  const anon = createClient(status.apiUrl, status.anonKey, {
    auth: AUTH_OPTIONS,
  });

  return {
    status,
    service,
    anon,
    clientFor(userId, options = {}) {
      return createClient(status.apiUrl, status.anonKey, {
        auth: AUTH_OPTIONS,
        global: {
          headers: {
            Authorization: `Bearer ${mintLocalJwt(status.jwtSecret, userId, options)}`,
          },
        },
      });
    },
    async signIn(email, password) {
      const authClient = createClient(status.apiUrl, status.anonKey, {
        auth: AUTH_OPTIONS,
      });
      const { data, error } = await authClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(`signInWithPassword failed: ${error.message}`);
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("signInWithPassword returned no access token");
      }

      return createClient(status.apiUrl, status.anonKey, {
        auth: AUTH_OPTIONS,
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
    },
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * The local CLI can start with `auto_expose_new_tables = false` (see
 * supabase/config.toml). In that mode only the explicit migration grants exist,
 * and `service_role` has no table privileges until we add them here. Production
 * service_role is a trusted, server-only role, so granting it access keeps the
 * test fixtures and raw assertions equivalent to the deployed model without
 * widening anon/authenticated privileges.
 */
export async function bootstrapServiceRole(
  ctx: IntegrationContext,
): Promise<void> {
  const client = new PgClient({ connectionString: ctx.status.dbUrl });
  await client.connect();

  try {
    await client.query("grant usage on schema public to service_role");
    await client.query(
      "grant all privileges on all tables in schema public to service_role",
    );
    await client.query(
      "grant all privileges on all sequences in schema public to service_role",
    );
    await client.query(
      "grant all privileges on all functions in schema public to service_role",
    );
    await client.query("notify pgrst, 'reload schema'");

    const { rows } = await client.query<{
      anon_events_select: boolean;
      authenticated_consents_update: boolean;
    }>(
      `select
         has_table_privilege('anon', 'public.events', 'SELECT') as anon_events_select,
         has_table_privilege('authenticated', 'public.user_consents', 'UPDATE') as authenticated_consents_update`,
    );

    if (
      rows[0]?.anon_events_select ||
      rows[0]?.authenticated_consents_update
    ) {
      throw new Error(
        [
          "The local stack still auto-exposes public tables.",
          "Run `npm run db:reset` so supabase/config.toml (auto_expose_new_tables = false) is applied;",
          "otherwise grant and append-only tests cannot observe the production boundary.",
        ].join(" "),
      );
    }
  } finally {
    await client.end();
  }

  const deadline = Date.now() + 10_000;
  for (;;) {
    const { error } = await ctx.service
      .from("events")
      .select("id", { head: true, count: "exact" });

    if (!error) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `service_role still cannot query public.events: ${error.code} ${error.message}`,
      );
    }

    await delay(200);
  }
}

const CLEANUP_TABLES = [
  "purchase_orders",
  "purchase_items",
  "event_responses",
  "generic_requests",
  "event_templates",
  "events",
  "announcement_banners",
  "user_consents",
] as const;

/** Removes fixture rows and auth users so every test starts from an empty DB. */
export async function resetDatabase(ctx: IntegrationContext): Promise<void> {
  for (const table of CLEANUP_TABLES) {
    const { error } = await ctx.service
      .from(table)
      .delete()
      .not("id", "is", null);

    if (error) {
      throw new Error(
        `Failed to clear ${table}: ${error.code ?? "unknown"} ${error.message}`,
      );
    }
  }

  const users: { id: string }[] = [];
  let page = 1;

  for (;;) {
    const { data, error } = await ctx.service.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const batch = data?.users ?? [];
    users.push(...batch.map((user) => ({ id: user.id })));

    if (batch.length < 1000) break;
    page += 1;
  }

  for (const user of users) {
    const { error } = await ctx.service.auth.admin.deleteUser(user.id);
    if (error && error.status !== 404) {
      throw new Error(`Failed to delete auth user ${user.id}: ${error.message}`);
    }
  }
}

/**
 * Defines an integration suite only when the local stack is available.
 *
 * A skipped suite is intentional for `npm test` on machines without Docker.
 * `npm run test:integration` sets SUPABASE_INTEGRATION_REQUIRED=1 and turns the
 * missing stack into a hard failure instead.
 */
export function describeIntegration(
  name: string,
  define: (ctx: IntegrationContext) => void,
): void {
  const status = getLocalSupabase();

  if (!status) {
    describe.skip(`${name} [local Supabase unavailable]`, () => {
      it("skips until npm run db:start && npm run db:reset", () => {});
    });
    return;
  }

  describe(name, () => define(createIntegrationContext(status)));
}
