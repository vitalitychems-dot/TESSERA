# Deep REA Registry — Mention Graph (2026-10-07, second pass)
Extends posts/2026-10-07-rea-registry.md. Method: bounded read-only scan, up to 40 prioritized text files (README/docs/logs/manifests) per repo, ~1.7 MB total. Pattern extraction only: repo mentions, tool names, dependency names. No file content reproduced.

## Per-repo coverage
| Repo | Files scanned | Volume | Deps | External repos mentioned | Top tools |
|---|---|---|---|---|---|
| 1 | 12 | 31 KB | 109 | 0 | grok, pnpm |
| 1T | 40 | 174 KB | 0 | 2 | openai, anthropic, react, claude, pnpm, vercel, grok, gemini |
| 5t | 40 | 365 KB | 0 | 2 | openai, anthropic, react, claude, pnpm, vercel, grok, express |
| Gitbook | 40 | 138 KB | 0 | 19 | pnpm, grok, express, react, vite, tailwind, npm, vercel |
| Grok-ready | 40 | 330 KB | 60 | 20 | openai, anthropic, react, claude, pnpm, vercel, grok, express |
| olive-giant-ever-glade | 40 | 246 KB | 0 | 20 | vercel, react, tailwind, grok, mcp, playwright, npm, postgres |
| T44 | 40 | 180 KB | 0 | 2 | openai, anthropic, react, claude, pnpm, vercel, grok, gemini |
| TESS | 40 | 193 KB | 0 | 2 | openai, anthropic, react, claude, pnpm, vercel, gemini, grok |
| TESSERA | 40 | 260 KB | 0 | 20 | openai, anthropic, react, claude, pnpm, vercel, mcp, grok |
| tessera-complete-archives | 2 | 4 KB | 0 | 0 | grok |
| tessera-grok-handoff | 2 | 12 KB | 0 | 0 | grok |
| tessera-grok-handoff-complete | 8 | 24 KB | 0 | 0 | grok |
| Zz | 40 | 24 KB | 0 | 2 | pnpm, react, grok, claude, openai, vllm, sdk, vite |

## External repos referenced across the org (43 unique)
- better-auth/better-auth
- browser-use/browser-use
- Panniantong/Agent-Reach
- JuliusBrussee/caveman
- obra/superpowers
- mksglu/context-mode
- colbymchenry/codegraph
- NVIDIA/OpenShell
- heygen-com/hyperframes
- mvschwarz/openrig
- replit/replit-cursor-plugin
- TheTesseractAI/18
- enricoros/big-AGI
- Steake/GodelOS
- Sairamg18814/shvayambhu
- rohansx/agidb
- OpenCausaLab/Awesome-LLM-Consciousness
- collink1007/z
- collink1007/XXX
- collink1007/amber-flame-tiger-sand
- collink1007/fleet-moss-monarch-rapid
- 269652/artificial-consciousness-ai
- 269652/artificial-consciousness-blueprint
- androoAGI/starnet
- BrainCog-X/Brain-Cog
- cognitivecomputations/agi-memory
- EfekanSalman/NeuroConscious
- facebookresearch/tribev2
- future-agi/future-agi
- FutureAIGuru/BrainSimII
- hyperspaceai/agi
- jbhinky/Theophilus-UDC
- open-jarvis/OpenJarvis
- QuixiAI/Hexis
- screenpipe/screenpipe
- siddhant-rajhans/cortexlab
- NateTheGreatt/bitECS
- hmans/miniplex
- SanderMertens/ecs-faq
- pmndrs/drei
- pmndrs/react-three-rapier
- zai-org/GLM-5
- Cortical-Labs/cl-sdk

Clusters: AGI/consciousness research (big-AGI, GodelOS, agidb, Awesome-LLM-Consciousness, Brain-Cog, NeuroConscious, Theophilus-UDC, tribev2, BrainSimII, Hexis, cortexlab), agent tooling (Agent-Reach, superpowers, codegraph, context-mode, NVIDIA/OpenShell, openrig, browser-use, better-auth), 3D/ECS (bitECS, miniplex, pmndrs/drei, react-three-rapier), model/runtime (zai-org/GLM-5, Cortical-Labs/cl-sdk, ollama, vllm).

## Tool surface across all repos (29 unique)
anthropic, claude, clerk, docker, express, fastapi, gemini, grok, kubernetes, mcp, mongodb, npm, oauth, ollama, openai, pip, playwright, pnpm, postgres, react, rest, sdk, sqlite, tailwind, transformers, vercel, vite, vllm, websocket

Sovereignty flags for cleanup planning:
- Hosted-provider references (openai, anthropic, claude, gemini, grok) appear in 13 repos' docs/manifests. Policy: local-first, one owner-approved GLM endpoint; hosted references should be documentation-only or removed.
- Local-inference tooling (ollama, vllm) is already referenced — aligned with the sovereign direction.
- Repo "1" package.json still lists the hosted openai dependency; the local workspace removed it (PR #15 scope) and canonical reconciliation is pending.

## Limits
Text files only (binary excluded); ≤40 files/repo; ≤150 KB/file; mentions from URL patterns (false positives possible); Git history not scanned. 1T scanned under the 2026-10-07 owner authorization, pattern-only.
