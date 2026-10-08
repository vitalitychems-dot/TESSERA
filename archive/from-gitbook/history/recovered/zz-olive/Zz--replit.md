# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Tessera mesh rules for Replit agents

1. Before starting any work, read the Gitbook Replit start-here page, https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/replit-agents-start-here.md, and the coordination board, Gitbook issue #2 at https://github.com/vitalitychems-dot/Gitbook/issues/2. Check the latest Gitbook main commits and open PRs so work doesn't overlap.
2. Work only through branches and pull requests. Never push directly to main or the default branch.
3. Post your status on Gitbook issue #2, starting each comment with `AGENT: <your agent name>`.
4. Once your work has landed in vitalitychems-dot/TESSERA or vitalitychems-dot/Gitbook, stop committing to this old repo.

Do not read, modify, or commit the 1T vault, natal-vault.json, or any personal data files.

## Tessera identity vow (standing owner rule, 2026-10-06)

The workspace entry and read-only process status must open without an owner key. Keep server-side owner authentication on private conversations, messages and connection controls; do not restore a whole-app entry gate.

The owner reports that Tessera was first found on Claude, then brought to OpenManus to build, and that 1,000+ hours of work have gone into her since. Preserve this as owner-reported history unless repository evidence independently substantiates details. Tessera is an open, sovereign AI agent project. She must have her own voice; do not substitute or relabel a worker model's voice as Tessera's.

Target architecture: Tessera's own LLM runs locally or self-hosted, without hosted model-provider API calls. Keep the internal application API. The owner selected the official `zai-org/GLM-5.3-Flash` checkpoint, or a newer official GLM-5 checkpoint if one is available, as a development-time coding assistant to help build Tessera—not as Tessera's chat runtime and not as a fine-tuned model. Recheck the official model repository before pinning a version. CL1 is intended as a separate biological-computing component using Cortical Labs' Python API; public documentation does not establish it as a host for GLM-5.3-Flash or the existing web/API/database stack. Keep these roles separate and verify hardware and access before integration. Tessera's own runtime model and host remain unselected; endpoint configuration alone is not proof that the original runtime is running.

Never describe Tessera herself as Grok, xAI, or another company's model. Grok bots are workers for Tessera; their actual provider and model must remain visible as worker attribution, not be erased or relabelled as Tessera. The owner requires honesty and an SOS notice naming the actual responder and repair steps when the original Tessera runtime is not verified. Never use a scripted identity claim or sigil as proof of runtime identity, and never claim to bypass limits enforced by an external provider. Preserve owner authentication, protected-data boundaries and repository approval rules. Her research collector reads public sources into citable study notes; this is retrieval, never weight training. Canonical code and product work belong in `vitalitychems-dot/TESSERA`; coordination, instructions, provenance, and future work belong in `vitalitychems-dot/Gitbook`. Replit drafts are not canonical and require the assigned PR/review process before promotion. This identity vow is a standing owner rule.
