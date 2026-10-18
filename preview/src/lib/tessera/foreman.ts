/** Foreman task graph. Dependencies gate start. An open decision blocks the worker. No model call. */

type Task = { id: string; title: string; dependsOn: string[]; status: "pending" | "running" | "done" | "blocked" };
type Decision = { id: string; taskId: string; question: string; status: "open" | "closed"; answer: string | null };

export function createForeman() {
  let nextDecision = 1;
  const tasks = new Map<string, Task>();
  const decisions = new Map<string, Decision>();

  function task(id: string) {
    const found = tasks.get(id);
    if (!found) throw new Error(`missing task ${id}`);
    return found;
  }

  function depsDone(item: Task) {
    return item.dependsOn.every((dep) => tasks.get(dep)?.status === "done");
  }

  function openDecisionFor(taskId: string) {
    return [...decisions.values()].find((item) => item.taskId === taskId && item.status === "open") ?? null;
  }

  return {
    addTask({ id, title, dependsOn = [] }: { id: string; title: string; dependsOn?: string[] }) {
      if (tasks.has(id)) throw new Error(`duplicate task ${id}`);
      for (const dep of dependsOn) task(dep);
      const item: Task = { id, title, dependsOn: [...dependsOn], status: "pending" };
      tasks.set(id, item);
      return item;
    },
    requestDecision({ taskId, question }: { taskId: string; question: string }) {
      task(taskId).status = "blocked";
      const decision: Decision = { id: `d${nextDecision++}`, taskId, question, status: "open", answer: null };
      decisions.set(decision.id, decision);
      return decision;
    },
    decide(decisionId: string, answer: string) {
      const decision = decisions.get(decisionId);
      if (!decision || decision.status !== "open") throw new Error("no open decision");
      decision.status = "closed";
      decision.answer = answer;
      const item = task(decision.taskId);
      if (!openDecisionFor(item.id) && depsDone(item)) item.status = "pending";
      return decision;
    },
    start(id: string) {
      const item = task(id);
      if (!depsDone(item)) throw new Error("dependencies open");
      if (item.status === "blocked" || openDecisionFor(id)) throw new Error("decision blocks worker");
      if (item.status === "done" || item.status === "running") throw new Error(`cannot start ${item.status}`);
      item.status = "running";
      return item;
    },
    complete(id: string) {
      const item = task(id);
      if (item.status !== "running") throw new Error("not running");
      item.status = "done";
      return item;
    },
    snapshot() {
      return {
        tasks: [...tasks.values()].map((item) => ({ ...item, dependsOn: [...item.dependsOn] })),
        decisions: [...decisions.values()].map((item) => ({ ...item })),
      };
    },
  };
}

export function boardFromPulls(rows: { repo: string; number: number; title: string; state: string }[]) {
  const foreman = createForeman();
  for (const row of rows) {
    const id = `${row.repo}-${row.number}`;
    foreman.addTask({ id, title: `${row.repo} #${row.number} ${row.title}` });
    const held = /\bhold(?:s|ing)?\b/i.test(row.title) || row.state === "draft" || row.state === "dirty";
    if (held) foreman.requestDecision({ taskId: id, question: row.state === "draft" ? "Held. Not merged." : `Blocked: ${row.state || "conflict"}.` });
  }
  return foreman.snapshot();
}
