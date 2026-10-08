import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";

const LOG = "/workspace/data/school/auto-log.jsonl";
const AUDIT = "/workspace/data/school/audit.json";
const GAPS = "/workspace/data/school/gaps.txt";
const HOPS = Number(process.argv[2] ?? 3);
const SKIP = /^(the|while|one|his|her|this|that|when|after|from|with|into|over|under)$/i;
const SECRET = /session_secret|api[_ ]?key|private key/i;

function nextQuery(notes, gaps) {
  const asked = new Set([...notes.map((note) => note.query.toLowerCase()), ...gaps]);
  for (const note of [...notes].reverse()) {
    const phrases = note.text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) ?? [];
    for (const phrase of phrases) {
      const key = phrase.toLowerCase();
      if (SKIP.test(phrase.split(" ")[0] ?? "")) continue;
      if ([...asked].some((item) => item === key || item.includes(key) || key.includes(item))) continue;
      if (phrase.length < 8) continue;
      return phrase;
    }
  }
  return null;
}

async function skill(name) {
  const path = "/workspace/data/school/skills.json";
  let book = {};
  try {
    book = JSON.parse(await readFile(path, "utf8"));
  } catch {
    book = {};
  }
  book[name] = (book[name] ?? 0) + 1;
  await mkdir("/workspace/data/school", { recursive: true });
  await writeFile(path, JSON.stringify(book, null, 2));
}

function accept(existing, candidate) {
  const key = candidate.query.trim().toLowerCase();
  if (key.length < 3) return "The question was empty.";
  if (existing.some((note) => note.query.toLowerCase() === key)) return "That question was already kept.";
  if (!existing.some((note) => note.text.includes(candidate.query))) return "The question was not in an earlier note.";
  if (candidate.text.trim().length < 40 || candidate.text.length > 500) return "The passage was the wrong length.";
  if (!candidate.url?.startsWith("https://")) return "The passage had no public link.";
  if (SECRET.test(candidate.text) || SECRET.test(candidate.query)) return "The passage looked like a secret.";
  return null;
}

function score(notes) {
  const keys = notes.map((note) => note.query.toLowerCase());
  const follow = notes.slice(5);
  const checks = [
    new Set(keys).size === keys.length,
    notes.every((note) => (note.url ?? "").startsWith("https://")),
    notes.every((note) => note.text.trim().length >= 40 && note.text.length <= 500),
    notes.every((note) => !SECRET.test(note.text)),
    follow.length === 0 || follow.every((note, index) => notes.slice(0, index + 5).some((earlier) => earlier.text.includes(note.query))),
    (() => {
      const next = nextQuery(notes, []);
      return next === null || !keys.includes(next.toLowerCase());
    })(),
  ];
  return checks.filter(Boolean).length / checks.length;
}

const BLOCKED = /natal|wallet|secret|credential|shepherd-audit|checkout|payment|cipher|sacred-knowledge|psionic|radionic|\.env|api-key/i;

async function load() {
  try {
    const raw = await readFile(LOG, "utf8");
    return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

async function learnLocal(limit) {
  const seenPath = "/workspace/data/school/seen-local.txt";
  const seen = new Set((await readFile(seenPath, "utf8").catch(() => "")).split("\n").filter(Boolean));
  let files = [];
  try {
    files = JSON.parse(await readFile("/workspace/data/ingest/manifest.json", "utf8")).files ?? [];
  } catch {
    return [];
  }
  const added = [];
  let looked = 0;
  for (const file of [...files].reverse()) {
    if (added.length >= limit || looked >= 400) break;
    looked += 1;
    if (!file?.id || seen.has(file.id)) continue;
    if (BLOCKED.test(file.path ?? "") || /package\.json|\.test\.|package-lock|node_modules/i.test(file.path ?? "") || (file.bytes ?? 0) > 80_000 || (file.bytes ?? 0) < 80) {
      seen.add(file.id);
      continue;
    }
    let text = "";
    try {
      text = (await readFile(`/workspace/data/ingest/${file.id}.txt`, "utf8")).replace(/\s+/g, " ").trim().slice(0, 180);
    } catch {
      continue;
    }
    if (text.length < 40 || SECRET.test(text)) {
      seen.add(file.id);
      continue;
    }
    added.push(`${file.repo}/${file.path}: ${text}`);
    seen.add(file.id);
  }
  await mkdir("/workspace/data/school", { recursive: true });
  if (added.length) {
    await appendFile("/workspace/data/school/local.txt", `${added.join("\n")}\n`);
    await skill("read-a-saved-file");
  }
  await writeFile(seenPath, `${[...seen].join("\n")}\n`);
  return added;
}

async function writeBrief(notes) {
  const local = (await readFile("/workspace/data/school/local.txt", "utf8").catch(() => "")).trim().split("\n").filter(Boolean).slice(-8);
  const lines = notes.slice(-24).map((note) => `${note.query}: ${String(note.text).slice(0, 140)}`);
  await writeFile("/workspace/data/school/brief.txt", [...lines, ...local].join("\n"));
}

function nextQueries(notes, gaps, count) {
  if (count < 1) return [];
  const asked = new Set([...notes.map((note) => note.query.toLowerCase()), ...gaps]);
  const found = [];
  for (const note of [...notes].reverse()) {
    const phrases = note.text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) ?? [];
    for (const phrase of phrases) {
      const key = phrase.toLowerCase();
      if (SKIP.test(phrase.split(" ")[0] ?? "")) continue;
      if ([...asked].some((item) => item === key || item.includes(key) || key.includes(item))) continue;
      if (phrase.length < 8) continue;
      asked.add(key);
      found.push(phrase);
      if (found.length >= count) return found;
    }
  }
  return found;
}

async function fetchPage(query) {
  const headers = { "User-Agent": "tessera-chamber/1.0", Accept: "application/json" };
  let res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { headers });
  if (res.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { headers });
  }
  if (!res.ok) return { query, status: res.status };
  const page = await res.json();
  return {
    query,
    status: 200,
    text: String(page.extract ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
    url: page.content_urls?.desktop?.page ?? "",
  };
}

