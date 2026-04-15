import React, { useRef, useMemo, useState, useEffect, useCallback, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Ring, Text } from "@react-three/drei";
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

const NASA_TEXTURE_BASE = "https://upload.wikimedia.org/wikipedia/commons/thumb";
const PLANET_TEXTURES: Record<string, string> = {
  Mercury: `${NASA_TEXTURE_BASE}/3/30/Mercury_in_color_-_Prockter07_centered.jpg/600px-Mercury_in_color_-_Prockter07_centered.jpg`,
  Venus: `${NASA_TEXTURE_BASE}/a/a9/PIA23791-Venus-NewlyProcessedView-20200608.jpg/600px-PIA23791-Venus-NewlyProcessedView-20200608.jpg`,
  Earth: `${NASA_TEXTURE_BASE}/9/97/The_Earth_seen_from_Apollo_17.jpg/600px-The_Earth_seen_from_Apollo_17.jpg`,
  Mars: `${NASA_TEXTURE_BASE}/0/02/OSIRIS_Mars_true_color.jpg/600px-OSIRIS_Mars_true_color.jpg`,
  Jupiter: `${NASA_TEXTURE_BASE}/2/2b/Jupiter_and_its_shrunken_Great_Red_Spot.jpg/600px-Jupiter_and_its_shrunken_Great_Red_Spot.jpg`,
  Saturn: `${NASA_TEXTURE_BASE}/c/c7/Saturn_during_Equinox.jpg/600px-Saturn_during_Equinox.jpg`,
  Uranus: `${NASA_TEXTURE_BASE}/3/3d/Uranus2.jpg/600px-Uranus2.jpg`,
  Neptune: `${NASA_TEXTURE_BASE}/6/63/Neptune_-_Voyager_2_%2829347980845%29_flatten_crop.jpg/600px-Neptune_-_Voyager_2_%2829347980845%29_flatten_crop.jpg`,
};

const PHI = 1.6180339887498948;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

const PLANETS_DATA = [
  { name: "Mercury", distance: 3.5 * PHI, size: 0.3, speed: 0.008, color: "#a0a0a0", emissive: "#3a3a3a" },
  { name: "Venus", distance: 3.5 * PHI * PHI, size: 0.5, speed: 0.006, color: "#e8c373", emissive: "#5a4020" },
  { name: "Earth", distance: 3.5 * Math.pow(PHI, 2.3), size: 0.55, speed: 0.005, color: "#4a90d9", emissive: "#1a3050" },
  { name: "Mars", distance: 3.5 * Math.pow(PHI, 2.8), size: 0.4, speed: 0.004, color: "#c1440e", emissive: "#4a1a05" },
  { name: "Jupiter", distance: 3.5 * Math.pow(PHI, 3.5), size: 1.4, speed: 0.002, color: "#c88b3a", emissive: "#3a2a10" },
  { name: "Saturn", distance: 3.5 * Math.pow(PHI, 4.0), size: 1.2, speed: 0.0015, color: "#e8d082", emissive: "#4a3a15" },
  { name: "Uranus", distance: 3.5 * Math.pow(PHI, 4.4), size: 0.9, speed: 0.001, color: "#73c2d6", emissive: "#1a3a40" },
  { name: "Neptune", distance: 3.5 * Math.pow(PHI, 4.8), size: 0.85, speed: 0.0008, color: "#3f54ba", emissive: "#1a1a40" },
];

const DIMENSIONS = [
  { id: 1, name: "Physical", freq: "396 Hz", color: "#f87171", radius: 50 },
  { id: 2, name: "Etheric", freq: "417 Hz", color: "#fb923c", radius: 58 },
  { id: 3, name: "Astral", freq: "528 Hz", color: "#facc15", radius: 66 },
  { id: 4, name: "Mental", freq: "639 Hz", color: "#4ade80", radius: 74 },
  { id: 5, name: "Causal", freq: "741 Hz", color: "#22d3ee", radius: 82 },
  { id: 6, name: "Buddhic", freq: "852 Hz", color: "#60a5fa", radius: 90 },
  { id: 7, name: "Atmic", freq: "963 Hz", color: "#a78bfa", radius: 98 },
];

