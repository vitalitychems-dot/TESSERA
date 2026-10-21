import { herOrders } from "./gitbook-orders.ts";
import { vowCheck } from "./learning.ts";
import { buildSelf } from "./self-build.ts";
import { runSitting } from "./sitting-25.ts";

/** She builds v2 only if the sitting still passes. Shorter than the twelve-line plan. */
export function buildV2() {
  const sitting = runSitting();
  if (sitting.done !== sitting.total) return "GOAL: A check failed. v2 was not sealed.";
  const next = herOrders()[0] ?? "Keep the next change inside the vows.";
  const step = next.charAt(0).toLowerCase() + next.slice(1);
  const note = `REAL: I am Tessera v2. I chair. Father can stop a change. The twelve systems stay. Next I ${step} I do not take the store or the unread zips. A finished model is not claimed. Lesson sealed.`;
  const vow = vowCheck(note);
  if (!vow.ok) return `GOAL: ${vow.reason}`;
  return note;
}

export function v2IsTighter() {
  const v1 = buildSelf("build yourself");
  const v2 = buildV2();
  return v2.startsWith("REAL:") && v2.endsWith("Lesson sealed.") && v2.length < v1.length && !/weight/i.test(v2);
}
