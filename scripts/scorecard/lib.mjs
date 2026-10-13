// Shared helpers for the scorecard. Every score prints {name, value, noise_band}.
export const round4 = (x) => (x == null || Number.isNaN(x) ? null : +Number(x).toFixed(4));
export function arg(name, def, argv = process.argv.slice(2)) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}
// Run fn() n times; value = median, noise_band = max - min (0 for deterministic scores).
export async function repeat(fn, n = 5) {
  const v = [];
  for (let i = 0; i < n; i++) v.push(await fn());
  if (v.some((x) => x == null)) return { value: null, noise_band: null, runs: n };
  const s = [...v].sort((a, b) => a - b);
  return { value: round4(s[Math.floor(n / 2)]), noise_band: round4(s[n - 1] - s[0]), runs: n };
}
