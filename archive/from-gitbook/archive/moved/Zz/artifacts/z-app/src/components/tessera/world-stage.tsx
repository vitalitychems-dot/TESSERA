import { useEffect, useMemo, useState } from "react";
import { useTessera } from "@/lib/tessera/store";

const LAT = 41.8781;
const LON = -87.6298;
const ZOOM = 16;
const COLS = 4;
const ROWS = 3;

const RISING = ["Hearth", "Library", "Workshop", "Garden", "Orchard", "Well", "School", "Gate"];

function chicagoHour(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 12);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour + minute / 60;
}

function lightFor(hour: number) {
  if (hour < 5 || hour >= 20.5) return { name: "night", veil: "rgba(6,12,28,0.55)", shadow: 14 };
  if (hour < 7) return { name: "dawn", veil: "rgba(196,110,70,0.22)", shadow: 10 };
  if (hour < 17) return { name: "day", veil: "rgba(0,0,0,0)", shadow: 6 };
  if (hour < 19.5) return { name: "dusk", veil: "rgba(180,70,40,0.28)", shadow: 12 };
  return { name: "evening", veil: "rgba(20,16,40,0.4)", shadow: 14 };
}

function tileXY(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

export function WorldStage() {
  const built = useTessera((s) => s.built);
  const [now, setNow] = useState(() => new Date());
  const [risen, setRisen] = useState(3);
  const [failed, setFailed] = useState(false);
  const hour = chicagoHour(now);
  const light = lightFor(hour);
  const clock = now.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
  const origin = useMemo(() => tileXY(LAT, LON, ZOOM), []);
  const tiles = useMemo(() => {
    const startX = Math.floor(origin.x) - 1;
    const startY = Math.floor(origin.y) - 1;
    const list: { x: number; y: number }[] = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) list.push({ x: startX + col, y: startY + row });
    }
    return list;
  }, [origin.x, origin.y]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    const rise = window.setInterval(() => setRisen((count) => Math.min(RISING.length, count + 1)), 20000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(rise);
    };
  }, []);

  const places = [...RISING.slice(0, risen), ...built.filter((name) => !RISING.slice(0, risen).includes(name))];
  const sun = ((hour - 6) / 12) * Math.PI;
  const shadowX = Math.cos(sun) * light.shadow;
  const shadowY = Math.sin(sun) * (light.shadow * 0.45);

  return (
    <div className="relative h-[52vh] w-full overflow-hidden rounded-xl border border-border bg-[#102018]">
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
      <div className="pointer-events-none absolute inset-0" style={{ background: light.veil }} />
      {places.map((name, index) => {
        const left = 18 + ((index * 17) % 64);
        const top = 22 + ((index * 13) % 52);
        return (
          <div key={name} className="absolute" style={{ left: `${left}%`, top: `${top}%` }}>
            <span
              className="absolute block h-2 w-6 rounded-full bg-black/50"
              style={{ transform: `translate(${shadowX}px, ${8 + shadowY}px)` }}
            />
            <span className="relative block h-3 w-3 rounded-sm bg-[#f4efe6] shadow" />
            <span className="relative mt-1 block max-w-24 text-[11px] text-white drop-shadow">{name}</span>
          </div>
        );
      })}
      <p className="absolute bottom-2 left-3 right-3 text-[11px] text-white drop-shadow">
        {clock} Central · {light.name} · satellite photograph of Chicago, not a second Earth
        {failed ? " · imagery did not load" : ""}
      </p>
      <p className="absolute right-3 top-2 text-[10px] text-white/80">Imagery © Esri, Maxar, Earthstar Geographics</p>
    </div>
  );
}
