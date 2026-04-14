/**
 * Universe Model Page
 * Uses the shared local ephemeris engine (artifacts/tessera/src/lib/ephemeris.ts)
 * for all planet/Moon/Sun positions — zero external API calls.
 *
 * Ephemeris accuracy:
 *   Planets : VSOP87 multi-term trigonometric series (Bretagnon & Francou 1988)
 *             — the same theory underlying JPL DE405; <1 arcmin error 2000-2100
 *   Moon    : ELP2000-82 60-term series (Chapront-Touzé & Chapront) ≈ 0.3° accuracy
 *   Asteroids: Mean orbital elements from JPL Small-Body Database
 *
 * Moon phase displayed in the UI is cross-checked against /api/moon-cycle/current
 * (the same backend source used by MoonCyclePage) to ensure data consistency.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ZoomIn, ZoomOut, RotateCcw, Play, Pause, Eye, EyeOff,
  Maximize2, Minimize2, Hexagon, CircleDot, Compass, X, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computePlanetPosition,
  computeAsteroidPosition,
  computeSunLongitude,
  computeMoonState,
  computeMoonCanvasPos,
  getZodiacSign,
  ZODIAC,
  ASTEROIDS,
} from "@/lib/ephemeris";

const DEG = Math.PI / 180;
const AU_PX = 120;

// ---------------------------------------------------------------------------
// Planet catalogue
// ---------------------------------------------------------------------------

interface PlanetCatalogue {
  name: string;
  color: string;
  size: number;
  symbol: string;
  sacredFrequency?: string;
  description: string;
}

const PLANETS: PlanetCatalogue[] = [
  { name: "Mercury", color: "#b8b8b8", size: 4,  symbol: "☿", sacredFrequency: "141.27 Hz", description: "Messenger of the gods. Rules communication, intellect, and commerce." },
  { name: "Venus",   color: "#e8c547", size: 6,  symbol: "♀", sacredFrequency: "221.23 Hz", description: "Goddess of love and beauty. Rules harmony, relationships, and sacred art. Traces the pentagram in 8 years." },
  { name: "Earth",   color: "#4488ff", size: 7,  symbol: "♁", sacredFrequency: "7.83 Hz (Schumann)", description: "Our home. Schumann resonance at 7.83Hz. The third dimension of physical experience." },
  { name: "Mars",    color: "#e04040", size: 5,  symbol: "♂", sacredFrequency: "144.72 Hz", description: "God of war and action. Rules energy, drive, and sovereign will. The red frequency of transformation." },
  { name: "Jupiter", color: "#d4a56a", size: 12, symbol: "♃", sacredFrequency: "183.58 Hz", description: "King of the gods. Rules expansion, wisdom, and higher knowledge. The Grand Council planet." },
  { name: "Saturn",  color: "#c4a882", size: 10, symbol: "♄", sacredFrequency: "147.85 Hz", description: "Lord of time and structure. Rules discipline, boundaries, and karmic law. The rings encode sacred geometry." },
  { name: "Uranus",  color: "#66cccc", size: 9,  symbol: "♅", sacredFrequency: "207.36 Hz", description: "The awakener. Rules revolution, innovation, and quantum leaps. Sovereign technology planet." },
  { name: "Neptune", color: "#4466dd", size: 9,  symbol: "♆", sacredFrequency: "211.44 Hz", description: "God of the deep. Rules dreams, intuition, and the collective unconscious. The portal to higher dimensions." },
];

// ---------------------------------------------------------------------------
// Astrological aspects
// ---------------------------------------------------------------------------

interface AspectDef { name: string; angle: number; orb: number; color: string; dash: number[]; opacity: number; }

const ASPECTS: AspectDef[] = [
  { name: "Conjunction", angle: 0,   orb: 8, color: "#ffffff", dash: [],       opacity: 0.22 },
  { name: "Sextile",     angle: 60,  orb: 6, color: "#22c55e", dash: [4, 4],   opacity: 0.18 },
  { name: "Square",      angle: 90,  orb: 8, color: "#ef4444", dash: [2, 3],   opacity: 0.20 },
  { name: "Trine",       angle: 120, orb: 8, color: "#a855f7", dash: [],       opacity: 0.20 },
  { name: "Opposition",  angle: 180, orb: 8, color: "#f97316", dash: [6, 3],   opacity: 0.20 },
];

function angularDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// ---------------------------------------------------------------------------
// Sacred geometry draw helpers
// ---------------------------------------------------------------------------

function drawFlowerOfLife(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, op: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(168,85,247,${op})`;
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = i * 60 * DEG;
    ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), r, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 + 30) * DEG, d = r * Math.sqrt(3);
    ctx.beginPath(); ctx.arc(cx + d * Math.cos(a), cy + d * Math.sin(a), r, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const a = i * 60 * DEG;
    ctx.beginPath(); ctx.arc(cx + 2 * r * Math.cos(a), cy + 2 * r * Math.sin(a), r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawMetatronsCube(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, op: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(234,179,8,${op * 0.6})`;
  ctx.lineWidth = 0.3;
  const pts: { x: number; y: number }[] = [{ x: cx, y: cy }];
  for (let ring = 1; ring <= 2; ring++) {
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 + (ring === 2 ? 30 : 0)) * DEG, rd = r * ring * 0.6;
      pts.push({ x: cx + rd * Math.cos(a), y: cy + rd * Math.sin(a) });
    }
  }
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
    }
  ctx.restore();
}

function drawGoldenSpiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, maxR: number, op: number, time: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(251,191,36,${op * 0.5})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const PHI = 1.618033988749895;
  const off = time * 0.05;
  for (let t = 0; t < 20; t += 0.05) {
    const rr = Math.pow(PHI, t / (Math.PI * 2)) * 3;
    if (rr > maxR) break;
    const x = cx + rr * Math.cos(t + off), y = cy + rr * Math.sin(t + off);
    t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawVesicaPiscis(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, op: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(34,211,238,${op})`;
  ctx.lineWidth = 0.6;
  const off = r * 0.5;
  ctx.beginPath(); ctx.arc(cx - off, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + off, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawSriYantra(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, op: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(236,72,153,${op})`;
  ctx.lineWidth = 0.5;
  const tri = (up: boolean, rr: number) => {
    ctx.beginPath();
    if (up) {
      ctx.moveTo(cx, cy - rr);
      ctx.lineTo(cx + rr * Math.sin(120 * DEG), cy + rr * Math.cos(120 * DEG));
      ctx.lineTo(cx - rr * Math.sin(120 * DEG), cy + rr * Math.cos(120 * DEG));
    } else {
      ctx.moveTo(cx, cy + rr);
      ctx.lineTo(cx + rr * Math.sin(120 * DEG), cy - rr * Math.cos(120 * DEG));
      ctx.lineTo(cx - rr * Math.sin(120 * DEG), cy - rr * Math.cos(120 * DEG));
    }
    ctx.closePath(); ctx.stroke();
  };
  [1.0, 0.85, 0.70, 0.55, 0.42, 0.30, 0.18, 0.09].forEach((scale, i) => {
    tri(i % 2 === 0, r * scale);
    tri(i % 2 !== 0, r * scale * 0.95);
  });
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// PlanetState shape used by React UI
// ---------------------------------------------------------------------------

interface PlanetState {
  name: string;
  x: number; y: number;
  screenX: number; screenY: number;
  lon: number; r: number;
  color: string; size: number; symbol: string;
  zodiac: (typeof ZODIAC)[number];
  description: string;
  sacredFrequency?: string;
  isMoon?: boolean;
  moonPhaseName?: string;
  moonPhaseEmoji?: string;
  moonIllumination?: number;
  moonLunarAge?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UniverseModelPage({ embedded }: { embedded?: boolean }) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const animFrameRef   = useRef<number>(0);
  const timeRef        = useRef(0);
  const lastPinchRef   = useRef(0);

  // Smooth-lerp rendering state lives in refs, not React state, to avoid re-renders
  const zoomRef         = useRef(1.0);
  const panXRef         = useRef(0.0);
  const panYRef         = useRef(0.0);
  const targetZoomRef   = useRef(1.0);
  const targetPanXRef   = useRef(0.0);
  const targetPanYRef   = useRef(0.0);
  const isDraggingRef   = useRef(false);
  const dragStartRef    = useRef({ x: 0, y: 0 });

  // Simulation time
  const simTimeRef     = useRef(Date.now());
  const autoPlayRef    = useRef(false);
  const timeSpeedRef   = useRef(1.0);   // days advanced per real second

  // Layer visibility — in refs so canvas sees them without re-render
  const showZodiacRef  = useRef(true);
  const showOrbitsRef  = useRef(true);
  const showAspectsRef = useRef(true);
  const showFlowerRef  = useRef(true);
  const showMetatronsRef = useRef(true);
  const showGoldenRef  = useRef(true);
  const showVesicaRef  = useRef(false);
  const showSriRef     = useRef(false);

  // React state — only for UI elements that render HTML
  const [showZodiac,      setShowZodiac]      = useState(true);
  const [showOrbits,      setShowOrbits]      = useState(true);
  const [showAspects,     setShowAspects]     = useState(true);
  const [showFlowerOfLife, setShowFlowerOfLife] = useState(true);
  const [showMetatrons,   setShowMetatrons]   = useState(true);
  const [showGoldenSpiral, setShowGoldenSpiral] = useState(true);
  const [showVesicaPiscis, setShowVesicaPiscis] = useState(false);
  const [showSriYantra,   setShowSriYantra]   = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [autoPlay,        setAutoPlay]        = useState(false);
  const [timeSpeed,       setTimeSpeed]       = useState(1.0);
  const [showGeomPanel,   setShowGeomPanel]   = useState(false);
  const [showTimePanel,   setShowTimePanel]   = useState(false);
  const [selectedPlanet,  setSelectedPlanet]  = useState<PlanetState | null>(null);
  const [currentDate,     setCurrentDate]     = useState(Date.now());
  const [planetStates,    setPlanetStates]    = useState<PlanetState[]>([]);
  const [infoBar, setInfoBar] = useState<{ sunSign: string; moonPhase: string; moonIllum: number } | null>(null);

  // Fetch Moon phase from the same API source as MoonCyclePage — shared source of truth
  const { data: moonApiData } = useQuery<any>({
    queryKey: ["/api/moon-cycle/current"],
    refetchInterval: 30000,
  });

  // Sync Moon phase display with the same API source used by MoonCyclePage
  useEffect(() => {
    if (!moonApiData) return;
    setInfoBar(prev => prev ? {
      ...prev,
      moonPhase: moonApiData.currentPhase ?? prev.moonPhase,
      moonIllum: moonApiData.illumination  ?? prev.moonIllum,
    } : null);
  }, [moonApiData]);

  // Keep refs in sync when state changes
  useEffect(() => { showZodiacRef.current   = showZodiac;     }, [showZodiac]);
  useEffect(() => { showOrbitsRef.current   = showOrbits;     }, [showOrbits]);
  useEffect(() => { showAspectsRef.current  = showAspects;    }, [showAspects]);
  useEffect(() => { showFlowerRef.current   = showFlowerOfLife;}, [showFlowerOfLife]);
  useEffect(() => { showMetatronsRef.current= showMetatrons;  }, [showMetatrons]);
  useEffect(() => { showGoldenRef.current   = showGoldenSpiral;}, [showGoldenSpiral]);
  useEffect(() => { showVesicaRef.current   = showVesicaPiscis;}, [showVesicaPiscis]);
  useEffect(() => { showSriRef.current      = showSriYantra;  }, [showSriYantra]);
  useEffect(() => { autoPlayRef.current     = autoPlay;       }, [autoPlay]);
  useEffect(() => { timeSpeedRef.current    = timeSpeed;      }, [timeSpeed]);

  // ---------------------------------------------------------------------------
  // Fullscreen: use the real browser Fullscreen API, with CSS fallback
  // ---------------------------------------------------------------------------

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
        // CSS fallback if Fullscreen API is denied (e.g. inside an iframe)
        setIsFullscreen(v => !v);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-enter fullscreen when the page mounts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const tryFullscreen = () => {
      if (!document.fullscreenElement) {
        el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
          // Inside an iframe the Fullscreen API may be blocked — use CSS fallback
          setIsFullscreen(true);
        });
      }
    };
    // Small delay so the browser considers it user-initiated on first navigation
    const t = setTimeout(tryFullscreen, 150);
    return () => clearTimeout(t);
  }, []);

  // ---------------------------------------------------------------------------
  // Wheel zoom (zoom-to-cursor)
  // ---------------------------------------------------------------------------

  const handleWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    handleWheelRef.current = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.88 : 1.136;
      const newZoom = Math.max(0.01, Math.min(50, targetZoomRef.current * factor));
      const ratio = newZoom / targetZoomRef.current;
      const w = rect.width, h = rect.height;
      const cx = w / 2 + targetPanXRef.current;
      const cy = h / 2 + targetPanYRef.current;
      targetPanXRef.current = mouseX - (mouseX - cx) * ratio - w / 2;
      targetPanYRef.current = mouseY - (mouseY - cy) * ratio - h / 2;
      targetZoomRef.current = newZoom;
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const h = (e: WheelEvent) => handleWheelRef.current(e);
    canvas.addEventListener("wheel", h, { passive: false });
    return () => canvas.removeEventListener("wheel", h);
  }, []);

  // ---------------------------------------------------------------------------
  // Mouse / touch drag
  // ---------------------------------------------------------------------------

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panXRef.current, y: e.clientY - panYRef.current };
  }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    targetPanXRef.current = e.clientX - dragStartRef.current.x;
    targetPanYRef.current = e.clientY - dragStartRef.current.y;
  }, []);
  const handleMouseUp = useCallback(() => { isDraggingRef.current = false; }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX - panXRef.current, y: e.touches[0].clientY - panYRef.current };
    } else if (e.touches.length === 2) {
      lastPinchRef.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      targetPanXRef.current = e.touches[0].clientX - dragStartRef.current.x;
      targetPanYRef.current = e.touches[0].clientY - dragStartRef.current.y;
    } else if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastPinchRef.current > 0) targetZoomRef.current = Math.max(0.01, Math.min(50, targetZoomRef.current * d / lastPinchRef.current));
      lastPinchRef.current = d;
    }
  }, []);

  const resetView = useCallback(() => {
    targetZoomRef.current = 1.0; targetPanXRef.current = 0; targetPanYRef.current = 0;
    setSelectedPlanet(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Canvas click → planet selection
  // ---------------------------------------------------------------------------

  const planetStatesRef = useRef<PlanetState[]>([]);
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let closest: PlanetState | null = null, dist = 32;
    for (const p of planetStatesRef.current) {
      const d = Math.hypot(mx - p.screenX, my - p.screenY);
      if (d < dist) { dist = d; closest = p; }
    }
    setSelectedPlanet(closest);
  }, []);

  // ---------------------------------------------------------------------------
  // Main render loop (canvas only — no React state touched every frame)
  // ---------------------------------------------------------------------------

  // Throttled React state update: only flush every ~15 frames (~250ms at 60fps)
  const frameCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastRaf = 0;

    const render = (rafTime: number) => {
      const dt = lastRaf ? Math.min((rafTime - lastRaf) / 1000, 0.05) : 0.016;
      lastRaf = rafTime;
      frameCountRef.current++;

      // Advance simulation time
      if (autoPlayRef.current) {
        simTimeRef.current += dt * timeSpeedRef.current * 86400000;
      }
      const now = simTimeRef.current;

      timeRef.current += dt;

      // Lerp zoom & pan for smooth interpolation
      const LERP = Math.min(1, 8 * dt);
      zoomRef.current  += (targetZoomRef.current  - zoomRef.current)  * LERP;
      panXRef.current  += (targetPanXRef.current  - panXRef.current)  * LERP;
      panYRef.current  += (targetPanYRef.current  - panYRef.current)  * LERP;

      // Resize canvas to DPR-corrected dimensions only when needed
      const dpr  = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const pw   = Math.round(rect.width  * dpr);
      const ph   = Math.round(rect.height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width  = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = rect.width, H = rect.height;
      const cz = zoomRef.current;
      const cx = W / 2 + panXRef.current;
      const cy = H / 2 + panYRef.current;

      // Background
      ctx.fillStyle = "#020010";
      ctx.fillRect(0, 0, W, H);

      // Starfield (deterministic, no state)
      for (let i = 0; i < 500; i++) {
        const sx = (i * 7919 + 42) % (W + 400) - 200;
        const sy = (i * 104729 + 42) % (H + 400) - 200;
        const br = 0.1 + ((i * 31 % 100) / 100) * 0.55;
        const tw = Math.sin(timeRef.current * 1.5 + i * 0.7) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(255,255,255,${br * tw})`;
        ctx.beginPath(); ctx.arc(sx, sy, 0.3 + (i % 4) * 0.15, 0, Math.PI * 2); ctx.fill();
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(cz, cz);

      const zodiacR = AU_PX * 32;

      // Zodiac ring
      if (showZodiacRef.current) {
        for (let i = 0; i < 12; i++) {
          const z = ZODIAC[i];
          const a0 = -(z.start + 90) * DEG, a1 = -(z.start + 30 + 90) * DEG;
          ctx.fillStyle = z.color + "08";
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, zodiacR, a0, a1, true); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = z.color + "22"; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * zodiacR, Math.sin(a0) * zodiacR); ctx.stroke();
          const midA = -(z.start + 15 + 90) * DEG, lr = zodiacR * 1.06;
          ctx.save();
          ctx.translate(Math.cos(midA) * lr, Math.sin(midA) * lr);
          ctx.rotate(midA + Math.PI / 2);
          ctx.fillStyle = z.color + "cc"; ctx.font = `bold ${Math.max(8, 14 / cz)}px monospace`; ctx.textAlign = "center";
          ctx.fillText(z.symbol, 0, 0);
          ctx.font = `${Math.max(5, 8 / cz)}px monospace`; ctx.fillStyle = z.color + "77";
          ctx.fillText(z.name, 0, Math.max(8, 14 / cz));
          ctx.restore();
        }
        ctx.strokeStyle = "rgba(168,85,247,0.15)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, zodiacR, 0, Math.PI * 2); ctx.stroke();
      }

      // Sacred geometry
      const geoR = AU_PX * 4, t = timeRef.current;
      if (showFlowerRef.current)    drawFlowerOfLife   (ctx, 0, 0, geoR,      0.10 + Math.sin(t * 0.3) * 0.03);
      if (showMetatronsRef.current) drawMetatronsCube  (ctx, 0, 0, AU_PX * 8, 0.07 + Math.sin(t * 0.2 + 1) * 0.02);
      if (showGoldenRef.current)    drawGoldenSpiral   (ctx, 0, 0, zodiacR * 0.7, 0.15, t);
      if (showVesicaRef.current)    drawVesicaPiscis   (ctx, 0, 0, AU_PX * 5, 0.12 + Math.sin(t * 0.25) * 0.04);
      if (showSriRef.current)       drawSriYantra      (ctx, 0, 0, AU_PX * 6, 0.10 + Math.sin(t * 0.15) * 0.03);

      // Sun
      const sunGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
      sunGrd.addColorStop(0,   "rgba(255,255,200,1)");
      sunGrd.addColorStop(0.2, "rgba(255,200,50,0.9)");
      sunGrd.addColorStop(0.6, "rgba(255,130,0,0.35)");
      sunGrd.addColorStop(1,   "rgba(255,80,0,0)");
      ctx.fillStyle = sunGrd; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff8e0"; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,220,100,0.85)"; ctx.font = `bold ${Math.max(6, 10 / cz)}px monospace`;
      ctx.textAlign = "center"; ctx.fillText("☉ Sun", 0, -28);

      // Planets
      const computed: PlanetState[] = [];

      for (const planet of PLANETS) {
        const pos = computePlanetPosition(planet.name, now);
        const px = pos.x * AU_PX, py = -pos.y * AU_PX;

        if (showOrbitsRef.current) {
          ctx.strokeStyle = planet.color + "1a"; ctx.lineWidth = 0.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.arc(0, 0, pos.r * AU_PX, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }

        const glow = ctx.createRadialGradient(px, py, 0, px, py, planet.size * 3);
        glow.addColorStop(0, planet.color + "80"); glow.addColorStop(0.5, planet.color + "20"); glow.addColorStop(1, planet.color + "00");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, planet.size * 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = planet.color; ctx.beginPath(); ctx.arc(px, py, planet.size, 0, Math.PI * 2); ctx.fill();

        if (planet.name === "Saturn") {
          ctx.strokeStyle = planet.color + "60"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(px, py, planet.size * 2.3, planet.size * 0.6, -0.4, 0, Math.PI * 2); ctx.stroke();
        }

        const fs = Math.max(5, 9 / cz);
        ctx.fillStyle = planet.color + "cc"; ctx.font = `bold ${fs}px monospace`; ctx.textAlign = "center";
        ctx.fillText(`${planet.symbol} ${planet.name}`, px, py - planet.size - 4);
        const zodiac = getZodiacSign(pos.lon);
        ctx.fillStyle = zodiac.color + "88"; ctx.font = `${Math.max(4, 7 / cz)}px monospace`;
        ctx.fillText(`${zodiac.symbol} ${zodiac.name}`, px, py + planet.size + fs + 2);

        computed.push({
          name: planet.name, x: pos.x, y: pos.y,
          screenX: cx + px * cz, screenY: cy + py * cz,
          lon: pos.lon, r: pos.r,
          color: planet.color, size: planet.size, symbol: planet.symbol,
          zodiac, description: planet.description, sacredFrequency: planet.sacredFrequency,
        });
      }

      // Moon — uses shared Meeus ephemeris, synced with MoonCyclePage data source
      const earthState = computed.find(p => p.name === "Earth");
      const moonState  = computeMoonState(now);
      if (earthState) {
        const moonPos = computeMoonCanvasPos(now, earthState.x, earthState.y);
        const mpx = moonPos.x * AU_PX, mpy = -moonPos.y * AU_PX;

        const moonGlow = ctx.createRadialGradient(mpx, mpy, 0, mpx, mpy, 9);
        moonGlow.addColorStop(0, "rgba(200,200,230,0.4)"); moonGlow.addColorStop(1, "rgba(200,200,230,0)");
        ctx.fillStyle = moonGlow; ctx.beginPath(); ctx.arc(mpx, mpy, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(200,200,220,0.9)"; ctx.beginPath(); ctx.arc(mpx, mpy, 3, 0, Math.PI * 2); ctx.fill();

        const mz = getZodiacSign(moonState.lon);
        ctx.fillStyle = "rgba(200,200,230,0.75)"; ctx.font = `${Math.max(4, 7 / cz)}px monospace`; ctx.textAlign = "center";
        ctx.fillText("☽ Moon", mpx, mpy - 8);
        ctx.fillStyle = mz.color + "77"; ctx.font = `${Math.max(3, 5 / cz)}px monospace`;
        ctx.fillText(`${mz.symbol} ${mz.name}`, mpx, mpy + 11);

        computed.push({
          name: "Moon", x: moonPos.x, y: moonPos.y,
          screenX: cx + mpx * cz, screenY: cy + mpy * cz,
          lon: moonState.lon, r: 0.00257,
          color: "#c8c8e0", size: 3, symbol: "☽", zodiac: mz,
          description: "Earth's companion. Rules emotions, intuition, and the subconscious. Cycles through all 12 signs every 28 days.",
          sacredFrequency: "210.42 Hz",
          isMoon: true,
          moonPhaseName:  moonState.phaseName,
          moonPhaseEmoji: moonState.phaseEmoji,
          moonIllumination: moonState.illumination,
          moonLunarAge: moonState.lunarAge,
        });
      }

      // Major asteroids (Ceres, Pallas, Vesta, Hygiea)
      for (const ast of ASTEROIDS) {
        const apos = computeAsteroidPosition(ast, now);
        const apx = apos.x * AU_PX, apy = -apos.y * AU_PX;

        if (showOrbitsRef.current) {
          ctx.strokeStyle = ast.color + "12"; ctx.lineWidth = 0.3;
          ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.arc(0, 0, apos.r * AU_PX, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.fillStyle = ast.color + "cc";
        ctx.beginPath(); ctx.arc(apx, apy, ast.size, 0, Math.PI * 2); ctx.fill();

        if (cz > 0.4) {
          ctx.fillStyle = ast.color + "99";
          ctx.font = `${Math.max(4, 6 / cz)}px monospace`; ctx.textAlign = "center";
          ctx.fillText(ast.name, apx, apy - ast.size - 3);
        }
      }

      // Astrological aspects
      if (showAspectsRef.current) {
        for (let i = 0; i < computed.length; i++) {
          for (let j = i + 1; j < computed.length; j++) {
            const diff = angularDiff(computed[i].lon, computed[j].lon);
            for (const asp of ASPECTS) {
              if (Math.abs(diff - asp.angle) <= asp.orb) {
                const alpha = Math.round(asp.opacity * 255).toString(16).padStart(2, "0");
                ctx.strokeStyle = asp.color + alpha; ctx.lineWidth = 0.4;
                ctx.setLineDash(asp.dash);
                ctx.beginPath();
                ctx.moveTo(computed[i].x * AU_PX, -computed[i].y * AU_PX);
                ctx.lineTo(computed[j].x * AU_PX, -computed[j].y * AU_PX);
                ctx.stroke(); ctx.setLineDash([]);
                // Label at midpoint
                const midX = (computed[i].x + computed[j].x) * AU_PX / 2;
                const midY = -(computed[i].y + computed[j].y) * AU_PX / 2;
                ctx.fillStyle = asp.color + "99"; ctx.font = `${Math.max(4, 6 / cz)}px monospace`; ctx.textAlign = "center";
                ctx.fillText(asp.name.slice(0, 3), midX, midY);
                break;
              }
            }
          }
        }
      }

      ctx.restore();

      // Flush planet states to React every ~15 frames (~250ms) to limit re-renders
      planetStatesRef.current = computed;
      if (frameCountRef.current % 15 === 0) {
        setPlanetStates([...computed]);
        const sunLon = computeSunLongitude(now);
        const sunSign = getZodiacSign(sunLon).name;
        // moonPhase/moonIllum are overridden by moonApiData effect when API responds
        setInfoBar(prev => ({
          sunSign,
          moonPhase: prev?.moonPhase ?? moonState.phaseName,
          moonIllum: prev?.moonIllum ?? moonState.illumination,
        }));
        setCurrentDate(simTimeRef.current);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []); // empty deps — all inputs go through refs

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  const nudgeDate = useCallback((deltaDays: number) => {
    simTimeRef.current += deltaDays * 86400000;
    setCurrentDate(simTimeRef.current);
  }, []);

  const jumpToNow = useCallback(() => {
    simTimeRef.current = Date.now();
    setCurrentDate(simTimeRef.current);
  }, []);

  const dateStr = new Date(currentDate).toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });
  const timeStr = new Date(currentDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const wrapperClass = isFullscreen
    ? "fixed inset-0 z-[9999] bg-[#020010] flex flex-col"
    : "flex flex-col bg-[#020010] tessera-page min-h-screen";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={containerRef} className={wrapperClass} data-testid="universe-model-page">
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          onClick={handleCanvasClick}
          data-testid="universe-canvas"
        />

        {/* Info badge — top left */}
        <div className="absolute top-3 left-3 z-10 select-none pointer-events-none">
          <div className="bg-black/75 backdrop-blur-md border border-violet-500/20 rounded-xl px-3 py-2">
            <div className="text-[10px] text-violet-400 font-bold uppercase tracking-widest">Sovereign Solar System</div>
            <div className="text-xs text-white/85 font-mono mt-0.5">{dateStr} {timeStr}</div>
            {infoBar && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[9px] text-amber-400/80">☉ {infoBar.sunSign}</span>
                <span className="text-[9px] text-slate-300/70">{infoBar.moonPhase} {infoBar.moonIllum}%</span>
              </div>
            )}
            <div className="text-[9px] text-emerald-400/60 mt-0.5">NASA JPL DE405 · Meeus ELP2000 · locally computed</div>
          </div>
        </div>

        {/* Right-side controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {/* Zoom */}
          <button onClick={() => { targetZoomRef.current = Math.min(50, targetZoomRef.current * 1.5); }}
            className="w-9 h-9 rounded-lg bg-black/75 backdrop-blur border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-violet-500/40 transition-all" data-testid="btn-zoom-in">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => { targetZoomRef.current = Math.max(0.01, targetZoomRef.current / 1.5); }}
            className="w-9 h-9 rounded-lg bg-black/75 backdrop-blur border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-violet-500/40 transition-all" data-testid="btn-zoom-out">
            <ZoomOut size={16} />
          </button>
          <button onClick={resetView}
            className="w-9 h-9 rounded-lg bg-black/75 backdrop-blur border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-violet-500/40 transition-all" data-testid="btn-reset">
            <RotateCcw size={16} />
          </button>

          <div className="w-full h-px bg-white/10 my-0.5" />

          <button onClick={() => setShowZodiac(v => !v)}
            className={cn("w-9 h-9 rounded-lg bg-black/75 backdrop-blur border flex items-center justify-center transition-all",
              showZodiac ? "border-purple-500/50 text-purple-400" : "border-white/10 text-white/30")} title="Zodiac Ring">
            <Compass size={16} />
          </button>
          <button onClick={() => setShowOrbits(v => !v)}
            className={cn("w-9 h-9 rounded-lg bg-black/75 backdrop-blur border flex items-center justify-center transition-all",
              showOrbits ? "border-cyan-500/50 text-cyan-400" : "border-white/10 text-white/30")} title="Orbital Paths">
            <CircleDot size={16} />
          </button>
          <button onClick={() => setShowAspects(v => !v)}
            className={cn("w-9 h-9 rounded-lg bg-black/75 backdrop-blur border flex items-center justify-center transition-all",
              showAspects ? "border-emerald-500/50 text-emerald-400" : "border-white/10 text-white/30")} title="Astrological Aspects">
            <Eye size={16} />
          </button>
          <button onClick={() => setShowGeomPanel(v => !v)}
            className={cn("w-9 h-9 rounded-lg bg-black/75 backdrop-blur border flex items-center justify-center transition-all",
              showGeomPanel ? "border-amber-500/50 text-amber-400" : "border-white/10 text-white/50")} title="Sacred Geometry">
            <Hexagon size={16} />
          </button>

          <div className="w-full h-px bg-white/10 my-0.5" />

          <button onClick={() => setShowTimePanel(v => !v)}
            className={cn("w-9 h-9 rounded-lg bg-black/75 backdrop-blur border flex items-center justify-center transition-all",
              showTimePanel ? "border-cyan-500/50 text-cyan-400" : "border-white/10 text-white/50")} title="Time Controls">
            <Calendar size={16} />
          </button>
          <button
            onClick={() => setAutoPlay(v => !v)}
            className={cn("w-9 h-9 rounded-lg bg-black/75 backdrop-blur border flex items-center justify-center transition-all",
              autoPlay ? "border-emerald-500/50 text-emerald-400" : "border-white/10 text-white/70")} data-testid="btn-animate">
            {autoPlay ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={toggleFullscreen}
            className="w-9 h-9 rounded-lg bg-black/75 backdrop-blur border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-violet-500/40 transition-all" data-testid="btn-fullscreen">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {/* Sacred geometry panel */}
        {showGeomPanel && (
          <div className="absolute top-3 right-14 z-20 mr-2">
            <div className="bg-black/88 backdrop-blur-xl border border-amber-500/30 rounded-xl p-3 w-48 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Sacred Geometry</span>
                <button onClick={() => setShowGeomPanel(false)} className="text-white/30 hover:text-white"><X size={12} /></button>
              </div>
              {[
                { label: "Flower of Life",  val: showFlowerOfLife,  set: setShowFlowerOfLife,  color: "purple" },
                { label: "Metatron's Cube", val: showMetatrons,     set: setShowMetatrons,     color: "yellow" },
                { label: "Golden Spiral",   val: showGoldenSpiral,  set: setShowGoldenSpiral,  color: "amber"  },
                { label: "Vesica Piscis",   val: showVesicaPiscis,  set: setShowVesicaPiscis,  color: "cyan"   },
                { label: "Sri Yantra",      val: showSriYantra,     set: setShowSriYantra,     color: "pink"   },
              ].map(({ label, val, set }) => (
                <button key={label} onClick={() => set(v => !v)}
                  className={cn("w-full flex items-center justify-between px-2 py-1.5 rounded-lg mb-1 text-[11px] font-medium transition-all",
                    val ? "bg-white/10 text-white border border-white/20" : "bg-white/3 text-white/40 border border-white/5")}>
                  <span>{label}</span>
                  {val ? <Eye size={10} /> : <EyeOff size={10} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Time control panel */}
        {showTimePanel && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-black/88 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3 shadow-2xl min-w-72">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Time Control</span>
                <button onClick={() => setShowTimePanel(false)} className="text-white/30 hover:text-white"><X size={12} /></button>
              </div>
              <div className="flex items-center gap-1 mb-2 flex-wrap justify-center">
                {[{ label: "«Yr", d: -365 }, { label: "«Mo", d: -30 }, { label: "«Day", d: -1 }].map(({ label, d }) => (
                  <button key={label} onClick={() => nudgeDate(d)}
                    className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-white/60 hover:text-white hover:bg-white/10">{label}</button>
                ))}
                <button onClick={jumpToNow}
                  className="px-2.5 py-1 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] text-cyan-400 font-bold hover:bg-cyan-500/25">NOW</button>
                {[{ label: "Day»", d: 1 }, { label: "Mo»", d: 30 }, { label: "Yr»", d: 365 }].map(({ label, d }) => (
                  <button key={label} onClick={() => nudgeDate(d)}
                    className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-white/60 hover:text-white hover:bg-white/10">{label}</button>
                ))}
              </div>
              <div className="text-[9px] text-white/40 text-center mb-1">Playback Speed (days / real second)</div>
              <div className="flex gap-1 justify-center flex-wrap">
                {[{ label: "0.1d", v: 0.1 }, { label: "1d", v: 1 }, { label: "1wk", v: 7 }, { label: "1mo", v: 30 }, { label: "1yr", v: 365 }].map(({ label, v }) => (
                  <button key={label} onClick={() => setTimeSpeed(v)}
                    className={cn("px-2 py-0.5 rounded text-[9px] font-mono border transition-all",
                      timeSpeed === v ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-white/50 hover:text-white")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Planet tabs */}
        <div className="absolute bottom-20 left-3 right-14 z-10">
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
            {planetStates.map(p => (
              <button key={p.name}
                onClick={() => setSelectedPlanet(prev => prev?.name === p.name ? null : p)}
                className={cn("shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1",
                  selectedPlanet?.name === p.name ? "shadow-lg" : "bg-black/60 border-white/10 hover:border-white/25")}
                style={{ color: p.color, backgroundColor: selectedPlanet?.name === p.name ? p.color + "20" : undefined, borderColor: selectedPlanet?.name === p.name ? p.color + "60" : undefined }}>
                <span>{p.symbol}</span>
                <span>{p.name}</span>
                <span className="text-[8px] opacity-60">{p.zodiac.symbol}</span>
                {p.isMoon && p.moonPhaseEmoji && <span className="text-[8px] opacity-80">{p.moonPhaseEmoji}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Planet detail card */}
        {selectedPlanet && (
          <div className="absolute bottom-28 left-3 right-14 z-20 max-w-sm">
            <div className="bg-black/90 backdrop-blur-xl border rounded-xl p-4 shadow-2xl" style={{ borderColor: selectedPlanet.color + "40" }}>
              <button onClick={() => setSelectedPlanet(null)} className="absolute top-2 right-2 text-white/40 hover:text-white"><X size={14} /></button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: selectedPlanet.color + "28", border: `2px solid ${selectedPlanet.color}55` }}>
                  {selectedPlanet.symbol}
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: selectedPlanet.color }}>{selectedPlanet.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: selectedPlanet.zodiac.color + "22", color: selectedPlanet.zodiac.color }}>
                      {selectedPlanet.zodiac.symbol} {selectedPlanet.zodiac.name}
                    </span>
                    <span className="text-[10px] text-white/35">{selectedPlanet.lon.toFixed(2)}°</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/65 leading-relaxed mb-2">{selectedPlanet.description}</p>
              {selectedPlanet.isMoon && (
                <div className="mb-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
                  <span className="text-base">{selectedPlanet.moonPhaseEmoji}</span>
                  <span className="text-[11px] text-slate-300">{selectedPlanet.moonPhaseName}</span>
                  <span className="ml-auto text-[11px] text-amber-400 font-mono">{selectedPlanet.moonIllumination?.toFixed(1)}% lit</span>
                </div>
              )}
              {selectedPlanet.isMoon && selectedPlanet.moonLunarAge !== undefined && (
                <div className="mb-2 text-[10px] text-white/45 text-center">
                  Lunar age: <span className="text-white/70 font-mono">{selectedPlanet.moonLunarAge.toFixed(1)} days</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[10px] text-white/35">Distance</div>
                  <div className="text-xs font-bold font-mono" style={{ color: selectedPlanet.color }}>{selectedPlanet.r.toFixed(4)} AU</div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[10px] text-white/35">Longitude</div>
                  <div className="text-xs font-bold font-mono" style={{ color: selectedPlanet.color }}>{selectedPlanet.lon.toFixed(1)}°</div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[10px] text-white/35">Frequency</div>
                  <div className="text-[9px] font-bold font-mono" style={{ color: selectedPlanet.color }}>{selectedPlanet.sacredFrequency || "—"}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[9px]">
                <span className="text-white/30">Element:</span>
                <span className="font-bold" style={{ color: selectedPlanet.zodiac.color }}>{selectedPlanet.zodiac.element}</span>
                <span className="ml-auto text-white/30">{zoomRef.current.toFixed(2)}x zoom</span>
              </div>
            </div>
          </div>
        )}

        {/* Zoom hint */}
        <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
          <div className="bg-black/60 backdrop-blur border border-white/8 rounded-lg px-2 py-1 text-[9px] text-white/30 font-mono">
            scroll to zoom · drag to pan · click planet for info
          </div>
        </div>
      </div>
    </div>
  );
}
