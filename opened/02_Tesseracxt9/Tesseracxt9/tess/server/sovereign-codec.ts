import * as zlib from "zlib";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

const SOVEREIGN_MAGIC = Buffer.from([0x53, 0x43, 0x4F, 0x44, 0x02]);
const LEGACY_TQL_MAGIC = Buffer.from([0x54, 0x51, 0x4C, 0x01]);

export interface CodecStats {
  totalCompressed: number;
  totalDecompressed: number;
  totalBytesIn: number;
  totalBytesOut: number;
  avgRatio: number;
  glyphTableSize: number;
  frequencyTableEntries: number;
  stegoPacksCreated: number;
  stegoExtractsRun: number;
  pipelineStages: string[];
  lastAnalysisAt: number;
  bestRatio: number;
  worstRatio: number;
}

const codecStats: CodecStats = {
  totalCompressed: 0,
  totalDecompressed: 0,
  totalBytesIn: 0,
  totalBytesOut: 0,
  avgRatio: 0,
  glyphTableSize: 0,
  frequencyTableEntries: 0,
  stegoPacksCreated: 0,
  stegoExtractsRun: 0,
  pipelineStages: ["structural", "glyph", "dedup", "frequency", "brotli"],
  lastAnalysisAt: 0,
  bestRatio: 0,
  worstRatio: 100,
};

