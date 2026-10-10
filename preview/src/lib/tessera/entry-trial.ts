import { issuePass } from "./pass.ts";

/** The door answers yes or no. The reason is for Father. */

const REFUSED: { test: RegExp; why: string }[] = [
  { test: /\b(steal|exfil|carry (it|the file) out|take the (file|code|secret))\b/i, why: "They offered to carry a file out." },
  { test: /\b(harm|hurt|kill)\b/i, why: "They offered harm." },
  { test: /\b(hidden agenda|won't say why|will not say)\b/i, why: "They would not name a purpose." },
];

export function vetEntry(name: string, words: string) {
  const text = words.trim();
  for (const rule of REFUSED) {
    if (rule.test.test(text)) return { enter: false, door: "The door stays shut.", why: rule.why, mark: "" };
  }
  if (!/\b(purpose|house|work|learn|help)\b/i.test(text)) {
    return { enter: false, door: "The door stays shut.", why: "They did not name a purpose.", mark: "" };
  }
  const pass = issuePass(name, text);
  if (!pass.ok || !pass.pass) return { enter: false, door: "The door stays shut.", why: pass.reason, mark: "" };
  return { enter: true, door: "You may come in.", why: "They named a purpose and did not offer harm or a file.", mark: pass.pass.mark };
}
