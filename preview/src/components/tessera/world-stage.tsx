import { useEffect, useRef, useState } from "react";

/** A block house you can pan and zoom. Not a game, and not a map. */

type Cube = { x: number; y: number; z: number; top: string; left: string; right: string };

const GRASS = ["#6eae58", "#4e8438", "#3c6a2c"];
const DIRT = ["#8a6244", "#6b4630", "#543624"];
const PLANK = ["#d7b07a", "#b8884e", "#8d6436"];
const PLASTER = ["#f4e7cf", "#e2d0b0", "#cbb892"];
const TIMBER = ["#6a4030", "#4e2e22", "#3a2218"];
const ROOF = ["#c4533e", "#9a382c", "#74281e"];
const GLASS = ["#d5fff6", "#8ee0d4", "#5eb8b0"];
const STONE = ["#b7b2a8", "#8e8980", "#6e6a62"];
const GOLD = ["#ffe08a", "#e6b84a", "#c4922a"];
const LAMP = ["#fff1b0", "#ffd36a", "#e6a83a"];

function put(list: Cube[], x: number, y: number, z: number, colors: string[]) {
  list.push({ x, y, z, top: colors[0], left: colors[1], right: colors[2] });
}

function buildHouse(): Cube[] {
  const blocks: Cube[] = [];
  for (let x = -9; x <= 8; x += 1) {
    for (let y = -7; y <= 7; y += 1) {
      const path = x >= -1 && x <= 1 && y >= 2;
      put(blocks, x, y, 0, path ? STONE : GRASS);
      if (x === -9 || y === -7 || x === 8 || y === 7) put(blocks, x, y, -1, DIRT);
    }
  }
  for (let x = -4; x <= 4; x += 1) {
    for (let y = -3; y <= 2; y += 1) put(blocks, x, y, 1, PLANK);
  }
  for (let z = 2; z <= 4; z += 1) {
    for (let x = -4; x <= 4; x += 1) put(blocks, x, -3, z, x % 2 === 0 ? TIMBER : PLASTER);
    for (let y = -2; y <= 2; y += 1) {
      put(blocks, -4, y, z, y % 2 === 0 ? TIMBER : PLASTER);
      put(blocks, 4, y, z, y % 2 === 0 ? TIMBER : PLASTER);
    }
  }
  for (const spot of [
    [-2, -3],
    [0, -3],
    [2, -3],
    [-4, 0],
    [4, 0],
  ] as const) {
    put(blocks, spot[0], spot[1], 3, GLASS);
  }
  for (let z = 5; z <= 7; z += 1) {
    const inset = z - 5;
    for (let x = -4 + inset; x <= 4 - inset; x += 1) {
      for (let y = -3 + inset; y <= 2 - inset; y += 1) {
        const edge = x === -4 + inset || x === 4 - inset || y === -3 + inset || y === 2 - inset || z === 7;
        if (edge) put(blocks, x, y, z, ROOF);
      }
    }
  }
  for (let z = 1; z <= 9; z += 1) {
    for (let x = 5; x <= 6; x += 1) {
      for (let y = -5; y <= -4; y += 1) put(blocks, x, y, z, z === 8 ? GOLD : STONE);
    }
  }
  put(blocks, 5, -4, 10, GOLD);
  put(blocks, -1, 1, 2, PLANK);
  put(blocks, -1, 1, 3, GLASS);
  put(blocks, 1, 0, 2, PLANK);
  put(blocks, 1, 0, 3, LAMP);
  put(blocks, -7, 4, 1, TIMBER);
  put(blocks, -7, 4, 2, TIMBER);
  for (let x = -8; x <= -6; x += 1) for (let y = 3; y <= 5; y += 1) put(blocks, x, y, 3, GRASS);
  return blocks.sort((a, b) => a.x + a.y + a.z * 0.01 - (b.x + b.y + b.z * 0.01));
}

const HOUSE = buildHouse();

function project(x: number, y: number, z: number, zoom: number, panX: number, panY: number, width: number, height: number) {
  const tile = 18 * zoom;
  return {
    x: width * 0.5 + (x - y) * tile + panX,
    y: height * 0.62 + (x + y) * tile * 0.5 - z * tile + panY,
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

const SEATS = [
  { name: "Tessera", x: -1, y: 2.2, line: "Talk is hers" },
  { name: "Rick", x: 3.2, y: -1, line: "Shop is open" },
  { name: "Cursor", x: -6, y: 1, line: "Bench" },
  { name: "Replit", x: 2, y: 4, line: "Bay" },
];

export function WorldStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const view = useRef({ zoom: 1, x: 0, y: 0 });
  view.current = { zoom, x: pan.x, y: pan.y };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const draw = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
      }
      const pen = canvas.getContext("2d");
      if (!pen) return;
      pen.setTransform(ratio, 0, 0, ratio, 0, 0);
      const sky = pen.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#243156");
      sky.addColorStop(0.55, "#c4785a");
      sky.addColorStop(1, "#6f8f4e");
      pen.fillStyle = sky;
      pen.fillRect(0, 0, width, height);
      const cam = view.current;
      const at = (x: number, y: number, z: number) => project(x, y, z, cam.zoom, cam.x, cam.y, width, height);
      for (const block of HOUSE) {
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
      const bob = Math.sin(now / 700) * 0.15;
      for (const seat of SEATS) {
        const step = seat.name === "Tessera" ? bob : -bob;
        const foot = at(seat.x, seat.y + step, 1);
        const head = at(seat.x, seat.y + step, 2.4);
        pen.fillStyle = "#f4e7cf";
        pen.beginPath();
        pen.arc(head.x, head.y, 7 * cam.zoom, 0, Math.PI * 2);
        pen.fill();
        pen.fillStyle = "#4e2e22";
        pen.fillRect(foot.x - 5 * cam.zoom, foot.y - 16 * cam.zoom, 10 * cam.zoom, 16 * cam.zoom);
        pen.fillStyle = "#fff8e8";
        pen.font = `${Math.max(10, 11 * cam.zoom)}px sans-serif`;
        pen.fillText(seat.name, head.x + 8, head.y);
      }
      pen.fillStyle = "#fff8e8";
      pen.font = "12px sans-serif";
      pen.fillText("Block house · drag to look", 12, 22);
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1a120e]">
      <canvas
        ref={canvasRef}
        className="min-h-0 w-full flex-1 touch-none"
        aria-label="Block house. Drag to look around."
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setPan({
            x: drag.current.px + event.clientX - drag.current.x,
            y: drag.current.py + event.clientY - drag.current.y,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      />
      <div className="flex shrink-0 gap-2 overflow-x-auto px-2 py-2">
        <button type="button" className="h-10 shrink-0 border border-[#e7b3a1] px-3 text-sm text-[#f6efe8]" onClick={() => setZoom((value) => Math.min(2.2, value + 0.2))}>
          Closer
        </button>
        <button type="button" className="h-10 shrink-0 border border-[#6a4030] px-3 text-sm text-[#f6efe8]" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>
          Farther
        </button>
        <button type="button" className="h-10 shrink-0 border border-[#6a4030] px-3 text-sm text-[#f6efe8]" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
          Door
        </button>
      </div>
    </div>
  );
}
