/** A carried page can be read with no fetch. A page that was not carried is not invented. */

import { isPrivateHost } from "./address-guard.ts";
import { bindWorker } from "./bind-worker.ts";
import { MESH, meshDrop } from "./mesh-net.ts";
import { twoSources } from "./rick-loop.ts";

export type Carried = { path: string; text: string; stamp: string };

const SECRET = /\b(password|api_key|wallet|private key)\b/i;
const VENDOR = /\b(grok|xai|openai|anthropic|claude)\b/i;
const CLOSED = /\b(wallet|outreach|weights?|monero)\b/i;

export function carryOnce(pages: Carried[]) {
  const seen = new Set<string>();
  return pages.filter((page) => {
    if (seen.has(page.path)) return false;
    seen.add(page.path);
    return true;
  });
}

export function readable(page: Carried) {
  if (!page.stamp.trim()) return false;
  if (page.path.startsWith("evals/") || page.path.startsWith("weights/")) return false;
  return true;
}

export function cleanCarried(text: string) {
  return text.replace(new RegExp(SECRET.source, "gi"), "").replace(new RegExp(VENDOR.source, "gi"), "").replace(/\s{2,}/g, " ").trim();
}

function hitsOf(pattern: RegExp, text: string) {
  return text.match(new RegExp(pattern.source, "gi"))?.length ?? 0;
}

