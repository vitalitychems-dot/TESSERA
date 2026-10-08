import fs from "fs";
import path from "path";
import https from "https";
import type http from "http";
import { createWriteStream, createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";

const INGESTED_DIR = path.join(process.cwd(), "uploads", "ingested");
const MAX_FILE_READ_SIZE = 500_000;
const MAX_TOTAL_CONTEXT = 200_000;
const MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 500;
const MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024;

if (!fs.existsSync(INGESTED_DIR)) {
  fs.mkdirSync(INGESTED_DIR, { recursive: true });
}

export interface IngestedFile {
  id: string;
  originalUrl?: string;
  filename: string;
  path: string;
  size: number;
  type: string;
  extractedFiles?: IngestedFile[];
  downloadedAt: number;
  status: "downloading" | "extracting" | "ready" | "error";
  error?: string;
  progress?: number;
}

const ingestedFiles = new Map<string, IngestedFile>();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function detectMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimes: Record<string, string> = {
    ".txt": "text/plain", ".md": "text/markdown", ".json": "application/json",
    ".js": "text/javascript", ".ts": "text/typescript", ".jsx": "text/javascript",
    ".tsx": "text/typescript", ".py": "text/x-python", ".rb": "text/x-ruby",
    ".go": "text/x-go", ".rs": "text/x-rust", ".java": "text/x-java",
    ".c": "text/x-c", ".cpp": "text/x-c++", ".h": "text/x-c",
    ".css": "text/css", ".html": "text/html", ".xml": "text/xml",
    ".yaml": "text/yaml", ".yml": "text/yaml", ".toml": "text/toml",
    ".csv": "text/csv", ".sql": "text/x-sql", ".sh": "text/x-sh",
    ".env": "text/plain", ".log": "text/plain", ".ini": "text/plain",
    ".cfg": "text/plain", ".conf": "text/plain",
    ".zip": "application/zip", ".tar": "application/x-tar",
    ".gz": "application/gzip", ".tgz": "application/gzip",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
    ".pdf": "application/pdf", ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return mimes[ext] || "application/octet-stream";
}

function isTextType(mimeType: string): boolean {
  return mimeType.startsWith("text/") || mimeType === "application/json" ||
    mimeType === "application/xml" || mimeType === "application/x-yaml";
}

export function detectGoogleDriveLink(text: string): { fileId: string; url: string } | null {
  const patterns = [
    /https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /https?:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/,
    /https?:\/\/drive\.google\.com\/uc\?(?:export=download&)?id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) {
      return { fileId: match[1], url: match[0] };
    }
  }
  return null;
}

function getDirectDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
}

function followRedirects(url: string, maxRedirects = 5): Promise<{ response: http.IncomingMessage; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    if (!url.startsWith("https://")) {
      return reject(new Error("Only HTTPS URLs are allowed for security"));
    }
    const client = https;
    const req = client.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
        const next = res.headers.location.startsWith("http") ? res.headers.location : new URL(res.headers.location, url).toString();
        followRedirects(next, maxRedirects - 1).then(resolve).catch(reject);
      } else if (res.statusCode === 200) {
        resolve({ response: res, finalUrl: url });
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Download timeout")); });
  });
}

