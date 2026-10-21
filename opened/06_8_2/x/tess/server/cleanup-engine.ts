import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";

export interface CleanupReport {
  runAt: number;
  notesArchived: number;
  notesDeleted: number;
  duplicatesRemoved: number;
  oldConversationsArchived: number;
  filesDeleted: number;
  bytesFreed: number;
  details: string[];
}

let lastCleanupReport: CleanupReport | null = null;
let cleanupRunning = false;

export function getCleanupStatus() {
  return {
    running: cleanupRunning,
    lastRun: lastCleanupReport,
    nextRunIn: lastCleanupReport ? Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - lastCleanupReport.runAt)) : 0,
  };
}

const TEMP_DIRS = ["/tmp/audio", "/tmp/voice", "/tmp/recordings", "/tmp/uploads"];
const VOICE_EXTENSIONS = [".wav", ".mp3", ".ogg", ".webm", ".m4a", ".aac"];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TRAINING_NOTES = 500;

export async function runCleanup(): Promise<CleanupReport> {
  if (cleanupRunning) {
    return lastCleanupReport || { runAt: Date.now(), notesArchived: 0, notesDeleted: 0, duplicatesRemoved: 0, oldConversationsArchived: 0, filesDeleted: 0, bytesFreed: 0, details: ["Already running"] };
  }

  cleanupRunning = true;
  const report: CleanupReport = {
    runAt: Date.now(),
    notesArchived: 0,
    notesDeleted: 0,
    duplicatesRemoved: 0,
    oldConversationsArchived: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    details: [],
  };

  try {
    report.details.push("=== TESSERACT CLEANUP ENGINE ===");

    await cleanupVoiceFiles(report);
    await cleanupTrainingNotes(report);
    await cleanupDuplicateNotes(report);
    await cleanupOldConversations(report);
    await cleanupTmpFiles(report);
    await cleanupStaleJsonCaches(report);
    await cleanupBackupFiles(report);
    await compactJsonDataFiles(report);

    report.details.push("=== CLEANUP COMPLETE ===");
    report.details.push("Total notes archived: " + report.notesArchived);
    report.details.push("Total notes deleted: " + report.notesDeleted);
    report.details.push("Duplicates removed: " + report.duplicatesRemoved);
    report.details.push("Old conversations archived: " + report.oldConversationsArchived);
    report.details.push("Files deleted: " + report.filesDeleted);
    report.details.push("Bytes freed: " + (report.bytesFreed / 1024).toFixed(1) + " KB");

    try {
      await storage.createNote({
        type: "cleanup",
        title: "Cleanup Report: " + new Date().toISOString().slice(0, 10),
        content: report.details.join("\n"),
        priority: "normal",
        status: "unread",
      });
    } catch {}

  } catch (err) {
    report.details.push("ERROR: " + String(err));
  }

  cleanupRunning = false;
  lastCleanupReport = report;
  return report;
}

async function cleanupVoiceFiles(report: CleanupReport): Promise<void> {
  const now = Date.now();
  let count = 0;
  let bytes = 0;

  for (const dir of TEMP_DIRS) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!VOICE_EXTENSIONS.includes(ext)) continue;
        const filePath = path.join(dir, file);
        try {
          const stat = fs.statSync(filePath);
          const age = now - stat.mtimeMs;
          if (age > THIRTY_DAYS_MS) {
            bytes += stat.size;
            fs.unlinkSync(filePath);
            count++;
          }
        } catch {}
      }
    } catch {}
  }

  if (count > 0) {
    report.filesDeleted += count;
    report.bytesFreed += bytes;
    report.details.push("Voice files deleted (>30 days): " + count + " (" + (bytes / 1024).toFixed(1) + " KB)");
  }
}

async function cleanupTrainingNotes(report: CleanupReport): Promise<void> {
  try {
    const allNotes = await storage.getNotes({ limit: 5000 });
    const trainingNotes = allNotes.filter((n: any) => n.type === "training");

    if (trainingNotes.length > MAX_TRAINING_NOTES) {
      const sorted = trainingNotes.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      const toDelete = sorted.slice(MAX_TRAINING_NOTES);

      for (const note of toDelete) {
        try {
          await storage.deleteNote(note.id);
          report.notesDeleted++;
        } catch {}
      }

      report.details.push("Training notes trimmed: kept last " + MAX_TRAINING_NOTES + ", deleted " + toDelete.length + " older rounds");
    }
  } catch {}
}

async function cleanupDuplicateNotes(report: CleanupReport): Promise<void> {
  try {
    const allNotes = await storage.getNotes({ limit: 5000 });
    const seen = new Map<string, any>();
    let removed = 0;

    for (const note of allNotes) {
      const key = (note.type || "") + "::" + (note.title || "");
      const existing = seen.get(key);
      if (existing) {
        const existingTime = new Date(existing.createdAt || 0).getTime();
        const thisTime = new Date(note.createdAt || 0).getTime();
        const older = existingTime < thisTime ? existing : note;
        try {
          await storage.deleteNote(older.id);
          removed++;
          seen.set(key, existingTime < thisTime ? note : existing);
        } catch {}
      } else {
        seen.set(key, note);
      }
    }

    if (removed > 0) {
      report.duplicatesRemoved += removed;
      report.details.push("Duplicate notes removed: " + removed);
    }
  } catch {}
}

