import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fillDevApiServerPort } from "./src/lib/dev-api-port.ts";

const previewDir = process.cwd();
const repoRoot = join(previewDir, "..");
const tesseraRequire = createRequire(join(repoRoot, "artifacts/tessera/package.json"));
const dbRequire = createRequire(join(repoRoot, "lib/db/package.json"));

function installedPackage(name: string, versionPrefix: string): string {
  const store = join(repoRoot, "node_modules/.pnpm");
  const match = readdirSync(store).find((entry) => entry.startsWith(`${name}@${versionPrefix}`));
  if (!match) {
    throw new Error(`${name}@${versionPrefix} is not in the installed pnpm store`);
  }
  return join(store, match, "node_modules", name);
}

function packageDir(resolver: NodeJS.Require, name: string): string {
  return dirname(resolver.resolve(`${name}/package.json`));
}

const rawPort = process.env.PORT ?? "4174";
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const viteMod = await import(pathToFileURL(tesseraRequire.resolve("vite")).href);
const reactMod = await import(pathToFileURL(tesseraRequire.resolve("@vitejs/plugin-react")).href);
const tailwindMod = await import(pathToFileURL(tesseraRequire.resolve("@tailwindcss/vite")).href);

export default viteMod.defineConfig((env: { command: string; mode: string }) => {
  fillDevApiServerPort(env.command, env.mode);
  return {
  plugins: [tailwindMod.default(), reactMod.default()],
  resolve: {
    alias: {
      "@": join(previewDir, "src"),
      react: packageDir(tesseraRequire, "react"),
      "react-dom": packageDir(tesseraRequire, "react-dom"),
      "lucide-react": packageDir(tesseraRequire, "lucide-react"),
      zod: packageDir(tesseraRequire, "zod"),
      pg: packageDir(dbRequire, "pg"),
      zustand: installedPackage("zustand", "5.0.12"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  preview: {
    host: "127.0.0.1",
    port,
    strictPort: true,
  },
  build: {
    outDir: join(previewDir, "dist"),
    emptyOutDir: true,
  },
};
});
