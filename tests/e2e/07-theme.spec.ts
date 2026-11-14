import { expect, test } from "@playwright/test";
import { THEME_STORAGE_KEY } from "../../lib/theme";
import { E2E_BASE_URL } from "./support/local-supabase";

function darkAtBodyCreation(): void {
  const state = window as unknown as { __e2eDarkAtBody?: boolean | null };
  state.__e2eDarkAtBody = null;

  const observer = new MutationObserver(() => {
    if (document.body && state.__e2eDarkAtBody === null) {
      state.__e2eDarkAtBody =
        document.documentElement.classList.contains("dark");
      observer.disconnect();
    }
  });

  observer.observe(document.documentElement ?? document, {
    childList: true,
    subtree: true,
  });
}

/**
 * Tema:
 *  - la preferenza "scuro" viene applicata prima del paint, quando `<body>`
 *    compare;
 *  - il toggle segue il ciclo sistema → chiaro → scuro → sistema;
 *  - la scelta è persistita in localStorage e sopravvive al reload.
 */
test("il tema scuro è applicato prima del paint e il ciclo persiste", async ({
  browser,
}) => {
  const context = await browser.newContext({
    colorScheme: "dark",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: E2E_BASE_URL,
          localStorage: [{ name: THEME_STORAGE_KEY, value: "dark" }],
        },
      ],
    },
  });
  const page = await context.newPage();
  await page.addInitScript(darkAtBodyCreation);

  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Informativa sulla privacy" }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __e2eDarkAtBody?: boolean | null })
          .__e2eDarkAtBody,
    ),
  ).toBe(true);
  await expect(page.locator("html")).toHaveClass(/dark/);
  // React hydration can add a second theme-color meta; the pre-paint script and
  // ThemeProvider both update the first one.
  expect(
    await page
      .locator('meta[name="theme-color"]')
      .first()
      .getAttribute("content"),
  ).toBe("#0a0a0a");

  // scuro → sistema: con OS scuro il tema resta scuro.
  await page
    .getByRole("button", {
      name: "Tema: scuro (clic per passare a sistema)",
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Tema: sistema (clic per passare a chiaro)",
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);

  // sistema → chiaro: il tema viene rimosso e la preferenza è salvata.
  await page
    .getByRole("button", {
      name: "Tema: sistema (clic per passare a chiaro)",
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Tema: chiaro (clic per passare a scuro)",
    }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(
    await page
      .locator('meta[name="theme-color"]')
      .first()
      .getAttribute("content"),
  ).toBe("#ffffff");
  expect(
    await page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY),
  ).toBe("light");

  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Tema: chiaro (clic per passare a scuro)",
    }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await context.close();
});

test("il tema sistema segue la preferenza chiara del sistema", async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();

  await page.goto("/privacy");
  await expect(
    page.getByRole("button", {
      name: "Tema: sistema (clic per passare a chiaro)",
    }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page
    .getByRole("button", {
      name: "Tema: sistema (clic per passare a chiaro)",
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Tema: chiaro (clic per passare a scuro)",
    }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await context.close();
});
