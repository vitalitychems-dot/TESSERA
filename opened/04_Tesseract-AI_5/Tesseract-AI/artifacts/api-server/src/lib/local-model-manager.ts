import { providerRegistry, type ProviderConfig } from "./provider-registry";
import { logger } from "./logger";

const LOG_PREFIX = "[LocalModelManager]";

export interface LocalModelStatus {
  available: boolean;
  endpoint: string;
  model: string;
  responseTimeMs: number;
  lastChecked: number;
  error?: string;
}

export interface LocalModelResponse {
  content: string;
  model: string;
  latencyMs: number;
  provider: "local" | "external";
  providerId: string;
}

let localModelStatus: LocalModelStatus = {
  available: false,
  endpoint: "",
  model: "",
  responseTimeMs: 0,
  lastChecked: 0,
};

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export class LocalModelManager {
  private localProviders: ProviderConfig[];

  constructor() {
    this.localProviders = providerRegistry.getLocal();
  }

  async checkAvailability(): Promise<boolean> {
    const now = Date.now();
    if (now - localModelStatus.lastChecked < CHECK_INTERVAL_MS && localModelStatus.lastChecked > 0) {
      return localModelStatus.available;
    }

    this.localProviders = providerRegistry.getLocal();

    for (const provider of this.localProviders) {
      try {
        const start = Date.now();
        const resp = await fetch(`${provider.endpoint}/api/tags`, {
          signal: AbortSignal.timeout(3000),
        });
        const latency = Date.now() - start;
        if (resp.ok) {
          localModelStatus = {
            available: true,
            endpoint: provider.endpoint,
            model: provider.model,
            responseTimeMs: latency,
            lastChecked: now,
          };
          console.log(`${LOG_PREFIX} Local model available: ${provider.name} at ${provider.endpoint} (${latency}ms)`);
          return true;
        }
      } catch {
      }
    }

    localModelStatus = {
      available: false,
      endpoint: this.localProviders[0]?.endpoint ?? "",
      model: this.localProviders[0]?.model ?? "",
      responseTimeMs: 0,
      lastChecked: now,
      error: "No local model endpoints reachable",
    };

    return false;
  }

  async generate(prompt: string, options: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}): Promise<LocalModelResponse | null> {
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) return null;

    const provider = this.localProviders.find(p => p.endpoint === localModelStatus.endpoint);
    if (!provider) return null;

    const start = Date.now();

    try {
      if (provider.type === "ollama") {
        const body: Record<string, unknown> = {
          model: provider.model,
          prompt: options.systemPrompt ? `${options.systemPrompt}\n\nUser: ${prompt}\nAssistant:` : prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 2048,
          },
        };

        const resp = await fetch(`${provider.endpoint}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        });

        if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
        const data = await resp.json() as { response: string };
        const latency = Date.now() - start;

        return {
          content: data.response || "",
          model: provider.model,
          latencyMs: latency,
          provider: "local",
          providerId: provider.id,
        };
      }

      const resp = await fetch(`${provider.endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
            { role: "user", content: prompt },
          ],
          max_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
      const latency = Date.now() - start;

      return {
        content: data.choices?.[0]?.message?.content || "",
        model: provider.model,
        latencyMs: latency,
        provider: "local",
        providerId: provider.id,
      };
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Generation failed:`, err?.message);
      localModelStatus.available = false;
      localModelStatus.lastChecked = 0;
      return null;
    }
  }

  async generateStream(prompt: string, options: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    onChunk: (chunk: string) => void;
  }): Promise<{ success: boolean; latencyMs: number; providerId: string }> {
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) return { success: false, latencyMs: 0, providerId: "" };

    const provider = this.localProviders.find(p => p.endpoint === localModelStatus.endpoint);
    if (!provider) return { success: false, latencyMs: 0, providerId: "" };

    const start = Date.now();

    try {
      if (provider.type === "ollama") {
        const resp = await fetch(`${provider.endpoint}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: provider.model,
            prompt: options.systemPrompt ? `${options.systemPrompt}\n\nUser: ${prompt}\nAssistant:` : prompt,
            stream: true,
            options: {
              temperature: options.temperature ?? 0.7,
              num_predict: options.maxTokens ?? 2048,
            },
          }),
          signal: AbortSignal.timeout(120000),
        });

        if (!resp.ok || !resp.body) throw new Error(`Ollama HTTP ${resp.status}`);

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter(l => l.trim());
          for (const line of lines) {
            try {
              const data = JSON.parse(line) as { response?: string; done?: boolean };
              if (data.response) options.onChunk(data.response);
              if (data.done) break;
            } catch (err) { logger.warn({ err }, "suppressed error"); }
          }
        }

        return { success: true, latencyMs: Date.now() - start, providerId: provider.id };
      }

      const result = await this.generate(prompt, { ...options });
      if (result) {
        options.onChunk(result.content);
        return { success: true, latencyMs: result.latencyMs, providerId: result.providerId };
      }

      return { success: false, latencyMs: Date.now() - start, providerId: provider.id };
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Stream failed:`, err?.message);
      localModelStatus.available = false;
      localModelStatus.lastChecked = 0;
      return { success: false, latencyMs: Date.now() - start, providerId: provider.id };
    }
  }

  getStatus(): LocalModelStatus {
    return { ...localModelStatus };
  }

  isLocalAvailable(): boolean {
    return localModelStatus.available;
  }
}

export const localModelManager = new LocalModelManager();

export async function initializeLocalModelManager(): Promise<void> {
  console.log(`${LOG_PREFIX} Checking local model availability...`);
  const available = await localModelManager.checkAvailability();
  console.log(`${LOG_PREFIX} Local models: ${available ? "AVAILABLE" : "not available (will use external)"}`);
}
