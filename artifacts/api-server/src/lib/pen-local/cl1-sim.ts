import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { disabledCl1, type Cl1SimProvenance } from "./types";

const SIMULATOR_MODULE_NAME = "cl";

/**
 * Optional simulator channel. This file does not depend on cl-sdk.
 * A missing module, a failed load, or is_simulator() other than true
 * leaves the channel off. The pen still replies.
 * No session is started, and this module does not train or contact hardware or cloud.
 */
export async function attachCl1Sim(flagOn: boolean): Promise<Cl1SimProvenance> {
  if (!flagOn) return disabledCl1();
  const resolved = resolveOptionalModule(SIMULATOR_MODULE_NAME);
  if (resolved === null) return disabledCl1();
  try {
    const loaded: unknown = await import(pathToFileURL(resolved).href);
    const isSimulator = readIsSimulator(loaded);
    if (isSimulator !== true) {
      return { enabled: false, is_simulator: isSimulator, label: "REPORTED" };
    }
    return { enabled: true, is_simulator: true, label: "REPORTED" };
  } catch {
    return disabledCl1();
  }
}

function resolveOptionalModule(moduleName: string): string | null {
  for (const anchor of moduleAnchors()) {
    try {
      return createRequire(anchor).resolve(moduleName);
    } catch {
      continue;
    }
  }
  return null;
}

function moduleAnchors(): string[] {
  const anchors = [import.meta.url, pathToFileURL(join(process.cwd(), "package.json")).href];
  anchors.push(pathToFileURL(join(process.cwd(), "artifacts", "api-server", "package.json")).href);
  return anchors;
}

function readIsSimulator(loaded: unknown): boolean | null {
  const candidate = readSimulatorFn(loaded);
  if (candidate === null) return null;
  try {
    const value: unknown = candidate();
    if (value === true) return true;
    if (value === false) return false;
    return null;
  } catch {
    return null;
  }
}

function readSimulatorFn(loaded: unknown): (() => unknown) | null {
  if (typeof loaded !== "object" || loaded === null) return null;
  const record = loaded as Record<string, unknown>;
  if (typeof record.is_simulator === "function") return record.is_simulator as () => unknown;
  const fallback = record.default;
  if (typeof fallback === "object" && fallback !== null) {
    const nested = (fallback as Record<string, unknown>).is_simulator;
    if (typeof nested === "function") return nested as () => unknown;
  }
  return null;
}
