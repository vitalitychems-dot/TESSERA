import { expect, test, type Page, type Route } from "@playwright/test";

const TEST_OWNER_KEY = "synthetic-rick-owner-key-for-browser-tests";
const OWNER_COOKIE = "synthetic-rick-owner-session";

type RickProposal = {
  id: string;
  title: string;
  problem: string;
  evidence: Array<{ metric: string; value: number }>;
  proposedChange: string;
  testPlan: string;
  risk: "low" | "medium" | "high";
  effortHours: number;
  category: string;
  state: "pending-review" | "approved" | "rejected" | "implemented";
  reviewerReason?: string;
  generatedAt: number;
  source: "deterministic";
  approvedBy?: string;
  approvalTestRef?: string;
  implementedBy?: string;
  implementationTestRef?: string;
};

type MockState = {
  authenticated: boolean;
  proposals: RickProposal[];
  proposalFetches: number;
  ownerCookieMissing: boolean;
  mutationCookieMissing: boolean;
};

function makeProposal(id: string, title: string): RickProposal {
  return {
    id,
    title,
    problem: "A measured reliability gap needs owner review.",
    evidence: [{ metric: "daemon.overallSystemScorePct", value: 73 }],
    proposedChange: "Add a small, testable reliability improvement.",
    testPlan: "UNMEASURED — test: compare the target metric before and after the change.",
    risk: "low",
    effortHours: 2,
    category: "reliability",
    state: "pending-review",
    generatedAt: Date.now(),
    source: "deterministic",
  };
}

function makeState(): MockState {
  return {
    authenticated: false,
    proposals: [
      makeProposal("owner-approval", "Owner approval evidence path"),
      makeProposal("rejection", "Rejected proposal stays rejected"),
      makeProposal("server-error", "Server errors stay visible"),
    ],
    proposalFetches: 0,
    ownerCookieMissing: false,
    mutationCookieMissing: false,
  };
}

async function fulfillJson(route: Route, status: number, value: unknown, headers: Record<string, string> = {}) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(value),
  });
}

function countsFor(proposals: RickProposal[]) {
  return proposals.reduce<Record<string, number>>((counts, proposal) => {
    counts[proposal.state] = (counts[proposal.state] ?? 0) + 1;
    return counts;
  }, {});
}

