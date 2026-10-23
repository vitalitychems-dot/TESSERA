#!/usr/bin/env python3
"""Development-only REA static analysis of cataloged public GitHub sources."""
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "generated-artifacts/rea-analysis"
CLI = ROOT / "scripts/node_modules/rea-agents/scripts/rea.mjs"
EXTENSIONS = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".json"}
LIMIT = 512 * 1024


def run(repo):
    if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", repo):
        raise ValueError("Invalid GitHub repository")
    evidence = {"repository": repo, "reaVersion": "6.7.0", "mode": "static-javascript-only",
                "targetCodeExecuted": False, "installedInApp": False, "modelTraining": False,
                "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    prior = ROOT / "generated-artifacts/repository-audit" / (repo.replace("/", "__") + ".json")
    pinned = json.loads(prior.read_text())["commit"] if prior.exists() else "HEAD"
    with tempfile.TemporaryDirectory(prefix="tessera-rea-") as tmp:
        home = Path(tmp)
        source = home / "source"
        source.mkdir()
        bare = home / "git"
        bare.mkdir()
        env = dict(PATH=os.environ["PATH"], HOME=tmp, LANG="C.UTF-8",
                   GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null",
                   GIT_TERMINAL_PROMPT="0", GIT_LFS_SKIP_SMUDGE="1",
                   GIT_ALLOW_PROTOCOL="https", GIT_NO_LAZY_FETCH="1")
        base = ["git", "-c", "credential.helper=", "-c", "core.hooksPath=/dev/null", "-C", str(bare)]

        def git(*args):
            return subprocess.run(base + list(args), env=env, check=True, timeout=120,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout
        git("init", "--bare")
        git("fetch", "--depth=1", "--no-tags", f"--filter=blob:limit={LIMIT}",
            f"https://github.com/{repo}.git", pinned)
        commit = git("rev-parse", "FETCH_HEAD").decode().strip()
        evidence["commit"] = commit
        available = {}
        for line in git("cat-file", "--batch-all-objects", "--batch-check").splitlines():
            oid, kind, size = line.decode().split()
            if kind == "blob" and int(size) <= LIMIT:
                available[oid] = int(size)
        files = []
        skipped = []
        total = 0
        with subprocess.Popen(base + ["cat-file", "--batch"], env=env,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE) as blobs:
            try:
                for entry in git("ls-tree", "-r", "-z", commit).split(b"\0"):
                    if not entry:
                        continue
                    info, path = entry.split(b"\t", 1)
                    mode, kind, oid = info.decode().split()
                    name = path.decode("utf-8", errors="replace")
                    parts = Path(name).parts
                    if mode not in {"100644", "100755"} or Path(name).suffix.lower() not in EXTENSIONS:
                        continue
                    if Path(name).is_absolute() or ".." in parts or ".git" in parts:
                        skipped.append({"path": name, "reason": "unsafe-path"})
                        continue
                    if oid not in available or total + available[oid] > 64 * 1024 * 1024:
                        skipped.append({"path": name, "reason": "snapshot-size-budget"})
                        continue
                    blobs.stdin.write((oid + "\n").encode())
                    blobs.stdin.flush()
                    header = blobs.stdout.readline().decode().split()
                    if header != [oid, "blob", str(available[oid])]:
                        raise ValueError("Unexpected object")
                    payload = blobs.stdout.read(available[oid])
                    if blobs.stdout.read(1) != b"\n":
                        raise ValueError("Truncated object")
                    destination = source / name
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(payload)
                    total += len(payload)
                    files.append(name)
            finally:
                blobs.stdin.close()
                blobs.wait(timeout=10)
        evidence.update(snapshotFiles=len(files), snapshotBytes=total, omitted=skipped,
                        scope="Selected JS/TS/JSON files only; not a complete semantic review")
        if not any(Path(p).suffix.lower() != ".json" for p in files):
            evidence["status"] = "unsupported-no-javascript"
            return evidence
        output = OUT / (repo.replace("/", "__") + ".rea.json")
        errors = OUT / (repo.replace("/", "__") + ".stderr.txt")
        with output.open("wb") as stdout, errors.open("wb") as stderr:
            proc = subprocess.Popen(
                ["node", str(CLI), "analyze-javascript-application", str(source),
                 "--artifact-format", "directory", "--max-heap-mb", "256",
                 "--max-semantic-nodes", "10000", "--max-semantic-nodes-per-file", "500",
                 "--analysis-timeout-ms", "3000", "--format", "json"],
                env=env, stdout=stdout, stderr=stderr, start_new_session=True)
            try:
                code = proc.wait(timeout=60)
                evidence.update(status="rea-returned" if code == 0 else "rea-failed", exitCode=code)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait()
                evidence["status"] = "rea-timeout"
        evidence["resultFile"] = str(output.relative_to(ROOT))
        if evidence["status"] == "rea-returned":
            try:
                result = json.loads(output.read_text())
                evidence["resultKeys"] = list(result)[:20] if isinstance(result, dict) else []
                # Keep REA limitations in its raw evidence, never equate exit 0 with a pass.
                if isinstance(result, dict) and (result.get("success") is False or result.get("error")):
                    evidence["status"] = "rea-reported-error"
            except (ValueError, OSError):
                evidence["status"] = "rea-invalid-output"
        return evidence


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((ROOT / "docs/repo-intake/catalog.json").read_text())
    results = []
    for item in catalog["repositories"]:
        repo = item["repository"]
        try:
            result = run(repo)
        except Exception as error:
            result = {"repository": repo, "status": "blocked", "error": type(error).__name__}
        results.append(result)
        (OUT / "summary.json").write_text(json.dumps(results, indent=2) + "\n")
        print(f"{len(results)}/{len(catalog['repositories'])} {repo}: {result['status']}", flush=True)
