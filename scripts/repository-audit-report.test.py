import importlib.util
from pathlib import Path
import unittest
import base64
import gzip
import json
import re

spec = importlib.util.spec_from_file_location("report", Path(__file__).with_name("repository-audit-report.py"))
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)


class ReportTests(unittest.TestCase):
    def test_file_url_encodes_untrusted_path(self):
        self.assertEqual(report.file_url("a/b", "abc", "src/a#b?.js"),
                         "https://github.com/a/b/blob/abc/src/a%23b%3F.js")

    def test_embedded_data_cannot_close_script(self):
        summary = {"repositories": [], "processedRepositories": 0, "expectedRepositories": 47}
        rendered = report.render(summary, [{"path": "</script><img onerror=alert(1)>"}])
        self.assertNotIn("</script><img", rendered)
        packed = re.search(r'id="data">([^<]+)</script>', rendered).group(1)
        self.assertEqual(json.loads(gzip.decompress(base64.b64decode(packed))),
                         [{"path": "</script><img onerror=alert(1)>"}])
        self.assertNotIn("PAYLOAD_PLACEHOLDER", rendered)
        self.assertIn("0/47 repositories", rendered)


if __name__ == "__main__":
    unittest.main()
