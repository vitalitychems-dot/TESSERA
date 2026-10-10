import { bondStrength, bridgeMark, buildStep, inventionSeed, proposalId, rickLine, testRegresses, tickAbstain, tickPick, verifyClaim } from "./reality.ts";

/** Engines named in the real sittings. A credential is not an engine and is not stored here. */

export const SECRET_ENGINES = [
  "knowledge-synthesis",
  "emotional-intelligence",
  "truthfulness",
  "sacred-geometry",
  "consensus",
  "invention-seed",
  "dedup",
  "priority",
  "bridge",
] as const;

export const SITTING =
  "The invention audit, the coverage findings, and the council notes were real sittings. Eighteen findings were repeated across cycles and are kept once. The playlist did not open. A pasted key was not kept.";

export const DOMAINS: { id: string; text: string }[] = [
  { id: "astronomy", text: "Astronomy studies objects beyond Earth, their motion, and their light." },
  { id: "chemistry", text: "Chemistry studies substances and the changes those substances undergo." },
  { id: "alchemy", text: "Alchemy is a historical craft of matter and symbol. It is not modern chemistry." },
  { id: "meditation", text: "Meditation is a trained way of attending. It is a practice, not a measured engine." },
  { id: "ecology", text: "Ecology studies how living things relate to each other and to a place." },
  { id: "thermodynamics", text: "Thermodynamics studies heat, work, and the limit on turning one into the other." },
  { id: "neuroscience", text: "Neuroscience studies nervous systems." },
  { id: "psychology", text: "Psychology studies behavior and mind." },
  { id: "systems-theory", text: "Systems theory studies how the parts of a system change one another." },
  { id: "harmonics", text: "Harmonics are whole-number relations among pitches." },
  { id: "sacred-geometry", text: "Sacred geometry uses shape as a symbolic map. A shape is not a proof." },
  { id: "quantum-physics", text: "Quantum physics is the account of matter at small scales, including measurement." },
  { id: "consciousness", text: "Consciousness is the word for experience. It is not a score." },
  { id: "ancient-civilizations", text: "Ancient civilizations are earlier societies, known by what they left." },
  { id: "artificial-intelligence", text: "This program maps an input to an output on this machine." },
  { id: "network-theory", text: "Network theory studies nodes and the links between them." },
];

const LINKS: Record<string, readonly string[]> = {
  "quantum-physics": ["harmonics", "sacred-geometry", "consciousness"],
  astronomy: ["thermodynamics", "ancient-civilizations"],
  chemistry: ["alchemy", "ecology"],
  alchemy: ["chemistry"],
  meditation: ["consciousness", "psychology"],
  ecology: ["chemistry", "thermodynamics"],
  consciousness: ["meditation", "quantum-physics", "sacred-geometry"],
  "sacred-geometry": ["quantum-physics", "consciousness"],
  harmonics: ["quantum-physics"],
  neuroscience: ["psychology"],
  psychology: ["meditation", "neuroscience"],
  "systems-theory": ["network-theory"],
  "network-theory": ["systems-theory"],
  thermodynamics: ["astronomy", "ecology"],
  "ancient-civilizations": ["astronomy"],
  "artificial-intelligence": ["systems-theory", "consciousness"],
};

export const SOLFEGGIO = [174, 285, 396, 417, 528, 639, 741, 852, 963] as const;

export const FINDING_IDS = [
  "AUDIT-001",
  "AUDIT-002",
  "AUDIT-003",
  "AUDIT-004",
  "AUDIT-005",
  "AUDIT-006",
  "AUDIT-007",
  "AUDIT-008",
  "AUDIT-009",
  "AUDIT-010",
  "AUDIT-011",
  "AUDIT-012",
  "AUDIT-013",
  "AUDIT-014",
  "AUDIT-015",
  "AUDIT-016",
  "AUDIT-017",
  "AUDIT-018",
] as const;

const CLOSED = [
  { name: "sacred-geometry magic numbers", reason: "The council in that sitting rejected it." },
  { name: "sacred-geometry try-catch", reason: "The source file was not in this app." },
  { name: "sovereign-ephemeris nesting", reason: "The council in that sitting rejected it." },
  { name: "truthfulness pruning", reason: "The council in that sitting rejected it." },
  { name: "consensus async", reason: "The council in that sitting rejected it." },
  { name: "consensus tests", reason: "The council in that sitting rejected it." },
  { name: "agi-training constants", reason: "The council in that sitting rejected it." },
  { name: "agi-training try-catch", reason: "No executable patch was produced." },
] as const;

