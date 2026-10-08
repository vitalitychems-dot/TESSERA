import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const REPOS = [
  "Everything",
  "TX",
  "tessera-grok-handoff",
  "tessera-grok-handoff-complete",
  "tessera-complete-archives",
  "TESS",
  "T44",
  "Grok-ready",
  "1",
  "1T",
  "5t",
  "tessera-unified",
];
const ROOT = "/workspace/data/ingest";
const MANIFEST = `${ROOT}/manifest.json`;
const SKIP = /node_modules|\.git\/|natal|income|wallet|secret|storefront|vitality|customer|checkout|payment|wholesale|shepherd-audit|audit-manifest|\.local-data|attached_assets|\.agents\/skills|projects\/|artifacts\/vitality|modal\/|\.(png|jpe?g|gif|webp|zip|mp4|woff2?|pdf|pack|xsd)$/i;
const SECRET = /session_secret|private key|api[_-]?key\s*[:=]|begin [a-z ]*private key/i;

async function load() {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return { updated: null, files: [], skipped: [], remaining: null, note: "" };
  }
}

async function save(manifest) {
  await mkdir(ROOT, { recursive: true });
  manifest.updated = new Date().toISOString();
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
}

async function github(url) {
  const route = url.replace("https://api.github.com/", "");
  try {
    const { stdout } = await execFileAsync("gh", ["api", route], { maxBuffer: 64 * 1024 * 1024 });
    return { ok: true, status: 200, json: async () => JSON.parse(stdout) };
  } catch (error) {
    const text = String(error.stderr || error.message || "");
    const status = Number(/HTTP (\d+)/.exec(text)?.[1] || 0);
    if (status === 403 || status === 429) return { ok: false, status, json: async () => ({}) };
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "tessera-worker", Accept: "application/vnd.github+json" },
    });
    if (res.status === 429) return { ok: false, status: 429, json: async () => ({}) };
    if (!res.ok) return { ok: false, status: res.status, json: async () => ({}) };
    const body = await res.json();
    return { ok: true, status: 200, json: async () => body };
  } catch {
    return { ok: false, status: 500, json: async () => ({}) };
  }
}

function keep(path) {
  return /\.(md|txt|json|ts|tsx|js|mjs|css|html)$/i.test(path) && !SKIP.test(path);
}

let stop = false;
process.on("SIGTERM", () => {
  stop = true;
});

