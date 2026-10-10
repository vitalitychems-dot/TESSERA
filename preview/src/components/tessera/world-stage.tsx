import { useEffect, useMemo, useRef, useState } from "react";
import { roomsAt, stepHouse } from "@/lib/tessera/house-sim";
import { stepCivic } from "@/lib/tessera/civic";
import { watchCity } from "@/lib/tessera/city-clock";
import { moveCamera, roomLayout } from "@/lib/tessera/room-world";

const LAT = 41.8781;
const LON = -87.6298;
const ZOOM = 16;
const COLS = 4;
const ROWS = 3;

function chicagoHour(now: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function tileXY(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

export function WorldStage() {
  const [clock, setClock] = useState(() => chicagoHour(new Date()));
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const origin = useMemo(() => tileXY(LAT, LON, ZOOM), []);
  const tiles = useMemo(() => {
    const list: { x: number; y: number }[] = [];
    const x0 = Math.floor(origin.x) - 1;
    const y0 = Math.floor(origin.y) - 1;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) list.push({ x: x0 + col, y: y0 + row });
    }
    return list;
  }, [origin.x, origin.y]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(chicagoHour(new Date())), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => watchCity(setTick), []);

  const people = stepHouse(tick);
  const together = roomsAt(tick);
  const city = stepCivic(tick);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rooms = stepCivic(tick).homes.map((home, index) => roomLayout(home.name, index));
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const pen = canvas.getContext("2d");
      if (!pen) return;
      pen.setTransform(ratio, 0, 0, ratio, 0, 0);
      pen.fillStyle = "#101418";
      pen.fillRect(0, 0, width, height);
      pen.save();
      pen.translate(width / 2, height / 2);
      pen.scale(camera.zoom, camera.zoom);
      pen.translate(-camera.x, -camera.y);
      for (const room of rooms) {
        pen.strokeStyle = "#7FDBFF";
        pen.strokeRect(room.x, 16, 210, 140);
        pen.fillStyle = "#e8eef2";
        pen.font = "12px sans-serif";
        pen.fillText(room.name, room.x + 8, 32);
        for (const thing of room.things) {
          pen.fillStyle = thing.thing === "computer" ? "#9dffce" : "#243040";
          pen.fillRect(thing.x, thing.y + 20, 40, 22);
          pen.fillStyle = "#e8eef2";
          pen.font = "10px sans-serif";
          pen.fillText(thing.thing, thing.x, thing.y + 16);
        }
      }
      pen.restore();
    };
    let frameId = 0;
    const loop = () => {
      draw();
      frameId = window.requestAnimationFrame(loop);
    };
    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [camera, tick]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[42vh] w-full overflow-hidden border border-border bg-surface">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
        {tiles.map((tile) => (
          <img
            key={`${tile.x}-${tile.y}`}
            alt=""
            className="h-full w-full object-cover"
            src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${ZOOM}/${tile.y}/${tile.x}`}
            onError={() => setFailed(true)}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-bg/80 px-3 py-3">
        <p className="text-sm text-fg">Chicago · {clock} Central{failed ? " · the imagery did not load" : ""}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          The house is turning on its own. {together.length ? together.join(". ") : "They are apart."} {city.chair} chairs. Work counted: {city.work}. {city.passed ? "Law stands" : "Law refused"}: {city.law}
        </p>
      </div>
      {people.map((person) => (
        <span
          key={person.name}
          className="absolute text-xs text-white"
          style={{ left: `${50 + person.x * 28}%`, top: `${46 + person.y * 28}%` }}
        >
          {person.name} {city.homes.find((home) => home.name === person.name)?.built ?? 0}
        </span>
      ))}
      <p className="absolute top-2 right-3 text-[10px] text-white/80">Imagery © Esri, Maxar, Earthstar Geographics</p>
    </div>
    <div className="border border-border bg-bg px-3 py-3">
      <p className="text-sm text-fg">A 2D camera on their rooms. Drag to look. Turn {tick}. Zoom {camera.zoom.toFixed(1)}.</p>
      <canvas
        ref={canvasRef}
        className="mt-2 h-56 w-full touch-none bg-surface"
        aria-label="2D camera on their rooms"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const dx = (drag.current.x - event.clientX) / camera.zoom;
          const dy = (drag.current.y - event.clientY) / camera.zoom;
          drag.current = { x: event.clientX, y: event.clientY };
          setCamera((current) => moveCamera(current, dx, dy));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      />
      <div className="mt-2 flex gap-2">
        <button type="button" className="h-11 rounded-full border border-border px-4 text-sm text-fg" onClick={() => setCamera((current) => moveCamera(current, 0, 0, 1.2))}>
          Closer
        </button>
        <button type="button" className="h-11 rounded-full border border-border px-4 text-sm text-fg" onClick={() => setCamera((current) => moveCamera(current, 180, 0))}>
          Next room
        </button>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {city.homes.map((home) => (
          <li key={home.name} className="text-xs text-muted">
            {home.name}, {home.office}. A computer, a desk, a lamp, a book, a door, a chair, a window, and a clock.
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{city.government}</p>
      <p className="mt-1 text-xs text-fg">{city.passed ? "Law stands" : "Law refused"}. {city.reason}</p>
      </div>
    </div>
  );
}
