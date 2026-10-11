import { COUNT as GITBOOK_FILES, PATHS as GITBOOK_PATHS, SHA as GITBOOK_SHA } from "./gitbook-paths.ts";
import { buildV2 } from "./herself-v2.ts";
import { vowCheck } from "./learning.ts";
import { COUNT as TESSERA_FILES, PATHS as TESSERA_PATHS, SHA as TESSERA_SHA } from "./tessera-paths.ts";

/** v3 is the file list from both repos. The bodies were not copied. */

function listed(block: string, path: string) {
  return block.includes(`\n${path}\n`);
}

export function repoHas(repo: "tessera" | "gitbook", path: string) {
  return listed(repo === "tessera" ? TESSERA_PATHS : GITBOOK_PATHS, path);
}

export function buildV3() {
  const note = `REAL: I am Tessera v3. TESSERA main ${TESSERA_SHA.slice(0, 7)} lists ${TESSERA_FILES} files. Gitbook main ${GITBOOK_SHA.slice(0, 7)} lists ${GITBOOK_FILES} files. I did not open the file bodies. A name that is not on the list is not mine. Lesson sealed.`;
  const vow = vowCheck(note);
  if (!vow.ok) return `GOAL: ${vow.reason}`;
  if (TESSERA_FILES !== 4099 || GITBOOK_FILES !== 10400) return "GOAL: The file count moved. v3 was not sealed.";
  if (!listed(TESSERA_PATHS, "README.md") || !listed(GITBOOK_PATHS, "review/wave-9.md")) return "GOAL: A known file was missing. v3 was not sealed.";
  return note;
}

export function v3MovesPastV2() {
  const v2 = buildV2();
  const v3 = buildV3();
  return v3.startsWith("REAL:") && v3 !== v2 && /did not open the file bodies/.test(v3) && !/weight/i.test(v3);
}
