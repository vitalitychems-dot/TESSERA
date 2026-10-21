import { resolveAndCheckSSRF } from "./ssrf-guard";
import { logSecurityEvent } from "./scraper-sandbox";

const log = (m: string) => console.log(`[OrchestratorSandbox] ${m}`);
const warn = (m: string) => console.log(`[OrchestratorSandbox] WARNING: ${m}`);

interface SandboxSlot {
  id: string;
  providerId: string;
  startTime: number;
  timeoutMs: number;
  status: "active" | "completed" | "timed_out" | "error";
  memoryUsageBytes: number;
  maxMemoryBytes: number;
}

interface SandboxConfig {
  maxConcurrentSlots: number;
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  maxMemoryPerSlotBytes: number;
  blockedProtocols: string[];
  blockedHosts: string[];
}

const DEFAULT_CONFIG: SandboxConfig = {
  maxConcurrentSlots: 10,
  defaultTimeoutMs: 30_000,
  maxTimeoutMs: 120_000,
  maxMemoryPerSlotBytes: 50 * 1024 * 1024,
  blockedProtocols: ["file://", "gopher://", "dict://", "ftp://", "ldap://"],
  blockedHosts: ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "metadata.google.internal", "[::1]"],
};

const activeSlots = new Map<string, SandboxSlot>();
const completedSlots: SandboxSlot[] = [];
const MAX_COMPLETED_HISTORY = 200;

