import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getSourceMemoryCatalog,
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
  db.exec(`CREATE TABLE repository_catalog (
    repository TEXT PRIMARY KEY, description TEXT NOT NULL, categories TEXT NOT NULL,
    url TEXT NOT NULL, license_label TEXT NOT NULL, license_approved INTEGER NOT NULL,
    commit_id TEXT NOT NULL, tracked_files INTEGER, text_files_inspected INTEGER NOT NULL,
    rea_status TEXT NOT NULL, rea_snapshot_files INTEGER NOT NULL, checked_at TEXT NOT NULL
  )`);
  const insert = db.prepare("INSERT INTO contexts VALUES (?,?,?,?,?,?,?)");
  insert.run("calesthio/OpenMontage", "src/video.ts", "free text to video generation", "a".repeat(40), "rea-returned", "https://github.com/calesthio/OpenMontage", "2026-10-23T00:00:00Z");
  insert.run("garrytan/gbrain", "README.md", "memory graph recall", "b".repeat(40), "metadata-only-untrusted", "https://github.com/garrytan/gbrain", "2026-10-23T00:00:01Z");
  insert.run("example/person-lookup", "README.md", "defensive phone lookup list", "d".repeat(40), "metadata-only-untrusted", "https://github.com/example/person-lookup", "2026-10-23T00:00:02Z");
  const catalog = db.prepare("INSERT INTO repository_catalog VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  catalog.run("calesthio/OpenMontage", "free text to video", JSON.stringify(["Free text to video"]), "https://github.com/calesthio/OpenMontage", "UNKNOWN", 0, "a".repeat(40), 1, 1, "rea-returned", 1, "2026-10-23T00:00:00Z");
  catalog.run("garrytan/gbrain", "memory graph recall", JSON.stringify(["Memory"]), "https://github.com/garrytan/gbrain", "MIT", 0, "b".repeat(40), 1, 1, "metadata-only-untrusted", 0, "2026-10-23T00:00:01Z");
  catalog.run("example/person-lookup", "defensive phone lookup", JSON.stringify(["DOX / osint"]), "https://github.com/example/person-lookup", "UNKNOWN", 0, "d".repeat(40), 1, 1, "metadata-only-untrusted", 0, "2026-10-23T00:00:02Z");
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
        records: 3,
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
      expect(sourceMemoryTerms('video " OR () DROP')).toEqual(["video", "DROP"]);
      const results = searchSourceMemory("video generation", 10);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        repository: "calesthio/OpenMontage",
        evidence: "rea-returned",
        url: "https://github.com/calesthio/OpenMontage",
      });
      expect(searchSourceMemory('"; DROP TABLE contexts; --')).toEqual([]);
      expect(searchSourceMemory("defensive phone lookup", 10, { benignOnly: true })).toEqual([]);
      expect(searchSourceMemory("video generation", 10, { benignOnly: true })).toHaveLength(1);
      expect(getSourceMemoryStatus()).toMatchObject({ repositories: 3, catalogRecords: 2, reaSnapshots: 1 });
      expect(getSourceMemoryStatus().categories).not.toContain("DOX / osint");
      expect(getSourceMemoryCatalog({ category: "Memory" }).records.map((row) => row.repository)).toEqual(["garrytan/gbrain"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
