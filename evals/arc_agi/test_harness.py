"""Harness lows: dataset pin, per-task timeout, non-dict results, summary newline, git dirty."""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("arc_harness", os.path.join(HERE, "run.py"))
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)


def _task():
    return {
        "train": [{"input": [[0]], "output": [[1]]}],
        "test": [{"input": [[0]], "output": [[1]]}],
    }


class HashPinTests(unittest.TestCase):
    def test_pinned_hash_is_the_full_repo_value(self):
        self.assertTrue(run.PINNED_DATASET_SHA256.startswith("4d9a1544"))
        self.assertEqual(len(run.PINNED_DATASET_SHA256), 64)
        with open(os.path.join(HERE, "RESULTS.md"), encoding="utf-8") as handle:
            results = handle.read()
        with open(os.path.join(HERE, "results", "20261021T220320Z", "summary.json"), encoding="utf-8") as handle:
            summary = handle.read()
        self.assertIn(run.PINNED_DATASET_SHA256, results)
        self.assertIn(run.PINNED_DATASET_SHA256, summary)

    def test_matching_hash_does_not_exit(self):
        run.check_dataset_hash(run.PINNED_DATASET_SHA256)

    def test_mismatch_exits_nonzero_with_clear_message(self):
        script = (
            "import importlib.util\n"
            f"p={os.path.join(HERE, 'run.py')!r}\n"
            "s=importlib.util.spec_from_file_location('arc_harness_exit', p)\n"
            "m=importlib.util.module_from_spec(s); s.loader.exec_module(m)\n"
            "m.check_dataset_hash('0' * 64)\n"
        )
        proc = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("dataset sha256 mismatch", proc.stderr)
        self.assertIn(run.PINNED_DATASET_SHA256, proc.stderr)
        self.assertIn("4d9a1544", proc.stderr)
        self.assertIn("0" * 64, proc.stderr)


class TimeoutTests(unittest.TestCase):
    def test_slow_solver_is_a_timeout_failure_even_if_it_swallows_exception(self):
        class Swallow:
            def solve(self, train, tests, limit, cfg):
                try:
                    time.sleep(5)
                except Exception:
                    time.sleep(5)
                return [{"attempts": [[[1]]], "confidence": 1.0, "meta": {}} for _ in tests]

        run._SOLVER = Swallow()
        t0 = time.monotonic()
        tid, res, secs, err = run._run_task(("slow", _task(), 0.3, {}))
        elapsed = time.monotonic() - t0
        self.assertEqual(tid, "slow")
        self.assertLess(elapsed, 2.0)
        self.assertIn("timeout", err)
        self.assertEqual(res[0]["attempts"], [])
        rec = run.score_finished_task(_task(), res, secs, err)
        self.assertFalse(rec["solved"])
        self.assertFalse(rec["tests"][0]["correct"])
        self.assertIn("timeout", rec["error"])

    def test_fast_solver_is_not_a_timeout(self):
        class Fast:
            def solve(self, train, tests, limit, cfg):
                return [{"attempts": [[[1]]], "confidence": 1.0, "meta": {}} for _ in tests]

        run._SOLVER = Fast()
        _tid, res, _secs, err = run._run_task(("fast", _task(), 2.0, {}))
        self.assertIsNone(err)
        self.assertEqual(res[0]["attempts"], [[[1]]])

    def test_nonpositive_limit_is_a_timeout_without_calling_solve(self):
        class Boom:
            def solve(self, train, tests, limit, cfg):
                raise AssertionError("solver should not run")

        run._SOLVER = Boom()
        _tid, res, secs, err = run._run_task(("zero", _task(), 0, {}))
        self.assertEqual(secs, 0.0)
        self.assertIn("timeout", err)
        self.assertEqual(res[0]["attempts"], [])


