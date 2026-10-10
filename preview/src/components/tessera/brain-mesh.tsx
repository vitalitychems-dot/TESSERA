import { useEffect, useMemo, useRef, useState } from "react";
import { AGENTS } from "@/lib/tessera/identity";
import { brainVolume, grown, projectPoint, type VolumeNode } from "@/lib/tessera/brain-volume";
import { perceptron } from "@/lib/tessera/perceptron";

const STEPS = ["reward", "leak", "reset", "warmup", "sequence", "selector", "ranking"];
const MEMORY = ["kept pages", "corrections", "catalog", "query ranks"];

const COLOR: Record<VolumeNode["part"], string> = {
  region: "#7FDBFF",
  step: "#9dffce",
  memory: "#e7d6ff",
  link: "#ffffff",
};

export function BrainMesh() {
  const named = useMemo(
    () => [
      ...AGENTS.map((agent) => ({ name: agent.name, part: "region" as const })),
      ...STEPS.map((name) => ({ name, part: "step" as const })),
      ...MEMORY.map((name) => ({ name, part: "memory" as const })),
    ],
    [],
  );
  const volume = useMemo(() => brainVolume(named), [named]);
  const [yaw, setYaw] = useState(0.6);
  const [pitch, setPitch] = useState(0.35);
  const [zoom, setZoom] = useState(1.4);
  const [growth, setGrowth] = useState(1);
  const [play, setPlay] = useState(false);
  const [picked, setPicked] = useState("Tessera");
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const unit = perceptron([1, 1], [0.6, 0.6], 1);
  const visible = grown(volume.nodes, growth);
  const visibleIds = new Set(visible.map((node) => node.id));
  const byId = new Map(volume.nodes.map((node) => [node.id, node]));
  const drawn = visible
    .map((node) => ({ node, at: projectPoint(node, yaw, pitch, zoom) }))
    .sort((a, b) => b.at.depth - a.at.depth);

  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => {
      setGrowth((value) => (value >= 1 ? 0 : Math.min(1, value + 0.02)));
    }, 80);
    return () => window.clearInterval(id);
  }, [play]);

  return (
    <section>
      <h3 className="font-display text-2xl">The volume</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Drag to turn it. The wheel zooms. The fourth axis is growth, from the first point to the full volume. A perceptron fires when the weighted sum crosses the threshold. This one sums to {unit.sum} and {unit.fired ? "fires" : "stays quiet"}. Cyan is a region, green is a step she can run, and violet is memory. It is not a hidden box.
      </p>
      <div
        className="mt-3 touch-none overflow-hidden rounded-2xl bg-black"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, yaw, pitch };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setYaw(drag.current.yaw + (event.clientX - drag.current.x) * 0.01);
          setPitch(drag.current.pitch + (event.clientY - drag.current.y) * 0.008);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onWheel={(event) => {
          setZoom((value) => Math.min(4, Math.max(0.6, value * (event.deltaY > 0 ? 0.92 : 1.08))));
        }}
      >
        <svg viewBox="-220 -130 440 260" className="h-96 w-full" role="img" aria-label="Tessera brain volume">
          {volume.edges.map(([a, b]) => {
            if (!visibleIds.has(a) || !visibleIds.has(b)) return null;
            const from = byId.get(a);
            const to = byId.get(b);
            if (!from || !to) return null;
            const left = projectPoint(from, yaw, pitch, zoom);
            const right = projectPoint(to, yaw, pitch, zoom);
            return <line key={`${a}-${b}`} x1={left.x} y1={left.y} x2={right.x} y2={right.y} stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />;
          })}
          {drawn.map(({ node, at }) => (
            <circle
              key={node.id}
              cx={at.x}
              cy={at.y}
              r={node.name ? 2.2 : 0.7}
              fill={node.name === picked ? "#ffffff" : COLOR[node.part]}
              opacity={node.name ? 1 : 0.75}
              onClick={() => node.name && setPicked(node.name)}
            >
              {node.name ? <title>{node.name}</title> : null}
            </circle>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="rounded-full border border-border px-3 py-1 text-sm text-fg" onClick={() => setPlay((value) => !value)}>
          {play ? "Pause growth" : "Play growth"}
        </button>
        <input
          aria-label="Growth"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={growth}
          onChange={(event) => setGrowth(Number(event.target.value))}
          className="w-full"
        />
      </div>
      <p className="mt-2 text-sm text-fg">
        {picked}. {visible.length} of {volume.nodes.length} points. {volume.edges.length} links. {visible.filter((node) => node.name).length} named points are in view.
      </p>
    </section>
  );
}
