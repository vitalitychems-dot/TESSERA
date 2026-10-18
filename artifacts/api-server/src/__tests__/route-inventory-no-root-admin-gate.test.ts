import { afterAll, describe, expect, it } from "vitest";
import express, { Router, type Request, type Response } from "express";
import { requireAdminSession } from "../lib/sovereign-admin";
import { stopAutonomousRotation } from "../lib/sovereign-cipher";
import { stopBandRotationScheduler } from "../lib/lattice-frequency-bands";
import apiRouter from "../routes/index";
import { listPathlessRootAdminSessionGates } from "./route-inventory";

type MountedLayer = {
  handle?: unknown;
  slash?: boolean;
};

function finish(_req: Request, res: Response): void {
  res.end();
}

describe("route inventory rejects a path-less admin gate at the API root", () => {
  afterAll(() => {
    stopAutonomousRotation();
    stopBandRotationScheduler();
  });

  it("flags a deliberately injected path-less requireAdminSession", () => {
    const injected = Router();
    injected.use(requireAdminSession);

    expect(listPathlessRootAdminSessionGates(injected, requireAdminSession)).toEqual([
      { name: "requireAdminSession", stackIndexes: [0] },
    ]);

    const explicitRoot = Router();
    explicitRoot.use("/", requireAdminSession);
    expect(listPathlessRootAdminSessionGates(explicitRoot, requireAdminSession)).toEqual([
      { name: "requireAdminSession", stackIndexes: [0] },
    ]);

    const inner = Router();
    inner.use(requireAdminSession);
    const outer = Router();
    outer.use(inner);
    expect(listPathlessRootAdminSessionGates(outer, requireAdminSession)).toEqual([
      { name: "requireAdminSession", stackIndexes: [0, 0] },
    ]);
  });

  it("allows path-scoped mounts and per-route gates", () => {
    const scoped = Router();
    scoped.use("/sovereign-language", requireAdminSession);
    scoped.get("/admin/surface", requireAdminSession, finish);
    expect(listPathlessRootAdminSessionGates(scoped, requireAdminSession)).toEqual([]);

    const gatedSubtree = Router();
    gatedSubtree.use(requireAdminSession);
    const prefixed = Router();
    prefixed.use("/admin", gatedSubtree);
    expect(listPathlessRootAdminSessionGates(prefixed, requireAdminSession)).toEqual([]);
  });

  it("mounts routes/index and finds no path-less requireAdminSession at the API root", () => {
    const app = express();
    app.use("/api", apiRouter);

    const appRouter = (app as unknown as { router: { stack?: MountedLayer[] } }).router;
    const mounted = appRouter.stack?.find((layer) => layer.handle === apiRouter);
    expect(mounted).toBeDefined();
    expect(mounted?.slash).toBe(false);
    expect(Array.isArray((apiRouter as { stack?: unknown }).stack)).toBe(true);
    expect((apiRouter as { stack: unknown[] }).stack.length).toBeGreaterThan(0);

    expect(listPathlessRootAdminSessionGates(apiRouter, requireAdminSession)).toEqual([]);
  });
});
