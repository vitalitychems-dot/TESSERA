import { Router, type Request, type Response } from "express";
import { getProviderRegistryStatus, providerReverseEngineer } from "../lib/provider-registry";
import { localModelManager } from "../lib/local-model-manager";
import { webScraper, getIngestionStatus, runIngestionCycle } from "../lib/data-ingestion-engine";
import { swarmCoordinator, metaAgent, getSwarmCoordinatorStatus } from "../lib/swarm-coordinator";
import { runAGIBenchmark, getAGIEvaluationStatus } from "../lib/agi-evaluation-framework";
import { getSovereigntyMonitorStatus, runSovereigntyMonitorCycle, recordTask, executeDisconnect, getDisconnectLog } from "../lib/sovereignty-monitor";
import { queryProvidersParallel, getCacheStats, clearCache } from "../lib/parallel-provider-cache";
import { sovereignGraph, getGeometryGraphStatus } from "../lib/geometry-graph";

const router = Router();

router.get("/sovereign/providers", (_req: Request, res: Response): void => {
  void (async () => {
    try {
      res.json({ status: "ok", data: getProviderRegistryStatus() });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.post("/sovereign/providers/probe", (req: Request, res: Response): void => {
  void (async () => {
    try {
      const { providerId } = (req.body ?? {}) as { providerId?: string };
      let profiles;
      if (providerId) {
        const profile = await providerReverseEngineer.probeOne(providerId);
        profiles = profile ? [profile] : [];
      } else {
        profiles = await providerReverseEngineer.probeAll();
      }
      res.json({ status: "ok", data: { profiles, probeCount: profiles.length } });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.get("/sovereign/local-model", (_req: Request, res: Response): void => {
  void (async () => {
    try {
      const status = localModelManager.getStatus();
      const available = await localModelManager.checkAvailability();
      res.json({ status: "ok", data: { ...status, available } });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.post("/sovereign/local-model/generate", (req: Request, res: Response): void => {
  void (async () => {
    try {
      const { prompt, maxTokens, temperature, systemPrompt } = (req.body ?? {}) as {
        prompt?: string; maxTokens?: number; temperature?: number; systemPrompt?: string;
      };
      if (!prompt) {
        res.status(400).json({ status: "error", message: "prompt is required" });
        return;
      }
      const result = await localModelManager.generate(prompt, { maxTokens, temperature, systemPrompt });
      if (!result) {
        res.status(503).json({ status: "error", message: "Local model unavailable" });
        return;
      }
      res.json({ status: "ok", data: result });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.get("/sovereign/ingestion", (_req: Request, res: Response): void => {
  try {
    res.json({ status: "ok", data: getIngestionStatus() });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.post("/sovereign/ingestion/cycle", (_req: Request, res: Response): void => {
  void (async () => {
    try {
      const result = await runIngestionCycle();
      res.json({ status: "ok", data: result });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.post("/sovereign/ingestion/scrape", (req: Request, res: Response): void => {
  void (async () => {
    try {
      const { urls } = (req.body ?? {}) as { urls?: string[] };
      if (!Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({ status: "error", message: "urls array is required" });
        return;
      }

      const ALLOWED_SCHEMES = new Set(["https:", "http:"]);
      const BLOCKED_HOSTS = new Set([
        "localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal",
        "169.254.169.254", "metadata", "instance-data",
      ]);
      const isPrivateIP = (host: string): boolean => {
        const parts = host.split(".").map(Number);
        if (parts.length !== 4 || parts.some(p => isNaN(p))) return false;
        return (parts[0] === 10) ||
          (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          (parts[0] === 169 && parts[1] === 254) ||
          (parts[0] === 0);
      };

      const sanitized: string[] = [];
      for (const raw of urls.slice(0, 10)) {
        try {
          const u = new URL(raw);
          if (!ALLOWED_SCHEMES.has(u.protocol)) continue;
          if (BLOCKED_HOSTS.has(u.hostname.toLowerCase())) continue;
          if (isPrivateIP(u.hostname)) continue;
          sanitized.push(raw);
        } catch {
          continue;
        }
      }
      if (sanitized.length === 0) {
        res.status(400).json({ status: "error", message: "No valid public URLs provided" });
        return;
      }
      const result = await webScraper.scrapeUrls(sanitized);
      res.json({ status: "ok", data: result });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.get("/sovereign/swarm", (_req: Request, res: Response): void => {
  try {
    res.json({ status: "ok", data: getSwarmCoordinatorStatus() });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.post("/sovereign/swarm/execute", (req: Request, res: Response): void => {
  void (async () => {
    try {
      const { task, maxAgents, timeoutMs } = (req.body ?? {}) as { task?: string; maxAgents?: number; timeoutMs?: number };
      if (!task) {
        res.status(400).json({ status: "error", message: "task is required" });
        return;
      }
      const result = await swarmCoordinator.executeTask(task, { maxAgents, timeoutMs });
      res.json({ status: "ok", data: result });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.post("/sovereign/swarm/review", (req: Request, res: Response): void => {
  void (async () => {
    try {
      const { proposals } = (req.body ?? {}) as { proposals?: unknown[] };
      if (!Array.isArray(proposals) || proposals.length === 0) {
        res.status(400).json({ status: "error", message: "proposals array is required" });
        return;
      }
      const review = await metaAgent.reviewProposals(proposals as Parameters<typeof metaAgent.reviewProposals>[0]);
      res.json({ status: "ok", data: review });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.post("/sovereign/swarm/score", (req: Request, res: Response): void => {
  try {
    const { output } = (req.body ?? {}) as { output?: string };
    if (!output) {
      res.status(400).json({ status: "error", message: "output is required" });
      return;
    }
    const score = metaAgent.scoreReasoning(output);
    res.json({ status: "ok", data: score });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.get("/sovereign/agi-eval", (_req: Request, res: Response): void => {
  try {
    res.json({ status: "ok", data: getAGIEvaluationStatus() });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.post("/sovereign/agi-eval/benchmark", (req: Request, res: Response): void => {
  void (async () => {
    try {
      const { domains, taskCount } = (req.body ?? {}) as { domains?: string[]; taskCount?: number };
      const result = await runAGIBenchmark({ domains, taskCount });
      res.json({ status: "ok", data: result });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.get("/sovereign/monitor", (_req: Request, res: Response): void => {
  try {
    res.json({ status: "ok", data: getSovereigntyMonitorStatus() });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.post("/sovereign/monitor/cycle", (_req: Request, res: Response): void => {
  void (async () => {
    try {
      const result = await runSovereigntyMonitorCycle();
      res.json({ status: "ok", data: result });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.post("/sovereign/monitor/record-task", (req: Request, res: Response): void => {
  try {
    const { taskType, handledInternally, providerId, successRate, latencyMs } = (req.body ?? {}) as {
      taskType?: string; handledInternally?: boolean; providerId?: string; successRate?: number; latencyMs?: number;
    };
    if (!taskType) {
      res.status(400).json({ status: "error", message: "taskType is required" });
      return;
    }
    recordTask({ taskType, handledInternally: !!handledInternally, providerId, successRate, latencyMs });
    res.json({ status: "ok" });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.post("/sovereign/monitor/disconnect", (req: Request, res: Response): void => {
  void (async () => {
    try {
      const { phase, dryRun, force } = (req.body ?? {}) as { phase?: number; dryRun?: boolean; force?: boolean };
      const result = await executeDisconnect({ phase, dryRun, force });
      res.json({ status: "ok", data: result });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.get("/sovereign/monitor/disconnect-log", (_req: Request, res: Response): void => {
  try {
    res.json({ status: "ok", data: getDisconnectLog() });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.post("/sovereign/parallel-query", (req: Request, res: Response): void => {
  void (async () => {
    try {
      const { prompt, maxTokens, useCache, providerIds, selectBest } = (req.body ?? {}) as {
        prompt?: string; maxTokens?: number; useCache?: boolean; providerIds?: string[]; selectBest?: boolean;
      };
      if (!prompt) {
        res.status(400).json({ status: "error", message: "prompt is required" });
        return;
      }
      const result = await queryProvidersParallel({ prompt, maxTokens, useCache, providerIds, selectBest });
      res.json({ status: "ok", data: result });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message });
    }
  })();
});

router.get("/sovereign/cache", (_req: Request, res: Response): void => {
  try {
    res.json({ status: "ok", data: getCacheStats() });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.delete("/sovereign/cache", (req: Request, res: Response): void => {
  try {
    const { pattern } = req.query as { pattern?: string };
    const count = clearCache(pattern);
    res.json({ status: "ok", data: { cleared: count } });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.get("/sovereign/geometry", (_req: Request, res: Response): void => {
  try {
    res.json({ status: "ok", data: getGeometryGraphStatus() });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.get("/sovereign/geometry/export", (_req: Request, res: Response): void => {
  try {
    const graphExport = sovereignGraph.exportJSON();
    res.json({ status: "ok", data: graphExport });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.post("/sovereign/geometry/path", (req: Request, res: Response): void => {
  try {
    const { fromId, toId, metric, loadBalanced } = (req.body ?? {}) as {
      fromId?: string; toId?: string; metric?: "latency" | "weight" | "reliability"; loadBalanced?: boolean;
    };
    if (!fromId || !toId) {
      res.status(400).json({ status: "error", message: "fromId and toId are required" });
      return;
    }
    const path = loadBalanced
      ? sovereignGraph.loadBalancedPath(fromId, toId)
      : sovereignGraph.shortestPath(fromId, toId, metric);
    res.json({ status: "ok", data: { path, fromId, toId, metric: metric ?? "latency" } });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

router.post("/sovereign/geometry/node", (req: Request, res: Response): void => {
  try {
    const { id, type, label, load, maxLoad, latencyMs, reliability, metadata } = (req.body ?? {}) as {
      id?: string; type?: string; label?: string; load?: number; maxLoad?: number;
      latencyMs?: number; reliability?: number; metadata?: Record<string, unknown>;
    };
    if (!id || !type || !label) {
      res.status(400).json({ status: "error", message: "id, type, label are required" });
      return;
    }
    sovereignGraph.addNode({
      id, type: type as import("../lib/geometry-graph").NodeType, label,
      load: load ?? 0,
      maxLoad: maxLoad ?? 100,
      latencyMs: latencyMs ?? 10,
      reliability: reliability ?? 0.95,
      metadata: metadata ?? {},
    });
    res.json({ status: "ok", data: { added: id } });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err?.message });
  }
});

export default router;
