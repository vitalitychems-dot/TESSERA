export class SovereignTemporalEngine {
  private eventTimeline: { timestamp: number; event: string; category: string; data?: any }[] = [];

  recordEvent(event: string, category: string, data?: any): void {
    this.eventTimeline.push({ timestamp: Date.now(), event, category, data });
    if (this.eventTimeline.length > 10000) this.eventTimeline = this.eventTimeline.slice(-5000);
  }

  getEvents(since?: number, category?: string): typeof this.eventTimeline {
    let events = this.eventTimeline;
    if (since) events = events.filter(e => e.timestamp >= since);
    if (category) events = events.filter(e => e.category === category);
    return events;
  }

  analyzeDuration(events: { timestamp: number }[]): { min: number; max: number; avg: number; median: number; p95: number } {
    if (events.length < 2) return { min: 0, max: 0, avg: 0, median: 0, p95: 0 };
    const gaps: number[] = [];
    for (let i = 1; i < events.length; i++) gaps.push(events[i].timestamp - events[i-1].timestamp);
    gaps.sort((a, b) => a - b);
    return {
      min: gaps[0],
      max: gaps[gaps.length - 1],
      avg: gaps.reduce((s, v) => s + v, 0) / gaps.length,
      median: gaps[Math.floor(gaps.length / 2)],
      p95: gaps[Math.floor(gaps.length * 0.95)],
    };
  }

  detectSeasonality(timestamps: number[], windowMs = 3600000): { hourly: number[]; dailyPattern: string } {
    const hourCounts = new Array(24).fill(0);
    for (const ts of timestamps) {
      const hour = new Date(ts).getHours();
      hourCounts[hour]++;
    }
    const total = timestamps.length || 1;
    const hourly = hourCounts.map((c: number) => parseFloat((c / total).toFixed(3)));
    const peakHour = hourly.indexOf(Math.max(...hourly));
    const quietHour = hourly.indexOf(Math.min(...hourly));
    return {
      hourly,
      dailyPattern: `Peak activity at ${peakHour}:00, quiet at ${quietHour}:00`,
    };
  }

  calculateUptime(events: { timestamp: number; status: 'up' | 'down' }[]): { uptimePercent: number; downtimeMs: number; incidents: number } {
    if (events.length === 0) return { uptimePercent: 100, downtimeMs: 0, incidents: 0 };
    let downtimeMs = 0;
    let incidents = 0;
    let lastDown: number | null = null;
    for (const e of events) {
      if (e.status === 'down' && lastDown === null) { lastDown = e.timestamp; incidents++; }
      else if (e.status === 'up' && lastDown !== null) { downtimeMs += e.timestamp - lastDown; lastDown = null; }
    }
    if (lastDown !== null) downtimeMs += Date.now() - lastDown;
    const totalMs = events[events.length - 1].timestamp - events[0].timestamp || 1;
    return { uptimePercent: parseFloat(((1 - downtimeMs / totalMs) * 100).toFixed(2)), downtimeMs, incidents };
  }

  scheduleTask(tasks: { id: string; deadline: number; priority: number; duration: number }[]): { id: string; start: number; end: number }[] {
    const sorted = [...tasks].sort((a, b) => {
      const urgencyA = a.priority / Math.max(a.deadline - Date.now(), 1);
      const urgencyB = b.priority / Math.max(b.deadline - Date.now(), 1);
      return urgencyB - urgencyA;
    });
    const schedule: { id: string; start: number; end: number }[] = [];
    let currentTime = Date.now();
    for (const task of sorted) {
      schedule.push({ id: task.id, start: currentTime, end: currentTime + task.duration });
      currentTime += task.duration;
    }
    return schedule;
  }

  timeSeriesResample(data: { timestamp: number; value: number }[], intervalMs: number): { timestamp: number; value: number }[] {
    if (data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const start = sorted[0].timestamp;
    const end = sorted[sorted.length - 1].timestamp;
    const result: { timestamp: number; value: number }[] = [];
    for (let t = start; t <= end; t += intervalMs) {
      const inWindow = sorted.filter(d => d.timestamp >= t && d.timestamp < t + intervalMs);
      if (inWindow.length > 0) {
        result.push({ timestamp: t, value: inWindow.reduce((s, d) => s + d.value, 0) / inWindow.length });
      }
    }
    return result;
  }

  estimateCompletion(progress: { timestamp: number; percentComplete: number }[]): { estimatedFinish: number; remainingMs: number; velocity: number } {
    if (progress.length < 2) return { estimatedFinish: 0, remainingMs: 0, velocity: 0 };
    const recent = progress.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const progressDelta = last.percentComplete - first.percentComplete;
    const timeDelta = last.timestamp - first.timestamp;
    if (progressDelta <= 0 || timeDelta <= 0) return { estimatedFinish: 0, remainingMs: Infinity, velocity: 0 };
    const velocity = progressDelta / timeDelta;
    const remaining = 100 - last.percentComplete;
    const remainingMs = remaining / velocity;
    return { estimatedFinish: last.timestamp + remainingMs, remainingMs, velocity };
  }

  parseRelativeTime(text: string): number | null {
    const now = Date.now();
    const patterns: [RegExp, (m: RegExpMatchArray) => number][] = [
      [/(\d+)\s*seconds?\s*ago/i, (m) => now - parseInt(m[1]) * 1000],
      [/(\d+)\s*minutes?\s*ago/i, (m) => now - parseInt(m[1]) * 60000],
      [/(\d+)\s*hours?\s*ago/i, (m) => now - parseInt(m[1]) * 3600000],
      [/(\d+)\s*days?\s*ago/i, (m) => now - parseInt(m[1]) * 86400000],
      [/(\d+)\s*weeks?\s*ago/i, (m) => now - parseInt(m[1]) * 604800000],
      [/in\s*(\d+)\s*seconds?/i, (m) => now + parseInt(m[1]) * 1000],
      [/in\s*(\d+)\s*minutes?/i, (m) => now + parseInt(m[1]) * 60000],
      [/in\s*(\d+)\s*hours?/i, (m) => now + parseInt(m[1]) * 3600000],
      [/in\s*(\d+)\s*days?/i, (m) => now + parseInt(m[1]) * 86400000],
      [/yesterday/i, () => now - 86400000],
      [/tomorrow/i, () => now + 86400000],
      [/now/i, () => now],
    ];
    for (const [re, fn] of patterns) {
      const match = text.match(re);
      if (match) return fn(match);
    }
    return null;
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
    return `${Math.floor(ms / 86400000)}d ${Math.floor((ms % 86400000) / 3600000)}h`;
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    this.recordEvent("test_event", "test", { data: 1 });
    check("Record event", this.getEvents(undefined, "test").length > 0);
    check("Duration analysis", (() => {
      const events = [{ timestamp: 100 }, { timestamp: 200 }, { timestamp: 300 }, { timestamp: 500 }];
      const d = this.analyzeDuration(events);
      return d.min === 100 && d.max === 200 && d.avg > 0;
    })());
    check("Uptime calc", (() => {
      const now = Date.now();
      const events: { timestamp: number; status: 'up' | 'down' }[] = [
        { timestamp: now - 10000, status: 'up' },
        { timestamp: now - 5000, status: 'down' },
        { timestamp: now - 3000, status: 'up' },
      ];
      return this.calculateUptime(events).uptimePercent > 0;
    })());
    check("Task scheduling", (() => {
      const tasks = [
        { id: 'a', deadline: Date.now() + 60000, priority: 5, duration: 10000 },
        { id: 'b', deadline: Date.now() + 30000, priority: 10, duration: 5000 },
      ];
      const schedule = this.scheduleTask(tasks);
      return schedule.length === 2 && schedule[0].id === 'b';
    })());
    check("Parse relative time", this.parseRelativeTime("5 minutes ago") !== null);
    check("Parse tomorrow", this.parseRelativeTime("tomorrow")! > Date.now());
    check("Format duration", this.formatDuration(3661000) === '1h 1m');
    check("Format short duration", this.formatDuration(500) === '500ms');
    check("Seasonality", this.detectSeasonality([Date.now(), Date.now() + 1000]).hourly.length === 24);
    check("Completion estimate", (() => {
      const now = Date.now();
      const progress = [
        { timestamp: now - 3000, percentComplete: 10 },
        { timestamp: now - 2000, percentComplete: 40 },
        { timestamp: now - 1000, percentComplete: 70 },
      ];
      return this.estimateCompletion(progress).velocity > 0;
    })());

    return { passed, total, details };
  }
}

export const temporalEngine = new SovereignTemporalEngine();
