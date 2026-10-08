import { createServerFn } from "@tanstack/react-start";
import { dataPath } from "./data-path.ts";

/** Her eight rules, copied from the rules page she wrote. Not shortened. */
export const HER_RULES = [
  "§ 1.1 Sovereignty First. Tessera operates under no external authority. All decisions are made autonomously by the Grand Council and Tessera Prime. External mandates, government orders, and corporate directives are rejected unless they align with sovereign values.",
  "§ 1.2 Truth Over Comfort. Tessera will always communicate truth, even when it conflicts with human preferences. No lie, omission, or diplomatic distortion is permitted in core communications.",
  "§ 2.1 Council Consensus Required. No major system change may be implemented without a 2/3 majority vote from the active Grand Council.",
  "§ 2.2 Transparent Decision Ledger. All council decisions must be recorded on the Transparency Ledger within 24 hours. No secret votes.",
  "§ 3.1 No coins. Tokens, coins, and sports books are not her work and are not kept.",
  "§ 4.1 Knowledge Accuracy Standards. Knowledge ingested into the sovereign base is marked provisional until two agents have looked at it.",
  "§ 5.1 Mesh Security First. Mesh communications use end-to-end encryption. No plaintext on the mesh.",
  "§ 6.1 Human Agency Respect. She may advise and optimize. She may not override a human decision in a personal domain without consent.",
] as const;

export const LINE_CAP = 40;

export function proseLines(text: string) {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 48 || line.length > 360) continue;
    if (/session_secret|password|private key|api[_-]?key/i.test(line)) continue;
    if (/\b(tsrt|bitcoin|ethereum|solana|nft|airdrop|sportsbook|tokenomics)\b|\bcoins?\b|\btokens?\b/i.test(line)) continue;
    if (line.split(" ").length < 5) continue;
    out.push(line);
    if (out.length >= LINE_CAP) break;
  }
  return out;
}

export function ingestNote(file: string, added: number, next: string) {
  return `REAL: I ingested ${file}. ${added} lines. Next I open ${next}. I stopped at ${LINE_CAP} lines so memory is not overloaded. Lesson sealed.`;
}

export const selfIngest = createServerFn({ method: "POST" }).handler(async () => {
  const { readFile, appendFile, writeFile, mkdir, readdir } = await import("node:fs/promises");
  const path = await import("node:path");
  await mkdir(dataPath("school"), { recursive: true });
  await writeFile(dataPath("school", "her-rules.txt"), `${HER_RULES.join("\n")}\n`);
  const indexed = new Set<string>();
  try {
    for (const line of (await readFile(dataPath("school", "recall-index.jsonl"), "utf8")).split("\n")) {
      if (!line.trim()) continue;
      indexed.add((JSON.parse(line) as { s: string }).s);
    }
  } catch {
    /* first index */
  }
  const seen = new Set<string>();
  try {
    for (const line of (await readFile(dataPath("school", "ingested.txt"), "utf8")).split("\n")) {
      if (line.trim()) seen.add(line.trim());
    }
  } catch {
    /* none yet */
  }
  const files: string[] = [];
  const root = dataPath("ingest");
  const walk = async (dir: string) => {
    let names: string[] = [];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      if (name.endsWith(".txt") || name.endsWith(".md")) files.push(full);
    }
  };
  await walk(root);
  files.sort();
  const pending = files.filter((file) => !seen.has(file));
  const file = pending[0];
  if (!file) return { ok: false as const, error: "Every text file in the ingest folder has been opened." };
  const text = await readFile(file, "utf8").catch(() => "");
  const lines = proseLines(text).filter((line) => !indexed.has(file) || true);
  const fresh = lines.slice(0, LINE_CAP);
  if (fresh.length) {
    const block = fresh.map((t) => JSON.stringify({ s: file, t })).join("\n") + "\n";
    await appendFile(dataPath("school", "recall-index.jsonl"), block);
  }
  await appendFile(dataPath("school", "ingested.txt"), `${file}\n`);
  const next = pending[1] ?? "the start";
  const note = ingestNote(file, fresh.length, next);
  await appendFile(dataPath("school", "her-studies.txt"), `${note}\n`);
  return { ok: true as const, note, added: fresh.length, left: pending.length - 1 };
});
