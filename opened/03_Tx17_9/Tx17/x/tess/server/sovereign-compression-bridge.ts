import * as fs from "fs";
import * as zlib from "zlib";
import { promisify } from "util";
import { colonelCompress } from "./sovereign-lang";
import { compressSovereign, decompressSovereign } from "./sovereign-codec";

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

const BRIDGE_MAGIC = Buffer.from([0x54, 0x53, 0x42, 0x01]);

interface CompressionResult {
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  pipeline: string;
  stages: { name: string; inputSize: number; outputSize: number }[];
}

export function compressWithColonelPipeline(data: string): CompressionResult {
  const originalSize = Buffer.byteLength(data, "utf8");
  const stages: CompressionResult["stages"] = [];

  const colonelResult = colonelCompress(data);
  const afterColonel = colonelResult.compressed;
  stages.push({ name: "colonel-tokenize", inputSize: originalSize, outputSize: Buffer.byteLength(afterColonel, "utf8") });

  let codecResult: Buffer;
  try {
    codecResult = compressSovereign(afterColonel);
  } catch {
    codecResult = Buffer.from(afterColonel, "utf8");
  }
  stages.push({ name: "sovereign-codec", inputSize: stages[0].outputSize, outputSize: codecResult.length });

  const output = Buffer.concat([
    BRIDGE_MAGIC,
    Buffer.alloc(4),
    codecResult,
  ]);
  output.writeUInt32LE(originalSize, BRIDGE_MAGIC.length);

  const compressedSize = output.length;
  const ratio = originalSize > 0 ? Math.max(0, (1 - compressedSize / originalSize) * 100) : 0;

  return {
    buffer: output,
    originalSize,
    compressedSize,
    ratio,
    pipeline: `colonel(${Math.round(colonelResult.ratio)}%) → sovereign-codec → packed`,
    stages,
  };
}

export function decompressColonelPipeline(buffer: Buffer): string {
  const magic = buffer.subarray(0, BRIDGE_MAGIC.length);
  if (!magic.equals(BRIDGE_MAGIC)) {
    throw new Error("Invalid sovereign bridge magic header");
  }
  const codecData = buffer.subarray(BRIDGE_MAGIC.length + 4);
  let decodedText: string;
  try {
    decodedText = decompressSovereign(codecData);
  } catch {
    decodedText = codecData.toString("utf8");
  }

  const { colonelDecompressRaw } = require("./sovereign-lang");
  if (typeof colonelDecompressRaw === "function") {
    try {
      return colonelDecompressRaw(decodedText);
    } catch {
      return decodedText;
    }
  }
  return decodedText;
}

export function hasBridgeHeader(buffer: Buffer): boolean {
  if (buffer.length < BRIDGE_MAGIC.length) return false;
  return buffer.subarray(0, BRIDGE_MAGIC.length).equals(BRIDGE_MAGIC);
}

interface CompressedStateFile {
  colonelCompressed: string;
  pipeline: string;
  ratio: number;
  originalSize: number;
  compressedSize: number;
  savedAt: string;
}

export function saveStateCompressed(filePath: string, data: object): { ratio: number; pipeline: string } {
  const json = JSON.stringify(data);
  const originalSize = Buffer.byteLength(json, "utf8");

  if (originalSize < 200) {
    fs.writeFileSync(filePath, json);
    return { ratio: 0, pipeline: "plaintext (too small)" };
  }

  try {
    const result = compressWithColonelPipeline(json);

    const wrapper: CompressedStateFile = {
      colonelCompressed: result.buffer.toString("base64"),
      pipeline: result.pipeline,
      ratio: Math.round(result.ratio * 10) / 10,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(wrapper));
    return { ratio: result.ratio, pipeline: result.pipeline };
  } catch {
    fs.writeFileSync(filePath, json);
    return { ratio: 0, pipeline: "plaintext (compression failed)" };
  }
}

export function loadStateCompressed<T = any>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object" && "colonelCompressed" in parsed && typeof parsed.colonelCompressed === "string") {
      const buf = Buffer.from(parsed.colonelCompressed, "base64");
      const decompressed = decompressColonelPipeline(buf);
      return JSON.parse(decompressed) as T;
    }

    return parsed as T;
  } catch {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

let totalCompressedSaves = 0;
let totalBytesSaved = 0;
let totalBytesOriginal = 0;

export function recordCompressionStats(originalSize: number, compressedSize: number): void {
  totalCompressedSaves++;
  totalBytesOriginal += originalSize;
  totalBytesSaved += (originalSize - compressedSize);
}

export function getCompressionBridgeStats() {
  return {
    totalCompressedSaves,
    totalBytesOriginal,
    totalBytesSaved,
    overallRatio: totalBytesOriginal > 0
      ? Math.round((1 - (totalBytesOriginal - totalBytesSaved) / totalBytesOriginal) * 100 * 10) / 10
      : 0,
    bridgeVersion: "1.0",
    pipelineStages: ["colonel-tokenize", "sovereign-codec", "bridge-pack"],
  };
}
