import { type Dirent, promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join, relative } from "node:path";

export interface ManifestFile {
  path: string;
  kind: string;
  sizeBytes: number;
  contentHash: string;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".pnpm-store",
  ".cache",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".local",
  "tsconfig.tsbuildinfo",
  ".venv",
  "venv",
  ".pytest_cache",
  ".mypy_cache",
  "__pycache__",
  "coverage",
  ".vite",
  "secrets",
  "credentials",
  ".ssh",
]);
const SKIP_EXT = new Set([".lock", ".log", ".tsbuildinfo"]);
const MAX_HASH_BYTES = 64 * 1024;

/** True when the walker must not open the file or put it in the manifest. */
export function isSecretManifestEntry(name: string, relPath = name): boolean {
  const base = name.toLowerCase();
  if (base.startsWith(".env")) return true;
  if (base === ".npmrc" || base === ".netrc" || base === ".pypirc") return true;
  if (base.startsWith("id_")) return true;
  if (base.endsWith(".pem") || base.endsWith(".key") || base.endsWith(".p12") || base.endsWith(".pfx")) return true;
  if (base.includes("secret") || base.includes("credential")) return true;
  const parts = relPath.replace(/\\/g, "/").toLowerCase().split("/");
  return parts.some((part) => part === "secrets" || part === "credentials" || part === ".ssh");
}

function classifyKind(path: string): string {
  const ext = extname(path).toLowerCase();
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) return "code";
  if ([".json", ".jsonc", ".yaml", ".yml", ".toml"].includes(ext)) return "config";
  if ([".md", ".mdx", ".txt"].includes(ext)) return "doc";
  if ([".sql"].includes(ext)) return "schema";
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".pdf"].includes(ext)) return "asset";
  if ([".zip", ".tar", ".gz", ".tgz", ".bz2", ".rar", ".7z"].includes(ext)) return "archive";
  if ([".css", ".scss", ".sass", ".less"].includes(ext)) return "style";
  if ([".html", ".htm"].includes(ext)) return "markup";
  if ([".sh", ".bash", ".zsh"].includes(ext)) return "script";
  if ([".py"].includes(ext)) return "code-py";
  return "misc";
}

async function hashHead(path: string, sizeBytes: number): Promise<string> {
  try {
    const fh = await fs.open(path, "r");
    try {
      const len = Math.min(sizeBytes, MAX_HASH_BYTES);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, 0);
      return createHash("sha256").update(buf).digest("hex").slice(0, 32);
    } finally {
      await fh.close();
    }
  } catch {
    return "";
  }
}

export async function buildRepoManifest(rootDir = process.cwd()): Promise<ManifestFile[]> {
  const out: ManifestFile[] = [];
  async function walk(dir: string) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (SKIP_DIRS.has(ent.name) || isSecretManifestEntry(ent.name)) continue;
      const full = join(dir, ent.name);
      const rel = relative(rootDir, full);
      if (isSecretManifestEntry(ent.name, rel)) continue;
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        const ext = extname(ent.name).toLowerCase();
        if (SKIP_EXT.has(ext)) continue;
        let st;
        try { st = await fs.stat(full); } catch { continue; }
        const kind = classifyKind(ent.name);
        const hash = kind === "asset" || kind === "archive" || st.size > 5 * 1024 * 1024
          ? `size:${st.size}`
          : await hashHead(full, st.size);
        out.push({
          path: rel,
          kind,
          sizeBytes: st.size,
          contentHash: hash,
        });
      }
    }
  }
  await walk(rootDir);
  return out;
}
