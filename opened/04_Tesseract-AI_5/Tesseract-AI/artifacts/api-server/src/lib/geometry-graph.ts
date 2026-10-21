import { db } from "@workspace/db";
import { geometry_routes } from "@workspace/db";

const LOG_PREFIX = "[GeometryGraph]";

export type NodeType = "agent" | "provider" | "tool" | "knowledge" | "gateway";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  load: number;
  maxLoad: number;
  latencyMs: number;
  reliability: number;
  x?: number;
  y?: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  latencyMs: number;
  bandwidth: number;
  reliability: number;
  bidirectional: boolean;
  metadata: Record<string, unknown>;
}

export interface PathResult {
  path: string[];
  totalWeight: number;
  totalLatencyMs: number;
  estimatedReliability: number;
  hops: number;
}

export interface GraphExport {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    avgLatencyMs: number;
    avgReliability: number;
  };
  timestamp: number;
}

const nodes: Map<string, GraphNode> = new Map();
const edges: Map<string, GraphEdge> = new Map();
let graphCycleCount = 0;

function generateEdgeId(from: string, to: string): string {
  return `${from}->${to}`;
}

export class GeometryGraph {
  addNode(node: GraphNode): void {
    nodes.set(node.id, { ...node });
  }

  addEdge(edge: GraphEdge): void {
    const id = edge.id || generateEdgeId(edge.from, edge.to);
    edges.set(id, { ...edge, id });
    if (edge.bidirectional) {
      const reverseId = generateEdgeId(edge.to, edge.from);
      edges.set(reverseId, { ...edge, id: reverseId, from: edge.to, to: edge.from });
    }
  }

  removeNode(nodeId: string): void {
    nodes.delete(nodeId);
    for (const [edgeId, edge] of edges.entries()) {
      if (edge.from === nodeId || edge.to === nodeId) {
        edges.delete(edgeId);
      }
    }
  }

  getNode(id: string): GraphNode | undefined {
    return nodes.get(id);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(nodes.values());
  }

  getAllEdges(): GraphEdge[] {
    return Array.from(edges.values());
  }

  getNeighbors(nodeId: string): Array<{ node: GraphNode; edge: GraphEdge }> {
    const neighbors: Array<{ node: GraphNode; edge: GraphEdge }> = [];
    for (const edge of edges.values()) {
      if (edge.from === nodeId) {
        const target = nodes.get(edge.to);
        if (target) neighbors.push({ node: target, edge });
      }
    }
    return neighbors;
  }

  shortestPath(fromId: string, toId: string, metric: "latency" | "weight" | "reliability" = "latency"): PathResult | null {
    if (!nodes.has(fromId) || !nodes.has(toId)) return null;
    if (fromId === toId) return { path: [fromId], totalWeight: 0, totalLatencyMs: 0, estimatedReliability: 1.0, hops: 0 };

    const dist: Map<string, number> = new Map();
    const prev: Map<string, string | null> = new Map();
    const visited: Set<string> = new Set();

    for (const nodeId of nodes.keys()) {
      dist.set(nodeId, Infinity);
      prev.set(nodeId, null);
    }
    dist.set(fromId, 0);

    while (true) {
      let current: string | null = null;
      let minDist = Infinity;
      for (const [nodeId, d] of dist.entries()) {
        if (!visited.has(nodeId) && d < minDist) {
          minDist = d;
          current = nodeId;
        }
      }

      if (!current || current === toId || minDist === Infinity) break;
      visited.add(current);

      const neighbors = this.getNeighbors(current);
      for (const { node, edge } of neighbors) {
        if (visited.has(node.id)) continue;

        let edgeCost: number;
        if (metric === "latency") edgeCost = edge.latencyMs + node.latencyMs;
        else if (metric === "reliability") edgeCost = 1 - edge.reliability * node.reliability;
        else edgeCost = edge.weight;

        const loadPenalty = node.load / node.maxLoad;
        edgeCost += loadPenalty * 10;

        const newDist = (dist.get(current) ?? Infinity) + edgeCost;
        if (newDist < (dist.get(node.id) ?? Infinity)) {
          dist.set(node.id, newDist);
          prev.set(node.id, current);
        }
      }
    }

    if ((dist.get(toId) ?? Infinity) === Infinity) return null;

    const path: string[] = [];
    let cur: string | null = toId;
    while (cur !== null) {
      path.unshift(cur);
      cur = prev.get(cur) ?? null;
    }

    let totalLatencyMs = 0;
    let totalWeight = 0;
    let estimatedReliability = 1.0;

    for (let i = 0; i < path.length - 1; i++) {
      const edgeId = generateEdgeId(path[i]!, path[i + 1]!);
      const edge = edges.get(edgeId);
      if (edge) {
        totalLatencyMs += edge.latencyMs;
        totalWeight += edge.weight;
        estimatedReliability *= edge.reliability;
      }
    }

    return { path, totalWeight, totalLatencyMs, estimatedReliability, hops: path.length - 1 };
  }

