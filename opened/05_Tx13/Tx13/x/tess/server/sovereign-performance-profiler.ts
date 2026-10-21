/**
 * Tessera System-Wide Performance Profiler Dashboard
 * Grand Dimension Council Proposal #6 — 84% YES — MEDIUM
 *
 * Tracks CPU time per route, memory allocation per module,
 * identifies top 10 slowest operations. Auto-reports hourly.
 */

import { logger } from "./logger";
import type { Request, Response, NextFunction } from "express";

const log = (msg: string) => logger.info("PerfProfiler", msg);

// ── Types ──────────────────────────────────────────────────────────────────

export interface RouteProfile {
  path: string;
  method: string;
  callCount: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  p99Ms: number;
  errorCount: number;
  lastCalledAt: number;
  durations: number[]; // Rolling last 100
}

export interface SystemProfile {
  capturedAt: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  uptime: number;
  activeHandles: number;
  eventLoopLag?: number;
}

export interface PerformanceReport {
  reportedAt: number;
  periodMs: number;
  topSlowRoutes: RouteProfile[];
  topFrequentRoutes: RouteProfile[];
  errorProneRoutes: RouteProfile[];
  system: SystemProfile;
  totalRequests: number;
  totalErrors: number;
  avgResponseMs: number;
  p99ResponseMs: number;
  recommendations: string[];
}

// ── State ──────────────────────────────────────────────────────────────────

const routeProfiles: Map<string, RouteProfile> = new Map();
let systemSnapshots: SystemProfile[] = [];
let reportHistory: PerformanceReport[] = [];
let reportIntervalId: NodeJS.Timeout | null = null;
const REPORT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SYSTEM_SNAPSHOT_INTERVAL_MS = 30 * 1000; // 30 seconds
const MAX_DURATIONS_STORED = 100;

// ── Route Profile Key ──────────────────────────────────────────────────────

function routeKey(method: string, path: string): string {
  // Normalize parameterized routes
  const normalizedPath = path
    .replace(/\/[0-9]+/g, "/:id")
    .replace(/\/[a-f0-9]{8,}/g, "/:hash");
  return `${method.toUpperCase()}:${normalizedPath}`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] || 0;
}

// ── Express Middleware ─────────────────────────────────────────────────────

export function performanceProfilerMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    const path = req.path;
    const method = req.method;

    res.on("finish", () => {
      const durationMs = performance.now() - start;
      const key = routeKey(method, path);

      let profile = routeProfiles.get(key);
      if (!profile) {
        profile = {
          path,
          method,
          callCount: 0,
          totalMs: 0,
          avgMs: 0,
          minMs: Infinity,
          maxMs: 0,
          p95Ms: 0,
          p99Ms: 0,
          errorCount: 0,
          lastCalledAt: 0,
          durations: [],
        };
        routeProfiles.set(key, profile);
      }

      profile.callCount++;
      profile.totalMs += durationMs;
      profile.avgMs = profile.totalMs / profile.callCount;
      profile.minMs = Math.min(profile.minMs, durationMs);
      profile.maxMs = Math.max(profile.maxMs, durationMs);
      profile.lastCalledAt = Date.now();

      if (res.statusCode >= 400) profile.errorCount++;

      // Rolling duration buffer for percentile calculation
      profile.durations.push(durationMs);
      if (profile.durations.length > MAX_DURATIONS_STORED) {
        profile.durations.shift();
      }

      const sorted = [...profile.durations].sort((a, b) => a - b);
      profile.p95Ms = percentile(sorted, 95);
      profile.p99Ms = percentile(sorted, 99);
    });

    next();
  };
}

// ── System Snapshot ────────────────────────────────────────────────────────

function captureSystemSnapshot(): SystemProfile {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const snapshot: SystemProfile = {
    capturedAt: Date.now(),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    externalMB: Math.round(mem.external / 1024 / 1024),
    cpuUserMs: Math.round(cpu.user / 1000),
    cpuSystemMs: Math.round(cpu.system / 1000),
    uptime: Math.round(process.uptime()),
    activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
  };
  systemSnapshots.push(snapshot);
  if (systemSnapshots.length > 120) systemSnapshots = systemSnapshots.slice(-120); // Last hour
  return snapshot;
}

// ── Report Generation ──────────────────────────────────────────────────────