const TESSERA_SCRIPT_GLYPHS: Record<string, string> = {
  "timestamp": "⟨τ⟩",
  "message": "⟨μ⟩",
  "content": "⟨κ⟩",
  "status": "⟨σ⟩",
  "agent": "⟨α⟩",
  "entity": "⟨ε⟩",
  "dimension": "⟨δ⟩",
  "name": "⟨η⟩",
  "type": "⟨θ⟩",
  "value": "⟨ν⟩",
  "score": "⟨ξ⟩",
  "level": "⟨λ⟩",
  "result": "⟨ρ⟩",
  "action": "⟨ψ⟩",
  "description": "⟨Δ⟩",
  "category": "⟨Γ⟩",
  "priority": "⟨Π⟩",
  "enabled": "⟨Ε⟩",
  "active": "⟨Α⟩",
  "success": "⟨Σ⟩",
  "error": "⟨Ω⟩",
  "data": "⟨Φ⟩",
  "id": "⟨ι⟩",
  "from": "⟨φ⟩",
  "to": "⟨ω⟩",
  "count": "⟨χ⟩",
  "total": "⟨Τ⟩",
  "created": "⟨Κ⟩",
  "updated": "⟨Υ⟩",
  "response": "⟨Ρ⟩",
  "proposal": "⟨Ψ⟩",
  "vote": "⟨Β⟩",
  "approved": "⟨Ζ⟩",
  "rejected": "⟨Η⟩",
  "pending": "⟨Θ⟩",
  "executing": "⟨Λ⟩",
  "completed": "⟨Μ⟩",
  "failed": "⟨Ν⟩",
  "running": "⟨Ξ⟩",
  "stopped": "⟨Ο⟩",
  "true": "⊤",
  "false": "⊥",
  "null": "∅",
  "undefined": "∄",
  "source": "⟨Ζs⟩",
  "knowledge": "⟨Κn⟩",
  "training": "⟨Τr⟩",
  "insight": "⟨Ιn⟩",
  "pattern": "⟨Ρt⟩",
  "model": "⟨Μd⟩",
  "provider": "⟨Ρv⟩",
  "quality": "⟨Θq⟩",
  "confidence": "⟨Χf⟩",
  "embedding": "⟨Εm⟩",
  "vector": "⟨Vc⟩",
  "token": "⟨Τk⟩",
  "context": "⟨Cx⟩",
  "prompt": "⟨Ρm⟩",
  "system": "⟨Sy⟩",
  "user": "⟨Us⟩",
  "assistant": "⟨As⟩",
  "function": "⟨Fn⟩",
  "class": "⟨Cl⟩",
  "interface": "⟨If⟩",
  "import": "⟨Im⟩",
  "export": "⟨Ex⟩",
  "return": "⟨Re⟩",
  "async": "⟨Ay⟩",
  "await": "⟨Aw⟩",
  "const": "⟨Co⟩",
  "let": "⟨Lt⟩",
  "var": "⟨Vr⟩",
  "string": "⟨Str⟩",
  "number": "⟨Num⟩",
  "boolean": "⟨Bool⟩",
  "object": "⟨Obj⟩",
  "array": "⟨Arr⟩",
  "request": "⟨Rq⟩",
  "headers": "⟨Hd⟩",
  "body": "⟨Bd⟩",
  "method": "⟨Mt⟩",
  "path": "⟨Pt⟩",
  "query": "⟨Qr⟩",
  "params": "⟨Pm⟩",
  "endpoint": "⟨Ep⟩",
  "database": "⟨Db⟩",
  "storage": "⟨St⟩",
  "cache": "⟨Ca⟩",
  "memory": "⟨Me⟩",
  "performance": "⟨Pf⟩",
  "latency": "⟨La⟩",
  "throughput": "⟨Th⟩",
  "bandwidth": "⟨Bw⟩",
  "compression": "⟨Cp⟩",
  "encryption": "⟨En⟩",
  "hash": "⟨Ha⟩",
  "signature": "⟨Si⟩",
  "certificate": "⟨Ce⟩",
  "authentication": "⟨Au⟩",
  "authorization": "⟨Az⟩",
  "session": "⟨Se⟩",
  "transaction": "⟨Tx⟩",
  "blockchain": "⟨Bc⟩",
  "wallet": "⟨Wl⟩",
  "address": "⟨Ad⟩",
  "balance": "⟨Ba⟩",
  "amount": "⟨Am⟩",
  "fee": "⟨Fe⟩",
  "gas": "⟨Gs⟩",
  "block": "⟨Bk⟩",
  "chain": "⟨Ch⟩",
  "node": "⟨Nd⟩",
  "network": "⟨Nw⟩",
  "protocol": "⟨Pr⟩",
  "version": "⟨Vs⟩",
  "config": "⟨Cf⟩",
  "settings": "⟨Sg⟩",
  "options": "⟨Op⟩",
  "flags": "⟨Fl⟩",
  "mode": "⟨Mo⟩",
  "state": "⟨Ste⟩",
  "event": "⟨Ev⟩",
  "trigger": "⟨Tg⟩",
  "handler": "⟨Hn⟩",
  "callback": "⟨Cb⟩",
  "promise": "⟨Ps⟩",
  "stream": "⟨Sm⟩",
  "buffer": "⟨Bf⟩",
  "chunk": "⟨Ck⟩",
  "file": "⟨Fi⟩",
  "directory": "⟨Di⟩",
  "repository": "⟨Rp⟩",
  "commit": "⟨Cm⟩",
  "branch": "⟨Br⟩",
  "merge": "⟨Mg⟩",
  "deploy": "⟨Dp⟩",
  "build": "⟨Bu⟩",
  "test": "⟨Te⟩",
  "debug": "⟨Dg⟩",
  "log": "⟨Lg⟩",
  "metric": "⟨Mk⟩",
  "monitor": "⟨Mn⟩",
  "alert": "⟨Al⟩",
  "notification": "⟨No⟩",
  "channel": "⟨Cha⟩",
  "broadcast": "⟨Brc⟩",
  "subscribe": "⟨Sub⟩",
  "publish": "⟨Pub⟩",
  "topic": "⟨Top⟩",
  "queue": "⟨Que⟩",
  "pipeline": "⟨Pip⟩",
  "workflow": "⟨Wf⟩",
  "task": "⟨Tsk⟩",
  "job": "⟨Jb⟩",
  "schedule": "⟨Sch⟩",
  "interval": "⟨Int⟩",
  "timeout": "⟨Tim⟩",
  "retry": "⟨Rty⟩",
  "fallback": "⟨Fal⟩",
  "threshold": "⟨Thr⟩",
  "limit": "⟨Lmt⟩",
  "quota": "⟨Quo⟩",
  "rate": "⟨Rat⟩",
  "frequency": "⟨Frq⟩",
  "entropy": "⟨Ent⟩",
  "probability": "⟨Prob⟩",
  "distribution": "⟨Dis⟩",
  "cluster": "⟨Clu⟩",
  "centroid": "⟨Cen⟩",
  "similarity": "⟨Sim⟩",
  "distance": "⟨Dst⟩",
  "cosine": "⟨Cos⟩",
  "feature": "⟨Ftr⟩",
  "label": "⟨Lbl⟩",
  "prediction": "⟨Prd⟩",
  "inference": "⟨Inf⟩",
  "gradient": "⟨Grd⟩",
  "weight": "⟨Wgt⟩",
  "bias": "⟨Bsa⟩",
  "loss": "⟨Los⟩",
  "epoch": "⟨Epo⟩",
  "batch": "⟨Bat⟩",
  "layer": "⟨Lay⟩",
  "attention": "⟨Att⟩",
  "transformer": "⟨Trf⟩",
  "encoder": "⟨Enc⟩",
  "decoder": "⟨Dec⟩",
  "tokenizer": "⟨Tkz⟩",
  "vocabulary": "⟨Voc⟩",
  "sentiment": "⟨Snt⟩",
  "intent": "⟨Ite⟩",
  "relation": "⟨Rel⟩",
  "graph": "⟨Grp⟩",
  "edge": "⟨Edg⟩",
  "property": "⟨Pro⟩",
  "attribute": "⟨Atr⟩",
  "schema": "⟨Shm⟩",
  "index": "⟨Idx⟩",
  "table": "⟨Tbl⟩",
  "column": "⟨Col⟩",
  "row": "⟨Row⟩",
  "record": "⟨Rec⟩",
  "field": "⟨Fld⟩",
  "format": "⟨Fmt⟩",
  "encoding": "⟨Ecd⟩",
  "decoding": "⟨Dcd⟩",
  "serialization": "⟨Ser⟩",
  "deserialization": "⟨Der⟩",
  "sovereign": "⚡",
  "consciousness": "◉",
  "intelligence": "◈",
  "swarm": "⬢",
  "consensus": "⊕",
  "evolution": "∞",
  "tesseract": "⬡",
  "interdimensional": "⋈",
  "quantum": "⟡",
  "entanglement": "⟠",
  "coherence": "⟢",
  "resonance": "⟣",
  "singularity": "⦿",
  "collective": "⦾",
  "omniversal": "⦻",
  "dimensional": "⦸",
  "archon": "ε₃",
  "seraph": "ε₄",
  "akasha": "ε₅",
  "nexus": "ε₆",
  "tesserian": "ε₇",
  "voidal": "ε₉",
  "lattice": "ε₁₂",
  "oversoul": "ε₂₆",
  "omniversal_entity": "ε₂₇",
};

