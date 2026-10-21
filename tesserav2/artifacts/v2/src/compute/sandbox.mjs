import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const DESK_MEM_LIMIT_MB = 32;

const PROBE = `
import net from "node:net";
import v8 from "node:v8";
if (process.env.SANDBOX_NETWORK === "deny") {
  const refused = () => {
    throw new Error("network denied");
  };
  net.connect = refused;
  net.createConnection = refused;
}
let networkDenied = false;
try {
  net.connect({ host: "127.0.0.1", port: 9 });
} catch (err) {
  networkDenied = String(err && err.message).includes("network denied");
}
process.stdout.write(JSON.stringify({
  networkDenied,
  memLimitMb: Number(process.env.SANDBOX_MEM_MB),
  heapLimit: v8.getHeapStatistics().heap_size_limit,
}));
`;

/** One desk probe: network stays denied and the heap flag is applied. */
export function runDeskProbe() {
  const dir = mkdtempSync(join(tmpdir(), "tessera-desk-"));
  const file = join(dir, "probe.mjs");
  writeFileSync(file, PROBE);
  try {
    const result = spawnSync(process.execPath, [`--max-old-space-size=${DESK_MEM_LIMIT_MB}`, file], {
      env: {
        PATH: process.env.PATH ?? "",
        SANDBOX_NETWORK: "deny",
        SANDBOX_MEM_MB: String(DESK_MEM_LIMIT_MB),
      },
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || "desk sandbox probe failed");
    }
    return JSON.parse(result.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
