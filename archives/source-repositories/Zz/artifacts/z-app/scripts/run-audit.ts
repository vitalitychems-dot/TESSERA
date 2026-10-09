import { readFileSync, writeFileSync } from "node:fs";
import { acceptNote, auditNotes } from "../src/lib/tessera/audit";

const raw = readFileSync("/workspace/data/school/auto-log.jsonl", "utf8");
const notes = raw
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { query: string; text: string; url?: string });

const report = auditNotes(notes);
const duplicate = acceptNote(notes, { query: notes[0]?.query ?? "x", text: "x".repeat(40), url: "https://example.com" });
const ungrounded = acceptNote(notes, { query: "Not In Any Note", text: "x".repeat(80), url: "https://example.com/no" });

const out = {
  at: new Date().toISOString(),
  score: report.score,
  checks: report.checks,
  refusedDuplicate: duplicate.ok === false,
  refusedUngrounded: ungrounded.ok === false,
};
writeFileSync("/workspace/data/school/audit.json", JSON.stringify(out, null, 2));
const failed = report.checks.filter((check) => !check.pass);
console.log(JSON.stringify({ score: report.score, failed: failed.map((check) => check.name), refusedDuplicate: out.refusedDuplicate, refusedUngrounded: out.refusedUngrounded }, null, 2));
if (failed.length || !out.refusedDuplicate || !out.refusedUngrounded) process.exit(1);
