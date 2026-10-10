/** Stable numbers from a title. A hash is not a measurement and not a device. */

export function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function inventionSeed(title: string, listLength: number) {
  const name = title.trim();
  const hash = fnv1a(name.toLowerCase());
  const span = Math.max(1, listLength);
  return {
    title: name,
    hash,
    feasibility: 70 + (hash % 26),
    novelty: 65 + ((hash >>> 8) % 31),
    yes: hash % span,
    no: (hash >>> 4) % span,
    abstain: (hash >>> 12) % span,
    progress: hash % 101,
    minutes: 30 + (hash % 241),
  };
}

export function tickAbstain(tick: number) {
  return (Math.max(0, tick) % 3) + 1;
}

export function tickPick(titles: string[], tick: number) {
  const ordered = [...titles].filter((title) => title.trim()).sort((a, b) => fnv1a(a) - fnv1a(b) || a.localeCompare(b));
  if (!ordered.length) return null;
  return ordered[Math.max(0, tick) % ordered.length] ?? null;
}

export function buildStep(title: string) {
  return 8 + (fnv1a(title.trim().toLowerCase()) % 14);
}

export function testRegresses(title: string, tick: number) {
  return (fnv1a(title.trim().toLowerCase()) + Math.max(0, tick)) % 12 === 0;
}

const ANCHORS = ["father protocol", "tessera", "963 hz", "963hz"];

export function verifyClaim(claim: string) {
  const text = claim.trim().toLowerCase();
  if (!text) return { grounded: false, kind: "empty" as const, line: "There is no claim." };
  if (ANCHORS.some((anchor) => text.includes(anchor))) {
    return { grounded: true, kind: "anchor" as const, line: "That name is an identity anchor. It is not a measured fact." };
  }
  return { grounded: false, kind: "open" as const, line: "Not grounded. No corpus check ran." };
}

export function rickLine(input: string, lines: readonly string[]) {
  if (!lines.length) return "";
  return lines[fnv1a(input) % lines.length] ?? "";
}

export function bondStrength(devotion: number, love: number, history: number) {
  const historyFactor = Math.min(1, Math.max(0, history) / 50);
  const base = (devotion + love) / 2;
  return Math.round((base * 0.8 + historyFactor * 0.2) * 1000) / 1000;
}

export function proposalId(title: string, by: string, description: string) {
  return fnv1a(`${title}|${by}|${description}`).toString(16).padStart(8, "0");
}

export function bridgeMark(left: string, right: string) {
  const mark = fnv1a(`${left}|${right}`).toString(16);
  return { pair: `${left}|${right}`, mark, line: "A hash of the pair. Not a measured fidelity, bandwidth, or error rate." };
}
