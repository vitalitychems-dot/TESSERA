# Pull request gate results

Measured on 2026-10-13 against the last 20 commits on `origin/main`. Each of those commits is a squash merge of one pull request. The same functions the workflows call produced the flag counts.

## Last 20 merged pull requests

Newest first: #322, #321, #320, #319, #315, #299, #300, #290, #293, #291, #289, #288, #286, #287, #284, #285, #283, #282, #274, #280.

Every pull request author login is `vitalitychems-dot`, the repository owner.

## What each check counts

| Check | Where it runs | A pull request is flagged when |
| --- | --- | --- |
| Gitleaks | `secret-scan.yml`, enforcing | The scanner reports a finding in commits reachable from `main`, or in commits that are only on the pull request head |
| Provenance | `main-provenance.yml`, report-only (`PROVENANCE_ENFORCE=0`) | The squash commit on `main` has no merged pull request, author or committer name Tessera, an `@gmail.com` address, or a Manus mark |
| Diff scan | `pr-gates.yml`, report-only (`DIFF_SCAN_ENFORCE=0`) | The diff changes a `rules` path segment, a gate path, `CODEOWNERS`, or permission lines in `.github/workflows`, and the pull request author is not the repository owner |
| Author check | `pr-gates.yml`, enforcing | Any pull request commit's author or committer name is Tessera, or either email is not `332565808+vitalitychems-dot@users.noreply.github.com` |

Gate paths match a segment such as `merge-gate.mjs`, `rick-gates.ts`, or `TesseractKeyGate.tsx`. `aggregate.ts` and `delegate.ts` do not match. A workflow edit that does not change permission lines does not match. #300 edits `.github/workflows/ci.yml` and is not a protected touch.

## Flag counts

| Check | Before these jobs existed | After, on the same 20 pull requests |
| --- | --- | --- |
| Gitleaks | 0 / 20 | 0 / 20 |
| Provenance | 20 / 20 flagged, job would still exit 0 | 20 / 20 flagged, job would still exit 0 |
| Diff scan | not present | 0 / 20 flagged (0 protected touches) |
| Author check | not present | 14 / 20 would fail the job |

Before, an enforcing check would have failed 0 of the 20. After, the author check would fail 14. Provenance would still flag all 20 and still exit 0.

Gitleaks v8.30.1 reported 0 findings on the 358 commits reachable from `origin/main` (32.293s, about 117.47 MB) and 0 findings on each pull request's own commits (`origin/main..refs/pull/<n>/head`).

Provenance's only code on these squash commits is `tessera-name`. The author is `Tessera <332565808+vitalitychems-dot@users.noreply.github.com>` and the committer is `GitHub <noreply@github.com>`. Each commit has a merged pull request. None of the messages carry a Manus mark.

Author check passes on #322, #321, #320, #319, #299, and #300. It fails the other 14:

- Name Tessera, correct email: #274 (2 commits), #315 (2 of 5 commits).
- Email `cursoragent@cursor.com`: #280, #282, #283, #284, #285, #287.
- Email `vitalitychems-dot@users.noreply.github.com` (missing the numeric id): #286, #288, #289, #290, #291, #293.

## How long the workflow takes

### Before

Secret scan on pull request #305, [job 115289335644](https://github.com/vitalitychems-dot/TESSERA/actions/runs/38395438310/job/115289335644), head `f2144fa528c7fbb712ae8b12dd1866df4d927a2e`.

| Step | Time |
| --- | --- |
| Checkout (`fetch-depth: 0`) | 60s (12:11:12Z to 12:12:12Z) |
| Install pinned gitleaks | 1s |
| Seeded fixture self-test | under 1s |
| Scan repository | 13s (12:12:13Z to 12:12:26Z) |
| Job wall clock | 77s (12:11:11Z to 12:12:28Z) |

Provenance does not run on `pull_request`. A local run of the same script over 30 commits, with the automatic GitHub token, took 0.851s and exited 0.

### After, local scripts

On this branch, against base `47983ddabd96c7804845705bc3d2b9eac0da2c4d`:

| Script | Time | Result |
| --- | --- | --- |
| `pr-diff-scan.mjs` (`DIFF_SCAN_ENFORCE=0`) | 0.057s | owner-authored, 2 workflow permission touches, not flagged |
| `pr-author-check.mjs` | 0.026s | exit 1, the existing commit's email is `cursoragent@cursor.com` |

The comment script was not sent to GitHub during this measurement.

### After, GitHub Actions

Recorded when the `Pull request gates` workflow finishes on the commit that adds these jobs.