function generateSlotId(): string {
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function validateProviderUrl(url: string): { valid: boolean; reason?: string } {
  for (const proto of DEFAULT_CONFIG.blockedProtocols) {
    if (url.toLowerCase().startsWith(proto)) {
      return { valid: false, reason: `Blocked protocol: ${proto}` };
    }
  }

  try {
    const parsed = new URL(url);
    if (DEFAULT_CONFIG.blockedHosts.includes(parsed.hostname)) {
      return { valid: false, reason: `Blocked host: ${parsed.hostname}` };
    }

    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.)/.test(parsed.hostname)) {
      return { valid: false, reason: `Private IP blocked: ${parsed.hostname}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `Invalid URL: ${message}` };
  }

  return { valid: true };
}

export async function acquireSlot(providerId: string, timeoutMs?: number): Promise<SandboxSlot | null> {
  if (activeSlots.size >= DEFAULT_CONFIG.maxConcurrentSlots) {
    cleanupTimedOutSlots();
    if (activeSlots.size >= DEFAULT_CONFIG.maxConcurrentSlots) {
      warn(`No available slots (${activeSlots.size}/${DEFAULT_CONFIG.maxConcurrentSlots})`);
      return null;
    }
  }

  const slotId = generateSlotId();
  const timeout = Math.min(timeoutMs || DEFAULT_CONFIG.defaultTimeoutMs, DEFAULT_CONFIG.maxTimeoutMs);

  const slot: SandboxSlot = {
    id: slotId,
    providerId,
    startTime: Date.now(),
    timeoutMs: timeout,
    status: "active",
    memoryUsageBytes: 0,
    maxMemoryBytes: DEFAULT_CONFIG.maxMemoryPerSlotBytes,
  };

  activeSlots.set(slotId, slot);
  return slot;
}

export function releaseSlot(slotId: string, status: "completed" | "error" = "completed"): boolean {
  const slot = activeSlots.get(slotId);
  if (!slot) {
    warn(`Slot not found for release: ${slotId}`);
    return false;
  }

  slot.status = status;
  activeSlots.delete(slotId);
  completedSlots.push(slot);
  if (completedSlots.length > MAX_COMPLETED_HISTORY) {
    completedSlots.splice(0, completedSlots.length - MAX_COMPLETED_HISTORY);
  }
  return true;
}

export function resetProviderSlot(providerId: string): number {
  let released = 0;
  for (const [slotId, slot] of activeSlots) {
    if (slot.providerId === providerId) {
      slot.status = "error";
      activeSlots.delete(slotId);
      completedSlots.push(slot);
      released++;
    }
  }
  if (completedSlots.length > MAX_COMPLETED_HISTORY) {
    completedSlots.splice(0, completedSlots.length - MAX_COMPLETED_HISTORY);
  }
  if (released > 0) log(`Reset ${released} slots for provider ${providerId}`);
  return released;
}

function cleanupTimedOutSlots(): void {
  const now = Date.now();
  for (const [slotId, slot] of activeSlots) {
    if (now - slot.startTime > slot.timeoutMs) {
      slot.status = "timed_out";
      activeSlots.delete(slotId);
      completedSlots.push(slot);
      log(`Slot ${slotId} timed out (provider: ${slot.providerId})`);
    }
  }
}

export async function executeSandboxed<T>(
  providerId: string,
  providerUrl: string,
  fn: () => Promise<T>,
  timeoutMs?: number,
): Promise<{ result: T | null; slot: SandboxSlot; error?: string }> {
  const urlCheck = validateProviderUrl(providerUrl);
  if (!urlCheck.valid) {
    logSecurityEvent("sandbox_url_blocked", "high", `${providerId}: ${urlCheck.reason}`);
    const dummySlot: SandboxSlot = {
      id: "blocked", providerId, startTime: Date.now(),
      timeoutMs: 0, status: "error", memoryUsageBytes: 0, maxMemoryBytes: 0,
    };
    return { result: null, slot: dummySlot, error: urlCheck.reason };
  }

  try {
    const parsed = new URL(providerUrl);
    const ssrf = await resolveAndCheckSSRF(parsed.hostname);
    if (!ssrf.safe) {
      logSecurityEvent("sandbox_ssrf_blocked", "critical", `${providerId}: ${parsed.hostname} -> ${ssrf.ip}`);
      const dummySlot: SandboxSlot = {
        id: "ssrf-blocked", providerId, startTime: Date.now(),
        timeoutMs: 0, status: "error", memoryUsageBytes: 0, maxMemoryBytes: 0,
      };
      return { result: null, slot: dummySlot, error: `SSRF blocked: ${parsed.hostname}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const dummySlot: SandboxSlot = {
      id: "parse-error", providerId, startTime: Date.now(),
      timeoutMs: 0, status: "error", memoryUsageBytes: 0, maxMemoryBytes: 0,
    };
    return { result: null, slot: dummySlot, error: `URL parse error: ${message}` };
  }

  const slot = await acquireSlot(providerId, timeoutMs);
  if (!slot) {
    return {
      result: null,
      slot: { id: "no-slot", providerId, startTime: Date.now(), timeoutMs: 0, status: "error", memoryUsageBytes: 0, maxMemoryBytes: 0 },
      error: "No sandbox slots available",
    };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Sandbox execution timed out")), slot.timeoutMs)
    );

    const result = await Promise.race([fn(), timeoutPromise]);
    releaseSlot(slot.id, "completed");
    return { result, slot };
  } catch (err: unknown) {
    releaseSlot(slot.id, "error");
    const message = err instanceof Error ? err.message : String(err);
    return { result: null, slot, error: message };
  }
}

export function getSandboxStats(): {
  activeSlots: number;
  maxSlots: number;
  completedTotal: number;
  timedOutTotal: number;
  errorTotal: number;
  activeProviders: string[];
} {
  cleanupTimedOutSlots();
  return {
    activeSlots: activeSlots.size,
    maxSlots: DEFAULT_CONFIG.maxConcurrentSlots,
    completedTotal: completedSlots.filter(s => s.status === "completed").length,
    timedOutTotal: completedSlots.filter(s => s.status === "timed_out").length,
    errorTotal: completedSlots.filter(s => s.status === "error").length,
    activeProviders: [...new Set([...activeSlots.values()].map(s => s.providerId))],
  };
}

export type { SandboxSlot, SandboxConfig };
