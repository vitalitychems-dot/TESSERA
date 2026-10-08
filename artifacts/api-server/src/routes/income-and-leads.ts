import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireSensitiveRouteToken } from "../lib/sensitive-route-gate";
import { getWalletObservation, refreshWalletObservation } from "../lib/wallet-observer";
import { getExecutableLeads, leadCountsByKind, type LeadKind } from "../lib/lead-execution";
import { getFreeFindings, refreshFreeFindings } from "../lib/free-stuff-scraper";
import {
  getBounties,
  refreshBounties,
  recordAttempt,
  getAttempts,
  type BountyAttempt,
} from "../lib/code-bounties-real";

const router: IRouter = Router();

router.use("/income", requireSensitiveRouteToken);
router.use("/leads", requireSensitiveRouteToken);
router.use("/free-stuff", requireSensitiveRouteToken);
router.use("/code-bounties", requireSensitiveRouteToken);

router.get("/income/wallet", async (_req, res) => {
  try {
    const obs = getWalletObservation();
    if (obs.lastObservedAt === 0) await refreshWalletObservation();
    return res.json({ ok: true, observation: getWalletObservation() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/income/wallet/refresh", async (_req, res) => {
  try {
    const obs = await refreshWalletObservation();
    return res.json({ ok: true, observation: obs });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/income/strategies", (_req, res) => {
  const obs = getWalletObservation();
  const walletReady = obs.configured && !obs.lastError;
  const strategies = [
    {
      id: "wallet-deposits",
      name: "Direct on-chain deposits",
      kind: "passive",
      status: walletReady ? "active" : "needs-config",
      description: "Any SOL sent to the configured sovereign wallet is recorded as confirmed income with the on-chain signature.",
      requirement: walletReady ? null : "Set SOVEREIGN_WALLET_ADDRESS environment variable.",
    },
    {
      id: "affiliate-leads",
      name: "Affiliate-program leads",
      kind: "active",
      status: "available",
      description: "Real affiliate-classified leads are surfaced in the Leads tab with step-by-step execution; payouts must be reconciled against wallet deposits.",
      requirement: null,
    },
    {
      id: "service-leads",
      name: "Service-engagement leads",
      kind: "active",
      status: "available",
      description: "Real freelance/service listings classified from the ingestion pipeline with execution walkthroughs.",
      requirement: null,
    },
    {
      id: "code-bounties",
      name: "Public code bounties",
      kind: "active",
      status: "available",
      description: "Live GitHub issues labelled bounty are listed in the Code Bounties feed; attempts are recorded.",
      requirement: process.env.GITHUB_TOKEN ? null : "Optional: set GITHUB_TOKEN to raise GitHub API rate limit.",
    },
  ];
  return res.json({
    ok: true,
    walletReady,
    confirmedIncome: {
      asset: "SOL",
      totalReceived: obs.totalReceivedSol,
      currentBalance: obs.balanceSol,
    },
    strategies,
  });
});

router.get("/leads/feed", async (req, res) => {
  try {
    const kind = typeof req.query.kind === "string" ? (req.query.kind as LeadKind) : undefined;
    const limit = req.query.limit ? Math.min(200, Math.max(1, parseInt(String(req.query.limit), 10) || 60)) : 60;
    const leads = await getExecutableLeads({ kind, limit });
    const counts = await leadCountsByKind();
    return res.json({ ok: true, leads, counts });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/free-stuff", async (req, res) => {
  try {
    const onlyValid = req.query.onlyValid === "true";
    const limit = req.query.limit ? Math.min(200, Math.max(1, parseInt(String(req.query.limit), 10) || 80)) : 80;
    const data = getFreeFindings({ onlyValid, limit });
    if (data.findings.length === 0 && data.lastRefresh === 0) {
      await refreshFreeFindings();
      const next = getFreeFindings({ onlyValid, limit });
      return res.json({ ok: true, ...next });
    }
    return res.json({ ok: true, ...data });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "free-stuff endpoint failed");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/free-stuff/refresh", async (_req, res) => {
  try {
    await refreshFreeFindings();
    return res.json({ ok: true, ...getFreeFindings() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/code-bounties", async (req, res) => {
  try {
    const withReward = req.query.withReward === "true";
    const limit = req.query.limit ? Math.min(200, Math.max(1, parseInt(String(req.query.limit), 10) || 60)) : 60;
    const data = getBounties({ withReward, limit });
    if (data.bounties.length === 0 && data.lastRefresh === 0) {
      await refreshBounties();
      return res.json({ ok: true, ...getBounties({ withReward, limit }) });
    }
    return res.json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/code-bounties/:id/attempt", (req, res) => {
  const { status, notes } = req.body as { status?: BountyAttempt["status"]; notes?: string };
  const validStatus: BountyAttempt["status"][] = ["investigating", "drafting", "submitted", "merged", "rejected", "abandoned"];
  if (!status || !validStatus.includes(status)) {
    return res.status(400).json({ ok: false, error: `status must be one of ${validStatus.join(",")}` });
  }
  const a = recordAttempt(req.params.id, status, notes ?? "");
  return res.json({ ok: true, attempt: a, attempts: getAttempts(req.params.id) });
});

router.get("/code-bounties/attempts", (req, res) => {
  const bountyId = typeof req.query.bountyId === "string" ? req.query.bountyId : undefined;
  return res.json({ ok: true, attempts: getAttempts(bountyId) });
});

export default router;