const kept = [];
const started = Date.now();
let notes = await load();
const localAdded = await learnLocal(8);
const gaps = new Set(
  (await readFile(GAPS, "utf8").catch(() => "")).trim().split("\n").filter(Boolean).map((line) => line.toLowerCase()),
);
const queries = nextQueries(notes, gaps, HOPS);
const pages = [];
for (const query of queries) pages.push(await fetchPage(query));
await mkdir("/workspace/data/school", { recursive: true });
for (const page of pages) {
  if (page.status !== 200) {
    if (page.status === 429) {
      console.log(JSON.stringify({ query: page.query, wait: 429 }));
      continue;
    }
    await appendFile(GAPS, `${page.query}\n`);
    gaps.add(page.query.toLowerCase());
    console.log(JSON.stringify({ query: page.query, gap: page.status }));
    if (page.status === 404) await skill("mark-a-miss");
    continue;
  }
  const candidate = { query: page.query, text: page.text, url: page.url };
  const reason = accept(notes, candidate);
  if (reason) {
    await appendFile(GAPS, `${page.query}\n`);
    gaps.add(page.query.toLowerCase());
    console.log(JSON.stringify({ query: page.query, gap: reason }));
    continue;
  }
  const before = score(notes);
  const after = score([...notes, candidate]);
  if (after < before) {
    await appendFile(GAPS, `${page.query}\n`);
    gaps.add(page.query.toLowerCase());
    continue;
  }
  const row = { at: new Date().toISOString(), ...candidate };
  await appendFile(LOG, `${JSON.stringify(row)}\n`);
  await appendFile("/workspace/data/school/retained.txt", `${candidate.query}: ${candidate.text.slice(0, 160)}\n`);
  notes = [...notes, candidate];
  kept.push({ query: page.query, before, after });
  await skill("keep-a-grounded-note");
  console.log(JSON.stringify({ kept: page.query, before, after }));
}
async function agentPass(notes, gaps) {
  const plan = nextQueries(notes, gaps, 3);
  await writeFile("/workspace/data/school/agent-plan.txt", plan.join("\n"));
  await skill("plan-the-next-questions");
  const held = score(notes);
  await writeFile("/workspace/data/school/agent-check.txt", `score ${held} on ${notes.length} notes`);
  await skill("check-what-she-holds");
  const newest = notes[notes.length - 1];
  const word = newest?.query?.split(" ").find((part) => part.length > 4) ?? "";
  let recalled = "";
  if (word) {
    let files = [];
    try {
      files = JSON.parse(await readFile("/workspace/data/ingest/manifest.json", "utf8")).files ?? [];
    } catch {
      files = [];
    }
    const seen = new Set((await readFile("/workspace/data/school/seen-local.txt", "utf8").catch(() => "")).split("\n"));
    for (const file of [...files].reverse()) {
      if (!file?.id || seen.has(file.id)) continue;
      if (BLOCKED.test(file.path ?? "") || /package\.json|\.test\.|package-lock|node_modules/i.test(file.path ?? "")) continue;
      if (!String(file.path).toLowerCase().includes(word.toLowerCase())) continue;
      if ((file.bytes ?? 0) > 80_000) continue;
      const text = (await readFile(`/workspace/data/ingest/${file.id}.txt`, "utf8").catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 180);
      if (text.length < 40 || SECRET.test(text)) continue;
      recalled = `${file.repo}/${file.path}: ${text}`;
      await appendFile("/workspace/data/school/local.txt", `${recalled}\n`);
      await skill("recall-a-saved-file");
      break;
    }
  }
  return { plan, held, recalled: Boolean(recalled) };
}
const agent = await agentPass(notes, gaps);
await writeBrief(notes);
await writeFile(AUDIT, JSON.stringify({ at: new Date().toISOString(), kept, local: localAdded.length, agent, ms: Date.now() - started }, null, 2));
console.log(JSON.stringify({ added: kept.length, local: localAdded.length, notes: notes.length, agent, ms: Date.now() - started }));
