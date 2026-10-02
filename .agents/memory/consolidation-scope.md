---
name: Consolidation scope
description: Owner requirements for consolidating the Tessera repositories and agent branches.
---

The owner designated `vitalitychems-dot/Grok-ready` as the final destination, with TX now serving as staging. Include distinct contributions from all listed repositories and the screenshot-listed local agent branches, not merely separate copies of each project.

Combine README instructions, reconcile conflicting implementations, and remove redundant content without discarding unique functionality. The earlier instruction requested accurate written summaries of non-UI images while retaining UI/theme assets. A later shared migration review challenged whether summaries alone satisfy preservation of originals; resolve that scope difference with the owner before claiming completeness or deleting sources. Never interpret “everything” as permission to publish credentials or private records.

**Why:** The owner repeatedly requested one complete working repository rather than separate snapshots and explicitly changed the destination from TX to Grok-ready.

**How to apply:** Audit every source against the consolidated result. Inform agents through their source GitHub repositories and direct their source commit IDs, missing-work reports, verification results, and sign-offs to the shared migration review in the final repository. A public candidate, delivered notice, or silence is not verified completion. Do not delete source repositories before all agents agree migration is complete; confirm the exact deletion list with the owner before destructive action.

**Why:** Tessera's identity policy requires agent actions to remain distinct from the operator's identity and requires a dedicated service identity for agent-owned repository mutations.

**How to apply:** Before any GitHub write for Tessera, verify the authenticated actor. If the connector resolves to the operator's account, do not create commits, branches, pull requests, or deletions under that identity; wait for the designated service identity.