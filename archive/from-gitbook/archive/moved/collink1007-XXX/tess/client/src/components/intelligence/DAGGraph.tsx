import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

interface DAGNode {
  id: string;
  label: string;
  description: string;
  dependencies: string[];
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

interface Props {
  nodes: DAGNode[];
  parallelBatches: string[][];
}

const STATUS_FILL: Record<string, string> = {
  pending: "#374151",
  running: "#92400e",
  complete: "#065f46",
  failed: "#7f1d1d",
  skipped: "#1f2937",
};

const STATUS_STROKE: Record<string, string> = {
  pending: "#6b7280",
  running: "#f59e0b",
  complete: "#10b981",
  failed: "#ef4444",
  skipped: "#4b5563",
};

const STATUS_TEXT: Record<string, string> = {
  pending: "#9ca3af",
  running: "#fbbf24",
  complete: "#34d399",
  failed: "#f87171",
  skipped: "#6b7280",
};

function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  if (status === "complete") return <CheckCircle size={size} className="text-emerald-400" />;
  if (status === "failed") return <XCircle size={size} className="text-red-400" />;
  if (status === "running") return <Loader2 size={size} className="text-amber-400 animate-spin" />;
  return <Clock size={size} className="text-gray-500" />;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 54;
const BATCH_GAP_X = 220;
const NODE_GAP_Y = 72;
const PADDING_X = 32;
const PADDING_Y = 40;

interface LayoutNode {
  node: DAGNode;
  x: number;
  y: number;
  batchIndex: number;
}

function computeLayout(nodes: DAGNode[], batches: string[][]): LayoutNode[] {
  const layout: LayoutNode[] = [];
  batches.forEach((batch, batchIdx) => {
    const batchHeight = batch.length * NODE_GAP_Y - (NODE_GAP_Y - NODE_HEIGHT);
    batch.forEach((nodeId, posInBatch) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      layout.push({
        node,
        x: PADDING_X + batchIdx * BATCH_GAP_X,
        y: PADDING_Y + posInBatch * NODE_GAP_Y,
        batchIndex: batchIdx,
      });
    });
  });
  return layout;
}

function getCenter(ln: LayoutNode) {
  return { cx: ln.x + NODE_WIDTH / 2, cy: ln.y + NODE_HEIGHT / 2 };
}