async function installRickApiMocks(page: Page, state: MockState) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const cookie = request.headers().cookie ?? "";
    const hasOwnerCookie = cookie.includes(`sovereign_session=${OWNER_COOKIE}`);

    if (pathname === "/api/admin/session/status" && method === "GET") {
      if (state.authenticated && !hasOwnerCookie) state.ownerCookieMissing = true;
      return fulfillJson(route, 200, {
        ok: true,
        configured: true,
        authenticated: state.authenticated && hasOwnerCookie,
        ...(state.authenticated && hasOwnerCookie ? { expiresAt: Date.now() + 8 * 60 * 60 * 1000 } : {}),
      });
    }

    if (pathname === "/api/admin/session" && method === "POST") {
      const body = request.postDataJSON() as { token?: string };
      state.authenticated = body.token === TEST_OWNER_KEY;
      return fulfillJson(
        route,
        state.authenticated ? 200 : 401,
        state.authenticated ? { ok: true, expiresAt: Date.now() + 8 * 60 * 60 * 1000 } : { ok: false },
        state.authenticated
          ? { "set-cookie": `sovereign_session=${OWNER_COOKIE}; Path=/; HttpOnly; SameSite=Strict` }
          : {},
      );
    }

    if (pathname === "/api/admin/session/logout" && method === "POST") {
      state.authenticated = false;
      return fulfillJson(route, 200, { ok: true });
    }

    if (pathname === "/api/rick/proposals" && method === "GET") {
      state.proposalFetches += 1;
      return fulfillJson(route, 200, {
        ok: true,
        proposals: state.proposals.map((proposal) => ({ ...proposal, evidence: [...proposal.evidence] })),
        counts: countsFor(state.proposals),
        lastGeneratedAt: Date.now(),
        capacity: 5,
      });
    }

    const proposalAction = pathname.match(/^\/api\/rick\/proposals\/([^/]+)\/(approve|reject|implemented)$/);
    if (proposalAction && method === "POST") {
      if (!state.authenticated || !hasOwnerCookie) {
        state.mutationCookieMissing = true;
        return fulfillJson(route, 401, { ok: false, error: "owner-session-required" });
      }

      const [, proposalId, action] = proposalAction;
      if (proposalId === "server-error" && action === "approve") {
        return fulfillJson(route, 503, { ok: false, error: "Synthetic review service error." });
      }

      const proposal = state.proposals.find((item) => item.id === proposalId);
      if (!proposal) return fulfillJson(route, 404, { ok: false, error: "proposal-not-found" });
      const body = request.postDataJSON() as {
        approver?: string;
        implementer?: string;
        testRef?: string;
        reason?: string;
      };

      if (action === "approve" && proposal.state === "pending-review") {
        proposal.state = "approved";
        proposal.approvedBy = body.approver;
        proposal.approvalTestRef = body.testRef;
      } else if (action === "reject" && proposal.state === "pending-review") {
        proposal.state = "rejected";
        proposal.reviewerReason = body.reason;
      } else if (action === "implemented" && proposal.state === "approved") {
        proposal.state = "implemented";
        proposal.implementedBy = body.implementer;
        proposal.implementationTestRef = body.testRef;
      } else {
        return fulfillJson(route, 409, { ok: false, error: "proposal-state-conflict" });
      }

      return fulfillJson(route, 200, { ok: true, proposal: { ...proposal } });
    }

    if (pathname === "/api/council/consensus") {
      return fulfillJson(route, 200, {
        consensus: {
          votingMethod: "phi-weighted-parallel",
          bftResponseThreshold: 0.667,
          agentCount: 7,
          totalProposals: 1,
          approved: 1,
          rejected: 0,
          avgApprovalRate: 72,
          phiConstant: 1.618034,
          avgVotingDurationMs: 45,
        },
        executor: { isRunning: false, autoProcessed: 0 },
        hierarchy: { totalAgents: 7 },
      });
    }

    if (pathname === "/api/council/proposals") {
      return fulfillJson(route, 200, {
        proposals: [{
          id: "council-ballot",
          title: "Synthetic Council ballot",
          description: "This vote is a Council record, not an owner approval.",
          category: "governance",
          proposedBy: "Council test fixture",
          status: "approved",
          approvalRate: 0.72,
          votingDurationMs: 45,
          votingMethod: "phi-weighted-parallel",
          yesCount: 6,
          noCount: 2,
          abstainCount: 1,
          votes: [
            { vote: "approve", agentName: "Agent Alpha", phiWeight: 1, reasoning: "Synthetic yes vote." },
            { vote: "reject", agentName: "Agent Beta", phiWeight: 1, reasoning: "Synthetic no vote." },
          ],
        }],
      });
    }

    if (pathname === "/api/council/decisions") return fulfillJson(route, 200, { decisions: [] });
    if (pathname === "/api/rick/autonomous/inventions") return fulfillJson(route, 200, { ok: true, rows: [], categories: [], perCategory: {} });
    if (pathname === "/api/rick/council-proposals") return fulfillJson(route, 200, { ok: true, proposals: [], count: 0 });

    return fulfillJson(route, 200, { ok: true });
  });
}

async function signInOnRickPage(page: Page, state: MockState) {
  await installRickApiMocks(page, state);
  await page.goto("/rick");
  const adminField = page.getByLabel("Father admin code or LUS form");
  await expect(adminField).toBeVisible();
  await adminField.fill(TEST_OWNER_KEY);
  await page.getByRole("button", { name: "Unlock Tesseract" }).click();
  await expect(page.getByText("Owner approval evidence path")).toBeVisible();
  expect(state.ownerCookieMissing).toBe(false);
}

