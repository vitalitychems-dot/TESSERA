/** Read from the checkouts. Their files are not imported. */

export function queryOk(query: string) {
  const text = query.trim();
  if (text.length < 3 || text.length > 1000) return false;
  const lower = text.toLowerCase();
  return !["<script", "javascript:", "eval(", "exec("].some((pattern) => lower.includes(pattern));
}

export function riseState(hunger: number, fatigue: number, delta = 1) {
  return {
    hunger: Math.min(1, hunger + 0.1 * delta),
    fatigue: Math.min(1, fatigue + 0.05 * delta),
  };
}

export function readCheckouts() {
  const next = riseState(0.5, 0.5);
  const allowed = queryOk("hello");
  const proved = allowed && !queryOk("no") && !queryOk("<script>") && next.hunger === 0.6 && next.fatigue === 0.55;
  return {
    proved,
    hunger: next.hunger,
    said: proved
      ? "Two functions were read. A query of hello is allowed. Hunger 0.5 becomes 0.6. Fatigue 0.5 becomes 0.55."
      : "The checkout read missed.",
  };
}
