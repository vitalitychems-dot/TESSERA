#!/usr/bin/env python3
"""Generate a self-contained coverage report; never includes source file bodies."""
import argparse
import html
import json
from pathlib import Path
import urllib.parse
import base64
import gzip


def file_url(repository, commit, path):
    return "https://github.com/" + repository + "/blob/" + commit + "/" + urllib.parse.quote(path, safe="/")


def load_records(directory):
    summary = json.loads((directory / "summary.json").read_text())
    files = []
    for repo in summary["repositories"]:
        report = json.loads((directory / (repo["repository"].replace("/", "__") + ".json")).read_text())
        for entry in report.get("files", []):
            files.append({
                "repo": report["repository"], "path": entry["path"], "status": entry["status"],
                "lines": entry.get("lines"),
                "url": file_url(report["repository"], report["commit"], entry["path"]),
            })
    return summary, files


def render(summary, files):
    # Base64 is inert in an HTML script element; gzip keeps the all-file report
    # small enough to open on phones. No third-party runtime or network is used.
    payload = base64.b64encode(gzip.compress(
        json.dumps(files, ensure_ascii=True).encode(), mtime=0)).decode("ascii")
    rows = []
    for repo in summary["repositories"]:
        counts = repo.get("counts", {})
        rows.append("<tr>" + "".join("<td>" + html.escape(str(value)) + "</td>" for value in [
            repo["repository"], (repo.get("commit") or "unavailable")[:12],
            repo["trackedPaths"], counts.get("text-structure-inspected", 0),
            repo["trackedPaths"] - counts.get("text-structure-inspected", 0),
            (repo.get("archive", {}).get("status") if repo.get("archive") else repo["status"]) +
            (f'; Git recovered {repo["gapFill"]["recovered"]}' if repo.get("gapFill") else ""),
        ]) + "</tr>")
    return TEMPLATE.replace("PAYLOAD_PLACEHOLDER", payload).replace("ROWS_PLACEHOLDER", "".join(rows)).replace(
        "COUNT_PLACEHOLDER", html.escape(f'{summary["processedRepositories"]}/{summary["expectedRepositories"]} repositories; {len(files):,} tracked paths'))


TEMPLATE = """<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tessera repository file coverage</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#101820;color:#eff5f8}
main{max-width:1150px;margin:auto;padding:24px}h1{font-size:28px}
.notice{padding:16px;background:#233342;border-left:4px solid #76d0c8}
table{border-collapse:collapse;width:100%;font-size:13px}
td,th{border-bottom:1px solid #425564;padding:8px;text-align:left}
.scroll{overflow:auto}input,select,button{font:inherit;padding:10px;background:#fff;color:#142330;border:1px solid #667;border-radius:4px}
input{max-width:95%;width:440px}button{cursor:pointer;margin:8px}
a{color:#90ddd7}a:focus,button:focus,input:focus,select:focus{outline:3px solid #eaba76}
.file{border-bottom:1px solid #425564;padding:12px 0;overflow-wrap:anywhere}.muted{color:#b3c6d3}
</style><main><h1>Tessera repository file coverage</h1>
<p>COUNT_PLACEHOLDER</p>
<div class="notice">This is an automated inventory and bounded text-structure inspection,
not a full code review, security clearance, REA run, installation, or model training.
All tracked paths are retained in the index when their Git tree was obtained.
Binary, oversized, LFS, unread and integrity-mismatched content is explicitly labeled.
Source links are pinned to inspected commits and require internet; searching this report works offline.</div>
<h2>Repository coverage</h2><div class="scroll"><table><thead><tr>
<th scope="col">Repository</th><th scope="col">Commit</th><th scope="col">Paths</th>
<th scope="col">Text inspected</th><th scope="col">Other/uninspected</th><th scope="col">Archive status</th>
</tr></thead><tbody>ROWS_PLACEHOLDER</tbody></table></div>
<h2>All-file index</h2><p>Search matches file paths and repository names, not source contents.</p>
<label for="query">Find files</label><br><input id="query" type="search" placeholder="e.g. memory, README, workflow">
<label for="status">Status</label> <select id="status"><option value="">All statuses</option></select>
<p id="count" role="status" aria-live="polite"></p>
<button id="prev">Previous 100</button><button id="next">Next 100</button><div id="results"></div>
<noscript>The repository table is available above. File search requires JavaScript.</noscript>
<script type="application/octet-stream" id="data">PAYLOAD_PLACEHOLDER</script>
<script>
async function start(){
if(typeof DecompressionStream==='undefined')throw new Error('File search requires a current browser with gzip decompression support.');
const packed=Uint8Array.from(atob(document.getElementById('data').textContent),c=>c.charCodeAt(0));
const decoded=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
const files=JSON.parse(decoded);
const query=document.getElementById('query'),status=document.getElementById('status');
for(const label of [...new Set(files.map(f=>f.status))].sort()){
 const o=document.createElement('option');o.value=label;o.textContent=label;status.append(o);
}
let offset=0,filtered=files;
function show(){
 const terms=query.value.toLowerCase().split(/\\s+/).filter(Boolean);
 filtered=files.filter(f=>(!status.value||f.status===status.value)&&terms.every(t=>(f.repo+'/'+f.path).toLowerCase().includes(t)));
 const root=document.getElementById('results');root.replaceChildren();
 document.getElementById('count').textContent=filtered.length+' matching files; showing '+(filtered.length?offset+1:0)+'–'+Math.min(offset+100,filtered.length);
 for(const f of filtered.slice(offset,offset+100)){
  const row=document.createElement('div');row.className='file';
  const a=document.createElement('a');a.href=f.url;a.textContent=f.repo+'/'+f.path;a.rel='noopener noreferrer';a.target='_blank';
  const detail=document.createElement('div');detail.className='muted';detail.textContent=f.status+(f.lines==null?'':' · '+f.lines+' lines');
  row.append(a,detail);root.append(row);
 }
 document.getElementById('prev').disabled=offset===0;
 document.getElementById('next').disabled=offset+100>=filtered.length;
}
query.addEventListener('input',()=>{offset=0;show()});status.addEventListener('change',()=>{offset=0;show()});
document.getElementById('prev').onclick=()=>{offset=Math.max(0,offset-100);show()};
document.getElementById('next').onclick=()=>{offset+=100;show()};
show();
}
start().catch(()=>{document.getElementById('count').textContent='Unable to open the file index. Please use a current browser with JavaScript and gzip decompression support. The repository coverage table remains available above.'});
</script></main></html>"""


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", default="generated-artifacts/repository-audit")
    args = parser.parse_args()
    directory = Path(args.directory)
    summary, files = load_records(directory)
    target = directory / "file-coverage.html"
    target.write_text(render(summary, files))
    print(f"{target}: {len(files)} file records")
