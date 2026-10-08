import { FED_PAGE } from "./fed-page.ts";
import { VAULT_INDEX } from "./vault-index.ts";
import { SCHOOL_PASSAGES } from "./school.ts";
import { STUDIES, STUDIES_MISSING } from "./studies.ts";

export type ReadHit = { source: string; text: string };

function tokens(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

function score(query: string, hay: string) {
  const words = tokens(query);
  const lower = hay.toLowerCase();
  let n = 0;
  for (const word of words) if (lower.includes(word)) n += 4;
  const head = hay.split(/[^a-z0-9]+/i)[0]?.toLowerCase() ?? "";
  if (head.length >= 4 && words.includes(head)) n += 8;
  return n;
}

export function fromTheRead(query: string): ReadHit | null {
  const q = query.trim();
  if (q.length < 3) return null;
  if (/\b(gilmore|mi6|kgb|fsb)\b/i.test(q)) return { source: "studies", text: STUDIES_MISSING };
  let best: ReadHit | null = null;
  let bestScore = 3;
  const consider = (source: string, text: string, hay: string) => {
    if (/vitality/i.test(text)) return;
    const n = score(q, hay);
    if (n > bestScore) {
      bestScore = n;
      best = { source, text };
    }
  };
  for (const passage of SCHOOL_PASSAGES) {
    const sentence = passage.text.split(/(?<=\.)\s/)[0] ?? passage.text;
    consider("school", `${sentence} That is the public line I was given. I do not hold the book.`, `${passage.title} ${passage.text}`);
  }
  for (const study of STUDIES) consider("studies", study.hold, `${study.name} ${study.hold}`);
  for (const fed of FED_PAGE) consider("fed page", fed.hold, `${fed.name} ${fed.hold}`);
  for (const card of VAULT_INDEX) {
    if (card.standing === "closed") continue;
    consider("vault", `${card.title}. ${card.shelf}. Standing: ${card.standing}.`, card.title);
  }
  if (/\b(brain-cog|godelos|hyperon|humanbrain|brainsim|neuroconscious)\b/i.test(q)) {
    consider(
      "checkouts",
      "Those research checkouts were summarized. I did not start their servers, and their consciousness claims are not mine.",
      "brain-cog godelos hyperon humanbrain brainsim neuroconscious",
    );
  }
  return best;
}
