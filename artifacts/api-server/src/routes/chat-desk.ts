import { Router } from "express";
import { listDesk, listLessons, runChatDesk, trainingCount } from "../lib/chat-collab";

const router = Router();

router.get("/chat/desk", (_req, res) => {
  return res.json({
    ok: true,
    members: listDesk(),
    available: listDesk().filter((member) => member.available).map((member) => member.name),
    lessons: trainingCount(),
  });
});

router.get("/chat/desk/lessons", (_req, res) => {
  return res.json({ ok: true, lessons: listLessons() });
});

router.post("/chat/desk", (req, res) => {
  const prompt = String(req.body?.prompt || "");
  if (!prompt.trim()) return res.status(400).json({ ok: false, error: "prompt required" });
  const turn = runChatDesk(prompt);
  if (!turn) return res.status(400).json({ ok: false, error: "Not a desk prompt. Use @Name, collab, or train:." });
  return res.json({ ok: true, ...turn });
});

export default router;
