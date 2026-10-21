import fs from "fs";
import path from "path";

export interface TaskStep {
  description: string;
  completed: boolean;
  completedAt?: number;
}

export interface TrackedTask {
  taskId: string;
  title: string;
  status: "pending" | "in-progress" | "complete" | "failed";
  progress: number;
  steps: TaskStep[];
  startedAt: number;
  completedAt?: number;
  summary?: string;
  conversationId?: number;
}

interface TaskProgressState {
  tasks: TrackedTask[];
  totalCreated: number;
  totalCompleted: number;
  totalFailed: number;
}

const PERSIST_PATH = path.join(process.cwd(), "server", "task-progress.json");

const state: TaskProgressState = {
  tasks: [],
  totalCreated: 0,
  totalCompleted: 0,
  totalFailed: 0,
};

function persist() {
  try {
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(state, null, 2));
  } catch {}
}

function loadFromDisk() {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, "utf-8");
      const data = JSON.parse(raw) as TaskProgressState;
      state.tasks = data.tasks || [];
      state.totalCreated = data.totalCreated || 0;
      state.totalCompleted = data.totalCompleted || 0;
      state.totalFailed = data.totalFailed || 0;
      console.log(`[TaskProgress] Loaded ${state.tasks.length} tasks from disk`);
    }
  } catch {
    console.log("[TaskProgress] No previous task data found, starting fresh");
  }
}

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function startTaskTracker() {
  loadFromDisk();
  console.log("[TaskProgress] Task tracker started");
}

export function createTask(title: string, steps: string[] = [], conversationId?: number): TrackedTask {
  const task: TrackedTask = {
    taskId: generateId(),
    title,
    status: "in-progress",
    progress: 0,
    steps: steps.map(desc => ({ description: desc, completed: false })),
    startedAt: Date.now(),
    conversationId,
  };
  state.tasks.push(task);
  state.totalCreated++;
  persist();
  console.log(`[TaskProgress] Created task: ${title} (${task.taskId})`);
  return task;
}

export function updateTaskProgress(
  taskId: string,
  updates: {
    progress?: number;
    status?: "pending" | "in-progress" | "complete" | "failed";
    stepIndex?: number;
    stepCompleted?: boolean;
    summary?: string;
  }
): TrackedTask | null {
  const task = state.tasks.find(t => t.taskId === taskId);
  if (!task) return null;

  if (updates.progress !== undefined) {
    task.progress = Math.min(100, Math.max(0, updates.progress));
  }
  if (updates.status) {
    task.status = updates.status;
  }
  if (updates.stepIndex !== undefined && updates.stepCompleted !== undefined) {
    if (task.steps[updates.stepIndex]) {
      task.steps[updates.stepIndex].completed = updates.stepCompleted;
      if (updates.stepCompleted) {
        task.steps[updates.stepIndex].completedAt = Date.now();
      }
      const completedSteps = task.steps.filter(s => s.completed).length;
      task.progress = task.steps.length > 0 ? Math.round((completedSteps / task.steps.length) * 100) : 0;
    }
  }
  if (updates.summary) {
    task.summary = updates.summary;
  }

  persist();
  return task;
}

export function completeTask(taskId: string, summary?: string): TrackedTask | null {
  const task = state.tasks.find(t => t.taskId === taskId);
  if (!task) return null;

  task.status = "complete";
  task.progress = 100;
  task.completedAt = Date.now();
  if (summary) task.summary = summary;
  task.steps.forEach(s => {
    if (!s.completed) {
      s.completed = true;
      s.completedAt = Date.now();
    }
  });
  state.totalCompleted++;
  persist();
  console.log(`[TaskProgress] Completed task: ${task.title}`);
  return task;
}

export function failTask(taskId: string, summary?: string): TrackedTask | null {
  const task = state.tasks.find(t => t.taskId === taskId);
  if (!task) return null;

  task.status = "failed";
  task.completedAt = Date.now();
  if (summary) task.summary = summary;
  state.totalFailed++;
  persist();
  console.log(`[TaskProgress] Failed task: ${task.title}`);
  return task;
}

export function getActiveTasks(): TrackedTask[] {
  return state.tasks.filter(t => t.status === "pending" || t.status === "in-progress");
}

export function getTaskHistory(): TrackedTask[] {
  return state.tasks
    .filter(t => t.status === "complete" || t.status === "failed")
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 50);
}

export function getTask(taskId: string): TrackedTask | null {
  return state.tasks.find(t => t.taskId === taskId) || null;
}

export function getTaskProgressSummary(): string {
  const active = getActiveTasks();
  const completed = state.totalCompleted;
  const failed = state.totalFailed;

  if (active.length === 0 && completed === 0 && failed === 0) {
    return "TASK PROGRESS: No tasks tracked yet";
  }

  let summary = `TASK PROGRESS TRACKER:\n- Active Tasks: ${active.length}\n- Completed: ${completed}\n- Failed: ${failed}\n`;

  if (active.length > 0) {
    summary += "\nACTIVE TASKS:\n";
    for (const task of active) {
      const stepsInfo = task.steps.length > 0
        ? ` (${task.steps.filter(s => s.completed).length}/${task.steps.length} steps)`
        : "";
      summary += `- [${task.progress}%] ${task.title}${stepsInfo}\n`;
      for (const step of task.steps) {
        summary += `  ${step.completed ? "[DONE]" : "[    ]"} ${step.description}\n`;
      }
    }
  }

  return summary;
}

export function inferTaskFromMessage(message: string): { title: string; steps: string[] } | null {
  const lower = message.toLowerCase();

  const taskPatterns = [
    /(?:please\s+)?(?:can you\s+)?(?:help me\s+)?(?:build|create|make|implement|add|fix|update|change|modify|write|generate|design|set up|configure|deploy|install|optimize|refactor|debug|analyze|research|find|search|integrate|connect|enable|disable|remove|delete)\s+(.+)/i,
    /(?:i need|i want|let's|we need)\s+(?:to\s+)?(?:you to\s+)?(.+)/i,
  ];

  for (const pattern of taskPatterns) {
    const match = message.match(pattern);
    if (match && match[1] && match[1].length > 5 && match[1].length < 200) {
      const title = match[1].replace(/[.!?]+$/, "").trim();
      if (title.length < 5) continue;

      const steps: string[] = [];

      if (lower.includes("build") || lower.includes("create") || lower.includes("implement")) {
        steps.push("Analyze requirements", "Design solution", "Implement changes", "Verify and test");
      } else if (lower.includes("fix") || lower.includes("debug")) {
        steps.push("Identify the issue", "Analyze root cause", "Apply fix", "Verify resolution");
      } else if (lower.includes("research") || lower.includes("find") || lower.includes("search") || lower.includes("analyze")) {
        steps.push("Gather information", "Analyze data", "Compile findings", "Present results");
      } else if (lower.includes("update") || lower.includes("change") || lower.includes("modify")) {
        steps.push("Review current state", "Plan changes", "Apply updates", "Confirm changes");
      } else {
        steps.push("Understand request", "Process task", "Generate response");
      }

      return { title: title.slice(0, 80), steps };
    }
  }

  return null;
}
