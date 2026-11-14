#!/usr/bin/env node
/**
 * Starts the Next.js dev server configured for the local Supabase stack.
 *
 * `.env.local` normally points at the cloud project, so the E2E run overrides
 * the variables explicitly. Next.js does not overwrite variables that already
 * exist in `process.env`, and the values here come from `supabase status`.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PORT = 3000;
const isWindows = process.platform === "win32";
const supabaseBin = existsSync(
  join(process.cwd(), "node_modules", ".bin", isWindows ? "supabase.cmd" : "supabase"),
)
  ? join(process.cwd(), "node_modules", ".bin", isWindows ? "supabase.cmd" : "supabase")
  : "supabase";

function fail(message) {
  console.error(`[e2e] ${message}`);
  process.exit(1);
}

function readLocalStatus() {
  let stdout;

  try {
    stdout = execFileSync(supabaseBin, ["status", "-o", "json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
  } catch {
    fail(
      [
        "Local Supabase is not running, so the E2E dev server cannot be configured.",
        "Start it first with: npm run db:start && npm run db:reset",
        "Then run: npm run test:e2e",
      ].join("\n"),
    );
  }

  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end <= start) {
    fail("supabase status did not return JSON.");
  }

  const raw = JSON.parse(stdout.slice(start, end + 1));
  const apiUrl = raw.API_URL;
  const publishableKey = raw.PUBLISHABLE_KEY ?? raw.ANON_KEY;
  const serviceRoleKey = raw.SERVICE_ROLE_KEY;

  if (
    typeof apiUrl !== "string" ||
    typeof publishableKey !== "string" ||
    typeof serviceRoleKey !== "string"
  ) {
    fail("supabase status is missing API_URL, PUBLISHABLE_KEY or SERVICE_ROLE_KEY.");
  }

  const parsed = new URL(apiUrl);
  const isLoopback =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "::1" ||
    parsed.hostname === "[::1]";

  if (!isLoopback) {
    fail(`Refusing to start E2E against non-local Supabase URL ${apiUrl}`);
  }

  return { apiUrl, publishableKey, serviceRoleKey };
}

const status = readLocalStatus();
const npmBin = isWindows ? "npm.cmd" : "npm";
const child = spawn(npmBin, ["run", "dev", "--", "--port", String(PORT)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: status.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: status.serviceRoleKey,
  },
  stdio: "inherit",
  shell: isWindows,
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!child.killed) {
    child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shutdown(signal);
    // Playwright kills the web-server process when the run ends.
    setTimeout(() => process.exit(0), 2_000).unref();
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[e2e] Failed to start the dev server:", error);
  process.exit(1);
});
