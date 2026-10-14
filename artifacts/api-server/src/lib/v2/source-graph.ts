// Tessera Source Graph — tailored from Flowsint's graph-exploration idea,
// pointed inward: which repos, files, and lessons feed which capabilities.
// Local data structure only; no external service, no code copied from
// Flowsint (Apache-2.0 pattern-level reuse).

export interface SourceNode {
  id: string;                                   // e.g. "repo:TESSERA", "file:src/lib/memory"
  kind: "repo" | "file" | "module" | "lesson" | "capability";
  label: string;
}

export type EdgeKind = "contains" | "feeds" | "derived-from" | "documents";

export interface SourceEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export class SourceGraph {
  private nodes = new Map<string, SourceNode>();
  private outgoing = new Map<string, SourceEdge[]>();
  private incoming = new Map<string, SourceEdge[]>();

  addNode(node: SourceNode): void {
    if (!node.id.trim()) throw new Error("node id required");
    this.nodes.set(node.id, node);
  }

  addEdge(edge: SourceEdge): void {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`edge ${edge.from} -> ${edge.to} references an unknown node`);
    }
    if (this.reaches(edge.to, edge.from)) {
      throw new Error(`edge ${edge.from} -> ${edge.to} would create a provenance cycle`);
    }
    (this.outgoing.get(edge.from) ?? this.outgoing.set(edge.from, []).get(edge.from)!).push(edge);
    (this.incoming.get(edge.to) ?? this.incoming.set(edge.to, []).get(edge.to)!).push(edge);
  }

  private reaches(start: string, target: string, seen = new Set<string>()): boolean {
    if (start === target) return true;
    if (seen.has(start)) return false;
    seen.add(start);
    return (this.outgoing.get(start) ?? []).some((e) => this.reaches(e.to, target, seen));
  }

  /** Everything that (transitively) feeds a capability or module. */
  provenanceOf(id: string): SourceNode[] {
    if (!this.nodes.has(id)) throw new Error(`unknown node: ${id}`);
    const found = new Map<string, SourceNode>();
    const visit = (current: string) => {
      for (const edge of this.incoming.get(current) ?? []) {
        if (edge.kind !== "feeds" && edge.kind !== "derived-from" && edge.kind !== "contains") continue;
        if (!found.has(edge.from)) {
          found.set(edge.from, this.nodes.get(edge.from)!);
          visit(edge.from);
        }
      }
    };
    visit(id);
    found.delete(id);
    return [...found.values()];
  }

  /** Direct consumers of a node — what breaks if it changes. */
  dependentsOf(id: string): SourceNode[] {
    if (!this.nodes.has(id)) throw new Error(`unknown node: ${id}`);
    return (this.outgoing.get(id) ?? []).map((e) => this.nodes.get(e.to)!);
  }

  stats() {
    return {
      nodes: this.nodes.size,
      edges: [...this.outgoing.values()].reduce((n, list) => n + list.length, 0),
    };
  }
}
