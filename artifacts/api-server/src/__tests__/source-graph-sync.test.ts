import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { syncSourceGraph } from "../lib/v2/source-graph-sync";

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "sg-sync-"));
  const lib = path.join(root, "src/lib");
  await mkdir(path.join(lib, "memory"), { recursive: true });
  await mkdir(path.join(lib, "v2"), { recursive: true });
  await writeFile(path.join(lib, "a.ts"), 'import { b } from "./b";\nexport const a = b;\n');
  await writeFile(path.join(lib, "b.ts"), 'import { store } from "./memory/store";\nexport const b = store;\n');
  await writeFile(path.join(lib, "memory/store.ts"), 'export const store = 1;\n');
  await writeFile(path.join(lib, "v2/usage-ledger.ts"), 'import { a } from "../a";\nexport const ledger = a;\n');
  await writeFile(path.join(lib, "_draft.ts"), "export {}\n");
  await writeFile(path.join(lib, "a.test.ts"), "export {}\n");
  await symlink(path.join(lib, "memory"), path.join(lib, "loop"));
  return root;
}

describe("syncSourceGraph", () => {
  it("derives provenance edges from imports and reports limits transparently", async () => {
    const root = await fixture();
    try {
      const { graph, limits } = await syncSourceGraph(root);
      // b imports memory/store => store feeds b; a imports b => b feeds a
      const prov = graph.provenanceOf("module:src/lib/a.ts").map((n) => n.id);
      expect(prov).toContain("module:src/lib/b.ts");
      expect(prov).toContain("module:src/lib/memory/store.ts");
      // capability anchoring from the known map
      expect(graph.provenanceOf("capability:local-memory").map((n) => n.id))
        .toContain("module:src/lib/memory/store.ts");
      expect(graph.provenanceOf("capability:usage-accounting").length).toBeGreaterThan(0);
      // canonical anchors exist but are registry-only
      expect(limits.scope).toContain("not live-fetched");
      // limits transparency: symlink and hidden/test files excluded and counted
      expect(limits.skipped.symlinks).toBeGreaterThanOrEqual(1);
      expect(limits.scannedFiles).toBe(4);
      expect(limits.truncated).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("an absent scan root yields an empty, honestly-labeled graph", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sg-empty-"));
    try {
      const { graph, limits } = await syncSourceGraph(root);
      expect(limits.scannedFiles).toBe(0);
      expect(graph.stats().nodes).toBe(4); // 3 canonical repos + local-draft anchor
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
