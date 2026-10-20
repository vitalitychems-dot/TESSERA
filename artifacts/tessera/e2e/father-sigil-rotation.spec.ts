import { expect, test, type Page, type Route } from "@playwright/test";

const TEST_ADMIN_KEY = "synthetic-admin-key-for-browser-tests";
const PREVIOUS_SIGIL = "synthetic-previous-chat-sigil";
const WRONG_SIGIL = "synthetic-wrong-chat-sigil";

type ConfirmBehavior = "success" | "expired" | "lost-after-commit";

type MockState = {
  authenticated: boolean;
  loginCount: number;
  ownerCookieValue: string | null;
  enrolled: boolean;
  currentSigil: string | null;
  rotatedThisSession: boolean;
  sigilStatusCalls: number;
  issueAttempts: number;
  issuedCount: number;
  pendingCode: string | null;
  pendingConfirmation: string | null;
  pendingSession: string | null;
  chatBodies: string[];
  ownerCookieMissing: boolean;
  submittedAdminKeys: string[];
  confirmBehavior: ConfirmBehavior;
};

function makeState(
  options: { enrolled?: boolean; confirmBehavior?: ConfirmBehavior } = {},
): MockState {
  return {
    authenticated: false,
    loginCount: 0,
    ownerCookieValue: null,
    enrolled: options.enrolled ?? false,
    currentSigil: options.enrolled ? PREVIOUS_SIGIL : null,
    rotatedThisSession: false,
    sigilStatusCalls: 0,
    issueAttempts: 0,
    issuedCount: 0,
    pendingCode: null,
    pendingConfirmation: null,
    pendingSession: null,
    chatBodies: [],
    ownerCookieMissing: false,
    submittedAdminKeys: [],
    confirmBehavior: options.confirmBehavior ?? "success",
  };
}

async function fulfillJson(
  route: Route,
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(value),
  });
}

