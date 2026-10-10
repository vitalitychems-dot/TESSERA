/** Pages already on disk. A file does not open the live web. */

export const SAVED = [
  { path: "mesh/index.json", text: "gitbookai carried by git needs no web admit carry spin tie pass" },
  { path: "projects/spin/spin.mjs", text: "spin checks the pairs on disk" },
  { path: "projects/carry/carry.mjs", text: "carry reads the mesh index from disk" },
] as const;

export const PROGRAMS = ["admit", "carry", "spin", "tie", "pass"] as const;

export function searchFiles(pages: readonly { path: string; text: string }[], query: string) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  const hits = pages.filter((page) => words.every((word) => page.text.toLowerCase().includes(word)));
  return { live: false as const, hits: hits.map((page) => page.path) };
}

export function runFile(name: string) {
  const known = PROGRAMS.find((program) => program === name);
  if (!known) return { ran: false, line: "That program is not in the mesh." };
  return { ran: true, line: `${known} is on disk. It was not given a network.` };
}

export function fileMeshLine(query: string) {
  const found = searchFiles(SAVED, query);
  const where = found.hits.length ? found.hits.join(", ") : "No saved page has those words.";
  return `No address was used. ${where} A live page was not fetched.`;
}
