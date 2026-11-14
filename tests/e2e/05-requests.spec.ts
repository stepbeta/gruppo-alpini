import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createServiceClient,
  E2E_AUTH_DIR,
  readLocalSupabaseStatus,
} from "./support/local-supabase";
import { readSeed, uniqueSuffix } from "./support/seed";

/**
 * Richieste alla segreteria e contatori amministratore:
 *  - il socio invia una richiesta e ne segue lo stato;
 *  - il badge "richiesta in attesa" compare nella navigazione e nella home;
 *  - risolvere/riaprire aggiorna il contatore senza ricaricare la pagina;
 *  - il badge sparisce quando la coda è vuota.
 */
test("la richiesta del socio aggiorna i contatori della segreteria", async ({
  browser,
}) => {
  const seed = readSeed();
  const suffix = uniqueSuffix();
  const message = `E2E · Richiesta contatori ${suffix}`;

  const memberContext = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "member.json"),
  });
  const memberPage = await memberContext.newPage();

  await memberPage.goto("/richieste");
  await expect(
    memberPage.getByRole("heading", { name: "Richieste e comunicazioni" }),
  ).toBeVisible();

  await memberPage.getByLabel("Messaggio").fill(message);
  await memberPage.getByRole("button", { name: "Invia richiesta" }).click();
  await expect(
    memberPage.getByText("Richiesta inviata alla segreteria."),
  ).toBeVisible();

  const myRequests = memberPage.locator("#le-mie-richieste");
  await expect(myRequests.getByText(message)).toBeVisible();
  await expect(myRequests.getByText("In attesa", { exact: true })).toBeVisible();
  await expect(
    memberPage.getByText(/in attesa$/, { exact: true }),
  ).toHaveCount(0);

  const service = createServiceClient(readLocalSupabaseStatus());
  const { data: requestRow, error: requestError } = await service
    .from("generic_requests")
    .select("id, status, user_id")
    .eq("message", message)
    .single();

  expect(requestError).toBeNull();
  expect(requestRow).toMatchObject({
    status: "open",
    user_id: seed.users.member.id,
  });
  const requestId = requestRow?.id as string;

  // La home dell'amministratore mostra la nuova coda sia nel menu sia nella card.
  const adminContext = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "admin.json"),
  });
  const adminPage = await adminContext.newPage();

  await adminPage.goto("/");
  const mainNav = adminPage.getByRole("navigation", {
    name: "Navigazione principale",
  });
  const navBadge = mainNav.getByText("1 richiesta in attesa");
  await expect(navBadge).toBeVisible();

  const requestsShortcut = adminPage.getByRole("link", {
    name: /Richieste alla segreteria/,
  });
  await expect(
    requestsShortcut.getByText("1 richiesta in attesa"),
  ).toBeVisible();

  await adminPage.goto("/richieste");
  await expect(
    adminPage.getByRole("heading", { name: "Bacheca della segreteria" }),
  ).toBeVisible();

  const boardRow = adminPage
    .locator("main li")
    .filter({ hasText: message })
    .first();
  await expect(boardRow).toBeVisible();

  await boardRow.getByRole("button", { name: "Segna come risolta" }).click();
  await expect(
    adminPage.getByText("Richiesta segnata come risolta."),
  ).toBeVisible();
  await expect(boardRow.getByText("Risolta", { exact: true })).toBeVisible();
  await expect(navBadge).toHaveCount(0);

  // Riaprire la richiesta riporta il contatore a 1 senza reload.
  await boardRow.getByRole("button", { name: "Riapri richiesta" }).click();
  await expect(adminPage.getByText("Richiesta riaperta.")).toBeVisible();
  await expect(navBadge).toBeVisible();

  await boardRow.getByRole("button", { name: "Segna come risolta" }).click();
  await expect(
    adminPage.getByText("Richiesta segnata come risolta."),
  ).toBeVisible();
  await expect(navBadge).toHaveCount(0);

  const { data: resolvedRow, error: resolvedError } = await service
    .from("generic_requests")
    .select("status")
    .eq("id", requestId)
    .single();
  expect(resolvedError).toBeNull();
  expect(resolvedRow?.status).toBe("resolved");

  // Anche il socio vede lo stato aggiornato dopo un ricaricamento.
  await memberPage.reload();
  const resolvedMemberRow = memberPage
    .locator("#le-mie-richieste li")
    .filter({ hasText: message })
    .first();
  await expect(resolvedMemberRow).toBeVisible();
  await expect(
    resolvedMemberRow.getByText("Risolta", { exact: true }),
  ).toBeVisible();

  await adminContext.close();
  await memberContext.close();
});
