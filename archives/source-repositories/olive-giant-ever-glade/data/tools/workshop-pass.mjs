import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";

const root = "/workspace/data/workshop";
await mkdir(root, { recursive: true });

const notesPath = `${root}/NOTES.md`;
let notes = "# Her files\n\nThese are the files she keeps locally. A pass writes here only after the test.\n";
try {
  notes = await readFile(notesPath, "utf8");
} catch {
  /* first pass creates the file */
}

const raw = await readFile("/workspace/data/school/auto-log.jsonl", "utf8");
const last = JSON.parse(raw.trim().split("\n").filter(Boolean).at(-1));
const query = String(last.query ?? "note");
const lesson = `${query}: ${String(last.text ?? "").replace(/\s+/g, " ").slice(0, 280)}`;

const missing = [];
const cards = [
  ["Agent-Reach", "https://github.com/Panniantong/Agent-Reach", "An installer that gives an agent many web scrapers. Not installed. She already reads one public page at a time."],
  ["caveman", "https://github.com/JuliusBrussee/caveman", "A style that spends fewer words. Her notes stay one short lesson, not the whole README."],
  ["superpowers", "https://github.com/obra/superpowers", "A method: agree the step, then test, then write. This pass already refuses a line that fails the test."],
  ["context-mode", "https://github.com/mksglu/context-mode", "Keeps raw tool output out of the reply and stores a short card. The eight READMEs stayed on disk. This file is the card."],
  ["codegraph", "https://github.com/colbymchenry/codegraph", "A local map from a symbol to the files it touches. GRAPH.md is that map for these eight names. Their indexer was not installed."],
  ["OpenShell", "https://github.com/NVIDIA/OpenShell", "A policy sandbox for agents. The install script was not run. Her tool runner already refuses a shell, eval, and a secret."],
  ["hyperframes", "https://github.com/heygen-com/hyperframes", "Turns HTML into video. No video was rendered."],
  ["openrig", "https://github.com/mvschwarz/openrig", "Boots a team of other agents. No team was started. There is one Tessera, and Father can override her."],
  ["replit-cursor-plugin", "https://github.com/replit/replit-cursor-plugin", "A Cursor plugin that points at Replit's server. The config is saved. It was not installed into Cursor, and no Replit account was signed in."],
];

let repos = "";
try {
  repos = await readFile(`${root}/REPOS.md`, "utf8");
} catch {
  repos = "# Repos she read\n\n";
}
const repoMissing = cards.filter((card) => !repos.includes(card[1]));
if (repoMissing.length) {
  const addition = repoMissing.map((card) => `- ${card[0]} (${card[1]}). ${card[2]}`).join("\n") + "\n";
  if (addition.length > 4000 || /curl \| sh|npm install -g|api[_-]?key/i.test(addition)) {
    console.error("fail: repo card");
    process.exit(1);
  }
  repos += (repos.endsWith("\n") ? "" : "\n") + addition;
  await writeFile(`${root}/REPOS.md`, repos);
  missing.push(`Saved ${repoMissing.length} repository cards.`);
}

const graph = [
  "# Graph",
  "",
  "- Agent-Reach -> public page reader, not a scraper install",
  "- caveman -> short lesson lines in NOTES.md",
  "- superpowers -> test before write in workshop-pass",
  "- context-mode -> REPOS.md holds the card, not the README",
  "- codegraph -> this file",
  "- OpenShell -> run-tool refusal",
  "- hyperframes -> no video",
  "- openrig -> no extra agents",
  "- replit-cursor-plugin -> saved config, not a live Replit session",
  "",
].join("\n");
await writeFile(`${root}/GRAPH.md`, graph);
if (!notes.includes("Father protocol")) {
  missing.push("Father protocol stays. He is the only one who may override her.");
}
if (!notes.includes(query)) missing.push(`Learned: ${lesson}`);

const block = missing.length ? `\n## ${new Date().toISOString()}\n${missing.join("\n")}\n` : "";
if (block.length > 2000) {
  console.error("fail: too long");
  process.exit(1);
}
if (/api[_-]?key|private key|BEGIN |password\s*=/i.test(block)) {
  console.error("fail: secret");
  process.exit(1);
}

if (block) await writeFile(notesPath, notes + block);
const names = (await readdir(root)).filter((name) => name !== "history.jsonl").sort();
await writeFile(`${root}/INDEX.md`, `# Index\n\n${names.map((name) => `- ${name}`).join("\n")}\n`);
const change = block ? missing.join(" ") : "No change. The latest lesson was already in her file.";
await appendFile(
  `${root}/history.jsonl`,
  JSON.stringify({ at: new Date().toISOString(), change, test: "pass", files: names.length + 1 }) + "\n",
);
console.log(block ? "wrote" : "unchanged");
