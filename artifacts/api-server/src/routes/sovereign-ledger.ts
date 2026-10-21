import { Router, type IRouter } from "express";
import {
  getLedger,
  getLedgerStats,
  verifyLedger,
  listAgentKeys,
  attestAgentAction,
  appendLedgerEntry,
  type LedgerKind,
} from "../lib/sovereign-ledger";
import { requireAdminSession } from "../lib/sovereign-admin";

const router: IRouter = Router();



router.get("/sovereign-ledger", (req, res) => {
  const kind = req.query.kind as LedgerKind | undefined;
  const limit = req.query.limit ? Math.max(1, Math.min(500, Number(req.query.limit))) : 100;
  const since = req.query.since ? Number(req.query.since) : undefined;
  const entries = getLedger({ kind, limit, since: Number.isFinite(since) ? since : undefined });
  res.json({ ok: true, entries, stats: getLedgerStats() });
});

router.get("/sovereign-ledger/verify", (_req, res) => {
  const v = verifyLedger();
  res.json({ ok: true, verification: v, stats: getLedgerStats() });
});

router.get("/sovereign-ledger/stats", (_req, res) => {
  res.json({ ok: true, ...getLedgerStats() });
});

router.get("/sovereign-ledger/agents", (_req, res) => {
  res.json({ ok: true, agents: listAgentKeys() });
});

router.post("/sovereign-ledger/attest", requireAdminSession, (req, res) => {
  const { agentId, actionKind, data } = req.body ?? {};
  if (!agentId || !actionKind) {
    res.status(400).json({ ok: false, error: "agentId and actionKind required" });
    return;
  }
  const entry = attestAgentAction(String(agentId), String(actionKind), (data ?? {}) as Record<string, unknown>);
  res.json({ ok: true, entry });
});

router.post("/sovereign-ledger/event", requireAdminSession, (req, res) => {
  const { actor, kind, payload } = req.body ?? {};
  const allowedKinds: LedgerKind[] = ["council-meeting", "council-decision", "self-check", "system-event"];
  if (!allowedKinds.includes(kind)) {
    res.status(400).json({ ok: false, error: `kind must be one of: ${allowedKinds.join(", ")}` });
    return;
  }
  const entry = appendLedgerEntry(kind, String(actor || "system"), (payload ?? {}) as Record<string, unknown>);
  res.json({ ok: true, entry });
});

export default router;
