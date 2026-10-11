/** Learning steps with no file read. */

export function warmupLr(base: number, epoch: number, total: number, multiplier = 1) {
  if (multiplier < 1) return base;
  if (epoch > total) return base * multiplier;
  if (multiplier === 1) return base * (epoch / total);
  return base * ((multiplier - 1) * (epoch / total) + 1);
}

export function leakyStep(mem: number, input: number, beta: number) {
  const kept = Math.min(1, Math.max(0, beta));
  return kept * mem + input;
}

export function resetMem(mem: number, threshold: number, spiked: boolean, soft: boolean) {
  if (!spiked) return mem;
  return soft ? mem - threshold : 0;
}
