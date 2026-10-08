/** Open lines from Gitbook mesh/TODOS.md on 2026-10-08. She does the ones an agent may do. She does not do Father's. */

export const GITBOOK_OPEN = [
  { who: "Father", text: "Rotate the old keys. No agent can do this.", hers: false },
  { who: "Father", text: "Say yes on Gitbook issue 2 before the desk drill is copied into TESSERA.", hers: false },
  { who: "Cursor", text: "After that yes, copy the drill and its test. Do not copy the store.", hers: false },
  { who: "Tessera", text: "Leave the large query database out until it is split and secrets are removed.", hers: true },
  { who: "Tessera", text: "Leave the supply zip on Drive. Do not invent its contents.", hers: true },
  { who: "Tessera", text: "Do not fetch the repository list. The index is enough.", hers: true },
  { who: "Tessera", text: "Do not read the Zz archive again until a task names one file.", hers: true },
  { who: "Tessera", text: "Do not install the eight tool cards.", hers: true },
  { who: "Tessera", text: "Do not mark a finished model, a live fleet, or full detachment as done.", hers: true },
] as const;

export function herOrders() {
  return GITBOOK_OPEN.filter((item) => item.hers).map((item) => item.text);
}

export function gitbookAnswer(query: string) {
  if (!/\b(gitbook|to-?do|what next|what should we build)\b/i.test(query)) return "";
  return herOrders().join("\n");
}
