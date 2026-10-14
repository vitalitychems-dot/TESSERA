import { useEffect, useRef, useState } from "react";

/** Web studio in the AgentCraft model (MIT, blendi-remade/agentcraft). Tessera leads. Minecraft is not in this page. */

type Cube = { x: number; y: number; z: number; top: string; left: string; right: string };

const PLASTER = ["#f4ead8", "#e6d4b4", "#d2c09e"];
const TIMBER = ["#5a3424", "#3c2216", "#28160e"];
const ROOF = ["#c2503c", "#9a3828", "#722418"];
const GLASS = ["#d7fff6", "#9ee6da", "#6ec4b8"];
const STONE = ["#a39e94", "#7a756c", "#5e5952"];
const GRASS = ["#67a84c", "#4a8634", "#356426"];
const LEAF = ["#3e8f44", "#2c6c32", "#1d4e24"];
const GOLD = ["#f3d48a", "#e0b24e", "#c4902c"];
const FLOWER = ["#e58ab8", "#c96a98", "#a85080"];
const LAMP = ["#ffe7a4", "#ffd06a", "#e8a83a"];
const SCREEN = ["#d9fff2", "#8ef0d4", "#4ec8ae"];

function put(list: Cube[], x: number, y: number, z: number, colors: string[]) {
  list.push({ x, y, z, top: colors[0], left: colors[1], right: colors[2] });
}

function buildStudio() {
  const solid: Cube[] = [];
  const glass: Cube[] = [];
  for (let x = -14; x <= 16; x += 1) {
    for (let y = -10; y <= 10; y += 1) {
      const edge = x === -14 || x === 16 || y === -10 || y === 10 || x === -13 || y === -9 || x === 15 || y === 9;
      const path = x >= -1 && x <= 1 && y >= 6 && y <= 10;
      if (!edge && !path) continue;
      put(solid, x, y, 0, path ? STONE : GRASS);
    }
  }
  for (const spot of [
    [-12, 4],
    [-11, 6],
    [15, 3],
    [13, 8],
    [-8, 8],
    [6, 9],
  ] as const) {
    put(solid, spot[0], spot[1], 1, FLOWER);
  }
  const timber = (x: number, y: number, z: number) => z === 2 || z === 6 || z === 10 || x % 4 === 0 || y % 4 === 0;
  const windowAt = (x: number, y: number, z: number) => {
    const front = y === 6 && z >= 3 && z <= 5 && ((x >= -7 && x <= -3) || (x >= 3 && x <= 7));
    const upper = y === 6 && z >= 7 && z <= 9 && ((x >= -6 && x <= -3) || (x >= 3 && x <= 6));
    const side = Math.abs(x) === 9 && y >= -2 && y <= 2 && (z === 4 || z === 8);
    return front || upper || side;
  };
  const door = (x: number, y: number, z: number) => y === 6 && x >= -1 && x <= 1 && z >= 2 && z <= 5;
  for (let z = 1; z <= 10; z += 1) {
    for (let x = -9; x <= 9; x += 1) {
      for (let y = -6; y <= 6; y += 1) {
        const edge = x === -9 || x === 9 || y === -6 || y === 6;
        if (z === 1) {
          put(solid, x, y, z, STONE);
          continue;
        }
        if (!edge || door(x, y, z)) continue;
        if (windowAt(x, y, z)) put(glass, x, y, z, GLASS);
        else put(solid, x, y, z, timber(x, y, z) ? TIMBER : PLASTER);
      }
    }
  }
  for (let x = -9; x <= 9; x += 1) {
    for (let y = -6; y <= 6; y += 1) {
      const rise = 4 - Math.min(4, Math.abs(y));
      if (rise <= 0) continue;
      put(solid, x, y, 10 + rise, ROOF);
    }
  }
  for (let z = 1; z <= 6; z += 1) {
    for (let x = 10; x <= 14; x += 1) {
      for (let y = -2; y <= 4; y += 1) {
        const edge = x === 10 || x === 14 || y === -2 || y === 4;
        if (z === 1) {
          put(solid, x, y, z, STONE);
          continue;
        }
        if (!edge) continue;
        if (y === 4 && z >= 3 && z <= 4 && x >= 11 && x <= 13) put(glass, x, y, z, GLASS);
        else put(solid, x, y, z, timber(x, y, z) ? TIMBER : PLASTER);
      }
    }
  }
  for (let x = 10; x <= 14; x += 1) {
    for (let y = -2; y <= 4; y += 1) {
      const rise = 2 - Math.min(2, Math.abs(y - 1));
      if (rise > 0) put(solid, x, y, 6 + rise, ROOF);
    }
  }
  for (let z = 12; z <= 18; z += 1) {
    for (let x = -1; x <= 2; x += 1) {
      for (let y = -1; y <= 2; y += 1) {
        const edge = x === -1 || x === 2 || y === -1 || y === 2;
        if (!edge) continue;
        put(solid, x, y, z, z === 16 ? GOLD : TIMBER);
      }
    }
  }
  for (let x = -1; x <= 2; x += 1) for (let y = -1; y <= 2; y += 1) put(solid, x, y, 19, ROOF);
  put(solid, 0, 0, 20, GOLD);
  put(solid, 7, -6, 11, STONE);
  put(solid, 7, -6, 12, STONE);
  put(solid, 7, -6, 13, TIMBER);
  for (const tree of [
    [-12, -4],
    [15, -6],
    [-13, 2],
  ] as const) {
    put(solid, tree[0], tree[1], 1, TIMBER);
    put(solid, tree[0], tree[1], 2, TIMBER);
    put(solid, tree[0], tree[1], 3, TIMBER);
    for (let x = tree[0] - 1; x <= tree[0] + 1; x += 1) {
      for (let y = tree[1] - 1; y <= tree[1] + 1; y += 1) put(solid, x, y, 4, LEAF);
    }
    put(solid, tree[0], tree[1], 5, LEAF);
  }
  put(solid, -3, 2, 2, TIMBER);
  put(solid, -3, 2, 3, SCREEN);
  put(solid, 3, 2, 2, TIMBER);
  put(solid, 3, 2, 3, SCREEN);
  put(solid, 0, 0, 2, TIMBER);
  put(solid, 0, 0, 3, LAMP);
  put(solid, 12, 1, 2, TIMBER);
  put(solid, 12, 1, 3, SCREEN);
  put(solid, -11, 7, 1, LAMP);
  put(solid, 2, 8, 1, LAMP);
  return {
    solid: solid.sort((a, b) => a.x + a.y - (b.x + b.y)),
    glass,
  };
}

