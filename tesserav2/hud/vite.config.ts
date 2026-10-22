/**
 * Tessera HUD: 3D facet terrain on 127.0.0.1:4173 only, strictPort.
 * Borrows vite and three from artifacts/tessera's installed packages, the same
 * way preview/vite.config.ts does, so it adds nothing to the lockfile.
 */
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { facetFeedPlugin } from "./src/facet-feed.mjs";

const hudDir = dirname(new URL(import.meta.url).pathname);
const repoRoot = join(hudDir, "..");
const tesseraRequire = createRequire(join(repoRoot, "artifacts/tessera/package.json"));

const HOST = "127.0.0.1";
const rawPort = process.env.HUD_PORT ?? "4173";
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid HUD_PORT: "${rawPort}"`);
const facetsDir = resolve(repoRoot, process.env.HUD_FACETS_DIR ?? "data/facets");

const viteMod = await import(pathToFileURL(tesseraRequire.resolve("vite")).href);

export default viteMod.defineConfig({
  root: hudDir,
  plugins: [facetFeedPlugin({ dir: facetsDir })],
  resolve: {
    alias: { three: realpathSync(join(repoRoot, "artifacts/tessera/node_modules/three")) },
  },
  server: {
    host: HOST,
    port,
    strictPort: true,
    allowedHosts: ["127.0.0.1", "localhost"],
    cors: false,
    hmr: { host: HOST, port },
    fs: { allow: [repoRoot] },
    // Poll the few HUD source files instead of taking an inotify instance: the shared box runs near its 128-instance limit.
    watch: { usePolling: true, interval: 1000, ignored: ["**/node_modules/**", "**/dist/**"] },
  },
  preview: {
    host: HOST,
    port,
    strictPort: true,
    allowedHosts: ["127.0.0.1", "localhost"],
    cors: false,
  },
  build: { outDir: join(hudDir, "dist"), emptyOutDir: true, assetsInlineLimit: 0 },
});
