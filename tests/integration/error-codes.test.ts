import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, it } from "vitest";
import {
  createEvent,
  createEventResponse,
  createGenericRequest,
  createUser,
  expectPostgrestError,
  futureIso,
  uniqueSuffix,
} from "./support/fixtures";
import {
  bootstrapServiceRole,
  describeIntegration,
  resetDatabase,
} from "./support/local-supabase";

describeIntegration("error codes: grants, RLS, constraints and PostgREST", (ctx) => {
  beforeAll(async () => {
    await bootstrapServiceRole(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  it("returns 42501 when a role lacks the table grant", async () => {
    const profiles = await ctx.anon.from("profiles").select("id");
    expectPostgrestError(profiles.error, "42501", "permission denied");

    const consents = await ctx.anon.from("user_consents").select("id");
    expectPostgrestError(consents.error, "42501", "permission denied");
  });

  it("returns 42501 for missing update and delete grants", async () => {
    const member = await createUser(ctx);
    const admin = await createUser(ctx, { admin: true });
    const event = await createEvent(admin.client);
    const response = await createEventResponse(member.client, {
      event_id: event.id,
      user_id: member.id,
    });

    const consentUpdate = await member.client
      .from("user_consents")
      .update({ policy_version: "tampered" })
      .eq("user_id", member.id)
      .select("id");
    expectPostgrestError(consentUpdate.error, "42501", "permission denied");

    const responseDelete = await member.client
      .from("event_responses")
      .delete()
      .eq("id", response.id)
      .select("id");
    expectPostgrestError(responseDelete.error, "42501", "permission denied");
  });

  it("returns 42501 for a column-level UPDATE grant violation", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const request = await createGenericRequest(member.client, {
      user_id: member.id,
    });

    const rewrite = await admin.client
      .from("generic_requests")
      .update({ message: "Rewritten" })
      .eq("id", request.id)
      .select("id");
    expectPostgrestError(rewrite.error, "42501", "permission denied");
  });

  it("returns 42501 for an RLS insert denial", async () => {
    const member = await createUser(ctx);

    const eventInsert = await member.client
      .from("events")
      .insert({ title: "Member event", event_date: futureIso() })
      .select("id");
    expectPostgrestError(
      eventInsert.error,
      "42501",
      "row-level security policy",
    );
  });

  it("returns 23505 for the unique response constraint", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const event = await createEvent(admin.client);
    await createEventResponse(member.client, {
      event_id: event.id,
      user_id: member.id,
    });

    const duplicate = await member.client
      .from("event_responses")
      .insert({
        event_id: event.id,
        user_id: member.id,
        status: "absent",
      })
      .select("id");
    expectPostgrestError(duplicate.error, "23505", "duplicate key");
  });

  it("returns 23514 for check-constraint violations", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const event = await createEvent(admin.client);

    const negativeGuests = await member.client
      .from("event_responses")
      .insert({
        event_id: event.id,
        user_id: member.id,
        status: "present",
        guest_count: -1,
      })
      .select("id");
    expectPostgrestError(negativeGuests.error, "23514", "check constraint");

    const blankRequest = await member.client
      .from("generic_requests")
      .insert({ user_id: member.id, message: "   " })
      .select("id");
    expectPostgrestError(blankRequest.error, "23514", "check constraint");
  });

  it("returns 23502 when a required column is missing", async () => {
    const missingTitle = await ctx.service
      .from("events")
      .insert({ event_date: futureIso() })
      .select("id");
    expectPostgrestError(missingTitle.error, "23502", "null value");
  });

  it("returns 23503 for a missing foreign key", async () => {
    const member = await createUser(ctx);

    const response = await member.client
      .from("event_responses")
      .insert({
        event_id: randomUUID(),
        user_id: member.id,
        status: "present",
      })
      .select("id");
    expectPostgrestError(response.error, "23503", "foreign key");
  });

  it("returns 22007 for an invalid timestamp", async () => {
    const admin = await createUser(ctx, { admin: true });

    const invalidDate = await admin.client
      .from("events")
      .insert({
        title: `Invalid date ${uniqueSuffix()}`,
        event_date: "not-a-date",
      })
      .select("id");
    expectPostgrestError(invalidDate.error, "22007", "invalid input syntax");
  });

  it("returns PGRST204 for an unknown column", async () => {
    const admin = await createUser(ctx, { admin: true });

    const unknownColumn = await admin.client
      .from("events")
      .insert({
        title: `Unknown column ${uniqueSuffix()}`,
        event_date: futureIso(),
        nonexistent_column: true,
      })
      .select("id");
    expectPostgrestError(unknownColumn.error, "PGRST204", "nonexistent_column");
  });

  it("returns PGRST116 when single() sees no row", async () => {
    const member = await createUser(ctx);

    const missing = await member.client
      .from("profiles")
      .select("id")
      .eq("id", randomUUID())
      .single();
    expectPostgrestError(missing.error, "PGRST116", "single JSON object");
  });

  it("returns PGRST303 for an expired JWT", async () => {
    const member = await createUser(ctx);
    const expiredClient = ctx.clientFor(member.id, { expiresInSeconds: -60 });

    const result = await expiredClient.from("profiles").select("id");
    expectPostgrestError(result.error, "PGRST303", "JWT expired");
  });
});
