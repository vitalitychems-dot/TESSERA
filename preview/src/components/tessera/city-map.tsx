import { useState } from "react";

/** Taken from the saved TESS file artifacts/tessera/src/pages/life/WorldMap.tsx, sha256 prefix 4cfc1cdde41bf08d. Income fields in that file are not shown. */
const PLACES = [
  { type: "home", zone: "residential", x: 0, y: 0 },
  { type: "home", zone: "residential", x: 1, y: 0 },
  { type: "home", zone: "residential", x: 0, y: 1 },
  { type: "home", zone: "residential", x: 1, y: 1 },
  { type: "gathering", zone: "civic", x: 3, y: 0 },
  { type: "academy", zone: "civic", x: 4, y: 0 },
  { type: "archive", zone: "civic", x: 3, y: 1 },
  { type: "observatory", zone: "civic", x: 4, y: 1 },
  { type: "market", zone: "commercial", x: 7, y: 0 },
  { type: "cafe", zone: "commercial", x: 6, y: 1 },
  { type: "restaurant", zone: "commercial", x: 7, y: 1 },
  { type: "forge", zone: "industrial", x: 0, y: 3 },
  { type: "mine", zone: "industrial", x: 1, y: 3 },
  { type: "garage", zone: "industrial", x: 0, y: 4 },
  { type: "arena", zone: "industrial", x: 1, y: 4 },
  { type: "hospital", zone: "civic", x: 3, y: 3 },
  { type: "school", zone: "civic", x: 4, y: 4 },
  { type: "garden", zone: "green", x: 6, y: 3 },
  { type: "museum", zone: "green", x: 7, y: 3 },
  { type: "theater", zone: "green", x: 6, y: 4 },
  { type: "library", zone: "green", x: 7, y: 4 },
  { type: "gym", zone: "civic", x: 9, y: 0 },
  { type: "church", zone: "civic", x: 9, y: 1 },
] as const;

const ZONE: Record<string, string> = {
  residential: "bg-surface",
  commercial: "bg-alive/15",
  civic: "bg-accent/15",
  industrial: "bg-bg",
  green: "bg-alive/25",
};

export function CityMap() {
  const [picked, setPicked] = useState<string | null>(null);
  const place = PLACES.find((item) => item.type + item.x + item.y === picked);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">City from the saved map file</p>
      <p className="mt-2 text-sm text-muted">
        These blocks are the layout in WorldMap.tsx from the TESS download. The bank block in that file is left out. Nothing here earns money or has a mood.
      </p>
      <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {PLACES.map((item) => {
          const id = item.type + item.x + item.y;
          const on = picked === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPicked(id)}
              className={`min-h-16 rounded-lg border px-1 py-2 text-left text-[11px] ${ZONE[item.zone]} ${on ? "border-accent text-fg" : "border-border text-muted"}`}
            >
              {item.type.replaceAll("_", " ")}
            </button>
          );
        })}
      </div>
      {place ? (
        <p className="mt-3 font-mono text-xs text-fg">
          {place.type} · {place.zone} · grid {place.x},{place.y} · source 4cfc1cdde41bf08d
        </p>
      ) : null}
    </div>
  );
}