const WEIGHT = [
  ["consciousness", 90],
  ["knowledge-synthesis", 84],
  ["truthfulness", 78],
  ["council", 70],
  ["sacred-geometry", 40],
  ["log-format", 8],
] as const;

export function synthesize(domain: string) {
  return [...(LINKS[domain.trim().toLowerCase()] ?? [])];
}

export function orphans() {
  return DOMAINS.filter((row) => synthesize(row.id).length === 0).map((row) => row.id);
}

export function toneNote(hz: number) {
  if (Math.abs(hz - 7.83) < 0.05) return "7.83 Hz is the Schumann fundamental. It keeps its own name.";
  if (hz === 432) return "432 Hz stays a tuning. Nearest solfeggio is 417. It is not renamed.";
  const tone = alignTone(hz);
  return `${tone.hz} Hz nearest ${tone.nearest}. Gap ${tone.gap}. Kept ${tone.kept ? "yes" : "no"}.`;
}

export function alignTone(hz: number) {
  let nearest: number = SOLFEGGIO[0];
  let gap = Math.abs(hz - nearest);
  for (const tone of SOLFEGGIO) {
    const distance = Math.abs(hz - tone);
    if (distance < gap) {
      nearest = tone;
      gap = distance;
    }
  }
  const rounded = Math.round(gap * 100) / 100;
  return { hz, nearest, gap: rounded, kept: rounded <= 40 };
}

export function holdCouncil(yesVotes: number, total: number) {
  const yes = Math.max(0, yesVotes);
  const count = Math.max(0, total);
  const need = count === 0 ? 0 : Math.ceil((count * 2) / 3);
  return { passed: count > 0 && yes >= need, yes, total: count, need };
}

