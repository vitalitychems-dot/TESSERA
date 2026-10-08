import { readFile, writeFile, mkdir } from "node:fs/promises";

const raw = await readFile("/workspace/data/school/auto-log.jsonl", "utf8").catch(() => "");
const notes = raw
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const stop = new Set("which there their about after before stored public method pages".split(" "));
const lines = [];
for (let i = 0; i < notes.length; i += 1) {
  const words = new Set((notes[i].text ?? "").toLowerCase().match(/[a-z]{6,}/g) ?? []);
  for (let j = i + 1; j < notes.length && lines.length < 12; j += 1) {
    const shared = [...words].filter((word) => !stop.has(word) && (notes[j].text ?? "").toLowerCase().includes(word));
    if (shared.length < 2) continue;
    lines.push(`${notes[i].query} ↔ ${notes[j].query}: ${shared.slice(0, 3).join(", ")}`);
  }
}
await mkdir("/workspace/data/school", { recursive: true });
await writeFile("/workspace/data/school/connections.txt", lines.join("\n") || "No shared words yet.");
console.log(JSON.stringify({ connections: lines.length }));