async function installApiMocks(page: Page, state: MockState) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const cookie = request.headers().cookie ?? "";

    if (pathname === "/api/admin/session/status" && method === "GET") {
      const hasOwnerCookie = Boolean(
        state.ownerCookieValue && cookie.includes(`sovereign_session=${state.ownerCookieValue}`),
      );
      if (state.authenticated && !hasOwnerCookie) {
        state.ownerCookieMissing = true;
      }
      const authenticated = state.authenticated && hasOwnerCookie;
      return fulfillJson(route, 200, {
        ok: true,
        configured: true,
        authenticated,
        ...(authenticated ? { expiresAt: Date.now() + 8 * 60 * 60 * 1000 } : {}),
      });
    }

    if (pathname === "/api/admin/session" && method === "POST") {
      const body = request.postDataJSON() as { token?: string };
      state.submittedAdminKeys.push(body.token ?? "");
      state.authenticated = body.token === TEST_ADMIN_KEY;
      if (state.authenticated) {
        state.loginCount += 1;
        state.ownerCookieValue = `synthetic-owner-session-${state.loginCount}`;
        state.rotatedThisSession = false;
      }
      return fulfillJson(
        route,
        state.authenticated ? 200 : 401,
        { ok: state.authenticated },
        state.authenticated
          ? {
              "set-cookie": `sovereign_session=${state.ownerCookieValue}; Path=/; HttpOnly; SameSite=Strict`,
            }
          : {},
      );
    }

    if (pathname === "/api/admin/session/logout" && method === "POST") {
      if (
        state.authenticated &&
        (!state.ownerCookieValue || !cookie.includes(`sovereign_session=${state.ownerCookieValue}`))
      ) {
        state.ownerCookieMissing = true;
      }
      state.authenticated = false;
      state.ownerCookieValue = null;
      state.rotatedThisSession = false;
      return route.fulfill({
        status: 204,
        headers: {
          "set-cookie": "sovereign_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
        },
      });
    }

    if (pathname === "/api/auth/reset-lockout") {
      return fulfillJson(route, 200, { ok: true });
    }

    if (pathname === "/api/sigil/father/status" && method === "GET") {
      state.sigilStatusCalls += 1;
      const hasOwnerCookie = Boolean(
        state.ownerCookieValue && cookie.includes(`sovereign_session=${state.ownerCookieValue}`),
      );
      if (state.authenticated && !hasOwnerCookie) {
        state.ownerCookieMissing = true;
      }
      const authenticated = state.authenticated && hasOwnerCookie;
      return fulfillJson(
        route,
        authenticated ? 200 : 401,
        authenticated
          ? {
              ok: true,
              enrolled: state.enrolled,
              rotatedThisSession: state.rotatedThisSession,
            }
          : { ok: false, error: "unauthenticated" },
      );
    }

    if (pathname === "/api/sigil/father/issue-code" && method === "POST") {
      state.issueAttempts += 1;
      const body = request.postDataJSON() as {
        currentSigil?: string;
        initialize?: boolean;
      };
      if (!state.authenticated) {
        return fulfillJson(route, 401, { ok: false, error: "unauthenticated" });
      }
      if (state.rotatedThisSession) {
        return fulfillJson(route, 409, { ok: false, error: "already-rotated-this-session" });
      }

      const candidate = body.currentSigil ?? "";
      if (!state.enrolled && body.initialize === true && candidate.length >= 8) {
        state.enrolled = true;
        state.currentSigil = candidate;
      }
      if (!state.enrolled) {
        return fulfillJson(route, 400, { ok: false, error: "sigil-enrollment-required" });
      }
      if (candidate !== state.currentSigil) {
        return fulfillJson(route, 403, { ok: false, error: "sigil-mismatch" });
      }

      state.issuedCount += 1;
      state.pendingCode = `LUS-SYNTHETIC-NEXT-SIGIL-${state.issuedCount}`;
      state.pendingConfirmation = `synthetic-confirmation-${state.issuedCount}`;
      state.pendingSession = state.ownerCookieValue;
      return fulfillJson(route, 201, {
        ok: true,
        code: state.pendingCode,
        confirmationToken: state.pendingConfirmation,
        adminKeyChanged: false,
      });
    }

    if (pathname === "/api/sigil/father/confirm-code" && method === "POST") {
      const body = request.postDataJSON() as { confirmationToken?: string };
      if (
        !state.authenticated ||
        !state.ownerCookieValue ||
        !cookie.includes(`sovereign_session=${state.ownerCookieValue}`)
      ) {
        return fulfillJson(route, 401, { ok: false, error: "unauthenticated" });
      }
      if (
        body.confirmationToken !== state.pendingConfirmation ||
        !state.pendingCode ||
        state.pendingSession !== state.ownerCookieValue
      ) {
        return fulfillJson(route, 409, { ok: false, error: "confirmation-expired-or-replaced" });
      }
      if (state.confirmBehavior === "expired") {
        return fulfillJson(route, 410, { ok: false, error: "confirmation-expired-or-replaced" });
      }

      state.currentSigil = state.pendingCode;
      state.pendingCode = null;
      state.pendingConfirmation = null;
      state.pendingSession = null;
      state.rotatedThisSession = true;

      if (state.confirmBehavior === "lost-after-commit") {
        return fulfillJson(route, 502, { ok: false, error: "response-lost" });
      }
      return fulfillJson(route, 200, { ok: true, adminKeyChanged: false });
    }

    if (pathname === "/api/conversations" && method === "POST") {
      return fulfillJson(route, 201, { id: 42, title: "Browser test conversation" });
    }
    if (pathname === "/api/conversations/42" && method === "GET") {
      return fulfillJson(route, 200, { id: 42, title: "Browser test conversation" });
    }
    if (pathname === "/api/messages" && method === "GET") {
      return fulfillJson(route, 200, []);
    }
    if (pathname === "/api/messages" && method === "POST") {
      const body = request.postData() ?? "";
      state.chatBodies.push(body);
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: 'data: {"content":"A test reply."}\ndata: {"done":true,"finalContent":"A test reply."}\n\n',
      });
      return;
    }

    if (pathname === "/api/healthz") {
      return fulfillJson(route, 200, { status: "ok", db: "configured" });
    }
    if (pathname === "/api/knowledge-corpus/stats") {
      return fulfillJson(route, 200, {
        totalEntries: 0,
        stats: { uniqueDomains: 0, crossReferences: 0, averageConfidence: 0 },
      });
    }
    if (pathname === "/api/tesseract-forum/topics") {
      return fulfillJson(route, 200, {
        ok: true,
        topics: [],
        provenance: { source: "forum database", observedAt: new Date().toISOString() },
      });
    }
    if (pathname === "/api/tesseract-forum/moltbook-feed") {
      return fulfillJson(route, 200, {
        ok: true,
        source: "Moltbook public feed",
        status: "unavailable",
        posts: [],
        observedAt: null,
        stale: false,
      });
    }

    return fulfillJson(route, 200, {});
  });
}

