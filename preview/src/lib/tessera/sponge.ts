import { createServerFn } from "@tanstack/react-start";
import { dataPath } from "./data-path.ts";

export function nextSpongeQuery(done: string[], titles: string[]) {
  const asked = done.map((item) => item.toLowerCase());
  for (const title of titles) {
    const name = title.split("·").pop()?.trim() || title.trim();
    if (name.length < 6) continue;
    if (/captcha|password|login/i.test(name)) continue;
    const key = name.toLowerCase();
    if (asked.some((item) => item === key)) continue;
    return name.slice(0, 120);
  }
  return null;
}

async function readPublic(query: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const wiki = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=${encodeURIComponent(query)}`,
      { signal: ctrl.signal, headers: { "User-Agent": "tessera-chamber/1.0", Accept: "application/json" } },
    );
    if (!wiki.ok) return null;
    const found = (await wiki.json()) as [string, string[], string[], string[]];
    const title = found[1]?.[0];
    const url = found[3]?.[0] ?? "";
    if (!title) return null;
    const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "tessera-chamber/1.0", Accept: "application/json" },
    });
    if (!summary.ok) return null;
    const page = (await summary.json()) as { extract?: string };
    const text = (page.extract ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (text.length < 40 || /may refer to/i.test(text)) return null;
    return { title, url, text };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const spongeOnce = createServerFn({ method: "POST" }).handler(async () => {
  const { readFile, appendFile, mkdir } = await import("node:fs/promises");
  await mkdir(dataPath("school"), { recursive: true });
  let titles: string[] = [];
  try {
    titles = (await readFile(dataPath("school", "father-fed.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => (JSON.parse(line) as { q: string }).q);
  } catch {
    titles = [];
  }
  let done: string[] = [];
  try {
    done = (await readFile(dataPath("school", "sponge.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => (JSON.parse(line) as { q: string }).q);
  } catch {
    done = [];
  }
  let page: { title: string; url: string; text: string } | null = null;
  let query = "";
  const tried: string[] = [];
  while (tried.length < 6) {
    const next = nextSpongeQuery([...done, ...tried], titles);
    if (!next) break;
    tried.push(next);
    const found = await readPublic(next);
    if (found) {
      page = found;
      query = next;
      break;
    }
  }
  if (!page || !query) return { ok: false as const, error: "No public page answered for her next titles." };
  const row = { q: query, a: page.text, url: page.url, at: new Date().toISOString() };
  await appendFile(dataPath("school", "sponge.jsonl"), `${JSON.stringify(row)}\n`);
  await appendFile(dataPath("school", "recall-index.jsonl"), `${JSON.stringify({ s: "sponge", t: `${query}. ${page.text}` })}\n`);
  return { ok: true as const, query, text: page.text, url: page.url };
});
