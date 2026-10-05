import { describe, expect, it } from "vitest";
import {
  scoreCpuLoad,
  scoreFreeMemoryMb,
  scoreProcessHeap,
  scoreUptimeMinutes,
  testCPULoad,
  testOSFreeMemory,
  testProcessMemory,
  testUptimeStability,
} from "../lib/eval-os-metrics";

describe("OS metric score branches", () => {
  it("scores process heap bands and the pass line", () => {
    expect(scoreProcessHeap(49.9)).toEqual({ score: 100, passed: true });
    expect(scoreProcessHeap(50)).toEqual({ score: 88, passed: true });
    expect(scoreProcessHeap(64.9)).toEqual({ score: 88, passed: true });
    expect(scoreProcessHeap(65)).toEqual({ score: 72, passed: true });
    expect(scoreProcessHeap(74.9)).toEqual({ score: 72, passed: true });
    expect(scoreProcessHeap(75)).toEqual({ score: 55, passed: true });
    expect(scoreProcessHeap(84.9)).toEqual({ score: 55, passed: true });
    expect(scoreProcessHeap(85)).toEqual({ score: 38, passed: true });
    expect(scoreProcessHeap(89.9)).toEqual({ score: 38, passed: true });
    expect(scoreProcessHeap(90)).toEqual({ score: 38, passed: false });
    expect(scoreProcessHeap(91.9)).toEqual({ score: 38, passed: false });
    expect(scoreProcessHeap(92)).toEqual({ score: 20, passed: false });
  });

  it("scores CPU load bands and the pass line", () => {
    expect(scoreCpuLoad(29.9)).toEqual({ score: 100, passed: true });
    expect(scoreCpuLoad(30)).toEqual({ score: 88, passed: true });
    expect(scoreCpuLoad(49.9)).toEqual({ score: 88, passed: true });
    expect(scoreCpuLoad(50)).toEqual({ score: 72, passed: true });
    expect(scoreCpuLoad(64.9)).toEqual({ score: 72, passed: true });
    expect(scoreCpuLoad(65)).toEqual({ score: 55, passed: true });
    expect(scoreCpuLoad(79.9)).toEqual({ score: 55, passed: true });
    expect(scoreCpuLoad(80)).toEqual({ score: 38, passed: true });
    expect(scoreCpuLoad(89.9)).toEqual({ score: 38, passed: true });
    expect(scoreCpuLoad(90)).toEqual({ score: 20, passed: false });
    expect(scoreCpuLoad(100)).toEqual({ score: 20, passed: false });
  });

  it("scores free memory bands and the pass line", () => {
    expect(scoreFreeMemoryMb(1024.1)).toEqual({ score: 100, passed: true });
    expect(scoreFreeMemoryMb(1024)).toEqual({ score: 88, passed: true });
    expect(scoreFreeMemoryMb(512.1)).toEqual({ score: 88, passed: true });
    expect(scoreFreeMemoryMb(512)).toEqual({ score: 72, passed: true });
    expect(scoreFreeMemoryMb(256.1)).toEqual({ score: 72, passed: true });
    expect(scoreFreeMemoryMb(256)).toEqual({ score: 55, passed: true });
    expect(scoreFreeMemoryMb(128.1)).toEqual({ score: 55, passed: true });
    expect(scoreFreeMemoryMb(128)).toEqual({ score: 38, passed: true });
    expect(scoreFreeMemoryMb(64.1)).toEqual({ score: 38, passed: true });
    expect(scoreFreeMemoryMb(64)).toEqual({ score: 20, passed: false });
    expect(scoreFreeMemoryMb(0)).toEqual({ score: 20, passed: false });
  });

  it("scores uptime bands and always passes", () => {
    expect(scoreUptimeMinutes(60.1)).toEqual({ score: 100, passed: true });
    expect(scoreUptimeMinutes(60)).toEqual({ score: 88, passed: true });
    expect(scoreUptimeMinutes(30.1)).toEqual({ score: 88, passed: true });
    expect(scoreUptimeMinutes(30)).toEqual({ score: 72, passed: true });
    expect(scoreUptimeMinutes(10.1)).toEqual({ score: 72, passed: true });
    expect(scoreUptimeMinutes(10)).toEqual({ score: 58, passed: true });
    expect(scoreUptimeMinutes(5.1)).toEqual({ score: 58, passed: true });
    expect(scoreUptimeMinutes(5)).toEqual({ score: 45, passed: true });
    expect(scoreUptimeMinutes(1.1)).toEqual({ score: 45, passed: true });
    expect(scoreUptimeMinutes(1)).toEqual({ score: 30, passed: true });
    expect(scoreUptimeMinutes(0)).toEqual({ score: 30, passed: true });
  });

  it("names the four System Health checks without a database", async () => {
    const results = await Promise.all([
      testProcessMemory(),
      testCPULoad(),
      testOSFreeMemory(),
      testUptimeStability(),
    ]);
    expect(results.map((result) => result.testName)).toEqual([
      "Process Heap Usage",
      "CPU Load Average",
      "OS Free Memory",
      "Process Uptime Stability",
    ]);
    for (const result of results) {
      expect(result.dimension).toBe("System Health");
      expect(result.maxScore).toBe(100);
    }
  });
});
