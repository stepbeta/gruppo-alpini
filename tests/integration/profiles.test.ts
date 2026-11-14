import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, expect, it } from "vitest";
import {
  ADMIN_LIMIT_MESSAGE,
  SELF_DEMOTION_MESSAGE,
} from "../../lib/profile";
import {
  createUser,
  expectPostgrestError,
  type TestUser,
} from "./support/fixtures";
import {
  bootstrapServiceRole,
  describeIntegration,
  resetDatabase,
} from "./support/local-supabase";

function adminCount(service: Parameters<typeof resetDatabase>[0]["service"]) {
  return service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_admin", true);
}

describeIntegration("profiles: RLS, approval and administrator guards", (ctx) => {
  beforeAll(async () => {
    await bootstrapServiceRole(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  it("accepts a real GoTrue password session and reads the own profile", async () => {
    const user = await createUser(ctx, { fullName: "Real Session" });
    const sessionClient = await ctx.signIn(user.email, user.password);

    const { data, error } = await sessionClient
      .from("profiles")
      .select("id, full_name, approval_status, is_admin")
      .eq("id", user.id)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: user.id,
      full_name: "Real Session",
      approval_status: "approved",
      is_admin: false,
    });
  });

  it("lets every account read its own row in any approval state", async () => {
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });
    const approved = await createUser(ctx);

    for (const user of [pending, rejected, approved]) {
      const { data, error } = await user.client
        .from("profiles")
        .select("id, approval_status")
        .eq("id", user.id)
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        id: user.id,
        approval_status: user.approvalStatus,
      });
    }
  });

  it("shows approved members only approved profiles", async () => {
    const viewer = await createUser(ctx);
    const approvedOther = await createUser(ctx);
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });

    const { data, error } = await viewer.client
      .from("profiles")
      .select("id, approval_status")
      .order("id");

    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.id).sort()).toEqual(
      [viewer.id, approvedOther.id].sort(),
    );
    expect((data ?? []).some((row) => row.id === pending.id)).toBe(false);
    expect((data ?? []).some((row) => row.id === rejected.id)).toBe(false);
  });

  it("shows administrators every profile and lets the service role bypass RLS", async () => {
    const admin = await createUser(ctx, { admin: true });
    const approved = await createUser(ctx);
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });

    const adminResult = await admin.client
      .from("profiles")
      .select("id, approval_status")
      .order("id");
    expect(adminResult.error).toBeNull();
    expect((adminResult.data ?? []).map((row) => row.id).sort()).toEqual(
      [admin.id, approved.id, pending.id, rejected.id].sort(),
    );

    const serviceResult = await ctx.service
      .from("profiles")
      .select("id")
      .order("id");
    expect(serviceResult.error).toBeNull();
    expect((serviceResult.data ?? []).map((row) => row.id).sort()).toEqual(
      [admin.id, approved.id, pending.id, rejected.id].sort(),
    );
  });

  it("shows pending and rejected accounts only their own profile", async () => {
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });
    const approved = await createUser(ctx);

    for (const user of [pending, rejected]) {
      const { data, error } = await user.client
        .from("profiles")
        .select("id")
        .order("id");

      expect(error).toBeNull();
      expect(data).toEqual([{ id: user.id }]);
      expect((data ?? []).some((row) => row.id === approved.id)).toBe(false);
    }
  });

  it("blocks self-approval, self-promotion and primary-key changes", async () => {
    const pending = await createUser(ctx, { approval: "pending" });
    const member = await createUser(ctx);

    const approvalAttempt = await pending.client
      .from("profiles")
      .update({ approval_status: "approved" })
      .eq("id", pending.id)
      .select("id");
    expectPostgrestError(
      approvalAttempt.error,
      "42501",
      "Only administrators can change the approval status",
    );

    const adminAttempt = await member.client
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", member.id)
      .select("id");
    expectPostgrestError(
      adminAttempt.error,
      "42501",
      "Only administrators can change the admin flag",
    );

    const idAttempt = await member.client
      .from("profiles")
      .update({ id: randomUUID() })
      .eq("id", member.id)
      .select("id");
    expectPostgrestError(
      idAttempt.error,
      "42501",
      "The profile id cannot be changed",
    );

    const [pendingRow, memberRow] = await Promise.all([
      ctx.service
        .from("profiles")
        .select("approval_status, is_admin, id")
        .eq("id", pending.id)
        .single(),
      ctx.service
        .from("profiles")
        .select("approval_status, is_admin, id")
        .eq("id", member.id)
        .single(),
    ]);

    expect(pendingRow.data?.approval_status).toBe("pending");
    expect(memberRow.data).toMatchObject({
      id: member.id,
      is_admin: false,
    });
  });

  it("forces a self-inserted profile to pending and rejects a forged admin flag", async () => {
    const user = await createUser(ctx);

    const deleteProfile = await ctx.service
      .from("profiles")
      .delete()
      .eq("id", user.id);
    expect(deleteProfile.error).toBeNull();

    const insert = await user.client
      .from("profiles")
      .insert({
        id: user.id,
        full_name: "Recreated profile",
        approval_status: "approved",
      })
      .select("id, approval_status, is_admin")
      .single();

    expect(insert.error).toBeNull();
    expect(insert.data).toMatchObject({
      id: user.id,
      approval_status: "pending",
      is_admin: false,
    });

    const deleteAgain = await ctx.service
      .from("profiles")
      .delete()
      .eq("id", user.id);
    expect(deleteAgain.error).toBeNull();

    const forgedAdminInsert = await user.client
      .from("profiles")
      .insert({
        id: user.id,
        full_name: "Forged admin",
        is_admin: true,
      })
      .select("id");
    expectPostgrestError(forgedAdminInsert.error, "42501");
  });

  it("lets administrators edit another member but blocks regular members", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);

    const adminUpdate = await admin.client
      .from("profiles")
      .update({ full_name: "Edited by admin" })
      .eq("id", member.id)
      .select("id, full_name")
      .single();
    expect(adminUpdate.error).toBeNull();
    expect(adminUpdate.data?.full_name).toBe("Edited by admin");

    const memberUpdate = await member.client
      .from("profiles")
      .update({ full_name: "Edited by member" })
      .eq("id", admin.id)
      .select("id");
    expect(memberUpdate.error).toBeNull();
    expect(memberUpdate.data).toEqual([]);

    const { data: adminRow } = await ctx.service
      .from("profiles")
      .select("full_name")
      .eq("id", admin.id)
      .single();
    expect(adminRow?.full_name).not.toBe("Edited by member");
  });

  it("lets an administrator approve and reject an account", async () => {
    const admin = await createUser(ctx, { admin: true });
    const pending = await createUser(ctx, { approval: "pending" });

    const approve = await admin.client
      .from("profiles")
      .update({ approval_status: "approved" })
      .eq("id", pending.id)
      .select("id, approval_status")
      .single();
    expect(approve.error).toBeNull();
    expect(approve.data?.approval_status).toBe("approved");

    const { data: selfView } = await pending.client
      .from("profiles")
      .select("approval_status")
      .eq("id", pending.id)
      .single();
    expect(selfView?.approval_status).toBe("approved");

    const reject = await admin.client
      .from("profiles")
      .update({ approval_status: "rejected" })
      .eq("id", pending.id)
      .select("id, approval_status")
      .single();
    expect(reject.error).toBeNull();
    expect(reject.data?.approval_status).toBe("rejected");
  });

  it("enforces the four-administrator cap for members and the service role", async () => {
    const admins: TestUser[] = [];
    for (let index = 0; index < 4; index += 1) {
      admins.push(await createUser(ctx, { admin: true }));
    }
    const candidate = await createUser(ctx);

    const { count: beforeCount } = await adminCount(ctx.service);
    expect(beforeCount).toBe(4);

    const memberAttempt = await admins[0].client
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", candidate.id)
      .select("id");
    expectPostgrestError(
      memberAttempt.error,
      "P0001",
      ADMIN_LIMIT_MESSAGE,
    );

    const serviceAttempt = await ctx.service
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", candidate.id)
      .select("id");
    expectPostgrestError(
      serviceAttempt.error,
      "P0001",
      ADMIN_LIMIT_MESSAGE,
    );

    const { count: afterCount } = await adminCount(ctx.service);
    expect(afterCount).toBe(4);
  });

  it("serializes concurrent promotions at the cap", async () => {
    for (let index = 0; index < 2; index += 1) {
      await createUser(ctx, { admin: true });
    }
    const actor = await createUser(ctx, { admin: true });
    const first = await createUser(ctx);
    const second = await createUser(ctx);

    const promote = (target: TestUser) =>
      actor.client
        .from("profiles")
        .update({ is_admin: true })
        .eq("id", target.id)
        .select("id, is_admin");

    const [firstResult, secondResult] = await Promise.all([
      promote(first),
      promote(second),
    ]);
    const results = [firstResult, secondResult];
    const successes = results.filter((result) => result.error === null);
    const failures = results.filter((result) => result.error !== null);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expectPostgrestError(
      failures[0].error,
      "P0001",
      ADMIN_LIMIT_MESSAGE,
    );

    const { count } = await adminCount(ctx.service);
    expect(count).toBe(4);
  });

  it("blocks an administrator from demoting themselves", async () => {
    const admin = await createUser(ctx, { admin: true });

    const attempt = await admin.client
      .from("profiles")
      .update({ is_admin: false })
      .eq("id", admin.id)
      .select("id, is_admin");
    expectPostgrestError(attempt.error, "P0001", SELF_DEMOTION_MESSAGE);

    const { data } = await ctx.service
      .from("profiles")
      .select("is_admin")
      .eq("id", admin.id)
      .single();
    expect(data?.is_admin).toBe(true);
  });
});
