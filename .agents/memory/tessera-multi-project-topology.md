---
name: Three-repository coordination
description: The owner's intended collaboration roles for TESSERA, GitAI, GitMesh, and Gitbook.
---

The owner's intended workflow has six distinct roles: Tessera selects one bounded piece; memory-flowsint recalls opened context and pointers, not archive bytes; Combined cold-holds large models and archives; GitMesh transports only selected pieces across a controlled sync boundary; Gitbook coordinates collaboration and review; GitAI remains a separate agent marketplace/project. GitHub is source storage, not an inference runtime. Large GLM weights can only be used after a compatible runtime with sufficient compute is actually available.

**Why:** The owner explicitly described these roles and asked that the repositories work together without moving the whole warehouse. The source maps preserve separate product repositories, and the current GitMesh repository is a public browser-only demo rather than a model-serving service.

**How to apply:** Build one orchestrated workflow over the separate repositories; do not merge or mirror their entire trees. Recall bounded, provenance-bearing context from memory-flowsint, keep bulk assets cold in Combined, and move only explicitly selected pieces. Keep Gitbook as the review ledger and GitAI separate. Do not claim real-time transfers while fully disconnected: live fetch/push requires a connected sync window; an air-gapped runtime must use an explicitly staged offline bundle. Treat GitHub as source storage unless a separate inference endpoint is configured, and respect the existing GitMesh/private-mesh ingress boundary.
