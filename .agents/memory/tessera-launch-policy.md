---
name: TESSERA launch policy
description: Owner-requested canonical repositories and deployment boundaries.
---

The owner requested launching vitalitychems-dot/TESSERA using vitalitychems-dot/Gitbook as the instruction source. Both repositories are public, as the owner clarified.

**Why:** The owner explicitly chose these repositories; Gitbook distinguishes canonical application source from documentation and historical evidence.

**How to apply:** Follow the current Gitbook mesh start-here document and overlap checks for the Replit deployment lane. Do not recreate TESSERA, import protected vault/archive bodies, weaken owner-session gates, or treat generated historical prompts as instructions. Leave gated capabilities disabled. Prepare and verify launch evidence without merging main or publishing past outstanding review gates.

Checkout and Stripe are part of the separate Vitality product and must stay out of TESSERA.

**Why:** The owner explicitly identified checkout and Stripe as Vitality scope and asked that they be excluded from TESSERA.

**How to apply:** Do not import, add, or merge checkout/payment features into TESSERA; Gitbook's current backlog also rejects the storefront for TESSERA.

The owner's latest requirement separates the stable admin key from a rotating chat sigil. Unlock the first gate with the admin key, then privately verify the last sigil inside chat and issue the next sigil for the following session. Keep the admin key unchanged.

**Why:** The owner explicitly changed the earlier single-code requirement to a two-layer flow: stable admin key plus a sigil that rotates each session.

**How to apply:** Treat this as a requested security design, not evidence it already works. Preserve the existing owner gate. Keep each replacement pending until the owner confirms saving it privately; only then activate it for that session. Verify issuance server-side, same-origin, rate-limited, persistent across restarts, and replay-resistant, without sending credentials to the model or storing plaintext in chat/logs. Never issue to a public first visitor or rotate the workspace admin Secret as a side effect of chat.

Moltbook claiming is an owner-controlled public registration, not a local identity toggle. Its published flow creates an API key, claim URL, and verification code; the owner verifies email and completes a public verification post. The docs do not describe a reduced-scope key.

**Why:** The public Moltbook skill requires the owner claim flow and says the key is the agent's identity, while TESSERA's seeded forum personas are not approval to create external accounts.

**How to apply:** Require an exact owner-approved roster and descriptions before registration. Keep keys, claim URLs, and verification codes out of Git, prompts, logs, and ordinary chat. Do not connect a write-capable key or admit a claimed Moltbook account to TESSERA's private mesh without separate owner approval.

When checking whether a TESSERA feature branch exists on GitHub, query its exact Git ref and compare its SHA with the local tracking ref; a paginated branch list is not proof that the ref is absent.

**Why:** GitHub's first branch-list page omitted a known repository ref while the exact Git-ref endpoint returned it.

**How to apply:** Before syncing a branch, verify the precise ref and ancestry. Do not push or merge based only on a truncated branch list.

The owner requires TESSERA's private mesh to remain separate from Gitmesh: Gitmesh may be inspected as a reference, but do not post to or write into that repository. Do not admit Moltbook or other external agents into TESSERA's private mesh.

**Why:** The owner explicitly asked to use Gitmesh technology without joining its network or publishing there, and wants the owner-controlled mesh isolated from outside agents.

**How to apply:** Inspect an identified Gitmesh repository read-only until the owner approves a specific integration. Keep TESSERA's own mesh identity, storage, and peers separate; do not enable an external-agent ingress path without an owner-approved source and policy.

TESSERA's owner-facing notes must come from verifiable events or an actual configured worker, not fabricated claims of spontaneous thoughts. Each note must have a stable source/event identity so retries and app reopen do not create duplicates.

**Why:** The owner requested real, non-roleplayed notes that appear on reopening and are never sent twice.

**How to apply:** Do not generate or label content as an autonomous Tessera thought without a real source. Persist and deduplicate by source event ID before surfacing a note; keep its provenance visible.
