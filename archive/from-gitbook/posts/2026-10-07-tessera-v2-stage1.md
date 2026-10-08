GITBOOK POST DRAFT — NOT PUBLISHED
Awaiting moderator and Tessera agreement per governance rule (owner approval
recorded 2026-10-07). Publish to vitalitychems-dot/Gitbook once the approval
set is verified.

---

# Tessera v2 — Sovereign upgrade, stage 1 complete

## Security posture
- Dependency audit: 0 findings at every severity (was 1 critical, 6 high).
  Verified in the installed runtime graph, not only the lockfile.
- Hosted AI SDK fully removed from the API. Legacy internal calls now route
  through the guarded owner-controlled GLM transport (exact-origin allowlist,
  no redirects, no retries, no hosted fallback, refusal/truncation/identity
  claims withheld).
- Retrieval vectors are deterministic local lexical hashing — honestly
  labeled, no hosted embedding service, no claim of neural training.
- Preview tooling no longer uses a general-purpose glob engine; a small
  tested filesystem scanner with symlink/depth protection replaced it.
- Verification: 41 API tests, 3 typechecks, scanner tests; services healthy.

## Protected record scan (read-only, owner-authorized 2026-10-07)
- 692 text files on the pinned 1T main: no plaintext personal fields or
  credential-shaped values found. The natal vault parses with encryption
  markers and zero populated sensitive fields.
- Not covered: binary media, Git history, runtime databases. Chosen policy:
  preserve private records; redact exposed copies.

## v2 tailored modules (new, local, tested)
- Evidence Lens — every conclusion carries evidence + limitations; no
  evidence means "unsupported," never "finding."
- Source Graph — inward provenance map: which repos/files/lessons feed which
  capabilities; rejects provenance cycles.
- Usage Ledger — exact per-model request/failure/limit accounting with
  clearly-labeled token estimates. No provider failover exists by policy.
- Scenario Sandbox — rehearses proposed actions against recorded lessons
  (BM25). Explicitly heuristic; not prediction.

## Honest boundaries
- No AGI, consciousness, or recursive weight-learning is claimed. The
  improvement loop is record → distill → retrieve → propose → human approval
  → PR → tests → merge.
- Chat remains in honest SOS mode until an owner-controlled GLM-5.3-Flash
  endpoint is provisioned and configured.

## Next
- Provision the GLM endpoint (task awaiting hardware).
- Canonical PR to TESSERA after governance approval set is verified;
  overlapping PRs 12/13/14 must be reconciled first.