export async function downloadFromGoogleDrive(fileId: string, onProgress?: (p: number) => void): Promise<IngestedFile> {
  const id = generateId();
  const downloadUrl = getDirectDownloadUrl(fileId);

  const entry: IngestedFile = {
    id, originalUrl: `https://drive.google.com/file/d/${fileId}`, filename: `drive-${fileId}`,
    path: "", size: 0, type: "application/octet-stream", downloadedAt: Date.now(),
    status: "downloading", progress: 0,
  };
  ingestedFiles.set(id, entry);

  try {
    const { response, finalUrl } = await followRedirects(downloadUrl);

    let filename = `drive-${fileId}`;
    const cd = response.headers["content-disposition"];
    if (cd) {
      const match = cd.match(/filename[*]?=(?:UTF-8''|"?)([^";]+)/i);
      if (match) filename = decodeURIComponent(match[1].replace(/"/g, ""));
    }

    const totalSize = parseInt(response.headers["content-length"] || "0", 10);
    const filePath = path.join(INGESTED_DIR, `${id}-${filename}`);
    const ws = createWriteStream(filePath);

    if (totalSize > MAX_DOWNLOAD_SIZE) {
      response.destroy();
      throw new Error(`File too large: ${(totalSize / 1024 / 1024).toFixed(0)}MB exceeds ${(MAX_DOWNLOAD_SIZE / 1024 / 1024).toFixed(0)}MB limit`);
    }

    let downloaded = 0;
    response.on("data", (chunk: Buffer) => {
      downloaded += chunk.length;
      if (downloaded > MAX_DOWNLOAD_SIZE) {
        response.destroy();
        ws.destroy();
        return;
      }
      const progress = totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0;
      entry.progress = progress;
      onProgress?.(progress);
    });

    await pipeline(response, ws);

    if (downloaded > MAX_DOWNLOAD_SIZE) {
      try { fs.unlinkSync(filePath); } catch {}
      throw new Error("Download exceeded size limit");
    }

    entry.filename = filename;
    entry.path = filePath;
    entry.size = downloaded;
    entry.type = detectMimeType(filename);
    entry.status = "ready";
    entry.progress = 100;

    if (entry.type === "application/zip" || entry.type === "application/gzip" || entry.type === "application/x-tar") {
      entry.status = "extracting";
      const extracted = await extractArchive(filePath, id);
      entry.extractedFiles = extracted;
      entry.status = "ready";
    }

    ingestedFiles.set(id, entry);
    return entry;
  } catch (err: any) {
    entry.status = "error";
    entry.error = err.message;
    ingestedFiles.set(id, entry);
    throw err;
  }
}

const BLOCKED_HOSTS = [
  "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]",
  "169.254.169.254", "metadata.google.internal",
  "10.", "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
  "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
  "172.30.", "172.31.", "192.168.",
];

const ALLOWED_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx", ".py", ".rb",
  ".go", ".rs", ".java", ".c", ".cpp", ".h", ".css", ".html", ".xml",
  ".yaml", ".yml", ".toml", ".csv", ".sql", ".sh", ".env", ".log",
  ".ini", ".cfg", ".conf", ".zip", ".tar", ".gz", ".tgz",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
  ".pdf", ".doc", ".docx",
]);

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    for (const blocked of BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.startsWith(blocked)) return false;
    }
    if (/^[0-9.]+$/.test(hostname)) {
      const parts = hostname.split(".").map(Number);
      if (parts[0] === 10 || parts[0] === 127) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isExtensionAllowed(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ext === "" || ALLOWED_EXTENSIONS.has(ext);
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 200);
}

