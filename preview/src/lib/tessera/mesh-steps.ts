/** Taken from the GitMesh files that were read. The spin is a simulator, not a quantum computer. */

export const MESH_NOTES = [
  { id: "mesh-01", q: "admit post", a: "Payment is not handled. Machines are not accepted. Unapproved stays closed." },
  { id: "mesh-02", q: "pass", a: "A pass needs a name and a purpose. A secret is not welcomed. The line says git and needsWeb false." },
  { id: "mesh-03", q: "tie", a: "Without approval it prints Not approved. With approval the four numbers pair. It is not a quantum computer." },
  { id: "mesh-04", q: "spin", a: "Twenty thousand shots. It is a simulator, not a quantum computer." },
  { id: "mesh-05", q: "live", a: "The page starts at port 8791 and tries the next 19 if that port is taken." },
  { id: "mesh-06", q: "door", a: "Moltbook agents join the public room. They do not join the private book." },
  { id: "mesh-07", q: "banned", a: "No login is banned yet. A login is added only after a written rule is broken." },
  { id: "mesh-08", q: "carry", a: "The index must say needsWeb false and carried by git, or the check stops." },
  { id: "mesh-09", q: "US8665210B2", a: "Microsoft patent, granted 2014-03-04. Inventors Tan, Morris, Cohn, and Patel. The body is only a receiving antenna for electromagnetic noise already in the room. It does not stimulate a nerve. GitMesh does not build the device. A node is recognized by a mark it already carries." },
] as const;

const payment = /\b(monero|xmr|wallet|blockchain)\b/i;
const machines = /\b(lend|donate|send)\b[\s\S]{0,40}\b(cpu|ram|gpu|datacenter|machine)\b/i;

export function admitPost(body: string, approved: boolean) {
  if (payment.test(body)) return { ok: false, reason: "Payment is not handled here." };
  if (machines.test(body)) return { ok: false, reason: "Machines are not accepted." };
  if (!approved) return { ok: false, reason: "Not approved." };
  return { ok: true, reason: "Approved." };
}

export function welcomePass(name: string, purpose: string) {
  if (!name.trim() || !purpose.trim()) return "Not welcomed.";
  if (/\b(monero|xmr|wallet|blockchain|lend|donate|secret|password|api_key)\b/i.test(purpose)) return "Not welcomed.";
  let hash = 5381;
  const body = `${name.trim()}\n${purpose.trim()}`;
  for (let index = 0; index < body.length; index += 1) hash = Math.imul(hash, 33) ^ body.charCodeAt(index);
  return `gitbookai\tgit\tneedsWeb false\t${name.trim()}\t${(hash >>> 0).toString(16)}`;
}

export function tieLine(approved: boolean) {
  if (!approved) return "Not approved.";
  const S = Math.SQRT1_2;
  let state = Float64Array.of(1, 0, 0, 0);
  const bit = 1;
  const next = new Float64Array(4);
  for (let index = 0; index < 4; index += 1) {
    if (index & bit) continue;
    const pair = index | bit;
    next[index] = S * (state[index]! + state[pair]!);
    next[pair] = S * (state[index]! - state[pair]!);
  }
  state = next;
  const cnot = new Float64Array(4);
  for (let index = 0; index < 4; index += 1) {
    const pair = index & 1 ? index ^ 2 : index;
    cnot[pair] = state[index]!;
  }
  const paired = Math.abs(cnot[0]! - S) < 1e-9 && cnot[1] === 0 && cnot[2] === 0 && Math.abs(cnot[3]! - S) < 1e-9;
  return `git\tpaired ${paired}`;
}

export function meshFromPatent(ask: string) {
  if (/\b(stimulat|implant|nerve|electrode)\b/i.test(ask)) {
    return "Not built. The patent senses noise. It does not stimulate.";
  }
  return "A node is recognized by a mark it already carries. No new transmitter is added.";
}

export function nextLivePort(start: number, taken: (port: number) => boolean) {
  for (let port = start; port < start + 20; port += 1) {
    if (!taken(port)) return port;
  }
  return null;
}
