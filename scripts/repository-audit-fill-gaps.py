#!/usr/bin/env python3
"""Fill unread/mismatched text from pinned Git blobs, without large archive bodies."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

spec = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("repository-file-audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def fill(report):
    repo = audit.validate_repo(report["repository"])
    commit = report.get("commit", "")
    if not re.fullmatch("[0-9a-f]{40}", commit):
        raise ValueError("Invalid commit")
    candidates = [f for f in report["files"] if f["status"] in {
        "content-not-read", "blob-integrity-mismatch"}]
    if not candidates:
        return
    with tempfile.TemporaryDirectory(prefix="tessera-bounded-blobs-") as temp:
        env = dict(PATH=os.environ["PATH"], HOME=temp, LANG="C.UTF-8",
                   GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null",
                   GIT_TERMINAL_PROMPT="0", GIT_LFS_SKIP_SMUDGE="1",
                   GIT_ALLOW_PROTOCOL="https", GIT_NO_LAZY_FETCH="1")
        base = ["git", "-c", "credential.helper=", "-c", "core.hooksPath=/dev/null", "-C", temp]

        def run(args, timeout=180):
            return subprocess.run(base + args, env=env, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, timeout=timeout, check=True).stdout
        run(["init", "--bare"])
        run(["fetch", "--depth=1", "--no-tags", f"--filter=blob:limit={audit.MAX_FILE}",
             f"https://github.com/{repo}.git", commit])
        # Enumerate objects actually present; never request absent blobs.
        available = {}
        for line in run(["cat-file", "--batch-all-objects", "--batch-check"]).splitlines():
            oid, kind, size = line.decode("ascii").split()
            if kind == "blob" and int(size) <= audit.MAX_FILE:
                available[oid] = int(size)
        recovered = 0
        with subprocess.Popen(base + ["cat-file", "--batch"], env=env,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL) as process:
            try:
                for entry in candidates:
                    oid = entry["gitObject"]
                    if oid not in available:
                        entry["gapReason"] = "Blob absent from size-filtered fetch; not read"
                        continue
                    process.stdin.write((oid + "\n").encode("ascii"))
                    process.stdin.flush()
                    header = process.stdout.readline().decode("ascii").split()
                    if header != [oid, "blob", str(available[oid])]:
                        raise ValueError("Unexpected Git blob response")
                    payload = process.stdout.read(available[oid])
                    if process.stdout.read(1) != b"\n" or len(payload) != available[oid]:
                        raise ValueError("Truncated Git blob")
                    digest = audit.hashlib.sha1(f"blob {len(payload)}\0".encode() + payload).hexdigest()
                    if digest != oid:
                        raise ValueError("Git blob integrity failure")
                    entry.update(audit.inspect_text(payload))
                    entry["bytes"] = len(payload)
                    entry["inspectionSource"] = "pinned-git-blob"
                    recovered += 1
            finally:
                process.stdin.close()
                process.wait(timeout=10)
        report["gapFill"] = {"attempted": len(candidates), "recovered": recovered,
                             "method": "size-filtered-git-fetch", "maxBlobBytes": audit.MAX_FILE}


if __name__ == "__main__":
    directory = Path("generated-artifacts/repository-audit")
    summary = json.loads((directory / "summary.json").read_text())
    for old in summary["repositories"]:
        path = directory / (old["repository"].replace("/", "__") + ".json")
        report = json.loads(path.read_text())
        try:
            fill(report)
        except Exception as error:
            report["gapFillError"] = type(error).__name__
        path.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n")
        new = audit.summarize(report)
        new["gapFill"] = report.get("gapFill")
        new["gapFillError"] = report.get("gapFillError")
        old.clear()
        old.update(new)
        (directory / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        print(f'{report["repository"]}: {report.get("gapFill", {})} {report.get("gapFillError", "")}', flush=True)
