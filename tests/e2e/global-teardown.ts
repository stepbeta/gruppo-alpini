import {
  bootstrapServiceRole,
  cleanupE2EData,
  createServiceClient,
  readLocalSupabaseStatus,
} from "./support/local-supabase";

/**
 * Removes fixtures created by the suite without touching unrelated local data.
 *
 * `npm run test:e2e` uses a freshly reset database, but targeted cleanup keeps
 * `npx playwright test` repeatable and avoids leaving anonymized rows behind.
 */
export default async function globalTeardown(): Promise<void> {
  try {
    const status = readLocalSupabaseStatus();
    await bootstrapServiceRole(status);
    await cleanupE2EData(createServiceClient(status));
    console.log("[e2e] Removed E2E fixtures from the local database.");
  } catch (error) {
    console.warn("[e2e] Global teardown could not clean up fixtures:", error);
  }
}
