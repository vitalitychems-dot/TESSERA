import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

const hashCache = new Map<string, string>();
let computations = 0;

export function clearWeightsHashCache(): void {
  hashCache.clear();
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
  const key = `${filePath}\0${info.mtimeMs}\0${info.size}`;
  const cached = hashCache.get(key);
  if (cached !== undefined) return cached;

  computations += 1;
  const digest = await streamSha256(filePath);
  hashCache.set(key, digest);
  return digest;
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
