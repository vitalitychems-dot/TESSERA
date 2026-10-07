import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAbsorptionSponge, deriveLeadingActions } from "../lib/v2/absorption-sponge";
import { createMemoryStore } from "../lib/memory/store";
import { readAffect } from "../lib/v2/affect-compass";

let dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))); dirs = []; });
async function tempStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "sponge-"));
  dirs.push(dir);
  return createMemoryStore({ dir });
}

describe("Absorption Sponge", () => {
  it("records redacted, recalls prior lessons, and leads with a next step", async () => {
    const sponge = createAbsorptionSponge(await tempStore());
    const first = await sponge.absorb({
      sourceAgent: "test", input: "remember: always verify installed packages, not just the lockfile",
      output: "Noted.", tags: ["correction"],
    });
    expect(first.recordId).toBeTruthy();
    expect(first.leadingActions.join(" ")).toMatch(/standing instruction/);
    expect(first.limits).toContain("not model weight training");

    const second = await sponge.absorb({
      sourceAgent: "test", input: "verify installed packages before trusting the audit", output: "Done.",
    });
    expect(second.recalledLessons.length).toBeGreaterThan(0);
  });

  it("marks corrections for regression tests and questions for confirmation", () => {
    expect(deriveLeadingActions("this is broken, fix the error", []).join(" ")).toMatch(/regression test/);
    expect(deriveLeadingActions("what is the status?", []).join(" ")).toMatch(/Confirm the answer/);
    expect(deriveLeadingActions("plain statement", []).join(" ")).toMatch(/No prior lessons/);
  });
});

describe("Affect Compass", () => {
  it("reads frustration with high intensity and care-first guidance", () => {
    const reading = readAffect("This is broken AGAIN and it is really frustrating, nothing is working!");
    expect(reading.emotions[0].name).toBe("frustration");
    expect(reading.intensity).toBeGreaterThan(0.4);
    expect(reading.toneGuidance.join(" ")).toMatch(/Acknowledge the frustration/);
    expect(reading.limitation).toContain("not felt emotion");
  });

  it("reads joy positively and stays honest on neutral text", () => {
    const happy = readAffect("This is amazing, thank you, I love it");
    expect(happy.valence).toBeGreaterThan(0);
    const neutral = readAffect("Show me the dependency report.");
    expect(neutral.intensity).toBe(0);
    expect(neutral.toneGuidance.join(" ")).toMatch(/Neutral/);
  });
});
