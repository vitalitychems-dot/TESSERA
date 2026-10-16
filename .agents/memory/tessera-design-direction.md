---
name: TESSERA live world interface
description: Owner's standing direction for the main TESSERA workspace UI.
---

The owner wants TESSERA's main experience to feel like a Minecraft-inspired voxel world with the Eye, Brain, and Chat visible together as live parts of one interface. The dashboard must use actual connected repo/API state, not invented activity or simulated agent actions. The owner identified `blendi-remade/agentcraft` as the intended Minecraft studio/world for TESSERA agents; treat its in-game activity as simulation unless a separately authorized live feed establishes otherwise.

**Why:** The owner explicitly requested an entirely new Minecraft-like UI that shows the Eye, Brain, and Chat in real time and syncs data from the two public repositories.

**How to apply:** Build the unified world as an isolated, reviewable TESSERA experience. Identify every real data source, freshness method, and permission boundary; label unavailable or stale data plainly. Do not turn on a feature flag or publish before Gitbook's documented tests and review gates pass.

**AgentCraft boundary:** The identified repository is a MIT-licensed Fabric/Minecraft application, not a browser-embeddable map or a TESSERA API feed. Do not imply that cloning or linking it makes its game state available in TESSERA; connect only through an explicitly authorized, read-only runtime endpoint, and label in-game activity as simulated.

**Why:** The owner identified the public AgentCraft repository as the simulated world where TESSERA's agents should live, while the current TESSERA world API is separately marked deterministic and non-live.

**How to apply:** Preserve the provenance boundary when integrating the Minecraft runtime. Do not invent agent telemetry or expose write controls through a read-only map connection.

**Operational constraint:** When a route-health probe covers an optional data source, report a successful but explicitly unavailable response (`available: false`, null data, and provenance) when no connector exists. A 5xx is treated as a service failure and can close the API readiness gate or restart the server.

**Why:** Returning 503 for an intentionally unconnected world source caused the watchdog to mark all route health as failed, repeatedly close readiness, and restart the API.

**How to apply:** Reserve 5xx for actual failures. For expected absence of optional live integrations, return a clearly labeled unavailable state so the UI remains honest and the server remains healthy.
