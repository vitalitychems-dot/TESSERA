#!/usr/bin/env python3
"""Self-contained report of recorded REA outcomes; no upstream code is included."""
from collections import Counter
from datetime import datetime, timezone
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def render(records):
    counts = Counter(record["status"] for record in records)
    rows = []
    for record in records:
        values = [record["repository"], record["status"], record.get("commit", "unavailable"),
                  record.get("snapshotFiles", 0), len(record.get("omitted", []))]
        rows.append("<tr>" + "".join("<td>" + html.escape(str(value)) + "</td>" for value in values) + "</tr>")
    stats = "".join("<li>" + html.escape(f"{status}: {count}") + "</li>" for status, count in sorted(counts.items()))
    timestamp = datetime.now(timezone.utc).isoformat()
    return """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tessera — REA GitHub batch outcomes</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#101820;color:#eaf1f6}
main{max-width:1100px;padding:24px;margin:auto}.notice{padding:16px;border:1px solid #76bdb4}
.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}
td,th{padding:10px;border-bottom:1px solid #526473;text-align:left;overflow-wrap:anywhere}
td:nth-child(3){max-width:180px}h1{font-size:28px}</style><main>
<h1>REA GitHub-source analysis outcomes</h1><p>Generated """ + html.escape(timestamp) + "</p><ul>" + stats + """</ul>
<p class="notice">This report covers """ + str(len(records)) + """ cataloged public GitHub repositories.
REA 6.7.0 was used only as a development-time static JavaScript analyzer.
“rea-returned” means the command returned JSON evidence, not that the repository
was fully reverse-engineered, found safe, or installed. Other-language source is
outside this command's semantic coverage. Timeouts and failures are incomplete;
the process limits were 60 seconds per repository, a 256 MiB analyzer heap, and
bounded source snapshots. No upstream programs or installers were executed.</p>
<div class="scroll"><table><thead><tr><th scope="col">Repository</th><th scope="col">Outcome</th>
<th scope="col">Pinned commit</th><th scope="col">Snapshot files</th><th scope="col">Omitted candidate files</th>
</tr></thead><tbody>""" + "".join(rows) + """</tbody></table></div>
<h2>Storage and integration status</h2>
<p>The application contains a read-only catalog snapshot and export.
The local context index stores source pointers and analysis outcomes. Neither is
model training or operational installation. Raw analysis evidence remains in the
workspace's generated-artifacts/rea-analysis directory, excluded from Git and publishing.
Combined, GitMesh and memory-flowsint have not been synchronized.</p>
<h2>Heretic</h2><p>Heretic is a model-weight modification tool, not a repository
reverse-engineering engine. Its source was included in the catalog; no compatible
model weights were loaded and no model-modification run occurred.</p>
</main></html>"""


if __name__ == "__main__":
    directory = ROOT / "generated-artifacts/rea-analysis"
    records = json.loads((directory / "summary.json").read_text())
    target = directory / "batch-report.html"
    target.write_text(render(records))
    print(target.relative_to(ROOT))
