import { useEffect, useState } from "react";
import { LESSON_SPOTS, liveCount, liveEdges, liveNodes } from "@/lib/tessera/live-map";
import { stepLearn } from "@/lib/tessera/recursive-train";

const BOARD = liveNodes();
const BY_ID = new Map(BOARD.map((node) => [node.id, node]));

function curve(x1: number, y1: number, x2: number, y2: number) {
  const bend = x1 === x2 ? 0 : (x1 < x2 ? -28 : 28);
  return `M ${x1} ${y1} Q ${(x1 + x2) / 2 + bend} ${(y1 + y2) / 2} ${x2} ${y2}`;
}

export function MindChart() {
  const [shown, setShown] = useState(1);
  const [step, setStep] = useState(0);
  const learn = stepLearn(step);
  const visible = BOARD.slice(0, shown);
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
    return undefined;
  }, [shown, step, learn.total]);

  const boardEdges = liveEdges().filter(([from, to]) => visible.some((node) => node.id === from) && visible.some((node) => node.id === to));

  return (
    <div className="px-3 pt-2 pb-8">
      <p className="text-[10px] tracking-[0.22em] text-accent uppercase">Brain</p>
      <h2 className="font-display text-3xl tracking-tight">One chart</h2>
      <svg viewBox="0 0 360 600" className="mt-2 w-full" role="img" aria-label="Facts and the links between kept lines">
        {boardEdges.map(([from, to]) => {
          const a = BY_ID.get(from);
          const b = BY_ID.get(to);
          if (!a || !b) return null;
          return <path key={`${from}-${to}`} d={curve(a.x, a.y, b.x, b.y)} fill="none" stroke="currentColor" className="text-accent/70" strokeWidth="1.2" />;
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
            <circle cx={node.x} cy={node.y} r={node.known ? 6 : 5} fill={node.known ? "currentColor" : "none"} stroke="currentColor" className="text-accent" strokeWidth="1.5" />
            <text x={node.x} y={node.y + 18} textAnchor="middle" className="fill-accent" fontSize="9">
              {node.label}
            </text>
            <text x={node.x} y={node.y + 30} textAnchor="middle" className="fill-current text-fg" fontSize="8">
              {node.detail}
            </text>
          </g>
        ))}
        {LESSON_SPOTS.slice(0, step).map((spot) => (
          <g key={spot.id}>
            <circle cx={spot.x} cy={spot.y} r="5" fill="currentColor" className="text-accent" />
            <text x={spot.x} y={spot.y + 16} textAnchor="middle" className="fill-accent" fontSize="9">
              {spot.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-sm text-muted">
        {count.known} known on the chart. {count.missing} still open. Recalled {learn.recalled} of {learn.total}. Links {learn.links.length}.
        {step >= learn.total && shown >= BOARD.length ? " A further step adds no link." : " Growing."}
      </p>
    </div>
  );
}
