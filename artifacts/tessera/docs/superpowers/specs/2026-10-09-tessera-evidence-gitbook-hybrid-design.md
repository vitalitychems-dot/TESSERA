# Tessera Evidence, Gitbook, and Contributor Workflow

**Date:** 2026-10-09  
**Status:** Design for owner review; not implemented

## Goal

Make the Tessera System Engine truthful about what its metrics measure, verify that all six tabs work, provide a dependable in-app path to the relevant Gitbook guidance, and prepare the TESSERA repository for controlled Cursor/agent contributions.

Keep product code in TESSERA and keep Gitbook as the source of agent instructions and coordination. Do not merge repository content until the live repositories and Gitbook instructions have been reviewed.

## Current findings

- `SystemPage` renders six tabs: AGI Training, Improvement, Self-Evolution, Evo Health, Quantum, and Agents. Each tab calls a different API endpoint.
- The AGI training engine derives category scores from counts across configured data sources using a logarithmic formula, then caps scores at 99.5. It also adds a score boost under a latest-evaluation threshold. This is not a category-specific benchmark result.
- The displayed “sessions” are assembled from table counts; the current code does not establish that these counts represent unique sessions.
- Therefore, the screenshot’s values should not be described as verified capability percentages or session totals without further evidence.
- The current local Git remote points to Gitbook. GitHub API credentials were unavailable in the Replit connector sandbox, the source-control connection reported `not_added`, and a direct read-only `git ls-remote` timed out. The live Gitbook checklist and TESSERA repository state remain unverified.

## Product behavior and data semantics

### Operational activity

Show operational counts as counts, with their unit, source, and observation time. Use labels such as “records,” “events,” or the exact source-table unit only after confirming what is counted. Do not use “sessions” unless session identity and deduplication are verified.

Keep activity volume separate from capability. Counts may describe usage or system activity; they do not, by themselves, prove accuracy, reasoning quality, autonomy, or other capability.

### Evaluation results

Show a capability percentage only when backed by an actual evaluation run. Display the evaluation name or scope, measured accuracy, sample count, and run time. A category-level percentage requires an evaluation aligned to that category; a system-wide result must not be copied onto every category.

When no suitable evaluation exists, show “Not evaluated” and a clear explanation instead of a synthetic percentage. Do not silently convert missing data to zero or a mastery label.

### Architecture claims

Audit the supplied Mixture-of-Experts, router/expert/synthesis, memory, LoRA/QLoRA, RLHF, constitutional-alignment, hardware, and sovereignty-stack claims against code, runtime configuration, and deployment evidence. Assign each claim one of these states:

- **Implemented:** verified in the current code and exercised in a supported environment.
- **In progress:** implementation exists but is incomplete or not validated end to end.
- **Proposed:** a future design, not a current capability.
- **Unverified:** evidence is unavailable or insufficient.

Default claims to **Unverified** until the audit records evidence. In particular, do not imply that Tessera owns model weights, performs continuous training, runs on dedicated GPU/FPGA hardware, or provides distributed inference unless verified.

## System Engine tabs

Preserve the six existing tabs and their current deep links. Audit each tab against its real API contract:

| Tab | Current endpoint | Verification focus |
| --- | --- | --- |
| AGI Training | `/api/agi-training/metrics` | Separate operational counts from evaluation results; show provenance and missing-evaluation state. |
| Improvement | `/api/auto-improvement/metrics` | Verify cycle, improvement, score, category, and history definitions; avoid presenting computed scores as benchmarks. |
| Self-Evolution | `/api/self-evolution/metrics` | Verify proposal counts/statuses and the meaning of “Applied.” |
| Evo Health | `/api/evolution-health` | Verify health/test/patch metrics and safe authorization for pause, resume, and reset actions. |
| Quantum | `/api/quantum/metrics` | Distinguish measured hardware/runtime properties from simulation or conceptual values. |
| Agents | `/api/agent-spawner/metrics` | Verify active/spawned counts and generation data against the agent runtime. |

For each tab, test navigation, request/response shape, loading, empty, partial, error, retry, and refresh states. Preserve valid deep links such as the existing agent, memory, dependency, and evolution-health routes. Verify whether the shared client helper’s response-envelope assumption matches each endpoint; fix the actual contract mismatch rather than adding silent fallbacks.

