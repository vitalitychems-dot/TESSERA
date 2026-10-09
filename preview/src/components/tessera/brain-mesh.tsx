import { useMemo, useState } from "react";
import { AGENTS } from "@/lib/tessera/identity";
import { brainMesh, perceptron } from "@/lib/tessera/perceptron";

const STEPS = ["reward", "leak", "reset", "warmup", "sequence", "selector"];

export function BrainMesh() {
  const mesh = useMemo(() => brainMesh([...AGENTS.map((agent) => agent.name), ...STEPS]), []);
  const [picked, setPicked] = useState(AGENTS[0]?.name ?? "Tessera");
  const unit = perceptron([1, 1], [0.6, 0.6], 1);
  const byId = new Map(mesh.nodes.map((node) => [node.id, node]));

  return (
    <section>
      <h3 className="font-display text-2xl">The mesh</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        A perceptron fires when the weighted sum crosses the threshold. This one sums to {unit.sum} and {unit.fired ? "fires" : "stays quiet"}. The points are her named regions and the steps she can run. A line is a link. It is not a hidden box.
      </p>
      <div className="mt-3 overflow-hidden rounded-2xl bg-black">
        <svg viewBox="0 0 100 100" className="h-80 w-full" role="img" aria-label="Tessera brain mesh">
          {mesh.edges.map(([a, b]) => {
            const from = byId.get(a);
            const to = byId.get(b);
            if (!from || !to) return null;
            return <line key={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(255,255,255,0.28)" strokeWidth="0.2" />;
          })}
          {mesh.nodes.map((node) => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={node.name ? 1.15 : 0.45}
              fill={node.name === picked ? "#7FDBFF" : node.name ? "#d6f4ff" : "#ffffff"}
              onClick={() => node.name && setPicked(node.name)}
            >
              {node.name ? <title>{node.name}</title> : null}
            </circle>
          ))}
        </svg>
      </div>
      <p className="mt-2 text-sm text-fg">{picked}. {mesh.nodes.length} points. {mesh.edges.length} links. {mesh.named} are named.</p>
    </section>
  );
}
