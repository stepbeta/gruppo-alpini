import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_ORGANIZATION_SETTINGS_FORM,
  ORGANIZATION_SETTINGS_COLUMNS,
  fetchOrganizationSettingsForAdmin,
  formatOrganizationSettingsError,
  formatOrganizationSettingsUpdatedAt,
  isValidEmailAddress,
  normalizeOrganizationSettingsInput,
  organizationSettingsToForm,
  saveOrganizationSettings,
  validateOrganizationSettings,
} from "./organization-settings";

// organization-settings.ts imports the browser Supabase client. The pure
// helpers and the missing-configuration guards are exercised here.
vi.mock("./supabase", () => ({ supabase: null }));

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

  it("treats an empty timestamp as unavailable", () => {
    expect(formatOrganizationSettingsUpdatedAt("")).toBe("non disponibile");
  });
});

describe("organization settings validation edge cases", () => {
  it("requires the controller name before checking email shapes", () => {
    expect(
      validateOrganizationSettings({
        ...EMPTY_ORGANIZATION_SETTINGS_FORM,
        organization_name: "",
        contact_email: "not-an-email",
      }),
    ).toBe("Inserisci il nome del titolare del trattamento.");
  });

  it("accepts valid emails surrounded by whitespace", () => {
    expect(
      validateOrganizationSettings({
        organization_name: "Gruppo Alpini",
        address: "",
        contact_email: "  contatto@example.it  ",
        dpo_email: "  dpo@example.it ",
      }),
    ).toBeNull();
  });

  it("checks the contact email before the DPO email", () => {
    expect(
      validateOrganizationSettings({
        organization_name: "Gruppo Alpini",
        address: "",
        contact_email: "not-an-email",
        dpo_email: "also-not-an-email",
      }),
    ).toContain("contatto del titolare");
  });

  it.each([
    "a@b.c",
    "mario.rossi+tag@example.co.uk",
    "  mario@example.it  ",
  ])("accepts the email shape %j", (value) => {
    expect(isValidEmailAddress(value)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "plainaddress",
    "@example.com",
    "user@",
    "user@example",
    "user@@example.com",
    "user name@example.com",
    "user@.com",
  ])("rejects the malformed email %j", (value) => {
    expect(isValidEmailAddress(value)).toBe(false);
  });
});

describe("organization settings normalization edge cases", () => {
  it("trims every field and stores blanks as NULL", () => {
    expect(
      normalizeOrganizationSettingsInput({
        organization_name: "  Gruppo Alpini  ",
        address: "   ",
        contact_email: "  ",
        dpo_email: "\t\n",
      }),
    ).toEqual({
      organization_name: "Gruppo Alpini",
      address: null,
      contact_email: null,
      dpo_email: null,
    });
  });

  it("preserves meaningful text with internal spaces", () => {
    expect(
      normalizeOrganizationSettingsInput({
        organization_name: "Gruppo Alpini Belluno",
        address: "Via Roma 1",
        contact_email: "segreteria@example.it",
        dpo_email: "dpo@example.it",
      }),
    ).toEqual({
      organization_name: "Gruppo Alpini Belluno",
      address: "Via Roma 1",
      contact_email: "segreteria@example.it",
      dpo_email: "dpo@example.it",
    });
  });

  it("maps every nullable database column to an empty form field", () => {
    expect(
      organizationSettingsToForm({
        id: true,
        organization_name: "Gruppo Alpini",
        address: null,
        contact_email: null,
        dpo_email: null,
        updated_at: "2026-11-10T09:30:00Z",
      }),
    ).toEqual({
      organization_name: "Gruppo Alpini",
      address: "",
      contact_email: "",
      dpo_email: "",
    });
  });

  it("documents the columns written by the administrator path", () => {
    expect(ORGANIZATION_SETTINGS_COLUMNS).toBe(
      "id, organization_name, address, contact_email, dpo_email, updated_at",
    );
  });
});

describe("organization settings error mapping edge cases", () => {
  it("maps check constraints and invalid input to the dedicated messages", () => {
    expect(
      formatOrganizationSettingsError(
        'new row violates check constraint "organization_settings_name_check"',
      ),
    ).toContain("vincoli previsti");

    expect(
      formatOrganizationSettingsError("invalid input syntax for type uuid"),
    ).toContain("Uno dei valori inseriti non è valido");
  });

  it("hides unknown technical details behind the save fallback", () => {
    expect(
      formatOrganizationSettingsError("SQLSTATE XX000 internal error"),
    ).toContain("Non è stato possibile salvare le impostazioni privacy");
  });
});

describe("organization settings data access without a configured client", () => {
  it("returns a configuration error when loading the row", async () => {
    await expect(fetchOrganizationSettingsForAdmin()).resolves.toEqual({
      settings: null,
      error: "Supabase non configurato.",
    });
  });

  it("returns a configuration error when saving the row", async () => {
    await expect(
      saveOrganizationSettings({
        organization_name: "Gruppo Alpini",
        address: null,
        contact_email: null,
        dpo_email: null,
      }),
    ).resolves.toEqual({
      settings: null,
      error: "Supabase non configurato.",
    });
  });
});
