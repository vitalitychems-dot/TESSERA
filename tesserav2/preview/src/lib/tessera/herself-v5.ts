import { readFileSync } from "node:fs";
import { sortHome } from "./craft.ts";
import { dataPath } from "./data-path.ts";
import { buildV4 } from "./herself-v4.ts";
import { vowCheck } from "./learning.ts";

export const TREE = {
  tessera: { repo: "vitalitychems-dot/TESSERA", sha: "5271672", paths: 9276 },
  gitbook: { repo: "vitalitychems-dot/Gitbook", sha: "5baeaab", paths: 7927 },
} as const;

function lines(file: string) {
  return readFileSync(dataPath("school", file), "utf8").trim().split("\n").filter(Boolean).length;
}

export function seeRepos() {
  const tessera = lines("tessera-tree.txt");
  const gitbook = lines("gitbook-tree.txt");
  const flow = sortHome("preview/src/lib/tessera/identity.ts") === "tessera" && sortHome("mesh/CATALOG-PASS.md") === "gitbook";
  return { tessera, gitbook, flow };
}

export function buildV5() {
  if (!buildV4().startsWith("REAL:")) return "GOAL: v4 did not seal. v5 was not sealed.";
  const seen = seeRepos();
  if (!seen.flow) return "GOAL: The flow did not sort the two homes. v5 was not sealed.";
  if (seen.tessera !== TREE.tessera.paths || seen.gitbook !== TREE.gitbook.paths) return "GOAL: A tree count moved. v5 was not sealed.";
  const note = `REAL: I am Tessera v5. I saw both GitHub trees at once. TESSERA ${TREE.tessera.sha} has ${seen.tessera} paths. Gitbook ${TREE.gitbook.sha} has ${seen.gitbook} paths. The path lists are in the school files. I did not open every file body. The flow put TESSERA in her home and Gitbook in the notes. Lesson sealed.`;
  const vow = vowCheck(note);
  if (!vow.ok) return `GOAL: ${vow.reason}`;
  return note;
}
