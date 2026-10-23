import importlib.util
from pathlib import Path
import unittest
import hashlib
import io
import tarfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("repository-file-audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def test_repository_validation(self):
        for bad in ["../x", "a/b/c", "a/b?x=1", "https://github.com/a/b", "a/.."]:
            with self.assertRaises(ValueError):
                audit.validate_repo(bad)
        self.assertEqual(audit.validate_repo("morluto/rea"), "morluto/rea")

    def test_tree_preserves_all_paths_and_marks_specials(self):
        raw = b"100644 blob abc\tfile with spaces.py\0" \
              b"120000 blob def\tlink\0" \
              b"160000 commit ghi\tchild\0" \
              b"100644 blob xyz\tasset.png\0"
        files = audit.parse_tree(raw)
        self.assertEqual(len(files), 4)
        self.assertEqual(files[0]["path"], "file with spaces.py")
        self.assertEqual([f["status"] for f in files], [
            "pending-content", "symlink-not-followed", "submodule-not-followed", "binary-not-inspected"])

    def test_structure_not_execution(self):
        result = audit.inspect_text(b"import os\nos.system('DO_NOT_EXECUTE')\ndef test(): pass\n")
        self.assertEqual(result["status"], "text-structure-inspected")
        self.assertEqual(result["signals"]["definitions"], 1)
        self.assertNotIn("content", result)
        self.assertEqual(len(result["sha256"]), 64)

    def test_binary_and_lfs_not_claimed_as_read(self):
        self.assertEqual(audit.inspect_text(b"\0abc")["status"], "binary-not-inspected")
        self.assertEqual(audit.inspect_text(b"\xff")["status"], "non-utf8-not-inspected")
        self.assertEqual(audit.inspect_text(
            b"version https://git-lfs.github.com/spec/v1\n")["status"], "lfs-pointer-only")

    def test_summary_preserves_missing_content(self):
        summary = audit.summarize({"repository": "a/b", "status": "inventoried",
                                  "files": [{"status": "content-not-read"}]})
        self.assertEqual(summary["counts"]["content-not-read"], 1)
        self.assertFalse(summary["reaExecuted"])
        self.assertFalse(summary["securityReviewComplete"])

    def test_archive_checks_blob_identity_and_never_follows_symlinks(self):
        payload = b"def hello(): pass\n"
        oid = hashlib.sha1(f"blob {len(payload)}\0".encode() + payload).hexdigest()
        files = [
            {"path": "ok.py", "gitObject": oid, "status": "pending-content"},
            {"path": "changed.py", "gitObject": "0" * 40, "status": "pending-content"},
            {"path": "link", "gitObject": "1" * 40, "status": "symlink-not-followed"},
        ]
        compressed = io.BytesIO()
        with tarfile.open(fileobj=compressed, mode="w:gz") as archive:
            for name in ["ok.py", "changed.py", "../../unlisted.py"]:
                info = tarfile.TarInfo("root/" + name)
                info.size = len(payload)
                archive.addfile(info, io.BytesIO(payload))
            link = tarfile.TarInfo("root/link")
            link.type = tarfile.SYMTYPE
            link.linkname = "/etc/passwd"
            archive.addfile(link)
        class Opener:
            def open(self, url, timeout):
                assert url.startswith("https://codeload.github.com/a/b/tar.gz/")
                return io.BytesIO(compressed.getvalue())
        with patch.object(audit.urllib.request, "build_opener", return_value=Opener()):
            result = audit.inspect_archive("a/b", "a" * 40, files)
        self.assertEqual(result["status"], "archive-inspected")
        self.assertEqual(len(files), 3)
        self.assertEqual([f["status"] for f in files], [
            "text-structure-inspected", "blob-integrity-mismatch", "symlink-not-followed"])

    def test_stream_download_budget_is_enforced(self):
        with patch.object(audit, "MAX_DOWNLOAD", 3):
            stream = audit.BoundedStream(io.BytesIO(b"abcdef"))
            with self.assertRaises(ValueError):
                stream.read(6)

    def test_stream_deadline_is_enforced(self):
        stream = audit.BoundedStream(io.BytesIO(b"abc"))
        stream.started -= audit.MAX_SECONDS + 1
        with self.assertRaises(TimeoutError):
            stream.read(1)


if __name__ == "__main__":
    unittest.main()
