import { useEffect, useRef, useState } from "react";

const N = 16;
type Kind = "grass" | "path" | "water" | "house" | "tree" | "plaza" | "garden";

const HOUSES: Record<string, string> = {
  "3,3": "Hearth",
  "12,3": "Library",
  "3,12": "Workshop",
  "12,12": "Gate",
  "8,4": "Agora",
};

const WALKERS = [
  { name: "Tessera", queen: true },
  { name: "Theta", queen: false },
  { name: "Gamma", queen: false },
  { name: "Eta", queen: false },
  { name: "Delta", queen: false },
  { name: "Lambda", queen: false },
];

function kindAt(x: number, y: number): Kind {
  if (y < 2) return "water";
  if (HOUSES[`${x},${y}`]) return "house";
  if (x > 6 && x < 10 && y > 6 && y < 10) return "plaza";
  if (x === 8 || y === 8 || (x > 2 && x < 13 && (y === 3 || y === 12)) || (y > 2 && y < 13 && (x === 3 || x === 12))) {
    return "path";
  }
  if ((x === 5 && y === 5) || (x === 10 && y === 6) || (x === 6 && y === 10) || (x === 11 && y === 10)) return "garden";
  if ((x * 3 + y * 5) % 11 === 0) return "tree";
  return "grass";
}

function iso(x: number, y: number, w: number, h: number) {
  const tw = Math.min(54, w / 18);
  const th = tw * 0.5;
  return {
    sx: w / 2 + (x - y) * (tw / 2),
    sy: h * 0.18 + (x + y) * (th / 2),
    tw,
    th,
  };
}

