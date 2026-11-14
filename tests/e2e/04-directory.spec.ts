import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { ADMIN_LIMIT_MESSAGE, SELF_DEMOTION_MESSAGE } from "../../lib/profile";
import {
  createServiceClient,
  E2E_AUTH_DIR,
  readLocalSupabaseStatus,
} from "./support/local-supabase";
import { createUser, readSeed, uniqueSuffix } from "./support/seed";

/**
 * Directory e ruoli:
 *  - i soci vedono solo gli account approvati e non ricevono il filtro In attesa;
 *  - gli amministratori promuovono fino al limite di 4 e revocano il ruolo;
 *  - il limite e l'auto-revoca sono comunicati con i messaggi italiani previsti.
 */
test("il socio cerca nella directory e non vede gli account in attesa", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "member.json"),
  });
  const page = await context.newPage();

  await page.goto("/iscritti");
  await expect(
    page.getByRole("heading", { name: "Lista iscritti" }),
  ).toBeVisible();

  const filters = page.getByRole("group", { name: "Filtra gli iscritti" });
  await expect(
    filters.getByRole("button", { name: "In attesa" }),
  ).toHaveCount(0);

  const search = page.getByLabel(
    "Cerca iscritti per nome o luogo di servizio",
  );
  await search.fill("Bergamo");
  await expect(
    page.getByRole("heading", { name: "Bruno Bergamo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mario Socio" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Azzera la ricerca" }).click();
  await filters.getByRole("button", { name: "Amministratori" }).click();
  await expect(
    page.getByRole("heading", { name: "Bruno Bergamo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mario Socio" }),
  ).toHaveCount(0);

  // La coda delle approvazioni è invisibile ai soci.
  await filters.getByRole("button", { name: "Tutti" }).click();
  await search.fill("Pina");
  await expect(page.getByText("Nessun iscritto trovato")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pina In Attesa" }),
  ).toHaveCount(0);

  await context.close();
});

test("l'amministratore usa i filtri di stato e pagina la directory", async ({
  browser,
}) => {
  const status = readLocalSupabaseStatus();
  const service = createServiceClient(status);
  const suffix = uniqueSuffix();
  const extraNames = [1, 2, 3, 4].map(
    (index) => `Zeno Pagina ${index} ${suffix}`,
  );

  for (const fullName of extraNames) {
    await createUser(service, { fullName });
  }

  const context = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "admin.json"),
  });
  const page = await context.newPage();

  await page.goto("/iscritti");
  await expect(
    page.getByRole("heading", { name: "Lista iscritti" }),
  ).toBeVisible();

  const filters = page.getByRole("group", { name: "Filtra gli iscritti" });
  for (const label of ["Tutti", "Amministratori", "Utenti", "In attesa"]) {
    await expect(
      filters.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }

  // I quattro nuovi soci superano la prima pagina da 8 elementi. Il totale
  // esatto dipende dagli altri spec, quindi si verifica la paginazione reale.
  const pagination = page.getByRole("navigation", {
    name: "Paginazione iscritti",
  });
  await expect(pagination).toBeVisible();
  await expect(
    page.getByText(/^Mostrando \d+–\d+ di \d+ iscritti$/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pagina successiva" }).click();
  await expect(
    pagination.getByText(/^\d+–\d+ di \d+ iscritti$/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: extraNames[3] }),
  ).toBeVisible();

  await filters.getByRole("button", { name: "Utenti", exact: true }).click();
  // Utenti esclude gli amministratori ma include gli account in attesa.
  await expect(page.getByText(/^\d+ utent[ei]$/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ada Amministratrice" }),
  ).toHaveCount(0);

  await filters.getByRole("button", { name: "In attesa", exact: true }).click();
  await expect(page.getByText(/^\d+ account in attesa$/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pina In Attesa" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mario Socio" }),
  ).toHaveCount(0);

  await filters
    .getByRole("button", { name: "Amministratori", exact: true })
    .click();
  await expect(page.getByText(/^\d+ amministrator[ei]$/)).toBeVisible();

  await filters.getByRole("button", { name: "Tutti", exact: true }).click();
  await expect(
    page.getByText(/^Mostrando \d+–\d+ di \d+ iscritti$/),
  ).toBeVisible();

  await context.close();
});

test("l'amministratore raggiunge il limite di 4 e revoca il ruolo", async ({
  browser,
}) => {
  const seed = readSeed();
  const status = readLocalSupabaseStatus();
  const service = createServiceClient(status);
  const capName = `E2E Cap Socio ${uniqueSuffix()}`;
  const capUser = await createUser(service, { fullName: capName });

  const context = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "admin.json"),
  });
  const page = await context.newPage();

  await page.goto("/iscritti");
  await expect(
    page.getByRole("heading", { name: "Lista iscritti" }),
  ).toBeVisible();

  const search = page.getByLabel(
    "Cerca iscritti per nome o luogo di servizio",
  );

  async function openMember(name: string): Promise<void> {
    await search.fill(name);
    const row = page.locator("main li").filter({ hasText: name }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Modifica" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", {
        name: "Modifica iscritto",
      }),
    ).toBeVisible();
  }

  // Terzo amministratore esistente + Mario = 4, il limite previsto.
  await openMember("Mario Socio");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Promuovi ad amministratore" })
    .click();
  await expect(
    page.getByText("Mario Socio è ora amministratore."),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const promotedRow = page
    .locator("main li")
    .filter({ hasText: "Mario Socio" })
    .first();
  await expect(
    promotedRow.getByText("Amministratore", { exact: true }),
  ).toBeVisible();

  // La quinta promozione viene rifiutata dal database.
  await openMember(capName);
  const capDialog = page.getByRole("dialog");
  await capDialog
    .getByRole("button", { name: "Promuovi ad amministratore" })
    .click();
  await expect(capDialog.getByText(ADMIN_LIMIT_MESSAGE)).toBeVisible();
  await capDialog.getByRole("button", { name: "Chiudi" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Riportiamo Mario a socio, così lo stato condiviso resta stabile.
  await openMember("Mario Socio");
  const demoteDialog = page.getByRole("dialog");
  await demoteDialog
    .getByRole("button", { name: "Revoca ruolo amministratore" })
    .click();

  const confirmDialog = page.getByRole("dialog").last();
  await expect(
    confirmDialog.getByRole("heading", {
      name: "Revoca ruolo amministratore",
    }),
  ).toBeVisible();
  await confirmDialog
    .getByRole("button", { name: "Revoca ruolo amministratore" })
    .click();

  await expect(
    page.getByText(
      "Il ruolo di amministratore di Mario Socio è stato revocato.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Nessun amministratore può revocare sé stesso dalla propria scheda.
  await openMember("Ada Amministratrice");
  const selfDialog = page.getByRole("dialog");
  await expect(selfDialog.getByText(SELF_DEMOTION_MESSAGE)).toBeVisible();
  await expect(
    selfDialog.getByRole("button", { name: "Revoca ruolo amministratore" }),
  ).toHaveCount(0);
  await selfDialog.getByRole("button", { name: "Chiudi" }).click();

  const { data: capProfile, error: capProfileError } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", capUser.id)
    .single();
  expect(capProfileError).toBeNull();
  expect(capProfile?.is_admin).toBe(false);

  const { data: memberProfile, error: memberProfileError } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", seed.users.member.id)
    .single();
  expect(memberProfileError).toBeNull();
  expect(memberProfile?.is_admin).toBe(false);

  await context.close();
});
