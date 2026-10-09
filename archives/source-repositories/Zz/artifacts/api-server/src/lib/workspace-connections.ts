import { ReplitConnectors } from "@replit/connectors-sdk";
import { runWithShepherdContext } from "./sovereign-fetch-guard";

export class ConnectionFailure extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

// Clients are created for each call so refreshed connector credentials are used.
// All credentials stay in Replit's server-side connector service.
export async function connectedRequest(provider: "github" | "cursor", path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  try {
    return await runWithShepherdContext("system", async () => {
      const connectors = new ReplitConnectors();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          connectors.proxy(provider, path, init),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("Connection timed out")), 60_000);
            timer.unref();
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }, "Explicit owner-requested workspace connection");
  } catch {
    throw new ConnectionFailure(503, `${provider}-connection-unavailable`,
      `${provider === "cursor" ? "Cursor" : "GitHub"} is not available. Authorize its Replit integration and retry.`);
  }
}

export async function connectionStatus(provider: "github" | "cursor", path: string) {
  try {
    const response = await connectedRequest(provider, path);
    if (!response.ok) {
      return { provider, connected: false, status: response.status, message: "Authorization or provider access is required." };
    }
    return { provider, connected: true, status: response.status, message: "Connection verified with the provider." };
  } catch {
    return { provider, connected: false, status: 503, message: "Authorize this Replit integration to enable live access." };
  }
}
