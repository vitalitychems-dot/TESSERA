---
name: Graph storage boundary
description: Product preference for versioned graph knowledge in GitHub and selective runtime retrieval in Tessera.
---

Prefer keeping as much suitable, non-sensitive, versioned mesh, process, and knowledge data as practical in GitHub, then syncing or retrieving only the needed graph partitions into Tessera's live Replit runtime. Replit remains responsible for the hosted frontend/backend and mutable operational state. Do not put secrets, private vaults, personal data, or unsuitable large runtime assets into Git history.

**Why:** The owner selected a hybrid boundary and emphasized keeping the runtime fast and clean by pulling only what a task needs, including when using large models.

**How to apply:** Design partitioned, versioned knowledge and process artifacts with selective, cached retrieval. Benchmark token use, latency, storage, and correctness before broad migration. GitHub source control or automation does not replace Tessera's live database or API runtime.
