import { beforeAll, beforeEach, expect, it } from "vitest";
import {
  createAnnouncement,
  createUser,
  expectPostgrestError,
  futureIso,
  pastIso,
} from "./support/fixtures";
import {
  bootstrapServiceRole,
  describeIntegration,
  resetDatabase,
} from "./support/local-supabase";

describeIntegration("announcement_banners: visibility window and admin writes", (ctx) => {
  beforeAll(async () => {
    await bootstrapServiceRole(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  it("shows members only active banners inside their window and administrators all rows", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });

    const alwaysVisible = await createAnnouncement(admin.client, {
      message: "Always visible",
      is_active: true,
    });
    const windowed = await createAnnouncement(admin.client, {
      message: "Inside window",
      is_active: true,
      start_date: pastIso(),
      end_date: futureIso(),
    });
    const inactive = await createAnnouncement(admin.client, {
      message: "Inactive",
      is_active: false,
    });
    const future = await createAnnouncement(admin.client, {
      message: "Future",
      is_active: true,
      start_date: futureIso(),
    });
    const expired = await createAnnouncement(admin.client, {
      message: "Expired",
      is_active: true,
      end_date: pastIso(),
    });

    const memberView = await member.client
      .from("announcement_banners")
      .select("id, message")
      .order("id");
    expect(memberView.error).toBeNull();
    expect(memberView.data?.map((row) => row.id).sort()).toEqual(
      [alwaysVisible.id, windowed.id].sort(),
    );

    for (const user of [pending, rejected]) {
      const read = await user.client
        .from("announcement_banners")
        .select("id");
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);
    }

    const adminView = await admin.client
      .from("announcement_banners")
      .select("id")
      .order("id");
    expect(adminView.error).toBeNull();
    expect(adminView.data?.map((row) => row.id).sort()).toEqual(
      [alwaysVisible.id, windowed.id, inactive.id, future.id, expired.id].sort(),
    );
  });

  it("lets administrators create, update and delete every banner", async () => {
    const admin = await createUser(ctx, { admin: true });
    const created = await createAnnouncement(admin.client, {
      message: "Created by admin",
    });
    expect(created.created_by).toBe(admin.id);

    const update = await admin.client
      .from("announcement_banners")
      .update({ message: "Updated by admin", is_active: false })
      .eq("id", created.id)
      .select("id, message, is_active")
      .single();
    expect(update.error).toBeNull();
    expect(update.data).toEqual({
      id: created.id,
      message: "Updated by admin",
      is_active: false,
    });

    const remove = await admin.client
      .from("announcement_banners")
      .delete()
      .eq("id", created.id)
      .select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([{ id: created.id }]);

    const { data } = await ctx.service
      .from("announcement_banners")
      .select("id")
      .eq("id", created.id);
    expect(data).toEqual([]);
  });

  it("blocks regular members from creating, editing or deleting banners", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const banner = await createAnnouncement(admin.client, {
      message: "Admin banner",
    });

    const insert = await member.client
      .from("announcement_banners")
      .insert({ message: "Member banner" })
      .select("id");
    expectPostgrestError(insert.error, "42501");

    const update = await member.client
      .from("announcement_banners")
      .update({ message: "Hijacked" })
      .eq("id", banner.id)
      .select("id");
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);

    const remove = await member.client
      .from("announcement_banners")
      .delete()
      .eq("id", banner.id)
      .select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([]);

    const { data: raw } = await ctx.service
      .from("announcement_banners")
      .select("message, is_active")
      .eq("id", banner.id)
      .single();
    expect(raw).toEqual({ message: "Admin banner", is_active: true });
  });

  it("rejects blank messages and inverted date windows", async () => {
    const admin = await createUser(ctx, { admin: true });

    const blank = await admin.client
      .from("announcement_banners")
      .insert({ message: "   " })
      .select("id");
    expectPostgrestError(
      blank.error,
      "23514",
      "announcement_banners_message_not_blank",
    );

    const inverted = await admin.client
      .from("announcement_banners")
      .insert({
        message: "Inverted window",
        start_date: futureIso(2),
        end_date: pastIso(1),
      })
      .select("id");
    expectPostgrestError(
      inverted.error,
      "23514",
      "announcement_banners_date_order",
    );
  });
});
