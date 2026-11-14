import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createServiceClient,
  E2E_AUTH_DIR,
  E2E_PASSWORD,
  E2E_EMAIL_DOMAIN,
  readLocalSupabaseStatus,
} from "./support/local-supabase";
import { readSeed, uniqueSuffix } from "./support/seed";
import { expectHome } from "./support/ui";

/**
 * Completamento del percorso di registrazione:
 * registrazione → consenso privacy → attesa approvazione → approvazione admin.
 *
 * Il config locale disabilita le conferme email, ma se in futuro venissero
 * attivate il test conferma l'utente tramite l'Admin API (mai SMTP reale).
 */
async function waitForSignUpOutcome(page: Page): Promise<boolean> {
  const confirmationNotice = page.getByText(
    "Account creato. Controlla la tua email per confermare l’indirizzo, poi accedi.",
  );
  const consentHeading = page.getByRole("heading", {
    name: "Prima di entrare",
  });

  await expect(confirmationNotice.or(consentHeading)).toBeVisible({
    timeout: 15_000,
  });

  return confirmationNotice.isVisible();
}

async function confirmEmailThroughAdminApi(
  service: SupabaseClient,
  email: string,
): Promise<void> {
  const { data, error } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(`Unable to list users: ${error.message}`);
  }

  const user = data.users.find((candidate) => candidate.email === email);
  if (!user) {
    throw new Error(`Signup user ${email} was not found`);
  }

  const { error: confirmError } = await service.auth.admin.updateUserById(
    user.id,
    { email_confirm: true },
  );

  if (confirmError) {
    throw new Error(`Unable to confirm ${email}: ${confirmError.message}`);
  }
}

test("registrazione, consenso privacy e approvazione aprono il portale", async ({
  browser,
}) => {
  const seed = readSeed();
  const suffix = uniqueSuffix();
  const email = `e2e-onboarding-${suffix}@${E2E_EMAIL_DOMAIN}`;
  const fullName = `Nadia Nuova ${suffix}`;
  const service = createServiceClient(readLocalSupabaseStatus());

  const newMemberContext = await browser.newContext();
  const page = await newMemberContext.newPage();

  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Continua con Google" }),
  ).toBeVisible();
  // "Registrati" appears both as the mode tab and in the footer prompt.
  await page
    .getByRole("button", { name: "Registrati", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Entra a far parte del gruppo" }),
  ).toBeVisible();

  await page.getByLabel("Nome completo").fill(fullName);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Crea account" }).click();

  if (await waitForSignUpOutcome(page)) {
    await confirmEmailThroughAdminApi(service, email);
    await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
    await page
      .locator("form")
      .getByRole("button", { name: "Accedi", exact: true })
      .click();
  }

  // Il consenso è bloccante: nessuna pagina del portale è visibile prima.
  await expect(
    page.getByRole("heading", { name: "Prima di entrare" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Consenso necessario" }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accetta e continua" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Account in attesa di approvazione",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(`La richiesta di ${fullName} è stata registrata.`, {
      exact: false,
    }),
  ).toBeVisible();

  const adminContext = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "admin.json"),
  });
  const adminPage = await adminContext.newPage();

  await adminPage.goto("/iscritti");
  await expect(
    adminPage.getByRole("heading", { name: "Lista iscritti" }),
  ).toBeVisible();
  await adminPage.getByRole("button", { name: "In attesa", exact: true }).click();

  const pendingRow = adminPage
    .locator("main li")
    .filter({ hasText: fullName })
    .first();
  await expect(pendingRow).toBeVisible();
  await pendingRow.getByRole("button", { name: "Modifica" }).click();

  const dialog = adminPage.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Modifica iscritto" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Approva iscritto" }).click();

  await expect(
    adminPage.getByText(`L’account di ${fullName} è stato approvato.`),
  ).toBeVisible();
  await expect(dialog).toBeHidden();

  // L'utente in attesa riprova: il portale ora è accessibile.
  await page.getByRole("button", { name: "Controlla di nuovo" }).click();
  await expectHome(page, "Nadia");
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("link", { name: "Eventi", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Eventi del gruppo" }),
  ).toBeVisible();

  await newMemberContext.close();
  await adminContext.close();

  // Seed letto per coerenza con gli altri spec: l'admin è quello di riferimento.
  expect(seed.users.admin.email).toContain("e2e-admin");
});
