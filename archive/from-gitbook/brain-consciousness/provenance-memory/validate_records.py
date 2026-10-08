#!/usr/bin/env python3
"""Validate append-only provenance-memory JSONL records."""
from __future__ import annotations
import json, sys
from datetime import datetime, timezone
from pathlib import Path

STATUSES = {"proposed", "verified", "probable", "unknown", "blocked", "rejected", "superseded", "expired"}
REQUIRED = {"id", "statement", "status", "source_ref", "confidence", "confidence_basis", "owner", "created_at", "updated_at", "reviewed_at", "review_expires_at"}

def utc(value: str) -> datetime:
    if not value.endswith("Z"): raise ValueError("timestamps must end in Z")
    parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    if parsed.tzinfo != timezone.utc: raise ValueError("timestamp must be UTC")
    return parsed

def main() -> int:
    path = Path(__file__).with_name("records.jsonl")
    seen = set(); current = []; expired = []
    for line_no, line in enumerate(path.read_text().splitlines(), 1):
        record = json.loads(line)
        missing = REQUIRED - set(record)
        if missing: raise ValueError(f"line {line_no}: missing {sorted(missing)}")
        if record["id"] in seen: raise ValueError(f"line {line_no}: duplicate id")
        seen.add(record["id"])
        if record["status"] not in STATUSES: raise ValueError(f"line {line_no}: invalid status")
        if not record["statement"].strip() or not record["source_ref"].strip() or not record["owner"].strip(): raise ValueError(f"line {line_no}: empty required value")
        if not isinstance(record["confidence"], (int, float)) or not 0 <= record["confidence"] <= 1: raise ValueError(f"line {line_no}: confidence outside 0..1")
        created, updated, reviewed, expiry = [utc(record[key]) for key in ("created_at", "updated_at", "reviewed_at", "review_expires_at")]
        if updated < created or reviewed < created or expiry <= reviewed: raise ValueError(f"line {line_no}: invalid timestamp order")
        if record["status"] in {"expired", "superseded", "rejected"}: expired.append(record["id"])
        else: current.append(record["id"])
    print(f"provenance-memory validation: PASS; current={current}; review_queue={expired}")
    return 0

if __name__ == "__main__":
    try: raise SystemExit(main())
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"provenance-memory validation: FAIL: {exc}", file=sys.stderr); raise SystemExit(1)
