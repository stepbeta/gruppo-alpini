import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    // Database integration suites share one local Supabase database. Running
    // test files serially keeps their truncate/reset fixtures deterministic.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportOnFailure: true,
      // Integration support modules are test infrastructure, not application
      // code; keep them out of the unit-coverage baseline.
      exclude: ["tests/**"],
    },
  },
});
