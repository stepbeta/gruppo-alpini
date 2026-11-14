import { beforeAll, beforeEach, expect, it } from "vitest";
import { PRIVACY_POLICY_VERSION } from "../../lib/privacy";
import {
  createEvent,
  createEventResponse,
  createEventTemplate,
  createGenericRequest,
  createUser,
  expectPostgrestError,
  recordConsent,
} from "./support/fixtures";
import {
  bootstrapServiceRole,
  describeIntegration,
  resetDatabase,
} from "./support/local-supabase";

describeIntegration("consent: restrictive layer and append-only history", (ctx) => {
  beforeAll(async () => {
    await bootstrapServiceRole(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  it("hides member data from a signed-in account without a consent row", async () => {
    const admin = await createUser(ctx, { admin: true, consent: false });
    const member = await createUser(ctx);
    const event = await createEvent(ctx.service, { created_by: admin.id });
    const template = await createEventTemplate(ctx.service, {
      created_by: admin.id,
    });
    const response = await createEventResponse(ctx.service, {
      event_id: event.id,
      user_id: member.id,
    });
    const request = await createGenericRequest(ctx.service, {
      user_id: member.id,
    });

    const hiddenReads = await Promise.all([
      admin.client.from("profiles").select("id"),
      admin.client.from("events").select("id"),
      admin.client.from("event_responses").select("id"),
      admin.client.from("generic_requests").select("id"),
      admin.client.from("event_templates").select("id"),
    ]);

    for (const result of hiddenReads) {
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    }

    await recordConsent(admin.client, admin.id);

    const [profiles, events, responses, requests, templates] = await Promise.all([
      admin.client.from("profiles").select("id"),
      admin.client.from("events").select("id"),
      admin.client.from("event_responses").select("id"),
      admin.client.from("generic_requests").select("id"),
      admin.client.from("event_templates").select("id"),
    ]);

    expect(profiles.data?.map((row) => row.id).sort()).toEqual(
      [admin.id, member.id].sort(),
    );
    expect(events.data).toEqual([{ id: event.id }]);
    expect(responses.data).toEqual([{ id: response.id }]);
    expect(requests.data).toEqual([{ id: request.id }]);
    expect(templates.data).toEqual([{ id: template.id }]);
  });

  it("blocks writes until consent is recorded and allows them afterwards", async () => {
    const admin = await createUser(ctx, { admin: true, consent: false });
    const member = await createUser(ctx, { consent: false });
    const event = await createEvent(ctx.service, { created_by: admin.id });

    const eventAttempt = await admin.client
      .from("events")
      .insert({ title: "No consent event", event_date: new Date().toISOString() })
      .select("id");
    expectPostgrestError(eventAttempt.error, "42501");

    const templateAttempt = await admin.client
      .from("event_templates")
      .insert({ title: "No consent template", is_all_day: true })
      .select("id");
    expectPostgrestError(templateAttempt.error, "42501");

    const requestAttempt = await member.client
      .from("generic_requests")
      .insert({ user_id: member.id, message: "No consent request" })
      .select("id");
    expectPostgrestError(requestAttempt.error, "42501");

    const responseAttempt = await member.client
      .from("event_responses")
      .insert({
        event_id: event.id,
        user_id: member.id,
        status: "present",
      })
      .select("id");
    expectPostgrestError(responseAttempt.error, "42501");

    const profileUpdate = await member.client
      .from("profiles")
      .update({ full_name: "Should not change" })
      .eq("id", member.id)
      .select("id");
    expect(profileUpdate.error).toBeNull();
    expect(profileUpdate.data).toEqual([]);

    await recordConsent(member.client, member.id);
    await recordConsent(admin.client, admin.id);

    const allowedRequest = await member.client
      .from("generic_requests")
      .insert({ user_id: member.id, message: "Consented request" })
      .select("id")
      .single();
    expect(allowedRequest.error).toBeNull();

    const allowedResponse = await member.client
      .from("event_responses")
      .insert({
        event_id: event.id,
        user_id: member.id,
        status: "tentative",
      })
      .select("id")
      .single();
    expect(allowedResponse.error).toBeNull();

    const allowedEvent = await admin.client
      .from("events")
      .insert({ title: "Consented event", event_date: new Date().toISOString() })
      .select("id, created_by")
      .single();
    expect(allowedEvent.error).toBeNull();
    expect(allowedEvent.data?.created_by).toBe(admin.id);

    const { data: profileRow } = await ctx.service
      .from("profiles")
      .select("full_name")
      .eq("id", member.id)
      .single();
    expect(profileRow?.full_name).not.toBe("Should not change");
  });

  it("forces accepted_at server-side", async () => {
    const user = await createUser(ctx, { consent: false });
    const before = Date.now();

    const { data, error } = await user.client
      .from("user_consents")
      .insert({
        user_id: user.id,
        policy_version: PRIVACY_POLICY_VERSION,
        accepted_at: "2000-01-01T00:00:00.000Z",
      })
      .select("id, accepted_at, policy_version")
      .single();

    expect(error).toBeNull();
    expect(data?.policy_version).toBe(PRIVACY_POLICY_VERSION);

    const acceptedAt = new Date(data?.accepted_at ?? 0).getTime();
    expect(acceptedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(acceptedAt).toBeLessThanOrEqual(Date.now() + 60_000);

    const { data: raw } = await ctx.service
      .from("user_consents")
      .select("accepted_at")
      .eq("id", data?.id ?? "")
      .single();
    expect(raw?.accepted_at).toBe(data?.accepted_at);
  });

  it("is append-only: update and delete return 42501 and keep the row", async () => {
    const user = await createUser(ctx);
    const before = await ctx.service
      .from("user_consents")
      .select("id, policy_version")
      .eq("user_id", user.id)
      .single();
    expect(before.error).toBeNull();

    const update = await user.client
      .from("user_consents")
      .update({ policy_version: "tampered" })
      .eq("user_id", user.id)
      .select("id");
    expectPostgrestError(update.error, "42501");

    const remove = await user.client
      .from("user_consents")
      .delete()
      .eq("user_id", user.id)
      .select("id");
    expectPostgrestError(remove.error, "42501");

    const after = await ctx.service
      .from("user_consents")
      .select("id, policy_version")
      .eq("user_id", user.id);
    expect(after.error).toBeNull();
    expect(after.data).toEqual([
      { id: before.data?.id, policy_version: PRIVACY_POLICY_VERSION },
    ]);
  });

  it("allows one row per policy version and keeps older versions", async () => {
    const user = await createUser(ctx);

    const duplicate = await user.client
      .from("user_consents")
      .insert({
        user_id: user.id,
        policy_version: PRIVACY_POLICY_VERSION,
      })
      .select("id");
    expectPostgrestError(
      duplicate.error,
      "23505",
      "user_consents_user_version_unique",
    );

    const older = await user.client
      .from("user_consents")
      .insert({ user_id: user.id, policy_version: "2020-01-01" })
      .select("id")
      .single();
    expect(older.error).toBeNull();

    const { data } = await user.client
      .from("user_consents")
      .select("policy_version")
      .eq("user_id", user.id)
      .order("policy_version");
    expect(data).toEqual([
      { policy_version: "2020-01-01" },
      { policy_version: PRIVACY_POLICY_VERSION },
    ]);
  });

  it("scopes consent reads to the owner and consented administrators", async () => {
    const first = await createUser(ctx);
    const second = await createUser(ctx);
    const admin = await createUser(ctx, { admin: true, consent: false });

    const ownerView = await first.client
      .from("user_consents")
      .select("user_id")
      .order("user_id");
    expect(ownerView.error).toBeNull();
    expect(ownerView.data).toEqual([{ user_id: first.id }]);

    const unconsentedAdminView = await admin.client
      .from("user_consents")
      .select("user_id");
    expect(unconsentedAdminView.error).toBeNull();
    expect(unconsentedAdminView.data).toEqual([]);

    await recordConsent(admin.client, admin.id);

    const consentedAdminView = await admin.client
      .from("user_consents")
      .select("user_id")
      .order("user_id");
    expect(consentedAdminView.error).toBeNull();
    expect(
      (consentedAdminView.data ?? []).map((row) => row.user_id).sort(),
    ).toEqual([admin.id, first.id, second.id].sort());
  });

  it("rejects recording consent for another user and blank policy versions", async () => {
    const first = await createUser(ctx, { consent: false });
    const second = await createUser(ctx);

    const foreignConsent = await first.client
      .from("user_consents")
      .insert({ user_id: second.id, policy_version: PRIVACY_POLICY_VERSION })
      .select("id");
    expectPostgrestError(foreignConsent.error, "42501");

    const blankVersion = await first.client
      .from("user_consents")
      .insert({ user_id: first.id, policy_version: "   " })
      .select("id");
    expectPostgrestError(
      blankVersion.error,
      "23514",
      "user_consents_policy_version_non_blank",
    );
  });
});
