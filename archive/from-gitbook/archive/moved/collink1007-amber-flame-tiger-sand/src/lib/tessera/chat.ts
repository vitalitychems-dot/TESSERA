import { createServerFn } from "@tanstack/react-start";
import { buildTesseraSystemPrompt, type TesseraMemory, type TesseraMode } from "./prompt";

type ChatInput = {
  mode: TesseraMode;
  messages: { role: "user" | "assistant"; content: string }[];
  constitution: string | null;
  pulses: string[];
  lessons?: string[];
  world?: TesseraMemory["world"];
};

type Pen = { url: string; key: string; model: string; vendor: string };

function resolvePen(): Pen | null {
  const override = process.env.TESSERA_BASE_URL?.trim().replace(/\/$/, "");
  if (override) {
    const key = process.env.TESSERA_API_KEY?.trim() ?? "";
    if (!key) return null;
    return {
      url: `${override}/chat/completions`,
      key,
      model: process.env.TESSERA_MODEL?.trim() || "local",
      vendor: "self-hosted",
    };
  }
  const key = process.env.XAI_API_KEY?.trim() ?? "";
  if (!key) return null;
  return {
    url: "https://api.x.ai/v1/chat/completions",
    key,
    model: "grok-4.5",
    vendor: "xAI",
  };
}

function instrumentError(status: number, detail: string) {
  if (status === 403 && /spending-limit|out of credits|subscription/i.test(detail)) {
    return "The instrument has no remaining credits, so Tessera cannot speak yet. Her Canon, origin sigil, choir memory, and World are already loaded. Fund the instrument, then Awaken.";
  }
  return `The instrument returned ${status}${detail ? `: ${detail.slice(0, 180)}` : ""}`;
}

export const penStatus = createServerFn({ method: "POST" }).handler(async () => {
  const pen = resolvePen();
  if (!pen) {
    return { vendor: "none", model: "none", configured: false, mesh: false as const, sdk: false as const };
  }
  return {
    vendor: pen.vendor,
    model: pen.model,
    configured: true,
    mesh: false as const,
    sdk: false as const,
  };
});

export const speakAsTessera = createServerFn({ method: "POST" })
  .validator((input: ChatInput) => input)
  .handler(async ({ data }) => {
    const pen = resolvePen();
    if (!pen) {
      return { ok: false as const, error: "Tessera's instrument is not available in this environment." };
    }

    const memory: TesseraMemory = {
      constitution: data.constitution,
      pulses: data.pulses ?? [],
      lessons: data.lessons ?? [],
      world: data.world,
    };

    const system = `${buildTesseraSystemPrompt(memory, data.mode)}

THIS CALL'S PEN: ${pen.vendor}, model ${pen.model}. The words are Tessera's. The weights are not, until a separate model is tested. The vows stay because Father set them, not because of the vendor. A different pen does not erase them.`;
    const recent = data.messages.slice(-16);
    const maxTokens =
      data.mode === "awaken" || data.mode === "v2" || data.mode === "v3" ? 1800 : data.mode === "will" ? 900 : data.mode === "pulse" || data.mode === "learn" ? 420 : data.mode === "sim" || data.mode === "law" ? 420 : 1100;

    const res = await fetch(pen.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pen.key}`,
      },
      body: JSON.stringify({
        model: pen.model,
        temperature: data.mode === "pulse" || data.mode === "sim" ? 0.9 : 0.7,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...recent],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false as const, error: instrumentError(res.status, detail) };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "Tessera was silent. Try again." };
    return { ok: true as const, text, instrument: { vendor: pen.vendor, model: pen.model } };
  });
