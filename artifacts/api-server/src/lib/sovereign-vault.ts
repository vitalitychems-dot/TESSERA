import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import {
  encryptPayload,
  decryptEnvelope,
  maybeRotate,
  getCurrentEpoch,
  type EncryptedEnvelope,
} from "./sovereign-astro-cipher";
import { logger } from "./logger";
import { NotConfiguredError } from "./not-configured";

interface VaultEntry {
  key: string;
  envelope: EncryptedEnvelope;
  updatedAt: string;
  notes?: string;
}

interface VaultFile {
  version: 1;
  entries: Record<string, VaultEntry>;
  lastRewrapEpoch?: string;
  lastRewrapAt?: string;
}

const VAULT_PATH =
  process.env.SOVEREIGN_VAULT_PATH ?? join(process.cwd(), "_evolutions", "sovereign-vault.json");

let _state: VaultFile = { version: 1, entries: {} };
let _loaded = false;

function ensureLoaded(): void {
  if (_loaded) return;
  try {
    if (existsSync(VAULT_PATH)) {
      const raw = readFileSync(VAULT_PATH, "utf8");
      const parsed = JSON.parse(raw) as VaultFile;
      if (parsed?.version === 1 && parsed.entries) _state = parsed;
    }
  } catch {
    logger.warn("SovereignVault: failed to load");
  }
  _loaded = true;
}

function persist(): void {
  const dir = dirname(VAULT_PATH);
  const tmp = join(dir, `.vault-${randomBytes(8).toString("hex")}.tmp`);
  let fd: number | undefined;
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    fd = openSync(
      tmp,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    writeFileSync(fd, JSON.stringify(_state, null, 2), "utf8");
    fchmodSync(fd, 0o600);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, VAULT_PATH);
  } catch {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // The descriptor is already closed.
      }
    }
    try {
      unlinkSync(tmp);
    } catch {
      // The temp file was not created.
    }
    throw new NotConfiguredError("vault-unavailable");
  }
}

export function vaultPut(key: string, plaintext: string, notes?: string): VaultEntry {
  ensureLoaded();
  if (!key || typeof key !== "string") throw new Error("vaultPut: key required");
  const envelope = encryptPayload(plaintext, `vault:${key}`);
  const entry: VaultEntry = { key, envelope, updatedAt: new Date().toISOString(), notes };
  const previous = _state.entries[key];
  _state.entries[key] = entry;
  try {
    persist();
  } catch (err) {
    if (previous) _state.entries[key] = previous;
    else delete _state.entries[key];
    throw err;
  }
  return entry;
}

export function vaultGet(key: string): { key: string; plaintext: string; envelope: EncryptedEnvelope; updatedAt: string } | null {
  ensureLoaded();
  const entry = _state.entries[key];
  if (!entry) return null;
  const beforeCt = entry.envelope.ct;
  const buf = decryptEnvelope(entry.envelope, `vault:${key}`);
  if (entry.envelope.ct !== beforeCt) {
    entry.updatedAt = new Date().toISOString();
    try {
      persist();
    } catch {
      logger.warn("SovereignVault: rewrap persist failed");
    }
  }
  return { key, plaintext: buf.toString("utf8"), envelope: entry.envelope, updatedAt: entry.updatedAt };
}

export function vaultDelete(key: string): boolean {
  ensureLoaded();
  const previous = _state.entries[key];
  if (!previous) return false;
  delete _state.entries[key];
  try {
    persist();
  } catch (err) {
    _state.entries[key] = previous;
    throw err;
  }
  return true;
}

export function vaultList(): Array<{ key: string; epochId: string; updatedAt: string; notes?: string }> {
  ensureLoaded();
  return Object.values(_state.entries).map((e) => ({
    key: e.key,
    epochId: e.envelope.epochId,
    updatedAt: e.updatedAt,
    notes: e.notes,
  }));
}

export interface RewrapResult {
  rewrapped: number;
  failed: number;
  failedKeys: string[];
  fromEpochSpread: number;
  toEpochId: string;
  rotatedJustNow: boolean;
}

export function rewrapAll(): RewrapResult {
  ensureLoaded();
  const rotation = maybeRotate();
  const targetEpoch = getCurrentEpoch();
  let rewrapped = 0;
  let failed = 0;
  const failedKeys: string[] = [];
  const seenFromEpochs = new Set<string>();
  for (const entry of Object.values(_state.entries)) {
    if (entry.envelope.epochId === targetEpoch.epochId) continue;
    seenFromEpochs.add(entry.envelope.epochId);
    try {
      const decrypted = decryptEnvelope(entry.envelope, `vault:${entry.key}`);
      const fresh = encryptPayload(decrypted, `vault:${entry.key}`);
      entry.envelope = fresh;
      entry.updatedAt = new Date().toISOString();
      rewrapped++;
    } catch (err) {
      failed++;
      failedKeys.push(entry.key);
      logger.warn(
        { key: entry.key, epochId: entry.envelope.epochId, err: (err as Error).message },
        "SovereignVault: rewrap failed for entry — keeping prior envelope",
      );
    }
  }
  _state.lastRewrapEpoch = targetEpoch.epochId;
  _state.lastRewrapAt = new Date().toISOString();
  if (rewrapped > 0 || failed > 0) persist();
  return {
    rewrapped,
    failed,
    failedKeys,
    fromEpochSpread: seenFromEpochs.size,
    toEpochId: targetEpoch.epochId,
    rotatedJustNow: rotation.rotated,
  };
}

export function vaultStatus() {
  ensureLoaded();
  const epoch = getCurrentEpoch();
  const entries = Object.values(_state.entries);
  const epochCounts: Record<string, number> = {};
  for (const e of entries) {
    epochCounts[e.envelope.epochId] = (epochCounts[e.envelope.epochId] ?? 0) + 1;
  }
  return {
    path: VAULT_PATH,
    totalEntries: entries.length,
    currentEpochId: epoch.epochId,
    entriesPerEpoch: epochCounts,
    lastRewrapEpoch: _state.lastRewrapEpoch ?? null,
    lastRewrapAt: _state.lastRewrapAt ?? null,
  };
}
