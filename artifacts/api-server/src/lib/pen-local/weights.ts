import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

/**
 * The pin is a content hash of the file bytes.
 * mtime and size are not a cache key: a swap that keeps both still rehashes.
 */
let computations = 0;

export function clearWeightsHashCache(): void {
  computations = 0;
}

export function weightsHashComputations(): number {
  return computations;
}

export async function sha256File(filePath: string): Promise<string> {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw Object.assign(new Error("weights path is not a file"), { code: "ENOTFILE" });
  }
  computations += 1;
  return streamSha256(filePath);
}

async function streamSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk: Buffer | string) => {
      hash.update(chunk);
    });
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

export function pinMatches(digestHex: string, pin: string): boolean {
  const left = Buffer.from(digestHex.trim().toLowerCase(), "utf8");
  const right = Buffer.from(pin.trim().toLowerCase(), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