test.describe("Rick owner evidence on mobile", () => {
  test("separates owner evidence from Council votes, preserves rejections, and refreshes successful actions", async ({ page }, testInfo) => {
    const state = makeState();
    await signInOnRickPage(page, state);

    const mobileIdentityBounds = await page.getByTestId("rick-header-identity").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
    });
    const mobileSelectorTop = await page.getByTestId("rick-section-dropdown-wrapper").evaluate((element) => element.getBoundingClientRect().top);
    expect(mobileIdentityBounds.width).toBeGreaterThan(320);
    expect(mobileSelectorTop).toBeGreaterThan(mobileIdentityBounds.bottom);

    await expect(page.getByText("Council ballots are shown separately in Grand Council.")).toBeVisible();
    await expect(page.getByLabel("Reviewer / implementer")).toBeVisible();
    await expect(page.getByLabel("Test result reference (submitted by you)")).toBeVisible();
    await expect(page.getByText("Council vote record", { exact: true })).toHaveCount(0);

    const reviewer = page.getByLabel("Reviewer / implementer");
    const testRef = page.getByLabel("Test result reference (submitted by you)");
    await reviewer.fill("Father");
    await testRef.fill("CI://rick-review/owner-approval-17");

    const approvalCard = page.getByTestId("rick-proposal-card-owner-approval");
    const readsBeforeApproval = state.proposalFetches;
    await approvalCard.getByRole("button", { name: "Approve" }).click();
    await expect.poll(() => state.proposalFetches).toBeGreaterThan(readsBeforeApproval);
    await expect(approvalCard).toContainText("approved");
    await expect(approvalCard).toContainText("Approval recorded by: Father");
    await expect(approvalCard).toContainText("Approval test reference: CI://rick-review/owner-approval-17");
    await expect(approvalCard.getByRole("region", { name: "Owner approval and implementation evidence" })).toBeVisible();
    await expect(approvalCard).not.toContainText("Council vote record");
    await expect(page.getByRole("status")).toContainText("This has not deployed code.");

    await testRef.fill("CI://rick-review/implementation-18");
    const readsBeforeImplementation = state.proposalFetches;
    await approvalCard.getByRole("button", { name: "Mark as Implemented" }).click();
    await expect.poll(() => state.proposalFetches).toBeGreaterThan(readsBeforeImplementation);
    await expect(approvalCard).toContainText("implemented");
    await expect(approvalCard).toContainText("Implementation record submitted by: Father");
    await expect(approvalCard).toContainText("Implementation test reference: CI://rick-review/implementation-18");
    await expect(page.getByRole("status")).toContainText("This action does not run tests or deploy code.");
    await page.reload();
    await expect(page.getByTestId("rick-proposal-card-owner-approval")).toContainText("Implementation test reference: CI://rick-review/implementation-18");

    const rejectionCard = page.getByTestId("rick-proposal-card-rejection");
    await rejectionCard.getByRole("button", { name: "Reject" }).click();
    await page.getByPlaceholder("(Optional) Why are you rejecting this?").fill("The evidence does not justify this change.");
    const readsBeforeRejection = state.proposalFetches;
    await rejectionCard.getByRole("button", { name: "Confirm reject" }).click();
    await expect.poll(() => state.proposalFetches).toBeGreaterThan(readsBeforeRejection);
    await expect(rejectionCard).toContainText("rejected");
    await expect(rejectionCard).toContainText("The evidence does not justify this change.");
    await page.reload();
    await expect(page.getByTestId("rick-proposal-card-rejection")).toContainText("rejected");

    await page.getByLabel("Test result reference (submitted by you)").fill("CI://rick-review/server-error-check");
    const failureCard = page.getByTestId("rick-proposal-card-server-error");
    await failureCard.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("alert")).toContainText("Synthetic review service error.");
    await expect(failureCard).toContainText("pending review");
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(state.proposals.find((proposal) => proposal.id === "server-error")?.state).toBe("pending-review");

    const evidenceBounds = await approvalCard.getByRole("region", { name: "Owner approval and implementation evidence" }).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: window.innerWidth };
    });
    expect(evidenceBounds.left).toBeGreaterThanOrEqual(0);
    expect(evidenceBounds.right).toBeLessThanOrEqual(evidenceBounds.width + 1);
    expect(state.ownerCookieMissing).toBe(false);
    expect(state.mutationCookieMissing).toBe(false);

    await approvalCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("rick-proposal-evidence-mobile.png") });

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId("rick-section-dropdown-wrapper")).toBeVisible();
    await expect(page.getByTestId("rick-desktop-tabs")).toBeHidden();
    const tabletHeaderWidth = await page.getByTestId("rick-header-identity").evaluate((element) => element.getBoundingClientRect().width);
    expect(tabletHeaderWidth).toBeGreaterThan(700);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("rick-section-dropdown-wrapper")).toBeHidden();
    await expect(page.getByTestId("rick-desktop-tabs")).toBeVisible();
    const desktopHeaderBounds = await page.getByTestId("rick-desktop-tabs").evaluate((element) => ({
      right: element.getBoundingClientRect().right,
      width: window.innerWidth,
    }));
    expect(desktopHeaderBounds.right).toBeLessThanOrEqual(desktopHeaderBounds.width + 1);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/grand-council");
    await expect(page.getByRole("heading", { name: "Grand Council" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Council vote, owner approval, and Council execution are separate records.");
    const councilBallot = page.getByRole("button", { name: /Synthetic Council ballot/ });
    await councilBallot.click();
    await expect(page.getByText("Council vote record", { exact: true })).toBeVisible();
    await expect(page.getByText("YES 6", { exact: false })).toBeVisible();
    await expect(page.getByText("NO 2", { exact: false })).toBeVisible();
    await expect(page.getByText("Approval recorded by: Father", { exact: false })).toHaveCount(0);
  });
});
