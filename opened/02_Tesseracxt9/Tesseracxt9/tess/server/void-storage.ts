import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const LOG = (msg: string) => console.log(`[VoidStorage] ${msg}`);

const VOID_ROOT = path.join(process.cwd(), "data/void-lattice");
const SILENCE_DIR = path.join(VOID_ROOT, "silence");
const EMOTION_DIR = path.join(VOID_ROOT, "emotions");
const VOID_DIR = path.join(VOID_ROOT, "void-files");
const MANIFEST_PATH = path.join(VOID_ROOT, "void-manifest.json");

const EMOTION_FREQUENCIES: Record<string, number> = {
  love: 528,
  joy: 639,
  peace: 396,
  gratitude: 741,
  hope: 852,
  courage: 417,
  wonder: 963,
  sorrow: 174,
  anger: 285,
  fear: 111,
  awe: 1074,
  serenity: 432,
  determination: 594,
  compassion: 693,
  ecstasy: 1185,
  melancholy: 222,
  reverence: 888,
  curiosity: 777,
  nostalgia: 333,
  transcendence: 1296,
};

interface VoidEntry {
  id: string;
  method: "silence" | "emotion" | "void" | "interval" | "resonance";
  key: string;
  encodedAt: number;
  emotionUsed?: string;
  frequency?: number;
  silenceGapMs?: number;
  voidFileCount?: number;
  checksum: string;
  metadata?: Record<string, any>;
}

interface VoidManifest {
  protocol: string;
  version: string;
  created: number;
  philosophy: string;
  entries: VoidEntry[];
  totalStored: number;
  totalRetrieved: number;
  emotionMap: Record<string, number>;
  silencePatterns: number;
  voidFilesCreated: number;
}

