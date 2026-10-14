---
name: TESSERA live world interface
description: Owner's standing direction for the main TESSERA workspace UI.
---

The owner wants TESSERA's main experience to feel like a Minecraft-inspired voxel world with the Eye, Brain, and Chat visible together as live parts of one interface. The dashboard must use actual connected repo/API state, not invented activity or simulated agent actions.

**Why:** The owner explicitly requested an entirely new Minecraft-like UI that shows the Eye, Brain, and Chat in real time and syncs data from the two public repositories.

**How to apply:** Build the unified world as an isolated, reviewable TESSERA experience. Identify every real data source, freshness method, and permission boundary; label unavailable or stale data plainly. Do not turn on a feature flag or publish before Gitbook's documented tests and review gates pass.
