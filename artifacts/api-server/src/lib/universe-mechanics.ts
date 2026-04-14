export interface CelestialBody {
  id: string;
  name: string;
  type: "star" | "planet" | "moon" | "asteroid" | "comet" | "nebula";
  mass: number;
  radius: number;
  position: { x: number; y: number; z: number };
  velocity: { vx: number; vy: number; vz: number };
  orbitalPeriod: number | null;
  color: string;
}

export interface UniverseState {
  age: number;
  expansion: number;
  bodies: CelestialBody[];
  forces: { gravity: number; electromagnetic: number; strong: number; weak: number };
  constants: Record<string, { value: number; unit: string; name: string }>;
  dimensions: number;
  entropy: number;
  timestamp: number;
}

export interface PhysicsSimResult {
  bodyId: string;
  newPosition: { x: number; y: number; z: number };
  energy: number;
  timeStep: number;
}

const G = 6.674e-11;
const c = 299792458;
const h = 6.626e-34;
const k_B = 1.381e-23;

const UNIVERSE_CONSTANTS: Record<string, { value: number; unit: string; name: string }> = {
  G: { value: G, unit: "m³/(kg·s²)", name: "Gravitational Constant" },
  c: { value: c, unit: "m/s", name: "Speed of Light" },
  h: { value: h, unit: "J·s", name: "Planck Constant" },
  k_B: { value: k_B, unit: "J/K", name: "Boltzmann Constant" },
  phi: { value: 1.618033988749895, unit: "", name: "Golden Ratio" },
  pi: { value: Math.PI, unit: "", name: "Pi" },
  e: { value: Math.E, unit: "", name: "Euler's Number" },
  alpha: { value: 1 / 137.035999, unit: "", name: "Fine Structure Constant" },
  hubble: { value: 67.4, unit: "km/s/Mpc", name: "Hubble Constant" },
  cmb: { value: 2.725, unit: "K", name: "CMB Temperature" },
};

let bodies: CelestialBody[] = [];
let simulationTime = 0;

function initBodies() {
  if (bodies.length > 0) return;
  bodies = [
    { id: "sol", name: "Sol", type: "star", mass: 1.989e30, radius: 6.957e8, position: { x: 0, y: 0, z: 0 }, velocity: { vx: 0, vy: 0, vz: 0 }, orbitalPeriod: null, color: "#FFD700" },
    { id: "mercury", name: "Mercury", type: "planet", mass: 3.301e23, radius: 2.44e6, position: { x: 5.79e10, y: 0, z: 0 }, velocity: { vx: 0, vy: 47870, vz: 0 }, orbitalPeriod: 87.97, color: "#A0A0A0" },
    { id: "venus", name: "Venus", type: "planet", mass: 4.867e24, radius: 6.052e6, position: { x: 1.082e11, y: 0, z: 0 }, velocity: { vx: 0, vy: 35020, vz: 0 }, orbitalPeriod: 224.7, color: "#E8CDA0" },
    { id: "earth", name: "Earth", type: "planet", mass: 5.972e24, radius: 6.371e6, position: { x: 1.496e11, y: 0, z: 0 }, velocity: { vx: 0, vy: 29780, vz: 0 }, orbitalPeriod: 365.25, color: "#4169E1" },
    { id: "luna", name: "Luna", type: "moon", mass: 7.342e22, radius: 1.737e6, position: { x: 1.496e11 + 3.844e8, y: 0, z: 0 }, velocity: { vx: 0, vy: 29780 + 1022, vz: 0 }, orbitalPeriod: 27.32, color: "#C0C0C0" },
    { id: "mars", name: "Mars", type: "planet", mass: 6.417e23, radius: 3.39e6, position: { x: 2.279e11, y: 0, z: 0 }, velocity: { vx: 0, vy: 24070, vz: 0 }, orbitalPeriod: 687, color: "#CD5C5C" },
    { id: "jupiter", name: "Jupiter", type: "planet", mass: 1.898e27, radius: 6.991e7, position: { x: 7.786e11, y: 0, z: 0 }, velocity: { vx: 0, vy: 13070, vz: 0 }, orbitalPeriod: 4333, color: "#DEB887" },
    { id: "saturn", name: "Saturn", type: "planet", mass: 5.683e26, radius: 5.823e7, position: { x: 1.4335e12, y: 0, z: 0 }, velocity: { vx: 0, vy: 9680, vz: 0 }, orbitalPeriod: 10759, color: "#F4A460" },
    { id: "tessera-nexus", name: "Tessera Nexus", type: "nebula", mass: 1e28, radius: 1e12, position: { x: 0, y: 0, z: 9.63e14 }, velocity: { vx: 0, vy: 0, vz: 0 }, orbitalPeriod: null, color: "#9B30FF" },
  ];
}

