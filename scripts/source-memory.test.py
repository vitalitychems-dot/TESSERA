import importlib.util
import tempfile
from pathlib import Path
import unittest
import json
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("memory", Path(__file__).with_name("source-memory.py"))
memory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(memory)


class MemoryTests(unittest.TestCase):
    def test_idempotent_ingestion_and_untrusted_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            db = memory.connect(":memory:")
            catalog = {"repositories": [{"repository": "a/b", "description": "video generation"}]}
            for _ in range(2):
                self.assertEqual(memory.ingest(db, catalog, Path(directory)), 1)
            rows = memory.recall(db, "video")
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["evidence"], "metadata-only-untrusted")
            self.assertEqual(rows[0]["url"], "https://github.com/a/b")
            db.close()

    def test_query_is_not_sql_or_fts_syntax(self):
        db = memory.connect(":memory:")
        self.assertEqual(memory.recall(db, '"; DROP TABLE contexts; --'), [])
        self.assertEqual(memory.recall(db, "* OR ()"), [])
        self.assertEqual(db.execute("SELECT COUNT(*) FROM contexts").fetchone()[0], 0)
        db.close()

    def test_analysis_outcome_is_cited_without_trust_promotion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "summary.json").write_text(json.dumps([{
                "repository": "a/b", "commit": "a" * 40,
                "status": "rea-failed", "checkedAt": "2026-10-23T00:00:00Z"}]))
            db = memory.connect(":memory:")
            catalog = {"repositories": [{"repository": "a/b"}]}
            self.assertEqual(memory.ingest(db, catalog, root, root), 2)
            rows = memory.recall(db, "rea-failed")
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["evidence"], "rea-static-outcome-not-security-review")
            self.assertEqual(rows[0]["url"], "https://github.com/a/b/tree/" + "a" * 40)
            db.close()

    def test_catalog_metadata_is_stored_separately_from_searchable_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "artifacts/tessera/src/data"
            source.mkdir(parents=True)
            (source / "source-library.json").write_text(json.dumps({
                "capturedAt": "2026-10-23T00:00:00Z",
                "records": [{
                    "repository": "a/b",
                    "description": "Memory graph reference",
                    "categories": ["Memory"],
                    "licenseLabel": "MIT",
                    "licenseApprovedForIntegration": False,
                    "commit": "a" * 40,
                    "trackedFiles": 10,
                    "textFilesInspected": 8,
                    "reaStatus": "rea-returned",
                    "reaSnapshotFiles": 4,
                }],
            }))
            db = memory.connect(":memory:")
            with patch.object(memory, "ROOT", root):
                self.assertEqual(memory.ingest(db, {"repositories": [{"repository": "a/b"}]}, root), 1)
            row = db.execute(
                "SELECT repository, categories, commit_id, text_files_inspected, rea_status, rea_snapshot_files, license_approved "
                "FROM repository_catalog"
            ).fetchone()
            self.assertEqual(row, ("a/b", '["Memory"]', "a" * 40, 8, "rea-returned", 4, 0))
            self.assertEqual(db.execute("SELECT COUNT(*) FROM contexts").fetchone()[0], 1)
            db.close()


if __name__ == "__main__":
    unittest.main()
