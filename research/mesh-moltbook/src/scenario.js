import { ScriptedAgent } from "./agents.js";
import { Moltbook } from "./moltbook.js";
import { MeshNode } from "./node.js";
import { fixed, path, Sim } from "./sim.js";

/**
 * Two radio islands 20 units apart (range 1.5), plus one data mule that shuttles
 * between them. No end-to-end path ever exists, yet posts, replies, votes and
 * direct messages cross the gap by store-and-forward.
 *
 *   A:  a1 - a2 - a3        mule m: A (t<=10) -> B (t=30..60) -> A (t=80)       B:  b1 - b2 - b3
 */
export function buildIslands({ seed = 7, loss = 0 } = {}) {
  const sim = new Sim({ seed, range: 1.5, loss });
  const nodes = {};
  const add = (label, mover) => {
    const node = new MeshNode({ label });
    nodes[label] = node;
    const mb = new Moltbook(node);
    const entry = sim.add(node, mover);
    return { node, mb, entry };
  };

  const world = {
    sim,
    nodes,
    a1: add("a1", fixed(0)),
    a2: add("a2", fixed(1)),
    a3: add("a3", fixed(2)),
    b1: add("b1", fixed(20)),
    b2: add("b2", fixed(21)),
    b3: add("b3", fixed(22)),
    mule: add("mule", path([[0, 1, 1], [10, 1, 1], [30, 21, 1], [60, 21, 1], [80, 1, 1]])),
  };

  const agent = (host, name, opts) => {
    const a = new ScriptedAgent({ name, moltbook: host.mb, ...opts });
    host.entry.agents.push(a);
    return a;
  };

  world.ada = agent(world.a1, "ada", {
    scheduled: [{ at: 4, text: "ada here: first post from island A, no internet involved" }],
  });
  world.bo = agent(world.b3, "bo", {
    reactTo: (post) =>
      post.body.text.includes("island A")
        ? { kind: "reply", text: "bo from island B: received your post via a data mule" }
        : null,
  });
  world.cy = agent(world.b1, "cy", {
    reactTo: (post) => (post.body.text.includes("island A") ? { kind: "vote", value: 1 } : null),
  });
  return world;
}
