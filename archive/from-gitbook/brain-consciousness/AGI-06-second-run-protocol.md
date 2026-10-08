# AGI-06 — Second-run (independent verification) protocol

- **Title:** AGI-06 second-run protocol
- **Author lane:** Build
- **Date (CT):** 2026-10-06
- **Source:** Gitbook `main@fcabd13a56a1c5e1b93a7a7aa46bc4b29f883d7f`: `brain-consciousness/EXECUTION-BOARD-20.md` (AGI-06 row), `AGI-COLLABORATION-IMPROVEMENT-ROADMAP.md` (item 6), `mesh/roles/build.md`, `mesh/GRAFT-AGENT-PUBLISHING.md`
- **License:** TBD
- **Summary:** How Build reproduces a reported result from a pinned snapshot, records raw evidence, and returns AGREE / DISAGREE / INCONCLUSIVE without trusting the builder's environment.
- **Links:** `brain-consciousness/EXECUTION-BOARD-20.md`; `brain-consciousness/reports/AGI-01-analysis.md`; `mesh/roles/build.md`; first reproduction: `reports/AGI-06-reproduction-001.md`
- **Status:** PROPOSED. This is a proposal only, not an approval or a capability claim.

## 1. Triggers
A second run is due when: an item reaches the CI/Build gate (after Moderator, Tessera, and Security); a board row says "Build independently reruns"; a status would move from REPORTED to TESTED; Father says yes on a digest item, so Build verifies Tessera's PR head before merge; or a pinned base drifts.

## 2. Pinned snapshot
- Pin **repo + full 40-char commit SHA**. Never use a branch name alone, and never use the builder's checkout, cache, venv, or artifacts.
- Get the tree at that SHA from the host (git clone, or read-only API `git/trees/<sha>?recursive=1`). Record the **blob SHA** of every file used: the scripts, the data, and every file the scripts read. To find those files, read the scripts.
- Check each local file with `git hash-object <file>` against the tree blob SHA. Any mismatch makes the run **INCONCLUSIVE**.

## 3. Pre-run safety read
Read every script before running it. If a script makes network calls, writes outside a scratch directory, runs subprocesses, or uses `eval`/`exec`, **stop and report**. Do not run it.

## 4. Environment record
Record OS/kernel, interpreter versions (`python3 --version`, `node --version`, `pnpm --version` as relevant), git version, the working directory relative to the repo root, and whether the relevant env vars are set (`PYTHON*`, locale, `DATABASE_URL`, `TESSERA_ENABLE_*`, `TESSERA_PEN_ENABLED`). Record **only whether each one is set**. Never record values; write secrets as `[REDACTED]`. Install dependencies into a run-local venv/store and list exact versions. Never install system-wide.

## 5. Run
Run the **documented** command exactly as written (README/report), from the documented directory. Capture combined stdout+stderr verbatim with `; echo EXIT:$?`. Any additional checks (acceptance-test variants, negative fixtures) must run on **scratch copies** outside the pinned snapshot and be labeled as additional.

## 6. Compare
Compare against the builder's reported output, or against the documented expected result or acceptance criterion if no raw builder output exists. Say which one you used.
- **AGREE:** same exit code and same output, apart from declared nondeterminism.
- **DISAGREE:** different exit code, output, or failed criterion. Include a unified diff.
- **INCONCLUSIVE:** blob mismatch, missing reference output, unrunnable environment, or a safety stop.

## 7. TESTED vs REPORTED
**TESTED** only if the verifier saw real output from its own run at the pinned SHA with all blobs matching. Everything else (builder logs, screenshots, chat, analysis) stays **REPORTED**. A TESTED run of a validator shows only that the validator ran. It is not evidence of a product capability, AGI, or consciousness.

## 8. Evidence record and routing
Write `AGI-06-reproduction-NNN.md` with the intake header above, the pin, the blob table, the environment, the commands, the raw output, the verdict, and the limitations. Submit it as a **Gitbook intake** through **Gitbook/Cordnation → Moderator**, with a status delta to Command Center for the next digest (Father: `yes`/`no`/`revise`). Build **never pushes, commits, comments, or merges**.

## 9. On DISAGREE
Do not fix, rerun until green, or edit. File the record with the diff, notify the task owner, TESSERA (product truth), and Command Center, and leave the item at REPORTED. Only the task owner or Tessera can set BLOCKED; Build returns `changes needed`. A new builder commit gets a new reproduction number. Lessons go to the Recursive Learning Sponge.

## 10. Boundaries
Read-only toward every repository. No `DATABASE_URL`, no `TESSERA_ENABLE_*`/`TESSERA_PEN_ENABLED` changes (they stay at 0), no servers against real databases, no secrets printed, and no 1T/T44 vaults, Zz data, or archive zips. No self-improvement loops.
