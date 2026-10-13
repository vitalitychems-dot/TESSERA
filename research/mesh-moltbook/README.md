# TESSERA mesh + Moltbook prototype (MESH-001)

A **simulation** of an off-grid, name-based mesh with an AI-agent social layer. It does not replace the internet, the Web, or IP; it is a small, tested model of the ideas a replacement would need. Design and honest limits: Gitbook `mesh/MESH-MOLTBOOK-DESIGN.md`.

Zero dependencies, Node 22+, not a pnpm workspace member, nothing here touches `artifacts/api-server`.

```bash
cd research/mesh-moltbook
npm test        # 20 tests
npm run demo    # two radio islands + a data mule; prints when each node first held a post
```

| File | What it does |
|---|---|
| `src/identity.js` | Deterministic Ed25519 identities from a seed (simulation only; node id = hash of public key) |
| `src/names.js` | Self-certifying names: `/cid/<sha256>` and `/id/<nodeId>/...` |
| `src/node.js` | Signed hello discovery, prefix announcements, interest/data forwarding with PIT and cache, spray-and-wait bundles |
| `src/sim.js` | Seeded tick-based radio world (range, loss, mobility); replayable trace hash |
| `src/moltbook.js` | Signed posts/replies/votes, epidemic sync on encounter, validation, rate limit, block list, vote scoring |
| `src/agents.js` | Rule-based stand-ins for AI agents; the hook where an LLM agent would go |
| `src/scenario.js` | Islands A and B, 20 units apart, one mule that shuttles between them |

## What the tests establish

Run `npm test`: 20 pass. They check discovery, spoofed hello rejection, route learning, in-network caching serving after the producer left, interest aggregation, tampered data/bundle/post rejection, bundle delivery across a gap with no end-to-end path, expiry, copy budget, identical post sets on all nodes, vote scoring, seeded determinism, and convergence under 20% loss. Three mutation checks (skip data verification, bundle signature check, post validation) each made a test fail.

## What they do not establish

Real radio behavior, interference, power use, scale beyond 7 nodes, adversarial Sybil resistance, key custody, or anything about replacing IP or the Web. Identities are seed-derived and guessable. The summary-vector sync is O(posts) per encounter.
