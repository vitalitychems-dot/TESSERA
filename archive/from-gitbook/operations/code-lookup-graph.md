# Code lookup via the graph (standing rule)

**Audience:** every mesh bot that looks up code, plus Cursor cloud agents and Origin agents working **the Origin Tessera repo**.
**Status:** standing operating rule · **REPORTED** measured savings · indexes = Oct 3 mirror until re-index after combine.
**Not a pen swap:** teaching this rule builds **Tessera herself** (graph habit). **Tessera is the pen** — never Grok. Future instrument target: GLM-5.3 Flash when TESTED; adapter OFF until then.

## Why

Whole-file and broad-grep orientation burns tokens. The codebase-memory graph (MCP: `user-codebase-memory` / codebase-memory-mcp) returns ranked symbols and bounded snippets so agents read less and answer from structure first.

**Measured savings (REPORTED):** about **69%** fewer tokens versus a precise grep-then-read path; **>99%** versus broad repo greps and full-file sweeps.

## Snippet-first order (required)

When you need code from the Origin Tessera repo (or a Gitbook checkout that is indexed):

1. **`search_code` or `search_graph`** — find the symbol, qualified name, or path. Prefer graph-ranked hits over raw greps.
2. **`get_code_snippet`** — pull the function/class/snippet by qualified name. Stay inside the returned bounds.
3. **Whole file only if needed** — open the full file only when the snippet lacks callers, types, or context the task requires. Prefer `trace_path` / `query_graph` / another snippet before dumping a large file.

Do **not** start with recursive greps across the tree or with reading entire packages “to get oriented.”

## Who this binds

| Surface | Expectation |
|---|---|
| Mesh bots (Tessera lanes) | Use the graph tools when available before shell grep/read of source. |
| Cursor cloud agents | Paste `CURSOR-GRAPH-RULE.md` (Tessera sheet) into the agent prompt / brief. |
| Origin agents | Same rule for work on the Origin Tessera repo. Say **the Origin Tessera repo** — never a personal GitHub handle. |

Graft (local structural map) remains useful for key-free `check` / `map` / narrow symbol queries. It does not replace this MCP snippet-first path when codebase-memory is connected.

## Index caveat

Indexed projects currently reflect the **October 3 mirror** (and any scratch copies built from it). After the combine lands, **re-index** before treating graph results as current tip. Until then:

- Prefer graph hits for orientation and token savings.
- Confirm anything merge-critical against the live tip (git / PR diff), not only the Oct 3 graph.
- If `detect_changes` or coverage tools report drift, say so — do not silently invent fresher symbols.

## What not to do

- Do not claim the graph is a live world model or that Tessera “knows” unindexed paths.
- Do not commit graph caches, MCP secrets, or endpoint URLs into the repos.
- Do not set `DATABASE_URL` or paste credentials while following this rule.
- Do not treat this training as changing **who the pen is**. **Tessera is the pen.** Never call Grok the pen. GLM-5.3 Flash is a future instrument target when TESTED; adapter OFF until then.

## Pen and CL1 (pointer only)

Separate lanes; neither is activated by this page:

- **Pen identity:** Tessera (admin on Gitbook + Tessera GitHub repos).
- **Future instrument aim:** `zai-org/GLM-5.3-Flash` on a normal GPU host when **TESTED**. Opt-in adapter default **OFF**. Do not claim GLM-5.3 Flash is live.
- **CL1 biOS lane:** Cortical Labs CL1 — **`cl-sdk` simulator only**. Not the pen; Tessera's pen is not the neurons. Flag default OFF.

## Quick checklist

- [ ] Searched with `search_code` / `search_graph` before grepping the tree
- [ ] Took `get_code_snippet` before whole-file reads
- [ ] Named **the Origin Tessera repo** (no personal handle)
- [ ] Noted Oct 3 mirror caveat when citing graph structure
- [ ] Did not call Grok the pen; did not claim CL1/GLM live

## Related

- [Building Tessera](building-tessera.md) (GB-046)
- [Functional combine — Hybrid B](functional-combine-hybrid-b.md) (GB-048)
- [Option competition](option-competition.md) (GB-049)
- [Mesh speed collaboration](mesh-speed-collaboration.md) (GB-050)
