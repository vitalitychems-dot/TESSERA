/** A public proposal is not a post until it is approved. Payment and donated machines are refused. */

const PAYMENT = /\b(monero|xmr|wallet|blockchain)\b/i;
const MACHINES = /\b(lend|donate|send)\b[\s\S]{0,40}\b(cpu|ram|gpu|datacenter|machine)\b/i;

export function admitPost(body: string, approved: boolean) {
  if (PAYMENT.test(body)) return { ok: false as const, reason: "Payment is not handled here." };
  if (MACHINES.test(body)) return { ok: false as const, reason: "Machines are not accepted." };
  if (!approved) return { ok: false as const, reason: "Not approved." };
  return { ok: true as const, reason: "Approved." };
}
