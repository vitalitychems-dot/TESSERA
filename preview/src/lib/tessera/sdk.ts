const REFUSED_HOSTS = new Set(["mesh.tessera.sovereign"]);

export type CompleteInput = {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

export type TesseraClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  meshEndpoint?: string;
};

export class TesseraClient {
  options: TesseraClientOptions;

  constructor(options: TesseraClientOptions) {
    this.options = options;
  }

  intelligence = {
    complete: async (input: CompleteInput) => {
      const endpoint = this.options.baseUrl || this.options.meshEndpoint || "";
      let url: URL;
      try {
        url = new URL(endpoint);
      } catch {
        throw new Error("Pass baseUrl as an https address. mesh.tessera.sovereign is not a host.");
      }
      if (url.protocol !== "https:") throw new Error("Only https endpoints are called.");
      if (REFUSED_HOSTS.has(url.hostname)) {
        throw new Error("mesh.tessera.sovereign does not resolve. There is no mesh package to install.");
      }
      const key = this.options.apiKey?.trim();
      if (!key) throw new Error("Set TESSERA_API_KEY on the server. Do not put it in the page.");
      const root = endpoint.replace(/\/$/, "");
      const res = await fetch(`${root}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: input.model || "grok-4.5",
          temperature: input.temperature ?? 0.2,
          max_tokens: input.maxTokens ?? 400,
          messages: [{ role: "user", content: input.prompt }],
        }),
      });
      if (!res.ok) throw new Error(`The endpoint returned ${res.status}.`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return { content: body.choices?.[0]?.message?.content ?? "" };
    },
  };
}
