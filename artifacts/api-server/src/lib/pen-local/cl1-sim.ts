import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { disabledCl1, type Cl1SimProvenance } from "./types";

/**
 * Optional simulator channel. The only path is this file beside the module.
 * A missing file, a failed load, or is_simulator() other than true leaves the channel off.
 * The pen still replies. No session is started, and this module does not train
 * or contact hardware or cloud.
 */
const SIMULATOR_FILE = fileURLToPath(new URL("./cl1-simulator.mjs", import.meta.url));

export async function attachCl1Sim(flagOn: boolean): Promise<Cl1SimProvenance> {
  if (!flagOn) return disabledCl1();
  try {
    const loaded: unknown = createRequire(import.meta.url)(SIMULATOR_FILE);
    const isSimulator = readIsSimulator(loaded);
    if (isSimulator !== true) {
      return { enabled: false, is_simulator: isSimulator, label: "REPORTED" };
    }
    return { enabled: true, is_simulator: true, label: "REPORTED" };
  } catch {
    return disabledCl1();
  }
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