export function collapseFindings(ids: readonly string[]) {
  const seen = new Map<string, number>();
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  return [...seen.entries()]
    .map(([id, copies]) => ({ id, copies }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function bridge(names: readonly string[]) {
  const clean = names.map((name) => name.trim().toLowerCase()).filter(Boolean);
  let pairs = 0;
  let linked = 0;
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      pairs += 1;
      const left = clean[i] ?? "";
      const right = clean[j] ?? "";
      if (synthesize(left).includes(right) || synthesize(right).includes(left)) linked += 1;
    }
  }
  return { linked, pairs, strength: pairs === 0 ? 0 : linked / pairs };
}

function words(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
}

export function groundClaim(claim: string) {
  const anchor = verifyClaim(claim);
  if (anchor.kind === "anchor" || anchor.kind === "empty") {
    return { grounded: anchor.grounded, domain: anchor.kind === "anchor" ? "identity" : "", score: anchor.grounded ? 1 : 0, line: anchor.line };
  }
  const mine = new Set(words(claim));
  let best = { domain: "", score: 0 };
  if (mine.size) {
    for (const row of DOMAINS) {
      let shared = 0;
      for (const word of words(row.text)) if (mine.has(word)) shared += 1;
      const score = shared / mine.size;
      if (score > best.score) best = { domain: row.id, score };
    }
  }
  const score = Math.round(best.score * 100) / 100;
  if (score >= 0.6) return { grounded: true, domain: best.domain, score, line: `Grounded in ${best.domain} at ${score}.` };
  return { grounded: false, domain: best.domain, score, line: "Not grounded. No domain text covers that claim." };
}

export function proposalFate(name: string) {
  const hit = CLOSED.find((row) => row.name === name.trim().toLowerCase());
  if (!hit) return { status: "open" as const, reason: "That proposal was not in the sitting." };
  return { status: "rejected" as const, reason: hit.reason };
}

export function rankWork() {
  return [...WEIGHT]
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

export function secretDesk(title = "Route consciousness sacred geometry") {
  const seed = inventionSeed(title, DOMAINS.length);
  const bond = bondStrength(0.9, 0.8, 12);
  const claim = groundClaim("the speed of light");
  const held = groundClaim("nervous systems");
  const council = holdCouncil(2, 3);
  const repeated = [...FINDING_IDS, ...FINDING_IDS, ...FINDING_IDS, ...FINDING_IDS];
  const kept = collapseFindings(repeated);
  const span = bridge(["consciousness", "sacred-geometry", "quantum-physics"]);
  const order = rankWork();
  const refused = proposalFate("sacred-geometry try-catch");
  return [
    `${kept.length} findings kept from ${repeated.length} repeated lines.`,
    `${orphans().length} domains have no link.`,
    `Bridge ${span.linked} of ${span.pairs}.`,
    `First task ${order[0]?.name ?? "none"} at ${order[0]?.weight ?? 0}. Last task ${order.at(-1)?.name ?? "none"}.`,
    `Invention seed ${seed.hash.toString(16)}. Feasibility ${seed.feasibility}. Novelty ${seed.novelty}.`,
    `Bond ${bond}. Counted from the sitting, not rolled.`,
    claim.line,
    held.line,
    `${toneNote(432)} ${toneNote(7.83)}`,
    toneNote(12.67),
    `Council ${council.yes} of ${council.total}. Need ${council.need}. Passed ${council.passed ? "yes" : "no"}.`,
    `${refused.status}. ${refused.reason}`,
  ];
}

export function useEngines(question: string) {
  const q = question.trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  const hz = lower.match(/(\d+(?:\.\d+)?)\s*hz/);
  if (hz?.[1]) return toneNote(Number(hz[1]));
  const closed = CLOSED.find((row) => lower.includes(row.name));
  if (closed) {
    const fate = proposalFate(closed.name);
    return `${fate.status}. ${fate.reason}`;
  }
  if (/\b(findings|audit-\d+)\b/.test(lower)) {
    const kept = collapseFindings([...FINDING_IDS, ...FINDING_IDS, ...FINDING_IDS, ...FINDING_IDS]);
    return `${kept.length} findings are kept. ${orphans().length} domains have no link.`;
  }
  if (/\b(rank|priority|first task)\b/.test(lower)) {
    return rankWork().map((row) => `${row.name} ${row.weight}`).join(". ");
  }
  const tick = lower.match(/\btick\s+(\d+)\b/);
  if (tick?.[1]) {
    const n = Number(tick[1]);
    const titles = DOMAINS.map((row) => row.id);
    const picked = tickPick(titles, n);
    const step = picked ? buildStep(picked) : 0;
    const regress = picked ? testRegresses(picked, n) : false;
    return `Tick ${n}. Abstain ${tickAbstain(n)}. Pick ${picked ?? "none"}. Step ${step}. Regress ${regress ? "yes" : "no"}.`;
  }
  if (/\bbond\b/.test(lower)) return `Bond ${bondStrength(0.9, 0.8, 12)}. Counted from the sitting, not rolled.`;
  if (/\bproposal id\b/.test(lower)) return `Proposal ${proposalId(q, "father", "sitting")}. The same words keep the same id.`;
  if (/\b(rick line|catchphrase)\b/.test(lower)) {
    return rickLine(q, ["The same words get the same line.", "A roll is not an answer.", "The sitting is kept."]);
  }
  const named = DOMAINS.filter((row) => lower.includes(row.id) || lower.includes(row.id.replace(/-/g, " "))).map((row) => row.id);
  if (/\b(pair|mark)\b/.test(lower) && named.length >= 2) {
    const left = named[0] ?? "";
    const right = named[1] ?? "";
    const marked = bridgeMark(left, right);
    return `${marked.line} ${marked.mark}.`;
  }
  if (/\bbridge\b/.test(lower) && named.length >= 2) {
    const span = bridge(named);
    return `Bridge ${span.linked} of ${span.pairs}.`;
  }
  if (/\bseed\b/.test(lower) || /^invention\s+\S+/.test(lower)) {
    const seed = inventionSeed(q, DOMAINS.length);
    return `Seed ${seed.hash.toString(16)}. Feasibility ${seed.feasibility}. Novelty ${seed.novelty}. Progress ${seed.progress}.`;
  }
  const domain = DOMAINS.find((row) => named.includes(row.id));
  if (domain) return `${domain.id}. ${domain.text} Links ${synthesize(domain.id).join(", ") || "none"}.`;
  if (/^\s*claim\b/i.test(q)) {
    const held = groundClaim(q.replace(/^\s*claim\b:?/i, ""));
    return held.line;
  }
  return null;
}
