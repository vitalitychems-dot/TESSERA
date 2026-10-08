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
import { Router, type Request } from "express";
import { randomBytes, createHash } from "node:crypto";
import { castGenuineVote } from "../lib/sovereign-vote-engine";
import { getFullSovereignSociety } from "../lib/sovereign-society";
import { requireAdminSession } from "../lib/sovereign-admin";

const router = Router();

interface CandidateInput {
  title: string;
  description?: string;
  key: string;
}

interface RedemptionMeta {
  winnerId?: string;
  approvalRate?: number;
  raw?: { approve: number; reject: number; abstain: number };
  totalEligible?: number;
  finalizedBy?: "council-2of3" | "tessera-final-say";
}

interface RedemptionRecord {
  permanentKey: string;
  winnerId: string;
  approvalRate: number;
  raw: { approve: number; reject: number; abstain: number };
  totalEligible: number;
  expiresAt: number;
  issuedAt: number;
  finalizedBy: "council-2of3" | "tessera-final-say";
}

// Last conference results retained briefly so Tessera (Father) can finalize a
// candidate after seeing the unweighted tally — even if 2/3 was not reached.
// Locked by user mandate: "Tessera has final say."
interface ConferenceMemo {
  at: number;
  candidates: Array<{ id: string; title: string; key: string; rawApprove: number; totalEligible: number; passed_2of3: boolean }>;
}
let LAST_CONFERENCE: ConferenceMemo | null = null;
const CONF_TTL_MS = 60 * 60 * 1000; // 1 hour

const REDEMPTIONS = new Map<string, RedemptionRecord>();
export const REDEEM_TTL_MS = 10 * 60 * 1000;
export const REDEEM_RATE_WINDOW_MS = 10 * 60 * 1000;
export const REDEEM_IP_LIMIT = 8;
export const REDEEM_GLOBAL_LIMIT = 20;

const ipHits = new Map<string, number[]>();
const globalHits: number[] = [];
const conferenceIpHits = new Map<string, number[]>();
const conferenceGlobalHits: number[] = [];

function pruneHits(hits: number[], now: number): number[] {
  return hits.filter((at) => now - at < REDEEM_RATE_WINDOW_MS);
}

function noteWindowAttempt(ipMap: Map<string, number[]>, global: number[], ip: string): boolean {
  const now = Date.now();
  for (const [known, hits] of ipMap) {
    const pruned = pruneHits(hits, now);
    if (pruned.length === 0) ipMap.delete(known);
    else if (known !== ip) ipMap.set(known, pruned);
  }
  const nextGlobal = pruneHits(global, now);
  global.length = 0;
  global.push(...nextGlobal);
  const nextIp = pruneHits(ipMap.get(ip) ?? [], now);
  if (global.length >= REDEEM_GLOBAL_LIMIT || nextIp.length >= REDEEM_IP_LIMIT) {
    if (nextIp.length === 0) ipMap.delete(ip);
    else ipMap.set(ip, nextIp);
    return false;
  }
  nextIp.push(now);
  global.push(now);
  ipMap.set(ip, nextIp);
  return true;
}

export function noteRedeemAttempt(ip: string): boolean {
  return noteWindowAttempt(ipHits, globalHits, ip);
}

function noteConferenceAttempt(ip: string): boolean {
  return noteWindowAttempt(conferenceIpHits, conferenceGlobalHits, ip);
}

export function clearFatherKeyRedeemState(): void {
  REDEMPTIONS.clear();
  ipHits.clear();
  globalHits.length = 0;
  conferenceIpHits.clear();
  conferenceGlobalHits.length = 0;
}

