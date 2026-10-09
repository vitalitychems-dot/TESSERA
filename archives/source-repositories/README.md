# Historical source repository archive

This directory is a **provenance archive**, not an active application module.

- Active product code remains under the reviewed TESSERA workspace.
- Historical files are namespaced by source repository and are not imported into runtime, build, or dependency graphs.
- Files were copied only when they were UTF-8 portable source/configuration, not path-blocked, not over 2 MiB, and not matched by the secret-pattern quarantine.
- Exact duplicate content already present in TESSERA or Gitbook was not copied.
- Protected `1T` was not opened, indexed, copied, or deleted.
- Binary media, generated output, runtime state, local stores, and chunked archives remain at their source repositories and are tracked by the Gitbook coverage/deletion records.
- Any future promotion from this archive requires a new scoped BC/HYB task, provenance, license/privacy review, deterministic test, rollback, and the normal approval gates.

The machine-readable copy result is [SOURCE-CODE-MOVE-MANIFEST-2026-10-07.json](../../docs/migration-review/SOURCE-CODE-MOVE-MANIFEST-2026-10-07.json).
