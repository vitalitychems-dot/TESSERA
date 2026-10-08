import { Router } from "express";

const router = Router();

// Keep this route intentionally independent of canonical engines, private
// stores, external providers, and databases. It is public read-only process
// status; all private chat and connection routes still require owner sessions.
router.get("/interactive/status", (_req, res) => {
  res.json({
    service: "Tessera interactive API",
    checkedAt: new Date().toISOString(),
    runtime: {
      status: "online",
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
    },
    modules: {
      runtimeStatus: {
        state: "active",
        source: "This interactive API process",
      },
      canonicalModules: {
        state: "inactive",
        reason:
          "Canonical modules remain unloaded until individually reviewed and explicitly activated.",
      },
      personalChartVault: {
        state: "disabled",
        reason:
          "Private chart and vault modules are not loaded without explicit authorization.",
      },
      autonomousEngines: {
        state: "disabled",
        reason:
          "No autonomous engines, schedulers, or background activity are started by this interactive API.",
      },
    },
  });
});

export default router;
