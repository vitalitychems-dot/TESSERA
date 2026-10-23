#!/usr/bin/env python3
"""Read-only public-source inventory. No checkout, extraction, installers or LLMs.

Git trees enumerate ALL tracked paths. A bounded commit-pinned archive stream
provides text for structural inspection. Anything not read retains explicit status.
Reports live outside Git/deployment in generated-artifacts.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request

MAX_FILE = 512 * 1024
MAX_DOWNLOAD = 80 * 1024 * 1024
MAX_EXPANDED = 256 * 1024 * 1024
MAX_SECONDS = 180
BINARY = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".woff",
    ".woff2", ".ttf", ".otf", ".mp4", ".mp3", ".wav", ".ogg", ".mov",
    ".zip", ".gz", ".xz", ".7z", ".tar", ".rar", ".exe", ".dll", ".so",
    ".dylib", ".bin", ".db", ".sqlite", ".safetensors", ".gguf", ".onnx",
    ".pt", ".pth", ".ckpt", ".npy", ".npz", ".parquet", ".wasm",
}


def validate_repo(name):
    if not isinstance(name, str) or not re.fullmatch(
        r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", name
    ) or name.split("/")[1] in {".", ".."}:
        raise ValueError("Invalid repository identifier")
    return name


def parse_tree(raw):
    records = []
    for line in raw.split(b"\0"):
        if not line:
            continue
        header, path = line.split(b"\t", 1)
        mode, kind, oid = header.decode("ascii").split(" ")
        name = path.decode("utf-8", errors="surrogateescape")
        status = "pending-content"
        if mode == "160000":
            status = "submodule-not-followed"
        elif mode == "120000":
            status = "symlink-not-followed"
        elif Path(name).suffix.lower() in BINARY:
            status = "binary-not-inspected"
        records.append(dict(path=name, mode=mode, kind=kind, gitObject=oid, status=status))
    return records


def inspect_text(payload):
    if b"\0" in payload:
        return {"status": "binary-not-inspected"}
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        return {"status": "non-utf8-not-inspected"}
    if text.startswith("version https://git-lfs.github.com/spec/v1"):
        return {"status": "lfs-pointer-only"}
    return {
        "status": "text-structure-inspected",
        "sha256": hashlib.sha256(payload).hexdigest(),
        "lines": len(text.splitlines()),
        # Counts are signals, not a security review or semantic understanding.
        "signals": {
            "imports": len(re.findall(r"(?m)^\s*(?:import\s|from\s\S+\s+import|require\()", text)),
            "definitions": len(re.findall(r"(?m)^\s*(?:export\s+)?(?:async\s+)?(?:def|class|function)\s", text)),
            "networkReferences": len(re.findall(r"https?://", text)),
            "processReferences": len(re.findall(r"\b(?:subprocess|child_process|execSync|spawnSync|os\.system)\b", text)),
        },
    }


class BoundedStream:
    def __init__(self, response):
        self.response = response
        self.bytes = 0
        self.started = time.monotonic()

    def read(self, size=-1):
        if time.monotonic() - self.started > MAX_SECONDS:
            raise TimeoutError("Archive time budget exceeded")
        data = self.response.read(min(size if size >= 0 else 65536, 65536))
        self.bytes += len(data)
        if self.bytes > MAX_DOWNLOAD:
            raise ValueError("Archive compressed-byte budget exceeded")
        return data


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def inspect_archive(repo, commit, files):
    url = f"https://codeload.github.com/{repo}/tar.gz/{commit}"
    index = {entry["path"]: entry for entry in files}
    expanded = 0
    seen = set()
    opener = urllib.request.build_opener(NoRedirect)
    with opener.open(url, timeout=20) as response:
        stream = BoundedStream(response)
        try:
            with tarfile.open(fileobj=stream, mode="r|gz") as archive:
                for member in archive:
                    expanded += max(0, member.size)
                    if expanded > MAX_EXPANDED:
                        raise ValueError("Archive expanded-byte budget exceeded")
                    path = member.name.partition("/")[2]
                    # No extraction and only paths found in the pinned Git tree.
                    if path not in index:
                        continue
                    if path in seen:
                        raise ValueError("Duplicate archive path")
                    seen.add(path)
                    entry = index[path]
                    entry["bytes"] = member.size
                    if entry["status"] != "pending-content":
                        continue
                    if not member.isfile():
                        entry["status"] = "archive-special-file-not-read"
                        continue
                    if member.size > MAX_FILE:
                        entry["status"] = "oversized-not-inspected"
                        continue
                    handle = archive.extractfile(member)
                    payload = handle.read(MAX_FILE + 1)
                    # Verify archive bytes are exactly the Git blob inventoried.
                    oid = hashlib.sha1(
                        f"blob {len(payload)}\0".encode() + payload
                    ).hexdigest()
                    if oid != entry["gitObject"]:
                        entry["status"] = "blob-integrity-mismatch"
                        continue
                    entry.update(inspect_text(payload))
            return dict(status="archive-inspected", compressedBytes=stream.bytes, expandedBytes=expanded)
        except Exception as error:
            return dict(status="archive-incomplete", error=type(error).__name__,
                        reason=str(error)[:200], compressedBytes=stream.bytes, expandedBytes=expanded)


def summarize(report):
    counts = {}
    for entry in report.get("files", []):
        counts[entry["status"]] = counts.get(entry["status"], 0) + 1
    return dict(
        repository=report["repository"], commit=report.get("commit"),
        status=report["status"], treeComplete=report.get("treeComplete", False),
        trackedPaths=len(report.get("files", [])), counts=counts,
        error=report.get("error"), archive=report.get("archive"),
        reaExecuted=False, installed=False, securityReviewComplete=False,
    )


def audit(repo):
    repo = validate_repo(repo)
    report = dict(repository=repo, status="inventory-unavailable", files=[])
    with tempfile.TemporaryDirectory(prefix="tessera-file-audit-") as temp:
        env = dict(PATH=os.environ["PATH"], HOME=temp, LANG="C.UTF-8",
                   GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null",
                   GIT_TERMINAL_PROMPT="0", GIT_LFS_SKIP_SMUDGE="1",
                   GIT_ALLOW_PROTOCOL="https")
        target = str(Path(temp) / "repo")

        def git(*args, timeout=60):
            result = subprocess.run(
                ["git", "-c", "credential.helper=", "-c", "core.hooksPath=/dev/null", *args],
                env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout,
                check=False,
            )
            if result.returncode:
                raise RuntimeError(f"git exited {result.returncode}")
            if len(result.stdout) > 32 * 1024 * 1024:
                raise ValueError("Git tree output exceeded budget")
            return result.stdout
        try:
            git("clone", "--depth=1", "--filter=blob:none", "--no-checkout",
                "--no-tags", f"https://github.com/{repo}.git", target)
            commit = git("-C", target, "rev-parse", "HEAD").decode().strip()
            if not re.fullmatch(r"[0-9a-f]{40}", commit):
                raise ValueError("Unexpected Git object format")
            files = parse_tree(git("-C", target, "ls-tree", "-r", "-z", commit))
            report.update(commit=commit, files=files, treeComplete=True, status="inventoried")
            report["archive"] = inspect_archive(repo, commit, files)
        except Exception as error:
            report["error"] = type(error).__name__ + ": " + str(error)[:150]
        finally:
            for entry in report["files"]:
                if entry["status"] == "pending-content":
                    entry["status"] = "content-not-read"
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default="docs/repo-intake/catalog.json")
    parser.add_argument("--output", default="generated-artifacts/repository-audit")
    parser.add_argument("--repo", help="Optional single repository from the catalog")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    catalog = json.loads(Path(args.catalog).read_text())
    repos = [validate_repo(item["repository"]) for item in catalog["repositories"]]
    if args.repo:
        if args.repo not in repos:
            raise ValueError("Repository is not in the catalog")
        repos = [args.repo]
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    summaries = []
    for number, repo in enumerate(repos, 1):
        path = output / (repo.replace("/", "__") + ".json")
        if args.resume and path.exists():
            report = json.loads(path.read_text())
        else:
            report = audit(repo)
            report["checkedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            path.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n")
        summary = summarize(report)
        summaries.append(summary)
        (output / "summary.json").write_text(json.dumps({
            "scope": "Pinned Git trees and bounded static text structure; not semantic/security review, REA execution, or model training.",
            "expectedRepositories": len(repos), "processedRepositories": len(summaries),
            "repositories": summaries,
        }, indent=2) + "\n")
        print(f"{number}/{len(repos)} {repo}: {json.dumps(summary)}", flush=True)


if __name__ == "__main__":
    main()
