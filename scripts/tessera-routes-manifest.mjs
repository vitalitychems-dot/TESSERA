#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = join(root, "artifacts", "tessera", "src", "App.tsx");
const manifestPath = join(root, "artifacts", "tessera", "public", "manus-routes.json");

function titleFor(path) {
  if (path === "/") return "Tessera home";
  return `Tessera ${path}`;
}

export function collectTesseraRoutes(source) {
  const routes = new Map();
  for (const match of source.matchAll(/<Route\s+path="([^"]+)"/g)) {
    const path = match[1];
    routes.set(path, { path, title: titleFor(path) });
  }
  for (const match of source.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)) {
    const [path, target] = match.slice(1);
    routes.set(path, { path, title: `Redirect to ${target}` });
  }
  return [...routes.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function buildManifest(source) {
  return { routes: collectTesseraRoutes(source) };
}

export function currentManifest() {
  return buildManifest(readFileSync(appPath, "utf8"));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const manifest = currentManifest();
  if (process.argv.includes("--write")) {
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`wrote ${manifest.routes.length} routes to ${manifestPath}`);
  } else {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  }
}
