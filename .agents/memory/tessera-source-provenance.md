---
name: TESSERA source provenance
description: Rules for grounding factual replies in source records and preserving citations through answer reuse.
---

**Rule:** Carry the exact selected evidence alongside factual answer text from retrieval through response metadata and any local answer reuse. Use a validated original URL or stable document reference, retrieval/publication dates when known, and an explicit trust label. Treat stored or scraped sources as unverified unless trusted server-side review marks them otherwise.

**Why:** TESSERA has separate early-response and local-memory paths; a plain-text cache can lose the source metadata or a persona guard can replace a sourced reply. Ingested metadata is not a trust decision.

**How to apply:** When adding a factual reply path, return structured evidence with the answer, preserve it when caching or reusing the answer, and serialize citations from only the evidence that supports that reply. Label missing dates honestly instead of inventing them.
