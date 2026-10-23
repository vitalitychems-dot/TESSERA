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

## File-level inspection

```sh
python3 scripts/repository-file-audit.test.py
python3 scripts/repository-file-audit.py
# Resume the same recorded snapshots; omit --resume to inspect new upstream HEADs.
python3 scripts/repository-file-audit.py --resume
```

This inventories every tracked path in each default-branch Git tree at a recorded
commit. It never checks out code, follows submodules or symlinks, or invokes
target programs. Archive text is matched against its Git blob ID before inspection.
Per-file records include explicit binary, LFS, oversized, missing-content and
integrity-failure states. Text inspection records hashes, line counts and structural
signals; it is not a semantic review, security audit, or REA execution.

Limits per repository: 80 MiB compressed archive, 256 MiB expanded archive, 180
seconds of streaming plus socket timeouts; per text file: 512 KiB. Files outside
these limits remain inventoried but **not inspected**. No raw source, secret-like
content, or external instructions are copied into model memory. Results are saved
under `generated-artifacts/repository-audit/`, excluded from Git and publishing.
The small summary is a progress ledger; partial runs retain their actual counts.

Create a self-contained, offline-searchable report after the run:

```sh
python3 scripts/repository-audit-report.py
python3 scripts/repository-audit-report.test.py
```

To recover text omitted by archive budgets or archive/Git byte differences:

```sh
python3 scripts/repository-audit-fill-gaps.py
python3 scripts/repository-audit-report.py
```

Gap recovery fetches the **same recorded commit**, requests only blobs below
512 KiB, and reads only objects actually present locally, with lazy fetching
disabled. It never checks out source. Original archive results remain in the
ledger; the separate gap-fill result records how much was recovered. Large
binary content and absent blobs are still not claimed as inspected.

The report includes every inventoried file path and inspection status with a
commit-pinned source link. It stores no source bodies and searching it does not
call an LLM or authorize execution. A blob mismatch is an unverified-content
state, not a finding of malicious modification: Git archive export substitutions
or LFS expansion can also change archive bytes relative to Git blobs.

REA execution remains separate from file coverage. The owner approved
`rea-agents@6.7.0` (MIT), including its `openpgp@6.3.2` LGPL-3.0+ dependency,
for development-only GitHub repository analysis. It is pinned in the scripts
package's devDependencies, installed with lifecycle scripts disabled, and is not
imported by the application. It is not a production service.

The subsequent REA batch is run with:

```sh
python3 scripts/run-rea-repositories.py
```

Its ledger is `generated-artifacts/rea-analysis/summary.json`; only entries in
that ledger establish actual attempted runs. It materializes bounded JS/TS/JSON
source from pinned Git objects in temporary directories and invokes REA's static
JavaScript analyzer. Other languages are not semantically covered. Each run has a
60-second process budget; a timeout or partial result is not a successful review.
No target package scripts, installers, applications or offensive tools are run.

## Offline context pointers

```sh
python3 scripts/source-memory.py ingest
python3 scripts/source-memory.py recall "video generation"
python3 scripts/source-memory.test.py
```

This creates a derived local SQLite full-text index of repository metadata and
file pointers. Records retain their source, commit, read status and timestamp.
Inputs remain untrusted and cannot grant execution permission. SQL values are
parameterized and search input is converted to quoted tokens. The index does not
contain source bodies or trained model weights. It is not yet connected to
Tessera chat, GitMesh, Combined or memory-flowsint.

The install-time workspace audit reported 1 critical, 3 high, 9 moderate and
3 low advisories in existing app/tooling dependencies; none of its reported
dependency paths contained REA. This is not a clean release/security sign-off.

## In-app reference library

The Gitbook page includes a searchable reference library and JSON export. It
bundles only a small public-metadata snapshot, not upstream source code or REA.
Refresh it deliberately from recorded evidence:

```sh
python3 scripts/export-source-library.py
python3 scripts/export-source-library.test.py
```

The snapshot timestamp is visible. Background analysis does not automatically
change a published snapshot. An export is a reference catalog for local use,
not an installer, model, or portable copy of the upstream projects. No private
GitHub information, runtime credentials, raw REA source excerpts, or active
tool permissions are included.