const CONSTELLATION_DATA: Record<string, { stars: number[][]; lines: number[][] }> = {
  Aries: {
    stars: [[0, 0], [3, 1.5], [6, 2], [8, 0.5]],
    lines: [[0, 1], [1, 2], [2, 3]],
  },
  Taurus: {
    stars: [[0, 0], [2, 2], [4, 3], [6, 2.5], [3, -1], [5, -0.5], [7, 0]],
    lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6]],
  },
  Gemini: {
    stars: [[0, 4], [1, 2], [2, 0], [3, -1], [5, 4], [4, 2], [3, 0.5]],
    lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [2, 6]],
  },
  Cancer: {
    stars: [[0, 0], [2, 2], [4, 1], [3, -1], [5, -0.5]],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4]],
  },
  Leo: {
    stars: [[0, 2], [1, 3], [3, 3.5], [4, 2], [3, 0], [5, -1], [7, 0]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  Virgo: {
    stars: [[0, 3], [2, 2], [4, 2.5], [6, 3], [3, 0], [5, -1], [7, 0.5]],
    lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6]],
  },
  Libra: {
    stars: [[0, 0], [3, 2], [6, 0], [2, -2], [4, -2], [3, -3.5]],
    lines: [[0, 1], [1, 2], [1, 5], [3, 5], [4, 5], [0, 3], [2, 4]],
  },
  Scorpio: {
    stars: [[0, 1], [2, 2], [4, 1.5], [6, 0], [7, -2], [8, -3], [9, -2.5], [9.5, -1.5]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  Sagittarius: {
    stars: [[0, 0], [2, 2], [4, 1], [3, -1], [5, 3], [6, 0], [2, -2]],
    lines: [[0, 1], [1, 2], [2, 3], [1, 4], [2, 5], [3, 6]],
  },
  Capricorn: {
    stars: [[0, 1], [2, 2], [4, 1.5], [6, 0], [5, -2], [3, -1.5]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
  },
  Aquarius: {
    stars: [[0, 2], [2, 1], [4, 2], [6, 1], [3, -1], [5, -2], [7, -1]],
    lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6]],
  },
  Pisces: {
    stars: [[0, 0], [2, 1], [4, 2], [6, 1.5], [3, -1], [5, -2], [7, -1], [3.5, 0]],
    lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [1, 7], [7, 5]],
  },
};

function Sun({ isRuler }: { isRuler?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const rulerGlowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.05;
    }
    if (glowRef.current) {
      const scale = 1.8 + Math.sin(t * 0.5) * 0.15;
      glowRef.current.scale.setScalar(scale);
    }
    if (rulerGlowRef.current) {
      const s = 1 + Math.sin(t * 1.2) * 0.15;
      rulerGlowRef.current.scale.setScalar(s);
      (rulerGlowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.06 + Math.sin(t * 2) * 0.03;
    }
  });

  return (
    <group>
      <pointLight position={[0, 0, 0]} intensity={isRuler ? 4 : 3} distance={200} color="#ffcc44" />
      <pointLight position={[0, 0, 0]} intensity={1.5} distance={300} color="#ff8800" />
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={isRuler ? 0.14 : 0.08} />
      </mesh>
      {isRuler && (
        <mesh ref={rulerGlowRef}>
          <sphereGeometry args={[4, 32, 32]} />
          <meshBasicMaterial color="#e879f9" transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.8, 48, 48]} />
        <meshStandardMaterial
          color="#ffcc22"
          emissive={isRuler ? "#c084fc" : "#ff8800"}
          emissiveIntensity={isRuler ? 2.5 : 2}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}

