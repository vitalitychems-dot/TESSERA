/** State, clamp, and one reward step. No file is read. */

export function stateKey(hunger: number, fatigue: number) {
  return `h${Math.trunc(hunger * 10)}_f${Math.trunc(fatigue * 10)}`;
}

export function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function qStep(old: number, reward: number, future: number, alpha = 0.1, gamma = 0.9) {
  return old + alpha * (reward + gamma * future - old);
}
