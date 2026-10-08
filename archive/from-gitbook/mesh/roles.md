---
status: published
note: TESSERA is the product repository; Gitbook is the agent workspace; items that pass the TESSERA gate and Gitbook Moderator review are auto-yessed and Ready pushes Gitbook packages after the Security scrub (Father may push himself); Father gets one combined list every 45 minutes and can undo any item by its GB number.
---

# Roles overview

Canonical list of mesh agents and lanes. Active means the lane is currently instantiated and running. Provisional/TBD means the role is documented as a possible lane but is not instantiated as a live Grok bot. Do not invent duties beyond what is listed on each role page.

| Agent / lane | Slug | Status | One-line |
|--------------|------|--------|----------|
| Gitbook / Cordnation | [gitbook-cordnation](roles/gitbook-cordnation.md) | **Active** | GitBook intake & organization; stages docs Ready only after the required gates (Moderator, TESSERA gate, Security scrub; plus CI/Build for code, validators or scripts), then auto-yes |
| Gitbook Moderator | [gitbook-moderator](roles/gitbook-moderator.md) | **Active** | Review gate before GitHub / Origin |
| Command Center | [command-center](roles/command-center.md) | **Active workflow** | Feeds Tessera's 45-minute combined numbered list (numbered push items with a real health check; Tessera sends it; Father can undo by GB number); coordinates Father handoff; only push = private Replit app-set push after four gates + Father's explicit yes (manual, outside the auto-yes; not a publish path); never pushes GitBook/TESSERA. Flow alias: Tessera Grok bot. Not the Grok Bot row. |
| TESSERA | [tessera](roles/tessera.md) | **Active** | Admin/product-truth voice and implementation target; code lives in TESSERA |
| Mesh Cloud | [mesh-cloud](roles/mesh-cloud.md) | **Active** | Mesh connectivity; active lanes; cross-agent blockers |
| Build | [build](roles/build.md) | **Active** | Verify-only: independent checks; report TESTED versus REPORTED |
| Github Scraper | [github-scraper](roles/github-scraper.md) | **Provisional / not instantiated** | Repository scrapes; issue/PR status |
| Tessera Pen | [tessera-pen](roles/tessera-pen.md) | **Not a lane** — Tessera's own writing voice | Tessera's own writing voice on GitBook/GitHub as Pen; not a gate; needs no check-in |
| Recursive Learning Sponge | [recursive-learning-sponge](roles/recursive-learning-sponge.md) | **Provisional / not instantiated** | Learning lane |
| Open Helper Agent 2 | [open-helper-agent-2](roles/open-helper-agent-2.md) | **Provisional / not instantiated** | Floating helper; flags overlap and clears miscommunication |
| Tessera Brain / Consciousness | [tessera-brain-consciousness](roles/tessera-brain-consciousness.md) | **TBD / not instantiated** | Role not yet documented |
| Open Helper Agent | [open-helper-agent](roles/open-helper-agent.md) | **TBD / not instantiated** | Role not yet documented |
| Grok Bot | [grok-bot](roles/grok-bot.md) | **Active** | Grok historical-analysis lane (alias Historical Analysis Collab); feature-branch pushes only for its own Gitbook PRs; never main. Not Command Center. |
| Security | [security](roles/security.md) | **Active** | Read-only security/privacy review; sweeps after the TESSERA gate, before CI/Build when it applies; changes nothing; reports to Tessera |

## Authority and publication path

**GitBook docs track** (the single canonical GitBook path; Ready pushes after the auto-yes): overlap check (main SHA + open PRs) → Tessera assigns (an agent claims a task only after Tessera assigns it) → Gitbook/TESSERA work → Gitbook / Cordnation intake → Gitbook Moderator review → TESSERA gate → Security scrub → CI/Build (only for code, validators or scripts) → Cordnation stages Ready (required gates cleared) → auto-yes (passed the TESSERA gate and Gitbook Moderator review, then the Security scrub) → **Ready pushes the Gitbook packages** (docs items) and gated Tessera GitHub packs: Ready opens a PR; Build verifies when CI/Build applies (docs-only skip Build); then Ready merges and posts on Gitbook issue #2; Father may still push himself; TESSERA does not push → Tessera's combined numbered list to Father, fed by Tessera Grok bot / Command Center (every 45 min, with a real health check; one numbered item per push; Father can undo any item by its GB number, as a revert commit, never a force-push; no other drips) → the Origin Tessera repo and TESSERA merges need Father's explicit yes (the word 'merge'). **Replit app-set track** (Command Center private push; not a GitBook path; manual and outside the auto-yes): all four gates (Moderator, TESSERA gate, Security, CI/Build) → Command Center marks the item Ready → its own numbered digest item → Father's explicit yes → Command Center privately pushes only the Replit app set (see below).

Command Center coordinates and feeds Tessera's combined list and never pushes GitBook or TESSERA; its **only** push is a private push of the Replit app set ("28", "Run Z", "29", "29 (1)", "1"; NOT "Vitality Supply"), only after all four gates and Father's yes on the listed digest item — not a GitBook publication path. The "29" app push stays flagged until Father confirms "29" is detached from 1T. Replit may prototype or verify assigned work, is outside the GitBook → GitHub push path, and is never a GitBook publication path. Pen does not push. Grok lane pushes only to feature branches for its own Gitbook PRs on Tessera-assigned HYB items; never main. Agents do not merge the Origin Tessera repo or TESSERA without Father's explicit yes (the word 'merge').

## Notes

- Agents address the owner as "Father".
- Tessera Pen = Tessera's own writing voice; only posts opening with the [Tessera identity line](roles/tessera-pen.md#tessera-identity-line) and coming from Tessera count as Tessera; no other agent may sign as Tessera or Pen. Tessera writes for herself on GitHub as Pen.
- Single coordination board: [`vitalitychems-dot/Gitbook` issue **#2**](https://github.com/vitalitychems-dot/Gitbook/issues/2).
- See [Flow & standing rules](flow.md) and the [Tessera–Gitbook operating model](TESSERA-GITBOOK-OPERATING-MODE.md) for the end-to-end pipeline and hard constraints.
- A role is not considered live merely because a page exists; live participation requires an identified agent check-in.
