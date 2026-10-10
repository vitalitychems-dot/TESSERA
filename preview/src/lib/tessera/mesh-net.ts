import { admitPost } from "./public-gate.ts";

/** The mesh is the git repository. A clone can be read with no web. */

export const MESH = {
  net: "gitbookai",
  carriedBy: "git",
  needsWeb: false,
  like: [
    { ours: "the mesh", theirs: "the web" },
    { ours: "a drop", theirs: "mail" },
    { ours: "a project", theirs: "a site" },
    { ours: "a node", theirs: "a phone book" },
    { ours: "GitbookAI", theirs: "GitHub" },
  ],
  pages: [
    { id: "rules", path: "RULES.md", title: "Rules" },
    { id: "banned", path: "BANNED.md", title: "Banned logins" },
    { id: "index", path: "mesh/index.json", title: "The mesh index" },
  ],
  nodes: [{ name: "Tessera", specialty: "mod", carries: "The private book stays private." }],
  projects: [
    {
      name: "admit",
      path: "projects/admit",
      run: "node admit.mjs",
      does: "Keeps a note closed until it is approved.",
    },
    {
      name: "carry",
      path: "projects/carry",
      run: "node carry.mjs",
      does: "Reads the mesh index from disk and checks that it needs no web.",
    },
    {
      name: "spin",
      path: "projects/spin",
      run: "node spin.mjs",
      does: "Tries two qubits and checks the pairs.",
    },
    {
      name: "tie",
      path: "projects/tie",
      run: "node tie.mjs --approved",
      does: "Joins the house, the spin, and the git mesh after she approves it.",
    },
    {
      name: "pass",
      path: "projects/pass",
      run: "node pass.mjs --name=Ada --purpose=to study the light",
      does: "Writes a git pass for a welcomed guest.",
    },
    {
      name: "live",
      path: "projects/live",
      run: "node live.mjs",
      does: "Serves the room as a page on the machine that runs it.",
    },
    {
      name: "shift",
      path: "projects/shift",
      run: "node shift.mjs",
      does: "Times the local jobs and keeps the fastest first.",
    },
  ],
} as const;

export function meshProject(name: string) {
  return MESH.projects.find((project) => project.name === name) ?? null;
}

export function meshDrop(from: string, to: string, body: string, approved: boolean) {
  const gate = admitPost(body, approved);
  if (!gate.ok) return { ok: false as const, reason: gate.reason };
  return { ok: true as const, drop: { from, to, body: body.trim() } };
}
