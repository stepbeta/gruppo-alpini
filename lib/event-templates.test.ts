import { describe, expect, it, vi } from "vitest";
import {
  eventToTemplateInput,
  formatEventTemplateError,
  normalizeEventTemplateTime,
  validateEventTemplateInput,
} from "./event-templates";
import type { EventRecord } from "./events";

// event-templates.ts imports the browser Supabase client. The functions under
// test are pure, so replace it to keep the unit tests hermetic and free of env
// vars.
vi.mock("./supabase", () => ({ supabase: null }));

function event(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "event-id",
    title: "Pranzo sociale",
    description: "Ritrovo presso la sede",
    location: "Sede del gruppo",
    event_date: "2026-05-10T17:00:00.000Z",
    is_all_day: false,
    created_by: "admin-id",
    created_at: "2026-05-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeEventTemplateTime", () => {
  it.each([
    ["19:00", "19:00"],
    ["19:00:00", "19:00"],
    ["9:05", "09:05"],
    ["00:00", "00:00"],
    ["23:59", "23:59"],
  ])("normalizes %j to %j", (value, expected) => {
    expect(normalizeEventTemplateTime(value)).toBe(expected);
  });

  it.each(["", "24:00", "23:60", "9:5", "19", "aa:bb"])(
    "rejects the invalid time %j",
    (value) => {
      expect(normalizeEventTemplateTime(value)).toBeNull();
    },
  );

  it("treats null and undefined as no time", () => {
    expect(normalizeEventTemplateTime(null)).toBeNull();
    expect(normalizeEventTemplateTime(undefined)).toBeNull();
  });
});

describe("eventToTemplateInput", () => {
  it("keeps the local time of a timed event and drops the date", () => {
    const localDate = new Date(2026, 4, 10, 19, 30, 0);
    const input = eventToTemplateInput(
      event({ event_date: localDate.toISOString(), is_all_day: false }),
    );

    expect(input).toMatchObject({
      title: "Pranzo sociale",
      description: "Ritrovo presso la sede",
      location: "Sede del gruppo",
      is_all_day: false,
      default_time: "19:30",
    });
  });

  it("creates an all-day template without a time", () => {
    const input = eventToTemplateInput(
      event({
        event_date: "2026-05-10T00:00:00.000Z",
        is_all_day: true,
      }),
    );

    expect(input.is_all_day).toBe(true);
    expect(input.default_time).toBeNull();
  });
});

describe("validateEventTemplateInput", () => {
  const base = {
    title: "Riunione mensile",
    description: null,
    location: null,
    is_all_day: false,
    default_time: "18:00",
  };

  it("accepts a valid timed template", () => {
    expect(validateEventTemplateInput(base)).toBeNull();
  });

  it("accepts an all-day template without a time", () => {
    expect(
      validateEventTemplateInput({
        ...base,
        is_all_day: true,
        default_time: null,
      }),
    ).toBeNull();
  });

  it("requires a title", () => {
    expect(validateEventTemplateInput({ ...base, title: "   " })).toBe(
      "Inserisci il titolo del modello.",
    );
  });

  it("requires a time for a timed template", () => {
    expect(
      validateEventTemplateInput({ ...base, default_time: null }),
    ).toBe("Inserisci un orario valido nel formato HH:mm (24 ore).");
  });

  it("rejects a time on an all-day template", () => {
    expect(
      validateEventTemplateInput({
        ...base,
        is_all_day: true,
        default_time: "18:00",
      }),
    ).toBe("Un modello di tutta la giornata non può avere un orario.");
  });
});

describe("formatEventTemplateError", () => {
  it("explains permission failures", () => {
    expect(
      formatEventTemplateError(
        'new row violates row-level security policy for table "event_templates"',
      ),
    ).toContain("Solo gli amministratori");
  });

  it("explains a missing migration", () => {
    expect(
      formatEventTemplateError(
        'relation "public.event_templates" does not exist',
      ),
    ).toContain("Applica le migrazioni Supabase");
  });

  it("explains check-constraint failures", () => {
    expect(
      formatEventTemplateError(
        'new row violates check constraint "event_templates_title_not_blank"',
      ),
    ).toContain("Controlla il titolo");
  });

  it("falls back to a generic message", () => {
    expect(formatEventTemplateError("unexpected failure")).toBe(
      "Impossibile completare l’operazione sui modelli evento. Riprova o contatta un amministratore.",
    );
  });
});