export async function downloadFromUrl(url: string, onProgress?: (p: number) => void): Promise<IngestedFile> {
  if (!isUrlSafe(url)) {
    throw new Error("URL blocked: only HTTPS URLs to public hosts are allowed");
  }
  const id = generateId();
  const urlObj = new URL(url);
  let filename = sanitizeFilename(path.basename(urlObj.pathname) || `download-${id}`);

  const entry: IngestedFile = {
    id, originalUrl: url, filename, path: "", size: 0,
    type: detectMimeType(filename), downloadedAt: Date.now(),
    status: "downloading", progress: 0,
  };
  ingestedFiles.set(id, entry);

  try {
    const { response } = await followRedirects(url);
    const totalSize = parseInt(response.headers["content-length"] || "0", 10);
    const cd = response.headers["content-disposition"];
    if (cd) {
      const match = cd.match(/filename[*]?=(?:UTF-8''|"?)([^";]+)/i);
      if (match) filename = decodeURIComponent(match[1].replace(/"/g, ""));
    }

    if (totalSize > MAX_DOWNLOAD_SIZE) {
      response.destroy();
      throw new Error(`File too large: ${(totalSize / 1024 / 1024).toFixed(0)}MB exceeds limit`);
    }

    const filePath = path.join(INGESTED_DIR, `${id}-${filename}`);
    const ws = createWriteStream(filePath);

    let downloaded = 0;
    response.on("data", (chunk: Buffer) => {
      downloaded += chunk.length;
      if (downloaded > MAX_DOWNLOAD_SIZE) {
        response.destroy();
        ws.destroy();
        return;
      }
      entry.progress = totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0;
      onProgress?.(entry.progress);
    });

    await pipeline(response, ws);

    if (downloaded > MAX_DOWNLOAD_SIZE) {
      try { fs.unlinkSync(filePath); } catch {}
      throw new Error("Download exceeded size limit");
    }

    filename = sanitizeFilename(filename);
    if (!isExtensionAllowed(filename)) {
      try { fs.unlinkSync(filePath); } catch {}
      throw new Error(`File type not allowed: ${path.extname(filename)}`);
    }

    entry.filename = filename;
    entry.path = filePath;
    entry.size = downloaded;
    entry.type = detectMimeType(filename);
    entry.status = "ready";
    entry.progress = 100;

    if (entry.type === "application/zip" || entry.type === "application/gzip" || entry.type === "application/x-tar") {
      entry.status = "extracting";
      const extracted = await extractArchive(filePath, id);
      entry.extractedFiles = extracted;
      entry.status = "ready";
    }

    ingestedFiles.set(id, entry);
    return entry;
  } catch (err: any) {
    entry.status = "error";
    entry.error = err.message;
    ingestedFiles.set(id, entry);
    throw err;
  }
}

function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
}

async function extractArchive(archivePath: string, parentId: string): Promise<IngestedFile[]> {
  const extracted: IngestedFile[] = [];
  const ext = path.extname(archivePath).toLowerCase();
  const extractDir = path.join(INGESTED_DIR, `${parentId}-extracted`);
  if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });
  let totalBytes = 0;

  try {
    if (ext === ".zip") {
      const { default: AdmZip } = await import("adm-zip");
      const zip = new AdmZip(archivePath);
      const entries = zip.getEntries();
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        if (extracted.length >= MAX_EXTRACTED_FILES) break;
        const entryName = entry.entryName;
        if (entryName.startsWith("__MACOSX/") || entryName.includes(".DS_Store")) continue;
        if (entryName.includes("..") || path.isAbsolute(entryName)) continue;
        const outPath = path.join(extractDir, entryName);
        if (!isPathSafe(extractDir, outPath)) continue;
        totalBytes += entry.header.size;
        if (totalBytes > MAX_EXTRACTED_BYTES) break;
        const outDir = path.dirname(outPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, entry.getData());
        const id = generateId();
        const file: IngestedFile = {
          id, filename: path.basename(entryName), path: outPath,
          size: entry.header.size, type: detectMimeType(entryName),
          downloadedAt: Date.now(), status: "ready",
        };
        extracted.push(file);
        ingestedFiles.set(id, file);
      }
    } else if (ext === ".gz" || ext === ".tgz") {
      const outPath = path.join(extractDir, path.basename(archivePath).replace(/\.gz$/, "").replace(/\.tgz$/, ".tar"));
      const rs = createReadStream(archivePath);
      const gunzip = createGunzip();
      const ws = createWriteStream(outPath);
      await pipeline(rs, gunzip, ws);

      if (outPath.endsWith(".tar")) {
        const tarFiles = await extractTarSafe(outPath, extractDir);
        extracted.push(...tarFiles);
      } else {
        const stat = fs.statSync(outPath);
        const id = generateId();
        const file: IngestedFile = {
          id, filename: path.basename(outPath), path: outPath,
          size: stat.size, type: detectMimeType(outPath),
          downloadedAt: Date.now(), status: "ready",
        };
        extracted.push(file);
        ingestedFiles.set(id, file);
      }
    } else if (ext === ".tar") {
      const tarFiles = await extractTarSafe(archivePath, extractDir);
      extracted.push(...tarFiles);
    }
  } catch (err: any) {
    console.error("[FileIngestion] Archive extraction error:", err.message);
  }

  return extracted;
}

