/** Open lines from Gitbook mesh/TODOS.md on 2026-10-08. She does the ones an agent may do. She does not do Father's. */

export const GITBOOK_OPEN = [
  { who: "Father", text: "Rotate the old keys. No agent can do this.", hers: false },
  { who: "Tessera", text: "Leave the large query database out until it is split and secrets are removed.", hers: true },
  { who: "Tessera", text: "Leave the supply zip on Drive. Do not invent its contents.", hers: true },
  { who: "Tessera", text: "Do not fetch the repository list. The index is enough.", hers: true },
  { who: "Tessera", text: "Do not read the Zz archive again until a task names one file.", hers: true },
  { who: "Tessera", text: "Do not install the eight tool cards.", hers: true },
  { who: "Tessera", text: "Do not mark a finished model, a live fleet, or full detachment as done.", hers: true },
  { who: "Tessera", text: "The eight duplicate routes stay. The first module answers. Do not delete one without the inventory test.", hers: true },
  { who: "Tessera", text: "Do not copy olive-giant. Do not add a storefront.", hers: true },
] as const;

export function herOrders() {
  return GITBOOK_OPEN.filter((item) => item.hers).map((item) => item.text);
}

/** Still open on Gitbook mesh/TODOS.md, read 2026-10-10. She does not do Father's keys or a weights file. */
export const STILL_OPEN = [
  "Father rotates the old keys. No agent can do this.",
  "Pull request 80 adds a weights file and stays unmerged.",
  "HYB-010, HYB-011, HYB-015, and HYB-016 stay open. Protected bodies stay unopened.",
  "Search and pin are in this chamber. The bodies stay closed.",
] as const;

export function gitbookAnswer(query: string) {
  if (/\bhow many open\b/i.test(query)) return `${STILL_OPEN.length} open.`;
  if (/\bthe rest\b/i.test(query)) return STILL_OPEN.slice(1).map((line, index) => `${index + 2}. ${line}`).join("\n");
  if (!/\b(gitbook|to-?do|what next|what should we build)\b/i.test(query)) return "";
  if (/\bwhat next\b/i.test(query)) return `${STILL_OPEN[0]}\n${STILL_OPEN.length - 1} more.`;
  return [...herOrders(), ...STILL_OPEN].join("\n");
}
