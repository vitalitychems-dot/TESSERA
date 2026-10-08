// Tessera research collector.
//
// Purpose: gather free, public research into a local study-notes index that
// Tessera's chat can retrieve and cite. Sources are the same kind of public
// material any AI lab reads: arXiv, PubMed, Wikipedia, and public research
// blogs (Google DeepMind, Meta AI, Harvard). Topics follow the owner's
// direction: CL1 / biological computing, connectomics (fly brain, synapses),
// and public work from Google, Meta, and Harvard.
//
// Hard rules:
//   * Public sources only. No vault, wallet, customer, or private-repo reads.
//   * This is reading, not training. It never changes model weights and never
//     claims to. Notes are stored with source URLs so Tessera must cite them.
//   * Fail honestly: every fetch error is recorded as a skip, never hidden.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dataPath } from "./app-path.mjs";

const INDEX = dataPath("knowledge", "index.json");
const MAX_NOTES = 500;
const SUMMARY_MAX = 1200;
const NEW_PER_PASS = 20;
const PASS_DELAY_MS = 30 * 60 * 1000; // 30 minutes between passes

const ARXIV_QUERIES = [
  "cortical+labs+CL1+biological+computer",
  "Drosophila+connectome+synapse",
  "organoid+intelligence",
  "neuromorphic+computing",
];
const PUBMED_QUERIES = [
  "Drosophila connectome synapse",
  "brain organoid computing",
];
const WIKI_TOPICS = [
  "Cortical Labs",
  "Connectome",
  "FlyWire",
  "Drosophila connectome",
  "Google DeepMind",
  "Meta AI",
  "Harvard John A. Paulson School of Engineering and Applied Sciences",
  "Neuromorphic computing",
  "Synapse",
];
const RSS_FEEDS = [
  { source: "Google DeepMind blog", url: "https://deepmind.google/blog/rss.xml" },
  { source: "Meta AI blog", url: "https://ai.meta.com/blog/rss/" },
  { source: "Harvard Gazette", url: "https://news.harvard.edu/gazette/feed/" },
];
const UA = {
  "User-Agent": "tessera-research-collector/1.0 (public sources only)",
  Accept: "application/json, application/atom+xml, application/rss+xml, text/xml, */*;q=0.8",
};

let stop = false;
process.on("SIGTERM", () => {
  stop = true;
});

async function loadIndex() {
  try {
    const parsed = JSON.parse(await readFile(INDEX, "utf8"));
    return { updated: parsed.updated ?? null, notes: Array.isArray(parsed.notes) ? parsed.notes : [], skipped: Array.isArray(parsed.skipped) ? parsed.skipped.slice(-100) : [] };
  } catch {
    return { updated: null, notes: [], skipped: [] };
  }
}

async function saveIndex(index) {
  await mkdir(dataPath("knowledge"), { recursive: true });
  index.updated = new Date().toISOString();
  index.notes = index.notes.slice(-MAX_NOTES);
  await writeFile(INDEX, JSON.stringify(index, null, 2));
}

function addNote(index, { title, source, url, summary, tags }) {
  if (!title || !url) return false;
  const id = createHash("sha256").update(url).digest("hex").slice(0, 16);
  if (index.notes.some((n) => n.id === id)) return false;
  index.notes.push({
    id,
    title: title.trim().slice(0, 200),
    source,
    url,
    summary: String(summary ?? "").replace(/\s+/g, " ").trim().slice(0, SUMMARY_MAX),
    tags: tags ?? [],
    at: new Date().toISOString(),
  });
  return true;
}

