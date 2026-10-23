#!/usr/bin/env node
// Metadata-only intake. Never clones, installs, executes, or sends content to an LLM.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function parseRepositories(text) {
  if (Buffer.byteLength(text) > 100_000) throw new Error("Repository list exceeds 100 KB");
  const entries = new Map();
  let category = "analysis toolkit";
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^- \[ \]\s*(.+)$/);
    if (heading) category = heading[1].trim().slice(0, 100);
    for (const token of line.match(/https?:\/\/[^\s]+/g) ?? []) {
      const url = new URL(token);
      if (url.protocol !== "https:" || url.hostname !== "github.com" ||
          url.port || url.username || url.password || url.search || url.hash) {
        throw new Error("Only plain HTTPS GitHub repository URLs are allowed");
      }
      const match = url.pathname.match(/^\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+?)\/?$/);
      if (!match) throw new Error("Expected an owner/repository URL");
      const name = `${match[1]}/${match[2].replace(/\.git$/, "")}`;
      if (name.endsWith("/.") || name.endsWith("/..")) throw new Error("Invalid repository");
      const key = name.toLowerCase();
      const entry = entries.get(key) ?? {
        repository: name, url: `https://github.com/${name}`, categories: [],
        mentions: 0, installed: false, executed: false,
        evidence: "user-supplied-reference", sourceCodeRead: false,
      };
      entry.mentions++;
      if (!entry.categories.includes(category)) entry.categories.push(category);
      entries.set(key, entry);
    }
  }
  if (entries.size > 100) throw new Error("At most 100 repositories per intake");
  return [...entries.values()];
}

async function boundedJson(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 128_000) throw new Error("Metadata exceeds 128 KB");
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function inspectRepository(entry, fetchImpl = fetch) {
  const api = `https://api.github.com/repos/${entry.repository}`;
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(api, {
      redirect: "manual", signal: AbortSignal.timeout(15_000),
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return { ...entry, checkedAt, api, status: `http-${response.status}` };
    const data = await boundedJson(response);
    if (typeof data.full_name !== "string" ||
        data.full_name.toLowerCase() !== entry.repository.toLowerCase()) {
      throw new Error("Repository identity mismatch");
    }
    return {
      ...entry, checkedAt, api, status: "metadata-read",
      evidence: "github-metadata-only",
      description: typeof data.description === "string" ? data.description.slice(0, 1500) : "",
      defaultBranch: typeof data.default_branch === "string" ? data.default_branch : null,
      license: typeof data.license?.spdx_id === "string" ? data.license.spdx_id : "unknown",
      // GitHub's label is not a license compatibility or dependency review.
      licenseReviewed: false, archived: data.archived === true,
      topics: Array.isArray(data.topics) ? data.topics.filter(t => typeof t === "string").slice(0, 30) : [],
    };
  } catch (error) {
    return { ...entry, checkedAt, api, status: "unavailable", error: error.name };
  }
}

export function recall(catalog, query, limit = 5) {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9_-]{2,}/g) ?? [])];
  return catalog.repositories.map(entry => {
    const text = [entry.repository, entry.description, ...entry.categories, ...(entry.topics ?? [])].join(" ").toLowerCase();
    return { ...entry, score: terms.filter(term => text.includes(term)).length };
  }).filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.repository.localeCompare(b.repository))
    .slice(0, Math.max(1, Math.min(20, limit)));
}

async function main() {
  const [command, file, ...terms] = process.argv.slice(2);
  if (command === "recall" && file && terms.length) {
    const catalog = JSON.parse(await readFile(file, "utf8"));
    console.log(JSON.stringify({
      mode: "offline-reference-lookup", notExecutionApproval: true,
      results: recall(catalog, terms.join(" ")),
    }, null, 2));
    return;
  }
  if (command !== "intake" || !file) throw new Error(
    "Usage: node scripts/repository-context.mjs intake LIST.txt | recall CATALOG.json QUERY");
  const entries = parseRepositories(await readFile(file, "utf8"));
  const repositories = [];
  let rateLimited = false;
  for (const entry of entries) {
    const result = rateLimited ? { ...entry, status: "not-checked-rate-limit" } : await inspectRepository(entry);
    repositories.push(result);
    console.error(`${entry.repository}: ${result.status}`);
    if (["http-403", "http-429"].includes(result.status)) rateLimited = true;
  }
  const output = "docs/repo-intake/catalog.json";
  await mkdir("docs/repo-intake", { recursive: true });
  await writeFile(output, JSON.stringify({
    version: 1, generatedAt: new Date().toISOString(),
    scope: "Public repository metadata only; no REA execution, model training, code ingestion, or runtime registration.",
    repositories,
  }, null, 2) + "\n");
  console.log(`${repositories.length} unique repositories written to ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
