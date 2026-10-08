# AGI-06 reproduction 001: Gitbook validators (AGI-01 world model, AGI-02 provenance memory)

- **Title:** AGI-06 reproduction 001: rerun of `state/validate_world_model.py` and `brain-consciousness/provenance-memory/validate_records.py`
- **Author lane:** Build
- **Date (CT):** 2026-10-06, run at 18:29:59 CDT
- **Source:** Gitbook `vitalitychems-dot/Gitbook` `main@fcabd13a56a1c5e1b93a7a7aa46bc4b29f883d7f` (validators introduced in `44f526651dc3553f56d358f3a1f5632f79dc24ad`, 2026-10-06 15:13 CDT)
- **License:** TBD
- **Summary:** Both validators were rerun read-only from a blob-verified snapshot. Both exited 0 with PASS. Result: **TESTED (Build's own run) and AGREE** with the documented criterion "must exit zero" and with the board's IMPLEMENTED status. No builder raw output exists in the repo to diff against. Additional scratch-copy checks found gaps against the AGI-01/AGI-02 analysis designs (§6).
- **Links:** `brain-consciousness/EXECUTION-BOARD-20.md` (AGI-01, AGI-02, AGI-06; immediate sequence step 3); `brain-consciousness/reports/AGI-01-analysis.md`; `brain-consciousness/reports/AGI-02-analysis.md`; protocol `AGI-06-second-run-protocol.md`
- **Status:** PROPOSED (an intake record for Cordnation → Moderator; nothing has been pushed)

## 1. Pinned snapshot and blob verification
The tree was read from the GitHub API at the full SHA above (recursive, `truncated: false`). Files were obtained read-only through the API, with no clone and no builder environment. Each file was checked with `git hash-object`.

| Path | Tree blob SHA | Local `git hash-object` | Result |
|---|---|---|---|
| brain-consciousness/provenance-memory/README.md | 458d661cf696474961a2134db18f7f8eb6a00e79 | 458d661cf696474961a2134db18f7f8eb6a00e79 | MATCH |
| brain-consciousness/provenance-memory/records.jsonl | 37dbc9b4d5fb980170027027742b528eaa3aa8db | 37dbc9b4d5fb980170027027742b528eaa3aa8db | MATCH |
| brain-consciousness/provenance-memory/validate_records.py | 7cf6efceb65fbe7895f8f9698a6867f8398531d1 | 7cf6efceb65fbe7895f8f9698a6867f8398531d1 | MATCH |
| state/README.md | ad2c5438327bf82240a9ab7b13fccf93908922ac | ad2c5438327bf82240a9ab7b13fccf93908922ac | MATCH |
| state/validate_world_model.py | a7892a89a70693b6fa43021467a32fd5887bf1cf | a7892a89a70693b6fa43021467a32fd5887bf1cf | MATCH |
| state/world-model.json | 072b1603511caebe6eb57041d63cc6ca31e1579d | 072b1603511caebe6eb57041d63cc6ca31e1579d | MATCH |
| state/world-model.schema.json | 7f7b5511f91f003c2f3dc1926d60184901c6aa71 | 7f7b5511f91f003c2f3dc1926d60184901c6aa71 | MATCH |

**7/7 MATCH.** Validator inputs were found by reading the scripts. `validate_records.py` reads only `records.jsonl`, which sits next to it. `validate_world_model.py` reads only `state/world-model.schema.json` and `state/world-model.json`, relative to the working directory. The evidence paths listed in the model are **not** opened, so no other repo files are needed. There is no provenance-memory schema file at this SHA.

## 2. Pre-run safety read
Both scripts were read in full. Imports are stdlib only (`json, sys, datetime, pathlib` and `argparse, json, re, sys, pathlib`). Neither script makes network calls, writes files, starts subprocesses, or uses `eval`/`exec`. Both are safe to run. No pip packages are needed, so **no venv was created**.

## 3. Environment (secret values not recorded)
Debian GNU/Linux 13 (trixie), Linux 6.12.94+ x86_64; `/usr/bin/python3` Python 3.13.5; git 2.47.3; UTF-8. `PYTHONPATH`/`PYTHONHOME`/`PYTHONSAFEPATH`/`PYTHONDONTWRITEBYTECODE`/`PYTHONUTF8` unset; `DATABASE_URL` unset; `TESSERA_PEN_ENABLED` unset; 0 `TESSERA_ENABLE_*` vars set. CWD is the repo-root equivalent `gitbook-fcabd13a/`, which is not a git checkout. No `__pycache__` was created.

## 4. Commands (as documented in `provenance-memory/README.md`, `state/README.md`, and AGI-01 acceptance test 1) with raw output, verbatim
```text
=== ENV 2026-10-06 18:29:59 CDT
Linux 6.12.94+ x86_64
Debian GNU/Linux 13 (trixie)
which python3: /usr/bin/python3
Python 3.13.5
git version 2.47.3
cwd: /workspace/build-verify/gitbook-fcabd13a
PYTHONPATH: unset
PYTHONHOME: unset
PYTHONSAFEPATH: unset
PYTHONDONTWRITEBYTECODE: unset
PYTHONUTF8: unset
LANG: set ([REDACTED-if-secret])
LC_ALL: set ([REDACTED-if-secret])
DATABASE_URL: unset
TESSERA_PEN_ENABLED: unset
TESSERA_ENABLE_* vars set: 0
fs-encoding utf-8 preferred UTF-8
=== RUN 1: python3 brain-consciousness/provenance-memory/validate_records.py
provenance-memory validation: PASS; current=['AGI-02-EXAMPLE-001']; review_queue=[]
EXIT:0
=== RUN 2: python3 state/validate_world_model.py
world-model validation: PASS
EXIT:0
=== RUN 3: python3 -m json.tool state/world-model.json >/dev/null
EXIT:0
=== RUN 4: python3 -m json.tool state/world-model.schema.json >/dev/null
EXIT:0
=== RUN 5 (AGI-01 acceptance test 1): python3 state/validate_world_model.py --schema state/world-model.schema.json --map state/world-model.json
world-model validation: PASS
EXIT:0
=== RUN 6 (AGI-01 acceptance test 2 flag check, no roots passed): python3 state/validate_world_model.py --schema state/world-model.schema.json --map state/world-model.json --verify-evidence
usage: validate_world_model.py [-h] [--schema SCHEMA] [--map MAP_PATH]
validate_world_model.py: error: unrecognized arguments: --verify-evidence
EXIT:2
```

## 5. Comparison
| Check | Reference | Observed | Verdict |
|---|---|---|---|
| `python3 brain-consciousness/provenance-memory/validate_records.py` | README run command; board "IMPLEMENTED"; world-model AGI-02 = REPORTED. No builder raw output exists in the repo. | `PASS; current=['AGI-02-EXAMPLE-001']; review_queue=[]`, EXIT 0 | **AGREE** (criterion). No builder raw output was available for an output diff. |
| `python3 state/validate_world_model.py` | README; AGI-01 acceptance test 1 "Must exit zero" | `world-model validation: PASS`, EXIT 0 | **AGREE** |
| `json.tool` on both JSON files | README | EXIT 0 / EXIT 0 | **AGREE** |
| AGI-01 acceptance test 1 with explicit `--schema/--map` | "Must exit zero" | PASS, EXIT 0 | **AGREE** |
| AGI-01 acceptance test 2 `--verify-evidence` | Analysis design (future implementation) | argparse `unrecognized arguments`, EXIT 2 | **DISAGREE with the analysis design.** The flag is not implemented and evidence locators are not resolved. The README does not claim the flag exists. |

## 6. Additional checks on scratch copies (pinned snapshot untouched)
These are checks against the AGI-01 and AGI-02 acceptance-test negative cases.
```text
=== wm-abs-path: (cd wm-abs-path && python3 state/validate_world_model.py)
world-model validation: FAIL: unsafe evidence path
EXIT:1
=== wm-blocked-snapshot-schema-disallows: (cd wm-blocked-snapshot-schema-disallows && python3 state/validate_world_model.py)
world-model validation: PASS
EXIT:0
=== wm-dup-id: (cd wm-dup-id && python3 state/validate_world_model.py)
world-model validation: FAIL: duplicate/missing id in tasks
EXIT:1
=== wm-invalid-status: (cd wm-invalid-status && python3 state/validate_world_model.py)
world-model validation: FAIL: invalid status in goals
EXIT:1
=== wm-missing-unknowns: (cd wm-missing-unknowns && python3 state/validate_world_model.py)
world-model validation: FAIL: top-level keys do not match contract
EXIT:1
=== pm-bad-status: python3 pm-bad-status/validate_records.py
provenance-memory validation: FAIL: line 1: invalid status
EXIT:1
=== pm-confidence-1.5: python3 pm-confidence-1.5/validate_records.py
provenance-memory validation: FAIL: line 1: confidence outside 0..1
EXIT:1
=== pm-current-plus-expired: python3 pm-current-plus-expired/validate_records.py
provenance-memory validation: PASS; current=['AGI-02-EXAMPLE-001']; review_queue=['FIX-EXPIRED']
EXIT:0
=== pm-dangling-supersedes: python3 pm-dangling-supersedes/validate_records.py
provenance-memory validation: PASS; current=['AGI-02-EXAMPLE-001']; review_queue=[]
EXIT:0
=== pm-dup-id: python3 pm-dup-id/validate_records.py
provenance-memory validation: FAIL: line 2: duplicate id
EXIT:1
=== pm-expiry-before-review: python3 pm-expiry-before-review/validate_records.py
provenance-memory validation: FAIL: line 1: invalid timestamp order
EXIT:1
=== pm-missing-owner: python3 pm-missing-owner/validate_records.py
provenance-memory validation: FAIL: line 1: missing ['owner']
EXIT:1
=== pm-mutable-source-ref: python3 pm-mutable-source-ref/validate_records.py
provenance-memory validation: PASS; current=['AGI-02-EXAMPLE-001']; review_queue=[]
EXIT:0
=== pm-non-utc: python3 pm-non-utc/validate_records.py
provenance-memory validation: FAIL: timestamps must end in Z
EXIT:1
```
- World model: missing `unknowns`, invalid status, duplicate ID, and absolute path all exit 1 → **AGREE** with AGI-01 test 1. Finding: `source_snapshot.status = "BLOCKED"` PASSES even though the schema enum excludes BLOCKED there. The validator checks only the schema `title` and does not enforce the schema itself.
- Provenance memory: duplicate ID, missing field, confidence out of range, bad status, non-UTC timestamp, and expiry before review all exit 1 → **AGREE** with AGI-02 test 1. A current record plus an expired record splits correctly (`review_queue=['FIX-EXPIRED']`) → **AGREE** with test 2. Findings → **DISAGREE** with the AGI-02 design: a non-immutable `source_ref` (`"system"`) passes, a dangling `supersedes` passes (test 3), and `review_queue` is based on status only (a past `review_expires_at` does not mark a record review-due). The non-UTC error has no line number.

## 7. Status call
The pinned-snapshot runs of both validators are **TESTED by Build** (the PASS output was seen directly). This makes no claim of product capability, AGI, or consciousness. The AGI-01/AGI-02 items stay **REPORTED** pending Moderator review of the gaps in §5–6 (Build returns `changes needed`, not BLOCKED). Limitations: no git clone (blobs came through the API and were hash-verified); single OS/interpreter; no TESSERA checkout; evidence locators not resolved.

## 8. Routing
Intake to Gitbook/Cordnation → Moderator. Status delta to Command Center for the next digest. Nothing was pushed, committed, or commented.
