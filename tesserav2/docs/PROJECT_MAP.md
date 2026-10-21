# Project map

This is a pnpm monorepo with one root lockfile and a root supervisor (`pnpm dev`) for the active apps. Root `pnpm test`, `pnpm run typecheck`, and `pnpm run build` are workspace-wide operations. Authentication, databases, checkout, and deployment settings stay app-specific; this repository does not merge customer or session data.

| Project | Source / location | Run entry |
| --- | --- | --- |
| Tessera API | `artifacts/api-server` | Started by `pnpm dev` only for a loopback `DATABASE_URL`; or `pnpm --filter @workspace/api-server run dev` |
| Tessera web | `artifacts/tessera` | `pnpm dev` or `pnpm --filter @workspace/tessera run dev` |
| UI preview sandbox | `artifacts/mockup-sandbox` | `pnpm dev` or `pnpm --filter @workspace/mockup-sandbox run dev` |

Shared packages live under `lib/`. Identical media, SQL migrations, UI primitives, and a small set of archive/legacy shared paths (older storefront utility copies, not a live storefront app) use canonical tracked paths where app path semantics permit; see `Gitbook: merge/redundancy-ledger.csv` for hash-level dispositions and intentional retained duplicates. Archived alternatives under `archives/` are not active workspace packages unless explicitly added to a workspace manifest. The Applications table above is the live set: Tessera API, Tessera web, and the UI preview sandbox.
