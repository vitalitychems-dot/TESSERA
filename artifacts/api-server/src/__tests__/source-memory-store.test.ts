import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getSourceMemoryStatus,
  resolveSourceMemoryPath,
  searchSourceMemory,
  sourceMemoryTerms,
} from "../lib/source-memory-store";

const ORIGINAL_PATH = process.env.TESSERA_SOURCE_MEMORY_DB;

function makeDatabase(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "tessera-source-memory-"));
  const path = join(dir, "contexts.sqlite");
  const db = new DatabaseSync(path);
  db.exec(`CREATE VIRTUAL TABLE contexts USING fts5(
    repository, path, context, commit_id UNINDEXED, evidence UNINDEXED, url UNINDEXED, checked_at UNINDEXED
  )`);
  const insert = db.prepare("INSERT INTO contexts VALUES (?,?,?,?,?,?,?)");
  insert.run("calesthio/OpenMontage", "src/video.ts", "free text to video generation", "a".repeat(40), "rea-returned", "https://github.com/calesthio/OpenMontage", "2026-10-23T00:00:00Z");
  insert.run("garrytan/gbrain", "README.md", "memory graph recall", "b".repeat(40), "metadata-only-untrusted", "https://github.com/garrytan/gbrain", "2026-10-23T00:00:01Z");
  db.close();
  return { dir, path };
}

afterEach(() => {
  if (ORIGINAL_PATH === undefined) delete process.env.TESSERA_SOURCE_MEMORY_DB;
  else process.env.TESSERA_SOURCE_MEMORY_DB = ORIGINAL_PATH;
});

describe("source memory store", () => {
  it("reports a generated index without promoting it to training or execution", () => {
    const { dir, path } = makeDatabase();
    try {
      process.env.TESSERA_SOURCE_MEMORY_DB = path;
      expect(resolveSourceMemoryPath()).toBe(path);
      expect(getSourceMemoryStatus()).toMatchObject({
        available: true,
        path,
        records: 2,
        modelTrained: false,
        executionAllowed: false,
        externalStorageSynced: false,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("finds evidence pointers and treats query punctuation as text", () => {
    const { dir, path } = makeDatabase();
    try {
      process.env.TESSERA_SOURCE_MEMORY_DB = path;
      expect(sourceMemoryTerms('video " OR () DROP')).toEqual(["video", "OR", "DROP"]);
      const results = searchSourceMemory("video generation", 10);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        repository: "calesthio/OpenMontage",
        evidence: "rea-returned",
        url: "https://github.com/calesthio/OpenMontage",
      });
      expect(searchSourceMemory('"; DROP TABLE contexts; --')).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