class NonDictResultTests(unittest.TestCase):
    def _run(self, payload):
        class Bad:
            def solve(self, train, tests, limit, cfg):
                return payload

        run._SOLVER = Bad()
        return run._run_task(("bad", _task(), 2.0, {}))

    def test_string_result_is_wrapped_like_an_exception(self):
        _tid, res, _secs, err = self._run("nope")
        self.assertEqual(err, run.NON_DICT_RESULT)
        self.assertEqual(res[0]["attempts"], [])
        self.assertIsInstance(res[0], dict)

    def test_list_of_non_dicts_is_wrapped(self):
        _tid, res, _secs, err = self._run([1, 2])
        self.assertEqual(err, run.NON_DICT_RESULT)
        self.assertTrue(all(isinstance(item, dict) for item in res))

    def test_exception_is_still_wrapped(self):
        class Boom:
            def solve(self, train, tests, limit, cfg):
                raise RuntimeError("solver blew up")

        run._SOLVER = Boom()
        _tid, res, _secs, err = run._run_task(("boom", _task(), 2.0, {}))
        self.assertIn("solver blew up", err)
        self.assertEqual(res[0]["attempts"], [])

    def test_non_dict_still_writes_summary(self):
        _tid, res, secs, err = self._run({"attempts": [[[1]]]})
        rec = run.score_finished_task(_task(), res, secs, err)
        self.assertEqual(rec["error"], run.NON_DICT_RESULT)
        self.assertFalse(rec["solved"])
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "summary.json")
            run.write_summary(path, {"error": rec["error"], "tasks_solved": 0, "predictions_correct": 0})
            with open(path, "rb") as handle:
                raw = handle.read()
            self.assertTrue(raw.endswith(b"\n"))
            loaded = json.loads(raw)
            self.assertEqual(loaded["tasks_solved"], 0)
            self.assertEqual(loaded["error"], run.NON_DICT_RESULT)

    def test_scorer_accepts_a_raw_non_dict_without_raising(self):
        rec = run.score_finished_task(_task(), "nope", 0.1, None)
        self.assertEqual(rec["error"], run.NON_DICT_RESULT)
        self.assertFalse(rec["tests"][0]["correct"])


class NitTests(unittest.TestCase):
    def test_summary_json_has_a_trailing_newline(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "summary.json")
            run.write_summary(path, {"predictions_correct": 23, "tasks_solved": 20})
            with open(path, "rb") as handle:
                raw = handle.read()
            self.assertTrue(raw.endswith(b"\n"))
            self.assertFalse(raw.endswith(b"\n\n"))
            self.assertEqual(json.loads(raw), {"predictions_correct": 23, "tasks_solved": 20})

    def test_git_status_covers_the_whole_repo(self):
        self.assertEqual(run.GIT_STATUS_ARGV, ["git", "status", "--porcelain"])
        self.assertNotIn(".", run.GIT_STATUS_ARGV)

        class Proc:
            returncode = 0
            stdout = "?? outside.txt\n"

        calls = []

        def fake(args, **kwargs):
            calls.append((args, kwargs.get("cwd")))
            return Proc()

        self.assertTrue(run.repo_is_dirty(run=fake))
        self.assertEqual(calls[0][0], ["git", "status", "--porcelain"])

    def test_real_git_sees_a_file_outside_the_harness_dir(self):
        root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], cwd=HERE, text=True).strip()
        probe = os.path.join(root, "_arc_git_dirty_probe")
        with open(probe, "w", encoding="utf-8") as handle:
            handle.write("probe\n")
        try:
            limited = subprocess.run(
                ["git", "status", "--porcelain", "--", "evals/arc_agi"],
                cwd=root, capture_output=True, text=True, check=False,
            ).stdout
            self.assertNotIn("_arc_git_dirty_probe", limited)
            seen = subprocess.run(
                run.GIT_STATUS_ARGV, cwd=HERE, capture_output=True, text=True, check=False,
            ).stdout
            self.assertIn("_arc_git_dirty_probe", seen)
            self.assertTrue(run.repo_is_dirty())
        finally:
            os.remove(probe)


if __name__ == "__main__":
    unittest.main()
