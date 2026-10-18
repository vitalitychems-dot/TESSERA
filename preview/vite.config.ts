import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

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

// The desk gate reads API_SERVER_PORT and fails closed when it is unset or
// invalid. Only the Vite dev server fills a blank value, from TESSERA_API_PORT
// or the local suite API port. Production preview and builds leave it unset.
// An invalid value is left unchanged so the gate still fails closed.
function fillDevApiServerPort(command: string, mode: string): void {
  if (command !== "serve" || mode !== "development") return;
  const configuredApiPort = process.env.API_SERVER_PORT?.trim();
  if (configuredApiPort) return;
  const suitePort = process.env.TESSERA_API_PORT?.trim();
  process.env.API_SERVER_PORT = suitePort || "5000";
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