async function cleanupOldConversations(report: CleanupReport): Promise<void> {
  try {
    const conversations = await storage.getConversations();
    const now = Date.now();
    let archived = 0;

    for (const conv of conversations) {
      const messages = await storage.getMessages(conv.id);
      const convTime = new Date(conv.updatedAt || conv.createdAt || 0).getTime();
      const age = now - convTime;

      if (messages.length === 0 && age > SEVEN_DAYS_MS) {
        try {
          await storage.deleteConversation(conv.id);
          archived++;
        } catch {}
      }
    }

    if (archived > 0) {
      report.oldConversationsArchived += archived;
      report.details.push("Empty conversations deleted (>7 days): " + archived);
    }
  } catch {}
}

async function cleanupTmpFiles(report: CleanupReport): Promise<void> {
  const tmpDir = "/tmp";
  const now = Date.now();
  let count = 0;
  let bytes = 0;

  const OLD_PATTERNS = [".log", ".tmp", ".cache", ".lock"];

  try {
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!OLD_PATTERNS.includes(ext)) continue;
      const filePath = path.join(tmpDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        const age = now - stat.mtimeMs;
        if (age > SEVEN_DAYS_MS) {
          bytes += stat.size;
          fs.unlinkSync(filePath);
          count++;
        }
      } catch {}
    }
  } catch {}

  if (count > 0) {
    report.filesDeleted += count;
    report.bytesFreed += bytes;
    report.details.push("Old tmp files deleted (>7 days): " + count);
  }
}

async function cleanupStaleJsonCaches(report: CleanupReport): Promise<void> {
  const now = Date.now();
  const STALE_JSON_FILES = [
    "server/provider_stats.json",
    "server/llm_logs.txt",
    "server/profit-circulator-state.json",
    "server/compute-economy-state.json",
  ];
  let cleaned = 0;

  for (const file of STALE_JSON_FILES) {
    try {
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) continue;
      const stat = fs.statSync(filePath);
      if (stat.size > 5 * 1024 * 1024) {
        if (file.endsWith(".txt")) {
          const content = fs.readFileSync(filePath, "utf8");
          const lines = content.split("\n");
          if (lines.length > 5000) {
            fs.writeFileSync(filePath, lines.slice(-2000).join("\n"), "utf8");
            report.bytesFreed += stat.size - 2000 * 100;
            cleaned++;
            report.details.push(`Trimmed oversized log: ${file} (${(stat.size / 1024).toFixed(1)} KB → trimmed)`);
          }
        }
      }
      const age = now - stat.mtimeMs;
      if (age > THIRTY_DAYS_MS && file.endsWith(".json") && file !== "provider_stats.json" && file !== "server/provider_stats.json") {
        fs.unlinkSync(filePath);
        report.filesDeleted++;
        report.bytesFreed += stat.size;
        cleaned++;
        report.details.push(`Deleted stale cache: ${file} (${Math.round(age / 86400000)} days old)`);
      }
    } catch {}
  }

  const cycleProofsPath = path.resolve("server/cycle-proofs.json");
  try {
    if (fs.existsSync(cycleProofsPath)) {
      const stat = fs.statSync(cycleProofsPath);
      if (stat.size > 2 * 1024 * 1024) {
        const data = JSON.parse(fs.readFileSync(cycleProofsPath, "utf8"));
        if (Array.isArray(data) && data.length > 100) {
          const trimmed = data.slice(-50);
          fs.writeFileSync(cycleProofsPath, JSON.stringify(trimmed, null, 2), "utf8");
          report.bytesFreed += stat.size - JSON.stringify(trimmed, null, 2).length;
          cleaned++;
          report.details.push(`Trimmed cycle proofs: ${data.length} → ${trimmed.length} entries`);
        }
      }
    }
  } catch {}

  if (cleaned > 0) {
    report.details.push(`Stale JSON cache cleanup: ${cleaned} files processed`);
  }
}

async function cleanupBackupFiles(report: CleanupReport): Promise<void> {
  const now = Date.now();
  let count = 0;
  let bytes = 0;
  const BACKUP_PATTERNS = [".bak", ".backup", ".old", ".orig", ".save"];
  const SEARCH_DIRS = [".", "server", "client/src"];

  for (const dir of SEARCH_DIRS) {
    try {
      const dirPath = path.resolve(dir);
      if (!fs.existsSync(dirPath)) continue;
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const isBackup = BACKUP_PATTERNS.includes(ext) || file.includes(".backup") || file.endsWith("~");
        if (!isBackup) continue;
        const filePath = path.join(dirPath, file);
        try {
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) continue;
          const age = now - stat.mtimeMs;
          if (age > SEVEN_DAYS_MS) {
            bytes += stat.size;
            fs.unlinkSync(filePath);
            count++;
          }
        } catch {}
      }
    } catch {}
  }

  if (count > 0) {
    report.filesDeleted += count;
    report.bytesFreed += bytes;
    report.details.push(`Backup files deleted (>7 days): ${count} (${(bytes / 1024).toFixed(1)} KB)`);
  }
}

