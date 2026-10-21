/** One spin, as ordinary numbers. */

export function born(amplitude: [number, number]) {
  const left = amplitude[0] * amplitude[0];
  const right = amplitude[1] * amplitude[1];
  const total = left + right;
  if (total === 0) return { left: 0, right: 0 };
  return { left: left / total, right: right / total };
}

export function turn(amplitude: [number, number], angle: number): [number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [amplitude[0] * cos - amplitude[1] * sin, amplitude[0] * sin + amplitude[1] * cos];
}

/** Paths that point opposite ways cancel. A plain count would keep both. */
export function interferePick(options: { name: string; paths: number[] }[]) {
  let best = options[0]?.name ?? "";
  let strength = -1;
  for (const option of options) {
    const sum = option.paths.reduce((total, path) => total + path, 0);
    const strengthHere = Math.abs(sum);
    if (strengthHere > strength) {
      strength = strengthHere;
      best = option.name;
    }
  }
  return { name: best, strength };
}
