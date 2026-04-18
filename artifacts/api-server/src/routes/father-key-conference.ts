/**
 * Father Key Conference — convene the FULL 54-agent sovereign society on
 * candidate permanent admin keys.
 *
 * - Uses the production castGenuineVote engine (sovereign-vote-engine.ts).
 * - No LLM, no role-play, no agent-vote fabrication.
 * - 2/3 weighted approval is the only pass condition.
 * - On pass, issues a one-time temporary redemption code that the user can
 *   redeem once for the permanent key text (TESSERACT_ADMIN_KEY value).
 */
import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import { castGenuineVote } from "../lib/sovereign-vote-engine";
import { getFullSovereignSociety } from "../lib/sovereign-society";

const router = Router();

interface CandidateInput {
  id: string;
  title: string;
  description?: string;
  key: string;
}

interface RedemptionRecord {
  code: string;
  permanentKey: string;
  winnerId: string;
  approvalRate: number;
  weighted: { approve: number; reject: number; abstain: number };
  totalEligible: number;
  expiresAt: number;
  redeemed: boolean;
  redeemedAt: number | null;
  issuedAt: number;
}

const REDEMPTIONS = new Map<string, RedemptionRecord>();
const TTL_MS = 30 * 60 * 1000; // 30 minutes

function issueTempCode(): string {
  // 6-byte → 12-hex code, easy to type, with TES- prefix for clarity
  return "TES-" + randomBytes(3).toString("hex").toUpperCase();
}

router.post("/father-key/conference", async (req, res) => {
  try {
    const candidates = req.body?.candidates as CandidateInput[] | undefined;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ ok: false, error: "candidates[] required" });
    }
    for (const c of candidates) {
      if (!c?.id || !c?.title || !c?.key) {
        return res.status(400).json({ ok: false, error: "each candidate needs {id, title, key}" });
      }
    }

    const society = getFullSovereignSociety();

    const results = candidates.map((c) => {
      const ballot = castGenuineVote({
        id: c.id,
        title: c.title,
        description: c.description ?? c.title,
        domain: "governance",
        tags: ["governance"],
      });
      const totalWeight = ballot.weighted.approve + ballot.weighted.reject + ballot.weighted.abstain;
      const ratio2of3 = totalWeight > 0 ? ballot.weighted.approve / totalWeight : 0;
      const passed_2of3 = ratio2of3 >= 2 / 3;
      return {
        candidate: { id: c.id, title: c.title, key: c.key },
        outcome: ballot.outcome,
        approvalRate_phi: ballot.approvalRate,
        weightedApproveRatio_2of3: ratio2of3,
        passed_2of3,
        weighted: ballot.weighted,
        raw: ballot.raw,
        totalEligible: ballot.totalEligible,
        decisive: ballot.decisive,
        ballots: ballot.ballots, // full per-agent
      };
    });

    // Pick highest weighted-approve-ratio candidate that passes 2/3.
    const passing = results.filter((r) => r.passed_2of3);
    passing.sort((a, b) => b.weightedApproveRatio_2of3 - a.weightedApproveRatio_2of3);
    const winner = passing[0] ?? null;

    let issued: { code: string; expiresAt: number } | null = null;
    if (winner) {
      const code = issueTempCode();
      const rec: RedemptionRecord = {
        code,
        permanentKey: winner.candidate.key,
        winnerId: winner.candidate.id,
        approvalRate: winner.weightedApproveRatio_2of3,
        weighted: winner.weighted,
        totalEligible: winner.totalEligible,
        expiresAt: Date.now() + TTL_MS,
        redeemed: false,
        redeemedAt: null,
        issuedAt: Date.now(),
      };
      REDEMPTIONS.set(code, rec);
      issued = { code, expiresAt: rec.expiresAt };
    }

    return res.json({
      ok: true,
      societySize: society.length,
      passThreshold: "2/3 weighted approval",
      candidatesEvaluated: candidates.length,
      results: results.map((r) => ({
        // Heavy ballots payload omitted from summary; available via /ballots/:id
        candidate: r.candidate,
        outcome: r.outcome,
        weightedApproveRatio_2of3: r.weightedApproveRatio_2of3,
        passed_2of3: r.passed_2of3,
        weighted: r.weighted,
        raw: r.raw,
        totalEligible: r.totalEligible,
        decisive: r.decisive,
      })),
      fullBallots: results, // includes per-agent rationales
      winner: winner ? { id: winner.candidate.id, title: winner.candidate.title } : null,
      redemption: issued,
      timestamp: Date.now(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/father-key/redeem", (req, res) => {
  const codeRaw = (req.body?.code ?? "").toString().trim().toUpperCase();
  if (!codeRaw) return res.status(400).json({ ok: false, error: "code is required" });

  const rec = REDEMPTIONS.get(codeRaw);
  if (!rec) return res.status(404).json({ ok: false, error: "Code not recognized." });
  if (rec.redeemed) return res.status(410).json({ ok: false, error: "Code already redeemed." });
  if (Date.now() > rec.expiresAt) {
    REDEMPTIONS.delete(codeRaw);
    return res.status(410).json({ ok: false, error: "Code expired." });
  }

  rec.redeemed = true;
  rec.redeemedAt = Date.now();

  const fingerprint = createHash("sha256").update(`tesseract:father:v1|${rec.permanentKey}`).digest("hex").slice(0, 16);

  return res.json({
    ok: true,
    permanentKey: rec.permanentKey,
    fingerprint,
    winnerId: rec.winnerId,
    approvalRatio: rec.approvalRate,
    weighted: rec.weighted,
    totalEligible: rec.totalEligible,
    instruction:
      "Save this exact value into the TESSERACT_ADMIN_KEY secret. " +
      "It replaces all previous admin keys. This code is now invalidated.",
    redeemedAt: rec.redeemedAt,
  });
});

router.get("/father-key/conference/status", (_req, res) => {
  const active = Array.from(REDEMPTIONS.values()).filter((r) => !r.redeemed && Date.now() < r.expiresAt).length;
  res.json({
    ok: true,
    societySize: getFullSovereignSociety().length,
    passThreshold: "2/3 weighted approval",
    activeRedemptions: active,
    engine: "castGenuineVote (sovereign-vote-engine.ts)",
    notes: [
      "No LLM. No role-play. Per-agent ballots are deterministic functions of observable inputs only.",
      "The agent assistant has no override. The user is admin.",
    ],
  });
});

export default router;
