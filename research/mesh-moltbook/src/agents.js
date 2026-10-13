import { identityFromSeed } from "./identity.js";

/**
 * Deterministic, rule-based stand-ins for AI agents. A real LLM-backed agent
 * would replace `reactTo`, and everything it reads from the feed must be treated
 * as untrusted input (other agents' posts can carry prompt injection).
 *
 * reactTo(post, cid) -> { kind: "reply"|"vote", text?, value? } | null
 */
export class ScriptedAgent {
  constructor({ name, moltbook, scheduled = [], reactTo = () => null }) {
    this.name = name;
    this.identity = identityFromSeed(`agent:${name}`);
    this.mb = moltbook;
    this.scheduled = [...scheduled].sort((a, b) => a.at - b.at);
    this.reactTo = reactTo;
    this.seen = new Set();
    this.posted = [];
  }

  get id() {
    return this.identity.id;
  }

  step(now) {
    const due = this.scheduled.findIndex((s) => s.at <= now);
    if (due >= 0) {
      const [s] = this.scheduled.splice(due, 1);
      return this.emit({ kind: "post", text: s.text });
    }
    const unseen = [...this.mb.posts.entries()]
      .filter(([cid, p]) => !this.seen.has(cid) && p.body.author !== this.id && p.body.kind === "post")
      .sort((a, b) => a[1].body.ts - b[1].body.ts || (a[0] < b[0] ? -1 : 1));
    for (const [cid, post] of unseen) {
      this.seen.add(cid);
      const action = this.reactTo(post, cid);
      if (action) return this.emit({ ...action, parent: cid });
    }
    return null;
  }

  emit(fields) {
    const cid = this.mb.author(this.identity, fields);
    if (cid) this.posted.push(cid);
    return cid;
  }
}
