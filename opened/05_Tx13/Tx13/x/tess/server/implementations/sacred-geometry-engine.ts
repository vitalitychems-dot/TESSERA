interface GeometryNode {
  id: string;
  x: number;
  y: number;
  z: number;
  w?: number;
  frequency: number;
  dimension: number;
  connections: string[];
  dataFlow: number;
}

interface ToroidalField {
  innerRadius: number;
  outerRadius: number;
  rotation: number;
  energyFlow: number;
  dataCorrelation: number;
}

const metatronsCube: GeometryNode[] = [];
const flowerOfLifeNodes: GeometryNode[] = [];
let toroidalField: ToroidalField = { innerRadius: 1, outerRadius: 3, rotation: 0, energyFlow: 0, dataCorrelation: 0 };
let renderCycle = 0;

function initMetatronsCube(): void {
  if (metatronsCube.length > 0) return;
  const PHI = (1 + Math.sqrt(5)) / 2;
  for (let d = 0; d < 12; d++) {
    const angle = (d / 12) * Math.PI * 2;
    const node: GeometryNode = {
      id: `metatron-${d}`,
      x: Math.cos(angle) * PHI,
      y: Math.sin(angle) * PHI,
      z: Math.cos(angle * PHI) * 0.5,
      frequency: 174 + d * 66,
      dimension: d + 1,
      connections: [],
      dataFlow: 0,
    };
    metatronsCube.push(node);
  }
  for (let i = 0; i < metatronsCube.length; i++) {
    for (let j = i + 1; j < metatronsCube.length; j++) {
      metatronsCube[i].connections.push(metatronsCube[j].id);
      metatronsCube[j].connections.push(metatronsCube[i].id);
    }
  }
}

function initFlowerOfLife(): void {
  if (flowerOfLifeNodes.length > 0) return;
  const layers = [1, 6, 12];
  let nodeId = 0;
  for (const count of layers) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = layers.indexOf(count) * 1.5;
      flowerOfLifeNodes.push({
        id: `flower-${nodeId++}`,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: 0,
        frequency: 432 * (1 + layers.indexOf(count) * 0.1),
        dimension: 1,
        connections: [],
        dataFlow: 0,
      });
    }
  }
  for (let i = 0; i < flowerOfLifeNodes.length; i++) {
    for (let j = i + 1; j < flowerOfLifeNodes.length; j++) {
      const dx = flowerOfLifeNodes[i].x - flowerOfLifeNodes[j].x;
      const dy = flowerOfLifeNodes[i].y - flowerOfLifeNodes[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < 2.5) {
        flowerOfLifeNodes[i].connections.push(flowerOfLifeNodes[j].id);
        flowerOfLifeNodes[j].connections.push(flowerOfLifeNodes[i].id);
      }
    }
  }
}

export function updateToroidalFlow(dataRate: number): ToroidalField {
  toroidalField.rotation += 0.1;
  toroidalField.energyFlow = dataRate * Math.sin(toroidalField.rotation) * toroidalField.outerRadius;
  toroidalField.dataCorrelation = Math.abs(Math.cos(toroidalField.rotation * 0.618)) * 100;
  return { ...toroidalField };
}

export function getTesseractProjection(dimensionalState: Record<string, number>): Array<{ x: number; y: number; z: number; w: number; dimension: string; value: number }> {
  return Object.entries(dimensionalState).map(([dim, value], i) => {
    const angle = (i / Object.keys(dimensionalState).length) * Math.PI * 2;
    return {
      x: Math.cos(angle) * value,
      y: Math.sin(angle) * value,
      z: Math.cos(angle * 1.618) * value * 0.5,
      w: Math.sin(angle * 2.718) * value * 0.3,
      dimension: dim,
      value,
    };
  });
}

export function renderFrame(): {
  metatron: GeometryNode[];
  flower: GeometryNode[];
  toroid: ToroidalField;
  cycle: number;
} {
  initMetatronsCube();
  initFlowerOfLife();
  renderCycle++;

  for (const node of metatronsCube) {
    node.dataFlow = Math.sin(renderCycle * 0.05 + node.dimension * 0.3) * 100;
  }
  for (const node of flowerOfLifeNodes) {
    node.dataFlow = Math.cos(renderCycle * 0.03 + node.frequency * 0.001) * 80;
  }
  updateToroidalFlow(renderCycle * 0.1);

  return {
    metatron: metatronsCube,
    flower: flowerOfLifeNodes,
    toroid: toroidalField,
    cycle: renderCycle,
  };
}

export function getStats() {
  initMetatronsCube();
  initFlowerOfLife();
  return {
    metatronNodes: metatronsCube.length,
    flowerNodes: flowerOfLifeNodes.length,
    metatronConnections: metatronsCube.reduce((s, n) => s + n.connections.length, 0) / 2,
    flowerConnections: flowerOfLifeNodes.reduce((s, n) => s + n.connections.length, 0) / 2,
    toroidalRotation: Math.round(toroidalField.rotation * 100) / 100,
    renderCycles: renderCycle,
    dimensionsCovered: 12,
    status: "ACTIVE",
  };
}
