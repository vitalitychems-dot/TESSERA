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

  it("fallback vector is not 8 copies of one 32-dim block", async () => {
    delete process.env.TESSERA_EMBED_MODEL;
    const vec = await generateEmbedding(`period-check consensus memory retrieval ${Date.now()}`);
    let maxDiff = 0;
    for (let i = 0; i + 32 < vec.length; i++) maxDiff = Math.max(maxDiff, Math.abs(vec[i] - vec[i + 32]));
    expect(maxDiff).toBeGreaterThan(0.01);
  });
});
