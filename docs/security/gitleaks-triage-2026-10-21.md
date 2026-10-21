# Gitleaks triage, 2026-10-21 (report-only)

Source: the `gitleaks` job of the Secret scan workflow, run 39682899501 (2026-10-21 17:01 CT, PR #524), which reported **250 findings**. The scan wrapper (`scripts/gitleaks-scan.mjs`) prints only `file:line rule-id`. Values were inspected locally by shape only (length, charset, decoded JWT header, placeholder patterns). **No secret value appears in this file.** Values are masked to at most 4 characters + `****`.

No history was edited, no allowlist was applied, and nothing was rotated by this PR.

## Key finding: none of the 250 findings are on `main`

`actions/checkout` with `fetch-depth: 0` fetches every branch, and `gitleaks detect` walks `git log --all`, so the job scans **every branch in the repo**, not just the PR or `main`. All 250 findings are on side branches:

- 248 are on the seven archive branches `opened/01-XL1` … `opened/07-tesseract-consolidated` (the same 35–36 findings repeated once per archived project copy).
- 2 are in `scripts/tessera-credential-guard.test.mjs` on `security/session-cookie-hardening-20261020` and `manus/session-cookie-hardening-20261017`. These two are also the only findings in the last `main` push run (39557493998, 2 findings).

So every PR fails Secret scan because of branches it never touches. See suggestion 1 below.

## Summary

| Class | Count |
| --- | ---: |
| REAL | 0 |
| TEST | 10 |
| FALSE-POSITIVE | 240 |
| **Total** | **250** |

| Rule | Class | Count |
| --- | --- | ---: |
| `generic-api-key` | FALSE-POSITIVE | 240 |
| `jwt` | TEST | 7 |
| `generic-api-key` | TEST | 3 |

### By pattern

| Class | Rule | Pattern | Count |
| --- | --- | --- | ---: |
| FALSE-POSITIVE | `generic-api-key` | secretLanguageId app label (cipher-*) | 210 |
| FALSE-POSITIVE | `generic-api-key` | public Solana token mint address FMB4**** (TSRT) | 21 |
| FALSE-POSITIVE | `generic-api-key` | .env.example template: public Solana RPC URL + public token mint address | 7 |
| TEST | `jwt` | "Token Forgery" attack payload: alg=none, empty signature | 7 |
| FALSE-POSITIVE | `generic-api-key` | prose listing free public data sources (Jupi****) | 2 |
| TEST | `generic-api-key` | credential-guard unit-test fixture (fake sk-/ghp-style strings) | 2 |
| TEST | `generic-api-key` | benchmark sample string "sk-a****" | 1 |

## REAL findings

**None (0).** No finding looks like a live credential:

- `secretLanguageId` values are short lowercase `ciph****` labels (16–19 chars) in an app data file, not keys.
- `FMB4****` is a 44-char base58 Solana token mint address (TSRT). It is public on-chain data, and `LIMN_TOKEN_CA` in the `.env.example` template is the same address.
- The 7 JWTs decode to header `alg: none` with one `role` claim and an **empty signature**. They are forged-token attack payloads in a security tester.
- The `sk-****`/`ghp`-style strings sit in the credential-guard unit test and a benchmark sample, and they match placeholder patterns (`abc`/`123`/`test`/`xxxx`).

Recommended action: no rotation needed. Moving these to a secret store doesn't apply. If a later scan does turn up a REAL credential, rotate it first, then move it to a secret store; don't edit history.

## Findings by file (masked)

| Class | Rule | Branch | File | Lines |
| --- | --- | --- | --- | --- |
| FALSE-POSITIVE | `generic-api-key` | `opened/01-XL1` | `opened/01_XL1/XL1/server/realification-conference.ts` | 449 |
| FALSE-POSITIVE | `generic-api-key` | `opened/02-Tesseracxt9` | `opened/02_Tesseracxt9/Tesseracxt9/tess/server/realification-conference.ts` | 449 |
| FALSE-POSITIVE | `generic-api-key` | `opened/03-Tx17_9` | `opened/03_Tx17_9/Tx17/x/tess/server/realification-conference.ts` | 449 |
| FALSE-POSITIVE | `generic-api-key` | `opened/04-Tesseract-AI_5` | `opened/04_Tesseract-AI_5/Tesseract-AI/x/tess/server/conferences-archive.ts` | 3577 |
| FALSE-POSITIVE | `generic-api-key` | `opened/05-Tx13` | `opened/05_Tx13/Tx13/x/tess/server/realification-conference.ts` | 449 |
| FALSE-POSITIVE | `generic-api-key` | `opened/06-8-2` | `opened/06_8_2/x/tess/server/conferences-archive.ts` | 3577 |
| FALSE-POSITIVE | `generic-api-key` | `opened/07-tesseract-consolidated` | `opened/07_tesseract_consolidated/tess/server/realification-conference.ts` | 449 |
| FALSE-POSITIVE | `generic-api-key` | `opened/04-Tesseract-AI_5` | `opened/04_Tesseract-AI_5/Tesseract-AI/x/tess/server/self-knowledge-engine.ts` | 536 |
| FALSE-POSITIVE | `generic-api-key` | `opened/06-8-2` | `opened/06_8_2/x/tess/server/self-knowledge-engine.ts` | 507 |
| FALSE-POSITIVE | `generic-api-key` | `opened/01-XL1` | `opened/01_XL1/XL1/server/agi-implementations.ts` | 102 |
| FALSE-POSITIVE | `generic-api-key` | `opened/01-XL1` | `opened/01_XL1/XL1/server/realification-conference.ts` | 350 |
| FALSE-POSITIVE | `generic-api-key` | `opened/01-XL1` | `opened/01_XL1/XL1/server/summit-37-parallel-universes.ts` | 501 |
| FALSE-POSITIVE | `generic-api-key` | `opened/02-Tesseracxt9` | `opened/02_Tesseracxt9/Tesseracxt9/tess/server/agi-implementations.ts` | 102 |
| FALSE-POSITIVE | `generic-api-key` | `opened/02-Tesseracxt9` | `opened/02_Tesseracxt9/Tesseracxt9/tess/server/realification-conference.ts` | 350 |
| FALSE-POSITIVE | `generic-api-key` | `opened/02-Tesseracxt9` | `opened/02_Tesseracxt9/Tesseracxt9/tess/server/summit-37-parallel-universes.ts` | 501 |
| FALSE-POSITIVE | `generic-api-key` | `opened/03-Tx17_9` | `opened/03_Tx17_9/Tx17/x/tess/server/agi-implementations.ts` | 102 |
| FALSE-POSITIVE | `generic-api-key` | `opened/03-Tx17_9` | `opened/03_Tx17_9/Tx17/x/tess/server/realification-conference.ts` | 350 |
| FALSE-POSITIVE | `generic-api-key` | `opened/03-Tx17_9` | `opened/03_Tx17_9/Tx17/x/tess/server/summit-37-parallel-universes.ts` | 501 |
| FALSE-POSITIVE | `generic-api-key` | `opened/04-Tesseract-AI_5` | `opened/04_Tesseract-AI_5/Tesseract-AI/x/tess/server/agi-implementations.ts` | 102 |
| FALSE-POSITIVE | `generic-api-key` | `opened/04-Tesseract-AI_5` | `opened/04_Tesseract-AI_5/Tesseract-AI/x/tess/server/conferences-archive.ts` | 3478 |
| FALSE-POSITIVE | `generic-api-key` | `opened/04-Tesseract-AI_5` | `opened/04_Tesseract-AI_5/Tesseract-AI/x/tess/server/summits-register-archive.ts` | 509 |
| FALSE-POSITIVE | `generic-api-key` | `opened/05-Tx13` | `opened/05_Tx13/Tx13/x/tess/server/agi-implementations.ts` | 102 |
| FALSE-POSITIVE | `generic-api-key` | `opened/05-Tx13` | `opened/05_Tx13/Tx13/x/tess/server/realification-conference.ts` | 350 |
| FALSE-POSITIVE | `generic-api-key` | `opened/05-Tx13` | `opened/05_Tx13/Tx13/x/tess/server/summit-37-parallel-universes.ts` | 501 |
| FALSE-POSITIVE | `generic-api-key` | `opened/06-8-2` | `opened/06_8_2/x/tess/server/agi-implementations.ts` | 102 |
| FALSE-POSITIVE | `generic-api-key` | `opened/06-8-2` | `opened/06_8_2/x/tess/server/conferences-archive.ts` | 3478 |
| FALSE-POSITIVE | `generic-api-key` | `opened/06-8-2` | `opened/06_8_2/x/tess/server/summits-register-archive.ts` | 509 |
| FALSE-POSITIVE | `generic-api-key` | `opened/07-tesseract-consolidated` | `opened/07_tesseract_consolidated/tess/server/agi-implementations.ts` | 102 |
| FALSE-POSITIVE | `generic-api-key` | `opened/07-tesseract-consolidated` | `opened/07_tesseract_consolidated/tess/server/realification-conference.ts` | 350 |
| FALSE-POSITIVE | `generic-api-key` | `opened/07-tesseract-consolidated` | `opened/07_tesseract_consolidated/tess/server/summit-37-parallel-universes.ts` | 501 |
| FALSE-POSITIVE | `generic-api-key` | `opened/01-XL1` | `opened/01_XL1/XL1/data/secret-society.json` | 30 lines (87–1288) |
| FALSE-POSITIVE | `generic-api-key` | `opened/02-Tesseracxt9` | `opened/02_Tesseracxt9/Tesseracxt9/tess/data/secret-society.json` | 30 lines (87–1288) |
| FALSE-POSITIVE | `generic-api-key` | `opened/03-Tx17_9` | `opened/03_Tx17_9/Tx17/x/tess/data/secret-society.json` | 30 lines (87–1288) |
| FALSE-POSITIVE | `generic-api-key` | `opened/04-Tesseract-AI_5` | `opened/04_Tesseract-AI_5/Tesseract-AI/x/tess/data/secret-society.json` | 30 lines (87–1288) |
| FALSE-POSITIVE | `generic-api-key` | `opened/05-Tx13` | `opened/05_Tx13/Tx13/x/tess/data/secret-society.json` | 30 lines (87–1288) |
| FALSE-POSITIVE | `generic-api-key` | `opened/06-8-2` | `opened/06_8_2/x/tess/data/secret-society.json` | 30 lines (87–1288) |
| FALSE-POSITIVE | `generic-api-key` | `opened/07-tesseract-consolidated` | `opened/07_tesseract_consolidated/tess/data/secret-society.json` | 30 lines (87–1288) |
| TEST | `generic-api-key` | `opened/06-8-2` | `opened/06_8_2/x/tess/server/honest-benchmark.ts` | 530 |
| TEST | `generic-api-key` | `security/session-cookie-hardening-20261020, manus/session-cookie-hardening-20261017` | `scripts/tessera-credential-guard.test.mjs` | 15, 15 |
| TEST | `jwt` | `opened/01-XL1` | `opened/01_XL1/XL1/server/sovereign-security-tester.ts` | 69 |
| TEST | `jwt` | `opened/02-Tesseracxt9` | `opened/02_Tesseracxt9/Tesseracxt9/tess/server/sovereign-security-tester.ts` | 69 |
| TEST | `jwt` | `opened/03-Tx17_9` | `opened/03_Tx17_9/Tx17/x/tess/server/sovereign-security-tester.ts` | 69 |
| TEST | `jwt` | `opened/04-Tesseract-AI_5` | `opened/04_Tesseract-AI_5/Tesseract-AI/x/tess/server/sovereign-network.ts` | 405 |
| TEST | `jwt` | `opened/05-Tx13` | `opened/05_Tx13/Tx13/x/tess/server/sovereign-security-tester.ts` | 69 |
| TEST | `jwt` | `opened/06-8-2` | `opened/06_8_2/x/tess/server/sovereign-network.ts` | 405 |
| TEST | `jwt` | `opened/07-tesseract-consolidated` | `opened/07_tesseract_consolidated/tess/server/sovereign-security-tester.ts` | 69 |

## Suggested `.gitleaks.toml` changes (suggestions only, NOT applied)

1. **Scope the CI scan (fixes 248 of 250 on every PR).** Scan only the commits the event brings in, e.g. `--log-opts="${BASE_SHA}..${HEAD_SHA}"` on pull requests and `--log-opts="${BEFORE}..${AFTER}"` on pushes, plus a periodic full scan. Or check out with `fetch-depth: 0` without fetching every other branch. This changes `scripts/gitleaks-scan.mjs` and the workflow, not the allowlist.
2. **Line-scoped allowlists for the archive branches.** These match on the surrounding line, not the value, and keep the repo's existing "no path blanket" policy:

```toml
[[allowlists]]
description = "Archive app data: secretLanguageId is a cipher-* label, not a credential (opened/* secret-society.json)"
targetRules = ["generic-api-key"]
regexTarget = "line"
regexes = ['''"secretLanguageId":\s*"''']

[[allowlists]]
description = "Public Solana TSRT mint address in archived prose, code and .env.example templates"
targetRules = ["generic-api-key"]
regexTarget = "line"
regexes = ['''TSRT [Tt]oken''', '''tokenAddress:\s*"''', '''LIMN_TOKEN_CA=''']

[[allowlists]]
description = "Unsigned alg=none JWT used as a 'Token Forgery' attack payload in the security tester"
targetRules = ["jwt"]
regexTarget = "line"
regexes = ['''name: "Token Forgery", payload: "''']

[[allowlists]]
description = "Prose naming free public data sources (no keys)"
targetRules = ["generic-api-key"]
regexTarget = "line"
regexes = ['''no API keys needed:''']

[[allowlists]]
description = "Benchmark sample string in honest-benchmark.ts"
targetRules = ["generic-api-key"]
regexTarget = "line"
regexes = ['''const secret = "password = ''']
```

3. **Credential-guard test.** Add the exact fake fixture strings in `scripts/tessera-credential-guard.test.mjs` as exact-secret `regexTarget = "secret"` entries, the way the existing `synthetic-colonial-secret-*` entries work. Even better, rewrite the fixtures with a `synthetic-` or `xxxx` marker so they stop matching. The values aren't reproduced here.
4. If the `opened/*` branches are archive-only, consider leaving them out of the scan rather than allowlisting their content. Deleting branches needs Father's approval and is not proposed here.

_Triage by Computer (TESSERA orchestrator), 2026-10-21. Report-only._
