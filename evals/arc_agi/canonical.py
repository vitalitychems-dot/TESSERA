#!/usr/bin/env python3
"""Prediction-sha canonicalizer for the ARC-AGI-1 baseline.

RESULTS.md records the sha256 of this canonical per-task record. Wall-clock
`seconds` fields are omitted. The digest is sha256 of

    json.dumps(canonical_predictions(tasks), sort_keys=True, separators=(",", ":"))

`depth_used` is the depth field. `timed_out` is the timeout flag.
"""
import hashlib
import json
import sys


def canonical_predictions(task_doc):
    """Stable per-task record: scores and programs, no wall-clock fields."""
    out = {}
    for tid in sorted(task_doc):
        record = task_doc[tid]
        tests = []
        for item in record["tests"]:
            meta = dict(item.get("meta") or {})
            meta.pop("seconds", None)
            tests.append({
                "test_index": item["test_index"],
                "correct": item["correct"],
                "n_attempts": item["n_attempts"],
                "confidence": item["confidence"],
                "programs": meta.get("programs"),
                "n_consistent": meta.get("n_consistent"),
                "depth_used": meta.get("depth_used"),
                "timed_out": meta.get("timed_out"),
            })
        out[tid] = {"solved": record["solved"], "error": record["error"], "tests": tests}
    return out


def prediction_sha256(task_doc):
    body = json.dumps(
        canonical_predictions(task_doc), sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(body).hexdigest()


def main(argv):
    if len(argv) != 2:
        sys.exit("usage: python3 evals/arc_agi/canonical.py <tasks.json>")
    with open(argv[1], encoding="utf-8") as handle:
        print(prediction_sha256(json.load(handle)))


if __name__ == "__main__":
    main(sys.argv)