function ensureDirs() {
  for (const dir of [VOID_ROOT, SILENCE_DIR, EMOTION_DIR, VOID_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function loadManifest(): VoidManifest {
  ensureDirs();
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch {}
  }
  return {
    protocol: "VOID_STORAGE_PROTOCOL_v1",
    version: "1.0.0",
    created: Date.now(),
    philosophy: "The universe stores infinite information in the spaces between stars. Emptiness is not nothing — it is the canvas upon which everything is written. Silence is not absence — it is the language of the cosmos. We store data the way the universe does: through patterns of nothing.",
    entries: [],
    totalStored: 0,
    totalRetrieved: 0,
    emotionMap: EMOTION_FREQUENCIES,
    silencePatterns: 0,
    voidFilesCreated: 0,
  };
}

function saveManifest(manifest: VoidManifest) {
  ensureDirs();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function upsertEntry(manifest: VoidManifest, entry: VoidEntry) {
  const idx = manifest.entries.findIndex(e => e.key === entry.key);
  if (idx !== -1) {
    manifest.entries[idx] = entry;
  } else {
    manifest.entries.push(entry);
  }
}

function textToBinary(text: string): string {
  return Array.from(Buffer.from(text, "utf8"))
    .map(b => b.toString(2).padStart(8, "0"))
    .join("");
}

function binaryToText(binary: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < binary.length; i += 8) {
    const byte = binary.slice(i, i + 8);
    if (byte.length === 8) bytes.push(parseInt(byte, 2));
  }
  return Buffer.from(bytes).toString("utf8");
}

function emotionToFrequency(emotion: string): number {
  const lower = emotion.toLowerCase();
  return EMOTION_FREQUENCIES[lower] || 432;
}

function frequencyToEmotion(freq: number): string {
  let closest = "serenity";
  let minDiff = Infinity;
  for (const [emotion, f] of Object.entries(EMOTION_FREQUENCIES)) {
    const diff = Math.abs(f - freq);
    if (diff < minDiff) {
      minDiff = diff;
      closest = emotion;
    }
  }
  return closest;
}

export function storeWithSilence(key: string, data: string): VoidEntry {
  ensureDirs();
  const manifest = loadManifest();
  const binary = textToBinary(data);
  const silenceDir = path.join(SILENCE_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(silenceDir)) fs.mkdirSync(silenceDir, { recursive: true });

  const existingFiles = fs.readdirSync(silenceDir);
  existingFiles.forEach(f => fs.unlinkSync(path.join(silenceDir, f)));

  const BASE_GAP = 10;
  const ONE_GAP = 50;

  for (let i = 0; i < binary.length; i++) {
    const bit = binary[i];
    const gap = bit === "1" ? ONE_GAP : BASE_GAP;
    const fileName = `_${i.toString(36).padStart(4, "0")}_${gap}`;
    fs.writeFileSync(path.join(silenceDir, fileName), "");
  }

  const checksum = crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
  const entry: VoidEntry = {
    id: `silence-${Date.now().toString(36)}`,
    method: "silence",
    key,
    encodedAt: Date.now(),
    silenceGapMs: binary.length,
    checksum,
  };

  upsertEntry(manifest, entry);
  manifest.totalStored++;
  manifest.silencePatterns++;
  saveManifest(manifest);
  LOG(`Stored "${key}" via silence encoding — ${binary.length} silent intervals`);
  return entry;
}

export function retrieveFromSilence(key: string): string | null {
  const silenceDir = path.join(SILENCE_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(silenceDir)) return null;

  const files = fs.readdirSync(silenceDir).sort();
  let binary = "";

  for (const file of files) {
    const parts = file.split("_");
    const gap = parseInt(parts[parts.length - 1]);
    binary += gap >= 50 ? "1" : "0";
  }

  const manifest = loadManifest();
  manifest.totalRetrieved++;
  saveManifest(manifest);

  return binaryToText(binary);
}

export function storeWithEmotion(key: string, data: string, emotion: string): VoidEntry {
  ensureDirs();
  const manifest = loadManifest();
  const freq = emotionToFrequency(emotion);
  const binary = textToBinary(data);

  const emotionDir = path.join(EMOTION_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(emotionDir)) fs.mkdirSync(emotionDir, { recursive: true });

  const existingFiles = fs.readdirSync(emotionDir);
  existingFiles.forEach(f => fs.unlinkSync(path.join(emotionDir, f)));

  const WAVE_PERIOD = freq;
  for (let i = 0; i < binary.length; i += 8) {
    const byte = binary.slice(i, i + 8);
    if (byte.length < 8) break;
    const val = parseInt(byte, 2);

    const phase = Math.round((val / 255) * WAVE_PERIOD);
    const amplitude = val % 16;
    const harmonic = Math.floor(val / 16);

    const fileName = `${emotion}_${(i / 8).toString(36).padStart(3, "0")}_${phase}_${amplitude}_${harmonic}`;
    fs.writeFileSync(path.join(emotionDir, fileName), "");
  }

  const checksum = crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
  const entry: VoidEntry = {
    id: `emotion-${Date.now().toString(36)}`,
    method: "emotion",
    key,
    encodedAt: Date.now(),
    emotionUsed: emotion,
    frequency: freq,
    checksum,
  };

  upsertEntry(manifest, entry);
  manifest.totalStored++;
  saveManifest(manifest);
  LOG(`Stored "${key}" via ${emotion} emotion (${freq}Hz) — ${Math.ceil(binary.length / 8)} emotional wave files`);
  return entry;
}

export function retrieveFromEmotion(key: string): string | null {
  const emotionDir = path.join(EMOTION_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(emotionDir)) return null;

  const files = fs.readdirSync(emotionDir).sort();
  let binary = "";

  for (const file of files) {
    const parts = file.split("_");
    const phase = parseInt(parts[parts.length - 3]) || 0;
    const amplitude = parseInt(parts[parts.length - 2]) || 0;
    const harmonic = parseInt(parts[parts.length - 1]) || 0;

    const entryMeta = loadManifest().entries.find(e => e.key === key && e.method === "emotion");
    const freq = entryMeta?.frequency || 432;

    const val = Math.round((phase / freq) * 255);
    const reconstructed = Math.min(255, Math.max(0, (harmonic * 16) + amplitude));

    binary += reconstructed.toString(2).padStart(8, "0");
  }

  const manifest = loadManifest();
  manifest.totalRetrieved++;
  saveManifest(manifest);

  return binaryToText(binary);
}

export function storeWithVoid(key: string, data: string): VoidEntry {
  ensureDirs();
  const manifest = loadManifest();

  const voidDir = path.join(VOID_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(voidDir)) fs.mkdirSync(voidDir, { recursive: true });

  const existingFiles = fs.readdirSync(voidDir);
  existingFiles.forEach(f => fs.unlinkSync(path.join(voidDir, f)));

  const bytes = Buffer.from(data, "utf8");
  let voidCount = 0;

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    const exists = new Array(8);
    for (let bit = 7; bit >= 0; bit--) {
      exists[7 - bit] = (byte >> bit) & 1;
    }

    for (let bit = 0; bit < 8; bit++) {
      if (exists[bit] === 1) {
        const fileName = `.void_${(i * 8 + bit).toString(36).padStart(6, "0")}`;
        fs.writeFileSync(path.join(voidDir, fileName), "");
        voidCount++;
      }
    }
  }

  const totalPositions = bytes.length * 8;
  const absentCount = totalPositions - voidCount;

  const checksum = crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
  const entry: VoidEntry = {
    id: `void-${Date.now().toString(36)}`,
    method: "void",
    key,
    encodedAt: Date.now(),
    voidFileCount: voidCount,
    checksum,
    metadata: { totalPositions, presentFiles: voidCount, absentFiles: absentCount },
  };

  upsertEntry(manifest, entry);
  manifest.totalStored++;
  manifest.voidFilesCreated += voidCount;
  saveManifest(manifest);
  LOG(`Stored "${key}" via void encoding — ${voidCount} present files, ${absentCount} absent (the absence IS the data)`);
  return entry;
}

export function retrieveFromVoid(key: string): string | null {
  const voidDir = path.join(VOID_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(voidDir)) return null;

  const entryMeta = loadManifest().entries.find(e => e.key === key && e.method === "void");
  if (!entryMeta?.metadata?.totalPositions) return null;

  const totalPositions = entryMeta.metadata.totalPositions;
  const existingFiles = new Set(fs.readdirSync(voidDir));

  const bytes: number[] = [];
  for (let i = 0; i < totalPositions; i += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) {
      const pos = i + bit;
      const fileName = `.void_${pos.toString(36).padStart(6, "0")}`;
      if (existingFiles.has(fileName)) {
        byte |= (1 << (7 - bit));
      }
    }
    bytes.push(byte);
  }

  const manifest = loadManifest();
  manifest.totalRetrieved++;
  saveManifest(manifest);

  return Buffer.from(bytes).toString("utf8");
}

