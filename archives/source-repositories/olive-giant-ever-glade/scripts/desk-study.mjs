import { appendFile, mkdir } from "node:fs/promises";

const file = "/workspace/data/school/desk-study.jsonl";
const titles = [
  "Chicago",
  "Wilhelm Reich",
  "Vatican Apostolic Archive",
  "Hermeticism",
  "Nikola Tesla",
  "Wilhelm_Reich",
];

async function once(title) {
  const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: { "User-Agent": "tessera-chamber/1.0", Accept: "application/json" },
  });
  if (!summary.ok) return;
  const page = await summary.json();
  const text = String(page.extract ?? "").replace(/\s+/g, " ").slice(0, 400);
  if (!text) return;
  const row = {
    at: new Date().toISOString(),
    query: title.replaceAll("_", " "),
    url: page.content_urls?.desktop?.page ?? "",
    text,
  };
  await appendFile(file, `${JSON.stringify(row)}\n`);
}

await mkdir("/workspace/data/school", { recursive: true });
let n = 0;
while (n < 48) {
  try {
    await once(titles[n % titles.length]);
  } catch {
    /* a missed page is skipped */
  }
  n += 1;
  await new Promise((resolve) => setTimeout(resolve, 60000));
}
