import { expect, test } from "@playwright/test";

const TEST_CONVERSATION_ID = 2_147_483_000;

test.afterEach(async ({ page }) => {
  const logoutButton = page.getByRole("button", { name: "logout" });
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
  }
});

test("World panel stays readable at phone, tablet, and desktop widths with the real owner gate", async ({ page }) => {
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  test.skip(!adminKey, "TESSERACT_ADMIN_KEY is required to exercise the real owner sign-in flow.");

  // Keep the check non-mutating: the app normally creates a conversation when
  // opening "/", so use an unused test route and stub only its empty chat data.
  // Authentication and all World signals continue to use the running API.
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
  await keyField.fill(adminKey!);
  const gateStatusPromise = page.waitForResponse(
    (response) => response.url().includes("/api/admin/session") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Unlock Tesseract" }).click();
  expect((await gateStatusPromise).status()).toBe(200);

  await expect(page.getByTestId("tessera-world-stage")).toBeVisible();
  await expect(page.getByTestId("agentcraft-world-panel")).toBeVisible();
  await expect(page.getByTestId("world-map-unavailable")).toBeVisible();
  await expect(page.getByRole("heading", { name: "THE EYE" })).toBeVisible();
  await expect(page.getByRole("link", { name: /The Brain/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Chat / conversation" })).toBeVisible();
  // A fresh owner session must rotate the separate chat sigil before the
  // composer is available, so assert the real first-session chat gate here.
  const rotationPanel = page.getByTestId("father-code-rotation-panel");
  const savedSigilField = page.getByPlaceholder("Last saved chat sigil");
  await expect(rotationPanel).toBeVisible();
  await expect(savedSigilField).toBeVisible();
  const sigilStatus = await page.evaluate(async () => {
    const response = await fetch("/api/sigil/father/status", {
      credentials: "include",
      cache: "no-store",
    });
    return {
      status: response.status,
      body: await response.json() as {
        ok?: boolean;
        enrolled?: boolean;
        rotatedThisSession?: boolean;
      },
    };
  });
  expect(sigilStatus.status).toBe(200);
  expect(sigilStatus.body).toMatchObject({ ok: true, rotatedThisSession: false });
  expect(typeof sigilStatus.body.enrolled).toBe("boolean");

  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("[data-scroll-container]")?.scrollTo(0, 0);
      document.querySelector<HTMLElement>(".tw-world-column")?.scrollTo(0, 0);
    });

    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      };
      return {
        viewportWidth: window.innerWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        stage: box("[data-testid='tessera-world-stage']"),
        world: box(".tw-world-column"),
        unavailable: box("[data-testid='world-map-unavailable']"),
        unavailableCopy: box(".tw-world-source-copy"),
        eye: box(".tw-service-panel"),
        brain: box(".tw-brain-panel"),
        chat: box(".tw-chat-column"),
        rotation: box("[data-testid='father-code-rotation-panel']"),
        rotationInput: box("#father-sigil-confirm"),
      };
    });

    expect(layout.stage, `World stage missing at ${width}px`).not.toBeNull();
    expect(layout.world, `World column missing at ${width}px`).not.toBeNull();
    expect(layout.unavailable, `Source notice missing at ${width}px`).not.toBeNull();
    expect(layout.eye?.width, `Eye panel collapsed at ${width}px`).toBeGreaterThan(0);
    expect(layout.brain?.width, `Brain panel collapsed at ${width}px`).toBeGreaterThan(0);
    expect(layout.chat?.width, `Chat panel collapsed at ${width}px`).toBeGreaterThan(0);
    expect(layout.rotation, `Sigil-rotation panel missing at ${width}px`).not.toBeNull();
    expect(layout.rotationInput, `Current-sigil field missing at ${width}px`).not.toBeNull();
    expect(layout.documentWidth, `Page has horizontal overflow at ${width}px`).toBeLessThanOrEqual(width + 1);
    expect(layout.stage!.right, `World stage exceeds viewport at ${width}px`).toBeLessThanOrEqual(width + 1);
    expect(layout.unavailable!.left, `Source notice is clipped on the left at ${width}px`).toBeGreaterThanOrEqual(layout.world!.left - 1);
    expect(layout.unavailable!.right, `Source notice is clipped on the right at ${width}px`).toBeLessThanOrEqual(layout.world!.right + 1);
    expect(layout.unavailableCopy!.right, `Source text exceeds its notice at ${width}px`).toBeLessThanOrEqual(layout.unavailable!.right + 1);
    expect(layout.unavailable!.scrollWidth, `Source notice content overflows at ${width}px`).toBeLessThanOrEqual(layout.unavailable!.clientWidth + 1);
    expect(layout.rotation!.left, `Sigil panel is clipped on the left at ${width}px`).toBeGreaterThanOrEqual(layout.chat!.left - 1);
    expect(layout.rotation!.right, `Sigil panel is clipped on the right at ${width}px`).toBeLessThanOrEqual(layout.chat!.right + 1);
    expect(layout.rotationInput!.right, `Sigil field exceeds its panel at ${width}px`).toBeLessThanOrEqual(layout.rotation!.right + 1);
    expect(layout.rotationInput!.scrollWidth, `Sigil field content overflows at ${width}px`).toBeLessThanOrEqual(layout.rotationInput!.clientWidth + 1);

    await expect(savedSigilField, `Current-sigil field is not available at ${width}px`).toBeVisible();
  }
});