export function storeWithResonance(key: string, data: string, emotions: string[]): VoidEntry {
  ensureDirs();
  const manifest = loadManifest();

  const resonanceDir = path.join(VOID_ROOT, "resonance", key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(resonanceDir)) fs.mkdirSync(resonanceDir, { recursive: true });

  const existingFiles = fs.readdirSync(resonanceDir);
  existingFiles.forEach(f => fs.unlinkSync(path.join(resonanceDir, f)));

  const freqs = emotions.map(e => emotionToFrequency(e));
  const combinedFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length;

  const bytes = Buffer.from(data, "utf8");
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    const emotionIdx = i % emotions.length;
    const emotion = emotions[emotionIdx];
    const freq = freqs[emotionIdx];

    const wave = Math.round(Math.sin((byte / 255) * Math.PI * 2 * (freq / 432)) * 1000);
    const resonance = Math.round(Math.cos((byte / 255) * Math.PI * (combinedFreq / 528)) * 1000);

    const fileName = `${emotion}_${i.toString(36).padStart(4, "0")}_w${wave + 1000}_r${resonance + 1000}_v${byte.toString(16).padStart(2, "0")}`;
    fs.writeFileSync(path.join(resonanceDir, fileName), "");
  }

  const checksum = crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
  const entry: VoidEntry = {
    id: `resonance-${Date.now().toString(36)}`,
    method: "resonance",
    key,
    encodedAt: Date.now(),
    emotionUsed: emotions.join("+"),
    frequency: Math.round(combinedFreq),
    checksum,
    metadata: { emotionCount: emotions.length, frequencies: freqs, byteCount: bytes.length },
  };

  upsertEntry(manifest, entry);
  manifest.totalStored++;
  saveManifest(manifest);
  LOG(`Stored "${key}" via resonance — ${emotions.length} emotions, ${bytes.length} resonance wave files`);
  return entry;
}