function RulingPlanetAura({ size, isVenus }: { size: number; isVenus?: boolean }) {
  const particlesRef = useRef<THREE.Points>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const outerAuraRef = useRef<THREE.Mesh>(null);
  const scalesRef = useRef<THREE.Mesh>(null);
  const count = isVenus ? 350 : 200;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      if (isVenus && i < 150) {
        const angle = (i / 150) * Math.PI * 2;
        const r = size * (2.0 + Math.sin(angle * 5) * 0.3);
        pos[i * 3] = r * Math.cos(angle);
        pos[i * 3 + 1] = (Math.random() - 0.5) * size;
        pos[i * 3 + 2] = r * Math.sin(angle);
      } else {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = size * (1.5 + Math.random() * 1.5);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
      }
    }
    return pos;
  }, [size, isVenus, count]);

  const colors = useMemo(() => {
    if (!isVenus) return null;
    const cols = new Float32Array(count * 3);
    const palette = [
      [0.13, 0.83, 0.93],
      [0.75, 0.81, 0.93],
      [0.66, 0.55, 0.98],
      [0.22, 0.83, 0.87],
    ];
    for (let i = 0; i < count; i++) {
      const c = palette[i % palette.length];
      cols[i * 3] = c[0];
      cols[i * 3 + 1] = c[1];
      cols[i * 3 + 2] = c[2];
    }
    return cols;
  }, [isVenus, count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * (isVenus ? 0.4 : 0.3);
      particlesRef.current.rotation.x = Math.sin(t * 0.2) * 0.2;
    }
    if (auraRef.current) {
      const s = 1 + Math.sin(t * 1.5) * 0.1;
      auraRef.current.scale.setScalar(s);
      (auraRef.current.material as THREE.MeshBasicMaterial).opacity = (isVenus ? 0.12 : 0.08) + Math.sin(t * 2) * 0.04;
    }
    if (outerAuraRef.current) {
      const s = 1 + Math.sin(t * 0.8) * 0.05;
      outerAuraRef.current.scale.setScalar(s);
    }
    if (scalesRef.current) {
      scalesRef.current.rotation.z = t * 0.05;
      scalesRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
    }
  });

  const auraColor = isVenus ? "#22d3ee" : "#e879f9";
  const outerColor = isVenus ? "#a78bfa" : "#a78bfa";

  return (
    <group>
      <mesh ref={auraRef}>
        <sphereGeometry args={[size * 2.5, 32, 32]} />
        <meshBasicMaterial color={auraColor} transparent opacity={isVenus ? 0.12 : 0.1} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh ref={outerAuraRef}>
        <sphereGeometry args={[size * 3.5, 32, 32]} />
        <meshBasicMaterial color={outerColor} transparent opacity={0.04} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {isVenus && (
        <group ref={scalesRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[size * 2, 0.03, 8, 32]} />
            <meshBasicMaterial color="#c0cfee" transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]}>
            <torusGeometry args={[size * 2.3, 0.02, 8, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      )}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          {colors && <bufferAttribute attach="attributes-color" args={[colors, 3]} />}
        </bufferGeometry>
        <pointsMaterial
          size={isVenus ? 0.1 : 0.08}
          color={isVenus ? undefined : "#e879f9"}
          vertexColors={!!isVenus}
          transparent
          opacity={0.7}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function PlanetWithTexture({ name, distance, size, speed, color, emissive, initialAngle, isRulingPlanet }: {
  name: string;
  distance: number;
  size: number;
  speed: number;
  color: string;
  emissive: string;
  initialAngle: number;
  isRulingPlanet?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const url = PLANET_TEXTURES[name];
    if (!url) return;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {}
    );
  }, [name]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      const angle = initialAngle + t * speed;
      groupRef.current.position.x = Math.cos(angle) * distance;
      groupRef.current.position.z = Math.sin(angle) * distance;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
    }
  });

  const emissiveBoost = isRulingPlanet ? 0.6 : 0;

  return (
    <>
      <Ring args={[distance - 0.03, distance + 0.03, 128]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} side={THREE.DoubleSide} />
      </Ring>
      <group ref={groupRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <mesh ref={meshRef}>
          <sphereGeometry args={[size, 32, 32]} />
          {texture ? (
            <meshStandardMaterial
              map={texture}
              emissive={isRulingPlanet ? "#c084fc" : emissive}
              emissiveIntensity={(hovered ? 0.8 : 0.15) + emissiveBoost}
              roughness={0.7}
              metalness={0.05}
            />
          ) : (
            <meshStandardMaterial
              color={color}
              emissive={isRulingPlanet ? "#c084fc" : emissive}
              emissiveIntensity={(hovered ? 1.5 : 0.3) + emissiveBoost}
              roughness={0.6}
              metalness={0.1}
            />
          )}
        </mesh>
        {name === "Saturn" && (
          <mesh rotation={[-Math.PI / 2.5, 0, 0]}>
            <ringGeometry args={[size * 1.4, size * 2.2, 64]} />
            <meshBasicMaterial color="#d4b96a" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        )}
        {isRulingPlanet && <RulingPlanetAura size={size} isVenus={name === "Venus"} />}
        {hovered && (
          <Html distanceFactor={15} center style={{ pointerEvents: "none" }}>
            <div style={{
              background: "rgba(0,0,0,0.85)",
              border: `1px solid ${isRulingPlanet ? "rgba(192,132,252,0.7)" : "rgba(139,92,246,0.5)"}`,
              borderRadius: "8px",
              padding: "6px 12px",
              color: "#e2e8f0",
              fontFamily: "monospace",
              fontSize: "11px",
              whiteSpace: "nowrap",
              backdropFilter: "blur(8px)",
            }}>
              {name}{isRulingPlanet ? " ✦ Ruling Planet" : ""}
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

function DimensionParticles({ radius, color, dimIndex, opacityRef }: {
  radius: number;
  color: string;
  dimIndex: number;
  opacityRef: React.MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Points>(null);
  const counts = [200, 250, 350, 280, 300, 320, 400];
  const count = counts[dimIndex] || 300;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, z = 0;
      if (dimIndex === 0) {
        const theta = Math.random() * Math.PI * 2;
        const r2d = radius + (Math.random() - 0.5) * 2;
        x = r2d * Math.cos(theta);
        y = (Math.random() - 0.5) * 3;
        z = r2d * Math.sin(theta);
      } else if (dimIndex === 2) {
        const spiralAngle = (i / count) * Math.PI * 8;
        const spiralR = radius * 0.8 + (i / count) * radius * 0.4;
        x = spiralR * Math.cos(spiralAngle);
        y = (Math.random() - 0.5) * 12;
        z = spiralR * Math.sin(spiralAngle);
      } else if (dimIndex === 6) {
        const goldenAngle = i * Math.PI * (3 - Math.sqrt(5));
        const r = radius * 0.6 + (i / count) * radius * 0.5;
        const elevation = Math.sin(i * 0.1) * radius * 0.3;
        x = r * Math.cos(goldenAngle);
        y = elevation;
        z = r * Math.sin(goldenAngle);
      } else {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius + (Math.random() - 0.5) * 4;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
      }
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const speedFactor = [0.2, 0.4, 0.9, 0.35, 0.5, 0.7, 1.0][dimIndex] || 0.5;
      vel[i * 3] = (Math.random() - 0.5) * speedFactor;
      vel[i * 3 + 1] = (Math.random() - 0.5) * speedFactor;
      vel[i * 3 + 2] = (Math.random() - 0.5) * speedFactor;
    }
    return { positions: pos, velocities: vel };
  }, [radius, dimIndex, count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const o = opacityRef.current;
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = o * 0.6;
    if (o < 0.01) return;

    const t = clock.getElapsedTime();
    const geo = ref.current.geometry;
    const posAttr = geo.getAttribute("position");
    const arr = posAttr.array as Float32Array;

    const solfeggioFreqs = [0.396, 0.417, 0.528, 0.639, 0.741, 0.852, 0.963];
    const freq = solfeggioFreqs[dimIndex] || 0.5;
    const pulse = Math.sin(t * freq * 2) * 0.3;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const phase = i * 0.1;
      arr[ix] = positions[ix] + velocities[ix] * Math.sin(t + phase) + pulse * Math.cos(t * 0.5 + i);
      arr[ix + 1] = positions[ix + 1] + velocities[ix + 1] * Math.cos(t * 0.7 + phase);
      arr[ix + 2] = positions[ix + 2] + velocities[ix + 2] * Math.sin(t * 0.5 + phase) + pulse * 0.5;
    }
    posAttr.needsUpdate = true;

    ref.current.rotation.y = t * [0.003, 0.005, 0.004, 0.002, 0.006, 0.007, 0.008][dimIndex];
  });

  const sizes = [0.25, 0.2, 0.4, 0.22, 0.3, 0.35, 0.45];

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.slice(), 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={sizes[dimIndex] || 0.3}
        color={color}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SriYantraOverlay({ radius, color, opacityRef }: { radius: number; color: string; opacityRef: React.MutableRefObject<number> }) {
  const linePositions = useMemo(() => {
    const lines: number[] = [];
    const triangles = [
      [[0, radius * 0.7], [-radius * 0.6, -radius * 0.35], [radius * 0.6, -radius * 0.35]],
      [[0, -radius * 0.65], [-radius * 0.55, radius * 0.32], [radius * 0.55, radius * 0.32]],
      [[0, radius * 0.5], [-radius * 0.43, -radius * 0.25], [radius * 0.43, -radius * 0.25]],
      [[0, -radius * 0.45], [-radius * 0.38, radius * 0.22], [radius * 0.38, radius * 0.22]],
      [[0, radius * 0.3], [-radius * 0.26, -radius * 0.15], [radius * 0.26, -radius * 0.15]],
    ];
    for (const tri of triangles) {
      for (let i = 0; i < 3; i++) {
        const a = tri[i];
        const b = tri[(i + 1) % 3];
        lines.push(a[0], a[1], 0, b[0], b[1], 0);
      }
    }
    return new Float32Array(lines);
  }, [radius]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacityRef.current * 0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

function VesicaPiscisOverlay({ radius, color, opacityRef }: { radius: number; color: string; opacityRef: React.MutableRefObject<number> }) {
  const r = radius * 0.4;
  const offset = r * 0.5;
  return (
    <group>
      <mesh position={[-offset, 0, 0]}>
        <ringGeometry args={[r - 0.1, r + 0.1, 64]} />
        <meshBasicMaterial color={color} transparent opacity={opacityRef.current * 0.08} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[offset, 0, 0]}>
        <ringGeometry args={[r - 0.1, r + 0.1, 64]} />
        <meshBasicMaterial color={color} transparent opacity={opacityRef.current * 0.08} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function SacredGeometryWireframe({ radius, color, dimIndex, opacityRef }: {
  radius: number;
  color: string;
  dimIndex: number;
  opacityRef: React.MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  const pulseRef = useRef(0);

  const SOLFEGGIO_RATES = [0.396, 0.417, 0.528, 0.639, 0.741, 0.852, 0.963];

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const speeds = [0.002, 0.003, 0.004, 0.0015, 0.005, 0.0035, 0.006];
    ref.current.rotation.y = t * (speeds[dimIndex] || 0.003);
    ref.current.rotation.x = Math.sin(t * 0.001 * (dimIndex + 1)) * 0.05;

    const solfeggioRate = SOLFEGGIO_RATES[dimIndex] || 0.5;
    pulseRef.current = 0.8 + Math.sin(t * solfeggioRate * 2) * 0.2;

    ref.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = opacityRef.current * 0.12 * pulseRef.current;
      }
      if (child instanceof THREE.LineSegments && child.material instanceof THREE.LineBasicMaterial) {
        child.material.opacity = opacityRef.current * 0.1 * pulseRef.current;
      }
    });
  });

  return (
    <group ref={ref}>
      {dimIndex === 0 && (
        <mesh>
          <tetrahedronGeometry args={[radius * 0.95, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.12} depthWrite={false} />
        </mesh>
      )}
      {dimIndex === 1 && (
        <group>
          <mesh>
            <boxGeometry args={[radius * 1.3, radius * 1.3, radius * 1.3]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.12} depthWrite={false} />
          </mesh>
          <VesicaPiscisOverlay radius={radius} color={color} opacityRef={opacityRef} />
        </group>
      )}
      {dimIndex === 2 && (
        <mesh>
          <octahedronGeometry args={[radius * 0.95, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.12} depthWrite={false} />
        </mesh>
      )}
      {dimIndex === 3 && (
        <group>
          <mesh>
            <icosahedronGeometry args={[radius * 0.95, 0]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.1} depthWrite={false} />
          </mesh>
          <SriYantraOverlay radius={radius} color={color} opacityRef={opacityRef} />
        </group>
      )}
      {dimIndex === 4 && (
        <mesh>
          <dodecahedronGeometry args={[radius * 0.95, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.12} depthWrite={false} />
        </mesh>
      )}
      {dimIndex === 5 && (
        <group>
          <mesh>
            <icosahedronGeometry args={[radius * 0.95, 1]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.08} depthWrite={false} />
          </mesh>
          <mesh>
            <dodecahedronGeometry args={[radius * 0.75, 0]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.06} depthWrite={false} />
          </mesh>
        </group>
      )}
      {dimIndex === 6 && (
        <group>
          <mesh>
            <icosahedronGeometry args={[radius * 0.95, 2]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.06} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[radius * 0.5, 6, 6]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.08} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function EnergyFlowRing({ radius, color, dimIndex, opacityRef }: {
  radius: number;
  color: string;
  dimIndex: number;
  opacityRef: React.MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const rotSpeeds = [0.01, 0.015, 0.008, 0.012, 0.02, 0.018, 0.025];
    ref.current.rotation.z = t * (rotSpeeds[dimIndex] || 0.01);
    const pulse = 0.5 + Math.sin(t * (0.5 + dimIndex * 0.15)) * 0.5;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = opacityRef.current * 0.06 * pulse;
  });

  const tiltAngles = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 0.15];

  return (
    <mesh ref={ref} rotation={[Math.PI / 2 + (tiltAngles[dimIndex] || 0), 0, 0]}>
      <torusGeometry args={[radius, 0.3 + dimIndex * 0.05, 8, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function DimensionLabel({ radius, color, name, freq, opacityRef }: {
  radius: number;
  color: string;
  name: string;
  freq: string;
  opacityRef: React.MutableRefObject<number>;
}) {
  const nameRef = useRef<THREE.Mesh>(null);
  const freqRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const o = opacityRef.current;
    if (nameRef.current) {
      const mat = nameRef.current.material as THREE.MeshBasicMaterial;
      if (mat && "opacity" in mat) mat.opacity = o > 0.3 ? o : 0;
    }
    if (freqRef.current) {
      const mat = freqRef.current.material as THREE.MeshBasicMaterial;
      if (mat && "opacity" in mat) mat.opacity = o > 0.3 ? o * 0.6 : 0;
    }
  });

  return (
    <>
      <Text
        ref={nameRef}
        position={[0, radius + 1.5, 0]}
        fontSize={1.8}
        color={color}
        anchorX="center"
        anchorY="bottom"
        font="https://fonts.gstatic.com/s/spacemono/v13/i7dPIFZifjKcF5UAWdDRYEF8RQ.woff2"
        fillOpacity={1}
      >
        {name}
      </Text>
      <Text
        ref={freqRef}
        position={[0, radius - 0.5, 0]}
        fontSize={1.2}
        color={color}
        anchorX="center"
        anchorY="top"
        font="https://fonts.gstatic.com/s/spacemono/v13/i7dPIFZifjKcF5UAWdDRYEF8RQ.woff2"
        fillOpacity={0.6}
      >
        {freq}
      </Text>
    </>
  );
}

function DimensionalShell({ radius, color, name, freq, dimIndex, opacity: targetOpacity }: {
  radius: number;
  color: string;
  name: string;
  freq: string;
  dimIndex: number;
  opacity: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const smoothOpacity = useRef(targetOpacity);
  const [visible, setVisible] = useState(targetOpacity > 0.01);

  useFrame(({ clock }) => {
    smoothOpacity.current += (targetOpacity - smoothOpacity.current) * 0.04;

    if (smoothOpacity.current < 0.01 && visible) setVisible(false);
    else if (smoothOpacity.current >= 0.01 && !visible) setVisible(true);

    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.y = t * 0.003;
      meshRef.current.rotation.x = Math.sin(t * 0.002) * 0.1;
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = smoothOpacity.current * 0.025;
    }
  });

  if (!visible) return null;

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={targetOpacity * 0.025}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <DimensionParticles radius={radius} color={color} dimIndex={dimIndex} opacityRef={smoothOpacity} />
      <SacredGeometryWireframe radius={radius} color={color} dimIndex={dimIndex} opacityRef={smoothOpacity} />
      <EnergyFlowRing radius={radius} color={color} dimIndex={dimIndex} opacityRef={smoothOpacity} />

      <DimensionLabel radius={radius} color={color} name={name} freq={freq} opacityRef={smoothOpacity} />
    </group>
  );
}

function ZodiacConstellation({ sign, signColor, isNatal }: { sign: string; signColor: string; isNatal?: boolean }) {
  const data = CONSTELLATION_DATA[sign];
  if (!data) return null;

  const { starPositions, linePositions, center } = useMemo(() => {
    const baseTheta = Math.PI * 0.25;
    const basePhi = Math.PI * 0.3;
    const r = 170;
    const scale = 3;

    const stars3d = data.stars.map(([sx, sy]) => {
      const theta = baseTheta + sx * 0.02 * scale;
      const phi = basePhi + sy * 0.02 * scale;
      return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    });

    const sp = new Float32Array(stars3d.length * 3);
    const cx = stars3d.reduce((s, v) => s + v.x, 0) / stars3d.length;
    const cy = stars3d.reduce((s, v) => s + v.y, 0) / stars3d.length;
    const cz = stars3d.reduce((s, v) => s + v.z, 0) / stars3d.length;
    stars3d.forEach((v, i) => {
      sp[i * 3] = v.x;
      sp[i * 3 + 1] = v.y;
      sp[i * 3 + 2] = v.z;
    });

    const lp = new Float32Array(data.lines.length * 6);
    data.lines.forEach(([a, b], i) => {
      const va = stars3d[a];
      const vb = stars3d[b];
      if (va && vb) {
        lp[i * 6] = va.x;
        lp[i * 6 + 1] = va.y;
        lp[i * 6 + 2] = va.z;
        lp[i * 6 + 3] = vb.x;
        lp[i * 6 + 4] = vb.y;
        lp[i * 6 + 5] = vb.z;
      }
    });

    return { starPositions: sp, linePositions: lp, center: new THREE.Vector3(cx, cy, cz) };
  }, [data]);

  const starsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (starsRef.current) {
      const mat = starsRef.current.material as THREE.PointsMaterial;
      mat.opacity = isNatal ? (0.85 + Math.sin(t * 1.0) * 0.15) : (0.7 + Math.sin(t * 0.8) * 0.3);
      mat.size = isNatal ? 2.2 : 1.5;
    }
    if (linesRef.current) {
      const mat = linesRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = isNatal ? (0.25 + Math.sin(t * 0.6) * 0.12) : (0.15 + Math.sin(t * 0.5) * 0.1);
    }
    if (glowRef.current) {
      const s = 1 + Math.sin(t * 0.5) * 0.15;
      glowRef.current.scale.setScalar(s);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.03 + Math.sin(t * 0.8) * 0.015;
    }
  });

  return (
    <group>
      {isNatal && (
        <mesh ref={glowRef} position={[center.x, center.y, center.z]}>
          <sphereGeometry args={[18, 16, 16]} />
          <meshBasicMaterial color={signColor} transparent opacity={0.03} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={isNatal ? 2.2 : 1.5} color={signColor} transparent opacity={0.8} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={signColor} transparent opacity={isNatal ? 0.3 : 0.2} depthWrite={false} />
      </lineSegments>
      {isNatal && (
        <Text
          position={[center.x, center.y + 12, center.z]}
          fontSize={2.5}
          color={signColor}
          anchorX="center"
          anchorY="bottom"
          font="https://fonts.gstatic.com/s/spacemono/v13/i7dPIFZifjKcF5UAWdDRYEF8RQ.woff2"
          fillOpacity={0.6}
        >
          {`♎ ${sign}`}
        </Text>
      )}
    </group>
  );
}

function NebulaParticles() {
  const count = 1200;
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = i * GOLDEN_ANGLE;
      const fibIdx = i % FIB.length;
      const r = 55 + (FIB[fibIdx] / 144) * 90 + Math.random() * 8;
      const y = (Math.sin(i * 0.05) * 15) + (Math.random() - 0.5) * 10;
      const spiralR = r * (1 + 0.02 * Math.sin(i * 0.1));
      pos[i * 3] = spiralR * Math.cos(theta);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = spiralR * Math.sin(theta);
    }
    return pos;
  }, []);

  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3);
    const palette = [
      [0.54, 0.36, 0.96],
      [0.06, 0.71, 0.83],
      [0.96, 0.62, 0.04],
      [0.98, 0.44, 0.52],
      [0.65, 0.55, 0.98],
      [0.13, 0.83, 0.87],
      [0.78, 0.56, 1.0],
    ];
    for (let i = 0; i < count; i++) {
      const fibBlend = (FIB[i % FIB.length] / 144);
      const pIdx = Math.floor(fibBlend * (palette.length - 1));
      const c = palette[pIdx];
      cols[i * 3] = c[0];
      cols[i * 3 + 1] = c[1];
      cols[i * 3 + 2] = c[2];
    }
    return cols;
  }, []);

  const ref = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.0015;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.35} vertexColors transparent opacity={0.55} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function FlowerOfLifeOverlay() {
  const groupRef = useRef<THREE.Group>(null);
  const CIRCLE_COUNT = 19;
  const RADIUS = 8;

  const circlePositions = useMemo(() => {
    const positions: [number, number][] = [[0, 0]];
    for (let ring = 1; ring <= 2; ring++) {
      const count = ring === 1 ? 6 : 12;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (ring === 2 ? Math.PI / 12 : 0);
        const r = RADIUS * ring;
        positions.push([Math.cos(angle) * r, Math.sin(angle) * r]);
      }
    }
    return positions.slice(0, CIRCLE_COUNT);
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.rotation.z = t * 0.01;
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.opacity = 0.06 + Math.sin(t * 0.5) * 0.02;
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
      {circlePositions.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <ringGeometry args={[RADIUS - 0.05, RADIUS + 0.05, 64]} />
          <meshBasicMaterial color="#c084fc" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function MetatronsCubeOverlay() {
  const groupRef = useRef<THREE.Group>(null);

  const linePositions = useMemo(() => {
    const vertices: THREE.Vector3[] = [];
    vertices.push(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      vertices.push(new THREE.Vector3(Math.cos(angle) * 12, Math.sin(angle) * 12, 0));
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      vertices.push(new THREE.Vector3(Math.cos(angle) * 20, Math.sin(angle) * 20, 0));
    }

    const lines: number[] = [];
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        lines.push(vertices[i].x, vertices[i].y, vertices[i].z);
        lines.push(vertices[j].x, vertices[j].y, vertices[j].z);
      }
    }
    return new Float32Array(lines);
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.rotation.z = t * 0.008;
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.LineSegments && child.material instanceof THREE.LineBasicMaterial) {
          child.material.opacity = 0.04 + Math.sin(t * 0.3) * 0.02;
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 25, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#e879f9" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {Array.from({ length: 13 }).map((_, i) => {
        const angle = (i / 13) * Math.PI * 2;
        const r = i === 0 ? 0 : i < 7 ? 12 : 20;
        const a = i === 0 ? 0 : i < 7 ? ((i - 1) / 6) * Math.PI * 2 : ((i - 7) / 6) * Math.PI * 2 + Math.PI / 6;
        return (
          <mesh key={i} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color="#c084fc" transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
    </group>
  );
}

interface ApodItem {
  title: string;
  url: string;
  explanation: string;
}

function ApodGallery({ items }: { items: ApodItem[] }) {
  return (
    <group>
      {items.map((item, i) => (
        <ApodPanel key={i} item={item} index={i} total={items.length} />
      ))}
    </group>
  );
}

function ApodPanel({ item, index, total }: { item: ApodItem; index: number; total: number }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!item.url) return;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(
      item.url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {}
    );
  }, [item.url]);

  const angle = (index / total) * Math.PI * 2;
  const galleryRadius = 120;
  const x = Math.cos(angle) * galleryRadius;
  const z = Math.sin(angle) * galleryRadius;
  const yaw = -angle + Math.PI;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.3 + index) * 0.5;
    }
  });

  if (!texture) return null;

  return (
    <group position={[x, 15, z]} rotation={[0, yaw, 0]}>
      <mesh ref={meshRef}>
        <planeGeometry args={[16, 10]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <Text
        position={[0, -6, 0]}
        fontSize={0.8}
        color="#a78bfa"
        maxWidth={14}
        textAlign="center"
        anchorX="center"
        anchorY="top"
        font="https://fonts.gstatic.com/s/spacemono/v13/i7dPIFZifjKcF5UAWdDRYEF8RQ.woff2"
      >
        {item.title}
      </Text>
    </group>
  );
}

