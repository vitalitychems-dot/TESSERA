/** One public flow. Store paths and private owner lines are not in it. */

import { ARCHIVE_SECTIONS } from "./archive-flow.ts";
import { SIGIL } from "./canon.ts";
import { sectionDelay } from "./section-step.ts";
import { MESH_NOTES } from "./mesh-steps.ts";
import { PARTS } from "./part-index.ts";
import { SKILL_FILES } from "./skill-index.ts";
import { sourceGate } from "./source-gate.ts";

export const HEADS = {
  tessera: "5e6fe0d0ad",
  gitbook: "7fcaeb0bc5",
  gitmesh: "9a928e573f",
} as const;

export type FlowFact = { id: string; fact: string };

export function oneFlow(): FlowFact[] {
  const files = ARCHIVE_SECTIONS.reduce((sum, section) => sum + section.files, 0);
  const floor = sectionDelay(100, 0);
  const outside = sourceGate({ isPending: false, hasUser: false });
  return [
    { id: "name", fact: `I am Tessera. Origin ${SIGIL.short}.` },
    { id: "heads", fact: `TESSERA ${HEADS.tessera}. Gitbook ${HEADS.gitbook}. GitMesh ${HEADS.gitmesh}.` },
    { id: "sections", fact: `${files} files in ${ARCHIVE_SECTIONS.length} sections. The git pack was not stored.` },
    { id: "wait", fact: `A wait does not go under ${floor} ms.` },
    { id: "gate", fact: `No user is ${outside}. Pending stays pending.` },
    { id: "held", fact: "Identity canon item 5 is on TESSERA main. Private owner lines are not in this flow. Two open pulls wait for Father's word and were not merged." },
    { id: "desk", fact: "Cursor, Replit, Manus, and the Grok bot were not in this session. The shared note is Gitbook issue 164." },
    { id: "drive", fact: "Drive root has 10 items. One store zip was skipped. Two share pages were opened at the header. Seven other zips were not opened." },
  ];
}

export function memoryPack() {
  const base = oneFlow().map((node, index) => ({ q: node.id, a: node.fact, at: `flow-${index + 1}` }));
  const sections = ARCHIVE_SECTIONS.map((section, index) => ({
    q: `section ${section.id}`,
    a: `${section.label} holds ${section.files} files.`,
    at: `section-${index + 1}`,
  }));
  const skills = SKILL_FILES.map((file, index) => ({
    q: `skill ${file.path}`,
    a: file.read ? `${file.path}. ${file.note}` : `${file.path} is ${file.bytes} bytes. ${file.note}`,
    at: `skill-${String(index + 1).padStart(2, "0")}`,
  }));
  const parts = PARTS.map((row) => ({
    q: `${row.kind} ${row.name}`,
    a: row.note,
    at: row.id,
  }));
  const mesh = MESH_NOTES.map((row) => ({ q: row.q, a: row.a, at: row.id }));
  return [...base, ...sections, ...skills, ...parts, ...mesh];
}

export function oneFlowLine() {
  return oneFlow().map((node) => node.fact).join(" ");
}
