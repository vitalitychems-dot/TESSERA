import { Router } from "express";
import { requireAdminSession } from "../lib/sovereign-admin";

const router = Router();
const repositories = new Map([
  ["TESSERA", "vitalitychems-dot/TESSERA"],
  ["Gitbook", "vitalitychems-dot/Gitbook"],
  ["box-backup-2026-10-13", "vitalitychems-dot/box-backup-2026-10-13"],
]);
type Snapshot = { metadata: unknown; events: unknown; fetchedAt: string; stale: boolean };
const cache = new Map<string, Snapshot>();
const inflight = new Map<string, Promise<Snapshot>>();
const failures = new Map<string, number>();
async function snapshot(slug: string): Promise<Snapshot> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "Tessera-Next" };
  // Read only in the running backend; never expose the credential to the browser.
  if (process.env.TESSERA_GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.TESSERA_GITHUB_TOKEN}`;
  const fetchJson = async (suffix: string) => {
    const response = await fetch(`https://api.github.com/repos/${slug}${suffix}`, {
      headers, redirect: "error", signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error("repository-unavailable");
    return response.json();
  };
  const [metadata, events] = await Promise.all([fetchJson(""), fetchJson("/events?per_page=8")]);
  if (!metadata || typeof metadata !== "object" || !Array.isArray(events)) throw new Error("repository-invalid");
  const result = { metadata, events, fetchedAt: new Date().toISOString(), stale: false };
  cache.set(slug, result);
  failures.delete(slug);
  return result;
}
router.get("/world/repositories/:name", requireAdminSession, async (req, res) => {
  const name = typeof req.params.name === "string" ? req.params.name : "";
  const slug = repositories.get(name);
  if (!slug) return res.status(404).json({ ok: false, error: "unknown-repository" });
  res.setHeader("Cache-Control", "private, no-store");
  const cached = cache.get(slug);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < 300_000) return res.json({ ok: true, ...cached });
  if ((failures.get(slug) ?? 0) > Date.now()) {
    return cached ? res.json({ ok: true, ...cached, stale: true }) : res.status(503).json({ ok: false, error: "repository-unavailable" });
  }
  let pending = inflight.get(slug);
  if (!pending) {
    pending = snapshot(slug).finally(() => inflight.delete(slug));
    inflight.set(slug, pending);
  }
  try { return res.json({ ok: true, ...await pending }); }
  catch {
    failures.set(slug, Date.now() + 60_000);
    return cached ? res.json({ ok: true, ...cached, stale: true }) : res.status(503).json({ ok: false, error: "repository-unavailable" });
  }
});
export default router;
