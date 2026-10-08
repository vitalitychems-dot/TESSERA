# Provenance-aware coordination memory

**Status:** Gitbook-first contract slice; not a TESSERA runtime feature.

This registry stores accountable coordination memories: decisions, lessons, constraints, failures, and source-backed facts. It is not evidence of AGI, consciousness, autonomy, or factual truth by itself.

## Required fields

- `id`: stable unique identifier.
- `statement`: concise record, not an unsupported capability claim.
- `status`: `proposed`, `verified`, `probable`, `unknown`, `blocked`, `rejected`, `superseded`, or `expired`.
- `source_ref`: immutable repository ref, URL, commit, version, or content hash.
- `confidence`: number from `0` to `1` with a `confidence_basis`.
- `owner`: accountable declared role or human.
- `created_at`, `updated_at`, `reviewed_at`, `review_expires_at`: ISO-8601 UTC timestamps.
- `supersedes` / `superseded_by`: required when correcting or renewing a prior record.

Records are append-only in meaning. Corrections create successors rather than silently rewriting history. Expired records remain available for audit but should not be treated as current by default.

Validate with:

```bash
python3 brain-consciousness/provenance-memory/validate_records.py
```

The TESSERA API/database migration is deliberately deferred until an owner, source-ref policy, authorization rule, disposable database, and integration tests are assigned and approved.
