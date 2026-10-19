import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");
const SPAWNER = join(SRC, "lib", "agent-spawner.ts");
const GATE_CALL = /\b(checkAgentCreation|assertAgentCreationAllowed)\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(p, out);
    } else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Start offset of the top-level function declaration enclosing `index`. */
function enclosingFunctionStart(src: string, index: number): number {
  const re = /^(?:export )?(?:async )?function \w+/gm;
  let start = -1;
  for (let m = re.exec(src); m && m.index < index; m = re.exec(src)) start = m.index;
  return start;
}

describe("agent-creation path inventory", () => {
  const spawnerSrc = readFileSync(SPAWNER, "utf8");

  it("every place the spawner pushes a new agent is preceded by a gate call in the same function", () => {
    const pushes = [...spawnerSrc.matchAll(/activeSpawned\.push\(/g)].map((m) => m.index!);
    expect(pushes.length).toBeGreaterThanOrEqual(2);
    for (const idx of pushes) {
      const start = enclosingFunctionStart(spawnerSrc, idx);
      expect(start, "push outside a function").toBeGreaterThanOrEqual(0);
      const head = spawnerSrc.slice(start, idx);
      const fnName = /function (\w+)/.exec(head)![1];
      expect(GATE_CALL.test(head), `${fnName} pushes an agent without calling the admission gate first`).toBe(true);
    }
  });

  it("no other module creates agents by pushing into the spawner's active list", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file === SPAWNER) continue;
      const text = readFileSync(file, "utf8");
      if (/activeSpawned\s*\.\s*(push|unshift|splice)\(/.test(text) || /activeSpawned\s*=[^=]/.test(text)) {
        offenders.push(relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("documents the one non-gated write in the spawner: restoring persisted state in loadState", () => {
    const assignments = [...spawnerSrc.matchAll(/activeSpawned\s*=[^=]/g)].map((m) => enclosingFunctionStart(spawnerSrc, m.index!));
    const names = assignments.map((s) => /function (\w+)/.exec(spawnerSrc.slice(s))![1]);
    expect(names.every((n) => n === "loadState")).toBe(true);
  });

  it("spawnAgent and the batch helpers route through trySpawnAgent, not a second creation body", () => {
    expect(spawnerSrc).toMatch(/export function spawnAgent[\s\S]*?trySpawnAgent\(/);
    const batchBodies = spawnerSrc.slice(spawnerSrc.indexOf("export function spawnBatch("), spawnerSrc.indexOf("export function retireAgent"));
    expect(batchBodies).toContain("spawnAgent(");
    expect(batchBodies).not.toContain("activeSpawned");
  });
});
