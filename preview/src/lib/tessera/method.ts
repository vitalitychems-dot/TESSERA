import { briefFor } from "./craft.ts";
import { joinAsk } from "./join-web.ts";
import { graphContext } from "./token-graph.ts";

/** The only way a chat turn is built. Both pens use this. */
export const METHOD = [
  "One question in.",
  "One agent.",
  "Join a name only to a home it already has.",
  "Add a graph slice only when the words match, and stay under the budget.",
  "Then speak.",
  "If the reply breaks a vow, do not show it.",
] as const;

export function turnNote(asked: string, prior: string[] = []) {
  const packed = graphContext(asked);
  const text = `${briefFor(asked, prior)}\n${joinAsk(asked).line}\nGRAPH ${packed.tokens} kept. Not a weight update.\n${packed.text}`;
  return { text, tokens: packed.tokens, full: packed.full };
}
