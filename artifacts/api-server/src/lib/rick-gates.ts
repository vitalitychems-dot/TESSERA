/**
 * Rick gates (Gitbook mesh/RICK.md rules R1/R2).
 * R1: only measured numbers — no hardcoded forecasts.
 * R2: Rick proposes; a non-Rick actor approves / implements, with a test reference.
 * Autonomous Rick behaviour (boot loop, self-dispatch, Meeseeks spawning) is OFF
 * unless TESSERA_ENABLE_RICK_LOOP=1. Default is 0.
 */
export const RICK_LOOP_FLAG = "TESSERA_ENABLE_RICK_LOOP";
export const UNMEASURED = "UNMEASURED";

export function isRickLoopEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env[RICK_LOOP_FLAG] ?? "0").trim() === "1";
}

const RICK_ACTOR_RE = /(rick|sanchez|c-?137|meeseeks)/i;

export function isRickActor(actor: string): boolean {
  return RICK_ACTOR_RE.test(actor);
}

export type GateResult = { ok: true; actor: string; testRef: string } | { ok: false; error: string };

/** Require a non-Rick actor and (optionally) a non-empty test reference. */
export function checkActorAndTestRef(
  actorRaw: unknown,
  testRefRaw: unknown,
  opts: { requireTestRef?: boolean; role?: string } = {},
): GateResult {
  const role = opts.role ?? "approver";
  const requireTestRef = opts.requireTestRef ?? true;
  const actor = typeof actorRaw === "string" ? actorRaw.trim().slice(0, 120) : "";
  const testRef = typeof testRefRaw === "string" ? testRefRaw.trim().slice(0, 400) : "";
  if (!actor) return { ok: false, error: `${role} is required (a non-Rick reviewer)` };
  if (isRickActor(actor)) return { ok: false, error: `${role} must not be Rick (R2: Rick proposes, never approves/implements)` };
  if (requireTestRef && !testRef) return { ok: false, error: "testRef is required (link or id of the test that proves it)" };
  return { ok: true, actor, testRef };
}

/** Build a test plan in place of a numeric forecast. */
export function testPlanFor(metric: string): string {
  return `${UNMEASURED} — test: measure ${metric} before/after; pass = measured improvement recorded with a test ref.`;
}

/** Strip numeric forecasts (percentages, Nx multipliers) from free text. */
export function stripForecasts(text: string): string {
  return text
    .replace(/[~+]?\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?\s*%/g, "[unmeasured]")
    .replace(/[~+]?\d+(?:\.\d+)?\s*%/g, "[unmeasured]")
    .replace(/\b\d+(?:\.\d+)?x\b/gi, "[unmeasured]");
}
