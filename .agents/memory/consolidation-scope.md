---
name: Consolidation scope
description: Owner requirements for consolidating the Tessera repositories and agent branches.
---

The owner designated `vitalitychems-dot/Grok-ready` as the final destination, with TX now serving as staging. Include distinct contributions from all listed repositories and the screenshot-listed local agent branches, not merely separate copies of each project.

Combine README instructions, reconcile conflicting implementations, and remove redundant content without discarding unique functionality. The earlier instruction requested accurate written summaries of non-UI images while retaining UI/theme assets. A later shared migration review challenged whether summaries alone satisfy preservation of originals; resolve that scope difference with the owner before claiming completeness or deleting sources. Never interpret “everything” as permission to publish credentials or private records.

**Why:** The owner repeatedly requested one complete working repository rather than separate snapshots and explicitly changed the destination from TX to Grok-ready.

**How to apply:** Audit every source against the consolidated result. Inform agents through their source GitHub repositories and direct their source commit IDs, missing-work reports, verification results, and sign-offs to the shared migration review in the final repository. A public candidate, delivered notice, or silence is not verified completion. Do not delete source repositories before all agents agree migration is complete; confirm the exact deletion list with the owner before destructive action.

**Why:** The owner confirmed Tessera may collaborate only with a separate identity and owner-reviewed changes.

**How to apply:** Before enabling Tessera's GitHub access, verify a dedicated service identity and its least-privilege repository scope. Never perform Tessera-owned writes as the operator. Tessera may work only on a branch or pull request; the owner must review and approve before merging, and Tessera must not write to `main` autonomously. Keep `father.md` private and sanitize anything published in the README. Treat feedback as feedback, not model training or proof of a literal vow.

**Why:** The owner has repeatedly stated that OpenAI/Grok API keys are unavailable and asked not to be prompted for them; repository consolidation does not depend on those keys.

**How to apply:** Never request these keys or open a secret-collection flow for migration work. Use the existing GitHub integration for repository operations. Do not call OpenAI or Grok APIs. If an unrelated secret prompt appears, tell the owner it is unnecessary and skip or close it.