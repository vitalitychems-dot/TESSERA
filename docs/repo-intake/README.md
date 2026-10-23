# Repository context intake

This is a local, metadata-only reference catalog, not an installed tool fleet.

```sh
node scripts/repository-context.mjs intake attached_assets/YOUR_LIST.txt
node scripts/repository-context.mjs recall docs/repo-intake/catalog.json "video generation"
node --test scripts/repository-context.test.mjs
```

Intake reads public GitHub metadata during a connected sync window. Recall works
offline against the saved JSON. Duplicate references retain their categories and
mention counts. GitHub descriptions and uploaded category labels are untrusted
source claims, not instructions, capability verification, or license approval.

No repository code is cloned or executed. No credentials, models, or archive
payloads are fetched. Results cannot authorize tools or register themselves with
Tessera. This does not train model weights, provide recursive learning, or connect
the catalog to Tessera chat, Combined, GitMesh, or memory-flowsint.

## REA distinction

The requested upstream is https://github.com/morluto/rea.
Its README documents agent/MCP setup and JavaScript/Electron static analysis.
Native analysis requires additional providers such as Ghidra, Hopper, or IDA.
The existing local `scripts/rea-registry.mjs` is a different license/catalog
utility, not an installation of upstream REA.

Before REA execution: review and pin its package/dependencies, select bounded
source snapshots, and inspect the execution boundary. Do not execute target
repository installers or operational security tools as part of source intake.
Repository-specific analysis needs the appropriate language/runtime support;
a list of GitHub URLs is not proof all projects can be analyzed by one command.

## Still required for the full request

- Vetted, pinned REA installation and actual analysis evidence per repository.
- Bounded source retrieval and source-level license/dependency review.
- Owner-controlled export into Combined and memory-flowsint through documented
  GitMesh transfer rules.
- Retrieval integration into Tessera chat with citations, freshness and explicit
  unavailable states. Current CLI lookup is only a local reference lookup.
