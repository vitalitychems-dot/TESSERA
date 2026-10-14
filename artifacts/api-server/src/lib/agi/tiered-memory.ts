/**
 * Tiered core / recall / archival memory with context budgeting (REA-07).
 *
 * Idea: Letta / MemGPT (Apache-2.0, arXiv:2310.08560). Core memory is a small
 * set of labelled blocks always placed in the prompt and editable by the agent
 * via tool-style functions; overflow pages out to archival storage, which is
 * searched on demand. Implemented from scratch. Prompt-builder wiring into
 * tessera-llm is out of scope for this PR (see PR body).
 */
export interface CoreBlock { label: string; value: string; limit: number }
export interface ArchivalEntry { id: string; text: string; at: number }

export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

export class TieredMemory {
  readonly core = new Map<string, CoreBlock>();
  private archival: ArchivalEntry[] = [];
  private recall: string[] = [];
  private seq = 0;

  constructor(blocks: Array<Pick<CoreBlock, "label" | "limit"> & { value?: string }> = [{ label: "persona", limit: 2000 }, { label: "human", limit: 2000 }]) {
    for (const b of blocks) this.core.set(b.label, { label: b.label, limit: b.limit, value: b.value ?? "" });
  }

  // ---- self-edit tools ----
  coreAppend(label: string, text: string): boolean {
    const b = this.core.get(label);
    if (!b) return false;
    const next = b.value ? `${b.value}\n${text}` : text;
    if (next.length <= b.limit) { b.value = next; return true; }
    // overflow: page the oldest lines out to archival until it fits
    const lines = next.split("\n");
    while (lines.join("\n").length > b.limit && lines.length > 1) this.archivalInsert(`[${label}] ${lines.shift()!}`);
    b.value = lines.join("\n").slice(-b.limit);
    return true;
  }

  coreReplace(label: string, oldText: string, newText: string): boolean {
    const b = this.core.get(label);
    if (!b || !b.value.includes(oldText)) return false;
    const next = b.value.replace(oldText, newText);
    if (next.length > b.limit) return false;
    b.value = next;
    return true;
  }

  archivalInsert(text: string, at = Date.now()): ArchivalEntry {
    const e = { id: `arch-${++this.seq}`, text, at };
    this.archival.push(e);
    return e;
  }

  archivalSearch(query: string, k = 5): ArchivalEntry[] {
    const q = query.toLowerCase().split(/\W+/).filter(Boolean);
    return this.archival
      .map((e) => ({ e, s: q.filter((w) => e.text.toLowerCase().includes(w)).length }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.e.at - a.e.at)
      .slice(0, k)
      .map((x) => x.e);
  }

  pushRecall(message: string): void { this.recall.push(message); }

  /** Builds a context: all core blocks, then newest recall messages within the token budget. */
  buildContext(budgetTokens: number): { text: string; tokens: number; droppedRecall: number } {
    const core = [...this.core.values()].map((b) => `<${b.label}>\n${b.value}\n</${b.label}>`).join("\n");
    let used = estimateTokens(core);
    const kept: string[] = [];
    for (let i = this.recall.length - 1; i >= 0; i--) {
      const t = estimateTokens(this.recall[i]);
      if (used + t > budgetTokens) break;
      kept.unshift(this.recall[i]);
      used += t;
    }
    return { text: [core, ...kept].join("\n"), tokens: used, droppedRecall: this.recall.length - kept.length };
  }
}