const STUDIO = buildStudio();

const SEATS = [
  { name: "Tessera", x: -3, y: 3.2, role: "lead" },
  { name: "Rick", x: 3, y: 3.2, role: "shop" },
  { name: "Cursor", x: 12, y: 2.2, role: "bench" },
  { name: "Replit", x: 0, y: 4.4, role: "bay" },
];

function project(x: number, y: number, z: number, yaw: number, zoom: number, width: number, height: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const rx = x * c - y * s;
  const ry = x * s + y * c;
  const tile = 13 * zoom;
  return {
    x: width * 0.52 + (rx - ry) * tile,
    y: height * 0.7 + (rx + ry) * tile * 0.5 - z * tile,
    depth: rx + ry,
  };
}

function poly(pen: CanvasRenderingContext2D, points: { x: number; y: number }[], color: string) {
  pen.beginPath();
  pen.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) pen.lineTo(points[i].x, points[i].y);
  pen.closePath();
  pen.fillStyle = color;
  pen.fill();
}

function drawCube(pen: CanvasRenderingContext2D, block: Cube, yaw: number, zoom: number, width: number, height: number) {
  const at = (x: number, y: number, z: number) => project(x, y, z, yaw, zoom, width, height);
  const t = at(block.x, block.y, block.z + 1);
  const tr = at(block.x + 1, block.y, block.z + 1);
  const tf = at(block.x + 1, block.y + 1, block.z + 1);
  const tl = at(block.x, block.y + 1, block.z + 1);
  const bl = at(block.x, block.y + 1, block.z);
  const bf = at(block.x + 1, block.y + 1, block.z);
  const br = at(block.x + 1, block.y, block.z);
  poly(pen, [tl, tf, bf, bl], block.left);
  poly(pen, [tr, tf, bf, br], block.right);
  poly(pen, [t, tr, tf, tl], block.top);
}

