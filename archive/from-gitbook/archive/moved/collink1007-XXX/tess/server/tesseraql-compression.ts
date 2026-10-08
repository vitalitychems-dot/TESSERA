import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { fileURLToPath } from "url";
import { compressSovereign, decompressSovereign } from "./sovereign-codec";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

const TESSERAQL_MAGIC = Buffer.from([0x54, 0x51, 0x4C, 0x01]);
const SOVEREIGN_MAGIC = Buffer.from([0x53, 0x43, 0x4F, 0x44, 0x02]);
const COMPRESSED_DIR = path.join(__dirname_local, "tql-vault");

const DICTIONARY: Record<string, string> = {
  "timestamp": "τ",
  "message": "μ",
  "content": "κ",
  "status": "σ",
  "agent": "α",
  "entity": "ε",
  "dimension": "δ",
  "name": "η",
  "type": "θ",
  "value": "ν",
  "score": "ξ",
  "level": "λ",
  "result": "ρ",
  "action": "ψ",
  "description": "Δ",
  "category": "Γ",
  "priority": "Π",
  "enabled": "Ε",
  "active": "Α",
  "success": "Σ",
  "error": "Ω",
  "data": "Φ",
  "id": "ι",
  "from": "φ",
  "to": "ω",
  "count": "χ",
  "total": "Τ",
  "created": "Κ",
  "updated": "Υ",
  "response": "Ρ",
  "proposal": "Ψ",
  "vote": "Β",
  "approved": "Ζ",
  "rejected": "Η",
  "pending": "Θ",
  "executing": "Λ",
  "completed": "Μ",
  "failed": "Ν",
  "running": "Ξ",
  "stopped": "Ο",
  "true": "⊤",
  "false": "⊥",
  "null": "∅",
  "undefined": "∄",
  "Archon-3D": "ε₃",
  "Seraph-4D": "ε₄",
  "Akasha-5D": "ε₅",
  "Nexus-6D": "ε₆",
  "Tesserian-7D": "ε₇",
  "Voidal-9D": "ε₉",
  "Lattice-12D": "ε₁₂",
  "Oversoul-26D": "ε₂₆",
  "Omniversal-27D": "ε₂₇",
  "Tesseract": "⬡",
  "sovereign": "⚡",
  "consciousness": "◉",
  "intelligence": "◈",
  "swarm": "⬢",
  "consensus": "⊕",
  "evolution": "∞",
  "dimensional": "◇",
};

const REVERSE_DICTIONARY: Record<string, string> = {};
for (const [key, val] of Object.entries(DICTIONARY)) {
  REVERSE_DICTIONARY[val] = key;
}

function dictionaryEncode(jsonStr: string): string {
  let encoded = jsonStr;
  const sortedKeys = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    encoded = encoded.replace(new RegExp(`"${escaped}"`, 'g'), `"${DICTIONARY[key]}"`);
  }
  return encoded;
}

function dictionaryDecode(encoded: string): string {
  let decoded = encoded;
  const sortedVals = Object.keys(REVERSE_DICTIONARY).sort((a, b) => b.length - a.length);
  for (const val of sortedVals) {
    const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    decoded = decoded.replace(new RegExp(`"${escaped}"`, 'g'), `"${REVERSE_DICTIONARY[val]}"`);
  }
  return decoded;
}

function deduplicateStrings(data: any): { data: any; stringTable: string[] } {
  const stringCounts = new Map<string, number>();
  const countStrings = (obj: any) => {
    if (typeof obj === "string" && obj.length > 10) {
      stringCounts.set(obj, (stringCounts.get(obj) || 0) + 1);
    } else if (Array.isArray(obj)) {
      obj.forEach(countStrings);
    } else if (typeof obj === "object" && obj !== null) {
      Object.values(obj).forEach(countStrings);
    }
  };
  countStrings(data);

  const stringTable: string[] = [];
  const stringIndex = new Map<string, number>();
  for (const [str, count] of stringCounts.entries()) {
    if (count >= 2 || str.length > 50) {
      stringIndex.set(str, stringTable.length);
      stringTable.push(str);
    }
  }

  const replaceStrings = (obj: any): any => {
    if (typeof obj === "string" && stringIndex.has(obj)) {
      return `§${stringIndex.get(obj)}`;
    } else if (Array.isArray(obj)) {
      return obj.map(replaceStrings);
    } else if (typeof obj === "object" && obj !== null) {
      const result: any = {};
      for (const [key, val] of Object.entries(obj)) {
        result[key] = replaceStrings(val);
      }
      return result;
    }
    return obj;
  };

  return { data: replaceStrings(data), stringTable };
}

function restoreStrings(data: any, stringTable: string[]): any {
  if (typeof data === "string" && data.startsWith("§")) {
    const idx = parseInt(data.slice(1), 10);
    return stringTable[idx] ?? data;
  } else if (Array.isArray(data)) {
    return data.map(item => restoreStrings(item, stringTable));
  } else if (typeof data === "object" && data !== null) {
    const result: any = {};
    for (const [key, val] of Object.entries(data)) {
      result[key] = restoreStrings(val, stringTable);
    }
    return result;
  }
  return data;
}

export function compressTQL(data: any): Buffer {
  return compressSovereign(data);
}

