#!/usr/bin/env python3
"""Validate the Gitbook coordination world-model shape and evidence paths."""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

STATUSES = {"TESTED", "REPORTED", "PROPOSED", "BLOCKED", "UNKNOWN"}
SHA = re.compile(r"^[0-9a-f]{40}$")

def fail(message: str) -> None:
    raise ValueError(message)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", default="state/world-model.schema.json")
    parser.add_argument("--map", dest="map_path", default="state/world-model.json")
    args = parser.parse_args()
    schema = json.loads(Path(args.schema).read_text())
    model = json.loads(Path(args.map_path).read_text())
    if schema.get("title") != "Tessera Gitbook coordination world model": fail("unexpected schema")
    required = {"schema_version", "source_snapshot", "architecture", "goals", "constraints", "tasks", "unknowns", "evidence"}
    if set(model) != required: fail("top-level keys do not match contract")
    snap = model["source_snapshot"]
    if not SHA.fullmatch(snap["gitbook_commit"]) or not SHA.fullmatch(snap["tessera_commit"]): fail("commit must be a full SHA-1")
    if snap["status"] not in STATUSES: fail("invalid snapshot status")
    for group in ("architecture", "goals", "constraints", "tasks", "unknowns"):
        ids = []
        for record in model[group]:
            if not record.get("id") or record["id"] in ids: fail(f"duplicate/missing id in {group}")
            ids.append(record["id"])
            if record.get("status") not in STATUSES: fail(f"invalid status in {group}")
            if not record.get("evidence"): fail(f"missing evidence in {group}")
    evidence_ids = []
    for record in model["evidence"]:
        if not record.get("id") or record["id"] in evidence_ids: fail("duplicate/missing evidence id")
        evidence_ids.append(record["id"])
        if record.get("repo") not in {"Gitbook", "TESSERA"}: fail("invalid evidence repo")
        path = record.get("path", "")
        if not path or path.startswith("/") or ".." in Path(path).parts: fail("unsafe evidence path")
        if record.get("status") not in STATUSES: fail("invalid evidence status")
    print("world-model validation: PASS")
    return 0

if __name__ == "__main__":
    try: raise SystemExit(main())
    except (ValueError, json.JSONDecodeError, KeyError) as exc:
        print(f"world-model validation: FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
