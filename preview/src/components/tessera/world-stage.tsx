import { useEffect, useRef, useState } from "react";
import { crossedDoor, hitsWall, stepHouse } from "@/lib/tessera/walk";

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getInside: () => boolean;
    };
  }
}

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

function buildInside() {
  const solid: Cube[] = [];
  for (let x = 0; x <= 6; x += 1) for (let y = 0; y <= 6; y += 1) put(solid, x, y, 0, STONE);
  for (let z = 1; z <= 3; z += 1) {
    for (let x = 0; x <= 6; x += 1) {
      const door = x >= 2 && x <= 4 && z <= 2;
      if (!door) put(solid, x, 0, z, PLASTER);
      put(solid, x, 6, z, x === 3 && z === 2 ? SCREEN : TIMBER);
    }
    for (let y = 1; y <= 5; y += 1) {
      put(solid, 0, y, z, TIMBER);
      put(solid, 6, y, z, TIMBER);
    }
  }
  put(solid, 3, 5, 1, TIMBER);
  put(solid, 3, 5, 2, SCREEN);
  return solid;
}

const INSIDE = buildInside();

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
  const view = useRef({ yaw: 0.55, zoom: 1, inside: false, x: 0, y: 8.4 });
  const keys = useRef(new Set<string>());
  const ordered = useRef<Cube[]>([]);
  const orderKey = useRef("");
  const paintRef = useRef<() => void>(() => {});
  const [inside, setInside] = useState(false);
  view.current.yaw = yaw;
  view.current.inside = inside;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width < 2 || height < 2) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
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
      sky.addColorStop(0, view.current.inside ? "#1c2438" : "#2a3d68");
      sky.addColorStop(1, view.current.inside ? "#3a342c" : "#6a9a48");
      pen.fillStyle = sky;
      pen.fillRect(0, 0, width, height);
      const cam = view.current;
      const blocks = cam.inside ? INSIDE : STUDIO.solid;
      const qyaw = Math.round(cam.yaw * 40) / 40;
      const key = `${cam.inside}:${qyaw}:${cam.zoom.toFixed(2)}:${width}:${height}`;
      if (orderKey.current !== key) {
        orderKey.current = key;
        ordered.current = [...blocks].sort((a, b) => {
          const da = project(a.x, a.y, a.z, cam.yaw, cam.zoom, width, height).depth;
          const db = project(b.x, b.y, b.z, cam.yaw, cam.zoom, width, height).depth;
          return da - db;
        });
      }
      for (const block of ordered.current) {
        const at = project(block.x, block.y, block.z, cam.yaw, cam.zoom, width, height);
        if (at.x < -80 || at.x > width + 80 || at.y < -80 || at.y > height + 80) continue;
        drawCube(pen, block, cam.yaw, cam.zoom, width, height);
      }
      if (!cam.inside) {
        pen.save();
        pen.globalAlpha = 0.55;
        for (const block of STUDIO.glass) drawCube(pen, block, cam.yaw, cam.zoom, width, height);
        pen.restore();
      }
      const mark = project(cam.x, cam.y, cam.inside ? 1.4 : 1.2, cam.yaw, cam.zoom, width, height);
      pen.fillStyle = "#f4ead8";
      pen.beginPath();
      pen.arc(mark.x, mark.y, 8 * cam.zoom, 0, Math.PI * 2);
      pen.fill();
      pen.fillStyle = "#1a120e";
      pen.font = "12px sans-serif";
      pen.fillText(cam.inside ? "Inside" : "You", mark.x + 10, mark.y);
      if (cam.inside) {
        const seat = project(3, 4.2, 1.6, cam.yaw, cam.zoom, width, height);
        pen.fillStyle = "#d7e6ff";
        pen.beginPath();
        pen.arc(seat.x, seat.y, 7 * cam.zoom, 0, Math.PI * 2);
        pen.fill();
        pen.fillStyle = "#1a120e";
        pen.fillText("Tessera", seat.x + 10, seat.y);
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
    let walkFrame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let ax = 0;
      let ay = 0;
      if (keys.current.has("KeyA") || keys.current.has("ArrowLeft")) ax -= 1;
      if (keys.current.has("KeyD") || keys.current.has("ArrowRight")) ax += 1;
      if (keys.current.has("KeyW") || keys.current.has("ArrowUp")) ay -= 1;
      if (keys.current.has("KeyS") || keys.current.has("ArrowDown")) ay += 1;
      if (ax !== 0 || ay !== 0) {
        const cam = view.current;
        const next = stepHouse(cam.x, cam.y, ax, ay, dt * 6);
        if (cam.inside) {
          if (next.y < 0.35 && next.x > 1.5 && next.x < 4.5) {
            cam.inside = false;
            cam.x = 0;
            cam.y = 7.2;
            setInside(false);
          } else if (next.x > 0.45 && next.x < 5.55 && next.y > 0.45 && next.y < 5.55) {
            cam.x = next.x;
            cam.y = next.y;
          }
        } else if (!hitsWall(next.x, next.y)) {
          if (crossedDoor(cam.y, next.x, next.y)) {
            cam.inside = true;
            cam.x = 3;
            cam.y = 1.2;
            setInside(true);
          } else {
            cam.x = next.x;
            cam.y = next.y;
          }
        }
        paint();
      }
      walkFrame = window.requestAnimationFrame(step);
    };
    walkFrame = window.requestAnimationFrame(step);
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const probe = {
      getYaw: () => view.current.yaw,
      getSpeed: () => (keys.current.size > 0 ? 1 : 0),
      setKeys: (codes: string[]) => {
        keys.current = new Set(codes);
      },
      getInside: () => view.current.inside,
    };
    if (import.meta.env.DEV) window.__controlsTest = probe;
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(walkFrame);
      watch.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      if (window.__controlsTest === probe) delete window.__controlsTest;
      paintRef.current = () => {};
    };
  }, []);

  function hold(code: string, on: boolean) {
    if (on) keys.current.add(code);
    else keys.current.delete(code);
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#243656]">
      <canvas
        ref={canvasRef}
        className="min-h-0 w-full flex-1 touch-none"
        aria-label={inside ? "Inside the studio. Walk to the door to leave." : "Studio. Walk to the front door to go inside."}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, yaw: view.current.yaw };
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
      <div className="pointer-events-none absolute inset-x-0 bottom-24 px-3">
        <p className="text-[10px] text-white/80">{inside ? "You are inside. Walk back through the door to leave." : "Walk to the front door. W forward, A left, D right."}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 grid grid-cols-5 gap-2 px-2 py-2">
        <Pad label="Left" code="KeyA" hold={hold} />
        <Pad label="Door" code="KeyW" hold={hold} />
        <Pad label="Back" code="KeyS" hold={hold} />
        <Pad label="Right" code="KeyD" hold={hold} />
        <button
          type="button"
          className="h-12 border border-white/40 bg-black/45 text-sm text-white"
          onClick={() => {
            if (view.current.inside) {
              view.current.inside = false;
              view.current.x = 0;
              view.current.y = 7.2;
              setInside(false);
            } else {
              view.current.inside = true;
              view.current.x = 3;
              view.current.y = 1.2;
              setInside(true);
            }
            paintRef.current();
          }}
        >
          {inside ? "Leave" : "Go in"}
        </button>
      </div>
    </div>
  );
}

function Pad({ label, code, hold }: { label: string; code: string; hold: (code: string, on: boolean) => void }) {
  return (
    <button
      type="button"
      className="h-12 border border-white/40 bg-black/45 text-sm text-white"
      onPointerDown={(event) => {
        hold(code, true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={() => hold(code, false)}
      onPointerCancel={() => hold(code, false)}
    >
      {label}
    </button>
  );
}