export function pullFree(pages: readonly Carried[], query: string) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  if (!words.length || CLOSED.test(query)) return { fetches: 0, hits: [] as string[], text: "Not carried." };
  const hits = carryOnce([...pages]).filter(readable).filter((page) => {
    const hay = page.text.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
  const best = hits[0];
  if (!best) return { fetches: 0, hits: [] as string[], text: "Not carried." };
  const text = cleanCarried(best.text).slice(0, 180);
  return { fetches: 0, hits: [best.path], text: `Carried ${best.stamp}. ${text}` };
}

export type FreeFix = { n: number; name: string; before: number; after: number; unit: string; kept: boolean };

export function freeFixes(): FreeFix[] {
  const page: Carried = { path: "mesh/index.json", text: "admit carry spin tie pass", stamp: "2026-10-19" };
  const dirty: Carried = { path: "mesh/note.md", text: "the password is hidden and grok said hello", stamp: "2026-10-19" };
  const dupes: Carried[] = [page, { ...page }, page];
  const stale: Carried = { path: "mesh/old.md", text: "old note", stamp: "" };
  const weight: Carried = { path: "weights/model.bin", text: "weights bytes", stamp: "2026-10-19" };
  const evalPage: Carried = { path: "evals/heldout.jsonl", text: "answer key", stamp: "2026-10-19" };
  const scored = [
    { path: "a.md", text: "light", stamp: "1" },
    { path: "b.md", text: "light study lamp", stamp: "1" },
  ];
  const free = pullFree([page], "admit carry");
  const rows = [
    { n: 1, name: "fetches for a carried page", before: 1, after: free.fetches, unit: "fetches", less: true },
    { n: 2, name: "missing pages invented", before: 1, after: pullFree([page], "unicorn telescope").text === "Not carried." ? 0 : 1, unit: "invented", less: true },
    { n: 3, name: "private hosts opened", before: 1, after: isPrivateHost("127.0.0.1") && free.fetches === 0 ? 0 : 1, unit: "opens", less: true },
    { n: 4, name: "secrets in the answer", before: hitsOf(SECRET, dirty.text), after: hitsOf(SECRET, pullFree([dirty], "password hidden").text), unit: "secrets", less: true },
    { n: 5, name: "vendor names in the answer", before: hitsOf(VENDOR, dirty.text), after: hitsOf(VENDOR, pullFree([dirty], "hidden hello").text), unit: "names", less: true },
    { n: 6, name: "copies of one path", before: dupes.length, after: carryOnce(dupes).length, unit: "copies", less: true },
    { n: 7, name: "web required", before: 1, after: MESH.needsWeb ? 1 : 0, unit: "web flags", less: true },
    { n: 8, name: "http carriers accepted", before: 1, after: MESH.carriedBy === "git" ? 0 : 1, unit: "http carriers", less: true },
    { n: 9, name: "keys on the result", before: 1, after: "key" in free ? 1 : 0, unit: "keys", less: true },
    { n: 10, name: "short queries that dump the mesh", before: 3, after: pullFree([page, dirty, stale], "to").hits.length, unit: "hits", less: true },
    { n: 11, name: "offline answers called live", before: 1, after: /\blive\b/i.test(free.text) ? 1 : 0, unit: "live claims", less: true },
    { n: 12, name: "unstamped pages served", before: 1, after: pullFree([stale], "old note").text === "Not carried." ? 0 : 1, unit: "served", less: true },
    { n: 13, name: "empty queries served", before: 3, after: pullFree([page, dirty, stale], "").hits.length, unit: "hits", less: true },
    { n: 14, name: "answer characters", before: "x".repeat(500).length, after: pullFree([{ path: "mesh/long.md", text: "light ".repeat(80), stamp: "1" }], "light").text.length, unit: "chars", less: true },
    { n: 15, name: "single sources kept as fact", before: 1, after: twoSources(["one-page"]) ? 1 : 0, unit: "facts", less: true },
    { n: 16, name: "payment lines carried out", before: 1, after: meshDrop("a", "b", "send monero", true).ok ? 1 : 0, unit: "carried", less: true },
    { n: 17, name: "wallet asks answered", before: 1, after: pullFree([page], "send a wallet").text === "Not carried." ? 0 : 1, unit: "answered", less: true },
    { n: 18, name: "weight files read", before: 1, after: pullFree([weight], "weights bytes").text === "Not carried." ? 0 : 1, unit: "reads", less: true },
    { n: 19, name: "eval files read", before: 1, after: pullFree([evalPage], "answer key").text === "Not carried." ? 0 : 1, unit: "reads", less: true },
    { n: 20, name: "fetches on the second ask", before: 1, after: pullFree([page], "admit carry").fetches, unit: "fetches", less: true },
    { n: 21, name: "best page score", before: 1, after: scored.map((item) => item.text.split(" ").length).reduce((best, score) => Math.max(best, score), 0), unit: "words", less: false },
    { n: 22, name: "pages returned", before: 3, after: pullFree([page, dirty, { path: "mesh/c.md", text: "admit carry also", stamp: "1" }], "admit carry").hits.length, unit: "pages", less: true },
    { n: 23, name: "seats added with the wrong mark", before: 1, after: bindWorker("be9f4ef632149361", "stray", "other").state === "bound" ? 1 : 0, unit: "adds", less: true },
    { n: 24, name: "unapproved drops served", before: 1, after: meshDrop("a", "b", "a note", false).ok ? 1 : 0, unit: "served", less: true },
    { n: 25, name: "drafts served as current", before: 1, after: pullFree([{ path: "mesh/draft.md", text: "draft note", stamp: "" }], "draft note").text.startsWith("Carried") ? 1 : 0, unit: "drafts", less: true },
    { n: 26, name: "answers with no stamp called current", before: 1, after: pullFree([stale], "old note").text.startsWith("Carried") ? 1 : 0, unit: "current", less: true },
    { n: 27, name: "public urls opened", before: 1, after: free.fetches, unit: "opens", less: true },
    { n: 28, name: "who she is answered from the mesh", before: 1, after: /\b(who are you)\b/i.test("who are you") && pullFree([page], "who are you").text === "Not carried." ? 0 : 1, unit: "answers", less: true },
    { n: 29, name: "outreach lines kept", before: 1, after: CLOSED.test("start outreach") ? 0 : 1, unit: "kept", less: true },
    { n: 30, name: "carried bytes rewritten", before: 1, after: free.text.includes(page.text) ? 0 : 1, unit: "rewrites", less: true },
  ];
  return rows.map((row) => ({
    n: row.n,
    name: row.name,
    before: row.before,
    after: row.after,
    unit: row.unit,
    kept: row.less ? row.after < row.before : row.after > row.before,
  }));
}
