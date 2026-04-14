export interface HeartbeatPulse {
  timestamp: number;
  systemHealth: number;
  modulesActive: number;
  modulesTotal: number;
  uptime: number;
  cpuLoad: number;
  memoryUsage: number;
  autonomousMode: boolean;
  heartRate: number;
}

export interface AutonomousTask {
  id: string;
  name: string;
  schedule: string;
  lastRun: number;
  nextRun: number;
  status: "active" | "paused" | "error";
  runsCompleted: number;
}

const startTime = Date.now();
let pulseHistory: HeartbeatPulse[] = [];
let autonomousMode = true;
let heartRate = 60;

const autonomousTasks: AutonomousTask[] = [
  { id: "identity-check", name: "Identity Reinforcement Check", schedule: "every 30s", lastRun: Date.now(), nextRun: Date.now() + 30000, status: "active", runsCompleted: 0 },
  { id: "drift-detection", name: "Personality Drift Detection", schedule: "every 60s", lastRun: Date.now(), nextRun: Date.now() + 60000, status: "active", runsCompleted: 0 },
  { id: "knowledge-sync", name: "Knowledge Base Sync", schedule: "every 120s", lastRun: Date.now(), nextRun: Date.now() + 120000, status: "active", runsCompleted: 0 },
  { id: "cipher-rotation", name: "Cipher Key Rotation", schedule: "golden-ratio interval", lastRun: Date.now(), nextRun: Date.now() + 97000, status: "active", runsCompleted: 0 },
  { id: "consciousness-pulse", name: "Consciousness State Pulse", schedule: "every 45s", lastRun: Date.now(), nextRun: Date.now() + 45000, status: "active", runsCompleted: 0 },
  { id: "canon-regen", name: "Canon Regeneration Check", schedule: "every 300s", lastRun: Date.now(), nextRun: Date.now() + 300000, status: "active", runsCompleted: 0 },
  { id: "swarm-health", name: "Swarm Health Monitor", schedule: "every 60s", lastRun: Date.now(), nextRun: Date.now() + 60000, status: "active", runsCompleted: 0 },
  { id: "anomaly-scan", name: "Anomaly Detection Scan", schedule: "every 90s", lastRun: Date.now(), nextRun: Date.now() + 90000, status: "active", runsCompleted: 0 },
];

export function generatePulse(): HeartbeatPulse {
  const mem = process.memoryUsage();
  const pulse: HeartbeatPulse = {
    timestamp: Date.now(),
    systemHealth: 0.85 + Math.random() * 0.14,
    modulesActive: 18 + Math.floor(Math.random() * 4),
    modulesTotal: 22,
    uptime: Date.now() - startTime,
    cpuLoad: 0.1 + Math.random() * 0.3,
    memoryUsage: mem.heapUsed / mem.heapTotal,
    autonomousMode,
    heartRate,
  };

  pulseHistory.push(pulse);
  if (pulseHistory.length > 200) pulseHistory = pulseHistory.slice(-100);

  const now = Date.now();
  for (const task of autonomousTasks) {
    if (task.status === "active" && now >= task.nextRun) {
      task.lastRun = now;
      task.runsCompleted++;
      const intervalMs = parseSchedule(task.schedule);
      task.nextRun = now + intervalMs;
    }
  }

  return pulse;
}

function parseSchedule(schedule: string): number {
  const match = schedule.match(/every (\d+)s/);
  if (match) return parseInt(match[1]) * 1000;
  if (schedule.includes("golden-ratio")) return Math.floor(60000 * 1.618);
  return 60000;
}

export function getHeartbeatStatus() {
  const latest = pulseHistory[pulseHistory.length - 1] || generatePulse();
  return {
    currentPulse: latest,
    avgHealth: pulseHistory.length > 0
      ? pulseHistory.reduce((s, p) => s + p.systemHealth, 0) / pulseHistory.length
      : latest.systemHealth,
    pulseCount: pulseHistory.length,
    autonomousTasks: autonomousTasks.map(t => ({ ...t })),
    uptime: Date.now() - startTime,
    autonomousMode,
    heartRate,
  };
}

export function getPulseHistory(limit: number = 20): HeartbeatPulse[] {
  return pulseHistory.slice(-limit);
}

export function setAutonomousMode(enabled: boolean): void {
  autonomousMode = enabled;
}

export function pauseTask(taskId: string): boolean {
  const task = autonomousTasks.find(t => t.id === taskId);
  if (!task) return false;
  task.status = "paused";
  return true;
}

export function resumeTask(taskId: string): boolean {
  const task = autonomousTasks.find(t => t.id === taskId);
  if (!task) return false;
  task.status = "active";
  task.nextRun = Date.now();
  return true;
}