async function onePass() {
  const manifest = await load();
  const seen = new Set([
    ...manifest.files.map((file) => `${file.repo}:${file.path}`),
    ...(manifest.skipped ?? []).map((file) => `${file.repo}:${file.path}`),
  ]);
  const hashes = new Set(manifest.files.map((file) => file.sha256));
  const blobs = new Map();
  const heldByKey = new Map(manifest.files.map((file) => [`${file.repo}:${file.path}`, file]));
  for (const file of manifest.skipped ?? []) {
    if (file.blob) blobs.set(`${file.repo}:${file.path}`, file.blob);
  }
  for (const file of manifest.files) {
    if (file.blob) blobs.set(`${file.repo}:${file.path}`, file.blob);
  }
  manifest.remaining = 0;
  let saved = 0;

  for (const repo of REPOS) {
    if (stop || saved >= 40) break;
    const treeRes = await github(`https://api.github.com/repos/vitalitychems-dot/${repo}/git/trees/main?recursive=1`);
    if (!treeRes.ok && treeRes.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      const retry = await github(`https://api.github.com/repos/vitalitychems-dot/${repo}/git/trees/main?recursive=1`);
      if (!retry.ok) {
        manifest.note = `${repo} tree HTTP ${retry.status}. Not treated as an empty tree.`;
        await save(manifest);
        break;
      }
      treeRes.ok = retry.ok;
      treeRes.status = retry.status;
      treeRes.json = retry.json;
    }
    if (!treeRes.ok) {
      manifest.note = `${repo} tree HTTP ${treeRes.status}`;
      await save(manifest);
      if (treeRes.status === 403 || treeRes.status === 429) break;
      continue;
    }
    const tree = await treeRes.json();
    const items = (tree.tree ?? []).filter((item) => item.type === "blob" && item.path && item.sha && (item.size ?? 0) >= 80 && keep(item.path));
    const todo = [];
    for (const item of items) {
      const key = `${repo}:${item.path}`;
      if (blobs.get(key) === item.sha) continue;
      if (seen.has(key) && !blobs.has(key)) {
        const held = heldByKey.get(key);
        if (held) {
          try {
            const local = await readFile(`${ROOT}/${held.id}.txt`);
            const header = Buffer.from(`blob ${local.length}\0`);
            const localBlob = createHash("sha1").update(Buffer.concat([header, local])).digest("hex");
            if (localBlob === item.sha) {
              held.blob = item.sha;
              blobs.set(key, item.sha);
              continue;
            }
          } catch {
            // The saved body is missing, so the file is fetched below.
          }
        } else {
          blobs.set(key, item.sha);
          continue;
        }
      }
      todo.push(item);
    }
    manifest.remaining += todo.length;
    await save(manifest);
    for (const item of todo) {
      if (stop || saved >= 40) break;
      const path = item.path;
      const raw = `https://raw.githubusercontent.com/vitalitychems-dot/${repo}/main/${path.split("/").map(encodeURIComponent).join("/")}`;
      let res;
      try {
        res = await fetch(raw, { headers: { "User-Agent": "tessera-worker" } });
      } catch (error) {
        manifest.skipped.push({ repo, path, reason: error instanceof Error ? error.message : "fetch failed" });
        seen.add(`${repo}:${path}`);
        continue;
      }
      if (!res.ok) {
        manifest.skipped.push({ repo, path, reason: `HTTP ${res.status}` });
        seen.add(`${repo}:${path}`);
        continue;
      }
      const text = await res.text();
      if (text.length > 100_000 || SECRET.test(text)) {
        manifest.skipped.push({ repo, path, reason: text.length > 100_000 ? "over 100kb" : "secret-shaped" });
        seen.add(`${repo}:${path}`);
        continue;
      }
      const sha256 = createHash("sha256").update(text).digest("hex");
      seen.add(`${repo}:${path}`);
      manifest.remaining = Math.max(0, (manifest.remaining ?? 1) - 1);
      if (hashes.has(sha256)) {
        const held = heldByKey.get(`${repo}:${path}`);
        if (held) held.blob = item.sha;
        blobs.set(`${repo}:${path}`, item.sha);
        if (!held) manifest.skipped.push({ repo, path, reason: "duplicate", blob: item.sha });
        continue;
      }
      hashes.add(sha256);
      const id = sha256.slice(0, 16);
      await writeFile(`${ROOT}/${id}.txt`, text);
      const row = { repo, path, bytes: Buffer.byteLength(text), sha256, id, blob: item.sha, at: new Date().toISOString() };
      const held = heldByKey.get(`${repo}:${path}`);
      if (held) Object.assign(held, row);
      else {
        manifest.files.push(row);
        heldByKey.set(`${repo}:${path}`, row);
      }
      blobs.set(`${repo}:${path}`, item.sha);
      saved += 1;
      if (saved % 5 === 0) await save(manifest);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await save(manifest);
  }

  const queries = ["Language model", "Web search engine", "Note-taking"];
  let webNote = "No web search this pass.";
  try {
    const studyPath = "/workspace/data/web-study.json";
    let prior = { notes: [] };
    try {
      prior = JSON.parse(await readFile(studyPath, "utf8"));
    } catch {
      prior = { notes: [] };
    }
    const query = queries[(prior.notes?.length ?? 0) % queries.length];
    const wiki = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "tessera-worker/1.0", Accept: "application/json" } },
    );
    const found = wiki.ok ? await wiki.json() : [];
    const title = found?.[1]?.[0];
    let text = "";
    if (title) {
      const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { "User-Agent": "tessera-worker/1.0", Accept: "application/json" },
      });
      if (summary.ok) {
        const page = await summary.json();
        text = [title, page.extract ?? "", page.content_urls?.desktop?.page ?? ""].filter(Boolean).join("\n").slice(0, 800);
      }
    }
    const note = {
      at: new Date().toISOString(),
      query,
      ok: Boolean(text.trim()),
      text: text || "No readable page.",
    };
    prior.notes = [...(prior.notes ?? []), note].slice(-12);
    await writeFile(studyPath, JSON.stringify(prior, null, 2));
    webNote = note.ok ? `Searched “${query}”.` : `Search for “${query}” returned no text.`;
  } catch (error) {
    webNote = `Web search failed: ${error instanceof Error ? error.message : "error"}.`;
  }

  let colonel = "Colonel test failed.";
  try {
    await execFileAsync("node", ["--experimental-strip-types", "--test", "/workspace/scripts/colonel.test.mjs"], {
      timeout: 20_000,
    });
    colonel = "Colonel test passed.";
  } catch {
    colonel = "Colonel test failed.";
  }
  manifest.note = `${saved ? `Saved ${saved} new text files.` : "No new text files."} ${colonel} ${webNote} Next pass is scheduled. Wallets and the natal vault stay out.`;
  await save(manifest);
  console.log(manifest.note, "held", manifest.files.length);
}

while (!stop) {
  try {
    await onePass();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("pass failed", message);
    try {
      const manifest = await load();
      manifest.note = `Pass failed: ${message}. It will try again. Wallets and the natal vault stay out.`;
      await save(manifest);
    } catch {
      // The next pass will try to write the manifest again.
    }
  }
  for (let i = 0; i < 120 && !stop; i++) await new Promise((resolve) => setTimeout(resolve, 5000));
}