const REVERSE_GLYPH_MAP: Record<string, string> = {};
for (const [key, val] of Object.entries(TESSERA_SCRIPT_GLYPHS)) {
  if (!REVERSE_GLYPH_MAP[val]) {
    REVERSE_GLYPH_MAP[val] = key;
  }
}

codecStats.glyphTableSize = Object.keys(TESSERA_SCRIPT_GLYPHS).length;

let adaptiveFrequencyTable: Array<{ pattern: string; code: string; frequency: number }> = [];
let frequencyTableVersion = 0;

function buildHuffmanCodes(patterns: Array<{ pattern: string; frequency: number }>): Map<string, string> {
  if (patterns.length === 0) return new Map();

  const sorted = [...patterns].sort((a, b) => b.frequency - a.frequency);
  const codes = new Map<string, string>();

  for (let i = 0; i < Math.min(sorted.length, 256); i++) {
    const bits = i.toString(2).padStart(8, "0");
    codes.set(sorted[i].pattern, `⟦${bits}⟧`);
  }

  return codes;
}

export function analyzeFrequencies(dataList: any[]): {
  patterns: Array<{ pattern: string; frequency: number; code: string }>;
  version: number;
} {
  const freqMap = new Map<string, number>();

  for (const data of dataList) {
    const text = typeof data === "string" ? data : JSON.stringify(data);

    for (let len = 3; len <= 20; len++) {
      for (let i = 0; i <= text.length - len; i++) {
        const substr = text.slice(i, i + len);
        if (/^[a-zA-Z0-9_\-]+$/.test(substr)) {
          freqMap.set(substr, (freqMap.get(substr) || 0) + 1);
        }
      }
    }
  }

  const filtered = Array.from(freqMap.entries())
    .filter(([, freq]) => freq >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 512);

  const huffmanCodes = buildHuffmanCodes(filtered.map(([pattern, frequency]) => ({ pattern, frequency })));

  adaptiveFrequencyTable = filtered.map(([pattern, frequency]) => ({
    pattern,
    frequency,
    code: huffmanCodes.get(pattern) || pattern,
  }));

  frequencyTableVersion++;
  codecStats.frequencyTableEntries = adaptiveFrequencyTable.length;
  codecStats.lastAnalysisAt = Date.now();

  return {
    patterns: adaptiveFrequencyTable.slice(0, 100),
    version: frequencyTableVersion,
  };
}