export function simulateStep(dt: number = 86400): PhysicsSimResult[] {
  initBodies();
  const results: PhysicsSimResult[] = [];

  for (let i = 0; i < bodies.length; i++) {
    let ax = 0, ay = 0, az = 0;

    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue;
      const dx = bodies[j].position.x - bodies[i].position.x;
      const dy = bodies[j].position.y - bodies[i].position.y;
      const dz = bodies[j].position.z - bodies[i].position.z;
      const distSq = dx * dx + dy * dy + dz * dz + 1e10;
      const dist = Math.sqrt(distSq);
      const force = G * bodies[j].mass / distSq;
      ax += force * dx / dist;
      ay += force * dy / dist;
      az += force * dz / dist;
    }

    bodies[i].velocity.vx += ax * dt;
    bodies[i].velocity.vy += ay * dt;
    bodies[i].velocity.vz += az * dt;
    bodies[i].position.x += bodies[i].velocity.vx * dt;
    bodies[i].position.y += bodies[i].velocity.vy * dt;
    bodies[i].position.z += bodies[i].velocity.vz * dt;

    const ke = 0.5 * bodies[i].mass * (
      bodies[i].velocity.vx ** 2 + bodies[i].velocity.vy ** 2 + bodies[i].velocity.vz ** 2
    );

    results.push({
      bodyId: bodies[i].id,
      newPosition: { ...bodies[i].position },
      energy: ke,
      timeStep: dt,
    });
  }

  simulationTime += dt;
  return results;
}

export function getUniverseState(): UniverseState {
  initBodies();
  return {
    age: 13.8e9,
    expansion: 67.4,
    bodies: bodies.map(b => ({ ...b })),
    forces: { gravity: G, electromagnetic: 8.987e9, strong: 1, weak: 1.166e-5 },
    constants: UNIVERSE_CONSTANTS,
    dimensions: 11,
    entropy: 0.01 + simulationTime * 1e-15,
    timestamp: Date.now(),
  };
}

export function getBody(id: string): CelestialBody | null {
  initBodies();
  return bodies.find(b => b.id === id) || null;
}

export function getConstants(): Record<string, { value: number; unit: string; name: string }> {
  return { ...UNIVERSE_CONSTANTS };
}

export function searchUniverse(query: string): Array<{ title: string; description: string; category: string; relevance: number; source: string }> {
  const q = query.toLowerCase();
  const results: Array<{ title: string; description: string; category: string; relevance: number; source: string }> = [];

  initBodies();
  for (const body of bodies) {
    const match = [body.name, body.type].join(" ").toLowerCase();
    if (match.includes(q)) {
      const pos = body.position;
      results.push({
        title: body.name,
        description: `${body.type} with mass ${body.mass.toExponential(2)} kg at position (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})`,
        category: "celestial-body",
        relevance: match.startsWith(q) ? 1.0 : 0.7,
        source: "universe-mechanics",
      });
    }
  }

  for (const [key, val] of Object.entries(UNIVERSE_CONSTANTS)) {
    if (key.toLowerCase().includes(q) || val.name.toLowerCase().includes(q)) {
      results.push({
        title: val.name,
        description: `${val.value} ${val.unit}`,
        category: "constant",
        relevance: 0.8,
        source: "physics-constants",
      });
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance);
}