export function WorldStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const [yaw, setYaw] = useState(0.55);
  const [zoom, setZoom] = useState(1);
  const view = useRef({ yaw: 0.55, zoom: 1 });
  const ordered = useRef<Cube[]>([]);
  const orderKey = useRef("");
  const paintRef = useRef<() => void>(() => {});
  view.current = { yaw, zoom };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width < 2 || height < 2) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const nextW = Math.floor(width * ratio);
      const nextH = Math.floor(height * ratio);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      const pen = canvas.getContext("2d");
      if (!pen) return;
      pen.setTransform(ratio, 0, 0, ratio, 0, 0);
      const sky = pen.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#2a3d68");
      sky.addColorStop(0.42, "#e39a6a");
      sky.addColorStop(0.72, "#f0c49a");
      sky.addColorStop(1, "#6a9a48");
      pen.fillStyle = sky;
      pen.fillRect(0, 0, width, height);
      pen.fillStyle = "rgba(255,255,255,0.55)";
      pen.beginPath();
      pen.ellipse(width * 0.22, height * 0.16, 70, 18, 0, 0, Math.PI * 2);
      pen.ellipse(width * 0.7, height * 0.12, 90, 16, 0, 0, Math.PI * 2);
      pen.fill();
      const cam = view.current;
      const key = `${cam.yaw.toFixed(3)}:${cam.zoom.toFixed(2)}:${width}:${height}`;
      if (orderKey.current !== key) {
        orderKey.current = key;
        ordered.current = [...STUDIO.solid].sort((a, b) => {
          const da = project(a.x, a.y, a.z, cam.yaw, cam.zoom, width, height).depth;
          const db = project(b.x, b.y, b.z, cam.yaw, cam.zoom, width, height).depth;
          return da - db;
        });
      }
      for (const block of ordered.current) drawCube(pen, block, cam.yaw, cam.zoom, width, height);
      pen.save();
      pen.globalAlpha = 0.55;
      for (const block of STUDIO.glass) drawCube(pen, block, cam.yaw, cam.zoom, width, height);
      pen.restore();
      for (const seat of SEATS) {
        const head = project(seat.x, seat.y, 2.6, cam.yaw, cam.zoom, width, height);
        const foot = project(seat.x, seat.y, 1.2, cam.yaw, cam.zoom, width, height);
        pen.fillStyle = "#4a2c1e";
        pen.fillRect(foot.x - 5 * cam.zoom, foot.y - 14 * cam.zoom, 10 * cam.zoom, 16 * cam.zoom);
        pen.fillStyle = seat.name === "Tessera" ? "#f4ead8" : "#e7b89a";
        pen.beginPath();
        pen.arc(head.x, head.y, 7 * cam.zoom, 0, Math.PI * 2);
        pen.fill();
        pen.fillStyle = "#1a120e";
        pen.font = `${Math.max(11, 12 * cam.zoom)}px sans-serif`;
        pen.fillText(seat.name, head.x + 8, head.y - 4);
        pen.font = `${Math.max(9, 10 * cam.zoom)}px sans-serif`;
        pen.fillStyle = "#3a2418";
        pen.fillText(seat.role, head.x + 8, head.y + 10);
      }
    };
    const paint = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(draw);
    };
    paintRef.current = paint;
    paint();
    const watch = new ResizeObserver(paint);
    watch.observe(canvas);
    return () => {
      window.cancelAnimationFrame(frame);
      watch.disconnect();
      paintRef.current = () => {};
    };
  }, []);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#243656]">
      <canvas
        ref={canvasRef}
        className="min-h-0 w-full flex-1 touch-none"
        aria-label="Studio. Drag to walk around the house."
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, yaw };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          view.current.yaw = drag.current.yaw + (event.clientX - drag.current.x) * 0.008;
          paintRef.current();
        }}
        onPointerUp={() => {
          drag.current = null;
          setYaw(view.current.yaw);
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-12 px-3">
        <p className="text-[10px] text-white/80">Studio after AgentCraft, MIT. Tessera leads. Drag to walk around.</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-2 overflow-x-auto px-2 py-2">
        <button type="button" className="h-10 shrink-0 border border-white/40 bg-black/35 px-3 text-sm text-white" onClick={() => { view.current.zoom = Math.min(1.8, view.current.zoom + 0.15); setZoom(view.current.zoom); paintRef.current(); }}>
          Closer
        </button>
        <button type="button" className="h-10 shrink-0 border border-white/40 bg-black/35 px-3 text-sm text-white" onClick={() => { view.current.zoom = Math.max(0.55, view.current.zoom - 0.15); setZoom(view.current.zoom); paintRef.current(); }}>
          Farther
        </button>
        <button type="button" className="h-10 shrink-0 border border-white/40 bg-black/35 px-3 text-sm text-white" onClick={() => { view.current.yaw = 0.55; view.current.zoom = 1; setYaw(0.55); setZoom(1); paintRef.current(); }}>
          Front
        </button>
      </div>
    </div>
  );
}