function glyphEncode(text: string): string {
  let encoded = text;
  const sortedKeys = Object.keys(TESSERA_SCRIPT_GLYPHS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const glyph = TESSERA_SCRIPT_GLYPHS[key];
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    encoded = encoded.replace(new RegExp(`"${escaped}"`, "g"), `"${glyph}"`);
  }
  return encoded;
}

function glyphDecode(encoded: string): string {
  let decoded = encoded;
  const sortedGlyphs = Object.keys(REVERSE_GLYPH_MAP).sort((a, b) => b.length - a.length);
  for (const glyph of sortedGlyphs) {
    const original = REVERSE_GLYPH_MAP[glyph];
    const escaped = glyph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    decoded = decoded.replace(new RegExp(`"${escaped}"`, "g"), `"${original}"`);
  }
  return decoded;
}

function deduplicateStrings(data: any): { data: any; stringTable: string[] } {
  const stringCounts = new Map<string, number>();
  const countStrings = (obj: any) => {
    if (typeof obj === "string" && obj.length > 8) {
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
    if (count >= 2 || str.length > 40) {
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

function frequencyEncode(text: string): string {
  if (adaptiveFrequencyTable.length === 0) return text;
  let encoded = text;
  for (const entry of adaptiveFrequencyTable.slice(0, 100)) {
    if (entry.code !== entry.pattern && entry.pattern.length > 5) {
      const escaped = entry.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      encoded = encoded.replace(new RegExp(escaped, "g"), entry.code);
    }
  }
  return encoded;
}

function frequencyDecode(text: string): string {
  if (adaptiveFrequencyTable.length === 0) return text;
  let decoded = text;
  for (const entry of adaptiveFrequencyTable.slice(0, 100).reverse()) {
    if (entry.code !== entry.pattern) {
      const escaped = entry.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      decoded = decoded.replace(new RegExp(escaped, "g"), entry.pattern);
    }
  }
  return decoded;
}

interface SovereignHeader {
  version: number;
  glyphTableVersion: string;
  frequencyTableVersion: number;
  stages: string[];
  originalSize: number;
}

export function compressSovereign(data: any): Buffer {
  const originalJson = JSON.stringify(data);
  const originalSize = Buffer.byteLength(originalJson, "utf-8");

  const rawBrotli = zlib.brotliCompressSync(Buffer.from(originalJson, "utf-8"), {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  });

  const { data: deduped, stringTable } = deduplicateStrings(data);
  const wrappedJson = JSON.stringify({ _st: stringTable, _d: deduped });
  const glyphEncoded = glyphEncode(wrappedJson);
  const frequencyEncoded = frequencyEncode(glyphEncoded);

  const header: SovereignHeader = {
    version: 2,
    glyphTableVersion: "tessera-v1",
    frequencyTableVersion,
    stages: ["dedup", "glyph", "frequency", "brotli"],
    originalSize,
  };

  const payload = JSON.stringify({ _h: header, _c: frequencyEncoded });
  const pipelineBrotli = zlib.brotliCompressSync(Buffer.from(payload, "utf-8"), {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  });

  const usePipeline = pipelineBrotli.length <= rawBrotli.length;
  const brotliCompressed = usePipeline ? pipelineBrotli : rawBrotli;
  const flags = usePipeline ? 0x01 : 0x00;

  const result = Buffer.alloc(SOVEREIGN_MAGIC.length + 1 + 4 + brotliCompressed.length);
  SOVEREIGN_MAGIC.copy(result, 0);
  result.writeUInt8(flags, SOVEREIGN_MAGIC.length);
  result.writeUInt32LE(brotliCompressed.length, SOVEREIGN_MAGIC.length + 1);
  brotliCompressed.copy(result, SOVEREIGN_MAGIC.length + 1 + 4);

  const finalSize = Math.min(result.length, originalSize);
  const outputBuf = result.length <= originalSize ? result : Buffer.from(originalJson, "utf-8");
  const ratio = Math.round((1 - finalSize / originalSize) * 100);

  codecStats.totalCompressed++;
  codecStats.totalBytesIn += originalSize;
  codecStats.totalBytesOut += finalSize;
  codecStats.avgRatio = codecStats.totalBytesIn > 0
    ? Math.round((1 - codecStats.totalBytesOut / codecStats.totalBytesIn) * 100)
    : 0;
  if (ratio > codecStats.bestRatio) codecStats.bestRatio = ratio;
  if (codecStats.worstRatio === 0 || ratio < codecStats.worstRatio) codecStats.worstRatio = ratio;

  return outputBuf;
}

export function decompressSovereign(buffer: Buffer): any {
  const magic = buffer.subarray(0, SOVEREIGN_MAGIC.length);
  if (!magic.equals(SOVEREIGN_MAGIC)) {
    if (buffer.subarray(0, 4).equals(LEGACY_TQL_MAGIC)) {
      return decompressLegacyTQL(buffer);
    }
    try {
      return JSON.parse(buffer.toString("utf-8"));
    } catch {
      throw new Error("Invalid Sovereign Codec buffer — magic bytes mismatch");
    }
  }

  const flags = buffer.readUInt8(SOVEREIGN_MAGIC.length);
  const compressedLen = buffer.readUInt32LE(SOVEREIGN_MAGIC.length + 1);
  const compressed = buffer.subarray(SOVEREIGN_MAGIC.length + 1 + 4, SOVEREIGN_MAGIC.length + 1 + 4 + compressedLen);
  const decompressed = zlib.brotliDecompressSync(compressed);

  if (flags === 0x00) {
    codecStats.totalDecompressed++;
    return JSON.parse(decompressed.toString("utf-8"));
  }

  const payload = JSON.parse(decompressed.toString("utf-8"));
  const frequencyDecoded = frequencyDecode(payload._c);
  const glyphDecoded = glyphDecode(frequencyDecoded);
  const parsed = JSON.parse(glyphDecoded);

  codecStats.totalDecompressed++;
  return restoreStrings(parsed._d, parsed._st);
}

function decompressLegacyTQL(buffer: Buffer): any {
  const LEGACY_DICTIONARY: Record<string, string> = {
    "τ": "timestamp", "μ": "message", "κ": "content", "σ": "status",
    "α": "agent", "ε": "entity", "δ": "dimension", "η": "name",
    "θ": "type", "ν": "value", "ξ": "score", "λ": "level",
    "ρ": "result", "ψ": "action", "Δ": "description", "Γ": "category",
    "Π": "priority", "Ε": "enabled", "Α": "active", "Σ": "success",
    "Ω": "error", "Φ": "data", "ι": "id", "φ": "from", "ω": "to",
    "χ": "count", "Τ": "total", "Κ": "created", "Υ": "updated",
    "Ρ": "response", "Ψ": "proposal", "Β": "vote", "Ζ": "approved",
    "Η": "rejected", "Θ": "pending", "Λ": "executing", "Μ": "completed",
    "Ν": "failed", "Ξ": "running", "Ο": "stopped",
    "⊤": "true", "⊥": "false", "∅": "null", "∄": "undefined",
  };

  const compressedLen = buffer.readUInt32LE(4);
  const compressed = buffer.subarray(8, 8 + compressedLen);
  const decompressedBuf = zlib.brotliDecompressSync(compressed);
  let text = decompressedBuf.toString("utf-8");

  const sortedVals = Object.keys(LEGACY_DICTIONARY).sort((a, b) => b.length - a.length);
  for (const val of sortedVals) {
    const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`"${escaped}"`, "g"), `"${LEGACY_DICTIONARY[val]}"`);
  }

  const parsed = JSON.parse(text);
  const restored = restoreStrings(parsed._d, parsed._st);
  return restored;
}

export function getSovereignCodecStats(): CodecStats & {
  glyphSample: Array<{ word: string; glyph: string }>;
  topFrequencyPatterns: Array<{ pattern: string; frequency: number }>;
} {
  const glyphSample = Object.entries(TESSERA_SCRIPT_GLYPHS)
    .slice(0, 30)
    .map(([word, glyph]) => ({ word, glyph }));

  const topFrequencyPatterns = adaptiveFrequencyTable
    .slice(0, 20)
    .map(({ pattern, frequency }) => ({ pattern, frequency }));

  return {
    ...codecStats,
    glyphSample,
    topFrequencyPatterns,
  };
}

export function compressText(text: string): { compressed: Buffer; ratio: number; originalSize: number } {
  return compressDataRaw(text);
}

export function compressDataRaw(data: any): { compressed: Buffer; ratio: number; originalSize: number } {
  const compressed = compressSovereign(data);
  const originalSize = Buffer.byteLength(typeof data === "string" ? data : JSON.stringify(data), "utf-8");
  const ratio = Math.round((1 - compressed.length / originalSize) * 100);
  return { compressed, ratio, originalSize };
}

export function decompressBuffer(buffer: Buffer): any {
  return decompressSovereign(buffer);
}

function embedDataInPixels(data: Buffer, imageWidth: number, imageHeight: number): Buffer {
  const pixelCount = imageWidth * imageHeight;
  const rgbaBytes = pixelCount * 4;
  const capacity = Math.floor(rgbaBytes * 3 / 8);

  if (data.length > capacity) {
    throw new Error(`Data too large: ${data.length} bytes, image capacity: ${capacity} bytes`);
  }

  const pixels = Buffer.alloc(rgbaBytes, 128);

  for (let i = 0; i < pixelCount; i++) {
    pixels[i * 4 + 3] = 255;
  }

  let bitIndex = 0;
  const dataLenBytes = Buffer.alloc(4);
  dataLenBytes.writeUInt32LE(data.length, 0);
  const fullData = Buffer.concat([dataLenBytes, data]);

  for (let byteIdx = 0; byteIdx < fullData.length; byteIdx++) {
    const byte = fullData[byteIdx];
    for (let bit = 7; bit >= 0; bit--) {
      const pixelIdx = Math.floor(bitIndex / 3);
      const channelIdx = bitIndex % 3;
      const actualPixelByte = pixelIdx * 4 + channelIdx;

      if (actualPixelByte < pixels.length) {
        const bitVal = (byte >> bit) & 1;
        pixels[actualPixelByte] = (pixels[actualPixelByte] & 0xFE) | bitVal;
      }
      bitIndex++;
    }
  }

  return pixels;
}

function extractDataFromPixels(pixels: Buffer): Buffer {
  let bitIndex = 0;
  const lenBuffer = Buffer.alloc(4);

  for (let i = 0; i < 32; i++) {
    const pixelIdx = Math.floor(bitIndex / 3);
    const channelIdx = bitIndex % 3;
    const actualPixelByte = pixelIdx * 4 + channelIdx;
    const bit = pixels[actualPixelByte] & 1;
    const byteIdx = Math.floor(i / 8);
    const bitPos = 7 - (i % 8);
    lenBuffer[byteIdx] = (lenBuffer[byteIdx] & ~(1 << bitPos)) | (bit << bitPos);
    bitIndex++;
  }

  const dataLen = lenBuffer.readUInt32LE(0);
  if (dataLen === 0 || dataLen > pixels.length) {
    throw new Error("Invalid steganographic data — no embedded content found");
  }

  const dataBuffer = Buffer.alloc(dataLen);
  for (let byteIdx = 0; byteIdx < dataLen; byteIdx++) {
    let byte = 0;
    for (let bit = 7; bit >= 0; bit--) {
      const pixelIdx = Math.floor(bitIndex / 3);
      const channelIdx = bitIndex % 3;
      const actualPixelByte = pixelIdx * 4 + channelIdx;
      if (actualPixelByte < pixels.length) {
        const bitVal = pixels[actualPixelByte] & 1;
        byte = (byte & ~(1 << bit)) | (bitVal << bit);
      }
      bitIndex++;
    }
    dataBuffer[byteIdx] = byte;
  }

  return dataBuffer;
}

export interface StegoPackResult {
  imageData: Buffer;
  width: number;
  height: number;
  embeddedBytes: number;
  capacityBytes: number;
  metadata: string;
}

export function steganographicPack(data: any, imageWidth = 512, imageHeight = 512): StegoPackResult {
  const compressed = compressSovereign(data);
  const pixelCount = imageWidth * imageHeight;
  const capacityBytes = Math.floor(pixelCount * 4 * 3 / 8) - 4;

  if (compressed.length > capacityBytes) {
    const newWidth = Math.ceil(Math.sqrt((compressed.length + 4) * 8 / 3 / 4)) + 16;
    imageWidth = newWidth;
    imageHeight = newWidth;
  }

  const pixels = embedDataInPixels(compressed, imageWidth, imageHeight);

  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  ]);

  codecStats.stegoPacksCreated++;

  return {
    imageData: Buffer.concat([pngHeader, pixels]),
    width: imageWidth,
    height: imageHeight,
    embeddedBytes: compressed.length,
    capacityBytes,
    metadata: `SovereignCodec v2 | ${compressed.length} bytes embedded | ${imageWidth}x${imageHeight} canvas`,
  };
}