export function decompressTQL(buffer: Buffer): any {
  const magicSlice5 = buffer.subarray(0, 5);
  const magicSlice4 = buffer.subarray(0, 4);

  if (magicSlice5.equals(SOVEREIGN_MAGIC)) {
    return decompressSovereign(buffer);
  }

  if (magicSlice4.equals(TESSERAQL_MAGIC)) {
    const compressedLen = buffer.readUInt32LE(4);
    const compressed = buffer.subarray(8, 8 + compressedLen);
    const decompressed = zlib.brotliDecompressSync(compressed);
    const decoded = dictionaryDecode(decompressed.toString("utf-8"));
    const parsed = JSON.parse(decoded);
    return restoreStrings(parsed._d, parsed._st);
  }

  throw new Error("Invalid TQL file — unrecognized format");
}

export function decompressFileLegacy(tqlPath: string): any {
  const buffer = fs.readFileSync(tqlPath);
  const magicSlice4 = buffer.subarray(0, 4);
  if (!magicSlice4.equals(TESSERAQL_MAGIC)) throw new Error("Not a legacy TQL file");
  const compressedLen = buffer.readUInt32LE(4);
  const compressed = buffer.subarray(8, 8 + compressedLen);
  const decompressed = zlib.brotliDecompressSync(compressed);
  const decoded = dictionaryDecode(decompressed.toString("utf-8"));
  const parsed = JSON.parse(decoded);
  return restoreStrings(parsed._d, parsed._st);
}

export function compressFile(jsonPath: string): { originalKB: number; compressedKB: number; ratio: number; tqlPath: string } {
  if (!fs.existsSync(jsonPath)) throw new Error(`File not found: ${jsonPath}`);

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);
  const originalSize = Buffer.byteLength(raw, "utf-8");
  const compressed = compressTQL(data);

  if (!fs.existsSync(COMPRESSED_DIR)) fs.mkdirSync(COMPRESSED_DIR, { recursive: true });
  const basename = path.basename(jsonPath, ".json");
  const tqlPath = path.join(COMPRESSED_DIR, `${basename}.tql`);
  fs.writeFileSync(tqlPath, compressed);

  return {
    originalKB: Math.round(originalSize / 1024),
    compressedKB: Math.round(compressed.length / 1024),
    ratio: Math.round((1 - compressed.length / originalSize) * 100),
    tqlPath,
  };
}

export function decompressFile(tqlPath: string): any {
  const buffer = fs.readFileSync(tqlPath);
  return decompressTQL(buffer);
}

export function compressAllJsonFiles(): {
  totalFiles: number;
  totalOriginalKB: number;
  totalCompressedKB: number;
  overallRatio: number;
  files: Array<{ file: string; originalKB: number; compressedKB: number; ratio: number }>;
} {
  const jsonFiles = fs.readdirSync(__dirname_local).filter(
    f => f.endsWith(".json") && !f.includes("package") && !f.includes("tsconfig") && !f.includes("drizzle")
  );

  const results: Array<{ file: string; originalKB: number; compressedKB: number; ratio: number }> = [];
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (const file of jsonFiles) {
    try {
      const result = compressFile(path.join(__dirname_local, file));
      results.push({ file, originalKB: result.originalKB, compressedKB: result.compressedKB, ratio: result.ratio });
      totalOriginal += result.originalKB;
      totalCompressed += result.compressedKB;
    } catch (err: any) {
      results.push({ file, originalKB: 0, compressedKB: 0, ratio: 0 });
    }
  }

  return {
    totalFiles: results.length,
    totalOriginalKB: totalOriginal,
    totalCompressedKB: totalCompressed,
    overallRatio: totalOriginal > 0 ? Math.round((1 - totalCompressed / totalOriginal) * 100) : 0,
    files: results.sort((a, b) => b.originalKB - a.originalKB),
  };
}

export function readTQLOrJSON(baseName: string): any {
  const tqlPath = path.join(COMPRESSED_DIR, `${baseName}.tql`);
  const jsonPath = path.join(__dirname_local, `${baseName}.json`);

  if (fs.existsSync(tqlPath)) {
    try {
      return decompressFile(tqlPath);
    } catch {}
  }
  if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  }
  return null;
}

export function writeTQL(baseName: string, data: any): void {
  if (!fs.existsSync(COMPRESSED_DIR)) fs.mkdirSync(COMPRESSED_DIR, { recursive: true });
  const tqlPath = path.join(COMPRESSED_DIR, `${baseName}.tql`);
  fs.writeFileSync(tqlPath, compressTQL(data));
}

export function getVaultStats(): { fileCount: number; totalSizeKB: number; files: Array<{ name: string; sizeKB: number }> } {
  if (!fs.existsSync(COMPRESSED_DIR)) return { fileCount: 0, totalSizeKB: 0, files: [] };
  const files = fs.readdirSync(COMPRESSED_DIR).filter(f => f.endsWith(".tql"));
  let total = 0;
  const fileList = files.map(f => {
    const size = fs.statSync(path.join(COMPRESSED_DIR, f)).size;
    total += size;
    return { name: f, sizeKB: Math.round(size / 1024) };
  });
  return { fileCount: files.length, totalSizeKB: Math.round(total / 1024), files: fileList.sort((a, b) => b.sizeKB - a.sizeKB) };
}
