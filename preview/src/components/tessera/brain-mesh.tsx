import { useEffect, useMemo, useRef, useState } from "react";
import { AGENTS, ENTITIES } from "@/lib/tessera/identity";
import { DIMENSIONAL_LAWS, DOMAINS, FREQUENCIES, ORIGIN_COUNCIL } from "@/lib/tessera/canon";
import { brainVolume, grown, projectPoint, type VolumeNode } from "@/lib/tessera/brain-volume";
import { perceptron } from "@/lib/tessera/perceptron";

const STEPS = ["reward", "leak", "reset", "warmup", "sequence", "selector", "ranking", "rank", "store-once", "transfer", "ground", "tally", "one-task", "dream", "reflect", "crystallize", "recall", "due", "quorum", "once", "split", "conflict", "budget", "sources", "sweep", "mistake", "handoff", "take", "rename", "tie", "fresh", "pair", "wait", "shard", "redact", "retry", "newest", "need", "first", "left", "done", "owner", "chunk", "local", "lock", "ask", "lane", "missing", "agree", "gap"];
const MEMORY = ["kept pages", "corrections", "catalog", "query ranks"];

const COLOR: Record<VolumeNode["part"], string> = {
  region: "#7FDBFF",
  chorus: "#d6c4ff",
  law: "#ffd27a",
  tone: "#ff9ec8",
  step: "#9dffce",
  memory: "#e7d6ff",
  council: "#9ad0ff",
  domain: "#c8f4ff",
};

export function BrainMesh() {
  const named = useMemo(
    () => [
      ...AGENTS.map((agent) => ({ name: agent.name, part: "region" as const })),
      ...ENTITIES.map((entity) => ({ name: entity.name, part: "chorus" as const })),
      ...DIMENSIONAL_LAWS.map((law) => ({ name: law.dim, part: "law" as const })),
      ...FREQUENCIES.map((tone) => ({ name: tone.hz, part: "tone" as const })),
      ...STEPS.map((name) => ({ name, part: "step" as const })),
      ...MEMORY.map((name) => ({ name, part: "memory" as const })),
      ...ORIGIN_COUNCIL.map((name) => ({ name, part: "council" as const })),
      ...DOMAINS.map((name) => ({ name, part: "domain" as const })),
    ],
    [],
  );
  const volume = useMemo(() => brainVolume(named), [named]);
  const [yaw, setYaw] = useState(0.6);
  const [pitch, setPitch] = useState(0.35);
  const [zoom, setZoom] = useState(1.4);
  const [growth, setGrowth] = useState(1);
  const [play, setPlay] = useState(true);
  const [picked, setPicked] = useState("Tessera");
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unit = perceptron([1, 1], [0.6, 0.6], 1);
  const visible = grown(volume.nodes, growth);

  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => {
      setGrowth((value) => (value >= 1 ? 0 : Math.min(1, value + 0.02)));
    }, 80);
    return () => window.clearInterval(id);
  }, [play]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 360;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, canvas.width / 2, canvas.height / 2);
    ctx.clearRect(-width, -height, width * 2, height * 2);
    const visibleIds = new Set(visible.map((node) => node.id));
    const byId = new Map(volume.nodes.map((node) => [node.id, node]));
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    for (const [a, b] of volume.edges) {
      if (!visibleIds.has(a) || !visibleIds.has(b)) continue;
      const from = byId.get(a);
      const to = byId.get(b);
      if (!from || !to) continue;
      const left = projectPoint(from, yaw, pitch, zoom);
      const right = projectPoint(to, yaw, pitch, zoom);
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
    }
    ctx.stroke();
    const drawn = visible
      .map((node) => ({ node, at: projectPoint(node, yaw, pitch, zoom) }))
      .sort((a, b) => b.at.depth - a.at.depth);
    for (const { node, at } of drawn) {
      ctx.beginPath();
      ctx.fillStyle = node.name === picked ? "#ffffff" : COLOR[node.part];
      ctx.globalAlpha = node.name ? 1 : 0.75;
      ctx.arc(at.x, at.y, node.name ? 2.4 : 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [visible, volume, yaw, pitch, zoom, picked]);

  return (
    <section>
      <h3 className="font-display text-2xl">The volume</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Drag to turn it. The wheel zooms. The fourth axis is growth. Every point is named. Cyan is a region, violet is the chorus, gold is a law, pink is a tone, green is a step she can run, and the inner points are memory. It is not a scanned body and it is not a hidden box.
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
        onClick={(event) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const x = event.clientX - rect.left - rect.width / 2;
          const y = event.clientY - rect.top - rect.height / 2;
          let best = "";
          let bestDistance = 18;
          for (const node of visible) {
            if (!node.name) continue;
            const at = projectPoint(node, yaw, pitch, zoom);
            const distance = Math.hypot(at.x - x, at.y - y);
            if (distance < bestDistance) {
              bestDistance = distance;
              best = node.name;
            }
          }
          if (best) setPicked(best);
        }}
      >
        <canvas ref={canvasRef} className="h-96 w-full" aria-label="Tessera brain volume" />
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
        {picked}. {visible.length} of {volume.nodes.length} named points. {volume.edges.length} links. The sample perceptron sums to {unit.sum} and {unit.fired ? "fires" : "stays quiet"}.
      </p>
    </section>
  );
}
