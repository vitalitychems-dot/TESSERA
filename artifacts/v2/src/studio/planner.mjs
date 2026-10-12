/**
 * Lead planner. The default pen is a simulator, so a two-task goal
 * finishes with no paid model and no Minecraft client.
 * A real pen can be passed in later. OpenAI is not the default.
 */
import { createForeman } from "./task-graph.mjs";

export function simPen() {
  return {
    name: "sim",
    async complete(prompt) {
      const goal = String(prompt).replace(/^Plan:\s*/i, "").trim();
      return {
        tasks: [
          { id: "t1", title: `Describe ${goal}` },
          { id: "t2", title: `Check ${goal}`, dependsOn: ["t1"] },
        ],
      };
    },
  };
}

export async function runGoal(goal, pen = simPen()) {
  const foreman = createForeman();
  const plan = await pen.complete(`Plan: ${goal}`);
  if (!Array.isArray(plan.tasks) || plan.tasks.length < 2) throw new Error("planner must return two tasks");
  for (const task of plan.tasks) foreman.addTask(task);
  for (const task of plan.tasks) {
    foreman.start(task.id);
    foreman.complete(task.id);
  }
  return foreman.snapshot();
}
