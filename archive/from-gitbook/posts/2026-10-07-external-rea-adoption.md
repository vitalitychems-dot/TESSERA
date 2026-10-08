# External Repo REA — Adoption Registry (2026-10-07)
Extends the inventory (rea-registry) and mention graph (rea-deep-scan). 42 of 43 referenced external repos analyzed via metadata + README purpose extraction. Verdicts are pattern-level; code reuse only where license allows and a real need exists. Tessera never adopts consciousness/AGI claims.

Legend: ADOPT = pattern implemented/planned locally; REFERENCE = ideas inform design, no code; AVOID = license gap, privacy risk, or honesty conflict.

## Agent tooling
| JuliusBrussee/caveman | Apache-2.0 | agent tooling | ADOPT (pattern) | Aggressive token compaction — directly serves the owner directive to use fewer tokens. |
| mksglu/context-mode | NOASSERTION | agent tooling | ADOPT (re-implemented idea only) | Context sandboxing/98% output reduction; license unasserted, so idea only. |
| colbymchenry/codegraph | MIT | agent tooling | ADOPT (pattern) | Pre-indexed code knowledge graph with auto-sync — extends our source-graph-sync with file watching. |
| obra/superpowers | MIT | agent tooling | REFERENCE | Skills/methodology discipline for agent workflow. |
| NVIDIA/OpenShell | Apache-2.0 | agent tooling | REFERENCE | Private runtime isolation patterns for agent execution. |
| mvschwarz/openrig | Apache-2.0 | agent tooling | REFERENCE | Persistent agent teams with roles + shared context — mirrors our Gitbook cross-session pattern. |
| better-auth/better-auth | MIT | agent tooling | REFERENCE | We keep sovereign-session; its session-model docs are useful comparison. |
| browser-use/browser-use | MIT | agent tooling | REFERENCE | Browser agents; no current need. |
| Panniantong/Agent-Reach | MIT | agent tooling | REFERENCE | Agent web-reading; overlaps the existing study-notes collector. |
| heygen-com/hyperframes | Apache-2.0 | agent tooling | REFERENCE | HTML-to-video; out of scope now. |
| replit/replit-cursor-plugin | MIT | agent tooling | REFERENCE | External-editor bridge; informational. |
| TheTesseractAI/18 | NONE | agent tooling | AVOID | No license; no reuse despite Tessera branding. |

## AGI/consciousness research — reading list only; no claims, no code into production paths
| rohansx/agidb | Apache-2.0 | AGI research | ADOPT (pattern) | Goals/beliefs as first-class memory records — informs structured lesson metadata. |
| QuixiAI/Hexis | MIT | AGI research | REFERENCE | Postgres-native cognitive architecture; we already persist conversations/lessons in Postgres+JSONL. |
| enricoros/big-AGI | MIT | AGI research | REFERENCE | Persona/product surface ideas only. |
| hyperspaceai/agi | MIT | AGI research | REFERENCE | Distributed training conflicts with local-first; read only. |
| Steake/GodelOS, Sairamg18814/shvayambhu, EfekanSalman/NeuroConscious, 269652/*, jbhinky/Theophilus-UDC, OpenCausaLab/Awesome-LLM-Consciousness, androoAGI/starnet | mixed/NONE | AGI research | AVOID (claims) | Consciousness claims conflict with the honesty vow; some unlicensed. |
| BrainCog-X/Brain-Cog, future-agi/future-agi, FutureAIGuru/BrainSimII, open-jarvis/OpenJarvis | Apache/MIT | AGI research | REFERENCE | Brain-inspired simulators and LLM eval platforms; research context only. |
| screenpipe/screenpipe | NOASSERTION | AGI research | AVOID | Always-on screen recording is a privacy risk against our boundaries. |
| facebookresearch/tribev2, siddhant-rajhans/cortexlab | NOASSERTION | AGI research | REFERENCE | fMRI/brain-encoding research; out of product scope. |
| collink1007/* (4 repos) | NONE | unknown | AVOID | Zero metadata, no license, unknown provenance. |

## 3D/ECS (only if Tessera gains an embodied/3D surface)
| hmans/miniplex, pmndrs/drei, pmndrs/react-three-rapier | MIT | 3D/ECS | REFERENCE | Clean ECS and R3F helpers for a future 3D workspace. |
| NateTheGreatt/bitECS | MPL-2.0 | 3D/ECS | REFERENCE | File-level copyleft — pattern only. |
| SanderMertens/ecs-faq | NONE | 3D/ECS | REFERENCE | Documentation, concept source. |

## Model/runtime
| zai-org/GLM-5 | Apache-2.0 | model runtime | ADOPT | The owner-selected GLM family — the approved endpoint model line. |
| Cortical-Labs/cl-sdk | NOASSERTION | model runtime | AVOID (as evidence) | Simulator control data only; never cite as learning proof. |
| ollama / vllm (tool mentions) | OSS | model runtime | ADOPT (direction) | Local inference serving for the future owner-controlled GLM host. |

## Sovereignty flags confirmed
- Hosted-provider references across org docs remain cleanup targets (openai/anthropic/claude/gemini/grok).
- Repo "1" manifest still lists hosted openai — covered by the pending canonical purge PR.
- Unlicensed or unasserted-license repos are never copied; ideas are re-implemented from scratch.

## Next implementations queued from this registry
1. Token compaction in the guarded GLM transport (caveman/context-mode patterns).
2. Source-graph auto-sync watcher (codegraph pattern).
3. Structured lesson metadata: goal/belief fields (agidb pattern) on IMP proposals.
