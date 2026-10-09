import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clampEvolutionFanout, MAX_EVOLUTION_ROUNDS, MAX_EVOLUTION_SPEAKERS } from "../lib/grand-evolution-limits";
import { buildRepoManifest, isSecretManifestEntry } from "../lib/repo-manifest";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("grand evolution fan-out cap", () => {
  it("clamps speakers and rounds including full mode", () => {
    expect(clampEvolutionFanout({
      mode: "full",
      smokeSpeakers: 10_000,
      rounds: 100,
    })).toEqual({ speakers: MAX_EVOLUTION_SPEAKERS, rounds: MAX_EVOLUTION_ROUNDS });
    expect(clampEvolutionFanout({
      mode: "smoke",
      smokeSpeakers: 7,
    })).toEqual({ speakers: 7, rounds: MAX_EVOLUTION_ROUNDS });
    expect(clampEvolutionFanout({
      mode: "full",
      smokeSpeakers: Number.POSITIVE_INFINITY,
      rounds: Number.NaN,
    })).toEqual({ speakers: MAX_EVOLUTION_SPEAKERS, rounds: MAX_EVOLUTION_ROUNDS });
    expect(MAX_EVOLUTION_SPEAKERS).toBe(8);
    expect(MAX_EVOLUTION_ROUNDS).toBe(3);
  });
});

describe("repo manifest secret skip", () => {
  it("does not list or read secret files", async () => {
    const root = mkdtempSync(join(tmpdir(), "privacy-e-manifest-"));
    dirs.push(root);
    const secretText = "synthetic-secret-marker-do-not-emit";
    const publicName = "notes.txt";
    writeFileSync(join(root, publicName), "synthetic-public-note");
    writeFileSync(join(root, ".env"), secretText);
    writeFileSync(join(root, ".env.local"), secretText);
    writeFileSync(join(root, "id_rsa"), secretText);
    writeFileSync(join(root, "cert.pem"), secretText);
    writeFileSync(join(root, "private.key"), secretText);
    writeFileSync(join(root, "client.p12"), secretText);
    writeFileSync(join(root, ".npmrc"), secretText);
    writeFileSync(join(root, "credentials.json"), secretText);
    mkdirSync(join(root, "secrets"));
    writeFileSync(join(root, "secrets", "token.txt"), secretText);

    expect(isSecretManifestEntry(".env")).toBe(true);
    expect(isSecretManifestEntry(".env.local")).toBe(true);
    expect(isSecretManifestEntry("id_rsa")).toBe(true);
    expect(isSecretManifestEntry("cert.pem")).toBe(true);
    expect(isSecretManifestEntry("private.key")).toBe(true);
    expect(isSecretManifestEntry("client.p12")).toBe(true);
    expect(isSecretManifestEntry(".npmrc")).toBe(true);
    expect(isSecretManifestEntry("credentials.json")).toBe(true);
    expect(isSecretManifestEntry("token.txt", "secrets/token.txt")).toBe(true);
    expect(isSecretManifestEntry(publicName)).toBe(false);

    const manifest = await buildRepoManifest(root);
    const rendered = JSON.stringify(manifest);
    expect(rendered).not.toContain(secretText);
    expect(rendered).not.toContain(".env");
    expect(rendered).not.toContain("id_rsa");
    expect(rendered).not.toContain("cert.pem");
    expect(rendered).not.toContain("private.key");
    expect(rendered).not.toContain("client.p12");
    expect(rendered).not.toContain(".npmrc");
    expect(rendered).not.toContain("credentials.json");
    expect(rendered).not.toContain("token.txt");
    expect(manifest.map((entry) => entry.path)).toEqual([publicName]);
  });

  it("skips local data, vault, and ingest directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "privacy-e-manifest-skip-"));
    dirs.push(root);
    const marker = "synthetic-vault-marker-do-not-emit";
    const publicName = "notes.txt";
    writeFileSync(join(root, publicName), "synthetic-public-note");
    for (const name of [".local-data", "data", ".sovereign-data", "ingest", "natal-vault", "natal-vault-extra"]) {
      mkdirSync(join(root, name));
      writeFileSync(join(root, name, "row.txt"), marker);
    }
    writeFileSync(join(root, "natal-vault.json"), marker);

    const manifest = await buildRepoManifest(root);
    const rendered = JSON.stringify(manifest);
    const parts = manifest.flatMap((entry) => entry.path.split("/"));
    expect(rendered).not.toContain(marker);
    expect(parts).not.toContain(".local-data");
    expect(parts).not.toContain("data");
    expect(parts).not.toContain(".sovereign-data");
    expect(parts).not.toContain("ingest");
    expect(parts.some((part) => part.toLowerCase().startsWith("natal-vault"))).toBe(false);
    expect(manifest.map((entry) => entry.path)).toEqual([publicName]);
  });

  it("skips a nested INGEST directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "privacy-e-manifest-deep-"));
    dirs.push(root);
    const marker = "synthetic-deep-ingest-marker-do-not-emit";
    mkdirSync(join(root, "deep", "INGEST"), { recursive: true });
    writeFileSync(join(root, "deep", "INGEST", "row.txt"), marker);
    mkdirSync(join(root, "deep", "keep"), { recursive: true });
    writeFileSync(join(root, "deep", "keep", "visible.txt"), "synthetic-visible-note");

    const manifest = await buildRepoManifest(root);
    const rendered = JSON.stringify(manifest);
    const paths = manifest.map((entry) => entry.path.replace(/\\/g, "/"));
    expect(rendered).not.toContain(marker);
    expect(paths.some((entry) => entry.toLowerCase().includes("ingest"))).toBe(false);
    expect(paths).toContain("deep/keep/visible.txt");
  });
});
