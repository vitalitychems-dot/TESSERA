
# HYB-005 — braces GHSA-vfj7-8cjw-p6xm decision

**Date:** 2026-10-05  
**Owner:** Security (mesh security/privacy lane)  
**Status:** ACCEPTED + MITIGATED (dated); DONE (published in `97e43fb`, PR #6)
**Base:** TESSERA `fec56eb` · Gitbook `6fe412f`  
**Conference:** https://github.com/vitalitychems-dot/Gitbook/issues/2

## Decision

**Accept and mitigate** the transitive braces high advisory for the mockup-sandbox path only. Do not invent a patch. Do not force-upgrade to a nonexistent release.

- Advisory: GHSA-vfj7-8cjw-p6xm
- Package: braces@3.0.3
- Path: artifacts/mockup-sandbox → fast-glob → micromatch → braces
- Severity: high (stack-exhaustion DoS via deeply nested brace patterns)
- Disposition: accepted + mitigated
- Mitigation: Narrow CI/pnpm audit ignore for GHSA-vfj7-8cjw-p6xm only, with an inline comment linking this decision
- Review date: 2026-11-05
- Removal condition: Remove the ignore as soon as braces ≥ 3.0.4 (or any advisory-patched release) ships upstream; then re-lock and confirm pnpm audit is clean for this GHSA
- Owner: Security

## Evidence (TESTED)

Lockfile at TESSERA fec56eb: braces@3.0.3; micromatch@4.0.8 → braces 3.0.3; mockup-sandbox package.json has fast-glob ^3.3.3.

CI pnpm audit on run 37348832495 / job 111894232164 (fec56eb): high braces DoS; Vulnerable ≤3.0.3; Patched versions None; Path artifacts__mockup-sandbox>fast-glob>micromatch>braces; GHSA-vfj7-8cjw-p6xm; 1 high. Same on runs 37341568741 and 37348793133.

## Risk rationale

Transitive mockup-sandbox tooling chain, not sovereign knowledge runtime. No patched release at decision time. Mitigation keeps CI honest for other advisories with dated expiry.

## Follow-up

1. **Done (current).** Narrow audit ignore is on TESSERA main `5c1137fa` ([PR #1](https://github.com/vitalitychems-dot/TESSERA/pull/1)). That commit adds 8 lines to `pnpm-workspace.yaml`: `auditConfig.ignoreGhsas` lists GHSA-vfj7-8cjw-p6xm only, review date 2026-11-05. The decision-time base above stays TESSERA `fec56eb`.
2. Security monthly patch check; mandatory review 2026-11-05.
3. When patched: bump via parent ecosystem, remove ignore, re-lock, prove clean audit.

## Provenance

Assignment Tessera comment 6001209770; Security claim 6001220477; no TESSERA app code changed.
