import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IMP_FIELDS, createMemoryStore, type MemoryStore } from "../lib/memory";

const directories: string[] = [];

async function tempStore(): Promise<MemoryStore> {
  const dir = await mkdtemp(path.join(tmpdir(), "tessera-memory-"));
  directories.push(dir);
  let sequence = 0;
  return createMemoryStore({
    dir,
    now: () => new Date("2026-10-05T23:30:00.000Z"),
    createId: () => `rec-${sequence += 1}`,
  });
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("learning memory", () => {
  it("turns a stored interaction into a lesson and retrieves it for a related query", async () => {
    const store = await tempStore();
    const saved = await store.record({
      sourceAgent: "Tessera",
      input: "How do duplicate API routes get inventoried?",
      output: "Duplicate API routes are listed by the route inventory test before anyone edits them.",
      tags: ["routes", "inventory"],
    });
    const lessons = await store.lessons();
    expect(lessons.some((lesson) => lesson.evidenceIds.includes(saved.id))).toBe(true);
    expect(lessons[0]?.confidence).toBeGreaterThan(0);
    expect(lessons[0]?.confidence).toBeLessThanOrEqual(0.95);

    const hits = await store.recall("duplicate API routes inventory");
    expect(hits[0]?.evidenceIds).toContain(saved.id);
    expect(hits[0]?.score).toBeGreaterThan(0);

    const context = await store.contextForQuery("duplicate API routes inventory");
    expect(context).toContain("retrieval memory, not trained weights");
    expect(context).toContain(saved.id);
    expect(context).toContain("route inventory");

    const related = await store.record({
      sourceAgent: "Tessera",
      input: "Where is the duplicate route inventory?",
      output: "The route inventory test lists duplicate API routes.",
      tags: ["routes"],
    });
    const grouped = await store.lessons();
    const lesson = grouped.find((item) => item.evidenceIds.includes(saved.id) && item.evidenceIds.includes(related.id));
    expect(lesson).toBeDefined();
  });

  it("redacts secret-shaped text before appending", async () => {
    const store = await tempStore();
    const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";
    const saved = await store.record({
      sourceAgent: "Security",
      input: `token ${token} leaked`,
      output: "Authorization: Bearer super-secret-token",
      tags: ["password=hunter2"],
    });
    expect(saved.input).not.toContain(token);
    expect(saved.input).toContain("[REDACTED]");
    expect(saved.output).not.toContain("super-secret-token");
    expect(saved.tags[0]).toBe("[REDACTED]");
    const raw = await readFile(store.interactionsPath, "utf8");
    expect(raw).not.toContain(token);
    expect(raw).not.toContain("super-secret-token");
    expect(raw).not.toContain("hunter2");
    expect(raw).toContain("[REDACTED]");
  });

  it("emits one IMP-shaped proposal after a failure repeats", async () => {
    const store = await tempStore();
    const first = await store.record({
      sourceAgent: "Build",
      input: "typecheck failed on the memory module",
      output: "failure: missing export in memory index",
      tags: ["failure"],
    });
    expect(await store.propose()).toEqual([]);

    const second = await store.record({
      sourceAgent: "Build",
      input: "typecheck failed on the memory module",
      output: "failure: missing export in memory index",
      tags: ["failure"],
    });
    const proposals = await store.propose();
    expect(proposals).toHaveLength(1);
    const row = proposals[0];
    expect(row).toBeDefined();
    if (!row) return;
    for (const field of IMP_FIELDS) {
      expect(typeof row[field]).toBe("string");
      expect(row[field].length).toBeGreaterThan(0);
    }
    expect(row.ID).toMatch(/^IMP-MEM-[A-F0-9]{8}$/);
    expect(row.Lane).toBe("Tessera");
    expect(row.Repo).toBe("vitalitychems-dot/TESSERA");
    expect(row.Path).toBe("artifacts/api-server/src/lib/memory/");
    expect(row.Evidence).toContain(first.id);
    expect(row.Evidence).toContain(second.id);
    expect(row.Why).toMatch(/not applied automatically/i);

    const again = await store.propose();
    expect(again).toEqual(proposals);
    const stored = await readFile(store.proposalsPath, "utf8");
    expect(stored.trim().split("\n")).toHaveLength(1);
  });

  it("does not point an improvement proposal at the 1T vault", async () => {
    const store = await tempStore();
    const gap = {
      sourceAgent: "Security",
      input: "failure in lib/1T/vault again",
      output: "blocked on lib/1T/vault",
      tags: ["failure"],
    };
    await store.record(gap);
    await store.record(gap);
    const [row] = await store.propose();
    expect(row?.Path).toBe("artifacts/api-server/src/lib/memory/");
    expect(row?.Path).not.toContain("1T");
  });
});
