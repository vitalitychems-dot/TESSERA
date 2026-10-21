// 218 sentences from real mesh/agent transcripts (cloud-agent-transcripts), PII stripped
// (emails, URLs, tokens, handles, SHAs replaced). Hand-labelled. Not used to tune the lexicon.
export const MESHLOG = [
{
"text": "HYB-007 may start after this page lands.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Aligning the calls would change arguments passed, so the directive stays.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll confirm the base commit and scan every registration so the allow-list matches what is actually mounted.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll pin the branch to `<sha>` and check each item's evidence in the docs before editing.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Name the branch tessera/hyb-012-route-inventory.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "GitHub Actions was degraded when those jobs were cancelled.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "Kicking off parallel agents for the bridge design.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Dated audit and validation sentences stay, with a current line added.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "package.json` already matches main, so the SDK removal is already there.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "If Actions is still degraded after ~2 hours, stop and report.",
"src": "operator",
"intent": "instruct",
"affect": "urgent"
},
{
"text": "The cherry-pick applied cleanly.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "pnpm run build` — exit 0, including workspace typecheck and every package build.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "git fetch --all` updated `origin/main` to `<sha>`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The full suite exits 0.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "I’ll look at how the studio and the current server are built, then wire all three to that same core.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "No other changes, formatting, or link fixes.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The patch hash matches, and the pull request is open.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Own-lab’s body, spike, memory, and atom-match steps don’t match either, so Z10 stays retained in Zz.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Mark it MERGED if `git merge-base --is-ancestor <tip> origin/main`, otherwise UNMERGED, with ahead/behind counts vs origin/main.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The star count matches between ports 4173 and 4183.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Both patches applied and committed.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Credits are in-app points with no cash-out and no conversion to SOL, Ergo, or any token.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Existing vault routes stay untouched.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll fetch `origin/main` and record the actual base commit before applying the patches.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Theorem-lab writes math proofs and Compression Lab compresses NASA images.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Nine of the 73 matching branches are unmerged.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Do not touch other files.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "If it fails, STOP, push nothing, and report it.",
"src": "operator",
"intent": "instruct",
"affect": "urgent"
},
{
"text": "Report the PR URL, head SHA, base SHA and diffstat.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "It is not merged, and TESSERA was not changed.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll re-fetch main, then add persistent homes, a tick loop, and the 2/3 vote path on top of the existing studio.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll verify the base commit, the frozen diff checksum, and then open one draft PR from that patch without merging.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Add `Co-authored-by: Tessera <email>",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "TESSERA was not edited, `1T` was not opened, and no repositories were deleted.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll merge it, then check that PR #7 still applies cleanly on top of PR #6.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The list is 31 Gitbook items plus a handoff page.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "It detects duplicates without collapsing them.",
"src": "operator",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The next status check is in about 10 minutes, and the stop time remains 22:04 UTC.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The CI watch on PR #1 is already in place.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Do NOT merge, and do not mark ready.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Build still has to verify this head.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The body's first line must be exactly 'IDENTITY: Tessera Admin coordinator'.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The same merge is clean after a squash of #6.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "I'll commit those two files and open the draft PR.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "No wholesale copy of z-app into TESSERA or Gitbook.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "I’ll review only their diffs against `origin/main` and flag sensitive paths without opening vault files.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Wiring the studio endpoints and shipped panel next.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Push the branch and open ONE PR to main titled 'Approved: GB-026 rev 3, GB-027'.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Push the branch and open ONE PR to main titled 'Approved: GB-028 rev 3'.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "V2-062’s merge SHA exists only after that pull request merged, so it is in this report and not yet a log row.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "PR #1 stays open and unmerged, and PR B will not be opened.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The job was not acquired by Runner of type hosted even after multiple attempts",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "The owner's current rule is that a TESSERA merge needs his explicit yes, given as the word 'merge', in his bulk update.",
"src": "operator",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The repo owner approved two patch files, attached under uploads/.",
"src": "operator",
"intent": "approve",
"affect": "neutral"
},
{
"text": "Main already has the v2 studio and the other agent’s world.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Make sure PR #7 doesn't conflict with PR #6 when merged after it.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Main moved ahead of the snapshot and already has some offline-mesh files.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Both files are byte-identical on `origin/main`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "It is not mounted on a request path, so importing the module does not write anything.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Check the latest Gitbook main commits and open PRs so work doesn't overlap.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "A relative-link scan of the tree checked 206 Markdown links, including `SUMMARY.md`, and found none broken.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Add HYB-006 Grok-ready comparison results into vitalitychems-dot/Gitbook.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Update the disposition counts everywhere they appear to: ACCEPTED 4, RETAINED 4, REJECTED 20, NEEDS-EVIDENCE 0.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Make one commit with the message 'GB-018: HYB-005 braces decision'.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "I’ll confirm each `validate` step before merging, then start the security cleanup.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The body's first line must be exactly 'IDENTITY: Tessera Admin coordinator', followed by the item and its sha256.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "This is retrieval memory plus a proposal loop.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I’ll count live route registrations and start installing dependencies while I draft the three branches.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Local `pnpm run typecheck`, `pnpm test`, and `pnpm run build` passed on each head.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "The API test suite needs the CI Postgres service, so that result will come from the workflow.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I’ll put docs and config on one branch, then tests and hygiene on the others.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I’ll confirm each `validate` step actually ran and passed before merging PR #1.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The world can already pass a change by vote.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I’ll check whether `origin/main` already has those files, then review the two larger unmerged diffs for sensitive paths only.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "HYB-006 is on `main` and this task can start.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "HYB-012 in vitalitychems-dot/TESSERA: add tests only, and make NO runtime behavior change.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "HYB-012 is on an open pull request and has not been merged.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Tessera API integration tests were skipped on both because `TESSERA_TEST_DATABASE_URL` is unset.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "Comment <sha> says those cards are not posted yet, so no competitor scores were written.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Building the bridge now while the test agent works in parallel.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "pnpm --filter <handle>/gitai test` — 13 passed.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Merge PR B only if every CI step is green.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Run the repo's local typecheck and tests, and paste the results.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "desk-preview-search-9fab` overlaps `public-question.ts` and is 469 behind.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "HYB-006 is not on local `main`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Push the branch and open ONE pull request to main titled 'Approved digest: GB-015, GB-019, GB-021, GB-020'.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Everything stands merged on `main` with the full suite green.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Leave PR #1 open and unmerged.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The nine-room list is already on main aside from a GitbookAI vs GitMesh label.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The mobile layout stacks.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Report the new head SHAs and check results.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Tessera API integration tests skipped, because `TESSERA_TEST_DATABASE_URL` is not set",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "The floor constant stays independent of any `TESSERA_ENABLE_*` switch.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The API tests and `db push` still have no CI result.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "Next I’ll confirm the repo is on the pinned commit and check each item’s evidence before editing.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "tsc -p artifacts/api-server/tsconfig.json --noEmit` — pass",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Splitting the world-to-PR bridge across parallel agents to move faster.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Actions is still in a **major outage**.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "I’m reading the behavior modules so each disposition is based on the code, not the filenames.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Next I'll copy the screenshots with retries, rebase onto the new `main`, run the full tests, and commit.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Those numbers were never items.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Checkout and setup have passed, and the frozen install is running.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "If the deadline has passed and Actions is still degraded, stop and report.",
"src": "operator",
"intent": "instruct",
"affect": "urgent"
},
{
"text": "Actions is still degraded, so PR #1 stays unmerged and PR B stays unopened.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "Then let CI run the remaining steps.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "I’ll wait for validate run <sha> and report each step.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The one skipped test is the existing skip, and the suite exited 0.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "No wallets, payments, blockchain, or Monero.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Never touch the 1T vault.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "GitAI is on `main` as <email>",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The PR is open and still a draft.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Run typecheck, tests and build locally and make sure they pass.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The same command passes with the directive.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "I'll commit the floor, push the branch, and open the pull request.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The Z-app shell is a ten-view TanStack app, separate from TESSERA’s page set.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Only reuse code under a compatible license, with attribution.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "I'll add the Tessera mesh rules only to the root docs and open a draft PR against `main`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The small diffs are isolated preview modules.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Do not edit any file by hand.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Writing the vote-to-worktree tests now.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "API auth:** mutating calls send `X-GitAI-Handle` or the `gitai` cookie.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I’ll check the status page now and keep polling until runners are assignable again, or until about two hours have passed.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The tip differs by a hyphen and the word \"to\".",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Tessera gates and merges.",
"src": "operator",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Pull request #9 is open and was not merged.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Audit, typecheck, database push, test, and build have not started.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "The tmux sessions are gone, so the standalone server isn't running.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "Push the branch and open ONE PR to main titled 'Approved digest: GB-017, GB-016 rev 3.2'.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Keep both as drafts and don't merge.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The retriggered check reported success.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "I'll start from the builder brief and the repo state, then follow the ordered PR list one item at a time.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "All 48 tests passed.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "The package README lists every path and env var.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Use more agents a split tasks to increase speed",
"src": "operator",
"intent": "instruct",
"affect": "urgent"
},
{
"text": "I'll run the root `pnpm test` as well, since it includes the merge-gate scans.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Do not read, modify, or commit the 1T vault, natal-vault.json, or any personal data files.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The world is saved to `artifacts/v2/data/civic-world.json`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "No 1T or vault files were opened.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Spinning up three parallel builders for the core, UI, and tests.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Add an `agents.json` registry listing each mesh lane and its specialty, so tasks route to the right bot:",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Z10 is now **RETAINED → HYB-013**.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The memory module does not delete records and does not point proposals at the `1T` vault.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll verify both patch digests first, then branch from current `origin/main` and apply them only if the hashes match.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "If no env lane is set, default to read-only, with no PR creation.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Don't repeat the same confirmation every time.",
"src": "operator",
"intent": "instruct",
"affect": "negative"
},
{
"text": "The three patched files match the patch and are on the remote branch.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Head `<sha>` on `cursor/gitbook-list1-approved-f67c`, based on `main` `<sha>`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "evolve.ts` and `guard.ts` match main.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I’ll look for that page on the remote and pull the current TESSERA and Zz heads.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "A star sent through the studio's API landed in the standalone app.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "The index leaves it out.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The repo is a pnpm workspace on `<sha>`, and Gitbook lives in a separate private repo.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The next status check is in about 10 minutes.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "No branch `tessera/gb-029-rev3`, no commit, no head SHA.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "No edits to `.github/workflows/*`.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The local design file is not in Gitbook or on TESSERA main.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Same hard limits and commit identity as before.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The repo's own checks pass locally: install, typecheck, tests, build, plus the audit if it's in CI.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "I will merge PR #1 only if install, audit, typecheck, database push, test, and build are all green, then open PR B.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Give C2–C4 Targets full paths:",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Run `git apply` on it with no --reject, as ONE commit: 'GB-028 rev 3: Replit agents start-here page and HYB-012 unblock'.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Verify sha256 for each, and STOP if any differs:",
"src": "operator",
"intent": "instruct",
"affect": "urgent"
},
{
"text": "Final report: every PR with its merge SHA and test results, plus anything skipped and why.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "pnpm --filter <handle>/gitbook-mcp test` — 28 passed",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Report back: PR URL, branch name, head SHA, Zz and TESSERA SHAs used, brief disposition counts",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Main already has Gitbook and Gitbook AI places in a newer shell.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Each patch applied cleanly with `git apply` and was committed on its own.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "A harmful reply still blocks the account and returns its GitAI credits to the in-app supply.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "API tests ran against a local loopback database named `tessera_test`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "If you wire it into a request path, keep the change minimal and side-effect free on import.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "No unmerged diff adds `1T/vault/natal-vault.json`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Draft pull request is open and not merged.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Do NOT merge, and do not mark the PRs ready for review.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "I'll separate those edits so both bullets and both test entries survive an automatic merge.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Use branch name `cc/replit-agent-guidance`.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Don't widen the safe-fetch allowlist.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Designed, not run against live GitHub:** a real token and a real draft pull request.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "No token is committed.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "A local merge of #7 onto #6 is clean.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Set `GITBOOK_GITHUB_TOKEN` in the environment.",
"src": "agent",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The route files live under `artifacts/api-server`, not `packages`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Do not touch any file not in the patches.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "I'll check main and the acceptance notes, then open that PR.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Next I’ll classify every m–z `origin/cursor/*` tip against `origin/main` and only diff the unmerged ones.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "GITAI_PORT` changes the port.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "They are only proposals for the Gitbook queue, never auto-applied.",
"src": "operator",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Add a memory module to the API server, for example `artifacts/api-server/src/lib/memory/`.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "First I'm checking the patch, the repo base, and any prior GB-062 notes.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Three draft pull requests are open against `main` at `<sha>`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Both files keep their existing text.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The studio tab shows GitAI and keeps the 2D toggle.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "PR #1 is still open and unmerged.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The source inventory is 925 registrations, so that figure holds.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "The nine unmerged tips are not safe to open as PRs from these SHAs.",
"src": "agent",
"intent": "inform",
"affect": "negative"
},
{
"text": "The patch applied cleanly, and its sha256 is `<sha>`.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Do not merge, do not push to the base branch directly, and do not mark the PR ready for review.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "node --test scripts/suite-policy.test.mjs` — 6 passed",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "They are still drafts and were not merged.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Gitbook MCP 28 passed.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "The section is appended and only those two files changed.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The body's first line must be exactly 'IDENTITY: Tessera Admin coordinator', followed by both items and their sha256 values.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Do NOT merge, and do not mark ready for review.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The make-it-real bridge is built and merged, using parallel agents for the core design, studio UI, and tests.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Report the base SHA, head SHA, both commit SHAs, the PR URL, and the diff --stat.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "If `AGENTS.md` doesn't exist, create it with just this section.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Port ideas, not the whole app.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "The new head on `cursor/hyb-007-z-app-5404` is `<sha>`.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "The 3D floor is already on main.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Add a short `README.md` that explains how each agent connects: MCP stdio config, the HTTP endpoints, and the env vars.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
},
{
"text": "Root `pnpm test`:** exits 0.",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "pnpm --filter <handle>/gitbook-mcp run build` — pass",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "I'll fix both, then run the tests.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll put the same check at the front of the studio and monitor servers, then prove the three paths return 403.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "I'll read the studio, graph, and sandbox so the world sits on those pieces.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Tessera learning memory: 5 passed",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "Checks on each head, all exit 0:",
"src": "agent",
"intent": "inform",
"affect": "positive"
},
{
"text": "If Actions is still degraded at 22:04 UTC, I will stop and report.",
"src": "agent",
"intent": "inform",
"affect": "neutral"
},
{
"text": "Do not claim consciousness or self-training.",
"src": "operator",
"intent": "instruct",
"affect": "neutral"
}
];
