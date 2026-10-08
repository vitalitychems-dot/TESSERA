import { afterEach, describe, expect, it, vi } from "vitest";
import { generateEmbedding, setNeuralPreference } from "../lib/neural-embeddings";

describe("neural embeddings", () => {
  const originalModel = process.env.TESSERA_EMBED_MODEL;

  afterEach(() => {
    if (originalModel === undefined) delete process.env.TESSERA_EMBED_MODEL;
    else process.env.TESSERA_EMBED_MODEL = originalModel;
    setNeuralPreference(1);
  });

  it("uses the local fallback and does not fetch when TESSERA_EMBED_MODEL is unset", async () => {
    delete process.env.TESSERA_EMBED_MODEL;
    setNeuralPreference(1);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const vec = await generateEmbedding(`unset-embed-model-${Date.now()}`);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(vec).toHaveLength(256);
    fetchSpy.mockRestore();
  });
});