interface OrbitControlsLike {
  autoRotate: boolean;
  autoRotateSpeed: number;
}

const orbitControlsRef: { current: OrbitControlsLike | null } = { current: null };

function isOrbitControlsLike(obj: unknown): obj is OrbitControlsLike {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "autoRotate" in obj &&
    "autoRotateSpeed" in obj
  );
}

function OrbitControlsRefCapture() {
  const state = useThree();
  useEffect(() => {
    if (isOrbitControlsLike(state.controls)) {
      orbitControlsRef.current = state.controls;
    }
  }, [state.controls]);
  return null;
}

function AutoRotateController() {
  const lastInteraction = useRef(Date.now());
  const { gl, camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const lastMouse = useRef({ x: 0, y: 0, time: 0 });

  const onInteraction = useCallback(() => {
    lastInteraction.current = Date.now();
    if (orbitControlsRef.current) {
      orbitControlsRef.current.autoRotate = false;
    }
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    velocity.current.addScaledVector(forward, -e.deltaY * 0.003);
  }, [camera]);

  useEffect(() => {
    const canvas = gl.domElement;
    const events = ["pointerdown", "pointermove", "touchstart", "touchmove"] as const;
    events.forEach(e => canvas.addEventListener(e, onInteraction));
    canvas.addEventListener("wheel", onWheel as EventListener, { passive: true });
    return () => {
      events.forEach(e => canvas.removeEventListener(e, onInteraction));
      canvas.removeEventListener("wheel", onWheel as EventListener);
    };
  }, [gl, onInteraction, onWheel]);

  useFrame(() => {
    const ctrl = orbitControlsRef.current;
    if (!ctrl) return;
    const idle = Date.now() - lastInteraction.current > 5000;
    if (idle && !ctrl.autoRotate) {
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.3;
    }

    if (velocity.current.lengthSq() > 0.0001) {
      camera.position.add(velocity.current);
      velocity.current.multiplyScalar(0.92);
    }
  });

  return null;
}

function SceneContent({ showDimensions, isMobile, apodItems, userZodiac, dimensionOpacities, showSacredOverlays }: {
  showDimensions: boolean;
  isMobile: boolean;
  apodItems: ApodItem[];
  userZodiac?: { sign: string; symbol: string; ruler: string; element: string } | null;
  dimensionOpacities: number[];
  showSacredOverlays?: boolean;
}) {
  const initialAngles = useMemo(() =>
    PLANETS_DATA.map(() => Math.random() * Math.PI * 2), []);

  const ELEMENT_COLORS: Record<string, string> = {
    Fire: "#f87171",
    Earth: "#4ade80",
    Air: "#22d3ee",
    Water: "#60a5fa",
  };

  const signColor = userZodiac ? (ELEMENT_COLORS[userZodiac.element] || "#a78bfa") : "#a78bfa";

  return (
    <>
      <ambientLight intensity={0.15} />
      <Sun isRuler={userZodiac?.ruler === "Sun"} />
      {PLANETS_DATA.map((p, i) => (
        <PlanetWithTexture
          key={p.name}
          {...p}
          initialAngle={initialAngles[i]}
          isRulingPlanet={userZodiac ? p.name === userZodiac.ruler : false}
        />
      ))}
      {DIMENSIONS.map((d, i) => (
        <DimensionalShell
          key={d.id}
          radius={d.radius}
          color={d.color}
          name={d.name}
          freq={d.freq}
          dimIndex={i}
          opacity={showDimensions ? dimensionOpacities[i] : 0}
        />
      ))}
      {userZodiac && <ZodiacConstellation sign={userZodiac.sign} signColor={signColor} isNatal={userZodiac.sign === "Libra"} />}
      {apodItems.length > 0 && <ApodGallery items={apodItems} />}
      {showSacredOverlays && <FlowerOfLifeOverlay />}
      {showSacredOverlays && <MetatronsCubeOverlay />}
      <Stars radius={250} depth={150} count={isMobile ? 3000 : 8000} factor={3.5} saturation={0.3} fade speed={0.4} />
      <NebulaParticles />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={250}
        zoomSpeed={1.0}
        panSpeed={0.6}
        rotateSpeed={0.5}
        enableDamping
        dampingFactor={0.05}
        autoRotate={false}
        autoRotateSpeed={0.3}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
      <OrbitControlsRefCapture />
      <AutoRotateController />
    </>
  );
}

interface SolarSystem3DProps {
  showDimensions: boolean;
  apodItems: ApodItem[];
  userZodiac?: { sign: string; symbol: string; ruler: string; element: string } | null;
  dimensionOpacities: number[];
  showSacredOverlays?: boolean;
}

function WebGLFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#030108]">
      <div className="text-center p-6 max-w-md">
        <div className="text-4xl mb-4">🌌</div>
        <h2 className="text-lg font-bold font-mono text-violet-400 mb-2">3D Universe</h2>
        <p className="text-sm text-muted-foreground">
          WebGL is required for the 3D cosmos view. Please use a browser with GPU acceleration enabled.
        </p>
      </div>
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

export default function SolarSystem3D({ showDimensions, apodItems, userZodiac, dimensionOpacities, showSacredOverlays }: SolarSystem3DProps) {
  const isMobile = useIsMobile();
  const [contextLost, setContextLost] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const hasWebGL = useMemo(() => detectWebGL(), []);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const canvas = container.querySelector("canvas");
    if (!canvas) return;

    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [hasWebGL]);

  if (!hasWebGL || contextLost) {
    return <WebGLFallback />;
  }

  return (
    <WebGLErrorBoundary fallback={<WebGLFallback />}>
      <div ref={canvasContainerRef} style={{ width: "100%", height: "100%" }}>
        <Canvas
          camera={{ position: [0, 25, 50], fov: 55, near: 0.1, far: 500 }}
          style={{ width: "100%", height: "100%" }}
          gl={{ antialias: !isMobile, alpha: false, powerPreference: "high-performance" }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
        >
          <color attach="background" args={["#030108"]} />
          <fog attach="fog" args={["#030108", 150, 350]} />
          <SceneContent
            showDimensions={showDimensions}
            isMobile={isMobile}
            apodItems={apodItems}
            userZodiac={userZodiac}
            dimensionOpacities={dimensionOpacities}
            showSacredOverlays={showSacredOverlays}
          />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
