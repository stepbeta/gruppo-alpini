#!/usr/bin/env node
/**
 * Prepares the local Supabase stack for the Playwright E2E suite.
 *
 * The suite must run against the local stack, never the linked cloud project:
 * the dev-server script derives every credential from `supabase status` and the
 * database is reset below, which would destroy real data.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const isWindows = process.platform === "win32";
const npmBin = isWindows ? "npm.cmd" : "npm";
const supabaseBin = existsSync(
  join(process.cwd(), "node_modules", ".bin", isWindows ? "supabase.cmd" : "supabase"),
)
  ? join(process.cwd(), "node_modules", ".bin", isWindows ? "supabase.cmd" : "supabase")
  : "supabase";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function stackIsRunning() {
  try {
    execFileSync(supabaseBin, ["status", "-o", "json"], {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 30_000,
    });
    return true;
  } catch {
    return false;
  }
}

function waitForStack() {
  // `db reset` restarts containers. Give the CLI a few seconds to answer before
  // Playwright's global setup reads the credentials.
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    if (stackIsRunning()) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
  }

  throw new Error(
    "Local Supabase did not come back after `db reset`. Check `docker ps` and retry.",
  );
}

if (!stackIsRunning()) {
  console.log("[e2e] Local Supabase is stopped; starting it with Docker…");
  run(npmBin, ["run", "db:start"]);
}

console.log("[e2e] Applying migrations from scratch (supabase db reset)…");
run(npmBin, ["run", "db:reset"]);
waitForStack();

console.log("[e2e] Local database ready.");