export function DAGGraph({ nodes, parallelBatches }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const layout = computeLayout(nodes, parallelBatches);
  const totalBatches = parallelBatches.length;
  const maxNodesInBatch = Math.max(...parallelBatches.map(b => b.length), 1);
  const svgWidth = PADDING_X * 2 + totalBatches * BATCH_GAP_X;
  const svgHeight = PADDING_Y * 2 + maxNodesInBatch * NODE_GAP_Y;

  const layoutMap = new Map<string, LayoutNode>(layout.map(ln => [ln.node.id, ln]));

  const edges: Array<{ from: LayoutNode; to: LayoutNode }> = [];
  layout.forEach(ln => {
    ln.node.dependencies.forEach(depId => {
      const depLn = layoutMap.get(depId);
      if (depLn) edges.push({ from: depLn, to: ln });
    });
  });

  const selectedNode = selected ? nodes.find(n => n.id === selected) : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/60 p-2">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          className="min-w-0"
          style={{ minWidth: svgWidth }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
            </marker>
            {Object.entries(STATUS_STROKE).map(([status, color]) => (
              <marker
                key={status}
                id={`arrow-${status}`}
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill={color} opacity="0.6" />
              </marker>
            ))}
          </defs>

          {edges.map((edge, i) => {
            const fc = getCenter(edge.from);
            const tc = getCenter(edge.to);
            const midX = (fc.cx + NODE_WIDTH / 2 + tc.cx - NODE_WIDTH / 2) / 2;
            const d = `M ${fc.cx + NODE_WIDTH / 2} ${fc.cy} C ${midX} ${fc.cy}, ${midX} ${tc.cy}, ${tc.cx - NODE_WIDTH / 2} ${tc.cy}`;
            const toStatus = edge.to.node.status;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={STATUS_STROKE[toStatus] || "#4b5563"}
                strokeWidth={toStatus === "running" ? 2 : 1.5}
                strokeOpacity={0.6}
                markerEnd={`url(#arrow-${toStatus})`}
                strokeDasharray={toStatus === "pending" ? "4 3" : undefined}
              />
            );
          })}

          {layout.map(ln => {
            const isSelected = selected === ln.node.id;
            const status = ln.node.status;
            const fill = STATUS_FILL[status] || STATUS_FILL.pending;
            const stroke = STATUS_STROKE[status] || STATUS_STROKE.pending;
            const textColor = STATUS_TEXT[status] || STATUS_TEXT.pending;

            return (
              <g
                key={ln.node.id}
                transform={`translate(${ln.x}, ${ln.y})`}
                className="cursor-pointer"
                onClick={() => setSelected(isSelected ? null : ln.node.id)}
              >
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={fill}
                  stroke={isSelected ? "#8b5cf6" : stroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                  opacity={0.95}
                />
                {status === "running" && (
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={8}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1}
                    opacity={0.3}
                    className="animate-pulse"
                  />
                )}
                <text
                  x={8}
                  y={19}
                  fill={textColor}
                  fontSize={11}
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {ln.node.label.length > 20 ? ln.node.label.slice(0, 19) + "…" : ln.node.label}
                </text>
                <text
                  x={8}
                  y={33}
                  fill={textColor}
                  fontSize={9}
                  opacity={0.7}
                  fontFamily="system-ui, sans-serif"
                >
                  {ln.node.description.length > 30 ? ln.node.description.slice(0, 29) + "…" : ln.node.description}
                </text>
                <text
                  x={8}
                  y={47}
                  fill={textColor}
                  fontSize={9}
                  fontWeight="500"
                  fontFamily="monospace, monospace"
                  opacity={0.8}
                >
                  B{ln.batchIndex + 1} · {status}
                </text>

                {status === "complete" && (
                  <circle cx={NODE_WIDTH - 12} cy={12} r={5} fill="#065f46" stroke="#10b981" strokeWidth={1} />
                )}
                {status === "failed" && (
                  <circle cx={NODE_WIDTH - 12} cy={12} r={5} fill="#7f1d1d" stroke="#ef4444" strokeWidth={1} />
                )}
                {status === "running" && (
                  <circle cx={NODE_WIDTH - 12} cy={12} r={5} fill="#92400e" stroke="#f59e0b" strokeWidth={1} className="animate-pulse" />
                )}
              </g>
            );
          })}

          {parallelBatches.length > 1 && parallelBatches.map((_, i) => (
            <text
              key={i}
              x={PADDING_X + i * BATCH_GAP_X + NODE_WIDTH / 2}
              y={PADDING_Y - 16}
              textAnchor="middle"
              fill="#4b5563"
              fontSize={10}
              fontFamily="monospace"
            >
              Batch {i + 1}
            </text>
          ))}
        </svg>
      </div>

      {selectedNode && (
        <div className={cn(
          "rounded-lg border p-3 text-xs space-y-2 transition-all",
          selectedNode.status === "complete" ? "bg-emerald-950/20 border-emerald-500/30" :
          selectedNode.status === "failed" ? "bg-red-950/20 border-red-500/30" :
          selectedNode.status === "running" ? "bg-amber-950/20 border-amber-500/30" :
          "bg-gray-900/60 border-gray-700"
        )}>
          <div className="flex items-center gap-2">
            <StatusIcon status={selectedNode.status} />
            <span className="font-semibold">{selectedNode.label}</span>
            <span className="opacity-50 font-mono">#{selectedNode.id}</span>
          </div>
          <p className="opacity-70 leading-relaxed">{selectedNode.description}</p>
          {selectedNode.dependencies.length > 0 && (
            <p className="opacity-50">Depends on: {selectedNode.dependencies.join(", ")}</p>
          )}
          {selectedNode.result && (
            <div className="mt-2 p-2 bg-emerald-950/30 rounded border border-emerald-500/20">
              <p className="text-emerald-300 font-medium mb-1">Result</p>
              <p className="text-emerald-200/80 leading-relaxed">{selectedNode.result}</p>
            </div>
          )}
          {selectedNode.error && (
            <div className="mt-2 p-2 bg-red-950/30 rounded border border-red-500/20">
              <p className="text-red-300">Error: {selectedNode.error}</p>
            </div>
          )}
          {selectedNode.startedAt && (
            <p className="opacity-40">
              Started: {new Date(selectedNode.startedAt).toLocaleTimeString()}
              {selectedNode.completedAt && ` · Duration: ${((selectedNode.completedAt - selectedNode.startedAt) / 1000).toFixed(1)}s`}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(["pending", "running", "complete", "failed"] as const).map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: STATUS_FILL[s], border: `1.5px solid ${STATUS_STROKE[s]}` }}
            />
            {s}
          </span>
        ))}
        <span className="ml-auto opacity-60">Click a node to expand</span>
      </div>
    </div>
  );
}
