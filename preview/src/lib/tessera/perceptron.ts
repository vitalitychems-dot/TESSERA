export function perceptron(inputs: number[], weights: number[], threshold: number) {
  const n = Math.min(inputs.length, weights.length);
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += inputs[i] * weights[i];
  return { sum, fired: sum >= threshold };
}

export type MeshNode = { id: number; name: string; x: number; y: number };
export type MeshEdge = [number, number];

/** A slab of points. Named regions sit on the first points. The rest are links, not hidden units. */
export function brainMesh(names: string[], cols = 10, rows = 8) {
  const nodes: MeshNode[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const id = y * cols + x;
      const z = ((x * 3 + y * 5) % 7) / 7;
      nodes.push({
        id,
        name: names[id] ?? "",
        x: 6 + x * 9 + z * 5,
        y: 8 + y * 11 - z * 7,
      });
    }
  }
  const edges: MeshEdge[] = [];
  for (const node of nodes) {
    const col = node.id % cols;
    if (col < cols - 1) edges.push([node.id, node.id + 1]);
    if (node.id + cols < nodes.length) edges.push([node.id, node.id + cols]);
    if (col < cols - 1 && node.id + cols + 1 < nodes.length && node.id % 3 === 0) edges.push([node.id, node.id + cols + 1]);
  }
  return { nodes, edges, named: nodes.filter((node) => node.name).length };
}
