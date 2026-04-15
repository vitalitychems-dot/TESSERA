import { useRef, useMemo, memo, useEffect, useState, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const StaticFallback = (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 0,
      background: "radial-gradient(ellipse at center, #0a0520 0%, #030108 70%, #010005 100%)",
    }}
  />
);

function raDecToXYZ(ra: number, dec: number, r: number): [number, number, number] {
  const raRad = (ra / 24) * Math.PI * 2;
  const decRad = (dec / 180) * Math.PI;
  const x = r * Math.cos(decRad) * Math.cos(raRad);
  const y = r * Math.sin(decRad);
  const z = r * Math.cos(decRad) * Math.sin(raRad);
  return [x, y, z];
}

function spectralToColor(spectral: string): THREE.Color {
  const s = spectral.charAt(0);
  switch (s) {
    case "O": return new THREE.Color(0.6, 0.7, 1.0);
    case "B": return new THREE.Color(0.7, 0.8, 1.0);
    case "A": return new THREE.Color(0.9, 0.92, 1.0);
    case "F": return new THREE.Color(1.0, 1.0, 0.9);
    case "G": return new THREE.Color(1.0, 0.95, 0.7);
    case "K": return new THREE.Color(1.0, 0.8, 0.5);
    case "M": return new THREE.Color(1.0, 0.6, 0.4);
    default: return new THREE.Color(1.0, 1.0, 1.0);
  }
}

function magToSize(mag: number): number {
  return Math.max(0.3, 3.5 - mag * 0.4);
}

interface StarEntry {
  ra: number;
  dec: number;
  mag: number;
  spectral: string;
  name?: string;
}

