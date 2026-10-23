import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("report", Path(__file__).with_name("rea-batch-report.py"))
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)


class ReportTests(unittest.TestCase):
    def test_reports_failure_without_promoting_result_and_escapes_names(self):
        result = report.render([{"repository": "<script>bad</script>",
                                 "status": "rea-failed"}])
        self.assertNotIn("<script>bad", result)
        self.assertIn("&lt;script&gt;", result)
        self.assertIn("rea-failed: 1", result)
        self.assertIn("not that the repository", result)


if __name__ == "__main__":
    unittest.main()
