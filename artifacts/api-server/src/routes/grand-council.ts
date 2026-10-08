import { Router, type Request, type Response } from "express";
import {
  convene,
  getSession,
  listSessions,
  memberRoster,
  COUNCIL_PROPOSALS,
  subscribe,
} from "../lib/grand-council-deliberation";
import {
  parallelEval,
  alphabetSnapshot,
} from "../lib/multi-state-symbolic-processor";
import {
  vgpuInfo,
  vgpuSubmit,
  vgpuFramePng,
} from "../lib/vgpu";
import { runGlyphProgram } from "../lib/vgpu-glyph-bus";
import { sovereignConstantsSnapshot } from "../lib/sovereign-constants";
import { listLattices } from "../lib/omniversal-quantum-lattice";
import { withoutSigilFingerprint } from "./sovereign-doctrine";
import { publicWriteRateLimit } from "../lib/father-verify-throttle";
import { decideOwnerSession, resolveFatherAuthorization } from "../lib/sovereign-admin";

const router = Router();

function dropCipherEnvelope(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropCipherEnvelope);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (key.toLowerCase() === "cipher" && child && typeof child === "object" && !Array.isArray(child)) {
      const cipher: Record<string, unknown> = {};
      for (const [cipherKey, cipherChild] of Object.entries(child as Record<string, unknown>)) {
        if (cipherKey.toLowerCase() === "envelope") continue;
        cipher[cipherKey] = dropCipherEnvelope(cipherChild);
      }
      out[key] = cipher;
      continue;
    }
    out[key] = dropCipherEnvelope(child);
  }
  return out;
}

/** Anonymous council reads omit cipher.envelope. Owner reads keep it, still without surfacePreview. */
function presentCouncilRead(req: Request, payload: unknown): unknown {
  const stripped = withoutSigilFingerprint(payload);
  if (decideOwnerSession(req).ok) return stripped;
  return dropCipherEnvelope(stripped);
}

// === Sovereign constants & roster (P-F) ===
router.get("/grand-council/constants", (_req, res) => {
  res.json({ ok: true, constants: sovereignConstantsSnapshot() });
});

router.get("/grand-council/roster", (_req, res) => {
  res.json({ ok: true, members: memberRoster() });
});

router.get("/grand-council/proposals", (_req, res) => {
  res.json({ ok: true, proposals: COUNCIL_PROPOSALS });
});

// === Council deliberation ===
router.post("/grand-council/convene", publicWriteRateLimit, async (req: Request, res: Response) => {
  const auth = resolveFatherAuthorization(req);
  let fatherAuthorized = false;
  if (auth.fatherAuthorized) {
    fatherAuthorized = true;
  } else {
    switch (auth.reason) {
      case "absent":
        break;
      case "rejected":
      case "unconfigured":
        res.status(401).json({ ok: false, error: "father-auth-required" });
        return;
      default: {
        const unreachable: never = auth.reason;
        res.status(401).json({ ok: false, error: "father-auth-required" });
        void unreachable;
        return;
      }
    }
  }
  try {
    const seed = req.body?.seed ? String(req.body.seed) : undefined;
    const latticeDigests = listLattices().map((l) => l.cosmicAnchor).slice(0, 8);
    const session = await convene({ seed, latticeDigests });
    res.json(presentCouncilRead(req, { ok: true, fatherAuthorized, session }));
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.get("/grand-council/sessions", async (req, res) => {
  res.json(presentCouncilRead(req, { ok: true, sessions: await listSessions() }));
});

router.get("/grand-council/sessions/:id", async (req, res) => {
  const s = await getSession(String(req.params.id));
  if (!s) { res.status(404).json({ ok: false, error: "session not found" }); return; }
  res.json(presentCouncilRead(req, { ok: true, session: s }));
});

// SSE stream (P-J)
router.get("/grand-council/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
  const unsub = subscribe((event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(presentCouncilRead(req, payload))}\n\n`);
  });
  const ka = setInterval(() => res.write(`: keepalive ${Date.now()}\n\n`), 15000);
  req.on("close", () => { unsub(); clearInterval(ka); });
});

// === MSSP ===
router.get("/mssp/alphabet", (_req, res) => {
  res.json({ ok: true, ...alphabetSnapshot() });
});

router.post("/mssp/eval", (req, res) => {
  try {
    const expression = String(req.body?.expression ?? "").trim();
    if (!expression) { res.status(400).json({ ok: false, error: "expression required" }); return; }
    const seed = req.body?.seed ? String(req.body.seed) : "father";
    const result = parallelEval(expression, seed);
    res.json({ ok: true, result });
  } catch (e: unknown) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// === vGPU ===
router.get("/vgpu/info", (_req, res) => {
  res.json({ ok: true, info: vgpuInfo() });
});

router.post("/vgpu/cmd", (req, res) => {
  try {
    const body = req.body ?? {};
    if (typeof body.program === "string") {
      const r = runGlyphProgram(body.program);
      res.json({ ok: true, mode: "glyph-program", queued: r.queued, compiled: r.compiled });
      return;
    }
    if (Array.isArray(body.commands)) {
      const r = vgpuSubmit(body.commands);
      res.json({ ok: true, mode: "commands", ...r });
      return;
    }
    if (body.command) {
      const r = vgpuSubmit(body.command);
      res.json({ ok: true, mode: "command", ...r });
      return;
    }
    res.status(400).json({ ok: false, error: "expected { program } | { commands } | { command }" });
  } catch (e: unknown) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.get("/vgpu/frame.png", (_req, res) => {
  const png = vgpuFramePng();
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "no-store");
  res.send(png);
});

export default router;
