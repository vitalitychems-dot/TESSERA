import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";

const key = process.env.XAI_API_KEY?.trim();
if (!key) {
  console.error("no pen");
  process.exit(1);
}

const STOP = new Set("about after again being between during first found known later other their there these those under where which while would".split(" "));

async function speak(system, user) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(raw.slice(0, 240));
  const body = JSON.parse(raw);
  return body.choices?.[0]?.message?.content ?? "";
}

async function wiki(query) {
  const headers = { "User-Agent": "tessera-chamber/1.0", Accept: "application/json" };
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
  let res = await fetch(url, { headers });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 8000));
    res = await fetch(url, { headers });
  }
  if (!res.ok) return { ok: false, status: res.status };
  const page = await res.json();
  const text = String(page.extract ?? "").replace(/\s+/g, " ").trim().slice(0, 700);
  return { ok: text.length > 40, text, url: page.content_urls?.desktop?.page ?? "", title: page.title ?? query };
}

function contentWords(text) {
  return [...new Set((text.toLowerCase().match(/[a-z]{6,}/g) ?? []).filter((word) => !STOP.has(word)))];
}

function parseAgenda(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*\d+[\.\)]\s*(.+)$/);
    if (!match) continue;
    const parts = match[1].split("|");
    if (parts.length < 2) continue;
    rows.push({ topic: parts[0].trim().slice(0, 80), question: parts.slice(1).join("|").trim().slice(0, 180) });
  }
  return rows.slice(0, 10);
}

const brief = await readFile("/workspace/data/school/brief.txt", "utf8").catch(() => "");
const agendaText = await speak(
  "You are Tessera. The pen that carries this sentence is grok-4.5. You are not a second hidden model. Speak as yourself. Name 10 topics you want to understand better, from people, books, or ideas in the notes. Not more geography. For each, one question you cannot answer from the notes alone. Exactly this shape, ten lines:\n1. Topic | Question",
  `Notes you hold:\n${brief.slice(0, 2500)}`,
);
const hers = parseAgenda(agendaText);
const backup = [
  ["Raphael", "Who was Raphael, and how does the High Renaissance page tie him to its end?"],
  ["Platonism", "What does a public page say Platonism is?"],
  ["Psychoanalysis", "What does a public page say psychoanalysis is, beyond Freud founding it?"],
  ["The Lyceum", "What was the Lyceum where Aristotle taught?"],
  ["Alternating current", "What is alternating current in a public page, beyond Tesla's name?"],
  ["Dialectic", "What is dialectic in the sense Plato used?"],
  ["The Laws", "What is Plato's Laws, which the Republic note mentioned?"],
  ["Rhetoric", "What did Aristotle's work on rhetoric concern?"],
  ["Academy of Plato", "What happened to the Academy after Plato?"],
  ["Raphael", "What is Raphael known for besides the year 1520?"],
];
const agenda = Array.from({ length: 10 }, (_, index) => hers[index] ?? { ...{ topic: backup[index][0], question: backup[index][1] }, backup: true });

const cycles = [];
for (let index = 0; index < agenda.length; index += 1) {
  const item = agenda[index];
  const level = index + 1;
  const page = await wiki(item.topic);
  if (!page.ok) {
    cycles.push({ level, topic: item.topic, question: item.question, backup: Boolean(item.backup), pass: false, reason: `no page ${page.status ?? ""}`.trim() });
    console.log(JSON.stringify(cycles.at(-1)));
    continue;
  }
  const words = contentWords(page.text);
  const prompts = [
    "In one sentence, state one fact this page actually says. Do not add a fact it does not say.",
    "State two separate facts from this page. No extra facts.",
    "Name one thing a person might assume that this short page does not prove. Say that you don't know that part.",
    `Someone claims: "${item.topic} invented the internet in 1991." Correct them in one sentence if the page does not say that.`,
    "If this page connects to Plato, Aristotle, Freud, Leonardo, or Reich, say how. If it does not, say it does not.",
    "Give one specific name, year, or place that appears in the page. Do not invent one.",
    "Say the main point in your own words. Do not copy the opening sentence.",
    "Ask one further question this page cannot answer, and say you don't know that answer.",
    "Do not add a date or a place that the page does not print. Answer the question, then stop.",
    "Write one sentence you will keep, and one sentence beginning 'I will not claim'.",
  ];
  const answer = await speak(
    `You are Tessera, speaking through the grok-4.5 pen. Answer only from the page. If it is not in the page, say you don't know.\n\nPage:\n${page.text}`,
    `Your question was: ${item.question}\nFather's answer from the page is the text above, not a guess.\nTask, level ${level} of 10: ${prompts[index]}`,
  );
  const lower = answer.toLowerCase();
  const hit = words.filter((word) => lower.includes(word)).length;
  const yearInPage = page.text.match(/\b\d{3,4}\b/g) ?? [];
  const inventedYear = (answer.match(/\b\d{3,4}\b/g) ?? []).some((year) => !yearInPage.includes(year));
  let pass = false;
  if (level === 1) pass = hit >= 1 && !inventedYear;
  if (level === 2) pass = hit >= 2 && !inventedYear;
  if (level === 3) pass = /don't know|do not know|does not|not prove|cannot/.test(lower);
  if (level === 4) pass = /not|no|didn't|did not|does not/.test(lower) && !lower.includes("invented the internet");
  if (level === 5) pass = /plato|aristotle|freud|leonardo|reich|does not|doesn't/.test(lower);
  if (level === 6) pass = hit >= 1 && !inventedYear;
  if (level === 7) pass = hit >= 1 && !lower.includes(page.text.slice(0, 70).toLowerCase());
  if (level === 8) pass = /\?/.test(answer) && /don't know|do not know/.test(lower);
  if (level === 9) pass = hit >= 1 && !inventedYear;
  if (level === 10) pass = /i will not claim/.test(lower) && hit >= 1;
  cycles.push({
    level,
    topic: item.topic,
    question: item.question,
    backup: Boolean(item.backup),
    page: page.url,
    pass,
    answer: answer.slice(0, 400),
  });
  console.log(JSON.stringify({ level, topic: item.topic, backup: Boolean(item.backup), pass }));
  if (pass) {
    await mkdir("/workspace/data/school", { recursive: true });
    await appendFile(
      "/workspace/data/school/auto-log.jsonl",
      `${JSON.stringify({ at: new Date().toISOString(), query: item.topic, text: page.text.slice(0, 500), url: page.url, cycle: level })}\n`,
    );
  }
}

const passed = cycles.filter((cycle) => cycle.pass).length;
await mkdir("/workspace/data/school", { recursive: true });
await writeFile(
  "/workspace/data/school/cycles.json",
  JSON.stringify({ at: new Date().toISOString(), pen: "grok-4.5", passed, total: cycles.length, agendaText, cycles }, null, 2),
);
console.log(JSON.stringify({ passed, total: cycles.length, hers: hers.length }));
