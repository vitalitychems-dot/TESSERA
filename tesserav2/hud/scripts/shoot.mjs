/**
 * Live check + headless screenshots of a running HUD.
 *   node scripts/shoot.mjs [outDir]
 * Needs the HUD running on HUD_URL (default http://127.0.0.1:4173/) and a local Chrome.
 * Changes one sample facet, adds and deletes a temp facet, then restores the sample.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const repoRoot = resolve(here, "../..");
const { chromium } = createRequire(join(repoRoot, "artifacts/v2/package.json"))("playwright-core");
const url = process.env.HUD_URL ?? "http://127.0.0.1:4173/";
const outDir = resolve(process.argv[2] ?? "/workspace/hud-shots");
const facets = resolve(repoRoot, process.env.HUD_FACETS_DIR ?? "data/facets");
const chrome = process.env.CHROME_PATH ?? ["/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const external = [];
page.on("request", (r) => { if (!r.url().startsWith(url.replace(/\/$/, ""))) external.push(r.url()); });
await page.goto(url);
await page.waitForFunction(() => window.__hud && window.__hud.tiles.size > 0, null, { timeout: 15000 });
await page.waitForTimeout(2500);
const before = join(outDir, "hud-before.png");
await page.screenshot({ path: before });
const tilesBefore = await page.evaluate(() => window.__hud.tiles.size);

const sample = join(facets, "SAMPLE-03-Gitai.tsv");
const original = readFileSync(sample);
const temp = join(facets, `LIVE-TEST-${Date.now()}.tsv`);
const row = (n) => `2026-10-21T21:00:00Z\tbox\tfile\tlive-${n}.txt\tlive/live-${n}.txt\n`;
try {
  writeFileSync(sample, Buffer.concat([original, Buffer.from(Array.from({ length: 200 }, (_, i) => row(i)).join(""))]));
  writeFileSync(temp, Array.from({ length: 400 }, (_, i) => row(i)).join(""));
  await page.waitForFunction(() => {
    const t = window.__hud.events.map((e) => e.type);
    return t.includes("change") && t.includes("add");
  }, null, { timeout: 15000 });
  await page.waitForTimeout(700); // mid-pulse
  const after = join(outDir, "hud-after-change.png");
  await page.screenshot({ path: after });
  unlinkSync(temp);
  await page.waitForFunction(() => window.__hud.events.some((e) => e.type === "delete"), null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const afterDel = join(outDir, "hud-after-delete.png");
  await page.screenshot({ path: afterDel });
  const result = await page.evaluate(() => ({
    events: window.__hud.events.map((e) => `${e.type}:${e.name}:${e.size}`),
    counts: window.__hud.counts,
    tiles: window.__hud.tiles.size,
    hudLast: document.getElementById("hud-last").textContent,
    hudFile: document.getElementById("hud-file").textContent,
    link: document.getElementById("hud-link").textContent,
  }));
  console.log(JSON.stringify({ tilesBefore, ...result, external, shots: [before, after, afterDel] }, null, 2));
} finally {
  writeFileSync(sample, original);
  if (existsSync(temp)) unlinkSync(temp);
  await browser.close();
}