function skip(index, source, reason) {
  index.skipped.push({ at: new Date().toISOString(), source, reason: String(reason).slice(0, 200) });
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function decodeEntities(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function matchAll(text, regex) {
  const out = [];
  let m;
  while ((m = regex.exec(text)) !== null) out.push(m);
  return out;
}

async function collectArxiv(index, added) {
  for (const q of ARXIV_QUERIES) {
    if (stop || added.count >= NEW_PER_PASS) return;
    try {
      const xml = await fetchText(
        `https://export.arxiv.org/api/query?search_query=all:${q}&start=0&max_results=4&sortBy=submittedDate&sortOrder=descending`,
      );
      for (const entry of matchAll(xml, /<entry>([\s\S]*?)<\/entry>/g)) {
        if (added.count >= NEW_PER_PASS) break;
        const body = entry[1];
        const title = decodeEntities(/<title>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? "");
        const url = /<id>([\s\S]*?)<\/id>/.exec(body)?.[1]?.trim() ?? "";
        const summary = decodeEntities(/<summary>([\s\S]*?)<\/summary>/.exec(body)?.[1] ?? "");
        if (addNote(index, { title, source: "arXiv", url, summary, tags: q.split("+") })) added.count += 1;
      }
    } catch (error) {
      skip(index, `arXiv:${q}`, error instanceof Error ? error.message : error);
    }
  }
}

async function collectPubmed(index, added) {
  for (const q of PUBMED_QUERIES) {
    if (stop || added.count >= NEW_PER_PASS) return;
    try {
      const search = JSON.parse(await fetchText(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&sort=date&term=${encodeURIComponent(q)}`,
      ));
      const ids = search?.esearchresult?.idlist ?? [];
      if (ids.length === 0) continue;
      const summaries = JSON.parse(await fetchText(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`,
      ));
      for (const id of ids) {
        if (added.count >= NEW_PER_PASS) break;
        const rec = summaries?.result?.[id];
        if (!rec?.title) continue;
        if (addNote(index, {
          title: decodeEntities(rec.title),
          source: "PubMed",
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
          summary: `PubMed record (${rec.source ?? "journal"}, ${rec.pubdate ?? "date unknown"}).`,
          tags: q.split(" "),
        })) added.count += 1;
      }
    } catch (error) {
      skip(index, `PubMed:${q}`, error instanceof Error ? error.message : error);
    }
  }
}

async function collectWikipedia(index, added, pass) {
  // Rotate topics so each pass studies a few subjects instead of hammering all.
  const topics = WIKI_TOPICS.filter((_, i) => i % 3 === pass % 3);
  for (const topic of topics) {
    if (stop || added.count >= NEW_PER_PASS) return;
    try {
      const search = JSON.parse(await fetchText(
        `https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=${encodeURIComponent(topic)}`,
      ));
      const title = search?.[1]?.[0];
      if (!title) continue;
      const page = JSON.parse(await fetchText(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      ));
      if (addNote(index, {
        title,
        source: "Wikipedia",
        url: page?.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        summary: page?.extract ?? "",
        tags: topic.toLowerCase().split(" "),
      })) added.count += 1;
    } catch (error) {
      skip(index, `Wikipedia:${topic}`, error instanceof Error ? error.message : error);
    }
  }
}

async function collectRss(index, added) {
  for (const feed of RSS_FEEDS) {
    if (stop || added.count >= NEW_PER_PASS) return;
    try {
      const xml = await fetchText(feed.url);
      const items = matchAll(xml, /<item>([\s\S]*?)<\/item>/g);
      const entries = items.length > 0 ? items : matchAll(xml, /<entry>([\s\S]*?)<\/entry>/g);
      for (const item of entries.slice(0, 3)) {
        if (added.count >= NEW_PER_PASS) break;
        const body = item[1];
        const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? "");
        const linkRaw = /<link[^>]*>([\s\S]*?)<\/link>/.exec(body)?.[1]
          ?? /<link[^>]*href="([^"]+)"/.exec(body)?.[1]
          ?? "";
        const summary = decodeEntities(/<(?:description|summary)[^>]*>([\s\S]*?)<\/(?:description|summary)>/.exec(body)?.[1] ?? "");
        if (addNote(index, { title, source: feed.source, url: linkRaw.trim(), summary })) added.count += 1;
      }
    } catch (error) {
      skip(index, feed.source, error instanceof Error ? error.message : error);
    }
  }
}

async function onePass(pass) {
  const index = await loadIndex();
  const added = { count: 0 };
  await collectArxiv(index, added);
  await collectPubmed(index, added);
  await collectWikipedia(index, added, pass);
  await collectRss(index, added);
  await saveIndex(index);
  console.log(
    `Research pass ${pass}: ${added.count} new public notes, ${index.notes.length} held. ` +
    `Sources: arXiv, PubMed, Wikipedia, DeepMind/Meta/Harvard blogs. Reading, not training. ` +
    `Vault and wallets untouched. Next pass in 30 minutes.`,
  );
}

let pass = 0;
while (!stop) {
  pass += 1;
  try {
    await onePass(pass);
  } catch (error) {
    console.error("research pass failed:", error instanceof Error ? error.message : error);
  }
  for (let i = 0; i < PASS_DELAY_MS / 5000 && !stop; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
