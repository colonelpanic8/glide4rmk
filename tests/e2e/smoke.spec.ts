// The browser smoke test: what the Node tests cannot see (layout, real
// hit-testing, the production build). On each simulated board: it opens, a key
// is clicked and changed from its quick menu, Review & send writes the change,
// and the page logs no error on the way.
import { expect, test, type Page } from "@playwright/test";

const BOARDS = ["Demo: Glove80", "Demo: Ortho 60", "Dev stub 4×12", "Demo: Plain 36"];

/** Every error the page reports: console errors and uncaught exceptions. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

for (const board of BOARDS) {
  test(`${board}: opens, a key is changed and sent, no console error`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: board }).click();
    await expect(page.getByText("Up to date")).toBeVisible();

    // A key on the canvas, clicked, then changed from its quick menu.
    const key = page.locator("svg [data-key-row][data-key-col][role=button]").first();
    await key.click();
    await key.click({ button: "right" });
    const menu = page.getByRole("menu");
    const clear = menu.getByRole("menuitem", { name: "Clear key" });
    const transparent = menu.getByRole("menuitem", { name: "Same as layer below" });
    await ((await clear.isDisabled()) ? transparent : clear).click();

    await page.getByRole("button", { name: /Review & send/ }).click();
    const review = page.getByRole("dialog", { name: "Review and send" });
    await review.getByRole("button", { name: "Send 1 change" }).click();
    await expect(page.getByText("Up to date")).toBeVisible();

    expect(errors).toEqual([]);
  });
}
