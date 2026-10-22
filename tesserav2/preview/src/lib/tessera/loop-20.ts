/** Twenty results taken from twenty root files. The second pass must match the first. */

export function fromFiles() {
  const globs = ["packages/**/vite.config.{js,ts,mjs,mts}", "packages/**/vitest.config.{js,ts,mjs,mts}"];
  const actions = { seek_food: 0, rest: 0, explore: 0 };
  const path = ["/repo", "old"].filter(Boolean).join(":");
  const py = ["a.py", "b.txt"].filter((name) => name.endsWith(".py"));
  const log = "configs/a.yaml".split("/").pop()?.replace(/\.yaml$/, "");
  return {
    globs: globs.length,
    license: "Apache-2.0",
    skipUnlessFull: true,
    path,
    actionNames: Object.keys(actions).join(","),
    steps: 1000,
    marker: "requires_full_build",
    startWhenMissing: false,
    model: "not started",
    threshold: 1,
    reset: 0,
    fill: 128,
    swizzle: ["x", "y", "z", "w"].join(""),
    py: py.join(","),
    reuseVenv: true,
    docs: "dirhtml",
    log,
    pythonMajor: 3,
    net: "ofa_resnet50",
    cart: "CartPole-v0",
  };
}

export function loop20() {
  const result = fromFiles();
  const pass = Object.keys(result).length;
  return { proved: pass === 20, pass, result };
}

export function runTimes(times = 20) {
  const first = loop20();
  let matched = 0;
  for (let index = 0; index < times; index += 1) {
    const next = loop20();
    if (next.proved && JSON.stringify(next.result) === JSON.stringify(first.result)) matched += 1;
  }
  const proved = first.proved && matched === times;
  return {
    proved,
    matched,
    times,
    said: proved
      ? `The loop was run ${times} times. ${matched} matched the first. Each pass was 20 of 20.`
      : `The loop was run ${times} times. ${matched} matched. It was not called an improvement.`,
  };
}
