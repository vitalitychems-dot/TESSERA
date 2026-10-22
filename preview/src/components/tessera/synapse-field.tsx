/** Synapses already studied, plus one new edge for each line said in this talk. */

export function SynapseField({ count }: { count: number }) {
  const n = Math.max(0, Math.min(count, 240));
  const nodes = Array.from({ length: Math.min(n, 48) }, (_, index) => {
    const angle = (index / Math.max(1, Math.min(n, 48))) * Math.PI * 2;
    const ring = index % 2 === 0 ? 38 : 24;
    return { x: 60 + Math.cos(angle) * ring, y: 46 + Math.sin(angle) * ring * 0.72 };
  });
  const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index % 7] ?? nodes[0], to: node }));
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] tracking-[0.16em] text-accent uppercase">{n} synapses</p>
      <svg viewBox="0 0 120 92" className="mt-1 h-16 w-full" aria-hidden="true">
        {edges.map((edge, index) => (
          <line key={index} x1={edge.from?.x ?? 60} y1={edge.from?.y ?? 46} x2={edge.to.x} y2={edge.to.y} stroke="currentColor" strokeWidth="0.6" className="text-accent" opacity={0.85} />
        ))}
        {nodes.map((node, index) => (
          <circle key={index} cx={node.x} cy={node.y} r={index === nodes.length - 1 ? 2.2 : 1.3} className="fill-accent" />
        ))}
      </svg>
    </div>
  );
}
