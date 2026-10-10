import { useEffect, useState } from "react";
import { liveCount, liveNodes } from "@/lib/tessera/live-map";
import { SynapseLive } from "./synapse-live";

const NODES = liveNodes();

export function LiveView() {
  const [shown, setShown] = useState(1);
  const count = liveCount(NODES.slice(0, shown));

  useEffect(() => {
    if (shown >= NODES.length) return;
    const timer = window.setTimeout(() => setShown((value) => value + 1), 700);
    return () => window.clearTimeout(timer);
  }, [shown]);

  const visible = NODES.slice(0, shown);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg px-4 pt-2 pb-6">
      <p className="text-[10px] tracking-[0.22em] text-accent uppercase">Live</p>
      <h2 className="font-display text-3xl tracking-tight">What she is doing</h2>
      <p className="mt-1 text-sm text-muted">Each node is a fact already checked. A hollow node is still open.</p>
      <div className="relative mt-4 min-h-[70vh] flex-1">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {visible.slice(1).map((node, index) => {
            const prior = visible[index];
            return (
              <line
                key={`${prior.id}-${node.id}`}
                x1={prior.x}
                y1={prior.y}
                x2={node.x}
                y2={node.y}
                stroke="currentColor"
                className="text-accent/50"
                strokeWidth="0.4"
              />
            );
          })}
        </svg>
        {visible.map((node, index) => (
          <div
            key={node.id}
            className="absolute w-36 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <div className={index === visible.length - 1 ? "rounded-2xl border border-accent bg-bg px-3 py-2 shadow-[0_0_24px_color-mix(in_oklab,var(--accent)_40%,transparent)]" : "rounded-2xl border border-border bg-bg/90 px-3 py-2"}>
              <div className="flex items-center gap-2">
                <span className={node.known ? "size-2 shrink-0 rounded-full bg-accent" : "size-2 shrink-0 rounded-full border border-accent"} />
                <p className="text-[10px] tracking-[0.16em] text-accent uppercase">{node.label}</p>
              </div>
              <p className="mt-1 text-xs leading-snug text-fg">{node.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        {count.known} known. {count.missing} still open. {shown < NODES.length ? "Growing." : "That is the whole map."}
      </p>
      <SynapseLive />
    </div>
  );
}
