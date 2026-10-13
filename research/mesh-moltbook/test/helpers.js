import { MeshNode } from "../src/node.js";
import { fixed, Sim } from "../src/sim.js";

export function lineWorld(labels, { range = 1.5, seed = 1, loss = 0, cfg = {} } = {}) {
  const sim = new Sim({ seed, range, loss });
  const nodes = {};
  labels.forEach((label, i) => {
    nodes[label] = new MeshNode({ label, ...cfg });
    sim.add(nodes[label], fixed(i));
  });
  return { sim, nodes };
}
