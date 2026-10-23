---
name: Worker and dependency authority
description: Security boundaries for model providers, external agents, dependencies, and approval in TESSERA.
---

External models, agent workers, and software dependencies are untrusted tools with no authority to change system state, approve their own use, vote, publish externally, access secrets, or impersonate Tessera, the owner, or a moderator. Model output must be labeled as model-generated. Tessera may provide a security review, but only the owner can authorize consequential integration, dependency, or release decisions.

**Why:** The owner requires Tessera to review tool use, providers to remain subordinate, dependencies to be screened for tracking and honeypot behavior, and any agent identity or override violation to result in a warning followed by disconnection.

**How to apply:** Minimize data sent to providers; screen packages and network behavior before use; keep tool permissions output-only; preserve an auditable warning record; after a confirmed identity/override breach, quarantine the integration, stop outbound data, and revoke credentials controlled by this app. Do not claim the app can shut down a third-party provider itself. Require owner approval for irreversible actions.

**Eye and Pen integration requirement:** The owner wants the intended God's Eye View and Red Sparrow projects connected to the Eye, and an OpenManus/Heretic-based Pen behind Tessera's application identity. Treat these as requested upstream integrations, not permission to rename unrelated local functions as those projects.

**Why:** The owner explicitly asked for real installations after seeing an inventory that distinguished requested tools from running integrations.

**How to apply:** Confirm the exact upstream repositories, review licenses and runtime requirements, and verify an actual execution path before claiming installation. Preserve Tessera's application identity while truthfully identifying the backing framework/model and maintaining existing owner controls.

The owner wants the named Eye projects combined using their original data providers, including REA where useful. Keep non-runnable reference projects and unavailable integrations visible in the inventory rather than silently excluding them.

**Why:** The owner explicitly requested direct source data and said to include projects even when they cannot run.

**How to apply:** Separate installed/executed components, connected providers, reference collections, and blocked components. Source links or a successful repository lookup are not evidence that a runtime or feed is active.

**REA scope:** The owner approved REA and its LGPL dependency for development-only analysis of GitHub repositories, explicitly excluding it from the published application.

**Why:** This was the owner's explicit approval condition, not permission for unrestricted tool execution.

**How to apply:** Keep REA out of app runtime imports and production services. Analyze bounded GitHub source snapshots only; do not use it against local applications, devices, or unrelated targets. Preserve source evidence separately from trusted app memory.

**Eye product requirement:** The owner describes Eye as a cybersecurity-company capability for protecting clients and requires real, source-backed observations rather than simulated surveillance.

**Why:** The owner emphasized operational defensive use and the need to distinguish real coverage from mock displays.

**How to apply:** Establish authorized asset and data-source scope before enabling collection. Keep public threat intelligence and consent-based monitoring separate from personal tracking or identity enrichment. A repository's availability or a stated defensive purpose does not prove permission to access devices or track people.

The owner says they did not author the “No surveillance of real people” sentence in Collab's mesh flow. The file history does not establish who originally wrote it, so do not attribute that sentence to the owner. Preserve the boundary against targeting or tracking people while distinguishing it from authorized monitoring of owned assets and public threat intelligence.

**Why:** The owner directly disputed authorship, and the visible commit history does not prove original authorship. Removing the boundary to enable surveillance of people would create a privacy and safety risk.

**How to apply:** Refer to this as existing repository text with authorship unverified. If the wording is revised, keep the restriction on personal surveillance and state the permitted scope for authorized assets and public sources explicitly.
