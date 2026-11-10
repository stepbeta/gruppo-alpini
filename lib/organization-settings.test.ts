import { describe, expect, it } from "vitest";
import {
  EMPTY_ORGANIZATION_SETTINGS_FORM,
  formatOrganizationSettingsError,
  formatOrganizationSettingsUpdatedAt,
  isValidEmailAddress,
  normalizeOrganizationSettingsInput,
  organizationSettingsToForm,
  validateOrganizationSettings,
} from "./organization-settings";

describe("organization settings validation", () => {
  it("requires a non-blank controller name", () => {
    expect(
      validateOrganizationSettings({
        ...EMPTY_ORGANIZATION_SETTINGS_FORM,
        organization_name: "   ",
      }),
    ).toBe("Inserisci il nome del titolare del trattamento.");
  });

  it("accepts empty optional fields", () => {
    expect(
      validateOrganizationSettings({
        organization_name: "Gruppo Alpini",
        address: "",
        contact_email: "",
        dpo_email: "",
      }),
    ).toBeNull();
  });

  it("validates both email fields when they are present", () => {
    expect(
      validateOrganizationSettings({
        organization_name: "Gruppo Alpini",
        address: "",
        contact_email: "not-an-email",
        dpo_email: "",
      }),
    ).toContain("contatto del titolare");

    expect(
      validateOrganizationSettings({
        organization_name: "Gruppo Alpini",
        address: "",
        contact_email: "",
        dpo_email: "not-an-email",
      }),
    ).toContain("DPO");
  });

  it("recognizes a basic email shape", () => {
    expect(isValidEmailAddress("segreteria@example.it")).toBe(true);
    expect(isValidEmailAddress("segreteria@example")).toBe(false);
    expect(isValidEmailAddress("segreteria example.it")).toBe(false);
  });
});

describe("organization settings form mapping", () => {
  it("maps the database row to strings and back to nullable values", () => {
    const form = organizationSettingsToForm({
      id: true,
      organization_name: "Gruppo Alpini",
      address: "Via Roma 1",
      contact_email: null,
      dpo_email: "dpo@example.it",
      updated_at: "2026-11-10T09:30:00Z",
    });

    expect(form).toEqual({
      organization_name: "Gruppo Alpini",
      address: "Via Roma 1",
      contact_email: "",
      dpo_email: "dpo@example.it",
    });

    expect(normalizeOrganizationSettingsInput(form)).toEqual({
      organization_name: "Gruppo Alpini",
      address: "Via Roma 1",
      contact_email: null,
      dpo_email: "dpo@example.it",
    });
  });
});

describe("organization settings error mapping", () => {
  it("maps permission and missing-table failures to Italian guidance", () => {
    expect(
      formatOrganizationSettingsError("permission denied for table"),
    ).toContain("Solo gli amministratori");

    expect(
      formatOrganizationSettingsError('relation "organization_settings" does not exist'),
    ).toContain("migrazioni Supabase");
  });

  it("returns an Italian trigger message verbatim", () => {
    expect(
      formatOrganizationSettingsError(
        "La tabella organization_settings ammette una sola riga con id = true.",
      ),
    ).toBe(
      "La tabella organization_settings ammette una sola riga con id = true.",
    );
  });
});

describe("organization settings timestamp", () => {
  it("handles missing and malformed values", () => {
    expect(formatOrganizationSettingsUpdatedAt(null)).toBe("non disponibile");
    expect(formatOrganizationSettingsUpdatedAt("not-a-date")).toBe(
      "non disponibile",
    );
  });

  it("formats a valid timestamp in Italian local time", () => {
    const formatted = formatOrganizationSettingsUpdatedAt(
      "2026-11-10T09:30:00Z",
    );

    expect(formatted).toContain("2026");
    expect(formatted).toContain("10:30");
  });
});
