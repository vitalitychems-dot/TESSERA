#!/usr/bin/env python3
"""Rebuild the held-out eval set. Items are NOT agent-authored:
public benchmarks (fixed deterministic picks) + real PR outcomes (title + pass/fail only).
Usage: python3 evals/heldout/build.py <srcdir>  (srcdir holds gsm.jsonl, he.jsonl.gz, mbpp.jsonl, pr-TESSERA.json, pr-Gitbook.json)
After rebuilding, run `node evals/heldout/run.mjs --write-manifest`; any change to data/ shows up as a manifest diff."""
import json, gzip, re, sys, os
src = sys.argv[1]; out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
def jl(p, opener=open):
    with opener(p, "rt") as f: return [json.loads(l) for l in f if l.strip()]
def dump(name, rows):
    with open(os.path.join(out, name), "w") as f:
        for r in rows: f.write(json.dumps(r, sort_keys=True) + "\n")
gsm = jl(f"{src}/gsm.jsonl")
dump("gsm8k.jsonl", [{"id": f"gsm8k-test-{i}", "question": gsm[i]["question"],
     "answer": gsm[i]["answer"].split("####")[-1].strip().replace(",", "")} for i in range(0, len(gsm), 66)][:20])
he = jl(f"{src}/he.jsonl.gz", gzip.open)
dump("humaneval.jsonl", [{"id": he[i]["task_id"], "prompt": he[i]["prompt"], "entry_point": he[i]["entry_point"],
     "test": he[i]["test"], "canonical_solution": he[i]["canonical_solution"]} for i in range(0, 164, 16)][:10])
mb = [r for r in jl(f"{src}/mbpp.jsonl") if 11 <= r["task_id"] <= 510]  # official test split
dump("mbpp.jsonl", [{"id": f"mbpp-{r['task_id']}", "text": r["text"], "test_list": r["test_list"],
     "test_setup_code": r["test_setup_code"], "code": r["code"]} for r in mb[::50]][:10])
SCRUB = [(re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "<email>"), (re.compile(r"https?://\S+"), "<url>"),
         (re.compile(r"\b(gh[pousr]_|github_pat_|sk-|AKIA)[A-Za-z0-9_]{8,}"), "<secret>"),
         (re.compile(r"\b[0-9a-f]{7,40}\b"), "<sha>"), (re.compile(r"#\d+"), "#<n>")]
rows = []
for repo in ("TESSERA", "Gitbook"):
    for p in json.load(open(f"{src}/pr-{repo}.json")):
        if p["state"] == "OPEN": continue
        t = p["title"]
        for rx, rep in SCRUB: t = rx.sub(rep, t)
        rows.append({"id": f"pr-{repo.lower()}-{len(rows)}", "repo": repo, "title": t,
                     "outcome": "pass" if p["state"] == "MERGED" else "fail"})
dump("pr-outcomes.jsonl", rows)
