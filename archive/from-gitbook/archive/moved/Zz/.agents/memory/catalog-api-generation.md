---
name: Catalog-aware API generation
description: Non-obvious Orval version detection and barrel-export behavior with this workspace's pnpm catalogs.
---

Specify the intended Zod and React Query major versions explicitly in API
generation; do not rely on automatic package-version detection with catalog
dependencies. Keep hand-maintained package barrels separate from generated
barrels when inferred schema types and generic model types share names.

**Why:** With catalog metadata, Orval generated Zod 4 integer helpers against
Zod 3 and React Query 4 option types for a React Query 5 client. Regeneration
also appended a generic-types barrel export that duplicated an inferred body
type. These were generation/configuration problems, not API-schema errors.

**How to apply:** Recheck the explicit generator versions after intentional
library upgrades. Do not repair generated output by hand or remove the barrel
controls during regeneration.
