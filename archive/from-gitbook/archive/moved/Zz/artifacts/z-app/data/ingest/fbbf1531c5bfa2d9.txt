---
name: Repository migration policy
description: Canonical destination and source-retention rules confirmed by the owner.
---

Grok-ready is the final repository; TX is the staging repository. Preserve unique contributions rather than treating differing filenames or versions as duplicate proof.

**Why:** The owner confirmed this destination and asked to include everything while removing only redundancy.

**How to apply:** Compare source content and branches against the accepted Grok-ready result. Report unresolved omissions and verification results in the shared migration review.

Keep all old repositories until every agent agrees that its contributions are accounted for and the owner confirms the exact deletion list.

**Why:** The owner explicitly confirmed this deletion gate.

**How to apply:** Never infer agreement from migration notices, silence, or an inventory alone. Do not delete repositories during collection or while omissions remain unresolved.