import { useEffect, useMemo, useState } from "react";
import { roomsAt, stepHouse } from "@/lib/tessera/house-sim";
import { stepCivic } from "@/lib/tessera/civic";

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

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 900);
    return () => window.clearInterval(id);
  }, []);

  const people = stepHouse(tick);
  const together = roomsAt(tick);
  const city = stepCivic(tick);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden border border-border bg-surface">
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
  );
}
