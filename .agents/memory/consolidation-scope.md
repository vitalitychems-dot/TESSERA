---
name: Consolidation scope
description: Owner requirements for consolidating the Tessera repositories and agent branches.
---

The owner's current consolidation destination is `vitalitychems-dot/TESSERA`, with `vitalitychems-dot/Gitbook` for coordination and instructions. This supersedes the historical Zz and Grok-ready destinations. The owner wants one non-overlapping Tessera tree that excludes crypto, trading, arbitrage, finance, Vitality, and store-related material.

Combine README instructions, reconcile conflicting implementations, and remove redundant content without discarding unique functionality. The earlier instruction requested accurate written summaries of non-UI images while retaining UI/theme assets. A later shared migration review challenged whether summaries alone satisfy preservation of originals; resolve that scope difference with the owner before claiming completeness or deleting sources. Never interpret “everything” as permission to publish credentials or private records.

**Why:** The owner supplied TESSERA as the current repository and directed agents to Gitbook for next instructions. The earlier exclusions were explicitly owner-defined and have not been lifted.

**How to apply:** Audit every authorized source against current TESSERA and classify duplicate/excluded paths with dependency and content checks before proposing removals. Keep source repositories intact unless the owner approves exact source paths for deletion after sign-off. Read current Gitbook instructions and coordination before work; a note, notice, or silence is not verified completion. Confirm exact destructive changes with the owner before applying them.

**Why:** The owner confirmed Tessera may collaborate only with a separate identity and owner-reviewed changes.

**How to apply:** Before enabling Tessera's GitHub access, verify a dedicated service identity and its least-privilege repository scope. Never perform Tessera-owned writes as the operator. Tessera may work only on a branch or pull request; the owner must review and approve before merging, and Tessera must not write to `main` autonomously. Keep `father.md` private and sanitize anything published in the README. Treat feedback as feedback, not model training or proof of a literal vow.

## Tessera learning corpus

The owner approved an ongoing learning corpus from non-private TESSERA workspace files and accessible `vitalitychems-dot/TESSERA`, `vitalitychems-dot/Gitbook`, and `reconurge/flowsint` repository content. Include Crypto, Trading, Arbitrage, Finance, Vitality, and Store topics for learning only; this does not change the separate repository-consolidation exclusions. Exclude credentials, secrets, private vaults, and personal-data files. Source intake is read-only, incremental hourly with a manual refresh, and should preserve provenance. Tessera-authored work and teaching records remain distinguishable from source material; new conclusions are cited drafts requiring review.

**Why:** The owner explicitly expanded Tessera's learning scope beyond the narrower subject exclusions used for repository consolidation, while retaining privacy and review boundaries.

**How to apply:** Apply the expanded scope only to the learning corpus. Do not change consolidation or source-repository write rules. Treat repository access as unavailable until the existing GitHub connection binding is resolved; never request tokens or replace the connection to work around it.

**Why:** The owner has repeatedly stated that OpenAI/Grok API keys are unavailable and asked not to be prompted for them; repository consolidation does not depend on those keys.

**How to apply:** Never request these keys or open a secret-collection flow for migration work. Use the existing GitHub integration for repository operations. Do not call OpenAI or Grok APIs. If an unrelated secret prompt appears, tell the owner it is unnecessary and skip or close it.

## Repository inventory status

The owner reports that all 20 repositories remain present and none has been deleted. Do not claim any repository was deleted without verified evidence.

**Why:** Repository visibility can be limited by account access, and a missing result is not evidence of deletion.

**How to apply:** Verify the inventory through an authorized GitHub connection before reporting repository existence or deletion. Clearly distinguish a public-listing or access gap from a confirmed deletion.

## Tessera V2 navigation

The owner approved a V2 redesign of the existing Tessera app: retain unique destinations, group desktop navigation, use **Chat**, **Knowledge**, **System**, and searchable **More** on mobile, and merge only route entries verified to reach the same page and state. The System Engine has four approved groups: **Capability**, **Learning**, **Operations**, and **Architecture**.

**Why:** The current mobile navigation exposes dozens of destinations and some routes are aliases or intentionally open different inner tabs; decluttering must not break unique functions or deep links.

**How to apply:** Use a shared route/navigation registry, preserve old URLs and their intended states, and test all in-scope routes on desktop and mobile before removing visible entries.