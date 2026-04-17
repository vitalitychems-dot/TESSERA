import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const RequestUploadUrlBody = z.object({
  name: z.string().min(1).max(256),
  size: z.number().int().nonnegative().optional(),
  contentType: z.string().min(1).max(128).optional(),
});

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  // Gate: require an admin token to mint signed upload URLs (prevents
  // unauthenticated callers from generating arbitrary writes / cost abuse).
  const token = (req.headers["x-admin-token"] as string | undefined)?.trim();
  if (!token || token.length < 8) {
    res.status(401).json({ error: "Admin token required to mint upload URLs" });
    return;
  }
  const configured = process.env["SOVEREIGN_ADMIN_TOKEN"];
  if (configured && configured.length >= 8) {
    const { validateSovereignAdminToken } = await import("../lib/mesh-auth");
    if (!validateSovereignAdminToken(token)) {
      res.status(401).json({ error: "Invalid admin token" });
      return;
    }
  }
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }
  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = (req.params as Record<string, string | string[]>).path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    // ACL gate (READ): canAccessObjectEntity returns true only if the object
    // has a stored ObjectAclPolicy whose visibility is "public". Objects
    // uploaded without a policy (or with visibility="private") are
    // unreadable here. Inventor-uploaded invention models intentionally get
    // visibility="public" stamped by inventions.ts on attach so they can be
    // embedded in chat; everything else (general /storage uploads with no
    // policy) is rejected. We do NOT trust any client-supplied userId
    // header for owner/group rule evaluation.
    const allowed = await objectStorageService.canAccessObjectEntity({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!allowed) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = (req.params as Record<string, string | string[]>).filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

export default router;
