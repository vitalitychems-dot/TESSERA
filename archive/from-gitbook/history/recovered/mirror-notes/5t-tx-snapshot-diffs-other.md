
## .agents/memory/MEMORY.md
Base: 5t/TESS `03ced1cdf4` → Variant: T44 `42ac02d932`
--- 5t/TESS/.agents/memory/MEMORY.md
+++ T44/.agents/memory/MEMORY.md
@@ -1 +1 @@
-- [Outbound knowledge sources](outbound-knowledge-sources.md) — Keep generic knowledge fetching limited to fixed, credential-free sources; new hosts require explicit approval.+- [Tessera agent identity](agent-identity-boundary.md) — Tessera acts under its own identity and never impersonates the operator.

## .gitignore
Base: 5t/TESS/1 `c3cf007d8f` → Variant: 1T/T44 `5a745b86bc`
--- 5t/TESS/1/.gitignore
+++ 1T/T44/.gitignore
@@ -60,5 +60,3 @@
 attached_assets/Pasted-*.txt
 artifacts/api-server/.data/income-snapshots.json
 _evolutions/
-artifacts/api-server/.local-data/natal-vault.json
-artifacts/api-server/data/council-ledger.jsonl