async function extractTarSafe(tarPath: string, extractDir: string): Promise<IngestedFile[]> {
  const extracted: IngestedFile[] = [];
  try {
    const { spawn } = await import("child_process");
    const listProc = spawn("tar", ["tf", tarPath], { timeout: 30000 });
    let listing = "";
    listProc.stdout.on("data", (d: Buffer) => { listing += d.toString(); });
    await new Promise<void>((resolve, reject) => {
      listProc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`tar list failed: ${code}`)));
      listProc.on("error", reject);
    });

    const safeEntries = listing.split("\n").filter(e => {
      if (!e.trim()) return false;
      if (e.includes("..") || path.isAbsolute(e)) return false;
      return true;
    });

    if (safeEntries.length === 0) return extracted;

    const entriesToExtract = safeEntries.slice(0, MAX_EXTRACTED_FILES);
    const extractProc = spawn("tar", ["xf", tarPath, "-C", extractDir, "--no-same-owner", "--no-same-permissions", ...entriesToExtract], { timeout: 60000 });
    await new Promise<void>((resolve, reject) => {
      extractProc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`tar extract failed: ${code}`)));
      extractProc.on("error", reject);
    });

    const walkDir = (dir: string) => {
      if (extracted.length >= MAX_EXTRACTED_FILES) return;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (extracted.length >= MAX_EXTRACTED_FILES) return;
        const fullPath = path.join(dir, item);
        if (!isPathSafe(extractDir, fullPath)) continue;
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink()) continue;
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          const id = generateId();
          const file: IngestedFile = {
            id, filename: item, path: fullPath,
            size: stat.size, type: detectMimeType(item),
            downloadedAt: Date.now(), status: "ready",
          };
          extracted.push(file);
          ingestedFiles.set(id, file);
        }
      }
    };
    walkDir(extractDir);
  } catch (err: any) {
    console.error("[FileIngestion] Tar extraction error:", err.message);
  }
  return extracted;
}

export function readFileContent(fileId: string, options?: { maxSize?: number; offset?: number; summary?: boolean }): { content: string; truncated: boolean; totalSize: number; lines: number } | { error: string } {
  const file = ingestedFiles.get(fileId);
  if (!file) return { error: "File not found" };
  if (file.status !== "ready") return { error: `File status: ${file.status}` };
  if (!isTextType(file.type) && file.type !== "application/pdf") {
    return { error: `Cannot read binary file type: ${file.type}` };
  }

  try {
    const maxSize = options?.maxSize || MAX_FILE_READ_SIZE;
    const stat = fs.statSync(file.path);
    const totalSize = stat.size;

    if (totalSize > 10_000_000) {
      if (options?.summary) {
        const head = fs.readFileSync(file.path, { encoding: "utf-8", flag: "r" }).slice(0, 5000);
        const lineCount = fs.readFileSync(file.path, "utf-8").split("\n").length;
        return {
          content: `[LARGE FILE SUMMARY: ${file.filename} — ${(totalSize / 1024 / 1024).toFixed(1)}MB, ~${lineCount} lines]\n\nFirst 5000 characters:\n${head}`,
          truncated: true, totalSize, lines: lineCount,
        };
      }
    }

    let content = fs.readFileSync(file.path, "utf-8");
    const lines = content.split("\n").length;
    let truncated = false;

    if (content.length > maxSize) {
      content = content.slice(options?.offset || 0, (options?.offset || 0) + maxSize);
      truncated = true;
    }

    return { content, truncated, totalSize, lines };
  } catch (err: any) {
    return { error: err.message };
  }
}

