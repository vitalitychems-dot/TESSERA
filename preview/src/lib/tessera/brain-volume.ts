export type BrainPart = "region" | "step" | "memory" | "link";

export type VolumeNode = {
  id: number;
  name: string;
  part: BrainPart;
  x: number;
  y: number;
  z: number;
  born: number;
};

const COLS = 12;
const ROWS = 8;
const LAYERS = 4;

export function brainVolume(named: { name: string; part: Exclude<BrainPart, "link"> }[]) {
  const nodes: VolumeNode[] = [];
  let id = 0;
  for (let z = 0; z < LAYERS; z += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const item = named[id];
        nodes.push({
          id,
          name: item?.name ?? "",
          part: item?.part ?? "link",
          x: x - (COLS - 1) / 2,
          y: (ROWS - 1) / 2 - y,
          z: z - (LAYERS - 1) / 2,
          born: id / (COLS * ROWS * LAYERS),
        });
        id += 1;
      }
    }
  }
  const at = (x: number, y: number, z: number) => z * ROWS * COLS + y * COLS + x;
  const edges: [number, number][] = [];
  for (let z = 0; z < LAYERS; z += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const node = at(x, y, z);
        if (x + 1 < COLS) edges.push([node, at(x + 1, y, z)]);
        if (y + 1 < ROWS) edges.push([node, at(x, y + 1, z)]);
        if (z + 1 < LAYERS) edges.push([node, at(x, y, z + 1)]);
      }
    }
  }
  return { nodes, edges };
}

export function grown(nodes: VolumeNode[], growth: number) {
  return nodes.filter((node) => node.born <= growth);
}

/** Yaw, pitch, and zoom. The fourth axis is growth, not a hidden unit. */
export function projectPoint(node: VolumeNode, yaw: number, pitch: number, zoom: number) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const x1 = node.x * cy - node.z * sy;
  const z1 = node.x * sy + node.z * cy;
  const y1 = node.y * cx - z1 * sx;
  const z2 = node.y * sx + z1 * cx;
  const depth = 6 + z2;
  const scale = (zoom * 18) / depth;
  return { x: x1 * scale, y: y1 * scale, depth };
}
