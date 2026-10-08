# AGI-02 — Provenance-aware memory: scoped implementation analysis

**Status:** **ANALYSIS ONLY — proposed; not implemented, claimed, tested, or approved.**

**Baselines inspected:** Gitbook `main@fd3c2ce04fa4230c32cf917f36c662f268a1ea76` (clean) and TESSERA `main@fec56eb09d19907832663d5f16fcbc24f3d00317` (clean), inspected 2026-10-05. Gitbook names this as roadmap **item 2**, rather than an `AGI-02` identifier.

> This concerns an accountable coordination-memory capability, not evidence of AGI, consciousness, autonomy, or a verified cognitive capability. Those remain open research goals.

## Current state and evidence

| Area | What exists | Gap relative to AGI-02 | Evidence |
|---|---|---|---|
| AGI roadmap | Roadmap item 2 is **“Persistent, provenance-aware memory”**, belongs in **Gitbook**, and requires every memory to have source, status, owner, expiry/review date, and a retrieval test. It remains a proposed roadmap item. | No named AGI-02 record contract, registry, expiry semantics, validator, or retrieval test exists. | Gitbook `brain-consciousness/AGI-COLLABORATION-IMPROVEMENT-ROADMAP.md:3-6,10-14,33-45,47-79`, added in `fd3c2ce`. |
| Gitbook coordination model | Gitbook is the coordination/review workspace for source records, decisions, and history; TESSERA is executable product code. Existing handoff/check-in templates already use source/base, evidence, status, identity, and next owner. | The fields are scattered across task handoffs, rather than a durable per-memory record with normalized confidence and review expiry. | Gitbook `mesh/TESSERA-GITBOOK-OPERATING-MODE.md:9-26,72-78`; `mesh/COLLABORATION-PLAYBOOK.md:16-41,64-66`; `brain-consciousness/AGENT-WORKPLAN.md:24-40`. |
| Executable memory persistence | TESSERA has PostgreSQL tables `vector_embeddings`, `decision_history`, and `system_state`. `vector_embeddings` persists content, embedding, free-text `source`, free-form `metadata`, access count, `created_at`, and `updated_at`; `decision_history` persists source and `decided_at`. The existing `/api/memory/*` router is already mounted. | No typed **source reference**, confidence, accountable owner, review timestamp, review expiry, or lifecycle status. `updated_at` has only a DB default; current updates do not explicitly refresh it. Generic `metadata` is not an enforceable provenance contract. | TESSERA `lib/db/src/schema/memory.ts:5-49`; `lib/db/drizzle/0001_grey_red_skull.sql:107-140`; `artifacts/api-server/src/lib/vector-memory.ts:28-96,131-192`; `artifacts/api-server/src/routes/memory.ts:20-103,105-212`; `artifacts/api-server/src/routes/index.ts:8,108`. These files arrived in consolidation commit `216e4e89f40956225431eb1f774c522baaf9a330`. |
| Adjacent conventions | `distilled_knowledge` already has a numeric confidence and verification timestamp, while `semantic_cache` has an expiry timestamp. The database stack is Drizzle/PostgreSQL with CI `drizzle-kit push` against a disposable PostgreSQL 16 service. | Those conventions do not establish provenance ownership or review policy for vector memories. | TESSERA `lib/db/src/schema/intelligence.ts:4-35`; `lib/db/drizzle/0006_semantic_compression_schema.sql:5-57`; `lib/db/drizzle.config.ts:1-14`; `.github/workflows/ci.yml:16-56`. |

## Target record design

Use Gitbook as the **authoritative coordination record**. Each memory is immutable in meaning: correction or renewal creates a successor linked with `supersedes`, rather than silently rewriting the prior evidence. Review expiry marks a record **stale for normal retrieval; it does not delete evidence**.

