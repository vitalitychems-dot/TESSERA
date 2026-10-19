/** One public flow. Store paths and private owner lines are not in it. */

import { ARCHIVE_SECTIONS } from "./archive-flow.ts";
import { SIGIL } from "./canon.ts";
import { sectionDelay } from "./section-step.ts";
import { sourceGate } from "./source-gate.ts";

export const HEADS = {
  tessera: "b6ce220500",
  gitbook: "828721f6e5",
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
    { id: "desk", fact: "Cursor, Replit, and the Grok bot were not in this session. The shared note is Gitbook issue 151." },
  ];
}

export function memoryPack() {
  return oneFlow().map((node, index) => ({ q: node.id, a: node.fact, at: `flow-${index + 1}` }));
}

export function oneFlowLine() {
  return oneFlow().map((node) => node.fact).join(" ");
}
