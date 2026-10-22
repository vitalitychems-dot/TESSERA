/** The city keeps turning while the app is open, on any room. */

let turn = 0;
const listeners = new Set<(next: number) => void>();
let timer: number | null = null;

export function startCity() {
  if (typeof window === "undefined" || timer != null) return;
  timer = window.setInterval(() => {
    turn += 1;
    for (const listen of listeners) listen(turn);
  }, 400);
}

export function watchCity(listen: (next: number) => void) {
  listeners.add(listen);
  listen(turn);
  return () => {
    listeners.delete(listen);
  };
}
