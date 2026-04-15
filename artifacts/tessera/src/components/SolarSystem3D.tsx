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

const PLANETS_DATA = [
  { name: "Mercury", distance: 4, size: 0.3, speed: 0.008, color: "#a0a0a0", emissive: "#3a3a3a" },
  { name: "Venus", distance: 6, size: 0.5, speed: 0.006, color: "#e8c373", emissive: "#5a4020" },
  { name: "Earth", distance: 8.5, size: 0.55, speed: 0.005, color: "#4a90d9", emissive: "#1a3050" },
  { name: "Mars", distance: 11, size: 0.4, speed: 0.004, color: "#c1440e", emissive: "#4a1a05" },
  { name: "Jupiter", distance: 17, size: 1.4, speed: 0.002, color: "#c88b3a", emissive: "#3a2a10" },
  { name: "Saturn", distance: 23, size: 1.2, speed: 0.0015, color: "#e8d082", emissive: "#4a3a15" },
  { name: "Uranus", distance: 30, size: 0.9, speed: 0.001, color: "#73c2d6", emissive: "#1a3a40" },
  { name: "Neptune", distance: 38, size: 0.85, speed: 0.0008, color: "#3f54ba", emissive: "#1a1a40" },
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

function RulingPlanetAura({ size }: { size: number }) {
  const particlesRef = useRef<THREE.Points>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const count = 200;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = size * (1.5 + Math.random() * 1.5);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [size]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.3;
      particlesRef.current.rotation.x = Math.sin(t * 0.2) * 0.2;
    }
    if (auraRef.current) {
      const s = 1 + Math.sin(t * 1.5) * 0.1;
      auraRef.current.scale.setScalar(s);
      (auraRef.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(t * 2) * 0.04;
    }
  });

  return (
    <group>
      <mesh ref={auraRef}>
        <sphereGeometry args={[size * 2.5, 32, 32]} />
        <meshBasicMaterial color="#e879f9" transparent opacity={0.1} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[size * 3.5, 32, 32]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.04} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.08} color="#e879f9" transparent opacity={0.7} sizeAttenuation depthWrite={false} />
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
        {isRulingPlanet && <RulingPlanetAura size={size} />}
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
  const count = 300;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius + (Math.random() - 0.5) * 4;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const speedFactor = [0.3, 0.5, 0.8, 0.4, 0.6, 0.9, 1.2][dimIndex] || 0.5;
      vel[i * 3] = (Math.random() - 0.5) * speedFactor;
      vel[i * 3 + 1] = (Math.random() - 0.5) * speedFactor;
      vel[i * 3 + 2] = (Math.random() - 0.5) * speedFactor;
    }
    return { positions: pos, velocities: vel };
  }, [radius, dimIndex]);

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

    const patterns = [
      () => Math.sin(t * 0.5) * 0.15,
      () => Math.cos(t * 0.3) * 0.2,
      () => Math.sin(t * 0.7) * Math.cos(t * 0.4) * 0.1,
      () => Math.sin(t * 0.2) * 0.08,
      () => Math.cos(t * 0.6) * 0.12,
      () => Math.sin(t * 1.0) * 0.06,
      () => Math.sin(t * 0.8) * Math.sin(t * 0.3) * 0.15,
    ];

    const drift = patterns[dimIndex]?.() ?? 0;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      arr[ix] = positions[ix] + velocities[ix] * Math.sin(t + i) + drift;
      arr[ix + 1] = positions[ix + 1] + velocities[ix + 1] * Math.cos(t * 0.7 + i * 0.5);
      arr[ix + 2] = positions[ix + 2] + velocities[ix + 2] * Math.sin(t * 0.5 + i * 0.3) + drift * 0.5;
    }
    posAttr.needsUpdate = true;

    ref.current.rotation.y = t * [0.003, 0.005, 0.004, 0.002, 0.006, 0.007, 0.008][dimIndex];
  });

  const sizes = [0.3, 0.25, 0.35, 0.2, 0.28, 0.32, 0.4];

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

