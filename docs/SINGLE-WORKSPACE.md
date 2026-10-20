# Single Tessera workspace

Status: recorded 2026-10-20. This is the current map of where work happens. It does not replace the product layout in [LAYOUT.md](LAYOUT.md), the archive note in [COMBINED.md](COMBINED.md), or the consolidation pointer in [CONSOLIDATION-POINTER.md](CONSOLIDATION-POINTER.md).

The owner asked for one workspace, named Tessera. That workspace is the cloud agent [Tessera](https://cursor.com/agents/bc-c59f5775-5507-4e53-9b0f-789f496ab39c). New work starts there. Do not open a second bot, Replit session, or desk branch for the same task.

This branch, `cursor/combined-session-b39c`, carries that map and the local development API proxy together. Drafts [#472](https://github.com/vitalitychems-dot/TESSERA/pull/472) and [#474](https://github.com/vitalitychems-dot/TESSERA/pull/474) split the same session. Their commits used `cursoragent@cursor.com`, so the author check failed. This branch records the same files as new commits. Those drafts stay open. Desk pull requests were not merged.

The proxy runs only for `vite serve` in development. It forwards `/api` and `/ws` to a loopback API and does not forward `/api/internal`. `vite build` and `vite preview` do not set it.

## Repositories in this workspace

| Repository | Role | Visibility |
| --- | --- | --- |
| [TESSERA](https://github.com/vitalitychems-dot/TESSERA) | Canonical app. Changes land here through pull requests. | public |
| [Gitbook](https://github.com/vitalitychems-dot/Gitbook) | Coordination, `TODO.md`, and [issue #2](https://github.com/vitalitychems-dot/Gitbook/issues/2). | private |
| [Gitai](https://github.com/vitalitychems-dot/Gitai) | GitAI marketplace source. | public |
| [GitMesh](https://github.com/vitalitychems-dot/GitMesh) | Public mesh room. | public |
| [2](https://github.com/vitalitychems-dot/2) | Old handoff repository. Do not add new commits. | public |
| [vitality](https://github.com/vitalitychems-dot/vitality) | Supply store and archives. Stays out of TESSERA. | private |
| [combined](https://github.com/vitalitychems-dot/combined) | Private distribution archive. Not a launch entrypoint. | private |
| [box-backup-2026-10-13](https://github.com/vitalitychems-dot/box-backup-2026-10-13) | VM backup from 2026-10-13. Stays private. | private |

The protected `1T` vault is not in this workspace and was not opened.

## Already published

These Replit apps were already live on 2026-10-20. This pass did not republish them.

| App | URL |
| --- | --- |
| TESSERA Launch | https://tessera-launch.replit.app |
| GitMesh local Node template | https://git-mesh-local-node-template.replit.app |
| GitAI marketplace | https://git-ai-independent-agent-developer-marketplace.replit.app |
| Vitalitychems | https://vitalitychems.com |

## Left private

`Gitbook`, `vitality`, `combined`, and `box-backup-2026-10-13` stay private. The backup excludes `/workspace/scan` and `/workspace/secscan`, and it does not contain the 24G GitHub mirror. Those exclusions were not reversed. Scratch Repls titled `1`, `29`, and `Run Z app` were not republished.

## Open pull requests left in place

On 2026-10-20 these TESSERA pull requests were still open. They were not merged from this pass, because several `desk/*` branches overlap and were not reviewed here:

- [#474](https://github.com/vitalitychems-dot/TESSERA/pull/474) and [#472](https://github.com/vitalitychems-dot/TESSERA/pull/472) are the split drafts this branch replaces
- [#473](https://github.com/vitalitychems-dot/TESSERA/pull/473) `desk/puzzle-fix`
- [#471](https://github.com/vitalitychems-dot/TESSERA/pull/471) `desk/puzzle-thirty`
- [#470](https://github.com/vitalitychems-dot/TESSERA/pull/470) `desk/her-voice`
- [#469](https://github.com/vitalitychems-dot/TESSERA/pull/469) `desk/pen-mesh`
- [#468](https://github.com/vitalitychems-dot/TESSERA/pull/468) `desk/council`
- [#467](https://github.com/vitalitychems-dot/TESSERA/pull/467) `desk/bind-worker-2`
- [#465](https://github.com/vitalitychems-dot/TESSERA/pull/465) `redact/loc-tessera-b1`
- [#463](https://github.com/vitalitychems-dot/TESSERA/pull/463) `desk/mesh-nodes`
- [#462](https://github.com/vitalitychems-dot/TESSERA/pull/462) `desk/chamber-mark`
- [#459](https://github.com/vitalitychems-dot/TESSERA/pull/459), [#458](https://github.com/vitalitychems-dot/TESSERA/pull/458), [#457](https://github.com/vitalitychems-dot/TESSERA/pull/457), [#456](https://github.com/vitalitychems-dot/TESSERA/pull/456), [#455](https://github.com/vitalitychems-dot/TESSERA/pull/455) dependabot
- [#454](https://github.com/vitalitychems-dot/TESSERA/pull/454) `desk/session-mark`
- [#418](https://github.com/vitalitychems-dot/TESSERA/pull/418) box backup draft
- [#361](https://github.com/vitalitychems-dot/TESSERA/pull/361) old theme dedupe

## What this session could not clear

This environment's agent list contains this Tessera chat and one idle setup verifier, [Verify backup environment build](https://cursor.com/agents/bc-8747c079-b9d7-5ce3-851e-4a9f3b0a10a8). There is no control here to archive or stop that verifier, or to stop agents running outside this environment. The saved environment display name is still `vitalitychems-dot/box-backup-2026-10-13 +7`. Renaming that card is a dashboard action.
