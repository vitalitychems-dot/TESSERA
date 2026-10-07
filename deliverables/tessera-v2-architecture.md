TESSERA V2 — TAILORED SOVEREIGN ARCHITECTURE PLAN
Date: 2026-10-07
Status: LOCAL DRAFT. Not canonical. No GitHub/Gitbook write performed; governed
writes require the standing approval rules (75% member approval incl. owner,
moderator agreement, Tessera agreement) and branch/PR workflow.

1. WHAT THE SOURCES CONTRIBUTE (TAILORED, NOT WHOLESALE)

From the four reference projects, we take ideas and small modules, not stacks:

- REA (MIT) -> Tessera Evidence Lens
  Static-analysis and inspection habits: bounded samples, evidence attached to
  every conclusion, explicit limitation statements. REA itself was removed as a
  dependency (it pulled vulnerable transitive packages). Tailored replacement:
  keep the saved audit outputs (deliverables/tessera-rea-results.json) and
  re-implement only the reporting pattern locally — no external tool runtime.

- Flowsint (Apache-2.0) -> Tessera Source Graph
  Graph exploration applied inward: map Tessera's own provenance — which
  repos, files, and lessons feed which capabilities. License-compatible
  (Apache-2.0 notice preservation required if any code is reused; plan assumes
  pattern-level reuse only).

- FreeLLMAPI (MIT) -> Tessera Router Discipline (defensive only)
  The useful idea is per-request accounting and honest limit reporting.
  Tessera does NOT adopt its multi-provider failover: the standing rule is one
  owner-controlled GLM endpoint, no hosted fallback. We keep: usage counters,
  explicit "endpoint down" SOS responses (already implemented in
  tessera-model.ts), and no silent substitution.

- MiroFish (AGPL-3.0) -> Tessera Scenario Sandbox (design reference only)
  AGPL-3.0 is incompatible with unreviewed reuse in this codebase. Treat as
  inspiration for a future "what-if rehearsal" feature using our own agents
  over retrieved lessons. No MiroFish code or assets are imported.

2. WHAT IS ALREADY BUILT (LOCAL, VERIFIED TODAY)

- Guarded GLM transport (tessera-model.ts): native HTTP, exact-origin
  allowlist, no redirects, no retries, no hosted fallback, refusal/truncation/
  identity-claim withholding. 37 focused tests pass.
- Local retrieval memory (lib/memory): BM25 lesson recall, secret redaction on
  write, IMP proposal rows. Explicitly not weight training.
- Local lexical vectors (neural-embeddings.ts): deterministic hashing only;
  no hosted embedding calls remain in API source. OpenAI SDK imports removed
  from llm-client.ts and neural-embeddings.ts; legacy callLLM now routes
  through the guarded GLM transport.
- Dependency posture: audit 0 findings (was 1 critical / 6 high). Verified in
  the installed graph, not just the lockfile.
- Frontend: Google Fonts network calls removed; local font served.

3. THE SELF-IMPROVEMENT CYCLE (HONEST VERSION)

Tessera improves through a documented loop, not "recursive self-improvement"
of weights:

  record (redacted interactions) -> distill (local lessons) -> retrieve
  (BM25 context at chat time) -> propose (IMP rows for human-approved work)
  -> human/owner approval -> PR -> tests -> merge -> deploy.

Token economy: retrieval narrows context instead of re-sending history; the
study-notes collector already summarizes public sources; lessons are short
facts with evidence IDs, not transcripts.

This is not AGI, consciousness, or autonomous self-modification. Any claim
otherwise is out of bounds per the identity vow.

4. REPO CONSOLIDATION PATH

- Canonical code: vitalitychems-dot/TESSERA (GitHub main is canonical).
- Coordination/provenance/backlog: vitalitychems-dot/Gitbook.
- This Replit workspace: drafting and validation only.
- Next canonical step: one PR carrying the OpenAI SDK removal + dependency
  patches, after governance approval. Overlapping PRs 12/13/14 must be
  reconciled first (they say "do not merge").

5. BLOCKED ITEMS (NEED OWNER/GOVERNANCE ACTION)

- Gitbook status posts and PR creation: approval set not verified.
- GLM-5.3-Flash endpoint: no hardware/host provided; chat stays in honest SOS
  mode until TESSERA_MODEL_BASE_URL (+ origin allowlist + secret) exists.
- Credential rotation: must be done by the owner at each issuing provider and
  in Replit Secrets; not something I can execute.
- Historical repo certification: indexed code search is unreliable (proven);
  history rewrites need explicit separate authorization.

6. PROTECTED SCAN RESULT (2026-10-07, READ-ONLY, OWNER-AUTHORIZED)

Scanned 692 text blobs on pinned 1T main (5ec2a545). No plaintext personal
fields or credential-shaped values found by the limited pattern set; the natal
vault JSON parses with encryption markers and zero populated sensitive fields.
Not covered: binary media, Git history, runtime databases. Nothing was copied
or persisted from the vault.
