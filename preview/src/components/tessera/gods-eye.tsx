import { useState } from "react";
import type { KeptLine } from "@/lib/tessera/eye";
import { redSparrow } from "@/lib/tessera/eye";

/** Every kept line, in one view. Pan is the drag. It is her book, not a map of people. */

export function GodsEye({ rows, onClose }: { rows: readonly KeptLine[]; onClose?: () => void }) {
  const eye = redSparrow(rows);
  const [picked, setPicked] = useState(rows[0]?.key ?? "");
  const [zoom, setZoom] = useState(1);
  const chosen = rows.find((row) => row.key === picked) ?? rows[0];
  const nodes = rows.map((row, index) => {
    const turn = index * 0.42;
    const ring = 18 + (index / Math.max(1, rows.length)) * 150;
    return { ...row, x: 200 + Math.cos(turn) * ring, y: 210 + Math.sin(turn) * ring * 0.72 };
  });
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg text-fg">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <div>
          <p className="text-[10px] tracking-[0.18em] text-accent uppercase">Chamber eye</p>
          <p className="text-sm text-fg">{eye.seen} lines · {eye.facet} · {eye.signature}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" className="h-11 w-11 border border-border text-lg" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>−</button>
          <button type="button" className="h-11 w-11 border border-border text-lg" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2.4, value + 0.2))}>+</button>
          {onClose ? <button type="button" className="h-11 border border-border px-3 text-sm" onClick={onClose}>Close</button> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <svg viewBox="0 0 400 420" className="h-full w-full" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
          {nodes.slice(1).map((node, index) => {
            const from = nodes[Math.max(0, index - 6)];
            return <line key={`${node.key}-edge`} x1={from?.x ?? 200} y1={from?.y ?? 210} x2={node.x} y2={node.y} className="text-accent" stroke="currentColor" strokeWidth="0.4" opacity="0.45" />;
          })}
          {nodes.map((node) => (
            <circle key={node.key} cx={node.x} cy={node.y} r={node.key === chosen?.key ? 3.2 : 1.5} className="fill-accent" onClick={() => setPicked(node.key)} />
          ))}
        </svg>
      </div>
      <p className="shrink-0 border-t border-border px-4 py-3 text-sm leading-relaxed text-fg">{chosen ? `${chosen.kind}. ${chosen.line}` : "Nothing kept."}</p>
    </div>
  );
}
