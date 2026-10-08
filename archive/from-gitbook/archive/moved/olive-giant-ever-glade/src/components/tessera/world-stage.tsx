import { useEffect, useMemo, useState } from "react";
import { searchWeb } from "@/lib/tessera/study";
import { useTessera } from "@/lib/tessera/store";
import { LIST_DONE } from "@/lib/tessera/list-003";

const LAT = 41.8781;
const LON = -87.6298;
const ZOOM = 16;
const COLS = 4;
const ROWS = 3;

const WORK = [
  ["Grok", "#e6c36a"],
  ["Cursor", "#8eb8ff"],
  ["Replit", "#7dcea0"],
  ["Desk", "#f4efe6"],
] as const;
const LOOKUPS = ["Wilhelm Reich", "Pluto the playwright", "Vatican Apostolic Archive"];
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
  const [step, setStep] = useState(0);
  const [risen, setRisen] = useState(3);
  const [live, setLive] = useState("Looking up a public page.");
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
    const timer = window.setInterval(() => setNow(new Date()), 5000);
    const rise = window.setInterval(() => setRisen((count) => Math.min(RISING.length, count + 1)), 8000);
    const walk = window.setInterval(() => setStep((count) => count + 1), 1200);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(rise);
      window.clearInterval(walk);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function pull(index: number) {
      const query = LOOKUPS[index % LOOKUPS.length];
      const result = await searchWeb({ data: { query } });
      if (stop) return;
      setLive(result.ok ? `${query}: ${result.text.replace(/\s+/g, " ").slice(0, 140)}` : `${query}: ${result.error}`);
    }
    void pull(0);
    const id = window.setInterval(() => void pull(Math.floor(Date.now() / 120000)), 120000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const places = [...RISING.slice(0, risen), ...built.filter((name) => !RISING.slice(0, risen).includes(name))];
  const sun = ((hour - 6) / 12) * Math.PI;
  const shadowX = Math.cos(sun) * light.shadow;
  const shadowY = Math.sin(sun) * (light.shadow * 0.45);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-[#102018]">
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
      {WORK.map(([name, color], index) => {
        const left = 10 + ((step * 5 + index * 22) % 74);
        const top = 58 - ((step * 3 + index * 11) % 40);
        return (
          <div key={name} className="absolute transition-all duration-1000" style={{ left: `${left}%`, top: `${top}%` }}>
            <span className="block h-3 w-3 rounded-full shadow" style={{ background: color }} />
            <span className="mt-1 block text-[11px] text-white drop-shadow">{name}</span>
          </div>
        );
      })}
      <p className="absolute left-3 top-2 max-w-[70%] text-[11px] leading-snug text-white drop-shadow">
        This upgrade: {LIST_DONE} of the first list are on the Board. The map is a picture, not a fact.
      </p>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-10 pb-2">
        <p className="line-clamp-2 text-[11px] leading-snug text-white">
          {clock} Central · {light.name} · {live}
          {failed ? " · imagery did not load" : ""}
        </p>
      </div>
      <p className="absolute right-3 top-2 text-[10px] text-white/80">Imagery © Esri, Maxar, Earthstar Geographics</p>
    </div>
  );
}
