import { expect, test } from "@playwright/test";

const TEST_CONVERSATION_ID = 2_147_483_000;

test.afterEach(async ({ page }) => {
  const logoutButton = page.getByRole("button", { name: "logout" });
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
  }
});

test("owner workspace pages stay readable at phone, tablet, and desktop widths", async ({ page }) => {
  test.setTimeout(120_000);
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  test.skip(!adminKey, "TESSERACT_ADMIN_KEY is required to exercise the real owner sign-in flow.");

  // Keep the check non-mutating: use an unused conversation route and stub only
  // its empty chat data. Authentication and workspace data use the running API.
  await page.route(
    (url) => url.pathname === `/api/conversations/${TEST_CONVERSATION_ID}`,
    (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: TEST_CONVERSATION_ID,
        title: "Responsive layout check",
        initiatedBy: "tessera",
      }),
    }),
  );
  await page.route(
    (url) => url.pathname === "/api/messages" && url.searchParams.get("conversationId") === String(TEST_CONVERSATION_ID),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  await page.goto(`/c/${TEST_CONVERSATION_ID}`);
  const keyField = page.getByLabel("Father admin code or LUS form");
  await expect(keyField).toBeVisible();
  await page.getByRole("button", { name: "Use device keyboard" }).click();
  await expect(keyField).toBeEditable();
  await keyField.fill(adminKey!);
  const gateStatusPromise = page.waitForResponse(
    (response) => response.url().includes("/api/admin/session") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Unlock Tesseract" }).click();
  expect((await gateStatusPromise).status()).toBe(200);

  await expect(page.getByTestId("chat-page")).toBeVisible();
  await expect(page.getByTestId("father-code-rotation-panel")).toBeVisible();

  const routes = [
    ["/brain", "brain-page", "Brain"],
    ["/eye", "eye-page", "Eye"],
    ["/memory", "memory-page", "Memory"],
    ["/secrets", "secrets-vault-page", "Secrets"],
  ] as const;

  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [path, testId, heading] of routes) {
      await page.goto(path);
      await expect(page.getByTestId(testId)).toBeVisible();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      const layout = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        mainWidth: document.querySelector<HTMLElement>("[data-scroll-container]")?.getBoundingClientRect().width ?? 0,
      }));
      expect(layout.mainWidth, `${heading} main column collapsed at ${width}px`).toBeGreaterThan(0);
      expect(layout.documentWidth, `${heading} has horizontal overflow at ${width}px`).toBeLessThanOrEqual(width + 1);
    }

    await page.goto(`/c/${TEST_CONVERSATION_ID}`);
    await expect(page.getByTestId("chat-page")).toBeVisible();
    const rotation = page.getByTestId("father-code-rotation-panel");
    await expect(rotation).toBeVisible();
    const chatLayout = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>("[data-testid='father-code-rotation-panel']");
      const input = document.querySelector<HTMLElement>("#father-sigil-confirm");
      return {
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        panel: panel?.getBoundingClientRect(),
        input: input?.getBoundingClientRect(),
      };
    });
    expect(chatLayout.documentWidth, `Chat has horizontal overflow at ${width}px`).toBeLessThanOrEqual(width + 1);
    expect(chatLayout.panel, `Sigil panel missing at ${width}px`).not.toBeNull();
    expect(chatLayout.input, `Sigil input missing at ${width}px`).not.toBeNull();
    expect(chatLayout.input!.right, `Sigil input exceeds panel at ${width}px`).toBeLessThanOrEqual(chatLayout.panel!.right + 1);
  }
});