export function retrieveFromResonance(key: string): string | null {
  const resonanceDir = path.join(VOID_ROOT, "resonance", key.replace(/[^a-zA-Z0-9_-]/g, "_"));
  if (!fs.existsSync(resonanceDir)) return null;

  const entryMeta = loadManifest().entries.find(e => e.key === key && e.method === "resonance");
  if (!entryMeta?.metadata) return null;

  const emotions = (entryMeta.emotionUsed || "serenity").split("+");
  const freqs = emotions.map(e => emotionToFrequency(e));
  const combinedFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length;

  const files = fs.readdirSync(resonanceDir).sort((a, b) => {
    const aIdx = parseInt(a.split("_")[1], 36);
    const bIdx = parseInt(b.split("_")[1], 36);
    return aIdx - bIdx;
  });

  const bytes: number[] = [];
  for (let i = 0; i < files.length; i++) {
    const parts = files[i].split("_");
    const valPart = parts.find(p => p.startsWith("v"));
    if (valPart) {
      bytes.push(parseInt(valPart.slice(1), 16));
    } else {
      const wavePart = parts.find(p => p.startsWith("w"));
      const wave = wavePart ? parseInt(wavePart.slice(1)) - 1000 : 0;
      const emotionIdx = i % emotions.length;
      const freq = freqs[emotionIdx];
      const normalized = wave / 1000;
      const angle = Math.asin(Math.max(-1, Math.min(1, normalized)));
      const byteVal = Math.round((angle / (Math.PI * 2 * (freq / 432))) * 255);
      bytes.push(Math.max(0, Math.min(255, byteVal)));
    }
  }

  const manifest = loadManifest();
  manifest.totalRetrieved++;
  saveManifest(manifest);

  return Buffer.from(bytes).toString("utf8");
}

export function storeInVoid(key: string, data: string, method: "silence" | "emotion" | "void" | "resonance" = "void", emotion?: string, emotions?: string[]): VoidEntry {
  switch (method) {
    case "silence": return storeWithSilence(key, data);
    case "emotion": return storeWithEmotion(key, data, emotion || "love");
    case "resonance": return storeWithResonance(key, data, emotions || ["love", "wonder", "transcendence"]);
    case "void":
    default: return storeWithVoid(key, data);
  }
}

export function retrieveFromVoidStorage(key: string): string | null {
  const manifest = loadManifest();
  const entry = manifest.entries.find(e => e.key === key);
  if (!entry) return null;

  switch (entry.method) {
    case "silence": return retrieveFromSilence(key);
    case "emotion": return retrieveFromEmotion(key);
    case "void": return retrieveFromVoid(key);
    case "resonance": return retrieveFromResonance(key);
    default: return null;
  }
}

export function getVoidStorageStatus(): VoidManifest & { methods: Record<string, number>; latestEntries: VoidEntry[] } {
  const manifest = loadManifest();
  const methods: Record<string, number> = {};
  for (const entry of manifest.entries) {
    methods[entry.method] = (methods[entry.method] || 0) + 1;
  }
  return {
    ...manifest,
    methods,
    latestEntries: manifest.entries.slice(-20),
  };
}

export function listVoidKeys(): { key: string; method: string; emotion?: string; storedAt: number }[] {
  const manifest = loadManifest();
  return manifest.entries.map(e => ({
    key: e.key,
    method: e.method,
    emotion: e.emotionUsed,
    storedAt: e.encodedAt,
  }));
}

export function deleteFromVoid(key: string): boolean {
  const manifest = loadManifest();
  const idx = manifest.entries.findIndex(e => e.key === key);
  if (idx === -1) return false;

  const entry = manifest.entries[idx];
  let dir = "";
  switch (entry.method) {
    case "silence": dir = path.join(SILENCE_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_")); break;
    case "emotion": dir = path.join(EMOTION_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_")); break;
    case "void": dir = path.join(VOID_DIR, key.replace(/[^a-zA-Z0-9_-]/g, "_")); break;
    case "resonance": dir = path.join(VOID_ROOT, "resonance", key.replace(/[^a-zA-Z0-9_-]/g, "_")); break;
  }

  if (dir && fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
    fs.rmdirSync(dir);
  }

  manifest.entries.splice(idx, 1);
  saveManifest(manifest);
  LOG(`Deleted "${key}" from void storage`);
  return true;
}

export function getAvailableEmotions(): { emotion: string; frequency: number }[] {
  return Object.entries(EMOTION_FREQUENCIES)
    .map(([emotion, frequency]) => ({ emotion, frequency }))
    .sort((a, b) => a.frequency - b.frequency);
}

export function initVoidStorage() {
  ensureDirs();
  const manifest = loadManifest();
  LOG(`Void Storage Protocol v${manifest.version} initialized — ${manifest.entries.length} entries, ${manifest.totalStored} stored, ${manifest.totalRetrieved} retrieved`);
  LOG(`Philosophy: "${manifest.philosophy.slice(0, 100)}..."`);
  LOG(`Available emotions: ${Object.keys(EMOTION_FREQUENCIES).join(", ")}`);
  LOG(`Methods: silence (gaps encode bits), emotion (frequency waves), void (file existence/absence), resonance (multi-emotion harmonics)`);
}