const BRIGHT_STARS: StarEntry[] = [
  { ra: 6.752, dec: -16.716, mag: -1.46, spectral: "A", name: "Sirius" },
  { ra: 6.399, dec: -52.696, mag: -0.74, spectral: "F", name: "Canopus" },
  { ra: 14.261, dec: -60.834, mag: -0.27, spectral: "G", name: "Alpha Centauri" },
  { ra: 14.660, dec: 19.182, mag: -0.05, spectral: "K", name: "Arcturus" },
  { ra: 18.616, dec: 38.784, mag: 0.03, spectral: "A", name: "Vega" },
  { ra: 5.242, dec: -8.202, mag: 0.12, spectral: "B", name: "Rigel" },
  { ra: 7.655, dec: 5.225, mag: 0.34, spectral: "F", name: "Procyon" },
  { ra: 1.628, dec: -57.237, mag: 0.46, spectral: "B", name: "Achernar" },
  { ra: 5.919, dec: 7.407, mag: 0.50, spectral: "M", name: "Betelgeuse" },
  { ra: 19.846, dec: 8.868, mag: 0.76, spectral: "A", name: "Altair" },
  { ra: 5.438, dec: -1.943, mag: 1.64, spectral: "B", name: "Alnilam" },
  { ra: 4.599, dec: 16.509, mag: 0.85, spectral: "K", name: "Aldebaran" },
  { ra: 16.490, dec: -26.432, mag: 0.96, spectral: "M", name: "Antares" },
  { ra: 7.577, dec: 28.026, mag: 1.14, spectral: "A", name: "Pollux" },
  { ra: 12.443, dec: -63.100, mag: 0.77, spectral: "B" },
  { ra: 22.960, dec: -29.622, mag: 1.16, spectral: "A", name: "Fomalhaut" },
  { ra: 20.690, dec: 45.280, mag: 1.25, spectral: "A", name: "Deneb" },
  { ra: 12.263, dec: -57.113, mag: 1.33, spectral: "B" },
  { ra: 10.139, dec: 11.967, mag: 1.35, spectral: "B", name: "Regulus" },
  { ra: 5.418, dec: -0.299, mag: 1.70, spectral: "O", name: "Alnitak" },
  { ra: 5.533, dec: -1.202, mag: 2.09, spectral: "O", name: "Mintaka" },
  { ra: 3.787, dec: 24.105, mag: 1.65, spectral: "B", name: "Alcyone" },
  { ra: 2.120, dec: 23.462, mag: 2.00, spectral: "M" },
  { ra: 0.726, dec: 56.537, mag: 2.23, spectral: "F" },
  { ra: 13.398, dec: -11.161, mag: 1.04, spectral: "B", name: "Spica" },
  { ra: 0.139, dec: 29.091, mag: 2.06, spectral: "B", name: "Alpheratz" },
  { ra: 1.162, dec: 35.621, mag: 2.07, spectral: "M", name: "Mirach" },
  { ra: 2.065, dec: 42.330, mag: 2.09, spectral: "F" },
  { ra: 0.438, dec: -42.305, mag: 2.10, spectral: "K" },
  { ra: 3.405, dec: 49.861, mag: 1.79, spectral: "F" },
  { ra: 0.945, dec: 60.717, mag: 2.27, spectral: "A" },
  { ra: 13.793, dec: 49.314, mag: 1.77, spectral: "A" },
  { ra: 11.062, dec: 61.751, mag: 1.79, spectral: "A" },
  { ra: 11.897, dec: 53.695, mag: 2.37, spectral: "A" },
  { ra: 12.900, dec: 55.960, mag: 2.27, spectral: "A" },
  { ra: 23.063, dec: 28.083, mag: 2.42, spectral: "A" },
  { ra: 21.309, dec: -0.320, mag: 2.39, spectral: "G" },
  { ra: 17.582, dec: -37.104, mag: 1.63, spectral: "B" },
  { ra: 12.694, dec: -48.960, mag: 1.58, spectral: "B" },
  { ra: 8.375, dec: -59.510, mag: 1.68, spectral: "A" },
  { ra: 9.220, dec: -69.717, mag: 1.67, spectral: "K" },
  { ra: 17.943, dec: -40.047, mag: 1.85, spectral: "B" },
  { ra: 18.402, dec: -34.384, mag: 1.85, spectral: "B" },
  { ra: 19.044, dec: -29.880, mag: 2.05, spectral: "K" },
  { ra: 18.921, dec: -26.297, mag: 1.79, spectral: "B" },
  { ra: 7.139, dec: -26.393, mag: 1.50, spectral: "B" },
  { ra: 6.378, dec: -17.956, mag: 1.98, spectral: "B" },
  { ra: 2.530, dec: 89.264, mag: 1.98, spectral: "F", name: "Polaris" },
  { ra: 5.679, dec: 21.143, mag: 1.90, spectral: "K", name: "Elnath" },
  { ra: 7.755, dec: 28.026, mag: 1.14, spectral: "K" },
  { ra: 7.576, dec: 31.888, mag: 1.93, spectral: "A", name: "Castor" },
  { ra: 8.159, dec: -47.336, mag: 2.21, spectral: "A" },
  { ra: 9.460, dec: -8.659, mag: 2.00, spectral: "K" },
  { ra: 11.817, dec: 14.572, mag: 2.14, spectral: "A", name: "Denebola" },
  { ra: 15.578, dec: 26.715, mag: 2.23, spectral: "A" },
  { ra: 15.737, dec: -29.128, mag: 2.29, spectral: "B" },
  { ra: 16.006, dec: -22.622, mag: 2.56, spectral: "B" },
  { ra: 16.353, dec: -25.593, mag: 2.89, spectral: "B" },
  { ra: 16.836, dec: -34.293, mag: 1.87, spectral: "B" },
  { ra: 17.173, dec: -43.239, mag: 1.86, spectral: "B" },
  { ra: 17.560, dec: -37.043, mag: 1.62, spectral: "B" },
  { ra: 18.350, dec: -36.761, mag: 2.70, spectral: "A" },
  { ra: 18.096, dec: -30.424, mag: 2.82, spectral: "K" },
  { ra: 19.771, dec: -8.956, mag: 2.99, spectral: "A" },
  { ra: 19.873, dec: 6.407, mag: 3.36, spectral: "A" },
  { ra: 20.188, dec: -12.508, mag: 2.87, spectral: "A" },
  { ra: 20.427, dec: -14.782, mag: 3.27, spectral: "F" },
  { ra: 21.526, dec: -5.571, mag: 2.90, spectral: "G" },
  { ra: 22.096, dec: -32.988, mag: 2.95, spectral: "A" },
  { ra: 22.691, dec: -46.885, mag: 1.94, spectral: "K" },
  { ra: 23.079, dec: 15.205, mag: 2.49, spectral: "M" },
  { ra: 23.658, dec: -29.309, mag: 3.27, spectral: "A" },
  { ra: 0.220, dec: 15.184, mag: 3.82, spectral: "K" },
  { ra: 1.885, dec: 20.808, mag: 2.64, spectral: "K" },
  { ra: 2.833, dec: 21.144, mag: 3.53, spectral: "B" },
  { ra: 3.514, dec: 9.029, mag: 3.73, spectral: "K" },
  { ra: 3.038, dec: 4.090, mag: 3.47, spectral: "K" },
  { ra: 1.907, dec: 20.808, mag: 2.00, spectral: "K", name: "Hamal" },
  { ra: 4.330, dec: 15.628, mag: 3.65, spectral: "K" },
  { ra: 8.745, dec: 18.154, mag: 3.52, spectral: "K" },
  { ra: 8.275, dec: 9.186, mag: 3.90, spectral: "F" },
  { ra: 9.133, dec: 18.154, mag: 3.34, spectral: "A" },
  { ra: 8.722, dec: 21.469, mag: 3.60, spectral: "K" },
];

