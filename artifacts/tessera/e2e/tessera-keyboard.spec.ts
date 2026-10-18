import { expect, test, type Page } from "@playwright/test";
import { LUS_KEYBOARD_GLYPHS } from "../src/lib/lus-keyboard-map";

async function openGateKeyboard(page: Page) {
  await page.route("**/api/admin/session/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, configured: true, authenticated: false }),
    }),
  );

  await page.goto("/");
  const entry = page.getByRole("textbox", { name: "Father admin code or LUS form" });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.getByTestId("tessera-keyboard")).toBeVisible();
  return entry;
}

test("custom keyboard inserts a letter on release without a second click", async ({ page }) => {
  const entry = await openGateKeyboard(page);

  await page.getByTestId("tessera-key-q").click();

  await expect(entry).toHaveValue("q");
});

test("holding a key still offers its LUS glyph", async ({ page }) => {
  const entry = await openGateKeyboard(page);
  const key = page.getByTestId("tessera-key-g");
  const pointer = { button: 0, pointerId: 1, pointerType: "touch", isPrimary: true };

  await key.dispatchEvent("pointerdown", pointer);
  const options = page.getByTestId("tessera-long-press-options");
  await expect(options).toBeVisible();
  await key.dispatchEvent("pointerup", pointer);

  await options.getByRole("button", { name: `Type LUS glyph ${LUS_KEYBOARD_GLYPHS.g} for g` }).click();

  await expect(entry).toHaveValue(LUS_KEYBOARD_GLYPHS.g);
});
