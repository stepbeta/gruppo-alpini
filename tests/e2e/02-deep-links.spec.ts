import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createServiceClient,
  E2E_AUTH_DIR,
  readLocalSupabaseStatus,
} from "./support/local-supabase";
import {
  createUser,
  readSeed,
  storageStateFor,
  uniqueSuffix,
} from "./support/seed";
import { submitLoginForm } from "./support/ui";

const POST_AUTH_REDIRECT_KEY = "gruppo-alpini:post-auth-redirect";

/**
 * I link condivisi degli eventi devono:
 *  - aprire un evento anche quando non è nella prima pagina del calendario;
 *  - sopravvivere al passaggio dal login;
 *  - mostrare un messaggio chiaro quando l'evento non esiste più.
 */
test("il link condiviso apre un evento fuori pagina e lo evidenzia", async ({
  browser,
}) => {
  const seed = readSeed();
  const context = await browser.newContext({
    storageState: join(E2E_AUTH_DIR, "member.json"),
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const shared = seed.events.shared;

  await page.goto(`/eventi?event=${shared.id}`);

  await expect(
    page.getByRole("heading", { name: "Eventi del gruppo" }),
  ).toBeVisible();
  await expect(page.getByText("Aperto dal link che hai ricevuto")).toBeVisible();

  const sharedCard = page.locator(`#event-${shared.id}`);
  await expect(sharedCard).toBeVisible();
  await expect(
    sharedCard.getByRole("heading", { name: shared.title }),
  ).toBeVisible();
  await expect(sharedCard.getByText("Evento condiviso", { exact: true })).toBeVisible();

  // Il pulsante di condivisione copia proprio il percorso che è stato aperto.
  await sharedCard
    .getByRole("button", { name: new RegExp(`Condividi l.evento ${shared.title}`) })
    .click();
  await expect(sharedCard.getByText("Link copiato")).toBeVisible();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(`/eventi?event=${shared.id}`);

  // Un identificativo inesistente non deve rompere il calendario.
  await page.goto(`/eventi?event=${randomUUID()}`);
  await expect(
    page.getByText("L’evento condiviso non è più disponibile."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Eventi del gruppo" }),
  ).toBeVisible();

  await context.close();
});

test("il link condiviso sopravvive al login", async ({ browser }) => {
  // Known product defect: AuthGuard client-navigates to /login?next=..., but
  // LoginPage snapshots window.location.search while the URL still belongs to
  // the previous route, so the destination is dropped. See
  // docs/e2e-known-issues.md. Remove this marker once the page reads search
  // params through the framework router.
  test.fail(
    true,
    "LoginPage loses the `next` parameter after a client-side redirect from AuthGuard.",
  );

  const seed = readSeed();
  const shared = seed.events.shared;
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`/eventi?event=${shared.id}`);

  // AuthGuard porta al login conservando la destinazione.
  await expect(page).toHaveURL(/\/login\?next=/);
  await submitLoginForm(
    page,
    seed.users.member.email,
    seed.users.member.password,
  );

  await expect(page).toHaveURL(
    new RegExp(`/eventi\\?event=${shared.id}$`),
  );
  await expect(page.locator(`#event-${shared.id}`)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: shared.title }),
  ).toBeVisible();

  await context.close();
});

test("la destinazione salvata sopravvive ai gate di consenso e approvazione", async ({
  browser,
}) => {
  const seed = readSeed();
  const status = readLocalSupabaseStatus();
  const service = createServiceClient(status);
  const suffix = uniqueSuffix();
  const destination = `/eventi?event=${seed.events.nextTimed.id}`;
  const pending = await createUser(service, {
    approval: "pending",
    consent: false,
    fullName: `E2E Attesa ${suffix}`,
  });
  const storageState = await storageStateFor(
    status,
    pending,
    `pending-deep-link-${suffix}.json`,
  );
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  // Un account appena creato da un link condiviso atterra sul consenso.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Prima di entrare" }),
  ).toBeVisible();

  // `rememberPostAuthRedirect` stores the destination before the OAuth/email
  // round trip; simulate that surviving state.
  await page.evaluate(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    [POST_AUTH_REDIRECT_KEY, destination] as const,
  );

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accetta e continua" }).click();
  await expect(
    page.getByRole("heading", { name: "Account in attesa di approvazione" }),
  ).toBeVisible();

  // L'amministratore approva la richiesta (l'approvazione da /iscritti è
  // coperta dal test di onboarding).
  const { error: approvalError } = await service
    .from("profiles")
    .update({ approval_status: "approved" })
    .eq("id", pending.id);
  expect(approvalError).toBeNull();

  await page.getByRole("button", { name: "Controlla di nuovo" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/eventi\\?event=${seed.events.nextTimed.id}$`),
  );
  await expect(page.locator(`#event-${seed.events.nextTimed.id}`)).toBeVisible();

  await context.close();
});