export function WorldStage() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [rows, setRows] = useState<{ name: string; parent: string; proof: string }[]>([]);
  const setRowsRef = useRef(setRows);
  setRowsRef.current = setRows;

  useEffect(() => {
    const found = ref.current;
    if (!found) return;
    const ink = found.getContext("2d");
    if (!ink) return;
    const surface: HTMLCanvasElement = found;
    const pen: CanvasRenderingContext2D = ink;
    let frame = 0;
    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const path: { x: number; y: number }[] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const kind = kindAt(x, y);
        if (kind === "path" || kind === "plaza") path.push({ x, y });
      }
    }
    const houses: Record<string, string> = { ...HOUSES };
    const made = new Set<string>();
    const childNames = ["Scribe", "Mason", "Keeper", "Tuner", "Herald", "Warder", "Cartographer", "Archivist"];
    const people = WALKERS.map((walker, i) => ({
      ...walker,
      child: false,
      at: (i * 7) % path.length,
      next: (i * 7 + 1) % path.length,
      t: 0,
    }));

    function resize() {
      const rect = surface.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      surface.width = Math.max(1, rect.width * dpr);
      surface.height = Math.max(1, rect.height * dpr);
    }
    resize();
    const watch = new ResizeObserver(resize);
    watch.observe(surface);

    function diamond(sx: number, sy: number, tw: number, th: number, color: string) {
      pen.fillStyle = color;
      pen.beginPath();
      pen.moveTo(sx, sy);
      pen.lineTo(sx + tw / 2, sy + th / 2);
      pen.lineTo(sx, sy + th);
      pen.lineTo(sx - tw / 2, sy + th / 2);
      pen.closePath();
      pen.fill();
    }

    function tick() {
      frame += 1;
      if (frame % 360 === 0 && Object.keys(houses).length < 13 && people.length < 14) {
        let placed = false;
        for (let y = 2; y < N - 1 && !placed; y++) {
          for (let x = 1; x < N - 1 && !placed; x++) {
            const key = `${x},${y}`;
            if (houses[key] || kindAt(x, y) !== "grass") continue;
            const beside =
              kindAt(x - 1, y) === "path" ||
              kindAt(x + 1, y) === "path" ||
              kindAt(x, y - 1) === "path" ||
              kindAt(x, y + 1) === "path";
            if (!beside) continue;
            const maker = people.find((person) => !person.queen && !person.child && !made.has(person.name));
            if (!maker) continue;
            const name = childNames[made.size % childNames.length];
            houses[key] = name;
            made.add(maker.name);
            const born = name;
            const parent = maker.name;
            void crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${parent}->${born}`)).then((buf) => {
              const proof = [...new Uint8Array(buf)]
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")
                .slice(0, 12);
              setRowsRef.current((prev) => [...prev, { name: born, parent, proof }]);
            });
            people.push({
              name,
              queen: false,
              child: true,
              at: maker.at % path.length,
              next: (maker.at + 3) % path.length,
              t: 0,
            });
            placed = true;
          }
        }
      }
      if (!reduced || frame % 20 === 0) {
        for (const person of people) {
          person.t += reduced ? 1 : 0.012;
          if (person.t >= 1) {
            person.t = 0;
            person.at = person.next;
            person.next = (person.next + 1) % path.length;
          }
        }
      }
      const w = surface.width;
      const h = surface.height;
      pen.clearRect(0, 0, w, h);
      const sky = pen.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#6ea0c8");
      sky.addColorStop(0.45, "#d7c4a2");
      sky.addColorStop(1, "#1c3a32");
      pen.fillStyle = sky;
      pen.fillRect(0, 0, w, h);

      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const p = iso(x, y, w, h);
          const label = houses[`${x},${y}`];
          const kind = label ? "house" : kindAt(x, y);
          const grass = (x + y) % 2 === 0 ? "#2f6a45" : "#27603d";
          const fill =
            kind === "water" ? "#2a6f99" : kind === "path" ? "#cbb89a" : kind === "plaza" ? "#e4d3ae" : kind === "garden" ? "#3e8f55" : grass;
          diamond(p.sx, p.sy, p.tw, p.th, fill);
          if (kind === "water" && (x + y + Math.floor(frame / 20)) % 4 === 0) {
            pen.fillStyle = "rgba(255,255,255,0.35)";
            pen.fillRect(p.sx - 4, p.sy + p.th / 2, 8, 2);
          }
          if (kind === "tree") {
            pen.fillStyle = "#6b4423";
            pen.fillRect(p.sx - 2, p.sy + 6, 4, 10);
            pen.fillStyle = "#1f6b3a";
            pen.beginPath();
            pen.arc(p.sx, p.sy + 4, 9, 0, Math.PI * 2);
            pen.fill();
          }
          if (kind === "house") {
            pen.fillStyle = "#f4efe6";
            pen.fillRect(p.sx - 12, p.sy - 8, 24, 18);
            pen.fillStyle = "#e0c36a";
            pen.beginPath();
            pen.moveTo(p.sx - 16, p.sy - 6);
            pen.lineTo(p.sx, p.sy - 22);
            pen.lineTo(p.sx + 16, p.sy - 6);
            pen.closePath();
            pen.fill();
            pen.fillStyle = "#6b3a2a";
            pen.fillRect(p.sx - 3, p.sy + 2, 6, 8);
            pen.fillStyle = "#1a1024";
            pen.font = "12px Outfit, sans-serif";
            pen.fillText(label, p.sx - pen.measureText(label).width / 2, p.sy - 26);
          }
        }
      }

      for (const person of people) {
        const a = path[person.at];
        const b = path[person.next];
        const x = a.x + (b.x - a.x) * person.t;
        const y = a.y + (b.y - a.y) * person.t;
        const p = iso(x, y, w, h);
        const foot = p.sy + p.th * 0.55;
        pen.fillStyle = "rgba(0,0,0,0.25)";
        pen.beginPath();
        pen.ellipse(p.sx, foot + 8, 7, 3, 0, 0, Math.PI * 2);
        pen.fill();
        pen.fillStyle = person.queen ? "#e0c36a" : person.child ? "#8ee0d2" : "#3dceb6";
        const body = person.child ? 6 : 8;
        pen.fillRect(p.sx - body / 2, foot - 10, body, person.child ? 11 : 14);
        pen.fillStyle = person.queen ? "#f6f1e8" : "#16332e";
        pen.beginPath();
        pen.arc(p.sx, foot - 14, person.queen ? 5 : person.child ? 3 : 4, 0, Math.PI * 2);
        pen.fill();
        if (person.queen || person.child) {
          pen.fillStyle = "#1a1024";
          pen.font = "12px Outfit, sans-serif";
          pen.fillText(person.name, p.sx - 22, foot - 24);
        }
      }

      pen.fillStyle = "#1a1024";
      pen.font = "13px Outfit, sans-serif";
      const edge = Object.keys(houses).length >= 13 || made.size >= 6;
      pen.fillText(
        edge
          ? `${people.length} sprites · timer stopped at the page edge`
          : `${people.length} sprites · ${Object.keys(houses).length} houses · timer, not a mind`,
        16,
        28,
      );

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      watch.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={ref}
        className="h-[70dvh] min-h-96 w-full rounded-xl border border-border"
        aria-label="A drawn neighborhood. Sprites are added by a timer. They do not think."
      />
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs tracking-[0.18em] text-subtle uppercase">What a retest can check</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
          <li>Chat is the Grok model with a Tessera prompt. There is no second process speaking.</li>
          <li>These rows appear only after the timer adds a sprite. The hash is SHA-256 of parent, arrow, name. Nothing was searched or saved to disk.</li>
          <li>Not done: reading every file, training weights, infinite helpers, or a server that keeps going after this tab closes.</li>
        </ul>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-fg">No sprite has been added yet. The first one appears after a few seconds with this tab open.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1 font-mono text-xs text-fg">
            {rows.map((row) => (
              <li key={`${row.parent}-${row.name}`}>
                {row.parent} → {row.name} · {row.proof}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