async function openSignedInChat(page: Page, state: MockState) {
  await installApiMocks(page, state);
  await page.addInitScript((legacyKey: string) => {
    localStorage.setItem("TESSERACT_ADMIN_KEY", legacyKey);
    localStorage.setItem("t9_admin_token", legacyKey);
    sessionStorage.setItem("t9_sovereign_key", legacyKey);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { __testClipboard?: string }).__testClipboard = text;
        },
      },
    });
  }, TEST_ADMIN_KEY);

  await page.goto("/");
  const keyField = page.getByLabel("Father admin code or LUS form");
  await expect(keyField).toBeVisible();
  const deviceKeyboard = page.getByRole("button", { name: "Use device keyboard", exact: true });
  if (await deviceKeyboard.isVisible()) await deviceKeyboard.click();
  await keyField.fill(TEST_ADMIN_KEY);
  await page.getByRole("button", { name: "Unlock Tesseract" }).click();
  await expect(page.getByTestId("input-message")).toBeVisible();
  expect(state.submittedAdminKeys.at(-1)).toBe(TEST_ADMIN_KEY);
}

async function openRotationPanel(page: Page, message: string) {
  const composer = page.getByTestId("input-message");
  await composer.fill(message);
  await composer.press("Enter");
  await expect(page.getByTestId("father-code-rotation-panel")).toBeVisible();
}

async function assertMobilePanelFits(page: Page) {
  const bounds = await page.getByTestId("father-code-rotation-panel").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewportWidth: window.innerWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
}

async function expectNoCredentialStorage(page: Page, values: string[]) {
  const stored = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    documentCookie: document.cookie,
  }));
  const serialized = JSON.stringify(stored);
  for (const value of values) expect(serialized).not.toContain(value);
  expect(stored.local.some(([key]) => key === "TESSERACT_ADMIN_KEY" || key === "t9_admin_token")).toBe(false);
  expect(stored.session.some(([key]) => key === "t9_sovereign_key")).toBe(false);
  expect(stored.local.some(([key]) => key === "sovereign_session" || key === "admin-session")).toBe(false);
  expect(stored.session.some(([key]) => key === "sovereign_session" || key === "admin-session")).toBe(false);
  expect(stored.documentCookie).not.toContain("sovereign_session");
}