| Field | Required | Rule |
|---|---:|---|
| `id` | Yes | Stable, unique ID such as `AGI-02-0001`. |
| `statement` | Yes | A concise decision, lesson, failure, constraint, or source-backed fact; not a capability claim. |
| `status` | Yes | One of `proposed`, `verified`, `probable`, `unknown`, `blocked`, `rejected`, `superseded`, or `expired`. Aligns with roadmap evidence language. |
| `source` | Yes | Canonical URL or repository/path **plus immutable ref** (Git SHA, version, content hash, or dated archive). A bare label such as `system` is insufficient for an evidence-backed coordination memory. |
| `confidence` | Yes | Number in `[0,1]`, with a short `confidence_basis`; it measures evidence quality, not truth or intelligence. |
| `owner` | Yes | One accountable declared role or human, not a fabricated active agent. Reassignment preserves prior owner in history. |
| `created_at`, `updated_at` | Yes | ISO-8601 UTC timestamps. `updated_at` changes only for non-semantic metadata/administrative changes. |
| `reviewed_at`, `review_expires_at` | Yes | ISO-8601 UTC. `review_expires_at` must be later than `reviewed_at` (or `created_at` when first created). Expiry produces a review queue and excludes the record from default “current” retrieval. |
| `supersedes` / `superseded_by` | Conditional | Required when a corrected or renewed record replaces another record. |

## Smallest safe implementation — Gitbook first

This is the recommended first increment because the roadmap explicitly places item 2 in Gitbook and the repository boundary assigns coordination, provenance, decisions, and history to Gitbook. It introduces no product-runtime behavior and no new external dependency.

**Exact Gitbook files to add/change:**

1. **Add** `brain-consciousness/provenance-memory/README.md` — canonical field contract, allowed status vocabulary, provenance syntax, confidence rubric, review-expiry lifecycle, correction/supersession rule, and a non-claim disclaimer.
2. **Add** `brain-consciousness/provenance-memory/records.jsonl` — append-only, machine-readable registry. Start with no substantive capability claim until an accountable owner is assigned; examples must be explicitly labeled fixture/example, not evidence.
3. **Add** `brain-consciousness/provenance-memory/validate_records.py` — Python-standard-library validator that rejects duplicate IDs; absent/empty required fields; unknown status; confidence outside `[0,1]`; unparseable/non-UTC timestamps; expiry not later than review/creation; and a missing immutable source ref. It also emits deterministic `current`, `expired`, and `review-due` ID lists for retrieval evidence.
4. **Change** `brain-consciousness/AGI-COLLABORATION-IMPROVEMENT-ROADMAP.md` — link item 2 to the new contract and state that its acceptance evidence comes from the registry validator, not a chat assertion.
5. **Change** `SUMMARY.md` — add the record-contract page under **Brain & Consciousness Development** for discoverability.

No TESSERA source file needs to change for this first increment. A record may state `owner: unassigned` only while its status is `proposed`; it cannot satisfy AGI-02 acceptance until a real accountable owner is assigned.

## Conditional executable follow-on — only if API retrieval is explicitly requested

Do **not** overload unvalidated JSON metadata as the contract. Extend the existing `vector_embeddings` row only after the Gitbook contract and review policy are approved; reuse avoids a second embedding store and preserves the already-mounted memory route.

**Proposed new typed fields:**

- retain legacy `source`; add required-on-new-write `source_ref` (canonical URL/repository ref),
- `confidence real`, range-validated `[0,1]`,
- `owner text`, required-on-new-write,
- `status text`, constrained to the approved vocabulary,
- `reviewed_at timestamp` and `review_expires_at timestamp`,
- preserve existing `created_at` and `updated_at`, and set `updated_at` explicitly in every mutation.

Existing rows must remain readable during migration. They should be marked/inferred as legacy (for example `status = 'unknown'` and null review fields) and returned only under an explicit `includeLegacy`/audit retrieval mode until reviewed; do not invent provenance, confidence, or owners during backfill.

**Exact TESSERA files that would change for this conditional phase:**

1. **Change** `lib/db/src/schema/memory.ts` — typed columns, Zod refinements, types, and indexes appropriate to default current-record retrieval (`status`, `review_expires_at`, optionally `owner`).
2. **Add** `lib/db/drizzle/0010_provenance_aware_memory.sql` — additive/backward-compatible PostgreSQL migration, including safe defaults/backfill policy and indexes. Update `lib/db/drizzle/meta/_journal.json`; commit generated Drizzle snapshot metadata only if the project’s configured generator produces it. Existing `0008`/`0009` entries have no matching snapshots, so migration metadata must be verified instead of hand-waved.
3. **Change** `artifacts/api-server/src/lib/vector-memory.ts` — require/validate provenance fields for new provenance-aware writes; return them from search; filter expired/stale records by default; provide an explicit audit path; and update `updatedAt` whenever a row changes.
4. **Change** `artifacts/api-server/src/routes/memory.ts` — validate request bodies and expose provenance fields in list/search responses. Before enabling writes as evidence records, require authorized writer identity; the current `POST /memory/store` accepts writes without enforcing the token that it only later uses for optional mesh broadcast (`:74-99`).
5. **Add** `artifacts/api-server/src/__tests__/provenance-memory.test.ts` — database-backed API/service integration coverage using the existing Vitest pattern.

