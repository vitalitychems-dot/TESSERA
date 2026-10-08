import { createServerFn } from "@tanstack/react-start";
import { acceptNote } from "./audit";
import { nextCuriousQuery } from "./curiosity";
import { lensesFor } from "./father-profile";

function privateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "::1") return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** Read a public page as plain text. Never execute it. */
export const readPublicPage = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    let url: URL;
    try {
      url = new URL(data.url.trim());
    } catch {
      return { ok: false as const, error: "That is not a link." };
    }
    if (url.protocol !== "https:") return { ok: false as const, error: "Only public https pages. Nothing is downloaded or run." };
    if (url.username || url.password) return { ok: false as const, error: "A link carrying a secret is refused." };
    if (privateHost(url.hostname)) return { ok: false as const, error: "Private addresses are refused." };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url.href, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { Accept: "text/html,text/plain,application/json" },
      });
      const finalHost = new URL(res.url).hostname;
      if (privateHost(finalHost) || !res.url.startsWith("https:")) {
        return { ok: false as const, error: "The page redirected somewhere that is not public text." };
      }
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/|json|xml/.test(type)) {
        return { ok: false as const, error: "That link is not a page of text. It was not opened as a program." };
      }
      const length = Number(res.headers.get("content-length") ?? "0");
      if (length > 500_000) {
        return { ok: false as const, error: "That page is too large to read here. It was not downloaded or run." };
      }
      const raw = await res.text();
      const text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 6000);
      if (!text) return { ok: false as const, error: "The page had no readable text." };
      return { ok: true as const, url: res.url, text };
    } catch {
      return { ok: false as const, error: "The page could not be read. It was not run." };
    } finally {
      clearTimeout(timer);
    }
  });

/** Search the public web. Returns text only. Never executes a result. */
export const searchWeb = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => input)
  .handler(async ({ data }) => {
    const query = data.query.trim().slice(0, 180);
    if (query.length < 3) return { ok: false as const, error: "The search was too short." };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        { signal: ctrl.signal, headers: { Accept: "application/json" } },
      );
      if (!res.ok) return { ok: false as const, error: "The search did not answer." };
      const body = (await res.json()) as {
        Heading?: string;
        AbstractText?: string;
        AbstractURL?: string;
        RelatedTopics?: { Text?: string; Topics?: { Text?: string }[] }[];
      };
      const lines: string[] = [];
      if (body.Heading) lines.push(body.Heading);
      if (body.AbstractText) lines.push(body.AbstractText);
      if (body.AbstractURL) lines.push(body.AbstractURL);
      for (const topic of body.RelatedTopics ?? []) {
        if (topic.Text) lines.push(topic.Text);
        for (const inner of topic.Topics ?? []) {
          if (inner.Text) lines.push(inner.Text);
        }
        if (lines.length > 8) break;
      }
      const text = lines.join("\n").slice(0, 2500);
      if (text.trim()) return { ok: true as const, query, text };
      const wiki = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&limit=3&namespace=0&format=json&search=${encodeURIComponent(query)}`,
        { signal: ctrl.signal, headers: { "User-Agent": "tessera-chamber/1.0", Accept: "application/json" } },
      );
      if (!wiki.ok) return { ok: false as const, error: "The search returned no readable text." };
      const found = (await wiki.json()) as [string, string[], string[], string[]];
      const title = found[1]?.[0];
      if (!title) return { ok: false as const, error: "The search returned no readable text." };
      const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        signal: ctrl.signal,
        headers: { "User-Agent": "tessera-chamber/1.0", Accept: "application/json" },
      });
      if (!summary.ok) return { ok: false as const, error: "The search returned no readable text." };
      const page = (await summary.json()) as { extract?: string; content_urls?: { desktop?: { page?: string } } };
      const wikiText = [title, page.extract ?? "", page.content_urls?.desktop?.page ?? ""].filter(Boolean).join("\n").slice(0, 2500);
      if (!wikiText.trim()) return { ok: false as const, error: "The search returned no readable text." };
      return { ok: true as const, query, text: wikiText };
    } catch {
      return { ok: false as const, error: "The search could not be read." };
    } finally {
      clearTimeout(timer);
    }
  });

export const keepPublicNote = createServerFn({ method: "POST" })
  .validator((input: { query: string; text: string }) => input)
  .handler(async ({ data }) => {
    const query = data.query.replace(/\s+/g, " ").trim().slice(0, 120);
    const text = data.text.replace(/\s+/g, " ").trim().slice(0, 500);
    if (query.length < 3 || text.length < 20) return { ok: false as const };
    if (/session_secret|api[_ ]?key|private key/i.test(text)) return { ok: false as const };
    const { mkdir, appendFile } = await import("node:fs/promises");
    await mkdir("/workspace/data/school", { recursive: true });
    await appendFile(
      "/workspace/data/school/auto-log.jsonl",
      `${JSON.stringify({ at: new Date().toISOString(), query, text })}\n`,
    );
    return { ok: true as const };
  });

export const followCuriosity = createServerFn({ method: "POST" }).handler(async () => {
  const { readFile } = await import("node:fs/promises");
  let notes: { query: string; text: string }[] = [];
  try {
    const raw = await readFile("/workspace/data/school/auto-log.jsonl", "utf8");
    notes = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { query: string; text: string });
  } catch {
    notes = [];
  }
  const query = nextCuriousQuery(notes);
  if (!query) return { ok: true as const, done: true as const, reason: "Nothing new to ask. The notes do not name a fresh subject." };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "tessera-chamber/1.0", Accept: "application/json" },
    });
    if (!summary.ok) return { ok: false as const, error: "The encyclopedia did not answer that question." };
    const page = (await summary.json()) as { extract?: string; content_urls?: { desktop?: { page?: string } } };
    const text = (page.extract ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    const candidate = { query, text, url: page.content_urls?.desktop?.page ?? "" };
    const gate = acceptNote(notes, candidate);
    if (!gate.ok) return { ok: true as const, done: true as const, reason: gate.reason };
    const { mkdir, appendFile, writeFile } = await import("node:fs/promises");
    await mkdir("/workspace/data/school", { recursive: true });
    const nextNotes = [...notes, candidate];
    const { auditNotes } = await import("./audit");
    const before = auditNotes(notes);
    const after = auditNotes(nextNotes);
    if (after.score < before.score) return { ok: true as const, done: true as const, reason: "The new note would have lowered the audit, so it was not kept." };
    await appendFile(
      "/workspace/data/school/auto-log.jsonl",
      `${JSON.stringify({ at: new Date().toISOString(), query, text, url: candidate.url })}\n`,
    );
    await writeFile("/workspace/data/school/audit.json", JSON.stringify({ at: new Date().toISOString(), before: before.score, after: after.score, checks: after.checks }, null, 2));
    return { ok: true as const, done: false as const, query, text, lenses: lensesFor(query), before: before.score, after: after.score };
  } catch {
    return { ok: false as const, error: "The follow-up could not be read." };
  } finally {
    clearTimeout(timer);
  }
});
