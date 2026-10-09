#!/usr/bin/env python3
"""List zip entries for the remaining Drive archives. Does not download file bodies."""

import json
import struct
import subprocess
from pathlib import Path

DRIVES = [
    ("1-4NRfXOy_zPMoGBJTgeyF31EYoV_NF5Z", "Tx13"),
    ("1HndbgRAfRtBQtADtxgE6F5ibcQ8DOkBp", "Tesseract-AI-5"),
    ("1EwcnV0BT3jpG4z7YMZ6vHkjJuHCFsBhN", "Tx17"),
    ("1cYLIpyLtgK8qFkmL9FxJPtL-PW0LiEOA", "Tesseracxt9"),
    ("15I4UjlR7Y-f-I1EgCZaJbTyfJJ6pyw_5", "XL1"),
]
OUT = Path("/workspace/data/drive")


def url(fid: str) -> str:
    return f"https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t"


def curl(fid: str, start: int, end: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "curl", "-fsSL", "--max-time", "40",
            "-H", "User-Agent: tessera-drive",
            "-r", f"{start}-{end}",
            "-o", str(dest),
            url(fid),
        ],
        check=True,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    for fid, name in DRIVES:
        row = {"name": name, "bytes": None, "entries": 0, "text": 0, "note": ""}
        print("start", name, flush=True)
        try:
            head = OUT / f"{name}-head.bin"
            curl(fid, 0, 0, head)
            # size comes from a ranged request; ask curl to write the header
            probe = subprocess.run(
                ["curl", "-sI", "--max-time", "25", "-H", "Range: bytes=0-0", "-H", "User-Agent: tessera-drive", url(fid)],
                check=True, capture_output=True, text=True,
            )
            total = None
            for line in probe.stdout.splitlines():
                if line.lower().startswith("content-range:") and "/" in line:
                    total = int(line.split("/")[-1].strip())
            row["bytes"] = total
            if not total:
                row["note"] = "size unknown"
                report.append(row)
                continue
            print("size", name, total, flush=True)
            tail = OUT / f"{name}-tail.bin"
            curl(fid, max(0, total - 65536), total - 1, tail)
            blob = tail.read_bytes()
            idx = blob.rfind(b"PK\x05\x06")
            if idx < 0:
                row["note"] = "no zip directory in the last 64 KB"
                report.append(row)
                continue
            cd_size, cd_off = struct.unpack_from("<II", blob, idx + 12)
            if cd_size > 20 * 1024 * 1024 or cd_off == 0xFFFFFFFF:
                row["note"] = f"directory {cd_size} bytes left unread"
                report.append(row)
                continue
            cd_path = OUT / f"{name}-cd.bin"
            curl(fid, cd_off, cd_off + cd_size - 1, cd_path)
            cd = cd_path.read_bytes()
            pos = 0
            text = 0
            entries = 0
            while pos + 46 <= len(cd) and cd[pos : pos + 4] == b"PK\x01\x02":
                nlen, elen, clen = struct.unpack_from("<HHH", cd, pos + 28)
                path = cd[pos + 46 : pos + 46 + nlen].decode("utf-8", "replace").lower()
                entries += 1
                if path.endswith((".md", ".txt", ".ts", ".tsx", ".json")) and "node_modules" not in path:
                    text += 1
                pos += 46 + nlen + elen + clen
            row["entries"] = entries
            row["text"] = text
            row["note"] = "directory listed"
            cd_path.unlink(missing_ok=True)
        except Exception as exc:
            row["note"] = type(exc).__name__ + ": " + str(exc)[:160]
        report.append(row)
        (OUT / "index-report.json").write_text(json.dumps(report, indent=2))
        print(name, row["note"], "entries", row["entries"], "text", row["text"], flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