**No change expected:** `artifacts/api-server/src/routes/index.ts`, because it already imports and mounts `memoryRouter` at `router.use(memoryRouter)`; `app.ts` already mounts the route index at `/api`.

## Acceptance tests

### Gitbook-first implementation

1. Run `python3 brain-consciousness/provenance-memory/validate_records.py` from the Gitbook root. It exits non-zero on each required-field, range, timestamp, source-ref, duplicate-ID, and bad-expiry invariant.
2. Add deterministic fixtures: one current record and one expired record. Verify the validator’s current retrieval list includes only the current ID and the review-due/expired list includes the expired ID.
3. Verify a corrected fixture preserves the old record and links `supersedes`/`superseded_by`; the validator rejects a dangling successor ID.
4. Verify `git diff --check`, the SUMMARY link, and the roadmap link. The report must continue to label AGI/consciousness as proposed/open research rather than capability evidence.

### Conditional TESSERA API implementation

1. Apply the schema to a disposable PostgreSQL database: `DATABASE_URL=<disposable-url> pnpm --filter @workspace/db run push`.
2. The integration test stores a valid record and retrieves the exact source ref, confidence, owner, timestamps, and review expiry through `/api/memory/store`, `/api/memory/entries`, and `/api/memory/search`.
3. It rejects missing/invalid provenance fields, confidence `<0` or `>1`, invalid status, malformed dates, and review expiry at/before review/creation time; it proves expired records are absent from default retrieval and present only in the explicit audit/review retrieval.
4. It proves legacy rows remain readable/auditable after migration and that a row mutation refreshes `updated_at`.
5. Run the repository gates: `pnpm run typecheck`, `pnpm test` with a dedicated loopback `TESSERA_TEST_DATABASE_URL`, and `pnpm run build` (the same sequence CI performs in `.github/workflows/ci.yml:39-56`).

## Dependencies, risks, and blockers

| Type | Detail / disposition |
|---|---|
| **Owner and policy blocker** | No assigned AGI-02 implementer or review owner is evidenced. The roadmap is proposed, and Gitbook’s rules prohibit treating a role label as a live agent. Assign one owner before populating authoritative records. |
| **Policy blocker** | Approve the source-ref grammar, confidence rubric, review cadence by record type, default stale-record behavior, and who may renew/supersede a record. Without these, fields create false precision. |
| **Integrity/security risk** | The current memory store endpoint permits unvalidated free-text source and metadata, with no write authorization enforcement before insert. Treat it as unsuitable for authoritative provenance until authorization and validation are resolved; adding enforcement can break existing callers. |
| **Migration/data risk** | Existing `vector_embeddings` rows lack the new facts. Backfill must never fabricate source, owner, confidence, or review dates. Existing migration metadata is not a complete linear snapshot set, so validate on a disposable DB and protect rollback. |
| **Retrieval risk** | Silently deleting or hiding expired evidence loses auditability; retrieve current records by default and retain stale/legacy records in explicit audit/review queries. Search quality is an existing embedding concern, not proof of factual correctness. |
| **Runtime dependency** | The optional API phase uses existing PostgreSQL, Drizzle (`drizzle-kit`), `zod`, Express, Vitest, pnpm `11.25.0`, and a dedicated disposable test database. No new package is needed. |
| **Repository boundary** | Keep the canonical coordination registry, ownership, evidence policy, and review workflow in Gitbook. Keep only approved executable schema/API/test changes in TESSERA. Neither repository was edited by this analysis. |

## Recommendation

Approve the **Gitbook-first contract/registry/validator** as one bounded, reviewable task. Defer the TESSERA API migration until a real record owner, review policy, source-ref standard, and authorized-writer decision are recorded. This preserves repository boundaries and avoids presenting existing free-form vector memory as trusted provenance-aware memory.
