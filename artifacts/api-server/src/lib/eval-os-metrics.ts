import os from "os";

export function scoreProcessHeap(heapPercent: number): { score: number; passed: boolean } {
  const score = heapPercent < 50 ? 100 : heapPercent < 65 ? 88 : heapPercent < 75 ? 72 : heapPercent < 85 ? 55 : heapPercent < 92 ? 38 : 20;
  return { score, passed: heapPercent < 90 };
}

export function scoreCpuLoad(loadPercent: number): { score: number; passed: boolean } {
  const score = loadPercent < 30 ? 100 : loadPercent < 50 ? 88 : loadPercent < 65 ? 72 : loadPercent < 80 ? 55 : loadPercent < 90 ? 38 : 20;
  return { score, passed: loadPercent < 90 };
}

export function scoreFreeMemoryMb(freeMemMb: number): { score: number; passed: boolean } {
  const score = freeMemMb > 1024 ? 100 : freeMemMb > 512 ? 88 : freeMemMb > 256 ? 72 : freeMemMb > 128 ? 55 : freeMemMb > 64 ? 38 : 20;
  return { score, passed: freeMemMb > 64 };
}

export function scoreUptimeMinutes(uptimeMin: number): { score: number; passed: boolean } {
  const score = uptimeMin > 60 ? 100 : uptimeMin > 30 ? 88 : uptimeMin > 10 ? 72 : uptimeMin > 5 ? 58 : uptimeMin > 1 ? 45 : 30;
  return { score, passed: true };
}

export async function testProcessMemory() {
  const id = "process_memory";
  const start = Date.now();
  const mem = process.memoryUsage();
  const heapUsedMb = mem.heapUsed / 1024 / 1024;
  const heapTotalMb = mem.heapTotal / 1024 / 1024;
  const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
  const durationMs = Date.now() - start;
  const { score, passed } = scoreProcessHeap(heapPercent);

  return {
    testId: id,
    testName: "Process Heap Usage",
    dimension: "System Health",
    passed,
    score,
    maxScore: 100,
    measuredValueLabel: "heap_percent",
    measuredValue: Math.round(heapPercent),
    durationMs,
    evidence: `process.memoryUsage(): heapUsed=${heapUsedMb.toFixed(0)}MB / heapTotal=${heapTotalMb.toFixed(0)}MB = ${heapPercent.toFixed(1)}%`,
  };
}

export async function testCPULoad() {
  const id = "cpu_load";
  const start = Date.now();
  const cpuCores = os.cpus().length;
  const loadAvg = os.loadavg()[0];
  const loadPercent = Math.min(100, (loadAvg / cpuCores) * 100);
  const durationMs = Date.now() - start;
  const { score, passed } = scoreCpuLoad(loadPercent);

  return {
    testId: id,
    testName: "CPU Load Average",
    dimension: "System Health",
    passed,
    score,
    maxScore: 100,
    measuredValueLabel: "cpu_load_percent",
    measuredValue: Math.round(loadPercent),
    durationMs,
    evidence: `os.loadavg(): ${loadAvg.toFixed(2)} / ${cpuCores} cores = ${loadPercent.toFixed(1)}% load`,
  };
}

export async function testOSFreeMemory() {
  const id = "os_freemem";
  const start = Date.now();
  const freeMemMb = os.freemem() / 1024 / 1024;
  const totalMemMb = os.totalmem() / 1024 / 1024;
  const usedPercent = ((totalMemMb - freeMemMb) / totalMemMb) * 100;
  const durationMs = Date.now() - start;
  const { score, passed } = scoreFreeMemoryMb(freeMemMb);

  return {
    testId: id,
    testName: "OS Free Memory",
    dimension: "System Health",
    passed,
    score,
    maxScore: 100,
    measuredValueLabel: "free_mem_mb",
    measuredValue: Math.round(freeMemMb),
    durationMs,
    evidence: `os.freemem()=${freeMemMb.toFixed(0)}MB free / total=${totalMemMb.toFixed(0)}MB (${usedPercent.toFixed(0)}% used)`,
  };
}

export async function testUptimeStability() {
  const id = "uptime_stability";
  const start = Date.now();
  const uptimeSec = process.uptime();
  const uptimeMin = uptimeSec / 60;
  const durationMs = Date.now() - start;
  const { score, passed } = scoreUptimeMinutes(uptimeMin);

  return {
    testId: id,
    testName: "Process Uptime Stability",
    dimension: "System Health",
    passed,
    score,
    maxScore: 100,
    measuredValueLabel: "uptime_minutes",
    measuredValue: Math.round(uptimeMin),
    durationMs,
    evidence: `process.uptime()=${uptimeSec.toFixed(0)}s = ${uptimeMin.toFixed(1)} minutes continuous uptime`,
  };
}
