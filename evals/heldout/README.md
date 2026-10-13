# Held-out eval set (not agent-authored)

| Suite | Items | Source | License |
|---|---|---|---|
| gsm8k | 20 (test idx 0,66,…) | openai/grade-school-math `test.jsonl` | MIT |
| humaneval | 10 (every 16th task) | openai/human-eval `HumanEval.jsonl.gz` | MIT |
| mbpp | 10 (every 50th of test split 11–510) | google-research/mbpp `mbpp.jsonl` | CC BY 4.0 (attribution: Austin et al. 2021) |
| pr_outcome | 355 | Closed/merged PRs in vitalitychems-dot/TESSERA + Gitbook (2026-10-13) | own repos; titles scrubbed of emails/URLs/SHAs/PR numbers/token patterns; label = merged→pass, closed-unmerged→fail |

- `MANIFEST.sha256` pins every data file; `run.mjs` exits 2 on any drift, so a changed held-out set is always a visible diff.
- `run.mjs --baseline` (no model): gsm8k 0/20, humaneval 0/10, mbpp 0/10, pr_outcome 337/355 = 0.9493 (majority "pass"); macro 0.2373.
- `run.mjs --gold` must score 1.0 on every suite (harness self-check).
- Code suites execute predictions with local `python3` (10 s timeout, temp dir). Treat predictions as untrusted; run in the sandbox.
- Rebuild: `python3 build.py <srcdir>` then `node run.mjs --write-manifest`.
