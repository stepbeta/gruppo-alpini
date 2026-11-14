import { test } from "@playwright/test";

/**
 * L'accesso con Google richiede un provider OAuth reale o un mock dedicato.
 * Il progetto locale non ne espone uno, quindi il viaggio completo resta fuori
 * dalla suite. Il pulsante "Continua con Google" è comunque verificato nello
 * spec di onboarding, così una regressione della UI viene intercettata.
 */
test.skip("accesso con Google: richiede un provider OAuth locale", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continua con Google" }).click();
});