  loadBalancedPath(fromId: string, toId: string, candidates: number = 3): PathResult | null {
    const metrics: Array<"latency" | "weight" | "reliability"> = ["latency", "weight", "reliability"];
    const paths: PathResult[] = [];

    for (const metric of metrics.slice(0, candidates)) {
      const p = this.shortestPath(fromId, toId, metric);
      if (p) paths.push(p);
    }

    if (paths.length === 0) return null;

    paths.sort((a, b) => {
      const scoreA = a.estimatedReliability * 100 - a.totalLatencyMs / 10;
      const scoreB = b.estimatedReliability * 100 - b.totalLatencyMs / 10;
      return scoreB - scoreA;
    });

    return paths[0] ?? null;
  }

  computeStats() {
    const nodeCount = nodes.size;
    const edgeCount = edges.size;
    const avgDegree = nodeCount > 0 ? edgeCount / nodeCount : 0;
    const allEdges = this.getAllEdges();
    const avgLatencyMs = allEdges.length > 0 ? allEdges.reduce((s, e) => s + e.latencyMs, 0) / allEdges.length : 0;
    const avgReliability = allEdges.length > 0 ? allEdges.reduce((s, e) => s + e.reliability, 0) / allEdges.length : 0;
    return { nodeCount, edgeCount, avgDegree, avgLatencyMs, avgReliability };
  }

  exportJSON(): GraphExport {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
      stats: this.computeStats(),
      timestamp: Date.now(),
    };
  }

  async persistToDatabase(): Promise<void> {
    graphCycleCount++;
    const stats = this.computeStats();
    const routeId = `geometry-graph-${Date.now().toString(36)}`;

    try {
      await db.insert(geometry_routes).values({
        routeId,
        routeName: `Sovereign Graph v${graphCycleCount}`,
        topology: "graph",
        sourceNodes: this.getAllNodes().filter(n => n.type === "gateway").map(n => n.id) as string[],
        targetNodes: this.getAllNodes().filter(n => n.type === "agent").map(n => n.id) as string[],
        pathOptimization: "balanced",
        avgLatencyMs: stats.avgLatencyMs,
        loadBalance: 1 - (stats.avgLatencyMs / 1000),
        geometryType: "dijkstra-graph",
        spatialConfig: { nodeCount: stats.nodeCount, edgeCount: stats.edgeCount, avgDegree: stats.avgDegree } as Record<string, unknown>,
        isActive: true,
      }).onConflictDoNothing();
      console.log(`${LOG_PREFIX} Persisted graph: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Persist failed:`, err?.message);
    }
  }
}

export const sovereignGraph = new GeometryGraph();

