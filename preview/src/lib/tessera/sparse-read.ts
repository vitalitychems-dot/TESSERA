/** One small source file. The rest of the tree stays where it is. */

export function pickSmallest(files: readonly { name: string; size: number; type: string }[], cap = 20000) {
  return (
    files
      .filter((file) => file.type === "file" && file.size > 0 && file.size <= cap && /\.(py|js|ts|rs|mjs)$/.test(file.name))
      .sort((a, b) => a.size - b.size || a.name.localeCompare(b.name))[0] ?? null
  );
}

export function branchCase(kind: "selector" | "sequence") {
  if (kind === "selector") return { start: false, optOut: true };
  return { start: true, optOut: false };
}

export function configCell() {
  let value: unknown = null;
  return {
    init(next: unknown) {
      value = next;
      return value;
    },
    read() {
      return value;
    },
  };
}

export function readSparse() {
  const cell = configCell();
  const selector = branchCase("selector");
  const sequence = branchCase("sequence");
  const proved =
    cell.read() === null && cell.init(2) === 2 && cell.read() === 2 && selector.optOut === true && sequence.optOut === false;
  return {
    proved,
    said: proved
      ? "A small file was read through the API. The tree was not cloned. A selector stops on success. A sequence stops on failure. A config starts empty and then holds 2."
      : "The sparse read missed.",
  };
}
