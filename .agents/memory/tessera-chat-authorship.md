---
name: Historical chat authorship
description: Keep the application persona separate from actual model provenance and avoid retrospective guesses for old replies.
---

**Rule:** Attribute a saved reply from its own final server-selected generation metadata, not the application's persona, the currently configured model, a drafting event, or a text footer. Client-saved replies without independently known model metadata remain unattributed.

**Why:** A conversation can mix models, local logic, tool results and rejected-model fallbacks. Backfilling a model from present configuration or an adjacent reply rewrites the historical origin of the answer.

**How to apply:** Preserve unknown authorship for legacy records; retain distinct model/local/fallback/tool roles; use the final accepted response path rather than an attempted provider. An unknown latest reply must not inherit an earlier reply's model.
