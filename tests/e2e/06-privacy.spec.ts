import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  createServiceClient,
  E2E_AUTH_DIR,
  readLocalSupabaseStatus,
} from "./support/local-supabase";
import {
  createEventResponse,
  createUser,
  readSeed,
  storageStateFor,
  uniqueSuffix,
} from "./support/seed";

const EXPORT_FILE_PATTERN = /^dati-personali-mario-socio-\d{4}-\d{2}-\d{2}\.(json|txt|html)$/;

async function downloadExport(
  page: Page,
  buttonName: string,
): Promise<{ filename: string; content: string }> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName }).click();
  const download = await downloadPromise;
  const path = await download.path();

  if (!path) {
    throw new Error(`Playwright did not store the ${buttonName} download`);
  }

  return {
    filename: download.suggestedFilename(),
    content: readFileSync(path, "utf8"),
  };
}

/**
 * Diritti privacy:
 *  - il socio scarica la propria copia in JSON, testo e HTML;
 *  - l'eliminazione dell'account rimuove accesso e scheda, ma conserva in forma
 *    anonima risposte agli eventi e richieste già inviate.
 */
test("il socio esporta i propri dati in tutti i formati", async ({
  browser,
}) => {
  const seed = readSeed();
  const service = createServiceClient(readLocalSupabaseStatus());
  const { error: responseSeedError } = await service
    .from("event_responses")
    .upsert(
      {
        event_id: seed.events.past.id,
        user_id: seed.users.member.id,
        status: "tentative",
        guest_count: 0,
      },
      { onConflict: "event_id,user_id" },
    );

  if (responseSeedError) {
    throw new Error(
      `Unable to prepare the export fixture response: ${responseSeedError.message}`,
    );
  }

  const context = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "member.json"),
  });
  const page = await context.newPage();

  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Esporta i miei dati" }),
  ).toBeVisible();

  const json = await downloadExport(page, "Scarica JSON");
  expect(json.filename).toMatch(/\.json$/);
  expect(json.filename).toMatch(EXPORT_FILE_PATTERN);
  expect(json.filename).toContain("mario-socio");

  const parsed = JSON.parse(json.content) as {
    export_version: string;
    user: { id: string; email: string | null };
    profile: { full_name: string | null } | null;
    event_responses: Array<{ event_id: string; status_label: string }>;
    privacy_consents: Array<{ policy_version: string }>;
  };

  expect(parsed.export_version.length).toBeGreaterThan(0);
  expect(parsed.user.id).toBe(seed.users.member.id);
  expect(parsed.user.email).toBe(seed.users.member.email);
  expect(parsed.profile?.full_name).toBe("Mario Socio");
  expect(parsed.privacy_consents.length).toBeGreaterThan(0);
  expect(
    parsed.event_responses.some(
      (response) =>
        response.event_id === seed.events.past.id &&
        response.status_label === "In forse",
    ),
  ).toBe(true);

  const text = await downloadExport(page, "Scarica testo");
  expect(text.filename).toMatch(/\.txt$/);
  expect(text.filename).toMatch(EXPORT_FILE_PATTERN);
  expect(text.content).toContain("DATI PERSONALI — Mario Socio");
  expect(text.content).toContain(seed.users.member.email);

  const html = await downloadExport(page, "Scarica HTML");
  expect(html.filename).toMatch(/\.html$/);
  expect(html.filename).toMatch(EXPORT_FILE_PATTERN);
  expect(html.content).toContain("<!doctype html>");
  expect(html.content).toContain(seed.users.member.email);

  await context.close();
});

test("l'eliminazione dell'account anonimizza risposte e richieste", async ({
  browser,
}) => {
  const seed = readSeed();
  const status = readLocalSupabaseStatus();
  const service = createServiceClient(status);
  const suffix = uniqueSuffix();
  const fullName = `E2E Da Eliminare ${suffix}`;
  const victim = await createUser(service, { fullName });

  const responseId = await createEventResponse(service, {
    eventId: seed.events.past.id,
    userId: victim.id,
    status: "present",
    guestCount: 1,
  });

  const requestMessage = `E2E · Cancellazione account ${suffix}`;
  const { data: createdRequest, error: requestError } = await service
    .from("generic_requests")
    .insert({
      user_id: victim.id,
      message: requestMessage,
      status: "open",
    })
    .select("id")
    .single();

  if (requestError || !createdRequest) {
    throw new Error(
      `Unable to create the deletion fixture request: ${requestError?.message ?? "no row returned"}`,
    );
  }

  const storageState = await storageStateFor(status, victim, "deletion.json");
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: fullName, exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Elimina account" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Elimina il tuo account" }),
  ).toBeVisible();

  const confirmButton = dialog.getByRole("button", {
    name: "Elimina account",
  });
  await expect(confirmButton).toBeDisabled();
  await dialog.getByLabel(/Digita ELIMINA/).fill("ELIMINA");
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  // The guard preserves the page the member was on as a `next` destination.
  await expect(page).toHaveURL(/\/login(\?next=.+)?$/);
  await expect(
    page.getByRole("heading", { name: "Bentornato in gruppo" }),
  ).toBeVisible();

  // L'accesso non esiste più.
  const { error: authError } = await service.auth.admin.getUserById(victim.id);
  expect(authError?.status).toBe(404);

  const { data: profileRow, error: profileError } = await service
    .from("profiles")
    .select("id")
    .eq("id", victim.id)
    .maybeSingle();
  expect(profileError).toBeNull();
  expect(profileRow).toBeNull();

  // Le righe storiche restano, senza collegamento all'account eliminato.
  const { data: responseRow, error: responseError } = await service
    .from("event_responses")
    .select("user_id, status, guest_count")
    .eq("id", responseId)
    .single();
  expect(responseError).toBeNull();
  expect(responseRow).toMatchObject({
    user_id: null,
    status: "present",
    guest_count: 1,
  });

  const { data: requestRow, error: deletedRequestError } = await service
    .from("generic_requests")
    .select("user_id, message, status")
    .eq("id", createdRequest.id)
    .single();
  expect(deletedRequestError).toBeNull();
  expect(requestRow).toMatchObject({
    user_id: null,
    message: requestMessage,
    status: "open",
  });

  // La sessione locale non dà più accesso alle pagine protette.
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=/);

  // Il riepilogo storico continua a mostrare la risposta anonimizzata.
  const adminContext = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "admin.json"),
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/eventi");
  await adminPage
    .getByRole("group", { name: "Filtra gli eventi" })
    .getByRole("button", { name: /Passati/ })
    .click();

  const pastCard = adminPage.locator(`#event-${seed.events.past.id}`);
  await expect(pastCard.getByText("Socio eliminato (+1)")).toBeVisible();
  // 1 present + 1 tentative member, plus the deleted member's guest.
  await expect(
    pastCard.getByText("Totale: 3 (2 soci + 1 invitati)"),
  ).toBeVisible();

  await adminContext.close();
  await context.close();
});
