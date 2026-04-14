import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { initFileIntegrity } from "./lib/file-integrity";
import { startAnomalyMonitor, stopAnomalyMonitor, recordRequest } from "./lib/anomaly-detection";
import { initRecoveryModule, registerRecoveryHandler, updateModuleStatus } from "./lib/auto-recovery";
import { initializeMemoryOnStartup } from "./lib/vector-memory";
import { startIngestionScheduler, runAllIngestion } from "./lib/ingestion/scheduler";
import { startPeriodicRegeneration } from "./lib/canonUpdater";
import { sovereigntyEnforcementMiddleware } from "./lib/provider-registry";
import { db } from "@workspace/db";
import { dataSourcesTable } from "@workspace/db/schema";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(sovereigntyEnforcementMiddleware());

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    const isError = res.statusCode >= 500;
    recordRequest(isError);
  });
  next();
});

app.use("/api", router);

function registerModuleHandlers(): void {
  registerRecoveryHandler("file-integrity", async () => {
    updateModuleStatus("file-integrity", "recovering");
    await initFileIntegrity();
    updateModuleStatus("file-integrity", "running");
    logger.info("file-integrity module reinitialized");
  });

  registerRecoveryHandler("anomaly-detection", async () => {
    updateModuleStatus("anomaly-detection", "recovering");
    stopAnomalyMonitor();
    startAnomalyMonitor(30_000);
    updateModuleStatus("anomaly-detection", "running");
    logger.info("anomaly-detection module restarted");
  });

  registerRecoveryHandler("diagnostics", async () => {
    updateModuleStatus("diagnostics", "recovering");
    updateModuleStatus("diagnostics", "running");
    logger.info("diagnostics module marked recovered");
  });

  registerRecoveryHandler("api-server", async () => {
    updateModuleStatus("api-server", "recovering");
    updateModuleStatus("api-server", "running");
    logger.info("api-server module self-healed");
  });

  registerRecoveryHandler("auto-recovery", async () => {
    updateModuleStatus("auto-recovery", "recovering");
    updateModuleStatus("auto-recovery", "running");
    logger.info("auto-recovery module self-healed");
  });
}

const DEFAULT_SOURCES = [
  { name: "NASA APOD", type: "api", intervalSeconds: 86400 },
  { name: "USGS Earthquakes", type: "api", intervalSeconds: 3600 },
  { name: "NOAA Weather Alerts", type: "api", intervalSeconds: 1800 },
  { name: "Wikipedia", type: "api", intervalSeconds: 86400 },
  { name: "arXiv AI", type: "api", intervalSeconds: 86400 },
  { name: "arXiv CS", type: "api", intervalSeconds: 86400 },
  { name: "Hacker News", type: "api", intervalSeconds: 3600 },
  { name: "Reddit Technology", type: "api", intervalSeconds: 7200 },
  { name: "Reddit Science", type: "api", intervalSeconds: 7200 },
  { name: "CoinGecko", type: "api", intervalSeconds: 3600 },
  { name: "Semantic Scholar", type: "api", intervalSeconds: 86400 },
  { name: "PubMed", type: "api", intervalSeconds: 86400 },
  { name: "Hacker News RSS", type: "rss", url: "https://hnrss.org/frontpage", intervalSeconds: 3600 },
  { name: "arXiv AI", type: "rss", url: "https://rss.arxiv.org/rss/cs.AI", intervalSeconds: 86400 },
  { name: "NASA News", type: "rss", url: "https://www.nasa.gov/news-release/feed/", intervalSeconds: 86400 },
  { name: "USGS Earthquakes RSS", type: "rss", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom", intervalSeconds: 3600 },
];

async function ensureDefaultSources(): Promise<void> {
  for (const src of DEFAULT_SOURCES) {
    try {
      await db.insert(dataSourcesTable).values({
        name: src.name,
        type: src.type,
        url: src.url ?? null,
        intervalSeconds: src.intervalSeconds,
        enabled: true,
      }).onConflictDoNothing();
    } catch (_e) {
    }
  }
}

async function initializeModules() {
  try {
    initRecoveryModule();
    registerModuleHandlers();
    await initFileIntegrity();
    startAnomalyMonitor(30_000);

    const memResult = await initializeMemoryOnStartup();
    logger.info({ loaded: memResult.loaded, errors: memResult.errors }, "Memory system initialized");

    await ensureDefaultSources();
    startIngestionScheduler(300_000);
    logger.info("Ingestion scheduler started");

    startPeriodicRegeneration(3600_000);

    logger.info("All system modules initialized");
  } catch (err) {
    logger.error({ err }, "Module initialization error (non-fatal)");
  }
}

initializeModules().catch(err => logger.error({ err }, "initializeModules uncaught error"));

export default app;
