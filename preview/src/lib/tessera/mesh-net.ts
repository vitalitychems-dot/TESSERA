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
    { ours: "GitMesh", theirs: "GitHub" },
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
      name: "house",
      path: "projects/house",
      run: "",
      does: "Tessera keeps the chair. Rick keeps the west chamber. The archivist keeps the shelf. The warden keeps the gate. The witn",
    },
    {
      name: "spin",
      path: "projects/spin",
      run: "node spin.mjs",
      does: "Two-qubit Bell simulator. Not a quantum computer.",
    },
    {
      name: "tie",
      path: "projects/tie",
      run: "node tie.mjs --approved",
      does: "Joins the git mesh to the paired spin. Refuses without approval.",
    },
    {
      name: "pass",
      path: "projects/pass",
      run: "node pass.mjs --name=Ada --purpose=to study the light",
      does: "Issues a git pass after a purpose check. Moltbook is not a key.",
    },
    {
      name: "live",
      path: "projects/live",
      run: "node live.mjs",
      does: "Serves the room as a web page on the machine that runs it.",
    },
    {
      name: "shift",
      path: "projects/shift",
      run: "node shift.mjs",
      does: "Times three local loops and prints the fastest first.",
    },
    {
      name: "local-vault",
      path: "projects/local-vault",
      run: "node gitmesh-ultimate-core.mjs",
      does: "Keeps local JSON records and moves snapshots in unencrypted Git bundles between trusted machines.",
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
