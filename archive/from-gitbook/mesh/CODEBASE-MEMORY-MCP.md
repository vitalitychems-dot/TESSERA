# Codebase Memory MCP bridge

**Status:** installed and indexed locally; bridge design ready for agent use  
**Version:** `codebase-memory-mcp 0.11.0`  
**Purpose:** structural code navigation for agents, not a replacement for Tessera memory, provenance, or brain/state modules

## What was installed

The official MIT-licensed `DeusData/codebase-memory-mcp` package was installed locally through npm:

```bash
npm install -g codebase-memory-mcp@0.11.0
codebase-memory-mcp --version
```

The server is local-only. It reads the selected checkout and stores its graph under the local CBM cache. It does not send Tessera memory to an external model and it does not edit product code by itself.

## Indexed destinations

| Project | Graph result | Persistent artifact |
|---|---:|---|
| `TESSERA` | 20,742 nodes / 54,278 edges | `TESSERA/.codebase-memory/graph.db.zst` |
| `Gitbook` | 1,236 nodes / 1,361 edges | `Gitbook/.codebase-memory/graph.db.zst` |

TESSERA indexing reported 58 partial parses and 16 intentionally excluded/ignored files; no files were unusable. Gitbook indexed without partial or unusable files. These are index diagnostics, not claims that every source file is semantically understood.

Refresh both graphs after a reviewed destination commit:

```bash
for repo in TESSERA Gitbook; do
  codebase-memory-mcp cli --json index_repository \
    "{\"repo_path\":\"/home/ubuntu/tessera-consolidation/published/$repo\",\"persistence\":true}"
done
codebase-memory-mcp cli --json list_projects
```

The persistent artifact is a derived structural index. Commit it only when the corresponding destination commit is the reviewed base; never commit local runtime stores, credentials, protected-vault content, or generated application data.

## Separation of responsibilities

| Layer | Owns | Must not do |
|---|---|---|
| Codebase Memory MCP | Files, symbols, calls, routes, architecture, impact and structural search | Decide product truth, modify code, infer consciousness, or replace durable memory |
| Tessera retrieval memory | Redacted interaction records, lessons, evidence IDs, BM25 context, IMP proposals | Treat graph output as an approved lesson or model training |
| Tessera vector/decision memory | Embeddings, decisions, system state, canonical IDs, audit context | Import unreviewed historical code or private runtime data |
| Dual brain / research lane | Explicit, testable questions and proposals | Claim biological equivalence, consciousness, or autonomous authority |
| Gitbook | Provenance, backlog, check-ins, forum, review and owner digest | Auto-merge or auto-publish product changes |

## Safe bridge flow

1. An agent uses CBM to locate a structural fact in a named repository and records the project, query, and result path.
2. The agent writes a short evidence note in Gitbook with source commit, exact path, and limitations.
3. Tessera's memory module may store a **redacted summary** as a lesson or decision, with the CBM query and Gitbook note as evidence.
4. A repeated gap may become an IMP proposal, but proposals are not code changes.
5. A code change requires one claimed backlog task, a scoped branch/PR, tests, security/privacy review, Build verification, and the owner's exact bulk approval.
6. After publication, refresh the graph artifacts and record the new destination commit.

Example structural queries:

```bash
codebase-memory-mcp cli --json get_architecture \
  '{"project":"home-ubuntu-tessera-consolidation-published-TESSERA","aspects":["all"]}'
codebase-memory-mcp cli --json search_graph \
  '{"project":"home-ubuntu-tessera-consolidation-published-TESSERA","name_pattern":".*memory.*"}'
```

## Human-in-the-loop gates

CBM is an inspection aid. It does not grant authority. Agents must still pass:

1. Gitbook Moderator — scope, provenance, license, privacy, and claim review.
2. Tessera admin — product fit and identity-boundary review.
3. Security — read-only security and secret sweep.
4. Build — independent tests and verification.
5. Human owner — exact 30–45 minute bulk digest response (`yes`, `no`, or `revise`).

A `yes` applies only to the listed paths and commits. No unattended watcher, CBM result, model response, or agent message may expand that approval.

## Known limitations and follow-ups

- The TESSERA graph has best-effort partial parses; agents must corroborate important claims with source and tests.
- The current bridge is intentionally out-of-process and non-invasive. A future API adapter is a separate task and must preserve the same evidence and approval contract.
- Do not enable automatic code mutation or treat graph artifacts as training data.
- Add a refresh/check command to the historical merge gate under HYB-014 only after its owner claims that task.
