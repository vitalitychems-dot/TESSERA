/**
 * OPT studio, task graph and bot handoffs. Local, no model calls.
 */
import { countTokens } from "../token/meter.mjs";

/** OPT-12: group a DAG into waves that can run side by side (Airflow/Prefect topo layering). */
export function waves(tasks) {
  const deps = new Map(tasks.map((t) => [t.id, new Set(t.dependsOn ?? [])]));
  const done = new Set();
  const out = [];
  while (done.size < deps.size) {
    const wave = [...deps].filter(([id, d]) => !done.has(id) && [...d].every((x) => done.has(x))).map(([id]) => id);
    if (!wave.length) throw new Error("cycle in task graph");
    wave.forEach((id) => done.add(id));
    out.push(wave);
  }
  return out;
}

/** OPT-13: capped retry with backoff (Temporal-style). One try is the old behaviour. */
export async function withRetry(fn, { attempts = 3, baseMs = 0, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try { return { value: await fn(i), tries: i + 1 }; }
    catch (error) { lastError = error; if (i + 1 < attempts && baseMs) await sleep(baseMs * 2 ** i); }
  }
  throw lastError;
}

/** OPT-14: idempotent completion. A second "done" with the same key is a no-op, not an error. */
export function idempotentComplete(foreman) {
  const seen = new Set();
  return (id, key = id) => {
    if (seen.has(key)) return { duplicate: true };
    seen.add(key);
    foreman.complete(id);
    return { duplicate: false };
  };
}

/** OPT-16: compact handoff envelope (A2A-style task message). */
export function handoffEnvelope({ from, to, task, status, refs = [], next }) {
  return JSON.stringify({ f: from, t: to, k: task, s: status, r: refs, n: next });
}
export function proseHandoff({ from, to, task, status, refs = [], next }) {
  return `Hi ${to}, this is ${from}. I wanted to let you know that I have been working on task ${task} and its current status is ${status}. ` +
    `The relevant references you will need are: ${refs.join(", ")}. When you get a chance, the next thing to do would be: ${next}. Thank you so much, ${from}.`;
}

/** OPT-17: capability registry (A2A agent card). Direct route instead of asking every lane. */
export function createRegistry() {
  const cards = new Map();
  return {
    register(id, skills) { cards.set(id, new Set(skills)); },
    route(skill) {
      for (const [id, skills] of cards) if (skills.has(skill)) return { to: id, messages: 1 };
      return { to: null, messages: 0 };
    },
    broadcast(skill) {
      let messages = 0, to = null;
      for (const [id, skills] of cards) { messages += 2; if (!to && skills.has(skill)) to = id; }
      return { to, messages: messages + 1 };
    },
  };
}

/** OPT-18: plan memo. Identical goals reuse the plan instead of calling the pen again. */
export function memoPen(pen) {
  const plans = new Map();
  let calls = 0;
  return {
    name: `${pen.name}+memo`,
    async complete(prompt) {
      const key = String(prompt).trim().toLowerCase();
      if (!plans.has(key)) { calls++; plans.set(key, await pen.complete(prompt)); }
      return structuredClone(plans.get(key));
    },
    calls: () => calls,
  };
}

/** OPT-19: batch open decisions into one human round trip. */
export function batchDecisions(foreman, open, answers) {
  for (const d of open) foreman.decide(d.id, answers[d.id] ?? "ok");
  return { rounds: open.length ? 1 : 0 };
}

/** OPT-20: stop counting once 2/3 is reached or can no longer be reached. */
export function earlyQuorum(votes, total, need = Math.ceil((total * 2) / 3)) {
  let yes = 0, read = 0;
  for (const v of votes) {
    read++;
    if (v === true) yes++;
    if (yes >= need) return { passed: true, read };
    if (yes + (total - read) < need) return { passed: false, read };
  }
  return { passed: yes >= need, read };
}

/** OPT-21: single-owner claim. Two lanes cannot run the same task. */
export function createClaims() {
  const owners = new Map();
  return {
    claim(taskId, lane) {
      if (!lane) throw new Error("empty owner");
      if (owners.has(taskId)) return owners.get(taskId) === lane;
      owners.set(taskId, lane);
      return true;
    },
    release(taskId, lane) { if (owners.get(taskId) === lane) owners.delete(taskId); },
  };
}

export const handoffTokens = (text) => countTokens(text);
