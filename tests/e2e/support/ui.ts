import { expect, type Page } from "@playwright/test";

/**
 * Fills and submits the login form on the current page.
 *
 * Kept separate from `loginThroughUi` so deep-link tests can submit the form
 * that AuthGuard opened (`/login?next=...`) without navigating away and losing
 * the intended destination.
 */
export async function submitLoginForm(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "Bentornato in gruppo" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  // The "Accedi" mode tab has the same name as the submit button.
  await page
    .locator("form")
    .getByRole("button", { name: "Accedi", exact: true })
    .click();
}

/** Signs in through the real login form (used at least once per suite). */
export async function loginThroughUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await submitLoginForm(page, email, password);
}

/** Waits for an authenticated page and dismisses the "checking" screens. */
export async function expectHome(page: Page, firstName: string): Promise<void> {
  await expect(
    page.getByRole("heading", { name: `Bentornato, ${firstName}.` }),
  ).toBeVisible();
}