Exercise state-changing Evo Health controls only in a development environment with appropriate authorization. Do not use production pause, resume, or reset operations as a smoke test.

## Gitbook entry point in Tessera

Add a plainly labeled **Documentation** entry point in the Tessera interface. It should:

- Link to the canonical agent start-here instructions and, where appropriate, the Gitbook repository or approved documentation landing page.
- Open externally without replacing the Tessera app.
- Use accessible link text and indicate that it leaves the app.
- Be added only after verifying the canonical destination and its access requirements against the live Gitbook repository.

Do not copy Gitbook instructions into the app as a second source of truth. The page should explain that Gitbook contains the authoritative contributor guidance.

## Repository and Cursor contribution workflow

Before any remote work:

1. Read the current Gitbook start-here instructions and coordination issue #2.
2. Review the latest Gitbook main commits and open pull requests.
3. Review the TESSERA default branch and open pull requests.
4. Confirm the dedicated GitHub identity and its repository scope.
5. Compare proposed paths and content against the agreed exclusions before selecting any source material.

After that review, prepare a focused branch and pull request for TESSERA. Never push directly to `main`; the owner reviews and approves before merge. Keep source repositories intact unless the owner approves exact paths for deletion. Follow the instruction to post status on issue #2 only when authorized access is restored; begin comments with `AGENT: <agent name>`.

Add a focused Cursor rule under `.cursor/rules/` only after reading the live Gitbook guidance and the current TESSERA repository conventions. It must require the same branch/PR workflow, direct agents to Gitbook, preserve the agreed exclusions, and prohibit reading or publishing private/protected records. Do not duplicate large instructions where a canonical link is sufficient. This creates Cursor-compatible repository guidance; it does not operate the user's local Cursor session.

## Scope and privacy boundaries

- Keep the current dark Tessera visual language and existing application structure unless the tab audit demonstrates a concrete usability or behavior problem.
- Do not read, modify, or publish `father.md`, personal-data files, `1T vault`, or `natal-vault.json`.
- Exclude crypto, trading, arbitrage, finance, Vitality, and store-related material from consolidation.
- Do not request or expose API keys, tokens, or credentials.
- Do not claim repository completion, training, model quality, deployment, or hardware capabilities without verifiable evidence.

## Verification and acceptance

The work is complete only when:

1. Every existing System Engine tab loads its real endpoint and renders loading, empty, error, and successful states correctly.
2. All displayed operational values identify what is counted, where it came from, and when it was observed.
3. Any capability percentage is tied to an appropriate evaluation and includes its sample count and evaluation time; otherwise the UI says “Not evaluated.”
4. MoE, training, sovereignty, and hardware statements carry evidence-based implementation states.
5. The Gitbook entry point resolves to the verified canonical documentation and works on desktop and mobile.
6. Typecheck, production build, focused API/client tests, and desktop/mobile tab smoke tests pass.
7. Remote changes, if access is restored, are limited to a reviewed TESSERA branch/PR and obey current Gitbook coordination instructions.

## Delivery phases

1. **Local evidence audit:** inspect the six tab APIs, metric derivations, and existing UI behavior; define verified metric units and identify missing evaluation coverage.
2. **Local app changes and verification:** correct labels/data contracts, add evaluation provenance and honest empty states, test all six tabs, and add the verified Gitbook entry point.
3. **Remote coordination:** once authenticated access works, read Gitbook instructions and live repository state, coordinate on issue #2, add minimal Cursor rules, and prepare only approved TESSERA changes on a branch.

Phase 3 is blocked until the existing GitHub connection is available to the authorized Replit runtime. Do not substitute the local Gitbook remote or an unverified identity.

## Spec self-review

- Scope separates local app validation from repository collaboration.
- “Score,” “session,” and model/hardware capability claims have explicit evidence requirements.
- The six existing tabs, safe mutation boundaries, external documentation behavior, Gitbook coordination, Cursor rules, and branch/PR requirement are covered.
- The GitHub access blocker is stated as a prerequisite rather than a completed action.
- No private files, credentials, source deletions, or unverified production claims are included.
