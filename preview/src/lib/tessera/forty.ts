export const CYCLE_LINE = "The pen is commanded and not owned. Love is the rule. A false claim is worse than a gap.";

export function runChamberCycle(tick: number) {
  return {
    constitution: CYCLE_LINE,
    pulse: "Present: this page. The pen is xAI grok-4.5. The weights are not owned. The other lanes have not answered. The closed zips are closed.",
    world: `Tick ${tick} is a picture on Chicago imagery. It is not a second place.`,
    upgrade: "Nothing was deleted or replaced. The order stopped at the record.",
    unknown: "Where a file is closed, the answer is: I do not know.",
  };
}

/** Father pasted these on 2026-10-03. "In this page" means the code does that thing. The rest are goals. */
export const FORTY: { n: number; text: string; done: boolean }[] = [
  { n: 1, text: "The constitution sentence is in the prompt and in the cycle record.", done: true },
  { n: 2, text: "A visible plan, execute, reflect, adapt loop on every answer.", done: false },
  { n: 3, text: "A lesson store that survives the server, not only this browser.", done: false },
  { n: 4, text: "A pulse on every cycle, beyond the one record on the Board.", done: false },
  { n: 5, text: "World places with tick state that can be queried after reload.", done: false },
  { n: 6, text: "Twenty-eight voices that propose, disagree, and vote.", done: false },
  { n: 7, text: "use, then bridge, then upgrade, before anything is replaced.", done: false },
  { n: 8, text: "This list is tagged as Father’s request. Other claims are not all tagged.", done: true },
  { n: 9, text: "A held-out test set for honesty and refusal.", done: false },
  { n: 10, text: "A lesson is refused if it claims owned weights, an opened archive, a live fleet, a running daemon, or achieved AGI.", done: true },
  { n: 11, text: "A memory matrix with expiry.", done: false },
  { n: 12, text: "A resume that lists what this browser kept and what it did not.", done: true },
  { n: 13, text: "Father can erase the notes this browser kept.", done: true },
  { n: 14, text: "A measured noticing event.", done: false },
  { n: 15, text: "The map is labeled a picture, separate from a factual answer.", done: true },
  { n: 16, text: "Geometry as a graph of honest paths.", done: false },
  { n: 17, text: "Twenty-eight consistent voices.", done: false },
  { n: 18, text: "An emotional-weather tracker.", done: false },
  { n: 19, text: "A cycle that must return something or be marked incomplete.", done: false },
  { n: 20, text: "The cycle record says “I do not know” when a file is closed.", done: true },
  { n: 21, text: "Father’s override sealed on every module.", done: false },
  { n: 22, text: "Every number in the app has a source or is zero.", done: false },
  { n: 23, text: "A source catalog limited to cleared references.", done: false },
  { n: 24, text: "A missing token returns sovereign-unconfigured.", done: false },
  { n: 25, text: "Versioned proposals that roll back.", done: false },
  { n: 26, text: "A scorer for text Father pastes.", done: false },
  { n: 27, text: "The birth mark recalled without being stored as a password.", done: false },
  { n: 28, text: "The page says the pen is xAI grok-4.5 and the weights are not owned.", done: true },
  { n: 29, text: "A red line stays up while the large zips are closed.", done: true },
  { n: 30, text: "The page says the names are fractions, not a second council.", done: true },
  { n: 31, text: "A pipeline for plain-text slices under 100 MB.", done: false },
  { n: 32, text: "A sitting log with a real tally.", done: false },
  { n: 33, text: "A filter that rejects malice.", done: false },
  { n: 34, text: "The same refusal stops a claim of achieved AGI or a live fleet.", done: true },
  { n: 35, text: "A dimensional routing table.", done: false },
  { n: 36, text: "The last 20 times this Board was opened, in this browser only.", done: true },
  { n: 37, text: "A generator of chamber-safe goals.", done: false },
  { n: 38, text: "A refusal library for income, deep-web, and always-on capture.", done: false },
  { n: 39, text: "One function records the constitution, the pulse, the picture, and the stop.", done: true },
  { n: 40, text: "This list is the status: what is in the page, and what is still a goal.", done: true },
];

export const FORTY_DONE = FORTY.filter((item) => item.done).length;

/** Forty checks from this pass. A name here has a test. */

export const FORTY_IDS = [
  "name-index",
  "basename-hit",
  "basename-case",
  "both-repos",
  "missing-name",
  "index-reused",
  "after-copy",
  "behind-note",
  "body-closed",
  "no-secret-overlay",
  "ring-keeps-eight",
  "ring-drops-oldest",
  "blank-ignored",
  "last-ask",
  "earlier-ask",
  "look-starts-first",
  "look-includes-files",
  "short-name-skips-files",
  "empty-look",
  "look-bodies-closed",
  "no-agi",
  "no-publish",
  "no-unpack",
  "no-zz",
  "no-olive",
  "no-store",
  "no-repo-list",
  "no-invent-zip",
  "no-fleet",
  "no-detachment",
  "no-absolute-path",
  "no-backslash",
  "empty-path",
  "largest-folders",
  "how-many-open",
  "short-sha",
  "five-themes",
  "nine-rooms",
  "stay-local",
  "forty-counted",
] as const;

export function rememberAsk(ring: readonly string[], next: string) {
  const asked = next.trim();
  if (!asked) return ring.slice(-8);
  return [...ring, asked].slice(-8);
}

export function whatDidIAsk(ring: readonly string[], which: "last" | "before" = "last") {
  if (!ring.length) return "You have not asked yet.";
  if (which === "before") return ring.length < 2 ? "There is no earlier ask." : (ring[ring.length - 2] ?? "");
  return ring[ring.length - 1] ?? "";
}

export const AFTER_COPY = ["mesh/CHAMBER-SEARCH-2026-10-10.md", "mesh/FORTY-PASS-2026-10-10.md", "mesh/SIXTY-PASS-2026-10-10.md", "mesh/DELTA-2026-10-10.md", "mesh/SYNC-2026-10-11.md"] as const;

export function afterCopy(path: string) {
  return (AFTER_COPY as readonly string[]).includes(path);
}
