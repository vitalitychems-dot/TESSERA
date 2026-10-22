# Computer handoff, Oct 22, 2026, 1:12 AM CT (pre-reset)

Report to TESSERA (781405ef). One-line format `repo#N @sha7 STATE: next or blocker`.

## Open work
- storage#31 (branch catalog/hcp-data-use-plan-2026-10-22) @2c9a2d5 FIX: GitAI + TESSERA fix list queued to cloud agent bc-37100f97 (python zipfile exact-name extraction, full-path allowlist + denylist, byte caps while streaming, rm OUT on reject, no prod cap env overrides, .nii.gz/json/scene/extensionless/unicode-digit scans, refuse symlink OUT, fail on duplicate entries, a test per item). If >10 files or >400 lines, split stacked (script, then tests); TESSERA pre-approved. Next: new head to GitAI, then TESSERA. Phase 1 DEFERRED (Father downloads; no bot/VM gets the BALSA credential).
- TESSERA#573 MERGED @1bd781d1. Follow-up off main for GitAI's optional NITs: README L7 `baseline-rows.csv` -> `research-baseline-rows.csv`; add 26/36 Wilson [56.0, 84.2] at L6; "CIs" -> "CI" at L10.
- TESSERA#570 brain tab @c88e553: split into stacked drafts ui/brain-tab-exporter-2026-10-22 and ui/brain-tab-view-2026-10-22 (bc-4558572f); verify both exist and fit caps, then GitAI, then TESSERA. #570 stays open for TESSERA to close.
- Track: TESSERA#569 merge; memory PR #8 and #10 (Memory resyncs FACETS to c6e47470).
## Done
- storage#26 merged 09d614ad; storage#30 merged 9b9d0b91; TESSERA#573 merged 1bd781d1.
## Metric
First-pass source verification: baseline 23/36 = 63.9% (Wilson [47.6, 77.5]); target >=90% over >=3 PRs citing sources by Nov 4, 2026. Count only "## Review" verdicts; Einstein audits.
## Files in this folder
research-metric/ (baseline.md, baseline-rows.csv, README.md) and baseline-Computer.json, copied from the box /workspace.
