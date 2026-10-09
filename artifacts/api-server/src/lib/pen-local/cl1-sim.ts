import { disabledCl1, type Cl1SimProvenance } from "./types";

/**
 * Simulator channel. This module does not resolve, require, or execute a
 * simulator file. The channel stays off even when the flag is on.
 * No session is started, and this module does not train or contact hardware or cloud.
 */
export async function attachCl1Sim(flagOn: boolean): Promise<Cl1SimProvenance> {
  void flagOn;
  return disabledCl1();
}
