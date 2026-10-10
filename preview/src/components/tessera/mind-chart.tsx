import { useEffect, useRef, useState } from "react";
import { hitNode, LESSON_SPOTS, liveCount, liveEdges, liveNodes } from "@/lib/tessera/live-map";
import { lessonAt, stepLearn } from "@/lib/tessera/recursive-train";
import { synapseSteps } from "@/lib/tessera/recursive-proof";

const BOARD = liveNodes();
const BY_ID = new Map(BOARD.map((node) => [node.id, node]));

function curve(x1: number, y1: number, x2: number, y2: number) {
  const bend = x1 === x2 ? 0 : x1 < x2 ? -28 : 28;
  return `M ${x1} ${y1} Q ${(x1 + x2) / 2 + bend} ${(y1 + y2) / 2} ${x2} ${y2}`;
}

export function MindChart() {
  const [shown, setShown] = useState(1);
  const [step, setStep] = useState(0);
  const [hop, setHop] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [picked, setPicked] = useState("role");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const learn = stepLearn(step);
  const hops = synapseSteps();
  const synapses = hops[Math.min(hop, hops.length - 1)] ?? [];
  const visible = BOARD.slice(0, shown);
  const lessons = LESSON_SPOTS.slice(0, step);
  const count = liveCount(visible);

  useEffect(() => {
    if (shown < BOARD.length) {
      const timer = window.setTimeout(() => setShown((value) => value + 1), 650);
      return () => window.clearTimeout(timer);
    }
    if (step < learn.total) {
      const timer = window.setTimeout(() => setStep((value) => value + 1), 650);
      return () => window.clearTimeout(timer);
    }
    if (hop < hops.length) {
      const timer = window.setTimeout(() => setHop((value) => value + 1), 650);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [shown, step, learn.total, hop, hops.length]);

  function point(event: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = ((event.clientX - rect.left) / rect.width) * 360;
    const y = ((event.clientY - rect.top) / rect.height) * 600;
    return { x: (x - pan.x) / zoom, y: (y - pan.y) / zoom };
  }

  const boardEdges = liveEdges().filter(([from, to]) => visible.some((node) => node.id === from) && visible.some((node) => node.id === to));
  const selected = BY_ID.get(picked);
  const lessonIndex = LESSON_SPOTS.findIndex((spot) => spot.id === picked);
  const selectedText = selected?.detail ?? (lessonIndex >= 0 ? lessonAt(lessonIndex) : "Tap a node.");

  return (
    <div className="px-3 pt-2 pb-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.22em] text-accent uppercase">Brain</p>
          <h2 className="font-display text-3xl tracking-tight">One chart</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className="h-11 w-11 rounded-full border border-border text-lg" onClick={() => setZoom((value) => Math.max(0.7, value - 0.2))} aria-label="Zoom out">
            −
          </button>
          <button type="button" className="h-11 w-11 rounded-full border border-border text-lg" onClick={() => setZoom((value) => Math.min(2.4, value + 0.2))} aria-label="Zoom in">
            +
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 360 600"
        className="mt-2 w-full touch-none"
        role="img"
        aria-label="Drag to move. Tap a node to read it."
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (Math.hypot(dx, dy) > 6) current.moved = true;
          if (current.moved) {
            const rect = svgRef.current?.getBoundingClientRect();
            const sx = rect ? 360 / rect.width : 1;
            const sy = rect ? 600 / rect.height : 1;
            setPan({ x: current.panX + dx * sx, y: current.panY + dy * sy });
          }
        }}
        onPointerUp={(event) => {
          const current = drag.current;
          drag.current = null;
          if (!current || current.moved) return;
          const at = point(event);
          const id = hitNode(at.x, at.y, [...visible, ...lessons]);
          if (id) setPicked(id);
        }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {boardEdges.map(([from, to]) => {
            const a = BY_ID.get(from);
            const b = BY_ID.get(to);
            if (!a || !b) return null;
            const hot = picked === from || picked === to;
            return <path key={`${from}-${to}`} d={curve(a.x, a.y, b.x, b.y)} fill="none" stroke="currentColor" className={hot ? "text-accent" : "text-accent/50"} strokeWidth={hot ? 2 : 1.2} />;
          })}
          {learn.links.map((link, index) => {
            const a = LESSON_SPOTS[index];
            const b = LESSON_SPOTS[index + 1];
            if (!a || !b) return null;
            return <path key={link.to} d={curve(a.x, a.y, b.x, b.y)} fill="none" stroke="currentColor" className="text-accent" strokeWidth="1.4" />;
          })}
          {step > 0 ? <path d={curve(180, 36, LESSON_SPOTS[0].x, LESSON_SPOTS[0].y)} fill="none" stroke="currentColor" className="text-accent/40" strokeWidth="1" /> : null}
          {visible.map((node) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={picked === node.id ? 10 : node.known ? 6 : 5} fill={node.known ? "currentColor" : "none"} stroke="currentColor" className="text-accent" strokeWidth="1.5" />
              <text x={node.x} y={node.y + 18} textAnchor="middle" className="fill-accent" fontSize="9">
                {node.label}
              </text>
            </g>
          ))}
          {lessons.map((spot) => (
            <g key={spot.id}>
              <circle cx={spot.x} cy={spot.y} r={picked === spot.id ? 9 : 5} fill="currentColor" className="text-accent" />
              <text x={spot.x} y={spot.y + 16} textAnchor="middle" className="fill-accent" fontSize="9">
                {spot.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <p className="text-sm text-fg">{selectedText}</p>
      <p className="mt-1 text-sm text-muted">
        {count.known} known. {count.missing} still open. Recalled {learn.recalled} of {learn.total}.{" "}
        {synapses.map((link) => `${link.from} → ${link.to} ${link.weight.toFixed(2)}`).join(". ")}.
        {hop >= hops.length ? " A miss did not move the first synapse." : " The synapse is still learning."} Drag the chart. Tap a node.
      </p>
    </div>
  );
}
