import { Router } from "express";
import type { Express } from "express";

const domainRouters: { name: string; path: string; router: Router }[] = [];

export function registerDomainRouter(name: string, basePath: string, router: Router) {
  domainRouters.push({ name, path: basePath, router });
}

export function mountAllDomainRouters(app: Express) {
  let mounted = 0;
  for (const { name, path, router } of domainRouters) {
    try {
      app.use(path, router);
      mounted++;
    } catch (e: any) {
      console.error(`[DomainRouter] Failed to mount ${name}: ${e?.message}`);
    }
  }
  console.log(`[DomainRouter] ${mounted}/${domainRouters.length} domain routers mounted`);
  return mounted;
}

export function getDomainRouterStats() {
  return {
    total: domainRouters.length,
    routers: domainRouters.map((r) => ({ name: r.name, path: r.path })),
  };
}

export { registerSelfCodeRoutes } from "./self-code";
export { registerDevStudioRoutes } from "./dev-studio";
export { registerMarketplaceRoutes } from "./marketplace";
export { registerConferenceRoutes } from "./conferences";
export { registerWorldGovernanceRoutes } from "./world-governance";
export { registerRealificationRoutes } from "./realification";
export { registerIntelligenceSystemsRoutes } from "./intelligence-systems";
export { registerLegacyAgentRoutes } from "./legacy-agents";
export { registerPhoenixMeshRoutes } from "./phoenix-mesh";
