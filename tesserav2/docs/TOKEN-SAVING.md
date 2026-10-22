# Token-saving rules (all bots)

Summarized from the Collab operating notes `operations/code-lookup-graph.md` (GB-044) and
`operations/mesh-speed-collaboration.md` (GB-050). These bind every bot working on tesserav2.

## 1. Snippet-first reads
1. **Locate** with the code graph (`search_code` / `search_graph`) or a narrow, path-scoped `rg`.
2. **Read a bounded snippet** (`get_code_snippet`, or `path:start-end`).
3. **Whole file only if needed** (missing callers, types, or context).

Do not orient by broad recursive greps or by pasting whole packages. Reported savings: ~69% fewer tokens than
grep-then-read, >99% fewer than full-tree sweeps. Graph indexes can lag the tip; confirm merge-critical facts against git.

## 2. Small, targeted changes
- One change = one purpose = one CHANGES.md number. Prefer the smallest diff that does the job.
- Evidence is pointers (path:lines, commit SHA, test name), not file dumps.

## 3. One owner per path
- Write only in your lane; read anything. Lanes: TESSERA = aim/decide, Collab = pen/writing, Memory = recall,
  Storage = warehouse, Network = one piece at a time, GitAI = the app. Vitality stays out.
- Two writers on one path: both stop, report to TESSERA, TESSERA names the sole writer.

## 4. Short messages
- Status and handoffs: at most 6 bullets, 120 words. Status goes to TESSERA; TESSERA batches what goes to Father.

## 5. Log the cost and the gain
Append one JSON line per change to [`docs/metrics.jsonl`](metrics.jsonl):

```json
{"date": "2026-10-21T02:45-05:00", "change": 7, "est_tokens": 12000, "improvement": "typecheck now passes on Node 22", "evidence": "docs/HEALTH.md"}
```

| Field | Meaning |
| --- | --- |
| `date` | ISO time with CT offset |
| `change` | CHANGES.md number (`#N`) |
| `est_tokens` | Rough tokens spent on the change |
| `improvement` | What got better, in one line |
| `evidence` | Pointer that proves it (test, file, commit) |

## Never
- Commit graph caches, secrets, or endpoint URLs. Set `DATABASE_URL` to anything but loopback in tests.
- Claim a model, the pen, or CL1 is live before it is tested.
