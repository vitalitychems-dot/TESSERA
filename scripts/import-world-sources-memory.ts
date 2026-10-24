// Target location in TESSERA: scripts/import-world-sources-memory.ts
// This runner is not installed into this separate preview's API.
import { createMemoryStore } from "../artifacts/api-server/src/lib/memory/index";
import { seedWorldSourcesMemory } from "../lib/world-sources/memory-seed.mjs";

if (process.argv.length !== 3 || process.argv[2] !== "--apply") {
  console.error("Usage: pnpm exec tsx scripts/import-world-sources-memory.ts --apply");
  console.error("Appends reviewed usage lessons to this checkout's .local/tessera-memory. No model training or external calls.");
  process.exitCode = 1;
} else {
  try {
    const result = await seedWorldSourcesMemory(createMemoryStore());
    console.log(JSON.stringify({ event: "world_sources_usage_memory_import", ...result }));
  } catch {
    console.error(JSON.stringify({ event: "world_sources_usage_memory_import", status: "failed" }));
    process.exitCode = 1;
  }
}
