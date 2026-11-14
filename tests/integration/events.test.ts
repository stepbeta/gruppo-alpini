import { beforeAll, beforeEach, expect, it } from "vitest";
import {
  createEvent,
  createEventResponse,
  createEventTemplate,
  createUser,
  expectPostgrestError,
  futureIso,
} from "./support/fixtures";
import {
  bootstrapServiceRole,
  describeIntegration,
  resetDatabase,
} from "./support/local-supabase";

describeIntegration("events and event_templates: ownership and admin boundaries", (ctx) => {
  beforeAll(async () => {
    await bootstrapServiceRole(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx);
  });

  it("returns 42501 when an anonymous visitor reads events", async () => {
    const result = await ctx.anon.from("events").select("id");
    expectPostgrestError(result.error, "42501", "permission denied");
  });

  it("lets approved members read events while pending and rejected accounts cannot", async () => {
    const admin = await createUser(ctx, { admin: true });
    const approved = await createUser(ctx);
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });
    const event = await createEvent(admin.client);

    const approvedRead = await approved.client.from("events").select("id");
    expect(approvedRead.error).toBeNull();
    expect(approvedRead.data).toEqual([{ id: event.id }]);

    for (const user of [pending, rejected]) {
      const read = await user.client.from("events").select("id");
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);
    }
  });

  it("derives created_by on insert and rejects a forged author", async () => {
    const admin = await createUser(ctx, { admin: true });
    const other = await createUser(ctx);

    const event = await createEvent(admin.client, { title: "Owned event" });
    expect(event.created_by).toBe(admin.id);

    const forged = await admin.client
      .from("events")
      .insert({
        title: "Forged event",
        event_date: futureIso(),
        created_by: other.id,
      })
      .select("id");
    expectPostgrestError(
      forged.error,
      "42501",
      "events.created_by must match the authenticated user",
    );
  });

  it("keeps created_by immutable while allowing other administrator edits", async () => {
    const admin = await createUser(ctx, { admin: true });
    const other = await createUser(ctx);
    const event = await createEvent(admin.client, { title: "Immutable author" });

    const changeAuthor = await admin.client
      .from("events")
      .update({ created_by: other.id })
      .eq("id", event.id)
      .select("id");
    expectPostgrestError(
      changeAuthor.error,
      "42501",
      "events.created_by cannot be changed",
    );

    const updateTitle = await admin.client
      .from("events")
      .update({ title: "Updated title" })
      .eq("id", event.id)
      .select("id, title, created_by")
      .single();
    expect(updateTitle.error).toBeNull();
    expect(updateTitle.data).toEqual({
      id: event.id,
      title: "Updated title",
      created_by: admin.id,
    });
  });

  it("blocks regular members from creating, editing or deleting events", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const event = await createEvent(admin.client, { title: "Admin event" });

    const insert = await member.client
      .from("events")
      .insert({ title: "Member event", event_date: futureIso() })
      .select("id");
    expectPostgrestError(insert.error, "42501");

    const update = await member.client
      .from("events")
      .update({ title: "Hijacked" })
      .eq("id", event.id)
      .select("id");
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);

    const remove = await member.client
      .from("events")
      .delete()
      .eq("id", event.id)
      .select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([]);

    const { data: raw } = await ctx.service
      .from("events")
      .select("id, title")
      .eq("id", event.id)
      .single();
    expect(raw).toEqual({ id: event.id, title: "Admin event" });
  });

  it("lets administrators delete an event and cascades its responses", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const event = await createEvent(admin.client);
    const response = await createEventResponse(member.client, {
      event_id: event.id,
      user_id: member.id,
    });

    const remove = await admin.client
      .from("events")
      .delete()
      .eq("id", event.id)
      .select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([{ id: event.id }]);

    const remaining = await ctx.service
      .from("event_responses")
      .select("id")
      .eq("id", response.id);
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual([]);
  });

  it("rejects a whitespace-only event title", async () => {
    const admin = await createUser(ctx, { admin: true });
    const attempt = await admin.client
      .from("events")
      .insert({ title: "   ", event_date: futureIso() })
      .select("id");
    expectPostgrestError(
      attempt.error,
      "23514",
      "events_title_non_blank",
    );
  });

  it("keeps event templates administrator-only", async () => {
    const admin = await createUser(ctx, { admin: true });
    const member = await createUser(ctx);
    const pending = await createUser(ctx, { approval: "pending" });
    const rejected = await createUser(ctx, { approval: "rejected" });
    const template = await createEventTemplate(admin.client);

    const memberRead = await member.client
      .from("event_templates")
      .select("id");
    expect(memberRead.error).toBeNull();
    expect(memberRead.data).toEqual([]);

    for (const user of [pending, rejected]) {
      const read = await user.client.from("event_templates").select("id");
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);
    }

    const insert = await member.client
      .from("event_templates")
      .insert({ title: "Member template", is_all_day: true })
      .select("id");
    expectPostgrestError(insert.error, "42501");

    const update = await member.client
      .from("event_templates")
      .update({ title: "Hijacked template" })
      .eq("id", template.id)
      .select("id");
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);

    const remove = await member.client
      .from("event_templates")
      .delete()
      .eq("id", template.id)
      .select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([]);

    const adminRead = await admin.client
      .from("event_templates")
      .select("id, title")
      .eq("id", template.id)
      .single();
    expect(adminRead.error).toBeNull();
    expect(adminRead.data).toEqual({ id: template.id, title: template.title });
  });

  it("derives and freezes event template created_by", async () => {
    const admin = await createUser(ctx, { admin: true });
    const other = await createUser(ctx);

    const template = await createEventTemplate(admin.client, {
      title: "Admin template",
    });
    expect(template.created_by).toBe(admin.id);

    const forged = await admin.client
      .from("event_templates")
      .insert({
        title: "Forged template",
        is_all_day: true,
        created_by: other.id,
      })
      .select("id");
    expectPostgrestError(
      forged.error,
      "42501",
      "event_templates.created_by must match the authenticated user",
    );

    const changeAuthor = await admin.client
      .from("event_templates")
      .update({ created_by: other.id })
      .eq("id", template.id)
      .select("id");
    expectPostgrestError(
      changeAuthor.error,
      "42501",
      "event_templates.created_by cannot be changed",
    );
  });

  it("requires default_time exactly when the template is not all-day", async () => {
    const admin = await createUser(ctx, { admin: true });

    const allDay = await createEventTemplate(admin.client, {
      title: "All day",
    });
    expect(allDay.is_all_day).toBe(true);
    expect(allDay.default_time).toBeNull();

    const allDayWithTime = await admin.client
      .from("event_templates")
      .insert({
        title: "All day with time",
        is_all_day: true,
        default_time: "09:00",
      })
      .select("id");
    expectPostgrestError(
      allDayWithTime.error,
      "23514",
      "event_templates_time_matches_all_day",
    );

    const timedWithoutTime = await admin.client
      .from("event_templates")
      .insert({ title: "Timed without time", is_all_day: false })
      .select("id");
    expectPostgrestError(
      timedWithoutTime.error,
      "23514",
      "event_templates_time_matches_all_day",
    );

    const timed = await createEventTemplate(admin.client, {
      title: "Timed",
      is_all_day: false,
      default_time: "18:30",
    });
    expect(timed.default_time).toMatch(/^18:30/);

    const blankTitle = await admin.client
      .from("event_templates")
      .insert({ title: "   ", is_all_day: true })
      .select("id");
    expectPostgrestError(
      blankTitle.error,
      "23514",
      "event_templates_title_not_blank",
    );
  });
});
