/**
 * Foreman task graph and decision queue.
 * Clean-room of the AgentCraft pattern: dependencies gate start,
 * an open decision blocks the worker, a decision resumes it.
 * No model calls.
 */

export function createForeman() {
  let nextDecision = 1;
  const tasks = new Map();
  const decisions = new Map();

  function task(id) {
    const found = tasks.get(id);
    if (!found) throw new Error(`missing task ${id}`);
    return found;
  }

  function depsDone(item) {
    return item.dependsOn.every((dep) => tasks.get(dep)?.status === "done");
  }

  function openDecisionFor(taskId) {
    return [...decisions.values()].find((item) => item.taskId === taskId && item.status === "open") ?? null;
  }

  return {
    addTask({ id, title, dependsOn = [] }) {
      if (tasks.has(id)) throw new Error(`duplicate task ${id}`);
      for (const dep of dependsOn) task(dep);
      const item = { id, title, dependsOn: [...dependsOn], status: "pending" };
      tasks.set(id, item);
      return item;
    },
    requestDecision({ taskId, question }) {
      task(taskId).status = "blocked";
      const decision = {
        id: `d${nextDecision++}`,
        taskId,
        question,
        status: "open",
        answer: null,
      };
      decisions.set(decision.id, decision);
      return decision;
    },
    decide(decisionId, answer) {
      const decision = decisions.get(decisionId);
      if (!decision || decision.status !== "open") throw new Error("no open decision");
      decision.status = "closed";
      decision.answer = answer;
      const item = task(decision.taskId);
      if (!openDecisionFor(item.id) && depsDone(item)) item.status = "pending";
      return decision;
    },
    start(id) {
      const item = task(id);
      if (!depsDone(item)) throw new Error("dependencies open");
      if (item.status === "blocked" || openDecisionFor(id)) throw new Error("decision blocks worker");
      if (item.status === "done" || item.status === "running") throw new Error(`cannot start ${item.status}`);
      item.status = "running";
      return item;
    },
    complete(id) {
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
