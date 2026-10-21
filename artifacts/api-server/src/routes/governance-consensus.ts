import { Router, type Request, type Response } from "express";
import { requireAdminSession } from "../lib/sovereign-admin";
import { createProposal, getAllProposals, getProposal, getConsensusMetrics, GRAND_COUNCIL_AGENTS, drainRetryQueue } from "../lib/consensus-engine";
import { getExecutorMetrics, getSystemConfig, updateSystemConfig } from "../lib/council-executor";

const router = Router();

const INVALID_CONFIG = { ok: false, error: "invalid config" } as const;

router.post("/consensus/drain-queue", requireAdminSession, async (_req: Request, res: Response) => {
  try {
    const result = await drainRetryQueue(100);
    res.json({ ok: true, data: result });
  } catch {
    res.status(500).json({ ok: false, error: "drain failed" });
  }
});

router.get("/consensus/metrics", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: getConsensusMetrics() });
});

router.get("/consensus/proposals", requireAdminSession, (_req: Request, res: Response) => {
  const proposals = getAllProposals();
  res.json({ ok: true, data: proposals, count: proposals.length });
});

router.get("/consensus/proposals/:id", requireAdminSession, (req: Request, res: Response) => {
  const proposal = getProposal(String(req.params.id));
  if (!proposal) { res.status(404).json({ ok: false, error: "Proposal not found" }); return; }
  res.json({ ok: true, data: proposal });
});

router.post("/consensus/propose", requireAdminSession, async (req: Request, res: Response) => {
  const { title, description, proposedBy = "Tessera", category = "feature" } = req.body;
  if (!title || !description) {
    res.status(400).json({ ok: false, error: "title and description are required" });
    return;
  }
  const proposal = await createProposal({ title, description, proposedBy, category });
  res.json({ ok: true, data: proposal });
});

router.get("/consensus/agents", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: GRAND_COUNCIL_AGENTS, count: GRAND_COUNCIL_AGENTS.length });
});

router.get("/council-executor/metrics", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: getExecutorMetrics() });
});

router.get("/council-executor/config", requireAdminSession, (_req: Request, res: Response) => {
  res.json({ ok: true, data: getSystemConfig() });
});

router.patch("/council-executor/config", requireAdminSession, (req: Request, res: Response) => {
  try {
    const body: unknown = req.body;
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json(INVALID_CONFIG);
      return;
    }
    if (!Object.hasOwn(body, "key") || !Object.hasOwn(body, "value")) {
      res.status(400).json(INVALID_CONFIG);
      return;
    }
    const key = (body as { key: unknown }).key;
    const value = (body as { value: unknown }).value;
    if (typeof key !== "string" || !updateSystemConfig(key, value)) {
      res.status(400).json(INVALID_CONFIG);
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(400).json(INVALID_CONFIG);
  }
});

export default router;
