import { beforeAll, beforeEach, expect, it } from "vitest";
import {
  createGenericRequest,
  createUser,
  expectPostgrestError,
} from "./support/fixtures";
import {
  bootstrapServiceRole,
  describeIntegration,
  resetDatabase,
} from "./support/local-supabase";

describeIntegration("generic_requests: column grant, RLS and text integrity", (ctx) => {
  beforeAll(async () => {
    await bootstrapServiceRole(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  it("returns 42501 when an anonymous visitor reads requests", async () => {
    const result = await ctx.anon.from("generic_requests").select("id");
    expectPostgrestError(result.error, "42501", "permission denied");
  });

  it("lets members insert and read their own requests while administrators read all", async () => {
    const admin = await createUser(ctx, { admin: true });
    const first = await createUser(ctx);
    const second = await createUser(ctx);
    const firstRequest = await createGenericRequest(first.client, {
      user_id: first.id,
      message: "First request",
    });
    const secondRequest = await createGenericRequest(second.client, {
      user_id: second.id,
      message: "Second request",
    });

    const ownerView = await first.client
      .from("generic_requests")
      .select("id, message")
      .order("id");
    expect(ownerView.error).toBeNull();
    expect(ownerView.data).toEqual([
      { id: firstRequest.id, message: "First request" },
    ]);

    const adminView = await admin.client
      .from("generic_requests")
      .select("id")
      .order("id");
    expect(adminView.error).toBeNull();
    expect(adminView.data?.map((row) => row.id).sort()).toEqual(
      [firstRequest.id, secondRequest.id].sort(),
    );
  });

  it("rejects an insert attributed to another member", async () => {
    const first = await createUser(ctx);
    const second = await createUser(ctx);

    const attempt = await first.client
      .from("generic_requests")
      .insert({ user_id: second.id, message: "Forged owner" })
      .select("id");
    expectPostgrestError(attempt.error, "42501");
  });

  it("allows only status updates for administrators and blocks message/owner rewrites", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const other = await createUser(ctx);
    const request = await createGenericRequest(member.client, {
      user_id: member.id,
      message: "Original message",
    });

    const memberStatus = await member.client
      .from("generic_requests")
      .update({ status: "resolved" })
      .eq("id", request.id)
      .select("id");
    expect(memberStatus.error).toBeNull();
    expect(memberStatus.data).toEqual([]);

    const memberMessage = await member.client
      .from("generic_requests")
      .update({ message: "Member rewrite" })
      .eq("id", request.id)
      .select("id");
    expectPostgrestError(memberMessage.error, "42501", "permission denied");

    const adminStatus = await admin.client
      .from("generic_requests")
      .update({ status: "resolved" })
      .eq("id", request.id)
      .select("id, status")
      .single();
    expect(adminStatus.error).toBeNull();
    expect(adminStatus.data).toEqual({ id: request.id, status: "resolved" });

    const adminMessage = await admin.client
      .from("generic_requests")
      .update({ message: "Admin rewrite" })
      .eq("id", request.id)
      .select("id");
    expectPostgrestError(adminMessage.error, "42501", "permission denied");

    const adminOwner = await admin.client
      .from("generic_requests")
      .update({ user_id: other.id })
      .eq("id", request.id)
      .select("id");
    expectPostgrestError(adminOwner.error, "42501", "permission denied");

    const adminStatusAndMessage = await admin.client
      .from("generic_requests")
      .update({ status: "open", message: "Sneaky rewrite" })
      .eq("id", request.id)
      .select("id");
    expectPostgrestError(
      adminStatusAndMessage.error,
      "42501",
      "permission denied",
    );

    const { data: raw } = await ctx.service
      .from("generic_requests")
      .select("message, user_id, status")
      .eq("id", request.id)
      .single();
    expect(raw).toEqual({
      message: "Original message",
      user_id: member.id,
      status: "resolved",
    });
  });

  it("rejects blank messages and invalid statuses", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);

    for (const message of ["", "   "]) {
      const attempt = await member.client
        .from("generic_requests")
        .insert({ user_id: member.id, message })
        .select("id");
      expectPostgrestError(
        attempt.error,
        "23514",
        "generic_requests_message_non_blank",
      );
    }

    const request = await createGenericRequest(member.client, {
      user_id: member.id,
    });

    const invalidStatus = await admin.client
      .from("generic_requests")
      .update({ status: "closed" })
      .eq("id", request.id)
      .select("id");
    expectPostgrestError(invalidStatus.error, "23514");

    const serviceBlank = await ctx.service
      .from("generic_requests")
      .update({ message: "   " })
      .eq("id", request.id)
      .select("id");
    expectPostgrestError(
      serviceBlank.error,
      "23514",
      "generic_requests_message_non_blank",
    );
  });

  it("blocks pending and rejected accounts from reading or submitting requests", async () => {
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });

    for (const user of [pending, rejected]) {
      const read = await user.client.from("generic_requests").select("id");
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);

      const insert = await user.client
        .from("generic_requests")
        .insert({ user_id: user.id, message: "Not allowed yet" })
        .select("id");
      expectPostgrestError(insert.error, "42501");
    }
  });

  it("does not grant DELETE on requests", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const request = await createGenericRequest(member.client, {
      user_id: member.id,
    });

    for (const client of [member.client, admin.client]) {
      const remove = await client
        .from("generic_requests")
        .delete()
        .eq("id", request.id)
        .select("id");
      expectPostgrestError(remove.error, "42501", "permission denied");
    }

    const { data } = await ctx.service
      .from("generic_requests")
      .select("id")
      .eq("id", request.id);
    expect(data).toEqual([{ id: request.id }]);
  });
});
