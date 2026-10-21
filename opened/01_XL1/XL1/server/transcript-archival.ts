import fs from "fs";
import path from "path";
import zlib from "zlib";
import { logActivity } from "./activity-feed";

const TRANSCRIPT_DIR = path.join(process.cwd(), "server", "conference-transcripts");
const ARCHIVE_DIR = path.join(TRANSCRIPT_DIR, "archive");
const SUMMARY_FILE = path.join(TRANSCRIPT_DIR, "archive-index.json");
const ARCHIVE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface ArchiveEntry {
  originalFile: string;
  archiveFile: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  archivedAt: number;
  summary: string;
  type: string;
  stepCount?: number;
}

interface ArchiveIndex {
  entries: ArchiveEntry[];
  totalOriginalSize: number;
  totalCompressedSize: number;
  totalSaved: number;
  lastArchiveRun: number;
}

let archiveIndex: ArchiveIndex = {
  entries: [],
  totalOriginalSize: 0,
  totalCompressedSize: 0,
  totalSaved: 0,
  lastArchiveRun: 0,
};

let initialized = false;
let archivalInterval: ReturnType<typeof setInterval> | null = null;

function loadArchiveIndex() {
  try {
    if (fs.existsSync(SUMMARY_FILE)) {
      archiveIndex = JSON.parse(fs.readFileSync(SUMMARY_FILE, "utf-8"));
    }
  } catch (err: any) {
    console.log("[TranscriptArchival] Failed to load archive index:", err.message);
  }
}

function saveArchiveIndex() {
  try {
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(archiveIndex, null, 2));
  } catch (err: any) {
    console.log("[TranscriptArchival] Failed to save archive index:", err.message);
  }
}

function generateSummary(data: any, filename: string): string {
  if (filename.includes("tesseract-") && data.passedSteps) {
    return `Tesseract Conference: ${data.passedSteps.length} steps passed, ${data.totalLLMCalls || 0} LLM calls`;
  }
  if (filename.includes("grand-mass-") && data.results) {
    return `Grand Mass Conference: ${data.results?.length || 0} results`;
  }
  if (filename.includes("conf-") && data.steps) {
    return `Conference: ${data.steps?.length || 0} steps`;
  }
  if (filename.includes("train-")) {
    return `Training session data`;
  }
  return `Conference transcript`;
}

export function runArchival(): { archived: number; saved: number } {
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  const now = Date.now();
  let archived = 0;
  let totalSaved = 0;

  try {
    const files = fs.readdirSync(TRANSCRIPT_DIR).filter(
      (f) => (f.endsWith(".json") || f.endsWith(".txt")) && !f.includes("archive") && !f.includes("implementation") && !f.includes("LATEST") && !f.includes("IMPLEMENTATION")
    );

    for (const file of files) {
      const filePath = path.join(TRANSCRIPT_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs < ARCHIVE_AGE_MS) continue;
      if (archiveIndex.entries.some((e) => e.originalFile === file)) continue;

      try {
        const content = fs.readFileSync(filePath);
        const compressed = zlib.gzipSync(content, { level: 9 });

        const archiveFile = `${file}.gz`;
        fs.writeFileSync(path.join(ARCHIVE_DIR, archiveFile), compressed);

        let summary = file;
        if (file.endsWith(".json")) {
          try {
            const data = JSON.parse(content.toString());
            summary = generateSummary(data, file);
          } catch (parseErr: any) {
            console.log(`[TranscriptArchival] Could not parse ${file} for summary:`, parseErr.message);
          }
        }

        const entry: ArchiveEntry = {
          originalFile: file,
          archiveFile,
          originalSize: content.length,
          compressedSize: compressed.length,
          compressionRatio: Math.round((1 - compressed.length / content.length) * 100),
          archivedAt: now,
          summary,
          type: file.split("-")[0],
        };

        archiveIndex.entries.push(entry);
        archiveIndex.totalOriginalSize += content.length;
        archiveIndex.totalCompressedSize += compressed.length;

        const saved = content.length - compressed.length;
        totalSaved += saved;

        fs.unlinkSync(filePath);
        archived++;
      } catch (fileErr: any) {
        console.log(`[TranscriptArchival] Failed to archive ${file}:`, fileErr.message);
      }
    }

    if (archived > 0) {
      archiveIndex.totalSaved += totalSaved;
      archiveIndex.lastArchiveRun = now;
      saveArchiveIndex();
      logActivity("system", "TranscriptArchival", `Archived ${archived} transcripts`, `Saved ${Math.round(totalSaved / 1024)}KB via compression`, "success");
    }
  } catch (err: any) {
    console.log("[TranscriptArchival] Archival run failed:", err.message);
  }

  return { archived, saved: totalSaved };
}

export function getArchivalStats() {
  loadArchiveIndex();

  let activeSize = 0;
  let activeCount = 0;
  try {
    const files = fs.readdirSync(TRANSCRIPT_DIR).filter(
      (f) => (f.endsWith(".json") || f.endsWith(".txt")) && !f.includes("archive") && !f.includes("LATEST") && !f.includes("IMPLEMENTATION")
    );
    activeCount = files.length;
    for (const file of files) {
      try {
        activeSize += fs.statSync(path.join(TRANSCRIPT_DIR, file)).size;
      } catch (statErr: any) {
        console.log(`[TranscriptArchival] Cannot stat ${file}:`, statErr.message);
      }
    }
  } catch (err: any) {
    console.log("[TranscriptArchival] Failed to read transcript directory:", err.message);
  }

  return {
    activeTranscripts: activeCount,
    activeSize: Math.round(activeSize / 1024),
    archivedTranscripts: archiveIndex.entries.length,
    totalOriginalSize: Math.round(archiveIndex.totalOriginalSize / 1024),
    totalCompressedSize: Math.round(archiveIndex.totalCompressedSize / 1024),
    totalSaved: Math.round(archiveIndex.totalSaved / 1024),
    avgCompressionRatio: archiveIndex.entries.length > 0
      ? Math.round(archiveIndex.entries.reduce((s, e) => s + e.compressionRatio, 0) / archiveIndex.entries.length)
      : 0,
    lastArchiveRun: archiveIndex.lastArchiveRun,
    entries: archiveIndex.entries.slice(-20),
  };
}

export function initTranscriptArchival() {
  if (initialized) return;
  initialized = true;

  loadArchiveIndex();

  setTimeout(() => runArchival(), 60000);

  archivalInterval = setInterval(() => runArchival(), 6 * 60 * 60 * 1000);

  console.log(`[TranscriptArchival] Archival system initialized — ${archiveIndex.entries.length} archived, auto-run every 6h`);
}
