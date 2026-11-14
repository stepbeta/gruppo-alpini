import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createServiceClient,
  E2E_AUTH_DIR,
  readLocalSupabaseStatus,
} from "./support/local-supabase";
import { italianDate, readSeed, uniqueSuffix } from "./support/seed";

/**
 * Adesioni agli eventi:
 *  - un socio risponde "Presente", aggiorna gli invitati e ritrova la risposta
 *    dopo un ricaricamento;
 *  - gli eventi passati non offrono più i controlli di adesione;
 *  - l'amministratore vede il riepilogo con nomi e totale aggiornato.
 */
test("il socio conferma la presenza, aggiorna gli invitati e vede i controlli disattivati sul passato", async ({
  browser,
}) => {
  const seed = readSeed();
  const context = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "member.json"),
  });
  const page = await context.newPage();
  const event = seed.events.nextTimed;

  await page.goto("/eventi");
  await expect(
    page.getByRole("heading", { name: "Eventi del gruppo" }),
  ).toBeVisible();

  const card = page.locator(`#event-${event.id}`);
  await expect(card.getByRole("heading", { name: event.title })).toBeVisible();
  await expect(card.getByText("Non hai ancora risposto")).toBeVisible();

  await card.getByRole("button", { name: "Presente", exact: true }).click();
  await expect(
    page.getByText(`Risposta salvata per “${event.title}”.`),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Presente", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // Il contatore invitati salva a ogni passo e sopravvive al reload.
  const increaseGuests = card.getByRole("button", {
    name: "Aumenta il numero di invitati",
  });
  await increaseGuests.click();
  await increaseGuests.click();
  await expect(card.getByText(/tu \+ 2 invitati/)).toBeVisible();

  await page.reload();
  const reloadedCard = page.locator(`#event-${event.id}`);
  await expect(
    reloadedCard.getByRole("button", { name: "Presente", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(reloadedCard.getByText(/tu \+ 2 invitati/)).toBeVisible();

  // Gli altri due stati sono selezionabili e gli invitati restano memorizzati.
  await reloadedCard
    .getByRole("button", { name: "In forse", exact: true })
    .click();
  await expect(
    reloadedCard.getByRole("button", { name: "In forse", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await reloadedCard
    .getByRole("button", { name: "Assente", exact: true })
    .click();
  await expect(
    reloadedCard.getByRole("button", { name: "Assente", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    reloadedCard.getByText(/restano memorizzati ma non contano/i),
  ).toBeVisible();

  // Torniamo a Presente: il riepilogo admin si aspetta 2 invitati.
  await reloadedCard
    .getByRole("button", { name: "Presente", exact: true })
    .click();
  await expect(
    reloadedCard.getByRole("button", { name: "Presente", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  const service = createServiceClient(readLocalSupabaseStatus());
  const { data: responseRow, error: responseError } = await service
    .from("event_responses")
    .select("status, guest_count")
    .eq("event_id", event.id)
    .eq("user_id", seed.users.member.id)
    .single();

  expect(responseError).toBeNull();
  expect(responseRow).toMatchObject({ status: "present", guest_count: 2 });

  // Il filtro Passati mostra l'evento concluso senza controlli RSVP.
  await page
    .getByRole("group", { name: "Filtra gli eventi" })
    .getByRole("button", { name: /Passati/ })
    .click();

  const pastCard = page.locator(`#event-${seed.events.past.id}`);
  await expect(pastCard).toBeVisible();
  await expect(pastCard.getByText("Evento concluso")).toBeVisible();
  await expect(
    pastCard.getByRole("group", {
      name: `Risposta per ${seed.events.past.title}`,
    }),
  ).toHaveCount(0);
  await expect(
    pastCard.getByText(
      "Evento passato: la risposta e gli invitati non sono più modificabili.",
    ),
  ).toBeVisible();

  await context.close();
});

test("l'amministratore vede il riepilogo delle adesioni con gli invitati", async ({
  browser,
}) => {
  const seed = readSeed();
  const context = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "admin.json"),
  });
  const page = await context.newPage();

  await page.goto("/eventi");

  const card = page.locator(`#event-${seed.events.nextTimed.id}`);
  await expect(card.getByRole("heading", { name: "Riepilogo adesioni" })).toBeVisible();
  await expect(card.getByText("Risposte ricevute: 1")).toBeVisible();
  await expect(card.getByText("Mario Socio (+2)")).toBeVisible();
  // Totale counts the member plus their guests: 1 socio + 2 invitati.
  await expect(
    card.getByText("Totale: 3 (1 soci + 2 invitati)"),
  ).toBeVisible();

  await context.close();
});

test("l'amministratore crea un evento con data e ora mascherate e uno di tutta la giornata", async ({
  browser,
}) => {
  const suffix = uniqueSuffix();
  const timedTitle = `E2E · Cena creata ${suffix}`;
  const allDayTitle = `E2E · Raduno creato ${suffix}`;
  const timedDate = italianDate(20);
  const allDayDate = italianDate(21);

  const context = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "admin.json"),
  });
  const page = await context.newPage();

  await page.goto("/eventi");
  await expect(
    page.getByRole("heading", { name: "Eventi del gruppo" }),
  ).toBeVisible();

  // L'input applica la maschera mentre si digita.
  await page.getByRole("button", { name: "Nuovo evento" }).click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Nuovo evento" }),
  ).toBeVisible();

  const dateInput = dialog.getByLabel(/^Data/);
  await dateInput.fill(timedDate.replaceAll("/", ""));
  await expect(dateInput).toHaveValue(timedDate);

  const timeInput = dialog.getByLabel(/^Ora/);
  await timeInput.fill("1930");
  await expect(timeInput).toHaveValue("19:30");

  await dialog.getByLabel("Titolo", { exact: true }).fill(timedTitle);
  await dialog.getByLabel(/^Luogo/).fill("Baita E2E");
  await dialog.getByLabel(/^Descrizione/).fill("Evento creato dal test E2E.");
  await dialog.getByRole("button", { name: "Crea evento" }).click();

  await expect(page.getByText(`Evento creato: ${timedTitle}.`)).toBeVisible();

  // Il nuovo evento può cadere nella seconda pagina del calendario: cercarlo.
  const search = page.getByLabel(
    "Cerca eventi per titolo, luogo o descrizione",
  );
  await search.fill(timedTitle);
  const timedCard = page
    .locator("main li")
    .filter({ hasText: timedTitle })
    .first();
  await expect(timedCard.getByText(`${timedDate} 19:30`)).toBeVisible();

  // Senza ora l'evento dura tutta la giornata e mostra solo la data.
  await page.getByRole("button", { name: "Nuovo evento" }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Nuovo evento" }),
  ).toBeVisible();

  const allDayDateInput = dialog.getByLabel(/^Data/);
  await allDayDateInput.fill(allDayDate.replaceAll("/", ""));
  await expect(allDayDateInput).toHaveValue(allDayDate);
  await expect(dialog.getByLabel(/^Ora/)).toHaveValue("");

  await dialog.getByLabel("Titolo", { exact: true }).fill(allDayTitle);
  await dialog.getByRole("button", { name: "Crea evento" }).click();

  await expect(page.getByText(`Evento creato: ${allDayTitle}.`)).toBeVisible();
  await search.fill(allDayTitle);
  const allDayCard = page
    .locator("main li")
    .filter({ hasText: allDayTitle })
    .first();
  await expect(allDayCard.getByText(allDayDate, { exact: true })).toBeVisible();

  await context.close();
});