const ZODIAC_CONSTELLATIONS: Record<string, {
  stars: { ra: number; dec: number; mag: number; spectral: string }[];
  lines: [number, number][];
}> = {
  Aries: {
    stars: [
      { ra: 1.907, dec: 20.808, mag: 2.00, spectral: "K" },
      { ra: 1.911, dec: 23.462, mag: 2.64, spectral: "K" },
      { ra: 1.885, dec: 19.294, mag: 3.61, spectral: "B" },
      { ra: 2.833, dec: 21.144, mag: 3.53, spectral: "B" },
    ],
    lines: [[0, 1], [0, 2], [2, 3]],
  },
  Taurus: {
    stars: [
      { ra: 4.599, dec: 16.509, mag: 0.85, spectral: "K" },
      { ra: 5.438, dec: 28.608, mag: 1.65, spectral: "B" },
      { ra: 4.477, dec: 15.962, mag: 3.53, spectral: "G" },
      { ra: 4.382, dec: 17.543, mag: 3.41, spectral: "K" },
      { ra: 4.330, dec: 15.628, mag: 3.65, spectral: "K" },
      { ra: 5.627, dec: 21.143, mag: 1.65, spectral: "B" },
    ],
    lines: [[0, 2], [2, 3], [3, 4], [0, 5], [5, 1]],
  },
  Gemini: {
    stars: [
      { ra: 7.577, dec: 28.026, mag: 1.14, spectral: "K" },
      { ra: 7.576, dec: 31.888, mag: 1.93, spectral: "A" },
      { ra: 6.629, dec: 25.131, mag: 3.36, spectral: "A" },
      { ra: 6.383, dec: 22.514, mag: 3.06, spectral: "F" },
      { ra: 7.068, dec: 20.570, mag: 2.88, spectral: "A" },
      { ra: 6.732, dec: 12.896, mag: 3.35, spectral: "M" },
    ],
    lines: [[1, 2], [2, 3], [0, 4], [4, 5], [2, 4]],
  },
  Cancer: {
    stars: [
      { ra: 8.745, dec: 18.154, mag: 3.52, spectral: "K" },
      { ra: 8.275, dec: 9.186, mag: 3.90, spectral: "F" },
      { ra: 8.722, dec: 21.469, mag: 3.60, spectral: "K" },
      { ra: 9.133, dec: 18.154, mag: 3.34, spectral: "A" },
      { ra: 8.778, dec: 28.760, mag: 4.02, spectral: "G" },
    ],
    lines: [[0, 1], [0, 2], [0, 3], [2, 4]],
  },
  Leo: {
    stars: [
      { ra: 10.139, dec: 11.967, mag: 1.35, spectral: "B" },
      { ra: 11.237, dec: 20.524, mag: 2.01, spectral: "A" },
      { ra: 11.817, dec: 14.572, mag: 2.14, spectral: "A" },
      { ra: 10.333, dec: 19.842, mag: 2.56, spectral: "A" },
      { ra: 10.122, dec: 16.763, mag: 3.44, spectral: "F" },
      { ra: 9.764, dec: 23.774, mag: 3.34, spectral: "K" },
      { ra: 11.352, dec: 10.529, mag: 3.34, spectral: "G" },
    ],
    lines: [[0, 4], [4, 3], [3, 5], [3, 1], [1, 2], [2, 6]],
  },
  Virgo: {
    stars: [
      { ra: 13.398, dec: -11.161, mag: 1.04, spectral: "B" },
      { ra: 13.036, dec: 10.959, mag: 2.83, spectral: "F" },
      { ra: 12.694, dec: -1.449, mag: 2.74, spectral: "M" },
      { ra: 12.332, dec: -0.667, mag: 3.38, spectral: "F" },
      { ra: 11.845, dec: 1.765, mag: 3.61, spectral: "G" },
      { ra: 13.578, dec: -0.596, mag: 3.37, spectral: "G" },
    ],
    lines: [[0, 2], [2, 3], [3, 4], [2, 5], [1, 3]],
  },
  Libra: {
    stars: [
      { ra: 14.848, dec: -16.042, mag: 2.61, spectral: "A" },
      { ra: 15.283, dec: -9.383, mag: 2.75, spectral: "B" },
      { ra: 15.592, dec: -14.789, mag: 3.29, spectral: "K" },
      { ra: 15.067, dec: -25.282, mag: 3.25, spectral: "K" },
    ],
    lines: [[0, 1], [1, 2], [0, 3], [2, 3]],
  },
  Scorpio: {
    stars: [
      { ra: 16.490, dec: -26.432, mag: 0.96, spectral: "M" },
      { ra: 16.006, dec: -22.622, mag: 2.56, spectral: "B" },
      { ra: 16.353, dec: -25.593, mag: 2.89, spectral: "B" },
      { ra: 16.836, dec: -34.293, mag: 1.87, spectral: "B" },
      { ra: 17.173, dec: -43.239, mag: 1.86, spectral: "B" },
      { ra: 17.560, dec: -37.043, mag: 1.62, spectral: "B" },
      { ra: 17.793, dec: -40.127, mag: 2.41, spectral: "F" },
      { ra: 17.622, dec: -42.998, mag: 2.69, spectral: "B" },
    ],
    lines: [[1, 2], [2, 0], [0, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  Sagittarius: {
    stars: [
      { ra: 18.096, dec: -30.424, mag: 2.82, spectral: "K" },
      { ra: 18.350, dec: -29.828, mag: 2.70, spectral: "A" },
      { ra: 18.402, dec: -34.384, mag: 1.85, spectral: "B" },
      { ra: 18.921, dec: -26.297, mag: 1.79, spectral: "B" },
      { ra: 19.044, dec: -29.880, mag: 2.05, spectral: "K" },
      { ra: 19.163, dec: -21.024, mag: 2.89, spectral: "F" },
      { ra: 18.229, dec: -36.761, mag: 3.17, spectral: "K" },
    ],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4], [3, 5], [2, 6]],
  },
  Capricorn: {
    stars: [
      { ra: 20.294, dec: -12.508, mag: 3.57, spectral: "A" },
      { ra: 20.188, dec: -12.508, mag: 2.87, spectral: "A" },
      { ra: 20.768, dec: -25.271, mag: 3.68, spectral: "A" },
      { ra: 21.099, dec: -17.233, mag: 3.08, spectral: "A" },
      { ra: 21.370, dec: -16.835, mag: 2.91, spectral: "F" },
      { ra: 21.618, dec: -16.662, mag: 3.69, spectral: "F" },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  Aquarius: {
    stars: [
      { ra: 21.526, dec: -5.571, mag: 2.90, spectral: "G" },
      { ra: 22.096, dec: -0.320, mag: 2.91, spectral: "G" },
      { ra: 22.361, dec: -1.387, mag: 3.27, spectral: "A" },
      { ra: 22.480, dec: -0.020, mag: 3.65, spectral: "F" },
      { ra: 22.876, dec: -7.580, mag: 3.84, spectral: "A" },
      { ra: 22.589, dec: -13.870, mag: 3.73, spectral: "K" },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]],
  },
  Pisces: {
    stars: [
      { ra: 23.658, dec: -6.049, mag: 3.49, spectral: "G" },
      { ra: 23.286, dec: 3.282, mag: 4.13, spectral: "F" },
      { ra: 23.990, dec: 6.863, mag: 3.62, spectral: "K" },
      { ra: 0.220, dec: 15.184, mag: 3.82, spectral: "K" },
      { ra: 1.049, dec: 7.890, mag: 4.27, spectral: "G" },
      { ra: 1.525, dec: 15.346, mag: 3.79, spectral: "K" },
      { ra: 2.034, dec: 2.764, mag: 3.69, spectral: "G" },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
};

const ZODIAC_SYMBOLS: Record<string, string> = {
  Aries: "\u2648", Taurus: "\u2649", Gemini: "\u264A", Cancer: "\u264B",
  Leo: "\u264C", Virgo: "\u264D", Libra: "\u264E", Scorpio: "\u264F",
  Sagittarius: "\u2650", Capricorn: "\u2651", Aquarius: "\u2652", Pisces: "\u2653",
};

const SPHERE_RADIUS = 80;

function Starfield({ isMobile }: { isMobile: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, colors, sizes, phases, baseOpacities } = useMemo(() => {
    const catalogStars = BRIGHT_STARS.map(s => ({
      pos: raDecToXYZ(s.ra, s.dec, SPHERE_RADIUS),
      color: spectralToColor(s.spectral),
      size: magToSize(s.mag),
      mag: s.mag,
    }));

    const bgCount = isMobile ? 600 : 1200;
    const totalCount = catalogStars.length + bgCount;

    const pos = new Float32Array(totalCount * 3);
    const col = new Float32Array(totalCount * 3);
    const siz = new Float32Array(totalCount);
    const pha = new Float32Array(totalCount);
    const opa = new Float32Array(totalCount);

    catalogStars.forEach((s, i) => {
      pos[i * 3] = s.pos[0];
      pos[i * 3 + 1] = s.pos[1];
      pos[i * 3 + 2] = s.pos[2];
      col[i * 3] = s.color.r;
      col[i * 3 + 1] = s.color.g;
      col[i * 3 + 2] = s.color.b;
      siz[i] = s.size;
      pha[i] = Math.random() * Math.PI * 2;
      opa[i] = 0.7 + Math.random() * 0.3;
    });

    const bgColors = [
      new THREE.Color(1, 1, 1),
      new THREE.Color(0.85, 0.9, 1),
      new THREE.Color(1, 0.95, 0.8),
      new THREE.Color(0.9, 0.85, 1),
    ];

    for (let i = 0; i < bgCount; i++) {
      const idx = catalogStars.length + i;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = SPHERE_RADIUS * (0.95 + Math.random() * 0.1);
      pos[idx * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[idx * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[idx * 3 + 2] = r * Math.cos(phi);
      const c = bgColors[Math.floor(Math.random() * bgColors.length)];
      col[idx * 3] = c.r;
      col[idx * 3 + 1] = c.g;
      col[idx * 3 + 2] = c.b;
      siz[idx] = 0.2 + Math.random() * 0.8;
      pha[idx] = Math.random() * Math.PI * 2;
      opa[idx] = 0.15 + Math.random() * 0.5;
    }

    return { positions: pos, colors: col, sizes: siz, phases: pha, baseOpacities: opa };
  }, [isMobile]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    const geo = pointsRef.current.geometry;
    const sizeAttr = geo.getAttribute("size");
    const arr = sizeAttr.array as Float32Array;
    const len = arr.length;
    const t = timeRef.current;

    for (let i = 0; i < len; i++) {
      const twinkle = 0.7 + 0.3 * Math.sin(t * (1.5 + (i % 7) * 0.3) + phases[i]);
      arr[i] = sizes[i] * twinkle * baseOpacities[i];
    }
    sizeAttr.needsUpdate = true;
  });

  const vertexShader = `
    attribute float size;
    attribute vec3 starColor;
    varying vec3 vColor;
    void main() {
      vColor = starColor;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, d);
      float core = smoothstep(0.3, 0.0, d);
      vec3 col = mix(vColor, vec3(1.0), core * 0.5);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-starColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes.slice(), 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function ConstellationLines() {
  const linesGeo = useMemo(() => {
    const verts: number[] = [];
    const cols: number[] = [];

    Object.values(ZODIAC_CONSTELLATIONS).forEach(constellation => {
      constellation.lines.forEach(([a, b]) => {
        const starA = constellation.stars[a];
        const starB = constellation.stars[b];
        if (!starA || !starB) return;
        const pA = raDecToXYZ(starA.ra, starA.dec, SPHERE_RADIUS);
        const pB = raDecToXYZ(starB.ra, starB.dec, SPHERE_RADIUS);
        verts.push(...pA, ...pB);
        cols.push(0.2, 0.7, 0.85, 0.2, 0.7, 0.85);
      });
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={linesGeo}>
      <lineBasicMaterial vertexColors transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function ConstellationLabels() {
  const { camera } = useThree();
  const labelsRef = useRef<THREE.Group>(null);

  const labelData = useMemo(() =>
    Object.entries(ZODIAC_CONSTELLATIONS).map(([name, constellation]) => {
      let avgRa = 0, avgDec = 0;
      constellation.stars.forEach(s => { avgRa += s.ra; avgDec += s.dec; });
      avgRa /= constellation.stars.length;
      avgDec /= constellation.stars.length;
      const pos = raDecToXYZ(avgRa, avgDec + 4, SPHERE_RADIUS * 0.97);
      return { name, symbol: ZODIAC_SYMBOLS[name] || "", pos };
    }), []);

  useFrame(() => {
    if (!labelsRef.current) return;
    labelsRef.current.children.forEach(child => {
      child.lookAt(camera.position);
    });
  });

  return (
    <group ref={labelsRef}>
      {labelData.map(({ name, symbol, pos }) => (
        <group key={name} position={pos}>
          <sprite scale={[8, 2.5, 1]}>
            <spriteMaterial
              transparent
              opacity={0.55}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            >
              <canvasTexture
                attach="map"
                image={(() => {
                  const c = document.createElement("canvas");
                  c.width = 256;
                  c.height = 80;
                  const ctx = c.getContext("2d")!;
                  ctx.fillStyle = "rgba(6, 182, 212, 0.8)";
                  ctx.font = "bold 32px monospace";
                  ctx.textAlign = "center";
                  ctx.fillText(`${symbol} ${name}`, 128, 48);
                  return c;
                })()}
              />
            </spriteMaterial>
          </sprite>
        </group>
      ))}
    </group>
  );
}

function NebulaClouds() {
  const cloudsRef = useRef<THREE.Group>(null);

  const clouds = useMemo(() => {
    const list: { pos: THREE.Vector3; color: THREE.Color; scale: number; opacity: number }[] = [];
    const nebColors = [
      new THREE.Color(0.1, 0.3, 0.6),
      new THREE.Color(0.3, 0.1, 0.5),
      new THREE.Color(0.05, 0.4, 0.45),
      new THREE.Color(0.4, 0.15, 0.35),
      new THREE.Color(0.08, 0.25, 0.5),
      new THREE.Color(0.2, 0.05, 0.4),
    ];
    for (let i = 0; i < 8; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = SPHERE_RADIUS * 0.85;
      list.push({
        pos: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        ),
        color: nebColors[i % nebColors.length],
        scale: 12 + Math.random() * 18,
        opacity: 0.04 + Math.random() * 0.04,
      });
    }
    return list;
  }, []);

  useFrame(({ clock }) => {
    if (!cloudsRef.current) return;
    const t = clock.getElapsedTime();
    cloudsRef.current.children.forEach((child, i) => {
      const s = clouds[i].scale * (1 + 0.08 * Math.sin(t * 0.15 + i * 1.2));
      child.scale.setScalar(s);
    });
  });

  return (
    <group ref={cloudsRef}>
      {clouds.map((cloud, i) => (
        <mesh key={i} position={cloud.pos}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={cloud.color}
            transparent
            opacity={cloud.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function GalacticPlane() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.025 + 0.01 * Math.sin(clock.getElapsedTime() * 0.1);
    }
  });

  return (
    <mesh ref={ref} rotation={[0, 0, Math.PI * 0.1]}>
      <torusGeometry args={[SPHERE_RADIUS * 0.95, 6, 8, 64]} />
      <meshBasicMaterial
        color={new THREE.Color(0.15, 0.2, 0.4)}
        transparent
        opacity={0.03}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function SceneContent({ isMobile }: { isMobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.008;
    }
  });

  return (
    <group ref={groupRef}>
      <Starfield isMobile={isMobile} />
      <ConstellationLines />
      <ConstellationLabels />
      <NebulaClouds />
      <GalacticPlane />
    </group>
  );
}

function FrameLimiter({ fps }: { fps: number }) {
  const { invalidate, gl } = useThree();
  useEffect(() => {
    let animId: number;
    let last = 0;
    const interval = 1000 / fps;
    const tick = (now: number) => {
      animId = requestAnimationFrame(tick);
      if (now - last >= interval) {
        last = now;
        invalidate();
      }
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [fps, invalidate, gl]);
  return null;
}

function UniverseBackground() {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    setHasWebGL(detectWebGL());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    const onMotion = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    window.addEventListener("resize", onResize);
    mq.addEventListener("change", onMotion);
    return () => {
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onMotion);
    };
  }, []);

  if (reducedMotion || !hasWebGL) {
    return StaticFallback;
  }

  return (
    <WebGLErrorBoundary fallback={StaticFallback}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <Canvas
          camera={{ position: [0, 0, 0.1], fov: 75, near: 0.1, far: 200 }}
          gl={{
            antialias: !isMobile,
            powerPreference: "low-power",
            alpha: false,
          }}
          frameloop="demand"
          style={{ background: "#030108" }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
        >
          <FrameLimiter fps={isMobile ? 20 : 30} />
          <color attach="background" args={["#030108"]} />
          <ambientLight intensity={0.05} />
          <SceneContent isMobile={isMobile} />
          <OrbitControls
            enableZoom
            enablePan={false}
            enableRotate
            autoRotate={false}
            minDistance={0.1}
            maxDistance={60}
            zoomSpeed={0.5}
            rotateSpeed={0.3}
            enableDamping
            dampingFactor={0.05}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
          />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}

export default memo(UniverseBackground);
