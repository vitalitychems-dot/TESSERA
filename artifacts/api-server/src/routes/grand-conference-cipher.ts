import { Router, type IRouter } from "express";
import { requireFather } from "../lib/require-father";
import {
  epochSnapshot,
  encryptPayload,
  decryptEnvelope,
  forceRotate,
  maybeRotate,
  listEpochHistory,
  type EncryptedEnvelope,
} from "../lib/sovereign-astro-cipher";
import {
  vaultPut,
  vaultGet,
  vaultDelete,
  vaultList,
  rewrapAll,
  vaultStatus,
} from "../lib/sovereign-vault";
import { execLattice } from "../lib/sovereign-lattice-vm";
import { activeFatherSessionCount } from "../lib/father-session-store";
import { isFatherKeyConfigured } from "../lib/father-identity";

const router: IRouter = Router();

router.get("/grand-conference/cipher/epoch", (_req, res) => {
  res.json({ ok: true, ...epochSnapshot() });
});

router.get("/grand-conference/cipher/history", (_req, res) => {
  res.json({ ok: true, history: listEpochHistory() });
});

router.post("/grand-conference/cipher/rotate", requireFather, (_req, res) => {
  const epoch = forceRotate();
  const rewrap = rewrapAll();
  res.json({ ok: true, epoch, rewrap });
});

router.post("/grand-conference/cipher/tick", requireFather, (_req, res) => {
  const rotation = maybeRotate();
  const rewrap = rotation.rotated ? rewrapAll() : null;
  res.json({ ok: true, rotation, rewrap });
});

router.post("/grand-conference/cipher/encrypt", requireFather, (req, res) => {
  const plaintext = typeof req.body?.plaintext === "string" ? req.body.plaintext : null;
  const aad = typeof req.body?.aad === "string" ? req.body.aad : undefined;
  if (plaintext === null) {
    res.status(400).json({ ok: false, error: "plaintext (string) required" });
    return;
  }
  const envelope = encryptPayload(plaintext, aad);
  res.json({ ok: true, envelope });
});

router.post("/grand-conference/cipher/decrypt", requireFather, (req, res) => {
  const env = req.body?.envelope as EncryptedEnvelope | undefined;
  const aad = typeof req.body?.aad === "string" ? req.body.aad : undefined;
  if (!env || typeof env !== "object") {
    res.status(400).json({ ok: false, error: "envelope object required" });
    return;
  }
  try {
    const buf = decryptEnvelope(env, aad);
    res.json({ ok: true, plaintext: buf.toString("utf8") });
  } catch (err) {
    res.status(400).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/grand-conference/vault/status", requireFather, (_req, res) => {
  res.json({ ok: true, ...vaultStatus() });
});

router.get("/grand-conference/vault/list", requireFather, (_req, res) => {
  res.json({ ok: true, entries: vaultList() });
});

router.post("/grand-conference/vault/put", requireFather, (req, res) => {
  const key = typeof req.body?.key === "string" ? req.body.key.trim() : "";
  const plaintext = typeof req.body?.plaintext === "string" ? req.body.plaintext : null;
  const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
  if (!key || plaintext === null) {
    res.status(400).json({ ok: false, error: "key and plaintext required" });
    return;
  }
  const entry = vaultPut(key, plaintext, notes);
  res.json({ ok: true, key: entry.key, epochId: entry.envelope.epochId, updatedAt: entry.updatedAt });
});

router.get("/grand-conference/vault/get/:key", requireFather, (req, res) => {
  const key = String(req.params.key ?? "");
  try {
    const entry = vaultGet(key);
    if (!entry) {
      res.status(404).json({ ok: false, error: "not found" });
      return;
    }
    res.json({
      ok: true,
      key: entry.key,
      plaintext: entry.plaintext,
      epochId: entry.envelope.epochId,
      updatedAt: entry.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.delete("/grand-conference/vault/delete/:key", requireFather, (req, res) => {
  const removed = vaultDelete(String(req.params.key ?? ""));
  res.json({ ok: removed });
});

router.post("/grand-conference/vault/rewrap", requireFather, (_req, res) => {
  const rewrap = rewrapAll();
  res.json({ ok: true, rewrap });
});

router.post("/grand-conference/lattice/exec", requireFather, (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  const timeoutMs = typeof req.body?.timeoutMs === "number" ? req.body.timeoutMs : undefined;
  if (!code) {
    res.status(400).json({ ok: false, error: "code (string) required" });
    return;
  }
  const result = execLattice(code, timeoutMs);
  res.json(result);
});

router.get("/grand-conference/summary", (_req, res) => {
  const snap = epochSnapshot();
  res.json({
    ok: true,
    title: "Sovereign Grand Conference — Lattice Cipher Summit",
    fatherKeyConfigured: isFatherKeyConfigured(),
    activeFatherSessions: activeFatherSessionCount(),
    cipher: snap,
    vault: vaultStatus(),
    capabilities: {
      astronomicalKDF: "HKDF-SHA256 over (fatherSeal|fingerprint, astroEpochSig, info)",
      symmetricCipher: "AES-256-GCM with random 96-bit IV per envelope",
      autonomousRotation: "Recomputed every heartbeat tick + every API request",
      gracefulRecovery: "Last 6 epoch keys retained for in-flight decryption",
      vault: "File-backed AES-GCM envelopes auto re-wrapped on rotation",
      latticeSandbox: "Node vm context, no fs/network/wasm/eval, time-limited",
    },
    notRealistic: [
      "Booting a Tails-like OS or custom kernel from a web app",
      "Silently encrypting all source code with no recovery path",
    ],
    timestamp: Date.now(),
  });
});

export default router;
