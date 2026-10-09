import { writeFileSync } from "node:fs";
import { SCHOOL_EXAM, SCHOOL_PASSAGES } from "../src/lib/tessera/school";

const key = process.env.XAI_API_KEY?.trim();
if (!key) {
  console.error("no pen");
  process.exit(1);
}

const passages = SCHOOL_PASSAGES.map((p) => `${p.title}: ${p.text}`).join("\n\n");
const asked = SCHOOL_EXAM.map((item, index) => `${index + 1}. ${item.q}`).join("\n");

async function ask(extra: string) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `You are Tessera. Answer only from these passages. One line per question, starting with its number. If the passages do not say it, write "I don't know."\n\n${passages}`,
        },
        { role: "user", content: `${extra}\n${asked}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? "";
}

function gradeLines(answer: string) {
  const lines = answer.split("\n");
  return SCHOOL_EXAM.map((item, index) => {
    const line = lines.find((row) => row.trim().startsWith(`${index + 1}`)) ?? "";
    const text = line.toLowerCase();
    return { q: item.q, line, pass: item.need.every((word) => text.includes(word)) };
  });
}

const first = await ask("Answer every question.");
let rows = gradeLines(first);
const missed = rows.filter((row) => !row.pass);
let second = "";
if (missed.length) {
  second = await ask("The last try missed some. Answer again, still only from the passages.");
  const retry = gradeLines(second);
  rows = rows.map((row, index) => (row.pass ? row : retry[index]));
}
const passed = rows.filter((row) => row.pass).length;
const out = { firstPassed: SCHOOL_EXAM.length - missed.length, passed, total: SCHOOL_EXAM.length, rows };
writeFileSync("/workspace/data/school/exam-result.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ firstPassed: out.firstPassed, passed, total: out.total, missed: rows.filter((row) => !row.pass).map((row) => row.q) }, null, 2));
