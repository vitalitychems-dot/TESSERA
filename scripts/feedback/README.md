# Outcome feedback

`node scripts/feedback/outcome-feedback.mjs --out next-tasks.json` reads merged/closed PRs and gate verdict comments
(Moderator/Security/Build PASS|FAIL, deduped per gate+SHA, latest wins) in TESSERA and Gitbook, read-only via `gh api`,
and writes open PRs/issues ranked by learned title-topic weight (merged +1, closed −1, PASS +0.25, FAIL −0.5, prior 3) plus each candidate's own verdicts.
Tests: `node --test scripts/feedback/outcome-feedback.test.mjs`. Known limit: verdicts on superseded SHAs still count.
