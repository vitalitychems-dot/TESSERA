import type { Express, Request, Response } from "express";

export function registerDevStudioRoutes(app: Express, storage: any, sessionFns: {
  getSessionState: (id: number) => any;
  createAndStartSession: (id: number, goal: string) => Promise<void>;
  pauseSession: (id: number) => boolean;
  resumeSession: (id: number) => boolean;
  cancelSession: (id: number) => boolean;
  registerSSEClient: (id: number, res: Response) => void;
  readSessionFile: (id: number, path: string) => string | null;
  acceptDiff: (id: number, filePath: string) => boolean;
  rejectDiff: (id: number, filePath: string) => boolean;
}) {
  const { getSessionState, createAndStartSession, pauseSession, resumeSession, cancelSession, registerSSEClient, readSessionFile, acceptDiff, rejectDiff } = sessionFns;

  app.get("/api/dev-studio/projects", async (_req, res) => {
    try {
      const projects = await storage.getDevProjects();
      res.json({ projects });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/dev-studio/projects", async (req, res) => {
    try {
      const { goal, name } = req.body;
      if (!goal) return res.status(400).json({ error: "goal required" });
      const projectName = name || goal.slice(0, 60);
      const workDir = `/tmp/dev-sessions/proj-${Date.now()}`;
      const project = await storage.createDevProject({
        goal,
        name: projectName,
        status: "planning",
        agentRole: "fullstack",
        workDir,
        previewPort: null,
      });
      res.json({ project });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dev-studio/projects/:id", async (req, res) => {
    try {
      const project = await storage.getDevProject(parseInt(req.params.id));
      if (!project) return res.status(404).json({ error: "Not found" });
      const session = getSessionState(project.id);
      res.json({ project, session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/dev-studio/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      cancelSession(id);
      await storage.deleteDevProject(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/dev-studio/projects/:id/start", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getDevProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      await createAndStartSession(id, project.goal);
      res.json({ ok: true, message: "Session started" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/dev-studio/projects/:id/pause", async (req, res) => {
    res.json({ ok: pauseSession(parseInt(req.params.id)) });
  });

  app.post("/api/dev-studio/projects/:id/resume", async (req, res) => {
    res.json({ ok: resumeSession(parseInt(req.params.id)) });
  });

  app.post("/api/dev-studio/projects/:id/cancel", async (req, res) => {
    res.json({ ok: cancelSession(parseInt(req.params.id)) });
  });

  app.get("/api/dev-studio/projects/:id/state", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getDevProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const session = getSessionState(id);
      const dbSession = await storage.getDevSessionByProject(id);
      res.json({ project, session, dbSession });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dev-studio/projects/:id/stream", (req, res) => {
    const id = parseInt(req.params.id);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();
    registerSSEClient(id, res);
    const state = getSessionState(id);
    res.write(`data: ${JSON.stringify({ type: "init", session: state })}\n\n`);
    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 25000);
    req.on("close", () => clearInterval(ping));
  });

  app.get("/api/dev-studio/projects/:id/files", async (req, res) => {
    try {
      const state = getSessionState(parseInt(req.params.id));
      res.json({ files: state.files });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/dev-studio/projects/:id/file", async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ error: "path query required" });
      const content = readSessionFile(parseInt(req.params.id), filePath);
      if (content === null) return res.status(404).json({ error: "File not found" });
      res.json({ content, path: filePath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/dev-studio/projects/:id/diff/accept", async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: "filePath required" });
    res.json({ ok: acceptDiff(parseInt(req.params.id), filePath) });
  });

  app.post("/api/dev-studio/projects/:id/diff/reject", async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: "filePath required" });
    res.json({ ok: rejectDiff(parseInt(req.params.id), filePath) });
  });

  app.get("/api/dev-studio/projects/:id/logs", async (req, res) => {
    try {
      const dbSession = await storage.getDevSessionByProject(parseInt(req.params.id));
      res.json({ logs: dbSession?.logs || "" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("[DevStudioRoutes] 15 dev-studio routes registered");
}
