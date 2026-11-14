import { beforeAll, beforeEach, expect, it } from "vitest";
import {
  createEvent,
  createEventResponse,
  createEventTemplate,
  createGenericRequest,
  createUser,
} from "./support/fixtures";
import {
  bootstrapServiceRole,
  describeIntegration,
  resetDatabase,
} from "./support/local-supabase";

describeIntegration("deletion: anonymized history and cascaded consent", (ctx) => {
  beforeAll(async () => {
    await bootstrapServiceRole(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  it("clears event and template attribution when the author account is deleted", async () => {
    const admin = await createUser(ctx, { admin: true });
    const event = await createEvent(admin.client, { title: "Retained event" });
    const template = await createEventTemplate(admin.client, {
      title: "Retained template",
    });

    const deletion = await ctx.service.auth.admin.deleteUser(admin.id);
    expect(deletion.error).toBeNull();

    const [events, templates, profiles, consents] = await Promise.all([
      ctx.service.from("events").select("id, title, created_by"),
      ctx.service
        .from("event_templates")
        .select("id, title, created_by"),
      ctx.service.from("profiles").select("id").eq("id", admin.id),
      ctx.service.from("user_consents").select("id").eq("user_id", admin.id),
    ]);

    expect(events.error).toBeNull();
    expect(events.data).toEqual([
      { id: event.id, title: "Retained event", created_by: null },
    ]);
    expect(templates.error).toBeNull();
    expect(templates.data).toEqual([
      { id: template.id, title: "Retained template", created_by: null },
    ]);
    expect(profiles.data).toEqual([]);
    expect(consents.data).toEqual([]);
  });

  it("anonymizes responses and requests after profile deletion but removes consent with the auth user", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const event = await createEvent(admin.client);
    const response = await createEventResponse(member.client, {
      event_id: event.id,
      user_id: member.id,
      status: "present",
      guest_count: 3,
    });
    const request = await createGenericRequest(member.client, {
      user_id: member.id,
      message: "Retained request",
    });

    const profileDeletion = await ctx.service
      .from("profiles")
      .delete()
      .eq("id", member.id);
    expect(profileDeletion.error).toBeNull();

    const [responses, requests, consents] = await Promise.all([
      ctx.service
        .from("event_responses")
        .select("id, user_id, status, guest_count")
        .eq("id", response.id),
      ctx.service
        .from("generic_requests")
        .select("id, user_id, message")
        .eq("id", request.id),
      ctx.service.from("user_consents").select("id").eq("user_id", member.id),
    ]);

    expect(responses.data).toEqual([
      {
        id: response.id,
        user_id: null,
        status: "present",
        guest_count: 3,
      },
    ]);
    expect(requests.data).toEqual([
      { id: request.id, user_id: null, message: "Retained request" },
    ]);
    // Consent references auth.users, not profiles, so it survives profile-only
    // deletion and disappears only when the auth account is removed.
    expect(consents.data).toHaveLength(1);

    const authDeletion = await ctx.service.auth.admin.deleteUser(member.id);
    expect(authDeletion.error).toBeNull();

    const afterAuthDeletion = await ctx.service
      .from("user_consents")
      .select("id")
      .eq("user_id", member.id);
    expect(afterAuthDeletion.data).toEqual([]);
  });

  it("keeps historical attendance totals for deleted members", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const event = await createEvent(admin.client);
    await createEventResponse(member.client, {
      event_id: event.id,
      user_id: member.id,
      status: "present",
      guest_count: 3,
    });

    await ctx.service.auth.admin.deleteUser(member.id);

    const { data, error } = await ctx.service
      .from("event_responses")
      .select("user_id, status, guest_count")
      .eq("event_id", event.id);
    expect(error).toBeNull();

    const responses = data ?? [];
    const present = responses.filter((row) => row.status === "present");
    const guests = present.reduce(
      (total, row) => total + (row.guest_count ?? 0),
      0,
    );

    expect(present).toHaveLength(1);
    expect(present[0].user_id).toBeNull();
    expect(guests).toBe(3);
    expect(responses).toHaveLength(1);
  });

  it("allows several anonymized responses for the same event", async () => {
    const admin = await createUser(ctx, { admin: true });
    const first = await createUser(ctx);
    const second = await createUser(ctx);
    const event = await createEvent(admin.client);

    await createEventResponse(first.client, {
      event_id: event.id,
      user_id: first.id,
      status: "present",
    });
    await createEventResponse(second.client, {
      event_id: event.id,
      user_id: second.id,
      status: "tentative",
    });

    await ctx.service.auth.admin.deleteUser(first.id);
    await ctx.service.auth.admin.deleteUser(second.id);

    const { data, error } = await ctx.service
      .from("event_responses")
      .select("id, user_id, status")
      .eq("event_id", event.id)
      .order("status");

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.every((row) => row.user_id === null)).toBe(true);
    expect(data?.map((row) => row.status).sort()).toEqual([
      "present",
      "tentative",
    ]);
  });
});
