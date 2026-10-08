import express from "express";
import cookieParser from "cookie-parser";
import adminSessionRouter from "./routes/admin-session";
import tesseraRouter from "./routes/tessera-workspace";
import interactiveStatusRouter from "./routes/interactive-status";
import { requireAdminSession } from "./lib/sovereign-admin";

// Do not import the canonical route inventory here. Some of its transitive
// imports initialize engines or require personal-vault data before app startup.
// The source is preserved for per-module review, not implicitly activated.
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.json({ limit: "64kb" }));

app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
    let originHost = "";
    try { originHost = new URL(req.headers.origin).host; } catch { /* Refuse malformed origins. */ }
    const forwardedHost = String(req.headers["x-forwarded-host"] ?? "").split(",")[0].trim();
    if (!originHost || ![req.headers.host, forwardedHost].includes(originHost)) {
      res.status(403).json({ message: "Cross-origin state changes are not allowed." });
      return;
    }
  }
  const publicPaths = new Set([
    "/admin/session", "/admin/session/status", "/admin/session/logout", "/tessera/launch-status",
  ]);
  // Process status only: no secrets, conversations, vaults or connection data.
  if (["GET", "HEAD"].includes(req.method) && req.path === "/interactive/status") return next();
  if (publicPaths.has(req.path)) return next();
  return requireAdminSession(req, res, next);
});

app.use("/api", adminSessionRouter);
app.use("/api", tesseraRouter);
app.use("/api", interactiveStatusRouter);
app.use("/api", (req, res) => {
  if (req.method === "POST" && (req.path === "/messages" || req.path.startsWith("/messages/"))) {
    res.status(410).json({ message: "Legacy fallback chat is retired. Use Tessera's chamber." });
    return;
  }
  res.status(503).json({
    error: "module-inactive",
    message: "This canonical module is preserved but inactive pending review. Interactive chat and connection checks are available.",
  });
});
app.use((_req, res) => res.status(404).json({ message: "Route not found." }));

export default app;
