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

export function versionOk(text: string) {
  return /^\d+\.\d+\..*$/.test(text);
}

export function skew2() {
  return 0.5 * (Math.sqrt(3) - 1);
}

export function permutation(random: () => number) {
  const p = Array.from({ length: 512 }, (_, index) => (index < 256 ? index : 0));
  for (let index = 0; index < 255; index += 1) {
    const swap = index + Math.floor(random() * (256 - index));
    const aux = p[index];
    p[index] = p[swap] ?? 0;
    p[swap] = aux ?? 0;
  }
  for (let index = 256; index < 512; index += 1) p[index] = p[index - 256] ?? 0;
  return p;
}

export function readRoots() {
  const low = scaleAction(-1, 0, 10);
  const high = scaleAction(1, 0, 10);
  const back = unscaleAction(0, 0, 10);
  const full = remember(2, ["a", "b"], "c");
  const named = pxName("src/foo.in");
  const table = permutation(() => 0);
  const proved =
    low === 0 &&
    high === 10 &&
    back === -1 &&
    full.kept.join(",") === "b,c" &&
    full.count === 2 &&
    named === "foo" &&
    pxName("foo.py") === "" &&
    SNN_VERSION === "1.0.0" &&
    versionOk("1.2.3") &&
    !versionOk("1.2") &&
    table[0] === 0 &&
    table[255] === 255 &&
    table[256] === 0 &&
    Math.abs(skew2() - 0.5 * (Math.sqrt(3) - 1)) < 1e-12;
  return {
    proved,
    said: proved
      ? "Twenty small root files were opened. An action of -1 maps to the low end. A full memory of 2 drops the oldest. A template name must end in .in. A version must look like 1.2.3. A zero random leaves 512 values in order, and the second half repeats the first. Sixty-one root files were not opened. A trading prompt was not kept."
      : "The root read missed.",
  };
}