async function compactJsonDataFiles(report: CleanupReport): Promise<void> {
  const JSON_DATA_FILES = [
    { path: "server/sovereign-cache.json", maxEntries: 50, keepLast: 30 },
    { path: "server/sovereign-knowledge.json", maxEntries: 100, keepLast: 50 },
    { path: "server/rllm-corpus.json", maxEntries: 100, keepLast: 50 },
    { path: "server/provider-performance.json", maxEntries: 100, keepLast: 50 },
    { path: "server/swarm-stats.json", maxEntries: 100, keepLast: 50 },
    { path: "server/cycle-proofs.json", maxEntries: 50, keepLast: 20 },
    { path: "server/blog-posts.json", maxEntries: 50, keepLast: 30 },
    { path: "server/auto-exec-log.json", maxEntries: 100, keepLast: 50 },
    { path: "server/omnibus-exec-log.json", maxEntries: 100, keepLast: 50 },
    { path: "server/distilled-knowledge.json", maxEntries: 100, keepLast: 50 },
    { path: "server/grand-evaluation-results.json", maxEntries: 50, keepLast: 20 },
    { path: "server/conversation-corpus.json", maxEntries: 100, keepLast: 50 },
    { path: "server/collective-intelligence.json", maxEntries: 50, keepLast: 30 },
    { path: "server/microtasks.json", maxEntries: 100, keepLast: 50 },
    { path: "server/compressed-memory.json", maxEntries: 50, keepLast: 30 },
    { path: "server/learned-behaviors.json", maxEntries: 100, keepLast: 50 },
    { path: "server/profit-circulator-state.json", maxEntries: 50, keepLast: 30 },
    { path: "server/sovereign-training-log.json", maxEntries: 200, keepLast: 100 },
    { path: "server/fleet-state.json", maxEntries: 100, keepLast: 50 },
    { path: "server/world-state.json", maxEntries: 50, keepLast: 30 },
  ];
  let compacted = 0;

  for (const config of JSON_DATA_FILES) {
    try {
      const filePath = path.resolve(config.path);
      if (!fs.existsSync(filePath)) continue;
      const stat = fs.statSync(filePath);
      if (stat.size < 100 * 1024) continue;

      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);

      let changed = false;
      if (Array.isArray(data) && data.length > config.maxEntries) {
        const trimmed = data.slice(-config.keepLast);
        const compactStr = JSON.stringify(trimmed);
        fs.writeFileSync(filePath, compactStr, "utf8");
        report.bytesFreed += stat.size - compactStr.length;
        changed = true;
        report.details.push(`Compacted ${config.path}: ${data.length} → ${trimmed.length} entries (saved ${((stat.size - compactStr.length) / 1024).toFixed(1)} KB)`);
      } else if (typeof data === "object" && !Array.isArray(data)) {
        let trimmedAny = false;
        for (const k of Object.keys(data)) {
          if (Array.isArray(data[k]) && data[k].length > config.maxEntries) {
            data[k] = data[k].slice(-config.keepLast);
            trimmedAny = true;
          }
          if (typeof data[k] === "object" && !Array.isArray(data[k]) && data[k] !== null) {
            for (const k2 of Object.keys(data[k])) {
              if (Array.isArray(data[k][k2]) && data[k][k2].length > config.maxEntries) {
                data[k][k2] = data[k][k2].slice(-config.keepLast);
                trimmedAny = true;
              }
            }
          }
        }
        const compactStr = JSON.stringify(data);
        if (trimmedAny || compactStr.length < raw.length * 0.8) {
          fs.writeFileSync(filePath, compactStr, "utf8");
          report.bytesFreed += raw.length - compactStr.length;
          changed = true;
          report.details.push(`Compacted ${config.path}: trimmed nested arrays (saved ${((raw.length - compactStr.length) / 1024).toFixed(1)} KB)`);
        }
      }

      if (changed) compacted++;
    } catch {}
  }

  if (compacted > 0) {
    report.details.push(`JSON data compaction: ${compacted} files processed`);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startAutoCleanup(): void {
  if (cleanupInterval) return;
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  cleanupInterval = setInterval(async () => {
    console.log("[Cleanup] Running scheduled 6h cleanup...");
    try {
      const report = await runCleanup();
      console.log("[Cleanup] Complete: " + report.notesDeleted + " notes deleted, " + report.filesDeleted + " files removed, " + report.duplicatesRemoved + " duplicates cleared");
    } catch (err) {
      console.error("[Cleanup] Scheduled cleanup failed:", err);
    }
  }, SIX_HOURS);

  setTimeout(async () => {
    console.log("[Cleanup] Running initial startup cleanup...");
    try {
      await runCleanup();
    } catch {}
  }, 60000);
}

export function stopAutoCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
