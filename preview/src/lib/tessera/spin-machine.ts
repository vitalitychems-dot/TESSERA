/** A two-qubit state on this machine. Not a quantum computer. */

const S = Math.SQRT1_2;

export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function hadamard(state: Float64Array, qubit: number) {
  const bit = 1 << qubit;
  const next = new Float64Array(state.length);
  for (let index = 0; index < state.length; index += 1) {
    if (index & bit) continue;
    const pair = index | bit;
    next[index] = S * (state[index] + state[pair]);
    next[pair] = S * (state[index] - state[pair]);
  }
  return next;
}

export function cnot(state: Float64Array, control: number, target: number) {
  const controlBit = 1 << control;
  const targetBit = 1 << target;
  const next = new Float64Array(state.length);
  for (let index = 0; index < state.length; index += 1) {
    const pair = index & controlBit ? index ^ targetBit : index;
    next[pair] = state[index];
  }
  return next;
}

export function bell() {
  return cnot(hadamard(Float64Array.of(1, 0, 0, 0), 0), 0, 1);
}

export function turnOne(angle: number): [number, number] {
  return [Math.cos(angle / 2), Math.sin(angle / 2)];
}

export function shots(state: ArrayLike<number>, count: number, seed: number) {
  const random = mulberry32(seed);
  const weights = Array.from(state, (value) => value * value);
  const counts = new Array<number>(state.length).fill(0);
  for (let shot = 0; shot < count; shot += 1) {
    let mark = random();
    let chosen = weights.length - 1;
    for (let index = 0; index < weights.length; index += 1) {
      mark -= weights[index];
      if (mark <= 0) {
        chosen = index;
        break;
      }
    }
    counts[chosen] += 1;
  }
  return counts;
}

export function tryMachine(count = 4000, seed = 7) {
  const state = bell();
  const counts = shots(state, count, seed);
  const together = counts[0] + counts[3];
  const split = counts[1] + counts[2];
  const back = hadamard(hadamard(Float64Array.of(1, 0), 0), 0);
  return {
    counts,
    together,
    split,
    held: together > split * 9 && Math.abs(back[0] - 1) < 1e-9,
    tokens: 0,
  };
}
