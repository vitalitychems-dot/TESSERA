---
name: Consolidation scope
description: Owner requirements for consolidating the Tessera repositories and agent branches.
---

The owner designated `vitalitychems-dot/Zz` as the canonical destination, superseding the earlier Grok-ready target. The owner wants one non-overlapping Tessera tree that excludes crypto, trading, arbitrage, finance, Vitality, and store-related material.

Combine README instructions, reconcile conflicting implementations, and remove redundant content without discarding unique functionality. The earlier instruction requested accurate written summaries of non-UI images while retaining UI/theme assets. A later shared migration review challenged whether summaries alone satisfy preservation of originals; resolve that scope difference with the owner before claiming completeness or deleting sources. Never interpret “everything” as permission to publish credentials or private records.

**Why:** The owner changed the canonical target to Zz and explicitly named domains to exclude from the final Tessera tree.

**How to apply:** Audit every authorized source against Zz and classify duplicate/excluded paths with dependency and content checks before proposing removals. Keep source repositories intact unless the owner approves exact source paths for deletion after sign-off. Use Zz's dated agent notes and PR review for coordination; a note, notice, or silence is not verified completion. Confirm exact destructive changes with the owner before applying them.

**Why:** The owner confirmed Tessera may collaborate only with a separate identity and owner-reviewed changes.

**How to apply:** Before enabling Tessera's GitHub access, verify a dedicated service identity and its least-privilege repository scope. Never perform Tessera-owned writes as the operator. Tessera may work only on a branch or pull request; the owner must review and approve before merging, and Tessera must not write to `main` autonomously. Keep `father.md` private and sanitize anything published in the README. Treat feedback as feedback, not model training or proof of a literal vow.

**Why:** The owner has repeatedly stated that OpenAI/Grok API keys are unavailable and asked not to be prompted for them; repository consolidation does not depend on those keys.

**How to apply:** Never request these keys or open a secret-collection flow for migration work. Use the existing GitHub integration for repository operations. Do not call OpenAI or Grok APIs. If an unrelated secret prompt appears, tell the owner it is unnecessary and skip or close it.

## Repository inventory status

The owner reports that all 20 repositories remain present and none has been deleted. Do not claim any repository was deleted without verified evidence.

**Why:** Repository visibility can be limited by account access, and a missing result is not evidence of deletion.

**How to apply:** Verify the inventory through an authorized GitHub connection before reporting repository existence or deletion. Clearly distinguish a public-listing or access gap from a confirmed deletion.