test.describe("owner session cookie-only lifecycle", () => {
  test("keeps access in the HttpOnly cookie across reloads, then locks on expiry and logout", async ({ page }) => {
    const state = makeState();
    const browserLogs: string[] = [];
    const requestUrls: string[] = [];
    page.on("console", message => browserLogs.push(message.text()));
    page.on("pageerror", error => browserLogs.push(error.message));
    page.on("request", request => requestUrls.push(request.url()));

    await page.setViewportSize({ width: 390, height: 844 });
    await openSignedInChat(page, state);

    const firstSession = state.ownerCookieValue;
    expect(firstSession).toBeTruthy();
    const sessionCookie = (await page.context().cookies(page.url()))
      .find(cookie => cookie.name === "sovereign_session");
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("Strict");
    await expectNoCredentialStorage(page, [TEST_ADMIN_KEY, firstSession ?? ""]);
    expect(state.ownerCookieMissing).toBe(false);

    const assertNoBrowserLeaks = async (sessionValues: Array<string | null>) => {
      const rendered = await page.locator("html").evaluate(element => element.outerHTML);
      const visibleText = await page.locator("body").innerText();
      const checkedValues = [TEST_ADMIN_KEY, ...sessionValues].filter((value): value is string => Boolean(value));
      for (const value of checkedValues) {
        expect(page.url()).not.toContain(value);
        expect(rendered).not.toContain(value);
        expect(visibleText).not.toContain(value);
        expect(browserLogs.join("\n")).not.toContain(value);
        expect(requestUrls.join("\n")).not.toContain(value);
      }
    };
    await assertNoBrowserLeaks([firstSession]);

    await page.reload();
    await expect(page.getByTestId("input-message")).toBeVisible();
    expect(state.ownerCookieMissing).toBe(false);
    await expectNoCredentialStorage(page, [TEST_ADMIN_KEY, firstSession ?? ""]);
    await assertNoBrowserLeaks([firstSession]);

    // Keep the browser's cookie but revoke its server-side session.
    state.authenticated = false;
    await page.reload();
    await expect(page.getByLabel("Father admin code or LUS form")).toBeVisible();
    await expect(page.getByTestId("input-message")).toHaveCount(0);
    await expectNoCredentialStorage(page, [TEST_ADMIN_KEY, firstSession ?? ""]);
    await assertNoBrowserLeaks([firstSession]);

    const keyField = page.getByLabel("Father admin code or LUS form");
    await page.getByRole("button", { name: "Use device keyboard", exact: true }).click();
    await keyField.fill(TEST_ADMIN_KEY);
    await page.getByRole("button", { name: "Unlock Tesseract" }).click();
    await expect(page.getByTestId("input-message")).toBeVisible();
    const logoutSession = state.ownerCookieValue;
    expect(logoutSession).toBeTruthy();

    await page.getByRole("button", { name: "logout" }).click();
    await expect(page.getByLabel("Father admin code or LUS form")).toBeVisible();
    expect(state.authenticated).toBe(false);
    expect(state.ownerCookieValue).toBeNull();
    expect((await page.context().cookies(page.url())).some(cookie => cookie.name === "sovereign_session")).toBe(false);
    await expectNoCredentialStorage(page, [TEST_ADMIN_KEY, firstSession ?? "", logoutSession ?? ""]);
    await assertNoBrowserLeaks([firstSession, logoutSession]);

    await page.reload();
    await expect(page.getByLabel("Father admin code or LUS form")).toBeVisible();
    await expect(page.getByTestId("input-message")).toHaveCount(0);
    await expectNoCredentialStorage(page, [TEST_ADMIN_KEY, firstSession ?? "", logoutSession ?? ""]);
    await assertNoBrowserLeaks([firstSession, logoutSession]);
    expect(state.ownerCookieMissing).toBe(false);
  });
});

