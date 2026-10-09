// Bundles the local pen gate. The URL check accepts only literal http://127.0.0.1 and http://[::1].
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const entry = join(packageRoot, "src/lib/pen-local/gate-cli.ts");

const result = await build({
  absWorkingDir: packageRoot,
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  write: false,
  logLevel: "silent",
});

const output = result.outputFiles[0];
if (!output) {
  console.error("The local pen gate failed to bundle.");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "pen-local-gate-"));
const outfile = join(dir, "gate.mjs");
let code = 1;
try {
  writeFileSync(outfile, output.text);
  const loaded = await import(pathToFileURL(outfile).href);
  const status = await loaded.main();
  code = typeof status === "number" ? status : 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
