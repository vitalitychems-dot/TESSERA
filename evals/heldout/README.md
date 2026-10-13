# Held-out eval runner

Scores agent output on a held-out set that **no agent authored**: fixed subsets of public
benchmarks plus real TESSERA PR outcomes (merged = pass, closed unmerged = fail).

**The scoring data is not in this repo.** TESSERA is public, so the items and their hash
manifest live in the private `vitalitychems-dot/Gitbook` repo under `evals/heldout/`
(`data/*.jsonl`, `MANIFEST.sha256`, `build.py`, licenses). Point the runner at a checkout:

```
HELDOUT_DIR=/path/to/Gitbook/evals/heldout node evals/heldout/run.mjs --baseline
HELDOUT_DIR=... node evals/heldout/run.mjs --gold                 # harness check, expect 1.0
HELDOUT_DIR=... node evals/heldout/run.mjs --predictions p.json   # {"<id>": "<answer|code|pass|fail>"}
```

The runner checks every data file against `MANIFEST.sha256` and exits 2 on any drift.

## Sandboxing predicted code
HumanEval/MBPP predictions are untrusted code. `sandbox.mjs` runs each one with:
- **bubblewrap** (`bwrap --unshare-all`): no network, separate pid/ipc/uts/user namespaces
- **read-only filesystem**: only the run's temp dir is writable; /home, /root, /workspace, /cursor, /run, /tmp are empty tmpfs
- **timeout**: 10 s wall clock (SIGKILL), plus `ulimit` CPU 10 s, 1 GiB memory, 10 MiB files, 256 procs
- **temp dir**: a fresh `mkdtemp` dir as cwd/HOME/TMPDIR, deleted afterwards
- **clean env**: only PATH/HOME/TMPDIR/LANG; `python3 -I -S`

If `bwrap` is missing or can't start, the runner refuses to execute code (fails closed).

## Rules
- The data directory is a locked path; changes need Father's code-owner review.
- Scores from this runner are inputs for humans and the before/after bench; the private copy is the source of truth.

## Tests
`node --test evals/heldout/run.test.mjs` uses a tiny synthetic fixture in a temp dir.