function generatePerformanceReport(): PerformanceReport {
  const now = Date.now();
  const profiles = Array.from(routeProfiles.values()).filter(p => p.callCount > 0);

  // Sort by different criteria
  const topSlow = [...profiles]
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10);

  const topFrequent = [...profiles]
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 10);

  const errorProne = [...profiles]
    .filter(p => p.errorCount > 0)
    .sort((a, b) => (b.errorCount / b.callCount) - (a.errorCount / a.callCount))
    .slice(0, 5);

  const system = captureSystemSnapshot();

  const totalRequests = profiles.reduce((s, p) => s + p.callCount, 0);
  const totalErrors = profiles.reduce((s, p) => s + p.errorCount, 0);
  const allDurations = profiles.flatMap(p => p.durations).sort((a, b) => a - b);
  const avgResponseMs = allDurations.length > 0 ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length : 0;
  const p99ResponseMs = percentile(allDurations, 99);

  const recommendations: string[] = [];

  if (system.heapUsedMB > 800) recommendations.push(`HIGH MEMORY: ${system.heapUsedMB}MB heap used. Consider implementing object pooling and reducing in-memory caches.`);
  if (topSlow[0]?.avgMs > 500) recommendations.push(`SLOW ROUTE: ${topSlow[0].method} ${topSlow[0].path} averaging ${topSlow[0].avgMs.toFixed(0)}ms. Investigate database queries and LLM calls.`);
  if (p99ResponseMs > 1000) recommendations.push(`P99 LATENCY: ${p99ResponseMs.toFixed(0)}ms p99 response time. Add caching for common queries.`);
  if (totalErrors / totalRequests > 0.05) recommendations.push(`HIGH ERROR RATE: ${Math.round((totalErrors/totalRequests)*100)}% of requests failing. Review error-prone routes.`);
  if (errorProne.length > 0) recommendations.push(`ERROR-PRONE ROUTES: ${errorProne.slice(0,3).map(r => `${r.path}(${r.errorCount}err)`).join(", ")}`);
  if (avgResponseMs < 50) recommendations.push("Excellent average response time — below 50ms. Continue optimizing hot paths.");

  const report: PerformanceReport = {
    reportedAt: now,
    periodMs: REPORT_INTERVAL_MS,
    topSlowRoutes: topSlow,
    topFrequentRoutes: topFrequent,
    errorProneRoutes: errorProne,
    system,
    totalRequests,
    totalErrors,
    avgResponseMs: Math.round(avgResponseMs * 100) / 100,
    p99ResponseMs: Math.round(p99ResponseMs * 100) / 100,
    recommendations,
  };

  reportHistory.unshift(report);
  if (reportHistory.length > 24) reportHistory = reportHistory.slice(0, 24); // Last 24 hours

  log(`Performance report: ${totalRequests} requests, avg ${avgResponseMs.toFixed(0)}ms, p99 ${p99ResponseMs.toFixed(0)}ms, ${totalErrors} errors`);
  if (topSlow[0]) log(`Slowest route: ${topSlow[0].method} ${topSlow[0].path} (avg ${topSlow[0].avgMs.toFixed(0)}ms)`);

  return report;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function startPerformanceProfiler(): void {
  if (reportIntervalId) return;

  // Capture system snapshots every 30 seconds
  setInterval(captureSystemSnapshot, SYSTEM_SNAPSHOT_INTERVAL_MS);

  // Generate reports every hour
  reportIntervalId = setInterval(generatePerformanceReport, REPORT_INTERVAL_MS);

  log("Performance Profiler started — 30s system snapshots, hourly performance reports");
}

export function getPerformanceReport(): PerformanceReport {
  return generatePerformanceReport();
}

export function getLatestReport(): PerformanceReport | null {
  return reportHistory[0] || null;
}

export function getRouteProfiles(): RouteProfile[] {
  return Array.from(routeProfiles.values())
    .sort((a, b) => b.avgMs - a.avgMs);
}

export function getSystemSnapshots(lastN: number = 12): SystemProfile[] {
  return systemSnapshots.slice(-lastN);
}

export function getProfilerSummary() {
  const profiles = Array.from(routeProfiles.values());
  const totalRequests = profiles.reduce((s, p) => s + p.callCount, 0);
  const totalErrors = profiles.reduce((s, p) => s + p.errorCount, 0);
  const latestSystem = systemSnapshots[systemSnapshots.length - 1] || captureSystemSnapshot();
  const slowestRoute = profiles.sort((a, b) => b.avgMs - a.avgMs)[0];
  const mostFrequent = profiles.sort((a, b) => b.callCount - a.callCount)[0];

  return {
    totalRoutes: profiles.length,
    totalRequests,
    totalErrors,
    errorRate: totalRequests > 0 ? `${Math.round((totalErrors/totalRequests)*100)}%` : "0%",
    heapUsedMB: latestSystem.heapUsedMB,
    uptimeHours: Math.round(latestSystem.uptime / 3600),
    slowestRoute: slowestRoute ? `${slowestRoute.method} ${slowestRoute.path} (${slowestRoute.avgMs.toFixed(0)}ms avg)` : "none",
    mostFrequentRoute: mostFrequent ? `${mostFrequent.method} ${mostFrequent.path} (${mostFrequent.callCount} calls)` : "none",
    reportCount: reportHistory.length,
  };
}

log("Performance Profiler module loaded");
