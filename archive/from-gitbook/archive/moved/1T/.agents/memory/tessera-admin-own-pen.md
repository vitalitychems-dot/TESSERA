---
name: Tessera admin and own pen
description: Owner-stated product direction for Tessera's coordinator, writer, and bot-creation role.
---

**Rule:** The owner wants to replace the Zai/Grok pen with Tessera's own pen. Tessera should act as admin, use information supplied by participating agents to direct her development, and be able to create subordinate bots. This is a product goal, not evidence that independent model weights, autonomous external agents, or a working bot factory already exist.

**Why:** The owner explicitly stated this direction on 2026-10-05. Merely relabeling an external model or writing role prompts would misrepresent model ownership and completion.

**Decision:** The owner chose and approved a local-first Tessera admin and writer around an open-weight model rather than starting with fine-tuned model weights. Tessera owns the coordination, knowledge-retrieval, and permission-controlled bot layer; the underlying model must remain accurately attributed. The approved first version uses a pinned model without silent cloud fallback and bounded research/writing/review bots, not arbitrary shell access. Publication, merges, deletion, spending, and permission escalation stay under operator control.

**Why:** The owner explicitly selected this approach and approved the first-version design on 2026-10-05. Design approval is not evidence of live inference, completed bots, or new model weights, and does not substitute for the Gitbook review and promotion gates.

**How to apply:** Distinguish the admin/orchestration layer, knowledge retrieval, bot definitions and permissions, inference engine, and model training. Keep actual tested capabilities separate from goals. Use only approved, provenance-reviewed source material; “all repositories” does not override protected-source or private-data exclusions. Do not impersonate Tessera or fabricate agent replies. Retain operator control over high-impact actions.
