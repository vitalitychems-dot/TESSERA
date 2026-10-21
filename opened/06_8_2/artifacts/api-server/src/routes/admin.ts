import { Router } from "express";
import crypto from "crypto";

const router = Router();

const TOKEN_MAP = new Map<string, number>();
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function validateToken(token: string): boolean {
  const ts = TOKEN_MAP.get(token);
  if (!ts) return false;
  if (Date.now() - ts > TOKEN_TTL_MS) {
    TOKEN_MAP.delete(token);
    return false;
  }
  return true;
}

router.post("/admin/auth", (req, res) => {
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  const { key } = req.body as { key?: string };

  if (!adminKey) {
    res.status(503).json({ authenticated: false, error: "TESSERACT_ADMIN_KEY is not configured" });
    return;
  }

  if (!key || typeof key !== "string") {
    res.status(400).json({ authenticated: false, error: "key is required" });
    return;
  }

  try {
    const a = Buffer.from(key.trim(), "utf-8");
    const b = Buffer.from(adminKey.trim(), "utf-8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      const token = generateToken();
      TOKEN_MAP.set(token, Date.now());
      res.json({ authenticated: true, token });
      return;
    }
  } catch {}

  res.status(403).json({ authenticated: false, error: "Invalid sovereign key" });
});

router.get("/admin/status", (req, res) => {
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  const provided =
    (req.headers["x-admin-token"] as string) ||
    (req.headers["x-admin-key"] as string) ||
    (req.headers["authorization"] as string)?.replace(/^Bearer\s+/i, "");

  const configured = !!adminKey;

  if (!provided || !validateToken(provided)) {
    res.json({ isAdmin: false, configured });
    return;
  }

  res.json({ isAdmin: true, configured });
});

router.post("/auth/reset-lockout", (_req, res) => {
  res.json({ success: true });
});

export default router;