function seedDefaultGraph(): void {
  const defaultNodes: GraphNode[] = [
    { id: "gateway-main", type: "gateway", label: "Main Gateway", load: 20, maxLoad: 100, latencyMs: 5, reliability: 0.99, x: 50, y: 50, metadata: {} },
    { id: "agent-tessera", type: "agent", label: "Tessera Core", load: 30, maxLoad: 100, latencyMs: 10, reliability: 0.98, x: 30, y: 30, metadata: {} },
    { id: "agent-swarm", type: "agent", label: "Swarm Coordinator", load: 40, maxLoad: 100, latencyMs: 15, reliability: 0.97, x: 70, y: 30, metadata: {} },
    { id: "agent-meta", type: "agent", label: "Meta Agent", load: 25, maxLoad: 100, latencyMs: 12, reliability: 0.97, x: 50, y: 20, metadata: {} },
    { id: "provider-openai", type: "provider", label: "OpenAI (External)", load: 0, maxLoad: 100, latencyMs: 500, reliability: 0.92, x: 20, y: 70, metadata: { external: true } },
    { id: "provider-ollama", type: "provider", label: "Ollama (Local)", load: 10, maxLoad: 100, latencyMs: 200, reliability: 0.85, x: 80, y: 70, metadata: { local: true } },
    { id: "tool-rag", type: "tool", label: "RAG Pipeline", load: 35, maxLoad: 100, latencyMs: 50, reliability: 0.96, x: 50, y: 80, metadata: {} },
    { id: "knowledge-kb", type: "knowledge", label: "Knowledge Base", load: 20, maxLoad: 100, latencyMs: 20, reliability: 0.99, x: 50, y: 60, metadata: {} },
  ];

  const defaultEdges: GraphEdge[] = [
    { id: "gw->ts", from: "gateway-main", to: "agent-tessera", weight: 1, latencyMs: 5, bandwidth: 1000, reliability: 0.99, bidirectional: true, metadata: {} },
    { id: "gw->sw", from: "gateway-main", to: "agent-swarm", weight: 1, latencyMs: 5, bandwidth: 1000, reliability: 0.98, bidirectional: true, metadata: {} },
    { id: "gw->meta", from: "gateway-main", to: "agent-meta", weight: 1, latencyMs: 5, bandwidth: 1000, reliability: 0.98, bidirectional: true, metadata: {} },
    { id: "ts->rag", from: "agent-tessera", to: "tool-rag", weight: 2, latencyMs: 20, bandwidth: 500, reliability: 0.97, bidirectional: true, metadata: {} },
    { id: "ts->kb", from: "agent-tessera", to: "knowledge-kb", weight: 1, latencyMs: 10, bandwidth: 800, reliability: 0.99, bidirectional: true, metadata: {} },
    { id: "ts->oai", from: "agent-tessera", to: "provider-openai", weight: 5, latencyMs: 500, bandwidth: 100, reliability: 0.92, bidirectional: false, metadata: { external: true } },
    { id: "ts->oll", from: "agent-tessera", to: "provider-ollama", weight: 3, latencyMs: 200, bandwidth: 200, reliability: 0.85, bidirectional: false, metadata: { local: true } },
    { id: "sw->meta", from: "agent-swarm", to: "agent-meta", weight: 1, latencyMs: 8, bandwidth: 600, reliability: 0.98, bidirectional: true, metadata: {} },
    { id: "sw->kb", from: "agent-swarm", to: "knowledge-kb", weight: 1, latencyMs: 10, bandwidth: 800, reliability: 0.99, bidirectional: true, metadata: {} },
    { id: "rag->kb", from: "tool-rag", to: "knowledge-kb", weight: 1, latencyMs: 15, bandwidth: 700, reliability: 0.98, bidirectional: true, metadata: {} },
  ];

  for (const node of defaultNodes) sovereignGraph.addNode(node);
  for (const edge of defaultEdges) sovereignGraph.addEdge(edge);

  console.log(`${LOG_PREFIX} Default graph seeded: ${defaultNodes.length} nodes, ${defaultEdges.length} edges`);
}

export async function initializeGeometryGraph(): Promise<void> {
  seedDefaultGraph();
  await sovereignGraph.persistToDatabase().catch(err =>
    console.error(`${LOG_PREFIX} Initial persist failed:`, err?.message)
  );
}

export function getGeometryGraphStatus() {
  const stats = sovereignGraph.computeStats();
  const path = sovereignGraph.shortestPath("gateway-main", "tool-rag");
  return {
    ...stats,
    graphCycleCount,
    samplePath: path,
    exportAvailable: true,
  };
}
