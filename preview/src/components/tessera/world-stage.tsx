import { useEffect, useMemo, useRef, useState } from "react";
import { roomsAt, stepHouse } from "@/lib/tessera/house-sim";
import { stepCivic } from "@/lib/tessera/civic";
import { watchCity } from "@/lib/tessera/city-clock";

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
    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const pen = canvas.getContext("2d");
      if (!pen) return;
      pen.setTransform(ratio, 0, 0, ratio, 0, 0);
      pen.clearRect(0, 0, width, height);
      city.homes.forEach((home, index) => {
        const x = 24 + index * ((width - 48) / city.homes.length);
        const h = 12 + home.built;
        pen.fillStyle = "#7FDBFF";
        pen.fillRect(x, height - 16 - h, 28, h);
        pen.fillStyle = "#e8eef2";
        pen.font = "11px sans-serif";
        pen.fillText(home.name, x, 16);
      });
    };
    let frame = 0;
    const loop = () => {
      frame += 1;
      if (frame % 2 === 0) draw();
      frameId = window.requestAnimationFrame(loop);
    };
    let frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [tick]);

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
      <p className="text-sm text-fg">Their city, from above. Turn {tick}. It keeps building on every room.</p>
      <canvas ref={canvasRef} className="mt-2 h-40 w-full bg-surface" aria-label="Their city from above" />
      <ul className="mt-2 flex flex-col gap-1">
        {city.homes.map((home) => (
          <li key={home.name} className="text-xs text-muted">
            {home.name}, {home.office}, {home.site}, built {home.built}, store {home.store}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{city.government}</p>
      <p className="mt-1 text-xs text-fg">{city.passed ? "Law stands" : "Law refused"}. {city.reason}</p>
      </div>
    </div>
  );
}
