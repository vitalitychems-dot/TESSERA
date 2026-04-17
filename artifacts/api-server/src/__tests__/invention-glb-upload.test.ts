import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { db } from "@workspace/db";
import { inventionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const STUB_OBJECT_PATH = "/objects/uploads/test-glb-object-id";
const STUB_UPLOAD_URL = "https://storage.googleapis.com/fake-signed-url/test-object?X-Goog-Algorithm=GOOG4";

// Test-controlled toggles for ACL behavior. Declared via globalThis so the
// vi.mock factory (which is hoisted above this file's top-level statements)
// can read them lazily at call time.
declare global {
  // eslint-disable-next-line no-var
  var __TEST_ACL_ALLOW: boolean;
  // eslint-disable-next-line no-var
  var __TEST_NEXT_OBJECT_PATH: string | null;
}
globalThis.__TEST_ACL_ALLOW = true;
globalThis.__TEST_NEXT_OBJECT_PATH = null;

vi.mock("../lib/objectStorage", () => {
  class FakeObjectStorageService {
    async getObjectEntityUploadURL() {
      return STUB_UPLOAD_URL;
    }
    normalizeObjectEntityPath(_raw: string) {
      return globalThis.__TEST_NEXT_OBJECT_PATH ?? STUB_OBJECT_PATH;
    }
    async getObjectEntityFile(_p: string) {
      return { name: "stub" } as unknown as object;
    }
    async canAccessObjectEntity(_opts: unknown) {
      return globalThis.__TEST_ACL_ALLOW;
    }
    async trySetObjectEntityAclPolicy(_p: string, policy: { owner: string; visibility: string }) {
      aclState = policy;
      return true;
    }
  }
  return { ObjectStorageService: FakeObjectStorageService };
});

let aclState: { owner: string; visibility: string } | null = null;
vi.mock("../lib/objectAcl", () => {
  return {
    ObjectPermission: { READ: "read", WRITE: "write" },
    getObjectAclPolicy: async () => aclState,
    setObjectAclPolicy: async (_f: unknown, p: { owner: string; visibility: string }) => {
      aclState = p;
    },
  };
});

import { buildInvention3DBlock } from "../lib/invention-3d";
import { parse3DObjectBlocks } from "./helpers/parse3dobj";
import inventionsRouter from "../routes/inventions";

const TEST_INVENTION_ID = "test-glb-e2e-" + Math.random().toString(36).slice(2, 10);
const SECOND_INVENTION_ID = "test-glb-e2e-other-" + Math.random().toString(36).slice(2, 10);

let app: Express;
let server: Server;
let baseUrl: string;

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token", ...headers },
    body: JSON.stringify(body),
  });
}
async function patchJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token", ...headers },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use("/api", inventionsRouter);

  await new Promise<void>((resolve) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no server address");
  baseUrl = `http://127.0.0.1:${addr.port}`;

  await db.insert(inventionsTable).values({
    inventionId: TEST_INVENTION_ID,
    title: "GLB Upload E2E Test Invention",
    description: "Synthetic invention used by the GLB upload e2e test.",
    proposedBy: "tester:alpha",
    customModelUrl: null,
  }).onConflictDoNothing();
  await db.insert(inventionsTable).values({
    inventionId: SECOND_INVENTION_ID,
    title: "Sibling invention for cross-id rejection test",
    description: "Different invention; the first invention's presigned path must NOT attach here.",
    proposedBy: "tester:beta",
    customModelUrl: null,
  }).onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(inventionsTable).where(eq(inventionsTable.inventionId, TEST_INVENTION_ID));
  await db.delete(inventionsTable).where(eq(inventionsTable.inventionId, SECOND_INVENTION_ID));
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  aclState = null;
  globalThis.__TEST_ACL_ALLOW = true;
  globalThis.__TEST_NEXT_OBJECT_PATH = null;
});

