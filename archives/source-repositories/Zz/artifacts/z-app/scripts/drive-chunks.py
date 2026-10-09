#!/usr/bin/env python3
"""Index Google Drive zips in ranges under 100 MB. Saves small text entries only."""

import hashlib
import io
import json
import struct
import urllib.request
from pathlib import Path

DRIVES = [
    ("1CDae9bn1bPR13MoPikDHUIhgyUy2pKdc", "8-2"),
    ("1-4NRfXOy_zPMoGBJTgeyF31EYoV_NF5Z", "Tx13"),
    ("1HndbgRAfRtBQtADtxgE6F5ibcQ8DOkBp", "Tesseract-AI-5"),
    ("1EwcnV0BT3jpG4z7YMZ6vHkjJuHCFsBhN", "Tx17"),
    ("1cYLIpyLtgK8qFkmL9FxJPtL-PW0LiEOA", "Tesseracxt9"),
    ("15I4UjlR7Y-f-I1EgCZaJbTyfJJ6pyw_5", "XL1"),
]
ROOT = Path("/workspace/data/drive")
CHUNK = 100 * 1024 * 1024
KEEP = (".md", ".txt", ".ts", ".tsx", ".json", ".mjs")
SKIP = ("node_modules", "natal", "income", "wallet", "secret")
SECRET = ("session_secret", "private key", "begin rsa", "begin openssh")


def url_for(fid: str) -> str:
    return f"https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t"


def fetch(fid: str, start: int, end: int) -> bytes:
    want = end - start + 1
    if want <= 0 or want > CHUNK:
        raise RuntimeError(f"range {want} is outside the 100 MB cap")
    req = urllib.request.Request(
        url_for(fid),
        headers={"Range": f"bytes={start}-{end}", "User-Agent": "tessera-drive"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        code = getattr(res, "status", 200)
        if code != 206:
            raise RuntimeError(f"HTTP {code}, range was not honored")
        cr = res.headers.get("Content-Range") or ""
        if "/" not in cr:
            raise RuntimeError("no content-range")
        return res.read(want)


def size_of(fid: str) -> int | None:
    req = urllib.request.Request(url_for(fid), headers={"Range": "bytes=0-0", "User-Agent": "tessera-drive"})
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            cr = res.headers.get("Content-Range") or ""
            if "/" in cr:
                return int(cr.split("/")[-1])
            data = res.read(200)
            if data[:1] == b"<" or data[:15].lower().startswith(b"<!doctype"):
                return None
    except Exception:
        return None
    return None


def find_eocd(blob: bytes) -> int | None:
    sig = b"PK\x05\x06"
    idx = blob.rfind(sig)
    return idx if idx >= 0 else None


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    report = []
    for fid, name in DRIVES:
        row = {"id": fid, "name": name, "bytes": None, "entries": 0, "saved": 0, "note": ""}
        print("start", name, flush=True)
        try:
            total = size_of(fid)
            row["bytes"] = total
            if not total:
                row["note"] = "size unknown or the link returned a page, not the archive"
                report.append(row)
                continue
            print("size", name, total, flush=True)
            tail_start = max(0, total - min(CHUNK, 2 * 1024 * 1024))
            tail = fetch(fid, tail_start, total - 1)
            rel = find_eocd(tail)
            if rel is None:
                row["note"] = "no zip directory in the last 2 MB"
                report.append(row)
                continue
            eocd = tail[rel : rel + 22]
            cd_size, cd_off = struct.unpack_from("<II", eocd, 12)
            if cd_size > 20 * 1024 * 1024:
                row["note"] = f"directory is {cd_size} bytes, left unread this pass"
                report.append(row)
                continue
            cd = fetch(fid, cd_off, cd_off + cd_size - 1)
            saved = 0
            entries = 0
            pos = 0
            while pos + 46 <= len(cd) and cd[pos : pos + 4] == b"PK\x01\x02":
                method = struct.unpack_from("<H", cd, pos + 10)[0]
                comp_size = struct.unpack_from("<I", cd, pos + 20)[0]
                name_len, extra_len, comment_len = struct.unpack_from("<HHH", cd, pos + 28)
                local_off = struct.unpack_from("<I", cd, pos + 42)[0]
                path = cd[pos + 46 : pos + 46 + name_len].decode("utf-8", "replace")
                entries += 1
                pos += 46 + name_len + extra_len + comment_len
                low = path.lower()
                if not low.endswith(KEEP) or any(bit in low for bit in SKIP):
                    continue
                if comp_size > 100_000 or method not in (0, 8):
                    continue
                if saved >= 30:
                    continue
                blob = fetch(fid, local_off, local_off + comp_size + 64)
                # local header then payload
                if blob[:4] != b"PK\x03\x04":
                    continue
                nlen, elen = struct.unpack_from("<HH", blob, 26)
                payload = blob[30 + nlen + elen : 30 + nlen + elen + comp_size]
                if method == 8:
                    import zlib
                    try:
                        text = zlib.decompress(payload, -15).decode("utf-8", "replace")
                    except Exception:
                        continue
                else:
                    text = payload.decode("utf-8", "replace")
                if any(flag in text.lower() for flag in SECRET):
                    continue
                digest = hashlib.sha256(text.encode()).hexdigest()
                (ROOT / f"{digest[:16]}.txt").write_text(text)
                saved += 1
            row["entries"] = entries
            row["saved"] = saved
            row["note"] = "indexed"
        except Exception as exc:
            row["note"] = type(exc).__name__ + ": " + str(exc)[:180]
        report.append(row)
        (ROOT / "report.json").write_text(json.dumps(report, indent=2))
        print(name, row["note"], "entries", row["entries"], "saved", row["saved"], flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
