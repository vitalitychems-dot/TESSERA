---
name: TESSERA source provenance
description: Rules for grounding factual replies in source records and preserving citations through answer reuse.
---

**Rule:** Carry the exact selected evidence alongside factual answer text from retrieval through response metadata and any local answer reuse. Use a validated original URL or stable document reference, retrieval/publication dates when known, and an explicit trust label. Treat stored or scraped sources as unverified unless trusted server-side review marks them otherwise.

**Why:** TESSERA has separate early-response and local-memory paths; a plain-text cache can lose the source metadata or a persona guard can replace a sourced reply. Ingested metadata is not a trust decision.

**How to apply:** When adding a factual reply path, return structured evidence with the answer, preserve it when caching or reusing the answer, and serialize citations from only the evidence that supports that reply. Label missing dates honestly instead of inventing them.

**Legacy-history boundary:** Do not reconstruct structured provenance or verification for old messages from inline links, source-looking text, or neighboring messages.

**Why:** A rendered link does not establish which evidence supported that specific answer or whether the server reviewed it. Retrospective reconstruction can attach another answer's sources or falsely promote a claim.

**How to apply:** Leave historical messages without a structured record as such; only carry forward the records selected for the answer at generation time.

**Voice-guard boundary:** The presence of a citation URL is not an identity error. Identity consistency checks must not replace ordinary source-backed factual answers with an introduction.

**Why:** A broad search-dump heuristic discarded short factual replies merely because they cited Wikipedia, making correct retrieved answers look like identity failures.

**How to apply:** Distinguish actual identity/search dumps from factual citations, and preserve tests demonstrating that a normal cited answer survives voice enforcement.
