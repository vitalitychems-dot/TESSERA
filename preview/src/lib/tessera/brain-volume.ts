export type BrainPart = "region" | "chorus" | "law" | "tone" | "step" | "memory" | "council" | "domain";

export type VolumeNode = {
  id: number;
  name: string;
  part: BrainPart;
  x: number;
  y: number;
  z: number;
  born: number;
};

const SHELL: Record<BrainPart, { r: number; z: number }> = {
  region: { r: 4.4, z: 0 },
  chorus: { r: 6.6, z: 1.8 },
  law: { r: 5.4, z: -1.6 },
  tone: { r: 3.1, z: 1.3 },
  step: { r: 2.2, z: -0.9 },
  memory: { r: 1.35, z: 0.5 },
  council: { r: 5.8, z: 2.6 },
  domain: { r: 7.4, z: -2.4 },
};

const ORDER: BrainPart[] = ["region", "chorus", "law", "tone", "step", "memory", "council", "domain"];

/** Every point is a named part. Tessera sits at the center. Blank filler points are not added. */
export function brainVolume(named: { name: string; part: BrainPart }[]) {
  const nodes: VolumeNode[] = [];
  const tessera = named.find((item) => item.name === "Tessera");
  if (tessera) nodes.push({ id: 0, name: "Tessera", part: "region", x: 0, y: 0, z: 0, born: 0 });
  const rest = named.filter((item) => item.name !== "Tessera");
  for (const part of ORDER) {
    const group = rest.filter((item) => item.part === part);
    group.forEach((item, index) => {
      const angle = (index / Math.max(group.length, 1)) * Math.PI * 2;
      const shell = SHELL[part];
      nodes.push({
        id: nodes.length,
        name: item.name,
        part,
        x: Math.cos(angle) * shell.r,
        y: Math.sin(angle) * shell.r * 0.72,
        z: shell.z,
        born: 0,
      });
    });
  }
  for (const item of rest) {
    if (nodes.some((node) => node.name === item.name && node.part === item.part)) continue;
    nodes.push({ id: nodes.length, name: item.name, part: item.part, x: 0, y: 0, z: 0, born: 0 });
  }
  const span = Math.max(nodes.length - 1, 1);
  nodes.forEach((node, index) => {
    node.born = index / span;
  });
  const edges: [number, number][] = [];
  for (const part of ORDER) {
    const ids = nodes.filter((node) => node.part === part && node.name !== "Tessera").map((node) => node.id);
    if (ids.length < 2) continue;
    for (let index = 0; index < ids.length; index += 1) edges.push([ids[index], ids[(index + 1) % ids.length]]);
  }
  const center = nodes.find((node) => node.name === "Tessera");
  if (center) {
    for (const node of nodes) if (node.id !== center.id) edges.push([center.id, node.id]);
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
  const depth = 8 + z2;
  const scale = (zoom * 16) / depth;
  return { x: x1 * scale, y: y1 * scale, depth };
}
