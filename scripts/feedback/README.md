# Outcome feedback

`node scripts/feedback/outcome-feedback.mjs --out next-tasks.json` reads merged/closed PRs and gate verdict comments
(Moderator/Security/Build PASS|FAIL, deduped per gate+SHA, latest wins) in TESSERA and Gitbook, read-only via `gh api`,
and writes open PRs/issues ranked by learned title-topic weight (merged +1, closed −1, PASS +0.25, FAIL −0.5, prior 3) plus each candidate's own verdicts.
Tests: `node --test scripts/feedback/outcome-feedback.test.mjs`. 
Verdicts count only from trusted authors (default `vitalitychems-dot`, `collink1007`; override with `--trusted a,b`)
and only when they name a SHA matching the PR's current head; verdicts on stale/superseded SHAs or with no SHA are ignored.

**Advisory only:** the ranking chooses what to work on next. It never feeds a gate, a merge decision, or the
silence timer; gates judge each PR on its own verdicts at the exact head SHA. `next-tasks.json` carries `advisory_only` to say so.
