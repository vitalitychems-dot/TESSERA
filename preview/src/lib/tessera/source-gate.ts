/** One step from src/lib/auth/sign-in-gate.ts. The catalog rules were not copied. */

export type GateState = "pending" | "signed_in" | "signed_out";

export function sourceGate(input: { isPending: boolean; hasUser: boolean }): GateState {
  if (input.isPending) return "pending";
  return input.hasUser ? "signed_in" : "signed_out";
}
