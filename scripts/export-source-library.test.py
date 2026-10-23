import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("library", Path(__file__).with_name("export-source-library.py"))
library = importlib.util.module_from_spec(spec)
spec.loader.exec_module(library)


class SnapshotTests(unittest.TestCase):
    def test_missing_analysis_is_not_promoted(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            file = root / "docs/repo-intake/catalog.json"
            file.parent.mkdir(parents=True)
            file.write_text(json.dumps({"repositories": [{"repository": "a/b"}]}))
            result = library.snapshot(root)
            record = result["records"][0]
            self.assertEqual(record["reaStatus"], "not-attempted-in-snapshot")
            self.assertIsNone(record["trackedFiles"])
            self.assertFalse(record["operationallyInstalled"])
            self.assertFalse(result["modelTrained"])
            self.assertFalse(result["externalStorageSynced"])

    def test_returned_analysis_not_called_installation_or_review(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            catalog = root / "docs/repo-intake/catalog.json"
            catalog.parent.mkdir(parents=True)
            catalog.write_text(json.dumps({"repositories": [{"repository": "a/b"}]}))
            rea = root / "generated-artifacts/rea-analysis/summary.json"
            rea.parent.mkdir(parents=True)
            rea.write_text(json.dumps([{"repository": "a/b", "status": "rea-returned",
                                       "commit": "a" * 40, "snapshotFiles": 2,
                                       "privateField": "must not ship"}]))
            result = library.snapshot(root)
            record = result["records"][0]
            self.assertEqual(record["reaStatus"], "rea-returned")
            self.assertFalse(record["licenseApprovedForIntegration"])
            self.assertFalse(record["operationallyInstalled"])
            self.assertNotIn("must not ship", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
