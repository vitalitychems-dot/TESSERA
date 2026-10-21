import { logger } from "./logger";

interface ProviderStatus {
  name: string;
  available: boolean;
  latency: number;
  lastChecked: number;
}

const providers: ProviderStatus[] = [];

export async function checkLocalProviders(): Promise<ProviderStatus[]> {
  const providerEndpoints = [
    { name: "Pollinations", url: "https://text.pollinations.ai/health" },
    { name: "HuggingFace", url: "https://api-inference.huggingface.co" },
  ];

  for (const endpoint of providerEndpoints) {
    const start = Date.now();
    try {
      const { default: axios } = await import("axios");
      await axios.get(endpoint.url, { timeout: 5000 });
      providers.push({
        name: endpoint.name,
        available: true,
        latency: Date.now() - start,
        lastChecked: Date.now(),
      });
    } catch {
      providers.push({
        name: endpoint.name,
        available: false,
        latency: -1,
        lastChecked: Date.now(),
      });
    }
  }

  const available = providers.filter((p) => p.available).length;
  logger.info("vgpu", `${available}/${providers.length} local providers available`);
  return providers;
}

export function getProviderStatus(): ProviderStatus[] {
  return [...providers];
}
