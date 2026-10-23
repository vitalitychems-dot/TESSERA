#!/usr/bin/env python3
"""Offline evidence-pointer memory, not model training or execution authority."""
import argparse
import json
from pathlib import Path
import re
import sqlite3
import urllib.parse

ROOT = Path(__file__).resolve().parent.parent
DATABASE = ROOT / "generated-artifacts/source-memory/contexts.sqlite"


def connect(path):
    db = sqlite3.connect(path)
    db.execute("""CREATE VIRTUAL TABLE IF NOT EXISTS contexts USING fts5(
        repository, path, context, commit_id UNINDEXED, evidence UNINDEXED,
        url UNINDEXED, checked_at UNINDEXED)""")
    db.execute("""CREATE TABLE IF NOT EXISTS repository_catalog (
        repository TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        categories TEXT NOT NULL,
        url TEXT NOT NULL,
        license_label TEXT NOT NULL,
        license_approved INTEGER NOT NULL,
        commit_id TEXT NOT NULL,
        tracked_files INTEGER,
        text_files_inspected INTEGER NOT NULL,
        rea_status TEXT NOT NULL,
        rea_snapshot_files INTEGER NOT NULL,
        checked_at TEXT NOT NULL
    )""")
    return db


def ingest(db, catalog, directory, rea_directory=None):
    """Rebuild derived data atomically; no external source can promote trust."""
    rows = []
    library_path = ROOT / "artifacts/tessera/src/data/source-library.json"
    library = json.loads(library_path.read_text()) if library_path.exists() else {"records": []}
    library_by_repo = {item["repository"]: item for item in library.get("records", [])
                       if isinstance(item, dict) and isinstance(item.get("repository"), str)}
    catalog_rows = []
    for item in library_by_repo.values():
        name = item["repository"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", name):
            raise ValueError("Invalid repository")
        commit = item.get("commit", "")
        if commit and not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise ValueError("Invalid repository commit")
        categories = item.get("categories", [])
        if not isinstance(categories, list) or not all(isinstance(value, str) for value in categories):
            raise ValueError("Invalid repository categories")
        tracked_files = item.get("trackedFiles")
        if tracked_files is not None and (not isinstance(tracked_files, int) or tracked_files < 0):
            raise ValueError("Invalid tracked file count")
        inspected = item.get("textFilesInspected", 0)
        snapshot_files = item.get("reaSnapshotFiles", 0)
        if not isinstance(inspected, int) or inspected < 0 or not isinstance(snapshot_files, int) or snapshot_files < 0:
            raise ValueError("Invalid inspection count")
        catalog_rows.append((
            name,
            str(item.get("description", ""))[:2_000],
            json.dumps(categories, ensure_ascii=False),
            "https://github.com/" + name,
            str(item.get("licenseLabel", "UNKNOWN"))[:80],
            int(item.get("licenseApprovedForIntegration") is True),
            commit,
            tracked_files,
            inspected,
            str(item.get("reaStatus", "not-reviewed"))[:80],
            snapshot_files,
            str(library.get("capturedAt", ""))[:40],
        ))

    rea_file = rea_directory / "summary.json" if rea_directory else None
    rea = {r["repository"]: r for r in json.loads(rea_file.read_text())} if rea_file and rea_file.exists() else {}
    for repo in catalog["repositories"]:
        name = repo["repository"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", name):
            raise ValueError("Invalid repository")
        context = " ".join([repo.get("description", ""), *repo.get("categories", []),
                            *repo.get("topics", [])])
        rows.append((name, "", context, "", "metadata-only-untrusted",
                     "https://github.com/" + name, repo.get("checkedAt", "")))
        run = rea.get(name)
        if run:
            run_commit = run.get("commit", "")
            if re.fullmatch(r"[0-9a-f]{40}", run_commit):
                rows.append((name, "[REA static JavaScript analysis]",
                             context + " " + str(run.get("status", "unknown")),
                             run_commit, "rea-static-outcome-not-security-review",
                             f"https://github.com/{name}/tree/{run_commit}", run.get("checkedAt", "")))
        file = directory / (name.replace("/", "__") + ".json")
        if not file.exists():
            continue
        report = json.loads(file.read_text())
        commit = report.get("commit", "")
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            continue
        for entry in report.get("files", []):
            path = entry["path"]
            rows.append((name, path, context, commit, entry["status"],
                         f"https://github.com/{name}/blob/{commit}/" +
                         urllib.parse.quote(path, safe="/"), report.get("checkedAt", "")))
    with db:
        db.execute("DELETE FROM contexts")
        db.executemany("INSERT INTO contexts VALUES (?,?,?,?,?,?,?)", rows)
        db.execute("DELETE FROM repository_catalog")
        db.executemany(
            "INSERT INTO repository_catalog VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            catalog_rows,
        )
    return len(rows)


def recall(db, query, limit=10):
    terms = re.findall(r"[a-zA-Z0-9_-]{2,}", query[:1000])[:12]
    if not terms:
        return []
    match = " AND ".join('"' + term + '"' for term in terms)
    columns = ["repository", "path", "context", "commit", "evidence", "url", "checkedAt"]
    return [dict(zip(columns, row)) for row in db.execute(
        "SELECT repository,path,context,commit_id,evidence,url,checked_at FROM contexts "
        "WHERE contexts MATCH ? ORDER BY bm25(contexts, 2, 5, 1) LIMIT ?",
        (match, max(1, min(limit, 20))))]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["ingest", "recall"])
    parser.add_argument("query", nargs="*")
    parser.add_argument("--database", type=Path, default=DATABASE)
    args = parser.parse_args()
    args.database.parent.mkdir(parents=True, exist_ok=True)
    with connect(args.database) as db:
        if args.command == "ingest":
            count = ingest(db, json.loads((ROOT / "docs/repo-intake/catalog.json").read_text()),
                           ROOT / "generated-artifacts/repository-audit",
                           ROOT / "generated-artifacts/rea-analysis")
            print(json.dumps({"records": count, "repositories": db.execute("SELECT COUNT(*) FROM repository_catalog").fetchone()[0],
                              "storage": str(args.database.relative_to(ROOT)) if args.database.is_relative_to(ROOT) else str(args.database),
                              "modelTrained": False, "appConnected": False}))
        else:
            print(json.dumps({"mode": "offline-evidence-pointer-lookup", "executionAllowed": False,
                              "results": recall(db, " ".join(args.query))}, indent=2))
