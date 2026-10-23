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
    return db


def ingest(db, catalog, directory, rea_directory=None):
    """Rebuild derived data atomically; no external source can promote trust."""
    rows = []
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
    args = parser.parse_args()
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    with connect(DATABASE) as db:
        if args.command == "ingest":
            count = ingest(db, json.loads((ROOT / "docs/repo-intake/catalog.json").read_text()),
                           ROOT / "generated-artifacts/repository-audit",
                           ROOT / "generated-artifacts/rea-analysis")
            print(json.dumps({"records": count, "storage": str(DATABASE.relative_to(ROOT)),
                              "modelTrained": False, "appConnected": False}))
        else:
            print(json.dumps({"mode": "offline-evidence-pointer-lookup", "executionAllowed": False,
                              "results": recall(db, " ".join(args.query))}, indent=2))
