import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const FILES = ["CANON.md", "CONFLICTS.md", "ORIGIN-SOURCE.md"];
const manifestPath = path.join(dir, "MANIFEST.json");

let version = "0.1.0";
try {
  version = JSON.parse(readFileSync(manifestPath, "utf8")).version ?? version;
} catch {
  // first run: keep the default version
}
if (process.argv[2]) version = process.argv[2];

const normalize = (s) => s.replace(/\r\n/g, "\n").trimEnd();
const files = {};
for (const name of FILES) {
  files[name] = createHash("sha256").update(normalize(readFileSync(path.join(dir, name), "utf8")), "utf8").digest("hex");
}

const manifest = {
  version,
  hashAlgorithm: "sha256",
  normalization: "CRLF to LF, trailing whitespace at end of file trimmed",
  files,
  note: "Hashes cover CANON.md, CONFLICTS.md and ORIGIN-SOURCE.md. Regenerate with node identity/update-manifest.mjs after any edit.",
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