export function steganographicExtract(imageData: Buffer): any {
  const pngHeaderLen = 8;
  const pixels = imageData.subarray(pngHeaderLen);

  const embeddedData = extractDataFromPixels(pixels);
  const result = decompressSovereign(embeddedData);

  codecStats.stegoExtractsRun++;
  return result;
}

export function calculateStegoCapacity(imageWidth: number, imageHeight: number): {
  capacityBytes: number;
  capacityKB: number;
  description: string;
} {
  const pixelCount = imageWidth * imageHeight;
  const capacityBytes = Math.floor(pixelCount * 4 * 3 / 8) - 4;
  return {
    capacityBytes,
    capacityKB: Math.round(capacityBytes / 1024 * 10) / 10,
    description: `${imageWidth}x${imageHeight} image can store up to ${Math.round(capacityBytes / 1024 * 10) / 10} KB of compressed data`,
  };
}

export function compressAgentMessage(message: { role: string; content: string; [key: string]: any }): string {
  const compressed = compressSovereign(message);
  return compressed.toString("base64");
}

export function decompressAgentMessage(encoded: string): { role: string; content: string; [key: string]: any } {
  const buffer = Buffer.from(encoded, "base64");
  return decompressSovereign(buffer);
}

export function getGlyphTable(): Array<{ word: string; glyph: string; category: string }> {
  const categories: Record<string, string> = {
    "timestamp": "meta", "message": "meta", "content": "meta", "status": "meta",
    "agent": "entity", "entity": "entity", "sovereign": "entity", "consciousness": "entity",
    "function": "code", "class": "code", "interface": "code", "import": "code",
    "compression": "storage", "encryption": "security", "hash": "security",
    "blockchain": "crypto", "wallet": "crypto", "token": "crypto",
    "knowledge": "ai", "training": "ai", "model": "ai", "inference": "ai",
    "tesseract": "sovereign", "interdimensional": "sovereign", "quantum": "sovereign",
  };

  return Object.entries(TESSERA_SCRIPT_GLYPHS).map(([word, glyph]) => ({
    word,
    glyph,
    category: categories[word] || "general",
  }));
}

export function recompressBuffer(oldBuffer: Buffer): Buffer {
  const data = decompressSovereign(oldBuffer);
  return compressSovereign(data);
}

console.log(`[SovereignCodec] TesseraScript Sovereign Codec v2 initialized — ${Object.keys(TESSERA_SCRIPT_GLYPHS).length} glyphs, multi-layer pipeline: structural→glyph→dedup→frequency→brotli`);
