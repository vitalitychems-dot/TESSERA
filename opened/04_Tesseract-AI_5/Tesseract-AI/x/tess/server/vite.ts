import { type Express } from "express";
import { createServer as createViteServer, createLogger, type ViteDevServer } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

let viteInstance: ViteDevServer | null = null;

export async function createViteMiddleware(server: Server): Promise<ViteDevServer> {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  viteInstance = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  return viteInstance;
}

export function mountViteMiddleware(app: Express, vite: ViteDevServer) {
  app.use(vite.middlewares);
}

export function mountViteCatchAll(app: Express, vite: ViteDevServer) {
  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    if (url.startsWith("/api/") || url.startsWith("/workspace-api/")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export async function setupVite(server: Server, app: Express) {
  const vite = await createViteMiddleware(server);
  mountViteMiddleware(app, vite);
  mountViteCatchAll(app, vite);
}