function SacredGeometryWireframe({ radius, color, dimIndex, opacityRef }: {
  radius: number;
  color: string;
  dimIndex: number;
  opacityRef: React.MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const speeds = [0.002, 0.003, 0.004, 0.0015, 0.005, 0.0035, 0.006];
    ref.current.rotation.y = t * (speeds[dimIndex] || 0.003);
    ref.current.rotation.x = Math.sin(t * 0.001 * (dimIndex + 1)) * 0.05;
    ref.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = opacityRef.current * 0.12;
      }
    });
  });

  const wireframeOpacity = 0.12;

  const geometries: Record<number, React.JSX.Element> = {
    0: (
      <mesh>
        <icosahedronGeometry args={[radius * 0.98, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={wireframeOpacity} depthWrite={false} />
      </mesh>
    ),
    1: (
      <mesh>
        <dodecahedronGeometry args={[radius * 0.98, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={wireframeOpacity} depthWrite={false} />
      </mesh>
    ),
    2: (
      <mesh>
        <octahedronGeometry args={[radius * 0.98, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={wireframeOpacity} depthWrite={false} />
      </mesh>
    ),
    3: (
      <mesh>
        <icosahedronGeometry args={[radius * 0.98, 2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={wireframeOpacity * 0.7} depthWrite={false} />
      </mesh>
    ),
    4: (
      <mesh>
        <dodecahedronGeometry args={[radius * 0.98, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={wireframeOpacity} depthWrite={false} />
      </mesh>
    ),
    5: (
      <mesh>
        <tetrahedronGeometry args={[radius * 0.98, 2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={wireframeOpacity} depthWrite={false} />
      </mesh>
    ),
    6: (
      <mesh>
        <icosahedronGeometry args={[radius * 0.98, 3]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={wireframeOpacity * 0.5} depthWrite={false} />
      </mesh>
    ),
  };

  return (
    <group ref={ref}>
      {geometries[dimIndex] || geometries[0]}
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

function ZodiacConstellation({ sign, signColor }: { sign: string; signColor: string }) {
  const data = CONSTELLATION_DATA[sign];
  if (!data) return null;

  const { starPositions, linePositions } = useMemo(() => {
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

    return { starPositions: sp, linePositions: lp };
  }, [data]);

  const starsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (starsRef.current) {
      const mat = starsRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.7 + Math.sin(t * 0.8) * 0.3;
    }
    if (linesRef.current) {
      const mat = linesRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.15 + Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <group>
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.5} color={signColor} transparent opacity={0.8} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={signColor} transparent opacity={0.2} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

function NebulaParticles() {
  const count = 800;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 60 + Math.random() * 80;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
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
    ];
    for (let i = 0; i < count; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)];
      cols[i * 3] = c[0];
      cols[i * 3 + 1] = c[1];
      cols[i * 3 + 2] = c[2];
    }
    return cols;
  }, []);

  const ref = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.002;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.4} vertexColors transparent opacity={0.6} sizeAttenuation depthWrite={false} />
    </points>
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
  const { gl } = useThree();

  const onInteraction = useCallback(() => {
    lastInteraction.current = Date.now();
    if (orbitControlsRef.current) {
      orbitControlsRef.current.autoRotate = false;
    }
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    const events = ["pointerdown", "pointermove", "wheel", "touchstart", "touchmove"] as const;
    events.forEach(e => canvas.addEventListener(e, onInteraction));
    return () => {
      events.forEach(e => canvas.removeEventListener(e, onInteraction));
    };
  }, [gl, onInteraction]);

  useFrame(() => {
    const ctrl = orbitControlsRef.current;
    if (!ctrl) return;
    const idle = Date.now() - lastInteraction.current > 5000;
    if (idle && !ctrl.autoRotate) {
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.3;
    }
  });

  return null;
}

function SceneContent({ showDimensions, isMobile, apodItems, userZodiac, dimensionOpacities }: {
  showDimensions: boolean;
  isMobile: boolean;
  apodItems: ApodItem[];
  userZodiac?: { sign: string; symbol: string; ruler: string; element: string } | null;
  dimensionOpacities: number[];
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
      {userZodiac && <ZodiacConstellation sign={userZodiac.sign} signColor={signColor} />}
      {apodItems.length > 0 && <ApodGallery items={apodItems} />}
      <Stars radius={200} depth={100} count={isMobile ? 2000 : 6000} factor={3} saturation={0.3} fade speed={0.5} />
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

export default function SolarSystem3D({ showDimensions, apodItems, userZodiac, dimensionOpacities }: SolarSystem3DProps) {
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
          />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