export function getIngestedFiles(): IngestedFile[] {
  return Array.from(ingestedFiles.values()).sort((a, b) => b.downloadedAt - a.downloadedAt);
}

export function getIngestedFile(id: string): IngestedFile | undefined {
  return ingestedFiles.get(id);
}

export function deleteIngestedFile(id: string): boolean {
  const file = ingestedFiles.get(id);
  if (!file) return false;
  try {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    if (file.extractedFiles) {
      for (const ef of file.extractedFiles) {
        if (fs.existsSync(ef.path)) fs.unlinkSync(ef.path);
        ingestedFiles.delete(ef.id);
      }
    }
  } catch {}
  ingestedFiles.delete(id);
  return true;
}

export function buildFileContextForChat(content: string): string {
  const driveLink = detectGoogleDriveLink(content);
  if (!driveLink) return "";

  const parts: string[] = [];
  const files = getIngestedFiles().filter(f => f.originalUrl?.includes(driveLink.fileId));
  if (files.length > 0) {
    const file = files[0];
    parts.push(`[GOOGLE DRIVE FILE DETECTED: ${file.filename} (${(file.size / 1024).toFixed(1)}KB, ${file.type})]`);
    if (file.extractedFiles && file.extractedFiles.length > 0) {
      parts.push(`Archive contains ${file.extractedFiles.length} files:`);
      for (const ef of file.extractedFiles.slice(0, 50)) {
        parts.push(`  - ${ef.filename} (${(ef.size / 1024).toFixed(1)}KB, ${ef.type})`);
      }
    }
    if (isTextType(file.type)) {
      const result = readFileContent(file.id, { maxSize: MAX_TOTAL_CONTEXT, summary: file.size > 500_000 });
      if ("content" in result) {
        parts.push(`\nFile contents:\n${result.content}`);
      }
    } else if (file.extractedFiles) {
      let totalLoaded = 0;
      for (const ef of file.extractedFiles) {
        if (totalLoaded >= MAX_TOTAL_CONTEXT) break;
        if (!isTextType(ef.type)) continue;
        const result = readFileContent(ef.id, { maxSize: Math.min(50_000, MAX_TOTAL_CONTEXT - totalLoaded) });
        if ("content" in result) {
          parts.push(`\n--- ${ef.filename} ---\n${result.content}`);
          totalLoaded += result.content.length;
        }
      }
    }
  }

  return parts.length > 0 ? parts.join("\n") : `[GOOGLE DRIVE LINK DETECTED: ${driveLink.url}]\nThis file hasn't been downloaded yet. The user needs to use the file ingestion endpoint first, or you can suggest they do so.`;
}

export function getFileTree(fileId: string): { name: string; size: number; type: string; id: string; children?: any[] }[] {
  const file = ingestedFiles.get(fileId);
  if (!file) return [];

  if (!file.extractedFiles || file.extractedFiles.length === 0) {
    return [{ name: file.filename, size: file.size, type: file.type, id: file.id }];
  }

  const tree: Record<string, any> = {};
  for (const ef of file.extractedFiles) {
    const rel = path.relative(path.dirname(file.path), ef.path);
    const parts = rel.split(path.sep);
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = { __children: {} };
      current = current[parts[i]].__children;
    }
    const fname = parts[parts.length - 1];
    current[fname] = { name: ef.filename, size: ef.size, type: ef.type, id: ef.id };
  }

  function buildTree(obj: Record<string, any>): any[] {
    return Object.entries(obj).map(([key, val]) => {
      if (val.__children) {
        return { name: key, type: "directory", size: 0, id: "", children: buildTree(val.__children) };
      }
      return val;
    });
  }

  return buildTree(tree);
}

console.log("[FileIngestion] File ingestion system initialized — Google Drive download, archive extraction, smart file reader active");
