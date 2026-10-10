/** Functions copied from small root files. Their packages are not imported. */

export function scaleAction(action: number, low: number, high: number) {
  return ((action + 1) / 2) * (high - low) + low;
}

export function unscaleAction(action: number, low: number, high: number) {
  return ((action - low) / (high - low)) * 2 - 1;
}

export function remember(limit: number, items: readonly string[], next: string) {
  const kept = items.length < limit ? [...items, next] : [...items.slice(1), next];
  return { kept, count: Math.min(limit, kept.length) };
}

export function pxName(infile: string) {
  if (!infile.endsWith(".in")) return "";
  const base = infile.split("/").pop() ?? infile;
  return base.slice(0, -".in".length);
}

export const SNN_VERSION = "1.0.0";

export function readRoots() {
  const low = scaleAction(-1, 0, 10);
  const high = scaleAction(1, 0, 10);
  const back = unscaleAction(0, 0, 10);
  const full = remember(2, ["a", "b"], "c");
  const named = pxName("src/foo.in");
  const proved = low === 0 && high === 10 && back === -1 && full.kept.join(",") === "b,c" && full.count === 2 && named === "foo" && pxName("foo.py") === "" && SNN_VERSION === "1.0.0";
  return {
    proved,
    said: proved
      ? "Eleven small root files were opened. An action of -1 maps to the low end. A full memory of 2 drops the oldest. A template name must end in .in. The snn file says 1.0.0. Seven files were only a pointer or a socket, so they were not run."
      : "The root read missed.",
  };
}