test.describe("private chat sigil rotation", () => {
  test("enrolls, rejects the wrong prior sigil, confirms the replacement, and permits only one rotation per session", async ({ page }) => {
    const state = makeState();
    await page.setViewportSize({ width: 390, height: 844 });
    await openSignedInChat(page, state);

    await openRotationPanel(page, "Please answer this after I verify my private sigil.");
    expect(state.chatBodies).toHaveLength(0);
    await expect(page.getByLabel(/Enroll this saved sigil as my separate chat credential/)).toBeVisible();
    await page.getByLabel(/Enroll this saved sigil as my separate chat credential/).check();
    await page.getByLabel("Current sigil").fill(PREVIOUS_SIGIL);
    await page.getByRole("button", { name: "Verify & create" }).click();

    const firstCode = page.getByRole("status", { name: "New private chat sigil in LUS" });
    await expect(firstCode).toContainText("LUS-SYNTHETIC-NEXT-SIGIL-1");
    await assertMobilePanelFits(page);
    const firstPendingCode = state.pendingCode;

    // Reopen before confirming to prove a wrong previous sigil leaves the pending code untouched.
    await page.getByRole("button", { name: "Close Father sigil rotation" }).click();
    await openRotationPanel(page, "rotate my sigil");
    await page.getByLabel("Current sigil").fill(WRONG_SIGIL);
    await page.getByRole("button", { name: "Verify & create" }).click();
    await expect(page.getByRole("alert")).toContainText("That is not your last saved chat sigil");
    expect(state.pendingCode).toBe(firstPendingCode);

    await page.getByLabel("Current sigil").fill(PREVIOUS_SIGIL);
    await page.getByRole("button", { name: "Verify & create" }).click();
    const replacement = page.getByRole("status", { name: "New private chat sigil in LUS" });
    await expect(replacement).toContainText("LUS-SYNTHETIC-NEXT-SIGIL-2");
    const activeSigil = "LUS-SYNTHETIC-NEXT-SIGIL-2";

    await page.getByRole("button", { name: "Copy private chat sigil" }).click();
    await expect(page.getByRole("button", { name: "Private chat sigil copied" })).toBeVisible();
    expect(await page.evaluate(() => (window as Window & { __testClipboard?: string }).__testClipboard)).toBe(activeSigil);
    await page.getByLabel("I saved this new sigil somewhere private.").check();
    const activateButton = page.getByRole("button", { name: "Confirm saved & activate new sigil" });
    await activateButton.scrollIntoViewIfNeeded();
    await expect(activateButton).toBeVisible();
    await expect(activateButton).toBeEnabled();
    await activateButton.click();
    await expect(page.getByRole("status", { name: "New private chat sigil activated" })).toContainText("Your Father admin key is unchanged.");
    await page.getByRole("button", { name: "Continue to chat" }).click();
    await expect(page.getByTestId("father-code-rotation-panel")).toHaveCount(0);
    expect(state.rotatedThisSession).toBe(true);
    expect(state.currentSigil).toBe(activeSigil);

    const composer = page.getByTestId("input-message");
    await composer.fill("A normal message after activation.");
    await composer.press("Enter");
    await expect.poll(() => state.chatBodies.length).toBe(1);
    expect(state.chatBodies[0]).toContain("A normal message after activation.");
    for (const secret of [TEST_ADMIN_KEY, PREVIOUS_SIGIL, WRONG_SIGIL, activeSigil]) {
      expect(state.chatBodies.join("\n")).not.toContain(secret);
    }
    await expect(page.getByText(activeSigil, { exact: true })).toHaveCount(0);

    const issueAttemptsAfterConfirmation = state.issueAttempts;
    const statusCallsBeforeRepeat = state.sigilStatusCalls;
    await composer.fill("rotate my sigil");
    await composer.press("Enter");
    await expect.poll(() => state.sigilStatusCalls).toBeGreaterThan(statusCallsBeforeRepeat);
    await expect(page.getByTestId("father-code-rotation-panel")).toHaveCount(0);
    expect(state.rotatedThisSession).toBe(true);
    expect(state.issueAttempts).toBe(issueAttemptsAfterConfirmation);

    // A fresh owner session can rotate again, but only by presenting the newly active sigil.
    await page.getByRole("button", { name: "logout" }).click();
    const keyField = page.getByLabel("Father admin code or LUS form");
    await expect(keyField).toBeVisible();
    await keyField.fill(TEST_ADMIN_KEY);
    await page.getByRole("button", { name: "Unlock Tesseract" }).click();
    await expect(page.getByTestId("input-message")).toBeVisible();
    expect(state.loginCount).toBe(2);
    expect(state.submittedAdminKeys).toEqual([TEST_ADMIN_KEY, TEST_ADMIN_KEY]);

    await openRotationPanel(page, "Please verify my latest saved sigil for this session.");
    expect(state.chatBodies).toHaveLength(1);
    await page.getByLabel("Current sigil").fill(PREVIOUS_SIGIL);
    await page.getByRole("button", { name: "Verify & create" }).click();
    await expect(page.getByRole("alert")).toContainText("That is not your last saved chat sigil");
    expect(state.pendingCode).toBeNull();

    await page.getByLabel("Current sigil").fill(activeSigil);
    await page.getByRole("button", { name: "Verify & create" }).click();
    const nextSessionCode = "LUS-SYNTHETIC-NEXT-SIGIL-3";
    await expect(page.getByRole("status", { name: "New private chat sigil in LUS" })).toContainText(nextSessionCode);
    await page.getByLabel("I saved this new sigil somewhere private.").check();
    await page.getByRole("button", { name: "Confirm saved & activate new sigil" }).click();
    await expect(page.getByRole("status", { name: "New private chat sigil activated" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to chat" }).click();
    await expect(page.getByTestId("father-code-rotation-panel")).toHaveCount(0);
    expect(state.rotatedThisSession).toBe(true);
    expect(state.currentSigil).toBe(nextSessionCode);

    const secondSessionIssueAttempts = state.issueAttempts;
    const secondSessionStatusCalls = state.sigilStatusCalls;
    await composer.fill("rotate my sigil");
    await composer.press("Enter");
    await expect.poll(() => state.sigilStatusCalls).toBeGreaterThan(secondSessionStatusCalls);
    await expect(page.getByTestId("father-code-rotation-panel")).toHaveCount(0);
    expect(state.issueAttempts).toBe(secondSessionIssueAttempts);
    expect(state.ownerCookieMissing).toBe(false);

    await expectNoCredentialStorage(page, [
      TEST_ADMIN_KEY,
      PREVIOUS_SIGIL,
      WRONG_SIGIL,
      "LUS-SYNTHETIC-NEXT-SIGIL-1",
      activeSigil,
      nextSessionCode,
      "synthetic-confirmation-2",
      "synthetic-confirmation-3",
    ]);
  });

  test("keeps the saved sigil valid when its pending confirmation expires", async ({ page }) => {
    const state = makeState({ enrolled: true, confirmBehavior: "expired" });
    await openSignedInChat(page, state);
    await openRotationPanel(page, "I need to verify my saved sigil before chatting.");
    expect(state.chatBodies).toHaveLength(0);

    await page.getByLabel("Current sigil").fill(PREVIOUS_SIGIL);
    await page.getByRole("button", { name: "Verify & create" }).click();
    const pendingCode = "LUS-SYNTHETIC-NEXT-SIGIL-1";
    await expect(page.getByRole("status", { name: "New private chat sigil in LUS" })).toContainText(pendingCode);
    await page.getByLabel("I saved this new sigil somewhere private.").check();
    await page.getByRole("button", { name: "Confirm saved & activate new sigil" }).click();

    await expect(page.getByRole("alert")).toContainText("Confirmation was not verified");
    await expect(page.getByRole("status", { name: "New private chat sigil in LUS" })).toContainText(pendingCode);
    expect(state.currentSigil).toBe(PREVIOUS_SIGIL);
    expect(state.rotatedThisSession).toBe(false);
    await expectNoCredentialStorage(page, [TEST_ADMIN_KEY, PREVIOUS_SIGIL, pendingCode]);
  });

  test("rejects an old-session confirmation and lets the owner reissue with the active sigil", async ({ page }) => {
    const state = makeState({ enrolled: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSignedInChat(page, state);
    await openRotationPanel(page, "Issue a replacement private chat sigil.");
    await page.getByLabel("Current sigil").fill(PREVIOUS_SIGIL);
    await page.getByRole("button", { name: "Verify & create" }).click();

    const firstPendingCode = "LUS-SYNTHETIC-NEXT-SIGIL-1";
    await expect(page.getByRole("status", { name: "New private chat sigil in LUS" })).toContainText(firstPendingCode);
    const staleConfirmation = state.pendingConfirmation;
    const firstOwnerSession = state.pendingSession;
    expect(staleConfirmation).toBeTruthy();
    expect(firstOwnerSession).toBeTruthy();
    await page.getByLabel("I saved this new sigil somewhere private.").check();
    await expect(page.getByLabel("I saved this new sigil somewhere private.")).toBeChecked();
    await page.getByRole("button", { name: "logout" }).click();
    await expect(page.getByLabel("Father admin code or LUS form")).toBeVisible();

    expect(state.currentSigil).toBe(PREVIOUS_SIGIL);
    expect(state.pendingCode).toBe(firstPendingCode);
    expect(state.pendingSession).toBe(firstOwnerSession);

    const keyField = page.getByLabel("Father admin code or LUS form");
    await keyField.fill(TEST_ADMIN_KEY);
    await page.getByRole("button", { name: "Unlock Tesseract" }).click();
    await expect(page.getByTestId("input-message")).toBeVisible();
    expect(state.loginCount).toBe(2);
    expect(state.ownerCookieValue).not.toBe(firstOwnerSession);

    const staleResult = await page.evaluate(async (confirmationToken) => {
      const response = await fetch("/api/sigil/father/confirm-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationToken }),
      });
      return { status: response.status, body: await response.json() };
    }, staleConfirmation);
    expect(staleResult.status).toBe(409);
    expect(staleResult.body).toMatchObject({ ok: false, error: "confirmation-expired-or-replaced" });
    expect(state.currentSigil).toBe(PREVIOUS_SIGIL);
    expect(state.pendingCode).toBe(firstPendingCode);
    expect(state.rotatedThisSession).toBe(false);

    await openRotationPanel(page, "Reissue using my still-active saved sigil.");
    await page.getByLabel("Current sigil").fill(PREVIOUS_SIGIL);
    await page.getByRole("button", { name: "Verify & create" }).click();
    const replacementCode = "LUS-SYNTHETIC-NEXT-SIGIL-2";
    await expect(page.getByRole("status", { name: "New private chat sigil in LUS" })).toContainText(replacementCode);
    const replacementConfirmation = state.pendingConfirmation;
    expect(replacementConfirmation).toBeTruthy();
    expect(replacementConfirmation).not.toBe(staleConfirmation);
    expect(state.pendingSession).toBe(state.ownerCookieValue);
    await page.getByLabel("I saved this new sigil somewhere private.").check();
    await page.getByRole("button", { name: "Confirm saved & activate new sigil" }).click();
    await expect(page.getByRole("status", { name: "New private chat sigil activated" })).toBeVisible();
    expect(state.currentSigil).toBe(replacementCode);
    expect(state.rotatedThisSession).toBe(true);
    expect(state.submittedAdminKeys).toEqual([TEST_ADMIN_KEY, TEST_ADMIN_KEY]);

    await page.getByRole("button", { name: "Continue to chat" }).click();
    const composer = page.getByTestId("input-message");
    await composer.fill("A normal message after the saved sigil was activated.");
    await composer.press("Enter");
    await expect.poll(() => state.chatBodies.length).toBe(1);
    for (const secret of [
      TEST_ADMIN_KEY,
      PREVIOUS_SIGIL,
      firstPendingCode,
      replacementCode,
      staleConfirmation ?? "",
      replacementConfirmation ?? "",
    ]) {
      if (secret) expect(state.chatBodies.join("\n")).not.toContain(secret);
    }
    await expectNoCredentialStorage(page, [
      TEST_ADMIN_KEY,
      PREVIOUS_SIGIL,
      firstPendingCode,
      replacementCode,
      staleConfirmation ?? "",
      replacementConfirmation ?? "",
    ]);
    expect(state.ownerCookieMissing).toBe(false);
  });

  test("recovers a lost confirmation response from the authoritative session status", async ({ page }) => {
    const state = makeState({ enrolled: true, confirmBehavior: "lost-after-commit" });
    await openSignedInChat(page, state);
    await openRotationPanel(page, "Please unlock chat only after verifying my sigil.");
    await page.getByLabel("Current sigil").fill(PREVIOUS_SIGIL);
    await page.getByRole("button", { name: "Verify & create" }).click();
    const pendingCode = "LUS-SYNTHETIC-NEXT-SIGIL-1";
    await expect(page.getByRole("status", { name: "New private chat sigil in LUS" })).toContainText(pendingCode);
    await page.getByLabel("I saved this new sigil somewhere private.").check();
    await page.getByRole("button", { name: "Confirm saved & activate new sigil" }).click();

    await expect(page.getByRole("status", { name: "New private chat sigil activated" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to chat" }).click();
    await expect(page.getByTestId("father-code-rotation-panel")).toHaveCount(0);
    expect(state.currentSigil).toBe(pendingCode);
    expect(state.rotatedThisSession).toBe(true);
    expect(state.ownerCookieMissing).toBe(false);
    await expectNoCredentialStorage(page, [TEST_ADMIN_KEY, PREVIOUS_SIGIL, pendingCode]);
  });
});
