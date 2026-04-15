import { useRef, useMemo, useState, useEffect, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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

function Sun() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.05;
    }
    if (glowRef.current) {
      const scale = 1.8 + Math.sin(t * 0.5) * 0.15;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group>
      <pointLight position={[0, 0, 0]} intensity={3} distance={200} color="#ffcc44" />
      <pointLight position={[0, 0, 0]} intensity={1.5} distance={300} color="#ff8800" />
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.08} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.8, 48, 48]} />
        <meshStandardMaterial
          color="#ffcc22"
          emissive="#ff8800"
          emissiveIntensity={2}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}

function PlanetWithTexture({ name, distance, size, speed, color, emissive, initialAngle }: {
  name: string;
  distance: number;
  size: number;
  speed: number;
  color: string;
  emissive: string;
  initialAngle: number;
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
      () => { /* fallback to procedural color */ }
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
              emissive={emissive}
              emissiveIntensity={hovered ? 0.8 : 0.15}
              roughness={0.7}
              metalness={0.05}
            />
          ) : (
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={hovered ? 1.5 : 0.3}
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
        {hovered && (
          <Html distanceFactor={15} center style={{ pointerEvents: "none" }}>
            <div style={{
              background: "rgba(0,0,0,0.85)",
              border: "1px solid rgba(139,92,246,0.5)",
              borderRadius: "8px",
              padding: "6px 12px",
              color: "#e2e8f0",
              fontFamily: "monospace",
              fontSize: "11px",
              whiteSpace: "nowrap",
              backdropFilter: "blur(8px)",
            }}>
              {name}
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

function DimensionalShell({ radius, color, name, freq, visible }: {
  radius: number;
  color: string;
  name: string;
  freq: string;
  visible: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.y = t * 0.003;
      meshRef.current.rotation.x = Math.sin(t * 0.002) * 0.1;
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
          opacity={0.035}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[0, radius + 1.5, 0]}
        fontSize={1.8}
        color={color}
        anchorX="center"
        anchorY="bottom"
        font="https://fonts.gstatic.com/s/spacemono/v13/i7dPIFZifjKcF5UAWdDRYEF8RQ.woff2"
      >
        {name}
      </Text>
      <Text
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

function SceneContent({ showDimensions, isMobile, apodItems }: {
  showDimensions: boolean;
  isMobile: boolean;
  apodItems: ApodItem[];
}) {
  const initialAngles = useMemo(() =>
    PLANETS_DATA.map(() => Math.random() * Math.PI * 2), []);

  return (
    <>
      <ambientLight intensity={0.15} />
      <Sun />
      {PLANETS_DATA.map((p, i) => (
        <PlanetWithTexture key={p.name} {...p} initialAngle={initialAngles[i]} />
      ))}
      {DIMENSIONS.map((d) => (
        <DimensionalShell
          key={d.id}
          radius={d.radius}
          color={d.color}
          name={d.name}
          freq={d.freq}
          visible={showDimensions}
        />
      ))}
      {apodItems.length > 0 && <ApodGallery items={apodItems} />}
      <Stars radius={200} depth={100} count={isMobile ? 2000 : 6000} factor={3} saturation={0.3} fade speed={0.5} />
      <NebulaParticles />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={3}
        maxDistance={180}
        zoomSpeed={0.8}
        panSpeed={0.6}
        rotateSpeed={0.5}
        enableDamping
        dampingFactor={0.05}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}

interface SolarSystem3DProps {
  showDimensions: boolean;
  apodItems: ApodItem[];
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

export default function SolarSystem3D({ showDimensions, apodItems }: SolarSystem3DProps) {
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
          <fog attach="fog" args={["#030108", 120, 300]} />
          <SceneContent showDimensions={showDimensions} isMobile={isMobile} apodItems={apodItems} />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