describe("GLB upload flow (presign -> PUT -> PATCH -> chat render)", () => {
  it("rejects presign without admin token", async () => {
    const res = await fetch(`${baseUrl}/api/inventions/${TEST_INVENTION_ID}/model/upload-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "model.glb" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects presign for non-glb filename", async () => {
    const res = await postJson(`/api/inventions/${TEST_INVENTION_ID}/model/upload-url`, { name: "model.png" });
    expect(res.status).toBe(400);
  });

  it("end-to-end: presign + simulated PUT + PATCH attaches model and chat block renders custom GLB", async () => {
    // 1. Presign — server mints upload URL and remembers pending upload bound
    //    to (objectPath, inventionId, principal-derived-from-proposedBy).
    const presignRes = await postJson(`/api/inventions/${TEST_INVENTION_ID}/model/upload-url`, {
      name: "rocket.glb",
      contentType: "model/gltf-binary",
    });
    expect(presignRes.status).toBe(200);
    const presign = await presignRes.json() as {
      ok: boolean; uploadURL: string; objectPath: string; inventionId: string; contentType: string;
    };
    expect(presign.ok).toBe(true);
    expect(presign.uploadURL).toBe(STUB_UPLOAD_URL);
    expect(presign.objectPath).toBe(STUB_OBJECT_PATH);
    expect(presign.inventionId).toBe(TEST_INVENTION_ID);
    expect(presign.contentType).toBe("model/gltf-binary");

    // 2. Simulate the client PUT to the signed URL. (We do not actually
    //    contact GCS; the server side never sees this request — its only job
    //    is to mint the URL and to honor the persisted ledger entry on PATCH.
    //    We assert the URL shape so a regression in URL generation is caught.)
    expect(presign.uploadURL).toMatch(/^https?:\/\//);

    // 3. PATCH attach — server consumes the pending entry, applies ACL on
    //    first attach, and persists customModelUrl.
    const patchRes = await patchJson(`/api/inventions/${TEST_INVENTION_ID}/model`, { objectPath: presign.objectPath });
    expect(patchRes.status).toBe(200);
    const patch = await patchRes.json() as { ok: boolean; invention: { customModelUrl: string } };
    expect(patch.ok).toBe(true);
    expect(patch.invention.customModelUrl).toBe(presign.objectPath);

    // 4. DB confirms the persisted attach (defends against the route
    //    returning a stale row).
    const [row] = await db.select().from(inventionsTable).where(eq(inventionsTable.inventionId, TEST_INVENTION_ID));
    expect(row.customModelUrl).toBe(presign.objectPath);

    // 5. ACL was stamped at first attach with proposer-derived principal +
    //    public visibility.
    expect(aclState).not.toBeNull();
    expect(aclState!.visibility).toBe("public");
    expect(aclState!.owner).toMatch(/^proposer:/);

    // 6. Chat render — buildInvention3DBlock must emit the CUSTOM model
    //    token with the persisted src, NOT a fallback primitive.
    const block = buildInvention3DBlock({
      title: row.title,
      category: row.category,
      description: row.description,
      materials: row.materials,
      scienceBehind: row.scienceBehind,
      customModelUrl: row.customModelUrl,
    });
    expect(block).toContain('type="custom"');
    expect(block).toContain(`src="${presign.objectPath}"`);

    // 7. The client-side parser actually produces a custom 3D spec from the
    //    block (so the renderer will mount CustomGLTFModel, not a primitive).
    const parsed = parse3DObjectBlocks(block);
    expect(parsed.objects.length).toBe(1);
    expect(parsed.objects[0].type).toBe("custom");
    expect(parsed.objects[0].src).toBe(presign.objectPath);
  });

  it("PATCH replays / cross-id attach are rejected", async () => {
    // Mint a fresh presign for TEST_INVENTION_ID
    const presignRes = await postJson(`/api/inventions/${TEST_INVENTION_ID}/model/upload-url`, { name: "drone.glb" });
    const presign = await presignRes.json() as { ok: boolean; objectPath: string };
    expect(presign.ok).toBe(true);

    // Try to attach the SAME path to a DIFFERENT invention — must 403.
    const wrongRes = await patchJson(`/api/inventions/${SECOND_INVENTION_ID}/model`, { objectPath: presign.objectPath });
    expect(wrongRes.status).toBe(403);

    // Correct invention still works once.
    const okRes = await patchJson(`/api/inventions/${TEST_INVENTION_ID}/model`, { objectPath: presign.objectPath });
    expect(okRes.status).toBe(200);

    // Replay (same path, same invention, after consume) — must 403.
    const replayRes = await patchJson(`/api/inventions/${TEST_INVENTION_ID}/model`, { objectPath: presign.objectPath });
    expect(replayRes.status).toBe(403);
  });

  it("ACL deny path: existing policy + canAccessObjectEntity=false rejects with 403 and does NOT change customModelUrl", async () => {
    // Snapshot the persisted customModelUrl before the attempt.
    const [pre] = await db.select().from(inventionsTable).where(eq(inventionsTable.inventionId, TEST_INVENTION_ID));
    const prevModelUrl = pre.customModelUrl;

    // Use a fresh path so the pending-upload ledger has a valid entry, then
    // simulate an ALREADY-OWNED object (existing ACL policy) where the
    // caller is NOT authorized to write — the route must reject 403 and the
    // DB row must remain unchanged.
    const freshPath = "/objects/uploads/acl-deny-" + Math.random().toString(36).slice(2, 10);
    globalThis.__TEST_NEXT_OBJECT_PATH = freshPath;
    aclState = { owner: "proposer:someone-else", visibility: "public" };
    globalThis.__TEST_ACL_ALLOW = false;

    const presignRes = await postJson(`/api/inventions/${TEST_INVENTION_ID}/model/upload-url`, { name: "denied.glb" });
    const presign = await presignRes.json() as { ok: boolean; objectPath: string };
    expect(presign.ok).toBe(true);
    expect(presign.objectPath).toBe(freshPath);

    const denyRes = await patchJson(`/api/inventions/${TEST_INVENTION_ID}/model`, { objectPath: presign.objectPath });
    expect(denyRes.status).toBe(403);
    const denyBody = await denyRes.json() as { ok: boolean; error: string };
    expect(denyBody.ok).toBe(false);
    expect(denyBody.error).toMatch(/own this object|ACL/i);

    const [post] = await db.select().from(inventionsTable).where(eq(inventionsTable.inventionId, TEST_INVENTION_ID));
    expect(post.customModelUrl).toBe(prevModelUrl);
  });

  it("ACL allow path with existing policy: WRITE-authorized caller succeeds without re-stamping ACL", async () => {
    const freshPath = "/objects/uploads/acl-allow-" + Math.random().toString(36).slice(2, 10);
    globalThis.__TEST_NEXT_OBJECT_PATH = freshPath;
    const existingOwner = "proposer:" + "a".repeat(32);
    aclState = { owner: existingOwner, visibility: "public" };
    globalThis.__TEST_ACL_ALLOW = true;

    const presignRes = await postJson(`/api/inventions/${TEST_INVENTION_ID}/model/upload-url`, { name: "allowed.glb" });
    const presign = await presignRes.json() as { ok: boolean; objectPath: string };
    expect(presign.ok).toBe(true);

    const okRes = await patchJson(`/api/inventions/${TEST_INVENTION_ID}/model`, { objectPath: presign.objectPath });
    expect(okRes.status).toBe(200);

    // Existing ACL must NOT be overwritten when policy already exists.
    expect(aclState!.owner).toBe(existingOwner);

    const [row] = await db.select().from(inventionsTable).where(eq(inventionsTable.inventionId, TEST_INVENTION_ID));
    expect(row.customModelUrl).toBe(presign.objectPath);
  });

  it("PATCH rejects unsafe object paths", async () => {
    const cases = [
      "/objects/../etc/passwd",
      "/uploads/foo.glb",
      "/objects/has space.glb",
      "/objects//double-slash.glb",
    ];
    for (const bad of cases) {
      const res = await patchJson(`/api/inventions/${TEST_INVENTION_ID}/model`, { objectPath: bad });
      expect(res.status, `path ${bad} should be rejected`).toBe(400);
    }
  });
});
