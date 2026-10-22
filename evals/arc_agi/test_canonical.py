"""The prediction-sha canonicalizer RESULTS.md points at."""
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("arc_canonical", os.path.join(HERE, "canonical.py"))
canonical = importlib.util.module_from_spec(spec)
spec.loader.exec_module(canonical)


def _doc():
    return {
        "bbbb": {
            "solved": False,
            "error": None,
            "seconds": 1.25,
            "tests": [{
                "test_index": 0,
                "correct": False,
                "n_attempts": 1,
                "confidence": 0.5,
                "seconds": 1.25,
                "meta": {
                    "programs": [["rot90"]],
                    "n_consistent": 2,
                    "depth_used": 3,
                    "timed_out": False,
                    "seconds": 1.25,
                },
            }],
        },
        "aaaa": {
            "solved": True,
            "error": None,
            "seconds": 0.4,
            "tests": [{
                "test_index": 0,
                "correct": True,
                "n_attempts": 2,
                "confidence": 1.0,
                "meta": {"programs": [["flipud"]], "n_consistent": 1, "depth_used": 2, "timed_out": True, "seconds": 0.4},
            }],
        },
    }


class CanonicalTests(unittest.TestCase):
    def test_drops_seconds_and_keeps_score_fields(self):
        out = canonical.canonical_predictions(_doc())
        self.assertEqual(list(out), ["aaaa", "bbbb"])
        self.assertNotIn("seconds", json.dumps(out))
        first = out["aaaa"]["tests"][0]
        self.assertEqual(first["correct"], True)
        self.assertEqual(first["n_attempts"], 2)
        self.assertEqual(first["confidence"], 1.0)
        self.assertEqual(first["programs"], [["flipud"]])
        self.assertEqual(first["n_consistent"], 1)
        self.assertEqual(first["depth_used"], 2)
        self.assertIs(first["timed_out"], True)
        self.assertIsNone(out["bbbb"]["error"])

    def test_sha256_matches_sorted_compact_json(self):
        body = json.dumps(
            canonical.canonical_predictions(_doc()), sort_keys=True, separators=(",", ":")
        ).encode()
        self.assertEqual(canonical.prediction_sha256(_doc()), hashlib.sha256(body).hexdigest())
        again = canonical.prediction_sha256(_doc())
        self.assertEqual(canonical.prediction_sha256(_doc()), again)

    def test_cli_prints_the_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "tasks.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(_doc(), handle)
            proc = subprocess.run(
                [sys.executable, os.path.join(HERE, "canonical.py"), path],
                capture_output=True, text=True, check=False,
            )
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout.strip(), canonical.prediction_sha256(_doc()))


if __name__ == "__main__":
    unittest.main()
