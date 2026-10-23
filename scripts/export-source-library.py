#!/usr/bin/env python3
"""Build a small public-metadata snapshot for Tessera; never package source/tools."""
import json
from pathlib import Path
import re
import time

ROOT = Path(__file__).resolve().parent.parent


def snapshot(root=ROOT):
    catalog = json.loads((root / "docs/repo-intake/catalog.json").read_text())
    coverage_file = root / "generated-artifacts/repository-audit/summary.json"
    rea_file = root / "generated-artifacts/rea-analysis/summary.json"
    coverage = {r["repository"]: r for r in json.loads(coverage_file.read_text())["repositories"]} if coverage_file.exists() else {}
    rea = {r["repository"]: r for r in json.loads(rea_file.read_text())} if rea_file.exists() else {}
    records = []
    for item in catalog["repositories"]:
        name = item["repository"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", name):
            raise ValueError("Invalid repository")
        file = coverage.get(name, {})
        run = rea.get(name, {})
        commit = file.get("commit") or run.get("commit") or ""
        if commit and not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise ValueError("Invalid commit")
        records.append({
            "repository": name, "url": "https://github.com/" + name,
            "description": str(item.get("description", ""))[:1500],
            "categories": item.get("categories", []),
            "licenseLabel": item.get("license", "unknown"),
            "licenseApprovedForIntegration": False,
            "commit": commit, "trackedFiles": file.get("trackedPaths"),
            "textFilesInspected": file.get("counts", {}).get("text-structure-inspected", 0),
            "reaStatus": run.get("status", "not-attempted-in-snapshot"),
            "reaSnapshotFiles": run.get("snapshotFiles", 0),
            "operationallyInstalled": False,
        })
    return {
        "schemaVersion": 1, "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scope": "Public-source reference library. Static inspection is not a security review, training, or operational installation.",
        "reaDevelopmentOnly": True, "modelTrained": False,
        "externalStorageSynced": False, "records": records,
    }


if __name__ == "__main__":
    destination = ROOT / "artifacts/tessera/src/data/source-library.json"
    destination.write_text(json.dumps(snapshot(), indent=2) + "\n")
    print(destination.relative_to(ROOT))