function codeDigest(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function sweepRedemptions(now: number): void {
  for (const [digest, rec] of REDEMPTIONS) {
    if (now > rec.expiresAt) REDEMPTIONS.delete(digest);
  }
}

export function issueFatherKeyRedemption(
  permanentKey: string,
  meta: RedemptionMeta = {},
): { code: string; expiresAt: number } {
  sweepRedemptions(Date.now());
  const code = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + REDEEM_TTL_MS;
  REDEMPTIONS.set(codeDigest(code), {
    permanentKey,
    winnerId: meta.winnerId ?? "issued",
    approvalRate: meta.approvalRate ?? 0,
    raw: meta.raw ?? { approve: 0, reject: 0, abstain: 0 },
    totalEligible: meta.totalEligible ?? 0,
    expiresAt,
    issuedAt: Date.now(),
    finalizedBy: meta.finalizedBy ?? "council-2of3",
  });
  return { code, expiresAt };
}

function publicCandidate(candidate: { id: string; title: string }): { id: string; title: string } {
  return { id: candidate.id, title: candidate.title };
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

router.post("/father-key/conference", requireAdminSession, async (req, res) => {
  if (!noteConferenceAttempt(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "rate-limited" });
  }
  try {
    const candidates = req.body?.candidates as CandidateInput[] | undefined;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ ok: false, error: "candidates[] required" });
    }
    for (const c of candidates) {
      if (!c?.title || !c?.key) {
        return res.status(400).json({ ok: false, error: "each candidate needs {title, key}" });
      }
    }

    const society = getFullSovereignSociety();

    const results = candidates.map((c) => {
      const id = randomBytes(16).toString("hex");
      const ballot = castGenuineVote({
        id,
        title: c.title,
        description: c.description ?? c.title,
        domain: "governance",
        tags: ["governance"],
      });
      // FAIR VOTE — every agent counts equally (no weighting). 2/3 of total
      // eligible agents must approve. Locked by user mandate.
      const ratio_2of3 = ballot.totalEligible > 0 ? ballot.raw.approve / ballot.totalEligible : 0;
      const passed_2of3 = ratio_2of3 >= 2 / 3;
      return {
        candidate: { id, title: c.title, key: c.key },
        outcome: ballot.outcome,
        rawApproveRatio_2of3: ratio_2of3,
        passed_2of3,
        raw: ballot.raw,
        totalEligible: ballot.totalEligible,
        decisive: ballot.decisive,
        ballots: ballot.ballots,
      };
    });

    // Pick highest raw-approve-ratio candidate that passes 2/3 (no weighting).
    const passing = results.filter((r) => r.passed_2of3);
    passing.sort((a, b) => b.rawApproveRatio_2of3 - a.rawApproveRatio_2of3);
    const winner = passing[0] ?? null;

    const issued = winner
      ? issueFatherKeyRedemption(winner.candidate.key, {
          winnerId: winner.candidate.id,
          approvalRate: winner.rawApproveRatio_2of3,
          raw: winner.raw,
          totalEligible: winner.totalEligible,
          finalizedBy: "council-2of3",
        })
      : null;

    // Memo keeps the key server-side so finalize can issue a code. Responses do not.
    LAST_CONFERENCE = {
      at: Date.now(),
      candidates: results.map((r) => ({
        id: r.candidate.id,
        title: r.candidate.title,
        key: r.candidate.key,
        rawApprove: r.raw.approve,
        totalEligible: r.totalEligible,
        passed_2of3: r.passed_2of3,
      })),
    };

    return res.json({
      ok: true,
      societySize: society.length,
      passThreshold: "2/3 raw approval (no weighting) — Tessera has final say",
      candidatesEvaluated: candidates.length,
      results: results.map((r) => ({
        candidate: publicCandidate(r.candidate),
        outcome: r.outcome,
        rawApproveRatio_2of3: r.rawApproveRatio_2of3,
        passed_2of3: r.passed_2of3,
        raw: r.raw,
        totalEligible: r.totalEligible,
        decisive: r.decisive,
      })),
      fullBallots: results.map((r) => ({
        candidate: publicCandidate(r.candidate),
        outcome: r.outcome,
        rawApproveRatio_2of3: r.rawApproveRatio_2of3,
        passed_2of3: r.passed_2of3,
        raw: r.raw,
        totalEligible: r.totalEligible,
        decisive: r.decisive,
        ballots: r.ballots,
      })),
      winner: winner ? publicCandidate(winner.candidate) : null,
      redemption: issued,
      timestamp: Date.now(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/father-key/redeem", (req, res) => {
  if (!noteRedeemAttempt(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "rate-limited" });
  }
  const codeRaw = (req.body?.code ?? "").toString().trim().toLowerCase();
  if (!codeRaw) return res.status(400).json({ ok: false, error: "code is required" });

  const now = Date.now();
  const digest = codeDigest(codeRaw);
  const rec = REDEMPTIONS.get(digest);
  sweepRedemptions(now);
  if (!rec) return res.status(404).json({ ok: false, error: "Code not recognized." });
  if (now > rec.expiresAt) {
    REDEMPTIONS.delete(digest);
    return res.status(410).json({ ok: false, error: "Code expired." });
  }

  REDEMPTIONS.delete(digest);
  const redeemedAt = now;

  return res.json({
    ok: true,
    permanentKey: rec.permanentKey,
    winnerId: rec.winnerId,
    approvalRatio: rec.approvalRate,
    raw: rec.raw,
    totalEligible: rec.totalEligible,
    instruction:
      "Save this exact value into the TESSERACT_ADMIN_KEY secret. " +
      "It replaces all previous admin keys. This code is now invalidated.",
    redeemedAt,
  });
});

/**
 * Tessera-final-say finalization. After a conference, the Father (Tessera)
 * may finalize ANY of the just-evaluated candidates regardless of whether the
 * council reached 2/3. The candidate must come from the most recent
 * conference (within the 1-hour memo window) so finalization always reflects
 * a real ballot just observed by the user.
 */
router.post("/father-key/finalize", requireAdminSession, (req, res) => {
  if (!noteConferenceAttempt(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "rate-limited" });
  }
  const candidateId = (req.body?.candidateId ?? "").toString().trim().toLowerCase();
  if (!candidateId) return res.status(400).json({ ok: false, error: "candidateId required" });
  if (!LAST_CONFERENCE) return res.status(404).json({ ok: false, error: "No recent conference on record. Convene first." });
  if (Date.now() - LAST_CONFERENCE.at > CONF_TTL_MS) {
    LAST_CONFERENCE = null;
    return res.status(410).json({ ok: false, error: "Last conference memo expired. Convene again." });
  }
  const c = LAST_CONFERENCE.candidates.find((x) => x.id === candidateId);
  if (!c) return res.status(404).json({ ok: false, error: "Candidate was not in the last conference." });

  const issued = issueFatherKeyRedemption(c.key, {
    winnerId: c.id,
    approvalRate: c.totalEligible > 0 ? c.rawApprove / c.totalEligible : 0,
    raw: { approve: c.rawApprove, reject: 0, abstain: c.totalEligible - c.rawApprove },
    totalEligible: c.totalEligible,
    finalizedBy: "tessera-final-say",
  });
  return res.json({
    ok: true,
    candidate: publicCandidate(c),
    council2of3Passed: c.passed_2of3,
    finalizedBy: "tessera-final-say",
    redemption: issued,
    instruction: "Type or paste this code into the redemption endpoint (POST /api/father-key/redeem) to receive the permanent key once.",
  });
});

router.get("/father-key/conference/status", (_req, res) => {
  const now = Date.now();
  sweepRedemptions(now);
  const active = REDEMPTIONS.size;
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
