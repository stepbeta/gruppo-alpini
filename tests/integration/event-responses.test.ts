import { beforeAll, beforeEach, expect, it } from "vitest";
import {
  createEvent,
  createEventResponse,
  createUser,
  expectPostgrestError,
} from "./support/fixtures";
import {
  bootstrapServiceRole,
  describeIntegration,
  resetDatabase,
} from "./support/local-supabase";

describeIntegration("event_responses: owner writes and administrator reads", (ctx) => {
  beforeAll(async () => {
    await bootstrapServiceRole(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  it("returns 42501 when an anonymous visitor reads responses", async () => {
    const result = await ctx.anon.from("event_responses").select("id");
    expectPostgrestError(result.error, "42501", "permission denied");
  });

  it("shows members only their own response and administrators all rows", async () => {
    const admin = await createUser(ctx, { admin: true });
    const first = await createUser(ctx);
    const second = await createUser(ctx);
    const event = await createEvent(admin.client);
    const firstResponse = await createEventResponse(first.client, {
      event_id: event.id,
      user_id: first.id,
    });
    await createEventResponse(second.client, {
      event_id: event.id,
      user_id: second.id,
    });

    const memberView = await first.client
      .from("event_responses")
      .select("id")
      .order("id");
    expect(memberView.error).toBeNull();
    expect(memberView.data).toEqual([{ id: firstResponse.id }]);

    const adminView = await admin.client
      .from("event_responses")
      .select("id")
      .order("id");
    expect(adminView.error).toBeNull();
    expect(adminView.data).toHaveLength(2);
  });

  it("enforces the unique (event_id, user_id) constraint", async () => {
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
    expectPostgrestError(
      duplicate.error,
      "23505",
      "event_responses_event_id_user_id_key",
    );
  });

  it("lets the owner update their response but not another member or an administrator", async () => {
    const admin = await createUser(ctx, { admin: true });
    const first = await createUser(ctx);
    const second = await createUser(ctx);
    const event = await createEvent(admin.client);
    const secondEvent = await createEvent(admin.client);
    const firstResponse = await createEventResponse(first.client, {
      event_id: event.id,
      user_id: first.id,
      guest_count: 0,
    });

    const ownerUpdate = await first.client
      .from("event_responses")
      .update({ status: "tentative", guest_count: 2 })
      .eq("id", firstResponse.id)
      .select("id, status, guest_count")
      .single();
    expect(ownerUpdate.error).toBeNull();
    expect(ownerUpdate.data).toEqual({
      id: firstResponse.id,
      status: "tentative",
      guest_count: 2,
    });

    const otherMemberUpdate = await second.client
      .from("event_responses")
      .update({ status: "absent", guest_count: 0 })
      .eq("id", firstResponse.id)
      .select("id");
    expect(otherMemberUpdate.error).toBeNull();
    expect(otherMemberUpdate.data).toEqual([]);

    const foreignInsert = await second.client
      .from("event_responses")
      .insert({
        event_id: secondEvent.id,
        user_id: first.id,
        status: "present",
      })
      .select("id");
    expectPostgrestError(foreignInsert.error, "42501");

    const adminUpdate = await admin.client
      .from("event_responses")
      .update({ status: "absent", guest_count: 0 })
      .eq("id", firstResponse.id)
      .select("id");
    expect(adminUpdate.error).toBeNull();
    expect(adminUpdate.data).toEqual([]);

    const adminOwnResponse = await createEventResponse(admin.client, {
      event_id: secondEvent.id,
      user_id: admin.id,
      status: "present",
      guest_count: 1,
    });
    expect(adminOwnResponse.user_id).toBe(admin.id);

    const { data: raw } = await ctx.service
      .from("event_responses")
      .select("status, guest_count")
      .eq("id", firstResponse.id)
      .single();
    expect(raw).toEqual({ status: "tentative", guest_count: 2 });
  });

  it("rejects a negative guest_count and keeps zero/absent values", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const event = await createEvent(admin.client);

    const negative = await member.client
      .from("event_responses")
      .insert({
        event_id: event.id,
        user_id: member.id,
        status: "present",
        guest_count: -1,
      })
      .select("id");
    expectPostgrestError(
      negative.error,
      "23514",
      "event_responses_guest_count_check",
    );

    const zero = await createEventResponse(member.client, {
      event_id: event.id,
      user_id: member.id,
      status: "present",
      guest_count: 0,
    });

    const absent = await member.client
      .from("event_responses")
      .update({ status: "absent", guest_count: 4 })
      .eq("id", zero.id)
      .select("status, guest_count")
      .single();
    expect(absent.error).toBeNull();
    expect(absent.data).toEqual({ status: "absent", guest_count: 4 });
  });

  it("blocks pending and rejected accounts from reading or writing responses", async () => {
    const admin = await createUser(ctx, { admin: true });
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });
    const event = await createEvent(admin.client);

    for (const user of [pending, rejected]) {
      const read = await user.client.from("event_responses").select("id");
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);

      const insert = await user.client
        .from("event_responses")
        .insert({
          event_id: event.id,
          user_id: user.id,
          status: "present",
        })
        .select("id");
      expectPostgrestError(insert.error, "42501");
    }
  });

  it("does not grant DELETE on responses", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const event = await createEvent(admin.client);
    const response = await createEventResponse(member.client, {
      event_id: event.id,
      user_id: member.id,
    });

    const remove = await member.client
      .from("event_responses")
      .delete()
      .eq("id", response.id)
      .select("id");
    expectPostgrestError(remove.error, "42501", "permission denied");

    const { data } = await ctx.service
      .from("event_responses")
      .select("id")
      .eq("id", response.id);
    expect(data).toEqual([{ id: response.id }]);
  });
});
